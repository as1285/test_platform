/* admin/core/router.js — routing & menu */
function adminHasMenu(menuKey) {
    if (!menuKey) return false;
    if (menuKey === 'user-login-log') menuKey = 'login-log';
    if (currentAdminProfile && currentAdminProfile.is_super) return true;
    return !!(currentAdminProfile && Array.isArray(currentAdminProfile.menus) && currentAdminProfile.menus.indexOf(menuKey) >= 0);
}

function firstAllowedAdminPage() {
    var order = ['settings', 'install-guide', 'appearance', 'codes', 'admin-accounts', 'users', 'user-data', 'user-behavior', 'feedback', 'login-log', 'user-login-log', 'server-monitor', 'analytics', 'channel-analysis', 'api-analytics'];
    for (var i = 0; i < order.length; i++) {
        if (adminHasMenu(order[i])) return order[i];
    }
    return 'settings';
}

function readAdminProfileCache() {
    try {
        var raw = localStorage.getItem('admin_profile');
        if (!raw) return;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        currentAdminProfile = {
            username: parsed.username ? String(parsed.username) : '',
            full_name: parsed.full_name ? String(parsed.full_name) : '',
            is_super: !!parsed.is_super,
            menus: Array.isArray(parsed.menus) ? parsed.menus.map(function (m) { return String(m); }) : []
        };
    } catch (e) {}
}

function applyMenuVisibility() {
    document.querySelectorAll('.nav-item').forEach(function (btn) {
        var key = btn.getAttribute('data-page');
        var on = adminHasMenu(key);
        btn.style.display = on ? '' : 'none';
    });
    document.querySelectorAll('.nav-group').forEach(function (group) {
        var anyVisible = Array.prototype.some.call(
            group.querySelectorAll('.nav-item'),
            function (btn) { return btn.style.display !== 'none'; }
        );
        group.style.display = anyVisible ? '' : 'none';
    });
}

function normalizeAdminPage(raw) {
    var k = String(raw || '').replace(/^#/, '').trim().toLowerCase();
    if (k === 'system' || k === 'setting') k = 'settings';
    if (k === 'install' || k === 'guide') k = 'install-guide';
    var ok = {
        settings: 1,
        'install-guide': 1,
        appearance: 1,
        codes: 1,
        'admin-accounts': 1,
        users: 1,
        'user-data': 1,
        'user-behavior': 1,
        feedback: 1,
        analytics: 1,
        'channel-analysis': 1,
        'api-analytics': 1,
        'login-log': 1,
        'user-login-log': 1,
        'server-monitor': 1
    };
    if (!ok[k] || !adminHasMenu(k)) {
        return firstAllowedAdminPage();
    }
    return k;
}

function applyAdminRoute() {
    var pageKey = normalizeAdminPage(location.hash);
    document.querySelectorAll('.page-panel').forEach(function (el) {
        el.classList.toggle('active', el.id === 'page-' + pageKey);
    });
    document.querySelectorAll('.nav-item').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-page') === pageKey);
    });
    var navBtn = document.querySelector('.nav-item[data-page="' + pageKey + '"]');
    var titleEl = document.getElementById('pageTitle');
    if (titleEl && navBtn) {
        titleEl.textContent = navBtn.getAttribute('data-title') || '管理控制台';
    }
    if (pageKey === 'users' && !_adminUsersLoaded) {
        _adminUsersLoaded = true;
        loadUsers(1);
    }
    if (pageKey === 'user-data' && !_adminUserDataLoaded) {
        _adminUserDataLoaded = true;
        loadUserDataAnalytics();
        loadUserDataList(1);
    }
    if (pageKey === 'user-behavior' && !_adminUserBehaviorLoaded) {
        _adminUserBehaviorLoaded = true;
        renderNoTaxScriptTemplates();
        loadNoTaxBehaviorList(1);
    }
    if (pageKey === 'codes' && !_adminCodesLoaded) {
        _adminCodesLoaded = true;
        loadCodes(1);
        loadXianyuCodes(1);
    }
    if (pageKey === 'admin-accounts' && !_adminAccountsLoaded) {
        _adminAccountsLoaded = true;
        loadAdminAccounts();
    }
    if (pageKey === 'analytics' && !_adminAnalyticsSeen) {
        _adminAnalyticsSeen = true;
        loadAnalyticsDashboard();
    }
    if (pageKey === 'channel-analysis' && !_adminChannelAnalysisSeen) {
        _adminChannelAnalysisSeen = true;
        loadChannelAnalysis();
    }
    if (pageKey === 'api-analytics' && !_adminApiAnalyticsSeen) {
        _adminApiAnalyticsSeen = true;
        loadApiAnalyticsPanel();
    }
    if (pageKey === 'server-monitor' && !_adminServerMonitorSeen) {
        _adminServerMonitorSeen = true;
        loadServerMonitor();
    }
    if (pageKey === 'login-log') {
        loginRecentPage = 1;
        var sz = document.getElementById('loginLogPageSize');
        if (sz) {
            loginRecentLimit = parseInt(sz.value, 10) || 20;
        }
        loadLoginRecentPage(1);
    }
    if (pageKey === 'user-login-log') {
        userLoginPage = 1;
        var usz = document.getElementById('userLoginLogPageSize');
        if (usz) {
            userLoginLimit = parseInt(usz.value, 10) || 20;
        }
        loadUserLoginRecentPage(1);
    }
    if (pageKey === 'feedback') {
        feedbackAdminPage = 1;
        loadAdminFeedbackPage(1);
    }
}
