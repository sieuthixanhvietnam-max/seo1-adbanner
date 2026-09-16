#!/bin/bash
# Chạy 1 lần duy nhất khi setup VPS mới
# bash scripts/setup-vps.sh

set -e

echo "🔧 Setup VPS lần đầu..."

# Cài PM2 global
npm install -g pm2

# Tạo .env từ example
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "⚠️  Hãy sửa backend/.env với password và token thật!"
fi

# Cài dependencies
npm install

# Build admin
npm run build -w admin

# Start services
pm2 start backend/src/index.js --name "adbanner-backend"
pm2 start "npm run start -w admin" --name "adbanner-admin"
pm2 save
pm2 startup

echo "✅ Setup xong!"
echo "👉 Tiếp theo: sửa backend/.env rồi pm2 restart adbanner-backend"
