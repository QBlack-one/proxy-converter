#!/bin/sh
# 一键部署与更新 proxy-converter

# 获取脚本所在目录的绝对路径
DIR="$( cd "$( dirname "$0" )" && pwd )"
cd "$DIR" || exit

echo "⏬ 拉取最新代码..."
git pull origin main

echo "📦 安装后端依赖..."
npm install

echo "🏗️ 构建前端..."
cd frontend || exit
npm install
npm run build
cd ..

echo "🔄 重启 PM2 服务..."
pm2 reload proxy-converter

echo "✅ 更新并部署完成！"
