/* admin/core/charts.js — chart helpers */
var _deviceStatsChartInstances = [];
var _registerTimeChartInstances = [];
var _registerGenderChartInstances = [];
var _udGenderChartInstances = [];
var _udFemaleAgeChartInstances = [];
var FEMALE_AGE_CHART_COLORS = {
    u18: '#c4b5fd',
    '18_22': '#f9a8d4',
    '23_26': '#e91e8c',
    '27_29': '#db2777',
    '30p': '#9aa5b1',
    unknown: '#d1d5db'
};
var DEVICE_CHART_COLORS = {
    iphone: '#1c1c1e',
    ipad: '#5c5c5e',
    ios: '#1c1c1e',
    android: '#3ddc84',
    android_phone: '#3ddc84',
    xiaomi: '#ff6900',
    huawei: '#cf0a2c',
    honor: '#1e6fff',
    oppo: '#1ba784',
    vivo: '#415fff',
    samsung: '#1428a0',
    google: '#4285f4',
    windows: '#0078d4',
    windows_pc: '#0078d4',
    mac: '#555555',
    macos: '#555555',
    linux: '#333333',
    linux_pc: '#333333',
    chromeos: '#4285f4',
    chromebook: '#4285f4',
    other: '#9aa5b1'
};
var DEVICE_CHART_FALLBACK = [
    '#1e6fff', '#3ddc84', '#ff6900', '#cf0a2c', '#415fff', '#1428a0', '#0078d4', '#9aa5b1'
];

function destroyDeviceStatsCharts() {
    _deviceStatsChartInstances.forEach(function (c) {
        try {
            c.destroy();
        } catch (e0) {}
    });
    _deviceStatsChartInstances = [];
}

function destroyRegisterTimeCharts() {
    _registerTimeChartInstances.forEach(function (c) {
        try {
            c.destroy();
        } catch (e0) {}
    });
    _registerTimeChartInstances = [];
}

var REGISTER_TIME_PERIOD_COLORS = {
    morning: '#f5a623',
    afternoon: '#1e6fff',
    evening: '#6b4ce6'
};

var REGISTER_GENDER_CHART_COLORS = {
    male: '#1e6fff',
    female: '#e91e8c',
    unknown: '#9aa5b1'
};

function destroyRegisterGenderCharts() {
    _registerGenderChartInstances.forEach(function (c) {
        try {
            c.destroy();
        } catch (e0) {}
    });
    _registerGenderChartInstances = [];
}

function renderRegisterGenderAnalysis(data) {
    var summaryEl = document.getElementById('registerGenderSummary');
    var cardsEl = document.getElementById('registerGenderCards');
    var tbody = document.getElementById('registerGenderTbody');
    var chartsWrap = document.getElementById('registerGenderChartsWrap');
    var chartsEmpty = document.getElementById('registerGenderChartsEmpty');
    if (!summaryEl || !cardsEl || !tbody) return;

    destroyRegisterGenderCharts();
    if (chartsWrap) chartsWrap.style.display = 'none';
    if (chartsEmpty) chartsEmpty.style.display = 'none';

    var total = Number(data && data.total) || 0;
    var items = (data && data.items) || [];
    var scopeLabel = (data && data.scope_label) || '注册用户';

    if (!total) {
        summaryEl.textContent = scopeLabel + '：暂无用户数据。';
        cardsEl.innerHTML = '';
        tbody.innerHTML = '<tr><td colspan="3">暂无数据</td></tr>';
        return;
    }

    var ratioText = data && data.ratio_text;
    summaryEl.textContent =
        scopeLabel +
        '，共 ' +
        total +
        ' 人' +
        (ratioText ? '；' + ratioText + '。' : '。');

    cardsEl.innerHTML = items
        .map(function (it) {
            var cls =
                'register-gender-card gender-' +
                (it.key === 'female' ? 'female' : it.key === 'male' ? 'male' : 'unknown');
            return (
                '<div class="' +
                cls +
                '">' +
                '<div class="rg-label">' +
                esc(it.label) +
                '</div>' +
                '<div class="rg-count">' +
                esc(String(it.count)) +
                ' 人</div>' +
                '<div class="rg-pct">' +
                esc(it.pct_text || '—') +
                '</div>' +
                '</div>'
            );
        })
        .join('');

    tbody.innerHTML = items
        .map(function (it) {
            return (
                '<tr><td>' +
                esc(it.label) +
                '</td><td>' +
                esc(String(it.count)) +
                '</td><td>' +
                esc(it.pct_text || '—') +
                '</td></tr>'
            );
        })
        .join('');

    if (typeof Chart === 'undefined') {
        if (chartsWrap) {
            chartsWrap.style.display = 'block';
            if (chartsEmpty) {
                chartsEmpty.style.display = 'block';
                chartsEmpty.textContent = '图表库未加载，请刷新页面后重试';
            }
        }
        return;
    }

    var pieCanvas = document.getElementById('registerGenderChartPie');
    if (!pieCanvas) return;

    chartsWrap.style.display = 'block';
    _registerGenderChartInstances.push(
        new Chart(pieCanvas, {
            type: 'doughnut',
            data: {
                labels: items.map(function (it) {
                    return it.label;
                }),
                datasets: [
                    {
                        data: items.map(function (it) {
                            return it.count;
                        }),
                        backgroundColor: items.map(function (it) {
                            return REGISTER_GENDER_CHART_COLORS[it.key] || chartColorAtIndex(0);
                        }),
                        borderWidth: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                var v = ctx.parsed || 0;
                                var pct = total ? ((v / total) * 100).toFixed(1) : '0';
                                return ' ' + v + ' 人 (' + pct + '%)';
                            }
                        }
                    }
                }
            }
        })
    );
}

function loadAnalyticsRegisterGender() {
    var summaryEl = document.getElementById('registerGenderSummary');
    var tbody = document.getElementById('registerGenderTbody');
    var cardsEl = document.getElementById('registerGenderCards');
    var daysEl = document.getElementById('analyticsRegisterGenderDays');
    var days = daysEl ? String(daysEl.value) : '0';
    if (summaryEl) summaryEl.textContent = '加载中…';
    if (tbody) tbody.innerHTML = '<tr><td colspan="3">加载中…</td></tr>';
    if (cardsEl) cardsEl.innerHTML = '';
    destroyRegisterGenderCharts();
    adminFetch('api/admin/analytics/register-gender?days=' + encodeURIComponent(days))
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                if (summaryEl) summaryEl.textContent = j.msg || '加载失败';
                if (tbody) tbody.innerHTML = '<tr><td colspan="3">加载失败</td></tr>';
                return;
            }
            renderRegisterGenderAnalysis(j.data);
        })
        .catch(function () {
            if (summaryEl) summaryEl.textContent = '网络错误';
            if (tbody) tbody.innerHTML = '<tr><td colspan="3">网络错误</td></tr>';
        });
}

function destroyChannelAnalysisCharts() {
    _channelAnalysisChartInstances.forEach(function (c) {
        try {
            c.destroy();
        } catch (e0) {}
    });
    _channelAnalysisChartInstances = [];
}

function renderChannelAnalysis(data) {
    var summaryEl = document.getElementById('channelAnalysisSummary');
    var cardsEl = document.getElementById('channelAnalysisCards');
    var regTbody = document.getElementById('channelRegisterTbody');
    var actTbody = document.getElementById('channelActivationTbody');
    var chartsWrap = document.getElementById('channelAnalysisChartsWrap');
    var chartsEmpty = document.getElementById('channelAnalysisChartsEmpty');
    var trendCard = document.getElementById('channelTrendCard');
    var actPieCard = document.getElementById('channelActivationPieCard');
    if (!summaryEl || !regTbody) return;

    destroyChannelAnalysisCharts();
    if (chartsWrap) chartsWrap.style.display = 'none';
    if (chartsEmpty) chartsEmpty.style.display = 'none';
    if (trendCard) trendCard.style.display = 'none';
    if (actPieCard) actPieCard.style.display = 'none';

    var total = Number(data && data.total) || 0;
    var scopeLabel = (data && data.scope_label) || '注册用户';
    var regItems = ((data && data.register_channels) || []).filter(function (it) {
        return it.key !== '__empty__' && String(it.label || '').trim() !== '—';
    });
    var actItems = (data && data.activation_channels) || [];
    var actTotal = Number(data && data.activation_total) || 0;
    var withoutChannel = Number(data && data.without_register_channel) || 0;

    if (!total) {
        var emptyTip = withoutChannel > 0 ? '（' + withoutChannel + ' 人未填写注册渠道，已排除）' : '';
        summaryEl.textContent = scopeLabel + '：暂无已填写注册渠道的用户。' + emptyTip;
        if (cardsEl) cardsEl.innerHTML = '';
        regTbody.innerHTML = '<tr><td colspan="5">暂无数据</td></tr>';
        if (actTbody) actTbody.innerHTML = '<tr><td colspan="3">暂无数据</td></tr>';
        return;
    }

    var summary =
        scopeLabel +
        '，已填写注册渠道共 ' +
        total +
        ' 人；其中已激活 ' +
        (data.activated_users || 0) +
        ' 人（激活率 ' +
        (data.overall_activation_pct_text || '—') +
        '）。';
    if (withoutChannel > 0) {
        summary += ' 另有 ' + withoutChannel + ' 人未选择渠道，未计入下表与图表。';
    }
    summaryEl.textContent = summary;

    if (cardsEl) {
        var topCards = regItems.slice(0, 6);
        cardsEl.innerHTML = topCards
            .map(function (it, idx) {
                return (
                    '<div class="register-gender-card channel-card" style="border-top:3px solid ' +
                    chartColorAtIndex(idx) +
                    '">' +
                    '<div class="rg-label">' +
                    esc(it.label) +
                    '</div>' +
                    '<div class="rg-count">' +
                    esc(String(it.count)) +
                    ' 人</div>' +
                    '<div class="rg-pct">' +
                    esc(it.pct_text || '—') +
                    '</div></div>'
                );
            })
            .join('');
    }

    regTbody.innerHTML = regItems
        .map(function (it) {
            return (
                '<tr><td>' +
                esc(it.label) +
                '</td><td>' +
                esc(String(it.count)) +
                '</td><td>' +
                esc(it.pct_text || '—') +
                '</td><td>' +
                esc(String(it.activated_count != null ? it.activated_count : 0)) +
                '</td><td>' +
                esc(it.activation_pct_text || '—') +
                '</td></tr>'
            );
        })
        .join('');

    if (actTbody) {
        if (!actTotal) {
            actTbody.innerHTML = '<tr><td colspan="3">暂无已激活用户或未记录激活来源</td></tr>';
        } else {
            actTbody.innerHTML = actItems
                .map(function (it) {
                    var pctAct =
                        actTotal > 0
                            ? ((it.count / actTotal) * 100).toFixed(1) + '%'
                            : '—';
                    return (
                        '<tr><td>' +
                        esc(it.label) +
                        '</td><td>' +
                        esc(String(it.count)) +
                        '</td><td>' +
                        esc(pctAct) +
                        '</td></tr>'
                    );
                })
                .join('');
        }
    }

    if (typeof Chart === 'undefined') {
        if (chartsWrap) {
            chartsWrap.style.display = 'block';
            if (chartsEmpty) {
                chartsEmpty.style.display = 'block';
                chartsEmpty.textContent = '图表库未加载，请刷新页面后重试';
            }
        }
        return;
    }

    chartsWrap.style.display = 'block';
    var pieReg = document.getElementById('channelChartRegisterPie');
    var barReg = document.getElementById('channelChartRegisterBar');
    if (pieReg && regItems.length) {
        _channelAnalysisChartInstances.push(
            new Chart(pieReg, {
                type: 'doughnut',
                data: {
                    labels: regItems.map(function (it) {
                        return it.label;
                    }),
                    datasets: [
                        {
                            data: regItems.map(function (it) {
                                return it.count;
                            }),
                            backgroundColor: regItems.map(function (it, idx) {
                                return chartColorAtIndex(idx);
                            }),
                            borderWidth: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                            callbacks: {
                                label: function (ctx) {
                                    var v = ctx.parsed || 0;
                                    var pct = total ? ((v / total) * 100).toFixed(1) : '0';
                                    return ' ' + v + ' 人 (' + pct + '%)';
                                }
                            }
                        }
                    }
                }
            })
        );
    }
    if (barReg && regItems.length) {
        _channelAnalysisChartInstances.push(
            new Chart(barReg, {
                type: 'bar',
                data: {
                    labels: regItems.map(function (it) {
                        return it.label.length > 8 ? it.label.slice(0, 8) + '…' : it.label;
                    }),
                    datasets: [
                        {
                            label: '注册人数',
                            data: regItems.map(function (it) {
                                return it.count;
                            }),
                            backgroundColor: regItems.map(function (it, idx) {
                                return chartColorAtIndex(idx);
                            }),
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                    }
                }
            })
        );
    }

    var byDay = (data && data.by_day) || [];
    if (byDay.length && trendCard) {
        trendCard.style.display = '';
        var topKeys = regItems.slice(0, 5).map(function (it) {
            return it.key;
        });
        var trendCanvas = document.getElementById('channelChartDailyTrend');
        if (trendCanvas) {
            var labels = byDay.map(function (d) {
                return d.date ? String(d.date).slice(5) : '';
            });
            var datasets = topKeys.map(function (ck, idx) {
                var meta = regItems.find(function (it) {
                    return it.key === ck;
                });
                return {
                    label: meta ? meta.label : ck,
                    data: byDay.map(function (d) {
                        var found = (d.channels || []).find(function (c) {
                            return c.key === ck;
                        });
                        return found ? found.count : 0;
                    }),
                    borderColor: chartColorAtIndex(idx),
                    backgroundColor: chartColorAtIndex(idx),
                    tension: 0.25,
                    fill: false,
                    borderWidth: 2,
                    pointRadius: 2
                };
            });
            _channelAnalysisChartInstances.push(
                new Chart(trendCanvas, {
                    type: 'line',
                    data: { labels: labels, datasets: datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: { legend: { position: 'bottom' } },
                        scales: {
                            y: { beginAtZero: true, ticks: { precision: 0 } }
                        }
                    }
                })
            );
        }
    }

    if (actTotal && actPieCard) {
        actPieCard.style.display = '';
        var pieAct = document.getElementById('channelChartActivationPie');
        if (pieAct) {
            _channelAnalysisChartInstances.push(
                new Chart(pieAct, {
                    type: 'doughnut',
                    data: {
                        labels: actItems.map(function (it) {
                            return it.label;
                        }),
                        datasets: [
                            {
                                data: actItems.map(function (it) {
                                    return it.count;
                                }),
                                backgroundColor: actItems.map(function (it, idx) {
                                    return chartColorAtIndex(idx + 2);
                                }),
                                borderWidth: 0
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom' } }
                    }
                })
            );
        }
    }
}

function loadChannelAnalysis() {
    var summaryEl = document.getElementById('channelAnalysisSummary');
    var regTbody = document.getElementById('channelRegisterTbody');
    var actTbody = document.getElementById('channelActivationTbody');
    var cardsEl = document.getElementById('channelAnalysisCards');
    var daysEl = document.getElementById('channelAnalysisDays');
    var days = daysEl ? String(daysEl.value) : '0';
    if (summaryEl) summaryEl.textContent = '加载中…';
    if (regTbody) regTbody.innerHTML = '<tr><td colspan="5">加载中…</td></tr>';
    if (actTbody) actTbody.innerHTML = '<tr><td colspan="3">加载中…</td></tr>';
    if (cardsEl) cardsEl.innerHTML = '';
    destroyChannelAnalysisCharts();
    adminFetch('api/admin/analytics/register-channels?days=' + encodeURIComponent(days))
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                if (summaryEl) summaryEl.textContent = j.msg || '加载失败';
                if (regTbody) regTbody.innerHTML = '<tr><td colspan="5">加载失败</td></tr>';
                return;
            }
            renderChannelAnalysis(j.data);
        })
        .catch(function () {
            if (summaryEl) summaryEl.textContent = '网络错误';
            if (regTbody) regTbody.innerHTML = '<tr><td colspan="5">网络错误</td></tr>';
        });
}

function renderRegisterTimeAnalysis(data) {
    var summaryEl = document.getElementById('registerTimeSummary');
    var cardsEl = document.getElementById('registerTimePeriodCards');
    var tbody = document.getElementById('registerTimeDetailTbody');
    var chartsWrap = document.getElementById('registerTimeChartsWrap');
    var chartsEmpty = document.getElementById('registerTimeChartsEmpty');
    if (!summaryEl || !cardsEl || !tbody) return;

    destroyRegisterTimeCharts();
    if (chartsWrap) chartsWrap.style.display = 'none';
    if (chartsEmpty) chartsEmpty.style.display = 'none';

    var total = Number(data && data.total) || 0;
    var days = Number(data && data.days) || 30;
    var periods = (data && data.periods) || [];
    var detail = (data && data.detail_buckets) || [];
    var peak = data && data.peak_period;

    if (!total) {
        summaryEl.textContent = '最近 ' + days + ' 天内暂无注册用户。';
        cardsEl.innerHTML = '';
        tbody.innerHTML = '<tr><td colspan="4">暂无数据</td></tr>';
        if (chartsWrap) {
            chartsWrap.style.display = 'block';
            if (chartsEmpty) {
                chartsEmpty.style.display = 'block';
                chartsEmpty.textContent = '暂无足够数据生成图表';
            }
        }
        return;
    }

    if (peak && peak.label) {
        summaryEl.textContent =
            '最近 ' +
            days +
            ' 天共注册 ' +
            total +
            ' 人；注册最集中时段为「' +
            peak.label +
            '」（' +
            (peak.pct_text || '—') +
            '，' +
            peak.count +
            ' 人）。';
    } else {
        summaryEl.textContent = '最近 ' + days + ' 天共注册 ' + total + ' 人。';
    }

    var cardsHtml = '';
    periods.forEach(function (p) {
        var isPeak = peak && peak.key === p.key;
        cardsHtml +=
            '<div class="register-time-period-card' +
            (isPeak ? ' is-peak' : '') +
            '">' +
            '<div class="rtp-label">' +
            esc(p.label) +
            '</div>' +
            '<div class="rtp-range">' +
            esc(p.range || '') +
            '</div>' +
            '<div class="rtp-count">' +
            esc(String(p.count)) +
            '</div>' +
            '<div class="rtp-pct">' +
            esc(p.pct_text || '—') +
            '</div>' +
            (isPeak ? '<span class="rtp-badge">人数最多</span>' : '') +
            '</div>';
    });
    cardsEl.innerHTML = cardsHtml;

    tbody.innerHTML = detail
        .map(function (b) {
            return (
                '<tr><td>' +
                esc(b.label) +
                '</td><td>' +
                esc(b.range || '') +
                '</td><td>' +
                esc(String(b.count)) +
                '</td><td>' +
                esc(b.pct_text || '—') +
                '</td></tr>'
            );
        })
        .join('');

    if (typeof Chart === 'undefined') {
        if (chartsWrap) {
            chartsWrap.style.display = 'block';
            if (chartsEmpty) {
                chartsEmpty.style.display = 'block';
                chartsEmpty.textContent = '图表库未加载，请刷新页面后重试';
            }
        }
        return;
    }

    chartsWrap.style.display = 'block';
    var periodCanvas = document.getElementById('registerTimeChartPeriods');
    var hourCanvas = document.getElementById('registerTimeChartHourly');
    if (!periodCanvas || !hourCanvas) return;

    _registerTimeChartInstances.push(
        new Chart(periodCanvas, {
            type: 'bar',
            data: {
                labels: periods.map(function (p) {
                    return p.label;
                }),
                datasets: [
                    {
                        label: '注册人数',
                        data: periods.map(function (p) {
                            return p.count;
                        }),
                        backgroundColor: periods.map(function (p) {
                            return REGISTER_TIME_PERIOD_COLORS[p.key] || chartColorAtIndex(0);
                        }),
                        borderWidth: 0,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                var v = ctx.parsed.y || 0;
                                var pct = total ? ((v / total) * 100).toFixed(1) : '0';
                                return ' ' + v + ' 人 (' + pct + '%)';
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        })
    );

    var byHour = (data && data.by_hour) || [];
    _registerTimeChartInstances.push(
        new Chart(hourCanvas, {
            type: 'bar',
            data: {
                labels: byHour.map(function (h) {
                    return h.label;
                }),
                datasets: [
                    {
                        label: '注册人数',
                        data: byHour.map(function (h) {
                            return h.count;
                        }),
                        backgroundColor: 'rgba(30, 111, 255, 0.65)',
                        borderWidth: 0,
                        borderRadius: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                var v = ctx.parsed.y || 0;
                                var pct = total ? ((v / total) * 100).toFixed(1) : '0';
                                return ' ' + v + ' 人 (' + pct + '%)';
                            }
                        }
                    }
                },
                scales: {
                    x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
                    y: { beginAtZero: true, ticks: { precision: 0 } }
                }
            }
        })
    );
}

function loadAnalyticsRegisterTime() {
    var summaryEl = document.getElementById('registerTimeSummary');
    var tbody = document.getElementById('registerTimeDetailTbody');
    var cardsEl = document.getElementById('registerTimePeriodCards');
    var daysEl = document.getElementById('analyticsRegisterTimeDays');
    var days = daysEl ? parseInt(daysEl.value, 10) || 30 : 30;
    if (summaryEl) summaryEl.textContent = '加载中…';
    if (tbody) tbody.innerHTML = '<tr><td colspan="4">加载中…</td></tr>';
    if (cardsEl) cardsEl.innerHTML = '';
    destroyRegisterTimeCharts();
    adminFetch('api/admin/analytics/register-time?days=' + encodeURIComponent(days))
        .then(function (r) {
            return r.json();
        })
        .then(function (j) {
            if (j.code !== 200 || !j.data) {
                if (summaryEl) summaryEl.textContent = j.msg || '加载失败';
                if (tbody) tbody.innerHTML = '<tr><td colspan="4">加载失败</td></tr>';
                return;
            }
            renderRegisterTimeAnalysis(j.data);
        })
        .catch(function () {
            if (summaryEl) summaryEl.textContent = '网络错误';
            if (tbody) tbody.innerHTML = '<tr><td colspan="4">网络错误</td></tr>';
        });
}

function chartColorForIconKey(iconKey, index) {
    var k = String(iconKey || 'other');
    if (DEVICE_CHART_COLORS[k]) {
        return DEVICE_CHART_COLORS[k];
    }
    return DEVICE_CHART_FALLBACK[index % DEVICE_CHART_FALLBACK.length];
}

function groupChartSlices(rows, maxSlices, labelField) {
    var list = (rows || [])
        .map(function (r) {
            return {
                label: r[labelField] || r.label || '—',
                count: Number(r.count) || 0,
                icon_key: r.icon_key
            };
        })
        .filter(function (r) {
            return r.count > 0;
        })
        .sort(function (a, b) {
            return b.count - a.count;
        });
    if (list.length <= maxSlices) {
        return list;
    }
    var top = list.slice(0, maxSlices - 1);
    var otherCount = 0;
    for (var i = maxSlices - 1; i < list.length; i++) {
        otherCount += list[i].count;
    }
    top.push({ label: '其他', count: otherCount, icon_key: 'other' });
    return top;
}

function renderDeviceStatsCharts(data) {
    destroyDeviceStatsCharts();
    var wrap = document.getElementById('deviceStatsChartsWrap');
    var grid = document.getElementById('deviceStatsChartsGrid');
    var emptyEl = document.getElementById('deviceStatsChartsEmpty');
    if (!wrap || !grid) {
        return;
    }
    if (typeof Chart === 'undefined') {
        wrap.style.display = 'block';
        if (emptyEl) {
            emptyEl.style.display = 'block';
            emptyEl.textContent = '图表库未加载，请刷新页面后重试';
        }
        grid.style.display = 'none';
        return;
    }
    var total = Number(data && data.total_devices) || 0;
    var iconSummary = (data && data.icon_summary) || [];
    var byOsFamily = (data && data.by_os_family) || [];
    var byOs = (data && data.by_os) || [];
    var byModel = (data && data.by_model) || [];
    if (!total || (!iconSummary.length && !byOs.length)) {
        wrap.style.display = 'block';
        if (emptyEl) {
            emptyEl.style.display = 'block';
            emptyEl.textContent = '暂无足够数据生成图表';
        }
        grid.style.display = 'none';
        return;
    }
    wrap.style.display = 'block';
    if (emptyEl) {
        emptyEl.style.display = 'none';
    }
    grid.style.display = 'grid';

    var pieLegend = {
        position: 'bottom',
        labels: { boxWidth: 12, padding: 10, font: { size: 11 } }
    };
    var pieTooltip = {
        callbacks: {
            label: function (ctx) {
                var v = ctx.parsed || 0;
                var pct = total ? ((v / total) * 100).toFixed(1) : '0';
                return ' ' + ctx.label + ': ' + v + ' (' + pct + '%)';
            }
        }
    };

    var platformSlices = groupChartSlices(iconSummary, 10, 'label');
    var platformColors = platformSlices.map(function (r, i) {
        return chartColorForIconKey(r.icon_key, i);
    });
    _deviceStatsChartInstances.push(
        new Chart(document.getElementById('deviceChartPlatform'), {
            type: 'doughnut',
            data: {
                labels: platformSlices.map(function (r) {
                    return r.label;
                }),
                datasets: [
                    {
                        data: platformSlices.map(function (r) {
                            return r.count;
                        }),
                        backgroundColor: platformColors,
                        borderWidth: 1,
                        borderColor: '#fff'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: pieLegend, tooltip: pieTooltip }
            }
        })
    );

    var osFamilySlices = groupChartSlices(byOsFamily, 8, 'label');
    var osFamilyColors = osFamilySlices.map(function (r, i) {
        return chartColorForIconKey(r.icon_key, i);
    });
    _deviceStatsChartInstances.push(
        new Chart(document.getElementById('deviceChartOsFamily'), {
            type: 'pie',
            data: {
                labels: osFamilySlices.map(function (r) {
                    return r.label;
                }),
                datasets: [
                    {
                        data: osFamilySlices.map(function (r) {
                            return r.count;
                        }),
                        backgroundColor: osFamilyColors,
                        borderWidth: 1,
                        borderColor: '#fff'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: pieLegend, tooltip: pieTooltip }
            }
        })
    );

    var osVerSlices = groupChartSlices(byOs, 12, 'label');
    _deviceStatsChartInstances.push(
        new Chart(document.getElementById('deviceChartOsVersion'), {
            type: 'bar',
            data: {
                labels: osVerSlices.map(function (r) {
                    return r.label;
                }),
                datasets: [
                    {
                        label: '设备数',
                        data: osVerSlices.map(function (r) {
                            return r.count;
                        }),
                        backgroundColor: osVerSlices.map(function (r, i) {
                            return chartColorForIconKey(r.icon_key, i) + 'cc';
                        }),
                        borderRadius: 4,
                        maxBarThickness: 28
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                var v = ctx.parsed.x || 0;
                                var pct = total ? ((v / total) * 100).toFixed(1) : '0';
                                return ' 设备数: ' + v + ' (' + pct + '%)';
                            }
                        }
                    }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { precision: 0 } },
                    y: { ticks: { font: { size: 11 }, autoSkip: false } }
                }
            }
        })
    );

    var modelSlices = groupChartSlices(byModel, 15, 'label');
    _deviceStatsChartInstances.push(
        new Chart(document.getElementById('deviceChartModel'), {
            type: 'bar',
            data: {
                labels: modelSlices.map(function (r) {
                    return r.label;
                }),
                datasets: [
                    {
                        label: '设备数',
                        data: modelSlices.map(function (r) {
                            return r.count;
                        }),
                        backgroundColor: modelSlices.map(function (r, i) {
                            return chartColorForIconKey(r.icon_key, i) + 'cc';
                        }),
                        borderRadius: 4,
                        maxBarThickness: 26
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                var v = ctx.parsed.x || 0;
                                var pct = total ? ((v / total) * 100).toFixed(1) : '0';
                                return ' 设备数: ' + v + ' (' + pct + '%)';
                            }
                        }
                    }
                },
                scales: {
                    x: { beginAtZero: true, ticks: { precision: 0 } },
                    y: { ticks: { font: { size: 10 }, autoSkip: false } }
                }
            }
        })
    );
}
