'use strict';

const { normalizePayload, renderCertHtml } = require('../../src/admin/sbdyDemo');

describe('sbdyDemo', () => {
  it('normalizePayload requires name and id', () => {
    expect(normalizePayload({}).error).toMatch(/必填/);
  });

  it('normalizePayload builds months', () => {
    const p = normalizePayload({
      name: '测试',
      id_number: '330106199001011234',
      company_name: '示例公司',
      period_start: '2024-01',
      period_end: '2024-03',
      base_amount: 5000
    });
    expect(p.error).toBeFalsy();
    expect(p.months.length).toBe(3);
    expect(p.name).toBe('测试');
  });

  it('renderCertHtml escapes name in table cell', () => {
    const p = normalizePayload({
      name: '<script>',
      id_number: '330106199001011234',
      period_start: '2024-01',
      period_end: '2024-01'
    });
    const html = renderCertHtml(p);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toMatch(/<td[^>]*>\s*<script>/i);
  });
});
