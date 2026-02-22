const { b64Decode, b64Encode } = require('../utils/base64');

module.exports = {
    id: 'hysteria',
    parse(link) {
        try {
            const url = new URL(link);
            const params = url.searchParams;
            const proxy = {
                name: decodeURIComponent(url.hash.slice(1)) || 'Hysteria Node',
                type: 'hysteria',
                server: url.hostname,
                port: parseInt(url.port) || 443,
                'auth-str': params.get('auth') || decodeURIComponent(url.username) || '',
                up: params.get('upmbps') || '100',
                down: params.get('downmbps') || '100',
                sni: params.get('peer') || params.get('sni') || url.hostname,
                'skip-cert-verify': params.get('insecure') === '1',
                protocol: params.get('protocol') || 'udp'
            };
            if (params.get('obfs')) proxy.obfs = params.get('obfs');
            if (params.get('alpn')) proxy.alpn = [params.get('alpn')];
            return proxy;
        } catch (e) {
            console.warn('Hysteria 解析失败:', e);
            return null;
        }
    },
    encode(p) {
        const params = new URLSearchParams();
        if (p['auth-str']) params.set('auth', p['auth-str']);
        if (p.up) params.set('upmbps', String(p.up));
        if (p.down) params.set('downmbps', String(p.down));
        if (p.sni) params.set('peer', p.sni);
        if (p['skip-cert-verify']) params.set('insecure', '1');
        if (p.obfs) params.set('obfs', p.obfs);
        if (p.protocol) params.set('protocol', p.protocol);
        if (p.alpn) params.set('alpn', Array.isArray(p.alpn) ? p.alpn[0] : p.alpn);
        return `hysteria://${p.server}:${p.port}?${params.toString()}#${encodeURIComponent(p.name || '')}`;
    }
};
