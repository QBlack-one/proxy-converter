'use strict';

const http = require('http');
const https = require('https');
const { config } = require('./config');
const { convertLinks } = require('./engine');
const { saveLinks } = require('./data');
const { time } = require('./middleware');

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
    if (!config.autoUpdate.enabled || !config.autoUpdate.sources.length) return;

    console.log(`[${time()}] 开始自动更新订阅...`);
    let allLinks = [];
    let successCount = 0;

    for (const source of config.autoUpdate.sources) {
        try {
            console.log(`[${time()}] 正在获取: ${source}`);
            const content = await fetchSubscription(source);
            let decoded = content;
            try { decoded = Buffer.from(content.trim(), 'base64').toString('utf-8'); } catch (e) { }
            allLinks.push(decoded);
            successCount++;
            console.log(`[${time()}] ✓ 获取成功: ${source}`);
        } catch (e) {
            console.error(`[${time()}] ✗ 获取失败: ${source} - ${e.message}`);
        }
    }

    if (allLinks.length > 0) {
        const combined = allLinks.join('\n');
        try {
            const replaceMode = config.autoUpdate.replaceMode || false;
            const result = convertLinks(combined, 'raw');
            await saveLinks(combined, result.count, null, replaceMode);
            console.log(`[${time()}] 自动更新完成: ${result.count} 个节点 (成功 ${successCount}/${config.autoUpdate.sources.length})`);
        } catch (e) {
            console.error(`[${time()}] 保存失败: ${e.message}`);
        }
    } else {
        console.log(`[${time()}] 自动更新失败: 所有源都无法访问`);
    }
}

let updateTimer = null;

function startAutoUpdate() {
    if (!config.autoUpdate.enabled) return;
    console.log(`[${time()}] 自动更新已启用，间隔: ${config.autoUpdate.interval} 秒`);
    updateFromSources().catch(e => console.error('自动更新错误:', e));
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

module.exports = { fetchSubscription, updateFromSources, startAutoUpdate, stopAutoUpdate };
