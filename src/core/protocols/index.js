const { b64Decode } = require('../utils/base64');
const vmess = require('./vmess');
const vless = require('./vless');
const ss = require('./ss');
const ssr = require('./ssr');
const trojan = require('./trojan');
const hysteria = require('./hysteria');
const hysteria2 = require('./hysteria2');
const tuic = require('./tuic');
const wireguard = require('./wireguard');
const socks5 = require('./socks5');
const snell = require('./snell');
const naive = require('./naive');
const anytls = require('./anytls');

const protocols = [
    vmess, vless, ss, ssr, trojan, hysteria, hysteria2,
    tuic, wireguard, socks5, snell, naive, anytls
];

function parseLink(link) {
    link = link.trim();
    if (!link) return null;

    // Simple protocol detection
    if (link.startsWith('vmess://')) return vmess.parse(link);
    if (link.startsWith('vless://')) return vless.parse(link);
    if (link.startsWith('ss://') && !link.startsWith('ssr://')) return ss.parse(link);
    if (link.startsWith('ssr://')) return ssr.parse(link);
    if (link.startsWith('trojan://')) return trojan.parse(link);
    if (link.startsWith('hysteria2://') || link.startsWith('hy2://')) return hysteria2.parse(link);
    if (link.startsWith('hysteria://')) return hysteria.parse(link);
    if (link.startsWith('tuic://')) return tuic.parse(link);
    if (link.startsWith('wireguard://') || link.startsWith('wg://')) return wireguard.parse(link);
    if (link.startsWith('socks5://')) return socks5.parse(link);
    if (link.startsWith('snell://')) return snell.parse(link);
    if (link.startsWith('naive+https://')) return naive.parse(link);
    if (link.startsWith('anytls://')) return anytls.parse(link);

    return null;
}

function encodeProxy(p) {
    if (!p || !p.type) return null;
    const protocol = protocols.find(pro => pro.id === p.type);
    if (protocol) {
        return protocol.encode(p);
    }
    return null;
}

function extractLinks(input) {
    input = input.trim();
    if (!input.includes('://')) {
        const decoded = b64Decode(input);
        if (decoded && decoded.includes('://')) {
            input = decoded;
        }
    }
    return input.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);
}

module.exports = {
    parseLink,
    encodeProxy,
    extractLinks,
    protocols
};
