import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const ops = readFileSync(
  resolve(__dirname, '../../public/js/admin/modules/ops-conversion.js'),
  'utf8'
);
const loader = readFileSync(resolve(__dirname, '../../public/js/admin/loader.js'), 'utf8');
const css = readFileSync(resolve(__dirname, '../../css/admin_panel.css'), 'utf8');

const boardPayload = {
  code: 200,
  data: {
    dau: {
      mode: 'same_clock',
      live: true,
      as_of: '14:20',
      vs_compare_pct: 72,
      vs_week_pct: 105,
      caption: '同时点 = 北京当天 0:00 到现在。',
      current: { date: '2026-09-15', weekday: '二', dau_ip: 59, accounts: 63, returning: 54, new_users: 9 },
      compare: { date: '2026-09-14', weekday: '一', dau_ip: 82, accounts: 89 },
      week: { date: '2026-09-08', weekday: '二', dau_ip: 56, accounts: 58 },
      hourly: {
        hours: [12, 13, 14],
        current: [46, 54, 57],
        compare: [62, 70, 79]
      },
      history: [
        { date: '2026-09-14', weekday: '一', dau_ip: 83, accounts: 89 },
        { date: '2026-09-15', weekday: '二', dau_ip: 59, accounts: 63 }
      ]
    },
    today: {
      date: '2026-09-15',
      date_from: '2026-09-15',
      date_to: '2026-09-15',
      is_single: true,
      is_today: true,
      register: 9,
      activate: 3,
      pay_orders: 6,
      pay_gmv: 320,
      pay_orders_gmv: 200,
      tax_edit_gmv: 120,
      gmv_by_sku: []
    },
    stock: {
      d1_only: 1,
      high_income: 2,
      purchase_no_pay: 3,
      refund_eligible: 4
    },
    research: {
      funnel: {
        registered: 10,
        activated: 4,
        activate_pct: 40,
        unact_has_tax: 1,
        unact_no_tax: 2,
        unact_saw_pay: 3,
        unact_high_income: 1,
        opened_fill_no_submit: 0
      }
    }
  }
};

describe('运营看板同时点日活', () => {
  it('页面、接口字段与缓存戳齐全', () => {
    expect(html).toContain('id="opsBoardDau"');
    expect(html).toContain('admin_panel.css?v=20260915-dau-clock');
    expect(html).toContain('loader.js?v=20260915-dau-clock');
    expect(ops).toContain('function renderDau(');
    expect(ops).toContain('function sparkLineSvg(');
    expect(ops).toContain('data.dau');
    expect(loader).toContain('ops-conversion.js?v=20260915-dau-clock');
    expect(css).toContain('.ops-board-dau-kpis');
    expect(css).toContain('.ops-board-dau-charts');
  });

  it('看板加载后渲染同时点对比数字和曲线', async () => {
    document.body.innerHTML =
      '<div id="opsBoardDateFrom"></div>' +
      '<div id="opsBoardDateTo"></div>' +
      '<div id="opsBoardDau"></div>' +
      '<div id="opsBoardKpi"></div>' +
      '<div id="opsBoardTodo"></div>' +
      '<div id="opsBoardResearch"></div>';
    window.adminFetch = vi.fn(function () {
      return Promise.resolve({
        json: function () {
          return Promise.resolve(boardPayload);
        }
      });
    });
    window.location.hash = '#ops-board';
    window.AdminModules = {};
    // eslint-disable-next-line no-eval
    eval(ops);
    window.AdminModules['ops-conversion'].loadPage();
    await Promise.resolve();
    await Promise.resolve();
    var dau = document.getElementById('opsBoardDau');
    expect(dau.textContent).toContain('同时点日活');
    expect(dau.textContent).toContain('59');
    expect(dau.textContent).toContain('82');
    expect(dau.textContent).toContain('72%');
    expect(dau.textContent).toContain('上周二同时点');
    expect(dau.innerHTML).toContain('polyline');
    expect(dau.textContent).toContain('近 14 日同一截点');
    expect(document.getElementById('opsBoardKpi').textContent).toContain('今日注册');
  });
});
