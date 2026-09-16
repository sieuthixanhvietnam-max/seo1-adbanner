#!/bin/bash
# Chạy 1 lần trên VPS để thiết lập DB backup tự động
# Cách chạy: bash scripts/setup-backup.sh
#
# Hoặc copy-paste từng block vào VPS shell

set -e

VPS="root@139.59.227.174"
KEY="/Users/peter/Documents/aws/seo1-key-do-root.pem"

echo "==> Setting up DB backup on VPS..."

ssh -i $KEY $VPS << 'EOF'
  set -e

  # Tạo backup script
  mkdir -p /root/scripts /root/backups

  cat > /root/scripts/backup-db.sh << 'SCRIPT'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p /root/backups
cp /root/seo1-adbanner/backend/data/adserver.db /root/backups/adserver-$TIMESTAMP.db
find /root/backups -name "adserver-*.db" -mtime +7 -delete
echo "[$(date)] Backup done: adserver-$TIMESTAMP.db"
SCRIPT

  chmod +x /root/scripts/backup-db.sh

  # Thêm cron job 2AM mỗi ngày (skip nếu đã có)
  if ! crontab -l 2>/dev/null | grep -q "backup-db.sh"; then
    (crontab -l 2>/dev/null; echo "0 2 * * * /root/scripts/backup-db.sh >> /root/backups/backup.log 2>&1") | crontab -
    echo "OK: Cron job added (2AM daily)"
  else
    echo "OK: Cron job already exists — skipped"
  fi

  # Chạy backup ngay để verify
  /root/scripts/backup-db.sh

  echo ""
  echo "Backup files:"
  ls -lh /root/backups/
  echo ""
  echo "Cron:"
  crontab -l | grep backup
EOF

echo ""
echo "Backup setup done."
echo "Verify: ssh -i $KEY $VPS 'ls -la /root/backups/'"
