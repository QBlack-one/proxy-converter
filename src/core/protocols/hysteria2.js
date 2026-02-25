const { b64Decode, b64Encode, wrapIPv6 } = require('../utils/base64');

module.exports = {
    id: 'hysteria2',
    parse(link) {
        try {
            const normalized = link.replace('hy2://', 'hysteria2://');
            const url = new URL(normalized);
            const params = url.searchParams;
            const proxy = {
                name: decodeURIComponent(url.hash.slice(1)) || 'Hysteria2 Node',
                type: 'hysteria2',
                server: url.hostname.replace(/^\[|\]$/g, ''),
                port: parseInt(url.port) || 443,
                password: decodeURIComponent(url.username),
                sni: params.get('sni') || url.hostname.replace(/^\[|\]$/g, ''),
                'skip-cert-verify': params.get('insecure') === '1'
            };
            if (params.get('obfs')) proxy.obfs = params.get('obfs');
            if (params.get('obfs-password')) proxy['obfs-password'] = params.get('obfs-password');
            return proxy;
        } catch (e) {
            console.warn('Hysteria2 解析失败:', e);
            return null;
        }
    },
    encode(p) {
        const params = new URLSearchParams();
        if (p.sni) params.set('sni', p.sni);
        if (p['skip-cert-verify']) params.set('insecure', '1');
        if (p.obfs) params.set('obfs', p.obfs);
        if (p['obfs-password']) params.set('obfs-password', p['obfs-password']);
        return `hysteria2://${encodeURIComponent(p.password)}@${wrapIPv6(p.server)}:${p.port}?${params.toString()}#${encodeURIComponent(p.name || '')}`;
    }
};
