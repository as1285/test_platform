import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('shuiming back returns to 办&查 by default', () => {
  it('shuiming.html defaults back href to bancha and captures from/reset', () => {
    const html = read('shuiming.html');
    expect(html).toContain('href="bancha.html" class="back-btn" id="shuimingBack"');
    expect(html).toContain("var STORE_KEY = 'tax_shuiming_back_v1'");
    expect(html).toContain('return BANCHA;');
    expect(html).toContain("window.__shuimingBackFrom");
    expect(html).toMatch(/fromTok === 'shouye' \|\| fromTok === 'bancha'/);
    expect(html).toContain("url.searchParams.set('from', 'shouye')");
  });

  it('bancha entry stamps from=bancha', () => {
    const html = read('bancha.html');
    expect(html).toContain('href="shuiming.html?from=bancha"');
  });

  it('shuiming_result preserves from when returning to filter page', () => {
    const html = read('shuiming_result.html');
    expect(html).toContain('href="shuiming.html?from=bancha"');
    expect(html).toContain("href += '&from=bancha'");
    expect(html).toContain("href += '&from=shouye'");
    expect(html).toContain("sessionStorage.getItem('tax_shuiming_back_v1')");
  });
});
