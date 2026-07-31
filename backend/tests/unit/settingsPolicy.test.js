'use strict';

const {
  classifySettingKey,
  isForbiddenSettingKey,
  isOpsSettingKey,
  looksLikeSecretBlob
} = require('../../src/shared/settingsPolicy');

describe('settingsPolicy', () => {
  it('forbids env-only secrets', () => {
    expect(classifySettingKey('JWT_SECRET').forbidden).toBe(true);
    expect(classifySettingKey('alipay_private_key').reason).toBe('env_only_secret');
    expect(isForbiddenSettingKey('CHAT_AI_API_KEY')).toBe(true);
  });

  it('forbids secret-like keys', () => {
    expect(classifySettingKey('my_api_key').forbidden).toBe(true);
    expect(classifySettingKey('smtp_password').forbidden).toBe(true);
  });

  it('allows ops keys', () => {
    expect(isOpsSettingKey('pricing_ab_json')).toBe(true);
    expect(isForbiddenSettingKey('pricing_ab_json')).toBe(false);
  });

  it('detects pasted secret blobs', () => {
    expect(looksLikeSecretBlob('-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----')).toBe(
      true
    );
    expect(looksLikeSecretBlob('sk-' + 'a'.repeat(24))).toBe(true);
    expect(looksLikeSecretBlob('普通运营文案')).toBe(false);
  });
});
