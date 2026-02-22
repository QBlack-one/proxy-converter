const { b64Decode, b64Encode } = require('../utils/base64');

module.exports = {
    id: 'vmess',
    parse(link) {
        try {
            const b64 = link.replace('vmess://', '');
            const json = JSON.parse(b64Decode(b64));
            const proxy = {
                name: json.ps || 'VMess Node',
                type: 'vmess',
                server: json.add,
                port: parseInt(json.port),
                uuid: json.id,
                alterId: parseInt(json.aid || 0),
                cipher: json.scy || 'auto',
                network: json.net || 'tcp',
                tls: json.tls === 'tls'
            };
            if (proxy.network === 'ws') {
                proxy['ws-opts'] = {
                    path: json.path || '/',
                    headers: { Host: json.host || '' }
                };
            }
            if (proxy.network === 'grpc') {
                proxy['grpc-opts'] = { 'grpc-service-name': json.path || '' };
            }
            if (proxy.network === 'h2') {
                proxy['h2-opts'] = { host: [json.host || ''], path: json.path || '/' };
            }
            if (json.sni) proxy.servername = json.sni;
            if (proxy.tls) proxy['skip-cert-verify'] = true;
            return proxy;
        } catch (e) {
            console.warn('VMess 解析失败:', e);
            return null;
        }
    },
    encode(p) {
        const json = {
            v: '2', ps: p.name || '', add: p.server, port: String(p.port),
            id: p.uuid, aid: String(p.alterId || 0), scy: p.cipher || 'auto',
            net: p.network || 'tcp', type: 'none', host: '', path: '',
            tls: p.tls ? 'tls' : ''
        };
        if (p.network === 'ws' && p['ws-opts']) {
            json.path = p['ws-opts'].path || '/';
            if (p['ws-opts'].headers && p['ws-opts'].headers.Host) json.host = p['ws-opts'].headers.Host;
        }
        if (p.network === 'grpc' && p['grpc-opts']) {
            json.path = p['grpc-opts']['grpc-service-name'] || '';
        }
        if (p.network === 'h2' && p['h2-opts']) {
            json.path = p['h2-opts'].path || '/';
            if (p['h2-opts'].host && p['h2-opts'].host[0]) json.host = p['h2-opts'].host[0];
        }
        if (p.servername) json.sni = p.servername;
        return 'vmess://' + b64Encode(JSON.stringify(json));
    }
};
