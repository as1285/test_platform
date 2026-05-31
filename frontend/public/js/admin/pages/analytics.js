/* admin/pages/analytics.js — analytics dashboard part1 */
function loadAnalyticsDashboard() {
    loadAnalyticsDailyConversion();
    loadRegistrationFunnel();
    loadChannelRegistrationFunnel();
    loadInstallTrackStats();
    loadConversionKpis();
    loadPendingActivate24h(1);
    loadAnalyticsRegisterTime();
    loadAnalyticsRegisterGender();
    var daysO = parseInt(document.getElementById('analyticsOverviewDays').value, 10) || 14;
    document.getElementById('analyticsDauTbody').innerHTML = '<tr><td colspan="3">加载中…</td></tr>';
    document.getElementById('analyticsLoginTbody').innerHTML = '<tr><td colspan="3">加载中…</td></tr>';
    document.getElementById('analyticsLoginReasonTbody').innerHTML = '<tr><td colspan="2">加载中…</td></tr>';
    document.getElementById('analyticsEventsTbody').innerHTML = '<tr><td colspan="4">加载中…</td></tr>';
    var evtHintInit = document.getElementById('analyticsEventsHint');
    if (evtHintInit) evtHintInit.textContent = '加载中…';
    document.getElementById('deviceStatsOsTbody').innerHTML = '<tr><td colspan="3">加载中…</td></tr>';
    document.getElementById('deviceStatsModelTbody').innerHTML = '<tr><td colspan="3">加载中…</td></tr>';
    document.getElementById('deviceStatsSummary').textContent = '加载中…';
    destroyDeviceStatsCharts();
    var chartsWrapInit = document.getElementById('deviceStatsChartsWrap');
    if (chartsWrapInit) {
        chartsWrapInit.style.display = 'none';
    }
    renderDeviceStatsLegend([]);
    var _mHint = document.getElementById('deviceStatsModelHint');
    if (_mHint) {
        _mHint.textContent = '';
    }

    document.getElementById('activateEventsSummaryTbody').innerHTML =
        '<tr><td colspan="3">加载中…</td></tr>';
    document.getElementById('activateEventsDailyTbody').innerHTML =
        '<tr><td colspan="9">加载中…</td></tr>';
    var activateHintInit = document.getElementById('activateEventsHint');
    if (activateHintInit) {
        activateHintInit.textContent = '加载中…';
    }

    Promise.all([
        adminFetch('api/admin/analytics/overview?days=' + encodeURIComponent(daysO)).then(function (r) { return r.json(); }),
        adminFetch('api/admin/analytics/device-stats').then(function (r) { return r.json(); }),
        adminFetch('api/admin/analytics/events?days=' + encodeURIComponent(daysO)).then(function (r) { return r.json(); }),
        adminFetch('api/admin/analytics/activate-events?days=' + encodeURIComponent(daysO)).then(function (r) {
            return r.json();
        })
    ]).then(function (results) {
        var ov = results[0];
        var dev = results[1];
        var ev = results[2];
        var act = results[3];

        if (ov.code === 200 && ov.data && ov.data.dau) {
            var dh = '';
            ov.data.dau.forEach(function (row) {
                var dk = dauDateDomKey(row.date);
                dh += '<tr class="dau-summary-row">';
                dh += '<td>' + esc(row.date) + '</td>';
                dh += '<td>' + esc(String(row.active_users)) + '</td>';
                dh +=
                    '<td><button type="button" class="btn-sm btn-detail btn-dau-users-toggle" data-date="' +
                    esc(row.date) +
                    '">查看账号</button></td>';
                dh += '</tr>';
                dh +=
                    '<tr id="dau_users_row_' +
                    dk +
                    '" class="dau-users-detail-row" style="display:none;"><td colspan="3"><div id="dau_users_box_' +
                    dk +
                    '" class="dau-users-box">点击「查看账号」加载列表…</div></td></tr>';
            });
            document.getElementById('analyticsDauTbody').innerHTML = dh || '<tr><td colspan="3">暂无数据</td></tr>';
        } else {
            document.getElementById('analyticsDauTbody').innerHTML = '<tr><td colspan="3">' + esc(ov.msg || '加载失败') + '</td></tr>';
        }

        if (ov.code === 200 && ov.data && ov.data.logins) {
            var lh = '';
            ov.data.logins.forEach(function (row) {
                lh += '<tr><td>' + esc(row.date) + '</td><td>' + esc(String(row.success)) + '</td><td>' + esc(String(row.fail)) + '</td></tr>';
            });
            document.getElementById('analyticsLoginTbody').innerHTML = lh || '<tr><td colspan="3">暂无数据</td></tr>';
        } else {
            document.getElementById('analyticsLoginTbody').innerHTML = '<tr><td colspan="3">—</td></tr>';
        }
        if (ov.code === 200 && ov.data && Array.isArray(ov.data.fail_reasons)) {
            var rh2 = '';
            ov.data.fail_reasons.forEach(function (row) {
                rh2 +=
                    '<tr><td class="cell-break">' +
                    esc(row.reason_label || row.reason_key || '未知错误') +
                    '</td><td>' +
                    esc(String(row.cnt || 0)) +
                    '</td></tr>';
            });
            document.getElementById('analyticsLoginReasonTbody').innerHTML =
                rh2 || '<tr><td colspan="2">暂无失败记录</td></tr>';
        } else {
            document.getElementById('analyticsLoginReasonTbody').innerHTML = '<tr><td colspan="2">—</td></tr>';
        }
        if (act.code === 200 && act.data) {
            renderActivateEventsAnalytics(act.data);
        } else {
            document.getElementById('activateEventsSummaryTbody').innerHTML =
                '<tr><td colspan="3">' + esc((act && act.msg) || '加载失败') + '</td></tr>';
            document.getElementById('activateEventsDailyTbody').innerHTML =
                '<tr><td colspan="9">—</td></tr>';
            var actHintE = document.getElementById('activateEventsHint');
            if (actHintE) {
                actHintE.textContent = '激活埋点加载失败';
            }
        }

        if (ev.code === 200 && ev.data) {
            var eRows = Array.isArray(ev.data.top_events) ? ev.data.top_events : [];
            var eh = '';
            eRows.forEach(function (row) {
                var meta = parseTrackEventMeta(row.event_key || '');
                eh +=
                    '<tr><td>' +
                    esc(meta.button || '—') +
                    '</td><td>' +
                    esc(meta.page || '—') +
                    '</td><td class="cell-break"><code>' +
                    esc(row.event_key || '') +
                    '</code></td><td>' +
                    esc(String(row.total || 0)) +
                    '</td></tr>';
            });
            document.getElementById('analyticsEventsTbody').innerHTML = eh || '<tr><td colspan="4">暂无埋点数据</td></tr>';
            var evtHint = document.getElementById('analyticsEventsHint');
            if (evtHint) {
                var totalEvt = 0;
                eRows.forEach(function (r) { totalEvt += Number(r.total || 0); });
                evtHint.textContent = '共 ' + eRows.length + ' 个事件，累计 ' + totalEvt + ' 次。';
            }
        } else {
            document.getElementById('analyticsEventsTbody').innerHTML = '<tr><td colspan="4">' + esc((ev && ev.msg) || '加载失败') + '</td></tr>';
            var evtHintE = document.getElementById('analyticsEventsHint');
            if (evtHintE) evtHintE.textContent = '埋点统计加载失败';
        }

        if (dev.code === 200 && dev.data) {
            var totalDev = dev.data.total_devices != null ? Number(dev.data.total_devices) : 0;
            document.getElementById('deviceStatsSummary').textContent =
                '当前共有 ' + totalDev + ' 条设备指纹记录。';
            renderDeviceStatsLegend(dev.data.icon_summary || []);
            renderDeviceStatsCharts(dev.data);

            var osRows = dev.data.by_os || [];
            var oh = '';
            osRows.forEach(function (row) {
                var hint = row.icon_hint ? ' title="' + esc(row.icon_hint) + '"' : '';
                oh +=
                    '<tr' +
                    hint +
                    '><td>' +
                    statIconHtml(row.icon_key) +
                    '</td><td>' +
                    esc(row.label) +
                    '</td><td>' +
                    esc(String(row.count)) +
                    '</td></tr>';
            });
            document.getElementById('deviceStatsOsTbody').innerHTML =
                oh || '<tr><td colspan="3">暂无数据</td></tr>';

            var modelRows = dev.data.by_model || [];
            var maxModelRows = 40;
            var slice = modelRows.slice(0, maxModelRows);
            var mh = '';
            slice.forEach(function (row) {
                mh += deviceStatRowHtml(row);
            });
            document.getElementById('deviceStatsModelTbody').innerHTML =
                mh || '<tr><td colspan="3">暂无数据</td></tr>';
            var mhHint = document.getElementById('deviceStatsModelHint');
            if (mhHint) {
                if (modelRows.length > maxModelRows) {
                    mhHint.textContent =
                        '仅展示设备数前 ' +
                        maxModelRows +
                        ' 种机型（共 ' +
                        modelRows.length +
                        ' 种）。';
                } else {
                    mhHint.textContent = '';
                }
            }
        } else {
            renderDeviceStatsLegend([]);
            destroyDeviceStatsCharts();
            var chartsWrapFail = document.getElementById('deviceStatsChartsWrap');
            if (chartsWrapFail) {
                chartsWrapFail.style.display = 'none';
            }
            document.getElementById('deviceStatsSummary').textContent =
                esc(dev.msg || '设备分布加载失败');
            document.getElementById('deviceStatsOsTbody').innerHTML =
                '<tr><td colspan="3">—</td></tr>';
            document.getElementById('deviceStatsModelTbody').innerHTML =
                '<tr><td colspan="3">—</td></tr>';
            var mhHintE = document.getElementById('deviceStatsModelHint');
            if (mhHintE) {
                mhHintE.textContent = '';
            }
        }

    }).catch(function () {
        document.getElementById('analyticsDauTbody').innerHTML = '<tr><td colspan="3">网络错误</td></tr>';
        document.getElementById('analyticsLoginTbody').innerHTML = '<tr><td colspan="3">网络错误</td></tr>';
        document.getElementById('analyticsLoginReasonTbody').innerHTML = '<tr><td colspan="2">网络错误</td></tr>';
        document.getElementById('analyticsEventsTbody').innerHTML = '<tr><td colspan="4">网络错误</td></tr>';
        var evtHintErr = document.getElementById('analyticsEventsHint');
        if (evtHintErr) evtHintErr.textContent = '埋点统计加载失败（网络错误）';
        renderDeviceStatsLegend([]);
        destroyDeviceStatsCharts();
        var chartsWrapErr = document.getElementById('deviceStatsChartsWrap');
        if (chartsWrapErr) {
            chartsWrapErr.style.display = 'none';
        }
        document.getElementById('deviceStatsSummary').textContent = '设备分布加载失败（网络错误）';
        document.getElementById('deviceStatsOsTbody').innerHTML =
            '<tr><td colspan="3">网络错误</td></tr>';
        document.getElementById('deviceStatsModelTbody').innerHTML =
            '<tr><td colspan="3">网络错误</td></tr>';
        document.getElementById('activateEventsSummaryTbody').innerHTML =
            '<tr><td colspan="3">网络错误</td></tr>';
        document.getElementById('activateEventsDailyTbody').innerHTML =
            '<tr><td colspan="9">网络错误</td></tr>';
        var actHintErr = document.getElementById('activateEventsHint');
        if (actHintErr) {
            actHintErr.textContent = '激活埋点加载失败（网络错误）';
        }
    });
}
