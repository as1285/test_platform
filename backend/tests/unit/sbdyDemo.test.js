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

  it('normalizePayload builds Shenzhen month rows', () => {
    const p = normalizePayload({
      region: 'sz',
      name: '林晓薇',
      id_number: '440305199208156018',
      company_name: '深圳市南山区云启信息技术有限公司',
      unit_code: '44018826',
      computer_no: '089216473',
      period_start: '2025-07',
      period_end: '2025-09',
      base_amount: 4492
    });
    expect(p.error).toBeFalsy();
    expect(p.region).toBe('sz');
    expect(p.layout).toBe('sz_official_v1');
    expect(p.computer_no).toBe('089216473');
    expect(p.unit_code).toBe('44018826');
    expect(p.months.length).toBe(3);
    expect(p.months[0].pension_unit).toBe(718.72);
    expect(p.months[0].pension_person).toBe(359.36);
    expect(p.months[0].medical_type).toBe('1');
    expect(p.months[0].medical_unit).toBe(224.6);
    expect(p.months[0].maternity_unit).toBe(22.46);
    expect(p.months[0].injury_unit).toBeCloseTo(8.98, 2);
    expect(p.months[0].unemp_unit).toBeCloseTo(35.94, 2);
    expect(p.months[0].unemp_person).toBeCloseTo(8.98, 2);
    const html = renderCertHtml(p, { show_url: 'https://example.test/show.pdf' }, { authCode: 'abc123' });
    expect(html).toContain('深圳市社会保险历年参保缴费明细表');
    expect(html).toContain('林晓薇');
    expect(html).toContain('abc123');
    expect(html).toContain('44018826');
    expect(html).toContain('.seal-top{position:absolute;right:8px;top:4px;width:86px');
    expect(html).toContain('h1{text-align:center;font-size:18px;margin:58px 96px 12px 72px');
    expect(html).toContain('<th colspan="3">养老保险</th><th colspan="4">医疗保险</th><th colspan="3">生育</th>');
    expect(html).toContain('<th colspan="2">工伤保险</th><th colspan="3">失业保险</th>');
    expect(html).toContain('<colgroup>');
    expect(html).toContain('unit-map');
    expect(html).not.toContain('table.map');
  });

  it('Shenzhen unit map supports multiple employers without table borders', () => {
    const p = normalizePayload({
      region: 'sz',
      name: '邱测',
      id_number: '440305199001011234',
      company_name: '武汉佰钧成技术有限责任公司深圳分公司',
      unit_code: '31572310',
      period_start: '2024-05',
      period_end: '2024-06',
      unit_map: [
        { unit_code: '31572310', unit_name: '武汉佰钧成技术有限责任公司深圳分公司' },
        { unit_code: '31199615', unit_name: '人力宝科技有限公司深圳分公司' },
        { unit_code: '167120', unit_name: '深圳中智经济技术合作有限公司（一）' }
      ]
    });
    expect(p.error).toBeFalsy();
    expect(p.unit_map.length).toBe(3);
    const html = renderCertHtml(p, {}, { authCode: '3391ece788896b7h' });
    expect(html).toContain('unit-map-row');
    expect(html).toContain('31572310');
    expect(html).toContain('31199615');
    expect(html).toContain('167120');
    expect(html).toContain('人力宝科技有限公司深圳分公司');
    expect(html).not.toMatch(/table\.map|class="map"/);
  });
});
