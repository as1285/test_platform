/**
 * 二次退税测算 / 强制弹框 / 广告页金额 静态 + 容器 + HTTP 自检
 * node scripts/refund-ad-est-selftest.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function ok(label) {
  passed++;
  console.log('[refund-est-selftest] ok', label);
}
function fail(label, detail) {
  failed++;
  console.error('[refund-est-selftest] FAIL', label, detail || '');
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function mustHave(src, needles, label) {
  const miss = needles.filter((k) => !src.includes(k));
  if (!miss.length) ok(label);
  else fail(label, 'missing: ' + miss.join(', '));
}

function mustNotHave(src, needles, label) {
  const hit = needles.filter((k) => src.includes(k));
  if (!hit.length) ok(label);
  else fail(label, 'unexpected: ' + hit.join(', '));
}

const guide = read('frontend/public/js/conversion-guide.js');
const auth = read('frontend/public/js/auth.js');
const ad = read('frontend/refund_ad.html');

mustHave(
  guide,
  [
    'REFUND_CHILD_MONTH = 4500',
    'REFUND_PARENT_MONTH = 3000',
    'REFUND_MONTHLY_EXTRA',
    'function iitComprehensiveTax',
    'function specialDeductionRefundEstimate',
    'function showSpecialDeductionRefundDialog',
    'cg-refund-force-overlay',
    'data-cg-lock',
    'track_refund_ad_after_tax_show',
    "opts.source === 'single_save'",
    'refund_ad.html?from=tax_done',
    '&est='
  ],
  'source conversion-guide estimate + force dialog'
);

const forceFn = guide.match(
  /function showSpecialDeductionRefundDialog[\s\S]*?function maybeGoRefundAdAfterTax/
);
if (forceFn && !forceFn[0].includes('稍后再说') && forceFn[0].includes('cgRefundForceGo')) {
  ok('force dialog has CTA only, no 稍后再说');
} else {
  fail('force dialog has CTA only, no 稍后再说');
}

mustHave(auth, ['conversion-guide.js?v=20260905-no-home-refund'], 'auth.js cache-busts conversion-guide');

mustHave(
  guide,
  [
    'var showInactive = inactive',
    '去计算可退税额',
    'track_refund_ad_inactive_promo_show'
  ],
  'source conversion-guide inactive refund promo (non-home)'
);
mustNotHave(
  guide,
  ['function renderInactiveRefundAdPromo', 'cg-inactive-refund-promo', "refundAdRecommendHref('shouye')"],
  'home inactive refund card removed from conversion-guide'
);

mustHave(
  ad,
  [
    'id="refundEstCard"',
    '二次退税怎么来的',
    '3 个子女每月',
    '4500 元',
    '3000 元',
    '7500 元',
    'refund_ad_estimate_v1',
    "qs.get('est')",
    'id="refundEstAmt"'
  ],
  'source refund_ad.html principle + amount'
);

const cardIdx = ad.indexOf('id="refundEstCard"');
const posterIdx = ad.indexOf('refund-ad.jpg');
if (cardIdx > 0 && cardIdx < posterIdx) ok('estimate card is above poster');
else fail('estimate card is above poster', `card=${cardIdx} poster=${posterIdx}`);

const copyIdx = ad.indexOf('id="btnCopyRefundWechat"');
const gridIdx = ad.indexOf('class="ad-services-top"');
if (copyIdx > 0 && gridIdx > 0 && copyIdx < gridIdx) ok('WeChat copy is above services grid');
else fail('WeChat copy is above services grid', `copy=${copyIdx} grid=${gridIdx}`);

mustHave(ad, ['id="refundHeroWx"', '#refundHeroWx .refund-ad-wx-label'], 'hero WeChat block + config selector');

function dockerGrep(path, needle) {
  try {
    execSync(
      `docker exec frontend-container grep -q ${JSON.stringify(needle)} ${JSON.stringify(path)}`,
      { stdio: 'pipe' }
    );
    return true;
  } catch (e) {
    return false;
  }
}

const containerChecks = [
  [
    '/usr/share/nginx/html/js/conversion-guide.js',
    'cg-refund-force-overlay',
    'container conversion-guide force dialog'
  ],
  [
    '/usr/share/nginx/html/js/conversion-guide.js',
    '4500',
    'container conversion-guide 4500/month'
  ],
  [
    '/usr/share/nginx/html/js/auth.js',
    '20260905-no-home-refund',
    'container auth cache-bust'
  ],
  [
    '/usr/share/nginx/html/refund_ad.html',
    'refundEstCard',
    'container refund_ad estimate card'
  ],
  [
    '/usr/share/nginx/html/refund_ad.html',
    '二次退税怎么来的',
    'container refund_ad principle copy'
  ]
];

if (existsSync('/var/run/docker.sock') || process.env.FRONTEND_CONTAINER) {
  for (const [path, needle, label] of containerChecks) {
    if (dockerGrep(path, needle)) ok(label);
    else fail(label, needle + ' not in ' + path);
  }
  if (dockerGrep('/usr/share/nginx/html/js/conversion-guide.js', 'cg-inactive-refund-promo')) {
    fail('container conversion-guide has no home promo', 'cg-inactive-refund-promo still present');
  } else {
    ok('container conversion-guide has no home promo');
  }
} else {
  fail('docker available', 'no docker.sock');
}

function curlText(url) {
  try {
    return execSync(`curl --noproxy '*' -sfS --max-time 8 ${JSON.stringify(url)}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (e) {
    return '';
  }
}

const adHtml = curlText('http://127.0.0.1/refund_ad.html');
if (adHtml.includes('refundEstCard') && adHtml.includes('二次退税怎么来的') && adHtml.includes('4500')) {
  ok('HTTP refund_ad.html serves estimate card');
} else {
  fail('HTTP refund_ad.html serves estimate card', adHtml ? 'missing markers' : 'empty/failed');
}

const cgJs = curlText('http://127.0.0.1/js/conversion-guide.js?v=20260905-no-home-refund');
if (
  cgJs.includes('cg-refund-force-overlay') &&
  cgJs.includes('4500') &&
  !cgJs.includes('cg-inactive-refund-promo')
) {
  ok('HTTP conversion-guide.js serves estimate + force dialog without home promo');
} else {
  fail(
    'HTTP conversion-guide.js serves estimate + force dialog without home promo',
    cgJs ? 'missing markers or home promo still present' : 'empty/failed'
  );
}

const authJs = curlText('http://127.0.0.1/js/auth.js');
if (authJs.includes('conversion-guide.js?v=20260905-no-home-refund')) {
  ok('HTTP auth.js points at no-home-refund conversion-guide');
} else {
  fail('HTTP auth.js points at no-home-refund conversion-guide');
}

console.log(`[refund-est-selftest] ${passed} ok, ${failed} fail`);
if (failed) process.exit(1);
