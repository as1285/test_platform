import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, '../../public/js/tax-record-order.js'), 'utf8');
const shuiming = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('TaxRecordOrder + 收入纳税明细调序入口', () => {
  it('flags same-month neighbors for 上移/下移', () => {
    eval(src);
    const rows = [
      { id: '1', year: 2026, month: 7, company_name: '甲' },
      { id: '2', year: 2026, month: 7, company_name: '乙' },
      { id: '3', year: 2026, month: 6, company_name: '丙' }
    ];
    expect(window.TaxRecordOrder.monthsWithDupes(rows)).toEqual(['2026-7']);
    expect(window.TaxRecordOrder.moveFlags(rows, '1')).toEqual({
      canUp: false,
      canDown: true,
      sameMonthCount: 2
    });
    expect(window.TaxRecordOrder.moveFlags(rows, '2')).toEqual({
      canUp: true,
      canDown: false,
      sameMonthCount: 2
    });
    expect(window.TaxRecordOrder.moveFlags(rows, '3').sameMonthCount).toBe(1);
    expect(window.TaxRecordOrder.moveFlags(rows, '3').canUp).toBe(false);
    expect(window.TaxRecordOrder.moveFlags(rows, '3').canDown).toBe(false);
  });

  it('wires 收入纳税明细 long-press sheet and reorder API', () => {
    expect(shuiming).toContain('tax-record-order.js?v=20260911-same-month');
    expect(shuiming).toContain('id="shuimingReorderSheet"');
    expect(shuiming).not.toContain('同月有多条时，长按记录可调整上下顺序');
    expect(shuiming).not.toContain('list-reorder-hint');
    expect(shuiming).toContain('-webkit-touch-callout: none');
    expect(shuiming).toContain("action: 'reorder_record'");
    expect(shuiming).toContain('data-record-id=');
    expect(shuiming).toContain('bindShuimingReorder');
    expect(shuiming).toContain('held >= 400');
  });
});
