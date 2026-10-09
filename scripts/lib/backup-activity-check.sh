#!/usr/bin/env bash
# 热备门控：自上次成功热备以来，是否有「新用户注册」或「个税数据变更」。
# 用法：
#   source 后调用 backup_activity_should_run && echo yes
#   或直接执行：exit 0=应备份，exit 10=跳过，其它=查库失败
set -euo pipefail

backup_activity_state_file() {
  local dir="${BACKUP_ACTIVITY_STATE_DIR:-${BACKUP_DIR:-/root/test_platform/data/db-backups}}"
  mkdir -p "$dir"
  echo "${dir}/.last-activity-backup-utc"
}

# 打印上次水位（UTC，MySQL DATETIME 格式）；无则空
backup_activity_read_since() {
  local f latest
  f="$(backup_activity_state_file)"
  if [[ -f "$f" ]]; then
    tr -d '\r\n' <"$f"
    return 0
  fi
  # 无水位：用最新本机热备文件名时间戳 / mtime，避免刚开启门控时漏掉近期变更
  latest="$(ls -1t "${BACKUP_DIR:-/root/test_platform/data/db-backups}"/personal_tax-[0-9]*.sql.gz 2>/dev/null | head -1 || true)"
  if [[ -n "$latest" && -f "$latest" ]]; then
    date -u -d "$(stat -c %y "$latest")" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || true
  fi
}

backup_activity_mark_done() {
  local f now
  f="$(backup_activity_state_file)"
  now="$(date -u '+%Y-%m-%d %H:%M:%S')"
  printf '%s\n' "$now" >"$f"
}

# 查库：自 $1（UTC DATETIME）以来是否有注册或个税变更。无 since 时看最近 LOOKBACK 分钟。
backup_activity_query() {
  local since="${1:-}"
  local container="${DB_CONTAINER:-test_platform_db}"
  local db_name="${DB_NAME:-personal_tax}"
  local lookback="${BACKUP_ACTIVITY_LOOKBACK_MINUTES:-6}"
  local pw sql

  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$container"; then
    echo "[backup-gate] MySQL 容器未运行: $container" >&2
    return 2
  fi
  pw="${DB_ROOT_PASSWORD:-}"
  if [[ -z "$pw" ]]; then
    pw="$(docker exec "$container" printenv MYSQL_ROOT_PASSWORD 2>/dev/null || true)"
  fi
  if [[ -z "$pw" ]]; then
    echo "[backup-gate] 无法读取 MySQL root 密码" >&2
    return 2
  fi

  if [[ -n "$since" ]]; then
    # 仅允许 UTC DATETIME 字面量，避免水位文件被篡改时注入
    if [[ ! "$since" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}\ [0-9]{2}:[0-9]{2}:[0-9]{2}$ ]]; then
      echo "[backup-gate] 水位格式非法，改用 lookback: $since" >&2
      since=""
    fi
  fi
  if [[ -n "$since" ]]; then
    sql="SELECT
      (SELECT COUNT(*) FROM \`${db_name}\`.users WHERE created_at > '${since}') AS new_users,
      (SELECT COUNT(*) FROM \`${db_name}\`.tax_record_change_logs WHERE changed_at > '${since}') AS tax_logs,
      (SELECT COUNT(*) FROM \`${db_name}\`.tax_records
         WHERE updated_at > '${since}' OR created_at > '${since}') AS tax_rows,
      UTC_TIMESTAMP() AS utc_now;"
  else
    sql="SELECT
      (SELECT COUNT(*) FROM \`${db_name}\`.users
         WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${lookback} MINUTE)) AS new_users,
      (SELECT COUNT(*) FROM \`${db_name}\`.tax_record_change_logs
         WHERE changed_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${lookback} MINUTE)) AS tax_logs,
      (SELECT COUNT(*) FROM \`${db_name}\`.tax_records
         WHERE updated_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${lookback} MINUTE)
            OR created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${lookback} MINUTE)) AS tax_rows,
      UTC_TIMESTAMP() AS utc_now;"
  fi

  docker exec "$container" mysql -uroot -p"$pw" -N -e "$sql" 2>/dev/null
}

# 返回 0=应备份，10=跳过，2=错误
backup_activity_should_run() {
  local since row new_users tax_logs tax_rows
  local force_bootstrap="${BACKUP_ACTIVITY_BOOTSTRAP:-1}"
  local hot_dir="${BACKUP_DIR:-/root/test_platform/data/db-backups}"

  # 本机还没有任何热备时先打一份底（避免首次启用门控后长期空库）
  if [[ "$force_bootstrap" == "1" ]] && ! ls -1 "$hot_dir"/personal_tax-[0-9]*.sql.gz >/dev/null 2>&1; then
    echo "[backup-gate] 本机无热备，允许首次备份" >&2
    return 0
  fi

  since="$(backup_activity_read_since || true)"
  row="$(backup_activity_query "$since" || true)"
  if [[ -z "$row" ]]; then
    echo "[backup-gate] 查库失败，为安全起见允许备份" >&2
    return 0
  fi
  # mysql -N: new_users tax_logs tax_rows utc_now
  read -r new_users tax_logs tax_rows _ <<<"$row"
  new_users="${new_users:-0}"
  tax_logs="${tax_logs:-0}"
  tax_rows="${tax_rows:-0}"

  if (( new_users > 0 || tax_logs > 0 || tax_rows > 0 )); then
    echo "[backup-gate] 有活动 since=${since:-lookback}: new_users=${new_users} tax_logs=${tax_logs} tax_rows=${tax_rows}" >&2
    return 0
  fi
  echo "[backup-gate] 跳过：自 ${since:-最近${BACKUP_ACTIVITY_LOOKBACK_MINUTES:-6}分钟} 无新注册/个税变更" >&2
  return 10
}

# 直接执行时
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  if backup_activity_should_run; then
    exit 0
  else
    rc=$?
    exit "$rc"
  fi
fi
