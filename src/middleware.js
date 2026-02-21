'use strict';

const { config } = require('./config');

function requireAuth(req, res) {
    if (!config.security.enableAuth || !config.security.apiKey) return true;

    const authHeader = req.headers['authorization'];
    const apiKeyHeader = req.headers['x-api-key'];
    let providedKey = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        providedKey = authHeader.substring(7);
    } else if (apiKeyHeader) {
        providedKey = apiKeyHeader;
    }

    if (providedKey === config.security.apiKey) return true;

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

function time() {
    return new Date().toLocaleTimeString();
}

function setupMiddleware(req, res, pathname) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
}

module.exports = { requireAuth, time, setupMiddleware };
