module.exports = {
    id: 'socks5',
    parse(link) {
        try {
            const url = new URL(link);
            const proxy = {
                name: decodeURIComponent(url.hash.slice(1)) || 'SOCKS5 Node',
                type: 'socks5',
                server: url.hostname.replace(/^\[|\]$/g, ''),
                port: parseInt(url.port) || 1080
            };
            if (url.username || url.password) {
                proxy.username = decodeURIComponent(url.username);
                proxy.password = decodeURIComponent(url.password);
            }
            return proxy;
        } catch (e) {
            console.warn('SOCKS5 解析失败:', e);
            return null;
        }
    },
    encode(p) {
        const params = new URLSearchParams();
        let auth = '';
        if (p.username || p.password) {
            auth = `${encodeURIComponent(p.username || '')}:${encodeURIComponent(p.password || '')}@`;
        }
        return `socks5://${auth}${p.server}:${p.port}#${encodeURIComponent(p.name || '')}`;
    }
};
