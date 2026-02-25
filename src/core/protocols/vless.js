const { b64Decode, b64Encode, wrapIPv6 } = require('../utils/base64');

module.exports = {
    id: 'vless',
    parse(link) {
        try {
            const url = new URL(link);
            const params = url.searchParams;
            const proxy = {
                name: decodeURIComponent(url.hash.slice(1)) || 'VLESS Node',
                type: 'vless',
                server: url.hostname.replace(/^\[|\]$/g, ''),
                port: parseInt(url.port),
                uuid: url.username,
                network: params.get('type') || 'tcp',
                tls: params.get('security') === 'tls' || params.get('security') === 'reality',
                'skip-cert-verify': true
            };
            if (params.get('security') === 'reality') {
                proxy['reality-opts'] = {
                    'public-key': params.get('pbk') || '',
                    'short-id': params.get('sid') || ''
                };
                proxy.servername = params.get('sni') || '';
                proxy['client-fingerprint'] = params.get('fp') || 'chrome';
            }
            if (params.get('sni')) proxy.servername = params.get('sni');
            if (params.get('flow')) proxy.flow = params.get('flow');
            if (proxy.network === 'ws') {
                proxy['ws-opts'] = { path: params.get('path') || '/' };
                if (params.get('host')) {
                    proxy['ws-opts'].headers = { Host: params.get('host') };
                }
            }
            if (proxy.network === 'grpc') {
                proxy['grpc-opts'] = { 'grpc-service-name': params.get('serviceName') || '' };
            }
            if (proxy.network === 'h2') {
                proxy['h2-opts'] = { host: [params.get('host') || ''], path: params.get('path') || '/' };
            }
            return proxy;
        } catch (e) {
            console.warn('VLESS 解析失败:', e);
            return null;
        }
    },
    encode(p) {
        const params = new URLSearchParams();
        params.set('type', p.network || 'tcp');
        if (p.tls) {
            if (p['reality-opts']) {
                params.set('security', 'reality');
                if (p['reality-opts']['public-key']) params.set('pbk', p['reality-opts']['public-key']);
                if (p['reality-opts']['short-id']) params.set('sid', p['reality-opts']['short-id']);
            } else {
                params.set('security', 'tls');
            }
        }
        if (p.servername) params.set('sni', p.servername);
        if (p.flow) params.set('flow', p.flow);
        if (p['client-fingerprint']) params.set('fp', p['client-fingerprint']);
        if (p['ws-opts']) {
            params.set('path', p['ws-opts'].path || '/');
            if (p['ws-opts'].headers && p['ws-opts'].headers.Host) params.set('host', p['ws-opts'].headers.Host);
        }
        if (p['grpc-opts']) params.set('serviceName', p['grpc-opts']['grpc-service-name'] || '');
        if (p['h2-opts']) {
            params.set('path', p['h2-opts'].path || '/');
            if (Array.isArray(p['h2-opts'].host) && p['h2-opts'].host[0]) params.set('host', p['h2-opts'].host[0]);
        }
        return `vless://${p.uuid}@${wrapIPv6(p.server)}:${p.port}?${params.toString()}#${encodeURIComponent(p.name || '')}`;
    }
};
