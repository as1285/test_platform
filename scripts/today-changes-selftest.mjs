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
  'frontend/mine.html',
  ['mine_mate60_aug12.html', '20260824-aug12r6', 'app-android-huawei-mate60'],
  'mine.html Mate60 jumps to frozen aug12 page'
);
mustInclude(
  'frontend/mine_mate60_aug12.html',
  ['冻结 2026-08-12', 'auth-mate60-aug12.js?v=20260903-mate60pay', 'nav-mate60-aug12.css?v=20260824-aug12r6', 'theme-loader-mate60-aug12.js', 'UI:aug12-r6', 'mineE1Canvas', "location.replace('mine.html'", 'pinAug12Rpx'],
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
  ['mine.html?in_app=1&_v=20260903-mine1'],
  'cordova shell starts on mine.html'
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
mustInclude('frontend/consult.html', ['consult-records.js?v=20260905-list-tap'], 'consult recycle-bind cache');
mustInclude(
  'frontend/public/js/consult-records.js',
  [
    'toggleTaxRecordsManageMode',
    'data-record-id',
    'record-card-delete',
    'is-tappable'
  ],
  'tax records list tap-to-edit + manage-mode delete'
);
mustExclude(
  'frontend/public/js/consult-records.js',
  ['onclick="editRecord(', 'onclick="deleteRecord('],
  'tax records list no longer uses per-row edit/delete onclick'
);
mustInclude(
  'frontend/consult.html',
  ['id="taxRecordsManageHint"', 'consult.css?v=20260906-tax-ocr'],
  'tax records manage hint + css cache'
);
mustInclude('backend/src/user/lizhiCertUser.js', ['preview_png_base64'], 'lizhi user api png');
mustInclude(
  'backend/scripts/lizhi_render_pdf.py',
  ['.preview.png', 'from company_seal import', 'place_seal', 'SEAL_PT', 'SEAL_RED'],
  'lizhi render png uses shared company_seal'
);
mustInclude(
  'backend/scripts/company_seal.py',
  ['SEAL_RED = (210, 36, 40, 255)', 'SEAL_STAMP_ALPHA = 0.90', 'drawstamputils', '_apply_rough_edge', '单圈朱红', '_draw_single_ring'],
  'company_seal DrawStampUtils-style single-ring official seal'
);
mustExclude(
  'backend/scripts/lizhi_render_pdf.py',
  ['stroke_width=stroke'],
  'lizhi seal uses thin unstroked type'
);
mustInclude(
  'backend/scripts/zaizhi_render_pdf.py',
  ['place_seal', 'SEAL_PT'],
  'zaizhi uses shared vermilion seal'
);
mustInclude('frontend/lizhi_cert.html', ['employment-cert-page.js', 'btnLizhiQuick', '一键生成最后一家公司', "apiPrefix: '/api/lizhi-cert'", '20260902-lizhi-fee'], 'lizhi cert shared page + quick generate');
mustInclude(
  'frontend/public/js/employment-cert-page.js',
  ['androidSaveLocal', 'TaxNativeSave', 'forceDownloadUrl', '保存到手机'],
  'android cert save to local'
);
mustInclude(
  'backend/src/user/lizhiCertUser.js',
  ["req.query.dl", 'application/octet-stream'],
  'lizhi temp-share force download'
);
mustInclude(
  'backend/src/user/lizhiCertUser.js',
  ['pickLastCompany', 'last_company', 'ORDER BY year DESC, month DESC'],
  'lizhi prefill last company from tax + employers'
);
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
  'frontend/public/js/najilu.js',
  [
    "zl901010: '国家税务总局辽宁省税务局'",
    'USER_CERT_STAMP_AUTHORITY',
    'USER_CERT_STAMP_IMAGE',
    'USER_CERT_BLANK_REMARK',
    'najilu_ln_seal.png',
    'resolveStampAuthority',
    'resolveStampImageUrl'
  ],
  'zl901010 najilu uses Liaoning provincial seal photo'
);
mustInclude(
  'frontend/najilu.html',
  ['najilu.js?v=20260903-qr-wm'],
  'najilu qr watermark cache'
);
mustInclude(
  'frontend/public/js/admin/loader.js',
  ['najilu.js?v=20260903-qr-wm'],
  'admin najilu qr watermark cache'
);
if (exists('frontend/public/img/najilu_ln_seal.png')) ok('liaoning najilu seal image exists');
else fail('liaoning najilu seal image exists', 'missing frontend/public/img/najilu_ln_seal.png');
mustInclude(
  'frontend/zaizhi_cert.html',
  ["apiPrefix: '/api/zaizhi-cert'", 'lzGender', '工作证明.pdf', 'employment-cert-page.js'],
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
  ["'zaizhi-cert': 'lizhi-cert'", 'adminPagePanelId', "pageKey === 'zaizhi-cert'", 'callAdminModuleLoadPage'],
  'admin zaizhi-cert hash not bounced'
);
mustInclude(
  'frontend/public/js/admin_panel.js',
  ["'downline-admins'", 'canOpenAdminAccountsPage', 'syncAdminAccountsPageCopy', '新增下线'],
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
    "page: 'rename-tax-daily'",
    "menu_key: 'rename-tax-daily'",
    "label: '同行 · 高频改名'",
    "alias_menus: ['peer-accounts']",
    "'peer-accounts': 'rename-tax-daily'",
    "page: 'users-deleted'",
    "menu_key: 'users-deleted'",
    "page: 'user-login-log'",
    "menu_key: 'user-login-log'",
    'group_label'
  ],
  'menuRegistry assignable sidebar child pages'
);
mustExclude(
  'backend/src/admin/menuRegistry.js',
  ["page: 'peer-accounts'", "menu_key: 'peer-accounts'"],
  'menuRegistry peer-accounts removed as standalone page'
);
mustInclude(
  'backend/src/admin/routes.js',
  [
    "requireAdminMenu('users-deleted')",
    "requireAdminAnyMenu(['rename-tax-daily', 'peer-accounts'])",
    "requireAdminMenu('user-login-log')",
    "['peer-accounts', 'rename-tax-daily']"
  ],
  'admin routes gate new sidebar menu keys'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  [
    "SELECT DISTINCT admin_id, 'rename-tax-daily' FROM admin_account_menus WHERE menu_key IN ('users', 'peer-accounts')",
    "SELECT DISTINCT admin_id, 'users-deleted'",
    "SELECT DISTINCT admin_id, 'user-login-log'"
  ],
  'bootstrap migrate sidebar child menu keys'
);
mustInclude(
  'frontend/public/js/admin_panel.js',
  ['adminMenuSelectorHtml', 'admin-menu-selector-group-title', 'setRenamePeerTab', 'rename-peer-tab'],
  'admin accounts menu selector grouped by sidebar'
);
mustInclude(
  'frontend/admin_panel.html',
  ['page-rename-tax-daily', 'renamePeerTabDaily', 'renamePeerTabPeer', '同行 · 高频改名'],
  'admin merged rename/peer page tabs'
);
mustExclude(
  'frontend/admin_panel.html',
  ['id="page-peer-accounts"'],
  'admin standalone peer-accounts page removed'
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
  ['admin_panel.js?v=20260903-chart-opt', 'min="0" max="99999.99"', '填 <strong>0</strong> 则超限后也不收费'],
  'admin rename fee allows 0 and cache-busts'
);
mustInclude(
  'frontend/admin_panel.html',
  ['filterD1Return', '注册次日回访', 'ops-board'],
  'admin D1 return cohort UI'
);
mustInclude(
  'frontend/public/js/admin_panel.js',
  ['filterD1Return', 'd1_return=', 'applyD1BulkDefaultCopy'],
  'admin D1 return cohort JS'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  ['handleAdminD1ReturnCohort', 'inactive_d1_only', 'appendD1ReturnActivityFilters'],
  'backend D1 return cohort'
);
mustInclude(
  'backend/src/admin/routes.js',
  ['/api/admin/analytics/d1-return-cohort', 'handleAdminD1ReturnCohort'],
  'D1 return cohort route'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['function isRedmiK80ProClient', 'app-android-redmi-k80pro', '24122RKC7'],
  'Redmi K80 Pro inset detector'
);
mustInclude(
  'frontend/shuiming.html',
  ['app-android-redmi-k80pro', '24122RKC7'],
  'shuiming first-paints K80 Pro'
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
  'backend/src/legacy/pricingAb.js',
  [
    "sku_300_7d: '200.00'",
    "sku_348_14d: '300.00'",
    "sku_398_30d: '398.00'",
    'applyGithubChannelCatalogPrices'
  ],
  'GitHub channel week/biweek/month 200/300/398'
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
if (exists('frontend/public/img/refund-ad.jpg')) ok('refund ad poster image');
else fail('refund ad poster image', 'missing frontend/public/img/refund-ad.jpg');
mustInclude(
  'frontend/refund_ad.html',
  [
    'refundAd',
    'Tangdong6832',
    '/img/refund-ad.jpg',
    '哪些人可以做二次退税',
    'btnCopyRefundWechat',
    'track_refund_ad_view',
    'track_refund_ad_copy',
    'track_refund_ad_page_leave',
    'dwell_seconds',
    'bottom-nav',
    'page-refund-ad',
    '返回咨询',
    'consult.html'
  ],
  'refund ad page with back to consult'
);
mustInclude(
  'frontend/purchase.html',
  [
    'id="purchaseRefundAd"',
    '/img/refund-ad.jpg',
    'Tangdong6832',
    'btnCopyRefundWechat',
    'track_purchase_refund_ad_view',
    'track_purchase_refund_ad_copy'
  ],
  'purchase page embeds full refund ad'
);
mustExclude(
  'frontend/purchase.html',
  ['purchaseRefundAdEntry', 'refund_ad.html?from=purchase', '点图咨询微信'],
  'purchase refund ad no longer jumps away'
);
mustExclude(
  'frontend/shouye.html',
  ['nav-text">退税', 'data-icon="ts"'],
  'home dock has no refund tab'
);
mustInclude(
  'frontend/consult.html',
  [
    'id="consultRefundAdEntry"',
    'refund_ad.html?from=consult',
    '二次退税咨询',
    'id="consultRefundAdProductEntry"'
  ],
  'consult page has refund ad entry'
);
mustInclude(
  'frontend/public/js/app/nav.js',
  ["'refund_ad.html': 'mine'", 'page-refund-ad'],
  'refund ad page highlights mine tab'
);
mustExclude(
  'frontend/refund_ad.html',
  ['nav-text">退税', '随时可从底栏'],
  'refund ad page no longer a dock tab'
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
  ['collectSkuCatalogFromForm', 'btnSaveSkuCatalogPrices', 'sku_catalog_prices'],
  'admin panel save sku catalog prices'
);

const purchase = read('frontend/purchase.html');
if (purchase.includes('track_purchase_page_leave') && !/满\s*2\s*次/.test(purchase)) ok('bilibili share 1x copy');
else fail('bilibili share 1x copy');

mustInclude('frontend/index.html', ["var target = 'shouye.html'", 'url=shouye.html'], 'app launch -> home');
mustInclude('frontend/nginx.conf', ['return 302 /shouye.html'], 'nginx / -> home');
mustInclude('frontend/login.html', ["window.location.href = 'shouye.html'"], 'login land home');
mustInclude(
  'frontend/login.html',
  ['href="face_login.html"', 'face_login_draft_v1', 'applyFaceLoginReturn'],
  'login 扫脸登录 opens face_login.html'
);
mustInclude(
  'frontend/login.html',
  ["showLoginFormTip('')"],
  'login face return clears tip (no orange face demo copy)'
);
mustExclude(
  'frontend/face_login.html',
  ['face_msg', '扫脸演示已完成，请使用账号密码登录', '扫脸验证已通过，请输入密码完成登录'],
  'face_login no longer passes orange tip face_msg'
);
mustInclude(
  'frontend/face_login.html',
  [
    '安全验证',
    '请按住滑块，拖动到最右边',
    '验证通过!',
    'startFaceScan',
    'finishFaceLogin',
    'forceHidePageLoading',
    '20260905-facelogin-ui3'
  ],
  'face login slider then demo scan, no stuck loader'
);
mustInclude(
  'frontend/public/js/page-loading.js',
  ["'face_login.html': true"],
  'page-loading skips face_login HUD'
);
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
  ['data-mine-e1-selfheal', '@sm.png', '__mineE1ForceSm', '?v=20260827-e1r3', 'data-xiaomi14pro-mine-e1-paint', 'e1_01@sm.png'],
  'mine.html e1 self-heal + 14 Pro CSS paint'
);
mustInclude(
  'frontend/nginx.conf',
  ['location = /mine_v2.html', 'return 301 /mine.html'],
  'nginx redirects retired mine_v2 to mine.html'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isVivoS50ProMiniClient', 'app-android-vivo-s50promini', 'S50 Pro mini', 'isHuaweiNova13Client', 'BLK-AL80', 'MIS-AL00', 'HUAWEIBLK', 'app-android-huawei-nova13', 'isHuaweiNova13Client()', 'isHuaweiWhitePageImmersiveClient', 'pinWhitePageImmersiveHeader', 'pinNova13MineE1Layout', 'HMSCore|Huawei|HUAWEI', ':not(.app-android-huawei-nova13):not(.app-android-immersive-white-top) body.page-shuiming > .header', 'resetMate60MineE1RpxToViewport', 'pinMineE1RpxFromCanvas', 'setProperty(\'--mine-rpx\', rpx, imp)'],
  'huawei nova 13 mine overlay + white-top detect'
);
mustInclude(
  'frontend/public/js/fast-nav.js',
  ['20260903-mate60pay'],
  'fast-nav auth cache mate60 plan B'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isHonorPgtAn20Client', 'PGT-AN20', 'HONORPGT-AN20', 'isHonorMagic5ProScreen', 'pinHonorMagic5ProHomeCards', '--shouye-status-inset:8px', 'isHonorMagic6ProClient', 'BVL-AN16', 'app-android-honor-magic6pro'],
  'honor magic5 pro + magic6 pro home card detect'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['--mine-top-bleed:0px !important', 'pinMate60MineShift', 'data-mate60-aug15-lock', 'pinMate60MineE1Layout', 'app-huawei-mine-noclip', 'isHuaweiP40ProClient', 'app-android-huawei-p40pro', 'ELS-AN00', 'isLikelyAndroidViewportClient', 'OpenHarmony', 'isIqooNeo8ProClient', 'isIqooNeo8Client', 'V2302A', 'V2301A', 'clientUaBlob', 'OriginOS/iQOO 会变成黑条白字', "shell_bg: '#ffffff'", 'tax_device_model_v1', 'applyMinePageChrome'],
  'auth.js mate60 e1-v12 + neo8 / neo8pro + white-bar dark icons'
);
mustExclude(
  'frontend/public/js/auth.js',
  ['pinMate60Jul23CardMineChrome', "classList.add('app-mate60-jul23-ui')"],
  'auth.js without jul23 card chrome'
);
mustInclude(
  'frontend/shuiming.html',
  ['V2302A', 'V2301A', 'app-android-iqoo-neo8pro', 'app-android-iqoo-neo8', 'PGP110', 'app-android-oneplus-acepro', 'PHW110', 'app-android-oppo-reno10', 'BLK-AL80', 'app-android-huawei-nova13', 'tax_device_model_v1', 'data-nova13-sm-firstpaint', 'padding-top:54px', '2211133', 'app-android-xiaomi-13'],
  'shuiming acepro + reno10 + neo8 + nova13 inset'
);
mustInclude(
  'frontend/message.html',
  ['V2302A', 'V2301A', 'app-android-iqoo-neo8pro', 'app-android-iqoo-neo8'],
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
  ['isOnePlusAce6Client', 'PLQ110', 'app-android-oneplus-ace6'],
  'oneplus ace 6 immersive top'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isOnePlus12Client', 'PJD110', 'app-android-oneplus-12'],
  'oneplus 12 immersive top'
);
mustInclude(
  'frontend/public/js/auth.js',
  [
    'function isAndroidWhitePageImmersiveDefaultClient()',
    'function isAndroidVerifiedOuterWhitePageClient()',
    'isAndroidWhitePageImmersiveDefaultClient()',
    ':not(.app-android-oppo-k9x):not(.app-android-immersive-white-top) body.page-shuiming-result'
  ],
  'android white-page default immersive inset'
);
mustInclude(
  'frontend/public/js/auth-boot.js',
  [
    'function applyAndroidWhitePageInsetFirstPaint()',
    "setProperty('--app-shell-statusbar-top', '40px')",
    'app-android-immersive-white-top'
  ],
  'android white-page inset first-paint'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['PLQ110', 'app-android-oneplus-ace6', 'data-oneplus-ace6-result-firstpaint'],
  'shuiming_result ace 6 first-paint'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['PJD110', 'app-android-oneplus-12', 'data-oneplus-12-result-firstpaint'],
  'shuiming_result oneplus 12 first-paint'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isOppoReno10Client', 'PHW110', 'CPH2531', 'app-android-oppo-reno10'],
  'oppo reno10 5g immersive top'
);
mustInclude(
  'frontend/shouye.html',
  ['app-android-oneplus-ace2v', 'app-android-oppo-reno10', 'ALN-AL10', 'PGT-AN20', 'app-android-honor-pgt-an20', 'BVL-AN16', 'app-android-honor-magic6pro', 'min(104px', '1312', '--shouye-status-inset: 8px', 'app-android-xiaomi-13', '2211133'],
  'shouye ace 2v + reno10 + magic5pro cards'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['PJA110', 'app-android-oneplus-ace2pro', '20260827-cend-sync', 'PGP110', 'app-android-oneplus-acepro', 'app-android-xiaomi-14pro', '23116PN5', 'V2302A', 'V2301A', 'PHW110', 'app-android-oppo-reno10', '24129PN74', 'app-android-xiaomi-15', 'data-xiaomi15-result-firstpaint', 'app-android-iqoo-neo8', 'color: #000', 'BLK-AL80', 'app-android-huawei-nova13', '2211133', 'app-android-xiaomi-13'],
  'shuiming_result ace 2 pro + ace pro + reno10 + mi14pro + neo8 + mi15 line + nova13'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isXiaomi15Client', '24129PN74', 'app-android-xiaomi-15', 'isXiaomi15Client()', 'html.app-android-xiaomi-15.app-top-safe-shell{--app-shell-statusbar-top:40px'],
  'xiaomi 15 immersive top + list line-height detect'
);
mustInclude(
  'frontend/shuiming.html',
  ['24129PN74', 'app-android-xiaomi-15', 'html.app-android-xiaomi-15 body.page-shuiming > .header'],
  'shuiming xiaomi 15 header inset'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['function clientUaBlob', '23116PN5', 'html.app-android-client.app-top-safe-shell.app-android-xiaomi-14pro body.page-shuiming-result .top-fixed .header .back-btn', 'function paintXiaomi14ProMineE1', 'xiaomi14pro-mine-e1-paint'],
  'auth.js mi14pro inset + back-btn + e1 paint'
);
mustInclude(
  'frontend/public/js/auth.js',
  [
    'function isXiaomi14LikeClient()',
    '23127PN0CC|23127PN0CG|23127PN\\b',
    'html.app-android-xiaomi-14.app-top-safe-shell{--app-shell-statusbar-top:48px',
    'html.app-android-xiaomi-14.app-top-safe-shell::before',
    'background:#000',
    'xiaomi14PaintedBar',
    '--safe-top:var(--app-shell-statusbar-top,48px)',
    "overlays: false",
    "color: '#000000'",
    'app-android-xiaomi-14',
  ],
  'xiaomi 14 painted black status bar'
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
  [
    'isIPhone13Client',
    'iPhone14,5',
    'app-ios-iphone13',
    'window.isIPhone13Client',
    'iPhone14,[2-5]'
  ],
  'iphone 13 company ellipsis detect'
);
mustInclude(
  'frontend/shuiming_result.html',
  [
    'isIosCompanyNameEllipsisClient',
    'list-company-name',
    'max-width: 13em',
    'iosCompanyEllipsis',
    'truncateChars(company, iosCompanyEllipsis ? 13 : 12)',
    'maybeRerenderCompanyEllipsis',
    'text-overflow: clip',
    '#recordList .list-label',
    '--ufs-list-body-color, #666'
  ],
  'shuiming_result ios company 13em ellipsis'
);
mustExclude(
  'frontend/shuiming_result.html',
  ['isIPhone13FullCompanyClient', 'fullCompany ? company'],
  'iphone13 no longer shows full company name'
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
  ['id="cardShebaoPhoto" hidden'],
  'consult shebao upload entry hidden'
);
mustInclude(
  'frontend/purchase.html',
  ['id="cardShebaoPhoto" hidden'],
  'purchase shebao upload entry hidden'
);
mustInclude('frontend/public/js/consult-core.js', ["titleEl.textContent = '激活页面'"], 'consult title 激活页面');
mustInclude(
  'frontend/public/js/consult-core.js',
  ['/api/public/lizhi-cert-fee', 'applyConsultLizhiCertFeeCopy'],
  'consult 增值服务证明价格读后台公开标价'
);
mustInclude(
  'backend/src/user/routes.js',
  ["app.get('/api/public/lizhi-cert-fee'"],
  'public lizhi-cert-fee route'
);
mustInclude(
  'backend/src/user/lizhiCertUser.js',
  ['handlePublicLizhiCertFee', 'loadLizhiCertFeeConfig'],
  'public lizhi-cert-fee handler'
);
if (!read('frontend/consult.html').includes('>附加产品<')) ok('consult tab no 附加产品');
else fail('consult tab no 附加产品');
mustInclude(
  'frontend/public/js/consult-batch-tax.js',
  [
    'copyTaxPasteImportTemplate',
    'TAX_PASTE_IMPORT_TEMPLATE',
    'TAX_PASTE_IMPORT_PLACEHOLDER',
    '23年4月到26年8月',
    'taxPasteImportCopyTplBtn',
    'fillTaxPasteTemplateIntoBox',
    'scheduleTaxPasteLivePreview',
    '公司名称：某某有限公司',
    '2023年全年',
    '2025年全年',
    '主管税务机关：国家税务总局北京市朝阳区税务局',
    '基本养老保险：1600元',
    '住房公积金：2400元'
  ],
  'tax paste copy template'
);
mustInclude(
  'frontend/public/js/consult-core.js',
  [
    'applyTaxPasteSummaryFieldDefaults',
    'inferTaxAuthorityFromCompanyName',
    'expandTaxPasteYear',
    'parseTaxPasteNaturalYmRange'
  ],
  '20260905 template summary fills tax office and social security'
);
mustInclude(
  'frontend/consult.html',
  ['consult-core.js?v=20260906-tax-ocr', 'consult-batch-tax.js?v=20260906-ocr-fd', '23年4月到26年8月', '上传个税截图识别', 'taxScreenshotOcrInput'],
  '20260906 consult tax screenshot OCR'
);
mustInclude('frontend/consult.html', ['taxPasteImportCopyTplBtn', '重新填入模板', '按模板生成个税', '清空去粘贴', '上传截图识别'], 'consult copy tpl btn');
mustInclude('frontend/admin_panel.html', ['taxPasteImportCopyTplBtn', '重新填入模板', '上传截图识别'], 'admin copy tpl btn');
mustInclude(
  'backend/src/tax/screenshotOcr.js',
  ['normalizeOcrTaxText', 'handleTaxScreenshotOcr', 'chi_sim+eng'],
  'tax screenshot OCR module'
);
mustInclude(
  'backend/src/tax/routes.js',
  ['/api/tax/screenshot-ocr', 'taxScreenshotUpload'],
  'tax screenshot OCR route'
);
mustInclude(
  'frontend/public/js/consult-batch-tax.js',
  [
    "fetch('/api/tax/screenshot-ocr'",
    '勿用 authFetch',
    '截图上传失败，请重新选择图片后重试'
  ],
  'tax screenshot OCR uses raw multipart fetch'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['function isFormDataBody', 'function mergeAuthRequestHeaders', "delete headers['Content-Type']"],
  'authFetch strips JSON content-type for FormData'
);
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
  [
    'purchaseAnalyticsAdminActivationCreditRules',
    "'18933137956', unit_amount: 100",
    "'19106014552', unit_amount: 60",
    "COALESCE(NULLIF(TRIM(u.activation_source_channel), ''), '__none__') <> ?",
    'label_note: \'非支付宝\'',
    'exclude_alipay: true',
    'queryPurchaseAnalyticsAdminActivationCredits',
    'admin_activation_gmv',
    'combined_gmv'
  ],
  'purchase analytics admin activation credit'
);
mustInclude(
  'frontend/public/js/admin_panel.js',
  [
    '管理员激活（',
    'combined_gmv',
    'admin_activation_orders',
    '合计（含管理员激活）'
  ],
  'purchase analytics admin activation ui'
);
mustInclude(
  'frontend/admin_panel.html',
  ['18933137956', '19106014552', 'admin', '除支付宝激活外', '管理员激活'],
  'purchase analytics admin activation hint'
);
mustInclude(
  'backend/src/admin/fullUserScope.js',
  [
    'ADMIN_FULL_USER_SCOPE_USERNAMES',
    "'19106014552': true",
    "'13691947741': true",
    "'18671741907': true",
    'function adminHasFullUserScope',
    'function fullUserScopeUsernameSqlIn'
  ],
  'admin full user scope allowlist'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  [
    "require('../admin/fullUserScope')",
    'if (!admin || adminHasFullUserScope(admin)) return true',
    'fullUserScopeUsernameSqlIn()'
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
  ['20260831-xiamen'],
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
  ['sbdyRegionBj', '20260831-xiamen'],
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
  'backend/scripts/make_xm_seal.py',
  ['厦门市社会保险中心', '业务专用章', 'erase_all_text', 'draw_arc_text', 'xm_seal_base.png'],
  'sbdy Xiamen city-level seal (pristine base + retype)'
);
mustInclude(
  'backend/scripts/sbdy_xm_render_pdf.py',
  [
    '基本养老个人历年缴费明细表',
    '参保地经办机构',
    'xm_seal.png',
    'FIRST_ROWS = 29',
    '全国社保卡服务平台'
  ],
  'sbdy Xiamen PDF renderer'
);
mustInclude(
  'backend/src/admin/sbdyDemo.js',
  ['SBDY_XM_RENDER_SCRIPT', 'normalizeXmPayload', 'isXmRegion', 'renderXmCertHtml', 'xm_official_v1'],
  'sbdy Xiamen backend routing'
);
mustInclude(
  'frontend/public/js/admin/modules/sbdy-demo.js',
  ['sbdyRegionXm', '湖里区', '厦门示例', '张知宇', '1800'],
  'sbdy Xiamen admin UI'
);
mustInclude(
  'frontend/admin_panel.html',
  ['sbdyRegionXm', '厦门基本养老个人历年缴费明细表'],
  'sbdy Xiamen admin panel radio'
);
mustInclude(
  'frontend/sbdy_demo.html',
  ['sbdyRegionXm', '20260831-xiamen'],
  'sbdy Xiamen C-end radio + cache'
);
if (!exists('backend/assets/sbdy/xm_seal.png') || !exists('frontend/public/img/sbdy_xm_seal.png')) {
  fail('sbdy Xiamen seal assets present', 'missing xm_seal.png');
} else {
  ok('sbdy Xiamen seal assets present');
}


mustInclude(
  'frontend/public/js/auth.js',
  ['isVivoS50ProMiniClient', 'app-android-vivo-s50promini', '(?:vivo[\\s_-]*)?S50', 'V2527A'],
  'vivo S50 Pro mini detect + immersive'
);
mustInclude(
  'frontend/public/js/auth.js',
  [
    'isVivoX200ProLikeClient',
    'app-android-vivo-x200pro',
    'V2419A',
    'X200[\\s_-]*Pro',
    ':not(.app-android-vivo-x200pro)'
  ],
  'vivo X200 Pro / mini detect + immersive'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['V2419A', 'app-android-vivo-x200pro', 'data-vivox200pro-result-firstpaint'],
  'shuiming_result vivo X200 Pro mini first-paint'
);
mustInclude(
  'frontend/shuiming.html',
  ['V2527A', 'app-android-vivo-s50promini', 'S50[\\s_-]*Pro[\\s_-]*[Mm]ini'],
  'shuiming S50 Pro mini first-paint'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['isVivoX90Client', 'app-android-vivo-x90', 'V2241A|V2241EA|PD2241\\b', ':not(.app-android-vivo-x90)'],
  'vivo X90 detect + immersive'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['V2241A', 'app-android-vivo-x90', 'data-vivox90-result-firstpaint'],
  'shuiming_result vivo X90 first-paint'
);
/* vivo X90「我的」：底图单层绘制，杜绝背景副本 + 隐藏 <img> 双层留下的半透明白卡残影 */
mustInclude(
  'frontend/mine.html',
  [
    'app-android-mine-e1-plainimg',
    'window.__mineE1PlainImg = true;',
    'html.app-android-mine-e1-sm:not(.app-android-mine-e1-plainimg)',
    'aspect-ratio: 1284 / 2127 !important;',
    'padding-bottom: calc(2127 / 1284 * 100%) !important;',
    'if (sm && !window.__mineE1PlainImg)'
  ],
  'mine vivo X90 single-layer e1 paint'
);
/* auth-boot 必须自己判 X90：判点在 sm class / 首屏 style 注入之前，别只靠 mine.html 立旗 */
mustInclude(
  'frontend/public/js/auth-boot.js',
  [
    'window.__mineE1PlainImg ||',
    "cl.contains('app-android-mine-e1-plainimg')",
    'V2241A|V2241EA|PD2241\\b|(?:vivo[\\s_-]*)?X90\\b(?![\\s_-]*(?:Pro|[sS]|Plus|\\+))',
    "cl.add('app-android-mine-e1-plainimg')",
    "cl.remove('app-android-mine-e1-sm')"
  ],
  'auth-boot detects vivo X90 before injecting the @sm first paint'
);
(function testAuthBootPlainImgBeforeSmFirstPaint() {
  const src = read('frontend/public/js/auth-boot.js');
  const uaIdx = src.indexOf('V2241A|V2241EA|PD2241');
  const clsIdx = src.indexOf("document.documentElement.classList.add('app-android-mine-e1-sm')");
  const styleIdx = src.indexOf("st.id = 'androidMineSmFirstPaint'");
  if (uaIdx > 0 && clsIdx > uaIdx && styleIdx > uaIdx) ok('auth-boot X90 check precedes @sm first paint');
  else fail('auth-boot X90 check precedes @sm first paint', `ua=${uaIdx} cls=${clsIdx} style=${styleIdx}`);
})();
mustInclude(
  'frontend/public/js/auth.js',
  [
    'function isMineE1PlainImgClient()',
    'function mineE1PlainImgLockCss()',
    'function pinMineE1PlainImgLayout()',
    'function dropStaleMineE1SmStyles()',
    'function dropDuplicateMineE1PaintLayers(canvas)',
    'style[data-android-mine-e1-sm-firstpaint]',
    'data-mine-e1-plainimg-lock',
    'data-vivox90-mine-e1-paint',
    'html.app-android-mine-e1-sm:not(.app-android-mine-e1-plainimg)',
    ':not(.app-android-mine-e1-sm):not(.app-android-mine-e1-plainimg) body.page-mine .mine-e1-canvas'
  ],
  'auth.js single-layer e1 lock excludes @sm crop and generic bleed'
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
  ['isIqoo15Client', 'app-android-iqoo-15', 'V2505A|I2501\\b|PD2505\\b', ':not(.app-android-iqoo-13):not(.app-android-iqoo-15)', 'html.app-android-client.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn'],
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
  ['再加一笔年终奖', 'batchEmpBonusItemTpl', 'consult-batch-tax.js?v=20260906-ocr-fd'],
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
    'page-face-login',
    's.async = true',
    'appendShellExtra',
    'requestIdleCallback',
    'deferShellPages',
    'skipLoadingPages',
    'install_guide.html',
    'face_login.html',
  ],
  'auth inject page-loading skip primary tab show'
);
mustInclude(
  'frontend/install_guide.html',
  ['auth-boot.js?v=20260902-adopt', 'auth.js?v=20260902-adopt'],
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
    'auth-boot.js?v=20260902-adopt',
    'auth.js?v=20260903-email-reg1" defer',
    'ahead.png?v=20260828-android-load',
    '--shouye-status-inset: 12px',
    'html.app-android-huawei-mate60.app-top-safe-shell body.page-shouye .sy-apk-ahead',
    'margin-top: -8px !important',
  ],
  'shouye auth-boot + mate60 tighter home inset'
);
mustInclude(
  'frontend/mine.html',
  ['auth-boot.js?v=20260905-vivox90-mine', 'auth.js?v=20260905-vivox90-mine" defer', 'e1_01@sm.png?v=20260901-android-mine-sm'],
  'mine auth-boot + compressed e1 sm'
);
mustInclude(
  'frontend/shouye.html',
  [
    'a4.png?v=20260901-home-compress" alt="资讯" width="1284" height="1814" loading="lazy"',
    'a5.png?v=20260901-home-compress" alt="" width="1284" height="678" loading="lazy"',
    'a3.png?v=20260901-home-compress" alt="重点服务推荐" width="1284" height="805" loading="lazy"',
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
mustInclude(
  'frontend/shouye.html',
  ['calc((100% - 16px) / 3.2)', 'calc((100% - 16px) / 3.15)'],
  'home a6 row compact vs official'
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
  [
    'html.app-android-xiaomi-15 body.page-shuiming-result .top-fixed .header .back-btn',
    'html.app-android-huawei-mate60.app-top-safe-shell body.page-shouye',
    '--shouye-status-inset:12px !important',
    '.sy-apk-ahead{margin-top:-8px !important;}',
  ],
  'auth xiaomi 15 result header + mate60 home tighter inset'
);
mustInclude(
  'frontend/personal_info.html',
  ['page-personal-info', 'position:relative !important;top:0 !important;', 'padding-top:66px'],
  'mate60 personal_info header uses relative pad not sticky top'
);
mustInclude(
  'frontend/public/js/auth.js',
  ["Math.max(vw - br.width, vw - hrW) > 24", "data-ark-fix-l"],
  'mate60 ark pins narrowed html/body back to viewport width'
);
mustInclude(
  'frontend/public/js/app/core.js',
  ["Math.max(vw - br.width, vw - hrW) > 24", "data-ark-fix-l"],
  'core ark width pin mirrors auth version'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['function pinArkPlainHeader', "querySelector('body > .header')", 'padding-top', '66px'],
  'mate60 ark pins plain header without sticky top'
);
mustInclude(
  'frontend/public/js/conversion-guide.js',
  ['我的页不再展示顶部个税强引导'],
  'mine page without top tax fill banner'
);
mustInclude(
  'frontend/public/js/conversion-guide.js',
  [
    'REFUND_AD_AFTER_TAX_KEY',
    'REFUND_AD_TAX_YEARS',
    'REFUND_AD_MIN_TAX_REPORTED',
    'REFUND_AD_MIN_YEAR_INCOME',
    'qualifiesForRefundAdAfterTax',
    'refundAdYearHits',
    'yearIncomeSumForYear',
    'syncRefundAdRecommendCards',
    'taxReportedSumForYear',
    'maybeGoRefundAdAfterTax',
    'refund_ad.html?from=tax_done',
    'reason=',
    'track_refund_ad_after_tax_go',
    'track_refund_ad_after_tax_show',
    "opts.source === 'single_save'",
    'showSpecialDeductionRefundDialog',
    'specialDeductionRefundEstimate',
    'REFUND_CHILD_MONTH',
    'REFUND_PARENT_MONTH',
    'cg-refund-force-overlay',
    'REFUND_AD_ESTIMATE_KEY'
  ],
  'after tax fill go to refund ad when 2023-2025 tax over 5000 or income 150000'
);
mustInclude(
  'frontend/consult.html',
  ['consultRefundAdEntry" hidden', 'consultRefundAdHint'],
  'consult refund card hidden until qualified'
);
mustInclude(
  'frontend/public/js/consult-records.js',
  ['syncRefundAdRecommendCards'],
  'consult records sync refund qualified card'
);
mustInclude(
  'frontend/public/js/conversion-guide.js',
  [
    'isInactiveRefundCardUser',
    'var show = showInactive || showActiveBrowse',
    'var showInactive = inactive',
    '__smAccountActiveConfirmed',
    'consultRefundAdEntry',
    'syncShuimingInactivePrompt',
    '去计算可退税额'
  ],
  'refund card for every inactive user, CTA to calculate'
);
mustInclude(
  'frontend/consult.html',
  ['consultRefundAdEntry" hidden', 'refund_ad.html?from=consult', '未开通也可先看二次退税'],
  'consult refund card hidden until inactive prompt'
);
mustInclude(
  'frontend/shuiming_result.html',
  [
    'smActivateCard',
    'smActivateTitle',
    'is-refund-prompt',
    'syncShuimingInactivePrompt',
    'sm-account-active',
    '__smAccountActiveConfirmed',
    'watermark.js?v=20260831-m60home'
  ],
  'shuiming inactive activate card with refund prompt'
);
mustExclude(
  'frontend/shuiming_result.html',
  ['id="smRefundAdCard"', 'syncShuimingRefundAdCard', 'id="smRefundAdBtn"'],
  'shuiming result has no wechat refund card'
);
mustInclude(
  'frontend/public/js/conversion-guide.js',
  [
    'hideLegacyShuimingRefundWechatCard',
    "document.getElementById('smRefundAdCard')",
    'isInactiveRefundCardUser'
  ],
  'activated users never keep leftover wechat refund card'
);
mustInclude(
  'frontend/admin_panel.html',
  ['opsRefundUserTbody', 'refund_eligible', '退税合格名单'],
  'admin refund eligible list and bulk audience'
);
mustInclude(
  'backend/src/utils/ipCity.js',
  ['cityLabelFromIp', 'ip2region'],
  'ip city uses ip2region for CN users'
);
mustInclude(
  'backend/package.json',
  ['"ip2region"'],
  'backend depends on ip2region'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  ["require('../utils/ipCity')"],
  'monolith uses ipCity helper'
);

mustInclude(
  'backend/src/payments/priceBids.js',
  [
    'createPriceBids',
    'user_price_bids',
    'floor_pct',
    'floor_by_sku',
    'sku_300_7d',
    '120',
    '199',
    '298',
    'resolveAutoFloor',
    'listFollowup',
    'remindAccepted',
    'acceptToOffer'
  ],
  'price bid module with per-sku auto accept floor'
);
mustInclude(
  'backend/src/payments/routes.js',
  ["app.get('/api/payments/price-bid'", "app.post('/api/payments/price-bid'"],
  'price bid user routes'
);
mustInclude(
  'backend/src/admin/routes.js',
  [
    '/api/admin/price-bids',
    '/api/admin/price-bids/review',
    '/api/admin/price-bids/config',
    '/api/admin/price-bids/followup',
    '/api/admin/price-bids/followup-detail',
    '/api/admin/price-bids/remind'
  ],
  'price bid admin routes'
);
mustInclude(
  'frontend/purchase.html',
  [
    'priceBidTeaser',
    'btnPriceBidOpen',
    'price-bid-mask',
    'track_price_bid_submit',
    "paymentFetch('/api/payments/price-bid'",
    'handoffExpensiveToPriceBid',
    'track_purchase_price_survey_to_bid',
    'canOpenPriceBidSheet',
    "from: 'price_survey_expensive'"
  ],
  'purchase page price bid entry and expensive survey handoff'
);
mustInclude(
  'backend/src/growth/purchasePriceSurvey.js',
  [
    'function attachExpectedPriceFromBid',
    'function effectiveExpectedPrice',
    'function latestBidJoinSql',
    "sentiment = 'expensive'"
  ],
  'price survey backfill from bid'
);
mustInclude(
  'backend/src/payments/priceBids.js',
  ['onBidRecorded', 'rememberSurveyExpectedPrice'],
  'price bid notifies survey expected_price'
);
mustInclude(
  'frontend/admin_panel.html',
  ['点「偏贵」后金额记在心理价出价里', '本表会一并显示'],
  'admin purchase survey shows bid amounts'
);
mustInclude(
  'frontend/admin_panel.html',
  [
    '心理价出价',
    'bidTbody',
    'btnSaveBidCfg',
    'bidCfgFloorPct',
    'bidCfgFloorWeek',
    'bidCfgFloorTwoWeek',
    'bidCfgFloorMonth',
    'bidPsychPriceBar',
    '当前心理价位',
    'sectionPriceBids',
    'sectionPriceBidFollowup',
    'bidFollowTbody',
    'btnBulkRemindBidFollowup',
    '已通过跟进'
  ],
  'admin price bids section'
);
mustInclude(
  'frontend/public/js/admin_panel.js',
  [
    'api/admin/price-bids',
    'bid-accept',
    'bid-reject',
    'api/admin/price-bids/config',
    'renderBidPsychPriceBar',
    'api/admin/price-bids/followup',
    'api/admin/price-bids/remind',
    'bid-follow-remind',
    'bindBidFollowup'
  ],
  'admin price bids wiring'
);
mustInclude(
  'backend/src/admin/routes.js',
  ['/api/admin/ops/refund-eligible', 'handleOpsRefundEligible'],
  'refund eligible admin route'
);
mustInclude(
  'frontend/public/js/consult-batch-tax.js',
  ["invokeAfterTaxRecordsCreated({ source: 'batch', records: list })"],
  'refund ad after batch records refreshed'
);
mustInclude(
  'frontend/refund_ad.html',
  [
    'is-from-tax-done',
    '查看我刚填的记录',
    'btnRefundAdContinue',
    'track_refund_ad_after_tax_continue',
    'track_refund_ad_page_leave',
    'dwell_seconds',
    'refundEstCard',
    '二次退税怎么来的',
    'refund_ad_estimate_v1',
    '3 个子女每月'
  ],
  'refund ad page skip-friendly after tax fill'
);
mustInclude(
  'frontend/admin_panel.html',
  ['page-ops-ad-analytics', 'opsAdUserTbody', '广告数据'],
  'admin ad page ops panel'
);
mustInclude(
  'backend/src/admin/menuRegistry.js',
  ["page: 'ops-ad-analytics'", '广告数据'],
  'admin menu ad page ops'
);
mustInclude(
  'frontend/douyin_yuefu_ad.html',
  [
    'track_douyin_yuefu_ad_view',
    'track_douyin_yuefu_ad_copy',
    'track_douyin_yuefu_ad_page_leave',
    '抖音月付 · 大额秒到',
    'Tangdong6832'
  ],
  'douyin yuefu ad page'
);
mustInclude(
  'frontend/purchase.html',
  ['purchaseYuefuEntry', 'douyin_yuefu_ad.html?from=purchase_yuefu', 'track_purchase_yuefu_ad_entry_view'],
  'purchase page yuefu ad entry'
);
mustInclude(
  'backend/src/admin/adPageAnalytics.js',
  ['track_douyin_yuefu_ad_view', 'track_douyin_yuefu_ad_page_leave'],
  'ad analytics douyin yuefu events'
);
mustInclude(
  'frontend/gjj_extract_ad.html',
  ['refund_ad.html', '#gjj', 'from=gjj_legacy', '公积金提取'],
  'gjj extract ad redirects to refund page'
);
mustInclude(
  'frontend/refund_ad.html',
  [
    'id="gjjAdOnRefund"',
    '/img/gjj-extract-ad.jpg',
    '公积金提取',
    'track_gjj_extract_ad_view',
    'track_gjj_extract_ad_copy',
    '备注「公积金提取」'
  ],
  'refund ad page embeds gjj extract'
);
mustInclude(
  'frontend/purchase.html',
  [
    'purchaseGjjEntry',
    '/img/gjj-extract-ad.jpg',
    'track_gjj_extract_ad_view',
    'track_gjj_extract_ad_copy',
    'track_purchase_gjj_ad_entry_view'
  ],
  'purchase page embeds gjj ad with refund'
);
if (exists('frontend/public/img/gjj-extract-ad.jpg')) ok('gjj extract ad poster image');
else fail('gjj extract ad poster image', 'missing frontend/public/img/gjj-extract-ad.jpg');
if (exists('frontend/public/img/ad-services-grid.jpg')) ok('ad services grid image');
else fail('ad services grid image', 'missing frontend/public/img/ad-services-grid.jpg');
mustInclude(
  'frontend/refund_ad.html',
  ['/img/ad-services-grid.jpg', 'ad-services-top'],
  'refund ad services grid banner'
);
mustInclude(
  'frontend/douyin_yuefu_ad.html',
  ['/img/ad-services-grid.jpg', 'ad-services-top'],
  'douyin yuefu ad services grid banner'
);
mustInclude(
  'frontend/refund_ad.html',
  ['id="gjjAdOnRefund"', 'ad-services-top'],
  'gjj extract lives on refund ad page with services grid'
);
{
  const adHtml = read('frontend/refund_ad.html');
  const copyIdx = adHtml.indexOf('id="btnCopyRefundWechat"');
  const gridIdx = adHtml.indexOf('class="ad-services-top"');
  if (copyIdx > 0 && gridIdx > 0 && copyIdx < gridIdx) {
    ok('refund ad WeChat copy sits above services grid');
  } else {
    fail(
      'refund ad WeChat copy sits above services grid',
      `copy=${copyIdx} grid=${gridIdx}`
    );
  }
}
mustInclude(
  'backend/src/admin/adPageAnalytics.js',
  ['track_gjj_extract_ad_view', 'track_gjj_extract_ad_page_leave'],
  'ad analytics gjj extract events'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  [
    "act.indexOf('track_refund_ad_') === 0",
    "act.indexOf('track_douyin_yuefu_ad_') === 0",
    "act.indexOf('track_gjj_extract_ad_') === 0",
    'recordAdPageTrackEvent',
    'ad_page_track_events'
  ],
  'retain and store ad page track events'
);
mustInclude(
  'backend/src/admin/adPageAnalytics.js',
  [
    'VIEW_KEYS, VIEW_KEYS, COPY_KEYS, COPY_KEYS, LEAVE_KEYS, LEAVE_KEYS, params',
    'VIEW_KEYS, VIEW_KEYS, COPY_KEYS, LEAVE_KEYS, params'
  ],
  'ad stats SQL binds include leave keys'
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
  'frontend/admin_panel.html',
  ['用户专属报价', 'btnSavePriceOffer', 'priceOfferUsername'],
  'admin UI drops manual user price offer form'
);
mustExclude(
  'frontend/public/js/admin_panel.js',
  ['bindUserPriceOfferForm', 'btn-user-price-offer', 'btnSavePriceOffer'],
  'admin JS drops manual user price offer wiring'
);
mustExclude(
  'backend/src/admin/routes.js',
  ["'/api/admin/user-price-offer'", "'/api/admin/user-price-offer/clear'"],
  'admin routes drop manual user-price-offer endpoints'
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
mustExclude(
  'frontend/admin_panel.html',
  ['xianyuPurchaseUrl', '已下线，仅存档'],
  'admin offline xianyu purchase field removed'
);
mustExclude(
  'frontend/public/js/admin_panel.js',
  ['xianyuPurchaseUrl', 'collectSkuCatalogPricesFromForm', 'applySkuCatalogPricesToForm'],
  'admin panel dead sku/xianyu helpers removed'
);
mustExclude(
  'frontend/css/admin_panel.css',
  ['.ccb-expense-row', '.admin-panel-inset', '.admin-soft-box', '.input-w-140'],
  'admin css orphan utility blocks removed'
);
mustInclude(
  'backend/src/admin/routes.js',
  ['/api/admin/agent-channels', 'handleAdminAgentChannelsList', 'handleAdminAgentChannelsUpsert', 'handleAdminAgentChannelsDelete'],
  'admin agent-channels routes retained'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  [
    'handleAdminAgentChannelsList',
    'handleAdminAgentChannelsUpsert',
    'handleAdminAgentChannelsDelete'
  ],
  'monolith agent-channels handlers retained'
);
mustExclude(
  'backend/src/legacy/monolith.js',
  [
    'handleAdminUserPricingAbc',
    'handleAdminAnalyticsApi',
    'normalizePricingAbcToken',
    'ensureChannelInXianyuHideList'
  ],
  'monolith unused pricing-abc/analytics helpers removed'
);
if (!exists('frontend/profile.html')) ok('orphan profile.html removed');
else fail('orphan profile.html removed', 'file still exists');
if (!exists('backend/scripts/ccb_flow_edit.py')) ok('unused ccb_flow_edit.py removed');
else fail('unused ccb_flow_edit.py removed', 'file still exists');
if (
  !exists('backend/assets/sbdy/img_0.png') &&
  !exists('backend/assets/sbdy/PD4MLFZXBSJW--GB1-0_6.ttf') &&
  !exists('backend/assets/sbdy/PD4MLNSimSun_11.ttf') &&
  !exists('backend/assets/sbdy/SimSun_21.ttf')
) {
  ok('unused sbdy font/image leftovers removed');
} else {
  fail('unused sbdy font/image leftovers removed', 'asset still exists');
}

/* ===== 共享 C 端脚本 ?v= 全站一致性守卫（nginx /js/ 强缓存 7 天，戳不齐会新旧混跑） =====
 * mine_mate60_aug12.html 为冻结页豁免；管理页不参与。
 * 升级共享脚本时：sed 统一全部 C 端页面到同一个新戳，勿只改单页。
 * 今日热修允许若干页保留独立戳（见 PAGE_STAMP_ALLOW）。 */
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
  /* page -> allowed stamp(s) that may differ from the majority */
  const PAGE_STAMP_ALLOW = {
    auth: {
      'gerenxinxi.html': ['20260903-email-val1'],
      'register.html': ['20260903-email-val1', '20260903-email-reg1'],
      'login.html': ['20260903-email-reg1'],
      'face_login.html': ['20260905-facelogin-ui3'],
      'message.html': ['20260903-email-reg1'],
      'shouye.html': ['20260903-email-reg1'],
      'message_detail.html': ['20260903-mate60-msg3'],
      'mine.html': ['20260905-vivox90-mine'],
      'purchase.html': ['20260903-mate60pay'],
      'shuiming.html': ['20260904-android-inset'],
      'shuiming_result.html': ['20260904-air-gap'],
      'xiangqing.html': ['20260904-android-inset'],
      'consult.html': ['20260904-funnel-cta']
    },
    'auth-boot': {
      'login.html': ['20260902-ip16pm-login'],
      'face_login.html': ['20260905-facelogin-ui3'],
      'message_detail.html': ['20260903-mate60-msg3'],
      'mine.html': ['20260905-vivox90-mine'],
      'shuiming.html': ['20260904-android-inset'],
      'shuiming_result.html': ['20260904-android-inset'],
      'xiangqing.html': ['20260904-android-inset']
    }
  };
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
        const stamp = m[1];
        const allow = (PAGE_STAMP_ALLOW[name] && PAGE_STAMP_ALLOW[name][p]) || [];
        if (allow.includes(stamp)) continue;
        if (!stamps.has(stamp)) stamps.set(stamp, []);
        stamps.get(stamp).push(p);
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

/* —— 近两日（沪穗社保 / 离职章号 / 运营转化 / iOS 省略 / zl 备注）—— */
mustInclude(
  'backend/scripts/sbdy_sh_render_pdf.py',
  ['参保人员城镇职工基本养老保险参保情况', 'sh_seal.png', 'def render('],
  'Shanghai sbdy PDF renderer'
);
mustInclude(
  'backend/src/admin/sbdyDemo.js',
  [
    'function isGzRegion',
    'function isShRegion',
    'gz_official_v1',
    'sh_official_v1',
    'buildSzMonthRowsFromSegments',
    'normalizeShPayload',
    "region: gz ? 'gz' : 'sz'"
  ],
  'sbdyDemo Guangzhou + Shanghai normalize'
);
mustInclude(
  'frontend/public/js/admin/modules/sbdy-demo.js',
  ['sbdyRegionGz', 'sbdyRegionSh', '已填充上海示例'],
  'sbdy admin Guangzhou + Shanghai radios'
);
mustInclude(
  'frontend/admin_panel.html',
  [
    'sbdyRegionGz',
    'sbdyRegionSh',
    '广州历年缴费明细',
    '上海城镇职工养老保险参保情况'
  ],
  'admin panel Guangzhou + Shanghai labels'
);
if (exists('backend/assets/sbdy/gz_seal.png') && exists('frontend/public/img/sbdy_gz_seal.png')) {
  ok('Guangzhou sbdy seal assets present');
} else {
  fail('Guangzhou sbdy seal assets present', 'missing gz_seal.png');
}
if (exists('backend/assets/sbdy/sh_seal.png') && exists('frontend/public/img/sbdy_sh_seal.png')) {
  ok('Shanghai sbdy seal assets present');
} else {
  fail('Shanghai sbdy seal assets present', 'missing sh_seal.png');
}
mustInclude(
  'backend/scripts/sbdy_sz_render_pdf.py',
  ['139.0', 'min_size=3.2', 'pad=0.6', 'if ci == 2:'],
  'SZ/GZ unit_code column widened for 18-digit codes'
);
mustInclude(
  'backend/src/admin/sbdyDemo.js',
  [
    'function isSzNewRegion',
    'function normalizeSzNewPayload',
    'function renderSzNewCertHtml',
    'SBDY_SZ_NEW_RENDER_SCRIPT',
    "region: 'sz_new'",
    'sz_cgbzm_v1'
  ],
  'sbdyDemo Shenzhen-new normalize + HTML'
);
mustInclude(
  'frontend/public/js/admin/modules/sbdy-demo.js',
  ['sbdyRegionSzNew', "return 'sz_new'", '已填充深圳新示例'],
  'sbdy admin Shenzhen-new radio + sample'
);
mustInclude(
  'frontend/sbdy_demo.html',
  ['sbdyRegionSzNew', '深圳新', 'btnSbdyDownloadFile', '下载文件'],
  'user sbdy page Shenzhen-new radio and download button'
);
mustInclude(
  'frontend/admin_panel.html',
  ['sbdyRegionSzNew', '深圳新参保证明'],
  'admin panel Shenzhen-new label'
);
mustInclude(
  'backend/scripts/sbdy_sz_new_render_pdf.py',
  [
    '深圳市社会保险参保证明',
    '历年参保年限',
    '近两年参保缴费明细',
    'sz_new_si_seal',
    'sz_new_mi_seal',
    'ensure_full_cjk_font',
    'right_x = X1 - seal_size',
    'expected 2 seals',
    '深圳市医疗保险基金管理中心'
  ],
  'Shenzhen-new PDF renderer title and dual seals'
);
mustInclude(
  'backend/src/admin/sbdyDemo.js',
  [
    '.sz-sec{',
    'text-align:left',
    'font-synthesis:none',
    'justify-content:flex-end',
    'Noto Serif CJK SC',
    'sbdy_sz_new_si_seal.png',
    'sbdy_sz_new_mi_seal.png',
    '深圳市医疗保险基金管理中心'
  ],
  'Shenzhen-new HTML section titles left + Song font + dual seals'
);
if (
  exists('backend/assets/sbdy/sz_new_si_seal.png') &&
  exists('backend/assets/sbdy/sz_new_mi_seal.png') &&
  exists('frontend/public/img/sbdy_sz_new_si_seal.png') &&
  exists('frontend/public/img/sbdy_sz_new_mi_seal.png')
) {
  ok('Shenzhen-new sbdy dual seal assets present');
} else {
  fail('Shenzhen-new sbdy dual seal assets present', 'missing sz_new_*_seal.png');
}
mustInclude(
  'backend/src/admin/sbdyDemo.js',
  [
    'function isJsNewRegion',
    'function isJsStyleRegion',
    'function renderJsNewCertHtml',
    'SBDY_JS_NEW_RENDER_SCRIPT',
    "region: isNew ? 'js_new' : 'js'",
    'js_cgbzm_v1',
    '核查内容真实，欢迎登录江苏社保APP扫描验证',
    'writing-mode:horizontal-tb',
    'class="detail-wrap"',
    'class="wm-block"',
    'class="after-table"',
    'sbdy_js_seal.png',
    '打印时间：',
    '本文件由全国社保卡服务平台提供，任何第三方机构不得进行'
  ],
  'sbdyDemo Jiangsu-new normalize + HTML watermark'
);
mustInclude(
  'frontend/public/js/admin/modules/sbdy-demo.js',
  [
    'sbdyRegionJsNew',
    "return 'js_new'",
    "input[name=\"sbdyRegion\"]:checked",
    '已填充江苏新示例',
    'isJsStyle'
  ],
  'sbdy admin Jiangsu-new radio + sample'
);
mustInclude(
  'frontend/public/js/admin/loader.js',
  ['sbdy-demo.js?v=20260906-js-new-wm3'],
  '20260906 sbdy-demo cache bust after js_new 3-line watermark + seal below'
);
mustInclude(
  'frontend/sbdy_demo.html',
  ['sbdy-demo.js?v=20260906-js-new-wm3'],
  '20260906 user sbdy page cache matches admin loader'
);
mustInclude(
  'frontend/sbdy_demo.html',
  ['sbdyRegionJsNew', '江苏新'],
  'user sbdy page Jiangsu-new radio'
);
mustInclude(
  'frontend/admin_panel.html',
  ['sbdyRegionJsNew', '江苏新', '江苏新权益记录单'],
  'admin panel Jiangsu-new label'
);
mustInclude(
  'backend/scripts/sbdy_js_new_render_pdf.py',
  [
    'WATERMARK_BASE',
    'draw_watermark',
    'WM_LINE1',
    'line_gap',
    '核查内容真实，欢迎登录江苏社保APP扫描验证',
    'draw_seal',
    'table_bottom',
    '打印时间：',
    '不得进行二次加工'
  ],
  'Jiangsu-new PDF watermark script'
);
mustInclude(
  'backend/scripts/lizhi_render_pdf.py',
  ['default_seal_code', 'seal_code', 'place_seal'],
  'lizhi seal supports bottom seal_code'
);
mustInclude(
  'backend/src/admin/opsConversion.js',
  [
    'handleOpsInactiveSummary',
    'handleOpsInactiveUsers',
    'handleOpsConversionResearch',
    'HIGH_INCOME'
  ],
  'ops conversion handlers'
);
mustInclude(
  'backend/src/admin/routes.js',
  [
    '/api/admin/ops/board',
    '/api/admin/ops/inactive-summary',
    '/api/admin/ops/inactive-users',
    '/api/admin/ops/conversion-research',
    'handleOpsConversionResearch',
    'handleOpsBoard'
  ],
  'ops conversion routes'
);
mustInclude(
  'backend/src/admin/menuRegistry.js',
  ["page: 'ops-board'", "label: '运营看板'", "page: 'ops-inactive'", 'nav_hidden: true'],
  'ops conversion admin menus'
);
mustInclude(
  'frontend/public/js/admin/modules/ops-conversion.js',
  ["AdminModules['ops-conversion']", 'inactive-summary', 'api/admin/ops/board', 'loadBoard'],
  'ops conversion admin module'
);
mustInclude(
  'frontend/admin_panel.html',
  ['id="page-ops-board"', 'opsBoardKpi', 'opsBoardTodo', 'opsBoardBulkAnchor'],
  'ops board page panel'
);
mustInclude(
  'backend/src/admin/opsConversion.js',
  ['handleOpsBoard', 'pay_gmv', 'refund_eligible'],
  'ops board API handler'
);
mustInclude(
  'frontend/public/js/najilu.js',
  ['USER_CERT_BLANK_REMARK', 'zl901010: true'],
  'zl901010 blank remark whitelist'
);
mustExclude(
  'frontend/public/js/najilu.js',
  ["zl901010: '原始申报'"],
  'zl901010 must not hardcode 原始申报'
);
mustInclude(
  'frontend/shuiming_result.html',
  ['max-width: 13em', 'isIosCompanyNameEllipsisClient'],
  'iOS withhold/company 13em ellipsis still wired'
);
mustInclude(
  'backend/src/user/lizhiCertUser.js',
  ['pickLastCompany', 'ORDER BY year DESC, month DESC'],
  'lizhi prefill prefers latest tax employer'
);

/* —— 2026-09-01 全安卓卡顿优化（对照小米）—— */
mustInclude(
  'frontend/public/js/tab-shell.js',
  [
    'TaxAppTabShell',
    'tab_embed=1',
    'warmOtherTabs',
    'isAndroidLike',
    'baseDelay',
    'promoteIframeIfLeftAssignedTab'
  ],
  'tab-shell iframe cache + android warm delay'
);
mustInclude(
  'frontend/login.html',
  ['tab-shell-escape.js?v=20260906-login-top', 'assignTopLocation'],
  'login escapes tab-shell iframe after success'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['injectTabShell', '/js/tab-shell.js?v=20260906-login-top', "get('tab_embed') === '1'"],
  'auth injects tab-shell and skips CG in embed'
);
mustInclude(
  'frontend/public/js/auth-boot.js',
  ['primeAndroidMineE1SmFirstPaint', 'app-android-mine-e1-sm', 'e1_01@sm.png?v=20260901-android-mine-sm'],
  'auth-boot android mine @sm first paint'
);
mustExclude('frontend/shouye.html', ['watermark.js'], 'home without watermark');
mustExclude('frontend/mine.html', ['watermark.js'], 'mine without watermark');
mustExclude('frontend/daiban.html', ['watermark.js'], 'daiban without watermark');
mustInclude(
  'frontend/shouye.html',
  ['html.app-android-client .sy-apk-marquee span', 'animation: none', 'requestIdleCallback(startAuto'],
  'android home softens marquee and defers swiper'
);

/* —— 2026-09-03：Mate60 消息详情 / 安卓黑系统栏 / 支付回跳摘圈 / 明细通栏 —— */
mustInclude(
  'frontend/message_detail.html',
  [
    'app-android-huawei-mate60',
    'data-mate60-message-detail-firstpaint',
    'body.page-message-detail{',
    'padding-top:calc(44px + 40px)',
    'auth.js?v=20260903-mate60-msg3'
  ],
  '20260903 mate60 message detail firstpaint + cache'
);
mustInclude(
  'frontend/public/js/auth.js',
  [
    'body.page-message-detail #arkWhiteTopShield{display:none',
    "b.classList.contains('page-message-detail')",
    '安卓 / 鸿蒙：系统栏为独立黑条',
    "upsertMeta('theme-color', '#000000')",
    'overlays: false',
    "color: '#000000'"
  ],
  '20260903 mate60 msg skip ark white-top + android black status bar'
);
mustInclude(
  'frontend/mine.html',
  ['theme-color" content="#000000"', 'auth.js?v=20260905-vivox90-mine'],
  '20260903 mine black theme-color + cache'
);
mustInclude(
  'frontend/public/js/page-loading.js',
  [
    "'mine_mate60_aug12.html': true",
    'everWentHidden',
    'hideLoadingOnForeground',
    "hideLoadingOnForeground('visibility')",
    "hideLoadingOnForeground('cordova-resume')"
  ],
  '20260903 pay-return force hide loading + mate60 mine primary tab'
);
mustInclude(
  'frontend/purchase.html',
  ['forceHidePageLoading', 'auth.js?v=20260903-mate60pay', 'visibilitychange'],
  '20260903 purchase hides loading on return'
);
mustInclude(
  'frontend/shuiming_result.html',
  [
    '仅限 iOS：安卓/鸿蒙',
    'html.platform-ios body.page-shuiming-result .list',
    'html.platform-android body.page-shuiming-result .list-item',
    '--list-inline-pad: 16px',
    'margin-left: 2px',
    'auth.js?v=20260903-android-wide'
  ],
  '20260903 android wide list + question-mark spacing revert'
);
mustExclude(
  'frontend/shuiming_result.html',
  ['margin-left: -3px', '.summary-help-with-colon .icon {\n            letter-spacing: 0'],
  '20260903 no aggressive question-mark negative margin'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  ["{ key: 'other_deduction', label: '专项附加扣除' }"],
  '20260903 change-log other_deduction label'
);
mustInclude(
  'backend/src/tax/deductionSplit.js',
  ['专项附加扣除', 'other_deduction', 'periodOtherDeductionForDetail'],
  '20260903 deductionSplit module'
);
mustInclude(
  'backend/src/admin/opsConversion.js',
  ["'18671741907'", "'13691947741'"],
  '20260903 full-scope phones in opsConversion'
);
mustInclude(
  'backend/opsStatsReport.js',
  [
    'paymentSkuCaseSql',
    'collectAdminActivationCredits',
    'paymentProductTable',
    '开通套餐（线上支付）',
    '离职证明',
    '同行费用（每天无限）',
    '合计 GMV（含管理员激活）',
    'adminActivationCreditRules',
    "'18933137956'",
    "'19106014552'",
    'combined_amt',
    'lizhi_amt',
    'admin_act_amt'
  ],
  '20260905 ops daily mail payment analytics split'
);
mustInclude(
  'frontend/admin_panel.html',
  ['收入拆分对齐「支付分析」', '管理员激活折算与合计 GMV'],
  '20260905 monitor hint mentions payment split in daily mail'
);
mustInclude(
  'backend/src/tax/withholdingCalc.js',
  ['currentPeriodDeclaredTax', '累计应纳税额', '累计已预缴税额'],
  '20260905 period declared tax formula'
);
mustInclude(
  'backend/src/legacy/monolith.js',
  [
    "require('../tax/withholdingCalc')",
    'currentPeriodDeclaredTax(',
    'totalTaxPaidBefore,',
    'totalTaxRelief'
  ],
  '20260905 tax calc page uses cumulative formula for 本期申报税额'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['URL_ONLY_SALES_CHANNELS', 'isUrlOnlySalesChannel', 'readUrlSalesChannel'],
  '20260905 abc URL-only sales channel'
);
mustInclude(
  'frontend/public/js/auth.js',
  ['window.isUrlOnlySalesChannel = isUrlOnlySalesChannel'],
  '20260905 export isUrlOnlySalesChannel early'
);
mustInclude(
  'backend/serverMonitor.js',
  [
    'najilu-qr-status',
    'najilu-qr-list',
    'zaizhi-status',
    'bilibili-share',
    'public-ad-pages',
    'auth-login-fail',
    'var raw = await probeHttp(url, { method: def.method || \'GET\', body: def.body });'
  ],
  '20260905 monitor probes cover more endpoints + pass body'
);
mustInclude(
  'frontend/consult.html',
  ['id="najiluQrEntryCard"', 'najilu_qr.html?from=consult', 'consult-najilu-qr-entry'],
  '20260905 完税二维码入口移到我要咨询增值服务'
);
mustExclude(
  'frontend/purchase.html',
  ['id="cardNajiluQr"', 'btnNajiluQrEntry'],
  '20260905 完税二维码入口已从支付页移除'
);
mustInclude(
  'scripts/api-selftest.mjs',
  ['/api/health', '/api/najilu-qr/status', '/api/partner/bank/health', 'expectStatus'],
  '20260905 standalone API selftest script'
);
mustInclude(
  'frontend/tests/e2e/ui-smoke-browser.mjs',
  ['UI_SMOKE_CHROME_ONLY', 'CHROME_ONLY'],
  '20260905 chrome-only smoke skips API business suite'
);
mustInclude(
  'frontend/tests/e2e/ui-smoke-devices.mjs',
  [
    "spec === 'popular'",
    'POPULAR_DEVICE_IDS',
    "id: 'redmi-k80ultra'",
    "id: 'oppo-findx8'",
    "id: 'vivo-x100'",
    "id: 'iphone-ios18-7'",
    '25060RK16C',
    'PKB110',
    'V2309A',
    'PFTM20',
    '23113RKC6C'
  ],
  '20260905 popular production device smoke catalog'
);
mustInclude(
  'frontend/public/js/auth.js',
  [
    'app-android-redmi-k80ultra',
    'isAndroid25060RK16CClient()',
    'K80[\\s_-]*(?:至尊|Ultra)'
  ],
  '20260905 K80 Ultra immersive 40px'
);

console.log(`[today-selftest] done passed=${passed} failed=${failed}`);
process.exit(failed ? 1 : 0);
