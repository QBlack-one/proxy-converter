const express = require('express');
const router = express.Router();
const { db, getNodes, saveNodes, clearNodes, getSetting, setSetting, getHistory, addHistory, clearHistory, getConfig, setConfig } = require('../db/index');
const { convertLinks } = require('../engine');
const { formatTraffic, formatExpireTime } = require('../subscription');
const { updateFromSources } = require('../auto-update');

// Auth middleware for API
function requireAuth(req, res, next) {
    const { config } = require('../config');
    if (!config || !config.security || !config.security.apiToken) {
        return next();
    }
    const token = req.headers['authorization'] || req.query.token;
    if (token !== `Bearer ${config.security.apiToken}` && token !== config.security.apiToken) {
        return res.status(401).json({ error: '未授权访问' });
    }
<<<<<<< HEAD
    next();
=======

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
                    const isNamePrefixFormat = /^.+? \w+:\/\//.test(line);
                    let urlStr = line;
                    if (isNamePrefixFormat) {
                        urlStr = line.substring(line.indexOf(' ') + 1);
                    }
                    const proto = urlStr.match(/^(\w+):\/\//);
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

    // ===== POST /api/nodes/batch-delete =====
    if (pathname === '/api/nodes/batch-delete' && req.method === 'POST') {
        if (!requireAuth(req, res)) return true;
        let body = '';
        req.on('data', chunk => { body += chunk; if (body.length > MAX_REQUEST_SIZE) req.destroy(); });
        await new Promise(resolve => req.on('end', resolve));
        try {
            const { indices } = JSON.parse(body);
            if (!Array.isArray(indices)) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: '请提供 indices 数组' }));
                return true;
            }
            let raw = '';
            try { raw = await fsPromises.readFile(LINKS_FILE, 'utf-8'); } catch (e) { }
            const lines = raw.split('\n').filter(l => l.trim());

            const uniqueIndices = [...new Set(indices)];
            const validIndices = uniqueIndices.map(Number).filter(n => !isNaN(n) && n >= 0 && n < lines.length);
            validIndices.sort((a, b) => b - a);

            let removedCount = 0;
            for (const idx of validIndices) {
                lines.splice(idx, 1);
                removedCount++;
            }

            await fsPromises.writeFile(LINKS_FILE, lines.join('\n'), 'utf-8');
            await fsPromises.writeFile(META_FILE, JSON.stringify({
                updatedAt: new Date().toISOString(), lineCount: lines.length, nodeCount: lines.length
            }, null, 2), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, removedCount, remaining: lines.length }));
            console.log(`[${time()}] 批量删除节点，共 ${removedCount} 个`);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e.message }));
        }
    return false; // 未匹配任何 API 路由
}

// POST /api/save
router.post('/save', requireAuth, (req, res) => {
    const { config } = require('../config');
    try {
        const rawLinks = req.body.links || '';
        if (!rawLinks.trim()) return res.status(400).json({ error: '未提供有效的代理链接' });

        const lines = rawLinks.split('\\n').filter(l => l.trim());
        if (lines.length > config.security.maxLinksCount) {
            return res.status(400).json({ error: `链接数量超限 (最多 ${config.security.maxLinksCount} 条)` });
        }

        const result = convertLinks(rawLinks, 'raw');

        // Save to DB
        const nodesToSave = result.nodeNames.map((name, i) => ({
            name,
            type: 'UNKNOWN', // Simplified
            server: 'unknown',
            port: 0,
            raw_link: lines[i] || ''
        }));
        saveNodes(nodesToSave);

        // History
        addHistory(result.count, result.nodeNames);
        setSetting('meta_updated_at', new Date().toISOString());

        const host = req.headers['host'] || `localhost:${config.port}`;
        const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const baseUrl = `${proto}://${host}/sub`;

        res.json({
            success: true,
            count: result.count,
            newCount: result.count,
            updatedAt: new Date().toISOString(),
            subUrls: {
                universal: baseUrl,
                base64: `${baseUrl}?format=base64`,
                'clash-yaml': `${baseUrl}?format=clash-yaml`,
                'clash-meta': `${baseUrl}?format=clash-meta`,
                surge: `${baseUrl}?format=surge`,
                'sing-box': `${baseUrl}?format=sing-box`,
                raw: `${baseUrl}?format=raw`
            }
        });
    } catch (e) {
        req.log.error(e, 'Save Links Error');
        res.status(400).json({ error: e.message });
    }
});

// GET /api/info
router.get('/info', (req, res) => {
    const { config } = require('../config');
    try {
        const nodesCount = db.prepare('SELECT COUNT(*) as count FROM nodes').get().count;
        const updatedAt = getSetting('meta_updated_at');
        const subConfig = config.subscription || {};

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

        res.json({
            status: 'running',
            port: config.port,
            formats: ['base64', 'clash-yaml', 'clash-meta', 'surge', 'sing-box', 'raw'],
            nodeCount: nodesCount,
            updatedAt,
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
        });
    } catch (e) {
        req.log.error(e, 'Info Error');
        res.status(500).json({ error: e.message });
    }
});

// GET /api/links
router.get('/links', (req, res) => {
    try {
        const nodes = getNodes();
        const rawContent = nodes.map(n => n.raw_link).join('\\n');
        res.type('text').send(rawContent);
    } catch (e) {
        req.log.error(e, 'Get Links Error');
        res.status(500).type('text').send('读取失败: ' + e.message);
    }
});

// GET /api/history
router.get('/history', (req, res) => {
    try {
        res.json({ success: true, history: getHistory() });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/history
router.delete('/history', requireAuth, (req, res) => {
    try {
        clearHistory();
        res.json({ success: true, message: '历史记录已清空' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/nodes
router.get('/nodes', (req, res) => {
    try {
        const nodes = getNodes().map((n, index) => ({
            index,
            name: n.name,
            type: n.type || 'UNKNOWN',
            link: n.raw_link
        }));
        res.json({ success: true, count: nodes.length, nodes });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/nodes
router.delete('/nodes', requireAuth, (req, res) => {
    const idx = parseInt(req.query.index);
    if (isNaN(idx) || idx < 0) return res.status(400).json({ error: '请提供有效的 index 参数' });
    try {
        const nodes = getNodes();
        if (idx >= nodes.length) return res.status(404).json({ error: '节点不存在' });

        const removed = nodes[idx];
        const deleteStmt = db.prepare('DELETE FROM nodes WHERE id = ?');
        deleteStmt.run(removed.id);

        setSetting('meta_updated_at', new Date().toISOString());
        res.json({ success: true, removed: removed.name, remaining: nodes.length - 1 });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE /api/links (Clear all)
router.delete('/links', requireAuth, (req, res) => {
    try {
        clearNodes();
        setSetting('meta_updated_at', new Date().toISOString());
        res.json({ success: true, message: '所有节点已清空' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
