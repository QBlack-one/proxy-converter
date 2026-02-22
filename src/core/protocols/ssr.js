const { b64Decode, b64Encode } = require('../utils/base64');

module.exports = {
    id: 'ssr',
    parse(link) {
        try {
            const decoded = b64Decode(link.replace('ssr://', ''));
            if (!decoded) return null;
            const mainParts = decoded.split('/?');
            const parts = mainParts[0].split(':');
            if (parts.length < 6) return null;
            const server = parts[0];
            const port = parseInt(parts[1]);
            const protocol = parts[2];
            const method = parts[3];
            const obfs = parts[4];
            const password = b64Decode(parts[5]) || parts[5];
            let remark = 'SSR Node', protocolParam = '', obfsParam = '';
            if (mainParts[1]) {
                const params = new URLSearchParams(mainParts[1]);
                if (params.get('remarks')) remark = b64Decode(params.get('remarks')) || params.get('remarks');
                if (params.get('protoparam')) protocolParam = b64Decode(params.get('protoparam')) || params.get('protoparam');
                if (params.get('obfsparam')) obfsParam = b64Decode(params.get('obfsparam')) || params.get('obfsparam');
            }
            return { name: remark, type: 'ssr', server, port, cipher: method, password, protocol, obfs, 'protocol-param': protocolParam, 'obfs-param': obfsParam };
        } catch (e) {
            console.warn('SSR 解析失败:', e);
            return null;
        }
    },
    encode(p) {
        const main = `${p.server}:${p.port}:${p.protocol || 'origin'}:${p.cipher}:${p.obfs || 'plain'}:${b64Encode(p.password || '')}`;
        const params = [];
        if (p.name) params.push(`remarks=${b64Encode(p.name)}`);
        if (p['protocol-param']) params.push(`protoparam=${b64Encode(p['protocol-param'])}`);
        if (p['obfs-param']) params.push(`obfsparam=${b64Encode(p['obfs-param'])}`);
        const full = params.length > 0 ? `${main}/?${params.join('&')}` : main;
        return 'ssr://' + b64Encode(full);
    }
};
