<template>
  <div class="app-container container">
    <AppHeader />

    <InputCard @convert="handleConvert" />

    <ConfigCard v-model="config" />

    <div class="card" v-if="results.length > 0">
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

const results = ref([])
const loading = ref(false)
const outputText = ref('')
const currentFormat = ref('clash-yaml')

const formats = [
  { id: 'clash-yaml', name: 'Clash YAML' },
  { id: 'clash-meta', name: 'Clash Meta' },
  { id: 'surge', name: 'Surge' },
  { id: 'sing-box', name: 'Sing-Box' },
  { id: 'base64', name: 'Base64 订阅' },
  { id: 'raw', name: '原始链接' }
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
      const subRes = await fetch(`/sub?format=${currentFormat.value}`)
      const text = await subRes.text()
      outputText.value = text
      results.value = [1] 
    }
  } catch (err) {
    console.error(err)
    outputText.value = '转换失败: ' + err.message
  } finally {
    loading.value = false
  }
}

watch(currentFormat, () => {
  if (results.value.length > 0) fetchConversion()
})
watch(config, () => {
  if (results.value.length > 0) fetchConversion()
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
}
</style>
