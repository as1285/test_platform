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

  it('normalizePayload builds Wuhan month rows in reverse chrono split', () => {
    const p = normalizePayload({
      region: 'wh',
      name: '张志龙',
      id_number: '340826200006245634',
      gender: '男',
      company_name: '武汉天创建设集团有限公司',
      unit_code: '100565022',
      person_no: '10060631090',
      insurance_type: '企业养老',
      area: '武汉市',
      period_start: '2024-07',
      period_end: '2025-01',
      base_amount: 6120
    });
    expect(p.error).toBeFalsy();
    expect(p.region).toBe('wh');
    expect(p.layout).toBe('wh_official_v1');
    expect(p.person_no).toBe('10060631090');
    expect(p.unit_code).toBe('100565022');
    expect(p.insurance_type).toBe('企业养老');
    expect(p.area).toBe('武汉市');
    expect(p.local_month_count).toBe(7);
    expect(p.months.length).toBe(7);
    expect(p.months[0].ym).toBe('202407');
    expect(p.months[6].ym).toBe('202501');
    expect(p.months[0].status).toBe('正常');
    expect(p.watermark_id).toMatch(/^\d{12}-\d{10}$/);
    const html = renderCertHtml(p, {}, { authCode: '2026 0819 1624 027Y 32L1' });
    expect(html).toContain('湖北省社会保险参保证明（个人专用）');
    expect(html).toContain('张志龙');
    expect(html).toContain('10060631090');
    expect(html).toContain('340826200006245634');
    expect(html).toContain('近12个月参保缴费情况');
    expect(html).toContain('缴费类型');
    expect(html).toContain('正常');
    expect(html).not.toContain('近36个月参保缴费情况');
    expect(html).toContain('202501');
    expect(html).toContain('202407');
    expect(html).toContain('https://hbsb.hb12333.com/hbrswt/template/dzsbzmyz.html');
    expect(html).toContain('2026 0819 1624 027Y 32L1');
    expect(html).toContain('社会保障号:中国公民的“社会保障号”为身份证号');
    expect(html).toContain('本地缴费月数是指：参保缴费地实际缴费月数与转入缴费月数之和');
    expect(html).toContain('sbdy_wh_seal.png');
    expect(html).toContain('企业养老');
    expect(html).not.toContain('本文件由全国社保卡服务平台');
    expect(html).not.toContain('class="wm"');
    expect(html.indexOf('202501')).toBeLessThan(html.indexOf('202407'));
  });

  it('Wuhan table shows last 12 months newest-first when period is longer', () => {
    const p = normalizePayload({
      region: 'wh',
      name: '杨大富',
      id_number: '420881196305166819',
      gender: '男',
      company_name: '武汉美艺印刷包装有限公司',
      period_start: '2022-08',
      period_end: '2024-09',
      base_amount: 4224
    });
    expect(p.error).toBeFalsy();
    expect(p.local_month_count).toBe(26);
    expect(p.months.length).toBe(26);
    const html = renderCertHtml(p, {}, { authCode: '2025 0219 1005 417X TTIP' });
    expect(html).toContain('近12个月参保缴费情况');
    expect(html).toContain('202409');
    expect(html).toContain('202310');
    expect(html).not.toContain('202208');
    expect(html).not.toContain('202209');
    expect(html.indexOf('202409')).toBeLessThan(html.indexOf('202404'));
    expect(html.indexOf('202403')).toBeLessThan(html.indexOf('202310'));
  });
});
