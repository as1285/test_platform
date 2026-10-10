import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const loader = readFileSync(resolve(__dirname, '../../public/js/admin/loader.js'), 'utf8');
const src = readFileSync(resolve(__dirname, '../../public/js/admin/modules/payment-orders.js'), 'utf8');

describe('admin payment orders', () => {
  beforeEach(() => {
    delete window.AdminModules;
    document.body.innerHTML =
      '<p id="payOrderStat"></p>' +
      '<span id="payOrderPageInfo"></span>' +
      '<table><tbody id="payOrderTbody"></tbody></table>';
    // eslint-disable-next-line no-eval
    eval(src);
  });

  it('ships page, filters and loader', () => {
    expect(html).toContain('id="page-payment-orders"');
    expect(html).toContain('id="payOrderQ"');
    expect(html).toContain('option value="pending"');
    expect(html).toContain('option value="paid_not_active"');
    expect(html).toContain('href="#payment-orders"');
    expect(loader).toContain('payment-orders.js?v=20260907-hub6');
    expect(src).toContain('api/admin/payment-orders');
  });

  it('renders paid-not-active flag and jumps to user', () => {
    const mod = window.AdminModules['payment-orders'];
    expect(mod.statusLabel('pending')).toBe('待付');
    expect(mod.activeLabel({ currently_active: false, account_active: false })).toBe('未开通');
    mod.renderRows({
      total: 1,
      page: 1,
      limit: 20,
      list: [
        {
          username: '2216955147',
          label: '周卡',
          amount: 120,
          status: 'paid',
          currently_active: false,
          account_active: false,
          paid_not_active: true,
          out_trade_no: 'T20260907',
          alipay_trade_no: 'A1',
          created_at: '2026-09-07T01:00:00.000Z'
        }
      ]
    });
    const out = document.getElementById('payOrderTbody').innerHTML;
    expect(out).toContain('付了没开通');
    expect(out).toContain('T20260907');
    expect(out).toContain('已支付');
    expect(out).toContain('data-u="2216955147"');
  });
});
