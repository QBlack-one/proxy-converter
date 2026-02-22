<template>
  <div class="card">
    <div class="card-title">
      <div class="icon icon-settings">⚙️</div>
      配置选项
    </div>
    <div class="config-grid">
      <div class="config-item">
        <label>HTTP 端口</label>
        <input type="number" v-model="config.httpPort" min="1" max="65535">
      </div>
      <div class="config-item">
        <label>SOCKS5 端口</label>
        <input type="number" v-model="config.socksPort" min="1" max="65535">
      </div>
      <div class="config-item">
        <label>代理模式</label>
        <select v-model="config.mode">
          <option value="rule">Rule（规则）</option>
          <option value="global">Global（全局）</option>
          <option value="direct">Direct（直连）</option>
        </select>
      </div>
      <div class="config-item">
        <label>允许局域网</label>
        <select v-model="config.allowLan">
          <option :value="true">是</option>
          <option :value="false">否</option>
        </select>
      </div>
      <div class="config-item">
        <label>日志级别</label>
        <select v-model="config.logLevel">
          <option value="silent">Silent</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>
      </div>
      <div class="config-item">
        <label>DNS 增强</label>
        <select v-model="config.enableDns">
          <option :value="true">启用 (fake-ip)</option>
          <option :value="false">禁用</option>
        </select>
      </div>
      <div class="config-item">
        <label>测速间隔 (秒)</label>
        <input type="number" v-model="config.interval" min="30" max="3600">
      </div>
      <div class="config-item">
        <label>自动去重</label>
        <label style="text-transform:none;display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:400">
          <input type="checkbox" v-model="config.deduplicate" style="width:16px;height:16px;accent-color:var(--accent-1)">
          <span style="font-size:13px;color:var(--text-secondary)">移除重复节点</span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'

const props = defineProps(['modelValue'])
const emit = defineEmits(['update:modelValue'])

const config = reactive({
  httpPort: 7890,
  socksPort: 7891,
  mode: 'rule',
  allowLan: true,
  logLevel: 'info',
  enableDns: true,
  interval: 300,
  deduplicate: true,
  ...props.modelValue
})

watch(config, (val) => {
  emit('update:modelValue', val)
}, { deep: true })
</script>
