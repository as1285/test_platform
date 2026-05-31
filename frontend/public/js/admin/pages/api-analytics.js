/* admin/pages/api-analytics.js — api analytics */
function loadApiAnalyticsPanel() {
    var daysA = parseInt(document.getElementById('apiAnalyticsDays').value, 10) || 7;
    document.getElementById('apiAnalyticsCatTbody').innerHTML =
        '<tr><td colspan="2">加载中…</td></tr>';
    document.getElementById('apiAnalyticsRoutesTbody').innerHTML =
        '<tr><td colspan="3">加载中…</td></tr>';
    adminFetch('api/admin/analytics/api-stats?days=' + encodeURIComponent(daysA))
        .then(function (r) {
            return r.json();
        })
        .then(function (api) {
            if (api.code === 200 && api.data) {
                var ch = '';
                (api.data.by_category || []).forEach(function (row) {
                    ch +=
                        '<tr><td>' +
                        esc(row.category) +
                        '</td><td>' +
                        esc(String(row.calls)) +
                        '</td></tr>';
                });
                document.getElementById('apiAnalyticsCatTbody').innerHTML =
                    ch || '<tr><td colspan="2">暂无数据</td></tr>';
                var rh = '';
                (api.data.top_routes || []).slice(0, 10).forEach(function (row) {
                    rh +=
                        '<tr><td>' +
                        esc(row.category) +
                        '</td><td class="cell-break"><code>' +
                        esc(row.route_key) +
                        '</code></td><td>' +
                        esc(String(row.cnt)) +
                        '</td></tr>';
                });
                document.getElementById('apiAnalyticsRoutesTbody').innerHTML =
                    rh || '<tr><td colspan="3">暂无数据</td></tr>';
            } else {
                document.getElementById('apiAnalyticsCatTbody').innerHTML =
                    '<tr><td colspan="2">' + esc(api.msg || '加载失败') + '</td></tr>';
                document.getElementById('apiAnalyticsRoutesTbody').innerHTML =
                    '<tr><td colspan="3">—</td></tr>';
            }
        })
        .catch(function () {
            document.getElementById('apiAnalyticsCatTbody').innerHTML =
                '<tr><td colspan="2">网络错误</td></tr>';
            document.getElementById('apiAnalyticsRoutesTbody').innerHTML =
                '<tr><td colspan="3">网络错误</td></tr>';
        });
}

var DAU_USERS_PAGE_LIMIT = 10;
var ACTIVATE_USERS_PAGE_LIMIT = 15;
var ACTIVATE_EVENT_KEYS = [
    'track_activate_prompt_open',
    'track_activate_prompt_cancel',
    'track_activate_prompt_confirm',
    'track_xianyu_purchase_click',
    'track_qq_add_click'
];

function activateDateDomKey(dateStr) {
    return String(dateStr || '').replace(/[^0-9]/g, '');
}

function activateEventCount(row, key) {
    if (!row || !row.events) {
        return 0;
    }
    return Number(row.events[key]) || 0;
}

function renderActivateUsersPanel(box, dateStr, data) {
    if (!box) {
        return;
    }
    var users = Array.isArray(data.users) ? data.users : [];
    var page = Number(data.page) || 1;
    var total = Number(data.total) || 0;
    var totalPages = Math.max(1, Number(data.total_pages) || Math.ceil(total / ACTIVATE_USERS_PAGE_LIMIT) || 1);
    box.setAttribute('data-date', dateStr);
    box.setAttribute('data-page', String(page));
    box.setAttribute('data-loaded', '1');

    var html = '<div class="dau-users-panel">';
    html +=
        '<div class="dau-users-title">' +
        esc(dateStr) +
        ' 点击用户（共 ' +
        total +
        ' 个账号；本页 ' +
        users.length +
        ' 个）</div>';
    if (!users.length) {
        html += '<div class="dau-users-list">暂无点击记录</div>';
    } else {
        html += '<div class="scroll-x"><table class="user-detail-table"><thead><tr>';
        html += '<th>账号</th><th>打开</th><th>取消</th><th>确定</th><th>闲鱼</th><th>添加QQ</th><th>合计</th><th>最近点击</th>';
        html += '</tr></thead><tbody>';
        users.forEach(function (u) {
            html += '<tr>';
            html += '<td class="cell-break"><code>' + esc(u.username) + '</code></td>';
            ACTIVATE_EVENT_KEYS.forEach(function (k) {
                html += '<td>' + esc(String(activateEventCount(u, k))) + '</td>';
            });
            html += '<td><strong>' + esc(String(u.total || 0)) + '</strong></td>';
            html += '<td>' + esc(u.last_at ? formatDt(u.last_at) : '—') + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table></div>';
    }
    if (totalPages > 1) {
        html +=
            '<div class="pagination">' +
            '<button type="button" class="btn-page activate-users-prev" data-date="' +
            esc(dateStr) +
            '"' +
            (page <= 1 ? ' disabled' : '') +
            '>上一页</button>' +
            '<span>第 ' +
            esc(String(page)) +
            ' / ' +
            esc(String(totalPages)) +
            ' 页</span>' +
            '<button type="button" class="btn-page activate-users-next" data-date="' +
            esc(dateStr) +
            '"' +
            (page >= totalPages ? ' disabled' : '') +
            '>下一页</button></div>';
    }
    html += '</div>';
    box.innerHTML = html;
}

function loadActivateUsersForDate(dateStr, page, box) {
    if (!box) {
        return;
    }
    box.removeAttribute('data-loaded');
    box.innerHTML = '<div class="dau-users-panel" style="color:#888;">加载中…</div>';
    adminFetch(
        'api/admin/analytics/activate-events/users?date=' +
            encodeURIComponent(dateStr) +
            '&page=' +
            encodeURIComponent(String(page || 1)) +
            '&limit=' +
            encodeURIComponent(String(ACTIVATE_USERS_PAGE_LIMIT))
    )
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                box.innerHTML =
                    '<div class="dau-users-panel" style="color:#c00;">' + esc(j.msg || '加载失败') + '</div>';
                return;
            }
            renderActivateUsersPanel(box, dateStr, j.data);
        })
        .catch(function () {
            box.innerHTML = '<div class="dau-users-panel" style="color:#c00;">网络错误</div>';
        });
}

function renderActivateEventsAnalytics(data) {
    var summary = Array.isArray(data.summary) ? data.summary : [];
    var byDay = Array.isArray(data.by_day) ? data.by_day : [];
    var sh = '';
    summary.forEach(function (row) {
        var meta = parseTrackEventMeta(row.event_key || '');
        sh +=
            '<tr><td>' +
            esc(meta.button || row.label || '—') +
            '</td><td class="cell-break"><code>' +
            esc(row.event_key || '') +
            '</code></td><td>' +
            esc(String(row.total || 0)) +
            '</td></tr>';
    });
    document.getElementById('activateEventsSummaryTbody').innerHTML =
        sh || '<tr><td colspan="3">暂无数据</td></tr>';
    var hintEl = document.getElementById('activateEventsHint');
    if (hintEl) {
        hintEl.textContent =
            '统计区间内共 ' +
            (data.total_clicks != null ? data.total_clicks : 0) +
            ' 次点击，' +
            byDay.length +
            ' 天有记录。';
    }
    var dh = '';
    byDay.forEach(function (row) {
        var dk = activateDateDomKey(row.date);
        dh += '<tr class="activate-summary-row">';
        dh += '<td>' + esc(row.date) + '</td>';
        ACTIVATE_EVENT_KEYS.forEach(function (k) {
            dh += '<td>' + esc(String(activateEventCount(row, k))) + '</td>';
        });
        dh += '<td><strong>' + esc(String(row.total || 0)) + '</strong></td>';
        dh += '<td>' + esc(String(row.unique_users != null ? row.unique_users : 0)) + '</td>';
        dh +=
            '<td><button type="button" class="btn-sm btn-detail btn-activate-users-toggle" data-date="' +
            esc(row.date) +
            '">查看用户</button></td>';
        dh += '</tr>';
        dh +=
            '<tr id="activate_users_row_' +
            dk +
            '" class="activate-users-detail-row" style="display:none;"><td colspan="9"><div id="activate_users_box_' +
            dk +
            '" class="activate-users-box">点击「查看用户」加载列表…</div></td></tr>';
    });
    document.getElementById('activateEventsDailyTbody').innerHTML =
        dh || '<tr><td colspan="9">暂无数据</td></tr>';
}

function dauDateDomKey(dateStr) {
    return String(dateStr || '').replace(/[^0-9]/g, '');
}

function normalizeDauUserRow(item) {
    if (item != null && typeof item === 'object' && item.username != null) {
        return {
            username: String(item.username),
            has_tax_records: !!(item.has_tax_records === true || item.has_tax_records === 1),
            tax_modified_on_date: !!(
                item.tax_modified_on_date === true || item.tax_modified_on_date === 1
            )
        };
    }
    return {
        username: String(item == null ? '' : item),
        has_tax_records: false,
        tax_modified_on_date: false
    };
}

function dauTaxBadgeHtml(user) {
    if (user.tax_modified_on_date) {
        return '<span class="dau-tax-badge modified-today">当日修改个税</span>';
    }
    if (user.has_tax_records) {
        return '<span class="dau-tax-badge has-records">有个税记录</span>';
    }
    return '';
}

function renderDauUsersPanel(box, dateStr, data) {
    if (!box) return;
    var rawUsers = Array.isArray(data.users)
        ? data.users
        : Array.isArray(data.usernames)
          ? data.usernames
          : [];
    var users = rawUsers.map(normalizeDauUserRow);
    var page = Number(data.page) || 1;
    var total = Number(data.total) || 0;
    var totalPages = Math.max(1, Number(data.total_pages) || Math.ceil(total / DAU_USERS_PAGE_LIMIT) || 1);
    var modifiedOnPage = users.filter(function (u) {
        return u.tax_modified_on_date;
    }).length;
    var hasRecordsOnPage = users.filter(function (u) {
        return u.has_tax_records;
    }).length;
    box.setAttribute('data-date', dateStr);
    box.setAttribute('data-page', String(page));
    box.setAttribute('data-loaded', '1');

    var html = '<div class="dau-users-panel">';
    html +=
        '<div class="dau-users-title">' +
        esc(dateStr) +
        ' 活跃用户账号（共 ' +
        total +
        ' 个；本页 ' +
        modifiedOnPage +
        ' 个当日修改个税，' +
        hasRecordsOnPage +
        ' 个有个税记录）</div>';
    if (!users.length) {
        html += '<div class="dau-users-list">暂无账号</div>';
    } else {
        html += '<div class="dau-users-list">';
        users.forEach(function (u, idx) {
            var n = (page - 1) * DAU_USERS_PAGE_LIMIT + idx + 1;
            var badge = dauTaxBadgeHtml(u);
            html += '<div class="dau-user-item">';
            html += '<span class="dau-user-name">' + n + '. ' + esc(u.username) + '</span>';
            if (badge) html += badge;
            html += '</div>';
        });
        html += '</div>';
    }
    html += '<div class="pagination">';
    html +=
        '<button type="button" class="btn-page dau-users-prev" data-date="' +
        esc(dateStr) +
        '"' +
        (page <= 1 ? ' disabled' : '') +
        '>上一页</button>';
    html += '<span>第 ' + page + ' / ' + totalPages + ' 页</span>';
    html +=
        '<button type="button" class="btn-page dau-users-next" data-date="' +
        esc(dateStr) +
        '"' +
        (page >= totalPages ? ' disabled' : '') +
        '>下一页</button>';
    html += '</div></div>';
    box.innerHTML = html;
}

function loadDauUsersPage(dateStr, page, box) {
    if (!box || !dateStr) return;
    box.removeAttribute('data-loaded');
    box.innerHTML = '<div class="dau-users-panel" style="color:#888;">加载中…</div>';
    adminFetch(
        'api/admin/analytics/dau-users?date=' +
            encodeURIComponent(dateStr) +
            '&page=' +
            encodeURIComponent(String(page || 1)) +
            '&limit=' +
            DAU_USERS_PAGE_LIMIT
    )
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                box.innerHTML =
                    '<div class="dau-users-panel" style="color:#c00;">' + esc(j.msg || '加载失败') + '</div>';
                return;
            }
            renderDauUsersPanel(box, dateStr, j.data);
        })
        .catch(function () {
            box.innerHTML = '<div class="dau-users-panel" style="color:#c00;">网络错误</div>';
        });
}
