#!/bin/bash
set -euo pipefail
LOG=/var/log/once-remove-whitelist-2663998418.log
BJ="$(TZ=Asia/Shanghai date +%F)"
echo "[$(date -u +%FT%TZ)] beijing=$BJ start" >> "$LOG"
if [[ "$BJ" < "2026-09-12" ]]; then
  echo "[$(date -u +%FT%TZ)] skip: still before 2026-09-12" >> "$LOG"
  exit 0
fi
docker exec test_platform_db mysql -uroot -ppassword personal_tax -e \
  "UPDATE users SET rename_fee_exempt=0 WHERE username='2663998418';
   SELECT username, rename_fee_exempt, account_active FROM users WHERE username='2663998418';" \
  >> "$LOG" 2>&1
# drop this one-shot crontab line
tmp="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'once-remove-whitelist-2663998418' >"$tmp" || true
crontab "$tmp"
rm -f "$tmp"
echo "[$(date -u +%FT%TZ)] done, cron removed" >> "$LOG"
