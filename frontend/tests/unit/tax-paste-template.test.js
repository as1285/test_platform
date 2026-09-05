import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');
const batchSrc = readFileSync(
  resolve(__dirname, '../../public/js/consult-batch-tax.js'),
  'utf8'
);
const coreSrc = readFileSync(resolve(__dirname, '../../public/js/consult-core.js'), 'utf8');

function extractPasteTemplate() {
  const start = batchSrc.indexOf('var TAX_PASTE_IMPORT_TEMPLATE =');
  const end = batchSrc.indexOf(';', start);
  const expr = batchSrc.slice(start, end + 1);
  // eslint-disable-next-line no-new-func
  return new Function(expr + '; return TAX_PASTE_IMPORT_TEMPLATE;')();
}

function loadPasteParser() {
  const helpers = `
    function round2(n) { return Math.round(Number(n) * 100) / 100; }
    function pad2(n) { n = parseInt(n, 10); return (n < 10 ? '0' : '') + n; }
    function ymToKey(y, m) { return Number(y) * 100 + Number(m); }
    function parseMoneyToken(raw) {
      var s = String(raw == null ? '' : raw).replace(/,/g, '').replace(/，/g, '').replace(/\\s+/g, '').trim();
      var n = parseFloat(s);
      if (!isFinite(n) || n < 0) return null;
      return round2(n);
    }
    function parseFlexibleMoney(raw) {
      var s = String(raw == null ? '' : raw).replace(/,/g, '').trim();
      if (!s) return null;
      var wan = /万/.test(s);
      var n = parseFloat(s.replace(/万/g, ''));
      if (!isFinite(n)) return null;
      return wan ? n * 10000 : n;
    }
    function enumerateYmRange(sy, sm, ey, em) {
      var out = [];
      var y = sy;
      var m = sm;
      while (y < ey || (y === ey && m <= em)) {
        out.push({ year: y, month: m });
        m += 1;
        if (m > 12) { m = 1; y += 1; }
        if (out.length > 240) break;
      }
      return out;
    }
  `;
  const coreStart = coreSrc.indexOf('function normalizeTaxPasteLabels');
  const coreEnd = coreSrc.indexOf('function applyOneTaxPasteEmpToRow');
  const batchStart = batchSrc.indexOf('function applyTaxPasteGaiweiOverrides');
  const batchEnd = batchSrc.indexOf('function parseTaxPasteText');
  const parseStart = batchSrc.indexOf('function parseTaxPasteText');
  const parseEnd = batchSrc.indexOf('function openTaxPasteImportModal');
  const tpl = JSON.stringify(extractPasteTemplate());
  const fnBody =
    helpers +
    'var TAX_PASTE_IMPORT_TEMPLATE = ' +
    tpl +
    ';\n' +
    coreSrc.slice(coreStart, coreEnd) +
    batchSrc.slice(batchStart, batchEnd) +
    batchSrc.slice(parseStart, parseEnd) +
    '; return { parseTaxPasteText: parseTaxPasteText, formatTaxPastePreview: formatTaxPastePreview, expandTaxPasteYear: expandTaxPasteYear, TAX_PASTE_IMPORT_TEMPLATE: TAX_PASTE_IMPORT_TEMPLATE };';
  // eslint-disable-next-line no-new-func
  return new Function(fnBody)();
}

function monthCount(range) {
  return (
    (range.ey - range.sy) * 12 + (range.em - range.sm) + 1
  );
}

describe('consult tax paste template simplify', () => {
  it('makes template generate the primary start path', () => {
    expect(html).toContain('按模板生成个税');
    expect(html).toContain('重新填入模板');
    expect(html).toContain('清空去粘贴');
    expect(html).toContain('id="btnTaxStartPaste"');
    expect(html.indexOf('btnTaxStartPaste')).toBeLessThan(html.indexOf('btnTaxStartExample'));
    expect(html).toContain('生成记录');
    expect(html).not.toContain('解析引擎 v0721d');
    expect(html).not.toContain('id="taxPasteImportParseBtn"');
    expect(html).toContain('consult-core.js?v=20260905-ym-range');
    expect(html).toContain('consult-batch-tax.js?v=20260905-ym-range');
  });

  it('opens with a 2023–2025 template and live preview wiring', () => {
    expect(batchSrc).toContain("公司名称：某某有限公司");
    expect(batchSrc).toContain('2023年全年');
    expect(batchSrc).toContain('2025年全年');
    expect(batchSrc).toContain('23年4月到26年8月');
    expect(batchSrc).toContain('TAX_PASTE_IMPORT_PLACEHOLDER');
    expect(batchSrc).toContain('function fillTaxPasteTemplateIntoBox');
    expect(batchSrc).toContain('function scheduleTaxPasteLivePreview');
    expect(batchSrc).toContain('function clearTaxPasteImportText');
    expect(batchSrc).not.toContain('将为「');
    expect(batchSrc).toContain("if (!String(ta.value || '').trim())");
    expect(html).toContain('23年4月到26年8月');
  });

  it('parses the default template into 36 months across 2023–2025', () => {
    const api = loadPasteParser();
    expect(api.TAX_PASTE_IMPORT_TEMPLATE).toContain('公司名称：');
    const parsed = api.parseTaxPasteText(api.TAX_PASTE_IMPORT_TEMPLATE);
    expect(parsed.ok).toBe(true);
    expect(parsed.employments).toHaveLength(1);
    expect(parsed.employments[0].company).toContain('有限公司');
    expect(parsed.employments[0].salary).toBe(20000);
    expect(parsed.employments[0].company_tax_id).toBe('91110105MA01K9XH2B');
    expect(parsed.employments[0].tax_authority).toBe('国家税务总局北京市朝阳区税务局');
    expect(parsed.employments[0].pension).toBe(1600);
    expect(parsed.employments[0].medical).toBe(400);
    expect(parsed.employments[0].unemployment).toBe(100);
    expect(parsed.employments[0].fund).toBe(2400);
    expect(parsed.employments[0].range).toEqual({ sy: 2023, sm: 1, ey: 2025, em: 12 });
    expect(parsed.month_total || parsed.employments[0].months.length).toBe(36);
  });

  it('fills tax office and social security when the short template omits them', () => {
    const api = loadPasteParser();
    const parsed = api.parseTaxPasteText(
      '公司名称：上海某某有限公司\n2023年全年\n月薪：15000元'
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.employments[0].company_tax_id).toBe('91110105MA01K9XH2B');
    expect(parsed.employments[0].tax_authority).toBe('国家税务总局上海市浦东新区税务局');
    expect(parsed.employments[0].pension).toBe(1200);
    expect(parsed.employments[0].medical).toBe(300);
    expect(parsed.employments[0].unemployment).toBe(75);
    expect(parsed.employments[0].fund).toBe(1800);
    expect(parsed.employments[0].range).toEqual({ sy: 2023, sm: 1, ey: 2023, em: 12 });
    expect(parsed.employments[0].months.length).toBe(12);
  });

  it('expands two-digit years: 00–69 → 20xx, 70–99 → 19xx', () => {
    const api = loadPasteParser();
    expect(api.expandTaxPasteYear('23')).toBe(2023);
    expect(api.expandTaxPasteYear('26')).toBe(2026);
    expect(api.expandTaxPasteYear('00')).toBe(2000);
    expect(api.expandTaxPasteYear('69')).toBe(2069);
    expect(api.expandTaxPasteYear('70')).toBe(1970);
    expect(api.expandTaxPasteYear('98')).toBe(1998);
    expect(api.expandTaxPasteYear('2023')).toBe(2023);
    expect(api.expandTaxPasteYear('1969')).toBe(null);
  });

  it('parses abbreviated natural ranges like 23年4月到26年8月', () => {
    const api = loadPasteParser();
    const parsed = api.parseTaxPasteText(
      '公司名称：某某有限公司\n23年4月到26年8月\n月薪：20000元'
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.employments[0].range).toEqual({ sy: 2023, sm: 4, ey: 2026, em: 8 });
    expect(parsed.employments[0].months.length).toBe(41);
    expect(parsed.month_total).toBe(41);
    expect(monthCount(parsed.employments[0].range)).toBe(41);
    const preview = api.formatTaxPastePreview(parsed);
    expect(preview).toContain('合计 41 个月');
    expect(preview).toContain('2023年4月 — 2026年8月（41 个月）');
  });

  it('parses the listed month-range separators and dotted years', () => {
    const api = loadPasteParser();
    const samples = [
      '2023年4月-2026年8月',
      '2023年4月—2026年8月',
      '2023年4月–2026年8月',
      '2023年4月至2026年8月',
      '2023.4~2026.8',
      '2023.4～2026.8',
      '2023-4~2026-8'
    ];
    samples.forEach((rangeLine) => {
      const parsed = api.parseTaxPasteText(
        '公司名称：某某有限公司\n' + rangeLine + '\n月薪：20000元'
      );
      expect(parsed.ok, rangeLine).toBe(true);
      expect(parsed.employments[0].range, rangeLine).toEqual({
        sy: 2023,
        sm: 4,
        ey: 2026,
        em: 8
      });
      expect(parsed.employments[0].months.length, rangeLine).toBe(41);
    });
  });

  it('still accepts 23年全年 and APP monthly paste', () => {
    const api = loadPasteParser();
    const fullYear = api.parseTaxPasteText(
      '公司名称：某某有限公司\n23年全年\n月薪：20000元'
    );
    expect(fullYear.ok).toBe(true);
    expect(fullYear.employments[0].range).toEqual({ sy: 2023, sm: 1, ey: 2023, em: 12 });
    expect(fullYear.employments[0].months.length).toBe(12);

    const appPaste = api.parseTaxPasteText(
      '公司名称：某某有限公司\n2023年1月 收入20000元 税额100元\n2023年2月 收入20000元 税额80元'
    );
    expect(appPaste.ok).toBe(true);
    expect(appPaste.employments[0].mode).toBe('detail');
    expect(appPaste.employments[0].months.length).toBe(2);
    expect(appPaste.employments[0].range).toEqual({ sy: 2023, sm: 1, ey: 2023, em: 2 });
  });
});
