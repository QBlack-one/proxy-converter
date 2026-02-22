<template>
  <!-- 订阅链接服务 -->
  <div class="card" id="subServiceCard">
    <div class="card-title">
      <div class="icon icon-sub">🌐</div>
      订阅链接服务
      <span class="server-status" :class="info ? 'online' : 'offline'">
        ● {{ info ? '运行中' : '未连接' }}
      </span>
    </div>

    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px" v-if="info">
      服务已就绪。将当前转换的节点保存到本地服务，生成可供代理客户端订阅的链接。
    </p>

    <!-- 通用订阅链接 -->
    <div style="margin-bottom:16px">
      <label style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:8px;display:block">
        🔗 通用订阅链接
      </label>
      <div style="display:flex;align-items:center;gap:8px">
        <input 
          type="text" 
          :value="universalSubUrl" 
          readonly 
          style="flex:1;padding:10px 14px;background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:13px;font-family:'JetBrains Mono',monospace"
        />
        <button class="btn btn-primary btn-sm" @click="copyUniversalLink">
          {{ copyStatusUniversal || '📋 复制' }}
        </button>
      </div>
    </div>

    <!-- 格式订阅链接列表 -->
    <div v-if="info && info.formats" class="sub-url-list" style="margin-bottom:16px">
      <label style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;margin-bottom:10px;display:block">
        📋 各格式订阅链接（点击复制）
      </label>
      <div class="sub-url-grid">
        <div v-for="fmt in info.formats" :key="fmt" class="sub-url-item" @click="copySubLink(fmt)">
          <span class="sub-url-icon">🔗</span>
          <div class="sub-url-info">
            <span class="sub-url-name">{{ fmt }}</span>
            <span class="sub-url-desc">点击复制链接</span>
          </div>
          <span class="sub-url-link">{{ universalSubUrl }}?format={{ fmt }}</span>
          <span class="sub-url-copy">📋</span>
        </div>
      </div>
    </div>
  </div>

  <!-- 节点列表 - 独立卡片 -->
  <div class="card" id="nodeListCard">
    <div class="card-title">
      <div class="icon icon-nodes">🌍</div>
      节点列表
      <span class="text-muted" style="margin-left:auto">
        {{ filteredNodes.length }} / {{ nodes.length }} 个节点
      </span>
    </div>

    <!-- 搜索 + 协议过滤 -->
    <div class="filter-bar">
      <input v-model="searchQuery" type="text" placeholder="搜索节点名称、服务器地址..." class="search-input" />
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span 
          :class="['filter-chip', selectedType === '' ? 'active' : '']" 
          @click="selectedType = ''"
        >
          总计 <span class="chip-count">{{ nodes.length }}</span>
        </span>
        <span 
          v-for="(count, type) in protocolStats" 
          :key="type"
          :class="['filter-chip', selectedType === type ? 'active' : '']"
          @click="selectedType = selectedType === type ? '' : type"
        >
          {{ type }} <span class="chip-count">{{ count }}</span>
        </span>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="btn-row" style="margin-top:0;margin-bottom:16px">
      <button class="btn btn-sm btn-secondary" @click="loadNodes">🔄 刷新</button>
      <button class="btn btn-sm btn-danger" @click="handleClearNodes">🗑️ 清空所有</button>
      <span v-if="saveStatus" class="text-muted">{{ saveStatus }}</span>
    </div>

    <!-- 节点卡片网格 -->
    <div v-if="nodesLoading" class="empty-state">
      <div class="empty-icon">⏳</div>
      <p>加载中...</p>
    </div>
    <div v-else-if="filteredNodes.length === 0" class="empty-state">
      <div class="empty-icon">📭</div>
      <p>{{ nodes.length === 0 ? '暂无节点，请先在上方输入代理链接并转换' : '无匹配节点' }}</p>
    </div>
    <div v-else class="node-grid">
      <div 
        v-for="(node, idx) in filteredNodes" 
        :key="node.id || idx" 
        :class="['node-card', 'type-' + (node.type || 'unknown').toLowerCase() + '-card']"
      >
        <div class="node-header">
          <span class="node-name" :title="node.name">{{ node.name }}</span>
          <span :class="['node-type', 'type-' + (node.type || 'unknown').toLowerCase()]">
            {{ node.type || 'UNKNOWN' }}
          </span>
        </div>
        <div class="node-info">
          <div class="node-info-item" v-if="node.server && node.server !== 'unknown'">
            <span class="label">服务器</span>
            <span class="value">{{ node.server }}:{{ node.port }}</span>
          </div>
          <template v-if="node._details">
            <div class="node-info-item" v-if="node._details.uuid">
              <span class="label">UUID</span>
              <span class="value">{{ node._details.uuid }}</span>
            </div>
            <div class="node-info-item" v-if="node._details.cipher || node._details.method">
              <span class="label">加密</span>
              <span class="value">{{ node._details.cipher || node._details.method }}</span>
            </div>
            <div class="node-info-item" v-if="node._details.password">
              <span class="label">密码</span>
              <span class="value">{{ node._details.password }}</span>
            </div>
            <div class="node-info-item" v-if="node._details.network">
              <span class="label">传输</span>
              <span class="value">{{ node._details.network }}</span>
            </div>
            <div class="node-info-item" v-if="node._details.tls !== undefined">
              <span class="label">TLS</span>
              <span class="value" :style="{ color: node._details.tls ? '#34d399' : '#94a3b8', fontWeight: 600 }">
                {{ node._details.tls ? '✓ 启用' : '✗ 关闭' }}
              </span>
            </div>
            <div class="node-info-item" v-if="node._details.flow">
              <span class="label">Flow</span>
              <span class="value">{{ node._details.flow }}</span>
            </div>
            <div class="node-info-item" v-if="node._details['reality-opts']">
              <span class="label">Reality</span>
              <span class="value" style="color:#34d399;font-weight:600">✓ 启用</span>
            </div>
          </template>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:8px">
          <button class="btn btn-sm btn-danger" @click="handleDeleteNode(node._originalIndex)">✕ 删除</button>
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
