<template>
  <div class="card">
    <div class="card-title">
      <div class="icon icon-sub">📲</div>
      一键导入客户端
      <span id="subLinkCount" class="text-muted" style="margin-left:auto">
        {{ nodes.length > 0 ? nodes.length + ' 个节点可导入' : '暂无节点' }}
      </span>
    </div>
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
      点击对应客户端按钮，一键导入配置。移动端可扫描 QR 码导入。
    </p>

    <!-- 客户端按钮网格 -->
    <div class="client-grid">
      <button class="client-btn" @click="importToClient('clash')" title="适用于 Clash for Windows / Clash Verge / Mihomo Party">
        <span class="client-icon" style="background:rgba(99,102,241,0.15);color:#818cf8">⚔️</span>
        <span class="client-name">Clash</span>
        <span class="client-desc">YAML 配置</span>
      </button>
      <button class="client-btn" @click="importToClient('clash-meta')" title="适用于 Mihomo / Clash Meta / Clash Verge Rev">
        <span class="client-icon" style="background:rgba(139,92,246,0.15);color:#a78bfa">🌀</span>
        <span class="client-name">Clash Meta</span>
        <span class="client-desc">Mihomo 扩展</span>
      </button>
      <button class="client-btn" @click="importToClient('shadowrocket')" title="适用于 Shadowrocket (iOS)">
        <span class="client-icon" style="background:rgba(59,130,246,0.15);color:#60a5fa">🚀</span>
        <span class="client-name">Shadowrocket</span>
        <span class="client-desc">iOS 小火箭</span>
      </button>
      <button class="client-btn" @click="importToClient('v2rayn')" title="适用于 V2RayN / V2RayNG / Nekoray">
        <span class="client-icon" style="background:rgba(16,185,129,0.15);color:#34d399">🛡️</span>
        <span class="client-name">V2RayN/NG</span>
        <span class="client-desc">复制订阅到剪贴板</span>
      </button>
      <button class="client-btn" @click="importToClient('surge')" title="适用于 Surge (iOS/macOS)">
        <span class="client-icon" style="background:rgba(245,158,11,0.15);color:#fbbf24">🌊</span>
        <span class="client-name">Surge</span>
        <span class="client-desc">INI 配置</span>
      </button>
      <button class="client-btn" @click="importToClient('singbox')" title="适用于 Sing-Box / NekoBox">
        <span class="client-icon" style="background:rgba(45,212,191,0.15);color:#2dd4bf">📦</span>
        <span class="client-name">Sing-Box</span>
        <span class="client-desc">JSON 配置</span>
      </button>
      <button class="client-btn" @click="importToClient('quantumultx')" title="适用于 Quantumult X (iOS)">
        <span class="client-icon" style="background:rgba(236,72,153,0.15);color:#f472b6">🔮</span>
        <span class="client-name">Quantumult X</span>
        <span class="client-desc">复制节点到剪贴板</span>
      </button>
      <button class="client-btn" @click="copyRaw" title="复制原始协议链接">
        <span class="client-icon" style="background:rgba(163,230,53,0.15);color:#a3e635">📋</span>
        <span class="client-name">通用复制</span>
        <span class="client-desc">原始链接</span>
      </button>
    </div>

    <!-- QR 码区域 -->
    <div v-show="qrVisible" class="qr-section">
      <div class="qr-header">
        <span class="qr-title">📱 扫码导入 <span style="color:var(--accent-3)">{{ currentQrClientName }}</span></span>
        <button class="btn btn-sm btn-secondary" @click="qrVisible = false">✕ 关闭</button>
      </div>
      <div class="qr-body">
        <div ref="qrCanvas" class="qr-canvas"></div>
        <p class="qr-tip">{{ currentQrTip }}</p>
      </div>
    </div>

    <!-- 订阅内容 -->
    <details class="sub-details">
      <summary>📄 查看 Base64 订阅内容</summary>
      <textarea class="sub-textarea" readonly :value="base64Str" placeholder="转换后生成的 Base64 订阅内容"></textarea>
      <div class="btn-row">
        <button class="btn btn-primary btn-sm" @click="copyB64">📋 复制 Base64 订阅</button>
        <button class="btn btn-secondary btn-sm" @click="copyRaw">🔗 复制原始链接</button>
        <button class="btn btn-secondary btn-sm" @click="showQRForB64">📱 生成 QR 码</button>
      </div>
    </details>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  nodes: { type: Array, default: () => [] }
})

const qrCanvas = ref(null)
const qrVisible = ref(false)
const currentQrClientName = ref('')
const currentQrTip = ref('')

const base64Str = computed(() => {
  if (props.nodes.length === 0) return ''
  const subContent = props.nodes.map(n => n.link).join('\n')
  try {
    return btoa(unescape(encodeURIComponent(subContent)))
  } catch (e) {
    console.error('Base64 encode error', e)
    return ''
  }
})

const rawLinks = computed(() => {
  return props.nodes.map(n => n.link).join('\n')
})

function copyText(str, msg) {
  if (!str) return
  navigator.clipboard.writeText(str).then(() => alert(msg))
}

function copyB64() {
  copyText(base64Str.value, '已复制 Base64 订阅')
}

function copyRaw() {
  copyText(rawLinks.value, '已复制原始链接')
}

function showQR(data, clientName, tip) {
  if (!data) return alert('没有可用的节点数据生成二维码')
  qrVisible.value = true
  currentQrClientName.value = clientName || ''
  currentQrTip.value = tip || '使用客户端扫描此 QR 码导入配置'
  
  setTimeout(() => {
    if (qrCanvas.value) {
      qrCanvas.value.innerHTML = ''
      try {
        if (typeof window.qrcode === 'undefined') {
          const script = document.createElement('script')
          script.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js'
          script.onload = () => renderQR(data)
          document.head.appendChild(script)
        } else {
          renderQR(data)
        }
      } catch (err) {
        console.error(err)
      }
    }
  }, 100)
}

function renderQR(data) {
  const qr = window.qrcode(0, 'M')
  qr.addData(data)
  qr.make()
  if (qrCanvas.value) {
    qrCanvas.value.innerHTML = qr.createImgTag(5, 10)
    const img = qrCanvas.value.querySelector('img')
    if (img) {
      img.style.maxWidth = '100%'
      img.style.height = 'auto'
      img.style.borderRadius = '8px'
    }
  }
}

function showQRForB64() {
  showQR(base64Str.value, '通用订阅', '使用支持订阅的客户端扫码导入')
}

function importToClient(client) {
  if (props.nodes.length === 0) {
    alert('请先导入并转换节点')
    return
  }

  const subUrlMap = {
    'clash': `${window.location.origin}/sub?format=clash-yaml`,
    'clash-meta': `${window.location.origin}/sub?format=clash-meta`,
    'surge': `${window.location.origin}/sub?format=surge`,
    'singbox': `${window.location.origin}/sub?format=sing-box`
  }

  let finalUrl = subUrlMap[client]
  if (finalUrl) {
    const schemeUrl = encodeURIComponent(finalUrl)
    if (client === 'clash' || client === 'clash-meta') {
      window.location.href = `clash://install-config?url=${schemeUrl}&name=XingheProxy`
    } else if (client === 'shadowrocket') {
       window.location.href = `shadowrocket://add/sub://${btoa(finalUrl)}?title=XingheProxy`
    } else if (client === 'surge') {
       window.location.href = `surge:///install-config?url=${schemeUrl}`
    } else if (client === 'singbox') {
       window.location.href = `sing-box://import-remote-profile?url=${schemeUrl}&name=XingheProxy`
    }
  } else {
    if (client === 'v2rayn' || client === 'shadowrocket') {
      copyText(base64Str.value, '已复制 Base64 订阅并准备好在剪贴板中\n如果未自动跳转，请手动打开客户端粘贴')
      if (client === 'shadowrocket') {
        window.location.href = `shadowrocket://add/sub://${btoa(window.location.origin + '/sub')}?title=XingheProxy`
      }
    } else if (client === 'quantumultx') {
      copyText(rawLinks.value, '已复制节点链接，请在 Quantumult X 中通过剪贴板导入')
    } else if (client === 'raw-clipboard') {
      copyRaw()
    }
  }
}
</script>


