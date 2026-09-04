import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const tokens = readFileSync(resolve(__dirname, '../../css/device-tokens.css'), 'utf8');
const smoke = readFileSync(resolve(__dirname, '../e2e/ui-smoke-browser.mjs'), 'utf8');
const analytics = readFileSync(
  resolve(__dirname, '../../public/js/admin/modules/ad-analytics.js'),
  'utf8'
);
const records = readFileSync(resolve(__dirname, '../../public/js/consult-records.js'), 'utf8');

describe('device layout tokens', () => {
  it('defines the three layout tokens and 17 Pro Max overrides', () => {
    expect(tokens).toContain('--device-safe-top');
    expect(tokens).toContain('--device-list-edge');
    expect(tokens).toContain('--device-arrow-ty');
    expect(tokens).toContain('html.app-ios-iphone17promax');
    expect(tokens).toContain('--device-arrow-ty: -6px');
  });

  it('Playwright 17 Pro Max smoke asserts token, baseline, and screenshot', () => {
    expect(smoke).toContain("profile.id === 'iphone-17-promax'");
    expect(smoke).toContain('--device-arrow-ty');
    expect(smoke).toContain("expected -6px");
    expect(smoke).toContain('arrowBottom-nameBottom');
    expect(smoke).toContain('iphone-17-promax-company-arrow.png');
  });
});

describe('inactive funnel primary CTA + SMTP fail rate', () => {
  it('consult tax-pay banner points at the estimate page', () => {
    expect(records).toContain("cta.setAttribute('href', 'refund_ad.html?from=tax_done')");
    expect(records).toContain("cta.textContent = '查看可退税额'");
  });

  it('ad hub reach tab loads campaign-stats', () => {
    expect(analytics).toContain('function loadCampaignStats');
    expect(analytics).toContain('api/admin/emails/campaign-stats?campaign=refund_ad_amount&days=7');
    expect(analytics).toContain("if (tab === 'reach')");
    expect(analytics).toContain('loadCampaignStats()');
  });
});
