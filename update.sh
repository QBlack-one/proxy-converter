#!/bin/bash
# 一键更新 proxy-converter
cd /opt/proxy-converter && git pull origin main && npm install && pm2 restart proxy-converter && echo "✅ 更新完成"
