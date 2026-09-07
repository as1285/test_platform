import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const purchase = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');

describe('iOS Safari 支付宝唤起', () => {
  it('builds ds.alipay.com https scheme bridge instead of opening raw QR page', () => {
    expect(purchase).toContain("https://ds.alipay.com/?scheme=");
    expect(purchase).toContain('function buildAlipayHttpsBridge');
    expect(purchase).toContain('httpsBridge: buildAlipayHttpsBridge(scheme)');
    expect(purchase).toContain('platformapi/startapp?saId=10000007&qrcode=');
  });

  it('keeps a blank window before async create so Safari does not drop the gesture', () => {
    expect(purchase).toContain('function openAlipayGestureWindow');
    expect(purchase).toContain("window.open('about:blank', '_blank')");
    expect(purchase).toContain('function navigateAlipayGestureWindow');
    expect(purchase).toContain('var gestureWin = openAlipayGestureWindow()');
    expect(purchase).toContain('navigateAlipayGestureWindow(gestureWin, payUrl)');
  });

  it('iOS launch and fallback use the https bridge, not qr.alipay.com cashier guess', () => {
    expect(purchase).toContain('iosHttps = urls.httpsBridge');
    expect(purchase).toContain('el.href = urls.httpsBridge || urls.scheme');
    expect(purchase).toContain('alipayOpenFallbackSticky');
    expect(purchase).not.toMatch(
      /else if \(isAlipayHttpUrl\(code\)\) \{\s*\/\* iOS[\s\S]*el\.href = code;/
    );
  });
});
