<template>
  <div class="app-container container">
    <AppHeader />

    <InputCard @convert="handleConvert" />

    <SubManageCard 
      :is-visible="showSubManage" 
      @close="showSubManage = false" 
      @config-saved="onSubConfigSaved"
    />

    <ConfigCard v-model="config" />

    <!-- Results Section -->
    <div id="resultsSection" v-if="parseResult">
      <!-- 解析结果统计 -->
      <div class="card">
        <div class="card-title">
          <div class="icon icon-nodes">📊</div>
          解析结果
        </div>
        <div class="stats-row">
          <div class="stat-chip">
            总计 <span class="count">{{ parseResult.count }}</span>
          </div>
          <div 
            v-for="(count, type) in parseResult.typeStats" 
            :key="type"
            class="stat-chip"
          >
            {{ type }} <span class="count">{{ count }}</span>
          </div>
        </div>
      </div>

      <!-- Node List -->
      <NodeListCard :nodes="nodes" />
      
      <!-- 配置输出 -->
      <div class="card">
        <div class="card-title">
          <div class="icon icon-output">📄</div>
          配置输出
        </div>
        
        <div class="format-tabs">
          <button 
            v-for="fmt in formats" 
            :key="fmt.id" 
            :class="['format-tab', currentFormat === fmt.id ? 'active' : '']"
            @click="currentFormat = fmt.id"
          >
            {{ fmt.name }}
          </button>
        </div>

        <div class="output-preview">{{ loading ? '加载中...' : outputText }}</div>

        <div class="btn-row">
          <button class="btn btn-success" @click="downloadOutput">
            💾 下载 {{ formats.find(f => f.id === currentFormat)?.name || '配置' }}
          </button>
          <button class="btn btn-secondary" @click="copyOutput">
            {{ copyStatus || '📋 复制配置' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 传入 showSubManage 状态和 toggle 方法 -->
    <SubServiceCard 
      :external-nodes="nodes" 
      @toggle-manage="showSubManage = !showSubManage" 
      @nodes-changed="fetchNodes"
    />

    <ExportCard :nodes="nodes" />
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import AppHeader from './components/AppHeader.vue'
import InputCard from './components/InputCard.vue'
import ConfigCard from './components/ConfigCard.vue'
import SubManageCard from './components/SubManageCard.vue'
import NodeListCard from './components/NodeListCard.vue'
import SubServiceCard from './components/SubServiceCard.vue'
import ExportCard from './components/ExportCard.vue'
import { useApi } from './composables/useApi'

const { saveLinks, getNodes, loading } = useApi()

const config = ref({
  httpPort: 7890,
  socksPort: 7891,
  mode: 'rule',
  allowLan: true,
  logLevel: 'info',
  enableDns: true,
  interval: 300,
  deduplicate: true
})

const parseResult = ref(null)
const nodes = ref([])
const outputText = ref('')
const currentFormat = ref('clash-yaml')
const copyStatus = ref('')
const showSubManage = ref(false)

const formats = [
  { id: 'clash-yaml', name: 'Clash YAML', ext: '.yaml' },
  { id: 'clash-meta', name: 'Clash Meta', ext: '.yaml' },
  { id: 'surge', name: 'Surge', ext: '.conf' },
  { id: 'sing-box', name: 'Sing-Box', ext: '.json' },
  { id: 'base64', name: 'Base64 订阅', ext: '.txt' },
  { id: 'raw', name: '原始链接', ext: '.txt' }
]

const recentLinks = ref('')

function onSubConfigSaved() {
  // optionally refresh SubServiceCard
}

async function fetchNodes() {
  try {
    const data = await getNodes()
    nodes.value = data.nodes || []
    return data.nodes || []
  } catch (e) {
    console.error('Failed to fetch nodes', e)
    return []
  }
}

async function handleConvert(links) {
  if (!links.trim()) return
  recentLinks.value = links
  await fetchConversion()
}

async function fetchConversion() {
  if (!recentLinks.value) return
  try {
    const data = await saveLinks(recentLinks.value)
    if (data.success) {
      parseResult.value = {
        count: data.count || 0,
        newCount: data.newCount || 0,
        duplicateCount: data.duplicateCount || 0,
        typeStats: {}
      }

      const nodeList = await fetchNodes()
      parseResult.value.count = nodeList.length
      const stats = {}
      for (const n of nodeList) {
        const t = (n.type || 'UNKNOWN').toUpperCase()
        stats[t] = (stats[t] || 0) + 1
      }
      parseResult.value.typeStats = stats

      const subRes = await fetch(`/sub?format=${currentFormat.value}`)
      const text = await subRes.text()
      outputText.value = text
    }
  } catch (err) {
    console.error(err)
    outputText.value = '转换失败: ' + err.message
  }
}

function copyOutput() {
  if (!outputText.value) return
  navigator.clipboard.writeText(outputText.value).then(() => {
    copyStatus.value = '✅ 已复制'
    setTimeout(() => copyStatus.value = '', 2000)
  })
}

function downloadOutput() {
  if (!outputText.value) return
  const fmt = formats.find(f => f.id === currentFormat.value)
  const ext = fmt ? fmt.ext : '.txt'
  const title = 'xinghe'
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  
  const blob = new Blob([outputText.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title}_${dateStr}${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

watch(currentFormat, () => {
  if (parseResult.value) fetchConversion()
})
watch(config, () => {
  if (parseResult.value) fetchConversion()
}, { deep: true })

onMounted(() => {
  fetchNodes()
})
</script>
