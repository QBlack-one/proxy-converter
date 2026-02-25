const { b64Decode, b64Encode, wrapIPv6 } = require('../utils/base64');

module.exports = {
    id: 'trojan',
    parse(link) {
        try {
            const url = new URL(link);
            const params = url.searchParams;
            const proxy = {
                name: decodeURIComponent(url.hash.slice(1)) || 'Trojan Node',
                type: 'trojan',
                server: url.hostname.replace(/^\[|\]$/g, ''),
                port: parseInt(url.port) || 443,
                password: decodeURIComponent(url.username),
                sni: params.get('sni') || url.hostname.replace(/^\[|\]$/g, ''),
                'skip-cert-verify': true
            };
            const network = params.get('type') || 'tcp';
            if (network === 'ws') {
                proxy.network = 'ws';
                proxy['ws-opts'] = { path: params.get('path') || '/', headers: { Host: params.get('host') || '' } };
            }
            if (network === 'grpc') {
                proxy.network = 'grpc';
                proxy['grpc-opts'] = { 'grpc-service-name': params.get('serviceName') || '' };
            }
            if (params.get('fp')) proxy['client-fingerprint'] = params.get('fp');
            return proxy;
        } catch (e) {
            console.warn('Trojan 解析失败:', e);
            return null;
        }
    },
    encode(p) {
        const params = new URLSearchParams();
        if (p.sni) params.set('sni', p.sni);
        if (p.network && p.network !== 'tcp') {
            params.set('type', p.network);
            if (p.network === 'ws' && p['ws-opts']) {
                params.set('path', p['ws-opts'].path || '/');
                if (p['ws-opts'].headers && p['ws-opts'].headers.Host) params.set('host', p['ws-opts'].headers.Host);
            }
            if (p.network === 'grpc' && p['grpc-opts']) {
                params.set('serviceName', p['grpc-opts']['grpc-service-name'] || '');
            }
        }
        if (p['client-fingerprint']) params.set('fp', p['client-fingerprint']);
        return `trojan://${encodeURIComponent(p.password)}@${wrapIPv6(p.server)}:${p.port}?${params.toString()}#${encodeURIComponent(p.name || '')}`;
    }
};
