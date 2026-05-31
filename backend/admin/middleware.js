'use strict';

var pool;
var jwt;
var JWT_SECRET;
var loadAdminAccountByUsername;
var recordAdminOperationLog;

function initAdminMiddleware(deps) {
  pool = deps.pool;
  jwt = deps.jwt;
  JWT_SECRET = deps.JWT_SECRET;
  loadAdminAccountByUsername = deps.loadAdminAccountByUsername;
  recordAdminOperationLog = deps.recordAdminOperationLog;
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

module.exports = {
  initAdminMiddleware,
  adminHasMenu,
  requireAdminMenu,
  requireAdminAnyMenu,
  adminCanAccessTargetUser,
  requireAdminAuth
};
