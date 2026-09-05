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
  const coreEnd = coreSrc.indexOf('function formatTaxPastePreview');
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
    '; return { parseTaxPasteText: parseTaxPasteText, TAX_PASTE_IMPORT_TEMPLATE: TAX_PASTE_IMPORT_TEMPLATE };';
  // eslint-disable-next-line no-new-func
  return new Function(fnBody)();
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
    expect(html).toContain('consult-batch-tax.js?v=20260905-paste-ss');
  });

  it('opens with a 2023–2025 template and live preview wiring', () => {
    expect(batchSrc).toContain("公司名称：某某有限公司");
    expect(batchSrc).toContain('2023年全年');
    expect(batchSrc).toContain('2025年全年');
    expect(batchSrc).toContain('function fillTaxPasteTemplateIntoBox');
    expect(batchSrc).toContain('function scheduleTaxPasteLivePreview');
    expect(batchSrc).toContain('function clearTaxPasteImportText');
    expect(batchSrc).not.toContain('将为「');
    expect(batchSrc).toContain("if (!String(ta.value || '').trim())");
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
  });
});
