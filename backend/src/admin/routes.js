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
app.get('/api/admin/settings', mw.requireAdminAuth, mw.requireAdminAnyMenu(['settings', 'install-guide', 'appearance']), h.handleAdminSettingsGet);
app.post(
  '/api/admin/upload-asset',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['install-guide', 'appearance']),
  function (req, res, next) {
    mw.adminUpload.single('file')(req, res, function (err) {
      if (err) {
        return res.status(400).json({ code: 400, msg: String(err.message || '上传失败') });
      }
      next();
    });
  },
  h.handleAdminUploadAsset
);
app.post('/api/admin/settings', mw.requireAdminAuth, mw.requireAdminAnyMenu(['settings', 'install-guide', 'appearance']), h.handleAdminSettingsPost);
app.get('/api/admin/users/deleted', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminDeletedUsers);
app.get('/api/admin/guest-users', mw.requireAdminAuth, mw.requireAdminMenu('guest-users'), h.handleAdminGuestUsers);
app.get('/api/admin/users', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUsers);
app.get('/api/admin/user-data', mw.requireAdminAuth, mw.requireAdminMenu('user-data'), h.handleAdminUserDataList);
app.get(
  '/api/admin/user-data/analytics',
  mw.requireAdminAuth,
  mw.requireAdminMenu('user-data'),
  h.handleAdminUserDataAnalytics
);
app.get(
  '/api/admin/user-data/salary-high/charts',
  mw.requireAdminAuth,
  mw.requireAdminMenu('user-data'),
  h.handleAdminUserDataSalaryHighCharts
);
app.get(
  '/api/admin/user-data/detail',
  mw.requireAdminAuth,
  mw.requireAdminMenu('user-data'),
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
  '/api/admin/analytics/invite-registrations',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-invite', 'analytics', 'analytics-register']),
  h.handleAdminInviteRegistrations
);
app.get(
  '/api/admin/analytics/register-time',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-register', 'analytics']),
  h.handleAdminRegisterTimeDistribution
);
app.get(
  '/api/admin/analytics/register-gender',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-register', 'analytics', 'channel-analysis']),
  h.handleAdminRegisterGenderStats
);
app.get(
  '/api/admin/analytics/register-channels',
  mw.requireAdminAuth,
  mw.requireAdminMenu('channel-analysis'),
  h.handleAdminRegisterChannelStats
);
app.get(
  '/api/admin/analytics/female-age',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-register', 'analytics']),
  h.handleAdminFemaleAgeStats
);
app.get(
  '/api/admin/user-data/female-age',
  mw.requireAdminAuth,
  mw.requireAdminMenu('user-data'),
  h.handleAdminFemaleAgeStats
);
app.get(
  '/api/admin/user-data/no-tax-behavior',
  mw.requireAdminAuth,
  mw.requireAdminMenu('user-behavior'),
  h.handleAdminUserDataNoTaxBehavior
);
app.get(
  '/api/admin/user-data/no-tax-behavior/path',
  mw.requireAdminAuth,
  mw.requireAdminMenu('user-behavior'),
  h.handleAdminUserDataNoTaxBehaviorPath
);
app.get(
  '/api/admin/user-data/no-tax-behavior/export',
  mw.requireAdminAuth,
  mw.requireAdminMenu('user-behavior'),
  h.handleAdminUserDataNoTaxBehaviorExport
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
app.get('/api/admin/user-tax-records', mw.requireAdminAuth, mw.requireAdminAnyMenu(['users', 'guest-users']), h.handleAdminUserTaxRecords);
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
app.get('/api/admin/codes', mw.requireAdminAuth, mw.requireAdminMenu('codes'), h.handleAdminCodes);
app.post('/api/admin/user-activate', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUserActivate);
app.post('/api/admin/user-password', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUserPassword);
app.post('/api/admin/ban', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminBan);
app.post('/api/admin/user-delete', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminDeleteUser);
app.post('/api/admin/user-refund', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUserRefund);
app.post('/api/admin/user-restore', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminUserRestore);
app.post('/api/admin/users/purge-bots', mw.requireAdminAuth, mw.requireAdminMenu('users'), h.handleAdminPurgeBotUsers);
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
app.get('/api/admin/analytics/api-stats', mw.requireAdminAuth, mw.requireAdminMenu('api-analytics'), h.handleAdminAnalyticsApi);
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
app.get(
  '/api/admin/analytics/devices',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-devices', 'analytics']),
  h.handleAdminAnalyticsDevices
);
app.get(
  '/api/admin/analytics/device-stats',
  mw.requireAdminAuth,
  mw.requireAdminAnyMenu(['analytics-devices', 'analytics']),
  h.handleAdminAnalyticsDeviceStats
);
app.get('/api/admin/analytics/login-recent', mw.requireAdminAuth, mw.requireAdminMenu('login-log'), h.handleAdminAnalyticsLoginRecent);
app.get('/api/admin/admin-login-logs', mw.requireAdminAuth, mw.requireAdminMenu('login-log'), h.handleAdminLoginLogs);
app.get('/api/admin/admin-operation-logs', mw.requireAdminAuth, mw.requireAdminMenu('login-log'), h.handleAdminOperationLogs);
app.get('/api/admin/feedback', mw.requireAdminAuth, mw.requireAdminMenu('feedback'), h.handleAdminFeedbackList);
app.post('/api/admin/feedback/reply', mw.requireAdminAuth, mw.requireAdminMenu('feedback'), h.handleAdminFeedbackReply);
app.get('/api/admin/chat/conversations', mw.requireAdminAuth, mw.requireAdminMenu('chat'), h.handleAdminChatConversations);
app.get('/api/admin/chat/messages', mw.requireAdminAuth, mw.requireAdminMenu('chat'), h.handleAdminChatMessages);
app.post('/api/admin/chat/send', mw.requireAdminAuth, mw.requireAdminMenu('chat'), h.handleAdminChatSend);
app.post('/api/admin/chat/bot-paused', mw.requireAdminAuth, mw.requireAdminMenu('chat'), h.handleAdminChatBotPaused);
app.get('/api/admin/chat/auto-reply', mw.requireAdminAuth, mw.requireAdminMenu('chat'), h.handleAdminChatAutoReplyGet);
app.post('/api/admin/chat/auto-reply', mw.requireAdminAuth, mw.requireAdminMenu('chat'), h.handleAdminChatAutoReplySave);
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
}

module.exports = { registerAdminRoutes };
