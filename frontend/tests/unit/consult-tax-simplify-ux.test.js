import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');

describe('consult 税务记录 batch generate: simplified period + action hierarchy', () => {
  it('replaces the four raw year/month boxes with a friendly "起始月 → 结束月" range control', () => {
    expect(html).toContain('batch-emp-period-start-btn');
    expect(html).toContain('batch-emp-period-end-btn');
    expect(html).toContain('batch-ym-range');
    expect(html).toContain('batchYmPickerModal');
    expect(html).toContain('batchYmPickerYear');
    expect(html).toContain('batchYmPickerMonth');
  });

  it('still writes the same underlying sy/sm/ey/em fields (kept for parsing / draft / admin reuse)', () => {
    expect(html).toContain('class="batch-emp-sy batch-ym-field"');
    expect(html).toContain('class="batch-emp-sm batch-ym-field"');
    expect(html).toContain('class="batch-emp-ey batch-ym-field"');
    expect(html).toContain('class="batch-emp-em batch-ym-field"');
    expect(html).toContain('batch-ym-hidden-fields');
  });

  it('promotes 按模板生成 as the prominent secondary path and demotes 示例填写 into 更多', () => {
    const toolbarStart = html.indexOf('id="batchTaxToolbar"');
    expect(toolbarStart).toBeGreaterThan(-1);
    const toolbarChunk = html.slice(toolbarStart, toolbarStart + 1800);
    expect(toolbarChunk).toContain('batch-tax-toolbar-primary');
    expect(toolbarChunk).toContain('id="btnBatchTaxPasteImport"');
    expect(toolbarChunk).toContain('id="btnBatchTaxMore"');
    expect(toolbarChunk).toContain('id="btnBatchTaxExample"');
    expect(toolbarChunk).not.toContain('batch-tax-toolbar-quiet');
    // 按模板生成 must appear before 示例填写 in DOM order (primary path first)
    expect(toolbarChunk.indexOf('btnBatchTaxPasteImport')).toBeLessThan(
      toolbarChunk.indexOf('btnBatchTaxExample')
    );
  });

  it('keeps the primary submit CTA as 一键生成税务记录', () => {
    expect(html).toContain('id="batch_submit_employments_btn"');
    expect(html).toContain('一键生成税务记录');
  });

  it('keeps list header actions 回填修改 / 管理 for the simplified card list', () => {
    const cardStart = html.indexOf('id="taxRecordsListCard"');
    expect(cardStart).toBeGreaterThan(-1);
    const cardEnd = html.indexOf('id="taxFaqCard"');
    const cardChunk = html.slice(cardStart, cardEnd > cardStart ? cardEnd : cardStart + 8000);
    expect(cardChunk).toContain('回填修改');
    expect(cardChunk).toContain('id="btnTaxRecordsManage"');
    expect(cardChunk).toContain('id="btnTaxRecordsSettings"');
    expect(cardChunk).toContain('设置');
    expect(cardChunk).toContain('id="taxRecordsManageHint"');
    expect(cardChunk).toContain('id="taxRecordsSettingsPanel"');
  });

  it('drops the 3-step progress stepper from the tax fill first screen', () => {
    expect(html).not.toContain('id="taxFlowSteps"');
  });

  it('uses dual primary start paths and demotes screenshot/example', () => {
    const chooserStart = html.indexOf('id="taxStartChooser"');
    expect(chooserStart).toBeGreaterThan(-1);
    const chooserChunk = html.slice(chooserStart, chooserStart + 1200);
    expect(chooserChunk).toContain('id="btnTaxStartPaste"');
    expect(chooserChunk).toContain('id="btnTaxStartManual"');
    expect(chooserChunk).toContain('按模板生成');
    expect(chooserChunk).toContain('自己填公司与月薪');
    expect(chooserChunk).toContain('tax-start-chooser-more');
    expect(chooserChunk).toContain('id="btnTaxStartScreenshot"');
    expect(chooserChunk).toContain('id="btnTaxStartExample"');
    expect(chooserChunk.indexOf('btnTaxStartPaste')).toBeLessThan(
      chooserChunk.indexOf('btnTaxStartScreenshot')
    );
    expect(chooserChunk.indexOf('btnTaxStartManual')).toBeLessThan(
      chooserChunk.indexOf('btnTaxStartScreenshot')
    );
  });

  it('keeps FAQ default-collapsed below the record list', () => {
    const list = html.indexOf('id="taxRecordsListCard"');
    const faq = html.indexOf('id="taxFaqCard"');
    expect(list).toBeGreaterThan(-1);
    expect(faq).toBeGreaterThan(list);
    const faqChunk = html.slice(faq, faq + 400);
    expect(faqChunk).not.toContain('is-open');
    expect(faqChunk).toContain('aria-expanded="false"');
  });

  it('puts 二次退税咨询 below the tax fill flow and record list', () => {
    const batch = html.indexOf('id="batchTaxCard"');
    const list = html.indexOf('id="taxRecordsListCard"');
    const refund = html.indexOf('id="consultRefundAdEntry"');
    expect(batch).toBeGreaterThan(-1);
    expect(list).toBeGreaterThan(batch);
    expect(refund).toBeGreaterThan(list);
  });

  it('shortens the batch form instructional copy to a single short line', () => {
    const m = html.match(/<p class="batch-hint" id="batchTaxCardHint">([^<]*)<\/p>/);
    expect(m).toBeTruthy();
    expect(m[1].length).toBeLessThan(40);
  });

  it('moves bottom bonus-only CTAs out of the primary action row', () => {
    const actionsStart = html.indexOf('class="batch-tax-actions"');
    expect(actionsStart).toBeGreaterThan(-1);
    const actionsChunk = html.slice(actionsStart, actionsStart + 500);
    expect(actionsChunk).not.toContain('单独增加年终奖');
    expect(actionsChunk).not.toContain('单独增加裁员补偿');
    expect(html).toContain('batchAddYearEndBonusOnly()');
    expect(html).toContain('batchAddSeveranceOnly()');
  });
});
