import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const guideSrc = readFileSync(
  resolve(__dirname, '../../public/js/conversion-guide.js'),
  'utf8'
);

function loadYearHelpers() {
  const start = guideSrc.indexOf('function normalizeTaxYearLocal');
  const end = guideSrc.indexOf('function getToastDurationMs');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('year helpers not found in conversion-guide.js');
  }
  const goStart = guideSrc.indexOf('function goIncomeDetail');
  const goEnd = guideSrc.indexOf('function track(action, meta)');
  if (goStart < 0 || goEnd < 0 || goEnd <= goStart) {
    throw new Error('goIncomeDetail not found in conversion-guide.js');
  }
  // eslint-disable-next-line no-new-func
  return new Function(
    guideSrc.slice(start, end) +
      guideSrc.slice(goStart, goEnd) +
      '; return { pickYearFromTaxRecords: pickYearFromTaxRecords, goIncomeDetail: goIncomeDetail, parseProvidedTaxYear: parseProvidedTaxYear, fallbackSelectedTaxYear: fallbackSelectedTaxYear };'
  )();
}

describe('pickYearFromTaxRecords', () => {
  it('returns the earliest year that has at least one record', () => {
    const { pickYearFromTaxRecords } = loadYearHelpers();
    expect(
      pickYearFromTaxRecords([
        { year: 2025, income: 1000 },
        { year: '2023', income: 2000 },
        { year: 2024, income: 3000 },
        { year: 2025, income: 4000 }
      ])
    ).toBe(2023);
  });

  it('ignores deleted and empty records', () => {
    const { pickYearFromTaxRecords } = loadYearHelpers();
    expect(
      pickYearFromTaxRecords([
        null,
        {},
        { year: '', income: 1 },
        { year: 2022, deleted: true },
        { year: 2021, is_deleted: 1 },
        { year: 2020, deleted_at: '2026-01-01' },
        { year: 2024, income: 8000 }
      ])
    ).toBe(2024);
  });

  it('returns null when no usable year exists', () => {
    const { pickYearFromTaxRecords } = loadYearHelpers();
    expect(pickYearFromTaxRecords([])).toBe(null);
    expect(pickYearFromTaxRecords(null)).toBe(null);
    expect(pickYearFromTaxRecords([{ deleted: true, year: 2023 }])).toBe(null);
  });
});

describe('goIncomeDetail year argument', () => {
  beforeEach(() => {
    localStorage.clear();
    const loc = { href: 'http://localhost/consult.html' };
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: loc
    });
  });

  it('uses the passed year even if selected_year is newer', () => {
    const { goIncomeDetail } = loadYearHelpers();
    localStorage.setItem('selected_year', '2026');
    goIncomeDetail(2023);
    expect(String(window.location.href)).toContain('shuiming_result.html?year=2023');
    expect(localStorage.getItem('selected_year')).toBe('2023');
  });

  it('falls back to selected_year when year arg is missing', () => {
    const { goIncomeDetail } = loadYearHelpers();
    localStorage.setItem('selected_year', '2024');
    goIncomeDetail(null);
    expect(String(window.location.href)).toContain('shuiming_result.html?year=2024');
    expect(localStorage.getItem('selected_year')).toBe('2024');
  });

  it('rejects an out-of-range year argument and uses storage', () => {
    const { goIncomeDetail, parseProvidedTaxYear } = loadYearHelpers();
    expect(parseProvidedTaxYear(2010)).toBe(null);
    localStorage.setItem('selected_year', '2025');
    goIncomeDetail(2010);
    expect(String(window.location.href)).toContain('shuiming_result.html?year=2025');
  });
});

describe('afterTaxRecordsCreated year wiring', () => {
  it('picks year from newly written records and persists selected_year', () => {
    expect(guideSrc).toContain('function pickYearFromTaxRecords');
    expect(guideSrc).toContain('var fromRecords = pickYearFromTaxRecords(records)');
    expect(guideSrc).toContain('if (fromRecords != null) persistSelectedTaxYear(y)');
    expect(guideSrc).toContain('showValueConfirmDialog(y)');
    expect(guideSrc.indexOf('resolveTaxRecordsForRefundAd(opts)')).toBeLessThan(
      guideSrc.indexOf('var fromRecords = pickYearFromTaxRecords(records)')
    );
    expect(guideSrc).toContain('parseProvidedTaxYear(year)');
    expect(guideSrc).toContain("shuiming_result.html?year=' +");
  });
});
