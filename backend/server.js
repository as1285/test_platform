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
  return !s || s === LEGACY_DEFAULT_TAX_ID || s === DEFAULT_TAX_ID_HINT || s === LEGACY_TAX_ID_HINT;
}
/** 环境变量或内置默认；首次写入 app_settings 及库中无配置时使用 */
const TEST_ACCOUNT_COMPANY_NAME_DEFAULT =
  process.env.TEST_ACCOUNT_COMPANY_NAME || '购买+Tangdong 购买++V : Tangdong6832';
const SETTING_KEY_TEST_COMPANY = 'test_account_company_name';
const SETTING_KEY_MINE_UI = 'mine_ui_json';
const SETTING_KEY_ANDROID_APK = 'android_apk_download_url';
const SETTING_KEY_IOS_MOBILECONFIG = 'ios_mobileconfig_download_url';
/** 闲鱼购买等外链，与引导安装一同在后台配置 */
const SETTING_KEY_XIANYU_PURCHASE = 'xianyu_purchase_url';
const SETTING_KEY_WECHAT_PAY_QRCODE = 'wechat_pay_qrcode_url';

const ADMIN_MENU_KEYS = [
  'settings',
  'install-guide',
  'appearance',
  'codes',
  'users',
  'feedback',
  'login-log',
  'analytics',
  'api-analytics',
  'admin-accounts'
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
    message_header: 'message_header.jpg',
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

async function getInstallPackageSettingsFromDb() {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN (?, ?, ?)',
      [SETTING_KEY_ANDROID_APK, SETTING_KEY_IOS_MOBILECONFIG, SETTING_KEY_XIANYU_PURCHASE]
    );
    var map = {};
    rows.forEach(function (r) {
      map[r.setting_key] = r.setting_value;
    });
    var android = map[SETTING_KEY_ANDROID_APK] != null ? String(map[SETTING_KEY_ANDROID_APK]).trim() : '';
    var ios = map[SETTING_KEY_IOS_MOBILECONFIG] != null ? String(map[SETTING_KEY_IOS_MOBILECONFIG]).trim() : '';
    var xianyu =
      map[SETTING_KEY_XIANYU_PURCHASE] != null ? String(map[SETTING_KEY_XIANYU_PURCHASE]).trim() : '';
    return { android: android, ios: ios, xianyu: xianyu };
  } finally {
    conn.release();
  }
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
        if (ok) {
          out[k] = ok;
        }
      }
    });
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
      if (ok) {
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

async function saveRecordInConn(conn, userId, record) {
  const id = record.id != null ? String(record.id) : 'tr_' + Date.now();

  const [existing] = await conn.execute('SELECT id FROM tax_records WHERE id = ?', [id]);

  if (existing.length > 0) {
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

async function batchSaveRecords(userId, records) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const saved = [];
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (!rec || typeof rec !== 'object') {
        throw new Error('第 ' + (i + 1) + ' 条记录无效');
      }
      saved.push(await saveRecordInConn(conn, userId, rec));
    }
    await conn.commit();
    return { saved: saved.length, ids: saved.map(function (x) { return x.id; }) };
  } catch (e) {
    try {
      await conn.rollback();
    } catch (e2) {}
    throw e;
  } finally {
    conn.release();
  }
}

async function deleteRecord(userId, id) {
  const conn = await pool.getConnection();
  await conn.execute('DELETE FROM tax_records WHERE id = ? AND user_id = ?', [id, userId]);
  conn.release();
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
  /** 累计减除费用（基本减除，每月 5000 部分）与累计专项附加扣除（超出 5000 计入减除费用的部分），仅用于展示拆分 */
  let totalBasicDeductionFee = 0;
  let totalSpecialAdditionalFromFee = 0;
  const anchorMonth = month != null && !Number.isNaN(month) ? month : null;

  rows.forEach(function (r) {
    totalIncome += rowPeriodIncome(r);
    totalTaxFree += sumRowMoney(r, 'tax_free_income');
    const df = sumRowMoney(r, 'deduction_fee');
    totalDeductionFee += df;
    totalSpecial += sumRowMoney(r, 'special_deduction');
    totalOther += sumRowMoney(r, 'other_deduction');
    totalDonation += sumRowMoney(r, 'donation_deduction');
    const sub = String(r.income_subtype || '').trim();
    if (sub !== '全年一次性奖金收入') {
      const sadd = Math.max(0, Math.round((df - 5000) * 100) / 100);
      totalSpecialAdditionalFromFee += sadd;
      totalBasicDeductionFee += Math.round((df - sadd) * 100) / 100;
    }
    const m = r.month != null ? parseInt(r.month, 10) : null;
    if (anchorMonth != null && m != null && !Number.isNaN(m) && m < anchorMonth) {
      totalTaxPaidBefore += sumRowMoney(r, 'tax_reported');
    }
  });

  const totalSpecialAdditional = totalSpecialAdditionalFromFee;
  const totalPersonalPension = 0;

  /** 专项附加已并入 deduction_fee 时，不得再单独从应纳税所得额中扣减 total_special_additional */
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
    deduction_fee: formatTaxAmt(rec.deduction_fee, '5000.00'),
    special_deduction: formatTaxAmt(rec.special_deduction, '0.00'),
    other_deduction: formatTaxAmt(rec.other_deduction, '0.00'),
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

function validatePassword(p) {
  if (!p || typeof p !== 'string') return '密码不能为空';
  if (p.length < 1 || p.length > 64) return '密码长度为 1～64 位';
  return null;
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

async function applyActivationCode(username, rawCode) {
  var code = String(rawCode || '').trim().toUpperCase();
  if (!code) {
    throw new Error('请输入激活码');
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      'SELECT id, max_uses, used_count, expires_at FROM activation_codes WHERE code = ? FOR UPDATE',
      [code]
    );
    if (rows.length === 0) {
      await conn.rollback();
      throw new Error('激活码无效');
    }
    var r = rows[0];
    if (r.expires_at && new Date(r.expires_at) < new Date()) {
      await conn.rollback();
      throw new Error('激活码已过期');
    }
    if (Number(r.used_count) >= Number(r.max_uses)) {
      await conn.rollback();
      throw new Error('激活码已用完');
    }
    await conn.execute(
      'UPDATE activation_codes SET used_count = used_count + 1, last_used_at = CURRENT_TIMESTAMP, used_by_username = ? WHERE id = ?',
      [username, r.id]
    );
    await conn.execute('UPDATE users SET account_active = 1 WHERE username = ?', [username]);
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
  return Array.isArray(admin.menus) && admin.menus.indexOf(menuKey) >= 0;
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
async function registerUser(username, password) {
  var u = validateUsername(username);
  if (u) {
    throw new Error(u);
  }
  var p = validatePassword(password);
  if (p) {
    throw new Error(p);
  }
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
    await conn.execute(
      `INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [username, saltHex, hash, displayName, USER_TYPE_NORMAL, password]
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
  conn.release();
  
  if (check !== rec.hash) {
    throw new Error('账号或密码错误');
  }

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

async function handleUserGet(req, res) {
  var action = req.query.action;
  if (action !== 'info' && action !== 'employers' && action !== 'family_members') {
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
        var fmName = String(body.real_name || '').trim();
        var fmRelation = String(body.relation || '').trim();
        var fmIdNo = String(body.id_no || '')
          .replace(/\s/g, '')
          .toUpperCase();
        var fmIdType = String(body.id_type || 'resident').trim() || 'resident';
        var fmIdTypeLabel = String(body.id_type_label || '').trim();
        var fmBirth = String(body.birth_date || '').trim();
        if (!fmName) {
          return res.status(400).json({ code: 400, msg: '请填写姓名' });
        }
        if (!fmRelation) {
          return res.status(400).json({ code: 400, msg: '请选择与我的关系' });
        }
        if (!fmIdNo) {
          return res.status(400).json({ code: 400, msg: '请填写证件号' });
        }
        if (fmIdType === 'resident') {
          if (
            !(
              (fmIdNo.length === 18 && /^\d{17}[\dX]$/.test(fmIdNo)) ||
              (fmIdNo.length === 15 && /^\d{15}$/.test(fmIdNo))
            )
          ) {
            return res.status(400).json({ code: 400, msg: '居民身份证号码格式不正确' });
          }
        }
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
            [fmId, userId, fmName, fmRelation, fmIdType, fmIdTypeLabel || null, fmIdNo, fmBirth || null]
          );
          var familyCount = await syncUserFamilyCount(connFm, userId);
          return res.json({
            code: 200,
            data: {
              success: true,
              member: {
                id: fmId,
                real_name: fmName,
                relation: fmRelation,
                id_type: fmIdType,
                id_type_label: fmIdTypeLabel,
                id_no_masked: maskFamilyMemberIdNo(fmIdNo),
                birth_date: fmBirth
              },
              family_count: familyCount
            }
          });
        } finally {
          connFm.release();
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
    unknown_error: '未知错误'
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
  if (action !== 'list' || userId == null || userId === '') {
    return res.status(400).json({ code: 400, msg: 'action=list and user_id required' });
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

async function handleAuthGet(req, res) {
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
      var out = await registerUser(body.username, body.password);
      out.token = signAccessToken(out);
      return res.json({ code: 200, data: out });
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
    " AND ok = 1 AND ip IS NOT NULL AND TRIM(ip) <> '' UNION ALL SELECT TRIM(ip_last) AS ip_val FROM user_devices WHERE username = " +
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
      'SELECT username, TRIM(ip) AS ip_val FROM user_login_events WHERE ok = 1 AND username IN (' +
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

async function handleAdminUsersDailyConversion(req, res) {
  try {
    var days = parseInt(req.query.days, 10) || 7;
    if (days < 1) days = 1;
    if (days > 30) days = 30;
    var span = days - 1;
    var cnUserDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
    var cnActDay = 'DATE(DATE_ADD(last_used_at, INTERVAL 8 HOUR))';
    var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';

    const conn = await pool.getConnection();
    try {
      var regWhere = cnUserDay + ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY)';
      var regParams = [span];
      var actWhere =
        'last_used_at IS NOT NULL AND used_count > 0 AND ' +
        cnActDay +
        ' >= DATE_SUB(' +
        cnToday +
        ', INTERVAL ? DAY)';
      var actParams = [span];

      if (!req.admin || !req.admin.is_super) {
        regWhere +=
          ' AND EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = users.username AND ac.owner_admin_username = ?)';
        regParams.push(req.admin.username);
        actWhere += ' AND owner_admin_username = ?';
        actParams.push(req.admin.username);
      }

      const [regRows] = await conn.query(
        'SELECT ' + cnUserDay + ' AS d, COUNT(*) AS cnt FROM users WHERE ' + regWhere + ' GROUP BY ' + cnUserDay,
        regParams
      );
      const [actRows] = await conn.query(
        'SELECT ' +
          cnActDay +
          ' AS d, COUNT(DISTINCT used_by_username) AS cnt FROM activation_codes WHERE ' +
          actWhere +
          ' GROUP BY ' +
          cnActDay,
        actParams
      );

      var regMap = {};
      regRows.forEach(function (r) {
        var k = formatDateKey(r.d);
        if (k) regMap[k] = Number(r.cnt) || 0;
      });
      var actMap = {};
      actRows.forEach(function (r) {
        var k = formatDateKey(r.d);
        if (k) actMap[k] = Number(r.cnt) || 0;
      });

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
          rate_pct: rate == null ? null : (Math.round(rate * 1000) / 10).toFixed(1) + '%'
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
          todayRow.rate_pct = (Math.round(todayRow.rate * 1000) / 10).toFixed(1) + '%';
        }
      }

      res.json({
        code: 200,
        data: {
          days: days,
          today: todayRow,
          series: series
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

    let whereClauses = [];
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
    if (!req.admin || !req.admin.is_super) {
      whereClauses.push(
        'EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = users.username AND ac.owner_admin_username = ?)'
      );
      params.push(req.admin.username);
    }

    let whereSql = whereClauses.length > 0 ? ' WHERE ' + whereClauses.join(' AND ') : '';

    const conn = await pool.getConnection();
    const [totalRows] = await conn.execute('SELECT COUNT(*) as count FROM users' + whereSql, params);
    const total = totalRows[0].count;

    const [rows] = await conn.query(`
      SELECT id, username, real_name, tax_id, account_active, banned, user_type,
             last_login_city, created_at, hash, plain_password,
             (SELECT ac.owner_admin_username
              FROM activation_codes ac
              WHERE ac.used_by_username = users.username
                AND ac.owner_admin_username IS NOT NULL
                AND TRIM(ac.owner_admin_username) <> ''
              ORDER BY ac.last_used_at DESC, ac.id DESC
              LIMIT 1) AS upline_admin_username
      FROM users ${whereSql} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}
    `, params);
    var usernamesOnPage = rows.map(function (r) {
      return r.username;
    });
    var riskMaps = await buildUserLoginRiskMaps(conn, usernamesOnPage);
    var avgSalaryMaps = await buildUserTaxAvgSalaryMap(conn, usernamesOnPage);
    conn.release();

    var out = rows.map(function (r) {
      var ut = r.user_type != null ? Number(r.user_type) : USER_TYPE_NORMAL;
      var uname = String(r.username || '');
      var riskInfo = computeUserLoginRisk(riskMaps.ipDistinct[uname] || 0, riskMaps.deviceCnt[uname] || 0);
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
        user_type: ut,
        is_test_account: ut === USER_TYPE_TEST,
        last_login_city: r.last_login_city != null && String(r.last_login_city).trim() !== '' ? String(r.last_login_city).trim() : '',
        upline_admin:
          r.upline_admin_username != null && String(r.upline_admin_username).trim() !== ''
            ? String(r.upline_admin_username).trim()
            : '',
        created_at: r.created_at ? r.created_at.toISOString() : '',
        password: r.plain_password || (r.hash ? '历史账号(密文)' : '—'), // 统一返回明文或提示
        distinct_ip_count: riskInfo.distinct_ip_count,
        device_count: riskInfo.device_count,
        risk: riskInfo.risk,
        risk_messages: riskInfo.risk_messages,
        avg_salary_6m: salInfo.avg_salary_6m,
        avg_salary_6m_label: salInfo.avg_salary_6m_label,
        salary_month_count: salInfo.salary_month_count
      };
    });
    res.json({ code: 200, data: { users: out, total: total, page: page, limit: limit } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminIssueCode(req, res) {
  try {
    var maxUses = 1;
    var plainCode = crypto.randomBytes(16).toString('hex').toUpperCase();
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

async function handleAdminCodes(req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 10;
    var qOwnerAdmin = req.query.owner_admin != null ? String(req.query.owner_admin).trim() : '';
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    var offset = (page - 1) * limit;

    const conn = await pool.getConnection();
    var whereSql = '';
    var params = [];
    if (!req.admin || !req.admin.is_super) {
      whereSql = ' WHERE owner_admin_username = ?';
      params.push(req.admin.username);
    } else if (qOwnerAdmin) {
      whereSql = ' WHERE owner_admin_username LIKE ?';
      params.push('%' + qOwnerAdmin + '%');
    }
    const [totalRows] = await conn.execute(
      'SELECT COUNT(*) as count FROM activation_codes' + whereSql,
      params
    );
    const total = totalRows[0].count;

    var orderSql =
      req.admin && req.admin.is_super && !qOwnerAdmin
        ? ' ORDER BY id DESC'
        : qOwnerAdmin
          ? ' ORDER BY COALESCE(NULLIF(TRIM(owner_admin_username), \'\'), \'—\') ASC, id DESC'
          : ' ORDER BY id DESC';
    const [rows] = await conn.query(
      `SELECT id, code, max_uses, used_count, expires_at, note, created_at, last_used_at, used_by_username, owner_admin_username
       FROM activation_codes ${whereSql}${orderSql}
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    conn.release();
    var out = rows.map(function (r) {
      return {
        id: r.id,
        code: r.code,
        max_uses: r.max_uses,
        used_count: r.used_count,
        expires_at: r.expires_at ? r.expires_at.toISOString() : null,
        note: r.note,
        created_at: r.created_at ? r.created_at.toISOString() : '',
        last_used_at: r.last_used_at ? r.last_used_at.toISOString() : null,
        used_by_username:
          r.used_by_username != null && String(r.used_by_username).trim() !== ''
            ? String(r.used_by_username).trim()
            : null,
        owner_admin_username:
          r.owner_admin_username != null && String(r.owner_admin_username).trim() !== ''
            ? String(r.owner_admin_username).trim()
            : null
      };
    });
    res.json({ code: 200, data: { codes: out, total: total, page: page, limit: limit } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
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

async function handleAdminUserType(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  var ut =
    body.user_type === 1 || body.user_type === '1' || body.user_type === true ? USER_TYPE_TEST : USER_TYPE_NORMAL;
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
    await conn.execute('UPDATE users SET user_type = ? WHERE username = ?', [ut, target]);
    conn.release();
    return res.json({ code: 200, data: { username: target, user_type: ut } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminSettingsGet(req, res) {
  try {
    var name = await getTestAccountCompanyName();
    var mineUi = await getMineUiForAdminForm();
    var installRaw = await getInstallPackageSettingsFromDb();
    var qrRef = await getWechatPayQrcodeUrl();
    return res.json({
      code: 200,
      data: {
        test_account_company_name: name,
        mine_ui: mineUi,
        android_apk_download_url: installRaw.android,
        ios_mobileconfig_download_url: installRaw.ios,
        xianyu_purchase_url: installRaw.xianyu,
        wechat_pay_qrcode_url: qrRef,
        wechat_pay_qrcode_display_url: resolvePublicAssetUrl(qrRef)
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function handleAdminSettingsPost(req, res) {
  var body = req.body || {};
  var hasCompany = Object.prototype.hasOwnProperty.call(body, 'test_account_company_name');
  var hasMineUi = body.mine_ui != null && typeof body.mine_ui === 'object';
  var hasAndroid = Object.prototype.hasOwnProperty.call(body, 'android_apk_download_url');
  var hasIos = Object.prototype.hasOwnProperty.call(body, 'ios_mobileconfig_download_url');
  var hasXianyu = Object.prototype.hasOwnProperty.call(body, 'xianyu_purchase_url');
  var hasWechatPayQr = Object.prototype.hasOwnProperty.call(body, 'wechat_pay_qrcode_url');
  if (!hasCompany && !hasMineUi && !hasAndroid && !hasIos && !hasXianyu && !hasWechatPayQr) {
    return res.status(400).json({
      code: 400,
      msg:
        '请提供 test_account_company_name、mine_ui、安装包下载地址、闲鱼购买链接或微信收款码（wechat_pay_qrcode_url）'
    });
  }

  if (hasCompany) {
    var name0 = body.test_account_company_name != null ? String(body.test_account_company_name).trim() : '';
    if (!name0) {
      return res.status(400).json({ code: 400, msg: '测试账号公司名称不能为空' });
    }
    if (name0.length > 500) {
      return res.status(400).json({ code: 400, msg: '名称过长（最多 500 字）' });
    }
  }

  const conn = await pool.getConnection();
  try {
    if (hasCompany) {
      var name = body.test_account_company_name != null ? String(body.test_account_company_name).trim() : '';
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_TEST_COMPANY, name]
      );
      invalidateTestCompanyNameCache();
    }

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
          var ok = sanitizeMineUiImageRef(String(incoming[k]).trim());
          if (ok) {
            merged[k] = ok;
          }
        }
      });
      MINE_UI_VIDEO_KEYS.forEach(function (k) {
        if (incoming[k] != null && String(incoming[k]).trim() !== '') {
          var ok = sanitizeMineUiImageRef(String(incoming[k]).trim());
          if (ok) {
            merged[k] = ok;
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
      var rawX = body.xianyu_purchase_url;
      var okX = sanitizeInstallDownloadUrl(rawX);
      if (rawX != null && String(rawX).trim() !== '' && !okX) {
        return res.status(400).json({
          code: 400,
          msg: '闲鱼购买链接无效（请使用 http 或 https 完整链接）'
        });
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_XIANYU_PURCHASE, okX]
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

    var outData = { success: true };
    outData.test_account_company_name = await getTestAccountCompanyName();
    outData.mine_ui = await getMineUiForAdminForm();
    var installAfter = await getInstallPackageSettingsFromDb();
    outData.android_apk_download_url = installAfter.android;
    outData.ios_mobileconfig_download_url = installAfter.ios;
    outData.xianyu_purchase_url = installAfter.xianyu;
    var qrAfter = await getWechatPayQrcodeUrl();
    outData.wechat_pay_qrcode_url = qrAfter;
    outData.wechat_pay_qrcode_display_url = resolvePublicAssetUrl(qrAfter);
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

async function handlePublicInstallPackages(req, res) {
  try {
    var raw = await getInstallPackageSettingsFromDb();
    var android = sanitizeInstallDownloadUrl(raw.android);
    var ios = sanitizeInstallDownloadUrl(raw.ios);
    var xianyu = sanitizeInstallDownloadUrl(raw.xianyu);
    return res.json({
      code: 200,
      data: {
        android_apk_download_url: android,
        ios_mobileconfig_download_url: ios,
        xianyu_purchase_url: xianyu
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
        `SELECT id, year, month, income_type, income_subtype, company_name, income, tax_reported, tax_period, report_date, created_at
         FROM tax_records
         WHERE user_id = ?
         ORDER BY year DESC, month DESC, id DESC
         LIMIT 200`,
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
        `SELECT page_path, MAX(created_at) AS last_entered_at
         FROM user_page_events
         WHERE username = ?
         GROUP BY page_path
         ORDER BY last_entered_at DESC
         LIMIT 120`,
        [username]
      );
      const [issueRows] = await conn.execute(
        `SELECT id, apply_time, period_start, period_end, record_no, scope, status, query_code, created_at, updated_at
         FROM tax_issue_applications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 80`,
        [username]
      );
      var out = rows.map(function (r) {
        return {
          id: r.id,
          year: r.year != null ? Number(r.year) : null,
          month: r.month != null ? Number(r.month) : null,
          income_type: r.income_type != null ? String(r.income_type) : '',
          income_subtype: r.income_subtype != null ? String(r.income_subtype) : '',
          company_name: r.company_name != null ? String(r.company_name) : '',
          income: r.income != null ? String(r.income) : '0.00',
          tax_reported: r.tax_reported != null ? String(r.tax_reported) : '0.00',
          tax_period: r.tax_period != null ? String(r.tax_period) : '',
          report_date: r.report_date != null ? String(r.report_date) : '',
          created_at: r.created_at ? r.created_at.toISOString() : ''
        };
      });
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
      return res.json({
        code: 200,
        data: {
          records: out,
          devices: devOut,
          recent_pages: pageOut,
          issue_applications: issueOut,
          avg_salary_6m: salaryInfo.avg_salary_6m,
          avg_salary_6m_label: salaryInfo.avg_salary_6m_label,
          salary_month_count: salaryInfo.salary_month_count
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

/** 永久删除用户及其任职受雇、税务记录、消息（不可恢复） */
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
    await conn.beginTransaction();
    await conn.execute('DELETE FROM tax_records WHERE user_id = ?', [target]);
    await conn.execute('DELETE FROM tax_issue_applications WHERE user_id = ?', [target]);
    await conn.execute('DELETE FROM employers WHERE user_id = ?', [target]);
    await conn.execute('DELETE FROM messages WHERE user_id = ?', [target]);
    await conn.execute('DELETE FROM user_daily_activity WHERE username = ?', [target]);
    await conn.execute('DELETE FROM user_login_events WHERE username = ?', [target]);
    await conn.execute('DELETE FROM user_devices WHERE username = ?', [target]);
    await conn.execute('DELETE FROM user_page_events WHERE username = ?', [target]);
    await conn.execute('DELETE FROM users WHERE username = ?', [target]);
    await conn.commit();
    conn.release();
    return res.json({ code: 200, data: { username: target, deleted: true } });
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

function sortDeviceStatList(map) {
  var arr = Object.keys(map).map(function (k) {
    var o = map[k];
    return {
      key: k,
      label: o.label,
      icon_key: o.icon_key,
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
      rows.forEach(function (r) {
        var c = classifyUserDeviceRow(r.user_agent_short, r.device_detail_json);
        var ok = c.os_key;
        var family = DEVICE_STATS_OS_FAMILY_LABEL[ok] || DEVICE_STATS_OS_FAMILY_LABEL.other;
        var ver = c.os_version ? String(c.os_version).trim() : '';
        var osLabel = ver ? family + ' ' + ver : family;
        var osAggKey = ok + '\0' + (ver || '');
        if (!osMap[osAggKey]) {
          osMap[osAggKey] = {
            label: osLabel,
            icon_key: DEVICE_STATS_OS_ICON_KEY[ok] || 'other',
            count: 0
          };
        }
        osMap[osAggKey].count += 1;

        var mk = c.model_key;
        if (!modelMap[mk]) {
          modelMap[mk] = {
            label: c.model_label,
            icon_key: DEVICE_STATS_OS_ICON_KEY[c.os_key] || 'other',
            count: 0
          };
        }
        modelMap[mk].count += 1;
      });
      return res.json({
        code: 200,
        data: {
          total_devices: rows.length,
          by_os: sortDeviceStatList(osMap),
          by_model: sortDeviceStatList(modelMap)
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
         ORDER BY total DESC LIMIT 300`,
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
           AND (
             route_key LIKE 'EVENT %'
             OR route_key LIKE '%#track\\_%'
           )
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
        'SELECT username, ok, reason, ip, city, user_agent, created_at FROM user_login_events ' +
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
            return {
              username: String(r.username),
              ok: !!(r.ok === 1 || r.ok === true),
              reason_key: r.reason != null ? String(r.reason) : '',
              reason_label: userLoginReasonLabel(r.reason),
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
    var where = '';
    var params = [];
    if (typeFilter === 'bug' || typeFilter === 'suggestion') {
      where = ' WHERE feedback_type = ? ';
      params.push(typeFilter);
    }
    const conn = await pool.getConnection();
    try {
      const [cntRows] = await conn.execute(
        'SELECT COUNT(*) AS c FROM user_feedback' + where,
        params
      );
      var total = cntRows.length ? Number(cntRows[0].c) : 0;
      var totalPages = Math.ceil(total / limit);
      if (total > 0 && totalPages < 1) {
        totalPages = 1;
      }
      const [rows] = await conn.query(
        `SELECT id, user_id, real_name_snapshot, feedback_type, content, admin_reply, replied_at, replied_by, created_at
         FROM user_feedback ${where} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`,
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
app.get('/api/admin/users', requireAdminAuth, requireAdminMenu('users'), handleAdminUsers);
app.get('/api/admin/users/daily-conversion', requireAdminAuth, requireAdminMenu('users'), handleAdminUsersDailyConversion);
app.get('/api/admin/user-tax-records', requireAdminAuth, requireAdminMenu('users'), handleAdminUserTaxRecords);
app.post('/api/admin/issue-code', requireAdminAuth, requireAdminMenu('codes'), handleAdminIssueCode);
app.get('/api/admin/codes', requireAdminAuth, requireAdminMenu('codes'), handleAdminCodes);
app.post('/api/admin/ban', requireAdminAuth, requireAdminMenu('users'), handleAdminBan);
app.post('/api/admin/user-type', requireAdminAuth, requireAdminMenu('users'), handleAdminUserType);
app.post('/api/admin/user-delete', requireAdminAuth, requireAdminMenu('users'), handleAdminDeleteUser);
app.get('/api/admin/analytics/overview', requireAdminAuth, requireAdminMenu('analytics'), handleAdminAnalyticsOverview);
app.get('/api/admin/analytics/api-stats', requireAdminAuth, requireAdminMenu('api-analytics'), handleAdminAnalyticsApi);
app.get('/api/admin/analytics/events', requireAdminAuth, requireAdminMenu('analytics'), handleAdminAnalyticsEvents);
app.get('/api/admin/analytics/devices', requireAdminAuth, requireAdminMenu('analytics'), handleAdminAnalyticsDevices);
app.get('/api/admin/analytics/device-stats', requireAdminAuth, requireAdminMenu('analytics'), handleAdminAnalyticsDeviceStats);
app.get('/api/admin/analytics/login-recent', requireAdminAuth, requireAdminMenu('login-log'), handleAdminAnalyticsLoginRecent);
app.get('/api/admin/admin-login-logs', requireAdminAuth, requireAdminMenu('login-log'), handleAdminLoginLogs);
app.get('/api/admin/admin-operation-logs', requireAdminAuth, requireAdminMenu('login-log'), handleAdminOperationLogs);
app.get('/api/admin/feedback', requireAdminAuth, requireAdminMenu('feedback'), handleAdminFeedbackList);
app.post('/api/admin/feedback/reply', requireAdminAuth, requireAdminMenu('feedback'), handleAdminFeedbackReply);
app.get('/api/admin/accounts', requireAdminAuth, handleAdminAccountsList);
app.post('/api/admin/accounts/create', requireAdminAuth, handleAdminAccountsCreate);
app.post('/api/admin/accounts/update', requireAdminAuth, handleAdminAccountsUpdate);
app.post('/api/admin/accounts/delete', requireAdminAuth, handleAdminAccountsDelete);

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
  app.listen(PORT, '0.0.0.0', function () {
    console.log('api listening on ' + PORT + ', database: ' + DB_DATABASE);
  });
}

startServer().catch(console.error);
