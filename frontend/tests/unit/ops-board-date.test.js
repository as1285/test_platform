import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const ops = readFileSync(
  resolve(__dirname, '../../public/js/admin/modules/ops-conversion.js'),
  'utf8'
);
const loader = readFileSync(resolve(__dirname, '../../public/js/admin/loader.js'), 'utf8');

describe('运营看板 KPI 日期选择', () => {
  it('头部有统计日期，请求带 date', () => {
    expect(html).toContain('id="opsBoardDate"');
    expect(html).toContain('aria-label="统计日期"');
    expect(ops).toContain('function beijingTodayYmd()');
    expect(ops).toContain('function ensureBoardDate()');
    expect(ops).toContain('api/admin/ops/board?days=7&date=');
    expect(ops).toContain("payUrl += '&date='");
    expect(ops).toContain("boardDate.addEventListener('change', loadBoard)");
    expect(loader).toContain('ops-conversion.js?v=20260910-ops-date');
  });
});
