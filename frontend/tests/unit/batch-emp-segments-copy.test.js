import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const indirectEval = eval;
const BATCH_JS = resolve(__dirname, '../../public/js/consult-batch-tax.js');

function loadSegmentHelpers() {
  const full = readFileSync(BATCH_JS, 'utf8');
  const start = full.indexOf('function recordYmKey');
  const end = full.indexOf('function inferBatchSsBaseFromDeductions');
  if (start < 0 || end < 0) {
    throw new Error('segment helpers not found');
  }
  window.ymToKey = function (y, m) {
    return y * 100 + m;
  };
  indirectEval(full.slice(start, end));
}

describe('batch employment segments from record ids', () => {
  beforeEach(() => {
    loadSegmentHelpers();
  });

  it('parses empIdx from salary / bonus / severance ids', () => {
    expect(window.parseBatchEmpIdxFromRecordId('tr_u1_2025_01_e0')).toBe(0);
    expect(window.parseBatchEmpIdxFromRecordId('tr_u1_2025_06_e2')).toBe(2);
    expect(window.parseBatchEmpIdxFromRecordId('tr_u1_2025_12_bonus_1_0')).toBe(1);
    expect(window.parseBatchEmpIdxFromRecordId('tr_u1_2025_3_severance_2_0')).toBe(2);
    expect(window.parseBatchEmpIdxFromRecordId('tr_u1_2025_01')).toBeNull();
  });

  it('keeps contiguous same-company months as separate segments when empIdx differs', () => {
    const recs = [
      { id: 'tr_u_2025_01_e0', year: 2025, month: 1 },
      { id: 'tr_u_2025_02_e0', year: 2025, month: 2 },
      { id: 'tr_u_2025_03_e0', year: 2025, month: 3 },
      { id: 'tr_u_2025_04_e1', year: 2025, month: 4 },
      { id: 'tr_u_2025_05_e1', year: 2025, month: 5 },
      { id: 'tr_u_2025_06_e1', year: 2025, month: 6 },
      { id: 'tr_u_2025_07_e2', year: 2025, month: 7 },
      { id: 'tr_u_2025_08_e2', year: 2025, month: 8 },
      { id: 'tr_u_2025_09_e2', year: 2025, month: 9 },
      { id: 'tr_u_2025_10_e2', year: 2025, month: 10 },
      { id: 'tr_u_2025_11_e2', year: 2025, month: 11 },
      { id: 'tr_u_2025_12_e2', year: 2025, month: 12 }
    ];
    const segs = window.splitCompanyRecordsIntoSegments(recs);
    expect(segs).toHaveLength(3);
    expect(segs[0].map((r) => r.month)).toEqual([1, 2, 3]);
    expect(segs[1].map((r) => r.month)).toEqual([4, 5, 6]);
    expect(segs[2].map((r) => r.month)).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it('still merges contiguous months for legacy ids without empIdx', () => {
    const recs = [
      { id: 'tr_u_2025_01', year: 2025, month: 1 },
      { id: 'tr_u_2025_02', year: 2025, month: 2 },
      { id: 'tr_u_2025_04', year: 2025, month: 4 }
    ];
    const segs = window.splitCompanyRecordsIntoSegments(recs);
    expect(segs).toHaveLength(2);
    expect(segs[0].map((r) => r.month)).toEqual([1, 2]);
    expect(segs[1].map((r) => r.month)).toEqual([4]);
  });
});
