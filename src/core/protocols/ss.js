const { b64Decode, b64Encode } = require('../utils/base64');

module.exports = {
    id: 'ss',
    parse(link) {
        try {
            let base = link.replace('ss://', '');
            let remark = 'SS Node';
            if (base.includes('#')) {
                const idx = base.indexOf('#');
                remark = decodeURIComponent(base.substring(idx + 1));
                base = base.substring(0, idx);
            }
            let method, password, server, port;
            if (base.includes('@')) {
                const atIdx = base.lastIndexOf('@');
                const userPart = base.substring(0, atIdx);
                const serverPart = base.substring(atIdx + 1);
                const decoded = b64Decode(userPart);
                if (decoded && decoded.includes(':')) {
                    const ci = decoded.indexOf(':');
                    method = decoded.substring(0, ci);
                    password = decoded.substring(ci + 1);
                } else {
                    const ci = userPart.indexOf(':');
                    method = userPart.substring(0, ci);
                    password = userPart.substring(ci + 1);
                }
                const m = serverPart.match(/^(.+):(\d+)/);
                if (m) { server = m[1]; port = parseInt(m[2]); }
            } else {
                const decoded = b64Decode(base);
                if (decoded && decoded.includes('@')) {
                    const ai = decoded.lastIndexOf('@');
                    const userInfo = decoded.substring(0, ai);
                    const serverInfo = decoded.substring(ai + 1);
                    const ci = userInfo.indexOf(':');
                    method = userInfo.substring(0, ci);
                    password = userInfo.substring(ci + 1);
                    const lc = serverInfo.lastIndexOf(':');
                    server = serverInfo.substring(0, lc);
                    port = parseInt(serverInfo.substring(lc + 1));
                }
            }
            if (!server || !port || !method) return null;
            return { name: remark, type: 'ss', server, port, cipher: method, password };
        } catch (e) {
            console.warn('SS 解析失败:', e);
            return null;
        }
    },
    encode(p) {
        const userInfo = b64Encode(`${p.cipher}:${p.password}`);
        let link = `ss://${userInfo}@${p.server}:${p.port}`;
        const params = new URLSearchParams();
        if (p.plugin) {
            let pluginStr = p.plugin;
            if (p['plugin-opts']) {
                const opts = Object.entries(p['plugin-opts']).map(([k, v]) => `${k}=${v}`).join(';');
                if (opts) pluginStr += ';' + opts;
            }
            params.set('plugin', pluginStr);
        }
        if (p.udp === false) params.set('udp', '0');
        const qs = params.toString();
        if (qs) link += '?' + qs;
        link += '#' + encodeURIComponent(p.name || '');
        return link;
    }
};
