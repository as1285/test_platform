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
    expect(window.normalizeTaxYear('2018')).toBe(max);
    expect(window.normalizeTaxYear(String(max))).toBe(max);
  });

  it('listTaxYears spans 2019..max', () => {
    const years = window.listTaxYears();
    expect(years[0]).toBe(2019);
    expect(years[years.length - 1]).toBe(window.getMaxTaxYear());
  });

  it('isPlausibleTaxYear', () => {
    expect(window.isPlausibleTaxYear('2024')).toBe(true);
    expect(window.isPlausibleTaxYear('0')).toBe(false);
  });

  it('resolveSelectedTaxYear keeps URL year even when reset=1', () => {
    const max = window.getMaxTaxYear();
    expect(window.resolveSelectedTaxYear({ urlYear: '2024', reset: true, storedYear: '2025' })).toBe('2024');
    expect(window.resolveSelectedTaxYear({ urlYear: '', reset: true, storedYear: '2024' })).toBe(String(max));
    expect(window.resolveSelectedTaxYear({ urlYear: '', reset: false, storedYear: '2023' })).toBe('2023');
    expect(window.resolveSelectedTaxYear({ urlYear: '2018', reset: false, storedYear: '2023' })).toBe(String(max));
  });
});
