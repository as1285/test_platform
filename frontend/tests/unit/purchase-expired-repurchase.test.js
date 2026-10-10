import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const purchase = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

describe('purchase expired trial repurchase', () => {
  it('purchaseAuthFetch always soft-allows activation_expired', () => {
    expect(purchase).toContain('opts.allowActivationExpired = true');
    expect(purchase).toContain('auth.js?v=20261010-smoke-hoist-k70');
    expect(purchase).toContain("authFetch('api/user?action=info', { allowActivationExpired: true })");
    expect(purchase).toContain('allowActivationExpired: true');
  });

  it('authFetch detects purchase in WebView/asset paths', () => {
    expect(auth).toContain('android_asset');
    expect(auth).toContain('/purchase\\.html/i.test(locPath)');
  });
});
