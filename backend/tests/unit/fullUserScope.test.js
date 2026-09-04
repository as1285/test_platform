'use strict';

const fs = require('fs');
const path = require('path');
const {
  ADMIN_FULL_USER_SCOPE_USERNAMES,
  isFullUserScopeUsername,
  adminHasFullUserScope,
  fullUserScopeUsernameSqlIn
} = require('../../src/admin/fullUserScope');

describe('admin full user scope allowlist', () => {
  it('lists the three ops accounts that may see all registered users', () => {
    expect(ADMIN_FULL_USER_SCOPE_USERNAMES['19106014552']).toBe(true);
    expect(ADMIN_FULL_USER_SCOPE_USERNAMES['13691947741']).toBe(true);
    expect(ADMIN_FULL_USER_SCOPE_USERNAMES['18671741907']).toBe(true);
    expect(Object.keys(ADMIN_FULL_USER_SCOPE_USERNAMES)).toHaveLength(3);
  });

  it('treats super admin and allowlisted usernames as full scope', () => {
    expect(adminHasFullUserScope({ is_super: true, username: 'other' })).toBe(true);
    expect(adminHasFullUserScope({ username: '18671741907' })).toBe(true);
    expect(adminHasFullUserScope({ username: '19106014552' })).toBe(true);
    expect(isFullUserScopeUsername('13691947741')).toBe(true);
    expect(adminHasFullUserScope({ username: 'admin' })).toBe(false);
    expect(adminHasFullUserScope(null)).toBe(false);
  });

  it('builds a SQL IN list from the same allowlist', () => {
    var sqlIn = fullUserScopeUsernameSqlIn();
    expect(sqlIn).toContain("'19106014552'");
    expect(sqlIn).toContain("'13691947741'");
    expect(sqlIn).toContain("'18671741907'");
  });

  it('is the only hardcoded ops allowlist (monolith / opsConversion import it)', () => {
    var monolith = fs.readFileSync(
      path.join(__dirname, '../../src/legacy/monolith.js'),
      'utf8'
    );
    var ops = fs.readFileSync(path.join(__dirname, '../../src/admin/opsConversion.js'), 'utf8');
    expect(monolith).toContain("require('../admin/fullUserScope')");
    expect(monolith).not.toMatch(/const ADMIN_FULL_USER_SCOPE_USERNAMES = \{/);
    expect(ops).toContain("require('./fullUserScope')");
    expect(ops).not.toContain("u === '19106014552' || u === '13691947741'");
  });
});
