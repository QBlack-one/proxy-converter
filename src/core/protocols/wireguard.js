const { b64Decode, b64Encode } = require('../utils/base64');

module.exports = {
    id: 'wireguard',
    parse(link) {
        try {
            const normalized = link.replace('wg://', 'wireguard://');
            const url = new URL(normalized);
            const params = url.searchParams;
            const proxy = {
                name: decodeURIComponent(url.hash.slice(1)) || 'WireGuard Node',
                type: 'wireguard',
                server: url.hostname.replace(/^\[|\]$/g, ''),
                port: parseInt(url.port) || 51820,
                'private-key': params.get('privatekey') || params.get('prikey') || '',
                'public-key': params.get('publickey') || params.get('pubkey') || decodeURIComponent(url.username) || '',
                ip: params.get('address') || '10.0.0.2',
                mtu: parseInt(params.get('mtu') || '1420')
            };
            if (params.get('reserved')) proxy.reserved = params.get('reserved');
            if (params.get('dns')) proxy.dns = params.get('dns').split(',');
            return proxy;
        } catch (e) {
            console.warn('WireGuard 解析失败:', e);
            return null;
        }
    },
    encode(p) {
        const params = new URLSearchParams();
        if (p['private-key']) params.set('privatekey', p['private-key']);
        if (p['public-key']) params.set('publickey', p['public-key']);
        if (p.ip) params.set('address', p.ip);
        if (p.mtu) params.set('mtu', String(p.mtu));
        if (p.reserved) params.set('reserved', p.reserved);
        if (p.dns) params.set('dns', Array.isArray(p.dns) ? p.dns.join(',') : p.dns);
        return `wireguard://${p.server}:${p.port}?${params.toString()}#${encodeURIComponent(p.name || '')}`;
    }
};
