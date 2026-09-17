import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const purchase = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');

describe('purchase psych price Alipay fallback', () => {
  it('shows an on-page QR when scheme launch fails', () => {
    expect(purchase).toContain('id="alipayQrPanel"');
    expect(purchase).toContain('function isRestrictedAlipayWebView');
    expect(purchase).toContain('function renderAlipayQrPanel');
    expect(purchase).toContain('renderAlipayQrPanel(code)');
    expect(purchase).toContain('/js/vendor/qrcode.min.js');
  });

  it('uses https bridge on Honor / Douyin / Android WebView', () => {
    expect(purchase).toContain('Bytedance|aweme|Douyin|NewsArticle|TTWebView');
    expect(purchase).toMatch(
      /if \(isRestrictedAlipayWebView\(\)\) \{[\s\S]{0,400}openExternalUrl\(urls\.httpsBridge\)/
    );
    expect(purchase).toContain(
      '(isRestrictedAlipayWebView() && urls.httpsBridge) ||'
    );
  });

  it('keeps a single custom / psych SKU visible instead of hiding the list', () => {
    expect(purchase).toContain('var showSingleCustom =');
    expect(purchase).toContain("variant === 'custom_offer'");
    expect(purchase).toContain('onlySku.psych_offer');
  });
});
