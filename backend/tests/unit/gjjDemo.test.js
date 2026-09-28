'use strict';

const { normalizePayload, renderCertHtml } = require('../../src/admin/gjjDemo');

describe('gjjDemo', () => {
  it('normalizePayload requires name and id', () => {
    expect(normalizePayload({}).error).toMatch(/必填/);
  });

  it('normalizePayload builds 期初 + 汇缴 rows with running balance', () => {
    const p = normalizePayload({
      name: '王梓涵',
      id_number: '371323199701195223',
      deposit_unit: '杭州云启信息技术有限公司',
      monthly_deposit: 638,
      opening_balance: 0,
      period_start: '2026-05',
      period_end: '2026-07'
    });
    expect(p.error).toBeFalsy();
    expect(p.region).toBe('hz');
    expect(p.layout).toBe('hz_official_v1');
    // 期初 + 3 个汇缴
    expect(p.rows.length).toBe(4);
    expect(p.rows[0].summary).toBe('期初');
    expect(p.rows[0].balance).toBe(0);
    expect(p.rows[1].summary).toBe('汇缴202605');
    expect(p.rows[1].increase).toBe(638);
    expect(p.rows[1].balance).toBe(638);
    expect(p.rows[3].summary).toBe('汇缴202607');
    expect(p.rows[3].balance).toBe(1914);
    expect(p.balance).toBe(1914);
    // 自动生成账户号
    expect(String(p.customer_no).length).toBeGreaterThanOrEqual(10);
    expect(String(p.fund_account).length).toBeGreaterThanOrEqual(10);
  });

  it('normalizePayload appends cross-institution transfer row (matches sample)', () => {
    const p = normalizePayload({
      name: '王梓涵',
      id_number: '371323199701195223',
      monthly_deposit: 638,
      opening_balance: 0,
      period_start: '2026-07',
      period_end: '2026-07',
      deposit_day: 23,
      transfer_amount: 2015.65,
      transfer_date: '2026-07-24',
      print_date: '2026-08-24'
    });
    expect(p.error).toBeFalsy();
    expect(p.rows.length).toBe(3);
    expect(p.rows[1].date).toBe('20260723');
    expect(p.rows[1].summary).toBe('汇缴202607');
    expect(p.rows[2].summary).toBe('跨机构个人账户余额转移');
    expect(p.rows[2].date).toBe('20260724');
    expect(p.rows[2].increase).toBe(2015.65);
    expect(p.rows[2].balance).toBe(2653.65);
    expect(p.balance).toBe(2653.65);
    // 对账日期默认：打印日期，及一年前
    expect(p.statement_end).toBe('20260824');
    expect(p.statement_start).toBe('20250824');
    expect(p.print_date).toBe('20260824');
  });

  it('normalizePayload accepts explicit rows and recomputes balance', () => {
    const p = normalizePayload({
      name: '李四',
      id_number: '330106199001011234',
      opening_balance: 100,
      rows: [
        { summary: '期初' },
        { date: '20260101', summary: '汇缴202601', increase: 500 },
        { date: '20260201', summary: '部分提取', decrease: 200 }
      ]
    });
    expect(p.error).toBeFalsy();
    expect(p.rows.length).toBe(3);
    expect(p.rows[0].balance).toBe(100);
    expect(p.rows[1].balance).toBe(600);
    expect(p.rows[2].balance).toBe(400);
    expect(p.balance).toBe(400);
  });

  it('renderCertHtml escapes name and includes title/seal/qr', () => {
    const p = normalizePayload({
      name: '<script>',
      id_number: '330106199001011234',
      period_start: '2026-01',
      period_end: '2026-01'
    });
    const html = renderCertHtml(p, { show_url: 'https://example.test/gjjmock/x/show.pdf' });
    expect(html).toContain('杭州住房公积金管理中心一般住房公积金个人年度对账单');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toMatch(/<td[^>]*>\s*<script>/i);
    expect(html).toContain('gjj_hz_seal.png');
    expect(html).toContain('序号');
    expect(html).toContain('记账日期');
    expect(html).toContain('余额');
    expect(html).toContain('https://example.test/gjjmock/x/show.pdf');
  });
});
