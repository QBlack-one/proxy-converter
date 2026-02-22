'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const pinoHttp = require('pino-http');

const { config, PORT, ROOT_DIR } = require('./src/config');
const apiRouter = require('./src/routes/api');
const subRouter = require('./src/routes/sub');
const { startAutoUpdate, stopAutoUpdate } = require('./src/auto-update');

// Initialize Pino Logger
const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:yyyy-mm-dd HH:MM:ss' }
    }
});

const app = express();

// ==================== Middleware ====================

app.use(pinoHttp({ logger }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== Routes ====================

// API routes
app.use('/api', apiRouter);

// Sub route
app.use('/sub', subRouter);

// Serve static frontend files (now serving Vue 3 dist)
app.use(express.static(path.join(ROOT_DIR, 'frontend', 'dist')));

// SPA fallback for frontend caching/routing if needed
app.use((req, res, next) => {
    if (req.method === 'GET') {
        res.sendFile(path.join(ROOT_DIR, 'frontend', 'dist', 'index.html'), err => {
            if (err) next();
        });
    } else {
        next();
    }
});

// ==================== Config Watch ====================

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
                logger.info('♻️ 配置已热重载');
            } catch (e) {
                logger.error(`配置重载失败: ${e.message}`);
            }
        }, 500);
    });
} catch (e) { /* watch 不可用时忽略 */ }

// ==================== Start Server ====================

const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info('');
    logger.info('⚡ 代理订阅转换服务已启动 (Express Edition)');
    logger.info('');
    logger.info(`📺 网页面板:  http://localhost:${PORT}`);
    logger.info(`🔗 订阅链接:  http://localhost:${PORT}/sub?format=<格式>`);
    logger.info('');
    logger.info('支持格式: base64 (默认) | clash-yaml | clash-meta | surge | sing-box | raw');
    logger.info('');

    if (config.autoUpdate && config.autoUpdate.enabled) {
        logger.info(`🔄 自动更新: 已启用 (间隔 ${config.autoUpdate.interval} 秒)`);
        logger.info(`📡 订阅源: ${config.autoUpdate.sources.length} 个`);
        logger.info('');
        startAutoUpdate();
    }

    logger.info('按 Ctrl+C 停止服务');
    logger.info('');
});

// Graceful shutdown
process.on('SIGINT', () => { logger.info('正在关闭服务...'); stopAutoUpdate(); process.exit(0); });
process.on('SIGTERM', () => { logger.info('正在关闭服务...'); stopAutoUpdate(); process.exit(0); });
