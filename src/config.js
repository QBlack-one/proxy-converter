'use strict';

const fs = require('fs');
const path = require('path');

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

function loadConfig() {
    const defaultConfig = {
        port: 3456,
        dataDir: './data',
        security: {
            maxRequestSize: 10 * 1024 * 1024,
            maxLinksCount: 10000,
            maxLinkLength: 8192,
            apiKey: '',
            enableAuth: false
        },
        server: { allowLan: true, cors: true },
        defaults: {
            httpPort: 7890, socksPort: 7891,
            mode: 'rule', logLevel: 'info',
            enableDns: true, testInterval: 300
        },
        subscription: {
            title: '代理订阅',
            updateInterval: 24,
            traffic: { enabled: false, upload: 0, download: 0, total: 107374182400, resetDay: 1 },
            expire: { enabled: false, timestamp: 0 }
        },
        autoUpdate: { enabled: false, interval: 3600, sources: [] }
    };

    try {
        const configPath = path.join(__dirname, '..', 'config.json');
        if (fs.existsSync(configPath)) {
            const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            return deepMerge(defaultConfig, userConfig);
        }
    } catch (e) {
        console.warn('配置文件加载失败，使用默认配置:', e.message);
    }

    if (process.env.PORT) defaultConfig.port = parseInt(process.env.PORT);
    if (process.env.DATA_DIR) defaultConfig.dataDir = process.env.DATA_DIR;

    return defaultConfig;
}

const config = loadConfig();

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, config.dataDir);
const LINKS_FILE = path.join(DATA_DIR, 'links.txt');
const META_FILE = path.join(DATA_DIR, 'meta.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

// 确保数据目录
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

module.exports = {
    config, deepMerge, loadConfig,
    ROOT_DIR, DATA_DIR, LINKS_FILE, META_FILE, HISTORY_FILE, PUBLIC_DIR,
    PORT: config.port,
    MAX_REQUEST_SIZE: config.security.maxRequestSize,
    MAX_LINKS_COUNT: config.security.maxLinksCount,
    MAX_LINK_LENGTH: config.security.maxLinkLength
};
