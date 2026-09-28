import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

function jsonAsciiHeaderValue(obj) {
  const j = JSON.stringify(obj);
  return j.replace(/[^\x00-\xFF]/g, (ch) => {
    const hex = ch.charCodeAt(0).toString(16);
    return '\\u' + '0000'.substring(hex.length) + hex;
  });
}

describe('X-Client-Device Latin-1 header', () => {
  it('escapes non-Latin-1 in auth.js before fetch headers', () => {
    expect(auth).toContain('function jsonAsciiHeaderValue(');
    expect(auth).toContain('jsonAsciiHeaderValue(payload)');
    expect(auth).toContain("{ 'X-Client-Device': j }");
  });

  it('keeps Chinese UA fetchable and JSON-parseable', () => {
    const raw = jsonAsciiHeaderValue({
      user_agent: 'Mozilla/5.0 TaxPlatformCordovaApp/1.0 一加 12',
      model: '小米 14'
    });
    expect(/[^\x00-\xFF]/.test(raw)).toBe(false);
    const parsed = JSON.parse(raw);
    expect(parsed.user_agent).toContain('一加 12');
    expect(parsed.model).toBe('小米 14');
  });
});
