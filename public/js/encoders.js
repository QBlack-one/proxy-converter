/**
 * 代理订阅转换器 - 反向编码模块
 * 将内部节点对象编码回协议链接
 */

function encodeVmess(p) {
    const json = {
        v: '2',
        ps: p.name || '',
        add: p.server,
        port: String(p.port),
        id: p.uuid,
        aid: String(p.alterId || 0),
        scy: p.cipher || 'auto',
        net: p.network || 'tcp',
        type: 'none',
        host: '',
        path: '',
        tls: p.tls ? 'tls' : ''
    };
    if (p['ws-opts']) {
        json.host = (p['ws-opts'].headers && p['ws-opts'].headers.Host) || '';
        json.path = p['ws-opts'].path || '/';
    }
    if (p['grpc-opts']) json.path = p['grpc-opts']['grpc-service-name'] || '';
    if (p['h2-opts']) {
        json.host = Array.isArray(p['h2-opts'].host) ? p['h2-opts'].host[0] : (p['h2-opts'].host || '');
        json.path = p['h2-opts'].path || '/';
    }
    if (p.servername) json.sni = p.servername;
    return 'vmess://' + b64Encode(JSON.stringify(json));
}

function encodeVless(p) {
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
    return `vless://${p.uuid}@${p.server}:${p.port}?${params.toString()}#${encodeURIComponent(p.name || '')}`;
}

function encodeSS(p) {
    const userInfo = b64Encode(`${p.cipher}:${p.password}`);
    let link = `ss://${userInfo}@${p.server}:${p.port}`;
    const params = new URLSearchParams();
    if (p.plugin) {
        let pluginStr = p.plugin;
        if (p['plugin-opts']) {
            const opts = Object.entries(p['plugin-opts']).map(([k, v]) => `${k}=${v}`).join(';');
            if (opts) pluginStr += ';' + opts;
        }
        params.set('plugin', pluginStr);
    }
    if (p.udp === false) params.set('udp', '0');
    const qs = params.toString();
    if (qs) link += '?' + qs;
    link += '#' + encodeURIComponent(p.name || '');
    return link;
}

function encodeSSR(p) {
    const main = `${p.server}:${p.port}:${p.protocol || 'origin'}:${p.cipher}:${p.obfs || 'plain'}:${b64Encode(p.password || '')}`;
    const params = [];
    if (p.name) params.push(`remarks=${b64Encode(p.name)}`);
    if (p['protocol-param']) params.push(`protoparam=${b64Encode(p['protocol-param'])}`);
    if (p['obfs-param']) params.push(`obfsparam=${b64Encode(p['obfs-param'])}`);
    const full = params.length > 0 ? `${main}/?${params.join('&')}` : main;
    return 'ssr://' + b64Encode(full);
}

function encodeTrojan(p) {
    const params = new URLSearchParams();
    if (p.sni) params.set('sni', p.sni);
    if (p.network && p.network !== 'tcp') {
        params.set('type', p.network);
        if (p.network === 'ws' && p['ws-opts']) {
            params.set('path', p['ws-opts'].path || '/');
            if (p['ws-opts'].headers && p['ws-opts'].headers.Host) params.set('host', p['ws-opts'].headers.Host);
        }
        if (p.network === 'grpc' && p['grpc-opts']) {
            params.set('serviceName', p['grpc-opts']['grpc-service-name'] || '');
        }
    }
    if (p['client-fingerprint']) params.set('fp', p['client-fingerprint']);
    return `trojan://${encodeURIComponent(p.password)}@${p.server}:${p.port}?${params.toString()}#${encodeURIComponent(p.name || '')}`;
}

function encodeHysteria(p) {
    const params = new URLSearchParams();
    if (p['auth-str']) params.set('auth', p['auth-str']);
    if (p.up) params.set('upmbps', String(p.up));
    if (p.down) params.set('downmbps', String(p.down));
    if (p.sni) params.set('peer', p.sni);
    if (p['skip-cert-verify']) params.set('insecure', '1');
    if (p.obfs) params.set('obfs', p.obfs);
    if (p.protocol) params.set('protocol', p.protocol);
    if (p.alpn) params.set('alpn', Array.isArray(p.alpn) ? p.alpn[0] : p.alpn);
    return `hysteria://${p.server}:${p.port}?${params.toString()}#${encodeURIComponent(p.name || '')}`;
}

function encodeHysteria2(p) {
    const params = new URLSearchParams();
    if (p.sni) params.set('sni', p.sni);
    if (p['skip-cert-verify']) params.set('insecure', '1');
    if (p.obfs) params.set('obfs', p.obfs);
    if (p['obfs-password']) params.set('obfs-password', p['obfs-password']);
    return `hysteria2://${encodeURIComponent(p.password)}@${p.server}:${p.port}?${params.toString()}#${encodeURIComponent(p.name || '')}`;
}

function encodeTuic(p) {
    const params = new URLSearchParams();
    if (p.sni) params.set('sni', p.sni);
    if (p['skip-cert-verify']) params.set('allow_insecure', '1');
    if (p['congestion-controller']) params.set('congestion_control', p['congestion-controller']);
    if (p['udp-relay-mode']) params.set('udp_relay_mode', p['udp-relay-mode']);
    if (p.alpn) params.set('alpn', Array.isArray(p.alpn) ? p.alpn.join(',') : p.alpn);
    const pw = p.password ? `:${encodeURIComponent(p.password)}` : '';
    return `tuic://${p.uuid}${pw}@${p.server}:${p.port}?${params.toString()}#${encodeURIComponent(p.name || '')}`;
}

function encodeWireGuard(p) {
    const params = new URLSearchParams();
    if (p['private-key']) params.set('privatekey', p['private-key']);
    if (p['public-key']) params.set('publickey', p['public-key']);
    if (p.ip) params.set('address', p.ip);
    if (p.mtu) params.set('mtu', String(p.mtu));
    if (p.reserved) params.set('reserved', p.reserved);
    if (p.dns) params.set('dns', Array.isArray(p.dns) ? p.dns.join(',') : p.dns);
    return `wireguard://${p.server}:${p.port}?${params.toString()}#${encodeURIComponent(p.name || '')}`;
}

// ==================== SOCKS5 ====================

function encodeSocks5(p) {
    const params = new URLSearchParams();
    let auth = '';
    if (p.username || p.password) {
        auth = `${encodeURIComponent(p.username || '')}:${encodeURIComponent(p.password || '')}@`;
    }
    return `socks5://${auth}${p.server}:${p.port}#${encodeURIComponent(p.name || '')}`;
}

// ==================== Snell ====================

function encodeSnell(p) {
    const params = new URLSearchParams();
    if (p.psk) params.set('psk', p.psk);
    if (p.version) params.set('version', p.version);
    if (p.obfs) {
        params.set('obfs', p.obfs);
        if (p['obfs-host']) params.set('obfs-host', p['obfs-host']);
    }
    return `snell://${p.server}:${p.port}?${params.toString()}#${encodeURIComponent(p.name || '')}`;
}

// ==================== NaiveProxy ====================

function encodeNaive(p) {
    let auth = '';
    if (p.username || p.password) {
        auth = `${encodeURIComponent(p.username || '')}:${encodeURIComponent(p.password || '')}@`;
    }
    return `naive+https://${auth}${p.server}:${p.port}#${encodeURIComponent(p.name || '')}`;
}

// ==================== AnyTLS ====================

function encodeAnyTLS(p) {
    let auth = '';
    if (p.username || p.password) {
        auth = `${encodeURIComponent(p.username || '')}:${encodeURIComponent(p.password || '')}@`;
    }
    return `anytls://${auth}${p.server}:${p.port}#${encodeURIComponent(p.name || '')}`;
}

// ==================== 统一编码入口 ====================

function encodeProxy(p) {
    switch (p.type) {
        case 'vmess': return encodeVmess(p);
        case 'vless': return encodeVless(p);
        case 'ss': return encodeSS(p);
        case 'ssr': return encodeSSR(p);
        case 'trojan': return encodeTrojan(p);
        case 'hysteria': return encodeHysteria(p);
        case 'hysteria2': return encodeHysteria2(p);
        case 'tuic': return encodeTuic(p);
        case 'wireguard': return encodeWireGuard(p);
        case 'socks5': return encodeSocks5(p);
        case 'snell': return encodeSnell(p);
        case 'naive': return encodeNaive(p);
        case 'anytls': return encodeAnyTLS(p);
        default: return null;
    }
}

// ==================== 生成订阅内容 ====================

function generateRawLinks(proxies) {
    return proxies.map(p => encodeProxy(p)).filter(Boolean).join('\n');
}

function generateBase64Sub(proxies) {
    const raw = generateRawLinks(proxies);
    return b64Encode(raw);
}
