module.exports = {
    id: 'naive',
    parse(link) {
        try {
            // naive+https://user:pass@example.com:443#Name
            const normalized = link.replace('naive+https://', 'https://');
            const url = new URL(normalized);
            const proxy = {
                name: decodeURIComponent(url.hash.slice(1)) || 'NaiveProxy Node',
                type: 'naive',
                server: url.hostname.replace(/^\[|\]$/g, ''),
                port: parseInt(url.port) || 443,
                username: decodeURIComponent(url.username) || '',
                password: decodeURIComponent(url.password) || ''
            };
            return proxy;
        } catch (e) {
            console.warn('NaiveProxy 解析失败:', e);
            return null;
        }
    },
    encode(p) {
        let auth = '';
        if (p.username || p.password) {
            auth = `${encodeURIComponent(p.username || '')}:${encodeURIComponent(p.password || '')}@`;
        }
        return `naive+https://${auth}${p.server}:${p.port}#${encodeURIComponent(p.name || '')}`;
    }
};
