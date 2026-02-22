<template>
  <div class="app-container container">
    <AppHeader />

    <InputCard @convert="handleConvert" />

    <ConfigCard v-model="config" />

    <!-- 解析结果统计 -->
    <div class="card" v-if="parseResult">
      <div class="card-title">
        <div class="icon" style="background:rgba(99,102,241,0.15)">⚡</div>
        解析结果
      </div>
      <div class="parse-stats">
        <div class="stat-tag stat-total">
          总计 <b>{{ parseResult.count }}</b>
        </div>
        <div 
          v-for="(count, type) in parseResult.typeStats" 
          :key="type"
          :class="['stat-tag', 'stat-' + type.toLowerCase()]"
        >
          {{ type }} <b>{{ count }}</b>
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

      <div class="output-preview">
        <pre v-if="loading">加载中...</pre>
        <pre v-else>{{ outputText }}</pre>
      </div>

      <div class="output-actions">
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
      // 构建解析结果统计
      parseResult.value = {
        count: data.count || data.newCount || 0,
        newCount: data.newCount || 0,
        duplicateCount: data.duplicateCount || 0,
        typeStats: {}
      }

      // 获取当前节点列表以统计协议类型
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

<style scoped>
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  padding: 1rem;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  background: rgba(0,0,0,0.3);
  border-radius: 8px;
  color: var(--text-primary);
  max-height: 400px;
  overflow-y: auto;
}

/* 解析结果统计标签 */
.parse-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.stat-tag {
  padding: 8px 18px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.stat-tag b {
  margin-left: 6px;
  font-size: 16px;
}
.stat-total { border-color: rgba(99,102,241,0.4); color: #818cf8; }
.stat-total b { color: #a5b4fc; }
.stat-vmess { border-color: rgba(99,102,241,0.3); color: #818cf8; }
.stat-vless { border-color: rgba(16,185,129,0.3); color: #34d399; }
.stat-ss { border-color: rgba(245,158,11,0.3); color: #fbbf24; }
.stat-ssr { border-color: rgba(239,68,68,0.3); color: #f87171; }
.stat-trojan { border-color: rgba(168,85,247,0.3); color: #c084fc; }
.stat-hysteria, .stat-hysteria2 { border-color: rgba(236,72,153,0.3); color: #f472b6; }
.stat-tuic { border-color: rgba(14,165,233,0.3); color: #38bdf8; }
.stat-wireguard { border-color: rgba(34,197,94,0.3); color: #4ade80; }
.stat-socks5 { border-color: rgba(251,146,60,0.3); color: #fb923c; }
.stat-unknown { border-color: rgba(148,163,184,0.3); color: #94a3b8; }

/* 输出操作按钮 */
.output-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
