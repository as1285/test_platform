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

  it('promotes 按模板生成 as the prominent secondary path and demotes 示例填写', () => {
    const toolbarStart = html.indexOf('id="batchTaxToolbar"');
    expect(toolbarStart).toBeGreaterThan(-1);
    const toolbarChunk = html.slice(toolbarStart, toolbarStart + 1500);
    expect(toolbarChunk).toContain('batch-tax-toolbar-primary');
    expect(toolbarChunk).toContain('id="btnBatchTaxPasteImport"');
    expect(toolbarChunk).toContain('batch-tax-toolbar-quiet');
    expect(toolbarChunk).toContain('id="btnBatchTaxExample"');
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
    const cardChunk = html.slice(cardStart, cardStart + 1800);
    expect(cardChunk).toContain('回填修改');
    expect(cardChunk).toContain('id="btnTaxRecordsManage"');
    expect(cardChunk).toContain('id="taxRecordsManageHint"');
  });

  it('keeps the 3-step progress stepper with copy matching the simplified flow', () => {
    expect(html).toContain('id="taxFlowSteps"');
    expect(html).toContain('tax-flow-step is-current');
    expect(html).toContain('填资料');
    expect(html).toContain('>生成<');
    expect(html).toContain('核对');
  });

  it('puts 二次退税咨询 below the tax fill flow and record list', () => {
    const flow = html.indexOf('id="taxFlowSteps"');
    const batch = html.indexOf('id="batchTaxCard"');
    const list = html.indexOf('id="taxRecordsListCard"');
    const refund = html.indexOf('id="consultRefundAdEntry"');
    expect(flow).toBeGreaterThan(-1);
    expect(batch).toBeGreaterThan(flow);
    expect(list).toBeGreaterThan(batch);
    expect(refund).toBeGreaterThan(list);
  });

  it('shortens the batch form instructional copy to a single short line', () => {
    const m = html.match(/<p class="batch-hint" id="batchTaxCardHint">([^<]*)<\/p>/);
    expect(m).toBeTruthy();
    expect(m[1].length).toBeLessThan(40);
  });
});
