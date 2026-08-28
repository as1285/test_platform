/**
 * 今日前端/后端改动静态自检（无外部依赖）
 * node scripts/today-changes-selftest.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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

function exists(rel) {
  return existsSync(join(root, rel));
}

function mustInclude(rel, needles, label) {
  const src = read(rel);
  const miss = needles.filter((k) => !src.includes(k));
  if (!miss.length) ok(label);
  else fail(label, 'missing in ' + rel + ': ' + miss.join(', '));
}

function mustExclude(rel, needles, label) {
  const src = read(rel);
  const found = needles.filter((k) => src.includes(k));
  if (!found.length) ok(label);
  else fail(label, 'unexpected in ' + rel + ': ' + found.join(', '));
}

mustInclude(
  'frontend/public/js/auth.js',
  [
    'html.app-ios-client body.page-shouye{background:#f6f7fb !important;min-height:100vh !important;height:auto !important;}',
    'html.app-top-safe-shell:not(.app-ios-client) body.page-shouye .shouye-page{padding-top:var(--shouye-fixed-top-h,78px) !important;}'
  ],
  'iphone home natural scroll height + isolated android top padding'
);
mustInclude(
  'frontend/public/js/auth.js',
  [
    "document.documentElement.style.setProperty('--app-shell-statusbar-top', '40px')",
    'html.app-android-huawei-mate60.app-top-safe-shell body.page-daiban .daiban-header-builtin',
    'padding-top:calc(10px + 40px) !important',
    'pinMate60MineE1Layout',
    'mate60MineE1LockCss',
    'html.app-android-huawei-mate60 body.page-mine .mine-e1-layer{top:0 !important;}',
    '--mine-top-bleed:0px !important',
    'pinMate60MineShift',
    'transform:none !important',
    'pinMineE1RpxFromCanvas'
  ],
  'mate60 0-bleed e1 + daiban header'
);
mustInclude(
  'frontend/mine_jul23_mate60.html',
  ['mine_mate60_aug12.html', '20260824-aug12r6'],
  'mate60 jul23 stub redirects to frozen aug12 page'
);
mustInclude(
  'frontend/mine_v2.html',
  ['mineE1Canvas', '20260827-cend-sync', 'mate60BuildMark', 'UI:e1-v12', 'padding-top:0!important', 'pinMate60RpxEarly', 'mine_mate60_aug12.html', '20260824-aug12r6'],
  'mine_v2 e1 page forwards Mate60 to frozen aug12'
);
mustInclude(
  'frontend/mine.html',
  ['mine_mate60_aug12.html', '20260824-aug12r6', 'app-android-huawei-mate60'],
  'mine.html Mate60 jumps to frozen aug12 page'
);
mustInclude(
  'frontend/mine_mate60_aug12.html',
  ['冻结 2026-08-12', 'auth-mate60-aug12.js?v=20260824-aug12r6', 'nav-mate60-aug12.css?v=20260824-aug12r6', 'theme-loader-mate60-aug12.js', 'UI:aug12-r6', 'mineE1Canvas', "location.replace('mine.html'", 'pinAug12Rpx'],
  'frozen aug12 mine page with guard and pinned assets'
);
mustInclude(
  'frontend/public/js/auth-mate60-aug12.js',
  ['isHuaweiMate60Client', 'app-android-huawei-mate60'],
  'frozen aug12 auth.js snapshot'
);
mustInclude(
  'frontend/public/js/app/core.js',
  ['data-ark-fix-t', 'eagerizeLazyImages', 'HUAWEIALN', 'page-mine'],
  'core.js mate60 all-pages ark drift fix'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['__mate60ArkFix', 'data-ark-fix-t', 'eagerizeLazyImages'],
  'auth.js mate60 all-pages ark drift fix'
);
mustInclude(
  'frontend/sbdy_demo.html',
  ['/api/sbdy-demo/status', 'sku_sbdy_demo_199', 'sbdyRegion', 'period_start', 'btnSbdyOpenPdf'],
  'sbdy demo C-side page'
);
mustExclude(
  'frontend/purchase.html',
  ['cardSbdyDemo', 'sbdy_demo.html?from=purchase'],
  'purchase page sbdy demo entry removed'
);
mustExclude(
  'frontend/consult.html',
  ['sbdyDemoEntryCard', 'sbdy_demo.html?from=consult'],
  'consult page sbdy demo entry removed'
);
mustInclude(
  'backend/src/user/sbdyDemoUser.js',
  ['sku_sbdy_demo_199', 'handleSbdyDemoGenerate', 'createSbdyDemoCert', 'sbdy_demo_unlocked'],
  'backend sbdy demo user module'
);
mustInclude(
  'backend/src/user/routes.js',
  ['/api/sbdy-demo/status', '/api/sbdy-demo/prefill', '/api/sbdy-demo/generate'],
  'backend sbdy demo routes'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  ['SBDY_DEMO_SKU_ID', "grantKind === 'sbdy_demo'", 'sbdy_demo_unlocked'],
  'monolith sbdy demo payment wiring'
);
mustInclude(
  'backend/migrations/032_sbdy_demo_user.sql',
  ['sbdy_demo_unlocked', 'created_by_user'],
  'sbdy demo migration'
);
mustInclude(
  'frontend/nginx.conf',
  ['location = /mine_mate60_aug12.html'],
  'nginx no-store for frozen aug12 page'
);
mustInclude(
  'cordova-app/www/index.html',
  ['mine_v2.html?in_app=1&_v=20260824-e1v12'],
  'cordova shell starts on mine_v2'
);
mustExclude(
  'frontend/shouye.html',
  ['min-height: 100dvh;'],
  'shouye without stacked dynamic viewport height'
);
mustExclude(
  'frontend/public/js/auth.js',
  [
    'html.app-ios-client body.page-shouye{background:#f6f7fb !important;min-height:100vh !important;min-height:100dvh !important;}',
    'html.app-ios-client.app-top-safe-shell body.page-shouye{background:#f6f7fb !important;min-height:100dvh !important;}'
  ],
  'auth without ios home dynamic viewport lock'
);

mustInclude('frontend/public/js/message-badge.js', ['unread_count', 'nav-unread-badge', 'refreshMessageUnreadBadge'], 'message-badge.js');
mustInclude('frontend/css/nav.css', ['nav-unread-badge'], 'nav.css badge');
mustInclude('frontend/purchase.html', ['track_purchase_page_leave', '__purchasePageComplete'], 'purchase leave track');
mustInclude('frontend/admin_panel.html', ['inactive_has_tax', 'inactive_purchase_no_pay'], 'admin bulk audiences');
mustInclude('backend/src/growth/purchasePriceSurvey.js', ['SKIP_SENTIMENT', "'skipped'"], 'price survey skipped');
mustInclude(
  'frontend/purchase.html',
  [
    '点一下就走',
    'PRICE_SURVEY_AUTO_LEAVE_MS',
    '这次先不说',
    "submitPriceSurvey({ skipped: false })"
  ],
  'purchase leave survey one-tap submit'
);
mustInclude('frontend/public/js/consult-batch-tax.js', ['batchMsModalDraft', 'renderBatchMsModalPage'], 'batch-ms pagination');
mustInclude('frontend/public/js/conversion-guide.js', ['openPayGateModal', 'bindPayFeatureGates'], 'conversion pay gate');
mustInclude('frontend/public/js/consult-records.js', ['expandSingleTaxRecordCard', 'taxMoreCard', 'syncTaxPayGuideBanner'], 'editRecord + pay guide');
/* 回收站弹窗绑定必须在 consult-records.js（closeTaxRecycleBin 定义处）执行；
 * 放在先加载的 consult-batch-tax.js 会被 typeof 守卫静默跳过，×/关闭/全部恢复/筛选全部失效 */
mustInclude(
  'frontend/public/js/consult-records.js',
  ['bindTaxRecycleBinModal', "primaryBtn.addEventListener('click', handleTaxRecycleBinPrimaryAction)", "companySel.addEventListener('change'"],
  'recycle bin modal bound in consult-records'
);
mustExclude(
  'frontend/public/js/consult-batch-tax.js',
  ['bindTaxRecycleBinModal'],
  'recycle bin bind removed from consult-batch-tax'
);
mustInclude('frontend/consult.html', ['consult-records.js?v=20260827-tax-edit-fee'], 'consult recycle-bind cache');
mustInclude('backend/src/user/lizhiCertUser.js', ['preview_png_base64'], 'lizhi user api png');
mustInclude(
  'backend/scripts/lizhi_render_pdf.py',
  ['.preview.png', 'SEAL_RED = (214, 28, 32, 255)', 'SS * 0.032', 'SEAL_STAMP_ALPHA = 0.90', 'place_seal'],
  'lizhi render png + large vermilion seal'
);
mustInclude(
  'backend/scripts/zaizhi_render_pdf.py',
  ['place_seal', 'SEAL_PT'],
  'zaizhi uses shared vermilion seal'
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
mustInclude(
  'frontend/admin_panel.html',
  ['adminAccountsPageHint', '上级'],
  'admin downline accounts page'
);
mustInclude(
  'frontend/public/js/admin_panel.js',
  ["'zaizhi-cert': 1", 'opts.page', 'adminPagePanelId(rawHash)', 'ops-ia-v15-assignable-sidebar'],
  'admin zaizhi-cert hash not bounced'
);
mustInclude(
  'frontend/public/js/admin_panel.js',
  ["'downline-admins': 1", 'canOpenAdminAccountsPage', 'syncAdminAccountsPageCopy', '新增下线'],
  'admin downline-admins page routing'
);
mustInclude(
  'backend/src/admin/menuRegistry.js',
  ["page: 'downline-admins'", "label: '下线管理员'", 'hide_for_super: true'],
  'menuRegistry downline-admins'
);
mustInclude(
  'backend/src/admin/menuRegistry.js',
  [
    "page: 'peer-accounts'",
    "menu_key: 'peer-accounts'",
    "page: 'rename-tax-daily'",
    "menu_key: 'rename-tax-daily'",
    "page: 'users-deleted'",
    "menu_key: 'users-deleted'",
    "page: 'user-login-log'",
    "menu_key: 'user-login-log'",
    'group_label'
  ],
  'menuRegistry assignable sidebar child pages'
);
mustInclude(
  'backend/src/admin/routes.js',
  [
    "requireAdminMenu('users-deleted')",
    "requireAdminMenu('rename-tax-daily')",
    "requireAdminMenu('user-login-log')",
    "['peer-accounts']"
  ],
  'admin routes gate new sidebar menu keys'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  [
    "SELECT DISTINCT admin_id, 'peer-accounts'",
    "SELECT DISTINCT admin_id, 'rename-tax-daily'",
    "SELECT DISTINCT admin_id, 'users-deleted'",
    "SELECT DISTINCT admin_id, 'user-login-log'"
  ],
  'bootstrap migrate sidebar child menu keys'
);
mustInclude(
  'frontend/public/js/admin_panel.js',
  ['adminMenuSelectorHtml', 'admin-menu-selector-group-title', 'ops-ia-v15-assignable-sidebar'],
  'admin accounts menu selector grouped by sidebar'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  [
    '是否永久免改名费 / 个税修改费（同一白名单）',
    'var exempt = await isRenameFeeExemptUser(userId);',
    '已取消该账号的改名与个税修改限制',
    'tax_edit_fee_exempt: exempt'
  ],
  'rename_fee_exempt whitelist gates rename and tax-edit'
);
mustInclude(
  'frontend/public/js/admin_panel.js',
  ['取消改名/改税限制', '重新加改名/改税限制', '免改名改税'],
  'admin exempt button covers rename and tax-edit'
);
mustInclude(
  'frontend/admin_panel.html',
  ['admin_panel.js?v=20260828-peer-days', 'min="0" max="99999.99"', '填 <strong>0</strong> 则超限后也不收费'],
  'admin rename fee allows 0 and cache-busts'
);
mustExclude(
  'backend/src/legacy/monolith.js',
  ['params.push(peerFeeCfg.rename_gt', 'peer_rename_gt:'],
  'peer list binds days_gt only'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  ['勿再绑定已删除的 rename_gt', 'params.push(peerDaysGt)'],
  'peer list days-only bind'
);
mustInclude(
  'backend/src/user/renameFeePolicy.js',
  ['function isRenameFeeCharged', 'n < 0 || n > 99999.99'],
  'rename fee amount accepts 0'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  [
    'if (!renameFeePolicy.isRenameFeeCharged(renameFeeCfg.amount))',
    '改名费用为 0，无需付款'
  ],
  'rename fee 0 skips paywall and alipay create'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  [
    "var taxFeePricingVariant = 'tax_daily'",
    'insertPendingAddonOrder',
    'ensurePaymentOrdersVariantColumns',
    '创建个税修改订单失败：'
  ],
  'tax edit order pricing_variant fits VARCHAR(16)'
);
mustInclude(
  'backend/migrations/034_payment_orders_pricing_variant_widen.sql',
  ['MODIFY COLUMN pricing_variant VARCHAR(32)'],
  'widen payment_orders.pricing_variant'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  [
    'parent_admin_username',
    'appendSubAdminOwnedUsersScopeForAdmin',
    'adminCanManageAccountsPage',
    'constrainMenusToActor'
  ],
  'monolith downline admin scope'
);
mustInclude(
  'backend/migrations/030_admin_downline.sql',
  ['parent_admin_username', 'downline-admins'],
  'migration admin downline parent column'
);
mustInclude('frontend/consult.html', ['taxPayGuideBanner'], 'tax pay guide banner');
mustInclude(
  'backend/src/legacy/pricingAb.js',
  [
    'sku_300_7d',
    'sku_348_14d',
    'sku_398_30d',
    "amount: '398.00'",
    'SKU_300_WEEK',
    'SKU_249_DAY',
    'SKU_268_3DAY'
  ],
  'pricing live catalog 300/348/398（天卡与3天卡已下架）'
);
mustInclude(
  'frontend/purchase.html',
  ['以购买页各套餐显示为准', 'BILIBILI_SHARE_DISCOUNT_HIDDEN = true'],
  'purchase duration copy + hide bili share'
);
mustInclude(
  'frontend/purchase.html',
  [
    'is-high-intent',
    'consult_products',
    'cardAlipaySkel',
    'purchaseTrustRow',
    'pricing-sku-radio',
    '增值服务与其它',
    'grid-template-columns: 1fr 1fr'
  ],
  'purchase conversion first-screen: high-intent + sku grid + trust'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  ['BILIBILI_SHARE_DISCOUNT_ENABLED = false'],
  'bili share discount off'
);
mustInclude(
  'frontend/admin_panel.html',
  ['sku_300_7d', 'sku_348_14d', 'sku_398_30d', 'btnSaveSkuCatalogPrices', 'sku-catalog-days', 'sku-catalog-hours'],
  'admin offer three-sku + editable duration'
);
mustExclude(
  'frontend/admin_panel.html',
  ['skuPriceHour', 'data-sku-id="sku_99_1h"', 'data-sku-id="sku_249_1d"', 'data-sku-id="sku_268_3d"', 'skuPriceDay', 'skuPrice3Day'],
  'admin catalog no hour/1-day/3-day rows'
);
mustInclude(
  'backend/src/legacy/pricingAb.js',
  ['sku_catalog_prices_json', 'saveCatalogAmountsFromAdmin', 'loadCatalogAmounts', 'catalog_amounts'],
  'pricing catalog amounts persist'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  ['sku_catalog_prices', 'saveCatalogAmountsFromAdmin', 'hasSkuCatalogPrices'],
  'admin settings sku catalog prices'
);
mustInclude(
  'frontend/public/js/admin_panel.js',
  ['collectSkuCatalogPricesFromForm', 'btnSaveSkuCatalogPrices', 'sku_catalog_prices'],
  'admin panel save sku catalog prices'
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
mustInclude(
  'frontend/install_guide.html',
  ['http://43.128.147.171/download', '下载招商银行模拟器'],
  'install guide CMB simulator download page'
);
mustExclude(
  'frontend/install_guide.html',
  ['43.165.173.213/download'],
  'install guide no longer points at old CMB host'
);
/* UI 已回退到 2026-08-13 ~10:00 CST（a7a24f0/885ea22）；勿再锁定其后 Mate/小米17 顶栏改动 */
mustInclude(
  'frontend/login.html',
  ['20260827-cend-sync'],
  'login.html auth cache neo8'
);
mustInclude(
  'frontend/mine.html',
  ['20260824-aug12r6', 'data-mate60-aug15-firstpaint', 'app-android-huawei-mate60', 'ALN-AL00', 'ALN-AL10', 'V2302A', 'V2301A', 'PGP110', 'PHW110', 'app-android-oppo-reno10', 'app-android-iqoo-neo8', 'BLK-AL80', 'app-android-huawei-nova13', '100cqw / 750', 'mine-share-done'],
  'mine.html mate60 e1 (plan B / c93c3cc) + reno10 + neo8 + nova13 cache'
);
mustExclude(
  'frontend/mine.html',
  ['mine_jul23_mate60.html'],
  'mine.html no longer redirects Mate60 to jul23 card'
);
mustInclude(
  'frontend/mine.html',
  ['data-mine-e1-selfheal', '@sm.png', '__mineE1ForceSm', 'e1_01.png?v=20260827-e1r3', 'data-xiaomi14pro-mine-e1-paint', 'e1_01@sm.png'],
  'mine.html e1 self-heal + 14 Pro CSS paint'
);
mustInclude(
  'frontend/mine_v2.html',
  ['data-mine-e1-selfheal', '@sm.png', '__mineE1ForceSm', 'e1_01.png?v=20260827-e1r3', 'data-xiaomi14pro-mine-e1-paint', 'e1_01@sm.png'],
  'mine_v2.html e1 self-heal + fresh cache stamp'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isVivoS50ProMiniClient', 'app-android-vivo-s50promini', 'S50 Pro mini', 'isHuaweiNova13Client', 'BLK-AL80', 'MIS-AL00', 'HUAWEIBLK', 'app-android-huawei-nova13', 'isHuaweiNova13Client()', 'isHuaweiWhitePageImmersiveClient', 'pinWhitePageImmersiveHeader', 'pinNova13MineE1Layout', 'HMSCore|Huawei|HUAWEI', ':not(.app-android-huawei-nova13):not(.app-android-immersive-white-top) body.page-shuiming > .header', 'resetMate60MineE1RpxToViewport', 'pinMineE1RpxFromCanvas', 'setProperty(\'--mine-rpx\', rpx, imp)'],
  'huawei nova 13 mine overlay + white-top detect'
);
mustInclude(
  'frontend/public/js/fast-nav.js',
  ['20260824-skip-hide'],
  'fast-nav auth cache mate60 plan B'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isHonorPgtAn20Client', 'PGT-AN20', 'HONORPGT-AN20', 'isHonorMagic5ProScreen', 'pinHonorMagic5ProHomeCards', '--shouye-status-inset:8px', 'isHonorMagic6ProClient', 'BVL-AN16', 'app-android-honor-magic6pro'],
  'honor magic5 pro + magic6 pro home card detect'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['--mine-top-bleed:0px !important', 'pinMate60MineShift', 'data-mate60-aug15-lock', 'pinMate60MineE1Layout', 'app-huawei-mine-noclip', 'isLikelyAndroidViewportClient', 'OpenHarmony', 'isIqooNeo8ProClient', 'isIqooNeo8Client', 'V2302A', 'V2301A', 'clientUaBlob', 'OriginOS/iQOO 会变成黑条白字', "shell_bg: '#ffffff'", 'tax_device_model_v1', 'mineShellBg'],
  'auth.js mate60 e1-v12 + neo8 / neo8pro + white-bar dark icons'
);
mustExclude(
  'frontend/public/js/auth.js',
  ['pinMate60Jul23CardMineChrome', "classList.add('app-mate60-jul23-ui')"],
  'auth.js without jul23 card chrome'
);
mustInclude(
  'frontend/shuiming.html',
  ['V2302A', 'V2301A', 'app-android-iqoo-neo8pro', 'app-android-iqoo-neo8', '20260828-android-load', 'PGP110', 'app-android-oneplus-acepro', 'PHW110', 'app-android-oppo-reno10', 'BLK-AL80', 'app-android-huawei-nova13', 'tax_device_model_v1', 'data-nova13-sm-firstpaint', 'padding-top:54px', '2211133', 'app-android-xiaomi-13'],
  'shuiming acepro + reno10 + neo8 + nova13 inset'
);
mustInclude(
  'frontend/message.html',
  ['V2302A', 'V2301A', 'app-android-iqoo-neo8pro', 'app-android-iqoo-neo8', '20260826-iphone13pm'],
  'message neo8 / neo8pro inset'
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
  ['isOnePlusAceProClient', 'PGP110', 'app-android-oneplus-acepro'],
  'oneplus ace pro immersive top'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isOnePlusAce2VClient', 'PHP110', 'app-android-oneplus-ace2v', "color: '#000000'"],
  'oneplus ace 2v black status bar'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isOppoReno10Client', 'PHW110', 'CPH2531', 'app-android-oppo-reno10'],
  'oppo reno10 5g immersive top'
);
mustInclude(
  'frontend/shouye.html',
  ['20260827-cend-sync', 'app-android-oneplus-ace2v', 'app-android-oppo-reno10', 'ALN-AL10', 'PGT-AN20', 'app-android-honor-pgt-an20', 'BVL-AN16', 'app-android-honor-magic6pro', 'min(104px', '1312', '--shouye-status-inset: 8px', 'app-android-xiaomi-13', '2211133'],
  'shouye ace 2v + reno10 + magic5pro cards'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['PJA110', 'app-android-oneplus-ace2pro', '20260827-cend-sync', 'PGP110', 'app-android-oneplus-acepro', 'app-android-xiaomi-14pro', '23116PN5', 'V2302A', 'V2301A', 'PHW110', 'app-android-oppo-reno10', '24129PN74', 'app-android-xiaomi-15', 'app-android-iqoo-neo8', 'color: #000', 'BLK-AL80', 'app-android-huawei-nova13', '2211133', 'app-android-xiaomi-13'],
  'shuiming_result ace 2 pro + ace pro + reno10 + mi14pro + neo8 + mi15 line + nova13'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isXiaomi15Client', '24129PN74', 'app-android-xiaomi-15'],
  'xiaomi 15 list line-height detect'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['function clientUaBlob', '23116PN5', 'html.app-android-client.app-top-safe-shell.app-android-xiaomi-14pro body.page-shuiming-result .top-fixed .header .back-btn', 'function paintXiaomi14ProMineE1', 'xiaomi14pro-mine-e1-paint'],
  'auth.js mi14pro inset + back-btn + e1 paint'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isXiaomi13ProClient', '2210132[CGEI]', 'app-android-xiaomi-13pro', 'isXiaomi13ProClient()', 'isXiaomi13Client()', 'html.app-android-xiaomi-13.app-top-safe-shell'],
  'auth.js xiaomi 13 pro immersive top'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['2210132[CGEI]', 'app-android-xiaomi-13pro', '20260827-cend-sync', '2211133', 'app-android-xiaomi-13'],
  'shuiming_result xiaomi 13 pro first-paint'
);
mustInclude(
  'frontend/xiangqing.html',
  ['BLK-AL80', 'app-android-huawei-nova13', '20260827-cend-sync', 'padding-top: calc(10px + 40px)', 'tax_device_model_v1', 'data-nova13-xq-firstpaint', '2211133', 'app-android-xiaomi-13'],
  'xiangqing nova 13 statusbar inset'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isIPhone13Client', 'iPhone14,5', 'app-ios-iphone13'],
  'iphone 13 company full name detect'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['isIPhone13FullCompanyClient', 'app-ios-iphone13', '#recordList .list-label', '--ufs-list-body-color, #666'],
  'shuiming_result iphone13 full company'
);
mustInclude(
  'frontend/public/js/user-font-settings.js',
  ['-webkit-text-fill-color', '--ufs-list-body-color', 'html.user-font-custom [data-ufs-target]'],
  'user font settings ios color override'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['20260827-cend-sync', 'var(--ufs-list-body-color, #666)'],
  'shuiming_result list body color follows ufs var'
);
mustInclude(
  'frontend/shuiming_result.html',
  [
    'list-row-subtype',
    'list-row-tax',
    'html.app-ios-iphone14:not(.app-ios-iphone14pro) body.page-shuiming-result #recordList .list-row-subtype',
    'html.app-ios-iphone14:not(.app-ios-iphone14pro) body.page-shuiming-result #recordList .list-row-tax'
  ],
  'iphone14 subtype/tax row gap classes'
);
mustExclude(
  'frontend/shuiming_result.html',
  [
    'html.app-ios-iphone14:not(.app-ios-iphone14pro) body.page-shuiming-result #recordList .list-label',
    'html.app-ios-iphone14:not(.app-ios-iphone14pro) body.page-shuiming-result .list-company'
  ],
  'iphone14 result list not using later iphone13 lock'
);
mustInclude(
  'frontend/css/nav.css',
  ['html body.page-message', '--bottom-nav-bottom: 8px !important'],
  'tab pages share 8px bottom nav'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['html body.page-daiban,html body.page-bancha{--bottom-nav-bottom:8px'],
  'daiban nav gap matches message'
);
mustInclude(
  'frontend/css/nav.css',
  ['html.app-ios-iphone16pro body.page-daiban > .bottom-nav', 'html.app-ios-iphone16pro body.page-message > .bottom-nav'],
  'iphone 16 pro tab nav same bottom'
);
if (read('frontend/public/js/auth.js').includes('iphone16pro body.page-mine > .bottom-nav') && read('frontend/public/js/auth.js').includes('bottom:2px!important')) {
  fail('iphone 16 pro mine-only 2px leftover');
} else {
  ok('iphone 16 pro without mine-only 2px');
}

(function testXiaomi15Ua() {
  const reModel = /24129PN74/i;
  const reName = /(?:Xiaomi|Mi|小米)[\s_-]*15(?![\s_-]*(?:Pro|Ultra|S))/i;
  const rePro = /2410DPN6CC|24101PNB7C|Xiaomi\s*15\s*Pro|Mi\s*15\s*Pro/i;
  const hit = [
    'Mozilla/5.0 (Linux; Android 15; 24129PN74C Build/AQ3A) AppleWebKit/537.36',
    'Mozilla/5.0 (Linux; Android 15) Xiaomi 15',
    'Mozilla/5.0 (Linux; Android 15) 小米 15'
  ];
  const miss = [
    'Mozilla/5.0 (Linux; Android 15; 2410DPN6CC) Xiaomi 15 Pro',
    'Mozilla/5.0 (Linux; Android 15) Mi 15 Pro',
    'Mozilla/5.0 (Linux; Android 15; 25019PNF3C) Xiaomi 15 Ultra',
    'Mozilla/5.0 (Linux; Android 14; 23116PN5BC) Xiaomi 14 Pro'
  ];
  const hitOk = hit.every((ua) => (reModel.test(ua) || reName.test(ua)) && !rePro.test(ua));
  const missOk = miss.every((ua) => !reModel.test(ua) && (rePro.test(ua) || !reName.test(ua)));
  if (hitOk && missOk) ok('xiaomi 15 UA match');
  else fail('xiaomi 15 UA match');
})();

(function testVivoS50ProMiniUa() {
  const reModel = /V2527A|V2527DA|V2527B|PD2527[A-Z]?|\bV2527\b/i;
  const reName = /(?:vivo[\s_-]*)?S50[\s_-]*Pro[\s_-]*[Mm]ini|S50Promini/i;
  const hit = [
    'Mozilla/5.0 (Linux; Android 16; V2527A Build/UP1A)',
    'S50 Pro mini',
    'vivo S50 Pro mini',
    'PD2527A',
    'V2527'
  ];
  const miss = [
    'vivo S50 Pro',
    'Mozilla/5.0 (Linux; Android 15; V2502A) vivo X300 Pro',
    'Mozilla/5.0 (Linux; Android 14; V2301A) iQOO Neo8'
  ];
  const hitOk = hit.every((ua) => reModel.test(ua) || reName.test(ua));
  const missOk = miss.every((ua) => !reModel.test(ua) && !reName.test(ua));
  if (hitOk && missOk) ok('vivo s50 pro mini UA match');
  else fail('vivo s50 pro mini UA match');
})();

(function testHuaweiNova13Ua() {
  const reModel = /HUAWEIBLK|BLK-AL\d{2}|BLK-LX9|BLK-L29|MIS-AL00|MIS-AL80|MIS-AL\d{2}|MIS-LX9/i;
  const reName = /(?:Huawei|HUAWEI|华为)?[\s_-]*nova[\s_-]*13(?:[\s_-]*Pro)?/i;
  const hit = [
    'Mozilla/5.0 (Phone; OpenHarmony 4.2) Huawei BLK-AL80',
    'Mozilla/5.0 (Linux; Android 12; BLK-AL00 Build/HUAWEIBLK-AL00)',
    'Mozilla/5.0 (Linux; Android 12; MIS-AL00) HUAWEI nova 13 Pro'
  ];
  const miss = [
    'Mozilla/5.0 (Linux; Android 12; ALN-AL00) HUAWEI Mate 60',
    'Mozilla/5.0 (Linux; Android 12; MIZ-BD00) Hi nova 11',
    'Mozilla/5.0 (Linux; Android 12; PLA-AL10) HUAWEI Mate 70'
  ];
  const hitOk = hit.every((ua) => reModel.test(ua) || reName.test(ua));
  const missOk = miss.every((ua) => !reModel.test(ua) && !reName.test(ua));
  if (hitOk && missOk) ok('huawei nova 13 UA match');
  else fail('huawei nova 13 UA match');
})();

(function testHonorMagic5ProUa() {
  const reModel = /PGT[\s_-]?AN20|HONORPGT-AN20/i;
  const reName = /Magic\s*5\s*Pro/i;
  const hit = [
    'Mozilla/5.0 (Linux; Android 16; PGT-AN20 Build/HONORPGT-AN20)',
    'Mozilla/5.0 (Linux; Android 16) HONOR Magic 5 Pro',
    'PGT-AN20'
  ];
  const miss = [
    'Mozilla/5.0 (Linux; Android 14; BVL-AN16) HONOR Magic 6 Pro',
    'Mozilla/5.0 (Linux; Android 15; PTP-AN00) HONOR Magic7',
    'Mozilla/5.0 (Linux; Android 13; PGT-AN00) HONOR Magic5'
  ];
  const hitOk = hit.every((ua) => reModel.test(ua) || reName.test(ua));
  const missOk = miss.every((ua) => !reModel.test(ua) && !reName.test(ua));
  if (hitOk && missOk) ok('honor magic5 pro UA match');
  else fail('honor magic5 pro UA match');
})();

(function testHonorMagic6ProUa() {
  const reModel = /BVL-AN16|BVL-AN20|BVL-N49|HONORBVL-AN16/i;
  const reName = /(?:Honor|HONOR|荣耀)?[\s_-]*Magic[\s_-]*6[\s_-]*Pro/i;
  const hit = [
    'Mozilla/5.0 (Linux; Android 14; BVL-AN16 Build/HONORBVL-AN16)',
    'Mozilla/5.0 (Linux; Android 14) HONOR Magic 6 Pro'
  ];
  const miss = [
    'Mozilla/5.0 (Linux; Android 16; PGT-AN20) HONOR Magic5 Pro',
    'Mozilla/5.0 (Linux; Android 14; BVL-AN00) HONOR Magic 6',
    'Mozilla/5.0 (Linux; Android 15; PTP-AN00) HONOR Magic7'
  ];
  const hitOk = hit.every((ua) => reModel.test(ua) || reName.test(ua));
  const missOk = miss.every((ua) => !reModel.test(ua) && !reName.test(ua));
  if (hitOk && missOk) ok('honor magic6 pro UA match');
  else fail('honor magic6 pro UA match');
})();

(function testOnePlusAceProUa() {
  const reModel = /PGP110|CPH2413|CPH2415|CPH2417/i;
  const reName = /(?:OnePlus|一加)[\s_-]*Ace[\s_-]*Pro(?![\s_-]*2)/i;
  const hit = [
    'Mozilla/5.0 (Linux; Android 15; PGP110 Build/UKQ1) AppleWebKit/537.36',
    'Mozilla/5.0 (Linux; Android 15) OnePlus Ace Pro',
    'Mozilla/5.0 (Linux; Android 15) 一加 Ace Pro'
  ];
  const miss = [
    'Mozilla/5.0 (Linux; Android 14; PJA110) OnePlus Ace 2 Pro',
    'Mozilla/5.0 (Linux; Android 14; PHK110) OnePlus Ace 2',
    'Mozilla/5.0 (Linux; Android 15; PHP110) OnePlus Ace 2V',
    'Mozilla/5.0 (Linux; Android 15; PJZ110) OnePlus 13'
  ];
  const hitOk = hit.every((ua) => reModel.test(ua) || reName.test(ua));
  const missOk = miss.every((ua) => !reModel.test(ua) && !reName.test(ua));
  if (hitOk && missOk) ok('oneplus ace pro UA match');
  else fail('oneplus ace pro UA match');
})();

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

(function testOppoReno10Ua() {
  const reModel = /PHW110|CPH2531|CPH2525/i;
  const reName = /(?:OPPO\s*)?Reno\s*10\s*5G/i;
  const rePro = /Reno\s*10\s*Pro/i;
  const hit = [
    'Mozilla/5.0 (Linux; Android 15; PHW110 Build/UKQ1) AppleWebKit/537.36',
    'Mozilla/5.0 (Linux; Android 15; CPH2531) OPPO Reno10 5G',
    'Mozilla/5.0 (Linux; Android 15) OPPO Reno 10 5G'
  ];
  const miss = [
    'Mozilla/5.0 (Linux; Android 15; PHV110) OPPO Reno10 Pro 5G',
    'Mozilla/5.0 (Linux; Android 15; PHU110) OPPO Reno10 Pro+',
    'Mozilla/5.0 (Linux; Android 15; PGP110) OnePlus Ace Pro',
    'Mozilla/5.0 (Linux; Android 14; PJA110) OnePlus Ace 2 Pro'
  ];
  const hitOk = hit.every((ua) => reModel.test(ua) || (reName.test(ua) && !rePro.test(ua)));
  const missOk = miss.every((ua) => !reModel.test(ua) && !(reName.test(ua) && !rePro.test(ua)));
  if (hitOk && missOk) ok('oppo reno10 5g UA match');
  else fail('oppo reno10 5g UA match');
})();

mustInclude(
  'frontend/shuiming.html',
  ['href="shouye.html"', 'resolveBackTarget', "var HOME = 'shouye.html'"],
  'shuiming back -> home'
);
mustInclude('frontend/consult.html', ['>激活页面<'], 'consult tab 激活页面');
mustInclude(
  'frontend/consult.html',
  ['id="cardShebaoPhoto" hidden', '20260828-multi-bonus'],
  'consult shebao upload entry hidden'
);
mustInclude(
  'frontend/purchase.html',
  ['id="cardShebaoPhoto" hidden'],
  'purchase shebao upload entry hidden'
);
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
mustInclude(
  'frontend/admin_panel.html',
  ['col-cert-perm', '/js/admin_panel.js?v='],
  'admin users cert perm column + cache'
);
mustInclude(
  'frontend/public/js/admin_panel.js',
  [
    'btn-user-lizhi-unlock',
    'btn-user-zaizhi-unlock',
    'btn-user-cert-unlock-both',
    'col-cert-perm',
    '开通离职',
    '开通在职',
    '两项都开',
    'api/admin/user-lizhi-cert-unlock',
    'api/admin/user-zaizhi-cert-unlock'
  ],
  'admin users cert unlock buttons'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  ['handleAdminUserLizhiCertUnlock', 'handleAdminUserZaizhiCertUnlock'],
  'admin cert unlock apis'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  [
    "ADMIN_FULL_USER_SCOPE_USERNAMES",
    "'19106014552': true",
    'function adminHasFullUserScope',
    'if (!admin || adminHasFullUserScope(admin)) return true'
  ],
  'admin 19106014552 full registered user scope'
);
mustInclude(
  'frontend/admin_panel.html',
  ['ccbFlowAmountMin', 'ccbFlowAmountMax', '工资下限', '工资上限', '起始月', 'ccbFlowExpenseOn', 'ccbFlowExpenseTotal', '生成支出'],
  'ccb flow salary and month range + expenses'
);
mustInclude(
  'frontend/public/js/admin/modules/ccb-flow.js',
  ['enumerateMonths', 'buildAmountsForMonths', 'ccbFlowAmountMin', 'MAX_FLOW_MONTHS', 'collectExpenseTotal', '自动拆多笔'],
  'ccb flow range generate + expenses'
);
mustInclude(
  'backend/scripts/ccb_flow_render.py',
  ['months_in_range', 'parse_range_pair', 'amount_min', 'MAX_MONTHS', 'MAX_ROWS', 'auto_expenses_from_total', '_force_amounts_sum', 'total_expense', 'build_transactions'],
  'ccb render month/amount range + expenses'
);
mustInclude(
  'backend/src/admin/ccbFlow.js',
  ['expenses', 'parseMaybeJsonArray'],
  'ccb flow API expenses field'
);
mustInclude(
  'backend/scripts/sbdy_wh_render_pdf.py',
  [
    '湖北省社会保险参保证明（个人专用）',
    'wh_seal.png',
    '近12个月参保缴费情况',
    '缴费类型',
    'MAX_SHOW = 12',
    'https://hbsb.hb12333.com/hbrswt/template/dzsbzmyz.html',
    'Y_INFO1 = 51.0',
    'CJK_ASCENT = 1.12',
    'FS_SEC = 13.3',
  ],
  'sbdy Wuhan PDF renderer'
);
mustInclude(
  'backend/src/admin/sbdyDemo.js',
  ['https://hbsb.hb12333.com/hbrswt/template/dzsbzmyz.html', 'height:24pt', 'font-size:12pt'],
  'sbdy Wuhan HTML verify URL + section spacing'
);
if (!read('backend/scripts/sbdy_wh_render_pdf.py').includes('draw_watermark')) {
  ok('sbdy Wuhan PDF no watermark');
} else {
  fail('sbdy Wuhan PDF no watermark');
}
mustInclude(
  'backend/scripts/make_wh_seal.py',
  ['湖北省城镇企业职工社会保险', '参保证明章', 'wh_seal_source.png'],
  'sbdy Wuhan seal text'
);
if (read('backend/scripts/make_wh_seal.py').includes('社会保险局')) {
  fail('sbdy Wuhan seal without 局', 'ring still has 局');
} else {
  ok('sbdy Wuhan seal without 局');
}
mustInclude(
  'backend/src/admin/sbdyDemo.js',
  ['武汉版打印时间固定为生成当天', 'defaultPrintDateCn()', 'sbdy_wh_seal.png?v=20260825-clean-top'],
  'sbdy Wuhan print date forced today + seal cache'
);
mustInclude(
  'frontend/public/js/admin/modules/sbdy-demo.js',
  ['武汉版：打印时间始终用当天', 'defaultPrintDateCn()'],
  'sbdy Wuhan admin force today print date'
);
/* loader cache must point at the latest sbdy-demo bundle */
mustInclude(
  'frontend/public/js/admin/loader.js',
  ['20260828-list-del'],
  'sbdy-demo loader cache for Beijing layout'
);
if (!exists('backend/assets/sbdy/wh_seal.png') || !exists('frontend/public/img/sbdy_wh_seal.png')) {
  fail('sbdy Wuhan seal assets present', 'missing wh_seal.png');
} else {
  ok('sbdy Wuhan seal assets present');
}
if (!exists('backend/assets/sbdy/wh_seal_source.png')) {
  fail('sbdy Wuhan seal source present', 'missing wh_seal_source.png');
} else {
  ok('sbdy Wuhan seal source present');
}
/* 回归：示例填充不再写死 2025年02月19日 */
if (read('frontend/public/js/admin/modules/sbdy-demo.js').includes('2025年02月19日')) {
  fail('sbdy Wuhan sample print date not hardcoded', 'still has 2025年02月19日');
} else {
  ok('sbdy Wuhan sample print date not hardcoded');
}

mustInclude(
  'backend/scripts/sbdy_hn_render_pdf.py',
  [
    '个人参保信息（实缴明细）',
    '湖南社保',
    'draw_watermark',
    'draw_relations',
    'draw_dispatch_table',
    'DETAIL_X',
    'paginate_detail_rows',
  ],
  'sbdy Hunan PDF renderer'
);
mustInclude(
  'backend/src/admin/sbdyDemo.js',
  ['SBDY_HN_RENDER_SCRIPT', 'normalizeHnPayload', 'buildHnDetailRows', 'isHnRegion'],
  'sbdy Hunan backend routing'
);
mustInclude(
  'frontend/public/js/admin/modules/sbdy-demo.js',
  ['sbdyRegionHn', '常德市鼎城区', '湖南示例'],
  'sbdy Hunan admin UI'
);
mustInclude(
  'frontend/admin_panel.html',
  ['sbdyRegionHn', '湖南个人参保信息（实缴明细）'],
  'sbdy Hunan admin panel radio'
);

mustInclude(
  'backend/scripts/sbdy_bj_render_pdf.py',
  [
    '北京市社会保险个人权益记录',
    '五险缴费明细',
    '养老保险单位变动记录',
    'bj_si_seal.png',
    'bj_mi_seal.png',
    '查询时间段',
    '补充资料',
    'fuwu.rsj.beijing.gov.cn'
  ],
  'sbdy Beijing PDF renderer'
);
mustInclude(
  'backend/src/admin/sbdyDemo.js',
  ['SBDY_BJ_RENDER_SCRIPT', 'normalizeBjPayload', 'isBjRegion', 'renderBjCertHtml', 'query_period_label', '补充资料'],
  'sbdy Beijing backend routing'
);
mustInclude(
  'frontend/public/js/admin/modules/sbdy-demo.js',
  ['sbdyRegionBj', '朝阳区', '北京示例', '王佩茹', '6821'],
  'sbdy Beijing admin UI'
);
mustInclude(
  'frontend/admin_panel.html',
  ['sbdyRegionBj', '北京社会保险个人权益记录'],
  'sbdy Beijing admin panel radio'
);
mustInclude(
  'frontend/sbdy_demo.html',
  ['sbdyRegionBj', '20260828-list-del'],
  'sbdy Beijing C-end radio + cache'
);
mustInclude(
  'backend/src/admin/sbdyDemo.js',
  ['handleAdminSbdyDemoDelete', 'DELETE FROM sbdy_demo_certs WHERE id = ?'],
  'sbdy demo list delete handler'
);
mustInclude(
  'backend/src/admin/routes.js',
  ['/api/admin/sbdy-demo/delete', 'handleAdminSbdyDemoDelete'],
  'sbdy demo list delete route'
);
mustInclude(
  'frontend/public/js/admin/modules/sbdy-demo.js',
  ['sbdy-demo-del', 'api/admin/sbdy-demo/delete', '确认删除'],
  'sbdy demo list delete UI'
);
if (
  !exists('backend/assets/sbdy/bj_si_seal.png') ||
  !exists('backend/assets/sbdy/bj_mi_seal.png') ||
  !exists('frontend/public/img/sbdy_bj_si_seal.png') ||
  !exists('frontend/public/img/sbdy_bj_mi_seal.png')
) {
  fail('sbdy Beijing seal assets present', 'missing bj_*_seal.png');
} else {
  ok('sbdy Beijing seal assets present');
}


mustInclude(
  'frontend/public/js/auth.js',
  ['isVivoS50ProMiniClient', 'app-android-vivo-s50promini', '(?:vivo[\\s_-]*)?S50', 'V2527A'],
  'vivo S50 Pro mini detect + immersive'
);
mustInclude(
  'frontend/shuiming.html',
  ['V2527A', 'app-android-vivo-s50promini', '20260828-android-load', 'S50[\\s_-]*Pro[\\s_-]*[Mm]ini'],
  'shuiming S50 Pro mini first-paint'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isVivoX90Client', 'app-android-vivo-x90', 'V2241A|V2241EA|PD2241\\b', ':not(.app-android-vivo-x90)'],
  'vivo X90 detect + immersive'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['V2241A', 'app-android-vivo-x90', 'data-vivox90-result-firstpaint', '20260828-android-load'],
  'shuiming_result vivo X90 first-paint'
);
/* 公积金对账单电子章：对齐真实样张（星心压标题行、弧字 145-385°、亮红、直径≈124pt） */
mustInclude(
  'backend/scripts/gjj_make_seal.py',
  ['a_start=145.0, a_end=385.0', 'r_out=222', '(211, 56, 62, 255)'],
  'gjj seal artwork matches sample'
);
mustInclude(
  'backend/scripts/gjj_hz_render_pdf.py',
  ['fitz.Rect(376.0, 28.0, 500.0, 152.0)'],
  'gjj pdf seal on title line'
);
mustInclude(
  'backend/src/admin/gjjDemo.js',
  ['right:43mm;top:13mm;width:165px', 'gjj_hz_seal.png?v=20260825-real-seal'],
  'gjj html seal on title line'
);
/* iQOO 15（V2505A / I2501）：OriginOS 6 沉浸压栏，明细/筛选/详情页顶栏须留 40px */
mustInclude(
  'frontend/public/js/auth.js',
  ['isIqoo15Client', 'app-android-iqoo-15', 'V2505A|I2501\\b|PD2505\\b', ':not(.app-android-xiaomi-14pro):not(.app-android-iqoo-15)', 'html.app-android-client.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn'],
  'iqoo 15 detect + immersive white top'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['V2505A', 'app-android-iqoo-15', 'data-iqoo15-result-firstpaint', '20260827-cend-sync'],
  'shuiming_result iqoo 15 first-paint'
);
mustInclude(
  'frontend/shuiming.html',
  ['V2505A', 'app-android-iqoo-15'],
  'shuiming iqoo 15 first-paint'
);
mustInclude(
  'frontend/xiangqing.html',
  ['V2505A', 'app-android-iqoo-15'],
  'xiangqing iqoo 15 first-paint'
);
/* 魅族 20 Pro（M391Q / MZ-MEIZU 20 Pro）：Flyme 沉浸压栏，明细/筛选/详情页顶栏须留 40px */
mustInclude(
  'frontend/public/js/auth.js',
  ['isMeizu20ProClient', 'app-android-meizu-20pro', 'M391Q|M2392\\b', 'html.app-android-client.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn'],
  'meizu 20 pro detect + immersive white top'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['M391Q', 'app-android-meizu-20pro', 'data-meizu20pro-result-firstpaint', '20260827-cend-sync'],
  'shuiming_result meizu 20 pro first-paint'
);
mustInclude(
  'frontend/shuiming.html',
  ['M391Q', 'app-android-meizu-20pro'],
  'shuiming meizu 20 pro first-paint'
);
mustInclude(
  'frontend/xiangqing.html',
  ['M391Q', 'app-android-meizu-20pro'],
  'xiangqing meizu 20 pro first-paint'
);
/* 华为 Mate 30（TAS-AL00 / TAS-AN00）：沉浸压栏，明细标题须留 40px */
mustInclude(
  'frontend/public/js/auth.js',
  ['isHuaweiMate30Client', 'app-android-huawei-mate30', 'TAS-AL00|TAS-AN00', ':not(.app-android-huawei-mate30)'],
  'huawei mate30 detect + immersive white top'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['TAS-AL00', 'app-android-huawei-mate30', 'data-mate30-result-firstpaint', 'header-title'],
  'shuiming_result mate30 first-paint'
);
mustInclude(
  'frontend/shuiming.html',
  ['TAS-AL00', 'app-android-huawei-mate30'],
  'shuiming mate30 first-paint'
);
mustInclude(
  'frontend/xiangqing.html',
  ['TAS-AL00', 'app-android-huawei-mate30'],
  'xiangqing mate30 first-paint'
);
/* 一键生成前 B 站分享门槛已下线 */
mustInclude(
  'frontend/public/js/auth.js',
  ['一键生成前分享门槛已下线', 'function ensureBilibiliShareBeforeTaxGenerate()', 'function isMineShareDone()'],
  'bili gate helper still exported'
);
{
  const auth = read('frontend/public/js/auth.js');
  const gateFn = auth.match(/function ensureBilibiliShareBeforeTaxGenerate\(\)\s*\{[\s\S]*?\n  \}/);
  if (gateFn && /return true;/.test(gateFn[0]) && !/window\.confirm/.test(gateFn[0])) {
    ok('bili generate gate always pass');
  } else {
    fail('bili generate gate always pass');
  }
  const shareDone = auth.match(/function isMineShareDone\(\)\s*\{[\s\S]*?\n  \}/);
  if (shareDone && /return true;/.test(shareDone[0])) {
    ok('mine share done always true');
  } else {
    fail('mine share done always true');
  }
}
mustInclude(
  'frontend/consult.html',
  ['20260828-multi-bonus', 'consult-batch-tax.js?v=20260828-multi-bonus', '再加一笔年终奖', 'batchEmpBonusItemTpl'],
  'consult multi-bonus cache'
);
mustInclude(
  'frontend/admin_panel.html',
  ['再加一笔年终奖', 'batchEmpBonusItemTpl', 'batch-emp-bonus-item'],
  'admin multi-bonus form'
);
mustInclude(
  'frontend/public/js/consult-batch-tax.js',
  ['collectBatchEmpBonusesFromRow', 'setBatchEmpBonusesOnRow', 'function employmentBonusList', 'assignBonusRecordsToPayloads'],
  'batch tax multi-bonus helpers'
);
if (!read('frontend/consult.html').includes('为什么生成前要分享到 B 站')) {
  ok('consult FAQ without bili share gate');
} else {
  fail('consult FAQ without bili share gate');
}
if (!read('frontend/public/js/consult-batch-tax.js').includes('ensureBilibiliShareBeforeTaxGenerate')) {
  ok('batch tax without bili gate call');
} else {
  fail('batch tax without bili gate call');
}

/* 安卓点首页：主 Tab 进页不盖转圈、不等 theme；首屏下大图 lazy */
mustInclude(
  'frontend/public/js/page-loading.js',
  [
    'isPrimaryTabPage()',
    'forceHidePageLoading()',
    '底栏五页（含首页）：进页不盖转圈',
    '跳向主 Tab 也不白底遮罩',
    '跳过页也可能被 auth 预入队 show',
  ],
  'primary tab skip page-loading HUD'
);
mustInclude(
  'frontend/public/js/auth.js',
  [
    'isPrimaryTab',
    '20260824-skip-hide',
    's.async = true',
    'appendShellExtra',
    'requestIdleCallback',
    'deferShellPages',
    'skipLoadingPages',
    'install_guide.html',
  ],
  'auth inject page-loading skip primary tab show'
);
mustInclude(
  'frontend/install_guide.html',
  ['auth-boot.js?v=20260828-android-load', 'auth.js?v=20260828-android-st'],
  'install_guide auth cache for skip-hide'
);
mustInclude(
  'frontend/public/js/auth.js',
  [
    'function markViewportChromeClasses()',
    'function scheduleDeferredMobileChrome()',
    'function refreshMobilePageChrome()',
    'onDocumentReadyChrome',
    'if (document.body)',
    "androidLike && primaryTabs[currentPageName()]",
  ],
  'auth.js defer OEM chrome after first paint'
);
mustInclude(
  'frontend/public/js/auth-boot.js',
  ['function getToken()', 'function isPublicPage()', 'window.authFetch', 'markViewportChromeClasses', 'buildLoginPageUrl'],
  'auth-boot sync APIs for deferred auth.js'
);
mustInclude(
  'frontend/public/js/fast-nav.js',
  ['function isAndroidLikeWebView()', '/* 安卓 / 鸿蒙：进页不预取其它 Tab', 'pointerdown', 'touchstart'],
  'fast-nav skip android idle prefetch'
);
mustInclude(
  'frontend/public/js/theme-loader.js',
  ['function isAndroidLikeWebView()', '/* 安卓 / 鸿蒙：进页不预取底栏其它页'],
  'theme-loader skip android nav prefetch'
);
mustInclude(
  'scripts/android-load-selftest.mjs',
  ['android shouye no idle prefetch', 'android daiban guest redirects via auth-boot', 'ios still prefetches other tabs'],
  'android load runtime selftest'
);
mustInclude(
  'frontend/shouye.html',
  [
    'auth-boot.js?v=20260828-android-load',
    'auth.js?v=20260828-android-st" defer',
    'ahead.png?v=20260828-android-load',
  ],
  'shouye auth-boot + compressed ahead'
);
mustInclude(
  'frontend/mine.html',
  ['auth-boot.js?v=20260828-android-load', 'auth.js?v=20260828-android-st" defer', 'e1_01@sm.png?v=20260828-android-load'],
  'mine auth-boot + compressed e1 sm'
);
mustInclude(
  'frontend/shouye.html',
  [
    'a4.png?v=20260802-home" alt="资讯" width="1284" height="1814" loading="lazy"',
    'a5.png?v=20260802-home" alt="" width="1284" height="678" loading="lazy"',
    'a3.png?v=20260802-home" alt="重点服务推荐" width="1284" height="805" loading="lazy"',
    "localStorage.getItem('token')",
  ],
  'shouye below-fold images lazy'
);

/* 收入纳税明细「其他类型」箭头：全机型同一张图 */
mustInclude(
  'frontend/shuiming.html',
  ['/img/shuiming/type-caret.png', 'type-toggle-caret zhankai', 'scaleY(-1)'],
  'shuiming type caret img'
);
if (exists('frontend/public/img/shuiming/type-caret.png')) {
  ok('shuiming type caret asset');
} else {
  fail('shuiming type caret asset');
}

/* 小米 13 首页 a6 入口卡收小 */
mustInclude(
  'frontend/public/js/auth.js',
  ['isXiaomi13Client', '2211133[CGI]', 'app-android-xiaomi-13', 'isXiaomi13Client() ||'],
  'xiaomi 13 home card detect'
);
mustInclude(
  'frontend/shouye.html',
  ['html.app-android-xiaomi-13 .sy-apk-hitem', 'calc((100% - 16px) / 3.1)', 'max-width: 118px'],
  'xiaomi 13 home a6 card shrink'
);

(function testXiaomi13ProUa() {
  const reModel = /2210132[CGEI]/i;
  const reName = /(?:Xiaomi|Mi|小米)[\s_-]*13[\s_-]*Pro/i;
  const hit = [
    'Mozilla/5.0 (Linux; Android 15; 2210132C Build/AQ3A) AppleWebKit/537.36',
    'Mozilla/5.0 (Linux; Android 15; 2210132G) Xiaomi 13 Pro',
    'Mozilla/5.0 (Linux; Android 15) 小米 13 Pro'
  ];
  const miss = [
    'Mozilla/5.0 (Linux; Android 14; 2211133C) Xiaomi 13',
    'Mozilla/5.0 (Linux; Android 14; 22101316C) Redmi Note 12 Pro',
    'Mozilla/5.0 (Linux; Android 14; 23116PN5BC) Xiaomi 14 Pro',
    'Mozilla/5.0 (Linux; Android 14) Redmi Note 13 Pro'
  ];
  const hitOk = hit.every((ua) => reModel.test(ua) || reName.test(ua));
  const missOk = miss.every((ua) => !reModel.test(ua) && !reName.test(ua));
  if (hitOk && missOk) ok('xiaomi 13 pro UA match');
  else fail('xiaomi 13 pro UA match');
})();

mustInclude(
  'frontend/activate_success.html',
  [
    'applyActivateSuccessCopy',
    'onboarding=edit',
    'activateSuccessEntryHint',
    'cg_post_activate_pending',
    'track_activate_success_go_edit'
  ],
  'activate success edit guidance'
);
mustInclude(
  'frontend/public/js/conversion-guide.js',
  [
    'ONBOARD_EDIT',
    'goEditTaxRecords',
    'renderPostActivateMineEditBanner',
    'renderConsultPostActivateEditBanner',
    'showPostActivateEditCoachMark',
    'syncConsultEditGuideAfterRecordsLoad',
    'track_post_activate_edit_guide_show'
  ],
  'conversion guide post-activate edit funnel'
);
mustInclude(
  'frontend/purchase.html',
  ['activeUserBackHref', 'tax_done', '编辑入口：我的 → 我要咨询 → 税务记录'],
  'purchase paid toast + records back href'
);
mustInclude(
  'frontend/public/js/consult-records.js',
  ['syncConsultEditGuideAfterRecordsLoad'],
  'consult records sync edit guide after load'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['20260826-post-activate-edit'],
  'auth conversion-guide cache bust post-activate edit'
);

mustInclude(
  'backend/src/admin/uiCompatCatalog.js',
  ['MODELS', 'listCatalogModels', 'catalogStats'],
  'ui compat catalog module'
);
mustInclude(
  'backend/src/admin/deviceStats.js',
  ['buildDeviceCompatReport', 'page_compare'],
  'device stats report module'
);
mustInclude(
  'backend/src/admin/routes.js',
  ['/api/admin/analytics/devices', 'analytics-devices'],
  'devices analytics route'
);
mustInclude(
  'backend/src/admin/menuRegistry.js',
  ["page: 'analytics-devices'", '机型'],
  'analytics-devices menu'
);
mustInclude(
  'frontend/public/js/admin/modules/devices.js',
  ['btnRefreshDeviceCompat', 'device-compat-row'],
  'admin devices module'
);
mustInclude(
  'frontend/admin_panel.html',
  ['page-analytics-devices', 'deviceCompatSummary'],
  'admin devices page panel'
);
mustExclude(
  'frontend/admin_panel.html',
  ['batchIssueWrap', 'btnIssueBatch', 'batchIssueChannel', 'id="batchIssueCount"'],
  'admin codes page no batch issue UI'
);
mustExclude(
  'frontend/public/js/admin_panel.js',
  ['btnIssueBatch', 'downloadActivationCodesTxt', 'batchIssueChannel'],
  'admin_panel.js no batch issue handlers'
);
mustExclude(
  'backend/src/admin/routes.js',
  ['issue-code-batch', 'handleAdminIssueCodeBatch'],
  'admin routes no batch issue API'
);

/* ===== 2026-08-27 管理后台重构：死代码清理 + C 端/后台数据对齐 ===== */
mustExclude(
  'backend/src/legacy/monolith.js',
  [
    'handleAdminIssueCodeBatch',
    'handleAdminDeleteWeeklyCode',
    'handleAdminUserPriceOfferCatalog',
    'activationBatchNoteFromChannel',
    'saveActivationBatchCustomChannels',
    'computeTaxRecordsAvgSalary6m',
    'bulkMsgAudienceLabel',
    'appendConversionAnalyticsAdminScope',
    'appendNonRefundedUserFilter',
    'chineseTitleFromPagePath',
    'CERT_PAGE_TITLE_ZH',
    'beijingDateKeyFromCreatedAt',
    'track_xianyu_purchase_click',
    'track_purchase_wechat_view',
    'track_online_chat_click',
    'track_qq_group_click'
  ],
  'monolith dead admin handlers/helpers/event-keys removed'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  ["'user-behavior', 'api-analytics', 'feedback', 'chat', 'share-stats'", 'listOfferableSkusLive'],
  'migrate keeps live menu keys; price offer reads catalog prices'
);
mustInclude(
  'backend/src/payments/userPriceOffers.js',
  ['loadCatalogAmounts', 'listOfferableSkusLive'],
  'user price offers aligned to admin catalog prices'
);
mustExclude(
  'backend/src/admin/routes.js',
  ['ccb-flow/template', 'user-price-offer/catalog'],
  'admin routes drop unused template/catalog endpoints'
);
mustExclude(
  'backend/src/admin/ccbFlow.js',
  ['handleAdminCcbFlowTemplate'],
  'ccb flow template handler removed'
);
/* 管理端与 C 端共享脚本 ?v= 必须一致，防止管理端跑旧缓存逻辑 */
{
  const consultHtmlSrc = read('frontend/consult.html');
  const adminLoaderSrc = read('frontend/public/js/admin/loader.js');
  ['consult-core.js', 'consult-batch-tax.js'].forEach((name) => {
    const m = consultHtmlSrc.match(new RegExp(name.replace(/\./g, '\\.') + '\\?v=([\\w-]+)'));
    if (!m) {
      fail('consult.html missing ' + name + ' ?v=');
      return;
    }
    if (adminLoaderSrc.includes(name + '?v=' + m[1])) {
      ok('admin loader ' + name + ' ?v= matches C-side (' + m[1] + ')');
    } else {
      fail('admin loader ' + name + ' ?v= mismatch', 'C-side=' + m[1]);
    }
  });
}
mustExclude(
  'frontend/purchase.html',
  ["amount: '249.00'", "amount: '999.00'", '当前最低约 ¥199'],
  'purchase page no hardcoded fallback price list'
);
mustExclude(
  'frontend/public/js/admin/modules/charts.js',
  ['destroyInstallGuideCharts', '_installGuideChartInstances'],
  'install-guide chart destroy lives in admin_panel.js only'
);
mustInclude(
  'frontend/public/js/admin_panel.js',
  ["label: '百度贴吧'"],
  'channel link label matches backend REGISTER_SOURCE_CHANNELS'
);
mustExclude(
  'frontend/css/admin_panel.css',
  ['share-funnel', 'share-daily', 'share-land-pages', 'share-today-tag', 'share-stats-error', 'is-emit', 'is-reach'],
  'admin css share-stats dead styles removed'
);
mustExclude(
  'frontend/public/js/admin_panel.js',
  ['cnDateTodayYmd'],
  'admin_panel.js dead date helper removed'
);
mustInclude(
  'frontend/admin_panel.html',
  ['已下线，仅存档'],
  'admin xianyu setting labeled as offline'
);

/* ===== 共享 C 端脚本 ?v= 全站一致性守卫（nginx /js/ 强缓存 7 天，戳不齐会新旧混跑） =====
 * mine_mate60_aug12.html 为冻结页豁免；管理页不参与。
 * 升级共享脚本时：sed 统一全部 C 端页面到同一个新戳，勿只改单页。 */
{
  const FROZEN_PAGES = new Set(['mine_mate60_aug12.html', 'admin_panel.html', 'admin_login.html']);
  const SHARED_SCRIPTS = [
    'auth',
    'auth-boot',
    'watermark',
    'theme-loader',
    'browser-install-prompt',
    'shenbao_jilu_store',
    'user-font-settings'
  ];
  const htmlPages = readdirSync(join(root, 'frontend')).filter(
    (f) => f.endsWith('.html') && !FROZEN_PAGES.has(f)
  );
  SHARED_SCRIPTS.forEach((name) => {
    const stamps = new Map();
    htmlPages.forEach((p) => {
      const src = read('frontend/' + p);
      const re = new RegExp(
        'js/' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.js\\?v=([\\w.-]+)',
        'g'
      );
      let m;
      while ((m = re.exec(src))) {
        if (!stamps.has(m[1])) stamps.set(m[1], []);
        stamps.get(m[1]).push(p);
      }
    });
    if (stamps.size <= 1) {
      ok(
        'shared ?v= uniform: ' +
          name +
          '.js' +
          (stamps.size ? ' (' + [...stamps.keys()][0] + ')' : ' (unused)')
      );
    } else {
      fail(
        'shared ?v= drift: ' + name + '.js',
        [...stamps.entries()]
          .map(([s, ps]) => s + '×' + ps.length + '页(如 ' + ps[0] + ')')
          .join(' | ')
      );
    }
  });
}

console.log(`[today-selftest] done passed=${passed} failed=${failed}`);
process.exit(failed ? 1 : 0);
