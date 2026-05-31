/* admin/core/state.js — shared state vars */
var userPage = 1;
var USER_LIMIT_STORAGE_KEY = 'admin_user_list_limit';
var USER_LIMIT_OPTIONS = [10, 20, 50, 100];
var userLimit = 10;
(function initUserListPageLimit() {
    var saved = parseInt(localStorage.getItem(USER_LIMIT_STORAGE_KEY), 10);
    if (USER_LIMIT_OPTIONS.indexOf(saved) >= 0) {
        userLimit = saved;
    }
    var sel = document.getElementById('userPageLimit');
    if (sel) {
        sel.value = String(userLimit);
    }
})();
var codePage = 1;
var codeLimit = 10;
var xianyuCodePage = 1;
var xianyuCodeLimit = 10;
var loginLogMode = 'admin-login';
var loginRecentPage = 1;
var loginRecentLimit = 20;
var userLoginPage = 1;
var userLoginLimit = 20;
var currentAdminProfile = { username: '', full_name: '', is_super: false, menus: [] };
var adminMenuKeyList = [];
var _adminAccountsLoaded = false;

var _adminUsersLoaded = false;
var _adminUserDataLoaded = false;
var _adminUserBehaviorLoaded = false;
var userDataPage = 1;
var userDataLimit = 15;
var _adminCodesLoaded = false;
var _adminAnalyticsSeen = false;
var _adminChannelAnalysisSeen = false;
var _adminApiAnalyticsSeen = false;
var _adminServerMonitorSeen = false;
var _channelAnalysisChartInstances = [];
