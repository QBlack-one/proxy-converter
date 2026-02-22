<template>
  <div class="card" id="subServiceCard">
    <div class="card-title">
      <div class="icon" style="background:rgba(99,102,241,0.15)">🌐</div>
      订阅链接服务
      <span class="server-status" :class="info ? 'online' : 'offline'">
        ● {{ info ? '运行中' : '未连接' }}
      </span>
    </div>

    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px" v-if="info">
      服务已就绪。将当前转换的节点保存到本地服务，生成可供代理客户端订阅的链接。
    </p>

    <!-- 通用订阅链接 -->
    <div class="universal-sub" style="margin-bottom:16px">
      <label style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:8px;display:block">
        🔗 通用订阅链接
      </label>
      <div style="display:flex;align-items:center;gap:8px">
        <input 
          type="text" 
          :value="universalSubUrl" 
          readonly 
          style="flex:1;padding:10px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);font-size:13px;font-family:'JetBrains Mono',monospace"
        />
        <button class="btn btn-primary" @click="copyUniversalLink" style="white-space:nowrap">
          {{ copyStatusUniversal || '📋 复制' }}
        </button>
      </div>
    </div>

    <!-- 格式订阅链接 -->
    <div v-if="info && info.formats" class="sub-url-list" style="margin-bottom:16px">
      <label style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:10px;display:block">
        📋 订阅链接（点击复制）
      </label>
      <div class="sub-url-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:8px">
        <button v-for="fmt in info.formats" :key="fmt" class="btn btn-sm btn-secondary" style="justify-content:flex-start" @click="copySubLink(fmt)">
          🔗 {{ fmt }} 格式
        </button>
      </div>
    </div>
  </div>

  <!-- 节点列表 - 独立卡片 -->
  <div class="card" id="nodeListCard">
    <div class="card-title">
      <div class="icon" style="background:rgba(45,212,191,0.15)">🌍</div>
      节点列表
      <span style="margin-left:auto;font-size:13px;color:var(--text-muted)">
        {{ filteredNodes.length }} / {{ nodes.length }} 个节点
      </span>
    </div>

    <!-- 搜索 + 协议分类统计 -->
    <div class="node-filter-bar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input v-model="searchQuery" type="text" placeholder="搜索节点名称、服务器地址..." class="search-input" />
      </div>
      <div class="protocol-tags">
        <button 
          :class="['proto-tag', selectedType === '' ? 'active' : '']" 
          @click="selectedType = ''"
        >
          总计 <b>{{ nodes.length }}</b>
        </button>
        <button 
          v-for="(count, type) in protocolStats" 
          :key="type"
          :class="['proto-tag', 'tag-' + type.toLowerCase(), selectedType === type ? 'active' : '']"
          @click="selectedType = selectedType === type ? '' : type"
        >
          {{ type }} <b>{{ count }}</b>
        </button>
      </div>
    </div>

    <!-- 操作栏 -->
    <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center">
      <button class="btn btn-sm btn-secondary" @click="loadNodes">🔄 刷新</button>
      <button class="btn btn-sm btn-danger" @click="handleClearNodes">🗑️ 清空所有</button>
      <span v-if="saveStatus" style="font-size:12px;color:var(--text-muted)">{{ saveStatus }}</span>
    </div>

    <!-- 节点卡片网格 -->
    <div v-if="nodesLoading" style="color:var(--text-muted);font-size:13px;text-align:center;padding:32px">
      ⏳ 加载中...
    </div>
    <div v-else-if="filteredNodes.length === 0" style="color:var(--text-muted);font-size:13px;text-align:center;padding:32px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px">
      {{ nodes.length === 0 ? '暂无节点，请先在上方输入代理链接并转换' : '无匹配节点' }}
    </div>
    <div v-else class="node-grid">
      <div v-for="(node, idx) in filteredNodes" :key="node.id || idx" :class="['node-card', 'border-' + (node.type || 'unknown').toLowerCase()]">
        <div class="node-card-header">
          <span class="node-card-name" :title="node.name">{{ node.name }}</span>
          <span :class="['node-type-badge', 'type-' + (node.type || 'UNKNOWN').toLowerCase()]">
            {{ node.type || 'UNKNOWN' }}
          </span>
        </div>
        <div class="node-card-details">
          <div class="detail-row" v-if="node.server && node.server !== 'unknown'">
            <span class="detail-label">服务器</span>
            <span class="detail-value">{{ node.server }}:{{ node.port }}</span>
          </div>
          <template v-if="node._details">
            <div class="detail-row" v-if="node._details.uuid">
              <span class="detail-label">UUID</span>
              <span class="detail-value mono">{{ node._details.uuid }}</span>
            </div>
            <div class="detail-row" v-if="node._details.cipher || node._details.method">
              <span class="detail-label">加密</span>
              <span class="detail-value">{{ node._details.cipher || node._details.method }}</span>
            </div>
            <div class="detail-row" v-if="node._details.password">
              <span class="detail-label">密码</span>
              <span class="detail-value mono">{{ node._details.password }}</span>
            </div>
            <div class="detail-row" v-if="node._details.network">
              <span class="detail-label">传输</span>
              <span class="detail-value">{{ node._details.network }}</span>
            </div>
            <div class="detail-row" v-if="node._details.tls !== undefined">
              <span class="detail-label">TLS</span>
              <span :class="['detail-value', node._details.tls ? 'tls-on' : 'tls-off']">
                {{ node._details.tls ? '✓ 启用' : '✗ 关闭' }}
              </span>
            </div>
            <div class="detail-row" v-if="node._details.flow">
              <span class="detail-label">Flow</span>
              <span class="detail-value mono">{{ node._details.flow }}</span>
            </div>
            <div class="detail-row" v-if="node._details['reality-opts']">
              <span class="detail-label">Reality</span>
              <span class="detail-value tls-on">✓ 启用</span>
            </div>
          </template>
        </div>
        <div class="node-card-footer">
          <button class="node-delete-btn" @click="handleDeleteNode(node._originalIndex)">✕ 删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useApi } from '../composables/useApi'

const { getInfo, getNodes, clearNodes, deleteNode } = useApi()

const info = ref(null)
const nodes = ref([])
const nodesLoading = ref(false)
const saveStatus = ref('')
const copyStatusUniversal = ref('')
const searchQuery = ref('')
const selectedType = ref('')

const universalSubUrl = computed(() => {
  return `${window.location.origin}/sub`
})

// 解析 details JSON
const parsedNodes = computed(() => {
  return nodes.value.map((node, idx) => {
    let details = {}
    try {
      if (node.details && node.details !== '{}') {
        details = JSON.parse(node.details)
      }
    } catch (e) {}
    return { ...node, _details: details, _originalIndex: idx }
  })
})

// 协议统计
const protocolStats = computed(() => {
  const stats = {}
  for (const node of parsedNodes.value) {
    const t = (node.type || 'UNKNOWN').toUpperCase()
    stats[t] = (stats[t] || 0) + 1
  }
  return stats
})

// 过滤节点
const filteredNodes = computed(() => {
  let result = parsedNodes.value
  if (selectedType.value) {
    result = result.filter(n => (n.type || '').toUpperCase() === selectedType.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(n => 
      (n.name || '').toLowerCase().includes(q) || 
      (n.server || '').toLowerCase().includes(q)
    )
  }
  return result
})

async function refreshInfo() {
  try {
    const data = await getInfo()
    info.value = data
  } catch (e) {
    info.value = null
  }
}

async function loadNodes() {
  nodesLoading.value = true
  try {
    const data = await getNodes()
    nodes.value = data.nodes || []
  } catch (e) {
    console.error(e)
  } finally {
    nodesLoading.value = false
  }
}

async function handleClearNodes() {
  if (!confirm('确定要清空所有节点吗？')) return
  try {
    await clearNodes()
    saveStatus.value = '✅ 已清空'
    await loadNodes()
    await refreshInfo()
    setTimeout(() => saveStatus.value = '', 3000)
  } catch (e) {
    alert(e.message)
  }
}

async function handleDeleteNode(index) {
  try {
    await deleteNode(index)
    await loadNodes()
    await refreshInfo()
  } catch (e) {
    alert(e.message)
  }
}

function copyUniversalLink() {
  const url = universalSubUrl.value
  navigator.clipboard.writeText(url).then(() => {
    copyStatusUniversal.value = '✅ 已复制'
    setTimeout(() => copyStatusUniversal.value = '', 2000)
  })
}

function copySubLink(format) {
  const url = `${window.location.origin}/sub?format=${format}`
  navigator.clipboard.writeText(url).then(() => {
    alert('已复制链接: ' + url)
  })
}

onMounted(() => {
  refreshInfo()
  loadNodes()
})
</script>

<style scoped>
.server-status {
  margin-left: auto;
  font-size: 13px;
  padding: 4px 10px;
  border-radius: 12px;
}
.server-status.online {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}
.server-status.offline {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

/* ===== 搜索和过滤 ===== */
.node-filter-bar {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.search-box {
  position: relative;
}
.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  opacity: 0.5;
}
.search-input {
  width: 100%;
  padding: 10px 10px 10px 40px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
.search-input:focus {
  border-color: rgba(99, 102, 241, 0.5);
}
.protocol-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.proto-tag {
  padding: 5px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.proto-tag:hover { background: rgba(255,255,255,0.05); }
.proto-tag.active { background: rgba(99,102,241,0.2); border-color: rgba(99,102,241,0.5); color: #818cf8; }
.proto-tag b { margin-left: 4px; }

/* 协议分类颜色 */
.tag-vmess.active { background: rgba(99,102,241,0.2); border-color: #818cf8; color: #818cf8; }
.tag-vless.active { background: rgba(16,185,129,0.2); border-color: #34d399; color: #34d399; }
.tag-ss.active { background: rgba(245,158,11,0.2); border-color: #fbbf24; color: #fbbf24; }
.tag-ssr.active { background: rgba(239,68,68,0.2); border-color: #f87171; color: #f87171; }
.tag-trojan.active { background: rgba(168,85,247,0.2); border-color: #c084fc; color: #c084fc; }
.tag-hysteria.active, .tag-hysteria2.active { background: rgba(236,72,153,0.2); border-color: #f472b6; color: #f472b6; }
.tag-tuic.active { background: rgba(14,165,233,0.2); border-color: #38bdf8; color: #38bdf8; }
.tag-wireguard.active { background: rgba(34,197,94,0.2); border-color: #4ade80; color: #4ade80; }

/* ===== 节点卡片网格 ===== */
.node-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
  max-height: 600px;
  overflow-y: auto;
  padding: 4px;
}
.node-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.25s ease;
}
.node-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

/* 左边框颜色 */
.border-vmess { border-left-color: #818cf8; }
.border-vless { border-left-color: #34d399; }
.border-ss { border-left-color: #fbbf24; }
.border-ssr { border-left-color: #f87171; }
.border-trojan { border-left-color: #c084fc; }
.border-hysteria, .border-hysteria2 { border-left-color: #f472b6; }
.border-tuic { border-left-color: #38bdf8; }
.border-wireguard { border-left-color: #4ade80; }
.border-socks5 { border-left-color: #fb923c; }
.border-snell { border-left-color: #c084fc; }

.node-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.node-card-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.node-card-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.detail-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: 12px;
  line-height: 1.6;
}
.detail-label {
  color: var(--text-muted);
  min-width: 44px;
  flex-shrink: 0;
  font-weight: 500;
}
.detail-value {
  color: var(--text-secondary);
  word-break: break-all;
}
.detail-value.mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.detail-value.tls-on { color: #34d399; font-weight: 600; }
.detail-value.tls-off { color: #94a3b8; }

.node-card-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 4px;
}
.node-delete-btn {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  cursor: pointer;
  transition: all 0.2s;
}
.node-delete-btn:hover {
  background: rgba(239, 68, 68, 0.25);
  border-color: #ef4444;
}

/* ===== 协议类型标签 ===== */
.node-type-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  flex-shrink: 0;
}
.type-vmess { background: rgba(99,102,241,0.15); color: #818cf8; }
.type-vless { background: rgba(16,185,129,0.15); color: #34d399; }
.type-ss { background: rgba(245,158,11,0.15); color: #fbbf24; }
.type-ssr { background: rgba(239,68,68,0.15); color: #f87171; }
.type-trojan { background: rgba(168,85,247,0.15); color: #c084fc; }
.type-hysteria, .type-hysteria2 { background: rgba(236,72,153,0.15); color: #f472b6; }
.type-tuic { background: rgba(14,165,233,0.15); color: #38bdf8; }
.type-wireguard { background: rgba(34,197,94,0.15); color: #4ade80; }
.type-socks5 { background: rgba(251,146,60,0.15); color: #fb923c; }
.type-snell { background: rgba(192,132,252,0.15); color: #c084fc; }
.type-unknown { background: rgba(148,163,184,0.15); color: #94a3b8; }
</style>
