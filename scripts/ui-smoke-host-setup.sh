#!/usr/bin/env bash
# 宿主机：创建 Playwright 冒烟测试用户并登录（供 Docker 容器内浏览器使用）
# 输出环境文件路径到 stdout 最后一行：UI_SMOKE_ENV_FILE=...
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

API_URL="${API_URL:-http://127.0.0.1:3000}"
API_URL="${API_URL%/}"
DB_CTR="${DB_CONTAINER:-test_platform_db}"
DB_NAME="${MYSQL_DATABASE:-personal_tax}"
DB_ROOT_PASS="${MYSQL_ROOT_PASSWORD:-password}"
API_CTR="${API_CONTAINER:-personal-tax-api}"

TS="$(date +%s)"
SUFFIX="${TS: -6}"
UI_SMOKE_USER="${UI_SMOKE_USER:-pwst${SUFFIX}}"
UI_SMOKE_PASS="${UI_SMOKE_PASS:-Pw${SUFFIX}!}"
ENV_FILE="${UI_SMOKE_ENV_FILE:-/tmp/ui-smoke-${TS}.env}"

json_field() {
  python3 -c 'import json,sys
d=json.load(sys.stdin)
cur=d
for k in sys.argv[1:]:
  if not isinstance(cur, dict):
    print(""); raise SystemExit
  cur=cur.get(k)
print("" if cur is None else cur)
' "$@"
}

gen_user_hash() {
  docker exec "$API_CTR" node -e '
const crypto=require("crypto");
const p=process.argv[1];
const salt=crypto.randomBytes(16);
const hash=crypto.scryptSync(p, salt, 64).toString("hex");
process.stdout.write(salt.toString("hex")+" "+hash+"\n");
' "$1"
}

read -r salt hash < <(gen_user_hash "$UI_SMOKE_PASS")
docker exec "$DB_CTR" mysql -uroot -p"$DB_ROOT_PASS" "$DB_NAME" --default-character-set=utf8mb4 -e \
  "INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
   VALUES ('${UI_SMOKE_USER}', '${salt}', '${hash}', '${UI_SMOKE_USER}', 0, 0, NULL);" >/dev/null

TOKEN="$(
  curl -sS --noproxy '*' -H 'Content-Type: application/json' \
    -d "{\"action\":\"login\",\"username\":\"${UI_SMOKE_USER}\",\"password\":\"${UI_SMOKE_PASS}\"}" \
    "${API_URL}/api/auth" | json_field data token
)"
if [[ -z "$TOKEN" ]]; then
  echo "[ui-smoke-host] FAIL: login" >&2
  exit 1
fi

cat >"$ENV_FILE" <<EOF
UI_SMOKE_USER=${UI_SMOKE_USER}
UI_SMOKE_PASS=${UI_SMOKE_PASS}
UI_SMOKE_TOKEN=${TOKEN}
API_URL=${API_URL}
EOF
chmod 600 "$ENV_FILE"

echo "[ui-smoke-host] user=${UI_SMOKE_USER} env=${ENV_FILE}" >&2
echo "UI_SMOKE_ENV_FILE=${ENV_FILE}"