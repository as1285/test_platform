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
    expect(html).toContain('admin_panel.js?v=20260909-bid-follow-user-jump');
    expect(html).toContain('bidFollowTbody');
  });
});
