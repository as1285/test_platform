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
  'activation_nudge_json',
  'activation_batch_channels_json',
  'chat_auto_reply_welcome',
  'chat_auto_reply_reply',
  'chat_ai_enabled',
  'chat_ai_prompt',
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
  'CHAT_AI_API_KEY',
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

/**
 * 检测文本是否像误粘贴的密钥（用于 AI prompt 等软告警）
 * @param {string} text
 */
function looksLikeSecretBlob(text) {
  var s = String(text || '');
  if (!s) return false;
  if (/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(s)) return true;
  if (/\bsk-[A-Za-z0-9]{20,}\b/.test(s)) return true;
  if (/Bearer\s+[A-Za-z0-9\-._~+/]+=*/i.test(s) && s.length > 40) return true;
  return false;
}

module.exports = {
  OPS_SETTING_KEYS,
  ENV_ONLY_SECRET_KEYS,
  classifySettingKey,
  isForbiddenSettingKey,
  isOpsSettingKey,
  looksLikeSecretBlob
};
