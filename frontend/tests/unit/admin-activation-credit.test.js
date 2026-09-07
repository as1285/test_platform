import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const panel = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const css = readFileSync(resolve(__dirname, '../../css/admin_panel.css'), 'utf8');

describe('注册用户列表可保存激活金额', () => {
  it('列表有激活金额列，弹窗可填，支付分析按填写金额展示', () => {
    expect(html).toContain('激活金额');
    expect(html).toContain('id="userActivateCreditAmount"');
    expect(html).toContain('按注册用户列表填写的');
    expect(html).toContain('admin_panel.js?v=20260907-abc-ops');
    expect(html).toContain('admin_panel.css?v=20260907-abc-ops');
    expect(panel).toContain("key !== 'Enter'");
    expect(panel).not.toContain('btn-user-credit-save');
    expect(html).toContain('线上已付开通会自动带出实收');
    expect(html).toContain('id="userActivateCreditWrap"');
    expect(html).toContain('col-activation-credit');
    expect(panel).toContain('saveUserActivationCredit');
    expect(panel).toContain('function canViewActivationCredit');
    expect(panel).toContain('function syncActivationCreditVisibility');
    expect(panel).toContain('displayUserActivationAmount');
    expect(panel).toContain('paid_activation_amount');
    expect(panel).toContain("adminFetch('api/admin/user-activation-credit'");
    expect(panel).toContain('user-credit-amt-input');
    expect(panel).toContain('placeholder="填金额"');
    expect(panel).toContain('按填写金额');
    expect(panel).toContain('body.credit_amount = creditEl.value');
    expect(css).toContain('.user-credit-amt-input');
  });
});
