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
function computeUserLoginRisk(ipDistinctCount, deviceCount, registerIpAccountCount, registerIpFirstUsername) {
  const ipCnt = Number(ipDistinctCount) || 0;
  const devCnt = Number(deviceCount) || 0;
  const regIpCnt = Number(registerIpAccountCount) || 0;
  const firstUser =
    registerIpFirstUsername != null ? String(registerIpFirstUsername).trim() : '';
  const msgs = [];
  if (ipCnt >= USER_LOGIN_RISK_IP_THRESHOLD) {
    msgs.push('不同IP' + ipCnt + '个');
  }
  if (devCnt >= USER_LOGIN_RISK_DEVICE_THRESHOLD) {
    msgs.push('设备' + devCnt + '台');
  }
  if (regIpCnt >= USER_REGISTER_IP_ACCOUNT_THRESHOLD) {
    let sameIpMsg = '同IP注册' + regIpCnt + '个';
    if (firstUser) {
      sameIpMsg += '，首账号' + firstUser;
    }
    msgs.push(sameIpMsg);
  }
  return {
    distinct_ip_count: ipCnt,
    device_count: devCnt,
    register_ip_account_count: regIpCnt,
    register_ip_first_username: firstUser,
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

/**
 * 与种子账号同注册 IP 的账号（需绑定 1 个参数：种子 username）。
 * 依据 user_login_events.reason = 'register_ok' 的 IP 关联。
 */
function userSameRegisterIpOfSql(usernameExpr) {
  const u = usernameExpr || 'users.username';
  return (
    'EXISTS (SELECT 1 FROM user_login_events reg_peer INNER JOIN user_login_events reg_seed ON TRIM(reg_peer.ip) = TRIM(reg_seed.ip) WHERE reg_peer.username = ' +
    u +
    " AND reg_peer.reason = 'register_ok' AND reg_seed.reason = 'register_ok' AND reg_seed.username = ? AND reg_seed.ip IS NOT NULL AND TRIM(reg_seed.ip) <> '' AND reg_peer.ip IS NOT NULL AND TRIM(reg_peer.ip) <> '')"
  );
}

/** 该账号首次 register_ok 的 IP，用于安装统计 / 注册分析按 IP 去重 */
function userRegisterIpJoinSql(userAlias) {
  const u = userAlias || 'u';
  return (
    'LEFT JOIN (SELECT username, MIN(id) AS first_id FROM user_login_events ' +
    "WHERE reason = 'register_ok' AND ip IS NOT NULL AND TRIM(ip) <> '' GROUP BY username) " +
    u +
    '_reg_first ON ' +
    u +
    '_reg_first.username = ' +
    u +
    '.username LEFT JOIN user_login_events ' +
    u +
    '_reg_ip ON ' +
    u +
    '_reg_ip.id = ' +
    u +
    '_reg_first.first_id'
  );
}

function userRegisterPersonKeySql(userAlias) {
  const u = userAlias || 'u';
  return 'COALESCE(NULLIF(TRIM(' + u + "_reg_ip.ip), ''), CONCAT('user:', " + u + '.username))';
}

/**
 * 区间内按注册 IP 去重（无 IP 退回账号），每人只保留最早 created_at。
 * 外层可按 DATE/HOUR(first_at) 分组，避免同 IP 多账号把注册刷高。
 */
function userRegisterDistinctIpInnerSql(userAlias, whereSql) {
  const u = userAlias || 'u';
  const person = userRegisterPersonKeySql(u);
  return (
    '(SELECT ' +
    person +
    ' AS person, MIN(' +
    u +
    '.created_at) AS first_at FROM users ' +
    u +
    ' ' +
    userRegisterIpJoinSql(u) +
    ' WHERE ' +
    whereSql +
    ' GROUP BY ' +
    person +
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
  userLoginRiskMatchSql,
  userSameRegisterIpOfSql,
  userRegisterIpJoinSql,
  userRegisterPersonKeySql,
  userRegisterDistinctIpInnerSql
};
