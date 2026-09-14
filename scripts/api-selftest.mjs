#!/usr/bin/env node
/**
 * API 自测：对运行中的后端做一轮只读探针，输出每个端点的状态/耗时/异常。
 * 仅做只读或带假参数的失败态探针，不写库、不创建订单、不触发支付。
 *
 * 用法：
 *   node scripts/api-selftest.mjs              # 探 http://127.0.0.1
 *   BASE=https://example.com node scripts/api-selftest.mjs
 *
 * 退出码：0 全部健康；1 有端点异常（非 2xx/预期 4xx）。
 */
'use strict';

const BASE = (process.env.BASE || 'http://127.0.0.1').replace(/\/+$/, '');
const TIMEOUT_MS = 8000;

function timed(label, fn) {
  const t = Date.now();
  return Promise.resolve()
    .then(fn)
    .then((r) => ({ label, ok: true, ms: Date.now() - t, ...r }))
    .catch((e) => ({ label, ok: false, ms: Date.now() - t, err: String(e && e.message ? e.message : e) }));
}

async function probe(method, path, { body, headers, expectStatus, allow } = {}) {
  const url = BASE + path;
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const opts = { method, signal: ac.signal, headers: { 'Content-Type': 'application/json', ...(headers || {}) } };
  if (body !== undefined) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  try {
    const r = await fetch(url, opts);
    const text = await r.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (_) {}
    const status = r.status;
    const expected = expectStatus || [200, 400, 401, 403, 404, 422];
    const ok = (expected.includes(status)) && (!allow || allow(status, parsed));
    return { status, ok, body: parsed || text.slice(0, 160), ms: 0 };
  } catch (e) {
    return { status: 0, ok: false, body: String(e && e.message ? e.message : e).slice(0, 160), ms: 0 };
  } finally {
    clearTimeout(to);
  }
}

const probes = [
  // —— 平台 / 健康 ——
  ['GET', '/api/health', { expectStatus: [200] }],
  // /health（无 /api 前缀）不经 nginx 代理，仅后端直连 3000 可达；经 nginx 预期 404
  ['GET', '/health', { expectStatus: [404] }],

  // —— 公开端点（无需鉴权）——
  ['GET', '/api/public/install-packages', { expectStatus: [200] }],
  ['GET', '/api/public/mine-ui', { expectStatus: [200] }],
  ['GET', '/api/public/conversion-config', { expectStatus: [200] }],
  ['GET', '/api/public/ad-pages', { expectStatus: [200] }],
  ['GET', '/api/public/landing-ab-config', { expectStatus: [200] }],
  ['GET', '/api/public/resolve-sales-channel', { expectStatus: [200] }],
  ['GET', '/api/public/lizhi-cert-fee', { expectStatus: [200] }],
  ['GET', '/api/public/sbdy-demo/verify', { expectStatus: [200, 400, 404] }],
  ['GET', '/api/public/gjj-demo/verify', { expectStatus: [200, 400, 404] }],

  // —— 鉴权：未登录应返回 401 ——
  ['GET', '/api/user?action=summary', { expectStatus: [401] }],
  ['GET', '/api/user?action=employers', { expectStatus: [401] }],
  ['GET', '/api/tax?action=records', { expectStatus: [401] }],
  ['GET', '/api/tax?action=summary', { expectStatus: [401] }],
  ['GET', '/api/message?action=list', { expectStatus: [401] }],
  ['GET', '/api/lizhi-cert/status', { expectStatus: [401] }],
  ['GET', '/api/zaizhi-cert/status', { expectStatus: [401] }],
  ['GET', '/api/najilu-qr/status', { expectStatus: [401] }],
  ['GET', '/api/najilu-qr/list', { expectStatus: [401] }],
  ['GET', '/api/payments/alipay/config', { expectStatus: [401] }],
  ['GET', '/api/payments/alipay/latest', { expectStatus: [401] }],
  ['GET', '/api/payments/price-bid', { expectStatus: [401] }],
  ['GET', '/api/growth/bilibili-share/status', { expectStatus: [401] }],

  // —— 登录/注册：假账号应返回 400 ——
  ['POST', '/api/auth', { body: { action: 'login', username: '__selftest_no__', password: 'x' }, expectStatus: [400] }],
  ['POST', '/api/auth', { body: { action: 'register_captcha', phone: '19900000000' }, expectStatus: [200, 400, 429] }],

  // —— 管理端：未登录应 401 ——
  ['GET', '/api/admin/me', { expectStatus: [401] }],
  ['GET', '/api/admin/users', { expectStatus: [401] }],

  // —— 合作伙伴（需 partner API key，无 key 预期 401）——
  ['GET', '/api/partner/bank/health', { expectStatus: [401] }],
  ['GET', '/api/public/tax-records-policy', { expectStatus: [200] }],

  // —— 静态页可达性（nginx）——
  ['GET', '/login.html', { expectStatus: [200], headers: { Accept: 'text/html' } }],
  ['GET', '/shouye.html', { expectStatus: [200], headers: { Accept: 'text/html' } }],
  ['GET', '/consult.html', { expectStatus: [200], headers: { Accept: 'text/html' } }],
  ['GET', '/mine.html', { expectStatus: [200], headers: { Accept: 'text/html' } }],
  ['GET', '/purchase.html', { expectStatus: [200], headers: { Accept: 'text/html' } }],
  ['GET', '/najilu_qr.html', { expectStatus: [200], headers: { Accept: 'text/html' } }],
  ['GET', '/js/auth.js', { expectStatus: [200], headers: { Accept: '*/*' } }],
];

async function main() {
  const results = [];
  for (const [method, path, opts] of probes) {
    const r = await timed(`${method} ${path}`, () => probe(method, path, opts));
    results.push({ method, path, ...r });
    const tag = r.ok ? 'OK ' : 'FAIL';
    const st = r.status === 0 ? 'NET' : r.status;
    process.stdout.write(`${tag} ${st} ${String(r.ms).padStart(5)}ms  ${method.padEnd(4)} ${path}\n`);
    if (!r.ok) {
      process.stdout.write(`       body: ${String(r.body).slice(0, 200)}\n`);
    }
  }
  const failed = results.filter((r) => !r.ok);
  process.stdout.write(`\n=== ${results.length} probes, ${results.length - failed.length} ok, ${failed.length} failed ===\n`);
  if (failed.length) {
    process.stdout.write('FAILED:\n');
    failed.forEach((r) => process.stdout.write(`  ${r.method} ${r.path} -> ${r.status} ${String(r.body).slice(0, 160)}\n`));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(2); });
