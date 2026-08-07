'use strict';

const {
  USER_REGISTER_IP_ACCOUNT_THRESHOLD,
  computeUserLoginRisk,
  userRegisterIpRiskMatchSql,
  userLoginRiskMatchSql
} = require('../../src/domain/userLoginRisk');

describe('userLoginRisk', () => {
  it('flags same-ip registration when count reaches threshold', () => {
    const info = computeUserLoginRisk(1, 0, USER_REGISTER_IP_ACCOUNT_THRESHOLD);
    expect(info.risk).toBe(true);
    expect(info.register_ip_account_count).toBe(USER_REGISTER_IP_ACCOUNT_THRESHOLD);
    expect(info.risk_messages).toContain('同IP注册' + USER_REGISTER_IP_ACCOUNT_THRESHOLD + '个');
  });

  it('does not flag same-ip registration below threshold', () => {
    const info = computeUserLoginRisk(1, 0, USER_REGISTER_IP_ACCOUNT_THRESHOLD - 1);
    expect(info.risk).toBe(false);
    expect(info.risk_messages).not.toContain('同IP注册1个');
  });

  it('combines distinct login IP, device, and same-ip registration risks', () => {
    const info = computeUserLoginRisk(2, 3, 3);
    expect(info.risk).toBe(true);
    expect(info.risk_messages).toEqual(['不同IP2个', '设备3台', '同IP注册3个']);
  });

  it('builds register-ip risk SQL fragment', () => {
    const sql = userRegisterIpRiskMatchSql('users.username');
    expect(sql).toContain('register_ok');
    expect(sql).toContain('COUNT(DISTINCT reg_other.username)');
    expect(sql).toContain(String(USER_REGISTER_IP_ACCOUNT_THRESHOLD));
  });

  it('includes register-ip risk in overall login risk SQL', () => {
    const sql = userLoginRiskMatchSql('users.username');
    expect(sql).toContain('register_ok');
    expect(sql).toContain(String(USER_REGISTER_IP_ACCOUNT_THRESHOLD));
  });
});
