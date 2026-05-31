'use strict';

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

app.post('/api/admin/login', handleAdminLogin);
app.get('/api/admin/me', requireAdminAuth, handleAdminMe);
app.get('/api/admin/settings', requireAdminAuth, requireAdminAnyMenu(['settings', 'install-guide', 'appearance']), handleAdminSettingsGet);
app.post(
  '/api/admin/upload-asset',
  requireAdminAuth,
  requireAdminAnyMenu(['install-guide', 'appearance']),
  function (req, res, next) {
    adminUpload.single('file')(req, res, function (err) {
      if (err) {
        return res.status(400).json({ code: 400, msg: String(err.message || '上传失败') });
      }
      next();
    });
  },
  handleAdminUploadAsset
);
app.post('/api/admin/settings', requireAdminAuth, requireAdminAnyMenu(['settings', 'install-guide', 'appearance']), handleAdminSettingsPost);
app.get('/api/admin/users', requireAdminAuth, requireAdminMenu('users'), handleAdminUsers);
app.get('/api/admin/user-data', requireAdminAuth, requireAdminMenu('user-data'), handleAdminUserDataList);
app.get(
  '/api/admin/user-data/analytics',
  requireAdminAuth,
  requireAdminMenu('user-data'),
  handleAdminUserDataAnalytics
);
app.get(
  '/api/admin/user-data/detail',
  requireAdminAuth,
  requireAdminMenu('user-data'),
  handleAdminUserDataDetail
);
app.get('/api/admin/analytics/daily-conversion', requireAdminAuth, requireAdminMenu('analytics'), handleAdminUsersDailyConversion);
app.get(
  '/api/admin/analytics/registration-funnel',
  requireAdminAuth,
  requireAdminMenu('analytics'),
  handleAdminRegistrationFunnel
);
app.get(
  '/api/admin/analytics/channel-registration-funnel',
  requireAdminAuth,
  requireAdminMenu('analytics'),
  handleAdminChannelRegistrationFunnel
);
app.get(
  '/api/admin/analytics/install-track-stats',
  requireAdminAuth,
  requireAdminMenu('analytics'),
  handleAdminInstallTrackStats
);
app.get(
  '/api/admin/analytics/conversion-kpis',
  requireAdminAuth,
  requireAdminMenu('analytics'),
  handleAdminConversionKpis
);
app.get(
  '/api/admin/users/pending-activate-24h',
  requireAdminAuth,
  requireAdminMenu('analytics'),
  handleAdminUsersPendingActivate24h
);
app.get(
  '/api/admin/analytics/register-time',
  requireAdminAuth,
  requireAdminMenu('analytics'),
  handleAdminRegisterTimeDistribution
);
app.get(
  '/api/admin/analytics/register-gender',
  requireAdminAuth,
  requireAdminMenu('analytics'),
  handleAdminRegisterGenderStats
);
app.get(
  '/api/admin/analytics/register-channels',
  requireAdminAuth,
  requireAdminMenu('channel-analysis'),
  handleAdminRegisterChannelStats
);
app.get(
  '/api/admin/user-data/female-age',
  requireAdminAuth,
  requireAdminMenu('user-data'),
  handleAdminFemaleAgeStats
);
app.get(
  '/api/admin/user-data/no-tax-behavior',
  requireAdminAuth,
  requireAdminMenu('user-behavior'),
  handleAdminUserDataNoTaxBehavior
);
app.get(
  '/api/admin/user-data/no-tax-behavior/path',
  requireAdminAuth,
  requireAdminMenu('user-behavior'),
  handleAdminUserDataNoTaxBehaviorPath
);
app.get(
  '/api/admin/user-data/no-tax-behavior/export',
  requireAdminAuth,
  requireAdminMenu('user-behavior'),
  handleAdminUserDataNoTaxBehaviorExport
);
app.get('/api/admin/user-tax-records', requireAdminAuth, requireAdminMenu('users'), handleAdminUserTaxRecords);
app.post('/api/admin/issue-code', requireAdminAuth, requireAdminMenu('codes'), handleAdminIssueCode);
app.post(
  '/api/admin/issue-code-batch',
  requireAdminAuth,
  requireAdminMenu('codes'),
  handleAdminIssueCodeBatch
);
app.get('/api/admin/codes', requireAdminAuth, requireAdminMenu('codes'), handleAdminCodes);
app.post('/api/admin/ban', requireAdminAuth, requireAdminMenu('users'), handleAdminBan);
app.post('/api/admin/user-delete', requireAdminAuth, requireAdminMenu('users'), handleAdminDeleteUser);
app.post('/api/admin/users/purge-bots', requireAdminAuth, requireAdminMenu('users'), handleAdminPurgeBotUsers);
app.get('/api/admin/analytics/overview', requireAdminAuth, requireAdminMenu('analytics'), handleAdminAnalyticsOverview);
app.get('/api/admin/analytics/dau-users', requireAdminAuth, requireAdminMenu('analytics'), handleAdminAnalyticsDauUsers);
app.get('/api/admin/analytics/api-stats', requireAdminAuth, requireAdminMenu('api-analytics'), handleAdminAnalyticsApi);
app.get('/api/admin/analytics/events', requireAdminAuth, requireAdminMenu('analytics'), handleAdminAnalyticsEvents);
app.get(
  '/api/admin/analytics/activate-events',
  requireAdminAuth,
  requireAdminMenu('analytics'),
  handleAdminAnalyticsActivateEvents
);
app.get(
  '/api/admin/analytics/activate-events/users',
  requireAdminAuth,
  requireAdminMenu('analytics'),
  handleAdminAnalyticsActivateEventUsers
);
app.post(
  '/api/admin/analytics/events/clear',
  requireAdminAuth,
  requireAdminMenu('analytics'),
  handleAdminAnalyticsEventsClear
);
app.get('/api/admin/analytics/devices', requireAdminAuth, requireAdminMenu('analytics'), handleAdminAnalyticsDevices);
app.get('/api/admin/analytics/device-stats', requireAdminAuth, requireAdminMenu('analytics'), handleAdminAnalyticsDeviceStats);
app.get('/api/admin/analytics/login-recent', requireAdminAuth, requireAdminMenu('login-log'), handleAdminAnalyticsLoginRecent);
app.get('/api/admin/admin-login-logs', requireAdminAuth, requireAdminMenu('login-log'), handleAdminLoginLogs);
app.get('/api/admin/admin-operation-logs', requireAdminAuth, requireAdminMenu('login-log'), handleAdminOperationLogs);
app.get('/api/admin/feedback', requireAdminAuth, requireAdminMenu('feedback'), handleAdminFeedbackList);
app.post('/api/admin/feedback/reply', requireAdminAuth, requireAdminMenu('feedback'), handleAdminFeedbackReply);
app.get('/api/admin/accounts', requireAdminAuth, handleAdminAccountsList);
app.get('/api/admin/accounts/activated-users', requireAdminAuth, handleAdminAccountActivatedUsers);
app.post('/api/admin/accounts/create', requireAdminAuth, handleAdminAccountsCreate);
app.post('/api/admin/accounts/update', requireAdminAuth, handleAdminAccountsUpdate);
app.post('/api/admin/accounts/delete', requireAdminAuth, handleAdminAccountsDelete);
app.get('/api/admin/monitor/overview', requireAdminAuth, requireAdminMenu('server-monitor'), handleAdminMonitorOverviewLocal);
app.post('/api/admin/monitor/test-email', requireAdminAuth, requireAdminMenu('server-monitor'), handleAdminMonitorTestEmailLocal);

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
