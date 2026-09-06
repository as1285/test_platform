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

  it('assigns per-month unit codes for multi-employer via month_units', () => {
    const p = normalizePayload({
      name: '张三',
      id_number: '371323199701195223',
      company_name: '杭州甲公司、杭州乙公司',
      credit_code: '91330109MAETP27PX2、91330110MADG8XY7Q',
      period_start: '2025-04',
      period_end: '2025-07',
      base_amount: 4986,
      month_units: {
        '2025-04': '91330109MAETP27PX2',
        '2025-05': '91330109MAETP27PX2',
        '2025-06': '91330110MADG8XY7Q',
        '2025-07': '91330110MADG8XY7Q'
      }
    });
    expect(p.error).toBeFalsy();
    expect(p.months.length).toBe(4);
    expect(p.months[0].unit_code).toBe('91330109MAETP27PX2');
    expect(p.months[1].unit_code).toBe('91330109MAETP27PX2');
    expect(p.months[2].unit_code).toBe('91330110MADG8XY7Q');
    expect(p.months[3].unit_code).toBe('91330110MADG8XY7Q');
    /* 头部只保留最近一家（对齐末月单位编号）；明细仍按月各自单位 */
    expect(p.credit_code).toBe('91330110MADG8XY7Q');
    expect(p.company_name).toBe('杭州乙公司');
    expect(p.company_display).toBe('杭州乙公司（91330110MADG8XY7Q）');
  });

  it('falls back to primary (first) credit code when no month_units', () => {
    const p = normalizePayload({
      name: '张三',
      id_number: '371323199701195223',
      credit_code: '91330109MAETP27PX2、91330110MADG8XY7Q',
      period_start: '2025-04',
      period_end: '2025-05'
    });
    expect(p.months[0].unit_code).toBe('91330109MAETP27PX2');
    expect(p.months[1].unit_code).toBe('91330109MAETP27PX2');
  });

  it('builds per-segment months with own unit/area/base (multi-district)', () => {
    const p = normalizePayload({
      name: '王龙雪',
      id_number: '371323199701195223',
      segments: [
        {
          company_name: '杭州华鲜高新技术有限公司',
          credit_code: '91330110MADG8JH092',
          area: '滨江区',
          base_amount: 5000,
          period_start: '2025-04',
          period_end: '2026-06'
        },
        {
          company_name: '杭州圆趣企业运营管理有限公司',
          credit_code: '91330109MAETP27PX2',
          area: '余杭区',
          base_amount: 6000,
          period_start: '2026-07',
          period_end: '2026-08'
        }
      ]
    });
    expect(p.error).toBeFalsy();
    expect(p.months.length).toBe(17);
    expect(p.months[0].unit_code).toBe('91330110MADG8JH092');
    expect(p.months[0].area).toBe('滨江区');
    expect(p.months[0].pension_base).toBe(5000);
    expect(p.months[0].pension_pay).toBe(400);
    const aug = p.months[p.months.length - 1];
    expect(aug.unit_code).toBe('91330109MAETP27PX2');
    expect(aug.area).toBe('余杭区');
    expect(aug.pension_base).toBe(6000);
    /* 头部参保单位/信用代码/参保地只保留最近一段；明细仍含多段 */
    expect(p.area).toBe('余杭区');
    expect(p.credit_code).toBe('91330109MAETP27PX2');
    expect(p.company_name).toBe('杭州圆趣企业运营管理有限公司');
    expect(p.company_display).toBe('杭州圆趣企业运营管理有限公司（91330109MAETP27PX2）');
    expect(p.company_display).not.toContain('华鲜');
    expect(p.contribution_period_start).toBe('2025-04');
    expect(p.contribution_period_end).toBe('2026-08');
    expect(p.period_start).toBe('2024-09');
    expect(p.period_end).toBe('2026-08');
    expect(p.status_pension).toBe('参保缴费');
  });

  it('scales Zhejiang personal pays by each segment base using the header rate', () => {
    const p = normalizePayload({
      name: '王龙雪',
      id_number: '371323199701195223',
      base_amount: 4986,
      pension_pay: 398,
      unemployment_pay: 25,
      segments: [
        {
          company_name: '杭州华鲜高新技术有限公司',
          credit_code: '91330110MADG8JH092',
          area: '余杭区',
          base_amount: 5000,
          period_start: '2025-04',
          period_end: '2026-06'
        },
        {
          company_name: '杭州圆趣企业运营管理有限公司',
          credit_code: '91330109MAETP27PX2',
          area: '萧山区',
          base_amount: 4986,
          period_start: '2026-07',
          period_end: '2026-07'
        }
      ]
    });
    expect(p.error).toBeFalsy();
    expect(p.months[0].pension_base).toBe(5000);
    expect(p.months[0].pension_pay).toBe(399.12);
    expect(p.months[0].unemp_pay).toBe(25.07);
    const last = p.months[p.months.length - 1];
    expect(last.pension_base).toBe(4986);
    expect(last.pension_pay).toBe(398);
    expect(last.unemp_pay).toBe(25);
  });

  it('prints official Zhejiang header: 参保缴费 and last 24 months', () => {
    const p = normalizePayload({
      name: '王龙雪',
      id_number: '371323199701195223',
      status_pension: '正常参保',
      status_injury: '正常参保',
      status_unemployment: '正常参保',
      segments: [
        {
          company_name: '杭州华鲜高新技术有限公司',
          credit_code: '91330110MADG8JH092',
          area: '余杭区',
          base_amount: 5000,
          period_start: '2025-04',
          period_end: '2026-06'
        },
        {
          company_name: '杭州圆趣企业运营管理有限公司',
          credit_code: '91330109MAETP27PX2',
          area: '萧山区',
          base_amount: 4986,
          period_start: '2026-07',
          period_end: '2026-07'
        }
      ]
    });
    expect(p.period_start).toBe('2024-08');
    expect(p.period_end).toBe('2026-07');
    expect(p.contribution_period_start).toBe('2025-04');
    expect(p.status_pension).toBe('参保缴费');
    const html = renderCertHtml(p, { show_url: 'https://example.test/show.pdf' });
    expect(html).toContain('出具证明前24个月缴费情况（2024年08月-2026年07月）');
    expect(html).toContain('参保缴费');
    expect(html).not.toContain('正常参保');
    expect(html).not.toContain('出具证明前16个月缴费情况');
  });

  it('keeps the selected window and labels its full Zhejiang month span', () => {
    const p = normalizePayload({
      region: 'zj',
      name: '王龙雪',
      id_number: '371323199701195223',
      period_start: '2024-08',
      period_end: '2026-07',
      segments: [
        {
          company_name: '杭州华鲜高新技术有限公司',
          credit_code: '91330110MADG8JH092',
          area: '余杭区',
          base_amount: 5000,
          period_start: '2025-04',
          period_end: '2026-07'
        }
      ]
    });
    expect(p.error).toBeFalsy();
    expect(p.months).toHaveLength(16);
    expect(p.period_start).toBe('2024-08');
    expect(p.period_end).toBe('2026-07');
    expect(p.contribution_period_start).toBe('2025-04');
    expect(p.contribution_period_end).toBe('2026-07');
    const html = renderCertHtml(p, { show_url: 'https://example.test/show.pdf' });
    expect(html).toContain('出具证明前24个月缴费情况（2024年08月-2026年07月）');
    expect(html).not.toContain('出具证明前16个月缴费情况');
  });

  it('normalizes Zhejiang paused statuses without the Jiangsu interrupted suffix', () => {
    const p = normalizePayload({
      region: 'zj',
      name: '李晓晴',
      id_number: '371323199904156523',
      company_name: '杭州百伦思宠物用品有限公司',
      credit_code: '91310113630842640E',
      period_start: '2025-06',
      period_end: '2025-06',
      status_pension: '暂停缴费（中断）',
      status_medical: '暂停缴费（中断）',
      status_injury: '暂停缴费（中断）',
      status_unemployment: '暂停缴费（中断）'
    });
    expect(p.status_pension).toBe('暂停缴费');
    expect(p.status_medical).toBe('暂停缴费');
    expect(p.status_injury).toBe('暂停缴费');
    expect(p.status_unemployment).toBe('暂停缴费');
    const html = renderCertHtml(p, {});
    expect(html).toContain('暂停缴费');
    expect(html).not.toContain('暂停缴费（中断）');
  });

  it('rejects segments that have unit but no valid period (no silent empty cert)', () => {
    const p = normalizePayload({
      name: '王龙雪',
      id_number: '371323199701195223',
      period_start: '2024-08',
      period_end: '2026-07',
      segments: [
        { company_name: '杭州华鲜高新技术有限公司', credit_code: '91330110MADG8JH092' }
      ]
    });
    expect(p.error).toMatch(/起止月/);
  });

  it('rejects segments missing credit code or with duplicate start month', () => {
    const noCredit = normalizePayload({
      name: '王龙雪',
      id_number: '371323199701195223',
      segments: [
        { company_name: '杭州华鲜高新技术有限公司', credit_code: '91330110MADG8JH092', period_start: '2024-08', period_end: '2025-06' },
        { company_name: '青岛智腾微电子科技有限公司', credit_code: '', period_start: '2025-07', period_end: '2026-07' }
      ]
    });
    expect(noCredit.error).toMatch(/信用代码/);
    const dupStart = normalizePayload({
      name: '王龙雪',
      id_number: '371323199701195223',
      segments: [
        { company_name: '杭州华鲜高新技术有限公司', credit_code: '91330110MADG8JH092', period_start: '2024-08', period_end: '2026-07' },
        { company_name: '杭州圆趣企业运营管理有限公司', credit_code: '91330109MAETP27PX2', period_start: '2024-08', period_end: '2026-07' }
      ]
    });
    expect(dupStart.error).toMatch(/起月相同/);
  });

  it('joined multi-company header keeps only latest by month unit', () => {
    const p = normalizePayload({
      name: '王龙雪',
      id_number: '371323199701195223',
      company_name: '杭州华鲜高新技术有限公司、青岛智腾微电子科技有限公司',
      credit_code: '91330110MADG8JH092',
      period_start: '2025-01',
      period_end: '2025-03',
      month_units: {
        '2025-01': 'OLDCODE11111111111',
        '2025-02': '91330110MADG8JH092',
        '2025-03': '91330110MADG8JH092'
      }
    });
    expect(p.error).toBeFalsy();
    expect(p.company_name).toBe('青岛智腾微电子科技有限公司');
    expect(p.credit_code).toBe('91330110MADG8JH092');
    expect(p.company_display).toBe('青岛智腾微电子科技有限公司（91330110MADG8JH092）');
    expect(p.company_display).not.toContain('华鲜');
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

  it('normalizePayload builds Guangzhou month rows with Shenzhen-identical layout', () => {
    const p = normalizePayload({
      region: 'gz',
      name: '林晓薇',
      id_number: '440305199208156018',
      company_name: '广州市南山区云启信息技术有限公司',
      unit_code: '44018826',
      computer_no: '089216473',
      period_start: '2025-07',
      period_end: '2025-09',
      base_amount: 4492
    });
    expect(p.error).toBeFalsy();
    expect(p.region).toBe('gz');
    expect(p.layout).toBe('gz_official_v1');
    expect(p.computer_no).toBe('089216473');
    expect(p.unit_code).toBe('44018826');
    expect(p.months.length).toBe(3);
    expect(p.months[0].pension_unit).toBe(718.72);
    expect(p.months[0].pension_person).toBe(359.36);
    const html = renderCertHtml(p, { show_url: 'https://example.test/show.pdf' }, { authCode: 'abc123' });
    expect(html).toContain('广州市社会保险历年参保缴费明细表');
    expect(html).toContain('广州市社会保险基金管理局');
    expect(html).toContain('/img/sbdy_gz_seal.png');
    expect(html).not.toContain('/img/sbdy_sz_seal.png');
    expect(html).not.toContain('深圳市社会保险历年参保缴费明细表');
    expect(html).not.toContain('深圳市社会保险基金管理局');
    expect(html).toContain('林晓薇');
    expect(html).toContain('abc123');
    expect(html).toContain('<th colspan="3">养老保险</th><th colspan="4">医疗保险</th><th colspan="3">生育</th>');
    expect(html).toContain('unit-map');
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

  it('normalizePayload builds Shenzhen-new participation certificate', () => {
    const p = normalizePayload({
      region: 'sz_new',
      name: '林晓薇',
      id_number: '440305199208156018',
      company_name: '深圳市易满星科技有限公司',
      unit_code: '31327084',
      computer_no: '089216473',
      period_start: '2024-09',
      period_end: '2026-08',
      base_amount: 4492,
      print_date: '2026年09月01日',
      years_months: {
        pension: 113,
        medical: 115,
        maternity: 115,
        maternity_medical: 0,
        injury: 115,
        unemployment: 115
      }
    });
    expect(p.error).toBeFalsy();
    expect(p.region).toBe('sz_new');
    expect(p.layout).toBe('sz_cgbzm_v1');
    expect(p.computer_no).toBe('089216473');
    expect(p.unit_code).toBe('31327084');
    expect(p.doc_serial).toBe('2026:09:01E');
    expect(p.months.length).toBe(24);
    expect(p.months[0].ym).toBe('202409');
    expect(p.months[0].medical_tier).toBe('2');
    expect(p.months[0].maternity_type).toBe('1');
    expect(p.years_months.pension).toBe(113);
    expect(p.years_months.maternity_medical).toBe(0);
    const html = renderCertHtml(
      p,
      { show_url: 'https://example.test/taxmock/SBDYx/show.pdf' },
      { authCode: '3359a909b3600273' }
    );
    expect(html).toContain('深圳市社会保险参保证明');
    expect(html).toContain('个人权益记录（参保证明）');
    expect(html).toContain('（一）历年参保年限');
    expect(html).toContain('（二）近两年参保缴费明细');
    expect(html).toContain('2026:09:01E');
    expect(html).toContain('林晓薇');
    expect(html).toContain('3359a909b3600273');
    expect(html).toContain('/img/sbdy_sz_new_si_seal.png');
    expect(html).toContain('/img/sbdy_sz_new_mi_seal.png');
    expect(html).toContain('下载文件');
    expect(html).toContain('本服务由深圳市人力资源和社会保障局提供');
    expect(html).toContain('缴费基数');
    expect(html).toContain('档次');
    expect(html).toContain('.sz-sec{');
    expect(html).toContain('text-align:left');
    expect(html).toContain('font-synthesis:none');
    expect(html).toContain('SimSun');
    expect(html).toContain('Noto Serif CJK SC');
    expect(html).toContain('justify-content:flex-end');
    expect(html).not.toMatch(/<h2[>\s]/);
    expect(html).not.toContain('justify-content:space-around');
    expect(html).not.toContain('深圳市社会保险历年参保缴费明细表');
    expect(html).not.toContain('/img/sbdy_sz_seal.png');
  });

  it('Shenzhen-new PDF selftest keeps titles left and embeds dual seals', () => {
    const { spawnSync } = require('child_process');
    const script = require('path').join(__dirname, '../../scripts/sbdy_sz_new_render_pdf.py');
    const r = spawnSync('python3', [script, '--selftest'], {
      encoding: 'utf8',
      timeout: 60000
    });
    const out = String(r.stdout || '') + String(r.stderr || '');
    if (r.status !== 0 && /ModuleNotFoundError|missing CJK font/.test(out)) {
      return;
    }
    expect(r.status, out).toBe(0);
    expect(out).toMatch(/selftest ok/);
    expect(out).not.toMatch(/missing|not left-aligned/);
  });

  it('Shenzhen-new aliases and multi-employer segments stay off the old sz template', () => {
    const p = normalizePayload({
      region: 'shenzhen_new',
      name: '<b>测</b>',
      id_number: '440305199208156018',
      print_date: '2026年09月01日',
      segments: [
        {
          company_name: '深圳一舱信息技术有限公司',
          unit_code: '30828370',
          base_amount: 3523,
          period_start: '2024-09',
          period_end: '2025-01'
        },
        {
          company_name: '深圳市易满星科技有限公司',
          unit_code: '31327084',
          base_amount: 4492,
          period_start: '2025-02',
          period_end: '2025-07'
        }
      ]
    });
    expect(p.error).toBeFalsy();
    expect(p.region).toBe('sz_new');
    expect(p.layout).toBe('sz_cgbzm_v1');
    expect(p.months.length).toBe(11);
    expect(p.months[0].unit_code).toBe('30828370');
    expect(p.months[0].pension_base).toBe(3523);
    expect(p.months[p.months.length - 1].unit_code).toBe('31327084');
    expect(p.unit_map.length).toBe(2);
    const html = renderCertHtml(p, {}, { authCode: 'abc123' });
    expect(html).toContain('&lt;b&gt;测&lt;/b&gt;');
    expect(html).not.toMatch(/参保人姓名：\s*<b>测<\/b>/);
    expect(html).toContain('30828370 / 深圳一舱信息技术有限公司');
    expect(html).toContain('31327084 / 深圳市易满星科技有限公司');
    const old = normalizePayload({
      region: 'sz',
      name: '林晓薇',
      id_number: '440305199208156018',
      period_start: '2025-07',
      period_end: '2025-09',
      base_amount: 4492
    });
    expect(old.region).toBe('sz');
    expect(old.layout).toBe('sz_official_v1');
    expect(renderCertHtml(old)).toContain('深圳市社会保险历年参保缴费明细表');
    expect(renderCertHtml(old)).not.toContain('（一）历年参保年限');
  });

  it('sz_cgbzm_v1 layout alias normalizes to sz_new', () => {
    const p = normalizePayload({
      layout: 'sz_cgbzm_v1',
      name: '周浩然',
      id_number: '440304199511083517',
      period_start: '2026-01',
      period_end: '2026-03'
    });
    expect(p.region).toBe('sz_new');
    expect(p.months.length).toBe(3);
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
    /* 打印时间固定为北京时间当天，忽略入参旧日期 */
    const bj = new Date(Date.now() + 8 * 3600 * 1000);
    const todayCn =
      bj.getUTCFullYear() +
      '年' +
      String(bj.getUTCMonth() + 1).padStart(2, '0') +
      '月' +
      String(bj.getUTCDate()).padStart(2, '0') +
      '日';
    const pDate = normalizePayload({
      region: 'wh',
      name: '张志龙',
      id_number: '340826200006245634',
      company_name: '武汉天创建设集团有限公司',
      period_start: '2024-07',
      period_end: '2025-01',
      print_date: '2025年02月19日'
    });
    expect(pDate.error).toBeFalsy();
    expect(pDate.print_date).toBe(todayCn);
    expect(pDate.print_date).not.toBe('2025年02月19日');
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

  it('normalizePayload builds Hunan detail rows and relations', () => {
    const p = normalizePayload({
      region: 'hn',
      name: '杨坤斌',
      id_number: '430522199711297813',
      gender: '男',
      company_name: '湖南旭昱新能源科技有限公司',
      credit_code: '91430703MA4PYMX53L',
      unit_code: '43110000000000083822',
      person_no: '43120000000103664059',
      area: '常德市鼎城区',
      period_start: '2024-05',
      period_end: '2025-04',
      base_amount: 4053
    });
    expect(p.error).toBeFalsy();
    expect(p.region).toBe('hn');
    expect(p.layout).toBe('hn_official_v1');
    expect(p.person_no).toBe('43120000000103664059');
    expect(p.unit_code).toBe('43110000000000083822');
    expect(p.agency_name).toContain('常德市鼎城区');
    expect(p.relations.length).toBe(1);
    expect(p.relations[0].items.length).toBe(3);
    expect(p.detail_rows.length).toBe(36);
    expect(p.detail_rows[0].type).toBe('工伤保险');
    expect(p.detail_rows[0].unit_pay).toBeCloseTo(56.74, 2);
    expect(p.detail_rows[2].type).toBe('企业职工基本养老保险');
    expect(p.detail_rows[2].person_pay).toBeCloseTo(324.24, 2);
  });

  it('normalizePayload builds Henan rights record months', () => {
    const p = normalizePayload({
      region: 'ha',
      name: '蒋飞龙',
      id_number: '341281199112124710',
      gender: '男',
      company_name: '人力宝科技有限公司郑州分公司',
      area: '郑州市郑东新区',
      period_start: '2026-01',
      period_end: '2026-06',
      base_amount: 4200,
      work_start_date: '2015-09-01',
      prev_balance: 69916.97,
      year_principal: 3212.4,
      year_interest: 0,
      account_months: 82,
      total_balance: 73129.37,
      ha_months: [
        { month: '01', pension_base: 19155, unemp_base: 19155, injury_base: 19155 },
        { month: '02', pension_base: 4200 },
        { month: '03', pension_base: 4200 },
        { month: '04', pension_base: 4200 },
        { month: '05', pension_base: 4200 },
        { month: '06', pension_base: 4200 }
      ]
    });
    expect(p.error).toBeFalsy();
    expect(p.region).toBe('ha');
    expect(p.layout).toBe('ha_official_v1');
    expect(p.record_year).toBe(2026);
    expect(p.work_start_date).toBe('2015-09-01');
    expect(p.ha_months.length).toBe(12);
    expect(p.ha_months[0].pension_base).toBe(19155);
    expect(p.ha_months[0].injury_flag).toBe('-');
    expect(p.ha_months[5].paid).toBe(true);
    expect(p.ha_months[6].paid).toBe(false);
    expect(p.account.prev_balance).toBeCloseTo(69916.97, 2);
    expect(p.account.year_principal).toBeCloseTo(3212.4, 2);
    expect(p.form_verify_code).toMatch(/^[a-f0-9]{32}$/);
    expect(p.status_pension).toBe('参保缴费');
  });

  it('normalizePayload builds Henan months from period and base like Zhejiang ops', () => {
    const p = normalizePayload({
      region: 'ha',
      name: '蒋飞龙',
      id_number: '341281199112124710',
      gender: '男',
      company_name: '人力宝科技有限公司郑州分公司',
      area: '郑州市郑东新区',
      period_start: '2026-01',
      period_end: '2026-06',
      base_amount: 4200
    });
    expect(p.error).toBeFalsy();
    expect(p.record_year).toBe(2026);
    expect(p.status_pension).toBe('参保缴费');
    expect(p.status_injury).toBe('参保缴费');
    expect(p.ha_months.length).toBe(12);
    expect(p.ha_months[0].paid).toBe(true);
    expect(p.ha_months[0].pension_base).toBe(4200);
    expect(p.ha_months[5].paid).toBe(true);
    expect(p.ha_months[6].paid).toBe(false);
  });

  it('normalizePayload maps Henan 暂停缴费 to official 暂停缴费（中断）', () => {
    const p = normalizePayload({
      region: 'ha',
      name: '蒋飞龙',
      id_number: '341281199112124710',
      company_name: '人力宝科技有限公司郑州分公司',
      period_start: '2026-01',
      period_end: '2026-06',
      base_amount: 4200,
      status_pension: '暂停缴费'
    });
    expect(p.error).toBeFalsy();
    expect(p.status_pension).toBe('暂停缴费（中断）');
    expect(p.enroll.pension.status).toBe('暂停缴费（中断）');
  });

  it('normalizePayload builds Henan months from Zhejiang-style segments', () => {
    const p = normalizePayload({
      region: 'ha',
      name: '蒋飞龙',
      id_number: '341281199112124710',
      period_start: '2026-01',
      period_end: '2026-06',
      base_amount: 4200,
      area: '郑州市',
      segments: [
        {
          company_name: '郑州前段劳务有限公司',
          period_start: '2026-01',
          period_end: '2026-01',
          base_amount: 19155
        },
        {
          company_name: '人力宝科技有限公司郑州分公司',
          credit_code: '91410100MA9TEST001',
          area: '郑州市郑东新区',
          period_start: '2026-02',
          period_end: '2026-06',
          base_amount: 4200
        }
      ]
    });
    expect(p.error).toBeFalsy();
    expect(p.company_name).toBe('人力宝科技有限公司郑州分公司');
    expect(p.area).toBe('郑州市郑东新区');
    expect(p.credit_code).toBe('91410100MA9TEST001');
    expect(p.ha_months[0].pension_base).toBe(19155);
    expect(p.ha_months[1].pension_base).toBe(4200);
    expect(p.ha_months[5].paid).toBe(true);
    expect(p.ha_months[6].paid).toBe(false);
  });

  it('normalizePayload builds Jiangsu per-month rows (single period)', () => {
    const p = normalizePayload({
      region: 'js',
      name: '樊宜',
      id_number: '342501199307088233',
      gender: '男',
      status: '暂停缴费（中断）',
      // 管理端通用隐藏字段可能残留浙江默认值，江苏应统一采用 status
      status_injury: '正常参保',
      status_unemployment: '正常参保',
      company_name: '南京越诚信息技术有限公司',
      area: '溧水区',
      period_start: '2024-01',
      period_end: '2024-03',
      base_amount: 5000
    });
    expect(p.error).toBeFalsy();
    expect(p.region).toBe('js');
    expect(p.layout).toBe('js_official_v1');
    expect(p.status).toBe('暂停缴费（中断）');
    expect(p.status_pension).toBe('暂停缴费（中断）');
    expect(p.status_injury).toBe('暂停缴费（中断）');
    expect(p.status_unemployment).toBe('暂停缴费（中断）');
    expect(p.company_display).toBe('南京越诚信息技术有限公司');
    expect(p.area).toBe('溧水区');
    expect(p.span_months).toBe(3);
    expect(p.period_compact).toBe('202401-202403');
    expect(p.detail_rows.length).toBe(3);
    expect(p.detail_rows[0].year).toBe(2024);
    expect(p.detail_rows[0].month).toBe('01');
    expect(p.detail_rows[0].unit_name).toBe('南京越诚信息技术有限公司');
    expect(p.detail_rows[0].pension_base).toBe(5000);
    expect(p.detail_rows[0].pension_pay).toBeCloseTo(400, 2);
    expect(p.detail_rows[0].unemp_pay).toBeCloseTo(25, 2);
    expect(p.detail_rows[0].injury_base).toBe(5000);
  });

  it('normalizePayload builds Jiangsu multi-company monthly rows with gap span', () => {
    const p = normalizePayload({
      region: 'js',
      name: '樊宜',
      id_number: '342501199307088233',
      gender: '男',
      status: '暂停缴费（中断）',
      company_name: '南京市溧水区暂时中止单位',
      area: '溧水区',
      segments: [
        { company_name: '南京胜德金属装备有限公司', base_amount: 4879, period_start: '2025-08', period_end: '2025-08' },
        { company_name: '南京埃希玛科技有限公司', base_amount: 4952, period_start: '2025-09', period_end: '2026-01' },
        { company_name: '南京贝奇尔机械有限公司', base_amount: 7000, period_start: '2026-03', period_end: '2026-05' },
        { company_name: '威尔特茵轮（南京）有限公司', base_amount: 6400, period_start: '2026-06', period_end: '2026-08' }
      ]
    });
    expect(p.error).toBeFalsy();
    /* 2026-02 断缴：12 条明细，但跨度 202508-202608 = 13 个月 */
    expect(p.detail_rows.length).toBe(12);
    expect(p.span_months).toBe(13);
    expect(p.month_count).toBe(12);
    expect(p.period_compact).toBe('202508-202608');
    expect(p.company_display).toBe('南京市溧水区暂时中止单位');
    expect(p.detail_rows[0].year).toBe(2025);
    expect(p.detail_rows[0].month).toBe('08');
    expect(p.detail_rows[0].unit_name).toBe('南京胜德金属装备有限公司');
    expect(p.detail_rows[0].pension_pay).toBeCloseTo(390.32, 2);
    expect(p.detail_rows[0].unemp_pay).toBeCloseTo(24.4, 2);
    expect(p.detail_rows[1].unit_name).toBe('南京埃希玛科技有限公司');
    expect(p.detail_rows[1].pension_pay).toBeCloseTo(396.16, 2);
    /* 第 7 条（index 6）为断缴后的 2026-03 */
    expect(p.detail_rows[6].year).toBe(2026);
    expect(p.detail_rows[6].month).toBe('03');
    expect(p.detail_rows[6].unit_name).toBe('南京贝奇尔机械有限公司');
    expect(p.detail_rows[6].pension_pay).toBeCloseTo(560, 2);
    const html = renderCertHtml(p, { show_url: 'https://example.test/show.pdf' }, { authCode: 'jsauth01' });
    expect(html).toContain('江苏省社会保险权益记录单');
    expect(html).toContain('（参保人员）');
    expect(html).toContain('参加社会保险基本情况');
    expect(html).toContain('出具证明前13个月缴费情况（202508-202608）');
    expect(html).toContain('工伤保险');
    expect(html).toContain('请使用官方江苏智慧人社APP扫描验证');
    expect(html).toContain('/img/sbdy_js_seal.png');
    expect(html).toContain('威尔特茵轮（南京）有限公司');
    expect(html).toContain('暂停缴费（中断）');
    expect(html).not.toContain('社会保险经办机构');
  });

  it('Jiangsu heading keeps selected total period when paid segments cover only part', () => {
    const p = normalizePayload({
      region: 'js',
      name: '樊宜',
      id_number: '342501199307088233',
      status: '暂停缴费（中断）',
      company_name: '',
      area: '溧水区',
      period_start: '2025-08',
      period_end: '2026-08',
      segments: [
        { company_name: '南京贝奇尔机械有限公司', base_amount: 7000, period_start: '2026-03', period_end: '2026-05' },
        { company_name: '威尔特茵轮（南京）有限公司', base_amount: 6400, period_start: '2026-06', period_end: '2026-08' }
      ]
    });
    expect(p.error).toBeFalsy();
    expect(p.detail_rows).toHaveLength(6);
    expect(p.month_count).toBe(6);
    expect(p.span_months).toBe(13);
    expect(p.period_start).toBe('2025-08');
    expect(p.period_end).toBe('2026-08');
    expect(p.period_compact).toBe('202508-202608');
    expect(p.company_name).toBe('威尔特茵轮（南京）有限公司');
    expect(p.company_display).toBe('威尔特茵轮（南京）有限公司');
    const html = renderCertHtml(p);
    expect(html).toContain('出具证明前13个月缴费情况（202508-202608）');
  });

  it('renderCertHtml escapes name for Jiangsu layout', () => {
    const p = normalizePayload({
      region: 'js',
      name: '<script>',
      id_number: '342501199307088233',
      period_start: '2025-01',
      period_end: '2025-02'
    });
    const html = renderCertHtml(p);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toMatch(/<td[^>]*>\s*<script>/i);
  });

  it('normalizePayload builds Jiangsu-new watermarked rights record', () => {
    const p = normalizePayload({
      region: 'js_new',
      name: '张某某',
      id_number: '320102199001011234',
      gender: '男',
      status: '暂停缴费（中断）',
      company_name: '南京市经济技术开发区暂时中止单位',
      area: '经济技术开发区',
      period_start: '2024-01',
      period_end: '2024-03',
      base_amount: 9500
    });
    expect(p.error).toBeFalsy();
    expect(p.region).toBe('js_new');
    expect(p.layout).toBe('js_cgbzm_v1');
    expect(p.watermark_id).toMatch(/^\d{12}-\d{11}$/);
    expect(p.detail_rows.length).toBe(3);
    expect(p.detail_rows[0].pension_base).toBe(9500);
    expect(p.detail_rows[0].pension_pay).toBeCloseTo(760, 2);
    expect(p.detail_rows[0].unemp_pay).toBeCloseTo(47.5, 2);
    const html = renderCertHtml(p, { show_url: 'https://example.test/show.pdf' });
    expect(html).toContain('江苏省社会保险权益记录单');
    expect(html).toContain('该核查内容真实，欢迎登录人社APP扫描验证');
    expect(html).toContain('本文件由全国社保卡服务平台提供，任何第三方机构不得进行二次加工');
    expect(html).toContain('class="wm"');
    expect(html).toContain(p.watermark_id);
    expect(html).toContain('南京市经济技术开发区暂时中止单位');
    expect(html).toContain('/img/sbdy_js_seal.png');
    expect(html).not.toContain('请使用官方江苏智慧人社APP扫描验证');
  });

  it('js_cgbzm_v1 layout alias normalizes to js_new', () => {
    const p = normalizePayload({
      layout: 'js_cgbzm_v1',
      name: '张某某',
      id_number: '320102199001011234',
      period_start: '2024-01',
      period_end: '2024-02',
      base_amount: 9500
    });
    expect(p.region).toBe('js_new');
    expect(p.layout).toBe('js_cgbzm_v1');
    expect(p.watermark_id).toBeTruthy();
  });

  it('old Jiangsu layout stays without national watermark', () => {
    const p = normalizePayload({
      region: 'js',
      name: '樊宜',
      id_number: '342501199307088233',
      period_start: '2024-01',
      period_end: '2024-02',
      base_amount: 5000
    });
    expect(p.region).toBe('js');
    expect(p.watermark_id).toBeUndefined();
    const html = renderCertHtml(p);
    expect(html).toContain('请使用官方江苏智慧人社APP扫描验证');
    expect(html).not.toContain('本文件由全国社保卡服务平台');
    expect(html).not.toContain('class="wm"');
  });

  it('normalizePayload builds Hunan snapshot rows and extra employer', () => {
    const p = normalizePayload({
      region: 'hn',
      name: '杨坤斌',
      id_number: '430522199711297813',
      company_name: '湖南旭昱新能源科技有限公司',
      credit_code: '91430703MA4PYMX53L',
      area: '常德市鼎城区',
      period_start: '2024-05',
      period_end: '2025-12',
      base_amount: 4053,
      snapshot_ym: '202604',
      snapshot_base: 4308,
      relation_extra: [
        {
          credit_code: '91430700MAD948AM6K',
          company_name: '湖南鑫鼎晟机械制造有限公司'
        }
      ]
    });
    expect(p.error).toBeFalsy();
    expect(p.relations.length).toBe(2);
    expect(p.relations[0].items.length).toBe(6);
    expect(p.detail_rows[0].period).toBe('202604');
    expect(p.detail_rows[0].base).toBe(4308);
    expect(p.detail_rows[3].base).toBe(4053);
  });

  it('normalizePayload builds Beijing official rights record', () => {
    const p = normalizePayload({
      region: 'bj',
      name: '李明',
      id_number: '110105198203151239',
      company_name: '北京华信科技有限公司',
      area: '朝阳区',
      period_start: '1998-11',
      period_end: '2005-07',
      base_amount: 6821,
      print_date: '2025年03月24日',
      verify_code: 'f4yvki',
      query_serial: '11010520250324205821'
    });
    expect(p.error).toBeFalsy();
    expect(p.region).toBe('bj');
    expect(p.layout).toBe('bj_official_v1');
    expect(p.verify_code).toBe('f4yvki');
    expect(p.query_serial).toBe('11010520250324205821');
    expect(p.agency_name).toBe('北京市朝阳区社会保险基金管理中心');
    expect(p.query_date_label).toBe('2025年03月24日');
    expect(p.query_period_label).toBe('1998年11月至2005年07月');
    expect(p.header_company).toBe('北京华信科技有限公司');
    expect(p.employers.length).toBe(1);
    expect(p.employers[0].company_name).toBe('北京华信科技有限公司');
    expect(p.employers[0].agency).toBe('北京市朝阳区');
    expect(p.year_rows.length).toBe(8);
    expect(p.year_rows[0].label).toMatch(/^\*1998-11至1998-12$/);
    expect(p.year_rows[0].unemp_months).toBe(0);
    expect(p.year_rows[3].medical_months).toBeGreaterThan(0);
    expect(p.totals.pension_months).toBe(81);
    expect(p.totals.maternity_months).toBeGreaterThan(0);
    expect(p.pension_total_months).toBeGreaterThan(p.totals.pension_months);
    expect(p.pension_years_label).toMatch(/年.*个月/);
    const html = renderCertHtml(p, {}, { authCode: p.query_serial });
    expect(html).toContain('北京市社会保险个人权益记录');
    expect(html).toContain('养老保险单位变动记录');
    expect(html).toContain('五险缴费明细');
    expect(html).toContain('查询时间段');
    expect(html).toContain('补充资料');
    expect(html).toContain('个人账户资金余额');
    expect(html).toContain('f4yvki');
    expect(html).toContain('11010520250324205821');
    expect(html).toContain('fuwu.rsj.beijing.gov.cn');
    expect(html).toContain('/img/sbdy_bj_si_seal.png');
    expect(html).toContain('/img/sbdy_bj_mi_seal.png');
    expect(html).toContain('北京华信科技有限公司');
    expect(html).toContain('第1页 （共2页）');
  });

  it('Beijing multi-employer segments and HTML escape', () => {
    const p = normalizePayload({
      region: 'bj',
      name: '<b>李</b>',
      id_number: '110105198203151239',
      area: '海淀区',
      period_start: '2004-01',
      period_end: '2005-12',
      base_amount: 6821,
      segments: [
        {
          company_name: '北京甲公司',
          area: '海淀区',
          period_start: '2004-01',
          period_end: '2004-12'
        },
        {
          company_name: '北京乙公司',
          area: '朝阳区',
          period_start: '2005-01',
          period_end: '2005-12'
        }
      ]
    });
    expect(p.error).toBeFalsy();
    expect(p.employers.length).toBe(2);
    expect(p.header_company).toBe('');
    expect(p.employers[0].agency).toBe('北京市海淀区');
    expect(p.employers[1].agency).toBe('北京市朝阳区');
    expect(p.query_serial.startsWith('110105')).toBe(true);
    const html = renderCertHtml(p);
    expect(html).toContain('&lt;b&gt;李&lt;/b&gt;');
    expect(html).not.toMatch(/<td[^>]*>\s*<b>李<\/b>/);
    expect(html).toContain('北京甲公司');
    expect(html).toContain('北京乙公司');
  });

  it('normalizePayload builds Shanghai 60-month pension status', () => {
    const p = normalizePayload({
      region: 'sh',
      name: '陈思远',
      id_number: '310115199003152018',
      company_name: '上海某某科技有限公司',
      period_start: '2021-08',
      period_end: '2026-07',
      total_months: 175,
      print_date: '2026年8月5日',
      segments: [
        {
          company_name: '上海某某科技有限公司',
          period_start: '2021-08',
          period_end: '2024-11'
        },
        {
          company_name: '上海某某网络科技有限公司',
          period_start: '2024-12',
          period_end: '2026-05'
        }
      ]
    });
    expect(p.error).toBeFalsy();
    expect(p.region).toBe('sh');
    expect(p.layout).toBe('sh_official_v1');
    expect(p.ss_number).toBe('310115199003152018');
    expect(p.agency_name).toBe('上海市社会保险事业管理中心');
    expect(p.months.length).toBe(60);
    expect(p.months[0].ym).toBe('202108');
    expect(p.months[0].status).toBe('已记账');
    expect(p.months[59].ym).toBe('202607');
    expect(p.months[59].status).toMatch(/未缴费|欠缴/);
    expect(p.employers.length).toBe(2);
    expect(p.employers[0].period_label).toContain('2021年08月');
    expect(p.total_months).toBe(175);
    expect(p.total_months_label).toContain('累计缴费月数 175');
    expect(p.print_date).toBe('2026-8-5');
    expect(p.seal_sig.length).toBeGreaterThan(40);
    const html = renderCertHtml(p);
    expect(html).toContain('参保人员城镇职工基本养老保险参保情况');
    expect(html).toContain('近60个月缴费单位信息');
    expect(html).toContain('上海某某科技有限公司');
    expect(html).toContain('上海某某网络科技有限公司');
    expect(html).toContain('/img/sbdy_sh_seal.png');
    expect(html).toContain('已记账');
    expect(html).toContain('累计缴费月数 175');
  });

  it('Shanghai HTML escapes name', () => {
    const p = normalizePayload({
      region: 'sh',
      name: '<script>x</script>',
      id_number: '310115199003152018',
      period_start: '2025-01',
      period_end: '2025-12',
      company_name: '上海甲公司'
    });
    expect(p.error).toBeFalsy();
    const html = renderCertHtml(p);
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).not.toContain('<script>x</script>');
  });

  it('normalizePayload builds Xiamen pension year-detail rows', () => {
    const p = normalizePayload({
      region: 'xm',
      name: '张知宇',
      id_number: '350425198902233512',
      area: '湖里区',
      period_start: '2024-01',
      period_end: '2024-03',
      base_amount: 1800,
      print_date: '2026-08-31',
      unit_code: '6200088588',
      segments: [
        {
          company_name: '厦门某某科技有限公司',
          unit_code: '5001098765',
          area: '同安区',
          period_start: '2024-01',
          period_end: '2024-02',
          base_amount: 1800
        },
        {
          company_name: '金旸（厦门）新材料科技有限公司',
          unit_code: '5001016497',
          area: '海沧区',
          period_start: '2024-03',
          period_end: '2024-03',
          base_amount: 1700
        }
      ]
    });
    expect(p.error).toBeFalsy();
    expect(p.region).toBe('xm');
    expect(p.layout).toBe('xm_official_v1');
    expect(p.person_no).toBe('350425198902233512');
    expect(p.rows.length).toBe(3);
    expect(p.rows[0].agency).toBe('同安区社会保险中心');
    expect(p.rows[0].period_ym).toBe('202401');
    expect(p.rows[2].agency).toBe('海沧区社会保险中心');
    expect(p.rows[2].company_name).toBe('金旸（厦门）新材料科技有限公司');
    expect(p.total_months).toBe(3);
    expect(p.print_date).toBe('2026-08-31');
    const html = renderCertHtml(p);
    expect(html).toContain('基本养老个人历年缴费明细表');
    expect(html).toContain('参保地经办机构');
    expect(html).toContain('张知宇');
    expect(html).toContain('同安区社会保险中心');
    expect(html).toContain('/img/sbdy_xm_seal.png');
    expect(html).toContain('第 1 页 共 1 页');
  });

  it('Xiamen HTML escapes name', () => {
    const p = normalizePayload({
      region: 'xm',
      name: '<b>李</b>',
      id_number: '350206199001010029',
      period_start: '2025-01',
      period_end: '2025-01',
      company_name: '厦门甲公司'
    });
    expect(p.error).toBeFalsy();
    const html = renderCertHtml(p);
    expect(html).toContain('&lt;b&gt;李&lt;/b&gt;');
    expect(html).not.toMatch(/<td[^>]*>\s*<b>李<\/b>/);
  });

  it('Sichuan payload reuses segments and builds official sc_months', () => {
    const p = normalizePayload({
      region: 'sc',
      name: '马海燕',
      id_number: '510723199208191285',
      gender: '女',
      area: '成都市高新区',
      status_injury_extra: '暂停缴费（中断）',
      months_pension: 139,
      months_unemployment: 138,
      months_injury: 138,
      print_date: '2026年09月04日',
      segments: [
        {
          company_name: '四川创智联恒科技有限公司',
          credit_code: '10010759311',
          area: '成都市高新区',
          base_amount: 13596,
          period_start: '2024-10',
          period_end: '2024-12'
        },
        {
          company_name: '成都天微智能科技有限公司',
          credit_code: '250215712150',
          area: '成都市双流区',
          base_amount: 5000,
          period_start: '2025-05',
          period_end: '2025-06'
        }
      ]
    });
    expect(p.error).toBeFalsy();
    expect(p.region).toBe('sc');
    expect(p.layout).toBe('sc_official_v1');
    expect(p.cert_type).toBe('sichuan');
    expect(p.sc_months.length).toBe(5);
    expect(p.sc_months[0].unit_code).toBe('10010759311');
    expect(p.sc_months[0].pension_unit).toBe(2175.36);
    expect(p.sc_months[4].unit_code).toBe('250215712150');
    expect(p.unit_name_map['10010759311']).toBe('四川创智联恒科技有限公司');
    expect(p.summary_rows[0].months).toBe(139);
    expect(p.summary_rows[3].status).toBe('暂停缴费（中断）');
    expect(p.verify_valid_until).toContain('2026');
    const html = renderCertHtml(p, { show_url: '/show.pdf' });
    expect(html).toContain('请查看 PDF');
  });
});
