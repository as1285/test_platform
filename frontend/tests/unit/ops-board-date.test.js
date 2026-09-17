import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const ops = readFileSync(
  resolve(__dirname, '../../public/js/admin/modules/ops-conversion.js'),
  'utf8'
);
const loader = readFileSync(resolve(__dirname, '../../public/js/admin/loader.js'), 'utf8');

describe('运营看板 KPI 日期区间', () => {
  it('头部有起止日期，请求带 date_from / date_to', () => {
    expect(html).toContain('id="opsBoardDateFrom"');
    expect(html).toContain('id="opsBoardDateTo"');
    expect(html).toContain('aria-label="开始日期"');
    expect(html).toContain('aria-label="结束日期"');
    expect(html).toContain('所选区间');
    expect(ops).toContain('function beijingTodayYmd()');
    expect(ops).toContain('function ensureBoardRange()');
    expect(ops).toContain('api/admin/ops/board?days=7&date_from=');
    expect(ops).toContain("'&date_from='");
    expect(ops).toContain("boardDateFrom.addEventListener('change', loadBoard)");
    expect(ops).toContain("boardDateTo.addEventListener('change', loadBoard)");
    expect(loader).toContain('ops-conversion.js?v=20260915-dau-clock');
  });
});
