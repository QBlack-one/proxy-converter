/**
 * 代理订阅转换器 - 入口文件
 *
 * 启动: node server.js
 */

'use strict';

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const { config, PORT, ROOT_DIR } = require('./src/config');
const { setupMiddleware, time } = require('./src/middleware');
const { handleSub } = require('./src/routes/sub');
const { handleApi } = require('./src/routes/api');
const { handleStatic } = require('./src/routes/static');
const { loadMeta } = require('./src/data');
const { startAutoUpdate, stopAutoUpdate } = require('./src/auto-update');

// ==================== HTTP 服务 ====================

const server = http.createServer(async (req, res) => {
    const startTime = Date.now();
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // 请求日志（仅 API 和订阅）
    res.on('finish', () => {
        if (!pathname.startsWith('/api') && pathname !== '/sub') return;
        const ms = Date.now() - startTime;
        console.log(`[${time()}] ${req.method} ${pathname} → ${res.statusCode} (${ms}ms)`);
    });

    // CORS
    setupMiddleware(req, res, pathname);

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // 路由分发
    if (pathname === '/sub' && req.method === 'GET') {
        return handleSub(req, res, parsedUrl);
    }

    if (pathname.startsWith('/api')) {
        const handled = await handleApi(req, res, pathname, parsedUrl);
        if (handled) return;
    }

    // 静态文件
    return handleStatic(req, res, pathname);
});

// ==================== 配置热重载 ====================

let configWatchDebounce = null;
const configFilePath = path.join(ROOT_DIR, 'config.json');
try {
    fs.watch(configFilePath, () => {
        if (configWatchDebounce) clearTimeout(configWatchDebounce);
        configWatchDebounce = setTimeout(() => {
            try {
                const newConfig = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
                if (newConfig.subscription) config.subscription = newConfig.subscription;
                if (newConfig.security) config.security = newConfig.security;
                if (newConfig.defaults) config.defaults = newConfig.defaults;
                if (newConfig.autoUpdate) {
                    const wasEnabled = config.autoUpdate.enabled;
                    config.autoUpdate = newConfig.autoUpdate;
                    if (!wasEnabled && config.autoUpdate.enabled) startAutoUpdate();
                    if (wasEnabled && !config.autoUpdate.enabled) stopAutoUpdate();
                }
                console.log(`[${time()}] ♻️ 配置已热重载`);
            } catch (e) {
                console.error(`[${time()}] 配置重载失败: ${e.message}`);
            }
        }, 500);
    });
} catch (e) { /* watch 不可用时忽略 */ }

// ==================== 启动 ====================

server.listen(PORT, '0.0.0.0', async () => {
    console.log('');
    console.log('  ⚡ 代理订阅转换服务已启动');
    console.log('');
    console.log(`  📺 网页面板:  http://localhost:${PORT}`);
    console.log(`  🔗 订阅链接:  http://localhost:${PORT}/sub?format=<格式>`);
    console.log('');
    console.log('  支持格式: base64 (默认) | clash-yaml | clash-meta | surge | sing-box | raw');
    console.log('');

    try {
        const meta = await loadMeta();
        if (meta) {
            console.log(`  📦 已有保存的节点 (更新于 ${meta.updatedAt})`);
            console.log('');
        }
    } catch (e) { /* ignore */ }

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
process.on('SIGINT', () => { console.log('\n正在关闭服务...'); stopAutoUpdate(); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n正在关闭服务...'); stopAutoUpdate(); process.exit(0); });
