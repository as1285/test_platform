'use strict';

const {
  mapRecordsToTransactions,
  isSalaryLike,
  paydayIso,
  ymToIndex,
  ipAllowed,
  parseAllowlist,
  getPartnerClientIp,
  timingSafeEqualStr,
  extractApiKey,
  validateUsername
} = require('../../src/partner/bankSalaryFlow');

describe('bankSalaryFlow mapper', () => {
  const records = [
    {
      id: 'a',
      year: 2025,
      month: 3,
      income_type: '工资薪金',
      income_subtype: '正常工资薪金',
      company_name: '杭州某某科技有限公司',
      company_tax_id: '91330100MA',
      tax_period: '2025-03',
      income: '15000.00',
      income_this_period: '15000.00',
      tax_reported: '710.00'
    },
    {
      id: 'b',
      year: 2025,
      month: 4,
      income_type: '工资薪金',
      income_subtype: '全年一次性奖金收入',
      company_name: '杭州某某科技有限公司',
      income: '30000',
      tax_reported: '900'
    },
    {
      id: 'c',
      year: 2024,
      month: 12,
      income_type: '劳务报酬',
      income_subtype: '',
      company_name: '另一家公司',
      income_this_period: '2000',
      tax_reported: '0'
    }
  ];

  it('maps salary-like records and skips bonus by default', () => {
    const out = mapRecordsToTransactions(records);
    expect(out.count).toBe(2);
    expect(out.employer).toBe('杭州某某科技有限公司');
    expect(out.income_total).toBe('17000.00');
    expect(out.transactions[0].date).toBe('2024-12-15 09:18:00');
    expect(out.transactions[1].amount).toBe('15000.00');
    expect(out.transactions[1].counterparty_name).toBe('杭州某某科技有限公司');
    expect(out.transactions[1].tax_record_id).toBe('a');
  });

  it('includes bonus when asked', () => {
    const out = mapRecordsToTransactions(records, { include_bonus: true });
    expect(out.count).toBe(3);
    expect(out.transactions.some((t) => t.summary === '全年一次性奖金收入')).toBe(true);
  });

  it('filters by year-month range', () => {
    const out = mapRecordsToTransactions(records, { from_ym: '2025-01', to_ym: '2025-12' });
    expect(out.count).toBe(1);
    expect(out.transactions[0].id).toBe('a');
  });

  it('classifies salary vs bonus', () => {
    expect(isSalaryLike({ income_type: '工资薪金所得', income_subtype: '正常工资薪金' }, false)).toBe(
      true
    );
    expect(isSalaryLike({ income_subtype: '全年一次性奖金收入' }, false)).toBe(false);
    expect(isSalaryLike({ income_subtype: '全年一次性奖金收入' }, true)).toBe(true);
  });

  it('formats payday and ym index', () => {
    expect(paydayIso(2026, 8)).toBe('2026-08-15 09:18:00');
    expect(ymToIndex('2026-08')).toBe(2026 * 12 + 8);
    expect(ymToIndex('bad')).toBeNaN();
  });
});

describe('bankSalaryFlow auth helpers', () => {
  it('parses allowlist and matches IP', () => {
    const list = parseAllowlist('43.128.147.171, 127.0.0.1');
    expect(list).toEqual(['43.128.147.171', '127.0.0.1']);
    expect(ipAllowed('43.128.147.171', list)).toBe(true);
    expect(ipAllowed('172.18.0.1', list)).toBe(true);
    expect(ipAllowed('1.1.1.1', list)).toBe(false);
    expect(ipAllowed('1.1.1.1', [])).toBe(true);
  });

  it('uses the partner hop, not the end-user XFF/CF IP', () => {
    expect(
      getPartnerClientIp({
        headers: {
          'cf-connecting-ip': '8.8.8.8',
          'x-forwarded-for': '1.2.3.4, 43.128.147.171',
          'x-real-ip': '43.128.147.171'
        }
      })
    ).toBe('43.128.147.171');
    expect(
      getPartnerClientIp({
        headers: { 'x-forwarded-for': '1.2.3.4, 43.128.147.171' }
      })
    ).toBe('43.128.147.171');
  });

  it('compares secrets without throwing on length mismatch', () => {
    expect(timingSafeEqualStr('abc', 'abc')).toBe(true);
    expect(timingSafeEqualStr('abc', 'abcd')).toBe(false);
  });

  it('extracts API key from header or bearer', () => {
    expect(extractApiKey({ headers: { 'x-bank-api-key': ' k1 ' } })).toBe('k1');
    expect(extractApiKey({ headers: { authorization: 'Bearer k2' } })).toBe('k2');
    expect(extractApiKey({ headers: {}, body: { api_key: 'k3' } })).toBe('k3');
  });

  it('validates username like tax login', () => {
    expect(validateUsername('13800138000')).toBe(null);
    expect(validateUsername('demo_user')).toBe(null);
    expect(validateUsername('bad name')).toMatch(/仅支持/);
    expect(validateUsername('')).toMatch(/不能为空/);
  });
});
