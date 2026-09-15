import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const panel = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const routes = readFileSync(
  resolve(__dirname, '../../../backend/src/admin/routes.js'),
  'utf8'
);
const monolith = readFileSync(
  resolve(__dirname, '../../../backend/src/legacy/monolith.js'),
  'utf8'
);

describe('注册用户可开通完税二维码权限', () => {
  it('列表有开通完税码按钮并走独立接口', () => {
    expect(panel).toContain('btn-user-najilu-unlock');
    expect(panel).toContain('开通完税码');
    expect(panel).toContain('关闭完税码');
    expect(panel).toContain('api/admin/user-najilu-qr-unlock');
    expect(panel).toContain('najilu_qr_unlocked');
    expect(html).toContain('离职证明、在职证明、完税二维码');
    expect(html).toContain('admin_panel.js?v=20260915-subadmin-codes');
    expect(routes).toContain('/api/admin/user-najilu-qr-unlock');
    expect(routes).toContain('handleAdminUserNajiluQrUnlock');
    expect(monolith).toContain('function handleAdminUserNajiluQrUnlock');
    expect(monolith).toContain('najilu_qr_unlocked');
  });
});
