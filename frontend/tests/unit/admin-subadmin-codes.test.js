import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const adminPanel = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const menuRegistry = readFileSync(
  resolve(__dirname, '../../../backend/src/admin/menuRegistry.js'),
  'utf8'
);
const migration = readFileSync(
  resolve(__dirname, '../../../backend/migrations/047_subadmin_codes_menu.sql'),
  'utf8'
);

describe('子管理员必带激活码权限', () => {
  it('菜单定义把 codes 标成 required_subadmin', () => {
    expect(menuRegistry).toMatch(/menu_key: 'codes'[\s\S]*required_subadmin: true/);
    expect(menuRegistry).toContain('function ensureRequiredSubadminMenus(');
    expect(menuRegistry).toContain("alias_menus: ['analytics-conversion', 'ops-lift', 'ops-research']");
    expect(menuRegistry).toMatch(
      /page: 'ops-board'[\s\S]{0,220}alias_menus: \['analytics-conversion', 'ops-lift', 'ops-research'\]/
    );
  });

  it('存量迁移给所有非超管写入 codes', () => {
    expect(migration).toContain("SELECT id, 'codes' FROM admin_accounts WHERE is_super = 0");
  });

  it('账号权限勾选框锁定激活码为必选', () => {
    expect(adminPanel).toContain('function requiredAdminMenuKeys(');
    expect(adminPanel).toContain('function menusWithRequired(');
    expect(adminPanel).toContain('data-required-menu="1"');
    expect(adminPanel).toContain('（必选）');
    expect(adminPanel).toContain("if (menuKey === 'codes' && currentAdminProfile) return true;");
    expect(adminPanel).toContain('「激活码」为子管理员必选权限');
  });

  it('admin_panel 缓存戳已更新', () => {
    expect(html).toContain('admin_panel.js?v=20260915-perm-match');
  });
});
