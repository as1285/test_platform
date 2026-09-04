'use strict';

const fs = require('fs');
const path = require('path');

const monolith = fs.readFileSync(path.join(__dirname, '../../src/legacy/monolith.js'), 'utf8');

describe('core refund-ad promo to all inactive users', () => {
  it('defaults ON and schedules inbox + email after startup', () => {
    expect(monolith).toContain("process.env.REFUND_AD_PROMO_ENABLED != null ? process.env.REFUND_AD_PROMO_ENABLED : '1'");
    expect(monolith).toMatch(/REFUND_AD_PROMO_ENABLED[\s\S]*!==\s*'0'/);
    expect(monolith).toContain('function runRefundAdPromo');
    expect(monolith).toContain('function scheduleRefundAdPromo');
    expect(monolith).toContain('scheduleRefundAdPromo();');
    expect(monolith).toContain("audience: 'all_inactive'");
    expect(monolith).toContain("audience: 'has_email_inactive'");
    expect(monolith).toContain("campaign: 'refund_ad_amount'");
    expect(monolith).toContain('personalizeRefundAmount: true');
    expect(monolith).toContain('skipHours: REFUND_AD_EMAIL_SKIP_HOURS');
    expect(monolith).toContain("process.env.REFUND_AD_EMAIL_SKIP_HOURS || '24'");
    expect(monolith).toContain("skipMarker: MSG_AUTO_REFUND_AD_MARKER");
    expect(monolith).toContain("MSG_AUTO_REFUND_AD_MARKER = '@@auto_refund_ad'");
    expect(monolith).toContain("linkUrl: 'refund_ad.html?from=msg_refund'");
    expect(monolith).toContain('allowPartial: true');
  });

  it('uses测算 copy rather than forcing purchase', () => {
    expect(monolith).toContain('MSG_AUTO_REFUND_AD_TITLE');
    expect(monolith).toContain('一键计算');
    expect(monolith).toContain('未开通也可先看二次退税');
  });
});
