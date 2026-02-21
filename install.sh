#!/bin/bash
# ============================================
# proxy-converter 一键部署脚本
# 用法: bash <(curl -sL https://raw.githubusercontent.com/QBlack-one/proxy-converter/main/install.sh)
# ============================================

set -e

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════╗"
echo "  ║   ⚡ proxy-converter 一键部署脚本    ║"
echo "  ╚══════════════════════════════════════╝"
echo -e "${NC}"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}📦 未检测到 Node.js，正在安装...${NC}"
    if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
    else
        echo -e "${RED}❌ 无法自动安装 Node.js，请手动安装后重试${NC}"
        exit 1
    fi
fi

NODE_VER=$(node -v)
echo -e "${GREEN}✓ Node.js ${NODE_VER}${NC}"

# 安装目录
INSTALL_DIR="/opt/proxy-converter"
PORT=${1:-3456}

# 克隆项目
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}📂 目录已存在，正在更新...${NC}"
    cd "$INSTALL_DIR"
    git pull origin main
else
    echo -e "${CYAN}📥 正在克隆项目...${NC}"
    sudo git clone https://github.com/QBlack-one/proxy-converter.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 设置权限
sudo chown -R $(whoami):$(whoami) "$INSTALL_DIR"

# 安装依赖
echo -e "${CYAN}📦 安装依赖...${NC}"
npm install

# 创建数据目录
mkdir -p data

# 创建默认配置（如果不存在）
if [ ! -f config.json ]; then
    echo -e "${CYAN}⚙️  创建默认配置...${NC}"
    cp config.example.json config.json
    # 修改端口
    sed -i "s/\"port\": 3456/\"port\": $PORT/" config.json
fi

# 安装 PM2（如果未安装）
if ! command -v pm2 &> /dev/null; then
    echo -e "${CYAN}📦 安装 PM2 进程管理器...${NC}"
    sudo npm install -g pm2
fi

# 停止旧进程（如果存在）
pm2 delete proxy-converter 2>/dev/null || true

# 启动服务
echo -e "${CYAN}🚀 启动服务...${NC}"
pm2 start server.js --name proxy-converter
pm2 save

# 设置开机自启
pm2 startup 2>/dev/null || true

# 获取服务器 IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}  ╔══════════════════════════════════════╗"
echo -e "  ║       ✅ 部署成功！                  ║"
echo -e "  ╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  📺 管理面板:  ${CYAN}http://${SERVER_IP}:${PORT}${NC}"
echo -e "  🔗 订阅链接:  ${CYAN}http://${SERVER_IP}:${PORT}/sub${NC}"
echo ""
echo -e "  📋 常用命令:"
echo -e "    查看状态:  ${YELLOW}pm2 status${NC}"
echo -e "    查看日志:  ${YELLOW}pm2 logs proxy-converter${NC}"
echo -e "    重启服务:  ${YELLOW}pm2 restart proxy-converter${NC}"
echo -e "    停止服务:  ${YELLOW}pm2 stop proxy-converter${NC}"
echo ""
echo -e "  🔄 更新项目:  ${YELLOW}cd $INSTALL_DIR && git pull && npm install && pm2 restart proxy-converter${NC}"
echo ""
