/* admin/pages/user-data.js — user data */
function keyForUserData(username) {
    return String(username || '').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function destroyUdGenderCharts() {
    _udGenderChartInstances.forEach(function (c) {
        try {
            c.destroy();
        } catch (e0) {}
    });
    _udGenderChartInstances = [];
}

function chartColorAtIndex(index) {
    return DEVICE_CHART_FALLBACK[index % DEVICE_CHART_FALLBACK.length];
}

function renderUdGenderCharts(data) {
    destroyUdGenderCharts();
    var wrap = document.getElementById('userDataGenderChartsWrap');
    var grid = document.getElementById('userDataGenderChartsGrid');
    var emptyEl = document.getElementById('userDataGenderChartsEmpty');
    var summaryEl = document.getElementById('udGenderSummary');
    if (!wrap) return;

    wrap.style.display = 'block';
    var total = Number(data && data.total) || 0;
    var items = (data && data.items) || [];
    var male = items.find(function (it) {
        return it.key === 'male';
    });
    var female = items.find(function (it) {
        return it.key === 'female';
    });
    var maleCount = male ? Number(male.count) || 0 : 0;
    var femaleCount = female ? Number(female.count) || 0 : 0;
    var malePct = male && male.pct_text ? male.pct_text : '—';
    var femalePct = female && female.pct_text ? female.pct_text : '—';

    if (summaryEl) {
        var cards = [
            { label: '总人数', val: total + ' 人' },
            { label: '男', val: maleCount + ' 人' },
            { label: '女', val: femaleCount + ' 人' },
            { label: '男占比', val: malePct },
            { label: '女占比', val: femalePct }
        ];
        var sh = '';
        cards.forEach(function (c) {
            sh +=
                '<div class="user-data-stat-card"><div class="ud-label">' +
                esc(c.label) +
                '</div><div class="ud-val">' +
                esc(String(c.val != null ? c.val : '—')) +
                '</div></div>';
        });
        summaryEl.innerHTML = sh;
    }

    if (!total || typeof Chart === 'undefined') {
        if (grid) grid.style.display = 'none';
        if (emptyEl) {
            emptyEl.style.display = 'block';
            emptyEl.textContent =
                typeof Chart === 'undefined'
                    ? '图表库未加载，请刷新页面'
                    : '暂无用户性别数据';
        }
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    if (grid) grid.style.display = 'grid';

    var chartItems = items.filter(function (it) {
        return it.key === 'male' || it.key === 'female';
    });
    if (!chartItems.length) {
        chartItems = items;
    }
    var distLabels = chartItems.map(function (it) {
        return it.label;
    });
    var distCounts = chartItems.map(function (it) {
        return Number(it.count) || 0;
    });
    var distColors = chartItems.map(function (it) {
        return REGISTER_GENDER_CHART_COLORS[it.key] || chartColorAtIndex(0);
    });

    var barOpts = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }
        }
    };

    _udGenderChartInstances.push(
        new Chart(document.getElementById('udChartGenderBar'), {
            type: 'bar',
            data: {
                labels: distLabels,
                datasets: [
                    {
                        label: '用户数',
                        data: distCounts,
                        backgroundColor: distColors.map(function (c) {
                            return c + 'cc';
                        }),
                        borderColor: distColors,
                        borderWidth: 1
                    }
                ]
            },
            options: barOpts
        })
    );

    var pieLegend = {
        position: 'bottom',
        labels: { boxWidth: 12, padding: 8, font: { size: 11 } }
    };
    _udGenderChartInstances.push(
        new Chart(document.getElementById('udChartGenderPie'), {
            type: 'doughnut',
            data: {
                labels: distLabels,
                datasets: [
                    {
                        data: distCounts,
                        backgroundColor: distColors,
                        borderWidth: 1,
                        borderColor: '#fff'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: pieLegend,
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                var v = ctx.parsed || 0;
                                var pct = total ? ((v / total) * 100).toFixed(1) : '0';
                                return ' ' + ctx.label + ': ' + v + ' 人 (' + pct + '%)';
                            }
                        }
                    }
                }
            }
        })
    );
}

function destroyUdFemaleAgeCharts() {
    _udFemaleAgeChartInstances.forEach(function (c) {
        try {
            c.destroy();
        } catch (e0) {}
    });
    _udFemaleAgeChartInstances = [];
}

function renderUdFemaleAge(data) {
    destroyUdFemaleAgeCharts();
    var summaryEl = document.getElementById('udFemaleAgeSummary');
    var cardsEl = document.getElementById('udFemaleAgeSummaryCards');
    var tbody = document.getElementById('udFemaleUnder30Tbody');
    var grid = document.getElementById('udFemaleAgeChartsGrid');
    var emptyEl = document.getElementById('udFemaleAgeChartsEmpty');
    if (!summaryEl) return;

    var femaleTotal = Number(data && data.female_total) || 0;
    var underCount = Number(data && data.under_max_age_count) || 0;
    var withAge = Number(data && data.with_age_count) || 0;
    var noAge = Number(data && data.no_age_count) || 0;
    var filterLabel = (data && data.filter_label) || '未满30岁';

    if (!femaleTotal) {
        summaryEl.textContent = (data && data.scope_label) || '女性用户' + '：暂无数据。';
        if (cardsEl) cardsEl.innerHTML = '';
        if (tbody) tbody.innerHTML = '<tr><td colspan="5">暂无女性用户</td></tr>';
        if (grid) grid.style.display = 'none';
        if (emptyEl) {
            emptyEl.style.display = 'block';
            emptyEl.textContent = '暂无女性用户';
        }
        return;
    }

    summaryEl.textContent =
        (data.scope_label || '') +
        '，共 ' +
        femaleTotal +
        ' 人；已解析年龄 ' +
        withAge +
        ' 人，未知 ' +
        noAge +
        ' 人；' +
        filterLabel +
        ' ' +
        underCount +
        ' 人（占女性 ' +
        (data.under_max_age_pct_text || '—') +
        '）。';

    if (cardsEl) {
        var cards = [
            { label: '女性总数', val: femaleTotal + ' 人', hi: false },
            { label: filterLabel, val: underCount + ' 人', hi: true },
            { label: '占女性比例', val: data.under_max_age_pct_text || '—', hi: true },
            { label: '有年龄资料', val: withAge + ' 人', hi: false },
            { label: '年龄未知', val: noAge + ' 人', hi: false }
        ];
        cardsEl.innerHTML = cards
            .map(function (c) {
                return (
                    '<div class="user-data-stat-card' +
                    (c.hi ? ' gender-female-highlight' : '') +
                    '"><div class="ud-label">' +
                    esc(c.label) +
                    '</div><div class="ud-val">' +
                    esc(String(c.val)) +
                    '</div></div>'
                );
            })
            .join('');
    }

    var list = (data && data.under_max_age_users) || [];
    if (tbody) {
        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="5">暂无' + esc(filterLabel) + '的女性用户</td></tr>';
        } else {
            tbody.innerHTML = list
                .map(function (u) {
                    var src =
                        u.birth_source === 'tax_id'
                            ? '税号'
                            : u.birth_source === 'profile'
                              ? '资料'
                              : '—';
                    return (
                        '<tr><td>' +
                        esc(u.username) +
                        '</td><td>' +
                        esc(u.real_name || '—') +
                        '</td><td>' +
                        esc(String(u.age)) +
                        '</td><td>' +
                        esc(u.birth_date || '—') +
                        '</td><td>' +
                        esc(src) +
                        '</td></tr>'
                    );
                })
                .join('');
        }
    }

    var buckets = (data && data.age_buckets) || [];
    var chartBuckets = buckets.filter(function (b) {
        return Number(b.count) > 0;
    });
    if (!chartBuckets.length || typeof Chart === 'undefined') {
        if (grid) grid.style.display = 'none';
        if (emptyEl) {
            emptyEl.style.display = 'block';
            emptyEl.textContent =
                typeof Chart === 'undefined'
                    ? '图表库未加载'
                    : '暂无足够年龄数据生成图表';
        }
        return;
    }
    if (emptyEl) emptyEl.style.display = 'none';
    if (grid) grid.style.display = 'grid';

    var labels = chartBuckets.map(function (b) {
        return b.label;
    });
    var counts = chartBuckets.map(function (b) {
        return Number(b.count) || 0;
    });
    var colors = chartBuckets.map(function (b) {
        return FEMALE_AGE_CHART_COLORS[b.key] || chartColorAtIndex(0);
    });

    _udFemaleAgeChartInstances.push(
        new Chart(document.getElementById('udChartFemaleAgeBar'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '人数',
                        data: counts,
                        backgroundColor: colors.map(function (c) {
                            return c + 'cc';
                        }),
                        borderColor: colors,
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }
                }
            }
        })
    );
}

function isUdGenderSectionOpen() {
    var el = document.getElementById('udGenderSection');
    return !!(el && el.open);
}

function isUdFemaleAgeSectionOpen() {
    var el = document.getElementById('udFemaleAgeSection');
    return !!(el && el.open);
}

function loadUdFemaleAge() {
    var daysEl = document.getElementById('udGenderDays');
    var days = daysEl ? String(daysEl.value) : '0';
    var summaryEl = document.getElementById('udFemaleAgeSummary');
    var tbody = document.getElementById('udFemaleUnder30Tbody');
    if (summaryEl) summaryEl.textContent = '加载中…';
    if (tbody) tbody.innerHTML = '<tr><td colspan="5">加载中…</td></tr>';
    destroyUdFemaleAgeCharts();
    adminFetch('api/admin/user-data/female-age?days=' + encodeURIComponent(days) + '&max_age=30')
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                if (summaryEl) summaryEl.textContent = j.msg || '女性年龄分析加载失败';
                if (tbody) tbody.innerHTML = '<tr><td colspan="5">加载失败</td></tr>';
                return;
            }
            renderUdFemaleAge(j.data);
        })
        .catch(function () {
            if (summaryEl) summaryEl.textContent = '女性年龄分析加载失败';
            if (tbody) tbody.innerHTML = '<tr><td colspan="5">网络错误</td></tr>';
        });
}

function loadUdGenderCharts() {
    var wrap = document.getElementById('userDataGenderChartsWrap');
    var daysEl = document.getElementById('udGenderDays');
    var days = daysEl ? String(daysEl.value) : '0';
    if (wrap) wrap.style.display = 'block';
    if (!isUdGenderSectionOpen()) return;
    if (isUdFemaleAgeSectionOpen()) {
        loadUdFemaleAge();
    }
    adminFetch('api/admin/analytics/register-gender?days=' + encodeURIComponent(days))
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                destroyUdGenderCharts();
                var emptyEl = document.getElementById('userDataGenderChartsEmpty');
                if (emptyEl) {
                    emptyEl.style.display = 'block';
                    emptyEl.textContent = j.msg || '性别分析加载失败';
                }
                return;
            }
            renderUdGenderCharts(j.data);
        })
        .catch(function () {
            destroyUdGenderCharts();
            var emptyEl = document.getElementById('userDataGenderChartsEmpty');
            if (emptyEl) {
                emptyEl.style.display = 'block';
                emptyEl.textContent = '性别分析加载失败';
            }
        });
}

function renderUserDataAnalytics(data) {
    var wrap = document.getElementById('userDataAnalytics');
    var tablesWrap = document.getElementById('userDataAnalyticsTables');
    if (!wrap || !data) return;
    var cards = [
        { label: '注册用户', val: data.total_users },
        { label: '有个税记录', val: data.users_with_tax_records },
        { label: '个税条数', val: data.total_tax_records },
        { label: '已填家人', val: data.users_with_family },
        { label: '已绑银行卡', val: data.users_with_bank },
        { label: '不同公司数', val: data.distinct_companies },
        { label: '税务机关数', val: data.distinct_tax_authorities }
    ];
    var html = '';
    cards.forEach(function (c) {
        html +=
            '<div class="user-data-stat-card"><div class="ud-label">' +
            esc(c.label) +
            '</div><div class="ud-val">' +
            esc(String(c.val != null ? c.val : '—')) +
            '</div></div>';
    });
    wrap.innerHTML = html;
    if (tablesWrap) tablesWrap.style.display = '';

    var buckTb = document.getElementById('userDataSalaryBucketsTbody');
    if (buckTb) {
        var bhtml = '';
        (data.salary_buckets || []).forEach(function (b) {
            var isHigh = b.label === '2万以上' || (b.min != null && Number(b.min) >= 20000);
            var rowCls = isHigh ? ' class="ud-salary-bucket-high"' : '';
            var extra = isHigh ? ' <span class="hint" style="font-weight:normal;">· 见下方图表</span>' : '';
            bhtml +=
                '<tr' +
                rowCls +
                '><td>' +
                esc(b.label) +
                extra +
                '</td><td>' +
                esc(b.count) +
                '</td></tr>';
        });
        buckTb.innerHTML = bhtml || '<tr><td colspan="2">暂无</td></tr>';
    }
    var genderWrap = document.getElementById('userDataGenderChartsWrap');
    if (genderWrap) genderWrap.style.display = 'block';
    if (isUdGenderSectionOpen()) {
        loadUdGenderCharts();
    }
    var compTb = document.getElementById('userDataTopCompaniesTbody');
    if (compTb) {
        var chtml = '';
        (data.top_companies || []).forEach(function (c) {
            chtml += '<tr><td class="cell-break">' + esc(c.name) + '</td><td>' + esc(c.user_count) + '</td></tr>';
        });
        compTb.innerHTML = chtml || '<tr><td colspan="2">暂无</td></tr>';
    }
    var authTb = document.getElementById('userDataTopAuthTbody');
    if (authTb) {
        var ahtml = '';
        (data.top_tax_authorities || []).forEach(function (a) {
            ahtml += '<tr><td class="cell-break">' + esc(a.name) + '</td><td>' + esc(a.count) + '</td></tr>';
        });
        authTb.innerHTML = ahtml || '<tr><td colspan="2">暂无</td></tr>';
    }
}

var noTaxBehaviorPage = 1;
var noTaxBehaviorLimit = 20;

function renderNoTaxBehaviorSummary(summary) {
    var wrap = document.getElementById('udNoTaxSummary');
    if (!wrap || !summary) return;
    var cards = [
        { label: '未填个税用户', val: summary.total_no_tax_users },
        { label: '有页面行为', val: summary.with_page_activity },
        { label: '无页面行为', val: summary.without_page_activity },
        { label: '活跃户均停留', val: summary.avg_stay_label || '—' }
    ];
    var html = '';
    cards.forEach(function (c) {
        html +=
            '<div class="user-data-stat-card"><div class="ud-label">' +
            esc(c.label) +
            '</div><div class="ud-val">' +
            esc(String(c.val != null ? c.val : '—')) +
            '</div></div>';
    });
    wrap.innerHTML = html;
}

function renderNoTaxBehaviorTopPages(topPages) {
    var tb = document.getElementById('udNoTaxTopPagesTbody');
    if (!tb) return;
    if (!topPages || !topPages.length) {
        tb.innerHTML = '<tr><td colspan="2">暂无</td></tr>';
        return;
    }
    var html = '';
    topPages.forEach(function (p) {
        html += '<tr><td>' + esc(p.title || '—') + '</td><td>' + esc(p.hit_count) + '</td></tr>';
    });
    tb.innerHTML = html;
}

function buildNoTaxPathDetailHtml(username, data) {
    var metrics = data.metrics || {};
    var timeline = data.timeline || [];
    var html = '<div class="user-detail-wrap" style="margin:0;">';
    html +=
        '<div class="user-detail-title">行为路径 · ' +
        esc(username) +
        '</div>';
    html +=
        '<div style="margin-bottom:10px;padding:10px 12px;background:#f8fbff;border-radius:8px;font-size:13px;">停留：<strong>' +
        esc(metrics.stay_label || '—') +
        '</strong> · 活跃 ' +
        esc(metrics.active_days) +
        ' 天 · 行为 ' +
        esc(metrics.event_count) +
        ' 次 · 访问 ' +
        esc(metrics.distinct_page_count) +
        ' 个页面</div>';
    if (!timeline.length) {
        html += '<div style="color:#999;">暂无页面行为流水</div>';
    } else {
        html +=
            '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>#</th><th>时间</th><th>中文标题</th><th>接口名</th></tr></thead><tbody>';
        timeline.forEach(function (step) {
            html += '<tr>';
            html += '<td>' + esc(step.step) + '</td>';
            html += '<td>' + esc(step.at ? formatDt(step.at) : '—') + '</td>';
            html += '<td>' + esc(step.title || '—') + '</td>';
            html += '<td class="cell-break"><code>' + esc(formatPageRouteKey(step.route_key)) + '</code></td>';
            html += '</tr>';
        });
        html += '</tbody></table></div>';
    }
    html += '</div>';
    return html;
}

function loadNoTaxBehaviorList(p) {
    if (p != null) noTaxBehaviorPage = p;
    var stat = document.getElementById('udNoTaxListStat');
    var tbody = document.getElementById('udNoTaxBehaviorTbody');
    if (stat) stat.textContent = '加载中…';
    if (tbody) tbody.innerHTML = '<tr><td colspan="9">加载中…</td></tr>';
    adminFetch(
        'api/admin/user-data/no-tax-behavior?page=' +
            noTaxBehaviorPage +
            '&limit=' +
            noTaxBehaviorLimit
    )
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                if (stat) stat.textContent = j.msg || '加载失败';
                if (tbody) tbody.innerHTML = '<tr><td colspan="9">' + esc(j.msg || '加载失败') + '</td></tr>';
                return;
            }
            var d = j.data;
            renderNoTaxBehaviorSummary(d.summary || {});
            renderNoTaxBehaviorTopPages(d.top_pages || []);
            var total = d.total || 0;
            if (stat) stat.textContent = '未填个税用户 ' + total + ' 人（本页 ' + (d.items || []).length + ' 人）';
            var totalPages = Math.ceil(total / noTaxBehaviorLimit) || 1;
            var pageInfo = document.getElementById('udNoTaxPageInfo');
            if (pageInfo) {
                pageInfo.textContent = '第 ' + noTaxBehaviorPage + ' 页 / 共 ' + totalPages + ' 页';
            }
            var prevBtn = document.getElementById('udNoTaxPrev');
            var nextBtn = document.getElementById('udNoTaxNext');
            if (prevBtn) prevBtn.disabled = noTaxBehaviorPage <= 1;
            if (nextBtn) nextBtn.disabled = noTaxBehaviorPage >= totalPages;
            var html = '';
            (d.items || []).forEach(function (row) {
                var key = keyForUser(row.username);
                html += '<tr>';
                html += '<td class="cell-break"><code>' + esc(row.username) + '</code></td>';
                html += '<td>' + esc(row.real_name || '—') + '</td>';
                html += '<td>' + esc(row.created_at ? formatDt(row.created_at) : '—') + '</td>';
                html += '<td>' + esc(row.stay_label || '无记录') + '</td>';
                html += '<td>' + esc(row.active_days != null ? row.active_days : 0) + '</td>';
                html += '<td>' + esc(row.distinct_page_count != null ? row.distinct_page_count : 0) + '</td>';
                html += '<td class="cell-break" style="font-size:12px;color:#555;">' + esc(row.path_summary || '—') + '</td>';
                html += '<td>' + esc(row.last_at ? formatDt(row.last_at) : '—') + '</td>';
                html +=
                    '<td class="col-ops"><button type="button" class="btn-sm btn-detail btn-no-tax-path" data-u="' +
                    esc(row.username) +
                    '" data-k="' +
                    key +
                    '">路径</button></td>';
                html += '</tr>';
                html += '<tr id="ud_notax_path_row_' + key + '" class="users-detail-row" style="display:none;">';
                html +=
                    '<td colspan="9"><div id="ud_notax_path_box_' +
                    key +
                    '">加载中…</div></td></tr>';
            });
            if (tbody) {
                tbody.innerHTML = html || '<tr><td colspan="9">暂无未填个税用户</td></tr>';
                tbody.querySelectorAll('.btn-no-tax-path').forEach(function (btn) {
                    btn.onclick = function () {
                        var name = btn.getAttribute('data-u');
                        var key = btn.getAttribute('data-k');
                        var row = document.getElementById('ud_notax_path_row_' + key);
                        var box = document.getElementById('ud_notax_path_box_' + key);
                        if (!row || !box) return;
                        var opening = row.style.display === 'none';
                        if (!opening) {
                            row.style.display = 'none';
                            btn.textContent = '路径';
                            return;
                        }
                        row.style.display = '';
                        btn.textContent = '收起';
                        box.textContent = '加载中…';
                        adminFetch(
                            'api/admin/user-data/no-tax-behavior/path?username=' +
                                encodeURIComponent(name)
                        )
                            .then(function (r) {
                                return r.json();
                            })
                            .then(function (d) {
                                if (d.code !== 200 || !d.data) {
                                    box.textContent = d.msg || '加载失败';
                                    return;
                                }
                                box.innerHTML = buildNoTaxPathDetailHtml(name, d.data);
                            })
                            .catch(function () {
                                box.textContent = '网络错误';
                            });
                    };
                });
            }
        })
        .catch(function () {
            if (stat) stat.textContent = '加载失败';
            if (tbody) tbody.innerHTML = '<tr><td colspan="9">加载失败</td></tr>';
        });
}

function loadUserDataAnalytics() {
    var wrap = document.getElementById('userDataAnalytics');
    if (wrap) wrap.textContent = '分析数据加载中…';
    destroyUdGenderCharts();
    destroyUdFemaleAgeCharts();
    adminFetch('api/admin/user-data/analytics')
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                if (wrap) wrap.textContent = j.msg || '分析加载失败';
                return;
            }
            renderUserDataAnalytics(j.data);
        })
        .catch(function () {
            if (wrap) wrap.textContent = '分析加载失败';
        });
}

function buildUserDataDetailHtml(username, data) {
    var html = '<div class="user-detail-wrap">';
    html += '<div class="user-detail-title">账号「' + esc(username) + '」数据档案</div>';
    var srcLabel =
        data.channel_analysis_label ||
        (data.user && data.user.channel_analysis_label) ||
        (data.user && data.user.register_source_channel_label) ||
        data.register_source_channel_label ||
        '—';
    html +=
        '<div style="margin-bottom:10px;padding:10px 12px;background:#f8fbff;border-radius:8px;">渠道分析：<strong>' +
        esc(srcLabel) +
        '</strong> · 近六个月平均工资：<strong>' +
        esc(data.avg_salary_6m_label || '未填写') +
        '</strong></div>';

    html += '<div style="margin:8px 0;color:#666;">扣缴义务人 / 公司（' + (data.companies || []).length + '）</div>';
    if (!(data.companies || []).length) {
        html += '<div style="color:#999;margin-bottom:10px;">暂无</div>';
    } else {
        html += '<div class="scroll-x"><table class="user-detail-table"><tbody>';
        (data.companies || []).forEach(function (c) {
            html += '<tr><td class="cell-break">' + esc(c) + '</td></tr>';
        });
        html += '</tbody></table></div>';
    }

    if ((data.employers || []).length) {
        html += '<div style="margin:10px 0 6px;color:#666;">任职受雇（' + data.employers.length + '）</div>';
        html += '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>公司</th><th>信用代码</th><th>岗位</th><th>入职</th></tr></thead><tbody>';
        data.employers.forEach(function (e) {
            html += '<tr>';
            html += '<td class="cell-break">' + esc(e.company_name || '—') + '</td>';
            html += '<td class="cell-break">' + esc(e.credit_code || '—') + '</td>';
            html += '<td>' + esc(e.position || '—') + '</td>';
            html += '<td>' + esc(e.hire_date || '—') + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table></div>';
    }

    var idCard =
        (data.user && (data.user.id_card || data.user.id_card_label)) ||
        data.id_card ||
        data.id_card_label ||
        '';
    html += '<div style="margin:10px 0 6px;color:#666;">身份证号</div>';
    html += '<div class="scroll-x"><table class="user-detail-table"><tbody>';
    html += '<tr><td class="cell-break"><code>' + esc(idCard || '未填写') + '</code></td></tr>';
    html += '</tbody></table></div>';

    html += '<div style="margin:10px 0 6px;color:#666;">税务机关（' + (data.tax_authorities || []).length + '）</div>';
    html += '<div class="scroll-x"><table class="user-detail-table"><tbody>';
    (data.tax_authorities || []).forEach(function (t) {
        html += '<tr><td class="cell-break">' + esc(t) + '</td></tr>';
    });
    if (!(data.tax_authorities || []).length) {
        html += '<tr><td>—</td></tr>';
    }
    html += '</tbody></table></div>';

    html += '<div style="margin:10px 0 6px;color:#666;">家人信息（' + (data.family_members || []).length + '）</div>';
    if (!(data.family_members || []).length) {
        html += '<div style="color:#999;margin-bottom:10px;">未填写</div>';
    } else {
        html +=
            '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>姓名</th><th>关系</th><th>证件类型</th><th>证件号</th><th>出生日期</th></tr></thead><tbody>';
        (data.family_members || []).forEach(function (f) {
            html += '<tr>';
            html += '<td>' + esc(f.real_name || '—') + '</td>';
            html += '<td>' + esc(f.relation || '—') + '</td>';
            html += '<td>' + esc(f.id_type_label || '—') + '</td>';
            html += '<td class="cell-break"><code>' + esc(f.id_no || '—') + '</code></td>';
            html += '<td>' + esc(f.birth_date || '—') + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table></div>';
    }

    html += '<div style="margin:10px 0 6px;color:#666;">银行卡（' + (data.bank_cards || []).length + '）</div>';
    if (!(data.bank_cards || []).length) {
        html += '<div style="color:#999;margin-bottom:10px;">未绑定</div>';
    } else {
        html +=
            '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>卡号</th><th>银行</th><th>省份</th><th>预留手机</th></tr></thead><tbody>';
        (data.bank_cards || []).forEach(function (b) {
            html += '<tr>';
            html += '<td><code>' + esc(b.card_no_masked || '—') + '</code></td>';
            html += '<td>' + esc(b.bank_name || '—') + '</td>';
            html += '<td>' + esc(b.province || '—') + '</td>';
            html += '<td>' + esc(b.phone || '—') + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table></div>';
    }

    var latestIssue = data.latest_issue_application || null;
    html +=
        '<div style="margin:14px 0 6px;color:#666;">纳税记录凭证 <span style="color:#999;font-size:12px;">（按 C 端最近一次开具生成；管理端预览含公章）</span></div>';
    if (latestIssue && latestIssue.period_start && latestIssue.period_end) {
        html +=
            '<div style="margin:0 0 8px;padding:8px 10px;background:#fff7e6;border-radius:6px;font-size:13px;color:#614700;">C 端最近开具：' +
            esc(latestIssue.period_start) +
            ' 至 ' +
            esc(latestIssue.period_end) +
            (latestIssue.apply_time ? ' · 申请时间 ' + esc(latestIssue.apply_time) : '') +
            (latestIssue.record_no ? ' · 记录号 ' + esc(latestIssue.record_no) : '') +
            '</div>';
    } else {
        html +=
            '<div style="margin:0 0 8px;color:#999;font-size:13px;">该用户暂无 C 端开具上报记录，无法按用户端版本预览凭证。</div>';
    }
    html +=
        '<div class="ud-certificate-wrap" id="ud_certificate_' +
        esc(username).replace(/[^a-zA-Z0-9_-]/g, '_') +
        '">正在生成凭证预览…</div>';

    html += '<div style="margin:10px 0 6px;color:#666;">个税记录（' + (data.tax_records || []).length + ' 条）</div>';
    html += renderAdminTaxRecordsTable(data.tax_records || []);
    html += '</div>';
    return html;
}

function mountUserDataCertificate(username, data) {
    var safeKey = String(username || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    var el = document.getElementById('ud_certificate_' + safeKey);
    if (!el) return;
    var issue = data && data.latest_issue_application;
    if (!issue || !issue.period_start || !issue.period_end) {
        el.textContent = '暂无 C 端纳税记录开具记录（用户端生成成功后会自动上报）';
        return;
    }
    if (!data || !(data.tax_records || []).length) {
        el.textContent = '暂无个税记录，无法生成凭证预览';
        return;
    }
    if (!window.TaxIssueCertificate || typeof window.TaxIssueCertificate.renderDataUrl !== 'function') {
        el.textContent = '凭证组件未加载，请刷新页面';
        return;
    }
    try {
        var app = window.TaxIssueCertificate.buildAppFromAdminDetail(data);
        window.TaxIssueCertificate.renderDataUrl(app, { showStamp: true })
            .then(function (urlOrUrls) {
                var urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
                el.innerHTML = urls
                    .map(function (u, i) {
                        var gap = i < urls.length - 1 ? ' style="margin-bottom:12px"' : '';
                        return (
                            '<img src="' +
                            u +
                            '" alt="纳税记录凭证第' +
                            (i + 1) +
                            '页（管理端）" title="管理端预览含公章"' +
                            gap +
                            '>'
                        );
                    })
                    .join('');
            })
            .catch(function (err) {
                el.textContent = (err && err.message) || '凭证生成失败';
            });
    } catch (e) {
        el.textContent = (e && e.message) || '凭证生成失败';
    }
}

function loadUserDataList(p) {
    if (p != null) userDataPage = p;
    var stat = document.getElementById('userDataStat');
    var username = document.getElementById('udFilterUsername').value.trim();
    var realName = document.getElementById('udFilterRealName').value.trim();
    var company = document.getElementById('udFilterCompany').value.trim();
    var hasFamily = document.getElementById('udFilterFamily').value;
    var hasBank = document.getElementById('udFilterBank').value;
    var salaryMin = document.getElementById('udFilterSalaryMin').value.trim();
    var salaryMax = document.getElementById('udFilterSalaryMax').value.trim();

    var url =
        'api/admin/user-data?page=' +
        userDataPage +
        '&limit=' +
        userDataLimit;
    if (username) url += '&username=' + encodeURIComponent(username);
    if (realName) url += '&real_name=' + encodeURIComponent(realName);
    if (company) url += '&company=' + encodeURIComponent(company);
    if (hasFamily !== '') url += '&has_family=' + encodeURIComponent(hasFamily);
    if (hasBank !== '') url += '&has_bank=' + encodeURIComponent(hasBank);
    if (salaryMin !== '') url += '&salary_min=' + encodeURIComponent(salaryMin);
    if (salaryMax !== '') url += '&salary_max=' + encodeURIComponent(salaryMax);

    adminFetch(url)
        .then(function (r) {
            return r.json();
        })
        .then(function (data) {
            if (data.code !== 200 || !data.data) {
                if (stat) stat.textContent = data.msg || '加载失败';
                return;
            }
            var list = data.data.items || [];
            var total = data.data.total || 0;
            if (stat) stat.textContent = '共 ' + total + ' 条用户数据';
            var totalPages = Math.ceil(total / userDataLimit) || 1;
            document.getElementById('userDataPageInfo').textContent =
                '第 ' + userDataPage + ' 页 / 共 ' + totalPages + ' 页';
            document.getElementById('userDataPrev').disabled = userDataPage <= 1;
            document.getElementById('userDataNext').disabled = userDataPage >= totalPages;

            var html = '';
            list.forEach(function (row) {
                var key = keyForUserData(row.username);
                var fam =
                    row.family_count > 0
                        ? esc(row.family_summary) + ' <span style="color:#888;">(' + row.family_count + ')</span>'
                        : '<span style="color:#bbb;">未填写</span>';
                var bank =
                    row.bank_count > 0
                        ? esc(row.bank_summary) + ' <span style="color:#888;">(' + row.bank_count + ')</span>'
                        : '<span style="color:#bbb;">未绑定</span>';
                html += '<tr>';
                html += '<td class="cell-break">' + esc(row.username) + '</td>';
                html += '<td>' + esc(row.real_name || '—') + '</td>';
                html +=
                    '<td class="cell-break">' +
                    esc(row.channel_analysis_label || row.register_source_channel_label || '—') +
                    '</td>';
                html += '<td class="cell-break">' + esc(row.avg_salary_6m_label || '未填写') + '</td>';
                html += '<td class="cell-break">' + esc(row.companies_summary || '—') + '</td>';
                html +=
                    '<td class="cell-break">' +
                    esc(row.id_card_label || row.id_card || '未填写') +
                    '</td>';
                html += '<td class="cell-break">' + esc(row.tax_authorities_summary || '—') + '</td>';
                html += '<td class="cell-break">' + fam + '</td>';
                html += '<td class="cell-break">' + bank + '</td>';
                html += '<td>' + esc(row.tax_record_count) + '</td>';
                html +=
                    '<td class="col-ops"><button type="button" class="btn-sm btn-detail btn-user-data-detail" data-u="' +
                    esc(row.username) +
                    '" data-k="' +
                    key +
                    '">档案</button></td>';
                html += '</tr>';
                html += '<tr id="ud_detail_row_' + key + '" class="users-detail-row" style="display:none;">';
                html +=
                    '<td colspan="11"><div id="ud_detail_box_' +
                    key +
                    '" style="padding:4px 0;color:#888;">点击「档案」加载完整数据…</div></td>';
                html += '</tr>';
            });
            document.getElementById('userDataTbody').innerHTML =
                html || '<tr><td colspan="11">暂无数据</td></tr>';

            document.getElementById('userDataTbody').querySelectorAll('.btn-user-data-detail').forEach(function (btn) {
                btn.onclick = function () {
                    var name = btn.getAttribute('data-u');
                    var key = btn.getAttribute('data-k');
                    var row = document.getElementById('ud_detail_row_' + key);
                    var box = document.getElementById('ud_detail_box_' + key);
                    if (!row || !box) return;
                    var opening = row.style.display === 'none';
                    if (!opening) {
                        row.style.display = 'none';
                        btn.textContent = '档案';
                        return;
                    }
                    row.style.display = '';
                    btn.textContent = '收起';
                    box.textContent = '加载中…';
                    adminFetch('api/admin/user-data/detail?username=' + encodeURIComponent(name))
                        .then(function (r) {
                            return r.json();
                        })
                        .then(function (d) {
                            if (d.code !== 200 || !d.data) {
                                box.textContent = d.msg || '加载失败';
                                return;
                            }
                            box.innerHTML = buildUserDataDetailHtml(name, d.data);
                            mountUserDataCertificate(name, d.data);
                        })
                        .catch(function () {
                            box.textContent = '网络错误';
                        });
                };
            });
        })
        .catch(function () {
            if (stat) stat.textContent = '加载失败';
        });
}
