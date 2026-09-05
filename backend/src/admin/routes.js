/**
 * 管理端 BFF 路由（/api/admin/*）
 */
function registerAdminRoutes(app, deps) {
  var h = deps.handlers;
  var mw = deps.middleware;

app.use('/api/admin/analytics', mw.heavyAdminApiRateLimit);
app.use('/api/admin/user-data', mw.heavyAdminApiRateLimit);
app.use('/api/admin', mw.adminApiRateLimit);

app.post('/api/admin/login', h.handleAdminLogin);
app.get('/api/admin/me', mw.requireAdminAuth, h.handleAdminMe);
app.get(
  '/api/admin/settings',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['settings', 'install-guide', 'appearance']),
  h.handleAdminSettingsGet
);
app.post(
  '/api/admin/upload-asset',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['install-guide', 'appearance', 'ops-ad-analytics']),
  function (req, res, next) {
    mw.adminUpload.single('file')(req, res, function (err) {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            code: 413,
            msg: '文件过大，管理上传上限约 ' + Math.round((Number(process.env.ADMIN_UPLOAD_MAX_BYTES) || 83886080) / 1024 / 1024) + 'MB'
          });
        }
        return res.status(400).json({ code: 400, msg: String(err.message || '上传失败') });
      }
      next();
    });
  },
  h.handleAdminUploadAsset
);
app.post(
  '/api/admin/settings',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['settings', 'install-guide', 'appearance']),
  h.handleAdminSettingsPost
);
function requireAdminUsersListMenu(req, res, next) {
  var peer = String((req.query && req.query.peer) || '').trim().toLowerCase();
  var isPeer = peer === '1' || peer === 'exempt';
  return mw.requireAdminAnyMenu(isPeer ? ['peer-accounts', 'rename-tax-daily'] : ['users'])(req, res, next);
}

app.get('/api/admin/users/deleted', mw.requireAdminAuth, mw.requireAdminMenu('users-deleted'), h.handleAdminDeletedUsers);
app.get(
  '/api/admin/rename-tax-daily',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['rename-tax-daily', 'peer-accounts']),
  h.handleAdminRenameTaxDaily
);
app.get('/api/admin/users', mw.requireAdminAuth, requireAdminUsersListMenu, h.handleAdminUsers);
app.get('/api/admin/user-data', mw.requireAdminAuth, mw.requireAdminMenu('user-data'), h.handleAdminUserDataList);
app.get(
  '/api/admin/user-data/detail',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['user-data', 'lizhi-cert', 'zaizhi-cert', 'ylbx-ps', 'ccb-flow', 'najilu-qr']),
  h.handleAdminUserDataDetail
);
app.get(
  '/api/admin/user-shebao-photos',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['user-data', 'users']),
  h.handleAdminShebaoPhotoList
);
app.get(
  '/api/admin/user-shebao-photos/:id/file',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['user-data', 'users']),
  h.handleAdminShebaoPhotoFile
);
app.get(
  '/api/admin/feedback',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['feedback', 'insights-product', 'analytics-devices', 'analytics']),
  h.handleAdminFeedbackList
);
app.get(
  '/api/admin/feedback/:id/image/:index',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['feedback', 'insights-product', 'analytics-devices', 'analytics']),
  h.handleAdminFeedbackImage
);
/* 工具页预填：独立路径，避免部分浏览器扩展把 /user-data/ 当成追踪接口拦截（表现为 Failed to fetch） */
app.get(
  '/api/admin/lizhi-cert/prefill',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['lizhi-cert', 'user-data']),
  h.handleAdminUserDataDetail
);
app.get(
  '/api/admin/ylbx-ps/prefill',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['ylbx-ps', 'user-data']),
  h.handleAdminUserDataDetail
);
app.get(
  '/api/admin/ccb-flow/prefill',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['ccb-flow', 'user-data']),
  h.handleAdminUserDataDetail
);
app.get(
  '/api/admin/najilu-qr/prefill',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['najilu-qr', 'user-data']),
  h.handleAdminUserDataDetail
);
app.get(
  '/api/admin/sbdy-demo/prefill',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['sbdy-demo', 'user-data']),
  h.handleAdminUserDataDetail
);
app.get(
  '/api/admin/gjj-demo/prefill',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['gjj-demo', 'user-data']),
  h.handleAdminUserDataDetail
);
app.get(
  '/api/admin/analytics/pricing-ab',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-conversion', 'analytics']),
  h.handleAdminAnalyticsPricingAb
);
app.get(
  '/api/admin/analytics/purchase-events',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-purchase', 'analytics', 'analytics-conversion']),
  h.handleAdminAnalyticsPurchaseEvents
);
app.get(
  '/api/admin/analytics/purchase-events/users',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-purchase', 'analytics', 'analytics-conversion']),
  h.handleAdminAnalyticsPurchaseEventUsers
);
app.get(
  '/api/admin/analytics/daily-conversion',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-conversion', 'analytics']),
  h.handleAdminUsersDailyConversion
);
app.get(
  '/api/admin/analytics/d1-return-cohort',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-conversion', 'analytics', 'users', 'ops-lift', 'ops-board']),
  h.handleAdminD1ReturnCohort
);
app.get(
  '/api/admin/analytics/high-income-inactive',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-conversion', 'analytics', 'users', 'ops-lift', 'ops-board']),
  h.handleAdminHighIncomeInactive
);
app.get(
  '/api/admin/ops/board',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['ops-board', 'ops-inactive', 'analytics-conversion', 'ops-lift', 'ops-research']),
  h.handleOpsBoard
);
app.get(
  '/api/admin/ops/board/payments',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['ops-board', 'ops-inactive', 'analytics-conversion', 'ops-lift', 'ops-research']),
  h.handleOpsBoardPayments
);
app.get(
  '/api/admin/ops/inactive-summary',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['ops-inactive', 'analytics-conversion', 'users', 'ops-board']),
  h.handleOpsInactiveSummary
);
app.get(
  '/api/admin/ops/inactive-users',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['ops-inactive', 'analytics-conversion', 'users', 'ops-board']),
  h.handleOpsInactiveUsers
);
app.get(
  '/api/admin/ops/conversion-research',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['ops-research', 'analytics-conversion', 'tax-fill-survey', 'ops-board']),
  h.handleOpsConversionResearch
);
app.get(
  '/api/admin/ops/refund-eligible',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['ops-ad-analytics', 'ops-lift', 'analytics-conversion', 'ops-board']),
  h.handleOpsRefundEligible
);
app.get(
  '/api/admin/analytics/channel-registration-funnel',
  mw.requireAdminAuth,
  mw.requireAdminMenu('channel-analysis'),
  h.handleAdminChannelRegistrationFunnel
);
app.get(
  '/api/admin/analytics/activation-channel-funnel',
  mw.requireAdminAuth,
  mw.requireAdminMenu('channel-analysis'),
  h.handleAdminActivationChannelFunnel
);
app.get(
  '/api/admin/analytics/install-guide-stats',
  mw.requireAdminAuth,
  mw.requireAdminMenu('install-guide-stats'),
  h.handleAdminInstallGuideStats
);
app.get(
  '/api/admin/analytics/abc-install-stats',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['install-guide-stats', 'insights-growth', 'channel-analysis']),
  h.handleAdminAbcInstallStats
);
app.get(
  '/api/admin/ad-pages',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['ops-ad-analytics', 'analytics-conversion']),
  h.handleAdminAdPagesGet
);
app.post(
  '/api/admin/ad-pages',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['ops-ad-analytics', 'analytics-conversion']),
  h.handleAdminAdPagesPost
);
app.get(
  '/api/admin/analytics/ad-page-stats',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['ops-ad-analytics', 'analytics-conversion']),
  h.handleAdminAdPageStats
);
app.get(
  '/api/admin/analytics/ad-page-stats/user',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['ops-ad-analytics', 'analytics-conversion']),
  h.handleAdminAdPageUserEvents
);
app.get(
  '/api/admin/analytics/page-load-perf',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics']),
  h.handleAdminPageLoadPerfStats
);
app.get(
  '/api/admin/analytics/install-track-stats',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics']),
  h.handleAdminInstallTrackStats
);
app.post(
  '/api/admin/messages/bulk',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-conversion', 'analytics', 'users', 'ops-lift', 'ops-ad-analytics', 'ops-board']),
  h.handleAdminMessagesBulk
);
app.post(
  '/api/admin/emails/bulk',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-conversion', 'analytics', 'users', 'ops-lift', 'ops-board', 'user-emails', 'ops-ad-analytics']),
  h.handleAdminEmailsBulk
);
app.get(
  '/api/admin/emails/users',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['user-emails', 'users', 'ops-board']),
  h.handleAdminEmailsUsers
);
app.get(
  '/api/admin/emails/sends',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['user-emails', 'users', 'ops-board', 'ops-ad-analytics']),
  h.handleAdminEmailsSends
);
app.get(
  '/api/admin/emails/campaign-stats',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['user-emails', 'users', 'ops-board', 'ops-ad-analytics']),
  h.handleAdminEmailsCampaignStats
);
app.get('/api/admin/emails/send', function (req, res) {
  res.set('Cache-Control', 'no-store');
  return res.status(405).json({ code: 405, msg: '请使用 POST 发送邮件' });
});
app.post(
  '/api/admin/emails/send',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['user-emails', 'users', 'ops-board']),
  h.handleAdminEmailsSend
);
app.post(
  '/api/admin/emails/clear',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['user-emails', 'users']),
  h.handleAdminEmailsClear
);
app.get(
  '/api/admin/analytics/register-time',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['install-guide-stats', 'analytics-register', 'analytics']),
  h.handleAdminRegisterTimeDistribution
);
app.get(
  '/api/admin/analytics/register-channels',
  mw.requireAdminAuth,
  mw.requireAdminMenu('channel-analysis'),
  h.handleAdminRegisterChannelStats
);
app.get(
  '/api/admin/analytics/devices',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-devices', 'analytics']),
  h.handleAdminAnalyticsDevices
);
app.get(
  '/api/admin/analytics/overview',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-activity', 'analytics']),
  h.handleAdminAnalyticsOverview
);
app.get(
  '/api/admin/analytics/dau-users',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-activity', 'analytics']),
  h.handleAdminAnalyticsDauUsers
);
app.get('/api/admin/user-tax-records', mw.requireAdminAuth, mw.requireAdminAnyMenu(['users', 'tax-records-edit']), h.handleAdminUserTaxRecords);
app.post(
  '/api/admin/user-tax-records',
  mw.requireAdminAuth,
  mw.requireAdminMenu('tax-records-edit'),
  h.handleAdminUserTaxRecordsWrite
);
app.post('/api/admin/issue-code', mw.requireAdminAuth, mw.requireAdminMenu('codes'), h.handleAdminIssueCode);
app.get(
  '/api/admin/activation-batch-channels',
  mw.requireAdminAuth,
  mw.requireAdminMenu('codes'),
  h.handleAdminActivationBatchChannels
);
app.get(
  '/api/admin/agent-channels',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['install-guide', 'settings', 'codes']),
  h.handleAdminAgentChannelsList
);
app.post(
  '/api/admin/agent-channels',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['install-guide', 'settings']),
  h.handleAdminAgentChannelsUpsert
);
app.delete(
  '/api/admin/agent-channels/:channelId',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['install-guide', 'settings']),
  h.handleAdminAgentChannelsDelete
);
app.get(
  '/api/admin/codes',
  mw.requireAdminAuth,
  mw.requireAdminMenu('codes'),
  h.handleAdminCodes
);
app.post(
  '/api/admin/codes/delete-unused',
  mw.requireAdminAuth,
  mw.requireAdminMenu('codes'),
  h.handleAdminDeleteUnusedCodes
);
app.post('/api/admin/user-activate', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUserActivate);
app.post(
  '/api/admin/user-make-permanent',
  mw.requireAdminAuth,
  mw.requireAdminMenu('users'),
  h.handleAdminUserMakePermanent
);
app.get(
  '/api/admin/user-price-offer',
  mw.requireAdminAuth,
  mw.requireAdminMenu('users'),
  h.handleAdminUserPriceOfferGet
);
app.post(
  '/api/admin/user-price-offer',
  mw.requireAdminAuth,
  mw.requireAdminMenu('users'),
  h.handleAdminUserPriceOfferSet
);
app.post(
  '/api/admin/user-price-offer/clear',
  mw.requireAdminAuth,
  mw.requireAdminMenu('users'),
  h.handleAdminUserPriceOfferClear
);
app.get(
  '/api/admin/price-bids',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['settings', 'users']),
  h.handleAdminPriceBidsList
);
app.post(
  '/api/admin/price-bids/review',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['settings', 'users']),
  h.handleAdminPriceBidsReview
);
app.post(
  '/api/admin/price-bids/config',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['settings', 'users']),
  h.handleAdminPriceBidsConfigSet
);
app.post(
  '/api/admin/user-rename-fee-exempt',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['users', 'peer-accounts', 'rename-tax-daily']),
  h.handleAdminUserRenameFeeExempt
);
app.post(
  '/api/admin/user-agent-flag',
  mw.requireAdminAuth,
  mw.requireAdminMenu('users'),
  h.handleAdminUserAgentFlag
);
app.post(
  '/api/admin/user-lizhi-cert-unlock',
  mw.requireAdminAuth,
  mw.requireAdminMenu('users'),
  h.handleAdminUserLizhiCertUnlock
);
app.post('/api/admin/user-password', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUserPassword);
app.post('/api/admin/ban', mw.requireAdminAuth, mw.requireAdminAnyMenu(['users', 'peer-accounts', 'rename-tax-daily']), h.handleAdminBan);
app.post(
  '/api/admin/block-ip',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['users', 'blocked-ips']),
  h.handleAdminBlockIp
);
app.post(
  '/api/admin/unblock-ip',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['users', 'blocked-ips']),
  h.handleAdminUnblockIp
);
app.get(
  '/api/admin/blocked-ips',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['users', 'blocked-ips']),
  h.handleAdminBlockedIpsList
);
app.post('/api/admin/user-delete', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminDeleteUser);
app.post('/api/admin/user-refund', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUserRefund);
app.post('/api/admin/user-restore', mw.requireAdminAuth, mw.requireAdminMenu('users-deleted'), h.handleAdminUserRestore);
app.post('/api/admin/user-hard-delete', mw.requireAdminAuth, mw.requireAdminMenu('users-deleted'), h.handleAdminUserHardDelete);
app.post('/api/admin/users/purge-bots', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminPurgeBotUsers);
app.get(
  '/api/admin/analytics/events',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics']),
  h.handleAdminAnalyticsEvents
);
app.get(
  '/api/admin/analytics/activate-events',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics']),
  h.handleAdminAnalyticsActivateEvents
);
app.get(
  '/api/admin/analytics/activate-events/users',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics']),
  h.handleAdminAnalyticsActivateEventUsers
);
app.post(
  '/api/admin/analytics/events/clear',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics']),
  h.handleAdminAnalyticsEventsClear
);
app.get('/api/admin/analytics/login-recent', mw.requireAdminAuth, mw.requireAdminMenu('user-login-log'), h.handleAdminAnalyticsLoginRecent);
app.get('/api/admin/admin-login-logs', mw.requireAdminAuth, mw.requireAdminMenu('login-log'), h.handleAdminLoginLogs);
app.get('/api/admin/admin-operation-logs', mw.requireAdminAuth, mw.requireAdminMenu('login-log'), h.handleAdminOperationLogs);
app.get(
  '/api/admin/accounts',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['admin-accounts', 'downline-admins']),
  h.handleAdminAccountsList
);
app.get(
  '/api/admin/accounts/activated-users',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['admin-accounts', 'downline-admins']),
  h.handleAdminAccountActivatedUsers
);
app.post(
  '/api/admin/accounts/create',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['admin-accounts', 'downline-admins']),
  h.handleAdminAccountsCreate
);
app.post(
  '/api/admin/accounts/update',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['admin-accounts', 'downline-admins']),
  h.handleAdminAccountsUpdate
);
app.post(
  '/api/admin/accounts/delete',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['admin-accounts', 'downline-admins']),
  h.handleAdminAccountsDelete
);
app.get('/api/admin/monitor/overview', mw.requireAdminAuth, mw.requireAdminMenu('server-monitor'), h.handleAdminMonitorOverview);
app.post('/api/admin/monitor/auto-heal', mw.requireAdminAuth, mw.requireAdminMenu('server-monitor'), h.handleAdminMonitorAutoHeal);
app.post('/api/admin/monitor/run', mw.requireAdminAuth, mw.requireAdminMenu('server-monitor'), h.handleAdminMonitorRunTick);
app.post('/api/admin/monitor/test-email', mw.requireAdminAuth, mw.requireAdminMenu('server-monitor'), h.handleAdminMonitorTestEmail);
app.post('/api/admin/ops-stats/send-email', mw.requireAdminAuth, mw.requireAdminMenu('server-monitor'), h.handleAdminOpsStatsSendEmail);
app.post(
  '/api/admin/sbdy-demo/generate',
  mw.requireAdminAuth,
  mw.requireAdminMenu('sbdy-demo'),
  h.handleAdminSbdyDemoGenerate
);
app.get(
  '/api/admin/sbdy-demo/list',
  mw.requireAdminAuth,
  mw.requireAdminMenu('sbdy-demo'),
  h.handleAdminSbdyDemoList
);
app.post(
  '/api/admin/sbdy-demo/delete',
  mw.requireAdminAuth,
  mw.requireAdminMenu('sbdy-demo'),
  h.handleAdminSbdyDemoDelete
);
app.post(
  '/api/admin/gjj-demo/generate',
  mw.requireAdminAuth,
  mw.requireAdminMenu('gjj-demo'),
  h.handleAdminGjjDemoGenerate
);
app.get(
  '/api/admin/gjj-demo/list',
  mw.requireAdminAuth,
  mw.requireAdminMenu('gjj-demo'),
  h.handleAdminGjjDemoList
);
app.post(
  '/api/admin/lizhi-cert/generate',
  mw.requireAdminAuth,
  mw.requireAdminMenu('lizhi-cert'),
  h.handleAdminLizhiCertGenerate
);
app.get(
  '/api/admin/lizhi-cert/stats',
  mw.requireAdminAuth,
  mw.requireAdminMenu('lizhi-cert'),
  h.handleAdminLizhiCertStats
);
app.get(
  '/api/admin/zaizhi-cert/prefill',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['zaizhi-cert', 'user-data']),
  h.handleAdminUserDataDetail
);
app.post(
  '/api/admin/zaizhi-cert/generate',
  mw.requireAdminAuth,
  mw.requireAdminMenu('zaizhi-cert'),
  h.handleAdminZaizhiCertGenerate
);
app.get(
  '/api/admin/zaizhi-cert/stats',
  mw.requireAdminAuth,
  mw.requireAdminMenu('zaizhi-cert'),
  h.handleAdminZaizhiCertStats
);
app.get(
  '/api/admin/tax-fill-survey/stats',
  mw.requireAdminAuth,
  mw.requireAdminMenu('tax-fill-survey'),
  h.handleAdminTaxFillSurveyStats
);
app.post(
  '/api/admin/user-zaizhi-cert-unlock',
  mw.requireAdminAuth,
  mw.requireAdminMenu('users'),
  h.handleAdminUserZaizhiCertUnlock
);
app.post(
  '/api/admin/ylbx-ps/edit',
  mw.requireAdminAuth,
  mw.requireAdminMenu('ylbx-ps'),
  function (req, res, next) {
    mw.adminUpload.single('file')(req, res, function (err) {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ code: 413, msg: '图片过大' });
        }
        return res.status(400).json({ code: 400, msg: (err && err.message) || '上传失败' });
      }
      return h.handleAdminYlbxPsEdit(req, res);
    });
  }
);
app.post(
  '/api/admin/ccb-flow/edit',
  mw.requireAdminAuth,
  mw.requireAdminMenu('ccb-flow'),
  function (req, res, next) {
    mw.adminUpload.single('file')(req, res, function (err) {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ code: 413, msg: '图片过大' });
        }
        return res.status(400).json({ code: 400, msg: (err && err.message) || '上传失败' });
      }
      return h.handleAdminCcbFlowEdit(req, res);
    });
  }
);
app.get(
  '/api/admin/najilu-qr/list',
  mw.requireAdminAuth,
  mw.requireAdminMenu('najilu-qr'),
  h.handleAdminNajiluQrList
);
app.get(
  '/api/admin/najilu-qr/stats',
  mw.requireAdminAuth,
  mw.requireAdminMenu('najilu-qr'),
  h.handleAdminNajiluQrStats
);
app.post(
  '/api/admin/najilu-qr/save',
  mw.requireAdminAuth,
  mw.requireAdminMenu('najilu-qr'),
  function (req, res, next) {
    mw.adminUpload.single('file')(req, res, function (err) {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ code: 413, msg: '图片过大' });
        }
        return res.status(400).json({ code: 400, msg: (err && err.message) || '上传失败' });
      }
      return h.handleAdminNajiluQrSave(req, res);
    });
  }
);
}

module.exports = { registerAdminRoutes };
