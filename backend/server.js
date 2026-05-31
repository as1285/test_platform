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
const { setupAdmin, ADMIN_MENU_KEYS } = require('./admin');
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
const SETTING_KEY_IOS_MOBILECONFIG = 'ios_mobileconfig_download_url';
/** 闲鱼购买等外链，与引导安装一同在后台配置 */
const SETTING_KEY_XIANYU_PURCHASE = 'xianyu_purchase_url';
/** 个人中心顶栏「添加QQ号」外链 */
const SETTING_KEY_QQ_ADD_URL = 'qq_add_url';
const SETTING_KEY_WECHAT_PAY_QRCODE = 'wechat_pay_qrcode_url';
const SETTING_KEY_CONVERSION_AB = 'conversion_ab_json';

const DEFAULT_CONVERSION_AB = {
  enabled: true,
  activate_title_a: '请输入激活码',
  activate_subtitle_a: '激活后可填写个税演示数据',
  activate_title_b: '输入激活码，解锁完整功能',
  activate_subtitle_b: '30秒体验收入纳税明细',
  batch_example_prominent: false
};


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
    install_usage_video: ''
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

async function getInstallPackageSettingsFromDb() {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN (?, ?, ?, ?)',
      [
        SETTING_KEY_ANDROID_APK,
        SETTING_KEY_IOS_MOBILECONFIG,
        SETTING_KEY_XIANYU_PURCHASE,
        SETTING_KEY_QQ_ADD_URL
      ]
    );
    var map = {};
    rows.forEach(function (r) {
      map[r.setting_key] = r.setting_value;
    });
    var android = map[SETTING_KEY_ANDROID_APK] != null ? String(map[SETTING_KEY_ANDROID_APK]).trim() : '';
    var ios = map[SETTING_KEY_IOS_MOBILECONFIG] != null ? String(map[SETTING_KEY_IOS_MOBILECONFIG]).trim() : '';
    var xianyu =
      map[SETTING_KEY_XIANYU_PURCHASE] != null ? String(map[SETTING_KEY_XIANYU_PURCHASE]).trim() : '';
    var qq = map[SETTING_KEY_QQ_ADD_URL] != null ? String(map[SETTING_KEY_QQ_ADD_URL]).trim() : '';
    return { android: android, ios: ios, xianyu: xianyu, qq: qq };
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
  if (isDeprecatedMessageHeaderRef(form.message_header)) {
    form.message_header = '';
  }
  return form;
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

  conn.release();
}

async function getRecords(userId, year) {
  const conn = await pool.getConnection();
  let query = 'SELECT * FROM tax_records WHERE user_id = ?';
  const params = [userId];
  
  if (year != null && year !== '') {
    query += ' AND year = ?';
    params.push(parseInt(year, 10));
  }
  
  query += ' ORDER BY year DESC, month DESC';
  
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
        unemployment_insurance = ?, housing_fund = ?
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

/** 批量写入专用：仅新增，若 id 已被本用户占用则自动换号，不覆盖已有记录 */
async function resolveUniqueTaxRecordId(conn, userId, preferredId) {
  var base =
    preferredId != null && String(preferredId).trim() !== ''
      ? String(preferredId).trim()
      : 'tr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  var id = base;
  var n = 0;
  while (true) {
    const [rows] = await conn.execute('SELECT id FROM tax_records WHERE id = ? AND user_id = ?', [
      id,
      userId
    ]);
    if (rows.length === 0) {
      return id;
    }
    n += 1;
    id = base + '_n' + n;
  }
}

async function insertRecordInConn(conn, userId, record) {
  var preferredId = record.id != null ? String(record.id) : '';
  const id = await resolveUniqueTaxRecordId(conn, userId, preferredId);
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
    id_reassigned: preferredId !== '' && id !== preferredId
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
    return {
      saved: saved.length,
      ids: saved.map(function (x) {
        return x.id;
      }),
      reassigned_ids: reassigned
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
  const [rows] = await conn.execute('SELECT * FROM tax_records WHERE id = ? AND user_id = ?', [id, userId]);
  if (rows.length) {
    await insertTaxChangeLog(conn, userId, id, 'delete', taxRecordRowToSnapshot(rows[0]), null);
  }
  await conn.execute('DELETE FROM tax_records WHERE id = ? AND user_id = ?', [id, userId]);
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
    return {
      deleted: ids.filter(function (x) {
        return x != null && String(x).trim() !== '';
      }).length,
      saved: saved.length,
      ids: saved.map(function (x) {
        return x.id;
      }),
      reassigned_ids: reassigned
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
  await conn.execute('DELETE FROM tax_records WHERE user_id = ?', [userId]);
  conn.release();
}

async function deleteRecordsByYear(userId, year) {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute('DELETE FROM tax_records WHERE user_id = ? AND year = ?', [
      userId,
      year
    ]);
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
      'DELETE FROM tax_records WHERE user_id = ? AND TRIM(company_name) = ?',
      [userId, name]
    );
    return { deleted: result.affectedRows != null ? Number(result.affectedRows) : 0 };
  } finally {
    conn.release();
  }
}

async function getTaxRecordById(userId, id) {
  const conn = await pool.getConnection();
  const [rows] = await conn.execute('SELECT * FROM tax_records WHERE id = ? AND user_id = ?', [id, userId]);
  conn.release();
  return rows.length > 0 ? rows[0] : null;
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
        'SELECT * FROM tax_records WHERE user_id = ? AND year = ? ORDER BY month ASC, id ASC',
        [String(userId), year]
      );
      rows = r2;
    } else {
      const ct = anchor.company_tax_id != null ? String(anchor.company_tax_id).trim() : '';
      if (ct) {
        const [r2] = await conn.execute(
          `SELECT * FROM tax_records WHERE user_id = ? AND year = ? AND month IS NOT NULL AND month <= ? AND TRIM(IFNULL(company_tax_id,'')) = ? ORDER BY month ASC, id ASC`,
          [String(userId), year, month, ct]
        );
        rows = r2;
        if (rows.length === 0) {
          const [r3] = await conn.execute(
            `SELECT * FROM tax_records WHERE user_id = ? AND year = ? AND month IS NOT NULL AND month <= ? ORDER BY month ASC, id ASC`,
            [String(userId), year, month]
          );
          rows = r3;
        }
      } else {
        const [r2] = await conn.execute(
          `SELECT * FROM tax_records WHERE user_id = ? AND year = ? AND month IS NOT NULL AND month <= ? ORDER BY month ASC, id ASC`,
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
    'SELECT user_id, year, month, income, tax_period FROM tax_records WHERE user_id IN (' + ph + ')',
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
async function registerUser(username, password, registerSourceChannel) {
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
      `INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password, register_source_channel)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
      [username, saltHex, hash, displayName, USER_TYPE_NORMAL, storePlain, registerSourceChannel]
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
    throw new Error('账号或密码错误');
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
  const [taxCountRows] = await conn.execute('SELECT COUNT(*) AS c FROM tax_records WHERE user_id = ?', [uid]);
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
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      `INSERT INTO user_login_events (username, ok, reason, ip, city, user_agent, device_fp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uname, ok ? 1 : 0, reasonKey || null, ip.substring(0, 128), city.substring(0, 255), ua.substring(0, 512), fp]
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
  if (msg.indexOf('账号或密码错误') >= 0) return 'invalid_credentials';
  if (msg.indexOf('账号仅支持') >= 0 || msg.indexOf('账号长度') >= 0 || msg.indexOf('请输入账号') >= 0) {
    return 'invalid_username';
  }
  return 'other_error';
}

function userLoginReasonLabel(reason) {
  var k = String(reason || '').trim();
  var map = {
    ok: '成功',
    empty_password: '密码为空',
    account_banned: '账号已封禁',
    invalid_credentials: '账号或密码错误',
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
  return map[k] || k || '未知错误';
}

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
      return res.json({
        code: 200,
        data: {
          wechat_pay_qrcode_url: qrRef,
          wechat_pay_qrcode_display_url: resolvePublicAssetUrl(qrRef)
        }
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
      data: {
        items: out,
        wechat_pay_qrcode_url: qrRef,
        wechat_pay_qrcode_display_url: resolvePublicAssetUrl(qrRef)
      }
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
      return res.json({ code: 200, data: out });
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
      await deleteAllRecords(userId);
      return res.json({ code: 200, data: {} });
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
  requireAuth(req, res, function () {
    handleTaxGet(req, res).catch(function (e) {
      console.error(e);
      if (!res.headersSent) {
        res.status(500).json({ code: 500, msg: String(e.message) });
      }
    });
  });
});
app.post('/api/tax.php', requireAuth, handleTaxPost);
app.get('/api/message.php', requireAuth, handleMessageGet);
app.post('/api/message.php', requireAuth, handleMessagePost);
app.get('/message.php', requireAuth, handleMessageGet);
app.post('/message.php', requireAuth, handleMessagePost);
app.get('/api/user.php', requireAuth, handleUserGet);
app.post('/api/user.php', requireAuth, handleUserPost);
app.get('/user.php', requireAuth, handleUserGet);
app.post('/user.php', requireAuth, handleUserPost);
app.get('/api/feedback.php', requireAuth, handleFeedbackGet);
app.post('/api/feedback.php', requireAuth, handleFeedbackPost);
app.get('/feedback.php', requireAuth, handleFeedbackGet);
app.post('/feedback.php', requireAuth, handleFeedbackPost);
app.get('/api/shenbao_jilu.php', requireAuth, handleShenbaoJiluGet);
app.post('/api/shenbao_jilu.php', requireAuth, handleShenbaoJiluPost);
app.get('/shenbao_jilu.php', requireAuth, handleShenbaoJiluGet);
app.post('/shenbao_jilu.php', requireAuth, handleShenbaoJiluPost);

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
        var out = await registerUser(body.username, body.password, regSourceNorm.value);
        if (regGuardKeys) {
          await registerGuard.markRegisterAttemptSuccess(regGuardKeys);
        }
        await recordUserRegistrationAttempt(out.username, true, req, 'register_ok');
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

async function handlePublicMineUi(req, res) {
  try {
    var mineUi = await getMineUiForApi();
    return res.json({ code: 200, data: mineUi });
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
    return res.json({
      code: 200,
      data: {
        android_apk_download_url: android,
        ios_mobileconfig_download_url: ios,
        xianyu_purchase_url: xianyu,
        qq_add_url: qq
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

function healthHandler(req, res) {
  res.json({ ok: true });
}
app.get('/health', healthHandler);
// 与 nginx `location /api/` 代理一致，便于经前端反代做探活
app.get('/api/health', healthHandler);

app.get('/api/public/mine-ui', handlePublicMineUi);
app.get('/api/public/install-packages', handlePublicInstallPackages);
app.get('/api/public/conversion-config', handlePublicConversionConfig);

async function startServer() {
  await initDatabase();
  setupAdmin(app, {
    pool,
    jwt,
    JWT_SECRET,
    crypto,
    ADMIN_PANEL_USER,
    ADMIN_PANEL_PASSWORD,
    verifyPasswordBySaltHash,
    hashPasswordWithSalt,
    getClientIp,
    cityLabelFromIp,
    sanitizeAuditText,
    normalizeUserAgentHeader,
    computeDeviceFingerprint,
    displayUserAgentFromDevice,
    classifyAnalyticsRoute,
    resolveDeviceCityLabel,
    resolvePublicAssetUrl,
    cloneMineUiDefaults,
    getMineUiForAdminForm,
    getMineUiForApi,
    loadMineUiParsed,
    sanitizeMineUiImageRef,
    isDeprecatedMessageHeaderRef,
    getInstallPackageSettingsFromDb,
    sanitizeInstallDownloadUrl,
    getWechatPayQrcodeUrl,
    invalidateWechatPayQrcodeCache,
    sanitizeXianyuPurchaseText,
    USER_TYPE_NORMAL,
    USER_TYPE_TEST,
    isXianyuActivationNote,
    activationSourceChannelLabel,
    registerSourceChannelLabel,
    userChannelAnalysisLabel,
    userLoginReasonLabel,
    formatUserIdCardForAdmin,
    userIdCardLabelForAdmin,
    maskBankCardNo,
    buildUserTaxAvgSalaryMap,
    computeTaxRecordsAvgSalary6m,
    loadTaxRecordChangesForUser,
    mergeUserRiskInfo,
    parseSalaryRangeFilterParam,
    userMatchesSalaryRange,
    normalizeTrackEventKeyFromRoute,
    UPLOAD_DIR
  });
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
