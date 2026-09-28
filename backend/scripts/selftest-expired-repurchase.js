#!/usr/bin/env node
/**
 * 自测：试用过期账号（JWT act=1）能否访问支付宝续开接口。
 * 用法：
 *   node scripts/selftest-expired-repurchase.js baseline   # 当前运行中的 API（应失败）
 *   node scripts/selftest-expired-repurchase.js after-fix  # 部署修复后（应通过）
 *   node scripts/selftest-expired-repurchase.js cleanup
 */
'use strict';

const { execSync } = require('child_process');
const jwt = require('jsonwebtoken');

const API = process.env.SELFTEST_API || 'http://127.0.0.1:3000';
const JWT_SECRET =
  process.env.JWT_SECRET ||
  '63020521b48daed9f370ed2ea3ff1247b42e048dd54bb0199e0df0fa26d69611';
const USER = process.env.SELFTEST_USER || '__selftest_expired_buy__';
const MODE = process.argv[2] || 'after-fix';

function mysql(sql) {
  const cmd =
    'docker exec test_platform_db mysql -uroot -ppassword personal_tax -N -e ' +
    JSON.stringify(sql);
  return execSync(cmd, { encoding: 'utf8' }).replace(/Using a password[^\n]*\n/g, '').trim();
}

function ensureExpiredUser() {
  const exists = mysql(
    "SELECT COUNT(*) FROM users WHERE username='" + USER + "'"
  );
  if (exists === '0') {
    mysql(
      "INSERT INTO users (username, salt, hash, real_name, account_active, activation_kind, active_until, banned, user_type, session_rev) VALUES ('" +
        USER +
        "', 'selftest', 'selftest', '自测过期复购', 1, 'trial', '2020-01-01 00:00:00', 0, 0, 0)"
    );
  } else {
    mysql(
      "UPDATE users SET account_active=1, activation_kind='trial', active_until='2020-01-01 00:00:00', banned=0, session_rev=0, user_type=0 WHERE username='" +
        USER +
        "'"
    );
  }
  const row = mysql(
    "SELECT CONCAT_WS('|', account_active, activation_kind, IFNULL(active_until,'NULL'), session_rev) FROM users WHERE username='" +
      USER +
      "'"
  );
  console.log('[db]', USER, row);
}

function cleanup() {
  mysql("DELETE FROM users WHERE username='" + USER + "'");
  console.log('[cleanup] removed', USER);
}

function tokenAct1() {
  return jwt.sign({ sub: USER, act: 1, srv: 0 }, JWT_SECRET, { expiresIn: '1h' });
}

function tokenAct0() {
  return jwt.sign({ sub: USER, act: 0, srv: 0 }, JWT_SECRET, { expiresIn: '1h' });
}

async function hit(path, token) {
  const r = await fetch(API + path, {
    headers: { Authorization: 'Bearer ' + token },
    cache: 'no-store'
  });
  const text = await r.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch (e) {
    body = { raw: text.slice(0, 200) };
  }
  return { status: r.status, body: body };
}

function summarize(label, res) {
  const expired = !!(res.body && res.body.activation_expired);
  const msg = (res.body && (res.body.msg || res.body.message)) || '';
  console.log(
    '  ' +
      label +
      ' -> HTTP ' +
      res.status +
      (expired ? ' activation_expired' : '') +
      (msg ? ' | ' + msg : '')
  );
  return { expired: expired, status: res.status, body: res.body };
}

async function runCase(label, expectPaymentOk) {
  console.log('\n=== ' + label + ' (expect payment ok=' + expectPaymentOk + ') ===');
  ensureExpiredUser();
  const t1 = tokenAct1();
  const t0 = tokenAct0();

  const pay = summarize('GET /api/payments/alipay/config [act=1]', await hit('/api/payments/alipay/config', t1));
  const bid = summarize('GET /api/payments/price-bid [act=1]', await hit('/api/payments/price-bid', t1));
  const other = summarize(
    'GET /api/zaizhi-cert/status [act=1]',
    await hit('/api/zaizhi-cert/status', t1)
  );
  const act0pay = summarize(
    'GET /api/payments/alipay/config [act=0]',
    await hit('/api/payments/alipay/config', t0)
  );

  const results = { pay: pay, bid: bid, other: other, act0pay: act0pay, ok: true, fails: [] };

  if (expectPaymentOk) {
    if (pay.expired) {
      results.ok = false;
      results.fails.push('payment still blocked by activation_expired');
    }
    if (pay.status === 401 && pay.expired) {
      results.ok = false;
    }
    // 支付接口放行后可能是 200 或其它业务码，但不能是 activation_expired
    if (bid.expired) {
      results.ok = false;
      results.fails.push('price-bid still blocked by activation_expired');
    }
    // 非白名单接口仍应踢过期 act=1
    if (!other.expired) {
      results.ok = false;
      results.fails.push('non-whitelist path should still return activation_expired');
    }
    if (act0pay.expired) {
      results.ok = false;
      results.fails.push('act=0 should never get activation_expired');
    }
  } else {
    // baseline：旧代码应对支付也返回 activation_expired
    if (!pay.expired) {
      results.ok = false;
      results.fails.push('baseline expected payment activation_expired (old bug)');
    }
    if (!other.expired) {
      results.ok = false;
      results.fails.push('baseline expected other path activation_expired');
    }
  }

  if (results.ok) {
    console.log('[PASS]', label);
  } else {
    console.log('[FAIL]', label, results.fails.join('; '));
  }
  return results;
}

async function main() {
  if (MODE === 'cleanup') {
    cleanup();
    return;
  }
  if (MODE === 'baseline') {
    const r = await runCase('baseline(old/running)', false);
    process.exit(r.ok ? 0 : 1);
  }
  if (MODE === 'after-fix') {
    const r = await runCase('after-fix', true);
    process.exit(r.ok ? 0 : 1);
  }
  if (MODE === 'both') {
    console.log('Note: both mode assumes you manually switch code between runs.');
    process.exit(1);
  }
  console.error('unknown mode:', MODE);
  process.exit(2);
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
