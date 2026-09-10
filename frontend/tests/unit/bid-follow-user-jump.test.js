import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const panel = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');

describe('已通过跟进账号可跳转注册用户', () => {
  it('渲染可点击账号按钮并绑定 jumpToRegisteredUser', () => {
    expect(panel).toContain('function accountJumpButton(username)');
    expect(panel).toContain('admin-user-jump js-bid-follow-open-user');
    expect(panel).toContain('accountJumpButton(row.username)');
    expect(panel).toContain('jumpToRegisteredUser(userBtn.getAttribute');
    expect(html).toContain('admin_panel.js?v=20260910-admin-op-log');
    expect(html).toContain('bidFollowTbody');
  });
});

describe('心理价出价账号可跳转注册用户', () => {
  it('主表账号列渲染跳转按钮并绑定 jumpToRegisteredUser', () => {
    expect(panel).toContain('admin-user-jump js-bid-list-open-user');
    expect(panel).toContain('accountJumpButton(b.username)');
    expect(panel).toContain("closest('.js-bid-list-open-user')");
    expect(html).toContain('点击账号可跳到「注册用户」定位。');
    expect(html).toContain('id="bidTbody"');
  });
});
