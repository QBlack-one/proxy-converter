<template>
  <!-- 订阅链接服务 -->
  <div class="card" id="subServiceCard">
    <div class="card-title">
      <div class="icon" style="background:rgba(99,102,241,0.15)">🌐</div>
      订阅链接服务
      <span class="server-status" :class="info ? 'online' : 'offline'">
        ● {{ info ? '运行中' : '未连接' }}
      </span>
    </div>

    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
      将当前转换的节点保存到本地服务，生成可供代理客户端订阅的链接。
      更新节点后重新保存，客户端刷新订阅即可获取最新节点。<br>
      <code style="background:rgba(99,102,241,0.15);padding:2px 8px;border-radius:4px;font-size:12px">node server.js</code> 启动服务。
    </p>

    <!-- 订阅信息统计 (如果有的话) -->
    <div v-if="hasSubStats" class="sub-info-stats">
      <div class="sub-info-item" v-if="subStats.traffic">
        <div class="sub-info-label">📊 流量使用</div>
        <div class="sub-info-value">{{ subStats.traffic.usedFormatted }} / {{ subStats.traffic.totalFormatted }}</div>
        <div class="sub-info-extra">{{ subStats.traffic.total === 0 ? '无限流量' : subStats.traffic.percent + '% 已使用' }}</div>
        <div class="traffic-bar" v-if="subStats.traffic.total !== 0">
          <div 
            class="traffic-bar-fill" 
            :class="{ danger: subStats.traffic.percent >= 90, warning: subStats.traffic.percent >= 75 }" 
            :style="{ width: Math.min(subStats.traffic.percent, 100) + '%' }"
          ></div>
        </div>
      </div>
      <div class="sub-info-item" v-if="subStats.traffic">
        <div class="sub-info-label">⬆️ 上传</div>
        <div class="sub-info-value">{{ subStats.traffic.uploadFormatted }}</div>
      </div>
      <div class="sub-info-item" v-if="subStats.traffic">
        <div class="sub-info-label">⬇️ 下载</div>
        <div class="sub-info-value">{{ subStats.traffic.downloadFormatted }}</div>
      </div>
      <div class="sub-info-item" v-if="subStats.expire">
        <div class="sub-info-label">⏰ 到期时间</div>
        <div class="sub-info-value">{{ subStats.expire }}</div>
      </div>
    </div>

    <!-- 保存按钮行 -->
    <div class="btn-row" style="margin-bottom:16px">
      <button class="btn btn-primary" @click="handleSaveToService" :disabled="saving">
        {{ saving ? '⏳ 保存中...' : '💾 保存当前节点到订阅服务' }}
      </button>
      <button class="btn btn-secondary" @click="$emit('toggle-manage')">⚙️ 管理订阅信息</button>
      <button class="btn btn-secondary" @click="showNodeManage = !showNodeManage">📋 节点管理</button>
      <button class="btn btn-danger" @click="handleClearAllNodes">🗑️ 清空所有节点</button>
      <span v-if="saveStatus" style="font-size:12px;color:var(--text-muted);align-self:center">{{ saveStatus }}</span>
    </div>

    <!-- 节点管理面板 -->
    <div v-if="showNodeManage" style="margin-bottom:16px">
      <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <span style="font-weight:600;font-size:14px">📋 订阅节点管理</span>
          <div style="display:flex;gap:8px;align-items:center">
            <span style="font-size:12px;color:var(--text-muted)">共 {{ externalNodes.length }} 个节点</span>
            <button class="btn btn-sm btn-secondary" @click="showNodeManage = false">✕ 关闭</button>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px">
          <input 
            type="text" 
            v-model="newNodeLink"
            placeholder="粘贴协议链接（vmess:// vless:// ss:// trojan:// ...）" 
            style="flex:1;padding:8px 12px;background:var(--bg-primary);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:13px;font-family:monospace"
          >
          <button class="btn btn-sm btn-success" @click="handleAddSingleNode">➕ 添加</button>
        </div>

        <!-- 批量操作栏 -->
        <div v-if="externalNodes.length > 0" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:6px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;margin:0">
            <input 
              type="checkbox" 
              v-model="selectAll" 
              @change="toggleSelectAll"
              style="width:16px;height:16px;accent-color:var(--danger)"
            >
            <span style="font-weight:600">全选</span>
          </label>
          <button 
            class="btn btn-sm" 
            :style="selectedIndices.length > 0 ? 'background:#ef4444;color:#fff;border:none' : 'background:rgba(239,68,68,0.1);color:#ef4444;border:none;pointer-events:none'"
            @click="handleBatchDelete"
          >
            🗑️ 删除选中 ({{ selectedIndices.length }})
          </button>
        </div>

        <div style="max-height:400px;overflow-y:auto">
          <div v-if="externalNodes.length === 0" style="text-align:center;padding:20px;color:var(--text-muted)">暂无节点</div>
          <div 
            v-for="node in externalNodes" 
            :key="node.index" 
            style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:13px"
          >
            <input 
              type="checkbox" 
              :value="node.index" 
              v-model="selectedIndices"
              style="width:16px;height:16px;accent-color:var(--danger);cursor:pointer"
            >
            <span style="min-width:24px;color:var(--text-muted);font-size:11px">#{{ node.index }}</span>
            <span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:rgba(255,255,255,0.1)">{{ node.type }}</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ node.name }}</span>
            <button 
              @click="handleDeleteNode(node.index)" 
              style="background:rgba(239,68,68,0.1);color:#ef4444;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;white-space:nowrap"
            >✕ 删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 订阅 URL 列表 -->
    <div v-if="subUrls" class="sub-url-list" style="margin-bottom:16px">
      <label style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;display:block">
        📋 订阅链接（点击复制，添加到客户端）
      </label>
      <div class="sub-url-grid">
        <div v-for="(url, key) in subUrls" :key="key" class="sub-url-item" @click="copyUrl(url)">
          <span class="sub-url-icon">{{ getFormatIcon(key) }}</span>
          <div class="sub-url-info">
            <span class="sub-url-name">{{ getFormatName(key) }}</span>
            <span class="sub-url-desc">{{ getFormatDesc(key) }}</span>
          </div>
          <code class="sub-url-link">{{ url }}</code>
          <span class="sub-url-copy">📋</span>
        </div>
      </div>
      <p class="sub-url-tip">
        💡 将以上任意链接添加到 Clash / Shadowrocket / V2RayN 等客户端的「订阅管理」中。
        更新节点时，在此页面重新粘贴链接 → 转换 → 保存，客户端刷新订阅即可。
      </p>
    </div>

    <!-- 上传历史记录 -->
    <div class="history-section">
      <div class="history-title">
        <span>📜 上传历史</span>
        <button class="btn btn-sm btn-danger" @click="handleClearHistory" style="margin-left:auto">🗑️ 清空</button>
      </div>
      <div class="history-list">
        <div v-if="history.length === 0" class="empty-state" style="padding: 20px; text-align: center; color: var(--text-muted);">
          暂无上传记录
        </div>
        <div v-else class="history-item" v-for="(item, i) in history" :key="i">
          <div class="history-header">
            <span class="history-time">📅 {{ new Date(item.timestamp).toLocaleString() }}</span>
            <span class="history-count">{{ item.nodeCount }} 个节点</span>
          </div>
          <div class="history-nodes">
            {{ item.nodes.slice(0, 5).join('、') }}
            {{ item.nodes.length > 5 ? `... 等 ${item.nodes.length} 个` : '' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useApi } from '../composables/useApi'

const props = defineProps({
  externalNodes: { type: Array, default: () => [] }
})

const emit = defineEmits(['toggle-manage', 'nodes-changed'])

const { getInfo, clearNodes, deleteNode, batchDeleteNodes, getHistory, clearHistory, addNode, saveLinks } = useApi()

const info = ref(null)
const subStats = ref(null)
const subUrls = ref(null)
const saveStatus = ref('')
const saving = ref(false)

const showNodeManage = ref(false)
const newNodeLink = ref('')
const selectedIndices = ref([])
const selectAll = ref(false)
const history = ref([])

const hasSubStats = computed(() => subStats.value !== null)

async function refreshInfo() {
  try {
    const data = await getInfo()
    info.value = data
    if (data.subscription) {
      subStats.value = data.subscription
    }
    await loadHistory()
    
    // Default subscription URLs if nodes exist
    if (data.nodeCount && data.nodeCount > 0) {
      const baseUrl = `${window.location.origin}/sub`
      subUrls.value = {
        universal: baseUrl,
        base64: `${baseUrl}?format=base64`,
        'clash-yaml': `${baseUrl}?format=clash-yaml`,
        'clash-meta': `${baseUrl}?format=clash-meta`,
        surge: `${baseUrl}?format=surge`,
        'sing-box': `${baseUrl}?format=sing-box`,
        raw: `${baseUrl}?format=raw`
      }
    } else {
      subUrls.value = null
    }
  } catch (e) {
    info.value = null
    subStats.value = null
  }
}

async function loadHistory() {
  try {
    const data = await getHistory()
    if (data.success) {
      history.value = data.history || []
    }
  } catch (e) {
    history.value = []
  }
}

async function handleSaveToService() {
  if (props.externalNodes.length === 0) {
    alert('请先粘贴代理链接并转换')
    return
  }
  saving.value = true
  try {
    const rawLinks = props.externalNodes.map(n => n.link || '').join('\n')
    const res = await saveLinks(rawLinks)
    if (res.success) {
      saveStatus.value = `✅ 订阅共 ${res.count} 个节点`
      subUrls.value = res.subUrls
      await refreshInfo()
      emit('nodes-changed')
    }
  } catch (err) {
    saveStatus.value = '❌ 保存失败: ' + err.message
  } finally {
    saving.value = false
    setTimeout(() => saveStatus.value = '', 4000)
  }
}

async function handleClearAllNodes() {
  if (!confirm('⚠️ 确定要清空订阅中的所有节点吗？此操作不可逆！')) return
  try {
    await clearNodes()
    saveStatus.value = '✅ 已清空'
    await refreshInfo()
    emit('nodes-changed')
    setTimeout(() => saveStatus.value = '', 3000)
  } catch (e) {
    alert(e.message)
  }
}

async function handleAddSingleNode() {
  const link = newNodeLink.value.trim()
  if (!link) return
  try {
    await addNode(link)
    newNodeLink.value = ''
    await refreshInfo()
    emit('nodes-changed')
  } catch (e) {
    alert('添加失败: ' + e.message)
  }
}

async function handleDeleteNode(index) {
  if (!confirm(`确定删除 #${index} 节点？`)) return
  try {
    await deleteNode(index)
    selectedIndices.value = selectedIndices.value.filter(i => i !== index)
    await refreshInfo()
    emit('nodes-changed')
  } catch (e) {
    alert('删除失败: ' + e.message)
  }
}

async function handleBatchDelete() {
  if (selectedIndices.value.length === 0) return
  if (!confirm(`确定要批量删除这 ${selectedIndices.value.length} 个节点吗？`)) return
  try {
    await batchDeleteNodes(selectedIndices.value)
    selectedIndices.value = []
    selectAll.value = false
    await refreshInfo()
    emit('nodes-changed')
  } catch (e) {
    alert('批量删除失败: ' + e.message)
  }
}

async function handleClearHistory() {
  if (!confirm('确定清空所有历史记录？')) return
  try {
    await clearHistory()
    loadHistory()
  } catch (e) {
    alert('清空失败: ' + e.message)
  }
}

function toggleSelectAll(e) {
  if (e.target.checked) {
    selectedIndices.value = props.externalNodes.map(n => n.index)
  } else {
    selectedIndices.value = []
  }
}

watch(() => props.externalNodes, (nodes) => {
  if (nodes.length > 0 && selectedIndices.value.length === nodes.length) {
    selectAll.value = true
  } else {
    selectAll.value = false
  }
})

function copyUrl(url) {
  navigator.clipboard.writeText(url).then(() => {
    alert('已复制: ' + url)
  })
}

function getFormatName(key) {
  const map = {
    universal: '通用订阅', base64: 'Base64 订阅', 'clash-yaml': 'Clash YAML',
    'clash-meta': 'Clash Meta', surge: 'Surge', 'sing-box': 'Sing-Box', raw: '原始链接'
  }
  return map[key] || key
}

function getFormatIcon(key) {
  const map = { universal: '🌐', base64: '⚔️', 'clash-yaml': '📄', 'clash-meta': '🌀', surge: '🌊', 'sing-box': '📦', raw: '📋' }
  return map[key] || '🔗'
}

function getFormatDesc(key) {
  const map = {
    universal: '自动识别客户端（推荐）', base64: 'Base64 编码', 'clash-yaml': 'Clash 完整配置',
    'clash-meta': 'Mihomo / Verge Rev', surge: 'Surge iOS/macOS', 'sing-box': 'Sing-Box / NekoBox', raw: '通用'
  }
  return map[key] || ''
}

onMounted(() => {
  refreshInfo()
})
</script>

