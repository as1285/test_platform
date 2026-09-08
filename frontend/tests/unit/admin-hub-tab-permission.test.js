import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const adminPanel = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const menuRegistry = readFileSync(
  resolve(__dirname, '../../../backend/src/admin/menuRegistry.js'),
  'utf8'
);

describe('所有 hub 无权限 TAB 隐藏', () => {
  it('adminCanSeeHubTab 全分区：主 TAB 精确、strict 子 TAB 精确、其余可跟 hub', () => {
    expect(adminPanel).toContain('function adminHasExactMenu(');
    expect(adminPanel).toContain('function adminCanSeeHubTab(');
    expect(adminPanel).toContain('function listVisibleHubTabs(');
    expect(adminPanel).toContain('任意 hub 内 TAB：无权限则不显示');
    expect(adminPanel).toContain("tabPage === 'blocked-ips' || tabPage === 'server-monitor'");
    expect(adminPanel).toContain('adminHasExactMenu(hubKey)');
    expect(adminPanel).toContain('listVisibleHubTabs(hubKey)');
    /* 不再把非 login-log hub 直接整段放行 */
    expect(adminPanel).not.toMatch(
      /if \(hubKey !== 'login-log'\) \{\s*return adminHasMenu\(tabPage\);\s*\}/
    );
  });

  it('后端独立 TAB 去掉 login-log 别名继承', () => {
    expect(menuRegistry).toContain('strict_hub_tab: true');
    expect(menuRegistry).toMatch(/page: 'blocked-ips'[\s\S]*strict_hub_tab: true/);
    expect(menuRegistry).toMatch(/page: 'server-monitor'[\s\S]*strict_hub_tab: true/);
    expect(menuRegistry).toMatch(/page: 'downline-admins'[\s\S]*strict_hub_tab: true/);
    expect(menuRegistry).toContain('if (contentOnlyDef.strict_hub_tab) return false');
  });

  it('admin_panel 缓存戳已更新', () => {
    expect(html).toContain('admin_panel.js?v=20260908-hub-tab-v4');
  });
});
