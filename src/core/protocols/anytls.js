module.exports = {
    id: 'anytls',
    parse(link) {
        try {
            const url = new URL(link);
            const proxy = {
                name: decodeURIComponent(url.hash.slice(1)) || 'AnyTLS Node',
                type: 'anytls',
                server: url.hostname,
                port: parseInt(url.port) || 443
            };
            if (url.username || url.password) {
                proxy.username = decodeURIComponent(url.username);
                proxy.password = decodeURIComponent(url.password);
            }
            return proxy;
        } catch (e) {
            console.warn('AnyTLS 解析失败:', e);
            return null;
        }
    },
    encode(p) {
        let auth = '';
        if (p.username || p.password) {
            auth = `${encodeURIComponent(p.username || '')}:${encodeURIComponent(p.password || '')}@`;
        }
        return `anytls://${auth}${p.server}:${p.port}#${encodeURIComponent(p.name || '')}`;
    }
};
