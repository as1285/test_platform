#!/usr/bin/env bash
# 灾容脚本公共：读 .env、发邮件
# shellcheck disable=SC2034

DR_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DR_ENV_FILE="${DR_ENV_FILE:-$DR_ROOT/.env}"
DR_STATE_DIR="${DR_STATE_DIR:-/var/tmp/test_platform-dr}"
mkdir -p "$DR_STATE_DIR"

dr_load_env() {
  if [[ -f "$DR_ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$DR_ENV_FILE" | sed 's/\r$//')
    set +a
  fi
}

dr_alert_email() {
  echo "${MONITOR_ALERT_EMAIL:-${SMTP_USER:-498771018@qq.com}}"
}

# 用法: dr_send_mail "subject" "body"
dr_send_mail() {
  local subject="$1"
  local body="$2"
  local to
  to="$(dr_alert_email)"
  if [[ -z "${SMTP_HOST:-}" || -z "${SMTP_USER:-}" || -z "${SMTP_PASS:-}" ]]; then
    echo "[dr] SMTP 未配置，跳过邮件: $subject" >&2
    return 1
  fi
  python3 - "$to" "$subject" "$body" <<'PY'
import os, sys, smtplib, ssl
from email.mime.text import MIMEText
from email.header import Header

to, subject, body = sys.argv[1], sys.argv[2], sys.argv[3]
host = os.environ.get("SMTP_HOST", "smtp.qq.com")
port = int(os.environ.get("SMTP_PORT") or "465")
user = os.environ["SMTP_USER"]
password = os.environ["SMTP_PASS"]
mail_from = os.environ.get("SMTP_FROM") or user

msg = MIMEText(body, "plain", "utf-8")
msg["Subject"] = Header(subject, "utf-8")
msg["From"] = mail_from
msg["To"] = to

ctx = ssl.create_default_context()
if port == 465:
    with smtplib.SMTP_SSL(host, port, context=ctx, timeout=30) as s:
        s.login(user, password)
        s.sendmail(mail_from, [to], msg.as_string())
else:
    with smtplib.SMTP(host, port, timeout=30) as s:
        s.starttls(context=ctx)
        s.login(user, password)
        s.sendmail(mail_from, [to], msg.as_string())
print("[dr] mail sent ->", to)
PY
}

# 冷却：同一 key 在 SECONDS 内不重复告警。返回 0=可发，1=冷却中
dr_alert_cooldown_ok() {
  local key="$1"
  local seconds="${2:-1800}"
  local f="$DR_STATE_DIR/alert-$key.ts"
  local now
  now="$(date +%s)"
  if [[ -f "$f" ]]; then
    local last
    last="$(cat "$f" 2>/dev/null || echo 0)"
    if (( now - last < seconds )); then
      return 1
    fi
  fi
  echo "$now" >"$f"
  return 0
}
