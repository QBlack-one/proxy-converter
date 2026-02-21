/**
 * 代理订阅转换器 - 主应用逻辑
 * 功能: 转换、筛选搜索、去重、拖拽上传、配置面板、多格式输出、订阅链接
 */

// ==================== 全局状态 ====================

let allProxies = [];
let filteredProxies = [];
let currentOutput = '';
let currentFormat = 'clash-yaml';
let activeFilters = new Set();

// API 密钥（从 localStorage 读取）
let apiKey = localStorage.getItem('apiKey') || '';

// 获取带认证的 fetch 选项
function getFetchOptions(options = {}) {
    const headers = options.headers || {};
    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }
    return { ...options, headers, mode: 'cors' };
}

// ==================== 转换入口 ====================

function convert() {
    const input = document.getElementById('inputArea').value.trim();
    if (!input) {
        showToast('请先输入代理链接或订阅内容', 'error');
        return;
    }

    const btn = document.getElementById('btnConvert');
    btn.textContent = '⏳ 解析中...';
    btn.disabled = true;

    setTimeout(() => {
        try {
            const links = extractLinks(input);
            allProxies = [];
            let failCount = 0;

            for (const link of links) {
                const node = parseLink(link);
                if (node) {
                    allProxies.push(node);
                } else if (link.includes('://')) {
                    failCount++;
                }
            }

            if (allProxies.length === 0) {
                showToast('未能解析出任何有效节点', 'error');
                btn.textContent = '🔄 转换';
                btn.disabled = false;
                return;
            }

            if (document.getElementById('cfgDedupe').checked) {
                const before = allProxies.length;
                allProxies = deduplicateProxies(allProxies);
                const removed = before - allProxies.length;
                if (removed > 0) showToast(`已去除 ${removed} 个重复节点`, 'warning');
            }

            activeFilters.clear();
            filteredProxies = [...allProxies];

            renderAll();
            document.getElementById('resultsSection').classList.remove('hidden');
            document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
            showToast(`✅ 成功解析 ${allProxies.length} 个节点` + (failCount ? `，${failCount} 个失败` : ''), 'success');
        } catch (e) {
            showToast('解析出错: ' + e.message, 'error');
        } finally {
            btn.textContent = '🔄 转换';
            btn.disabled = false;
        }
    }, 50);
}

// ==================== 去重 ====================

function deduplicateProxies(proxies) {
    const seen = new Set();
    return proxies.filter(p => {
        const key = `${p.type}|${p.server}|${p.port}|${p.uuid || p.password || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// ==================== 渲染全部 ====================

function renderAll() {
    renderStats();
    renderFilterChips();
    applyFilter();
}

// ==================== 统计 ====================

function renderStats() {
    const stats = {};
    allProxies.forEach(p => {
        const t = p.type.toUpperCase();
        stats[t] = (stats[t] || 0) + 1;
    });

    const row = document.getElementById('statsRow');
    const typeColors = {
        VMESS: '#818cf8', VLESS: '#34d399', SS: '#60a5fa',
        SSR: '#f472b6', TROJAN: '#fbbf24', HYSTERIA: '#fb923c',
        HYSTERIA2: '#c4b5fd', TUIC: '#2dd4bf', WIREGUARD: '#a3e635'
    };

    let html = `<div class="stat-chip"><span>总计</span><span class="count">${allProxies.length}</span></div>`;
    for (const [type, count] of Object.entries(stats)) {
        html += `<div class="stat-chip"><span style="color:${typeColors[type] || '#fff'}">${type}</span><span class="count">${count}</span></div>`;
    }
    row.innerHTML = html;
}

// ==================== 协议筛选 ====================

function renderFilterChips() {
    const stats = {};
    allProxies.forEach(p => { stats[p.type] = (stats[p.type] || 0) + 1; });

    const container = document.getElementById('filterChips');
    let html = '';
    for (const [type, count] of Object.entries(stats)) {
        const isActive = activeFilters.has(type);
        html += `<span class="filter-chip ${isActive ? 'active' : ''}" onclick="toggleFilter('${type}')">${type.toUpperCase()} <span class="chip-count">${count}</span></span>`;
    }
    container.innerHTML = html;
}

function toggleFilter(type) {
    activeFilters.has(type) ? activeFilters.delete(type) : activeFilters.add(type);
    renderFilterChips();
    applyFilter();
}

// ==================== 搜索 & 过滤 ====================

function applyFilter() {
    const query = (document.getElementById('searchInput').value || '').toLowerCase().trim();
    filteredProxies = allProxies.filter(p => {
        if (activeFilters.size > 0 && !activeFilters.has(p.type)) return false;
        if (query) {
            const s = `${p.name} ${p.server} ${p.type} ${p.uuid || ''} ${p.cipher || ''}`.toLowerCase();
            if (!s.includes(query)) return false;
        }
        return true;
    });
    renderNodes(filteredProxies);
    renderOutput(filteredProxies);
}

// ==================== 节点列表渲染 ====================

function renderNodes(proxies) {
    const grid = document.getElementById('nodeGrid');
    document.getElementById('nodeCount').textContent = `${proxies.length} / ${allProxies.length} 个节点`;

    if (proxies.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔍</div><p>没有匹配的节点</p></div>`;
        return;
    }

    grid.innerHTML = proxies.map(p => {
        const typeCls = `type-${p.type}`;
        const cardCls = `type-${p.type}-card`;
        const infos = [`<div class="node-info-item"><span class="label">服务器</span><span class="value">${esc(p.server)}:${p.port}</span></div>`];
        if (p.uuid) infos.push(`<div class="node-info-item"><span class="label">UUID</span><span class="value">${esc(p.uuid)}</span></div>`);
        if (p.cipher) infos.push(`<div class="node-info-item"><span class="label">加密</span><span class="value">${esc(p.cipher)}</span></div>`);
        if (p.network && p.network !== 'tcp') infos.push(`<div class="node-info-item"><span class="label">传输</span><span class="value">${esc(p.network)}</span></div>`);
        if (p.protocol) infos.push(`<div class="node-info-item"><span class="label">协议</span><span class="value">${esc(p.protocol)}</span></div>`);
        if (p.password) infos.push(`<div class="node-info-item"><span class="label">密码</span><span class="value">${esc(p.password.length > 20 ? p.password.substring(0, 20) + '...' : p.password)}</span></div>`);
        if (p.tls) infos.push(`<div class="node-info-item"><span class="label">TLS</span><span class="value" style="color:var(--success)">✓ 启用</span></div>`);
        return `<div class="node-card ${cardCls}"><div class="node-header"><span class="node-name" title="${esc(p.name)}">${esc(p.name)}</span><span class="node-type ${typeCls}">${p.type}</span></div><div class="node-info">${infos.join('')}</div></div>`;
    }).join('');
}

function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// ==================== 多格式输出 ====================

function switchFormat(format) {
    currentFormat = format;
    // 更新 tab 样式
    document.querySelectorAll('.format-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.format === format);
    });
    if (filteredProxies.length > 0) renderOutput(filteredProxies);
}

function renderOutput(proxies) {
    const fmt = OUTPUT_FORMATS[currentFormat];
    if (!fmt) return;

    const options = getConfigOptions();
    currentOutput = fmt.generate(proxies, options);
    document.getElementById('outputPreview').textContent = currentOutput;

    // 更新下载按钮文案
    const dlBtn = document.getElementById('btnDownload');
    dlBtn.textContent = `💾 下载 ${fmt.name} (${fmt.ext})`;

    // 更新订阅链接区域
    renderSubscription(proxies);
}

function renderSubscription(proxies) {
    const subContent = generateBase64Sub(proxies);
    document.getElementById('subBase64').value = subContent;
    const rawLinks = generateRawLinks(proxies);
    document.getElementById('subLinkCount').textContent = `${rawLinks.split('\n').filter(l => l).length} 条链接`;
}

function getConfigOptions() {
    return {
        httpPort: parseInt(document.getElementById('cfgHttpPort').value) || 7890,
        socksPort: parseInt(document.getElementById('cfgSocksPort').value) || 7891,
        allowLan: document.getElementById('cfgAllowLan').value === 'true',
        mode: document.getElementById('cfgMode').value,
        logLevel: document.getElementById('cfgLogLevel').value,
        enableDns: document.getElementById('cfgDns').value === 'true',
        testUrl: 'http://www.gstatic.com/generate_204',
        testInterval: parseInt(document.getElementById('cfgInterval').value) || 300
    };
}

// ==================== 操作函数 ====================

function downloadConfig() {
    if (!currentOutput) return;
    const fmt = OUTPUT_FORMATS[currentFormat];
    const blob = new Blob([currentOutput], { type: fmt.mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `config${fmt.ext}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`💾 ${fmt.name} 配置已下载`, 'success');
}

function copyConfig() {
    if (!currentOutput) return;
    writeClipboard(currentOutput);
    showToast('📋 配置已复制到剪贴板', 'success');
}

function copySubscription() {
    const subContent = document.getElementById('subBase64').value;
    if (!subContent) return;
    writeClipboard(subContent);
    showToast('📋 订阅内容已复制', 'success');
}

function copyRawLinks() {
    if (filteredProxies.length === 0) return;
    const raw = generateRawLinks(filteredProxies);
    writeClipboard(raw);
    showToast('📋 原始链接已复制', 'success');
}

function writeClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
    });
}

async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('inputArea').value = text;
        showToast('📎 已从剪贴板粘贴', 'info');
    } catch { showToast('无法读取剪贴板，请手动粘贴 (Ctrl+V)', 'error'); }
}

function clearAll() {
    document.getElementById('inputArea').value = '';
    document.getElementById('resultsSection').classList.add('hidden');
    document.getElementById('searchInput').value = '';
    allProxies = [];
    filteredProxies = [];
    activeFilters.clear();
    currentOutput = '';
    showToast('🗑️ 已清空', 'info');
}

function loadSample() {
    const sample = [
        'vmess://ew0KICAidiI6ICIyIiwNCiAgInBzIjogIuWPsOa5viBDTE9VRCIsDQogICJhZGQiOiAid3d3LmV4YW1wbGUuY29tIiwNCiAgInBvcnQiOiAiNDQzIiwNCiAgImlkIjogImUzYjBiNDQyLTAxMjMtNDU2Ny04OWFiLWNkZWYwMTIzNDU2NyIsDQogICJhaWQiOiAiMCIsDQogICJuZXQiOiAid3MiLA0KICAidHlwZSI6ICJub25lIiwNCiAgImhvc3QiOiAid3d3LmV4YW1wbGUuY29tIiwNCiAgInBhdGgiOiAiLyIsDQogICJ0bHMiOiAidGxzIg0KfQ==',
        'ss://YWVzLTI1Ni1nY206cGFzc3dvcmRAMS4xLjEuMTo4ODg4#My_SS_Node',
        'trojan://password123@trojan.example.com:443?sni=trojan.example.com#美国-Trojan',
        'vless://e3b0b442-0123-4567-89ab-cdef01234567@vless.example.com:443?type=ws&security=tls&path=%2Fws&sni=vless.example.com#日本-VLESS',
        'hysteria2://mypassword@hy2.example.com:443?sni=hy2.example.com&insecure=1#香港-Hysteria2',
        'hysteria://hk.example.com:443?auth=myauth&upmbps=50&downmbps=100&peer=hk.example.com&insecure=1&protocol=udp#韩国-Hysteria',
        'tuic://e3b0b442-0123-4567-89ab-cdef01234567:mypassword@tuic.example.com:443?sni=tuic.example.com&congestion_control=bbr&udp_relay_mode=native&allow_insecure=1#法国-TUIC',
        'wireguard://wg.example.com:51820?publickey=BNVhTpfMiKs%3D&privatekey=YWJjZGVmZw%3D%3D&address=10.0.0.2&mtu=1420#瑞士-WireGuard',
        'vless://abcd1234-5678-90ab-cdef-112233445566@reality.example.com:443?type=tcp&security=reality&pbk=publickey123&sid=shortid&sni=www.microsoft.com&fp=chrome&flow=xtls-rprx-vision#德国-VLESS-Reality'
    ];
    document.getElementById('inputArea').value = sample.join('\n');
    showToast('📦 已加载示例数据（9 个节点，全部 9 种协议）', 'info');
}

// ==================== 拖拽上传 ====================

function initDragDrop() {
    const wrapper = document.getElementById('inputWrapper');
    const overlay = document.getElementById('dropOverlay');
    const textarea = document.getElementById('inputArea');
    let dragCounter = 0;

    wrapper.addEventListener('dragenter', (e) => { e.preventDefault(); dragCounter++; overlay.classList.add('active'); });
    wrapper.addEventListener('dragleave', (e) => { e.preventDefault(); dragCounter--; if (dragCounter === 0) overlay.classList.remove('active'); });
    wrapper.addEventListener('dragover', (e) => e.preventDefault());
    wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        dragCounter = 0;
        overlay.classList.remove('active');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.size > 5 * 1024 * 1024) { showToast('文件过大（最大 5MB）', 'error'); return; }
            const reader = new FileReader();
            reader.onload = (ev) => { textarea.value = ev.target.result; showToast(`📄 已加载文件: ${file.name}`, 'success'); };
            reader.readAsText(file);
        }
    });
}

// ==================== Toast ====================

function showToast(msg, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}

// ==================== 快捷键 & 搜索防抖 ====================

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); convert(); }
});

let searchTimeout = null;
function onSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { if (allProxies.length > 0) applyFilter(); }, 200);
}

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
    initDragDrop();
    // 初始化 format tabs
    document.querySelectorAll('.format-tab').forEach(tab => {
        tab.addEventListener('click', () => switchFormat(tab.dataset.format));
    });
    // 检测订阅服务状态
    checkServerStatus();
});

// ==================== 订阅服务 ====================

const SUB_SERVER = window.location.origin;

function checkServerStatus() {
    const el = document.getElementById('serverStatus');
    const statsEl = document.getElementById('subInfoStats');
    if (!el) return;

    fetch(SUB_SERVER + '/api/info', { mode: 'cors' })
        .then(r => r.json())
        .then(info => {
            el.textContent = info.nodeCount > 0
                ? `● 已运行 (${info.nodeCount} 节点)`
                : '● 已运行';
            el.className = 'server-status online';

            // 显示订阅信息统计
            if (statsEl && info.subscription) {
                displaySubscriptionInfo(info.subscription, statsEl);
            }

            // 加载历史记录
            loadHistory();
        })
        .catch(() => {
            el.textContent = '● 未启动';
            el.className = 'server-status offline';
            if (statsEl) statsEl.style.display = 'none';
        });
}

function displaySubscriptionInfo(subInfo, container) {
    const items = [];

    // 流量信息
    if (subInfo.traffic) {
        const t = subInfo.traffic;
        const isUnlimited = t.total === 0;
        const percent = isUnlimited ? 0 : (t.percent || 0);

        items.push(`
            <div class="sub-info-item">
                <div class="sub-info-label">📊 流量使用</div>
                <div class="sub-info-value">${t.usedFormatted} / ${t.totalFormatted}</div>
                <div class="sub-info-extra">${isUnlimited ? '无限流量' : percent + '% 已使用'}</div>
                ${isUnlimited ? '' : `<div class="traffic-bar"><div class="traffic-bar-fill ${percent >= 90 ? 'danger' : percent >= 75 ? 'warning' : ''}" style="width: ${Math.min(percent, 100)}%"></div></div>`}
            </div>
        `);

        items.push(`
            <div class="sub-info-item">
                <div class="sub-info-label">⬆️ 上传</div>
                <div class="sub-info-value">${t.uploadFormatted}</div>
            </div>
        `);

        items.push(`
            <div class="sub-info-item">
                <div class="sub-info-label">⬇️ 下载</div>
                <div class="sub-info-value">${t.downloadFormatted}</div>
            </div>
        `);
    }

    // 到期时间
    if (subInfo.expire) {
        items.push(`
            <div class="sub-info-item">
                <div class="sub-info-label">⏰ 到期时间</div>
                <div class="sub-info-value">${subInfo.expire}</div>
            </div>
        `);
    }

    if (items.length > 0) {
        container.innerHTML = items.join('');
        container.style.display = 'grid';
    } else {
        container.style.display = 'none';
    }
}

function saveToSubService() {
    if (filteredProxies.length === 0) {
        showToast('请先粘贴代理链接并转换', 'error');
        return;
    }

    const btn = document.getElementById('btnSaveSub');
    const status = document.getElementById('saveStatus');
    btn.disabled = true;
    btn.textContent = '⏳ 保存中...';

    // 生成原始链接并发送到服务器
    const rawLinks = generateRawLinks(filteredProxies);

    fetch(SUB_SERVER + '/api/save', getFetchOptions({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: rawLinks })
    }))
        .then(async r => {
            const data = await r.json();
            if (!r.ok || data.error) throw new Error(data.error || 'HTTP ' + r.status);
            return data;
        })
        .then(data => {
            if (data.error) throw new Error(data.error);

            // 显示订阅 URL 列表
            const grid = document.getElementById('subUrlGrid');
            const formatLabels = {
                'universal': { name: '通用订阅', icon: '🌐', desc: '自动识别客户端（推荐）' },
                'base64': { name: 'Base64 订阅', icon: '⚔️', desc: 'Base64 编码' },
                'clash-yaml': { name: 'Clash YAML', icon: '📄', desc: 'Clash 完整配置' },
                'clash-meta': { name: 'Clash Meta', icon: '🌀', desc: 'Mihomo / Verge Rev' },
                'surge': { name: 'Surge', icon: '🌊', desc: 'Surge iOS/macOS' },
                'sing-box': { name: 'Sing-Box', icon: '📦', desc: 'Sing-Box / NekoBox' },
                'raw': { name: '原始链接', icon: '📋', desc: '通用' }
            };

            grid.innerHTML = Object.entries(data.subUrls).map(([fmt, url]) => {
                const label = formatLabels[fmt] || { name: fmt, icon: '🔗', desc: '' };
                return `<div class="sub-url-item" onclick="copyUrl('${url}')" title="点击复制">
        <span class="sub-url-icon">${label.icon}</span>
        <div class="sub-url-info">
          <span class="sub-url-name">${label.name}</span>
          <span class="sub-url-desc">${label.desc}</span>
        </div>
        <code class="sub-url-link">${url}</code>
        <span class="sub-url-copy">📋</span>
      </div>`;
            }).join('');

            document.getElementById('subUrlList').style.display = 'block';
            const newInfo = data.newCount ? `（本次新增 ${data.newCount}，` : '（';
            status.textContent = `✅ 订阅共 ${data.count} 个节点 ${newInfo}已去重合并）`;
            status.style.color = 'var(--success)';
            showToast(`✅ ${data.count} 个节点已保存到订阅服务`, 'success');
            checkServerStatus();
        })
        .catch(e => {
            status.textContent = '❌ ' + e.message;
            status.style.color = 'var(--danger)';
            showToast('❌ 保存失败: ' + e.message + '（请确认 node server.js 已启动）', 'error');
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = '💾 保存当前节点到订阅服务';
        });
}

function copyUrl(url) {
    writeClipboard(url);
    showToast('📋 已复制: ' + url, 'success');
}

// ==================== 客户端一键导入 ====================

function importToClient(client) {
    if (filteredProxies.length === 0) {
        showToast('请先转换节点', 'error');
        return;
    }

    const options = getConfigOptions();
    const rawLinks = generateRawLinks(filteredProxies);
    const b64Sub = generateBase64Sub(filteredProxies);

    switch (client) {
        case 'clash': {
            // Clash for Windows / Clash Verge - 下载 YAML + 尝试 URL scheme
            const yaml = generateClashConfig(filteredProxies, options);
            const dataUri = 'data:application/yaml;base64,' + b64Encode(yaml);
            const schemeUrl = 'clash://install-config?url=' + encodeURIComponent(dataUri);

            // 尝试 URL scheme，同时下载文件
            downloadBlob(yaml, 'clash_config.yaml', 'text/yaml');
            tryOpenScheme(schemeUrl);
            showToast('📥 Clash YAML 配置已下载，如已安装客户端将自动导入', 'success');
            showQRForData(schemeUrl, 'Clash', '使用 Clash 客户端扫码导入');
            break;
        }
        case 'clash-meta': {
            const yaml = generateClashMetaConfig(filteredProxies, options);
            const dataUri = 'data:application/yaml;base64,' + b64Encode(yaml);
            const schemeUrl = 'clash://install-config?url=' + encodeURIComponent(dataUri);

            downloadBlob(yaml, 'mihomo_config.yaml', 'text/yaml');
            tryOpenScheme(schemeUrl);
            showToast('📥 Clash Meta 配置已下载', 'success');
            showQRForData(schemeUrl, 'Clash Meta', '使用 Mihomo / Clash Verge Rev 扫码导入');
            break;
        }
        case 'shadowrocket': {
            // Shadowrocket sub:// scheme = base64(subscription_url or content)
            // Shadowrocket 也支持直接导入 Base64 订阅
            const subScheme = 'sub://' + b64Sub;
            writeClipboard(subScheme);
            tryOpenScheme(subScheme);
            showToast('🚀 Shadowrocket 订阅链接已复制，如已安装将自动打开', 'success');
            showQRForData(subScheme, 'Shadowrocket', '使用 Shadowrocket 扫码添加订阅');
            break;
        }
        case 'v2rayn': {
            // V2RayN/NG - 复制 Base64 订阅内容到剪贴板，用户在客户端粘贴
            writeClipboard(b64Sub);
            showToast('📋 Base64 订阅已复制！在 V2RayN 中：订阅 → 导入 → 粘贴', 'success');
            // 也尝试 V2RayNG scheme
            showQRForData(rawLinks.split('\n')[0] || '', 'V2RayN/NG', '使用 V2RayNG 逐个扫码添加，或在客户端中粘贴 Base64 订阅');
            break;
        }
        case 'surge': {
            const conf = generateSurgeConfig(filteredProxies, options);
            downloadBlob(conf, 'surge_config.conf', 'text/plain');
            showToast('📥 Surge 配置已下载，在 Surge 中导入即可', 'success');
            break;
        }
        case 'singbox': {
            const json = generateSingBoxConfig(filteredProxies, options);
            downloadBlob(json, 'singbox_config.json', 'application/json');
            showToast('📥 Sing-Box 配置已下载', 'success');
            break;
        }
        case 'quantumultx': {
            // Quantumult X - 生成节点列表（vmess=, trojan= 等格式）
            const qxNodes = generateQXNodes(filteredProxies);
            writeClipboard(qxNodes);
            showToast('📋 Quantumult X 节点已复制！在 QX 中粘贴到 [server_local] 段', 'success');
            break;
        }
        case 'raw-clipboard': {
            writeClipboard(rawLinks);
            showToast('📋 原始链接已复制到剪贴板（' + filteredProxies.length + ' 条）', 'success');
            break;
        }
    }
}

// ==================== Quantumult X 节点格式 ====================

function generateQXNodes(proxies) {
    return proxies.map(p => {
        switch (p.type) {
            case 'vmess': {
                let line = `vmess=${p.server}:${p.port}, method=${p.cipher || 'auto'}, password=${p.uuid}`;
                if (p.tls) line += ', over-tls=true, tls-verification=false';
                if (p['ws-opts']) line += `, obfs=ws, obfs-host=${(p['ws-opts'].headers && p['ws-opts'].headers.Host) || ''}, obfs-uri=${p['ws-opts'].path || '/'}`;
                line += `, tag=${p.name}`;
                return line;
            }
            case 'trojan':
                return `trojan=${p.server}:${p.port}, password=${p.password}, over-tls=true, tls-verification=false${p.sni ? ', tls-host=' + p.sni : ''}, tag=${p.name}`;
            case 'ss':
                return `shadowsocks=${p.server}:${p.port}, method=${p.cipher}, password=${p.password}, tag=${p.name}`;
            default:
                return `# ${p.name} (${p.type} 不支持 QX 格式)`;
        }
    }).join('\n');
}

// ==================== URL Scheme 打开 ====================

function tryOpenScheme(url) {
    const a = document.createElement('a');
    a.href = url;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
}

function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ==================== QR 码 ====================

function showQRForData(data, clientName, tip) {
    const section = document.getElementById('qrSection');
    const canvas = document.getElementById('qrCanvas');
    const nameEl = document.getElementById('qrClientName');
    const tipEl = document.getElementById('qrTip');

    nameEl.textContent = clientName;
    tipEl.textContent = tip;
    canvas.innerHTML = '';

    // 数据太长时截断或提示
    if (data.length > 2953) {
        // QR 码最大容量约 2953 字节 (版本 40, L 纠错)
        canvas.innerHTML = '<p style="color:var(--warning);padding:20px;text-align:center">⚠️ 数据过长无法生成 QR 码<br><small>请使用复制功能手动导入</small></p>';
        section.style.display = 'block';
        return;
    }

    try {
        if (typeof qrcode === 'undefined') {
            canvas.innerHTML = '<p style="color:var(--text-muted);padding:20px;text-align:center">QR 码库加载中...</p>';
            section.style.display = 'block';
            return;
        }

        // 自动选择合适的 version
        let qr;
        for (let typeNum = 10; typeNum <= 40; typeNum++) {
            try {
                qr = qrcode(typeNum, 'L');
                qr.addData(data);
                qr.make();
                break;
            } catch (e) {
                qr = null;
            }
        }

        if (!qr) {
            canvas.innerHTML = '<p style="color:var(--warning);padding:20px;text-align:center">⚠️ 无法生成 QR 码</p>';
            section.style.display = 'block';
            return;
        }

        const img = document.createElement('img');
        img.src = qr.createDataURL(4, 8);
        img.style.width = '200px';
        img.style.height = '200px';
        img.style.borderRadius = '12px';
        img.style.imageRendering = 'pixelated';
        canvas.appendChild(img);
    } catch (e) {
        canvas.innerHTML = '<p style="color:var(--danger);padding:20px;text-align:center">QR 码生成失败</p>';
    }

    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showQR(type) {
    if (filteredProxies.length === 0) return;
    if (type === 'sub') {
        const b64 = generateBase64Sub(filteredProxies);
        showQRForData(b64, '通用订阅', '使用支持订阅的客户端扫码导入');
    }
}

function closeQR() {
    document.getElementById('qrSection').style.display = 'none';
}

// ==================== 订阅信息管理 ====================

function saveApiKey() {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (key) {
        localStorage.setItem('apiKey', key);
        apiKey = key;
        showToast('✅ API 密钥已保存到本地', 'success');
    } else {
        localStorage.removeItem('apiKey');
        apiKey = '';
        showToast('✅ API 密钥已清除', 'success');
    }
}

function toggleSubManage() {
    const card = document.getElementById('subManageCard');
    if (card.style.display === 'none' || !card.style.display) {
        card.style.display = 'block';
        loadSubConfig();
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        card.style.display = 'none';
    }
}

function toggleTrafficInputs() {
    const enabled = document.getElementById('subTrafficEnabled').value === 'true';
    const groups = ['trafficUploadGroup', 'trafficDownloadGroup', 'trafficTotalGroup', 'trafficResetGroup'];
    groups.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = enabled ? 'block' : 'none';
    });
}

function loadSubConfig() {
    fetch(SUB_SERVER + '/api/subscription', getFetchOptions())
        .then(r => r.json())
        .then(data => {
            if (!data.success || !data.subscription) {
                showToast('加载配置失败', 'error');
                return;
            }

            const sub = data.subscription;

            // 基本信息
            document.getElementById('subTitle').value = sub.title || '';
            document.getElementById('subUpdateInterval').value = sub.updateInterval || 24;

            // 流量配置
            if (sub.traffic) {
                document.getElementById('subTrafficEnabled').value = sub.traffic.enabled ? 'true' : 'false';
                document.getElementById('subTrafficUpload').value = (sub.traffic.upload / 1073741824).toFixed(2); // 字节转GB
                document.getElementById('subTrafficDownload').value = (sub.traffic.download / 1073741824).toFixed(2);
                document.getElementById('subTrafficTotal').value = (sub.traffic.total / 1073741824).toFixed(0);
                document.getElementById('subTrafficResetDay').value = sub.traffic.resetDay || 1;
            }

            toggleTrafficInputs();
            showToast('配置已加载', 'success');
        })
        .catch(e => {
            showToast('加载配置失败: ' + e.message, 'error');
        });
}

function saveSubConfig() {
    const config = {
        title: document.getElementById('subTitle').value,
        updateInterval: parseInt(document.getElementById('subUpdateInterval').value),
        traffic: {
            enabled: document.getElementById('subTrafficEnabled').value === 'true',
            upload: Math.round(parseFloat(document.getElementById('subTrafficUpload').value) * 1073741824), // GB转字节
            download: Math.round(parseFloat(document.getElementById('subTrafficDownload').value) * 1073741824),
            total: Math.round(parseFloat(document.getElementById('subTrafficTotal').value) * 1073741824),
            resetDay: parseInt(document.getElementById('subTrafficResetDay').value)
        }
    };

    fetch(SUB_SERVER + '/api/subscription', getFetchOptions({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    }))
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showToast('✅ 配置已保存', 'success');
                checkServerStatus(); // 刷新显示
            } else {
                throw new Error(data.error || '保存失败');
            }
        })
        .catch(e => {
            showToast('❌ 保存失败: ' + e.message, 'error');
        });
}

function resetTraffic() {
    if (!confirm('确定要重置流量统计吗？上传和下载流量将归零。')) {
        return;
    }

    fetch(SUB_SERVER + '/api/subscription/reset-traffic', getFetchOptions({
        method: 'POST'
    }))
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showToast('✅ 流量已重置', 'success');
                loadSubConfig(); // 重新加载配置
                checkServerStatus(); // 刷新显示
            } else {
                throw new Error(data.error || '重置失败');
            }
        })
        .catch(e => {
            showToast('❌ 重置失败: ' + e.message, 'error');
        });
}

// ==================== 上传历史记录 ====================

function loadHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;

    fetch(SUB_SERVER + '/api/history', { mode: 'cors' })
        .then(r => r.json())
        .then(data => {
            if (!data.success || !data.history || data.history.length === 0) {
                container.innerHTML = '<div class="empty-state" style="padding: 20px; text-align: center; color: var(--text-muted);">暂无上传记录</div>';
                return;
            }

            container.innerHTML = data.history.map((item, index) => {
                const time = new Date(item.timestamp).toLocaleString('zh-CN');
                const nodesPreview = item.nodes.slice(0, 5).map(n => esc(n)).join('、');
                const moreCount = item.nodes.length > 5 ? `... 等 ${item.nodes.length} 个` : '';
                return `<div class="history-item">
                    <div class="history-header">
                        <span class="history-time">📅 ${time}</span>
                        <span class="history-count">${item.nodeCount} 个节点</span>
                    </div>
                    <div class="history-nodes">${nodesPreview}${moreCount}</div>
                </div>`;
            }).join('');
        })
        .catch(() => {
            container.innerHTML = '<div class="empty-state" style="padding: 20px; text-align: center; color: var(--text-muted);">加载失败</div>';
        });
}

function clearHistory() {
    if (!confirm('确定要清空所有上传历史记录吗？')) return;

    fetch(SUB_SERVER + '/api/history', getFetchOptions({
        method: 'DELETE'
    }))
        .then(async r => {
            const data = await r.json();
            if (!r.ok || data.error) throw new Error(data.error || 'HTTP ' + r.status);
            return data;
        })
        .then(data => {
            showToast('✅ 历史记录已清空', 'success');
            loadHistory();
        })
        .catch(e => showToast('❌ 清空失败: ' + e.message, 'error'));
}

// ==================== 清空所有节点 ====================

function clearAllNodes() {
    if (!confirm('⚠️ 确定要清空订阅中的所有节点吗？此操作不可恢复！')) return;

    fetch(SUB_SERVER + '/api/links', getFetchOptions({
        method: 'DELETE'
    }))
        .then(async r => {
            const data = await r.json();
            if (!r.ok || data.error) throw new Error(data.error || 'HTTP ' + r.status);
            return data;
        })
        .then(data => {
            showToast('✅ 所有节点已清空', 'success');
            checkServerStatus();
        })
        .catch(e => showToast('❌ 清空失败: ' + e.message, 'error'));
}

// ==================== 节点管理 ====================

function toggleNodeManage() {
    const panel = document.getElementById('nodeManagePanel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        loadNodeList();
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        panel.style.display = 'none';
    }
}

function loadNodeList() {
    const container = document.getElementById('nodeManageList');
    const countEl = document.getElementById('nodeManageCount');
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">加载中...</div>';

    fetch(SUB_SERVER + '/api/nodes', { mode: 'cors' })
        .then(async r => {
            const data = await r.json();
            if (!r.ok || data.error) throw new Error(data.error || 'HTTP ' + r.status);
            return data;
        })
        .then(data => {
            countEl.textContent = `共 ${data.count} 个节点`;
            if (!data.nodes || data.nodes.length === 0) {
                container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">暂无节点</div>';
                return;
            }

            const typeColors = {
                VMESS: '#818cf8', VLESS: '#34d399', SS: '#60a5fa',
                SSR: '#f472b6', TROJAN: '#fbbf24', HYSTERIA: '#fb923c',
                HYSTERIA2: '#c4b5fd', TUIC: '#2dd4bf', WIREGUARD: '#a3e635', HY2: '#c4b5fd', WG: '#a3e635'
            };

            container.innerHTML = data.nodes.map(node => {
                const color = typeColors[node.type] || '#94a3b8';
                return `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:13px">
                    <span style="min-width:24px;color:var(--text-muted);font-size:11px">#${node.index}</span>
                    <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;color:${color};background:${color}22">${node.type}</span>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(node.link)}">${esc(node.name)}</span>
                    <button onclick="deleteNode(${node.index})" style="background:rgba(239,68,68,0.1);color:#ef4444;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap"
                        onmouseover="this.style.background='rgba(239,68,68,0.25)'" onmouseout="this.style.background='rgba(239,68,68,0.1)'">✕ 删除</button>
                </div>`;
            }).join('');
        })
        .catch(e => {
            container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--danger)">加载失败: ${e.message}</div>`;
        });
}

function deleteNode(index) {
    if (!confirm(`确定要删除节点 #${index} 吗？`)) return;

    fetch(SUB_SERVER + `/api/nodes?index=${index}`, getFetchOptions({ method: 'DELETE' }))
        .then(async r => {
            const data = await r.json();
            if (!r.ok || data.error) throw new Error(data.error || 'HTTP ' + r.status);
            return data;
        })
        .then(data => {
            showToast(`✅ 已删除，剩余 ${data.remaining} 个节点`, 'success');
            loadNodeList();
            checkServerStatus();
        })
        .catch(e => showToast('❌ 删除失败: ' + e.message, 'error'));
}

function addSingleNode() {
    const input = document.getElementById('addNodeInput');
    const link = input.value.trim();
    if (!link) {
        showToast('请输入节点链接', 'error');
        return;
    }

    fetch(SUB_SERVER + '/api/nodes', getFetchOptions({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link })
    }))
        .then(async r => {
            const data = await r.json();
            if (!r.ok || data.error) throw new Error(data.error || 'HTTP ' + r.status);
            return data;
        })
        .then(data => {
            showToast(`✅ 已添加，共 ${data.count} 个节点`, 'success');
            input.value = '';
            loadNodeList();
            checkServerStatus();
        })
        .catch(e => showToast('❌ 添加失败: ' + e.message, 'error'));
}
