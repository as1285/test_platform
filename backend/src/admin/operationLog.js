/**
 * 子管理员操作日志：只记非超管的写操作；列表对超管隐藏 admin 自己的记录。
 */
'use strict';

var WRITE_METHODS = { POST: 1, PUT: 1, PATCH: 1, DELETE: 1 };

var SKIP_PATHS = {
  '/api/admin/login': 1,
  '/api/admin/admin-login-logs': 1,
  '/api/admin/admin-operation-logs': 1,
  '/api/admin/me': 1
};

function rootAdminUsername(configUser) {
  return String(configUser || 'admin')
    .trim()
    .toLowerCase() || 'admin';
}

function isRootAdminAccount(admin, configUser) {
  if (!admin) return false;
  if (admin.is_super) return true;
  var name = String(admin.username || '')
    .trim()
    .toLowerCase();
  return !!name && name === rootAdminUsername(configUser);
}

/** 是否写入 admin_operation_logs */
function shouldRecordAdminOperation(admin, req, configUser) {
  if (!admin || !req) return false;
  if (isRootAdminAccount(admin, configUser)) return false;
  var method = String(req.method || '').toUpperCase();
  if (!WRITE_METHODS[method]) return false;
  var p = String(req.path || '').trim();
  if (!p || SKIP_PATHS[p]) return false;
  return true;
}

module.exports = {
  rootAdminUsername: rootAdminUsername,
  isRootAdminAccount: isRootAdminAccount,
  shouldRecordAdminOperation: shouldRecordAdminOperation
};
