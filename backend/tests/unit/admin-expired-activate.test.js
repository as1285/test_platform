'use strict';

const { readFileSync } = require('fs');
const { resolve } = require('path');
const {
  isUserEffectivelyActive,
  isTrialExpired,
  userActivationExpiredSql
} = require('../../src/legacy/inviteReward');

const monolith = readFileSync(resolve(__dirname, '../../src/legacy/monolith.js'), 'utf8');

describe('admin activate treats expired like inactive', () => {
  it('expired trial is not effectively active', () => {
    const past = new Date(Date.now() - 3600000).toISOString();
    const row = { account_active: 1, activation_kind: 'trial', active_until: past };
    expect(isTrialExpired(row)).toBe(true);
    expect(isUserEffectivelyActive(row)).toBe(false);
  });

  it('handleAdminUserActivate uses effective active, not raw account_active', () => {
    expect(monolith).toContain('以当前是否有效激活为准：试用已过期与未激活一样');
    expect(monolith).toContain('var already = isUserEffectivelyActive(row);');
    expect(monolith).toContain('var alreadyLegacy = isUserEffectivelyActive(urows[0]);');
  });

  it('admin users list accepts active=expired', () => {
    expect(monolith).toContain("qActive === 'expired'");
    expect(monolith).toContain('userActivationExpiredSql');
    expect(monolith).toContain('userEffectivelyActiveSql');
    expect(userActivationExpiredSql('users')).toContain('users.active_until <= ?');
  });
});

