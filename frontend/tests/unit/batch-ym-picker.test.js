import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const indirectEval = eval;
const BATCH_JS = resolve(__dirname, '../../public/js/consult-batch-tax.js');

function loadYmPickerHelpers() {
  const full = readFileSync(BATCH_JS, 'utf8');
  const start = full.indexOf('var _batchYmPickerCtx');
  const end = full.indexOf('function parseBatchRatioPct');
  if (start < 0 || end < 0) {
    throw new Error('ym-picker helpers not found');
  }
  indirectEval(full.slice(start, end));
}

function pickerModalHtml() {
  return (
    '<div id="batchYmPickerModal">' +
    '<div id="batchYmPickerMask"></div>' +
    '<span id="batchYmPickerTitle"></span>' +
    '<button id="batchYmPickerCloseX"></button>' +
    '<select id="batchYmPickerYear"></select>' +
    '<select id="batchYmPickerMonth"></select>' +
    '<button id="batchYmPickerCancel"></button>' +
    '<button id="batchYmPickerOk"></button>' +
    '</div>'
  );
}

function periodRowHtml() {
  return (
    '<div class="batch-emp-row">' +
    '<button type="button" class="batch-emp-period-start-btn">' +
    '<span class="batch-emp-period-start-val">—</span>' +
    '</button>' +
    '<button type="button" class="batch-emp-period-end-btn">' +
    '<span class="batch-emp-period-end-val">—</span>' +
    '</button>' +
    '<input class="batch-emp-sy" value="2024">' +
    '<input class="batch-emp-sm" value="1">' +
    '<input class="batch-emp-ey" value="2025">' +
    '<input class="batch-emp-em" value="6">' +
    '</div>'
  );
}

describe('batch tax start/end month picker', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    loadYmPickerHelpers();
  });

  it('formats a y/m pair as "YYYY年M月", falling back when missing', () => {
    expect(window.formatBatchYm(2025, 6)).toBe('2025年6月');
    expect(window.formatBatchYm('', '')).toBe('请选择');
    expect(window.formatBatchYm(0, 5)).toBe('请选择');
  });

  it('refreshes the start/end display spans from the hidden sy/sm/ey/em inputs', () => {
    document.body.innerHTML = periodRowHtml();
    const row = document.querySelector('.batch-emp-row');
    window.refreshBatchEmpPeriodDisplay(row);
    expect(row.querySelector('.batch-emp-period-start-val').textContent).toBe('2024年1月');
    expect(row.querySelector('.batch-emp-period-end-val').textContent).toBe('2025年6月');
  });

  it('opens the shared picker modal and writes the confirmed year/month back via onConfirm', () => {
    document.body.innerHTML = pickerModalHtml();
    const modal = document.getElementById('batchYmPickerModal');
    let confirmed = null;
    window.openBatchYmPicker('选择起始月', 2024, 3, function (y, m) {
      confirmed = { y: y, m: m };
    });
    expect(modal.classList.contains('is-open')).toBe(true);
    expect(document.getElementById('batchYmPickerYear').value).toBe('2024');
    expect(document.getElementById('batchYmPickerMonth').value).toBe('3');

    document.getElementById('batchYmPickerYear').value = '2026';
    document.getElementById('batchYmPickerYear').dispatchEvent(new Event('change'));
    document.getElementById('batchYmPickerMonth').value = '9';
    document.getElementById('batchYmPickerOk').click();

    expect(confirmed).toEqual({ y: 2026, m: 9 });
    expect(modal.classList.contains('is-open')).toBe(false);
  });

  it('clicking a row\'s start/end button opens the picker and updates hidden fields + display on confirm', () => {
    document.body.innerHTML = pickerModalHtml() + periodRowHtml();
    const row = document.querySelector('.batch-emp-row');
    window.bindBatchEmpPeriodPicker(row);
    // initial bind should already populate the display from existing hidden values
    expect(row.querySelector('.batch-emp-period-start-val').textContent).toBe('2024年1月');

    row.querySelector('.batch-emp-period-start-btn').click();
    expect(document.getElementById('batchYmPickerModal').classList.contains('is-open')).toBe(true);
    document.getElementById('batchYmPickerYear').value = '2023';
    document.getElementById('batchYmPickerMonth').value = '5';
    document.getElementById('batchYmPickerOk').click();

    expect(row.querySelector('.batch-emp-sy').value).toBe('2023');
    expect(row.querySelector('.batch-emp-sm').value).toBe('5');
    expect(row.querySelector('.batch-emp-period-start-val').textContent).toBe('2023年5月');
    // end fields untouched
    expect(row.querySelector('.batch-emp-ey').value).toBe('2025');
  });

  it('dispatches bubbling input/change on the hidden field so draft-autosave listeners still fire', () => {
    document.body.innerHTML = pickerModalHtml() + '<div id="batchTaxCard">' + periodRowHtml() + '</div>';
    const row = document.querySelector('.batch-emp-row');
    window.bindBatchEmpPeriodPicker(row);
    let changeCount = 0;
    document.getElementById('batchTaxCard').addEventListener('change', function () {
      changeCount += 1;
    });
    row.querySelector('.batch-emp-period-end-btn').click();
    document.getElementById('batchYmPickerYear').value = '2025';
    document.getElementById('batchYmPickerMonth').value = '12';
    document.getElementById('batchYmPickerOk').click();
    expect(changeCount).toBeGreaterThan(0);
    expect(row.querySelector('.batch-emp-em').value).toBe('12');
  });

  it('is a no-op (no throw) on legacy rows without picker buttons, e.g. admin_panel.html reuse', () => {
    document.body.innerHTML =
      '<div class="batch-emp-row">' +
      '<input class="batch-emp-sy" value="2024">' +
      '<input class="batch-emp-sm" value="1">' +
      '<input class="batch-emp-ey" value="2025">' +
      '<input class="batch-emp-em" value="6">' +
      '</div>';
    const row = document.querySelector('.batch-emp-row');
    expect(() => window.bindBatchEmpPeriodPicker(row)).not.toThrow();
    expect(() => window.refreshBatchEmpPeriodDisplay(row)).not.toThrow();
  });
});
