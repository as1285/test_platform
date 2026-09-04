/**
 * 非超管但可看/操作全部注册用户与用户数据的运营账号。
 * 加号、改权限只改这一处，不要在 monolith / opsConversion 再写死手机号。
 */
'use strict';

const ADMIN_FULL_USER_SCOPE_USERNAMES = {
  '19106014552': true,
  '13691947741': true,
  '18671741907': true
};

function adminUsernameKey(admin) {
  return String((admin && admin.username) || '')
    .trim()
    .toLowerCase();
}

function isFullUserScopeUsername(username) {
  var u = String(username || '')
    .trim()
    .toLowerCase();
  return !!(u && ADMIN_FULL_USER_SCOPE_USERNAMES[u]);
}

function adminHasFullUserScope(admin) {
  if (!admin) return false;
  if (admin.is_super) return true;
  return isFullUserScopeUsername(admin.username);
}

/** 建表补权 SQL 用：`WHERE username IN (` + fullUserScopeUsernameSqlIn() + `)` */
function fullUserScopeUsernameSqlIn() {
  return Object.keys(ADMIN_FULL_USER_SCOPE_USERNAMES)
    .map(function (u) {
      return "'" + String(u).replace(/'/g, "''") + "'";
    })
    .join(', ');
}

module.exports = {
  ADMIN_FULL_USER_SCOPE_USERNAMES: ADMIN_FULL_USER_SCOPE_USERNAMES,
  adminUsernameKey: adminUsernameKey,
  isFullUserScopeUsername: isFullUserScopeUsername,
  adminHasFullUserScope: adminHasFullUserScope,
  fullUserScopeUsernameSqlIn: fullUserScopeUsernameSqlIn
};
