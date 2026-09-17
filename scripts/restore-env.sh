#!/usr/bin/env bash
# 从加密备份恢复 .env。口令文件默认 /root/.env-backup-passphrase
# 用法：./scripts/restore-env.sh <密文.enc> [输出文件，默认仓库根 .env]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT/scripts/backup-env.sh" --decrypt "${1:-}" "${2:-}"
