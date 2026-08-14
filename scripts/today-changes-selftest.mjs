/**
 * 今日前端/后端改动静态自检（无外部依赖）
 * node scripts/today-changes-selftest.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function ok(label) {
  passed++;
  console.log('[today-selftest] ok', label);
}
function fail(label, detail) {
  failed++;
  console.error('[today-selftest] FAIL', label, detail || '');
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function mustInclude(rel, needles, label) {
  const src = read(rel);
  const miss = needles.filter((k) => !src.includes(k));
  if (!miss.length) ok(label);
  else fail(label, 'missing in ' + rel + ': ' + miss.join(', '));
}

mustInclude('frontend/public/js/message-badge.js', ['unread_count', 'nav-unread-badge', 'refreshMessageUnreadBadge'], 'message-badge.js');
mustInclude('frontend/css/nav.css', ['nav-unread-badge'], 'nav.css badge');
mustInclude('frontend/purchase.html', ['track_purchase_page_leave', '__purchasePageComplete'], 'purchase leave track');
mustInclude('frontend/admin_panel.html', ['inactive_has_tax', 'inactive_purchase_no_pay'], 'admin bulk audiences');
mustInclude('backend/src/growth/purchasePriceSurvey.js', ['SKIP_SENTIMENT', "'skipped'"], 'price survey skipped');
mustInclude('frontend/public/js/consult-batch-tax.js', ['batchMsModalDraft', 'renderBatchMsModalPage'], 'batch-ms pagination');
mustInclude('frontend/public/js/conversion-guide.js', ['openPayGateModal', 'bindPayFeatureGates'], 'conversion pay gate');
mustInclude('frontend/public/js/consult-records.js', ['expandSingleTaxRecordCard', 'taxMoreCard', 'syncTaxPayGuideBanner'], 'editRecord + pay guide');
mustInclude('backend/src/user/lizhiCertUser.js', ['preview_png_base64'], 'lizhi user api png');
mustInclude('backend/scripts/lizhi_render_pdf.py', ['.preview.png'], 'lizhi render png');
mustInclude('frontend/lizhi_cert.html', ['lizhiPdfPreview', 'preview_png_base64'], 'lizhi cert img preview');
mustInclude('frontend/consult.html', ['taxPayGuideBanner'], 'tax pay guide banner');

const purchase = read('frontend/purchase.html');
if (purchase.includes('track_purchase_page_leave') && !/满\s*2\s*次/.test(purchase)) ok('bilibili share 1x copy');
else fail('bilibili share 1x copy');

mustInclude('frontend/index.html', ["var target = 'shouye.html'", 'url=shouye.html'], 'app launch -> home');
mustInclude('frontend/nginx.conf', ['return 302 /shouye.html'], 'nginx / -> home');
mustInclude('frontend/login.html', ["window.location.href = 'shouye.html'"], 'login land home');
const authJs = read('frontend/public/js/auth.js');
if (
  authJs.includes("window.location.replace('shouye.html')") &&
  !/index\.html[\s\S]{0,400}window\.location\.replace\('mine\.html'\)/.test(authJs)
) {
  ok('auth.js default home');
} else {
  fail('auth.js default home');
}

mustInclude(
  'frontend/install_guide.html',
  ['isHarmonyOsLikeClient', 'OpenHarmony', 'SUP-AL90', 'isLikelyAndroidClient'],
  'harmony next install apk not ios'
);
/* UI 已回退到 2026-08-13 ~10:00 CST（a7a24f0/885ea22）；勿再锁定其后 Mate/小米17 顶栏改动 */
mustInclude(
  'frontend/login.html',
  ['20260814-ace2pro'],
  'login.html auth cache ace2pro'
);
mustInclude(
  'frontend/mine.html',
  ['20260814-ace2pro'],
  'mine.html auth cache ace2pro'
);
mustInclude(
  'frontend/public/js/fast-nav.js',
  ['20260814-ace2pro'],
  'fast-nav auth cache ace2pro'
);
if (!read('frontend/public/js/auth.js').includes('isHuaweiMate70LikeClient')) {
  ok('auth.js without post-0813 Mate70 chrome');
} else {
  fail('auth.js without post-0813 Mate70 chrome');
}
if (!read('frontend/public/js/auth.js').includes('isXiaomi17UltraClient')) {
  ok('auth.js without post-0813 Xiaomi17 chrome');
} else {
  fail('auth.js without post-0813 Xiaomi17 chrome');
}

mustInclude(
  'frontend/public/js/auth.js',
  ['isOnePlusAce2ProClient', 'PJA110', 'app-android-oneplus-ace2pro'],
  'oneplus ace 2 pro immersive top'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['PJA110', 'app-android-oneplus-ace2pro', '20260814-ace2pro'],
  'shuiming_result ace 2 pro class'
);

(function testOnePlusAce2ProUa() {
  const reModel = /PJA110/i;
  const reName = /(?:OnePlus|一加)\s*Ace\s*2\s*Pro/i;
  const hit = [
    'Mozilla/5.0 (Linux; Android 14; PJA110 Build/UKQ1) AppleWebKit/537.36',
    'Mozilla/5.0 (Linux; Android 14) OnePlus Ace 2 Pro',
    'Mozilla/5.0 (Linux; Android 14) 一加 Ace 2 Pro'
  ];
  const miss = [
    'Mozilla/5.0 (Linux; Android 14; PHK110) OnePlus Ace 2',
    'Mozilla/5.0 (Linux; Android 14; PHP110) OnePlus Ace 2V',
    'Mozilla/5.0 (Linux; Android 15; PJZ110) OnePlus 13'
  ];
  const hitOk = hit.every((ua) => reModel.test(ua) || reName.test(ua));
  const missOk = miss.every((ua) => !reModel.test(ua) && !reName.test(ua));
  if (hitOk && missOk) ok('oneplus ace 2 pro UA match');
  else fail('oneplus ace 2 pro UA match');
})();

mustInclude(
  'frontend/shuiming.html',
  ['href="shouye.html"', 'resolveBackTarget', "var HOME = 'shouye.html'"],
  'shuiming back -> home'
);
mustInclude('frontend/consult.html', ['>激活页面<'], 'consult tab 激活页面');
mustInclude('frontend/public/js/consult-core.js', ["titleEl.textContent = '激活页面'"], 'consult title 激活页面');
if (!read('frontend/consult.html').includes('>附加产品<')) ok('consult tab no 附加产品');
else fail('consult tab no 附加产品');
mustInclude(
  'frontend/public/js/consult-batch-tax.js',
  ['copyTaxPasteImportTemplate', 'TAX_PASTE_IMPORT_TEMPLATE', 'taxPasteImportCopyTplBtn'],
  'tax paste copy template'
);
mustInclude('frontend/consult.html', ['taxPasteImportCopyTplBtn', '复制模板内容'], 'consult copy tpl btn');
mustInclude('frontend/admin_panel.html', ['taxPasteImportCopyTplBtn', '复制模板内容'], 'admin copy tpl btn');

console.log(`[today-selftest] done passed=${passed} failed=${failed}`);
process.exit(failed ? 1 : 0);
