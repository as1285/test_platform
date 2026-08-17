'use strict';

const {
  uniqueUsernames,
  adminScopeUsernames,
  ownerAdminInSql,
  listDescendantAdminUsernames,
  canManageTargetAdmin,
  canViewTargetAdmin,
  intersectMenuKeys
} = require('../../src/admin/downline');

describe('admin downline helpers', () => {
  it('uniqueUsernames trims and de-dupes case-insensitively', () => {
    expect(uniqueUsernames([' Alice ', 'alice', '', 'Bob', 'BOB'])).toEqual(['Alice', 'Bob']);
  });

  it('adminScopeUsernames is self plus downline', () => {
    expect(
      adminScopeUsernames({
        username: 'lead',
        downline_usernames: ['a', 'lead', 'b']
      })
    ).toEqual(['lead', 'a', 'b']);
    expect(adminScopeUsernames(null)).toEqual([]);
  });

  it('ownerAdminInSql builds = / IN / 1=0', () => {
    var p0 = [];
    expect(ownerAdminInSql('ac.owner_admin_username', p0, [])).toBe('1=0');
    expect(p0).toEqual([]);

    var p1 = [];
    expect(ownerAdminInSql('ac.owner_admin_username', p1, ['lead'])).toBe(
      'ac.owner_admin_username = ?'
    );
    expect(p1).toEqual(['lead']);

    var p2 = [];
    expect(ownerAdminInSql('ac.owner_admin_username', p2, ['lead', 'a'])).toBe(
      'ac.owner_admin_username IN (?,?)'
    );
    expect(p2).toEqual(['lead', 'a']);
  });

  it('listDescendantAdminUsernames walks the parent tree', async () => {
    var calls = [];
    var conn = {
      execute: async function (sql, params) {
        calls.push(params.slice());
        if (params.length === 1 && params[0] === 'lead') {
          return [[{ username: 'a' }, { username: 'b' }]];
        }
        if (params.indexOf('a') >= 0) {
          return [[{ username: 'c' }]];
        }
        return [[]];
      }
    };
    var found = await listDescendantAdminUsernames(conn, 'lead');
    expect(found).toEqual(['a', 'b', 'c']);
    expect(calls[0]).toEqual(['lead']);
  });

  it('canManageTargetAdmin: super manages non-super; sub only descendants', () => {
    var superAdmin = { username: 'root', is_super: true, downline_usernames: [] };
    var lead = { username: 'lead', is_super: false, downline_usernames: ['a', 'c'] };
    expect(canManageTargetAdmin(superAdmin, { username: 'lead', is_super: false })).toBe(true);
    expect(canManageTargetAdmin(superAdmin, { username: 'root', is_super: true })).toBe(false);
    expect(canManageTargetAdmin(lead, { username: 'a', is_super: false })).toBe(true);
    expect(canManageTargetAdmin(lead, { username: 'other', is_super: false })).toBe(false);
    expect(canManageTargetAdmin(lead, { username: 'lead', is_super: false })).toBe(false);
  });

  it('canViewTargetAdmin includes self and downline', () => {
    var lead = { username: 'lead', is_super: false, downline_usernames: ['a'] };
    expect(canViewTargetAdmin(lead, 'lead')).toBe(true);
    expect(canViewTargetAdmin(lead, 'a')).toBe(true);
    expect(canViewTargetAdmin(lead, 'x')).toBe(false);
    expect(canViewTargetAdmin({ username: 'root', is_super: true }, 'anyone')).toBe(true);
  });

  it('intersectMenuKeys keeps only parent-owned assignable keys', () => {
    expect(
      intersectMenuKeys(
        ['codes', 'users', 'admin-accounts', 'downline-admins', 'ghost'],
        ['codes', 'users', 'downline-admins', 'admin-accounts']
      )
    ).toEqual(['codes', 'users', 'downline-admins']);
  });
});
