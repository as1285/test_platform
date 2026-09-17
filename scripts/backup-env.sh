#!/usr/bin/env bash
# 加密备份本机 .env，并尽量送到「封机后仍能打开」的渠道。
# 密文可进邮箱 / COS / 本机目录；解密口令必须另存（手机备忘录 / 密码管理器），
# 不要和密文放在同一封邮件里。
#
# 用法：
#   ./scripts/backup-env.sh                 # .env 有变更则覆盖 COS env.lkj；满心跳天数也会再发加密副本
#   ./scripts/backup-env.sh --force         # 强制再发一份
#   ./scripts/backup-env.sh --status        # 只看状态
#   ./scripts/backup-env.sh --install-cron  # 幂等安装：每 6 小时检查一次
#   ./scripts/backup-env.sh --decrypt FILE [OUT]
#
# 口令文件（不进 git、不进 .env）：
#   ENV_BACKUP_PASSPHRASE_FILE  默认 /root/.env-backup-passphrase
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/dr-common.sh"
dr_load_env

ENV_FILE="${DR_ENV_FILE:-$ROOT/.env}"
OUT_DIR="${ENV_BACKUP_DIR:-$ROOT/data/env-backups}"
PASS_FILE="${ENV_BACKUP_PASSPHRASE_FILE:-/root/.env-backup-passphrase}"
KEEP="${ENV_BACKUP_KEEP:-12}"
HEARTBEAT_DAYS="${ENV_BACKUP_HEARTBEAT_DAYS:-7}"
LOG_FILE="${ENV_BACKUP_LOG:-/var/log/test_platform-env-backup.log}"
LOCK_FILE="${ENV_BACKUP_LOCK:-/var/lock/test_platform-env-backup.lock}"
STATE_FILE="$OUT_DIR/last.json"
SCRIPT_PATH="$ROOT/scripts/backup-env.sh"
CRON_EXPR="${ENV_BACKUP_CRON:-*/15 * * * *}"
CRON_LINE="${CRON_EXPR} /usr/bin/flock -xn ${LOCK_FILE} -c '/bin/bash ${SCRIPT_PATH}' >> ${LOG_FILE} 2>&1"
OPENSSL_ITER="${ENV_BACKUP_PBKDF2_ITER:-200000}"
VENV_PY="${ROOT}/.venv-dr/bin/python"

log() {
  mkdir -p "$(dirname "$LOG_FILE")"
  echo "[$(date '+%F %T')] $*" | tee -a "$LOG_FILE" >&2
}

die() {
  log "ERROR: $*"
  exit 1
}

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
}

ensure_passphrase() {
  if [[ -n "${ENV_BACKUP_PASSPHRASE:-}" ]]; then
    printf '%s' "$ENV_BACKUP_PASSPHRASE" >"$PASS_FILE.tmp.$$"
    mv -f "$PASS_FILE.tmp.$$" "$PASS_FILE"
    chmod 600 "$PASS_FILE"
    return 0
  fi
  if [[ -s "$PASS_FILE" ]]; then
    chmod 600 "$PASS_FILE" 2>/dev/null || true
    return 0
  fi
  umask 077
  # 5 组，便于手抄；只在本机生成一次
  local raw
  raw="$(openssl rand -hex 20)"
  printf '%s-%s-%s-%s-%s' "${raw:0:8}" "${raw:8:8}" "${raw:16:8}" "${raw:24:8}" "${raw:32:8}" >"$PASS_FILE"
  chmod 600 "$PASS_FILE"
  log "已生成解密口令文件: $PASS_FILE"
  log "请立刻抄到手机备忘录 / 密码管理器（不要和密文邮件放一起）"
}

passphrase_fingerprint() {
  sha256sum "$PASS_FILE" | awk '{print substr($1,1,12)}'
}

env_sha256() {
  sha256sum "$ENV_FILE" | awk '{print $1}'
}

key_inventory() {
  python3 - "$ENV_FILE" <<'PY'
import re, sys
path = sys.argv[1]
set_keys, empty_keys, commented = [], [], []
pat = re.compile(r'^([A-Za-z_][A-Za-z0-9_]*)=(.*)$')
cmt = re.compile(r'^#\s*([A-Za-z_][A-Za-z0-9_]*)=')
seen = set()
with open(path, encoding="utf-8", errors="replace") as f:
    for line in f:
        s = line.strip()
        m = pat.match(s)
        if m:
            k, v = m.group(1), m.group(2).strip()
            if v[:1] in ("'", '"') and v[-1:] == v[:1] and len(v) >= 2:
                v = v[1:-1]
            seen.add(k)
            (empty_keys if v == "" else set_keys).append(k)
            continue
        m = cmt.match(s)
        if m and m.group(1) not in seen:
            commented.append(m.group(1))
            seen.add(m.group(1))
print("SET\t" + ",".join(set_keys))
print("EMPTY\t" + ",".join(empty_keys))
print("UNSET\t" + ",".join(commented))
print("SET_N\t%d" % len(set_keys))
print("EMPTY_N\t%d" % len(empty_keys))
print("UNSET_N\t%d" % len(commented))
critical = [
    "ALIPAY_APP_ID", "ALIPAY_PRIVATE_KEY", "ALIPAY_PUBLIC_KEY",
    "ALIPAY_NOTIFY_URL", "SMTP_HOST", "SMTP_USER", "SMTP_PASS",
    "JWT_SECRET", "ADMIN_PANEL_PASSWORD", "ADMIN_ACTIVATION_KEY",
    "COS_SECRET_ID", "COS_SECRET_KEY", "COS_BUCKET", "DB_PASSWORD",
]
have = set(set_keys)
print("CRITICAL\t" + ",".join(f"{k}={'yes' if k in have else 'no'}" for k in critical))
PY
}

write_manifest() {
  local dest="$1" digest="$2" enc_name="$3"
  local inv site host
  inv="$(key_inventory)"
  site="$(dr_site_origin)"
  host="$(hostname)"
  python3 - "$dest" "$digest" "$enc_name" "$site" "$host" "$PASS_FILE" "$inv" <<'PY'
import json, sys, datetime, hashlib, os
dest, digest, enc_name, site, host, pass_file, inv = sys.argv[1:8]
fields = {}
for line in inv.splitlines():
    k, _, v = line.partition("\t")
    fields[k] = v
fp = ""
if os.path.isfile(pass_file):
    h = hashlib.sha256()
    with open(pass_file, "rb") as f:
        h.update(f.read())
    fp = h.hexdigest()[:12]
doc = {
    "schema": "test_platform.env-backup.v1",
    "created": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "site": site,
    "host": host,
    "env_sha256": digest,
    "ciphertext": enc_name,
    "cipher": "openssl enc -aes-256-cbc -pbkdf2",
    "pbkdf2_iter": int(os.environ.get("OPENSSL_ITER") or "200000"),
    "passphrase_sha256_12": fp,
    "keys_set": [x for x in fields.get("SET", "").split(",") if x],
    "keys_empty": [x for x in fields.get("EMPTY", "").split(",") if x],
    "keys_commented": [x for x in fields.get("UNSET", "").split(",") if x],
    "critical": dict(p.split("=", 1) for p in fields.get("CRITICAL", "").split(",") if "=" in p),
    "restore": [
        "把密文拷到新机器",
        "准备口令文件（与本机 /root/.env-backup-passphrase 相同）",
        "./scripts/backup-env.sh --decrypt <密文.enc> .env",
    ],
}
with open(dest, "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY
}

encrypt_env() {
  local dest="$1"
  local tmp="${dest}.tmp.$$"
  OPENSSL_ITER="$OPENSSL_ITER" openssl enc -aes-256-cbc -pbkdf2 -iter "$OPENSSL_ITER" -salt \
    -in "$ENV_FILE" -out "$tmp" -pass file:"$PASS_FILE"
  # 自检：能解开且哈希一致，避免发出坏包
  local round
  round="$(mktemp)"
  openssl enc -d -aes-256-cbc -pbkdf2 -iter "$OPENSSL_ITER" \
    -in "$tmp" -out "$round" -pass file:"$PASS_FILE"
  local got want
  want="$(env_sha256)"
  got="$(sha256sum "$round" | awk '{print $1}')"
  rm -f "$round"
  if [[ "$got" != "$want" ]]; then
    rm -f "$tmp"
    die "加密自检失败（解开后哈希不一致）"
  fi
  mv -f "$tmp" "$dest"
}

prune_old() {
  mapfile -t old < <(ls -1t "$OUT_DIR"/env-*.enc 2>/dev/null | tail -n +"$((KEEP + 1))" || true)
  if ((${#old[@]})); then
    local f
    for f in "${old[@]}"; do
      rm -f "$f" "${f%.enc}.json"
    done
    log "清理旧密文 ${#old[@]} 份"
  fi
}

cos_configured() {
  [[ -n "${COS_SECRET_ID:-}" && -n "${COS_SECRET_KEY:-}" && -n "${COS_BUCKET:-}" && -n "${COS_REGION:-}" ]]
}

env_lkj_last_hash() {
  python3 -c 'import json,sys,os
p=sys.argv[1]
if not os.path.isfile(p):
    print("")
    raise SystemExit
try:
    print(json.load(open(p, encoding="utf-8")).get("env_lkj_sha256") or "")
except Exception:
    print("")
' "$STATE_FILE" 2>/dev/null || true
}

write_lkj_state() {
  local digest="$1" ok="$2"
  python3 - "$STATE_FILE" "$digest" "$ok" <<'PY'
import json, sys, datetime, os
path, digest, ok = sys.argv[1:4]
os.makedirs(os.path.dirname(path), exist_ok=True)
doc = {}
if os.path.isfile(path):
    try:
        doc = json.load(open(path, encoding="utf-8"))
    except Exception:
        doc = {}
doc["updated"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
doc["env_lkj_sha256"] = digest
doc["env_lkj_ok"] = ok
doc["env_lkj_at"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
with open(path, "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY
}

# 明文覆盖 COS：{prefix}/config/env.lkj（换机直接下载改名即可）
upload_env_lkj() {
  if ! cos_configured; then
    log "未配置 COS_*，跳过 env.lkj"
    return 2
  fi
  if [[ ! -x "$VENV_PY" ]]; then
    log "WARNING: 缺少 $VENV_PY，env.lkj 未上传"
    return 1
  fi
  local prefix="${COS_PREFIX:-test_platform/dr}"
  COS_SECRET_ID="${COS_SECRET_ID}" COS_SECRET_KEY="${COS_SECRET_KEY}" \
  COS_BUCKET="${COS_BUCKET}" COS_REGION="${COS_REGION}" COS_TOKEN="${COS_TOKEN:-}" \
  COS_PREFIX="$prefix" ENV_FILE="$ENV_FILE" \
  "$VENV_PY" - <<'PY'
import os
from qcloud_cos import CosConfig, CosS3Client
sid = os.environ["COS_SECRET_ID"]
skey = os.environ["COS_SECRET_KEY"]
region = os.environ["COS_REGION"]
bucket = os.environ["COS_BUCKET"]
prefix = os.environ.get("COS_PREFIX", "test_platform/dr").rstrip("/")
token = os.environ.get("COS_TOKEN") or None
path = os.environ["ENV_FILE"]
key = f"{prefix}/config/env.lkj"
cfg = CosConfig(Region=region, SecretId=sid, SecretKey=skey, Token=token, Scheme="https", Timeout=120)
client = CosS3Client(cfg)
client.upload_file(Bucket=bucket, LocalFilePath=path, Key=key, PartSize=1, MAXThread=1)
print(f"[cos] upload {path} -> cos://{bucket}/{key}", flush=True)
PY
}

upload_cos() {
  local enc="$1" meta="$2"
  if ! cos_configured; then
    log "未配置 COS_*，跳过异地桶（邮箱仍是离机副本）"
    return 2
  fi
  if [[ ! -x "$VENV_PY" ]]; then
    log "WARNING: 缺少 $VENV_PY，密文未上传 COS"
    return 1
  fi
  local prefix="${COS_PREFIX:-test_platform/dr}"
  COS_SECRET_ID="${COS_SECRET_ID}" COS_SECRET_KEY="${COS_SECRET_KEY}" \
  COS_BUCKET="${COS_BUCKET}" COS_REGION="${COS_REGION}" COS_TOKEN="${COS_TOKEN:-}" \
  COS_PREFIX="$prefix" ENC_PATH="$enc" META_PATH="$meta" \
  "$VENV_PY" - <<'PY'
import os, sys
from qcloud_cos import CosConfig, CosS3Client
sid = os.environ["COS_SECRET_ID"]
skey = os.environ["COS_SECRET_KEY"]
region = os.environ["COS_REGION"]
bucket = os.environ["COS_BUCKET"]
prefix = os.environ.get("COS_PREFIX", "test_platform/dr").rstrip("/")
token = os.environ.get("COS_TOKEN") or None
cfg = CosConfig(Region=region, SecretId=sid, SecretKey=skey, Token=token, Scheme="https", Timeout=120)
client = CosS3Client(cfg)
for path in (os.environ["ENC_PATH"], os.environ["META_PATH"]):
    name = os.path.basename(path)
    key = f"{prefix}/env/{name}"
    client.upload_file(Bucket=bucket, LocalFilePath=path, Key=key, PartSize=10, MAXThread=2)
    print(f"[cos] upload {path} -> cos://{bucket}/{key}", flush=True)
PY
}

send_backup_mail() {
  local enc="$1" meta="$2" digest="$3" reason="$4"
  if [[ -z "${SMTP_HOST:-}" || -z "${SMTP_USER:-}" || -z "${SMTP_PASS:-}" ]]; then
    log "SMTP 未配置，无法把密文寄出服务器"
    return 1
  fi
  local to subject
  to="${ENV_BACKUP_EMAIL:-$(dr_alert_email)}"
  subject="$(dr_mail_prefix) ENV 加密备份 $(hostname)"
  local body
  body="$(
    cat <<EOF
这是 .env 的 AES-256 密文，不是明文。封机后从这封邮件下载附件即可。

站点: $(dr_site_origin)
主机: $(hostname)
原因: ${reason}
时间: $(date '+%F %T')
.env sha256: ${digest}
密文: $(basename "$enc")
清单: $(basename "$meta")
口令指纹(sha256前12位): $(passphrase_fingerprint)
PBKDF2 iter: ${OPENSSL_ITER}

新机器恢复（口令来自你自己保存的那份，不在这封邮件里）：
  ./scripts/backup-env.sh --decrypt $(basename "$enc") .env

$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1],encoding="utf-8")); c=d.get("critical") or {}; print("关键项是否已写入:"); [print("  - %s: %s"%i) for i in c.items()]; print("已配置键:"); print("  "+", ".join(d.get("keys_set") or []))' "$meta")

不要把解密口令回传到这封邮件。口令只放在密码管理器 / 手机备忘录。
EOF
  )"
  python3 - "$to" "$subject" "$body" "$enc" "$meta" <<'PY'
import os, sys, smtplib, ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from email.header import Header

to, subject, body, enc, meta = sys.argv[1:6]
host = os.environ.get("SMTP_HOST", "smtp.qq.com")
port = int(os.environ.get("SMTP_PORT") or "465")
user = os.environ["SMTP_USER"]
password = os.environ["SMTP_PASS"]
mail_from = os.environ.get("SMTP_FROM") or user

msg = MIMEMultipart()
msg["Subject"] = Header(subject, "utf-8")
msg["From"] = mail_from
msg["To"] = to
msg.attach(MIMEText(body, "plain", "utf-8"))
for path in (enc, meta):
    with open(path, "rb") as f:
        part = MIMEApplication(f.read(), Name=os.path.basename(path))
    part.add_header("Content-Disposition", "attachment", filename=os.path.basename(path))
    msg.attach(part)

ctx = ssl.create_default_context()
if port == 465:
    with smtplib.SMTP_SSL(host, port, context=ctx, timeout=45) as s:
        s.login(user, password)
        s.sendmail(mail_from, [to], msg.as_string())
else:
    with smtplib.SMTP(host, port, timeout=45) as s:
        s.starttls(context=ctx)
        s.login(user, password)
        s.sendmail(mail_from, [to], msg.as_string())
print("[dr] mail+attachments sent ->", to)
PY
}

should_send() {
  local digest="$1" force="$2"
  if [[ "$force" == "1" ]]; then
    echo "force"
    return 0
  fi
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "first"
    return 0
  fi
  local last_hash last_mail
  last_hash="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("env_sha256",""))' "$STATE_FILE" 2>/dev/null || true)"
  last_mail="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("mailed_at",""))' "$STATE_FILE" 2>/dev/null || true)"
  if [[ "$last_hash" != "$digest" ]]; then
    echo "changed"
    return 0
  fi
  if [[ -z "$last_mail" ]]; then
    echo "never-mailed"
    return 0
  fi
  local age
  age="$(python3 -c 'import datetime,sys
t=sys.argv[1]
try:
    dt=datetime.datetime.strptime(t,"%Y-%m-%d %H:%M:%S")
    print(int((datetime.datetime.now()-dt).total_seconds()))
except Exception:
    print(10**9)
' "$last_mail")"
  if (( age >= HEARTBEAT_DAYS * 86400 )); then
    echo "heartbeat"
    return 0
  fi
  echo "skip"
  return 1
}

write_state() {
  local digest="$1" enc="$2" mailed="$3" reason="$4" cos_ok="$5"
  python3 - "$STATE_FILE" "$digest" "$enc" "$mailed" "$reason" "$cos_ok" <<'PY'
import json, sys, datetime, os
path, digest, enc, mailed, reason, cos_ok = sys.argv[1:7]
doc = {}
if os.path.isfile(path):
    try:
        doc = json.load(open(path, encoding="utf-8"))
    except Exception:
        doc = {}
doc.update({
    "updated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "env_sha256": digest,
    "latest_enc": enc,
    "last_reason": reason,
    "cos_ok": cos_ok,
})
if mailed == "1":
    doc["mailed_at"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
with open(path, "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY
}

show_status() {
  echo "env: $ENV_FILE"
  if [[ -f "$ENV_FILE" ]]; then
    echo "env_sha256: $(env_sha256)"
    echo "env_mtime: $(date -r "$ENV_FILE" '+%F %T')"
  else
    echo "env: MISSING"
  fi
  echo "passphrase_file: $PASS_FILE ($( [[ -s "$PASS_FILE" ]] && echo present || echo MISSING ))"
  if [[ -s "$PASS_FILE" ]]; then
    echo "passphrase_sha256_12: $(passphrase_fingerprint)"
  fi
  echo "out_dir: $OUT_DIR"
  echo "latest:"
  ls -1t "$OUT_DIR"/env-*.enc 2>/dev/null | head -3 | sed 's/^/  /' || echo "  (none)"
  if [[ -f "$STATE_FILE" ]]; then
    echo "state:"
    python3 -m json.tool "$STATE_FILE"
  fi
  echo "env.lkj: ${COS_PREFIX:-test_platform/dr}/config/env.lkj"
  echo "cron:"
  crontab -l 2>/dev/null | grep -F 'backup-env.sh' || echo "  (not installed)"
}

install_cron() {
  mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$LOCK_FILE")"
  local tmp
  tmp="$(mktemp)"
  crontab -l 2>/dev/null | grep -v 'scripts/backup-env.sh' >"$tmp" || true
  printf '%s\n' "$CRON_LINE" >>"$tmp"
  crontab "$tmp"
  rm -f "$tmp"
  echo "[env-backup] crontab installed: $CRON_LINE"
  crontab -l 2>/dev/null | grep -F 'backup-env.sh' || true
}

decrypt_env() {
  local src="${1:-}" dest="${2:-}"
  [[ -n "$src" ]] || die "用法: $0 --decrypt <密文.enc> [输出文件，默认 .env]"
  [[ -f "$src" ]] || die "密文不存在: $src"
  dest="${dest:-$ENV_FILE}"
  if [[ ! -s "$PASS_FILE" && -z "${ENV_BACKUP_PASSPHRASE:-}" ]]; then
    die "没有口令。把口令写到 $PASS_FILE，或 ENV_BACKUP_PASSPHRASE='...' $0 --decrypt ..."
  fi
  ensure_passphrase
  local tmp
  tmp="$(mktemp)"
  openssl enc -d -aes-256-cbc -pbkdf2 -iter "$OPENSSL_ITER" \
    -in "$src" -out "$tmp" -pass file:"$PASS_FILE" || {
    rm -f "$tmp"
    die "解密失败：口令不对或密文损坏"
  }
  if [[ -f "$dest" ]]; then
    cp -f "$dest" "${dest}.bak.$(date +%Y%m%d-%H%M%S)"
  fi
  mv -f "$tmp" "$dest"
  chmod 600 "$dest"
  echo "[env-backup] 已写入 $dest  sha256=$(sha256sum "$dest" | awk '{print $1}')"
}

do_backup() {
  local force="${1:-0}"
  [[ -f "$ENV_FILE" ]] || die "找不到 $ENV_FILE"
  mkdir -p "$OUT_DIR" "$(dirname "$LOG_FILE")"
  ensure_passphrase
  local digest stamp enc meta reason send_rc cos_rc mailed
  digest="$(env_sha256)"
  local lkj_hash lkj_rc
  lkj_hash="$(env_lkj_last_hash)"
  if [[ "$force" == "1" || "$lkj_hash" != "$digest" ]]; then
    lkj_rc=0
    if upload_env_lkj; then
      write_lkj_state "$digest" "yes"
      log "已覆盖 COS env.lkj sha256=${digest:0:12}..."
    else
      lkj_rc=$?
      write_lkj_state "$lkj_hash" "no"
      log "ERROR: env.lkj 上传失败（exit=$lkj_rc）"
    fi
  else
    log "env.lkj 无变更，跳过覆盖 sha256=${digest:0:12}..."
  fi
  if ! reason="$(should_send "$digest" "$force")"; then
    log "无变更且未到心跳（${HEARTBEAT_DAYS} 天），跳过加密外发 sha256=${digest:0:12}..."
    return 0
  fi
  stamp="$(date +%Y%m%d-%H%M%S)"
  enc="$OUT_DIR/env-${stamp}.enc"
  meta="$OUT_DIR/env-${stamp}.json"
  OPENSSL_ITER="$OPENSSL_ITER" write_manifest "$meta" "$digest" "$(basename "$enc")"
  encrypt_env "$enc"
  chmod 600 "$enc" "$meta"
  log "已加密 $(basename "$enc") sha256=$digest reason=$reason"
  send_rc=0
  send_backup_mail "$enc" "$meta" "$digest" "$reason" || send_rc=$?
  cos_rc=0
  upload_cos "$enc" "$meta" || cos_rc=$?
  mailed=0
  if ((send_rc == 0)); then
    mailed=1
    log "密文已寄出 -> ${ENV_BACKUP_EMAIL:-$(dr_alert_email)}"
  else
    log "ERROR: 邮件未寄出，本机仍有 $enc （封机后这份也拿不到）"
  fi
  local cos_st=no
  if ((cos_rc == 0)); then
    cos_st=yes
  elif ((cos_rc == 2)); then
    cos_st=skipped
  fi
  write_state "$digest" "$(basename "$enc")" "$mailed" "$reason" "$cos_st"
  prune_old
  if ((send_rc != 0)); then
    return 1
  fi
}

# 命令
case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  --status) show_status; exit 0 ;;
  --install-cron) install_cron; exit 0 ;;
  --decrypt)
    shift
    decrypt_env "${1:-}" "${2:-}"
    exit 0
    ;;
  --force) do_backup 1 ;;
  "") do_backup 0 ;;
  *) die "未知参数: $1 （见 --help）" ;;
esac
