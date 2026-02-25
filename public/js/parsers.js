/**
 * 代理订阅转换器 - 协议解析模块
 * 支持: VMess, VLESS, SS, SSR, Trojan, Hysteria, Hysteria2, TUIC, WireGuard, SOCKS5, Snell, NaiveProxy, AnyTLS
 */

// ==================== Base64 工具 ====================

function safeDecode(str) {
    if (!str) return '';
    try { return decodeURIComponent(str); }
    catch (e) { try { return unescape(str); } catch (e2) { return str; } }
}

function b64Decode(str) {
    try {
        str = str.trim().replace(/\s/g, '');
        str = str.replace(/-/g, '+').replace(/_/g, '/');
        const pad = str.length % 4;
        if (pad) str += '='.repeat(4 - pad);
        return decodeURIComponent(escape(atob(str)));
    } catch (e) {
        return null;
    }
}

function b64Encode(str) {
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        return btoa(str);
    }
}

// ==================== VMess ====================

function parseVmess(link) {
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
}

// ==================== VLESS ====================

function parseVless(link) {
    try {
        const url = new URL(link);
        const params = url.searchParams;
        const proxy = {
            name: safeDecode(url.hash.slice(1)) || 'VLESS Node',
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
}

// ==================== Shadowsocks ====================

function parseSS(link) {
    try {
        let base = link.replace('ss://', '');
        let remark = 'SS Node';
        if (base.includes('#')) {
            const idx = base.indexOf('#');
            remark = safeDecode(base.substring(idx + 1));
            base = base.substring(0, idx);
        }
        let method, password, server, port;
        if (base.includes('@')) {
            const atIdx = base.lastIndexOf('@');
            const userPart = base.substring(0, atIdx);
            const serverPart = base.substring(atIdx + 1);
            const decoded = b64Decode(userPart);
            if (decoded && decoded.includes(':')) {
                const ci = decoded.indexOf(':');
                method = decoded.substring(0, ci);
                password = decoded.substring(ci + 1);
            } else {
                const ci = userPart.indexOf(':');
                method = userPart.substring(0, ci);
                password = userPart.substring(ci + 1);
            }
            const m = serverPart.match(/^(.+):(\d+)/);
            if (m) { server = m[1]; port = parseInt(m[2]); }
        } else {
            const decoded = b64Decode(base);
            if (decoded && decoded.includes('@')) {
                const ai = decoded.lastIndexOf('@');
                const userInfo = decoded.substring(0, ai);
                const serverInfo = decoded.substring(ai + 1);
                const ci = userInfo.indexOf(':');
                method = userInfo.substring(0, ci);
                password = userInfo.substring(ci + 1);
                const lc = serverInfo.lastIndexOf(':');
                server = serverInfo.substring(0, lc);
                port = parseInt(serverInfo.substring(lc + 1));
            }
        }
        if (!server || !port || !method) return null;
        return { name: remark, type: 'ss', server, port, cipher: method, password };
    } catch (e) {
        console.warn('SS 解析失败:', e);
        return null;
    }
}

// ==================== ShadowsocksR ====================

function parseSSR(link) {
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
}

// ==================== Trojan ====================

function parseTrojan(link) {
    try {
        const url = new URL(link);
        const params = url.searchParams;
        const proxy = {
            name: safeDecode(url.hash.slice(1)) || 'Trojan Node',
            type: 'trojan',
            server: url.hostname.replace(/^\[|\]$/g, ''),
            port: parseInt(url.port) || 443,
            password: safeDecode(url.username),
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
}

// ==================== Hysteria v1 ====================

function parseHysteria(link) {
    try {
        const url = new URL(link);
        const params = url.searchParams;
        const proxy = {
            name: safeDecode(url.hash.slice(1)) || 'Hysteria Node',
            type: 'hysteria',
            server: url.hostname.replace(/^\[|\]$/g, ''),
            port: parseInt(url.port) || 443,
            'auth-str': params.get('auth') || safeDecode(url.username) || '',
            up: params.get('upmbps') || '100',
            down: params.get('downmbps') || '100',
            sni: params.get('peer') || params.get('sni') || url.hostname.replace(/^\[|\]$/g, ''),
            'skip-cert-verify': params.get('insecure') === '1',
            protocol: params.get('protocol') || 'udp'
        };
        if (params.get('obfs')) proxy.obfs = params.get('obfs');
        if (params.get('alpn')) proxy.alpn = [params.get('alpn')];
        return proxy;
    } catch (e) {
        console.warn('Hysteria 解析失败:', e);
        return null;
    }
}

// ==================== Hysteria2 ====================

function parseHysteria2(link) {
    try {
        const normalized = link.replace('hy2://', 'hysteria2://');
        const url = new URL(normalized);
        const params = url.searchParams;
        const proxy = {
            name: safeDecode(url.hash.slice(1)) || 'Hysteria2 Node',
            type: 'hysteria2',
            server: url.hostname.replace(/^\[|\]$/g, ''),
            port: parseInt(url.port) || 443,
            password: safeDecode(url.username),
            sni: params.get('sni') || url.hostname.replace(/^\[|\]$/g, ''),
            'skip-cert-verify': params.get('insecure') === '1'
        };
        if (params.get('obfs')) proxy.obfs = params.get('obfs');
        if (params.get('obfs-password')) proxy['obfs-password'] = params.get('obfs-password');
        return proxy;
    } catch (e) {
        console.warn('Hysteria2 解析失败:', e);
        return null;
    }
}

// ==================== TUIC ====================

function parseTuic(link) {
    try {
        const url = new URL(link);
        const params = url.searchParams;
        const proxy = {
            name: safeDecode(url.hash.slice(1)) || 'TUIC Node',
            type: 'tuic',
            server: url.hostname.replace(/^\[|\]$/g, ''),
            port: parseInt(url.port) || 443,
            uuid: url.username,
            password: safeDecode(url.password || ''),
            sni: params.get('sni') || url.hostname.replace(/^\[|\]$/g, ''),
            'skip-cert-verify': params.get('allow_insecure') === '1' || params.get('insecure') === '1',
            'congestion-controller': params.get('congestion_control') || 'bbr',
            'udp-relay-mode': params.get('udp_relay_mode') || 'native'
        };
        if (params.get('alpn')) proxy.alpn = params.get('alpn').split(',');
        return proxy;
    } catch (e) {
        console.warn('TUIC 解析失败:', e);
        return null;
    }
}

// ==================== WireGuard ====================

function parseWireGuard(link) {
    try {
        const normalized = link.replace('wg://', 'wireguard://');
        const url = new URL(normalized);
        const params = url.searchParams;
        const proxy = {
            name: safeDecode(url.hash.slice(1)) || 'WireGuard Node',
            type: 'wireguard',
            server: url.hostname.replace(/^\[|\]$/g, ''),
            port: parseInt(url.port) || 51820,
            'private-key': params.get('privatekey') || params.get('prikey') || '',
            'public-key': params.get('publickey') || params.get('pubkey') || safeDecode(url.username) || '',
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
}

// ==================== SOCKS5 ====================

function parseSocks5(link) {
    try {
        const url = new URL(link);
        const proxy = {
            name: safeDecode(url.hash.slice(1)) || 'SOCKS5 Node',
            type: 'socks5',
            server: url.hostname.replace(/^\[|\]$/g, ''),
            port: parseInt(url.port) || 1080
        };
        if (url.username || url.password) {
            proxy.username = safeDecode(url.username);
            proxy.password = safeDecode(url.password);
        }
        return proxy;
    } catch (e) {
        console.warn('SOCKS5 解析失败:', e);
        return null;
    }
}

// ==================== Snell ====================

function parseSnell(link) {
    try {
        const url = new URL(link);
        const params = url.searchParams;
        const proxy = {
            name: safeDecode(url.hash.slice(1)) || 'Snell Node',
            type: 'snell',
            server: url.hostname.replace(/^\[|\]$/g, ''),
            port: parseInt(url.port) || 443,
            psk: safeDecode(url.username) || params.get('psk') || '',
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
}

// ==================== NaiveProxy ====================

function parseNaive(link) {
    try {
        // naive+https://user:pass@example.com:443#Name
        const normalized = link.replace('naive+https://', 'https://');
        const url = new URL(normalized);
        const proxy = {
            name: safeDecode(url.hash.slice(1)) || 'NaiveProxy Node',
            type: 'naive',
            server: url.hostname.replace(/^\[|\]$/g, ''),
            port: parseInt(url.port) || 443,
            username: safeDecode(url.username) || '',
            password: safeDecode(url.password) || ''
        };
        return proxy;
    } catch (e) {
        console.warn('NaiveProxy 解析失败:', e);
        return null;
    }
}

// ==================== AnyTLS ====================

function parseAnyTLS(link) {
    try {
        const url = new URL(link);
        const proxy = {
            name: safeDecode(url.hash.slice(1)) || 'AnyTLS Node',
            type: 'anytls',
            server: url.hostname.replace(/^\[|\]$/g, ''),
            port: parseInt(url.port) || 443
        };
        if (url.username || url.password) {
            proxy.username = safeDecode(url.username);
            proxy.password = safeDecode(url.password);
        }
        return proxy;
    } catch (e) {
        console.warn('AnyTLS 解析失败:', e);
        return null;
    }
}

// ==================== 入口路由 ====================

function parseLink(link) {
    link = link.trim();
    if (!link) return null;
    if (link.startsWith('vmess://')) return parseVmess(link);
    if (link.startsWith('vless://')) return parseVless(link);
    if (link.startsWith('ss://') && !link.startsWith('ssr://')) return parseSS(link);
    if (link.startsWith('ssr://')) return parseSSR(link);
    if (link.startsWith('trojan://')) return parseTrojan(link);
    if (link.startsWith('hysteria2://') || link.startsWith('hy2://')) return parseHysteria2(link);
    if (link.startsWith('hysteria://')) return parseHysteria(link);
    if (link.startsWith('tuic://')) return parseTuic(link);
    if (link.startsWith('wireguard://') || link.startsWith('wg://')) return parseWireGuard(link);
    if (link.startsWith('socks5://')) return parseSocks5(link);
    if (link.startsWith('snell://')) return parseSnell(link);
    if (link.startsWith('naive+https://')) return parseNaive(link);
    if (link.startsWith('anytls://')) return parseAnyTLS(link);
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
