<template>
  <div class="card" id="subServiceCard">
    <div class="card-title">
      <div class="icon" style="background:rgba(99,102,241,0.15)">🌐</div>
      订阅链接服务
      <span class="server-status" :class="info ? 'online' : 'offline'">
        ● {{ info ? '运行中 (端口: ' + info.port + ')' : '未连接' }}
      </span>
    </div>

    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px" v-if="info">
      服务已就绪。将当前转换的节点保存到本地服务，生成可供代理客户端订阅的链接。
    </p>

    <!-- Controls -->
    <div class="btn-row" style="margin-bottom:16px">
      <button class="btn btn-secondary" @click="toggleNodeManage">📋 节点管理</button>
      <button class="btn btn-danger" @click="handleClearNodes">🗑️ 清空所有节点</button>
      <span v-if="saveStatus" style="font-size:12px;color:var(--text-muted);align-self:center">{{ saveStatus }}</span>
    </div>

    <!-- Node Manager (simplified wrapper) -->
    <div v-if="showNodeManage" style="margin-bottom:16px">
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <span style="font-weight:600;font-size:14px">📋 订阅节点管理 ({{ nodes.length }})</span>
          <button class="btn btn-sm btn-secondary" @click="showNodeManage = false">✕ 关闭</button>
        </div>
        
        <div style="max-height:400px;overflow-y:auto">
          <div v-if="nodes.length === 0" style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">
             暂无节点
          </div>
          <div v-for="(node, idx) in nodes" :key="idx" 
               style="display:flex;align-items:center;justify-content:space-between;padding:8px;border-bottom:1px solid var(--border)">
             <span style="font-size:13px;color:var(--text-primary)">{{ node.name }}</span>
             <button class="btn btn-sm btn-danger" @click="handleDeleteNode(idx)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Sub URL List -->
    <div v-if="info && info.nodeCount > 0" class="sub-url-list" style="margin-top:16px; display:block">
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
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '../composables/useApi'

const { getInfo, getNodes, clearNodes, deleteNode } = useApi()

const info = ref(null)
const nodes = ref([])
const showNodeManage = ref(false)
const saveStatus = ref('')

async function refreshInfo() {
  try {
    const data = await getInfo()
    info.value = data
  } catch (e) {
    info.value = null
  }
}

async function loadNodes() {
  try {
    const data = await getNodes()
    nodes.value = data.nodes || []
  } catch (e) {
    console.error(e)
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

function copySubLink(format) {
  const url = `${window.location.protocol}//${window.location.hostname}:${info.value.port}/sub?format=${format}`
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
</style>
