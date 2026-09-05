import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const guideSrc = readFileSync(
  resolve(__dirname, '../../public/js/conversion-guide.js'),
  'utf8'
);
const consultHtml = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');
const shuimingHtml = readFileSync(
  resolve(__dirname, '../../shuiming_result.html'),
  'utf8'
);
const authSrc = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

function loadGuide() {
  window.__cgCapturePrivacyBound = false;
  delete window.ConversionGuide;
  window.trackUserAction = vi.fn();
  window.fetch = vi.fn(() => Promise.reject(new Error('offline')));
  // eslint-disable-next-line no-eval
  eval(guideSrc);
  return window.ConversionGuide;
}

describe('inactive users always see refund ad (source)', () => {
  it('wires C-end promo to every unactivated user, not only tax-qualified', () => {
    expect(guideSrc).toContain('var showInactive = inactive');
    expect(guideSrc).not.toMatch(/var showInactive = inactive &&/);
    expect(guideSrc).toContain('function renderInactiveRefundAdPromo');
    expect(guideSrc).toContain('cg-inactive-refund-promo');
    expect(guideSrc).toContain('未开通可看');
    expect(guideSrc).toContain('去计算可退税额');
    expect(guideSrc).toContain('track_refund_ad_inactive_promo_show');
    expect(guideSrc).toContain('track_refund_ad_inactive_promo_click');
    expect(guideSrc).toContain("refundAdRecommendHref('shouye')");
    expect(authSrc).toContain('conversion-guide.js?v=20260905-list-tap');
    expect(guideSrc).toContain('id="cgValueGoRefund"');
    expect(guideSrc).toContain('查看可退税额');
    expect(guideSrc).not.toContain('id="cgValueGoPay"');
    expect(guideSrc).toMatch(
      /function maybeShowActivationNudge\(\) \{[\s\S]{0,280}if \(!isAccountActive\(\)\) return;/
    );
  });

  it('consult and shuiming CTAs go to refund_ad, not purchase', () => {
    expect(consultHtml).toContain('href="refund_ad.html?from=consult"');
    expect(consultHtml).toContain('href="refund_ad.html?from=consult_products"');
    expect(consultHtml).toContain('href="refund_ad.html?from=tax_done"');
    expect(consultHtml).toContain('href="purchase.html?from=consult_products"');
    expect(consultHtml).toContain('未开通也可先看二次退税');
    expect(shuimingHtml).toContain('href="refund_ad.html?from=shuiming_result"');
    expect(shuimingHtml).toContain('去计算可退税额');
    expect(shuimingHtml).toContain('track_refund_ad_inactive_promo_click');
  });
});

describe('ConversionGuide runtime: inactive refund cards without tax hit', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '';
    document.body.innerHTML = `
      <div id="consultRefundAdEntry" hidden>
        <div id="consultRefundAdTitle"></div>
        <span id="consultRefundAdBadge"></span>
        <p id="consultRefundAdHint"></p>
        <a id="btnConsultRefundAd" href="#"></a>
      </div>
      <div id="smActivateCard" hidden>
        <p id="smActivateTitle"></p>
        <p id="smActivateDesc"></p>
        <a id="smActivateBtn" href="#"></a>
      </div>
    `;
    vi.stubGlobal('location', {
      href: 'http://localhost/consult.html',
      pathname: '/consult.html',
      search: '',
      assign: vi.fn()
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows consult + shuiming cards for logged-in inactive users with empty records', () => {
    const CG = loadGuide();
    localStorage.setItem('token', 't');
    localStorage.setItem('account_active', '0');
    window.__smAccountActiveConfirmed = false;
    CG.syncRefundAdRecommendCards([]);
    const root = document.getElementById('consultRefundAdEntry');
    expect(root.hidden).toBe(false);
    expect(document.getElementById('consultRefundAdBadge').textContent).toBe('未开通可看');
    expect(document.getElementById('btnConsultRefundAd').textContent).toBe('去计算可退税额');
    expect(document.getElementById('btnConsultRefundAd').getAttribute('href')).toContain(
      'refund_ad.html'
    );
    const card = document.getElementById('smActivateCard');
    expect(card.hidden).toBe(false);
    expect(document.getElementById('smActivateBtn').textContent).toBe('去计算可退税额');
  });

  it('hides the cards for activated users without 15万 income', () => {
    const CG = loadGuide();
    localStorage.setItem('token', 't');
    localStorage.setItem('account_active', '1');
    window.__smAccountActiveConfirmed = true;
    CG.syncRefundAdRecommendCards([]);
    expect(document.getElementById('consultRefundAdEntry').hidden).toBe(true);
    expect(document.getElementById('smActivateCard').hidden).toBe(true);
  });
});
