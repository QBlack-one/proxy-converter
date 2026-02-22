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

    <!-- Controls -->
    <div class="btn-row" style="margin-bottom:16px">
      <button class="btn btn-secondary" @click="toggleNodeManage">
        {{ showNodeManage ? '🔽 收起节点列表' : '📋 节点管理' }}
      </button>
      <button class="btn btn-danger" @click="handleClearNodes">🗑️ 清空所有节点</button>
      <span v-if="saveStatus" style="font-size:12px;color:var(--text-muted);align-self:center">{{ saveStatus }}</span>
    </div>

    <!-- Node List -->
    <div v-if="showNodeManage" style="margin-bottom:16px">
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <span style="font-weight:600;font-size:14px">📋 订阅节点列表 ({{ nodes.length }})</span>
          <button class="btn btn-sm btn-secondary" @click="showNodeManage = false">✕ 关闭</button>
        </div>
        
        <div style="max-height:400px;overflow-y:auto">
          <div v-if="nodesLoading" style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">
            ⏳ 加载中...
          </div>
          <div v-else-if="nodes.length === 0" style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">
             暂无节点
          </div>
          <div v-else v-for="(node, idx) in nodes" :key="idx" class="node-item">
             <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
               <span class="node-type-badge">{{ node.type || 'UNKNOWN' }}</span>
               <span style="font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ node.name }}</span>
             </div>
             <button class="btn btn-sm btn-danger" @click="handleDeleteNode(idx)">删除</button>
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
const showNodeManage = ref(false)
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

async function toggleNodeManage() {
  showNodeManage.value = !showNodeManage.value
  if (showNodeManage.value) {
    await loadNodes()
  }
}

async function handleClearNodes() {
  if (!confirm('确定要清空所有节点吗？')) return
  try {
    await clearNodes()
    saveStatus.value = '已清空'
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
.node-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 8px;
  border-bottom: 1px solid var(--border);
  transition: background 0.2s;
}
.node-item:hover {
  background: rgba(255, 255, 255, 0.03);
}
.node-item:last-child {
  border-bottom: none;
}
.node-type-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  white-space: nowrap;
}
</style>
