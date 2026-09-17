'use strict';

const {
  rootAdminUsername,
  isRootAdminAccount,
  shouldRecordAdminOperation,
  describeAdminOperation,
  normalizeAdminUiEvent,
  extraPathsForSearch,
  buildOperationLogSearch,
  pageLabelFromKey
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
    expect(
      shouldRecordAdminOperation(sub, { method: 'POST', path: '/api/admin/ui-events' }, 'admin')
    ).toBe(false);
    expect(
      shouldRecordAdminOperation(sub, { method: 'POST', path: '/api/admin/ui-cookie' }, 'admin')
    ).toBe(false);
    expect(shouldRecordAdminOperation(sub, { method: 'POST', path: '' }, 'admin')).toBe(false);
  });

  it('maps write APIs to page + button labels', () => {
    var issue = describeAdminOperation({
      method: 'POST',
      path: '/api/admin/issue-code'
    });
    expect(issue.kind).toBe('write');
    expect(issue.kind_label).toBe('提交操作');
    expect(issue.page).toBe('codes');
    expect(issue.page_label).toBe('激活码');
    expect(issue.button_label).toBe('发放激活码');

    var exempt = describeAdminOperation({
      method: 'POST',
      path: '/api/admin/user-rename-fee-exempt'
    });
    expect(exempt.page_label).toBe('用户管理');
    expect(exempt.button_label).toBe('改名费豁免');
  });

  it('describes page enter and button click events', () => {
    var page = describeAdminOperation({ method: 'VIEW', path: 'users', action: 'enter' });
    expect(page.kind).toBe('page');
    expect(page.kind_label).toBe('进入页面');
    expect(page.page_label).toBe('用户管理');
    expect(page.button_label).toBe('进入');

    var click = describeAdminOperation({
      method: 'CLICK',
      path: 'codes',
      action: '发放激活码'
    });
    expect(click.kind).toBe('button');
    expect(click.kind_label).toBe('点击按钮');
    expect(click.page_label).toBe('激活码');
    expect(click.button_label).toBe('发放激活码');
  });

  it('validates ui events', () => {
    expect(normalizeAdminUiEvent({ kind: 'page', page: 'users' })).toEqual({
      kind: 'page',
      page: 'users',
      button: 'enter',
      method: 'VIEW'
    });
    expect(normalizeAdminUiEvent({ kind: 'button', page: 'users', button: '删除用户' })).toMatchObject({
      kind: 'button',
      page: 'users',
      button: '删除用户',
      method: 'CLICK'
    });
    expect(normalizeAdminUiEvent({ kind: 'page', page: '../etc' })).toBe(null);
    expect(normalizeAdminUiEvent({ kind: 'button', page: 'users' })).toBe(null);
    expect(normalizeAdminUiEvent({ kind: 'other', page: 'users' })).toBe(null);
  });

  it('searches by page label and button text', () => {
    expect(pageLabelFromKey('users')).toBe('用户管理');
    expect(extraPathsForSearch('用户管理')).toContain('users');
    expect(extraPathsForSearch('发放激活码')).toContain('/api/admin/issue-code');
    var search = buildOperationLogSearch('发放', 'write');
    expect(search.extraWhere.some(function (w) {
      return w.indexOf("UPPER(method) IN") >= 0;
    })).toBe(true);
    expect(search.extraWhere.some(function (w) {
      return w.indexOf('path LIKE') >= 0;
    })).toBe(true);
  });
});
