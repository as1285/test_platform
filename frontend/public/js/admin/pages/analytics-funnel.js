/* admin/pages/analytics-funnel.js — funnel & conversion */
var analyticsConvPage = 1;
var analyticsConvLimit = 10;
var analyticsConvCache = null;

function renderAnalyticsDailyConversion(data, page) {
    var el = document.getElementById('analyticsDailyConversion');
    if (!el) return;
    if (!data || !data.today) {
        analyticsConvCache = null;
        el.textContent = '转化率暂无数据';
        return;
    }
    analyticsConvCache = data;
    if (page != null) {
        analyticsConvPage = page;
    }
    var today = data.today;
    var todayKey = today.date || '';
    var rateText = today.rate_pct != null ? today.rate_pct : (today.registered > 0 ? '0.0%' : '—');
    var html = '<div class="analytics-conv-summary">';
    html += '<div class="conv-label">今日转化率（' + esc(todayKey) + '）</div>';
    html += '<div class="conv-today">' + esc(rateText) + '</div>';
    html += '<div class="conv-sub">激活 ' + esc(String(today.activated)) + ' / 注册 ' + esc(String(today.registered)) + '</div>';
    html += '</div>';

    var series = Array.isArray(data.series) ? data.series.slice() : [];
    series.reverse();
    var totalRows = series.length;
    var totalPages = Math.max(1, Math.ceil(totalRows / analyticsConvLimit) || 1);
    if (analyticsConvPage > totalPages) {
        analyticsConvPage = totalPages;
    }
    if (analyticsConvPage < 1) {
        analyticsConvPage = 1;
    }
    var start = (analyticsConvPage - 1) * analyticsConvLimit;
    var pageRows = series.slice(start, start + analyticsConvLimit);

    html += '<div class="scroll-x analytics-conv-table-wrap"><table><thead><tr>';
    html += '<th>日期</th><th>注册数</th><th>激活数</th><th>转化率</th>';
    html += '</tr></thead><tbody>';
    if (!pageRows.length) {
        html += '<tr><td colspan="4">暂无数据</td></tr>';
    } else {
        pageRows.forEach(function (row) {
            if (!row || !row.date) return;
            var pct = row.rate_pct != null ? row.rate_pct : (row.registered > 0 ? '0.0%' : '—');
            var isToday = row.date === todayKey;
            html += '<tr' + (isToday ? ' class="conv-row-today"' : '') + '>';
            html += '<td>' + esc(row.date) + (isToday ? ' <span style="color:#1677ff;font-size:12px;">今日</span>' : '') + '</td>';
            html += '<td>' + esc(String(row.registered != null ? row.registered : 0)) + '</td>';
            html += '<td>' + esc(String(row.activated != null ? row.activated : 0)) + '</td>';
            html += '<td class="conv-rate-cell">' + esc(pct) + '</td>';
            html += '</tr>';
        });
    }
    html += '</tbody></table>';
    if (totalRows > 0) {
        html +=
            '<div class="pagination analytics-conv-pagination">' +
            '<button type="button" class="btn-page" id="analyticsConvPrev"' +
            (analyticsConvPage <= 1 ? ' disabled' : '') +
            '>上一页</button>' +
            '<span id="analyticsConvPageInfo">第 ' +
            esc(String(analyticsConvPage)) +
            ' 页 / 共 ' +
            esc(String(totalPages)) +
            ' 页（共 ' +
            esc(String(totalRows)) +
            ' 天）</span>' +
            '<button type="button" class="btn-page" id="analyticsConvNext"' +
            (analyticsConvPage >= totalPages ? ' disabled' : '') +
            '>下一页</button>' +
            '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
}

function renderRegistrationFunnel(data) {
    var el = document.getElementById('analyticsRegistrationFunnel');
    if (!el) return;
    if (!data || !data.summary) {
        el.textContent = '漏斗暂无数据';
        return;
    }
    var s = data.summary;
    var cards = [
        { label: '注册用户', val: s.registered },
        { label: '7日内激活', val: (s.activated_7d || 0) + ' (' + (s.rate_activate_7d_pct || '—') + ')' },
        { label: '7日内有个税', val: (s.tax_7d || 0) + ' (' + (s.rate_tax_7d_pct || '—') + ')' },
        { label: '7日内看明细', val: (s.viewed_detail_7d || 0) + ' (' + (s.rate_detail_7d_pct || '—') + ')' }
    ];
    var html = '<div class="user-data-stats" style="margin-bottom:12px;">';
    cards.forEach(function (c) {
        html +=
            '<div class="user-data-stat-card"><div class="ud-label">' +
            esc(c.label) +
            '</div><div class="ud-val">' +
            esc(String(c.val != null ? c.val : '—')) +
            '</div></div>';
    });
    html += '</div>';
    html +=
        '<p class="hint" style="margin:0 0 10px;">激活→有个税 ' +
        esc(s.rate_tax_of_activated_pct || '—') +
        ' · 有个税→看明细 ' +
        esc(s.rate_detail_of_tax_pct || '—') +
        '</p>';
    var series = Array.isArray(data.series) ? data.series.slice().reverse() : [];
    html += '<div class="scroll-x"><table><thead><tr>';
    html +=
        '<th>注册日</th><th>注册</th><th>7日激活</th><th>7日个税</th><th>7日看明细</th><th>激活率</th><th>个税率</th></tr></thead><tbody>';
    if (!series.length) {
        html += '<tr><td colspan="7">暂无</td></tr>';
    } else {
        series.forEach(function (row) {
            html += '<tr>';
            html += '<td>' + esc(row.date || '—') + '</td>';
            html += '<td>' + esc(row.registered) + '</td>';
            html += '<td>' + esc(row.activated_7d) + '</td>';
            html += '<td>' + esc(row.tax_7d) + '</td>';
            html += '<td>' + esc(row.viewed_detail_7d) + '</td>';
            html += '<td>' + esc(row.rate_activate_7d_pct || '—') + '</td>';
            html += '<td>' + esc(row.rate_tax_7d_pct || '—') + '</td>';
            html += '</tr>';
        });
    }
    html += '</tbody></table></div>';
    el.innerHTML = html;
}

function loadRegistrationFunnel() {
    var el = document.getElementById('analyticsRegistrationFunnel');
    if (!el) return;
    var daysEl = document.getElementById('analyticsFunnelDays');
    var days = daysEl ? parseInt(daysEl.value, 10) || 30 : 30;
    el.textContent = '漏斗加载中…';
    adminFetch('api/admin/analytics/registration-funnel?days=' + encodeURIComponent(days))
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                el.textContent = j.msg || '漏斗加载失败';
                return;
            }
            renderRegistrationFunnel(j.data);
        })
        .catch(function () {
            el.textContent = '漏斗加载失败';
        });
}

function renderChannelRegistrationFunnel(data) {
    var el = document.getElementById('analyticsChannelFunnel');
    if (!el) return;
    var items = Array.isArray(data && data.items) ? data.items : [];
    if (!items.length) {
        el.textContent = '暂无渠道漏斗数据';
        return;
    }
    var html = '<div class="scroll-x"><table><thead><tr>';
    html +=
        '<th>注册渠道</th><th>注册</th><th>7日激活</th><th>7日个税</th><th>7日看明细</th><th>激活率</th><th>个税率</th></tr></thead><tbody>';
    items.forEach(function (row) {
        html += '<tr>';
        html += '<td>' + esc(row.channel_label || row.channel || '—') + '</td>';
        html += '<td>' + esc(row.registered) + '</td>';
        html += '<td>' + esc(row.activated_7d) + '</td>';
        html += '<td>' + esc(row.tax_7d) + '</td>';
        html += '<td>' + esc(row.viewed_detail_7d) + '</td>';
        html += '<td>' + esc(row.rate_activate_7d_pct || '—') + '</td>';
        html += '<td>' + esc(row.rate_tax_7d_pct || '—') + '</td>';
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
}

function loadChannelRegistrationFunnel() {
    var el = document.getElementById('analyticsChannelFunnel');
    if (!el) return;
    var daysEl = document.getElementById('analyticsChannelFunnelDays');
    var days = daysEl ? parseInt(daysEl.value, 10) || 30 : 30;
    el.textContent = '渠道漏斗加载中…';
    adminFetch('api/admin/analytics/channel-registration-funnel?days=' + encodeURIComponent(days))
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                el.textContent = j.msg || '渠道漏斗加载失败';
                return;
            }
            renderChannelRegistrationFunnel(j.data);
        })
        .catch(function () {
            el.textContent = '渠道漏斗加载失败';
        });
}

function renderInstallTrackStats(data) {
    var el = document.getElementById('analyticsInstallTrack');
    if (!el) return;
    var items = Array.isArray(data && data.items) ? data.items : [];
    if (!items.length) {
        el.textContent = '暂无安装埋点数据';
        return;
    }
    var html = '<div class="scroll-x"><table><thead><tr><th>事件</th><th>次数</th></tr></thead><tbody>';
    items.forEach(function (row) {
        html += '<tr><td>' + esc(row.label || row.route_key) + '</td><td>' + esc(row.total) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
}

function loadInstallTrackStats() {
    var el = document.getElementById('analyticsInstallTrack');
    if (!el) return;
    var daysEl = document.getElementById('analyticsInstallTrackDays');
    var days = daysEl ? parseInt(daysEl.value, 10) || 30 : 30;
    el.textContent = '安装埋点加载中…';
    adminFetch('api/admin/analytics/install-track-stats?days=' + encodeURIComponent(days))
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                el.textContent = j.msg || '安装埋点加载失败';
                return;
            }
            renderInstallTrackStats(j.data);
        })
        .catch(function () {
            el.textContent = '安装埋点加载失败';
        });
}

function renderConversionKpis(data) {
    var el = document.getElementById('analyticsConversionKpis');
    if (!el) return;
    if (!data) {
        el.textContent = '暂无 KPI 数据';
        return;
    }
    var html = '<div class="scroll-x"><table><tbody>';
    html +=
        '<tr><th style="text-align:left;padding:8px;">统计天数</th><td>' +
        esc(data.days) +
        '</td></tr>';
    html +=
        '<tr><th style="text-align:left;padding:8px;">窗口内激活用户数</th><td>' +
        esc(data.activated_in_window) +
        '</td></tr>';
    html +=
        '<tr><th style="text-align:left;padding:8px;">激活后 7 日内有个税</th><td>' +
        esc(data.tax_within_7d_after_activate) +
        '（' +
        esc(data.rate_tax_after_activate_7d_pct || '—') +
        '）</td></tr>';
    html +=
        '<tr><th style="text-align:left;padding:8px;">窗口内首次有个税用户</th><td>' +
        esc(data.users_with_first_tax_in_window) +
        '</td></tr>';
    html +=
        '<tr><th style="text-align:left;padding:8px;">有个税后 7 日内看明细</th><td>' +
        esc(data.viewed_detail_within_7d_after_tax) +
        '（' +
        esc(data.rate_detail_after_tax_7d_pct || '—') +
        '）</td></tr>';
    html += '</tbody></table></div>';
    el.innerHTML = html;
}

function loadConversionKpis() {
    var el = document.getElementById('analyticsConversionKpis');
    if (!el) return;
    var daysEl = document.getElementById('analyticsConversionKpiDays');
    var days = daysEl ? parseInt(daysEl.value, 10) || 30 : 30;
    el.textContent = 'KPI 加载中…';
    adminFetch('api/admin/analytics/conversion-kpis?days=' + encodeURIComponent(days))
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                el.textContent = j.msg || 'KPI 加载失败';
                return;
            }
            renderConversionKpis(j.data);
        })
        .catch(function () {
            el.textContent = 'KPI 加载失败';
        });
}

var pendingActivate24hPage = 1;

function renderPendingActivate24h(data) {
    var el = document.getElementById('analyticsPendingActivate24h');
    if (!el) return;
    var items = Array.isArray(data && data.items) ? data.items : [];
    var total = data && data.total != null ? Number(data.total) : 0;
    if (!items.length) {
        el.textContent = '暂无注册超 24h 未激活用户';
        return;
    }
    var html = '<p class="hint" style="margin:0 0 8px;">共 ' + esc(total) + ' 人（本页 ' + items.length + '）</p>';
    html += '<div class="scroll-x"><table><thead><tr>';
    html +=
        '<th>账号</th><th>姓名</th><th>注册时间</th><th>渠道</th><th>注册后小时</th></tr></thead><tbody>';
    items.forEach(function (row) {
        html += '<tr>';
        html += '<td>' + esc(row.username) + '</td>';
        html += '<td>' + esc(row.real_name || '—') + '</td>';
        html += '<td>' + esc(row.created_at || '—') + '</td>';
        html += '<td>' + esc(row.register_source_channel || '—') + '</td>';
        html += '<td>' + esc(row.hours_since_register) + '</td>';
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    if (total > items.length) {
        html +=
            '<p class="hint" style="margin-top:8px;">仅展示第 1 页；共 ' +
            Math.ceil(total / (data.page_size || 30)) +
            ' 页可翻页扩展。</p>';
    }
    el.innerHTML = html;
}

function loadPendingActivate24h(page) {
    var el = document.getElementById('analyticsPendingActivate24h');
    if (!el) return;
    pendingActivate24hPage = page || 1;
    el.textContent = '列表加载中…';
    adminFetch(
        'api/admin/users/pending-activate-24h?page=' +
            encodeURIComponent(pendingActivate24hPage) +
            '&page_size=30'
    )
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                el.textContent = j.msg || '列表加载失败';
                return;
            }
            renderPendingActivate24h(j.data);
        })
        .catch(function () {
            el.textContent = '列表加载失败';
        });
}

var NO_TAX_OUTREACH_SCRIPTS = [
    {
        title: '温和提醒（已激活未填税）',
        text: '您好，看到您已激活账号但还没添加个税演示数据。在 APP「我要咨询」→ 税务记录里点「示例填写」，约 30 秒即可生成，然后在「收入纳税明细」查看效果。如需激活码或操作帮助请回复我。'
    },
    {
        title: '针对逛过明细页',
        text: '您好，您已打开过收入纳税明细，当前还没有演示数据。请进入「我要咨询」→「示例填写」→「一键生成税务记录」，生成后刷新明细即可看到完整效果。'
    },
    {
        title: '未激活用户',
        text: '您好，您的账号尚未激活。请在「我的」页点击「激活」输入激活码；若无激活码可通过闲鱼购买或添加客服 QQ 获取。激活后即可填写个税演示数据。'
    }
];

function renderNoTaxScriptTemplates() {
    var wrap = document.getElementById('udNoTaxScriptTemplates');
    if (!wrap) return;
    var html = '';
    NO_TAX_OUTREACH_SCRIPTS.forEach(function (item, idx) {
        html +=
            '<div style="margin-bottom:12px;padding:10px 12px;background:#fff;border-radius:8px;border:1px solid #e8eef5;">';
        html += '<div style="font-weight:600;margin-bottom:6px;">' + esc(item.title) + '</div>';
        html +=
            '<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#444;white-space:pre-wrap;">' +
            esc(item.text) +
            '</p>';
        html +=
            '<button type="button" class="btn-page btn-copy-no-tax-script" data-idx="' +
            idx +
            '">复制话术</button></div>';
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('.btn-copy-no-tax-script').forEach(function (btn) {
        btn.onclick = function () {
            var i = parseInt(btn.getAttribute('data-idx'), 10);
            var t = NO_TAX_OUTREACH_SCRIPTS[i] ? NO_TAX_OUTREACH_SCRIPTS[i].text : '';
            if (!t) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(t).then(
                    function () {
                        alert('已复制到剪贴板');
                    },
                    function () {
                        alert(t);
                    }
                );
            } else {
                alert(t);
            }
        };
    });
}

function exportNoTaxBehaviorCsv() {
    adminFetch('api/admin/user-data/no-tax-behavior/export')
        .then(function (r) {
            if (!r.ok) throw new Error('export failed');
            return r.blob();
        })
        .then(function (blob) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'no_tax_users_' + new Date().toISOString().slice(0, 10) + '.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
        })
        .catch(function () {
            alert('导出失败，请稍后重试');
        });
}

function loadAnalyticsDailyConversion(resetPage) {
    var el = document.getElementById('analyticsDailyConversion');
    if (!el) return;
    if (resetPage !== false) {
        analyticsConvPage = 1;
    }
    var daysEl = document.getElementById('analyticsConversionDays');
    var days = daysEl ? parseInt(daysEl.value, 10) || 30 : 30;
    el.textContent = '转化率加载中…';
    adminFetch('api/admin/analytics/daily-conversion?days=' + encodeURIComponent(days))
        .then(function (r) { return r.json(); })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                analyticsConvCache = null;
                el.textContent = '转化率加载失败';
                return;
            }
            renderAnalyticsDailyConversion(j.data, analyticsConvPage);
        })
        .catch(function () {
            analyticsConvCache = null;
            el.textContent = '转化率加载失败';
        });
}
