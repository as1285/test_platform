/**
 * 子管理员下线：账号树、数据范围与可分配菜单。
 */
'use strict';

var MAX_DOWNLINE_DEPTH = 8;
var BLOCKED_DOWNLINE_MENUS = {
  'admin-accounts': 1
};

/** 去重用户名（大小写不敏感，保留首次写法） */
function uniqueUsernames(list) {
  var seen = Object.create(null);
  var out = [];
  (list || []).forEach(function (u) {
    var s = String(u || '').trim();
    if (!s) return;
    var k = s.toLowerCase();
    if (seen[k]) return;
    seen[k] = 1;
    out.push(s);
  });
  return out;
}

/** 当前管理员可见数据范围：本人 + 全部下线 */
function adminScopeUsernames(admin) {
  if (!admin) return [];
  var self = String(admin.username || '').trim();
  var down = Array.isArray(admin.downline_usernames) ? admin.downline_usernames : [];
  return uniqueUsernames([self].concat(down));
}

function sqlInPlaceholders(n) {
  var out = [];
  var i;
  for (i = 0; i < n; i++) out.push('?');
  return out.join(',');
}

/**
 * 生成 `col = ?` / `col IN (...)`，并把用户名推入 params。
 * 空列表返回 `1=0`（不推参数）。
 */
function ownerAdminInSql(col, params, usernames) {
  var list = uniqueUsernames(usernames);
  if (!list.length) return '1=0';
  if (list.length === 1) {
    params.push(list[0]);
    return col + ' = ?';
  }
  var i;
  for (i = 0; i < list.length; i++) params.push(list[i]);
  return col + ' IN (' + sqlInPlaceholders(list.length) + ')';
}

/** 递归列出子孙管理员（含已停用，便于上级继续管理） */
async function listDescendantAdminUsernames(conn, parentUsername) {
  var parent = String(parentUsername || '').trim();
  if (!parent) return [];
  var found = [];
  var frontier = [parent];
  var seen = Object.create(null);
  seen[parent.toLowerCase()] = 1;
  var depth = 0;
  try {
    while (frontier.length && depth < MAX_DOWNLINE_DEPTH) {
      var ph = sqlInPlaceholders(frontier.length);
      const [rows] = await conn.execute(
        'SELECT username FROM admin_accounts WHERE parent_admin_username IN (' + ph + ')',
        frontier
      );
      frontier = [];
      var i;
      for (i = 0; i < (rows || []).length; i++) {
        var u = String(rows[i].username || '').trim();
        var k = u.toLowerCase();
        if (!u || seen[k]) continue;
        seen[k] = 1;
        found.push(u);
        frontier.push(u);
      }
      depth++;
    }
  } catch (e) {
    if (e && e.errno === 1054) return [];
    throw e;
  }
  return found;
}

/** 登录后挂上下线范围 */
async function attachAdminDownlineScope(conn, admin) {
  if (!admin) return admin;
  if (admin.is_super) {
    admin.downline_usernames = [];
    admin.scope_usernames = adminScopeUsernames(admin);
    return admin;
  }
  admin.downline_usernames = await listDescendantAdminUsernames(conn, admin.username);
  admin.scope_usernames = adminScopeUsernames(admin);
  return admin;
}

function usernameEquals(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function isInUsernameList(name, list) {
  var key = String(name || '').trim().toLowerCase();
  if (!key) return false;
  var i;
  for (i = 0; i < (list || []).length; i++) {
    if (String(list[i] || '').trim().toLowerCase() === key) return true;
  }
  return false;
}

/** 可否改菜单/删账号/重置密码：超管可管非超管；子管只能管自己的下线 */
function canManageTargetAdmin(actor, target) {
  if (!actor || !target) return false;
  var targetName = String(target.username || '').trim();
  if (!targetName || usernameEquals(targetName, actor.username)) return false;
  if (target.is_super) return false;
  if (actor.is_super) return true;
  return isInUsernameList(targetName, actor.downline_usernames);
}

/** 可否查看某管理账号详情（含本人、下线；超管任意） */
function canViewTargetAdmin(actor, targetUsername) {
  if (!actor) return false;
  var name = String(targetUsername || '').trim();
  if (!name) return false;
  if (actor.is_super) return true;
  if (usernameEquals(actor.username, name)) return true;
  return isInUsernameList(name, actor.downline_usernames);
}

/** 请求菜单 ∩ 上级已有菜单，并去掉超管专属 */
function intersectMenuKeys(requested, allowed) {
  var allow = Object.create(null);
  (allowed || []).forEach(function (k) {
    var s = String(k || '').trim();
    if (s && !BLOCKED_DOWNLINE_MENUS[s]) allow[s] = 1;
  });
  var seen = Object.create(null);
  var out = [];
  (requested || []).forEach(function (k) {
    var s = String(k || '').trim();
    if (!s || !allow[s] || seen[s] || BLOCKED_DOWNLINE_MENUS[s]) return;
    seen[s] = 1;
    out.push(s);
  });
  return out;
}

/** 上级账号链路深度（无上级为 0） */
async function countAdminParentDepth(conn, username) {
  var depth = 0;
  var cur = String(username || '').trim();
  var seen = Object.create(null);
  try {
    while (cur && depth < MAX_DOWNLINE_DEPTH + 2) {
      const [rows] = await conn.execute(
        'SELECT parent_admin_username FROM admin_accounts WHERE username = ? LIMIT 1',
        [cur]
      );
      if (!rows.length || !rows[0].parent_admin_username) break;
      cur = String(rows[0].parent_admin_username).trim();
      var k = cur.toLowerCase();
      if (!cur || seen[k]) break;
      seen[k] = 1;
      depth++;
    }
  } catch (e) {
    if (e && e.errno === 1054) return 0;
    throw e;
  }
  return depth;
}

module.exports = {
  MAX_DOWNLINE_DEPTH,
  uniqueUsernames,
  adminScopeUsernames,
  ownerAdminInSql,
  listDescendantAdminUsernames,
  attachAdminDownlineScope,
  canManageTargetAdmin,
  canViewTargetAdmin,
  intersectMenuKeys,
  countAdminParentDepth
};
