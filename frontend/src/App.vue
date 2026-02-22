<template>
  <div class="app-container container">
    <AppHeader />

    <InputCard @convert="handleConvert" />

    <ConfigCard v-model="config" />

    <!-- 解析结果统计 -->
    <div class="card" v-if="parseResult">
      <div class="card-title">
        <div class="icon icon-filter">⚡</div>
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

    <!-- 配置输出 -->
    <div class="card" v-if="parseResult">
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

      <div class="btn-row" style="justify-content:flex-end">
        <button class="btn btn-primary btn-sm" @click="copyOutput">
          {{ copyStatus || '📋 复制配置' }}
        </button>
        <button class="btn btn-secondary btn-sm" @click="downloadOutput">
          💾 下载文件
        </button>
      </div>
    </div>

    <SubServiceCard />

    <ExportCard />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import AppHeader from './components/AppHeader.vue'
import InputCard from './components/InputCard.vue'
import ConfigCard from './components/ConfigCard.vue'
import SubServiceCard from './components/SubServiceCard.vue'
import ExportCard from './components/ExportCard.vue'
import { useApi } from './composables/useApi'

const { saveLinks } = useApi()

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
const loading = ref(false)
const outputText = ref('')
const currentFormat = ref('clash-yaml')
const copyStatus = ref('')

const formats = [
  { id: 'clash-yaml', name: 'Clash YAML', ext: '.yaml' },
  { id: 'clash-meta', name: 'Clash Meta', ext: '.yaml' },
  { id: 'surge', name: 'Surge', ext: '.conf' },
  { id: 'sing-box', name: 'Sing-Box', ext: '.json' },
  { id: 'base64', name: 'Base64 订阅', ext: '.txt' },
  { id: 'raw', name: '原始链接', ext: '.txt' }
]

const recentLinks = ref('')

async function handleConvert(links) {
  if (!links.trim()) return
  recentLinks.value = links
  await fetchConversion()
}

async function fetchConversion() {
  if (!recentLinks.value) return
  loading.value = true
  try {
    const data = await saveLinks(recentLinks.value)
    if (data.success) {
      parseResult.value = {
        count: data.count || 0,
        newCount: data.newCount || 0,
        duplicateCount: data.duplicateCount || 0,
        typeStats: {}
      }

      try {
        const nodesRes = await fetch('/api/nodes')
        const nodesData = await nodesRes.json()
        if (nodesData.nodes) {
          parseResult.value.count = nodesData.nodes.length
          const stats = {}
          for (const n of nodesData.nodes) {
            const t = (n.type || 'UNKNOWN').toUpperCase()
            stats[t] = (stats[t] || 0) + 1
          }
          parseResult.value.typeStats = stats
        }
      } catch (e) {}

      const subRes = await fetch(`/sub?format=${currentFormat.value}`)
      const text = await subRes.text()
      outputText.value = text
    }
  } catch (err) {
    console.error(err)
    outputText.value = '转换失败: ' + err.message
  } finally {
    loading.value = false
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
  const blob = new Blob([outputText.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `proxy-config${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

watch(currentFormat, () => {
  if (parseResult.value) fetchConversion()
})
watch(config, () => {
  if (parseResult.value) fetchConversion()
}, { deep: true })
</script>
