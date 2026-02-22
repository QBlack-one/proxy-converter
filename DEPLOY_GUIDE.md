# Proxy-Converter 多系统部署指南

本文档提供了在不同操作系统环境（包括常见的 Linux 发行版及特定容器环境）下部署和运行当前版本 (`5287ae6`) `proxy-converter` 的命令指南。

本项目基于 Node.js 运行，因此核心要求是环境中必须安装 Node.js 和 npm。

---

## 1. Debian / Ubuntu 系 🐧

大多数主流 VPS 使用的系统。

### 安装依赖环境
```bash
# 更新软件包列表并安装 Node.js, npm 和 git
sudo apt update
sudo apt install -y nodejs npm git

# (可选但推荐) 全局安装 pm2 用于进程守护
sudo npm install -g pm2
```

### 部署与运行
```bash
# 1. 克隆项目 (如果您尚未克隆)
git clone https://github.com/QBlack-one/proxy-converter.git /opt/proxy-converter
cd /opt/proxy-converter

# 2. 切换到稳定旧版本 (按您的需求)
git reset --hard 5287ae6

# 3. 安装项目依赖包
npm install

# 4. 运行服务
# 方式一：前台测试运行 (按 Ctrl+C 停止)
npm start

# 方式二：后台常驻运行 (推荐生产环境使用 pm2)
pm2 start server.js --name "proxy-converter"
pm2 save
pm2 startup
```

---

## 2. Alpine Linux ⛰️

轻量级 Linux 发行版，常用于 Docker 容器或极简服务器。由于其包管理器为 `apk` 且默认 shell 为 `ash`，命令有所不同。

### 安装依赖环境
```sh
# 更新包索引并安装 nodejs, npm, git 和 bash (为了兼容某些脚本)
apk update
apk add --no-cache nodejs npm git bash

# (可选但推荐) 全局安装 pm2
npm install -g pm2
```

### 部署与运行
```sh
# 1. 克隆项目
git clone https://github.com/QBlack-one/proxy-converter.git /opt/proxy-converter
cd /opt/proxy-converter

# 2. 切换到稳定旧版本
git reset --hard 5287ae6

# 3. 安装项目依赖
npm install

# 4. 运行服务 (后台守护)
pm2 start server.js --name "proxy-converter"
pm2 save
```

---

## 3. CentOS / RHEL / Rocky Linux 🎩

企业级常用服务器系统。

### 安装依赖环境
```bash
# 安装 Node.js (通常通过 NodeSource 仓库) 和 git
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo yum install -y nodejs git

# (可选但推荐) 全局安装 pm2
sudo npm install -g pm2
```

### 部署与运行
```bash
# 进入目录 (假设您已拉取)
cd /opt/proxy-converter

# 切换版本
git reset --hard 5287ae6

# 安装并运行
npm install
pm2 start server.js --name "proxy-converter"
pm2 save
```

---

## 4. Windows (本地测试开发) 🪟

Windows 下建议直接从 [Node.js 官网](https://nodejs.org/) 下载并安装长期支持版 (LTS)。

### 部署与运行
打开 PowerShell 或 CMD，执行：

```powershell
# 1. 切换到项目目录
cd D:\桌面\Desktop\666\chajian\proxy-converter

# 2. 回退到指定版本 (如果需要)
git reset --hard 5287ae6
git clean -xdf # 清理无用文件

# 3. 安装依赖
npm install

# 4. 运行服务
npm start
```

---

## 5. Docker (推荐跨平台) 🐳

如果您倾向于使用容器部署，这可以屏蔽底层操作系统的差异。如果您所在的分支有 `Dockerfile` 即可直接构建。

### 部署命令
```bash
# 1. 进入代码目录
cd /opt/proxy-converter
git reset --hard 5287ae6

# 2. 构建 Docker 镜像 (需要在项目根目录下拥有 Dockerfile)
docker build -t proxy-converter .

# 3. 运行容器 (映射容器的 3456 端口到宿主机的 3456 端口)
docker run -d --name proxy-converter -p 3456:3456 --restart unless-stopped proxy-converter
```

---

## 💡 常用维护命令 (所有 Linux 通用，假设使用 pm2)

- **查看运行状态**: `pm2 status`
- **查看服务日志**: `pm2 logs proxy-converter`
- **重启服务**: `pm2 restart proxy-converter` 或 `pm2 reload proxy-converter`
- **停止服务**: `pm2 stop proxy-converter`
