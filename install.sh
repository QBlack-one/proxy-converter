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
install_node() {
    echo -e "${YELLOW}📦 未检测到 Node.js，正在安装...${NC}"

    # Debian / Ubuntu
    if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    # CentOS / RHEL / Fedora
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
    # Alpine
    elif command -v apk &> /dev/null; then
        sudo apk update
        sudo apk add nodejs npm
    # Arch
    elif command -v pacman &> /dev/null; then
        sudo pacman -Sy --noconfirm nodejs npm
    # 通用方案：使用 NVM
    else
        echo -e "${YELLOW}📦 使用 NVM 安装 Node.js...${NC}"
        export NVM_DIR="$HOME/.nvm"
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
        # 加载 nvm
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        nvm install 20
        nvm use 20
    fi
}

if ! command -v node &> /dev/null; then
    install_node
fi

# 再次检查
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 安装失败，请手动安装后重试${NC}"
    echo -e "    手动安装: ${CYAN}curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash && source ~/.bashrc && nvm install 20${NC}"
    exit 1
fi

NODE_VER=$(node -v)
echo -e "${GREEN}✓ Node.js ${NODE_VER}${NC}"

# 检查 git
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}📦 安装 Git...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get install -y git
    elif command -v yum &> /dev/null; then
        sudo yum install -y git
    elif command -v apk &> /dev/null; then
        sudo apk add git
    elif command -v pacman &> /dev/null; then
        sudo pacman -Sy --noconfirm git
    fi
fi

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
    sudo mkdir -p "$INSTALL_DIR"
    sudo git clone https://github.com/QBlack-one/proxy-converter.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 设置权限
sudo chown -R $(whoami):$(whoami) "$INSTALL_DIR"
cd "$INSTALL_DIR"

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

# 尝试用 PM2 管理
if command -v pm2 &> /dev/null || npm install -g pm2 2>/dev/null; then
    # 停止旧进程
    pm2 delete proxy-converter 2>/dev/null || true
    # 启动服务
    echo -e "${CYAN}🚀 使用 PM2 启动服务...${NC}"
    pm2 start server.js --name proxy-converter
    pm2 save 2>/dev/null || true
    pm2 startup 2>/dev/null || true
    MANAGER="pm2"
else
    # PM2 安装失败，使用 nohup 作为备选
    echo -e "${CYAN}🚀 使用 nohup 启动服务...${NC}"
    # 杀掉旧进程
    pkill -f "node.*server.js" 2>/dev/null || true
    sleep 1
    nohup node server.js > /tmp/proxy-converter.log 2>&1 &
    echo $! > /tmp/proxy-converter.pid
    MANAGER="nohup"
fi

# 获取服务器 IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ip.sb 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "YOUR_SERVER_IP")

echo ""
echo -e "${GREEN}  ╔══════════════════════════════════════╗"
echo -e "  ║       ✅ 部署成功！                  ║"
echo -e "  ╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  📺 管理面板:  ${CYAN}http://${SERVER_IP}:${PORT}${NC}"
echo -e "  🔗 订阅链接:  ${CYAN}http://${SERVER_IP}:${PORT}/sub${NC}"
echo ""

if [ "$MANAGER" = "pm2" ]; then
    echo -e "  📋 常用命令:"
    echo -e "    查看状态:  ${YELLOW}pm2 status${NC}"
    echo -e "    查看日志:  ${YELLOW}pm2 logs proxy-converter${NC}"
    echo -e "    重启服务:  ${YELLOW}pm2 restart proxy-converter${NC}"
    echo -e "    停止服务:  ${YELLOW}pm2 stop proxy-converter${NC}"
else
    echo -e "  📋 常用命令:"
    echo -e "    查看日志:  ${YELLOW}tail -f /tmp/proxy-converter.log${NC}"
    echo -e "    停止服务:  ${YELLOW}kill \$(cat /tmp/proxy-converter.pid)${NC}"
    echo -e "    重启服务:  ${YELLOW}cd $INSTALL_DIR && kill \$(cat /tmp/proxy-converter.pid) && nohup node server.js > /tmp/proxy-converter.log 2>&1 &${NC}"
fi

echo ""
echo -e "  🔄 更新项目:  ${YELLOW}cd $INSTALL_DIR && git pull && npm install && pm2 restart proxy-converter${NC}"
echo ""
