/**
 * 税务记录 + 用户注册/登录 API
 * 数据持久化：MySQL 数据库
 */
const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const geoip = require('geoip-lite');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const registerGuard = require('./register-guard');
const serverMonitor = require('./serverMonitor');
const { inferBankNameFromCardNo } = require('./bank_card_bins');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
const ADMIN_ACTIVATION_KEY = process.env.ADMIN_ACTIVATION_KEY || '';
const ADMIN_PANEL_USER = process.env.ADMIN_PANEL_USER || 'admin';
const ADMIN_PANEL_PASSWORD = process.env.ADMIN_PANEL_PASSWORD || '640810';

const DB_HOST = process.env.DB_HOST || 'test_platform_db';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'password';
const DB_DATABASE = process.env.DB_DATABASE || 'personal_tax';
const PORT = parseInt(process.env.PORT || '3000', 10);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');

/** mine_ui JSON 中可配置的图片字段（相对路径、uploads/ 或 https） */
const MINE_UI_IMAGE_KEYS = [
  'header_male',
  'header_female',
  'icon_family',
  'icon_employer',
  'icon_bank',
  'nav_sy_1',
  'nav_sy_2',
  'nav_db_1',
  'nav_db_2',
  'nav_bc_1',
  'nav_bc_2',
  'nav_xx_1',
  'nav_xx_2',
  'nav_w_1',
  'nav_w_2',
  'shouye_banner',
  'shouye_zdfwdb',
  'shouye_lb',
  'daiban_header',
  'bancha_header',
  'message_header',
  'piaojia_goumai',
  'piaojia_xiaoshou'
];
/** 安装页效果预览（不受「默认配图」开关影响） */
const INSTALL_SHOWCASE_IMAGE_KEYS = [
  'install_showcase_gif',
  'install_showcase_img_1',
  'install_showcase_img_2',
  'install_showcase_img_3'
];
/** mine_ui JSON 中可配置的视频字段（相对路径、uploads/ 或 https） */
const MINE_UI_VIDEO_KEYS = ['install_ios_video', 'install_usage_video'];

/** 0=普通账号 1=测试账号 */
const USER_TYPE_NORMAL = 0;
const USER_TYPE_TEST = 1;

/** 注册来源渠道（C 端下拉 value → 展示名） */
const REGISTER_SOURCE_CHANNELS = {
  douyin: '抖音',
  bilibili: 'B站',
  tieba: '百度贴吧',
  zhihu: '知乎',
  friend: '朋友介绍',
  github: 'GitHub',
  other: '其他',
  xianyu: '闲鱼'
};

/** 激活码 note 含「闲鱼」视为闲鱼渠道批量码 */
function isXianyuActivationNote(note) {
  return String(note || '').indexOf('闲鱼') >= 0;
}

function activationSourceFromCodeNote(note) {
  if (isXianyuActivationNote(note)) {
    return 'xianyu';
  }
  return '';
}

function activationSourceChannelLabel(channel) {
  var c = channel != null ? String(channel).trim() : '';
  if (!c) {
    return '';
  }
  if (REGISTER_SOURCE_CHANNELS[c]) {
    return REGISTER_SOURCE_CHANNELS[c];
  }
  return c;
}

/** 注册来源 + 激活来源（闲鱼码等）综合展示 */
function userChannelAnalysisLabel(registerChannel, activationChannel) {
  var reg = registerSourceChannelLabel(registerChannel);
  var act = activationSourceChannelLabel(activationChannel);
  if (act && reg && reg !== act) {
    return '注册：' + reg + '；激活：' + act;
  }
  if (act) {
    return act;
  }
  return reg || '—';
}

const REGISTER_SOURCE_OTHER_MAX = 64;

function normalizeRegisterSourceChannelInput(channel, otherText) {
  var c = channel != null ? String(channel).trim() : '';
  if (!c) {
    return { err: '请选择来源渠道' };
  }
  if (c === 'other') {
    var custom = otherText != null ? String(otherText).trim() : '';
    if (!custom) {
      return { err: '请填写其他来源渠道' };
    }
    if (custom.length > REGISTER_SOURCE_OTHER_MAX) {
      return { err: '其他渠道名称不能超过' + REGISTER_SOURCE_OTHER_MAX + '字' };
    }
    return { value: 'other:' + custom };
  }
  if (!REGISTER_SOURCE_CHANNELS[c]) {
    return { err: '来源渠道无效' };
  }
  return { value: c };
}

function validateRegisterSourceChannel(channel) {
  var c = channel != null ? String(channel).trim() : '';
  if (!c) {
    return '请选择来源渠道';
  }
  if (c.indexOf('other:') === 0) {
    var custom = c.slice(6).trim();
    if (!custom) {
      return '请填写其他来源渠道';
    }
    if (custom.length > REGISTER_SOURCE_OTHER_MAX) {
      return '其他渠道名称不能超过' + REGISTER_SOURCE_OTHER_MAX + '字';
    }
    return null;
  }
  if (!REGISTER_SOURCE_CHANNELS[c]) {
    return '来源渠道无效';
  }
  return null;
}

function registerSourceChannelLabel(channel) {
  var c = channel != null ? String(channel).trim() : '';
  if (!c) {
    return '—';
  }
  if (c.indexOf('other:') === 0) {
    var custom = c.slice(6).trim();
    return custom ? '其他：' + custom : REGISTER_SOURCE_CHANNELS.other;
  }
  return REGISTER_SOURCE_CHANNELS[c] || c;
}
/** 历史注册默认税号；对外展示为 DEFAULT_TAX_ID_HINT */
const LEGACY_DEFAULT_TAX_ID = '620000000000000000';
const DEFAULT_TAX_ID_HINT = '所有信息点击我要咨询修改';
const LEGACY_TAX_ID_HINT = '注册默认： 所有信息点击我要咨询修改';

function normalizeTaxIdForApi(taxId) {
  var s = taxId == null ? '' : String(taxId).trim();
  if (!s || s === LEGACY_DEFAULT_TAX_ID || s === LEGACY_TAX_ID_HINT) return DEFAULT_TAX_ID_HINT;
  return s;
}

function isPlaceholderTaxId(taxId) {
  var s = taxId == null ? '' : String(taxId).trim();
  return (
    !s ||
    s === LEGACY_DEFAULT_TAX_ID ||
    s === DEFAULT_TAX_ID_HINT ||
    s === LEGACY_TAX_ID_HINT ||
    s === '所有信息点击税务演示数据修改' ||
    s === '所***************改'
  );
}

/** C 端「纳税人识别号」在管理后台用户数据中展示为身份证号 */
function formatUserIdCardForAdmin(taxId) {
  var s = taxId == null ? '' : String(taxId).trim();
  return isPlaceholderTaxId(s) ? '' : s;
}

function userIdCardLabelForAdmin(taxId) {
  var s = formatUserIdCardForAdmin(taxId);
  return s || '未填写';
}
/** 环境变量或内置默认；首次写入 app_settings 及库中无配置时使用 */
const TEST_ACCOUNT_COMPANY_NAME_DEFAULT = process.env.TEST_ACCOUNT_COMPANY_NAME || '';
const SETTING_KEY_TEST_COMPANY = 'test_account_company_name';
const SETTING_KEY_MINE_UI = 'mine_ui_json';
const SETTING_KEY_ANDROID_APK = 'android_apk_download_url';
const SETTING_KEY_AGENT_ANDROID_APK = 'agent_android_apk_download_url';
const SETTING_KEY_IOS_MOBILECONFIG = 'ios_mobileconfig_download_url';
/** 闲鱼购买等外链，与引导安装一同在后台配置 */
const SETTING_KEY_XIANYU_PURCHASE = 'xianyu_purchase_url';
const SETTING_KEY_XIANYU_HIDE_CHANNELS = 'xianyu_hide_sales_channels';
/** 个人中心顶栏「添加QQ号」外链 */
const SETTING_KEY_QQ_ADD_URL = 'qq_add_url';
const SETTING_KEY_QQ_GROUP_URL = 'qq_group_url';
const SETTING_KEY_WECHAT_PAY_QRCODE = 'wechat_pay_qrcode_url';
const SETTING_KEY_CONVERSION_AB = 'conversion_ab_json';

const DEFAULT_CONVERSION_AB = {
  enabled: true,
  activate_title_a: '请输入激活码',
  activate_subtitle_a: '激活后去除水印',
  activate_title_b: '输入激活码，解锁完整功能',
  activate_subtitle_b: '永久使用，不限制设备',
  batch_example_prominent: false
};

const ADMIN_MENU_KEYS = [
  'settings',
  'install-guide',
  'appearance',
  'codes',
  'users',
  'user-data',
  'user-behavior',
  'activated-user-analysis',
  'feedback',
  'login-log',
  'analytics-conversion',
  'analytics-activity',
  'analytics-register',
  'analytics-tracking',
  'analytics-devices',
  'install-guide-stats',
  'channel-analysis',
  'api-analytics',
  'admin-accounts',
  'server-monitor'
];

/** 个人中心默认外观（管理后台可覆盖） */
const DEFAULT_MINE_UI = {
  theme: 'blue',
  header_male: 'grdb.jpg',
  header_female: 'nx.jpg',
  icon_family: 'jtcy.jpg',
  icon_employer: 'rzsp.jpg',
  icon_bank: 'yhk.jpg'
};

let pool;
/** @type {{ v: string, t: number }|null} */
var _testCompanyNameCache = null;
var TEST_COMPANY_CACHE_MS = 3000;

function hashPasswordWithSalt(password, saltBuf) {
  return crypto.scryptSync(password, saltBuf, 64).toString('hex');
}

function verifyPasswordBySaltHash(password, saltHex, hashHex) {
  if (!saltHex || !hashHex) {
    return false;
  }
  try {
    var saltBuf = Buffer.from(String(saltHex), 'hex');
    var actual = hashPasswordWithSalt(password, saltBuf);
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(String(hashHex), 'hex'));
  } catch (e) {
    return false;
  }
}

function normalizeAdminMenuList(rawMenus, isSuper) {
  if (isSuper) {
    return ADMIN_MENU_KEYS.slice();
  }
  var src = Array.isArray(rawMenus) ? rawMenus : [];
  var seen = {};
  var out = [];
  src.forEach(function (m) {
    var key = String(m || '').trim();
    if (!key || ADMIN_MENU_KEYS.indexOf(key) < 0 || seen[key]) {
      return;
    }
    seen[key] = true;
    out.push(key);
  });
  return out;
}

var _wechatPayQrcodeCache = null;
var WECHAT_PAY_QRCODE_CACHE_MS = 15000;

async function getWechatPayQrcodeUrl() {
  var now = Date.now();
  if (_wechatPayQrcodeCache && now - _wechatPayQrcodeCache.t < WECHAT_PAY_QRCODE_CACHE_MS) {
    return _wechatPayQrcodeCache.v;
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [SETTING_KEY_WECHAT_PAY_QRCODE]
    );
    var v = '';
    if (rows.length > 0 && rows[0].setting_value != null) {
      var s = sanitizeMineUiImageRef(String(rows[0].setting_value).trim());
      if (s) v = s;
    }
    _wechatPayQrcodeCache = { v: v, t: now };
    return v;
  } finally {
    conn.release();
  }
}

function invalidateWechatPayQrcodeCache() {
  _wechatPayQrcodeCache = null;
}

/** 用户端展示用：uploads/… 或相对路径补全为站内 URL */
function resolvePublicAssetUrl(ref) {
  var ok = sanitizeMineUiImageRef(ref);
  if (!ok) return '';
  if (/^https?:\/\//i.test(ok)) return ok;
  if (ok.charAt(0) === '/') return ok;
  return '/' + ok;
}

async function getTestAccountCompanyName() {
  var now = Date.now();
  if (_testCompanyNameCache && now - _testCompanyNameCache.t < TEST_COMPANY_CACHE_MS) {
    return _testCompanyNameCache.v;
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [SETTING_KEY_TEST_COMPANY]
    );
    var v = TEST_ACCOUNT_COMPANY_NAME_DEFAULT;
    if (rows.length > 0 && rows[0].setting_value != null) {
      var s = String(rows[0].setting_value).trim();
      if (s !== '') v = s;
    }
    _testCompanyNameCache = { v: v, t: now };
    return v;
  } finally {
    conn.release();
  }
}

function invalidateTestCompanyNameCache() {
  _testCompanyNameCache = null;
}

function cloneMineUiDefaults() {
  return {
    theme: DEFAULT_MINE_UI.theme,
    header_male: DEFAULT_MINE_UI.header_male,
    header_female: DEFAULT_MINE_UI.header_female,
    icon_family: DEFAULT_MINE_UI.icon_family,
    icon_employer: DEFAULT_MINE_UI.icon_employer,
    icon_bank: DEFAULT_MINE_UI.icon_bank,
    nav_sy_1: 'caidan/sy1.png',
    nav_sy_2: 'caidan/sy2.png',
    nav_db_1: 'caidan/db1.png',
    nav_db_2: 'caidan/db2.png',
    nav_bc_1: 'caidan/bc1.png',
    nav_bc_2: 'caidan/bc2.png',
    nav_xx_1: 'caidan/xx1.png',
    nav_xx_2: 'caidan/xx2.png',
    nav_w_1: 'caidan/w1.png',
    nav_w_2: 'caidan/w2.png',
    shouye_banner: 'sydb-v2.jpg',
    shouye_zdfwdb: 'zdfwdb.jpg',
    shouye_lb: 'lb.jpg',
    daiban_header: 'daiban.jpg',
    bancha_header: 'db.jpg',
    message_header: '',
    piaojia_goumai: 'piaojia-goumai.png',
    piaojia_xiaoshou: 'piaojia-xiaoshou.png',
    install_ios_video: '',
    install_usage_video: '',
    install_showcase_gif: '',
    install_showcase_img_1: '',
    install_showcase_img_2: '',
    install_showcase_img_3: ''
  };
}

/** 允许站内相对路径或 https/http 图片地址，禁止 .. 与脚本伪协议 */
/** 安装包下载：完整 http(s) URL 或站内绝对路径（以 / 开头） */
function sanitizeInstallDownloadUrl(raw) {
  if (raw == null) {
    return '';
  }
  var s = String(raw).trim();
  if (s === '') {
    return '';
  }
  if (s.length > 2048 || /[\s<>"'`]/.test(s)) {
    return '';
  }
  if (/^https?:\/\//i.test(s)) {
    try {
      var u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return '';
      }
      return s;
    } catch (e) {
      return '';
    }
  }
  if (s.charAt(0) === '/' && s.indexOf('//') !== 0) {
    if (/^\/[a-zA-Z0-9_.\-\/%]+$/.test(s)) {
      return s;
    }
    return '';
  }
  // 与上传接口一致：仅允许 uploads/ 下的相对路径（禁止 ..）
  if (s.indexOf('..') >= 0) {
    return '';
  }
  if (/^uploads\/[a-zA-Z0-9_.\-\/%]+$/.test(s)) {
    return s;
  }
  return '';
}

/** 闲鱼购买文案：任意文本（复制到剪贴板），仅做长度与空白修剪 */
function sanitizeXianyuPurchaseText(raw) {
  if (raw == null) {
    return '';
  }
  var s = String(raw).trim();
  if (s === '') {
    return '';
  }
  if (s.length > 2048) {
    s = s.slice(0, 2048);
  }
  return s;
}

function sanitizeSalesChannelId(raw) {
  var s = String(raw || '').trim().toLowerCase();
  if (!s || s.length > 64) {
    return '';
  }
  if (!/^[a-z0-9_-]+$/.test(s)) {
    return '';
  }
  return s;
}

function parseXianyuHideSalesChannels(raw) {
  if (raw == null) {
    return [];
  }
  var s = String(raw).trim();
  if (!s) {
    return [];
  }
  try {
    if (s.charAt(0) === '[') {
      var arr = JSON.parse(s);
      if (Array.isArray(arr)) {
        var out = [];
        arr.forEach(function (item) {
          var id = sanitizeSalesChannelId(item);
          if (id && out.indexOf(id) < 0) {
            out.push(id);
          }
        });
        return out;
      }
    }
  } catch (e) {}
  var list = [];
  s.split(/[\n,;]+/).forEach(function (part) {
    var id = sanitizeSalesChannelId(part);
    if (id && list.indexOf(id) < 0) {
      list.push(id);
    }
  });
  return list;
}

function serializeXianyuHideSalesChannels(list) {
  var out = [];
  (list || []).forEach(function (item) {
    var id = sanitizeSalesChannelId(item);
    if (id && out.indexOf(id) < 0) {
      out.push(id);
    }
  });
  return JSON.stringify(out);
}

function shouldHideXianyuForSalesChannel(salesCh, hideList) {
  var ch = sanitizeSalesChannelId(salesCh);
  if (!ch) {
    return false;
  }
  return (hideList || []).indexOf(ch) >= 0;
}

/** 后台「代理推广渠道」列表，用于区分自有流量与代理推广用户 */
async function getAgentPromoChannelListFromSettings() {
  var raw = await getInstallPackageSettingsFromDb();
  return raw.xianyu_hide_channels || [];
}

/** segment: own | agent；按 users.sales_promo_channel 是否在代理渠道列表中划分 */
function promoSegmentFilter(segment, userAlias, agentChannels) {
  var col = userAlias + '.sales_promo_channel';
  if (!agentChannels || !agentChannels.length) {
    if (segment === 'agent') {
      return { sql: '1=0', params: [] };
    }
    return { sql: '1=1', params: [] };
  }
  var ph = agentChannels
    .map(function () {
      return '?';
    })
    .join(',');
  var normCh = 'LOWER(TRIM(' + col + '))';
  var agentSql = '(' + normCh + ' IN (' + ph + '))';
  var params = agentChannels.slice();
  if (segment === 'agent') {
    return { sql: agentSql, params: params };
  }
  // 自有流量：未填渠道（NULL/空）或渠道不在代理列表；避免 NOT (NULL IN …) 在 SQL 中恒为 UNKNOWN 导致漏计
  return {
    sql: '(' + col + ' IS NULL OR TRIM(' + col + ') = \'\' OR ' + normCh + ' NOT IN (' + ph + '))',
    params: params
  };
}

function analyticsConversionPct(n, d) {
  if (!d || d <= 0) {
    return null;
  }
  return (Math.round((n / d) * 1000) / 10).toFixed(1) + '%';
}

function buildDailyConversionSeries(days, regMap, actMap) {
  var series = [];
  var todayKey = chinaDateKeyNow();
  var todayParts = todayKey.split('-').map(Number);
  for (var i = 0; i < days; i++) {
    var dt = new Date(todayParts[0], todayParts[1] - 1, todayParts[2] - (days - 1 - i));
    var key = formatDateKey(dt);
    var registered = regMap[key] || 0;
    var activated = actMap[key] || 0;
    var rate = registered > 0 ? activated / registered : null;
    series.push({
      date: key,
      registered: registered,
      activated: activated,
      rate: rate,
      rate_pct: rate == null ? null : analyticsConversionPct(activated, registered)
    });
  }
  var todayRow = series.length ? series[series.length - 1] : { date: todayKey, registered: 0, activated: 0, rate: null, rate_pct: null };
  if (todayRow.date !== todayKey) {
    todayRow = {
      date: todayKey,
      registered: regMap[todayKey] || 0,
      activated: actMap[todayKey] || 0,
      rate: null,
      rate_pct: null
    };
    if (todayRow.registered > 0) {
      todayRow.rate = todayRow.activated / todayRow.registered;
      todayRow.rate_pct = analyticsConversionPct(todayRow.activated, todayRow.registered);
    }
  }
  return { today: todayRow, series: series };
}

async function queryDailyConversionSegment(conn, days, span, admin, segment, agentChannels) {
  var cnUserDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
  var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
  var segUsers = promoSegmentFilter(segment, 'users', agentChannels);
  var segU = promoSegmentFilter(segment, 'u', agentChannels);

  var regWhere = cnUserDay + ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY) AND ' + segUsers.sql;
  var regParams = [span].concat(segUsers.params);
  var actWhere =
    'ac.last_used_at IS NOT NULL AND ac.used_count > 0 AND ' +
    'DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR)) >= DATE_SUB(' +
    cnToday +
    ', INTERVAL ? DAY) AND ' +
    segU.sql;
  var actParams = [span].concat(segU.params);

  if (!admin || !admin.is_super) {
    regWhere +=
      ' AND EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = users.username AND ac.owner_admin_username = ?)';
    regParams.push(admin.username);
    actWhere += ' AND ac.owner_admin_username = ?';
    actParams.push(admin.username);
  }

  const [regRows] = await conn.query(
    'SELECT ' + cnUserDay + ' AS d, COUNT(*) AS cnt FROM users WHERE ' + regWhere + ' GROUP BY ' + cnUserDay,
    regParams
  );
  const [actRows] = await conn.query(
    'SELECT DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR)) AS d, COUNT(DISTINCT ac.used_by_username) AS cnt' +
      ' FROM activation_codes ac' +
      ' INNER JOIN users u ON u.username = ac.used_by_username AND ' +
      userActivationStatsEligibleSql('u.username') +
      ' WHERE ' +
      actWhere +
      ' GROUP BY DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR))',
    actParams
  );

  var regMap = {};
  regRows.forEach(function (r) {
    var k = formatDateKey(r.d);
    if (k) {
      regMap[k] = Number(r.cnt) || 0;
    }
  });
  var actMap = {};
  actRows.forEach(function (r) {
    var k = formatDateKey(r.d);
    if (k) {
      actMap[k] = Number(r.cnt) || 0;
    }
  });
  return buildDailyConversionSeries(days, regMap, actMap);
}

async function queryRegistrationFunnelSegment(conn, days, admin, segment, agentChannels) {
  var cnUserDay = 'DATE(DATE_ADD(u.created_at, INTERVAL 8 HOUR))';
  var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
  var regSince = cnUserDay + ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY)';
  var seg = promoSegmentFilter(segment, 'u', agentChannels);

  var where = [regSince, seg.sql];
  var params = [days - 1].concat(seg.params);
  appendAdminUserScope(where, params, admin, 'u.username');
  var whereSql = ' WHERE ' + where.join(' AND ');

  const [sumRows] = await conn.query(
    `SELECT COUNT(*) AS registered,
            SUM(CASE WHEN EXISTS (
              SELECT 1 FROM activation_codes ac
              WHERE ac.used_by_username = u.username
                AND ac.last_used_at IS NOT NULL
                AND u.activation_refunded_at IS NULL
                AND u.list_hidden_at IS NULL
                AND TIMESTAMPDIFF(HOUR, u.created_at, ac.last_used_at) BETWEEN 0 AND 168
            ) THEN 1 ELSE 0 END) AS activated_7d,
            SUM(CASE WHEN EXISTS (
              SELECT 1 FROM tax_records tr
              WHERE tr.user_id = u.username
                AND tr.deleted_at IS NULL
                AND TIMESTAMPDIFF(HOUR, u.created_at, tr.created_at) BETWEEN 0 AND 168
            ) THEN 1 ELSE 0 END) AS tax_7d,
            SUM(CASE WHEN EXISTS (
              SELECT 1 FROM user_page_events e
              WHERE e.username = u.username
                AND (e.page_path LIKE '%shuiming%' OR e.page_path LIKE '%xiangqing%')
                AND TIMESTAMPDIFF(HOUR, u.created_at, e.created_at) BETWEEN 0 AND 168
            ) THEN 1 ELSE 0 END) AS viewed_detail_7d
     FROM users u` + whereSql,
    params
  );
  var sum = sumRows[0] || {};
  var registered = Number(sum.registered) || 0;
  var activated7 = Number(sum.activated_7d) || 0;
  var tax7 = Number(sum.tax_7d) || 0;
  var detail7 = Number(sum.viewed_detail_7d) || 0;

  const [dayRows] = await conn.query(
    `SELECT ${cnUserDay} AS d,
            COUNT(*) AS registered,
            SUM(CASE WHEN EXISTS (
              SELECT 1 FROM activation_codes ac
              WHERE ac.used_by_username = u.username
                AND ac.last_used_at IS NOT NULL
                AND u.activation_refunded_at IS NULL
                AND u.list_hidden_at IS NULL
                AND TIMESTAMPDIFF(HOUR, u.created_at, ac.last_used_at) BETWEEN 0 AND 168
            ) THEN 1 ELSE 0 END) AS activated_7d,
            SUM(CASE WHEN EXISTS (
              SELECT 1 FROM tax_records tr
              WHERE tr.user_id = u.username
                AND tr.deleted_at IS NULL
                AND TIMESTAMPDIFF(HOUR, u.created_at, tr.created_at) BETWEEN 0 AND 168
            ) THEN 1 ELSE 0 END) AS tax_7d,
            SUM(CASE WHEN EXISTS (
              SELECT 1 FROM user_page_events e
              WHERE e.username = u.username
                AND (e.page_path LIKE '%shuiming%' OR e.page_path LIKE '%xiangqing%')
                AND TIMESTAMPDIFF(HOUR, u.created_at, e.created_at) BETWEEN 0 AND 168
            ) THEN 1 ELSE 0 END) AS viewed_detail_7d
     FROM users u` +
      whereSql +
      ` GROUP BY ${cnUserDay} ORDER BY d ASC`,
    params
  );

  var series = (dayRows || []).map(function (r) {
    var reg = Number(r.registered) || 0;
    var a7 = Number(r.activated_7d) || 0;
    var t7 = Number(r.tax_7d) || 0;
    var v7 = Number(r.viewed_detail_7d) || 0;
    return {
      date: formatDateKey(r.d),
      registered: reg,
      activated_7d: a7,
      tax_7d: t7,
      viewed_detail_7d: v7,
      rate_activate_7d_pct: analyticsConversionPct(a7, reg),
      rate_tax_7d_pct: analyticsConversionPct(t7, reg),
      rate_detail_7d_pct: analyticsConversionPct(v7, reg)
    };
  });

  return {
    summary: {
      registered: registered,
      activated_7d: activated7,
      tax_7d: tax7,
      viewed_detail_7d: detail7,
      rate_activate_7d_pct: analyticsConversionPct(activated7, registered),
      rate_tax_7d_pct: analyticsConversionPct(tax7, registered),
      rate_detail_7d_pct: analyticsConversionPct(detail7, registered),
      rate_tax_of_activated_pct: analyticsConversionPct(tax7, activated7),
      rate_detail_of_tax_pct: analyticsConversionPct(detail7, tax7)
    },
    series: series
  };
}

function tryAuthUserIdFromRequest(req) {
  var auth = req && req.headers ? req.headers.authorization || '' : '';
  var m = /^Bearer\s+(\S+)/i.exec(auth);
  if (!m) {
    return '';
  }
  try {
    var payload = jwt.verify(m[1], JWT_SECRET);
    if (payload.role === 'admin') {
      return '';
    }
    return String(payload.sub || '').trim();
  } catch (e) {
    return '';
  }
}

async function getUserSalesPromoChannel(userId) {
  if (!pool || userId == null || String(userId).trim() === '') {
    return '';
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT sales_promo_channel FROM users WHERE username = ? LIMIT 1', [
      String(userId).trim()
    ]);
    if (!rows.length || rows[0].sales_promo_channel == null) {
      return '';
    }
    return sanitizeSalesChannelId(rows[0].sales_promo_channel);
  } finally {
    conn.release();
  }
}

async function resolveEffectiveSalesChannel(req) {
  var ch = sanitizeSalesChannelId((req.query && (req.query.sales_ch || req.query.ch)) || '');
  if (ch) {
    return ch;
  }
  var uid = tryAuthUserIdFromRequest(req);
  if (uid) {
    ch = await getUserSalesPromoChannel(uid);
    if (ch) {
      return ch;
    }
  }
  try {
    return await resolveSalesChannelForRequest(req);
  } catch (e) {
    return '';
  }
}

async function shouldHideXianyuForRequest(req) {
  var raw = await getInstallPackageSettingsFromDb();
  var hideList = raw.xianyu_hide_channels || [];
  var uid =
    req && req.authUserId != null && String(req.authUserId).trim() !== ''
      ? String(req.authUserId).trim()
      : tryAuthUserIdFromRequest(req);
  if (uid) {
    var userCh = await getUserSalesPromoChannel(uid);
    return shouldHideXianyuForSalesChannel(userCh, hideList);
  }
  var ch = await resolveEffectiveSalesChannel(req);
  return shouldHideXianyuForSalesChannel(ch, hideList);
}

function feedbackConfigPayload(qrRef, hideXianyu, xianyuText) {
  if (hideXianyu) {
    return {
      wechat_pay_qrcode_url: '',
      wechat_pay_qrcode_display_url: '',
      xianyu_purchase_url: '',
      show_xianyu_purchase: false
    };
  }
  var ref = qrRef != null ? String(qrRef).trim() : '';
  var xy = xianyuText != null ? String(xianyuText).trim() : '';
  return {
    wechat_pay_qrcode_url: ref,
    wechat_pay_qrcode_display_url: resolvePublicAssetUrl(ref),
    xianyu_purchase_url: xy,
    show_xianyu_purchase: !!(ref || xy)
  };
}

function readClientIdFromRequest(req) {
  try {
    if (req.clientDevicePayload && req.clientDevicePayload.client_id) {
      return String(req.clientDevicePayload.client_id).trim().substring(0, 128);
    }
  } catch (e) {}
  return '';
}

function deviceModelKeyFromRequest(req) {
  var ex = req.clientDevicePayload;
  if (ex && ex.model) {
    return slugDeviceStatsKey(String(ex.model));
  }
  var ua = normalizeUserAgentHeader(req);
  if (!ua) {
    return '';
  }
  return slugDeviceStatsKey(classifyUserDeviceRow(ua, null).model_label || '');
}

async function recordSalesChannelAttribution(req, salesCh, sourcePage) {
  if (!pool) {
    return;
  }
  var ch = sanitizeSalesChannelId(salesCh);
  if (!ch) {
    return;
  }
  var cid = readClientIdFromRequest(req);
  var fp = sanitizeAuditText(computeDeviceFingerprint(req), 64);
  var ip = sanitizeAuditText(getClientIp(req), 128);
  var ua = sanitizeAuditText(normalizeUserAgentHeader(req), 512);
  var modelKey = deviceModelKeyFromRequest(req);
  var src = sourcePage != null ? String(sourcePage).trim().substring(0, 128) : '';
  var expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  try {
    await pool.execute(
      `INSERT INTO sales_channel_attributions
       (sales_ch, client_id, device_fp, ip, user_agent, device_model, source_page, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ch, cid || null, fp || null, ip || null, ua || null, modelKey || null, src || null, expiresAt]
    );
  } catch (e) {
    console.error('recordSalesChannelAttribution', e);
  }
}

async function resolveSalesChannelForRequest(req) {
  if (!pool) {
    return '';
  }
  var cid = readClientIdFromRequest(req);
  var fp = sanitizeAuditText(computeDeviceFingerprint(req), 64);
  var ip = sanitizeAuditText(getClientIp(req), 128);
  var modelKey = deviceModelKeyFromRequest(req);
  var conn = await pool.getConnection();
  try {
    if (cid) {
      const [rows] = await conn.execute(
        `SELECT sales_ch FROM sales_channel_attributions
         WHERE client_id = ? AND expires_at > UTC_TIMESTAMP(3)
         ORDER BY created_at DESC LIMIT 1`,
        [cid]
      );
      if (rows.length && rows[0].sales_ch) {
        return sanitizeSalesChannelId(rows[0].sales_ch);
      }
    }
    if (fp) {
      const [rowsFp] = await conn.execute(
        `SELECT sales_ch FROM sales_channel_attributions
         WHERE device_fp = ? AND expires_at > UTC_TIMESTAMP(3)
         ORDER BY created_at DESC LIMIT 1`,
        [fp]
      );
      if (rowsFp.length && rowsFp[0].sales_ch) {
        return sanitizeSalesChannelId(rowsFp[0].sales_ch);
      }
    }
    if (ip && modelKey) {
      const [rowsIp] = await conn.execute(
        `SELECT sales_ch FROM sales_channel_attributions
         WHERE ip = ? AND device_model = ? AND expires_at > UTC_TIMESTAMP(3)
           AND created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 7 DAY)
         ORDER BY created_at DESC LIMIT 1`,
        [ip, modelKey]
      );
      if (rowsIp.length && rowsIp[0].sales_ch) {
        return sanitizeSalesChannelId(rowsIp[0].sales_ch);
      }
    }
    if (ip) {
      const [rowsIpOnly] = await conn.execute(
        `SELECT sales_ch FROM sales_channel_attributions
         WHERE ip = ? AND expires_at > UTC_TIMESTAMP(3)
           AND created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 48 HOUR)
         ORDER BY created_at DESC LIMIT 1`,
        [ip]
      );
      if (rowsIpOnly.length && rowsIpOnly[0].sales_ch) {
        return sanitizeSalesChannelId(rowsIpOnly[0].sales_ch);
      }
    }
    return '';
  } finally {
    conn.release();
  }
}

async function getInstallPackageSettingsFromDb() {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN (?, ?, ?, ?, ?, ?, ?)',
      [
        SETTING_KEY_ANDROID_APK,
        SETTING_KEY_AGENT_ANDROID_APK,
        SETTING_KEY_IOS_MOBILECONFIG,
        SETTING_KEY_XIANYU_PURCHASE,
        SETTING_KEY_QQ_ADD_URL,
        SETTING_KEY_QQ_GROUP_URL,
        SETTING_KEY_XIANYU_HIDE_CHANNELS
      ]
    );
    var map = {};
    rows.forEach(function (r) {
      map[r.setting_key] = r.setting_value;
    });
    var android = map[SETTING_KEY_ANDROID_APK] != null ? String(map[SETTING_KEY_ANDROID_APK]).trim() : '';
    var agentAndroid =
      map[SETTING_KEY_AGENT_ANDROID_APK] != null ? String(map[SETTING_KEY_AGENT_ANDROID_APK]).trim() : '';
    var ios = map[SETTING_KEY_IOS_MOBILECONFIG] != null ? String(map[SETTING_KEY_IOS_MOBILECONFIG]).trim() : '';
    var xianyu =
      map[SETTING_KEY_XIANYU_PURCHASE] != null ? String(map[SETTING_KEY_XIANYU_PURCHASE]).trim() : '';
    var qq = map[SETTING_KEY_QQ_ADD_URL] != null ? String(map[SETTING_KEY_QQ_ADD_URL]).trim() : '';
    var qqGroup =
      map[SETTING_KEY_QQ_GROUP_URL] != null ? String(map[SETTING_KEY_QQ_GROUP_URL]).trim() : '';
    var hideChannels = parseXianyuHideSalesChannels(map[SETTING_KEY_XIANYU_HIDE_CHANNELS]);
    return {
      android: android,
      agent_android: agentAndroid,
      ios: ios,
      xianyu: xianyu,
      qq: qq,
      qq_group: qqGroup,
      xianyu_hide_channels: hideChannels
    };
  } finally {
    conn.release();
  }
}

function isDeprecatedMessageHeaderRef(raw) {
  var s = raw != null ? String(raw).trim() : '';
  return !s || s === 'message_header.jpg' || /(^|\/)message_header\.jpg$/i.test(s);
}

function sanitizeMineUiImageRef(raw) {
  if (raw == null) {
    return '';
  }
  var s = String(raw).trim();
  if (s === '' || s.length > 500) {
    return '';
  }
  if (/[\s<>"']/.test(s)) {
    return '';
  }
  if (s.indexOf('..') >= 0) {
    return '';
  }
  if (s.charAt(0) === '/') {
    var tail = s.slice(1);
    if (tail !== '' && /^[a-zA-Z0-9][a-zA-Z0-9_.\-\/]*$/.test(tail)) {
      return s;
    }
    return '';
  }
  if (/^https?:\/\//i.test(s)) {
    if (/^https?:\/\/[^\s'"<>]+$/i.test(s)) {
      return s;
    }
    return '';
  }
  if (/^[a-zA-Z0-9][a-zA-Z0-9_.\-\/]*$/.test(s)) {
    return s;
  }
  return '';
}

async function loadMineUiParsed() {
  if (!pool) {
    return null;
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [SETTING_KEY_MINE_UI]
    );
    if (rows.length === 0 || rows[0].setting_value == null) {
      return null;
    }
    var parsed = JSON.parse(String(rows[0].setting_value));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.error('loadMineUiParsed JSON', e);
    } else {
      console.error('loadMineUiParsed', e);
    }
    return null;
  } finally {
    conn.release();
  }
}

/** 用户端实际生效：勾选「默认配置」时仅内置配图，主题仍读库 */
async function getMineUiForApi() {
  var out = cloneMineUiDefaults();
  var parsed = await loadMineUiParsed();
  if (!parsed) {
    return out;
  }
  if (parsed.theme === 'yellow' || parsed.theme === 'blue') {
    out.theme = parsed.theme;
  }
  if (parsed.use_default_images !== true) {
    MINE_UI_IMAGE_KEYS.forEach(function (k) {
      if (parsed[k] != null) {
        var ok = sanitizeMineUiImageRef(parsed[k]);
        if (ok && !(k === 'message_header' && isDeprecatedMessageHeaderRef(ok))) {
          out[k] = ok;
        }
      }
    });
  }
  if (isDeprecatedMessageHeaderRef(out.message_header)) {
    out.message_header = '';
  }
  MINE_UI_VIDEO_KEYS.forEach(function (k) {
    if (parsed[k] != null) {
      var ok = sanitizeMineUiImageRef(parsed[k]);
      if (ok) {
        out[k] = ok;
      }
    }
  });
  INSTALL_SHOWCASE_IMAGE_KEYS.forEach(function (k) {
    if (parsed[k] != null) {
      var okShow = sanitizeMineUiImageRef(parsed[k]);
      if (okShow) {
        out[k] = okShow;
      }
    }
  });
  return out;
}

/** 管理后台表单：始终返回库中保存的路径与开关（不因默认配图而清空输入框） */
async function getMineUiForAdminForm() {
  var base = cloneMineUiDefaults();
  var form = Object.assign({ use_default_images: false }, base);
  var parsed = await loadMineUiParsed();
  if (!parsed) {
    return form;
  }
  if (parsed.theme === 'yellow' || parsed.theme === 'blue') {
    form.theme = parsed.theme;
  }
  form.use_default_images = parsed.use_default_images === true;
  MINE_UI_IMAGE_KEYS.forEach(function (k) {
    if (parsed[k] != null) {
      var ok = sanitizeMineUiImageRef(parsed[k]);
      if (ok && !(k === 'message_header' && isDeprecatedMessageHeaderRef(ok))) {
        form[k] = ok;
      }
    }
  });
  MINE_UI_VIDEO_KEYS.forEach(function (k) {
    if (parsed[k] != null) {
      var ok = sanitizeMineUiImageRef(parsed[k]);
      if (ok) {
        form[k] = ok;
      }
    }
  });
  INSTALL_SHOWCASE_IMAGE_KEYS.forEach(function (k) {
    if (parsed[k] != null) {
      var okShow = sanitizeMineUiImageRef(parsed[k]);
      if (okShow) {
        form[k] = okShow;
      }
    }
  });
  if (isDeprecatedMessageHeaderRef(form.message_header)) {
    form.message_header = '';
  }
  return form;
}

var ADMIN_UPLOAD_MEDIA_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.m4v', '.webm'];
var ADMIN_UPLOAD_INSTALL_EXT = ['.apk', '.mobileconfig'];

const adminUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
      var ext = path.extname(file.originalname || '').toLowerCase();
      var allow = ADMIN_UPLOAD_MEDIA_EXT.concat(ADMIN_UPLOAD_INSTALL_EXT);
      if (allow.indexOf(ext) < 0) {
        ext = '.bin';
      }
      cb(null, crypto.randomBytes(16).toString('hex') + ext);
    }
  }),
  fileFilter: function (req, file, cb) {
    var ext = path.extname(file.originalname || '').toLowerCase();
    var ok =
      ADMIN_UPLOAD_MEDIA_EXT.indexOf(ext) >= 0 || ADMIN_UPLOAD_INSTALL_EXT.indexOf(ext) >= 0;
    cb(
      ok ? null : new Error('仅支持图片/视频（jpg、png、gif、webp、mp4 等）或安装包（apk、mobileconfig）'),
      ok
    );
  }
});

function handleAdminUploadAsset(req, res) {
  if (!req.file) {
    return res.status(400).json({ code: 400, msg: '未选择文件或扩展名不支持' });
  }
  return res.json({ code: 200, data: { path: 'uploads/' + req.file.filename } });
}

function rowUserTypeIsTest(row) {
  if (!row) return false;
  var t = row.user_type != null ? Number(row.user_type) : 0;
  return t === USER_TYPE_TEST;
}

function getClientIp(req) {
  var xf = req.headers['x-forwarded-for'];
  if (xf) {
    var first = String(xf).split(',')[0].trim();
    if (first) return first.replace(/^::ffff:/, '');
  }
  var rip = req.headers['x-real-ip'];
  if (rip) return String(rip).trim().replace(/^::ffff:/, '');
  var ra = req.socket && req.socket.remoteAddress;
  return ra ? String(ra).replace(/^::ffff:/, '') : '';
}

function cityLabelFromIp(ip) {
  if (!ip) return '—';
  if (ip === '::1' || ip === '127.0.0.1') return '本地';
  var g = geoip.lookup(ip);
  if (!g) return '—';
  if (g.country === 'CN') {
    var c = g.city && String(g.city).trim();
    if (c) return c;
    /* geoip-lite 对大量国内 IP 只有国家、无 city；避免误读成「用户城市就是中国」 */
    var r = g.region && String(g.region).trim();
    if (r) return '中国（' + r + '）';
    return '中国（IP 库无城市）';
  }
  var parts = [];
  if (g.city) parts.push(g.city);
  if (g.country) parts.push(g.country);
  return parts.join(' · ') || '—';
}

/** 设备/登录展示用城市：优先库内 city_last，否则按 IP 推断 */
function resolveDeviceCityLabel(ip, cityStored) {
  var c = cityStored != null ? String(cityStored).trim() : '';
  if (c && c !== '—') return c.substring(0, 255);
  return cityLabelFromIp(ip);
}

async function updateUserLastLoginCity(username, req) {
  try {
    var ip = getClientIp(req);
    var label = cityLabelFromIp(ip);
    const conn = await pool.getConnection();
    try {
      await conn.execute('UPDATE users SET last_login_city = ? WHERE username = ?', [label, username]);
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('updateUserLastLoginCity', e);
  }
}

async function initDatabase() {
  try {
    const conn = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD
    });
    
    await conn.execute(`CREATE DATABASE IF NOT EXISTS ${DB_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.end();
    
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    await createTables();
    registerGuard.initRegisterGuard(pool);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

async function createTables() {
  const conn = await pool.getConnection();
  
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      salt VARCHAR(255) NOT NULL,
      hash VARCHAR(255) NOT NULL,
      real_name VARCHAR(255),
      tax_id VARCHAR(255),
      employer_count INT DEFAULT 0,
      family_count INT DEFAULT 0,
      bank_card_count INT DEFAULT 0,
      gender INT DEFAULT 1,
      watermark_enabled BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS employers (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      company_name VARCHAR(255),
      credit_code VARCHAR(255),
      position VARCHAR(255),
      hire_date VARCHAR(255),
      leave_date VARCHAR(255),
      status VARCHAR(255) DEFAULT '1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS family_members (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      real_name VARCHAR(255) NOT NULL,
      relation VARCHAR(64) NOT NULL,
      id_type VARCHAR(32) NOT NULL DEFAULT 'resident',
      id_type_label VARCHAR(64) NULL,
      id_no VARCHAR(64) NOT NULL,
      birth_date VARCHAR(32) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_family_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS bank_cards (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      card_no VARCHAR(32) NOT NULL,
      bank_name VARCHAR(128) NULL,
      province VARCHAR(64) NULL,
      phone VARCHAR(20) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_bank_cards_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await conn.execute(`
      ALTER TABLE bank_cards ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=默认卡'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS special_deduction_records (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      category VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      related_name VARCHAR(128) NULL,
      last_modified_date DATE NULL,
      filing_source VARCHAR(64) NOT NULL DEFAULT '本人',
      deduction_year INT NOT NULL,
      is_voided TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sdr_user_year (user_id, deduction_year),
      INDEX idx_sdr_user_void (user_id, is_voided)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS shenbao_jilu_records (
      user_id VARCHAR(255) NOT NULL,
      tab VARCHAR(16) NOT NULL,
      id VARCHAR(64) NOT NULL,
      group_month VARCHAR(32) NULL,
      title VARCHAR(255) NULL,
      period_start VARCHAR(32) NULL,
      period_end VARCHAR(32) NULL,
      amount_type VARCHAR(32) NULL,
      amount VARCHAR(64) NULL,
      detail_json MEDIUMTEXT NULL,
      detail_customized TINYINT NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, tab, id),
      INDEX idx_shenbao_user_tab (user_id, tab)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS tax_records (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      year INT,
      month INT,
      income_type VARCHAR(255) DEFAULT '工资薪金',
      income_subtype VARCHAR(255) DEFAULT '正常工资薪金',
      company_name VARCHAR(255),
      company_tax_id VARCHAR(255),
      tax_authority VARCHAR(255),
      report_channel VARCHAR(255) DEFAULT '其他',
      report_date VARCHAR(255),
      tax_period VARCHAR(255),
      income DECIMAL(20, 2) DEFAULT 0,
      tax_reported DECIMAL(20, 2) DEFAULT 0,
      income_this_period DECIMAL(20, 2) DEFAULT 0,
      tax_free_income DECIMAL(20, 2) DEFAULT 0,
      deduction_fee DECIMAL(20, 2) DEFAULT 5000,
      special_deduction DECIMAL(20, 2) DEFAULT 0,
      other_deduction DECIMAL(20, 2) DEFAULT 0,
      donation_deduction DECIMAL(20, 2) DEFAULT 0,
      pension_insurance DECIMAL(20, 2) DEFAULT 0,
      medical_insurance DECIMAL(20, 2) DEFAULT 0,
      unemployment_insurance DECIMAL(20, 2) DEFAULT 0,
      housing_fund DECIMAL(20, 2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_year (year),
      INDEX idx_year_month (year, month)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS tax_record_change_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      record_id VARCHAR(255) NOT NULL,
      action VARCHAR(16) NOT NULL COMMENT 'insert|update|delete',
      before_json JSON NULL,
      after_json JSON NULL,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tax_chg_user_date (user_id, changed_at),
      INDEX idx_tax_chg_record (record_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS tax_issue_applications (
      id VARCHAR(128) NOT NULL,
      user_id VARCHAR(255) NOT NULL COMMENT '账号 username',
      apply_time VARCHAR(64) NULL COMMENT '客户端展示的申请时间',
      period_start VARCHAR(16) NOT NULL,
      period_end VARCHAR(16) NOT NULL,
      record_no VARCHAR(32) NULL,
      scope VARCHAR(64) NULL,
      status VARCHAR(64) NULL,
      query_code VARCHAR(32) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_issue_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      title VARCHAR(500),
      content TEXT,
      company_name VARCHAR(255),
      msg_date VARCHAR(50),
      is_read TINYINT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_msg_date (msg_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN account_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=已激活'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN banned TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=封禁'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN session_rev INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '登录会话版本，封禁递增使旧令牌失效'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN user_type TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=普通 1=测试'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN plain_password VARCHAR(255) NULL COMMENT '原始密码明文'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN register_source_channel VARCHAR(32) NULL COMMENT '注册来源渠道'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }
  try {
    await conn.execute(`
      ALTER TABLE users MODIFY COLUMN register_source_channel VARCHAR(128) NULL COMMENT '注册来源渠道'
    `);
  } catch (e) {
    /* 列不存在或已是目标类型时忽略 */
  }
  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN activation_source_channel VARCHAR(32) NULL COMMENT '激活码渠道（如闲鱼）'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }
  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN sales_promo_channel VARCHAR(64) NULL COMMENT '代理推广渠道 ch'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }
  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN registered_from_install_guide TINYINT(1) NOT NULL DEFAULT 0 COMMENT '注册时上报来自安装页引流'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS activation_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(64) NOT NULL,
      max_uses INT NOT NULL DEFAULT 1,
      used_count INT NOT NULL DEFAULT 0,
      expires_at DATETIME NULL,
      note VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_activation_code (code),
      INDEX idx_activation_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await conn.execute(`
      ALTER TABLE activation_codes ADD COLUMN last_used_at DATETIME NULL COMMENT '最近一次使用时间'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE activation_codes ADD COLUMN used_by_username VARCHAR(255) NULL COMMENT '使用该激活码的用户账号'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE activation_codes ADD COLUMN owner_admin_username VARCHAR(255) NULL COMMENT '生成该激活码的管理账号'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS admin_accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      full_name VARCHAR(255) NULL COMMENT '管理后台账号姓名',
      salt VARCHAR(255) NOT NULL,
      hash VARCHAR(255) NOT NULL,
      is_super TINYINT(1) NOT NULL DEFAULT 0,
      banned TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_admin_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await conn.execute(`
      ALTER TABLE admin_accounts ADD COLUMN full_name VARCHAR(255) NULL COMMENT '管理后台账号姓名'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS admin_account_menus (
      admin_id INT NOT NULL,
      menu_key VARCHAR(64) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (admin_id, menu_key),
      INDEX idx_menu_key (menu_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  var profileCols = [
    "ALTER TABLE users ADD COLUMN id_type VARCHAR(64) NULL COMMENT '证件类型'",
    "ALTER TABLE users ADD COLUMN birth_date VARCHAR(32) NULL COMMENT '出生日期'",
    "ALTER TABLE users ADD COLUMN nationality VARCHAR(128) NULL COMMENT '国籍'",
    "ALTER TABLE users ADD COLUMN huji_area VARCHAR(255) NULL COMMENT '户籍所在地区'",
    "ALTER TABLE users ADD COLUMN huji_detail VARCHAR(512) NULL COMMENT '户籍详细地址'",
    "ALTER TABLE users ADD COLUMN living_area VARCHAR(255) NULL COMMENT '经常居住地地区'",
    "ALTER TABLE users ADD COLUMN living_detail VARCHAR(512) NULL COMMENT '经常居住地详细'",
    "ALTER TABLE users ADD COLUMN contact_area VARCHAR(255) NULL COMMENT '联系地址地区'",
    "ALTER TABLE users ADD COLUMN contact_detail VARCHAR(512) NULL COMMENT '联系地址详细'",
    "ALTER TABLE users ADD COLUMN education VARCHAR(64) NULL COMMENT '学历'",
    "ALTER TABLE users ADD COLUMN ethnicity VARCHAR(64) NULL COMMENT '民族'",
    "ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL COMMENT '电子邮箱'"
  ];
  for (var pi = 0; pi < profileCols.length; pi++) {
    try {
      await conn.execute(profileCols[pi]);
    } catch (e) {
      if (e.errno !== 1060) {
        throw e;
      }
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN last_login_city VARCHAR(255) NULL COMMENT '最近登录城市(根据IP推断)'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  var registerSalaryCols = [
    "ALTER TABLE users ADD COLUMN register_salary_months_json TEXT NULL COMMENT '注册时填写的近6个月工资 JSON 数组'",
    'ALTER TABLE users ADD COLUMN register_avg_salary_6m DECIMAL(12,2) NULL COMMENT \'注册时近6个月平均工资（按已填月份计算）\''
  ];
  for (var rsi = 0; rsi < registerSalaryCols.length; rsi++) {
    try {
      await conn.execute(registerSalaryCols[rsi]);
    } catch (e) {
      if (e.errno !== 1060) {
        throw e;
      }
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN list_hidden_at DATETIME NULL COMMENT '从注册用户列表隐藏时间（软删除）'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN list_hidden_by VARCHAR(255) NULL COMMENT '执行列表隐藏的管理员'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN activation_refunded_at DATETIME NULL COMMENT '激活退款时间，不计入用户数据与激活统计'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN activation_refunded_by VARCHAR(255) NULL COMMENT '执行激活退款的管理员'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
      setting_value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await conn.execute(
    `INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`,
    [SETTING_KEY_TEST_COMPANY, TEST_ACCOUNT_COMPANY_NAME_DEFAULT]
  );
  await conn.execute(
    `INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`,
    [SETTING_KEY_MINE_UI, JSON.stringify(cloneMineUiDefaults())]
  );
  await conn.execute(
    `INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`,
    [SETTING_KEY_ANDROID_APK, 'https://wwalr.lanzoul.com/iWD5L3nszo5e']
  );
  await conn.execute(
    `INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`,
    [SETTING_KEY_IOS_MOBILECONFIG, '/personal.mobileconfig']
  );
  await conn.execute(`INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`, [
    SETTING_KEY_WECHAT_PAY_QRCODE,
    ''
  ]);
  await conn.execute(`INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`, [
    SETTING_KEY_QQ_ADD_URL,
    ''
  ]);
  await conn.execute(`INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`, [
    SETTING_KEY_QQ_GROUP_URL,
    ''
  ]);
  await conn.execute(`INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`, [
    SETTING_KEY_CONVERSION_AB,
    JSON.stringify(DEFAULT_CONVERSION_AB)
  ]);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS analytics_api_daily (
      stat_date DATE NOT NULL,
      route_key VARCHAR(240) NOT NULL,
      biz_category VARCHAR(64) NOT NULL,
      cnt BIGINT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (stat_date, route_key),
      INDEX idx_cat_date (biz_category, stat_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS user_daily_activity (
      activity_date DATE NOT NULL,
      username VARCHAR(255) NOT NULL,
      PRIMARY KEY (activity_date, username),
      INDEX idx_u_d (username, activity_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await registerGuard.ensureRegisterGuardTables(conn);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS user_login_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      ok TINYINT(1) NOT NULL DEFAULT 1,
      reason VARCHAR(120) NULL,
      reason_detail VARCHAR(255) NULL COMMENT '失败时的原始错误信息',
      ip VARCHAR(128) NULL,
      city VARCHAR(255) NULL,
      user_agent VARCHAR(512) NULL,
      device_fp CHAR(64) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_created (created_at),
      INDEX idx_u_created (username, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  try {
    await conn.execute(`
      ALTER TABLE user_login_events ADD COLUMN reason VARCHAR(120) NULL COMMENT '登录结果原因'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }
  try {
    await conn.execute(`
      ALTER TABLE user_login_events ADD COLUMN reason_detail VARCHAR(255) NULL COMMENT '失败时的原始错误信息'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS admin_login_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      admin_username VARCHAR(255) NOT NULL,
      ok TINYINT(1) NOT NULL DEFAULT 1,
      reason VARCHAR(255) NULL,
      ip VARCHAR(128) NULL,
      city VARCHAR(255) NULL,
      user_agent VARCHAR(512) NULL,
      device_fp CHAR(64) NOT NULL,
      device_desc VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_admin_login_created (created_at),
      INDEX idx_admin_login_user_created (admin_username, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS admin_operation_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      admin_username VARCHAR(255) NOT NULL,
      admin_full_name VARCHAR(255) NULL,
      method VARCHAR(16) NOT NULL,
      path VARCHAR(255) NOT NULL,
      route_key VARCHAR(240) NULL,
      action VARCHAR(120) NULL,
      target_username VARCHAR(255) NULL,
      request_brief VARCHAR(1024) NULL,
      ip VARCHAR(128) NULL,
      city VARCHAR(255) NULL,
      user_agent VARCHAR(512) NULL,
      device_fp CHAR(64) NOT NULL,
      device_desc VARCHAR(255) NULL,
      status_code INT NOT NULL DEFAULT 0,
      biz_result_code INT NULL,
      ok TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_admin_op_created (created_at),
      INDEX idx_admin_op_user_created (admin_username, created_at),
      INDEX idx_admin_op_path_created (path, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS user_feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL COMMENT '账号 username',
      real_name_snapshot VARCHAR(255) NULL,
      feedback_type VARCHAR(32) NOT NULL COMMENT 'bug | suggestion',
      content TEXT NOT NULL,
      admin_reply TEXT NULL,
      replied_at DATETIME NULL,
      replied_by VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS user_devices (
      username VARCHAR(255) NOT NULL,
      device_fp CHAR(64) NOT NULL,
      user_agent_short VARCHAR(512) NULL,
      ip_last VARCHAR(128) NULL,
      city_last VARCHAR(255) NULL,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      login_count INT UNSIGNED NOT NULL DEFAULT 0,
      client_id VARCHAR(128) NULL COMMENT '客户端上报唯一 id',
      device_detail_json MEDIUMTEXT NULL COMMENT '最近一次显式上报 JSON',
      api_sync_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '携带设备 JSON 的接口同步次数',
      PRIMARY KEY (username, device_fp),
      INDEX idx_last_seen (last_seen),
      INDEX idx_client_id (username, client_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS user_page_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      page_path VARCHAR(255) NOT NULL,
      route_key VARCHAR(240) NOT NULL,
      client_id VARCHAR(128) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_created (username, created_at),
      INDEX idx_page_created (page_path, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS install_guide_track_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      client_id VARCHAR(128) NULL,
      device_fp CHAR(64) NULL,
      event_key VARCHAR(80) NOT NULL,
      dwell_seconds INT UNSIGNED NULL,
      meta_json VARCHAR(1024) NULL,
      ip VARCHAR(128) NULL,
      user_agent VARCHAR(512) NULL,
      created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_created (created_at),
      INDEX idx_event_created (event_key, created_at),
      INDEX idx_client_created (client_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS sales_channel_attributions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      sales_ch VARCHAR(64) NOT NULL,
      client_id VARCHAR(128) NULL,
      device_fp CHAR(64) NULL,
      ip VARCHAR(128) NULL,
      user_agent VARCHAR(512) NULL,
      device_model VARCHAR(128) NULL,
      source_page VARCHAR(128) NULL,
      created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
      expires_at DATETIME(3) NOT NULL,
      INDEX idx_sc_client_exp (client_id, expires_at),
      INDEX idx_sc_fp_exp (device_fp, expires_at),
      INDEX idx_sc_ip_model_exp (ip, device_model, expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  var devCols = [
    "ALTER TABLE user_devices ADD COLUMN client_id VARCHAR(128) NULL COMMENT '客户端上报唯一 id'",
    'ALTER TABLE user_devices ADD COLUMN device_detail_json MEDIUMTEXT NULL COMMENT \'最近一次显式上报 JSON\'',
    "ALTER TABLE user_devices ADD COLUMN api_sync_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '携带设备 JSON 的接口同步次数'"
  ];
  for (var di = 0; di < devCols.length; di++) {
    try {
      await conn.execute(devCols[di]);
    } catch (e) {
      if (e.errno !== 1060) {
        throw e;
      }
    }
  }
  try {
    await conn.execute('CREATE INDEX idx_client_id ON user_devices (username, client_id)');
  } catch (e) {
    /* 已存在或非致命 */
  }

  try {
    await conn.execute(
      "ALTER TABLE tax_records ADD COLUMN deleted_at DATETIME(3) NULL COMMENT '软删除时间，非空表示在回收站'"
    );
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }
  try {
    await conn.execute('CREATE INDEX idx_tax_user_deleted ON tax_records (user_id, deleted_at)');
  } catch (e) {
    /* 已存在或非致命 */
  }

  var rootAdmin = String(ADMIN_PANEL_USER || 'admin').trim() || 'admin';
  var rootPassword = String(ADMIN_PANEL_PASSWORD || '').trim() || '640810';
  var rootSalt = crypto.randomBytes(16);
  var rootSaltHex = rootSalt.toString('hex');
  var rootHash = hashPasswordWithSalt(rootPassword, rootSalt);
  const [adminRows] = await conn.execute(
    'SELECT id, salt, hash, full_name FROM admin_accounts WHERE username = ? LIMIT 1',
    [rootAdmin]
  );
  var rootAdminId = 0;
  if (!adminRows.length) {
    const [insRoot] = await conn.execute(
      'INSERT INTO admin_accounts (username, full_name, salt, hash, is_super, banned) VALUES (?, ?, ?, ?, 1, 0)',
      [rootAdmin, '系统管理员', rootSaltHex, rootHash]
    );
    rootAdminId = insRoot.insertId ? Number(insRoot.insertId) : 0;
  } else {
    rootAdminId = Number(adminRows[0].id) || 0;
    var keepHash = verifyPasswordBySaltHash(rootPassword, adminRows[0].salt, adminRows[0].hash);
    if (!keepHash) {
      await conn.execute(
        'UPDATE admin_accounts SET full_name = ?, salt = ?, hash = ?, is_super = 1, banned = 0 WHERE id = ?',
        ['系统管理员', rootSaltHex, rootHash, rootAdminId]
      );
    } else {
      await conn.execute('UPDATE admin_accounts SET full_name = ?, is_super = 1, banned = 0 WHERE id = ?', ['系统管理员', rootAdminId]);
    }
  }
  if (rootAdminId > 0) {
    await conn.execute('DELETE FROM admin_account_menus WHERE admin_id = ?', [rootAdminId]);
    for (var mi = 0; mi < ADMIN_MENU_KEYS.length; mi++) {
      await conn.execute(
        'INSERT INTO admin_account_menus (admin_id, menu_key) VALUES (?, ?)',
        [rootAdminId, ADMIN_MENU_KEYS[mi]]
      );
    }
  }

  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT admin_id, 'user-behavior' FROM admin_account_menus WHERE menu_key = 'user-data'`
  );

  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT admin_id, 'activated-user-analysis' FROM admin_account_menus WHERE menu_key = 'user-data'`
  );

  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT admin_id, 'install-guide-stats' FROM admin_account_menus WHERE menu_key = 'analytics'`
  );

  var analyticsSplitMenus = [
    'analytics-conversion',
    'analytics-activity',
    'analytics-register',
    'analytics-tracking',
    'analytics-devices'
  ];
  for (var asi = 0; asi < analyticsSplitMenus.length; asi++) {
    await conn.execute(
      `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
       SELECT admin_id, ? FROM admin_account_menus WHERE menu_key = 'analytics'`,
      [analyticsSplitMenus[asi]]
    );
  }

  conn.release();
}

/** 用户可见的税务记录（未在回收站） */
const TAX_RECORD_NOT_DELETED_SQL = 'deleted_at IS NULL';

async function getRecords(userId, year) {
  const conn = await pool.getConnection();
  let query = 'SELECT * FROM tax_records WHERE user_id = ? AND ' + TAX_RECORD_NOT_DELETED_SQL;
  const params = [userId];
  
  if (year != null && year !== '') {
    query += ' AND year = ?';
    params.push(parseInt(year, 10));
  }
  
  query += ' ORDER BY year DESC, month DESC, (CASE WHEN TRIM(IFNULL(income_subtype,\'\')) = \'全年一次性奖金收入\' THEN 1 ELSE 0 END) ASC, id ASC';
  
  const [rows] = await conn.execute(query, params);
  conn.release();
  
  let income = 0;
  let tax = 0;
  rows.forEach(function (r) {
    income += parseFloat(r.income) || 0;
    tax += parseFloat(r.tax_reported) || 0;
  });
  
  return {
    income_total: income.toFixed(2),
    tax_total: tax.toFixed(2),
    records: rows
  };
}

var TAX_CHANGE_LOG_FIELDS = [
  { key: 'tax_period', label: '税款所属期' },
  { key: 'year', label: '年' },
  { key: 'month', label: '月' },
  { key: 'income_type', label: '所得项目' },
  { key: 'income_subtype', label: '所得小类' },
  { key: 'company_name', label: '扣缴义务人' },
  { key: 'company_tax_id', label: '扣缴义务人纳税人识别号' },
  { key: 'tax_authority', label: '主管税务机关' },
  { key: 'report_channel', label: '申报渠道' },
  { key: 'report_date', label: '申报日期' },
  { key: 'income', label: '收入' },
  { key: 'tax_reported', label: '已申报税额' },
  { key: 'income_this_period', label: '本期收入' },
  { key: 'tax_free_income', label: '本期免税收入' },
  { key: 'deduction_fee', label: '本期减除费用' },
  { key: 'special_deduction', label: '本期专项扣除' },
  { key: 'pension_insurance', label: '基本养老保险' },
  { key: 'medical_insurance', label: '基本医疗保险' },
  { key: 'unemployment_insurance', label: '失业保险' },
  { key: 'housing_fund', label: '住房公积金' },
  { key: 'other_deduction', label: '本期其他扣除' },
  { key: 'donation_deduction', label: '捐赠扣除' }
];

var ADMIN_TAX_RECORD_SELECT_SQL =
  'SELECT id, year, month, income_type, income_subtype, company_name, company_tax_id, tax_authority, ' +
  'report_channel, report_date, tax_period, income, tax_reported, income_this_period, tax_free_income, ' +
  'deduction_fee, special_deduction, other_deduction, donation_deduction, ' +
  'pension_insurance, medical_insurance, unemployment_insurance, housing_fund, created_at, updated_at ' +
  'FROM tax_records';

function mapTaxRecordRowForAdmin(r) {
  if (!r) {
    return null;
  }
  function dec(v) {
    if (v == null || v === '') {
      return '0.00';
    }
    var n = parseFloat(v);
    return isNaN(n) ? String(v) : n.toFixed(2);
  }
  function str(v) {
    return v != null ? String(v) : '';
  }
  return {
    id: str(r.id),
    year: r.year != null ? Number(r.year) : null,
    month: r.month != null ? Number(r.month) : null,
    tax_period: str(r.tax_period),
    income_type: str(r.income_type),
    income_subtype: str(r.income_subtype),
    company_name: str(r.company_name),
    company_tax_id: str(r.company_tax_id),
    tax_authority: str(r.tax_authority),
    report_channel: str(r.report_channel) || '其他',
    report_date: str(r.report_date),
    income: dec(r.income),
    tax_reported: dec(r.tax_reported),
    income_this_period: dec(r.income_this_period),
    tax_free_income: dec(r.tax_free_income),
    deduction_fee: dec(r.deduction_fee),
    special_deduction: dec(r.special_deduction),
    other_deduction: dec(r.other_deduction),
    donation_deduction: dec(r.donation_deduction),
    pension_insurance: dec(r.pension_insurance),
    medical_insurance: dec(r.medical_insurance),
    unemployment_insurance: dec(r.unemployment_insurance),
    housing_fund: dec(r.housing_fund),
    created_at: r.created_at ? r.created_at.toISOString() : '',
    updated_at: r.updated_at ? r.updated_at.toISOString() : ''
  };
}

function taxRecordPayloadToSnapshot(record, recordId) {
  var r = record || {};
  var y = r.year != null ? Number(r.year) : null;
  var m = r.month != null ? Number(r.month) : null;
  var period =
    r.tax_period != null && String(r.tax_period).trim() !== ''
      ? String(r.tax_period).trim()
      : y != null && m != null
        ? y + '-' + String(m).padStart(2, '0')
        : '';
  return {
    id: recordId != null ? String(recordId) : r.id != null ? String(r.id) : '',
    tax_period: period,
    year: y,
    month: m,
    income_type: r.income_type != null ? String(r.income_type) : '',
    income_subtype: r.income_subtype != null ? String(r.income_subtype) : '',
    company_name: r.company_name != null ? String(r.company_name) : '',
    company_tax_id: r.company_tax_id != null ? String(r.company_tax_id) : '',
    tax_authority: r.tax_authority != null ? String(r.tax_authority) : '',
    report_channel: r.report_channel != null ? String(r.report_channel) : '',
    report_date: r.report_date != null ? String(r.report_date) : '',
    income: r.income != null ? String(r.income) : '0',
    tax_reported: r.tax_reported != null ? String(r.tax_reported) : '0',
    income_this_period: r.income_this_period != null ? String(r.income_this_period) : '0',
    tax_free_income: r.tax_free_income != null ? String(r.tax_free_income) : '0',
    deduction_fee: r.deduction_fee != null ? String(r.deduction_fee) : '0',
    special_deduction: r.special_deduction != null ? String(r.special_deduction) : '0',
    other_deduction: r.other_deduction != null ? String(r.other_deduction) : '0',
    donation_deduction: r.donation_deduction != null ? String(r.donation_deduction) : '0',
    pension_insurance: r.pension_insurance != null ? String(r.pension_insurance) : '0',
    medical_insurance: r.medical_insurance != null ? String(r.medical_insurance) : '0',
    unemployment_insurance: r.unemployment_insurance != null ? String(r.unemployment_insurance) : '0',
    housing_fund: r.housing_fund != null ? String(r.housing_fund) : '0'
  };
}

function taxRecordRowToSnapshot(row) {
  if (!row) {
    return null;
  }
  return taxRecordPayloadToSnapshot(row, row.id);
}

function buildTaxChangeFieldDiffs(beforeSnap, afterSnap) {
  var diffs = [];
  TAX_CHANGE_LOG_FIELDS.forEach(function (f) {
    var b = beforeSnap && beforeSnap[f.key] != null ? String(beforeSnap[f.key]) : '';
    var a = afterSnap && afterSnap[f.key] != null ? String(afterSnap[f.key]) : '';
    if (b === a) {
      return;
    }
    diffs.push({
      field: f.key,
      label: f.label,
      before: b,
      after: a
    });
  });
  return diffs;
}

async function insertTaxChangeLog(conn, userId, recordId, action, beforeSnap, afterSnap) {
  try {
    await conn.execute(
      'INSERT INTO tax_record_change_logs (user_id, record_id, action, before_json, after_json) VALUES (?, ?, ?, ?, ?)',
      [
        String(userId),
        String(recordId),
        String(action),
        beforeSnap ? JSON.stringify(beforeSnap) : null,
        afterSnap ? JSON.stringify(afterSnap) : null
      ]
    );
  } catch (e) {
    console.error('insertTaxChangeLog', e);
  }
}

async function loadTaxRecordChangesForUser(conn, username, dateStr) {
  var day = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : chinaDateKeyNow();
  const [rows] = await conn.execute(
    `SELECT id, record_id, action, before_json, after_json, changed_at
     FROM tax_record_change_logs
     WHERE user_id = ? AND DATE(changed_at) = ?
     ORDER BY changed_at DESC
     LIMIT 80`,
    [String(username), day]
  );
  return rows.map(function (r) {
    var beforeSnap = null;
    var afterSnap = null;
    try {
      if (r.before_json) {
        beforeSnap = typeof r.before_json === 'object' ? r.before_json : JSON.parse(String(r.before_json));
      }
    } catch (e1) {}
    try {
      if (r.after_json) {
        afterSnap = typeof r.after_json === 'object' ? r.after_json : JSON.parse(String(r.after_json));
      }
    } catch (e2) {}
    var action = r.action != null ? String(r.action) : 'update';
    return {
      id: Number(r.id),
      record_id: r.record_id != null ? String(r.record_id) : '',
      action: action,
      action_label: action === 'insert' ? '新增' : action === 'delete' ? '删除' : '修改',
      changed_at: r.changed_at ? r.changed_at.toISOString() : '',
      before: beforeSnap,
      after: afterSnap,
      field_diffs: buildTaxChangeFieldDiffs(beforeSnap, afterSnap)
    };
  });
}

async function saveRecordInConn(conn, userId, record) {
  const id = record.id != null ? String(record.id) : 'tr_' + Date.now();

  const [existing] = await conn.execute('SELECT * FROM tax_records WHERE id = ? AND user_id = ?', [
    id,
    userId
  ]);

  if (existing.length > 0) {
    var beforeSnap = taxRecordRowToSnapshot(existing[0]);
    await conn.execute(
      `
      UPDATE tax_records SET
        year = ?, month = ?, income_type = ?, income_subtype = ?,
        company_name = ?, company_tax_id = ?, tax_authority = ?,
        report_channel = ?, report_date = ?, tax_period = ?,
        income = ?, tax_reported = ?, income_this_period = ?,
        tax_free_income = ?, deduction_fee = ?, special_deduction = ?,
        other_deduction = ?, donation_deduction = ?,
        pension_insurance = ?, medical_insurance = ?,
        unemployment_insurance = ?, housing_fund = ?,
        deleted_at = NULL
      WHERE id = ? AND user_id = ?
    `,
      [
        record.year,
        record.month,
        record.income_type || '工资薪金',
        record.income_subtype || '正常工资薪金',
        record.company_name,
        record.company_tax_id,
        record.tax_authority,
        record.report_channel || '其他',
        record.report_date,
        record.tax_period,
        record.income,
        record.tax_reported,
        record.income_this_period,
        record.tax_free_income,
        record.deduction_fee,
        record.special_deduction,
        record.other_deduction,
        record.donation_deduction,
        record.pension_insurance,
        record.medical_insurance,
        record.unemployment_insurance,
        record.housing_fund,
        id,
        userId
      ]
    );
    await insertTaxChangeLog(
      conn,
      userId,
      id,
      'update',
      beforeSnap,
      taxRecordPayloadToSnapshot(record, id)
    );
  } else {
    await conn.execute(
      `
      INSERT INTO tax_records (
        id, user_id, year, month, income_type, income_subtype,
        company_name, company_tax_id, tax_authority,
        report_channel, report_date, tax_period,
        income, tax_reported, income_this_period,
        tax_free_income, deduction_fee, special_deduction,
        other_deduction, donation_deduction,
        pension_insurance, medical_insurance,
        unemployment_insurance, housing_fund
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        userId,
        record.year,
        record.month,
        record.income_type || '工资薪金',
        record.income_subtype || '正常工资薪金',
        record.company_name,
        record.company_tax_id,
        record.tax_authority,
        record.report_channel || '其他',
        record.report_date,
        record.tax_period,
        record.income,
        record.tax_reported,
        record.income_this_period,
        record.tax_free_income,
        record.deduction_fee,
        record.special_deduction,
        record.other_deduction,
        record.donation_deduction,
        record.pension_insurance,
        record.medical_insurance,
        record.unemployment_insurance,
        record.housing_fund
      ]
    );
    await insertTaxChangeLog(conn, userId, id, 'insert', null, taxRecordPayloadToSnapshot(record, id));
  }

  return { id: id };
}

async function saveRecord(userId, record) {
  const conn = await pool.getConnection();
  try {
    return await saveRecordInConn(conn, userId, record);
  } finally {
    conn.release();
  }
}

/** 批量写入专用：若 id 已被本用户活跃记录占用则自动换号；若在回收站则恢复并更新 */
async function insertRecordInConn(conn, userId, record) {
  var preferredId = record.id != null ? String(record.id).trim() : '';
  var base =
    preferredId !== ''
      ? preferredId
      : 'tr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  var id = base;
  var n = 0;
  var idReassigned = false;

  while (true) {
    const [rows] = await conn.execute(
      'SELECT id, deleted_at FROM tax_records WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    if (rows.length === 0) {
      break;
    }
    if (rows[0].deleted_at != null) {
      record.id = id;
      await saveRecordInConn(conn, userId, record);
      return { id: id, id_reassigned: idReassigned };
    }
    n += 1;
    idReassigned = true;
    id = base + '_n' + n;
  }

  await conn.execute(
    `
      INSERT INTO tax_records (
        id, user_id, year, month, income_type, income_subtype,
        company_name, company_tax_id, tax_authority,
        report_channel, report_date, tax_period,
        income, tax_reported, income_this_period,
        tax_free_income, deduction_fee, special_deduction,
        other_deduction, donation_deduction,
        pension_insurance, medical_insurance,
        unemployment_insurance, housing_fund
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      userId,
      record.year,
      record.month,
      record.income_type || '工资薪金',
      record.income_subtype || '正常工资薪金',
      record.company_name,
      record.company_tax_id,
      record.tax_authority,
      record.report_channel || '其他',
      record.report_date,
      record.tax_period,
      record.income,
      record.tax_reported,
      record.income_this_period,
      record.tax_free_income,
      record.deduction_fee,
      record.special_deduction,
      record.other_deduction,
      record.donation_deduction,
      record.pension_insurance,
      record.medical_insurance,
      record.unemployment_insurance,
      record.housing_fund
    ]
  );
  await insertTaxChangeLog(conn, userId, id, 'insert', null, taxRecordPayloadToSnapshot(record, id));
  return {
    id: id,
    id_reassigned: idReassigned
  };
}

async function batchSaveRecords(userId, records) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const saved = [];
    var reassigned = 0;
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (!rec || typeof rec !== 'object') {
        throw new Error('第 ' + (i + 1) + ' 条记录无效');
      }
      const out = await insertRecordInConn(conn, userId, rec);
      if (out.id_reassigned) {
        reassigned += 1;
      }
      saved.push(out);
    }
    await conn.commit();
    var dedupeOut = await dedupeTaxRecords(userId);
    return {
      saved: saved.length,
      ids: saved.map(function (x) {
        return x.id;
      }),
      reassigned_ids: reassigned,
      auto_deduped: dedupeOut.deleted != null ? dedupeOut.deleted : 0
    };
  } catch (e) {
    try {
      await conn.rollback();
    } catch (e2) {}
    throw e;
  } finally {
    conn.release();
  }
}

async function deleteRecordInConn(conn, userId, id) {
  const [rows] = await conn.execute('SELECT * FROM tax_records WHERE id = ? AND user_id = ? AND ' + TAX_RECORD_NOT_DELETED_SQL, [
    id,
    userId
  ]);
  if (rows.length) {
    await insertTaxChangeLog(conn, userId, id, 'delete', taxRecordRowToSnapshot(rows[0]), null);
    await conn.execute('UPDATE tax_records SET deleted_at = NOW(3) WHERE id = ? AND user_id = ?', [id, userId]);
  }
}

async function deleteRecord(userId, id) {
  const conn = await pool.getConnection();
  try {
    await deleteRecordInConn(conn, userId, id);
  } finally {
    conn.release();
  }
}

/** 批量替换：事务内先删指定 id，再写入新记录（用于批量修改税务数据） */
async function batchReplaceTaxRecords(userId, idsToDelete, records) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const ids = Array.isArray(idsToDelete) ? idsToDelete : [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i] != null ? String(ids[i]).trim() : '';
      if (!id) continue;
      await deleteRecordInConn(conn, userId, id);
    }
    const saved = [];
    var reassigned = 0;
    for (let j = 0; j < records.length; j++) {
      const rec = records[j];
      if (!rec || typeof rec !== 'object') {
        throw new Error('第 ' + (j + 1) + ' 条记录无效');
      }
      const out = await insertRecordInConn(conn, userId, rec);
      if (out.id_reassigned) {
        reassigned += 1;
      }
      saved.push(out);
    }
    await conn.commit();
    var dedupeOut = await dedupeTaxRecords(userId);
    return {
      deleted: ids.filter(function (x) {
        return x != null && String(x).trim() !== '';
      }).length,
      saved: saved.length,
      ids: saved.map(function (x) {
        return x.id;
      }),
      reassigned_ids: reassigned,
      auto_deduped: dedupeOut.deleted != null ? dedupeOut.deleted : 0
    };
  } catch (e) {
    try {
      await conn.rollback();
    } catch (e2) {}
    throw e;
  } finally {
    conn.release();
  }
}

async function deleteAllRecords(userId) {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'UPDATE tax_records SET deleted_at = NOW(3) WHERE user_id = ? AND ' + TAX_RECORD_NOT_DELETED_SQL,
      [userId]
    );
    return { deleted: result.affectedRows != null ? Number(result.affectedRows) : 0 };
  } finally {
    conn.release();
  }
}

async function deleteRecordsByYear(userId, year) {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'UPDATE tax_records SET deleted_at = NOW(3) WHERE user_id = ? AND year = ? AND ' + TAX_RECORD_NOT_DELETED_SQL,
      [userId, year]
    );
    return { deleted: result.affectedRows != null ? Number(result.affectedRows) : 0 };
  } finally {
    conn.release();
  }
}

async function deleteRecordsByCompany(userId, companyName) {
  const name = companyName != null ? String(companyName).trim() : '';
  if (!name) {
    return { deleted: 0 };
  }
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'UPDATE tax_records SET deleted_at = NOW(3) WHERE user_id = ? AND TRIM(company_name) = ? AND ' +
        TAX_RECORD_NOT_DELETED_SQL,
      [userId, name]
    );
    return { deleted: result.affectedRows != null ? Number(result.affectedRows) : 0 };
  } finally {
    conn.release();
  }
}

/** 去重分组键：同扣缴单位 + 同年同月 + 同所得小类（工资与年终奖分开） */
function taxRecordDedupeGroupKey(r) {
  var company = r.company_name != null ? String(r.company_name).trim() : '';
  var subtype = r.income_subtype != null ? String(r.income_subtype).trim() : '正常工资薪金';
  if (!subtype) {
    subtype = '正常工资薪金';
  }
  return String(r.year || '') + '|' + String(r.month || '') + '|' + company + '|' + subtype;
}

/** 同一扣缴单位 + 同年同月 + 同所得小类重复记录：保留最新一条，删除较早的 */
async function dedupeTaxRecords(userId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT id, year, month, company_name, income_subtype, created_at FROM tax_records WHERE user_id = ? AND ' +
        TAX_RECORD_NOT_DELETED_SQL +
        ' ORDER BY year ASC, month ASC, TRIM(company_name) ASC, income_subtype ASC, created_at ASC, id ASC',
      [userId]
    );
    var groups = {};
    (rows || []).forEach(function (r) {
      var key = taxRecordDedupeGroupKey(r);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(r);
    });
    var idsToDelete = [];
    Object.keys(groups).forEach(function (key) {
      var g = groups[key];
      if (g.length <= 1) {
        return;
      }
      for (var i = 0; i < g.length - 1; i++) {
        idsToDelete.push(g[i].id);
      }
    });
    if (!idsToDelete.length) {
      return { deleted: 0 };
    }
    await conn.beginTransaction();
    try {
      for (var j = 0; j < idsToDelete.length; j++) {
        await deleteRecordInConn(conn, userId, idsToDelete[j]);
      }
      await conn.commit();
      return { deleted: idsToDelete.length };
    } catch (e) {
      await conn.rollback();
      throw e;
    }
  } finally {
    conn.release();
  }
}

async function getTaxRecordById(userId, id, opts) {
  opts = opts || {};
  const conn = await pool.getConnection();
  var sql = 'SELECT * FROM tax_records WHERE id = ? AND user_id = ?';
  if (!opts.includeDeleted) {
    sql += ' AND ' + TAX_RECORD_NOT_DELETED_SQL;
  }
  const [rows] = await conn.execute(sql, [id, userId]);
  conn.release();
  return rows.length > 0 ? rows[0] : null;
}

function mapTaxRecordRowForClient(r) {
  if (!r) {
    return null;
  }
  return {
    id: r.id != null ? String(r.id) : '',
    user_id: r.user_id != null ? String(r.user_id) : '',
    year: r.year != null ? Number(r.year) : null,
    month: r.month != null ? Number(r.month) : null,
    income_type: r.income_type != null ? String(r.income_type) : '',
    income_subtype: r.income_subtype != null ? String(r.income_subtype) : '',
    company_name: r.company_name != null ? String(r.company_name) : '',
    company_tax_id: r.company_tax_id != null ? String(r.company_tax_id) : '',
    tax_authority: r.tax_authority != null ? String(r.tax_authority) : '',
    report_channel: r.report_channel != null ? String(r.report_channel) : '',
    report_date: r.report_date != null ? String(r.report_date) : '',
    tax_period: r.tax_period != null ? String(r.tax_period) : '',
    income: r.income != null ? String(r.income) : '0',
    tax_reported: r.tax_reported != null ? String(r.tax_reported) : '0',
    income_this_period: r.income_this_period != null ? String(r.income_this_period) : '0',
    tax_free_income: r.tax_free_income != null ? String(r.tax_free_income) : '0',
    deduction_fee: r.deduction_fee != null ? String(r.deduction_fee) : '0',
    special_deduction: r.special_deduction != null ? String(r.special_deduction) : '0',
    other_deduction: r.other_deduction != null ? String(r.other_deduction) : '0',
    donation_deduction: r.donation_deduction != null ? String(r.donation_deduction) : '0',
    pension_insurance: r.pension_insurance != null ? String(r.pension_insurance) : '0',
    medical_insurance: r.medical_insurance != null ? String(r.medical_insurance) : '0',
    unemployment_insurance: r.unemployment_insurance != null ? String(r.unemployment_insurance) : '0',
    housing_fund: r.housing_fund != null ? String(r.housing_fund) : '0',
    created_at: r.created_at ? r.created_at.toISOString() : '',
    updated_at: r.updated_at ? r.updated_at.toISOString() : '',
    deleted_at: r.deleted_at ? r.deleted_at.toISOString() : ''
  };
}

async function getDeletedTaxRecords(userId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT * FROM tax_records WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC, year DESC, month DESC, id ASC',
      [userId]
    );
    return rows.map(mapTaxRecordRowForClient);
  } finally {
    conn.release();
  }
}

async function restoreTaxRecord(userId, id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      'SELECT * FROM tax_records WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL LIMIT 1',
      [id, userId]
    );
    if (!rows.length) {
      await conn.rollback();
      return { restored: false };
    }
    await conn.execute('UPDATE tax_records SET deleted_at = NULL, updated_at = NOW(3) WHERE id = ? AND user_id = ?', [
      id,
      userId
    ]);
    await insertTaxChangeLog(
      conn,
      userId,
      id,
      'insert',
      null,
      taxRecordPayloadToSnapshot(mapTaxRecordRowForClient(rows[0]), id)
    );
    await conn.commit();
    return { restored: true, id: id };
  } catch (e) {
    try {
      await conn.rollback();
    } catch (e2) {}
    throw e;
  } finally {
    conn.release();
  }
}

async function restoreAllDeletedTaxRecords(userId) {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'UPDATE tax_records SET deleted_at = NULL, updated_at = NOW(3) WHERE user_id = ? AND deleted_at IS NOT NULL',
      [userId]
    );
    return { restored: result.affectedRows != null ? Number(result.affectedRows) : 0 };
  } finally {
    conn.release();
  }
}

async function restoreRecordsByCompany(userId, companyName) {
  const name = companyName != null ? String(companyName).trim() : '';
  if (!name) {
    return { restored: 0 };
  }
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'UPDATE tax_records SET deleted_at = NULL, updated_at = NOW(3) WHERE user_id = ? AND TRIM(company_name) = ? AND deleted_at IS NOT NULL',
      [userId, name]
    );
    return { restored: result.affectedRows != null ? Number(result.affectedRows) : 0 };
  } finally {
    conn.release();
  }
}

function formatTaxAmt(v, defaultStr) {
  if (v == null || v === '') return defaultStr;
  const n = parseFloat(String(v).replace(/,/g, ''));
  if (Number.isNaN(n)) return defaultStr;
  return n.toFixed(2);
}

/** 全年一次性奖金单独计税：按「应纳税所得额÷12」对照月度税率表（与前端 consult 写入逻辑一致） */
function yearEndBonusSeparateTaxFromTaxable(taxable) {
  const t = Math.max(0, Number(taxable) || 0);
  if (t <= 0) {
    return {
      taxable_income: '0.00',
      tax_rate: '0%',
      quick_deduction: '0.00',
      tax_payable: '0.00'
    };
  }
  const monthlyEq = t / 12;
  const brackets = [
    { max: 3000, rate: 0.03, qd: 0 },
    { max: 12000, rate: 0.1, qd: 210 },
    { max: 25000, rate: 0.2, qd: 1410 },
    { max: 35000, rate: 0.25, qd: 2660 },
    { max: 55000, rate: 0.3, qd: 4410 },
    { max: 80000, rate: 0.35, qd: 7160 },
    { max: Infinity, rate: 0.45, qd: 15160 }
  ];
  for (let i = 0; i < brackets.length; i++) {
    if (monthlyEq <= brackets[i].max) {
      const br = brackets[i];
      const payable = Math.max(0, Math.round((t * br.rate - br.qd) * 100) / 100);
      return {
        taxable_income: t.toFixed(2),
        tax_rate: (br.rate * 100).toFixed(2) + '%',
        quick_deduction: br.qd.toFixed(2),
        tax_payable: payable.toFixed(2)
      };
    }
  }
  return {
    taxable_income: t.toFixed(2),
    tax_rate: '0%',
    quick_deduction: '0.00',
    tax_payable: '0.00'
  };
}

/** 居民个人工资薪金累计预扣预缴适用税率表（简化） */
function iitWithholdingBracket(cumulativeTaxable) {
  const x = Math.max(0, Number(cumulativeTaxable) || 0);
  if (x <= 36000) return { ratePct: 3, quick: 0, rateStr: '3%' };
  if (x <= 144000) return { ratePct: 10, quick: 2520, rateStr: '10%' };
  if (x <= 300000) return { ratePct: 20, quick: 16920, rateStr: '20%' };
  if (x <= 420000) return { ratePct: 25, quick: 31920, rateStr: '25%' };
  if (x <= 660000) return { ratePct: 30, quick: 52920, rateStr: '30%' };
  if (x <= 960000) return { ratePct: 35, quick: 85920, rateStr: '35%' };
  return { ratePct: 45, quick: 181920, rateStr: '45%' };
}

function sumRowMoney(r, field) {
  const v = r[field];
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

/** 基本减除 5000 与专项附加扣除拆分（旧数据曾把专项附加并入 deduction_fee） */
function splitBasicAndSpecialAdditionalDeduction(rec) {
  const sub = String(rec.income_subtype || '').trim();
  if (sub === '全年一次性奖金收入') {
    return { basic: sumRowMoney(rec, 'deduction_fee'), specialAdditional: 0 };
  }
  const df = sumRowMoney(rec, 'deduction_fee');
  const other = sumRowMoney(rec, 'other_deduction');
  if (other > 0) {
    return {
      basic: Math.min(5000, df > 0 ? df : 5000),
      specialAdditional: other
    };
  }
  if (df > 5000) {
    const sadd = Math.max(0, Math.round((df - 5000) * 100) / 100);
    return { basic: Math.round((df - sadd) * 100) / 100, specialAdditional: sadd };
  }
  return { basic: df, specialAdditional: 0 };
}

function rowPeriodIncome(r) {
  if (r.income_this_period != null && String(r.income_this_period).trim() !== '') {
    return sumRowMoney(r, 'income_this_period');
  }
  return sumRowMoney(r, 'income');
}

async function getTaxCalculationData(userId, recordId) {
  const anchor = await getTaxRecordById(userId, recordId);
  if (!anchor) return null;
  const year = anchor.year != null ? parseInt(anchor.year, 10) : null;
  const month = anchor.month != null ? parseInt(anchor.month, 10) : null;

  const conn = await pool.getConnection();
  let rows;
  try {
    if (year == null || Number.isNaN(year)) {
      rows = [anchor];
    } else if (month == null || Number.isNaN(month)) {
      const [r2] = await conn.execute(
        'SELECT * FROM tax_records WHERE user_id = ? AND year = ? AND ' +
          TAX_RECORD_NOT_DELETED_SQL +
          ' ORDER BY month ASC, id ASC',
        [String(userId), year]
      );
      rows = r2;
    } else {
      const ct = anchor.company_tax_id != null ? String(anchor.company_tax_id).trim() : '';
      if (ct) {
        const [r2] = await conn.execute(
          `SELECT * FROM tax_records WHERE user_id = ? AND year = ? AND month IS NOT NULL AND month <= ? AND TRIM(IFNULL(company_tax_id,'')) = ? AND ${TAX_RECORD_NOT_DELETED_SQL} ORDER BY month ASC, id ASC`,
          [String(userId), year, month, ct]
        );
        rows = r2;
        if (rows.length === 0) {
          const [r3] = await conn.execute(
            `SELECT * FROM tax_records WHERE user_id = ? AND year = ? AND month IS NOT NULL AND month <= ? AND ${TAX_RECORD_NOT_DELETED_SQL} ORDER BY month ASC, id ASC`,
            [String(userId), year, month]
          );
          rows = r3;
        }
      } else {
        const [r2] = await conn.execute(
          `SELECT * FROM tax_records WHERE user_id = ? AND year = ? AND month IS NOT NULL AND month <= ? AND ${TAX_RECORD_NOT_DELETED_SQL} ORDER BY month ASC, id ASC`,
          [String(userId), year, month]
        );
        rows = r2;
      }
    }
  } finally {
    conn.release();
  }

  if (!rows || rows.length === 0) {
    rows = [anchor];
  }

  let totalIncome = 0;
  let totalTaxFree = 0;
  let totalDeductionFee = 0;
  let totalSpecial = 0;
  let totalOther = 0;
  let totalDonation = 0;
  let totalTaxPaidBefore = 0;
  /** 累计减除费用（基本减除 5000）与累计专项附加扣除（other_deduction，旧数据从 deduction_fee 拆分） */
  let totalBasicDeductionFee = 0;
  let totalSpecialAdditionalFromFee = 0;
  const anchorMonth = month != null && !Number.isNaN(month) ? month : null;

  rows.forEach(function (r) {
    totalIncome += rowPeriodIncome(r);
    totalTaxFree += sumRowMoney(r, 'tax_free_income');
    const split = splitBasicAndSpecialAdditionalDeduction(r);
    totalDeductionFee += sumRowMoney(r, 'deduction_fee');
    totalSpecial += sumRowMoney(r, 'special_deduction');
    totalOther += sumRowMoney(r, 'other_deduction');
    totalDonation += sumRowMoney(r, 'donation_deduction');
    const sub = String(r.income_subtype || '').trim();
    if (sub !== '全年一次性奖金收入') {
      totalSpecialAdditionalFromFee += split.specialAdditional;
      totalBasicDeductionFee += split.basic;
    }
    const m = r.month != null ? parseInt(r.month, 10) : null;
    if (anchorMonth != null && m != null && !Number.isNaN(m) && m < anchorMonth) {
      totalTaxPaidBefore += sumRowMoney(r, 'tax_reported');
    }
  });

  const totalSpecialAdditional = totalSpecialAdditionalFromFee;
  const totalPersonalPension = 0;

  const taxable =
    totalIncome -
    totalTaxFree -
    totalDeductionFee -
    totalSpecial -
    totalOther -
    totalPersonalPension -
    totalDonation;
  const totalTaxableIncome = Math.max(0, taxable);

  const br = iitWithholdingBracket(totalTaxableIncome);
  const totalTaxPayable = Math.max(0, (totalTaxableIncome * br.ratePct) / 100 - br.quick);

  const currentTaxReported = sumRowMoney(anchor, 'tax_reported');

  return {
    total_income: totalIncome.toFixed(2),
    total_tax_free_income: totalTaxFree.toFixed(2),
    total_deduction_fee: totalBasicDeductionFee.toFixed(2),
    total_special_deduction: totalSpecial.toFixed(2),
    total_special_additional: totalSpecialAdditional.toFixed(2),
    total_other_deduction: totalOther.toFixed(2),
    total_personal_pension: totalPersonalPension.toFixed(2),
    total_donation: totalDonation.toFixed(2),
    total_taxable_income: totalTaxableIncome.toFixed(2),
    tax_rate: br.rateStr,
    quick_deduction: br.quick.toFixed(2),
    total_tax_payable: totalTaxPayable.toFixed(2),
    total_tax_paid: totalTaxPaidBefore.toFixed(2),
    total_tax_relief: '0.00',
    current_tax_reported: currentTaxReported.toFixed(2)
  };
}

function formatTaxDetailResponse(rec, userIdStr) {
  const y = rec.year != null ? parseInt(rec.year, 10) : null;
  const m = rec.month != null ? parseInt(rec.month, 10) : null;
  let taxPeriod = rec.tax_period;
  if (!taxPeriod && y != null && m != null) {
    taxPeriod = y + '-' + (m < 10 ? '0' + m : String(m));
  }
  const base = {
    id: rec.id,
    admin_id: 0,
    user_id: userIdStr,
    year: y,
    month: m,
    income_type: rec.income_type || '工资薪金',
    income_subtype: rec.income_subtype || '正常工资薪金',
    company_name: rec.company_name || '',
    company_tax_id: rec.company_tax_id || '',
    tax_authority: rec.tax_authority || '',
    report_channel: rec.report_channel || '其他',
    report_date: rec.report_date || '',
    tax_period: taxPeriod || '',
    income: formatTaxAmt(rec.income, '0.00'),
    tax_reported: formatTaxAmt(rec.tax_reported, '0.00'),
    income_this_period: formatTaxAmt(rec.income_this_period, '0.00'),
    tax_free_income: formatTaxAmt(rec.tax_free_income, '0.00'),
    deduction_fee: (function () {
      var sp = splitBasicAndSpecialAdditionalDeduction(rec);
      return formatTaxAmt(sp.basic, '5000.00');
    })(),
    special_deduction: formatTaxAmt(rec.special_deduction, '0.00'),
    other_deduction: (function () {
      var sp = splitBasicAndSpecialAdditionalDeduction(rec);
      return formatTaxAmt(sp.specialAdditional, '0.00');
    })(),
    donation_deduction: formatTaxAmt(rec.donation_deduction, '0.00'),
    pension_insurance: formatTaxAmt(rec.pension_insurance, '0.00'),
    medical_insurance: formatTaxAmt(rec.medical_insurance, '0.00'),
    unemployment_insurance: formatTaxAmt(rec.unemployment_insurance, '0.00'),
    housing_fund: formatTaxAmt(rec.housing_fund, '0.00'),
    created_at: rec.created_at ? rec.created_at.toISOString() : '',
    updated_at: rec.updated_at ? rec.updated_at.toISOString() : ''
  };
  if (String(rec.income_subtype || '').trim() === '全年一次性奖金收入') {
    const gross = rowPeriodIncome(rec);
    const taxableRaw =
      gross -
      sumRowMoney(rec, 'tax_free_income') -
      sumRowMoney(rec, 'deduction_fee') -
      sumRowMoney(rec, 'special_deduction') -
      sumRowMoney(rec, 'other_deduction') -
      sumRowMoney(rec, 'donation_deduction');
    const taxable = Math.max(0, Math.round(taxableRaw * 100) / 100);
    const bt = yearEndBonusSeparateTaxFromTaxable(taxable);
    base.bonus_tax = {
      taxable_income: bt.taxable_income,
      tax_rate: bt.tax_rate,
      quick_deduction: bt.quick_deduction,
      tax_payable: bt.tax_payable,
      tax_relief: '0.00',
      tax_paid: '0.00',
      tax_declared: formatTaxAmt(rec.tax_reported, '0.00')
    };
  }
  return base;
}

function hashPassword(password, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function validateUsername(u) {
  if (!u || typeof u !== 'string') return '账号不能为空';
  u = u.trim();
  if (u.length === 0) return '账号不能为空';
  if (u.length > 32) return '账号长度为 1～32 位';
  if (!/^[\dA-Za-z@._-]+$/.test(u)) return '账号仅支持数字、字母及 . _ - @';
  return null;
}

/** 常见 SQL 注入探测串（作密码提交时仅记录为明文，不执行；注册/改密时拒绝） */
function passwordLooksLikeSqlProbe(p) {
  if (!p || typeof p !== 'string') return false;
  var s = p.toLowerCase().replace(/\s+/g, ' ');
  if (/\bselect\b[\s\S]*\bfrom\b/.test(s)) return true;
  if (/\bunion\b[\s\S]*\bselect\b/.test(s)) return true;
  if (/\binsert\b[\s\S]*\binto\b/.test(s)) return true;
  if (/\bdelete\b[\s\S]*\bfrom\b/.test(s)) return true;
  if (/\bdrop\b[\s\S]*\btable\b/.test(s)) return true;
  if (/\bupdate\b[\s\S]*\bset\b/.test(s)) return true;
  if (/\bor\s+['"]?\d+['"]?\s*=\s*['"]?\d+/.test(s)) return true;
  if (/'\s*or\s*'|"\s*or\s*"/.test(s)) return true;
  if (/--\s*$|;\s*--/.test(s)) return true;
  return false;
}

function validatePassword(p) {
  if (!p || typeof p !== 'string') return '密码不能为空';
  if (p.length < 1 || p.length > 64) return '密码长度为 1～64 位';
  if (passwordLooksLikeSqlProbe(p)) return '密码包含不允许的内容';
  return null;
}

function mergeUserRiskInfo(ipDistinctCount, deviceCount, plainPassword) {
  var info = computeUserLoginRisk(ipDistinctCount, deviceCount);
  if (passwordLooksLikeSqlProbe(plainPassword)) {
    info = {
      distinct_ip_count: info.distinct_ip_count,
      device_count: info.device_count,
      risk: true,
      risk_messages: info.risk_messages.concat(['可疑密码(SQL探测)'])
    };
  }
  return info;
}

function userSessionRevFromRow(rec) {
  if (!rec || rec.session_rev == null) return 0;
  return Number(rec.session_rev) || 0;
}

function signAccessToken(userPayload) {
  var uid = userPayload.user_id != null ? String(userPayload.user_id) : String(userPayload.username || '');
  var act =
    userPayload.account_active === true ||
    userPayload.account_active === 1 ||
    userPayload.account_active === '1'
      ? 1
      : 0;
  var srv = userPayload.session_rev != null ? Number(userPayload.session_rev) : 0;
  if (!srv || srv < 0) srv = 0;
  return jwt.sign({ sub: uid, act: act, srv: srv }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

async function getUserRowByUsername(username) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT * FROM users WHERE username = ?', [username]);
    return rows.length ? rows[0] : null;
  } finally {
    conn.release();
  }
}

async function recoverCredentialsByActivationCode(rawCode) {
  var code = String(rawCode || '').trim().toUpperCase();
  if (!code) {
    throw new Error('请输入激活码');
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT ac.used_count, ac.used_by_username, u.plain_password, u.real_name FROM activation_codes ac ' +
        'LEFT JOIN users u ON u.username = ac.used_by_username WHERE ac.code = ? LIMIT 1',
      [code]
    );
    if (rows.length === 0) {
      throw new Error('激活码无效');
    }
    var r = rows[0];
    if (Number(r.used_count) < 1 || !r.used_by_username) {
      throw new Error('该激活码尚未绑定账号，无法找回。请确认是否为已用于激活的激活码。');
    }
    var pwd = r.plain_password != null ? String(r.plain_password) : '';
    if (!pwd) {
      throw new Error('已找到账号但无法显示密码，请联系管理员协助重置。');
    }
    return {
      username: String(r.used_by_username),
      password: pwd,
      real_name: r.real_name != null ? String(r.real_name) : ''
    };
  } finally {
    conn.release();
  }
}

async function applyActivationCode(username, rawCode) {
  var code = String(rawCode || '').trim().toUpperCase();
  if (!code) {
    throw new Error('请输入激活码');
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      'SELECT id, max_uses, used_count, note FROM activation_codes WHERE code = ? FOR UPDATE',
      [code]
    );
    if (rows.length === 0) {
      await conn.rollback();
      throw new Error('激活码无效');
    }
    var r = rows[0];
    if (Number(r.used_count) >= Number(r.max_uses)) {
      await conn.rollback();
      throw new Error('激活码已用完');
    }
    var actChannel = activationSourceFromCodeNote(r.note);
    await conn.execute(
      'UPDATE activation_codes SET used_count = used_count + 1, last_used_at = CURRENT_TIMESTAMP, used_by_username = ? WHERE id = ?',
      [username, r.id]
    );
    if (actChannel) {
      await conn.execute(
        'UPDATE users SET account_active = 1, activation_source_channel = ? WHERE username = ?',
        [actChannel, username]
      );
    } else {
      await conn.execute('UPDATE users SET account_active = 1 WHERE username = ?', [username]);
    }
    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch (e2) {}
    throw e;
  } finally {
    conn.release();
  }
}

async function requireActivated(req, res, next) {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      'SELECT account_active FROM users WHERE username = ? LIMIT 1',
      [req.authUserId]
    );
    conn.release();
    if (rows.length === 0) {
      return res.status(403).json({ code: 403, msg: '账号异常', need_activation: true });
    }
    var a = rows[0].account_active;
    if (a === 1 || a === true) {
      return next();
    }
    return res.status(403).json({ code: 403, msg: '账号未激活', need_activation: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

function normalizeUserApiPath(req) {
  var p = req.path || '';
  if (!p && req.url) {
    p = String(req.url).split('?')[0];
  }
  return p.replace(/\/+$/, '') || '/';
}

/** 未激活账号仍可访问：tax.php 个税生成/演示、user.php 全部资料读写（不含激活/去水印）、埋点 track_*、反馈 feedback.php、message.php 列表/详情 */
function isUnactivatedAllowedRequest(req) {
  var path = normalizeUserApiPath(req);
  if (path.endsWith('/feedback.php') || path.endsWith('/tax.php')) {
    return true;
  }
  if (path.endsWith('/user.php')) {
    return true;
  }
  if (path.endsWith('/message.php') && req.method === 'GET') {
    var msgAction = req.query && req.query.action != null ? String(req.query.action) : '';
    if (msgAction === 'list' || msgAction === 'detail') {
      return true;
    }
  }
  if (req.method === 'POST') {
    var action = req.body && req.body.action != null ? String(req.body.action) : '';
    if (/^track_[a-z0-9_]{1,80}$/i.test(action)) {
      return true;
    }
  }
  return false;
}

function requireAuthAndActivatedUnlessAllowed(req, res, next) {
  requireAuth(req, res, function () {
    if (isUnactivatedAllowedRequest(req)) {
      return next();
    }
    requireActivated(req, res, next);
  });
}

function signAdminToken(username) {
  return jwt.sign({ role: 'admin', sub: String(username || '') }, JWT_SECRET, { expiresIn: '12h' });
}

async function loadAdminAccountByUsername(conn, username) {
  const [rows] = await conn.execute(
    'SELECT id, username, full_name, salt, hash, is_super, banned, created_at FROM admin_accounts WHERE username = ? LIMIT 1',
    [username]
  );
  if (!rows.length) {
    return null;
  }
  var row = rows[0];
  const [menuRows] = await conn.execute(
    'SELECT menu_key FROM admin_account_menus WHERE admin_id = ? ORDER BY menu_key ASC',
    [row.id]
  );
  return {
    id: Number(row.id) || 0,
    username: String(row.username),
    full_name: row.full_name != null ? String(row.full_name) : '',
    salt: row.salt != null ? String(row.salt) : '',
    hash: row.hash != null ? String(row.hash) : '',
    is_super: row.is_super === 1 || row.is_super === true,
    banned: row.banned === 1 || row.banned === true,
    created_at: row.created_at ? row.created_at.toISOString() : '',
    menus: normalizeAdminMenuList(
      menuRows.map(function (m) {
        return m.menu_key;
      }),
      row.is_super === 1 || row.is_super === true
    )
  };
}

function adminHasMenu(admin, menuKey) {
  if (!admin || !menuKey) {
    return false;
  }
  if (admin.is_super) {
    return true;
  }
  if (!Array.isArray(admin.menus)) {
    return false;
  }
  if (admin.menus.indexOf(menuKey) >= 0) {
    return true;
  }
  if (menuKey.indexOf('analytics-') === 0 && admin.menus.indexOf('analytics') >= 0) {
    return true;
  }
  return false;
}

function requireAdminMenu(menuKey) {
  return function (req, res, next) {
    if (!req.admin || !adminHasMenu(req.admin, menuKey)) {
      return res.status(403).json({ code: 403, msg: '当前账号无该菜单权限' });
    }
    next();
  };
}

function requireAdminAnyMenu(menuKeys) {
  return function (req, res, next) {
    if (!req.admin) {
      return res.status(403).json({ code: 403, msg: '当前账号无权限' });
    }
    if (req.admin.is_super) {
      return next();
    }
    var list = Array.isArray(menuKeys) ? menuKeys : [];
    for (var i = 0; i < list.length; i++) {
      if (adminHasMenu(req.admin, list[i])) {
        return next();
      }
    }
    return res.status(403).json({ code: 403, msg: '当前账号无该菜单权限' });
  };
}

async function adminCanAccessTargetUser(conn, admin, username) {
  if (!username) return false;
  if (!admin || admin.is_super) return true;
  const [rows] = await conn.execute(
    `SELECT id FROM activation_codes
     WHERE owner_admin_username = ? AND used_by_username = ?
     LIMIT 1`,
    [admin.username, username]
  );
  return rows.length > 0;
}

async function requireAdminAuth(req, res, next) {
  var auth = req.headers.authorization || '';
  var m = /^Bearer\s+(\S+)/i.exec(auth);
  var token = m ? m[1] : null;
  if (!token) {
    return res.status(401).json({ code: 401, msg: '请先登录管理后台' });
  }
  try {
    var payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ code: 403, msg: '无管理员权限' });
    }
    var adminUsername = payload.sub != null ? String(payload.sub).trim() : '';
    if (!adminUsername) {
      return res.status(401).json({ code: 401, msg: '管理登录已失效，请重新登录' });
    }
    const conn = await pool.getConnection();
    try {
      var admin = await loadAdminAccountByUsername(conn, adminUsername);
      if (!admin) {
        return res.status(401).json({ code: 401, msg: '管理账号不存在，请重新登录' });
      }
      if (admin.banned) {
        return res.status(403).json({ code: 403, msg: '管理账号已被停用' });
      }
      req.admin = admin;
      if (!res.__adminJsonHooked) {
        var oldJson = res.json.bind(res);
        res.json = function (payload) {
          try {
            if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'code')) {
              res.__adminBizCode = Number(payload.code);
            }
          } catch (e) {}
          return oldJson(payload);
        };
        res.__adminJsonHooked = true;
      }
      if (!req.__adminAuditAttached) {
        req.__adminAuditAttached = true;
        res.on('finish', function () {
          recordAdminOperationLog(req, res).catch(function () {});
        });
      }
    } finally {
      conn.release();
    }
    next();
  } catch (err) {
    return res.status(401).json({ code: 401, msg: '管理登录已过期，请重新登录' });
  }
}

async function requireAuth(req, res, next) {
  var auth = req.headers.authorization || '';
  var m = /^Bearer\s+(\S+)/i.exec(auth);
  var token = m ? m[1] : null;
  if (!token) {
    return res.status(401).json({ code: 401, msg: '请先登录' });
  }
  try {
    var payload = jwt.verify(token, JWT_SECRET);
    if (payload.role === 'admin') {
      return res.status(403).json({ code: 403, msg: '无效的用户令牌' });
    }
    req.authUserId = payload.sub;
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute('SELECT banned, session_rev FROM users WHERE username = ?', [req.authUserId]);
      if (!rows.length) {
        return res.status(401).json({ code: 401, msg: '登录已失效，请重新登录', session_revoked: true });
      }
      if (rows[0].banned === 1 || rows[0].banned === true) {
        return res.status(403).json({ code: 403, msg: '账号已被封禁', banned: true });
      }
      var dbSrv = userSessionRevFromRow(rows[0]);
      var tokSrv = payload.srv != null && payload.srv !== '' ? Number(payload.srv) : null;
      if (tokSrv !== null && !isNaN(tokSrv) && tokSrv !== dbSrv) {
        return res.status(401).json({ code: 401, msg: '登录已失效，请重新登录', session_revoked: true });
      }
      if ((tokSrv === null || isNaN(tokSrv)) && dbSrv > 0) {
        return res.status(401).json({ code: 401, msg: '登录已失效，请重新登录', session_revoked: true });
      }
    } finally {
      conn.release();
    }
    touchUserDailyActivity(req.authUserId);
    syncUserDeviceFromClientJson(req, req.authUserId);
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 401, msg: '登录已过期，请重新登录' });
    }
    console.error(err);
    return res.status(401).json({ code: 401, msg: '请先登录' });
  }
}

function parseTaxRecordIncome(raw) {
  if (raw == null || raw === '') return 0;
  var n = Number(raw);
  if (!isNaN(n)) return n;
  var s = String(raw).replace(/,/g, '').trim();
  n = parseFloat(s);
  return isNaN(n) || n < 0 ? 0 : n;
}

function formatAvgSalary6mLabel(avg, monthCount) {
  if (avg == null || isNaN(avg)) return '未填写';
  var n = Number(avg);
  var base = n.toFixed(2) + ' 元';
  if (monthCount > 0 && monthCount < 6) {
    return base + '（' + monthCount + '个月平均）';
  }
  return base;
}

function parseSalaryRangeFilterParam(raw) {
  if (raw == null || raw === '') return null;
  var n = Number(String(raw).replace(/,/g, '').trim());
  if (isNaN(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function userMatchesSalaryRange(salInfo, minVal, maxVal) {
  if (minVal == null && maxVal == null) return true;
  var avg =
    salInfo && salInfo.avg_salary_6m != null && !isNaN(Number(salInfo.avg_salary_6m))
      ? Number(salInfo.avg_salary_6m)
      : null;
  if (avg == null) return false;
  if (minVal != null && avg < minVal) return false;
  if (maxVal != null && avg > maxVal) return false;
  return true;
}

/** 按个税记录「收入」：每月合计后取最近最多 6 个月求平均 */
function computeTaxRecordsAvgSalary6m(records) {
  if (!records || !records.length) {
    return { avg_salary_6m: null, avg_salary_6m_label: '未填写', salary_month_count: 0 };
  }
  var byMonth = {};
  records.forEach(function (r) {
    var y = r.year != null ? Number(r.year) : null;
    var m = r.month != null ? Number(r.month) : null;
    if (!y || !m) {
      var tp = r.tax_period != null ? String(r.tax_period).trim() : '';
      var mm = tp.match(/^(\d{4})-(\d{1,2})/);
      if (mm) {
        y = Number(mm[1]);
        m = Number(mm[2]);
      }
    }
    if (!y || !m || isNaN(y) || isNaN(m)) return;
    var key = y + '-' + String(m).padStart(2, '0');
    var inc = parseTaxRecordIncome(r.income);
    if (!byMonth[key]) byMonth[key] = { y: y, m: m, total: 0 };
    byMonth[key].total += inc;
  });
  var months = Object.keys(byMonth).map(function (k) {
    return byMonth[k];
  });
  months.sort(function (a, b) {
    if (a.y !== b.y) return b.y - a.y;
    return b.m - a.m;
  });
  var withIncome = months.filter(function (x) {
    return x.total > 0;
  });
  var pick = withIncome.slice(0, 6);
  if (!pick.length) {
    return { avg_salary_6m: null, avg_salary_6m_label: '未填写', salary_month_count: 0 };
  }
  var sum = 0;
  for (var i = 0; i < pick.length; i++) {
    sum += pick[i].total;
  }
  var avg = Math.round((sum / pick.length) * 100) / 100;
  return {
    avg_salary_6m: avg,
    avg_salary_6m_label: formatAvgSalary6mLabel(avg, pick.length),
    salary_month_count: pick.length
  };
}

async function buildUserTaxAvgSalaryMap(conn, usernames) {
  var map = {};
  if (!conn || !usernames || !usernames.length) return map;
  var uniq = [];
  var seen = {};
  for (var i = 0; i < usernames.length; i++) {
    var u = String(usernames[i] || '').trim();
    if (!u || seen[u]) continue;
    seen[u] = 1;
    uniq.push(u);
  }
  if (!uniq.length) return map;
  var ph = uniq.map(function () {
    return '?';
  }).join(',');
  const [rows] = await conn.execute(
    'SELECT user_id, year, month, income, tax_period FROM tax_records WHERE user_id IN (' +
      ph +
      ') AND ' +
      TAX_RECORD_NOT_DELETED_SQL,
    uniq
  );
  var byUser = {};
  rows.forEach(function (r) {
    var uid = String(r.user_id);
    if (!byUser[uid]) byUser[uid] = [];
    byUser[uid].push({
      year: r.year,
      month: r.month,
      income: r.income,
      tax_period: r.tax_period
    });
  });
  uniq.forEach(function (uname) {
    map[uname] = computeTaxRecordsAvgSalary6m(byUser[uname] || []);
  });
  return map;
}

/**
 * 注册：无需激活码，账号默认为未激活（account_active=0），需在个人中心填写激活码开通。
 */
async function registerUser(username, password, registerSourceChannel, fromInstallGuide, salesPromoChannel) {
  var u = validateUsername(username);
  if (u) {
    throw new Error(u);
  }
  var p = validatePassword(password);
  if (p) {
    throw new Error(p);
  }
  var srcErr = validateRegisterSourceChannel(registerSourceChannel);
  if (srcErr) {
    throw new Error(srcErr);
  }
  registerSourceChannel = String(registerSourceChannel).trim();
  salesPromoChannel = sanitizeSalesChannelId(salesPromoChannel);
  username = username.trim();
  if (username.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    throw new Error('该账号名保留，请换一个');
  }

  const saltBuf = crypto.randomBytes(16);
  const saltHex = saltBuf.toString('hex');
  const hash = crypto.scryptSync(password, saltBuf, 64).toString('hex');
  const displayName = username;

  const conn = await pool.getConnection();
  try {
    const [existing] = await conn.execute('SELECT username FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      throw new Error('该账号已注册');
    }
    /* 管理后台需展示用户密码；默认存明文，仅当 REGISTER_STORE_PLAIN_PASSWORD=0 时关闭 */
    var storePlain =
      String(process.env.REGISTER_STORE_PLAIN_PASSWORD || '1') === '0' ? null : password;
    await conn.execute(
      `INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password, register_source_channel, registered_from_install_guide, sales_promo_channel)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        username,
        saltHex,
        hash,
        displayName,
        USER_TYPE_NORMAL,
        storePlain,
        registerSourceChannel,
        fromInstallGuide ? 1 : 0,
        salesPromoChannel || null
      ]
    );
    // 注册成功埋点（用于后台接口统计看转化）
    incrementApiDailyCounter('EVENT register_success', '认证注册');
  } finally {
    conn.release();
  }
  return {
    user_id: username,
    real_name: displayName,
    username: username,
    account_active: false,
    is_test_account: false
  };
}

async function loginUser(username, password) {
  if (username != null && typeof username !== 'string') username = String(username);
  if (password != null && typeof password !== 'string') password = String(password);
  var u = validateUsername(username);
  if (u) throw new Error(u);
  if (!password) throw new Error('请输入密码');
  username = username.trim();
  
  const conn = await pool.getConnection();
  const [rows] = await conn.execute('SELECT * FROM users WHERE username = ?', [username]);
  
  if (rows.length === 0) {
    conn.release();
    throw new Error('账号或密码错误');
  }
  
  const rec = rows[0];
  const check = hashPassword(password, rec.salt);

  if (check !== rec.hash) {
    conn.release();
    throw new Error('密码错误，请通过激活码找回密码');
  }

  /* 历史账号未存明文时，登录成功即回填，供管理后台展示 */
  if (String(process.env.REGISTER_STORE_PLAIN_PASSWORD || '1') !== '0') {
    var plainCur = rec.plain_password != null ? String(rec.plain_password) : '';
    if (plainCur !== password) {
      try {
        await conn.execute('UPDATE users SET plain_password = ? WHERE username = ?', [password, username]);
      } catch (plainErr) {
        console.warn('plain_password backfill failed for', username, plainErr.message);
      }
    }
  }

  conn.release();

  if (rec.banned === 1 || rec.banned === true) {
    throw new Error('账号已被封禁');
  }

  var activeVal = rec.account_active != null ? Number(rec.account_active) : 1;
  var accountActive = activeVal === 1;
  
  var ut = rec.user_type != null ? Number(rec.user_type) : USER_TYPE_NORMAL;
  return {
    user_id: rec.username,
    real_name: rec.real_name || username,
    username: username,
    account_active: accountActive,
    user_type: ut,
    is_test_account: ut === USER_TYPE_TEST,
    session_rev: userSessionRevFromRow(rec)
  };
}

async function getUserInfoForApi(userId) {
  if (userId == null || String(userId).trim() === '') {
    return null;
  }
  const uid = String(userId).trim();

  var lockedCompany = TEST_ACCOUNT_COMPANY_NAME_DEFAULT;
  try {
    lockedCompany = await getTestAccountCompanyName();
  } catch (e) {
    console.error('getTestAccountCompanyName', e);
  }

  const conn = await pool.getConnection();
  const [rows] = await conn.execute('SELECT * FROM users WHERE username = ?', [uid]);

  const [employerRows] = await conn.execute('SELECT * FROM employers WHERE user_id = ?', [uid]);
  const [taxCountRows] = await conn.execute(
    'SELECT COUNT(*) AS c FROM tax_records WHERE user_id = ? AND ' + TAX_RECORD_NOT_DELETED_SQL,
    [uid]
  );
  conn.release();

  const defaults = {
    real_name: uid,
    tax_id: DEFAULT_TAX_ID_HINT,
    employer_count: 0,
    family_count: 0,
    bank_card_count: 0,
    tax_record_count: 0,
    gender: 1,
    account_active: false,
    watermark_enabled: false,
    user_type: USER_TYPE_NORMAL,
    is_test_account: false,
    test_company_locked_name: '',
    id_type: '居民身份证',
    birth_date: '',
    nationality: '中华人民共和国',
    huji_area: '',
    huji_detail: '',
    living_area: '',
    living_detail: '',
    contact_area: '',
    contact_detail: '',
    education: '',
    ethnicity: '',
    email: '',
    employers: []
  };
  
  if (rows.length === 0) {
    return Object.assign({ username: uid }, defaults);
  }
  
  const rec = rows[0];
  var ut = rec.user_type != null ? Number(rec.user_type) : USER_TYPE_NORMAL;
  var accountActive =
    rec.account_active === 1 ||
    rec.account_active === true ||
    Number(rec.account_active) === 1;
  var wmFlag = !accountActive;
  function profileStr(field, fallback) {
    var v = rec[field];
    if (v == null || String(v).trim() === '') {
      return fallback != null ? fallback : '';
    }
    return String(v);
  }
  return {
    username: uid,
    real_name: rec.real_name != null ? String(rec.real_name) : uid,
    tax_id: normalizeTaxIdForApi(rec.tax_id != null ? String(rec.tax_id) : ''),
    employer_count: rec.employer_count != null ? Number(rec.employer_count) : 0,
    family_count: rec.family_count != null ? Number(rec.family_count) : 0,
    bank_card_count: rec.bank_card_count != null ? Number(rec.bank_card_count) : 0,
    tax_record_count: taxCountRows && taxCountRows[0] ? Number(taxCountRows[0].c) || 0 : 0,
    gender: rec.gender != null ? Number(rec.gender) : 1,
    account_active: accountActive,
    watermark_enabled: wmFlag,
    user_type: ut,
    is_test_account: ut === USER_TYPE_TEST,
    test_company_locked_name: ut === USER_TYPE_TEST ? lockedCompany : '',
    id_type: profileStr('id_type', '居民身份证'),
    birth_date: profileStr('birth_date', ''),
    nationality: profileStr('nationality', '中华人民共和国'),
    huji_area: profileStr('huji_area', ''),
    huji_detail: profileStr('huji_detail', ''),
    living_area: profileStr('living_area', ''),
    living_detail: profileStr('living_detail', ''),
    contact_area: profileStr('contact_area', ''),
    contact_detail: profileStr('contact_detail', ''),
    education: profileStr('education', ''),
    ethnicity: profileStr('ethnicity', ''),
    email: profileStr('email', ''),
    employers: employerRows
  };
}

function maskFamilyMemberIdNo(idNo) {
  var s = String(idNo || '').trim();
  if (!s) return '';
  if (s.length <= 2) {
    return s.charAt(0) + '*';
  }
  return s.charAt(0) + '*'.repeat(s.length - 2) + s.charAt(s.length - 1);
}

async function listFamilyMembersForUser(userId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT id, real_name, relation, id_type, id_type_label, id_no, birth_date, created_at
       FROM family_members WHERE user_id = ? ORDER BY created_at ASC, id ASC`,
      [userId]
    );
    return rows.map(function (r) {
      return {
        id: r.id,
        real_name: r.real_name || '',
        relation: r.relation || '',
        id_type: r.id_type || 'resident',
        id_type_label: r.id_type_label || '',
        id_no_masked: maskFamilyMemberIdNo(r.id_no),
        birth_date: r.birth_date || ''
      };
    });
  } finally {
    conn.release();
  }
}

async function syncUserFamilyCount(conn, userId) {
  const [cntRows] = await conn.execute('SELECT COUNT(*) AS count FROM family_members WHERE user_id = ?', [
    userId
  ]);
  var n = cntRows.length && cntRows[0].count != null ? Number(cntRows[0].count) : 0;
  await conn.execute('UPDATE users SET family_count = ? WHERE username = ?', [n, userId]);
  return n;
}

async function getFamilyMemberForUser(userId, memberId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT id, real_name, relation, id_type, id_type_label, id_no, birth_date
       FROM family_members WHERE id = ? AND user_id = ? LIMIT 1`,
      [memberId, userId]
    );
    if (!rows.length) {
      return null;
    }
    var r = rows[0];
    return {
      id: r.id,
      real_name: r.real_name || '',
      relation: r.relation || '',
      id_type: r.id_type || 'resident',
      id_type_label: r.id_type_label || '',
      id_no: r.id_no || '',
      id_no_masked: maskFamilyMemberIdNo(r.id_no),
      birth_date: r.birth_date || ''
    };
  } finally {
    conn.release();
  }
}

function parseFamilyMemberBody(body) {
  var fmName = String(body.real_name || '').trim();
  var fmRelation = String(body.relation || '').trim();
  var fmIdNo = String(body.id_no || '')
    .replace(/\s/g, '')
    .toUpperCase();
  var fmIdType = String(body.id_type || 'resident').trim() || 'resident';
  var fmIdTypeLabel = String(body.id_type_label || '').trim();
  var fmBirth = String(body.birth_date || '').trim();
  if (!fmName) {
    return { err: '请填写姓名' };
  }
  if (!fmRelation) {
    return { err: '请选择与我的关系' };
  }
  if (!fmIdNo) {
    return { err: '请填写证件号' };
  }
  if (fmIdType === 'resident') {
    if (
      !(
        (fmIdNo.length === 18 && /^\d{17}[\dX]$/.test(fmIdNo)) ||
        (fmIdNo.length === 15 && /^\d{15}$/.test(fmIdNo))
      )
    ) {
      return { err: '居民身份证号码格式不正确' };
    }
  }
  return {
    data: {
      real_name: fmName,
      relation: fmRelation,
      id_no: fmIdNo,
      id_type: fmIdType,
      id_type_label: fmIdTypeLabel,
      birth_date: fmBirth
    }
  };
}

function maskBankCardNo(cardNo) {
  var d = String(cardNo || '').replace(/\D/g, '');
  if (!d) return '—';
  if (d.length < 8) return '****';
  return d.slice(0, 4) + ' **** ' + d.slice(-4);
}

/** 用户端列表：前段 **** 分组，仅末 4 位可见（19 位卡末段为 ***0 287 样式） */
function maskBankCardNoShort(cardNo) {
  var d = String(cardNo || '').replace(/\D/g, '');
  if (!d) return '—';
  if (d.length < 4) return '****';
  var tail = d.slice(-4);
  var prefix = d.slice(0, -4);
  if (d.length <= 16) {
    var parts = [];
    for (var i = 0; i < prefix.length; i += 4) {
      parts.push('****');
    }
    parts.push(tail);
    return parts.join(' ');
  }
  var groups = [];
  var j = 0;
  while (j + 4 <= prefix.length - 3) {
    groups.push('****');
    j += 4;
  }
  groups.push('***' + tail.charAt(0));
  var tailRest = tail.slice(1);
  if (tailRest) {
    groups.push(tailRest);
  }
  return groups.join(' ');
}

async function listBankCardsForUser(userId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT id, card_no, bank_name, province, phone, created_at, is_default
       FROM bank_cards WHERE user_id = ? ORDER BY is_default DESC, created_at ASC, id ASC`,
      [userId]
    );
    return rows.map(function (r) {
      var bankName = String(r.bank_name || '').trim() || inferBankNameFromCardNo(r.card_no);
      return {
        id: r.id,
        bank_name: bankName,
        card_no_masked: maskBankCardNo(r.card_no),
        card_no_masked_short: maskBankCardNoShort(r.card_no),
        is_default: !!(r.is_default && Number(r.is_default) === 1),
        province: r.province || '',
        phone: r.phone || ''
      };
    });
  } finally {
    conn.release();
  }
}

async function syncUserBankCardCount(conn, userId) {
  const [cntRows] = await conn.execute('SELECT COUNT(*) AS count FROM bank_cards WHERE user_id = ?', [userId]);
  var n = cntRows.length && cntRows[0].count != null ? Number(cntRows[0].count) : 0;
  await conn.execute('UPDATE users SET bank_card_count = ? WHERE username = ?', [n, userId]);
  return n;
}

var ZXK_DEDUCTION_CATEGORIES = [
  '子女教育',
  '继续教育',
  '大病医疗',
  '住房贷款利息',
  '住房租金',
  '赡养老人',
  '3岁以下婴幼儿照护'
];

function isValidZxkCategory(cat) {
  return ZXK_DEDUCTION_CATEGORIES.indexOf(String(cat || '').trim()) >= 0;
}

function formatZxkRecordTitle(category, relatedName) {
  var cat = String(category || '').trim();
  var name = String(relatedName || '').trim();
  if (!name) {
    return cat;
  }
  if (
    cat === '赡养老人' ||
    cat === '子女教育' ||
    cat === '3岁以下婴幼儿照护' ||
    cat === '大病医疗'
  ) {
    return cat + '（' + name + '）';
  }
  return cat;
}

function formatZxkDateForApi(d) {
  if (!d) {
    return '';
  }
  if (d instanceof Date && !isNaN(d.getTime())) {
    var Y = d.getFullYear();
    var M = String(d.getMonth() + 1).padStart(2, '0');
    var D = String(d.getDate()).padStart(2, '0');
    return Y + '-' + M + '-' + D;
  }
  var s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  return s;
}

function mapZxkRecordRow(r) {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    related_name: r.related_name != null ? String(r.related_name) : '',
    last_modified_date: formatZxkDateForApi(r.last_modified_date),
    filing_source: r.filing_source != null ? String(r.filing_source) : '本人',
    deduction_year: r.deduction_year != null ? Number(r.deduction_year) : 0,
    is_voided: r.is_voided && Number(r.is_voided) === 1 ? 1 : 0,
    created_at: r.created_at ? r.created_at.toISOString() : '',
    updated_at: r.updated_at ? r.updated_at.toISOString() : ''
  };
}

async function listSpecialDeductionRecordsForUser(userId, year, includeVoided) {
  const conn = await pool.getConnection();
  try {
    var y = parseInt(year, 10);
    if (!y || y < 2000 || y > 2100) {
      y = new Date().getFullYear();
    }
    var voided = includeVoided === true || includeVoided === 1 || includeVoided === '1';
    var sql =
      'SELECT id, category, title, related_name, last_modified_date, filing_source, deduction_year, is_voided, created_at, updated_at ' +
      'FROM special_deduction_records WHERE user_id = ? AND deduction_year = ?';
    var params = [userId, y];
    if (!voided) {
      sql += ' AND is_voided = 0';
    } else {
      sql += ' AND is_voided = 1';
    }
    sql += ' ORDER BY last_modified_date DESC, updated_at DESC, id DESC';
    const [rows] = await conn.execute(sql, params);
    return rows.map(mapZxkRecordRow);
  } finally {
    conn.release();
  }
}

async function ensureUserExistsForZxk(conn, userId) {
  const [userRows] = await conn.execute('SELECT username FROM users WHERE username = ?', [userId]);
  if (userRows.length === 0) {
    await conn.execute(
      `INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [userId, '', '', userId, USER_TYPE_NORMAL, '自动创建']
    );
  }
}

async function handleUserGet(req, res) {
  var action = req.query.action;
  if (
    action !== 'info' &&
    action !== 'employers' &&
    action !== 'family_members' &&
    action !== 'family_member' &&
    action !== 'bank_cards' &&
    action !== 'special_deduction_records'
  ) {
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  }
  var userId = req.authUserId;
  if (userId == null || userId === '') {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  try {
    if (action === 'family_members') {
      var members = await listFamilyMembersForUser(userId);
      return res.json({ code: 200, data: { members: members } });
    }
    if (action === 'family_member') {
      var fmId = req.query.id != null ? String(req.query.id).trim() : '';
      if (!fmId) {
        return res.status(400).json({ code: 400, msg: 'id required' });
      }
      var fmOne = await getFamilyMemberForUser(userId, fmId);
      if (!fmOne) {
        return res.status(404).json({ code: 404, msg: '家庭成员不存在' });
      }
      return res.json({ code: 200, data: { member: fmOne } });
    }
    if (action === 'bank_cards') {
      var cards = await listBankCardsForUser(userId);
      return res.json({ code: 200, data: { cards: cards } });
    }
    if (action === 'special_deduction_records') {
      var voidedQ =
        req.query.voided === '1' || req.query.voided === 'true' || req.query.voided === true;
      var zxkList = await listSpecialDeductionRecordsForUser(userId, req.query.year, voidedQ);
      return res.json({ code: 200, data: { records: zxkList } });
    }
    var data = await getUserInfoForApi(userId);
    if (!data) {
      return res.status(400).json({ code: 400, msg: 'user_id required' });
    }
    if (action === 'employers') {
      res.json({ code: 200, data: { employers: data.employers } });
    } else {
      res.json({ code: 200, data: data });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleUserPost(req, res) {
  var body = req.body || {};
  var action = body.action;
  var userId = req.authUserId;
  
  try {
    if (/^track_[a-z0-9_]{1,80}$/i.test(String(action || ''))) {
      return res.json({ code: 200, data: { ok: true } });
    }

    if (action === 'add_employer') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      
      var employerData = {
        company_name: body.company_name || '',
        credit_code: body.credit_code || '',
        position: body.position || '',
        hire_date: body.hire_date || '',
        leave_date: body.leave_date || '',
        status: body.status || '1'
      };
      
      const conn = await pool.getConnection();
      const [userRows] = await conn.execute('SELECT * FROM users WHERE username = ?', [userId]);
      
      if (userRows.length === 0) {
        await conn.execute(`
          INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
          VALUES (?, ?, ?, ?, 0, ?, ?)
        `, [userId, '', '', userId, USER_TYPE_NORMAL, '自动创建']);
      }
      
      employerData.id = 'emp_' + Date.now();
      await conn.execute(`
        INSERT INTO employers (id, user_id, company_name, credit_code, position, hire_date, leave_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        employerData.id, userId, employerData.company_name, employerData.credit_code,
        employerData.position, employerData.hire_date, employerData.leave_date, employerData.status
      ]);
      
      const [employerCount] = await conn.execute('SELECT COUNT(*) as count FROM employers WHERE user_id = ?', [userId]);
      await conn.execute('UPDATE users SET employer_count = ? WHERE username = ?', [employerCount[0].count, userId]);
      
      conn.release();
      
      return res.json({ code: 200, data: { success: true, employer: employerData } });
    }

    if (action === 'update_employer') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      if (!body.employer_id) {
        return res.status(400).json({ code: 400, msg: 'employer_id required' });
      }
      const connUpd = await pool.getConnection();
      try {
        const [updRows] = await connUpd.execute(
          `UPDATE employers SET company_name = ?, credit_code = ?, position = ?, hire_date = ?, leave_date = ?, status = ?
           WHERE id = ? AND user_id = ?`,
          [
            body.company_name || '',
            body.credit_code || '',
            body.position || '',
            body.hire_date || '',
            body.leave_date || '',
            body.status != null ? String(body.status) : '1',
            body.employer_id,
            userId
          ]
        );
        if (!updRows || !updRows.affectedRows) {
          return res.status(404).json({ code: 404, msg: '任职受雇记录不存在' });
        }
        return res.json({
          code: 200,
          data: {
            success: true,
            employer: {
              id: body.employer_id,
              company_name: body.company_name || '',
              credit_code: body.credit_code || '',
              position: body.position || '',
              hire_date: body.hire_date || '',
              leave_date: body.leave_date || '',
              status: body.status != null ? String(body.status) : '1'
            }
          }
        });
      } finally {
        connUpd.release();
      }
    }
    
    if (action === 'save_profile') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        
        const conn = await pool.getConnection();
        const [userRows] = await conn.execute('SELECT * FROM users WHERE username = ?', [userId]);
        
        if (userRows.length === 0) {
          await conn.execute(`
            INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
            VALUES (?, ?, ?, ?, 0, ?, ?)
          `, [userId, '', '', userId, USER_TYPE_NORMAL, '自动创建']);
        }
        
        const [userRows2] = await conn.execute('SELECT * FROM users WHERE username = ?', [userId]);
        const profileUser = userRows2.length ? userRows2[0] : null;
        const isTestProfile = profileUser && rowUserTypeIsTest(profileUser);
        
        let updateFields = [];
        let updateParams = [];
        
        if (body.real_name != null) {
          updateFields.push('real_name = ?');
          updateParams.push(String(body.real_name));
        }
        if (body.tax_id != null) {
          var taxIdVal = String(body.tax_id).trim();
          if (!isPlaceholderTaxId(taxIdVal)) {
            updateFields.push('tax_id = ?');
            updateParams.push(taxIdVal);
          }
        }
        if (body.gender != null) {
          updateFields.push('gender = ?');
          updateParams.push(Number(body.gender));
        }
        if (body.employer_count != null) {
          updateFields.push('employer_count = ?');
          updateParams.push(Number(body.employer_count));
        }
        if (body.family_count != null) {
          updateFields.push('family_count = ?');
          updateParams.push(Number(body.family_count));
        }
        if (body.bank_card_count != null) {
          updateFields.push('bank_card_count = ?');
          updateParams.push(Number(body.bank_card_count));
        }

        function profileField(bodyObj, key, maxLen) {
          if (!Object.prototype.hasOwnProperty.call(bodyObj, key)) {
            return undefined;
          }
          var s = bodyObj[key] == null ? '' : String(bodyObj[key]).trim();
          if (s.length > maxLen) {
            s = s.substring(0, maxLen);
          }
          return s;
        }
        var pfHujiArea = profileField(body, 'huji_area', 255);
        if (pfHujiArea !== undefined) {
          updateFields.push('huji_area = ?');
          updateParams.push(pfHujiArea);
        }
        var pfHujiDetail = profileField(body, 'huji_detail', 512);
        if (pfHujiDetail !== undefined) {
          updateFields.push('huji_detail = ?');
          updateParams.push(pfHujiDetail);
        }
        var pfLivingArea = profileField(body, 'living_area', 255);
        if (pfLivingArea !== undefined) {
          updateFields.push('living_area = ?');
          updateParams.push(pfLivingArea);
        }
        var pfLivingDetail = profileField(body, 'living_detail', 512);
        if (pfLivingDetail !== undefined) {
          updateFields.push('living_detail = ?');
          updateParams.push(pfLivingDetail);
        }
        var pfContactArea = profileField(body, 'contact_area', 255);
        if (pfContactArea !== undefined) {
          updateFields.push('contact_area = ?');
          updateParams.push(pfContactArea);
        }
        var pfContactDetail = profileField(body, 'contact_detail', 512);
        if (pfContactDetail !== undefined) {
          updateFields.push('contact_detail = ?');
          updateParams.push(pfContactDetail);
        }
        var pfIdType = profileField(body, 'id_type', 64);
        if (pfIdType !== undefined && !isTestProfile) {
          updateFields.push('id_type = ?');
          updateParams.push(pfIdType);
        }
        var pfBirth = profileField(body, 'birth_date', 32);
        if (pfBirth !== undefined && !isTestProfile) {
          updateFields.push('birth_date = ?');
          updateParams.push(pfBirth);
        }
        var pfNationality = profileField(body, 'nationality', 128);
        if (pfNationality !== undefined && !isTestProfile) {
          updateFields.push('nationality = ?');
          updateParams.push(pfNationality);
        }
        var pfEducation = profileField(body, 'education', 64);
        if (pfEducation !== undefined) {
          updateFields.push('education = ?');
          updateParams.push(pfEducation);
        }
        var pfEthnicity = profileField(body, 'ethnicity', 64);
        if (pfEthnicity !== undefined) {
          updateFields.push('ethnicity = ?');
          updateParams.push(pfEthnicity);
        }
        var pfEmail = profileField(body, 'email', 255);
        if (pfEmail !== undefined) {
          updateFields.push('email = ?');
          updateParams.push(pfEmail);
        }
        
        if (updateFields.length > 0) {
          updateParams.push(userId);
          await conn.execute(`UPDATE users SET ${updateFields.join(', ')} WHERE username = ?`, updateParams);
        }
        
        conn.release();
        
        return res.json({ code: 200, data: { success: true } });
      }

      if (action === 'add_family_member') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var fmParsed = parseFamilyMemberBody(body);
        if (fmParsed.err) {
          return res.status(400).json({ code: 400, msg: fmParsed.err });
        }
        var fmData = fmParsed.data;
        const connFm = await pool.getConnection();
        try {
          const [userRowsFm] = await connFm.execute('SELECT username FROM users WHERE username = ?', [userId]);
          if (userRowsFm.length === 0) {
            await connFm.execute(
              `INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
               VALUES (?, ?, ?, ?, 0, ?, ?)`,
              [userId, '', '', userId, USER_TYPE_NORMAL, '自动创建']
            );
          }
          var fmId = 'fm_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
          await connFm.execute(
            `INSERT INTO family_members (id, user_id, real_name, relation, id_type, id_type_label, id_no, birth_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              fmId,
              userId,
              fmData.real_name,
              fmData.relation,
              fmData.id_type,
              fmData.id_type_label || null,
              fmData.id_no,
              fmData.birth_date || null
            ]
          );
          var familyCount = await syncUserFamilyCount(connFm, userId);
          return res.json({
            code: 200,
            data: {
              success: true,
              member: {
                id: fmId,
                real_name: fmData.real_name,
                relation: fmData.relation,
                id_type: fmData.id_type,
                id_type_label: fmData.id_type_label,
                id_no_masked: maskFamilyMemberIdNo(fmData.id_no),
                birth_date: fmData.birth_date
              },
              family_count: familyCount
            }
          });
        } finally {
          connFm.release();
        }
      }

      if (action === 'update_family_member') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var fmUpId = String(body.member_id || body.id || '').trim();
        if (!fmUpId) {
          return res.status(400).json({ code: 400, msg: 'member_id required' });
        }
        var fmUpParsed = parseFamilyMemberBody(body);
        if (fmUpParsed.err) {
          return res.status(400).json({ code: 400, msg: fmUpParsed.err });
        }
        var fmUpData = fmUpParsed.data;
        const connFmUp = await pool.getConnection();
        try {
          const [existFm] = await connFmUp.execute(
            'SELECT id FROM family_members WHERE id = ? AND user_id = ? LIMIT 1',
            [fmUpId, userId]
          );
          if (!existFm.length) {
            return res.status(404).json({ code: 404, msg: '家庭成员不存在' });
          }
          await connFmUp.execute(
            `UPDATE family_members SET real_name = ?, relation = ?, id_type = ?, id_type_label = ?, id_no = ?, birth_date = ?
             WHERE id = ? AND user_id = ?`,
            [
              fmUpData.real_name,
              fmUpData.relation,
              fmUpData.id_type,
              fmUpData.id_type_label || null,
              fmUpData.id_no,
              fmUpData.birth_date || null,
              fmUpId,
              userId
            ]
          );
          return res.json({
            code: 200,
            data: {
              success: true,
              member: {
                id: fmUpId,
                real_name: fmUpData.real_name,
                relation: fmUpData.relation,
                id_type: fmUpData.id_type,
                id_type_label: fmUpData.id_type_label,
                id_no_masked: maskFamilyMemberIdNo(fmUpData.id_no),
                birth_date: fmUpData.birth_date
              }
            }
          });
        } finally {
          connFmUp.release();
        }
      }

      if (action === 'delete_family_member') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var fmDelId = String(body.member_id || body.id || '').trim();
        if (!fmDelId) {
          return res.status(400).json({ code: 400, msg: 'member_id required' });
        }
        const connFmDel = await pool.getConnection();
        try {
          const [delFmRows] = await connFmDel.execute(
            'SELECT id FROM family_members WHERE id = ? AND user_id = ? LIMIT 1',
            [fmDelId, userId]
          );
          if (!delFmRows.length) {
            return res.status(404).json({ code: 404, msg: '家庭成员不存在' });
          }
          await connFmDel.execute('DELETE FROM family_members WHERE id = ? AND user_id = ?', [fmDelId, userId]);
          var delFamilyCount = await syncUserFamilyCount(connFmDel, userId);
          return res.json({
            code: 200,
            data: { success: true, family_count: delFamilyCount }
          });
        } finally {
          connFmDel.release();
        }
      }

      if (action === 'add_bank_card') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var cardNo = String(body.card_no || '').replace(/\D/g, '');
        var phone = String(body.phone || '').replace(/\D/g, '');
        var province = String(body.province || '').trim();
        var bankName = String(body.bank_name || '').trim();
        if (!cardNo || cardNo.length < 16) {
          return res.status(400).json({ code: 400, msg: '请填写正确的银行卡号' });
        }
        if (phone.length !== 11) {
          return res.status(400).json({ code: 400, msg: '请填写11位银行预留手机号' });
        }
        if (!bankName) {
          bankName = inferBankNameFromCardNo(cardNo);
        }
        const connBc = await pool.getConnection();
        try {
          const [userRowsBc] = await connBc.execute('SELECT username FROM users WHERE username = ?', [userId]);
          if (userRowsBc.length === 0) {
            await connBc.execute(
              `INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
               VALUES (?, ?, ?, ?, 0, ?, ?)`,
              [userId, '', '', userId, USER_TYPE_NORMAL, '自动创建']
            );
          }
          var bcId = 'bc_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
          const [existBc] = await connBc.execute('SELECT COUNT(*) AS count FROM bank_cards WHERE user_id = ?', [
            userId
          ]);
          var isFirstCard =
            !(existBc.length && existBc[0].count != null && Number(existBc[0].count) > 0);
          await connBc.execute(
            `INSERT INTO bank_cards (id, user_id, card_no, bank_name, province, phone, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [bcId, userId, cardNo, bankName, province || null, phone, isFirstCard ? 1 : 0]
          );
          var bankCardCount = await syncUserBankCardCount(connBc, userId);
          return res.json({
            code: 200,
            data: {
              success: true,
              card: {
                id: bcId,
                bank_name: bankName,
                card_no_masked: maskBankCardNo(cardNo),
                card_no_masked_short: maskBankCardNoShort(cardNo),
                is_default: isFirstCard,
                province: province,
                phone: phone
              },
              bank_card_count: bankCardCount
            }
          });
        } finally {
          connBc.release();
        }
      }

      if (action === 'delete_bank_card') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var delCardId = String(body.card_id || body.id || '').trim();
        if (!delCardId) {
          return res.status(400).json({ code: 400, msg: 'card_id required' });
        }
        const connDelBc = await pool.getConnection();
        try {
          const [delRows] = await connDelBc.execute(
            'SELECT id, is_default FROM bank_cards WHERE id = ? AND user_id = ? LIMIT 1',
            [delCardId, userId]
          );
          if (!delRows.length) {
            return res.status(404).json({ code: 404, msg: '银行卡不存在' });
          }
          var wasDefault = delRows[0].is_default && Number(delRows[0].is_default) === 1;
          await connDelBc.execute('DELETE FROM bank_cards WHERE id = ? AND user_id = ?', [delCardId, userId]);
          if (wasDefault) {
            const [nextRows] = await connDelBc.execute(
              'SELECT id FROM bank_cards WHERE user_id = ? ORDER BY created_at ASC, id ASC LIMIT 1',
              [userId]
            );
            if (nextRows.length) {
              await connDelBc.execute('UPDATE bank_cards SET is_default = 1 WHERE id = ? AND user_id = ?', [
                nextRows[0].id,
                userId
              ]);
            }
          }
          var delBankCardCount = await syncUserBankCardCount(connDelBc, userId);
          return res.json({
            code: 200,
            data: { success: true, bank_card_count: delBankCardCount }
          });
        } finally {
          connDelBc.release();
        }
      }

      if (action === 'set_default_bank_card') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var defCardId = String(body.card_id || body.id || '').trim();
        if (!defCardId) {
          return res.status(400).json({ code: 400, msg: 'card_id required' });
        }
        const connDefBc = await pool.getConnection();
        try {
          const [defRows] = await connDefBc.execute(
            'SELECT id FROM bank_cards WHERE id = ? AND user_id = ? LIMIT 1',
            [defCardId, userId]
          );
          if (!defRows.length) {
            return res.status(404).json({ code: 404, msg: '银行卡不存在' });
          }
          await connDefBc.execute('UPDATE bank_cards SET is_default = 0 WHERE user_id = ?', [userId]);
          await connDefBc.execute('UPDATE bank_cards SET is_default = 1 WHERE id = ? AND user_id = ?', [
            defCardId,
            userId
          ]);
          return res.json({ code: 200, data: { success: true, card_id: defCardId } });
        } finally {
          connDefBc.release();
        }
      }

      if (action === 'add_special_deduction_record') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var zxkCat = String(body.category || '').trim();
        if (!isValidZxkCategory(zxkCat)) {
          return res.status(400).json({ code: 400, msg: '扣除类型无效' });
        }
        var zxkYear = parseInt(body.deduction_year, 10);
        if (!zxkYear || zxkYear < 2000 || zxkYear > 2100) {
          zxkYear = new Date().getFullYear();
        }
        var zxkRelated = String(body.related_name || '').trim();
        var zxkSource = String(body.filing_source || '本人').trim() || '本人';
        var zxkMod = String(body.last_modified_date || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(zxkMod)) {
          var now = new Date();
          zxkMod =
            now.getFullYear() +
            '-' +
            String(now.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(now.getDate()).padStart(2, '0');
        }
        var zxkTitle = formatZxkRecordTitle(zxkCat, zxkRelated);
        const connZxkAdd = await pool.getConnection();
        try {
          await ensureUserExistsForZxk(connZxkAdd, userId);
          var zxkId = 'zxk_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
          await connZxkAdd.execute(
            `INSERT INTO special_deduction_records
             (id, user_id, category, title, related_name, last_modified_date, filing_source, deduction_year, is_voided)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
              zxkId,
              userId,
              zxkCat,
              zxkTitle,
              zxkRelated || null,
              zxkMod,
              zxkSource,
              zxkYear
            ]
          );
          const [zxkRows] = await connZxkAdd.execute(
            'SELECT id, category, title, related_name, last_modified_date, filing_source, deduction_year, is_voided, created_at, updated_at FROM special_deduction_records WHERE id = ? AND user_id = ?',
            [zxkId, userId]
          );
          return res.json({
            code: 200,
            data: { success: true, record: mapZxkRecordRow(zxkRows[0]) }
          });
        } finally {
          connZxkAdd.release();
        }
      }

      if (action === 'update_special_deduction_record') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var zxkUpId = String(body.record_id || body.id || '').trim();
        if (!zxkUpId) {
          return res.status(400).json({ code: 400, msg: 'record_id required' });
        }
        const connZxkUp = await pool.getConnection();
        try {
          const [existZxk] = await connZxkUp.execute(
            'SELECT * FROM special_deduction_records WHERE id = ? AND user_id = ? LIMIT 1',
            [zxkUpId, userId]
          );
          if (!existZxk.length) {
            return res.status(404).json({ code: 404, msg: '记录不存在' });
          }
          var base = existZxk[0];
          var upCat =
            body.category != null && String(body.category).trim()
              ? String(body.category).trim()
              : base.category;
          if (!isValidZxkCategory(upCat)) {
            return res.status(400).json({ code: 400, msg: '扣除类型无效' });
          }
          var upRelated =
            body.related_name != null ? String(body.related_name).trim() : base.related_name || '';
          var upSource =
            body.filing_source != null && String(body.filing_source).trim()
              ? String(body.filing_source).trim()
              : base.filing_source || '本人';
          var upYear =
            body.deduction_year != null ? parseInt(body.deduction_year, 10) : base.deduction_year;
          if (!upYear || upYear < 2000 || upYear > 2100) {
            upYear = base.deduction_year;
          }
          var upMod =
            body.last_modified_date != null && String(body.last_modified_date).trim()
              ? String(body.last_modified_date).trim()
              : formatZxkDateForApi(base.last_modified_date);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(upMod)) {
            return res.status(400).json({ code: 400, msg: '最后修改时间格式应为 YYYY-MM-DD' });
          }
          var upTitle = formatZxkRecordTitle(upCat, upRelated);
          var upVoided =
            body.is_voided != null && (body.is_voided === 1 || body.is_voided === true || body.is_voided === '1')
              ? 1
              : base.is_voided && Number(base.is_voided) === 1
                ? 1
                : 0;
          await connZxkUp.execute(
            `UPDATE special_deduction_records SET category = ?, title = ?, related_name = ?, last_modified_date = ?,
             filing_source = ?, deduction_year = ?, is_voided = ? WHERE id = ? AND user_id = ?`,
            [
              upCat,
              upTitle,
              upRelated || null,
              upMod,
              upSource,
              upYear,
              upVoided,
              zxkUpId,
              userId
            ]
          );
          const [upRows] = await connZxkUp.execute(
            'SELECT id, category, title, related_name, last_modified_date, filing_source, deduction_year, is_voided, created_at, updated_at FROM special_deduction_records WHERE id = ? AND user_id = ?',
            [zxkUpId, userId]
          );
          return res.json({
            code: 200,
            data: { success: true, record: mapZxkRecordRow(upRows[0]) }
          });
        } finally {
          connZxkUp.release();
        }
      }

      if (action === 'delete_special_deduction_record') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var zxkDelId = String(body.record_id || body.id || '').trim();
        if (!zxkDelId) {
          return res.status(400).json({ code: 400, msg: 'record_id required' });
        }
        const connZxkDel = await pool.getConnection();
        try {
          const [delZxk] = await connZxkDel.execute(
            'DELETE FROM special_deduction_records WHERE id = ? AND user_id = ?',
            [zxkDelId, userId]
          );
          if (!delZxk.affectedRows) {
            return res.status(404).json({ code: 404, msg: '记录不存在' });
          }
          return res.json({ code: 200, data: { success: true } });
        } finally {
          connZxkDel.release();
        }
      }

      if (action === 'change_password') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var oldPassword = String(body.old_password || '');
        var newPassword = String(body.new_password || '');
        if (!oldPassword) {
          return res.status(400).json({ code: 400, msg: '请输入原密码' });
        }
        var newPwdErr = validatePassword(newPassword);
        if (newPwdErr) {
          return res.status(400).json({ code: 400, msg: newPwdErr });
        }
        if (oldPassword === newPassword) {
          return res.status(400).json({ code: 400, msg: '新密码不能与原密码相同' });
        }
        const connPwd = await pool.getConnection();
        try {
          const [pwdRows] = await connPwd.execute('SELECT * FROM users WHERE username = ?', [userId]);
          if (!pwdRows.length) {
            return res.status(404).json({ code: 404, msg: '用户不存在' });
          }
          const pwdRec = pwdRows[0];
          if (!pwdRec.salt || !pwdRec.hash) {
            return res.status(400).json({ code: 400, msg: '账号尚未设置密码，请联系管理员' });
          }
          const oldCheck = hashPassword(oldPassword, pwdRec.salt);
          if (oldCheck !== pwdRec.hash) {
            return res.status(400).json({ code: 400, msg: '原密码错误' });
          }
          var pwdSaltBuf = crypto.randomBytes(16);
          var pwdSaltHex = pwdSaltBuf.toString('hex');
          var pwdHashHex = hashPasswordWithSalt(newPassword, pwdSaltBuf);
          await connPwd.execute(
            'UPDATE users SET salt = ?, hash = ?, plain_password = ? WHERE username = ?',
            [pwdSaltHex, pwdHashHex, newPassword, userId]
          );
          return res.json({ code: 200, data: { success: true } });
        } finally {
          connPwd.release();
        }
      }
      
      if (action === 'delete_employer') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        if (!body.employer_id) {
          return res.status(400).json({ code: 400, msg: 'employer_id required' });
        }
        
        const conn = await pool.getConnection();
        await conn.execute('DELETE FROM employers WHERE id = ? AND user_id = ?', [body.employer_id, userId]);
        
        const [employerCount] = await conn.execute('SELECT COUNT(*) as count FROM employers WHERE user_id = ?', [userId]);
        await conn.execute('UPDATE users SET employer_count = ? WHERE username = ?', [employerCount[0].count, userId]);
        
        conn.release();
        
        return res.json({ code: 200, data: { success: true } });
      }
      
      return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** ---------- 埋点统计（日活、接口聚合、登录与设备） ---------- */

function classifyAnalyticsRoute(req) {
  var path = req.path || '';
  var method = String(req.method || 'GET').toUpperCase();
  if (path === '/health' || path === '/api/health') {
    return null;
  }
  var body = req.body && typeof req.body === 'object' ? req.body : {};
  var q = req.query && typeof req.query === 'object' ? req.query : {};
  var action = '';
  if (body.action != null && String(body.action).trim() !== '') {
    action = String(body.action).trim();
  } else if (q.action != null && String(q.action).trim() !== '') {
    action = String(q.action).trim();
  }
  if (action && /^track_jump_/i.test(action)) {
    action = collapseTrackJumpEventKey(action);
  }
  if (action.length > 80) {
    action = action.substring(0, 80);
  }
  var actionSuffix = action ? '#' + action : '';

  if (path.indexOf('/api/admin') === 0) {
    return { route_key: method + ' ' + path + actionSuffix, biz_category: '管理后台' };
  }
  if (path.endsWith('/tax.php') || path === '/tax.php') {
    return { route_key: method + ' tax.php' + actionSuffix, biz_category: '税务记录' };
  }
  if (path.endsWith('/message.php') || path === '/message.php') {
    return { route_key: method + ' message.php' + actionSuffix, biz_category: '消息中心' };
  }
  if (path.endsWith('/user.php') || path === '/user.php') {
    return { route_key: method + ' user.php' + actionSuffix, biz_category: '用户资料与任职' };
  }
  if (path.endsWith('/feedback.php') || path === '/feedback.php') {
    return { route_key: method + ' feedback.php' + actionSuffix, biz_category: '用户反馈' };
  }
  if (path.endsWith('/auth.php') || path === '/auth.php') {
    return { route_key: method + ' auth.php' + actionSuffix, biz_category: '认证注册' };
  }
  if (path === '/api/public/mine-ui') {
    return { route_key: method + ' /api/public/mine-ui', biz_category: '公开配置' };
  }
  if (path === '/api/public/install-packages') {
    return { route_key: method + ' /api/public/install-packages', biz_category: '公开配置' };
  }
  return { route_key: method + ' ' + String(path).substring(0, 200), biz_category: '其他' };
}

function incrementApiDailyCounter(routeKey, bizCategory) {
  if (!pool || !routeKey || !bizCategory) {
    return;
  }
  var rk = String(routeKey).substring(0, 240);
  var cat = String(bizCategory).substring(0, 64);
  pool
    .execute(
      `INSERT INTO analytics_api_daily (stat_date, route_key, biz_category, cnt)
       VALUES (CURDATE(), ?, ?, 1)
       ON DUPLICATE KEY UPDATE cnt = cnt + 1`,
      [rk, cat]
    )
    .catch(function (e) {
      console.error('incrementApiDailyCounter', e);
    });
}

function analyticsFinishMiddleware(req, res, next) {
  res.on('finish', function () {
    try {
      var info = classifyAnalyticsRoute(req);
      if (!info) {
        return;
      }
      incrementApiDailyCounter(info.route_key, info.biz_category);
      recordUserPageEvent(req, info.route_key);
    } catch (e) {
      console.error('analyticsFinishMiddleware', e);
    }
  });
  next();
}

function normalizeClientPagePath(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  if (/[\x00-\x1f]/.test(s)) return '';
  if (s.length > 255) s = s.substring(0, 255);
  try {
    if (/^https?:\/\//i.test(s)) {
      var u = new URL(s);
      s = String(u.pathname || '').trim();
    }
  } catch (e) {}
  if (!s) return '';
  if (s.charAt(0) !== '/') s = '/' + s;
  s = s.replace(/\/+/g, '/');
  if (s.indexOf('/api/') === 0 || s === '/api') return '';
  return s;
}

function inferPagePathFromRequest(req) {
  var direct = normalizeClientPagePath(req.headers && req.headers['x-page-path']);
  if (direct) return direct;
  var ref = normalizeClientPagePath(req.headers && req.headers.referer);
  if (ref) return ref;
  var path = String(req.path || '').trim();
  if (path && path.indexOf('/api/') !== 0 && path.slice(-5).toLowerCase() === '.html') return path;
  return '';
}

function recordUserPageEvent(req, routeKey) {
  if (!pool || !req || !req.authUserId) return;
  var username = String(req.authUserId).trim().substring(0, 255);
  if (!username) return;
  var pagePath = inferPagePathFromRequest(req);
  if (!pagePath) return;
  var cid = '';
  try {
    if (req.clientDevicePayload && req.clientDevicePayload.client_id) {
      cid = String(req.clientDevicePayload.client_id).trim().substring(0, 128);
    }
  } catch (e) {}
  var rk = String(routeKey || '').trim().substring(0, 240);
  pool
    .execute(
      `INSERT INTO user_page_events (username, page_path, route_key, client_id)
       VALUES (?, ?, ?, ?)`,
      [username, pagePath, rk || 'unknown', cid || null]
    )
    .catch(function (e) {
      console.error('recordUserPageEvent', e);
    });
}

var INSTALL_GUIDE_EVENT_LABELS = {
  track_install_page_view: '页面浏览',
  track_install_page_leave: '离开页面',
  track_install_apk_click: 'Android 安装包点击',
  track_install_ios_click: 'iOS 描述文件点击',
  track_install_register_click: '注册入口点击',
  track_install_showcase_view: '效果预览展示',
  track_install_showcase_slide: '效果预览滑动',
  track_install_register_success: '安装页引流注册成功',
  track_install_ios_video_play: '苹果安装视频播放',
  track_install_usage_video_play: '操作视频播放',
  track_install_app_shell_register_prompt_show: 'App 内安装成功弹窗展示',
  track_install_app_shell_register_prompt_ok: 'App 内弹窗-立即注册',
  track_install_app_shell_register_prompt_later: 'App 内弹窗-稍后再说'
};

function isInstallGuideTrackContext(req, meta) {
  var m = meta && typeof meta === 'object' ? meta : {};
  if (String(m.page || '').trim() === 'install_guide') {
    return true;
  }
  var pp = inferPagePathFromRequest(req);
  return /install_guide\.html/i.test(pp);
}

function parseFromInstallGuideFlag(body) {
  var b = body && typeof body === 'object' ? body : {};
  var v = b.from_install_guide;
  return v === true || v === 1 || v === '1' || String(v || '').toLowerCase() === 'true';
}

function recordInstallGuideTrackEvent(req, action, meta) {
  if (!pool) {
    return;
  }
  var act = String(action || '').trim();
  if (!/^track_[a-z0-9_]{1,80}$/i.test(act)) {
    return;
  }
  if (!isInstallGuideTrackContext(req, meta) && !/^track_install_/i.test(act)) {
    return;
  }
  var cid = '';
  try {
    if (req.clientDevicePayload && req.clientDevicePayload.client_id) {
      cid = String(req.clientDevicePayload.client_id).trim().substring(0, 128);
    }
  } catch (e0) {}
  var fp = sanitizeAuditText(computeDeviceFingerprint(req), 64);
  var dwell = null;
  if (meta && meta.dwell_seconds != null) {
    var ds = parseInt(meta.dwell_seconds, 10);
    if (isFinite(ds) && ds >= 0 && ds <= 86400) {
      dwell = ds;
    }
  }
  var metaJson = null;
  try {
    var mj = sanitizeAuditObjectTopLevel(meta);
    if (mj) {
      metaJson = JSON.stringify(mj).substring(0, 1024);
    }
  } catch (e1) {}
  var ip = sanitizeAuditText(getClientIp(req), 128);
  var ua = sanitizeAuditText(normalizeUserAgentHeader(req), 512);
  pool
    .execute(
      `INSERT INTO install_guide_track_events
       (client_id, device_fp, event_key, dwell_seconds, meta_json, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [cid || null, fp || null, act.substring(0, 80), dwell, metaJson, ip || null, ua || null]
    )
    .catch(function (e) {
      console.error('recordInstallGuideTrackEvent', e);
    });
}

function installGuideEventLabel(eventKey) {
  var k = String(eventKey || '').trim();
  return INSTALL_GUIDE_EVENT_LABELS[k] || k;
}

function truncateInstallGuideVisitorKey(key) {
  var visitor = key ? String(key) : '—';
  if (visitor.length > 14) {
    return visitor.substring(0, 7) + '…' + visitor.substring(visitor.length - 4);
  }
  return visitor;
}

function installGuideDeviceSummaryFromUa(uaRaw) {
  var ua = uaRaw != null ? String(uaRaw).trim() : '';
  if (!ua) {
    return '—';
  }
  var c = classifyUserDeviceRow(ua, null);
  var parts = [];
  if (c.model_label) {
    parts.push(c.model_label);
  }
  if (c.os_version) {
    parts.push(c.os_version);
  } else if (c.os_key && DEVICE_STATS_OS_FAMILY_LABEL[c.os_key]) {
    parts.push(DEVICE_STATS_OS_FAMILY_LABEL[c.os_key]);
  }
  if (parts.length) {
    return parts.join(' · ');
  }
  return ua.length > 100 ? ua.substring(0, 100) + '…' : ua;
}

function buildInstallGuideRecentVisitors(rows, maxVisitors) {
  maxVisitors = maxVisitors || 20;
  var groups = {};
  (rows || []).forEach(function (r) {
    var cid = r.client_id ? String(r.client_id).trim() : '';
    var fp = r.device_fp ? String(r.device_fp).trim() : '';
    var vid = cid || fp;
    if (!vid) {
      vid = 'row_' + String(r.id != null ? r.id : '');
    }
    if (!groups[vid]) {
      groups[vid] = {
        visitor_id: vid,
        visitor_key: truncateInstallGuideVisitorKey(vid),
        ip: '',
        device_label: '—',
        user_agent: '',
        latest_at: 0,
        events: []
      };
    }
    var g = groups[vid];
    var at = r.created_at ? r.created_at.toISOString() : '';
    var atMs = r.created_at ? new Date(r.created_at).getTime() : 0;
    if (atMs >= g.latest_at) {
      g.latest_at = atMs;
      if (r.ip) {
        g.ip = String(r.ip);
      }
      if (r.user_agent) {
        g.user_agent = String(r.user_agent);
        g.device_label = installGuideDeviceSummaryFromUa(g.user_agent);
      }
    }
    if (!g.ip && r.ip) {
      g.ip = String(r.ip);
    }
    if (!g.user_agent && r.user_agent) {
      g.user_agent = String(r.user_agent);
      g.device_label = installGuideDeviceSummaryFromUa(g.user_agent);
    }
    var ek = String(r.event_key || '');
    var ds = r.dwell_seconds != null ? Number(r.dwell_seconds) : null;
    g.events.push({
      at: at,
      event_key: ek,
      label: installGuideEventLabel(ek),
      dwell_seconds: isFinite(ds) ? ds : null,
      dwell_label: isFinite(ds) ? formatStaySecondsLabel(ds) : '—'
    });
  });
  var list = Object.keys(groups).map(function (k) {
    var item = groups[k];
    item.events.sort(function (a, b) {
      return String(b.at).localeCompare(String(a.at));
    });
    return item;
  });
  list.sort(function (a, b) {
    return (b.latest_at || 0) - (a.latest_at || 0);
  });
  return list.slice(0, maxVisitors);
}

function medianFromSortedNumbers(arr) {
  if (!arr || !arr.length) {
    return null;
  }
  var mid = Math.floor(arr.length / 2);
  if (arr.length % 2 === 1) {
    return arr[mid];
  }
  return Math.round((arr[mid - 1] + arr[mid]) / 2);
}

function touchUserDailyActivity(username) {
  if (!pool || username == null) {
    return;
  }
  var u = String(username).trim();
  if (!u) {
    return;
  }
  pool
    .execute('INSERT IGNORE INTO user_daily_activity (activity_date, username) VALUES (CURDATE(), ?)', [
      u.substring(0, 255)
    ])
    .catch(function (e) {
      console.error('touchUserDailyActivity', e);
    });
}

function normalizeUserAgentHeader(req) {
  return String((req.headers && req.headers['user-agent']) || '').trim().substring(0, 500);
}

/** 客户端请求头 X-Client-Device（JSON）允许的字段与最大长度 */
var CLIENT_DEVICE_FIELD_LIMITS = {
  client_id: 128,
  source: 32,
  platform: 64,
  os_version: 64,
  app_version: 64,
  model: 128,
  brand: 64,
  screen: 32,
  user_agent: 400,
  language: 32,
  locale: 32,
  timezone: 64,
  dpr: 16,
  extra: 1024
};

function sanitizeClientDevicePayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  var out = {};
  Object.keys(CLIENT_DEVICE_FIELD_LIMITS).forEach(function (k) {
    var lim = CLIENT_DEVICE_FIELD_LIMITS[k];
    if (raw[k] == null || raw[k] === '') {
      return;
    }
    if (k === 'dpr') {
      var n = Number(raw[k]);
      if (!isNaN(n)) {
        out[k] = String(Math.round(n * 100) / 100).substring(0, lim);
      }
      return;
    }
    var s = String(raw[k])
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
      .substring(0, lim);
    if (s) {
      out[k] = s;
    }
  });
  return Object.keys(out).length ? out : null;
}

function readClientDeviceFromRequest(req) {
  var raw = req.headers['x-client-device'];
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  var s = raw.trim();
  if (!s || s.length > 8192) {
    return null;
  }
  try {
    var o = JSON.parse(s);
    return sanitizeClientDevicePayload(o);
  } catch (e) {
    return null;
  }
}

function fingerprintFromExplicitDevice(obj) {
  var cid = obj.client_id ? String(obj.client_id).trim() : '';
  if (cid) {
    return crypto.createHash('sha256').update('ex:' + cid, 'utf8').digest('hex');
  }
  var keys = Object.keys(obj).sort();
  var stable = {};
  keys.forEach(function (k) {
    stable[k] = obj[k];
  });
  return crypto.createHash('sha256').update('exobj:' + JSON.stringify(stable), 'utf8').digest('hex');
}

function computeDeviceFingerprint(req) {
  var ex = req.clientDevicePayload;
  if (ex && Object.keys(ex).length > 0) {
    return fingerprintFromExplicitDevice(ex);
  }
  var ua = normalizeUserAgentHeader(req);
  var plat = '';
  if (req.headers) {
    plat =
      String(req.headers['sec-ch-ua-platform'] || req.headers['sec-ch-ua-mobile'] || '').trim();
  }
  return crypto.createHash('sha256').update(ua + '|' + plat, 'utf8').digest('hex');
}

function userAgentShortForStore(req) {
  var s = normalizeUserAgentHeader(req);
  if (s.length <= 220) {
    return s;
  }
  return s.substring(0, 220) + '…';
}

function displayUserAgentFromDevice(req) {
  var ex = req.clientDevicePayload;
  if (ex && ex.user_agent) {
    var u = String(ex.user_agent);
    if (u.length <= 220) {
      return u;
    }
    return u.substring(0, 220) + '…';
  }
  return userAgentShortForStore(req);
}

function syncUserDeviceFromClientJson(req, username) {
  if (!pool || !username) {
    return Promise.resolve();
  }
  var ex = req.clientDevicePayload;
  if (!ex || !Object.keys(ex).length) {
    return Promise.resolve();
  }
  var fp = fingerprintFromExplicitDevice(ex);
  var detailJson = JSON.stringify(ex);
  var clientId = ex.client_id ? String(ex.client_id).substring(0, 128) : null;
  var ip = getClientIp(req);
  var city = cityLabelFromIp(ip);
  var uaDisp = displayUserAgentFromDevice(req);
  return pool
    .execute(
      `INSERT INTO user_devices (username, device_fp, user_agent_short, ip_last, city_last, login_count, client_id, device_detail_json, api_sync_count)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         user_agent_short = VALUES(user_agent_short),
         ip_last = VALUES(ip_last),
         city_last = VALUES(city_last),
         device_detail_json = VALUES(device_detail_json),
         client_id = COALESCE(VALUES(client_id), client_id),
         api_sync_count = api_sync_count + 1,
         last_seen = CURRENT_TIMESTAMP`,
      [String(username).trim().substring(0, 255), fp, uaDisp, ip.substring(0, 128), city.substring(0, 255), clientId, detailJson]
    )
    .catch(function (e) {
      console.error('syncUserDeviceFromClientJson', e);
    });
}

async function recordUserRegistrationAttempt(username, ok, req, reason) {
  var uname = username != null && String(username).trim() !== '' ? String(username).trim() : '(register)';
  await recordUserLoginAttempt(uname, ok, req, reason);
  if (ok && username) {
    await syncUserDeviceFromClientJson(req, String(username).trim());
  }
}

async function recordUserLoginAttempt(username, ok, req, reason) {
  if (!pool || !username) {
    return;
  }
  var uname = String(username).trim().substring(0, 255);
  if (!uname) {
    return;
  }
  var ip = getClientIp(req);
  var city = cityLabelFromIp(ip);
  var ua = normalizeUserAgentHeader(req);
  var fp = computeDeviceFingerprint(req);
  var ex = req.clientDevicePayload;
  var detailJson = ex ? JSON.stringify(ex) : null;
  var clientId = ex && ex.client_id ? String(ex.client_id).substring(0, 128) : null;
  var uaDisp = displayUserAgentFromDevice(req);
  var reasonKey = sanitizeAuditText(ok ? 'ok' : normalizeUserLoginFailReason(reason), 120);
  var reasonDetail = ok ? null : sanitizeAuditText(reason != null ? String(reason) : '', 255) || null;
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      `INSERT INTO user_login_events (username, ok, reason, reason_detail, ip, city, user_agent, device_fp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uname,
        ok ? 1 : 0,
        reasonKey || null,
        reasonDetail,
        ip.substring(0, 128),
        city.substring(0, 255),
        ua.substring(0, 512),
        fp
      ]
    );
    if (ok) {
      await conn.execute(
        `INSERT INTO user_devices (username, device_fp, user_agent_short, ip_last, city_last, login_count, client_id, device_detail_json, api_sync_count)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0)
         ON DUPLICATE KEY UPDATE
           user_agent_short = VALUES(user_agent_short),
           ip_last = VALUES(ip_last),
           city_last = VALUES(city_last),
           login_count = login_count + 1,
           client_id = COALESCE(VALUES(client_id), client_id),
           device_detail_json = COALESCE(VALUES(device_detail_json), device_detail_json),
           last_seen = CURRENT_TIMESTAMP`,
        [uname, fp, uaDisp, ip.substring(0, 128), city.substring(0, 255), clientId, detailJson]
      );
    }
  } catch (e) {
    console.error('recordUserLoginAttempt', e);
  } finally {
    conn.release();
  }
}

function normalizeUserLoginFailReason(rawMsg) {
  var msg = String(rawMsg || '').trim();
  if (!msg) return 'unknown_error';
  if (msg.indexOf('请输入密码') >= 0) return 'empty_password';
  if (msg.indexOf('账号已被封禁') >= 0 || msg.indexOf('封禁') >= 0) return 'account_banned';
  if (msg.indexOf('密码错误') >= 0 && msg.indexOf('激活码') >= 0) return 'wrong_password';
  if (msg.indexOf('账号或密码错误') >= 0) return 'invalid_credentials';
  if (
    msg.indexOf('账号仅支持') >= 0 ||
    msg.indexOf('账号长度') >= 0 ||
    msg.indexOf('请输入账号') >= 0 ||
    msg.indexOf('账号不能为空') >= 0
  ) {
    return 'invalid_username';
  }
  return 'other_error';
}

function userLoginReasonLabel(reason) {
  var k = String(reason || '').trim();
  return USER_LOGIN_REASON_LABELS[k] || k || '未知错误';
}

function userLoginReasonDisplayLabel(reasonKey, reasonDetail) {
  var label = userLoginReasonLabel(reasonKey);
  var detail = reasonDetail != null ? String(reasonDetail).trim() : '';
  if (!detail || String(reasonKey || '').trim() === 'ok') {
    return label;
  }
  if (detail === label) {
    return label;
  }
  if (String(reasonKey || '').trim() === 'other_error' || String(reasonKey || '').trim() === 'unknown_error') {
    return label + '（' + detail + '）';
  }
  return label;
}

function userLoginReasonKeysForFuzzyQuery(q) {
  q = q != null ? String(q).trim() : '';
  if (!q) return [];
  var ql = q.toLowerCase();
  var keys = [];
  Object.keys(USER_LOGIN_REASON_LABELS).forEach(function (k) {
    if (k.toLowerCase().indexOf(ql) >= 0 || String(USER_LOGIN_REASON_LABELS[k]).indexOf(q) >= 0) {
      keys.push(k);
    }
  });
  return keys;
}

function appendUserLoginReasonFuzzyFilter(whereClauses, params, qReason) {
  qReason = qReason != null ? String(qReason).trim() : '';
  if (!qReason) return;
  var parts = ['reason LIKE ?'];
  params.push('%' + qReason + '%');
  var matchedKeys = userLoginReasonKeysForFuzzyQuery(qReason);
  if (matchedKeys.length) {
    parts.push(
      'reason IN (' +
        matchedKeys
          .map(function () {
            return '?';
          })
          .join(',') +
        ')'
    );
    matchedKeys.forEach(function (k) {
      params.push(k);
    });
  }
  whereClauses.push('(' + parts.join(' OR ') + ')');
}

function appendUserLoginReasonFilter(whereClauses, params, qReason) {
  qReason = qReason != null ? String(qReason).trim() : '';
  if (!qReason) return;
  if (Object.prototype.hasOwnProperty.call(USER_LOGIN_REASON_LABELS, qReason)) {
    whereClauses.push('reason = ?');
    params.push(qReason);
    return;
  }
  appendUserLoginReasonFuzzyFilter(whereClauses, params, qReason);
}

const USER_LOGIN_REASON_LABELS = {
  ok: '成功',
  empty_password: '密码为空',
  account_banned: '账号已封禁',
  invalid_credentials: '账号或密码错误',
  wrong_password: '密码错误',
  invalid_username: '账号格式错误',
  other_error: '其他错误',
  unknown_error: '未知错误',
  register_ok: '注册成功',
  'register_fail:duplicate': '注册-账号已存在',
  'register_fail:rate_burst': '注册-频率过快',
  'register_fail:rate_ip_day': '注册-IP日上限',
  'register_fail:rate_fp_day': '注册-设备日上限',
  'register_fail:backoff': '注册-失败退避',
  'register_fail:captcha': '注册-验证码错误',
  'register_fail:invalid_client': '注册-非官方客户端',
  'register_fail:validation': '注册-参数校验失败'
};

/** 将含记录 ID / 查询参数的 track_jump_* 合并为「页面级」一条，便于管理台统计 */
function collapseTrackJumpEventKey(eventKey) {
  var k = String(eventKey || '')
    .trim()
    .toLowerCase();
  if (!k || k.indexOf('track_jump_') !== 0) {
    return k;
  }
  if (k.indexOf('history_back') >= 0) {
    return 'track_jump__history_back__';
  }
  var m = k.match(/^track_jump_([a-z0-9]+)_html(.*)$/);
  if (!m) {
    return k;
  }
  var base = 'track_jump_' + m[1] + '_html';
  var rest = m[2] || '';
  if (!rest) {
    return base;
  }
  if (rest.indexOf('_tab_') === 0) {
    var tabM = rest.match(/^(_tab_[a-z0-9_]+)/);
    if (tabM) {
      return base + tabM[1];
    }
  }
  if (
    /_id_tr_/i.test(rest) ||
    /^_id_/i.test(rest) ||
    /_year_\d{4}/i.test(rest) ||
    /_tr_[a-z0-9_]{6,}/i.test(rest) ||
    /\d{8,}/.test(rest)
  ) {
    return base;
  }
  return k;
}

function normalizeTrackEventKeyFromRoute(routeKey) {
  var rk = String(routeKey || '').trim();
  if (!rk) return '';
  var eventKey = '';
  if (rk.indexOf('EVENT ') === 0) {
    eventKey = rk.substring(6).trim();
  } else {
    var i = rk.indexOf('#track_');
    if (i >= 0) {
      eventKey = rk.substring(i + 1).trim();
    }
  }
  if (!eventKey) return '';
  return collapseTrackJumpEventKey(eventKey);
}

function sanitizeAuditText(val, maxLen) {
  var s = String(val == null ? '' : val)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .trim();
  if (!s) return '';
  var lim = isFinite(maxLen) && maxLen > 0 ? (maxLen | 0) : 255;
  if (s.length > lim) s = s.substring(0, lim);
  return s;
}

function sanitizeAuditObjectTopLevel(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  var out = {};
  var keys = Object.keys(raw).slice(0, 40);
  keys.forEach(function (k) {
    var key = sanitizeAuditText(k, 80);
    if (!key) return;
    var v = raw[k];
    if (v == null) return;
    if (/pass|pwd|token|authorization|secret/i.test(key)) {
      out[key] = '***';
      return;
    }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[key] = sanitizeAuditText(v, 160);
      return;
    }
    if (Array.isArray(v)) {
      out[key] = '[array:' + v.length + ']';
      return;
    }
    if (typeof v === 'object') {
      out[key] = '[object]';
    }
  });
  return Object.keys(out).length ? out : null;
}

function adminDeviceDesc(req) {
  var ex = req && req.clientDevicePayload;
  if (ex && typeof ex === 'object') {
    var bits = [];
    if (ex.source) bits.push(String(ex.source));
    if (ex.platform) bits.push(String(ex.platform));
    if (ex.model) bits.push(String(ex.model));
    if (ex.os_version) bits.push('OS ' + String(ex.os_version));
    if (ex.app_version) bits.push('App ' + String(ex.app_version));
    var merged = sanitizeAuditText(bits.join(' · '), 255);
    if (merged) return merged;
  }
  return sanitizeAuditText(displayUserAgentFromDevice(req), 255);
}

function buildAdminRequestBrief(req) {
  if (!req) return '';
  var parts = [];
  var qObj = sanitizeAuditObjectTopLevel(req.query);
  var bObj = sanitizeAuditObjectTopLevel(req.body);
  if (qObj) {
    parts.push('query=' + JSON.stringify(qObj));
  }
  if (bObj) {
    parts.push('body=' + JSON.stringify(bObj));
  }
  return sanitizeAuditText(parts.join(' | '), 1024);
}

async function recordAdminLoginAttempt(adminUsername, ok, reason, req) {
  if (!pool) return;
  var uname = sanitizeAuditText(adminUsername, 255);
  if (!uname) uname = 'unknown';
  var ip = sanitizeAuditText(getClientIp(req), 128);
  var city = sanitizeAuditText(cityLabelFromIp(ip), 255);
  var ua = sanitizeAuditText(normalizeUserAgentHeader(req), 512);
  var fp = sanitizeAuditText(computeDeviceFingerprint(req), 64);
  var deviceDesc = adminDeviceDesc(req);
  var why = sanitizeAuditText(reason, 255);
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      `INSERT INTO admin_login_events
       (admin_username, ok, reason, ip, city, user_agent, device_fp, device_desc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uname, ok ? 1 : 0, why || null, ip || null, city || null, ua || null, fp || null, deviceDesc || null]
    );
  } catch (e) {
    console.error('recordAdminLoginAttempt', e);
  } finally {
    conn.release();
  }
}

async function recordAdminOperationLog(req, res) {
  if (!pool || !req || !req.admin || !res) return;
  var p = sanitizeAuditText(req.path || '', 255);
  if (!p || p === '/api/admin/login' || p === '/api/admin/admin-login-logs' || p === '/api/admin/admin-operation-logs') {
    return;
  }
  var method = sanitizeAuditText(String(req.method || '').toUpperCase(), 16) || 'GET';
  var adminUsername = sanitizeAuditText(req.admin.username, 255);
  var adminFullName = sanitizeAuditText(req.admin.full_name || '', 255);
  if (!adminUsername) return;
  var action = '';
  if (req.body && req.body.action != null && String(req.body.action).trim() !== '') {
    action = sanitizeAuditText(req.body.action, 120);
  } else if (req.query && req.query.action != null && String(req.query.action).trim() !== '') {
    action = sanitizeAuditText(req.query.action, 120);
  }
  var targetUsername = '';
  var src = req.body && typeof req.body === 'object' ? req.body : req.query;
  if (src && src.username != null && String(src.username).trim() !== '') {
    targetUsername = sanitizeAuditText(src.username, 255);
  } else if (src && src.user_id != null && String(src.user_id).trim() !== '') {
    targetUsername = sanitizeAuditText(src.user_id, 255);
  }
  var info = classifyAnalyticsRoute(req);
  var routeKey = info && info.route_key ? sanitizeAuditText(info.route_key, 240) : '';
  var ip = sanitizeAuditText(getClientIp(req), 128);
  var city = sanitizeAuditText(cityLabelFromIp(ip), 255);
  var ua = sanitizeAuditText(normalizeUserAgentHeader(req), 512);
  var fp = sanitizeAuditText(computeDeviceFingerprint(req), 64);
  var deviceDesc = adminDeviceDesc(req);
  var statusCode = Number(res.statusCode || 0);
  var bizCode = null;
  if (res.__adminBizCode != null && isFinite(Number(res.__adminBizCode))) {
    bizCode = Number(res.__adminBizCode);
  }
  var ok = statusCode < 400 && (bizCode == null || bizCode === 200);
  var reqBrief = buildAdminRequestBrief(req);
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      `INSERT INTO admin_operation_logs
       (admin_username, admin_full_name, method, path, route_key, action, target_username, request_brief,
        ip, city, user_agent, device_fp, device_desc, status_code, biz_result_code, ok)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        adminUsername,
        adminFullName || null,
        method,
        p,
        routeKey || null,
        action || null,
        targetUsername || null,
        reqBrief || null,
        ip || null,
        city || null,
        ua || null,
        fp || null,
        deviceDesc || null,
        statusCode,
        bizCode,
        ok ? 1 : 0
      ]
    );
  } catch (e) {
    console.error('recordAdminOperationLog', e);
  } finally {
    conn.release();
  }
}

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(function attachClientDevicePayload(req, res, next) {
  req.clientDevicePayload = readClientDeviceFromRequest(req);
  next();
});
app.use(analyticsFinishMiddleware);

/** 扫码验证纳税记录开具：无需登录，仅返回非敏感摘要 */
async function handleTaxVerifyIssueGet(req, res) {
  var code = String(req.query.code != null ? req.query.code : '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase();
  var recordNo = String(req.query.record != null ? req.query.record : '')
    .trim()
    .substring(0, 32);
  if (!/^[A-Z0-9]{16}$/.test(code)) {
    return res.json({ code: 400, msg: '无效的查询验证码', data: { found: false } });
  }
  const conn = await pool.getConnection();
  try {
    var sql =
      "SELECT apply_time, period_start, period_end, record_no, scope, status, query_code FROM tax_issue_applications WHERE UPPER(REPLACE(TRIM(IFNULL(query_code,'')), ' ', '')) = ?";
    var params = [code];
    if (recordNo) {
      sql += ' AND record_no = ?';
      params.push(recordNo);
    }
    sql += ' ORDER BY updated_at DESC LIMIT 1';
    const [rows] = await conn.execute(sql, params);
    if (!rows.length) {
      return res.json({ code: 200, msg: '未查询到与该验证码匹配的开具记录', data: { found: false } });
    }
    var r = rows[0];
    return res.json({
      code: 200,
      msg: '成功',
      data: {
        found: true,
        record_no: r.record_no != null ? String(r.record_no) : '',
        period_start: r.period_start != null ? String(r.period_start) : '',
        period_end: r.period_end != null ? String(r.period_end) : '',
        apply_time: r.apply_time != null ? String(r.apply_time) : '',
        scope: r.scope != null ? String(r.scope) : '',
        status: r.status != null ? String(r.status) : ''
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  } finally {
    conn.release();
  }
}

async function handleTaxGet(req, res) {
  var action = req.query.action;
  if (action === 'detail') {
    var userId = req.authUserId;
    var rid = req.query.id;
    if (userId == null || userId === '' || rid == null || rid === '') {
      return res.status(400).json({ code: 400, msg: 'user_id and id required' });
    }
    try {
      var rec = await getTaxRecordById(userId, rid);
      if (!rec) {
        return res.status(404).json({ code: 404, msg: '记录不存在' });
      }
      return res.json({
        code: 200,
        msg: '成功',
        data: formatTaxDetailResponse(rec, String(userId))
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ code: 500, msg: String(e.message) });
    }
  }
  if (action === 'calculation') {
    var uidCalc = req.authUserId;
    var ridCalc = req.query.id;
    if (uidCalc == null || uidCalc === '' || ridCalc == null || ridCalc === '') {
      return res.status(400).json({ code: 400, msg: 'id required' });
    }
    try {
      var calc = await getTaxCalculationData(uidCalc, ridCalc);
      if (!calc) {
        return res.status(404).json({ code: 404, msg: '记录不存在' });
      }
      return res.json({ code: 200, msg: '成功', data: calc });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ code: 500, msg: String(e.message) });
    }
  }
  if (action === 'deleted_records') {
    var uidBin = req.authUserId;
    if (uidBin == null || uidBin === '') {
      return res.status(400).json({ code: 400, msg: 'user_id required' });
    }
    try {
      var deletedRows = await getDeletedTaxRecords(uidBin);
      return res.json({
        code: 200,
        data: {
          count: deletedRows.length,
          records: deletedRows
        }
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ code: 500, msg: String(e.message) });
    }
  }
  if (action !== 'records') {
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  }
  var userId = req.authUserId;
  if (userId == null || userId === '') {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  var year = req.query.year;
  try {
    var data = await getRecords(userId, year);
    res.json({ code: 200, data: data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleMessageGet(req, res) {
  var action = req.query.action;
  var userId = req.authUserId;
  if (userId == null || userId === '') {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  if (action === 'detail') {
    var detailId = req.query.id;
    if (detailId == null || detailId === '') {
      return res.status(400).json({ code: 400, msg: 'id required' });
    }
    try {
      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.execute(
          'SELECT id, user_id, title, content, company_name, msg_date, is_read, created_at FROM messages WHERE id = ? AND user_id = ? LIMIT 1',
          [String(detailId), String(userId)]
        );
        if (!rows.length) {
          return res.status(404).json({ code: 404, msg: '消息不存在' });
        }
        await conn.execute('UPDATE messages SET is_read = 1 WHERE id = ? AND user_id = ?', [
          String(detailId),
          String(userId)
        ]);
        var r = rows[0];
        return res.json({
          code: 200,
          data: {
            id: r.id,
            title: r.title,
            content: r.content,
            company_name: r.company_name,
            msg_date: r.msg_date,
            is_read: 1,
            created_at: r.created_at ? r.created_at.toISOString() : null
          }
        });
      } finally {
        conn.release();
      }
    } catch (e) {
      console.error(e);
      return res.status(500).json({ code: 500, msg: String(e.message) });
    }
  }
  if (action !== 'list') {
    return res.status(400).json({ code: 400, msg: 'action=list or detail required' });
  }
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      'SELECT id, user_id, title, content, company_name, msg_date, is_read, created_at FROM messages WHERE user_id = ? ORDER BY msg_date DESC, created_at DESC',
      [String(userId)]
    );
    conn.release();
    var out = rows.map(function (r) {
      return {
        id: r.id,
        title: r.title,
        content: r.content,
        company_name: r.company_name,
        msg_date: r.msg_date,
        is_read: r.is_read != null ? Number(r.is_read) : 0
      };
    });
    res.json({ code: 200, data: out });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleMessagePost(req, res) {
  var body = req.body || {};
  var action = body.action;
  var userId = req.authUserId;
  if (userId == null || userId === '') {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  const conn = await pool.getConnection();
  try {
    if (action === 'add_message') {
      var mid = 'msg_' + Date.now();
      var title = body.title != null ? String(body.title) : '';
      var content = body.content != null ? String(body.content) : '';
      var companyName = body.company_name != null ? String(body.company_name) : '';
      var msgDate = body.msg_date != null ? String(body.msg_date) : '';
      var isRead = body.is_read != null ? (Number(body.is_read) ? 1 : 0) : 1;
      await conn.execute(
        `INSERT INTO messages (id, user_id, title, content, company_name, msg_date, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [mid, String(userId), title, content, companyName, msgDate, isRead]
      );
      return res.json({ code: 200, data: { id: mid } });
    }
    if (action === 'delete_message') {
      var delId = body.id;
      if (delId == null || delId === '') {
        return res.status(400).json({ code: 400, msg: 'id required' });
      }
      await conn.execute('DELETE FROM messages WHERE id = ? AND user_id = ?', [String(delId), String(userId)]);
      return res.json({ code: 200, data: { success: true } });
    }
    if (action === 'mark_all_read') {
      await conn.execute('UPDATE messages SET is_read = 1 WHERE user_id = ?', [String(userId)]);
      return res.json({ code: 200, data: { success: true } });
    }
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  } finally {
    conn.release();
  }
}

async function handleFeedbackGet(req, res) {
  var action = req.query.action;
  var userId = req.authUserId;
  if (userId == null || userId === '') {
    return res.status(400).json({ code: 400, msg: '需已登录' });
  }
  if (action === 'config') {
    try {
      var qrRef = await getWechatPayQrcodeUrl();
      var installRaw = await getInstallPackageSettingsFromDb();
      var xianyuText = sanitizeXianyuPurchaseText(installRaw.xianyu);
      var hideXianyu = await shouldHideXianyuForRequest(req);
      return res.json({
        code: 200,
        data: feedbackConfigPayload(qrRef, hideXianyu, hideXianyu ? '' : xianyuText)
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ code: 500, msg: String(e.message) });
    }
  }
  if (action !== 'list') {
    return res.status(400).json({ code: 400, msg: 'action=list 或 config' });
  }
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      `SELECT id, feedback_type, content, admin_reply, replied_at, created_at
       FROM user_feedback WHERE user_id = ? ORDER BY id DESC LIMIT 200`,
      [String(userId)]
    );
    conn.release();
    var qrRef = await getWechatPayQrcodeUrl();
    var installRaw = await getInstallPackageSettingsFromDb();
    var xianyuText = sanitizeXianyuPurchaseText(installRaw.xianyu);
    var hideXianyu = await shouldHideXianyuForRequest(req);
    var fbCfg = feedbackConfigPayload(qrRef, hideXianyu, hideXianyu ? '' : xianyuText);
    var out = rows.map(function (r) {
      return {
        id: r.id,
        feedback_type: r.feedback_type,
        content: r.content,
        admin_reply: r.admin_reply,
        replied_at: r.replied_at ? r.replied_at.toISOString() : null,
        created_at: r.created_at ? r.created_at.toISOString() : ''
      };
    });
    res.json({
      code: 200,
      data: Object.assign(
        {
          items: out
        },
        fbCfg
      )
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleFeedbackPost(req, res) {
  var body = req.body || {};
  var userId = req.authUserId;
  if (userId == null || userId === '') {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  var fbType = body.feedback_type != null ? String(body.feedback_type).trim() : '';
  var content = body.content != null ? String(body.content).trim() : '';
  if (fbType !== 'bug' && fbType !== 'suggestion') {
    return res.status(400).json({ code: 400, msg: 'feedback_type 须为 bug 或 suggestion' });
  }
  if (!content || content.length > 4000) {
    return res.status(400).json({ code: 400, msg: '内容不能为空且不超过 4000 字' });
  }
  try {
    var snap = '';
    try {
      var urow = await getUserRowByUsername(userId);
      snap = urow && urow.real_name != null ? String(urow.real_name).substring(0, 255) : '';
    } catch (e1) {
      console.error('handleFeedbackPost snapshot', e1);
    }
    const conn = await pool.getConnection();
    try {
      const [ins] = await conn.execute(
        `INSERT INTO user_feedback (user_id, real_name_snapshot, feedback_type, content) VALUES (?, ?, ?, ?)`,
        [String(userId), snap || null, fbType, content]
      );
      return res.json({ code: 200, data: { id: ins.insertId } });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

var SHENBAO_DEFAULT_RECORDS = [
  {
    id: '1',
    groupMonth: '2026-03',
    title: '2025年度综合所得年度汇算',
    periodStart: '2025-01',
    periodEnd: '2025-12',
    amountType: 'refunded',
    amount: '0.00'
  },
  {
    id: '2',
    groupMonth: '2025-03',
    title: '2024年度综合所得年度汇算',
    periodStart: '2024-01',
    periodEnd: '2024-12',
    amountType: 'refunded',
    amount: '0.00'
  },
  {
    id: '3',
    groupMonth: '2024-03',
    title: '2023年度综合所得年度汇算',
    periodStart: '2023-01',
    periodEnd: '2023-12',
    amountType: 'refunded',
    amount: '0.00'
  },
  {
    id: '4',
    groupMonth: '2023-05',
    title: '2022年度综合所得年度汇算',
    periodStart: '2022-01',
    periodEnd: '2022-12',
    amountType: 'refunded',
    amount: '0.00'
  },
  {
    id: '5',
    groupMonth: '2022-06',
    title: '2021年度综合所得年度汇算',
    periodStart: '2021-01',
    periodEnd: '2021-12',
    amountType: 'paid',
    amount: '0.00'
  }
];

var SHENBAO_DETAIL_FIELD_DEFAULTS = {
  supplementTax: '1632.86',
  lateFee: '0.00',
  paidThisTime: '1632.86',
  refundedThisTime: '0.00',
  taxAuthority: '国家税务总局昆明市税务局第一税务分局（重点税源企业税收服务和管理局）',
  employer: '云南白药集团股份有限公司',
  totalIncome: '194168.17',
  totalExpense: '0.00',
  exemptIncome: '0.00',
  basicDeduction: '60000.00',
  specialDeduction: '21686.88',
  specialAdditionalDeduction: '37000.00',
  otherDeduction: '665.56',
  donationDeduction: '0.00',
  taxableIncome: '74815.73',
  taxPayable: '4961.57',
  taxReduction: '0.00',
  taxPaid: '3328.71'
};

var SHENBAO_LIST_KEYS = {
  id: 1,
  groupMonth: 1,
  title: 1,
  periodStart: 1,
  periodEnd: 1,
  amountType: 1,
  amount: 1,
  detailCustomized: 1
};

function shenbaoTaxYearFromRecord(r) {
  if (r.taxYear) {
    return String(r.taxYear);
  }
  if (r.periodEnd && /^\d{4}/.test(String(r.periodEnd))) {
    return String(r.periodEnd).slice(0, 4);
  }
  if (r.groupMonth && /^\d{4}/.test(String(r.groupMonth))) {
    return String(r.groupMonth).slice(0, 4);
  }
  return '';
}

function shenbaoSyncListAmountFromSupplement(rec) {
  if (!rec) {
    return rec;
  }
  rec.amountType = 'refunded';
  if (rec.detailCustomized) {
    var sup = String(rec.supplementTax != null ? rec.supplementTax : '')
      .replace(/元/g, '')
      .trim();
    if (sup) {
      rec.amount = sup;
    }
  }
  return rec;
}

function shenbaoRecordFromRow(row) {
  var detail = {};
  if (row.detail_json) {
    try {
      detail = JSON.parse(row.detail_json);
    } catch (e) {
      detail = {};
    }
  }
  var rec = Object.assign(
    {
      id: row.id,
      groupMonth: row.group_month || '',
      title: row.title || '',
      periodStart: row.period_start || '',
      periodEnd: row.period_end || '',
      amountType: row.amount_type || 'refunded',
      amount: row.amount != null ? String(row.amount) : '0.00',
      detailCustomized: !!row.detail_customized
    },
    detail
  );
  return shenbaoSyncListAmountFromSupplement(rec);
}

function shenbaoMergeDetailRecord(r) {
  var out = Object.assign({}, SHENBAO_DETAIL_FIELD_DEFAULTS, r);
  out.taxYear = shenbaoTaxYearFromRecord(r);
  return out;
}

function shenbaoDesignDetailTemplate(r) {
  var out = Object.assign({}, SHENBAO_DETAIL_FIELD_DEFAULTS, {
    id: r.id,
    groupMonth: r.groupMonth,
    title: r.title,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    amountType: r.amountType,
    amount: r.amount,
    taxAuthority: r.taxAuthority || SHENBAO_DETAIL_FIELD_DEFAULTS.taxAuthority,
    employer: r.employer || SHENBAO_DETAIL_FIELD_DEFAULTS.employer
  });
  out.taxYear = shenbaoTaxYearFromRecord(r);
  return out;
}

function shenbaoRecordForDetail(rec) {
  if (!rec) {
    return null;
  }
  if (rec.detailCustomized) {
    return shenbaoMergeDetailRecord(rec);
  }
  return shenbaoDesignDetailTemplate(rec);
}

function shenbaoBuildDetailJson(record) {
  var detail = {};
  Object.keys(record || {}).forEach(function (k) {
    if (!SHENBAO_LIST_KEYS[k]) {
      detail[k] = record[k];
    }
  });
  return JSON.stringify(detail);
}

function shenbaoNormalizeIncomingRecord(record) {
  var rec = Object.assign({}, record || {});
  rec.id = String(rec.id != null ? rec.id : '').trim();
  if (!rec.id) {
    return null;
  }
  rec.groupMonth = String(rec.groupMonth != null ? rec.groupMonth : '').trim();
  rec.title = String(rec.title != null ? rec.title : '').trim();
  rec.periodStart = String(rec.periodStart != null ? rec.periodStart : '').trim();
  rec.periodEnd = String(rec.periodEnd != null ? rec.periodEnd : '').trim();
  rec.amountType = 'refunded';
  var supplement = String(rec.supplementTax != null ? rec.supplementTax : '')
    .replace(/元/g, '')
    .trim();
  var amt = supplement || String(rec.amount != null ? rec.amount : '0').replace(/元/g, '').trim() || '0.00';
  rec.amount = amt;
  rec.detailCustomized = rec.detailCustomized ? 1 : 0;
  return rec;
}

async function upsertShenbaoRecordInConn(conn, userId, tab, record) {
  var rec = shenbaoNormalizeIncomingRecord(record);
  if (!rec) {
    throw new Error('record.id required');
  }
  var detailJson = shenbaoBuildDetailJson(rec);
  await conn.execute(
    `INSERT INTO shenbao_jilu_records
      (user_id, tab, id, group_month, title, period_start, period_end, amount_type, amount, detail_json, detail_customized)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      group_month = VALUES(group_month),
      title = VALUES(title),
      period_start = VALUES(period_start),
      period_end = VALUES(period_end),
      amount_type = VALUES(amount_type),
      amount = VALUES(amount),
      detail_json = VALUES(detail_json),
      detail_customized = VALUES(detail_customized)`,
    [
      String(userId),
      tab,
      rec.id,
      rec.groupMonth,
      rec.title,
      rec.periodStart,
      rec.periodEnd,
      rec.amountType,
      rec.amount,
      detailJson,
      rec.detailCustomized ? 1 : 0
    ]
  );
  return rec;
}

async function seedShenbaoDefaultsIfEmpty(conn, userId, tab) {
  if (tab !== 'done') {
    return;
  }
  const [cntRows] = await conn.execute(
    'SELECT COUNT(*) AS c FROM shenbao_jilu_records WHERE user_id = ? AND tab = ?',
    [String(userId), tab]
  );
  var c = cntRows.length && cntRows[0].c != null ? Number(cntRows[0].c) : 0;
  if (c > 0) {
    return;
  }
  for (var i = 0; i < SHENBAO_DEFAULT_RECORDS.length; i++) {
    await upsertShenbaoRecordInConn(conn, userId, tab, SHENBAO_DEFAULT_RECORDS[i]);
  }
}

async function listShenbaoRecords(userId, tab) {
  const conn = await pool.getConnection();
  try {
    await seedShenbaoDefaultsIfEmpty(conn, userId, tab);
    const [rows] = await conn.execute(
      `SELECT * FROM shenbao_jilu_records WHERE user_id = ? AND tab = ?
       ORDER BY group_month DESC, id DESC`,
      [String(userId), tab]
    );
    return rows.map(shenbaoRecordFromRow);
  } finally {
    conn.release();
  }
}

async function getShenbaoRecord(userId, tab, id) {
  const conn = await pool.getConnection();
  try {
    await seedShenbaoDefaultsIfEmpty(conn, userId, tab);
    const [rows] = await conn.execute(
      'SELECT * FROM shenbao_jilu_records WHERE user_id = ? AND tab = ? AND id = ? LIMIT 1',
      [String(userId), tab, String(id)]
    );
    if (!rows.length) {
      return null;
    }
    return shenbaoRecordFromRow(rows[0]);
  } finally {
    conn.release();
  }
}

async function saveShenbaoRecord(userId, tab, record) {
  var rec = shenbaoNormalizeIncomingRecord(record);
  if (!rec) {
    throw new Error('record.id required');
  }
  rec.detailCustomized = 1;
  const conn = await pool.getConnection();
  try {
    await upsertShenbaoRecordInConn(conn, userId, tab, rec);
    const [rows] = await conn.execute(
      'SELECT * FROM shenbao_jilu_records WHERE user_id = ? AND tab = ? AND id = ? LIMIT 1',
      [String(userId), tab, rec.id]
    );
    if (!rows.length) {
      return shenbaoMergeDetailRecord(rec);
    }
    return shenbaoRecordForDetail(shenbaoRecordFromRow(rows[0]));
  } finally {
    conn.release();
  }
}

async function batchSaveShenbaoRecords(userId, tab, records) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (var i = 0; i < records.length; i++) {
      await upsertShenbaoRecordInConn(conn, userId, tab, records[i]);
    }
    await conn.commit();
    return { count: records.length };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function deleteShenbaoRecord(userId, tab, id) {
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      'DELETE FROM shenbao_jilu_records WHERE user_id = ? AND tab = ? AND id = ?',
      [String(userId), tab, String(id)]
    );
  } finally {
    conn.release();
  }
}

async function handleShenbaoJiluGet(req, res) {
  var action = req.query.action;
  var userId = req.authUserId;
  if (!userId) {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  var tab = String(req.query.tab || 'done').trim();
  if (tab !== 'done' && tab !== 'void') {
    return res.status(400).json({ code: 400, msg: 'invalid tab' });
  }
  try {
    if (action === 'list') {
      var list = await listShenbaoRecords(userId, tab);
      return res.json({ code: 200, data: { records: list } });
    }
    if (action === 'get') {
      var id = String(req.query.id || '').trim();
      if (!id) {
        return res.status(400).json({ code: 400, msg: 'id required' });
      }
      var row = await getShenbaoRecord(userId, tab, id);
      if (!row) {
        return res.status(404).json({ code: 404, msg: 'record not found' });
      }
      return res.json({ code: 200, data: { record: shenbaoRecordForDetail(row) } });
    }
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleShenbaoJiluPost(req, res) {
  var body = req.body || {};
  var action = body.action;
  var userId = req.authUserId;
  if (!userId) {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  var tab = String(body.tab || 'done').trim();
  if (tab !== 'done' && tab !== 'void') {
    return res.status(400).json({ code: 400, msg: 'invalid tab' });
  }
  try {
    if (action === 'save_record') {
      var record = body.record;
      if (!record || typeof record !== 'object') {
        return res.status(400).json({ code: 400, msg: 'record required' });
      }
      var saved = await saveShenbaoRecord(userId, tab, record);
      return res.json({ code: 200, data: { record: saved } });
    }
    if (action === 'batch_save') {
      var records = body.records;
      if (!Array.isArray(records) || !records.length) {
        return res.status(400).json({ code: 400, msg: 'records 须为非空数组' });
      }
      if (records.length > 100) {
        return res.status(400).json({ code: 400, msg: '单次最多写入 100 条' });
      }
      var batchOut = await batchSaveShenbaoRecords(userId, tab, records);
      return res.json({ code: 200, data: batchOut });
    }
    if (action === 'delete_record') {
      var delId = body.id;
      if (delId == null || String(delId).trim() === '') {
        return res.status(400).json({ code: 400, msg: 'id required' });
      }
      await deleteShenbaoRecord(userId, tab, delId);
      return res.json({ code: 200, data: {} });
    }
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleTaxPost(req, res) {
  var body = req.body || {};
  var action = body.action;
  var userId = req.authUserId;

  try {
    if (action === 'save_record' || action === 'add_record') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var record = body.record;
      if (!record || typeof record !== 'object') {
        return res.status(400).json({ code: 400, msg: 'record required' });
      }
      var out = await saveRecord(userId, record);
      var saveDedupeOut = await dedupeTaxRecords(userId);
      return res.json({
        code: 200,
        data: Object.assign({}, out, {
          auto_deduped: saveDedupeOut.deleted != null ? saveDedupeOut.deleted : 0
        })
      });
    }
    if (action === 'batch_save_records') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var records = body.records;
      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ code: 400, msg: 'records 须为非空数组' });
      }
      if (records.length > 600) {
        return res.status(400).json({ code: 400, msg: '单次最多写入 600 条记录' });
      }
      var batchOut = await batchSaveRecords(userId, records);
      return res.json({ code: 200, data: batchOut });
    }
    if (action === 'batch_replace_records') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var idsToDelete = body.ids_to_delete;
      var replaceRecords = body.records;
      if (!Array.isArray(idsToDelete)) {
        return res.status(400).json({ code: 400, msg: 'ids_to_delete 须为数组' });
      }
      if (!Array.isArray(replaceRecords) || replaceRecords.length === 0) {
        return res.status(400).json({ code: 400, msg: 'records 须为非空数组' });
      }
      if (idsToDelete.length > 600 || replaceRecords.length > 600) {
        return res.status(400).json({ code: 400, msg: '单次最多处理 600 条删除或写入' });
      }
      var replaceOut = await batchReplaceTaxRecords(userId, idsToDelete, replaceRecords);
      return res.json({ code: 200, data: replaceOut });
    }
    if (action === 'delete_record') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var id = body.id;
      if (id == null) {
        return res.status(400).json({ code: 400, msg: 'id required' });
      }
      await deleteRecord(userId, id);
      return res.json({ code: 200, data: {} });
    }
    if (action === 'delete_all_records') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var delAllOut = await deleteAllRecords(userId);
      return res.json({ code: 200, data: delAllOut });
    }
    if (action === 'restore_record') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var restoreId = body.id;
      if (restoreId == null || String(restoreId).trim() === '') {
        return res.status(400).json({ code: 400, msg: 'id required' });
      }
      var restoreOne = await restoreTaxRecord(userId, String(restoreId).trim());
      if (!restoreOne.restored) {
        return res.status(404).json({ code: 404, msg: '回收站中未找到该记录' });
      }
      return res.json({ code: 200, data: restoreOne });
    }
    if (action === 'restore_all_deleted_records') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var restoreAllOut = await restoreAllDeletedTaxRecords(userId);
      return res.json({ code: 200, data: restoreAllOut });
    }
    if (action === 'restore_records_by_company') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var restoreCompany = body.company_name != null ? String(body.company_name).trim() : '';
      if (!restoreCompany) {
        return res.status(400).json({ code: 400, msg: '请填写扣缴单位名称' });
      }
      var restoreCompanyOut = await restoreRecordsByCompany(userId, restoreCompany);
      if (!restoreCompanyOut.restored) {
        return res.status(404).json({ code: 404, msg: '回收站中未找到该单位的记录' });
      }
      return res.json({ code: 200, data: restoreCompanyOut });
    }
    if (action === 'delete_records_by_year') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var delYear = parseInt(body.year, 10);
      if (!delYear || delYear < 1990 || delYear > 2100) {
        return res.status(400).json({ code: 400, msg: '请填写合法年份（1990–2100）' });
      }
      var delOut = await deleteRecordsByYear(userId, delYear);
      return res.json({ code: 200, data: delOut });
    }
    if (action === 'delete_records_by_company') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var delCompany = body.company_name != null ? String(body.company_name).trim() : '';
      if (!delCompany) {
        return res.status(400).json({ code: 400, msg: '请填写扣缴单位名称' });
      }
      var delCompanyOut = await deleteRecordsByCompany(userId, delCompany);
      return res.json({ code: 200, data: delCompanyOut });
    }
    if (action === 'dedupe_records') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var dedupeOut = await dedupeTaxRecords(userId);
      return res.json({ code: 200, data: dedupeOut });
    }
    if (action === 'log_issue_application') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var appIn = body.application;
      if (!appIn || typeof appIn !== 'object') {
        return res.status(400).json({ code: 400, msg: 'application required' });
      }
      var issueId = String(appIn.id != null ? appIn.id : '').trim().substring(0, 128);
      if (!issueId) {
        return res.status(400).json({ code: 400, msg: 'application.id required' });
      }
      var ps = String(appIn.period_start != null ? appIn.period_start : '').trim().substring(0, 16);
      var pe = String(appIn.period_end != null ? appIn.period_end : '').trim().substring(0, 16);
      if (!ps || !pe) {
        return res.status(400).json({ code: 400, msg: 'application.period_start / period_end required' });
      }
      var applyTime = String(appIn.apply_time != null ? appIn.apply_time : '').trim().substring(0, 64);
      var recordNo = String(appIn.record_no != null ? appIn.record_no : '').trim().substring(0, 32);
      var scope = String(appIn.scope != null ? appIn.scope : '全国').trim().substring(0, 64) || '全国';
      var status = String(appIn.status != null ? appIn.status : '制作成功').trim().substring(0, 64) || '制作成功';
      var queryCode = String(appIn.query_code != null ? appIn.query_code : '').trim().substring(0, 32);
      const connIssue = await pool.getConnection();
      try {
        const [existRows] = await connIssue.execute('SELECT user_id FROM tax_issue_applications WHERE id = ?', [issueId]);
        if (existRows.length && String(existRows[0].user_id) !== String(userId)) {
          return res.status(403).json({ code: 403, msg: '无权写入该申请' });
        }
        if (existRows.length) {
          await connIssue.execute(
            `UPDATE tax_issue_applications SET apply_time = ?, period_start = ?, period_end = ?, record_no = ?, scope = ?, status = ?, query_code = ?
             WHERE id = ? AND user_id = ?`,
            [applyTime, ps, pe, recordNo, scope, status, queryCode, issueId, String(userId)]
          );
        } else {
          await connIssue.execute(
            `INSERT INTO tax_issue_applications (id, user_id, apply_time, period_start, period_end, record_no, scope, status, query_code)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [issueId, String(userId), applyTime, ps, pe, recordNo, scope, status, queryCode]
          );
        }
        return res.json({ code: 200, data: { id: issueId } });
      } finally {
        connIssue.release();
      }
    }
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

app.get('/api/tax.php', async function taxGetEntry(req, res) {
  if (String(req.query.action || '') === 'verify_issue') {
    try {
      await handleTaxVerifyIssueGet(req, res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) {
        res.status(500).json({ code: 500, msg: String(e.message) });
      }
    }
    return;
  }
  requireAuthAndActivatedUnlessAllowed(req, res, function () {
    handleTaxGet(req, res).catch(function (e) {
      console.error(e);
      if (!res.headersSent) {
        res.status(500).json({ code: 500, msg: String(e.message) });
      }
    });
  });
});
app.post('/api/tax.php', requireAuthAndActivatedUnlessAllowed, handleTaxPost);
app.get('/api/message.php', requireAuthAndActivatedUnlessAllowed, handleMessageGet);
app.post('/api/message.php', requireAuth, requireActivated, handleMessagePost);
app.get('/message.php', requireAuthAndActivatedUnlessAllowed, handleMessageGet);
app.post('/message.php', requireAuth, requireActivated, handleMessagePost);
app.get('/api/user.php', requireAuthAndActivatedUnlessAllowed, handleUserGet);
app.post('/api/user.php', requireAuthAndActivatedUnlessAllowed, handleUserPost);
app.get('/user.php', requireAuthAndActivatedUnlessAllowed, handleUserGet);
app.post('/user.php', requireAuthAndActivatedUnlessAllowed, handleUserPost);
app.get('/api/feedback.php', requireAuthAndActivatedUnlessAllowed, handleFeedbackGet);
app.post('/api/feedback.php', requireAuthAndActivatedUnlessAllowed, handleFeedbackPost);
app.get('/feedback.php', requireAuthAndActivatedUnlessAllowed, handleFeedbackGet);
app.post('/feedback.php', requireAuthAndActivatedUnlessAllowed, handleFeedbackPost);
app.get('/api/shenbao_jilu.php', requireAuth, requireActivated, handleShenbaoJiluGet);
app.post('/api/shenbao_jilu.php', requireAuth, requireActivated, handleShenbaoJiluPost);
app.get('/shenbao_jilu.php', requireAuth, requireActivated, handleShenbaoJiluGet);
app.post('/shenbao_jilu.php', requireAuth, requireActivated, handleShenbaoJiluPost);

async function handleAuthGet(req, res) {
  if (req.query.action === 'register_captcha') {
    return res.json({ code: 200, data: registerGuard.issueRegisterCaptcha() });
  }
  if (req.query.action !== 'status') {
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  }
  var auth = req.headers.authorization || '';
  var m = /^Bearer\s+(\S+)/i.exec(auth);
  var token = m ? m[1] : null;
  if (!token) {
    return res.status(401).json({ code: 401, msg: '请先登录' });
  }
  try {
    var payload = jwt.verify(token, JWT_SECRET);
    var uid = payload.sub;
    const conn = await pool.getConnection();
    const [rows] = await conn.execute('SELECT account_active FROM users WHERE username = ?', [uid]);
    conn.release();
    var active = rows.length && (rows[0].account_active === 1 || rows[0].account_active === true);
    return res.json({
      code: 200,
      data: { account_active: !!active, username: uid }
    });
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleActivatePost(req, res) {
  try {
    var uid = req.authUserId;
    var rec = await getUserRowByUsername(uid);
    if (!rec) {
      return res.status(400).json({ code: 400, msg: '用户不存在' });
    }
    var already =
      rec.account_active === 1 ||
      rec.account_active === true ||
      Number(rec.account_active) === 1;
    if (already) {
      var outOk = {
        user_id: rec.username,
        real_name: rec.real_name || rec.username,
        username: rec.username,
        account_active: true,
        is_test_account: rowUserTypeIsTest(rec),
        token: signAccessToken({
          user_id: rec.username,
          username: rec.username,
          account_active: true,
          session_rev: userSessionRevFromRow(rec)
        })
      };
      return res.json({ code: 200, data: outOk, msg: '账号已激活' });
    }
    await applyActivationCode(uid, req.body && req.body.code);
    var rec2 = await getUserRowByUsername(uid);
    var out = {
      user_id: rec2.username,
      real_name: rec2.real_name || rec2.username,
      username: rec2.username,
      account_active: true,
      is_test_account: rowUserTypeIsTest(rec2),
      token: signAccessToken({
        user_id: rec2.username,
        username: rec2.username,
        account_active: true,
        session_rev: userSessionRevFromRow(rec2)
      })
    };
    return res.json({ code: 200, data: out });
  } catch (e) {
    return res.status(400).json({ code: 400, msg: e.message || String(e) });
  }
}

async function handleAuthPost(req, res) {
  var body = req.body || {};
  var action = body.action;
  try {
    if (/^track_[a-z0-9_]{1,80}$/i.test(String(action || ''))) {
      recordInstallGuideTrackEvent(req, action, body.meta);
      return res.json({ code: 200, data: { ok: true } });
    }
    if (action === 'admin_issue_code') {
      var adm = body.admin_key || req.headers['x-admin-key'];
      if (!ADMIN_ACTIVATION_KEY || adm !== ADMIN_ACTIVATION_KEY) {
        return res.status(403).json({ code: 403, msg: '无权限发码（需配置 ADMIN_ACTIVATION_KEY）' });
      }
      var maxUses = 1;
      var plainCode = crypto.randomBytes(16).toString('hex').toUpperCase();
      const conn = await pool.getConnection();
      await conn.execute(
        'INSERT INTO activation_codes (code, max_uses, used_count, expires_at, note) VALUES (?, ?, 0, ?, ?)',
        [plainCode, maxUses, null, null]
      );
      conn.release();
      return res.json({
        code: 200,
        data: { code: plainCode, max_uses: maxUses }
      });
    }
    if (action === 'register') {
      var regUser = body.username != null ? String(body.username).trim() : '';
      var regGuardKeys = null;
      if (registerGuard.guardEnabled()) {
        var clientChk = registerGuard.checkRegisterClient(req);
        if (!clientChk.ok) {
          await recordUserRegistrationAttempt(regUser, false, req, clientChk.reason);
          return res.status(403).json({ code: 403, msg: clientChk.msg });
        }
        var distChk = registerGuard.checkRegisterDistributorBlock(req);
        if (!distChk.ok) {
          await recordUserRegistrationAttempt(regUser, false, req, distChk.reason);
          return res.status(403).json({ code: 403, msg: distChk.msg });
        }
        var rateChk = await registerGuard.checkRegisterRateLimits(req, getClientIp, computeDeviceFingerprint);
        if (!rateChk.ok) {
          await recordUserRegistrationAttempt(regUser, false, req, rateChk.reason);
          return res.status(429).json({
            code: 429,
            msg: rateChk.msg,
            retry_after_ms: rateChk.backoff_ms || 0
          });
        }
        if (!registerGuard.verifyRegisterCaptcha(body.captcha_id, body.captcha_answer)) {
          if (rateChk.keys) {
            await registerGuard.markRegisterAttemptFail(rateChk.keys);
          }
          await recordUserRegistrationAttempt(regUser, false, req, 'register_fail:captcha');
          return res.status(400).json({ code: 400, msg: '验证码错误或已过期，请刷新后重试' });
        }
        regGuardKeys = rateChk.keys;
      }
      incrementApiDailyCounter('EVENT register_submit', '认证注册');
      try {
        var regSourceNorm = normalizeRegisterSourceChannelInput(
          body.register_source_channel != null
            ? body.register_source_channel
            : body.source_channel,
          body.register_source_channel_other != null
            ? body.register_source_channel_other
            : body.source_channel_other
        );
        if (regSourceNorm.err) {
          if (regGuardKeys) {
            await registerGuard.markRegisterAttemptFail(regGuardKeys);
          }
          await recordUserRegistrationAttempt(regUser, false, req, 'register_fail:validation');
          return res.status(400).json({ code: 400, msg: regSourceNorm.err });
        }
        var regSalesCh = sanitizeSalesChannelId(body.sales_ch || body.ch || '');
        var out = await registerUser(
          body.username,
          body.password,
          regSourceNorm.value,
          parseFromInstallGuideFlag(body),
          regSalesCh
        );
        if (regGuardKeys) {
          await registerGuard.markRegisterAttemptSuccess(regGuardKeys);
        }
        await recordUserRegistrationAttempt(out.username, true, req, 'register_ok');
        if (parseFromInstallGuideFlag(body)) {
          recordInstallGuideTrackEvent(req, 'track_install_register_success', {
            page: 'register',
            username: out.username,
            reported: true
          });
        }
        out.token = signAccessToken(out);
        return res.json({ code: 200, data: out });
      } catch (regErr) {
        if (regGuardKeys) {
          await registerGuard.markRegisterAttemptFail(regGuardKeys);
        }
        var rMsg = regErr && regErr.message ? String(regErr.message) : '';
        var rReason =
          rMsg.indexOf('已注册') >= 0 ? 'register_fail:duplicate' : 'register_fail:validation';
        await recordUserRegistrationAttempt(regUser, false, req, rReason);
        throw regErr;
      }
    }
    if (action === 'recover_by_activation_code') {
      var recovered = await recoverCredentialsByActivationCode(
        body.activation_code != null ? body.activation_code : body.code
      );
      return res.json({ code: 200, data: recovered });
    }
    if (action === 'login') {
      var out2 = await loginUser(body.username, body.password);
      out2.token = signAccessToken(out2);
      await updateUserLastLoginCity(out2.username, req);
      touchUserDailyActivity(out2.username);
      recordUserLoginAttempt(out2.username, true, req, 'ok').catch(function () {});
      return res.json({ code: 200, data: out2 });
    }
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    try {
      var b = req.body || {};
      if (b.action === 'login' && b.username != null && String(b.username).trim() !== '') {
        recordUserLoginAttempt(String(b.username).trim(), false, req, e && e.message ? String(e.message) : '').catch(
          function () {}
        );
      }
    } catch (e2) {}
    return res.status(400).json({ code: 400, msg: e.message || String(e) });
  }
}

function routeAuthPost(req, res) {
  var body = req.body || {};
  if (body.action === 'activate') {
    return requireAuth(req, res, function () {
      handleActivatePost(req, res).catch(function (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: String(err.message) });
      });
    });
  }
  handleAuthPost(req, res);
}

app.get('/api/auth.php', handleAuthGet);
app.get('/auth.php', handleAuthGet);
app.post('/api/auth.php', routeAuthPost);
app.post('/auth.php', routeAuthPost);

async function handleAdminLogin(req, res) {
  var body = req.body || {};
  var u = String(body.username || '').trim();
  var p = String(body.password || '');
  if (!u || !p) {
    recordAdminLoginAttempt(u || 'unknown', false, 'missing_credentials', req).catch(function () {});
    return res.status(400).json({ code: 400, msg: '请输入账号和密码' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      var admin = await loadAdminAccountByUsername(conn, u);
      if (!admin || !verifyPasswordBySaltHash(p, admin.salt, admin.hash)) {
        recordAdminLoginAttempt(u, false, 'invalid_credentials', req).catch(function () {});
        return res.status(401).json({ code: 401, msg: '账号或密码错误' });
      }
      if (admin.banned) {
        recordAdminLoginAttempt(u, false, 'banned', req).catch(function () {});
        return res.status(403).json({ code: 403, msg: '管理账号已停用' });
      }
      recordAdminLoginAttempt(admin.username, true, 'ok', req).catch(function () {});
      return res.json({
        code: 200,
        data: {
          token: signAdminToken(admin.username),
          admin: {
            username: admin.username,
            full_name: admin.full_name || '',
            is_super: !!admin.is_super,
            menus: admin.menus
          }
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminMe(req, res) {
  return res.json({
    code: 200,
    data: {
      admin: {
        username: req.admin.username,
        full_name: req.admin.full_name || '',
        is_super: !!req.admin.is_super,
        menus: req.admin.menus
      }
    }
  });
}

async function handleAdminAccountsList(req, res) {
  if (!req.admin || !req.admin.is_super) {
    return res.status(403).json({ code: 403, msg: '仅 admin 账号可管理后台账号权限' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        'SELECT id, username, full_name, is_super, banned, created_at FROM admin_accounts ORDER BY id ASC'
      );
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        const [menuRows] = await conn.execute(
          'SELECT menu_key FROM admin_account_menus WHERE admin_id = ? ORDER BY menu_key ASC',
          [rows[i].id]
        );
        out.push({
          id: Number(rows[i].id) || 0,
          username: String(rows[i].username),
          full_name: rows[i].full_name != null ? String(rows[i].full_name) : '',
          is_super: rows[i].is_super === 1 || rows[i].is_super === true,
          banned: rows[i].banned === 1 || rows[i].banned === true,
          created_at: rows[i].created_at ? rows[i].created_at.toISOString() : '',
          menus: normalizeAdminMenuList(
            menuRows.map(function (m) {
              return m.menu_key;
            }),
            rows[i].is_super === 1 || rows[i].is_super === true
          )
        });
      }
      return res.json({ code: 200, data: { accounts: out, menu_keys: ADMIN_MENU_KEYS } });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminAccountsCreate(req, res) {
  if (!req.admin || !req.admin.is_super) {
    return res.status(403).json({ code: 403, msg: '仅 admin 账号可管理后台账号权限' });
  }
  var body = req.body || {};
  var username = String(body.username || '').trim();
  var fullName = String(body.full_name || '').trim();
  var password = String(body.password || '');
  var menus = normalizeAdminMenuList(body.menus, false);
  if (!username || username.length < 3 || username.length > 64 || !/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return res.status(400).json({ code: 400, msg: '账号仅支持 3-64 位字母数字._-' });
  }
  if (!password || password.length < 4 || password.length > 128) {
    return res.status(400).json({ code: 400, msg: '密码长度需为 4-128 位' });
  }
  if (!fullName || fullName.length > 255) {
    return res.status(400).json({ code: 400, msg: '请填写姓名（1-255 字）' });
  }
  if (!menus.length) {
    return res.status(400).json({ code: 400, msg: '请至少选择一个可用菜单' });
  }
  if (username.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    return res.status(400).json({ code: 400, msg: '保留账号请直接使用 admin' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      const [exists] = await conn.execute('SELECT id FROM admin_accounts WHERE username = ? LIMIT 1', [username]);
      if (exists.length) {
        return res.status(400).json({ code: 400, msg: '该管理账号已存在' });
      }
      var saltBuf = crypto.randomBytes(16);
      var saltHex = saltBuf.toString('hex');
      var hashHex = hashPasswordWithSalt(password, saltBuf);
      const [ins] = await conn.execute(
        'INSERT INTO admin_accounts (username, full_name, salt, hash, is_super, banned) VALUES (?, ?, ?, ?, 0, 0)',
        [username, fullName, saltHex, hashHex]
      );
      var adminId = ins.insertId ? Number(ins.insertId) : 0;
      for (var i = 0; i < menus.length; i++) {
        await conn.execute(
          'INSERT INTO admin_account_menus (admin_id, menu_key) VALUES (?, ?)',
          [adminId, menus[i]]
        );
      }
      return res.json({ code: 200, data: { username: username } });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminAccountsUpdate(req, res) {
  if (!req.admin || !req.admin.is_super) {
    return res.status(403).json({ code: 403, msg: '仅 admin 账号可管理后台账号权限' });
  }
  var body = req.body || {};
  var username = String(body.username || '').trim();
  var fullName = body.full_name != null ? String(body.full_name).trim() : '';
  if (!username) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  var updatePassword = body.password != null ? String(body.password) : '';
  var hasPasswordUpdate = updatePassword !== '';
  if (hasPasswordUpdate && (updatePassword.length < 4 || updatePassword.length > 128)) {
    return res.status(400).json({ code: 400, msg: '密码长度需为 4-128 位' });
  }
  var menus = normalizeAdminMenuList(body.menus, false);
  if (!menus.length) {
    return res.status(400).json({ code: 400, msg: '请至少选择一个可用菜单' });
  }
  if (!fullName || fullName.length > 255) {
    return res.status(400).json({ code: 400, msg: '请填写姓名（1-255 字）' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      var admin = await loadAdminAccountByUsername(conn, username);
      if (!admin) {
        return res.status(404).json({ code: 404, msg: '管理账号不存在' });
      }
      if (admin.is_super) {
        return res.status(400).json({ code: 400, msg: '不能修改 admin 超级账号权限' });
      }
      await conn.execute('DELETE FROM admin_account_menus WHERE admin_id = ?', [admin.id]);
      for (var i = 0; i < menus.length; i++) {
        await conn.execute(
          'INSERT INTO admin_account_menus (admin_id, menu_key) VALUES (?, ?)',
          [admin.id, menus[i]]
        );
      }
      await conn.execute('UPDATE admin_accounts SET full_name = ? WHERE id = ?', [fullName, admin.id]);
      if (hasPasswordUpdate) {
        var saltBuf = crypto.randomBytes(16);
        var saltHex = saltBuf.toString('hex');
        var hashHex = hashPasswordWithSalt(updatePassword, saltBuf);
        await conn.execute('UPDATE admin_accounts SET salt = ?, hash = ? WHERE id = ?', [saltHex, hashHex, admin.id]);
      }
      return res.json({ code: 200, data: { username: username } });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminAccountActivatedUsers(req, res) {
  if (!req.admin || !req.admin.is_super) {
    return res.status(403).json({ code: 403, msg: '仅 admin 账号可管理后台账号权限' });
  }
  var ownerAdmin = String(req.query.owner_admin || '').trim();
  if (!ownerAdmin) {
    return res.status(400).json({ code: 400, msg: 'owner_admin required' });
  }
  var page = parseInt(req.query.page, 10) || 1;
  var limit = parseInt(req.query.limit, 10) || 10;
  if (page < 1) page = 1;
  if (limit < 1) limit = 10;
  if (limit > 50) limit = 50;
  var offset = (page - 1) * limit;
  try {
    const conn = await pool.getConnection();
    try {
      var adminRow = await loadAdminAccountByUsername(conn, ownerAdmin);
      if (!adminRow) {
        return res.status(404).json({ code: 404, msg: '管理账号不存在' });
      }
      var countSql =
        'SELECT COUNT(*) AS cnt FROM (' +
        'SELECT DISTINCT used_by_username FROM activation_codes ' +
        'WHERE owner_admin_username = ? AND used_by_username IS NOT NULL AND TRIM(used_by_username) <> \'\'' +
        ') t';
      const [countRows] = await conn.execute(countSql, [ownerAdmin]);
      var total = countRows.length ? Number(countRows[0].cnt) || 0 : 0;

      const [rows] = await conn.query(
        `SELECT u.username, u.real_name, u.account_active, u.banned, u.created_at,
                agg.activated_at, agg.activation_code
         FROM (
           SELECT used_by_username,
                  MAX(last_used_at) AS activated_at,
                  SUBSTRING_INDEX(GROUP_CONCAT(code ORDER BY last_used_at DESC, id DESC), ',', 1) AS activation_code
           FROM activation_codes
           WHERE owner_admin_username = ?
             AND used_by_username IS NOT NULL
             AND TRIM(used_by_username) <> ''
           GROUP BY used_by_username
         ) agg
         INNER JOIN users u ON u.username = agg.used_by_username AND u.activation_refunded_at IS NULL
         ORDER BY agg.activated_at DESC, u.id DESC
         LIMIT ${limit} OFFSET ${offset}`,
        [ownerAdmin]
      );

      var out = rows.map(function (r) {
        return {
          username: String(r.username || ''),
          real_name: r.real_name != null ? String(r.real_name) : '',
          account_active: r.account_active === 1 || r.account_active === true,
          banned: r.banned === 1 || r.banned === true,
          created_at: r.created_at ? r.created_at.toISOString() : '',
          activated_at: r.activated_at ? r.activated_at.toISOString() : '',
          activation_code: r.activation_code != null ? String(r.activation_code) : ''
        };
      });
      return res.json({
        code: 200,
        data: {
          owner_admin: ownerAdmin,
          users: out,
          total: total,
          page: page,
          limit: limit
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminAccountsDelete(req, res) {
  if (!req.admin || !req.admin.is_super) {
    return res.status(403).json({ code: 403, msg: '仅 admin 账号可管理后台账号权限' });
  }
  var body = req.body || {};
  var username = String(body.username || '').trim();
  if (!username) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  if (username === req.admin.username) {
    return res.status(400).json({ code: 400, msg: '不能删除当前登录账号' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      var admin = await loadAdminAccountByUsername(conn, username);
      if (!admin) {
        return res.status(404).json({ code: 404, msg: '管理账号不存在' });
      }
      if (admin.is_super) {
        return res.status(400).json({ code: 400, msg: '不能删除 admin 超级账号' });
      }
      await conn.execute('DELETE FROM admin_account_menus WHERE admin_id = ?', [admin.id]);
      await conn.execute('DELETE FROM admin_accounts WHERE id = ?', [admin.id]);
      return res.json({ code: 200, data: { username: username, deleted: true } });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

function formatDateKey(d) {
  if (!d) return '';
  if (d instanceof Date) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  var s = String(d).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/** 与后台列表 formatDt（UTC+8）一致：按北京时间取日 */
function chinaDateKeyNow() {
  var now = new Date();
  var utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return formatDateKey(new Date(utcMs + 8 * 3600000));
}

/** 注册用户列表登录风控：不同登录 IP 数、关联设备数 */
var USER_LOGIN_RISK_IP_THRESHOLD = 2;
var USER_LOGIN_RISK_DEVICE_THRESHOLD = 3;

function userLoginRiskIpUnionSubquery(usernameExpr) {
  var u = usernameExpr || 'users.username';
  return (
    '(SELECT TRIM(ip) AS ip_val FROM user_login_events WHERE username = ' +
    u +
    " AND ip IS NOT NULL AND TRIM(ip) <> '' AND (ok = 1 OR reason LIKE 'register_%') UNION ALL SELECT TRIM(ip_last) AS ip_val FROM user_devices WHERE username = " +
    u +
    " AND ip_last IS NOT NULL AND TRIM(ip_last) <> '')"
  );
}

async function buildUserLoginRiskMaps(conn, usernames) {
  var ipDistinct = {};
  var deviceCnt = {};
  if (!conn || !usernames || !usernames.length) {
    return { ipDistinct: ipDistinct, deviceCnt: deviceCnt };
  }
  var uniq = [];
  var seen = {};
  for (var i = 0; i < usernames.length; i++) {
    var u = String(usernames[i] || '').trim();
    if (!u || seen[u]) continue;
    seen[u] = 1;
    uniq.push(u);
  }
  if (!uniq.length) {
    return { ipDistinct: ipDistinct, deviceCnt: deviceCnt };
  }
  var ph = uniq.map(function () {
    return '?';
  }).join(',');
  var ipParams = uniq.concat(uniq);
  var [ipRows] = await conn.execute(
    'SELECT username, COUNT(DISTINCT ip_val) AS cnt FROM (' +
      "SELECT username, TRIM(ip) AS ip_val FROM user_login_events WHERE (ok = 1 OR reason LIKE 'register_%') AND username IN (" +
      ph +
      ") AND ip IS NOT NULL AND TRIM(ip) <> '' UNION ALL " +
      'SELECT username, TRIM(ip_last) AS ip_val FROM user_devices WHERE username IN (' +
      ph +
      ") AND ip_last IS NOT NULL AND TRIM(ip_last) <> ''" +
      ') combined GROUP BY username',
    ipParams
  );
  var [devRows] = await conn.execute(
    'SELECT username, COUNT(*) AS cnt FROM user_devices WHERE username IN (' + ph + ') GROUP BY username',
    uniq
  );
  ipRows.forEach(function (r) {
    ipDistinct[String(r.username)] = Number(r.cnt) || 0;
  });
  devRows.forEach(function (r) {
    deviceCnt[String(r.username)] = Number(r.cnt) || 0;
  });
  return { ipDistinct: ipDistinct, deviceCnt: deviceCnt };
}

function computeUserLoginRisk(ipDistinctCount, deviceCount) {
  var ipCnt = Number(ipDistinctCount) || 0;
  var devCnt = Number(deviceCount) || 0;
  var msgs = [];
  if (ipCnt >= USER_LOGIN_RISK_IP_THRESHOLD) {
    msgs.push('不同IP' + ipCnt + '个');
  }
  if (devCnt >= USER_LOGIN_RISK_DEVICE_THRESHOLD) {
    msgs.push('设备' + devCnt + '台');
  }
  return {
    distinct_ip_count: ipCnt,
    device_count: devCnt,
    risk: msgs.length > 0,
    risk_messages: msgs
  };
}

/** SQL：账号是否命中登录风控（不同 IP 数或设备数） */
function userLoginRiskMatchSql(usernameExpr) {
  var u = usernameExpr || 'users.username';
  return (
    '((SELECT COUNT(DISTINCT ip_val) FROM ' +
    userLoginRiskIpUnionSubquery(u) +
    ' ip_union) >= ' +
    USER_LOGIN_RISK_IP_THRESHOLD +
    ' OR (SELECT COUNT(*) FROM user_devices ud WHERE ud.username = ' +
    u +
    ') >= ' +
    USER_LOGIN_RISK_DEVICE_THRESHOLD +
    ')'
  );
}

/** 激活类统计：排除已退款、已从注册用户列表软删除的账号 */
function userActivationStatsEligibleSql(userCol) {
  var alias = userTableAliasFromCol(userCol || 'users.username');
  return alias + '.activation_refunded_at IS NULL AND ' + alias + '.list_hidden_at IS NULL';
}

async function handleAdminUsersDailyConversion(req, res) {
  try {
    var days = parseInt(req.query.days, 10) || 1;
    if (days < 1) days = 1;
    if (days > 90) days = 90;
    var span = days - 1;
    var agentChannels = await getAgentPromoChannelListFromSettings();

    const conn = await pool.getConnection();
    try {
      var ownSeg = await queryDailyConversionSegment(conn, days, span, req.admin, 'own', agentChannels);
      var agentSeg = await queryDailyConversionSegment(conn, days, span, req.admin, 'agent', agentChannels);

      res.json({
        code: 200,
        data: {
          days: days,
          agent_channel_ids: agentChannels,
          segments: {
            own: ownSeg,
            agent: agentSeg
          }
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 注册后 7 日内漏斗：激活 / 有个税 / 查看收入明细（按用户注册日 cohort） */
async function handleAdminRegistrationFunnel(req, res) {
  try {
    var days = parseInt(req.query.days, 10) || 30;
    if (days < 1) days = 1;
    if (days > 90) days = 90;
    var agentChannels = await getAgentPromoChannelListFromSettings();

    const conn = await pool.getConnection();
    try {
      var ownSeg = await queryRegistrationFunnelSegment(conn, days, req.admin, 'own', agentChannels);
      var agentSeg = await queryRegistrationFunnelSegment(conn, days, req.admin, 'agent', agentChannels);

      res.json({
        code: 200,
        data: {
          days: days,
          agent_channel_ids: agentChannels,
          segments: {
            own: ownSeg,
            agent: agentSeg
          }
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

function resolveConversionAbVariant(seed) {
  var s = String(seed || 'guest');
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2 === 0 ? 'a' : 'b';
}

async function loadConversionAbParsed() {
  if (!pool) {
    return Object.assign({}, DEFAULT_CONVERSION_AB);
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1', [
      SETTING_KEY_CONVERSION_AB
    ]);
    if (!rows.length || rows[0].setting_value == null || String(rows[0].setting_value).trim() === '') {
      return Object.assign({}, DEFAULT_CONVERSION_AB);
    }
    var parsed = JSON.parse(String(rows[0].setting_value));
    var merged = Object.assign({}, DEFAULT_CONVERSION_AB, parsed && typeof parsed === 'object' ? parsed : {});
    if (merged.activate_subtitle_b === '30秒体验收入纳税明细') {
      merged.activate_subtitle_b = DEFAULT_CONVERSION_AB.activate_subtitle_b;
    }
    if (merged.activate_subtitle_a === '激活后可填写个税演示数据') {
      merged.activate_subtitle_a = DEFAULT_CONVERSION_AB.activate_subtitle_a;
    }
    return merged;
  } catch (e) {
    return Object.assign({}, DEFAULT_CONVERSION_AB);
  } finally {
    conn.release();
  }
}

async function handlePublicConversionConfig(req, res) {
  try {
    var cfg = await loadConversionAbParsed();
    var seed = '';
    if (req.authUserId) {
      seed = String(req.authUserId);
    } else {
      try {
        if (req.clientDevicePayload && req.clientDevicePayload.client_id) {
          seed = String(req.clientDevicePayload.client_id);
        }
      } catch (e0) {}
    }
    var variant = resolveConversionAbVariant(seed);
    return res.json({
      code: 200,
      data: {
        enabled: cfg.enabled !== false,
        variant: variant,
        activate_title:
          variant === 'b' ? String(cfg.activate_title_b || '') : String(cfg.activate_title_a || ''),
        activate_subtitle:
          variant === 'b' ? String(cfg.activate_subtitle_b || '') : String(cfg.activate_subtitle_a || ''),
        batch_example_prominent: cfg.batch_example_prominent === true
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

function funnelMetricsSqlAliases(userAlias) {
  var u = userAlias || 'u';
  return {
    activated7:
      'SUM(CASE WHEN EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = ' +
      u +
      '.username AND ac.last_used_at IS NOT NULL AND ' +
      userActivationStatsEligibleSql(u + '.username') +
      ' AND TIMESTAMPDIFF(HOUR, ' +
      u +
      '.created_at, ac.last_used_at) BETWEEN 0 AND 168) THEN 1 ELSE 0 END)',
    tax7:
      'SUM(CASE WHEN EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = ' +
      u +
      '.username AND tr.deleted_at IS NULL AND TIMESTAMPDIFF(HOUR, ' +
      u +
      '.created_at, tr.created_at) BETWEEN 0 AND 168) THEN 1 ELSE 0 END)',
    detail7:
      'SUM(CASE WHEN EXISTS (SELECT 1 FROM user_page_events e WHERE e.username = ' +
      u +
      '.username AND (e.page_path LIKE \'%shuiming%\' OR e.page_path LIKE \'%xiangqing%\') AND TIMESTAMPDIFF(HOUR, ' +
      u +
      '.created_at, e.created_at) BETWEEN 0 AND 168) THEN 1 ELSE 0 END)'
  };
}

/** 按注册来源渠道的 7 日转化漏斗 */
async function handleAdminChannelRegistrationFunnel(req, res) {
  try {
    var days = parseInt(req.query.days, 10) || 30;
    if (days < 1) days = 1;
    if (days > 90) days = 90;
    var cnUserDay = 'DATE(DATE_ADD(u.created_at, INTERVAL 8 HOUR))';
    var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
    var regSince = cnUserDay + ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY)';
    var fm = funnelMetricsSqlAliases('u');

    const conn = await pool.getConnection();
    try {
      var where = [regSince];
      var params = [days - 1];
      appendAdminUserScope(where, params, req.admin, 'u.username');
      var whereSql = ' WHERE ' + where.join(' AND ');

      const [rows] = await conn.query(
        `SELECT COALESCE(NULLIF(TRIM(u.register_source_channel), ''), '__empty__') AS ch,
                COUNT(*) AS registered,
                ${fm.activated7} AS activated_7d,
                ${fm.tax7} AS tax_7d,
                ${fm.detail7} AS viewed_detail_7d
         FROM users u` +
          whereSql +
          ' GROUP BY ch ORDER BY registered DESC',
        params
      );

      function pct(n, d) {
        if (!d || d <= 0) return null;
        return (Math.round((n / d) * 1000) / 10).toFixed(1) + '%';
      }

      var items = (rows || []).map(function (r) {
        var reg = Number(r.registered) || 0;
        var a7 = Number(r.activated_7d) || 0;
        var t7 = Number(r.tax_7d) || 0;
        var v7 = Number(r.viewed_detail_7d) || 0;
        var ch = String(r.ch || '');
        return {
          channel: ch,
          channel_label: ch === '__empty__' ? '未填写渠道' : registerSourceChannelLabel(ch),
          registered: reg,
          activated_7d: a7,
          tax_7d: t7,
          viewed_detail_7d: v7,
          rate_activate_7d_pct: pct(a7, reg),
          rate_tax_7d_pct: pct(t7, reg),
          rate_detail_7d_pct: pct(v7, reg)
        };
      });

      res.json({ code: 200, data: { days: days, items: items } });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

function activationFunnelMetricsSqlAliases(userAlias, actAlias) {
  var u = userAlias || 'u';
  var ac = actAlias || 'ac';
  return {
    tax7AfterActivate:
      'SUM(CASE WHEN EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = ' +
      u +
      '.username AND tr.deleted_at IS NULL AND TIMESTAMPDIFF(HOUR, ' +
      ac +
      '.last_used_at, tr.created_at) BETWEEN 0 AND 168) THEN 1 ELSE 0 END)',
    detail7AfterActivate:
      'SUM(CASE WHEN EXISTS (SELECT 1 FROM user_page_events e WHERE e.username = ' +
      u +
      '.username AND (e.page_path LIKE \'%shuiming%\' OR e.page_path LIKE \'%xiangqing%\') AND TIMESTAMPDIFF(HOUR, ' +
      ac +
      '.last_used_at, e.created_at) BETWEEN 0 AND 168) THEN 1 ELSE 0 END)'
  };
}

/** 按激活来源渠道的 7 日转化（激活 cohort：激活后有个税 / 看明细） */
async function handleAdminActivationChannelFunnel(req, res) {
  try {
    var days = parseInt(req.query.days, 10) || 30;
    if (days < 1) days = 1;
    if (days > 90) days = 90;
    var cnActDay = 'DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR))';
    var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
    var actSince = cnActDay + ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY)';
    var fm = activationFunnelMetricsSqlAliases('u', 'ac');

    const conn = await pool.getConnection();
    try {
      var where = [actSince, userActivationStatsEligibleSql('u.username')];
      var params = [days - 1];
      appendAdminUserScope(where, params, req.admin, 'u.username');
      var whereSql = ' WHERE ' + where.join(' AND ');

      const [rows] = await conn.query(
        `SELECT COALESCE(NULLIF(TRIM(u.activation_source_channel), ''), '__empty__') AS ch,
                COUNT(DISTINCT u.username) AS activated,
                ${fm.tax7AfterActivate} AS tax_7d,
                ${fm.detail7AfterActivate} AS viewed_detail_7d
         FROM users u
         INNER JOIN activation_codes ac ON ac.used_by_username = u.username
           AND ac.last_used_at IS NOT NULL
         ` +
          whereSql +
          ' GROUP BY ch ORDER BY activated DESC',
        params
      );

      function pct(n, d) {
        if (!d || d <= 0) return null;
        return (Math.round((n / d) * 1000) / 10).toFixed(1) + '%';
      }

      var items = (rows || []).map(function (r) {
        var act = Number(r.activated) || 0;
        var t7 = Number(r.tax_7d) || 0;
        var v7 = Number(r.viewed_detail_7d) || 0;
        var ch = String(r.ch || '');
        return {
          channel: ch,
          channel_label: ch === '__empty__' ? '未标记激活来源' : activationSourceChannelLabel(ch),
          activated: act,
          tax_7d: t7,
          viewed_detail_7d: v7,
          rate_tax_7d_pct: pct(t7, act),
          rate_detail_7d_pct: pct(v7, act)
        };
      });

      res.json({ code: 200, data: { days: days, items: items } });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** install_guide.html 访问、行为与停留统计 */
async function handleAdminInstallGuideStats(req, res) {
  try {
    var days = parseInt(req.query.days, 10) || 30;
    if (days < 1) days = 1;
    if (days > 90) days = 90;
    var span = days - 1;
    var cnDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
    var cnSince = cnDay + ' >= DATE_SUB(DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)), INTERVAL ? DAY)';
    const conn = await pool.getConnection();
    try {
      const [viewRows] = await conn.query(
        `SELECT COUNT(*) AS pv,
                COUNT(DISTINCT COALESCE(NULLIF(client_id, ''), device_fp)) AS uv
         FROM install_guide_track_events
         WHERE event_key = 'track_install_page_view' AND ${cnSince}`,
        [span]
      );
      const [leaveRows] = await conn.query(
        `SELECT COUNT(*) AS leave_cnt, AVG(dwell_seconds) AS avg_dwell
         FROM install_guide_track_events
         WHERE event_key = 'track_install_page_leave'
           AND dwell_seconds IS NOT NULL
           AND ${cnSince}`,
        [span]
      );
      const [dwellListRows] = await conn.query(
        `SELECT dwell_seconds
         FROM install_guide_track_events
         WHERE event_key = 'track_install_page_leave'
           AND dwell_seconds IS NOT NULL
           AND ${cnSince}
         ORDER BY dwell_seconds ASC`,
        [span]
      );
      const [actionRows] = await conn.query(
        `SELECT event_key, COUNT(*) AS total
         FROM install_guide_track_events
         WHERE event_key NOT IN ('track_install_page_view', 'track_install_page_leave')
           AND ${cnSince}
         GROUP BY event_key
         ORDER BY total DESC`,
        [span]
      );
      const [dailyRows] = await conn.query(
        `SELECT ${cnDay} AS d,
                SUM(CASE WHEN event_key = 'track_install_page_view' THEN 1 ELSE 0 END) AS page_views,
                COUNT(DISTINCT CASE
                  WHEN event_key = 'track_install_page_view'
                  THEN COALESCE(NULLIF(client_id, ''), device_fp)
                END) AS unique_visitors,
                AVG(CASE WHEN event_key = 'track_install_page_leave' THEN dwell_seconds END) AS avg_dwell_seconds
         FROM install_guide_track_events
         WHERE ${cnSince}
         GROUP BY ${cnDay}
         ORDER BY d ASC`,
        [span]
      );
      var cnUserDay = 'DATE(DATE_ADD(u.created_at, INTERVAL 8 HOUR))';
      var cnUserSince =
        cnUserDay + ' >= DATE_SUB(DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)), INTERVAL ? DAY)';
      const [regDailyRows] = await conn.query(
        `SELECT ${cnUserDay} AS d, COUNT(*) AS registered
         FROM users u
         WHERE ${cnUserSince} AND u.activation_refunded_at IS NULL
         GROUP BY ${cnUserDay}
         ORDER BY d ASC`,
        [span]
      );
      const [regFromInstallRows] = await conn.query(
        `SELECT ${cnUserDay} AS d, COUNT(DISTINCT u.username) AS registered_from_install
         FROM users u
         WHERE ${cnUserSince} AND u.activation_refunded_at IS NULL
           AND (
             u.registered_from_install_guide = 1
             OR EXISTS (
               SELECT 1
               FROM user_devices ud
               INNER JOIN install_guide_track_events ig ON ig.event_key = 'track_install_page_view'
                 AND DATE(DATE_ADD(ig.created_at, INTERVAL 8 HOUR)) = ${cnUserDay}
                 AND (
                   (ig.device_fp IS NOT NULL AND ig.device_fp <> '' AND ig.device_fp = ud.device_fp)
                   OR (
                     ig.client_id IS NOT NULL AND ig.client_id <> ''
                     AND ud.client_id IS NOT NULL AND ud.client_id <> ''
                     AND ig.client_id = ud.client_id
                   )
                 )
               WHERE ud.username = u.username
             )
           )
         GROUP BY ${cnUserDay}
         ORDER BY d ASC`,
        [span]
      );
      const [regFromInstallReportedRows] = await conn.query(
        `SELECT ${cnUserDay} AS d, COUNT(*) AS registered_from_install_reported
         FROM users u
         WHERE ${cnUserSince} AND u.activation_refunded_at IS NULL AND u.registered_from_install_guide = 1
         GROUP BY ${cnUserDay}
         ORDER BY d ASC`,
        [span]
      );
      const [recentRows] = await conn.query(
        `SELECT id, client_id, device_fp, event_key, dwell_seconds, created_at, ip, user_agent
         FROM install_guide_track_events
         WHERE ${cnSince}
         ORDER BY created_at DESC
         LIMIT 300`,
        [span]
      );

      var pv = Number((viewRows[0] || {}).pv) || 0;
      var uv = Number((viewRows[0] || {}).uv) || 0;
      var leaveCnt = Number((leaveRows[0] || {}).leave_cnt) || 0;
      var avgDwell = Number((leaveRows[0] || {}).avg_dwell);
      var dwellVals = (dwellListRows || [])
        .map(function (r) {
          return Number(r.dwell_seconds);
        })
        .filter(function (n) {
          return isFinite(n);
        });
      var medianDwell = medianFromSortedNumbers(dwellVals);

      var actions = (actionRows || []).map(function (r) {
        var ek = String(r.event_key || '');
        return {
          event_key: ek,
          label: installGuideEventLabel(ek),
          total: Number(r.total) || 0
        };
      });

      function pctText(n, d) {
        if (!d || d <= 0) return null;
        return (Math.round((n / d) * 1000) / 10).toFixed(1) + '%';
      }

      var regMap = {};
      (regDailyRows || []).forEach(function (r) {
        var k = formatDateKey(r.d);
        if (k) regMap[k] = Number(r.registered) || 0;
      });
      var regInstallMap = {};
      (regFromInstallRows || []).forEach(function (r) {
        var k = formatDateKey(r.d);
        if (k) regInstallMap[k] = Number(r.registered_from_install) || 0;
      });
      var regInstallReportedMap = {};
      (regFromInstallReportedRows || []).forEach(function (r) {
        var k = formatDateKey(r.d);
        if (k) regInstallReportedMap[k] = Number(r.registered_from_install_reported) || 0;
      });

      var dailyMap = {};
      (dailyRows || []).forEach(function (r) {
        var dk = formatDateKey(r.d);
        if (!dk) return;
        var avg = Number(r.avg_dwell_seconds);
        var uv = Number(r.unique_visitors) || 0;
        var regAll = regMap[dk] || 0;
        var regInstall = regInstallMap[dk] || 0;
        dailyMap[dk] = {
          date: dk,
          page_views: Number(r.page_views) || 0,
          unique_visitors: uv,
          avg_dwell_seconds: isFinite(avg) ? Math.round(avg) : null,
          avg_dwell_label: isFinite(avg) ? formatStaySecondsLabel(avg) : '—',
          registered: regAll,
          registered_from_install: regInstall,
          register_rate: uv > 0 ? regInstall / uv : null,
          register_rate_pct: pctText(regInstall, uv),
          register_rate_all: uv > 0 ? regAll / uv : null,
          register_rate_all_pct: pctText(regAll, uv)
        };
      });

      var todayKey = chinaDateKeyNow();
      var todayParts = todayKey.split('-').map(Number);
      var daily = [];
      for (var di = 0; di < days; di++) {
        var dt = new Date(todayParts[0], todayParts[1] - 1, todayParts[2] - (days - 1 - di));
        var key = formatDateKey(dt);
        if (dailyMap[key]) {
          daily.push(dailyMap[key]);
        } else {
          var regAll0 = regMap[key] || 0;
          var regInstall0 = regInstallMap[key] || 0;
          daily.push({
            date: key,
            page_views: 0,
            unique_visitors: 0,
            avg_dwell_seconds: null,
            avg_dwell_label: '—',
            registered: regAll0,
            registered_from_install: regInstall0,
            register_rate: null,
            register_rate_pct: regAll0 > 0 ? '—' : null,
            register_rate_all: null,
            register_rate_all_pct: regAll0 > 0 ? '—' : null
          });
        }
      }

      var totalRegistered = 0;
      var totalRegisteredFromInstall = 0;
      var totalRegisteredFromInstallReported = 0;
      daily.forEach(function (row) {
        totalRegistered += row.registered || 0;
        totalRegisteredFromInstall += row.registered_from_install || 0;
      });
      Object.keys(regInstallReportedMap).forEach(function (k) {
        totalRegisteredFromInstallReported += regInstallReportedMap[k] || 0;
      });

      var recentVisitors = buildInstallGuideRecentVisitors(recentRows, 20);

      res.json({
        code: 200,
        data: {
          days: days,
          summary: {
            page_views: pv,
            unique_visitors: uv,
            leave_events: leaveCnt,
            avg_dwell_seconds: isFinite(avgDwell) ? Math.round(avgDwell) : null,
            avg_dwell_label: isFinite(avgDwell) ? formatStaySecondsLabel(avgDwell) : '—',
            median_dwell_seconds: medianDwell != null ? medianDwell : null,
            median_dwell_label: medianDwell != null ? formatStaySecondsLabel(medianDwell) : '—',
            registered: totalRegistered,
            registered_from_install: totalRegisteredFromInstall,
            registered_from_install_reported: totalRegisteredFromInstallReported,
            register_rate: uv > 0 ? totalRegisteredFromInstall / uv : null,
            register_rate_pct: pctText(totalRegisteredFromInstall, uv),
            register_rate_all: uv > 0 ? totalRegistered / uv : null,
            register_rate_all_pct: pctText(totalRegistered, uv)
          },
          actions: actions,
          daily: daily,
          recent_visitors: recentVisitors
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 安装页与注册相关埋点汇总（analytics_api_daily） */
async function handleAdminInstallTrackStats(req, res) {
  try {
    var days = parseInt(req.query.days, 10) || 30;
    if (days < 1) days = 1;
    if (days > 90) days = 90;
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        `SELECT route_key, SUM(cnt) AS total
         FROM analytics_api_daily
         WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
           AND (
             route_key LIKE '%track_install_%'
             OR route_key = 'EVENT register_success'
           )
         GROUP BY route_key
         ORDER BY total DESC`,
        [days - 1]
      );
      var labelMap = {
        'POST auth.php#track_install_apk_click': 'Android 安装包点击',
        'POST auth.php#track_install_ios_click': 'iOS 描述文件点击',
        'POST auth.php#track_install_ios_video_play': '苹果安装视频播放',
        'POST auth.php#track_install_usage_video_play': '操作视频播放',
        'POST auth.php#track_tutorial_video_play': '操作教程视频播放',
        'POST auth.php#track_tutorial_prompt_show': '操作教程弹窗展示',
        'POST auth.php#track_tutorial_prompt_watch_click': '操作教程弹窗-观看',
        'POST auth.php#track_tutorial_prompt_dismiss': '操作教程弹窗-关闭',
        'EVENT register_success': '注册成功'
      };
      var items = (rows || []).map(function (r) {
        var rk = String(r.route_key || '');
        return {
          route_key: rk,
          label: labelMap[rk] || rk,
          total: Number(r.total) || 0
        };
      });
      res.json({ code: 200, data: { days: days, items: items } });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 未填个税用户 CSV 导出（运营分群） */
async function handleAdminUserDataNoTaxBehaviorExport(req, res) {
  try {
    var scope = noTaxUserWhereSql(req);
    const conn = await pool.getConnection();
    try {
      const [userRows] = await conn.query(
        'SELECT username, real_name, created_at, register_source_channel FROM users' +
          scope.sql +
          ' ORDER BY id DESC LIMIT 2000',
        scope.params
      );
      var names = userRows.map(function (r) {
        return String(r.username);
      });
      var eventMap = await loadPageEventsForUsers(conn, names, 400);
      var deviceMap = await loadLatestDevicesForUsers(conn, names);
      var lines = [
        '账号,姓名,注册时间,注册渠道,APP停留,机型,系统,活跃天,页面数,行为路径摘要,最近活跃'
      ];
      userRows.forEach(function (r) {
        var uname = String(r.username);
        var metrics = computeBehaviorMetricsFromEvents(eventMap[uname] || []);
        var shortStay = metrics.stay_seconds < NO_TAX_BEHAVIOR_SHORT_STAY_SEC;
        var dev = deviceMap[uname];
        var row = [
          uname,
          r.real_name != null ? String(r.real_name) : '',
          r.created_at ? r.created_at.toISOString() : '',
          registerSourceChannelLabel(r.register_source_channel),
          metrics.stay_label || '',
          shortStay && dev ? dev.model_label : '',
          shortStay && dev ? dev.os_display : '',
          String(metrics.active_days || 0),
          String(metrics.distinct_page_count || 0),
          metrics.path_summary || '',
          metrics.last_at || ''
        ];
        lines.push(
          row
            .map(function (cell) {
              var s = String(cell == null ? '' : cell);
              if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
              return s;
            })
            .join(',')
        );
      });
      var bom = '\uFEFF';
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="no_tax_users_' + chinaDateKeyNow() + '.csv"'
      );
      res.send(bom + lines.join('\n'));
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 转化 KPI：激活后 1 日个税填写率、有个税后 1 日明细查看率 */
async function handleAdminConversionKpis(req, res) {
  try {
    var days = parseInt(req.query.days, 10) || 30;
    if (days < 1) days = 1;
    if (days > 90) days = 90;
    var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
    var actSince =
      'DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR)) >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY)';
    var scopeWhere = [];
    var scopeParams = [days - 1];
    appendAdminUserScope(scopeWhere, scopeParams, req.admin, 'u.username');
    appendNonRefundedUserFilter(scopeWhere, 'u.username');
    var scopeSql = scopeWhere.length ? ' AND ' + scopeWhere.join(' AND ') : '';

    function pct(n, d) {
      if (!d || d <= 0) return null;
      return (Math.round((n / d) * 1000) / 10).toFixed(1) + '%';
    }

    const conn = await pool.getConnection();
    try {
      const [actRows] = await conn.query(
        `SELECT COUNT(DISTINCT u.username) AS activated,
                SUM(CASE WHEN EXISTS (
                  SELECT 1 FROM tax_records tr
                  WHERE tr.user_id = u.username
                    AND tr.deleted_at IS NULL
                    AND TIMESTAMPDIFF(HOUR, ac.last_used_at, tr.created_at) BETWEEN 0 AND 24
                ) THEN 1 ELSE 0 END) AS tax_within_7d
         FROM users u
         INNER JOIN activation_codes ac ON ac.used_by_username = u.username
           AND ac.last_used_at IS NOT NULL
         WHERE ${actSince}${scopeSql}`,
        scopeParams
      );
      var act = actRows[0] || {};
      var activated = Number(act.activated) || 0;
      var taxWithin7 = Number(act.tax_within_7d) || 0;

      const [taxRows] = await conn.query(
        `SELECT COUNT(DISTINCT u.username) AS with_tax,
                SUM(CASE WHEN EXISTS (
                  SELECT 1 FROM user_page_events e
                  WHERE e.username = u.username
                    AND (e.page_path LIKE '%shuiming%' OR e.page_path LIKE '%xiangqing%')
                    AND TIMESTAMPDIFF(HOUR, ft.first_tax_at, e.created_at) BETWEEN 0 AND 24
                ) THEN 1 ELSE 0 END) AS viewed_detail_7d
         FROM users u
         INNER JOIN (
           SELECT user_id AS username, MIN(created_at) AS first_tax_at
           FROM tax_records
           WHERE deleted_at IS NULL
           GROUP BY user_id
         ) ft ON ft.username = u.username
         WHERE DATE(DATE_ADD(ft.first_tax_at, INTERVAL 8 HOUR)) >= DATE_SUB(${cnToday}, INTERVAL ? DAY)${scopeSql}`,
        scopeParams
      );
      var tax = taxRows[0] || {};
      var withTax = Number(tax.with_tax) || 0;
      var viewed7 = Number(tax.viewed_detail_7d) || 0;

      var cnActDay = 'DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR))';
      const [actDayRows] = await conn.query(
        `SELECT ${cnActDay} AS d,
                COUNT(DISTINCT u.username) AS activated,
                SUM(CASE WHEN EXISTS (
                  SELECT 1 FROM tax_records tr
                  WHERE tr.user_id = u.username
                    AND tr.deleted_at IS NULL
                    AND TIMESTAMPDIFF(HOUR, ac.last_used_at, tr.created_at) BETWEEN 0 AND 24
                ) THEN 1 ELSE 0 END) AS tax_within_7d
         FROM users u
         INNER JOIN activation_codes ac ON ac.used_by_username = u.username
           AND ac.last_used_at IS NOT NULL
         WHERE ${actSince}${scopeSql}
         GROUP BY ${cnActDay}
         ORDER BY d ASC`,
        scopeParams
      );

      const [taxDayRows] = await conn.query(
        `SELECT DATE(DATE_ADD(ft.first_tax_at, INTERVAL 8 HOUR)) AS d,
                COUNT(DISTINCT u.username) AS with_tax,
                SUM(CASE WHEN EXISTS (
                  SELECT 1 FROM user_page_events e
                  WHERE e.username = u.username
                    AND (e.page_path LIKE '%shuiming%' OR e.page_path LIKE '%xiangqing%')
                    AND TIMESTAMPDIFF(HOUR, ft.first_tax_at, e.created_at) BETWEEN 0 AND 24
                ) THEN 1 ELSE 0 END) AS viewed_detail_7d
         FROM users u
         INNER JOIN (
           SELECT user_id AS username, MIN(created_at) AS first_tax_at
           FROM tax_records
           WHERE deleted_at IS NULL
           GROUP BY user_id
         ) ft ON ft.username = u.username
         WHERE DATE(DATE_ADD(ft.first_tax_at, INTERVAL 8 HOUR)) >= DATE_SUB(${cnToday}, INTERVAL ? DAY)${scopeSql}
         GROUP BY DATE(DATE_ADD(ft.first_tax_at, INTERVAL 8 HOUR))
         ORDER BY d ASC`,
        scopeParams
      );

      var seriesByActivateDay = (actDayRows || []).map(function (r) {
        var a = Number(r.activated) || 0;
        var t = Number(r.tax_within_7d) || 0;
        return {
          date: formatDateKey(r.d),
          activated: a,
          tax_within_7d: t,
          rate_tax_after_activate_7d_pct: pct(t, a)
        };
      });

      var seriesByFirstTaxDay = (taxDayRows || []).map(function (r) {
        var w = Number(r.with_tax) || 0;
        var v = Number(r.viewed_detail_7d) || 0;
        return {
          date: formatDateKey(r.d),
          with_tax: w,
          viewed_detail_7d: v,
          rate_detail_after_tax_7d_pct: pct(v, w)
        };
      });

      res.json({
        code: 200,
        data: {
          days: days,
          activated_in_window: activated,
          tax_within_7d_after_activate: taxWithin7,
          rate_tax_after_activate_7d_pct: pct(taxWithin7, activated),
          users_with_first_tax_in_window: withTax,
          viewed_detail_within_7d_after_tax: viewed7,
          rate_detail_after_tax_7d_pct: pct(viewed7, withTax),
          series_by_activate_day: seriesByActivateDay,
          series_by_first_tax_day: seriesByFirstTaxDay
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 注册超过 24h 仍未激活的用户（运营跟进） */
async function handleAdminUsersPendingActivate24h(req, res) {
  try {
    var page = Math.max(1, parseInt(req.query.page, 10) || 1);
    var pageSize = Math.min(100, Math.max(10, parseInt(req.query.page_size, 10) || 30));
    var offset = (page - 1) * pageSize;
    var where = [
      '(u.account_active IS NULL OR u.account_active = 0)',
      'TIMESTAMPDIFF(HOUR, u.created_at, UTC_TIMESTAMP()) >= 24'
    ];
    var params = [];
    appendAdminUserScope(where, params, req.admin, 'u.username');
    var whereSql = ' WHERE ' + where.join(' AND ');

    const conn = await pool.getConnection();
    try {
      const [countRows] = await conn.query(
        'SELECT COUNT(*) AS total FROM users u' + whereSql,
        params
      );
      var total = Number(countRows[0] && countRows[0].total) || 0;
      const [rows] = await conn.query(
        `SELECT u.username, u.real_name, u.created_at, u.register_source_channel,
                TIMESTAMPDIFF(HOUR, u.created_at, UTC_TIMESTAMP()) AS hours_since_register
         FROM users u` +
          whereSql +
          ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?',
        params.concat([pageSize, offset])
      );
      res.json({
        code: 200,
        data: {
          page: page,
          page_size: pageSize,
          total: total,
          items: (rows || []).map(function (r) {
            return {
              username: r.username,
              real_name: r.real_name != null ? String(r.real_name) : '',
              created_at: r.created_at ? r.created_at.toISOString() : '',
              register_source_channel: registerSourceChannelLabel(r.register_source_channel),
              hours_since_register: Number(r.hours_since_register) || 0
            };
          })
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 注册时段分布（按北京时间 created_at） */
async function handleAdminRegisterTimeDistribution(req, res) {
  try {
    var days = clampAnalyticsDays(req.query.days, 30, 365);
    var span = Math.max(0, days - 1);
    var cnCreated = 'DATE_ADD(users.created_at, INTERVAL 8 HOUR)';
    var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
    var where =
      'DATE(' +
      cnCreated +
      ') >= DATE_SUB(' +
      cnToday +
      ', INTERVAL ? DAY)';
    var params = [span];

    if (!req.admin || !req.admin.is_super) {
      where +=
        ' AND EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = users.username AND ac.owner_admin_username = ?)';
      params.push(req.admin.username);
    }

    const conn = await pool.getConnection();
    try {
      const [hourRows] = await conn.query(
        'SELECT HOUR(' +
          cnCreated +
          ') AS h, COUNT(*) AS cnt FROM users WHERE ' +
          where +
          ' GROUP BY h ORDER BY h',
        params
      );

      var hourCounts = [];
      var i;
      for (i = 0; i < 24; i++) {
        hourCounts.push(0);
      }
      var total = 0;
      hourRows.forEach(function (r) {
        var h = Number(r.h);
        var c = Number(r.cnt) || 0;
        if (h >= 0 && h < 24) {
          hourCounts[h] = c;
        }
        total += c;
      });

      function sumHours(from, to) {
        var s = 0;
        for (var hi = from; hi <= to; hi++) {
          s += hourCounts[hi] || 0;
        }
        return s;
      }

      var detailBuckets = [
        { key: 'late_night', label: '凌晨', range: '00:00-05:59', count: sumHours(0, 5) },
        { key: 'morning', label: '上午', range: '06:00-11:59', count: sumHours(6, 11) },
        { key: 'afternoon', label: '下午', range: '12:00-17:59', count: sumHours(12, 17) },
        { key: 'evening', label: '晚上', range: '18:00-23:59', count: sumHours(18, 23) }
      ];

      var periods = [
        {
          key: 'morning',
          label: '上午',
          range: '06:00-11:59',
          count: detailBuckets[1].count
        },
        {
          key: 'afternoon',
          label: '下午',
          range: '12:00-17:59',
          count: detailBuckets[2].count
        },
        {
          key: 'evening',
          label: '晚上',
          range: '18:00-次日05:59',
          count: detailBuckets[3].count + detailBuckets[0].count
        }
      ];

      function withPct(rows) {
        return rows.map(function (row) {
          var cnt = Number(row.count) || 0;
          var pct = total > 0 ? Math.round((cnt / total) * 1000) / 10 : 0;
          return {
            key: row.key,
            label: row.label,
            range: row.range,
            count: cnt,
            pct: pct,
            pct_text: total > 0 ? pct.toFixed(1) + '%' : '—'
          };
        });
      }

      detailBuckets = withPct(detailBuckets);
      periods = withPct(periods);

      var peakPeriod = null;
      periods.forEach(function (p) {
        if (!peakPeriod || p.count > peakPeriod.count) {
          peakPeriod = p;
        }
      });

      var byHour = [];
      for (i = 0; i < 24; i++) {
        var hc = hourCounts[i] || 0;
        byHour.push({
          hour: i,
          label: (i < 10 ? '0' : '') + i + ':00',
          count: hc,
          pct: total > 0 ? Math.round((hc / total) * 1000) / 10 : 0
        });
      }

      res.json({
        code: 200,
        data: {
          days: days,
          timezone: 'Asia/Shanghai (UTC+8)',
          total: total,
          periods: periods,
          detail_buckets: detailBuckets,
          peak_period: peakPeriod
            ? {
                key: peakPeriod.key,
                label: peakPeriod.label,
                count: peakPeriod.count,
                pct_text: peakPeriod.pct_text
              }
            : null,
          by_hour: byHour
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/** 从 birth_date 或 18 位税号解析出生日期 YYYY-MM-DD */
function parseUserBirthIso(birthDateRaw, taxIdRaw) {
  var s = String(birthDateRaw || '').trim();
  if (s) {
    var cn = s.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
    if (cn) {
      return cn[1] + '-' + pad2(parseInt(cn[2], 10)) + '-' + pad2(parseInt(cn[3], 10));
    }
    var norm = s.replace(/[./]/g, '-');
    var m = norm.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      return m[1] + '-' + pad2(parseInt(m[2], 10)) + '-' + pad2(parseInt(m[3], 10));
    }
    if (/^\d{8}$/.test(s)) {
      return s.substring(0, 4) + '-' + s.substring(4, 6) + '-' + s.substring(6, 8);
    }
  }
  var id = String(taxIdRaw || '')
    .replace(/\s/g, '')
    .toUpperCase();
  if (id.length === 18 && /^\d{17}[\dX]$/.test(id)) {
    var d = id.substring(6, 14);
    if (/^\d{8}$/.test(d)) {
      return d.substring(0, 4) + '-' + d.substring(4, 6) + '-' + d.substring(6, 8);
    }
  }
  return null;
}

function chinaTodayParts() {
  var key = chinaDateKeyNow();
  var p = key.split('-').map(Number);
  return { y: p[0], m: p[1], d: p[2], key: key };
}

/** 按北京时间计算周岁 */
function computeAgeFullYears(birthIso, refParts) {
  if (!birthIso || !refParts) {
    return null;
  }
  var bp = birthIso.split('-').map(Number);
  if (bp.length < 3 || !bp[0]) {
    return null;
  }
  var age = refParts.y - bp[0];
  if (refParts.m < bp[1] || (refParts.m === bp[1] && refParts.d < bp[2])) {
    age -= 1;
  }
  if (age < 0 || age > 130) {
    return null;
  }
  return age;
}

function buildRegisterUserScopeWhere(daysRaw, admin) {
  var allTime =
    daysRaw === '0' ||
    daysRaw === 'all' ||
    daysRaw === '' ||
    daysRaw == null ||
    daysRaw === undefined;
  var days = allTime ? 0 : clampAnalyticsDays(daysRaw, 30, 365);
  var where = '1=1';
  var params = [];
  if (!allTime) {
    var span = Math.max(0, days - 1);
    var cnCreated = 'DATE_ADD(users.created_at, INTERVAL 8 HOUR)';
    var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
    where +=
      ' AND DATE(' +
      cnCreated +
      ') >= DATE_SUB(' +
      cnToday +
      ', INTERVAL ? DAY)';
    params.push(span);
  }
  if (!admin || !admin.is_super) {
    where +=
      ' AND EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = users.username AND ac.owner_admin_username = ?)';
    params.push(admin.username);
  }
  return { where: where, params: params, days: days, all_time: allTime };
}

/** 女性用户年龄分析（未满 max_age 周岁筛选） */
async function handleAdminFemaleAgeStats(req, res) {
  try {
    var scope = buildRegisterUserScopeWhere(req.query.days, req.admin);
    var maxAge = parseInt(req.query.max_age, 10);
    if (isNaN(maxAge) || maxAge < 1) {
      maxAge = 30;
    }
    if (maxAge > 80) {
      maxAge = 80;
    }
    var underAgeExclusive = maxAge;

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        'SELECT username, real_name, birth_date, tax_id, created_at FROM users WHERE gender = 2 AND ' +
          scope.where +
          ' ORDER BY created_at DESC',
        scope.params
      );

      var ref = chinaTodayParts();
      var femaleTotal = rows.length;
      var withAge = 0;
      var underCount = 0;
      var bucketDefs = [
        { key: 'u18', label: '18岁以下', min: 0, max: 17 },
        { key: '18_22', label: '18-22岁', min: 18, max: 22 },
        { key: '23_26', label: '23-26岁', min: 23, max: 26 },
        { key: '27_29', label: '27-29岁', min: 27, max: 29 },
        { key: '30p', label: maxAge + '岁及以上', min: maxAge, max: 999 },
        { key: 'unknown', label: '年龄未知', min: null, max: null }
      ];
      var bucketCounts = {};
      bucketDefs.forEach(function (b) {
        bucketCounts[b.key] = 0;
      });

      var underUsers = [];
      rows.forEach(function (r) {
        var birthIso = null;
        var birthSource = '';
        var bd = String(r.birth_date || '').trim();
        if (bd) {
          birthIso = parseUserBirthIso(bd, '');
          if (birthIso) {
            birthSource = 'profile';
          }
        }
        if (!birthIso) {
          birthIso = parseUserBirthIso('', r.tax_id);
          if (birthIso) {
            birthSource = 'tax_id';
          }
        }
        var age = birthIso ? computeAgeFullYears(birthIso, ref) : null;
        if (age == null) {
          bucketCounts.unknown += 1;
          return;
        }
        withAge += 1;
        var placed = false;
        bucketDefs.forEach(function (b) {
          if (b.key === 'unknown' || placed) {
            return;
          }
          if (age >= b.min && age <= b.max) {
            bucketCounts[b.key] += 1;
            placed = true;
          }
        });
        if (!placed && age >= maxAge) {
          bucketCounts['30p'] += 1;
        }
        if (age < underAgeExclusive) {
          underCount += 1;
          underUsers.push({
            username: r.username,
            real_name: r.real_name || '',
            age: age,
            birth_date: birthIso,
            birth_source: birthSource,
            created_at: r.created_at
          });
        }
      });

      underUsers.sort(function (a, b) {
        if (a.age !== b.age) {
          return a.age - b.age;
        }
        return String(a.username).localeCompare(String(b.username));
      });

      function pctText(cnt, base) {
        if (!base) {
          return '—';
        }
        return (Math.round((cnt / base) * 1000) / 10).toFixed(1) + '%';
      }

      var ageBuckets = bucketDefs
        .filter(function (b) {
          return b.key !== '30p' || bucketCounts['30p'] > 0;
        })
        .map(function (b) {
          var cnt = bucketCounts[b.key] || 0;
          return {
            key: b.key,
            label: b.label,
            count: cnt,
            pct: femaleTotal > 0 ? Math.round((cnt / femaleTotal) * 1000) / 10 : 0,
            pct_text: pctText(cnt, femaleTotal)
          };
        });

      var scopeLabel = scope.all_time
        ? '全部注册女性用户'
        : '最近 ' + scope.days + ' 天注册的女性用户';

      res.json({
        code: 200,
        data: {
          days: scope.days,
          all_time: scope.all_time,
          scope_label: scopeLabel,
          reference_date: ref.key,
          max_age_exclusive: underAgeExclusive,
          filter_label: '未满' + underAgeExclusive + '岁',
          female_total: femaleTotal,
          with_age_count: withAge,
          no_age_count: femaleTotal - withAge,
          under_max_age_count: underCount,
          under_max_age_pct_text: pctText(underCount, femaleTotal),
          under_max_age_pct_of_known: pctText(underCount, withAge),
          age_buckets: ageBuckets,
          under_max_age_users: underUsers.slice(0, 500)
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 注册用户性别分布（users.gender：1=男 2=女） */
function registerChannelStatsKey(raw) {
  var c = raw != null ? String(raw).trim() : '';
  return c || '__empty__';
}

/** 北京时间日期序列：含首尾共 spanDays 天（从今天往前） */
function chinaDateKeysForSpan(spanDays) {
  var n = Math.max(1, parseInt(spanDays, 10) || 1);
  var today = chinaTodayParts();
  var keys = [];
  var base = new Date(Date.UTC(today.y, today.m - 1, today.d, 12, 0, 0));
  for (var i = n - 1; i >= 0; i--) {
    var dt = new Date(base.getTime() - i * 86400000);
    keys.push(formatDateKey(dt));
  }
  return keys;
}

/** 注册渠道按日趋势（仅统计已填写 register_source_channel 的用户） */
async function queryRegisterChannelByDay(conn, scope, trendSpanDays) {
  var span = Math.max(0, trendSpanDays - 1);
  var cnCreated = 'DATE_ADD(users.created_at, INTERVAL 8 HOUR)';
  var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
  var dayWhere =
    scope.where +
    " AND register_source_channel IS NOT NULL AND TRIM(register_source_channel) <> '' AND DATE(" +
    cnCreated +
    ') >= DATE_SUB(' +
    cnToday +
    ', INTERVAL ? DAY)';
  var dayParams = scope.params.concat([span]);
  const [dayRows] = await conn.query(
    'SELECT DATE(' +
      cnCreated +
      ') AS d, register_source_channel AS ch, COUNT(*) AS cnt FROM users WHERE ' +
      dayWhere +
      ' GROUP BY d, ch ORDER BY d ASC',
    dayParams
  );
  var dayMap = {};
  var channelTotals = {};
  (dayRows || []).forEach(function (r) {
    var dk = formatDateKey(r.d);
    if (!dk) {
      return;
    }
    if (!dayMap[dk]) {
      dayMap[dk] = { date: dk, total: 0, channels: {} };
    }
    var ck = registerChannelStatsKey(r.ch);
    if (ck === '__empty__') {
      return;
    }
    var c = Number(r.cnt) || 0;
    dayMap[dk].total += c;
    dayMap[dk].channels[ck] = (dayMap[dk].channels[ck] || 0) + c;
    channelTotals[ck] = (channelTotals[ck] || 0) + c;
  });
  var dateKeys = chinaDateKeysForSpan(trendSpanDays);
  var byDay = dateKeys.map(function (dk) {
    var row = dayMap[dk] || { date: dk, total: 0, channels: {} };
    var chList = Object.keys(row.channels).map(function (ck) {
      return {
        key: ck,
        label: registerSourceChannelLabel(ck),
        count: row.channels[ck]
      };
    });
    chList.sort(function (a, b) {
      return b.count - a.count;
    });
    return { date: dk, total: row.total, channels: chList };
  });
  var channelRank = Object.keys(channelTotals)
    .map(function (ck) {
      return { key: ck, label: registerSourceChannelLabel(ck), total: channelTotals[ck] };
    })
    .sort(function (a, b) {
      return b.total - a.total;
    });
  return { byDay: byDay, channelRank: channelRank };
}

function buildChannelStatsItems(rows, total, labelFn) {
  return (rows || []).map(function (r) {
    var raw = r.ch;
    var cnt = Number(r.cnt) || 0;
    var activated = r.activated_cnt != null ? Number(r.activated_cnt) || 0 : null;
    var pct = total > 0 ? Math.round((cnt / total) * 1000) / 10 : 0;
    var item = {
      key: registerChannelStatsKey(raw),
      label: labelFn(raw),
      count: cnt,
      pct: pct,
      pct_text: total > 0 ? pct.toFixed(1) + '%' : '—'
    };
    if (activated != null) {
      item.activated_count = activated;
      var actPct = cnt > 0 ? Math.round((activated / cnt) * 1000) / 10 : 0;
      item.activation_pct = actPct;
      item.activation_pct_text = cnt > 0 ? actPct.toFixed(1) + '%' : '—';
    }
    return item;
  });
}

/** 注册用户来源渠道分析（register_source_channel / activation_source_channel） */
async function handleAdminRegisterChannelStats(req, res) {
  try {
    var scope = buildRegisterUserScopeWhere(req.query.days, req.admin);
    var days = scope.days;
    var allTime = scope.all_time;

    const conn = await pool.getConnection();
    try {
      const [regRows] = await conn.query(
        'SELECT register_source_channel AS ch, COUNT(*) AS cnt, ' +
          'SUM(CASE WHEN account_active = 1 AND activation_refunded_at IS NULL AND list_hidden_at IS NULL THEN 1 ELSE 0 END) AS activated_cnt ' +
          'FROM users WHERE ' +
          scope.where +
          ' GROUP BY register_source_channel ORDER BY cnt DESC',
        scope.params
      );

      const [actRows] = await conn.query(
        'SELECT activation_source_channel AS ch, COUNT(*) AS cnt FROM users WHERE ' +
          scope.where +
          " AND account_active = 1 AND activation_refunded_at IS NULL AND list_hidden_at IS NULL AND activation_source_channel IS NOT NULL AND TRIM(activation_source_channel) <> '' " +
          'GROUP BY activation_source_channel ORDER BY cnt DESC',
        scope.params
      );

      var regTotal = 0;
      var withChannel = 0;
      var withoutChannel = 0;
      regRows.forEach(function (r) {
        var c = Number(r.cnt) || 0;
        regTotal += c;
        if (registerChannelStatsKey(r.ch) === '__empty__') {
          withoutChannel += c;
        } else {
          withChannel += c;
        }
      });

      var registerItemsAll = buildChannelStatsItems(regRows, regTotal, registerSourceChannelLabel);
      var registerItems = registerItemsAll.filter(function (it) {
        return it.key !== '__empty__';
      });
      registerItems = registerItems.map(function (it) {
        var pct = withChannel > 0 ? Math.round((it.count / withChannel) * 1000) / 10 : 0;
        return {
          key: it.key,
          label: it.label,
          count: it.count,
          pct: pct,
          pct_text: withChannel > 0 ? pct.toFixed(1) + '%' : '—',
          activated_count: it.activated_count,
          activation_pct: it.activation_pct,
          activation_pct_text: it.activation_pct_text
        };
      });

      var actTotal = 0;
      actRows.forEach(function (r) {
        actTotal += Number(r.cnt) || 0;
      });
      var activationItems = buildChannelStatsItems(actRows, actTotal, activationSourceChannelLabel);

      var activatedUsers = 0;
      registerItems.forEach(function (it) {
        activatedUsers += it.activated_count || 0;
      });
      var overallActivationPct =
        withChannel > 0 ? Math.round((activatedUsers / withChannel) * 1000) / 10 : 0;

      var byDay = [];
      var trendDays = 0;
      var trendScopeLabel = '';
      var channelRankInTrend = [];
      var trendSpan =
        allTime ? 90 : days > 0 ? Math.min(days, 365) : 0;
      if (trendSpan > 0) {
        trendDays = trendSpan;
        var trendResult = await queryRegisterChannelByDay(conn, scope, trendSpan);
        byDay = trendResult.byDay;
        channelRankInTrend = trendResult.channelRank;
        if (allTime) {
          trendScopeLabel =
            '近 ' +
            trendSpan +
            ' 日每日注册（汇总统计仍为全部注册用户；未填渠道不计入趋势）';
        } else {
          trendScopeLabel =
            '近 ' +
            trendSpan +
            ' 日每日注册（按来源渠道；未填渠道不计入）';
        }
      }

      var channelDefs = [];
      Object.keys(REGISTER_SOURCE_CHANNELS).forEach(function (k) {
        channelDefs.push({ key: k, label: REGISTER_SOURCE_CHANNELS[k] });
      });

      var scopeLabel = allTime
        ? '全部注册用户'
        : '最近 ' + days + ' 天注册用户';

      res.json({
        code: 200,
        data: {
          days: days,
          all_time: allTime,
          scope_label: scopeLabel,
          timezone: 'Asia/Shanghai (UTC+8)',
          total: withChannel,
          all_users_total: regTotal,
          with_register_channel: withChannel,
          without_register_channel: withoutChannel,
          excludes_empty_channel: true,
          activated_users: activatedUsers,
          overall_activation_pct: overallActivationPct,
          overall_activation_pct_text:
            withChannel > 0 ? overallActivationPct.toFixed(1) + '%' : '—',
          register_channels: registerItems,
          activation_channels: activationItems,
          activation_total: actTotal,
          trend_days: trendDays,
          trend_scope_label: trendScopeLabel,
          by_day: byDay,
          trend_channel_rank: channelRankInTrend,
          channel_definitions: channelDefs
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminRegisterGenderStats(req, res) {
  try {
    var scope = buildRegisterUserScopeWhere(req.query.days, req.admin);
    var days = scope.days;
    var allTime = scope.all_time;

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        'SELECT ' +
          'SUM(CASE WHEN gender = 1 THEN 1 ELSE 0 END) AS male_cnt, ' +
          'SUM(CASE WHEN gender = 2 THEN 1 ELSE 0 END) AS female_cnt, ' +
          'SUM(CASE WHEN gender IS NULL OR gender NOT IN (1, 2) THEN 1 ELSE 0 END) AS unknown_cnt ' +
          'FROM users WHERE ' +
          scope.where,
        scope.params
      );
      var row = rows && rows[0] ? rows[0] : {};
      var male = Number(row.male_cnt) || 0;
      var female = Number(row.female_cnt) || 0;
      var unknown = Number(row.unknown_cnt) || 0;
      var total = male + female + unknown;

      function pctText(cnt) {
        if (total <= 0) {
          return '—';
        }
        return ((Math.round((cnt / total) * 1000) / 10).toFixed(1) + '%');
      }

      function pctNum(cnt) {
        return total > 0 ? Math.round((cnt / total) * 1000) / 10 : 0;
      }

      var items = [
        {
          key: 'male',
          label: '男',
          gender: 1,
          count: male,
          pct: pctNum(male),
          pct_text: pctText(male)
        },
        {
          key: 'female',
          label: '女',
          gender: 2,
          count: female,
          pct: pctNum(female),
          pct_text: pctText(female)
        }
      ];
      if (unknown > 0) {
        items.push({
          key: 'unknown',
          label: '未设置',
          gender: 0,
          count: unknown,
          pct: pctNum(unknown),
          pct_text: pctText(unknown)
        });
      }

      var ratioText = null;
      if (male > 0 && female > 0) {
        if (male >= female) {
          ratioText = '男:女 ≈ ' + (Math.round((male / female) * 100) / 100) + ':1';
        } else {
          ratioText = '男:女 ≈ 1:' + (Math.round((female / male) * 100) / 100);
        }
      } else if (male > 0 && female === 0) {
        ratioText = '当前统计期内均为男性';
      } else if (female > 0 && male === 0) {
        ratioText = '当前统计期内均为女性';
      }

      var scopeLabel = allTime
        ? '全部注册用户（按资料中的性别字段）'
        : '最近 ' + days + ' 天注册用户（按资料中的性别字段）';

      res.json({
        code: 200,
        data: {
          days: days,
          all_time: allTime,
          scope_label: scopeLabel,
          total: total,
          items: items,
          ratio_text: ratioText
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminUsers(req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 10;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    var offset = (page - 1) * limit;

    // 筛选参数
    var qUsername = String(req.query.username || '').trim();
    var qRealName = String(req.query.real_name || '').trim();
    var qActive = req.query.active; // '1' or '0'
    var qBanned = req.query.banned; // '1' or '0'
    var qExact = req.query.exact === '1' || req.query.exact === 'true';
    var qRisk = req.query.risk; // '1' 仅风险, '0' 非风险
    var qSalaryMin = parseSalaryRangeFilterParam(req.query.salary_min);
    var qSalaryMax = parseSalaryRangeFilterParam(req.query.salary_max);
    var qTaxModifiedToday = req.query.tax_modified_today; // '1' 当日有改动, '0' 当日无改动
    var hasSalaryFilter = qSalaryMin != null || qSalaryMax != null;
    var todayKey = chinaDateKeyNow();
    if (qSalaryMin != null && qSalaryMax != null && qSalaryMin > qSalaryMax) {
      return res.status(400).json({ code: 400, msg: '工资收入下限不能大于上限' });
    }

    let whereClauses = ['users.list_hidden_at IS NULL'];
    let params = [];

    if (qUsername) {
      if (qExact) {
        whereClauses.push('username = ?');
        params.push(qUsername);
      } else {
        whereClauses.push('username LIKE ?');
        params.push('%' + qUsername + '%');
      }
    }
    if (qRealName) {
      if (qExact) {
        whereClauses.push('real_name = ?');
        params.push(qRealName);
      } else {
        whereClauses.push('real_name LIKE ?');
        params.push('%' + qRealName + '%');
      }
    }
    if (qRisk === '1') {
      whereClauses.push(userLoginRiskMatchSql('users.username'));
    } else if (qRisk === '0') {
      whereClauses.push('NOT ' + userLoginRiskMatchSql('users.username'));
    }
    if (qActive === '1' || qActive === '0') {
      whereClauses.push('account_active = ?');
      params.push(qActive === '1' ? 1 : 0);
    }
    if (qBanned === '1' || qBanned === '0') {
      whereClauses.push('banned = ?');
      params.push(qBanned === '1' ? 1 : 0);
    }
    if (qTaxModifiedToday === '1') {
      whereClauses.push(
        'EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = users.username AND tr.deleted_at IS NULL AND DATE(tr.updated_at) = ?)'
      );
      params.push(todayKey);
    } else if (qTaxModifiedToday === '0') {
      whereClauses.push(
        'NOT EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = users.username AND tr.deleted_at IS NULL AND DATE(tr.updated_at) = ?)'
      );
      params.push(todayKey);
    }
    if (!req.admin || !req.admin.is_super) {
      whereClauses.push(
        'EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = users.username AND ac.owner_admin_username = ?)'
      );
      params.push(req.admin.username);
    }

    let whereSql = whereClauses.length > 0 ? ' WHERE ' + whereClauses.join(' AND ') : '';

    const conn = await pool.getConnection();
    var rows = [];
    var total = 0;
    var avgSalaryMaps = {};

    if (hasSalaryFilter) {
      const [allUserRows] = await conn.query(
        'SELECT username FROM users' + whereSql + ' ORDER BY id DESC',
        params
      );
      var allUsernames = allUserRows.map(function (r) {
        return String(r.username);
      });
      avgSalaryMaps = await buildUserTaxAvgSalaryMap(conn, allUsernames);
      var filteredUsernames = [];
      for (var fi = 0; fi < allUsernames.length; fi++) {
        var funame = allUsernames[fi];
        var fsal = avgSalaryMaps[funame] || {
          avg_salary_6m: null,
          avg_salary_6m_label: '未填写',
          salary_month_count: 0
        };
        if (userMatchesSalaryRange(fsal, qSalaryMin, qSalaryMax)) {
          filteredUsernames.push(funame);
        }
      }
      total = filteredUsernames.length;
      var pageUsernames = filteredUsernames.slice(offset, offset + limit);
      if (pageUsernames.length) {
        var ph = pageUsernames.map(function () {
          return '?';
        }).join(',');
        const [pageRows] = await conn.query(
          `SELECT id, username, real_name, tax_id, account_active, banned,
                  last_login_city, created_at, hash, plain_password, register_source_channel,
                  activation_source_channel,
                  (SELECT ac.owner_admin_username
                   FROM activation_codes ac
                   WHERE ac.used_by_username = users.username
                     AND ac.owner_admin_username IS NOT NULL
                     AND TRIM(ac.owner_admin_username) <> ''
                   ORDER BY ac.last_used_at DESC, ac.id DESC
                   LIMIT 1) AS upline_admin_username
           FROM users WHERE username IN (` +
            ph +
            ') ORDER BY id DESC',
          pageUsernames
        );
        rows = pageRows;
      }
    } else {
      const [totalRows] = await conn.execute('SELECT COUNT(*) as count FROM users' + whereSql, params);
      total = totalRows[0].count;

      const [pageRows] = await conn.query(
        `
      SELECT id, username, real_name, tax_id, account_active, banned,
             last_login_city, created_at, hash, plain_password, register_source_channel,
             activation_source_channel,
             (SELECT ac.owner_admin_username
              FROM activation_codes ac
              WHERE ac.used_by_username = users.username
                AND ac.owner_admin_username IS NOT NULL
                AND TRIM(ac.owner_admin_username) <> ''
              ORDER BY ac.last_used_at DESC, ac.id DESC
              LIMIT 1) AS upline_admin_username
      FROM users ${whereSql} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}
    `,
        params
      );
      rows = pageRows;
      var usernamesOnPage = rows.map(function (r) {
        return r.username;
      });
      avgSalaryMaps = await buildUserTaxAvgSalaryMap(conn, usernamesOnPage);
    }

    var usernamesForRisk = rows.map(function (r) {
      return r.username;
    });
    var riskMaps = await buildUserLoginRiskMaps(conn, usernamesForRisk);
    var taxFlagsToday = await loadTaxRecordFlagsForUsernames(conn, usernamesForRisk, todayKey);
    conn.release();

    var out = rows.map(function (r) {
      var uname = String(r.username || '');
      var riskInfo = mergeUserRiskInfo(
        riskMaps.ipDistinct[uname] || 0,
        riskMaps.deviceCnt[uname] || 0,
        r.plain_password != null ? String(r.plain_password) : ''
      );
      var salInfo = avgSalaryMaps[uname] || {
        avg_salary_6m: null,
        avg_salary_6m_label: '未填写',
        salary_month_count: 0
      };
      return {
        id: r.id,
        username: r.username,
        real_name: r.real_name,
        tax_id: r.tax_id,
        account_active: r.account_active === 1 || r.account_active === true,
        banned: r.banned === 1 || r.banned === true,
        last_login_city: r.last_login_city != null && String(r.last_login_city).trim() !== '' ? String(r.last_login_city).trim() : '',
        upline_admin:
          r.upline_admin_username != null && String(r.upline_admin_username).trim() !== ''
            ? String(r.upline_admin_username).trim()
            : '',
        created_at: r.created_at ? r.created_at.toISOString() : '',
        password:
          r.plain_password != null && String(r.plain_password).trim() !== ''
            ? String(r.plain_password)
            : r.hash
              ? '—（未记录，用户再次登录后显示）'
              : '—',
        distinct_ip_count: riskInfo.distinct_ip_count,
        device_count: riskInfo.device_count,
        risk: riskInfo.risk,
        risk_messages: riskInfo.risk_messages,
        avg_salary_6m: salInfo.avg_salary_6m,
        avg_salary_6m_label: salInfo.avg_salary_6m_label,
        salary_month_count: salInfo.salary_month_count,
        tax_modified_today: !!(taxFlagsToday[uname] && taxFlagsToday[uname].tax_modified_on_date),
        register_source_channel:
          r.register_source_channel != null ? String(r.register_source_channel).trim() : '',
        register_source_channel_label: registerSourceChannelLabel(r.register_source_channel),
        activation_source_channel:
          r.activation_source_channel != null ? String(r.activation_source_channel).trim() : '',
        activation_source_channel_label: activationSourceChannelLabel(r.activation_source_channel),
        channel_analysis_label: userChannelAnalysisLabel(
          r.register_source_channel,
          r.activation_source_channel
        )
      };
    });
    res.json({
      code: 200,
      data: {
        users: out,
        total: total,
        page: page,
        limit: limit,
        tax_modified_date: todayKey
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

var USER_DATA_GC_DELIM = '\x1f';

function splitGcList(raw) {
  if (raw == null || raw === '') return [];
  return String(raw)
    .split(USER_DATA_GC_DELIM)
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
}

function mergeUniqueStrings() {
  var seen = {};
  var out = [];
  for (var i = 0; i < arguments.length; i++) {
    var arr = arguments[i];
    if (!arr || !arr.length) continue;
    for (var j = 0; j < arr.length; j++) {
      var s = String(arr[j] || '').trim();
      if (!s || seen[s]) continue;
      seen[s] = 1;
      out.push(s);
    }
  }
  return out;
}

function summarizeTextList(items, maxItems, maxChars) {
  maxItems = maxItems == null ? 3 : maxItems;
  maxChars = maxChars == null ? 160 : maxChars;
  var list = mergeUniqueStrings(items || []);
  if (!list.length) return '—';
  var head = list.slice(0, maxItems);
  var text = head.join('；');
  if (list.length > maxItems) {
    text += ' 等' + list.length + '项';
  }
  if (text.length > maxChars) {
    text = text.substring(0, maxChars - 1) + '…';
  }
  return text;
}

function appendAdminUserScope(whereClauses, params, admin, userCol) {
  if (!admin || admin.is_super) return;
  whereClauses.push(
    'EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = ' +
      userCol +
      ' AND ac.owner_admin_username = ?)'
  );
  params.push(admin.username);
}

function userTableAliasFromCol(userCol) {
  if (!userCol) return 'users';
  var idx = String(userCol).indexOf('.');
  return idx >= 0 ? String(userCol).slice(0, idx) : String(userCol);
}

/** 排除已激活退款、已软删除的账号（不计入激活相关统计） */
function appendNonRefundedUserFilter(whereClauses, userCol) {
  whereClauses.push(userActivationStatsEligibleSql(userCol));
}

function sqlScopeAnd(scopeSql, clause) {
  if (scopeSql) return scopeSql + ' AND ' + clause;
  return ' WHERE ' + clause;
}

async function buildUserDataBatchMaps(conn, usernames) {
  var map = {};
  if (!conn || !usernames || !usernames.length) return map;
  var uniq = [];
  var seen = {};
  usernames.forEach(function (u) {
    var id = String(u || '').trim();
    if (!id || seen[id]) return;
    seen[id] = 1;
    uniq.push(id);
    map[id] = {
      companies: [],
      company_tax_ids: [],
      tax_authorities: [],
      employers: [],
      family_members: [],
      family_count: 0,
      bank_cards: [],
      bank_count: 0,
      tax_record_count: 0
    };
  });
  if (!uniq.length) return map;
  var ph = uniq.map(function () {
    return '?';
  }).join(',');

  const [taxRows] = await conn.query(
    `SELECT user_id,
            COUNT(*) AS record_count,
            GROUP_CONCAT(DISTINCT NULLIF(TRIM(company_name), '') ORDER BY company_name SEPARATOR ?) AS companies,
            GROUP_CONCAT(DISTINCT NULLIF(TRIM(company_tax_id), '') ORDER BY company_tax_id SEPARATOR ?) AS tax_ids,
            GROUP_CONCAT(DISTINCT NULLIF(TRIM(tax_authority), '') ORDER BY tax_authority SEPARATOR ?) AS authorities
     FROM tax_records
     WHERE user_id IN (` +
      ph +
      `)
     GROUP BY user_id`,
    [USER_DATA_GC_DELIM, USER_DATA_GC_DELIM, USER_DATA_GC_DELIM].concat(uniq)
  );
  taxRows.forEach(function (r) {
    var uid = String(r.user_id);
    if (!map[uid]) return;
    map[uid].tax_record_count = Number(r.record_count) || 0;
    map[uid].companies = splitGcList(r.companies);
    map[uid].company_tax_ids = splitGcList(r.tax_ids);
    map[uid].tax_authorities = splitGcList(r.authorities);
  });

  const [empRows] = await conn.query(
    'SELECT user_id, company_name, credit_code, position, hire_date FROM employers WHERE user_id IN (' + ph + ')',
    uniq
  );
  empRows.forEach(function (r) {
    var uid = String(r.user_id);
    if (!map[uid]) return;
    var cn = r.company_name != null ? String(r.company_name).trim() : '';
    if (cn) {
      map[uid].companies = mergeUniqueStrings(map[uid].companies, [cn]);
    }
    map[uid].employers.push({
      company_name: cn,
      credit_code: r.credit_code != null ? String(r.credit_code) : '',
      position: r.position != null ? String(r.position) : '',
      hire_date: r.hire_date != null ? String(r.hire_date) : ''
    });
  });

  const [famAgg] = await conn.query(
    `SELECT user_id, COUNT(*) AS cnt,
            GROUP_CONCAT(CONCAT(IFNULL(real_name,''),'(',IFNULL(relation,''),')')
              ORDER BY created_at SEPARATOR ?) AS preview
     FROM family_members WHERE user_id IN (` +
      ph +
      `) GROUP BY user_id`,
    [USER_DATA_GC_DELIM].concat(uniq)
  );
  famAgg.forEach(function (r) {
    var uid = String(r.user_id);
    if (!map[uid]) return;
    map[uid].family_count = Number(r.cnt) || 0;
    map[uid].family_members = splitGcList(r.preview).map(function (line) {
      var m = /^(.+)\((.+)\)$/.exec(line);
      return { real_name: m ? m[1] : line, relation: m ? m[2] : '' };
    });
  });

  const [famDetail] = await conn.query(
    `SELECT user_id, real_name, relation, id_type_label, id_no, birth_date
     FROM family_members WHERE user_id IN (` +
      ph +
      `) ORDER BY user_id, created_at ASC`,
    uniq
  );
  famDetail.forEach(function (r) {
    var uid = String(r.user_id);
    if (!map[uid]) return;
    if (!map[uid]._family_full) map[uid]._family_full = [];
    map[uid]._family_full.push({
      real_name: r.real_name != null ? String(r.real_name) : '',
      relation: r.relation != null ? String(r.relation) : '',
      id_type_label: r.id_type_label != null ? String(r.id_type_label) : '',
      id_no: r.id_no != null ? String(r.id_no) : '',
      birth_date: r.birth_date != null ? String(r.birth_date) : ''
    });
  });

  const [bankRows] = await conn.query(
    'SELECT user_id, card_no, bank_name, province, phone FROM bank_cards WHERE user_id IN (' +
      ph +
      ') ORDER BY user_id, created_at ASC',
    uniq
  );
  bankRows.forEach(function (r) {
    var uid = String(r.user_id);
    if (!map[uid]) return;
    map[uid].bank_count = (map[uid].bank_count || 0) + 1;
    map[uid].bank_cards.push({
      card_no_masked: maskBankCardNo(r.card_no),
      card_no: r.card_no != null ? String(r.card_no) : '',
      bank_name: r.bank_name != null ? String(r.bank_name) : '',
      province: r.province != null ? String(r.province) : '',
      phone: r.phone != null ? String(r.phone) : ''
    });
  });

  uniq.forEach(function (uid) {
    var item = map[uid];
    if (!item) return;
    if (item._family_full) {
      item.family_members = item._family_full;
      delete item._family_full;
    }
    item.companies_summary = summarizeTextList(item.companies, 3, 140);
    item.company_tax_ids_summary = summarizeTextList(item.company_tax_ids, 2, 120);
    item.tax_authorities_summary = summarizeTextList(item.tax_authorities, 2, 120);
    item.family_summary =
      item.family_count > 0
        ? summarizeTextList(
            item.family_members.map(function (f) {
              return (f.real_name || '—') + '(' + (f.relation || '—') + ')';
            }),
            3,
            120
          )
        : '—';
    item.bank_summary =
      item.bank_count > 0
        ? summarizeTextList(
            item.bank_cards.map(function (b) {
              return (b.card_no_masked || '—') + (b.bank_name ? ' ' + b.bank_name : '');
            }),
            2,
            120
          )
        : '—';
  });

  return map;
}

async function handleAdminUserDataAnalytics(req, res) {
  try {
    const conn = await pool.getConnection();
    var where = [];
    var params = [];
    appendAdminUserScope(where, params, req.admin, 'u.username');
    var scopeSql = where.length ? ' WHERE ' + where.join(' AND ') : '';

    const [totalUserRows] = await conn.query('SELECT COUNT(*) AS c FROM users u' + scopeSql, params);
    var totalUsers = Number(totalUserRows[0].c) || 0;

    const [taxStats] = await conn.query(
      `SELECT COUNT(DISTINCT tr.user_id) AS users_with_tax,
              COUNT(*) AS total_records,
              COUNT(DISTINCT NULLIF(TRIM(tr.company_name), '')) AS distinct_companies,
              COUNT(DISTINCT NULLIF(TRIM(tr.tax_authority), '')) AS distinct_authorities
       FROM tax_records tr
       INNER JOIN users u ON u.username = tr.user_id` + scopeSql,
      params
    );

    const [famRows] = await conn.query(
      `SELECT COUNT(DISTINCT fm.user_id) AS c FROM family_members fm
       INNER JOIN users u ON u.username = fm.user_id` + scopeSql,
      params
    );
    const [bankRows] = await conn.query(
      `SELECT COUNT(DISTINCT bc.user_id) AS c FROM bank_cards bc
       INNER JOIN users u ON u.username = bc.user_id` + scopeSql,
      params
    );

    const [topCompanies] = await conn.query(
      `SELECT NULLIF(TRIM(tr.company_name), '') AS name, COUNT(DISTINCT tr.user_id) AS user_count
       FROM tax_records tr
       INNER JOIN users u ON u.username = tr.user_id` +
        sqlScopeAnd(scopeSql, "NULLIF(TRIM(tr.company_name), '') IS NOT NULL") +
        ` GROUP BY name ORDER BY user_count DESC, name ASC LIMIT 12`,
      params
    );

    const [topAuthorities] = await conn.query(
      `SELECT NULLIF(TRIM(tr.tax_authority), '') AS name, COUNT(*) AS cnt
       FROM tax_records tr
       INNER JOIN users u ON u.username = tr.user_id` +
        sqlScopeAnd(scopeSql, "NULLIF(TRIM(tr.tax_authority), '') IS NOT NULL") +
        ` GROUP BY name ORDER BY cnt DESC, name ASC LIMIT 10`,
      params
    );

    const [allScoped] = await conn.query('SELECT u.username FROM users u' + scopeSql + ' ORDER BY u.id DESC LIMIT 3000', params);
    var scopedNames = allScoped.map(function (r) {
      return String(r.username);
    });
    var avgMaps = await buildUserTaxAvgSalaryMap(conn, scopedNames);
    var buckets = [
      { label: '未填写', min: null, max: null, count: 0 },
      { label: '5000以下', min: 0, max: 5000, count: 0 },
      { label: '5000–1万', min: 5000, max: 10000, count: 0 },
      { label: '1万–2万', min: 10000, max: 20000, count: 0 },
      { label: '2万以上', min: 20000, max: null, count: 0 }
    ];
    scopedNames.forEach(function (uname) {
      var sal = avgMaps[uname];
      var v = sal && sal.avg_salary_6m != null ? Number(sal.avg_salary_6m) : null;
      if (v == null || !isFinite(v)) {
        buckets[0].count++;
        return;
      }
      if (v < 5000) buckets[1].count++;
      else if (v < 10000) buckets[2].count++;
      else if (v < 20000) buckets[3].count++;
      else buckets[4].count++;
    });

    conn.release();
    var ts = taxStats[0] || {};
    res.json({
      code: 200,
      data: {
        total_users: totalUsers,
        users_with_tax_records: Number(ts.users_with_tax) || 0,
        total_tax_records: Number(ts.total_records) || 0,
        distinct_companies: Number(ts.distinct_companies) || 0,
        distinct_tax_authorities: Number(ts.distinct_authorities) || 0,
        users_with_family: Number(famRows[0].c) || 0,
        users_with_bank: Number(bankRows[0].c) || 0,
        salary_buckets: buckets,
        top_companies: topCompanies.map(function (r) {
          return { name: String(r.name), user_count: Number(r.user_count) || 0 };
        }),
        top_tax_authorities: topAuthorities.map(function (r) {
          return { name: String(r.name), count: Number(r.cnt) || 0 };
        })
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

const HIGH_SALARY_CHART_DEFAULT_MIN = 20000;

function buildHighSalaryDistributionBuckets(values) {
  var defs = [
    { label: '2万–2.5万', min: 20000, max: 25000 },
    { label: '2.5万–3万', min: 25000, max: 30000 },
    { label: '3万–4万', min: 30000, max: 40000 },
    { label: '4万–5万', min: 40000, max: 50000 },
    { label: '5万以上', min: 50000, max: null }
  ];
  return defs.map(function (d) {
    var count = 0;
    values.forEach(function (v) {
      if (v < d.min) return;
      if (d.max != null && v >= d.max) return;
      count++;
    });
    return { label: d.label, min: d.min, max: d.max, count: count };
  });
}

function medianOfNumbers(nums) {
  if (!nums || !nums.length) return null;
  var s = nums.slice().sort(function (a, b) {
    return a - b;
  });
  var mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid];
  return Math.round(((s[mid - 1] + s[mid]) / 2) * 100) / 100;
}

async function handleAdminUserDataSalaryHighCharts(req, res) {
  try {
    var threshold = parseSalaryRangeFilterParam(req.query.min_salary);
    if (threshold == null) threshold = HIGH_SALARY_CHART_DEFAULT_MIN;

    const conn = await pool.getConnection();
    var where = [];
    var params = [];
    appendAdminUserScope(where, params, req.admin, 'u.username');
    var scopeSql = where.length ? ' WHERE ' + where.join(' AND ') : '';

    const [scopedWithTax] = await conn.query(
      `SELECT DISTINCT u.username FROM users u
       INNER JOIN tax_records tr ON tr.user_id = u.username` + scopeSql,
      params
    );
    var scopedNames = scopedWithTax.map(function (r) {
      return String(r.username);
    });
    var avgMaps = await buildUserTaxAvgSalaryMap(conn, scopedNames);

    var highEarners = [];
    scopedNames.forEach(function (uname) {
      var sal = avgMaps[uname];
      var v = sal && sal.avg_salary_6m != null ? Number(sal.avg_salary_6m) : null;
      if (v == null || !isFinite(v) || v < threshold) return;
      highEarners.push({
        username: uname,
        avg_salary_6m: v,
        salary_month_count: sal.salary_month_count || 0
      });
    });
    highEarners.sort(function (a, b) {
      return b.avg_salary_6m - a.avg_salary_6m;
    });

    var salaries = highEarners.map(function (e) {
      return e.avg_salary_6m;
    });
    var sum = 0;
    for (var i = 0; i < salaries.length; i++) {
      sum += salaries[i];
    }
    var avgAll =
      salaries.length > 0 ? Math.round((sum / salaries.length) * 100) / 100 : null;

    var topCompanies = [];
    if (highEarners.length) {
      var highNames = highEarners.map(function (e) {
        return e.username;
      });
      var ph = highNames.map(function () {
        return '?';
      }).join(',');
      const [compRows] = await conn.query(
        `SELECT NULLIF(TRIM(tr.company_name), '') AS name, COUNT(DISTINCT tr.user_id) AS user_count
         FROM tax_records tr
         WHERE tr.user_id IN (` +
          ph +
          `) AND NULLIF(TRIM(tr.company_name), '') IS NOT NULL
         GROUP BY name ORDER BY user_count DESC, name ASC LIMIT 12`,
        highNames
      );
      topCompanies = compRows.map(function (r) {
        return { name: String(r.name), user_count: Number(r.user_count) || 0 };
      });
    }

    conn.release();

    var distBuckets = buildHighSalaryDistributionBuckets(salaries);
    var topUsers = highEarners.slice(0, 12).map(function (e) {
      return {
        username: e.username,
        avg_salary_6m: e.avg_salary_6m,
        salary_month_count: e.salary_month_count
      };
    });

    res.json({
      code: 200,
      data: {
        min_salary: threshold,
        total_count: highEarners.length,
        avg_salary: avgAll,
        median_salary: medianOfNumbers(salaries),
        max_salary: salaries.length ? Math.max.apply(null, salaries) : null,
        min_salary_in_cohort: salaries.length ? Math.min.apply(null, salaries) : null,
        salary_distribution: distBuckets,
        top_companies: topCompanies,
        top_users: topUsers
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminUserDataList(req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 15;
    if (page < 1) page = 1;
    if (limit < 1) limit = 15;
    if (limit > 50) limit = 50;
    var offset = (page - 1) * limit;

    var qUsername = String(req.query.username || '').trim();
    var qRealName = String(req.query.real_name || '').trim();
    var qCompany = String(req.query.company || '').trim();
    var qHasFamily = req.query.has_family;
    var qHasBank = req.query.has_bank;
    var qSalaryMin = parseSalaryRangeFilterParam(req.query.salary_min);
    var qSalaryMax = parseSalaryRangeFilterParam(req.query.salary_max);
    var hasSalaryFilter = qSalaryMin != null || qSalaryMax != null;
    if (qSalaryMin != null && qSalaryMax != null && qSalaryMin > qSalaryMax) {
      return res.status(400).json({ code: 400, msg: '工资收入下限不能大于上限' });
    }

    var whereClauses = ['users.list_hidden_at IS NULL'];
    var params = [];
    if (qUsername) {
      whereClauses.push('users.username LIKE ?');
      params.push('%' + qUsername + '%');
    }
    if (qRealName) {
      whereClauses.push('users.real_name LIKE ?');
      params.push('%' + qRealName + '%');
    }
    if (qCompany) {
      whereClauses.push(
        `(EXISTS (SELECT 1 FROM tax_records trc WHERE trc.user_id = users.username AND trc.company_name LIKE ?)
          OR EXISTS (SELECT 1 FROM employers ec WHERE ec.user_id = users.username AND ec.company_name LIKE ?))`
      );
      params.push('%' + qCompany + '%', '%' + qCompany + '%');
    }
    if (qHasFamily === '1') {
      whereClauses.push('EXISTS (SELECT 1 FROM family_members fm WHERE fm.user_id = users.username)');
    } else if (qHasFamily === '0') {
      whereClauses.push('NOT EXISTS (SELECT 1 FROM family_members fm WHERE fm.user_id = users.username)');
    }
    if (qHasBank === '1') {
      whereClauses.push('EXISTS (SELECT 1 FROM bank_cards bc WHERE bc.user_id = users.username)');
    } else if (qHasBank === '0') {
      whereClauses.push('NOT EXISTS (SELECT 1 FROM bank_cards bc WHERE bc.user_id = users.username)');
    }
    appendAdminUserScope(whereClauses, params, req.admin, 'users.username');

    var whereSql = whereClauses.length ? ' WHERE ' + whereClauses.join(' AND ') : '';
    const conn = await pool.getConnection();
    var rows = [];
    var total = 0;
    var avgSalaryMaps = {};

    if (hasSalaryFilter) {
      const [allUserRows] = await conn.query(
        'SELECT username FROM users' + whereSql + ' ORDER BY id DESC',
        params
      );
      var allNames = allUserRows.map(function (r) {
        return String(r.username);
      });
      avgSalaryMaps = await buildUserTaxAvgSalaryMap(conn, allNames);
      var filtered = [];
      for (var fi = 0; fi < allNames.length; fi++) {
        var fn = allNames[fi];
        var fs = avgSalaryMaps[fn] || { avg_salary_6m: null };
        if (userMatchesSalaryRange(fs, qSalaryMin, qSalaryMax)) {
          filtered.push(fn);
        }
      }
      total = filtered.length;
      var pageNames = filtered.slice(offset, offset + limit);
      if (pageNames.length) {
        var ph = pageNames.map(function () {
          return '?';
        }).join(',');
        const [pageRows] = await conn.query(
          'SELECT id, username, real_name, tax_id, register_source_channel, activation_source_channel FROM users WHERE username IN (' +
            ph +
            ') ORDER BY id DESC',
          pageNames
        );
        rows = pageRows;
      }
    } else {
      const [totalRows] = await conn.execute('SELECT COUNT(*) AS count FROM users' + whereSql, params);
      total = totalRows[0].count;
      const [pageRows] = await conn.query(
        'SELECT id, username, real_name, tax_id, register_source_channel, activation_source_channel FROM users' +
          whereSql +
          ' ORDER BY id DESC LIMIT ? OFFSET ?',
        params.concat([limit, offset])
      );
      rows = pageRows;
      var pageNames2 = rows.map(function (r) {
        return r.username;
      });
      avgSalaryMaps = await buildUserTaxAvgSalaryMap(conn, pageNames2);
    }

    var usernames = rows.map(function (r) {
      return r.username;
    });
    var dataMaps = await buildUserDataBatchMaps(conn, usernames);
    conn.release();

    var list = rows.map(function (r) {
      var uname = String(r.username);
      var dm = dataMaps[uname] || {};
      var sal = avgSalaryMaps[uname] || {
        avg_salary_6m: null,
        avg_salary_6m_label: '未填写',
        salary_month_count: 0
      };
      return {
        id: r.id,
        username: uname,
        real_name: r.real_name != null ? String(r.real_name) : '',
        user_tax_id: r.tax_id != null ? String(r.tax_id) : '',
        id_card: formatUserIdCardForAdmin(r.tax_id),
        id_card_label: userIdCardLabelForAdmin(r.tax_id),
        avg_salary_6m: sal.avg_salary_6m,
        avg_salary_6m_label: sal.avg_salary_6m_label,
        salary_month_count: sal.salary_month_count,
        companies_summary: dm.companies_summary || '—',
        company_tax_ids_summary: dm.company_tax_ids_summary || '—',
        tax_authorities_summary: dm.tax_authorities_summary || '—',
        family_count: dm.family_count || 0,
        family_summary: dm.family_summary || '—',
        bank_count: dm.bank_count || 0,
        bank_summary: dm.bank_summary || '—',
        tax_record_count: dm.tax_record_count || 0,
        register_source_channel:
          r.register_source_channel != null ? String(r.register_source_channel).trim() : '',
        register_source_channel_label: registerSourceChannelLabel(r.register_source_channel),
        activation_source_channel:
          r.activation_source_channel != null ? String(r.activation_source_channel).trim() : '',
        activation_source_channel_label: activationSourceChannelLabel(r.activation_source_channel),
        channel_analysis_label: userChannelAnalysisLabel(
          r.register_source_channel,
          r.activation_source_channel
        )
      };
    });

    res.json({
      code: 200,
      data: { items: list, total: total, page: page, limit: limit }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminUserDataDetail(req, res) {
  var username = req.query.username != null ? String(req.query.username).trim() : '';
  if (!username) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      var allowed = await adminCanAccessTargetUser(conn, req.admin, username);
      if (!allowed) {
        return res.status(403).json({ code: 403, msg: '无权限查看该用户' });
      }
      const [userRows] = await conn.execute(
        'SELECT username, real_name, tax_id, created_at, register_source_channel, activation_source_channel FROM users WHERE username = ? LIMIT 1',
        [username]
      );
      if (!userRows.length) {
        return res.json({ code: 404, msg: '用户不存在' });
      }
      var u = userRows[0];
      var maps = await buildUserDataBatchMaps(conn, [username]);
      var dm = maps[username] || {};
      var avgMap = await buildUserTaxAvgSalaryMap(conn, [username]);
      var sal = avgMap[username] || { avg_salary_6m: null, avg_salary_6m_label: '未填写' };

      const [taxRows] = await conn.execute(
        ADMIN_TAX_RECORD_SELECT_SQL + ' WHERE user_id = ? AND deleted_at IS NULL ORDER BY year DESC, month DESC, id DESC LIMIT 120',
        [username]
      );

      var latestIssue = null;
      try {
        const [issueRows] = await conn.execute(
          `SELECT id, apply_time, period_start, period_end, record_no, scope, status, query_code, created_at
           FROM tax_issue_applications WHERE user_id = ? ORDER BY created_at DESC, apply_time DESC LIMIT 1`,
          [username]
        );
        if (issueRows.length) {
          var ir = issueRows[0];
          latestIssue = {
            id: ir.id != null ? String(ir.id) : '',
            apply_time: ir.apply_time ? String(ir.apply_time) : '',
            period_start: ir.period_start != null ? String(ir.period_start) : '',
            period_end: ir.period_end != null ? String(ir.period_end) : '',
            record_no: ir.record_no != null ? String(ir.record_no) : '',
            scope: ir.scope != null ? String(ir.scope) : '',
            status: ir.status != null ? String(ir.status) : '',
            query_code: ir.query_code != null ? String(ir.query_code) : '',
            created_at: ir.created_at ? ir.created_at.toISOString() : ''
          };
        }
      } catch (issueErr) {
        console.error('user-data detail issue', issueErr);
      }

      res.json({
        code: 200,
        data: {
          user: {
            username: String(u.username),
            real_name: u.real_name != null ? String(u.real_name) : '',
            user_tax_id: u.tax_id != null ? String(u.tax_id) : '',
            id_card: formatUserIdCardForAdmin(u.tax_id),
            id_card_label: userIdCardLabelForAdmin(u.tax_id),
            created_at: u.created_at ? u.created_at.toISOString() : '',
            register_source_channel:
              u.register_source_channel != null ? String(u.register_source_channel).trim() : '',
            register_source_channel_label: registerSourceChannelLabel(u.register_source_channel),
            activation_source_channel:
              u.activation_source_channel != null ? String(u.activation_source_channel).trim() : '',
            activation_source_channel_label: activationSourceChannelLabel(u.activation_source_channel),
            channel_analysis_label: userChannelAnalysisLabel(
              u.register_source_channel,
              u.activation_source_channel
            )
          },
          channel_analysis_label: userChannelAnalysisLabel(
            u.register_source_channel,
            u.activation_source_channel
          ),
          avg_salary_6m: sal.avg_salary_6m,
          avg_salary_6m_label: sal.avg_salary_6m_label,
          salary_month_count: sal.salary_month_count,
          companies: dm.companies || [],
          company_tax_ids: dm.company_tax_ids || [],
          tax_authorities: dm.tax_authorities || [],
          employers: dm.employers || [],
          family_members: dm.family_members || [],
          bank_cards: (dm.bank_cards || []).map(function (b) {
            return {
              card_no_masked: b.card_no_masked,
              bank_name: b.bank_name,
              province: b.province,
              phone: b.phone
            };
          }),
          tax_records: taxRows.map(mapTaxRecordRowForAdmin),
          latest_issue_application: latestIssue
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

function randomActivationCodePlain() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

async function handleAdminIssueCode(req, res) {
  try {
    var maxUses = 1;
    var plainCode = randomActivationCodePlain();
    const conn = await pool.getConnection();
    await conn.execute(
      'INSERT INTO activation_codes (code, max_uses, used_count, expires_at, note, owner_admin_username) VALUES (?, ?, 0, ?, ?, ?)',
      [plainCode, maxUses, null, null, req.admin && req.admin.username ? req.admin.username : null]
    );
    conn.release();
    return res.json({
      code: 200,
      data: { code: plainCode, max_uses: maxUses }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 批量生成激活码（闲鱼等），默认 100 条，写入库并返回列表供前端导出 TXT */
async function handleAdminIssueCodeBatch(req, res) {
  if (!req.admin || !req.admin.is_super) {
    return res.status(403).json({ code: 403, msg: '仅超级管理员可批量生成闲鱼激活码' });
  }
  var body = req.body || {};
  var count = parseInt(body.count, 10);
  if (!count || count < 1) {
    count = 100;
  }
  if (count > 100) {
    count = 100;
  }
  var noteRaw = body.note != null ? String(body.note).trim() : '闲鱼批量';
  var note = noteRaw || '闲鱼批量';
  if (note.length > 255) {
    note = note.slice(0, 255);
  }
  var maxUses = 1;
  var owner = req.admin && req.admin.username ? req.admin.username : null;
  var codes = [];
  var seen = Object.create(null);
  while (codes.length < count) {
    var c = randomActivationCodePlain();
    if (seen[c]) {
      continue;
    }
    seen[c] = true;
    codes.push(c);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (var i = 0; i < codes.length; i++) {
      await conn.execute(
        'INSERT INTO activation_codes (code, max_uses, used_count, expires_at, note, owner_admin_username) VALUES (?, ?, 0, ?, ?, ?)',
        [codes[i], maxUses, null, note, owner]
      );
    }
    await conn.commit();
    return res.json({
      code: 200,
      data: {
        codes: codes,
        count: codes.length,
        max_uses: maxUses,
        note: note,
        generated_at: new Date().toISOString()
      }
    });
  } catch (e) {
    try {
      await conn.rollback();
    } catch (eRb) {}
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  } finally {
    conn.release();
  }
}

async function handleAdminCodes(req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 10;
    var qOwnerAdmin = req.query.owner_admin != null ? String(req.query.owner_admin).trim() : '';
    var qUsedBy = req.query.used_by != null ? String(req.query.used_by).trim() : '';
    var usedByExact =
      req.query.used_by_exact === '1' ||
      req.query.used_by_exact === 'true' ||
      req.query.used_by_exact === true;
    var qUsageStatus = req.query.usage_status != null ? String(req.query.usage_status).trim() : '';
    var qCode = req.query.code != null ? String(req.query.code).trim() : '';
    var codeExact =
      req.query.code_exact === '1' ||
      req.query.code_exact === 'true' ||
      req.query.code_exact === true;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    var offset = (page - 1) * limit;

    const conn = await pool.getConnection();
    var conditions = [];
    var params = [];
    if (!req.admin || !req.admin.is_super) {
      conditions.push('ac.owner_admin_username = ?');
      params.push(req.admin.username);
    } else if (qOwnerAdmin) {
      conditions.push('ac.owner_admin_username LIKE ?');
      params.push('%' + qOwnerAdmin + '%');
    }
    if (qUsedBy) {
      if (usedByExact) {
        conditions.push('ac.used_by_username = ?');
        params.push(qUsedBy);
      } else {
        conditions.push('ac.used_by_username LIKE ?');
        params.push('%' + qUsedBy + '%');
      }
    }
    if (qUsageStatus === 'unused') {
      conditions.push('ac.used_count = 0');
    } else if (qUsageStatus === 'used') {
      conditions.push('ac.used_count > 0');
    }
    if (qCode) {
      if (codeExact) {
        conditions.push('ac.code = ?');
        params.push(qCode);
      } else {
        conditions.push('ac.code LIKE ?');
        params.push('%' + qCode + '%');
      }
    }
    var scope = req.query.scope != null ? String(req.query.scope).trim() : '';
    if (scope === 'xianyu') {
      conditions.push("(ac.note IS NOT NULL AND ac.note LIKE '%闲鱼%')");
    } else if (scope === 'general') {
      conditions.push("(ac.note IS NULL OR ac.note NOT LIKE '%闲鱼%')");
    }
    var whereSql = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const [totalRows] = await conn.execute(
      'SELECT COUNT(*) as count FROM activation_codes ac' + whereSql,
      params
    );
    const total = totalRows[0].count;

    var hasListFilter = !!(qOwnerAdmin || qUsedBy || qUsageStatus || qCode);
    var orderSql =
      req.admin && req.admin.is_super && !hasListFilter
        ? ' ORDER BY ac.id DESC'
        : qOwnerAdmin && !qUsedBy
          ? ' ORDER BY COALESCE(NULLIF(TRIM(ac.owner_admin_username), \'\'), \'—\') ASC, ac.id DESC'
          : ' ORDER BY ac.id DESC';
    const [rows] = await conn.query(
      `SELECT ac.id, ac.code, ac.max_uses, ac.used_count, ac.note, ac.created_at, ac.last_used_at,
              ac.used_by_username, ac.owner_admin_username,
              u.register_source_channel AS used_user_register_source,
              u.activation_source_channel AS used_user_activation_source
       FROM activation_codes ac
       LEFT JOIN users u ON u.username = ac.used_by_username
       ${whereSql}${orderSql}
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    conn.release();
    var out = rows.map(function (r) {
      var regCh =
        r.used_user_register_source != null ? String(r.used_user_register_source).trim() : '';
      var actCh =
        r.used_user_activation_source != null ? String(r.used_user_activation_source).trim() : '';
      return {
        id: r.id,
        code: r.code,
        max_uses: r.max_uses,
        used_count: r.used_count,
        note: r.note,
        is_xianyu: isXianyuActivationNote(r.note),
        created_at: r.created_at ? r.created_at.toISOString() : '',
        last_used_at: r.last_used_at ? r.last_used_at.toISOString() : null,
        used_by_username:
          r.used_by_username != null && String(r.used_by_username).trim() !== ''
            ? String(r.used_by_username).trim()
            : null,
        owner_admin_username:
          r.owner_admin_username != null && String(r.owner_admin_username).trim() !== ''
            ? String(r.owner_admin_username).trim()
            : null,
        used_user_channel_label:
          r.used_by_username && String(r.used_by_username).trim() !== ''
            ? userChannelAnalysisLabel(regCh, actCh)
            : null
      };
    });
    res.json({ code: 200, data: { codes: out, total: total, page: page, limit: limit } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminUserActivate(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  var code = body.code != null ? String(body.code).trim() : '';
  if (!target) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  if (!code) {
    return res.status(400).json({ code: 400, msg: '请输入激活码' });
  }
  if (target.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    return res.status(400).json({ code: 400, msg: '不能操作保留账号名' });
  }
  const conn = await pool.getConnection();
  try {
    const [urows] = await conn.execute(
      'SELECT id, account_active, list_hidden_at FROM users WHERE username = ?',
      [target]
    );
    if (urows.length === 0) {
      conn.release();
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }
    if (urows[0].list_hidden_at) {
      conn.release();
      return res.status(400).json({ code: 400, msg: '该账号已在已删除列表中' });
    }
    var allowed = await adminCanAccessTargetUser(conn, req.admin, target);
    if (!allowed) {
      conn.release();
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    var already =
      urows[0].account_active === 1 ||
      urows[0].account_active === true ||
      Number(urows[0].account_active) === 1;
    conn.release();
    if (already) {
      return res.json({ code: 200, data: { username: target, account_active: true }, msg: '账号已激活' });
    }
    await applyActivationCode(target, code);
    return res.json({ code: 200, data: { username: target, account_active: true }, msg: '激活成功' });
  } catch (e) {
    try {
      conn.release();
    } catch (e2) {}
    return res.status(400).json({ code: 400, msg: e.message || String(e) });
  }
}

async function handleAdminBan(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  var ban = body.banned === 1 || body.banned === true || body.banned === '1';
  if (!target) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  if (target.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    return res.status(400).json({ code: 400, msg: '不能操作保留账号名' });
  }
  try {
    const conn = await pool.getConnection();
    const [urows] = await conn.execute('SELECT id FROM users WHERE username = ?', [target]);
    if (urows.length === 0) {
      conn.release();
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }
    var allowed = await adminCanAccessTargetUser(conn, req.admin, target);
    if (!allowed) {
      conn.release();
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    if (ban) {
      await conn.execute(
        'UPDATE users SET banned = 1, session_rev = session_rev + 1 WHERE username = ?',
        [target]
      );
    } else {
      await conn.execute('UPDATE users SET banned = 0 WHERE username = ?', [target]);
    }
    conn.release();
    return res.json({ code: 200, data: { username: target, banned: ban, session_revoked: !!ban } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminSettingsGet(req, res) {
  try {
    var mineUi = await getMineUiForAdminForm();
    var installRaw = await getInstallPackageSettingsFromDb();
    var qrRef = await getWechatPayQrcodeUrl();
    var conversionAb = await loadConversionAbParsed();
    return res.json({
      code: 200,
      data: {
        mine_ui: mineUi,
        android_apk_download_url: installRaw.android,
        agent_android_apk_download_url: installRaw.agent_android,
        ios_mobileconfig_download_url: installRaw.ios,
        xianyu_purchase_url: installRaw.xianyu,
        xianyu_hide_sales_channels: (installRaw.xianyu_hide_channels || []).join('\n'),
        qq_add_url: sanitizeInstallDownloadUrl(installRaw.qq),
        qq_group_url: sanitizeInstallDownloadUrl(installRaw.qq_group),
        wechat_pay_qrcode_url: qrRef,
        wechat_pay_qrcode_display_url: resolvePublicAssetUrl(qrRef),
        conversion_ab: conversionAb
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminSettingsPost(req, res) {
  var body = req.body || {};
  var hasMineUi = body.mine_ui != null && typeof body.mine_ui === 'object';
  var hasAndroid = Object.prototype.hasOwnProperty.call(body, 'android_apk_download_url');
  var hasAgentAndroid = Object.prototype.hasOwnProperty.call(body, 'agent_android_apk_download_url');
  var hasIos = Object.prototype.hasOwnProperty.call(body, 'ios_mobileconfig_download_url');
  var hasXianyu = Object.prototype.hasOwnProperty.call(body, 'xianyu_purchase_url');
  var hasXianyuHideChannels = Object.prototype.hasOwnProperty.call(body, 'xianyu_hide_sales_channels');
  var hasQqAdd = Object.prototype.hasOwnProperty.call(body, 'qq_add_url');
  var hasQqGroup = Object.prototype.hasOwnProperty.call(body, 'qq_group_url');
  var hasWechatPayQr = Object.prototype.hasOwnProperty.call(body, 'wechat_pay_qrcode_url');
  var hasConversionAb = body.conversion_ab != null && typeof body.conversion_ab === 'object';
  if (
    !hasMineUi &&
    !hasAndroid &&
    !hasAgentAndroid &&
    !hasIos &&
    !hasXianyu &&
    !hasXianyuHideChannels &&
    !hasQqAdd &&
    !hasQqGroup &&
    !hasWechatPayQr &&
    !hasConversionAb
  ) {
    return res.status(400).json({
      code: 400,
      msg: '请提供 mine_ui、安装包下载地址、闲鱼购买链接、闲鱼隐藏渠道、QQ 添加/加群链接、转化 A/B 配置或微信收款码（wechat_pay_qrcode_url）'
    });
  }

  const conn = await pool.getConnection();
  try {
    if (hasMineUi) {
      var prev = await loadMineUiParsed();
      var merged = Object.assign({ use_default_images: false }, cloneMineUiDefaults());
      if (prev) {
        if (prev.theme === 'yellow' || prev.theme === 'blue') {
          merged.theme = prev.theme;
        }
        merged.use_default_images = prev.use_default_images === true;
        MINE_UI_IMAGE_KEYS.forEach(function (k) {
          if (prev[k] != null) {
            var okPrev = sanitizeMineUiImageRef(prev[k]);
            if (okPrev) {
              merged[k] = okPrev;
            }
          }
        });
        MINE_UI_VIDEO_KEYS.forEach(function (k) {
          if (prev[k] != null) {
            var okPrev = sanitizeMineUiImageRef(prev[k]);
            if (okPrev) {
              merged[k] = okPrev;
            }
          }
        });
        INSTALL_SHOWCASE_IMAGE_KEYS.forEach(function (k) {
          if (prev[k] != null) {
            var okPrevShow = sanitizeMineUiImageRef(prev[k]);
            if (okPrevShow) {
              merged[k] = okPrevShow;
            }
          }
        });
      }
      var incoming = body.mine_ui;
      if (incoming.theme === 'blue' || incoming.theme === 'yellow') {
        merged.theme = incoming.theme;
      }
      if (incoming.use_default_images === true || incoming.use_default_images === 'true' || incoming.use_default_images === 1) {
        merged.use_default_images = true;
      } else if (Object.prototype.hasOwnProperty.call(incoming, 'use_default_images')) {
        merged.use_default_images = false;
      }
      MINE_UI_IMAGE_KEYS.forEach(function (k) {
        if (incoming[k] != null && String(incoming[k]).trim() !== '') {
          if (k === 'message_header' && isDeprecatedMessageHeaderRef(incoming[k])) {
            merged.message_header = '';
            return;
          }
          var ok = sanitizeMineUiImageRef(String(incoming[k]).trim());
          if (ok) {
            merged[k] = ok;
          }
        }
      });
      if (
        Object.prototype.hasOwnProperty.call(incoming, 'message_header') &&
        String(incoming.message_header || '').trim() === ''
      ) {
        merged.message_header = '';
      }
      MINE_UI_VIDEO_KEYS.forEach(function (k) {
        if (incoming[k] != null && String(incoming[k]).trim() !== '') {
          var ok = sanitizeMineUiImageRef(String(incoming[k]).trim());
          if (ok) {
            merged[k] = ok;
          }
        }
      });
      INSTALL_SHOWCASE_IMAGE_KEYS.forEach(function (k) {
        if (incoming[k] != null && String(incoming[k]).trim() !== '') {
          var okShow = sanitizeMineUiImageRef(String(incoming[k]).trim());
          if (okShow) {
            merged[k] = okShow;
          }
        }
      });
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_MINE_UI, JSON.stringify(merged)]
      );
    }

    if (hasAndroid) {
      var rawA = body.android_apk_download_url;
      var okA = sanitizeInstallDownloadUrl(rawA);
      if (rawA != null && String(rawA).trim() !== '' && !okA) {
        return res.status(400).json({ code: 400, msg: '安卓安装包地址无效（请使用 http 或 https 完整链接）' });
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_ANDROID_APK, okA]
      );
    }

    if (hasAgentAndroid) {
      var rawAgentA = body.agent_android_apk_download_url;
      var okAgentA = sanitizeInstallDownloadUrl(rawAgentA);
      if (rawAgentA != null && String(rawAgentA).trim() !== '' && !okAgentA) {
        return res.status(400).json({
          code: 400,
          msg: '代理专用安卓安装包地址无效（请使用 http 或 https 完整链接）'
        });
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_AGENT_ANDROID_APK, okAgentA]
      );
    }

    if (hasIos) {
      var rawI = body.ios_mobileconfig_download_url;
      var okI = sanitizeInstallDownloadUrl(rawI);
      if (rawI != null && String(rawI).trim() !== '' && !okI) {
        return res.status(400).json({
          code: 400,
          msg: 'iOS 描述文件地址无效（http(s) 完整链接，或以 / 开头的站内路径）'
        });
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_IOS_MOBILECONFIG, okI]
      );
    }

    if (hasXianyu) {
      var okX = sanitizeXianyuPurchaseText(body.xianyu_purchase_url);
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_XIANYU_PURCHASE, okX]
      );
    }

    if (hasXianyuHideChannels) {
      var hideList = parseXianyuHideSalesChannels(body.xianyu_hide_sales_channels);
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_XIANYU_HIDE_CHANNELS, serializeXianyuHideSalesChannels(hideList)]
      );
    }

    if (hasQqAdd) {
      var rawQq = body.qq_add_url;
      var okQq = sanitizeInstallDownloadUrl(rawQq);
      if (rawQq != null && String(rawQq).trim() !== '' && !okQq) {
        return res.status(400).json({
          code: 400,
          msg: 'QQ 添加链接无效（请使用 http 或 https 完整链接）'
        });
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_QQ_ADD_URL, okQq]
      );
    }

    if (hasQqGroup) {
      var rawQqGroup = body.qq_group_url;
      var okQqGroup = sanitizeInstallDownloadUrl(rawQqGroup);
      if (rawQqGroup != null && String(rawQqGroup).trim() !== '' && !okQqGroup) {
        return res.status(400).json({
          code: 400,
          msg: 'QQ 加群链接无效（请使用 http 或 https 完整链接）'
        });
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_QQ_GROUP_URL, okQqGroup]
      );
    }

    if (hasWechatPayQr) {
      var rawQr = body.wechat_pay_qrcode_url;
      var okQr = '';
      if (rawQr != null && String(rawQr).trim() !== '') {
        okQr = sanitizeMineUiImageRef(String(rawQr).trim());
        if (!okQr) {
          return res.status(400).json({
            code: 400,
            msg: '微信收款码地址无效（请上传图片或填写 uploads/… 或 https 链接）'
          });
        }
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_WECHAT_PAY_QRCODE, okQr]
      );
      invalidateWechatPayQrcodeCache();
    }

    if (hasConversionAb) {
      var prevAb = await loadConversionAbParsed();
      var incAb = body.conversion_ab;
      var mergedAb = Object.assign({}, prevAb);
      if (incAb.enabled === true || incAb.enabled === false) {
        mergedAb.enabled = incAb.enabled === true;
      }
      if (incAb.activate_title_a != null) {
        mergedAb.activate_title_a = String(incAb.activate_title_a).substring(0, 120);
      }
      if (incAb.activate_subtitle_a != null) {
        mergedAb.activate_subtitle_a = String(incAb.activate_subtitle_a).substring(0, 200);
      }
      if (incAb.activate_title_b != null) {
        mergedAb.activate_title_b = String(incAb.activate_title_b).substring(0, 120);
      }
      if (incAb.activate_subtitle_b != null) {
        mergedAb.activate_subtitle_b = String(incAb.activate_subtitle_b).substring(0, 200);
      }
      if (incAb.batch_example_prominent === true || incAb.batch_example_prominent === false) {
        mergedAb.batch_example_prominent = incAb.batch_example_prominent === true;
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_CONVERSION_AB, JSON.stringify(mergedAb)]
      );
    }

    var outData = { success: true };
    outData.mine_ui = await getMineUiForAdminForm();
    var installAfter = await getInstallPackageSettingsFromDb();
    outData.android_apk_download_url = installAfter.android;
    outData.agent_android_apk_download_url = installAfter.agent_android;
    outData.ios_mobileconfig_download_url = installAfter.ios;
    outData.xianyu_purchase_url = installAfter.xianyu;
    outData.xianyu_hide_sales_channels = (installAfter.xianyu_hide_channels || []).join('\n');
    outData.qq_add_url = sanitizeInstallDownloadUrl(installAfter.qq);
    outData.qq_group_url = sanitizeInstallDownloadUrl(installAfter.qq_group);
    var qrAfter = await getWechatPayQrcodeUrl();
    outData.wechat_pay_qrcode_url = qrAfter;
    outData.wechat_pay_qrcode_display_url = resolvePublicAssetUrl(qrAfter);
    outData.conversion_ab = await loadConversionAbParsed();
    return res.json({ code: 200, data: outData });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  } finally {
    conn.release();
  }
}

async function handlePublicMineUi(req, res) {
  try {
    var mineUi = await getMineUiForApi();
    return res.json({ code: 200, data: mineUi });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handlePublicSalesChannelAttribution(req, res) {
  try {
    var body = req.body || {};
    var ch = sanitizeSalesChannelId(body.sales_ch || body.ch || '');
    if (!ch) {
      return res.status(400).json({ code: 400, msg: 'sales_ch required' });
    }
    var sourcePage = body.source_page != null ? String(body.source_page).trim().substring(0, 128) : '';
    await recordSalesChannelAttribution(req, ch, sourcePage);
    return res.json({ code: 200, data: { ok: true, sales_ch: ch } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handlePublicResolveSalesChannel(req, res) {
  try {
    var ch = await resolveSalesChannelForRequest(req);
    return res.json({
      code: 200,
      data: {
        sales_ch: ch || null,
        resolved: !!ch
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handlePublicInstallPackages(req, res) {
  try {
    var raw = await getInstallPackageSettingsFromDb();
    var android = sanitizeInstallDownloadUrl(raw.android);
    var ios = sanitizeInstallDownloadUrl(raw.ios);
    var xianyu = sanitizeXianyuPurchaseText(raw.xianyu);
    var qq = sanitizeInstallDownloadUrl(raw.qq);
    var qqGroup = sanitizeInstallDownloadUrl(raw.qq_group);
    var salesCh = await resolveEffectiveSalesChannel(req);
    // 已登录用户仅以账号 sales_promo_channel 判断是否隐藏闲鱼，避免 IP 归因误判普通注册用户
    var hideXianyu = await shouldHideXianyuForRequest(req);
    if (hideXianyu) {
      xianyu = '';
      var agentApk = sanitizeInstallDownloadUrl(raw.agent_android);
      if (agentApk) {
        android = agentApk;
      }
    }
    return res.json({
      code: 200,
      data: {
        android_apk_download_url: android,
        ios_mobileconfig_download_url: ios,
        xianyu_purchase_url: xianyu,
        show_xianyu_purchase: !hideXianyu && !!xianyu,
        sales_channel: salesCh || null,
        qq_add_url: qq,
        qq_group_url: qqGroup
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminUserTaxRecords(req, res) {
  var username = req.query.username != null ? String(req.query.username).trim() : '';
  if (!username) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      var allowed = await adminCanAccessTargetUser(conn, req.admin, username);
      if (!allowed) {
        return res.status(403).json({ code: 403, msg: '无权限查看该用户详情' });
      }
      const [rows] = await conn.execute(
        ADMIN_TAX_RECORD_SELECT_SQL +
          ' WHERE user_id = ? ORDER BY year DESC, month DESC, id DESC LIMIT 200',
        [username]
      );
      const [devices] = await conn.execute(
        `SELECT user_agent_short, ip_last, city_last, first_seen, last_seen, login_count, client_id, device_detail_json
         FROM user_devices
         WHERE username = ?
         ORDER BY last_seen DESC
         LIMIT 30`,
        [username]
      );
      const [pages] = await conn.execute(
        `SELECT e.page_path, e.route_key, e.created_at AS last_entered_at
         FROM user_page_events e
         INNER JOIN (
           SELECT page_path, MAX(id) AS max_id
           FROM user_page_events
           WHERE username = ?
           GROUP BY page_path
         ) t ON e.id = t.max_id
         WHERE e.username = ?
         ORDER BY e.created_at DESC
         LIMIT 120`,
        [username, username]
      );
      const [issueRows] = await conn.execute(
        `SELECT id, apply_time, period_start, period_end, record_no, scope, status, query_code, created_at, updated_at
         FROM tax_issue_applications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 80`,
        [username]
      );
      var out = rows.map(mapTaxRecordRowForAdmin);
      var devOut = devices.map(function (r) {
        var model = '';
        var platform = '';
        var osVersion = '';
        var appVersion = '';
        try {
          if (r.device_detail_json) {
            var parsed = JSON.parse(String(r.device_detail_json));
            if (parsed && typeof parsed === 'object') {
              model = parsed.model != null ? String(parsed.model) : '';
              platform = parsed.platform != null ? String(parsed.platform) : '';
              osVersion = parsed.os_version != null ? String(parsed.os_version) : '';
              appVersion = parsed.app_version != null ? String(parsed.app_version) : '';
            }
          }
        } catch (e1) {}
        return {
          model: model,
          platform: platform,
          os_version: osVersion,
          app_version: appVersion,
          user_agent_short: r.user_agent_short != null ? String(r.user_agent_short) : '',
          ip_last: r.ip_last != null ? String(r.ip_last) : '',
          city_last: resolveDeviceCityLabel(r.ip_last, r.city_last),
          first_seen: r.first_seen ? r.first_seen.toISOString() : '',
          last_seen: r.last_seen ? r.last_seen.toISOString() : '',
          login_count: r.login_count != null ? Number(r.login_count) : 0,
          client_id: r.client_id != null ? String(r.client_id) : ''
        };
      });
      var pageOut = pages.map(function (r) {
        return {
          page_path: r.page_path != null ? String(r.page_path) : '',
          route_key: r.route_key != null ? String(r.route_key) : '',
          last_entered_at: r.last_entered_at ? r.last_entered_at.toISOString() : ''
        };
      });
      var issueOut = issueRows.map(function (r) {
        return {
          id: r.id != null ? String(r.id) : '',
          apply_time: r.apply_time != null ? String(r.apply_time) : '',
          period_start: r.period_start != null ? String(r.period_start) : '',
          period_end: r.period_end != null ? String(r.period_end) : '',
          record_no: r.record_no != null ? String(r.record_no) : '',
          scope: r.scope != null ? String(r.scope) : '',
          status: r.status != null ? String(r.status) : '',
          query_code: r.query_code != null ? String(r.query_code) : '',
          created_at: r.created_at ? r.created_at.toISOString() : '',
          updated_at: r.updated_at ? r.updated_at.toISOString() : ''
        };
      });
      var salaryInfo = computeTaxRecordsAvgSalary6m(out);
      var changeDate =
        req.query.change_date != null && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.change_date).trim())
          ? String(req.query.change_date).trim()
          : chinaDateKeyNow();
      var todayChanges = await loadTaxRecordChangesForUser(conn, username, changeDate);
      var taxFlagsOne = await loadTaxRecordFlagsForUsernames(conn, [username], changeDate);
      var taxFlag = taxFlagsOne[username] || { tax_modified_on_date: false };
      return res.json({
        code: 200,
        data: {
          records: out,
          devices: devOut,
          recent_pages: pageOut,
          issue_applications: issueOut,
          avg_salary_6m: salaryInfo.avg_salary_6m,
          avg_salary_6m_label: salaryInfo.avg_salary_6m_label,
          salary_month_count: salaryInfo.salary_month_count,
          change_date: changeDate,
          tax_modified_on_date: !!taxFlag.tax_modified_on_date,
          today_tax_changes: todayChanges
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 页面路径 → 中文 title（与 C 端 HTML title 一致，供行为分析展示） */
var CERT_PAGE_TITLE_ZH = {
  'index.html': '个人所得税',
  'login.html': '个人所得税',
  'shouye.html': '首页',
  'mine.html': '我的',
  'consult.html': '个人中心',
  'profile.html': '个人中心',
  'shuiming.html': '收入纳税明细',
  'shuiming_result.html': '收入纳税明细',
  'xiangqing.html': '收入纳税明细详情',
  'daiban.html': '待办',
  'bancha.html': '办查',
  'message.html': '消息',
  'message_detail.html': '消息详情',
  'zonghe.html': '综合所得年度汇算',
  'renzhi.html': '任职受雇',
  'renzhi_detail.html': '详情',
  'jtcy.html': '家庭成员',
  'jtcy_add.html': '添加家庭成员',
  'jtcy_detail.html': '详情',
  'yhk.html': '银行卡',
  'yhk_add.html': '添加银行卡',
  'yhk_manage.html': '管理',
  'aqzx.html': '安全中心',
  'xiugaimima.html': '修改密码',
  'gerenxinxi.html': '个人信息',
  'personal_info.html': '个人信息',
  'register.html': '注册账号',
  'najilu.html': '纳税记录开具',
  'shenbao_jilu.html': '申报记录',
  'shenbao_jilu_detail.html': '申报记录详情',
  'shenbao_income_detail.html': '工资薪金',
  'shuikuanjisuan.html': '税款计算',
  'zxkouchu.html': '专项附加扣除',
  'help_center.html': '帮助中心',
  'install_guide.html': '引导安装'
};

function htmlFileFromPagePath(pagePath) {
  var p = String(pagePath || '').trim().toLowerCase();
  if (!p) return '';
  var eventM = p.match(/\/event\/jump\/([a-z0-9_-]+)_html/);
  if (eventM) return eventM[1].replace(/-/g, '_') + '.html';
  var fileM = p.match(/\/([^/?#]+\.html)$/);
  return fileM ? fileM[1] : '';
}

function chineseTitleFromPagePath(pagePath) {
  var p = String(pagePath || '').trim().toLowerCase();
  if (!p) return '—';
  if (p.indexOf('__history_back__') >= 0 || p.indexOf('_history_back__') >= 0) {
    return '返回上一页';
  }
  var file = htmlFileFromPagePath(p);
  var title = file && CERT_PAGE_TITLE_ZH[file] ? CERT_PAGE_TITLE_ZH[file] : '';
  if (!title && file) {
    title = file.replace(/\.html$/, '');
  }
  var tabM = p.match(/tab_([a-z0-9_]+)/);
  if (tabM) {
    var tabMap = {
      employers: '任职信息',
      messages: '消息通知',
      records: '税务记录',
      profile: '个人资料'
    };
    var tabLabel = tabMap[tabM[1]] || tabM[1];
    return (title || '个人中心') + ' - ' + tabLabel;
  }
  if (title) return title;
  if (p.indexOf('/event/') === 0) return '页面内操作';
  return p;
}

function beijingDateKeyFromCreatedAt(createdAt) {
  if (!createdAt) return '';
  var d = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (isNaN(d.getTime())) return '';
  var utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
  return formatDateKey(new Date(utcMs + 8 * 3600000));
}

function formatStaySecondsLabel(sec) {
  var s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 60) return s + ' 秒';
  if (s < 3600) return Math.round(s / 60) + ' 分钟';
  var h = Math.floor(s / 3600);
  var m = Math.round((s % 3600) / 60);
  return h + ' 小时' + (m > 0 ? ' 分' : '');
}

var NO_TAX_BEHAVIOR_MAX_DAILY_SPAN_SEC = 4 * 3600;
var NO_TAX_BEHAVIOR_SINGLE_DAY_SEC = 120;
/** 用户行为页：低于该停留秒数时展示最近上报机型 */
var NO_TAX_BEHAVIOR_SHORT_STAY_SEC = 10 * 60;

function computeBehaviorMetricsFromEvents(events) {
  events = Array.isArray(events) ? events : [];
  if (!events.length) {
    return {
      event_count: 0,
      active_days: 0,
      stay_seconds: 0,
      stay_label: '无记录',
      distinct_page_count: 0,
      first_at: null,
      last_at: null,
      pages: [],
      path_summary: '—'
    };
  }
  var byDay = {};
  var pageMap = {};
  var pathSteps = [];
  events.forEach(function (e) {
    var ts = e.created_at instanceof Date ? e.created_at : new Date(e.created_at);
    if (isNaN(ts.getTime())) return;
    var day = beijingDateKeyFromCreatedAt(ts);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(ts.getTime());
    var pp = String(e.page_path || '');
    var title = chineseTitleFromPagePath(pp);
    if (!pageMap[title]) {
      pageMap[title] = { title: title, page_path: pp, hit_count: 0, last_at: ts.toISOString() };
    }
    pageMap[title].hit_count++;
    if (new Date(pageMap[title].last_at).getTime() < ts.getTime()) {
      pageMap[title].last_at = ts.toISOString();
    }
    pathSteps.push({
      at: ts.toISOString(),
      page_path: pp,
      route_key: e.route_key != null ? String(e.route_key) : '',
      title: title
    });
  });
  var staySeconds = 0;
  Object.keys(byDay).forEach(function (day) {
    var tsList = byDay[day].sort(function (a, b) {
      return a - b;
    });
    if (tsList.length === 1) {
      staySeconds += NO_TAX_BEHAVIOR_SINGLE_DAY_SEC;
    } else {
      var span = (tsList[tsList.length - 1] - tsList[0]) / 1000;
      staySeconds += Math.min(span, NO_TAX_BEHAVIOR_MAX_DAILY_SPAN_SEC);
    }
  });
  var pages = Object.keys(pageMap)
    .map(function (k) {
      return pageMap[k];
    })
    .sort(function (a, b) {
      return b.hit_count - a.hit_count;
    });
  var summaryTitles = [];
  var seen = {};
  pathSteps.forEach(function (step) {
    if (seen[step.title]) return;
    seen[step.title] = true;
    summaryTitles.push(step.title);
  });
  var pathSummary = summaryTitles.length ? summaryTitles.slice(0, 12).join(' → ') : '—';
  if (summaryTitles.length > 12) pathSummary += ' …';
  return {
    event_count: events.length,
    active_days: Object.keys(byDay).length,
    stay_seconds: staySeconds,
    stay_label: formatStaySecondsLabel(staySeconds),
    distinct_page_count: pages.length,
    first_at: pathSteps[0].at,
    last_at: pathSteps[pathSteps.length - 1].at,
    pages: pages,
    path_summary: pathSummary
  };
}

async function loadPageEventsForUsers(conn, usernames, maxPerUser) {
  var out = {};
  if (!usernames.length) return out;
  usernames.forEach(function (u) {
    out[u] = [];
  });
  var limitPer = maxPerUser != null ? Math.max(50, Math.min(800, Number(maxPerUser) || 400)) : 400;
  var ph = usernames.map(function () {
    return '?';
  }).join(',');
  const [rows] = await conn.query(
    `SELECT username, page_path, route_key, created_at
     FROM user_page_events
     WHERE username IN (` +
      ph +
      `)
     ORDER BY username ASC, created_at ASC`,
    usernames
  );
  var counts = {};
  rows.forEach(function (r) {
    var u = String(r.username);
    counts[u] = (counts[u] || 0) + 1;
    if (counts[u] > limitPer) return;
    if (!out[u]) out[u] = [];
    out[u].push({
      page_path: r.page_path != null ? String(r.page_path) : '',
      route_key: r.route_key != null ? String(r.route_key) : '',
      created_at: r.created_at
    });
  });
  return out;
}

/** 批量取各用户最近一次上报/同步的设备信息（用于行为分析页短停留机型展示） */
async function loadLatestDevicesForUsers(conn, usernames) {
  var out = {};
  if (!usernames || !usernames.length) return out;
  var ph = usernames.map(function () {
    return '?';
  }).join(',');
  const [rows] = await conn.query(
    `SELECT username, user_agent_short, device_detail_json FROM (
       SELECT username, user_agent_short, device_detail_json,
              ROW_NUMBER() OVER (PARTITION BY username ORDER BY last_seen DESC) AS rn
       FROM user_devices
       WHERE username IN (` +
      ph +
      `)
     ) t WHERE rn = 1`,
    usernames
  );
  rows.forEach(function (r) {
    var uname = String(r.username);
    var cls = classifyUserDeviceRow(r.user_agent_short, r.device_detail_json);
    var osFamily = DEVICE_STATS_OS_FAMILY_LABEL[cls.os_key] || cls.os_key || '';
    var osDisplay = osFamily;
    if (cls.os_version) {
      osDisplay = (osFamily + ' ' + cls.os_version).trim();
    }
    out[uname] = {
      model_label: cls.model_label,
      os_display: osDisplay
    };
  });
  return out;
}

function noTaxUserWhereSql(req) {
  var where = ["NOT EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = users.username AND tr.deleted_at IS NULL)"];
  var params = [];
  appendAdminUserScope(where, params, req.admin, 'users.username');
  return { sql: where.length ? ' WHERE ' + where.join(' AND ') : '', params: params };
}

async function handleAdminUserDataNoTaxBehavior(req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 20;
    if (page < 1) page = 1;
    if (limit < 1) limit = 20;
    if (limit > 50) limit = 50;
    var offset = (page - 1) * limit;
    var scope = noTaxUserWhereSql(req);

    const conn = await pool.getConnection();
    try {
      const [[countRow]] = await conn.execute('SELECT COUNT(*) AS c FROM users' + scope.sql, scope.params);
      var total = Number(countRow.c) || 0;

      const [userRows] = await conn.query(
        'SELECT username, real_name, created_at, register_source_channel, activation_source_channel FROM users' +
          scope.sql +
          ' ORDER BY id DESC LIMIT ? OFFSET ?',
        scope.params.concat([limit, offset])
      );
      var names = userRows.map(function (r) {
        return String(r.username);
      });
      var eventMap = await loadPageEventsForUsers(conn, names, 400);
      var deviceMap = await loadLatestDevicesForUsers(conn, names);

      var cohortPageHits = {};
      var activeCount = 0;
      var totalStay = 0;
      var items = userRows.map(function (r) {
        var uname = String(r.username);
        var metrics = computeBehaviorMetricsFromEvents(eventMap[uname] || []);
        if (metrics.event_count > 0) {
          activeCount++;
          totalStay += metrics.stay_seconds;
        }
        (metrics.pages || []).forEach(function (p) {
          var t = p.title || '—';
          if (!cohortPageHits[t]) cohortPageHits[t] = 0;
          cohortPageHits[t] += p.hit_count;
        });
        var shortStay = metrics.stay_seconds < NO_TAX_BEHAVIOR_SHORT_STAY_SEC;
        var dev = deviceMap[uname];
        return {
          username: uname,
          real_name: r.real_name != null ? String(r.real_name) : '',
          register_source_channel_label: registerSourceChannelLabel(r.register_source_channel),
          channel_analysis_label: userChannelAnalysisLabel(
            r.register_source_channel,
            r.activation_source_channel
          ),
          created_at: r.created_at ? r.created_at.toISOString() : '',
          event_count: metrics.event_count,
          active_days: metrics.active_days,
          stay_seconds: metrics.stay_seconds,
          stay_label: metrics.stay_label,
          device_model_label: shortStay && dev ? dev.model_label : '',
          device_os_label: shortStay && dev ? dev.os_display : '',
          distinct_page_count: metrics.distinct_page_count,
          first_at: metrics.first_at,
          last_at: metrics.last_at,
          pages: metrics.pages,
          path_summary: metrics.path_summary
        };
      });

      var topPages = Object.keys(cohortPageHits)
        .map(function (title) {
          return { title: title, hit_count: cohortPageHits[title] };
        })
        .sort(function (a, b) {
          return b.hit_count - a.hit_count;
        })
        .slice(0, 15);

      const [allNoTaxCount] = await conn.execute(
        `SELECT COUNT(*) AS total_users,
                SUM(CASE WHEN EXISTS (SELECT 1 FROM user_page_events upe WHERE upe.username = users.username) THEN 1 ELSE 0 END) AS with_activity
         FROM users` + scope.sql,
        scope.params
      );
      var summaryRow = allNoTaxCount[0] || {};
      var totalNoTax = Number(summaryRow.total_users) || 0;
      var withActivityAll = Number(summaryRow.with_activity) || 0;

      return res.json({
        code: 200,
        data: {
          summary: {
            total_no_tax_users: totalNoTax,
            with_page_activity: withActivityAll,
            without_page_activity: Math.max(0, totalNoTax - withActivityAll),
            avg_stay_seconds:
              activeCount > 0 ? Math.round(totalStay / activeCount) : 0,
            avg_stay_label:
              activeCount > 0 ? formatStaySecondsLabel(Math.round(totalStay / activeCount)) : '—'
          },
          top_pages: topPages,
          items: items,
          total: total,
          page: page,
          limit: limit
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminUserDataNoTaxBehaviorPath(req, res) {
  var username = req.query.username != null ? String(req.query.username).trim() : '';
  if (!username) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      var allowed = await adminCanAccessTargetUser(conn, req.admin, username);
      if (!allowed) {
        return res.status(403).json({ code: 403, msg: '无权限查看该用户' });
      }
      const [taxCnt] = await conn.execute(
        'SELECT COUNT(*) AS c FROM tax_records WHERE user_id = ? AND ' + TAX_RECORD_NOT_DELETED_SQL,
        [username]
      );
      if (Number(taxCnt[0].c) > 0) {
        return res.status(400).json({ code: 400, msg: '该用户已有个税记录，请使用档案详情' });
      }
      const [rows] = await conn.execute(
        `SELECT page_path, route_key, created_at
         FROM user_page_events
         WHERE username = ?
         ORDER BY created_at ASC
         LIMIT 800`,
        [username]
      );
      var events = rows.map(function (r) {
        return {
          page_path: r.page_path != null ? String(r.page_path) : '',
          route_key: r.route_key != null ? String(r.route_key) : '',
          created_at: r.created_at
        };
      });
      var metrics = computeBehaviorMetricsFromEvents(events);
      var timeline = events.map(function (e, idx) {
        var ts = e.created_at instanceof Date ? e.created_at : new Date(e.created_at);
        return {
          step: idx + 1,
          at: isNaN(ts.getTime()) ? '' : ts.toISOString(),
          page_path: e.page_path,
          route_key: e.route_key,
          title: chineseTitleFromPagePath(e.page_path)
        };
      });
      return res.json({
        code: 200,
        data: {
          username: username,
          metrics: metrics,
          timeline: timeline
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

function appendActivatedUserScope(whereClauses, params, admin, userCol) {
  userCol = userCol || 'u.username';
  var userAlias = userCol.indexOf('.') >= 0 ? userCol.split('.')[0] : 'u';
  whereClauses.push(userAlias + '.account_active = 1');
  whereClauses.push(userAlias + '.list_hidden_at IS NULL');
  whereClauses.push(userAlias + '.activation_refunded_at IS NULL');
  appendAdminUserScope(whereClauses, params, admin, userCol);
}

function activatedUserScopeSql(req, userCol) {
  var where = [];
  var params = [];
  appendActivatedUserScope(where, params, req.admin, userCol || 'u.username');
  return { sql: where.length ? ' WHERE ' + where.join(' AND ') : '', params: params, where: where };
}

async function loadActivatedUserActivityMap(conn, usernames, activityDays) {
  var map = {};
  if (!usernames || !usernames.length) return map;
  usernames.forEach(function (u) {
    map[u] = { active_days: 0, last_active: '', event_count: 0 };
  });
  var span = Math.max(0, (Number(activityDays) || 30) - 1);
  var ph = usernames.map(function () {
    return '?';
  }).join(',');
  const [dauRows] = await conn.query(
    `SELECT username, COUNT(DISTINCT activity_date) AS active_days, MAX(activity_date) AS last_active
     FROM user_daily_activity
     WHERE username IN (` +
      ph +
      `)
       AND activity_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY username`,
    usernames.concat([span])
  );
  dauRows.forEach(function (r) {
    var u = String(r.username || '');
    if (!map[u]) return;
    map[u].active_days = Number(r.active_days) || 0;
    if (r.last_active instanceof Date) {
      map[u].last_active = r.last_active.toISOString().slice(0, 10);
    } else if (r.last_active) {
      map[u].last_active = String(r.last_active).slice(0, 10);
    }
  });
  const [evtRows] = await conn.query(
    `SELECT username, COUNT(*) AS cnt
     FROM user_page_events
     WHERE username IN (` +
      ph +
      `)
       AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY username`,
    usernames.concat([span])
  );
  evtRows.forEach(function (r) {
    var u = String(r.username || '');
    if (!map[u]) return;
    map[u].event_count = Number(r.cnt) || 0;
  });
  return map;
}

async function handleAdminActivatedUserAnalysisOverview(req, res) {
  try {
    var days = clampAnalyticsDays(req.query.days, 14, 90);
    var activityDays = clampAnalyticsDays(req.query.activity_days, 30, 90);
    var span = Math.max(0, days - 1);
    var actSpan = Math.max(0, activityDays - 1);
    const conn = await pool.getConnection();
    try {
      var scope = activatedUserScopeSql(req, 'u');
      var scopeJoin = scope.sql ? scope.sql.replace(/^ WHERE /, ' AND ') : '';

      const [[countRow]] = await conn.query('SELECT COUNT(*) AS c FROM users u' + scope.sql, scope.params);
      var totalActivated = Number(countRow.c) || 0;

      const [taxStatRows] = await conn.query(
        `SELECT COUNT(DISTINCT tr.user_id) AS with_tax, COUNT(*) AS total_records
         FROM tax_records tr
         INNER JOIN users u ON u.username = tr.user_id` +
          scopeJoin +
          ' AND ' +
          TAX_RECORD_NOT_DELETED_SQL,
        scope.params
      );
      var withTax = Number((taxStatRows[0] || {}).with_tax) || 0;
      var totalTaxRecords = Number((taxStatRows[0] || {}).total_records) || 0;

      const [allScoped] = await conn.query(
        'SELECT u.username FROM users u' + scope.sql + ' ORDER BY u.id DESC LIMIT 5000',
        scope.params
      );
      var scopedNames = allScoped.map(function (r) {
        return String(r.username);
      });
      var avgMaps = await buildUserTaxAvgSalaryMap(conn, scopedNames);
      var salaryBuckets = [
        { label: '未填写', min: null, max: null, count: 0 },
        { label: '5000以下', min: 0, max: 5000, count: 0 },
        { label: '5000–1万', min: 5000, max: 10000, count: 0 },
        { label: '1万–2万', min: 10000, max: 20000, count: 0 },
        { label: '2万以上', min: 20000, max: null, count: 0 }
      ];
      var taxRecordBuckets = [
        { label: '未填写', min: 0, max: 0, count: 0 },
        { label: '1–6条', min: 1, max: 6, count: 0 },
        { label: '7–12条', min: 7, max: 12, count: 0 },
        { label: '13条以上', min: 13, max: null, count: 0 }
      ];
      var withSalary = 0;
      var salaryValues = [];
      scopedNames.forEach(function (uname) {
        var sal = avgMaps[uname];
        var v = sal && sal.avg_salary_6m != null ? Number(sal.avg_salary_6m) : null;
        if (v == null || !isFinite(v)) {
          salaryBuckets[0].count++;
        } else {
          withSalary++;
          salaryValues.push(v);
          if (v < 5000) salaryBuckets[1].count++;
          else if (v < 10000) salaryBuckets[2].count++;
          else if (v < 20000) salaryBuckets[3].count++;
          else salaryBuckets[4].count++;
        }
      });
      var salaryAvg = null;
      var salaryMedian = null;
      if (salaryValues.length) {
        var salarySum = 0;
        for (var si = 0; si < salaryValues.length; si++) {
          salarySum += salaryValues[si];
        }
        salaryAvg = Math.round((salarySum / salaryValues.length) * 100) / 100;
        salaryMedian = medianOfNumbers(salaryValues);
      }

      if (scopedNames.length) {
        var ph = scopedNames.map(function () {
          return '?';
        }).join(',');
        const [taxCntRows] = await conn.query(
          `SELECT user_id, COUNT(*) AS cnt FROM tax_records
           WHERE user_id IN (` +
            ph +
            `) AND ` +
            TAX_RECORD_NOT_DELETED_SQL +
            ' GROUP BY user_id',
          scopedNames
        );
        var taxCntMap = {};
        taxCntRows.forEach(function (r) {
          taxCntMap[String(r.user_id)] = Number(r.cnt) || 0;
        });
        scopedNames.forEach(function (uname) {
          var cnt = taxCntMap[uname] || 0;
          if (cnt <= 0) taxRecordBuckets[0].count++;
          else if (cnt <= 6) taxRecordBuckets[1].count++;
          else if (cnt <= 12) taxRecordBuckets[2].count++;
          else taxRecordBuckets[3].count++;
        });
      } else {
        taxRecordBuckets[0].count = totalActivated;
      }

      const [dauSeries] = await conn.query(
        `SELECT uda.activity_date AS d, COUNT(DISTINCT uda.username) AS cnt
         FROM user_daily_activity uda
         INNER JOIN users u ON u.username = uda.username` +
          scopeJoin +
          `
         WHERE uda.activity_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY uda.activity_date
         ORDER BY uda.activity_date ASC`,
        scope.params.concat([span])
      );

      var todayKey = chinaDateKeyNow();
      const [[todayDauRow]] = await conn.query(
        `SELECT COUNT(DISTINCT uda.username) AS c
         FROM user_daily_activity uda
         INNER JOIN users u ON u.username = uda.username` +
          scopeJoin +
          ' AND uda.activity_date = ?',
        scope.params.concat([todayKey])
      );
      var todayDau = Number((todayDauRow || {}).c) || 0;

      var activityFreq = { none: 0, low: 0, medium: 0, high: 0 };
      if (scopedNames.length) {
        var actMap = await loadActivatedUserActivityMap(conn, scopedNames, activityDays);
        scopedNames.forEach(function (uname) {
          var ad = (actMap[uname] && actMap[uname].active_days) || 0;
          if (ad <= 0) activityFreq.none++;
          else if (ad === 1) activityFreq.low++;
          else if (ad <= 4) activityFreq.medium++;
          else activityFreq.high++;
        });
      }

      const [topPages] = await conn.query(
        `SELECT e.page_path, COUNT(*) AS hit_count
         FROM user_page_events e
         INNER JOIN users u ON u.username = e.username` +
          scopeJoin +
          `
         WHERE e.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY e.page_path
         ORDER BY hit_count DESC
         LIMIT 12`,
        scope.params.concat([actSpan])
      );

      return res.json({
        code: 200,
        data: {
          days: days,
          activity_days: activityDays,
          total_activated: totalActivated,
          with_tax_records: withTax,
          without_tax_records: Math.max(0, totalActivated - withTax),
          with_salary_filled: withSalary,
          salary_avg_6m: salaryAvg,
          salary_median_6m: salaryMedian,
          salary_avg_6m_label: salaryAvg != null ? formatAvgSalary6mLabel(salaryAvg, 0) : '—',
          salary_median_6m_label: salaryMedian != null ? formatAvgSalary6mLabel(salaryMedian, 0) : '—',
          total_tax_records: totalTaxRecords,
          dau_today: todayDau,
          salary_buckets: salaryBuckets,
          tax_record_buckets: taxRecordBuckets,
          activity_frequency: activityFreq,
          dau_series: dauSeries.map(function (r) {
            return {
              date: r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10),
              active_users: Number(r.cnt) || 0
            };
          }),
          top_pages: topPages.map(function (r) {
            return {
              title: chineseTitleFromPagePath(String(r.page_path || '')),
              page_path: String(r.page_path || ''),
              hit_count: Number(r.hit_count) || 0
            };
          })
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminActivatedUserAnalysisUsers(req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 20;
    if (page < 1) page = 1;
    if (limit < 1) limit = 20;
    if (limit > 50) limit = 50;
    var activityDays = clampAnalyticsDays(req.query.activity_days, 30, 90);

    var qUsername = req.query.username != null ? String(req.query.username).trim() : '';
    var qTax = req.query.tax_status != null ? String(req.query.tax_status).trim() : '';
    var qActivity = req.query.activity != null ? String(req.query.activity).trim() : '';
    var qSalaryMin = parseSalaryRangeFilterParam(req.query.salary_min);
    var qSalaryMax = parseSalaryRangeFilterParam(req.query.salary_max);
    var hasSalaryFilter = qSalaryMin != null || qSalaryMax != null;
    if (qSalaryMin != null && qSalaryMax != null && qSalaryMin > qSalaryMax) {
      return res.status(400).json({ code: 400, msg: '工资收入下限不能大于上限' });
    }

    var where = [];
    var params = [];
    appendActivatedUserScope(where, params, req.admin, 'users.username');
    if (qUsername) {
      where.push('users.username LIKE ?');
      params.push('%' + qUsername + '%');
    }
    if (qTax === 'with_tax') {
      where.push(
        'EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = users.username AND ' + TAX_RECORD_NOT_DELETED_SQL + ')'
      );
    } else if (qTax === 'without_tax') {
      where.push(
        'NOT EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = users.username AND ' + TAX_RECORD_NOT_DELETED_SQL + ')'
      );
    }
    var scopeSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
    var actSpan = Math.max(0, activityDays - 1);

    const conn = await pool.getConnection();
    try {
      var rows = [];
      var total = 0;

      if (hasSalaryFilter || qActivity === 'active_7d' || qActivity === 'inactive_7d') {
        const [allRows] = await conn.query(
          'SELECT username, real_name, created_at, activation_source_channel, register_source_channel FROM users' +
            scopeSql +
            ' ORDER BY id DESC',
          params
        );
        var allNames = allRows.map(function (r) {
          return String(r.username);
        });
        var avgMaps = await buildUserTaxAvgSalaryMap(conn, allNames);
        var actMap = await loadActivatedUserActivityMap(conn, allNames, activityDays);
        var filtered = [];
        allRows.forEach(function (r) {
          var uname = String(r.username);
          var sal = avgMaps[uname] || { avg_salary_6m: null, avg_salary_6m_label: '未填写', salary_month_count: 0 };
          var v = sal.avg_salary_6m != null ? Number(sal.avg_salary_6m) : null;
          if (hasSalaryFilter) {
            if (v == null || !isFinite(v)) {
              if (qSalaryMin != null || qSalaryMax != null) return;
            } else {
              if (qSalaryMin != null && v < qSalaryMin) return;
              if (qSalaryMax != null && v > qSalaryMax) return;
            }
          }
          var ad = (actMap[uname] && actMap[uname].active_days) || 0;
          if (qActivity === 'active_7d' && ad < 1) return;
          if (qActivity === 'inactive_7d' && ad > 0) return;
          filtered.push({ row: r, sal: sal, act: actMap[uname] || { active_days: 0, last_active: '', event_count: 0 } });
        });
        total = filtered.length;
        var offset = (page - 1) * limit;
        var pageSlice = filtered.slice(offset, offset + limit);
        rows = pageSlice.map(function (item) {
          return Object.assign({}, item.row, { _sal: item.sal, _act: item.act });
        });
      } else {
        const [[countRow]] = await conn.execute('SELECT COUNT(*) AS c FROM users' + scopeSql, params);
        total = Number(countRow.c) || 0;
        var offset2 = (page - 1) * limit;
        const [userRows] = await conn.query(
          'SELECT username, real_name, created_at, activation_source_channel, register_source_channel FROM users' +
            scopeSql +
            ' ORDER BY id DESC LIMIT ? OFFSET ?',
          params.concat([limit, offset2])
        );
        rows = userRows;
      }

      var pageNames = rows.map(function (r) {
        return String(r.username);
      });
      var batchMaps = await buildUserDataBatchMaps(conn, pageNames);
      var avgMapsPage =
        rows[0] && rows[0]._sal != null
          ? null
          : await buildUserTaxAvgSalaryMap(conn, pageNames);
      var actMapPage =
        rows[0] && rows[0]._act != null
          ? null
          : await loadActivatedUserActivityMap(conn, pageNames, activityDays);
      var eventMap = await loadPageEventsForUsers(conn, pageNames, 400);

      var items = rows.map(function (r) {
        var uname = String(r.username);
        var bd = batchMaps[uname] || {};
        var sal =
          r._sal ||
          (avgMapsPage && avgMapsPage[uname]) || {
            avg_salary_6m: null,
            avg_salary_6m_label: '未填写',
            salary_month_count: 0
          };
        var act = r._act || (actMapPage && actMapPage[uname]) || { active_days: 0, last_active: '', event_count: 0 };
        var metrics = computeBehaviorMetricsFromEvents(eventMap[uname] || []);
        var freqPerDay =
          act.active_days > 0 ? Math.round((act.event_count / act.active_days) * 10) / 10 : 0;
        return {
          username: uname,
          real_name: r.real_name != null ? String(r.real_name) : '',
          created_at: r.created_at ? r.created_at.toISOString() : '',
          channel_analysis_label: userChannelAnalysisLabel(
            r.register_source_channel,
            r.activation_source_channel
          ),
          avg_salary_6m: sal.avg_salary_6m,
          avg_salary_6m_label: sal.avg_salary_6m_label || '未填写',
          salary_month_count: sal.salary_month_count || 0,
          tax_record_count: bd.tax_record_count || 0,
          has_tax_records: (bd.tax_record_count || 0) > 0,
          active_days: act.active_days,
          event_count: act.event_count,
          events_per_active_day: freqPerDay,
          stay_label: metrics.stay_label,
          distinct_page_count: metrics.distinct_page_count,
          last_active: act.last_active || (metrics.last_at ? String(metrics.last_at).slice(0, 10) : ''),
          path_summary: metrics.path_summary
        };
      });

      return res.json({
        code: 200,
        data: {
          items: items,
          total: total,
          page: page,
          limit: limit,
          activity_days: activityDays
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminActivatedUserAnalysisBehaviorPath(req, res) {
  var username = req.query.username != null ? String(req.query.username).trim() : '';
  if (!username) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      var allowed = await adminCanAccessTargetUser(conn, req.admin, username);
      if (!allowed) {
        return res.status(403).json({ code: 403, msg: '无权限查看该用户' });
      }
      const [userRows] = await conn.execute(
        'SELECT username, account_active FROM users WHERE username = ? AND list_hidden_at IS NULL LIMIT 1',
        [username]
      );
      if (!userRows.length) {
        return res.status(404).json({ code: 404, msg: '用户不存在' });
      }
      if (!(userRows[0].account_active === 1 || userRows[0].account_active === true)) {
        return res.status(400).json({ code: 400, msg: '该用户未激活' });
      }
      const [rows] = await conn.execute(
        `SELECT page_path, route_key, created_at
         FROM user_page_events
         WHERE username = ?
         ORDER BY created_at ASC
         LIMIT 800`,
        [username]
      );
      var events = rows.map(function (r) {
        return {
          page_path: r.page_path != null ? String(r.page_path) : '',
          route_key: r.route_key != null ? String(r.route_key) : '',
          created_at: r.created_at
        };
      });
      var metrics = computeBehaviorMetricsFromEvents(events);
      var timeline = events.map(function (e, idx) {
        var ts = e.created_at instanceof Date ? e.created_at : new Date(e.created_at);
        return {
          step: idx + 1,
          at: isNaN(ts.getTime()) ? '' : ts.toISOString(),
          page_path: e.page_path,
          route_key: e.route_key,
          title: chineseTitleFromPagePath(e.page_path)
        };
      });
      return res.json({
        code: 200,
        data: {
          username: username,
          metrics: metrics,
          timeline: timeline
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 批量清理刷号机器人账号（默认：2026-05-22 00:00–01:00 北京、8位随机名、未激活） */
async function handleAdminPurgeBotUsers(req, res) {
  var body = req.body || {};
  var dryRun = body.dry_run === true || body.dry_run === 1 || body.dry_run === '1';
  var mode = body.mode === 'ban' ? 'ban' : 'delete';
  const conn = await pool.getConnection();
  try {
    var preview = await registerGuard.countBotPurgeCandidates(conn, body);
    if (dryRun) {
      conn.release();
      return res.json({
        code: 200,
        data: {
          dry_run: true,
          matched: preview.count,
          mode: mode,
          window: preview.window
        }
      });
    }
    if (!preview.count) {
      conn.release();
      return res.json({ code: 200, data: { matched: 0, deleted: 0, banned: 0, mode: mode } });
    }
    await conn.beginTransaction();
    var result = await registerGuard.purgeBotUsersBatch(conn, body, {
      dry_run: false,
      mode: mode,
      batch_size: body.batch_size
    });
    await conn.commit();
    conn.release();
    return res.json({ code: 200, data: result });
  } catch (e) {
    try {
      await conn.rollback();
    } catch (rbErr) {
      console.error(rbErr);
    }
    conn.release();
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 激活退款：封禁、软删除，并从用户数据与激活统计中排除 */
async function handleAdminUserRefund(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  if (!target) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  if (target.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    return res.status(400).json({ code: 400, msg: '不能操作保留账号名' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [urows] = await conn.execute(
      'SELECT id, account_active, activation_refunded_at FROM users WHERE username = ? FOR UPDATE',
      [target]
    );
    if (urows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }
    if (urows[0].activation_refunded_at) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ code: 400, msg: '该账号已退款' });
    }
    if (!(urows[0].account_active === 1 || urows[0].account_active === true)) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ code: 400, msg: '仅已激活账号可退款' });
    }
    var allowed = await adminCanAccessTargetUser(conn, req.admin, target);
    if (!allowed) {
      await conn.rollback();
      conn.release();
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    var adminName = req.admin && req.admin.username ? String(req.admin.username) : '';
    await conn.execute(
      `UPDATE users SET banned = 1, session_rev = session_rev + 1, account_active = 0,
              list_hidden_at = NOW(3), list_hidden_by = ?,
              activation_refunded_at = NOW(3), activation_refunded_by = ?
       WHERE username = ?`,
      [adminName, adminName, target]
    );
    await conn.commit();
    conn.release();
    return res.json({
      code: 200,
      data: {
        username: target,
        banned: true,
        hidden: true,
        refunded: true,
        activation_excluded_from_stats: true
      }
    });
  } catch (e) {
    try {
      await conn.rollback();
    } catch (e2) {}
    try {
      conn.release();
    } catch (e3) {}
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 从注册用户列表软删除（保留数据库数据，可在「已删除账号」恢复） */
async function handleAdminDeleteUser(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  if (!target) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  if (target.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    return res.status(400).json({ code: 400, msg: '不能删除保留账号名' });
  }
  const conn = await pool.getConnection();
  try {
    const [urows] = await conn.execute(
      'SELECT id, list_hidden_at FROM users WHERE username = ?',
      [target]
    );
    if (urows.length === 0) {
      conn.release();
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }
    if (urows[0].list_hidden_at) {
      conn.release();
      return res.status(400).json({ code: 400, msg: '该账号已在已删除列表中' });
    }
    var allowed = await adminCanAccessTargetUser(conn, req.admin, target);
    if (!allowed) {
      conn.release();
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    var hiddenBy = req.admin && req.admin.username ? String(req.admin.username) : '';
    await conn.execute(
      'UPDATE users SET list_hidden_at = NOW(3), list_hidden_by = ? WHERE username = ?',
      [hiddenBy, target]
    );
    conn.release();
    return res.json({
      code: 200,
      data: { username: target, hidden: true, soft_delete: true }
    });
  } catch (e) {
    try {
      conn.release();
    } catch (e2) {}
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminDeletedUsers(req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 10;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    if (limit > 100) limit = 100;
    var offset = (page - 1) * limit;

    var qUsername = String(req.query.username || '').trim();
    var qRealName = String(req.query.real_name || '').trim();
    var qExact = req.query.exact === '1' || req.query.exact === 'true';

    var whereClauses = ['users.list_hidden_at IS NOT NULL'];
    var params = [];

    if (qUsername) {
      if (qExact) {
        whereClauses.push('users.username = ?');
        params.push(qUsername);
      } else {
        whereClauses.push('users.username LIKE ?');
        params.push('%' + qUsername + '%');
      }
    }
    if (qRealName) {
      if (qExact) {
        whereClauses.push('users.real_name = ?');
        params.push(qRealName);
      } else {
        whereClauses.push('users.real_name LIKE ?');
        params.push('%' + qRealName + '%');
      }
    }
    if (!req.admin || !req.admin.is_super) {
      whereClauses.push(
        'EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = users.username AND ac.owner_admin_username = ?)'
      );
      params.push(req.admin.username);
    }

    var whereSql = ' WHERE ' + whereClauses.join(' AND ');
    const conn = await pool.getConnection();
    const [totalRows] = await conn.execute('SELECT COUNT(*) as count FROM users' + whereSql, params);
    var total = totalRows[0].count;
    const [rows] = await conn.query(
      `SELECT id, username, real_name, account_active, banned, created_at, list_hidden_at, list_hidden_by,
              register_source_channel, activation_source_channel, activation_refunded_at, activation_refunded_by
       FROM users ${whereSql}
       ORDER BY list_hidden_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    conn.release();

    var out = (rows || []).map(function (r) {
      return {
        id: r.id,
        username: r.username,
        real_name: r.real_name,
        account_active: r.account_active === 1 || r.account_active === true,
        banned: r.banned === 1 || r.banned === true,
        created_at: r.created_at ? r.created_at.toISOString() : '',
        list_hidden_at: r.list_hidden_at ? r.list_hidden_at.toISOString() : '',
        list_hidden_by:
          r.list_hidden_by != null && String(r.list_hidden_by).trim() !== ''
            ? String(r.list_hidden_by).trim()
            : '',
        activation_refunded_at: r.activation_refunded_at ? r.activation_refunded_at.toISOString() : '',
        activation_refunded_by:
          r.activation_refunded_by != null && String(r.activation_refunded_by).trim() !== ''
            ? String(r.activation_refunded_by).trim()
            : '',
        channel_analysis_label: userChannelAnalysisLabel(
          r.register_source_channel,
          r.activation_source_channel
        )
      };
    });

    return res.json({
      code: 200,
      data: { users: out, total: total, page: page, limit: limit }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminUserRestore(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  if (!target) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  const conn = await pool.getConnection();
  try {
    const [urows] = await conn.execute(
      'SELECT id, list_hidden_at, activation_refunded_at FROM users WHERE username = ?',
      [target]
    );
    if (urows.length === 0) {
      conn.release();
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }
    if (!urows[0].list_hidden_at) {
      conn.release();
      return res.status(400).json({ code: 400, msg: '该账号不在已删除列表中' });
    }
    var allowed = await adminCanAccessTargetUser(conn, req.admin, target);
    if (!allowed) {
      conn.release();
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    var wasRefunded = !!urows[0].activation_refunded_at;
    if (wasRefunded) {
      await conn.execute(
        `UPDATE users SET list_hidden_at = NULL, list_hidden_by = NULL,
                activation_refunded_at = NULL, activation_refunded_by = NULL,
                banned = 0, account_active = 1
         WHERE username = ?`,
        [target]
      );
    } else {
      await conn.execute(
        'UPDATE users SET list_hidden_at = NULL, list_hidden_by = NULL WHERE username = ?',
        [target]
      );
    }
    conn.release();
    return res.json({
      code: 200,
      data: { username: target, restored: true, was_refunded: wasRefunded }
    });
  } catch (e) {
    try {
      conn.release();
    } catch (e2) {}
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

function clampAnalyticsDays(raw, def, max) {
  var n = parseInt(raw, 10);
  if (isNaN(n) || n < 1) {
    n = def;
  }
  if (n > max) {
    n = max;
  }
  return n;
}

/** 管理端设备分布：解析上报 JSON 与 UA */
function parseDeviceDetailJsonForStats(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  var s = raw.trim();
  if (!s) {
    return null;
  }
  try {
    var o = JSON.parse(s);
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      return o;
    }
  } catch (e1) {
    return null;
  }
  return null;
}

function slugDeviceStatsKey(s) {
  var t = String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 80);
  return t || 'unknown';
}

function normalizeUnderscoreVersion(s) {
  var t = String(s || '')
    .trim()
    .replace(/_/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return t;
}

function osVersionFromClientDetail(osKey, detail) {
  if (!detail || detail.os_version == null || detail.os_version === '') {
    return '';
  }
  var v = String(detail.os_version)
    .trim()
    .replace(/[\x00-\x1f]/g, '');
  if (!v) {
    return '';
  }
  if (osKey === 'ios') {
    v = v.replace(/^i(?:OS|os)\s*/i, '').trim();
  } else if (osKey === 'android') {
    v = v.replace(/^android\s*/i, '').trim();
  }
  return v.substring(0, 48);
}

function extractIosVersionFromUa(ua) {
  var m = ua.match(/(?:CPU )?(?:iPhone |iPad |iPod )?OS\s+([\d_]+)/i);
  if (m) {
    return normalizeUnderscoreVersion(m[1]);
  }
  m = ua.match(/\bOS\s+([\d_]+)\s+like\s+Mac\s+OS\s+X/i);
  if (m) {
    return normalizeUnderscoreVersion(m[1]);
  }
  return '';
}

function extractAndroidVersionFromUa(ua) {
  var m = ua.match(/Android\s+([\d.]+)/i);
  return m ? String(m[1]).trim() : '';
}

function extractWindowsNtFromUa(ua) {
  var m = ua.match(/Windows NT\s+([\d.]+)/i);
  return m ? String(m[1]).trim() : '';
}

function extractMacOsVersionFromUa(ua) {
  var m = ua.match(/Mac\s+OS\s+X\s+([\d_]+)/i);
  if (m) {
    return normalizeUnderscoreVersion(m[1]);
  }
  return '';
}

function extractChromeOsVersionFromUa(ua) {
  var m = ua.match(/CrOS\s+[^\s]+\s+([\d.]+)/i);
  return m ? String(m[1]).trim() : '';
}

/** 展示用的版本号片段（不含「iOS/Android」前缀）；优先 X-Client-Device 的 os_version，其次 UA。 */
function resolveOsVersionString(osKey, ua, detail) {
  var fromClient = osVersionFromClientDetail(osKey, detail);
  if (fromClient) {
    return fromClient;
  }
  ua = String(ua || '');
  if (osKey === 'ios') {
    return extractIosVersionFromUa(ua);
  }
  if (osKey === 'android') {
    return extractAndroidVersionFromUa(ua);
  }
  if (osKey === 'windows') {
    return extractWindowsNtFromUa(ua);
  }
  if (osKey === 'macos') {
    return extractMacOsVersionFromUa(ua);
  }
  if (osKey === 'chromeos') {
    return extractChromeOsVersionFromUa(ua);
  }
  return '';
}

/**
 * 返回用于聚合的 os_key（ios/android/windows/macos/linux/chromeos/other）与机型展示名。
 * 优先依据 UA；上报 JSON 中的 platform/model 做补充。
 */
function classifyUserDeviceRow(userAgentShort, deviceDetailJson) {
  var detail = parseDeviceDetailJsonForStats(deviceDetailJson);
  var ua = '';
  if (detail && detail.user_agent) {
    ua = String(detail.user_agent);
  }
  if (!ua && userAgentShort) {
    ua = String(userAgentShort);
  }
  var platform = detail && detail.platform ? String(detail.platform).trim() : '';
  var model = detail && detail.model ? String(detail.model).trim() : '';
  var brand = detail && detail.brand ? String(detail.brand).trim() : '';

  var osKey = 'other';

  if (/iPhone|CPU iPhone OS|iPod/i.test(ua)) {
    osKey = 'ios';
  } else if (/iPad/i.test(ua) || /^iPad$/i.test(platform)) {
    osKey = 'ios';
  } else if (/Android/i.test(ua)) {
    osKey = 'android';
  } else if (/Windows NT|Win64|WOW64/i.test(ua) || /^Win/i.test(platform)) {
    osKey = 'windows';
  } else if (/Mac OS X|Macintosh/i.test(ua) || platform === 'MacIntel') {
    if (!/iPhone|iPad|iPod/i.test(ua)) {
      osKey = 'macos';
    }
  }

  if (osKey === 'other') {
    if (/CrOS/i.test(ua)) {
      osKey = 'chromeos';
    } else if (/Linux/i.test(ua) && !/Android/i.test(ua)) {
      osKey = 'linux';
    } else if (platform === 'Win32') {
      osKey = 'windows';
    } else if (/iPhone|iPad|iPod/i.test(platform)) {
      osKey = 'ios';
    }
  }

  var modelLabel = '';
  if (model) {
    modelLabel = brand ? (brand + ' ' + model).trim() : model;
  } else if (/iPhone/i.test(ua) || /^iPhone$/i.test(platform)) {
    modelLabel = 'iPhone';
  } else if (/iPad/i.test(ua) || /^iPad$/i.test(platform)) {
    modelLabel = 'iPad';
  } else if (/Android/i.test(ua)) {
    var dm = ua.match(/Android\s+[\d._]+;\s*([^)]+)/i);
    if (dm) {
      modelLabel = dm[1].trim().replace(/\s+Build\/.*$/i, '').trim();
    }
  }
  if (!modelLabel) {
    if (osKey === 'windows') {
      modelLabel = 'Windows PC';
    } else if (osKey === 'macos') {
      modelLabel = 'Mac';
    } else if (osKey === 'linux') {
      modelLabel = 'Linux PC';
    } else if (osKey === 'chromeos') {
      modelLabel = 'Chromebook';
    } else if (platform) {
      modelLabel = platform;
    } else {
      modelLabel = '未知机型';
    }
  }

  var osVersion = resolveOsVersionString(osKey, ua, detail);

  return {
    os_key: osKey,
    os_version: osVersion,
    model_key: slugDeviceStatsKey(modelLabel),
    model_label: modelLabel
  };
}

var DEVICE_STATS_OS_FAMILY_LABEL = {
  ios: 'iOS',
  android: 'Android',
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  chromeos: 'Chrome OS',
  other: '其他'
};

var DEVICE_STATS_OS_ICON_KEY = {
  ios: 'ios',
  android: 'android',
  windows: 'windows',
  macos: 'macos',
  linux: 'linux',
  chromeos: 'chromeos',
  other: 'other'
};

var DEVICE_STATS_MODEL_ICON_LABEL = {
  iphone: 'iPhone',
  ipad: 'iPad',
  android_phone: 'Android 手机',
  xiaomi: '小米 / Redmi',
  huawei: '华为 / 鸿蒙',
  honor: '荣耀',
  oppo: 'OPPO / 一加',
  vivo: 'vivo',
  samsung: '三星',
  google: 'Google / Nexus',
  windows_pc: 'Windows 电脑',
  mac: 'Mac',
  linux_pc: 'Linux 电脑',
  chromebook: 'Chromebook',
  ios: 'iOS 设备',
  android: 'Android',
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  chromeos: 'Chrome OS',
  other: '其他'
};

/** 机型图标：结合展示名、UA、上报 JSON 做规则匹配 */
function resolveModelIconKey(osKey, modelLabel, ua, detail) {
  var label = String(modelLabel || '').trim();
  var u = String(ua || '');
  var brand = detail && detail.brand ? String(detail.brand).trim() : '';
  var model = detail && detail.model ? String(detail.model).trim() : '';
  var combined = (label + ' ' + brand + ' ' + model + ' ' + u);

  if (/^iphone$/i.test(label) || /\biPhone\b/i.test(u) && !/iPad/i.test(u)) {
    return 'iphone';
  }
  if (/^ipad$/i.test(label) || /\biPad\b/i.test(u)) {
    return 'ipad';
  }
  if (/windows\s*pc/i.test(label) || (osKey === 'windows' && !/phone/i.test(label))) {
    return 'windows_pc';
  }
  if (/^mac$/i.test(label) || (osKey === 'macos' && !/iPhone|iPad/i.test(u))) {
    return 'mac';
  }
  if (/chromebook/i.test(label) || osKey === 'chromeos') {
    return 'chromebook';
  }
  if (/linux\s*pc/i.test(label) || (osKey === 'linux' && !/Android/i.test(u))) {
    return 'linux_pc';
  }
  if (/nexus|pixel/i.test(combined)) {
    return 'google';
  }
  if (/23127PN|2201PN|2211133C|PKB110|25060RK16C|2410DPN|24117RK|24122RK|Redmi|Xiaomi|Miui|HyperOS|小米/i.test(combined)) {
    return 'xiaomi';
  }
  if (/PGT-AN|ANN-AN|Honor|HONOR|Magic|荣耀/i.test(combined)) {
    return 'honor';
  }
  if (/HBN-AL|HLY-AL|ADY-AL|MLA-AL|Huawei|HUAWEI|HarmonyOS|Mate|Pura|华为/i.test(combined)) {
    return 'huawei';
  }
  if (/OPPO|CPH\d|OnePlus|ONEPLUS|一加/i.test(combined)) {
    return 'oppo';
  }
  if (/\bvivo\b|V\d{4}[A-Z]{2,}/i.test(combined)) {
    return 'vivo';
  }
  if (/SM-[A-Z]\d|Samsung|Galaxy|三星/i.test(combined)) {
    return 'samsung';
  }
  if (osKey === 'ios') {
    return 'iphone';
  }
  if (osKey === 'android') {
    return 'android_phone';
  }
  return DEVICE_STATS_OS_ICON_KEY[osKey] || 'other';
}

function resolveModelIconHint(iconKey, modelLabel, ua) {
  var hints = {
    iphone: 'UA/平台含 iPhone',
    ipad: 'UA/平台含 iPad',
    android_phone: 'Android 机型代号或未知品牌',
    xiaomi: '小米 / Redmi 型号或 UA（如 23127PN、PKB110）',
    huawei: '华为 / 鸿蒙 型号或 UA（如 HBN-AL、Pura）',
    honor: '荣耀 型号或 UA（如 PGT-AN、ANN-AN00）',
    oppo: 'OPPO / 一加 型号或 UA',
    vivo: 'vivo 型号或 UA',
    samsung: '三星 Galaxy 型号或 UA',
    google: 'Nexus / Pixel 等',
    windows_pc: 'Windows 桌面端',
    mac: 'macOS 桌面端',
    chromebook: 'Chrome OS',
    linux_pc: 'Linux 桌面端'
  };
  var base = hints[iconKey] || '未能识别品牌，按系统家族显示';
  if (modelLabel) {
    return base + ' · ' + String(modelLabel).substring(0, 80);
  }
  return base;
}

function resolveOsIconHint(iconKey, osLabel) {
  var hints = {
    ios: 'iOS 系统（含版本号来自上报或 UA）',
    android: 'Android 系统',
    windows: 'Windows 系统',
    macos: 'macOS 系统',
    linux: 'Linux 系统',
    chromeos: 'Chrome OS',
    other: '其他或未识别系统'
  };
  return (hints[iconKey] || hints.other) + ' · ' + String(osLabel || '');
}

function sortDeviceStatList(map) {
  var arr = Object.keys(map).map(function (k) {
    var o = map[k];
    return {
      key: k,
      label: o.label,
      icon_key: o.icon_key,
      icon_hint: o.icon_hint || '',
      count: o.count
    };
  });
  arr.sort(function (a, b) {
    return b.count - a.count;
  });
  return arr;
}

async function handleAdminAnalyticsDeviceStats(req, res) {
  if (!pool) {
    return res.status(503).json({ code: 503, msg: '数据库未就绪' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        'SELECT user_agent_short, device_detail_json FROM user_devices'
      );
      var osMap = {};
      var modelMap = {};
      var modelIconSummary = {};
      rows.forEach(function (r) {
        var c = classifyUserDeviceRow(r.user_agent_short, r.device_detail_json);
        var detail = parseDeviceDetailJsonForStats(r.device_detail_json);
        var ua = detail && detail.user_agent ? String(detail.user_agent) : String(r.user_agent_short || '');
        var ok = c.os_key;
        var family = DEVICE_STATS_OS_FAMILY_LABEL[ok] || DEVICE_STATS_OS_FAMILY_LABEL.other;
        var ver = c.os_version ? String(c.os_version).trim() : '';
        var osLabel = ver ? family + ' ' + ver : family;
        var osAggKey = ok + '\0' + (ver || '');
        var osIconKey = DEVICE_STATS_OS_ICON_KEY[ok] || 'other';
        if (!osMap[osAggKey]) {
          osMap[osAggKey] = {
            label: osLabel,
            icon_key: osIconKey,
            icon_hint: resolveOsIconHint(osIconKey, osLabel),
            count: 0
          };
        }
        osMap[osAggKey].count += 1;

        var mk = c.model_key;
        var modelIconKey = resolveModelIconKey(c.os_key, c.model_label, ua, detail);
        if (!modelMap[mk]) {
          modelMap[mk] = {
            label: c.model_label,
            icon_key: modelIconKey,
            icon_hint: resolveModelIconHint(modelIconKey, c.model_label, ua),
            count: 0
          };
        }
        modelMap[mk].count += 1;
        modelIconSummary[modelIconKey] = (modelIconSummary[modelIconKey] || 0) + 1;
      });
      var iconSummaryList = Object.keys(modelIconSummary)
        .map(function (ik) {
          return {
            icon_key: ik,
            label: DEVICE_STATS_MODEL_ICON_LABEL[ik] || ik,
            count: modelIconSummary[ik]
          };
        })
        .sort(function (a, b) {
          return b.count - a.count;
        });
      var osFamilyMap = {};
      Object.keys(osMap).forEach(function (k) {
        var o = osMap[k];
        var fk = o.icon_key || 'other';
        if (!osFamilyMap[fk]) {
          osFamilyMap[fk] = {
            icon_key: fk,
            label: DEVICE_STATS_OS_FAMILY_LABEL[fk] || DEVICE_STATS_OS_FAMILY_LABEL.other,
            count: 0
          };
        }
        osFamilyMap[fk].count += o.count;
      });
      return res.json({
        code: 200,
        data: {
          total_devices: rows.length,
          by_os: sortDeviceStatList(osMap),
          by_os_family: sortDeviceStatList(osFamilyMap),
          by_model: sortDeviceStatList(modelMap),
          icon_summary: iconSummaryList
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function loadTaxRecordFlagsForUsernames(conn, usernames, activityDate) {
  var flags = {};
  if (!usernames || !usernames.length) {
    return flags;
  }
  usernames.forEach(function (u) {
    flags[u] = { has_tax_records: false, tax_modified_on_date: false };
  });
  var ph = usernames.map(function () {
    return '?';
  }).join(',');
  const [rows] = await conn.query(
    'SELECT user_id, COUNT(*) AS record_cnt, ' +
      'SUM(CASE WHEN DATE(updated_at) = ? THEN 1 ELSE 0 END) AS modified_on_date_cnt ' +
      'FROM tax_records WHERE user_id IN (' +
      ph +
      ') AND ' +
      TAX_RECORD_NOT_DELETED_SQL +
      ' GROUP BY user_id',
    [activityDate].concat(usernames)
  );
  rows.forEach(function (r) {
    var uname = String(r.user_id || '');
    if (!uname || !flags[uname]) {
      return;
    }
    var cnt = Number(r.record_cnt) || 0;
    var modCnt = Number(r.modified_on_date_cnt) || 0;
    flags[uname] = {
      has_tax_records: cnt > 0,
      tax_modified_on_date: modCnt > 0
    };
  });
  return flags;
}

async function handleAdminAnalyticsDauUsers(req, res) {
  try {
    var dateStr = req.query.date != null ? String(req.query.date).trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ code: 400, msg: 'date required (YYYY-MM-DD)' });
    }
    var page = parseInt(req.query.page, 10);
    if (!isFinite(page) || page < 1) {
      page = 1;
    }
    var limit = parseInt(req.query.limit, 10);
    if (!isFinite(limit) || limit < 1) {
      limit = 10;
    }
    if (limit > 100) {
      limit = 100;
    }
    const conn = await pool.getConnection();
    try {
      const [[countRow]] = await conn.execute(
        'SELECT COUNT(*) AS c FROM user_daily_activity WHERE activity_date = ?',
        [dateStr]
      );
      var total = countRow && countRow.c != null ? Number(countRow.c) : 0;
      var totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
      if (totalPages > 0 && page > totalPages) {
        page = totalPages;
      }
      var offset = Math.max(0, ((page - 1) * limit) | 0);
      var limInt = limit | 0;
      const [rows] = await conn.query(
        'SELECT username FROM user_daily_activity WHERE activity_date = ? ORDER BY username ASC LIMIT ' +
          limInt +
          ' OFFSET ' +
          offset,
        [dateStr]
      );
      if (total > 0 && totalPages < 1) {
        totalPages = 1;
      }
      var pageUsernames = rows.map(function (r) {
        return String(r.username || '');
      });
      var taxFlags = await loadTaxRecordFlagsForUsernames(conn, pageUsernames, dateStr);
      return res.json({
        code: 200,
        data: {
          date: dateStr,
          users: pageUsernames.map(function (uname) {
            var f = taxFlags[uname] || { has_tax_records: false, tax_modified_on_date: false };
            return {
              username: uname,
              has_tax_records: !!f.has_tax_records,
              tax_modified_on_date: !!f.tax_modified_on_date
            };
          }),
          total: total,
          page: page,
          limit: limit,
          total_pages: totalPages
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminAnalyticsOverview(req, res) {
  try {
    var days = clampAnalyticsDays(req.query.days, 14, 90);
    var span = Math.max(0, days - 1);
    const conn = await pool.getConnection();
    try {
      const [dauRows] = await conn.execute(
        `SELECT activity_date AS d, COUNT(*) AS cnt FROM user_daily_activity
         WHERE activity_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY activity_date ORDER BY activity_date ASC`,
        [span]
      );
      const [loginRows] = await conn.execute(
        `SELECT DATE(created_at) AS d,
           SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS success_cnt,
           SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS fail_cnt
         FROM user_login_events
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY DATE(created_at) ORDER BY d ASC`,
        [span]
      );
      const [failReasonRows] = await conn.execute(
        `SELECT COALESCE(NULLIF(reason, ''), 'unknown_error') AS reason_key, COUNT(*) AS cnt
         FROM user_login_events
         WHERE ok = 0
           AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY reason_key
         ORDER BY cnt DESC
         LIMIT 20`,
        [span]
      );
      return res.json({
        code: 200,
        data: {
          days: days,
          dau: dauRows.map(function (r) {
            return {
              date: r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10),
              active_users: Number(r.cnt)
            };
          }),
          logins: loginRows.map(function (r) {
            return {
              date: r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10),
              success: Number(r.success_cnt || 0),
              fail: Number(r.fail_cnt || 0)
            };
          }),
          fail_reasons: failReasonRows.map(function (r) {
            var k = r.reason_key != null ? String(r.reason_key) : 'unknown_error';
            return { reason_key: k, reason_label: userLoginReasonLabel(k), cnt: Number(r.cnt || 0) };
          })
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminAnalyticsApi(req, res) {
  try {
    var days = clampAnalyticsDays(req.query.days, 7, 90);
    var span = Math.max(0, days - 1);
    const conn = await pool.getConnection();
    try {
      const [byCat] = await conn.execute(
        `SELECT biz_category AS cat, SUM(cnt) AS total FROM analytics_api_daily
         WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY biz_category ORDER BY total DESC`,
        [span]
      );
      const [topRoutes] = await conn.execute(
        `SELECT MAX(biz_category) AS cat, route_key AS route, SUM(cnt) AS total
         FROM analytics_api_daily
         WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
           AND biz_category <> '管理后台'
         GROUP BY route_key
         ORDER BY total DESC LIMIT 10`,
        [span]
      );
      return res.json({
        code: 200,
        data: {
          days: days,
          by_category: byCat.map(function (r) {
            return { category: String(r.cat), calls: Number(r.total) };
          }),
          top_routes: topRoutes.map(function (r) {
            return {
              category: String(r.cat),
              route_key: String(r.route),
              cnt: Number(r.total)
            };
          })
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** C 端行为埋点在 analytics_api_daily 中的匹配条件（与列表查询一致） */
var ANALYTICS_TRACK_EVENT_SQL =
  "(route_key LIKE 'EVENT %' OR route_key LIKE '%#track\\_%')";

/** 激活弹窗相关埋点（单独统计，不计入通用 C 端埋点列表） */
var ACTIVATE_TRACK_EVENT_KEYS = [
  'track_activate_prompt_open',
  'track_activate_prompt_cancel',
  'track_activate_prompt_confirm',
  'track_xianyu_purchase_click',
  'track_qq_add_click',
  'track_qq_group_click'
];

var ACTIVATE_TRACK_EVENT_KEY_SET = {};
ACTIVATE_TRACK_EVENT_KEYS.forEach(function (k) {
  ACTIVATE_TRACK_EVENT_KEY_SET[k] = true;
});

var ACTIVATE_TRACK_EVENT_SQL =
  "(route_key LIKE '%#track_activate_prompt_open' OR route_key LIKE '%#track_activate_prompt_cancel' OR route_key LIKE '%#track_activate_prompt_confirm' OR route_key LIKE '%#track_xianyu_purchase_click' OR route_key LIKE '%#track_qq_add_click' OR route_key LIKE '%#track_qq_group_click')";

function isActivateTrackEventKey(eventKey) {
  return !!ACTIVATE_TRACK_EVENT_KEY_SET[String(eventKey || '').trim()];
}

function activateTrackEventLabel(eventKey) {
  var labels = {
    track_activate_prompt_open: '激活弹窗打开',
    track_activate_prompt_cancel: '激活弹窗-取消',
    track_activate_prompt_confirm: '激活弹窗-确定',
    track_xianyu_purchase_click: '闲鱼购买',
    track_qq_add_click: '添加QQ号',
    track_qq_group_click: '加入QQ群'
  };
  return labels[eventKey] || eventKey;
}

async function handleAdminAnalyticsEventsClear(req, res) {
  try {
    var days = clampAnalyticsDays(
      req.query.days != null ? req.query.days : req.body && req.body.days,
      14,
      90
    );
    var span = Math.max(0, days - 1);
    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(
        `DELETE FROM analytics_api_daily
         WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
           AND ${ANALYTICS_TRACK_EVENT_SQL}`,
        [span]
      );
      return res.json({
        code: 200,
        data: {
          days: days,
          deleted_rows: result && result.affectedRows != null ? Number(result.affectedRows) : 0
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminAnalyticsEvents(req, res) {
  try {
    var days = clampAnalyticsDays(req.query.days, 14, 90);
    var span = Math.max(0, days - 1);
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        `SELECT stat_date, route_key, SUM(cnt) AS total
         FROM analytics_api_daily
         WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
           AND ${ANALYTICS_TRACK_EVENT_SQL}
         GROUP BY stat_date, route_key
         ORDER BY stat_date ASC`,
        [span]
      );
      var eventMap = {};
      var dayMap = {};
      rows.forEach(function (r) {
        var rawKey = r.route_key != null ? String(r.route_key) : '';
        var eventKey = normalizeTrackEventKeyFromRoute(rawKey);
        if (!eventKey) return;
        var c = Number(r.total || 0);
        if (!isFinite(c) || c <= 0) return;
        if (!eventMap[eventKey]) {
          eventMap[eventKey] = { event_key: eventKey, total: 0 };
        }
        eventMap[eventKey].total += c;
        var d = '';
        if (r.stat_date instanceof Date) {
          d = r.stat_date.toISOString().slice(0, 10);
        } else {
          d = String(r.stat_date || '').slice(0, 10);
        }
        if (!dayMap[d]) dayMap[d] = 0;
        dayMap[d] += c;
      });
      var topEvents = Object.keys(eventMap).map(function (k) {
        return eventMap[k];
      });
      topEvents.sort(function (a, b) {
        return b.total - a.total;
      });
      topEvents = topEvents.filter(function (row) {
        return !isActivateTrackEventKey(row.event_key);
      });
      var byDay = Object.keys(dayMap)
        .sort()
        .map(function (d) {
          return { date: d, total: dayMap[d] };
        });
      return res.json({
        code: 200,
        data: {
          days: days,
          total_events: rows.length,
          by_day: byDay,
          top_events: topEvents.slice(0, 200)
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminAnalyticsActivateEvents(req, res) {
  try {
    var days = clampAnalyticsDays(req.query.days, 14, 90);
    var span = Math.max(0, days - 1);
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        `SELECT DATE(created_at) AS stat_date, username,
                SUBSTRING_INDEX(route_key, '#', -1) AS event_key,
                COUNT(*) AS cnt
         FROM user_page_events
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
           AND ${ACTIVATE_TRACK_EVENT_SQL}
         GROUP BY DATE(created_at), username, event_key
         ORDER BY stat_date DESC`,
        [span]
      );
      var eventTotals = {};
      ACTIVATE_TRACK_EVENT_KEYS.forEach(function (k) {
        eventTotals[k] = 0;
      });
      var dayMap = {};
      rows.forEach(function (r) {
        var ek = String(r.event_key || '').trim();
        if (!isActivateTrackEventKey(ek)) {
          return;
        }
        var c = Number(r.cnt) || 0;
        if (c <= 0) {
          return;
        }
        eventTotals[ek] = (eventTotals[ek] || 0) + c;
        var d = '';
        if (r.stat_date instanceof Date) {
          d = r.stat_date.toISOString().slice(0, 10);
        } else {
          d = String(r.stat_date || '').slice(0, 10);
        }
        if (!d) {
          return;
        }
        if (!dayMap[d]) {
          dayMap[d] = { date: d, events: {}, total: 0, user_set: {} };
          ACTIVATE_TRACK_EVENT_KEYS.forEach(function (k2) {
            dayMap[d].events[k2] = 0;
          });
        }
        dayMap[d].events[ek] = (dayMap[d].events[ek] || 0) + c;
        dayMap[d].total += c;
        if (r.username) {
          dayMap[d].user_set[String(r.username)] = true;
        }
      });
      var summary = ACTIVATE_TRACK_EVENT_KEYS.map(function (k) {
        return {
          event_key: k,
          label: activateTrackEventLabel(k),
          total: eventTotals[k] || 0
        };
      });
      var byDay = Object.keys(dayMap)
        .sort()
        .reverse()
        .map(function (d) {
          var o = dayMap[d];
          return {
            date: o.date,
            events: o.events,
            total: o.total,
            unique_users: Object.keys(o.user_set).length
          };
        });
      var grandTotal = 0;
      summary.forEach(function (s) {
        grandTotal += s.total;
      });
      return res.json({
        code: 200,
        data: {
          days: days,
          event_keys: ACTIVATE_TRACK_EVENT_KEYS.slice(),
          summary: summary,
          total_clicks: grandTotal,
          by_day: byDay
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminAnalyticsActivateEventUsers(req, res) {
  try {
    var dateStr = req.query.date != null ? String(req.query.date).trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ code: 400, msg: 'date required (YYYY-MM-DD)' });
    }
    var eventKey = req.query.event_key != null ? String(req.query.event_key).trim() : '';
    if (eventKey && !isActivateTrackEventKey(eventKey)) {
      return res.status(400).json({ code: 400, msg: 'invalid event_key' });
    }
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 20;
    if (page < 1) {
      page = 1;
    }
    if (limit < 1) {
      limit = 20;
    }
    if (limit > 100) {
      limit = 100;
    }
    const conn = await pool.getConnection();
    try {
      var eventFilterSql = ACTIVATE_TRACK_EVENT_SQL;
      var params = [dateStr];
      if (eventKey) {
        eventFilterSql = 'route_key LIKE ?';
        params = [dateStr, '%#' + eventKey];
      }
      const [aggRows] = await conn.execute(
        `SELECT username,
                SUBSTRING_INDEX(route_key, '#', -1) AS event_key,
                COUNT(*) AS cnt,
                MAX(created_at) AS last_at
         FROM user_page_events
         WHERE DATE(created_at) = ?
           AND ${eventFilterSql}
         GROUP BY username, event_key`,
        params
      );
      var userMap = {};
      aggRows.forEach(function (r) {
        var ek = String(r.event_key || '').trim();
        if (!isActivateTrackEventKey(ek)) {
          return;
        }
        var uname = String(r.username || '').trim();
        if (!uname) {
          return;
        }
        if (!userMap[uname]) {
          userMap[uname] = {
            username: uname,
            events: {},
            total: 0,
            last_at: ''
          };
          ACTIVATE_TRACK_EVENT_KEYS.forEach(function (k) {
            userMap[uname].events[k] = 0;
          });
        }
        var c = Number(r.cnt) || 0;
        userMap[uname].events[ek] = (userMap[uname].events[ek] || 0) + c;
        userMap[uname].total += c;
        var la = r.last_at ? (r.last_at instanceof Date ? r.last_at.toISOString() : String(r.last_at)) : '';
        if (la && (!userMap[uname].last_at || la > userMap[uname].last_at)) {
          userMap[uname].last_at = la;
        }
      });
      var users = Object.keys(userMap)
        .map(function (k) {
          return userMap[k];
        })
        .sort(function (a, b) {
          return b.total - a.total || String(a.username).localeCompare(String(b.username));
        });
      var total = users.length;
      var totalPages = Math.max(1, Math.ceil(total / limit) || 1);
      if (page > totalPages) {
        page = totalPages;
      }
      var offset = (page - 1) * limit;
      var pageUsers = users.slice(offset, offset + limit);
      return res.json({
        code: 200,
        data: {
          date: dateStr,
          event_key: eventKey || '',
          users: pageUsers,
          total: total,
          page: page,
          limit: limit,
          total_pages: totalPages
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminAnalyticsDevices(req, res) {
  var username = req.query.username != null ? String(req.query.username).trim() : '';
  if (!username) {
    return res.status(400).json({ code: 400, msg: '请填写要查询的账号 username' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        `SELECT device_fp, user_agent_short, ip_last, city_last, first_seen, last_seen, login_count,
                client_id, device_detail_json, api_sync_count
         FROM user_devices WHERE username = ? ORDER BY last_seen DESC`,
        [username.substring(0, 255)]
      );
      return res.json({
        code: 200,
        data: {
          username: username,
          devices: rows.map(function (r) {
            var dj = r.device_detail_json != null ? String(r.device_detail_json) : '';
            var summary = '';
            if (dj) {
              try {
                var parsed = JSON.parse(dj);
                if (parsed && typeof parsed === 'object') {
                  var bits = [];
                  if (parsed.source) bits.push(parsed.source);
                  if (parsed.platform) bits.push(parsed.platform);
                  if (parsed.model) bits.push(parsed.model);
                  if (parsed.os_version) bits.push(parsed.os_version);
                  if (parsed.app_version) bits.push('app:' + parsed.app_version);
                  summary = bits.join(' · ');
                }
              } catch (e1) {
                summary = '';
              }
            }
            return {
              device_fp: r.device_fp,
              client_id: r.client_id != null ? String(r.client_id) : '',
              summary: summary,
              device_json: dj,
              user_agent_short: r.user_agent_short != null ? String(r.user_agent_short) : '',
              ip_last: r.ip_last != null ? String(r.ip_last) : '',
              city_last: resolveDeviceCityLabel(r.ip_last, r.city_last),
              first_seen: r.first_seen ? r.first_seen.toISOString() : null,
              last_seen: r.last_seen ? r.last_seen.toISOString() : null,
              login_count: r.login_count != null ? Number(r.login_count) : 0,
              api_sync_count: r.api_sync_count != null ? Number(r.api_sync_count) : 0
            };
          })
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminAnalyticsLoginRecent(req, res) {
  try {
    var page = parseInt(req.query.page, 10);
    if (!isFinite(page) || page < 1) {
      page = 1;
    }
    var limit = parseInt(req.query.limit, 10);
    if (!isFinite(limit) || limit < 1) {
      limit = 20;
    }
    if (limit > 100) {
      limit = 100;
    }
    var qUsername = req.query.username != null ? String(req.query.username).trim() : '';
    var qOk = req.query.ok != null ? String(req.query.ok).trim() : '';
    var qReason = req.query.reason != null ? String(req.query.reason).trim() : '';
    var where = [];
    var params = [];
    if (qUsername) {
      where.push('username LIKE ?');
      params.push('%' + qUsername + '%');
    }
    if (qOk === '1' || qOk === '0') {
      where.push('ok = ?');
      params.push(qOk === '1' ? 1 : 0);
    }
    appendUserLoginReasonFilter(where, params, qReason);
    if (!req.admin || !req.admin.is_super) {
      where.push(
        'EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = user_login_events.username AND ac.owner_admin_username = ?)'
      );
      params.push(req.admin.username);
    }
    var whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const conn = await pool.getConnection();
    try {
      const [[countRow]] = await conn.execute('SELECT COUNT(*) AS c FROM user_login_events' + whereSql, params);
      var total = countRow && countRow.c != null ? Number(countRow.c) : 0;
      var totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
      if (totalPages > 0 && page > totalPages) {
        page = totalPages;
      }
      // 分页避免 LIMIT/OFFSET 占位符：部分 MySQL/MariaDB 或中间层对预编译 LIMIT 会报 stmt_execute 参数错误
      var offset = Math.max(0, ((page - 1) * limit) | 0);
      var limInt = limit | 0;
      const [rows] = await conn.query(
        'SELECT username, ok, reason, reason_detail, ip, city, user_agent, created_at FROM user_login_events ' +
          whereSql +
          ' ' +
          'ORDER BY id DESC LIMIT ' +
          limInt +
          ' OFFSET ' +
          offset,
        params
      );
      if (total > 0 && totalPages < 1) {
        totalPages = 1;
      }
      return res.json({
        code: 200,
        data: {
          items: rows.map(function (r) {
            var reasonKey = r.reason != null ? String(r.reason) : '';
            var reasonDetail = r.reason_detail != null ? String(r.reason_detail) : '';
            return {
              username: String(r.username),
              ok: !!(r.ok === 1 || r.ok === true),
              reason_key: reasonKey,
              reason_label: userLoginReasonLabel(r.reason),
              reason_detail: reasonDetail,
              reason_display: userLoginReasonDisplayLabel(reasonKey, reasonDetail),
              ip: r.ip != null ? String(r.ip) : '',
              city: r.city != null ? String(r.city) : '',
              user_agent: r.user_agent != null ? String(r.user_agent) : '',
              created_at: r.created_at ? r.created_at.toISOString() : ''
            };
          }),
          total: total,
          page: page,
          limit: limit,
          total_pages: totalPages
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminLoginLogs(req, res) {
  try {
    var page = parseInt(req.query.page, 10);
    if (!isFinite(page) || page < 1) page = 1;
    var limit = parseInt(req.query.limit, 10);
    if (!isFinite(limit) || limit < 1) limit = 20;
    if (limit > 100) limit = 100;
    var qUsername = sanitizeAuditText(req.query.username || '', 255);
    var qOk = req.query.ok != null ? String(req.query.ok).trim() : '';

    var where = [];
    var params = [];
    if (!req.admin || !req.admin.is_super) {
      where.push('admin_username = ?');
      params.push(req.admin.username);
    } else if (qUsername) {
      where.push('admin_username LIKE ?');
      params.push('%' + qUsername + '%');
    }
    if (qOk === '1' || qOk === '0') {
      where.push('ok = ?');
      params.push(qOk === '1' ? 1 : 0);
    }
    var whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const conn = await pool.getConnection();
    try {
      const [cntRows] = await conn.execute('SELECT COUNT(*) AS c FROM admin_login_events' + whereSql, params);
      var total = cntRows.length ? Number(cntRows[0].c) : 0;
      var totalPages = Math.ceil(total / limit);
      if (total > 0 && totalPages < 1) totalPages = 1;
      if (totalPages > 0 && page > totalPages) page = totalPages;
      var offset = Math.max(0, ((page - 1) * limit) | 0);
      const [rows] = await conn.query(
        'SELECT admin_username, ok, reason, ip, city, user_agent, device_desc, created_at FROM admin_login_events' +
          whereSql +
          ' ORDER BY id DESC LIMIT ' +
          (limit | 0) +
          ' OFFSET ' +
          offset,
        params
      );
      return res.json({
        code: 200,
        data: {
          items: rows.map(function (r) {
            return {
              admin_username: r.admin_username != null ? String(r.admin_username) : '',
              ok: r.ok === 1 || r.ok === true,
              reason: r.reason != null ? String(r.reason) : '',
              ip: r.ip != null ? String(r.ip) : '',
              city: r.city != null ? String(r.city) : '',
              user_agent: r.user_agent != null ? String(r.user_agent) : '',
              device_desc: r.device_desc != null ? String(r.device_desc) : '',
              created_at: r.created_at ? r.created_at.toISOString() : ''
            };
          }),
          total: total,
          page: page,
          limit: limit,
          total_pages: totalPages
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminOperationLogs(req, res) {
  try {
    var page = parseInt(req.query.page, 10);
    if (!isFinite(page) || page < 1) page = 1;
    var limit = parseInt(req.query.limit, 10);
    if (!isFinite(limit) || limit < 1) limit = 20;
    if (limit > 100) limit = 100;
    var qUsername = sanitizeAuditText(req.query.username || '', 255);
    var qOk = req.query.ok != null ? String(req.query.ok).trim() : '';
    var qPath = sanitizeAuditText(req.query.path || '', 255);

    var where = [];
    var params = [];
    if (!req.admin || !req.admin.is_super) {
      where.push('admin_username = ?');
      params.push(req.admin.username);
    } else if (qUsername) {
      where.push('admin_username LIKE ?');
      params.push('%' + qUsername + '%');
    }
    if (qOk === '1' || qOk === '0') {
      where.push('ok = ?');
      params.push(qOk === '1' ? 1 : 0);
    }
    if (qPath) {
      where.push('path LIKE ?');
      params.push('%' + qPath + '%');
    }
    var whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const conn = await pool.getConnection();
    try {
      const [cntRows] = await conn.execute('SELECT COUNT(*) AS c FROM admin_operation_logs' + whereSql, params);
      var total = cntRows.length ? Number(cntRows[0].c) : 0;
      var totalPages = Math.ceil(total / limit);
      if (total > 0 && totalPages < 1) totalPages = 1;
      if (totalPages > 0 && page > totalPages) page = totalPages;
      var offset = Math.max(0, ((page - 1) * limit) | 0);
      const [rows] = await conn.query(
        'SELECT admin_username, admin_full_name, method, path, action, target_username, request_brief, ip, city, device_desc, status_code, biz_result_code, ok, created_at ' +
          'FROM admin_operation_logs' +
          whereSql +
          ' ORDER BY id DESC LIMIT ' +
          (limit | 0) +
          ' OFFSET ' +
          offset,
        params
      );
      return res.json({
        code: 200,
        data: {
          items: rows.map(function (r) {
            return {
              admin_username: r.admin_username != null ? String(r.admin_username) : '',
              admin_full_name: r.admin_full_name != null ? String(r.admin_full_name) : '',
              method: r.method != null ? String(r.method) : '',
              path: r.path != null ? String(r.path) : '',
              action: r.action != null ? String(r.action) : '',
              target_username: r.target_username != null ? String(r.target_username) : '',
              request_brief: r.request_brief != null ? String(r.request_brief) : '',
              ip: r.ip != null ? String(r.ip) : '',
              city: r.city != null ? String(r.city) : '',
              device_desc: r.device_desc != null ? String(r.device_desc) : '',
              status_code: r.status_code != null ? Number(r.status_code) : 0,
              biz_result_code: r.biz_result_code != null ? Number(r.biz_result_code) : null,
              ok: r.ok === 1 || r.ok === true,
              created_at: r.created_at ? r.created_at.toISOString() : ''
            };
          }),
          total: total,
          page: page,
          limit: limit,
          total_pages: totalPages
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminFeedbackList(req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 20;
    if (page < 1) page = 1;
    if (limit < 1) limit = 20;
    if (limit > 100) limit = 100;
    var offset = (page - 1) * limit;
    var typeFilter = req.query.type != null ? String(req.query.type).trim() : '';
    var activeFilter = req.query.active != null ? String(req.query.active).trim() : '';
    var conditions = [];
    var params = [];
    if (typeFilter === 'bug' || typeFilter === 'suggestion') {
      conditions.push('f.feedback_type = ?');
      params.push(typeFilter);
    }
    if (activeFilter === '1') {
      conditions.push('u.account_active = 1');
    } else if (activeFilter === '0') {
      conditions.push('(u.account_active = 0 OR u.account_active IS NULL OR u.id IS NULL)');
    }
    var where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    var join = ' FROM user_feedback f LEFT JOIN users u ON u.username = f.user_id ';
    const conn = await pool.getConnection();
    try {
      const [cntRows] = await conn.execute(
        'SELECT COUNT(*) AS c' + join + where,
        params
      );
      var total = cntRows.length ? Number(cntRows[0].c) : 0;
      var totalPages = Math.ceil(total / limit);
      if (total > 0 && totalPages < 1) {
        totalPages = 1;
      }
      const [rows] = await conn.query(
        `SELECT f.id, f.user_id, f.real_name_snapshot, f.feedback_type, f.content, f.admin_reply,
                f.replied_at, f.replied_by, f.created_at, u.account_active
         ${join} ${where} ORDER BY f.id DESC LIMIT ${limit} OFFSET ${offset}`,
        params
      );
      return res.json({
        code: 200,
        data: {
          items: rows.map(function (r) {
            return {
              id: r.id,
              user_id: r.user_id,
              real_name_snapshot: r.real_name_snapshot,
              feedback_type: r.feedback_type,
              content: r.content,
              admin_reply: r.admin_reply,
              replied_at: r.replied_at ? r.replied_at.toISOString() : null,
              replied_by: r.replied_by,
              created_at: r.created_at ? r.created_at.toISOString() : '',
              account_active: r.account_active === 1 || r.account_active === true
            };
          }),
          total: total,
          page: page,
          limit: limit,
          total_pages: totalPages
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminFeedbackReply(req, res) {
  try {
    var body = req.body || {};
    var id = parseInt(body.id, 10);
    var reply = body.reply != null ? String(body.reply).trim() : '';
    if (!id || id < 1) {
      return res.status(400).json({ code: 400, msg: 'id 无效' });
    }
    if (!reply || reply.length > 4000) {
      return res.status(400).json({ code: 400, msg: '回复内容不能为空且不超过 4000 字' });
    }
    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(
        `UPDATE user_feedback SET admin_reply = ?, replied_at = NOW(), replied_by = ? WHERE id = ?`,
        [reply, req.admin && req.admin.username ? String(req.admin.username) : String(ADMIN_PANEL_USER), id]
      );
      if (!result.affectedRows) {
        return res.status(404).json({ code: 404, msg: '记录不存在' });
      }
      return res.json({ code: 200, data: { success: true } });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

app.post('/api/admin/login', handleAdminLogin);
app.get('/api/admin/me', requireAdminAuth, handleAdminMe);
app.get('/api/admin/settings', requireAdminAuth, requireAdminAnyMenu(['settings', 'install-guide', 'appearance']), handleAdminSettingsGet);
app.post(
  '/api/admin/upload-asset',
  requireAdminAuth,
  requireAdminAnyMenu(['install-guide', 'appearance']),
  function (req, res, next) {
    adminUpload.single('file')(req, res, function (err) {
      if (err) {
        return res.status(400).json({ code: 400, msg: String(err.message || '上传失败') });
      }
      next();
    });
  },
  handleAdminUploadAsset
);
app.post('/api/admin/settings', requireAdminAuth, requireAdminAnyMenu(['settings', 'install-guide', 'appearance']), handleAdminSettingsPost);
app.get('/api/public/mine-ui', handlePublicMineUi);
app.get('/api/public/install-packages', handlePublicInstallPackages);
app.get('/api/public/resolve-sales-channel', handlePublicResolveSalesChannel);
app.post('/api/public/sales-channel-attribution', handlePublicSalesChannelAttribution);
app.get('/api/public/conversion-config', handlePublicConversionConfig);
app.get('/api/admin/users/deleted', requireAdminAuth, requireAdminMenu('users'), handleAdminDeletedUsers);
app.get('/api/admin/users', requireAdminAuth, requireAdminMenu('users'), handleAdminUsers);
app.get('/api/admin/user-data', requireAdminAuth, requireAdminMenu('user-data'), handleAdminUserDataList);
app.get(
  '/api/admin/user-data/analytics',
  requireAdminAuth,
  requireAdminMenu('user-data'),
  handleAdminUserDataAnalytics
);
app.get(
  '/api/admin/user-data/salary-high/charts',
  requireAdminAuth,
  requireAdminMenu('user-data'),
  handleAdminUserDataSalaryHighCharts
);
app.get(
  '/api/admin/user-data/detail',
  requireAdminAuth,
  requireAdminMenu('user-data'),
  handleAdminUserDataDetail
);
app.get(
  '/api/admin/analytics/daily-conversion',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-conversion', 'analytics']),
  handleAdminUsersDailyConversion
);
app.get(
  '/api/admin/analytics/registration-funnel',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-conversion', 'analytics']),
  handleAdminRegistrationFunnel
);
app.get(
  '/api/admin/analytics/channel-registration-funnel',
  requireAdminAuth,
  requireAdminMenu('channel-analysis'),
  handleAdminChannelRegistrationFunnel
);
app.get(
  '/api/admin/analytics/activation-channel-funnel',
  requireAdminAuth,
  requireAdminMenu('channel-analysis'),
  handleAdminActivationChannelFunnel
);
app.get(
  '/api/admin/analytics/install-guide-stats',
  requireAdminAuth,
  requireAdminMenu('install-guide-stats'),
  handleAdminInstallGuideStats
);
app.get(
  '/api/admin/analytics/install-track-stats',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-tracking', 'analytics']),
  handleAdminInstallTrackStats
);
app.get(
  '/api/admin/analytics/conversion-kpis',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-conversion', 'analytics']),
  handleAdminConversionKpis
);
app.get(
  '/api/admin/users/pending-activate-24h',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-conversion', 'analytics']),
  handleAdminUsersPendingActivate24h
);
app.get(
  '/api/admin/analytics/register-time',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-register', 'analytics']),
  handleAdminRegisterTimeDistribution
);
app.get(
  '/api/admin/analytics/register-gender',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-register', 'analytics', 'channel-analysis']),
  handleAdminRegisterGenderStats
);
app.get(
  '/api/admin/analytics/register-channels',
  requireAdminAuth,
  requireAdminMenu('channel-analysis'),
  handleAdminRegisterChannelStats
);
app.get(
  '/api/admin/analytics/female-age',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-register', 'analytics']),
  handleAdminFemaleAgeStats
);
app.get(
  '/api/admin/user-data/female-age',
  requireAdminAuth,
  requireAdminMenu('user-data'),
  handleAdminFemaleAgeStats
);
app.get(
  '/api/admin/user-data/no-tax-behavior',
  requireAdminAuth,
  requireAdminMenu('user-behavior'),
  handleAdminUserDataNoTaxBehavior
);
app.get(
  '/api/admin/user-data/no-tax-behavior/path',
  requireAdminAuth,
  requireAdminMenu('user-behavior'),
  handleAdminUserDataNoTaxBehaviorPath
);
app.get(
  '/api/admin/user-data/no-tax-behavior/export',
  requireAdminAuth,
  requireAdminMenu('user-behavior'),
  handleAdminUserDataNoTaxBehaviorExport
);
app.get(
  '/api/admin/activated-user-analysis/overview',
  requireAdminAuth,
  requireAdminMenu('activated-user-analysis'),
  handleAdminActivatedUserAnalysisOverview
);
app.get(
  '/api/admin/activated-user-analysis/users',
  requireAdminAuth,
  requireAdminMenu('activated-user-analysis'),
  handleAdminActivatedUserAnalysisUsers
);
app.get(
  '/api/admin/activated-user-analysis/behavior-path',
  requireAdminAuth,
  requireAdminMenu('activated-user-analysis'),
  handleAdminActivatedUserAnalysisBehaviorPath
);
app.get('/api/admin/user-tax-records', requireAdminAuth, requireAdminMenu('users'), handleAdminUserTaxRecords);
app.post('/api/admin/issue-code', requireAdminAuth, requireAdminMenu('codes'), handleAdminIssueCode);
app.post(
  '/api/admin/issue-code-batch',
  requireAdminAuth,
  requireAdminMenu('codes'),
  handleAdminIssueCodeBatch
);
app.get('/api/admin/codes', requireAdminAuth, requireAdminMenu('codes'), handleAdminCodes);
app.post('/api/admin/user-activate', requireAdminAuth, requireAdminMenu('users'), handleAdminUserActivate);
app.post('/api/admin/ban', requireAdminAuth, requireAdminMenu('users'), handleAdminBan);
app.post('/api/admin/user-delete', requireAdminAuth, requireAdminMenu('users'), handleAdminDeleteUser);
app.post('/api/admin/user-refund', requireAdminAuth, requireAdminMenu('users'), handleAdminUserRefund);
app.post('/api/admin/user-restore', requireAdminAuth, requireAdminMenu('users'), handleAdminUserRestore);
app.post('/api/admin/users/purge-bots', requireAdminAuth, requireAdminMenu('users'), handleAdminPurgeBotUsers);
app.get(
  '/api/admin/analytics/overview',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-activity', 'analytics']),
  handleAdminAnalyticsOverview
);
app.get(
  '/api/admin/analytics/dau-users',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-activity', 'analytics']),
  handleAdminAnalyticsDauUsers
);
app.get('/api/admin/analytics/api-stats', requireAdminAuth, requireAdminMenu('api-analytics'), handleAdminAnalyticsApi);
app.get(
  '/api/admin/analytics/events',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-tracking', 'analytics']),
  handleAdminAnalyticsEvents
);
app.get(
  '/api/admin/analytics/activate-events',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-tracking', 'analytics']),
  handleAdminAnalyticsActivateEvents
);
app.get(
  '/api/admin/analytics/activate-events/users',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-tracking', 'analytics']),
  handleAdminAnalyticsActivateEventUsers
);
app.post(
  '/api/admin/analytics/events/clear',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-tracking', 'analytics']),
  handleAdminAnalyticsEventsClear
);
app.get(
  '/api/admin/analytics/devices',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-devices', 'analytics']),
  handleAdminAnalyticsDevices
);
app.get(
  '/api/admin/analytics/device-stats',
  requireAdminAuth,
  requireAdminAnyMenu(['analytics-devices', 'analytics']),
  handleAdminAnalyticsDeviceStats
);
app.get('/api/admin/analytics/login-recent', requireAdminAuth, requireAdminMenu('login-log'), handleAdminAnalyticsLoginRecent);
app.get('/api/admin/admin-login-logs', requireAdminAuth, requireAdminMenu('login-log'), handleAdminLoginLogs);
app.get('/api/admin/admin-operation-logs', requireAdminAuth, requireAdminMenu('login-log'), handleAdminOperationLogs);
app.get('/api/admin/feedback', requireAdminAuth, requireAdminMenu('feedback'), handleAdminFeedbackList);
app.post('/api/admin/feedback/reply', requireAdminAuth, requireAdminMenu('feedback'), handleAdminFeedbackReply);
app.get('/api/admin/accounts', requireAdminAuth, handleAdminAccountsList);
app.get('/api/admin/accounts/activated-users', requireAdminAuth, handleAdminAccountActivatedUsers);
app.post('/api/admin/accounts/create', requireAdminAuth, handleAdminAccountsCreate);
app.post('/api/admin/accounts/update', requireAdminAuth, handleAdminAccountsUpdate);
app.post('/api/admin/accounts/delete', requireAdminAuth, handleAdminAccountsDelete);

async function handleAdminMonitorOverview(req, res) {
  try {
    res.json({ code: 200, data: serverMonitor.getMonitorOverview() });
  } catch (e) {
    res.status(500).json({ code: 500, msg: String(e && e.message ? e.message : e) });
  }
}

async function handleAdminMonitorTestEmail(req, res) {
  try {
    var result = await serverMonitor.sendTestAlertEmail();
    res.json({ code: 200, msg: '测试邮件已发送', data: result });
  } catch (e) {
    res.status(400).json({ code: 400, msg: String(e && e.message ? e.message : e) });
  }
}

app.get('/api/admin/monitor/overview', requireAdminAuth, requireAdminMenu('server-monitor'), handleAdminMonitorOverview);
app.post('/api/admin/monitor/test-email', requireAdminAuth, requireAdminMenu('server-monitor'), handleAdminMonitorTestEmail);

function healthHandler(req, res) {
  res.json({ ok: true });
}
app.get('/health', healthHandler);
// 与 nginx `location /api/` 代理一致，便于经前端反代做探活
app.get('/api/health', healthHandler);

async function startServer() {
  await initDatabase();
  try {
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (e) {
    console.error('UPLOAD_DIR mkdir', UPLOAD_DIR, e);
  }
  serverMonitor.initServerMonitor({ pool: pool, uploadDir: UPLOAD_DIR });
  serverMonitor.startServerMonitor();
  app.listen(PORT, '0.0.0.0', function () {
    console.log('api listening on ' + PORT + ', database: ' + DB_DATABASE);
  });
}

startServer().catch(console.error);
