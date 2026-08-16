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
mustInclude(
  'backend/scripts/lizhi_render_pdf.py',
  ['.preview.png', 'SEAL_RED = (230, 118, 108, 255)', 'SS * 0.012', 'int(v * 0.64)'],
  'lizhi render png + thinner lighter seal'
);
mustInclude('frontend/lizhi_cert.html', ['lizhiPdfPreview', 'preview_png_base64'], 'lizhi cert img preview');
mustInclude(
  'backend/scripts/zaizhi_render_pdf.py',
  ['工作证明', '性别', '为我公司在职员工', 'zaizhi_render_pdf'],
  'zaizhi render work cert'
);
mustInclude(
  'backend/src/user/zaizhiCertUser.js',
  ['sku_zaizhi_cert_50', 'handleZaizhiCertGenerate', 'zaizhi_cert_unlocked'],
  'zaizhi user api'
);
mustInclude(
  'frontend/zaizhi_cert.html',
  ['/api/zaizhi-cert/generate', 'lzGender', '工作证明.pdf'],
  'zaizhi cert c-end page'
);
mustInclude(
  'frontend/admin_panel.html',
  ['page-zaizhi-cert', 'zaizhiGenerateBtn'],
  'admin zaizhi cert page'
);
mustInclude('frontend/consult.html', ['taxPayGuideBanner'], 'tax pay guide banner');
mustInclude(
  'backend/src/legacy/pricingAb.js',
  ['sku_249_1d', 'sku_300_7d', 'sku_398_30d', 'sku_999_perm', "amount: '249.00'", "amount: '999.00'"],
  'pricing live catalog 249/300/398/999'
);
mustInclude(
  'frontend/purchase.html',
  ['sku_249_1d', 'sku_999_perm', '日卡 1 天、周卡 7 天', 'BILIBILI_SHARE_DISCOUNT_HIDDEN = true'],
  'purchase four-sku copy + hide bili share'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  ['BILIBILI_SHARE_DISCOUNT_ENABLED = false'],
  'bili share discount off'
);
mustInclude(
  'frontend/admin_panel.html',
  ['sku_249_1d', 'sku_300_7d', 'sku_398_30d', 'sku_999_perm', '249 日卡 / 300 周卡'],
  'admin offer four-sku'
);

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
  ['20260816-ace2v-php110'],
  'login.html auth cache ace2v'
);
mustInclude(
  'frontend/mine.html',
  ['20260816-ace2v-php110', 'app-android-huawei-mate60', 'ALN-AL00', 'V2302A'],
  'mine.html mate60 + ace2v cache'
);
mustInclude(
  'frontend/public/js/fast-nav.js',
  ['20260816-ace2v-php110'],
  'fast-nav auth cache ace2v'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['html.app-android-huawei-mate60.app-top-safe-shell body.page-mine', 'isIqooNeo8ProClient', 'V2302A', 'clientUaBlob'],
  'auth.js mate60 mine bleed + neo8pro v2302'
);
mustInclude(
  'frontend/shuiming.html',
  ['V2302A', 'app-android-iqoo-neo8pro', '20260815-neo8pro-v2302'],
  'shuiming neo8pro v2302 inset'
);
mustInclude(
  'frontend/message.html',
  ['V2302A', 'app-android-iqoo-neo8pro', '20260816-ace2v-php110'],
  'message ace2v cache + neo8pro inset'
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
  'frontend/public/js/auth.js',
  ['isOnePlusAce2VClient', 'PHP110', 'app-android-oneplus-ace2v', "color: '#000000'"],
  'oneplus ace 2v black status bar'
);
mustInclude(
  'frontend/shouye.html',
  ['20260816-ace2v-php110', 'app-android-oneplus-ace2v'],
  'shouye ace 2v black bar'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['PJA110', 'app-android-oneplus-ace2pro', '20260815-neo8pro-v2302', 'app-android-xiaomi-14pro', '23116PN5', 'V2302A'],
  'shuiming_result ace 2 pro + mi14pro + neo8pro'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['function clientUaBlob', '23116PN5', 'html.app-android-client.app-top-safe-shell.app-android-xiaomi-14pro body.page-shuiming-result .top-fixed .header .back-btn'],
  'auth.js mi14pro inset + back-btn'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isIPhone13Client', 'iPhone14,5', 'app-ios-iphone13'],
  'iphone 13 company full name detect'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['isIPhone13FullCompanyClient', 'app-ios-iphone13', 'fullCompany ? company', '-webkit-text-fill-color: #666'],
  'shuiming_result iphone13 full company'
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

(function testOnePlusAce2VUa() {
  const reModel = /PHP110/i;
  const reName = /(?:OnePlus|一加)\s*Ace\s*2\s*V/i;
  const hit = [
    'Mozilla/5.0 (Linux; Android 15; PHP110 Build/UKQ1) AppleWebKit/537.36',
    'Mozilla/5.0 (Linux; Android 15) OnePlus Ace 2V',
    'Mozilla/5.0 (Linux; Android 15) 一加 Ace 2V'
  ];
  const miss = [
    'Mozilla/5.0 (Linux; Android 14; PJA110) OnePlus Ace 2 Pro',
    'Mozilla/5.0 (Linux; Android 14; PHK110) OnePlus Ace 2',
    'Mozilla/5.0 (Linux; Android 15; PJZ110) OnePlus 13'
  ];
  const hitOk = hit.every((ua) => reModel.test(ua) || reName.test(ua));
  const missOk = miss.every((ua) => !reModel.test(ua) && !reName.test(ua));
  if (hitOk && missOk) ok('oneplus ace 2v UA match');
  else fail('oneplus ace 2v UA match');
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
