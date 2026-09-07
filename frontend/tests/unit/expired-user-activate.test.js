import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const panel = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');

describe('已过期账号与未激活同一套激活', () => {
  it('注册用户列表：已过期显示激活按钮，不显示临时→永久', () => {
    expect(panel).toContain('if (!u.account_active || isExpired)');
    expect(panel).toContain('data-expired="');
    expect(panel).toContain('var canMakePermanent =\n                            !isExpired &&');
    expect(panel).toContain('试用已过期，重新选择时长开通（与未激活相同）');
  });

  it('激活弹窗对已过期账号提示重新选时长', () => {
    expect(panel).toContain('openUserActivateModal(username, opts)');
    expect(panel).toContain('试用已过期，请重新选择激活时长并开通（与未激活相同）');
    expect(panel).toContain('expired: btn.getAttribute(\'data-expired\') === \'1\'');
  });

  it('说明与缓存版本已更新', () => {
    expect(html).toContain('已过期账号操作列与未激活相同');
    expect(html).toContain('admin_panel.js?v=20260907-deact-note');
  });

  it('注册用户激活状态筛选含已过期', () => {
    expect(html).toContain('id="filterActive"');
    expect(html).toContain('<option value="expired">已过期</option>');
    expect(html).toContain('已激活不含试用过期');
  });
});

