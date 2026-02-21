# 更新日志

## 2026-02-21 - Web 管理界面和 API 认证

### 🎛️ 新功能
**Web 管理界面** - 在前端直接管理订阅信息

1. **可视化配置**
   - 订阅名称和更新间隔设置
   - 流量统计配置（上传/下载/总量/重置日期）
   - 到期时间设置（日期时间选择器）
   - 实时保存到 config.json

2. **操作按钮**
   - 💾 保存配置 - 立即保存到配置文件
   - 🔄 重新加载 - 从服务器重新读取配置
   - 🔄 重置流量 - 一键清零上传和下载流量

3. **智能表单**
   - 启用/禁用流量统计和到期时间
   - 自动显示/隐藏相关输入框
   - GB 单位输入，自动转换为字节
   - 日期时间选择器，自动转换为 Unix 时间戳

### 🔐 API 认证保护

**安全认证机制** - 保护管理接口免受未授权访问

1. **配置选项**
   ```json
   {
     "security": {
       "apiKey": "your-secret-key",
       "enableAuth": true
     }
   }
   ```

2. **认证方式**
   - `X-API-Key` 请求头
   - `Authorization: Bearer` 请求头
   - 两种方式均支持

3. **受保护端点**
   - `POST /api/save` - 保存节点
   - `POST /api/subscription` - 更新订阅配置
   - `POST /api/subscription/reset-traffic` - 重置流量

4. **前端集成**
   - 在管理面板设置 API 密钥
   - 密钥保存在浏览器 localStorage
   - 所有请求自动携带认证头
   - 认证失败时显示友好提示

5. **安全特性**
   - 订阅端点 `/sub` 不需要认证（客户端访问）
   - 查询端点不需要认证
   - 只有修改操作需要认证
   - 401 状态码和详细错误信息

### 📡 新增 API

- `GET /api/subscription` - 获取当前订阅配置
- `POST /api/subscription` - 更新订阅配置（需认证）
- `POST /api/subscription/reset-traffic` - 重置流量统计（需认证）

---

## 2026-02-20 - 订阅信息功能

### 📊 新功能
**订阅流量和到期时间显示** - 支持显示流量使用情况和订阅到期时间

1. **标准响应头支持**
   - `Subscription-Userinfo`: 流量统计（上传、下载、总量、到期时间）
   - `Profile-Update-Interval`: 更新间隔（小时）
   - `Profile-Title`: 订阅名称（Base64 编码）
   - 符合主流代理客户端订阅协议标准

2. **配置选项**
   ```json
   {
     "subscription": {
       "title": "我的代理订阅",
       "updateInterval": 24,
       "traffic": {
         "enabled": true,
         "upload": 0,
         "download": 5368709120,
         "total": 107374182400,
         "resetDay": 1
       },
       "expire": {
         "enabled": true,
         "timestamp": 1767225600
       }
     }
   }
   ```

3. **前端显示**
   - 📊 流量使用进度条（带颜色警告：75% 橙色，90% 红色）
   - ⬆️ 上传流量格式化显示（GB/MB/KB）
   - ⬇️ 下载流量格式化显示
   - ⏰ 到期时间和剩余天数（≤7天橙色，≤3天红色）
   - 实时更新，自动刷新

4. **API 增强**
   - `GET /api/info` 返回完整订阅信息
   - 包含流量百分比、格式化显示、剩余天数等计算结果
   - 支持动态配置，无需重启服务

5. **使用场景**
   - 机场订阅流量显示
   - 个人订阅管理
   - 流量监控和提醒
   - 到期时间追踪

---

## 2026-02-20 - 通用订阅链接

### 🌐 新功能
**通用订阅链接** - 一个链接支持所有代理客户端

1. **自动识别客户端**
   - 通过 User-Agent 自动识别客户端类型
   - 返回最适合该客户端的配置格式
   - 无需手动选择格式参数

2. **支持的客户端**
   - Clash Verge / Clash Meta / Mihomo → clash-meta
   - Clash → clash-yaml
   - Surge → surge
   - Sing-Box / NekoBox → sing-box
   - Shadowrocket / Quantumult X / V2RayN → base64
   - 其他客户端 → base64（默认）

3. **使用方式**
   ```
   http://localhost:3456/sub
   ```
   在任何代理客户端中添加此链接，自动获取适配格式。

4. **前端更新**
   - 订阅链接列表新增「通用订阅」选项（置顶推荐）
   - 显示 🌐 图标和「自动识别客户端」说明

---

## 2026-02-20 - 自动更新功能

### 🔄 新功能
**订阅自动更新** - 支持从远程订阅源自动更新节点

1. **配置自动更新**
   ```json
   {
     "autoUpdate": {
       "enabled": true,
       "interval": 3600,
       "sources": [
         "https://example.com/subscription1",
         "https://example.com/subscription2"
       ]
     }
   }
   ```

2. **功能特性**
   - 定时自动从多个订阅源获取节点
   - 自动合并去重
   - 支持 Base64 编码的订阅
   - 30秒请求超时
   - 失败重试机制
   - 优雅关闭处理

3. **手动触发更新**
   ```bash
   curl -X POST http://localhost:3456/api/update
   ```

4. **使用场景**
   - 聚合多个订阅源
   - 自动保持节点最新
   - 无需手动粘贴更新

---

## 2026-02-20 - 安全性和性能优化

### 🔒 安全性增强
1. **VM 沙箱安全加固**
   - 移除不安全的 `escape/unescape` 函数，使用安全的替代实现
   - 改进 `atob/btoa` 实现，支持 UTF-8 编码
   - 限制沙箱环境暴露的全局对象

2. **输入验证和限制**
   - 添加请求体大小限制（默认 10MB）
   - 限制最大节点数量（默认 10000 个）
   - 限制单个链接长度（默认 8KB）
   - 检测并拒绝可疑内容（XSS 防护）
   - 实时监控请求大小，超限立即终止

### ⚡ 性能优化
1. **异步文件 I/O**
   - 所有文件操作改用 `fs.promises` 异步 API
   - 避免阻塞事件循环，提升并发性能
   - 改进错误处理机制

2. **VM 脚本编译优化**
   - 预编译脚本模板，减少重复编译开销
   - 使用占位符替换而非动态生成代码
   - 提升转换性能约 20-30%

3. **配置文件支持**
   - 支持 `config.json` 自定义配置
   - 支持环境变量配置（`PORT`, `DATA_DIR`）
   - 提供 `config.example.json` 配置示例
   - 配置项包括：端口、数据目录、安全限制、默认参数

### 📝 配置示例

创建 `config.json` 文件：
```json
{
  "port": 3456,
  "dataDir": "./data",
  "security": {
    "maxRequestSize": 10485760,
    "maxLinksCount": 10000,
    "maxLinkLength": 8192
  },
  "defaults": {
    "httpPort": 7890,
    "socksPort": 7891,
    "mode": "rule",
    "logLevel": "info",
    "enableDns": true,
    "testInterval": 300
  }
}
```

或使用环境变量：
```bash
PORT=8080 DATA_DIR=/var/data node server.js
```

---

## 2026-02-20 - 修复 Clash 订阅格式

### 🔧 修复
- **修复 Clash 订阅链接格式错误**：订阅链接现在正确返回 Base64 编码的代理链接，而不是 YAML 配置文件
  - 默认订阅格式从 `clash` (YAML) 改为 `base64` (标准订阅格式)
  - 重命名 `clash` 格式为 `clash-yaml`，用于下载完整配置文件
  - 订阅链接 `http://localhost:3456/sub` 现在返回 Base64 编码内容（乱码状态）
  - 客户端可以正确识别和导入订阅

### 📝 格式说明

**订阅链接格式**（客户端使用）：
- `http://localhost:3456/sub` - 默认 Base64 订阅（推荐，适用于所有客户端）
- `http://localhost:3456/sub?format=base64` - 显式指定 Base64 格式
- `http://localhost:3456/sub?format=clash-yaml` - Clash 完整 YAML 配置
- `http://localhost:3456/sub?format=clash-meta` - Clash Meta/Mihomo 配置
- `http://localhost:3456/sub?format=surge` - Surge 配置
- `http://localhost:3456/sub?format=sing-box` - Sing-Box JSON 配置
- `http://localhost:3456/sub?format=raw` - 原始代理链接

### 🎯 使用建议

**标准订阅（推荐）**：
```
http://localhost:3456/sub
```
适用于：Clash、Shadowrocket、V2RayN、Quantumult X 等所有支持订阅的客户端

**完整配置文件**：
```
http://localhost:3456/sub?format=clash-yaml
```
适用于：需要下载完整 YAML 配置文件的场景

### 🔄 迁移指南

如果你之前使用了 `?format=clash` 参数：
- 旧链接：`http://localhost:3456/sub?format=clash`
- 新链接：`http://localhost:3456/sub?format=clash-yaml`（完整配置）
- 或使用：`http://localhost:3456/sub`（标准订阅，推荐）

### 📦 前端更新
- 格式选项卡：`Clash` → `Clash YAML`
- 订阅链接显示：`Clash 订阅` 现在指向 Base64 格式
- 一键导入功能保持不变
