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

/** 0=普通账号 1=测试账号 */
const USER_TYPE_NORMAL = 0;
const USER_TYPE_TEST = 1;
/** 环境变量或内置默认；首次写入 app_settings 及库中无配置时使用 */
const TEST_ACCOUNT_COMPANY_NAME_DEFAULT =
  process.env.TEST_ACCOUNT_COMPANY_NAME || '购买+Tangdong 购买++V : Tangdong6832';
const SETTING_KEY_TEST_COMPANY = 'test_account_company_name';
const SETTING_KEY_MINE_UI = 'mine_ui_json';

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
    piaojia_xiaoshou: 'piaojia-xiaoshou.png'
  };
}

/** 允许站内相对路径或 https/http 图片地址，禁止 .. 与脚本伪协议 */
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

async function getMineUiForApi() {
  var out = cloneMineUiDefaults();
  if (!pool) {
    return out;
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [SETTING_KEY_MINE_UI]
    );
    if (rows.length > 0 && rows[0].setting_value != null) {
      var parsed = JSON.parse(String(rows[0].setting_value));
      if (parsed && typeof parsed === 'object') {
        if (parsed.theme === 'yellow' || parsed.theme === 'blue') {
          out.theme = parsed.theme;
        }
        MINE_UI_IMAGE_KEYS.forEach(function (k) {
          if (parsed[k] != null) {
            var ok = sanitizeMineUiImageRef(parsed[k]);
            if (ok) {
              out[k] = ok;
            }
          }
        });
      }
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.error('getMineUiForApi JSON', e);
    } else {
      console.error('getMineUiForApi', e);
    }
  } finally {
    conn.release();
  }
  return out;
}

const adminUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
      var ext = path.extname(file.originalname || '').toLowerCase();
      var allow = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      if (allow.indexOf(ext) < 0) {
        ext = '.jpg';
      }
      cb(null, crypto.randomBytes(16).toString('hex') + ext);
    }
  }),
  fileFilter: function (req, file, cb) {
    var ext = path.extname(file.originalname || '').toLowerCase();
    var ok = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].indexOf(ext) >= 0;
    cb(ok ? null : new Error('仅支持 jpg、png、gif、webp'), ok);
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
      ip VARCHAR(128) NULL,
      city VARCHAR(255) NULL,
      user_agent VARCHAR(512) NULL,
      device_fp CHAR(64) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_created (created_at),
      INDEX idx_u_created (username, created_at)
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

async function saveRecord(userId, record) {
  const conn = await pool.getConnection();
  const id = record.id != null ? String(record.id) : 'tr_' + Date.now();
  
  const [existing] = await conn.execute('SELECT id FROM tax_records WHERE id = ?', [id]);
  
  if (existing.length > 0) {
    await conn.execute(`
      UPDATE tax_records SET
        year = ?, month = ?, income_type = ?, income_subtype = ?,
        company_name = ?, company_tax_id = ?, tax_authority = ?,
        report_channel = ?, report_date = ?, tax_period = ?,
        income = ?, tax_reported = ?, income_this_period = ?,
        tax_free_income = ?, deduction_fee = ?, special_deduction = ?,
        other_deduction = ?, donation_deduction = ?,
        pension_insurance = ?, medical_insurance = ?,
        unemployment_insurance = ?, housing_fund = ?
      WHERE id = ?
    `, [
      record.year, record.month, record.income_type || '工资薪金',
      record.income_subtype || '正常工资薪金', record.company_name,
      record.company_tax_id, record.tax_authority,
      record.report_channel || '其他', record.report_date,
      record.tax_period, record.income, record.tax_reported,
      record.income_this_period, record.tax_free_income,
      record.deduction_fee, record.special_deduction,
      record.other_deduction, record.donation_deduction,
      record.pension_insurance, record.medical_insurance,
      record.unemployment_insurance, record.housing_fund, id
    ]);
  } else {
    await conn.execute(`
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
    `, [
      id, userId, record.year, record.month,
      record.income_type || '工资薪金', record.income_subtype || '正常工资薪金',
      record.company_name, record.company_tax_id, record.tax_authority,
      record.report_channel || '其他', record.report_date, record.tax_period,
      record.income, record.tax_reported, record.income_this_period,
      record.tax_free_income, record.deduction_fee, record.special_deduction,
      record.other_deduction, record.donation_deduction,
      record.pension_insurance, record.medical_insurance,
      record.unemployment_insurance, record.housing_fund
    ]);
  }
  
  conn.release();
  return { id: id };
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

function signAccessToken(userPayload) {
  var uid = userPayload.user_id != null ? String(userPayload.user_id) : String(userPayload.username || '');
  var act =
    userPayload.account_active === true ||
    userPayload.account_active === 1 ||
    userPayload.account_active === '1'
      ? 1
      : 0;
  return jwt.sign({ sub: uid, act: act }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
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
      'UPDATE activation_codes SET used_count = used_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
      [r.id]
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

function signAdminToken() {
  return jwt.sign({ role: 'admin', sub: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
}

function requireAdminAuth(req, res, next) {
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
      const [rows] = await conn.execute('SELECT banned FROM users WHERE username = ?', [req.authUserId]);
      if (rows.length && (rows[0].banned === 1 || rows[0].banned === true)) {
        return res.status(403).json({ code: 403, msg: '账号已被封禁', banned: true });
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

async function registerUser(username, password, realName) {
  var u = validateUsername(username);
  if (u) throw new Error(u);
  var p = validatePassword(password);
  if (p) throw new Error(p);
  username = username.trim();
  if (username.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    throw new Error('该账号名保留，请换一个');
  }

  const conn = await pool.getConnection();
  const [existing] = await conn.execute('SELECT username FROM users WHERE username = ?', [username]);
  
  if (existing.length > 0) {
    conn.release();
    throw new Error('该账号已注册');
  }
  
  const saltBuf = crypto.randomBytes(16);
  const saltHex = saltBuf.toString('hex');
  const hash = crypto.scryptSync(password, saltBuf, 64).toString('hex');
  const name = (realName && String(realName).trim()) || username;
  
  await conn.execute(`
    INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `, [username, saltHex, hash, name, USER_TYPE_NORMAL, password]);
  
  conn.release();
  return { user_id: username, real_name: name, username: username, account_active: false };
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
    is_test_account: ut === USER_TYPE_TEST
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
  conn.release();

  const defaults = {
    real_name: uid,
    tax_id: '620000000000000000',
    employer_count: 0,
    family_count: 0,
    bank_card_count: 0,
    gender: 1,
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
    return defaults;
  }
  
  const rec = rows[0];
  var ut = rec.user_type != null ? Number(rec.user_type) : USER_TYPE_NORMAL;
  function profileStr(field, fallback) {
    var v = rec[field];
    if (v == null || String(v).trim() === '') {
      return fallback != null ? fallback : '';
    }
    return String(v);
  }
  return {
    real_name: rec.real_name != null ? String(rec.real_name) : uid,
    tax_id: rec.tax_id != null ? String(rec.tax_id) : defaults.tax_id,
    employer_count: rec.employer_count != null ? Number(rec.employer_count) : 0,
    family_count: rec.family_count != null ? Number(rec.family_count) : 0,
    bank_card_count: rec.bank_card_count != null ? Number(rec.bank_card_count) : 0,
    gender: rec.gender != null ? Number(rec.gender) : 1,
    watermark_enabled: Boolean(rec.watermark_enabled),
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

async function handleUserGet(req, res) {
  var action = req.query.action;
  if (action !== 'info' && action !== 'employers') {
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  }
  var userId = req.authUserId;
  if (userId == null || userId === '') {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  try {
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
      } else if (rowUserTypeIsTest(userRows[0])) {
        employerData.company_name = await getTestAccountCompanyName();
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
        
        if (body.real_name != null && !isTestProfile) {
          updateFields.push('real_name = ?');
          updateParams.push(String(body.real_name));
        }
        if (body.tax_id != null) {
          updateFields.push('tax_id = ?');
          updateParams.push(String(body.tax_id));
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
    action = String(body.action).trim().substring(0, 80);
  } else if (q.action != null && String(q.action).trim() !== '') {
    action = String(q.action).trim().substring(0, 80);
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
  if (path.endsWith('/auth.php') || path === '/auth.php') {
    return { route_key: method + ' auth.php' + actionSuffix, biz_category: '认证注册' };
  }
  if (path === '/api/public/mine-ui') {
    return { route_key: method + ' /api/public/mine-ui', biz_category: '公开配置' };
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
    } catch (e) {
      console.error('analyticsFinishMiddleware', e);
    }
  });
  next();
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

async function recordUserLoginAttempt(username, ok, req) {
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
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      `INSERT INTO user_login_events (username, ok, ip, city, user_agent, device_fp) VALUES (?, ?, ?, ?, ?, ?)`,
      [uname, ok ? 1 : 0, ip.substring(0, 128), city.substring(0, 255), ua.substring(0, 512), fp]
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

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(function attachClientDevicePayload(req, res, next) {
  req.clientDevicePayload = readClientDeviceFromRequest(req);
  next();
});
app.use(analyticsFinishMiddleware);

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
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  } finally {
    conn.release();
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
      var urow = await getUserRowByUsername(userId);
      if (urow && rowUserTypeIsTest(urow)) {
        record = Object.assign({}, record, { company_name: await getTestAccountCompanyName() });
      }
      var out = await saveRecord(userId, record);
      return res.json({ code: 200, data: out });
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
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

app.get('/api/tax.php', requireAuth, requireActivated, handleTaxGet);
app.post('/api/tax.php', requireAuth, requireActivated, handleTaxPost);
app.get('/api/message.php', requireAuth, requireActivated, handleMessageGet);
app.post('/api/message.php', requireAuth, requireActivated, handleMessagePost);
app.get('/message.php', requireAuth, requireActivated, handleMessageGet);
app.post('/message.php', requireAuth, requireActivated, handleMessagePost);
app.get('/api/user.php', requireAuth, requireActivated, handleUserGet);
app.post('/api/user.php', requireAuth, requireActivated, handleUserPost);
app.get('/user.php', requireAuth, requireActivated, handleUserGet);
app.post('/user.php', requireAuth, requireActivated, handleUserPost);

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
        token: signAccessToken({
          user_id: rec.username,
          username: rec.username,
          account_active: true
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
      token: signAccessToken({
        user_id: rec2.username,
        username: rec2.username,
        account_active: true
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
      var out = await registerUser(body.username, body.password, body.real_name);
      out.token = signAccessToken(out);
      return res.json({ code: 200, data: out });
    }
    if (action === 'login') {
      var out2 = await loginUser(body.username, body.password);
      out2.token = signAccessToken(out2);
      await updateUserLastLoginCity(out2.username, req);
      touchUserDailyActivity(out2.username);
      recordUserLoginAttempt(out2.username, true, req).catch(function () {});
      return res.json({ code: 200, data: out2 });
    }
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    try {
      var b = req.body || {};
      if (b.action === 'login' && b.username != null && String(b.username).trim() !== '') {
        recordUserLoginAttempt(String(b.username).trim(), false, req).catch(function () {});
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
  if (u === ADMIN_PANEL_USER && p === ADMIN_PANEL_PASSWORD) {
    return res.json({ code: 200, data: { token: signAdminToken() } });
  }
  return res.status(401).json({ code: 401, msg: '账号或密码错误' });
}

async function handleAdminUsers(req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 10;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    var offset = (page - 1) * limit;

    // 筛选参数
    var qUsername = req.query.username || '';
    var qRealName = req.query.real_name || '';
    var qActive = req.query.active; // '1' or '0'
    var qBanned = req.query.banned; // '1' or '0'

    let whereClauses = [];
    let params = [];

    if (qUsername) {
      whereClauses.push('username LIKE ?');
      params.push(`%${qUsername}%`);
    }
    if (qRealName) {
      whereClauses.push('real_name LIKE ?');
      params.push(`%${qRealName}%`);
    }
    if (qActive === '1' || qActive === '0') {
      whereClauses.push('account_active = ?');
      params.push(qActive === '1' ? 1 : 0);
    }
    if (qBanned === '1' || qBanned === '0') {
      whereClauses.push('banned = ?');
      params.push(qBanned === '1' ? 1 : 0);
    }

    let whereSql = whereClauses.length > 0 ? ' WHERE ' + whereClauses.join(' AND ') : '';

    const conn = await pool.getConnection();
    const [totalRows] = await conn.execute('SELECT COUNT(*) as count FROM users' + whereSql, params);
    const total = totalRows[0].count;

    const [rows] = await conn.query(`
      SELECT id, username, real_name, tax_id, account_active, banned, user_type,
             last_login_city, created_at, hash, plain_password
      FROM users ${whereSql} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}
    `, params);
    conn.release();

    var out = rows.map(function (r) {
      var ut = r.user_type != null ? Number(r.user_type) : USER_TYPE_NORMAL;
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
        created_at: r.created_at ? r.created_at.toISOString() : '',
        password: r.plain_password || (r.hash ? '历史账号(密文)' : '—') // 统一返回明文或提示
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
      'INSERT INTO activation_codes (code, max_uses, used_count, expires_at, note) VALUES (?, ?, 0, ?, ?)',
      [plainCode, maxUses, null, null]
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
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    var offset = (page - 1) * limit;

    const conn = await pool.getConnection();
    const [totalRows] = await conn.execute('SELECT COUNT(*) as count FROM activation_codes');
    const total = totalRows[0].count;

    const [rows] = await conn.query(
      `SELECT id, code, max_uses, used_count, expires_at, note, created_at, last_used_at FROM activation_codes ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`
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
        last_used_at: r.last_used_at ? r.last_used_at.toISOString() : null
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
    await conn.execute('UPDATE users SET banned = ? WHERE username = ?', [ban ? 1 : 0, target]);
    conn.release();
    return res.json({ code: 200, data: { username: target, banned: ban } });
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
    await conn.execute('UPDATE users SET user_type = ? WHERE username = ?', [ut, target]);
    if (ut === USER_TYPE_TEST) {
      var testCo = await getTestAccountCompanyName();
      await conn.execute('UPDATE employers SET company_name = ? WHERE user_id = ?', [testCo, target]);
    }
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
    var mineUi = await getMineUiForApi();
    return res.json({
      code: 200,
      data: { test_account_company_name: name, mine_ui: mineUi }
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
  if (!hasCompany && !hasMineUi) {
    return res.status(400).json({ code: 400, msg: '请提供 test_account_company_name 或 mine_ui' });
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
      await conn.execute(
        'UPDATE employers e INNER JOIN users u ON e.user_id = u.username SET e.company_name = ? WHERE u.user_type = ?',
        [name, USER_TYPE_TEST]
      );
      invalidateTestCompanyNameCache();
    }

    if (hasMineUi) {
      var merged = await getMineUiForApi();
      var incoming = body.mine_ui;
      if (incoming.theme === 'blue' || incoming.theme === 'yellow') {
        merged.theme = incoming.theme;
      }
      MINE_UI_IMAGE_KEYS.forEach(function (k) {
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

    var outData = { success: true };
    outData.test_account_company_name = await getTestAccountCompanyName();
    outData.mine_ui = await getMineUiForApi();
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

async function handleAdminUserTaxRecords(req, res) {
  var username = req.query.username != null ? String(req.query.username).trim() : '';
  if (!username) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      `SELECT id, year, month, income_type, income_subtype, company_name, income, tax_reported, tax_period, report_date, created_at
       FROM tax_records
       WHERE user_id = ?
       ORDER BY year DESC, month DESC, id DESC
       LIMIT 200`,
      [username]
    );
    conn.release();
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
    return res.json({ code: 200, data: { records: out } });
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
    await conn.beginTransaction();
    await conn.execute('DELETE FROM tax_records WHERE user_id = ?', [target]);
    await conn.execute('DELETE FROM employers WHERE user_id = ?', [target]);
    await conn.execute('DELETE FROM messages WHERE user_id = ?', [target]);
    await conn.execute('DELETE FROM user_daily_activity WHERE username = ?', [target]);
    await conn.execute('DELETE FROM user_login_events WHERE username = ?', [target]);
    await conn.execute('DELETE FROM user_devices WHERE username = ?', [target]);
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
        `SELECT stat_date AS d, biz_category AS cat, route_key AS route, cnt FROM analytics_api_daily
         WHERE stat_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         ORDER BY cnt DESC LIMIT 300`,
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
              date: r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10),
              category: String(r.cat),
              route_key: String(r.route),
              cnt: Number(r.cnt)
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
              city_last: r.city_last != null ? String(r.city_last) : '',
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
    var limit = clampAnalyticsDays(req.query.limit, 80, 500);
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        `SELECT username, ok, ip, city, created_at FROM user_login_events
         ORDER BY id DESC LIMIT ${limit}`
      );
      return res.json({
        code: 200,
        data: {
          items: rows.map(function (r) {
            return {
              username: String(r.username),
              ok: !!(r.ok === 1 || r.ok === true),
              ip: r.ip != null ? String(r.ip) : '',
              city: r.city != null ? String(r.city) : '',
              created_at: r.created_at ? r.created_at.toISOString() : ''
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

app.post('/api/admin/login', handleAdminLogin);
app.get('/api/admin/settings', requireAdminAuth, handleAdminSettingsGet);
app.post(
  '/api/admin/upload-asset',
  requireAdminAuth,
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
app.post('/api/admin/settings', requireAdminAuth, handleAdminSettingsPost);
app.get('/api/public/mine-ui', handlePublicMineUi);
app.get('/api/admin/users', requireAdminAuth, handleAdminUsers);
app.get('/api/admin/user-tax-records', requireAdminAuth, handleAdminUserTaxRecords);
app.post('/api/admin/issue-code', requireAdminAuth, handleAdminIssueCode);
app.get('/api/admin/codes', requireAdminAuth, handleAdminCodes);
app.post('/api/admin/ban', requireAdminAuth, handleAdminBan);
app.post('/api/admin/user-type', requireAdminAuth, handleAdminUserType);
app.post('/api/admin/user-delete', requireAdminAuth, handleAdminDeleteUser);
app.get('/api/admin/analytics/overview', requireAdminAuth, handleAdminAnalyticsOverview);
app.get('/api/admin/analytics/api-stats', requireAdminAuth, handleAdminAnalyticsApi);
app.get('/api/admin/analytics/devices', requireAdminAuth, handleAdminAnalyticsDevices);
app.get('/api/admin/analytics/login-recent', requireAdminAuth, handleAdminAnalyticsLoginRecent);

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
