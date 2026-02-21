'use strict';

const url = require('url');
const { config } = require('../config');
const { convertLinks } = require('../engine');
const { loadLinks } = require('../data');
const { detectClientFromUserAgent, generateSubscriptionHeaders } = require('../subscription');
const { time } = require('../middleware');

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

async function handleSub(req, res, parsedUrl) {
    try {
        const rawContent = await loadLinks();
        if (!rawContent.trim()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('暂无保存的代理链接\n请先在网页面板中粘贴链接并点击「保存到订阅服务」');
            return;
        }

        // 确定输出格式
        let format = parsedUrl.query.format || parsedUrl.query.type || '';
        if (!format) {
            format = detectClientFromUserAgent(req.headers['user-agent']);
        }

        if (!FORMAT_MIME[format]) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('不支持的格式: ' + format + '\n支持: clash-yaml, clash-meta, surge, sing-box, base64, raw');
            return;
        }

        const options = {
            httpPort: parseInt(parsedUrl.query.port) || config.defaults.httpPort,
            socksPort: parseInt(parsedUrl.query.socks) || config.defaults.socksPort,
            allowLan: parsedUrl.query.lan !== 'false',
            mode: parsedUrl.query.mode || config.defaults.mode,
            logLevel: config.defaults.logLevel,
            enableDns: true,
            testUrl: 'http://www.gstatic.com/generate_204',
            testInterval: config.defaults.testInterval
        };

        const result = convertLinks(rawContent, format, options);

        // 设置订阅响应头
        const subHeaders = generateSubscriptionHeaders();
        res.writeHead(200, {
            'Content-Type': FORMAT_MIME[format],
            'Content-Disposition': `attachment; filename="${FORMAT_FILENAME[format]}"`,
            ...subHeaders,
            'X-Proxy-Count': String(result.count)
        });
        res.end(result.output);
        console.log(`[${time()}] GET /sub → ${format} | ${result.count} 个节点`);
    } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('转换失败: ' + e.message);
    }
}

module.exports = { handleSub };
