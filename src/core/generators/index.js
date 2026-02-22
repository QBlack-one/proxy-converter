const { flowObj } = require('../utils/yaml');
const { encodeProxy } = require('../protocols/index');
const { b64Encode } = require('../utils/base64');

// ==================== Clash / Clash Meta Helpers ====================

function getClashRules(proxyGroup) {
    const P = proxyGroup;
    return [
        'GEOSITE,private,DIRECT',
        'GEOIP,LAN,DIRECT,no-resolve',
        'GEOSITE,cn,DIRECT',
        'GEOIP,CN,DIRECT,no-resolve',
        `IP-CIDR,1.1.1.1/32,${P},no-resolve`,
        `IP-CIDR,8.8.8.8/32,${P},no-resolve`,
        `DOMAIN-SUFFIX,services.googleapis.cn,${P}`,
        `DOMAIN-SUFFIX,xn--ngstr-lra8j.com,${P}`,
        'DOMAIN,safebrowsing.urlsec.qq.com,DIRECT',
        'DOMAIN,safebrowsing.googleapis.com,DIRECT',
        `DOMAIN,developer.apple.com,${P}`,
        'DOMAIN-SUFFIX,apple.com,DIRECT',
        'DOMAIN-SUFFIX,icloud.com,DIRECT',
        'DOMAIN-KEYWORD,google,' + P,
        'DOMAIN-KEYWORD,youtube,' + P,
        'DOMAIN-KEYWORD,github,' + P,
        'DOMAIN-KEYWORD,twitter,' + P,
        'DOMAIN-KEYWORD,telegram,' + P,
        'IP-CIDR,91.108.4.0/22,' + P + ',no-resolve',
        'DOMAIN-SUFFIX,cn,DIRECT',
        'DOMAIN-KEYWORD,-cn,DIRECT',
        'GEOIP,CN,DIRECT',
        'MATCH,' + P
    ];
}

function generateClashMetaConfig(proxies, options = {}) {
    const {
        httpPort = 7890, allowLan = true,
        mode = 'rule', logLevel = 'info', enableDns = true,
        testUrl = 'http://www.gstatic.com/generate_204', testInterval = 300
    } = options;

    const proxyNames = proxies.map(p => p.name);
    const groupName = '🚀 节点选择';
    const lines = [];

    // ===== 基础配置 =====
    lines.push('name: "xinghe"');
    lines.push('profile-name: "xinghe"');
    lines.push('mixed-port: ' + httpPort);
    lines.push('allow-lan: ' + allowLan);
    lines.push("bind-address: '*'");
    lines.push('mode: ' + mode);
    lines.push('log-level: ' + logLevel);
    lines.push("external-controller: '127.0.0.1:9090'");
    lines.push("find-process-mode: strict");
    lines.push('unified-delay: true');
    lines.push('tcp-concurrent: true');
    lines.push("global-client-fingerprint: chrome");

    // ===== DNS =====
    if (enableDns) {
        lines.push('dns:');
        lines.push('    enable: true');
        lines.push('    ipv6: false');
        lines.push('    default-nameserver: [223.5.5.5, 119.29.29.29, 114.114.114.114]');
        lines.push('    enhanced-mode: fake-ip');
        lines.push('    fake-ip-range: 198.18.0.1/16');
        lines.push('    use-hosts: true');
        lines.push('    respect-rules: true');
        lines.push("    proxy-server-nameserver: [223.5.5.5, 119.29.29.29, 114.114.114.114]");
        lines.push("    nameserver: [223.5.5.5, 119.29.29.29, 114.114.114.114]");
    }

    // ===== Proxies (flow-style) =====
    lines.push('proxies:');
    for (let i = 0; i < proxies.length; i++) {
        lines.push('    - ' + flowObj(proxies[i]));
    }

    // ===== Proxy Groups (flow-style) =====
    const autoGroup = { name: '自动选择', type: 'url-test', proxies: proxyNames, url: testUrl, interval: testInterval };
    const fallbackGroup = { name: '故障转移', type: 'fallback', proxies: proxyNames, url: testUrl, interval: 7200 };
    const selectGroup = { name: groupName, type: 'select', proxies: ['自动选择', '故障转移', ...proxyNames] };

    lines.push('proxy-groups:');
    lines.push('    - ' + flowObj(selectGroup));
    lines.push('    - ' + flowObj(autoGroup));
    lines.push('    - ' + flowObj(fallbackGroup));

    // ===== Rules =====
    lines.push('rules:');
    const metaRules = getClashRules(groupName);
    for (const r of metaRules) {
        lines.push("    - '" + r + "'");
    }

    return lines.join('\n') + '\n';
}

function generateClashConfig(proxies, options = {}) {
    // Generate base clash structure reusing ClashMeta structure but without Meta specific features
    // For simplicity, proxy to clash meta implementation as they share baseline YAML structure
    const config = generateClashMetaConfig(proxies, options);
    // Remove meta specific things using regex if strictly needed, or leave compatible
    return config.replace(/find-process-mode: strict\n/, '').replace(/global-client-fingerprint: chrome\n/, '');
}

// ==================== Surge ====================

function surgeProxyLine(p) {
    const name = p.name;
    switch (p.type) {
        case 'ss':
            return `${name} = ss, ${p.server}, ${p.port}, encrypt-method=${p.cipher}, password=${p.password}`;
        case 'vmess': {
            let line = `${name} = vmess, ${p.server}, ${p.port}, username=${p.uuid}`;
            if (p.tls) line += ', tls=true';
            if (p.network === 'ws') line += `, ws=true, ws-path=${(p['ws-opts'] && p['ws-opts'].path) || '/'}`;
            if (p.servername) line += `, sni=${p.servername}`;
            line += ', skip-cert-verify=true';
            return line;
        }
        case 'vless': {
            let line = `${name} = vless, ${p.server}, ${p.port}, username=${p.uuid}`;
            if (p.tls) line += ', tls=true';
            if (p.network === 'ws') line += `, ws=true, ws-path=${(p['ws-opts'] && p['ws-opts'].path) || '/'}`;
            if (p.servername) line += `, sni=${p.servername}`;
            if (p.flow) line += `, flow=${p.flow}`;
            if (p['client-fingerprint']) line += `, client-fingerprint=${p['client-fingerprint']}`;
            line += ', skip-cert-verify=true';
            return line;
        }
        case 'trojan': {
            let line = `${name} = trojan, ${p.server}, ${p.port}, password=${p.password}`;
            if (p.sni) line += `, sni=${p.sni}`;
            line += ', skip-cert-verify=true';
            if (p.network === 'ws') line += `, ws=true, ws-path=${(p['ws-opts'] && p['ws-opts'].path) || '/'}`;
            return line;
        }
        case 'hysteria2': {
            let line = `${name} = hysteria2, ${p.server}, ${p.port}, password=${p.password}`;
            if (p.sni) line += `, sni=${p.sni}`;
            line += ', skip-cert-verify=true';
            return line;
        }
        case 'tuic': {
            let line = `${name} = tuic, ${p.server}, ${p.port}, token=${p.uuid}`;
            if (p.sni) line += `, sni=${p.sni}`;
            line += ', skip-cert-verify=true';
            return line;
        }
        case 'wireguard': {
            let line = `${name} = wireguard, section-name=${name}`;
            return line;
        }
        case 'socks5': {
            let line = `${name} = socks5, ${p.server}, ${p.port}`;
            if (p.username) line += `, username=${p.username}, password=${p.password}`;
            return line;
        }
        case 'snell': {
            let line = `${name} = snell, ${p.server}, ${p.port}, psk=${p.psk}, version=${p.version}`;
            if (p.obfs) {
                line += `, obfs=${p.obfs}`;
                if (p['obfs-host']) line += `, obfs-host=${p['obfs-host']}`;
            }
            return line;
        }
        default:
            return `# ${name} = ${p.type} (不支持)`;
    }
}

function generateSurgeConfig(proxies, options = {}) {
    let output = '';

    output += '[General]\n';
    output += `loglevel = ${options.logLevel || 'notify'}\n`;
    output += 'skip-proxy = 127.0.0.1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 100.64.0.0/10, localhost, *.local\n';
    output += `internet-test-url = ${options.testUrl || 'http://www.gstatic.com/generate_204'}\n`;
    output += `proxy-test-url = ${options.testUrl || 'http://www.gstatic.com/generate_204'}\n`;
    output += `test-timeout = 5\n`;
    if (options.allowLan) output += `allow-wifi-access = true\n`;
    output += '\n';

    output += '[Proxy]\n';
    output += 'DIRECT = direct\n';
    for (const p of proxies) {
        output += surgeProxyLine(p) + '\n';
    }
    output += '\n';

    const proxyNames = proxies.map(p => p.name);
    output += '[Proxy Group]\n';
    output += `🚀 节点选择 = select, ♻️ 自动选择, DIRECT, ${proxyNames.join(', ')}\n`;
    output += `♻️ 自动选择 = url-test, ${proxyNames.join(', ')}, url=${options.testUrl || 'http://www.gstatic.com/generate_204'}, interval=${options.testInterval || 300}\n`;
    output += '\n';

    output += '[Rule]\n';
    output += 'GEOIP,LAN,DIRECT\n';
    output += 'GEOIP,CN,DIRECT\n';
    output += 'FINAL,🚀 节点选择\n';

    return output;
}

// ==================== Sing-Box ====================

function singboxOutbound(p) {
    const base = { tag: p.name, server: p.server, server_port: p.port };

    switch (p.type) {
        case 'vmess': {
            const ob = { ...base, type: 'vmess', uuid: p.uuid, alter_id: p.alterId || 0, security: p.cipher || 'auto' };
            if (p.tls) {
                ob.tls = { enabled: true, insecure: true };
                if (p.servername) ob.tls.server_name = p.servername;
            }
            if (p.network === 'ws') {
                ob.transport = { type: 'ws', path: (p['ws-opts'] && p['ws-opts'].path) || '/' };
                if (p['ws-opts'] && p['ws-opts'].headers && p['ws-opts'].headers.Host) {
                    ob.transport.headers = { Host: p['ws-opts'].headers.Host };
                }
            }
            if (p.network === 'grpc') {
                ob.transport = { type: 'grpc', service_name: (p['grpc-opts'] && p['grpc-opts']['grpc-service-name']) || '' };
            }
            return ob;
        }
        case 'vless': {
            const ob = { ...base, type: 'vless', uuid: p.uuid };
            if (p.flow) ob.flow = p.flow;
            if (p.tls) {
                ob.tls = { enabled: true, insecure: true };
                if (p.servername) ob.tls.server_name = p.servername;
                if (p['reality-opts']) {
                    ob.tls.reality = {
                        enabled: true,
                        public_key: p['reality-opts']['public-key'] || '',
                        short_id: p['reality-opts']['short-id'] || ''
                    };
                }
                if (p['client-fingerprint']) ob.tls.utls = { enabled: true, fingerprint: p['client-fingerprint'] };
            }
            if (p.network === 'ws') {
                ob.transport = { type: 'ws', path: (p['ws-opts'] && p['ws-opts'].path) || '/' };
            }
            if (p.network === 'grpc') {
                ob.transport = { type: 'grpc', service_name: (p['grpc-opts'] && p['grpc-opts']['grpc-service-name']) || '' };
            }
            return ob;
        }
        case 'ss': {
            return { ...base, type: 'shadowsocks', method: p.cipher, password: p.password };
        }
        case 'trojan': {
            const ob = { ...base, type: 'trojan', password: p.password };
            ob.tls = { enabled: true, insecure: true };
            if (p.sni) ob.tls.server_name = p.sni;
            if (p.network === 'ws') {
                ob.transport = { type: 'ws', path: (p['ws-opts'] && p['ws-opts'].path) || '/' };
            }
            if (p.network === 'grpc') {
                ob.transport = { type: 'grpc', service_name: (p['grpc-opts'] && p['grpc-opts']['grpc-service-name']) || '' };
            }
            return ob;
        }
        case 'hysteria': {
            const ob = { ...base, type: 'hysteria', auth_str: p['auth-str'] || '', up_mbps: parseInt(p.up) || 100, down_mbps: parseInt(p.down) || 100 };
            ob.tls = { enabled: true, insecure: p['skip-cert-verify'] || false };
            if (p.sni) ob.tls.server_name = p.sni;
            if (p.obfs) ob.obfs = p.obfs;
            return ob;
        }
        case 'hysteria2': {
            const ob = { ...base, type: 'hysteria2', password: p.password };
            ob.tls = { enabled: true, insecure: p['skip-cert-verify'] || false };
            if (p.sni) ob.tls.server_name = p.sni;
            if (p.obfs) { ob.obfs = { type: p.obfs, password: p['obfs-password'] || '' }; }
            return ob;
        }
        case 'tuic': {
            const ob = { ...base, type: 'tuic', uuid: p.uuid, password: p.password || '', congestion_control: p['congestion-controller'] || 'bbr' };
            ob.tls = { enabled: true, insecure: p['skip-cert-verify'] || false };
            if (p.sni) ob.tls.server_name = p.sni;
            return ob;
        }
        case 'wireguard': {
            return { ...base, type: 'wireguard', private_key: p['private-key'] || '', peer_public_key: p['public-key'] || '', local_address: [p.ip || '10.0.0.2/32'], mtu: p.mtu || 1420 };
        }
        case 'socks5': {
            const ob = { ...base, type: 'socks5' };
            if (p.username) {
                ob.username = p.username;
                ob.password = p.password || '';
            }
            return ob;
        }
        default:
            return null;
    }
}

function generateSingBoxConfig(proxies, options = {}) {
    const outbounds = [];

    for (const p of proxies) {
        const ob = singboxOutbound(p);
        if (ob) outbounds.push(ob);
    }

    const tags = outbounds.map(o => o.tag);

    outbounds.unshift({
        type: 'selector',
        tag: '🚀 节点选择',
        outbounds: ['♻️ 自动选择', 'direct', ...tags],
        default: '♻️ 自动选择'
    });

    outbounds.splice(1, 0, {
        type: 'urltest',
        tag: '♻️ 自动选择',
        outbounds: tags,
        url: options.testUrl || 'http://www.gstatic.com/generate_204',
        interval: (options.testInterval || 300) + 's'
    });

    outbounds.push({ type: 'direct', tag: 'direct' });
    outbounds.push({ type: 'block', tag: 'block' });
    outbounds.push({ type: 'dns', tag: 'dns-out' });

    const config = {
        log: { level: options.logLevel || 'info', timestamp: true },
        dns: {
            servers: [
                { tag: 'google', address: 'https://dns.google/dns-query', detour: '🚀 节点选择' },
                { tag: 'local', address: '223.5.5.5', detour: 'direct' }
            ],
            rules: [
                { geosite: 'cn', server: 'local' }
            ]
        },
        inbounds: [
            { type: 'mixed', tag: 'mixed-in', listen: '::', listen_port: options.httpPort || 7890 }
        ],
        outbounds: outbounds,
        route: {
            rules: [
                { geoip: ['private', 'cn'], outbound: 'direct' },
                { geosite: ['cn'], outbound: 'direct' }
            ],
            final: '🚀 节点选择',
            auto_detect_interface: true
        }
    };

    return JSON.stringify(config, null, 2);
}

// ==================== 原生与订阅链接生成 ====================

function generateRawLinks(proxies) {
    return proxies.map(p => encodeProxy(p)).filter(Boolean).join('\n');
}

function generateBase64Sub(proxies) {
    const raw = generateRawLinks(proxies);
    return b64Encode(raw);
}

// ==================== 统一收口 ====================

const OUTPUT_FORMATS = {
    'clash-yaml': {
        name: 'Clash YAML',
        ext: '.yaml',
        mime: 'text/yaml',
        generate: generateClashConfig
    },
    'clash-meta': {
        name: 'Clash Meta',
        ext: '.yaml',
        mime: 'text/yaml',
        generate: generateClashMetaConfig
    },
    surge: {
        name: 'Surge',
        ext: '.conf',
        mime: 'text/plain',
        generate: generateSurgeConfig
    },
    'sing-box': {
        name: 'Sing-Box',
        ext: '.json',
        mime: 'application/json',
        generate: generateSingBoxConfig
    },
    base64: {
        name: 'Base64 订阅',
        ext: '.txt',
        mime: 'text/plain',
        generate: generateBase64Sub
    },
    raw: {
        name: '原始链接',
        ext: '.txt',
        mime: 'text/plain',
        generate: generateRawLinks
    }
};

module.exports = {
    OUTPUT_FORMATS,
    generateClashConfig,
    generateClashMetaConfig,
    generateSurgeConfig,
    generateSingBoxConfig,
    generateBase64Sub,
    generateRawLinks
};
