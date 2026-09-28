'use strict';

const {
  classifySettingKey,
  isForbiddenSettingKey,
  isOpsSettingKey
} = require('../../src/shared/settingsPolicy');

describe('settingsPolicy', () => {
  it('forbids env-only secrets', () => {
    expect(classifySettingKey('JWT_SECRET').forbidden).toBe(true);
    expect(classifySettingKey('alipay_private_key').reason).toBe('env_only_secret');
    expect(isForbiddenSettingKey('third_party_api_key')).toBe(true);
  });

  it('forbids secret-like keys', () => {
    expect(classifySettingKey('my_api_key').forbidden).toBe(true);
    expect(classifySettingKey('smtp_password').forbidden).toBe(true);
  });

  it('allows ops keys', () => {
    expect(isOpsSettingKey('pricing_ab_json')).toBe(true);
    expect(isOpsSettingKey('ad_pages_json')).toBe(true);
    expect(isOpsSettingKey('tax_edit_fee_json')).toBe(true);
    expect(isOpsSettingKey('rename_fee_json')).toBe(true);
    expect(isOpsSettingKey('lizhi_cert_fee_json')).toBe(true);
    expect(isForbiddenSettingKey('pricing_ab_json')).toBe(false);
  });
});
