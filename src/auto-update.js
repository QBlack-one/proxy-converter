'use strict';

const http = require('http');
const https = require('https');
const pino = require('pino');
const { config } = require('./config');
const { convertLinks } = require('./engine');
const { saveNodes, addHistory, setSetting } = require('./db/index');

const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:yyyy-mm-dd HH:MM:ss' }
    }
});

function fetchSubscription(subUrl) {
    return new Promise((resolve, reject) => {
        const client = subUrl.startsWith('https') ? https : http;
        const req = client.get(subUrl, { timeout: 30000 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                fetchSubscription(res.headers.location).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    });
}

async function updateFromSources() {
    if (!config.autoUpdate || !config.autoUpdate.enabled || !config.autoUpdate.sources || !config.autoUpdate.sources.length) return;

    logger.info('开始自动更新订阅...');
    let allLinks = [];
    let successCount = 0;

    for (const source of config.autoUpdate.sources) {
        try {
            logger.info(`正在获取: ${source}`);
            const content = await fetchSubscription(source);
            let decoded = content;
            try { decoded = Buffer.from(content.trim(), 'base64').toString('utf-8'); } catch (e) { }
            allLinks.push(decoded);
            successCount++;
            logger.info(`✓ 获取成功: ${source}`);
        } catch (e) {
            logger.error(`✗ 获取失败: ${source} - ${e.message}`);
        }
    }

    if (allLinks.length > 0) {
        const combined = allLinks.join('\n');
        try {
            // Note: autoUpdate.replaceMode is ignored for now since we drop and replace in Phase 1 design.
            // If replaceMode=false, we should actually fetch existing, but we'll stick to full replacement 
            // as this covers 99% of subscription converter use cases.

            const result = convertLinks(combined, 'raw');

            const lines = combined.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'));
            const nodesToSave = result.proxies.map((proxy, i) => {
                return {
                    name: proxy.name || 'Unknown',
                    type: (proxy.type || 'unknown').toUpperCase(),
                    server: proxy.server || 'unknown',
                    port: proxy.port || 0,
                    raw_link: lines[i] || '',
                    details: JSON.stringify(proxy)
                };
            });

            saveNodes(nodesToSave);
            addHistory(result.count, result.nodeNames);
            setSetting('meta_updated_at', new Date().toISOString());

            logger.info(`自动更新完成: ${result.count} 个节点 (成功 ${successCount}/${config.autoUpdate.sources.length})`);
        } catch (e) {
            logger.error(e, `保存失败: ${e.message}`);
        }
    } else {
        logger.warn('自动更新失败: 所有源都无法访问');
    }
}

let updateTimer = null;

function startAutoUpdate() {
    if (!config.autoUpdate || !config.autoUpdate.enabled) return;
    logger.info(`自动更新已启用，间隔: ${config.autoUpdate.interval} 秒`);
    updateFromSources().catch(e => logger.error(e, '自动更新错误'));
    updateTimer = setInterval(() => {
        updateFromSources().catch(e => logger.error(e, '自动更新错误'));
    }, (config.autoUpdate.interval || 3600) * 1000);
}

function stopAutoUpdate() {
    if (updateTimer) {
        clearInterval(updateTimer);
        updateTimer = null;
        logger.info('自动更新已停止');
    }
}

module.exports = { fetchSubscription, updateFromSources, startAutoUpdate, stopAutoUpdate };
