'use strict';

const { config } = require('./config');

function detectClientFromUserAgent(userAgent) {
    if (!userAgent) return 'base64';
    const ua = userAgent.toLowerCase();

    if (ua.includes('clash-verge') || ua.includes('clash verge')) return 'clash-meta';
    if (ua.includes('clash.meta') || ua.includes('clash meta')) return 'clash-meta';
    if (ua.includes('mihomo')) return 'clash-meta';
    if (ua.includes('clash')) return 'clash-yaml';
    if (ua.includes('surge')) return 'surge';
    if (ua.includes('sing-box') || ua.includes('singbox')) return 'sing-box';
    if (ua.includes('nekobox') || ua.includes('neko')) return 'sing-box';
    if (ua.includes('shadowrocket')) return 'base64';
    if (ua.includes('quantumult')) return 'base64';
    if (ua.includes('v2rayn') || ua.includes('v2rayng')) return 'base64';
    if (ua.includes('pharos')) return 'base64';

    return 'base64';
}

function generateSubscriptionHeaders() {
    const headers = {};
    const subConfig = config.subscription;

    if (subConfig.title) {
        headers['Profile-Title'] = Buffer.from(subConfig.title, 'utf-8').toString('base64');
    }

    headers['Profile-Update-Interval'] = String(subConfig.updateInterval || 24);

    const userinfo = [];
    if (subConfig.traffic && subConfig.traffic.enabled) {
        const t = subConfig.traffic;
        userinfo.push(`upload=${t.upload || 0}`, `download=${t.download || 0}`, `total=${t.total || 0}`);
    } else {
        userinfo.push('upload=0', 'download=0', 'total=0');
    }

    if (subConfig.expire && subConfig.expire.enabled && subConfig.expire.timestamp > 0) {
        userinfo.push(`expire=${subConfig.expire.timestamp}`);
    }

    headers['Subscription-Userinfo'] = userinfo.join('; ');
    return headers;
}

function formatTraffic(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + units[i];
}

function formatExpireTime(timestamp) {
    if (!timestamp || timestamp === 0) return '永久';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

module.exports = {
    detectClientFromUserAgent, generateSubscriptionHeaders,
    formatTraffic, formatExpireTime
};
