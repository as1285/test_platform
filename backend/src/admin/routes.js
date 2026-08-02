/**
 * 管理端 BFF 路由（/api/admin/*）
 */
function registerAdminRoutes(app, deps) {
  var h = deps.handlers;
  var mw = deps.middleware;

app.use('/api/admin/analytics', mw.heavyAdminApiRateLimit);
app.use('/api/admin/user-data', mw.heavyAdminApiRateLimit);
app.use('/api/admin/activated-user-analysis', mw.heavyAdminApiRateLimit);
app.use('/api/admin', mw.adminApiRateLimit);

app.post('/api/admin/login', h.handleAdminLogin);
app.get('/api/admin/me', mw.requireAdminAuth, h.handleAdminMe);
app.get(
  '/api/admin/settings',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['settings', 'install-guide', 'appearance']),
  h.handleAdminSettingsGet
);
app.get(
  '/api/admin/agent-channels',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['install-guide', 'settings']),
  h.handleAdminAgentChannelsGet
);
app.post(
  '/api/admin/agent-channels',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['install-guide', 'settings']),
  h.handleAdminAgentChannelsUpsert
);
app.post(
  '/api/admin/agent-channels/delete',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['install-guide', 'settings']),
  h.handleAdminAgentChannelsDelete
);
app.post(
  '/api/admin/upload-asset',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['install-guide', 'appearance']),
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
app.get('/api/admin/users/deleted', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminDeletedUsers);
app.get('/api/admin/guest-users', mw.requireAdminAuth, mw.requireAdminMenu('guest-users'), h.handleAdminGuestUsers);
app.get('/api/admin/users', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUsers);
app.get('/api/admin/user-data', mw.requireAdminAuth, mw.requireAdminMenu('user-data'), h.handleAdminUserDataList);
app.get(
  '/api/admin/user-data/detail',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['user-data', 'lizhi-cert', 'ylbx-ps', 'najilu-qr']),
  h.handleAdminUserDataDetail
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
  '/api/admin/najilu-qr/prefill',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['najilu-qr', 'user-data']),
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
  mw.requireAdminAnyMenu(['analytics-purchase', 'analytics', 'analytics-conversion', 'analytics-tracking']),
  h.handleAdminAnalyticsPurchaseEvents
);
app.get(
  '/api/admin/analytics/purchase-events/users',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-purchase', 'analytics', 'analytics-conversion', 'analytics-tracking']),
  h.handleAdminAnalyticsPurchaseEventUsers
);
app.get(
  '/api/admin/analytics/daily-conversion',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-conversion', 'analytics']),
  h.handleAdminUsersDailyConversion
);
app.get(
  '/api/admin/analytics/registration-funnel',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-conversion', 'analytics']),
  h.handleAdminRegistrationFunnel
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
  '/api/admin/analytics/share-stats',
  mw.requireAdminAuth,
  mw.requireAdminMenu('share-stats'),
  h.handleAdminShareStats
);
app.get(
  '/api/admin/analytics/install-track-stats',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-tracking', 'analytics']),
  h.handleAdminInstallTrackStats
);
app.get(
  '/api/admin/analytics/conversion-kpis',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-conversion', 'analytics']),
  h.handleAdminConversionKpis
);
app.get(
  '/api/admin/users/pending-activate-24h',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-conversion', 'analytics']),
  h.handleAdminUsersPendingActivate24h
);
app.post(
  '/api/admin/messages/bulk',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-conversion', 'analytics', 'users']),
  h.handleAdminMessagesBulk
);
app.get(
  '/api/admin/analytics/register-time',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-register', 'analytics']),
  h.handleAdminRegisterTimeDistribution
);
app.get(
  '/api/admin/analytics/register-channels',
  mw.requireAdminAuth,
  mw.requireAdminMenu('channel-analysis'),
  h.handleAdminRegisterChannelStats
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
app.get(
  '/api/admin/activated-user-analysis/overview',
  mw.requireAdminAuth,
  mw.requireAdminMenu('activated-user-analysis'),
  h.handleAdminActivatedUserAnalysisOverview
);
app.get(
  '/api/admin/activated-user-analysis/users',
  mw.requireAdminAuth,
  mw.requireAdminMenu('activated-user-analysis'),
  h.handleAdminActivatedUserAnalysisUsers
);
app.get(
  '/api/admin/activated-user-analysis/behavior-path',
  mw.requireAdminAuth,
  mw.requireAdminMenu('activated-user-analysis'),
  h.handleAdminActivatedUserAnalysisBehaviorPath
);
app.get('/api/admin/user-tax-records', mw.requireAdminAuth, mw.requireAdminAnyMenu(['users', 'guest-users', 'tax-records-edit']), h.handleAdminUserTaxRecords);
app.post(
  '/api/admin/user-tax-records',
  mw.requireAdminAuth,
  mw.requireAdminMenu('tax-records-edit'),
  h.handleAdminUserTaxRecordsWrite
);
app.post('/api/admin/issue-code', mw.requireAdminAuth, mw.requireAdminMenu('codes'), h.handleAdminIssueCode);
app.post(
  '/api/admin/issue-code-batch',
  mw.requireAdminAuth,
  mw.requireAdminMenu('codes'),
  h.handleAdminIssueCodeBatch
);
app.get(
  '/api/admin/activation-batch-channels',
  mw.requireAdminAuth,
  mw.requireAdminMenu('codes'),
  h.handleAdminActivationBatchChannels
);
app.post(
  '/api/admin/activation-batch-channels',
  mw.requireAdminAuth,
  mw.requireAdminMenu('codes'),
  h.handleAdminActivationBatchChannels
);
app.get(
  '/api/admin/codes',
  mw.requireAdminAuth,
  mw.requireAdminMenu('codes'),
  h.handleAdminCodes
);
app.post('/api/admin/user-activate', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUserActivate);
app.post('/api/admin/user-pricing-abc', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUserPricingAbc);
app.post(
  '/api/admin/user-rename-fee-exempt',
  mw.requireAdminAuth,
  mw.requireAdminMenu('users'),
  h.handleAdminUserRenameFeeExempt
);
app.post('/api/admin/user-password', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUserPassword);
app.post('/api/admin/ban', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminBan);
app.post('/api/admin/block-ip', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminBlockIp);
app.post('/api/admin/unblock-ip', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUnblockIp);
app.get('/api/admin/blocked-ips', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminBlockedIpsList);
app.post('/api/admin/user-delete', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminDeleteUser);
app.post('/api/admin/user-refund', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUserRefund);
app.post('/api/admin/user-restore', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUserRestore);
app.post('/api/admin/user-hard-delete', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUserHardDelete);
app.post('/api/admin/users/purge-bots', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminPurgeBotUsers);
app.get(
  '/api/admin/analytics/events',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-tracking', 'analytics']),
  h.handleAdminAnalyticsEvents
);
app.get(
  '/api/admin/analytics/activate-events',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-tracking', 'analytics']),
  h.handleAdminAnalyticsActivateEvents
);
app.get(
  '/api/admin/analytics/activate-events/users',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-tracking', 'analytics']),
  h.handleAdminAnalyticsActivateEventUsers
);
app.post(
  '/api/admin/analytics/events/clear',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-tracking', 'analytics']),
  h.handleAdminAnalyticsEventsClear
);
app.get('/api/admin/analytics/login-recent', mw.requireAdminAuth, mw.requireAdminMenu('login-log'), h.handleAdminAnalyticsLoginRecent);
app.get('/api/admin/admin-login-logs', mw.requireAdminAuth, mw.requireAdminMenu('login-log'), h.handleAdminLoginLogs);
app.get('/api/admin/admin-operation-logs', mw.requireAdminAuth, mw.requireAdminMenu('login-log'), h.handleAdminOperationLogs);
app.get('/api/admin/accounts', mw.requireAdminAuth, h.handleAdminAccountsList);
app.get('/api/admin/accounts/activated-users', mw.requireAdminAuth, h.handleAdminAccountActivatedUsers);
app.post('/api/admin/accounts/create', mw.requireAdminAuth, h.handleAdminAccountsCreate);
app.post('/api/admin/accounts/update', mw.requireAdminAuth, h.handleAdminAccountsUpdate);
app.post('/api/admin/accounts/delete', mw.requireAdminAuth, h.handleAdminAccountsDelete);
app.get('/api/admin/monitor/overview', mw.requireAdminAuth, mw.requireAdminMenu('server-monitor'), h.handleAdminMonitorOverview);
app.post('/api/admin/monitor/test-email', mw.requireAdminAuth, mw.requireAdminMenu('server-monitor'), h.handleAdminMonitorTestEmail);
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
  '/api/admin/lizhi-cert/generate',
  mw.requireAdminAuth,
  mw.requireAdminMenu('lizhi-cert'),
  h.handleAdminLizhiCertGenerate
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
app.get(
  '/api/admin/najilu-qr/list',
  mw.requireAdminAuth,
  mw.requireAdminMenu('najilu-qr'),
  h.handleAdminNajiluQrList
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
