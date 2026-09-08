import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const adminPanel = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const menuRegistry = readFileSync(
  resolve(__dirname, '../../../backend/src/admin/menuRegistry.js'),
  'utf8'
);

describe('系统与安全 hub TAB 按精确权限显示', () => {
  it('前端有 adminCanSeeHubTab / adminHasExactMenu，且 TAB 过滤走独立授权', () => {
    expect(adminPanel).toContain('function adminHasExactMenu(');
    expect(adminPanel).toContain('function adminCanSeeHubTab(');
    expect(adminPanel).toContain('function listVisibleHubTabs(');
    expect(adminPanel).toContain("tabPage === 'blocked-ips'");
    expect(adminPanel).toContain("tabPage === 'server-monitor'");
    expect(adminPanel).toContain("adminHasExactMenu('login-log')");
    expect(adminPanel).toContain('listVisibleHubTabs(hubKey)');
    expect(adminPanel).toMatch(/无权限 TAB：落到该 hub 第一个可见 TAB/);
  });

  it('后端独立 TAB 去掉 login-log 别名继承', () => {
    expect(menuRegistry).toContain('strict_hub_tab: true');
    expect(menuRegistry).toMatch(/page: 'blocked-ips'[\s\S]*strict_hub_tab: true/);
    expect(menuRegistry).toMatch(/page: 'server-monitor'[\s\S]*strict_hub_tab: true/);
    expect(menuRegistry).toMatch(/page: 'downline-admins'[\s\S]*strict_hub_tab: true/);
    expect(menuRegistry).toContain("if (contentOnlyDef.strict_hub_tab) return false");
  });

  it('admin_panel 缓存戳已更新', () => {
    expect(html).toContain('admin_panel.js?v=20260908-hub-tab-v3');
  });
});
