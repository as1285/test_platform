import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const indirectEval = eval;
const html = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

function loadAlignFns() {
  const start = html.indexOf('function fractionAfterDecimal');
  const end = html.indexOf('function createPurchaseWatermarkLayer');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  indirectEval(
    '(function(){' +
      html.slice(start, end) +
      ';window.fractionAfterDecimal=fractionAfterDecimal;' +
      'window.syncListDateToSummaryDecimal=syncListDateToSummaryDecimal;})()'
  );
}

describe('收入纳税明细：工资薪金日期对齐汇总税额小数点', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--list-date-inset');
    document.body.innerHTML =
      '<span class="summary-value" id="taxTotal" style="font:16px Arial,sans-serif">5946.01元</span>' +
      '<div id="recordList"><span class="list-date">2026-09</span></div>';
  });

  it('keeps CSS inset variable and overrides device flush-right dates', () => {
    expect(html).toContain('--list-date-inset');
    expect(html).toContain('body.page-shuiming-result #recordList .list-date');
    expect(html).toContain('function syncListDateToSummaryDecimal');
    expect(html).toContain("setProperty('--list-date-inset'");
    expect(html).not.toMatch(/\.list-date\s*\{[^}]*margin-right:\s*25px/);
  });

  it('measures the tax fraction (01元) and writes --list-date-inset', () => {
    loadAlignFns();
    expect(window.fractionAfterDecimal('5946.01元')).toBe('01元');
    expect(window.fractionAfterDecimal('149435.11元')).toBe('11元');
    const proto = window.HTMLElement.prototype;
    const orig = proto.getBoundingClientRect;
    proto.getBoundingClientRect = function () {
      if (this.textContent === '01元') {
        return { width: 28.5, height: 16, top: 0, left: 0, right: 28.5, bottom: 16, x: 0, y: 0 };
      }
      return orig.apply(this, arguments);
    };
    try {
      window.syncListDateToSummaryDecimal();
      expect(document.documentElement.style.getPropertyValue('--list-date-inset')).toBe('28.5px');
    } finally {
      proto.getBoundingClientRect = orig;
    }
  });
});
