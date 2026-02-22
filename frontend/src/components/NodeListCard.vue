<template>
  <div class="card" id="nodeListCard">
    <div class="card-title">
      <div class="icon icon-nodes">🌐</div>
      节点列表
      <span id="nodeCount" class="text-muted" style="margin-left:auto">
        {{ filteredNodes.length }} / {{ nodes.length }} 个节点
      </span>
    </div>

    <!-- 搜索与类型过滤 -->
    <div class="filter-bar">
      <input type="text" class="search-input" v-model="searchQuery" placeholder="搜索节点名称、服务器地址...">
      <div id="filterChips" style="display:flex;gap:6px;flex-wrap:wrap">
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

    <!-- 批量管理与单点操作 (仅当有节点时显示隐藏选项) -->
    <div v-if="nodes.length === 0" class="empty-state" style="grid-column:1/-1">
      <div class="empty-icon">🔍</div>
      <p>没有匹配的节点</p>
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
              <span class="value">********</span>
            </div>
            <div class="node-info-item" v-if="node._details.network">
              <span class="label">传输</span>
              <span class="value">{{ node._details.network }}</span>
            </div>
            <div class="node-info-item" v-if="node._details.protocol">
              <span class="label">协议</span>
              <span class="value">{{ node._details.protocol }}</span>
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
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  nodes: {
    type: Array,
    default: () => []
  }
})

const searchQuery = ref('')
const selectedType = ref('')

// Compute parsed details and stats
const parsedNodes = computed(() => {
  return props.nodes.map((node, idx) => {
    let details = {}
    try {
      if (node.details && node.details !== '{}') {
        details = JSON.parse(node.details)
      }
    } catch (e) {}
    return { ...node, _details: details, _originalIndex: idx }
  })
})

const protocolStats = computed(() => {
  const stats = {}
  for (const node of parsedNodes.value) {
    const t = (node.type || 'UNKNOWN').toUpperCase()
    stats[t] = (stats[t] || 0) + 1
  }
  return stats
})

const filteredNodes = computed(() => {
  let result = parsedNodes.value
  if (selectedType.value) {
    result = result.filter(n => (n.type || '').toUpperCase() === selectedType.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(n => 
      (n.name || '').toLowerCase().includes(q) || 
      (n.server || '').toLowerCase().includes(q) ||
      (n.type || '').toLowerCase().includes(q)
    )
  }
  return result
})
</script>
