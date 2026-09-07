import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const purchase = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');
const escapeJs = readFileSync(resolve(__dirname, '../../public/js/tab-shell-escape.js'), 'utf8');
const tabShell = readFileSync(resolve(__dirname, '../../public/js/tab-shell.js'), 'utf8');
const authBoot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const guide = readFileSync(resolve(__dirname, '../../public/js/conversion-guide.js'), 'utf8');

describe('iOS 开通页套餐能加载', () => {
  it('开通页从 tab iframe 提到顶层，避免 WKWebView 子框 fetch 挂起', () => {
    expect(purchase).toContain('tab-shell-escape.js?v=20260907-pay-top2');
    expect(escapeJs).toContain('|purchase)\\.html');
    expect(escapeJs).toContain('function isNestedWindow');
    expect(escapeJs).toContain('top !== global');
    expect(tabShell).toContain("file === 'purchase.html'");
  });

  it('套餐请求不再串在 ABC / 安装包后面，并有超时重试', () => {
    expect(purchase).toContain('function bootPurchaseOffers');
    expect(purchase).toContain('套餐接口不再等 ABC / 安装包配置');
    expect(purchase).toContain('function fetchWithTimeout');
    expect(purchase).toContain('var FALLBACK_ALIPAY_SKUS');
    expect(purchase).toContain('data-sku-id="sku_300_7d"');
    expect(purchase).toContain('id="cardAlipay"');
    expect(purchase).toMatch(/id="cardAlipaySkel"[^>]*\bhidden\b/);
    expect(purchase).toContain('function readLocalPurchaseAbc');
    expect(purchase).not.toMatch(/document\.write\([\s\S]{0,500}<\/body>/);
  });

  it('从「我的」/ 引导去开通走顶层跳转', () => {
    expect(authBoot).toContain('function assignTopLocation');
    expect(authBoot).toContain('window.assignTopLocation = assignTopLocation');
    expect(guide).toContain("purchase.html?from=' + encodeURIComponent(src)");
    expect(guide).toContain('assignTopLocation(dest)');
  });
});
