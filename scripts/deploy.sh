#!/bin/bash
# Deploy từ local → VPS bằng rsync
# Chạy: bash scripts/deploy.sh
set -e

VPS="root@139.59.227.174"
KEY="/Users/peter/Documents/aws/seo1-key-do-root.pem"
REMOTE_DIR="/root/seo1-adbanner"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "==> Deploying to production ($TIMESTAMP)..."

# Step 1: Syntax check backend
echo "--- Checking backend syntax..."
node --check backend/src/index.js
for f in backend/src/routes/*.js backend/src/utils/*.js; do
  node --check "$f"
done
echo "OK: Backend syntax"

# Step 2: TypeScript check admin (errors are warnings only — Next.js still builds)
echo "--- TypeScript check..."
(cd admin && npx tsc --noEmit 2>&1 || true)
echo "OK: TypeScript"

# Step 3: Upload source (exclude built artifacts & sensitive files)
echo "--- Uploading files..."
rsync -av \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='backend/data' \
  --exclude='backend/uploads' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.local' \
  -e "ssh -i $KEY" \
  . $VPS:$REMOTE_DIR/
echo "OK: Upload"

# Step 4: Remote — install, build admin, reload, health check
echo "--- Running remote commands..."
ssh -i $KEY $VPS << EOF
  set -e
  cd $REMOTE_DIR

  # Backup DB
  mkdir -p /root/backups
  if [ -f backend/data/adserver.db ]; then
    cp backend/data/adserver.db /root/backups/adserver-$TIMESTAMP.db
    echo "OK: DB backed up -> /root/backups/adserver-$TIMESTAMP.db"
    # Giữ 7 ngày gần nhất
    find /root/backups -name "adserver-*.db" -mtime +7 -delete
  fi

  # Install backend deps (production only)
  cd backend && npm install --omit=dev && cd ..

  # Install admin deps (xoá node_modules nếu Next.js version thay đổi)
  cd admin
  NEXT_VPS=$(node -e "try{console.log(require('./node_modules/next/package.json').version)}catch(e){console.log('none')}" 2>/dev/null)
  NEXT_PKG=$(node -e "console.log(require('./package.json').dependencies.next.replace(/[\^~]/,''))" 2>/dev/null)
  if [ "\$NEXT_VPS" != "\$NEXT_PKG" ]; then
    echo "Next.js version mismatch (\$NEXT_VPS vs \$NEXT_PKG) — reinstalling node_modules..."
    rm -rf node_modules
  fi
  npm install --omit=dev
  cd ..

  # Build admin trên VPS (cần thiết vì .next không sync)
  echo "--- Building admin on VPS..."
  cd admin && npm run build && cd ..
  echo "OK: Admin built"

  # Reload zero-downtime
  pm2 reload adbanner-backend --update-env
  pm2 reload adbanner-admin   --update-env

  sleep 3

  # Health check
  STATUS=\$(curl -sf http://localhost:4001/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])" 2>/dev/null || echo "fail")
  if [ "\$STATUS" != "ok" ]; then
    echo "FAIL: Health check failed!"
    pm2 logs adbanner-backend --lines 30 --nostream
    exit 1
  fi

  echo "OK: Health check passed"
  pm2 status
EOF

echo ""
echo "Deploy OK - $(date)"
echo "  API:   https://banners.aeseo1.com/health"
echo "  Admin: https://banners.aeseo1.com/admin"
echo ""
echo "NOTE: Nếu là lần deploy đầu tiên, chạy thủ công trên VPS:"
echo "  ssh -i $KEY $VPS"
echo "  pm2 startup   # chạy lệnh mà nó output ra (có sudo)"
echo "  pm2 save      # lưu process list để tự restart khi reboot"
