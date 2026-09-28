import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const indirectEval = eval;

function loadExpandHelper() {
  indirectEval(
    readFileSync(resolve(__dirname, '../../public/js/consult-records.js'), 'utf8')
      .split('function editRecord(id)')[0]
  );
}

function buildTaxFormDom() {
  document.body.innerHTML =
    '<div id="taxMoreCard" class="tax-more-card is-collapsed">' +
    '<button id="taxMoreToggle" aria-expanded="false"></button>' +
    '<div class="tax-more-body"></div>' +
    '</div>' +
    '<div id="singleTaxRecordCard" class="tax-advanced-card is-collapsed">' +
    '<button id="singleTaxRecordToggle" aria-expanded="false"></button>' +
    '</div>';
}

describe('consult-records expandSingleTaxRecordCard', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('expands outer taxMoreCard and inner singleTaxRecordCard', () => {
    buildTaxFormDom();
    loadExpandHelper();
    window.expandSingleTaxRecordCard();
    const more = document.getElementById('taxMoreCard');
    const single = document.getElementById('singleTaxRecordCard');
    expect(more.classList.contains('is-open')).toBe(true);
    expect(more.classList.contains('is-collapsed')).toBe(false);
    expect(document.getElementById('taxMoreToggle').getAttribute('aria-expanded')).toBe('true');
    expect(single.classList.contains('is-collapsed')).toBe(false);
    expect(document.getElementById('singleTaxRecordToggle').getAttribute('aria-expanded')).toBe(
      'true'
    );
  });
});
