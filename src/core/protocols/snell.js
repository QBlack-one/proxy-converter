module.exports = {
    id: 'snell',
    parse(link) {
        try {
            const url = new URL(link);
            const params = url.searchParams;
            const proxy = {
                name: decodeURIComponent(url.hash.slice(1)) || 'Snell Node',
                type: 'snell',
                server: url.hostname.replace(/^\[|\]$/g, ''),
                port: parseInt(url.port) || 443,
                psk: decodeURIComponent(url.username) || params.get('psk') || '',
                version: params.get('version') || '4'
            };
            if (params.get('obfs')) {
                proxy.obfs = params.get('obfs');
                if (params.get('obfs-host')) {
                    proxy['obfs-host'] = params.get('obfs-host');
                }
            }
            return proxy;
        } catch (e) {
            console.warn('Snell 解析失败:', e);
            return null;
        }
    },
    encode(p) {
        const params = new URLSearchParams();
        if (p.psk) params.set('psk', p.psk);
        if (p.version) params.set('version', p.version);
        if (p.obfs) {
            params.set('obfs', p.obfs);
            if (p['obfs-host']) params.set('obfs-host', p['obfs-host']);
        }
        return `snell://${p.server}:${p.port}?${params.toString()}#${encodeURIComponent(p.name || '')}`;
    }
};
