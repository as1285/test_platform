#!/usr/bin/env bash
# 安装灾容 cron：健康巡检 + 异地/分层备份；并准备 COS 上传用的 Python venv
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HEALTH="$ROOT/scripts/health-guard.sh"
OFFSITE="$ROOT/scripts/sync-backup-offsite.sh"
MYSQL_BACKUP="$ROOT/scripts/backup-mysql.sh"
VENV_DIR="${ROOT}/.venv-dr"
VENV_PY="${VENV_DIR}/bin/python"

chmod +x "$HEALTH" "$OFFSITE" "$ROOT/scripts/lib/dr-common.sh" "$MYSQL_BACKUP"

ensure_dr_venv() {
  if [[ -x "$VENV_PY" ]] && "$VENV_PY" -c 'import qcloud_cos' 2>/dev/null; then
    echo "[dr-install] COS venv 已就绪: $VENV_PY"
    return 0
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    echo "[dr-install] WARNING: 未找到 python3，跳过 .venv-dr（异地 COS 上传将不可用）" >&2
    return 0
  fi
  echo "[dr-install] 创建/更新 $VENV_DIR ..."
  python3 -m venv "$VENV_DIR"
  "$VENV_PY" -m pip install -q --upgrade pip
  "$VENV_PY" -m pip install -q -i https://mirrors.aliyun.com/pypi/simple/ \
    --trusted-host mirrors.aliyun.com \
    cos-python-sdk-v5
  "$VENV_PY" -c 'import qcloud_cos; print("[dr-install] qcloud_cos OK")'
}

ensure_dr_venv

tmp="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'scripts/health-guard.sh' | grep -v 'scripts/sync-backup-offsite.sh' | grep -v 'scripts/backup-mysql.sh' >"$tmp" || true

{
  echo "*/2 * * * * /bin/bash ${HEALTH} >/dev/null 2>&1"
  echo "*/15 * * * * /usr/bin/flock -xn /var/lock/test_platform-mysql-backup.lock -c '/bin/bash ${MYSQL_BACKUP}' >> /var/log/test_platform-mysql-backup.log 2>&1"
  echo "15 3 * * * /bin/bash ${OFFSITE} >> /var/log/test_platform-offsite-backup.log 2>&1"
} >>"$tmp"

crontab "$tmp"
rm -f "$tmp"

echo "[dr-install] crontab:"
crontab -l | grep -E 'health-guard|backup-mysql|sync-backup-offsite' || true
echo "[dr-install] 完成。请在 .env 配置 COS_* 以启用异地上传。"
