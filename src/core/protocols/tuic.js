const { b64Decode, b64Encode } = require('../utils/base64');

module.exports = {
    id: 'tuic',
    parse(link) {
        try {
            const url = new URL(link);
            const params = url.searchParams;
            const proxy = {
                name: decodeURIComponent(url.hash.slice(1)) || 'TUIC Node',
                type: 'tuic',
                server: url.hostname,
                port: parseInt(url.port) || 443,
                uuid: url.username,
                password: decodeURIComponent(url.password || ''),
                sni: params.get('sni') || url.hostname,
                'skip-cert-verify': params.get('allow_insecure') === '1' || params.get('insecure') === '1',
                'congestion-controller': params.get('congestion_control') || 'bbr',
                'udp-relay-mode': params.get('udp_relay_mode') || 'native'
            };
            if (params.get('alpn')) proxy.alpn = params.get('alpn').split(',');
            return proxy;
        } catch (e) {
            console.warn('TUIC 解析失败:', e);
            return null;
        }
    },
    encode(p) {
        const params = new URLSearchParams();
        if (p.sni) params.set('sni', p.sni);
        if (p['skip-cert-verify']) params.set('allow_insecure', '1');
        if (p['congestion-controller']) params.set('congestion_control', p['congestion-controller']);
        if (p['udp-relay-mode']) params.set('udp_relay_mode', p['udp-relay-mode']);
        if (p.alpn) params.set('alpn', Array.isArray(p.alpn) ? p.alpn.join(',') : p.alpn);
        const pw = p.password ? `:${encodeURIComponent(p.password)}` : '';
        return `tuic://${p.uuid}${pw}@${p.server}:${p.port}?${params.toString()}#${encodeURIComponent(p.name || '')}`;
    }
};
