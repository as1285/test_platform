'use strict';

const {
  USER_REGISTER_IP_ACCOUNT_THRESHOLD,
  computeUserLoginRisk,
  userRegisterIpRiskMatchSql,
  userLoginRiskMatchSql,
  userSameRegisterIpOfSql
} = require('../../src/domain/userLoginRisk');

describe('userLoginRisk', () => {
  it('flags same-ip registration when count reaches threshold', () => {
    const info = computeUserLoginRisk(1, 0, USER_REGISTER_IP_ACCOUNT_THRESHOLD, 'first_user');
    expect(info.risk).toBe(true);
    expect(info.register_ip_account_count).toBe(USER_REGISTER_IP_ACCOUNT_THRESHOLD);
    expect(info.register_ip_first_username).toBe('first_user');
    expect(info.risk_messages).toContain(
      '同IP注册' + USER_REGISTER_IP_ACCOUNT_THRESHOLD + '个，首账号first_user'
    );
  });

  it('does not flag same-ip registration below threshold', () => {
    const info = computeUserLoginRisk(1, 0, USER_REGISTER_IP_ACCOUNT_THRESHOLD - 1);
    expect(info.risk).toBe(false);
    expect(info.risk_messages).not.toContain('同IP注册1个');
  });

  it('combines distinct login IP, device, and same-ip registration risks', () => {
    const info = computeUserLoginRisk(2, 3, 3, 'alpha');
    expect(info.risk).toBe(true);
    expect(info.risk_messages).toEqual(['不同IP2个', '设备3台', '同IP注册3个，首账号alpha']);
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

  it('builds same-register-ip-of SQL with one bind placeholder', () => {
    const sql = userSameRegisterIpOfSql('users.username');
    expect(sql).toContain("reg_peer.reason = 'register_ok'");
    expect(sql).toContain("reg_seed.reason = 'register_ok'");
    expect(sql).toContain('reg_seed.username = ?');
    expect(sql).toContain('TRIM(reg_peer.ip) = TRIM(reg_seed.ip)');
    expect((sql.match(/\?/g) || []).length).toBe(1);
  });
});
