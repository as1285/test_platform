/* admin/pages/logs.js — login logs */
function loadLoginRecentPage(page) {
    if (page != null && isFinite(page)) {
        loginRecentPage = Math.max(1, parseInt(page, 10) || 1);
    }
    var lim = loginRecentLimit;
    var modeEl = document.getElementById('loginLogMode');
    if (modeEl) {
        loginLogMode = modeEl.value === 'admin-operation' ? 'admin-operation' : 'admin-login';
    }
    var hintEl = document.getElementById('loginLogHint');
    var theadEl = document.getElementById('loginLogThead');
    if (loginLogMode === 'admin-operation') {
        if (hintEl) hintEl.textContent = '后台账号操作日志（含请求路径、目标账号、执行结果、IP、设备）。';
        if (theadEl) {
            theadEl.innerHTML =
                '<tr><th>时间</th><th>账号</th><th>姓名</th><th>方法</th><th>路径</th><th>动作</th><th>目标账号</th><th>结果</th><th>状态码</th><th>IP/城市</th><th>设备</th><th>请求摘要</th></tr>';
        }
    } else {
        if (hintEl) hintEl.textContent = '后台账号登录记录（成功/失败），含 IP、设备信息。';
        if (theadEl) {
            theadEl.innerHTML = '<tr><th>时间</th><th>账号</th><th>结果</th><th>IP</th><th>城市</th><th>设备</th><th>原因</th></tr>';
        }
    }
    var loadingColspan = loginLogMode === 'admin-operation' ? 12 : 7;
    document.getElementById('loginLogTbody').innerHTML =
        '<tr><td colspan="' + loadingColspan + '">加载中…</td></tr>';

    var query = '';
    var uname = document.getElementById('loginLogAdminUsername').value.trim();
    var okFilter = document.getElementById('loginLogOkFilter').value;
    var base = loginLogMode === 'admin-operation' ? 'api/admin/admin-operation-logs' : 'api/admin/admin-login-logs';
    query +=
        base +
        '?page=' +
        encodeURIComponent(loginRecentPage) +
        '&limit=' +
        encodeURIComponent(lim);
    if (uname) {
        query += '&username=' + encodeURIComponent(uname);
    }
    if (okFilter === '1' || okFilter === '0') {
        query += '&ok=' + encodeURIComponent(okFilter);
    }
    adminFetch(query)
        .then(function (r) {
            return r.json();
        })
        .then(function (recent) {
            var info = document.getElementById('loginLogPageInfo');
            var prevBtn = document.getElementById('loginLogPrev');
            var nextBtn = document.getElementById('loginLogNext');
            if (recent.code === 200 && recent.data && recent.data.items) {
                var total = recent.data.total != null ? Number(recent.data.total) : 0;
                var tp = recent.data.total_pages != null ? Number(recent.data.total_pages) : 0;
                var cur = recent.data.page != null ? Number(recent.data.page) : loginRecentPage;
                loginRecentPage = cur;
                var rr = '';
                recent.data.items.forEach(function (row) {
                    var okBadge = row.ok
                        ? '<span class="badge badge-yes">成功</span>'
                        : '<span class="badge badge-no">失败</span>';
                    if (loginLogMode === 'admin-operation') {
                        var codeText = String(row.status_code != null ? row.status_code : '—');
                        if (row.biz_result_code != null && String(row.biz_result_code) !== '') {
                            codeText += ' / 业务码 ' + String(row.biz_result_code);
                        }
                        rr +=
                            '<tr><td>' +
                            formatDt(row.created_at) +
                            '</td><td class="cell-break">' +
                            esc(row.admin_username || '') +
                            '</td><td class="cell-break">' +
                            esc(row.admin_full_name || '—') +
                            '</td><td>' +
                            esc(row.method || '—') +
                            '</td><td class="cell-break">' +
                            esc(row.path || '—') +
                            '</td><td>' +
                            esc(row.action || '—') +
                            '</td><td class="cell-break">' +
                            esc(row.target_username || '—') +
                            '</td><td>' +
                            okBadge +
                            '</td><td>' +
                            esc(codeText) +
                            '</td><td class="cell-break">' +
                            esc((row.ip || '—') + ' / ' + (row.city || '—')) +
                            '</td><td class="cell-break">' +
                            esc(row.device_desc || '—') +
                            '</td><td class="cell-break">' +
                            esc(row.request_brief || '—') +
                            '</td></tr>';
                        return;
                    }
                    rr +=
                        '<tr><td>' +
                        formatDt(row.created_at) +
                        '</td><td class="cell-break">' +
                        esc(row.admin_username || '') +
                        '</td><td>' +
                        okBadge +
                        '</td><td>' +
                        esc(row.ip || '') +
                        '</td><td>' +
                        esc(row.city || '') +
                        '</td><td class="cell-break">' +
                        esc(row.device_desc || row.user_agent || '—') +
                        '</td><td>' +
                        esc(row.reason || '—') +
                        '</td></tr>';
                });
                document.getElementById('loginLogTbody').innerHTML =
                    rr || '<tr><td colspan="' + loadingColspan + '">暂无记录</td></tr>';
                if (info) {
                    info.textContent =
                        '第 ' +
                        cur +
                        ' / ' +
                        (tp > 0 ? tp : 1) +
                        ' 页 · 共 ' +
                        total +
                        ' 条';
                }
                if (prevBtn) {
                    prevBtn.disabled = cur <= 1;
                }
                if (nextBtn) {
                    nextBtn.disabled = tp <= 0 || cur >= tp;
                }
            } else {
                document.getElementById('loginLogTbody').innerHTML =
                    '<tr><td colspan="' + loadingColspan + '">' + esc(recent.msg || '加载失败') + '</td></tr>';
                if (info) {
                    info.textContent = '—';
                }
                if (prevBtn) {
                    prevBtn.disabled = true;
                }
                if (nextBtn) {
                    nextBtn.disabled = true;
                }
            }
        })
        .catch(function () {
            document.getElementById('loginLogTbody').innerHTML =
                '<tr><td colspan="' + loadingColspan + '">网络错误</td></tr>';
            var prevBtn = document.getElementById('loginLogPrev');
            var nextBtn = document.getElementById('loginLogNext');
            if (prevBtn) {
                prevBtn.disabled = true;
            }
            if (nextBtn) {
                nextBtn.disabled = true;
            }
        });
}

function loadAnalyticsDevices() {
    var u = document.getElementById('analyticsDeviceUser').value.trim();
    if (!u) {
        alert('请输入用户账号');
        return;
    }
    document.getElementById('analyticsDevicesTbody').innerHTML = '<tr><td colspan="11">加载中…</td></tr>';
    adminFetch('api/admin/analytics/devices?username=' + encodeURIComponent(u))
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.code !== 200 || !data.data) {
                document.getElementById('analyticsDevicesTbody').innerHTML = '<tr><td colspan="11">' + esc(data.msg || '查询失败') + '</td></tr>';
                return;
            }
            var list = data.data.devices || [];
            var h = '';
            list.forEach(function (d) {
                var jshort = d.device_json ? esc(d.device_json.substring(0, 180)) + (d.device_json.length > 180 ? '…' : '') : '—';
                h += '<tr><td class="cell-break"><code>' + esc(d.client_id || '—') + '</code></td><td class="cell-break">' + esc(d.summary || '—') + '</td><td class="cell-break"><code>' + esc(d.device_fp) + '</code></td><td class="cell-break">' + esc(d.user_agent_short) + '</td><td>' + esc(d.ip_last) + '</td><td>' + esc(d.city_last) + '</td><td>' + formatDt(d.first_seen) + '</td><td>' + formatDt(d.last_seen) + '</td><td>' + esc(String(d.login_count)) + '</td><td>' + esc(String(d.api_sync_count != null ? d.api_sync_count : 0)) + '</td><td class="cell-break" title="' + esc(d.device_json || '') + '">' + jshort + '</td></tr>';
            });
            document.getElementById('analyticsDevicesTbody').innerHTML = h || '<tr><td colspan="11">暂无设备记录（需客户端携带 X-Client-Device 或发生过登录）</td></tr>';
        })
        .catch(function () {
            document.getElementById('analyticsDevicesTbody').innerHTML = '<tr><td colspan="11">网络错误</td></tr>';
        });
}

function loadUserLoginRecentPage(page) {
    if (page != null && isFinite(page)) {
        userLoginPage = Math.max(1, parseInt(page, 10) || 1);
    }
    var lim = userLoginLimit;
    var loadingColspan = 7;
    document.getElementById('userLoginLogTbody').innerHTML =
        '<tr><td colspan="' + loadingColspan + '">加载中…</td></tr>';
    var query =
        'api/admin/analytics/login-recent?page=' +
        encodeURIComponent(userLoginPage) +
        '&limit=' +
        encodeURIComponent(lim);
    var uname = document.getElementById('userLoginLogUsername').value.trim();
    var okFilter = document.getElementById('userLoginLogOkFilter').value;
    if (uname) {
        query += '&username=' + encodeURIComponent(uname);
    }
    if (okFilter === '1' || okFilter === '0') {
        query += '&ok=' + encodeURIComponent(okFilter);
    }
    adminFetch(query)
        .then(function (r) { return r.json(); })
        .then(function (recent) {
            var info = document.getElementById('userLoginLogPageInfo');
            var prevBtn = document.getElementById('userLoginLogPrev');
            var nextBtn = document.getElementById('userLoginLogNext');
            if (recent.code === 200 && recent.data && recent.data.items) {
                var total = recent.data.total != null ? Number(recent.data.total) : 0;
                var tp = recent.data.total_pages != null ? Number(recent.data.total_pages) : 0;
                var cur = recent.data.page != null ? Number(recent.data.page) : userLoginPage;
                userLoginPage = cur;
                var rr = '';
                recent.data.items.forEach(function (row) {
                    var okBadge = row.ok
                        ? '<span class="badge badge-yes">成功</span>'
                        : '<span class="badge badge-no">失败</span>';
                    rr +=
                        '<tr><td>' +
                        formatDt(row.created_at) +
                        '</td><td class="cell-break">' +
                        esc(row.username || '') +
                        '</td><td>' +
                        okBadge +
                        '</td><td>' +
                        esc(row.ip || '') +
                        '</td><td>' +
                        esc(row.city || '') +
                        '</td><td class="cell-break">' +
                        esc(row.user_agent || '—') +
                        '</td><td>' +
                        esc(row.reason_label || row.reason_key || '—') +
                        '</td></tr>';
                });
                document.getElementById('userLoginLogTbody').innerHTML =
                    rr || '<tr><td colspan="' + loadingColspan + '">暂无记录</td></tr>';
                if (info) {
                    info.textContent =
                        '第 ' +
                        cur +
                        ' / ' +
                        (tp > 0 ? tp : 1) +
                        ' 页 · 共 ' +
                        total +
                        ' 条';
                }
                if (prevBtn) prevBtn.disabled = cur <= 1;
                if (nextBtn) nextBtn.disabled = tp <= 0 || cur >= tp;
            } else {
                document.getElementById('userLoginLogTbody').innerHTML =
                    '<tr><td colspan="' + loadingColspan + '">' + esc(recent.msg || '加载失败') + '</td></tr>';
                if (info) info.textContent = '—';
                if (prevBtn) prevBtn.disabled = true;
                if (nextBtn) nextBtn.disabled = true;
            }
        })
        .catch(function () {
            document.getElementById('userLoginLogTbody').innerHTML =
                '<tr><td colspan="' + loadingColspan + '">网络错误</td></tr>';
            var prevBtn = document.getElementById('userLoginLogPrev');
            var nextBtn = document.getElementById('userLoginLogNext');
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
        });
}

var __adminUserPagesToggleBound = false;
function ensureUserDetailPagesToggleDelegation() {
    if (__adminUserPagesToggleBound) return;
    var tb = document.getElementById('userTbody');
    if (!tb) return;
    __adminUserPagesToggleBound = true;
    tb.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.user-detail-pages-toggle');
        if (!btn) return;
        ev.preventDefault();
        var root = btn.closest('.user-detail-pages-collapsible');
        if (!root) return;
        var panel = root.querySelector('.user-detail-pages-panel');
        var chev = btn.querySelector('.user-detail-pages-chevron');
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        var next = !expanded;
        btn.setAttribute('aria-expanded', next ? 'true' : 'false');
        if (panel) panel.hidden = !next;
        if (chev) chev.textContent = next ? '▲' : '▼';
    });
}
