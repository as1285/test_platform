import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('frontend smoke', () => {
  it('tax-year module exposes helpers on window', () => {
    const code = readFileSync(resolve(__dirname, '../../public/js/tax-year.js'), 'utf8');
    // eslint-disable-next-line no-eval
    eval(code);
    expect(typeof window.normalizeTaxYear).toBe('function');
    expect(window.getMinTaxYear()).toBe(2019);
  });
});
