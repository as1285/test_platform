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
  'frontend/public/js/auth.js',
  ['isXiaomi17UltraClient', '25128PNA1', '2512BPNDA', 'app-android-xiaomi-17u', 'isXiaomi17UltraScreen'],
  'xiaomi 17 ultra immersive top'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['var companyShow = company', 'word-break: break-word', 'app-android-xiaomi-17u', '20260814-mine-immersive'],
  'shuiming_result full company name'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isHuaweiMate60PhysicalScreen', 'ALN-AL00', 'BRA-AL00', 'applyHuaweiMate60PageChrome', 'data-huawei-mate60-chrome', 'app-android-huawei-mate60', 'body.page-login', 'padding-top:40px', 'isHuaweiMate70LikeClient', 'SUP-AL90', 'app-android-huawei-mate70-air'],
  'mate60 global top inset'
);
mustInclude(
  'frontend/install_guide.html',
  ['isHarmonyOsLikeClient', 'OpenHarmony', 'SUP-AL90', 'isLikelyAndroidClient'],
  'harmony next install apk not ios'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isHarmonyNextLikeClient', 'OpenHarmony', 'mineE1Canvas', 'padding-top', '40px'],
  'harmony next mate mine bleed'
);
mustInclude(
  'frontend/mine.html',
  ['app-android-huawei-mate60', 'OpenHarmony', '20260814-mine-immersive', 'html.app-android-client body.page-mine', 'padding-top: 40px'],
  'mine.html mate early detect'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['默认按沉浸 40px', 'isHuaweiHarmonyOsFamilyClient', 'mineE1Canvas', 'padding-top', '40px'],
  'cordova mine immersive default'
);
mustInclude(
  'frontend/login.html',
  ['app-android-huawei-mate60', 'padding-top: 40px', '20260814-mine-immersive'],
  'login.html mate60 top inset'
);
mustInclude(
  'frontend/mine.html',
  ['app-android-huawei-mate60', 'padding-top: 40px', '20260814-mine-immersive'],
  'mine.html mate60 bleed exception'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isOppoFindX8sPlusClient', 'PLB110', 'PKT110', 'app-android-oppo-find-x8s'],
  'oppo find x8s+ immersive top'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['PLB110', 'app-android-oppo-find-x8s'],
  'shuiming_result find x8s+ class'
);

(function testOppoFindX8sUa() {
  const reModel = /PLB110|PKT110/i;
  const reName = /Find\s*X\s*8s(?:\s*\+|\s*Plus)?/i;
  const hit = [
    'Mozilla/5.0 (Linux; Android 15; PLB110 Build/UKQ1) AppleWebKit/537.36',
    'Mozilla/5.0 (Linux; Android 15; PKT110) AppleWebKit/537.36 OPPO Find X8s',
    'Mozilla/5.0 (Linux; Android 15) OPPO Find X8s+'
  ];
  const miss = [
    'Mozilla/5.0 (Linux; Android 15; PKJ110) OPPO Find X8 Ultra',
    'Mozilla/5.0 (Linux; Android 15; PHJ110) OPPO A58',
    'Mozilla/5.0 (Linux; Android 15; CPH2797) OPPO Find X9'
  ];
  const hitOk = hit.every((ua) => reModel.test(ua) || reName.test(ua));
  const missOk = miss.every((ua) => !reModel.test(ua) && !reName.test(ua));
  if (hitOk && missOk) ok('oppo find x8s+ UA match');
  else fail('oppo find x8s+ UA match');
})();

(function testXiaomi17UltraUa() {
  const reModel = /25128PNA1[A-Z0-9]*|2512BPNDA[A-Z0-9]*/i;
  const reName = /(?:Xiaomi|Mi|小米)[\s_-]*17[\s_-]*U(?:ltra)?\b/i;
  const hit = [
    'Mozilla/5.0 (Linux; Android 16; 25128PNA1C Build/UKQ1) AppleWebKit/537.36',
    'Mozilla/5.0 (Linux; Android 16; 2512BPNDAC Build/UKQ1) AppleWebKit/537.36 Xiaomi 17 Ultra',
    'Mozilla/5.0 (Linux; Android 16; Xiaomi 17U Leica) AppleWebKit/537.36'
  ];
  const miss = [
    'Mozilla/5.0 (Linux; Android 14; 23127PN0CC Build/UKQ1) Xiaomi 14',
    'Mozilla/5.0 (Linux; Android 15; 2410DPN6CC Build/UKQ1) Xiaomi 15 Pro',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
  ];
  const hitOk = hit.every((ua) => reModel.test(ua) || reName.test(ua));
  const missOk = miss.every((ua) => !reModel.test(ua) && !reName.test(ua));
  if (hitOk && missOk) ok('xiaomi 17 ultra UA match');
  else fail('xiaomi 17 ultra UA match');
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
