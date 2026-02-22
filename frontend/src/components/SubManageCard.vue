<template>
  <div class="card" v-if="isVisible">
    <div class="card-title">
      <div class="icon" style="background:rgba(139,92,246,0.15)">📊</div>
      订阅信息管理
      <button class="btn btn-sm btn-secondary" @click="$emit('close')" style="margin-left:auto">✕ 关闭</button>
    </div>
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
      配置订阅流量和到期时间信息，客户端会自动读取这些信息。
    </p>

    <!-- API 密钥设置 -->
    <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:8px;padding:12px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:12px;font-weight:600;color:#f59e0b">🔐 API 密钥</span>
        <span style="font-size:11px;color:var(--text-muted)">(可选，用于保护管理接口)</span>
      </div>
      <div style="display:flex;gap:8px">
        <input 
          type="password" 
          v-model="apiKey" 
          placeholder="留空则不启用认证"
          style="flex:1;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:13px"
        />
        <button class="btn btn-sm btn-secondary" @click="handleSaveApiKey">保存密钥</button>
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin-top:6px;margin-bottom:0">
        💡 设置后，所有管理操作需要提供此密钥。密钥保存在浏览器本地。
      </p>
    </div>

    <!-- 订阅配置表单 -->
    <div class="config-grid">
      <div class="config-item" style="grid-column: 1 / -1">
        <label>订阅名称</label>
        <input type="text" v-model="config.title" placeholder="我的代理订阅">
      </div>

      <div class="config-item">
        <label>更新间隔（小时）</label>
        <input type="number" v-model.number="config.updateInterval" min="1" max="168">
      </div>

      <div class="config-item">
        <label>启用流量统计</label>
        <select v-model="config.traffic.enabled">
          <option :value="true">是</option>
          <option :value="false">否</option>
        </select>
      </div>

      <template v-if="config.traffic.enabled">
        <div class="config-item">
          <label>已上传（GB）</label>
          <input type="number" v-model.number="trafficUploadGB" min="0" step="0.01">
        </div>

        <div class="config-item">
          <label>已下载（GB）</label>
          <input type="number" v-model.number="trafficDownloadGB" min="0" step="0.01">
        </div>

        <div class="config-item">
          <label>总流量（GB）</label>
          <input type="number" v-model.number="trafficTotalGB" min="0" step="1">
        </div>

        <div class="config-item">
          <label>每月重置日期</label>
          <input type="number" v-model.number="config.traffic.resetDay" min="1" max="31">
        </div>
      </template>
    </div>

    <div class="btn-row" style="margin-top:16px">
      <button class="btn btn-success" @click="handleSaveConfig" :disabled="loading">
        {{ loading ? '⏳ 保存中...' : '💾 保存配置' }}
      </button>
      <button class="btn btn-secondary" @click="loadConfig" :disabled="loading">🔄 重新加载</button>
      <button class="btn btn-danger" @click="handleResetTraffic" :disabled="loading">🔄 重置流量</button>
      <span v-if="statusMsg" :style="{ color: statusIsError ? 'var(--danger)' : 'var(--success)' }" style="align-self:center;font-size:12px;margin-left:8px">
        {{ statusMsg }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useApi } from '../composables/useApi'

const props = defineProps({
  isVisible: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'config-saved'])

const { 
  getSubscriptionConfig, 
  saveSubscriptionConfig, 
  resetTraffic, 
  getApiKey, 
  setApiKey,
  loading 
} = useApi()

const apiKey = ref('')
const statusMsg = ref('')
const statusIsError = ref(false)

const config = ref({
  title: '',
  updateInterval: 24,
  traffic: {
    enabled: true,
    upload: 0,
    download: 0,
    total: 100 * 1073741824, // 100GB default
    resetDay: 1
  }
})

// Compute GB properties
const trafficUploadGB = computed({
  get: () => Number((config.value.traffic.upload / 1073741824).toFixed(2)),
  set: (val) => { config.value.traffic.upload = Math.round(val * 1073741824) }
})

const trafficDownloadGB = computed({
  get: () => Number((config.value.traffic.download / 1073741824).toFixed(2)),
  set: (val) => { config.value.traffic.download = Math.round(val * 1073741824) }
})

const trafficTotalGB = computed({
  get: () => Number((config.value.traffic.total / 1073741824).toFixed(0)),
  set: (val) => { config.value.traffic.total = Math.round(val * 1073741824) }
})

function showStatus(msg, isError = false) {
  statusMsg.value = msg
  statusIsError.value = isError
  setTimeout(() => { if (statusMsg.value === msg) statusMsg.value = '' }, 3000)
}

function handleSaveApiKey() {
  setApiKey(apiKey.value)
  showStatus(apiKey.value ? '✅ API 密钥已保存' : '✅ API 密钥已清除')
}

async function loadConfig() {
  try {
    const res = await getSubscriptionConfig()
    if (res.success && res.subscription) {
      const sub = res.subscription
      config.value.title = sub.title || ''
      config.value.updateInterval = sub.updateInterval || 24
      if (sub.traffic) {
        config.value.traffic = { ...config.value.traffic, ...sub.traffic }
      }
      showStatus('✅ 配置已加载')
    }
  } catch (err) {
    showStatus('❌ 加载失败: ' + err.message, true)
  }
}

async function handleSaveConfig() {
  try {
    const res = await saveSubscriptionConfig(config.value)
    if (res.success) {
      showStatus('✅ 配置已保存')
      emit('config-saved')
    }
  } catch (err) {
    showStatus('❌ 保存失败: ' + err.message, true)
  }
}

async function handleResetTraffic() {
  if (!confirm('确定要重置流量统计吗？上传和下载流量将归零。')) return
  try {
    const res = await resetTraffic()
    if (res.success) {
      showStatus('✅ 流量已重置')
      await loadConfig()
      emit('config-saved')
    }
  } catch (err) {
    showStatus('❌ 重置失败: ' + err.message, true)
  }
}

watch(() => props.isVisible, (visible) => {
  if (visible) {
    apiKey.value = getApiKey()
    loadConfig()
  }
})

onMounted(() => {
  apiKey.value = getApiKey()
  if (props.isVisible) loadConfig()
})
</script>
