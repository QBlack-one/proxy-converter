<template>
  <div class="card">
    <div class="card-title">
      <div class="icon icon-sub">📲</div>
      一键导入客户端
    </div>
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
      点击对应客户端按钮，一键导入配置（如需生成二维码，请使用旧版逻辑，Vue版已简化）。
    </p>

    <!-- 客户端按钮网格 -->
    <div class="client-grid">
      <button class="client-btn" @click="importToClient('clash')" title="Clash for Windows / Verge">
        <span class="client-icon" style="background:rgba(99,102,241,0.15);color:#818cf8">⚔️</span>
        <span class="client-name">Clash</span>
        <span class="client-desc">YAML 配置</span>
      </button>
      <button class="client-btn" @click="importToClient('surge')" title="Surge">
        <span class="client-icon" style="background:rgba(245,158,11,0.15);color:#fbbf24">🌊</span>
        <span class="client-name">Surge</span>
        <span class="client-desc">INI 配置</span>
      </button>
      <button class="client-btn" @click="importToClient('v2rayn')" title="V2RayN">
        <span class="client-icon" style="background:rgba(16,185,129,0.15);color:#34d399">🛡️</span>
        <span class="client-name">V2RayN/NG</span>
        <span class="client-desc">剪贴板导入</span>
      </button>
      <button class="client-btn" @click="importToClient('singbox')" title="Sing-Box">
        <span class="client-icon" style="background:rgba(45,212,191,0.15);color:#2dd4bf">📦</span>
        <span class="client-name">Sing-Box</span>
        <span class="client-desc">JSON 配置</span>
      </button>
    </div>
  </div>
</template>

<script setup>
function importToClient(client) {
  const baseUrl = `${window.location.origin}/sub`
  let url = baseUrl
  
  if (client === 'clash') url += '?format=clash-yaml'
  else if (client === 'surge') url += '?format=surge'
  else if (client === 'singbox') url += '?format=sing-box'
  else if (client === 'v2rayn') url += '?format=base64'
  else {
    alert('暂不支持此快捷导入')
    return
  }

  const encodedUrl = encodeURIComponent(url)

  if (client === 'clash') {
    window.location.href = `clash://install-config?url=${encodedUrl}`
  } else if (client === 'surge') {
    window.location.href = `surge:///install-config?url=${encodedUrl}`
  } else {
    navigator.clipboard.writeText(url).then(() => {
      alert(`${client} 不支持DeepLink重定向，已复制订阅链接，请到客户端手动添加`)
    })
  }
}
</script>


