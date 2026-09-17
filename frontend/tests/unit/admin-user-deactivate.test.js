import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const panel = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const css = readFileSync(resolve(__dirname, '../../css/admin_panel.css'), 'utf8');

describe('管理后台取消激活', () => {
  it('已激活且未过期显示取消激活，过期/未激活不显示', () => {
    expect(panel).toContain("if (u.account_active && !isExpired)");
    expect(panel).toContain('btn-user-deactivate');
    expect(panel).toContain('取消激活');
    expect(panel).toContain("adminFetch('api/admin/user-deactivate'");
    expect(panel).toContain('不会封禁，也不会按退款从统计中剔除');
  });

  it('说明、样式与缓存版本已更新', () => {
    expect(html).toContain('橙色<strong>取消激活</strong>');
    expect(html).toContain('不计入运营看板「今日激活」');
    expect(html).toContain('admin_panel.js?v=20260907-abc-ops');
    expect(panel).toContain('badge-cancelled');
    expect(panel).toContain('c.activation_cancelled');
    expect(css).toContain('.btn-deactivate');
  });
});
