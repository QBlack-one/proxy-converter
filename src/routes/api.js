'use strict';

const path = require('path');
const fsPromises = require('fs').promises;
const { config, LINKS_FILE, META_FILE, HISTORY_FILE, ROOT_DIR, MAX_REQUEST_SIZE } = require('../config');
const { convertLinks } = require('../engine');
const { saveLinks, loadLinks, loadMeta, loadHistory } = require('../data');
const { formatTraffic, formatExpireTime } = require('../subscription');
const { requireAuth, time } = require('../middleware');
const { updateFromSources } = require('../auto-update');

async function handleApi(req, res, pathname, parsedUrl) {
    // ===== POST /api/save =====
    if (pathname === '/api/save' && req.method === 'POST') {
        if (!requireAuth(req, res)) return;

        let body = '';
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_REQUEST_SIZE) {
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

                if (!rawLinks.trim()) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: '未提供有效的代理链接' }));
                    return;
                }

                const lines = rawLinks.split('\n').filter(l => l.trim());
                if (lines.length > config.security.maxLinksCount) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: `链接数量超限 (最多 ${config.security.maxLinksCount} 条)` }));
                    return;
                }

                const tooLong = lines.find(l => l.length > config.security.maxLinkLength);
                if (tooLong) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: '检测到可疑内容' }));
                    return;
                }

                const result = convertLinks(rawLinks, 'raw');
                const meta = await saveLinks(rawLinks, result.count, result.nodeNames || []);

                const host = req.headers['host'] || `localhost:${config.port}`;
                const proto = req.headers['x-forwarded-proto'] || 'http';
                const baseUrl = `${proto}://${host}/sub`;

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    count: meta.totalCount,
                    newCount: result.count,
                    updatedAt: meta.updatedAt,
                    subUrls: {
                        universal: baseUrl,
                        base64: `${baseUrl}?format=base64`,
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
        return true;
    }

    // ===== GET /api/info =====
    if (pathname === '/api/info') {
        try {
            const meta = await loadMeta();
            const subConfig = config.subscription;

            let trafficUsed = 0, trafficTotal = 0, trafficPercent = 0;
            if (subConfig.traffic && subConfig.traffic.enabled) {
                trafficUsed = (subConfig.traffic.upload || 0) + (subConfig.traffic.download || 0);
                trafficTotal = subConfig.traffic.total || 0;
                trafficPercent = trafficTotal > 0 ? Math.round((trafficUsed / trafficTotal) * 100) : 0;
            }

            let expireInfo = null;
            if (subConfig.expire && subConfig.expire.enabled && subConfig.expire.timestamp > 0) {
                expireInfo = formatExpireTime(subConfig.expire.timestamp);
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                status: 'running',
                port: config.port,
                formats: ['base64', 'clash-yaml', 'clash-meta', 'surge', 'sing-box', 'raw'],
                nodeCount: meta ? (meta.nodeCount || 0) : 0,
                updatedAt: meta ? meta.updatedAt : null,
                subscription: {
                    title: subConfig.title || '代理订阅',
                    expire: (!subConfig.expire || !subConfig.expire.enabled || subConfig.expire.timestamp === 0)
                        ? '长期有效' : expireInfo,
                    traffic: subConfig.traffic && subConfig.traffic.enabled ? {
                        upload: subConfig.traffic.upload || 0,
                        download: subConfig.traffic.download || 0,
                        total: subConfig.traffic.total || 0,
                        percent: trafficPercent,
                        totalFormatted: trafficTotal > 0 ? formatTraffic(trafficTotal) : '∞',
                        usedFormatted: formatTraffic(trafficUsed),
                        uploadFormatted: formatTraffic(subConfig.traffic.upload || 0),
                        downloadFormatted: formatTraffic(subConfig.traffic.download || 0)
                    } : null
                }
            }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return true;
    }

    // ===== GET /api/links =====
    if (pathname === '/api/links' && req.method === 'GET') {
        try {
            const rawContent = await loadLinks();
            res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(rawContent);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('读取失败: ' + e.message);
        }
        return true;
    }

    // ===== GET /api/history =====
    if (pathname === '/api/history' && req.method === 'GET') {
        try {
            const history = await loadHistory();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, history }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return true;
    }

    // ===== DELETE /api/history =====
    if (pathname === '/api/history' && req.method === 'DELETE') {
        if (!requireAuth(req, res)) return true;
        try {
            await fsPromises.writeFile(HISTORY_FILE, '[]', 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: '历史记录已清空' }));
            console.log(`[${time()}] 上传历史已清空`);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return true;
    }

    // ===== POST /api/update =====
    if (pathname === '/api/update' && req.method === 'POST') {
        if (!config.autoUpdate.enabled || !config.autoUpdate.sources.length) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: '自动更新未启用或未配置订阅源' }));
            return true;
        }
        try {
            await updateFromSources();
            const meta = await loadMeta();
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                success: true, message: '更新完成',
                nodeCount: meta ? meta.nodeCount : 0,
                updatedAt: meta ? meta.updatedAt : null
            }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: '更新失败: ' + e.message }));
        }
        return true;
    }

    // ===== GET /api/subscription =====
    if (pathname === '/api/subscription' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, subscription: config.subscription }));
        return true;
    }

    // ===== POST /api/subscription =====
    if (pathname === '/api/subscription' && req.method === 'POST') {
        if (!requireAuth(req, res)) return true;
        let body = '';
        req.on('data', chunk => { body += chunk; if (body.length > MAX_REQUEST_SIZE) req.destroy(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                if (data.title !== undefined) config.subscription.title = data.title;
                if (data.updateInterval !== undefined) config.subscription.updateInterval = data.updateInterval;
                if (data.traffic) config.subscription.traffic = { ...config.subscription.traffic, ...data.traffic };
                if (data.expire) config.subscription.expire = { ...config.subscription.expire, ...data.expire };

                const configPath = path.join(ROOT_DIR, 'config.json');
                await fsPromises.writeFile(configPath, JSON.stringify({
                    port: config.port, dataDir: config.dataDir, security: config.security,
                    server: config.server, defaults: config.defaults,
                    subscription: config.subscription, autoUpdate: config.autoUpdate
                }, null, 2), 'utf-8');

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true, message: '配置已保存', subscription: config.subscription }));
                console.log(`[${time()}] 订阅配置已更新`);
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return true;
    }

    // ===== POST /api/subscription/reset-traffic =====
    if (pathname === '/api/subscription/reset-traffic' && req.method === 'POST') {
        if (!requireAuth(req, res)) return true;
        try {
            config.subscription.traffic.upload = 0;
            config.subscription.traffic.download = 0;

            const configPath = path.join(ROOT_DIR, 'config.json');
            await fsPromises.writeFile(configPath, JSON.stringify({
                port: config.port, dataDir: config.dataDir, security: config.security,
                server: config.server, defaults: config.defaults,
                subscription: config.subscription, autoUpdate: config.autoUpdate
            }, null, 2), 'utf-8');

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: '流量已重置', subscription: config.subscription }));
            console.log(`[${time()}] 流量已重置`);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return true;
    }

    // ===== DELETE /api/links =====
    if (pathname === '/api/links' && req.method === 'DELETE') {
        if (!requireAuth(req, res)) return true;
        try {
            await fsPromises.writeFile(LINKS_FILE, '', 'utf-8');
            await fsPromises.writeFile(META_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), lineCount: 0, nodeCount: 0 }, null, 2), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: '所有节点已清空' }));
            console.log(`[${time()}] 所有节点已清空`);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return true;
    }

    // ===== GET /api/nodes =====
    if (pathname === '/api/nodes' && req.method === 'GET') {
        try {
            let raw = '';
            try { raw = await fsPromises.readFile(LINKS_FILE, 'utf-8'); } catch (e) { }
            const lines = raw.split('\n').filter(l => l.trim());
            const nodes = lines.map((line, index) => {
                try {
                    const result = convertLinks(line, 'raw');
                    const node = result.nodeNames[0] || line.substring(0, 50);
                    const proto = line.match(/^(\w+):\/\//);
                    return { index, name: node, type: proto ? proto[1].toUpperCase() : 'UNKNOWN', link: line };
                } catch (e) {
                    return { index, name: line.substring(0, 50), type: 'UNKNOWN', link: line };
                }
            });
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, count: nodes.length, nodes }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return true;
    }

    // ===== DELETE /api/nodes?index=N =====
    if (pathname === '/api/nodes' && req.method === 'DELETE') {
        if (!requireAuth(req, res)) return true;
        const idx = parseInt(parsedUrl.query.index);
        if (isNaN(idx) || idx < 0) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: '请提供有效的 index 参数' }));
            return true;
        }
        try {
            let raw = '';
            try { raw = await fsPromises.readFile(LINKS_FILE, 'utf-8'); } catch (e) { }
            const lines = raw.split('\n').filter(l => l.trim());
            if (idx >= lines.length) {
                res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: '节点不存在' }));
                return true;
            }
            const removed = lines.splice(idx, 1)[0];
            await fsPromises.writeFile(LINKS_FILE, lines.join('\n'), 'utf-8');
            await fsPromises.writeFile(META_FILE, JSON.stringify({
                updatedAt: new Date().toISOString(), lineCount: lines.length, nodeCount: lines.length
            }, null, 2), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, removed: removed.substring(0, 80), remaining: lines.length }));
            console.log(`[${time()}] 删除节点 #${idx}`);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return true;
    }

    // ===== POST /api/nodes =====
    if (pathname === '/api/nodes' && req.method === 'POST') {
        if (!requireAuth(req, res)) return true;
        let body = '';
        req.on('data', chunk => { body += chunk; if (body.length > MAX_REQUEST_SIZE) req.destroy(); });
        await new Promise(resolve => req.on('end', resolve));
        try {
            const { link } = JSON.parse(body);
            if (!link || !link.trim()) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: '请提供 link 参数' }));
                return true;
            }
            const trimmed = link.trim();
            let raw = '';
            try { raw = await fsPromises.readFile(LINKS_FILE, 'utf-8'); } catch (e) { }
            const lines = raw.split('\n').filter(l => l.trim());
            if (lines.includes(trimmed)) {
                res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: '该节点已存在' }));
                return true;
            }
            lines.push(trimmed);
            await fsPromises.writeFile(LINKS_FILE, lines.join('\n'), 'utf-8');
            await fsPromises.writeFile(META_FILE, JSON.stringify({
                updatedAt: new Date().toISOString(), lineCount: lines.length, nodeCount: lines.length
            }, null, 2), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, count: lines.length }));
            console.log(`[${time()}] 添加节点，共 ${lines.length} 个`);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return true;
    }

    return false; // 未匹配任何 API 路由
}

module.exports = { handleApi };
