/**
 * app_settings 分层：运营配置 vs 禁止写入的密钥类键（阶段 4）
 */
const OPS_SETTING_KEYS = [
  'test_account_company_name',
  'mine_ui_json',
  'android_apk_download_url',
  'agent_android_apk_download_url',
  'ios_mobileconfig_download_url',
  'xianyu_purchase_url',
  'xianyu_hide_sales_channels',
  'qq_add_url',
  'qq_group_url',
  'wechat_pay_qrcode_url',
  'conversion_ab_json',
  'landing_ab_json',
  'sales_agent_json',
  'pricing_ab_json',
  'sku_catalog_prices_json',
  'tax_edit_fee_json',
  'rename_fee_json',
  'activation_nudge_json',
  'activation_batch_channels_json',
  'migration_activation_codes_no_expiry_v1',
];

/** 只允许环境变量 / 密钥管理，禁止写入 app_settings */
const ENV_ONLY_SECRET_KEYS = [
  'JWT_SECRET',
  'ADMIN_ACTIVATION_KEY',
  'ADMIN_PANEL_PASSWORD',
  'DB_PASSWORD',
  'SMTP_PASS',
  'ALIPAY_PRIVATE_KEY',
  'ALIPAY_PUBLIC_KEY',
  'ALIPAY_APP_ID',
  'REGISTER_APP_SIGN_SECRET'
];

const FORBIDDEN_SETTING_KEY_RE =
  /(^|_)(secret|token|password|passwd|pwd|private[_-]?key|credential|api[_-]?key|access[_-]?key|smtp_pass|alipay_private)(_|$)/i;

/**
 * @param {string} key
 * @returns {{ forbidden: boolean, reason?: string }}
 */
function classifySettingKey(key) {
  var k = String(key || '').trim();
  if (!k) {
    return { forbidden: true, reason: 'empty_key' };
  }
  var upper = k.toUpperCase();
  for (var i = 0; i < ENV_ONLY_SECRET_KEYS.length; i++) {
    if (ENV_ONLY_SECRET_KEYS[i] === upper || ENV_ONLY_SECRET_KEYS[i].toLowerCase() === k.toLowerCase()) {
      return { forbidden: true, reason: 'env_only_secret' };
    }
  }
  if (FORBIDDEN_SETTING_KEY_RE.test(k)) {
    return { forbidden: true, reason: 'secret_like_key' };
  }
  return { forbidden: false };
}

/** 判断：ForbiddenSettingKey */
function isForbiddenSettingKey(key) {
  return classifySettingKey(key).forbidden;
}

/** 判断：OpsSettingKey */
function isOpsSettingKey(key) {
  var k = String(key || '').trim();
  return OPS_SETTING_KEYS.indexOf(k) >= 0;
}

module.exports = {
  OPS_SETTING_KEYS,
  ENV_ONLY_SECRET_KEYS,
  classifySettingKey,
  isForbiddenSettingKey,
  isOpsSettingKey
};
