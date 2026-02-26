/**
 * 代理订阅转换器 - 主应用逻辑 (API 驱动版)
 * 所有解析和格式生成逻辑由后端 POST /api/convert 处理
 */

// ==================== 全局状态 ====================

let allProxies = [];
let filteredProxies = [];
let currentOutput = '';
let currentFormat = 'clash-yaml';
let activeFilters = new Set();
let cachedInput = ''; // 缓存原始输入，用于切换格式

// API 密钥（从 localStorage 读取）
let apiKey = localStorage.getItem('apiKey') || '';

const SUB_SERVER = window.location.origin;

// 格式元数据（用于下载按钮文案等）
const FORMAT_META = {
    'clash-yaml': { name: 'Clash YAML', ext: '.yaml' },
    'clash-meta': { name: 'Clash Meta', ext: '.yaml' },
    surge: { name: 'Surge', ext: '.conf' },
    'sing-box': { name: 'Sing-Box', ext: '.json' },
    base64: { name: 'Base64 订阅', ext: '.txt' },
    raw: { name: '原始链接', ext: '.txt' }
};

// 获取带认证的 fetch 选项
function getFetchOptions(options = {}) {
    const headers = options.headers || {};
    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }
    return { ...options, headers, mode: 'cors' };
}

// ==================== 转换入口（调用后端 API）====================

function convert() {
    const input = document.getElementById('inputArea').value.trim();
    if (!input) {
        showToast('请先输入代理链接或订阅内容', 'error');
        return;
    }

    const btn = document.getElementById('btnConvert');
    btn.textContent = '⏳ 解析中...';
    btn.disabled = true;
    cachedInput = input;

    fetch(SUB_SERVER + '/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, format: currentFormat })
    })
        .then(r => r.json())
        .then(data => {
            if (!data.success) throw new Error(data.error || '转换失败');

            allProxies = data.proxies || [];
            currentOutput = data.output || '';

            // 去重
            const before = allProxies.length;
            allProxies = deduplicateProxies(allProxies);
            const removed = before - allProxies.length;
            if (removed > 0) showToast(`已去除 ${removed} 个重复节点`, 'warning');

            activeFilters.clear();
            filteredProxies = [...allProxies];

            renderStats(data.stats);
            renderFilterChips();
            renderNodes(filteredProxies);
            renderOutputPreview();

            document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
            showToast(`✅ 成功解析 ${allProxies.length} 个节点`, 'success');
        })
        .catch(e => {
            showToast('解析出错: ' + e.message, 'error');
        })
        .finally(() => {
            btn.textContent = '🔄 转换';
            btn.disabled = false;
        });
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

// ==================== 统计 ====================

function renderStats(stats) {
    const row = document.getElementById('statsRow');
    const typeColors = {
        VMESS: '#818cf8', VLESS: '#34d399', SS: '#60a5fa',
        SSR: '#f472b6', TROJAN: '#fbbf24', HYSTERIA: '#fb923c',
        HYSTERIA2: '#c4b5fd', TUIC: '#2dd4bf', WIREGUARD: '#a3e635'
    };

    if (!stats || Object.keys(stats).length === 0) {
        row.innerHTML = '';
        return;
    }

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
        const serverDisplay = p.server && p.server.includes(':') ? `[${esc(p.server)}]:${p.port}` : `${esc(p.server)}:${p.port}`;
        const infos = [`<div class="node-info-item"><span class="label">服务器</span><span class="value">${serverDisplay}</span></div>`];
        if (p.uuid) infos.push(`<div class="node-info-item"><span class="label">UUID</span><span class="value">${esc(p.uuid)}</span></div>`);
        if (p.cipher) infos.push(`<div class="node-info-item"><span class="label">加密</span><span class="value">${esc(p.cipher)}</span></div>`);
        if (p.network && p.network !== 'tcp') infos.push(`<div class="node-info-item"><span class="label">传输</span><span class="value">${esc(p.network)}</span></div>`);
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

// ==================== 格式切换 ====================

function switchFormat(format) {
    currentFormat = format;
    document.querySelectorAll('.format-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.format === format);
    });

    // 如果有缓存输入，重新请求后端转换为新格式
    if (cachedInput && allProxies.length > 0) {
        fetch(SUB_SERVER + '/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: cachedInput, format })
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    currentOutput = data.output || '';
                    renderOutputPreview();
                }
            })
            .catch(() => { });
    }
}

// ==================== 输出预览 ====================

function renderOutputPreview() {
    document.getElementById('outputPreview').textContent = currentOutput;
    const meta = FORMAT_META[currentFormat] || { name: currentFormat, ext: '.txt' };
    document.getElementById('btnDownload').textContent = `💾 下载 ${meta.name} (${meta.ext})`;
}

// ==================== 操作函数 ====================

function downloadConfig() {
    if (!currentOutput) return;
    const meta = FORMAT_META[currentFormat] || { name: currentFormat, ext: '.txt' };
    const blob = new Blob([currentOutput], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    a.download = `xinghe_${dateStr}${meta.ext}`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`💾 ${meta.name} 配置已下载`, 'success');
}

function copyConfig() {
    if (!currentOutput) return;
    writeClipboard(currentOutput);
    showToast('📋 配置已复制到剪贴板', 'success');
}

function writeClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (e) { }
    document.body.removeChild(ta);
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
    document.getElementById('searchInput').value = '';
    allProxies = [];
    filteredProxies = [];
    activeFilters.clear();
    currentOutput = '';
    cachedInput = '';
    renderStats({});
    renderFilterChips();
    renderNodes([]);
    document.getElementById('outputPreview').textContent = '';
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
    showToast('📦 已加载示例数据（9 个节点）', 'info');
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
    document.querySelectorAll('.format-tab').forEach(tab => {
        tab.addEventListener('click', () => switchFormat(tab.dataset.format));
    });
    loadNodeList();
    checkServerStatus();
});

// ==================== 订阅服务 ====================

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

            if (statsEl && info.subscription) {
                displaySubscriptionInfo(info.subscription, statsEl);
            }

            loadHistory();

            if (info.nodeCount > 0) {
                const host = window.location.host;
                const proto = window.location.protocol;
                const baseUrl = `${proto}//${host}/sub`;
                const subUrls = {
                    universal: baseUrl,
                    base64: `${baseUrl}?format=base64`,
                    'clash-yaml': `${baseUrl}?format=clash-yaml`,
                    'clash-meta': `${baseUrl}?format=clash-meta`,
                    surge: `${baseUrl}?format=surge`,
                    'sing-box': `${baseUrl}?format=sing-box`,
                    raw: `${baseUrl}?format=raw`
                };
                renderSubUrls(subUrls, info.nodeCount, 0);

                if (allProxies.length === 0) {
                    loadSavedNodes();
                }
            }
        })
        .catch(() => {
            el.textContent = '● 未启动';
            el.className = 'server-status offline';
            if (statsEl) statsEl.style.display = 'none';
        });
}

function loadSavedNodes() {
    fetch(SUB_SERVER + '/api/links', getFetchOptions())
        .then(r => r.text())
        .then(text => {
            if (!text.trim()) return;
            // 通过后端 API 解析已保存的节点
            return fetch(SUB_SERVER + '/api/convert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: text, format: currentFormat })
            }).then(r => r.json());
        })
        .then(data => {
            if (!data || !data.success) return;
            allProxies = deduplicateProxies(data.proxies || []);
            cachedInput = document.getElementById('inputArea').value.trim() || '';
            currentOutput = data.output || '';
            activeFilters.clear();
            filteredProxies = [...allProxies];
            renderStats(data.stats);
            renderFilterChips();
            renderNodes(filteredProxies);
            renderOutputPreview();
        })
        .catch(e => console.error('获取保存节点失败:', e));
}

function displaySubscriptionInfo(subInfo, container) {
    const items = [];

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
        items.push(`<div class="sub-info-item"><div class="sub-info-label">⬆️ 上传</div><div class="sub-info-value">${t.uploadFormatted}</div></div>`);
        items.push(`<div class="sub-info-item"><div class="sub-info-label">⬇️ 下载</div><div class="sub-info-value">${t.downloadFormatted}</div></div>`);
    }

    if (subInfo.expire) {
        items.push(`<div class="sub-info-item"><div class="sub-info-label">⏰ 到期时间</div><div class="sub-info-value">${subInfo.expire}</div></div>`);
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

    // 用 cachedInput 或 inputArea 的内容作为原始链接
    const rawLinks = cachedInput || document.getElementById('inputArea').value.trim();

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
            renderSubUrls(data.subUrls, data.count, data.newCount);
            showToast(`✅ ${data.count} 个节点已保存到订阅服务`, 'success');
            checkServerStatus();
        })
        .catch(e => {
            status.textContent = '❌ ' + e.message;
            status.style.color = 'var(--danger)';
            showToast('❌ 保存失败: ' + e.message, 'error');
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = '💾 保存节点';
        });
}

function copyUrl(url) {
    writeClipboard(url);
    showToast('📋 已复制: ' + url, 'success');
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
    ['trafficUploadGroup', 'trafficDownloadGroup', 'trafficTotalGroup', 'trafficResetGroup'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = enabled ? 'block' : 'none';
    });
}

function loadSubConfig() {
    fetch(SUB_SERVER + '/api/subscription', getFetchOptions())
        .then(r => r.json())
        .then(data => {
            if (!data.success || !data.subscription) { showToast('加载配置失败', 'error'); return; }
            const sub = data.subscription;
            document.getElementById('subTitle').value = sub.title || '';
            document.getElementById('subUpdateInterval').value = sub.updateInterval || 24;
            if (sub.traffic) {
                document.getElementById('subTrafficEnabled').value = sub.traffic.enabled ? 'true' : 'false';
                document.getElementById('subTrafficUpload').value = (sub.traffic.upload / 1073741824).toFixed(2);
                document.getElementById('subTrafficDownload').value = (sub.traffic.download / 1073741824).toFixed(2);
                document.getElementById('subTrafficTotal').value = (sub.traffic.total / 1073741824).toFixed(0);
                document.getElementById('subTrafficResetDay').value = sub.traffic.resetDay || 1;
            }
            toggleTrafficInputs();
            showToast('配置已加载', 'success');
        })
        .catch(e => showToast('加载配置失败: ' + e.message, 'error'));
}

function saveSubConfig() {
    const config = {
        title: document.getElementById('subTitle').value,
        updateInterval: parseInt(document.getElementById('subUpdateInterval').value),
        traffic: {
            enabled: document.getElementById('subTrafficEnabled').value === 'true',
            upload: Math.round(parseFloat(document.getElementById('subTrafficUpload').value) * 1073741824),
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
            if (data.success) { showToast('✅ 配置已保存', 'success'); checkServerStatus(); }
            else throw new Error(data.error || '保存失败');
        })
        .catch(e => showToast('❌ 保存失败: ' + e.message, 'error'));
}

function resetTraffic() {
    if (!confirm('确定要重置流量统计吗？上传和下载流量将归零。')) return;
    fetch(SUB_SERVER + '/api/subscription/reset-traffic', getFetchOptions({ method: 'POST' }))
        .then(r => r.json())
        .then(data => {
            if (data.success) { showToast('✅ 流量已重置', 'success'); loadSubConfig(); checkServerStatus(); }
            else throw new Error(data.error || '重置失败');
        })
        .catch(e => showToast('❌ 重置失败: ' + e.message, 'error'));
}

// ==================== 上传历史 ====================

function loadHistory() {
    const container = document.getElementById('historyList');
    if (!container) return;

    fetch(SUB_SERVER + '/api/history', { mode: 'cors' })
        .then(r => r.json())
        .then(data => {
            if (!data.success || !data.history || data.history.length === 0) {
                container.innerHTML = '<div class="empty-state" style="padding:20px;text-align:center;color:var(--text-muted)">暂无上传记录</div>';
                return;
            }
            container.innerHTML = data.history.map(item => {
                const time = new Date(item.timestamp).toLocaleString('zh-CN');
                const nodesPreview = item.nodes.slice(0, 5).map(n => esc(n)).join('、');
                const moreCount = item.nodes.length > 5 ? `... 等 ${item.nodes.length} 个` : '';
                return `<div class="history-item"><div class="history-header"><span class="history-time">📅 ${time}</span><span class="history-count">${item.nodeCount} 个节点</span></div><div class="history-nodes">${nodesPreview}${moreCount}</div></div>`;
            }).join('');
        })
        .catch(() => {
            container.innerHTML = '<div class="empty-state" style="padding:20px;text-align:center;color:var(--text-muted)">加载失败</div>';
        });
}

function clearHistory() {
    if (!confirm('确定要清空所有上传历史记录吗？')) return;
    fetch(SUB_SERVER + '/api/history', getFetchOptions({ method: 'DELETE' }))
        .then(async r => { const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'HTTP ' + r.status); return d; })
        .then(() => { showToast('✅ 历史记录已清空', 'success'); loadHistory(); })
        .catch(e => showToast('❌ 清空失败: ' + e.message, 'error'));
}

// ==================== 节点管理 ====================

function clearAllNodes() {
    if (!confirm('⚠️ 确定要清空订阅中的所有节点吗？此操作不可恢复！')) return;
    fetch(SUB_SERVER + '/api/links', getFetchOptions({ method: 'DELETE' }))
        .then(async r => { const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'HTTP ' + r.status); return d; })
        .then(() => { showToast('✅ 所有节点已清空', 'success'); checkServerStatus(); })
        .catch(e => showToast('❌ 清空失败: ' + e.message, 'error'));
}

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
        .then(async r => { const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'HTTP ' + r.status); return d; })
        .then(data => {
            countEl.textContent = `共 ${data.count} 个节点`;
            const batchBar = document.getElementById('batchActionBar');
            if (batchBar) batchBar.style.display = (!data.nodes || data.nodes.length === 0) ? 'none' : 'flex';

            if (!data.nodes || data.nodes.length === 0) {
                container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">暂无节点</div>';
                return;
            }

            const typeColors = {
                VMESS: '#818cf8', VLESS: '#34d399', SS: '#60a5fa', SSR: '#f472b6',
                TROJAN: '#fbbf24', HYSTERIA: '#fb923c', HYSTERIA2: '#c4b5fd',
                TUIC: '#2dd4bf', WIREGUARD: '#a3e635', HY2: '#c4b5fd', WG: '#a3e635'
            };

            container.innerHTML = data.nodes.map(node => {
                const color = typeColors[node.type] || '#94a3b8';
                return `<div id="node-row-${node.index}" style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:13px">
                    <input type="checkbox" class="node-checkbox" value="${node.index}" onchange="updateSelectedCount()" style="width:16px;height:16px;accent-color:var(--danger);cursor:pointer">
                    <span style="min-width:24px;color:var(--text-muted);font-size:11px">#${node.index}</span>
                    <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;color:${color};background:${color}22">${node.type}</span>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(node.link)}">${esc(node.name)}</span>
                    <button onclick="deleteNode(${node.index})" style="background:rgba(239,68,68,0.1);color:#ef4444;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap"
                        onmouseover="this.style.background='rgba(239,68,68,0.25)'" onmouseout="this.style.background='rgba(239,68,68,0.1)'">✕ 删除</button>
                </div>`;
            }).join('');

            document.getElementById('selectAllNodes').checked = false;
            updateSelectedCount();
        })
        .catch(e => {
            container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--danger)">加载失败: ${e.message}</div>`;
        });
}

function deleteNode(index) {
    if (!confirm(`确定要删除节点 #${index} 吗？`)) return;
    fetch(SUB_SERVER + `/api/nodes?index=${index}`, getFetchOptions({ method: 'DELETE' }))
        .then(async r => { const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'HTTP ' + r.status); return d; })
        .then(data => { showToast(`✅ 已删除，剩余 ${data.remaining} 个节点`, 'success'); loadNodeList(); checkServerStatus(); loadSavedNodes(); })
        .catch(e => showToast('❌ 删除失败: ' + e.message, 'error'));
}

function toggleSelectAllNodes(chk) {
    document.querySelectorAll('.node-checkbox').forEach(cb => cb.checked = chk.checked);
    updateSelectedCount();
}

function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.node-checkbox');
    const count = document.querySelectorAll('.node-checkbox:checked').length;
    const btn = document.getElementById('btnDeleteSelected');
    const countSpan = document.getElementById('selectedCount');

    if (countSpan) countSpan.textContent = count;
    if (btn) {
        if (count > 0) {
            btn.style.opacity = '1'; btn.style.pointerEvents = 'auto';
            btn.style.background = '#ef4444'; btn.style.color = '#fff';
        } else {
            btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none';
            btn.style.background = 'rgba(239,68,68,0.1)'; btn.style.color = '#ef4444';
        }
    }

    const selectAll = document.getElementById('selectAllNodes');
    if (selectAll) selectAll.checked = (count === checkboxes.length && checkboxes.length > 0);
}

function deleteSelectedNodes() {
    const indices = Array.from(document.querySelectorAll('.node-checkbox:checked')).map(cb => parseInt(cb.value));
    if (indices.length === 0) return;
    if (!confirm(`确定要批量删除这 ${indices.length} 个选中节点吗？`)) return;

    fetch(SUB_SERVER + '/api/nodes/batch-delete', getFetchOptions({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indices })
    }))
        .then(async r => { const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'HTTP ' + r.status); return d; })
        .then(data => { showToast(`✅ 已批量删除 ${data.removedCount} 个节点`, 'success'); loadNodeList(); checkServerStatus(); loadSavedNodes(); })
        .catch(e => showToast('❌ 批量删除失败: ' + e.message, 'error'));
}

function addSingleNode() {
    const input = document.getElementById('addNodeInput');
    const link = input.value.trim();
    if (!link) { showToast('请输入节点链接', 'error'); return; }

    fetch(SUB_SERVER + '/api/nodes', getFetchOptions({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link })
    }))
        .then(async r => { const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || 'HTTP ' + r.status); return d; })
        .then(data => { showToast(`✅ 已添加，共 ${data.count} 个节点`, 'success'); input.value = ''; loadNodeList(); checkServerStatus(); loadSavedNodes(); })
        .catch(e => showToast('❌ 添加失败: ' + e.message, 'error'));
}

function renderSubUrls(subUrls, totalCount, newCount) {
    const grid = document.getElementById('subUrlGrid');
    if (!grid) return;

    const formatLabels = {
        universal: { name: '通用订阅', icon: '🌐', desc: '自动识别客户端（推荐）' },
        base64: { name: 'Base64 订阅', icon: '⚔️', desc: 'Base64 编码' },
        'clash-yaml': { name: 'Clash YAML', icon: '📄', desc: 'Clash 完整配置' },
        'clash-meta': { name: 'Clash Meta', icon: '🌀', desc: 'Mihomo / Verge Rev' },
        surge: { name: 'Surge', icon: '🌊', desc: 'Surge iOS/macOS' },
        'sing-box': { name: 'Sing-Box', icon: '📦', desc: 'Sing-Box / NekoBox' },
        raw: { name: '原始链接', icon: '📋', desc: '通用' }
    };

    grid.innerHTML = Object.entries(subUrls).map(([fmt, url]) => {
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

    const status = document.getElementById('saveStatus');
    const listSection = document.getElementById('subUrlList');
    if (listSection) listSection.style.display = 'block';
    if (status) {
        status.textContent = (newCount > 0)
            ? `✅ 订阅共 ${totalCount} 个节点 （本次新增 ${newCount}，已去重合并）`
            : `✅ 订阅共 ${totalCount} 个节点`;
        status.style.color = 'var(--success)';
    }
}
