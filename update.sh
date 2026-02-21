#!/bin/bash
# 一键热更新 proxy-converter
cd /opt/proxy-converter && git pull origin main && pm2 reload proxy-converter && echo "✅ 更新并热重载完成"
