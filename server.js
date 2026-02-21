/**
 * 代理订阅转换器 - 本地订阅服务
 * 
 * 核心流程:
 *   1. 用户在网页粘贴代理链接 → 点击「保存到订阅」
 *   2. 服务器存储原始链接到本地文件
 *   3. 生成订阅 URL: http://localhost:3456/sub?format=clash-meta
 *   4. 客户端添加此 URL 为订阅源，每次更新获取最新节点
 *   5. 用户更新链接后再次保存，客户端刷新即可获取新节点
 * 
 * 启动: node server.js
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const vm = require('vm');
const url = require('url');

// ==================== 配置加载 ====================

function loadConfig() {
    const defaultConfig = {
        port: 3456,
        dataDir: './data',
        security: {
            maxRequestSize: 10 * 1024 * 1024,
            maxLinksCount: 10000,
            maxLinkLength: 8192,
            apiKey: '',  // API 密钥（为空则不启用认证）
            enableAuth: false  // 是否启用认证
        },
        server: {
            allowLan: true,
            cors: true
        },
        defaults: {
            httpPort: 7890,
            socksPort: 7891,
            mode: 'rule',
            logLevel: 'info',
            enableDns: true,
            testInterval: 300
        },
        subscription: {
            title: '代理订阅',
            updateInterval: 24,  // 小时
            traffic: {
                enabled: false,
                upload: 0,
                download: 0,
                total: 107374182400,  // 100GB
                resetDay: 1  // 每月1号重置
            },
            expire: {
                enabled: false,
                timestamp: 0  // Unix 时间戳
            }
        },
        autoUpdate: {
            enabled: false,
            interval: 3600,  // 秒
            sources: []
        }
    };

    try {
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            // 深度合并配置
            return deepMerge(defaultConfig, userConfig);
        }
    } catch (e) {
        console.warn('配置文件加载失败，使用默认配置:', e.message);
    }

    // 支持环境变量
    if (process.env.PORT) defaultConfig.port = parseInt(process.env.PORT);
    if (process.env.DATA_DIR) defaultConfig.dataDir = process.env.DATA_DIR;

    return defaultConfig;
}

// 深度合并对象
function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

const config = loadConfig();

// ==================== 配置 ====================

const PORT = config.port;
const DATA_DIR = path.join(__dirname, config.dataDir);
const LINKS_FILE = path.join(DATA_DIR, 'links.txt');
const META_FILE = path.join(DATA_DIR, 'meta.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

// 安全配置
const MAX_REQUEST_SIZE = config.security.maxRequestSize;
const MAX_LINKS_COUNT = config.security.maxLinksCount;
const MAX_LINK_LENGTH = config.security.maxLinkLength;

// 确保数据目录
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ==================== 加载转换引擎 ====================

function loadEngine() {
    const sandbox = {
        console, parseInt, parseFloat,
        decodeURIComponent, encodeURIComponent,
        JSON, Array, Object, String, Number, Boolean, Set, Map,
        RegExp, Error, TypeError, Math, Date, isNaN, isFinite,
        // 使用 Buffer 实现 atob/btoa，支持 UTF-8
        atob: (str) => {
            try {
                return Buffer.from(str, 'base64').toString('utf-8');
            } catch (e) {
                return Buffer.from(str, 'base64').toString('latin1');
            }
        },
        btoa: (str) => {
            try {
                return Buffer.from(str, 'utf-8').toString('base64');
            } catch (e) {
                return Buffer.from(str, 'latin1').toString('base64');
            }
        },
        // 移除不安全的 escape/unescape，使用安全的替代方案
        escape: (str) => encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()),
        unescape: (str) => {
            try {
                return decodeURIComponent(str.replace(/%(?![0-9a-fA-F]{2})/g, '%25'));
            } catch (e) {
                return str;
            }
        },
        URL, URLSearchParams, setTimeout, clearTimeout,
        document: { createElement: () => ({ textContent: '', get innerHTML() { return this.textContent; } }) }
    };

    const ctx = vm.createContext(sandbox);
    const files = ['parsers.js', 'encoders.js', 'yaml.js', 'generators.js'];
    for (const f of files) {
        const code = fs.readFileSync(path.join(__dirname, 'js', f), 'utf-8');
        vm.runInContext(code, ctx);
    }
    return ctx;
}

const engine = loadEngine();

// ==================== 自动更新功能 ====================

async function fetchSubscription(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const timeout = 30000; // 30秒超时

        const req = client.get(url, { timeout }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }

            let data = '';
            res.on('data', chunk => {
                data += chunk;
                if (data.length > MAX_REQUEST_SIZE) {
                    req.destroy();
                    reject(new Error('响应体过大'));
                }
            });
            res.on('end', () => resolve(data));
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
    });
}

async function updateFromSources() {
    if (!config.autoUpdate.enabled || !config.autoUpdate.sources.length) {
        return;
    }

    console.log(`[${time()}] 开始自动更新订阅...`);

    let allLinks = [];
    let successCount = 0;
    let failCount = 0;

    for (const source of config.autoUpdate.sources) {
        try {
            console.log(`[${time()}] 正在获取: ${source}`);
            const content = await fetchSubscription(source);

            // 尝试 Base64 解码
            let decoded = content;
            try {
                decoded = Buffer.from(content.trim(), 'base64').toString('utf-8');
            } catch (e) {
                // 不是 Base64，使用原始内容
            }

            allLinks.push(decoded);
            successCount++;
            console.log(`[${time()}] ✓ 获取成功: ${source}`);
        } catch (e) {
            failCount++;
            console.error(`[${time()}] ✗ 获取失败: ${source} - ${e.message}`);
        }
    }

    if (allLinks.length > 0) {
        const combined = allLinks.join('\n');
        try {
            const result = convertLinks(combined, 'raw');
            await saveLinks(combined, result.count);
            console.log(`[${time()}] 自动更新完成: ${result.count} 个节点 (成功 ${successCount}/${config.autoUpdate.sources.length})`);
        } catch (e) {
            console.error(`[${time()}] 保存失败: ${e.message}`);
        }
    } else {
        console.log(`[${time()}] 自动更新失败: 所有源都无法访问`);
    }
}

// 启动自动更新定时器
let updateTimer = null;
function startAutoUpdate() {
    if (!config.autoUpdate.enabled) return;

    console.log(`[${time()}] 自动更新已启用，间隔: ${config.autoUpdate.interval} 秒`);

    // 立即执行一次
    updateFromSources().catch(e => console.error('自动更新错误:', e));

    // 定时执行
    updateTimer = setInterval(() => {
        updateFromSources().catch(e => console.error('自动更新错误:', e));
    }, config.autoUpdate.interval * 1000);
}

function stopAutoUpdate() {
    if (updateTimer) {
        clearInterval(updateTimer);
        updateTimer = null;
        console.log(`[${time()}] 自动更新已停止`);
    }
}

// ==================== 客户端识别 ====================

function detectClientFromUserAgent(userAgent) {
    if (!userAgent) return 'base64';

    const ua = userAgent.toLowerCase();

    // Clash 系列
    if (ua.includes('clash-verge') || ua.includes('clash verge')) return 'clash-meta';
    if (ua.includes('clash.meta') || ua.includes('clash meta')) return 'clash-meta';
    if (ua.includes('mihomo')) return 'clash-meta';
    if (ua.includes('clash')) return 'clash-yaml';

    // Surge
    if (ua.includes('surge')) return 'surge';

    // Sing-Box / NekoBox
    if (ua.includes('sing-box') || ua.includes('singbox')) return 'sing-box';
    if (ua.includes('nekobox') || ua.includes('neko')) return 'sing-box';

    // Shadowrocket / Quantumult X / V2RayN 等使用 Base64
    if (ua.includes('shadowrocket')) return 'base64';
    if (ua.includes('quantumult')) return 'base64';
    if (ua.includes('v2rayn') || ua.includes('v2rayng')) return 'base64';
    if (ua.includes('pharos')) return 'base64';

    // 默认返回 Base64（最通用）
    return 'base64';
}

// ==================== 订阅信息生成 ====================

function generateSubscriptionHeaders() {
    const headers = {};
    const subConfig = config.subscription;

    // Profile-Title (Base64 编码)
    if (subConfig.title) {
        headers['Profile-Title'] = Buffer.from(subConfig.title, 'utf-8').toString('base64');
    }

    // Profile-Update-Interval (小时)
    headers['Profile-Update-Interval'] = String(subConfig.updateInterval || 24);

    // Subscription-Userinfo
    const userinfo = [];

    if (subConfig.traffic && subConfig.traffic.enabled) {
        const traffic = subConfig.traffic;
        userinfo.push(`upload=${traffic.upload || 0}`);
        userinfo.push(`download=${traffic.download || 0}`);
        userinfo.push(`total=${traffic.total || 0}`);
    } else {
        userinfo.push('upload=0');
        userinfo.push('download=0');
        userinfo.push('total=0');
    }

    // 到期时间：如果未启用或 timestamp=0，不添加 expire 字段（表示长期有效）
    if (subConfig.expire && subConfig.expire.enabled && subConfig.expire.timestamp > 0) {
        userinfo.push(`expire=${subConfig.expire.timestamp}`);
    }

    headers['Subscription-Userinfo'] = userinfo.join('; ');

    return headers;
}

// 格式化流量显示（字节转可读格式）
function formatTraffic(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + units[i];
}

// 格式化到期时间
function formatExpireTime(timestamp) {
    if (!timestamp || timestamp === 0) return '永久';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ==================== API 认证 ====================

function requireAuth(req, res) {
    // 如果未启用认证，直接通过
    if (!config.security.enableAuth || !config.security.apiKey) {
        return true;
    }

    // 检查 Authorization 头
    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-api-key'];

    // 支持两种认证方式
    // 1. Authorization: Bearer <token>
    // 2. X-API-Key: <token>
    let providedKey = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        providedKey = authHeader.substring(7);
    } else if (apiKeyHeader) {
        providedKey = apiKeyHeader;
    }

    // 验证密钥
    if (providedKey === config.security.apiKey) {
        return true;
    }

    // 认证失败
    res.writeHead(401, {
        'Content-Type': 'application/json; charset=utf-8',
        'WWW-Authenticate': 'Bearer realm="API"'
    });
    res.end(JSON.stringify({
        error: '未授权访问',
        message: '请提供有效的 API 密钥',
        hint: '在请求头中添加: Authorization: Bearer <your-api-key> 或 X-API-Key: <your-api-key>'
    }));
    return false;
}

// ==================== 数据读写（异步版本） ====================

async function saveLinks(rawText, nodeCount, nodeNames) {
    // 读取已有的旧链接
    let existingLinks = '';
    try {
        existingLinks = await fsPromises.readFile(LINKS_FILE, 'utf-8');
    } catch (e) {
        // 文件不存在，忽略
    }

    // 合并旧链接和新链接，然后去重
    const oldLines = existingLinks.split('\n').filter(l => l.trim());
    const newLines = rawText.split('\n').filter(l => l.trim());
    const seen = new Set();
    const merged = [];

    // 新链接优先（放在前面），再追加旧链接中未重复的
    for (const line of [...newLines, ...oldLines]) {
        const trimmed = line.trim();
        if (trimmed && !seen.has(trimmed)) {
            seen.add(trimmed);
            merged.push(trimmed);
        }
    }

    const mergedText = merged.join('\n');
    await fsPromises.writeFile(LINKS_FILE, mergedText, 'utf-8');

    // 重新统计合并后的节点数
    const mergedResult = convertLinks(mergedText, 'raw');
    const totalCount = mergedResult.count;

    const meta = {
        updatedAt: new Date().toISOString(),
        lineCount: merged.length,
        nodeCount: totalCount
    };
    await fsPromises.writeFile(META_FILE, JSON.stringify(meta, null, 2), 'utf-8');

    // 追加历史记录（记录本次新上传的节点数）
    await appendHistory(nodeCount, nodeNames);

    return { ...meta, newCount: nodeCount, totalCount };
}

async function loadHistory() {
    try {
        const content = await fsPromises.readFile(HISTORY_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        if (e.code === 'ENOENT') return [];
        return [];
    }
}

async function appendHistory(nodeCount, nodeNames) {
    const history = await loadHistory();
    history.unshift({
        timestamp: new Date().toISOString(),
        nodeCount: nodeCount || 0,
        nodes: nodeNames || []
    });
    // 最多保留 100 条历史记录
    if (history.length > 100) history.length = 100;
    await fsPromises.writeFile(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

async function loadLinks() {
    try {
        return await fsPromises.readFile(LINKS_FILE, 'utf-8');
    } catch (e) {
        if (e.code === 'ENOENT') return '';
        throw e;
    }
}

async function loadMeta() {
    try {
        const content = await fsPromises.readFile(META_FILE, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
    }
}

// ==================== 转换（优化：预编译脚本） ====================

// 预编译转换脚本模板
const conversionScriptTemplate = `
(function() {
  const links = extractLinks(RAW_CONTENT_PLACEHOLDER);
  const proxies = [];
  for (const link of links) {
    const node = parseLink(link);
    if (node) proxies.push(node);
  }
  const seen = new Set();
  const unique = proxies.filter(p => {
    const key = p.type + '|' + p.server + '|' + p.port + '|' + (p.uuid || p.password || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const opts = OPTIONS_PLACEHOLDER;
  const fmt = FORMAT_PLACEHOLDER;
  let output;
  switch (fmt) {
    case 'clash-yaml': output = generateClashConfig(unique, opts); break;
    case 'clash-meta': output = generateClashMetaConfig(unique, opts); break;
    case 'surge': output = generateSurgeConfig(unique, opts); break;
    case 'sing-box': output = generateSingBoxConfig(unique, opts); break;
    case 'base64': output = generateBase64Sub(unique); break;
    case 'raw': output = generateRawLinks(unique); break;
    default: output = generateBase64Sub(unique);
  }
  return { count: unique.length, output, nodeNames: unique.map(p => p.name || (p.server + ':' + p.port)) };
})()
`;

function convertLinks(rawContent, format, options = {}) {
    // 替换占位符生成实际代码
    const code = conversionScriptTemplate
        .replace('RAW_CONTENT_PLACEHOLDER', JSON.stringify(rawContent))
        .replace('OPTIONS_PLACEHOLDER', JSON.stringify(options))
        .replace('FORMAT_PLACEHOLDER', JSON.stringify(format));

    const script = new vm.Script(code);
    return script.runInContext(engine);
}

// ==================== MIME & 文件名 ====================

const FORMAT_MIME = {
    'base64': 'text/plain; charset=utf-8',        // Clash 订阅（Base64 编码）
    'clash-yaml': 'text/yaml; charset=utf-8',     // Clash 完整配置文件
    'clash-meta': 'text/yaml; charset=utf-8',     // Clash Meta 配置
    'surge': 'text/plain; charset=utf-8',
    'sing-box': 'application/json; charset=utf-8',
    'raw': 'text/plain; charset=utf-8'
};

const FORMAT_FILENAME = {
    'base64': 'subscription.txt',
    'clash-yaml': 'clash_config.yaml',
    'clash-meta': 'mihomo_config.yaml',
    'surge': 'surge_config.conf',
    'sing-box': 'singbox_config.json',
    'raw': 'links.txt'
};

const STATIC_MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

// ==================== HTTP 服务 ====================

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // ===== GET /sub - 订阅输出（客户端请求此 URL） =====
    if (pathname === '/sub' && req.method === 'GET') {
        try {
            const rawContent = await loadLinks();
            if (!rawContent.trim()) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('暂无保存的节点，请先在网页面板中粘贴代理链接并保存');
                return;
            }

            // 智能识别客户端类型
            let format = parsedUrl.query.format;
            if (!format) {
                // 未指定格式，根据 User-Agent 自动识别
                format = detectClientFromUserAgent(req.headers['user-agent']);
                console.log(`[${time()}] 自动识别客户端: ${req.headers['user-agent']} → ${format}`);
            }

            if (!FORMAT_MIME[format]) {
                res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('不支持的格式: ' + format + '\n支持: clash-yaml, clash-meta, surge, sing-box, base64, raw');
                return;
            }

            const options = {
                httpPort: parseInt(parsedUrl.query.port) || 7890,
                socksPort: parseInt(parsedUrl.query.socks) || 7891,
                allowLan: parsedUrl.query.lan !== 'false',
                mode: parsedUrl.query.mode || 'rule',
                logLevel: parsedUrl.query.log || 'info',
                enableDns: parsedUrl.query.dns !== 'false',
                testUrl: 'http://www.gstatic.com/generate_204',
                testInterval: parseInt(parsedUrl.query.interval) || 300
            };

            const result = convertLinks(rawContent, format, options);

            // 生成订阅信息响应头
            const subHeaders = generateSubscriptionHeaders();

            res.writeHead(200, {
                'Content-Type': FORMAT_MIME[format],
                'Content-Disposition': `inline; filename="${FORMAT_FILENAME[format]}"`,
                'Subscription-Userinfo': subHeaders['Subscription-Userinfo'],
                'Profile-Update-Interval': subHeaders['Profile-Update-Interval'],
                'Profile-Title': subHeaders['Profile-Title'] || '',
                'X-Proxy-Count': String(result.count)
            });
            res.end(result.output);
            console.log(`[${time()}] GET /sub → ${format} | ${result.count} 个节点`);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('转换失败: ' + e.message);
        }
        return;
    }

    // ===== POST /api/save - 保存代理链接 =====
    if (pathname === '/api/save' && req.method === 'POST') {
        // API 认证检查
        if (!requireAuth(req, res)) return;

        let body = '';
        let size = 0;

        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_REQUEST_SIZE) {
                req.destroy();
                res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: '请求体过大，最大支持 10MB' }));
                return;
            }
            body += chunk;
        });

        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const rawLinks = data.links || '';

                // 输入验证
                if (!rawLinks.trim()) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: '链接内容为空' }));
                    return;
                }

                if (rawLinks.length > MAX_REQUEST_SIZE) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: '内容过长' }));
                    return;
                }

                const lines = rawLinks.split('\n').filter(l => l.trim());
                if (lines.length > MAX_LINKS_COUNT) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: `节点数量过多，最多支持 ${MAX_LINKS_COUNT} 个` }));
                    return;
                }

                // 检查是否包含可疑内容
                if (rawLinks.includes('<script') || rawLinks.includes('javascript:')) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: '检测到可疑内容' }));
                    return;
                }

                // 先解析统计节点数
                const result = convertLinks(rawLinks, 'raw');
                const meta = await saveLinks(rawLinks, result.count, result.nodeNames || []);

                // 动态拼接订阅 URL（支持局域网/远程访问）
                const host = req.headers.host || `localhost:${PORT}`;
                const baseUrl = `http://${host}/sub`;

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    count: meta.totalCount,
                    newCount: result.count,
                    updatedAt: meta.updatedAt,
                    subUrls: {
                        universal: `${baseUrl}`,  // 通用订阅（自动识别客户端）
                        base64: `${baseUrl}?format=base64`,  // Base64（标准订阅）
                        'clash-yaml': `${baseUrl}?format=clash-yaml`,
                        'clash-meta': `${baseUrl}?format=clash-meta`,
                        surge: `${baseUrl}?format=surge`,
                        'sing-box': `${baseUrl}?format=sing-box`,
                        raw: `${baseUrl}?format=raw`
                    }
                }));
                console.log(`[${time()}] 保存成功 | ${result.count} 个节点`);
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // ===== GET /api/info - 服务状态（使用缓存的 nodeCount） =====
    if (pathname === '/api/info') {
        try {
            const meta = await loadMeta();
            const subConfig = config.subscription;

            // 计算流量使用
            let trafficUsed = 0;
            let trafficTotal = 0;
            let trafficPercent = 0;

            if (subConfig.traffic && subConfig.traffic.enabled) {
                trafficUsed = (subConfig.traffic.upload || 0) + (subConfig.traffic.download || 0);
                trafficTotal = subConfig.traffic.total || 0;
                // total=0 表示无穷，不计算百分比
                trafficPercent = trafficTotal > 0 ? Math.round((trafficUsed / trafficTotal) * 100) : 0;
            }

            // 到期时间
            let expireInfo = '长期有效';
            if (subConfig.expire && subConfig.expire.enabled && subConfig.expire.timestamp > 0) {
                expireInfo = formatExpireTime(subConfig.expire.timestamp);
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                status: 'running',
                port: PORT,
                formats: ['base64', 'clash-yaml', 'clash-meta', 'surge', 'sing-box', 'raw'],
                nodeCount: meta ? (meta.nodeCount || 0) : 0,
                updatedAt: meta ? meta.updatedAt : null,
                subscription: {
                    title: subConfig.title,
                    expire: expireInfo,
                    traffic: subConfig.traffic && subConfig.traffic.enabled ? {
                        upload: subConfig.traffic.upload || 0,
                        download: subConfig.traffic.download || 0,
                        total: subConfig.traffic.total || 0,
                        used: trafficUsed,
                        percent: trafficPercent,
                        uploadFormatted: formatTraffic(subConfig.traffic.upload || 0),
                        downloadFormatted: formatTraffic(subConfig.traffic.download || 0),
                        totalFormatted: trafficTotal > 0 ? formatTraffic(trafficTotal) : '∞',
                        usedFormatted: formatTraffic(trafficUsed)
                    } : null
                }
            }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ===== GET /api/links - 获取已保存的链接 =====
    if (pathname === '/api/links') {
        try {
            const rawContent = await loadLinks();
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(rawContent);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('读取失败: ' + e.message);
        }
        return;
    }

    // ===== GET /api/history - 获取上传历史 =====
    if (pathname === '/api/history' && req.method === 'GET') {
        try {
            const history = await loadHistory();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, history }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ===== DELETE /api/history - 清空上传历史 =====
    if (pathname === '/api/history' && req.method === 'DELETE') {
        if (!requireAuth(req, res)) return;
        try {
            await fsPromises.writeFile(HISTORY_FILE, '[]', 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: '历史记录已清空' }));
            console.log(`[${time()}] 上传历史已清空`);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ===== POST /api/update - 手动触发更新 =====
    if (pathname === '/api/update' && req.method === 'POST') {
        if (!config.autoUpdate.enabled || !config.autoUpdate.sources.length) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: '自动更新未启用或未配置订阅源' }));
            return;
        }

        try {
            await updateFromSources();
            const meta = await loadMeta();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                success: true,
                message: '更新完成',
                nodeCount: meta ? meta.nodeCount : 0,
                updatedAt: meta ? meta.updatedAt : null
            }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: '更新失败: ' + e.message }));
        }
        return;
    }

    // ===== GET /api/subscription - 获取订阅配置 =====
    if (pathname === '/api/subscription' && req.method === 'GET') {
        try {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                success: true,
                subscription: config.subscription
            }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ===== POST /api/subscription - 更新订阅配置 =====
    if (pathname === '/api/subscription' && req.method === 'POST') {
        // API 认证检查
        if (!requireAuth(req, res)) return;

        let body = '';
        let size = 0;

        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_REQUEST_SIZE) {
                req.destroy();
                return;
            }
            body += chunk;
        });

        req.on('end', async () => {
            try {
                const data = JSON.parse(body);

                // 更新内存中的配置
                if (data.title !== undefined) config.subscription.title = data.title;
                if (data.updateInterval !== undefined) config.subscription.updateInterval = data.updateInterval;

                if (data.traffic) {
                    config.subscription.traffic = {
                        ...config.subscription.traffic,
                        ...data.traffic
                    };
                }

                if (data.expire) {
                    config.subscription.expire = {
                        ...config.subscription.expire,
                        ...data.expire
                    };
                }

                // 保存到配置文件
                const configPath = path.join(__dirname, 'config.json');
                const fullConfig = {
                    port: config.port,
                    dataDir: config.dataDir,
                    security: config.security,
                    server: config.server,
                    defaults: config.defaults,
                    subscription: config.subscription,
                    autoUpdate: config.autoUpdate
                };

                await fsPromises.writeFile(configPath, JSON.stringify(fullConfig, null, 2), 'utf-8');

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    message: '配置已保存',
                    subscription: config.subscription
                }));
                console.log(`[${time()}] 订阅配置已更新`);
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    // ===== POST /api/subscription/reset-traffic - 重置流量 =====
    if (pathname === '/api/subscription/reset-traffic' && req.method === 'POST') {
        // API 认证检查
        if (!requireAuth(req, res)) return;

        try {
            config.subscription.traffic.upload = 0;
            config.subscription.traffic.download = 0;

            // 保存到配置文件
            const configPath = path.join(__dirname, 'config.json');
            const fullConfig = {
                port: config.port,
                dataDir: config.dataDir,
                security: config.security,
                server: config.server,
                defaults: config.defaults,
                subscription: config.subscription,
                autoUpdate: config.autoUpdate
            };

            await fsPromises.writeFile(configPath, JSON.stringify(fullConfig, null, 2), 'utf-8');

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                success: true,
                message: '流量已重置',
                subscription: config.subscription
            }));
            console.log(`[${time()}] 流量已重置`);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // ===== 静态文件服务 =====
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(__dirname, filePath);
    if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end('Forbidden'); return; }

    try {
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
        const ext = path.extname(filePath);
        const contentType = STATIC_MIME[ext] || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600'
        });
        res.end(fs.readFileSync(filePath));
    } catch (e) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
    }
});

function time() { return new Date().toLocaleTimeString(); }

server.listen(PORT, '0.0.0.0', async () => {
    console.log('');
    console.log('  ⚡ 代理订阅转换服务已启动');
    console.log('');
    console.log(`  📺 网页面板:  http://localhost:${PORT}`);
    console.log(`  🔗 订阅链接:  http://localhost:${PORT}/sub?format=<格式>`);
    console.log('');
    console.log('  使用流程:');
    console.log('    1. 打开网页面板，粘贴代理链接');
    console.log('    2. 点击「转换」→ 点击「保存到订阅服务」');
    console.log('    3. 复制生成的订阅 URL，添加到客户端');
    console.log('    4. 更新节点时重复步骤 1-2，客户端刷新即可');
    console.log('');
    console.log('  支持格式: base64 (默认) | clash-yaml | clash-meta | surge | sing-box | raw');
    console.log('');
    console.log('  💡 说明:');
    console.log('    - base64: 标准 Clash 订阅（Base64 编码，客户端通用）');
    console.log('    - clash-yaml: Clash 完整配置文件（YAML 格式）');
    console.log('    - clash-meta: Clash Meta/Mihomo 配置（支持 GEOSITE）');
    console.log('');

    try {
        const meta = await loadMeta();
        if (meta) {
            console.log(`  📦 已有保存的节点 (更新于 ${meta.updatedAt})`);
            console.log('');
        }
    } catch (e) {
        // 忽略启动时的读取错误
    }

    // 启动自动更新
    if (config.autoUpdate.enabled) {
        console.log(`  🔄 自动更新: 已启用 (间隔 ${config.autoUpdate.interval} 秒)`);
        console.log(`  📡 订阅源: ${config.autoUpdate.sources.length} 个`);
        console.log('');
        startAutoUpdate();
    }

    console.log('  按 Ctrl+C 停止服务');
    console.log('');
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务...');
    stopAutoUpdate();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n正在关闭服务...');
    stopAutoUpdate();
    process.exit(0);
});
