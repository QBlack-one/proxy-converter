# 代理订阅转换器

一个功能强大的本地代理订阅转换工具，支持 9 种协议和 6 种输出格式。

## ✨ 特性

### 支持的协议（9种）
- **VMess** - V2Ray 标准协议
- **VLESS** - 轻量级协议，支持 Reality
- **Shadowsocks (SS)** - 经典加密代理
- **ShadowsocksR (SSR)** - SS 增强版
- **Trojan** - 伪装 HTTPS 流量
- **Hysteria / Hysteria2** - 基于 QUIC 的高速协议
- **TUIC** - 基于 QUIC 的代理协议
- **WireGuard** - 现代 VPN 协议

### 输出格式（6种）
- **Base64 订阅** - 标准订阅格式（推荐）
- **Clash YAML** - Clash 完整配置文件
- **Clash Meta** - Mihomo/Clash Meta 配置
- **Surge** - Surge iOS/macOS 配置
- **Sing-Box** - Sing-Box JSON 配置
- **原始链接** - 未编码的代理链接

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
node server.js
```

服务将在 `http://localhost:3456` 启动。

### 使用流程
1. 打开网页面板 `http://localhost:3456`
2. 粘贴代理链接，点击「转换」
3. 点击「保存到订阅服务」
4. 复制生成的订阅 URL，添加到代理客户端
5. 更新节点时重复步骤 2-3，客户端刷新即可

## 📋 订阅链接格式

### 通用订阅（推荐）
```
http://localhost:3456/sub
```
自动识别客户端类型，返回对应格式：
- Clash Verge / Clash Meta / Mihomo → clash-meta 格式
- Clash → clash-yaml 格式
- Surge → surge 格式
- Sing-Box / NekoBox → sing-box 格式
- Shadowrocket / Quantumult X / V2RayN → base64 格式
- 其他客户端 → base64 格式（默认）

### 指定格式
```
http://localhost:3456/sub?format=clash-yaml
http://localhost:3456/sub?format=clash-meta
http://localhost:3456/sub?format=surge
http://localhost:3456/sub?format=sing-box
http://localhost:3456/sub?format=base64
http://localhost:3456/sub?format=raw
```

### 自定义参数
```
http://localhost:3456/sub?format=clash-meta&port=7890&mode=rule&dns=true
```

支持的参数：
- `format` - 输出格式
- `port` - HTTP 端口（默认 7890）
- `socks` - SOCKS5 端口（默认 7891）
- `mode` - 代理模式：rule/global/direct
- `log` - 日志级别：silent/error/warning/info/debug
- `dns` - 启用 DNS：true/false
- `lan` - 允许局域网：true/false
- `interval` - 测速间隔（秒）

## ⚙️ 配置

### 配置文件
创建 `config.json`：
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
  },
  "subscription": {
    "title": "我的代理订阅",
    "updateInterval": 24,
    "traffic": {
      "enabled": true,
      "upload": 0,
      "download": 0,
      "total": 107374182400,
      "resetDay": 1
    },
    "expire": {
      "enabled": true,
      "timestamp": 1767225600
    }
  },
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

### 订阅信息配置

**流量统计**：
- `enabled` - 是否启用流量显示
- `upload` - 已上传流量（字节）
- `download` - 已下载流量（字节）
- `total` - 总流量限制（字节，100GB = 107374182400）
- `resetDay` - 每月重置日期（1-31）

**到期时间**：
- `enabled` - 是否启用到期时间显示
- `timestamp` - Unix 时间戳（秒）

**订阅标题**：
- `title` - 订阅名称（客户端显示）
- `updateInterval` - 更新间隔（小时）

配置后，订阅链接会在 HTTP 响应头中返回：
```
Subscription-Userinfo: upload=0; download=5368709120; total=107374182400; expire=1767225600
Profile-Update-Interval: 24
Profile-Title: 5oiR55qE5Luj55CG6K6i6ZiF
```

前端界面会显示：
- 📊 流量使用进度条（带百分比）
- ⬆️ 上传流量
- ⬇️ 下载流量
- ⏰ 到期时间和剩余天数

### Web 管理界面

在前端界面点击「⚙️ 管理订阅信息」按钮，可以直接修改订阅配置：

**功能：**
- 修改订阅名称和更新间隔
- 设置流量统计（上传/下载/总量）
- 设置到期时间
- 一键重置流量
- 实时保存到配置文件

**使用方式：**
1. 打开网页 http://localhost:3456
2. 滚动到「订阅链接服务」面板
3. 点击「⚙️ 管理订阅信息」
4. 修改配置后点击「💾 保存配置」

### API 认证保护

保护管理接口，防止未授权访问：

**配置：**
```json
{
  "security": {
    "apiKey": "your-secret-key-here",
    "enableAuth": true
  }
}
```

**受保护的端点：**
- `POST /api/save` - 保存节点
- `POST /api/subscription` - 更新订阅配置
- `POST /api/subscription/reset-traffic` - 重置流量

**认证方式：**
```bash
# 方式 1: X-API-Key 头
curl -H "X-API-Key: your-secret-key" http://localhost:3456/api/save

# 方式 2: Authorization Bearer
curl -H "Authorization: Bearer your-secret-key" http://localhost:3456/api/save
```

**前端使用：**
1. 打开「管理订阅信息」面板
2. 在「🔐 API 密钥」输入框中输入密钥
3. 点击「保存密钥」
4. 密钥保存在浏览器 localStorage，后续请求自动携带

**注意：**
- 订阅端点 `/sub` 不需要认证（客户端访问）
- 查询端点 `/api/info` 不需要认证
- 只有修改操作需要认证

### 环境变量
```bash
PORT=8080 DATA_DIR=/var/data node server.js
```

### 自动更新配置

启用自动更新后，服务器会定时从配置的订阅源获取最新节点：

- `enabled` - 是否启用自动更新
- `interval` - 更新间隔（秒），默认 3600（1小时）
- `sources` - 订阅源列表（支持 HTTP/HTTPS）

**手动触发更新**：
```bash
curl -X POST http://localhost:3456/api/update
```

**使用场景**：
- 聚合多个机场订阅
- 自动保持节点最新
- 无需手动操作

## 🔒 安全特性

- **VM 沙箱隔离** - 转换代码在隔离环境中执行
- **输入验证** - 严格的输入大小和格式检查
- **请求限制** - 防止 DoS 攻击
  - 最大请求体：10MB
  - 最大节点数：10000 个
  - 单链接长度：8KB
- **XSS 防护** - 检测并拒绝可疑内容
- **路径遍历防护** - 防止访问系统文件

## ⚡ 性能优化

- **异步 I/O** - 所有文件操作使用异步 API
- **脚本预编译** - 减少重复编译开销
- **去重算法** - 自动移除重复节点
- **并发处理** - 支持高并发请求

## 📡 API 接口

### GET /sub
获取订阅配置（客户端使用）

### POST /api/save
保存代理链接
```json
{
  "links": "vmess://...\nvless://..."
}
```

### POST /api/update
手动触发自动更新（需启用 autoUpdate）
```bash
curl -X POST http://localhost:3456/api/update
```

### GET /api/info
获取服务状态
```json
{
  "status": "running",
  "port": 3456,
  "formats": ["base64", "clash-yaml", ...],
  "nodeCount": 8,
  "updatedAt": "2026-02-20T04:34:53.363Z"
}
```

### GET /api/links
获取已保存的原始链接

## 🎨 前端功能

- **拖拽上传** - 支持拖拽配置文件
- **实时预览** - 节点列表和统计信息
- **搜索过滤** - 按名称、地址搜索节点
- **协议筛选** - 按协议类型过滤
- **一键导入** - 支持多种客户端
- **QR 码生成** - 移动端扫码导入
- **配置面板** - 自定义端口、模式等参数

## 🛠️ 技术栈

- **后端**: Node.js + HTTP 原生模块
- **前端**: 原生 JavaScript（无框架）
- **转换引擎**: VM 沙箱 + 自定义解析器
- **样式**: 现代 CSS（渐变、动画、响应式）

## 📦 项目结构

```
proxy-converter/
├── server.js              # 后端服务器
├── index.html             # 前端页面
├── config.example.json    # 配置示例
├── package.json           # 依赖配置
├── css/
│   └── style.css         # 样式文件
├── js/
│   ├── parsers.js        # 协议解析器
│   ├── encoders.js       # 协议编码器
│   ├── yaml.js           # YAML 生成器
│   ├── generators.js     # 配置生成器
│   └── app.js            # 前端逻辑
└── data/
    ├── links.txt         # 保存的链接
    └── meta.json         # 元数据
```

## 🔄 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解详细更新记录。

### 最新更新（2026-02-20）
- ✅ **自动更新功能** - 支持从远程订阅源自动更新
- ✅ 修复 Clash 订阅格式（Base64 编码）
- ✅ VM 沙箱安全加固
- ✅ 添加输入验证和限制
- ✅ 改用异步文件 I/O
- ✅ VM 脚本编译优化
- ✅ 配置文件支持

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## ⚠️ 免责声明

本工具仅供学习和研究使用，请遵守当地法律法规。使用本工具产生的任何后果由使用者自行承担。
