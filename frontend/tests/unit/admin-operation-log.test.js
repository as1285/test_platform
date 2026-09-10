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
});
