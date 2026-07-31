import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

beforeAll(() => {
  // Minimal stubs so auth.js IIFE can bind without crashing
  window.localStorage.clear();
  window.CLIENT_APP_VERSION = 'unit-test';
  const code = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
  // eslint-disable-next-line no-eval
  eval(code);
});

describe('auth.sanitizeLoginNext', () => {
  it('accepts safe html next pages', () => {
    expect(window.sanitizeLoginNext('mine.html')).toBe('mine.html');
    expect(window.sanitizeLoginNext('/purchase.html')).toBe('purchase.html');
    expect(window.sanitizeLoginNext('shuiming_result.html?x=1')).toBe('shuiming_result.html?x=1');
  });

  it('rejects open redirects', () => {
    expect(window.sanitizeLoginNext('https://evil.com')).toBe('');
    expect(window.sanitizeLoginNext('//evil.com')).toBe('');
    expect(window.sanitizeLoginNext('../etc/passwd')).toBe('');
    expect(window.sanitizeLoginNext('javascript:alert(1)')).toBe('');
  });
});
