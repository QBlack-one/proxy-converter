const express = require('express');
const router = express.Router();
const { convertLinks } = require('../engine');
const { getNodes } = require('../db/index');
const { detectClientFromUserAgent, generateSubscriptionHeaders } = require('../subscription');
const { config } = require('../config');

const FORMAT_MIME = {
    'base64': 'text/plain; charset=utf-8',
    'clash-yaml': 'text/yaml; charset=utf-8',
    'clash-meta': 'text/yaml; charset=utf-8',
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

router.get('/', (req, res) => {
    try {
        const nodes = getNodes();
        const rawContent = nodes.map(n => n.raw_link).join('\\n');

        if (!rawContent.trim()) {
            return res.status(404).type('text').send('暂无保存的代理链接\\n请先在网页面板中粘贴链接并点击「保存到订阅服务」');
        }

        let format = req.query.format || req.query.type || '';
        if (!format) {
            format = detectClientFromUserAgent(req.headers['user-agent']);
        }

        if (!FORMAT_MIME[format]) {
            return res.status(400).type('text').send('不支持的格式: ' + format + '\\n支持: clash-yaml, clash-meta, surge, sing-box, base64, raw');
        }

        const options = {
            title: 'xinghe',
            httpPort: parseInt(req.query.port) || config.defaults.httpPort,
            socksPort: parseInt(req.query.socks) || config.defaults.socksPort,
            allowLan: req.query.lan !== 'false',
            mode: req.query.mode || config.defaults.mode,
            logLevel: config.defaults.logLevel,
            enableDns: true,
            testUrl: 'http://www.gstatic.com/generate_204',
            testInterval: config.defaults.testInterval
        };

        const result = convertLinks(rawContent, format, options);

        const subHeaders = generateSubscriptionHeaders();
        const ext = FORMAT_FILENAME[format].substring(FORMAT_FILENAME[format].lastIndexOf('.'));
        const baseFilename = `xinghe${ext}`;
        const encodedFilename = encodeURIComponent(baseFilename);

        res.set(FORMAT_MIME[format]);
        res.set('Content-Disposition', `inline; filename=${baseFilename}; filename*=utf-8''${encodedFilename}`);
        res.set('profile-update-interval', String(config.subscription.updateInterval || 24));
        res.set('profile-title', Buffer.from('xinghe', 'utf-8').toString('base64'));
        for (const [k, v] of Object.entries(subHeaders)) {
            res.set(k, v);
        }
        res.set('X-Proxy-Count', String(result.count));

        res.send(result.output);
        req.log.info({ format, nodes: result.count }, 'Subscription Sent');
    } catch (e) {
        req.log.error(e, 'Sub Route Error');
        res.status(500).type('text').send('转换失败: ' + e.message);
    }
});

module.exports = router;
