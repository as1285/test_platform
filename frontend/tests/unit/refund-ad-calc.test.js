import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const estimateSrc = readFileSync(
  resolve(__dirname, '../../public/js/refund-estimate.js'),
  'utf8'
);
const adHtml = readFileSync(resolve(__dirname, '../../refund_ad.html'), 'utf8');

function loadEstimate() {
  delete window.RefundEstimate;
  // eslint-disable-next-line no-eval
  eval(estimateSrc);
  return window.RefundEstimate;
}

function monthsForYear(year, income, tax) {
  const rows = [];
  for (let m = 1; m <= 12; m++) {
    rows.push({
      year: year,
      month: m,
      income: String(income),
      tax_reported: String(tax),
      company_name: '甲公司'
    });
  }
  return rows;
}

function mountAdDom() {
  document.body.innerHTML =
    '<p id="refundEstAmt">点下方按钮自动计算</p>' +
    '<p id="refundEstAmtLabel">2023、2024、2025 大约可退</p>' +
    '<ul id="refundEstYearRows">' +
    '<li><strong data-year="2023">待计算</strong></li>' +
    '<li><strong data-year="2024">待计算</strong></li>' +
    '<li><strong data-year="2025">待计算</strong></li>' +
    '</ul>' +
    '<button type="button" id="btnCalcRefundEst">一键自动计算可退税额</button>' +
    '<div id="refundCalcOverlay" hidden>' +
    '<p id="refundCalcKicker"></p>' +
    '<h3 id="refundCalcTitle"></h3>' +
    '<p id="refundCalcTotal"></p>' +
    '<ul id="refundCalcYearList">' +
    '<li><strong data-year="2023">—</strong></li>' +
    '<li><strong data-year="2024">—</strong></li>' +
    '<li><strong data-year="2025">—</strong></li>' +
    '</ul>' +
    '<p id="refundCalcHint"></p>' +
    '<button type="button" id="btnRefundCalcPrimary"></button>' +
    '<button type="button" id="btnRefundCalcSecondary"></button>' +
    '</div>';
}

describe('refund ad one-click calc markup', () => {
  it('exposes the calc button, 3-year rows, overlay and contact CTA', () => {
    expect(adHtml).toContain('id="btnCalcRefundEst"');
    expect(adHtml).toContain('一键自动计算可退税额');
    expect(adHtml).toContain('id="refundEstYearRows"');
    expect(adHtml).toContain('data-year="2023"');
    expect(adHtml).toContain('data-year="2024"');
    expect(adHtml).toContain('data-year="2025"');
    expect(adHtml).toContain('id="refundCalcOverlay"');
    expect(adHtml).toContain('联系客服进行退税');
    expect(adHtml).toContain('/js/refund-estimate.js');
    expect(adHtml).toContain('RefundEstimate.bindAdPage');
    expect(estimateSrc).toContain('track_refund_ad_calc_click');
    expect(estimateSrc).toContain('联系客服进行退税');
  });
});

describe('RefundEstimate formula', () => {
  it('always returns 2023/2024/2025 and matches the capped 3-year total', () => {
    const api = loadEstimate();
    const threeYears = []
      .concat(monthsForYear(2023, '13000', '200'))
      .concat(monthsForYear(2024, '13000', '200'))
      .concat(monthsForYear(2025, '13000', '200'));
    const est = api.specialDeductionRefundEstimate(threeYears);
    expect(est.years.map((y) => y.year)).toEqual([2023, 2024, 2025]);
    expect(est.years.every((y) => y.has_records)).toBe(true);
    expect(est.total).toBe(7200);
    expect(api.formatYuan(7200)).toBe('¥7,200');
    expect(api.iitComprehensiveTax(96000)).toBe(7080);
  });

  it('keeps empty years as 0 so the card can still list 23/24/25', () => {
    const api = loadEstimate();
    const only2024 = monthsForYear(2024, '13000', '200');
    const est = api.specialDeductionRefundEstimate(only2024);
    expect(est.years).toHaveLength(3);
    expect(est.years.find((y) => y.year === 2023).has_records).toBe(false);
    expect(est.years.find((y) => y.year === 2024).saved).toBe(2400);
    expect(est.has_any_records).toBe(true);
  });
});

describe('RefundEstimate.bindAdPage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    window.authGetToken = vi.fn(() => '');
    window.authFetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('asks logged-out users to sign in, with a contact-cs fallback', () => {
    const api = loadEstimate();
    mountAdDom();
    const track = vi.fn();
    const copyWechat = vi.fn();
    api.bindAdPage({ track: track, copyWechat: copyWechat });
    document.getElementById('btnCalcRefundEst').click();
    expect(track).toHaveBeenCalledWith('track_refund_ad_calc_click', {});
    expect(document.getElementById('refundCalcOverlay').hidden).toBe(false);
    expect(document.getElementById('refundCalcTitle').textContent).toContain('登录');
    document.getElementById('btnRefundCalcSecondary').click();
    expect(copyWechat).toHaveBeenCalledWith('calc_result');
    expect(track).toHaveBeenCalledWith(
      'track_refund_ad_calc_contact',
      expect.objectContaining({ from: 'login' })
    );
  });

  it('calculates 2023-2025 and prompts contacting support', async () => {
    const api = loadEstimate();
    mountAdDom();
    window.authGetToken = vi.fn(() => 'tok');
    const threeYears = []
      .concat(monthsForYear(2023, '13000', '200'))
      .concat(monthsForYear(2024, '13000', '200'))
      .concat(monthsForYear(2025, '13000', '200'));
    window.authFetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ code: 200, data: { records: threeYears } })
      })
    );
    const track = vi.fn();
    const copyWechat = vi.fn();
    api.bindAdPage({ track: track, copyWechat: copyWechat });
    document.getElementById('btnCalcRefundEst').click();
    await vi.waitFor(() => {
      expect(document.getElementById('refundCalcTitle').textContent).toBe(
        '这三年大约可退'
      );
    });
    expect(document.getElementById('refundCalcTotal').textContent).toBe('¥7,200');
    expect(document.querySelector('#refundCalcYearList [data-year="2023"]').textContent).toBe(
      '¥2,400'
    );
    expect(document.querySelector('#refundCalcYearList [data-year="2024"]').textContent).toBe(
      '¥2,400'
    );
    expect(document.querySelector('#refundCalcYearList [data-year="2025"]').textContent).toBe(
      '¥2,400'
    );
    expect(document.getElementById('refundEstAmt').textContent).toBe('¥7,200');
    expect(document.getElementById('btnRefundCalcPrimary').textContent).toBe(
      '联系客服进行退税'
    );
    expect(document.getElementById('refundCalcHint').textContent).toContain('联系客服');
    expect(JSON.parse(localStorage.getItem('refund_ad_estimate_v1')).total).toBe(7200);
    expect(track).toHaveBeenCalledWith(
      'track_refund_ad_calc_done',
      expect.objectContaining({ estimate_total: 7200, has_records: 1 })
    );
    document.getElementById('btnRefundCalcPrimary').click();
    expect(copyWechat).toHaveBeenCalledWith('calc_result');
  });

  it('sends users without 2023-2025 records to fill tax, still offering support', async () => {
    const api = loadEstimate();
    mountAdDom();
    window.authGetToken = vi.fn(() => 'tok');
    window.authFetch = vi.fn(() =>
      Promise.resolve({
        json: () => Promise.resolve({ code: 200, data: { records: [] } })
      })
    );
    const copyWechat = vi.fn();
    const consultHref = vi.fn(() => 'consult.html?tab=records');
    api.bindAdPage({
      track: vi.fn(),
      copyWechat: copyWechat,
      consultHref: consultHref
    });
    document.getElementById('btnCalcRefundEst').click();
    await vi.waitFor(() => {
      expect(document.getElementById('refundCalcTitle').textContent).toContain(
        '请先填写'
      );
    });
    expect(document.getElementById('btnRefundCalcPrimary').textContent).toBe(
      '去填写税务记录'
    );
    document.getElementById('btnRefundCalcSecondary').click();
    expect(copyWechat).toHaveBeenCalledWith('calc_result');
  });
});
