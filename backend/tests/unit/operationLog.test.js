'use strict';

const {
  rootAdminUsername,
  isRootAdminAccount,
  shouldRecordAdminOperation
} = require('../../src/admin/operationLog');

describe('operationLog', () => {
  it('normalizes root admin username', () => {
    expect(rootAdminUsername('')).toBe('admin');
    expect(rootAdminUsername('Admin')).toBe('admin');
    expect(rootAdminUsername('  Root  ')).toBe('root');
  });

  it('treats is_super or configured username as root admin', () => {
    expect(isRootAdminAccount({ is_super: true, username: 'ops' }, 'admin')).toBe(true);
    expect(isRootAdminAccount({ is_super: false, username: 'admin' }, 'admin')).toBe(true);
    expect(isRootAdminAccount({ is_super: false, username: 'agent' }, 'admin')).toBe(false);
  });

  it('records only sub-admin write operations', () => {
    var sub = { is_super: false, username: 'agent' };
    expect(
      shouldRecordAdminOperation(sub, { method: 'POST', path: '/api/admin/user-delete' }, 'admin')
    ).toBe(true);
    expect(
      shouldRecordAdminOperation(sub, { method: 'GET', path: '/api/admin/users' }, 'admin')
    ).toBe(false);
    expect(
      shouldRecordAdminOperation(
        { is_super: true, username: 'admin' },
        { method: 'POST', path: '/api/admin/user-delete' },
        'admin'
      )
    ).toBe(false);
    expect(
      shouldRecordAdminOperation(sub, { method: 'POST', path: '/api/admin/admin-operation-logs' }, 'admin')
    ).toBe(false);
    expect(shouldRecordAdminOperation(sub, { method: 'POST', path: '' }, 'admin')).toBe(false);
  });
});
