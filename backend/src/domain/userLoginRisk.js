'use strict';

/** 注册用户列表登录风控：不同登录 IP 数、关联设备数、同 IP 注册账号数 */
const USER_LOGIN_RISK_IP_THRESHOLD = 2;
const USER_LOGIN_RISK_DEVICE_THRESHOLD = 3;
const USER_REGISTER_IP_ACCOUNT_THRESHOLD = 2;

/** 用户辅助：login risk ip union subquery */
function userLoginRiskIpUnionSubquery(usernameExpr) {
  const u = usernameExpr || 'users.username';
  return (
    '(SELECT TRIM(ip) AS ip_val FROM user_login_events WHERE username = ' +
    u +
    " AND ip IS NOT NULL AND TRIM(ip) <> '' AND (ok = 1 OR reason LIKE 'register_%') UNION ALL SELECT TRIM(ip_last) AS ip_val FROM user_devices WHERE username = " +
    u +
    " AND ip_last IS NOT NULL AND TRIM(ip_last) <> '')"
  );
}

/** compute user login risk */
function computeUserLoginRisk(ipDistinctCount, deviceCount, registerIpAccountCount) {
  const ipCnt = Number(ipDistinctCount) || 0;
  const devCnt = Number(deviceCount) || 0;
  const regIpCnt = Number(registerIpAccountCount) || 0;
  const msgs = [];
  if (ipCnt >= USER_LOGIN_RISK_IP_THRESHOLD) {
    msgs.push('不同IP' + ipCnt + '个');
  }
  if (devCnt >= USER_LOGIN_RISK_DEVICE_THRESHOLD) {
    msgs.push('设备' + devCnt + '台');
  }
  if (regIpCnt >= USER_REGISTER_IP_ACCOUNT_THRESHOLD) {
    msgs.push('同IP注册' + regIpCnt + '个');
  }
  return {
    distinct_ip_count: ipCnt,
    device_count: devCnt,
    register_ip_account_count: regIpCnt,
    risk: msgs.length > 0,
    risk_messages: msgs
  };
}

/** 用户辅助：register ip risk match sql */
function userRegisterIpRiskMatchSql(usernameExpr) {
  const u = usernameExpr || 'users.username';
  return (
    'EXISTS (SELECT 1 FROM user_login_events reg_self WHERE reg_self.username = ' +
    u +
    " AND reg_self.reason = 'register_ok' AND reg_self.ip IS NOT NULL AND TRIM(reg_self.ip) <> '' AND (SELECT COUNT(DISTINCT reg_other.username) FROM user_login_events reg_other WHERE reg_other.reason = 'register_ok' AND TRIM(reg_other.ip) = TRIM(reg_self.ip)) >= " +
    USER_REGISTER_IP_ACCOUNT_THRESHOLD +
    ')'
  );
}

/** 用户辅助：login risk match sql */
function userLoginRiskMatchSql(usernameExpr) {
  const u = usernameExpr || 'users.username';
  return (
    '((SELECT COUNT(DISTINCT ip_val) FROM ' +
    userLoginRiskIpUnionSubquery(u) +
    ' ip_union) >= ' +
    USER_LOGIN_RISK_IP_THRESHOLD +
    ' OR (SELECT COUNT(*) FROM user_devices ud WHERE ud.username = ' +
    u +
    ') >= ' +
    USER_LOGIN_RISK_DEVICE_THRESHOLD +
    ' OR ' +
    userRegisterIpRiskMatchSql(u) +
    ')'
  );
}

module.exports = {
  USER_LOGIN_RISK_IP_THRESHOLD,
  USER_LOGIN_RISK_DEVICE_THRESHOLD,
  USER_REGISTER_IP_ACCOUNT_THRESHOLD,
  userLoginRiskIpUnionSubquery,
  computeUserLoginRisk,
  userRegisterIpRiskMatchSql,
  userLoginRiskMatchSql
};
