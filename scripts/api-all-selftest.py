#!/usr/bin/env python3
"""全量接口自测：健康检查 + api-surface GET 探测 + 管理端/用户端关键接口 + 带重试。"""
import json, os, sys, time, urllib.request, urllib.error, ssl, subprocess, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = (os.environ.get('BASE_URL') or os.environ.get('PUBLIC_SITE_URL') or 'https://lkj.qiyun888.top').rstrip('/')
CTX = ssl.create_default_context()

def load_env():
    env = {}
    p = ROOT / '.env'
    if not p.exists():
        return env
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        env[k] = v.strip().strip('"').strip("'")
    return env

ENV = load_env()
results = []

def req(method, path, data=None, token=None, timeout=30, retries=2):
    url = path if path.startswith('http') else BASE + path
    headers = {'Accept': 'application/json', 'User-Agent': 'api-all-selftest/1.1'}
    body = None
    if data is not None:
        body = json.dumps(data, ensure_ascii=False).encode()
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = 'Bearer ' + token
    last = (0, None, b'', 0, 'no_attempt')
    for i in range(retries + 1):
        r = urllib.request.Request(url, data=body, headers=headers, method=method)
        t0 = time.time()
        try:
            with urllib.request.urlopen(r, context=CTX, timeout=timeout) as resp:
                raw = resp.read()
                ms = int((time.time() - t0) * 1000)
                try:
                    j = json.loads(raw.decode('utf-8', 'replace'))
                except Exception:
                    j = None
                return resp.status, j, raw[:300], ms, None
        except urllib.error.HTTPError as e:
            ms = int((time.time() - t0) * 1000)
            raw = e.read()
            try:
                j = json.loads(raw.decode('utf-8', 'replace'))
            except Exception:
                j = None
            last = (e.code, j, raw[:300], ms, None)
            if e.code in (502, 503) and i < retries:
                time.sleep(0.4 * (i + 1))
                continue
            return last
        except Exception as e:
            ms = int((time.time() - t0) * 1000)
            last = (0, None, b'', ms, str(e))
            if i < retries:
                time.sleep(0.4 * (i + 1))
                continue
            return last
    return last

def record(method, path, code, ok, note='', ms=0):
    results.append({'method': method, 'path': path, 'status': code, 'ok': bool(ok), 'note': note, 'ms': ms})
    print(f"[{'OK' if ok else 'FAIL'}] {method:6} {code:3} {ms:5}ms  {path}  {note}")

def ok_http(code):
    # 业务上可接受：鉴权失败/参数错误/限流；不可接受：404(文档仍列的死路由单独标)、500/502/503/0
    if code in (200, 201, 204, 400, 401, 403, 405, 409, 422, 429):
        return True
    return False

# 1) pages + health
for path in ['/api/health', '/xiangqing.html', '/shuiming.html', '/shuiming_result.html',
             '/bancha.html', '/daiban.html', '/mine.html', '/consult.html', '/login.html']:
    code, j, raw, ms, err = req('GET', path)
    record('GET', path, code, code == 200 and not err, err or '', ms)

# 2) admin login
admin_token = ''
code, j, raw, ms, err = req('POST', '/api/admin/login', {
    'username': ENV.get('ADMIN_PANEL_USER', ''),
    'password': ENV.get('ADMIN_PANEL_PASSWORD', '')
})
if code == 200 and isinstance(j, dict) and j.get('code') == 200:
    admin_token = (j.get('data') or {}).get('token') or ''
record('POST', '/api/admin/login', code, bool(admin_token), 'token=' + ('yes' if admin_token else 'no'), ms)

# 3) surface GETs
surface = json.loads((ROOT / 'docs/architecture-phase0/snapshots/api-surface.json').read_text())
PARAMISH = re.compile(r'[:{]')
STALE_404_ALLOW = {
    # 快照过期的旧路径：记为 WARN 不算硬失败
    '/health',
    '/api/chat',
    '/api/feedback',
    '/api/admin/server-monitor',
    '/api/admin/guest-users',
    '/api/admin/feedback',
    '/api/admin/chat/auto-reply',
    '/api/admin/chat/conversations',
    '/api/admin/chat/messages',
    '/api/admin/analytics/api-stats',
    '/api/admin/analytics/conversion-kpis',
    '/api/admin/analytics/device-stats',
    '/api/admin/analytics/female-age',
    '/api/admin/analytics/registration-funnel',
    '/api/admin/activated-user-analysis/behavior-path',
    '/api/admin/activated-user-analysis/overview',
    '/api/admin/activated-user-analysis/users',
    '/api/admin/user-data/analytics',
    '/api/admin/user-data/female-age',
    '/api/admin/user-data/no-tax-behavior',
    '/api/admin/user-data/no-tax-behavior/export',
    '/api/admin/user-data/no-tax-behavior/path',
    '/api/admin/user-data/salary-high/charts',
    '/api/admin/users/pending-activate-24h',
}

warns = []
for r in surface.get('routes', []):
    if r.get('method') != 'GET':
        continue
    path = r['path']
    if PARAMISH.search(path):
        record('GET', path, 0, True, 'skipped_param', 0)
        continue
    code, j, raw, ms, err = req('GET', path, token=admin_token or None)
    if err:
        record('GET', path, 0, False, err, ms)
        continue
    if code == 404 and path in STALE_404_ALLOW:
        record('GET', path, code, True, 'stale_snapshot_404', ms)
        warns.append(path)
        continue
    if code == 404:
        record('GET', path, code, False, 'not_found', ms)
        continue
    if code in (500, 502, 503):
        record('GET', path, code, False, 'server_error', ms)
        continue
    record('GET', path, code, ok_http(code), '' if ok_http(code) else f'unexpected_{code}', ms)

# 4) admin key APIs with proper query
admin_checks = [
    ('GET', '/api/admin/users?page=1&limit=3', None),
    ('GET', '/api/admin/codes?page=1&limit=3', None),
    ('GET', '/api/admin/settings', None),
    ('GET', '/api/admin/analytics/overview', None),
    ('GET', '/api/admin/user-data?page=1&limit=3', None),
    ('GET', '/api/admin/me', None),
    ('GET', '/api/admin/admin-login-logs?page=1&limit=3', None),
]
for method, path, body in admin_checks:
    code, j, raw, ms, err = req(method, path, body, token=admin_token)
    ok = (not err) and code == 200 and isinstance(j, dict) and j.get('code') == 200
    note = '' if ok else (err or (str((j or {}).get('msg') or code)[:80]))
    record(method, path + '#admin', code, ok, note, ms)

# 5) user token
user_token = ''
try:
    user = subprocess.check_output(
        ['docker', 'exec', '-e', 'MYSQL_PWD=password', 'test_platform_db', 'mysql', '-N', '-uroot', 'personal_tax', '-e',
         'SELECT username FROM users WHERE account_active=1 ORDER BY id DESC LIMIT 1;'],
        text=True, timeout=20).strip()
    user_token = subprocess.check_output(
        ['docker', 'exec', '-w', '/app', '-e', f'TARGET_USER={user}', 'personal-tax-api', 'node', '-e',
         "const jwt=require('jsonwebtoken');console.log(jwt.sign({sub:process.env.TARGET_USER},process.env.JWT_SECRET||'',{expiresIn:'30m'}));"],
        text=True, timeout=20).strip()
    print('[info] user=', user, 'token=', bool(user_token))
except Exception as e:
    print('[warn] user token failed', e)

user_checks = [
    ('GET', '/api/user?action=summary', None),
    ('GET', '/api/message?action=unread_count', None),
    ('GET', '/api/lizhi-cert/status', None),
    ('GET', '/api/lizhi-cert/prefill', None),
    ('GET', '/api/payments/alipay/latest', None),
    ('GET', '/api/tax?action=records&year=2025', None),
    ('POST', '/api/auth', {'action': 'login', 'username': '__nope__', 'password': 'x'}),
    ('POST', '/api/lizhi-cert/generate', {
        'name': '自测', 'id_number': '110101199001011234', 'company_name': '自测科技有限公司',
        'position': '工程师', 'hire_date': '2024/1/1', 'leave_date': '2026/7/1',
        'issue_date': '2026 年 8 月 11 日'
    }),
]
for method, path, body in user_checks:
    tok = user_token if 'login' not in path and not (method == 'POST' and path == '/api/auth') else None
    if method == 'POST' and path == '/api/auth':
        tok = None
    elif path.startswith('/api/lizhi') or path.startswith('/api/user') or path.startswith('/api/message') or path.startswith('/api/tax') or path.startswith('/api/payments'):
        tok = user_token
    code, j, raw, ms, err = req(method, path, body, token=tok)
    if method == 'POST' and path == '/api/auth':
        ok = code in (200, 400, 401) and code != 404
    elif 'lizhi-cert/generate' in path:
        ok = code == 200 and isinstance(j, dict) and j.get('code') == 200 and (j.get('data') or {}).get('pdf_base64')
        note_extra = 'pdf=' + str(bool((j or {}).get('data', {}).get('pdf_base64')))
    else:
        ok = code == 200 and isinstance(j, dict) and j.get('code') == 200
        note_extra = ''
    note = ''
    if not ok:
        note = err or str((j or {}).get('msg') or code)[:80]
    elif 'lizhi-cert/generate' in path:
        note = note_extra
    record(method, path + '#user', code, ok, note, ms)

passed = sum(1 for r in results if r['ok'])
failed = [r for r in results if not r['ok']]
print('\n==== SUMMARY ====')
print(f'base={BASE} total={len(results)} passed={passed} failed={len(failed)} stale404_warn={len(warns)}')
if failed:
    print('FAILURES:')
    for r in failed:
        print(f"  {r['method']} {r['status']} {r['path']} {r['note']}")
out = ROOT / 'scripts' / 'api-all-selftest-report.json'
out.write_text(json.dumps({'base': BASE, 'passed': passed, 'failed': len(failed), 'warns': warns, 'results': results}, ensure_ascii=False, indent=2))
print('report', out)
sys.exit(1 if failed else 0)
