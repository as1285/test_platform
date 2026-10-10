import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

const DOUBLE_PAD =
  /list-summary-pad,\s*96px\)\)\s*!important;[\s\S]{0,120}?padding-top:\s*var\(--list-summary-pad/;

describe('iPhone Pro Max shuiming_result top blank', () => {
  it('does not double-count list-summary-pad in margin + padding', () => {
    const html = read('shuiming_result.html');
    const auth = read('public/js/auth.js');
    expect(html).not.toMatch(DOUBLE_PAD);
    expect(auth).not.toMatch(DOUBLE_PAD);
    expect(html).toMatch(/app-ios-iphone14promax[\s\S]{0,400}?padding-top:\s*0\s*!important/);
  });

  it('syncTopFixedHeight treats 14/16 Pro Max as wide seam', () => {
    const html = read('shuiming_result.html');
    expect(html).toContain("classList.contains('app-ios-iphone14promax')");
    expect(html).toContain("classList.contains('app-ios-iphone16promax')");
    expect(html).toContain('isIphone15Wide');
  });
});
