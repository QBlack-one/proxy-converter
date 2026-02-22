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
    next();
}

// POST /api/save
router.post('/save', requireAuth, (req, res) => {
    const { config } = require('../config');
    try {
        const rawLinks = req.body.links || '';
        if (!rawLinks.trim()) return res.status(400).json({ error: '未提供有效的代理链接' });

        const lines = rawLinks.split(/\r?\n/).filter(l => l.trim());
        if (lines.length > config.security.maxLinksCount) {
            return res.status(400).json({ error: `链接数量超限 (最多 ${config.security.maxLinksCount} 条)` });
        }

        const result = convertLinks(rawLinks, 'raw');

        // Save to DB - 使用引擎解析出的完整 proxy 信息
        const nodesToSave = result.proxies.map((proxy, i) => ({
            name: proxy.name || 'Unknown',
            type: (proxy.type || 'unknown').toUpperCase(),
            server: proxy.server || 'unknown',
            port: proxy.port || 0,
            raw_link: lines[i] || '',
            details: JSON.stringify(proxy)
        }));
        const addedCount = saveNodes(nodesToSave);
        const totalCount = db.prepare('SELECT COUNT(*) as count FROM nodes').get().count;

        // History
        addHistory(result.count, result.nodeNames);
        setSetting('meta_updated_at', new Date().toISOString());

        const host = req.headers['host'] || `localhost:${config.port}`;
        const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const baseUrl = `${proto}://${host}/sub`;

        res.json({
            success: true,
            count: totalCount,
            newCount: addedCount,
            duplicateCount: result.count - addedCount,
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
        const rawContent = nodes.map(n => n.raw_link).join('\n');
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
