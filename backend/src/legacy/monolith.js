/**
 * Legacy monolith：业务 handler / 中间件 / 建表逻辑暂存于此。
 * 路由注册已拆到 src/{auth,user,tax,...}/routes.js；入口见 server.js → src/bootstrap.js。
 * 阶段 1 约定：勿在 createTables/initDatabase 新增业务 ALTER，改走 backend/migrations/。
 * 函数均附带中文 JSDoc；对外入口见 getHandlers / getMiddleware。
 */
const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const geoip = require('geoip-lite');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const registerGuard = require('../../register-guard');
const serverMonitor = require('../../serverMonitor');
const dbLogRetention = require('../../dbLogRetention');
const unusedActivationCodes = require('../../unusedActivationCodes');
const opsStatsReport = require('../../opsStatsReport');
const alipay = require('../../alipay');
const { inferBankNameFromCardNo } = require('../../bank_card_bins');
const config = require('../shared/config');
const signedAssets = require('../shared/signedAssets');
const sharedDb = require('../shared/db');
const { runMigrations } = require('../shared/migrate');
const adminMenuRegistry = require('../admin/menuRegistry');
const adminDownline = require('../admin/downline');
const {
  adminUsernameKey,
  adminHasFullUserScope,
  fullUserScopeUsernameSqlIn
} = require('../admin/fullUserScope');
const settingsPolicy = require('../shared/settingsPolicy');
const { addDaysToYmd, analyticsPeriodDateKeys } = require('../shared/ymd');
const {
  consumeRateLimit,
  kvSet,
  kvSetNx,
  kvGet,
  kvDel,
  rateLimitBackendLabel
} = require('../shared/rateLimit');
const plainPasswordStore = require('../shared/plainPassword');
const mail = require('../../mail');
const {
  createInviteReward,
  isUserEffectivelyActive,
  isTrialExpired,
  activationFieldsForApi
} = require('./inviteReward');
const { createPricingAb, DEFAULT_PRICING_AB, applyChannelCatalogPrices } = require('./pricingAb');
const { createAgentChannels } = require('./agentChannels');
const { createUserPriceOffers } = require('../payments/userPriceOffers');
const { createPriceBids } = require('../payments/priceBids');
const purchasePriceSurvey = require('../growth/purchasePriceSurvey');
const { createUserEmailBulk, isValidUserEmail } = require('../admin/userEmailBulk');
const taxEditFeePolicy = require('../tax/taxEditFeePolicy');
const {
  sumRowMoney,
  splitBasicAndSpecialAdditionalDeduction,
  otherDeductionForDisplay,
  periodOtherDeductionForDetail
} = require('../tax/deductionSplit');
const { currentPeriodDeclaredTax } = require('../tax/withholdingCalc');
const renameFeePolicy = require('../user/renameFeePolicy');
const lizhiCertFeePolicy = require('../user/lizhiCertFeePolicy');
const najiluQrFeePolicy = require('../user/najiluQrFeePolicy');
const najiluQrMod = require('../admin/najiluQr');
const {
  computeUserLoginRisk,
  userLoginRiskMatchSql,
  userSameRegisterIpOfSql
} = require('../domain/userLoginRisk');

const JWT_SECRET = config.JWT_SECRET;
const JWT_EXPIRES = config.JWT_EXPIRES;
const ADMIN_ACTIVATION_KEY = config.ADMIN_ACTIVATION_KEY;
const ADMIN_PANEL_USER = config.ADMIN_PANEL_USER;
const ADMIN_PANEL_PASSWORD = config.ADMIN_PANEL_PASSWORD;
const ADMIN_PANEL_FULL_NAME = config.ADMIN_PANEL_FULL_NAME || '系统管理员';
const ADMIN_IP_DENYLIST = Array.isArray(config.ADMIN_IP_DENYLIST) ? config.ADMIN_IP_DENYLIST : [];

const DB_HOST = config.DB_HOST;
const DB_PORT = config.DB_PORT;
const DB_USER = config.DB_USER;
const DB_PASSWORD = config.DB_PASSWORD;
const DB_DATABASE = config.DB_DATABASE;
const PORT = config.PORT;
const UPLOAD_DIR = config.UPLOAD_DIR;
const PUBLIC_ASSET_BASE_URL = config.PUBLIC_ASSET_BASE_URL;
const UPLOAD_STORAGE_BACKEND = config.UPLOAD_STORAGE_BACKEND;
const LOGIN_RATE_PER_IP_MIN = config.LOGIN_RATE_PER_IP_MIN;
const LOGIN_RATE_PER_USER_MIN = config.LOGIN_RATE_PER_USER_MIN;
const ADMIN_LOGIN_RATE_PER_IP_MIN = config.ADMIN_LOGIN_RATE_PER_IP_MIN;
const ADMIN_API_RATE_PER_IP_MIN = config.ADMIN_API_RATE_PER_IP_MIN;
const HEAVY_ADMIN_API_RATE_PER_IP_MIN = config.HEAVY_ADMIN_API_RATE_PER_IP_MIN;
const GUEST_SESSION_RATE_PER_IP_MIN = config.GUEST_SESSION_RATE_PER_IP_MIN;
const TRACK_RATE_PER_IP_MIN = config.TRACK_RATE_PER_IP_MIN;
const ADMIN_LOGIN_MAX_FAILS = config.ADMIN_LOGIN_MAX_FAILS;
const ADMIN_LOGIN_LOCK_MINUTES = config.ADMIN_LOGIN_LOCK_MINUTES;
const ADMIN_LOGIN_EMAIL_OTP = config.ADMIN_LOGIN_EMAIL_OTP;
const ADMIN_OTP_EMAIL = config.ADMIN_OTP_EMAIL;
const ADMIN_OTP_TTL_SEC = config.ADMIN_OTP_TTL_SEC;
const ADMIN_UPLOAD_MAX_BYTES = config.ADMIN_UPLOAD_MAX_BYTES;

/** mine_ui JSON 中可配置的图片字段（相对路径、uploads/ 或 https） */
const MINE_UI_IMAGE_KEYS = [
  'header_male',
  'header_female',
  'icon_family',
  'icon_employer',
  'icon_bank',
  'nav_sy_1',
  'nav_sy_2',
  'nav_db_1',
  'nav_db_2',
  'nav_bc_1',
  'nav_bc_2',
  'nav_xx_1',
  'nav_xx_2',
  'nav_w_1',
  'nav_w_2',
  'shouye_banner',
  'shouye_zdfwdb',
  'shouye_lb',
  'shouye_zdb',
  'daiban_header',
  'bancha_header',
  'message_header',
  'piaojia_goumai',
  'piaojia_xiaoshou'
];
/** 安装页效果预览（不受「默认配图」开关影响） */
const INSTALL_SHOWCASE_IMAGE_KEYS = [
  'install_showcase_gif',
  'install_showcase_img_1',
  'install_showcase_img_2',
  'install_showcase_img_3'
];
/** mine_ui JSON 中可配置的视频字段（相对路径、uploads/ 或 https） */
const MINE_UI_VIDEO_KEYS = ['install_ios_video', 'install_usage_video'];

/** 0=普通账号 1=测试账号 */
const USER_TYPE_NORMAL = 0;
const USER_TYPE_TEST = 1;
const USER_TYPE_GUEST = 2;
const GUEST_USERNAME_PREFIX = '__guest_';

/** 注册来源渠道（C 端下拉 value → 展示名） */
const REGISTER_SOURCE_CHANNELS = {
  douyin: '抖音',
  bilibili: 'B站',
  tieba: '百度贴吧',
  zhihu: '知乎',
  friend: '朋友介绍',
  github: 'GitHub',
  other: '其他',
  xianyu: '闲鱼',
  kufaka: '酷发卡'
};

/** 批量激活码内置渠道（key → 展示名）；备注格式为「{展示名}批量」 */
const ACTIVATION_BATCH_BUILTIN_CHANNELS = {
  xianyu: '闲鱼',
  kufaka: '酷发卡',
  alipay: '支付宝'
};

const SETTING_KEY_ACTIVATION_BATCH_CHANNELS = 'activation_batch_channels_json';

/** 是否：xianyu activation note */
function isXianyuActivationNote(note) {
  return String(note || '').indexOf('闲鱼') >= 0;
}

/** 是否：batch activation note */
function isBatchActivationNote(note) {
  var n = String(note || '').trim();
  if (!n) return false;
  if (/批量$/.test(n)) return true;
  return isXianyuActivationNote(n);
}

/** 清洗激活批次渠道展示名 */
function sanitizeActivationBatchChannelLabel(raw) {
  var s = String(raw != null ? raw : '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/批量$/g, '');
  if (!s) return '';
  if (s.length > 32) s = s.slice(0, 32);
  return s;
}

/** activation channel label from note */
function activationChannelLabelFromNote(note) {
  var n = String(note || '').trim();
  if (!n) return '';
  if (/批量$/.test(n)) {
    var fromSuffix = sanitizeActivationBatchChannelLabel(n.replace(/批量$/, ''));
    if (fromSuffix) return fromSuffix;
  }
  var keys = Object.keys(ACTIVATION_BATCH_BUILTIN_CHANNELS);
  for (var i = 0; i < keys.length; i++) {
    var label = ACTIVATION_BATCH_BUILTIN_CHANNELS[keys[i]];
    if (n.indexOf(label) >= 0) return label;
  }
  return '';
}

/** activation source key from label */
function activationSourceKeyFromLabel(label) {
  var lab = sanitizeActivationBatchChannelLabel(label);
  if (!lab) return '';
  var keys = Object.keys(ACTIVATION_BATCH_BUILTIN_CHANNELS);
  for (var i = 0; i < keys.length; i++) {
    if (ACTIVATION_BATCH_BUILTIN_CHANNELS[keys[i]] === lab || keys[i] === lab) {
      return keys[i];
    }
  }
  return lab;
}

/** 从激活码备注解析激活来源 */
function activationSourceFromCodeNote(note) {
  var label = activationChannelLabelFromNote(note);
  if (!label) return '';
  return activationSourceKeyFromLabel(label);
}

/** 激活来源渠道展示文案 */
function activationSourceChannelLabel(channel) {
  var c = channel != null ? String(channel).trim() : '';
  if (!c) {
    return '';
  }
  if (REGISTER_SOURCE_CHANNELS[c]) {
    return REGISTER_SOURCE_CHANNELS[c];
  }
  if (ACTIVATION_BATCH_BUILTIN_CHANNELS[c]) {
    return ACTIVATION_BATCH_BUILTIN_CHANNELS[c];
  }
  return c;
}

/** 解析激活批次自定义渠道 JSON */
function parseActivationBatchCustomChannels(raw) {
  var list = [];
  var seen = Object.create(null);
  function push(lab) {
    var s = sanitizeActivationBatchChannelLabel(lab);
    if (!s || seen[s]) return;
    var builtins = Object.keys(ACTIVATION_BATCH_BUILTIN_CHANNELS);
    for (var i = 0; i < builtins.length; i++) {
      if (ACTIVATION_BATCH_BUILTIN_CHANNELS[builtins[i]] === s || builtins[i] === s) {
        return;
      }
    }
    seen[s] = 1;
    list.push(s);
  }
  if (Array.isArray(raw)) {
    raw.forEach(push);
  } else if (raw != null && String(raw).trim()) {
    try {
      var parsed = JSON.parse(String(raw));
      if (Array.isArray(parsed)) {
        parsed.forEach(push);
      } else {
        String(raw)
          .split(/[\n,，;；]+/)
          .forEach(push);
      }
    } catch (e) {
      String(raw)
        .split(/[\n,，;；]+/)
        .forEach(push);
    }
  }
  return list.slice(0, 40);
}

/** 加载激活批次自定义渠道 */
async function loadActivationBatchCustomChannels(conn) {
  var ownConn = !conn;
  var c = conn;
  try {
    if (ownConn) c = await pool.getConnection();
    const [rows] = await c.execute(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [SETTING_KEY_ACTIVATION_BATCH_CHANNELS]
    );
    if (!rows.length) return [];
    return parseActivationBatchCustomChannels(rows[0].setting_value);
  } catch (e) {
    return [];
  } finally {
    if (ownConn && c) c.release();
  }
}

/** 组装激活批次渠道配置响应 */
function buildActivationBatchChannelsPayload(customLabels) {
  var builtins = Object.keys(ACTIVATION_BATCH_BUILTIN_CHANNELS).map(function (k) {
    return { key: k, label: ACTIVATION_BATCH_BUILTIN_CHANNELS[k], builtin: true };
  });
  var customs = (customLabels || []).map(function (lab) {
    return { key: lab, label: lab, builtin: false };
  });
  return builtins.concat(customs);
}

/** 用户辅助：渠道分析标签（注册 / 激活来源） */
function userChannelAnalysisLabel(registerChannel, activationChannel) {
  var reg = registerSourceChannelLabel(registerChannel);
  var act = activationSourceChannelLabel(activationChannel);
  var parts = [];
  if (act && reg && reg !== act) {
    parts.push('注册：' + reg);
    parts.push('激活：' + act);
  } else if (act) {
    parts.push(act);
  } else if (reg) {
    parts.push(reg);
  }
  return parts.length ? parts.join('；') : '—';
}

const REGISTER_SOURCE_OTHER_MAX = 64;

/** 规范化注册来源渠道入参 */
function normalizeRegisterSourceChannelInput(channel, otherText) {
  var c = channel != null ? String(channel).trim() : '';
  if (!c) {
    return { err: '请选择来源渠道' };
  }
  if (c === 'other') {
    var custom = otherText != null ? String(otherText).trim() : '';
    if (!custom) {
      return { err: '请填写其他来源渠道' };
    }
    if (custom.length > REGISTER_SOURCE_OTHER_MAX) {
      return { err: '其他渠道名称不能超过' + REGISTER_SOURCE_OTHER_MAX + '字' };
    }
    return { value: 'other:' + custom };
  }
  if (!REGISTER_SOURCE_CHANNELS[c]) {
    return { err: '来源渠道无效' };
  }
  return { value: c };
}

/** 校验注册来源渠道是否合法（必填） */
function validateRegisterSourceChannel(channel) {
  var c = channel != null ? String(channel).trim() : '';
  if (!c) {
    return '请选择来源渠道';
  }
  if (c.indexOf('other:') === 0) {
    var custom = c.slice(6).trim();
    if (!custom) {
      return '请填写其他来源渠道';
    }
    if (custom.length > REGISTER_SOURCE_OTHER_MAX) {
      return '其他渠道名称不能超过' + REGISTER_SOURCE_OTHER_MAX + '字';
    }
    return null;
  }
  if (!REGISTER_SOURCE_CHANNELS[c]) {
    return '来源渠道无效';
  }
  return null;
}

/** 注册来源渠道展示文案 */
function registerSourceChannelLabel(channel) {
  var c = channel != null ? String(channel).trim() : '';
  if (!c) {
    return '—';
  }
  if (c === 'landing_c_guest') {
    return '落地页C·游客';
  }
  if (c.indexOf('other:') === 0) {
    var custom = c.slice(6).trim();
    return custom ? '其他：' + custom : REGISTER_SOURCE_CHANNELS.other;
  }
  return REGISTER_SOURCE_CHANNELS[c] || c;
}
/** 历史注册默认税号；对外展示为 DEFAULT_TAX_ID_HINT */
const LEGACY_DEFAULT_TAX_ID = '620000000000000000';
const DEFAULT_TAX_ID_HINT = '所有信息点击我要咨询修改';
const LEGACY_TAX_ID_HINT = '注册默认： 所有信息点击我要咨询修改';

/** 规范化对外返回的税务记录 id */
function normalizeTaxIdForApi(taxId) {
  var s = taxId == null ? '' : String(taxId).trim();
  if (!s || s === LEGACY_DEFAULT_TAX_ID || s === LEGACY_TAX_ID_HINT) return DEFAULT_TAX_ID_HINT;
  return s;
}

/** 判断是否为占位税务记录 id */
function isPlaceholderTaxId(taxId) {
  var s = taxId == null ? '' : String(taxId).trim();
  return (
    !s ||
    s === LEGACY_DEFAULT_TAX_ID ||
    s === DEFAULT_TAX_ID_HINT ||
    s === LEGACY_TAX_ID_HINT ||
    s === '所有信息点击税务演示数据修改' ||
    s === '所***************改'
  );
}

/** 格式化：user id card for admin */
function formatUserIdCardForAdmin(taxId) {
  var s = taxId == null ? '' : String(taxId).trim();
  return isPlaceholderTaxId(s) ? '' : s;
}

/** 管理端展示用的用户证件号文案 */
function userIdCardLabelForAdmin(taxId) {
  var s = formatUserIdCardForAdmin(taxId);
  return s || '未填写';
}
/** 环境变量或内置默认；首次写入 app_settings 及库中无配置时使用 */
const TEST_ACCOUNT_COMPANY_NAME_DEFAULT = process.env.TEST_ACCOUNT_COMPANY_NAME || '';
const SETTING_KEY_TEST_COMPANY = 'test_account_company_name';
const SETTING_KEY_MINE_UI = 'mine_ui_json';
const SETTING_KEY_ANDROID_APK = 'android_apk_download_url';
const SETTING_KEY_AGENT_ANDROID_APK = 'agent_android_apk_download_url';
const SETTING_KEY_IOS_MOBILECONFIG = 'ios_mobileconfig_download_url';
/** 闲鱼购买等外链，与引导安装一同在后台配置 */
const SETTING_KEY_XIANYU_PURCHASE = 'xianyu_purchase_url';
const SETTING_KEY_XIANYU_HIDE_CHANNELS = 'xianyu_hide_sales_channels';
/** 个人中心顶栏「添加QQ号」外链 */
const SETTING_KEY_QQ_ADD_URL = 'qq_add_url';
const SETTING_KEY_QQ_GROUP_URL = 'qq_group_url';
const SETTING_KEY_WECHAT_PAY_QRCODE = 'wechat_pay_qrcode_url';
const SETTING_KEY_CONVERSION_AB = 'conversion_ab_json';
const SETTING_KEY_LANDING_AB = 'landing_ab_json';
/** C 方案购买页：专属销售代理联系方式（JSON） */
const SETTING_KEY_SALES_AGENT = 'sales_agent_json';
const SETTING_KEY_PRICING_AB = 'pricing_ab_json';
const SETTING_KEY_ACTIVATION_NUDGE = 'activation_nudge_json';
const DEFAULT_CONVERSION_AB = {
  enabled: true,
  activate_title_a: '请输入激活码',
  activate_subtitle_a: '激活后去除水印',
  activate_title_b: '输入激活码，解锁完整功能',
  activate_subtitle_b: '开通后去除水印，按时长使用',
  batch_example_prominent: false
};

const DEFAULT_LANDING_AB = {
  enabled: true,
  c_percent: 50
};

/** 落地页 C 方案：购买页人工销售联系方式 */
const DEFAULT_SALES_AGENT = {
  display_name: '专属客服',
  wechat_id: '',
  wechat_qr_url: '',
  qq: '',
  phone: '',
  xianyu_text: ''
};

/** 未激活用户每日激活引导弹窗（C 端） */
const DEFAULT_ACTIVATION_NUDGE = {
  enabled: true,
  title: '开通完整功能',
  body: '您的账号尚未激活。激活后可去除水印，完整使用收入明细与纳税记录等功能。',
  cta_text: '去激活',
  dismiss_text: '今日不再提示',
  link_url: 'purchase.html',
  min_hours_since_register: 24,
  max_per_day: 1
};

/** 站内信运营群发标记（写入 messages.company_name） */
const MSG_COMPANY_SYSTEM_NOTICE = '系统通知';
const MSG_BULK_MAX_USERS = 5000;
const MSG_BULK_INSERT_CHUNK = 80;
/** 自动站内信：注册超 24h 未激活推广（正文标记，用于去重） */
const MSG_AUTO_ACT24_MARKER = '@@auto_act24';
const MSG_AUTO_ACT24_TITLE = '开通提醒：激活后去除水印';
const MSG_AUTO_ACT24_BODY =
  '您好，检测到您的账号尚未激活。激活后可去除水印，完整使用收入纳税明细与纳税记录等功能。点击下方「前往激活」即可开通。';
/** 自动站内信：填税后未激活推广 */
const MSG_AUTO_TAX_DONE_MARKER = '@@auto_tax_done';
const MSG_AUTO_TAX_DONE_TITLE = '税务记录已生成，开通后可完整查看与导出';
const MSG_AUTO_TAX_DONE_BODY =
  '您已成功生成税务记录。开通后可去除水印，完整查看明细并导出纳税证明。';
/** 自动站内信：支付页退出后未开通 */
const MSG_AUTO_PURCHASE_EXIT_MARKER = '@@auto_purchase_exit';
const MSG_AUTO_PURCHASE_EXIT_TITLE = '开通方案仍在等您';
const MSG_AUTO_PURCHASE_EXIT_BODY =
  '刚才您查看过开通页面。分享 B 站动态可享优惠，开通后即可完整使用导出等功能。';
/** 核心推广：未激活用户二次退税广告（站内信去重标记） */
const MSG_AUTO_REFUND_AD_MARKER = '@@auto_refund_ad';
const MSG_AUTO_REFUND_AD_TITLE = '二次退税：可一键计算近三年可退金额';
const MSG_AUTO_REFUND_AD_BODY =
  '您好，未开通也可先看二次退税。打开页面可一键计算 2023、2024、2025 年大约可退税额，符合请联系客服办理。不强制添加。';
/** 后台群发受众 */
const BULK_MSG_AUDIENCE_SET = {
  pending_activate_24h: true,
  all_inactive: true,
  inactive_has_tax: true,
  inactive_no_tax: true,
  inactive_visited_purchase: true,
  inactive_purchase_no_pay: true,
  inactive_has_d1: true,
  inactive_d1_only: true,
  inactive_high_income: true,
  refund_eligible: true,
  refund_eligible_copied: true,
  refund_eligible_not_copied: true
};
/** 自己填写的月收入（本期收入/收入）超过该值视为高收入跟进 */
const HIGH_SELF_INCOME_THRESHOLD = 15000;

/** 单条个税记录的月收入：优先本期收入，否则收入 */
function taxRecordMonthIncomeSql(alias) {
  var t = alias || 'tr';
  return 'GREATEST(IFNULL(' + t + '.income_this_period, 0), IFNULL(' + t + '.income, 0))';
}

/**
 * 用户自己填写过月收入大于 threshold 的有效个税（排除公司名含「示例」）
 * userCol 为 username 列，如 users.username / u.username
 */
function userHasSelfFilledHighIncomeSql(userCol, threshold) {
  var n = Number(threshold);
  if (!isFinite(n) || n < 0) n = HIGH_SELF_INCOME_THRESHOLD;
  return (
    'EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = ' +
    (userCol || 'users.username') +
    " AND tr.deleted_at IS NULL AND IFNULL(tr.company_name,'') NOT LIKE '%示例%' AND " +
    taxRecordMonthIncomeSql('tr') +
    ' > ' +
    n +
    ')'
  );
}
/** 开通类自动站内信（填税后 / 离开支付页 / 注册超24h）默认关闭；设 ACTIVATION_INBOX_PROMO_ENABLED=1 可再开启 */
const ACTIVATION_INBOX_PROMO_ENABLED =
  String(process.env.ACTIVATION_INBOX_PROMO_ENABLED || '0').trim() === '1';
const ACTIVATION_INBOX_PROMO_INTERVAL_MS = parseInt(
  process.env.ACTIVATION_INBOX_PROMO_INTERVAL_MS || String(6 * 60 * 60 * 1000),
  10
);
/** 核心推广：未激活用户站内信 + 已留邮箱发二次退税邮件。设 REFUND_AD_PROMO_ENABLED=0 可关 */
const REFUND_AD_PROMO_ENABLED =
  String(process.env.REFUND_AD_PROMO_ENABLED != null ? process.env.REFUND_AD_PROMO_ENABLED : '1').trim() !==
  '0';
const REFUND_AD_PROMO_INTERVAL_MS = parseInt(
  process.env.REFUND_AD_PROMO_INTERVAL_MS || String(6 * 60 * 60 * 1000),
  10
);
/** 退税金额邮件：同一用户 24 小时最多一封 */
const REFUND_AD_EMAIL_SKIP_HOURS = Math.max(
  1,
  parseInt(process.env.REFUND_AD_EMAIL_SKIP_HOURS || '24', 10) || 24
);

/** 正式菜单键：单一来源见 src/admin/menuRegistry.js */
const ADMIN_MENU_KEYS = adminMenuRegistry.ADMIN_MENU_KEYS;

/**
 * 运营子账号：注册用户页可看「从此刻起」新注册用户（UTC）。
 * 默认给 username=admin；额外账号见 ADMIN_OPS_EXTRA_SEE_SINCE。
 * 可用环境变量 ADMIN_OPS_SEE_REGISTERED_SINCE 覆盖 admin 截止日，格式 YYYY-MM-DD HH:MM:SS（UTC）。
 */
const ADMIN_OPS_SEE_REGISTERED_SINCE = String(
  process.env.ADMIN_OPS_SEE_REGISTERED_SINCE || '2026-07-23 15:10:00'
).trim();

/** 额外运营子账号 → 新注册可见起始时间（UTC） */
const ADMIN_OPS_EXTRA_SEE_SINCE = {};

function isOpsNamedAdmin(admin) {
  var u = adminUsernameKey(admin);
  if (!u) return false;
  if (u === 'admin') return true;
  return Object.prototype.hasOwnProperty.call(ADMIN_OPS_EXTRA_SEE_SINCE, u);
}

function adminOpsSeeRegisteredSinceUtc(admin) {
  var u = String((admin && admin.username) || '')
    .trim()
    .toLowerCase();
  if (u && ADMIN_OPS_EXTRA_SEE_SINCE[u]) {
    return String(ADMIN_OPS_EXTRA_SEE_SINCE[u]).trim();
  }
  return ADMIN_OPS_SEE_REGISTERED_SINCE || '2026-07-23 15:10:00';
}

/** 个人中心默认外观（管理后台可覆盖） */
const DEFAULT_MINE_UI = {
  theme: 'blue',
  header_male: 'grdb.jpg',
  header_female: 'nx.jpg',
  icon_family: 'jtcy.jpg',
  icon_employer: 'rzsp.jpg',
  icon_bank: 'yhk.jpg'
};

let pool;
/** 时效激活 API（pool 就绪后懒初始化） */
var inviteRewardApi = null;
/** 定价 A/B */
var pricingAbApi = null;
/** 用户专属报价 */
var userPriceOffersApi = null;
/** 运营邮件群发 */
var userEmailBulkApi = null;
/** 代理专属渠道 */
var agentChannelsApi = null;

function getUserPriceOffers() {
  if (!userPriceOffersApi) {
    if (!pool) {
      throw new Error('database pool not ready');
    }
    userPriceOffersApi = createUserPriceOffers({
      pool: pool,
      normalizeAmount: function (v) {
        return alipay.normalizeAmount(v);
      },
      /* 原价与套餐列表统一走 pricingAb 的后台可配目录价，避免两份 LIVE SKU 漂移 */
      loadCatalogAmounts: function () {
        return getPricingAb().loadCatalogAmounts();
      },
      loadCatalogConfig: function () {
        return getPricingAb().loadCatalogConfig();
      }
    });
  }
  return userPriceOffersApi;
}

/** 心理价出价 */
var priceBidsApi = null;

function getPriceBids() {
  if (!priceBidsApi) {
    if (!pool) {
      throw new Error('database pool not ready');
    }
    priceBidsApi = createPriceBids({
      pool: pool,
      normalizeAmount: function (v) {
        return alipay.normalizeAmount(v);
      },
      offers: getUserPriceOffers(),
      /* 与支付页一致的货架（含渠道专属档现价），避免年卡出价误用周卡价 */
      listPurchaseSkusForUser: async function (username) {
        var envProduct = getAlipayProductConfig();
        var offer = await getPricingAb().resolveOfferForUser(
          username || '',
          envProduct.amount,
          envProduct.subject,
          null
        );
        offer = await applyAgentChannelPricesToOffer(offer, username || '', null);
        try {
          if (username) {
            var applied = await getUserPriceOffers().applyOfferToPricingOffer(username, offer);
            offer = (applied && applied.offer) || offer;
          }
        } catch (eOffer) {
          /* 专属价失败时仍用渠道货架 */
        }
        return Array.isArray(offer && offer.skus) ? offer.skus : [];
      },
      notifyUser: async function (username, title, body, linkUrl) {
        var uid = String(username || '').trim();
        if (!uid) return { email_sent: false, reason: 'no_user' };
        var content = String(body || '') + '\n@@link:' + sanitizeInAppMessageLink(linkUrl);
        var mid = 'msg_bid_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        await pool.execute(
          'INSERT INTO messages (id, user_id, title, content, company_name, msg_date, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)',
          [mid, uid, String(title || '通知'), content, MSG_COMPANY_SYSTEM_NOTICE, new Date().toISOString().slice(0, 10)]
        );
        invalidateMessageListCache(uid);
        try {
          var mailOut = await getUserEmailBulk().notifyUserEmail(uid, title, body, linkUrl);
          return {
            email_sent: !!(mailOut && mailOut.sent),
            reason: (mailOut && mailOut.reason) || (mailOut && mailOut.sent ? '' : 'send_failed')
          };
        } catch (eMail) {
          console.error('[price-bid] notify email failed', uid, eMail && eMail.message);
          return { email_sent: false, reason: 'send_error' };
        }
      },
      onBidRecorded: function (username, amount) {
        return purchasePriceSurvey.attachExpectedPriceFromBid(username, amount);
      }
    });
  }
  return priceBidsApi;
}

function getUserEmailBulk() {
  if (!userEmailBulkApi) {
    if (!pool) {
      throw new Error('database pool not ready');
    }
    userEmailBulkApi = createUserEmailBulk({
      getPool: function () {
        return pool;
      },
      mail: mail,
      publicSiteUrl: config.PUBLIC_SITE_URL,
      bulkAudienceSet: BULK_MSG_AUDIENCE_SET,
      appendBulkMsgAudienceFilters: appendBulkMsgAudienceFilters,
      appendAdminUserScope: appendAdminUserScope,
      nonGuestUsernameSql: nonGuestUsernameSql
    });
  }
  return userEmailBulkApi;
}

function getInviteReward() {
  if (!inviteRewardApi) {
    if (!pool) {
      throw new Error('database pool not ready');
    }
    inviteRewardApi = createInviteReward({
      pool: pool,
      upsertAppSetting: upsertAppSetting,
      invalidateUserAuthCache: invalidateUserAuthCache,
      invalidateUserInfoApiCache: invalidateUserInfoApiCache,
      randomActivationCodePlain: randomActivationCodePlain,
      ADMIN_PANEL_USER: ADMIN_PANEL_USER
    });
  }
  return inviteRewardApi;
}

function getAgentChannels() {
  if (!agentChannelsApi) {
    if (!pool) {
      throw new Error('database pool not ready');
    }
    agentChannelsApi = createAgentChannels({
      getPool: function () {
        return pool;
      },
      sanitizeSalesChannelId: sanitizeSalesChannelId
    });
  }
  return agentChannelsApi;
}

function getPricingAb() {
  if (!pricingAbApi) {
    if (!pool) {
      throw new Error('database pool not ready');
    }
    pricingAbApi = createPricingAb({
      pool: pool,
      upsertAppSetting: upsertAppSetting,
      alipayNormalizeAmount: function (v) {
        return alipay.normalizeAmount(v);
      },
      getForcedAbcForUser: async function () {
        return 'b';
      }
    });
  }
  return pricingAbApi;
}

function isUserPermanentActive(row) {
  if (!row) return false;
  var kind = row.activation_kind != null ? String(row.activation_kind).trim() : '';
  if (kind === 'permanent') return true;
  if (kind === 'trial') return false;
  return (
    row.account_active === 1 ||
    row.account_active === true ||
    Number(row.account_active) === 1
  );
}
/** @type {{ v: string, t: number }|null} */
var _testCompanyNameCache = null;
var TEST_COMPANY_CACHE_MS = 3000;

/** 使用盐值对密码做哈希 */
function hashPasswordWithSalt(password, saltBuf) {
  return crypto.scryptSync(password, saltBuf, 64).toString('hex');
}

/** 使用盐值哈希校验密码 */
function verifyPasswordBySaltHash(password, saltHex, hashHex) {
  if (!saltHex || !hashHex) {
    return false;
  }
  try {
    var saltBuf = Buffer.from(String(saltHex), 'hex');
    var actual = hashPasswordWithSalt(password, saltBuf);
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(String(hashHex), 'hex'));
  } catch (e) {
    return false;
  }
}

/** 规范化管理菜单权限列表 */
function normalizeAdminMenuList(rawMenus, isSuper) {
  if (isSuper) {
    return ADMIN_MENU_KEYS.slice();
  }
  var src = Array.isArray(rawMenus) ? rawMenus : [];
  var seen = {};
  var out = [];
  src.forEach(function (m) {
    var key = String(m || '').trim();
    if (!key || ADMIN_MENU_KEYS.indexOf(key) < 0 || seen[key]) {
      return;
    }
    seen[key] = true;
    out.push(key);
  });
  return out;
}

var _wechatPayQrcodeCache = null;
var WECHAT_PAY_QRCODE_CACHE_MS = 15000;
var _installPackageSettingsCache = null;
var INSTALL_PACKAGE_SETTINGS_CACHE_MS = 30000;
var _installPackagesResponseCache = new Map();
/** 签名 URL 会过期，响应缓存不宜过长 */
var INSTALL_PACKAGES_RESPONSE_CACHE_MS = 45000;
var _salesPromoChannelCache = new Map();
var SALES_PROMO_CHANNEL_CACHE_MS = 30000;
var _taxRecordsListCache = new Map();
var TAX_RECORDS_LIST_CACHE_MS = 30000;
var _userInfoApiCache = new Map();
var USER_INFO_API_CACHE_MS = 30000;
var _userSummaryApiCache = new Map();
var USER_SUMMARY_API_CACHE_MS = 30000;
var _employersApiCache = new Map();
var EMPLOYERS_API_CACHE_MS = 30000;
var _messageListCache = new Map();
var MESSAGE_LIST_CACHE_MS = 10000;
var _taxBatchLocks = new Map();
var TAX_BATCH_MAX_RECORDS = 150;
var TAX_BULK_INSERT_CHUNK = 80;

/** 获取微信支付二维码 URL */
async function getWechatPayQrcodeUrl() {
  var now = Date.now();
  if (_wechatPayQrcodeCache && now - _wechatPayQrcodeCache.t < WECHAT_PAY_QRCODE_CACHE_MS) {
    return _wechatPayQrcodeCache.v;
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [SETTING_KEY_WECHAT_PAY_QRCODE]
    );
    var v = '';
    if (rows.length > 0 && rows[0].setting_value != null) {
      var s = sanitizeMineUiImageRef(String(rows[0].setting_value).trim());
      if (s) v = s;
    }
    _wechatPayQrcodeCache = { v: v, t: now };
    return v;
  } finally {
    conn.release();
  }
}

/** 清除微信支付二维码缓存 */
function invalidateWechatPayQrcodeCache() {
  _wechatPayQrcodeCache = null;
}

/** 清除安装包设置缓存 */
function invalidateInstallPackageSettingsCache() {
  _installPackageSettingsCache = null;
  invalidateInstallPackagesResponseCache();
}

/** 解析：public asset url */
function resolvePublicAssetUrl(ref) {
  var ok = sanitizeMineUiImageRef(ref);
  if (!ok) return '';
  if (/^https?:\/\//i.test(ok)) return ok;
  if (ok.charAt(0) === '/') {
    if (PUBLIC_ASSET_BASE_URL) return PUBLIC_ASSET_BASE_URL + ok;
    return ok;
  }
  var pathRef = '/' + ok.replace(/^\/+/, '');
  if (PUBLIC_ASSET_BASE_URL) return PUBLIC_ASSET_BASE_URL + pathRef;
  return pathRef;
}

/**
 * 写入 app_settings（阶段 4：拒绝密钥类键）
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string} key
 * @param {string} value
 */
async function upsertAppSetting(conn, key, value) {
  var classified = settingsPolicy.classifySettingKey(key);
  if (classified.forbidden) {
    var err = new Error('禁止将密钥类配置写入 app_settings（' + classified.reason + '）：' + key);
    err.statusCode = 400;
    throw err;
  }
  await conn.execute(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
    [String(key), value == null ? '' : String(value)]
  );
}

/** 获取测试账号公司名 */
async function getTestAccountCompanyName() {
  var now = Date.now();
  if (_testCompanyNameCache && now - _testCompanyNameCache.t < TEST_COMPANY_CACHE_MS) {
    return _testCompanyNameCache.v;
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [SETTING_KEY_TEST_COMPANY]
    );
    var v = TEST_ACCOUNT_COMPANY_NAME_DEFAULT;
    if (rows.length > 0 && rows[0].setting_value != null) {
      var s = String(rows[0].setting_value).trim();
      if (s !== '') v = s;
    }
    _testCompanyNameCache = { v: v, t: now };
    return v;
  } finally {
    conn.release();
  }
}

/** 深拷贝「我的」页 UI 默认配置 */
function cloneMineUiDefaults() {
  return {
    theme: DEFAULT_MINE_UI.theme,
    header_male: DEFAULT_MINE_UI.header_male,
    header_female: DEFAULT_MINE_UI.header_female,
    icon_family: DEFAULT_MINE_UI.icon_family,
    icon_employer: DEFAULT_MINE_UI.icon_employer,
    icon_bank: DEFAULT_MINE_UI.icon_bank,
    nav_sy_1: 'caidan/sy1.png',
    nav_sy_2: 'caidan/sy2.png',
    nav_db_1: 'caidan/db1.png',
    nav_db_2: 'caidan/db2.png',
    nav_bc_1: 'caidan/bc1.png',
    nav_bc_2: 'caidan/bc2.png',
    nav_xx_1: 'caidan/xx1.png',
    nav_xx_2: 'caidan/xx2.png',
    nav_w_1: 'caidan/w1.png',
    nav_w_2: 'caidan/w2.png',
    shouye_banner: 'sydb-v2.jpg',
    shouye_zdfwdb: 'zdfwdb.jpg',
    shouye_lb: 'lb.jpg',
    shouye_zdb: 'zdb.jpg',
    daiban_header: 'daiban.jpg',
    bancha_header: 'db.jpg',
    message_header: '',
    piaojia_goumai: 'piaojia-goumai.png',
    piaojia_xiaoshou: 'piaojia-xiaoshou.png',
    install_ios_video: '',
    install_usage_video: '',
    install_showcase_gif: '',
    install_showcase_img_1: '',
    install_showcase_img_2: '',
    install_showcase_img_3: ''
  };
}

/** 允许站内相对路径或 https/http 图片地址，禁止 .. 与脚本伪协议 */
/** sanitize install download url */
function sanitizeInstallDownloadUrl(raw) {
  if (raw == null) {
    return '';
  }
  var s = String(raw).trim();
  if (s === '') {
    return '';
  }
  if (s.length > 2048 || /[\s<>"'`]/.test(s)) {
    return '';
  }
  if (/^https?:\/\//i.test(s)) {
    try {
      var u = new URL(s);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return '';
      }
      return s;
    } catch (e) {
      return '';
    }
  }
  if (s.charAt(0) === '/' && s.indexOf('//') !== 0) {
    if (/^\/[a-zA-Z0-9_.\-\/%]+$/.test(s)) {
      return s;
    }
    return '';
  }
  // 与上传接口一致：仅允许 uploads/ 下的相对路径（禁止 ..）
  if (s.indexOf('..') >= 0) {
    return '';
  }
  if (/^uploads\/[a-zA-Z0-9_.\-\/%]+$/.test(s)) {
    return s;
  }
  return '';
}

/** 本站受信 Host：环境变量 + PUBLIC_SITE_URL 推导 + 常见本地 */
function isTrustedPublicHost(hostname) {
  var host = String(hostname || '').toLowerCase();
  if (!host) {
    return false;
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return true;
  }
  var list = Array.isArray(config.SITE_TRUSTED_HOSTS) ? config.SITE_TRUSTED_HOSTS : [];
  var i;
  for (i = 0; i < list.length; i++) {
    if (list[i] === host) {
      return true;
    }
  }
  try {
    var origin = String(config.PUBLIC_SITE_URL || '').replace(/\/+$/, '');
    if (origin) {
      var ou = new URL(origin);
      var oh = String(ou.hostname || '').toLowerCase();
      if (host === oh || host === 'www.' + oh || 'www.' + host === oh) {
        return true;
      }
    }
  } catch (eTrust) {}
  return false;
}

/** to public install download url */
function toPublicInstallDownloadUrl(raw) {
  var s = sanitizeInstallDownloadUrl(raw);
  if (!s) {
    return '';
  }
  try {
    if (/^https?:\/\//i.test(s)) {
      var u = new URL(s);
      var host = String(u.hostname || '').toLowerCase();
      if (isTrustedPublicHost(host)) {
        s = u.pathname + (u.search || '');
      } else {
        return s;
      }
    }
  } catch (e0) {}
  if (/^uploads\//i.test(s)) {
    s = '/' + s;
  }
  // 本站 uploads 下的 APK / mobileconfig：短时签名，禁止直链热链
  if (signedAssets.isSensitiveUploadPath(s)) {
    return signedAssets.toSignedPublicAssetUrl(s, config);
  }
  // 绕过 Cloudflare 对旧 APK 响应头的缓存（缺 Content-Disposition 时易整页打开失败）
  if (/\.apk$/i.test(s.split('?')[0]) && s.indexOf('?') < 0) {
    s += '?v=20260717';
  }
  return s;
}

/** 签名下载敏感安装包（APK / mobileconfig） */
var handlePublicAssetGet = signedAssets.createPublicAssetHandler({
  config: config,
  uploadDir: UPLOAD_DIR
});

/** sanitize xianyu purchase text */
function sanitizeXianyuPurchaseText(raw) {
  if (raw == null) {
    return '';
  }
  var s = String(raw).trim();
  if (s === '') {
    return '';
  }
  if (s.length > 2048) {
    s = s.slice(0, 2048);
  }
  return s;
}

/** 清洗销售渠道 id */
function sanitizeSalesChannelId(raw) {
  var s = String(raw || '').trim().toLowerCase();
  if (!s || s.length > 64) {
    return '';
  }
  if (!/^[a-z0-9_-]+$/.test(s)) {
    return '';
  }
  return s;
}

/**
 * 从 query / body / X-Sales-Channel / UA TaxPlatformDistributor 读取渠道。
 * 优先级：显式参数 > 请求头 > UA 分发标记。
 */
function readSalesChannelFromRequest(req, body) {
  var q = (req && req.query) || {};
  var b = body && typeof body === 'object' ? body : {};
  var fromParam = sanitizeSalesChannelId(
    q.sales_ch || q.ch || q.channel || b.sales_ch || b.ch || b.channel || ''
  );
  if (fromParam) return fromParam;
  var h = (req && req.headers) || {};
  var fromHeader = sanitizeSalesChannelId(
    h['x-sales-channel'] || h['X-Sales-Channel'] || ''
  );
  if (fromHeader) return fromHeader;
  var ua = String(h['user-agent'] || h['User-Agent'] || '');
  var m = ua.match(/TaxPlatformDistributor\/([a-zA-Z0-9_-]{1,64})/);
  if (m) return sanitizeSalesChannelId(m[1]);
  return '';
}

/** 解析需隐藏闲鱼入口的销售渠道列表 */
function parseXianyuHideSalesChannels(raw) {
  if (raw == null) {
    return [];
  }
  var s = String(raw).trim();
  if (!s) {
    return [];
  }
  try {
    if (s.charAt(0) === '[') {
      var arr = JSON.parse(s);
      if (Array.isArray(arr)) {
        var out = [];
        arr.forEach(function (item) {
          var id = sanitizeSalesChannelId(item);
          if (id && out.indexOf(id) < 0) {
            out.push(id);
          }
        });
        return out;
      }
    }
  } catch (e) {}
  var list = [];
  s.split(/[\n,;]+/).forEach(function (part) {
    var id = sanitizeSalesChannelId(part);
    if (id && list.indexOf(id) < 0) {
      list.push(id);
    }
  });
  return list;
}

/** 序列化闲鱼隐藏渠道配置 */
function serializeXianyuHideSalesChannels(list) {
  var out = [];
  (list || []).forEach(function (item) {
    var id = sanitizeSalesChannelId(item);
    if (id && out.indexOf(id) < 0) {
      out.push(id);
    }
  });
  return JSON.stringify(out);
}

/** 判断该销售渠道是否隐藏闲鱼 */
function shouldHideXianyuForSalesChannel(salesCh, hideList) {
  var ch = sanitizeSalesChannelId(salesCh);
  if (!ch) {
    return false;
  }
  return (hideList || []).indexOf(ch) >= 0;
}

/** 合并设置里的隐藏闲鱼渠道 + 已启用的代理专属渠道 */
async function getAgentPromoChannelListFromSettings() {
  var raw = await getInstallPackageSettingsFromDb();
  var list = (raw.xianyu_hide_channels || []).slice();
  try {
    var extra = await getAgentChannels().listEnabledChannelIds();
    (extra || []).forEach(function (id) {
      var ch = sanitizeSalesChannelId(id);
      if (ch && list.indexOf(ch) < 0) {
        list.push(ch);
      }
    });
  } catch (e) {}
  return list;
}

/** 是否代理推广渠道（隐藏闲鱼列表或专属渠道表） */
async function isAgentPromoSalesChannel(salesCh) {
  var ch = sanitizeSalesChannelId(salesCh);
  if (!ch) return false;
  try {
    var list = await getAgentPromoChannelListFromSettings();
    return list.indexOf(ch) >= 0;
  } catch (e) {
    return false;
  }
}

/**
 * 代理推广渠道强制的支付方案：全站只保留一套，渠道不再分流 A/C。
 * @returns {Promise<string|null>} b 或 null（非代理渠道）
 */
async function resolveForcedAbcForSalesChannel(salesCh) {
  var ch = sanitizeSalesChannelId(salesCh);
  if (!ch) return null;
  try {
    var pol = await getAgentChannels().getEnabledChannelById(ch);
    if (pol) return 'b';
  } catch (ePol) {}
  if (await isAgentPromoSalesChannel(ch)) {
    return 'b';
  }
  return null;
}

/**
 * 按渠道专属价覆盖 offer.skus（用户账号渠道优先，其次请求 ch / header）。
 * 用户专属报价应在本函数之后再套用。
 */
async function applyAgentChannelPricesToOffer(offer, username, req) {
  if (!offer || !offer.skus) return offer;
  var ch = '';
  try {
    if (username) {
      ch = await getUserSalesPromoChannel(username);
    }
  } catch (e0) {
    ch = '';
  }
  if (!ch && req) {
    try {
      ch = readSalesChannelFromRequest(req);
    } catch (e1) {
      ch = '';
    }
  }
  ch = sanitizeSalesChannelId(ch);
  if (!ch) return offer;
  var pol = null;
  try {
    pol = await getAgentChannels().getEnabledChannelById(ch);
  } catch (e2) {
    pol = null;
  }
  if (!pol || !pol.has_channel_prices || !pol.sku_prices) return offer;
  offer.skus = applyChannelCatalogPrices(offer.skus, pol.sku_prices);
  offer.forced_by_channel = true;
  offer.channel_prices = true;
  offer.channel_id = pol.channel_id;
  if (!offer.abc_source || offer.abc_source === 'single_plan') {
    offer.abc_source = 'agent_channel_price';
  }
  return offer;
}

/**
 * 渠道是否「仅激活码 / 隐藏全部自助支付」——已停用，一律走支付宝页。
 */
async function resolveCodeOnlyForSalesChannel(salesCh) {
  return false;
}

/** 登录用户是否禁止自助支付（仅激活码）——已停用 */
async function userMustHideSelfServePay(username) {
  return false;
}

/**
 * 经专属/代理推广渠道注册/登录：挂到下属代理名下（若有专属配置）；
 * 支付方案与全站同一套。
 * @returns {Promise<object|null>} 渠道配置或 null
 */
async function attachUserFromSalesChannel(username, salesCh) {
  var u = String(username || '').trim();
  var ch = sanitizeSalesChannelId(salesCh);
  if (!u || !ch) {
    return null;
  }
  var pol = null;
  try {
    pol = await getAgentChannels().attachUserToChannel(u, ch);
  } catch (eAtt) {
    console.error('attachUserFromSalesChannel', eAtt);
    return null;
  }
  var forcedAbc = null;
  if (pol) {
    forcedAbc = 'b';
  } else if (await isAgentPromoSalesChannel(ch)) {
    /* 未建专属渠道、但在代理推广列表：仍写入渠道，支付跟全站同一套 */
    try {
      if (pool) {
        await pool.execute(
          `UPDATE users
           SET sales_promo_channel = COALESCE(NULLIF(TRIM(sales_promo_channel), ''), ?)
           WHERE username = ?`,
          [ch, u]
        );
      }
    } catch (ePromo) {
      console.error('attachUserFromSalesChannel promo', ePromo);
    }
    forcedAbc = 'b';
    pol = {
      channel_id: ch,
      owner_admin_username: '',
      default_pricing_abc: 'b',
      enabled: true,
      note: ''
    };
  }
  if (forcedAbc) {
    try {
      /* 管理端指定方案优先：登录挂渠道时不得覆盖 admin_force */
      var existingSticky = await getPricingAb().getStickyAssignment(u);
      if (!(existingSticky && existingSticky.source === 'admin_force')) {
        await getPricingAb().setStickyAbc(u, forcedAbc, 'agent_channel', true);
      }
    } catch (eSticky) {}
  }
  try {
    _salesPromoChannelCache.delete(u);
  } catch (eCache) {}
  return pol;
}

/**
 * 从请求体 / 已有账号 / 游客继承挂载专属渠道。
 * 不用裸 IP 归因挂载：同一出口 IP 测过 ?ch=quan_c 后，会把无关账号永久标成仅激活码。
 * 代理包 / 推广链接须显式带 ch（body/query/localStorage→注册参数）或游客已绑渠道。
 */
async function attachUserFromRequestChannel(username, req, body) {
  var u = String(username || '').trim();
  if (!u) return null;
  var ch = readSalesChannelFromRequest(req, body);
  if (!ch) {
    try {
      ch = await getUserSalesPromoChannel(u);
    } catch (e2) {
      ch = '';
    }
  }
  /* 游客沙盒已绑渠道时，注册账号继承 */
  if (!ch) {
    try {
      var guestU =
        (body && (body.guest_username || body.guestUsername)) ||
        '';
      guestU = String(guestU || '').trim();
      if (!guestU) {
        var cid = readClientIdFromRequest(req);
        if (!cid && body && (body.client_id || body.clientId)) {
          cid = String(body.client_id || body.clientId).trim();
        }
        if (cid) guestU = guestUsernameForClientId(cid);
      }
      if (guestU && guestU.indexOf(GUEST_USERNAME_PREFIX) === 0 && guestU !== u) {
        ch = await getUserSalesPromoChannel(guestU);
      }
    } catch (e3) {
      ch = ch || '';
    }
  }
  /* 设备指纹/client_id 归因（不含裸 IP）——代理清缓存后同机仍可恢复 */
  if (!ch) {
    try {
      ch = await resolveSalesChannelForRequestStrict(req);
    } catch (e4) {
      ch = '';
    }
  }
  if (!ch) {
    return null;
  }
  return attachUserFromSalesChannel(u, ch);
}

/**
 * 子管理员可见：激活码名下 或 专属渠道归属（owner_agent_admin）
 * @param {string} userCol 如 users.username / u.username
 */
function appendSubAdminOwnedUsersScope(whereClauses, params, adminUsername, userCol, extraOwners) {
  var owners = adminDownline.uniqueUsernames([adminUsername].concat(extraOwners || []));
  if (!owners.length || !userCol) return;
  var m = /^([a-zA-Z_][\w]*)\.username$/.exec(String(userCol));
  var alias = m ? m[1] : '';
  var useSameTable = alias === 'users' || alias === 'u';
  if (useSameTable) {
    var agentSql = adminDownline.ownerAdminInSql(alias + '.owner_agent_admin', params, owners);
    var codeSql = adminDownline.ownerAdminInSql('ac.owner_admin_username', params, owners);
    whereClauses.push(
      '(' +
        agentSql +
        ' OR EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = ' +
        userCol +
        ' AND ' +
        codeSql +
        '))'
    );
    return;
  }
  var agentSql2 = adminDownline.ownerAdminInSql('__oa.owner_agent_admin', params, owners);
  var codeSql2 = adminDownline.ownerAdminInSql('ac.owner_admin_username', params, owners);
  whereClauses.push(
    '(EXISTS (SELECT 1 FROM users __oa WHERE __oa.username = ' +
      userCol +
      ' AND ' +
      agentSql2 +
      ') OR EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = ' +
      userCol +
      ' AND ' +
      codeSql2 +
      '))'
  );
}

/** 按当前管理员（含下线）追加用户归属范围 */
function appendSubAdminOwnedUsersScopeForAdmin(whereClauses, params, admin, userCol) {
  if (!admin) return;
  appendSubAdminOwnedUsersScope(
    whereClauses,
    params,
    admin.username,
    userCol,
    admin.downline_usernames
  );
}

/** promo segment filter */
function promoSegmentFilter(segment, userAlias, agentChannels) {
  var col = userAlias + '.sales_promo_channel';
  if (!agentChannels || !agentChannels.length) {
    if (segment === 'agent') {
      return { sql: '1=0', params: [] };
    }
    return { sql: '1=1', params: [] };
  }
  var ph = agentChannels
    .map(function () {
      return '?';
    })
    .join(',');
  var normCh = 'LOWER(TRIM(' + col + '))';
  var agentSql = '(' + normCh + ' IN (' + ph + '))';
  var params = agentChannels.slice();
  if (segment === 'agent') {
    return { sql: agentSql, params: params };
  }
  // 自有流量：未填渠道（NULL/空）或渠道不在代理列表；避免 NOT (NULL IN …) 在 SQL 中恒为 UNKNOWN 导致漏计
  return {
    sql: '(' + col + ' IS NULL OR TRIM(' + col + ') = \'\' OR ' + normCh + ' NOT IN (' + ph + '))',
    params: params
  };
}

/** 计算转化率百分比 */
function analyticsConversionPct(n, d) {
  if (!d || d <= 0) {
    return null;
  }
  return (Math.round((n / d) * 1000) / 10).toFixed(1) + '%';
}

/** 汇总转化时间序列各项合计 */
function sumConversionSeriesTotals(series) {
  var registered = 0;
  var activated = 0;
  (series || []).forEach(function (row) {
    registered += Number(row.registered) || 0;
    activated += Number(row.activated) || 0;
  });
  return {
    registered: registered,
    activated: activated,
    rate_pct: analyticsConversionPct(activated, registered)
  };
}

/** 构建每日转化时间序列 */
function buildDailyConversionSeries(days, regMap, actMap) {
  var series = [];
  var todayKey = chinaDateKeyNow();
  var todayParts = todayKey.split('-').map(Number);
  for (var i = 0; i < days; i++) {
    var dt = new Date(todayParts[0], todayParts[1] - 1, todayParts[2] - (days - 1 - i));
    var key = formatDateKey(dt);
    var registered = regMap[key] || 0;
    var activated = actMap[key] || 0;
    var rate = registered > 0 ? activated / registered : null;
    series.push({
      date: key,
      registered: registered,
      activated: activated,
      rate: rate,
      rate_pct: rate == null ? null : analyticsConversionPct(activated, registered)
    });
  }
  var todayRow = series.length ? series[series.length - 1] : { date: todayKey, registered: 0, activated: 0, rate: null, rate_pct: null };
  if (todayRow.date !== todayKey) {
    todayRow = {
      date: todayKey,
      registered: regMap[todayKey] || 0,
      activated: actMap[todayKey] || 0,
      rate: null,
      rate_pct: null
    };
    if (todayRow.registered > 0) {
      todayRow.rate = todayRow.activated / todayRow.registered;
      todayRow.rate_pct = analyticsConversionPct(todayRow.activated, todayRow.registered);
    }
  }
  return {
    today: todayRow,
    series: series,
    today_is_current: true,
    period_total: sumConversionSeriesTotals(series)
  };
}

/** 按日期范围构建每日转化序列 */
function buildDailyConversionSeriesForRange(startKey, endKey, regMap, actMap) {
  var series = [];
  var startParts = startKey.split('-').map(Number);
  var endParts = endKey.split('-').map(Number);
  var cur = new Date(startParts[0], startParts[1] - 1, startParts[2]);
  var end = new Date(endParts[0], endParts[1] - 1, endParts[2]);
  var todayKey = chinaDateKeyNow();
  while (cur.getTime() <= end.getTime()) {
    var key = formatDateKey(cur);
    var registered = regMap[key] || 0;
    var activated = actMap[key] || 0;
    var rate = registered > 0 ? activated / registered : null;
    series.push({
      date: key,
      registered: registered,
      activated: activated,
      rate: rate,
      rate_pct: rate == null ? null : analyticsConversionPct(activated, registered)
    });
    cur.setDate(cur.getDate() + 1);
  }
  var lastRow = series.length
    ? series[series.length - 1]
    : { date: endKey, registered: 0, activated: 0, rate: null, rate_pct: null };
  return {
    today: lastRow,
    series: series,
    today_is_current: lastRow.date === todayKey,
    period_total: sumConversionSeriesTotals(series)
  };
}

/** 查询某日转化分段数据 */
async function queryDailyConversionSegment(conn, period, admin, segment, agentChannels) {
  var cnUserDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
  var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
  var segUsers = promoSegmentFilter(segment, 'users', agentChannels);
  var segU = promoSegmentFilter(segment, 'u', agentChannels);
  var cnActDay = 'DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR))';

  var regWhere;
  var regParams;
  var actWhere;
  var actParams;
  if (period.mode === 'range') {
    regWhere = cnUserDay + ' >= ? AND ' + cnUserDay + ' <= ? AND ' + segUsers.sql;
    regParams = [period.start, period.end].concat(segUsers.params);
    actWhere =
      'ac.last_used_at IS NOT NULL AND ac.used_count > 0 AND ' +
      cnActDay +
      ' >= ? AND ' +
      cnActDay +
      ' <= ? AND ' +
      segU.sql;
    actParams = [period.start, period.end].concat(segU.params);
  } else {
    regWhere = cnUserDay + ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY) AND ' + segUsers.sql;
    regParams = [period.span].concat(segUsers.params);
    actWhere =
      'ac.last_used_at IS NOT NULL AND ac.used_count > 0 AND ' +
      cnActDay +
      ' >= DATE_SUB(' +
      cnToday +
      ', INTERVAL ? DAY) AND ' +
      segU.sql;
    actParams = [period.span].concat(segU.params);
  }
  regWhere = nonGuestUsernameSql('users.username') + ' AND ' + regWhere;

  var ownerAdmin = conversionAnalyticsOwnerAdmin(admin);
  if (ownerAdmin) {
    var regWhereParts = [regWhere];
    appendConversionAnalyticsRegistrationScope(regWhereParts, regParams, admin, 'users.username');
    regWhere = regWhereParts.join(' AND ');
    actWhere +=
      ' AND ' +
      adminDownline.ownerAdminInSql(
        'ac.owner_admin_username',
        actParams,
        adminDownline.adminScopeUsernames(admin)
      );
  }

  const [regRows] = await conn.query(
    'SELECT ' + cnUserDay + ' AS d, COUNT(*) AS cnt FROM users WHERE ' + regWhere + ' GROUP BY ' + cnUserDay,
    regParams
  );
  const [actRows] = await conn.query(
    'SELECT DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR)) AS d, COUNT(DISTINCT ac.used_by_username) AS cnt' +
      ' FROM activation_codes ac' +
      ' INNER JOIN users u ON u.username = ac.used_by_username AND ' +
      userActivationStatsEligibleSql('u.username') +
      ' WHERE ' +
      actWhere +
      ' GROUP BY DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR))',
    actParams
  );

  var regMap = {};
  regRows.forEach(function (r) {
    var k = formatDateKey(r.d);
    if (k) {
      regMap[k] = Number(r.cnt) || 0;
    }
  });
  var actMap = {};
  actRows.forEach(function (r) {
    var k = formatDateKey(r.d);
    if (k) {
      actMap[k] = Number(r.cnt) || 0;
    }
  });
  if (period.mode === 'range') {
    return buildDailyConversionSeriesForRange(period.start, period.end, regMap, actMap);
  }
  return buildDailyConversionSeries(period.days, regMap, actMap);
}

/** 查询某日激活渠道分段 */
async function queryDailyActivationChannelSegment(conn, period, admin, channelKey) {
  var ownerAdmin = conversionAnalyticsOwnerAdmin(admin);
  var cnActDay = 'DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR))';
  var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
  var chFilter = activationChannelFilterSql('u', 'ac', channelKey);
  var chParams = activationChannelFilterParams(channelKey);
  if (!chParams.length) {
    var empty =
      period.mode === 'range'
        ? buildDailyConversionSeriesForRange(period.start, period.end, {}, {})
        : buildDailyConversionSeries(period.days, {}, {});
    empty.activation_only = true;
    empty.activation_channel = String(channelKey || '');
    return empty;
  }

  var actWhere = 'ac.last_used_at IS NOT NULL AND ac.used_count > 0 AND ' + chFilter;
  var actParams = chParams.slice();
  if (ownerAdmin) {
    actWhere +=
      ' AND ' +
      adminDownline.ownerAdminInSql(
        'ac.owner_admin_username',
        actParams,
        adminDownline.adminScopeUsernames(admin)
      );
  }
  if (period.mode === 'range') {
    actWhere += ' AND ' + cnActDay + ' >= ? AND ' + cnActDay + ' <= ?';
    actParams.push(period.start, period.end);
  } else {
    actWhere += ' AND ' + cnActDay + ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY)';
    actParams.push(period.span);
  }

  const [actRows] = await conn.query(
    'SELECT DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR)) AS d, COUNT(DISTINCT ac.used_by_username) AS cnt' +
      ' FROM activation_codes ac' +
      ' INNER JOIN users u ON u.username = ac.used_by_username AND ' +
      userActivationStatsEligibleSql('u.username') +
      ' WHERE ' +
      actWhere +
      ' GROUP BY DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR))',
    actParams
  );

  var actMap = {};
  actRows.forEach(function (r) {
    var k = formatDateKey(r.d);
    if (k) {
      actMap[k] = Number(r.cnt) || 0;
    }
  });
  var regMap = {};
  var result;
  if (period.mode === 'range') {
    result = buildDailyConversionSeriesForRange(period.start, period.end, regMap, actMap);
  } else {
    result = buildDailyConversionSeries(period.days, regMap, actMap);
  }
  result.activation_only = true;
  result.activation_channel = String(channelKey || '');
  return result;
}

/** 尝试从请求解析已登录用户 id */
function tryAuthUserIdFromRequest(req) {
  var auth = req && req.headers ? req.headers.authorization || '' : '';
  var m = /^Bearer\s+(\S+)/i.exec(auth);
  if (!m) {
    return '';
  }
  try {
    var payload = jwt.verify(m[1], JWT_SECRET);
    if (payload.role === 'admin') {
      return '';
    }
    return String(payload.sub || '').trim();
  } catch (e) {
    return '';
  }
}

/** 获取用户销售推广渠道 */
async function getUserSalesPromoChannel(userId) {
  if (!pool || userId == null || String(userId).trim() === '') {
    return '';
  }
  var uid = String(userId).trim();
  var now = Date.now();
  var hit = _salesPromoChannelCache.get(uid);
  if (hit && now - hit.t < SALES_PROMO_CHANNEL_CACHE_MS) {
    return hit.v;
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT sales_promo_channel FROM users WHERE username = ? LIMIT 1', [
      uid
    ]);
    var ch = '';
    if (rows.length && rows[0].sales_promo_channel != null) {
      ch = sanitizeSalesChannelId(rows[0].sales_promo_channel);
    }
    _salesPromoChannelCache.set(uid, { v: ch, t: now });
    if (_salesPromoChannelCache.size > 4000) {
      _salesPromoChannelCache.clear();
    }
    return ch;
  } finally {
    conn.release();
  }
}

/**
 * 一次解析安装包上下文，避免 install-packages 重复查渠道归因 / 用户渠道。
 * @returns {{ raw: object, salesCh: string, hideXianyu: boolean }}
 */
async function resolveInstallPackagesContext(req) {
  var raw = await getInstallPackageSettingsFromDb();
  var hideList = (raw.xianyu_hide_channels || []).slice();
  try {
    var exclusive = await getAgentChannels().listEnabledChannelIds();
    (exclusive || []).forEach(function (id) {
      var chId = sanitizeSalesChannelId(id);
      if (chId && hideList.indexOf(chId) < 0) {
        hideList.push(chId);
      }
    });
  } catch (eHide) {}
  var queryCh = readSalesChannelFromRequest(req);
  var uid =
    req && req.authUserId != null && String(req.authUserId).trim() !== ''
      ? String(req.authUserId).trim()
      : tryAuthUserIdFromRequest(req);
  var userCh = uid ? await getUserSalesPromoChannel(uid) : '';
  /*
   * 已登录：只用账号渠道或 URL 显式 ?ch=，禁止 IP/设备归因兜底。
   * 否则测过代理链接的同一出口 IP 会把直客 A 方案也标成 code_only，购买页看不到支付宝。
   * 未登录：仍可用归因，方便 install_guide 匿名下载/藏闲鱼。
   */
  var salesCh = queryCh || userCh || '';
  if (!salesCh && !uid) {
    try {
      salesCh = await resolveSalesChannelForRequest(req);
    } catch (e) {
      salesCh = '';
    }
  }
  var hideXianyu = shouldHideXianyuForSalesChannel(uid ? userCh || salesCh : salesCh, hideList);
  var channelPolicy = null;
  if (salesCh) {
    try {
      channelPolicy = await getAgentChannels().getEnabledChannelById(salesCh);
    } catch (ePol) {
      channelPolicy = null;
    }
  }
  return {
    raw: raw,
    salesCh: salesCh || null,
    hideXianyu: hideXianyu,
    channelPolicy: channelPolicy
  };
}

/** 清除安装包公开响应缓存 */
function invalidateInstallPackagesResponseCache() {
  _installPackagesResponseCache.clear();
}

/** 清除税务记录列表缓存 */
function invalidateTaxRecordsListCache(userId) {
  if (userId == null || String(userId).trim() === '') {
    _taxRecordsListCache.clear();
    return;
  }
  var prefix = String(userId).trim() + '\0';
  _taxRecordsListCache.forEach(function (_v, key) {
    if (key.indexOf(prefix) === 0) {
      _taxRecordsListCache.delete(key);
    }
  });
}

/** 清除用户 info API 缓存 */
function invalidateUserInfoApiCache(userId) {
  if (userId == null || String(userId).trim() === '') {
    _userInfoApiCache.clear();
    _userSummaryApiCache.clear();
    _employersApiCache.clear();
    return;
  }
  var uid = String(userId).trim();
  _userInfoApiCache.delete(uid);
  _userSummaryApiCache.delete(uid);
  _employersApiCache.delete(uid);
}

/** 清除站内信列表缓存 */
function invalidateMessageListCache(userId) {
  if (userId == null || String(userId).trim() === '') {
    _messageListCache.clear();
    return;
  }
  _messageListCache.delete(String(userId).trim());
}

/** wrap pool get connection timing */
function wrapPoolGetConnectionTiming(p) {
  if (!p || typeof p.getConnection !== 'function' || p.__acquireTimingWrapped) {
    return p;
  }
  var orig = p.getConnection.bind(p);
  p.getConnection = function () {
    var t0 = Date.now();
    return orig().then(
      function (conn) {
        var acquireMs = Date.now() - t0;
        if (acquireMs >= 500) {
          console.warn('[db-pool] acquire_ms=' + acquireMs);
        }
        try {
          conn.__acquireMs = acquireMs;
        } catch (e0) {}
        return conn;
      },
      function (err) {
        var acquireMs = Date.now() - t0;
        if (acquireMs >= 500 || (err && err.code === 'ER_CON_COUNT_ERROR')) {
          console.warn('[db-pool] acquire_fail_ms=' + acquireMs + ' err=' + (err && err.message));
        }
        throw err;
      }
    );
  };
  p.__acquireTimingWrapped = true;
  return p;
}

/** 从请求读取客户端标识 */
function readClientIdFromRequest(req) {
  try {
    if (req.clientDevicePayload && req.clientDevicePayload.client_id) {
      return String(req.clientDevicePayload.client_id).trim().substring(0, 128);
    }
  } catch (e) {}
  return '';
}

/** 从请求推导设备型号 key */
function deviceModelKeyFromRequest(req) {
  var ex = req.clientDevicePayload;
  if (ex && ex.model) {
    return slugDeviceStatsKey(String(ex.model));
  }
  var ua = normalizeUserAgentHeader(req);
  if (!ua) {
    return '';
  }
  return slugDeviceStatsKey(classifyUserDeviceRow(ua, null).model_label || '');
}

/** 记录销售渠道归因 */
async function recordSalesChannelAttribution(req, salesCh, sourcePage) {
  if (!pool) {
    return;
  }
  var ch = sanitizeSalesChannelId(salesCh);
  if (!ch) {
    return;
  }
  var cid = readClientIdFromRequest(req);
  var fp = sanitizeAuditText(computeDeviceFingerprint(req), 64);
  var ip = sanitizeAuditText(getClientIp(req), 128);
  var ua = sanitizeAuditText(normalizeUserAgentHeader(req), 512);
  var modelKey = deviceModelKeyFromRequest(req);
  var src = sourcePage != null ? String(sourcePage).trim().substring(0, 128) : '';
  var expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  try {
    await pool.execute(
      `INSERT INTO sales_channel_attributions
       (sales_ch, client_id, device_fp, ip, user_agent, device_model, source_page, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ch, cid || null, fp || null, ip || null, ua || null, modelKey || null, src || null, expiresAt]
    );
  } catch (e) {
    console.error('recordSalesChannelAttribution', e);
  }
}

/** 按请求解析销售渠道 */
async function resolveSalesChannelForRequest(req, opts) {
  if (!pool) {
    return '';
  }
  opts = opts || {};
  /* allowIp=false：挂载账号时禁用裸 IP，避免同出口污染直客 */
  var allowIp = opts.allowIp !== false;
  var cid = readClientIdFromRequest(req);
  var fp = sanitizeAuditText(computeDeviceFingerprint(req), 64);
  var ip = sanitizeAuditText(getClientIp(req), 128);
  var modelKey = deviceModelKeyFromRequest(req);

  async function pickFirst(sql, params) {
    const [rows] = await pool.execute(sql, params);
    if (rows.length && rows[0].sales_ch) {
      return sanitizeSalesChannelId(rows[0].sales_ch);
    }
    return '';
  }

  var tasks = [];
  if (cid) {
    tasks.push(
      pickFirst(
        `SELECT sales_ch FROM sales_channel_attributions
         WHERE client_id = ? AND expires_at > UTC_TIMESTAMP(3)
         ORDER BY created_at DESC LIMIT 1`,
        [cid]
      )
    );
  }
  if (fp) {
    tasks.push(
      pickFirst(
        `SELECT sales_ch FROM sales_channel_attributions
         WHERE device_fp = ? AND expires_at > UTC_TIMESTAMP(3)
         ORDER BY created_at DESC LIMIT 1`,
        [fp]
      )
    );
  }
  if (allowIp && ip && modelKey) {
    tasks.push(
      pickFirst(
        `SELECT sales_ch FROM sales_channel_attributions
         WHERE ip = ? AND device_model = ? AND expires_at > UTC_TIMESTAMP(3)
           AND created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 7 DAY)
         ORDER BY created_at DESC LIMIT 1`,
        [ip, modelKey]
      )
    );
  }
  if (allowIp && ip) {
    tasks.push(
      pickFirst(
        `SELECT sales_ch FROM sales_channel_attributions
         WHERE ip = ? AND expires_at > UTC_TIMESTAMP(3)
           AND created_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 48 HOUR)
         ORDER BY created_at DESC LIMIT 1`,
        [ip]
      )
    );
  }
  if (!tasks.length) {
    return '';
  }
  var results = await Promise.all(tasks);
  for (var i = 0; i < results.length; i++) {
    if (results[i]) return results[i];
  }
  return '';
}

/** 仅 client_id / 设备指纹归因（不含裸 IP） */
async function resolveSalesChannelForRequestStrict(req) {
  return resolveSalesChannelForRequest(req, { allowIp: false });
}

/** 从库读安装包设置 */
async function getInstallPackageSettingsFromDb() {
  var now = Date.now();
  if (
    _installPackageSettingsCache &&
    now - _installPackageSettingsCache.t < INSTALL_PACKAGE_SETTINGS_CACHE_MS
  ) {
    return _installPackageSettingsCache.v;
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN (?, ?, ?, ?, ?, ?, ?)',
      [
        SETTING_KEY_ANDROID_APK,
        SETTING_KEY_AGENT_ANDROID_APK,
        SETTING_KEY_IOS_MOBILECONFIG,
        SETTING_KEY_XIANYU_PURCHASE,
        SETTING_KEY_QQ_ADD_URL,
        SETTING_KEY_QQ_GROUP_URL,
        SETTING_KEY_XIANYU_HIDE_CHANNELS
      ]
    );
    var map = {};
    rows.forEach(function (r) {
      map[r.setting_key] = r.setting_value;
    });
    var android = map[SETTING_KEY_ANDROID_APK] != null ? String(map[SETTING_KEY_ANDROID_APK]).trim() : '';
    var agentAndroid =
      map[SETTING_KEY_AGENT_ANDROID_APK] != null ? String(map[SETTING_KEY_AGENT_ANDROID_APK]).trim() : '';
    var ios = map[SETTING_KEY_IOS_MOBILECONFIG] != null ? String(map[SETTING_KEY_IOS_MOBILECONFIG]).trim() : '';
    var xianyu =
      map[SETTING_KEY_XIANYU_PURCHASE] != null ? String(map[SETTING_KEY_XIANYU_PURCHASE]).trim() : '';
    var qq = map[SETTING_KEY_QQ_ADD_URL] != null ? String(map[SETTING_KEY_QQ_ADD_URL]).trim() : '';
    var qqGroup =
      map[SETTING_KEY_QQ_GROUP_URL] != null ? String(map[SETTING_KEY_QQ_GROUP_URL]).trim() : '';
    var hideChannels = parseXianyuHideSalesChannels(map[SETTING_KEY_XIANYU_HIDE_CHANNELS]);
    var out = {
      android: android,
      agent_android: agentAndroid,
      ios: ios,
      xianyu: xianyu,
      qq: qq,
      qq_group: qqGroup,
      xianyu_hide_channels: hideChannels
    };
    _installPackageSettingsCache = { v: out, t: now };
    return out;
  } finally {
    conn.release();
  }
}

/** 判断是否为已废弃的消息头图引用 */
function isDeprecatedMessageHeaderRef(raw) {
  var s = raw != null ? String(raw).trim() : '';
  return !s || s === 'message_header.jpg' || /(^|\/)message_header\.jpg$/i.test(s);
}

/** 清洗「我的」页图片引用路径 */
function sanitizeMineUiImageRef(raw) {
  if (raw == null) {
    return '';
  }
  var s = String(raw).trim();
  if (s === '' || s.length > 500) {
    return '';
  }
  if (/[\s<>"']/.test(s)) {
    return '';
  }
  if (s.indexOf('..') >= 0) {
    return '';
  }
  if (s.charAt(0) === '/') {
    var tail = s.slice(1);
    if (tail !== '' && /^[a-zA-Z0-9][a-zA-Z0-9_.\-\/]*$/.test(tail)) {
      return s;
    }
    return '';
  }
  if (/^https?:\/\//i.test(s)) {
    if (/^https?:\/\/[^\s'"<>]+$/i.test(s)) {
      return s;
    }
    return '';
  }
  if (/^[a-zA-Z0-9][a-zA-Z0-9_.\-\/]*$/.test(s)) {
    return s;
  }
  return '';
}

/** 加载「我的」页 UI 配置 */
async function loadMineUiParsed() {
  if (!pool) {
    return null;
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [SETTING_KEY_MINE_UI]
    );
    if (rows.length === 0 || rows[0].setting_value == null) {
      return null;
    }
    var parsed = JSON.parse(String(rows[0].setting_value));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.error('loadMineUiParsed JSON', e);
    } else {
      console.error('loadMineUiParsed', e);
    }
    return null;
  } finally {
    conn.release();
  }
}

/** 获取：mine ui for api */
async function getMineUiForApi() {
  var out = cloneMineUiDefaults();
  var parsed = await loadMineUiParsed();
  if (!parsed) {
    return out;
  }
  if (parsed.theme === 'yellow' || parsed.theme === 'blue') {
    out.theme = parsed.theme;
  }
  if (parsed.use_default_images !== true) {
    MINE_UI_IMAGE_KEYS.forEach(function (k) {
      if (parsed[k] != null) {
        var ok = sanitizeMineUiImageRef(parsed[k]);
        if (ok && !(k === 'message_header' && isDeprecatedMessageHeaderRef(ok))) {
          out[k] = ok;
        }
      }
    });
  }
  if (isDeprecatedMessageHeaderRef(out.message_header)) {
    out.message_header = '';
  }
  MINE_UI_VIDEO_KEYS.forEach(function (k) {
    if (parsed[k] != null) {
      var ok = sanitizeMineUiImageRef(parsed[k]);
      if (ok) {
        out[k] = ok;
      }
    }
  });
  INSTALL_SHOWCASE_IMAGE_KEYS.forEach(function (k) {
    if (parsed[k] != null) {
      var okShow = sanitizeMineUiImageRef(parsed[k]);
      if (okShow) {
        out[k] = okShow;
      }
    }
  });
  return out;
}

/** 获取：mine ui for admin form */
async function getMineUiForAdminForm() {
  var base = cloneMineUiDefaults();
  var form = Object.assign({ use_default_images: false }, base);
  var parsed = await loadMineUiParsed();
  if (!parsed) {
    return form;
  }
  if (parsed.theme === 'yellow' || parsed.theme === 'blue') {
    form.theme = parsed.theme;
  }
  form.use_default_images = parsed.use_default_images === true;
  MINE_UI_IMAGE_KEYS.forEach(function (k) {
    if (parsed[k] != null) {
      var ok = sanitizeMineUiImageRef(parsed[k]);
      if (ok && !(k === 'message_header' && isDeprecatedMessageHeaderRef(ok))) {
        form[k] = ok;
      }
    }
  });
  MINE_UI_VIDEO_KEYS.forEach(function (k) {
    if (parsed[k] != null) {
      var ok = sanitizeMineUiImageRef(parsed[k]);
      if (ok) {
        form[k] = ok;
      }
    }
  });
  INSTALL_SHOWCASE_IMAGE_KEYS.forEach(function (k) {
    if (parsed[k] != null) {
      var okShow = sanitizeMineUiImageRef(parsed[k]);
      if (okShow) {
        form[k] = okShow;
      }
    }
  });
  if (isDeprecatedMessageHeaderRef(form.message_header)) {
    form.message_header = '';
  }
  return form;
}

var ADMIN_UPLOAD_MEDIA_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.m4v', '.webm'];
var ADMIN_UPLOAD_INSTALL_EXT = ['.apk', '.mobileconfig'];

const adminUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
      var ext = path.extname(file.originalname || '').toLowerCase();
      var allow = ADMIN_UPLOAD_MEDIA_EXT.concat(ADMIN_UPLOAD_INSTALL_EXT);
      if (allow.indexOf(ext) < 0) {
        ext = '.bin';
      }
      cb(null, crypto.randomBytes(16).toString('hex') + ext);
    }
  }),
  limits: { fileSize: ADMIN_UPLOAD_MAX_BYTES },
  fileFilter: function (req, file, cb) {
    var ext = path.extname(file.originalname || '').toLowerCase();
    var ok =
      ADMIN_UPLOAD_MEDIA_EXT.indexOf(ext) >= 0 || ADMIN_UPLOAD_INSTALL_EXT.indexOf(ext) >= 0;
    cb(
      ok ? null : new Error('仅支持图片/视频（jpg、png、gif、webp、mp4 等）或安装包（apk、mobileconfig）'),
      ok
    );
  }
});

/** 管理端上传资源 */
function handleAdminUploadAsset(req, res) {
  if (!req.file) {
    return res.status(400).json({ code: 400, msg: '未选择文件或扩展名不支持' });
  }
  return res.json({ code: 200, data: { path: 'uploads/' + req.file.filename } });
}

/** 判断用户行是否为测试账号 */
function rowUserTypeIsTest(row) {
  if (!row) return false;
  var t = row.user_type != null ? Number(row.user_type) : 0;
  return t === USER_TYPE_TEST;
}

/** 判断用户行是否为访客 */
function rowUserTypeIsGuest(row) {
  if (!row) return false;
  var t = row.user_type != null ? Number(row.user_type) : 0;
  return t === USER_TYPE_GUEST;
}

/** 解析客户端 IP */
function getClientIp(req) {
  // Cloudflare：优先 CF-Connecting-IP（Nginx 亦会改写 X-Real-IP）
  var cf = req.headers['cf-connecting-ip'];
  if (cf) {
    var cfIp = String(cf).split(',')[0].trim();
    if (cfIp) return cfIp.replace(/^::ffff:/, '');
  }
  var xf = req.headers['x-forwarded-for'];
  if (xf) {
    var first = String(xf).split(',')[0].trim();
    if (first) return first.replace(/^::ffff:/, '');
  }
  var rip = req.headers['x-real-ip'];
  if (rip) return String(rip).trim().replace(/^::ffff:/, '');
  var ra = req.socket && req.socket.remoteAddress;
  return ra ? String(ra).replace(/^::ffff:/, '') : '';
}

/** IP 是否在封禁黑名单 */
async function isIpBlocked(ip) {
  if (!ip) return false;
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute('SELECT 1 FROM blocked_ips WHERE ip = ?', [ip]);
    conn.release();
    return rows.length > 0;
  } catch (e) {
    console.error('isIpBlocked error', e);
    return false;
  }
}

/** 管理端 IP 是否在拒绝列表 */
function isAdminIpDenied(req) {
  if (!ADMIN_IP_DENYLIST.length) return false;
  var ip = getClientIp(req);
  if (!ip) return false;
  return ADMIN_IP_DENYLIST.indexOf(ip) >= 0;
}

/** 返回限流错误 */
function sendRateLimited(res, result, msg) {
  var retryMs = result && result.retry_after_ms ? Number(result.retry_after_ms) : 60000;
  res.set('Retry-After', String(Math.ceil(retryMs / 1000)));
  return res.status(429).json({ code: 429, msg: msg || '请求过于频繁，请稍后再试', retry_after_ms: retryMs });
}

/** 检查登录业务限流（Redis 优先） */
async function checkLoginBusinessRate(req, username) {
  var ip = getClientIp(req) || 'unknown';
  var byIp = await consumeRateLimit('login-ip', ip, LOGIN_RATE_PER_IP_MIN, 60 * 1000);
  if (!byIp.ok) return byIp;
  if (username) {
    return await consumeRateLimit(
      'login-user',
      String(username).toLowerCase(),
      LOGIN_RATE_PER_USER_MIN,
      60 * 1000
    );
  }
  return { ok: true };
}

/** 埋点写入限流 */
async function checkTrackRate(req) {
  var ip = getClientIp(req) || 'unknown';
  return await consumeRateLimit('track-ip', ip, TRACK_RATE_PER_IP_MIN, 60 * 1000);
}

/** 管理 API 限流 */
function adminApiRateLimit(req, res, next) {
  var ip = getClientIp(req) || 'unknown';
  consumeRateLimit('admin-api-ip', ip, ADMIN_API_RATE_PER_IP_MIN, 60 * 1000)
    .then(function (result) {
      if (!result.ok) return sendRateLimited(res, result, '管理后台请求过于频繁，请稍后再试');
      next();
    })
    .catch(function () {
      next();
    });
}

/** 管理重查询限流 */
function heavyAdminApiRateLimit(req, res, next) {
  var ip = getClientIp(req) || 'unknown';
  consumeRateLimit('admin-heavy-ip', ip, HEAVY_ADMIN_API_RATE_PER_IP_MIN, 60 * 1000)
    .then(function (result) {
      if (!result.ok) return sendRateLimited(res, result, '统计/查询接口请求过于频繁，请稍后再试');
      next();
    })
    .catch(function () {
      next();
    });
}

/** 由 IP 解析城市展示名 */
function cityLabelFromIp(ip) {
  if (!ip) return '—';
  if (ip === '::1' || ip === '127.0.0.1') return '本地';
  var g = geoip.lookup(ip);
  if (!g) return '—';
  if (g.country === 'CN') {
    var c = g.city && String(g.city).trim();
    if (c) return c;
    /* geoip-lite 对大量国内 IP 只有国家、无 city；避免误读成「用户城市就是中国」 */
    var r = g.region && String(g.region).trim();
    if (r) return '中国（' + r + '）';
    return '中国（IP 库无城市）';
  }
  var parts = [];
  if (g.city) parts.push(g.city);
  if (g.country) parts.push(g.country);
  return parts.join(' · ') || '—';
}

/** 解析：device city label */
function resolveDeviceCityLabel(ip, cityStored) {
  var c = cityStored != null ? String(cityStored).trim() : '';
  if (c && c !== '—') return c.substring(0, 255);
  return cityLabelFromIp(ip);
}

/** 更新用户最近登录城市 */
async function updateUserLastLoginCity(username, req) {
  try {
    var ip = getClientIp(req);
    var label = cityLabelFromIp(ip);
    const conn = await pool.getConnection();
    try {
      await conn.execute('UPDATE users SET last_login_city = ? WHERE username = ?', [label, username]);
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('updateUserLastLoginCity', e);
  }
}

/** 初始化库表与连接池 */
async function initDatabase() {
  try {
    const conn = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD
    });
    
    await conn.execute(`CREATE DATABASE IF NOT EXISTS ${DB_DATABASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.end();
    
    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_DATABASE,
      charset: 'utf8mb4',
      waitForConnections: true,
      // 业务页常并发 auth+user+tax+埋点；原 10 易排队，弱网下表现为接口集体变慢
      connectionLimit: parseInt(process.env.DB_POOL_SIZE || '30', 10) || 30,
      // 有限排队：满则快速失败，避免 message/user 等接口无限挂起成几十秒假慢
      queueLimit: parseInt(process.env.DB_POOL_QUEUE_LIMIT || '60', 10) || 60,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000
    });
    wrapPoolGetConnectionTiming(pool);
    sharedDb.setPool(pool);
    
    await createTables();
    await runMigrations(pool);
    await ensurePaymentOrdersVariantColumns(pool);
    registerGuard.initRegisterGuard(pool);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * 历史建表 + ALTER 合集。
 * 冻结：自阶段 1 起禁止在此追加新业务 ALTER；新变更请新增 backend/migrations/*.sql。
 */
async function createTables() {
  const conn = await pool.getConnection();
  
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      salt VARCHAR(255) NOT NULL,
      hash VARCHAR(255) NOT NULL,
      real_name VARCHAR(255),
      tax_id VARCHAR(255),
      employer_count INT DEFAULT 0,
      family_count INT DEFAULT 0,
      bank_card_count INT DEFAULT 0,
      gender INT DEFAULT 1,
      watermark_enabled BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS employers (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      company_name VARCHAR(255),
      credit_code VARCHAR(255),
      position VARCHAR(255),
      hire_date VARCHAR(255),
      leave_date VARCHAR(255),
      status VARCHAR(255) DEFAULT '1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS family_members (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      real_name VARCHAR(255) NOT NULL,
      relation VARCHAR(64) NOT NULL,
      id_type VARCHAR(32) NOT NULL DEFAULT 'resident',
      id_type_label VARCHAR(64) NULL,
      id_no VARCHAR(64) NOT NULL,
      birth_date VARCHAR(32) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_family_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS bank_cards (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      card_no VARCHAR(32) NOT NULL,
      bank_name VARCHAR(128) NULL,
      province VARCHAR(64) NULL,
      phone VARCHAR(20) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_bank_cards_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await conn.execute(`
      ALTER TABLE bank_cards ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=默认卡'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS special_deduction_records (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      category VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      related_name VARCHAR(128) NULL,
      last_modified_date DATE NULL,
      filing_source VARCHAR(64) NOT NULL DEFAULT '本人',
      deduction_year INT NOT NULL,
      is_voided TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sdr_user_year (user_id, deduction_year),
      INDEX idx_sdr_user_void (user_id, is_voided)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS shenbao_jilu_records (
      user_id VARCHAR(255) NOT NULL,
      tab VARCHAR(16) NOT NULL,
      id VARCHAR(64) NOT NULL,
      group_month VARCHAR(32) NULL,
      title VARCHAR(255) NULL,
      period_start VARCHAR(32) NULL,
      period_end VARCHAR(32) NULL,
      amount_type VARCHAR(32) NULL,
      amount VARCHAR(64) NULL,
      detail_json MEDIUMTEXT NULL,
      detail_customized TINYINT NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, tab, id),
      INDEX idx_shenbao_user_tab (user_id, tab)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS tax_records (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      year INT,
      month INT,
      income_type VARCHAR(255) DEFAULT '工资薪金',
      income_subtype VARCHAR(255) DEFAULT '正常工资薪金',
      company_name VARCHAR(255),
      company_tax_id VARCHAR(255),
      tax_authority VARCHAR(255),
      report_channel VARCHAR(255) DEFAULT '其他',
      report_date VARCHAR(255),
      tax_period VARCHAR(255),
      income DECIMAL(20, 2) DEFAULT 0,
      tax_reported DECIMAL(20, 2) DEFAULT 0,
      income_this_period DECIMAL(20, 2) DEFAULT 0,
      tax_free_income DECIMAL(20, 2) DEFAULT 0,
      deduction_fee DECIMAL(20, 2) DEFAULT 5000,
      special_deduction DECIMAL(20, 2) DEFAULT 0,
      other_deduction DECIMAL(20, 2) DEFAULT 0,
      donation_deduction DECIMAL(20, 2) DEFAULT 0,
      pension_insurance DECIMAL(20, 2) DEFAULT 0,
      medical_insurance DECIMAL(20, 2) DEFAULT 0,
      unemployment_insurance DECIMAL(20, 2) DEFAULT 0,
      housing_fund DECIMAL(20, 2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_year (year),
      INDEX idx_year_month (year, month)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS tax_record_change_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      record_id VARCHAR(255) NOT NULL,
      action VARCHAR(16) NOT NULL COMMENT 'insert|update|delete',
      before_json JSON NULL,
      after_json JSON NULL,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_tax_chg_user_date (user_id, changed_at),
      INDEX idx_tax_chg_record (record_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS tax_issue_applications (
      id VARCHAR(128) NOT NULL,
      user_id VARCHAR(255) NOT NULL COMMENT '账号 username',
      apply_time VARCHAR(64) NULL COMMENT '客户端展示的申请时间',
      period_start VARCHAR(16) NOT NULL,
      period_end VARCHAR(16) NOT NULL,
      record_no VARCHAR(32) NULL,
      scope VARCHAR(64) NULL,
      status VARCHAR(64) NULL,
      query_code VARCHAR(32) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_issue_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  for (const issueColSql of [
    "ALTER TABLE tax_issue_applications ADD COLUMN qr_image_url VARCHAR(512) NULL COMMENT '自定义二维码图片'",
    "ALTER TABLE tax_issue_applications ADD COLUMN qr_block_image_url VARCHAR(512) NULL COMMENT '二维码+验证码整块图'"
  ]) {
    try {
      await conn.execute(issueColSql);
    } catch (eIssueCol) {
      if (!eIssueCol || !/Duplicate column/i.test(String(eIssueCol.message || eIssueCol))) {
        console.warn('[schema] tax_issue_applications column', eIssueCol && eIssueCol.message);
      }
    }
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS sbdy_demo_certs (
      id BIGINT NOT NULL AUTO_INCREMENT,
      auth_code VARCHAR(32) NOT NULL COMMENT '演示核验授权码',
      token VARCHAR(64) NOT NULL COMMENT '展示页路径令牌',
      payload_json MEDIUMTEXT NOT NULL,
      created_by_admin VARCHAR(64) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_sbdy_auth (auth_code),
      UNIQUE KEY uk_sbdy_token (token),
      INDEX idx_sbdy_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS gjj_demo_certs (
      id BIGINT NOT NULL AUTO_INCREMENT,
      auth_code VARCHAR(32) NOT NULL COMMENT '演示核验授权码',
      token VARCHAR(64) NOT NULL COMMENT '展示页路径令牌',
      payload_json MEDIUMTEXT NOT NULL,
      created_by_admin VARCHAR(64) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_gjj_auth (auth_code),
      UNIQUE KEY uk_gjj_token (token),
      INDEX idx_gjj_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS user_rename_credits (
      id BIGINT NOT NULL AUTO_INCREMENT,
      username VARCHAR(255) NOT NULL,
      payment_order_id BIGINT NULL,
      out_trade_no VARCHAR(64) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      consumed_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_rename_credit_user_free (username, consumed_at),
      KEY idx_rename_credit_order (payment_order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      title VARCHAR(500),
      content TEXT,
      company_name VARCHAR(255),
      msg_date VARCHAR(50),
      is_read TINYINT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_msg_date (msg_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN account_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=已激活'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }
  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN banned TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=封禁'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }
  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN session_rev INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '登录会话版本，封禁递增使旧令牌失效'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN user_type TINYINT NOT NULL DEFAULT 0 COMMENT '0=普通 1=测试 2=游客沙盒'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }
  try {
    await conn.execute(`
      ALTER TABLE users MODIFY COLUMN user_type TINYINT NOT NULL DEFAULT 0 COMMENT '0=普通 1=测试 2=游客沙盒'
    `);
  } catch (e) {
    /* 已是目标类型或数据库不支持修改注释时忽略 */
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN plain_password VARCHAR(255) NULL COMMENT '原始密码明文'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN register_source_channel VARCHAR(32) NULL COMMENT '注册来源渠道'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }
  try {
    await conn.execute(`
      ALTER TABLE users MODIFY COLUMN register_source_channel VARCHAR(128) NULL COMMENT '注册来源渠道'
    `);
  } catch (e) {
    /* 列不存在或已是目标类型时忽略 */
  }
  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN activation_source_channel VARCHAR(32) NULL COMMENT '激活码渠道（如闲鱼）'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }
  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN sales_promo_channel VARCHAR(64) NULL COMMENT '代理推广渠道 ch'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }
  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN registered_from_install_guide TINYINT(1) NOT NULL DEFAULT 0 COMMENT '注册时上报来自安装页引流'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }
  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN registered_from_share TINYINT(1) NOT NULL DEFAULT 0 COMMENT '注册时上报来自分享链接（主站流量）'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS activation_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(64) NOT NULL,
      max_uses INT NOT NULL DEFAULT 1,
      used_count INT NOT NULL DEFAULT 0,
      expires_at DATETIME NULL,
      note VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_activation_code (code),
      INDEX idx_activation_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS payment_orders (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      out_trade_no VARCHAR(64) NOT NULL,
      username VARCHAR(255) NOT NULL,
      subject VARCHAR(128) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      alipay_trade_no VARCHAR(128) NULL,
      buyer_logon_id VARCHAR(128) NULL,
      activation_code_id INT NULL,
      paid_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_payment_orders_out_trade_no (out_trade_no),
      UNIQUE KEY uk_payment_orders_alipay_trade_no (alipay_trade_no),
      INDEX idx_payment_orders_username_status (username, status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS payment_notify_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      out_trade_no VARCHAR(64) NOT NULL,
      alipay_trade_no VARCHAR(128) NULL,
      payload_hash CHAR(64) NOT NULL,
      trade_status VARCHAR(32) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_payment_notify_payload_hash (payload_hash),
      INDEX idx_payment_notify_out_trade_no (out_trade_no)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await conn.execute(`
      ALTER TABLE activation_codes ADD COLUMN last_used_at DATETIME NULL COMMENT '最近一次使用时间'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE activation_codes ADD COLUMN used_by_username VARCHAR(255) NULL COMMENT '使用该激活码的用户账号'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE activation_codes ADD COLUMN owner_admin_username VARCHAR(255) NULL COMMENT '生成该激活码的管理账号'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  /* 历史：支付宝自动发卡、酷发卡批量码未写归属时，归到超级管理员 admin */
  try {
    await conn.execute(
      `UPDATE activation_codes
       SET owner_admin_username = ?
       WHERE (owner_admin_username IS NULL OR TRIM(owner_admin_username) = '')
         AND (
           note LIKE '%支付宝%'
           OR note LIKE '%酷发卡%'
           OR note LIKE '%kufaka%'
         )`,
      [ADMIN_PANEL_USER]
    );
    await conn.execute(
      `UPDATE activation_codes ac
       INNER JOIN users u ON u.username = ac.used_by_username
       SET ac.owner_admin_username = ?
       WHERE (ac.owner_admin_username IS NULL OR TRIM(ac.owner_admin_username) = '')
         AND u.activation_source_channel IN ('alipay', 'kufaka')`,
      [ADMIN_PANEL_USER]
    );
  } catch (eBackfill) {
    console.warn('activation_codes owner backfill', eBackfill && eBackfill.message);
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS admin_accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      full_name VARCHAR(255) NULL COMMENT '管理后台账号姓名',
      salt VARCHAR(255) NOT NULL,
      hash VARCHAR(255) NOT NULL,
      is_super TINYINT(1) NOT NULL DEFAULT 0,
      banned TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_admin_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await conn.execute(`
      ALTER TABLE admin_accounts ADD COLUMN full_name VARCHAR(255) NULL COMMENT '管理后台账号姓名'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS admin_account_menus (
      admin_id INT NOT NULL,
      menu_key VARCHAR(64) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (admin_id, menu_key),
      INDEX idx_menu_key (menu_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  var profileCols = [
    "ALTER TABLE users ADD COLUMN id_type VARCHAR(64) NULL COMMENT '证件类型'",
    "ALTER TABLE users ADD COLUMN birth_date VARCHAR(32) NULL COMMENT '出生日期'",
    "ALTER TABLE users ADD COLUMN nationality VARCHAR(128) NULL COMMENT '国籍'",
    "ALTER TABLE users ADD COLUMN huji_area VARCHAR(255) NULL COMMENT '户籍所在地区'",
    "ALTER TABLE users ADD COLUMN huji_detail VARCHAR(512) NULL COMMENT '户籍详细地址'",
    "ALTER TABLE users ADD COLUMN living_area VARCHAR(255) NULL COMMENT '经常居住地地区'",
    "ALTER TABLE users ADD COLUMN living_detail VARCHAR(512) NULL COMMENT '经常居住地详细'",
    "ALTER TABLE users ADD COLUMN contact_area VARCHAR(255) NULL COMMENT '联系地址地区'",
    "ALTER TABLE users ADD COLUMN contact_detail VARCHAR(512) NULL COMMENT '联系地址详细'",
    "ALTER TABLE users ADD COLUMN education VARCHAR(64) NULL COMMENT '学历'",
    "ALTER TABLE users ADD COLUMN ethnicity VARCHAR(64) NULL COMMENT '民族'",
    "ALTER TABLE users ADD COLUMN email VARCHAR(255) NULL COMMENT '电子邮箱'"
  ];
  for (var pi = 0; pi < profileCols.length; pi++) {
    try {
      await conn.execute(profileCols[pi]);
    } catch (e) {
      if (e.errno !== 1060) {
        throw e;
      }
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN last_login_city VARCHAR(255) NULL COMMENT '最近登录城市(根据IP推断)'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  var registerSalaryCols = [
    "ALTER TABLE users ADD COLUMN register_salary_months_json TEXT NULL COMMENT '注册时填写的近6个月工资 JSON 数组'",
    'ALTER TABLE users ADD COLUMN register_avg_salary_6m DECIMAL(12,2) NULL COMMENT \'注册时近6个月平均工资（按已填月份计算）\''
  ];
  for (var rsi = 0; rsi < registerSalaryCols.length; rsi++) {
    try {
      await conn.execute(registerSalaryCols[rsi]);
    } catch (e) {
      if (e.errno !== 1060) {
        throw e;
      }
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN list_hidden_at DATETIME NULL COMMENT '从注册用户列表隐藏时间（软删除）'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN list_hidden_by VARCHAR(255) NULL COMMENT '执行列表隐藏的管理员'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN activation_refunded_at DATETIME NULL COMMENT '激活退款时间，不计入用户数据与激活统计'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  try {
    await conn.execute(`
      ALTER TABLE users ADD COLUMN activation_refunded_by VARCHAR(255) NULL COMMENT '执行激活退款的管理员'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  var guestMergeUserCols = [
    "ALTER TABLE users ADD COLUMN guest_merged_to VARCHAR(255) NULL COMMENT '游客账号合并到的正式账号'",
    "ALTER TABLE users ADD COLUMN merged_from_guest VARCHAR(255) NULL COMMENT '正式账号来源的游客账号'",
    'ALTER TABLE users ADD COLUMN guest_merged_at DATETIME(3) NULL COMMENT \'游客数据合并时间\''
  ];
  for (var gmi = 0; gmi < guestMergeUserCols.length; gmi++) {
    try {
      await conn.execute(guestMergeUserCols[gmi]);
    } catch (eGuestCol) {
      if (eGuestCol.errno !== 1060) {
        throw eGuestCol;
      }
    }
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
      setting_value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await conn.execute(
    `INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`,
    [SETTING_KEY_TEST_COMPANY, TEST_ACCOUNT_COMPANY_NAME_DEFAULT]
  );
  await conn.execute(
    `INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`,
    [SETTING_KEY_MINE_UI, JSON.stringify(cloneMineUiDefaults())]
  );
  await conn.execute(
    `INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`,
    [SETTING_KEY_ANDROID_APK, 'https://wwalr.lanzoul.com/iWD5L3nszo5e']
  );
  await conn.execute(
    `INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`,
    [SETTING_KEY_IOS_MOBILECONFIG, '/personal.mobileconfig']
  );
  await conn.execute(`INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`, [
    SETTING_KEY_WECHAT_PAY_QRCODE,
    ''
  ]);
  await conn.execute(`INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`, [
    SETTING_KEY_QQ_ADD_URL,
    ''
  ]);
  await conn.execute(`INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`, [
    SETTING_KEY_QQ_GROUP_URL,
    ''
  ]);
  await conn.execute(`INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`, [
    SETTING_KEY_CONVERSION_AB,
    JSON.stringify(DEFAULT_CONVERSION_AB)
  ]);
  await conn.execute(`INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`, [
    SETTING_KEY_LANDING_AB,
    JSON.stringify(DEFAULT_LANDING_AB)
  ]);
  await conn.execute(`INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES (?, ?)`, [
    SETTING_KEY_SALES_AGENT,
    JSON.stringify(DEFAULT_SALES_AGENT)
  ]);
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS analytics_api_daily (
      stat_date DATE NOT NULL,
      route_key VARCHAR(240) NOT NULL,
      biz_category VARCHAR(64) NOT NULL,
      cnt BIGINT UNSIGNED NOT NULL DEFAULT 0,
      sum_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
      max_ms INT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (stat_date, route_key),
      INDEX idx_cat_date (biz_category, stat_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  try {
    await conn.execute(`
      ALTER TABLE analytics_api_daily ADD COLUMN sum_ms BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '响应耗时合计(ms)'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }
  try {
    await conn.execute(`
      ALTER TABLE analytics_api_daily ADD COLUMN max_ms INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '单日最大响应(ms)'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS api_slow_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(16) NOT NULL DEFAULT 'server' COMMENT 'server|client',
      route_key VARCHAR(240) NOT NULL,
      biz_category VARCHAR(64) NULL,
      net_ms INT UNSIGNED NOT NULL DEFAULT 0,
      render_ms INT UNSIGNED NOT NULL DEFAULT 0,
      total_ms INT UNSIGNED NOT NULL DEFAULT 0,
      item_count INT UNSIGNED NULL,
      username VARCHAR(255) NULL,
      client_id VARCHAR(128) NULL,
      page_path VARCHAR(255) NULL,
      viewport VARCHAR(64) NULL,
      net_type VARCHAR(32) NULL,
      http_status SMALLINT UNSIGNED NULL,
      ip VARCHAR(128) NULL,
      user_agent VARCHAR(512) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_slow_created (created_at),
      INDEX idx_slow_route_created (route_key, created_at),
      INDEX idx_slow_total (total_ms),
      INDEX idx_slow_client (client_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS api_error_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      route_key VARCHAR(240) NOT NULL,
      biz_category VARCHAR(64) NULL,
      http_status SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      biz_code INT NULL COMMENT '业务 JSON code，如 500',
      latency_ms INT UNSIGNED NOT NULL DEFAULT 0,
      username VARCHAR(255) NULL,
      client_id VARCHAR(128) NULL,
      page_path VARCHAR(255) NULL,
      ip VARCHAR(128) NULL,
      user_agent VARCHAR(512) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_err_created (created_at),
      INDEX idx_err_route_created (route_key, created_at),
      INDEX idx_err_http (http_status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS user_daily_activity (
      activity_date DATE NOT NULL,
      username VARCHAR(255) NOT NULL,
      PRIMARY KEY (activity_date, username),
      INDEX idx_u_d (username, activity_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await registerGuard.ensureRegisterGuardTables(conn);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS user_login_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      ok TINYINT(1) NOT NULL DEFAULT 1,
      reason VARCHAR(120) NULL,
      reason_detail VARCHAR(255) NULL COMMENT '失败时的原始错误信息',
      ip VARCHAR(128) NULL,
      city VARCHAR(255) NULL,
      user_agent VARCHAR(512) NULL,
      device_fp CHAR(64) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_created (created_at),
      INDEX idx_u_created (username, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  try {
    await conn.execute(`
      ALTER TABLE user_login_events ADD COLUMN reason VARCHAR(120) NULL COMMENT '登录结果原因'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }
  try {
    await conn.execute(`
      ALTER TABLE user_login_events ADD COLUMN reason_detail VARCHAR(255) NULL COMMENT '失败时的原始错误信息'
    `);
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS blocked_ips (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      ip VARCHAR(128) NOT NULL,
      blocked_by VARCHAR(255) NOT NULL,
      reason VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_ip (ip)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS admin_login_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      admin_username VARCHAR(255) NOT NULL,
      ok TINYINT(1) NOT NULL DEFAULT 1,
      reason VARCHAR(255) NULL,
      ip VARCHAR(128) NULL,
      city VARCHAR(255) NULL,
      user_agent VARCHAR(512) NULL,
      device_fp CHAR(64) NOT NULL,
      device_desc VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_admin_login_created (created_at),
      INDEX idx_admin_login_user_created (admin_username, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS admin_operation_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      admin_username VARCHAR(255) NOT NULL,
      admin_full_name VARCHAR(255) NULL,
      method VARCHAR(16) NOT NULL,
      path VARCHAR(255) NOT NULL,
      route_key VARCHAR(240) NULL,
      action VARCHAR(120) NULL,
      target_username VARCHAR(255) NULL,
      request_brief VARCHAR(1024) NULL,
      ip VARCHAR(128) NULL,
      city VARCHAR(255) NULL,
      user_agent VARCHAR(512) NULL,
      device_fp CHAR(64) NOT NULL,
      device_desc VARCHAR(255) NULL,
      status_code INT NOT NULL DEFAULT 0,
      biz_result_code INT NULL,
      ok TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_admin_op_created (created_at),
      INDEX idx_admin_op_user_created (admin_username, created_at),
      INDEX idx_admin_op_path_created (path, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS user_feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL COMMENT '账号 username',
      real_name_snapshot VARCHAR(255) NULL,
      feedback_type VARCHAR(32) NOT NULL COMMENT 'bug | suggestion',
      content TEXT NOT NULL,
      admin_reply TEXT NULL,
      replied_at DATETIME NULL,
      replied_by VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL COMMENT '账号 username',
      real_name_snapshot VARCHAR(255) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'open' COMMENT 'open | closed',
      last_message_at DATETIME NULL,
      last_message_preview VARCHAR(255) NULL,
      last_sender_role VARCHAR(16) NULL COMMENT 'user | admin | system',
      user_unread INT NOT NULL DEFAULT 0,
      admin_unread INT NOT NULL DEFAULT 0,
      bot_paused TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=人工介入后暂停AI',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_chat_user_id (user_id),
      INDEX idx_chat_last_message_at (last_message_at),
      INDEX idx_chat_admin_unread (admin_unread)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  try {
    await conn.execute(
      `ALTER TABLE chat_conversations ADD COLUMN bot_paused TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=人工介入后暂停AI' AFTER admin_unread`
    );
  } catch (e) {
    if (!(e && (e.code === 'ER_DUP_FIELDNAME' || e.errno === 1060))) {
      console.warn('chat_conversations.bot_paused alter', e && e.message);
    }
  }

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      conversation_id INT NOT NULL,
      sender_role VARCHAR(16) NOT NULL COMMENT 'user | admin | system',
      sender_id VARCHAR(255) NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_chat_msg_conv (conversation_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS user_devices (
      username VARCHAR(255) NOT NULL,
      device_fp CHAR(64) NOT NULL,
      user_agent_short VARCHAR(512) NULL,
      ip_last VARCHAR(128) NULL,
      city_last VARCHAR(255) NULL,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      login_count INT UNSIGNED NOT NULL DEFAULT 0,
      client_id VARCHAR(128) NULL COMMENT '客户端上报唯一 id',
      device_detail_json MEDIUMTEXT NULL COMMENT '最近一次显式上报 JSON',
      api_sync_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '携带设备 JSON 的接口同步次数',
      PRIMARY KEY (username, device_fp),
      INDEX idx_last_seen (last_seen),
      INDEX idx_client_id (username, client_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS user_page_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      page_path VARCHAR(255) NOT NULL,
      route_key VARCHAR(240) NOT NULL,
      client_id VARCHAR(128) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_created (username, created_at),
      INDEX idx_page_created (page_path, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS install_guide_track_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      client_id VARCHAR(128) NULL,
      device_fp CHAR(64) NULL,
      event_key VARCHAR(80) NOT NULL,
      dwell_seconds INT UNSIGNED NULL,
      meta_json VARCHAR(1024) NULL,
      ip VARCHAR(128) NULL,
      user_agent VARCHAR(512) NULL,
      created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_created (created_at),
      INDEX idx_event_created (event_key, created_at),
      INDEX idx_client_created (client_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS ad_page_track_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) NULL,
      client_id VARCHAR(128) NULL,
      device_fp CHAR(64) NULL,
      event_key VARCHAR(80) NOT NULL,
      dwell_seconds INT UNSIGNED NULL,
      meta_json VARCHAR(1024) NULL,
      ip VARCHAR(128) NULL,
      user_agent VARCHAR(512) NULL,
      created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_created (created_at),
      INDEX idx_event_created (event_key, created_at),
      INDEX idx_user_created (username, created_at),
      INDEX idx_client_created (client_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await conn.execute(`
    CREATE TABLE IF NOT EXISTS sales_channel_attributions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      sales_ch VARCHAR(64) NOT NULL,
      client_id VARCHAR(128) NULL,
      device_fp CHAR(64) NULL,
      ip VARCHAR(128) NULL,
      user_agent VARCHAR(512) NULL,
      device_model VARCHAR(128) NULL,
      source_page VARCHAR(128) NULL,
      created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
      expires_at DATETIME(3) NOT NULL,
      INDEX idx_sc_client_exp (client_id, expires_at),
      INDEX idx_sc_fp_exp (device_fp, expires_at),
      INDEX idx_sc_ip_model_exp (ip, device_model, expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  var devCols = [
    "ALTER TABLE user_devices ADD COLUMN client_id VARCHAR(128) NULL COMMENT '客户端上报唯一 id'",
    'ALTER TABLE user_devices ADD COLUMN device_detail_json MEDIUMTEXT NULL COMMENT \'最近一次显式上报 JSON\'',
    "ALTER TABLE user_devices ADD COLUMN api_sync_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '携带设备 JSON 的接口同步次数'"
  ];
  for (var di = 0; di < devCols.length; di++) {
    try {
      await conn.execute(devCols[di]);
    } catch (e) {
      if (e.errno !== 1060) {
        throw e;
      }
    }
  }
  try {
    await conn.execute('CREATE INDEX idx_client_id ON user_devices (username, client_id)');
  } catch (e) {
    /* 已存在或非致命 */
  }

  try {
    await conn.execute(
      "ALTER TABLE tax_records ADD COLUMN deleted_at DATETIME(3) NULL COMMENT '软删除时间，非空表示在回收站'"
    );
  } catch (e) {
    if (e.errno !== 1060) {
      throw e;
    }
  }
  try {
    await conn.execute('CREATE INDEX idx_tax_user_deleted ON tax_records (user_id, deleted_at)');
  } catch (e) {
    /* 已存在或非致命 */
  }
  try {
    await conn.execute(
      'CREATE INDEX idx_tax_user_deleted_year_month ON tax_records (user_id, deleted_at, year, month)'
    );
  } catch (e) {
    /* 已存在或非致命 */
  }
  try {
    await conn.execute(
      'CREATE INDEX idx_messages_user_date ON messages (user_id, msg_date, created_at)'
    );
  } catch (e) {
    /* 已存在或非致命 */
  }

  var rootAdmin = String(ADMIN_PANEL_USER || 'admin').trim() || 'admin';
  var rootPassword = String(ADMIN_PANEL_PASSWORD || '').trim() || '640810';
  var rootFullName = String(ADMIN_PANEL_FULL_NAME || '系统管理员').trim() || '系统管理员';
  var rootSalt = crypto.randomBytes(16);
  var rootSaltHex = rootSalt.toString('hex');
  var rootHash = hashPasswordWithSalt(rootPassword, rootSalt);
  const [adminRows] = await conn.execute(
    'SELECT id, salt, hash, full_name FROM admin_accounts WHERE username = ? LIMIT 1',
    [rootAdmin]
  );
  var rootAdminId = 0;
  if (!adminRows.length) {
    /* 不再把保留账号 admin 改名为环境变量用户名；admin 为普通管理员，超管仅根账号 */
    const [insRoot] = await conn.execute(
      'INSERT INTO admin_accounts (username, full_name, salt, hash, is_super, banned) VALUES (?, ?, ?, ?, 1, 0)',
      [rootAdmin, rootFullName, rootSaltHex, rootHash]
    );
    rootAdminId = insRoot.insertId ? Number(insRoot.insertId) : 0;
  } else {
    rootAdminId = Number(adminRows[0].id) || 0;
    var keepHash = verifyPasswordBySaltHash(rootPassword, adminRows[0].salt, adminRows[0].hash);
    if (!keepHash) {
      await conn.execute(
        'UPDATE admin_accounts SET full_name = ?, salt = ?, hash = ?, is_super = 1, banned = 0 WHERE id = ?',
        [rootFullName, rootSaltHex, rootHash, rootAdminId]
      );
    } else {
      await conn.execute(
        'UPDATE admin_accounts SET full_name = ?, is_super = 1, banned = 0 WHERE id = ?',
        [rootFullName, rootAdminId]
      );
    }
  }
  if (rootAdminId > 0) {
    await conn.execute('DELETE FROM admin_account_menus WHERE admin_id = ?', [rootAdminId]);
    for (var mi = 0; mi < ADMIN_MENU_KEYS.length; mi++) {
      await conn.execute(
        'INSERT INTO admin_account_menus (admin_id, menu_key) VALUES (?, ?)',
        [rootAdminId, ADMIN_MENU_KEYS[mi]]
      );
    }
  }

  /* 仅环境变量根账号为超级管理员；其余账号一律降为普通管理员 */
  await conn.execute(
    'UPDATE admin_accounts SET is_super = 0 WHERE username <> ? AND is_super = 1',
    [rootAdmin]
  );

  /* 保留账号 admin：普通管理员；无菜单时写入默认可分配菜单（不含超管专属） */
  if (rootAdmin.toLowerCase() !== 'admin') {
    const [namedAdminRows] = await conn.execute(
      "SELECT id FROM admin_accounts WHERE username = 'admin' LIMIT 1"
    );
    if (namedAdminRows.length) {
      var namedAdminId = Number(namedAdminRows[0].id) || 0;
      if (namedAdminId > 0) {
        await conn.execute(
          'UPDATE admin_accounts SET is_super = 0, banned = 0 WHERE id = ?',
          [namedAdminId]
        );
        const [namedMenuCnt] = await conn.execute(
          'SELECT COUNT(*) AS c FROM admin_account_menus WHERE admin_id = ?',
          [namedAdminId]
        );
        var namedMenus = namedMenuCnt.length ? Number(namedMenuCnt[0].c) || 0 : 0;
        if (namedMenus <= 0) {
          var subAdminMenus = adminMenuRegistry
            .getAssignableMenuDefs()
            .filter(function (d) {
              return d && d.key && !d.super_only && d.key !== 'admin-accounts';
            })
            .map(function (d) {
              return String(d.key);
            });
          for (var sami = 0; sami < subAdminMenus.length; sami++) {
            await conn.execute(
              'INSERT INTO admin_account_menus (admin_id, menu_key) VALUES (?, ?)',
              [namedAdminId, subAdminMenus[sami]]
            );
          }
        } else {
          /* 去掉超管专属菜单键，避免子账号侧栏残留无效入口 */
          await conn.execute(
            "DELETE FROM admin_account_menus WHERE admin_id = ? AND menu_key IN ('guest-users', 'admin-accounts')",
            [namedAdminId]
          );
        }
      }
    }
  }

  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT admin_id, 'activated-user-analysis' FROM admin_account_menus WHERE menu_key = 'user-data'`
  );

  /* 清理已下线的数据分析 / 用户反馈 / 在线客服菜单权限（勿加现行菜单键：analytics-activity / analytics-devices 仍在用） */
  await conn.execute(
    `DELETE FROM admin_account_menus WHERE menu_key IN (
      'user-behavior', 'api-analytics', 'feedback', 'chat', 'share-stats'
    )`
  );

  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT admin_id, 'guest-users' FROM admin_account_menus WHERE menu_key = 'users'`
  );

  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT admin_id, 'install-guide-stats' FROM admin_account_menus WHERE menu_key = 'analytics'`
  );

  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT admin_id, 'tax-records-edit' FROM admin_account_menus
     WHERE menu_key IN ('users', 'user-data')`
  );

  var analyticsSplitMenus = ['analytics-conversion', 'analytics-purchase'];
  for (var asi = 0; asi < analyticsSplitMenus.length; asi++) {
    await conn.execute(
      `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
       SELECT admin_id, ? FROM admin_account_menus WHERE menu_key = 'analytics'`,
      [analyticsSplitMenus[asi]]
    );
  }

  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT admin_id, 'analytics-purchase' FROM admin_account_menus
     WHERE menu_key IN ('analytics-conversion', 'analytics-tracking', 'analytics')`
  );

  await conn.execute(`DELETE FROM admin_account_menus WHERE menu_key = 'analytics-tracking'`);

  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT admin_id, 'install-guide-stats' FROM admin_account_menus
     WHERE menu_key = 'analytics-register'`
  );

  await conn.execute(`DELETE FROM admin_account_menus WHERE menu_key = 'analytics-register'`);

  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT admin_id, 'sbdy-demo' FROM admin_account_menus WHERE menu_key = 'codes'`
  );

  await conn.execute(
    `DELETE FROM admin_account_menus WHERE menu_key = 'weekly-codes'`
  );

  /* 工资流水：已有证明工具权限的账号自动开通 */
  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT DISTINCT admin_id, 'ccb-flow' FROM admin_account_menus
     WHERE menu_key IN ('ylbx-ps', 'lizhi-cert', 'zaizhi-cert', 'sbdy-demo', 'najilu-qr')`
  );

  /* 在职证明：已有离职证明权限的账号自动开通 */
  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT DISTINCT admin_id, 'zaizhi-cert' FROM admin_account_menus
     WHERE menu_key = 'lizhi-cert'`
  );

  /* 下线管理员：现有子管理员自动开通，便于发展下线并查看其数据 */
  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT id, 'downline-admins' FROM admin_accounts WHERE is_super = 0`
  );

  await conn.execute(
    `DELETE FROM admin_account_menus WHERE menu_key = 'sales-contacts'`
  );

  /* 指定运营账号：注册用户列表 + 用户数据全量可见（名单见 fullUserScope.js） */
  var fullScopeIn = fullUserScopeUsernameSqlIn();
  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT id, 'users' FROM admin_accounts WHERE username IN (` +
      fullScopeIn +
      `)`
  );
  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT id, 'user-data' FROM admin_accounts WHERE username IN (` +
      fullScopeIn +
      `)`
  );
  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT id, 'tax-records-edit' FROM admin_accounts WHERE username IN (` +
      fullScopeIn +
      `)`
  );

  /* 侧栏子页独立授权：原挂在「注册用户 / 管理登录」下的入口补权，避免已有账号丢菜单 */
  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT DISTINCT admin_id, 'rename-tax-daily' FROM admin_account_menus WHERE menu_key IN ('users', 'peer-accounts')`
  );
  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT DISTINCT admin_id, 'users-deleted' FROM admin_account_menus WHERE menu_key = 'users'`
  );
  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT DISTINCT admin_id, 'user-login-log' FROM admin_account_menus WHERE menu_key = 'login-log'`
  );

  /* C 档 hub 合并：旧子页权限回填到侧栏 hub key，避免丢入口 */
  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT DISTINCT admin_id, 'settings' FROM admin_account_menus
     WHERE menu_key IN ('install-guide', 'appearance')`
  );
  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT DISTINCT admin_id, 'lizhi-cert' FROM admin_account_menus WHERE menu_key = 'zaizhi-cert'`
  );
  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT DISTINCT admin_id, 'sbdy-demo' FROM admin_account_menus WHERE menu_key = 'gjj-demo'`
  );
  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT DISTINCT admin_id, 'login-log' FROM admin_account_menus WHERE menu_key = 'user-login-log'`
  );
  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT DISTINCT admin_id, 'insights-product' FROM admin_account_menus
     WHERE menu_key IN ('analytics-activity', 'analytics-devices', 'tax-fill-survey')`
  );
  await conn.execute(
    `INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
     SELECT DISTINCT admin_id, 'insights-growth' FROM admin_account_menus
     WHERE menu_key IN ('channel-analysis', 'install-guide-stats')`
  );

  conn.release();
}

/** 用户可见的税务记录（未在回收站） */
const TAX_RECORD_NOT_DELETED_SQL = 'deleted_at IS NULL';

/** 规范化收入类型展示名 */
function normalizeIncomeTypeLabel(t) {
  var s = t != null ? String(t).trim() : '';
  if (s.endsWith('所得')) {
    s = s.slice(0, -2);
  }
  return s;
}

/** 查询用户税务记录列表 */
async function getRecords(userId, year, incomeTypes) {
  var cacheKey =
    String(userId) +
    '\0' +
    (year != null && year !== '' ? String(year) : '') +
    '\0' +
    (incomeTypes && incomeTypes.length ? incomeTypes.map(String).sort().join(',') : '');
  var now = Date.now();
  var cached = _taxRecordsListCache.get(cacheKey);
  if (cached && now - cached.t < TAX_RECORDS_LIST_CACHE_MS) {
    return cached.v;
  }

  const conn = await pool.getConnection();
  /* 列表场景不需要 SELECT *，减少传输与解析开销 */
  var listCols =
    'id, year, month, income_type, income_subtype, company_name, company_tax_id, tax_authority, ' +
    'report_channel, report_date, tax_period, income, tax_reported, income_this_period, tax_free_income, ' +
    'deduction_fee, special_deduction, other_deduction, donation_deduction, ' +
    'pension_insurance, medical_insurance, unemployment_insurance, housing_fund, created_at, updated_at';
  let query =
    'SELECT ' + listCols + ' FROM tax_records WHERE user_id = ? AND ' + TAX_RECORD_NOT_DELETED_SQL;
  const params = [userId];

  if (year != null && year !== '') {
    query += ' AND year = ?';
    params.push(parseInt(year, 10));
  }

  if (incomeTypes && incomeTypes.length) {
    var normalized = [];
    var seenType = {};
    incomeTypes.forEach(function (t) {
      var n = normalizeIncomeTypeLabel(t);
      if (!n || seenType[n]) return;
      seenType[n] = true;
      normalized.push(n);
    });
    if (normalized.length) {
      var ph = normalized
        .map(function () {
          return '?';
        })
        .join(',');
      /* 兼容「工资薪金」与「工资薪金所得」两种存法 */
      query +=
        ' AND REPLACE(TRIM(IFNULL(income_type,\'\')), \'所得\', \'\') IN (' + ph + ')';
      for (var ti = 0; ti < normalized.length; ti++) {
        params.push(normalized[ti]);
      }
    }
  }

  query +=
    ' ORDER BY year DESC, month DESC, (CASE WHEN TRIM(IFNULL(income_subtype,\'\')) = \'全年一次性奖金收入\' THEN 1 ELSE 0 END) ASC, id ASC';

  const [rows] = await conn.execute(query, params);
  conn.release();

  var filtered = rows;

  let income = 0;
  let tax = 0;
  filtered.forEach(function (r) {
    income += parseFloat(r.income) || 0;
    tax += parseFloat(r.tax_reported) || 0;
  });

  var out = {
    income_total: income.toFixed(2),
    tax_total: tax.toFixed(2),
    records: filtered
  };
  _taxRecordsListCache.set(cacheKey, { v: out, t: now });
  if (_taxRecordsListCache.size > 800) {
    _taxRecordsListCache.clear();
  }
  return out;
}

var TAX_CHANGE_LOG_FIELDS = [
  { key: 'tax_period', label: '税款所属期' },
  { key: 'year', label: '年' },
  { key: 'month', label: '月' },
  { key: 'income_type', label: '所得项目' },
  { key: 'income_subtype', label: '所得小类' },
  { key: 'company_name', label: '扣缴义务人' },
  { key: 'company_tax_id', label: '扣缴义务人纳税人识别号' },
  { key: 'tax_authority', label: '主管税务机关' },
  { key: 'report_channel', label: '申报渠道' },
  { key: 'report_date', label: '申报日期' },
  { key: 'income', label: '收入' },
  { key: 'tax_reported', label: '已申报税额' },
  { key: 'income_this_period', label: '本期收入' },
  { key: 'tax_free_income', label: '本期免税收入' },
  { key: 'deduction_fee', label: '本期减除费用' },
  { key: 'special_deduction', label: '本期专项扣除' },
  { key: 'pension_insurance', label: '基本养老保险' },
  { key: 'medical_insurance', label: '基本医疗保险' },
  { key: 'unemployment_insurance', label: '失业保险' },
  { key: 'housing_fund', label: '住房公积金' },
  { key: 'other_deduction', label: '专项附加扣除' },
  { key: 'donation_deduction', label: '捐赠扣除' }
];

var ADMIN_TAX_RECORD_SELECT_SQL =
  'SELECT id, year, month, income_type, income_subtype, company_name, company_tax_id, tax_authority, ' +
  'report_channel, report_date, tax_period, income, tax_reported, income_this_period, tax_free_income, ' +
  'deduction_fee, special_deduction, other_deduction, donation_deduction, ' +
  'pension_insurance, medical_insurance, unemployment_insurance, housing_fund, created_at, updated_at ' +
  'FROM tax_records';

/** 将税务记录行映射为管理端结构 */
function mapTaxRecordRowForAdmin(r) {
  if (!r) {
    return null;
  }
  function dec(v) {
    if (v == null || v === '') {
      return '0.00';
    }
    var n = parseFloat(v);
    return isNaN(n) ? String(v) : n.toFixed(2);
  }
  function str(v) {
    return v != null ? String(v) : '';
  }
  return {
    id: str(r.id),
    year: r.year != null ? Number(r.year) : null,
    month: r.month != null ? Number(r.month) : null,
    tax_period: str(r.tax_period),
    income_type: str(r.income_type),
    income_subtype: str(r.income_subtype),
    company_name: str(r.company_name),
    company_tax_id: str(r.company_tax_id),
    tax_authority: str(r.tax_authority),
    report_channel: str(r.report_channel) || '其他',
    report_date: str(r.report_date),
    income: dec(r.income),
    tax_reported: dec(r.tax_reported),
    income_this_period: dec(r.income_this_period),
    tax_free_income: dec(r.tax_free_income),
    deduction_fee: dec(r.deduction_fee),
    special_deduction: dec(r.special_deduction),
    other_deduction: dec(r.other_deduction),
    donation_deduction: dec(r.donation_deduction),
    pension_insurance: dec(r.pension_insurance),
    medical_insurance: dec(r.medical_insurance),
    unemployment_insurance: dec(r.unemployment_insurance),
    housing_fund: dec(r.housing_fund),
    created_at: r.created_at ? r.created_at.toISOString() : '',
    updated_at: r.updated_at ? r.updated_at.toISOString() : ''
  };
}

/** 将税务记录载荷转为变更快照 */
function taxRecordPayloadToSnapshot(record, recordId) {
  var r = record || {};
  var y = r.year != null ? Number(r.year) : null;
  var m = r.month != null ? Number(r.month) : null;
  var period =
    r.tax_period != null && String(r.tax_period).trim() !== ''
      ? String(r.tax_period).trim()
      : y != null && m != null
        ? y + '-' + String(m).padStart(2, '0')
        : '';
  return {
    id: recordId != null ? String(recordId) : r.id != null ? String(r.id) : '',
    tax_period: period,
    year: y,
    month: m,
    income_type: r.income_type != null ? String(r.income_type) : '',
    income_subtype: r.income_subtype != null ? String(r.income_subtype) : '',
    company_name: r.company_name != null ? String(r.company_name) : '',
    company_tax_id: r.company_tax_id != null ? String(r.company_tax_id) : '',
    tax_authority: r.tax_authority != null ? String(r.tax_authority) : '',
    report_channel: r.report_channel != null ? String(r.report_channel) : '',
    report_date: r.report_date != null ? String(r.report_date) : '',
    income: r.income != null ? String(r.income) : '0',
    tax_reported: r.tax_reported != null ? String(r.tax_reported) : '0',
    income_this_period: r.income_this_period != null ? String(r.income_this_period) : '0',
    tax_free_income: r.tax_free_income != null ? String(r.tax_free_income) : '0',
    deduction_fee: r.deduction_fee != null ? String(r.deduction_fee) : '0',
    special_deduction: r.special_deduction != null ? String(r.special_deduction) : '0',
    other_deduction: r.other_deduction != null ? String(r.other_deduction) : '0',
    donation_deduction: r.donation_deduction != null ? String(r.donation_deduction) : '0',
    pension_insurance: r.pension_insurance != null ? String(r.pension_insurance) : '0',
    medical_insurance: r.medical_insurance != null ? String(r.medical_insurance) : '0',
    unemployment_insurance: r.unemployment_insurance != null ? String(r.unemployment_insurance) : '0',
    housing_fund: r.housing_fund != null ? String(r.housing_fund) : '0'
  };
}

/** 将税务记录行转为变更快照 */
function taxRecordRowToSnapshot(row) {
  if (!row) {
    return null;
  }
  return taxRecordPayloadToSnapshot(row, row.id);
}

/** 对比前后快照生成字段差异 */
function buildTaxChangeFieldDiffs(beforeSnap, afterSnap) {
  var diffs = [];
  TAX_CHANGE_LOG_FIELDS.forEach(function (f) {
    var b = beforeSnap && beforeSnap[f.key] != null ? String(beforeSnap[f.key]) : '';
    var a = afterSnap && afterSnap[f.key] != null ? String(afterSnap[f.key]) : '';
    if (b === a) {
      return;
    }
    diffs.push({
      field: f.key,
      label: f.label,
      before: b,
      after: a
    });
  });
  return diffs;
}

/** 写入税务记录变更审计日志 */
async function insertTaxChangeLog(conn, userId, recordId, action, beforeSnap, afterSnap) {
  try {
    await conn.execute(
      'INSERT INTO tax_record_change_logs (user_id, record_id, action, before_json, after_json) VALUES (?, ?, ?, ?, ?)',
      [
        String(userId),
        String(recordId),
        String(action),
        beforeSnap ? JSON.stringify(beforeSnap) : null,
        afterSnap ? JSON.stringify(afterSnap) : null
      ]
    );
  } catch (e) {
    console.error('insertTaxChangeLog', e);
  }
}

/** 将 undefined 转为 null，避免 mysql2 绑定报错 */
function sqlBindNull(v) {
  return v === undefined ? null : v;
}

/** 将税务数值规范化为可绑定数字或 null */
function taxSqlNumber(v) {
  if (v === undefined || v === null || v === '') return null;
  var n = Number(v);
  return isFinite(n) ? n : null;
}

/** 规范化税务记录，保证 SQL 绑定参数合法 */
function normalizeTaxRecordForSql(record) {
  var r = record && typeof record === 'object' ? record : {};
  return {
    id: r.id,
    year: taxSqlNumber(r.year),
    month: taxSqlNumber(r.month),
    income_type: r.income_type || '工资薪金',
    income_subtype: r.income_subtype || '正常工资薪金',
    company_name: sqlBindNull(r.company_name),
    company_tax_id: sqlBindNull(r.company_tax_id),
    tax_authority: sqlBindNull(r.tax_authority),
    report_channel: r.report_channel || '其他',
    report_date: sqlBindNull(r.report_date),
    tax_period: sqlBindNull(r.tax_period),
    income: taxSqlNumber(r.income),
    tax_reported: taxSqlNumber(r.tax_reported),
    income_this_period: taxSqlNumber(r.income_this_period),
    tax_free_income: taxSqlNumber(r.tax_free_income),
    deduction_fee: taxSqlNumber(r.deduction_fee),
    special_deduction: taxSqlNumber(r.special_deduction),
    other_deduction: taxSqlNumber(r.other_deduction),
    donation_deduction: taxSqlNumber(r.donation_deduction),
    pension_insurance: taxSqlNumber(r.pension_insurance),
    medical_insurance: taxSqlNumber(r.medical_insurance),
    unemployment_insurance: taxSqlNumber(r.unemployment_insurance),
    housing_fund: taxSqlNumber(r.housing_fund)
  };
}

/** 加载用户税务记录变更日志 */
async function loadTaxRecordChangesForUser(conn, username, dateStr) {
  var day = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : chinaDateKeyNow();
  const [rows] = await conn.execute(
    `SELECT id, record_id, action, before_json, after_json, changed_at
     FROM tax_record_change_logs
     WHERE user_id = ? AND DATE(changed_at) = ?
     ORDER BY changed_at DESC
     LIMIT 80`,
    [String(username), day]
  );
  return rows.map(function (r) {
    var beforeSnap = null;
    var afterSnap = null;
    try {
      if (r.before_json) {
        beforeSnap = typeof r.before_json === 'object' ? r.before_json : JSON.parse(String(r.before_json));
      }
    } catch (e1) {}
    try {
      if (r.after_json) {
        afterSnap = typeof r.after_json === 'object' ? r.after_json : JSON.parse(String(r.after_json));
      }
    } catch (e2) {}
    var action = r.action != null ? String(r.action) : 'update';
    return {
      id: Number(r.id),
      record_id: r.record_id != null ? String(r.record_id) : '',
      action: action,
      action_label: action === 'insert' ? '新增' : action === 'delete' ? '删除' : '修改',
      changed_at: r.changed_at ? r.changed_at.toISOString() : '',
      before: beforeSnap,
      after: afterSnap,
      field_diffs: buildTaxChangeFieldDiffs(beforeSnap, afterSnap)
    };
  });
}

/** 单条保存：变更审计日志异步写入（不占用主连接） */
function queueTaxChangeLogAsync(userId, recordId, action, beforeSnap, afterSnap) {
  setImmediate(function () {
    insertTaxChangeLog(pool, userId, recordId, action, beforeSnap, afterSnap).catch(function (e) {
      console.error('queueTaxChangeLogAsync', e);
    });
  });
}

/** 在指定连接中保存税务记录；opts.deferChangeLog 时返回 pendingChangeLog 供调用方异步落库 */
async function saveRecordInConn(conn, userId, record, opts) {
  opts = opts || {};
  var deferChangeLog = !!opts.deferChangeLog;
  record = normalizeTaxRecordForSql(record);
  var yearGate = Number(record.year);
  var monthGate = Number(record.month);
  if (!isFinite(yearGate) || yearGate < 2000 || yearGate > 2100) {
    var yearErr = new Error('年份无效（须为 2000–2100）');
    yearErr.code = 'TAX_YEAR_INVALID';
    throw yearErr;
  }
  if (!isFinite(monthGate) || monthGate < 1 || monthGate > 12) {
    var monthErr = new Error('月份无效');
    monthErr.code = 'TAX_MONTH_INVALID';
    throw monthErr;
  }
  const id = record.id != null ? String(record.id) : 'tr_' + Date.now();

  const [existing] = await conn.execute(
    `SELECT id, year, month, income_type, income_subtype,
            company_name, company_tax_id, tax_authority,
            report_channel, report_date, tax_period,
            income, tax_reported, income_this_period,
            tax_free_income, deduction_fee, special_deduction,
            other_deduction, donation_deduction,
            pension_insurance, medical_insurance,
            unemployment_insurance, housing_fund
     FROM tax_records WHERE id = ? AND user_id = ?`,
    [id, userId]
  );

  var pendingChangeLog = null;
  var afterSnap = taxRecordPayloadToSnapshot(record, id);

  if (existing.length > 0) {
    var beforeSnap = taxRecordRowToSnapshot(existing[0]);
    await conn.execute(
      `
      UPDATE tax_records SET
        year = ?, month = ?, income_type = ?, income_subtype = ?,
        company_name = ?, company_tax_id = ?, tax_authority = ?,
        report_channel = ?, report_date = ?, tax_period = ?,
        income = ?, tax_reported = ?, income_this_period = ?,
        tax_free_income = ?, deduction_fee = ?, special_deduction = ?,
        other_deduction = ?, donation_deduction = ?,
        pension_insurance = ?, medical_insurance = ?,
        unemployment_insurance = ?, housing_fund = ?,
        deleted_at = NULL
      WHERE id = ? AND user_id = ?
    `,
      [
        record.year,
        record.month,
        record.income_type,
        record.income_subtype,
        record.company_name,
        record.company_tax_id,
        record.tax_authority,
        record.report_channel,
        record.report_date,
        record.tax_period,
        record.income,
        record.tax_reported,
        record.income_this_period,
        record.tax_free_income,
        record.deduction_fee,
        record.special_deduction,
        record.other_deduction,
        record.donation_deduction,
        record.pension_insurance,
        record.medical_insurance,
        record.unemployment_insurance,
        record.housing_fund,
        id,
        userId
      ]
    );
    if (deferChangeLog) {
      pendingChangeLog = { action: 'update', before: beforeSnap, after: afterSnap };
    } else {
      await insertTaxChangeLog(conn, userId, id, 'update', beforeSnap, afterSnap);
    }
  } else {
    await conn.execute(
      `
      INSERT INTO tax_records (
        id, user_id, year, month, income_type, income_subtype,
        company_name, company_tax_id, tax_authority,
        report_channel, report_date, tax_period,
        income, tax_reported, income_this_period,
        tax_free_income, deduction_fee, special_deduction,
        other_deduction, donation_deduction,
        pension_insurance, medical_insurance,
        unemployment_insurance, housing_fund
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        userId,
        record.year,
        record.month,
        record.income_type,
        record.income_subtype,
        record.company_name,
        record.company_tax_id,
        record.tax_authority,
        record.report_channel,
        record.report_date,
        record.tax_period,
        record.income,
        record.tax_reported,
        record.income_this_period,
        record.tax_free_income,
        record.deduction_fee,
        record.special_deduction,
        record.other_deduction,
        record.donation_deduction,
        record.pension_insurance,
        record.medical_insurance,
        record.unemployment_insurance,
        record.housing_fund
      ]
    );
    if (deferChangeLog) {
      pendingChangeLog = { action: 'insert', before: null, after: afterSnap };
    } else {
      await insertTaxChangeLog(conn, userId, id, 'insert', null, afterSnap);
    }
  }

  return { id: id, pendingChangeLog: pendingChangeLog };
}

/** 保存单条税务记录（审计日志异步，缩短接口耗时） */
async function saveRecord(userId, record) {
  const conn = await pool.getConnection();
  var out;
  try {
    out = await saveRecordInConn(conn, userId, record, { deferChangeLog: true });
    invalidateTaxRecordsListCache(userId);
    invalidateUserInfoApiCache(userId);
  } finally {
    conn.release();
  }
  if (out && out.pendingChangeLog) {
    queueTaxChangeLogAsync(
      userId,
      out.id,
      out.pendingChangeLog.action,
      out.pendingChangeLog.before,
      out.pendingChangeLog.after
    );
  }
  maybeQueueAutoTaxDoneMessage(userId);
  return { id: out.id };
}

/** 组装税务记录 INSERT 参数行 */
function taxRecordInsertParamRow(userId, id, record) {
  var r = normalizeTaxRecordForSql(record);
  return [
    id,
    userId,
    r.year,
    r.month,
    r.income_type,
    r.income_subtype,
    r.company_name,
    r.company_tax_id,
    r.tax_authority,
    r.report_channel,
    r.report_date,
    r.tax_period,
    r.income,
    r.tax_reported,
    r.income_this_period,
    r.tax_free_income,
    r.deduction_fee,
    r.special_deduction,
    r.other_deduction,
    r.donation_deduction,
    r.pension_insurance,
    r.medical_insurance,
    r.unemployment_insurance,
    r.housing_fund
  ];
}

/** 查询税务记录主键 id 全局占用 */
async function loadTaxRecordIdOccupancy(conn, ids) {
  var occupied = {};
  var list = (Array.isArray(ids) ? ids : [])
    .map(function (x) {
      return x != null ? String(x).trim() : '';
    })
    .filter(Boolean);
  if (!list.length) return occupied;
  var chunk = 80;
  var c;
  for (c = 0; c < list.length; c += chunk) {
    var part = list.slice(c, c + chunk);
    var ph = part
      .map(function () {
        return '?';
      })
      .join(',');
    const [rows] = await conn.execute(
      'SELECT id, user_id, deleted_at FROM tax_records WHERE id IN (' + ph + ')',
      part
    );
    (rows || []).forEach(function (r) {
      occupied[String(r.id)] = {
        userId: r.user_id != null ? String(r.user_id) : '',
        deleted: r.deleted_at != null
      };
    });
  }
  return occupied;
}

/** 为批量插入分配不冲突的主键 id */
async function resolveBulkInsertIds(conn, userId, records) {
  var uid = String(userId);
  var planned = [];
  var preferredIds = [];
  var i;
  for (i = 0; i < records.length; i++) {
    var rec = records[i];
    var preferredId = rec.id != null ? String(rec.id).trim() : '';
    var base =
      preferredId !== ''
        ? preferredId
        : 'tr_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 9);
    planned.push({ rec: rec, base: base, id: base, id_reassigned: false, revive: false });
    preferredIds.push(base);
  }
  var occupied = await loadTaxRecordIdOccupancy(conn, preferredIds);
  var used = {};
  var reviveList = [];
  var insertList = [];

  function isGloballyTaken(id) {
    if (used[id]) return true;
    var o = occupied[id];
    if (!o) return false;
    if (o.userId === uid && o.deleted) return false;
    return true;
  }

  for (i = 0; i < planned.length; i++) {
    var p = planned[i];
    var occ = occupied[p.id];
    if (occ && occ.userId === uid && occ.deleted) {
      p.revive = true;
      reviveList.push(p);
      used[p.id] = true;
      continue;
    }
    if (!isGloballyTaken(p.id)) {
      used[p.id] = true;
      insertList.push(p);
      continue;
    }
    var n = 0;
    var assigned = false;
    while (n < 80) {
      n += 1;
      var cand = p.base + '_n' + n;
      if (used[cand]) continue;
      if (!Object.prototype.hasOwnProperty.call(occupied, cand)) {
        var more = await loadTaxRecordIdOccupancy(conn, [cand]);
        Object.keys(more).forEach(function (k) {
          occupied[k] = more[k];
        });
        if (!Object.prototype.hasOwnProperty.call(occupied, cand)) {
          occupied[cand] = null;
        }
      }
      if (occupied[cand] == null && !used[cand]) {
        p.id = cand;
        p.id_reassigned = true;
        used[cand] = true;
        insertList.push(p);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      p.id =
        p.base +
        '_r' +
        Date.now().toString(36) +
        '_' +
        Math.random().toString(36).slice(2, 8);
      p.id_reassigned = true;
      used[p.id] = true;
      insertList.push(p);
    }
  }
  return { insertList: insertList, reviveList: reviveList };
}

/** 批量写入税务变更审计日志 */
async function bulkInsertTaxChangeLogs(conn, userId, rows) {
  if (!rows || !rows.length) return;
  var chunk = TAX_BULK_INSERT_CHUNK;
  var c;
  for (c = 0; c < rows.length; c += chunk) {
    var part = rows.slice(c, c + chunk);
    var placeholders = part
      .map(function () {
        return '(?, ?, ?, ?, ?)';
      })
      .join(',');
    var params = [];
    part.forEach(function (row) {
      params.push(
        String(userId),
        String(row.id),
        'insert',
        null,
        JSON.stringify(taxRecordPayloadToSnapshot(row.rec, row.id))
      );
    });
    try {
      await conn.execute(
        'INSERT INTO tax_record_change_logs (user_id, record_id, action, before_json, after_json) VALUES ' +
          placeholders,
        params
      );
    } catch (e) {
      console.error('bulkInsertTaxChangeLogs', e);
    }
  }
}

/** 在连接中批量插入税务记录 */
async function bulkInsertRecordsInConn(conn, userId, records) {
  var resolved = await resolveBulkInsertIds(conn, userId, records);
  var saved = [];
  var reassigned = 0;
  var r;
  for (r = 0; r < resolved.reviveList.length; r++) {
    var rev = resolved.reviveList[r];
    rev.rec.id = rev.id;
    await saveRecordInConn(conn, userId, rev.rec);
    if (rev.id_reassigned) reassigned += 1;
    saved.push({ id: rev.id, id_reassigned: rev.id_reassigned, rec: rev.rec });
  }
  var insertList = resolved.insertList;
  var chunk = TAX_BULK_INSERT_CHUNK;
  var c;
  for (c = 0; c < insertList.length; c += chunk) {
    var part = insertList.slice(c, c + chunk);
    var placeholders = part
      .map(function () {
        return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      })
      .join(',');
    var params = [];
    part.forEach(function (row) {
      if (row.id_reassigned) reassigned += 1;
      params.push.apply(params, taxRecordInsertParamRow(userId, row.id, row.rec));
      saved.push({ id: row.id, id_reassigned: row.id_reassigned, rec: row.rec });
    });
    await conn.execute(
      `
      INSERT INTO tax_records (
        id, user_id, year, month, income_type, income_subtype,
        company_name, company_tax_id, tax_authority,
        report_channel, report_date, tax_period,
        income, tax_reported, income_this_period,
        tax_free_income, deduction_fee, special_deduction,
        other_deduction, donation_deduction,
        pension_insurance, medical_insurance,
        unemployment_insurance, housing_fund
      ) VALUES ` + placeholders,
      params
    );
    await bulkInsertTaxChangeLogs(conn, userId, part);
  }
  return { saved: saved, reassigned: reassigned };
}

/** 按 id 软删税务记录 */
async function softDeleteTaxRecordsByIdsInConn(conn, userId, ids) {
  var clean = (Array.isArray(ids) ? ids : [])
    .map(function (x) {
      return x != null ? String(x).trim() : '';
    })
    .filter(Boolean);
  if (!clean.length) return 0;
  var chunk = 80;
  var deleted = 0;
  var j;
  for (j = 0; j < clean.length; j += chunk) {
    var part = clean.slice(j, j + chunk);
    var ph = part
      .map(function () {
        return '?';
      })
      .join(',');
    const [result] = await conn.execute(
      'UPDATE tax_records SET deleted_at = NOW(3) WHERE user_id = ? AND deleted_at IS NULL AND id IN (' +
        ph +
        ')',
      [userId].concat(part)
    );
    deleted += result.affectedRows != null ? Number(result.affectedRows) : 0;
  }
  return deleted;
}

/** 在用户级锁内执行税务批处理 */
async function withTaxBatchUserLock(userId, fn) {
  var uid = String(userId);
  if (_taxBatchLocks.get(uid)) {
    var err = new Error('该账号已有批量写入进行中，请稍后再试');
    err.statusCode = 429;
    throw err;
  }
  _taxBatchLocks.set(uid, true);
  try {
    return await fn();
  } finally {
    _taxBatchLocks.delete(uid);
  }
}

/** 批量保存税务记录（一键生成等） */
async function batchSaveRecords(userId, records) {
  return withTaxBatchUserLock(userId, async function () {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      var out = await bulkInsertRecordsInConn(conn, userId, records);
      await conn.commit();
      var dedupeOut = await dedupeTaxRecordsScoped(userId, records);
      invalidateTaxRecordsListCache(userId);
      invalidateUserInfoApiCache(userId);
      var batchResult = {
        saved: out.saved.length,
        ids: out.saved.map(function (x) {
          return x.id;
        }),
        reassigned_ids: out.reassigned,
        auto_deduped: dedupeOut.deleted != null ? dedupeOut.deleted : 0
      };
      maybeQueueAutoTaxDoneMessage(userId);
      return batchResult;
    } catch (e) {
      try {
        await conn.rollback();
      } catch (e2) {}
      throw e;
    } finally {
      conn.release();
    }
  });
}

/** 在连接中删除税务记录 */
async function deleteRecordInConn(conn, userId, id) {
  const [rows] = await conn.execute('SELECT * FROM tax_records WHERE id = ? AND user_id = ? AND ' + TAX_RECORD_NOT_DELETED_SQL, [
    id,
    userId
  ]);
  if (rows.length) {
    await insertTaxChangeLog(conn, userId, id, 'delete', taxRecordRowToSnapshot(rows[0]), null);
    await conn.execute('UPDATE tax_records SET deleted_at = NOW(3) WHERE id = ? AND user_id = ?', [id, userId]);
  }
}

/** 删除单条税务记录 */
async function deleteRecord(userId, id) {
  const conn = await pool.getConnection();
  try {
    await deleteRecordInConn(conn, userId, id);
    invalidateTaxRecordsListCache(userId);
    invalidateUserInfoApiCache(userId);
  } finally {
    conn.release();
  }
}

/** batch replace tax records */
async function batchReplaceTaxRecords(userId, idsToDelete, records) {
  return withTaxBatchUserLock(userId, async function () {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const ids = Array.isArray(idsToDelete) ? idsToDelete : [];
      var deleted = await softDeleteTaxRecordsByIdsInConn(conn, userId, ids);
      var out = await bulkInsertRecordsInConn(conn, userId, records);
      await conn.commit();
      var dedupeOut = await dedupeTaxRecordsScoped(userId, records);
      invalidateTaxRecordsListCache(userId);
      invalidateUserInfoApiCache(userId);
      var replaceResult = {
        deleted: deleted,
        saved: out.saved.length,
        ids: out.saved.map(function (x) {
          return x.id;
        }),
        reassigned_ids: out.reassigned,
        auto_deduped: dedupeOut.deleted != null ? dedupeOut.deleted : 0
      };
      maybeQueueAutoTaxDoneMessage(userId);
      return replaceResult;
    } catch (e) {
      try {
        await conn.rollback();
      } catch (e2) {}
      throw e;
    } finally {
      conn.release();
    }
  });
}

/** 删除用户全部税务记录 */
async function deleteAllRecords(userId) {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'UPDATE tax_records SET deleted_at = NOW(3) WHERE user_id = ? AND ' + TAX_RECORD_NOT_DELETED_SQL,
      [userId]
    );
    invalidateTaxRecordsListCache(userId);
    invalidateUserInfoApiCache(userId);
    return { deleted: result.affectedRows != null ? Number(result.affectedRows) : 0 };
  } finally {
    conn.release();
  }
}

/** 按年份删除税务记录 */
async function deleteRecordsByYear(userId, year) {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'UPDATE tax_records SET deleted_at = NOW(3) WHERE user_id = ? AND year = ? AND ' + TAX_RECORD_NOT_DELETED_SQL,
      [userId, year]
    );
    invalidateTaxRecordsListCache(userId);
    invalidateUserInfoApiCache(userId);
    return { deleted: result.affectedRows != null ? Number(result.affectedRows) : 0 };
  } finally {
    conn.release();
  }
}

/** 按公司删除税务记录 */
async function deleteRecordsByCompany(userId, companyName) {
  const name = companyName != null ? String(companyName).trim() : '';
  if (!name) {
    return { deleted: 0 };
  }
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'UPDATE tax_records SET deleted_at = NOW(3) WHERE user_id = ? AND TRIM(company_name) = ? AND ' +
        TAX_RECORD_NOT_DELETED_SQL,
      [userId, name]
    );
    invalidateTaxRecordsListCache(userId);
    invalidateUserInfoApiCache(userId);
    return { deleted: result.affectedRows != null ? Number(result.affectedRows) : 0 };
  } finally {
    conn.release();
  }
}

/** 税务：record dedupe group key */
function taxRecordDedupeGroupKey(r) {
  var company = r.company_name != null ? String(r.company_name).trim() : '';
  var subtype = r.income_subtype != null ? String(r.income_subtype).trim() : '正常工资薪金';
  if (!subtype) {
    subtype = '正常工资薪金';
  }
  return String(r.year || '') + '|' + String(r.month || '') + '|' + company + '|' + subtype;
}

/** 软删重复税务记录 id */
async function softDeleteDedupeIds(conn, userId, idsToDelete) {
  if (!idsToDelete.length) {
    return { deleted: 0 };
  }
  await conn.beginTransaction();
  try {
    var chunk = 80;
    for (var j = 0; j < idsToDelete.length; j += chunk) {
      var part = idsToDelete.slice(j, j + chunk);
      var ph = part
        .map(function () {
          return '?';
        })
        .join(',');
      await conn.execute(
        'UPDATE tax_records SET deleted_at = NOW(3) WHERE user_id = ? AND deleted_at IS NULL AND id IN (' +
          ph +
          ')',
        [userId].concat(part)
      );
    }
    await conn.commit();
    return { deleted: idsToDelete.length };
  } catch (e) {
    await conn.rollback();
    throw e;
  }
}

/** 收集需删除的重复记录 id */
function collectDedupeIdsToDelete(rows) {
  var groups = {};
  (rows || []).forEach(function (r) {
    var key = taxRecordDedupeGroupKey(r);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(r);
  });
  var idsToDelete = [];
  Object.keys(groups).forEach(function (key) {
    var g = groups[key];
    if (g.length <= 1) {
      return;
    }
    for (var i = 0; i < g.length - 1; i++) {
      idsToDelete.push(g[i].id);
    }
  });
  return idsToDelete;
}

/** dedupe tax records scoped */
async function dedupeTaxRecordsScoped(userId, records) {
  var keySet = {};
  var ymPairs = [];
  var ymSeen = {};
  (records || []).forEach(function (r) {
    if (!r || typeof r !== 'object') return;
    keySet[taxRecordDedupeGroupKey(r)] = true;
    var y = r.year != null ? Number(r.year) : null;
    var m = r.month != null ? Number(r.month) : null;
    if (y == null || m == null || isNaN(y) || isNaN(m)) return;
    var ymk = y + '|' + m;
    if (!ymSeen[ymk]) {
      ymSeen[ymk] = true;
      ymPairs.push([y, m]);
    }
  });
  if (!ymPairs.length) {
    return { deleted: 0 };
  }
  const conn = await pool.getConnection();
  try {
    var orParts = [];
    var params = [userId];
    ymPairs.forEach(function (ym) {
      orParts.push('(year = ? AND month = ?)');
      params.push(ym[0], ym[1]);
    });
    const [rows] = await conn.execute(
      'SELECT id, year, month, company_name, income_subtype, created_at FROM tax_records WHERE user_id = ? AND ' +
        TAX_RECORD_NOT_DELETED_SQL +
        ' AND (' +
        orParts.join(' OR ') +
        ') ORDER BY year ASC, month ASC, TRIM(company_name) ASC, income_subtype ASC, created_at ASC, id ASC',
      params
    );
    var filtered = (rows || []).filter(function (r) {
      return !!keySet[taxRecordDedupeGroupKey(r)];
    });
    var idsToDelete = collectDedupeIdsToDelete(filtered);
    return softDeleteDedupeIds(conn, userId, idsToDelete);
  } finally {
    conn.release();
  }
}

/** dedupe tax records */
async function dedupeTaxRecords(userId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT id, year, month, company_name, income_subtype, created_at FROM tax_records WHERE user_id = ? AND ' +
        TAX_RECORD_NOT_DELETED_SQL +
        ' ORDER BY year ASC, month ASC, TRIM(company_name) ASC, income_subtype ASC, created_at ASC, id ASC',
      [userId]
    );
    var idsToDelete = collectDedupeIdsToDelete(rows);
    return softDeleteDedupeIds(conn, userId, idsToDelete);
  } finally {
    conn.release();
  }
}

/** 按 id 获取税务记录 */
async function getTaxRecordById(userId, id, opts) {
  opts = opts || {};
  const conn = await pool.getConnection();
  var sql = 'SELECT * FROM tax_records WHERE id = ? AND user_id = ?';
  if (!opts.includeDeleted) {
    sql += ' AND ' + TAX_RECORD_NOT_DELETED_SQL;
  }
  const [rows] = await conn.execute(sql, [id, userId]);
  conn.release();
  return rows.length > 0 ? rows[0] : null;
}

/** 将税务记录行映射为客户端结构 */
function mapTaxRecordRowForClient(r) {
  if (!r) {
    return null;
  }
  return {
    id: r.id != null ? String(r.id) : '',
    user_id: r.user_id != null ? String(r.user_id) : '',
    year: r.year != null ? Number(r.year) : null,
    month: r.month != null ? Number(r.month) : null,
    income_type: r.income_type != null ? String(r.income_type) : '',
    income_subtype: r.income_subtype != null ? String(r.income_subtype) : '',
    company_name: r.company_name != null ? String(r.company_name) : '',
    company_tax_id: r.company_tax_id != null ? String(r.company_tax_id) : '',
    tax_authority: r.tax_authority != null ? String(r.tax_authority) : '',
    report_channel: r.report_channel != null ? String(r.report_channel) : '',
    report_date: r.report_date != null ? String(r.report_date) : '',
    tax_period: r.tax_period != null ? String(r.tax_period) : '',
    income: r.income != null ? String(r.income) : '0',
    tax_reported: r.tax_reported != null ? String(r.tax_reported) : '0',
    income_this_period: r.income_this_period != null ? String(r.income_this_period) : '0',
    tax_free_income: r.tax_free_income != null ? String(r.tax_free_income) : '0',
    deduction_fee: r.deduction_fee != null ? String(r.deduction_fee) : '0',
    special_deduction: r.special_deduction != null ? String(r.special_deduction) : '0',
    other_deduction: r.other_deduction != null ? String(r.other_deduction) : '0',
    donation_deduction: r.donation_deduction != null ? String(r.donation_deduction) : '0',
    pension_insurance: r.pension_insurance != null ? String(r.pension_insurance) : '0',
    medical_insurance: r.medical_insurance != null ? String(r.medical_insurance) : '0',
    unemployment_insurance: r.unemployment_insurance != null ? String(r.unemployment_insurance) : '0',
    housing_fund: r.housing_fund != null ? String(r.housing_fund) : '0',
    created_at: r.created_at ? r.created_at.toISOString() : '',
    updated_at: r.updated_at ? r.updated_at.toISOString() : '',
    deleted_at: r.deleted_at ? r.deleted_at.toISOString() : ''
  };
}

/** 获取已删除税务记录列表 */
async function getDeletedTaxRecords(userId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT * FROM tax_records WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC, year DESC, month DESC, id ASC',
      [userId]
    );
    return rows.map(mapTaxRecordRowForClient);
  } finally {
    conn.release();
  }
}

/** restore tax record */
async function restoreTaxRecord(userId, id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      'SELECT * FROM tax_records WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL LIMIT 1',
      [id, userId]
    );
    if (!rows.length) {
      await conn.rollback();
      return { restored: false };
    }
    await conn.execute('UPDATE tax_records SET deleted_at = NULL, updated_at = NOW(3) WHERE id = ? AND user_id = ?', [
      id,
      userId
    ]);
    await insertTaxChangeLog(
      conn,
      userId,
      id,
      'insert',
      null,
      taxRecordPayloadToSnapshot(mapTaxRecordRowForClient(rows[0]), id)
    );
    await conn.commit();
    return { restored: true, id: id };
  } catch (e) {
    try {
      await conn.rollback();
    } catch (e2) {}
    throw e;
  } finally {
    conn.release();
  }
}

/** 恢复用户全部已删税务记录 */
async function restoreAllDeletedTaxRecords(userId) {
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'UPDATE tax_records SET deleted_at = NULL, updated_at = NOW(3) WHERE user_id = ? AND deleted_at IS NOT NULL',
      [userId]
    );
    return { restored: result.affectedRows != null ? Number(result.affectedRows) : 0 };
  } finally {
    conn.release();
  }
}

/** restore records by company */
async function restoreRecordsByCompany(userId, companyName) {
  const name = companyName != null ? String(companyName).trim() : '';
  if (!name) {
    return { restored: 0 };
  }
  const conn = await pool.getConnection();
  try {
    const [result] = await conn.execute(
      'UPDATE tax_records SET deleted_at = NULL, updated_at = NOW(3) WHERE user_id = ? AND TRIM(company_name) = ? AND deleted_at IS NOT NULL',
      [userId, name]
    );
    return { restored: result.affectedRows != null ? Number(result.affectedRows) : 0 };
  } finally {
    conn.release();
  }
}

/** 格式化：tax amt */
function formatTaxAmt(v, defaultStr) {
  if (v == null || v === '') return defaultStr;
  const n = parseFloat(String(v).replace(/,/g, ''));
  if (Number.isNaN(n)) return defaultStr;
  return n.toFixed(2);
}

/** year end bonus separate tax from taxable */
function yearEndBonusSeparateTaxFromTaxable(taxable) {
  const t = Math.max(0, Number(taxable) || 0);
  if (t <= 0) {
    return {
      taxable_income: '0.00',
      tax_rate: '0%',
      quick_deduction: '0.00',
      tax_payable: '0.00'
    };
  }
  const monthlyEq = t / 12;
  const brackets = [
    { max: 3000, rate: 0.03, qd: 0 },
    { max: 12000, rate: 0.1, qd: 210 },
    { max: 25000, rate: 0.2, qd: 1410 },
    { max: 35000, rate: 0.25, qd: 2660 },
    { max: 55000, rate: 0.3, qd: 4410 },
    { max: 80000, rate: 0.35, qd: 7160 },
    { max: Infinity, rate: 0.45, qd: 15160 }
  ];
  for (let i = 0; i < brackets.length; i++) {
    if (monthlyEq <= brackets[i].max) {
      const br = brackets[i];
      const payable = Math.max(0, Math.round((t * br.rate - br.qd) * 100) / 100);
      return {
        taxable_income: t.toFixed(2),
        tax_rate: (br.rate * 100).toFixed(2) + '%',
        quick_deduction: br.qd.toFixed(2),
        tax_payable: payable.toFixed(2)
      };
    }
  }
  return {
    taxable_income: t.toFixed(2),
    tax_rate: '0%',
    quick_deduction: '0.00',
    tax_payable: '0.00'
  };
}

/** iit withholding bracket */
function iitWithholdingBracket(cumulativeTaxable) {
  const x = Math.max(0, Number(cumulativeTaxable) || 0);
  if (x <= 36000) return { ratePct: 3, quick: 0, rateStr: '3%' };
  if (x <= 144000) return { ratePct: 10, quick: 2520, rateStr: '10%' };
  if (x <= 300000) return { ratePct: 20, quick: 16920, rateStr: '20%' };
  if (x <= 420000) return { ratePct: 25, quick: 31920, rateStr: '25%' };
  if (x <= 660000) return { ratePct: 30, quick: 52920, rateStr: '30%' };
  if (x <= 960000) return { ratePct: 35, quick: 85920, rateStr: '35%' };
  return { ratePct: 45, quick: 181920, rateStr: '45%' };
}

/** sum row money — 实现见 ../tax/deductionSplit */

/** split basic and special additional deduction — 实现见 ../tax/deductionSplit */

/** row period income */
function rowPeriodIncome(r) {
  if (r.income_this_period != null && String(r.income_this_period).trim() !== '') {
    return sumRowMoney(r, 'income_this_period');
  }
  return sumRowMoney(r, 'income');
}

/** 组装个税测算数据 */
async function getTaxCalculationData(userId, recordId) {
  const anchor = await getTaxRecordById(userId, recordId);
  if (!anchor) return null;
  const year = anchor.year != null ? parseInt(anchor.year, 10) : null;
  const month = anchor.month != null ? parseInt(anchor.month, 10) : null;

  const conn = await pool.getConnection();
  let rows;
  try {
    if (year == null || Number.isNaN(year)) {
      rows = [anchor];
    } else if (month == null || Number.isNaN(month)) {
      const [r2] = await conn.execute(
        'SELECT * FROM tax_records WHERE user_id = ? AND year = ? AND ' +
          TAX_RECORD_NOT_DELETED_SQL +
          ' ORDER BY month ASC, id ASC',
        [String(userId), year]
      );
      rows = r2;
    } else {
      const ct = anchor.company_tax_id != null ? String(anchor.company_tax_id).trim() : '';
      if (ct) {
        const [r2] = await conn.execute(
          `SELECT * FROM tax_records WHERE user_id = ? AND year = ? AND month IS NOT NULL AND month <= ? AND TRIM(IFNULL(company_tax_id,'')) = ? AND ${TAX_RECORD_NOT_DELETED_SQL} ORDER BY month ASC, id ASC`,
          [String(userId), year, month, ct]
        );
        rows = r2;
        if (rows.length === 0) {
          const [r3] = await conn.execute(
            `SELECT * FROM tax_records WHERE user_id = ? AND year = ? AND month IS NOT NULL AND month <= ? AND ${TAX_RECORD_NOT_DELETED_SQL} ORDER BY month ASC, id ASC`,
            [String(userId), year, month]
          );
          rows = r3;
        }
      } else {
        const [r2] = await conn.execute(
          `SELECT * FROM tax_records WHERE user_id = ? AND year = ? AND month IS NOT NULL AND month <= ? AND ${TAX_RECORD_NOT_DELETED_SQL} ORDER BY month ASC, id ASC`,
          [String(userId), year, month]
        );
        rows = r2;
      }
    }
  } finally {
    conn.release();
  }

  if (!rows || rows.length === 0) {
    rows = [anchor];
  }

  let totalIncome = 0;
  let totalTaxFree = 0;
  let totalDeductionFee = 0;
  let totalSpecial = 0;
  let totalOther = 0;
  let totalOtherDisplay = 0;
  let totalDonation = 0;
  let totalTaxPaidBefore = 0;
  /** 累计减除费用（基本减除 5000）与累计专项附加扣除（other_deduction，旧数据从 deduction_fee 拆分） */
  let totalBasicDeductionFee = 0;
  let totalSpecialAdditionalFromFee = 0;
  const anchorMonth = month != null && !Number.isNaN(month) ? month : null;

  rows.forEach(function (r) {
    totalIncome += rowPeriodIncome(r);
    totalTaxFree += sumRowMoney(r, 'tax_free_income');
    const split = splitBasicAndSpecialAdditionalDeduction(r);
    totalDeductionFee += sumRowMoney(r, 'deduction_fee');
    totalSpecial += sumRowMoney(r, 'special_deduction');
    const otherRaw = sumRowMoney(r, 'other_deduction');
    totalOther += otherRaw;
    totalOtherDisplay += otherDeductionForDisplay(r, split);
    totalDonation += sumRowMoney(r, 'donation_deduction');
    const sub = String(r.income_subtype || '').trim();
    if (sub !== '全年一次性奖金收入') {
      totalSpecialAdditionalFromFee += split.specialAdditional;
      totalBasicDeductionFee += split.basic;
    }
    const m = r.month != null ? parseInt(r.month, 10) : null;
    if (anchorMonth != null && m != null && !Number.isNaN(m) && m < anchorMonth) {
      totalTaxPaidBefore += sumRowMoney(r, 'tax_reported');
    }
  });

  const totalSpecialAdditional = totalSpecialAdditionalFromFee;
  const totalPersonalPension = 0;

  const taxable =
    totalIncome -
    totalTaxFree -
    totalDeductionFee -
    totalSpecial -
    totalOther -
    totalPersonalPension -
    totalDonation;
  const totalTaxableIncome = Math.max(0, taxable);

  const br = iitWithholdingBracket(totalTaxableIncome);
  const totalTaxPayable = Math.max(0, (totalTaxableIncome * br.ratePct) / 100 - br.quick);
  const totalTaxRelief = 0;
  /*
   * 本期申报税额必须用累计公式，不能直接读本条 tax_reported。
   * 库里存的已申报税额可能过期/与累计重算不一致，页面展示的累计应纳税额−累计已缴会算不通。
   * 公式：累计应纳税额 − 累计减免税额 − 累计已预缴税额（可为负表示应退）。
   */
  const currentTaxReported = currentPeriodDeclaredTax(
    totalTaxPayable,
    totalTaxPaidBefore,
    totalTaxRelief
  );

  return {
    total_income: totalIncome.toFixed(2),
    total_tax_free_income: totalTaxFree.toFixed(2),
    total_deduction_fee: totalBasicDeductionFee.toFixed(2),
    total_special_deduction: totalSpecial.toFixed(2),
    total_special_additional: totalSpecialAdditional.toFixed(2),
    total_other_deduction: totalOtherDisplay.toFixed(2),
    total_personal_pension: totalPersonalPension.toFixed(2),
    total_donation: totalDonation.toFixed(2),
    total_taxable_income: totalTaxableIncome.toFixed(2),
    tax_rate: br.rateStr,
    quick_deduction: br.quick.toFixed(2),
    total_tax_payable: totalTaxPayable.toFixed(2),
    total_tax_paid: totalTaxPaidBefore.toFixed(2),
    total_tax_relief: totalTaxRelief.toFixed(2),
    current_tax_reported: currentTaxReported.toFixed(2)
  };
}

/** 格式化：tax detail response */
function formatTaxDetailResponse(rec, userIdStr) {
  const y = rec.year != null ? parseInt(rec.year, 10) : null;
  const m = rec.month != null ? parseInt(rec.month, 10) : null;
  let taxPeriod = rec.tax_period;
  if (!taxPeriod && y != null && m != null) {
    taxPeriod = y + '-' + (m < 10 ? '0' + m : String(m));
  }
  const base = {
    id: rec.id,
    admin_id: 0,
    user_id: userIdStr,
    year: y,
    month: m,
    income_type: rec.income_type || '工资薪金',
    income_subtype: rec.income_subtype || '正常工资薪金',
    company_name: rec.company_name || '',
    company_tax_id: rec.company_tax_id || '',
    tax_authority: rec.tax_authority || '',
    report_channel: rec.report_channel || '其他',
    report_date: rec.report_date || '',
    tax_period: taxPeriod || '',
    income: formatTaxAmt(rec.income, '0.00'),
    tax_reported: formatTaxAmt(rec.tax_reported, '0.00'),
    income_this_period: formatTaxAmt(rec.income_this_period, '0.00'),
    tax_free_income: formatTaxAmt(rec.tax_free_income, '0.00'),
    deduction_fee: (function () {
      var sp = splitBasicAndSpecialAdditionalDeduction(rec);
      return formatTaxAmt(sp.basic, '5000.00');
    })(),
    special_deduction: formatTaxAmt(rec.special_deduction, '0.00'),
    /* 专项附加存在 other_deduction：本期明细不展示（对齐温馨提示），只在税款计算看累计专项附加 */
    other_deduction: formatTaxAmt(periodOtherDeductionForDetail(rec), '0.00'),
    donation_deduction: formatTaxAmt(rec.donation_deduction, '0.00'),
    pension_insurance: formatTaxAmt(rec.pension_insurance, '0.00'),
    medical_insurance: formatTaxAmt(rec.medical_insurance, '0.00'),
    unemployment_insurance: formatTaxAmt(rec.unemployment_insurance, '0.00'),
    housing_fund: formatTaxAmt(rec.housing_fund, '0.00'),
    created_at: rec.created_at ? rec.created_at.toISOString() : '',
    updated_at: rec.updated_at ? rec.updated_at.toISOString() : ''
  };
  if (String(rec.income_subtype || '').trim() === '全年一次性奖金收入') {
    const gross = rowPeriodIncome(rec);
    const taxableRaw =
      gross -
      sumRowMoney(rec, 'tax_free_income') -
      sumRowMoney(rec, 'deduction_fee') -
      sumRowMoney(rec, 'special_deduction') -
      sumRowMoney(rec, 'other_deduction') -
      sumRowMoney(rec, 'donation_deduction');
    const taxable = Math.max(0, Math.round(taxableRaw * 100) / 100);
    const bt = yearEndBonusSeparateTaxFromTaxable(taxable);
    base.bonus_tax = {
      taxable_income: bt.taxable_income,
      tax_rate: bt.tax_rate,
      quick_deduction: bt.quick_deduction,
      tax_payable: bt.tax_payable,
      tax_relief: '0.00',
      tax_paid: '0.00',
      tax_declared: formatTaxAmt(rec.tax_reported, '0.00')
    };
  }
  return base;
}

/** 是否有：h password */
function hashPassword(password, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

/** validate username */
function validateUsername(u) {
  if (!u || typeof u !== 'string') return '账号不能为空';
  u = u.trim();
  if (u.length === 0) return '账号不能为空';
  if (u.length > 32) return '账号长度为 1～32 位';
  if (!/^[\dA-Za-z@._-]+$/.test(u)) return '账号仅支持数字、字母及 . _ - @';
  return null;
}

/** password looks like sql probe */
function passwordLooksLikeSqlProbe(p) {
  if (!p || typeof p !== 'string') return false;
  var s = p.toLowerCase().replace(/\s+/g, ' ');
  if (/\bselect\b[\s\S]*\bfrom\b/.test(s)) return true;
  if (/\bunion\b[\s\S]*\bselect\b/.test(s)) return true;
  if (/\binsert\b[\s\S]*\binto\b/.test(s)) return true;
  if (/\bdelete\b[\s\S]*\bfrom\b/.test(s)) return true;
  if (/\bdrop\b[\s\S]*\btable\b/.test(s)) return true;
  if (/\bupdate\b[\s\S]*\bset\b/.test(s)) return true;
  if (/\bor\s+['"]?\d+['"]?\s*=\s*['"]?\d+/.test(s)) return true;
  if (/'\s*or\s*'|"\s*or\s*"/.test(s)) return true;
  if (/--\s*$|;\s*--/.test(s)) return true;
  return false;
}

/** validate password */
function validatePassword(p) {
  if (!p || typeof p !== 'string') return '密码不能为空';
  if (p.length < 1 || p.length > 64) return '密码长度为 1～64 位';
  if (passwordLooksLikeSqlProbe(p)) return '密码包含不允许的内容';
  return null;
}

/** 合并：user risk info */
function mergeUserRiskInfo(ipDistinctCount, deviceCount, plainPassword, registerIpAccountCount, registerIpFirstUsername) {
  var info = computeUserLoginRisk(
    ipDistinctCount,
    deviceCount,
    registerIpAccountCount,
    registerIpFirstUsername
  );
  if (passwordLooksLikeSqlProbe(plainPassword)) {
    info = {
      distinct_ip_count: info.distinct_ip_count,
      device_count: info.device_count,
      register_ip_account_count: info.register_ip_account_count,
      register_ip_first_username: info.register_ip_first_username,
      risk: true,
      risk_messages: info.risk_messages.concat(['可疑密码(SQL探测)'])
    };
  }
  return info;
}

/** 用户辅助：session rev from row */
function userSessionRevFromRow(rec) {
  if (!rec || rec.session_rev == null) return 0;
  return Number(rec.session_rev) || 0;
}

/** 短缓存鉴权行，减轻每个业务接口都打一次 users 表的压力 */
var USER_AUTH_CACHE_TTL_MS = parseInt(process.env.USER_AUTH_CACHE_TTL_MS || '15000', 10) || 15000;
var _userAuthCache = new Map();
var _userAuthCacheLastPrune = 0;

/** 清除用户鉴权状态缓存 */
function invalidateUserAuthCache(username) {
  if (username == null || username === '') return;
  _userAuthCache.delete(String(username).trim());
}

/** prune user auth cache */
function pruneUserAuthCache(now) {
  if (now - _userAuthCacheLastPrune < 60000) return;
  _userAuthCacheLastPrune = now;
  _userAuthCache.forEach(function (entry, key) {
    if (!entry || entry.expiresAt <= now) {
      _userAuthCache.delete(key);
    }
  });
}

/** 加载用户鉴权状态 */
async function loadUserAuthState(username) {
  var u = String(username || '').trim();
  if (!u) return null;
  var now = Date.now();
  pruneUserAuthCache(now);
  var hit = _userAuthCache.get(u);
  if (hit && hit.expiresAt > now) {
    return hit.row;
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT banned, session_rev, account_active, user_type, activation_kind, active_until FROM users WHERE username = ? LIMIT 1',
      [u]
    );
    if (!rows.length) {
      _userAuthCache.set(u, { expiresAt: now + Math.min(3000, USER_AUTH_CACHE_TTL_MS), row: null });
      return null;
    }
    var row = {
      banned: rows[0].banned === 1 || rows[0].banned === true,
      session_rev: userSessionRevFromRow(rows[0]),
      account_active: rows[0].account_active === 1 || rows[0].account_active === true,
      user_type: rows[0].user_type != null ? Number(rows[0].user_type) : USER_TYPE_NORMAL,
      activation_kind: rows[0].activation_kind != null ? String(rows[0].activation_kind) : 'none',
      active_until: rows[0].active_until || null
    };
    row.account_active = isUserEffectivelyActive(row);
    _userAuthCache.set(u, { expiresAt: now + USER_AUTH_CACHE_TTL_MS, row: row });
    return row;
  } finally {
    conn.release();
  }
}

/** 签名：access token */
function signAccessToken(userPayload) {
  var uid = userPayload.user_id != null ? String(userPayload.user_id) : String(userPayload.username || '');
  var act =
    userPayload.account_active === true ||
    userPayload.account_active === 1 ||
    userPayload.account_active === '1'
      ? 1
      : 0;
  var srv = userPayload.session_rev != null ? Number(userPayload.session_rev) : 0;
  if (!srv || srv < 0) srv = 0;
  return jwt.sign({ sub: uid, act: act, srv: srv }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/** 按用户名查 users 行 */
async function getUserRowByUsername(username) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT * FROM users WHERE username = ?', [username]);
    return rows.length ? rows[0] : null;
  } finally {
    conn.release();
  }
}

/** recover credentials by activation code */
async function recoverCredentialsByActivationCode(rawCode) {
  var code = String(rawCode || '').trim().toUpperCase();
  if (!code) {
    throw new Error('请输入激活码');
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      'SELECT ac.used_count, ac.used_by_username, u.plain_password, u.real_name FROM activation_codes ac ' +
        'LEFT JOIN users u ON u.username = ac.used_by_username WHERE ac.code = ? LIMIT 1',
      [code]
    );
    if (rows.length === 0) {
      throw new Error('激活码无效');
    }
    var r = rows[0];
    if (Number(r.used_count) < 1 || !r.used_by_username) {
      throw new Error('该激活码尚未绑定账号，无法找回。请确认是否为已用于激活的激活码。');
    }
    var pwd = plainPasswordStore.decodePlainPasswordForDisplay(r.plain_password);
    var resetRequired = false;
    if (!pwd) {
      resetRequired = true;
      pwd = crypto.randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 10);
      if (pwd.length < 8) {
        pwd = (pwd + crypto.randomBytes(6).toString('hex')).slice(0, 10);
      }
      var saltBuf = crypto.randomBytes(16);
      var saltHex = saltBuf.toString('hex');
      var hashHex = hashPasswordWithSalt(pwd, saltBuf);
      var storePlainVal = plainPasswordStore.encodePlainPasswordForStore(pwd);
      await conn.execute(
        'UPDATE users SET salt = ?, hash = ?, plain_password = ?, session_rev = session_rev + 1 WHERE username = ?',
        [saltHex, hashHex, storePlainVal, r.used_by_username]
      );
      invalidateUserAuthCache(String(r.used_by_username));
    }
    return {
      username: String(r.used_by_username),
      password: pwd,
      real_name: r.real_name != null ? String(r.real_name) : '',
      reset_required: resetRequired
    };
  } finally {
    conn.release();
  }
}

/** recover credentials by username + identity (real_name or tax_id) */
async function recoverCredentialsByIdentity(username, realName, taxId) {
  var uname = String(username || '').trim();
  var rName = String(realName || '').trim();
  var tId = String(taxId || '').trim();
  if (!uname) throw new Error('请输入账号');
  if (!rName && !tId) throw new Error('请至少填写姓名或身份证号其中一项');
  const conn = await pool.getConnection();
  try {
    var sql = 'SELECT username, plain_password, real_name, tax_id FROM users WHERE username = ?';
    var params = [uname];
    if (rName && tId) {
      sql += ' AND real_name = ? AND tax_id = ?';
      params.push(rName, tId);
    } else if (rName) {
      sql += ' AND real_name = ?';
      params.push(rName);
    } else {
      sql += ' AND tax_id = ?';
      params.push(tId);
    }
    sql += ' LIMIT 1';
    const [rows] = await conn.execute(sql, params);
    if (rows.length === 0) {
      throw new Error('账号与身份信息不匹配，请检查后重试');
    }
    var r = rows[0];
    var pwd = plainPasswordStore.decodePlainPasswordForDisplay(r.plain_password);
    if (!pwd) {
      throw new Error('已找到账号但无法显示密码，请联系管理员协助重置。');
    }
    return {
      username: String(r.username),
      password: pwd,
      real_name: r.real_name != null ? String(r.real_name) : ''
    };
  } finally {
    conn.release();
  }
}

/** 应用：activation code（支持永久码与 grant_days 时效码） */
async function applyActivationCode(username, rawCode) {
  await getInviteReward().applyActivationCodeExtended(username, rawCode, activationSourceFromCodeNote);
}

var _paymentOrderVariantColsReady = false;

/** 加宽 payment_orders 增值字段，避免 tax_edit_unlimited 等超 VARCHAR(16) 写库失败 */
async function ensurePaymentOrdersVariantColumns(connOrPool) {
  if (_paymentOrderVariantColsReady || !connOrPool) return;
  var owned = false;
  var conn = connOrPool;
  if (typeof connOrPool.getConnection === 'function') {
    conn = await connOrPool.getConnection();
    owned = true;
  }
  try {
    await conn.query(
      "ALTER TABLE payment_orders MODIFY COLUMN pricing_variant VARCHAR(32) NULL COMMENT 'control|treatment|tax_daily|rename'"
    );
    await conn.query(
      "ALTER TABLE payment_orders MODIFY COLUMN grant_kind VARCHAR(32) NULL COMMENT 'trial|permanent|tax_edit_daily|rename_credit'"
    );
    _paymentOrderVariantColsReady = true;
  } catch (eEnsure) {
    console.error('ensurePaymentOrdersVariantColumns', eEnsure && eEnsure.sqlMessage ? eEnsure.sqlMessage : eEnsure);
  } finally {
    if (owned) {
      try {
        conn.release();
      } catch (eRel) {}
    }
  }
}

function paymentDbErrorHint(err) {
  var raw = err && (err.sqlMessage || err.message);
  var hint = raw != null ? String(raw).replace(/\s+/g, ' ').trim() : '';
  if (hint.length > 140) hint = hint.slice(0, 140);
  return hint;
}

/** 查找 30 分钟内未支付的同 SKU 订单；缺列时降级查询 */
async function findRecentPendingAddonOrder(conn, username, skuId) {
  var tries = [
    `SELECT id, out_trade_no, subject, amount, status, paid_at, pricing_variant, sku_id,
            grant_kind, grant_days, grant_hours, grant_minutes
     FROM payment_orders
     WHERE username = ? AND status = 'pending' AND sku_id = ?
       AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)
     ORDER BY id DESC LIMIT 1 FOR UPDATE`,
    `SELECT id, out_trade_no, subject, amount, status, paid_at, pricing_variant, sku_id, grant_kind
     FROM payment_orders
     WHERE username = ? AND status = 'pending' AND sku_id = ?
       AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)
     ORDER BY id DESC LIMIT 1 FOR UPDATE`
  ];
  var lastErr = null;
  for (var i = 0; i < tries.length; i++) {
    try {
      const [rows] = await conn.execute(tries[i], [username, skuId]);
      return rows;
    } catch (eFind) {
      lastErr = eFind;
      if (!eFind || eFind.errno !== 1054) throw eFind;
    }
  }
  throw lastErr;
}

/** 写入增值待支付订单；缺列或超长时降级再写 */
async function insertPendingAddonOrder(conn, row) {
  var tries = [
    {
      sql: `INSERT INTO payment_orders
        (out_trade_no, username, subject, amount, status, pricing_variant, sku_id, grant_kind, grant_days, grant_hours, grant_minutes)
        VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
      params: [
        row.out_trade_no,
        row.username,
        row.subject,
        row.amount,
        row.pricing_variant,
        row.sku_id,
        row.grant_kind,
        row.grant_days || 0,
        row.grant_hours || 0,
        row.grant_minutes || 0
      ]
    },
    {
      sql: `INSERT INTO payment_orders
        (out_trade_no, username, subject, amount, status, pricing_variant, sku_id, grant_kind)
        VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
      params: [
        row.out_trade_no,
        row.username,
        row.subject,
        row.amount,
        row.pricing_variant,
        row.sku_id,
        row.grant_kind
      ]
    },
    {
      sql: `INSERT INTO payment_orders
        (out_trade_no, username, subject, amount, status, sku_id)
        VALUES (?, ?, ?, ?, 'pending', ?)`,
      params: [row.out_trade_no, row.username, row.subject, row.amount, row.sku_id]
    }
  ];
  var lastErr = null;
  for (var i = 0; i < tries.length; i++) {
    try {
      await conn.execute(tries[i].sql, tries[i].params);
      return;
    } catch (eIns) {
      lastErr = eIns;
      var tooLong = eIns && (eIns.errno === 1406 || /too long/i.test(String(eIns.sqlMessage || eIns.message || '')));
      var badCol = eIns && eIns.errno === 1054;
      if (!tooLong && !badCol) throw eIns;
    }
  }
  throw lastErr;
}

/** 生成支付宝商户订单号 */
function createAlipayOutTradeNo() {
  var now = new Date();
  var stamp =
    now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  return 'AP' + stamp + crypto.randomBytes(8).toString('hex').toUpperCase();
}

/** 读取支付宝商品配置 */
function getAlipayProductConfig() {
  var cfg = alipay.getConfig();
  var amount = alipay.normalizeAmount(cfg.productAmount);
  return {
    subject: String(cfg.productTitle || '激活码').slice(0, 128),
    amount: amount
  };
}

/** plain payment order */
function plainPaymentOrder(row) {
  if (!row) return null;
  var paidAt = '';
  if (row.paid_at instanceof Date) {
    paidAt = row.paid_at.toISOString();
  } else if (row.paid_at) {
    paidAt = String(row.paid_at);
  }
  return {
    out_trade_no: String(row.out_trade_no || ''),
    subject: String(row.subject || ''),
    amount: row.amount != null ? String(row.amount) : '',
    list_amount: row.list_amount != null ? String(row.list_amount) : '',
    discount_amount: row.discount_amount != null ? String(row.discount_amount) : '0.00',
    share_discount_count: Math.max(0, parseInt(row.share_discount_count, 10) || 0),
    status: String(row.status || ''),
    paid_at: paidAt,
    pricing_variant: row.pricing_variant != null ? String(row.pricing_variant) : '',
    sku_id: row.sku_id != null ? String(row.sku_id) : '',
    grant_kind: row.grant_kind != null ? String(row.grant_kind) : ''
  };
}

/** 中高频用户改名收费：近 30 天活跃≥2 天，且历史改名≥5 次后，每次再改名需支付 */
var RENAME_FEE_SKU_ID = 'sku_rename_fee_10';
var RENAME_FEE_AMOUNT = '10.00';
var RENAME_FEE_SUBJECT = '改名服务（单次）';
var RENAME_FREE_LIMIT = 5;
var RENAME_FREQ_WINDOW_DAYS = 30;
var RENAME_FREQ_MIN_ACTIVE_DAYS = 2;
function isRenameFeeSkuId(skuId) {
  return String(skuId || '') === RENAME_FEE_SKU_ID;
}

/** 离职证明：付一次终身无限次生成（不开通账号；金额以后台配置为准） */
var LIZHI_CERT_SKU_ID = 'sku_lizhi_cert_50';
var LIZHI_CERT_AMOUNT = lizhiCertFeePolicy.LIZHI_CERT_FEE_DEFAULT_AMOUNT;
var LIZHI_CERT_SUBJECT = '离职证明生成（终身）';
var ZAIZHI_CERT_SKU_ID = 'sku_zaizhi_cert_50';
var ZAIZHI_CERT_AMOUNT = lizhiCertFeePolicy.LIZHI_CERT_FEE_DEFAULT_AMOUNT;
var ZAIZHI_CERT_SUBJECT = '在职证明生成（终身）';
var SBDY_DEMO_SKU_ID = 'sku_sbdy_demo_199';
var SBDY_DEMO_AMOUNT = '199.00';
var SBDY_DEMO_SUBJECT = '社保演示去水印（终身）';
var NAJILU_QR_SKU_ID = najiluQrFeePolicy.NAJILU_QR_SKU_ID;
var NAJILU_QR_AMOUNT = najiluQrFeePolicy.NAJILU_QR_FEE_DEFAULT_AMOUNT;
var NAJILU_QR_SUBJECT = najiluQrFeePolicy.NAJILU_QR_SUBJECT;
function isLizhiCertSkuId(skuId) {
  return String(skuId || '') === LIZHI_CERT_SKU_ID;
}
function isZaizhiCertSkuId(skuId) {
  return String(skuId || '') === ZAIZHI_CERT_SKU_ID;
}
function isSbdyDemoSkuId(skuId) {
  return String(skuId || '') === SBDY_DEMO_SKU_ID;
}
function isNajiluQrSkuId(skuId) {
  return najiluQrFeePolicy.isNajiluQrSkuId(skuId);
}
function isNonActivationSkuId(skuId, grantKind) {
  return (
    isRenameFeeSkuId(skuId) ||
    isLizhiCertSkuId(skuId) ||
    isZaizhiCertSkuId(skuId) ||
    isSbdyDemoSkuId(skuId) ||
    isNajiluQrSkuId(skuId) ||
    taxEditFeePolicy.isTaxEditFeeSkuId(skuId) ||
    String(grantKind || '') === 'rename_credit' ||
    String(grantKind || '') === 'lizhi_cert' ||
    String(grantKind || '') === 'zaizhi_cert' ||
    String(grantKind || '') === 'sbdy_demo' ||
    String(grantKind || '') === 'najilu_qr' ||
    taxEditFeePolicy.isTaxEditFeeGrantKind(grantKind)
  );
}

/** 统计用户历史改名次数 */
async function countUserRealNameChanges(userId) {
  if (!userId) return 0;
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS c FROM user_profile_change_logs
     WHERE username = ? AND field_key = 'real_name'`,
    [String(userId)]
  );
  return Number((rows[0] || {}).c) || 0;
}

/** 近 N 天活跃天数（含今天） */
async function countUserActiveDaysRecent(userId, days) {
  if (!userId) return 0;
  var d = Math.max(1, Math.min(90, parseInt(days, 10) || RENAME_FREQ_WINDOW_DAYS));
  const [rows] = await pool.execute(
    `SELECT COUNT(DISTINCT activity_date) AS c
     FROM user_daily_activity
     WHERE username = ?
       AND activity_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
    [String(userId), d - 1]
  );
  return Number((rows[0] || {}).c) || 0;
}

/** 未消耗的改名次数 */
async function countUnusedRenameCredits(userId) {
  if (!userId) return 0;
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS c FROM user_rename_credits
       WHERE username = ? AND consumed_at IS NULL`,
      [String(userId)]
    );
    return Number((rows[0] || {}).c) || 0;
  } catch (e) {
    return 0;
  }
}

/** 改名不再收费；保留接口字段供旧客户端兼容 */
async function getRenameFeePolicy(userId) {
  var nameChanges = await countUserRealNameChanges(userId);
  var activeDays = await countUserActiveDaysRecent(userId, RENAME_FREQ_WINDOW_DAYS);
  var unused = await countUnusedRenameCredits(userId);
  var exempt = await isRenameFeeExemptUser(userId);
  return {
    need_fee: false,
    can_rename_now: true,
    unused_credits: unused,
    name_change_count: nameChanges,
    free_limit: RENAME_FREE_LIMIT,
    active_days: activeDays,
    activity_window_days: RENAME_FREQ_WINDOW_DAYS,
    is_mid_high_frequency: activeDays >= RENAME_FREQ_MIN_ACTIVE_DAYS,
    rename_fee_exempt: exempt,
    tax_edit_fee_exempt: exempt,
    fee_amount: '0.00',
    fee_subject: RENAME_FEE_SUBJECT,
    sku_id: RENAME_FEE_SKU_ID
  };
}

/** 是否永久免改名费 / 个税修改费（同一白名单） */
async function isRenameFeeExemptUser(userId) {
  var uname = String(userId || '').trim();
  if (!uname) return false;
  try {
    const [exemptRows] = await pool.execute(
      'SELECT rename_fee_exempt FROM users WHERE username = ? LIMIT 1',
      [uname]
    );
    return !!(
      exemptRows.length &&
      (exemptRows[0].rename_fee_exempt === true ||
        Number(exemptRows[0].rename_fee_exempt) === 1)
    );
  } catch (eExempt) {
    return false;
  }
}

/** 有个税记录变更的不同北京日历天数 */
async function countUserTaxModDistinctDays(userId) {
  if (!userId) return 0;
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(DISTINCT DATE(DATE_ADD(changed_at, INTERVAL 8 HOUR))) AS c
       FROM tax_record_change_logs
       WHERE user_id = ?`,
      [String(userId)]
    );
    return Number((rows[0] || {}).c) || 0;
  } catch (e) {
    return 0;
  }
}

async function hasTaxEditDailyUnlock(userId, dayKey) {
  if (!userId || !dayKey) return false;
  try {
    const [rows] = await pool.execute(
      `SELECT id FROM user_tax_edit_daily_unlocks
       WHERE username = ? AND unlock_date = ? LIMIT 1`,
      [String(userId), String(dayKey)]
    );
    return !!(rows && rows.length);
  } catch (e) {
    return false;
  }
}

var _taxEditFeeConfigCache = null;
var _taxEditFeeConfigCacheAt = 0;
var TAX_EDIT_FEE_CONFIG_CACHE_MS = 10000;

async function loadTaxEditFeeConfig(force) {
  var now = Date.now();
  if (!force && _taxEditFeeConfigCache && now - _taxEditFeeConfigCacheAt < TAX_EDIT_FEE_CONFIG_CACHE_MS) {
    return _taxEditFeeConfigCache;
  }
  var out = taxEditFeePolicy.defaultTaxEditFeeConfig();
  try {
    const [rows] = await pool.execute(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [taxEditFeePolicy.SETTING_KEY_TAX_EDIT_FEE]
    );
    if (rows.length && rows[0].setting_value) {
      out = taxEditFeePolicy.normalizeTaxEditFeeConfig(JSON.parse(String(rows[0].setting_value)));
    }
  } catch (eCfg) {
    /* 保持默认当天无限金额 */
  }
  _taxEditFeeConfigCache = out;
  _taxEditFeeConfigCacheAt = now;
  return out;
}

async function saveTaxEditFeeConfigFromAdmin(body) {
  var next = taxEditFeePolicy.parseTaxEditFeeConfigFromAdmin(body);
  if (!next) {
    var err = new Error('个税修改收费金额无效，请填写 0.01～99999.99');
    err.statusCode = 400;
    throw err;
  }
  const conn = await pool.getConnection();
  try {
    await upsertAppSetting(conn, taxEditFeePolicy.SETTING_KEY_TAX_EDIT_FEE, JSON.stringify(next));
  } finally {
    conn.release();
  }
  _taxEditFeeConfigCache = next;
  _taxEditFeeConfigCacheAt = Date.now();
  return next;
}

var _renameFeeConfigCache = null;
var _renameFeeConfigCacheAt = 0;
var RENAME_FEE_CONFIG_CACHE_MS = 10000;

async function loadRenameFeeConfig(force) {
  var now = Date.now();
  if (!force && _renameFeeConfigCache && now - _renameFeeConfigCacheAt < RENAME_FEE_CONFIG_CACHE_MS) {
    return _renameFeeConfigCache;
  }
  var out = renameFeePolicy.defaultRenameFeeConfig();
  try {
    const [rows] = await pool.execute(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [renameFeePolicy.SETTING_KEY_RENAME_FEE]
    );
    if (rows.length && rows[0].setting_value) {
      out = renameFeePolicy.normalizeRenameFeeConfig(JSON.parse(String(rows[0].setting_value)));
    }
  } catch (eCfg) {
    /* 保持默认改名金额 */
  }
  _renameFeeConfigCache = out;
  _renameFeeConfigCacheAt = now;
  return out;
}

async function saveRenameFeeConfigFromAdmin(body) {
  var next = renameFeePolicy.parseRenameFeeConfigFromAdmin(body);
  if (!next) {
    var err = new Error('改名费用金额无效，请填写 0～99999.99（0 表示不用付款）');
    err.statusCode = 400;
    throw err;
  }
  const conn = await pool.getConnection();
  try {
    await upsertAppSetting(conn, renameFeePolicy.SETTING_KEY_RENAME_FEE, JSON.stringify(next));
  } finally {
    conn.release();
  }
  _renameFeeConfigCache = next;
  _renameFeeConfigCacheAt = Date.now();
  return next;
}

var _lizhiCertFeeConfigCache = null;
var _lizhiCertFeeConfigCacheAt = 0;
var LIZHI_CERT_FEE_CONFIG_CACHE_MS = 10000;

async function loadLizhiCertFeeConfig(force) {
  var now = Date.now();
  if (
    !force &&
    _lizhiCertFeeConfigCache &&
    now - _lizhiCertFeeConfigCacheAt < LIZHI_CERT_FEE_CONFIG_CACHE_MS
  ) {
    return _lizhiCertFeeConfigCache;
  }
  var out = lizhiCertFeePolicy.defaultLizhiCertFeeConfig();
  try {
    const [rows] = await pool.execute(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [lizhiCertFeePolicy.SETTING_KEY_LIZHI_CERT_FEE]
    );
    if (rows.length && rows[0].setting_value) {
      out = lizhiCertFeePolicy.normalizeLizhiCertFeeConfig(JSON.parse(String(rows[0].setting_value)));
    }
  } catch (eCfg) {
    /* 保持默认离职证明金额 */
  }
  _lizhiCertFeeConfigCache = out;
  _lizhiCertFeeConfigCacheAt = now;
  return out;
}

async function saveLizhiCertFeeConfigFromAdmin(body) {
  var next = lizhiCertFeePolicy.parseLizhiCertFeeConfigFromAdmin(body);
  if (!next) {
    var err = new Error('证明金额无效，请填写 0.01～99999.99');
    err.statusCode = 400;
    throw err;
  }
  const conn = await pool.getConnection();
  try {
    await upsertAppSetting(conn, lizhiCertFeePolicy.SETTING_KEY_LIZHI_CERT_FEE, JSON.stringify(next));
  } finally {
    conn.release();
  }
  _lizhiCertFeeConfigCache = next;
  _lizhiCertFeeConfigCacheAt = Date.now();
  return next;
}

/** 个税修改收费策略（超限账号，白名单除外；金额以后台配置为准） */
async function getTaxEditFeePolicy(userId) {
  var nameChanges = await countUserRealNameChanges(userId);
  var taxModDays = await countUserTaxModDistinctDays(userId);
  var today = chinaDateKeyNow();
  var hasDaily = await hasTaxEditDailyUnlock(userId, today);
  var exempt = await isRenameFeeExemptUser(userId);
  var amounts = await loadTaxEditFeeConfig(false);
  return taxEditFeePolicy.buildTaxEditFeePolicyView({
    nameChanges: nameChanges,
    taxModDays: taxModDays,
    hasDailyUnlock: hasDaily,
    exempt: exempt,
    today: today,
    dailyAmount: amounts.daily_amount,
    renameGt: amounts.rename_gt,
    daysGt: amounts.days_gt
  });
}

async function okTaxWrite(res, userId, policy, data) {
  return res.json({ code: 200, data: data });
}

async function sendTaxEditFeeBlockIfNeeded(res, userId, action) {
  if (!taxEditFeePolicy.isTaxEditFeeWriteAction(action) || !userId) return false;
  var policy = await getTaxEditFeePolicy(userId);
  if (!policy.need_fee) return false;
  res.status(402).json({
    code: 402,
    msg: taxEditFeePolicy.taxEditFeeBlockMessage(policy),
    data: Object.assign({ need_tax_edit_fee: true, peer_account: true }, policy)
  });
  return true;
}

/** 在事务中消耗一次改名额度；失败返回 false */
async function consumeRenameCreditInConn(conn, userId) {
  const [rows] = await conn.execute(
    `SELECT id FROM user_rename_credits
     WHERE username = ? AND consumed_at IS NULL
     ORDER BY id ASC LIMIT 1 FOR UPDATE`,
    [String(userId)]
  );
  if (!rows.length) return false;
  await conn.execute(
    `UPDATE user_rename_credits SET consumed_at = CURRENT_TIMESTAMP WHERE id = ? AND consumed_at IS NULL`,
    [rows[0].id]
  );
  return true;
}

function readPreferredPurchaseAbc(req) {
  try {
    var h =
      (req.headers && (req.headers['x-purchase-abc'] || req.headers['X-Purchase-Abc'])) || '';
    var v = String(h || '').toLowerCase().trim();
    if (v === 'a' || v === 'b' || v === 'c') return v;
    if (req.query && req.query.purchase_abc) {
      v = String(req.query.purchase_abc).toLowerCase().trim();
      if (v === 'a' || v === 'b' || v === 'c') return v;
    }
  } catch (e0) {}
  return '';
}

/* 支付页引流：1 次分享立减 ¥50。先下线展示与抵扣，开关打开即可恢复 */
var BILIBILI_SHARE_DISCOUNT_ENABLED = false;
var BILIBILI_SHARE_DISCOUNT_THRESHOLD = 1;
var BILIBILI_SHARE_DISCOUNT_AMOUNT = '50.00';
var BILIBILI_SHARE_SESSION_TTL_MINUTES = 30;
var BILIBILI_SHARE_MIN_COMPLETE_SECONDS = 2;

function buildBilibiliShareRewardStatus(row, pendingOrder) {
  row = row || {};
  var total = Math.max(0, parseInt(row.completed_count, 10) || 0);
  var available = Math.max(0, parseInt(row.available_count, 10) || 0);
  var reserved = Math.max(0, parseInt(row.reserved_count, 10) || 0);
  var threshold = BILIBILI_SHARE_DISCOUNT_THRESHOLD;
  var pendingDiscount = '0.00';
  if (
    pendingOrder &&
    String(pendingOrder.status || '') === 'pending' &&
    Number(pendingOrder.discount_amount) > 0 &&
    Math.max(0, parseInt(pendingOrder.share_discount_count, 10) || 0) >= threshold
  ) {
    pendingDiscount = alipay.normalizeAmount(pendingOrder.discount_amount) || BILIBILI_SHARE_DISCOUNT_AMOUNT;
  }
  /* 仅在确有金额时才算「已用于待支付订单」；只有预占无金额会渲染成「自动减 ¥0.00」 */
  var pendingApplied = Number(pendingDiscount) > 0;
  return {
    completed_count: total,
    available_count: available,
    reserved_count: reserved,
    threshold: threshold,
    /* 预占待支付时进度仍展示满格，避免页面误显示「0/N + 原价」 */
    progress_count: pendingApplied
      ? threshold
      : Math.min(available, threshold),
    remaining_count: pendingApplied
      ? 0
      : Math.max(0, threshold - available),
    eligible: available >= threshold,
    pending_discount_applied: pendingApplied,
    pending_discount_amount: pendingApplied
      ? pendingDiscount || BILIBILI_SHARE_DISCOUNT_AMOUNT
      : '0.00',
    discount_amount: BILIBILI_SHARE_DISCOUNT_AMOUNT
  };
}

async function readBilibiliShareRewardStatus(username, conn) {
  var db = conn || pool;
  var user = String(username || '');
  /* 预占口径须与下单时的释放逻辑一致：仅「未超时的 pending 订单」才算真占用，
     否则已关闭/超时订单会把次数永久算成 reserved，页面误显示「优惠已用于待支付订单」 */
  const [rows] = await db.execute(
    `SELECT
       SUM(CASE WHEN se.status = 'completed' THEN 1 ELSE 0 END) AS completed_count,
       SUM(CASE
         WHEN se.status = 'completed' AND se.consumed_at IS NULL
           AND (se.reserved_order_no IS NULL OR po.id IS NULL) THEN 1
         ELSE 0
       END) AS available_count,
       SUM(CASE
         WHEN se.status = 'completed' AND se.consumed_at IS NULL
           AND se.reserved_order_no IS NOT NULL AND po.id IS NOT NULL THEN 1
         ELSE 0
       END) AS reserved_count
     FROM user_bilibili_share_events se
     LEFT JOIN payment_orders po
       ON po.out_trade_no = se.reserved_order_no
      AND po.status = 'pending'
      AND po.created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)
     WHERE se.username = ?`,
    [user]
  );
  const [pendingRows] = await db.execute(
    `SELECT status, amount, list_amount, discount_amount, share_discount_count
     FROM payment_orders
     WHERE username = ? AND status = 'pending'
       AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)
     ORDER BY id DESC LIMIT 1`,
    [user]
  );
  return buildBilibiliShareRewardStatus(rows[0], pendingRows[0] || null);
}

/** 支付页 B 站分享活动：开始一次服务端分享会话 */
async function handleBilibiliShareStart(req, res) {
  var username = String(req.authUserId || '');
  var sessionId =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex');
  try {
    var shareTtlMin = Math.max(
      1,
      Math.min(24 * 60, parseInt(BILIBILI_SHARE_SESSION_TTL_MINUTES, 10) || 30)
    );
    await pool.execute(
      `UPDATE user_bilibili_share_events
       SET status = 'expired'
       WHERE username = ? AND status = 'pending'
         AND created_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ${shareTtlMin} MINUTE)`,
      [username]
    );
    await pool.execute(
      `INSERT INTO user_bilibili_share_events
       (username, share_session_id, status)
       VALUES (?, ?, 'pending')`,
      [username, sessionId]
    );
    var status = await readBilibiliShareRewardStatus(username);
    return res.json({
      code: 200,
      data: Object.assign({ share_session_id: sessionId }, status)
    });
  } catch (e) {
    console.error('start bilibili share reward', e);
    return res.status(500).json({ code: 500, msg: '暂时无法开始分享活动，请稍后重试' });
  }
}

/** 支付页 B 站分享活动：从 B 站/分享面板返回后确认本次分享 */
async function handleBilibiliShareComplete(req, res) {
  var username = String(req.authUserId || '');
  var sessionId = String((req.body && req.body.share_session_id) || '').trim();
  if (!/^[a-z0-9-]{16,64}$/i.test(sessionId)) {
    return res.status(400).json({ code: 400, msg: '分享会话无效，请重新分享' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT id, status, created_at
       FROM user_bilibili_share_events
       WHERE username = ? AND share_session_id = ?
       LIMIT 1 FOR UPDATE`,
      [username, sessionId]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ code: 404, msg: '分享会话不存在，请重新分享' });
    }
    if (String(rows[0].status) === 'completed') {
      await conn.commit();
      var existingStatus = await readBilibiliShareRewardStatus(username);
      return res.json({ code: 200, data: existingStatus });
    }
    const [ageRows] = await conn.execute(
      `SELECT TIMESTAMPDIFF(SECOND, created_at, CURRENT_TIMESTAMP) AS age_seconds
       FROM user_bilibili_share_events WHERE id = ? LIMIT 1`,
      [rows[0].id]
    );
    var age = Math.max(0, parseInt(ageRows[0] && ageRows[0].age_seconds, 10) || 0);
    if (age < BILIBILI_SHARE_MIN_COMPLETE_SECONDS) {
      await conn.rollback();
      return res.status(409).json({ code: 409, msg: '请完成分享后再返回领取次数' });
    }
    if (age > BILIBILI_SHARE_SESSION_TTL_MINUTES * 60) {
      await conn.execute(
        `UPDATE user_bilibili_share_events SET status = 'expired' WHERE id = ?`,
        [rows[0].id]
      );
      await conn.commit();
      return res.status(410).json({ code: 410, msg: '分享会话已过期，请重新分享' });
    }
    await conn.execute(
      `UPDATE user_bilibili_share_events
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending'`,
      [rows[0].id]
    );
    await conn.commit();
    var status = await readBilibiliShareRewardStatus(username);
    return res.json({ code: 200, data: status });
  } catch (e) {
    try {
      await conn.rollback();
    } catch (rollbackError) {}
    console.error('complete bilibili share reward', e);
    return res.status(500).json({ code: 500, msg: '分享次数领取失败，请稍后重试' });
  } finally {
    conn.release();
  }
}

/** 支付页 B 站分享活动：查询进度和可用优惠 */
async function handleBilibiliShareStatus(req, res) {
  try {
    var status = await readBilibiliShareRewardStatus(req.authUserId || '');
    return res.json({ code: 200, data: status });
  } catch (e) {
    console.error('get bilibili share reward status', e);
    return res.status(500).json({ code: 500, msg: '读取分享活动进度失败' });
  }
}

/** C 端：查询我的心理价出价状态（enabled + 最近一条 + 返回拦截资格） */
async function handlePriceBidGet(req, res) {
  try {
    var cfg = await getPriceBids().loadConfig();
    var bid = await getPriceBids().getLatestBid(req.authUserId || '');
    var backCtx = { within_48h: false, hours_since_register: null, visit_count: 0, eligible: false };
    try {
      if (typeof getPriceBids().getBackPromptContext === 'function') {
        backCtx = await getPriceBids().getBackPromptContext(req.authUserId || '');
      }
    } catch (eCtx) {
      /* ignore */
    }
    return res.json({
      code: 200,
      data: {
        enabled: !!cfg.enabled,
        min_amount: cfg.min_amount,
        back_prompt: {
          eligible: !!(cfg.enabled && backCtx.eligible && !(bid && bid.status === 'accepted')),
          within_48h: !!backCtx.within_48h,
          hours_since_register: backCtx.hours_since_register,
          visit_count: Number(backCtx.visit_count) || 0,
          registered_at: backCtx.registered_at || null
        },
        bid: bid
          ? {
              status: bid.status,
              bid_amount: bid.bid_amount,
              accepted_amount: bid.accepted_amount,
              sku_label: bid.sku_label,
              note: bid.note || '',
              created_at: bid.created_at
            }
          : null
      }
    });
  } catch (e) {
    console.error('price bid get', e);
    return res.status(500).json({ code: 500, msg: '读取出价状态失败' });
  }
}

/** C 端：提交心理价（达线自动放价，未达线转人工） */
async function handlePriceBidSubmit(req, res) {
  try {
    var body = req.body || {};
    var out = await getPriceBids().submitBid(req.authUserId || '', {
      sku_id: body.sku_id,
      amount: body.amount,
      note: body.note
    });
    var msg =
      out.status === 'accepted'
        ? '已按你的心理价 ¥' + out.accepted_amount + ' 生效，现在就能按新价开通'
        : out.updated
          ? '已更新出价，通过后会发站内信通知你'
          : '已提交，通过后会发站内信通知你';
    return res.json({ code: 200, msg: msg, data: out });
  } catch (e) {
    var code = e && e.statusCode ? e.statusCode : 500;
    if (code === 500) console.error('price bid submit', e);
    return res.status(code).json({ code: code, msg: (e && e.message) || '提交出价失败' });
  }
}

/** 返回支付宝公开配置（含定价 A/B/C SKU 列表） */
async function handleAlipayConfig(req, res) {
  var envProduct = getAlipayProductConfig();
  var baseEnabled = alipay.isConfigured() && !!envProduct.amount;
  try {
    var offer = await getPricingAb().resolveOfferForUser(
      req.authUserId || '',
      envProduct.amount,
      envProduct.subject,
      readPreferredPurchaseAbc(req)
    );
    try {
      offer = await applyAgentChannelPricesToOffer(offer, req.authUserId || '', req);
    } catch (eChPrice) {
      console.error('alipay config channel_price', eChPrice);
    }
    var customOffer = null;
    try {
      if (req.authUserId) {
        var appliedCfg = await getUserPriceOffers().applyOfferToPricingOffer(
          req.authUserId,
          offer
        );
        offer = appliedCfg.offer || offer;
        customOffer = appliedCfg.customOffer || null;
      }
    } catch (eCustomCfg) {
      console.error('alipay config user_price_offer', eCustomCfg);
    }
    try {
      if (req.authUserId && (await userMustHideSelfServePay(req.authUserId))) {
        return res.json({
          code: 200,
          data: {
            enabled: true,
            subject: envProduct.subject,
            amount: envProduct.amount,
            pricing_variant: 'control',
            abc_variant: 'b',
            abc_source: 'agent_channel',
            pricing_ab_enabled: !!offer.pricing_ab_enabled,
            forced_by_channel: true,
            force_client_abc: true,
            code_only: false,
            hide_self_serve_pay: false,
            custom_offer: false,
            skus: (DEFAULT_PRICING_AB.treatment_skus || []).map(function (s) {
              return {
                id: s.id,
                amount: s.amount,
                label: s.label,
                subject: s.subject,
                grant_kind: s.grant_kind,
                grant_days: s.grant_days,
                grant_hours: s.grant_hours,
                grant_minutes: s.grant_minutes || 0
              };
            })
          }
        });
      }
    } catch (eHide) {}
    if (!baseEnabled) {
      return res.json({
        code: 200,
        data: {
          enabled: false,
          subject: envProduct.subject,
          amount: envProduct.amount,
          pricing_variant: offer.variant || 'control',
          abc_variant: offer.abc_variant || 'b',
          abc_source: offer.abc_source || '',
          pricing_ab_enabled: !!offer.pricing_ab_enabled,
          forced_by_channel: !!offer.forced_by_channel,
          force_client_abc: !!offer.force_client_abc,
          custom_offer: !!customOffer,
          skus: []
        }
      });
    }
    var skus = (offer.skus || []).map(function (s) {
      return {
        id: s.id,
        amount: s.amount,
        list_amount: s.list_amount || '',
        psych_offer: !!s.psych_offer,
        channel_price: !!s.channel_price,
        label: s.label,
        subject: s.subject,
        grant_kind: s.grant_kind,
        grant_days: s.grant_days,
        grant_hours: s.grant_hours,
        grant_minutes: s.grant_minutes || 0
      };
    });
    var primary = skus[0] || null;
    return res.json({
      code: 200,
      data: {
        enabled: true,
        subject: primary ? primary.subject : envProduct.subject,
        amount: primary ? primary.amount : envProduct.amount,
        pricing_variant: customOffer ? 'custom_offer' : offer.variant,
        abc_variant: offer.abc_variant || (offer.variant === 'treatment' ? 'b' : 'a'),
        abc_source: offer.abc_source || '',
        pricing_ab_enabled: !!offer.pricing_ab_enabled,
        forced_by_channel: !!offer.forced_by_channel,
        force_client_abc: !!offer.force_client_abc,
        custom_offer: !!customOffer,
        github_entry: !!offer.github_entry,
        channel_prices: !!offer.channel_prices,
        channel_id: offer.channel_id || null,
        skus: skus
      }
    });
  } catch (e) {
    console.error('alipay config pricing_ab', e);
    if (!baseEnabled) {
      return res.json({
        code: 200,
        data: { enabled: false, subject: envProduct.subject, amount: envProduct.amount, skus: [] }
      });
    }
    return res.json({
      code: 200,
      data: {
        enabled: true,
        subject: envProduct.subject,
        amount: envProduct.amount,
        pricing_variant: 'control',
        abc_variant: 'b',
        pricing_ab_enabled: false,
        skus: (DEFAULT_PRICING_AB.treatment_skus || []).map(function (s) {
          return {
            id: s.id,
            amount: s.amount,
            label: s.label,
            subject: s.subject,
            grant_kind: s.grant_kind,
            grant_days: s.grant_days,
            grant_hours: s.grant_hours,
            grant_minutes: s.grant_minutes || 0
          };
        })
      }
    });
  }
}

/** 增值商品（改名/个税修改等）当面付下单：复用 30 分钟内未支付订单 */
async function createAddonFaceToFaceOrder(req, res, spec) {
  if (!req.authUserId) {
    return res.status(401).json({ code: 401, msg: '请先登录' });
  }
  var amount = alipay.normalizeAmount(spec.amount);
  if (!amount) {
    return res.status(503).json({ code: 503, msg: spec.invalidAmountMsg || '费用配置无效' });
  }
  const conn = await pool.getConnection();
  var order = null;
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute(
      `SELECT id, out_trade_no, subject, amount, status, paid_at, pricing_variant, sku_id,
              grant_kind, grant_days, grant_hours, grant_minutes
       FROM payment_orders
       WHERE username = ? AND status = 'pending' AND sku_id = ?
         AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [req.authUserId, spec.skuId]
    );
    if (existing.length) {
      order = existing[0];
    } else {
      order = {
        out_trade_no: createAlipayOutTradeNo(),
        subject: spec.subject,
        amount: amount,
        status: 'pending',
        pricing_variant: spec.pricingVariant,
        sku_id: spec.skuId,
        grant_kind: spec.grantKind,
        grant_days: 0,
        grant_hours: 0,
        grant_minutes: 0
      };
      await conn.execute(
        `INSERT INTO payment_orders
         (out_trade_no, username, subject, amount, status, pricing_variant, sku_id, grant_kind, grant_days, grant_hours, grant_minutes)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
        [
          order.out_trade_no,
          req.authUserId,
          order.subject,
          order.amount,
          order.pricing_variant,
          order.sku_id,
          order.grant_kind,
          order.grant_days,
          order.grant_hours,
          order.grant_minutes
        ]
      );
    }
    await conn.commit();
  } catch (eDb) {
    try {
      await conn.rollback();
    } catch (eRb) {}
    console.error('create addon order db', spec.product, eDb);
    try {
      conn.release();
    } catch (eRel) {}
    return res.status(500).json({ code: 500, msg: spec.dbFailMsg || '创建订单失败' });
  }
  try {
    var pre = await alipay.createFaceToFaceQr({
      outTradeNo: String(order.out_trade_no),
      subject: String(order.subject),
      amount: alipay.normalizeAmount(order.amount)
    });
    return res.json({
      code: 200,
      data: {
        order: plainPaymentOrder(order),
        qr_code: pre.qrCode,
        payment_url: pre.qrCode,
        pricing_variant: spec.pricingVariant,
        sku_id: spec.skuId,
        product: spec.product
      }
    });
  } catch (ePay) {
    console.error('create addon precreate', spec.product, ePay);
    return res.status(500).json({ code: 500, msg: spec.payFailMsg || '创建支付宝订单失败' });
  } finally {
    try {
      conn.release();
    } catch (eRel2) {}
  }
}

/** 创建支付宝当面付预下单 */
async function handleAlipayCreateOrder(req, res) {
  if (!alipay.isConfigured()) {
    return res.status(503).json({ code: 503, msg: '支付宝支付暂未配置，请选择其它购买方式' });
  }
  var body = req.body && typeof req.body === 'object' ? req.body : {};
  var product = body.product != null ? String(body.product).trim() : '';
  var skuIdReq = body.sku_id != null ? String(body.sku_id).trim() : '';
  var isRenameFee =
    product === 'rename_fee' || isRenameFeeSkuId(skuIdReq) || skuIdReq === 'rename_fee';
  var isTaxEditDaily =
    product === 'tax_edit_unlimited' ||
    product === 'tax_edit_fee' ||
    product === 'tax_edit_single' ||
    taxEditFeePolicy.isTaxEditFeeSkuId(skuIdReq);

  var isLizhiCert =
    product === 'lizhi_cert' || isLizhiCertSkuId(skuIdReq) || skuIdReq === 'lizhi_cert';

  /* —— 离职证明终身权益（不走开通激活逻辑） —— */
  if (isLizhiCert) {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    const [lizhiUsers] = await pool.execute(
      'SELECT lizhi_cert_unlocked FROM users WHERE username = ? LIMIT 1',
      [req.authUserId]
    );
    if (
      lizhiUsers.length &&
      (lizhiUsers[0].lizhi_cert_unlocked === true ||
        Number(lizhiUsers[0].lizhi_cert_unlocked) === 1)
    ) {
      return res.status(409).json({ code: 409, msg: '离职证明无水印权益已开通，无需重复购买' });
    }
    var lizhiFeeCfg = await loadLizhiCertFeeConfig(false);
    var lizhiAmount = alipay.normalizeAmount(lizhiFeeCfg.amount || LIZHI_CERT_AMOUNT);
    if (!lizhiAmount) {
      return res.status(503).json({ code: 503, msg: '离职证明费用配置无效' });
    }
    const connLizhi = await pool.getConnection();
    var lizhiOrder = null;
    try {
      await connLizhi.beginTransaction();
      const [existingLizhi] = await connLizhi.execute(
        `SELECT id, out_trade_no, subject, amount, status, paid_at, pricing_variant, sku_id,
                grant_kind, grant_days, grant_hours, grant_minutes
         FROM payment_orders
         WHERE username = ? AND status = 'pending' AND sku_id = ?
           AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [req.authUserId, LIZHI_CERT_SKU_ID]
      );
      if (existingLizhi.length) {
        lizhiOrder = existingLizhi[0];
      } else {
        lizhiOrder = {
          out_trade_no: createAlipayOutTradeNo(),
          subject: LIZHI_CERT_SUBJECT,
          amount: lizhiAmount,
          status: 'pending',
          pricing_variant: 'lizhi_cert',
          sku_id: LIZHI_CERT_SKU_ID,
          grant_kind: 'lizhi_cert',
          grant_days: 0,
          grant_hours: 0,
          grant_minutes: 0
        };
        await connLizhi.execute(
          `INSERT INTO payment_orders
           (out_trade_no, username, subject, amount, status, pricing_variant, sku_id, grant_kind, grant_days, grant_hours, grant_minutes)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
          [
            lizhiOrder.out_trade_no,
            req.authUserId,
            lizhiOrder.subject,
            lizhiOrder.amount,
            lizhiOrder.pricing_variant,
            lizhiOrder.sku_id,
            lizhiOrder.grant_kind,
            lizhiOrder.grant_days,
            lizhiOrder.grant_hours,
            lizhiOrder.grant_minutes
          ]
        );
      }
      await connLizhi.commit();
    } catch (eLizhiDb) {
      try {
        await connLizhi.rollback();
      } catch (eRb) {}
      console.error('create lizhi cert order db', eLizhiDb);
      try {
        connLizhi.release();
      } catch (eRel) {}
      return res.status(500).json({ code: 500, msg: '创建离职证明订单失败' });
    }
    try {
      var lizhiPre = await alipay.createFaceToFaceQr({
        outTradeNo: String(lizhiOrder.out_trade_no),
        subject: String(lizhiOrder.subject),
        amount: alipay.normalizeAmount(lizhiOrder.amount)
      });
      return res.json({
        code: 200,
        data: {
          order: plainPaymentOrder(lizhiOrder),
          qr_code: lizhiPre.qrCode,
          payment_url: lizhiPre.qrCode,
          pricing_variant: 'lizhi_cert',
          sku_id: LIZHI_CERT_SKU_ID,
          product: 'lizhi_cert'
        }
      });
    } catch (eLizhiPay) {
      console.error('create lizhi cert precreate', eLizhiPay);
      return res.status(500).json({ code: 500, msg: '创建支付宝离职证明订单失败' });
    } finally {
      try {
        connLizhi.release();
      } catch (eRel2) {}
    }
  }

  var isZaizhiCert =
    product === 'zaizhi_cert' || isZaizhiCertSkuId(skuIdReq) || skuIdReq === 'zaizhi_cert';

  /* —— 在职/工作证明终身权益（不走开通激活逻辑） —— */
  if (isZaizhiCert) {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    const [zaizhiUsers] = await pool.execute(
      'SELECT zaizhi_cert_unlocked FROM users WHERE username = ? LIMIT 1',
      [req.authUserId]
    );
    if (
      zaizhiUsers.length &&
      (zaizhiUsers[0].zaizhi_cert_unlocked === true ||
        Number(zaizhiUsers[0].zaizhi_cert_unlocked) === 1)
    ) {
      return res.status(409).json({ code: 409, msg: '在职证明无水印权益已开通，无需重复购买' });
    }
    var zaizhiFeeCfg = await loadLizhiCertFeeConfig(false);
    var zaizhiAmount = alipay.normalizeAmount(zaizhiFeeCfg.amount || ZAIZHI_CERT_AMOUNT);
    if (!zaizhiAmount) {
      return res.status(503).json({ code: 503, msg: '在职证明费用配置无效' });
    }
    const connZaizhi = await pool.getConnection();
    var zaizhiOrder = null;
    try {
      await connZaizhi.beginTransaction();
      const [existingZaizhi] = await connZaizhi.execute(
        `SELECT id, out_trade_no, subject, amount, status, paid_at, pricing_variant, sku_id,
                grant_kind, grant_days, grant_hours, grant_minutes
         FROM payment_orders
         WHERE username = ? AND status = 'pending' AND sku_id = ?
           AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [req.authUserId, ZAIZHI_CERT_SKU_ID]
      );
      if (existingZaizhi.length) {
        zaizhiOrder = existingZaizhi[0];
      } else {
        zaizhiOrder = {
          out_trade_no: createAlipayOutTradeNo(),
          subject: ZAIZHI_CERT_SUBJECT,
          amount: zaizhiAmount,
          status: 'pending',
          pricing_variant: 'zaizhi_cert',
          sku_id: ZAIZHI_CERT_SKU_ID,
          grant_kind: 'zaizhi_cert',
          grant_days: 0,
          grant_hours: 0,
          grant_minutes: 0
        };
        await connZaizhi.execute(
          `INSERT INTO payment_orders
           (out_trade_no, username, subject, amount, status, pricing_variant, sku_id, grant_kind, grant_days, grant_hours, grant_minutes)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
          [
            zaizhiOrder.out_trade_no,
            req.authUserId,
            zaizhiOrder.subject,
            zaizhiOrder.amount,
            zaizhiOrder.pricing_variant,
            zaizhiOrder.sku_id,
            zaizhiOrder.grant_kind,
            zaizhiOrder.grant_days,
            zaizhiOrder.grant_hours,
            zaizhiOrder.grant_minutes
          ]
        );
      }
      await connZaizhi.commit();
    } catch (eZaizhiDb) {
      try {
        await connZaizhi.rollback();
      } catch (eRb) {}
      console.error('create zaizhi cert order db', eZaizhiDb);
      try {
        connZaizhi.release();
      } catch (eRel) {}
      return res.status(500).json({ code: 500, msg: '创建在职证明订单失败' });
    }
    try {
      var zaizhiPre = await alipay.createFaceToFaceQr({
        outTradeNo: String(zaizhiOrder.out_trade_no),
        subject: String(zaizhiOrder.subject),
        amount: alipay.normalizeAmount(zaizhiOrder.amount)
      });
      return res.json({
        code: 200,
        data: {
          order: plainPaymentOrder(zaizhiOrder),
          qr_code: zaizhiPre.qrCode,
          payment_url: zaizhiPre.qrCode,
          pricing_variant: 'zaizhi_cert',
          sku_id: ZAIZHI_CERT_SKU_ID,
          product: 'zaizhi_cert'
        }
      });
    } catch (eZaizhiPay) {
      console.error('create zaizhi cert precreate', eZaizhiPay);
      return res.status(500).json({ code: 500, msg: '创建支付宝在职证明订单失败' });
    } finally {
      try {
        connZaizhi.release();
      } catch (eRel2) {}
    }
  }

  var isNajiluQr =
    product === 'najilu_qr' || isNajiluQrSkuId(skuIdReq) || skuIdReq === 'najilu_qr';

  /* —— 完税二维码去水印终身权益（不走开通激活逻辑） —— */
  if (isNajiluQr) {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    try {
      await najiluQrMod.ensureNajiluQrUnlockedColumn(pool);
    } catch (eCol) {}
    var unlockedNajilu = false;
    try {
      unlockedNajilu = await najiluQrMod.userHasNajiluQrUnlocked(req.authUserId);
    } catch (eUn) {
      unlockedNajilu = false;
    }
    if (unlockedNajilu) {
      return res.status(409).json({ code: 409, msg: '完税二维码去水印权益已开通，无需重复购买' });
    }
    var najiluFeeCfg = await najiluQrMod.loadNajiluQrFeeConfig(false);
    var najiluAmount = alipay.normalizeAmount(
      (najiluFeeCfg && najiluFeeCfg.amount) || NAJILU_QR_AMOUNT
    );
    return createAddonFaceToFaceOrder(req, res, {
      product: 'najilu_qr',
      skuId: NAJILU_QR_SKU_ID,
      subject: NAJILU_QR_SUBJECT,
      amount: najiluAmount,
      grantKind: 'najilu_qr',
      pricingVariant: 'najilu_qr',
      invalidAmountMsg: '完税二维码费用配置无效',
      dbFailMsg: '创建完税二维码订单失败',
      payFailMsg: '创建支付宝完税二维码订单失败'
    });
  }

  var isSbdyDemo =
    product === 'sbdy_demo' || isSbdyDemoSkuId(skuIdReq) || skuIdReq === 'sbdy_demo';

  /* —— 社保演示终身权益（不走开通激活逻辑） —— */
  if (isSbdyDemo) {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var sbdyUnlockedRow = null;
    try {
      const [sbdyUsers] = await pool.execute(
        'SELECT sbdy_demo_unlocked FROM users WHERE username = ? LIMIT 1',
        [req.authUserId]
      );
      sbdyUnlockedRow = sbdyUsers.length ? sbdyUsers[0] : null;
    } catch (eSbdyCol) {
      sbdyUnlockedRow = null;
    }
    if (
      sbdyUnlockedRow &&
      (sbdyUnlockedRow.sbdy_demo_unlocked === true ||
        Number(sbdyUnlockedRow.sbdy_demo_unlocked) === 1)
    ) {
      return res.status(409).json({ code: 409, msg: '社保演示去水印权益已开通，无需重复购买' });
    }
    var sbdyAmount = alipay.normalizeAmount(SBDY_DEMO_AMOUNT);
    if (!sbdyAmount) {
      return res.status(503).json({ code: 503, msg: '社保演示费用配置无效' });
    }
    const connSbdy = await pool.getConnection();
    var sbdyOrder = null;
    try {
      await connSbdy.beginTransaction();
      const [existingSbdy] = await connSbdy.execute(
        `SELECT id, out_trade_no, subject, amount, status, paid_at, pricing_variant, sku_id,
                grant_kind, grant_days, grant_hours, grant_minutes
         FROM payment_orders
         WHERE username = ? AND status = 'pending' AND sku_id = ?
           AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [req.authUserId, SBDY_DEMO_SKU_ID]
      );
      if (existingSbdy.length) {
        sbdyOrder = existingSbdy[0];
      } else {
        sbdyOrder = {
          out_trade_no: createAlipayOutTradeNo(),
          subject: SBDY_DEMO_SUBJECT,
          amount: sbdyAmount,
          status: 'pending',
          pricing_variant: 'sbdy_demo',
          sku_id: SBDY_DEMO_SKU_ID,
          grant_kind: 'sbdy_demo',
          grant_days: 0,
          grant_hours: 0,
          grant_minutes: 0
        };
        await connSbdy.execute(
          `INSERT INTO payment_orders
           (out_trade_no, username, subject, amount, status, pricing_variant, sku_id, grant_kind, grant_days, grant_hours, grant_minutes)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
          [
            sbdyOrder.out_trade_no,
            req.authUserId,
            sbdyOrder.subject,
            sbdyOrder.amount,
            sbdyOrder.pricing_variant,
            sbdyOrder.sku_id,
            sbdyOrder.grant_kind,
            sbdyOrder.grant_days,
            sbdyOrder.grant_hours,
            sbdyOrder.grant_minutes
          ]
        );
      }
      await connSbdy.commit();
    } catch (eSbdyDb) {
      try {
        await connSbdy.rollback();
      } catch (eRb) {}
      console.error('create sbdy demo order db', eSbdyDb);
      try {
        connSbdy.release();
      } catch (eRel) {}
      return res.status(500).json({ code: 500, msg: '创建社保演示订单失败' });
    }
    try {
      var sbdyPre = await alipay.createFaceToFaceQr({
        outTradeNo: String(sbdyOrder.out_trade_no),
        subject: String(sbdyOrder.subject),
        amount: alipay.normalizeAmount(sbdyOrder.amount)
      });
      return res.json({
        code: 200,
        data: {
          order: plainPaymentOrder(sbdyOrder),
          qr_code: sbdyPre.qrCode,
          payment_url: sbdyPre.qrCode,
          pricing_variant: 'sbdy_demo',
          sku_id: SBDY_DEMO_SKU_ID,
          product: 'sbdy_demo'
        }
      });
    } catch (eSbdyPay) {
      console.error('create sbdy demo precreate', eSbdyPay);
      return res.status(500).json({ code: 500, msg: '创建支付宝社保演示订单失败' });
    } finally {
      try {
        connSbdy.release();
      } catch (eRel2) {}
    }
  }

  /* —— 改名单次费用（不走开通激活逻辑） —— */
  if (isRenameFee) {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var renameFeeCfg = await loadRenameFeeConfig(false);
    if (!renameFeePolicy.isRenameFeeCharged(renameFeeCfg.amount)) {
      return res.status(409).json({ code: 409, msg: '改名费用为 0，无需付款' });
    }
    var renameAmount = alipay.normalizeAmount(renameFeeCfg.amount);
    if (!renameAmount) {
      return res.status(503).json({ code: 503, msg: '改名费用配置无效' });
    }
    const connRen = await pool.getConnection();
    var renameOrder = null;
    try {
      await connRen.beginTransaction();
      const [existingRen] = await connRen.execute(
        `SELECT id, out_trade_no, subject, amount, status, paid_at, pricing_variant, sku_id,
                grant_kind, grant_days, grant_hours, grant_minutes
         FROM payment_orders
         WHERE username = ? AND status = 'pending' AND sku_id = ?
           AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [req.authUserId, RENAME_FEE_SKU_ID]
      );
      if (existingRen.length) {
        renameOrder = existingRen[0];
      } else {
        renameOrder = {
          out_trade_no: createAlipayOutTradeNo(),
          subject: RENAME_FEE_SUBJECT,
          amount: renameAmount,
          status: 'pending',
          pricing_variant: 'rename',
          sku_id: RENAME_FEE_SKU_ID,
          grant_kind: 'rename_credit',
          grant_days: 0,
          grant_hours: 0,
          grant_minutes: 0
        };
        await connRen.execute(
          `INSERT INTO payment_orders
           (out_trade_no, username, subject, amount, status, pricing_variant, sku_id, grant_kind, grant_days, grant_hours, grant_minutes)
           VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
          [
            renameOrder.out_trade_no,
            req.authUserId,
            renameOrder.subject,
            renameOrder.amount,
            renameOrder.pricing_variant,
            renameOrder.sku_id,
            renameOrder.grant_kind,
            renameOrder.grant_days,
            renameOrder.grant_hours,
            renameOrder.grant_minutes
          ]
        );
      }
      await connRen.commit();
    } catch (eRenDb) {
      try {
        await connRen.rollback();
      } catch (eRb) {}
      console.error('create rename fee order db', eRenDb);
      try {
        connRen.release();
      } catch (eRel) {}
      return res.status(500).json({ code: 500, msg: '创建改名订单失败' });
    }
    try {
      var renPre = await alipay.createFaceToFaceQr({
        outTradeNo: String(renameOrder.out_trade_no),
        subject: String(renameOrder.subject),
        amount: alipay.normalizeAmount(renameOrder.amount)
      });
      return res.json({
        code: 200,
        data: {
          order: plainPaymentOrder(renameOrder),
          qr_code: renPre.qrCode,
          payment_url: renPre.qrCode,
          pricing_variant: 'rename',
          sku_id: RENAME_FEE_SKU_ID,
          product: 'rename_fee'
        }
      });
    } catch (eRenPay) {
      console.error('create rename fee precreate', eRenPay);
      return res.status(500).json({ code: 500, msg: '创建支付宝改名订单失败' });
    } finally {
      try {
        connRen.release();
      } catch (eRel2) {}
    }
  }

  /* —— 同行账号个税修改：当天无限（不走开通激活逻辑；旧单次 SKU 一律按当天无限下单） —— */
  if (isTaxEditDaily) {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    if (await hasTaxEditDailyUnlock(req.authUserId, chinaDateKeyNow())) {
      return res.status(409).json({ code: 409, msg: '今日已开通个税无限修改，无需重复购买' });
    }
    var taxFeeSkuId = taxEditFeePolicy.TAX_EDIT_DAILY_SKU_ID;
    var taxFeeAmounts = await loadTaxEditFeeConfig(false);
    var taxFeeAmount = alipay.normalizeAmount(taxFeeAmounts.daily_amount);
    var taxFeeSubject = taxEditFeePolicy.TAX_EDIT_DAILY_SUBJECT;
    var taxFeeGrantKind = 'tax_edit_daily';
    var taxFeeProduct = 'tax_edit_unlimited';
    /* payment_orders.pricing_variant 历史列为 VARCHAR(16)，不可写入 tax_edit_unlimited(18) */
    var taxFeePricingVariant = 'tax_daily';
    if (!taxFeeAmount) {
      return res.status(503).json({ code: 503, msg: '个税修改费用配置无效' });
    }
    await ensurePaymentOrdersVariantColumns(pool);
    const connTaxFee = await pool.getConnection();
    var taxFeeOrder = null;
    try {
      await connTaxFee.beginTransaction();
      var existingTaxFee = await findRecentPendingAddonOrder(connTaxFee, req.authUserId, taxFeeSkuId);
      if (existingTaxFee.length) {
        taxFeeOrder = existingTaxFee[0];
      } else {
        taxFeeOrder = {
          out_trade_no: createAlipayOutTradeNo(),
          username: req.authUserId,
          subject: taxFeeSubject,
          amount: taxFeeAmount,
          status: 'pending',
          pricing_variant: taxFeePricingVariant,
          sku_id: taxFeeSkuId,
          grant_kind: taxFeeGrantKind,
          grant_days: 0,
          grant_hours: 0,
          grant_minutes: 0
        };
        await insertPendingAddonOrder(connTaxFee, taxFeeOrder);
      }
      await connTaxFee.commit();
    } catch (eTaxFeeDb) {
      try {
        await connTaxFee.rollback();
      } catch (eRb) {}
      console.error('create tax edit fee order db', eTaxFeeDb);
      try {
        connTaxFee.release();
      } catch (eRel) {}
      var dbHint = paymentDbErrorHint(eTaxFeeDb);
      return res.status(500).json({
        code: 500,
        msg: dbHint ? '创建个税修改订单失败：' + dbHint : '创建个税修改订单失败'
      });
    }
    try {
      var taxFeePre = await alipay.createFaceToFaceQr({
        outTradeNo: String(taxFeeOrder.out_trade_no),
        subject: String(taxFeeOrder.subject),
        amount: alipay.normalizeAmount(taxFeeOrder.amount)
      });
      return res.json({
        code: 200,
        data: {
          order: plainPaymentOrder(taxFeeOrder),
          qr_code: taxFeePre.qrCode,
          payment_url: taxFeePre.qrCode,
          pricing_variant: taxFeePricingVariant,
          sku_id: taxFeeSkuId,
          product: taxFeeProduct
        }
      });
    } catch (eTaxFeePay) {
      console.error('create tax edit fee precreate', eTaxFeePay);
      return res.status(500).json({ code: 500, msg: '创建支付宝个税修改订单失败' });
    } finally {
      try {
        connTaxFee.release();
      } catch (eRel2) {}
    }
  }

  if (req.authUserRow && isUserPermanentActive(req.authUserRow)) {
    return res.status(409).json({ code: 409, msg: '当前账号已永久激活，无需重复购买' });
  }
  var envProduct = getAlipayProductConfig();
  if (!envProduct.amount) {
    return res.status(503).json({ code: 503, msg: '支付宝商品金额配置无效' });
  }
  var offer;
  try {
    offer = await getPricingAb().resolveOfferForUser(
      req.authUserId || '',
      envProduct.amount,
      envProduct.subject,
      readPreferredPurchaseAbc(req)
    );
  } catch (eOffer) {
    console.error('pricing offer', eOffer);
    return res.status(500).json({ code: 500, msg: '读取定价配置失败' });
  }
  try {
    offer = await applyAgentChannelPricesToOffer(offer, req.authUserId || '', req);
  } catch (eChPriceCreate) {
    console.error('create order channel_price', eChPriceCreate);
  }
  var customOffer = null;
  try {
    var appliedCreate = await getUserPriceOffers().applyOfferToPricingOffer(
      req.authUserId || '',
      offer
    );
    offer = appliedCreate.offer || offer;
    customOffer = appliedCreate.customOffer || null;
  } catch (eCustomCreate) {
    console.error('create order user_price_offer', eCustomCreate);
  }
  if (offer.abc_variant === 'c' || offer.variant === 'c') {
    offer.abc_variant = 'b';
    offer.variant = 'treatment';
  }
  try {
    if (await userMustHideSelfServePay(req.authUserId || '')) {
      return res.status(403).json({
        code: 403,
        msg: '当前渠道仅支持激活码开通，不支持在线支付'
      });
    }
  } catch (eCodeOnly) {}
  var sku = getPricingAb().pickSkuFromOffer(offer, skuIdReq);
  if (!sku && customOffer) {
    sku = getUserPriceOffers().buildSkuFromOffer(customOffer);
  }
  if (!sku) {
    return res.status(400).json({ code: 400, msg: '请选择要购买的套餐' });
  }
  if (customOffer && String(sku.id) !== String(customOffer.sku_id)) {
    return res.status(400).json({
      code: 400,
      msg: '当前账号已设置专属报价，请按专属套餐支付'
    });
  }
  var listAmount = alipay.normalizeAmount(sku.amount);
  if (!listAmount) {
    return res.status(503).json({ code: 503, msg: '商品金额无效' });
  }
  /* 覆盖规则：若当前试用剩余更长，拒绝购买更短档 */
  if (req.authUserRow && sku.grant_kind !== 'permanent') {
    var coverPreview = getPricingAb().resolveCoverLongerGrant(req.authUserRow, sku);
    if (coverPreview.reason === 'keep_longer_existing') {
      return res.status(409).json({
        code: 409,
        msg: '当前试用剩余时间更长，请选择更长时效或永久套餐'
      });
    }
  }

  const conn = await pool.getConnection();
  var order = null;
  try {
    await conn.beginTransaction();
    /* 释放已关闭/超时订单占用的分享次数，再关闭超时订单 */
    await conn.execute(
      `UPDATE user_bilibili_share_events se
       INNER JOIN payment_orders po ON po.out_trade_no = se.reserved_order_no
       SET se.reserved_order_no = NULL
       WHERE se.username = ? AND se.consumed_at IS NULL
         AND (po.status <> 'pending'
           OR po.created_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE))`,
      [req.authUserId]
    );
    await conn.execute(
      `UPDATE payment_orders
       SET status = 'closed'
       WHERE username = ? AND status = 'pending'
         AND created_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)`,
      [req.authUserId]
    );
    const [existingRows] = await conn.execute(
      `SELECT id, out_trade_no, subject, amount, status, paid_at, pricing_variant, sku_id,
              grant_kind, grant_days, grant_hours, grant_minutes,
              list_amount, discount_amount, share_discount_count
       FROM payment_orders
       WHERE username = ? AND status = 'pending'
         AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [req.authUserId]
    );
    if (existingRows.length) {
      var ex = existingRows[0];
      var sameSku = String(ex.sku_id || '') === String(sku.id);
      var sameListAmount =
        alipay.normalizeAmount(ex.list_amount != null ? ex.list_amount : ex.amount) ===
        listAmount;
      var existingHasShareDiscount =
        Math.max(0, parseInt(ex.share_discount_count, 10) || 0) >=
        BILIBILI_SHARE_DISCOUNT_THRESHOLD;
      var availableForUpgrade = 0;
      if (sameSku && sameListAmount && !existingHasShareDiscount) {
        const [upgradeRows] = await conn.execute(
          `SELECT COUNT(*) AS c
           FROM user_bilibili_share_events
           WHERE username = ? AND status = 'completed'
             AND consumed_at IS NULL AND reserved_order_no IS NULL`,
          [req.authUserId]
        );
        availableForUpgrade = Number((upgradeRows[0] || {}).c) || 0;
      }
      if (
        sameSku &&
        sameListAmount &&
        (existingHasShareDiscount ||
          availableForUpgrade < BILIBILI_SHARE_DISCOUNT_THRESHOLD)
      ) {
        order = ex;
      } else {
        await conn.execute(`UPDATE payment_orders SET status = 'closed' WHERE id = ?`, [ex.id]);
        await conn.execute(
          `UPDATE user_bilibili_share_events
           SET reserved_order_no = NULL
           WHERE username = ? AND reserved_order_no = ? AND consumed_at IS NULL`,
          [req.authUserId, ex.out_trade_no]
        );
      }
    }
    if (!order) {
      /* mysql2 execute 不支持 LIMIT ?，需内联安全整数 */
      var shareLimit = Math.max(
        1,
        Math.min(50, parseInt(BILIBILI_SHARE_DISCOUNT_THRESHOLD, 10) || 1)
      );
      const [shareRows] = BILIBILI_SHARE_DISCOUNT_ENABLED
        ? await conn.execute(
            `SELECT id
             FROM user_bilibili_share_events
             WHERE username = ? AND status = 'completed'
               AND consumed_at IS NULL AND reserved_order_no IS NULL
             ORDER BY completed_at ASC, id ASC
             LIMIT ${shareLimit} FOR UPDATE`,
            [req.authUserId]
          )
        : [[]];
      var shareDiscountCount =
        BILIBILI_SHARE_DISCOUNT_ENABLED &&
        shareRows.length >= BILIBILI_SHARE_DISCOUNT_THRESHOLD
          ? BILIBILI_SHARE_DISCOUNT_THRESHOLD
          : 0;
      var discountAmount =
        shareDiscountCount >= BILIBILI_SHARE_DISCOUNT_THRESHOLD
          ? BILIBILI_SHARE_DISCOUNT_AMOUNT
          : '0.00';
      var payableCents = Math.round(Number(listAmount) * 100);
      if (shareDiscountCount) {
        payableCents = Math.max(
          1,
          payableCents - Math.round(Number(discountAmount) * 100)
        );
      }
      var amount = alipay.normalizeAmount((payableCents / 100).toFixed(2));
      order = {
        out_trade_no: createAlipayOutTradeNo(),
        subject: String(sku.subject || envProduct.subject).slice(0, 128),
        amount: amount,
        list_amount: listAmount,
        discount_amount: discountAmount,
        share_discount_count: shareDiscountCount,
        status: 'pending',
        pricing_variant: customOffer ? 'custom_offer' : offer.variant,
        sku_id: sku.id,
        grant_kind: sku.grant_kind,
        grant_days: sku.grant_days || 0,
        grant_hours: sku.grant_hours || 0,
        grant_minutes: sku.grant_minutes || 0
      };
      await conn.execute(
        `INSERT INTO payment_orders
         (out_trade_no, username, subject, amount, list_amount, discount_amount,
          share_discount_count, status, pricing_variant, sku_id, grant_kind,
          grant_days, grant_hours, grant_minutes)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`,
        [
          order.out_trade_no,
          req.authUserId,
          order.subject,
          order.amount,
          order.list_amount,
          order.discount_amount,
          order.share_discount_count,
          order.pricing_variant,
          order.sku_id,
          order.grant_kind,
          order.grant_days,
          order.grant_hours,
          order.grant_minutes
        ]
      );
      if (shareDiscountCount) {
        var shareIds = shareRows.slice(0, shareDiscountCount).map(function (row) {
          return Number(row.id);
        });
        await conn.query(
          `UPDATE user_bilibili_share_events
           SET reserved_order_no = ?
           WHERE username = ? AND id IN (` +
            shareIds.map(function () { return '?'; }).join(',') +
            `) AND consumed_at IS NULL AND reserved_order_no IS NULL`,
          [order.out_trade_no, req.authUserId].concat(shareIds)
        );
      }
    }
    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch (rollbackError) {}
    console.error('create alipay order db', e);
    try {
      conn.release();
    } catch (releaseErr) {}
    return res.status(500).json({ code: 500, msg: '创建支付宝订单失败' });
  }
  try {
    var precreate = await alipay.createFaceToFaceQr({
      outTradeNo: String(order.out_trade_no),
      subject: String(order.subject),
      amount: alipay.normalizeAmount(order.amount)
    });
    return res.json({
      code: 200,
      data: {
        order: plainPaymentOrder(order),
        qr_code: precreate.qrCode,
        payment_url: precreate.qrCode,
        pricing_variant: order.pricing_variant || offer.variant,
        sku_id: order.sku_id || sku.id
      }
    });
  } catch (e) {
    console.error('create alipay order precreate', e);
    var tip = e && e.message ? String(e.message) : '创建支付宝订单失败';
    if (/权限|permission|insufficient/i.test(tip)) {
      tip = '支付宝当面付权限异常，请稍后重试或联系客服';
    }
    return res.status(500).json({ code: 500, msg: tip.length > 80 ? '创建支付宝订单失败' : tip });
  } finally {
    try {
      conn.release();
    } catch (releaseErr) {}
  }
}

/** 查询最近支付宝订单并刷新 token */
async function handleAlipayLatestOrder(req, res) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT id, out_trade_no, subject, amount, status, paid_at, alipay_trade_no,
              pricing_variant, sku_id, grant_kind, grant_days, grant_hours, grant_minutes,
              list_amount, discount_amount, share_discount_count
       FROM payment_orders WHERE username = ?
       ORDER BY id DESC LIMIT 1`,
      [req.authUserId]
    );
    var order = rows.length ? rows[0] : null;
    if (
      order &&
      String(order.status) === 'pending' &&
      alipay.isConfigured()
    ) {
      try {
        var trade = await alipay.queryTrade(String(order.out_trade_no));
        if (
          trade &&
          (trade.tradeStatus === 'TRADE_SUCCESS' || trade.tradeStatus === 'TRADE_FINISHED') &&
          trade.tradeNo
        ) {
          var expectedAmount = alipay.normalizeAmount(order.amount);
          if (expectedAmount && trade.totalAmount && expectedAmount === trade.totalAmount) {
            await fulfillAlipayPaidOrder(conn, order, {
              tradeNo: trade.tradeNo,
              buyerLogonId: trade.buyerLogonId,
              tradeStatus: trade.tradeStatus,
              source: 'query_sync'
            });
            const [fresh] = await conn.execute(
              `SELECT id, out_trade_no, subject, amount, status, paid_at, alipay_trade_no,
                      pricing_variant, sku_id, grant_kind, grant_days, grant_hours, grant_minutes,
                      list_amount, discount_amount, share_discount_count
               FROM payment_orders WHERE id = ? LIMIT 1`,
              [order.id]
            );
            if (fresh.length) order = fresh[0];
          }
        }
      } catch (syncErr) {
        console.warn('alipay trade query sync', syncErr && syncErr.message);
      }
    }
    var isAddonOrder =
      order && isNonActivationSkuId(order.sku_id, order.grant_kind);
    var paidActivation =
      !!(order && String(order.status) === 'paid' && !isAddonOrder);
    var freshToken = null;
    if (paidActivation && req.authUserId) {
      /* 付款开通后签发新 JWT，避免客户端仍拿着 act=0 的旧令牌（改名费订单不发开通令牌） */
      var urow = await getUserRowByUsername(req.authUserId);
      if (urow) {
        freshToken = signAccessToken({
          user_id: urow.username,
          username: urow.username,
          account_active: true,
          session_rev: userSessionRevFromRow(urow)
        });
      }
    }
    return res.json({
      code: 200,
      data: {
        order: order ? plainPaymentOrder(order) : null,
        account_active: paidActivation,
        token: freshToken
      }
    });
  } catch (e) {
    console.error('get alipay latest order', e);
    return res.status(500).json({ code: 500, msg: '查询订单失败' });
  } finally {
    conn.release();
  }
}

/** 支付宝：notify payload hash */
function alipayNotifyPayloadHash(body) {
  var pairs = Object.keys(body || {})
    .sort()
    .map(function (key) {
      return key + '=' + String(body[key] == null ? '' : body[key]);
    })
    .join('&');
  return crypto.createHash('sha256').update(pairs, 'utf8').digest('hex');
}

/**
 * 激活退款副作用（封禁 + 隐藏 + 统计剔除）。调用方需已持有事务与用户行锁意图。
 * @returns {Promise<{applied:boolean, already?:boolean, inactive?:boolean, missing?:boolean}>}
 */
async function applyActivationRefundForUser(conn, username, byLabel) {
  var target = username != null ? String(username).trim() : '';
  var by = byLabel != null ? String(byLabel).trim() : 'alipay_refund';
  if (!target) return { applied: false, missing: true };
  const [urows] = await conn.execute(
    'SELECT id, account_active, activation_refunded_at FROM users WHERE username = ? FOR UPDATE',
    [target]
  );
  if (!urows.length) return { applied: false, missing: true };
  if (urows[0].activation_refunded_at) return { applied: false, already: true };
  if (!(urows[0].account_active === 1 || urows[0].account_active === true)) {
    return { applied: false, inactive: true };
  }
  await conn.execute(
    `UPDATE users SET banned = 1, session_rev = session_rev + 1, account_active = 0,
            list_hidden_at = NOW(3), list_hidden_by = ?,
            activation_refunded_at = NOW(3), activation_refunded_by = ?
     WHERE username = ?`,
    [by, by, target]
  );
  return { applied: true };
}

/**
 * 已支付订单全额退款：status=refunded（GMV 不再计入）并尽量做激活退款。
 * 调用方需已持有连接；本函数自行开事务。幂等。
 */
async function markAlipayOrderRefunded(conn, order, info) {
  if (!order || !order.id) return false;
  var tradeNo = info && info.tradeNo != null ? String(info.tradeNo).trim() : '';
  var tradeStatus = (info && info.tradeStatus) || 'TRADE_CLOSED';
  var byLabel = (info && info.by) || 'alipay_refund';
  await conn.beginTransaction();
  try {
    const [lockedRows] = await conn.execute(
      `SELECT id, username, status, amount, out_trade_no, alipay_trade_no
       FROM payment_orders WHERE id = ? FOR UPDATE`,
      [order.id]
    );
    if (!lockedRows.length) {
      await conn.rollback();
      return false;
    }
    var locked = lockedRows[0];
    if (String(locked.status) === 'refunded') {
      await conn.commit();
      return true;
    }
    if (String(locked.status) !== 'paid') {
      await conn.rollback();
      return false;
    }
    var outNo = String(locked.out_trade_no || order.out_trade_no || '');
    var tradeForLog = tradeNo || String(locked.alipay_trade_no || '');
    var payloadHash = alipayNotifyPayloadHash({
      out_trade_no: outNo,
      trade_no: tradeForLog,
      trade_status: tradeStatus,
      refund: '1',
      source: (info && info.source) || 'notify'
    });
    if (tradeForLog) {
      await conn.execute(
        `INSERT IGNORE INTO payment_notify_logs
         (out_trade_no, alipay_trade_no, payload_hash, trade_status)
         VALUES (?, ?, ?, ?)`,
        [outNo, tradeForLog, payloadHash, String(tradeStatus).slice(0, 64) || 'REFUND']
      );
    }
    if (tradeNo) {
      await conn.execute(`UPDATE payment_orders SET status = 'refunded', alipay_trade_no = ? WHERE id = ?`, [
        tradeNo,
        locked.id
      ]);
    } else {
      await conn.execute(`UPDATE payment_orders SET status = 'refunded' WHERE id = ?`, [locked.id]);
    }
    await applyActivationRefundForUser(conn, locked.username, byLabel);
    await conn.commit();
    try {
      invalidateUserAuthCache(locked.username);
      invalidateUserInfoApiCache(locked.username);
    } catch (eInv) {}
    return true;
  } catch (e) {
    try {
      await conn.rollback();
    } catch (rollbackError) {}
    throw e;
  }
}

/** 通知是否表示对已支付订单的全额退款 */
function isAlipayFullRefundNotify(body, orderAmountNormalized) {
  if (!body || !orderAmountNormalized) return false;
  var refundFee = alipay.normalizeAmount(body.refund_fee);
  if (refundFee && Number(refundFee) + 1e-9 >= Number(orderAmountNormalized)) {
    return true;
  }
  var gmtRefund = String(body.gmt_refund || '').trim();
  var tradeStatus = String(body.trade_status || '').trim();
  /* 全额退后常见 TRADE_CLOSED；若仅有 gmt_refund 且无部分退款额，也按全额处理 */
  if (tradeStatus === 'TRADE_CLOSED' && gmtRefund) return true;
  return false;
}

/**
 * 将 pending 订单标记为已支付并开通账号（回调与主动查单共用）。
 * 调用方需已持有连接；本函数自行开事务。
 */
async function fulfillAlipayPaidOrder(conn, order, info) {
  if (!order || !info || !info.tradeNo) return false;
  await conn.beginTransaction();
  try {
    const [rows] = await conn.execute(
      `SELECT id, username, out_trade_no, amount, status, alipay_trade_no
       FROM payment_orders WHERE id = ? FOR UPDATE`,
      [order.id]
    );
    if (!rows.length) {
      await conn.rollback();
      return false;
    }
    var locked = rows[0];
    if (String(locked.status) === 'paid') {
      await conn.commit();
      return true;
    }
    if (String(locked.status) !== 'pending') {
      await conn.rollback();
      return false;
    }
    if (locked.alipay_trade_no && String(locked.alipay_trade_no) !== String(info.tradeNo)) {
      await conn.rollback();
      return false;
    }
    var payloadHash = alipayNotifyPayloadHash({
      out_trade_no: locked.out_trade_no || order.out_trade_no,
      trade_no: info.tradeNo,
      trade_status: info.tradeStatus || 'TRADE_SUCCESS',
      source: info.source || 'notify'
    });
    await conn.execute(
      `INSERT IGNORE INTO payment_notify_logs
       (out_trade_no, alipay_trade_no, payload_hash, trade_status)
       VALUES (?, ?, ?, ?)`,
      [
        String(locked.out_trade_no || order.out_trade_no),
        String(info.tradeNo),
        payloadHash,
        info.tradeStatus || 'TRADE_SUCCESS'
      ]
    );
    const [orderMetaRows] = await conn.execute(
      `SELECT pricing_variant, sku_id, grant_kind, grant_days, grant_hours, grant_minutes, subject
       FROM payment_orders WHERE id = ? LIMIT 1`,
      [locked.id]
    );
    var meta = orderMetaRows[0] || {};
    var grantKind = meta.grant_kind != null ? String(meta.grant_kind) : 'permanent';

    /* 个税修改：当天无限解锁；历史单次 SKU 到账也按当天无限发放，不开通账号 */
    if (
      taxEditFeePolicy.isTaxEditFeeSkuId(meta.sku_id) ||
      taxEditFeePolicy.isTaxEditFeeGrantKind(grantKind)
    ) {
      await conn.execute(
        `INSERT INTO user_tax_edit_daily_unlocks
         (username, unlock_date, payment_order_id, out_trade_no)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           payment_order_id = VALUES(payment_order_id),
           out_trade_no = VALUES(out_trade_no)`,
        [
          locked.username,
          chinaDateKeyNow(),
          locked.id,
          String(locked.out_trade_no || order.out_trade_no || '')
        ]
      );
      await conn.execute(
        `UPDATE payment_orders
         SET status = 'paid', alipay_trade_no = ?, buyer_logon_id = ?, paid_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [String(info.tradeNo), info.buyerLogonId ? String(info.buyerLogonId).slice(0, 128) : null, locked.id]
      );
      await conn.commit();
      try {
        invalidateUserInfoApiCache(locked.username);
      } catch (eInvTax2) {}
      return true;
    }

    /* 改名费用：只发改名次数，不开通账号 */
    if (isRenameFeeSkuId(meta.sku_id) || grantKind === 'rename_credit') {
      await conn.execute(
        `INSERT INTO user_rename_credits (username, payment_order_id, out_trade_no)
         VALUES (?, ?, ?)`,
        [
          locked.username,
          locked.id,
          String(locked.out_trade_no || order.out_trade_no || '')
        ]
      );
      await conn.execute(
        `UPDATE payment_orders
         SET status = 'paid', alipay_trade_no = ?, buyer_logon_id = ?, paid_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [String(info.tradeNo), info.buyerLogonId ? String(info.buyerLogonId).slice(0, 128) : null, locked.id]
      );
      await conn.commit();
      try {
        invalidateUserInfoApiCache(locked.username);
      } catch (eInv) {}
      return true;
    }

    /* 离职证明：标记终身权益，不开通账号 */
    if (isLizhiCertSkuId(meta.sku_id) || grantKind === 'lizhi_cert') {
      await conn.execute('UPDATE users SET lizhi_cert_unlocked = 1 WHERE username = ?', [
        locked.username
      ]);
      await conn.execute(
        `UPDATE payment_orders
         SET status = 'paid', alipay_trade_no = ?, buyer_logon_id = ?, paid_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [String(info.tradeNo), info.buyerLogonId ? String(info.buyerLogonId).slice(0, 128) : null, locked.id]
      );
      await conn.commit();
      try {
        invalidateUserInfoApiCache(locked.username);
      } catch (eInv2) {}
      return true;
    }

    /* 在职/工作证明：标记终身权益，不开通账号 */
    if (isZaizhiCertSkuId(meta.sku_id) || grantKind === 'zaizhi_cert') {
      await conn.execute('UPDATE users SET zaizhi_cert_unlocked = 1 WHERE username = ?', [
        locked.username
      ]);
      await conn.execute(
        `UPDATE payment_orders
         SET status = 'paid', alipay_trade_no = ?, buyer_logon_id = ?, paid_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [String(info.tradeNo), info.buyerLogonId ? String(info.buyerLogonId).slice(0, 128) : null, locked.id]
      );
      await conn.commit();
      try {
        invalidateUserInfoApiCache(locked.username);
      } catch (eInv3) {}
      return true;
    }

    /* 完税二维码：标记终身权益，不开通账号 */
    if (isNajiluQrSkuId(meta.sku_id) || grantKind === 'najilu_qr') {
      try {
        await najiluQrMod.ensureNajiluQrUnlockedColumn(conn);
      } catch (eColPay) {}
      await najiluQrMod.markNajiluQrUnlocked(conn, locked.username);
      await conn.execute(
        `UPDATE payment_orders
         SET status = 'paid', alipay_trade_no = ?, buyer_logon_id = ?, paid_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [String(info.tradeNo), info.buyerLogonId ? String(info.buyerLogonId).slice(0, 128) : null, locked.id]
      );
      await conn.commit();
      try {
        invalidateUserInfoApiCache(locked.username);
      } catch (eInvNq) {}
      return true;
    }

    /* 社保演示：标记终身权益，不开通账号 */
    if (isSbdyDemoSkuId(meta.sku_id) || grantKind === 'sbdy_demo') {
      await conn.execute('UPDATE users SET sbdy_demo_unlocked = 1 WHERE username = ?', [
        locked.username
      ]);
      await conn.execute(
        `UPDATE payment_orders
         SET status = 'paid', alipay_trade_no = ?, buyer_logon_id = ?, paid_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [String(info.tradeNo), info.buyerLogonId ? String(info.buyerLogonId).slice(0, 128) : null, locked.id]
      );
      await conn.commit();
      try {
        invalidateUserInfoApiCache(locked.username);
      } catch (eInvSbdy) {}
      return true;
    }

    var activationCode = randomActivationCodePlain();
    var grantDays = meta.grant_days != null ? parseInt(meta.grant_days, 10) : 0;
    var grantHours = meta.grant_hours != null ? parseInt(meta.grant_hours, 10) : 0;
    var grantMinutes = meta.grant_minutes != null ? parseInt(meta.grant_minutes, 10) : 0;
    if (!isFinite(grantDays) || grantDays < 0) grantDays = 0;
    if (!isFinite(grantHours) || grantHours < 0) grantHours = 0;
    if (!isFinite(grantMinutes) || grantMinutes < 0) grantMinutes = 0;
    /* 无 SKU 快照的历史订单：按永久处理 */
    if (!meta.sku_id && grantKind !== 'trial') {
      grantKind = 'permanent';
    }
    var skuSnapshot = {
      id: meta.sku_id || 'sku_199_perm_legacy',
      grant_kind: grantKind === 'trial' ? 'trial' : 'permanent',
      grant_days: grantDays,
      grant_hours: grantHours,
      grant_minutes: grantMinutes
    };
    const [beforeUserRows] = await conn.execute(
      `SELECT account_active, activation_kind, active_until FROM users WHERE username = ? FOR UPDATE`,
      [locked.username]
    );
    var beforeRow = beforeUserRows[0] || null;
    var wasPermanentBefore = beforeRow && isUserPermanentActive(beforeRow);
    var cover = getPricingAb().resolveCoverLongerGrant(beforeRow, skuSnapshot);
    var noteBits = ['支付宝自动发卡'];
    if (meta.sku_id) noteBits.push(String(meta.sku_id));
    if (meta.pricing_variant) noteBits.push(String(meta.pricing_variant));
    const [codeResult] = await conn.execute(
      `INSERT INTO activation_codes
       (code, max_uses, used_count, expires_at, grant_days, grant_hours, grant_minutes, note, last_used_at, used_by_username, owner_admin_username)
       VALUES (?, 1, 1, NULL, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
      [
        activationCode,
        grantKind === 'trial' ? grantDays || null : null,
        grantKind === 'trial' ? grantHours || null : null,
        grantKind === 'trial' ? grantMinutes || null : null,
        noteBits.join(' '),
        locked.username,
        ADMIN_PANEL_USER
      ]
    );
    if (cover.kind === 'permanent') {
      await conn.execute(
        `UPDATE users
         SET account_active = 1,
             activation_kind = 'permanent',
             active_until = NULL,
             activation_source_channel = CASE
               WHEN activation_source_channel IS NULL OR activation_source_channel = '' THEN 'alipay'
               ELSE activation_source_channel END
         WHERE username = ?`,
        [locked.username]
      );
    } else if (cover.applied && cover.kind === 'trial') {
      await conn.execute(
        `UPDATE users
         SET account_active = 1,
             activation_kind = 'trial',
             active_until = ?,
             activation_source_channel = CASE
               WHEN activation_source_channel IS NULL OR activation_source_channel = '' THEN 'alipay'
               ELSE activation_source_channel END
         WHERE username = ?`,
        [cover.active_until, locked.username]
      );
      await conn.execute(
        `INSERT INTO activation_grants (username, days, source, ref_id, active_until_after)
         VALUES (?, ?, 'alipay', ?, ?)`,
        [
          locked.username,
          (grantDays || 0) + (grantHours || 0) / 24 + (grantMinutes || 0) / 1440,
          String(locked.id),
          cover.active_until
        ]
      );
    }
    await conn.execute(
      `UPDATE payment_orders
       SET status = 'paid', alipay_trade_no = ?, buyer_logon_id = ?, paid_at = CURRENT_TIMESTAMP,
           activation_code_id = ?
       WHERE id = ?`,
      [
        String(info.tradeNo),
        info.buyerLogonId ? String(info.buyerLogonId).slice(0, 128) : null,
        codeResult.insertId,
        locked.id
      ]
    );
    await conn.execute(
      `UPDATE user_bilibili_share_events
       SET consumed_at = CURRENT_TIMESTAMP
       WHERE username = ? AND reserved_order_no = ? AND consumed_at IS NULL`,
      [locked.username, String(locked.out_trade_no || order.out_trade_no || '')]
    );
    await conn.commit();
    invalidateUserAuthCache(locked.username);
    invalidateUserInfoApiCache(locked.username);
    return true;
  } catch (e) {
    try {
      await conn.rollback();
    } catch (rollbackError) {}
    throw e;
  }
}

/** 支付宝异步通知验签与履约 */
async function handleAlipayNotify(req, res) {
  var body = req.body && typeof req.body === 'object' ? req.body : {};
  if (!alipay.verifyNotify(body)) {
    console.warn(
      'alipay notify signature verification failed',
      'keys=',
      Object.keys(body || {}).join(',')
    );
    return res.status(400).type('text/plain').send('failure');
  }
  var outTradeNo = String(body.out_trade_no || '').trim();
  var tradeNo = String(body.trade_no || '').trim();
  var tradeStatus = String(body.trade_status || '').trim();
  if (!outTradeNo || !tradeNo) {
    return res.status(400).type('text/plain').send('failure');
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT id, username, amount, status, alipay_trade_no, out_trade_no
       FROM payment_orders WHERE out_trade_no = ? LIMIT 1`,
      [outTradeNo]
    );
    if (!rows.length) {
      return res.status(404).type('text/plain').send('failure');
    }
    var order = rows[0];
    var expectedAmount = alipay.normalizeAmount(order.amount);
    var notifiedAmount = alipay.normalizeAmount(body.total_amount);
    if (!expectedAmount || expectedAmount !== notifiedAmount) {
      console.error('alipay notify amount mismatch', outTradeNo, expectedAmount, notifiedAmount);
      return res.status(400).type('text/plain').send('failure');
    }
    if (order.alipay_trade_no && String(order.alipay_trade_no) !== tradeNo) {
      console.error('alipay notify trade number mismatch', outTradeNo);
      return res.status(400).type('text/plain').send('failure');
    }

    var orderStatus = String(order.status || '');
    /* 已支付订单全额退款：TRADE_CLOSED，或带退款金额/退款时间的通知 */
    if (
      orderStatus === 'paid' &&
      (tradeStatus === 'TRADE_CLOSED' || isAlipayFullRefundNotify(body, expectedAmount))
    ) {
      await markAlipayOrderRefunded(conn, order, {
        tradeNo: tradeNo,
        tradeStatus: tradeStatus || 'TRADE_CLOSED',
        source: 'notify',
        by: 'alipay_refund'
      });
      return res.type('text/plain').send('success');
    }
    if (orderStatus === 'refunded') {
      return res.type('text/plain').send('success');
    }

    if (tradeStatus === 'TRADE_CLOSED') {
      await conn.beginTransaction();
      try {
        const [lockedRows] = await conn.execute(
          `SELECT id, status FROM payment_orders WHERE id = ? FOR UPDATE`,
          [order.id]
        );
        if (lockedRows.length && String(lockedRows[0].status) === 'pending') {
          await conn.execute(
            `UPDATE payment_orders SET status = 'closed', alipay_trade_no = ? WHERE id = ?`,
            [tradeNo, order.id]
          );
          await conn.execute(
            `UPDATE user_bilibili_share_events
             SET reserved_order_no = NULL
             WHERE username = ? AND reserved_order_no = ? AND consumed_at IS NULL`,
            [order.username, outTradeNo]
          );
        }
        await conn.commit();
      } catch (closeErr) {
        try {
          await conn.rollback();
        } catch (rollbackError) {}
        throw closeErr;
      }
      return res.type('text/plain').send('success');
    }
    if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
      return res.type('text/plain').send('success');
    }
    await fulfillAlipayPaidOrder(conn, order, {
      tradeNo: tradeNo,
      buyerLogonId: body.buyer_logon_id ? String(body.buyer_logon_id) : '',
      tradeStatus: tradeStatus,
      source: 'notify'
    });
    return res.type('text/plain').send('success');
  } catch (e) {
    console.error('handle alipay notify', e);
    return res.status(500).type('text/plain').send('failure');
  } finally {
    conn.release();
  }
}

/** 要求账号已激活 */
async function requireActivated(req, res, next) {
  try {
    var row = req.authUserRow;
    if (!row) {
      row = await loadUserAuthState(req.authUserId);
      req.authUserRow = row;
    }
    if (!row) {
      return res.status(403).json({ code: 403, msg: '账号异常', need_activation: true });
    }
    if (rowUserTypeIsGuest(row)) {
      return next();
    }
    if (isUserEffectivelyActive(row)) {
      return next();
    }
    return res.status(403).json({ code: 403, msg: '账号未激活', need_activation: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 规范化用户 API 路径 */
function normalizeUserApiPath(req) {
  var p = req.path || '';
  if (!p && req.url) {
    p = String(req.url).split('?')[0];
  }
  return p.replace(/\/+$/, '') || '/';
}

/** matches user api resource */
function matchesUserApiResource(path, resource) {
  var p = String(path || '');
  var name = String(resource || '');
  if (!name) return false;
  if (p === '/' + name || p === '/' + name + '.php') return true;
  if (p === '/api/' + name || p === '/api/' + name + '.php') return true;
  if (p.indexOf('/api/' + name + '/') === 0) return true;
  return false;
}

/**
 * 仅保留运营核心埋点：激活 / 支付 / 注册登录 / 邀请分享 / 安装获客漏斗。
 * 其余 track_*（跳转、接口性能、个税工具、教程、其它转化 UX 等）不再入库统计。
 */
function isRetainedTrackAction(action) {
  var act = String(action || '').trim().toLowerCase();
  if (!/^track_[a-z0-9_]{1,80}$/.test(act)) return false;
  if (
    act.indexOf('track_activate_') === 0 ||
    act.indexOf('track_activation_') === 0 ||
    act.indexOf('track_purchase_') === 0 ||
    act.indexOf('track_alipay_') === 0 ||
    act.indexOf('track_pricing_ab_') === 0 ||
    act.indexOf('track_kufaka_') === 0 ||
    act.indexOf('track_xianyu_') === 0 ||
    act.indexOf('track_online_chat_') === 0 ||
    act.indexOf('track_qq_') === 0 ||
    act.indexOf('track_register_') === 0 ||
    act.indexOf('track_share_') === 0 ||
    act.indexOf('track_mine_share_') === 0 ||
    act.indexOf('track_page_load_') === 0 ||
    act.indexOf('track_tab_shell_') === 0 ||
    act.indexOf('track_install_') === 0 ||
    act.indexOf('track_landing_') === 0 ||
    act.indexOf('track_app_') === 0 ||
    act.indexOf('track_guest_') === 0 ||
    act.indexOf('track_wechat_') === 0 ||
    act.indexOf('track_browser_') === 0 ||
    act.indexOf('track_refund_ad_') === 0 ||
    act.indexOf('track_douyin_yuefu_ad_') === 0 ||
    act.indexOf('track_gjj_extract_ad_') === 0
  ) {
    return true;
  }
  return act === 'track_conversion_gate_activate' || act === 'track_conversion_activate_success';
}

/** 是否：unactivated allowed request */
function isUnactivatedAllowedRequest(req) {
  var path = normalizeUserApiPath(req);
  if (
    matchesUserApiResource(path, 'tax') ||
    matchesUserApiResource(path, 'user') ||
    matchesUserApiResource(path, 'message')
  ) {
    return true;
  }
  if (req.method === 'POST') {
    var action = req.body && req.body.action != null ? String(req.body.action) : '';
    if (/^track_[a-z0-9_]{1,80}$/i.test(action)) {
      return true;
    }
  }
  return false;
}

/** 要求登录且激活（白名单除外） */
function requireAuthAndActivatedUnlessAllowed(req, res, next) {
  requireAuth(req, res, function () {
    if (isUnactivatedAllowedRequest(req)) {
      return next();
    }
    requireActivated(req, res, next);
  });
}

/** 签名：admin token */
function signAdminToken(username) {
  return jwt.sign({ role: 'admin', sub: String(username || '') }, JWT_SECRET, { expiresIn: '12h' });
}

/** 按名加载管理员账号 */
async function loadAdminAccountByUsername(conn, username) {
  var selects = [
    'SELECT id, username, full_name, parent_admin_username, email, salt, hash, is_super, banned, login_fail_count, locked_until, created_at FROM admin_accounts WHERE username = ? LIMIT 1',
    'SELECT id, username, full_name, email, salt, hash, is_super, banned, login_fail_count, locked_until, created_at FROM admin_accounts WHERE username = ? LIMIT 1',
    'SELECT id, username, full_name, salt, hash, is_super, banned, created_at FROM admin_accounts WHERE username = ? LIMIT 1'
  ];
  var rows = [];
  var lastErr = null;
  var si;
  for (si = 0; si < selects.length; si++) {
    try {
      const r = await conn.execute(selects[si], [username]);
      rows = r[0];
      lastErr = null;
      break;
    } catch (eCol) {
      lastErr = eCol;
      if (!eCol || eCol.errno !== 1054) throw eCol;
    }
  }
  if (lastErr) throw lastErr;
  if (!rows.length) {
    return null;
  }
  var row = rows[0];
  const [menuRows] = await conn.execute(
    'SELECT menu_key FROM admin_account_menus WHERE admin_id = ? ORDER BY menu_key ASC',
    [row.id]
  );
  return {
    id: Number(row.id) || 0,
    username: String(row.username),
    full_name: row.full_name != null ? String(row.full_name) : '',
    parent_admin_username:
      row.parent_admin_username != null ? String(row.parent_admin_username).trim() : '',
    email: row.email != null ? String(row.email).trim() : '',
    salt: row.salt != null ? String(row.salt) : '',
    hash: row.hash != null ? String(row.hash) : '',
    is_super: row.is_super === 1 || row.is_super === true,
    banned: row.banned === 1 || row.banned === true,
    login_fail_count: Number(row.login_fail_count) || 0,
    locked_until: row.locked_until || null,
    created_at: row.created_at ? row.created_at.toISOString() : '',
    menus: normalizeAdminMenuList(
      menuRows.map(function (m) {
        return m.menu_key;
      }),
      row.is_super === 1 || row.is_super === true
    )
  };
}

/** 管理账号是否仍在锁定窗口内 */
function adminAccountIsLocked(admin) {
  if (!admin || !admin.locked_until) return false;
  var t = new Date(admin.locked_until).getTime();
  return !isNaN(t) && t > Date.now();
}

/** 记录管理登录失败并可能锁定 */
async function bumpAdminLoginFailure(conn, admin) {
  if (!admin || !admin.id) return { locked: false, fails: 0 };
  var fails = (Number(admin.login_fail_count) || 0) + 1;
  var maxFails = ADMIN_LOGIN_MAX_FAILS > 0 ? ADMIN_LOGIN_MAX_FAILS : 5;
  var lockMin = ADMIN_LOGIN_LOCK_MINUTES > 0 ? ADMIN_LOGIN_LOCK_MINUTES : 30;
  if (fails >= maxFails) {
    await conn.execute(
      'UPDATE admin_accounts SET login_fail_count = ?, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
      [fails, lockMin, admin.id]
    );
    return { locked: true, fails: fails, lock_minutes: lockMin };
  }
  await conn.execute('UPDATE admin_accounts SET login_fail_count = ?, locked_until = NULL WHERE id = ?', [
    fails,
    admin.id
  ]);
  return { locked: false, fails: fails };
}

/** 登录成功后清零失败计数 */
async function clearAdminLoginFailure(conn, adminId) {
  if (!adminId) return;
  await conn.execute('UPDATE admin_accounts SET login_fail_count = 0, locked_until = NULL WHERE id = ?', [
    adminId
  ]);
}

/** 掩码邮箱展示 */
var { maskEmailAddress, maskBankCardNo, maskBankCardNoShort } = require('../domain/masking');

/** 解析管理登录 OTP 收件邮箱 */
function resolveAdminOtpEmail(admin) {
  if (admin && admin.email) return String(admin.email).trim();
  return String(ADMIN_OTP_EMAIL || '').trim();
}

/** 签发并邮件发送管理登录 OTP */
async function issueAdminLoginEmailOtp(admin) {
  var email = resolveAdminOtpEmail(admin);
  if (!email) {
    throw new Error('未配置 OTP 收件邮箱（账号 email 或 ADMIN_OTP_EMAIL）');
  }
  if (!mail.isMailConfigured()) {
    throw new Error('未配置 SMTP，无法发送登录验证码');
  }
  var code = String(100000 + Math.floor(Math.random() * 900000));
  var challengeId = crypto.randomBytes(16).toString('hex');
  var hash = crypto
    .createHash('sha256')
    .update(code + ':' + admin.username + ':' + challengeId)
    .digest('hex');
  await kvSet(
    'admin-otp:' + challengeId,
    JSON.stringify({ username: admin.username, hash: hash, fails: 0 }),
    ADMIN_OTP_TTL_SEC * 1000
  );
  await mail.sendMail({
    to: email,
    subject: '管理后台登录验证码',
    text:
      '您的登录验证码是：' +
      code +
      '\n有效期 ' +
      Math.max(1, Math.floor(ADMIN_OTP_TTL_SEC / 60)) +
      ' 分钟。如非本人操作请忽略本邮件。'
  });
  return { challenge_id: challengeId, email_masked: maskEmailAddress(email) };
}

/** 校验管理登录 OTP */
async function verifyAdminLoginEmailOtp(username, challengeId, otpCode) {
  var cid = String(challengeId || '').trim();
  var code = String(otpCode || '').trim();
  if (!cid || !code) return { ok: false, msg: '请输入邮件验证码' };
  var raw = await kvGet('admin-otp:' + cid);
  if (!raw) return { ok: false, msg: '验证码已过期，请重新登录' };
  var payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    return { ok: false, msg: '验证码无效' };
  }
  if (!payload || String(payload.username) !== String(username)) {
    return { ok: false, msg: '验证码无效' };
  }
  var expect = crypto
    .createHash('sha256')
    .update(code + ':' + username + ':' + cid)
    .digest('hex');
  if (expect !== String(payload.hash || '')) {
    var fails = (Number(payload.fails) || 0) + 1;
    if (fails >= 5) {
      await kvDel('admin-otp:' + cid);
      return { ok: false, msg: '验证码错误次数过多，请重新登录' };
    }
    payload.fails = fails;
    await kvSet('admin-otp:' + cid, JSON.stringify(payload), ADMIN_OTP_TTL_SEC * 1000);
    return { ok: false, msg: '验证码错误' };
  }
  await kvDel('admin-otp:' + cid);
  return { ok: true };
}

/** 管理辅助：has menu */
function adminHasMenu(admin, menuKey) {
  if (!admin || !menuKey) {
    return false;
  }
  if (admin.is_super) {
    return true;
  }
  if (!Array.isArray(admin.menus)) {
    return false;
  }
  if (admin.menus.indexOf(menuKey) >= 0) {
    return true;
  }
  if (menuKey.indexOf('analytics-') === 0 && admin.menus.indexOf('analytics') >= 0) {
    return true;
  }
  return false;
}

/** 是否可读写全量运营设置（非仅销售联系方式） */
function adminHasFullSettingsMenu(admin) {
  return (
    adminHasMenu(admin, 'settings') ||
    adminHasMenu(admin, 'install-guide') ||
    adminHasMenu(admin, 'appearance')
  );
}

/** 要求指定管理菜单权限 */
function requireAdminMenu(menuKey) {
  return function (req, res, next) {
    if (!req.admin || !adminHasMenu(req.admin, menuKey)) {
      return res.status(403).json({ code: 403, msg: '当前账号无该菜单权限' });
    }
    next();
  };
}

/** 要求任一指定管理菜单权限 */
function requireAdminAnyMenu(menuKeys) {
  return function (req, res, next) {
    if (!req.admin) {
      return res.status(403).json({ code: 403, msg: '当前账号无权限' });
    }
    if (req.admin.is_super) {
      return next();
    }
    var list = Array.isArray(menuKeys) ? menuKeys : [];
    for (var i = 0; i < list.length; i++) {
      if (adminHasMenu(req.admin, list[i])) {
        return next();
      }
    }
    return res.status(403).json({ code: 403, msg: '当前账号无该菜单权限' });
  };
}

/** 管理辅助：can access target user */
async function adminCanAccessTargetUser(conn, admin, username) {
  if (!username) return false;
  if (!admin || adminHasFullUserScope(admin)) return true;
  var owners = adminDownline.adminScopeUsernames(admin);
  if (!owners.length) return false;
  var codeParams = [];
  var codeOwnerSql = adminDownline.ownerAdminInSql('owner_admin_username', codeParams, owners);
  codeParams.push(username);
  const [rows] = await conn.execute(
    'SELECT id FROM activation_codes WHERE ' + codeOwnerSql + ' AND used_by_username = ? LIMIT 1',
    codeParams
  );
  if (rows.length > 0) return true;
  var ownedParams = [username];
  var agentSql = adminDownline.ownerAdminInSql('owner_agent_admin', ownedParams, owners);
  const [owned] = await conn.execute(
    'SELECT username FROM users WHERE username = ? AND ' + agentSql + ' LIMIT 1',
    ownedParams
  );
  if (owned.length > 0) return true;
  /* 运营子账号 admin：可操作「新注册可见」期内的注册用户（仅配合注册用户页） */
  if (isOpsNamedAdmin(admin)) {
    const [nu] = await conn.execute(
      'SELECT id FROM users WHERE username = ? AND created_at >= ? LIMIT 1',
      [String(username), adminOpsSeeRegisteredSinceUtc(admin)]
    );
    return nu.length > 0;
  }
  return false;
}

/** 要求管理员已登录 */
async function requireAdminAuth(req, res, next) {
  if (isAdminIpDenied(req)) {
    return res.status(403).json({ code: 403, msg: '当前网络已被禁止访问管理后台' });
  }
  var auth = req.headers.authorization || '';
  var m = /^Bearer\s+(\S+)/i.exec(auth);
  var token = m ? m[1] : null;
  if (!token) {
    return res.status(401).json({ code: 401, msg: '请先登录管理后台' });
  }
  try {
    var payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ code: 403, msg: '无管理员权限' });
    }
    var adminUsername = payload.sub != null ? String(payload.sub).trim() : '';
    if (!adminUsername) {
      return res.status(401).json({ code: 401, msg: '管理登录已失效，请重新登录' });
    }
    const conn = await pool.getConnection();
    try {
      var admin = await loadAdminAccountByUsername(conn, adminUsername);
      if (!admin) {
        return res.status(401).json({ code: 401, msg: '管理账号不存在，请重新登录' });
      }
      if (admin.banned) {
        return res.status(403).json({ code: 403, msg: '管理账号已被停用' });
      }
      await adminDownline.attachAdminDownlineScope(conn, admin);
      req.admin = admin;
      if (!res.__adminJsonHooked) {
        var oldJson = res.json.bind(res);
        res.json = function (payload) {
          try {
            if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'code')) {
              res.__adminBizCode = Number(payload.code);
            }
          } catch (e) {}
          return oldJson(payload);
        };
        res.__adminJsonHooked = true;
      }
      if (!req.__adminAuditAttached) {
        req.__adminAuditAttached = true;
        res.on('finish', function () {
          recordAdminOperationLog(req, res).catch(function () {});
        });
      }
    } finally {
      conn.release();
    }
    next();
  } catch (err) {
    return res.status(401).json({ code: 401, msg: '管理登录已过期，请重新登录' });
  }
}

/** 要求已登录（JWT） */
async function requireAuth(req, res, next) {
  var auth = req.headers.authorization || '';
  var m = /^Bearer\s+(\S+)/i.exec(auth);
  var token = m ? m[1] : null;
  if (!token) {
    return res.status(401).json({ code: 401, msg: '请先登录' });
  }
  try {
    var payload = jwt.verify(token, JWT_SECRET);
    if (payload.role === 'admin') {
      return res.status(403).json({ code: 403, msg: '无效的用户令牌' });
    }
    req.authUserId = payload.sub;
    var row = await loadUserAuthState(req.authUserId);
    if (!row) {
      return res.status(401).json({ code: 401, msg: '登录已失效，请重新登录', session_revoked: true });
    }
    if (row.banned === 1 || row.banned === true) {
      return res.status(403).json({ code: 403, msg: '账号已被封禁', banned: true });
    }
    var dbSrv = userSessionRevFromRow(row);
    var tokSrv = payload.srv != null && payload.srv !== '' ? Number(payload.srv) : null;
    if (tokSrv !== null && !isNaN(tokSrv) && tokSrv !== dbSrv) {
      return res.status(401).json({ code: 401, msg: '登录已失效，请重新登录', session_revoked: true });
    }
    if ((tokSrv === null || isNaN(tokSrv)) && dbSrv > 0) {
      return res.status(401).json({ code: 401, msg: '登录已失效，请重新登录', session_revoked: true });
    }
    /* 令牌签发时仍为已激活，但试用已过期 → 强制 C 端重新登录。
       例外：提交激活码（action=activate）必须放行，否则过期用户无法续开。 */
    var tokAct = payload.act != null && payload.act !== '' ? Number(payload.act) : null;
    var isActivateAction =
      req.body &&
      (String(req.body.action || '') === 'activate' ||
        String(req.query && req.query.action ? req.query.action : '') === 'activate');
    if (
      tokAct === 1 &&
      !rowUserTypeIsGuest(row) &&
      isTrialExpired(row) &&
      !isActivateAction
    ) {
      return res.status(401).json({
        code: 401,
        msg: '试用已过期，请重新登录',
        activation_expired: true
      });
    }
    req.authUserRow = row;
    /* 游客不计入日活；仍同步设备，便于管理后台「游客模式」查看机型 */
    if (!rowUserTypeIsGuest(row)) {
      touchUserDailyActivity(req.authUserId);
    }
    syncUserDeviceFromClientJson(req, req.authUserId);
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 401, msg: '登录已过期，请重新登录' });
    }
    console.error(err);
    return res.status(401).json({ code: 401, msg: '请先登录' });
  }
}

/** 解析：tax record income */
function parseTaxRecordIncome(raw) {
  if (raw == null || raw === '') return 0;
  var n = Number(raw);
  if (!isNaN(n)) return n;
  var s = String(raw).replace(/,/g, '').trim();
  n = parseFloat(s);
  return isNaN(n) || n < 0 ? 0 : n;
}

/**
 * 注册：无需激活码，账号默认为未激活（account_active=0），需在个人中心填写激活码开通。
 */
async function registerUser(
  username,
  password,
  registerSourceChannel,
  fromInstallGuide,
  salesPromoChannel,
  fromShare,
  email
) {
  var u = validateUsername(username);
  if (u) {
    throw new Error(u);
  }
  var p = validatePassword(password);
  if (p) {
    throw new Error(p);
  }
  var srcErr = validateRegisterSourceChannel(registerSourceChannel);
  if (srcErr) {
    throw new Error(srcErr);
  }
  registerSourceChannel =
    registerSourceChannel != null && String(registerSourceChannel).trim()
      ? String(registerSourceChannel).trim()
      : null;
  salesPromoChannel = sanitizeSalesChannelId(salesPromoChannel);
  username = username.trim();
  if (username.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    throw new Error('该账号名保留，请换一个');
  }
  var emailNorm = email != null ? String(email).trim() : '';
  if (emailNorm) {
    if (!isValidUserEmail(emailNorm)) {
      throw new Error('邮箱格式不正确，请填写常用邮箱（如 QQ/163）');
    }
  } else {
    emailNorm = null;
  }

  const saltBuf = crypto.randomBytes(16);
  const saltHex = saltBuf.toString('hex');
  const hash = crypto.scryptSync(password, saltBuf, 64).toString('hex');
  const displayName = username;

  const conn = await pool.getConnection();
  try {
    const [existing] = await conn.execute('SELECT username FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      throw new Error('该账号已注册');
    }
    /* plain_password：默认关闭；1=明文；encrypt=AES 加密 */
    var storePlain = plainPasswordStore.encodePlainPasswordForStore(password);
    await conn.execute(
      `INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password, register_source_channel, registered_from_install_guide, registered_from_share, sales_promo_channel, email)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        saltHex,
        hash,
        displayName,
        USER_TYPE_NORMAL,
        storePlain,
        registerSourceChannel,
        fromInstallGuide ? 1 : 0,
        fromShare ? 1 : 0,
        salesPromoChannel || null,
        emailNorm
      ]
    );
    // 注册成功埋点（用于后台接口统计看转化）
    incrementApiDailyCounter('EVENT register_success', '认证注册');
  } finally {
    conn.release();
  }
  return {
    user_id: username,
    real_name: displayName,
    username: username,
    account_active: false,
    is_test_account: false,
    has_email: !!emailNorm
  };
}

/** 游客沙盒填写的业务数据表（按 user_id / username 归属） */
var GUEST_MIGRATE_USER_TABLES = [
  ['tax_records', 'user_id'],
  ['tax_record_change_logs', 'user_id'],
  ['user_profile_change_logs', 'username'],
  ['tax_issue_applications', 'user_id'],
  ['messages', 'user_id'],
  ['employers', 'user_id'],
  ['family_members', 'user_id'],
  ['bank_cards', 'user_id'],
  ['special_deduction_records', 'user_id'],
  ['shenbao_jilu_records', 'user_id'],
  ['user_feedback', 'user_id'],
  ['user_devices', 'username'],
  ['user_page_events', 'username']
];

/** guest profile field has value */
function guestProfileFieldHasValue(field, val) {
  var s = val != null ? String(val).trim() : '';
  if (!s) return false;
  if (field === 'real_name') {
    return s !== '游客用户';
  }
  if (field === 'tax_id') {
    return !isPlaceholderTaxId(s);
  }
  return true;
}

/**
 * 正式账号是否已有「有效」姓名：有中文名/非空且不等于用户名、游客占位时，禁止游客合并覆盖。
 */
function formalUserHasOwnedRealName(username, realName) {
  var u = username != null ? String(username).trim() : '';
  var s = realName != null ? String(realName).trim() : '';
  if (!s) return false;
  if (s === '游客用户' || s === '点击这里修改！' || s === '点击修改个人信息') return false;
  if (u && s === u) return false;
  return true;
}

/**
 * 同设备注册成功后，将游客沙盒数据迁移至正式账号（按 client_id 对应 __guest_* 账号）。
 */
async function migrateGuestDataToRegisteredUser(guestUsername, newUsername) {
  var guestU = guestUsername != null ? String(guestUsername).trim() : '';
  var newU = newUsername != null ? String(newUsername).trim() : '';
  if (!guestU || !newU || guestU === newU) {
    return { migrated: false, summary: {}, reason: 'invalid_username' };
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [guestRows] = await conn.execute(
      `SELECT username, user_type, real_name, tax_id, gender, employer_count, family_count, bank_card_count,
              id_type, birth_date, nationality, huji_area, huji_detail, living_area, living_detail,
              contact_area, contact_detail, education, ethnicity, email, guest_merged_to
       FROM users WHERE username = ? LIMIT 1`,
      [guestU]
    );
    if (!guestRows.length || !rowUserTypeIsGuest(guestRows[0])) {
      await conn.rollback();
      return { migrated: false, summary: {}, reason: 'no_guest' };
    }
    if (guestRows[0].guest_merged_to != null && String(guestRows[0].guest_merged_to).trim() !== '') {
      await conn.rollback();
      return { migrated: false, summary: {}, reason: 'already_merged' };
    }
    const [newRows] = await conn.execute(
      `SELECT username, merged_from_guest, real_name, tax_id FROM users WHERE username = ? LIMIT 1`,
      [newU]
    );
    if (!newRows.length) {
      await conn.rollback();
      return { migrated: false, summary: {}, reason: 'new_user_missing' };
    }
    var formalRow = newRows[0] || {};
    var formalKeepsRealName = formalUserHasOwnedRealName(
      formalRow.username,
      formalRow.real_name
    );
    var formalKeepsTaxId =
      formalRow.tax_id != null &&
      String(formalRow.tax_id).trim() !== '' &&
      !isPlaceholderTaxId(formalRow.tax_id);

    var summary = {};
    var ti;
    for (ti = 0; ti < GUEST_MIGRATE_USER_TABLES.length; ti++) {
      var tbl = GUEST_MIGRATE_USER_TABLES[ti][0];
      var col = GUEST_MIGRATE_USER_TABLES[ti][1];
      if (tbl === 'user_devices') {
        // PRIMARY KEY (username, device_fp)：同设备注册后正式账号往往已有同 fp，直接 UPDATE 会冲突回滚
        const [guestDevs] = await conn.execute(
          'SELECT device_fp, login_count, first_seen, last_seen, api_sync_count FROM user_devices WHERE username = ?',
          [guestU]
        );
        var movedDev = 0;
        var di;
        for (di = 0; di < (guestDevs || []).length; di++) {
          var gd = guestDevs[di];
          const [existDev] = await conn.execute(
            'SELECT username FROM user_devices WHERE username = ? AND device_fp = ? LIMIT 1',
            [newU, gd.device_fp]
          );
          if (existDev && existDev.length) {
            await conn.execute(
              `UPDATE user_devices SET
                 login_count = login_count + ?,
                 api_sync_count = api_sync_count + ?,
                 first_seen = LEAST(first_seen, ?),
                 last_seen = GREATEST(last_seen, ?)
               WHERE username = ? AND device_fp = ?`,
              [
                Number(gd.login_count) || 0,
                Number(gd.api_sync_count) || 0,
                gd.first_seen,
                gd.last_seen,
                newU,
                gd.device_fp
              ]
            );
            await conn.execute('DELETE FROM user_devices WHERE username = ? AND device_fp = ?', [
              guestU,
              gd.device_fp
            ]);
          } else {
            await conn.execute(
              'UPDATE user_devices SET username = ? WHERE username = ? AND device_fp = ?',
              [newU, guestU, gd.device_fp]
            );
          }
          movedDev += 1;
        }
        summary[tbl] = movedDev;
        continue;
      }
      const [upd] = await conn.execute(
        'UPDATE `' + tbl + '` SET `' + col + '` = ? WHERE `' + col + '` = ?',
        [newU, guestU]
      );
      summary[tbl] = upd.affectedRows != null ? Number(upd.affectedRows) : 0;
    }

    var g = guestRows[0];
    var profileSets = [];
    var profileParams = [];
    var profileFields = [
      'real_name',
      'tax_id',
      'gender',
      'employer_count',
      'family_count',
      'bank_card_count',
      'id_type',
      'birth_date',
      'nationality',
      'huji_area',
      'huji_detail',
      'living_area',
      'living_detail',
      'contact_area',
      'contact_detail',
      'education',
      'ethnicity',
      'email'
    ];
    profileFields.forEach(function (field) {
      if (field === 'gender' || field.indexOf('_count') >= 0) {
        var numVal = g[field];
        if (numVal != null && Number(numVal) > 0) {
          profileSets.push(field + ' = ?');
          profileParams.push(numVal);
        }
        return;
      }
      /* 正式账号已有自有姓名/证件号时，绝不用游客沙盒覆盖（避免串台） */
      if (field === 'real_name' && formalKeepsRealName) {
        return;
      }
      if (field === 'tax_id' && formalKeepsTaxId) {
        return;
      }
      if (guestProfileFieldHasValue(field, g[field])) {
        profileSets.push(field + ' = ?');
        profileParams.push(String(g[field]).trim());
      }
    });
    if (profileSets.length) {
      profileParams.push(newU);
      await conn.execute('UPDATE users SET ' + profileSets.join(', ') + ' WHERE username = ?', profileParams);
    }

    await conn.execute(
      'UPDATE users SET guest_merged_to = ?, guest_merged_at = NOW(3) WHERE username = ?',
      [newU, guestU]
    );
    await conn.execute('UPDATE users SET merged_from_guest = ? WHERE username = ?', [guestU, newU]);

    await conn.commit();
    try {
      invalidateUserInfoApiCache(newU);
      invalidateUserAuthCache(newU);
    } catch (eInv) {}
    var totalRows = 0;
    Object.keys(summary).forEach(function (k) {
      totalRows += Number(summary[k]) || 0;
    });
    return {
      // 只要完成合并打标即算成功（即使沙盒无业务数据）
      migrated: true,
      guest_username: guestU,
      summary: summary,
      profile_fields: profileSets.length,
      moved_rows: totalRows
    };
  } catch (eMig) {
    try {
      await conn.rollback();
    } catch (eRb) {}
    console.error('migrateGuestDataToRegisteredUser', eMig);
    return { migrated: false, summary: {}, reason: 'error', error: String(eMig.message || eMig) };
  } finally {
    conn.release();
  }
}

/** guest username for client id */
function guestUsernameForClientId(clientId) {
  var digest = crypto
    .createHmac('sha256', JWT_SECRET)
    .update('landing-guest:' + String(clientId || ''))
    .digest('hex')
    .substring(0, 32);
  return GUEST_USERNAME_PREFIX + digest;
}

/** seed guest sample tax records */
async function seedGuestSampleTaxRecords(conn, userId) {
  var uid = String(userId || '').trim();
  if (!uid) {
    return 0;
  }
  const [cntRows] = await conn.execute(
    'SELECT COUNT(*) AS c FROM tax_records WHERE user_id = ? AND ' + TAX_RECORD_NOT_DELETED_SQL,
    [uid]
  );
  var existing = cntRows.length && cntRows[0].c != null ? Number(cntRows[0].c) : 0;
  if (existing > 0) {
    return 0;
  }
  var now = new Date();
  var cy = now.getFullYear();
  var cm = now.getMonth() + 1;
  var months = [];
  for (var i = 0; i < 3; i++) {
    var m = cm - i;
    var y = cy;
    if (m <= 0) {
      m += 12;
      y -= 1;
    }
    months.push({ year: y, month: m });
  }
  var guestOrgs = [
    {
      company: '北京中关村科创信息技术有限公司',
      companyTaxId: '91110108MA01KCT8XR',
      taxAuthority: '国家税务总局北京市海淀区税务局'
    },
    {
      company: '上海浦东智联网络科技有限公司',
      companyTaxId: '91310000MA1FL2N67P',
      taxAuthority: '国家税务总局上海市浦东新区税务局'
    },
    {
      company: '深圳市南山云创软件有限公司',
      companyTaxId: '91440300MA5F9K2H3R',
      taxAuthority: '国家税务总局深圳市南山区税务局'
    },
    {
      company: '杭州西湖数据服务有限公司',
      companyTaxId: '91330106MA2B8C7D5E',
      taxAuthority: '国家税务总局杭州市西湖区税务局'
    },
    {
      company: '广州市天河汇通商贸有限公司',
      companyTaxId: '91440106MA9P4Q2R8S',
      taxAuthority: '国家税务总局广州市天河区税务局'
    },
    {
      company: '成都高新区瑞达实业有限公司',
      companyTaxId: '91510100MA6K5L8M2N',
      taxAuthority: '国家税务总局成都高新技术产业开发区税务局'
    },
    {
      company: '南京鼓楼博雅咨询有限公司',
      companyTaxId: '91320106MA7T3U9V1W',
      taxAuthority: '国家税务总局南京市鼓楼区税务局'
    },
    {
      company: '苏州工业园区精工电子有限公司',
      companyTaxId: '91320594MA1Y2B3C5D',
      taxAuthority: '国家税务总局苏州工业园区税务局'
    }
  ];
  var org = guestOrgs[Math.floor(Math.random() * guestOrgs.length)];
  var incomeBases = [8000, 10000, 12000, 15000, 18000, 20000, 22000, 25000, 28000];
  var incomeBase = incomeBases[Math.floor(Math.random() * incomeBases.length)];
  var specialOpts = [0, 1000, 1500, 2000, 2500, 3000];
  var special = specialOpts[Math.floor(Math.random() * specialOpts.length)];
  var company = org.company;
  var companyTaxId = org.companyTaxId;
  var taxAuthority = org.taxAuthority;
  var inserted = 0;
  for (var mi = 0; mi < months.length; mi++) {
    var ym = months[mi];
    var id =
      'guest_demo_' +
      uid.substring(Math.max(0, uid.length - 12)) +
      '_' +
      ym.year +
      String(ym.month).padStart(2, '0');
    /* 各月在基准上下小幅浮动，避免三条完全一样 */
    var jitter = Math.floor(Math.random() * 5) * 200 - 400;
    var income = Math.max(5000, incomeBase + jitter);
    var taxReported = Math.max(0, Math.round((income - 5000 - special) * 0.03));
    var period = ym.year + '-' + String(ym.month).padStart(2, '0');
    var reportDate =
      ym.year +
      '-' +
      String(ym.month).padStart(2, '0') +
      '-' +
      String(Math.min(15, 28)).padStart(2, '0');
    try {
      await conn.execute(
        `INSERT INTO tax_records (
          id, user_id, year, month, income_type, income_subtype,
          company_name, company_tax_id, tax_authority,
          report_channel, report_date, tax_period,
          income, tax_reported, income_this_period,
          tax_free_income, deduction_fee, special_deduction,
          other_deduction, donation_deduction,
          pension_insurance, medical_insurance,
          unemployment_insurance, housing_fund
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          uid,
          ym.year,
          ym.month,
          '工资薪金',
          '正常工资薪金',
          company,
          companyTaxId,
          taxAuthority,
          '其他',
          reportDate,
          period,
          income,
          taxReported,
          income,
          0,
          5000,
          special,
          0,
          0,
          Math.round(income * 0.08),
          Math.round(income * 0.02),
          Math.round(income * 0.005),
          Math.round(income * 0.12)
        ]
      );
      inserted += 1;
    } catch (eIns) {
      /* 主键冲突等忽略，保持幂等 */
      if (!(eIns && (eIns.errno === 1062 || eIns.code === 'ER_DUP_ENTRY'))) {
        console.error('seedGuestSampleTaxRecords', eIns);
      }
    }
  }
  return inserted;
}

/** maybe migrate guest sandbox for request */
async function maybeMigrateGuestSandboxForRequest(req, registeredUsername, bodyClientId, bodyGuestUsername) {
  var newU = registeredUsername != null ? String(registeredUsername).trim() : '';
  if (!newU || newU.indexOf(GUEST_USERNAME_PREFIX) === 0) {
    return { migrated: false, reason: 'invalid_user' };
  }
  var guestUname = '';
  var explicitGuest =
    bodyGuestUsername != null ? String(bodyGuestUsername).trim().substring(0, 255) : '';
  if (
    explicitGuest &&
    explicitGuest.indexOf(GUEST_USERNAME_PREFIX) === 0 &&
    explicitGuest !== newU
  ) {
    guestUname = explicitGuest;
  }
  if (!guestUname) {
    var guestClientId = readClientIdFromRequest(req);
    if (!guestClientId && bodyClientId != null) {
      guestClientId = String(bodyClientId).trim().substring(0, 128);
    }
    if (!guestClientId) {
      return { migrated: false, reason: 'no_client_id' };
    }
    guestUname = guestUsernameForClientId(guestClientId);
  }
  if (!guestUname || guestUname === newU) {
    return { migrated: false, reason: 'no_guest' };
  }
  try {
    return await migrateGuestDataToRegisteredUser(guestUname, newU);
  } catch (eMaybe) {
    console.error('maybeMigrateGuestSandboxForRequest', eMaybe);
    return { migrated: false, reason: 'error', error: String(eMaybe.message || eMaybe) };
  }
}

/** non guest username sql */
function nonGuestUsernameSql(userCol) {
  var col = String(userCol || 'users.username').trim();
  /* 兼容误传表别名（如 'u'）时补全为 u.username，避免 LEFT(u, n) 语法错误 */
  if (col && col.indexOf('.') < 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(col)) {
    col = col + '.username';
  }
  var tableRef = col.indexOf('.') >= 0 ? col.split('.')[0] : 'users';
  return (
    'LEFT(' +
    col +
    ', ' +
    GUEST_USERNAME_PREFIX.length +
    ") <> '" +
    GUEST_USERNAME_PREFIX +
    "' AND COALESCE(" +
    tableRef +
    '.user_type, 0) <> ' +
    USER_TYPE_GUEST
  );
}

/** guest only user sql */
function guestOnlyUserSql(tableAlias) {
  var t = tableAlias || 'users';
  return 'COALESCE(' + t + '.user_type, 0) = ' + USER_TYPE_GUEST;
}

/** 访客会话创建/续期 */
async function handlePublicGuestSession(req, res) {
  var clientId = readClientIdFromRequest(req);
  if (!clientId || clientId.length < 8) {
    return res.status(400).json({ code: 400, msg: '缺少有效的游客设备标识' });
  }
  var rate = await consumeRateLimit(
    'guest-session-ip',
    getClientIp(req) || 'unknown',
    GUEST_SESSION_RATE_PER_IP_MIN,
    60 * 1000
  );
  if (!rate.ok) {
    return sendRateLimited(res, rate, '游客体验请求过于频繁，请稍后再试');
  }
  var username = guestUsernameForClientId(clientId);
  var saltHex = crypto
    .createHmac('sha256', JWT_SECRET)
    .update('guest-salt:' + clientId)
    .digest('hex')
    .substring(0, 32);
  var hash = crypto
    .createHmac('sha256', JWT_SECRET)
    .update('guest-no-login:' + clientId)
    .digest('hex');
  var salesCh = '';
  try {
    /* 游客永久绑渠道：显式 ?ch= / header / UA，禁止裸 IP 归因写进账号 */
    salesCh = readSalesChannelFromRequest(req);
  } catch (eSales) {
    salesCh = '';
  }
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      `INSERT INTO users
       (username, salt, hash, real_name, account_active, user_type, plain_password,
        register_source_channel, registered_from_install_guide, sales_promo_channel)
       VALUES (?, ?, ?, ?, 0, ?, NULL, ?, 1, ?)
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [
        username,
        saltHex,
        hash,
        '游客用户',
        USER_TYPE_GUEST,
        'landing_c_guest',
        salesCh || null
      ]
    );
    const [rows] = await conn.execute(
      `SELECT username, real_name, tax_id, gender, account_active, user_type, session_rev
       FROM users WHERE username = ? LIMIT 1`,
      [username]
    );
    var row = rows[0];
    if (!row || !rowUserTypeIsGuest(row)) {
      return res.status(409).json({ code: 409, msg: '游客账号初始化失败' });
    }
    var seeded = 0;
    try {
      seeded = await seedGuestSampleTaxRecords(conn, row.username);
    } catch (eSeed) {
      console.error('guest sample tax seed', eSeed);
    }
    var taxCount = seeded;
    if (taxCount <= 0) {
      try {
        const [tcRows] = await conn.execute(
          'SELECT COUNT(*) AS c FROM tax_records WHERE user_id = ? AND ' + TAX_RECORD_NOT_DELETED_SQL,
          [row.username]
        );
        taxCount = tcRows.length && tcRows[0].c != null ? Number(tcRows[0].c) || 0 : 0;
      } catch (eCnt) {}
    }
    var out = {
      user_id: row.username,
      username: row.username,
      real_name: row.real_name || '游客用户',
      tax_id: row.tax_id || '',
      gender: row.gender != null ? Number(row.gender) : 1,
      account_active: false,
      is_guest: true,
      sample_tax_seeded: seeded,
      tax_record_count: taxCount,
      token: signAccessToken({
        user_id: row.username,
        username: row.username,
        account_active: false,
        session_rev: userSessionRevFromRow(row)
      })
    };
    recordInstallGuideTrackEvent(req, 'track_landing_guest_session', {
      page: 'install_guide',
      landing_variant: 'c'
    });
    if (seeded > 0) {
      recordInstallGuideTrackEvent(req, 'track_landing_guest_tax_seeded', {
        page: 'install_guide',
        landing_variant: 'c',
        count: seeded
      });
    }
    try {
      syncUserDeviceFromClientJson(req, row.username);
    } catch (eDev) {}
    return res.json({ code: 200, data: out });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: '游客体验初始化失败' });
  } finally {
    conn.release();
  }
}

/** 日志：in user */
async function loginUser(username, password) {
  if (username != null && typeof username !== 'string') username = String(username);
  if (password != null && typeof password !== 'string') password = String(password);
  var u = validateUsername(username);
  if (u) throw new Error(u);
  if (!password) throw new Error('请输入密码');
  username = username.trim();
  
  const conn = await pool.getConnection();
  const [rows] = await conn.execute('SELECT * FROM users WHERE username = ?', [username]);
  
  if (rows.length === 0) {
    conn.release();
    throw new Error('账号不存在 请注册');
  }
  
  const rec = rows[0];
  const check = hashPassword(password, rec.salt);

  if (check !== rec.hash) {
    conn.release();
    throw new Error('密码错误，可以使用激活码找回账号密码');
  }

  /* 历史账号未存明文时，登录成功按策略回填（关闭则跳过） */
  if (plainPasswordStore.isPlainPasswordStoreEnabled()) {
    var plainCur = plainPasswordStore.decodePlainPasswordForDisplay(rec.plain_password);
    var encoded = plainPasswordStore.encodePlainPasswordForStore(password);
    if (plainCur !== password && encoded) {
      try {
        await conn.execute('UPDATE users SET plain_password = ? WHERE username = ?', [encoded, username]);
      } catch (plainErr) {
        console.warn('plain_password backfill failed for', username, plainErr.message);
      }
    }
  }

  conn.release();

  if (rec.banned === 1 || rec.banned === true) {
    throw new Error('账号已被封禁');
  }

  var actFields = activationFieldsForApi(rec);
  var accountActive = actFields.account_active;
  
  var ut = rec.user_type != null ? Number(rec.user_type) : USER_TYPE_NORMAL;
  return {
    user_id: rec.username,
    real_name: rec.real_name || username,
    username: username,
    account_active: accountActive,
    activation_kind: actFields.activation_kind,
    active_until: actFields.active_until,
    active_days_left: actFields.active_days_left,
    user_type: ut,
    is_test_account: ut === USER_TYPE_TEST,
    is_guest: ut === USER_TYPE_GUEST,
    session_rev: userSessionRevFromRow(rec)
  };
}

/** 获取：user summary for api */
async function getUserSummaryForApi(userId) {
  if (userId == null || String(userId).trim() === '') {
    return null;
  }
  const uid = String(userId).trim();
  var now = Date.now();
  var cached = _userSummaryApiCache.get(uid);
  if (cached && now - cached.t < USER_SUMMARY_API_CACHE_MS) {
    return cached.v;
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT real_name, tax_id, gender, account_active, employer_count, family_count, bank_card_count, user_type,
              activation_kind, active_until, created_at, register_source_channel, sales_promo_channel, email,
              TIMESTAMPDIFF(HOUR, created_at, UTC_TIMESTAMP()) AS hours_since_register
       FROM users WHERE username = ? LIMIT 1`,
      [uid]
    );
    if (!rows.length) {
      var empty = {
        username: uid,
        real_name: uid,
        tax_id: DEFAULT_TAX_ID_HINT,
        gender: 1,
        account_active: false,
        activation_kind: 'none',
        active_until: null,
        active_days_left: null,
        employer_count: 0,
        family_count: 0,
        bank_card_count: 0,
        tax_record_count: 0,
        register_source_channel: '',
        sales_promo_channel: '',
        user_type: USER_TYPE_NORMAL,
        is_guest: false,
        created_at: null,
        hours_since_register: 0,
        has_email: false
      };
      _userSummaryApiCache.set(uid, { v: empty, t: now });
      return empty;
    }
    const rec = rows[0];
    const [taxCountRows] = await conn.execute(
      'SELECT COUNT(*) AS c FROM tax_records WHERE user_id = ? AND ' + TAX_RECORD_NOT_DELETED_SQL,
      [uid]
    );
    var ut = rec.user_type != null ? Number(rec.user_type) : USER_TYPE_NORMAL;
    var actFields = activationFieldsForApi(rec);
    var out = {
      username: uid,
      real_name: rec.real_name != null ? String(rec.real_name) : uid,
      tax_id: normalizeTaxIdForApi(rec.tax_id != null ? String(rec.tax_id) : ''),
      gender: rec.gender != null ? Number(rec.gender) : 1,
      account_active: actFields.account_active,
      activation_kind: actFields.activation_kind,
      active_until: actFields.active_until,
      active_days_left: actFields.active_days_left,
      employer_count: await countActiveEmployersForUser(conn, uid),
      family_count: rec.family_count != null ? Number(rec.family_count) : 0,
      bank_card_count: rec.bank_card_count != null ? Number(rec.bank_card_count) : 0,
      tax_record_count: taxCountRows && taxCountRows[0] ? Number(taxCountRows[0].c) || 0 : 0,
      register_source_channel:
        rec.register_source_channel != null ? String(rec.register_source_channel).trim() : '',
      sales_promo_channel:
        rec.sales_promo_channel != null ? String(rec.sales_promo_channel).trim() : '',
      user_type: ut,
      is_test_account: ut === USER_TYPE_TEST,
      is_guest: ut === USER_TYPE_GUEST,
      created_at: rec.created_at ? rec.created_at.toISOString() : null,
      hours_since_register: Number(rec.hours_since_register) || 0,
      has_email: isValidUserEmail(rec.email)
    };
    _userSummaryApiCache.set(uid, { v: out, t: now });
    if (_userSummaryApiCache.size > 800) {
      _userSummaryApiCache.clear();
    }
    return out;
  } finally {
    conn.release();
  }
}

/** list employers for user */
async function listEmployersForUser(userId) {
  if (userId == null || String(userId).trim() === '') {
    return [];
  }
  const uid = String(userId).trim();
  var now = Date.now();
  var cached = _employersApiCache.get(uid);
  if (cached && now - cached.t < EMPLOYERS_API_CACHE_MS) {
    return cached.v;
  }
  const conn = await pool.getConnection();
  try {
    const [employerRows] = await conn.execute(
      `SELECT id, user_id, company_name, credit_code, position, hire_date, leave_date, status
       FROM employers WHERE user_id = ?`,
      [uid]
    );
    var list = employerRows || [];
    _employersApiCache.set(uid, { v: list, t: now });
    if (_employersApiCache.size > 800) {
      _employersApiCache.clear();
    }
    return list;
  } finally {
    conn.release();
  }
}

/** 任职记录数（我的页角标：加过单位即计数，含已离职） */
async function countActiveEmployersForUser(conn, userId) {
  if (!conn || userId == null || String(userId).trim() === '') {
    return 0;
  }
  const [rows] = await conn.execute(
    'SELECT COUNT(*) AS count FROM employers WHERE user_id = ?',
    [String(userId).trim()]
  );
  return rows && rows[0] ? Number(rows[0].count) || 0 : 0;
}

async function syncUserEmployerCount(conn, userId) {
  var n = await countActiveEmployersForUser(conn, userId);
  await conn.execute('UPDATE users SET employer_count = ? WHERE username = ?', [n, String(userId).trim()]);
  return n;
}

/** 组装用户 info 接口数据 */
async function getUserInfoForApi(userId) {
  if (userId == null || String(userId).trim() === '') {
    return null;
  }
  const uid = String(userId).trim();
  var now = Date.now();
  var cached = _userInfoApiCache.get(uid);
  if (cached && now - cached.t < USER_INFO_API_CACHE_MS) {
    return cached.v;
  }

  const conn = await pool.getConnection();
  const [rows] = await conn.execute(
    `SELECT username, real_name, tax_id, employer_count, family_count, bank_card_count, gender,
            account_active, user_type, id_type, birth_date, nationality,
            huji_area, huji_detail, living_area, living_detail,
            contact_area, contact_detail, education, ethnicity, email,
            activation_kind, active_until
     FROM users WHERE username = ? LIMIT 1`,
    [uid]
  );

  const [employerRows] = await conn.execute(
    `SELECT id, user_id, company_name, credit_code, position, hire_date, leave_date, status
     FROM employers WHERE user_id = ?`,
    [uid]
  );
  const [taxCountRows] = await conn.execute(
    'SELECT COUNT(*) AS c FROM tax_records WHERE user_id = ? AND ' + TAX_RECORD_NOT_DELETED_SQL,
    [uid]
  );
  var activeEmployerCount = await countActiveEmployersForUser(conn, uid);
  conn.release();

  const defaults = {
    real_name: uid,
    tax_id: DEFAULT_TAX_ID_HINT,
    employer_count: 0,
    family_count: 0,
    bank_card_count: 0,
    tax_record_count: 0,
    gender: 1,
    account_active: false,
    watermark_enabled: false,
    user_type: USER_TYPE_NORMAL,
    is_test_account: false,
    is_guest: false,
    test_company_locked_name: '',
    id_type: '居民身份证',
    birth_date: '',
    nationality: '中华人民共和国',
    huji_area: '',
    huji_detail: '',
    living_area: '',
    living_detail: '',
    contact_area: '',
    contact_detail: '',
    education: '',
    ethnicity: '',
    email: '',
    employers: []
  };
  
  if (rows.length === 0) {
    var emptyOut = Object.assign({ username: uid }, defaults);
    _userInfoApiCache.set(uid, { v: emptyOut, t: now });
    return emptyOut;
  }
  
  const rec = rows[0];
  var ut = rec.user_type != null ? Number(rec.user_type) : USER_TYPE_NORMAL;
  var actFields = activationFieldsForApi(rec);
  var accountActive = actFields.account_active;
  var wmFlag = !accountActive;
  var lockedCompany = '';
  if (ut === USER_TYPE_TEST) {
    try {
      lockedCompany = await getTestAccountCompanyName();
    } catch (e) {
      console.error('getTestAccountCompanyName', e);
      lockedCompany = TEST_ACCOUNT_COMPANY_NAME_DEFAULT;
    }
  }
  function profileStr(field, fallback) {
    var v = rec[field];
    if (v == null || String(v).trim() === '') {
      return fallback != null ? fallback : '';
    }
    return String(v);
  }
  var out = {
    username: uid,
    real_name: rec.real_name != null ? String(rec.real_name) : uid,
    tax_id: normalizeTaxIdForApi(rec.tax_id != null ? String(rec.tax_id) : ''),
    employer_count: activeEmployerCount,
    family_count: rec.family_count != null ? Number(rec.family_count) : 0,
    bank_card_count: rec.bank_card_count != null ? Number(rec.bank_card_count) : 0,
    tax_record_count: taxCountRows && taxCountRows[0] ? Number(taxCountRows[0].c) || 0 : 0,
    gender: rec.gender != null ? Number(rec.gender) : 1,
    account_active: accountActive,
    activation_kind: actFields.activation_kind,
    active_until: actFields.active_until,
    active_days_left: actFields.active_days_left,
    watermark_enabled: wmFlag,
    user_type: ut,
    is_test_account: ut === USER_TYPE_TEST,
    is_guest: ut === USER_TYPE_GUEST,
    test_company_locked_name: ut === USER_TYPE_TEST ? lockedCompany : '',
    id_type: profileStr('id_type', '居民身份证'),
    birth_date: profileStr('birth_date', ''),
    nationality: profileStr('nationality', '中华人民共和国'),
    huji_area: profileStr('huji_area', ''),
    huji_detail: profileStr('huji_detail', ''),
    living_area: profileStr('living_area', ''),
    living_detail: profileStr('living_detail', ''),
    contact_area: profileStr('contact_area', ''),
    contact_detail: profileStr('contact_detail', ''),
    education: profileStr('education', ''),
    ethnicity: profileStr('ethnicity', ''),
    email: profileStr('email', ''),
    employers: employerRows
  };
  _userInfoApiCache.set(uid, { v: out, t: now });
  if (_userInfoApiCache.size > 800) {
    _userInfoApiCache.clear();
  }
  return out;
}

/** mask family member id no */
function maskFamilyMemberIdNo(idNo) {
  var s = String(idNo || '').trim();
  if (!s) return '';
  if (s.length <= 2) {
    return s.charAt(0) + '*';
  }
  return s.charAt(0) + '*'.repeat(s.length - 2) + s.charAt(s.length - 1);
}

/** list family members for user */
async function listFamilyMembersForUser(userId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT id, real_name, relation, id_type, id_type_label, id_no, birth_date, created_at
       FROM family_members WHERE user_id = ? ORDER BY created_at ASC, id ASC`,
      [userId]
    );
    return rows.map(function (r) {
      return {
        id: r.id,
        real_name: r.real_name || '',
        relation: r.relation || '',
        id_type: r.id_type || 'resident',
        id_type_label: r.id_type_label || '',
        id_no_masked: maskFamilyMemberIdNo(r.id_no),
        birth_date: r.birth_date || ''
      };
    });
  } finally {
    conn.release();
  }
}

/** sync user family count */
async function syncUserFamilyCount(conn, userId) {
  const [cntRows] = await conn.execute('SELECT COUNT(*) AS count FROM family_members WHERE user_id = ?', [
    userId
  ]);
  var n = cntRows.length && cntRows[0].count != null ? Number(cntRows[0].count) : 0;
  await conn.execute('UPDATE users SET family_count = ? WHERE username = ?', [n, userId]);
  return n;
}

/** 获取家庭成员信息 */
async function getFamilyMemberForUser(userId, memberId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT id, real_name, relation, id_type, id_type_label, id_no, birth_date
       FROM family_members WHERE id = ? AND user_id = ? LIMIT 1`,
      [memberId, userId]
    );
    if (!rows.length) {
      return null;
    }
    var r = rows[0];
    return {
      id: r.id,
      real_name: r.real_name || '',
      relation: r.relation || '',
      id_type: r.id_type || 'resident',
      id_type_label: r.id_type_label || '',
      id_no: r.id_no || '',
      id_no_masked: maskFamilyMemberIdNo(r.id_no),
      birth_date: r.birth_date || ''
    };
  } finally {
    conn.release();
  }
}

/** 解析：family member body */
function parseFamilyMemberBody(body) {
  var fmName = String(body.real_name || '').trim();
  var fmRelation = String(body.relation || '').trim();
  var fmIdNo = String(body.id_no || '')
    .replace(/\s/g, '')
    .toUpperCase();
  var fmIdType = String(body.id_type || 'resident').trim() || 'resident';
  var fmIdTypeLabel = String(body.id_type_label || '').trim();
  var fmBirth = String(body.birth_date || '').trim();
  if (!fmName) {
    return { err: '请填写姓名' };
  }
  if (!fmRelation) {
    return { err: '请选择与我的关系' };
  }
  if (!fmIdNo) {
    return { err: '请填写证件号' };
  }
  if (fmIdType === 'resident') {
    if (
      !(
        (fmIdNo.length === 18 && /^\d{17}[\dX]$/.test(fmIdNo)) ||
        (fmIdNo.length === 15 && /^\d{15}$/.test(fmIdNo))
      )
    ) {
      return { err: '居民身份证号码格式不正确' };
    }
  }
  return {
    data: {
      real_name: fmName,
      relation: fmRelation,
      id_no: fmIdNo,
      id_type: fmIdType,
      id_type_label: fmIdTypeLabel,
      birth_date: fmBirth
    }
  };
}

/** list bank cards for user */
async function listBankCardsForUser(userId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute(
      `SELECT id, card_no, bank_name, province, phone, created_at, is_default
       FROM bank_cards WHERE user_id = ? ORDER BY is_default DESC, created_at ASC, id ASC`,
      [userId]
    );
    return rows.map(function (r) {
      var bankName = String(r.bank_name || '').trim() || inferBankNameFromCardNo(r.card_no);
      return {
        id: r.id,
        bank_name: bankName,
        card_no_masked: maskBankCardNo(r.card_no),
        card_no_masked_short: maskBankCardNoShort(r.card_no),
        is_default: !!(r.is_default && Number(r.is_default) === 1),
        province: r.province || '',
        phone: r.phone || ''
      };
    });
  } finally {
    conn.release();
  }
}

/** sync user bank card count */
async function syncUserBankCardCount(conn, userId) {
  const [cntRows] = await conn.execute('SELECT COUNT(*) AS count FROM bank_cards WHERE user_id = ?', [userId]);
  var n = cntRows.length && cntRows[0].count != null ? Number(cntRows[0].count) : 0;
  await conn.execute('UPDATE users SET bank_card_count = ? WHERE username = ?', [n, userId]);
  return n;
}

var ZXK_DEDUCTION_CATEGORIES = [
  '子女教育',
  '继续教育',
  '大病医疗',
  '住房贷款利息',
  '住房租金',
  '赡养老人',
  '3岁以下婴幼儿照护'
];

/** 是否：valid zxk category */
function isValidZxkCategory(cat) {
  return ZXK_DEDUCTION_CATEGORIES.indexOf(String(cat || '').trim()) >= 0;
}

/** 格式化：zxk record title */
function formatZxkRecordTitle(category, relatedName) {
  var cat = String(category || '').trim();
  var name = String(relatedName || '').trim();
  if (!name) {
    return cat;
  }
  if (
    cat === '赡养老人' ||
    cat === '子女教育' ||
    cat === '3岁以下婴幼儿照护' ||
    cat === '大病医疗'
  ) {
    return cat + '（' + name + '）';
  }
  return cat;
}

/** 格式化：zxk date for api */
function formatZxkDateForApi(d) {
  if (!d) {
    return '';
  }
  if (d instanceof Date && !isNaN(d.getTime())) {
    var Y = d.getFullYear();
    var M = String(d.getMonth() + 1).padStart(2, '0');
    var D = String(d.getDate()).padStart(2, '0');
    return Y + '-' + M + '-' + D;
  }
  var s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  return s;
}

/** map zxk record row */
function mapZxkRecordRow(r) {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    related_name: r.related_name != null ? String(r.related_name) : '',
    last_modified_date: formatZxkDateForApi(r.last_modified_date),
    filing_source: r.filing_source != null ? String(r.filing_source) : '本人',
    deduction_year: r.deduction_year != null ? Number(r.deduction_year) : 0,
    is_voided: r.is_voided && Number(r.is_voided) === 1 ? 1 : 0,
    created_at: r.created_at ? r.created_at.toISOString() : '',
    updated_at: r.updated_at ? r.updated_at.toISOString() : ''
  };
}

/** list special deduction records for user */
async function listSpecialDeductionRecordsForUser(userId, year, includeVoided) {
  const conn = await pool.getConnection();
  try {
    var y = parseInt(year, 10);
    if (!y || y < 2000 || y > 2100) {
      y = new Date().getFullYear();
    }
    var voided = includeVoided === true || includeVoided === 1 || includeVoided === '1';
    var sql =
      'SELECT id, category, title, related_name, last_modified_date, filing_source, deduction_year, is_voided, created_at, updated_at ' +
      'FROM special_deduction_records WHERE user_id = ? AND deduction_year = ?';
    var params = [userId, y];
    if (!voided) {
      sql += ' AND is_voided = 0';
    } else {
      sql += ' AND is_voided = 1';
    }
    sql += ' ORDER BY last_modified_date DESC, updated_at DESC, id DESC';
    const [rows] = await conn.execute(sql, params);
    return rows.map(mapZxkRecordRow);
  } finally {
    conn.release();
  }
}

/** 确保：user exists for zxk */
async function ensureUserExistsForZxk(conn, userId) {
  const [userRows] = await conn.execute('SELECT username FROM users WHERE username = ?', [userId]);
  if (userRows.length === 0) {
    await conn.execute(
      `INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [userId, '', '', userId, USER_TYPE_NORMAL, '自动创建']
    );
  }
}

/** 用户域 GET */
async function handleUserGet(req, res) {
  var action = req.query.action;
  if (
    action !== 'info' &&
    action !== 'summary' &&
    action !== 'rename_policy' &&
    action !== 'tax_edit_policy' &&
    action !== 'employers' &&
    action !== 'family_members' &&
    action !== 'family_member' &&
    action !== 'bank_cards' &&
    action !== 'special_deduction_records'
  ) {
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  }
  var userId = req.authUserId;
  if (userId == null || userId === '') {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  try {
    if (action === 'rename_policy') {
      var renamePol = await getRenameFeePolicy(userId);
      return res.json({ code: 200, data: renamePol });
    }
    if (action === 'tax_edit_policy') {
      var taxEditPol = await getTaxEditFeePolicy(userId);
      return res.json({ code: 200, data: taxEditPol });
    }
    if (action === 'summary') {
      var summary = await getUserSummaryForApi(userId);
      if (!summary) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      return res.json({ code: 200, data: summary });
    }
    if (action === 'family_members') {
      var members = await listFamilyMembersForUser(userId);
      return res.json({ code: 200, data: { members: members } });
    }
    if (action === 'family_member') {
      var fmId = req.query.id != null ? String(req.query.id).trim() : '';
      if (!fmId) {
        return res.status(400).json({ code: 400, msg: 'id required' });
      }
      var fmOne = await getFamilyMemberForUser(userId, fmId);
      if (!fmOne) {
        return res.status(404).json({ code: 404, msg: '家庭成员不存在' });
      }
      return res.json({ code: 200, data: { member: fmOne } });
    }
    if (action === 'bank_cards') {
      var cards = await listBankCardsForUser(userId);
      return res.json({ code: 200, data: { cards: cards } });
    }
    if (action === 'special_deduction_records') {
      var voidedQ =
        req.query.voided === '1' || req.query.voided === 'true' || req.query.voided === true;
      var zxkList = await listSpecialDeductionRecordsForUser(userId, req.query.year, voidedQ);
      return res.json({ code: 200, data: { records: zxkList } });
    }
    if (action === 'employers') {
      var employersOnly = await listEmployersForUser(userId);
      return res.json({ code: 200, data: { employers: employersOnly } });
    }
    var data = await getUserInfoForApi(userId);
    if (!data) {
      return res.status(400).json({ code: 400, msg: 'user_id required' });
    }
    res.json({ code: 200, data: data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 用户域 POST */
async function handleUserPost(req, res) {
  var body = req.body || {};
  var action = body.action;
  var userId = req.authUserId;
  
  try {
    if (/^track_[a-z0-9_]{1,80}$/i.test(String(action || ''))) {
      var trackRateUser = await checkTrackRate(req);
      if (!trackRateUser.ok) {
        return sendRateLimited(res, trackRateUser, '埋点请求过于频繁，请稍后再试');
      }
      if (!isRetainedTrackAction(action)) {
        return res.json({ code: 200, data: { ok: true, ignored: true } });
      }
      maybeRecordClientApiPerfTrack(req, action, body.meta);
      recordInstallGuideTrackEvent(req, action, body.meta);
      recordAdPageTrackEvent(req, action, body.meta);
      var trackActUser = String(action || '').trim().toLowerCase();
      if (
        userId &&
        (trackActUser === 'track_purchase_page_leave' || trackActUser === 'track_purchase_back_click')
      ) {
        queueAutoPurchaseExitMessage(userId);
      }
      return res.json({ code: 200, data: { ok: true } });
    }

    if (action === 'add_employer') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      
      var employerData = {
        company_name: body.company_name || '',
        credit_code: body.credit_code || '',
        position: body.position || '',
        hire_date: body.hire_date || '',
        leave_date: body.leave_date || '',
        status: body.status || '1'
      };
      
      const conn = await pool.getConnection();
      const [userRows] = await conn.execute('SELECT * FROM users WHERE username = ?', [userId]);
      
      if (userRows.length === 0) {
        await conn.execute(`
          INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
          VALUES (?, ?, ?, ?, 0, ?, ?)
        `, [userId, '', '', userId, USER_TYPE_NORMAL, '自动创建']);
      }
      
      employerData.id = 'emp_' + Date.now();
      await conn.execute(`
        INSERT INTO employers (id, user_id, company_name, credit_code, position, hire_date, leave_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        employerData.id, userId, employerData.company_name, employerData.credit_code,
        employerData.position, employerData.hire_date, employerData.leave_date, employerData.status
      ]);
      
      const [employerCount] = await conn.execute(
        'SELECT COUNT(*) as count FROM employers WHERE user_id = ?',
        [userId]
      );
      await conn.execute('UPDATE users SET employer_count = ? WHERE username = ?', [employerCount[0].count, userId]);
      
      conn.release();
      invalidateUserInfoApiCache(userId);
      
      return res.json({
        code: 200,
        data: {
          success: true,
          employer: employerData,
          employer_count: Number(employerCount[0].count) || 0
        }
      });
    }

    if (action === 'update_employer') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      if (!body.employer_id) {
        return res.status(400).json({ code: 400, msg: 'employer_id required' });
      }
      const connUpd = await pool.getConnection();
      try {
        const [updRows] = await connUpd.execute(
          `UPDATE employers SET company_name = ?, credit_code = ?, position = ?, hire_date = ?, leave_date = ?, status = ?
           WHERE id = ? AND user_id = ?`,
          [
            body.company_name || '',
            body.credit_code || '',
            body.position || '',
            body.hire_date || '',
            body.leave_date || '',
            body.status != null ? String(body.status) : '1',
            body.employer_id,
            userId
          ]
        );
        if (!updRows || !updRows.affectedRows) {
          return res.status(404).json({ code: 404, msg: '任职受雇记录不存在' });
        }
        var employerCountAfterUpd = await syncUserEmployerCount(connUpd, userId);
        invalidateUserInfoApiCache(userId);
        return res.json({
          code: 200,
          data: {
            success: true,
            employer_count: employerCountAfterUpd,
            employer: {
              id: body.employer_id,
              company_name: body.company_name || '',
              credit_code: body.credit_code || '',
              position: body.position || '',
              hire_date: body.hire_date || '',
              leave_date: body.leave_date || '',
              status: body.status != null ? String(body.status) : '1'
            }
          }
        });
      } finally {
        connUpd.release();
      }
    }
    
    if (action === 'save_profile') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        
        const conn = await pool.getConnection();
        try {
        await conn.beginTransaction();
        const [userRows] = await conn.execute('SELECT * FROM users WHERE username = ?', [userId]);
        
        if (userRows.length === 0) {
          await conn.execute(`
            INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
            VALUES (?, ?, ?, ?, 0, ?, ?)
          `, [userId, '', '', userId, USER_TYPE_NORMAL, '自动创建']);
        }
        
        const [userRows2] = await conn.execute('SELECT * FROM users WHERE username = ? FOR UPDATE', [userId]);
        const profileUser = userRows2.length ? userRows2[0] : null;
        const isTestProfile = profileUser && rowUserTypeIsTest(profileUser);
        
        let updateFields = [];
        let updateParams = [];
        
        if (body.real_name != null) {
          updateFields.push('real_name = ?');
          updateParams.push(String(body.real_name));
        }
        if (body.tax_id != null) {
          var taxIdVal = String(body.tax_id).trim();
          if (!isPlaceholderTaxId(taxIdVal)) {
            updateFields.push('tax_id = ?');
            updateParams.push(taxIdVal);
          }
        }
        if (body.gender != null) {
          updateFields.push('gender = ?');
          updateParams.push(Number(body.gender));
        }
        if (body.employer_count != null) {
          updateFields.push('employer_count = ?');
          updateParams.push(Number(body.employer_count));
        }
        if (body.family_count != null) {
          updateFields.push('family_count = ?');
          updateParams.push(Number(body.family_count));
        }
        if (body.bank_card_count != null) {
          updateFields.push('bank_card_count = ?');
          updateParams.push(Number(body.bank_card_count));
        }

        function profileField(bodyObj, key, maxLen) {
          if (!Object.prototype.hasOwnProperty.call(bodyObj, key)) {
            return undefined;
          }
          var s = bodyObj[key] == null ? '' : String(bodyObj[key]).trim();
          if (s.length > maxLen) {
            s = s.substring(0, maxLen);
          }
          return s;
        }
        var pfHujiArea = profileField(body, 'huji_area', 255);
        if (pfHujiArea !== undefined) {
          updateFields.push('huji_area = ?');
          updateParams.push(pfHujiArea);
        }
        var pfHujiDetail = profileField(body, 'huji_detail', 512);
        if (pfHujiDetail !== undefined) {
          updateFields.push('huji_detail = ?');
          updateParams.push(pfHujiDetail);
        }
        var pfLivingArea = profileField(body, 'living_area', 255);
        if (pfLivingArea !== undefined) {
          updateFields.push('living_area = ?');
          updateParams.push(pfLivingArea);
        }
        var pfLivingDetail = profileField(body, 'living_detail', 512);
        if (pfLivingDetail !== undefined) {
          updateFields.push('living_detail = ?');
          updateParams.push(pfLivingDetail);
        }
        var pfContactArea = profileField(body, 'contact_area', 255);
        if (pfContactArea !== undefined) {
          updateFields.push('contact_area = ?');
          updateParams.push(pfContactArea);
        }
        var pfContactDetail = profileField(body, 'contact_detail', 512);
        if (pfContactDetail !== undefined) {
          updateFields.push('contact_detail = ?');
          updateParams.push(pfContactDetail);
        }
        var pfIdType = profileField(body, 'id_type', 64);
        if (pfIdType !== undefined && !isTestProfile) {
          updateFields.push('id_type = ?');
          updateParams.push(pfIdType);
        }
        var pfBirth = profileField(body, 'birth_date', 32);
        if (pfBirth !== undefined && !isTestProfile) {
          updateFields.push('birth_date = ?');
          updateParams.push(pfBirth);
        }
        var pfNationality = profileField(body, 'nationality', 128);
        if (pfNationality !== undefined && !isTestProfile) {
          updateFields.push('nationality = ?');
          updateParams.push(pfNationality);
        }
        var pfEducation = profileField(body, 'education', 64);
        if (pfEducation !== undefined) {
          updateFields.push('education = ?');
          updateParams.push(pfEducation);
        }
        var pfEthnicity = profileField(body, 'ethnicity', 64);
        if (pfEthnicity !== undefined) {
          updateFields.push('ethnicity = ?');
          updateParams.push(pfEthnicity);
        }
        var pfEmail = profileField(body, 'email', 255);
        if (pfEmail !== undefined) {
          if (pfEmail && !isValidUserEmail(pfEmail)) {
            await conn.rollback();
            return res.status(400).json({ code: 400, msg: '邮箱格式不正确，请填写常用邮箱（如 QQ/163）' });
          }
          updateFields.push('email = ?');
          updateParams.push(pfEmail);
        }
        
        if (updateFields.length > 0) {
          var oldRealName =
            profileUser && profileUser.real_name != null ? String(profileUser.real_name) : '';
          var newRealName = null;
          if (body.real_name != null) {
            newRealName = String(body.real_name);
          }
          var renaming =
            newRealName != null && String(newRealName).trim() !== String(oldRealName).trim();
          var renamePolicy = null;
          if (renaming) {
            renamePolicy = await getRenameFeePolicy(userId);
          }
          updateParams.push(userId);
          await conn.execute(`UPDATE users SET ${updateFields.join(', ')} WHERE username = ?`, updateParams);
          if (renaming) {
            try {
              await conn.execute(
                `INSERT INTO user_profile_change_logs (username, field_key, before_value, after_value)
                 VALUES (?, 'real_name', ?, ?)`,
                [
                  userId,
                  String(oldRealName).substring(0, 512),
                  String(newRealName).substring(0, 512)
                ]
              );
            } catch (eNameLog) {
              console.error('user_profile_change_logs insert', eNameLog);
            }
          }
        }
        
        await conn.commit();
        invalidateUserInfoApiCache(userId);
        
        return res.json({ code: 200, data: { success: true } });
        } catch (eProfSave) {
          try {
            await conn.rollback();
          } catch (eRbProf) {}
          console.error('save_profile', eProfSave);
          return res.status(500).json({ code: 500, msg: '保存失败' });
        } finally {
          try {
            conn.release();
          } catch (eRelProf) {}
        }
      }

      if (action === 'add_family_member') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var fmParsed = parseFamilyMemberBody(body);
        if (fmParsed.err) {
          return res.status(400).json({ code: 400, msg: fmParsed.err });
        }
        var fmData = fmParsed.data;
        const connFm = await pool.getConnection();
        try {
          const [userRowsFm] = await connFm.execute('SELECT username FROM users WHERE username = ?', [userId]);
          if (userRowsFm.length === 0) {
            await connFm.execute(
              `INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
               VALUES (?, ?, ?, ?, 0, ?, ?)`,
              [userId, '', '', userId, USER_TYPE_NORMAL, '自动创建']
            );
          }
          var fmId = 'fm_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
          await connFm.execute(
            `INSERT INTO family_members (id, user_id, real_name, relation, id_type, id_type_label, id_no, birth_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              fmId,
              userId,
              fmData.real_name,
              fmData.relation,
              fmData.id_type,
              fmData.id_type_label || null,
              fmData.id_no,
              fmData.birth_date || null
            ]
          );
          var familyCount = await syncUserFamilyCount(connFm, userId);
          return res.json({
            code: 200,
            data: {
              success: true,
              member: {
                id: fmId,
                real_name: fmData.real_name,
                relation: fmData.relation,
                id_type: fmData.id_type,
                id_type_label: fmData.id_type_label,
                id_no_masked: maskFamilyMemberIdNo(fmData.id_no),
                birth_date: fmData.birth_date
              },
              family_count: familyCount
            }
          });
        } finally {
          connFm.release();
        }
      }

      if (action === 'update_family_member') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var fmUpId = String(body.member_id || body.id || '').trim();
        if (!fmUpId) {
          return res.status(400).json({ code: 400, msg: 'member_id required' });
        }
        var fmUpParsed = parseFamilyMemberBody(body);
        if (fmUpParsed.err) {
          return res.status(400).json({ code: 400, msg: fmUpParsed.err });
        }
        var fmUpData = fmUpParsed.data;
        const connFmUp = await pool.getConnection();
        try {
          const [existFm] = await connFmUp.execute(
            'SELECT id FROM family_members WHERE id = ? AND user_id = ? LIMIT 1',
            [fmUpId, userId]
          );
          if (!existFm.length) {
            return res.status(404).json({ code: 404, msg: '家庭成员不存在' });
          }
          await connFmUp.execute(
            `UPDATE family_members SET real_name = ?, relation = ?, id_type = ?, id_type_label = ?, id_no = ?, birth_date = ?
             WHERE id = ? AND user_id = ?`,
            [
              fmUpData.real_name,
              fmUpData.relation,
              fmUpData.id_type,
              fmUpData.id_type_label || null,
              fmUpData.id_no,
              fmUpData.birth_date || null,
              fmUpId,
              userId
            ]
          );
          return res.json({
            code: 200,
            data: {
              success: true,
              member: {
                id: fmUpId,
                real_name: fmUpData.real_name,
                relation: fmUpData.relation,
                id_type: fmUpData.id_type,
                id_type_label: fmUpData.id_type_label,
                id_no_masked: maskFamilyMemberIdNo(fmUpData.id_no),
                birth_date: fmUpData.birth_date
              }
            }
          });
        } finally {
          connFmUp.release();
        }
      }

      if (action === 'delete_family_member') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var fmDelId = String(body.member_id || body.id || '').trim();
        if (!fmDelId) {
          return res.status(400).json({ code: 400, msg: 'member_id required' });
        }
        const connFmDel = await pool.getConnection();
        try {
          const [delFmRows] = await connFmDel.execute(
            'SELECT id FROM family_members WHERE id = ? AND user_id = ? LIMIT 1',
            [fmDelId, userId]
          );
          if (!delFmRows.length) {
            return res.status(404).json({ code: 404, msg: '家庭成员不存在' });
          }
          await connFmDel.execute('DELETE FROM family_members WHERE id = ? AND user_id = ?', [fmDelId, userId]);
          var delFamilyCount = await syncUserFamilyCount(connFmDel, userId);
          return res.json({
            code: 200,
            data: { success: true, family_count: delFamilyCount }
          });
        } finally {
          connFmDel.release();
        }
      }

      if (action === 'add_bank_card') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var cardNo = String(body.card_no || '').replace(/\D/g, '');
        var phone = String(body.phone || '').replace(/\D/g, '');
        var province = String(body.province || '').trim();
        var bankName = String(body.bank_name || '').trim();
        if (!cardNo || cardNo.length < 16) {
          return res.status(400).json({ code: 400, msg: '请填写正确的银行卡号' });
        }
        if (phone.length !== 11) {
          return res.status(400).json({ code: 400, msg: '请填写11位银行预留手机号' });
        }
        if (!bankName) {
          bankName = inferBankNameFromCardNo(cardNo);
        }
        const connBc = await pool.getConnection();
        try {
          const [userRowsBc] = await connBc.execute('SELECT username FROM users WHERE username = ?', [userId]);
          if (userRowsBc.length === 0) {
            await connBc.execute(
              `INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
               VALUES (?, ?, ?, ?, 0, ?, ?)`,
              [userId, '', '', userId, USER_TYPE_NORMAL, '自动创建']
            );
          }
          var bcId = 'bc_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
          const [existBc] = await connBc.execute('SELECT COUNT(*) AS count FROM bank_cards WHERE user_id = ?', [
            userId
          ]);
          var isFirstCard =
            !(existBc.length && existBc[0].count != null && Number(existBc[0].count) > 0);
          await connBc.execute(
            `INSERT INTO bank_cards (id, user_id, card_no, bank_name, province, phone, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [bcId, userId, cardNo, bankName, province || null, phone, isFirstCard ? 1 : 0]
          );
          var bankCardCount = await syncUserBankCardCount(connBc, userId);
          return res.json({
            code: 200,
            data: {
              success: true,
              card: {
                id: bcId,
                bank_name: bankName,
                card_no_masked: maskBankCardNo(cardNo),
                card_no_masked_short: maskBankCardNoShort(cardNo),
                is_default: isFirstCard,
                province: province,
                phone: phone
              },
              bank_card_count: bankCardCount
            }
          });
        } finally {
          connBc.release();
        }
      }

      if (action === 'delete_bank_card') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var delCardId = String(body.card_id || body.id || '').trim();
        if (!delCardId) {
          return res.status(400).json({ code: 400, msg: 'card_id required' });
        }
        const connDelBc = await pool.getConnection();
        try {
          const [delRows] = await connDelBc.execute(
            'SELECT id, is_default FROM bank_cards WHERE id = ? AND user_id = ? LIMIT 1',
            [delCardId, userId]
          );
          if (!delRows.length) {
            return res.status(404).json({ code: 404, msg: '银行卡不存在' });
          }
          var wasDefault = delRows[0].is_default && Number(delRows[0].is_default) === 1;
          await connDelBc.execute('DELETE FROM bank_cards WHERE id = ? AND user_id = ?', [delCardId, userId]);
          if (wasDefault) {
            const [nextRows] = await connDelBc.execute(
              'SELECT id FROM bank_cards WHERE user_id = ? ORDER BY created_at ASC, id ASC LIMIT 1',
              [userId]
            );
            if (nextRows.length) {
              await connDelBc.execute('UPDATE bank_cards SET is_default = 1 WHERE id = ? AND user_id = ?', [
                nextRows[0].id,
                userId
              ]);
            }
          }
          var delBankCardCount = await syncUserBankCardCount(connDelBc, userId);
          return res.json({
            code: 200,
            data: { success: true, bank_card_count: delBankCardCount }
          });
        } finally {
          connDelBc.release();
        }
      }

      if (action === 'set_default_bank_card') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var defCardId = String(body.card_id || body.id || '').trim();
        if (!defCardId) {
          return res.status(400).json({ code: 400, msg: 'card_id required' });
        }
        const connDefBc = await pool.getConnection();
        try {
          const [defRows] = await connDefBc.execute(
            'SELECT id FROM bank_cards WHERE id = ? AND user_id = ? LIMIT 1',
            [defCardId, userId]
          );
          if (!defRows.length) {
            return res.status(404).json({ code: 404, msg: '银行卡不存在' });
          }
          await connDefBc.execute('UPDATE bank_cards SET is_default = 0 WHERE user_id = ?', [userId]);
          await connDefBc.execute('UPDATE bank_cards SET is_default = 1 WHERE id = ? AND user_id = ?', [
            defCardId,
            userId
          ]);
          return res.json({ code: 200, data: { success: true, card_id: defCardId } });
        } finally {
          connDefBc.release();
        }
      }

      if (action === 'add_special_deduction_record') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var zxkCat = String(body.category || '').trim();
        if (!isValidZxkCategory(zxkCat)) {
          return res.status(400).json({ code: 400, msg: '扣除类型无效' });
        }
        var zxkYear = parseInt(body.deduction_year, 10);
        if (!zxkYear || zxkYear < 2000 || zxkYear > 2100) {
          zxkYear = new Date().getFullYear();
        }
        var zxkRelated = String(body.related_name || '').trim();
        var zxkSource = String(body.filing_source || '本人').trim() || '本人';
        var zxkMod = String(body.last_modified_date || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(zxkMod)) {
          var now = new Date();
          zxkMod =
            now.getFullYear() +
            '-' +
            String(now.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(now.getDate()).padStart(2, '0');
        }
        var zxkTitle = formatZxkRecordTitle(zxkCat, zxkRelated);
        const connZxkAdd = await pool.getConnection();
        try {
          await ensureUserExistsForZxk(connZxkAdd, userId);
          var zxkId = 'zxk_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
          await connZxkAdd.execute(
            `INSERT INTO special_deduction_records
             (id, user_id, category, title, related_name, last_modified_date, filing_source, deduction_year, is_voided)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [
              zxkId,
              userId,
              zxkCat,
              zxkTitle,
              zxkRelated || null,
              zxkMod,
              zxkSource,
              zxkYear
            ]
          );
          const [zxkRows] = await connZxkAdd.execute(
            'SELECT id, category, title, related_name, last_modified_date, filing_source, deduction_year, is_voided, created_at, updated_at FROM special_deduction_records WHERE id = ? AND user_id = ?',
            [zxkId, userId]
          );
          return res.json({
            code: 200,
            data: { success: true, record: mapZxkRecordRow(zxkRows[0]) }
          });
        } finally {
          connZxkAdd.release();
        }
      }

      if (action === 'update_special_deduction_record') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var zxkUpId = String(body.record_id || body.id || '').trim();
        if (!zxkUpId) {
          return res.status(400).json({ code: 400, msg: 'record_id required' });
        }
        const connZxkUp = await pool.getConnection();
        try {
          const [existZxk] = await connZxkUp.execute(
            'SELECT * FROM special_deduction_records WHERE id = ? AND user_id = ? LIMIT 1',
            [zxkUpId, userId]
          );
          if (!existZxk.length) {
            return res.status(404).json({ code: 404, msg: '记录不存在' });
          }
          var base = existZxk[0];
          var upCat =
            body.category != null && String(body.category).trim()
              ? String(body.category).trim()
              : base.category;
          if (!isValidZxkCategory(upCat)) {
            return res.status(400).json({ code: 400, msg: '扣除类型无效' });
          }
          var upRelated =
            body.related_name != null ? String(body.related_name).trim() : base.related_name || '';
          var upSource =
            body.filing_source != null && String(body.filing_source).trim()
              ? String(body.filing_source).trim()
              : base.filing_source || '本人';
          var upYear =
            body.deduction_year != null ? parseInt(body.deduction_year, 10) : base.deduction_year;
          if (!upYear || upYear < 2000 || upYear > 2100) {
            upYear = base.deduction_year;
          }
          var upMod =
            body.last_modified_date != null && String(body.last_modified_date).trim()
              ? String(body.last_modified_date).trim()
              : formatZxkDateForApi(base.last_modified_date);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(upMod)) {
            return res.status(400).json({ code: 400, msg: '最后修改时间格式应为 YYYY-MM-DD' });
          }
          var upTitle = formatZxkRecordTitle(upCat, upRelated);
          var upVoided =
            body.is_voided != null && (body.is_voided === 1 || body.is_voided === true || body.is_voided === '1')
              ? 1
              : base.is_voided && Number(base.is_voided) === 1
                ? 1
                : 0;
          await connZxkUp.execute(
            `UPDATE special_deduction_records SET category = ?, title = ?, related_name = ?, last_modified_date = ?,
             filing_source = ?, deduction_year = ?, is_voided = ? WHERE id = ? AND user_id = ?`,
            [
              upCat,
              upTitle,
              upRelated || null,
              upMod,
              upSource,
              upYear,
              upVoided,
              zxkUpId,
              userId
            ]
          );
          const [upRows] = await connZxkUp.execute(
            'SELECT id, category, title, related_name, last_modified_date, filing_source, deduction_year, is_voided, created_at, updated_at FROM special_deduction_records WHERE id = ? AND user_id = ?',
            [zxkUpId, userId]
          );
          return res.json({
            code: 200,
            data: { success: true, record: mapZxkRecordRow(upRows[0]) }
          });
        } finally {
          connZxkUp.release();
        }
      }

      if (action === 'delete_special_deduction_record') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var zxkDelId = String(body.record_id || body.id || '').trim();
        if (!zxkDelId) {
          return res.status(400).json({ code: 400, msg: 'record_id required' });
        }
        const connZxkDel = await pool.getConnection();
        try {
          const [delZxk] = await connZxkDel.execute(
            'DELETE FROM special_deduction_records WHERE id = ? AND user_id = ?',
            [zxkDelId, userId]
          );
          if (!delZxk.affectedRows) {
            return res.status(404).json({ code: 404, msg: '记录不存在' });
          }
          return res.json({ code: 200, data: { success: true } });
        } finally {
          connZxkDel.release();
        }
      }

      if (action === 'change_password') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        var oldPassword = String(body.old_password || '');
        var newPassword = String(body.new_password || '');
        if (!oldPassword) {
          return res.status(400).json({ code: 400, msg: '请输入原密码' });
        }
        var newPwdErr = validatePassword(newPassword);
        if (newPwdErr) {
          return res.status(400).json({ code: 400, msg: newPwdErr });
        }
        if (oldPassword === newPassword) {
          return res.status(400).json({ code: 400, msg: '新密码不能与原密码相同' });
        }
        const connPwd = await pool.getConnection();
        try {
          const [pwdRows] = await connPwd.execute('SELECT * FROM users WHERE username = ?', [userId]);
          if (!pwdRows.length) {
            return res.status(404).json({ code: 404, msg: '用户不存在' });
          }
          const pwdRec = pwdRows[0];
          if (!pwdRec.salt || !pwdRec.hash) {
            return res.status(400).json({ code: 400, msg: '账号尚未设置密码，请联系管理员' });
          }
          const oldCheck = hashPassword(oldPassword, pwdRec.salt);
          if (oldCheck !== pwdRec.hash) {
            return res.status(400).json({ code: 400, msg: '原密码错误' });
          }
          var pwdSaltBuf = crypto.randomBytes(16);
          var pwdSaltHex = pwdSaltBuf.toString('hex');
          var pwdHashHex = hashPasswordWithSalt(newPassword, pwdSaltBuf);
          await connPwd.execute(
            'UPDATE users SET salt = ?, hash = ?, plain_password = ? WHERE username = ?',
            [
              pwdSaltHex,
              pwdHashHex,
              plainPasswordStore.encodePlainPasswordForStore(newPassword),
              userId
            ]
          );
          return res.json({ code: 200, data: { success: true } });
        } finally {
          connPwd.release();
        }
      }
      
      if (action === 'delete_employer') {
        if (!userId) {
          return res.status(400).json({ code: 400, msg: 'user_id required' });
        }
        if (!body.employer_id) {
          return res.status(400).json({ code: 400, msg: 'employer_id required' });
        }
        
        const conn = await pool.getConnection();
        await conn.execute('DELETE FROM employers WHERE id = ? AND user_id = ?', [body.employer_id, userId]);
        var employerCountAfterDel = await syncUserEmployerCount(conn, userId);
        conn.release();
        invalidateUserInfoApiCache(userId);
        
        return res.json({
          code: 200,
          data: { success: true, employer_count: employerCountAfterDel }
        });
      }
      
      return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** classify analytics route */

function classifyAnalyticsRoute(req) {
  var path = req.path || '';
  var method = String(req.method || 'GET').toUpperCase();
  if (path === '/health' || path === '/api/health') {
    return null;
  }
  var body = req.body && typeof req.body === 'object' ? req.body : {};
  var q = req.query && typeof req.query === 'object' ? req.query : {};
  var action = '';
  if (body.action != null && String(body.action).trim() !== '') {
    action = String(body.action).trim();
  } else if (q.action != null && String(q.action).trim() !== '') {
    action = String(q.action).trim();
  }
  if (action && /^track_/i.test(action) && !isRetainedTrackAction(action)) {
    return null;
  }
  if (action && /^track_jump_/i.test(action)) {
    action = collapseTrackJumpEventKey(action);
  }
  if (action.length > 80) {
    action = action.substring(0, 80);
  }
  var actionSuffix = action ? '#' + action : '';

  if (path.indexOf('/api/admin') === 0) {
    return { route_key: method + ' ' + path + actionSuffix, biz_category: '管理后台' };
  }
  if (matchesUserApiResource(path, 'tax')) {
    return { route_key: method + ' /api/tax' + actionSuffix, biz_category: '税务记录' };
  }
  if (matchesUserApiResource(path, 'message')) {
    return { route_key: method + ' /api/message' + actionSuffix, biz_category: '消息中心' };
  }
  if (matchesUserApiResource(path, 'user')) {
    return { route_key: method + ' /api/user' + actionSuffix, biz_category: '用户资料与任职' };
  }
  if (matchesUserApiResource(path, 'feedback')) {
    return { route_key: method + ' /api/feedback' + actionSuffix, biz_category: '用户反馈' };
  }
  if (matchesUserApiResource(path, 'chat')) {
    return { route_key: method + ' /api/chat' + actionSuffix, biz_category: '在线客服' };
  }
  if (matchesUserApiResource(path, 'auth')) {
    return { route_key: method + ' /api/auth' + actionSuffix, biz_category: '认证注册' };
  }
  if (
    path === '/api/shenbao-jilu' ||
    path === '/api/shenbao_jilu.php' ||
    path === '/shenbao_jilu.php'
  ) {
    return { route_key: method + ' /api/shenbao-jilu' + actionSuffix, biz_category: '申报记录' };
  }
  if (path === '/api/public/mine-ui') {
    return { route_key: method + ' /api/public/mine-ui', biz_category: '公开配置' };
  }
  if (path === '/api/public/lizhi-cert-fee') {
    return { route_key: method + ' /api/public/lizhi-cert-fee', biz_category: '公开配置' };
  }
  if (path === '/api/public/install-packages') {
    return { route_key: method + ' /api/public/install-packages', biz_category: '公开配置' };
  }
  if (path === '/api/public/asset') {
    return { route_key: method + ' /api/public/asset', biz_category: '公开下载' };
  }
  return { route_key: method + ' ' + String(path).substring(0, 200), biz_category: '其他' };
}

/** increment api daily counter */
function incrementApiDailyCounter(routeKey, bizCategory, latencyMs) {
  if (!pool || !routeKey || !bizCategory) {
    return;
  }
  var rk = String(routeKey).substring(0, 240);
  var cat = String(bizCategory).substring(0, 64);
  var ms =
    latencyMs != null && !isNaN(Number(latencyMs))
      ? Math.max(0, Math.min(Math.round(Number(latencyMs)), 600000))
      : 0;
  pool
    .execute(
      `INSERT INTO analytics_api_daily (stat_date, route_key, biz_category, cnt, sum_ms, max_ms)
       VALUES (CURDATE(), ?, ?, 1, ?, ?)
       ON DUPLICATE KEY UPDATE
         cnt = cnt + 1,
         sum_ms = sum_ms + VALUES(sum_ms),
         max_ms = GREATEST(max_ms, VALUES(max_ms))`,
      [rk, cat, ms, ms]
    )
    .catch(function (e) {
      console.error('incrementApiDailyCounter', e);
    });
}

var API_SLOW_THRESHOLD_MS = parseInt(process.env.API_SLOW_THRESHOLD_MS || '3000', 10) || 3000;

/** clamp perf ms */
function clampPerfMs(v) {
  var n = Number(v);
  if (!isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), 600000);
}

/** sanitize slow route key */
function sanitizeSlowRouteKey(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  if (s.length > 240) s = s.substring(0, 240);
  return s;
}

/** 记录：api slow event */
function recordApiSlowEvent(payload) {
  if (!pool || !payload) return;
  var totalMs = clampPerfMs(payload.total_ms);
  var netMs = clampPerfMs(payload.net_ms);
  var renderMs = clampPerfMs(payload.render_ms);
  if (totalMs <= 0) {
    totalMs = netMs + renderMs;
  }
  if (totalMs < API_SLOW_THRESHOLD_MS && netMs < API_SLOW_THRESHOLD_MS) {
    return;
  }
  var routeKey = sanitizeSlowRouteKey(payload.route_key);
  if (!routeKey) return;
  var itemCount =
    payload.item_count != null && isFinite(Number(payload.item_count))
      ? Math.max(0, Math.min(Math.round(Number(payload.item_count)), 1000000))
      : null;
  var httpStatus =
    payload.http_status != null && isFinite(Number(payload.http_status))
      ? Math.max(0, Math.min(Math.round(Number(payload.http_status)), 999))
      : null;
  pool
    .execute(
      `INSERT INTO api_slow_events
       (source, route_key, biz_category, net_ms, render_ms, total_ms, item_count,
        username, client_id, page_path, viewport, net_type, http_status, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(payload.source || 'server').substring(0, 16),
        routeKey,
        payload.biz_category != null ? String(payload.biz_category).substring(0, 64) : null,
        netMs,
        renderMs,
        totalMs,
        itemCount,
        payload.username != null ? String(payload.username).substring(0, 255) : null,
        payload.client_id != null ? String(payload.client_id).substring(0, 128) : null,
        payload.page_path != null ? String(payload.page_path).substring(0, 255) : null,
        payload.viewport != null ? String(payload.viewport).substring(0, 64) : null,
        payload.net_type != null ? String(payload.net_type).substring(0, 32) : null,
        httpStatus,
        payload.ip != null ? String(payload.ip).substring(0, 128) : null,
        payload.user_agent != null ? String(payload.user_agent).substring(0, 512) : null
      ]
    )
    .catch(function (e) {
      console.error('recordApiSlowEvent', e);
    });
}

/** 是否：user api5xx error */
function isUserApi5xxError(httpStatus, bizCode) {
  var hs = Number(httpStatus || 0);
  if (hs >= 500 && hs < 600) return true;
  var bc = bizCode != null && isFinite(Number(bizCode)) ? Number(bizCode) : null;
  return bc != null && bc >= 500 && bc < 600;
}

/** 记录：api error event */
function recordApiErrorEvent(payload) {
  if (!pool || !payload) return;
  var routeKey = sanitizeSlowRouteKey(payload.route_key);
  if (!routeKey) return;
  var httpStatus =
    payload.http_status != null && isFinite(Number(payload.http_status))
      ? Math.max(0, Math.min(Math.round(Number(payload.http_status)), 999))
      : 0;
  var bizCode =
    payload.biz_code != null && isFinite(Number(payload.biz_code))
      ? Math.round(Number(payload.biz_code))
      : null;
  if (!isUserApi5xxError(httpStatus, bizCode)) return;
  pool
    .execute(
      `INSERT INTO api_error_events
       (route_key, biz_category, http_status, biz_code, latency_ms,
        username, client_id, page_path, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        routeKey,
        payload.biz_category != null ? String(payload.biz_category).substring(0, 64) : null,
        httpStatus,
        bizCode,
        clampPerfMs(payload.latency_ms),
        payload.username != null ? String(payload.username).substring(0, 255) : null,
        payload.client_id != null ? String(payload.client_id).substring(0, 128) : null,
        payload.page_path != null ? String(payload.page_path).substring(0, 255) : null,
        payload.ip != null ? String(payload.ip).substring(0, 128) : null,
        payload.user_agent != null ? String(payload.user_agent).substring(0, 512) : null
      ]
    )
    .catch(function (e) {
      console.error('recordApiErrorEvent', e);
    });
}

/** maybe record client api perf track */
function maybeRecordClientApiPerfTrack(req, action, meta) {
  var act = String(action || '').toLowerCase();
  if (act !== 'track_api_perf' && act !== 'track_api_slow') {
    return false;
  }
  var m = meta && typeof meta === 'object' ? meta : {};
  var routeKey = sanitizeSlowRouteKey(m.route_key || m.route || m.url || '');
  if (!routeKey) {
    return true;
  }
  // 长轮询本身会挂很久，不当作「慢接口」噪声
  var rkLower = String(routeKey).toLowerCase();
  if (rkLower.indexOf('chat#poll') >= 0 || /\/api\/chat.*poll/.test(rkLower)) {
    return true;
  }
  var clientId = '';
  try {
    if (req.clientDevicePayload && req.clientDevicePayload.client_id) {
      clientId = String(req.clientDevicePayload.client_id).trim();
    }
  } catch (e) {}
  if (!clientId && m.client_id) {
    clientId = String(m.client_id).trim().substring(0, 128);
  }
  recordApiSlowEvent({
    source: 'client',
    route_key: routeKey,
    biz_category: m.biz_category != null ? String(m.biz_category) : '客户端性能',
    net_ms: m.net_ms != null ? m.net_ms : m.network_ms,
    render_ms: m.render_ms != null ? m.render_ms : m.dom_ms,
    total_ms: m.total_ms != null ? m.total_ms : m.cost_ms,
    item_count: m.item_count != null ? m.item_count : m.comment_count,
    username: req.authUserId || m.username || null,
    client_id: clientId || null,
    page_path: m.page_path || m.page || inferPagePathFromRequest(req) || null,
    viewport: m.viewport || null,
    net_type: m.net_type || null,
    http_status: m.http_status,
    ip: getClientIp(req),
    user_agent: req.headers && req.headers['user-agent'] ? String(req.headers['user-agent']) : ''
  });
  return true;
}

/** 埋点请求收尾中间件 */
function analyticsFinishMiddleware(req, res, next) {
  var startedAt = Date.now();
  var origJson = res.json;
  res.json = function (body) {
    try {
      if (body && typeof body === 'object' && body.code != null && isFinite(Number(body.code))) {
        res.__apiBizCode = Number(body.code);
      }
    } catch (e0) {}
    return origJson.call(this, body);
  };
  res.on('finish', function () {
    try {
      var info = classifyAnalyticsRoute(req);
      if (!info) {
        return;
      }
      var latencyMs = Math.max(0, Date.now() - startedAt);
      incrementApiDailyCounter(info.route_key, info.biz_category, latencyMs);
      recordUserPageEvent(req, info.route_key);
      var cid = '';
      try {
        if (req.clientDevicePayload && req.clientDevicePayload.client_id) {
          cid = String(req.clientDevicePayload.client_id).trim();
        }
      } catch (e2) {}
      if (latencyMs >= API_SLOW_THRESHOLD_MS && info.biz_category !== '管理后台') {
        var itemCount = null;
        try {
          var b = req.body && typeof req.body === 'object' ? req.body : {};
          if (Array.isArray(b.records)) {
            itemCount = b.records.length;
          } else if (Array.isArray(b.ids_to_delete)) {
            itemCount = b.ids_to_delete.length;
          }
        } catch (eIc) {}
        recordApiSlowEvent({
          source: 'server',
          route_key: info.route_key,
          biz_category: info.biz_category,
          net_ms: latencyMs,
          render_ms: 0,
          total_ms: latencyMs,
          item_count: itemCount,
          username: req.authUserId || null,
          client_id: cid || null,
          page_path: inferPagePathFromRequest(req) || null,
          http_status: res.statusCode,
          ip: getClientIp(req),
          user_agent: req.headers && req.headers['user-agent'] ? String(req.headers['user-agent']) : ''
        });
      }
      if (info.biz_category !== '管理后台') {
        var bizCode = res.__apiBizCode != null ? Number(res.__apiBizCode) : null;
        if (isUserApi5xxError(res.statusCode, bizCode)) {
          recordApiErrorEvent({
            route_key: info.route_key,
            biz_category: info.biz_category,
            http_status: res.statusCode,
            biz_code: bizCode,
            latency_ms: latencyMs,
            username: req.authUserId || null,
            client_id: cid || null,
            page_path: inferPagePathFromRequest(req) || null,
            ip: getClientIp(req),
            user_agent: req.headers && req.headers['user-agent'] ? String(req.headers['user-agent']) : ''
          });
        }
      }
    } catch (e) {
      console.error('analyticsFinishMiddleware', e);
    }
  });
  next();
}

/** 规范化客户端页面路径 */
function normalizeClientPagePath(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  if (/[\x00-\x1f]/.test(s)) return '';
  if (s.length > 255) s = s.substring(0, 255);
  try {
    if (/^https?:\/\//i.test(s)) {
      var u = new URL(s);
      s = String(u.pathname || '').trim();
    }
  } catch (e) {}
  if (!s) return '';
  if (s.charAt(0) !== '/') s = '/' + s;
  s = s.replace(/\/+/g, '/');
  if (s.indexOf('/api/') === 0 || s === '/api') return '';
  return s;
}

/** infer page path from request */
function inferPagePathFromRequest(req) {
  var direct = normalizeClientPagePath(req.headers && req.headers['x-page-path']);
  if (direct) return direct;
  var ref = normalizeClientPagePath(req.headers && req.headers.referer);
  if (ref) return ref;
  var path = String(req.path || '').trim();
  if (path && path.indexOf('/api/') !== 0 && path.slice(-5).toLowerCase() === '.html') return path;
  return '';
}

var PAGE_EVENT_DEBOUNCE_MS = parseInt(process.env.PAGE_EVENT_DEBOUNCE_MS || '3000', 10) || 3000;
var _pageEventDebounce = new Map();
var DEVICE_SYNC_THROTTLE_MS = parseInt(process.env.DEVICE_SYNC_THROTTLE_MS || '300000', 10) || 300000;
var _deviceSyncThrottle = new Map();
/** 同用户同日 DAU 去重（进程内）；跨实例再靠 Redis SET NX */
var _dauTouchThrottle = new Map();

/** 记录：user page event */
function recordUserPageEvent(req, routeKey) {
  if (!pool || !req || !req.authUserId) return;
  /* 游客沙盒也记页面点击，便于后台详情查看；注册/转化统计仍按 user_type 排除游客 */
  var username = String(req.authUserId).trim().substring(0, 255);
  if (!username) return;
  var pagePath = inferPagePathFromRequest(req);
  if (!pagePath) return;
  // 同页短时间多次接口只记一次，避免每个 authFetch 都 INSERT 抢连接
  var debounceKey = username + '\0' + pagePath;
  var now = Date.now();
  var last = _pageEventDebounce.get(debounceKey) || 0;
  if (now - last < PAGE_EVENT_DEBOUNCE_MS) return;
  _pageEventDebounce.set(debounceKey, now);
  if (_pageEventDebounce.size > 8000) {
    _pageEventDebounce.clear();
  }
  var cid = '';
  try {
    if (req.clientDevicePayload && req.clientDevicePayload.client_id) {
      cid = String(req.clientDevicePayload.client_id).trim().substring(0, 128);
    }
  } catch (e) {}
  var rk = String(routeKey || '').trim().substring(0, 240);
  pool
    .execute(
      `INSERT INTO user_page_events (username, page_path, route_key, client_id)
       VALUES (?, ?, ?, ?)`,
      [username, pagePath, rk || 'unknown', cid || null]
    )
    .catch(function (e) {
      console.error('recordUserPageEvent', e);
    });
}

var INSTALL_GUIDE_EVENT_LABELS = {
  track_install_page_view: '页面浏览',
  track_install_page_leave: '离开页面',
  track_install_page_perf: '页面加载耗时',
  track_page_load_perf: '页面加载性能',
  track_install_apk_click: 'Android 安装包点击',
  track_install_ios_click: 'iOS 描述文件点击',
  track_install_step_advance: '下载后进入安装步骤',
  track_install_register_click: '注册入口点击',
  track_install_showcase_view: '效果预览展示',
  track_install_showcase_slide: '效果预览滑动',
  track_install_register_success: '安装页引流注册成功',
  track_install_ios_video_play: '苹果安装视频播放',
  track_install_usage_video_play: '操作视频播放',
  track_app_first_open: 'App 首次打开',
  track_install_app_shell_register_prompt_show: 'App 内安装成功弹窗展示',
  track_install_app_shell_register_prompt_ok: 'App 内弹窗-立即注册',
  track_install_app_shell_register_prompt_later: 'App 内弹窗-稍后再说',
  track_landing_gate_open: '落地关键门禁打开',
  track_landing_demo_click: '落地示例关键点击',
  track_landing_gate_download: '落地门禁点下载',
  track_landing_ab_assignment: 'B/C 分流分配',
  track_landing_ab_view: 'B/C 方案访问',
  track_landing_ab_guest_gate: 'C 游客关键门禁',
  track_landing_ab_guest_download_entry: 'C 游客进入下载',
  track_landing_guest_session: 'C 游客沙盒会话',
  track_landing_guest_activate_download: 'C 游客点激活进入下载',
  track_landing_guest_download_modal_show: 'C 游客下载引导弹窗展示',
  track_landing_guest_download_modal_ok: 'C 游客下载引导-立即下载',
  track_landing_guest_download_modal_later: 'C 游客下载引导-继续体验',
  track_landing_guest_fill_card_show: 'C 游客填税引导卡片展示',
  track_landing_guest_fill_card_ok: 'C 游客填税引导-去填写',
  track_landing_guest_tax_created: 'C 游客完成个税填写',
  track_landing_guest_tax_seeded: 'C 游客首访自动示例个税',
  track_guest_data_migrated: '游客数据合并至注册账号'
};

/** 是否：install guide track context */
function isInstallGuideTrackContext(req, meta) {
  var m = meta && typeof meta === 'object' ? meta : {};
  if (String(m.page || '').trim() === 'install_guide') {
    return true;
  }
  var pp = inferPagePathFromRequest(req);
  return /install_guide\.html/i.test(pp);
}

/** 解析：from install guide flag */
function parseFromInstallGuideFlag(body) {
  var b = body && typeof body === 'object' ? body : {};
  var v = b.from_install_guide;
  return v === true || v === 1 || v === '1' || String(v || '').toLowerCase() === 'true';
}

/** 解析：from share link flag（主站分享流量） */
function parseFromShareFlag(body) {
  var b = body && typeof body === 'object' ? body : {};
  var v = b.from_share;
  return v === true || v === 1 || v === '1' || String(v || '').toLowerCase() === 'true';
}

/**
 * 解析 B/C 落地页方案：优先请求体，其次同 client_id / device_fp / IP 近 48h 的分流记录。
 * 解决浏览器落地与 App 内注册 localStorage 隔离导致 variant 丢失。
 */
async function resolveLandingAbVariantForReq(req, hintVariant) {
  var v = String(hintVariant || '').toLowerCase();
  if (v === 'b' || v === 'c') {
    return v;
  }
  if (!pool) {
    return '';
  }
  var cid = '';
  try {
    if (req.clientDevicePayload && req.clientDevicePayload.client_id) {
      cid = String(req.clientDevicePayload.client_id).trim().substring(0, 128);
    }
  } catch (e0) {}
  var fp = '';
  try {
    fp = String(sanitizeAuditText(computeDeviceFingerprint(req), 64) || '').trim();
  } catch (e1) {}
  var ip = '';
  try {
    ip = String(sanitizeAuditText(getClientIp(req), 128) || '').trim();
  } catch (e2) {}
  if (!cid && !fp && !ip) {
    return '';
  }
  try {
    const [rows] = await pool.query(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(meta_json, '$.landing_variant')) AS v
       FROM install_guide_track_events
       WHERE event_key IN ('track_landing_ab_view', 'track_landing_ab_assignment')
         AND JSON_UNQUOTE(JSON_EXTRACT(meta_json, '$.landing_variant')) IN ('b', 'c')
         AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 48 HOUR)
         AND (
           (? <> '' AND client_id = ?)
           OR (? <> '' AND device_fp = ?)
           OR (? <> '' AND ip = ?)
         )
       ORDER BY
         CASE
           WHEN ? <> '' AND client_id = ? THEN 1
           WHEN ? <> '' AND device_fp = ? THEN 2
           ELSE 3
         END,
         created_at DESC
       LIMIT 1`,
      [cid, cid, fp, fp, ip, ip, cid, cid, fp, fp]
    );
    var found = rows && rows[0] ? String(rows[0].v || '').toLowerCase() : '';
    return found === 'b' || found === 'c' ? found : '';
  } catch (e3) {
    console.error('resolveLandingAbVariantForReq', e3);
    return '';
  }
}

/** 记录：install guide track event */
function recordInstallGuideTrackEvent(req, action, meta) {
  if (!pool) {
    return;
  }
  var act = String(action || '').trim();
  if (!/^track_[a-z0-9_]{1,80}$/i.test(act)) {
    return;
  }
  if (
    !isInstallGuideTrackContext(req, meta) &&
    !/^track_page_load_/i.test(act) &&
    !/^track_install_/i.test(act) &&
    !/^track_landing_/i.test(act) &&
    !/^track_app_/i.test(act) &&
    !/^track_guest_/i.test(act) &&
    !/^track_wechat_/i.test(act) &&
    !/^track_browser_/i.test(act) &&
    !/^track_share_/i.test(act) &&
    !/^track_mine_share_/i.test(act)
  ) {
    return;
  }
  var cid = '';
  try {
    if (req.clientDevicePayload && req.clientDevicePayload.client_id) {
      cid = String(req.clientDevicePayload.client_id).trim().substring(0, 128);
    }
  } catch (e0) {}
  var fp = sanitizeAuditText(computeDeviceFingerprint(req), 64);
  var dwell = null;
  if (meta && meta.dwell_seconds != null) {
    var ds = parseInt(meta.dwell_seconds, 10);
    if (isFinite(ds) && ds >= 0 && ds <= 86400) {
      dwell = ds;
    }
  }
  var metaJson = null;
  try {
    var mj = sanitizeAuditObjectTopLevel(meta);
    if (mj) {
      metaJson = JSON.stringify(mj).substring(0, 1024);
    }
  } catch (e1) {}
  var ip = sanitizeAuditText(getClientIp(req), 128);
  var ua = sanitizeAuditText(normalizeUserAgentHeader(req), 512);
  pool
    .execute(
      `INSERT INTO install_guide_track_events
       (client_id, device_fp, event_key, dwell_seconds, meta_json, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [cid || null, fp || null, act.substring(0, 80), dwell, metaJson, ip || null, ua || null]
    )
    .catch(function (e) {
      console.error('recordInstallGuideTrackEvent', e);
    });
}

/** 是否广告页相关埋点（二次退税页 / 开通页内嵌广告 / 抖音月付大额） */
function isAdPageTrackAction(action) {
  var act = String(action || '').trim().toLowerCase();
  return (
    act.indexOf('track_refund_ad_') === 0 ||
    act.indexOf('track_purchase_refund_ad_') === 0 ||
    act.indexOf('track_douyin_yuefu_ad_') === 0 ||
    act.indexOf('track_gjj_extract_ad_') === 0
  );
}

/** 记录：广告页停留与操作 */
function recordAdPageTrackEvent(req, action, meta) {
  if (!pool || !isAdPageTrackAction(action)) {
    return;
  }
  var act = String(action || '').trim().toLowerCase();
  var username = '';
  try {
    if (req.authUserId) {
      username = String(req.authUserId).trim().substring(0, 255);
    }
  } catch (e0) {}
  var cid = '';
  try {
    if (req.clientDevicePayload && req.clientDevicePayload.client_id) {
      cid = String(req.clientDevicePayload.client_id).trim().substring(0, 128);
    }
  } catch (e1) {}
  var fp = sanitizeAuditText(computeDeviceFingerprint(req), 64);
  var dwell = null;
  if (meta && meta.dwell_seconds != null) {
    var ds = parseInt(meta.dwell_seconds, 10);
    if (isFinite(ds) && ds >= 0 && ds <= 86400) {
      dwell = ds;
    }
  }
  var metaJson = null;
  try {
    var mj = sanitizeAuditObjectTopLevel(meta);
    if (mj) {
      metaJson = JSON.stringify(mj).substring(0, 1024);
    }
  } catch (e2) {}
  var ip = sanitizeAuditText(getClientIp(req), 128);
  var ua = sanitizeAuditText(normalizeUserAgentHeader(req), 512);
  pool
    .execute(
      `INSERT INTO ad_page_track_events
       (username, client_id, device_fp, event_key, dwell_seconds, meta_json, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username || null, cid || null, fp || null, act.substring(0, 80), dwell, metaJson, ip || null, ua || null]
    )
    .catch(function (e) {
      console.error('recordAdPageTrackEvent', e);
    });
}

/** install guide event label */
function installGuideEventLabel(eventKey) {
  var k = String(eventKey || '').trim();
  return INSTALL_GUIDE_EVENT_LABELS[k] || k;
}

/** truncate install guide visitor key */
function truncateInstallGuideVisitorKey(key) {
  var visitor = key ? String(key) : '—';
  if (visitor.length > 14) {
    return visitor.substring(0, 7) + '…' + visitor.substring(visitor.length - 4);
  }
  return visitor;
}

/** install guide device summary from ua */
function installGuideDeviceSummaryFromUa(uaRaw) {
  var ua = uaRaw != null ? String(uaRaw).trim() : '';
  if (!ua) {
    return '—';
  }
  var c = classifyUserDeviceRow(ua, null);
  var parts = [];
  if (c.model_label) {
    parts.push(c.model_label);
  }
  if (c.os_version) {
    parts.push(c.os_version);
  } else if (c.os_key && DEVICE_STATS_OS_FAMILY_LABEL[c.os_key]) {
    parts.push(DEVICE_STATS_OS_FAMILY_LABEL[c.os_key]);
  }
  if (parts.length) {
    return parts.join(' · ');
  }
  return ua.length > 100 ? ua.substring(0, 100) + '…' : ua;
}

/** 构建：install guide recent visitors */
function buildInstallGuideRecentVisitors(rows, maxVisitors) {
  maxVisitors = maxVisitors || 3;
  var groups = {};
  (rows || []).forEach(function (r) {
    var cid = r.client_id ? String(r.client_id).trim() : '';
    var fp = r.device_fp ? String(r.device_fp).trim() : '';
    var vid = cid || fp;
    if (!vid) {
      vid = 'row_' + String(r.id != null ? r.id : '');
    }
    if (!groups[vid]) {
      groups[vid] = {
        visitor_id: vid,
        visitor_key: truncateInstallGuideVisitorKey(vid),
        ip: '',
        device_label: '—',
        user_agent: '',
        latest_at: 0,
        events: []
      };
    }
    var g = groups[vid];
    var at = r.created_at ? r.created_at.toISOString() : '';
    var atMs = r.created_at ? new Date(r.created_at).getTime() : 0;
    if (atMs >= g.latest_at) {
      g.latest_at = atMs;
      if (r.ip) {
        g.ip = String(r.ip);
      }
      if (r.user_agent) {
        g.user_agent = String(r.user_agent);
        g.device_label = installGuideDeviceSummaryFromUa(g.user_agent);
      }
    }
    if (!g.ip && r.ip) {
      g.ip = String(r.ip);
    }
    if (!g.user_agent && r.user_agent) {
      g.user_agent = String(r.user_agent);
      g.device_label = installGuideDeviceSummaryFromUa(g.user_agent);
    }
    var ek = String(r.event_key || '');
    var ds = r.dwell_seconds != null ? Number(r.dwell_seconds) : null;
    var perf = ek === 'track_install_page_perf' ? parseInstallGuidePerfMeta(r.meta_json) : null;
    g.events.push({
      at: at,
      event_key: ek,
      label: installGuideEventLabel(ek),
      dwell_seconds: isFinite(ds) ? ds : null,
      dwell_label: isFinite(ds) ? formatStaySecondsLabel(ds) : '—',
      load_label: perf ? installGuidePerfLoadLabel(perf) : null
    });
  });
  var list = Object.keys(groups).map(function (k) {
    var item = groups[k];
    item.events.sort(function (a, b) {
      return String(b.at).localeCompare(String(a.at));
    });
    return item;
  });
  list.sort(function (a, b) {
    return (b.latest_at || 0) - (a.latest_at || 0);
  });
  return list.slice(0, maxVisitors);
}

/** median from sorted numbers */
function medianFromSortedNumbers(arr) {
  if (!arr || !arr.length) {
    return null;
  }
  var mid = Math.floor(arr.length / 2);
  if (arr.length % 2 === 1) {
    return arr[mid];
  }
  return Math.round((arr[mid - 1] + arr[mid]) / 2);
}

/** 格式化：latency ms label */
function formatLatencyMsLabel(ms) {
  var n = Math.round(Number(ms));
  if (!isFinite(n) || n < 0) {
    return '—';
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(n >= 10000 ? 1 : 2) + ' s';
  }
  return String(n) + ' ms';
}

/** 解析：install guide perf meta */
function parseInstallGuidePerfMeta(metaJson) {
  var m = null;
  try {
    if (metaJson == null) {
      return null;
    }
    if (typeof metaJson === 'object' && !Array.isArray(metaJson)) {
      m = metaJson;
    } else {
      m = JSON.parse(String(metaJson));
    }
  } catch (e0) {
    return null;
  }
  if (!m || typeof m !== 'object') {
    return null;
  }
  function num(key) {
    var n = parseInt(m[key], 10);
    if (!isFinite(n) || n < 0 || n > 120000) {
      return null;
    }
    return n;
  }
  var out = {
    dom_ready_ms: num('dom_ready_ms'),
    packages_net_ms: num('packages_net_ms'),
    packages_render_ms: num('packages_render_ms'),
    packages_total_ms: num('packages_total_ms')
  };
  if (
    out.dom_ready_ms == null &&
    out.packages_net_ms == null &&
    out.packages_render_ms == null &&
    out.packages_total_ms == null
  ) {
    return null;
  }
  return out;
}

/** 解析：C 端页面加载性能 meta（track_page_load_perf） */
function parsePageLoadPerfMeta(metaJson) {
  var m = null;
  try {
    if (metaJson == null) {
      return null;
    }
    if (typeof metaJson === 'object' && !Array.isArray(metaJson)) {
      m = metaJson;
    } else {
      m = JSON.parse(String(metaJson));
    }
  } catch (e0) {
    return null;
  }
  if (!m || typeof m !== 'object') {
    return null;
  }
  function num(key) {
    var n = parseInt(m[key], 10);
    if (!isFinite(n) || n < 0 || n > 120000) {
      return null;
    }
    return n;
  }
  var page = String(m.page || '').trim();
  if (page.length > 64) {
    page = page.substring(0, 64);
  }
  var out = {
    page: page || null,
    dom_ready_ms: num('dom_ready_ms'),
    load_ms: num('load_ms'),
    fcp_ms: num('fcp_ms'),
    ttfb_ms: num('ttfb_ms'),
    platform: String(m.platform || '').trim().substring(0, 16) || null,
    device_model: String(m.device_model || '').trim().substring(0, 48) || null,
    cordova: m.cordova === 1 || m.cordova === '1' ? 1 : 0,
    vw: num('vw'),
    trigger: String(m.trigger || '').trim().substring(0, 24) || null,
    username: String(m.username || '').trim().substring(0, 32) || null
  };
  if (
    !out.page &&
    out.dom_ready_ms == null &&
    out.load_ms == null &&
    out.fcp_ms == null &&
    out.ttfb_ms == null
  ) {
    return null;
  }
  return out;
}

function formatPageLoadPerfLabel(perf) {
  if (!perf || typeof perf !== 'object') {
    return '—';
  }
  var parts = [];
  if (perf.dom_ready_ms != null) {
    parts.push('DOM ' + formatLatencyMsLabel(perf.dom_ready_ms));
  }
  if (perf.fcp_ms != null) {
    parts.push('FCP ' + formatLatencyMsLabel(perf.fcp_ms));
  }
  if (perf.load_ms != null) {
    parts.push('Load ' + formatLatencyMsLabel(perf.load_ms));
  }
  return parts.length ? parts.join(' · ') : '—';
}

/** aggregate ms stats */
function aggregateMsStats(values) {
  var vals = (values || [])
    .map(function (n) {
      return Number(n);
    })
    .filter(function (n) {
      return isFinite(n) && n >= 0 && n <= 120000;
    })
    .sort(function (a, b) {
      return a - b;
    });
  if (!vals.length) {
    return {
      count: 0,
      avg_ms: null,
      median_ms: null,
      avg_label: '—',
      median_label: '—'
    };
  }
  var sum = 0;
  vals.forEach(function (n) {
    sum += n;
  });
  var avg = Math.round(sum / vals.length);
  var med = medianFromSortedNumbers(vals);
  return {
    count: vals.length,
    avg_ms: avg,
    median_ms: med,
    avg_label: formatLatencyMsLabel(avg),
    median_label: med != null ? formatLatencyMsLabel(med) : '—'
  };
}

/** install guide perf load label */
function installGuidePerfLoadLabel(perf) {
  if (!perf) {
    return '—';
  }
  var parts = [];
  if (perf.dom_ready_ms != null) {
    parts.push('DOM ' + formatLatencyMsLabel(perf.dom_ready_ms));
  }
  if (perf.packages_total_ms != null) {
    parts.push('包接口 ' + formatLatencyMsLabel(perf.packages_total_ms));
  } else if (perf.packages_net_ms != null) {
    parts.push(
      '包接口 ' +
        formatLatencyMsLabel(perf.packages_net_ms) +
        (perf.packages_render_ms != null ? '+' + formatLatencyMsLabel(perf.packages_render_ms) : '')
    );
  }
  return parts.length ? parts.join(' · ') : '—';
}

/** touch user daily activity（每用户每日最多写一次） */
function touchUserDailyActivity(username) {
  if (!pool || username == null) {
    return;
  }
  var u = String(username).trim().substring(0, 255);
  if (!u) {
    return;
  }
  var day = chinaDateKeyNow();
  var memKey = u + '|' + day;
  if (_dauTouchThrottle.has(memKey)) {
    return;
  }
  _dauTouchThrottle.set(memKey, 1);
  if (_dauTouchThrottle.size > 20000) {
    _dauTouchThrottle.clear();
    _dauTouchThrottle.set(memKey, 1);
  }
  /* 跨实例：已写过则跳过 DB；失败则仍 INSERT IGNORE */
  var ttlMs = 36 * 3600 * 1000;
  Promise.resolve(kvSetNx('dau:' + day + ':' + u, '1', ttlMs))
    .then(function (isFirst) {
      if (isFirst === false) {
        return null;
      }
      return pool.execute(
        'INSERT IGNORE INTO user_daily_activity (activity_date, username) VALUES (CURDATE(), ?)',
        [u]
      );
    })
    .catch(function (e) {
      console.error('touchUserDailyActivity', e);
    });
}

/** 规范化 User-Agent */
function normalizeUserAgentHeader(req) {
  return String((req.headers && req.headers['user-agent']) || '').trim().substring(0, 500);
}

/** 客户端请求头 X-Client-Device（JSON）允许的字段与最大长度 */
var CLIENT_DEVICE_FIELD_LIMITS = {
  client_id: 128,
  source: 32,
  platform: 64,
  os_version: 64,
  app_version: 64,
  model: 128,
  brand: 64,
  screen: 32,
  user_agent: 400,
  language: 32,
  locale: 32,
  timezone: 64,
  dpr: 16,
  extra: 1024
};

/** sanitize client device payload */
function sanitizeClientDevicePayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  var out = {};
  Object.keys(CLIENT_DEVICE_FIELD_LIMITS).forEach(function (k) {
    var lim = CLIENT_DEVICE_FIELD_LIMITS[k];
    if (raw[k] == null || raw[k] === '') {
      return;
    }
    if (k === 'dpr') {
      var n = Number(raw[k]);
      if (!isNaN(n)) {
        out[k] = String(Math.round(n * 100) / 100).substring(0, lim);
      }
      return;
    }
    var s = String(raw[k])
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
      .substring(0, lim);
    if (s) {
      out[k] = s;
    }
  });
  return Object.keys(out).length ? out : null;
}

/** 读取：client device from request */
function readClientDeviceFromRequest(req) {
  var raw = req.headers['x-client-device'];
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  var s = raw.trim();
  if (!s || s.length > 8192) {
    return null;
  }
  try {
    var o = JSON.parse(s);
    return sanitizeClientDevicePayload(o);
  } catch (e) {
    return null;
  }
}

/** fingerprint from explicit device */
function fingerprintFromExplicitDevice(obj) {
  var cid = obj.client_id ? String(obj.client_id).trim() : '';
  if (cid) {
    return crypto.createHash('sha256').update('ex:' + cid, 'utf8').digest('hex');
  }
  var keys = Object.keys(obj).sort();
  var stable = {};
  keys.forEach(function (k) {
    stable[k] = obj[k];
  });
  return crypto.createHash('sha256').update('exobj:' + JSON.stringify(stable), 'utf8').digest('hex');
}

/** compute device fingerprint */
function computeDeviceFingerprint(req) {
  var ex = req.clientDevicePayload;
  if (ex && Object.keys(ex).length > 0) {
    return fingerprintFromExplicitDevice(ex);
  }
  var ua = normalizeUserAgentHeader(req);
  var plat = '';
  if (req.headers) {
    plat =
      String(req.headers['sec-ch-ua-platform'] || req.headers['sec-ch-ua-mobile'] || '').trim();
  }
  return crypto.createHash('sha256').update(ua + '|' + plat, 'utf8').digest('hex');
}

/** 用户辅助：agent short for store */
function userAgentShortForStore(req) {
  var s = normalizeUserAgentHeader(req);
  if (s.length <= 220) {
    return s;
  }
  return s.substring(0, 220) + '…';
}

/** display user agent from device */
function displayUserAgentFromDevice(req) {
  var ex = req.clientDevicePayload;
  if (ex && ex.user_agent) {
    var u = String(ex.user_agent);
    if (u.length <= 220) {
      return u;
    }
    return u.substring(0, 220) + '…';
  }
  return userAgentShortForStore(req);
}

/** 注册满 N 天后禁止在未绑定过的新设备登录（天） */
var AGED_ACCOUNT_NEW_DEVICE_LOGIN_DAYS = 30;
/** 关闭「老账号禁止新设备登录」限制（解禁） */
var AGED_ACCOUNT_NEW_DEVICE_LOGIN_ENABLED = false;

/**
 * 注册超过 AGED_ACCOUNT_NEW_DEVICE_LOGIN_DAYS 天的账号：仅允许已出现在 user_devices 的设备登录。
 * 尚无任何设备记录的历史账号允许本次登录以绑定首台设备，避免误锁死。
 * 游客账号跳过。
 * AGED_ACCOUNT_NEW_DEVICE_LOGIN_ENABLED=false 时整段跳过。
 */
async function assertLoginDeviceAllowedForAgedAccount(username, req) {
  if (!AGED_ACCOUNT_NEW_DEVICE_LOGIN_ENABLED) {
    return;
  }
  if (!pool || !username) {
    return;
  }
  var uname = String(username).trim();
  if (!uname) {
    return;
  }
  const conn = await pool.getConnection();
  try {
    const [urows] = await conn.execute(
      `SELECT user_type,
              TIMESTAMPDIFF(DAY, created_at, UTC_TIMESTAMP()) AS days_since_register
       FROM users WHERE username = ? LIMIT 1`,
      [uname]
    );
    if (!urows.length) {
      return;
    }
    var ut = urows[0].user_type != null ? Number(urows[0].user_type) : USER_TYPE_NORMAL;
    if (ut === USER_TYPE_GUEST) {
      return;
    }
    var days = Number(urows[0].days_since_register);
    if (!Number.isFinite(days) || days < AGED_ACCOUNT_NEW_DEVICE_LOGIN_DAYS) {
      return;
    }

    var fp = computeDeviceFingerprint(req);
    var ex = req.clientDevicePayload;
    var clientId =
      ex && ex.client_id != null && String(ex.client_id).trim() !== ''
        ? String(ex.client_id).trim().substring(0, 128)
        : '';

    const [devs] = await conn.execute(
      'SELECT device_fp, client_id FROM user_devices WHERE username = ?',
      [uname]
    );
    if (!devs.length) {
      return;
    }
    for (var i = 0; i < devs.length; i++) {
      if (String(devs[i].device_fp || '') === fp) {
        return;
      }
      if (
        clientId &&
        devs[i].client_id != null &&
        String(devs[i].client_id).trim() === clientId
      ) {
        return;
      }
    }
    throw new Error('该账号注册已超过30天，禁止在新设备登录，请使用常用设备登录');
  } finally {
    conn.release();
  }
}

/** sync user device from client json */
function syncUserDeviceFromClientJson(req, username) {
  if (!pool || !username) {
    return Promise.resolve();
  }
  var ex = req.clientDevicePayload;
  if (!ex || !Object.keys(ex).length) {
    return Promise.resolve();
  }
  var fp = fingerprintFromExplicitDevice(ex);
  var throttleKey = String(username).trim() + '\0' + fp;
  var now = Date.now();
  var last = _deviceSyncThrottle.get(throttleKey) || 0;
  if (now - last < DEVICE_SYNC_THROTTLE_MS) {
    return Promise.resolve();
  }
  _deviceSyncThrottle.set(throttleKey, now);
  if (_deviceSyncThrottle.size > 8000) {
    _deviceSyncThrottle.clear();
  }
  var detailJson = JSON.stringify(ex);
  var clientId = ex.client_id ? String(ex.client_id).substring(0, 128) : null;
  var ip = getClientIp(req);
  var city = cityLabelFromIp(ip);
  var uaDisp = displayUserAgentFromDevice(req);
  return pool
    .execute(
      `INSERT INTO user_devices (username, device_fp, user_agent_short, ip_last, city_last, login_count, client_id, device_detail_json, api_sync_count)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         user_agent_short = VALUES(user_agent_short),
         ip_last = VALUES(ip_last),
         city_last = VALUES(city_last),
         device_detail_json = VALUES(device_detail_json),
         client_id = COALESCE(VALUES(client_id), client_id),
         api_sync_count = api_sync_count + 1,
         last_seen = CURRENT_TIMESTAMP`,
      [String(username).trim().substring(0, 255), fp, uaDisp, ip.substring(0, 128), city.substring(0, 255), clientId, detailJson]
    )
    .catch(function (e) {
      console.error('syncUserDeviceFromClientJson', e);
    });
}

/** 记录：user registration attempt */
async function recordUserRegistrationAttempt(username, ok, req, reason) {
  var uname = username != null && String(username).trim() !== '' ? String(username).trim() : '(register)';
  await recordUserLoginAttempt(uname, ok, req, reason);
  if (ok && username) {
    await syncUserDeviceFromClientJson(req, String(username).trim());
  }
}

/** 记录：user login attempt */
async function recordUserLoginAttempt(username, ok, req, reason) {
  if (!pool || !username) {
    return;
  }
  var uname = String(username).trim().substring(0, 255);
  if (!uname) {
    return;
  }
  var ip = getClientIp(req);
  var city = cityLabelFromIp(ip);
  var ua = normalizeUserAgentHeader(req);
  var fp = computeDeviceFingerprint(req);
  var ex = req.clientDevicePayload;
  var detailJson = ex ? JSON.stringify(ex) : null;
  var clientId = ex && ex.client_id ? String(ex.client_id).substring(0, 128) : null;
  var uaDisp = displayUserAgentFromDevice(req);
  var reasonKey = sanitizeAuditText(
    ok ? normalizeUserLoginSuccessReason(reason) : normalizeUserLoginFailReason(reason),
    120
  );
  var reasonDetail = ok ? null : sanitizeAuditText(reason != null ? String(reason) : '', 255) || null;
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      `INSERT INTO user_login_events (username, ok, reason, reason_detail, ip, city, user_agent, device_fp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uname,
        ok ? 1 : 0,
        reasonKey || null,
        reasonDetail,
        ip.substring(0, 128),
        city.substring(0, 255),
        ua.substring(0, 512),
        fp
      ]
    );
    if (ok) {
      await conn.execute(
        `INSERT INTO user_devices (username, device_fp, user_agent_short, ip_last, city_last, login_count, client_id, device_detail_json, api_sync_count)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, 0)
         ON DUPLICATE KEY UPDATE
           user_agent_short = VALUES(user_agent_short),
           ip_last = VALUES(ip_last),
           city_last = VALUES(city_last),
           login_count = login_count + 1,
           client_id = COALESCE(VALUES(client_id), client_id),
           device_detail_json = COALESCE(VALUES(device_detail_json), device_detail_json),
           last_seen = CURRENT_TIMESTAMP`,
        [uname, fp, uaDisp, ip.substring(0, 128), city.substring(0, 255), clientId, detailJson]
      );
    }
  } catch (e) {
    console.error('recordUserLoginAttempt', e);
  } finally {
    conn.release();
  }
}

/** 规范化登录/注册成功原因（注册成功须保留 register_ok 供同 IP 风控统计） */
function normalizeUserLoginSuccessReason(rawReason) {
  var msg = String(rawReason || '').trim();
  if (msg === 'register_ok') return 'register_ok';
  return 'ok';
}

/** 规范化登录失败原因 */
function normalizeUserLoginFailReason(rawMsg) {
  var msg = String(rawMsg || '').trim();
  if (!msg) return 'unknown_error';
  /* 已是标准 reason key（含注册失败细分）则直接保留，避免落入 other_error */
  if (Object.prototype.hasOwnProperty.call(USER_LOGIN_REASON_LABELS, msg) && msg !== 'ok') {
    return msg;
  }
  if (msg.indexOf('register_fail:') === 0) {
    return msg.substring(0, 120);
  }
  if (msg.indexOf('请输入密码') >= 0) return 'empty_password';
  if (msg.indexOf('账号已被封禁') >= 0 || msg.indexOf('封禁') >= 0) return 'account_banned';
  if (msg.indexOf('密码错误') >= 0) return 'wrong_password';
  if (msg.indexOf('账号不存在') >= 0) return 'account_not_found';
  if (msg.indexOf('账号或密码错误') >= 0) return 'invalid_credentials';
  if (msg.indexOf('已注册') >= 0 || msg.indexOf('账号已存在') >= 0) return 'register_fail:duplicate';
  if (msg.indexOf('请求过于频繁') >= 0 || msg.indexOf('rate_limited') >= 0) return 'rate_limited';
  if (msg.indexOf('禁止在新设备登录') >= 0) return 'new_device_blocked';
  if (
    msg.indexOf('账号仅支持') >= 0 ||
    msg.indexOf('账号长度') >= 0 ||
    msg.indexOf('请输入账号') >= 0 ||
    msg.indexOf('账号不能为空') >= 0
  ) {
    return 'invalid_username';
  }
  return 'other_error';
}

/** 用户辅助：login reason label */
function userLoginReasonLabel(reason) {
  var k = String(reason || '').trim();
  return USER_LOGIN_REASON_LABELS[k] || k || '未知错误';
}

/** 用户辅助：login reason display label */
function userLoginReasonDisplayLabel(reasonKey, reasonDetail) {
  var label = userLoginReasonLabel(reasonKey);
  var detail = reasonDetail != null ? String(reasonDetail).trim() : '';
  if (!detail || String(reasonKey || '').trim() === 'ok') {
    return label;
  }
  if (detail === label) {
    return label;
  }
  if (String(reasonKey || '').trim() === 'other_error' || String(reasonKey || '').trim() === 'unknown_error') {
    return label + '（' + detail + '）';
  }
  return label;
}

/** 用户辅助：login reason keys for fuzzy query */
function userLoginReasonKeysForFuzzyQuery(q) {
  q = q != null ? String(q).trim() : '';
  if (!q) return [];
  var ql = q.toLowerCase();
  var keys = [];
  Object.keys(USER_LOGIN_REASON_LABELS).forEach(function (k) {
    if (k.toLowerCase().indexOf(ql) >= 0 || String(USER_LOGIN_REASON_LABELS[k]).indexOf(q) >= 0) {
      keys.push(k);
    }
  });
  return keys;
}

/** append user login reason fuzzy filter */
function appendUserLoginReasonFuzzyFilter(whereClauses, params, qReason) {
  qReason = qReason != null ? String(qReason).trim() : '';
  if (!qReason) return;
  var parts = ['reason LIKE ?'];
  params.push('%' + qReason + '%');
  var matchedKeys = userLoginReasonKeysForFuzzyQuery(qReason);
  if (matchedKeys.length) {
    parts.push(
      'reason IN (' +
        matchedKeys
          .map(function () {
            return '?';
          })
          .join(',') +
        ')'
    );
    matchedKeys.forEach(function (k) {
      params.push(k);
    });
  }
  whereClauses.push('(' + parts.join(' OR ') + ')');
}

/** append user login reason filter */
function appendUserLoginReasonFilter(whereClauses, params, qReason) {
  qReason = qReason != null ? String(qReason).trim() : '';
  if (!qReason) return;
  if (Object.prototype.hasOwnProperty.call(USER_LOGIN_REASON_LABELS, qReason)) {
    whereClauses.push('reason = ?');
    params.push(qReason);
    return;
  }
  appendUserLoginReasonFuzzyFilter(whereClauses, params, qReason);
}

const USER_LOGIN_REASON_LABELS = {
  ok: '成功',
  empty_password: '密码为空',
  account_banned: '账号已封禁',
  invalid_credentials: '账号或密码错误',
  account_not_found: '账号不存在',
  wrong_password: '密码错误',
  invalid_username: '账号格式错误',
  ip_denied: 'IP 已封禁',
  rate_limited: '登录过于频繁',
  new_device_blocked: '新设备登录受限',
  other_error: '其他错误',
  unknown_error: '未知错误',
  register_ok: '注册成功',
  'register_fail:duplicate': '注册-账号已存在',
  'register_fail:rate_burst': '注册-频率过快',
  'register_fail:rate_ip_day': '注册-IP日上限',
  'register_fail:rate_fp_day': '注册-设备日上限',
  'register_fail:backoff': '注册-失败退避',
  'register_fail:captcha': '注册-验证码错误',
  'register_fail:invalid_client': '注册-非官方客户端',
  'register_fail:validation': '注册-参数校验失败'
};

/** collapse track jump event key */
function collapseTrackJumpEventKey(eventKey) {
  var k = String(eventKey || '')
    .trim()
    .toLowerCase();
  if (!k || k.indexOf('track_jump_') !== 0) {
    return k;
  }
  if (k.indexOf('history_back') >= 0) {
    return 'track_jump__history_back__';
  }
  var m = k.match(/^track_jump_([a-z0-9]+)_html(.*)$/);
  if (!m) {
    return k;
  }
  var base = 'track_jump_' + m[1] + '_html';
  var rest = m[2] || '';
  if (!rest) {
    return base;
  }
  if (rest.indexOf('_tab_') === 0) {
    var tabM = rest.match(/^(_tab_[a-z0-9_]+)/);
    if (tabM) {
      return base + tabM[1];
    }
  }
  if (
    /_id_tr_/i.test(rest) ||
    /^_id_/i.test(rest) ||
    /_year_\d{4}/i.test(rest) ||
    /_tr_[a-z0-9_]{6,}/i.test(rest) ||
    /\d{8,}/.test(rest)
  ) {
    return base;
  }
  return k;
}

/** 从路由推导埋点 key */
function normalizeTrackEventKeyFromRoute(routeKey) {
  var rk = String(routeKey || '').trim();
  if (!rk) return '';
  var eventKey = '';
  if (rk.indexOf('EVENT ') === 0) {
    eventKey = rk.substring(6).trim();
  } else {
    var i = rk.indexOf('#track_');
    if (i >= 0) {
      eventKey = rk.substring(i + 1).trim();
    }
  }
  if (!eventKey) return '';
  return collapseTrackJumpEventKey(eventKey);
}

/** sanitize audit text */
function sanitizeAuditText(val, maxLen) {
  var s = String(val == null ? '' : val)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .trim();
  if (!s) return '';
  var lim = isFinite(maxLen) && maxLen > 0 ? (maxLen | 0) : 255;
  if (s.length > lim) s = s.substring(0, lim);
  return s;
}

/** sanitize audit object top level */
function sanitizeAuditObjectTopLevel(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  var out = {};
  var keys = Object.keys(raw).slice(0, 40);
  keys.forEach(function (k) {
    var key = sanitizeAuditText(k, 80);
    if (!key) return;
    var v = raw[k];
    if (v == null) return;
    if (/pass|pwd|token|authorization|secret/i.test(key)) {
      out[key] = '***';
      return;
    }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[key] = sanitizeAuditText(v, 160);
      return;
    }
    if (Array.isArray(v)) {
      out[key] = '[array:' + v.length + ']';
      return;
    }
    if (typeof v === 'object') {
      out[key] = '[object]';
    }
  });
  return Object.keys(out).length ? out : null;
}

/** 管理辅助：device desc */
function adminDeviceDesc(req) {
  var ex = req && req.clientDevicePayload;
  if (ex && typeof ex === 'object') {
    var bits = [];
    if (ex.source) bits.push(String(ex.source));
    if (ex.platform) bits.push(String(ex.platform));
    if (ex.model) bits.push(String(ex.model));
    if (ex.os_version) bits.push('OS ' + String(ex.os_version));
    if (ex.app_version) bits.push('App ' + String(ex.app_version));
    var merged = sanitizeAuditText(bits.join(' · '), 255);
    if (merged) return merged;
  }
  return sanitizeAuditText(displayUserAgentFromDevice(req), 255);
}

/** 构建：admin request brief */
function buildAdminRequestBrief(req) {
  if (!req) return '';
  var parts = [];
  var qObj = sanitizeAuditObjectTopLevel(req.query);
  var bObj = sanitizeAuditObjectTopLevel(req.body);
  if (qObj) {
    parts.push('query=' + JSON.stringify(qObj));
  }
  if (bObj) {
    parts.push('body=' + JSON.stringify(bObj));
  }
  return sanitizeAuditText(parts.join(' | '), 1024);
}

/** 记录：admin login attempt */
async function recordAdminLoginAttempt(adminUsername, ok, reason, req) {
  if (!pool) return;
  var uname = sanitizeAuditText(adminUsername, 255);
  if (!uname) uname = 'unknown';
  var ip = sanitizeAuditText(getClientIp(req), 128);
  var city = sanitizeAuditText(cityLabelFromIp(ip), 255);
  var ua = sanitizeAuditText(normalizeUserAgentHeader(req), 512);
  var fp = sanitizeAuditText(computeDeviceFingerprint(req), 64);
  var deviceDesc = adminDeviceDesc(req);
  var why = sanitizeAuditText(reason, 255);
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      `INSERT INTO admin_login_events
       (admin_username, ok, reason, ip, city, user_agent, device_fp, device_desc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uname, ok ? 1 : 0, why || null, ip || null, city || null, ua || null, fp || null, deviceDesc || null]
    );
  } catch (e) {
    console.error('recordAdminLoginAttempt', e);
  } finally {
    conn.release();
  }
}

/** 记录：admin operation log */
async function recordAdminOperationLog(req, res) {
  if (!pool || !req || !req.admin || !res) return;
  var p = sanitizeAuditText(req.path || '', 255);
  if (!p || p === '/api/admin/login' || p === '/api/admin/admin-login-logs' || p === '/api/admin/admin-operation-logs') {
    return;
  }
  var method = sanitizeAuditText(String(req.method || '').toUpperCase(), 16) || 'GET';
  var adminUsername = sanitizeAuditText(req.admin.username, 255);
  var adminFullName = sanitizeAuditText(req.admin.full_name || '', 255);
  if (!adminUsername) return;
  var action = '';
  if (req.body && req.body.action != null && String(req.body.action).trim() !== '') {
    action = sanitizeAuditText(req.body.action, 120);
  } else if (req.query && req.query.action != null && String(req.query.action).trim() !== '') {
    action = sanitizeAuditText(req.query.action, 120);
  }
  var targetUsername = '';
  var src = req.body && typeof req.body === 'object' ? req.body : req.query;
  if (src && src.username != null && String(src.username).trim() !== '') {
    targetUsername = sanitizeAuditText(src.username, 255);
  } else if (src && src.user_id != null && String(src.user_id).trim() !== '') {
    targetUsername = sanitizeAuditText(src.user_id, 255);
  }
  var info = classifyAnalyticsRoute(req);
  var routeKey = info && info.route_key ? sanitizeAuditText(info.route_key, 240) : '';
  var ip = sanitizeAuditText(getClientIp(req), 128);
  var city = sanitizeAuditText(cityLabelFromIp(ip), 255);
  var ua = sanitizeAuditText(normalizeUserAgentHeader(req), 512);
  var fp = sanitizeAuditText(computeDeviceFingerprint(req), 64);
  var deviceDesc = adminDeviceDesc(req);
  var statusCode = Number(res.statusCode || 0);
  var bizCode = null;
  if (res.__adminBizCode != null && isFinite(Number(res.__adminBizCode))) {
    bizCode = Number(res.__adminBizCode);
  }
  var ok = statusCode < 400 && (bizCode == null || bizCode === 200);
  var reqBrief = buildAdminRequestBrief(req);
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      `INSERT INTO admin_operation_logs
       (admin_username, admin_full_name, method, path, route_key, action, target_username, request_brief,
        ip, city, user_agent, device_fp, device_desc, status_code, biz_result_code, ok)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        adminUsername,
        adminFullName || null,
        method,
        p,
        routeKey || null,
        action || null,
        targetUsername || null,
        reqBrief || null,
        ip || null,
        city || null,
        ua || null,
        fp || null,
        deviceDesc || null,
        statusCode,
        bizCode,
        ok ? 1 : 0
      ]
    );
  } catch (e) {
    console.error('recordAdminOperationLog', e);
  } finally {
    conn.release();
  }
}

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(function attachClientDevicePayload(req, res, next) {
  req.clientDevicePayload = readClientDeviceFromRequest(req);
  next();
});
app.use(analyticsFinishMiddleware);

/** 税务核验/开具查询 */
async function handleTaxVerifyIssueGet(req, res) {
  var code = String(req.query.code != null ? req.query.code : '')
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase();
  var recordNo = String(req.query.record != null ? req.query.record : '')
    .trim()
    .substring(0, 32);
  if (!/^[A-Z0-9]{16}$/.test(code)) {
    return res.json({ code: 400, msg: '无效的查询验证码', data: { found: false } });
  }
  const conn = await pool.getConnection();
  try {
    var sql =
      "SELECT apply_time, period_start, period_end, record_no, scope, status, query_code FROM tax_issue_applications WHERE UPPER(REPLACE(TRIM(IFNULL(query_code,'')), ' ', '')) = ?";
    var params = [code];
    if (recordNo) {
      sql += ' AND record_no = ?';
      params.push(recordNo);
    }
    sql += ' ORDER BY updated_at DESC LIMIT 1';
    const [rows] = await conn.execute(sql, params);
    if (!rows.length) {
      return res.json({ code: 200, msg: '未查询到与该验证码匹配的开具记录', data: { found: false } });
    }
    var r = rows[0];
    return res.json({
      code: 200,
      msg: '成功',
      data: {
        found: true,
        record_no: r.record_no != null ? String(r.record_no) : '',
        period_start: r.period_start != null ? String(r.period_start) : '',
        period_end: r.period_end != null ? String(r.period_end) : '',
        apply_time: r.apply_time != null ? String(r.apply_time) : '',
        scope: r.scope != null ? String(r.scope) : '',
        status: r.status != null ? String(r.status) : ''
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  } finally {
    conn.release();
  }
}

/** 税务域 GET */
async function handleTaxGet(req, res) {
  var action = req.query.action;
  if (action === 'tax_edit_policy') {
    var uidPol = req.authUserId;
    if (uidPol == null || uidPol === '') {
      return res.status(400).json({ code: 400, msg: 'user_id required' });
    }
    try {
      var taxPol = await getTaxEditFeePolicy(uidPol);
      return res.json({ code: 200, data: taxPol });
    } catch (ePol) {
      console.error(ePol);
      return res.status(500).json({ code: 500, msg: String(ePol.message) });
    }
  }
  if (action === 'detail') {
    var userId = req.authUserId;
    var rid = req.query.id;
    if (userId == null || userId === '' || rid == null || rid === '') {
      return res.status(400).json({ code: 400, msg: 'user_id and id required' });
    }
    try {
      var rec = await getTaxRecordById(userId, rid);
      if (!rec) {
        return res.status(404).json({ code: 404, msg: '记录不存在' });
      }
      return res.json({
        code: 200,
        msg: '成功',
        data: formatTaxDetailResponse(rec, String(userId))
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ code: 500, msg: String(e.message) });
    }
  }
  if (action === 'calculation') {
    var uidCalc = req.authUserId;
    var ridCalc = req.query.id;
    if (uidCalc == null || uidCalc === '' || ridCalc == null || ridCalc === '') {
      return res.status(400).json({ code: 400, msg: 'id required' });
    }
    try {
      var calc = await getTaxCalculationData(uidCalc, ridCalc);
      if (!calc) {
        return res.status(404).json({ code: 404, msg: '记录不存在' });
      }
      return res.json({ code: 200, msg: '成功', data: calc });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ code: 500, msg: String(e.message) });
    }
  }
  if (action === 'deleted_records') {
    var uidBin = req.authUserId;
    if (uidBin == null || uidBin === '') {
      return res.status(400).json({ code: 400, msg: 'user_id required' });
    }
    try {
      var deletedRows = await getDeletedTaxRecords(uidBin);
      return res.json({
        code: 200,
        data: {
          count: deletedRows.length,
          records: deletedRows
        }
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ code: 500, msg: String(e.message) });
    }
  }
  if (action === 'list_issue_applications') {
    var uidIssues = req.authUserId;
    if (uidIssues == null || uidIssues === '') {
      return res.status(400).json({ code: 400, msg: 'user_id required' });
    }
    try {
      const connList = await pool.getConnection();
      try {
        const [issueRows] = await connList.execute(
          `SELECT id, apply_time, period_start, period_end, record_no, scope, status, query_code,
                  qr_image_url, qr_block_image_url, created_at
           FROM tax_issue_applications
           WHERE user_id = ?
           ORDER BY created_at DESC, apply_time DESC
           LIMIT 30`,
          [String(uidIssues)]
        );
        var issueOut = (issueRows || []).map(function (r) {
          return {
            id: r.id != null ? String(r.id) : '',
            apply_time: r.apply_time != null ? String(r.apply_time) : '',
            period_start: r.period_start != null ? String(r.period_start) : '',
            period_end: r.period_end != null ? String(r.period_end) : '',
            record_no: r.record_no != null ? String(r.record_no) : '',
            scope: r.scope != null ? String(r.scope) : '全国',
            status: r.status != null ? String(r.status) : '制作成功',
            query_code: r.query_code != null ? String(r.query_code) : '',
            qr_image_url: r.qr_image_url != null ? String(r.qr_image_url) : '',
            qr_block_image_url: r.qr_block_image_url != null ? String(r.qr_block_image_url) : ''
          };
        });
        var qrOverride = null;
        var najiluQrUnlocked = false;
        try {
          var najiluQrList = require('../admin/najiluQr');
          if (najiluQrList && typeof najiluQrList.resolveUserQrOverride === 'function') {
            qrOverride = await najiluQrList.resolveUserQrOverride(connList, String(uidIssues));
          }
          if (najiluQrList && typeof najiluQrList.userHasNajiluQrUnlocked === 'function') {
            najiluQrUnlocked = await najiluQrList.userHasNajiluQrUnlocked(String(uidIssues));
          }
        } catch (eOvList) {
          qrOverride = null;
        }
        return res.json({
          code: 200,
          data: {
            applications: issueOut,
            qr_override: qrOverride,
            najilu_qr_unlocked: najiluQrUnlocked,
            watermark: !najiluQrUnlocked
          }
        });
      } finally {
        connList.release();
      }
    } catch (eList) {
      console.error(eList);
      return res.status(500).json({ code: 500, msg: String(eList.message) });
    }
  }
  if (action !== 'records') {
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  }
  var userId = req.authUserId;
  if (userId == null || userId === '') {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  var year = req.query.year;
  var typesParam = req.query.types;
  var incomeTypes = null;
  if (typesParam != null && String(typesParam).trim() !== '') {
    incomeTypes = String(typesParam)
      .split(',')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }
  try {
    var data = await getRecords(userId, year, incomeTypes);
    res.json({ code: 200, data: data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 站内信 GET */
async function handleMessageGet(req, res) {
  var action = req.query.action;
  var userId = req.authUserId;
  if (userId == null || userId === '') {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  if (action === 'detail') {
    var detailId = req.query.id;
    if (detailId == null || detailId === '') {
      return res.status(400).json({ code: 400, msg: 'id required' });
    }
    try {
      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.execute(
          'SELECT id, user_id, title, content, company_name, msg_date, is_read, created_at FROM messages WHERE id = ? AND user_id = ? LIMIT 1',
          [String(detailId), String(userId)]
        );
        if (!rows.length) {
          return res.status(404).json({ code: 404, msg: '消息不存在' });
        }
        await conn.execute('UPDATE messages SET is_read = 1 WHERE id = ? AND user_id = ?', [
          String(detailId),
          String(userId)
        ]);
        invalidateMessageListCache(String(userId));
        var r = rows[0];
        return res.json({
          code: 200,
          data: {
            id: r.id,
            title: r.title,
            content: r.content,
            company_name: r.company_name,
            msg_date: r.msg_date,
            is_read: 1,
            created_at: r.created_at ? r.created_at.toISOString() : null
          }
        });
      } finally {
        conn.release();
      }
    } catch (e) {
      console.error(e);
      return res.status(500).json({ code: 500, msg: String(e.message) });
    }
  }
  if (action === 'unread_count') {
    try {
      const conn = await pool.getConnection();
      const [rows] = await conn.execute(
        'SELECT COUNT(*) AS c FROM messages WHERE user_id = ? AND is_read = 0',
        [String(userId)]
      );
      conn.release();
      return res.json({
        code: 200,
        data: { unread: Number(rows[0] && rows[0].c) || 0 }
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ code: 500, msg: String(e.message) });
    }
  }
  if (action !== 'list') {
    return res.status(400).json({ code: 400, msg: 'action=list, detail or unread_count required' });
  }
  try {
    var uidMsg = String(userId);
    var nowMsg = Date.now();
    var hitMsg = _messageListCache.get(uidMsg);
    if (hitMsg && nowMsg - hitMsg.t < MESSAGE_LIST_CACHE_MS) {
      return res.json({ code: 200, data: hitMsg.v });
    }
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      'SELECT id, title, company_name, msg_date, is_read, content FROM messages WHERE user_id = ? ORDER BY msg_date DESC, created_at DESC LIMIT 200',
      [uidMsg]
    );
    conn.release();
    var out = rows.map(function (r) {
      var contentRaw = r.content != null ? String(r.content) : '';
      var contentPreview = contentRaw.replace(/\n@@link:\S+\s*$/, '').trim();
      if (contentPreview.length > 120) {
        contentPreview = contentPreview.substring(0, 120);
      }
      return {
        id: r.id,
        title: r.title,
        company_name: r.company_name,
        msg_date: r.msg_date,
        is_read: r.is_read != null ? Number(r.is_read) : 0,
        content: contentPreview
      };
    });
    _messageListCache.set(uidMsg, { t: nowMsg, v: out });
    if (_messageListCache.size > 800) {
      _messageListCache.clear();
    }
    res.json({ code: 200, data: out });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 站内信 POST */
async function handleMessagePost(req, res) {
  var body = req.body || {};
  var action = body.action;
  var userId = req.authUserId;
  if (userId == null || userId === '') {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  const conn = await pool.getConnection();
  try {
    if (action === 'add_message') {
      var mid = 'msg_' + Date.now();
      var title = body.title != null ? String(body.title) : '';
      var content = body.content != null ? String(body.content) : '';
      var companyName = body.company_name != null ? String(body.company_name) : '';
      var msgDate = body.msg_date != null ? String(body.msg_date) : '';
      var isRead = body.is_read != null ? (Number(body.is_read) ? 1 : 0) : 1;
      await conn.execute(
        `INSERT INTO messages (id, user_id, title, content, company_name, msg_date, is_read) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [mid, String(userId), title, content, companyName, msgDate, isRead]
      );
      invalidateMessageListCache(userId);
      return res.json({ code: 200, data: { id: mid } });
    }
    if (action === 'delete_message') {
      var delId = body.id;
      if (delId == null || delId === '') {
        return res.status(400).json({ code: 400, msg: 'id required' });
      }
      await conn.execute('DELETE FROM messages WHERE id = ? AND user_id = ?', [String(delId), String(userId)]);
      invalidateMessageListCache(userId);
      return res.json({ code: 200, data: { success: true } });
    }
    if (action === 'mark_all_read') {
      await conn.execute('UPDATE messages SET is_read = 1 WHERE user_id = ?', [String(userId)]);
      invalidateMessageListCache(userId);
      return res.json({ code: 200, data: { success: true } });
    }
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  } finally {
    conn.release();
  }
}

var SHENBAO_DEFAULT_RECORDS = [
  {
    id: '1',
    groupMonth: '2026-03',
    title: '2025年度综合所得年度汇算',
    periodStart: '2025-01',
    periodEnd: '2025-12',
    amountType: 'refunded',
    amount: '0.00'
  },
  {
    id: '2',
    groupMonth: '2025-03',
    title: '2024年度综合所得年度汇算',
    periodStart: '2024-01',
    periodEnd: '2024-12',
    amountType: 'refunded',
    amount: '0.00'
  },
  {
    id: '3',
    groupMonth: '2024-03',
    title: '2023年度综合所得年度汇算',
    periodStart: '2023-01',
    periodEnd: '2023-12',
    amountType: 'refunded',
    amount: '0.00'
  },
  {
    id: '4',
    groupMonth: '2023-05',
    title: '2022年度综合所得年度汇算',
    periodStart: '2022-01',
    periodEnd: '2022-12',
    amountType: 'refunded',
    amount: '0.00'
  },
  {
    id: '5',
    groupMonth: '2022-06',
    title: '2021年度综合所得年度汇算',
    periodStart: '2021-01',
    periodEnd: '2021-12',
    amountType: 'paid',
    amount: '0.00'
  }
];

var SHENBAO_DETAIL_FIELD_DEFAULTS = {
  supplementTax: '1632.86',
  lateFee: '0.00',
  paidThisTime: '1632.86',
  refundedThisTime: '0.00',
  taxAuthority: '国家税务总局昆明市税务局第一税务分局（重点税源企业税收服务和管理局）',
  employer: '云南白药集团股份有限公司',
  totalIncome: '194168.17',
  totalExpense: '0.00',
  exemptIncome: '0.00',
  basicDeduction: '60000.00',
  specialDeduction: '21686.88',
  specialAdditionalDeduction: '37000.00',
  otherDeduction: '665.56',
  donationDeduction: '0.00',
  taxableIncome: '74815.73',
  taxPayable: '4961.57',
  taxReduction: '0.00',
  taxPaid: '3328.71'
};

var SHENBAO_LIST_KEYS = {
  id: 1,
  groupMonth: 1,
  title: 1,
  periodStart: 1,
  periodEnd: 1,
  amountType: 1,
  amount: 1,
  detailCustomized: 1
};

/** shenbao tax year from record */
function shenbaoTaxYearFromRecord(r) {
  if (r.taxYear) {
    return String(r.taxYear);
  }
  if (r.periodEnd && /^\d{4}/.test(String(r.periodEnd))) {
    return String(r.periodEnd).slice(0, 4);
  }
  if (r.groupMonth && /^\d{4}/.test(String(r.groupMonth))) {
    return String(r.groupMonth).slice(0, 4);
  }
  return '';
}

/** shenbao sync list amount from supplement */
function shenbaoSyncListAmountFromSupplement(rec) {
  if (!rec) {
    return rec;
  }
  rec.amountType = 'refunded';
  if (rec.detailCustomized) {
    var sup = String(rec.supplementTax != null ? rec.supplementTax : '')
      .replace(/元/g, '')
      .trim();
    if (sup) {
      rec.amount = sup;
    }
  }
  return rec;
}

/** shenbao record from row */
function shenbaoRecordFromRow(row) {
  var detail = {};
  if (row.detail_json) {
    try {
      detail = JSON.parse(row.detail_json);
    } catch (e) {
      detail = {};
    }
  }
  var rec = Object.assign(
    {
      id: row.id,
      groupMonth: row.group_month || '',
      title: row.title || '',
      periodStart: row.period_start || '',
      periodEnd: row.period_end || '',
      amountType: row.amount_type || 'refunded',
      amount: row.amount != null ? String(row.amount) : '0.00',
      detailCustomized: !!row.detail_customized
    },
    detail
  );
  return shenbaoSyncListAmountFromSupplement(rec);
}

/** shenbao list record from row */
function shenbaoListRecordFromRow(row) {
  return {
    id: row.id,
    groupMonth: row.group_month || '',
    title: row.title || '',
    periodStart: row.period_start || '',
    periodEnd: row.period_end || '',
    amountType: row.amount_type || 'refunded',
    amount: row.amount != null ? String(row.amount) : '0.00',
    detailCustomized: !!row.detail_customized
  };
}

/** shenbao merge detail record */
function shenbaoMergeDetailRecord(r) {
  var out = Object.assign({}, SHENBAO_DETAIL_FIELD_DEFAULTS, r);
  out.taxYear = shenbaoTaxYearFromRecord(r);
  return out;
}

/** shenbao design detail template */
function shenbaoDesignDetailTemplate(r) {
  var out = Object.assign({}, SHENBAO_DETAIL_FIELD_DEFAULTS, {
    id: r.id,
    groupMonth: r.groupMonth,
    title: r.title,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    amountType: r.amountType,
    amount: r.amount,
    taxAuthority: r.taxAuthority || SHENBAO_DETAIL_FIELD_DEFAULTS.taxAuthority,
    employer: r.employer || SHENBAO_DETAIL_FIELD_DEFAULTS.employer
  });
  out.taxYear = shenbaoTaxYearFromRecord(r);
  return out;
}

/** shenbao record for detail */
function shenbaoRecordForDetail(rec) {
  if (!rec) {
    return null;
  }
  if (rec.detailCustomized) {
    return shenbaoMergeDetailRecord(rec);
  }
  return shenbaoDesignDetailTemplate(rec);
}

/** shenbao build detail json */
function shenbaoBuildDetailJson(record) {
  var detail = {};
  Object.keys(record || {}).forEach(function (k) {
    if (!SHENBAO_LIST_KEYS[k]) {
      detail[k] = record[k];
    }
  });
  return JSON.stringify(detail);
}

/** shenbao normalize incoming record */
function shenbaoNormalizeIncomingRecord(record) {
  var rec = Object.assign({}, record || {});
  rec.id = String(rec.id != null ? rec.id : '').trim();
  if (!rec.id) {
    return null;
  }
  rec.groupMonth = String(rec.groupMonth != null ? rec.groupMonth : '').trim();
  rec.title = String(rec.title != null ? rec.title : '').trim();
  rec.periodStart = String(rec.periodStart != null ? rec.periodStart : '').trim();
  rec.periodEnd = String(rec.periodEnd != null ? rec.periodEnd : '').trim();
  rec.amountType = 'refunded';
  var supplement = String(rec.supplementTax != null ? rec.supplementTax : '')
    .replace(/元/g, '')
    .trim();
  var amt = supplement || String(rec.amount != null ? rec.amount : '0').replace(/元/g, '').trim() || '0.00';
  rec.amount = amt;
  rec.detailCustomized = rec.detailCustomized ? 1 : 0;
  return rec;
}

/** 写入或更新：shenbao record in conn */
async function upsertShenbaoRecordInConn(conn, userId, tab, record) {
  var rec = shenbaoNormalizeIncomingRecord(record);
  if (!rec) {
    throw new Error('record.id required');
  }
  var detailJson = shenbaoBuildDetailJson(rec);
  await conn.execute(
    `INSERT INTO shenbao_jilu_records
      (user_id, tab, id, group_month, title, period_start, period_end, amount_type, amount, detail_json, detail_customized)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      group_month = VALUES(group_month),
      title = VALUES(title),
      period_start = VALUES(period_start),
      period_end = VALUES(period_end),
      amount_type = VALUES(amount_type),
      amount = VALUES(amount),
      detail_json = VALUES(detail_json),
      detail_customized = VALUES(detail_customized)`,
    [
      String(userId),
      tab,
      rec.id,
      rec.groupMonth,
      rec.title,
      rec.periodStart,
      rec.periodEnd,
      rec.amountType,
      rec.amount,
      detailJson,
      rec.detailCustomized ? 1 : 0
    ]
  );
  return rec;
}

/** seed shenbao defaults if empty */
async function seedShenbaoDefaultsIfEmpty(conn, userId, tab) {
  if (tab !== 'done') {
    return;
  }
  const [cntRows] = await conn.execute(
    'SELECT COUNT(*) AS c FROM shenbao_jilu_records WHERE user_id = ? AND tab = ?',
    [String(userId), tab]
  );
  var c = cntRows.length && cntRows[0].c != null ? Number(cntRows[0].c) : 0;
  if (c > 0) {
    return;
  }
  for (var i = 0; i < SHENBAO_DEFAULT_RECORDS.length; i++) {
    await upsertShenbaoRecordInConn(conn, userId, tab, SHENBAO_DEFAULT_RECORDS[i]);
  }
}

/** list shenbao records */
async function listShenbaoRecords(userId, tab) {
  const conn = await pool.getConnection();
  try {
    await seedShenbaoDefaultsIfEmpty(conn, userId, tab);
    const [rows] = await conn.execute(
      `SELECT id, group_month, title, period_start, period_end, amount_type, amount, detail_customized
       FROM shenbao_jilu_records WHERE user_id = ? AND tab = ?
       ORDER BY group_month DESC, id DESC`,
      [String(userId), tab]
    );
    return rows.map(shenbaoListRecordFromRow);
  } finally {
    conn.release();
  }
}

/** 读取申报记录 */
async function getShenbaoRecord(userId, tab, id) {
  const conn = await pool.getConnection();
  try {
    await seedShenbaoDefaultsIfEmpty(conn, userId, tab);
    const [rows] = await conn.execute(
      'SELECT * FROM shenbao_jilu_records WHERE user_id = ? AND tab = ? AND id = ? LIMIT 1',
      [String(userId), tab, String(id)]
    );
    if (!rows.length) {
      return null;
    }
    return shenbaoRecordFromRow(rows[0]);
  } finally {
    conn.release();
  }
}

/** 保存：shenbao record */
async function saveShenbaoRecord(userId, tab, record) {
  var rec = shenbaoNormalizeIncomingRecord(record);
  if (!rec) {
    throw new Error('record.id required');
  }
  rec.detailCustomized = 1;
  const conn = await pool.getConnection();
  try {
    await upsertShenbaoRecordInConn(conn, userId, tab, rec);
    const [rows] = await conn.execute(
      'SELECT * FROM shenbao_jilu_records WHERE user_id = ? AND tab = ? AND id = ? LIMIT 1',
      [String(userId), tab, rec.id]
    );
    if (!rows.length) {
      return shenbaoMergeDetailRecord(rec);
    }
    return shenbaoRecordForDetail(shenbaoRecordFromRow(rows[0]));
  } finally {
    conn.release();
  }
}

/** batch save shenbao records */
async function batchSaveShenbaoRecords(userId, tab, records) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (var i = 0; i < records.length; i++) {
      await upsertShenbaoRecordInConn(conn, userId, tab, records[i]);
    }
    await conn.commit();
    return { count: records.length };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** 删除：shenbao record */
async function deleteShenbaoRecord(userId, tab, id) {
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      'DELETE FROM shenbao_jilu_records WHERE user_id = ? AND tab = ? AND id = ?',
      [String(userId), tab, String(id)]
    );
  } finally {
    conn.release();
  }
}

/** 申报记录 GET */
async function handleShenbaoJiluGet(req, res) {
  var action = req.query.action;
  var userId = req.authUserId;
  if (!userId) {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  var tab = String(req.query.tab || 'done').trim();
  if (tab !== 'done' && tab !== 'void') {
    return res.status(400).json({ code: 400, msg: 'invalid tab' });
  }
  try {
    if (action === 'list') {
      var list = await listShenbaoRecords(userId, tab);
      return res.json({ code: 200, data: { records: list } });
    }
    if (action === 'get') {
      var id = String(req.query.id || '').trim();
      if (!id) {
        return res.status(400).json({ code: 400, msg: 'id required' });
      }
      var row = await getShenbaoRecord(userId, tab, id);
      if (!row) {
        return res.status(404).json({ code: 404, msg: 'record not found' });
      }
      return res.json({ code: 200, data: { record: shenbaoRecordForDetail(row) } });
    }
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 申报记录 POST */
async function handleShenbaoJiluPost(req, res) {
  var body = req.body || {};
  var action = body.action;
  var userId = req.authUserId;
  if (!userId) {
    return res.status(400).json({ code: 400, msg: 'user_id required' });
  }
  var tab = String(body.tab || 'done').trim();
  if (tab !== 'done' && tab !== 'void') {
    return res.status(400).json({ code: 400, msg: 'invalid tab' });
  }
  try {
    if (action === 'save_record') {
      var record = body.record;
      if (!record || typeof record !== 'object') {
        return res.status(400).json({ code: 400, msg: 'record required' });
      }
      var saved = await saveShenbaoRecord(userId, tab, record);
      return res.json({ code: 200, data: { record: saved } });
    }
    if (action === 'batch_save') {
      var records = body.records;
      if (!Array.isArray(records) || !records.length) {
        return res.status(400).json({ code: 400, msg: 'records 须为非空数组' });
      }
      if (records.length > 100) {
        return res.status(400).json({ code: 400, msg: '单次最多写入 100 条' });
      }
      var batchOut = await batchSaveShenbaoRecords(userId, tab, records);
      return res.json({ code: 200, data: batchOut });
    }
    if (action === 'delete_record') {
      var delId = body.id;
      if (delId == null || String(delId).trim() === '') {
        return res.status(400).json({ code: 400, msg: 'id required' });
      }
      await deleteShenbaoRecord(userId, tab, delId);
      return res.json({ code: 200, data: {} });
    }
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 将税务写入异常转为友好中文提示 */
function friendlyTaxWriteError(err) {
  var msg = String((err && err.message) || err || '').trim();
  var code = err && err.code != null ? String(err.code) : '';
  if (code === 'ER_DUP_ENTRY' || /Duplicate entry/i.test(msg)) {
    return '部分税务记录已存在，请勿重复一键生成；可先删除旧记录或修改后再试';
  }
  if (/Bind parameters must not contain undefined/i.test(msg)) {
    return '提交数据不完整，请检查填写项后重试';
  }
  if (/该账号已有批量写入进行中/i.test(msg)) {
    return msg;
  }
  if (/ER_|SQLSTATE|mysql|ECONNREFUSED|ECONNRESET|PROTOCOL_/i.test(msg)) {
    return '保存失败，请稍后重试；若反复出现请联系客服';
  }
  return msg || '保存失败，请稍后重试';
}

/** 税务域 POST */
async function handleTaxPost(req, res) {
  var body = req.body || {};
  var action = body.action;
  var userId = req.authUserId;
  var taxEditPolicy = null;

  try {
    if (taxEditFeePolicy.isTaxEditFeeWriteAction(action) && userId) {
      taxEditPolicy = await getTaxEditFeePolicy(userId);
      if (taxEditPolicy.subject && !taxEditPolicy.can_edit_now) {
        return res.status(402).json({
          code: 402,
          msg: taxEditFeePolicy.taxEditFeeBlockMessage(taxEditPolicy),
          data: Object.assign({ need_tax_edit_fee: true, peer_account: true }, taxEditPolicy)
        });
      }
    }
    if (action === 'save_record' || action === 'add_record') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var record = body.record;
      if (!record || typeof record !== 'object') {
        return res.status(400).json({ code: 400, msg: 'record required' });
      }
      var out = await saveRecord(userId, record);
      /* 单条保存不再同步全量去重（可走明确的 dedupe_records）；批量写入仍会去重 */
      return okTaxWrite(res, userId, taxEditPolicy, Object.assign({}, out, { auto_deduped: 0 }));
    }
    if (action === 'batch_save_records') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var records = body.records;
      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ code: 400, msg: 'records 须为非空数组' });
      }
      if (records.length > TAX_BATCH_MAX_RECORDS) {
        return res.status(400).json({
          code: 400,
          msg: '单次最多写入 ' + TAX_BATCH_MAX_RECORDS + ' 条记录'
        });
      }
      var batchOut = await batchSaveRecords(userId, records);
      return okTaxWrite(res, userId, taxEditPolicy, batchOut);
    }
    if (action === 'batch_replace_records') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var idsToDelete = body.ids_to_delete;
      var replaceRecords = body.records;
      if (!Array.isArray(idsToDelete)) {
        return res.status(400).json({ code: 400, msg: 'ids_to_delete 须为数组' });
      }
      if (!Array.isArray(replaceRecords) || replaceRecords.length === 0) {
        return res.status(400).json({ code: 400, msg: 'records 须为非空数组' });
      }
      if (idsToDelete.length > TAX_BATCH_MAX_RECORDS || replaceRecords.length > TAX_BATCH_MAX_RECORDS) {
        return res.status(400).json({
          code: 400,
          msg: '单次最多处理 ' + TAX_BATCH_MAX_RECORDS + ' 条删除或写入'
        });
      }
      var replaceOut = await batchReplaceTaxRecords(userId, idsToDelete, replaceRecords);
      return okTaxWrite(res, userId, taxEditPolicy, replaceOut);
    }
    if (action === 'delete_record') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var id = body.id;
      if (id == null) {
        return res.status(400).json({ code: 400, msg: 'id required' });
      }
      await deleteRecord(userId, id);
      return okTaxWrite(res, userId, taxEditPolicy, {});
    }
    if (action === 'delete_all_records') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var delAllOut = await deleteAllRecords(userId);
      return okTaxWrite(res, userId, taxEditPolicy, delAllOut);
    }
    if (action === 'restore_record') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var restoreId = body.id;
      if (restoreId == null || String(restoreId).trim() === '') {
        return res.status(400).json({ code: 400, msg: 'id required' });
      }
      var restoreOne = await restoreTaxRecord(userId, String(restoreId).trim());
      if (!restoreOne.restored) {
        return res.status(404).json({ code: 404, msg: '回收站中未找到该记录' });
      }
      return okTaxWrite(res, userId, taxEditPolicy, restoreOne);
    }
    if (action === 'restore_all_deleted_records') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var restoreAllOut = await restoreAllDeletedTaxRecords(userId);
      return okTaxWrite(res, userId, taxEditPolicy, restoreAllOut);
    }
    if (action === 'restore_records_by_company') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var restoreCompany = body.company_name != null ? String(body.company_name).trim() : '';
      if (!restoreCompany) {
        return res.status(400).json({ code: 400, msg: '请填写扣缴单位名称' });
      }
      var restoreCompanyOut = await restoreRecordsByCompany(userId, restoreCompany);
      if (!restoreCompanyOut.restored) {
        return res.status(404).json({ code: 404, msg: '回收站中未找到该单位的记录' });
      }
      return okTaxWrite(res, userId, taxEditPolicy, restoreCompanyOut);
    }
    if (action === 'delete_records_by_year') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var delYear = parseInt(body.year, 10);
      if (!delYear || delYear < 1 || delYear > 9999) {
        return res.status(400).json({ code: 400, msg: '请填写合法年份（1–9999）' });
      }
      var delOut = await deleteRecordsByYear(userId, delYear);
      return okTaxWrite(res, userId, taxEditPolicy, delOut);
    }
    if (action === 'delete_records_by_company') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var delCompany = body.company_name != null ? String(body.company_name).trim() : '';
      if (!delCompany) {
        return res.status(400).json({ code: 400, msg: '请填写扣缴单位名称' });
      }
      var delCompanyOut = await deleteRecordsByCompany(userId, delCompany);
      return okTaxWrite(res, userId, taxEditPolicy, delCompanyOut);
    }
    if (action === 'dedupe_records') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var dedupeOut = await dedupeTaxRecords(userId);
      return okTaxWrite(res, userId, taxEditPolicy, dedupeOut);
    }
    if (action === 'log_issue_application') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var appIn = body.application;
      if (!appIn || typeof appIn !== 'object') {
        return res.status(400).json({ code: 400, msg: 'application required' });
      }
      var issueId = String(appIn.id != null ? appIn.id : '').trim().substring(0, 128);
      if (!issueId) {
        return res.status(400).json({ code: 400, msg: 'application.id required' });
      }
      var ps = String(appIn.period_start != null ? appIn.period_start : '').trim().substring(0, 16);
      var pe = String(appIn.period_end != null ? appIn.period_end : '').trim().substring(0, 16);
      if (!ps || !pe) {
        return res.status(400).json({ code: 400, msg: 'application.period_start / period_end required' });
      }
      var applyTime = String(appIn.apply_time != null ? appIn.apply_time : '').trim().substring(0, 64);
      var recordNo = String(appIn.record_no != null ? appIn.record_no : '').trim().substring(0, 32);
      var scope = String(appIn.scope != null ? appIn.scope : '全国').trim().substring(0, 64) || '全国';
      var status = String(appIn.status != null ? appIn.status : '制作成功').trim().substring(0, 64) || '制作成功';
      var queryCode = String(appIn.query_code != null ? appIn.query_code : '').trim().substring(0, 32);
      var qrImageUrl = '';
      var qrBlockImageUrl = '';
      const connIssue = await pool.getConnection();
      try {
        try {
          var najiluQrMod = require('../admin/najiluQr');
          if (najiluQrMod && typeof najiluQrMod.ensureNajiluQrColumns === 'function') {
            await najiluQrMod.ensureNajiluQrColumns(pool);
          }
          if (najiluQrMod && typeof najiluQrMod.resolveUserQrOverride === 'function') {
            var stickyQr = await najiluQrMod.resolveUserQrOverride(connIssue, String(userId));
            if (stickyQr && (stickyQr.qr_block_image_url || stickyQr.qr_image_url)) {
              if (stickyQr.query_code) {
                queryCode = String(stickyQr.query_code).substring(0, 32);
              }
              qrImageUrl = String(stickyQr.qr_image_url || '').substring(0, 512);
              qrBlockImageUrl = String(stickyQr.qr_block_image_url || '').substring(0, 512);
            }
          }
        } catch (eSticky) {
          console.warn('[tax] sticky najilu qr', eSticky && eSticky.message ? eSticky.message : eSticky);
        }
        const [existRows] = await connIssue.execute('SELECT user_id FROM tax_issue_applications WHERE id = ?', [issueId]);
        if (existRows.length && String(existRows[0].user_id) !== String(userId)) {
          return res.status(403).json({ code: 403, msg: '无权写入该申请' });
        }
        if (existRows.length) {
          await connIssue.execute(
            `UPDATE tax_issue_applications
             SET apply_time = ?, period_start = ?, period_end = ?, record_no = ?, scope = ?, status = ?,
                 query_code = ?, qr_image_url = COALESCE(NULLIF(?, ''), qr_image_url),
                 qr_block_image_url = COALESCE(NULLIF(?, ''), qr_block_image_url)
             WHERE id = ? AND user_id = ?`,
            [
              applyTime,
              ps,
              pe,
              recordNo,
              scope,
              status,
              queryCode,
              qrImageUrl,
              qrBlockImageUrl,
              issueId,
              String(userId)
            ]
          );
        } else {
          await connIssue.execute(
            `INSERT INTO tax_issue_applications
             (id, user_id, apply_time, period_start, period_end, record_no, scope, status, query_code, qr_image_url, qr_block_image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              issueId,
              String(userId),
              applyTime,
              ps,
              pe,
              recordNo,
              scope,
              status,
              queryCode,
              qrImageUrl || null,
              qrBlockImageUrl || null
            ]
          );
        }
        return res.json({
          code: 200,
          data: {
            id: issueId,
            query_code: queryCode,
            qr_image_url: qrImageUrl,
            qr_block_image_url: qrBlockImageUrl,
            qr_locked: !!(qrImageUrl || qrBlockImageUrl)
          }
        });
      } finally {
        connIssue.release();
      }
    }
    if (action === 'delete_issue_application') {
      if (!userId) {
        return res.status(400).json({ code: 400, msg: 'user_id required' });
      }
      var delIssueId = String(body.id != null ? body.id : '').trim().substring(0, 128);
      if (!delIssueId) {
        return res.status(400).json({ code: 400, msg: 'id required' });
      }
      const connIssueDel = await pool.getConnection();
      try {
        const [delIssueRows] = await connIssueDel.execute(
          'DELETE FROM tax_issue_applications WHERE id = ? AND user_id = ?',
          [delIssueId, String(userId)]
        );
        if (!delIssueRows.affectedRows) {
          return res.status(404).json({ code: 404, msg: '申请记录不存在' });
        }
        return res.json({ code: 200, data: { id: delIssueId, success: true } });
      } finally {
        connIssueDel.release();
      }
    }
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    console.error(e);
    if (e && e.statusCode === 429) {
      return res.status(429).json({ code: 429, msg: String(e.message || '请求过于频繁') });
    }
    var friendly = friendlyTaxWriteError(e);
    var status = e && e.code === 'ER_DUP_ENTRY' ? 409 : 500;
    res.status(status).json({ code: status, msg: friendly });
  }
}

/* routes: tax/user/chat/message → domain modules */

async function handleAuthGet(req, res) {
  if (req.query.action === 'register_captcha') {
    return res.json({ code: 200, data: registerGuard.issueRegisterCaptcha() });
  }
  if (req.query.action !== 'status') {
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  }
  var auth = req.headers.authorization || '';
  var m = /^Bearer\s+(\S+)/i.exec(auth);
  var token = m ? m[1] : null;
  if (!token) {
    return res.status(401).json({ code: 401, msg: '请先登录' });
  }
  try {
    var payload = jwt.verify(token, JWT_SECRET);
    var uid = payload.sub;
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      'SELECT account_active, user_type, activation_kind, active_until FROM users WHERE username = ?',
      [uid]
    );
    conn.release();
    var actFields = activationFieldsForApi(rows[0] || {});
    return res.json({
      code: 200,
      data: {
        account_active: actFields.account_active,
        activation_kind: actFields.activation_kind,
        active_until: actFields.active_until,
        active_days_left: actFields.active_days_left,
        username: uid,
        is_guest: !!(rows.length && rowUserTypeIsGuest(rows[0]))
      }
    });
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 激活码开通账号 */
async function handleActivatePost(req, res) {
  try {
    var uid = req.authUserId;
    var rec = await getUserRowByUsername(uid);
    if (!rec) {
      return res.status(400).json({ code: 400, msg: '用户不存在' });
    }
    if (rowUserTypeIsGuest(rec)) {
      return res.status(403).json({
        code: 403,
        msg: '游客体验请先下载 App，再注册正式账号完成激活',
        guest_download_required: true
      });
    }
    var already = isUserEffectivelyActive(rec);
    if (already) {
      var actOk = activationFieldsForApi(rec);
      var outOk = {
        user_id: rec.username,
        real_name: rec.real_name || rec.username,
        username: rec.username,
        account_active: true,
        activation_kind: actOk.activation_kind,
        active_until: actOk.active_until,
        active_days_left: actOk.active_days_left,
        is_test_account: rowUserTypeIsTest(rec),
        token: signAccessToken({
          user_id: rec.username,
          username: rec.username,
          account_active: true,
          session_rev: userSessionRevFromRow(rec)
        })
      };
      return res.json({ code: 200, data: outOk, msg: '账号已激活' });
    }
    await applyActivationCode(uid, req.body && req.body.code);
    var rec2 = await getUserRowByUsername(uid);
    var act2 = activationFieldsForApi(rec2);
    var out = {
      user_id: rec2.username,
      real_name: rec2.real_name || rec2.username,
      username: rec2.username,
      account_active: act2.account_active,
      activation_kind: act2.activation_kind,
      active_until: act2.active_until,
      active_days_left: act2.active_days_left,
      is_test_account: rowUserTypeIsTest(rec2),
      token: signAccessToken({
        user_id: rec2.username,
        username: rec2.username,
        account_active: act2.account_active,
        session_rev: userSessionRevFromRow(rec2)
      })
    };
    return res.json({ code: 200, data: out });
  } catch (e) {
    return res.status(400).json({ code: 400, msg: e.message || String(e) });
  }
}

/** 认证域 POST（登录注册等） */
async function handleAuthPost(req, res) {
  var body = req.body || {};
  var action = body.action;
  try {
    if (/^track_[a-z0-9_]{1,80}$/i.test(String(action || ''))) {
      var trackRate = await checkTrackRate(req);
      if (!trackRate.ok) {
        return sendRateLimited(res, trackRate, '埋点请求过于频繁，请稍后再试');
      }
      if (!isRetainedTrackAction(action)) {
        return res.json({ code: 200, data: { ok: true, ignored: true } });
      }
      maybeRecordClientApiPerfTrack(req, action, body.meta);
      recordInstallGuideTrackEvent(req, action, body.meta);
      recordAdPageTrackEvent(req, action, body.meta);
      return res.json({ code: 200, data: { ok: true } });
    }
    if (action === 'admin_issue_code') {
      var adm = body.admin_key || req.headers['x-admin-key'];
      if (!ADMIN_ACTIVATION_KEY || adm !== ADMIN_ACTIVATION_KEY) {
        return res.status(403).json({ code: 403, msg: '无权限发码（需配置 ADMIN_ACTIVATION_KEY）' });
      }
      var maxUses = 1;
      var plainCode = crypto.randomBytes(16).toString('hex').toUpperCase();
      const conn = await pool.getConnection();
      await conn.execute(
        'INSERT INTO activation_codes (code, max_uses, used_count, expires_at, note) VALUES (?, ?, 0, ?, ?)',
        [plainCode, maxUses, null, null]
      );
      conn.release();
      return res.json({
        code: 200,
        data: { code: plainCode, max_uses: maxUses }
      });
    }
    if (action === 'register') {
      var regIpRate = await consumeRateLimit(
        'register-ip',
        getClientIp(req) || 'unknown',
        parseInt(process.env.REGISTER_RATE_PER_IP_MIN || '6', 10) || 6,
        60 * 1000
      );
      if (!regIpRate.ok) {
        return sendRateLimited(res, regIpRate, '注册过于频繁，请稍后再试');
      }
      var regUser = body.username != null ? String(body.username).trim() : '';
      var regGuardKeys = null;
      if (registerGuard.guardEnabled()) {
        var clientChk = registerGuard.checkRegisterClient(req);
        if (!clientChk.ok) {
          await recordUserRegistrationAttempt(regUser, false, req, clientChk.reason);
          return res.status(403).json({ code: 403, msg: clientChk.msg });
        }
        var distChk = registerGuard.checkRegisterDistributorBlock(req);
        if (!distChk.ok) {
          await recordUserRegistrationAttempt(regUser, false, req, distChk.reason);
          return res.status(403).json({ code: 403, msg: distChk.msg });
        }
        var rateChk = await registerGuard.checkRegisterRateLimits(req, getClientIp, computeDeviceFingerprint);
        if (!rateChk.ok) {
          await recordUserRegistrationAttempt(regUser, false, req, rateChk.reason);
          return res.status(429).json({
            code: 429,
            msg: rateChk.msg,
            retry_after_ms: rateChk.backoff_ms || 0
          });
        }
        regGuardKeys = rateChk.keys;
      }
      var regClientIp = getClientIp(req);
      if (regClientIp) {
        var ipBlocked = await isIpBlocked(regClientIp);
        if (ipBlocked) {
          await recordUserRegistrationAttempt(regUser, false, req, 'ip_blocked');
          return res.status(403).json({ code: 403, msg: '当前 IP 已被封禁，无法注册' });
        }
      }
      incrementApiDailyCounter('EVENT register_submit', '认证注册');
      try {
        var regSourceNorm = normalizeRegisterSourceChannelInput(
          body.register_source_channel != null
            ? body.register_source_channel
            : body.source_channel,
          body.register_source_channel_other != null
            ? body.register_source_channel_other
            : body.source_channel_other
        );
        if (regSourceNorm.err) {
          if (regGuardKeys) {
            await registerGuard.markRegisterAttemptFail(regGuardKeys, 'register_fail:validation');
          }
          await recordUserRegistrationAttempt(regUser, false, req, 'register_fail:validation');
          return res.status(400).json({ code: 400, msg: regSourceNorm.err });
        }
        var regSalesCh = readSalesChannelFromRequest(req, body);
        var fromShareReg = parseFromShareFlag(body);
        var out = await registerUser(
          body.username,
          body.password,
          regSourceNorm.value,
          parseFromInstallGuideFlag(body),
          regSalesCh,
          fromShareReg,
          body.email
        );
        try {
          /* 始终尝试挂载：body.ch / 设备归因 / 游客已绑渠道 */
          await attachUserFromRequestChannel(out.username, req, body);
        } catch (eAttReg) {
          console.error('register attach channel', eAttReg);
        }
        if (regGuardKeys) {
          await registerGuard.markRegisterAttemptSuccess(regGuardKeys);
        }
        await recordUserRegistrationAttempt(out.username, true, req, 'register_ok');
        try {
          var mig = await maybeMigrateGuestSandboxForRequest(
            req,
            out.username,
            body.client_id || body.clientId,
            body.guest_username || body.guestUsername
          );
          if (mig && mig.migrated) {
            out.guest_data_migrated = true;
            out.guest_migrate_summary = mig.summary || {};
            if (mig.profile_fields) {
              out.guest_migrate_summary.profile_fields = mig.profile_fields;
            }
            out.merged_from_guest = mig.guest_username || '';
            recordInstallGuideTrackEvent(req, 'track_guest_data_migrated', {
              page: 'register',
              guest_username: mig.guest_username || '',
              registered_username: out.username,
              summary: mig.summary || {}
            });
          }
        } catch (eGuestMig) {
          console.error('register guest migrate', eGuestMig);
        }
        if (parseFromInstallGuideFlag(body)) {
          var landingVariant = await resolveLandingAbVariantForReq(req, body.landing_variant);
          recordInstallGuideTrackEvent(req, 'track_install_register_success', {
            page: 'register',
            username: out.username,
            reported: true,
            landing_variant: landingVariant || undefined,
            landing_variant_inferred: landingVariant && !String(body.landing_variant || '').trim() ? true : undefined
          });
        }
        if (fromShareReg) {
          recordInstallGuideTrackEvent(req, 'track_share_register_success', {
            page: 'register',
            username: out.username,
            reported: true
          });
        }
        out.token = signAccessToken(out);
        return res.json({ code: 200, data: out });
      } catch (regErr) {
        if (regGuardKeys) {
          var rMsgEarly = regErr && regErr.message ? String(regErr.message) : '';
          var failReasonEarly =
            rMsgEarly.indexOf('已注册') >= 0 ? 'register_fail:duplicate' : 'register_fail:validation';
          await registerGuard.markRegisterAttemptFail(regGuardKeys, failReasonEarly);
        }
        var rMsg = regErr && regErr.message ? String(regErr.message) : '';
        var rReason =
          rMsg.indexOf('已注册') >= 0 ? 'register_fail:duplicate' : 'register_fail:validation';
        await recordUserRegistrationAttempt(regUser, false, req, rReason);
        throw regErr;
      }
    }
    if (action === 'recover_by_activation_code') {
      var recovered = await recoverCredentialsByActivationCode(
        body.activation_code != null ? body.activation_code : body.code
      );
      return res.json({ code: 200, data: recovered });
    }
    if (action === 'recover_by_identity') {
      try {
        var recovered2 = await recoverCredentialsByIdentity(
          body.username,
          body.real_name,
          body.tax_id
        );
        return res.json({ code: 200, data: recovered2 });
      } catch (idErr) {
        return res.json({ code: 400, msg: idErr.message || '找回失败' });
      }
    }
    if (action === 'login') {
      var loginUserName = body.username != null ? String(body.username).trim() : '';
      var loginRate = await checkLoginBusinessRate(req, loginUserName);
      if (!loginRate.ok) {
        if (loginUserName) {
          recordUserLoginAttempt(loginUserName, false, req, 'rate_limited').catch(function () {});
        }
        return sendRateLimited(res, loginRate, '登录过于频繁，请稍后再试');
      }
      var loginClientIp = getClientIp(req);
      if (loginClientIp) {
        var loginIpBlocked = await isIpBlocked(loginClientIp);
        if (loginIpBlocked) {
          if (loginUserName) {
            recordUserLoginAttempt(loginUserName, false, req, 'ip_blocked').catch(function () {});
          }
          return res.status(403).json({ code: 403, msg: '当前 IP 已被封禁，无法登录' });
        }
      }
      var out2 = await loginUser(body.username, body.password);
      await assertLoginDeviceAllowedForAgedAccount(out2.username, req);
      invalidateUserAuthCache(out2.username);
      out2.token = signAccessToken(out2);
      await updateUserLastLoginCity(out2.username, req);
      touchUserDailyActivity(out2.username);
      recordUserLoginAttempt(out2.username, true, req, 'ok').catch(function () {});
      try {
        await attachUserFromRequestChannel(out2.username, req, body);
      } catch (eAttLogin) {
        console.error('login attach channel', eAttLogin);
      }
      try {
        var loginMig = await maybeMigrateGuestSandboxForRequest(
          req,
          out2.username,
          body.client_id || body.clientId,
          body.guest_username || body.guestUsername
        );
        if (loginMig && loginMig.migrated) {
          out2.guest_data_migrated = true;
          out2.guest_migrate_summary = loginMig.summary || {};
          out2.merged_from_guest = loginMig.guest_username || '';
          /* 合并可能改了档案：回读最新姓名，避免登录响应仍是合并前旧值导致前端闪错名 */
          try {
            const [freshRows] = await pool.execute(
              'SELECT real_name, tax_id FROM users WHERE username = ? LIMIT 1',
              [out2.username]
            );
            if (freshRows.length) {
              if (freshRows[0].real_name != null) {
                out2.real_name = String(freshRows[0].real_name);
              }
              if (freshRows[0].tax_id != null) {
                out2.tax_id = String(freshRows[0].tax_id);
              }
            }
          } catch (eFresh) {}
          recordInstallGuideTrackEvent(req, 'track_guest_data_migrated', {
            page: 'login',
            guest_username: loginMig.guest_username || '',
            registered_username: out2.username,
            summary: loginMig.summary || {}
          });
        }
      } catch (eLoginMig) {
        console.error('login guest migrate', eLoginMig);
      }
      if (parseFromShareFlag(body)) {
        recordInstallGuideTrackEvent(req, 'track_share_login_success', {
          page: 'login',
          username: out2.username,
          reported: true
        });
      }
      try {
        var loginTaxPol = await getTaxEditFeePolicy(out2.username);
        out2.peer_account = !!loginTaxPol.peer_account;
        out2.peer_login_notice = loginTaxPol.peer_login_notice || '';
        out2.tax_edit_fee_policy = loginTaxPol;
      } catch (ePeerLogin) {
        out2.peer_account = false;
      }
      return res.json({ code: 200, data: out2 });
    }
    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    try {
      var b = req.body || {};
      if (b.action === 'login' && b.username != null && String(b.username).trim() !== '') {
        recordUserLoginAttempt(String(b.username).trim(), false, req, e && e.message ? String(e.message) : '').catch(
          function () {}
        );
      }
    } catch (e2) {}
    return res.status(400).json({ code: 400, msg: e.message || String(e) });
  }
}

/** 认证 POST 动作分发 */
function routeAuthPost(req, res) {
  var body = req.body || {};
  if (body.action === 'activate') {
    return requireAuth(req, res, function () {
      handleActivatePost(req, res).catch(function (err) {
        console.error(err);
        res.status(500).json({ code: 500, msg: String(err.message) });
      });
    });
  }
  handleAuthPost(req, res);
}

/* routes: auth → src/auth/routes.js */

async function handleAdminLogin(req, res) {
  var body = req.body || {};
  var u = String(body.username || '').trim();
  var p = String(body.password || '');
  var otpCode = body.otp != null ? String(body.otp).trim() : '';
  var challengeId = body.challenge_id != null ? String(body.challenge_id).trim() : '';
  if (isAdminIpDenied(req)) {
    recordAdminLoginAttempt(u || 'unknown', false, 'ip_denied', req).catch(function () {});
    return res.status(403).json({ code: 403, msg: '当前网络已被禁止访问管理后台' });
  }
  var loginRate = await consumeRateLimit(
    'admin-login-ip',
    getClientIp(req) || 'unknown',
    ADMIN_LOGIN_RATE_PER_IP_MIN,
    60 * 1000
  );
  if (!loginRate.ok) {
    recordAdminLoginAttempt(u || 'unknown', false, 'rate_limited', req).catch(function () {});
    return sendRateLimited(res, loginRate, '管理后台登录过于频繁，请稍后再试');
  }
  if (!u || !p) {
    recordAdminLoginAttempt(u || 'unknown', false, 'missing_credentials', req).catch(function () {});
    return res.status(400).json({ code: 400, msg: '请输入账号和密码' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      var admin = await loadAdminAccountByUsername(conn, u);
      if (admin && adminAccountIsLocked(admin)) {
        recordAdminLoginAttempt(u, false, 'locked', req).catch(function () {});
        return res.status(423).json({
          code: 423,
          msg: '连续登录失败过多，账号已临时锁定，请稍后再试'
        });
      }
      if (!admin || !verifyPasswordBySaltHash(p, admin.salt, admin.hash)) {
        if (admin) {
          var failInfo = await bumpAdminLoginFailure(conn, admin);
          if (failInfo.locked) {
            recordAdminLoginAttempt(u, false, 'locked_after_fail', req).catch(function () {});
            return res.status(423).json({
              code: 423,
              msg:
                '账号或密码错误，连续失败已达上限，账号已锁定约 ' +
                (failInfo.lock_minutes || ADMIN_LOGIN_LOCK_MINUTES) +
                ' 分钟'
            });
          }
        }
        recordAdminLoginAttempt(u, false, 'invalid_credentials', req).catch(function () {});
        return res.status(401).json({ code: 401, msg: '账号或密码错误' });
      }
      if (admin.banned) {
        recordAdminLoginAttempt(u, false, 'banned', req).catch(function () {});
        return res.status(403).json({ code: 403, msg: '管理账号已停用' });
      }

      if (ADMIN_LOGIN_EMAIL_OTP) {
        if (!otpCode || !challengeId) {
          try {
            var issued = await issueAdminLoginEmailOtp(admin);
            recordAdminLoginAttempt(admin.username, false, 'otp_sent', req).catch(function () {});
            return res.json({
              code: 200,
              data: {
                otp_required: true,
                challenge_id: issued.challenge_id,
                email_masked: issued.email_masked,
                expires_in: ADMIN_OTP_TTL_SEC
              },
              msg: '请输入发送到 ' + issued.email_masked + ' 的验证码'
            });
          } catch (otpErr) {
            console.error('admin otp issue', otpErr);
            recordAdminLoginAttempt(admin.username, false, 'otp_config_error', req).catch(function () {});
            return res.status(503).json({
              code: 503,
              msg: otpErr && otpErr.message ? String(otpErr.message) : '无法发送登录验证码'
            });
          }
        }
        var otpChk = await verifyAdminLoginEmailOtp(admin.username, challengeId, otpCode);
        if (!otpChk.ok) {
          recordAdminLoginAttempt(admin.username, false, 'otp_invalid', req).catch(function () {});
          return res.status(401).json({ code: 401, msg: otpChk.msg || '验证码错误' });
        }
      }

      await clearAdminLoginFailure(conn, admin.id);
      recordAdminLoginAttempt(admin.username, true, 'ok', req).catch(function () {});
      var sessionPayload = adminMenuRegistry.buildAdminSessionPayload(admin);
      return res.json({
        code: 200,
        data: Object.assign({ token: signAdminToken(admin.username) }, sessionPayload)
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 当前管理员信息 */
async function handleAdminMe(req, res) {
  return res.json({
    code: 200,
    data: adminMenuRegistry.buildAdminSessionPayload(req.admin)
  });
}

/** 超管或拥有下线管理员菜单 */
function adminCanManageAccountsPage(admin) {
  if (!admin) return false;
  if (admin.is_super) return true;
  return adminHasMenu(admin, 'downline-admins') || adminHasMenu(admin, 'admin-accounts');
}

/** 子管理员只能分配自己已有的菜单 */
function constrainMenusToActor(actor, rawMenus) {
  var menus = normalizeAdminMenuList(rawMenus, false);
  if (!actor || actor.is_super) {
    return menus.filter(function (k) {
      return k !== 'admin-accounts';
    });
  }
  return adminDownline.intersectMenuKeys(menus, actor.menus || []);
}

/** 返回当前操作者可勾选的菜单定义 */
function menuDefsForActor(admin) {
  var defs = adminMenuRegistry.getAssignableMenuDefs();
  if (!admin || admin.is_super) return defs;
  var allowed = Object.create(null);
  (admin.menus || []).forEach(function (k) {
    allowed[String(k)] = 1;
  });
  return defs.filter(function (d) {
    return d && d.key && allowed[d.key] && !d.super_only;
  });
}

/** 管理员账号列表 */
async function handleAdminAccountsList(req, res) {
  if (!adminCanManageAccountsPage(req.admin)) {
    return res.status(403).json({ code: 403, msg: '当前账号无该菜单权限' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      var listSql =
        'SELECT id, username, full_name, parent_admin_username, is_super, banned, created_at FROM admin_accounts';
      var listParams = [];
      if (!req.admin.is_super) {
        var downs = req.admin.downline_usernames || [];
        if (!downs.length) {
          return res.json({
            code: 200,
            data: {
              accounts: [],
              menu_keys: menuDefsForActor(req.admin).map(function (d) {
                return d.key;
              }),
              menu_defs: menuDefsForActor(req.admin),
              mode: 'downline'
            }
          });
        }
        listSql += ' WHERE ' + adminDownline.ownerAdminInSql('username', listParams, downs);
      }
      listSql += ' ORDER BY id ASC';
      var rows;
      try {
        const rList = await conn.execute(listSql, listParams);
        rows = rList[0];
      } catch (eCol) {
        if (!eCol || eCol.errno !== 1054) throw eCol;
        var fallbackSql = 'SELECT id, username, full_name, is_super, banned, created_at FROM admin_accounts';
        var fallbackParams = [];
        if (!req.admin.is_super) {
          var downsFb = req.admin.downline_usernames || [];
          if (!downsFb.length) {
            return res.json({
              code: 200,
              data: {
                accounts: [],
                menu_keys: menuDefsForActor(req.admin).map(function (d) {
                  return d.key;
                }),
                menu_defs: menuDefsForActor(req.admin),
                mode: 'downline'
              }
            });
          }
          fallbackSql += ' WHERE ' + adminDownline.ownerAdminInSql('username', fallbackParams, downsFb);
        }
        fallbackSql += ' ORDER BY id ASC';
        const rFb = await conn.execute(fallbackSql, fallbackParams);
        rows = rFb[0];
      }
      var menuByAdmin = Object.create(null);
      if (rows.length) {
        var ids = rows.map(function (r) {
          return Number(r.id) || 0;
        }).filter(Boolean);
        if (ids.length) {
          var placeholders = ids.map(function () {
            return '?';
          }).join(',');
          const [menuRows] = await conn.execute(
            'SELECT admin_id, menu_key FROM admin_account_menus WHERE admin_id IN (' +
              placeholders +
              ') ORDER BY admin_id ASC, menu_key ASC',
            ids
          );
          for (var mi = 0; mi < menuRows.length; mi++) {
            var aid = Number(menuRows[mi].admin_id) || 0;
            if (!menuByAdmin[aid]) menuByAdmin[aid] = [];
            menuByAdmin[aid].push(menuRows[mi].menu_key);
          }
        }
      }
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        var id = Number(rows[i].id) || 0;
        out.push({
          id: id,
          username: String(rows[i].username),
          full_name: rows[i].full_name != null ? String(rows[i].full_name) : '',
          parent_admin_username:
            rows[i].parent_admin_username != null ? String(rows[i].parent_admin_username).trim() : '',
          is_super: rows[i].is_super === 1 || rows[i].is_super === true,
          banned: rows[i].banned === 1 || rows[i].banned === true,
          created_at: rows[i].created_at ? rows[i].created_at.toISOString() : '',
          menus: normalizeAdminMenuList(
            menuByAdmin[id] || [],
            rows[i].is_super === 1 || rows[i].is_super === true
          )
        });
      }
      var defs = menuDefsForActor(req.admin);
      return res.json({
        code: 200,
        data: {
          accounts: out,
          menu_keys: defs.map(function (d) {
            return d.key;
          }),
          menu_defs: defs,
          mode: req.admin.is_super ? 'all' : 'downline'
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 创建管理员 */
async function handleAdminAccountsCreate(req, res) {
  if (!adminCanManageAccountsPage(req.admin)) {
    return res.status(403).json({ code: 403, msg: '当前账号无该菜单权限' });
  }
  var body = req.body || {};
  var username = String(body.username || '').trim();
  var fullName = String(body.full_name || '').trim();
  var password = String(body.password || '');
  var menus = constrainMenusToActor(req.admin, body.menus);
  if (!username || username.length < 3 || username.length > 64 || !/^[a-zA-Z0-9_.-]+$/.test(username)) {
    return res.status(400).json({ code: 400, msg: '账号仅支持 3-64 位字母数字._-' });
  }
  if (!password || password.length < 4 || password.length > 128) {
    return res.status(400).json({ code: 400, msg: '密码长度需为 4-128 位' });
  }
  if (!fullName || fullName.length > 255) {
    return res.status(400).json({ code: 400, msg: '请填写姓名（1-255 字）' });
  }
  if (!menus.length) {
    return res.status(400).json({ code: 400, msg: '请至少选择一个可用菜单' });
  }
  if (
    username.toLowerCase() === 'admin' ||
    username.toLowerCase() === String(ADMIN_PANEL_USER || '').toLowerCase()
  ) {
    return res.status(400).json({ code: 400, msg: '保留账号不可新建' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      const [exists] = await conn.execute('SELECT id FROM admin_accounts WHERE username = ? LIMIT 1', [username]);
      if (exists.length) {
        return res.status(400).json({ code: 400, msg: '该管理账号已存在' });
      }
      var parentName = req.admin.is_super ? null : String(req.admin.username || '').trim() || null;
      if (parentName) {
        var depth = await adminDownline.countAdminParentDepth(conn, parentName);
        if (depth >= adminDownline.MAX_DOWNLINE_DEPTH) {
          return res.status(400).json({ code: 400, msg: '下线层级已达上限' });
        }
      }
      var saltBuf = crypto.randomBytes(16);
      var saltHex = saltBuf.toString('hex');
      var hashHex = hashPasswordWithSalt(password, saltBuf);
      var ins;
      try {
        const rIns = await conn.execute(
          'INSERT INTO admin_accounts (username, full_name, parent_admin_username, salt, hash, is_super, banned) VALUES (?, ?, ?, ?, ?, 0, 0)',
          [username, fullName, parentName, saltHex, hashHex]
        );
        ins = rIns[0];
      } catch (eIns) {
        if (!eIns || eIns.errno !== 1054) throw eIns;
        const rOld = await conn.execute(
          'INSERT INTO admin_accounts (username, full_name, salt, hash, is_super, banned) VALUES (?, ?, ?, ?, 0, 0)',
          [username, fullName, saltHex, hashHex]
        );
        ins = rOld[0];
      }
      var adminId = ins.insertId ? Number(ins.insertId) : 0;
      if (menus.length && adminId) {
        var values = menus.map(function () {
          return '(?, ?)';
        }).join(',');
        var params = [];
        for (var i = 0; i < menus.length; i++) {
          params.push(adminId, menus[i]);
        }
        await conn.execute(
          'INSERT INTO admin_account_menus (admin_id, menu_key) VALUES ' + values,
          params
        );
      }
      return res.json({ code: 200, data: { username: username } });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 更新管理员 */
async function handleAdminAccountsUpdate(req, res) {
  if (!adminCanManageAccountsPage(req.admin)) {
    return res.status(403).json({ code: 403, msg: '当前账号无该菜单权限' });
  }
  var body = req.body || {};
  var username = String(body.username || '').trim();
  var fullName = body.full_name != null ? String(body.full_name).trim() : '';
  if (!username) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  var updatePassword = body.password != null ? String(body.password) : '';
  var hasPasswordUpdate = updatePassword !== '';
  if (hasPasswordUpdate && (updatePassword.length < 4 || updatePassword.length > 128)) {
    return res.status(400).json({ code: 400, msg: '密码长度需为 4-128 位' });
  }
  var menus = constrainMenusToActor(req.admin, body.menus);
  if (!menus.length) {
    return res.status(400).json({ code: 400, msg: '请至少选择一个可用菜单' });
  }
  if (!fullName || fullName.length > 255) {
    return res.status(400).json({ code: 400, msg: '请填写姓名（1-255 字）' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      var admin = await loadAdminAccountByUsername(conn, username);
      if (!admin) {
        return res.status(404).json({ code: 404, msg: '管理账号不存在' });
      }
      if (!adminDownline.canManageTargetAdmin(req.admin, admin)) {
        return res.status(403).json({ code: 403, msg: '只能管理自己的下线管理员' });
      }
      if (admin.is_super) {
        return res.status(400).json({ code: 400, msg: '不能修改 admin 超级账号权限' });
      }
      await conn.execute('DELETE FROM admin_account_menus WHERE admin_id = ?', [admin.id]);
      if (menus.length) {
        var valuesUp = menus.map(function () {
          return '(?, ?)';
        }).join(',');
        var paramsUp = [];
        for (var i = 0; i < menus.length; i++) {
          paramsUp.push(admin.id, menus[i]);
        }
        await conn.execute(
          'INSERT INTO admin_account_menus (admin_id, menu_key) VALUES ' + valuesUp,
          paramsUp
        );
      }
      await conn.execute('UPDATE admin_accounts SET full_name = ? WHERE id = ?', [fullName, admin.id]);
      if (hasPasswordUpdate) {
        var saltBuf = crypto.randomBytes(16);
        var saltHex = saltBuf.toString('hex');
        var hashHex = hashPasswordWithSalt(updatePassword, saltBuf);
        await conn.execute('UPDATE admin_accounts SET salt = ?, hash = ? WHERE id = ?', [saltHex, hashHex, admin.id]);
      }
      return res.json({ code: 200, data: { username: username } });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 管理员开通的用户 */
async function handleAdminAccountActivatedUsers(req, res) {
  if (!adminCanManageAccountsPage(req.admin)) {
    return res.status(403).json({ code: 403, msg: '当前账号无该菜单权限' });
  }
  var ownerAdmin = String(req.query.owner_admin || '').trim();
  if (!ownerAdmin) {
    return res.status(400).json({ code: 400, msg: 'owner_admin required' });
  }
  if (!adminDownline.canViewTargetAdmin(req.admin, ownerAdmin)) {
    return res.status(403).json({ code: 403, msg: '只能查看自己或下线管理员的开通用户' });
  }
  var page = parseInt(req.query.page, 10) || 1;
  var limit = parseInt(req.query.limit, 10) || 10;
  if (page < 1) page = 1;
  if (limit < 1) limit = 10;
  if (limit > 50) limit = 50;
  var offset = (page - 1) * limit;
  try {
    const conn = await pool.getConnection();
    try {
      var adminRow = await loadAdminAccountByUsername(conn, ownerAdmin);
      if (!adminRow) {
        return res.status(404).json({ code: 404, msg: '管理账号不存在' });
      }
      var countSql =
        'SELECT COUNT(*) AS cnt FROM (' +
        'SELECT DISTINCT used_by_username FROM activation_codes ' +
        'WHERE owner_admin_username = ? AND used_by_username IS NOT NULL AND TRIM(used_by_username) <> \'\'' +
        ') t';
      const [countRows] = await conn.execute(countSql, [ownerAdmin]);
      var total = countRows.length ? Number(countRows[0].cnt) || 0 : 0;

      const [rows] = await conn.query(
        `SELECT u.username, u.real_name, u.account_active, u.banned, u.created_at,
                agg.activated_at, agg.activation_code
         FROM (
           SELECT used_by_username,
                  MAX(last_used_at) AS activated_at,
                  SUBSTRING_INDEX(GROUP_CONCAT(code ORDER BY last_used_at DESC, id DESC), ',', 1) AS activation_code
           FROM activation_codes
           WHERE owner_admin_username = ?
             AND used_by_username IS NOT NULL
             AND TRIM(used_by_username) <> ''
           GROUP BY used_by_username
         ) agg
         INNER JOIN users u ON u.username = agg.used_by_username AND u.activation_refunded_at IS NULL
         ORDER BY agg.activated_at DESC, u.id DESC
         LIMIT ${limit} OFFSET ${offset}`,
        [ownerAdmin]
      );

      var out = rows.map(function (r) {
        return {
          username: String(r.username || ''),
          real_name: r.real_name != null ? String(r.real_name) : '',
          account_active: r.account_active === 1 || r.account_active === true,
          banned: r.banned === 1 || r.banned === true,
          created_at: r.created_at ? r.created_at.toISOString() : '',
          activated_at: r.activated_at ? r.activated_at.toISOString() : '',
          activation_code: r.activation_code != null ? String(r.activation_code) : ''
        };
      });
      return res.json({
        code: 200,
        data: {
          owner_admin: ownerAdmin,
          users: out,
          total: total,
          page: page,
          limit: limit
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 删除管理员 */
async function handleAdminAccountsDelete(req, res) {
  if (!adminCanManageAccountsPage(req.admin)) {
    return res.status(403).json({ code: 403, msg: '当前账号无该菜单权限' });
  }
  var body = req.body || {};
  var username = String(body.username || '').trim();
  if (!username) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  if (username === req.admin.username) {
    return res.status(400).json({ code: 400, msg: '不能删除当前登录账号' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      var admin = await loadAdminAccountByUsername(conn, username);
      if (!admin) {
        return res.status(404).json({ code: 404, msg: '管理账号不存在' });
      }
      if (admin.is_super) {
        return res.status(400).json({ code: 400, msg: '不能删除 admin 超级账号' });
      }
      if (!adminDownline.canManageTargetAdmin(req.admin, admin)) {
        return res.status(403).json({ code: 403, msg: '只能管理自己的下线管理员' });
      }
      var reparentTo = req.admin.is_super ? null : String(req.admin.username || '').trim() || null;
      try {
        await conn.execute(
          'UPDATE admin_accounts SET parent_admin_username = ? WHERE parent_admin_username = ?',
          [reparentTo, username]
        );
      } catch (eRep) {
        if (!eRep || eRep.errno !== 1054) throw eRep;
      }
      await conn.execute('DELETE FROM admin_account_menus WHERE admin_id = ?', [admin.id]);
      await conn.execute('DELETE FROM admin_accounts WHERE id = ?', [admin.id]);
      return res.json({ code: 200, data: { username: username, deleted: true } });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 格式化：date key */
function formatDateKey(d) {
  if (!d) return '';
  if (d instanceof Date) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  var s = String(d).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/** china date key now */
function chinaDateKeyNow() {
  var now = new Date();
  var utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return formatDateKey(new Date(utcMs + 8 * 3600000));
}

/** china date parts now */
function chinaDatePartsNow() {
  var todayKey = chinaDateKeyNow();
  var p = todayKey.split('-').map(Number);
  return { year: p[0], month: p[1], day: p[2], todayKey: todayKey };
}

/** 项目统计起始日（2026-04 上线，更早日期不纳入可选区间） */
var ANALYTICS_PROJECT_START_YMD = '2026-04-01';
var ANALYTICS_PROJECT_START_YM = 2026 * 12 + 4;

function analyticsYmKey(y, m) {
  return y * 12 + m;
}

function analyticsClampStartYmd(ymd) {
  if (!ymd || String(ymd) < ANALYTICS_PROJECT_START_YMD) {
    return ANALYTICS_PROJECT_START_YMD;
  }
  return String(ymd);
}

/** 是否：valid analytics ymd */
function isValidAnalyticsYmd(ymd) {
  var m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  var y = parseInt(m[1], 10);
  var mo = parseInt(m[2], 10);
  var d = parseInt(m[3], 10);
  if (y < 2026 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  var dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return false;
  }
  var key =
    y +
    '-' +
    String(mo).padStart(2, '0') +
    '-' +
    String(d).padStart(2, '0');
  return key >= ANALYTICS_PROJECT_START_YMD;
}

/** analytics ymd day count */
function analyticsYmdDayCount(startYmd, endYmd) {
  var a = String(startYmd).split('-').map(function (x) {
    return parseInt(x, 10);
  });
  var b = String(endYmd).split('-').map(function (x) {
    return parseInt(x, 10);
  });
  return (
    Math.floor((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000) + 1
  );
}

/** analytics period fallback：默认当天（自定义） */
function analyticsPeriodFallbackDays() {
  var cn = chinaDatePartsNow();
  var start = analyticsClampStartYmd(cn.todayKey);
  var end = cn.todayKey < ANALYTICS_PROJECT_START_YMD ? ANALYTICS_PROJECT_START_YMD : cn.todayKey;
  if (start > end) {
    start = ANALYTICS_PROJECT_START_YMD;
    end = ANALYTICS_PROJECT_START_YMD;
  }
  return {
    mode: 'range',
    start: start,
    end: end,
    label: '自定义',
    period_key: 'range_' + start + '_' + end,
    days: analyticsYmdDayCount(start, end)
  };
}

/** 解析：conversion analytics period */
function parseConversionAnalyticsPeriod(raw, maxDays) {
  maxDays = maxDays == null ? 90 : maxDays;
  var customMaxDays = 366;
  var s = raw != null ? String(raw).trim() : '';
  if (s === 'month_current') {
    var cn = chinaDatePartsNow();
    if (analyticsYmKey(cn.year, cn.month) < ANALYTICS_PROJECT_START_YM) {
      return analyticsPeriodFallbackDays();
    }
    var start = analyticsClampStartYmd(cn.year + '-' + String(cn.month).padStart(2, '0') + '-01');
    return {
      mode: 'range',
      start: start,
      end: cn.todayKey < start ? start : cn.todayKey,
      label: '当月',
      period_key: s,
      days: analyticsYmdDayCount(start, cn.todayKey < start ? start : cn.todayKey)
    };
  }
  if (s === 'month_prev' || s === 'month_prev2') {
    var cn2 = chinaDatePartsNow();
    var offset = s === 'month_prev2' ? 2 : 1;
    var dt = new Date(cn2.year, cn2.month - 1 - offset, 1);
    var y = dt.getFullYear();
    var m = dt.getMonth() + 1;
    if (analyticsYmKey(y, m) < ANALYTICS_PROJECT_START_YM) {
      return analyticsPeriodFallbackDays();
    }
    var start2 = y + '-' + String(m).padStart(2, '0') + '-01';
    var lastDay = new Date(y, m, 0).getDate();
    var end2 = y + '-' + String(m).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
    return {
      mode: 'range',
      start: start2,
      end: end2,
      label: s === 'month_prev2' ? '上上月' : '上月',
      period_key: s,
      days: lastDay
    };
  }
  var fixedMonth = s.match(/^month_(\d{4})-(\d{2})$/);
  if (fixedMonth) {
    var fy = parseInt(fixedMonth[1], 10);
    var fm = parseInt(fixedMonth[2], 10);
    if (fm >= 1 && fm <= 12 && analyticsYmKey(fy, fm) >= ANALYTICS_PROJECT_START_YM && fy <= 2100) {
      var fStart = fy + '-' + String(fm).padStart(2, '0') + '-01';
      var fLastDay = new Date(fy, fm, 0).getDate();
      var fEnd = fy + '-' + String(fm).padStart(2, '0') + '-' + String(fLastDay).padStart(2, '0');
      return {
        mode: 'range',
        start: fStart,
        end: fEnd,
        label: fy + '年' + fm + '月',
        period_key: s,
        days: fLastDay
      };
    }
    return analyticsPeriodFallbackDays();
  }
  var customRange = s.match(/^range_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  if (customRange) {
    var cStart = customRange[1];
    var cEnd = customRange[2];
    if (!isValidAnalyticsYmd(cStart) || !isValidAnalyticsYmd(cEnd)) {
      return analyticsPeriodFallbackDays();
    }
    var todayKey = chinaDatePartsNow().todayKey;
    cStart = analyticsClampStartYmd(cStart);
    if (cEnd > todayKey) cEnd = todayKey;
    if (cStart > cEnd) {
      return analyticsPeriodFallbackDays();
    }
    var cDays = analyticsYmdDayCount(cStart, cEnd);
    if (cDays < 1 || cDays > customMaxDays) {
      return analyticsPeriodFallbackDays();
    }
    return {
      mode: 'range',
      start: cStart,
      end: cEnd,
      label: '自定义',
      period_key: 'range_' + cStart + '_' + cEnd,
      days: cDays
    };
  }
  var days = parseInt(s, 10) || 1;
  if (days < 1) days = 1;
  if (days > maxDays) days = maxDays;
  return {
    mode: 'days',
    days: days,
    span: days - 1,
    label: '最近 ' + days + ' 天',
    period_key: String(days)
  };
}

/** conversion analytics period meta */
function conversionAnalyticsPeriodMeta(period) {
  return {
    days: period.period_key,
    period_label: period.label,
    period_start: period.mode === 'range' ? period.start : null,
    period_end: period.mode === 'range' ? period.end : null
  };
}

var parseAnalyticsPeriod = parseConversionAnalyticsPeriod;

/** analytics period cn date filter */
function analyticsPeriodCnDateFilter(dateExpr, period) {
  if (period.mode === 'range') {
    return {
      sql: '(' + dateExpr + ' >= ? AND ' + dateExpr + ' <= ?)',
      params: [period.start, period.end]
    };
  }
  var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
  return {
    sql: '(' + dateExpr + ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY))',
    params: [period.span]
  };
}

/** analytics period stat date filter */
function analyticsPeriodStatDateFilter(period) {
  if (period.mode === 'range') {
    return {
      sql: '(stat_date >= ? AND stat_date <= ?)',
      params: [period.start, period.end]
    };
  }
  return {
    sql: '(stat_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY))',
    params: [period.span]
  };
}

/** analytics period activity date filter */
function analyticsPeriodActivityDateFilter(period) {
  if (period.mode === 'range') {
    return {
      sql: '(activity_date >= ? AND activity_date <= ?)',
      params: [period.start, period.end]
    };
  }
  return {
    sql: '(activity_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY))',
    params: [period.span]
  };
}

/** analytics period login datetime filter */
function analyticsPeriodLoginDatetimeFilter(period) {
  if (period.mode === 'range') {
    return {
      sql: '(DATE(created_at) >= ? AND DATE(created_at) <= ?)',
      params: [period.start, period.end]
    };
  }
  return {
    sql: '(created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY))',
    params: [period.span]
  };
}

/** 用户辅助：login inactive since sql */
function userLoginInactiveSinceSql(days, usernameExpr) {
  var u = usernameExpr || 'users.username';
  var d = parseInt(days, 10);
  if (!isFinite(d) || d < 1) {
    d = 30;
  }
  return (
    'COALESCE((SELECT MAX(ule.created_at) FROM user_login_events ule WHERE ule.username = ' +
    u +
    ' AND ule.ok = 1), users.created_at) < DATE_SUB(NOW(), INTERVAL ' +
    d +
    ' DAY)'
  );
}

/** 当日活跃：日活表或当日成功登录（与「当日登录」筛选一致） */
function userActiveOnDateSql(usernameExpr) {
  var u = usernameExpr || 'users.username';
  return (
    '(EXISTS (SELECT 1 FROM user_daily_activity uda WHERE uda.username = ' +
    u +
    ' AND uda.activity_date = ?) OR EXISTS (SELECT 1 FROM user_login_events ule WHERE ule.username = ' +
    u +
    ' AND ule.ok = 1 AND ule.created_at >= ? AND ule.created_at < DATE_ADD(?, INTERVAL 1 DAY)))'
  );
}

/** 构建：user login risk maps */
async function buildUserLoginRiskMaps(conn, usernames) {
  var ipDistinct = {};
  var deviceCnt = {};
  var registerIpAccountCountByUser = {};
  var registerIpFirstAccountByUser = {};
  if (!conn || !usernames || !usernames.length) {
    return {
      ipDistinct: ipDistinct,
      deviceCnt: deviceCnt,
      registerIpAccountCountByUser: registerIpAccountCountByUser,
      registerIpFirstAccountByUser: registerIpFirstAccountByUser
    };
  }
  var uniq = [];
  var seen = {};
  for (var i = 0; i < usernames.length; i++) {
    var u = String(usernames[i] || '').trim();
    if (!u || seen[u]) continue;
    seen[u] = 1;
    uniq.push(u);
  }
  if (!uniq.length) {
    return {
      ipDistinct: ipDistinct,
      deviceCnt: deviceCnt,
      registerIpAccountCountByUser: registerIpAccountCountByUser,
      registerIpFirstAccountByUser: registerIpFirstAccountByUser
    };
  }
  var ph = uniq.map(function () {
    return '?';
  }).join(',');
  var ipParams = uniq.concat(uniq);
  var [ipRows] = await conn.execute(
    'SELECT username, COUNT(DISTINCT ip_val) AS cnt FROM (' +
      "SELECT username, TRIM(ip) AS ip_val FROM user_login_events WHERE (ok = 1 OR reason LIKE 'register_%') AND username IN (" +
      ph +
      ") AND ip IS NOT NULL AND TRIM(ip) <> '' UNION ALL " +
      'SELECT username, TRIM(ip_last) AS ip_val FROM user_devices WHERE username IN (' +
      ph +
      ") AND ip_last IS NOT NULL AND TRIM(ip_last) <> ''" +
      ') combined GROUP BY username',
    ipParams
  );
  var [devRows] = await conn.execute(
    'SELECT username, COUNT(*) AS cnt FROM user_devices WHERE username IN (' + ph + ') GROUP BY username',
    uniq
  );
  ipRows.forEach(function (r) {
    ipDistinct[String(r.username)] = Number(r.cnt) || 0;
  });
  devRows.forEach(function (r) {
    deviceCnt[String(r.username)] = Number(r.cnt) || 0;
  });

  var regIpByUser = {};
  var [regIpRows] = await conn.execute(
    'SELECT username, TRIM(ip) AS reg_ip FROM user_login_events WHERE username IN (' +
      ph +
      ") AND ip IS NOT NULL AND TRIM(ip) <> '' AND (reason = 'register_ok' OR reason LIKE 'register_%') ORDER BY username, (reason = 'register_ok') DESC, created_at ASC",
    uniq
  );
  (regIpRows || []).forEach(function (r) {
    var un = String(r.username || '');
    if (!un || regIpByUser[un]) return;
    regIpByUser[un] = String(r.reg_ip || '').trim();
  });

  var ipsToLookup = [];
  var seenIp = {};
  for (var j = 0; j < uniq.length; j++) {
    var regIp = regIpByUser[uniq[j]];
    if (regIp && !seenIp[regIp]) {
      seenIp[regIp] = 1;
      ipsToLookup.push(regIp);
    }
  }
  var regIpAccountCount = {};
  var regIpFirstAccount = {};
  if (ipsToLookup.length) {
    var ipPh = ipsToLookup
      .map(function () {
        return '?';
      })
      .join(',');
    var [ipCountRows] = await conn.execute(
      "SELECT TRIM(ip) AS reg_ip, COUNT(DISTINCT username) AS cnt FROM user_login_events WHERE reason = 'register_ok' AND ip IS NOT NULL AND TRIM(ip) <> '' AND TRIM(ip) IN (" +
        ipPh +
        ') GROUP BY TRIM(ip)',
      ipsToLookup
    );
    (ipCountRows || []).forEach(function (r) {
      regIpAccountCount[String(r.reg_ip || '').trim()] = Number(r.cnt) || 0;
    });
    var [firstRows] = await conn.execute(
      "SELECT TRIM(ip) AS reg_ip, SUBSTRING_INDEX(GROUP_CONCAT(username ORDER BY created_at ASC, id ASC SEPARATOR ','), ',', 1) AS first_username FROM user_login_events WHERE reason = 'register_ok' AND ip IS NOT NULL AND TRIM(ip) <> '' AND TRIM(ip) IN (" +
        ipPh +
        ') GROUP BY TRIM(ip)',
      ipsToLookup
    );
    (firstRows || []).forEach(function (r) {
      regIpFirstAccount[String(r.reg_ip || '').trim()] = String(r.first_username || '').trim();
    });
  }
  uniq.forEach(function (uname) {
    var ipKey = regIpByUser[uname];
    registerIpAccountCountByUser[uname] = ipKey ? regIpAccountCount[ipKey] || 0 : 0;
    registerIpFirstAccountByUser[uname] = ipKey ? regIpFirstAccount[ipKey] || '' : '';
  });

  return {
    ipDistinct: ipDistinct,
    deviceCnt: deviceCnt,
    registerIpAccountCountByUser: registerIpAccountCountByUser,
    registerIpFirstAccountByUser: registerIpFirstAccountByUser
  };
}

/** 用户辅助：activation stats eligible sql */
function userActivationStatsEligibleSql(userCol) {
  var alias = userTableAliasFromCol(userCol || 'users.username');
  return (
    alias +
    '.activation_refunded_at IS NULL AND ' +
    alias +
    '.list_hidden_at IS NULL AND COALESCE(' +
    alias +
    '.user_type, 0) <> ' +
    USER_TYPE_GUEST
  );
}

/** 每日转化统计 */
async function handleAdminUsersDailyConversion(req, res) {
  try {
    var period = parseConversionAnalyticsPeriod(req.query.days, 90);
    var agentChannels = await getAgentPromoChannelListFromSettings();

    const conn = await pool.getConnection();
    try {
      var ownSeg = await queryDailyConversionSegment(conn, period, req.admin, 'own', agentChannels);
      var agentSeg = await queryDailyConversionSegment(conn, period, req.admin, 'agent', agentChannels);
      var xianyuSeg = await queryDailyActivationChannelSegment(conn, period, req.admin, 'xianyu');
      var alipaySeg = await queryDailyActivationChannelSegment(conn, period, req.admin, 'alipay');
      var kufakaSeg = await queryDailyActivationChannelSegment(conn, period, req.admin, 'kufaka');

      res.json({
        code: 200,
        data: Object.assign(conversionAnalyticsPeriodMeta(period), {
          agent_channel_ids: agentChannels,
          owner_admin_username: conversionAnalyticsOwnerAdmin(req.admin),
          segments: {
            own: ownSeg,
            agent: agentSeg,
            xianyu: xianyuSeg,
            alipay: alipaySeg,
            kufaka: kufakaSeg
          }
        })
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

function pctRateText(n, d) {
  var num = Number(n) || 0;
  var den = Number(d) || 0;
  if (den <= 0) return null;
  return (Math.round((num / den) * 1000) / 10).toFixed(1) + '%';
}

/**
 * 注册次日回访未激活：转化对比 + 当前存量拆解
 * 日活与 created_at 按 UTC 日对齐（与 user_daily_activity / CURDATE 一致）
 */
async function handleAdminD1ReturnCohort(req, res) {
  try {
    var whereClauses = ['users.list_hidden_at IS NULL', nonGuestUsernameSql('users.username')];
    var params = [];
    appendAdminRegisteredUsersScope(whereClauses, params, req.admin, 'users.username');
    var whereSql = ' WHERE ' + whereClauses.join(' AND ');
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        `SELECT
           COUNT(*) AS visible_n,
           SUM(eligible) AS eligible,
           SUM(eligible AND has_d1) AS has_d1,
           SUM(eligible AND has_d1 AND activated) AS has_d1_activated,
           SUM(eligible AND NOT has_d1) AS no_d1,
           SUM(eligible AND NOT has_d1 AND activated) AS no_d1_activated,
           SUM(inactive_flag AND has_d1) AS inactive_has_d1,
           SUM(inactive_flag AND has_d1 AND NOT has_after) AS inactive_d1_only,
           SUM(inactive_flag AND has_d1 AND has_after) AS inactive_d1_later,
           SUM(inactive_flag AND has_d1 AND NOT has_after AND has_tax) AS d1_only_tax,
           SUM(inactive_flag AND has_d1 AND NOT has_after AND NOT has_tax) AS d1_only_no_tax,
           SUM(inactive_flag AND has_d1 AND NOT has_after AND visited_pay) AS d1_only_pay,
           SUM(inactive_flag AND has_d1 AND NOT has_after AND NOT visited_pay) AS d1_only_no_pay,
           SUM(inactive_flag AND has_d1 AND NOT has_after AND NOT has_tax AND NOT visited_pay) AS d1_only_login,
           SUM(inactive_flag AND has_d1 AND NOT has_after AND has_tax AND visited_pay) AS d1_only_tax_pay,
           SUM(inactive_flag AND has_d1 AND NOT has_after AND age_days <= 7) AS d1_only_7d,
           SUM(inactive_flag AND has_d1 AND NOT has_after AND age_days BETWEEN 8 AND 30) AS d1_only_8_30,
           SUM(inactive_flag AND has_d1 AND NOT has_after AND age_days > 30) AS d1_only_gt30
         FROM (
           SELECT
             CASE WHEN users.account_active = 1 THEN 1 ELSE 0 END AS activated,
             CASE WHEN (users.account_active IS NULL OR users.account_active = 0) THEN 1 ELSE 0 END AS inactive_flag,
             CASE WHEN DATE(users.created_at) <= DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN 1 ELSE 0 END AS eligible,
             DATEDIFF(CURDATE(), DATE(users.created_at)) AS age_days,
             ${userHasD1DailyActivitySql('users')} AS has_d1,
             ${userHasDailyActivityAfterD1Sql('users')} AS has_after,
             EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = users.username AND tr.deleted_at IS NULL) AS has_tax,
             EXISTS (SELECT 1 FROM user_page_events e WHERE e.username = users.username AND (e.page_path LIKE '%purchase%' OR e.route_key LIKE '%track_purchase_%')) AS visited_pay
           FROM users ${whereSql}
         ) t`,
        params
      );
      var r = rows && rows[0] ? rows[0] : {};
      function n(key) {
        return Number(r[key]) || 0;
      }
      var hasD1 = n('has_d1');
      var hasD1Act = n('has_d1_activated');
      var noD1 = n('no_d1');
      var noD1Act = n('no_d1_activated');
      res.json({
        code: 200,
        data: {
          definition:
            '日活=user_daily_activity（登录或调用需登录接口）。注册日与日活日按 UTC 对齐。次日=注册日+1。「仅次日回访」=有次日日活且之后再无日活。游客与已隐藏账号已排除。',
          visible_n: n('visible_n'),
          historical: {
            eligible: n('eligible'),
            has_d1: hasD1,
            has_d1_activated: hasD1Act,
            has_d1_rate_pct: pctRateText(hasD1Act, hasD1),
            no_d1: noD1,
            no_d1_activated: noD1Act,
            no_d1_rate_pct: pctRateText(noD1Act, noD1)
          },
          stock: {
            inactive_has_d1: n('inactive_has_d1'),
            inactive_d1_only: n('inactive_d1_only'),
            inactive_d1_later: n('inactive_d1_later'),
            d1_only_tax: n('d1_only_tax'),
            d1_only_no_tax: n('d1_only_no_tax'),
            d1_only_pay: n('d1_only_pay'),
            d1_only_no_pay: n('d1_only_no_pay'),
            d1_only_login: n('d1_only_login'),
            d1_only_tax_pay: n('d1_only_tax_pay'),
            d1_only_7d: n('d1_only_7d'),
            d1_only_8_30: n('d1_only_8_30'),
            d1_only_gt30: n('d1_only_gt30')
          }
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 自己填写月收入 >1.5 万且未激活：存量拆解 */
async function handleAdminHighIncomeInactive(req, res) {
  try {
    var whereClauses = [
      'users.list_hidden_at IS NULL',
      nonGuestUsernameSql('users.username'),
      '(users.account_active IS NULL OR users.account_active = 0)',
      userHasSelfFilledHighIncomeSql('users.username', HIGH_SELF_INCOME_THRESHOLD)
    ];
    var params = [];
    appendAdminRegisteredUsersScope(whereClauses, params, req.admin, 'users.username');
    var whereSql = ' WHERE ' + whereClauses.join(' AND ');
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        `SELECT
           COUNT(*) AS total,
           SUM(visited_pay) AS visited_pay,
           SUM(NOT visited_pay) AS no_pay,
           SUM(age_days <= 7) AS in_7d,
           SUM(age_days BETWEEN 8 AND 30) AS in_8_30,
           SUM(age_days > 30) AS gt_30
         FROM (
           SELECT
             DATEDIFF(CURDATE(), DATE(users.created_at)) AS age_days,
             EXISTS (
               SELECT 1 FROM user_page_events e
               WHERE e.username = users.username
                 AND (e.page_path LIKE '%purchase%' OR e.route_key LIKE '%track_purchase_%')
             ) AS visited_pay
           FROM users ${whereSql}
         ) t`,
        params
      );
      var r = rows && rows[0] ? rows[0] : {};
      function n(key) {
        return Number(r[key]) || 0;
      }
      res.json({
        code: 200,
        data: {
          threshold: HIGH_SELF_INCOME_THRESHOLD,
          definition:
            '未激活、未隐藏、非游客；至少一条未删除个税记录的本期收入或收入大于 15000；公司名含「示例」的记录不计入。',
          stock: {
            inactive_high_income: n('total'),
            visited_pay: n('visited_pay'),
            no_pay: n('no_pay'),
            in_7d: n('in_7d'),
            in_8_30: n('in_8_30'),
            gt_30: n('gt_30')
          }
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 解析转化 A/B 分组 */
function resolveConversionAbVariant(seed) {
  var s = String(seed || 'guest');
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2 === 0 ? 'a' : 'b';
}

/** 加载转化 A/B 配置 */
async function loadConversionAbParsed() {
  if (!pool) {
    return Object.assign({}, DEFAULT_CONVERSION_AB);
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1', [
      SETTING_KEY_CONVERSION_AB
    ]);
    if (!rows.length || rows[0].setting_value == null || String(rows[0].setting_value).trim() === '') {
      return Object.assign({}, DEFAULT_CONVERSION_AB);
    }
    var parsed = JSON.parse(String(rows[0].setting_value));
    var merged = Object.assign({}, DEFAULT_CONVERSION_AB, parsed && typeof parsed === 'object' ? parsed : {});
    if (merged.activate_subtitle_b === '30秒体验收入纳税明细') {
      merged.activate_subtitle_b = DEFAULT_CONVERSION_AB.activate_subtitle_b;
    }
    if (merged.activate_subtitle_a === '激活后可填写个税演示数据') {
      merged.activate_subtitle_a = DEFAULT_CONVERSION_AB.activate_subtitle_a;
    }
    return merged;
  } catch (e) {
    return Object.assign({}, DEFAULT_CONVERSION_AB);
  } finally {
    conn.release();
  }
}

/** 加载：landing ab parsed */
async function loadLandingAbParsed() {
  if (!pool) {
    return Object.assign({}, DEFAULT_LANDING_AB);
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1', [
      SETTING_KEY_LANDING_AB
    ]);
    var parsed = null;
    if (rows.length && rows[0].setting_value != null && String(rows[0].setting_value).trim() !== '') {
      parsed = JSON.parse(String(rows[0].setting_value));
    }
    var merged = Object.assign({}, DEFAULT_LANDING_AB, parsed && typeof parsed === 'object' ? parsed : {});
    var pct = parseInt(merged.c_percent, 10);
    merged.c_percent = isFinite(pct) ? Math.max(0, Math.min(100, pct)) : DEFAULT_LANDING_AB.c_percent;
    merged.enabled = merged.enabled !== false;
    return merged;
  } catch (e) {
    return Object.assign({}, DEFAULT_LANDING_AB);
  } finally {
    conn.release();
  }
}

/** 规范化销售代理配置 */
function normalizeSalesAgentConfig(raw) {
  var src = raw && typeof raw === 'object' ? raw : {};
  var qr = '';
  if (src.wechat_qr_url != null && String(src.wechat_qr_url).trim() !== '') {
    qr = sanitizeMineUiImageRef(String(src.wechat_qr_url).trim()) || '';
  }
  var xianyu = '';
  if (src.xianyu_text != null) {
    xianyu = sanitizeXianyuPurchaseText(src.xianyu_text);
  }
  return {
    display_name: String(src.display_name != null ? src.display_name : DEFAULT_SALES_AGENT.display_name)
      .trim()
      .substring(0, 64) || DEFAULT_SALES_AGENT.display_name,
    wechat_id: String(src.wechat_id != null ? src.wechat_id : '')
      .trim()
      .substring(0, 64),
    wechat_qr_url: qr,
    qq: String(src.qq != null ? src.qq : '')
      .trim()
      .substring(0, 32),
    phone: String(src.phone != null ? src.phone : '')
      .trim()
      .substring(0, 32),
    xianyu_text: xianyu
  };
}

/** 公开/管理端用的销售代理载荷 */
function salesAgentPublicPayload(cfg) {
  var c = normalizeSalesAgentConfig(cfg);
  var hasContact = !!(c.wechat_id || c.wechat_qr_url || c.qq || c.phone || c.xianyu_text);
  return {
    display_name: c.display_name,
    wechat_id: c.wechat_id,
    wechat_qr_url: c.wechat_qr_url,
    wechat_qr_display_url: resolvePublicAssetUrl(c.wechat_qr_url),
    qq: c.qq,
    phone: c.phone,
    xianyu_text: c.xianyu_text,
    has_contact: hasContact
  };
}

/** 加载：sales agent parsed */
async function loadSalesAgentParsed() {
  if (!pool) {
    return Object.assign({}, DEFAULT_SALES_AGENT);
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1', [
      SETTING_KEY_SALES_AGENT
    ]);
    var parsed = null;
    if (rows.length && rows[0].setting_value != null && String(rows[0].setting_value).trim() !== '') {
      parsed = JSON.parse(String(rows[0].setting_value));
    }
    return normalizeSalesAgentConfig(
      Object.assign({}, DEFAULT_SALES_AGENT, parsed && typeof parsed === 'object' ? parsed : {})
    );
  } catch (e) {
    return Object.assign({}, DEFAULT_SALES_AGENT);
  } finally {
    conn.release();
  }
}

/** 公开落地页 / 支付页 A/B/C 配置（分流统一由 pricing_ab 控制） */
async function handlePublicLandingAbConfig(req, res) {
  try {
    var abc = await getPricingAb().publicAbcConfig();
    return res.json({
      code: 200,
      data: {
        enabled: abc.enabled !== false,
        a_percent: abc.a_percent,
        b_percent: abc.b_percent,
        c_percent: abc.c_percent,
        /* 兼容旧落地页字段名：非 C 合计占比 */
        b_percent_landing: abc.a_percent + abc.b_percent,
        experiment: 'purchase_abc_v1',
        delegated: true
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 公开转化配置 */
async function handlePublicConversionConfig(req, res) {
  try {
    var cfg = await loadConversionAbParsed();
    var pricingCfg = await getPricingAb().loadPricingAbParsed();
    /* 定价 A/B 实验期暂停文案 A/B，避免交互干扰 */
    var enabled = cfg.enabled !== false && !(pricingCfg && pricingCfg.enabled);
    var seed = '';
    if (req.authUserId) {
      seed = String(req.authUserId);
    } else {
      try {
        if (req.clientDevicePayload && req.clientDevicePayload.client_id) {
          seed = String(req.clientDevicePayload.client_id);
        }
      } catch (e0) {}
    }
    var variant = resolveConversionAbVariant(seed);
    var nudge = await loadActivationNudgeParsed();
    return res.json({
      code: 200,
      data: {
        enabled: enabled,
        variant: variant,
        activate_title:
          variant === 'b' ? String(cfg.activate_title_b || '') : String(cfg.activate_title_a || ''),
        activate_subtitle:
          variant === 'b' ? String(cfg.activate_subtitle_b || '') : String(cfg.activate_subtitle_a || ''),
        batch_example_prominent: cfg.batch_example_prominent === true,
        paused_by_pricing_ab: !!(pricingCfg && pricingCfg.enabled),
        activation_nudge: {
          enabled: nudge.enabled !== false,
          title: String(nudge.title || ''),
          body: String(nudge.body || ''),
          cta_text: String(nudge.cta_text || ''),
          dismiss_text: String(nudge.dismiss_text || ''),
          link_url: String(nudge.link_url || 'purchase.html'),
          min_hours_since_register: Number(nudge.min_hours_since_register) || 0,
          max_per_day: Number(nudge.max_per_day) || 1
        }
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** funnel metrics sql aliases */
function funnelMetricsSqlAliases(userAlias) {
  var u = userAlias || 'u';
  return {
    activated7:
      'SUM(CASE WHEN EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = ' +
      u +
      '.username AND ac.last_used_at IS NOT NULL AND ' +
      userActivationStatsEligibleSql(u + '.username') +
      ' AND TIMESTAMPDIFF(HOUR, ' +
      u +
      '.created_at, ac.last_used_at) BETWEEN 0 AND 168) THEN 1 ELSE 0 END)',
    tax7:
      'SUM(CASE WHEN EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = ' +
      u +
      '.username AND tr.deleted_at IS NULL AND TIMESTAMPDIFF(HOUR, ' +
      u +
      '.created_at, tr.created_at) BETWEEN 0 AND 168) THEN 1 ELSE 0 END)',
    detail7:
      'SUM(CASE WHEN EXISTS (SELECT 1 FROM user_page_events e WHERE e.username = ' +
      u +
      '.username AND (e.page_path LIKE \'%shuiming%\' OR e.page_path LIKE \'%xiangqing%\') AND TIMESTAMPDIFF(HOUR, ' +
      u +
      '.created_at, e.created_at) BETWEEN 0 AND 168) THEN 1 ELSE 0 END)'
  };
}

/** 分渠道注册漏斗 */
async function handleAdminChannelRegistrationFunnel(req, res) {
  try {
    var period = parseAnalyticsPeriod(req.query.days, 90);
    var cnUserDay = 'DATE(DATE_ADD(u.created_at, INTERVAL 8 HOUR))';
    var pf = analyticsPeriodCnDateFilter(cnUserDay, period);
    var fm = funnelMetricsSqlAliases('u');

    const conn = await pool.getConnection();
    try {
      var where = [pf.sql];
      var params = pf.params.slice();
      appendAdminUserScope(where, params, req.admin, 'u.username');
      var whereSql = ' WHERE ' + where.join(' AND ');

      const [rows] = await conn.query(
        `SELECT COALESCE(NULLIF(TRIM(u.register_source_channel), ''), '__empty__') AS ch,
                COUNT(*) AS registered,
                ${fm.activated7} AS activated_7d,
                ${fm.tax7} AS tax_7d,
                ${fm.detail7} AS viewed_detail_7d
         FROM users u` +
          whereSql +
          ' GROUP BY ch ORDER BY registered DESC',
        params
      );

      function pct(n, d) {
        if (!d || d <= 0) return null;
        return (Math.round((n / d) * 1000) / 10).toFixed(1) + '%';
      }

      var items = (rows || []).map(function (r) {
        var reg = Number(r.registered) || 0;
        var a7 = Number(r.activated_7d) || 0;
        var t7 = Number(r.tax_7d) || 0;
        var v7 = Number(r.viewed_detail_7d) || 0;
        var ch = String(r.ch || '');
        return {
          channel: ch,
          channel_label: ch === '__empty__' ? '未填写渠道' : registerSourceChannelLabel(ch),
          registered: reg,
          activated_7d: a7,
          tax_7d: t7,
          viewed_detail_7d: v7,
          rate_activate_7d_pct: pct(a7, reg),
          rate_tax_7d_pct: pct(t7, reg),
          rate_detail_7d_pct: pct(v7, reg)
        };
      });

      res.json({
        code: 200,
        data: Object.assign({ items: items }, conversionAnalyticsPeriodMeta(period))
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** activation funnel metrics sql aliases */
function activationFunnelMetricsSqlAliases(userAlias, actAlias) {
  var u = userAlias || 'u';
  var ac = actAlias || 'ac';
  return {
    tax7AfterActivate:
      'SUM(CASE WHEN EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = ' +
      u +
      '.username AND tr.deleted_at IS NULL AND TIMESTAMPDIFF(HOUR, ' +
      ac +
      '.last_used_at, tr.created_at) BETWEEN 0 AND 168) THEN 1 ELSE 0 END)',
    detail7AfterActivate:
      'SUM(CASE WHEN EXISTS (SELECT 1 FROM user_page_events e WHERE e.username = ' +
      u +
      '.username AND (e.page_path LIKE \'%shuiming%\' OR e.page_path LIKE \'%xiangqing%\') AND TIMESTAMPDIFF(HOUR, ' +
      ac +
      '.last_used_at, e.created_at) BETWEEN 0 AND 168) THEN 1 ELSE 0 END)'
  };
}

/** 分渠道激活漏斗 */
async function handleAdminActivationChannelFunnel(req, res) {
  try {
    var period = parseAnalyticsPeriod(req.query.days, 90);
    var cnActDay = 'DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR))';
    var pf = analyticsPeriodCnDateFilter(cnActDay, period);
    var fm = activationFunnelMetricsSqlAliases('u', 'ac');

    const conn = await pool.getConnection();
    try {
      var where = [pf.sql, userActivationStatsEligibleSql('u.username')];
      var params = pf.params.slice();
      appendAdminUserScope(where, params, req.admin, 'u.username');
      var whereSql = ' WHERE ' + where.join(' AND ');

      const [rows] = await conn.query(
        `SELECT COALESCE(NULLIF(TRIM(u.activation_source_channel), ''), '__empty__') AS ch,
                COUNT(DISTINCT u.username) AS activated,
                ${fm.tax7AfterActivate} AS tax_7d,
                ${fm.detail7AfterActivate} AS viewed_detail_7d
         FROM users u
         INNER JOIN activation_codes ac ON ac.used_by_username = u.username
           AND ac.last_used_at IS NOT NULL
         ` +
          whereSql +
          ' GROUP BY ch ORDER BY activated DESC',
        params
      );

      function pct(n, d) {
        if (!d || d <= 0) return null;
        return (Math.round((n / d) * 1000) / 10).toFixed(1) + '%';
      }

      var items = (rows || []).map(function (r) {
        var act = Number(r.activated) || 0;
        var t7 = Number(r.tax_7d) || 0;
        var v7 = Number(r.viewed_detail_7d) || 0;
        var ch = String(r.ch || '');
        return {
          channel: ch,
          channel_label: ch === '__empty__' ? '未标记激活来源' : activationSourceChannelLabel(ch),
          activated: act,
          tax_7d: t7,
          viewed_detail_7d: v7,
          rate_tax_7d_pct: pct(t7, act),
          rate_detail_7d_pct: pct(v7, act)
        };
      });

      res.json({
        code: 200,
        data: Object.assign({ items: items }, conversionAnalyticsPeriodMeta(period))
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 安装引导统计 */
async function handleAdminInstallGuideStats(req, res) {
  try {
    var period = parseAnalyticsPeriod(req.query.days, 90);
    var cnDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
    var pf = analyticsPeriodCnDateFilter(cnDay, period);
    var cnSince = pf.sql;
    var sinceParams = pf.params.slice();
    const conn = await pool.getConnection();
    try {
      const [viewRows] = await conn.query(
        `SELECT COUNT(DISTINCT COALESCE(NULLIF(TRIM(ip), ''), NULLIF(client_id, ''), device_fp)) AS pv,
                COUNT(DISTINCT COALESCE(NULLIF(TRIM(ip), ''), NULLIF(client_id, ''), device_fp)) AS uv
         FROM install_guide_track_events
         WHERE event_key = 'track_install_page_view' AND ${cnSince}`,
        sinceParams
      );
      const [leaveRows] = await conn.query(
        `SELECT COUNT(*) AS leave_cnt, AVG(dwell_seconds) AS avg_dwell
         FROM install_guide_track_events
         WHERE event_key = 'track_install_page_leave'
           AND dwell_seconds IS NOT NULL
           AND ${cnSince}`,
        sinceParams
      );
      const [dwellListRows] = await conn.query(
        `SELECT dwell_seconds
         FROM install_guide_track_events
         WHERE event_key = 'track_install_page_leave'
           AND dwell_seconds IS NOT NULL
           AND ${cnSince}
         ORDER BY dwell_seconds ASC`,
        sinceParams
      );
      const [actionRows] = await conn.query(
        `SELECT event_key, COUNT(*) AS total
         FROM install_guide_track_events
         WHERE event_key NOT IN (
           'track_install_page_view',
           'track_install_page_leave',
           'track_install_page_perf'
         )
           AND ${cnSince}
         GROUP BY event_key
         ORDER BY total DESC`,
        sinceParams
      );
      const [perfRows] = await conn.query(
        `SELECT meta_json, ${cnDay} AS d
         FROM install_guide_track_events
         WHERE event_key = 'track_install_page_perf'
           AND ${cnSince}`,
        sinceParams
      );
      const [landingAbRows] = await conn.query(
        `SELECT client_id, device_fp, event_key, dwell_seconds, meta_json, ip, ${cnDay} AS d, created_at
         FROM install_guide_track_events
         WHERE meta_json IS NOT NULL
           AND JSON_UNQUOTE(JSON_EXTRACT(meta_json, '$.landing_variant')) IN ('b', 'c')
           AND ${cnSince}`,
        sinceParams
      );
      const [landingAbRegisterRows] = await conn.query(
        `SELECT client_id, device_fp, ip, meta_json, created_at
         FROM install_guide_track_events
         WHERE event_key = 'track_install_register_success'
           AND ${cnSince}`,
        sinceParams
      );
      const [landingAbDownloadRows] = await conn.query(
        `SELECT client_id, device_fp, ip, meta_json, created_at
         FROM install_guide_track_events
         WHERE event_key IN ('track_install_apk_click', 'track_install_ios_click')
           AND ${cnSince}`,
        sinceParams
      );
      const [dailyRows] = await conn.query(
        `SELECT ${cnDay} AS d,
                COUNT(DISTINCT CASE
                  WHEN event_key = 'track_install_page_view'
                  THEN COALESCE(NULLIF(TRIM(ip), ''), NULLIF(client_id, ''), device_fp)
                END) AS page_views,
                COUNT(DISTINCT CASE
                  WHEN event_key = 'track_install_page_view'
                  THEN COALESCE(NULLIF(TRIM(ip), ''), NULLIF(client_id, ''), device_fp)
                END) AS unique_visitors,
                AVG(CASE WHEN event_key = 'track_install_page_leave' THEN dwell_seconds END) AS avg_dwell_seconds
         FROM install_guide_track_events
         WHERE ${cnSince}
         GROUP BY ${cnDay}
         ORDER BY d ASC`,
        sinceParams
      );
      var cnUserDay = 'DATE(DATE_ADD(u.created_at, INTERVAL 8 HOUR))';
      var userPf = analyticsPeriodCnDateFilter(cnUserDay, period);
      var cnUserSince = userPf.sql;
      var userSinceParams = userPf.params.slice();
      var cnHour = 'HOUR(DATE_ADD(created_at, INTERVAL 8 HOUR))';
      const [hourlyViewRows] = await conn.query(
        `SELECT ${cnHour} AS h,
                COUNT(DISTINCT COALESCE(NULLIF(TRIM(ip), ''), NULLIF(client_id, ''), device_fp)) AS pv,
                COUNT(DISTINCT COALESCE(NULLIF(TRIM(ip), ''), NULLIF(client_id, ''), device_fp)) AS uv
         FROM install_guide_track_events
         WHERE event_key = 'track_install_page_view' AND ${cnSince}
         GROUP BY ${cnHour}
         ORDER BY h ASC`,
        sinceParams
      );
      const [hourlyRegRows] = await conn.query(
        `SELECT HOUR(DATE_ADD(u.created_at, INTERVAL 8 HOUR)) AS h,
                COUNT(*) AS registered
         FROM users u
         WHERE ${cnUserSince} AND u.activation_refunded_at IS NULL
           AND COALESCE(u.user_type, 0) <> ${USER_TYPE_GUEST}
         GROUP BY h
         ORDER BY h ASC`,
        userSinceParams
      );
      const [regDailyRows] = await conn.query(
        `SELECT ${cnUserDay} AS d, COUNT(*) AS registered
         FROM users u
         WHERE ${cnUserSince} AND u.activation_refunded_at IS NULL
           AND COALESCE(u.user_type, 0) <> ${USER_TYPE_GUEST}
         GROUP BY ${cnUserDay}
         ORDER BY d ASC`,
        userSinceParams
      );
      const [regFromInstallRows] = await conn.query(
        `SELECT ${cnUserDay} AS d, COUNT(DISTINCT u.username) AS registered_from_install
         FROM users u
         WHERE ${cnUserSince} AND u.activation_refunded_at IS NULL
           AND COALESCE(u.user_type, 0) <> ${USER_TYPE_GUEST}
           AND (
             u.registered_from_install_guide = 1
             OR EXISTS (
               SELECT 1
               FROM user_devices ud
               INNER JOIN install_guide_track_events ig ON ig.event_key = 'track_install_page_view'
                 AND DATE(DATE_ADD(ig.created_at, INTERVAL 8 HOUR)) = ${cnUserDay}
                 AND (
                   (ig.device_fp IS NOT NULL AND ig.device_fp <> '' AND ig.device_fp = ud.device_fp)
                   OR (
                     ig.client_id IS NOT NULL AND ig.client_id <> ''
                     AND ud.client_id IS NOT NULL AND ud.client_id <> ''
                     AND ig.client_id = ud.client_id
                   )
                 )
               WHERE ud.username = u.username
             )
           )
         GROUP BY ${cnUserDay}
         ORDER BY d ASC`,
        userSinceParams
      );
      const [regFromInstallReportedRows] = await conn.query(
        `SELECT ${cnUserDay} AS d, COUNT(*) AS registered_from_install_reported
         FROM users u
         WHERE ${cnUserSince} AND u.activation_refunded_at IS NULL
           AND COALESCE(u.user_type, 0) <> ${USER_TYPE_GUEST}
           AND u.registered_from_install_guide = 1
         GROUP BY ${cnUserDay}
         ORDER BY d ASC`,
        userSinceParams
      );
      const [guestDailyRows] = await conn.query(
        `SELECT ${cnUserDay} AS d, COUNT(*) AS new_guests
         FROM users u
         WHERE ${guestOnlyUserSql('u')}
           AND ${cnUserSince}
         GROUP BY ${cnUserDay}
         ORDER BY d ASC`,
        userSinceParams
      );
      const cnGuestMergeDay = 'DATE(DATE_ADD(u.guest_merged_at, INTERVAL 8 HOUR))';
      var guestMergePf = analyticsPeriodCnDateFilter(cnGuestMergeDay, period);
      var cnGuestMergeSince = guestMergePf.sql;
      var guestMergeSinceParams = guestMergePf.params.slice();
      const [guestConvertedDailyRows] = await conn.query(
        `SELECT ${cnGuestMergeDay} AS d, COUNT(*) AS guest_converted
         FROM users u
         WHERE ${guestOnlyUserSql('u')}
           AND u.guest_merged_at IS NOT NULL
           AND ${cnGuestMergeSince}
         GROUP BY ${cnGuestMergeDay}
         ORDER BY d ASC`,
        guestMergeSinceParams
      );
      const [guestSumRows] = await conn.query(
        `SELECT
            COUNT(*) AS new_guests,
            SUM(CASE WHEN u.guest_merged_to IS NOT NULL AND TRIM(u.guest_merged_to) <> '' THEN 1 ELSE 0 END) AS guest_converted
         FROM users u
         WHERE ${guestOnlyUserSql('u')}
           AND ${cnUserSince}`,
        userSinceParams
      );
      const [recentRows] = await conn.query(
        `SELECT id, client_id, device_fp, event_key, dwell_seconds, meta_json, created_at, ip, user_agent
         FROM install_guide_track_events
         WHERE ${cnSince}
         ORDER BY created_at DESC
         LIMIT 300`,
        sinceParams
      );

      /* UV/漏斗去重：优先同一 IP（缓解清缓存换 client_id 刷高）；无 IP 再退回 client_id / device_fp */
      var visitorExpr = `COALESCE(NULLIF(TRIM(ip), ''), NULLIF(client_id, ''), device_fp)`;
      const [funnelStageRows] = await conn.query(
        `SELECT
            COUNT(DISTINCT CASE WHEN event_key = 'track_install_page_view' THEN ${visitorExpr} END) AS stage_a,
            COUNT(DISTINCT CASE WHEN event_key IN ('track_install_apk_click', 'track_install_ios_click') THEN ${visitorExpr} END) AS stage_b,
            COUNT(DISTINCT CASE WHEN event_key = 'track_app_first_open' THEN ${visitorExpr} END) AS stage_c,
            COUNT(DISTINCT CASE WHEN event_key = 'track_install_app_shell_register_prompt_show' THEN ${visitorExpr} END) AS stage_d,
            COUNT(DISTINCT CASE WHEN event_key = 'track_install_app_shell_register_prompt_later' THEN ${visitorExpr} END) AS stage_e_later,
            COUNT(DISTINCT CASE WHEN event_key = 'track_install_app_shell_register_prompt_ok' THEN ${visitorExpr} END) AS stage_e_ok,
            COUNT(DISTINCT CASE WHEN event_key = 'track_install_register_success' THEN ${visitorExpr} END) AS stage_f,
            COUNT(DISTINCT CASE
              WHEN event_key IN ('track_app_first_open', 'track_install_app_shell_register_prompt_show')
              THEN ${visitorExpr}
            END) AS stage_c_proxy
         FROM install_guide_track_events
         WHERE ${cnSince}
           AND ${visitorExpr} IS NOT NULL
           AND ${visitorExpr} <> ''`,
        sinceParams
      );

      /** 准口径：区间内有首次打开（无则回退弹窗展示），且同访客键（优先 IP）无注册成功 */
      const [openedUnregRows] = await conn.query(
        `SELECT
            base.visitor_id,
            base.first_at,
            base.last_at,
            base.ip,
            base.user_agent,
            base.open_events,
            base.prompt_shows,
            COALESCE(later.later_cnt, 0) AS later_cnt,
            COALESCE(ok_btn.ok_cnt, 0) AS ok_cnt
         FROM (
           SELECT
             ${visitorExpr} AS visitor_id,
             MIN(created_at) AS first_at,
             MAX(created_at) AS last_at,
             SUBSTRING_INDEX(GROUP_CONCAT(IFNULL(ip, '') ORDER BY created_at DESC SEPARATOR '|||'), '|||', 1) AS ip,
             SUBSTRING_INDEX(GROUP_CONCAT(IFNULL(user_agent, '') ORDER BY created_at DESC SEPARATOR '|||'), '|||', 1) AS user_agent,
             SUM(CASE WHEN event_key = 'track_app_first_open' THEN 1 ELSE 0 END) AS open_events,
             SUM(CASE WHEN event_key = 'track_install_app_shell_register_prompt_show' THEN 1 ELSE 0 END) AS prompt_shows
           FROM install_guide_track_events
           WHERE ${cnSince}
             AND ${visitorExpr} IS NOT NULL AND ${visitorExpr} <> ''
             AND event_key IN (
               'track_app_first_open',
               'track_install_app_shell_register_prompt_show'
             )
           GROUP BY ${visitorExpr}
         ) base
         LEFT JOIN (
           SELECT ${visitorExpr} AS visitor_id, COUNT(*) AS later_cnt
           FROM install_guide_track_events
           WHERE ${cnSince}
             AND ${visitorExpr} IS NOT NULL AND ${visitorExpr} <> ''
             AND event_key = 'track_install_app_shell_register_prompt_later'
           GROUP BY ${visitorExpr}
         ) later ON later.visitor_id = base.visitor_id
         LEFT JOIN (
           SELECT ${visitorExpr} AS visitor_id, COUNT(*) AS ok_cnt
           FROM install_guide_track_events
           WHERE ${cnSince}
             AND ${visitorExpr} IS NOT NULL AND ${visitorExpr} <> ''
             AND event_key = 'track_install_app_shell_register_prompt_ok'
           GROUP BY ${visitorExpr}
         ) ok_btn ON ok_btn.visitor_id = base.visitor_id
         WHERE NOT EXISTS (
           SELECT 1
           FROM install_guide_track_events reg
           WHERE reg.event_key = 'track_install_register_success'
             AND COALESCE(NULLIF(TRIM(reg.ip), ''), NULLIF(reg.client_id, ''), reg.device_fp) = base.visitor_id
         )
         ORDER BY base.last_at DESC
         LIMIT 10`,
        sinceParams.concat(sinceParams).concat(sinceParams)
      );

      /** 窄/宽/准口径计数（优先 IP 去重；浏览器下载与 App 打开仍可能因网络出口变化对不上） */
      const [downloadedUnregRows] = await conn.query(
        `SELECT COUNT(DISTINCT COALESCE(NULLIF(TRIM(dl.ip), ''), NULLIF(dl.client_id, ''), dl.device_fp)) AS cnt
         FROM install_guide_track_events dl
         WHERE ${cnSince}
           AND COALESCE(NULLIF(TRIM(dl.ip), ''), NULLIF(dl.client_id, ''), dl.device_fp) IS NOT NULL
           AND COALESCE(NULLIF(TRIM(dl.ip), ''), NULLIF(dl.client_id, ''), dl.device_fp) <> ''
           AND dl.event_key IN ('track_install_apk_click', 'track_install_ios_click')
           AND NOT EXISTS (
             SELECT 1 FROM install_guide_track_events reg
             WHERE reg.event_key = 'track_install_register_success'
               AND COALESCE(NULLIF(TRIM(reg.ip), ''), NULLIF(reg.client_id, ''), reg.device_fp)
                 = COALESCE(NULLIF(TRIM(dl.ip), ''), NULLIF(dl.client_id, ''), dl.device_fp)
           )`,
        sinceParams
      );
      const [downloadedNotOpenedRows] = await conn.query(
        `SELECT COUNT(DISTINCT COALESCE(NULLIF(TRIM(dl.ip), ''), NULLIF(dl.client_id, ''), dl.device_fp)) AS cnt
         FROM install_guide_track_events dl
         WHERE ${cnSince}
           AND COALESCE(NULLIF(TRIM(dl.ip), ''), NULLIF(dl.client_id, ''), dl.device_fp) IS NOT NULL
           AND COALESCE(NULLIF(TRIM(dl.ip), ''), NULLIF(dl.client_id, ''), dl.device_fp) <> ''
           AND dl.event_key IN ('track_install_apk_click', 'track_install_ios_click')
           AND NOT EXISTS (
             SELECT 1 FROM install_guide_track_events op
             WHERE COALESCE(NULLIF(TRIM(op.ip), ''), NULLIF(op.client_id, ''), op.device_fp)
                 = COALESCE(NULLIF(TRIM(dl.ip), ''), NULLIF(dl.client_id, ''), dl.device_fp)
               AND op.event_key IN (
                 'track_app_first_open',
                 'track_install_app_shell_register_prompt_show'
               )
           )`,
        sinceParams
      );
      const [openedUnregCountRows] = await conn.query(
        `SELECT COUNT(DISTINCT COALESCE(NULLIF(TRIM(op.ip), ''), NULLIF(op.client_id, ''), op.device_fp)) AS cnt
         FROM install_guide_track_events op
         WHERE ${cnSince}
           AND COALESCE(NULLIF(TRIM(op.ip), ''), NULLIF(op.client_id, ''), op.device_fp) IS NOT NULL
           AND COALESCE(NULLIF(TRIM(op.ip), ''), NULLIF(op.client_id, ''), op.device_fp) <> ''
           AND op.event_key IN (
             'track_app_first_open',
             'track_install_app_shell_register_prompt_show'
           )
           AND NOT EXISTS (
             SELECT 1 FROM install_guide_track_events reg
             WHERE reg.event_key = 'track_install_register_success'
               AND COALESCE(NULLIF(TRIM(reg.ip), ''), NULLIF(reg.client_id, ''), reg.device_fp)
                 = COALESCE(NULLIF(TRIM(op.ip), ''), NULLIF(op.client_id, ''), op.device_fp)
           )`,
        sinceParams
      );
      const [guestMigratedRows] = await conn.query(
        `SELECT COUNT(*) AS cnt,
                COUNT(DISTINCT COALESCE(NULLIF(TRIM(ip), ''), NULLIF(TRIM(client_id), ''))) AS uv
         FROM install_guide_track_events
         WHERE ${cnSince} AND event_key = 'track_guest_data_migrated'`,
        sinceParams
      );

      var pv = Number((viewRows[0] || {}).pv) || 0;
      var uv = Number((viewRows[0] || {}).uv) || 0;
      var leaveCnt = Number((leaveRows[0] || {}).leave_cnt) || 0;
      var avgDwell = Number((leaveRows[0] || {}).avg_dwell);
      var dwellVals = (dwellListRows || [])
        .map(function (r) {
          return Number(r.dwell_seconds);
        })
        .filter(function (n) {
          return isFinite(n);
        });
      var medianDwell = medianFromSortedNumbers(dwellVals);

      var domReadyVals = [];
      var packagesTotalVals = [];
      var packagesNetVals = [];
      var packagesRenderVals = [];
      var dailyPerfMap = {};
      (perfRows || []).forEach(function (row) {
        var perf = parseInstallGuidePerfMeta(row.meta_json);
        if (!perf) {
          return;
        }
        if (perf.dom_ready_ms != null) {
          domReadyVals.push(perf.dom_ready_ms);
        }
        if (perf.packages_total_ms != null) {
          packagesTotalVals.push(perf.packages_total_ms);
        }
        if (perf.packages_net_ms != null) {
          packagesNetVals.push(perf.packages_net_ms);
        }
        if (perf.packages_render_ms != null) {
          packagesRenderVals.push(perf.packages_render_ms);
        }
        var dk = formatDateKey(row.d);
        if (!dk) {
          return;
        }
        if (!dailyPerfMap[dk]) {
          dailyPerfMap[dk] = { dom: [], pkg: [] };
        }
        if (perf.dom_ready_ms != null) {
          dailyPerfMap[dk].dom.push(perf.dom_ready_ms);
        }
        if (perf.packages_total_ms != null) {
          dailyPerfMap[dk].pkg.push(perf.packages_total_ms);
        }
      });
      var domReadyStats = aggregateMsStats(domReadyVals);
      var packagesTotalStats = aggregateMsStats(packagesTotalVals);
      var packagesNetStats = aggregateMsStats(packagesNetVals);
      var packagesRenderStats = aggregateMsStats(packagesRenderVals);

      function newLandingVariantStats() {
        return {
          page_views: 0,
          visitors: {},
          download_visitors: {},
          register_visitors: {},
          gate_visitors: {},
          visit_days: {},
          dwell_values: []
        };
      }
      var landingAbRaw = {
        b: newLandingVariantStats(),
        c: newLandingVariantStats()
      };
      var landingVisitorVariant = {};
      var landingIpVariant = {};
      function rememberLandingVariant(visitor, ip, variant, atMs) {
        if (variant !== 'b' && variant !== 'c') return;
        var ts = atMs != null ? Number(atMs) : 0;
        if (visitor) {
          var prevV = landingVisitorVariant[visitor];
          if (!prevV || ts >= prevV.at) {
            landingVisitorVariant[visitor] = { variant: variant, at: ts };
          }
        }
        if (ip) {
          var prevIp = landingIpVariant[ip];
          if (!prevIp || ts >= prevIp.at) {
            landingIpVariant[ip] = { variant: variant, at: ts };
          }
        }
      }
      function resolveLandingVariantForStats(metaVariant, visitor, ip) {
        var direct = String(metaVariant || '').toLowerCase();
        if (direct === 'b' || direct === 'c') return direct;
        if (visitor && landingVisitorVariant[visitor]) {
          return landingVisitorVariant[visitor].variant;
        }
        if (ip && landingIpVariant[ip]) {
          return landingIpVariant[ip].variant;
        }
        return '';
      }
      function installGuideStatsPersonKey(row, extra) {
        var ip = String(row.ip || '').trim();
        if (ip) return 'ip:' + ip;
        var visitor = String(row.client_id || row.device_fp || '').trim();
        if (visitor) return 'id:' + visitor;
        if (extra) {
          var ex = String(extra).trim();
          if (ex) return 'x:' + ex;
        }
        return '';
      }
      (landingAbRows || []).forEach(function (row) {
        var meta = null;
        try {
          meta = JSON.parse(String(row.meta_json || '{}'));
        } catch (eAbMeta) {
          return;
        }
        var variant = String(meta.landing_variant || '').toLowerCase();
        if (variant !== 'b' && variant !== 'c') {
          return;
        }
        var stat = landingAbRaw[variant];
        var legacyVisitor = String(row.client_id || row.device_fp || '').trim();
        var ip = String(row.ip || '').trim();
        var person = installGuideStatsPersonKey(row);
        var eventKey = String(row.event_key || '');
        var dayKey = formatDateKey(row.d);
        var atMs = row.created_at ? new Date(row.created_at).getTime() : 0;
        if (
          eventKey === 'track_landing_ab_view' ||
          eventKey === 'track_landing_ab_assignment'
        ) {
          rememberLandingVariant(legacyVisitor, ip, variant, atMs);
        }
        if (eventKey === 'track_landing_ab_view') {
          stat.page_views += 1;
          if (person) {
            stat.visitors[person] = true;
            if (!stat.visit_days[person]) stat.visit_days[person] = {};
            if (dayKey) stat.visit_days[person][dayKey] = true;
          }
        }
        if (
          person &&
          (eventKey === 'track_landing_gate_open' || eventKey === 'track_landing_ab_guest_gate')
        ) {
          stat.gate_visitors[person] = true;
        }
        if (eventKey === 'track_install_page_leave' && row.dwell_seconds != null) {
          var dwell = Number(row.dwell_seconds);
          if (isFinite(dwell) && dwell >= 0 && dwell <= 86400) {
            stat.dwell_values.push(dwell);
          }
        }
      });
      /* 下载/注册：事件本身可能无 landing_variant（App 壳与浏览器隔离），用访客或 IP 回填；人数按 IP 去重 */
      (landingAbDownloadRows || []).forEach(function (row) {
        var meta = {};
        try {
          meta = JSON.parse(String(row.meta_json || '{}')) || {};
        } catch (eDlMeta) {}
        var legacyVisitor = String(row.client_id || row.device_fp || '').trim();
        var ip = String(row.ip || '').trim();
        var person = installGuideStatsPersonKey(row);
        var variant = resolveLandingVariantForStats(meta.landing_variant, legacyVisitor, ip);
        if ((variant !== 'b' && variant !== 'c') || !person) return;
        landingAbRaw[variant].download_visitors[person] = true;
      });
      (landingAbRegisterRows || []).forEach(function (row) {
        var meta = {};
        try {
          meta = JSON.parse(String(row.meta_json || '{}')) || {};
        } catch (eRegMeta) {}
        var legacyVisitor = String(row.client_id || row.device_fp || meta.username || '').trim();
        var ip = String(row.ip || '').trim();
        var person = installGuideStatsPersonKey(row, meta.username);
        var variant = resolveLandingVariantForStats(meta.landing_variant, legacyVisitor, ip);
        if ((variant !== 'b' && variant !== 'c') || !person) return;
        landingAbRaw[variant].register_visitors[person] = true;
      });

      function finishLandingVariantStats(variant, raw) {
        var uv = Object.keys(raw.visitors).length;
        var downloads = Object.keys(raw.download_visitors).length;
        var registers = Object.keys(raw.register_visitors).length;
        var gates = Object.keys(raw.gate_visitors).length;
        var returning = 0;
        Object.keys(raw.visit_days).forEach(function (visitor) {
          if (Object.keys(raw.visit_days[visitor]).length >= 2) {
            returning += 1;
          }
        });
        var dwell = raw.dwell_values.length
          ? raw.dwell_values.reduce(function (sum, n) { return sum + n; }, 0) / raw.dwell_values.length
          : null;
        return {
          variant: variant,
          label: variant === 'c' ? 'C · 全站游客模式' : 'B · 迷你产品首页',
          /* 页面浏览与 UV 一致：按同一 IP（无 IP 退回 client_id）去重 */
          page_views: uv,
          unique_visitors: uv,
          returning_visitors: returning,
          return_rate_pct: pctText(returning, uv),
          gate_visitors: gates,
          download_visitors: downloads,
          download_rate_pct: pctText(downloads, uv),
          registered_visitors: registers,
          register_rate_pct: pctText(registers, uv),
          avg_dwell_seconds: isFinite(dwell) ? Math.round(dwell) : null,
          avg_dwell_label: isFinite(dwell) ? formatStaySecondsLabel(dwell) : '—'
        };
      }

      var actions = (actionRows || []).map(function (r) {
        var ek = String(r.event_key || '');
        return {
          event_key: ek,
          label: installGuideEventLabel(ek),
          total: Number(r.total) || 0
        };
      });

      function pctText(n, d) {
        if (!d || d <= 0) return null;
        return (Math.round((n / d) * 1000) / 10).toFixed(1) + '%';
      }

      var regMap = {};
      (regDailyRows || []).forEach(function (r) {
        var k = formatDateKey(r.d);
        if (k) regMap[k] = Number(r.registered) || 0;
      });
      var regInstallMap = {};
      (regFromInstallRows || []).forEach(function (r) {
        var k = formatDateKey(r.d);
        if (k) regInstallMap[k] = Number(r.registered_from_install) || 0;
      });
      var regInstallReportedMap = {};
      (regFromInstallReportedRows || []).forEach(function (r) {
        var k = formatDateKey(r.d);
        if (k) regInstallReportedMap[k] = Number(r.registered_from_install_reported) || 0;
      });
      var guestDailyMap = {};
      (guestDailyRows || []).forEach(function (r) {
        var k = formatDateKey(r.d);
        if (k) guestDailyMap[k] = Number(r.new_guests) || 0;
      });
      var guestConvertedDailyMap = {};
      (guestConvertedDailyRows || []).forEach(function (r) {
        var k = formatDateKey(r.d);
        if (k) guestConvertedDailyMap[k] = Number(r.guest_converted) || 0;
      });
      var totalNewGuests = Number((guestSumRows[0] || {}).new_guests) || 0;
      var totalGuestConverted = Number((guestSumRows[0] || {}).guest_converted) || 0;

      var dailyMap = {};
      (dailyRows || []).forEach(function (r) {
        var dk = formatDateKey(r.d);
        if (!dk) return;
        var avg = Number(r.avg_dwell_seconds);
        var uv = Number(r.unique_visitors) || 0;
        var regAll = regMap[dk] || 0;
        var regInstall = regInstallMap[dk] || 0;
        var newGuests = guestDailyMap[dk] || 0;
        var guestConverted = guestConvertedDailyMap[dk] || 0;
        dailyMap[dk] = {
          date: dk,
          page_views: Number(r.page_views) || 0,
          unique_visitors: uv,
          avg_dwell_seconds: isFinite(avg) ? Math.round(avg) : null,
          avg_dwell_label: isFinite(avg) ? formatStaySecondsLabel(avg) : '—',
          registered: regAll,
          registered_from_install: regInstall,
          register_rate: uv > 0 ? regInstall / uv : null,
          register_rate_pct: pctText(regInstall, uv),
          register_rate_all: uv > 0 ? regAll / uv : null,
          register_rate_all_pct: pctText(regAll, uv),
          new_guests: newGuests,
          guest_converted: guestConverted,
          guest_register_rate_pct: pctText(guestConverted, newGuests),
          avg_dom_ready_label: '—',
          avg_packages_total_label: '—'
        };
        var dayPerf = dailyPerfMap[dk];
        if (dayPerf) {
          var dayDom = aggregateMsStats(dayPerf.dom);
          var dayPkg = aggregateMsStats(dayPerf.pkg);
          dailyMap[dk].avg_dom_ready_ms = dayDom.avg_ms;
          dailyMap[dk].avg_dom_ready_label = dayDom.avg_label;
          dailyMap[dk].avg_packages_total_ms = dayPkg.avg_ms;
          dailyMap[dk].avg_packages_total_label = dayPkg.avg_label;
        }
      });

      var todayKey = chinaDateKeyNow();
      var daily = [];
      var dateKeys =
        period.mode === 'range'
          ? dateKeysBetween(period.start, period.end)
          : chinaDateKeysForSpan(period.span + 1);
      dateKeys.forEach(function (key) {
        if (dailyMap[key]) {
          daily.push(dailyMap[key]);
        } else {
          var regAll0 = regMap[key] || 0;
          var regInstall0 = regInstallMap[key] || 0;
          var newGuests0 = guestDailyMap[key] || 0;
          var guestConverted0 = guestConvertedDailyMap[key] || 0;
          daily.push({
            date: key,
            page_views: 0,
            unique_visitors: 0,
            avg_dwell_seconds: null,
            avg_dwell_label: '—',
            registered: regAll0,
            registered_from_install: regInstall0,
            register_rate: null,
            register_rate_pct: regAll0 > 0 ? '—' : null,
            register_rate_all: null,
            register_rate_all_pct: regAll0 > 0 ? '—' : null,
            new_guests: newGuests0,
            guest_converted: guestConverted0,
            guest_register_rate_pct: pctText(guestConverted0, newGuests0)
          });
        }
      });

      var totalRegistered = 0;
      var totalRegisteredFromInstall = 0;
      var totalRegisteredFromInstallReported = 0;
      daily.forEach(function (row) {
        totalRegistered += row.registered || 0;
        totalRegisteredFromInstall += row.registered_from_install || 0;
      });
      Object.keys(regInstallReportedMap).forEach(function (k) {
        totalRegisteredFromInstallReported += regInstallReportedMap[k] || 0;
      });

      var recentVisitors = buildInstallGuideRecentVisitors(recentRows, 3);

      var funnelRaw = funnelStageRows[0] || {};
      var stageA = Number(funnelRaw.stage_a) || 0;
      var stageB = Number(funnelRaw.stage_b) || 0;
      var stageC = Number(funnelRaw.stage_c) || 0;
      var stageCProxy = Number(funnelRaw.stage_c_proxy) || 0;
      var stageD = Number(funnelRaw.stage_d) || 0;
      var stageELater = Number(funnelRaw.stage_e_later) || 0;
      var stageEOk = Number(funnelRaw.stage_e_ok) || 0;
      var stageF = Number(funnelRaw.stage_f) || 0;
      /** C 用 first_open ∪ 注册弹窗，避免上线初期 first_open 样本少导致后续转化率虚高 */
      var stageCEffective = stageCProxy > 0 ? stageCProxy : stageC;
      function funnelStep(key, label, count, prevCount) {
        return {
          key: key,
          label: label,
          visitors: count,
          rate_from_prev: prevCount != null && prevCount > 0 ? count / prevCount : null,
          rate_from_prev_pct: prevCount != null ? pctText(count, prevCount) : null,
          rate_from_a: stageA > 0 ? count / stageA : null,
          rate_from_a_pct: pctText(count, stageA)
        };
      }
      var downloadRegisterFunnel = {
        definition:
          '按访客键对齐（优先同一 IP 去重，无 IP 再退回 client_id / device_fp），北京时间。C=App 首次打开 ∪ 注册弹窗展示（过渡期兼容）；纯 first_open 见 stage_c_raw。浏览器下载与 App 壳网络出口不一致时 B→C 仍可能对不上。',
        stages: [
          funnelStep('A', '到过落地页', stageA, null),
          funnelStep('B', '点了下载', stageB, stageA),
          funnelStep(
            'C',
            stageC > 0 && stageC < stageCProxy
              ? '装上并打开（含弹窗代理）'
              : '装上并打开',
            stageCEffective,
            stageB
          ),
          funnelStep('D', '弹了注册窗', stageD, stageCEffective),
          funnelStep('E_later', '弹窗-稍后', stageELater, stageD),
          funnelStep('E_ok', '弹窗-去注册', stageEOk, stageD),
          funnelStep('F', '注册成功', stageF, stageCEffective)
        ],
        rates: {
          download_rate_pct: pctText(stageB, stageA),
          open_rate_pct: pctText(stageCEffective, stageB),
          register_from_open_pct: pctText(stageF, stageCEffective),
          later_rate_pct: pctText(stageELater, stageD),
          ok_rate_pct: pctText(stageEOk, stageD)
        },
        cohorts: {
          opened_unregistered: Number((openedUnregCountRows[0] || {}).cnt) || 0,
          downloaded_unregistered: Number((downloadedUnregRows[0] || {}).cnt) || 0,
          downloaded_not_opened: Number((downloadedNotOpenedRows[0] || {}).cnt) || 0,
          guest_data_migrated: Number((guestMigratedRows[0] || {}).cnt) || 0,
          guest_data_migrated_uv: Number((guestMigratedRows[0] || {}).uv) || 0,
          definitions: {
            opened_unregistered: '准口径：区间内有首次打开/注册弹窗，且同 IP（无则同 client_id）从未 track_install_register_success',
            downloaded_unregistered: '窄口径：区间内有下载点击，同 IP（无则同 client_id）无注册成功',
            downloaded_not_opened: '宽口径：区间内有下载点击，同 IP（无则同 client_id）无打开/弹窗（多为未装成或归因断链）',
            guest_data_migrated: '游客沙盒数据合并至正式账号次数（track_guest_data_migrated）'
          }
        },
        opened_unregistered_queue: (openedUnregRows || []).map(function (r) {
          return {
            visitor_id: String(r.visitor_id || ''),
            visitor_key: truncateInstallGuideVisitorKey(r.visitor_id),
            first_at: r.first_at ? r.first_at.toISOString() : '',
            last_at: r.last_at ? r.last_at.toISOString() : '',
            ip: r.ip ? String(r.ip) : '',
            device_label: installGuideDeviceSummaryFromUa(r.user_agent),
            user_agent: r.user_agent ? String(r.user_agent).substring(0, 400) : '',
            open_events: Number(r.open_events) || 0,
            prompt_shows: Number(r.prompt_shows) || 0,
            later_cnt: Number(r.later_cnt) || 0,
            ok_cnt: Number(r.ok_cnt) || 0
          };
        }),
        stage_c_raw: stageC,
        stage_c_proxy: stageCProxy,
        using_c_proxy: stageC < stageCProxy
      };

      var hourPv = [];
      var hourUv = [];
      var hourReg = [];
      var hi;
      for (hi = 0; hi < 24; hi++) {
        hourPv.push(0);
        hourUv.push(0);
        hourReg.push(0);
      }
      (hourlyViewRows || []).forEach(function (r) {
        var h = Number(r.h);
        if (h >= 0 && h < 24) {
          hourPv[h] = Number(r.pv) || 0;
          hourUv[h] = Number(r.uv) || 0;
        }
      });
      (hourlyRegRows || []).forEach(function (r) {
        var h = Number(r.h);
        if (h >= 0 && h < 24) {
          hourReg[h] = Number(r.registered) || 0;
        }
      });
      function sumHourRange(arr, from, to) {
        var s = 0;
        for (var i = from; i <= to; i++) {
          s += arr[i] || 0;
        }
        return s;
      }
      var totalHourPv = sumHourRange(hourPv, 0, 23);
      function withHourPct(rows, totalBase) {
        return rows.map(function (row) {
          var cnt = Number(row.page_views) || 0;
          var pct = totalBase > 0 ? Math.round((cnt / totalBase) * 1000) / 10 : 0;
          return Object.assign({}, row, {
            pct: pct,
            pct_text: totalBase > 0 ? pct.toFixed(1) + '%' : '—'
          });
        });
      }
      var hourDetailBuckets = withHourPct(
        [
          {
            key: 'late_night',
            label: '凌晨',
            range: '00:00-05:59',
            page_views: sumHourRange(hourPv, 0, 5),
            unique_visitors: sumHourRange(hourUv, 0, 5),
            registered: sumHourRange(hourReg, 0, 5)
          },
          {
            key: 'morning',
            label: '上午',
            range: '06:00-11:59',
            page_views: sumHourRange(hourPv, 6, 11),
            unique_visitors: sumHourRange(hourUv, 6, 11),
            registered: sumHourRange(hourReg, 6, 11)
          },
          {
            key: 'afternoon',
            label: '下午',
            range: '12:00-17:59',
            page_views: sumHourRange(hourPv, 12, 17),
            unique_visitors: sumHourRange(hourUv, 12, 17),
            registered: sumHourRange(hourReg, 12, 17)
          },
          {
            key: 'evening',
            label: '晚上',
            range: '18:00-23:59',
            page_views: sumHourRange(hourPv, 18, 23),
            unique_visitors: sumHourRange(hourUv, 18, 23),
            registered: sumHourRange(hourReg, 18, 23)
          }
        ],
        totalHourPv
      );
      /* 与明细一致：凌晨 / 上午 / 下午 / 晚上 */
      var hourPeriods = hourDetailBuckets.slice();
      var peakHourPeriod = null;
      hourPeriods.forEach(function (p) {
        if (!peakHourPeriod || p.page_views > peakHourPeriod.page_views) {
          peakHourPeriod = p;
        }
      });
      var byHour = [];
      for (hi = 0; hi < 24; hi++) {
        byHour.push({
          hour: hi,
          label: (hi < 10 ? '0' : '') + hi + ':00',
          page_views: hourPv[hi],
          unique_visitors: hourUv[hi],
          registered: hourReg[hi],
          pct: totalHourPv > 0 ? Math.round((hourPv[hi] / totalHourPv) * 1000) / 10 : 0
        });
      }

      res.json({
        code: 200,
        data: Object.assign(
          {
            summary: {
              page_views: pv,
              unique_visitors: uv,
              leave_events: leaveCnt,
              avg_dwell_seconds: isFinite(avgDwell) ? Math.round(avgDwell) : null,
              avg_dwell_label: isFinite(avgDwell) ? formatStaySecondsLabel(avgDwell) : '—',
              median_dwell_seconds: medianDwell != null ? medianDwell : null,
              median_dwell_label: medianDwell != null ? formatStaySecondsLabel(medianDwell) : '—',
              load_samples: domReadyStats.count || packagesTotalStats.count || 0,
              avg_dom_ready_ms: domReadyStats.avg_ms,
              avg_dom_ready_label: domReadyStats.avg_label,
              median_dom_ready_ms: domReadyStats.median_ms,
              median_dom_ready_label: domReadyStats.median_label,
              avg_packages_total_ms: packagesTotalStats.avg_ms,
              avg_packages_total_label: packagesTotalStats.avg_label,
              median_packages_total_ms: packagesTotalStats.median_ms,
              median_packages_total_label: packagesTotalStats.median_label,
              avg_packages_net_ms: packagesNetStats.avg_ms,
              avg_packages_net_label: packagesNetStats.avg_label,
              avg_packages_render_ms: packagesRenderStats.avg_ms,
              avg_packages_render_label: packagesRenderStats.avg_label,
              registered: totalRegistered,
              registered_from_install: totalRegisteredFromInstall,
              registered_from_install_reported: totalRegisteredFromInstallReported,
              register_rate: uv > 0 ? totalRegisteredFromInstall / uv : null,
              register_rate_pct: pctText(totalRegisteredFromInstall, uv),
              register_rate_all: uv > 0 ? totalRegistered / uv : null,
              register_rate_all_pct: pctText(totalRegistered, uv),
              new_guests: totalNewGuests,
              guest_converted: totalGuestConverted,
              guest_register_rate_pct: pctText(totalGuestConverted, totalNewGuests)
            },
            actions: actions,
            landing_ab: {
              definition:
                '页面浏览/UV/下载/注册人数按同一 IP 去重（无 IP 再退回 client_id），避免清缓存换访客 ID 刷高。注册/下载方案优先用事件自带值，否则按同访客或同 IP 近 48h 的 B/C 访问回填。注册用户=安装页引流注册成功，不等于全站总注册（见上方「当日总注册」）。回访用户=区间内至少 2 个自然日访问同一方案。',
              variants: [
                finishLandingVariantStats('b', landingAbRaw.b),
                finishLandingVariantStats('c', landingAbRaw.c)
              ]
            },
            daily: daily,
            hourly: {
              timezone: 'Asia/Shanghai (UTC+8)',
              total_page_views: totalHourPv,
              periods: hourPeriods,
              detail_buckets: hourDetailBuckets,
              peak_period: peakHourPeriod
                ? {
                    key: peakHourPeriod.key,
                    label: peakHourPeriod.label,
                    page_views: peakHourPeriod.page_views,
                    unique_visitors: peakHourPeriod.unique_visitors,
                    registered: peakHourPeriod.registered,
                    pct_text: peakHourPeriod.pct_text
                  }
                : null,
              by_hour: byHour
            },
            recent_visitors: recentVisitors,
            download_register_funnel: downloadRegisterFunnel
          },
          conversionAnalyticsPeriodMeta(period)
        )
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 安装页埋点是否 abc 渠道（只认 meta.sales_ch / ch，与账号绑定无关） */
function abcInstallTrackMetaSql(alias) {
  var col = alias ? String(alias) + '.meta_json' : 'meta_json';
  return (
    '(LOWER(TRIM(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(' +
    col +
    ", '$.sales_ch')), ''))) = 'abc' OR LOWER(TRIM(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(" +
    col +
    ", '$.ch')), ''))) = 'abc')"
  );
}

/** ABC 渠道下载页：浏览与下载 */
async function handleAdminAbcInstallStats(req, res) {
  try {
    var period = parseAnalyticsPeriod(req.query.days, 90);
    var cnDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
    var pf = analyticsPeriodCnDateFilter(cnDay, period);
    var sinceSql = pf.sql;
    var sinceParams = pf.params.slice();
    var abcSql = abcInstallTrackMetaSql('');
    var visitorExpr = "COALESCE(NULLIF(TRIM(ip), ''), NULLIF(client_id, ''), device_fp)";
    var cnHour = 'HOUR(DATE_ADD(created_at, INTERVAL 8 HOUR))';
    var downloadKeys = "event_key IN ('track_install_apk_click', 'track_install_ios_click')";
    const conn = await pool.getConnection();
    try {
      const [sumRows] = await conn.query(
        `SELECT
            COUNT(CASE WHEN event_key = 'track_install_page_view' THEN 1 END) AS view_pv,
            COUNT(DISTINCT CASE WHEN event_key = 'track_install_page_view' THEN ${visitorExpr} END) AS view_uv,
            COUNT(CASE WHEN event_key = 'track_install_apk_click' THEN 1 END) AS apk_clicks,
            COUNT(DISTINCT CASE WHEN event_key = 'track_install_apk_click' THEN ${visitorExpr} END) AS apk_uv,
            COUNT(CASE WHEN event_key = 'track_install_ios_click' THEN 1 END) AS ios_clicks,
            COUNT(DISTINCT CASE WHEN event_key = 'track_install_ios_click' THEN ${visitorExpr} END) AS ios_uv,
            COUNT(CASE WHEN ${downloadKeys} THEN 1 END) AS download_clicks,
            COUNT(DISTINCT CASE WHEN ${downloadKeys} THEN ${visitorExpr} END) AS download_uv
         FROM install_guide_track_events
         WHERE ${sinceSql} AND ${abcSql}`,
        sinceParams
      );
      const [dailyRows] = await conn.query(
        `SELECT ${cnDay} AS d,
                COUNT(CASE WHEN event_key = 'track_install_page_view' THEN 1 END) AS view_pv,
                COUNT(DISTINCT CASE WHEN event_key = 'track_install_page_view' THEN ${visitorExpr} END) AS view_uv,
                COUNT(CASE WHEN event_key = 'track_install_apk_click' THEN 1 END) AS apk_clicks,
                COUNT(CASE WHEN event_key = 'track_install_ios_click' THEN 1 END) AS ios_clicks,
                COUNT(CASE WHEN ${downloadKeys} THEN 1 END) AS download_clicks,
                COUNT(DISTINCT CASE WHEN ${downloadKeys} THEN ${visitorExpr} END) AS download_uv
         FROM install_guide_track_events
         WHERE ${sinceSql} AND ${abcSql}
         GROUP BY ${cnDay}
         ORDER BY d ASC`,
        sinceParams
      );
      const [hourlyRows] = await conn.query(
        `SELECT ${cnHour} AS h,
                COUNT(DISTINCT CASE WHEN event_key = 'track_install_page_view' THEN ${visitorExpr} END) AS view_uv,
                COUNT(DISTINCT CASE WHEN ${downloadKeys} THEN ${visitorExpr} END) AS download_uv,
                COUNT(CASE WHEN event_key = 'track_install_page_view' THEN 1 END) AS view_pv,
                COUNT(CASE WHEN ${downloadKeys} THEN 1 END) AS download_clicks
         FROM install_guide_track_events
         WHERE ${sinceSql} AND ${abcSql}
         GROUP BY ${cnHour}
         ORDER BY h ASC`,
        sinceParams
      );
      const [recentRows] = await conn.query(
        `SELECT id, event_key, created_at, ip, client_id, user_agent, meta_json
         FROM install_guide_track_events
         WHERE ${sinceSql} AND ${abcSql}
           AND event_key IN (
             'track_install_page_view',
             'track_install_apk_click',
             'track_install_ios_click'
           )
         ORDER BY created_at DESC
         LIMIT 40`,
        sinceParams
      );
      var sum = sumRows[0] || {};
      var viewPv = Number(sum.view_pv) || 0;
      var viewUv = Number(sum.view_uv) || 0;
      var apkClicks = Number(sum.apk_clicks) || 0;
      var apkUv = Number(sum.apk_uv) || 0;
      var iosClicks = Number(sum.ios_clicks) || 0;
      var iosUv = Number(sum.ios_uv) || 0;
      var dlClicks = Number(sum.download_clicks) || 0;
      var dlUv = Number(sum.download_uv) || 0;
      var daily = (dailyRows || []).map(function (r) {
        return {
          date: formatDateKey(r.d),
          view_pv: Number(r.view_pv) || 0,
          view_uv: Number(r.view_uv) || 0,
          apk_clicks: Number(r.apk_clicks) || 0,
          ios_clicks: Number(r.ios_clicks) || 0,
          download_clicks: Number(r.download_clicks) || 0,
          download_uv: Number(r.download_uv) || 0
        };
      });
      var hourMap = {};
      (hourlyRows || []).forEach(function (r) {
        hourMap[Number(r.h)] = r;
      });
      var byHour = [];
      for (var h = 0; h < 24; h++) {
        var hr = hourMap[h] || {};
        byHour.push({
          hour: h,
          view_uv: Number(hr.view_uv) || 0,
          view_pv: Number(hr.view_pv) || 0,
          download_uv: Number(hr.download_uv) || 0,
          download_clicks: Number(hr.download_clicks) || 0
        });
      }
      var recent = (recentRows || []).map(function (r) {
        var key = String(r.event_key || '');
        return {
          id: r.id,
          event_key: key,
          event_label: INSTALL_GUIDE_EVENT_LABELS[key] || key,
          created_at: r.created_at,
          ip: r.ip || '',
          client_id: r.client_id || '',
          user_agent: r.user_agent ? String(r.user_agent).substring(0, 180) : ''
        };
      });
      res.json({
        code: 200,
        data: Object.assign(
          {
            channel: 'abc',
            definition:
              '只统计安装下载页埋点 meta.sales_ch=abc（用户打开的 URL 带 ?ch=abc 或 ABC 渠道包）。按 IP 优先去重 UV；浏览次数为原始 PV。下载含 Android 安装包与 iOS 描述文件点击。',
            landing_url: 'install_guide.html?ch=abc',
            summary: {
              view_pv: viewPv,
              view_uv: viewUv,
              download_clicks: dlClicks,
              download_uv: dlUv,
              download_rate_pct: pctRateText(dlUv, viewUv),
              apk_clicks: apkClicks,
              apk_uv: apkUv,
              ios_clicks: iosClicks,
              ios_uv: iosUv
            },
            daily: daily,
            hourly: { timezone: 'Asia/Shanghai (UTC+8)', by_hour: byHour },
            recent: recent
          },
          conversionAnalyticsPeriodMeta(period)
        )
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 安装追踪统计 */
async function handleAdminInstallTrackStats(req, res) {
  try {
    var period = parseAnalyticsPeriod(req.query.days, 90);
    var pf = analyticsPeriodStatDateFilter(period);
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        `SELECT route_key, SUM(cnt) AS total
         FROM analytics_api_daily
         WHERE ${pf.sql}
           AND (
             route_key LIKE '%track_install_%'
             OR route_key = 'EVENT register_success'
           )
         GROUP BY route_key
         ORDER BY total DESC`,
        pf.params
      );
      var labelMap = {
        'POST /api/auth#track_install_apk_click': 'Android 安装包点击',
        'POST auth.php#track_install_apk_click': 'Android 安装包点击',
        'POST /api/auth#track_install_ios_click': 'iOS 描述文件点击',
        'POST auth.php#track_install_ios_click': 'iOS 描述文件点击',
        'POST /api/auth#track_install_ios_video_play': '苹果安装视频播放',
        'POST auth.php#track_install_ios_video_play': '苹果安装视频播放',
        'POST /api/auth#track_install_usage_video_play': '操作视频播放',
        'POST auth.php#track_install_usage_video_play': '操作视频播放',
        'POST /api/auth#track_app_first_open': 'App 首次打开',
        'POST auth.php#track_app_first_open': 'App 首次打开',
        'POST /api/auth#track_tutorial_video_play': '操作教程视频播放',
        'POST auth.php#track_tutorial_video_play': '操作教程视频播放',
        'POST /api/auth#track_tutorial_prompt_show': '操作教程弹窗展示',
        'POST auth.php#track_tutorial_prompt_show': '操作教程弹窗展示',
        'POST /api/auth#track_tutorial_prompt_watch_click': '操作教程弹窗-观看',
        'POST auth.php#track_tutorial_prompt_watch_click': '操作教程弹窗-观看',
        'POST /api/auth#track_tutorial_prompt_dismiss': '操作教程弹窗-关闭',
        'POST auth.php#track_tutorial_prompt_dismiss': '操作教程弹窗-关闭',
        'EVENT register_success': '注册成功'
      };
      var items = (rows || []).map(function (r) {
        var rk = String(r.route_key || '');
        return {
          route_key: rk,
          label: labelMap[rk] || rk,
          total: Number(r.total) || 0
        };
      });
      res.json({
        code: 200,
        data: Object.assign({ items: items }, conversionAnalyticsPeriodMeta(period))
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** C 端页面加载性能（track_page_load_perf） */
async function handleAdminPageLoadPerfStats(req, res) {
  try {
    var period = parseAnalyticsPeriod(req.query.days, 14);
    var cnDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
    var pf = analyticsPeriodCnDateFilter(cnDay, period);
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        `SELECT meta_json, user_agent, ${cnDay} AS d, created_at
         FROM install_guide_track_events
         WHERE event_key = 'track_page_load_perf'
           AND ${pf.sql}
         ORDER BY created_at DESC
         LIMIT 8000`,
        pf.params
      );
      var byPage = {};
      var byPlatformPage = {};
      var recent = [];
      (rows || []).forEach(function (row) {
        var perf = parsePageLoadPerfMeta(row.meta_json);
        if (!perf) {
          return;
        }
        var pg = perf.page || 'unknown';
        if (!byPage[pg]) {
          byPage[pg] = {
            page: pg,
            total: 0,
            android: 0,
            ios: 0,
            cordova: 0,
            dom: [],
            load: [],
            fcp: [],
            ttfb: []
          };
        }
        var bucket = byPage[pg];
        bucket.total += 1;
        if (perf.platform === 'android') {
          bucket.android += 1;
        } else if (perf.platform === 'ios') {
          bucket.ios += 1;
        }
        if (perf.cordova) {
          bucket.cordova += 1;
        }
        if (perf.dom_ready_ms != null) {
          bucket.dom.push(perf.dom_ready_ms);
        }
        if (perf.load_ms != null) {
          bucket.load.push(perf.load_ms);
        }
        if (perf.fcp_ms != null) {
          bucket.fcp.push(perf.fcp_ms);
        }
        if (perf.ttfb_ms != null) {
          bucket.ttfb.push(perf.ttfb_ms);
        }
        var platKey = pg + '|' + (perf.platform || 'other');
        if (!byPlatformPage[platKey]) {
          byPlatformPage[platKey] = {
            page: pg,
            platform: perf.platform || 'other',
            dom: []
          };
        }
        if (perf.dom_ready_ms != null) {
          byPlatformPage[platKey].dom.push(perf.dom_ready_ms);
        }
        if (recent.length < 40) {
          recent.push({
            page: pg,
            platform: perf.platform || 'other',
            device_model: perf.device_model || '',
            cordova: perf.cordova ? 1 : 0,
            dom_ready_ms: perf.dom_ready_ms,
            fcp_ms: perf.fcp_ms,
            load_ms: perf.load_ms,
            load_label: formatPageLoadPerfLabel(perf),
            at: row.created_at,
            user_agent: row.user_agent || ''
          });
        }
      });
      var summary = Object.keys(byPage)
        .map(function (k) {
          var b = byPage[k];
          return {
            page: b.page,
            samples: b.total,
            android: b.android,
            ios: b.ios,
            cordova: b.cordova,
            dom_ready: aggregateMsStats(b.dom),
            load: aggregateMsStats(b.load),
            fcp: aggregateMsStats(b.fcp),
            ttfb: aggregateMsStats(b.ttfb)
          };
        })
        .sort(function (a, b) {
          return b.samples - a.samples || String(a.page).localeCompare(String(b.page));
        });
      var byPlatform = Object.keys(byPlatformPage)
        .map(function (k) {
          var b = byPlatformPage[k];
          return {
            page: b.page,
            platform: b.platform,
            samples: b.dom.length,
            dom_ready: aggregateMsStats(b.dom)
          };
        })
        .filter(function (row) {
          return row.samples > 0;
        })
        .sort(function (a, b) {
          return b.samples - a.samples || String(a.page).localeCompare(String(b.page));
        });
      res.json({
        code: 200,
        data: Object.assign(
          {
            summary: summary,
            by_platform: byPlatform,
            recent: recent
          },
          conversionAnalyticsPeriodMeta(period)
        )
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}


/** 净化站内信跳转链接（仅相对页或本站 https） */
function sanitizeInAppMessageLink(raw) {
  var s = raw != null ? String(raw).trim() : '';
  if (!s) return 'purchase.html';
  /* 允许站内相对路径带 query（如 refund_ad.html?from=msg_refund） */
  if (/^[a-zA-Z0-9_./?=&\-%]+$/.test(s) && s.indexOf('..') < 0 && !/^[a-zA-Z]+:/.test(s)) {
    return s.substring(0, 200);
  }
  if (/^https:\/\/(www\.)?geshui\.vip(\/|$)/i.test(s)) {
    return s.substring(0, 500);
  }
  return 'purchase.html';
}

/** 组装运营站内信正文（含可选跳转标记） */
function buildOpsMessageContent(bodyText, linkUrl) {
  var body = bodyText != null ? String(bodyText).trim() : '';
  if (body.length > 4000) body = body.substring(0, 4000);
  var link = sanitizeInAppMessageLink(linkUrl);
  if (body.indexOf('【前往激活】') < 0) {
    body = body + (body ? '\n\n' : '') + '【前往激活】';
  }
  return body + '\n@@link:' + link;
}

/** 加载激活引导弹窗配置 */
async function loadActivationNudgeParsed() {
  if (!pool) {
    return Object.assign({}, DEFAULT_ACTIVATION_NUDGE);
  }
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1', [
      SETTING_KEY_ACTIVATION_NUDGE
    ]);
    if (!rows.length || rows[0].setting_value == null || String(rows[0].setting_value).trim() === '') {
      return Object.assign({}, DEFAULT_ACTIVATION_NUDGE);
    }
    var parsed = JSON.parse(String(rows[0].setting_value));
    var merged = Object.assign({}, DEFAULT_ACTIVATION_NUDGE, parsed && typeof parsed === 'object' ? parsed : {});
    merged.enabled = merged.enabled !== false;
    merged.title = String(merged.title || DEFAULT_ACTIVATION_NUDGE.title).substring(0, 80);
    merged.body = String(merged.body || DEFAULT_ACTIVATION_NUDGE.body).substring(0, 400);
    merged.cta_text = String(merged.cta_text || DEFAULT_ACTIVATION_NUDGE.cta_text).substring(0, 40);
    merged.dismiss_text = String(merged.dismiss_text || DEFAULT_ACTIVATION_NUDGE.dismiss_text).substring(0, 40);
    merged.link_url = sanitizeInAppMessageLink(merged.link_url);
    var minH = parseInt(merged.min_hours_since_register, 10);
    merged.min_hours_since_register = isFinite(minH) ? Math.max(0, Math.min(720, minH)) : 24;
    var maxD = parseInt(merged.max_per_day, 10);
    merged.max_per_day = isFinite(maxD) ? Math.max(1, Math.min(5, maxD)) : 1;
    return merged;
  } catch (e) {
    return Object.assign({}, DEFAULT_ACTIVATION_NUDGE);
  } finally {
    conn.release();
  }
}

/** 保存激活引导弹窗配置 */
async function saveActivationNudgeFromAdmin(bodyObj) {
  var prev = await loadActivationNudgeParsed();
  var inc = bodyObj && typeof bodyObj === 'object' ? bodyObj : {};
  var merged = Object.assign({}, prev);
  if (inc.enabled === true || inc.enabled === false) merged.enabled = inc.enabled === true;
  if (inc.title != null) merged.title = String(inc.title).substring(0, 80);
  if (inc.body != null) merged.body = String(inc.body).substring(0, 400);
  if (inc.cta_text != null) merged.cta_text = String(inc.cta_text).substring(0, 40);
  if (inc.dismiss_text != null) merged.dismiss_text = String(inc.dismiss_text).substring(0, 40);
  if (inc.link_url != null) merged.link_url = sanitizeInAppMessageLink(inc.link_url);
  if (inc.min_hours_since_register != null) {
    var minH = parseInt(inc.min_hours_since_register, 10);
    if (isFinite(minH)) merged.min_hours_since_register = Math.max(0, Math.min(720, minH));
  }
  if (inc.max_per_day != null) {
    var maxD = parseInt(inc.max_per_day, 10);
    if (isFinite(maxD)) merged.max_per_day = Math.max(1, Math.min(5, maxD));
  }
  const conn = await pool.getConnection();
  try {
    await upsertAppSetting(conn, SETTING_KEY_ACTIVATION_NUDGE, JSON.stringify(merged));
  } finally {
    conn.release();
  }
  return merged;
}

/** 写入单用户自动站内信（按 marker 去重，仅未激活非游客） */
async function insertAutoInAppMessageIfNew(userId, opts) {
  opts = opts || {};
  if (!pool || userId == null || String(userId).trim() === '') {
    return { sent: false };
  }
  var uid = String(userId).trim();
  if (uid.indexOf('__guest_') === 0) {
    return { sent: false };
  }
  var marker = opts.marker != null ? String(opts.marker).trim() : '';
  if (!marker) {
    return { sent: false };
  }
  var title = opts.title != null ? String(opts.title).trim() : '';
  var body = opts.body != null ? String(opts.body).trim() : '';
  if (!title || !body) {
    return { sent: false };
  }
  if (title.length > 120) title = title.substring(0, 120);
  const conn = await pool.getConnection();
  try {
    const [userRows] = await conn.execute(
      'SELECT account_active, activation_kind, active_until, user_type FROM users WHERE username = ? LIMIT 1',
      [uid]
    );
    if (!userRows.length) {
      return { sent: false };
    }
    var row = userRows[0];
    if (rowUserTypeIsGuest(row)) {
      return { sent: false };
    }
    if (isUserEffectivelyActive(row)) {
      return { sent: false };
    }
    const [exists] = await conn.execute(
      'SELECT 1 FROM messages WHERE user_id = ? AND company_name = ? AND content LIKE ? LIMIT 1',
      [uid, MSG_COMPANY_SYSTEM_NOTICE, '%' + marker + '%']
    );
    if (exists.length) {
      return { sent: false, duplicate: true };
    }
    var linkUrl = sanitizeInAppMessageLink(opts.linkUrl || 'purchase.html');
    var fullContent = buildOpsMessageContent(body, linkUrl);
    if (fullContent.indexOf(marker) < 0) {
      fullContent = fullContent + '\n' + marker;
    }
    var idPrefix = opts.idPrefix != null ? String(opts.idPrefix) : 'auto';
    var mid = 'msg_' + idPrefix + '_' + Date.now().toString(36);
    var msgDate = new Date().toISOString().slice(0, 10);
    await conn.execute(
      'INSERT INTO messages (id, user_id, title, content, company_name, msg_date, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)',
      [mid, uid, title, fullContent, MSG_COMPANY_SYSTEM_NOTICE, msgDate]
    );
    invalidateMessageListCache(uid);
    return { sent: true, id: mid };
  } catch (e) {
    console.error('insertAutoInAppMessageIfNew', e);
    return { sent: false, error: String(e.message) };
  } finally {
    conn.release();
  }
}

function queueAutoTaxDoneMessage(userId) {
  if (!ACTIVATION_INBOX_PROMO_ENABLED) {
    return;
  }
  insertAutoInAppMessageIfNew(userId, {
    marker: MSG_AUTO_TAX_DONE_MARKER,
    title: MSG_AUTO_TAX_DONE_TITLE,
    body: MSG_AUTO_TAX_DONE_BODY,
    linkUrl: 'purchase.html?from=msg_tax_done',
    idPrefix: 'auto_tax'
  })
    .then(function (r) {
      if (r && r.sent) {
        console.log('[auto-msg-tax-done] sent user=' + userId);
      }
    })
    .catch(function (e) {
      console.error('[auto-msg-tax-done] failed', e);
    });
}

function queueAutoPurchaseExitMessage(userId) {
  if (!ACTIVATION_INBOX_PROMO_ENABLED) {
    return;
  }
  insertAutoInAppMessageIfNew(userId, {
    marker: MSG_AUTO_PURCHASE_EXIT_MARKER,
    title: MSG_AUTO_PURCHASE_EXIT_TITLE,
    body: MSG_AUTO_PURCHASE_EXIT_BODY,
    linkUrl: 'purchase.html?from=msg_purchase_exit',
    idPrefix: 'auto_purchase'
  })
    .then(function (r) {
      if (r && r.sent) {
        console.log('[auto-msg-purchase-exit] sent user=' + userId);
      }
    })
    .catch(function (e) {
      console.error('[auto-msg-purchase-exit] failed', e);
    });
}

/** 有个税记录后尝试发送自动站内信（异步，不阻塞主流程） */
function maybeQueueAutoTaxDoneMessage(userId) {
  if (!pool || userId == null || String(userId).trim() === '') {
    return;
  }
  var uid = String(userId).trim();
  pool
    .execute('SELECT COUNT(*) AS c FROM tax_records WHERE user_id = ? AND deleted_at IS NULL', [uid])
    .then(function (result) {
      var rows = result && result[0];
      var c = Number(rows && rows[0] && rows[0].c) || 0;
      if (c < 1) return;
      queueAutoTaxDoneMessage(uid);
    })
    .catch(function (e) {
      console.error('maybeQueueAutoTaxDoneMessage', e);
    });
}

/** 日活 activity_date 与 users.created_at 均为 UTC（touch 时写 CURDATE） */
function userRegD1DateSql(alias) {
  var t = alias || 'users';
  return 'DATE_ADD(DATE(' + t + '.created_at), INTERVAL 1 DAY)';
}

/** 注册次日有日活 */
function userHasD1DailyActivitySql(alias) {
  var t = alias || 'users';
  return (
    'EXISTS (SELECT 1 FROM user_daily_activity d1a WHERE d1a.username = ' +
    t +
    '.username AND d1a.activity_date = ' +
    userRegD1DateSql(t) +
    ')'
  );
}

/** 注册次日之后仍有日活 */
function userHasDailyActivityAfterD1Sql(alias) {
  var t = alias || 'users';
  return (
    'EXISTS (SELECT 1 FROM user_daily_activity d1b WHERE d1b.username = ' +
    t +
    '.username AND d1b.activity_date > ' +
    userRegD1DateSql(t) +
    ')'
  );
}

/** mode: has=有次日日活；only=有次日日活且之后再无日活 */
function appendD1ReturnActivityFilters(mode, alias, where) {
  if (mode !== 'has' && mode !== 'only') return;
  where.push(userHasD1DailyActivitySql(alias));
  if (mode === 'only') {
    where.push('NOT ' + userHasDailyActivityAfterD1Sql(alias));
  }
}

/** 群发受众 SQL 条件 */
function appendBulkMsgAudienceFilters(audience, where, params) {
  where.push(nonGuestUsernameSql('u.username'));
  if (!require('../admin/opsConversion').isRefundBulkAudience(audience)) {
    where.push('(u.account_active IS NULL OR u.account_active = 0)');
  }
  if (audience === 'pending_activate_24h') {
    where.push('TIMESTAMPDIFF(HOUR, u.created_at, UTC_TIMESTAMP()) >= 24');
  } else if (audience === 'inactive_has_tax') {
    where.push(
      'EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = u.username AND tr.deleted_at IS NULL)'
    );
  } else if (audience === 'inactive_no_tax') {
    where.push(
      'NOT EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = u.username AND tr.deleted_at IS NULL)'
    );
  } else if (audience === 'inactive_visited_purchase') {
    where.push(
      "EXISTS (SELECT 1 FROM user_page_events e WHERE e.username = u.username AND (e.page_path LIKE '%purchase%' OR e.route_key LIKE '%track_purchase_%'))"
    );
  } else if (audience === 'inactive_purchase_no_pay') {
    where.push(
      "EXISTS (SELECT 1 FROM user_page_events e WHERE e.username = u.username AND e.route_key LIKE '%track_purchase_page_view%')"
    );
    where.push(
      "NOT EXISTS (SELECT 1 FROM user_page_events e WHERE e.username = u.username AND (e.route_key LIKE '%track_alipay_payment_success%' OR e.route_key LIKE '%track_purchase_activate_success%'))"
    );
  } else if (audience === 'inactive_has_d1') {
    appendD1ReturnActivityFilters('has', 'u', where);
  } else if (audience === 'inactive_d1_only') {
    appendD1ReturnActivityFilters('only', 'u', where);
  } else if (audience === 'inactive_high_income') {
    where.push(userHasSelfFilledHighIncomeSql('u.username', HIGH_SELF_INCOME_THRESHOLD));
  } else if (require('../admin/opsConversion').isRefundBulkAudience(audience)) {
    require('../admin/opsConversion').appendRefundBulkAudienceFilters(audience, where);
  }
}

/**
 * 未激活用户站内信群发（管理端 / 定时任务共用）
 * opts: { audience, title, content, linkUrl, dryRun, skipAlreadySent, skipMarker, allowPartial, admin, idPrefix }
 */
async function sendInactiveUserMessages(opts) {
  opts = opts || {};
  var audience = opts.audience != null ? String(opts.audience).trim() : 'pending_activate_24h';
  if (!BULK_MSG_AUDIENCE_SET[audience]) {
    var audErr = new Error('audience 须为 ' + Object.keys(BULK_MSG_AUDIENCE_SET).join('、'));
    audErr.code = 400;
    throw audErr;
  }
  var title = opts.title != null ? String(opts.title).trim() : '';
  var content = opts.content != null ? String(opts.content).trim() : '';
  var dryRun = opts.dryRun === true;
  var skipAlreadySent = opts.skipAlreadySent === true;
  var skipMarker = opts.skipMarker != null ? String(opts.skipMarker).trim() : '';
  if (skipAlreadySent && !skipMarker) skipMarker = MSG_AUTO_ACT24_MARKER;
  var allowPartial = opts.allowPartial === true;
  if (!dryRun) {
    if (!title) {
      var titleErr = new Error('请填写标题');
      titleErr.code = 400;
      throw titleErr;
    }
    if (!content) {
      var contentErr = new Error('请填写正文');
      contentErr.code = 400;
      throw contentErr;
    }
  }
  if (title.length > 120) title = title.substring(0, 120);
  var linkUrl = sanitizeInAppMessageLink(opts.linkUrl || 'purchase.html');
  var fullContent = '';
  if (!dryRun) {
    fullContent = buildOpsMessageContent(content, linkUrl);
    if (skipAlreadySent && skipMarker && fullContent.indexOf(skipMarker) < 0) {
      fullContent = fullContent + '\n' + skipMarker;
    }
  }

  var where = [];
  var params = [];
  appendBulkMsgAudienceFilters(audience, where, params);
  if (skipAlreadySent && skipMarker) {
    where.push(
      'NOT EXISTS (SELECT 1 FROM messages m WHERE m.user_id = u.username AND m.company_name = ? AND m.content LIKE ?)'
    );
    params.push(MSG_COMPANY_SYSTEM_NOTICE, '%' + skipMarker + '%');
  }
  if (opts.admin) {
    appendAdminUserScope(where, params, opts.admin, 'u.username');
  }
  var whereSql = ' WHERE ' + where.join(' AND ');

  const conn = await pool.getConnection();
  try {
    const [countRows] = await conn.query(
      'SELECT COUNT(*) AS total FROM users u' + whereSql,
      params
    );
    var total = Number(countRows[0] && countRows[0].total) || 0;
    if (dryRun) {
      return {
        dry_run: true,
        audience: audience,
        matched: total,
        max: MSG_BULK_MAX_USERS,
        skip_already_sent: skipAlreadySent
      };
    }
    if (total <= 0) {
      return { sent: 0, matched: 0, audience: audience, skip_already_sent: skipAlreadySent };
    }
    if (total > MSG_BULK_MAX_USERS && !allowPartial) {
      var err = new Error(
        '匹配用户 ' + total + ' 人，超过单次上限 ' + MSG_BULK_MAX_USERS + '，请缩小范围或分批'
      );
      err.code = 400;
      throw err;
    }

    const [userRows] = await conn.query(
      'SELECT u.username FROM users u' + whereSql + ' ORDER BY u.created_at DESC LIMIT ?',
      params.concat([MSG_BULK_MAX_USERS])
    );
    var usernames = (userRows || [])
      .map(function (r) {
        return r.username != null ? String(r.username) : '';
      })
      .filter(Boolean);
    var msgDate = new Date().toISOString().slice(0, 10);
    var idPrefix = opts.idPrefix != null ? String(opts.idPrefix) : 'bulk';
    var batchId = idPrefix + '_' + Date.now().toString(36);
    var sent = 0;
    var i;
    for (i = 0; i < usernames.length; i += MSG_BULK_INSERT_CHUNK) {
      var chunk = usernames.slice(i, i + MSG_BULK_INSERT_CHUNK);
      var placeholders = [];
      var values = [];
      chunk.forEach(function (uname, j) {
        var mid = 'msg_' + batchId + '_' + (i + j);
        placeholders.push('(?, ?, ?, ?, ?, ?, 0)');
        values.push(mid, uname, title, fullContent, MSG_COMPANY_SYSTEM_NOTICE, msgDate);
      });
      await conn.query(
        'INSERT INTO messages (id, user_id, title, content, company_name, msg_date, is_read) VALUES ' +
          placeholders.join(', '),
        values
      );
      chunk.forEach(function (uname) {
        invalidateMessageListCache(uname);
      });
      sent += chunk.length;
    }
    return {
      sent: sent,
      matched: total,
      audience: audience,
      batch_id: batchId,
      link_url: linkUrl,
      skip_already_sent: skipAlreadySent
    };
  } finally {
    conn.release();
  }
}

/**
 * 未激活用户站内信群发
 * audience: pending_activate_24h | all_inactive
 */
async function handleAdminMessagesBulk(req, res) {
  try {
    var body = req.body || {};
    var dryRun = body.dry_run === true || body.dry_run === 1 || body.dry_run === '1';
    var result = await sendInactiveUserMessages({
      audience: body.audience != null ? String(body.audience).trim() : 'pending_activate_24h',
      title: body.title != null ? String(body.title).trim() : '',
      content: body.content != null ? String(body.content).trim() : '',
      linkUrl: body.link_url || 'purchase.html',
      dryRun: dryRun,
      skipAlreadySent: body.skip_already_sent === true || body.skip_already_sent === 1 || body.skip_already_sent === '1',
      skipMarker: body.skip_marker != null ? String(body.skip_marker).trim() : '',
      allowPartial: body.allow_partial === true || body.allow_partial === 1 || body.allow_partial === '1',
      admin: req.admin,
      idPrefix: 'bulk'
    });
    return res.json({ code: 200, data: result });
  } catch (e) {
    if (e && e.code === 400) {
      return res.status(400).json({ code: 400, msg: String(e.message) });
    }
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/**
 * 已留邮箱用户群发邮件（SMTP）
 */
async function handleAdminEmailsBulk(req, res) {
  try {
    var body = req.body || {};
    var dryRun = body.dry_run === true || body.dry_run === 1 || body.dry_run === '1';
    var result = await getUserEmailBulk().sendBulk({
      audience: body.audience != null ? String(body.audience).trim() : 'has_email_inactive',
      subject: body.subject != null ? String(body.subject).trim() : body.title != null ? String(body.title).trim() : '',
      content: body.content != null ? String(body.content).trim() : '',
      linkUrl: body.link_url || 'purchase.html',
      poster: body.poster != null ? String(body.poster).trim() : body.poster_key != null ? String(body.poster_key).trim() : '',
      ctaLabel: body.cta_label != null ? String(body.cta_label).trim() : '',
      benefits: body.benefits != null ? String(body.benefits).trim() : '',
      dryRun: dryRun,
      skipAlreadySent:
        body.skip_already_sent === true || body.skip_already_sent === 1 || body.skip_already_sent === '1',
      campaign: body.campaign != null ? String(body.campaign).trim() : '',
      allowPartial: body.allow_partial === true || body.allow_partial === 1 || body.allow_partial === '1',
      admin: req.admin
    });
    return res.json({ code: 200, data: result });
  } catch (e) {
    if (e && e.code === 400) {
      return res.status(400).json({ code: 400, msg: String(e.message) });
    }
    console.error('[admin emails bulk]', e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 已留邮箱用户列表 */
async function handleAdminEmailsUsers(req, res) {
  try {
    var q = req.query || {};
    var result = await getUserEmailBulk().listUsers({
      page: q.page,
      limit: q.limit,
      q: q.q,
      active: q.active,
      admin: req.admin
    });
    return res.json({ code: 200, data: result });
  } catch (e) {
    console.error('[admin emails users]', e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 邮件发送记录 */
async function handleAdminEmailsSends(req, res) {
  try {
    var q = req.query || {};
    var result = await getUserEmailBulk().listSends({
      page: q.page,
      limit: q.limit,
      q: q.q,
      username: q.username,
      admin: req.admin
    });
    return res.json({ code: 200, data: result });
  } catch (e) {
    console.error('[admin emails sends]', e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 邮件 campaign 近 N 天成功/失败率 */
async function handleAdminEmailsCampaignStats(req, res) {
  try {
    var q = req.query || {};
    var result = await getUserEmailBulk().campaignStats({
      campaign: q.campaign,
      days: q.days,
      admin: req.admin
    });
    return res.json({ code: 200, data: result });
  } catch (e) {
    console.error('[admin emails campaign-stats]', e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 向勾选用户发送邮件 */
async function handleAdminEmailsSend(req, res) {
  try {
    var body = req.body || {};
    var dryRun = body.dry_run === true || body.dry_run === 1 || body.dry_run === '1';
    var usernames = body.usernames;
    if (!Array.isArray(usernames) && body.username != null) {
      usernames = [body.username];
    }
    var result = await getUserEmailBulk().sendToUsernames({
      usernames: usernames,
      subject:
        body.subject != null
          ? String(body.subject).trim()
          : body.title != null
            ? String(body.title).trim()
            : '',
      content: body.content != null ? String(body.content).trim() : '',
      linkUrl: body.link_url || 'purchase.html',
      poster: body.poster != null ? String(body.poster).trim() : body.poster_key != null ? String(body.poster_key).trim() : '',
      ctaLabel: body.cta_label != null ? String(body.cta_label).trim() : '',
      benefits: body.benefits != null ? String(body.benefits).trim() : '',
      dryRun: dryRun,
      admin: req.admin
    });
    return res.json({ code: 200, data: result });
  } catch (e) {
    if (e && e.code === 400) {
      return res.status(400).json({ code: 400, msg: String(e.message) });
    }
    console.error('[admin emails send]', e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 清空用户邮箱 */
async function handleAdminEmailsClear(req, res) {
  try {
    var body = req.body || {};
    var result = await getUserEmailBulk().clearUserEmail({
      username: body.username,
      admin: req.admin
    });
    return res.json({ code: 200, data: result });
  } catch (e) {
    if (e && (e.code === 400 || e.code === 404)) {
      return res.status(e.code).json({ code: e.code, msg: String(e.message) });
    }
    console.error('[admin emails clear]', e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 定时：注册超 24h 未激活用户站内信推广（每人最多一封自动信） */
var _activationInboxPromoRunning = false;
async function runActivationInboxPromo(reason) {
  if (!ACTIVATION_INBOX_PROMO_ENABLED || !pool || _activationInboxPromoRunning) {
    return null;
  }
  _activationInboxPromoRunning = true;
  try {
    var result = await sendInactiveUserMessages({
      audience: 'pending_activate_24h',
      title: MSG_AUTO_ACT24_TITLE,
      content: MSG_AUTO_ACT24_BODY,
      linkUrl: 'purchase.html',
      dryRun: false,
      skipAlreadySent: true,
      idPrefix: 'auto_act24'
    });
    if (result && result.sent > 0) {
      console.log(
        '[activation-inbox-promo] ' +
          reason +
          ' sent=' +
          result.sent +
          ' matched=' +
          result.matched +
          ' batch=' +
          result.batch_id
      );
    } else {
      console.log(
        '[activation-inbox-promo] ' +
          reason +
          ' sent=0 matched=' +
          (result && result.matched != null ? result.matched : 0)
      );
    }
    return result;
  } catch (e) {
    console.error('[activation-inbox-promo] failed', e);
    return null;
  } finally {
    _activationInboxPromoRunning = false;
  }
}

function scheduleActivationInboxPromo() {
  if (!ACTIVATION_INBOX_PROMO_ENABLED) {
    console.log('[activation-inbox-promo] disabled (ACTIVATION_INBOX_PROMO_ENABLED=0)');
    return;
  }
  var intervalMs = Math.max(60 * 60 * 1000, ACTIVATION_INBOX_PROMO_INTERVAL_MS || 6 * 60 * 60 * 1000);
  setTimeout(function () {
    runActivationInboxPromo('startup');
  }, 90 * 1000);
  setInterval(function () {
    runActivationInboxPromo('interval');
  }, intervalMs);
  console.log(
    '[activation-inbox-promo] scheduled interval_ms=' + intervalMs + ' (注册超24h未激活，自动去重)'
  );
}

/** 定时：未激活用户推二次退税站内信；已留邮箱每 24h 发一封带可退税额的邮件 */
var _refundAdPromoRunning = false;
async function runRefundAdPromo(reason) {
  if (!REFUND_AD_PROMO_ENABLED || !pool || _refundAdPromoRunning) {
    return null;
  }
  _refundAdPromoRunning = true;
  try {
    var inbox = await sendInactiveUserMessages({
      audience: 'all_inactive',
      title: MSG_AUTO_REFUND_AD_TITLE,
      content: MSG_AUTO_REFUND_AD_BODY,
      linkUrl: 'refund_ad.html?from=msg_refund',
      dryRun: false,
      skipAlreadySent: true,
      skipMarker: MSG_AUTO_REFUND_AD_MARKER,
      allowPartial: true,
      idPrefix: 'auto_refund'
    });
    if (inbox && inbox.sent > 0) {
      console.log(
        '[refund-ad-promo] inbox ' +
          reason +
          ' sent=' +
          inbox.sent +
          ' matched=' +
          inbox.matched +
          ' batch=' +
          inbox.batch_id
      );
    } else {
      console.log(
        '[refund-ad-promo] inbox ' +
          reason +
          ' sent=0 matched=' +
          (inbox && inbox.matched != null ? inbox.matched : 0)
      );
    }
    var mailer = getUserEmailBulk();
    if (mailer && mail.isMailConfigured && mail.isMailConfigured()) {
      var email = await mailer.sendBulk({
        audience: 'has_email_inactive',
        campaign: 'refund_ad_amount',
        personalizeRefundAmount: true,
        skipHours: REFUND_AD_EMAIL_SKIP_HOURS,
        poster: 'refund',
        dryRun: false,
        skipAlreadySent: true,
        allowPartial: true
      });
      if (email && (email.sent > 0 || email.skipped > 0 || email.failed > 0)) {
        console.log(
          '[refund-ad-promo] email ' +
            reason +
            ' sent=' +
            email.sent +
            ' failed=' +
            (email.failed || 0) +
            ' skipped=' +
            (email.skipped || 0) +
            ' matched=' +
            email.matched
        );
      } else {
        console.log(
          '[refund-ad-promo] email ' +
            reason +
            ' sent=0 matched=' +
            (email && email.matched != null ? email.matched : 0)
        );
      }
    } else {
      console.log('[refund-ad-promo] email skipped (SMTP 未配置)');
    }
    return { inbox: inbox };
  } catch (e) {
    console.error('[refund-ad-promo] failed', e);
    return null;
  } finally {
    _refundAdPromoRunning = false;
  }
}

function scheduleRefundAdPromo() {
  if (!REFUND_AD_PROMO_ENABLED) {
    console.log('[refund-ad-promo] disabled (REFUND_AD_PROMO_ENABLED=0)');
    return;
  }
  var intervalMs = Math.max(60 * 60 * 1000, REFUND_AD_PROMO_INTERVAL_MS || 6 * 60 * 60 * 1000);
  setTimeout(function () {
    runRefundAdPromo('startup');
  }, 90 * 1000);
  setInterval(function () {
    runRefundAdPromo('interval');
  }, intervalMs);
  console.log(
    '[refund-ad-promo] scheduled interval_ms=' +
      intervalMs +
      ' (未激活站内信；已留邮箱每 ' +
      REFUND_AD_EMAIL_SKIP_HOURS +
      'h 发可退税额邮件)'
  );
}
/** 注册时段分布 */
async function handleAdminRegisterTimeDistribution(req, res) {
  try {
    var period = parseAnalyticsPeriod(req.query.days, 365);
    var cnCreated = 'DATE_ADD(users.created_at, INTERVAL 8 HOUR)';
    var pf = analyticsPeriodCnDateFilter('DATE(' + cnCreated + ')', period);
    var where = pf.sql + ' AND ' + nonGuestUsernameSql('users.username');
    var params = pf.params.slice();

    if (!req.admin || !req.admin.is_super) {
      var regScope = [];
      appendSubAdminOwnedUsersScopeForAdmin(regScope, params, req.admin, 'users.username');
      if (regScope.length) where += ' AND ' + regScope.join(' AND ');
    }

    const conn = await pool.getConnection();
    try {
      const [hourRows] = await conn.query(
        'SELECT HOUR(' +
          cnCreated +
          ') AS h, COUNT(*) AS cnt FROM users WHERE ' +
          where +
          ' GROUP BY h ORDER BY h',
        params
      );

      var hourCounts = [];
      var i;
      for (i = 0; i < 24; i++) {
        hourCounts.push(0);
      }
      var total = 0;
      hourRows.forEach(function (r) {
        var h = Number(r.h);
        var c = Number(r.cnt) || 0;
        if (h >= 0 && h < 24) {
          hourCounts[h] = c;
        }
        total += c;
      });

      function sumHours(from, to) {
        var s = 0;
        for (var hi = from; hi <= to; hi++) {
          s += hourCounts[hi] || 0;
        }
        return s;
      }

      /* 卡片 / 表格 / 峰值统一为 4 段（北京时间，不跨日） */
      var detailBuckets = [
        { key: 'late_night', label: '凌晨', range: '00:00-05:59', count: sumHours(0, 5) },
        { key: 'morning', label: '上午', range: '06:00-11:59', count: sumHours(6, 11) },
        { key: 'afternoon', label: '下午', range: '12:00-17:59', count: sumHours(12, 17) },
        { key: 'evening', label: '晚上', range: '18:00-23:59', count: sumHours(18, 23) }
      ];

      var periods = detailBuckets.slice();

      function withPct(rows) {
        return rows.map(function (row) {
          var cnt = Number(row.count) || 0;
          var pct = total > 0 ? Math.round((cnt / total) * 1000) / 10 : 0;
          return {
            key: row.key,
            label: row.label,
            range: row.range,
            count: cnt,
            pct: pct,
            pct_text: total > 0 ? pct.toFixed(1) + '%' : '—'
          };
        });
      }

      detailBuckets = withPct(detailBuckets);
      periods = withPct(periods);

      var peakPeriod = null;
      periods.forEach(function (p) {
        if (!peakPeriod || p.count > peakPeriod.count) {
          peakPeriod = p;
        }
      });

      var byHour = [];
      for (i = 0; i < 24; i++) {
        var hc = hourCounts[i] || 0;
        byHour.push({
          hour: i,
          label: (i < 10 ? '0' : '') + i + ':00',
          count: hc,
          pct: total > 0 ? Math.round((hc / total) * 1000) / 10 : 0
        });
      }

      const [platformRows] = await conn.query(
        'SELECT DATE(' +
          cnCreated +
          ') AS d, users.username,' +
          ' (SELECT ud.user_agent_short FROM user_devices ud' +
          '  WHERE ud.username = users.username' +
          '  ORDER BY ud.first_seen ASC, ud.last_seen ASC LIMIT 1) AS ua,' +
          ' (SELECT ud.device_detail_json FROM user_devices ud' +
          '  WHERE ud.username = users.username' +
          '  ORDER BY ud.first_seen ASC, ud.last_seen ASC LIMIT 1) AS detail_json' +
          ' FROM users WHERE ' +
          where +
          ' ORDER BY d ASC',
        params
      );

      var platformDailyMap = {};
      var platformTotals = { android: 0, ios: 0, other: 0, unknown: 0, total: 0 };
      (platformRows || []).forEach(function (row) {
        var dk = formatDateKey(row.d);
        if (!dk) return;
        if (!platformDailyMap[dk]) {
          platformDailyMap[dk] = { android: 0, ios: 0, other: 0, unknown: 0, total: 0 };
        }
        var cls = classifyUserDeviceRow(row.ua, row.detail_json);
        var os = cls && cls.os_key ? String(cls.os_key) : 'other';
        var bucket = 'other';
        if (os === 'android') bucket = 'android';
        else if (os === 'ios') bucket = 'ios';
        else if (!row.ua) bucket = 'unknown';
        platformDailyMap[dk][bucket] += 1;
        platformDailyMap[dk].total += 1;
        platformTotals[bucket] += 1;
        platformTotals.total += 1;
      });

      function platformPct(n, den) {
        return den > 0 ? Math.round((n / den) * 1000) / 10 : 0;
      }
      function platformPctText(n, den) {
        return den > 0 ? platformPct(n, den).toFixed(1) + '%' : '—';
      }

      var platformDaily = Object.keys(platformDailyMap)
        .sort()
        .map(function (dk) {
          var row = platformDailyMap[dk];
          var t = row.total || 0;
          return {
            date: dk,
            total: t,
            android: row.android || 0,
            ios: row.ios || 0,
            other: (row.other || 0) + (row.unknown || 0),
            android_pct: platformPct(row.android || 0, t),
            ios_pct: platformPct(row.ios || 0, t),
            android_pct_text: platformPctText(row.android || 0, t),
            ios_pct_text: platformPctText(row.ios || 0, t),
            other_pct_text: platformPctText((row.other || 0) + (row.unknown || 0), t)
          };
        });

      var pt = platformTotals.total || 0;
      var platformSummary = {
        total: pt,
        android: platformTotals.android || 0,
        ios: platformTotals.ios || 0,
        other: (platformTotals.other || 0) + (platformTotals.unknown || 0),
        android_pct: platformPct(platformTotals.android || 0, pt),
        ios_pct: platformPct(platformTotals.ios || 0, pt),
        android_pct_text: platformPctText(platformTotals.android || 0, pt),
        ios_pct_text: platformPctText(platformTotals.ios || 0, pt),
        other_pct_text: platformPctText(
          (platformTotals.other || 0) + (platformTotals.unknown || 0),
          pt
        ),
        definition:
          '按注册日（北京时间）统计；手机系统取该用户最早一条 user_devices 的 UA。安卓率=Android÷当日注册，苹果率=iOS÷当日注册；其他含 PC/未知设备。'
      };

      res.json({
        code: 200,
        data: Object.assign(
          {
            timezone: 'Asia/Shanghai (UTC+8)',
            total: total,
            periods: periods,
            detail_buckets: detailBuckets,
            peak_period: peakPeriod
              ? {
                  key: peakPeriod.key,
                  label: peakPeriod.label,
                  count: peakPeriod.count,
                  pct_text: peakPeriod.pct_text
                }
              : null,
            by_hour: byHour,
            platform_summary: platformSummary,
            platform_daily: platformDaily
          },
          conversionAnalyticsPeriodMeta(period)
        )
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** pad2 */
function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/** china today parts */
function chinaTodayParts() {
  var key = chinaDateKeyNow();
  var p = key.split('-').map(Number);
  return { y: p[0], m: p[1], d: p[2], key: key };
}

/** register scope label */
function registerScopeLabel(scope, suffix) {
  suffix = suffix || '';
  if (scope.all_time) {
    return '全部注册用户' + suffix;
  }
  if (scope.period && scope.period.mode === 'range') {
    return scope.period.label + '注册用户' + suffix;
  }
  return '最近 ' + scope.span_days + ' 天注册用户' + suffix;
}

/** 构建：register user scope where */
function buildRegisterUserScopeWhere(daysRaw, admin) {
  var allTime =
    daysRaw === '0' ||
    daysRaw === 'all' ||
    daysRaw === '' ||
    daysRaw == null ||
    daysRaw === undefined;
  var where = nonGuestUsernameSql('users.username');
  var params = [];
  var period = null;
  if (!allTime) {
    period = parseAnalyticsPeriod(daysRaw, 365);
    var cnCreated = 'DATE(DATE_ADD(users.created_at, INTERVAL 8 HOUR))';
    var pf = analyticsPeriodCnDateFilter(cnCreated, period);
    where += ' AND ' + pf.sql;
    params = params.concat(pf.params);
  }
  if (!admin || !admin.is_super) {
    var regUserScope = [];
    appendSubAdminOwnedUsersScopeForAdmin(regUserScope, params, admin, 'users.username');
    if (regUserScope.length) where += ' AND ' + regUserScope.join(' AND ');
  }
  var spanDays = allTime
    ? 0
    : period.mode === 'range'
      ? period.days
      : period.span + 1;
  return {
    where: where,
    params: params,
    days: allTime ? 0 : period.period_key,
    span_days: spanDays,
    all_time: allTime,
    period: period
  };
}

/** register channel stats key */
function registerChannelStatsKey(raw) {
  var c = raw != null ? String(raw).trim() : '';
  return c || '__empty__';
}

/** date keys between */
function dateKeysBetween(startIso, endIso) {
  var keys = [];
  var p = String(startIso || '')
    .slice(0, 10)
    .split('-')
    .map(Number);
  var endP = String(endIso || '')
    .slice(0, 10)
    .split('-')
    .map(Number);
  if (p.length < 3 || endP.length < 3) {
    return keys;
  }
  var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2], 12, 0, 0));
  var endDt = new Date(Date.UTC(endP[0], endP[1] - 1, endP[2], 12, 0, 0));
  while (dt.getTime() <= endDt.getTime()) {
    keys.push(formatDateKey(dt));
    dt = new Date(dt.getTime() + 86400000);
  }
  return keys;
}

/** china date keys for span */
function chinaDateKeysForSpan(spanDays) {
  var n = Math.max(1, parseInt(spanDays, 10) || 1);
  var today = chinaTodayParts();
  var keys = [];
  var base = new Date(Date.UTC(today.y, today.m - 1, today.d, 12, 0, 0));
  for (var i = n - 1; i >= 0; i--) {
    var dt = new Date(base.getTime() - i * 86400000);
    keys.push(formatDateKey(dt));
  }
  return keys;
}

/** query register channel by day */
async function queryRegisterChannelByDay(conn, scope, trendSpanDays) {
  var cnCreated = 'DATE_ADD(users.created_at, INTERVAL 8 HOUR)';
  var dayWhere =
    scope.where +
    " AND register_source_channel IS NOT NULL AND TRIM(register_source_channel) <> ''";
  var dayParams = scope.params.slice();
  var dateKeys;
  if (scope.period && scope.period.mode === 'range') {
    dateKeys = dateKeysBetween(scope.period.start, scope.period.end);
  } else {
    var span = Math.max(0, trendSpanDays - 1);
    dayWhere +=
      ' AND DATE(' +
      cnCreated +
      ') >= DATE_SUB(DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)), INTERVAL ? DAY)';
    dayParams.push(span);
    dateKeys = chinaDateKeysForSpan(trendSpanDays);
  }
  const [dayRows] = await conn.query(
    'SELECT DATE(' +
      cnCreated +
      ') AS d, register_source_channel AS ch, COUNT(*) AS cnt FROM users WHERE ' +
      dayWhere +
      ' GROUP BY d, ch ORDER BY d ASC',
    dayParams
  );
  var dayMap = {};
  var channelTotals = {};
  (dayRows || []).forEach(function (r) {
    var dk = formatDateKey(r.d);
    if (!dk) {
      return;
    }
    if (!dayMap[dk]) {
      dayMap[dk] = { date: dk, total: 0, channels: {} };
    }
    var ck = registerChannelStatsKey(r.ch);
    if (ck === '__empty__') {
      return;
    }
    var c = Number(r.cnt) || 0;
    dayMap[dk].total += c;
    dayMap[dk].channels[ck] = (dayMap[dk].channels[ck] || 0) + c;
    channelTotals[ck] = (channelTotals[ck] || 0) + c;
  });
  var byDay = dateKeys.map(function (dk) {
    var row = dayMap[dk] || { date: dk, total: 0, channels: {} };
    var chList = Object.keys(row.channels).map(function (ck) {
      return {
        key: ck,
        label: registerSourceChannelLabel(ck),
        count: row.channels[ck]
      };
    });
    chList.sort(function (a, b) {
      return b.count - a.count;
    });
    return { date: dk, total: row.total, channels: chList };
  });
  var channelRank = Object.keys(channelTotals)
    .map(function (ck) {
      return { key: ck, label: registerSourceChannelLabel(ck), total: channelTotals[ck] };
    })
    .sort(function (a, b) {
      return b.total - a.total;
    });
  return { byDay: byDay, channelRank: channelRank };
}

/** 构建：channel stats items */
function buildChannelStatsItems(rows, total, labelFn) {
  return (rows || []).map(function (r) {
    var raw = r.ch;
    var cnt = Number(r.cnt) || 0;
    var activated = r.activated_cnt != null ? Number(r.activated_cnt) || 0 : null;
    var pct = total > 0 ? Math.round((cnt / total) * 1000) / 10 : 0;
    var item = {
      key: registerChannelStatsKey(raw),
      label: labelFn(raw),
      count: cnt,
      pct: pct,
      pct_text: total > 0 ? pct.toFixed(1) + '%' : '—'
    };
    if (activated != null) {
      item.activated_count = activated;
      var actPct = cnt > 0 ? Math.round((activated / cnt) * 1000) / 10 : 0;
      item.activation_pct = actPct;
      item.activation_pct_text = cnt > 0 ? actPct.toFixed(1) + '%' : '—';
    }
    return item;
  });
}

/** 注册渠道统计 */
async function handleAdminRegisterChannelStats(req, res) {
  try {
    var scope = buildRegisterUserScopeWhere(req.query.days, req.admin);
    var allTime = scope.all_time;

    const conn = await pool.getConnection();
    try {
      const [regRows] = await conn.query(
        'SELECT register_source_channel AS ch, COUNT(*) AS cnt, ' +
          'SUM(CASE WHEN account_active = 1 AND activation_refunded_at IS NULL AND list_hidden_at IS NULL THEN 1 ELSE 0 END) AS activated_cnt ' +
          'FROM users WHERE ' +
          scope.where +
          ' GROUP BY register_source_channel ORDER BY cnt DESC',
        scope.params
      );

      const [actRows] = await conn.query(
        'SELECT activation_source_channel AS ch, COUNT(*) AS cnt FROM users WHERE ' +
          scope.where +
          " AND account_active = 1 AND activation_refunded_at IS NULL AND list_hidden_at IS NULL AND activation_source_channel IS NOT NULL AND TRIM(activation_source_channel) <> '' " +
          'GROUP BY activation_source_channel ORDER BY cnt DESC',
        scope.params
      );

      var regTotal = 0;
      var withChannel = 0;
      var withoutChannel = 0;
      regRows.forEach(function (r) {
        var c = Number(r.cnt) || 0;
        regTotal += c;
        if (registerChannelStatsKey(r.ch) === '__empty__') {
          withoutChannel += c;
        } else {
          withChannel += c;
        }
      });

      var registerItemsAll = buildChannelStatsItems(regRows, regTotal, registerSourceChannelLabel);
      var registerItems = registerItemsAll.filter(function (it) {
        return it.key !== '__empty__';
      });
      registerItems = registerItems.map(function (it) {
        var pct = withChannel > 0 ? Math.round((it.count / withChannel) * 1000) / 10 : 0;
        return {
          key: it.key,
          label: it.label,
          count: it.count,
          pct: pct,
          pct_text: withChannel > 0 ? pct.toFixed(1) + '%' : '—',
          activated_count: it.activated_count,
          activation_pct: it.activation_pct,
          activation_pct_text: it.activation_pct_text
        };
      });

      var actTotal = 0;
      actRows.forEach(function (r) {
        actTotal += Number(r.cnt) || 0;
      });
      var activationItems = buildChannelStatsItems(actRows, actTotal, activationSourceChannelLabel);

      var activatedUsers = 0;
      registerItems.forEach(function (it) {
        activatedUsers += it.activated_count || 0;
      });
      var overallActivationPct =
        withChannel > 0 ? Math.round((activatedUsers / withChannel) * 1000) / 10 : 0;

      var byDay = [];
      var trendDays = 0;
      var trendScopeLabel = '';
      var channelRankInTrend = [];
      var trendSpan = allTime
        ? 90
        : scope.period && scope.period.mode === 'range'
          ? scope.period.days
          : scope.span_days > 0
            ? Math.min(scope.span_days, 365)
            : 0;
      if (trendSpan > 0) {
        trendDays = trendSpan;
        var trendResult = await queryRegisterChannelByDay(conn, scope, trendSpan);
        byDay = trendResult.byDay;
        channelRankInTrend = trendResult.channelRank;
        if (allTime) {
          trendScopeLabel =
            '近 ' +
            trendSpan +
            ' 日每日注册（汇总统计仍为全部注册用户；未填渠道不计入趋势）';
        } else if (scope.period && scope.period.mode === 'range') {
          trendScopeLabel =
            scope.period.label +
            '每日注册（' +
            scope.period.start +
            ' ~ ' +
            scope.period.end +
            '；未填渠道不计入）';
        } else {
          trendScopeLabel =
            '近 ' +
            trendSpan +
            ' 日每日注册（按来源渠道；未填渠道不计入）';
        }
      }

      var channelDefs = [];
      Object.keys(REGISTER_SOURCE_CHANNELS).forEach(function (k) {
        channelDefs.push({ key: k, label: REGISTER_SOURCE_CHANNELS[k] });
      });

      var scopeLabel = registerScopeLabel(scope);

      res.json({
        code: 200,
        data: Object.assign(
          {
            all_time: allTime,
            scope_label: scopeLabel,
            timezone: 'Asia/Shanghai (UTC+8)',
            total: withChannel,
            all_users_total: regTotal,
            with_register_channel: withChannel,
            without_register_channel: withoutChannel,
            excludes_empty_channel: true,
            activated_users: activatedUsers,
            overall_activation_pct: overallActivationPct,
            overall_activation_pct_text:
              withChannel > 0 ? overallActivationPct.toFixed(1) + '%' : '—',
            register_channels: registerItems,
            activation_channels: activationItems,
            activation_total: actTotal,
            trend_days: trendDays,
            trend_scope_label: trendScopeLabel,
            by_day: byDay,
            trend_channel_rank: channelRankInTrend,
            channel_definitions: channelDefs
          },
          scope.period ? conversionAnalyticsPeriodMeta(scope.period) : { days: 0 }
        )
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 访客用户列表 */
/** 管理端用户列表 */
async function handleAdminUsers(req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 10;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    var offset = (page - 1) * limit;

    // 筛选参数
    var qUsername = String(req.query.username || '').trim();
    var qSameRegisterIpOf = String(req.query.same_register_ip_of || '').trim();
    var qRealName = String(req.query.real_name || '').trim();
    var qActive = req.query.active; // '1' or '0'
    var qBanned = req.query.banned; // '1' or '0'
    var qExact = req.query.exact === '1' || req.query.exact === 'true';
    var qRisk = req.query.risk; // '1' 仅风险, '0' 非风险
    var qTaxModifiedToday = req.query.tax_modified_today; // '1' 当日有改动, '0' 当日无改动
    var qLoggedInToday = req.query.logged_in_today; // '1' 当日已登录/活跃, '0' 当日未登录
    var qLoginInactiveDays = parseInt(req.query.login_inactive_days, 10);
    var qNameChangesGt = parseInt(req.query.name_changes_gt, 10);
    var qTaxModDaysGt = parseInt(req.query.tax_mod_days_gt, 10);
    var qPeerRaw = String(req.query.peer || '').trim().toLowerCase();
    var qPeer = qPeerRaw === '1'; // 仅当前同行（超阈值改名/改税且未免改名费）
    var qPeerExempt = qPeerRaw === 'exempt'; // 已豁免但仍超阈值（白名单）
    var qWhitelistRaw = String(req.query.whitelist || '').trim();
    var qWhitelist = qWhitelistRaw === '1' || qWhitelistRaw === '0' ? qWhitelistRaw : '';
    var qAgentRaw = String(req.query.agent || '').trim();
    var qAgent = qAgentRaw === '1' || qAgentRaw === '0' ? qAgentRaw : '';
    var qD1Raw = String(req.query.d1_return || '').trim().toLowerCase();
    var qD1Return = qD1Raw === 'has' || qD1Raw === 'only' ? qD1Raw : '';
    var qHighIncome = String(req.query.high_income || '').trim() === '1';
    var qGuest =
      req.query.guest === '1' ||
      req.query.guest === 'true' ||
      String(req.query.user_mode || '').trim() === 'guest';
    var todayKey = chinaDateKeyNow();
    if (qGuest && (!req.admin || !req.admin.is_super)) {
      return res.status(403).json({ code: 403, msg: '仅超级管理员可查看游客模式账号' });
    }

    let whereClauses = ['users.list_hidden_at IS NULL'];
    let params = [];
    if (qGuest) {
      whereClauses.push(guestOnlyUserSql());
    } else {
      whereClauses.push(nonGuestUsernameSql('users.username'));
    }

    /* 同注册 IP：优先于账号模糊/精准，列出种子账号注册 IP 下全部账号 */
    if (qSameRegisterIpOf) {
      whereClauses.push(userSameRegisterIpOfSql('users.username'));
      params.push(qSameRegisterIpOf);
    } else if (qUsername) {
      if (qExact) {
        whereClauses.push('username = ?');
        params.push(qUsername);
      } else {
        whereClauses.push('username LIKE ?');
        params.push('%' + qUsername + '%');
      }
    }
    if (qRealName) {
      if (qExact) {
        whereClauses.push('real_name = ?');
        params.push(qRealName);
      } else {
        whereClauses.push('real_name LIKE ?');
        params.push('%' + qRealName + '%');
      }
    }
    if (qRisk === '1') {
      whereClauses.push(userLoginRiskMatchSql('users.username'));
    } else if (qRisk === '0') {
      whereClauses.push('NOT ' + userLoginRiskMatchSql('users.username'));
    }
    if (qActive === '1' || qActive === '0') {
      whereClauses.push('account_active = ?');
      params.push(qActive === '1' ? 1 : 0);
    }
    if (qBanned === '1' || qBanned === '0') {
      whereClauses.push('banned = ?');
      params.push(qBanned === '1' ? 1 : 0);
    }
    if (qTaxModifiedToday === '1') {
      whereClauses.push(
        'EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = users.username AND tr.deleted_at IS NULL AND DATE(tr.updated_at) = ?)'
      );
      params.push(todayKey);
    } else if (qTaxModifiedToday === '0') {
      whereClauses.push(
        'NOT EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = users.username AND tr.deleted_at IS NULL AND DATE(tr.updated_at) = ?)'
      );
      params.push(todayKey);
    }
    if (qLoggedInToday === '1') {
      whereClauses.push(userActiveOnDateSql('users.username'));
      params.push(todayKey, todayKey, todayKey);
    } else if (qLoggedInToday === '0') {
      whereClauses.push('NOT ' + userActiveOnDateSql('users.username'));
      params.push(todayKey, todayKey, todayKey);
    }
    if (isFinite(qLoginInactiveDays) && qLoginInactiveDays > 0) {
      whereClauses.push(userLoginInactiveSinceSql(qLoginInactiveDays));
    }
    if (isFinite(qNameChangesGt) && qNameChangesGt >= 0) {
      whereClauses.push(
        `(SELECT COUNT(*) FROM user_profile_change_logs upc
          WHERE upc.username = users.username AND upc.field_key = 'real_name') > ?`
      );
      params.push(qNameChangesGt);
    }
    if (isFinite(qTaxModDaysGt) && qTaxModDaysGt >= 0) {
      /* 有个税记录修改的不同北京日历天数（tax_record_change_logs）≥ N */
      whereClauses.push(
        `(SELECT COUNT(DISTINCT DATE(DATE_ADD(tcl.changed_at, INTERVAL 8 HOUR))) FROM tax_record_change_logs tcl
          WHERE tcl.user_id = users.username AND ` +
          TAX_CHANGE_LOG_VALID_YEAR_SQL +
          ') >= ?'
      );
      params.push(qTaxModDaysGt);
    }
    var peerFeeCfg = await loadTaxEditFeeConfig(false);
    if (qPeer || qPeerExempt) {
      whereClauses.push(
        qPeerExempt
          ? 'COALESCE(users.rename_fee_exempt, 0) = 1'
          : 'COALESCE(users.rename_fee_exempt, 0) = 0'
      );
      /* 同行只按个税修改天数；勿再绑定已删除的 rename_gt，否则 mysql2 会因 undefined 直接 500 */
      var peerDaysGt = Number(peerFeeCfg && peerFeeCfg.days_gt);
      if (!isFinite(peerDaysGt) || peerDaysGt < 0) {
        peerDaysGt = taxEditFeePolicy.TAX_EDIT_FEE_DAYS_GT;
      }
      whereClauses.push(
        `(SELECT COUNT(DISTINCT DATE(DATE_ADD(tcl.changed_at, INTERVAL 8 HOUR))) FROM tax_record_change_logs tcl
            WHERE tcl.user_id = users.username AND ` +
          TAX_CHANGE_LOG_VALID_YEAR_SQL +
          ') > ?'
      );
      params.push(peerDaysGt);
    }
    if (qWhitelist === '1') {
      whereClauses.push('COALESCE(users.rename_fee_exempt, 0) = 1');
    } else if (qWhitelist === '0') {
      whereClauses.push('COALESCE(users.rename_fee_exempt, 0) = 0');
    }
    if (qAgent === '1') {
      whereClauses.push('COALESCE(users.is_agent, 0) = 1');
    } else if (qAgent === '0') {
      whereClauses.push('COALESCE(users.is_agent, 0) = 0');
    }
    if (qD1Return) {
      whereClauses.push('(account_active IS NULL OR account_active = 0)');
      appendD1ReturnActivityFilters(qD1Return, 'users', whereClauses);
    }
    if (qHighIncome) {
      whereClauses.push('(account_active IS NULL OR account_active = 0)');
      whereClauses.push(userHasSelfFilledHighIncomeSql('users.username', HIGH_SELF_INCOME_THRESHOLD));
    }
    if (!qGuest) {
      /* 超管看全站注册用户；子账号仅看本人激活码开通用户 */
      appendAdminRegisteredUsersScope(whereClauses, params, req.admin, 'users.username');
    }

    let whereSql = whereClauses.length > 0 ? ' WHERE ' + whereClauses.join(' AND ') : '';

    const conn = await pool.getConnection();
    var rows = [];
    var total = 0;

    const [totalRows] = await conn.execute('SELECT COUNT(*) as count FROM users' + whereSql, params);
    total = totalRows[0].count;

    const [pageRows] = await conn.query(
      `
      SELECT id, username, real_name, tax_id, account_active, banned, rename_fee_exempt,
             lizhi_cert_unlocked,
             zaizhi_cert_unlocked,
             is_agent,
             last_login_city, created_at, hash, plain_password, register_source_channel,
             activation_source_channel, activation_kind, active_until,
             user_type, sales_promo_channel, invited_by,
             (SELECT ule.ip FROM user_login_events ule
              WHERE ule.username = users.username AND ule.ip IS NOT NULL
              ORDER BY ule.created_at DESC LIMIT 1) AS ip_last,
             (SELECT ac.owner_admin_username FROM activation_codes ac
              WHERE ac.used_by_username = users.username
                AND ac.used_count > 0
                AND ac.owner_admin_username IS NOT NULL
                AND TRIM(ac.owner_admin_username) <> ''
              ORDER BY ac.last_used_at DESC, ac.id DESC
              LIMIT 1) AS activation_owner_admin,
             (SELECT aa.full_name FROM activation_codes ac
              LEFT JOIN admin_accounts aa ON aa.username = ac.owner_admin_username
              WHERE ac.used_by_username = users.username
                AND ac.used_count > 0
                AND ac.owner_admin_username IS NOT NULL
                AND TRIM(ac.owner_admin_username) <> ''
              ORDER BY ac.last_used_at DESC, ac.id DESC
              LIMIT 1) AS activation_owner_admin_full_name
      FROM users ${whereSql} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}
    `,
      params
    );
    rows = pageRows;

    var usernamesForRisk = rows.map(function (r) {
      return r.username;
    });
    var riskMaps = await buildUserLoginRiskMaps(conn, usernamesForRisk);
    var taxFlagsToday = await loadTaxRecordFlagsForUsernames(conn, usernamesForRisk, todayKey);
    var nameChangeCountMap = {};
    var taxModDaysMap = {};
    var dailyUnlockSet = Object.create(null);
    var lastLoginAtMap = {};
    var loggedInTodaySet = Object.create(null);
    var maxMonthIncomeMap = {};
    if (usernamesForRisk.length) {
      var nameChangePlaceholders = usernamesForRisk
        .map(function () {
          return '?';
        })
        .join(',');
      const [nameChangeRows] = await conn.query(
        `SELECT username, COUNT(*) AS cnt
         FROM user_profile_change_logs
         WHERE field_key = 'real_name' AND username IN (` +
          nameChangePlaceholders +
          `)
         GROUP BY username`,
        usernamesForRisk
      );
      (nameChangeRows || []).forEach(function (row) {
        nameChangeCountMap[String(row.username || '')] = Number(row.cnt) || 0;
      });
      const [taxModDaysRows] = await conn.query(
        `SELECT tcl.user_id, COUNT(DISTINCT DATE(DATE_ADD(tcl.changed_at, INTERVAL 8 HOUR))) AS days_cnt
         FROM tax_record_change_logs tcl
         WHERE tcl.user_id IN (` +
          nameChangePlaceholders +
          `) AND ` +
          TAX_CHANGE_LOG_VALID_YEAR_SQL +
          `
         GROUP BY tcl.user_id`,
        usernamesForRisk
      );
      (taxModDaysRows || []).forEach(function (row) {
        taxModDaysMap[String(row.user_id || '')] = Number(row.days_cnt) || 0;
      });
      try {
        const [unlockRows] = await conn.query(
          `SELECT username FROM user_tax_edit_daily_unlocks
           WHERE unlock_date = ? AND username IN (` +
            nameChangePlaceholders +
            `)`,
          [todayKey].concat(usernamesForRisk)
        );
        (unlockRows || []).forEach(function (row) {
          dailyUnlockSet[String(row.username || '')] = 1;
        });
      } catch (eUnlock) {
        /* 表可能尚未迁移，忽略当日解锁状态 */
      }
      try {
        const [lastLoginRows] = await conn.query(
          `SELECT username, MAX(created_at) AS last_login_at
           FROM user_login_events
           WHERE ok = 1 AND username IN (` +
            nameChangePlaceholders +
            `)
           GROUP BY username`,
          usernamesForRisk
        );
        (lastLoginRows || []).forEach(function (row) {
          lastLoginAtMap[String(row.username || '')] = row.last_login_at;
        });
        const [dauTodayRows] = await conn.query(
          `SELECT username FROM user_daily_activity
           WHERE activity_date = ? AND username IN (` +
            nameChangePlaceholders +
            `)`,
          [todayKey].concat(usernamesForRisk)
        );
        (dauTodayRows || []).forEach(function (row) {
          loggedInTodaySet[String(row.username || '')] = 1;
        });
        const [loginTodayRows] = await conn.query(
          `SELECT DISTINCT username FROM user_login_events
           WHERE ok = 1 AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
             AND username IN (` +
            nameChangePlaceholders +
            `)`,
          [todayKey, todayKey].concat(usernamesForRisk)
        );
        (loginTodayRows || []).forEach(function (row) {
          loggedInTodaySet[String(row.username || '')] = 1;
        });
      } catch (eLoginToday) {
        /* 日活/登录表异常时仍返回用户列表，当日登录标为未知 */
      }
      try {
        const [incomeRows] = await conn.query(
          `SELECT user_id, MAX(${taxRecordMonthIncomeSql('tr')}) AS max_income
           FROM tax_records tr
           WHERE tr.deleted_at IS NULL
             AND IFNULL(tr.company_name,'') NOT LIKE '%示例%'
             AND user_id IN (` +
            nameChangePlaceholders +
            `)
           GROUP BY user_id`,
          usernamesForRisk
        );
        (incomeRows || []).forEach(function (row) {
          var v = Number(row.max_income);
          if (isFinite(v) && v > 0) {
            maxMonthIncomeMap[String(row.user_id || '')] = Math.round(v * 100) / 100;
          }
        });
      } catch (eIncome) {
        /* 收入汇总失败时列表仍返回 */
      }
    }
    conn.release();

    var out = rows.map(function (r) {
      var uname = String(r.username || '');
      var riskInfo = mergeUserRiskInfo(
        riskMaps.ipDistinct[uname] || 0,
        riskMaps.deviceCnt[uname] || 0,
        plainPasswordStore.decodePlainPasswordForDisplay(r.plain_password),
        riskMaps.registerIpAccountCountByUser[uname] || 0,
        riskMaps.registerIpFirstAccountByUser[uname] || ''
      );
      var ut = r.user_type != null ? Number(r.user_type) : USER_TYPE_NORMAL;
      var salesCh =
        r.sales_promo_channel != null && String(r.sales_promo_channel).trim() !== ''
          ? String(r.sales_promo_channel).trim()
          : '';
      var nameChangeCountOut = nameChangeCountMap[uname] || 0;
      var taxModifiedDaysOut = taxModDaysMap[uname] || 0;
      var renameExemptOut =
        r.rename_fee_exempt === 1 ||
        r.rename_fee_exempt === true ||
        Number(r.rename_fee_exempt) === 1;
      return {
        id: r.id,
        username: r.username,
        real_name: r.real_name,
        name_change_count: nameChangeCountOut,
        tax_modified_days: taxModifiedDaysOut,
        is_peer_account: taxEditFeePolicy.isPeerAccount({
          nameChanges: nameChangeCountOut,
          taxModDays: taxModifiedDaysOut,
          exempt: renameExemptOut,
          days_gt: peerFeeCfg.days_gt
        }),
        tax_id: r.tax_id,
        account_active: r.account_active === 1 || r.account_active === true,
        activation_kind:
          r.activation_kind != null && String(r.activation_kind).trim() !== ''
            ? String(r.activation_kind).trim()
            : r.account_active === 1 || r.account_active === true
              ? 'permanent'
              : 'none',
        active_until: r.active_until
          ? r.active_until instanceof Date
            ? r.active_until.toISOString()
            : String(r.active_until)
          : null,
        banned: r.banned === 1 || r.banned === true,
        rename_fee_exempt:
          r.rename_fee_exempt === 1 ||
          r.rename_fee_exempt === true ||
          Number(r.rename_fee_exempt) === 1,
        lizhi_cert_unlocked:
          r.lizhi_cert_unlocked === 1 ||
          r.lizhi_cert_unlocked === true ||
          Number(r.lizhi_cert_unlocked) === 1,
        zaizhi_cert_unlocked:
          r.zaizhi_cert_unlocked === 1 ||
          r.zaizhi_cert_unlocked === true ||
          Number(r.zaizhi_cert_unlocked) === 1,
        is_agent:
          r.is_agent === 1 || r.is_agent === true || Number(r.is_agent) === 1,
        user_type: ut,
        is_guest: ut === USER_TYPE_GUEST,
        last_login_city: r.last_login_city != null && String(r.last_login_city).trim() !== '' ? String(r.last_login_city).trim() : '',
        ip_last: r.ip_last != null ? String(r.ip_last).trim() : '',
        created_at: r.created_at ? r.created_at.toISOString() : '',
        password: (function () {
          var revealed = plainPasswordStore.decodePlainPasswordForDisplay(r.plain_password);
          if (revealed) return revealed;
          return r.hash ? '—（未记录，用户再次登录后显示）' : '—';
        })(),
        distinct_ip_count: riskInfo.distinct_ip_count,
        device_count: riskInfo.device_count,
        register_ip_account_count: riskInfo.register_ip_account_count,
        register_ip_first_username: riskInfo.register_ip_first_username || '',
        risk: riskInfo.risk,
        risk_messages: riskInfo.risk_messages,
        tax_modified_today: !!(taxFlagsToday[uname] && taxFlagsToday[uname].tax_modified_on_date),
        max_month_income: maxMonthIncomeMap[uname] != null ? maxMonthIncomeMap[uname] : 0,
        high_income: !!(maxMonthIncomeMap[uname] && maxMonthIncomeMap[uname] > HIGH_SELF_INCOME_THRESHOLD),
        tax_edit_daily_unlocked_today: !!dailyUnlockSet[uname],
        logged_in_today: !!loggedInTodaySet[uname],
        last_login_at: (function () {
          var v = lastLoginAtMap[uname];
          if (!v) return '';
          if (v instanceof Date) return v.toISOString();
          return String(v);
        })(),
        register_source_channel:
          r.register_source_channel != null ? String(r.register_source_channel).trim() : '',
        register_source_channel_label: registerSourceChannelLabel(r.register_source_channel),
        activation_source_channel:
          r.activation_source_channel != null ? String(r.activation_source_channel).trim() : '',
        activation_source_channel_label: activationSourceChannelLabel(r.activation_source_channel),
        activation_owner_admin:
          r.activation_owner_admin != null && String(r.activation_owner_admin).trim() !== ''
            ? String(r.activation_owner_admin).trim()
            : '',
        activation_owner_admin_full_name:
          r.activation_owner_admin_full_name != null &&
          String(r.activation_owner_admin_full_name).trim() !== ''
            ? String(r.activation_owner_admin_full_name).trim()
            : '',
        sales_promo_channel: salesCh,
        invited_by:
          r.invited_by != null && String(r.invited_by).trim() !== ''
            ? String(r.invited_by).trim()
            : '',
        channel_analysis_label: (function () {
          var base = userChannelAnalysisLabel(
            r.register_source_channel,
            r.activation_source_channel,
            r.invited_by
          );
          if (ut === USER_TYPE_GUEST && salesCh) {
            return (base && base !== '—' ? base + '；' : '') + '推广：' + salesCh;
          }
          return base;
        })()
      };
    });
    res.json({
      code: 200,
      data: {
        users: out,
        total: total,
        page: page,
        limit: limit,
        tax_modified_date: todayKey,
        guest_mode: !!qGuest,
        scope_label: qGuest ? '游客模式' : '注册用户',
        peer_days_gt: peerFeeCfg.days_gt,
        peer_daily_amount: peerFeeCfg.daily_amount,
        peer_filter: qPeerExempt ? 'exempt' : qPeer ? '1' : '',
        whitelist_filter: qWhitelist,
        high_income_filter: qHighIncome ? '1' : '',
        high_income_threshold: HIGH_SELF_INCOME_THRESHOLD,
        same_register_ip_of: qSameRegisterIpOf || ''
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 改名超过免费次数、或个税修改天数超阈值、且未永久免改名费的用户：按日统计个税修改次数 */
var RENAME_WATCH_NAME_CHANGES_GT = 5;
var RENAME_WATCH_TAX_MOD_DAYS_GT = 8;
/** 热力图/修改天数：排除非法年份（如两位年 23 被展开成 23–2026）产生的刷量日志 */
var TAX_CHANGE_LOG_YEAR_EXPR =
  "CAST(JSON_UNQUOTE(JSON_EXTRACT(COALESCE(tcl.after_json, tcl.before_json), '$.year')) AS UNSIGNED)";
var TAX_CHANGE_LOG_VALID_YEAR_SQL =
  '(' + TAX_CHANGE_LOG_YEAR_EXPR + ' BETWEEN 2000 AND 2100)';
var RENAME_WATCH_NAME_CHANGE_COUNT_SQL =
  `(SELECT COUNT(*) FROM user_profile_change_logs upc
    WHERE upc.username = users.username AND upc.field_key = 'real_name')`;
var RENAME_WATCH_TAX_MOD_DAYS_SQL =
  `(SELECT COUNT(DISTINCT DATE(DATE_ADD(tcl.changed_at, INTERVAL 8 HOUR))) FROM tax_record_change_logs tcl
    WHERE tcl.user_id = users.username AND ` +
  TAX_CHANGE_LOG_VALID_YEAR_SQL +
  ')';

async function handleAdminRenameTaxDaily(req, res) {
  try {
    var period = parseAnalyticsPeriod(req.query.days, 90);
    var dateKeys = analyticsPeriodDateKeys(period, chinaDatePartsNow().todayKey);
    if (!dateKeys.length) {
      return res.json({
        code: 200,
        data: Object.assign(conversionAnalyticsPeriodMeta(period), {
          name_changes_gt: RENAME_WATCH_NAME_CHANGES_GT,
          tax_mod_days_gt: RENAME_WATCH_TAX_MOD_DAYS_GT,
          exclude_rename_fee_exempt: true,
          dates: [],
          users: [],
          day_totals: [],
          user_count: 0,
          period_tax_edits: 0
        })
      });
    }
    var startYmd = dateKeys[0];
    var endYmd = dateKeys[dateKeys.length - 1];
    var cnDayExpr = "DATE_FORMAT(DATE(DATE_ADD(tcl.changed_at, INTERVAL 8 HOUR)), '%Y-%m-%d')";

    var whereClauses = [
      'users.list_hidden_at IS NULL',
      nonGuestUsernameSql('users.username'),
      'COALESCE(users.rename_fee_exempt, 0) = 0',
      '(' +
        RENAME_WATCH_NAME_CHANGE_COUNT_SQL +
        ' > ? OR ' +
        RENAME_WATCH_TAX_MOD_DAYS_SQL +
        ' > ?)'
    ];
    var params = [RENAME_WATCH_NAME_CHANGES_GT, RENAME_WATCH_TAX_MOD_DAYS_GT];
    appendAdminRegisteredUsersScope(whereClauses, params, req.admin, 'users.username');

    const conn = await pool.getConnection();
    var userRows = [];
    var dailyByUser = {};
    try {
      const [pageRows] = await conn.execute(
        `SELECT users.username, users.real_name,
                ${RENAME_WATCH_NAME_CHANGE_COUNT_SQL} AS name_change_count,
                ${RENAME_WATCH_TAX_MOD_DAYS_SQL} AS tax_mod_days
         FROM users
         WHERE ${whereClauses.join(' AND ')}
         ORDER BY tax_mod_days DESC, name_change_count DESC, users.username ASC
         LIMIT 400`,
        params
      );
      userRows = pageRows || [];
      var usernames = userRows.map(function (r) {
        return String(r.username || '');
      }).filter(Boolean);
      if (usernames.length) {
        var placeholders = usernames
          .map(function () {
            return '?';
          })
          .join(',');
        var taxModDaysMap = {};
        const [taxModDaysRows] = await conn.query(
          `SELECT tcl.user_id AS username,
                  COUNT(DISTINCT DATE(DATE_ADD(tcl.changed_at, INTERVAL 8 HOUR))) AS days_cnt
           FROM tax_record_change_logs tcl
           WHERE tcl.user_id IN (${placeholders})
             AND ${TAX_CHANGE_LOG_VALID_YEAR_SQL}
           GROUP BY tcl.user_id`,
          usernames
        );
        (taxModDaysRows || []).forEach(function (row) {
          taxModDaysMap[String(row.username || '')] = Number(row.days_cnt) || 0;
        });
        userRows.forEach(function (r) {
          var u = String(r.username || '');
          r.tax_mod_days = taxModDaysMap[u] != null ? taxModDaysMap[u] : 0;
        });
        const [dailyRows] = await conn.query(
          `SELECT tcl.user_id AS username, ${cnDayExpr} AS d, COUNT(*) AS cnt
           FROM tax_record_change_logs tcl
           WHERE tcl.user_id IN (${placeholders})
             AND ${TAX_CHANGE_LOG_VALID_YEAR_SQL}
             AND ${cnDayExpr} >= ? AND ${cnDayExpr} <= ?
           GROUP BY tcl.user_id, ${cnDayExpr}`,
          usernames.concat([startYmd, endYmd])
        );
        (dailyRows || []).forEach(function (row) {
          var u = String(row.username || '');
          var dk = formatDateKey(row.d);
          if (!u || !dk) return;
          if (!dailyByUser[u]) dailyByUser[u] = {};
          dailyByUser[u][dk] = Number(row.cnt) || 0;
        });
      }
    } finally {
      conn.release();
    }

    var todayKey = chinaDateKeyNow();
    var peerFeeCfg = await loadTaxEditFeeConfig(false);
    var users = userRows.map(function (r) {
      var u = String(r.username || '');
      var daily = dateKeys.map(function (dk) {
        return (dailyByUser[u] && dailyByUser[u][dk]) || 0;
      });
      var total = 0;
      daily.forEach(function (n) {
        total += n;
      });
      return {
        username: u,
        real_name: r.real_name != null ? String(r.real_name) : '',
        name_change_count: Number(r.name_change_count) || 0,
        tax_mod_days: Number(r.tax_mod_days) || 0,
        is_peer_account: taxEditFeePolicy.isPeerAccount({
          nameChanges: Number(r.name_change_count) || 0,
          taxModDays: Number(r.tax_mod_days) || 0,
          exempt: false,
          days_gt: peerFeeCfg.days_gt
        }),
        daily: daily,
        period_tax_edits: total,
        today_tax_edits: (dailyByUser[u] && dailyByUser[u][todayKey]) || 0
      };
    });
    users.sort(function (a, b) {
      if (b.period_tax_edits !== a.period_tax_edits) return b.period_tax_edits - a.period_tax_edits;
      if (b.tax_mod_days !== a.tax_mod_days) return b.tax_mod_days - a.tax_mod_days;
      if (b.name_change_count !== a.name_change_count) return b.name_change_count - a.name_change_count;
      return a.username < b.username ? -1 : a.username > b.username ? 1 : 0;
    });

    var dayTotals = dateKeys.map(function (_dk, i) {
      var s = 0;
      users.forEach(function (u) {
        s += u.daily[i] || 0;
      });
      return s;
    });
    var periodTaxEdits = 0;
    dayTotals.forEach(function (n) {
      periodTaxEdits += n;
    });

    var meta = conversionAnalyticsPeriodMeta(period);
    meta.period_start = startYmd;
    meta.period_end = endYmd;

    res.json({
      code: 200,
      data: Object.assign(meta, {
        name_changes_gt: RENAME_WATCH_NAME_CHANGES_GT,
        tax_mod_days_gt: RENAME_WATCH_TAX_MOD_DAYS_GT,
        peer_days_gt: peerFeeCfg.days_gt,
        exclude_rename_fee_exempt: true,
        dates: dateKeys,
        users: users,
        day_totals: dayTotals,
        user_count: users.length,
        period_tax_edits: periodTaxEdits,
        today_key: todayKey
      })
    });
  } catch (e) {
    console.error('admin rename-tax-daily', e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

var USER_DATA_GC_DELIM = '\x1f';

/** split gc list */
function splitGcList(raw) {
  if (raw == null || raw === '') return [];
  return String(raw)
    .split(USER_DATA_GC_DELIM)
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
}

/** 合并：unique strings */
function mergeUniqueStrings() {
  var seen = {};
  var out = [];
  for (var i = 0; i < arguments.length; i++) {
    var arr = arguments[i];
    if (!arr || !arr.length) continue;
    for (var j = 0; j < arr.length; j++) {
      var s = String(arr[j] || '').trim();
      if (!s || seen[s]) continue;
      seen[s] = 1;
      out.push(s);
    }
  }
  return out;
}

/** summarize text list */
function summarizeTextList(items, maxItems, maxChars) {
  maxItems = maxItems == null ? 3 : maxItems;
  maxChars = maxChars == null ? 160 : maxChars;
  var list = mergeUniqueStrings(items || []);
  if (!list.length) return '—';
  var head = list.slice(0, maxItems);
  var text = head.join('；');
  if (list.length > maxItems) {
    text += ' 等' + list.length + '项';
  }
  if (text.length > maxChars) {
    text = text.substring(0, maxChars - 1) + '…';
  }
  return text;
}

/** append admin user scope */
function appendAdminUserScope(whereClauses, params, admin, userCol) {
  whereClauses.push(nonGuestUsernameSql(userCol));
  if (!admin || adminHasFullUserScope(admin)) return;
  appendSubAdminOwnedUsersScopeForAdmin(whereClauses, params, admin, userCol);
}

/** append admin registered users scope */
function appendAdminRegisteredUsersScope(whereClauses, params, admin, userCol) {
  if (!admin || !admin.username) return;
  /* 超级管理员 / 全量用户数据账号：全部注册用户 */
  if (adminHasFullUserScope(admin)) return;
  /*
   * 运营子账号 admin：本人激活码开通用户 ∪ 截止时间后新注册用户。
   * 仅用于「注册用户」列表；其它数据页仍走 appendAdminUserScope（仅激活码归属）。
   */
  if (isOpsNamedAdmin(admin)) {
    var createdCol = String(userCol || 'users.username').replace(/\.username\s*$/i, '.created_at');
    if (createdCol === String(userCol || '')) {
      createdCol = 'users.created_at';
    }
    var ownerSql = adminDownline.ownerAdminInSql(
      'ac.owner_admin_username',
      params,
      adminDownline.adminScopeUsernames(admin)
    );
    whereClauses.push(
      '(' +
        'EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = ' +
        userCol +
        ' AND ' +
        ownerSql +
        ') OR ' +
        createdCol +
        ' >= ?' +
        ')'
    );
    params.push(adminOpsSeeRegisteredSinceUtc(admin));
    return;
  }
  appendSubAdminOwnedUsersScopeForAdmin(whereClauses, params, admin, userCol);
}

/** conversion analytics owner admin；超管返回 null 表示全站（不按归属过滤） */
function conversionAnalyticsOwnerAdmin(admin) {
  if (!admin || !admin.username) {
    return null;
  }
  if (admin.is_super) {
    return null;
  }
  return String(admin.username).trim();
}

/** append conversion analytics registration scope */
function appendConversionAnalyticsRegistrationScope(whereParts, params, admin, userCol) {
  whereParts.push(nonGuestUsernameSql(userCol));
  var owner = conversionAnalyticsOwnerAdmin(admin);
  if (!owner) {
    return;
  }
  appendSubAdminOwnedUsersScopeForAdmin(whereParts, params, admin, userCol);
}

/** activation channel filter sql */
function activationChannelFilterSql(userAlias, codeAlias, channelKey) {
  var key = String(channelKey || '').trim().toLowerCase();
  var labelMap = {
    xianyu: '闲鱼',
    alipay: '支付宝',
    kufaka: '酷发卡'
  };
  var label = labelMap[key] || '';
  if (!key || !label) {
    return '1=0';
  }
  return (
    '(' +
    userAlias +
    '.activation_source_channel = ? OR (' +
    codeAlias +
    '.note IS NOT NULL AND ' +
    codeAlias +
    '.note LIKE ?))'
  );
}

/** activation channel filter params */
function activationChannelFilterParams(channelKey) {
  var key = String(channelKey || '').trim().toLowerCase();
  var labelMap = {
    xianyu: '闲鱼',
    alipay: '支付宝',
    kufaka: '酷发卡'
  };
  var label = labelMap[key];
  if (!label) return [];
  return [key, '%' + label + '%'];
}

/** 用户辅助：table alias from col */
function userTableAliasFromCol(userCol) {
  if (!userCol) return 'users';
  var idx = String(userCol).indexOf('.');
  return idx >= 0 ? String(userCol).slice(0, idx) : String(userCol);
}

/** 构建：user data batch maps */
async function buildUserDataBatchMaps(conn, usernames) {
  var map = {};
  if (!conn || !usernames || !usernames.length) return map;
  var uniq = [];
  var seen = {};
  usernames.forEach(function (u) {
    var id = String(u || '').trim();
    if (!id || seen[id]) return;
    seen[id] = 1;
    uniq.push(id);
    map[id] = {
      companies: [],
      company_tax_ids: [],
      tax_authorities: [],
      employers: [],
      family_members: [],
      family_count: 0,
      bank_cards: [],
      bank_count: 0,
      tax_record_count: 0
    };
  });
  if (!uniq.length) return map;
  var ph = uniq.map(function () {
    return '?';
  }).join(',');

  const [taxRows] = await conn.query(
    `SELECT user_id,
            COUNT(*) AS record_count,
            GROUP_CONCAT(DISTINCT NULLIF(TRIM(company_name), '') ORDER BY company_name SEPARATOR ?) AS companies,
            GROUP_CONCAT(DISTINCT NULLIF(TRIM(company_tax_id), '') ORDER BY company_tax_id SEPARATOR ?) AS tax_ids,
            GROUP_CONCAT(DISTINCT NULLIF(TRIM(tax_authority), '') ORDER BY tax_authority SEPARATOR ?) AS authorities
     FROM tax_records
     WHERE user_id IN (` +
      ph +
      `)
     GROUP BY user_id`,
    [USER_DATA_GC_DELIM, USER_DATA_GC_DELIM, USER_DATA_GC_DELIM].concat(uniq)
  );
  taxRows.forEach(function (r) {
    var uid = String(r.user_id);
    if (!map[uid]) return;
    map[uid].tax_record_count = Number(r.record_count) || 0;
    map[uid].companies = splitGcList(r.companies);
    map[uid].company_tax_ids = splitGcList(r.tax_ids);
    map[uid].tax_authorities = splitGcList(r.authorities);
  });

  const [empRows] = await conn.query(
    'SELECT user_id, company_name, credit_code, position, hire_date FROM employers WHERE user_id IN (' + ph + ')',
    uniq
  );
  empRows.forEach(function (r) {
    var uid = String(r.user_id);
    if (!map[uid]) return;
    var cn = r.company_name != null ? String(r.company_name).trim() : '';
    if (cn) {
      map[uid].companies = mergeUniqueStrings(map[uid].companies, [cn]);
    }
    map[uid].employers.push({
      company_name: cn,
      credit_code: r.credit_code != null ? String(r.credit_code) : '',
      position: r.position != null ? String(r.position) : '',
      hire_date: r.hire_date != null ? String(r.hire_date) : ''
    });
  });

  const [famAgg] = await conn.query(
    `SELECT user_id, COUNT(*) AS cnt,
            GROUP_CONCAT(CONCAT(IFNULL(real_name,''),'(',IFNULL(relation,''),')')
              ORDER BY created_at SEPARATOR ?) AS preview
     FROM family_members WHERE user_id IN (` +
      ph +
      `) GROUP BY user_id`,
    [USER_DATA_GC_DELIM].concat(uniq)
  );
  famAgg.forEach(function (r) {
    var uid = String(r.user_id);
    if (!map[uid]) return;
    map[uid].family_count = Number(r.cnt) || 0;
    map[uid].family_members = splitGcList(r.preview).map(function (line) {
      var m = /^(.+)\((.+)\)$/.exec(line);
      return { real_name: m ? m[1] : line, relation: m ? m[2] : '' };
    });
  });

  const [famDetail] = await conn.query(
    `SELECT user_id, real_name, relation, id_type_label, id_no, birth_date
     FROM family_members WHERE user_id IN (` +
      ph +
      `) ORDER BY user_id, created_at ASC`,
    uniq
  );
  famDetail.forEach(function (r) {
    var uid = String(r.user_id);
    if (!map[uid]) return;
    if (!map[uid]._family_full) map[uid]._family_full = [];
    map[uid]._family_full.push({
      real_name: r.real_name != null ? String(r.real_name) : '',
      relation: r.relation != null ? String(r.relation) : '',
      id_type_label: r.id_type_label != null ? String(r.id_type_label) : '',
      id_no: r.id_no != null ? String(r.id_no) : '',
      birth_date: r.birth_date != null ? String(r.birth_date) : ''
    });
  });

  const [bankRows] = await conn.query(
    'SELECT user_id, card_no, bank_name, province, phone FROM bank_cards WHERE user_id IN (' +
      ph +
      ') ORDER BY user_id, created_at ASC',
    uniq
  );
  bankRows.forEach(function (r) {
    var uid = String(r.user_id);
    if (!map[uid]) return;
    map[uid].bank_count = (map[uid].bank_count || 0) + 1;
    map[uid].bank_cards.push({
      card_no_masked: maskBankCardNo(r.card_no),
      card_no: r.card_no != null ? String(r.card_no) : '',
      bank_name: r.bank_name != null ? String(r.bank_name) : '',
      province: r.province != null ? String(r.province) : '',
      phone: r.phone != null ? String(r.phone) : ''
    });
  });

  uniq.forEach(function (uid) {
    var item = map[uid];
    if (!item) return;
    if (item._family_full) {
      item.family_members = item._family_full;
      delete item._family_full;
    }
    item.companies_summary = summarizeTextList(item.companies, 3, 140);
    item.company_tax_ids_summary = summarizeTextList(item.company_tax_ids, 2, 120);
    item.tax_authorities_summary = summarizeTextList(item.tax_authorities, 2, 120);
    item.family_summary =
      item.family_count > 0
        ? summarizeTextList(
            item.family_members.map(function (f) {
              return (f.real_name || '—') + '(' + (f.relation || '—') + ')';
            }),
            3,
            120
          )
        : '—';
    item.bank_summary =
      item.bank_count > 0
        ? summarizeTextList(
            item.bank_cards.map(function (b) {
              return (b.card_no_masked || '—') + (b.bank_name ? ' ' + b.bank_name : '');
            }),
            2,
            120
          )
        : '—';
  });

  return map;
}

const HIGH_SALARY_CHART_DEFAULT_MIN = 20000;

/** 用户业务数据列表 */
async function handleAdminUserDataList(req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 15;
    if (page < 1) page = 1;
    if (limit < 1) limit = 15;
    if (limit > 50) limit = 50;
    var offset = (page - 1) * limit;

    var qUsername = String(req.query.username || '').trim();
    var qRealName = String(req.query.real_name || '').trim();
    var qCompany = String(req.query.company || '').trim();
    var qHasFamily = req.query.has_family;
    var qHasBank = req.query.has_bank;

    var whereClauses = ['users.list_hidden_at IS NULL'];
    var params = [];
    if (qUsername) {
      whereClauses.push('users.username LIKE ?');
      params.push('%' + qUsername + '%');
    }
    if (qRealName) {
      whereClauses.push('users.real_name LIKE ?');
      params.push('%' + qRealName + '%');
    }
    if (qCompany) {
      whereClauses.push(
        `(EXISTS (SELECT 1 FROM tax_records trc WHERE trc.user_id = users.username AND trc.company_name LIKE ?)
          OR EXISTS (SELECT 1 FROM employers ec WHERE ec.user_id = users.username AND ec.company_name LIKE ?))`
      );
      params.push('%' + qCompany + '%', '%' + qCompany + '%');
    }
    if (qHasFamily === '1') {
      whereClauses.push('EXISTS (SELECT 1 FROM family_members fm WHERE fm.user_id = users.username)');
    } else if (qHasFamily === '0') {
      whereClauses.push('NOT EXISTS (SELECT 1 FROM family_members fm WHERE fm.user_id = users.username)');
    }
    if (qHasBank === '1') {
      whereClauses.push('EXISTS (SELECT 1 FROM bank_cards bc WHERE bc.user_id = users.username)');
    } else if (qHasBank === '0') {
      whereClauses.push('NOT EXISTS (SELECT 1 FROM bank_cards bc WHERE bc.user_id = users.username)');
    }
    appendAdminUserScope(whereClauses, params, req.admin, 'users.username');

    var whereSql = whereClauses.length ? ' WHERE ' + whereClauses.join(' AND ') : '';
    const conn = await pool.getConnection();
    var rows = [];
    var total = 0;

    const [totalRows] = await conn.execute('SELECT COUNT(*) AS count FROM users' + whereSql, params);
    total = totalRows[0].count;
    const [pageRows] = await conn.query(
      'SELECT id, username, real_name, tax_id, register_source_channel, activation_source_channel FROM users' +
        whereSql +
        ' ORDER BY id DESC LIMIT ? OFFSET ?',
      params.concat([limit, offset])
    );
    rows = pageRows;

    var usernames = rows.map(function (r) {
      return r.username;
    });
    var dataMaps = await buildUserDataBatchMaps(conn, usernames);
    conn.release();

    var list = rows.map(function (r) {
      var uname = String(r.username);
      var dm = dataMaps[uname] || {};
      return {
        id: r.id,
        username: uname,
        real_name: r.real_name != null ? String(r.real_name) : '',
        user_tax_id: r.tax_id != null ? String(r.tax_id) : '',
        id_card: formatUserIdCardForAdmin(r.tax_id),
        id_card_label: userIdCardLabelForAdmin(r.tax_id),
        companies_summary: dm.companies_summary || '—',
        company_tax_ids_summary: dm.company_tax_ids_summary || '—',
        tax_authorities_summary: dm.tax_authorities_summary || '—',
        family_count: dm.family_count || 0,
        family_summary: dm.family_summary || '—',
        bank_count: dm.bank_count || 0,
        bank_summary: dm.bank_summary || '—',
        tax_record_count: dm.tax_record_count || 0,
        register_source_channel:
          r.register_source_channel != null ? String(r.register_source_channel).trim() : '',
        register_source_channel_label: registerSourceChannelLabel(r.register_source_channel),
        activation_source_channel:
          r.activation_source_channel != null ? String(r.activation_source_channel).trim() : '',
        activation_source_channel_label: activationSourceChannelLabel(r.activation_source_channel),
        channel_analysis_label: userChannelAnalysisLabel(
          r.register_source_channel,
          r.activation_source_channel
        )
      };
    });

    res.json({
      code: 200,
      data: { items: list, total: total, page: page, limit: limit }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 用户业务数据详情 */
async function handleAdminUserDataDetail(req, res) {
  var username = req.query.username != null ? String(req.query.username).trim() : '';
  if (!username) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      var allowed = await adminCanAccessTargetUser(conn, req.admin, username);
      if (!allowed) {
        return res.status(403).json({ code: 403, msg: '无权限查看该用户' });
      }
      const [userRows] = await conn.execute(
        'SELECT username, real_name, tax_id, created_at, register_source_channel, activation_source_channel FROM users WHERE username = ? LIMIT 1',
        [username]
      );
      if (!userRows.length) {
        return res.json({ code: 404, msg: '用户不存在' });
      }
      var u = userRows[0];
      var maps = await buildUserDataBatchMaps(conn, [username]);
      var dm = maps[username] || {};

      var taxLimit = 120;
      if (req.query.tax_limit != null && String(req.query.tax_limit).trim() !== '') {
        var tl = parseInt(req.query.tax_limit, 10);
        if (isFinite(tl) && tl > 0) taxLimit = Math.min(2000, tl);
      }
      const [taxRows] = await conn.execute(
        ADMIN_TAX_RECORD_SELECT_SQL +
          ' WHERE user_id = ? AND deleted_at IS NULL ORDER BY year DESC, month DESC, id DESC LIMIT ' +
          taxLimit,
        [username]
      );

      var latestIssue = null;
      try {
        const [issueRows] = await conn.execute(
          `SELECT id, apply_time, period_start, period_end, record_no, scope, status, query_code,
                  qr_image_url, qr_block_image_url, created_at
           FROM tax_issue_applications WHERE user_id = ? ORDER BY created_at DESC, apply_time DESC LIMIT 1`,
          [username]
        );
        if (issueRows.length) {
          var ir = issueRows[0];
          latestIssue = {
            id: ir.id != null ? String(ir.id) : '',
            apply_time: ir.apply_time ? String(ir.apply_time) : '',
            period_start: ir.period_start != null ? String(ir.period_start) : '',
            period_end: ir.period_end != null ? String(ir.period_end) : '',
            record_no: ir.record_no != null ? String(ir.record_no) : '',
            scope: ir.scope != null ? String(ir.scope) : '',
            status: ir.status != null ? String(ir.status) : '',
            query_code: ir.query_code != null ? String(ir.query_code) : '',
            qr_image_url: ir.qr_image_url != null ? String(ir.qr_image_url) : '',
            qr_block_image_url: ir.qr_block_image_url != null ? String(ir.qr_block_image_url) : '',
            created_at: ir.created_at ? ir.created_at.toISOString() : ''
          };
        }
      } catch (issueErr) {
        console.error('user-data detail issue', issueErr);
      }

      var shebaoPhotos = [];
      try {
        var shebaoMod = require('../user/shebaoPhoto');
        if (shebaoMod && typeof shebaoMod.listShebaoPhotosForUsername === 'function') {
          shebaoPhotos = await shebaoMod.listShebaoPhotosForUsername(username);
        }
      } catch (shebaoErr) {
        console.error('user-data detail shebao', shebaoErr);
        shebaoPhotos = [];
      }

      res.json({
        code: 200,
        data: {
          user: {
            username: String(u.username),
            real_name: u.real_name != null ? String(u.real_name) : '',
            user_tax_id: u.tax_id != null ? String(u.tax_id) : '',
            id_card: formatUserIdCardForAdmin(u.tax_id),
            id_card_label: userIdCardLabelForAdmin(u.tax_id),
            created_at: u.created_at ? u.created_at.toISOString() : '',
            register_source_channel:
              u.register_source_channel != null ? String(u.register_source_channel).trim() : '',
            register_source_channel_label: registerSourceChannelLabel(u.register_source_channel),
            activation_source_channel:
              u.activation_source_channel != null ? String(u.activation_source_channel).trim() : '',
            activation_source_channel_label: activationSourceChannelLabel(u.activation_source_channel),
            channel_analysis_label: userChannelAnalysisLabel(
              u.register_source_channel,
              u.activation_source_channel
            )
          },
          channel_analysis_label: userChannelAnalysisLabel(
            u.register_source_channel,
            u.activation_source_channel
          ),
          companies: dm.companies || [],
          company_tax_ids: dm.company_tax_ids || [],
          tax_authorities: dm.tax_authorities || [],
          employers: dm.employers || [],
          family_members: dm.family_members || [],
          bank_cards: (dm.bank_cards || []).map(function (b) {
            return {
              card_no_masked: b.card_no_masked,
              bank_name: b.bank_name,
              province: b.province,
              phone: b.phone
            };
          }),
          shebao_photos: shebaoPhotos,
          tax_records: taxRows.map(mapTaxRecordRowForAdmin),
          latest_issue_application: latestIssue
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** random activation code plain */
function randomActivationCodePlain() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

/** 发放单个激活码；body.grant_days / grant_hours / grant_minutes 为正时生成时效码 */
async function handleAdminIssueCode(req, res) {
  try {
    var maxUses = 1;
    var plainCode = randomActivationCodePlain();
    var grantDays = null;
    var grantHours = null;
    var grantMinutes = null;
    var body = req.body || {};
    if (body.grant_days != null && String(body.grant_days).trim() !== '') {
      var gd = parseInt(body.grant_days, 10);
      if (!isFinite(gd) || gd < 0 || gd > 365) {
        return res.status(400).json({ code: 400, msg: 'grant_days 须为 0–365 的整数' });
      }
      if (gd > 0) grantDays = gd;
    }
    if (body.grant_hours != null && String(body.grant_hours).trim() !== '') {
      var gh = parseInt(body.grant_hours, 10);
      if (!isFinite(gh) || gh < 0 || gh > 24 * 30) {
        return res.status(400).json({ code: 400, msg: 'grant_hours 须为 0–720 的整数' });
      }
      if (gh > 0) grantHours = gh;
    }
    if (body.grant_minutes != null && String(body.grant_minutes).trim() !== '') {
      var gm = parseInt(body.grant_minutes, 10);
      if (!isFinite(gm) || gm < 0 || gm > 525600) {
        return res.status(400).json({ code: 400, msg: 'grant_minutes 须为 0–525600 的整数' });
      }
      if (gm > 0) grantMinutes = gm;
    }
    var isTrial = !!(grantDays || grantHours || grantMinutes);
    var note = null;
    if (isTrial) {
      var bits = [];
      if (grantDays) bits.push(grantDays + '天');
      if (grantHours) bits.push(grantHours + '小时');
      if (grantMinutes) bits.push(grantMinutes + '分钟');
      note = '时效激活' + bits.join('');
    }
    /* 保留调用方自定义备注（如发版自检 @@redeploy-selftest），便于事后清理 */
    var customNote = body.note != null ? String(body.note).trim() : '';
    if (customNote) {
      customNote = customNote.replace(/\s+/g, ' ').substring(0, 120);
      note = note ? note + '|' + customNote : customNote;
      if (note.length > 255) note = note.substring(0, 255);
    }
    const conn = await pool.getConnection();
    await conn.execute(
      'INSERT INTO activation_codes (code, max_uses, used_count, expires_at, grant_days, grant_hours, grant_minutes, note, owner_admin_username) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?)',
      [
        plainCode,
        maxUses,
        null,
        grantDays,
        grantHours,
        grantMinutes,
        note,
        req.admin && req.admin.username ? req.admin.username : null
      ]
    );
    conn.release();
    return res.json({
      code: 200,
      data: {
        code: plainCode,
        max_uses: maxUses,
        grant_days: grantDays,
        grant_hours: grantHours,
        grant_minutes: grantMinutes
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 删除未使用激活码（默认非闲鱼/非批量/非周卡的普通码；已使用的不删） */
async function handleAdminDeleteUnusedCodes(req, res) {
  try {
    if (!adminHasMenu(req.admin, 'codes')) {
      return res.status(403).json({ code: 403, msg: '无激活码权限' });
    }
    var body = req.body || {};
    var scope = body.scope != null ? String(body.scope).trim() : 'general';
    if (scope !== 'general') {
      return res.status(400).json({
        code: 400,
        msg: '当前仅支持删除普通激活码列表中的未使用码（不含渠道批量库存）'
      });
    }
    const conn = await pool.getConnection();
    try {
      var ownerAdmin = '';
      if (!(req.admin && req.admin.is_super)) {
        ownerAdmin = req.admin && req.admin.username ? String(req.admin.username) : '';
        if (!ownerAdmin) {
          return res.status(403).json({ code: 403, msg: '无权限' });
        }
      }
      var where = unusedActivationCodes.unusedGeneralWhereSql({ ownerAdmin: ownerAdmin });
      const [cntRows] = await conn.execute(
        'SELECT COUNT(*) AS c FROM activation_codes WHERE ' + where.sql,
        where.params
      );
      var before = Number((cntRows[0] && cntRows[0].c) || 0);
      if (before <= 0) {
        return res.json({ code: 200, msg: '没有可删除的未使用激活码', data: { deleted: 0 } });
      }
      var purged = await unusedActivationCodes.purgeUnusedGeneralCodes(conn, {
        ownerAdmin: ownerAdmin
      });
      var deleted = purged && purged.deleted != null ? Number(purged.deleted) : 0;
      return res.json({
        code: 200,
        msg: '已删除 ' + deleted + ' 个未使用激活码',
        data: { deleted: deleted, before: before }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('handleAdminDeleteUnusedCodes', e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 激活批次渠道配置（只读：批量发码已下线，仅保留渠道下拉数据源） */
async function handleAdminActivationBatchChannels(req, res) {
  if (!req.admin || !req.admin.is_super) {
    return res.status(403).json({ code: 403, msg: '仅超级管理员可查看批量渠道' });
  }
  try {
    var list = await loadActivationBatchCustomChannels();
    return res.json({
      code: 200,
      data: { channels: buildActivationBatchChannelsPayload(list) }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 代理专属渠道列表 */
async function handleAdminAgentChannelsList(req, res) {
  try {
    var list = await getAgentChannels().listChannels();
    if (!req.admin || !req.admin.is_super) {
      var owners = adminDownline.adminScopeUsernames(req.admin);
      var ownerSet = {};
      (owners || []).forEach(function (o) {
        ownerSet[String(o || '').trim()] = true;
      });
      list = (list || []).filter(function (c) {
        var ow = c && c.owner_admin_username ? String(c.owner_admin_username).trim() : '';
        return !ow || ownerSet[ow];
      });
    }
    return res.json({ code: 200, data: { channels: list || [] } });
  } catch (e) {
    console.error('handleAdminAgentChannelsList', e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 新建 / 更新代理专属渠道（含每渠道安装包） */
async function handleAdminAgentChannelsUpsert(req, res) {
  try {
    var body = req.body || {};
    var channelId = sanitizeSalesChannelId(body.channel_id || body.ch || '');
    if (!channelId) {
      return res.status(400).json({ code: 400, msg: '渠道 ID 无效' });
    }
    if (!req.admin || !req.admin.is_super) {
      var owners = adminDownline.adminScopeUsernames(req.admin);
      var ownerWant = String(body.owner_admin_username || '').trim();
      if (!ownerWant) {
        ownerWant = String((req.admin && req.admin.username) || '').trim();
        body.owner_admin_username = ownerWant;
      }
      if ((owners || []).indexOf(ownerWant) < 0) {
        return res.status(403).json({ code: 403, msg: '只能管理自己名下的渠道' });
      }
      var existing = await getAgentChannels().getChannelById(channelId);
      if (existing && existing.owner_admin_username) {
        if ((owners || []).indexOf(String(existing.owner_admin_username).trim()) < 0) {
          return res.status(403).json({ code: 403, msg: '无权修改该渠道' });
        }
      }
    }
    var row = await getAgentChannels().upsertChannel(body);
    try {
      invalidateInstallPackagesResponseCache();
    } catch (eInv) {}
    return res.json({ code: 200, msg: '已保存', data: row });
  } catch (e) {
    if (e && (e.code === 'INVALID_CHANNEL' || e.code === 'INVALID_PACKAGE_URL')) {
      return res.status(400).json({ code: 400, msg: String(e.message) });
    }
    console.error('handleAdminAgentChannelsUpsert', e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 删除代理专属渠道 */
async function handleAdminAgentChannelsDelete(req, res) {
  try {
    var channelId = sanitizeSalesChannelId(
      (req.params && req.params.channelId) ||
        (req.body && (req.body.channel_id || req.body.ch)) ||
        (req.query && (req.query.channel_id || req.query.ch)) ||
        ''
    );
    if (!channelId) {
      return res.status(400).json({ code: 400, msg: '渠道 ID 无效' });
    }
    if (!req.admin || !req.admin.is_super) {
      var existing = await getAgentChannels().getChannelById(channelId);
      if (!existing) {
        return res.json({ code: 200, msg: '已删除', data: { deleted: false } });
      }
      var owners = adminDownline.adminScopeUsernames(req.admin);
      if ((owners || []).indexOf(String(existing.owner_admin_username || '').trim()) < 0) {
        return res.status(403).json({ code: 403, msg: '无权删除该渠道' });
      }
    }
    var ok = await getAgentChannels().deleteChannel(channelId);
    try {
      invalidateInstallPackagesResponseCache();
    } catch (eInv2) {}
    return res.json({ code: 200, msg: ok ? '已删除' : '渠道不存在', data: { deleted: !!ok } });
  } catch (e) {
    console.error('handleAdminAgentChannelsDelete', e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 激活码列表 */
async function handleAdminCodes(req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 10;
    var qOwnerAdmin = req.query.owner_admin != null ? String(req.query.owner_admin).trim() : '';
    var qUsedBy = req.query.used_by != null ? String(req.query.used_by).trim() : '';
    var usedByExact =
      req.query.used_by_exact === '1' ||
      req.query.used_by_exact === 'true' ||
      req.query.used_by_exact === true;
    var qUsageStatus = req.query.usage_status != null ? String(req.query.usage_status).trim() : '';
    var qCode = req.query.code != null ? String(req.query.code).trim() : '';
    var codeExact =
      req.query.code_exact === '1' ||
      req.query.code_exact === 'true' ||
      req.query.code_exact === true;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    var offset = (page - 1) * limit;

    const conn = await pool.getConnection();
    var conditions = [];
    var params = [];
    if (!req.admin || !req.admin.is_super) {
      conditions.push(
        adminDownline.ownerAdminInSql(
          'ac.owner_admin_username',
          params,
          adminDownline.adminScopeUsernames(req.admin)
        )
      );
    } else if (qOwnerAdmin) {
      conditions.push(
        '(ac.owner_admin_username LIKE ? OR IFNULL(aa.full_name, \'\') LIKE ?)'
      );
      params.push('%' + qOwnerAdmin + '%', '%' + qOwnerAdmin + '%');
    }
    if (qUsedBy) {
      if (usedByExact) {
        conditions.push('ac.used_by_username = ?');
        params.push(qUsedBy);
      } else {
        conditions.push('ac.used_by_username LIKE ?');
        params.push('%' + qUsedBy + '%');
      }
    }
    if (qUsageStatus === 'unused') {
      conditions.push('ac.used_count = 0');
    } else if (qUsageStatus === 'used') {
      conditions.push('ac.used_count > 0');
    }
    if (qCode) {
      if (codeExact) {
        conditions.push('ac.code = ?');
        params.push(qCode);
      } else {
        conditions.push('ac.code LIKE ?');
        params.push('%' + qCode + '%');
      }
    }
    var scope = req.query.scope != null ? String(req.query.scope).trim() : '';
    var canCodes = adminHasMenu(req.admin, 'codes');
    if (!canCodes) {
      conn.release();
      return res.status(403).json({ code: 403, msg: '无激活码权限' });
    }
    var noteChannel =
      req.query.note_channel != null
        ? sanitizeActivationBatchChannelLabel(req.query.note_channel)
        : req.query.channel != null
          ? sanitizeActivationBatchChannelLabel(req.query.channel)
          : '';
    if (noteChannel) {
      var noteLabel = noteChannel;
      var nk = Object.keys(ACTIVATION_BATCH_BUILTIN_CHANNELS);
      for (var ni = 0; ni < nk.length; ni++) {
        if (nk[ni] === noteChannel) {
          noteLabel = ACTIVATION_BATCH_BUILTIN_CHANNELS[nk[ni]];
          break;
        }
      }
      conditions.push('(ac.note IS NOT NULL AND ac.note LIKE ?)');
      params.push('%' + noteLabel + '%');
    } else if (scope === 'xianyu') {
      if (!req.admin || !req.admin.is_super) {
        conn.release();
        return res.status(403).json({ code: 403, msg: '仅超级管理员可查看闲鱼激活码' });
      }
      conditions.push("(ac.note IS NOT NULL AND ac.note LIKE '%闲鱼%')");
    } else if (scope === 'batch') {
      if (!req.admin || !req.admin.is_super) {
        conn.release();
        return res.status(403).json({ code: 403, msg: '仅超级管理员可查看渠道批量激活码' });
      }
      conditions.push("(ac.note IS NOT NULL AND ac.note LIKE '%批量%')");
    } else if (scope === 'weekly') {
      conditions.push("(ac.note IS NOT NULL AND ac.note LIKE '%周卡%')");
    } else if (scope === 'general') {
      conditions.push(
        "(ac.note IS NULL OR (ac.note NOT LIKE '%批量%' AND ac.note NOT LIKE '%周卡%'))"
      );
    }
    var whereSql = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    const [totalRows] = await conn.execute(
      'SELECT COUNT(*) as count FROM activation_codes ac' +
        ' LEFT JOIN admin_accounts aa ON aa.username = ac.owner_admin_username' +
        whereSql,
      params
    );
    const total = totalRows[0].count;

    var hasListFilter = !!(qOwnerAdmin || qUsedBy || qUsageStatus || qCode);
    var orderSql =
      req.admin && req.admin.is_super && !hasListFilter
        ? ' ORDER BY ac.id DESC'
        : qOwnerAdmin && !qUsedBy
          ? ' ORDER BY COALESCE(NULLIF(TRIM(ac.owner_admin_username), \'\'), \'—\') ASC, ac.id DESC'
          : ' ORDER BY ac.id DESC';
    const [rows] = await conn.query(
      `SELECT ac.id, ac.code, ac.max_uses, ac.used_count, ac.note, ac.created_at, ac.last_used_at,
              ac.used_by_username, ac.owner_admin_username,
              aa.full_name AS owner_admin_full_name,
              u.register_source_channel AS used_user_register_source,
              u.activation_source_channel AS used_user_activation_source
       FROM activation_codes ac
       LEFT JOIN users u ON u.username = ac.used_by_username
       LEFT JOIN admin_accounts aa ON aa.username = ac.owner_admin_username
       ${whereSql}${orderSql}
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    conn.release();
    var out = rows.map(function (r) {
      var regCh =
        r.used_user_register_source != null ? String(r.used_user_register_source).trim() : '';
      var actCh =
        r.used_user_activation_source != null ? String(r.used_user_activation_source).trim() : '';
      return {
        id: r.id,
        code: r.code,
        max_uses: r.max_uses,
        used_count: r.used_count,
        note: r.note,
        is_xianyu: isXianyuActivationNote(r.note),
        is_batch: isBatchActivationNote(r.note),
        channel_label: activationChannelLabelFromNote(r.note),
        channel: activationSourceFromCodeNote(r.note),
        created_at: r.created_at ? r.created_at.toISOString() : '',
        last_used_at: r.last_used_at ? r.last_used_at.toISOString() : null,
        used_by_username:
          r.used_by_username != null && String(r.used_by_username).trim() !== ''
            ? String(r.used_by_username).trim()
            : null,
        owner_admin_username:
          r.owner_admin_username != null && String(r.owner_admin_username).trim() !== ''
            ? String(r.owner_admin_username).trim()
            : null,
        owner_admin_full_name:
          r.owner_admin_full_name != null && String(r.owner_admin_full_name).trim() !== ''
            ? String(r.owner_admin_full_name).trim()
            : null,
        used_user_channel_label:
          r.used_by_username && String(r.used_by_username).trim() !== ''
            ? userChannelAnalysisLabel(regCh, actCh)
            : null
      };
    });
    res.json({ code: 200, data: { codes: out, total: total, page: page, limit: limit } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 管理员手动开通：按时长直接激活（可不填激活码）；仍兼容传 code */
async function handleAdminUserActivate(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  var code = body.code != null ? String(body.code).trim() : '';
  var grantDays = parseInt(body.grant_days, 10);
  var grantHours = parseInt(body.grant_hours, 10);
  var grantMinutes = parseInt(body.grant_minutes, 10);
  if (!isFinite(grantDays) || grantDays < 0) grantDays = 0;
  if (!isFinite(grantHours) || grantHours < 0) grantHours = 0;
  if (!isFinite(grantMinutes) || grantMinutes < 0) grantMinutes = 0;
  if (grantDays > 365) grantDays = 365;
  if (grantHours > 720) grantHours = 720;
  if (grantMinutes > 525600) grantMinutes = 525600;
  var wantPermanent =
    body.permanent === true ||
    body.permanent === 1 ||
    body.permanent === '1' ||
    String(body.duration || '').trim().toLowerCase() === 'permanent';
  if (!target) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  if (target.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    return res.status(400).json({ code: 400, msg: '不能操作保留账号名' });
  }
  /* 兼容旧客户端：仍可用激活码开通 */
  if (code) {
    const connLegacy = await pool.getConnection();
    try {
      const [urows] = await connLegacy.execute(
        'SELECT id, account_active, list_hidden_at FROM users WHERE username = ?',
        [target]
      );
      if (urows.length === 0) {
        connLegacy.release();
        return res.status(404).json({ code: 404, msg: '用户不存在' });
      }
      if (urows[0].list_hidden_at) {
        connLegacy.release();
        return res.status(400).json({ code: 400, msg: '该账号已在已删除列表中' });
      }
      var allowedLegacy = await adminCanAccessTargetUser(connLegacy, req.admin, target);
      if (!allowedLegacy) {
        connLegacy.release();
        return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
      }
      var alreadyLegacy =
        urows[0].account_active === 1 ||
        urows[0].account_active === true ||
        Number(urows[0].account_active) === 1;
      connLegacy.release();
      if (alreadyLegacy) {
        return res.json({
          code: 200,
          data: { username: target, account_active: true },
          msg: '账号已激活'
        });
      }
      await applyActivationCode(target, code);
      return res.json({
        code: 200,
        data: { username: target, account_active: true },
        msg: '激活成功'
      });
    } catch (e) {
      try {
        connLegacy.release();
      } catch (e2) {}
      return res.status(400).json({ code: 400, msg: e.message || String(e) });
    }
  }

  var isPermanent = wantPermanent || (grantDays < 1 && grantHours < 1 && grantMinutes < 1);
  if (!isPermanent && grantDays < 1 && grantHours < 1 && grantMinutes < 1) {
    return res.status(400).json({ code: 400, msg: '请选择激活时长' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [urows] = await conn.execute(
      `SELECT id, account_active, activation_kind, active_until, list_hidden_at
       FROM users WHERE username = ? FOR UPDATE`,
      [target]
    );
    if (urows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }
    if (urows[0].list_hidden_at) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ code: 400, msg: '该账号已在已删除列表中' });
    }
    var allowed = await adminCanAccessTargetUser(conn, req.admin, target);
    if (!allowed) {
      await conn.rollback();
      conn.release();
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    var row = urows[0];
    var kind = row.activation_kind != null ? String(row.activation_kind).trim() : '';
    if (kind === 'permanent' || (isUserPermanentActive(row) && kind !== 'trial')) {
      await conn.rollback();
      conn.release();
      return res.json({
        code: 200,
        data: { username: target, account_active: true, activation_kind: 'permanent' },
        msg: '账号已是永久激活'
      });
    }
    var already =
      row.account_active === 1 ||
      row.account_active === true ||
      Number(row.account_active) === 1;
    if (already && !isPermanent && kind === 'trial') {
      /* 已时效激活：允许用更长档覆盖/续期 */
    } else if (already && isPermanent) {
      /* 已激活改永久：走永久路径 */
    } else if (already) {
      await conn.rollback();
      conn.release();
      return res.json({
        code: 200,
        data: { username: target, account_active: true },
        msg: '账号已激活'
      });
    }

    var ownerAdmin =
      req.admin && req.admin.username ? String(req.admin.username).trim() : ADMIN_PANEL_USER;
    var plainCode = randomActivationCodePlain();
    var noteBits = ['管理员手动开通'];
    if (isPermanent) noteBits.push('永久');
    else {
      if (grantDays > 0) noteBits.push(grantDays + '天');
      if (grantHours > 0) noteBits.push(grantHours + '时');
      if (grantMinutes > 0) noteBits.push(grantMinutes + '分');
    }
    const [codeResult] = await conn.execute(
      `INSERT INTO activation_codes
       (code, max_uses, used_count, expires_at, grant_days, grant_hours, grant_minutes, note, last_used_at, used_by_username, owner_admin_username)
       VALUES (?, 1, 1, NULL, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)`,
      [
        plainCode,
        isPermanent ? null : grantDays || null,
        isPermanent ? null : grantHours || null,
        isPermanent ? null : grantMinutes || null,
        noteBits.join(' '),
        target,
        ownerAdmin || ADMIN_PANEL_USER
      ]
    );
    var grantResult;
    if (isPermanent) {
      await getInviteReward().setUserPermanentInConn(conn, target, 'admin_manual');
      grantResult = { kind: 'permanent', active_until: null };
    } else {
      grantResult = await getInviteReward().addTrialDurationInConn(
        conn,
        target,
        grantDays,
        grantHours,
        'admin_manual',
        String(codeResult.insertId),
        grantMinutes
      );
      await conn.execute(
        `UPDATE users SET activation_source_channel = COALESCE(NULLIF(TRIM(activation_source_channel), ''), ?)
         WHERE username = ?`,
        ['admin_manual', target]
      );
    }
    await conn.commit();
    conn.release();
    invalidateUserAuthCache(target);
    invalidateUserInfoApiCache(target);
    var msg = isPermanent
      ? '已永久激活'
      : '已激活 ' +
        (grantDays > 0 ? grantDays + ' 天' : '') +
        (grantHours > 0 ? (grantDays > 0 ? ' ' : '') + grantHours + ' 小时' : '') +
        (grantMinutes > 0
          ? (grantDays > 0 || grantHours > 0 ? ' ' : '') + grantMinutes + ' 分钟'
          : '');
    return res.json({
      code: 200,
      data: {
        username: target,
        account_active: true,
        activation_kind: grantResult.kind || (isPermanent ? 'permanent' : 'trial'),
        active_until: grantResult.active_until || null,
        grant_days: isPermanent ? 0 : grantDays,
        grant_hours: isPermanent ? 0 : grantHours,
        grant_minutes: isPermanent ? 0 : grantMinutes
      },
      msg: msg
    });
  } catch (e) {
    try {
      await conn.rollback();
    } catch (e2) {}
    try {
      conn.release();
    } catch (e3) {}
    return res.status(400).json({ code: 400, msg: e.message || String(e) });
  }
}

/** 管理端：将时效/试用账号改为永久激活（清除 active_until） */
async function handleAdminUserMakePermanent(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  if (!target) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  if (target.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    return res.status(400).json({ code: 400, msg: '不能操作保留账号名' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [urows] = await conn.execute(
      `SELECT id, account_active, activation_kind, active_until, list_hidden_at
       FROM users WHERE username = ? FOR UPDATE`,
      [target]
    );
    if (!urows.length) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }
    if (urows[0].list_hidden_at) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ code: 400, msg: '该账号已在已删除列表中' });
    }
    var allowed = await adminCanAccessTargetUser(conn, req.admin, target);
    if (!allowed) {
      await conn.rollback();
      conn.release();
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    var row = urows[0];
    var kind = row.activation_kind != null ? String(row.activation_kind).trim() : '';
    if (kind === 'permanent' || (isUserPermanentActive(row) && kind !== 'trial')) {
      await conn.rollback();
      conn.release();
      return res.json({
        code: 200,
        data: { username: target, activation_kind: 'permanent', active_until: null },
        msg: '账号已是永久激活'
      });
    }
    var hasUntil = row.active_until != null && String(row.active_until).trim() !== '';
    if (kind !== 'trial' && !hasUntil) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ code: 400, msg: '仅带过期时间的时效账号可改为永久' });
    }
    await getInviteReward().setUserPermanentInConn(conn, target, null);
    await conn.commit();
    conn.release();
    invalidateUserAuthCache(target);
    invalidateUserInfoApiCache(target);
    return res.json({
      code: 200,
      data: { username: target, activation_kind: 'permanent', active_until: null },
      msg: '已改为永久账号'
    });
  } catch (e) {
    try {
      await conn.rollback();
    } catch (e2) {}
    try {
      conn.release();
    } catch (e3) {}
    return res.status(500).json({ code: 500, msg: e.message || String(e) });
  }
}

/** 管理端：查询账号专属报价 */
async function handleAdminUserPriceOfferGet(req, res) {
  var target =
    (req.query && req.query.username != null ? String(req.query.username) : '') ||
    (req.body && req.body.username != null ? String(req.body.username) : '');
  target = String(target || '').trim();
  if (!target) {
    return res.status(400).json({ code: 400, msg: '请填写账号' });
  }
  const conn = await pool.getConnection();
  try {
    const [urows] = await conn.execute(
      'SELECT id, username FROM users WHERE username = ? AND list_hidden_at IS NULL LIMIT 1',
      [target]
    );
    if (!urows.length) {
      return res.status(404).json({ code: 404, msg: '用户不存在或已删除' });
    }
    var canonicalUsername = String(urows[0].username || target);
    var allowed = await adminCanAccessTargetUser(conn, req.admin, canonicalUsername);
    if (!allowed) {
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    var offer = await getUserPriceOffers().getOffer(canonicalUsername, {
      enabledOnly: false
    });
    return res.json({
      code: 200,
      data: {
        username: canonicalUsername,
        offer: offer,
        skus: await getUserPriceOffers().listOfferableSkusLive()
      }
    });
  } catch (e) {
    console.error('admin user price offer get', e);
    return res.status(500).json({ code: 500, msg: '读取专属报价失败' });
  } finally {
    conn.release();
  }
}

/** 管理端：设置账号专属报价（SKU + 特价） */
async function handleAdminUserPriceOfferSet(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  if (!target) {
    return res.status(400).json({ code: 400, msg: '请填写账号' });
  }
  if (target.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    return res.status(400).json({ code: 400, msg: '不能操作保留账号名' });
  }
  const conn = await pool.getConnection();
  var canonicalUsername = target;
  try {
    const [urows] = await conn.execute(
      'SELECT id, username FROM users WHERE username = ? AND list_hidden_at IS NULL LIMIT 1',
      [target]
    );
    if (!urows.length) {
      return res.status(404).json({ code: 404, msg: '用户不存在或已删除' });
    }
    canonicalUsername = String(urows[0].username || target);
    var allowed = await adminCanAccessTargetUser(conn, req.admin, canonicalUsername);
    if (!allowed) {
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
  } finally {
    conn.release();
  }
  try {
    var adminName =
      req.admin && req.admin.username != null ? String(req.admin.username) : '';
    var offer = await getUserPriceOffers().upsertOffer(
      canonicalUsername,
      {
        sku_id: body.sku_id,
        amount: body.amount,
        label: body.label,
        note: body.note
      },
      adminName
    );
    return res.json({
      code: 200,
      msg:
        '已为「' +
        canonicalUsername +
        '」设置专属价 ¥' +
        (offer && offer.amount ? offer.amount : '') +
        '（打开购买页即生效）',
      data: { username: canonicalUsername, offer: offer }
    });
  } catch (e) {
    var code = e && e.statusCode ? e.statusCode : 500;
    return res.status(code).json({ code: code, msg: (e && e.message) || '设置失败' });
  }
}

/** 管理端：取消账号专属报价 */
async function handleAdminUserPriceOfferClear(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  if (!target) {
    return res.status(400).json({ code: 400, msg: '请填写账号' });
  }
  const conn = await pool.getConnection();
  var canonicalUsername = target;
  try {
    const [urows] = await conn.execute(
      'SELECT id, username FROM users WHERE username = ? AND list_hidden_at IS NULL LIMIT 1',
      [target]
    );
    if (!urows.length) {
      return res.status(404).json({ code: 404, msg: '用户不存在或已删除' });
    }
    canonicalUsername = String(urows[0].username || target);
    var allowed = await adminCanAccessTargetUser(conn, req.admin, canonicalUsername);
    if (!allowed) {
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
  } finally {
    conn.release();
  }
  try {
    var out = await getUserPriceOffers().clearOffer(canonicalUsername);
    return res.json({
      code: 200,
      msg: out.cleared
        ? '已取消「' + canonicalUsername + '」的专属报价'
        : '该账号暂无启用中的专属报价',
      data: { username: canonicalUsername, offer: out.offer || null }
    });
  } catch (e) {
    var code = e && e.statusCode ? e.statusCode : 500;
    return res.status(code).json({ code: code, msg: (e && e.message) || '取消失败' });
  }
}

/** 管理端：心理价出价列表（默认待处理）+ 各状态计数 + 当前底价线配置 */
async function handleAdminPriceBidsList(req, res) {
  try {
    var q = req.query || {};
    var out = await getPriceBids().listBids({ status: q.status, limit: q.limit });
    var cfg = await getPriceBids().loadConfig();
    return res.json({ code: 200, data: { items: out.items, counts: out.counts, config: cfg } });
  } catch (e) {
    console.error('admin price bids list', e);
    return res.status(500).json({ code: 500, msg: '读取出价列表失败' });
  }
}

/** 管理端：通过（可改成交价）/ 驳回一条心理价出价 */
async function handleAdminPriceBidsReview(req, res) {
  try {
    var body = req.body || {};
    var adminName = req.admin && req.admin.username != null ? String(req.admin.username) : 'admin';
    var out = await getPriceBids().reviewBid({
      id: body.id,
      action: body.action,
      amount: body.amount,
      admin: adminName
    });
    var mailHint = '';
    if (out && out.email_sent) {
      mailHint = '，已同步邮件通知';
    } else if (out && out.email_reason === 'no_email') {
      mailHint = '，该用户未留有效邮箱（仅站内信）';
    } else if (out && out.email_reason === 'no_smtp') {
      mailHint = '，SMTP 未配置（仅站内信）';
    } else if (out && (out.email_reason === 'send_error' || out.email_reason === 'send_failed')) {
      mailHint = '，邮件发送失败（已站内信）';
    }
    return res.json({
      code: 200,
      msg:
        out.status === 'accepted'
          ? '已通过，¥' + out.accepted_amount + ' 专属价已生效（站内信' + mailHint + '）'
          : '已驳回并站内信告知' + mailHint,
      data: out
    });
  } catch (e) {
    var code = e && e.statusCode ? e.statusCode : 500;
    if (code === 500) console.error('admin price bids review', e);
    return res.status(code).json({ code: code, msg: (e && e.message) || '处理失败' });
  }
}

/** 管理端：保存心理价出价配置（开关/自动通过线/最低价/每日次数） */
async function handleAdminPriceBidsConfigSet(req, res) {
  try {
    var cfg = await getPriceBids().saveConfig(req.body || {});
    return res.json({ code: 200, msg: '出价配置已保存', data: cfg });
  } catch (e) {
    console.error('admin price bids config set', e);
    return res.status(500).json({ code: 500, msg: '保存出价配置失败' });
  }
}

/** 管理端：取消或恢复指定账号的改名费 / 个税修改费（同一白名单） */
async function handleAdminUserRenameFeeExempt(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  var exempt =
    body.exempt === true || body.exempt === 1 || String(body.exempt || '') === '1';
  if (!target) {
    return res.status(400).json({ code: 400, msg: '请填写账号' });
  }
  const conn = await pool.getConnection();
  try {
    const [urows] = await conn.execute(
      'SELECT id, username FROM users WHERE username = ? AND list_hidden_at IS NULL LIMIT 1',
      [target]
    );
    if (!urows.length) {
      return res.status(404).json({ code: 404, msg: '用户不存在或已删除' });
    }
    var canonicalUsername = String(urows[0].username || target);
    var allowed = await adminCanAccessTargetUser(conn, req.admin, canonicalUsername);
    if (!allowed) {
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    await conn.execute(
      'UPDATE users SET rename_fee_exempt = ? WHERE username = ?',
      [exempt ? 1 : 0, canonicalUsername]
    );
    invalidateUserInfoApiCache(canonicalUsername);
    return res.json({
      code: 200,
      msg: exempt
        ? '已取消该账号的改名与个税修改限制'
        : '已重新加改名与个税修改限制',
      data: {
        username: canonicalUsername,
        rename_fee_exempt: exempt,
        tax_edit_fee_exempt: exempt
      }
    });
  } catch (e) {
    console.error('admin user rename fee exempt', e);
    return res.status(500).json({ code: 500, msg: '修改改名/个税限制失败' });
  } finally {
    conn.release();
  }
}

/** 管理端：手动设置或取消账号的「代理」标识 */
async function handleAdminUserAgentFlag(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  var isAgent =
    body.is_agent === true ||
    body.is_agent === 1 ||
    String(body.is_agent || '') === '1' ||
    body.agent === true ||
    body.agent === 1 ||
    String(body.agent || '') === '1';
  if (!target) {
    return res.status(400).json({ code: 400, msg: '请填写账号' });
  }
  const conn = await pool.getConnection();
  try {
    const [urows] = await conn.execute(
      'SELECT id, username FROM users WHERE username = ? AND list_hidden_at IS NULL LIMIT 1',
      [target]
    );
    if (!urows.length) {
      return res.status(404).json({ code: 404, msg: '用户不存在或已删除' });
    }
    var canonicalUsername = String(urows[0].username || target);
    var allowed = await adminCanAccessTargetUser(conn, req.admin, canonicalUsername);
    if (!allowed) {
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    await conn.execute('UPDATE users SET is_agent = ? WHERE username = ?', [
      isAgent ? 1 : 0,
      canonicalUsername
    ]);
    invalidateUserInfoApiCache(canonicalUsername);
    return res.json({
      code: 200,
      msg: isAgent ? '已设为代理标识' : '已取消代理标识',
      data: { username: canonicalUsername, is_agent: isAgent }
    });
  } catch (e) {
    console.error('admin user agent flag', e);
    return res.status(500).json({ code: 500, msg: '设置代理标识失败' });
  } finally {
    conn.release();
  }
}

/** 管理端：为指定账号开通或关闭离职证明生成权益 */
async function handleAdminUserLizhiCertUnlock(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  var unlocked =
    body.unlocked === true ||
    body.unlocked === 1 ||
    String(body.unlocked || '') === '1';
  if (!target) {
    return res.status(400).json({ code: 400, msg: '请填写账号' });
  }
  const conn = await pool.getConnection();
  try {
    const [urows] = await conn.execute(
      'SELECT id, username FROM users WHERE username = ? AND list_hidden_at IS NULL LIMIT 1',
      [target]
    );
    if (!urows.length) {
      return res.status(404).json({ code: 404, msg: '用户不存在或已删除' });
    }
    var canonicalUsername = String(urows[0].username || target);
    var allowed = await adminCanAccessTargetUser(conn, req.admin, canonicalUsername);
    if (!allowed) {
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    await conn.execute(
      'UPDATE users SET lizhi_cert_unlocked = ? WHERE username = ?',
      [unlocked ? 1 : 0, canonicalUsername]
    );
    invalidateUserInfoApiCache(canonicalUsername);
    return res.json({
      code: 200,
      msg: unlocked ? '已开通该账号的离职证明功能' : '已关闭该账号的离职证明功能',
      data: { username: canonicalUsername, lizhi_cert_unlocked: unlocked }
    });
  } catch (e) {
    console.error('admin user lizhi cert unlock', e);
    return res.status(500).json({ code: 500, msg: '修改离职证明开通状态失败' });
  } finally {
    conn.release();
  }
}

/** 管理端：为指定账号开通或关闭在职/工作证明生成权益 */
async function handleAdminUserZaizhiCertUnlock(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  var unlocked =
    body.unlocked === true ||
    body.unlocked === 1 ||
    String(body.unlocked || '') === '1';
  if (!target) {
    return res.status(400).json({ code: 400, msg: '请填写账号' });
  }
  const conn = await pool.getConnection();
  try {
    const [urows] = await conn.execute(
      'SELECT id, username FROM users WHERE username = ? AND list_hidden_at IS NULL LIMIT 1',
      [target]
    );
    if (!urows.length) {
      return res.status(404).json({ code: 404, msg: '用户不存在或已删除' });
    }
    var canonicalUsername = String(urows[0].username || target);
    var allowed = await adminCanAccessTargetUser(conn, req.admin, canonicalUsername);
    if (!allowed) {
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    await conn.execute(
      'UPDATE users SET zaizhi_cert_unlocked = ? WHERE username = ?',
      [unlocked ? 1 : 0, canonicalUsername]
    );
    invalidateUserInfoApiCache(canonicalUsername);
    return res.json({
      code: 200,
      msg: unlocked ? '已开通该账号的在职证明功能' : '已关闭该账号的在职证明功能',
      data: { username: canonicalUsername, zaizhi_cert_unlocked: unlocked }
    });
  } catch (e) {
    console.error('admin user zaizhi cert unlock', e);
    return res.status(500).json({ code: 500, msg: '修改在职证明开通状态失败' });
  } finally {
    conn.release();
  }
}

/** 管理员重置密码 */
async function handleAdminUserPassword(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  var newPassword = body.new_password != null ? String(body.new_password) : '';
  if (!target) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  var pwdErr = validatePassword(newPassword);
  if (pwdErr) {
    return res.status(400).json({ code: 400, msg: pwdErr });
  }
  if (target.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    return res.status(400).json({ code: 400, msg: '不能操作保留账号名' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      const [urows] = await conn.execute('SELECT id FROM users WHERE username = ?', [target]);
      if (urows.length === 0) {
        return res.status(404).json({ code: 404, msg: '用户不存在' });
      }
      var allowed = await adminCanAccessTargetUser(conn, req.admin, target);
      if (!allowed) {
        return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
      }
      var saltBuf = crypto.randomBytes(16);
      var saltHex = saltBuf.toString('hex');
      var hashHex = hashPasswordWithSalt(newPassword, saltBuf);
      var storePlainVal = plainPasswordStore.encodePlainPasswordForStore(newPassword);
      await conn.execute(
        'UPDATE users SET salt = ?, hash = ?, plain_password = ?, session_rev = session_rev + 1 WHERE username = ?',
        [saltHex, hashHex, storePlainVal, target]
      );
      invalidateUserAuthCache(target);
      return res.json({ code: 200, data: { username: target }, msg: '密码已修改' });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 封禁/解封用户 */
async function handleAdminBan(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  var ban = body.banned === 1 || body.banned === true || body.banned === '1';
  if (!target) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  if (target.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    return res.status(400).json({ code: 400, msg: '不能操作保留账号名' });
  }
  try {
    const conn = await pool.getConnection();
    const [urows] = await conn.execute('SELECT id FROM users WHERE username = ?', [target]);
    if (urows.length === 0) {
      conn.release();
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }
    var allowed = await adminCanAccessTargetUser(conn, req.admin, target);
    if (!allowed) {
      conn.release();
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    if (ban) {
      await conn.execute(
        'UPDATE users SET banned = 1, session_rev = session_rev + 1 WHERE username = ?',
        [target]
      );
    } else {
      await conn.execute('UPDATE users SET banned = 0 WHERE username = ?', [target]);
    }
    conn.release();
    invalidateUserAuthCache(target);
    return res.json({ code: 200, data: { username: target, banned: ban, session_revoked: !!ban } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 封禁 IP */
async function handleAdminBlockIp(req, res) {
  var body = req.body || {};
  var ip = body.ip != null ? String(body.ip).trim() : '';
  var reason = body.reason != null ? String(body.reason).trim() : '';
  if (!ip) {
    return res.status(400).json({ code: 400, msg: 'ip required' });
  }
  try {
    const conn = await pool.getConnection();
    await conn.execute('INSERT IGNORE INTO blocked_ips (ip, blocked_by, reason) VALUES (?, ?, ?)', [ip, req.admin, reason || null]);
    conn.release();
    return res.json({ code: 200, data: { ip: ip, blocked: true } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 解封 IP */
async function handleAdminUnblockIp(req, res) {
  var body = req.body || {};
  var ip = body.ip != null ? String(body.ip).trim() : '';
  if (!ip) {
    return res.status(400).json({ code: 400, msg: 'ip required' });
  }
  try {
    const conn = await pool.getConnection();
    await conn.execute('DELETE FROM blocked_ips WHERE ip = ?', [ip]);
    conn.release();
    return res.json({ code: 200, data: { ip: ip, blocked: false } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 获取 IP 黑名单列表 */
async function handleAdminBlockedIpsList(req, res) {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      'SELECT id, ip, blocked_by, reason, created_at FROM blocked_ips ORDER BY created_at DESC LIMIT 500'
    );
    conn.release();
    return res.json({ code: 200, data: rows || [] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 读取系统设置 */
async function handleAdminSettingsGet(req, res) {
  try {
    var salesAgent = await loadSalesAgentParsed();
    /* 仅「联系方式配置」：不返回增长/安装/邀请等敏感配置 */
    if (!adminHasFullSettingsMenu(req.admin)) {
      return res.json({
        code: 200,
        data: {
          sales_agent: salesAgentPublicPayload(salesAgent)
        }
      });
    }
    var mineUi = await getMineUiForAdminForm();
    var installRaw = await getInstallPackageSettingsFromDb();
    var qrRef = await getWechatPayQrcodeUrl();
    var conversionAb = await loadConversionAbParsed();
    var landingAb = await loadLandingAbParsed();
    var activationNudge = await loadActivationNudgeParsed();
    return res.json({
      code: 200,
      data: {
        mine_ui: mineUi,
        android_apk_download_url: installRaw.android,
        agent_android_apk_download_url: installRaw.agent_android,
        ios_mobileconfig_download_url: installRaw.ios,
        xianyu_purchase_url: installRaw.xianyu,
        xianyu_hide_sales_channels: (installRaw.xianyu_hide_channels || []).join('\n'),
        qq_add_url: sanitizeInstallDownloadUrl(installRaw.qq),
        qq_group_url: sanitizeInstallDownloadUrl(installRaw.qq_group),
        wechat_pay_qrcode_url: qrRef,
        wechat_pay_qrcode_display_url: resolvePublicAssetUrl(qrRef),
        conversion_ab: conversionAb,
        landing_ab: landingAb,
        sales_agent: salesAgentPublicPayload(salesAgent),
        pricing_ab: await getPricingAb().loadPricingAbParsed(true),
        sku_catalog_prices: await getPricingAb().loadCatalogAmounts(true),
        sku_catalog: await getPricingAb().loadCatalogConfig(true),
        tax_edit_fee: await loadTaxEditFeeConfig(true),
        rename_fee: await loadRenameFeeConfig(true),
        lizhi_cert_fee: await loadLizhiCertFeeConfig(true),
        najilu_qr_fee: await najiluQrMod.loadNajiluQrFeeConfig(true),
        activation_nudge: activationNudge
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 保存系统设置 */
async function handleAdminSettingsPost(req, res) {
  var body = req.body || {};
  var hasMineUi = body.mine_ui != null && typeof body.mine_ui === 'object';
  var hasAndroid = Object.prototype.hasOwnProperty.call(body, 'android_apk_download_url');
  var hasAgentAndroid = Object.prototype.hasOwnProperty.call(body, 'agent_android_apk_download_url');
  var hasIos = Object.prototype.hasOwnProperty.call(body, 'ios_mobileconfig_download_url');
  var hasXianyu = Object.prototype.hasOwnProperty.call(body, 'xianyu_purchase_url');
  var hasXianyuHideChannels = Object.prototype.hasOwnProperty.call(body, 'xianyu_hide_sales_channels');
  var hasQqAdd = Object.prototype.hasOwnProperty.call(body, 'qq_add_url');
  var hasQqGroup = Object.prototype.hasOwnProperty.call(body, 'qq_group_url');
  var hasWechatPayQr = Object.prototype.hasOwnProperty.call(body, 'wechat_pay_qrcode_url');
  var hasConversionAb = body.conversion_ab != null && typeof body.conversion_ab === 'object';
  var hasLandingAb = body.landing_ab != null && typeof body.landing_ab === 'object';
  var hasSalesAgent = body.sales_agent != null && typeof body.sales_agent === 'object';
  var hasPricingAb = body.pricing_ab != null && typeof body.pricing_ab === 'object';
  var hasSkuCatalogPrices =
    (body.sku_catalog != null && typeof body.sku_catalog === 'object') ||
    (body.sku_catalog_prices != null && typeof body.sku_catalog_prices === 'object');
  var hasTaxEditFee = body.tax_edit_fee != null && typeof body.tax_edit_fee === 'object';
  var hasRenameFee = body.rename_fee != null && typeof body.rename_fee === 'object';
  var hasLizhiCertFee = body.lizhi_cert_fee != null && typeof body.lizhi_cert_fee === 'object';
  var hasNajiluQrFee = body.najilu_qr_fee != null && typeof body.najilu_qr_fee === 'object';
  var hasActivationNudge = body.activation_nudge != null && typeof body.activation_nudge === 'object';
  if (
    !hasMineUi &&
    !hasAndroid &&
    !hasAgentAndroid &&
    !hasIos &&
    !hasXianyu &&
    !hasXianyuHideChannels &&
    !hasQqAdd &&
    !hasQqGroup &&
    !hasWechatPayQr &&
    !hasConversionAb &&
    !hasLandingAb &&
    !hasSalesAgent &&
    !hasPricingAb &&
    !hasSkuCatalogPrices &&
    !hasTaxEditFee &&
    !hasRenameFee &&
    !hasLizhiCertFee &&
    !hasNajiluQrFee &&
    !hasActivationNudge
  ) {
    return res.status(400).json({
      code: 400,
      msg: '请提供 mine_ui、安装包下载地址、闲鱼购买链接、闲鱼隐藏渠道、转化 A/B 配置、落地页 A/B 配置、C 方案销售代理、定价 A/B 配置、支付套餐、个税修改收费、改名费用、离职证明价格、完税二维码价格或激活引导弹窗配置'
    });
  }

  var salesContactsOnly = !adminHasFullSettingsMenu(req.admin);
  if (salesContactsOnly) {
    if (
      !hasSalesAgent ||
      hasMineUi ||
      hasAndroid ||
      hasAgentAndroid ||
      hasIos ||
      hasXianyu ||
      hasXianyuHideChannels ||
      hasQqAdd ||
      hasQqGroup ||
      hasWechatPayQr ||
      hasConversionAb ||
      hasLandingAb ||
      hasPricingAb ||
      hasSkuCatalogPrices ||
      hasTaxEditFee ||
      hasRenameFee ||
      hasLizhiCertFee ||
      hasNajiluQrFee ||
      hasActivationNudge
    ) {
      return res.status(403).json({
        code: 403,
        msg: '当前账号仅可修改「联系方式配置」中的销售代理联系方式'
      });
    }
  }

  const conn = await pool.getConnection();
  try {
    if (hasMineUi) {
      var prev = await loadMineUiParsed();
      var merged = Object.assign({ use_default_images: false }, cloneMineUiDefaults());
      if (prev) {
        if (prev.theme === 'yellow' || prev.theme === 'blue') {
          merged.theme = prev.theme;
        }
        merged.use_default_images = prev.use_default_images === true;
        MINE_UI_IMAGE_KEYS.forEach(function (k) {
          if (prev[k] != null) {
            var okPrev = sanitizeMineUiImageRef(prev[k]);
            if (okPrev) {
              merged[k] = okPrev;
            }
          }
        });
        MINE_UI_VIDEO_KEYS.forEach(function (k) {
          if (prev[k] != null) {
            var okPrev = sanitizeMineUiImageRef(prev[k]);
            if (okPrev) {
              merged[k] = okPrev;
            }
          }
        });
        INSTALL_SHOWCASE_IMAGE_KEYS.forEach(function (k) {
          if (prev[k] != null) {
            var okPrevShow = sanitizeMineUiImageRef(prev[k]);
            if (okPrevShow) {
              merged[k] = okPrevShow;
            }
          }
        });
      }
      var incoming = body.mine_ui;
      if (incoming.theme === 'blue' || incoming.theme === 'yellow') {
        merged.theme = incoming.theme;
      }
      if (incoming.use_default_images === true || incoming.use_default_images === 'true' || incoming.use_default_images === 1) {
        merged.use_default_images = true;
      } else if (Object.prototype.hasOwnProperty.call(incoming, 'use_default_images')) {
        merged.use_default_images = false;
      }
      MINE_UI_IMAGE_KEYS.forEach(function (k) {
        if (incoming[k] != null && String(incoming[k]).trim() !== '') {
          if (k === 'message_header' && isDeprecatedMessageHeaderRef(incoming[k])) {
            merged.message_header = '';
            return;
          }
          var ok = sanitizeMineUiImageRef(String(incoming[k]).trim());
          if (ok) {
            merged[k] = ok;
          }
        }
      });
      if (
        Object.prototype.hasOwnProperty.call(incoming, 'message_header') &&
        String(incoming.message_header || '').trim() === ''
      ) {
        merged.message_header = '';
      }
      MINE_UI_VIDEO_KEYS.forEach(function (k) {
        if (incoming[k] != null && String(incoming[k]).trim() !== '') {
          var ok = sanitizeMineUiImageRef(String(incoming[k]).trim());
          if (ok) {
            merged[k] = ok;
          }
        }
      });
      INSTALL_SHOWCASE_IMAGE_KEYS.forEach(function (k) {
        if (incoming[k] != null && String(incoming[k]).trim() !== '') {
          var okShow = sanitizeMineUiImageRef(String(incoming[k]).trim());
          if (okShow) {
            merged[k] = okShow;
          }
        }
      });
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_MINE_UI, JSON.stringify(merged)]
      );
    }

    if (hasAndroid) {
      var rawA = body.android_apk_download_url;
      var okA = sanitizeInstallDownloadUrl(rawA);
      if (rawA != null && String(rawA).trim() !== '' && !okA) {
        return res.status(400).json({ code: 400, msg: '安卓安装包地址无效（请使用 http 或 https 完整链接）' });
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_ANDROID_APK, okA]
      );
    }

    if (hasAgentAndroid) {
      var rawAgentA = body.agent_android_apk_download_url;
      var okAgentA = sanitizeInstallDownloadUrl(rawAgentA);
      if (rawAgentA != null && String(rawAgentA).trim() !== '' && !okAgentA) {
        return res.status(400).json({
          code: 400,
          msg: '代理专用安卓安装包地址无效（请使用 http 或 https 完整链接）'
        });
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_AGENT_ANDROID_APK, okAgentA]
      );
    }

    if (hasIos) {
      var rawI = body.ios_mobileconfig_download_url;
      var okI = sanitizeInstallDownloadUrl(rawI);
      if (rawI != null && String(rawI).trim() !== '' && !okI) {
        return res.status(400).json({
          code: 400,
          msg: 'iOS 描述文件地址无效（http(s) 完整链接，或以 / 开头的站内路径）'
        });
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_IOS_MOBILECONFIG, okI]
      );
    }

    if (hasXianyu) {
      var okX = sanitizeXianyuPurchaseText(body.xianyu_purchase_url);
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_XIANYU_PURCHASE, okX]
      );
    }

    if (hasXianyuHideChannels) {
      var hideList = parseXianyuHideSalesChannels(body.xianyu_hide_sales_channels);
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_XIANYU_HIDE_CHANNELS, serializeXianyuHideSalesChannels(hideList)]
      );
    }

    if (hasQqAdd) {
      var rawQq = body.qq_add_url;
      var okQq = sanitizeInstallDownloadUrl(rawQq);
      if (rawQq != null && String(rawQq).trim() !== '' && !okQq) {
        return res.status(400).json({
          code: 400,
          msg: 'QQ 添加链接无效（请使用 http 或 https 完整链接）'
        });
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_QQ_ADD_URL, okQq]
      );
    }

    if (hasQqGroup) {
      var rawQqGroup = body.qq_group_url;
      var okQqGroup = sanitizeInstallDownloadUrl(rawQqGroup);
      if (rawQqGroup != null && String(rawQqGroup).trim() !== '' && !okQqGroup) {
        return res.status(400).json({
          code: 400,
          msg: 'QQ 加群链接无效（请使用 http 或 https 完整链接）'
        });
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_QQ_GROUP_URL, okQqGroup]
      );
    }

    if (hasWechatPayQr) {
      var rawQr = body.wechat_pay_qrcode_url;
      var okQr = '';
      if (rawQr != null && String(rawQr).trim() !== '') {
        okQr = sanitizeMineUiImageRef(String(rawQr).trim());
        if (!okQr) {
          return res.status(400).json({
            code: 400,
            msg: '微信收款码地址无效（请上传图片或填写 uploads/… 或 https 链接）'
          });
        }
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_WECHAT_PAY_QRCODE, okQr]
      );
      invalidateWechatPayQrcodeCache();
    }

    if (hasConversionAb) {
      var prevAb = await loadConversionAbParsed();
      var incAb = body.conversion_ab;
      var mergedAb = Object.assign({}, prevAb);
      if (incAb.enabled === true || incAb.enabled === false) {
        mergedAb.enabled = incAb.enabled === true;
      }
      if (incAb.activate_title_a != null) {
        mergedAb.activate_title_a = String(incAb.activate_title_a).substring(0, 120);
      }
      if (incAb.activate_subtitle_a != null) {
        mergedAb.activate_subtitle_a = String(incAb.activate_subtitle_a).substring(0, 200);
      }
      if (incAb.activate_title_b != null) {
        mergedAb.activate_title_b = String(incAb.activate_title_b).substring(0, 120);
      }
      if (incAb.activate_subtitle_b != null) {
        mergedAb.activate_subtitle_b = String(incAb.activate_subtitle_b).substring(0, 200);
      }
      if (incAb.batch_example_prominent === true || incAb.batch_example_prominent === false) {
        mergedAb.batch_example_prominent = incAb.batch_example_prominent === true;
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_CONVERSION_AB, JSON.stringify(mergedAb)]
      );
    }

    if (hasLandingAb) {
      var incLandingAb = body.landing_ab;
      var landingPct = parseInt(incLandingAb.c_percent, 10);
      if (!isFinite(landingPct) || landingPct < 0 || landingPct > 100) {
        return res.status(400).json({ code: 400, msg: 'C 方案流量占比必须是 0–100 的整数' });
      }
      var mergedLandingAb = {
        enabled: incLandingAb.enabled !== false,
        c_percent: Math.round(landingPct)
      };
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_LANDING_AB, JSON.stringify(mergedLandingAb)]
      );
    }

    if (hasSalesAgent) {
      var prevSalesAgent = await loadSalesAgentParsed();
      var mergedSalesAgent = normalizeSalesAgentConfig(
        Object.assign({}, prevSalesAgent, body.sales_agent)
      );
      if (
        body.sales_agent.wechat_qr_url != null &&
        String(body.sales_agent.wechat_qr_url).trim() !== '' &&
        !mergedSalesAgent.wechat_qr_url
      ) {
        return res.status(400).json({
          code: 400,
          msg: '销售代理微信二维码地址无效（请上传图片或填写 uploads/… 或 https 链接）'
        });
      }
      await conn.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [SETTING_KEY_SALES_AGENT, JSON.stringify(mergedSalesAgent)]
      );
      invalidateInstallPackagesResponseCache();
    }

    if (hasPricingAb) {
      try {
        await getPricingAb().savePricingAbFromAdmin(body.pricing_ab);
      } catch (ePricingSave) {
        var pricingMsg = ePricingSave && ePricingSave.message ? String(ePricingSave.message) : '保存定价失败';
        return res.status(ePricingSave && ePricingSave.statusCode === 400 ? 400 : 500).json({
          code: ePricingSave && ePricingSave.statusCode === 400 ? 400 : 500,
          msg: pricingMsg
        });
      }
    }

    if (hasSkuCatalogPrices) {
      try {
        await getPricingAb().saveCatalogAmountsFromAdmin(
          body.sku_catalog && typeof body.sku_catalog === 'object'
            ? body.sku_catalog
            : body.sku_catalog_prices
        );
      } catch (eSkuPriceSave) {
        var skuPriceMsg =
          eSkuPriceSave && eSkuPriceSave.message ? String(eSkuPriceSave.message) : '保存套餐价格失败';
        return res.status(eSkuPriceSave && eSkuPriceSave.statusCode === 400 ? 400 : 500).json({
          code: eSkuPriceSave && eSkuPriceSave.statusCode === 400 ? 400 : 500,
          msg: skuPriceMsg
        });
      }
    }

    if (hasTaxEditFee) {
      try {
        await saveTaxEditFeeConfigFromAdmin(body.tax_edit_fee);
      } catch (eTaxFeeSave) {
        var taxFeeMsg =
          eTaxFeeSave && eTaxFeeSave.message ? String(eTaxFeeSave.message) : '保存个税修改收费失败';
        return res.status(eTaxFeeSave && eTaxFeeSave.statusCode === 400 ? 400 : 500).json({
          code: eTaxFeeSave && eTaxFeeSave.statusCode === 400 ? 400 : 500,
          msg: taxFeeMsg
        });
      }
    }

    if (hasRenameFee) {
      try {
        await saveRenameFeeConfigFromAdmin(body.rename_fee);
      } catch (eRenameFeeSave) {
        var renameFeeMsg =
          eRenameFeeSave && eRenameFeeSave.message ? String(eRenameFeeSave.message) : '保存改名费用失败';
        return res.status(eRenameFeeSave && eRenameFeeSave.statusCode === 400 ? 400 : 500).json({
          code: eRenameFeeSave && eRenameFeeSave.statusCode === 400 ? 400 : 500,
          msg: renameFeeMsg
        });
      }
    }

    if (hasLizhiCertFee) {
      try {
        await saveLizhiCertFeeConfigFromAdmin(body.lizhi_cert_fee);
      } catch (eLizhiFeeSave) {
        var lizhiFeeMsg =
          eLizhiFeeSave && eLizhiFeeSave.message
            ? String(eLizhiFeeSave.message)
            : '保存离职证明价格失败';
        return res.status(eLizhiFeeSave && eLizhiFeeSave.statusCode === 400 ? 400 : 500).json({
          code: eLizhiFeeSave && eLizhiFeeSave.statusCode === 400 ? 400 : 500,
          msg: lizhiFeeMsg
        });
      }
    }

    if (hasNajiluQrFee) {
      try {
        await najiluQrMod.saveNajiluQrFeeConfigFromAdmin(body.najilu_qr_fee);
      } catch (eNajiluFeeSave) {
        var najiluFeeMsg =
          eNajiluFeeSave && eNajiluFeeSave.message
            ? String(eNajiluFeeSave.message)
            : '保存完税二维码价格失败';
        return res.status(eNajiluFeeSave && eNajiluFeeSave.statusCode === 400 ? 400 : 500).json({
          code: eNajiluFeeSave && eNajiluFeeSave.statusCode === 400 ? 400 : 500,
          msg: najiluFeeMsg
        });
      }
    }

    if (hasActivationNudge) {
      await saveActivationNudgeFromAdmin(body.activation_nudge);
    }

    if (
      hasAndroid ||
      hasAgentAndroid ||
      hasIos ||
      hasXianyu ||
      hasXianyuHideChannels ||
      hasQqAdd ||
      hasQqGroup
    ) {
      invalidateInstallPackageSettingsCache();
    }

    var outData = { success: true };
    outData.sales_agent = salesAgentPublicPayload(await loadSalesAgentParsed());
    if (salesContactsOnly) {
      return res.json({ code: 200, data: outData });
    }
    outData.mine_ui = await getMineUiForAdminForm();
    var installAfter = await getInstallPackageSettingsFromDb();
    outData.android_apk_download_url = installAfter.android;
    outData.agent_android_apk_download_url = installAfter.agent_android;
    outData.ios_mobileconfig_download_url = installAfter.ios;
    outData.xianyu_purchase_url = installAfter.xianyu;
    outData.xianyu_hide_sales_channels = (installAfter.xianyu_hide_channels || []).join('\n');
    outData.qq_add_url = sanitizeInstallDownloadUrl(installAfter.qq);
    outData.qq_group_url = sanitizeInstallDownloadUrl(installAfter.qq_group);
    var qrAfter = await getWechatPayQrcodeUrl();
    outData.wechat_pay_qrcode_url = qrAfter;
    outData.wechat_pay_qrcode_display_url = resolvePublicAssetUrl(qrAfter);
    outData.conversion_ab = await loadConversionAbParsed();
    outData.landing_ab = await loadLandingAbParsed();
    outData.pricing_ab = await getPricingAb().loadPricingAbParsed(true);
    outData.sku_catalog_prices = await getPricingAb().loadCatalogAmounts(true);
    outData.sku_catalog = await getPricingAb().loadCatalogConfig(true);
    outData.tax_edit_fee = await loadTaxEditFeeConfig(true);
    outData.rename_fee = await loadRenameFeeConfig(true);
    outData.lizhi_cert_fee = await loadLizhiCertFeeConfig(true);
    outData.najilu_qr_fee = await najiluQrMod.loadNajiluQrFeeConfig(true);
    outData.activation_nudge = await loadActivationNudgeParsed();
    return res.json({ code: 200, data: outData });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  } finally {
    conn.release();
  }
}

/** 公开「我的」页 UI 配置 */
async function handlePublicMineUi(req, res) {
  try {
    var mineUi = await getMineUiForApi();
    return res.json({ code: 200, data: mineUi });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 销售渠道归因 */
async function handlePublicSalesChannelAttribution(req, res) {
  try {
    var body = req.body || {};
    var ch = readSalesChannelFromRequest(req, body);
    if (!ch) {
      return res.status(400).json({ code: 400, msg: 'sales_ch required' });
    }
    var sourcePage = body.source_page != null ? String(body.source_page).trim().substring(0, 128) : '';
    await recordSalesChannelAttribution(req, ch, sourcePage);
    return res.json({ code: 200, data: { ok: true, sales_ch: ch } });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 解析销售渠道 */
async function handlePublicResolveSalesChannel(req, res) {
  try {
    var ch = await resolveSalesChannelForRequest(req);
    if (!ch) {
      ch = readSalesChannelFromRequest(req);
    }
    var defaultPricingAbc = null;
    var codeOnly = false;
    if (ch) {
      try {
        defaultPricingAbc = await resolveForcedAbcForSalesChannel(ch);
      } catch (ePol) {}
      try {
        codeOnly = await resolveCodeOnlyForSalesChannel(ch);
      } catch (eCode) {
        codeOnly = defaultPricingAbc === 'c';
      }
    }
    return res.json({
      code: 200,
      data: {
        sales_ch: ch || null,
        resolved: !!ch,
        default_pricing_abc: defaultPricingAbc,
        force_pricing_abc: defaultPricingAbc,
        code_only: !!codeOnly,
        hide_self_serve_pay: !!codeOnly
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 公开安装包配置 */
async function handlePublicInstallPackages(req, res) {
  try {
    var uid = tryAuthUserIdFromRequest(req) || '';
    var qCh = readSalesChannelFromRequest(req);
    var cacheKey = String(uid || 'anon') + '|' + String(qCh || '');
    var now = Date.now();
    var hit = _installPackagesResponseCache.get(cacheKey);
    if (hit && now - hit.t < INSTALL_PACKAGES_RESPONSE_CACHE_MS) {
      /* 含短时签名 URL，禁止边缘/浏览器长缓存 */
      res.setHeader('Cache-Control', 'private, max-age=30, no-store');
      return res.json(hit.body);
    }

    var ctx = await resolveInstallPackagesContext(req);
    var raw = ctx.raw;
    var android = toPublicInstallDownloadUrl(raw.android);
    var ios = toPublicInstallDownloadUrl(raw.ios);
    var xianyu = sanitizeXianyuPurchaseText(raw.xianyu);
    var qq = toPublicInstallDownloadUrl(raw.qq);
    var qqGroup = toPublicInstallDownloadUrl(raw.qq_group);
    var salesCh = ctx.salesCh;
    var hideXianyu = ctx.hideXianyu;
    var channelPolicy = ctx.channelPolicy;
    /* 渠道专用安装包优先于全局代理包 / 公开包 */
    if (channelPolicy) {
      var chAndroid = toPublicInstallDownloadUrl(channelPolicy.android_apk_url || '');
      var chIos = toPublicInstallDownloadUrl(channelPolicy.ios_mobileconfig_url || '');
      if (chAndroid) android = chAndroid;
      if (chIos) ios = chIos;
    }
    if (hideXianyu) {
      xianyu = '';
      if (!(channelPolicy && channelPolicy.android_apk_url)) {
        var agentApk = toPublicInstallDownloadUrl(raw.agent_android);
        if (agentApk) {
          android = agentApk;
        }
      }
    }
    var qrRef = hideXianyu ? '' : await getWechatPayQrcodeUrl();
    var salesAgentPub = salesAgentPublicPayload(await loadSalesAgentParsed());
    var defaultPricingAbc = '';
    var codeOnly = false;
    if (salesCh) {
      try {
        defaultPricingAbc = (await resolveForcedAbcForSalesChannel(salesCh)) || '';
      } catch (eForceAbc) {
        defaultPricingAbc = '';
      }
      try {
        codeOnly = await resolveCodeOnlyForSalesChannel(salesCh);
      } catch (eCode) {
        codeOnly = defaultPricingAbc === 'c';
      }
    }
    if (codeOnly) {
      xianyu = '';
      qrRef = '';
      if (!hideXianyu) {
        hideXianyu = true;
        if (!(channelPolicy && channelPolicy.android_apk_url)) {
          var agentApkCode = toPublicInstallDownloadUrl(raw.agent_android);
          if (agentApkCode) {
            android = agentApkCode;
          }
        }
      } else {
        hideXianyu = true;
      }
    }
    var body = {
      code: 200,
      data: {
        android_apk_download_url: android,
        ios_mobileconfig_download_url: ios,
        xianyu_purchase_url: xianyu,
        show_xianyu_purchase: !hideXianyu && !!xianyu,
        wechat_pay_qrcode_url: qrRef || '',
        wechat_pay_qrcode_display_url: resolvePublicAssetUrl(qrRef),
        show_wechat_pay_qrcode: !hideXianyu && !!qrRef,
        sales_channel: salesCh || null,
        default_pricing_abc: defaultPricingAbc || null,
        force_pricing_abc: defaultPricingAbc || null,
        code_only: !!codeOnly,
        hide_self_serve_pay: !!codeOnly,
        qq_add_url: qq,
        qq_group_url: qqGroup,
        show_qq_group: !!qqGroup,
        show_qq_add: !!qq,
        sales_agent: salesAgentPub,
        channel_package: !!(
          channelPolicy &&
          (channelPolicy.android_apk_url || channelPolicy.ios_mobileconfig_url)
        )
      }
    };
    _installPackagesResponseCache.set(cacheKey, { t: now, body: body });
    if (_installPackagesResponseCache.size > 500) {
      _installPackagesResponseCache.clear();
    }
    res.setHeader('Cache-Control', 'private, max-age=30, no-store');
    return res.json(body);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 查看用户税务记录 */
async function handleAdminUserTaxRecords(req, res) {
  var username = req.query.username != null ? String(req.query.username).trim() : '';
  if (!username) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  try {
    const conn = await pool.getConnection();
    try {
      var allowed = await adminCanAccessTargetUser(conn, req.admin, username);
      if (!allowed) {
        return res.status(403).json({ code: 403, msg: '无权限查看该用户详情' });
      }
      const [rows] = await conn.execute(
        ADMIN_TAX_RECORD_SELECT_SQL +
          ' WHERE user_id = ? AND deleted_at IS NULL ORDER BY year DESC, month DESC, id DESC LIMIT 200',
        [username]
      );
      const [devices] = await conn.execute(
        `SELECT user_agent_short, ip_last, city_last, first_seen, last_seen, login_count, client_id, device_detail_json
         FROM user_devices
         WHERE username = ?
         ORDER BY last_seen DESC
         LIMIT 30`,
        [username]
      );
      const [pages] = await conn.execute(
        `SELECT e.page_path, e.route_key, e.created_at AS last_entered_at
         FROM user_page_events e
         INNER JOIN (
           SELECT page_path, MAX(id) AS max_id
           FROM user_page_events
           WHERE username = ?
           GROUP BY page_path
         ) t ON e.id = t.max_id
         WHERE e.username = ?
         ORDER BY e.created_at DESC
         LIMIT 120`,
        [username, username]
      );
      const [issueRows] = await conn.execute(
        `SELECT id, apply_time, period_start, period_end, record_no, scope, status, query_code,
                qr_image_url, qr_block_image_url, created_at, updated_at
         FROM tax_issue_applications
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 80`,
        [username]
      );
      var out = rows.map(mapTaxRecordRowForAdmin);
      var devOut = devices.map(function (r) {
        var model = '';
        var platform = '';
        var osVersion = '';
        var appVersion = '';
        try {
          if (r.device_detail_json) {
            var parsed = JSON.parse(String(r.device_detail_json));
            if (parsed && typeof parsed === 'object') {
              model = parsed.model != null ? String(parsed.model) : '';
              platform = parsed.platform != null ? String(parsed.platform) : '';
              osVersion = parsed.os_version != null ? String(parsed.os_version) : '';
              appVersion = parsed.app_version != null ? String(parsed.app_version) : '';
            }
          }
        } catch (e1) {}
        return {
          model: model,
          platform: platform,
          os_version: osVersion,
          app_version: appVersion,
          user_agent_short: r.user_agent_short != null ? String(r.user_agent_short) : '',
          ip_last: r.ip_last != null ? String(r.ip_last) : '',
          city_last: resolveDeviceCityLabel(r.ip_last, r.city_last),
          first_seen: r.first_seen ? r.first_seen.toISOString() : '',
          last_seen: r.last_seen ? r.last_seen.toISOString() : '',
          login_count: r.login_count != null ? Number(r.login_count) : 0,
          client_id: r.client_id != null ? String(r.client_id) : ''
        };
      });
      var pageOut = pages.map(function (r) {
        return {
          page_path: r.page_path != null ? String(r.page_path) : '',
          route_key: r.route_key != null ? String(r.route_key) : '',
          last_entered_at: r.last_entered_at ? r.last_entered_at.toISOString() : ''
        };
      });
      var issueOut = issueRows.map(function (r) {
        return {
          id: r.id != null ? String(r.id) : '',
          apply_time: r.apply_time != null ? String(r.apply_time) : '',
          period_start: r.period_start != null ? String(r.period_start) : '',
          period_end: r.period_end != null ? String(r.period_end) : '',
          record_no: r.record_no != null ? String(r.record_no) : '',
          scope: r.scope != null ? String(r.scope) : '',
          status: r.status != null ? String(r.status) : '',
          query_code: r.query_code != null ? String(r.query_code) : '',
          qr_image_url: r.qr_image_url != null ? String(r.qr_image_url) : '',
          qr_block_image_url: r.qr_block_image_url != null ? String(r.qr_block_image_url) : '',
          created_at: r.created_at ? r.created_at.toISOString() : '',
          updated_at: r.updated_at ? r.updated_at.toISOString() : ''
        };
      });
      var changeDate =
        req.query.change_date != null && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.change_date).trim())
          ? String(req.query.change_date).trim()
          : chinaDateKeyNow();
      var todayChanges = await loadTaxRecordChangesForUser(conn, username, changeDate);
      var taxFlagsOne = await loadTaxRecordFlagsForUsernames(conn, [username], changeDate);
      var taxFlag = taxFlagsOne[username] || { tax_modified_on_date: false };
      return res.json({
        code: 200,
        data: {
          records: out,
          devices: devOut,
          recent_pages: pageOut,
          issue_applications: issueOut,
          change_date: changeDate,
          tax_modified_on_date: !!taxFlag.tax_modified_on_date,
          today_tax_changes: todayChanges
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 管理端：指定用户个税记录增改删（复用 saveRecord / deleteRecord） */
async function handleAdminUserTaxRecordsWrite(req, res) {
  var body = req.body || {};
  var username = body.username != null ? String(body.username).trim() : '';
  var action = body.action != null ? String(body.action).trim() : '';
  if (!username) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  if (username.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    return res.status(400).json({ code: 400, msg: '不能操作保留账号名' });
  }
  if (!action) {
    return res.status(400).json({ code: 400, msg: 'action required' });
  }
  try {
    const conn = await pool.getConnection();
    var canonical = username;
    var userRow = null;
    try {
      const [urows] = await conn.execute(
        `SELECT username, real_name, account_active, user_type
         FROM users WHERE username = ? LIMIT 1`,
        [username]
      );
      if (!urows.length) {
        return res.status(404).json({ code: 404, msg: '用户不存在' });
      }
      userRow = urows[0];
      canonical = String(userRow.username || username);
      var allowed = await adminCanAccessTargetUser(conn, req.admin, canonical);
      if (!allowed) {
        return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
      }
    } finally {
      conn.release();
    }

    if (action === 'list' || action === 'load') {
      const conn2 = await pool.getConnection();
      try {
        const [rows] = await conn2.execute(
          ADMIN_TAX_RECORD_SELECT_SQL +
            ' WHERE user_id = ? AND deleted_at IS NULL ORDER BY year DESC, month DESC, id DESC LIMIT 200',
          [canonical]
        );
        const [cntRows] = await conn2.execute(
          'SELECT COUNT(*) AS c FROM tax_records WHERE user_id = ? AND ' + TAX_RECORD_NOT_DELETED_SQL,
          [canonical]
        );
        return res.json({
          code: 200,
          data: {
            username: canonical,
            real_name: userRow.real_name != null ? String(userRow.real_name) : '',
            account_active:
              userRow.account_active === true ||
              userRow.account_active === 1 ||
              userRow.account_active === '1',
            user_type: userRow.user_type != null ? Number(userRow.user_type) : null,
            record_count: cntRows && cntRows[0] ? Number(cntRows[0].c) || 0 : 0,
            records: (rows || []).map(mapTaxRecordRowForAdmin)
          }
        });
      } finally {
        conn2.release();
      }
    }

    if (action === 'save_record' || action === 'add_record') {
      var record = body.record && typeof body.record === 'object' ? body.record : null;
      if (!record) {
        return res.status(400).json({ code: 400, msg: 'record required' });
      }
      var companyName = record.company_name != null ? String(record.company_name).trim() : '';
      if (!companyName) {
        return res.status(400).json({ code: 400, msg: '请填写扣缴义务人（公司名称）' });
      }
      var yearN = parseInt(record.year, 10);
      var monthN = parseInt(record.month, 10);
      if (!isFinite(yearN) || yearN < 2000 || yearN > 2100) {
        return res.status(400).json({ code: 400, msg: '年份无效' });
      }
      if (!isFinite(monthN) || monthN < 1 || monthN > 12) {
        return res.status(400).json({ code: 400, msg: '月份无效' });
      }
      record.year = yearN;
      record.month = monthN;
      record.company_name = companyName;
      if (!record.tax_period) {
        record.tax_period = yearN + '-' + String(monthN).padStart(2, '0');
      }
      var saved = await saveRecord(canonical, record);
      return res.json({
        code: 200,
        msg: '已保存',
        data: { id: saved && saved.id ? saved.id : record.id || '', username: canonical }
      });
    }

    if (action === 'delete_record') {
      var delId =
        body.id != null
          ? String(body.id).trim()
          : body.record && body.record.id != null
            ? String(body.record.id).trim()
            : '';
      if (!delId) {
        return res.status(400).json({ code: 400, msg: 'id required' });
      }
      await deleteRecord(canonical, delId);
      return res.json({
        code: 200,
        msg: '已删除',
        data: { id: delId, username: canonical }
      });
    }

    if (action === 'batch_save_records') {
      var batchRecords = body.records;
      if (!Array.isArray(batchRecords) || batchRecords.length === 0) {
        return res.status(400).json({ code: 400, msg: 'records 须为非空数组' });
      }
      if (batchRecords.length > TAX_BATCH_MAX_RECORDS) {
        return res.status(400).json({
          code: 400,
          msg: '单次最多写入 ' + TAX_BATCH_MAX_RECORDS + ' 条记录'
        });
      }
      var batchOut = await batchSaveRecords(canonical, batchRecords);
      return res.json({
        code: 200,
        msg: '批量已保存',
        data: Object.assign({}, batchOut, { username: canonical })
      });
    }

    if (action === 'batch_replace_records') {
      var idsToDelete = body.ids_to_delete;
      var replaceRecords = body.records;
      if (!Array.isArray(idsToDelete)) {
        return res.status(400).json({ code: 400, msg: 'ids_to_delete 须为数组' });
      }
      if (!Array.isArray(replaceRecords) || replaceRecords.length === 0) {
        return res.status(400).json({ code: 400, msg: 'records 须为非空数组' });
      }
      if (idsToDelete.length > TAX_BATCH_MAX_RECORDS || replaceRecords.length > TAX_BATCH_MAX_RECORDS) {
        return res.status(400).json({
          code: 400,
          msg: '单次最多处理 ' + TAX_BATCH_MAX_RECORDS + ' 条删除或写入'
        });
      }
      var replaceOut = await batchReplaceTaxRecords(canonical, idsToDelete, replaceRecords);
      return res.json({
        code: 200,
        msg: '批量已覆盖',
        data: Object.assign({}, replaceOut, { username: canonical })
      });
    }

    if (action === 'delete_records_by_company') {
      var delCompany =
        body.company_name != null
          ? String(body.company_name).trim()
          : body.company != null
            ? String(body.company).trim()
            : '';
      if (!delCompany) {
        return res.status(400).json({ code: 400, msg: 'company_name required' });
      }
      var delCompanyOut = await deleteRecordsByCompany(canonical, delCompany);
      return res.json({
        code: 200,
        msg: '已按公司删除',
        data: Object.assign({}, delCompanyOut, { username: canonical })
      });
    }

    return res.status(400).json({ code: 400, msg: 'unknown action' });
  } catch (e) {
    console.error('handleAdminUserTaxRecordsWrite', e);
    return res.status(500).json({ code: 500, msg: (e && e.message) || String(e) });
  }
}

/** 格式化：stay seconds label */
function formatStaySecondsLabel(sec) {
  var s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 60) return s + ' 秒';
  if (s < 3600) return Math.round(s / 60) + ' 分钟';
  var h = Math.floor(s / 3600);
  var m = Math.round((s % 3600) / 60);
  return h + ' 小时' + (m > 0 ? ' 分' : '');
}

/** 清理疑似机器人 */
async function handleAdminPurgeBotUsers(req, res) {
  var body = req.body || {};
  var dryRun = body.dry_run === true || body.dry_run === 1 || body.dry_run === '1';
  var mode = body.mode === 'ban' ? 'ban' : 'delete';
  const conn = await pool.getConnection();
  try {
    var preview = await registerGuard.countBotPurgeCandidates(conn, body);
    if (dryRun) {
      conn.release();
      return res.json({
        code: 200,
        data: {
          dry_run: true,
          matched: preview.count,
          mode: mode,
          window: preview.window
        }
      });
    }
    if (!preview.count) {
      conn.release();
      return res.json({ code: 200, data: { matched: 0, deleted: 0, banned: 0, mode: mode } });
    }
    await conn.beginTransaction();
    var result = await registerGuard.purgeBotUsersBatch(conn, body, {
      dry_run: false,
      mode: mode,
      batch_size: body.batch_size
    });
    await conn.commit();
    conn.release();
    return res.json({ code: 200, data: result });
  } catch (e) {
    try {
      await conn.rollback();
    } catch (rbErr) {
      console.error(rbErr);
    }
    conn.release();
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 退款并处理激活 */
async function handleAdminUserRefund(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  if (!target) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  if (target.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    return res.status(400).json({ code: 400, msg: '不能操作保留账号名' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    var allowed = await adminCanAccessTargetUser(conn, req.admin, target);
    if (!allowed) {
      await conn.rollback();
      conn.release();
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    var adminName = req.admin && req.admin.username ? String(req.admin.username) : '';
    var result = await applyActivationRefundForUser(conn, target, adminName);
    if (result.missing) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }
    if (result.already) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ code: 400, msg: '该账号已退款' });
    }
    if (result.inactive) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ code: 400, msg: '仅已激活账号可退款' });
    }
    /* 管理端退款：尽量把该用户仍为 paid 的激活类订单标为 refunded，GMV 同步回退 */
    await conn.execute(
      `UPDATE payment_orders
       SET status = 'refunded'
       WHERE username = ? AND status = 'paid'
         AND (grant_kind IS NULL OR grant_kind IN ('trial', 'permanent', ''))
         AND (sku_id IS NULL OR (sku_id NOT LIKE 'sku_rename%' AND sku_id NOT LIKE 'sku_lizhi%' AND sku_id NOT LIKE 'sku_zaizhi%' AND sku_id NOT LIKE 'sku_najilu%' AND sku_id NOT LIKE 'sku_tax_edit%'))`,
      [target]
    );
    await conn.commit();
    conn.release();
    invalidateUserAuthCache(target);
    return res.json({
      code: 200,
      data: {
        username: target,
        banned: true,
        hidden: true,
        refunded: true,
        activation_excluded_from_stats: true
      }
    });
  } catch (e) {
    try {
      await conn.rollback();
    } catch (e2) {}
    try {
      conn.release();
    } catch (e3) {}
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 软删用户 */
async function handleAdminDeleteUser(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  if (!target) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  if (target.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    return res.status(400).json({ code: 400, msg: '不能删除保留账号名' });
  }
  const conn = await pool.getConnection();
  try {
    const [urows] = await conn.execute(
      'SELECT id, list_hidden_at FROM users WHERE username = ?',
      [target]
    );
    if (urows.length === 0) {
      conn.release();
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }
    if (urows[0].list_hidden_at) {
      conn.release();
      return res.status(400).json({ code: 400, msg: '该账号已在已删除列表中' });
    }
    var allowed = await adminCanAccessTargetUser(conn, req.admin, target);
    if (!allowed) {
      conn.release();
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    var hiddenBy = req.admin && req.admin.username ? String(req.admin.username) : '';
    await conn.execute(
      'UPDATE users SET list_hidden_at = NOW(3), list_hidden_by = ? WHERE username = ?',
      [hiddenBy, target]
    );
    conn.release();
    return res.json({
      code: 200,
      data: { username: target, hidden: true, soft_delete: true }
    });
  } catch (e) {
    try {
      conn.release();
    } catch (e2) {}
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 已删用户列表 */
async function handleAdminDeletedUsers(req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 10;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    if (limit > 100) limit = 100;
    var offset = (page - 1) * limit;

    var qUsername = String(req.query.username || '').trim();
    var qRealName = String(req.query.real_name || '').trim();
    var qExact = req.query.exact === '1' || req.query.exact === 'true';

    var whereClauses = ['users.list_hidden_at IS NOT NULL'];
    var params = [];

    if (qUsername) {
      if (qExact) {
        whereClauses.push('users.username = ?');
        params.push(qUsername);
      } else {
        whereClauses.push('users.username LIKE ?');
        params.push('%' + qUsername + '%');
      }
    }
    if (qRealName) {
      if (qExact) {
        whereClauses.push('users.real_name = ?');
        params.push(qRealName);
      } else {
        whereClauses.push('users.real_name LIKE ?');
        params.push('%' + qRealName + '%');
      }
    }
    if (!req.admin || !adminHasFullUserScope(req.admin)) {
      appendSubAdminOwnedUsersScopeForAdmin(whereClauses, params, req.admin, 'users.username');
    }

    var whereSql = ' WHERE ' + whereClauses.join(' AND ');
    const conn = await pool.getConnection();
    const [totalRows] = await conn.execute('SELECT COUNT(*) as count FROM users' + whereSql, params);
    var total = totalRows[0].count;
    const [rows] = await conn.query(
      `SELECT id, username, real_name, account_active, banned, created_at, list_hidden_at, list_hidden_by,
              register_source_channel, activation_source_channel, activation_refunded_at, activation_refunded_by
       FROM users ${whereSql}
       ORDER BY list_hidden_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    conn.release();

    var out = (rows || []).map(function (r) {
      return {
        id: r.id,
        username: r.username,
        real_name: r.real_name,
        account_active: r.account_active === 1 || r.account_active === true,
        banned: r.banned === 1 || r.banned === true,
        created_at: r.created_at ? r.created_at.toISOString() : '',
        list_hidden_at: r.list_hidden_at ? r.list_hidden_at.toISOString() : '',
        list_hidden_by:
          r.list_hidden_by != null && String(r.list_hidden_by).trim() !== ''
            ? String(r.list_hidden_by).trim()
            : '',
        activation_refunded_at: r.activation_refunded_at ? r.activation_refunded_at.toISOString() : '',
        activation_refunded_by:
          r.activation_refunded_by != null && String(r.activation_refunded_by).trim() !== ''
            ? String(r.activation_refunded_by).trim()
            : '',
        channel_analysis_label: userChannelAnalysisLabel(
          r.register_source_channel,
          r.activation_source_channel
        )
      };
    });

    return res.json({
      code: 200,
      data: { users: out, total: total, page: page, limit: limit }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 恢复已删用户 */
async function handleAdminUserRestore(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  if (!target) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  const conn = await pool.getConnection();
  try {
    const [urows] = await conn.execute(
      'SELECT id, list_hidden_at, activation_refunded_at FROM users WHERE username = ?',
      [target]
    );
    if (urows.length === 0) {
      conn.release();
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }
    if (!urows[0].list_hidden_at) {
      conn.release();
      return res.status(400).json({ code: 400, msg: '该账号不在已删除列表中' });
    }
    var allowed = await adminCanAccessTargetUser(conn, req.admin, target);
    if (!allowed) {
      conn.release();
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    var wasRefunded = !!urows[0].activation_refunded_at;
    if (wasRefunded) {
      await conn.execute(
        `UPDATE users SET list_hidden_at = NULL, list_hidden_by = NULL,
                activation_refunded_at = NULL, activation_refunded_by = NULL,
                banned = 0, account_active = 1
         WHERE username = ?`,
        [target]
      );
    } else {
      await conn.execute(
        'UPDATE users SET list_hidden_at = NULL, list_hidden_by = NULL WHERE username = ?',
        [target]
      );
    }
    conn.release();
    invalidateUserAuthCache(target);
    return res.json({
      code: 200,
      data: { username: target, restored: true, was_refunded: wasRefunded }
    });
  } catch (e) {
    try {
      conn.release();
    } catch (e2) {}
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 硬删除：彻底清除已软删账号及其业务数据（不可恢复） */
async function handleAdminUserHardDelete(req, res) {
  var body = req.body || {};
  var target = body.username != null ? String(body.username).trim() : '';
  if (!target) {
    return res.status(400).json({ code: 400, msg: 'username required' });
  }
  if (target.toLowerCase() === String(ADMIN_PANEL_USER).toLowerCase()) {
    return res.status(400).json({ code: 400, msg: '不能删除保留账号名' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [urows] = await conn.execute(
      'SELECT id, list_hidden_at FROM users WHERE username = ? FOR UPDATE',
      [target]
    );
    if (urows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }
    if (!urows[0].list_hidden_at) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ code: 400, msg: '仅「已删除账号」列表中的账号可彻底删除，请先软删除' });
    }
    var allowed = await adminCanAccessTargetUser(conn, req.admin, target);
    if (!allowed) {
      await conn.rollback();
      conn.release();
      return res.status(403).json({ code: 403, msg: '无权限查看或操作该用户' });
    }
    await registerGuard.deleteUserAndRelated(conn, target);
    await conn.commit();
    conn.release();
    invalidateUserAuthCache(target);
    return res.json({
      code: 200,
      data: { username: target, hard_deleted: true }
    });
  } catch (e) {
    try {
      await conn.rollback();
    } catch (rbErr) {}
    try {
      conn.release();
    } catch (relErr) {}
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 解析：device detail json for stats */
function parseDeviceDetailJsonForStats(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  var s = raw.trim();
  if (!s) {
    return null;
  }
  try {
    var o = JSON.parse(s);
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      return o;
    }
  } catch (e1) {
    return null;
  }
  return null;
}

/** slug device stats key */
function slugDeviceStatsKey(s) {
  var t = String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 80);
  return t || 'unknown';
}

/** 规范化：underscore version */
function normalizeUnderscoreVersion(s) {
  var t = String(s || '')
    .trim()
    .replace(/_/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return t;
}

/** os version from client detail */
function osVersionFromClientDetail(osKey, detail) {
  if (!detail || detail.os_version == null || detail.os_version === '') {
    return '';
  }
  var v = String(detail.os_version)
    .trim()
    .replace(/[\x00-\x1f]/g, '');
  if (!v) {
    return '';
  }
  if (osKey === 'ios') {
    v = v.replace(/^i(?:OS|os)\s*/i, '').trim();
  } else if (osKey === 'android') {
    v = v.replace(/^android\s*/i, '').trim();
  }
  return v.substring(0, 48);
}

/** extract ios version from ua */
function extractIosVersionFromUa(ua) {
  var m = ua.match(/(?:CPU )?(?:iPhone |iPad |iPod )?OS\s+([\d_]+)/i);
  if (m) {
    return normalizeUnderscoreVersion(m[1]);
  }
  m = ua.match(/\bOS\s+([\d_]+)\s+like\s+Mac\s+OS\s+X/i);
  if (m) {
    return normalizeUnderscoreVersion(m[1]);
  }
  return '';
}

/** extract android version from ua */
function extractAndroidVersionFromUa(ua) {
  var m = ua.match(/Android\s+([\d.]+)/i);
  return m ? String(m[1]).trim() : '';
}

/** extract windows nt from ua */
function extractWindowsNtFromUa(ua) {
  var m = ua.match(/Windows NT\s+([\d.]+)/i);
  return m ? String(m[1]).trim() : '';
}

/** extract mac os version from ua */
function extractMacOsVersionFromUa(ua) {
  var m = ua.match(/Mac\s+OS\s+X\s+([\d_]+)/i);
  if (m) {
    return normalizeUnderscoreVersion(m[1]);
  }
  return '';
}

/** extract chrome os version from ua */
function extractChromeOsVersionFromUa(ua) {
  var m = ua.match(/CrOS\s+[^\s]+\s+([\d.]+)/i);
  return m ? String(m[1]).trim() : '';
}

/** 解析：os version string */
function resolveOsVersionString(osKey, ua, detail) {
  var fromClient = osVersionFromClientDetail(osKey, detail);
  if (fromClient) {
    return fromClient;
  }
  ua = String(ua || '');
  if (osKey === 'ios') {
    return extractIosVersionFromUa(ua);
  }
  if (osKey === 'android') {
    return extractAndroidVersionFromUa(ua);
  }
  if (osKey === 'windows') {
    return extractWindowsNtFromUa(ua);
  }
  if (osKey === 'macos') {
    return extractMacOsVersionFromUa(ua);
  }
  if (osKey === 'chromeos') {
    return extractChromeOsVersionFromUa(ua);
  }
  return '';
}

/**
 * 返回用于聚合的 os_key（ios/android/windows/macos/linux/chromeos/other）与机型展示名。
 * 优先依据 UA；上报 JSON 中的 platform/model 做补充。
 */
function classifyUserDeviceRow(userAgentShort, deviceDetailJson) {
  var detail = parseDeviceDetailJsonForStats(deviceDetailJson);
  var ua = '';
  if (detail && detail.user_agent) {
    ua = String(detail.user_agent);
  }
  if (!ua && userAgentShort) {
    ua = String(userAgentShort);
  }
  var platform = detail && detail.platform ? String(detail.platform).trim() : '';
  var model = detail && detail.model ? String(detail.model).trim() : '';
  var brand = detail && detail.brand ? String(detail.brand).trim() : '';

  var osKey = 'other';

  if (/iPhone|CPU iPhone OS|iPod/i.test(ua)) {
    osKey = 'ios';
  } else if (/iPad/i.test(ua) || /^iPad$/i.test(platform)) {
    osKey = 'ios';
  } else if (/Android/i.test(ua)) {
    osKey = 'android';
  } else if (/Windows NT|Win64|WOW64/i.test(ua) || /^Win/i.test(platform)) {
    osKey = 'windows';
  } else if (/Mac OS X|Macintosh/i.test(ua) || platform === 'MacIntel') {
    if (!/iPhone|iPad|iPod/i.test(ua)) {
      osKey = 'macos';
    }
  }

  if (osKey === 'other') {
    if (/CrOS/i.test(ua)) {
      osKey = 'chromeos';
    } else if (/Linux/i.test(ua) && !/Android/i.test(ua)) {
      osKey = 'linux';
    } else if (platform === 'Win32') {
      osKey = 'windows';
    } else if (/iPhone|iPad|iPod/i.test(platform)) {
      osKey = 'ios';
    }
  }

  var modelLabel = '';
  if (model) {
    modelLabel = brand ? (brand + ' ' + model).trim() : model;
  } else if (/iPhone/i.test(ua) || /^iPhone$/i.test(platform)) {
    modelLabel = 'iPhone';
  } else if (/iPad/i.test(ua) || /^iPad$/i.test(platform)) {
    modelLabel = 'iPad';
  } else if (/Android/i.test(ua)) {
    var dm = ua.match(/Android\s+[\d._]+;\s*([^)]+)/i);
    if (dm) {
      modelLabel = dm[1].trim().replace(/\s+Build\/.*$/i, '').trim();
    }
  }
  if (!modelLabel) {
    if (osKey === 'windows') {
      modelLabel = 'Windows PC';
    } else if (osKey === 'macos') {
      modelLabel = 'Mac';
    } else if (osKey === 'linux') {
      modelLabel = 'Linux PC';
    } else if (osKey === 'chromeos') {
      modelLabel = 'Chromebook';
    } else if (platform) {
      modelLabel = platform;
    } else {
      modelLabel = '未知机型';
    }
  }

  var osVersion = resolveOsVersionString(osKey, ua, detail);

  return {
    os_key: osKey,
    os_version: osVersion,
    model_key: slugDeviceStatsKey(modelLabel),
    model_label: modelLabel
  };
}

var DEVICE_STATS_OS_FAMILY_LABEL = {
  ios: 'iOS',
  android: 'Android',
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  chromeos: 'Chrome OS',
  other: '其他'
};

var DEVICE_STATS_OS_ICON_KEY = {
  ios: 'ios',
  android: 'android',
  windows: 'windows',
  macos: 'macos',
  linux: 'linux',
  chromeos: 'chromeos',
  other: 'other'
};

var DEVICE_STATS_MODEL_ICON_LABEL = {
  iphone: 'iPhone',
  ipad: 'iPad',
  android_phone: 'Android 手机',
  xiaomi: '小米 / Redmi',
  huawei: '华为 / 鸿蒙',
  honor: '荣耀',
  oppo: 'OPPO / 一加',
  vivo: 'vivo',
  samsung: '三星',
  google: 'Google / Nexus',
  windows_pc: 'Windows 电脑',
  mac: 'Mac',
  linux_pc: 'Linux 电脑',
  chromebook: 'Chromebook',
  ios: 'iOS 设备',
  android: 'Android',
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  chromeos: 'Chrome OS',
  other: '其他'
};

/** 日活按 IP 去重键：优先当日成功登录 IP，其次任意成功/注册 IP，再次设备 ip_last；无 IP 则按账号各计 1 */
function dauActivityIpKeySql(udaAlias) {
  var u = udaAlias || 'uda';
  return (
    'COALESCE(' +
    'NULLIF(TRIM((' +
    'SELECT ule.ip FROM user_login_events ule ' +
    'WHERE ule.username = ' +
    u +
    '.username AND ule.ok = 1 AND DATE(ule.created_at) = ' +
    u +
    ".activity_date AND ule.ip IS NOT NULL AND TRIM(ule.ip) <> '' " +
    'ORDER BY ule.created_at DESC, ule.id DESC LIMIT 1' +
    ")), '')," +
    'NULLIF(TRIM((' +
    'SELECT ule.ip FROM user_login_events ule ' +
    'WHERE ule.username = ' +
    u +
    ".username AND (ule.ok = 1 OR ule.reason LIKE 'register_%') " +
    "AND ule.ip IS NOT NULL AND TRIM(ule.ip) <> '' " +
    'ORDER BY ule.created_at DESC, ule.id DESC LIMIT 1' +
    ")), '')," +
    'NULLIF(TRIM((' +
    'SELECT ud.ip_last FROM user_devices ud ' +
    'WHERE ud.username = ' +
    u +
    ".username AND ud.ip_last IS NOT NULL AND TRIM(ud.ip_last) <> '' " +
    'ORDER BY ud.last_seen DESC LIMIT 1' +
    ")), '')," +
    "CONCAT('__nouip:', " +
    u +
    '.username)' +
    ')'
  );
}

/** 加载：tax record flags for usernames */
async function loadTaxRecordFlagsForUsernames(conn, usernames, activityDate) {
  var flags = {};
  if (!usernames || !usernames.length) {
    return flags;
  }
  usernames.forEach(function (u) {
    flags[u] = { has_tax_records: false, tax_modified_on_date: false };
  });
  var ph = usernames.map(function () {
    return '?';
  }).join(',');
  const [rows] = await conn.query(
    'SELECT user_id, COUNT(*) AS record_cnt, ' +
      'SUM(CASE WHEN DATE(updated_at) = ? THEN 1 ELSE 0 END) AS modified_on_date_cnt ' +
      'FROM tax_records WHERE user_id IN (' +
      ph +
      ') AND ' +
      TAX_RECORD_NOT_DELETED_SQL +
      ' GROUP BY user_id',
    [activityDate].concat(usernames)
  );
  rows.forEach(function (r) {
    var uname = String(r.user_id || '');
    if (!uname || !flags[uname]) {
      return;
    }
    var cnt = Number(r.record_cnt) || 0;
    var modCnt = Number(r.modified_on_date_cnt) || 0;
    flags[uname] = {
      has_tax_records: cnt > 0,
      tax_modified_on_date: modCnt > 0
    };
  });
  return flags;
}

/** DAU 用户列表（按 IP 去重：同 IP 多账号只保留一个代表账号） */
async function handleAdminAnalyticsDauUsers(req, res) {
  try {
    var dateStr = req.query.date != null ? String(req.query.date).trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ code: 400, msg: 'date required (YYYY-MM-DD)' });
    }
    var page = parseInt(req.query.page, 10);
    if (!isFinite(page) || page < 1) {
      page = 1;
    }
    var limit = parseInt(req.query.limit, 10);
    if (!isFinite(limit) || limit < 1) {
      limit = 10;
    }
    if (limit > 100) {
      limit = 100;
    }
    const conn = await pool.getConnection();
    try {
      var ipKeySql = dauActivityIpKeySql('uda');
      const [rawRows] = await conn.query(
        'SELECT uda.username AS username, ' +
          ipKeySql +
          ' AS ip_key FROM user_daily_activity uda WHERE uda.activity_date = ? ORDER BY uda.username ASC',
        [dateStr]
      );
      var byIp = Object.create(null);
      var groups = [];
      (rawRows || []).forEach(function (r) {
        var un = String(r.username || '').trim();
        if (!un) {
          return;
        }
        var ipKey = String(r.ip_key || '').trim() || '__nouip:' + un;
        if (!byIp[ipKey]) {
          byIp[ipKey] = {
            username: un,
            ip_key: ipKey,
            same_ip_count: 1,
            accounts: [un]
          };
          groups.push(byIp[ipKey]);
        } else {
          byIp[ipKey].same_ip_count += 1;
          byIp[ipKey].accounts.push(un);
        }
      });
      var total = groups.length;
      var totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
      if (totalPages > 0 && page > totalPages) {
        page = totalPages;
      }
      var offset = Math.max(0, ((page - 1) * limit) | 0);
      var pageGroups = groups.slice(offset, offset + limit);
      if (total > 0 && totalPages < 1) {
        totalPages = 1;
      }
      var allNames = [];
      pageGroups.forEach(function (g) {
        g.accounts.forEach(function (n) {
          allNames.push(n);
        });
      });
      var taxFlags = await loadTaxRecordFlagsForUsernames(conn, allNames, dateStr);
      return res.json({
        code: 200,
        data: {
          date: dateStr,
          users: pageGroups.map(function (g) {
            var hasTax = false;
            var modTax = false;
            g.accounts.forEach(function (un) {
              var f = taxFlags[un] || {};
              if (f.has_tax_records) {
                hasTax = true;
              }
              if (f.tax_modified_on_date) {
                modTax = true;
              }
            });
            var ipDisp =
              g.ip_key.indexOf('__nouip:') === 0 ? '' : g.ip_key;
            return {
              username: g.username,
              ip: ipDisp,
              same_ip_count: g.same_ip_count,
              has_tax_records: hasTax,
              tax_modified_on_date: modTax
            };
          }),
          total: total,
          account_total: (rawRows || []).length,
          page: page,
          limit: limit,
          total_pages: totalPages
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 埋点总览 */
async function handleAdminAnalyticsOverview(req, res) {
  try {
    var period = parseAnalyticsPeriod(req.query.days, 90);
    var actPf = analyticsPeriodActivityDateFilter(period);
    var loginPf = analyticsPeriodLoginDatetimeFilter(period);
    const conn = await pool.getConnection();
    try {
      var ipKeySql = dauActivityIpKeySql('uda');
      const [dauRows] = await conn.execute(
        `SELECT uda.activity_date AS d, COUNT(DISTINCT ${ipKeySql}) AS cnt
         FROM user_daily_activity uda
         WHERE ${actPf.sql.replace(/activity_date/g, 'uda.activity_date')}
         GROUP BY uda.activity_date ORDER BY uda.activity_date ASC`,
        actPf.params
      );
      const [loginRows] = await conn.execute(
        `SELECT DATE(created_at) AS d,
           SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS success_cnt,
           SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS fail_cnt
         FROM user_login_events
         WHERE ${loginPf.sql}
         GROUP BY DATE(created_at) ORDER BY d ASC`,
        loginPf.params
      );
      const [failReasonRows] = await conn.execute(
        `SELECT COALESCE(NULLIF(reason, ''), 'unknown_error') AS reason_key, COUNT(*) AS cnt
         FROM user_login_events
         WHERE ok = 0
           AND ${loginPf.sql}
         GROUP BY reason_key
         ORDER BY cnt DESC
         LIMIT 20`,
        loginPf.params
      );
      return res.json({
        code: 200,
        data: Object.assign(
          {
            dau: dauRows.map(function (r) {
              return {
                date: r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10),
                active_users: Number(r.cnt)
              };
            }),
            logins: loginRows.map(function (r) {
              return {
                date: r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10),
                success: Number(r.success_cnt || 0),
                fail: Number(r.fail_cnt || 0)
              };
            }),
            fail_reasons: failReasonRows.map(function (r) {
              var k = r.reason_key != null ? String(r.reason_key) : 'unknown_error';
              return { reason_key: k, reason_label: userLoginReasonLabel(k), cnt: Number(r.cnt || 0) };
            })
          },
          conversionAnalyticsPeriodMeta(period)
        )
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** C 端行为埋点在 analytics_api_daily 中的匹配条件（与列表查询一致） */
var ANALYTICS_TRACK_EVENT_SQL =
  "(route_key LIKE 'EVENT %' OR route_key LIKE '%#track\\_%')";

/** C 端支付页 + 前链路激活弹窗/引导埋点（含跨页 track_activate_prompt_*） */
var PURCHASE_PAGE_TRACK_EVENT_KEYS = [
  'track_activate_prompt_open',
  'track_activate_prompt_cancel',
  'track_activate_prompt_confirm',
  'track_activation_nudge_show',
  'track_activation_nudge_dismiss',
  'track_activation_nudge_cta',
  'track_purchase_page_view',
  'track_pricing_ab_expose_control',
  'track_pricing_ab_expose_treatment',
  'track_pricing_ab_expose_code',
  'track_purchase_pay_cta_click',
  'track_alipay_payment_start',
  'track_alipay_order_create_ok',
  'track_alipay_order_create_fail',
  'track_alipay_open_click',
  'track_alipay_payment_success',
  'track_purchase_faq_expand',
  'track_purchase_success_cases_view',
  'track_purchase_fold_expand',
  'track_purchase_share_teaser_click',
  'track_purchase_price_survey_open',
  'track_purchase_price_survey_submit',
  'track_purchase_price_survey_skip',
  'track_purchase_price_survey_soft_dismiss',
  'track_purchase_price_survey_to_bid',
  'track_price_bid_open',
  'track_price_bid_submit',
  'track_purchase_activate_success',
  'track_purchase_activate_fail',
  'track_kufaka_purchase_click',
  'track_purchase_sales_agent_view',
  'track_purchase_sales_agent_copy_wechat',
  'track_purchase_sales_agent_qr',
  'track_purchase_sales_agent_copy_phone',
  'track_purchase_sales_agent_copy_qq',
  'track_purchase_sales_agent_xianyu',
  'track_qq_add_click',
  'track_purchase_back_click',
  'track_purchase_page_leave'
];

var PURCHASE_PAGE_TRACK_EVENT_KEY_SET = {};
PURCHASE_PAGE_TRACK_EVENT_KEYS.forEach(function (k) {
  PURCHASE_PAGE_TRACK_EVENT_KEY_SET[k] = true;
});

var PURCHASE_PAGE_TRACK_EVENT_SQL =
  '(' +
  PURCHASE_PAGE_TRACK_EVENT_KEYS.map(function (k) {
    return "route_key LIKE '%#" + k + "'";
  }).join(' OR ') +
  ')';

function isPurchasePageTrackEventKey(eventKey) {
  return !!PURCHASE_PAGE_TRACK_EVENT_KEY_SET[String(eventKey || '').trim()];
}

function purchasePageTrackEventLabel(eventKey) {
  var labels = {
    track_activate_prompt_open: '激活弹窗打开',
    track_activate_prompt_cancel: '激活弹窗-取消',
    track_activate_prompt_confirm: '确认激活',
    track_activation_nudge_show: '激活引导-展示',
    track_activation_nudge_dismiss: '激活引导-关闭',
    track_activation_nudge_cta: '激活引导-去激活',
    track_purchase_page_view: '购买页浏览',
    track_pricing_ab_expose_control: '支付页A曝光·对照',
    track_pricing_ab_expose_treatment: '支付页B曝光·多档',
    track_pricing_ab_expose_code: '支付页C曝光·激活码',
    track_purchase_pay_cta_click: '支付CTA点击',
    track_alipay_payment_start: '生成支付宝付款',
    track_alipay_order_create_ok: '下单创建成功',
    track_alipay_order_create_fail: '下单创建失败',
    track_alipay_open_click: '打开支付宝',
    track_alipay_payment_success: '支付宝支付成功',
    track_purchase_faq_expand: '支付FAQ展开',
    track_purchase_success_cases_view: '成功案例曝光',
    track_purchase_fold_expand: '折叠区展开',
    track_purchase_share_teaser_click: '分享优惠入口点击',
    track_purchase_price_survey_open: '离开调研打开',
    track_purchase_price_survey_submit: '离开调研提交',
    track_purchase_price_survey_skip: '离开调研跳过',
    track_purchase_price_survey_soft_dismiss: '离开调研软关闭',
    track_purchase_price_survey_to_bid: '离开调研偏贵转出价',
    track_price_bid_open: '心理价出价打开',
    track_price_bid_submit: '心理价出价提交',
    track_purchase_activate_success: '激活码开通成功',
    track_purchase_activate_fail: '激活码开通失败',
    track_kufaka_purchase_click: '酷发卡购买',
    track_purchase_sales_agent_view: 'C·销售代理入口',
    track_purchase_sales_agent_copy_wechat: 'C·复制销售微信',
    track_purchase_sales_agent_qr: 'C·销售微信二维码',
    track_purchase_sales_agent_copy_phone: 'C·复制销售手机',
    track_purchase_sales_agent_copy_qq: 'C·复制销售QQ',
    track_purchase_sales_agent_xianyu: 'C·销售闲鱼',
    track_qq_add_click: '添加QQ号',
    track_purchase_back_click: '购买页返回',
    track_purchase_page_leave: '购买页离开'
  };
  return labels[eventKey] || eventKey;
}

/** 支付分析：指定管理员名下激活码开通，按固定单价计入 GMV */
function purchaseAnalyticsAdminActivationCreditRules() {
  var rootAdmin = String(ADMIN_PANEL_USER || 'admin').trim() || 'admin';
  return [
    { admin_username: '18933137956', unit_amount: 100, exclude_alipay: false, label_note: '' },
    { admin_username: '19106014552', unit_amount: 60, exclude_alipay: false, label_note: '' },
    {
      admin_username: rootAdmin,
      unit_amount: 100,
      exclude_alipay: true,
      label_note: '非支付宝'
    }
  ];
}

function purchaseAnalyticsAdminActivationCreditList() {
  return purchaseAnalyticsAdminActivationCreditRules().map(function (rule) {
    return {
      admin_username: rule.admin_username,
      unit_amount: rule.unit_amount,
      label_note: rule.label_note || ''
    };
  });
}

function emptyPurchaseAnalyticsAdminActivationCredit() {
  return {
    by_admin: purchaseAnalyticsAdminActivationCreditList().map(function (row) {
      return {
        admin_username: row.admin_username,
        unit_amount: row.unit_amount,
        label_note: row.label_note || '',
        orders: 0,
        gmv: 0
      };
    }),
    total_orders: 0,
    total_gmv: 0
  };
}

function purchaseAnalyticsAdminActivationOwnerFilter(rule) {
  var sql = 'ac.owner_admin_username = ?';
  var params = [rule.admin_username];
  if (rule.exclude_alipay) {
    sql +=
      " AND (COALESCE(NULLIF(TRIM(u.activation_source_channel), ''), '__none__') <> ?" +
      ' AND NOT (' +
      'ac.note IS NOT NULL AND ac.note LIKE ?))';
    params = params.concat(['alipay', '%支付宝%']);
  }
  return { sql: sql, params: params };
}

async function queryPurchaseAnalyticsAdminActivationCredits(conn, period) {
  var rules = purchaseAnalyticsAdminActivationCreditRules();
  var out = emptyPurchaseAnalyticsAdminActivationCredit();
  if (!rules.length) {
    return { summary: out, dailyMap: {} };
  }
  var cnActDay = 'DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR))';
  var actPf = analyticsPeriodCnDateFilter(cnActDay, period);
  var byAdminMap = {};
  out.by_admin.forEach(function (row) {
    byAdminMap[row.admin_username] = row;
  });
  var dailyMap = {};
  try {
    for (var ri = 0; ri < rules.length; ri++) {
      var rule = rules[ri];
      var ownerFilter = purchaseAnalyticsAdminActivationOwnerFilter(rule);
      var baseWhere =
        'ac.last_used_at IS NOT NULL AND ac.used_count > 0 AND ac.used_by_username IS NOT NULL AND TRIM(ac.used_by_username) <> \'\' AND ' +
        ownerFilter.sql +
        ' AND ' +
        actPf.sql +
        ' AND ' +
        userActivationStatsEligibleSql('u.username');
      var baseParams = ownerFilter.params.concat(actPf.params);

      const [summaryRows] = await conn.execute(
        'SELECT COUNT(DISTINCT ac.used_by_username) AS cnt' +
          ' FROM activation_codes ac' +
          ' INNER JOIN users u ON u.username = ac.used_by_username' +
          ' WHERE ' +
          baseWhere,
        baseParams
      );
      var orders = Number((summaryRows[0] || {}).cnt) || 0;
      if (orders > 0) {
        var gmv = Math.round(orders * rule.unit_amount * 100) / 100;
        var summaryRow = byAdminMap[rule.admin_username];
        if (!summaryRow) {
          summaryRow = {
            admin_username: rule.admin_username,
            unit_amount: rule.unit_amount,
            label_note: rule.label_note || '',
            orders: 0,
            gmv: 0
          };
          byAdminMap[rule.admin_username] = summaryRow;
          out.by_admin.push(summaryRow);
        }
        summaryRow.orders = orders;
        summaryRow.gmv = gmv;
        out.total_orders += orders;
        out.total_gmv += gmv;
      }

      const [dailyRows] = await conn.execute(
        'SELECT ' +
          cnActDay +
          ' AS d, COUNT(DISTINCT ac.used_by_username) AS cnt' +
          ' FROM activation_codes ac' +
          ' INNER JOIN users u ON u.username = ac.used_by_username' +
          ' WHERE ' +
          baseWhere +
          ' GROUP BY ' +
          cnActDay +
          ' ORDER BY d DESC',
        baseParams
      );
      (dailyRows || []).forEach(function (r) {
        var dk = formatDateKey(r.d);
        var dayOrders = Number(r.cnt) || 0;
        if (!dk || dayOrders <= 0) return;
        if (!dailyMap[dk]) {
          dailyMap[dk] = {
            admin_activation_orders: 0,
            admin_activation_gmv: 0,
            by_admin: {}
          };
        }
        var dayGmv = Math.round(dayOrders * rule.unit_amount * 100) / 100;
        dailyMap[dk].admin_activation_orders += dayOrders;
        dailyMap[dk].admin_activation_gmv += dayGmv;
        dailyMap[dk].by_admin[rule.admin_username] = {
          admin_username: rule.admin_username,
          unit_amount: rule.unit_amount,
          label_note: rule.label_note || '',
          orders: dayOrders,
          gmv: dayGmv
        };
      });
    }
    out.total_gmv = Math.round(out.total_gmv * 100) / 100;
    out.by_admin.sort(function (a, b) {
      return String(a.admin_username).localeCompare(String(b.admin_username));
    });
    Object.keys(dailyMap).forEach(function (dk) {
      dailyMap[dk].admin_activation_gmv = Math.round(dailyMap[dk].admin_activation_gmv * 100) / 100;
    });
    return { summary: out, dailyMap: dailyMap };
  } catch (eAdminAct) {
    console.error('[admin purchase-events] admin_activation_credit', eAdminAct && eAdminAct.message);
    return { summary: out, dailyMap: {} };
  }
}

/**
 * 支付页埋点汇总：漏斗 UV + 事件次数 + 分日 + 已支付订单
 */
async function handleAdminAnalyticsPurchaseEvents(req, res) {
  try {
    var period = parseAnalyticsPeriod(req.query.days, 90);
    var cnDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
    var pf = analyticsPeriodCnDateFilter(cnDay, period);
    var cnPaidDay = 'DATE(DATE_ADD(COALESCE(paid_at, created_at), INTERVAL 8 HOUR))';
    var paidPf = analyticsPeriodCnDateFilter(cnPaidDay, period);
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        `SELECT ${cnDay} AS stat_date, username,
                SUBSTRING_INDEX(route_key, '#', -1) AS event_key,
                COUNT(*) AS cnt
         FROM user_page_events
         WHERE ${pf.sql}
           AND ${PURCHASE_PAGE_TRACK_EVENT_SQL}
         GROUP BY ${cnDay}, username, event_key
         ORDER BY stat_date DESC`,
        pf.params
      );

      var eventTotals = {};
      var eventUsers = {};
      PURCHASE_PAGE_TRACK_EVENT_KEYS.forEach(function (k) {
        eventTotals[k] = 0;
        eventUsers[k] = {};
      });
      var dayMap = {};
      var funnelUsers = {
        prompt_open: {},
        prompt_confirm: {},
        view: {},
        expose: {},
        pay_cta: {},
        alipay_start: {},
        order_create_ok: {},
        order_create_fail: {},
        alipay_open: {},
        alipay_success: {},
        faq_expand: {},
        activate_ok: {},
        activate_fail: {}
      };

      rows.forEach(function (r) {
        var ek = String(r.event_key || '').trim();
        if (!isPurchasePageTrackEventKey(ek)) return;
        var c = Number(r.cnt) || 0;
        if (c <= 0) return;
        var uname = r.username != null ? String(r.username).trim() : '';
        eventTotals[ek] = (eventTotals[ek] || 0) + c;
        if (uname) eventUsers[ek][uname] = true;

        var d = formatDateKey(r.stat_date);
        if (!d) return;
        if (!dayMap[d]) {
          dayMap[d] = {
            date: d,
            events: {},
            event_users: {},
            total: 0,
            user_set: {},
            funnel: {
              prompt_open: {},
              prompt_confirm: {},
              view: {},
              expose: {},
              pay_cta: {},
              alipay_start: {},
              order_create_ok: {},
              order_create_fail: {},
              alipay_open: {},
              alipay_success: {},
              faq_expand: {},
              activate_ok: {},
              activate_fail: {}
            }
          };
          PURCHASE_PAGE_TRACK_EVENT_KEYS.forEach(function (k2) {
            dayMap[d].events[k2] = 0;
            dayMap[d].event_users[k2] = {};
          });
        }
        dayMap[d].events[ek] = (dayMap[d].events[ek] || 0) + c;
        dayMap[d].total += c;
        if (uname) {
          dayMap[d].user_set[uname] = true;
          dayMap[d].event_users[ek][uname] = true;
        }

        function markFunnel(bucket) {
          if (!uname) return;
          funnelUsers[bucket][uname] = true;
          dayMap[d].funnel[bucket][uname] = true;
        }
        if (ek === 'track_activate_prompt_open') markFunnel('prompt_open');
        if (ek === 'track_activate_prompt_confirm') markFunnel('prompt_confirm');
        if (ek === 'track_purchase_page_view') markFunnel('view');
        if (
          ek === 'track_pricing_ab_expose_control' ||
          ek === 'track_pricing_ab_expose_treatment' ||
          ek === 'track_pricing_ab_expose_code'
        ) {
          markFunnel('expose');
        }
        if (ek === 'track_purchase_pay_cta_click') markFunnel('pay_cta');
        if (ek === 'track_alipay_payment_start') markFunnel('alipay_start');
        if (ek === 'track_alipay_order_create_ok') markFunnel('order_create_ok');
        if (ek === 'track_alipay_order_create_fail') markFunnel('order_create_fail');
        if (ek === 'track_alipay_open_click') markFunnel('alipay_open');
        if (ek === 'track_alipay_payment_success') markFunnel('alipay_success');
        if (ek === 'track_purchase_faq_expand') markFunnel('faq_expand');
        if (ek === 'track_purchase_activate_success') markFunnel('activate_ok');
        if (ek === 'track_purchase_activate_fail') markFunnel('activate_fail');
      });

      function pctRate(n, d) {
        if (!d || d <= 0) return 0;
        return Math.round((n / d) * 1000) / 10;
      }
      function countSet(obj) {
        return Object.keys(obj || {}).length;
      }

      var viewUv = countSet(funnelUsers.view);
      var payCtaUv = countSet(funnelUsers.pay_cta);
      var startUv = countSet(funnelUsers.alipay_start);
      var createOkUv = countSet(funnelUsers.order_create_ok);
      var openUv = countSet(funnelUsers.alipay_open);
      var successUv = countSet(funnelUsers.alipay_success);
      var faqUv = countSet(funnelUsers.faq_expand);
      var funnel = {
        prompt_open_uv: countSet(funnelUsers.prompt_open),
        prompt_confirm_uv: countSet(funnelUsers.prompt_confirm),
        prompt_to_view_pct: pctRate(viewUv, countSet(funnelUsers.prompt_open)),
        view_uv: viewUv,
        expose_uv: countSet(funnelUsers.expose),
        pay_cta_uv: payCtaUv,
        alipay_start_uv: startUv,
        order_create_ok_uv: createOkUv,
        order_create_fail_uv: countSet(funnelUsers.order_create_fail),
        alipay_open_uv: openUv,
        alipay_success_uv: successUv,
        faq_expand_uv: faqUv,
        activate_ok_uv: countSet(funnelUsers.activate_ok),
        activate_fail_uv: countSet(funnelUsers.activate_fail),
        view_to_cta_pct: pctRate(payCtaUv, viewUv),
        view_to_start_pct: pctRate(startUv, viewUv),
        cta_to_create_ok_pct: pctRate(createOkUv, payCtaUv || startUv),
        start_to_create_ok_pct: pctRate(createOkUv, startUv),
        create_ok_to_success_pct: pctRate(successUv, createOkUv),
        start_to_open_pct: pctRate(openUv, startUv),
        open_to_success_pct: pctRate(successUv, openUv),
        view_to_pay_pct: pctRate(successUv, viewUv),
        view_to_faq_pct: pctRate(faqUv, viewUv),
        view_to_activate_pct: pctRate(countSet(funnelUsers.activate_ok), viewUv)
      };

      var priceSurvey = {
        total: 0,
        submitted: 0,
        skipped: 0,
        expensive: 0,
        fair: 0,
        cheap: 0,
        expensive_pct: 0,
        fair_pct: 0,
        cheap_pct: 0,
        skipped_pct: 0,
        with_expected_price: 0,
        avg_expected_price: null,
        expected_price_buckets: [],
        recent: []
      };
      try {
        var cnSurveyDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
        var surveyPf = analyticsPeriodCnDateFilter(cnSurveyDay, period);
        const [surveyRows] = await conn.execute(
          `SELECT skipped, sentiment, COUNT(*) AS cnt
           FROM purchase_price_survey
           WHERE ${surveyPf.sql}
           GROUP BY skipped, sentiment`,
          surveyPf.params
        );
        (surveyRows || []).forEach(function (r) {
          var c = Number(r.cnt) || 0;
          priceSurvey.total += c;
          if (Number(r.skipped) === 1) {
            priceSurvey.skipped += c;
            return;
          }
          priceSurvey.submitted += c;
          var s = String(r.sentiment || '').toLowerCase();
          if (s === 'expensive') priceSurvey.expensive += c;
          else if (s === 'cheap') priceSurvey.cheap += c;
          else if (s === 'fair') priceSurvey.fair += c;
          /* sentiment=skipped 且 skipped=0 的异常行不计入 fair */
        });
        priceSurvey.expensive_pct = pctRate(priceSurvey.expensive, priceSurvey.submitted);
        priceSurvey.fair_pct = pctRate(priceSurvey.fair, priceSurvey.submitted);
        priceSurvey.cheap_pct = pctRate(priceSurvey.cheap, priceSurvey.submitted);
        priceSurvey.skipped_pct = pctRate(priceSurvey.skipped, priceSurvey.total);
        var surveyBidJoin = purchasePriceSurvey.latestBidJoinSql('s', 'bid');
        var surveyExpectSql = purchasePriceSurvey.coalescedExpectedPriceSql('s', 'bid');
        var cnSurveyDayAliased = 'DATE(DATE_ADD(s.created_at, INTERVAL 8 HOUR))';
        var surveyPfAliased = analyticsPeriodCnDateFilter(cnSurveyDayAliased, period);
        const [priceAgg] = await conn.execute(
          `SELECT COUNT(*) AS with_price, AVG(${surveyExpectSql}) AS avg_price
           FROM purchase_price_survey s
           ${surveyBidJoin}
           WHERE ${surveyPfAliased.sql}
             AND s.skipped = 0
             AND ${surveyExpectSql} IS NOT NULL`,
          surveyPfAliased.params
        );
        if (priceAgg && priceAgg[0]) {
          priceSurvey.with_expected_price = Number(priceAgg[0].with_price) || 0;
          var avgP = Number(priceAgg[0].avg_price);
          priceSurvey.avg_expected_price = isFinite(avgP) ? Math.round(avgP * 100) / 100 : null;
        }
        const [bucketRows] = await conn.execute(
          `SELECT ${surveyExpectSql} AS price, COUNT(*) AS cnt
           FROM purchase_price_survey s
           ${surveyBidJoin}
           WHERE ${surveyPfAliased.sql}
             AND s.skipped = 0
             AND ${surveyExpectSql} IS NOT NULL
           GROUP BY ${surveyExpectSql}
           ORDER BY cnt DESC, price ASC
           LIMIT 40`,
          surveyPfAliased.params
        );
        var knownPrices = { 50: 1, 98: 1, 148: 1, 198: 1, 199: 1 };
        var bucketMap = { '50': 0, '98': 0, '148': 0, '198': 0, '199': 0, other: 0 };
        (bucketRows || []).forEach(function (r) {
          var p = Number(r.price);
          var c = Number(r.cnt) || 0;
          if (!isFinite(p) || c < 1) return;
          var key = String(Math.round(p));
          if (knownPrices[key]) bucketMap[key] += c;
          else bucketMap.other += c;
        });
        priceSurvey.expected_price_buckets = [
          { label: '¥50', price: 50, count: bucketMap['50'] },
          { label: '¥98', price: 98, count: bucketMap['98'] },
          { label: '¥148', price: 148, count: bucketMap['148'] },
          { label: '¥198', price: 198, count: bucketMap['198'] },
          { label: '¥199', price: 199, count: bucketMap['199'] },
          { label: '其他', price: null, count: bucketMap.other }
        ];
        const [recentRows] = await conn.execute(
          `SELECT s.username, s.sentiment, s.expected_price, s.skipped, s.created_at,
                  bid.bid_amount AS bid_amount
           FROM purchase_price_survey s
           ${surveyBidJoin}
           WHERE ${surveyPfAliased.sql}
           ORDER BY s.created_at DESC
           LIMIT 30`,
          surveyPfAliased.params
        );
        priceSurvey.recent = (recentRows || []).map(function (r) {
          return {
            username: r.username != null ? String(r.username) : '',
            sentiment: r.sentiment != null ? String(r.sentiment) : '',
            expected_price: purchasePriceSurvey.effectiveExpectedPrice(r, r.bid_amount),
            skipped: Number(r.skipped) === 1,
            created_at: r.created_at ? new Date(r.created_at).toISOString() : ''
          };
        });
      } catch (eSurvey) {
        console.error('[admin purchase-events] price_survey', eSurvey && eSurvey.message);
      }

      var summary = PURCHASE_PAGE_TRACK_EVENT_KEYS.map(function (k) {
        return {
          event_key: k,
          label: purchasePageTrackEventLabel(k),
          total: eventTotals[k] || 0,
          unique_users: countSet(eventUsers[k])
        };
      });

      var paidDailyMap = {};
      var paidSummary = {
        paid_orders: 0,
        paid_users: 0,
        gmv: 0,
        activation_orders: 0,
        activation_gmv: 0,
        lizhi_orders: 0,
        lizhi_users: 0,
        lizhi_gmv: 0,
        rename_orders: 0,
        rename_gmv: 0,
        tax_edit_orders: 0,
        tax_edit_gmv: 0
      };
      /* NULL sku/grant 的历史订单归开通；CASE WHEN NULL 视为否，勿用 NOT (a OR b) */
      var lizhiSkuSql =
        "(sku_id = '" +
        LIZHI_CERT_SKU_ID +
        "' OR grant_kind = 'lizhi_cert')";
      var zaizhiSkuSql =
        "(sku_id = '" +
        ZAIZHI_CERT_SKU_ID +
        "' OR grant_kind = 'zaizhi_cert')";
      var renameSkuSql =
        "(sku_id = '" +
        RENAME_FEE_SKU_ID +
        "' OR grant_kind = 'rename_credit')";
      var taxEditSkuSql =
        "(sku_id IN ('" +
        taxEditFeePolicy.TAX_EDIT_SINGLE_SKU_ID +
        "','" +
        taxEditFeePolicy.TAX_EDIT_DAILY_SKU_ID +
        "') OR grant_kind IN ('tax_edit_single','tax_edit_daily'))";
      var activationOrderCase =
        'CASE WHEN ' +
        lizhiSkuSql +
        ' THEN 0 WHEN ' +
        zaizhiSkuSql +
        ' THEN 0 WHEN ' +
        renameSkuSql +
        ' THEN 0 WHEN ' +
        taxEditSkuSql +
        ' THEN 0 ELSE 1 END';
      var activationAmountCase =
        'CASE WHEN ' +
        lizhiSkuSql +
        ' THEN 0 WHEN ' +
        zaizhiSkuSql +
        ' THEN 0 WHEN ' +
        renameSkuSql +
        ' THEN 0 WHEN ' +
        taxEditSkuSql +
        ' THEN 0 ELSE amount END';
      try {
        const [paidDaily] = await conn.execute(
          `SELECT ${cnPaidDay} AS d,
                  COUNT(*) AS paid_orders,
                  COUNT(DISTINCT username) AS paid_users,
                  ROUND(COALESCE(SUM(amount), 0), 2) AS gmv,
                  SUM(${activationOrderCase}) AS activation_orders,
                  ROUND(COALESCE(SUM(${activationAmountCase}), 0), 2) AS activation_gmv,
                  SUM(CASE WHEN ${lizhiSkuSql} THEN 1 ELSE 0 END) AS lizhi_orders,
                  COUNT(DISTINCT CASE WHEN ${lizhiSkuSql} THEN username ELSE NULL END) AS lizhi_users,
                  ROUND(COALESCE(SUM(CASE WHEN ${lizhiSkuSql} THEN amount ELSE 0 END), 0), 2) AS lizhi_gmv,
                  SUM(CASE WHEN ${renameSkuSql} THEN 1 ELSE 0 END) AS rename_orders,
                  ROUND(COALESCE(SUM(CASE WHEN ${renameSkuSql} THEN amount ELSE 0 END), 0), 2) AS rename_gmv,
                  SUM(CASE WHEN ${taxEditSkuSql} THEN 1 ELSE 0 END) AS tax_edit_orders,
                  ROUND(COALESCE(SUM(CASE WHEN ${taxEditSkuSql} THEN amount ELSE 0 END), 0), 2) AS tax_edit_gmv
           FROM payment_orders
           WHERE status = 'paid' AND ${paidPf.sql}
           GROUP BY ${cnPaidDay}
           ORDER BY d DESC`,
          paidPf.params
        );
        (paidDaily || []).forEach(function (r) {
          var dk = formatDateKey(r.d);
          if (!dk) return;
          paidDailyMap[dk] = {
            paid_orders: Number(r.paid_orders) || 0,
            paid_users: Number(r.paid_users) || 0,
            gmv: Number(r.gmv) || 0,
            activation_orders: Number(r.activation_orders) || 0,
            activation_gmv: Number(r.activation_gmv) || 0,
            lizhi_orders: Number(r.lizhi_orders) || 0,
            lizhi_users: Number(r.lizhi_users) || 0,
            lizhi_gmv: Number(r.lizhi_gmv) || 0,
            rename_orders: Number(r.rename_orders) || 0,
            rename_gmv: Number(r.rename_gmv) || 0,
            tax_edit_orders: Number(r.tax_edit_orders) || 0,
            tax_edit_gmv: Number(r.tax_edit_gmv) || 0
          };
          paidSummary.paid_orders += Number(r.paid_orders) || 0;
          paidSummary.gmv += Number(r.gmv) || 0;
          paidSummary.activation_orders += Number(r.activation_orders) || 0;
          paidSummary.activation_gmv += Number(r.activation_gmv) || 0;
          paidSummary.lizhi_orders += Number(r.lizhi_orders) || 0;
          paidSummary.lizhi_gmv += Number(r.lizhi_gmv) || 0;
          paidSummary.rename_orders += Number(r.rename_orders) || 0;
          paidSummary.rename_gmv += Number(r.rename_gmv) || 0;
          paidSummary.tax_edit_orders += Number(r.tax_edit_orders) || 0;
          paidSummary.tax_edit_gmv += Number(r.tax_edit_gmv) || 0;
        });
        const [paidUsersRow] = await conn.execute(
          `SELECT COUNT(DISTINCT username) AS paid_users,
                  COUNT(DISTINCT CASE WHEN ${lizhiSkuSql} THEN username ELSE NULL END) AS lizhi_users
           FROM payment_orders
           WHERE status = 'paid' AND ${paidPf.sql}`,
          paidPf.params
        );
        paidSummary.paid_users = Number((paidUsersRow[0] || {}).paid_users) || 0;
        paidSummary.lizhi_users = Number((paidUsersRow[0] || {}).lizhi_users) || 0;
        paidSummary.gmv = Math.round(paidSummary.gmv * 100) / 100;
        paidSummary.activation_gmv = Math.round(paidSummary.activation_gmv * 100) / 100;
        paidSummary.lizhi_gmv = Math.round(paidSummary.lizhi_gmv * 100) / 100;
        paidSummary.rename_gmv = Math.round(paidSummary.rename_gmv * 100) / 100;
        paidSummary.tax_edit_gmv = Math.round(paidSummary.tax_edit_gmv * 100) / 100;
      } catch (ePay) {
        console.error('[admin purchase-events] payment_orders', ePay && ePay.message);
      }

      var adminActivationCredit = await queryPurchaseAnalyticsAdminActivationCredits(conn, period);
      var adminActSummary = adminActivationCredit.summary || emptyPurchaseAnalyticsAdminActivationCredit();
      var adminActDailyMap = adminActivationCredit.dailyMap || {};
      paidSummary.admin_activation = adminActSummary;
      paidSummary.admin_activation_orders = adminActSummary.total_orders || 0;
      paidSummary.admin_activation_gmv = adminActSummary.total_gmv || 0;
      paidSummary.combined_gmv =
        Math.round(((paidSummary.gmv || 0) + (paidSummary.admin_activation_gmv || 0)) * 100) / 100;
      paidSummary.combined_activation_orders =
        (paidSummary.activation_orders || 0) + (paidSummary.admin_activation_orders || 0);
      paidSummary.combined_activation_gmv =
        Math.round(
          ((paidSummary.activation_gmv || 0) + (paidSummary.admin_activation_gmv || 0)) * 100
        ) / 100;

      var byDay = Object.keys(dayMap)
        .concat(
          Object.keys(paidDailyMap).filter(function (dk) {
            return !dayMap[dk];
          })
        )
        .concat(
          Object.keys(adminActDailyMap).filter(function (dk) {
            return !dayMap[dk] && !paidDailyMap[dk];
          })
        )
        .filter(function (v, i, a) {
          return a.indexOf(v) === i;
        })
        .sort()
        .reverse()
        .map(function (d) {
          var o = dayMap[d] || {
            date: d,
            events: {},
            event_users: {},
            total: 0,
            user_set: {},
            funnel: {
              prompt_open: {},
              prompt_confirm: {},
              view: {},
              expose: {},
              pay_cta: {},
              alipay_start: {},
              order_create_ok: {},
              order_create_fail: {},
              alipay_open: {},
              alipay_success: {},
              faq_expand: {},
              activate_ok: {},
              activate_fail: {}
            }
          };
          PURCHASE_PAGE_TRACK_EVENT_KEYS.forEach(function (k2) {
            if (o.events[k2] == null) o.events[k2] = 0;
          });
          var f = o.funnel;
          var dayView = countSet(f.view);
          var dayStart = countSet(f.alipay_start);
          var dayCreateOk = countSet(f.order_create_ok);
          var daySuccess = countSet(f.alipay_success);
          var dayFaq = countSet(f.faq_expand);
          var pay = paidDailyMap[d] || {
            paid_orders: 0,
            paid_users: 0,
            gmv: 0,
            activation_orders: 0,
            activation_gmv: 0,
            lizhi_orders: 0,
            lizhi_users: 0,
            lizhi_gmv: 0,
            rename_orders: 0,
            rename_gmv: 0,
            tax_edit_orders: 0,
            tax_edit_gmv: 0
          };
          var adminActDay = adminActDailyMap[d] || {
            admin_activation_orders: 0,
            admin_activation_gmv: 0,
            by_admin: {}
          };
          var combinedGmv =
            Math.round(((pay.gmv || 0) + (adminActDay.admin_activation_gmv || 0)) * 100) / 100;
          var combinedActivationGmv =
            Math.round(
              ((pay.activation_gmv || 0) + (adminActDay.admin_activation_gmv || 0)) * 100
            ) / 100;
          return {
            date: d,
            events: o.events,
            total: o.total,
            unique_users: countSet(o.user_set),
            prompt_open_uv: countSet(f.prompt_open),
            prompt_confirm_uv: countSet(f.prompt_confirm),
            view_uv: dayView,
            expose_uv: countSet(f.expose),
            pay_cta_uv: countSet(f.pay_cta),
            alipay_start_uv: dayStart,
            order_create_ok_uv: dayCreateOk,
            order_create_fail_uv: countSet(f.order_create_fail),
            alipay_open_uv: countSet(f.alipay_open),
            alipay_success_uv: daySuccess,
            faq_expand_uv: dayFaq,
            activate_ok_uv: countSet(f.activate_ok),
            activate_fail_uv: countSet(f.activate_fail),
            view_to_cta_pct: pctRate(countSet(f.pay_cta), dayView),
            start_to_create_ok_pct: pctRate(dayCreateOk, dayStart),
            create_ok_to_success_pct: pctRate(daySuccess, dayCreateOk),
            view_to_faq_pct: pctRate(dayFaq, dayView),
            view_to_pay_pct: pctRate(daySuccess, dayView),
            paid_orders: pay.paid_orders,
            paid_users: pay.paid_users,
            gmv: pay.gmv,
            activation_orders: pay.activation_orders,
            activation_gmv: pay.activation_gmv,
            admin_activation_orders: adminActDay.admin_activation_orders || 0,
            admin_activation_gmv: adminActDay.admin_activation_gmv || 0,
            admin_activation_by_admin: adminActDay.by_admin || {},
            combined_gmv: combinedGmv,
            combined_activation_gmv: combinedActivationGmv,
            lizhi_orders: pay.lizhi_orders,
            lizhi_users: pay.lizhi_users,
            lizhi_gmv: pay.lizhi_gmv,
            rename_orders: pay.rename_orders,
            rename_gmv: pay.rename_gmv,
            tax_edit_orders: pay.tax_edit_orders,
            tax_edit_gmv: pay.tax_edit_gmv
          };
        });

      var grandTotal = 0;
      summary.forEach(function (s) {
        grandTotal += s.total;
      });

      return res.json({
        code: 200,
        data: Object.assign(conversionAnalyticsPeriodMeta(period), {
          event_keys: PURCHASE_PAGE_TRACK_EVENT_KEYS.slice(),
          funnel: funnel,
          payments: paidSummary,
          price_survey: priceSurvey,
          summary: summary,
          total_events: grandTotal,
          by_day: byDay
        })
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[admin purchase-events]', e);
    return res.status(500).json({ code: 500, msg: '加载支付页埋点失败' });
  }
}

/** 支付页埋点：某日用户明细 */
async function handleAdminAnalyticsPurchaseEventUsers(req, res) {
  try {
    var dateStr = req.query.date != null ? String(req.query.date).trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ code: 400, msg: 'date required (YYYY-MM-DD)' });
    }
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 20;
    if (page < 1) page = 1;
    if (limit < 1) limit = 20;
    if (limit > 100) limit = 100;
    var cnPaidDay = 'DATE(DATE_ADD(COALESCE(paid_at, created_at), INTERVAL 8 HOUR))';
    var skuLabelFn = require('../admin/opsConversion').opsSkuGmvLabel;
    const conn = await pool.getConnection();
    try {
      /* 展开行只展示当日已付订单明细（按用户聚合），不再列埋点次数 */
      const [payRows] = await conn.execute(
        `SELECT id, username, sku_id, subject, grant_kind, amount,
                out_trade_no, paid_at, created_at
         FROM payment_orders
         WHERE status = 'paid' AND ${cnPaidDay} = ?
         ORDER BY COALESCE(paid_at, created_at) DESC, id DESC`,
        [dateStr]
      );
      var userMap = {};
      var orderTotal = 0;
      var gmvTotal = 0;
      (payRows || []).forEach(function (r) {
        var uname = String(r.username || '').trim();
        if (!uname) return;
        if (!userMap[uname]) {
          userMap[uname] = {
            username: uname,
            order_count: 0,
            total_amount: 0,
            payments: [],
            last_at: null
          };
        }
        var amount = Math.round(Number(r.amount || 0) * 100) / 100;
        var paidAt = r.paid_at || r.created_at || null;
        var at = paidAt ? new Date(paidAt).getTime() : 0;
        userMap[uname].payments.push({
          id: Number(r.id) || 0,
          sku_id: String(r.sku_id || ''),
          label: skuLabelFn(r),
          subject: String(r.subject || ''),
          amount: amount,
          out_trade_no: String(r.out_trade_no || ''),
          paid_at: paidAt ? new Date(paidAt).toISOString() : null
        });
        userMap[uname].order_count += 1;
        userMap[uname].total_amount =
          Math.round((userMap[uname].total_amount + amount) * 100) / 100;
        if (!userMap[uname].last_at || at > userMap[uname].last_at) {
          userMap[uname].last_at = at;
        }
        orderTotal += 1;
        gmvTotal += amount;
      });
      var list = Object.keys(userMap)
        .map(function (k) {
          return userMap[k];
        })
        .sort(function (a, b) {
          return (
            b.total_amount - a.total_amount ||
            b.order_count - a.order_count ||
            String(a.username).localeCompare(String(b.username))
          );
        });
      var total = list.length;
      var totalPages = Math.max(1, Math.ceil(total / limit) || 1);
      if (page > totalPages) page = totalPages;
      var slice = list.slice((page - 1) * limit, page * limit).map(function (u) {
        return {
          username: u.username,
          order_count: u.order_count,
          total_amount: u.total_amount,
          payments: u.payments,
          last_at: u.last_at ? new Date(u.last_at).toISOString() : null
        };
      });
      return res.json({
        code: 200,
        data: {
          date: dateStr,
          page: page,
          limit: limit,
          total: total,
          total_pages: totalPages,
          order_count: orderTotal,
          gmv: Math.round(gmvTotal * 100) / 100,
          users: slice
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[admin purchase-events/users]', e);
    return res.status(500).json({ code: 500, msg: '加载付款明细失败' });
  }
}

/** 激活弹窗 / 购买页相关埋点（单独统计，不计入通用 C 端埋点列表） */
var ACTIVATE_TRACK_EVENT_KEYS = [
  'track_purchase_page_view',
  'track_activate_prompt_open',
  'track_activate_prompt_cancel',
  'track_activate_prompt_confirm',
  'track_purchase_activate_success',
  'track_purchase_activate_fail',
  'track_purchase_pay_cta_click',
  'track_alipay_payment_start',
  'track_alipay_order_create_ok',
  'track_alipay_order_create_fail',
  'track_alipay_open_click',
  'track_alipay_payment_success',
  'track_purchase_faq_expand',
  'track_purchase_success_cases_view',
  'track_purchase_fold_expand',
  'track_purchase_share_teaser_click',
  'track_purchase_price_survey_open',
  'track_purchase_price_survey_submit',
  'track_purchase_price_survey_skip',
  'track_purchase_price_survey_soft_dismiss',
  'track_purchase_price_survey_to_bid',
  'track_price_bid_open',
  'track_price_bid_submit',
  'track_kufaka_purchase_click',
  'track_purchase_sales_agent_view',
  'track_purchase_sales_agent_copy_wechat',
  'track_purchase_sales_agent_qr',
  'track_qq_add_click',
  'track_purchase_back_click',
  'track_activation_nudge_show',
  'track_activation_nudge_dismiss',
  'track_activation_nudge_cta'
];

var ACTIVATE_TRACK_EVENT_KEY_SET = {};
ACTIVATE_TRACK_EVENT_KEYS.forEach(function (k) {
  ACTIVATE_TRACK_EVENT_KEY_SET[k] = true;
});

var ACTIVATE_TRACK_EVENT_SQL =
  '(' +
  ACTIVATE_TRACK_EVENT_KEYS.map(function (k) {
    return "route_key LIKE '%#" + k + "'";
  }).join(' OR ') +
  ')';

/** 是否：activate track event key */
function isActivateTrackEventKey(eventKey) {
  return !!ACTIVATE_TRACK_EVENT_KEY_SET[String(eventKey || '').trim()];
}

/** activate track event label */
function activateTrackEventLabel(eventKey) {
  var labels = {
    track_activate_prompt_open: '激活弹窗打开',
    track_activate_prompt_cancel: '激活弹窗-取消',
    track_activate_prompt_confirm: '确认激活',
    track_kufaka_purchase_click: '酷发卡购买',
    track_qq_add_click: '添加QQ号',
    track_purchase_page_view: '购买页浏览',
    track_purchase_sales_agent_view: 'C·销售代理入口',
    track_purchase_sales_agent_copy_wechat: 'C·复制销售微信',
    track_purchase_sales_agent_qr: 'C·销售微信二维码',
    track_purchase_activate_success: '激活码开通成功',
    track_purchase_activate_fail: '激活码开通失败',
    track_purchase_back_click: '购买页返回',
    track_activation_nudge_show: '激活引导弹窗-展示',
    track_activation_nudge_dismiss: '激活引导弹窗-关闭',
    track_activation_nudge_cta: '激活引导弹窗-去激活',
    track_purchase_pay_cta_click: '支付CTA点击',
    track_alipay_payment_start: '生成支付宝付款码',
    track_alipay_order_create_ok: '下单创建成功',
    track_alipay_order_create_fail: '下单创建失败',
    track_alipay_open_click: '打开支付宝付款',
    track_alipay_payment_success: '支付宝付款开通成功',
    track_purchase_faq_expand: '支付FAQ展开',
    track_purchase_success_cases_view: '成功案例曝光',
    track_purchase_fold_expand: '折叠区展开',
    track_purchase_share_teaser_click: '分享优惠入口点击',
    track_purchase_price_survey_open: '离开调研打开',
    track_purchase_price_survey_submit: '离开调研提交',
    track_purchase_price_survey_skip: '离开调研跳过',
    track_purchase_price_survey_soft_dismiss: '离开调研软关闭',
    track_purchase_price_survey_to_bid: '离开调研偏贵转出价',
    track_price_bid_open: '心理价出价打开',
    track_price_bid_submit: '心理价出价提交'
  };
  return labels[eventKey] || eventKey;
}

/** 清理埋点事件 */
async function handleAdminAnalyticsEventsClear(req, res) {
  try {
    var period = parseAnalyticsPeriod(
      req.query.days != null ? req.query.days : req.body && req.body.days,
      90
    );
    var pf = analyticsPeriodStatDateFilter(period);
    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(
        `DELETE FROM analytics_api_daily
         WHERE ${pf.sql}
           AND ${ANALYTICS_TRACK_EVENT_SQL}`,
        pf.params
      );
      return res.json({
        code: 200,
        data: Object.assign(
          {
            deleted_rows: result && result.affectedRows != null ? Number(result.affectedRows) : 0
          },
          conversionAnalyticsPeriodMeta(period)
        )
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 页面事件列表 */
async function handleAdminAnalyticsEvents(req, res) {
  try {
    var period = parseAnalyticsPeriod(req.query.days, 90);
    var pf = analyticsPeriodStatDateFilter(period);
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        `SELECT stat_date, route_key, SUM(cnt) AS total
         FROM analytics_api_daily
         WHERE ${pf.sql}
           AND ${ANALYTICS_TRACK_EVENT_SQL}
         GROUP BY stat_date, route_key
         ORDER BY stat_date ASC`,
        pf.params
      );
      var eventMap = {};
      var dayMap = {};
      rows.forEach(function (r) {
        var rawKey = r.route_key != null ? String(r.route_key) : '';
        var eventKey = normalizeTrackEventKeyFromRoute(rawKey);
        if (!eventKey) return;
        var c = Number(r.total || 0);
        if (!isFinite(c) || c <= 0) return;
        if (!eventMap[eventKey]) {
          eventMap[eventKey] = { event_key: eventKey, total: 0 };
        }
        eventMap[eventKey].total += c;
        var d = '';
        if (r.stat_date instanceof Date) {
          d = r.stat_date.toISOString().slice(0, 10);
        } else {
          d = String(r.stat_date || '').slice(0, 10);
        }
        if (!dayMap[d]) dayMap[d] = 0;
        dayMap[d] += c;
      });
      var topEvents = Object.keys(eventMap).map(function (k) {
        return eventMap[k];
      });
      topEvents.sort(function (a, b) {
        return b.total - a.total;
      });
      topEvents = topEvents.filter(function (row) {
        return !isActivateTrackEventKey(row.event_key);
      });
      var byDay = Object.keys(dayMap)
        .sort()
        .map(function (d) {
          return { date: d, total: dayMap[d] };
        });
      return res.json({
        code: 200,
        data: Object.assign(
          {
            total_events: rows.length,
            by_day: byDay,
            top_events: topEvents.slice(0, 200)
          },
          conversionAnalyticsPeriodMeta(period)
        )
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 定价 A/B：购买区曝光人均支付（主指标）+ 分臂/SKU */
async function handleAdminAnalyticsPricingAb(req, res) {
  try {
    var period = parseAnalyticsPeriod(req.query.days, 90);
    var pf = analyticsPeriodLoginDatetimeFilter(period);
    const conn = await pool.getConnection();
    try {
      const [exposeRows] = await conn.execute(
        `SELECT
           CASE
             WHEN route_key LIKE '%track_pricing_ab_expose_treatment%' THEN 'treatment'
             WHEN route_key LIKE '%track_pricing_ab_expose_control%' THEN 'control'
             WHEN route_key LIKE '%track_pricing_ab_expose_code%' THEN 'c'
             ELSE 'unknown'
           END AS variant,
           COUNT(DISTINCT username) AS exposed_users,
           COUNT(*) AS expose_events
         FROM user_page_events
         WHERE ${pf.sql}
           AND (
             route_key LIKE '%track_pricing_ab_expose_control%'
             OR route_key LIKE '%track_pricing_ab_expose_treatment%'
             OR route_key LIKE '%track_pricing_ab_expose_code%'
           )
         GROUP BY variant`,
        pf.params
      );
      const [payRows] = await conn.execute(
        `SELECT
           COALESCE(NULLIF(pricing_variant, ''), 'unknown') AS variant,
           COALESCE(NULLIF(sku_id, ''), 'unknown') AS sku_id,
           COUNT(*) AS paid_orders,
           COUNT(DISTINCT username) AS paid_users,
           ROUND(SUM(amount), 2) AS gmv
         FROM payment_orders
         WHERE status = 'paid' AND ${pf.sql}
         GROUP BY variant, sku_id
         ORDER BY variant, gmv DESC`,
        pf.params
      );
      const [payByVariant] = await conn.execute(
        `SELECT
           COALESCE(NULLIF(pricing_variant, ''), 'unknown') AS variant,
           COUNT(*) AS paid_orders,
           COUNT(DISTINCT username) AS paid_users,
           ROUND(SUM(amount), 2) AS gmv
         FROM payment_orders
         WHERE status = 'paid' AND ${pf.sql}
         GROUP BY variant`,
        pf.params
      );
      var exposeMap = {};
      (exposeRows || []).forEach(function (r) {
        exposeMap[String(r.variant)] = {
          exposed_users: Number(r.exposed_users) || 0,
          expose_events: Number(r.expose_events) || 0
        };
      });
      var arms = ['control', 'treatment', 'c', 'unknown'].map(function (v) {
        var ex = exposeMap[v] || { exposed_users: 0, expose_events: 0 };
        var pay = null;
        for (var i = 0; i < (payByVariant || []).length; i++) {
          if (String(payByVariant[i].variant) === v) {
            pay = payByVariant[i];
            break;
          }
        }
        var gmv = pay ? Number(pay.gmv) || 0 : 0;
        var exposed = ex.exposed_users;
        return {
          variant: v,
          exposed_users: exposed,
          expose_events: ex.expose_events,
          paid_orders: pay ? Number(pay.paid_orders) || 0 : 0,
          paid_users: pay ? Number(pay.paid_users) || 0 : 0,
          gmv: gmv,
          arpu_exposed: exposed > 0 ? Math.round((gmv / exposed) * 100) / 100 : 0,
          pay_cvr: exposed > 0 ? Math.round(((pay ? Number(pay.paid_users) || 0 : 0) / exposed) * 1000) / 10 : 0
        };
      });
      var cfg = await getPricingAb().loadPricingAbParsed(true);
      return res.json({
        code: 200,
        data: Object.assign(conversionAnalyticsPeriodMeta(period), {
          pricing_ab: cfg,
          primary_metric: 'arpu_exposed',
          primary_metric_label: '购买区曝光用户人均支付金额',
          arms: arms,
          sku_breakdown: (payRows || []).map(function (r) {
            return {
              variant: String(r.variant),
              sku_id: String(r.sku_id),
              paid_orders: Number(r.paid_orders) || 0,
              paid_users: Number(r.paid_users) || 0,
              gmv: Number(r.gmv) || 0
            };
          })
        })
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 激活相关事件 */
async function handleAdminAnalyticsActivateEvents(req, res) {
  try {
    var period = parseAnalyticsPeriod(req.query.days, 90);
    var loginPf = analyticsPeriodLoginDatetimeFilter(period);
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        `SELECT DATE(created_at) AS stat_date, username,
                SUBSTRING_INDEX(route_key, '#', -1) AS event_key,
                COUNT(*) AS cnt
         FROM user_page_events
         WHERE ${loginPf.sql}
           AND ${ACTIVATE_TRACK_EVENT_SQL}
         GROUP BY DATE(created_at), username, event_key
         ORDER BY stat_date DESC`,
        loginPf.params
      );
      var eventTotals = {};
      ACTIVATE_TRACK_EVENT_KEYS.forEach(function (k) {
        eventTotals[k] = 0;
      });
      var dayMap = {};
      rows.forEach(function (r) {
        var ek = String(r.event_key || '').trim();
        if (!isActivateTrackEventKey(ek)) {
          return;
        }
        var c = Number(r.cnt) || 0;
        if (c <= 0) {
          return;
        }
        eventTotals[ek] = (eventTotals[ek] || 0) + c;
        var d = '';
        if (r.stat_date instanceof Date) {
          d = r.stat_date.toISOString().slice(0, 10);
        } else {
          d = String(r.stat_date || '').slice(0, 10);
        }
        if (!d) {
          return;
        }
        if (!dayMap[d]) {
          dayMap[d] = { date: d, events: {}, total: 0, user_set: {} };
          ACTIVATE_TRACK_EVENT_KEYS.forEach(function (k2) {
            dayMap[d].events[k2] = 0;
          });
        }
        dayMap[d].events[ek] = (dayMap[d].events[ek] || 0) + c;
        dayMap[d].total += c;
        if (r.username) {
          dayMap[d].user_set[String(r.username)] = true;
        }
      });
      var summary = ACTIVATE_TRACK_EVENT_KEYS.map(function (k) {
        return {
          event_key: k,
          label: activateTrackEventLabel(k),
          total: eventTotals[k] || 0
        };
      });
      var byDay = Object.keys(dayMap)
        .sort()
        .reverse()
        .map(function (d) {
          var o = dayMap[d];
          return {
            date: o.date,
            events: o.events,
            total: o.total,
            unique_users: Object.keys(o.user_set).length
          };
        });
      var grandTotal = 0;
      summary.forEach(function (s) {
        grandTotal += s.total;
      });
      return res.json({
        code: 200,
        data: Object.assign(
          {
            event_keys: ACTIVATE_TRACK_EVENT_KEYS.slice(),
            summary: summary,
            total_clicks: grandTotal,
            by_day: byDay
          },
          conversionAnalyticsPeriodMeta(period)
        )
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 激活事件用户 */
async function handleAdminAnalyticsActivateEventUsers(req, res) {
  try {
    var dateStr = req.query.date != null ? String(req.query.date).trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ code: 400, msg: 'date required (YYYY-MM-DD)' });
    }
    var eventKey = req.query.event_key != null ? String(req.query.event_key).trim() : '';
    if (eventKey && !isActivateTrackEventKey(eventKey)) {
      return res.status(400).json({ code: 400, msg: 'invalid event_key' });
    }
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 20;
    if (page < 1) {
      page = 1;
    }
    if (limit < 1) {
      limit = 20;
    }
    if (limit > 100) {
      limit = 100;
    }
    const conn = await pool.getConnection();
    try {
      var eventFilterSql = ACTIVATE_TRACK_EVENT_SQL;
      var params = [dateStr];
      if (eventKey) {
        eventFilterSql = 'route_key LIKE ?';
        params = [dateStr, '%#' + eventKey];
      }
      const [aggRows] = await conn.execute(
        `SELECT username,
                SUBSTRING_INDEX(route_key, '#', -1) AS event_key,
                COUNT(*) AS cnt,
                MAX(created_at) AS last_at
         FROM user_page_events
         WHERE DATE(created_at) = ?
           AND ${eventFilterSql}
         GROUP BY username, event_key`,
        params
      );
      var userMap = {};
      aggRows.forEach(function (r) {
        var ek = String(r.event_key || '').trim();
        if (!isActivateTrackEventKey(ek)) {
          return;
        }
        var uname = String(r.username || '').trim();
        if (!uname) {
          return;
        }
        if (!userMap[uname]) {
          userMap[uname] = {
            username: uname,
            events: {},
            total: 0,
            last_at: ''
          };
          ACTIVATE_TRACK_EVENT_KEYS.forEach(function (k) {
            userMap[uname].events[k] = 0;
          });
        }
        var c = Number(r.cnt) || 0;
        userMap[uname].events[ek] = (userMap[uname].events[ek] || 0) + c;
        userMap[uname].total += c;
        var la = r.last_at ? (r.last_at instanceof Date ? r.last_at.toISOString() : String(r.last_at)) : '';
        if (la && (!userMap[uname].last_at || la > userMap[uname].last_at)) {
          userMap[uname].last_at = la;
        }
      });
      var users = Object.keys(userMap)
        .map(function (k) {
          return userMap[k];
        })
        .sort(function (a, b) {
          return b.total - a.total || String(a.username).localeCompare(String(b.username));
        });
      var total = users.length;
      var totalPages = Math.max(1, Math.ceil(total / limit) || 1);
      if (page > totalPages) {
        page = totalPages;
      }
      var offset = (page - 1) * limit;
      var pageUsers = users.slice(offset, offset + limit);
      return res.json({
        code: 200,
        data: {
          date: dateStr,
          event_key: eventKey || '',
          users: pageUsers,
          total: total,
          page: page,
          limit: limit,
          total_pages: totalPages
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 最近登录 */
async function handleAdminAnalyticsLoginRecent(req, res) {
  try {
    var page = parseInt(req.query.page, 10);
    if (!isFinite(page) || page < 1) {
      page = 1;
    }
    var limit = parseInt(req.query.limit, 10);
    if (!isFinite(limit) || limit < 1) {
      limit = 20;
    }
    if (limit > 100) {
      limit = 100;
    }
    var qUsername = req.query.username != null ? String(req.query.username).trim() : '';
    var qOk = req.query.ok != null ? String(req.query.ok).trim() : '';
    var qReason = req.query.reason != null ? String(req.query.reason).trim() : '';
    var where = [];
    var params = [];
    if (qUsername) {
      where.push('username LIKE ?');
      params.push('%' + qUsername + '%');
    }
    if (qOk === '1' || qOk === '0') {
      where.push('ok = ?');
      params.push(qOk === '1' ? 1 : 0);
    }
    appendUserLoginReasonFilter(where, params, qReason);
    if (!req.admin || !req.admin.is_super) {
      appendSubAdminOwnedUsersScopeForAdmin(
        where,
        params,
        req.admin,
        'user_login_events.username'
      );
    }
    var whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const conn = await pool.getConnection();
    try {
      const [[countRow]] = await conn.execute('SELECT COUNT(*) AS c FROM user_login_events' + whereSql, params);
      var total = countRow && countRow.c != null ? Number(countRow.c) : 0;
      var totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
      if (totalPages > 0 && page > totalPages) {
        page = totalPages;
      }
      // 分页避免 LIMIT/OFFSET 占位符：部分 MySQL/MariaDB 或中间层对预编译 LIMIT 会报 stmt_execute 参数错误
      var offset = Math.max(0, ((page - 1) * limit) | 0);
      var limInt = limit | 0;
      const [rows] = await conn.query(
        'SELECT username, ok, reason, reason_detail, ip, city, user_agent, created_at FROM user_login_events ' +
          whereSql +
          ' ' +
          'ORDER BY id DESC LIMIT ' +
          limInt +
          ' OFFSET ' +
          offset,
        params
      );
      if (total > 0 && totalPages < 1) {
        totalPages = 1;
      }
      return res.json({
        code: 200,
        data: {
          items: rows.map(function (r) {
            var reasonKey = r.reason != null ? String(r.reason) : '';
            var reasonDetail = r.reason_detail != null ? String(r.reason_detail) : '';
            return {
              username: String(r.username),
              ok: !!(r.ok === 1 || r.ok === true),
              reason_key: reasonKey,
              reason_label: userLoginReasonLabel(r.reason),
              reason_detail: reasonDetail,
              reason_display: userLoginReasonDisplayLabel(reasonKey, reasonDetail),
              ip: r.ip != null ? String(r.ip) : '',
              city: r.city != null ? String(r.city) : '',
              user_agent: r.user_agent != null ? String(r.user_agent) : '',
              created_at: r.created_at ? r.created_at.toISOString() : ''
            };
          }),
          total: total,
          page: page,
          limit: limit,
          total_pages: totalPages
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 登录日志 */
async function handleAdminLoginLogs(req, res) {
  try {
    var page = parseInt(req.query.page, 10);
    if (!isFinite(page) || page < 1) page = 1;
    var limit = parseInt(req.query.limit, 10);
    if (!isFinite(limit) || limit < 1) limit = 20;
    if (limit > 100) limit = 100;
    var qUsername = sanitizeAuditText(req.query.username || '', 255);
    var qOk = req.query.ok != null ? String(req.query.ok).trim() : '';

    var where = [];
    var params = [];
    if (!req.admin || !req.admin.is_super) {
      where.push('admin_username = ?');
      params.push(req.admin.username);
    } else if (qUsername) {
      where.push('admin_username LIKE ?');
      params.push('%' + qUsername + '%');
    }
    if (qOk === '1' || qOk === '0') {
      where.push('ok = ?');
      params.push(qOk === '1' ? 1 : 0);
    }
    var whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const conn = await pool.getConnection();
    try {
      const [cntRows] = await conn.execute('SELECT COUNT(*) AS c FROM admin_login_events' + whereSql, params);
      var total = cntRows.length ? Number(cntRows[0].c) : 0;
      var totalPages = Math.ceil(total / limit);
      if (total > 0 && totalPages < 1) totalPages = 1;
      if (totalPages > 0 && page > totalPages) page = totalPages;
      var offset = Math.max(0, ((page - 1) * limit) | 0);
      const [rows] = await conn.query(
        'SELECT admin_username, ok, reason, ip, city, user_agent, device_desc, created_at FROM admin_login_events' +
          whereSql +
          ' ORDER BY id DESC LIMIT ' +
          (limit | 0) +
          ' OFFSET ' +
          offset,
        params
      );
      return res.json({
        code: 200,
        data: {
          items: rows.map(function (r) {
            return {
              admin_username: r.admin_username != null ? String(r.admin_username) : '',
              ok: r.ok === 1 || r.ok === true,
              reason: r.reason != null ? String(r.reason) : '',
              ip: r.ip != null ? String(r.ip) : '',
              city: r.city != null ? String(r.city) : '',
              user_agent: r.user_agent != null ? String(r.user_agent) : '',
              device_desc: r.device_desc != null ? String(r.device_desc) : '',
              created_at: r.created_at ? r.created_at.toISOString() : ''
            };
          }),
          total: total,
          page: page,
          limit: limit,
          total_pages: totalPages
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/** 操作日志 */
async function handleAdminOperationLogs(req, res) {
  try {
    var page = parseInt(req.query.page, 10);
    if (!isFinite(page) || page < 1) page = 1;
    var limit = parseInt(req.query.limit, 10);
    if (!isFinite(limit) || limit < 1) limit = 20;
    if (limit > 100) limit = 100;
    var qUsername = sanitizeAuditText(req.query.username || '', 255);
    var qOk = req.query.ok != null ? String(req.query.ok).trim() : '';
    var qPath = sanitizeAuditText(req.query.path || '', 255);

    var where = [];
    var params = [];
    if (!req.admin || !req.admin.is_super) {
      where.push('admin_username = ?');
      params.push(req.admin.username);
    } else if (qUsername) {
      where.push('admin_username LIKE ?');
      params.push('%' + qUsername + '%');
    }
    if (qOk === '1' || qOk === '0') {
      where.push('ok = ?');
      params.push(qOk === '1' ? 1 : 0);
    }
    if (qPath) {
      where.push('path LIKE ?');
      params.push('%' + qPath + '%');
    }
    var whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
    const conn = await pool.getConnection();
    try {
      const [cntRows] = await conn.execute('SELECT COUNT(*) AS c FROM admin_operation_logs' + whereSql, params);
      var total = cntRows.length ? Number(cntRows[0].c) : 0;
      var totalPages = Math.ceil(total / limit);
      if (total > 0 && totalPages < 1) totalPages = 1;
      if (totalPages > 0 && page > totalPages) page = totalPages;
      var offset = Math.max(0, ((page - 1) * limit) | 0);
      const [rows] = await conn.query(
        'SELECT admin_username, admin_full_name, method, path, action, target_username, request_brief, ip, city, device_desc, status_code, biz_result_code, ok, created_at ' +
          'FROM admin_operation_logs' +
          whereSql +
          ' ORDER BY id DESC LIMIT ' +
          (limit | 0) +
          ' OFFSET ' +
          offset,
        params
      );
      return res.json({
        code: 200,
        data: {
          items: rows.map(function (r) {
            return {
              admin_username: r.admin_username != null ? String(r.admin_username) : '',
              admin_full_name: r.admin_full_name != null ? String(r.admin_full_name) : '',
              method: r.method != null ? String(r.method) : '',
              path: r.path != null ? String(r.path) : '',
              action: r.action != null ? String(r.action) : '',
              target_username: r.target_username != null ? String(r.target_username) : '',
              request_brief: r.request_brief != null ? String(r.request_brief) : '',
              ip: r.ip != null ? String(r.ip) : '',
              city: r.city != null ? String(r.city) : '',
              device_desc: r.device_desc != null ? String(r.device_desc) : '',
              status_code: r.status_code != null ? Number(r.status_code) : 0,
              biz_result_code: r.biz_result_code != null ? Number(r.biz_result_code) : null,
              ok: r.ok === 1 || r.ok === true,
              created_at: r.created_at ? r.created_at.toISOString() : ''
            };
          }),
          total: total,
          page: page,
          limit: limit,
          total_pages: totalPages
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/* routes: admin/growth/payments/platform → domain modules */

async function handleAdminMonitorOverview(req, res) {
  try {
    res.json({ code: 200, data: serverMonitor.getMonitorOverview() });
  } catch (e) {
    res.status(500).json({ code: 500, msg: String(e && e.message ? e.message : e) });
  }
}

/** 开关 API 自动修复 */
async function handleAdminMonitorAutoHeal(req, res) {
  try {
    var body = req.body && typeof req.body === 'object' ? req.body : {};
    if (body.enabled == null) {
      return res.json({
        code: 200,
        data: { enabled: serverMonitor.isAutoHealEnabled() }
      });
    }
    var on = body.enabled === true || body.enabled === 1 || body.enabled === '1';
    var enabled = serverMonitor.setAutoHealEnabled(on);
    res.json({ code: 200, msg: enabled ? '已开启自动修复' : '已关闭自动修复', data: { enabled: enabled } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: String(e && e.message ? e.message : e) });
  }
}

/** 立即跑一轮监控 + 接口自测 */
async function handleAdminMonitorRunTick(req, res) {
  try {
    await serverMonitor.runMonitorTick();
    res.json({ code: 200, data: serverMonitor.getMonitorOverview() });
  } catch (e) {
    res.status(500).json({ code: 500, msg: String(e && e.message ? e.message : e) });
  }
}

/** 监控测试邮件 */
async function handleAdminMonitorTestEmail(req, res) {
  try {
    var result = await serverMonitor.sendTestAlertEmail();
    res.json({ code: 200, msg: '测试邮件已发送', data: result });
  } catch (e) {
    res.status(400).json({ code: 400, msg: String(e && e.message ? e.message : e) });
  }
}

/** 手动补发运营日报（昨日） */
async function handleAdminOpsStatsSendEmail(req, res) {
  try {
    var result = await opsStatsReport.runOpsStatsReport(pool, { force: true, kinds: ['daily'] });
    res.json({
      code: 200,
      msg: '运营日报已发送' + (result && result.to ? '（' + result.to + '）' : ''),
      data: result
    });
  } catch (e) {
    res.status(400).json({ code: 400, msg: String(e && e.message ? e.message : e) });
  }
}

/** 健康检查 */
function healthHandler(req, res) {
  res.json({ ok: true });
}

const DB_LOG_PURGE_INTERVAL_MS = parseInt(process.env.DB_LOG_PURGE_INTERVAL_MS || String(24 * 60 * 60 * 1000), 10);
var _dbLogPurgeRunning = false;

/** 调度日志清理任务 */
function scheduleDbLogRetention() {
  var run = function (reason) {
    if (_dbLogPurgeRunning || !pool) return;
    _dbLogPurgeRunning = true;
    dbLogRetention
      .purgeOldDbLogs(pool)
      .then(function (summary) {
        if (summary.deleted_total > 0) {
          console.log(
            '[db-log-retention] ' +
              reason +
              ' deleted=' +
              summary.deleted_total +
              ' retain_days=' +
              summary.retain_days
          );
        }
      })
      .catch(function (e) {
        console.error('[db-log-retention] failed', e);
      })
      .finally(function () {
        _dbLogPurgeRunning = false;
      });
  };
  setTimeout(function () {
    run('startup');
  }, 5 * 60 * 1000);
  setInterval(function () {
    run('interval');
  }, Math.max(60 * 60 * 1000, DB_LOG_PURGE_INTERVAL_MS));
}

/** 输出安全基线警告 */
function logSecurityBaselineWarnings() {
  var warns = [];
  if (JWT_SECRET === 'dev-jwt-secret-change-in-production') {
    warns.push('JWT_SECRET 仍为代码默认值，生产环境必须通过环境变量覆盖');
  }
  if (String(ADMIN_PANEL_PASSWORD || '') === '640810') {
    warns.push('ADMIN_PANEL_PASSWORD 仍为代码默认口令，请立即修改');
  }
  if (plainPasswordStore.isPlainPasswordStoreEnabled()) {
    warns.push(
      'REGISTER_STORE_PLAIN_PASSWORD=' +
        plainPasswordStore.plainPasswordMode() +
        '：注册/改密会写入 users.plain_password（生产建议 0）'
    );
  }
  try {
    warns.push('rate_limit_backend=' + rateLimitBackendLabel());
  } catch (eRl) {}
  for (var i = 0; i < warns.length; i++) {
    console.warn('[security-baseline] ' + warns[i]);
  }
}

/** 创建 Express 应用 */
function createApp() {
  return app;
}

/**
 * 导出鉴权、激活校验、管理权限与限流等中间件。
 * 由 src 下各域 routes.js 在注册路由时挂载。
 */
function getMiddleware() {
  return {
    requireAuth,
    requireActivated,
    requireAuthAndActivatedUnlessAllowed,
    requireAdminAuth,
    requireAdminMenu,
    requireAdminAnyMenu,
    adminApiRateLimit,
    heavyAdminApiRateLimit,
    adminUpload,
    analyticsFinishMiddleware
  };
}

/**
 * 导出各域 HTTP 处理函数（用户/税务/支付/管理/公开配置等）。
 * 路由路径见 src/{auth,user,tax,payments,admin,growth,platform}/routes.js。
 */
function getHandlers() {
  return {
    handleTaxVerifyIssueGet,
    handleTaxGet,
    handleTaxPost,
    handleShenbaoJiluGet,
    handleShenbaoJiluPost,
    handleUserGet,
    handleUserPost,
    handleMessageGet,
    handleMessagePost,
    handleAuthGet,
    routeAuthPost,
    handleAlipayConfig,
    handleAlipayCreateOrder,
    handleAlipayLatestOrder,
    handleAlipayNotify,
    handlePriceBidGet,
    handlePriceBidSubmit,
    handleBilibiliShareStatus,
    handleBilibiliShareStart,
    handleBilibiliShareComplete,
    handlePublicMineUi,
    handlePublicInstallPackages,
    handlePublicAssetGet,
    handlePublicResolveSalesChannel,
    handlePublicSalesChannelAttribution,
    handlePublicConversionConfig,
    handlePublicLandingAbConfig,
    handlePublicGuestSession,
    handleAdminLogin,
    handleAdminMe,
    handleAdminSettingsGet,
    handleAdminUploadAsset,
    handleAdminSettingsPost,
    handleAdminDeletedUsers,
    handleAdminUsers,
    handleAdminRenameTaxDaily,
    handleAdminUserDataList,
    handleAdminUserDataDetail,
    handleAdminUsersDailyConversion,
    handleAdminD1ReturnCohort,
    handleAdminHighIncomeInactive,
    handleAdminChannelRegistrationFunnel,
    handleAdminActivationChannelFunnel,
    handleAdminAnalyticsPurchaseEvents,
    handleAdminAnalyticsPurchaseEventUsers,
    handleAdminInstallGuideStats,
    handleAdminAbcInstallStats,
    handleAdminInstallTrackStats,
    handleAdminPageLoadPerfStats,
    handleAdminAnalyticsOverview,
    handleAdminAnalyticsDauUsers,
    handleAdminMessagesBulk,
    handleAdminEmailsBulk,
    handleAdminEmailsUsers,
    handleAdminEmailsSends,
    handleAdminEmailsCampaignStats,
    handleAdminEmailsSend,
    handleAdminEmailsClear,
    handleAdminRegisterTimeDistribution,
    handleAdminRegisterChannelStats,
    handleAdminUserTaxRecords,
    handleAdminUserTaxRecordsWrite,
    handleAdminIssueCode,
    handleAdminDeleteUnusedCodes,
    handleAdminActivationBatchChannels,
    handleAdminAgentChannelsList,
    handleAdminAgentChannelsUpsert,
    handleAdminAgentChannelsDelete,
    handleAdminCodes,
    handleAdminUserActivate,
    handleAdminUserMakePermanent,
    handleAdminUserPriceOfferGet,
    handleAdminUserPriceOfferSet,
    handleAdminUserPriceOfferClear,
    handleAdminPriceBidsList,
    handleAdminPriceBidsReview,
    handleAdminPriceBidsConfigSet,
    handleAdminUserRenameFeeExempt,
    handleAdminUserAgentFlag,
    handleAdminUserLizhiCertUnlock,
    handleAdminUserZaizhiCertUnlock,
    handleAdminUserPassword,
    handleAdminBan,
    handleAdminBlockIp,
    handleAdminUnblockIp,
    handleAdminBlockedIpsList,
    handleAdminDeleteUser,
    handleAdminUserRefund,
    handleAdminUserRestore,
    handleAdminUserHardDelete,
    handleAdminPurgeBotUsers,
    handleAdminAnalyticsEvents,
    handleAdminAnalyticsActivateEvents,
    handleAdminAnalyticsActivateEventUsers,
    handleAdminAnalyticsEventsClear,
    handleAdminAnalyticsLoginRecent,
    handleAdminAnalyticsPricingAb,
    handleAdminLoginLogs,
    handleAdminOperationLogs,
    handleAdminAccountsList,
    handleAdminAccountActivatedUsers,
    handleAdminAccountsCreate,
    handleAdminAccountsUpdate,
    handleAdminAccountsDelete,
    handleAdminMonitorOverview,
    handleAdminMonitorAutoHeal,
    handleAdminMonitorRunTick,
    handleAdminMonitorTestEmail,
    handleAdminOpsStatsSendEmail,
    healthHandler
  };
}

/** 初始化并启动 HTTP 服务 */
async function startServer() {
  logSecurityBaselineWarnings();
  if (UPLOAD_STORAGE_BACKEND && UPLOAD_STORAGE_BACKEND !== 'local') {
    console.warn(
      '[uploads] UPLOAD_STORAGE_BACKEND=' +
        UPLOAD_STORAGE_BACKEND +
        '（当前写入仍为本地 UPLOAD_DIR；对象存储写入未启用）'
    );
  }
  if (PUBLIC_ASSET_BASE_URL) {
    console.log('[uploads] PUBLIC_ASSET_BASE_URL=' + PUBLIC_ASSET_BASE_URL);
  }
  await initDatabase();
  try {
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (e) {
    console.error('UPLOAD_DIR mkdir', UPLOAD_DIR, e);
  }
  serverMonitor.initServerMonitor({ pool: pool, uploadDir: UPLOAD_DIR });
  scheduleDbLogRetention();
  scheduleActivationInboxPromo();
  scheduleRefundAdPromo();
  opsStatsReport.scheduleOpsStatsReport(function () {
    return pool;
  });
  unusedActivationCodes.scheduleUnusedCodesPurge(function () {
    return pool;
  });
  app.listen(PORT, '0.0.0.0', function () {
    console.log('api listening on ' + PORT + ', database: ' + DB_DATABASE);
    serverMonitor.startServerMonitor();
  });
}

module.exports = {
  createApp,
  startServer,
  getHandlers,
  getMiddleware,
  initDatabase,
  adminCanAccessTargetUser,
  getPool: function () {
    return pool;
  }
};
