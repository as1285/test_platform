import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const nav = readFileSync(resolve(__dirname, '../../public/js/admin/nav.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const ops = readFileSync(
  resolve(__dirname, '../../public/js/admin/modules/ops-conversion.js'),
  'utf8'
);
const panel = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const loader = readFileSync(resolve(__dirname, '../../public/js/admin/loader.js'), 'utf8');

describe('管理台搜索能打开支付明细里的账号', () => {
  it('支付明细点账号不再强制筛未激活', () => {
    expect(ops).toContain("activeEl.value = ''");
    expect(ops).not.toContain("activeEl.value = '0'");
    expect(ops).toContain('jumpToRegisteredUser');
    expect(panel).toContain('window.jumpToRegisteredUser = jumpToRegisteredUser');
  });

  it('Ctrl+K 可按手机号搜账号并跳到注册用户', () => {
    expect(nav).toContain('function isAccountQuery');
    expect(nav).toContain('function fetchCommandUsers');
    expect(nav).toContain('data-command-user');
    expect(nav).toContain('api/admin/users?username=');
    expect(html).toContain('搜功能或账号');
    expect(html).toContain('没有匹配的功能或账号');
    expect(html).toContain('nav.js?v=20260908-hub-tab-perm');
    expect(html).toContain('admin_panel.js?v=20260914-same-month');
    expect(loader).toContain('ops-conversion.js?v=20260910-ops-range');
  });
});
