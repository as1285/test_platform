'use strict';

const registerGuard = require('../register-guard');

/**
 * 管理后台 API 处理器
 * 依赖由 initAdminHandlers(deps) 注入到模块作用域
 */
var pool, jwt, JWT_SECRET, crypto, ADMIN_MENU_KEYS, ADMIN_PANEL_USER, ADMIN_PANEL_PASSWORD;
var verifyPasswordBySaltHash, hashPasswordWithSalt, getClientIp, cityLabelFromIp, sanitizeAuditText;
var normalizeUserAgentHeader, computeDeviceFingerprint, displayUserAgentFromDevice, classifyAnalyticsRoute;
var signAdminToken, loadAdminAccountByUsername, normalizeAdminMenuList, recordAdminLoginAttempt;
var adminCanAccessTargetUser, resolveDeviceCityLabel, resolvePublicAssetUrl;
var cloneMineUiDefaults, getMineUiForAdminForm, getMineUiForApi, loadMineUiParsed, sanitizeMineUiImageRef;
var isDeprecatedMessageHeaderRef, getInstallPackageSettingsFromDb, sanitizeInstallDownloadUrl;
var getWechatPayQrcodeUrl, invalidateWechatPayQrcodeCache, sanitizeXianyuPurchaseText;
var USER_TYPE_NORMAL, USER_TYPE_TEST, isXianyuActivationNote, activationSourceChannelLabel;
var registerSourceChannelLabel, userChannelAnalysisLabel, userLoginReasonLabel;
var formatUserIdCardForAdmin, userIdCardLabelForAdmin, maskBankCardNo;
var buildUserTaxAvgSalaryMap, computeTaxRecordsAvgSalary6m, loadTaxRecordChangesForUser;
var mergeUserRiskInfo, parseSalaryRangeFilterParam, userMatchesSalaryRange;
var parseSalaryRangeFilterParam, userMatchesSalaryRange, normalizeTrackEventKeyFromRoute;

function initAdminHandlers(deps) {
  pool = deps.pool;
  jwt = deps.jwt;
  JWT_SECRET = deps.JWT_SECRET;
  crypto = deps.crypto;
  ADMIN_MENU_KEYS = deps.ADMIN_MENU_KEYS;
  ADMIN_PANEL_USER = deps.ADMIN_PANEL_USER;
  ADMIN_PANEL_PASSWORD = deps.ADMIN_PANEL_PASSWORD;
  verifyPasswordBySaltHash = deps.verifyPasswordBySaltHash;
  hashPasswordWithSalt = deps.hashPasswordWithSalt;
  getClientIp = deps.getClientIp;
  cityLabelFromIp = deps.cityLabelFromIp;
  sanitizeAuditText = deps.sanitizeAuditText;
  normalizeUserAgentHeader = deps.normalizeUserAgentHeader;
  computeDeviceFingerprint = deps.computeDeviceFingerprint;
  displayUserAgentFromDevice = deps.displayUserAgentFromDevice;
  classifyAnalyticsRoute = deps.classifyAnalyticsRoute;
  signAdminToken = deps.signAdminToken;
  loadAdminAccountByUsername = deps.loadAdminAccountByUsername;
  normalizeAdminMenuList = deps.normalizeAdminMenuList;
  recordAdminLoginAttempt = deps.recordAdminLoginAttempt;
  adminCanAccessTargetUser = deps.adminCanAccessTargetUser;
  resolveDeviceCityLabel = deps.resolveDeviceCityLabel;
  resolvePublicAssetUrl = deps.resolvePublicAssetUrl;
  cloneMineUiDefaults = deps.cloneMineUiDefaults;
  getMineUiForAdminForm = deps.getMineUiForAdminForm;
  getMineUiForApi = deps.getMineUiForApi;
  loadMineUiParsed = deps.loadMineUiParsed;
  sanitizeMineUiImageRef = deps.sanitizeMineUiImageRef;
  isDeprecatedMessageHeaderRef = deps.isDeprecatedMessageHeaderRef;
  getInstallPackageSettingsFromDb = deps.getInstallPackageSettingsFromDb;
  sanitizeInstallDownloadUrl = deps.sanitizeInstallDownloadUrl;
  getWechatPayQrcodeUrl = deps.getWechatPayQrcodeUrl;
  invalidateWechatPayQrcodeCache = deps.invalidateWechatPayQrcodeCache;
  sanitizeXianyuPurchaseText = deps.sanitizeXianyuPurchaseText;
  USER_TYPE_NORMAL = deps.USER_TYPE_NORMAL;
  USER_TYPE_TEST = deps.USER_TYPE_TEST;
  isXianyuActivationNote = deps.isXianyuActivationNote;
  activationSourceChannelLabel = deps.activationSourceChannelLabel;
  registerSourceChannelLabel = deps.registerSourceChannelLabel;
  userChannelAnalysisLabel = deps.userChannelAnalysisLabel;
  userLoginReasonLabel = deps.userLoginReasonLabel;
  formatUserIdCardForAdmin = deps.formatUserIdCardForAdmin;
  userIdCardLabelForAdmin = deps.userIdCardLabelForAdmin;
  maskBankCardNo = deps.maskBankCardNo;
  buildUserTaxAvgSalaryMap = deps.buildUserTaxAvgSalaryMap;
  computeTaxRecordsAvgSalary6m = deps.computeTaxRecordsAvgSalary6m;
  loadTaxRecordChangesForUser = deps.loadTaxRecordChangesForUser;
  mergeUserRiskInfo = deps.mergeUserRiskInfo;
  parseSalaryRangeFilterParam = deps.parseSalaryRangeFilterParam;
  userMatchesSalaryRange = deps.userMatchesSalaryRange;
  normalizeTrackEventKeyFromRoute = deps.normalizeTrackEventKeyFromRoute;
}

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
         INNER JOIN users u ON u.username = agg.used_by_username
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

async function handleAdminUsersDailyConversion(req, res) {
  try {
    var days = parseInt(req.query.days, 10) || 7;
    if (days < 1) days = 1;
    if (days > 90) days = 90;
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

/** 注册后 7 日内漏斗：激活 / 有个税 / 查看收入明细（按用户注册日 cohort） */
async function handleAdminRegistrationFunnel(req, res) {
  try {
    var days = parseInt(req.query.days, 10) || 30;
    if (days < 1) days = 1;
    if (days > 90) days = 90;
    var cnUserDay = 'DATE(DATE_ADD(u.created_at, INTERVAL 8 HOUR))';
    var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
    var regSince = cnUserDay + ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY)';

    const conn = await pool.getConnection();
    try {
      var where = [regSince];
      var params = [days - 1];
      appendAdminUserScope(where, params, req.admin, 'u.username');
      var whereSql = ' WHERE ' + where.join(' AND ');

      const [sumRows] = await conn.query(
        `SELECT COUNT(*) AS registered,
                SUM(CASE WHEN EXISTS (
                  SELECT 1 FROM activation_codes ac
                  WHERE ac.used_by_username = u.username
                    AND ac.last_used_at IS NOT NULL
                    AND TIMESTAMPDIFF(HOUR, u.created_at, ac.last_used_at) BETWEEN 0 AND 168
                ) THEN 1 ELSE 0 END) AS activated_7d,
                SUM(CASE WHEN EXISTS (
                  SELECT 1 FROM tax_records tr
                  WHERE tr.user_id = u.username
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

      function pct(n, d) {
        if (!d || d <= 0) return null;
        return (Math.round((n / d) * 1000) / 10).toFixed(1) + '%';
      }

      const [dayRows] = await conn.query(
        `SELECT ${cnUserDay} AS d,
                COUNT(*) AS registered,
                SUM(CASE WHEN EXISTS (
                  SELECT 1 FROM activation_codes ac
                  WHERE ac.used_by_username = u.username
                    AND ac.last_used_at IS NOT NULL
                    AND TIMESTAMPDIFF(HOUR, u.created_at, ac.last_used_at) BETWEEN 0 AND 168
                ) THEN 1 ELSE 0 END) AS activated_7d,
                SUM(CASE WHEN EXISTS (
                  SELECT 1 FROM tax_records tr
                  WHERE tr.user_id = u.username
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
          rate_activate_7d_pct: pct(a7, reg),
          rate_tax_7d_pct: pct(t7, reg),
          rate_detail_7d_pct: pct(v7, reg)
        };
      });

      res.json({
        code: 200,
        data: {
          days: days,
          summary: {
            registered: registered,
            activated_7d: activated7,
            tax_7d: tax7,
            viewed_detail_7d: detail7,
            rate_activate_7d_pct: pct(activated7, registered),
            rate_tax_7d_pct: pct(tax7, registered),
            rate_detail_7d_pct: pct(detail7, registered),
            rate_tax_of_activated_pct: pct(tax7, activated7),
            rate_detail_of_tax_pct: pct(detail7, tax7)
          },
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
    return Object.assign({}, DEFAULT_CONVERSION_AB, parsed && typeof parsed === 'object' ? parsed : {});
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
      '.username AND ac.last_used_at IS NOT NULL AND TIMESTAMPDIFF(HOUR, ' +
      u +
      '.created_at, ac.last_used_at) BETWEEN 0 AND 168) THEN 1 ELSE 0 END)',
    tax7:
      'SUM(CASE WHEN EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = ' +
      u +
      '.username AND TIMESTAMPDIFF(HOUR, ' +
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
      var lines = [
        '账号,姓名,注册时间,注册渠道,APP停留,活跃天,页面数,行为路径摘要,最近活跃'
      ];
      userRows.forEach(function (r) {
        var uname = String(r.username);
        var metrics = computeBehaviorMetricsFromEvents(eventMap[uname] || []);
        var row = [
          uname,
          r.real_name != null ? String(r.real_name) : '',
          r.created_at ? r.created_at.toISOString() : '',
          registerSourceChannelLabel(r.register_source_channel),
          metrics.stay_label || '',
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

/** 转化 KPI：激活后 7 日个税填写率、有个税后 7 日明细查看率 */
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
                    AND TIMESTAMPDIFF(HOUR, ac.last_used_at, tr.created_at) BETWEEN 0 AND 168
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
                    AND TIMESTAMPDIFF(HOUR, ft.first_tax_at, e.created_at) BETWEEN 0 AND 168
                ) THEN 1 ELSE 0 END) AS viewed_detail_7d
         FROM users u
         INNER JOIN (
           SELECT user_id AS username, MIN(created_at) AS first_tax_at
           FROM tax_records
           GROUP BY user_id
         ) ft ON ft.username = u.username
         WHERE DATE(DATE_ADD(ft.first_tax_at, INTERVAL 8 HOUR)) >= DATE_SUB(${cnToday}, INTERVAL ? DAY)${scopeSql}`,
        scopeParams
      );
      var tax = taxRows[0] || {};
      var withTax = Number(tax.with_tax) || 0;
      var viewed7 = Number(tax.viewed_detail_7d) || 0;

      res.json({
        code: 200,
        data: {
          days: days,
          activated_in_window: activated,
          tax_within_7d_after_activate: taxWithin7,
          rate_tax_after_activate_7d_pct: pct(taxWithin7, activated),
          users_with_first_tax_in_window: withTax,
          viewed_detail_within_7d_after_tax: viewed7,
          rate_detail_after_tax_7d_pct: pct(viewed7, withTax)
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
          'SUM(CASE WHEN account_active = 1 THEN 1 ELSE 0 END) AS activated_cnt ' +
          'FROM users WHERE ' +
          scope.where +
          ' GROUP BY register_source_channel ORDER BY cnt DESC',
        scope.params
      );

      const [actRows] = await conn.query(
        'SELECT activation_source_channel AS ch, COUNT(*) AS cnt FROM users WHERE ' +
          scope.where +
          " AND account_active = 1 AND activation_source_channel IS NOT NULL AND TRIM(activation_source_channel) <> '' " +
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
      if (!allTime && days > 0 && days <= 90) {
        trendDays = days;
        var span = Math.max(0, days - 1);
        var cnCreated = 'DATE_ADD(users.created_at, INTERVAL 8 HOUR)';
        var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
        var dayWhere =
          scope.where +
          ' AND DATE(' +
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
        dayRows.forEach(function (r) {
          var dk = r.d ? String(r.d).slice(0, 10) : '';
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
        });
        byDay = Object.keys(dayMap)
          .sort()
          .map(function (dk) {
            var row = dayMap[dk];
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
            return { date: row.date, total: row.total, channels: chList };
          });
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
          by_day: byDay,
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
    if (qTaxModifiedToday === '1') {
      whereClauses.push(
        'EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = users.username AND DATE(tr.updated_at) = ?)'
      );
      params.push(todayKey);
    } else if (qTaxModifiedToday === '0') {
      whereClauses.push(
        'NOT EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = users.username AND DATE(tr.updated_at) = ?)'
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

    var whereClauses = [];
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
        ADMIN_TAX_RECORD_SELECT_SQL + ' WHERE user_id = ? ORDER BY year DESC, month DESC, id DESC LIMIT 120',
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
        ios_mobileconfig_download_url: installRaw.ios,
        xianyu_purchase_url: installRaw.xianyu,
        qq_add_url: sanitizeInstallDownloadUrl(installRaw.qq),
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
  var hasIos = Object.prototype.hasOwnProperty.call(body, 'ios_mobileconfig_download_url');
  var hasXianyu = Object.prototype.hasOwnProperty.call(body, 'xianyu_purchase_url');
  var hasQqAdd = Object.prototype.hasOwnProperty.call(body, 'qq_add_url');
  var hasWechatPayQr = Object.prototype.hasOwnProperty.call(body, 'wechat_pay_qrcode_url');
  var hasConversionAb = body.conversion_ab != null && typeof body.conversion_ab === 'object';
  if (!hasMineUi && !hasAndroid && !hasIos && !hasXianyu && !hasQqAdd && !hasWechatPayQr && !hasConversionAb) {
    return res.status(400).json({
      code: 400,
      msg: '请提供 mine_ui、安装包下载地址、闲鱼购买链接、QQ 添加链接、转化 A/B 配置或微信收款码（wechat_pay_qrcode_url）'
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
      var okX = sanitizeXianyuPurchaseText(body.xianyu_purchase_url);
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_XIANYU_PURCHASE, okX]
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
    outData.ios_mobileconfig_download_url = installAfter.ios;
    outData.xianyu_purchase_url = installAfter.xianyu;
    outData.qq_add_url = sanitizeInstallDownloadUrl(installAfter.qq);
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

function noTaxUserWhereSql(req) {
  var where = ["NOT EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = users.username)"];
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
        'SELECT COUNT(*) AS c FROM tax_records WHERE user_id = ?',
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
      ') GROUP BY user_id',
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
  'track_qq_add_click'
];

var ACTIVATE_TRACK_EVENT_KEY_SET = {};
ACTIVATE_TRACK_EVENT_KEYS.forEach(function (k) {
  ACTIVATE_TRACK_EVENT_KEY_SET[k] = true;
});

var ACTIVATE_TRACK_EVENT_SQL =
  "(route_key LIKE '%#track_activate_prompt_open' OR route_key LIKE '%#track_activate_prompt_cancel' OR route_key LIKE '%#track_activate_prompt_confirm' OR route_key LIKE '%#track_xianyu_purchase_click' OR route_key LIKE '%#track_qq_add_click')";

function isActivateTrackEventKey(eventKey) {
  return !!ACTIVATE_TRACK_EVENT_KEY_SET[String(eventKey || '').trim()];
}

function activateTrackEventLabel(eventKey) {
  var labels = {
    track_activate_prompt_open: '激活弹窗打开',
    track_activate_prompt_cancel: '激活弹窗-取消',
    track_activate_prompt_confirm: '激活弹窗-确定',
    track_xianyu_purchase_click: '闲鱼购买',
    track_qq_add_click: '添加QQ号'
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

module.exports = { initAdminHandlers, handleAdminLogin, handleAdminMe, handleAdminAccountsList, handleAdminAccountsCreate, handleAdminAccountsUpdate, handleAdminAccountActivatedUsers, handleAdminAccountsDelete, handleAdminUsersDailyConversion, handleAdminRegistrationFunnel, handleAdminChannelRegistrationFunnel, handleAdminInstallTrackStats, handleAdminUserDataNoTaxBehaviorExport, handleAdminConversionKpis, handleAdminUsersPendingActivate24h, handleAdminRegisterTimeDistribution, handleAdminFemaleAgeStats, handleAdminRegisterChannelStats, handleAdminRegisterGenderStats, handleAdminUsers, handleAdminUserDataAnalytics, handleAdminUserDataSalaryHighCharts, handleAdminUserDataList, handleAdminUserDataDetail, handleAdminIssueCode, handleAdminIssueCodeBatch, handleAdminCodes, handleAdminBan, handleAdminSettingsGet, handleAdminSettingsPost, handleAdminUserTaxRecords, handleAdminUserDataNoTaxBehavior, handleAdminUserDataNoTaxBehaviorPath, handleAdminPurgeBotUsers, handleAdminDeleteUser, handleAdminAnalyticsDeviceStats, handleAdminAnalyticsDauUsers, handleAdminAnalyticsOverview, handleAdminAnalyticsApi, handleAdminAnalyticsEventsClear, handleAdminAnalyticsEvents, handleAdminAnalyticsActivateEvents, handleAdminAnalyticsActivateEventUsers, handleAdminAnalyticsDevices, handleAdminAnalyticsLoginRecent, handleAdminLoginLogs, handleAdminOperationLogs, handleAdminFeedbackList, handleAdminFeedbackReply, handleAdminMonitorOverview, handleAdminMonitorTestEmail };
