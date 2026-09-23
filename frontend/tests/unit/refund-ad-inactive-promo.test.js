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

describe('product no longer diverts inactive users to refund ads', () => {
  it('keeps refund helpers but disables in-product diversion', () => {
    expect(guideSrc).toContain('已关闭：不再向咨询页/明细页推二次退税广告入口');
    expect(guideSrc).toContain('function syncRefundAdRecommendCards');
    expect(guideSrc).not.toContain('去计算可退税额');
    expect(guideSrc).not.toContain('去广告页看看');
    expect(guideSrc).not.toContain('id="cgValueGoRefund"');
    expect(guideSrc).toContain('id="cgValueGoPurchase"');
    expect(guideSrc).toContain('去开通去水印');
    expect(guideSrc).toContain("purchase.html?from=tax_done");
    expect(guideSrc).toContain('收入纳税明细不再插入「示例填写个税」空态 CTA');
    expect(guideSrc).toContain('function hideShuimingTaxFillCard');
    expect(guideSrc).toContain('去添加记录');
    expect(authSrc).toContain('conversion-guide.js?v=20260923-fill-tap2');
    expect(guideSrc).toMatch(
      /function maybeShowActivationNudge\(\) \{[\s\S]{0,280}if \(!isAccountActive\(\)\) return;/
    );
  });

  it('consult pay banner goes to purchase; refund cards stay dormant', () => {
    expect(consultHtml).toContain('href="purchase.html?from=tax_done"');
    expect(consultHtml).toContain('>去开通<');
    expect(consultHtml).not.toContain('href="refund_ad.html?from=tax_done"');
    expect(consultHtml).toContain('id="consultRefundAdEntry"');
    expect(consultHtml).toContain('href="purchase.html?from=consult_products"');
    expect(shuimingHtml).toContain('填写个税引导卡已下线');
    expect(shuimingHtml).not.toContain('去填写个税');
    expect(shuimingHtml).not.toContain('href="refund_ad.html?from=shuiming_result"');
  });
});

describe('ConversionGuide runtime: refund cards stay hidden', () => {
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

  it('keeps consult refund card hidden for inactive users', () => {
    const CG = loadGuide();
    localStorage.setItem('token', 't');
    localStorage.setItem('account_active', '0');
    window.__smAccountActiveConfirmed = false;
    CG.syncRefundAdRecommendCards([]);
    expect(document.getElementById('consultRefundAdEntry').hidden).toBe(true);
    const card = document.getElementById('smActivateCard');
    expect(card.hidden).toBe(true);
    expect(card.classList.contains('is-tax-fill')).toBe(false);
  });

  it('does not show tax-fill card even when records already exist', () => {
    const CG = loadGuide();
    localStorage.setItem('token', 't');
    localStorage.setItem('account_active', '0');
    window.__smAccountActiveConfirmed = false;
    CG.syncRefundAdRecommendCards([{ income_item: '工资薪金', period: '2026-09' }]);
    expect(document.getElementById('consultRefundAdEntry').hidden).toBe(true);
    expect(document.getElementById('smActivateCard').hidden).toBe(true);
  });

  it('hides tax-fill card for activated users', () => {
    const CG = loadGuide();
    localStorage.setItem('token', 't');
    localStorage.setItem('account_active', '1');
    window.__smAccountActiveConfirmed = true;
    CG.syncRefundAdRecommendCards([]);
    expect(document.getElementById('consultRefundAdEntry').hidden).toBe(true);
    expect(document.getElementById('smActivateCard').hidden).toBe(true);
  });
});
