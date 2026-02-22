<template>
  <div class="card">
    <div class="card-title">
      <div class="icon icon-input">📋</div>
      输入源
      <span class="text-muted" style="margin-left:auto;font-size:12px">支持拖拽文件 · Ctrl+Enter 快速转换</span>
    </div>
    <div class="input-wrapper">
      <textarea 
        v-model="inputRaw"
        placeholder="在此粘贴代理链接（每行一个），支持以下格式：\n\n  vmess:// · vless:// · ss:// · ssr://\n  trojan:// · hysteria:// · hysteria2:// (hy2://)\n  tuic:// · wireguard:// (wg://)\n  socks5:// · snell:// · naive+https:// · anytls://\n\n也支持直接粘贴 Base64 编码的订阅内容"
      ></textarea>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" @click="emit('convert', inputRaw)">🔄 转换</button>
      <button class="btn btn-secondary" @click="pasteFromClipboard">📎 粘贴</button>
      <button class="btn btn-secondary" @click="loadSample">📦 示例数据</button>
      <button class="btn btn-danger" @click="clearAll">🗑️ 清空</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['convert'])
const inputRaw = ref('')

function pasteFromClipboard() {
  navigator.clipboard.readText().then(text => {
    inputRaw.value = text
  }).catch(err => {
    console.error('Failed to read clipboard contents: ', err)
  })
}

function loadSample() {
  inputRaw.value = 'vmess://eyJ2IjoiMiIsInBzIjoi5L6L5a2Q6IqC54K5IiwiYWRkIjoiZXhhbXBsZS5jb20iLCJwb3J0IjoiNDQzIiwiaWQiOiI3MzRiNGI1My0xNWYyLTRiOGItOTIxNC1hMWQxZWZkOGE4N2EiLCJhaWQiOiIwIiwibmV0Ijoid3MiLCJ0eXBlIjoibm9uZSIsImhvc3QiOiIiLCJwYXRoIjoiL3BhdGgiLCJ0bHMiOiJ0bHMifQ==\nss://YWVzLTI1Ni1nY206cGFzc3dvcmQ@example.com:8388#ExampleSS'
}

function clearAll() {
  inputRaw.value = ''
}
</script>
