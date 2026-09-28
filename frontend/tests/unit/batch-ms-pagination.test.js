import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const indirectEval = eval;

const BATCH_MS_SNIPPET_START = 'var batchMsModalCurrentRow = null;';
const BATCH_MS_SNIPPET_END = 'function saveBatchMonthSalaryModal()';

function loadBatchMsModalLogic() {
  const full = readFileSync(resolve(__dirname, '../../public/js/consult-batch-tax.js'), 'utf8');
  const start = full.indexOf(BATCH_MS_SNIPPET_START);
  const end = full.indexOf(BATCH_MS_SNIPPET_END);
  if (start < 0 || end < 0) {
    throw new Error('batch-ms snippet not found');
  }
  window.pad2 = function (n) {
    var s = String(n);
    return s.length >= 2 ? s : '0' + s;
  };
  indirectEval(full.slice(start, end));
}

function buildBatchMsDom(monthCount) {
  document.body.innerHTML =
    '<div id="batchMonthSalaryModal">' +
    '<div id="batchMsModalBody"></div>' +
    '<div id="batchMsModalPager">' +
    '<button type="button" id="batchMsPagerPrev"></button>' +
    '<span id="batchMsPagerInfo"></span>' +
    '<button type="button" id="batchMsPagerNext"></button>' +
    '</div>' +
    '</div>';
  window.batchMsModalMonthsSnapshot = [];
  for (let m = 1; m <= monthCount; m++) {
    window.batchMsModalMonthsSnapshot.push({ year: 2024, month: m });
  }
  window.batchMsModalDraft = {};
  window.batchMsModalMonthsSnapshot.forEach(function (ym) {
    var mk = ym.year + '-' + window.pad2(ym.month);
    window.batchMsModalDraft[mk] = String(1000 + ym.month);
  });
  window.batchMsModalPage = 0;
}

describe('batch-ms modal pagination', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    loadBatchMsModalLogic();
  });

  it('renders first page with at most 12 inputs', () => {
    buildBatchMsDom(24);
    window.renderBatchMsModalPage();
    const inputs = document.querySelectorAll('#batchMsModalBody input[data-ym-key]');
    expect(inputs.length).toBe(12);
    expect(document.getElementById('batchMsPagerInfo').textContent).toContain('1/2');
  });

  it('preserves draft values when paging', () => {
    buildBatchMsDom(24);
    window.renderBatchMsModalPage();
    const first = document.querySelector('#batchMsModalBody input[data-ym-key="2024-01"]');
    first.value = '7777';
    window.gotoBatchMsPage(1);
    expect(document.querySelectorAll('#batchMsModalBody input[data-ym-key]').length).toBe(12);
    expect(window.batchMsModalDraft['2024-01']).toBe('7777');
    window.gotoBatchMsPage(-1);
    expect(document.querySelector('#batchMsModalBody input[data-ym-key="2024-01"]').value).toBe(
      '7777'
    );
  });

  it('hides pager when months <= 12', () => {
    buildBatchMsDom(8);
    window.renderBatchMsModalPage();
    expect(document.getElementById('batchMsModalPager').hidden).toBe(true);
  });
});
