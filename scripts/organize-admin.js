#!/usr/bin/env node
/**
 * 整理管理后台：从 server.js 提取 admin 模块，拆分 admin_panel.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SERVER_PATH = path.join(ROOT, 'backend/server.js');
const ADMIN_DIR = path.join(ROOT, 'backend/admin');
const FE_ADMIN_DIR = path.join(ROOT, 'frontend/public/js/admin');

function readLines(p) {
  return fs.readFileSync(p, 'utf8').split('\n');
}

function write(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function dedent8(text) {
  return text
    .split('\n')
    .map(function (line) {
      return line.startsWith('        ') ? line.slice(8) : line;
    })
    .join('\n');
}

// ─── Backend extraction ───────────────────────────────────────────────

function extractBackend() {
  const lines = readLines(SERVER_PATH);

  write(
    path.join(ADMIN_DIR, 'constants.js'),
    `'use strict';

/** 管理后台菜单权限键（与前端 nav data-page 对应） */
const ADMIN_MENU_KEYS = [
  'settings',
  'install-guide',
  'appearance',
  'codes',
  'users',
  'user-data',
  'user-behavior',
  'feedback',
  'login-log',
  'user-login-log',
  'analytics',
  'channel-analysis',
  'api-analytics',
  'admin-accounts',
  'server-monitor'
];

module.exports = { ADMIN_MENU_KEYS };
`
  );

  const helpersSrc = lines.slice(269, 286).join('\n') + '\n\n' + lines.slice(2367, 2401).join('\n');
  write(
    path.join(ADMIN_DIR, 'helpers.js'),
    `'use strict';

const { ADMIN_MENU_KEYS } = require('./constants');

/** 模块级依赖，由 initAdminHelpers(deps) 注入 */
var _deps = {};

function initAdminHelpers(deps) {
  _deps = deps;
}

${helpersSrc.replace(/^function normalizeAdminMenuList/, 'function normalizeAdminMenuList').replace(
      /^function signAdminToken/,
      'function signAdminToken'
    )}

module.exports = {
  initAdminHelpers,
  normalizeAdminMenuList,
  signAdminToken,
  loadAdminAccountByUsername
};
`
  );

  write(
    path.join(ADMIN_DIR, 'audit.js'),
    `'use strict';

var pool, getClientIp, cityLabelFromIp, sanitizeAuditText;
var normalizeUserAgentHeader, computeDeviceFingerprint, displayUserAgentFromDevice, classifyAnalyticsRoute;

function initAdminAudit(deps) {
  pool = deps.pool;
  getClientIp = deps.getClientIp;
  cityLabelFromIp = deps.cityLabelFromIp;
  sanitizeAuditText = deps.sanitizeAuditText;
  normalizeUserAgentHeader = deps.normalizeUserAgentHeader;
  computeDeviceFingerprint = deps.computeDeviceFingerprint;
  displayUserAgentFromDevice = deps.displayUserAgentFromDevice;
  classifyAnalyticsRoute = deps.classifyAnalyticsRoute;
}

${lines.slice(4417, 4540).join('\n')}

module.exports = {
  initAdminAudit,
  recordAdminLoginAttempt,
  recordAdminOperationLog
};
`
  );

  write(
    path.join(ADMIN_DIR, 'middleware.js'),
    `'use strict';

var pool;
var jwt;
var JWT_SECRET;
var loadAdminAccountByUsername;
var recordAdminOperationLog;

function initAdminMiddleware(deps) {
  pool = deps.pool;
  jwt = deps.jwt;
  JWT_SECRET = deps.JWT_SECRET;
  loadAdminAccountByUsername = deps.loadAdminAccountByUsername;
  recordAdminOperationLog = deps.recordAdminOperationLog;
}

${lines.slice(2402, 2503).join('\n')}

module.exports = {
  initAdminMiddleware,
  adminHasMenu,
  requireAdminMenu,
  requireAdminAnyMenu,
  adminCanAccessTargetUser,
  requireAdminAuth
};
`
  );

  write(
    path.join(ADMIN_DIR, 'upload.js'),
    `'use strict';

const crypto = require('crypto');
const path = require('path');
const multer = require('multer');

var UPLOAD_DIR;

function initAdminUpload(deps) {
  UPLOAD_DIR = deps.UPLOAD_DIR;
}

${lines.slice(599, 633).join('\n')}

module.exports = {
  initAdminUpload,
  adminUpload,
  handleAdminUploadAsset
};
`
  );

  const handlerBlock = [
    ...lines.slice(5672, 10864),
    ...lines.slice(11032, 11048)
  ].join('\n');

  const handlerNames = [];
  const re = /async function (handleAdmin\w+)/g;
  let m;
  while ((m = re.exec(handlerBlock))) {
    handlerNames.push(m[1]);
  }

  write(
    path.join(ADMIN_DIR, 'handlers.js'),
    `'use strict';

/**
 * 管理后台 API 处理器
 * 依赖由 initAdminHandlers(deps) 注入到模块作用域
 */
var pool, jwt, JWT_SECRET, crypto, ADMIN_MENU_KEYS, ADMIN_PANEL_USER, ADMIN_PANEL_PASSWORD;
var verifyPasswordBySaltHash, hashPasswordWithSalt, getClientIp, cityLabelFromIp, sanitizeAuditText;
var normalizeUserAgentHeader, computeDeviceFingerprint, displayUserAgentFromDevice, classifyAnalyticsRoute;
var signAdminToken, loadAdminAccountByUsername, normalizeAdminMenuList, recordAdminLoginAttempt;
var adminCanAccessTargetUser, resolveDeviceCityLabel, resolvePublicAssetUrl;
var cloneMineUiDefaults, getMineUiForAdminForm, getMineUiForApi, loadMineUiParsed, sanitizeMineUiImageRef;
var isDeprecatedMessageHeaderRef, getInstallPackageSettingsFromDb, sanitizeInstallDownloadUrl;
var getWechatPayQrcodeUrl, invalidateWechatPayQrcodeCache, sanitizeXianyuPurchaseText;
var USER_TYPE_NORMAL, USER_TYPE_TEST, isXianyuActivationNote, activationSourceChannelLabel;
var registerSourceChannelLabel, userChannelAnalysisLabel, userLoginReasonLabel;
var formatUserIdCardForAdmin, userIdCardLabelForAdmin, maskBankCardNo;
var buildUserTaxAvgSalaryMap, computeTaxRecordsAvgSalary6m, loadTaxRecordChangesForUser;
var mergeUserRiskInfo, parseSalaryRangeFilterParam, userMatchesSalaryRange;
var countBotPurgeCandidates, purgeBotUsersBatch, normalizeTrackEventKeyFromRoute;

function initAdminHandlers(deps) {
  pool = deps.pool;
  jwt = deps.jwt;
  JWT_SECRET = deps.JWT_SECRET;
  crypto = deps.crypto;
  ADMIN_MENU_KEYS = deps.ADMIN_MENU_KEYS;
  ADMIN_PANEL_USER = deps.ADMIN_PANEL_USER;
  ADMIN_PANEL_PASSWORD = deps.ADMIN_PANEL_PASSWORD;
  verifyPasswordBySaltHash = deps.verifyPasswordBySaltHash;
  hashPasswordWithSalt = deps.hashPasswordWithSalt;
  getClientIp = deps.getClientIp;
  cityLabelFromIp = deps.cityLabelFromIp;
  sanitizeAuditText = deps.sanitizeAuditText;
  normalizeUserAgentHeader = deps.normalizeUserAgentHeader;
  computeDeviceFingerprint = deps.computeDeviceFingerprint;
  displayUserAgentFromDevice = deps.displayUserAgentFromDevice;
  classifyAnalyticsRoute = deps.classifyAnalyticsRoute;
  signAdminToken = deps.signAdminToken;
  loadAdminAccountByUsername = deps.loadAdminAccountByUsername;
  normalizeAdminMenuList = deps.normalizeAdminMenuList;
  recordAdminLoginAttempt = deps.recordAdminLoginAttempt;
  adminCanAccessTargetUser = deps.adminCanAccessTargetUser;
  resolveDeviceCityLabel = deps.resolveDeviceCityLabel;
  resolvePublicAssetUrl = deps.resolvePublicAssetUrl;
  cloneMineUiDefaults = deps.cloneMineUiDefaults;
  getMineUiForAdminForm = deps.getMineUiForAdminForm;
  getMineUiForApi = deps.getMineUiForApi;
  loadMineUiParsed = deps.loadMineUiParsed;
  sanitizeMineUiImageRef = deps.sanitizeMineUiImageRef;
  isDeprecatedMessageHeaderRef = deps.isDeprecatedMessageHeaderRef;
  getInstallPackageSettingsFromDb = deps.getInstallPackageSettingsFromDb;
  sanitizeInstallDownloadUrl = deps.sanitizeInstallDownloadUrl;
  getWechatPayQrcodeUrl = deps.getWechatPayQrcodeUrl;
  invalidateWechatPayQrcodeCache = deps.invalidateWechatPayQrcodeCache;
  sanitizeXianyuPurchaseText = deps.sanitizeXianyuPurchaseText;
  USER_TYPE_NORMAL = deps.USER_TYPE_NORMAL;
  USER_TYPE_TEST = deps.USER_TYPE_TEST;
  isXianyuActivationNote = deps.isXianyuActivationNote;
  activationSourceChannelLabel = deps.activationSourceChannelLabel;
  registerSourceChannelLabel = deps.registerSourceChannelLabel;
  userChannelAnalysisLabel = deps.userChannelAnalysisLabel;
  userLoginReasonLabel = deps.userLoginReasonLabel;
  formatUserIdCardForAdmin = deps.formatUserIdCardForAdmin;
  userIdCardLabelForAdmin = deps.userIdCardLabelForAdmin;
  maskBankCardNo = deps.maskBankCardNo;
  buildUserTaxAvgSalaryMap = deps.buildUserTaxAvgSalaryMap;
  computeTaxRecordsAvgSalary6m = deps.computeTaxRecordsAvgSalary6m;
  loadTaxRecordChangesForUser = deps.loadTaxRecordChangesForUser;
  mergeUserRiskInfo = deps.mergeUserRiskInfo;
  parseSalaryRangeFilterParam = deps.parseSalaryRangeFilterParam;
  userMatchesSalaryRange = deps.userMatchesSalaryRange;
  countBotPurgeCandidates = deps.countBotPurgeCandidates;
  purgeBotUsersBatch = deps.purgeBotUsersBatch;
  normalizeTrackEventKeyFromRoute = deps.normalizeTrackEventKeyFromRoute;
}

${handlerBlock}

module.exports = { initAdminHandlers, ${handlerNames.join(', ')} };
`
  );

  // routes.js — admin routes only（public 路由保留在 server.js）
  const adminRouteLines = [
    ...lines.slice(10865, 10883),
    ...lines.slice(10886, 11031),
    ...lines.slice(11049, 11051)
  ];
  const routesBlock = adminRouteLines.join('\n');
  write(
    path.join(ADMIN_DIR, 'routes.js'),
    `'use strict';

const serverMonitor = require('../serverMonitor');
const handlers = require('./handlers');
const middleware = require('./middleware');
const upload = require('./upload');

function registerAdminRoutes(app) {
  const {
    handleAdminLogin,
    handleAdminMe,
    handleAdminSettingsGet,
    handleAdminSettingsPost,
    handleAdminUsers,
    handleAdminUserDataList,
    handleAdminUserDataAnalytics,
    handleAdminUserDataSalaryHighCharts,
    handleAdminUserDataDetail,
    handleAdminUsersDailyConversion,
    handleAdminRegistrationFunnel,
    handleAdminChannelRegistrationFunnel,
    handleAdminInstallTrackStats,
    handleAdminConversionKpis,
    handleAdminUsersPendingActivate24h,
    handleAdminRegisterTimeDistribution,
    handleAdminRegisterGenderStats,
    handleAdminRegisterChannelStats,
    handleAdminFemaleAgeStats,
    handleAdminUserDataNoTaxBehavior,
    handleAdminUserDataNoTaxBehaviorPath,
    handleAdminUserDataNoTaxBehaviorExport,
    handleAdminUserTaxRecords,
    handleAdminIssueCode,
    handleAdminIssueCodeBatch,
    handleAdminCodes,
    handleAdminBan,
    handleAdminDeleteUser,
    handleAdminPurgeBotUsers,
    handleAdminAnalyticsOverview,
    handleAdminAnalyticsDauUsers,
    handleAdminAnalyticsApi,
    handleAdminAnalyticsEvents,
    handleAdminAnalyticsActivateEvents,
    handleAdminAnalyticsActivateEventUsers,
    handleAdminAnalyticsEventsClear,
    handleAdminAnalyticsDevices,
    handleAdminAnalyticsDeviceStats,
    handleAdminAnalyticsLoginRecent,
    handleAdminLoginLogs,
    handleAdminOperationLogs,
    handleAdminFeedbackList,
    handleAdminFeedbackReply,
    handleAdminAccountsList,
    handleAdminAccountActivatedUsers,
    handleAdminAccountsCreate,
    handleAdminAccountsUpdate,
    handleAdminAccountsDelete
  } = handlers;

  const { requireAdminAuth, requireAdminMenu, requireAdminAnyMenu } = middleware;
  const { adminUpload, handleAdminUploadAsset } = upload;

${routesBlock.replace(/handleAdminMonitorOverview/g, 'handleAdminMonitorOverviewLocal').replace(/handleAdminMonitorTestEmail/g, 'handleAdminMonitorTestEmailLocal')}

  async function handleAdminMonitorOverviewLocal(req, res) {
    try {
      res.json({ code: 200, data: serverMonitor.getMonitorOverview() });
    } catch (e) {
      res.status(500).json({ code: 500, msg: String(e && e.message ? e.message : e) });
    }
  }

  async function handleAdminMonitorTestEmailLocal(req, res) {
    try {
      var result = await serverMonitor.sendTestAlertEmail();
      res.json({ code: 200, msg: '测试邮件已发送', data: result });
    } catch (e) {
      res.status(400).json({ code: 400, msg: String(e && e.message ? e.message : e) });
    }
  }
}

module.exports = { registerAdminRoutes };
`
  );

  write(
    path.join(ADMIN_DIR, 'index.js'),
    `'use strict';

const { ADMIN_MENU_KEYS } = require('./constants');
const helpers = require('./helpers');
const audit = require('./audit');
const middleware = require('./middleware');
const upload = require('./upload');
const handlers = require('./handlers');
const { registerAdminRoutes } = require('./routes');

/**
 * 初始化管理后台模块并注册 Express 路由
 * @param {import('express').Application} app
 * @param {object} deps - server.js 共享依赖
 */
function setupAdmin(app, deps) {
  const fullDeps = Object.assign({}, deps, { ADMIN_MENU_KEYS: ADMIN_MENU_KEYS });

  helpers.initAdminHelpers(fullDeps);
  audit.initAdminAudit(fullDeps);
  middleware.initAdminMiddleware(
    Object.assign({}, fullDeps, {
      loadAdminAccountByUsername: helpers.loadAdminAccountByUsername,
      recordAdminOperationLog: audit.recordAdminOperationLog
    })
  );
  upload.initAdminUpload(fullDeps);
  handlers.initAdminHandlers(
    Object.assign({}, fullDeps, {
      signAdminToken: helpers.signAdminToken,
      loadAdminAccountByUsername: helpers.loadAdminAccountByUsername,
      normalizeAdminMenuList: helpers.normalizeAdminMenuList,
      recordAdminLoginAttempt: audit.recordAdminLoginAttempt,
      adminCanAccessTargetUser: middleware.adminCanAccessTargetUser
    })
  );

  registerAdminRoutes(app);

  return {
    ADMIN_MENU_KEYS,
    normalizeAdminMenuList: helpers.normalizeAdminMenuList,
    signAdminToken: helpers.signAdminToken,
    loadAdminAccountByUsername: helpers.loadAdminAccountByUsername,
    recordAdminLoginAttempt: audit.recordAdminLoginAttempt,
    recordAdminOperationLog: audit.recordAdminOperationLog,
    requireAdminAuth: middleware.requireAdminAuth,
    adminCanAccessTargetUser: middleware.adminCanAccessTargetUser
  };
}

module.exports = { setupAdmin, ADMIN_MENU_KEYS };
`
  );

  // Patch server.js - remove extracted sections
  const removeRanges = [
    [11049, 11051], // admin monitor routes (handlers moved to routes.js)
    [11033, 11048], // monitor handler fns
    [10865, 11031], // admin routes (+ public routes 10884-10886 restored below)
    [5673, 10864], // admin handlers
    [4418, 4540], // admin audit
    [2368, 2503], // admin auth helpers + middleware
    [600, 633], // admin upload
    [270, 286], // normalizeAdminMenuList
    [221, 236] // ADMIN_MENU_KEYS
  ].sort(function (a, b) {
    return b[0] - a[0];
  });

  let newLines = lines.slice();
  for (const [start, end] of removeRanges) {
    newLines.splice(start - 1, end - start + 1);
  }

  // 恢复 public 路由（原嵌在 admin 路由块中）
  const startIdx2 = newLines.findIndex(function (l) {
    return l.startsWith('async function startServer');
  });
  if (startIdx2 >= 0) {
    newLines.splice(startIdx2, 0,
      "app.get('/api/public/mine-ui', handlePublicMineUi);",
      "app.get('/api/public/install-packages', handlePublicInstallPackages);",
      "app.get('/api/public/conversion-config', handlePublicConversionConfig);",
      ''
    );
  }

  // Insert require after serverMonitor require
  const smIdx = newLines.findIndex(function (l) {
    return l.includes("require('./serverMonitor')");
  });
  if (smIdx >= 0) {
    newLines.splice(
      smIdx + 1,
      0,
      "const { setupAdmin, ADMIN_MENU_KEYS } = require('./admin');"
    );
  }

  // Remove duplicate ADMIN_MENU_KEYS if we added require - we removed the const block

  // Find where to insert setupAdmin call - before startServer, after all route definitions
  // Since we removed routes, we need to add setupAdmin before startServer
  const startIdx = newLines.findIndex(function (l) {
    return l.startsWith('async function startServer');
  });
  if (startIdx >= 0) {
    const setupBlock = [
      '',
      'setupAdmin(app, {',
      '  pool,',
      '  jwt,',
      '  JWT_SECRET,',
      '  crypto,',
      '  ADMIN_PANEL_USER,',
      '  ADMIN_PANEL_PASSWORD,',
      '  verifyPasswordBySaltHash,',
      '  hashPasswordWithSalt,',
      '  getClientIp,',
      '  cityLabelFromIp,',
      '  sanitizeAuditText,',
      '  normalizeUserAgentHeader,',
      '  computeDeviceFingerprint,',
      '  displayUserAgentFromDevice,',
      '  classifyAnalyticsRoute,',
      '  resolveDeviceCityLabel,',
      '  resolvePublicAssetUrl,',
      '  cloneMineUiDefaults,',
      '  getMineUiForAdminForm,',
      '  getMineUiForApi,',
      '  loadMineUiParsed,',
      '  sanitizeMineUiImageRef,',
      '  isDeprecatedMessageHeaderRef,',
      '  getInstallPackageSettingsFromDb,',
      '  sanitizeInstallDownloadUrl,',
      '  getWechatPayQrcodeUrl,',
      '  invalidateWechatPayQrcodeCache,',
      '  sanitizeXianyuPurchaseText,',
      '  USER_TYPE_NORMAL,',
      '  USER_TYPE_TEST,',
      '  isXianyuActivationNote,',
      '  activationSourceChannelLabel,',
      '  registerSourceChannelLabel,',
      '  userChannelAnalysisLabel,',
      '  userLoginReasonLabel,',
      '  formatUserIdCardForAdmin,',
      '  userIdCardLabelForAdmin,',
      '  maskBankCardNo,',
      '  buildUserTaxAvgSalaryMap,',
      '  computeTaxRecordsAvgSalary6m,',
      '  loadTaxRecordChangesForUser,',
      '  mergeUserRiskInfo,',
      '  parseSalaryRangeFilterParam,',
      '  userMatchesSalaryRange,',
      '  countBotPurgeCandidates,',
      '  purgeBotUsersBatch,',
      '  normalizeTrackEventKeyFromRoute,',
      '  UPLOAD_DIR',
      '});',
      ''
    ];
    newLines.splice(startIdx, 0, ...setupBlock);
  }

  write(SERVER_PATH, newLines.join('\n'));
  console.log('Backend: extracted admin module, patched server.js');
}

// ─── Frontend split ───────────────────────────────────────────────────

function extractFrontend() {
  const lines = readLines(path.join(ROOT, 'frontend/public/js/admin_panel.js'));
  const content = dedent8(lines.join('\n'));

  const sections = [
    { file: 'core/utils.js', start: 0, end: 84, note: 'esc, statIconHtml' },
    { file: 'core/charts.js', start: 84, end: 1093, note: 'chart helpers' },
    { file: 'core/tax-display.js', start: 1093, end: 1695, note: 'tax record display' },
    { file: 'core/state.js', start: 1695, end: 1734, note: 'shared state vars' },
    { file: 'core/router.js', start: 1734, end: 1880, note: 'routing & menu' },
    { file: 'pages/feedback.js', start: 1880, end: 1998, note: 'feedback page' },
    { file: 'pages/api-analytics.js', start: 1998, end: 2337, note: 'api analytics' },
    { file: 'pages/analytics.js', start: 2337, end: 2574, note: 'analytics dashboard part1' },
    { file: 'pages/monitor.js', start: 2574, end: 2729, note: 'server monitor' },
    { file: 'pages/logs.js', start: 2729, end: 3021, note: 'login logs' },
    { file: 'pages/analytics-funnel.js', start: 3021, end: 3476, note: 'funnel & conversion' },
    { file: 'pages/user-data.js', start: 3476, end: 4429, note: 'user data' },
    { file: 'pages/users.js', start: 4429, end: 4614, note: 'users list' },
    { file: 'pages/codes.js', start: 4614, end: 4849, note: 'activation codes' },
    { file: 'pages/accounts.js', start: 4849, end: 5031, note: 'admin accounts' },
    { file: 'bootstrap.js', start: 5031, end: content.split('\n').length, note: 'event bindings & init' }
  ];

  const linesArr = content.split('\n');
  for (const sec of sections) {
    const chunk = linesArr.slice(sec.start, sec.end).join('\n').trim();
    if (!chunk) continue;
    write(
      path.join(FE_ADMIN_DIR, sec.file),
      '/* admin/' + sec.file + ' — ' + sec.note + ' */\n' + chunk + '\n'
    );
  }

  // Create loader that replaces admin_panel.js
  write(
    path.join(FE_ADMIN_DIR, 'manifest.js'),
    `/* 管理后台模块清单 — 按依赖顺序加载 */
`
  );

  const scriptOrder = sections.map(function (s) {
    return '    <script src="/js/admin/' + s.file + '?v=20260531"></script>';
  });

  // Update admin_panel.html
  const htmlPath = path.join(ROOT, 'frontend/admin_panel.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace(
    /<script src="\/js\/admin_panel\.js[^"]*"><\/script>/,
    scriptOrder.join('\n')
  );
  fs.writeFileSync(htmlPath, html);

  // Keep admin_panel.js as re-export stub for backward compat
  write(
    path.join(ROOT, 'frontend/public/js/admin_panel.js'),
    '/* 已拆分至 admin/ 目录，此文件保留兼容旧缓存 */\nconsole.warn("admin_panel.js 已迁移至 admin/ 模块，请更新 HTML 引用");\n'
  );

  console.log('Frontend: split into', sections.length, 'modules');
}

extractBackend();
extractFrontend();
console.log('Done.');
