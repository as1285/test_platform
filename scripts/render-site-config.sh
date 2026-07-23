#!/usr/bin/env bash
# 根据 .env / 环境变量生成 frontend/public/js/site-config.js
# 用法：
#   ./scripts/render-site-config.sh
#   APP_URL=https://www.geshui.vip ./scripts/render-site-config.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT}/deploy/runtime"
OUT="${OUT_DIR}/site-config.js"
mkdir -p "${OUT_DIR}"

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-${APP_URL:-}}"
PUBLIC_SITE_URL="${PUBLIC_SITE_URL%/}"
SITE_TRUSTED_HOSTS="${SITE_TRUSTED_HOSTS:-}"

python3 - "$OUT" "$PUBLIC_SITE_URL" "$SITE_TRUSTED_HOSTS" <<'PY'
import json, sys
from urllib.parse import urlparse

out, public_url, extra_hosts = sys.argv[1], sys.argv[2].strip(), sys.argv[3].strip()
hosts = []
if public_url:
    u = urlparse(public_url)
    if u.hostname:
        h = u.hostname.lower()
        hosts.append(h)
        if h.startswith("www."):
            hosts.append(h[4:])
        else:
            hosts.append("www." + h)
for part in extra_hosts.replace(";", ",").split(","):
    p = part.strip().lower()
    if p and p not in hosts:
        hosts.append(p)

body = f"""/**
 * 由 scripts/render-site-config.sh 生成 — 勿手改后提交机器专用域名
 * publicOrigin={public_url or '(empty → use location.origin)'}
 */
window.__SITE_CONFIG__ = {{
  publicOrigin: {json.dumps(public_url)},
  trustedHosts: {json.dumps(hosts)}
}};

(function (g) {{
  function trimSlash(s) {{
    return String(s == null ? '' : s).replace(/\\/+$/, '');
  }}

  function configuredOrigin() {{
    var cfg = g.__SITE_CONFIG__ || {{}};
    return trimSlash(cfg.publicOrigin || '');
  }}

  function sitePublicOrigin() {{
    var configured = configuredOrigin();
    try {{
      var origin = String((g.location && g.location.origin) || '');
      var isLocal = /^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/i.test(origin);
      var isIp = /^https?:\\/\\/\\d{{1,3}}(\\.\\d{{1,3}}){{3}}(:\\d+)?$/i.test(origin);
      if (origin && !isLocal) {{
        if (isIp && configured) {{
          return configured;
        }}
        return origin;
      }}
      if (configured) {{
        return configured;
      }}
      if (origin) {{
        return origin;
      }}
    }} catch (e0) {{}}
    return configured;
  }}

  function siteIsTrustedHost(hostname) {{
    var h = String(hostname || '').toLowerCase();
    if (!h) {{
      return false;
    }}
    if (h === 'localhost' || h === '127.0.0.1') {{
      return true;
    }}
    try {{
      if (h === String((g.location && g.location.hostname) || '').toLowerCase()) {{
        return true;
      }}
    }} catch (e1) {{}}
    var cfg = g.__SITE_CONFIG__ || {{}};
    var list = Array.isArray(cfg.trustedHosts) ? cfg.trustedHosts : [];
    var i;
    for (i = 0; i < list.length; i++) {{
      if (String(list[i] || '').toLowerCase() === h) {{
        return true;
      }}
    }}
    try {{
      var origin = configuredOrigin();
      if (origin) {{
        var u = new URL(origin);
        var oh = String(u.hostname || '').toLowerCase();
        if (h === oh || h === 'www.' + oh || ('www.' + h) === oh) {{
          return true;
        }}
      }}
    }} catch (e2) {{}}
    return false;
  }}

  g.sitePublicOrigin = sitePublicOrigin;
  g.siteIsTrustedHost = siteIsTrustedHost;
}})(window);
"""
with open(out, "w", encoding="utf-8") as f:
    f.write(body)
print(f"[site-config] wrote {out}")
print(f"[site-config] publicOrigin={public_url or '(empty)'}")
print(f"[site-config] trustedHosts={hosts}")
PY
