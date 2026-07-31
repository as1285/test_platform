import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const backendBins = require('../../../backend/bank_card_bins.js');

beforeAll(() => {
  const code = readFileSync(resolve(__dirname, '../../public/js/bank_card_bins.js'), 'utf8');
  // eslint-disable-next-line no-eval
  eval(code);
});

describe('BIN contract frontend ↔ backend', () => {
  const samples = [
    '6222021234567890',
    '6227001234567890',
    '6214830011223344',
    '6221559988776655',
    '9999999999999999',
    '6222 0212 3456 7890'
  ];

  it.each(samples)('matches for %s', (card) => {
    expect(window.BankCardBins.inferBankNameFromCardNo(card)).toBe(
      backendBins.inferBankNameFromCardNo(card)
    );
  });
});
