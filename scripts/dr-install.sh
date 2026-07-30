#!/usr/bin/env bash
# 安装灾容 cron：健康巡检 + 异地/分层备份
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HEALTH="$ROOT/scripts/health-guard.sh"
OFFSITE="$ROOT/scripts/sync-backup-offsite.sh"
MYSQL_BACKUP="$ROOT/scripts/backup-mysql.sh"

chmod +x "$HEALTH" "$OFFSITE" "$ROOT/scripts/lib/dr-common.sh" "$MYSQL_BACKUP"

tmp="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'scripts/health-guard.sh' | grep -v 'scripts/sync-backup-offsite.sh' | grep -v 'scripts/backup-mysql.sh' >"$tmp" || true

{
  echo "*/2 * * * * /bin/bash ${HEALTH} >/dev/null 2>&1"
  echo "0 */2 * * * /bin/bash ${MYSQL_BACKUP} >> /var/log/test_platform-mysql-backup.log 2>&1"
  echo "15 3 * * * /bin/bash ${OFFSITE} >> /var/log/test_platform-offsite-backup.log 2>&1"
} >>"$tmp"

crontab "$tmp"
rm -f "$tmp"

echo "[dr-install] crontab:"
crontab -l | grep -E 'health-guard|backup-mysql|sync-backup-offsite' || true
echo "[dr-install] 完成。请在 .env 配置 COS_* 以启用异地上传。"
