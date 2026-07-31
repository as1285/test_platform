import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

beforeAll(() => {
  const code = readFileSync(resolve(__dirname, '../../public/js/tax-year.js'), 'utf8');
  // eslint-disable-next-line no-eval
  eval(code);
});

describe('tax-year', () => {
  it('normalizes invalid years to current max', () => {
    const max = window.getMaxTaxYear();
    expect(window.normalizeTaxYear('')).toBe(max);
    expect(window.normalizeTaxYear('1800')).toBe(max);
    expect(window.normalizeTaxYear(String(max))).toBe(max);
  });

  it('listTaxYears spans 1900..max', () => {
    const years = window.listTaxYears();
    expect(years[0]).toBe(1900);
    expect(years[years.length - 1]).toBe(window.getMaxTaxYear());
  });

  it('isPlausibleTaxYear', () => {
    expect(window.isPlausibleTaxYear('2024')).toBe(true);
    expect(window.isPlausibleTaxYear('0')).toBe(false);
  });
});
