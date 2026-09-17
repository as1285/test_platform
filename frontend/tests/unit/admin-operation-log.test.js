import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const panel = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const loader = readFileSync(resolve(__dirname, '../../public/js/admin/loader.js'), 'utf8');

describe('子管理员操作日志 TAB', () => {
  it('独立页仅超管可见，管理登录不再混操作日志', () => {
    expect(html).toContain('id="page-admin-operation-log"');
    expect(html).toContain('id="adminOpLogTbody"');
    expect(html).not.toContain('id="loginLogMode"');
    expect(panel).toContain("id: 'op-log', label: '操作日志', page: 'admin-operation-log'");
    expect(panel).toContain('function loadAdminOperationLogPage(');
    expect(panel).toContain("tabPage === 'admin-accounts' || tabPage === 'admin-operation-log'");
    expect(panel).toContain("menuKey === 'admin-operation-log'");
    expect(loader).toContain("'admin-operation-log': 'logs'");
  });

  it('列表展示进入页面和操作按钮，并上报界面事件', () => {
    expect(html).toContain('进入了哪些页面、点击了哪些按钮');
    expect(html).toContain('>页面</th>');
    expect(html).toContain('>操作</th>');
    expect(html).toContain('id="adminOpLogKindFilter"');
    expect(html).toContain('admin_panel.js?v=20260915-ops-hide');
    expect(panel).toContain('function reportAdminUiEvent(');
    expect(panel).toContain("kind === 'page'");
    expect(panel).toContain("api/admin/ui-events");
    expect(panel).toContain('row.page_label');
    expect(panel).toContain('row.button_label');
  });
});
