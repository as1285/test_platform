'use strict';

const {
  defaultTaxRecordsPolicy,
  normalizeTaxRecordsPolicy,
  parseTaxRecordsPolicyFromAdmin,
  isAllowMultiplePerMonth
} = require('../../src/tax/taxRecordsPolicy');
const { handlePublicTaxRecordsPolicy } = require('../../src/tax/taxRecordsPolicyHttp');

describe('taxRecordsPolicy', () => {
  it('defaults to single record per month', () => {
    expect(defaultTaxRecordsPolicy()).toEqual({ allow_multiple_per_month: false });
    expect(isAllowMultiplePerMonth(null)).toBe(false);
  });

  it('normalizes admin / stored json', () => {
    expect(normalizeTaxRecordsPolicy({ allow_multiple_per_month: 1 })).toEqual({
      allow_multiple_per_month: true
    });
    expect(parseTaxRecordsPolicyFromAdmin({ allow_multiple_per_month: 'true' })).toEqual({
      allow_multiple_per_month: true
    });
  });
});

describe('taxRecordsPolicyHttp', () => {
  it('public handler returns 200 default policy without a pool', async () => {
    var status = 200;
    var body = null;
    var res = {
      json: function (payload) {
        body = payload;
        return res;
      },
      status: function (code) {
        status = code;
        return res;
      }
    };
    await handlePublicTaxRecordsPolicy({}, res);
    expect(status).toBe(200);
    expect(body).toEqual({
      code: 200,
      data: { allow_multiple_per_month: false }
    });
  });
});
