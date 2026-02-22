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

    <!-- Node List (卡片展示) -->
    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span style="font-weight:600;font-size:14px">📋 订阅节点列表 ({{ nodes.length }})</span>
        <div style="display:flex;gap:8px;align-items:center">
          <span v-if="saveStatus" style="font-size:12px;color:var(--text-muted)">{{ saveStatus }}</span>
          <button class="btn btn-sm btn-secondary" @click="loadNodes">🔄 刷新</button>
          <button class="btn btn-sm btn-danger" @click="handleClearNodes">🗑️ 清空</button>
        </div>
      </div>

      <div v-if="nodesLoading" style="color:var(--text-muted);font-size:13px;text-align:center;padding:32px">
        ⏳ 加载中...
      </div>
      <div v-else-if="nodes.length === 0" style="color:var(--text-muted);font-size:13px;text-align:center;padding:32px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px">
        暂无节点，请先在上方输入代理链接并转换保存
      </div>
      <div v-else class="node-grid">
        <div v-for="(node, idx) in nodes" :key="idx" class="node-card">
          <div class="node-card-header">
            <span class="node-index">#{{ idx + 1 }}</span>
            <span :class="['node-type-badge', 'type-' + (node.type || 'UNKNOWN').toLowerCase()]">
              {{ node.type || 'UNKNOWN' }}
            </span>
          </div>
          <div class="node-card-name" :title="node.name">
            {{ node.name }}
          </div>
          <div class="node-card-footer">
            <button class="node-delete-btn" @click="handleDeleteNode(idx)">✕ 删除</button>
          </div>
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

const universalSubUrl = computed(() => {
  return `${window.location.origin}/sub`
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

/* ===== 节点卡片网格 ===== */
.node-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  max-height: 520px;
  overflow-y: auto;
  padding: 4px;
}
.node-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  backdrop-filter: blur(8px);
}
.node-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}
.node-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.node-index {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}
.node-card-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}
.node-card-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
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

/* ===== 协议类型标签颜色 ===== */
.node-type-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}
.type-vmess { background: rgba(99, 102, 241, 0.15); color: #818cf8; }
.type-vless { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.type-ss { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
.type-ssr { background: rgba(239, 68, 68, 0.15); color: #f87171; }
.type-trojan { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
.type-hysteria, .type-hysteria2 { background: rgba(236, 72, 153, 0.15); color: #f472b6; }
.type-tuic { background: rgba(14, 165, 233, 0.15); color: #38bdf8; }
.type-wireguard { background: rgba(34, 197, 94, 0.15); color: #4ade80; }
.type-socks5 { background: rgba(251, 146, 60, 0.15); color: #fb923c; }
.type-snell { background: rgba(192, 132, 252, 0.15); color: #c084fc; }
.type-unknown { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }
</style>
