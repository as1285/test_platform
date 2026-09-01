/** 管理端图表辅助（按需加载）
 * 安装统计（install-guide）图表由 admin_panel.js 本地创建/销毁，不在本模块。 */
        var _registerTimeChartInstances = [];
        var DEVICE_CHART_FALLBACK = [
            '#1e6fff', '#3ddc84', '#ff6900', '#cf0a2c', '#415fff', '#1428a0', '#0078d4', '#9aa5b1'
        ];
        var _channelAnalysisChartInstances = [];

        function chartColorAtIndex(index) {
            var i = Number(index) || 0;
            if (i < 0) i = 0;
            return DEVICE_CHART_FALLBACK[i % DEVICE_CHART_FALLBACK.length];
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
            late_night: '#64748b',
            morning: '#f5a623',
            afternoon: '#1e6fff',
            evening: '#6b4ce6'
        };

        function destroyChannelAnalysisCharts() {
            _channelAnalysisChartInstances.forEach(function (c) {
                try {
                    c.destroy();
                } catch (e0) {}
            });
            _channelAnalysisChartInstances = [];
        }

        function renderChannelDailyTrendChart(data, regItems) {
            var trendSection = document.getElementById('channelDailyTrendSection');
            var trendHint = document.getElementById('channelDailyTrendHint');
            var trendEmpty = document.getElementById('channelDailyTrendEmpty');
            var trendCanvas = document.getElementById('channelChartDailyTrend');
            var byDay = (data && data.by_day) || [];
            if (!trendSection) {
                return;
            }
            trendSection.style.display = 'block';
            if (trendHint) {
                trendHint.textContent =
                    (data && data.trend_scope_label) ||
                    (data && data.trend_days
                        ? '近 ' + data.trend_days + ' 日每日注册（按来源渠道）'
                        : '选择统计范围后展示每日注册趋势');
            }
            if (!byDay.length || typeof Chart === 'undefined' || !trendCanvas) {
                if (trendEmpty) {
                    trendEmpty.style.display = 'block';
                }
                return;
            }
            if (trendEmpty) {
                trendEmpty.style.display = 'none';
            }
            var channelRank = (data && data.trend_channel_rank) || [];
            var topKeys = [];
            if (channelRank.length) {
                topKeys = channelRank.slice(0, 8).map(function (it) {
                    return it.key;
                });
            } else {
                topKeys = regItems.slice(0, 8).map(function (it) {
                    return it.key;
                });
            }
            var labelMap = {};
            regItems.forEach(function (it) {
                labelMap[it.key] = it.label;
            });
            channelRank.forEach(function (it) {
                if (!labelMap[it.key]) {
                    labelMap[it.key] = it.label;
                }
            });
            var labels = byDay.map(function (d) {
                return d.date ? String(d.date).slice(5) : '';
            });
            var datasets = topKeys.map(function (ck, idx) {
                return {
                    label: labelMap[ck] || ck,
                    data: byDay.map(function (d) {
                        var found = (d.channels || []).find(function (c) {
                            return c.key === ck;
                        });
                        return found ? found.count : 0;
                    }),
                    borderColor: chartColorAtIndex(idx),
                    backgroundColor: chartColorAtIndex(idx),
                    tension: 0.3,
                    fill: false,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5
                };
            });
            datasets.push({
                label: '合计',
                data: byDay.map(function (d) {
                    return Number(d.total) || 0;
                }),
                borderColor: '#94a3b8',
                backgroundColor: '#94a3b8',
                borderDash: [6, 4],
                tension: 0.3,
                fill: false,
                borderWidth: 2,
                pointRadius: 2,
                pointHoverRadius: 4
            });
            _channelAnalysisChartInstances.push(
                new Chart(trendCanvas, {
                    type: 'line',
                    data: { labels: labels, datasets: datasets },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            legend: { position: 'bottom' },
                            tooltip: {
                                callbacks: {
                                    title: function (items) {
                                        if (!items || !items.length) {
                                            return '';
                                        }
                                        var idx = items[0].dataIndex;
                                        var row = byDay[idx];
                                        return row && row.date ? row.date : items[0].label;
                                    },
                                    label: function (ctx) {
                                        return ' ' + ctx.dataset.label + ': ' + (ctx.parsed.y || 0) + ' 人';
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                ticks: {
                                    maxRotation: 45,
                                    minRotation: 0,
                                    autoSkip: true,
                                    maxTicksLimit: byDay.length > 60 ? 20 : 31
                                }
                            },
                            y: { beginAtZero: true, ticks: { precision: 0 } }
                        }
                    }
                })
            );
        }

        function renderChannelAnalysis(data) {
            var summaryEl = document.getElementById('channelAnalysisSummary');
            var cardsEl = document.getElementById('channelAnalysisCards');
            var regTbody = document.getElementById('channelRegisterTbody');
            var actTbody = document.getElementById('channelActivationTbody');
            var chartsWrap = document.getElementById('channelAnalysisChartsWrap');
            var chartsEmpty = document.getElementById('channelAnalysisChartsEmpty');
            var actPieCard = document.getElementById('channelActivationPieCard');
            var trendSection = document.getElementById('channelDailyTrendSection');
            var trendEmpty = document.getElementById('channelDailyTrendEmpty');
            if (!summaryEl || !regTbody) return;

            destroyChannelAnalysisCharts();
            if (chartsWrap) chartsWrap.style.display = 'none';
            if (chartsEmpty) chartsEmpty.style.display = 'none';
            if (actPieCard) actPieCard.style.display = 'none';
            if (trendSection) trendSection.style.display = 'none';
            if (trendEmpty) trendEmpty.style.display = 'none';

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
                if (data && data.trend_days) {
                    renderChannelDailyTrendChart(data, []);
                }
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
                renderChannelDailyTrendChart(data, regItems);
                return;
            }

            renderChannelDailyTrendChart(data, regItems);
            if (chartsWrap) chartsWrap.style.display = 'block';
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
            var days = analyticsPeriodVal(daysEl);
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
                        if (actTbody) actTbody.innerHTML = '<tr><td colspan="3">加载失败</td></tr>';
                        return;
                    }
                    try {
                        renderChannelAnalysis(j.data);
                    } catch (renderErr) {
                        console.error('[channel-analysis] render failed', renderErr);
                        if (summaryEl) summaryEl.textContent = '渲染失败，请刷新后重试';
                        if (regTbody) regTbody.innerHTML = '<tr><td colspan="5">渲染失败</td></tr>';
                        if (actTbody) actTbody.innerHTML = '<tr><td colspan="3">渲染失败</td></tr>';
                    }
                })
                .catch(function (err) {
                    console.error('[channel-analysis] load failed', err);
                    if (summaryEl) summaryEl.textContent = '网络错误';
                    if (regTbody) regTbody.innerHTML = '<tr><td colspan="5">网络错误</td></tr>';
                    if (actTbody) actTbody.innerHTML = '<tr><td colspan="3">网络错误</td></tr>';
                });
            try {
                loadChannelRegistrationFunnel();
            } catch (e1) {
                console.error('[channel-analysis] registration funnel', e1);
            }
            try {
                loadActivationChannelFunnel();
            } catch (e2) {
                console.error('[channel-analysis] activation funnel', e2);
            }
        }

        function renderRegisterTimeAnalysis(data) {
            var summaryEl = document.getElementById('registerTimeSummary');
            var cardsEl = document.getElementById('registerTimePeriodCards');
            var tbody = document.getElementById('registerTimeDetailTbody');
            var chartsWrap = document.getElementById('registerTimeChartsWrap');
            var chartsEmpty = document.getElementById('registerTimeChartsEmpty');
            if (!summaryEl || !cardsEl) return;

            destroyRegisterTimeCharts();
            if (chartsWrap) chartsWrap.style.display = 'none';
            if (chartsEmpty) chartsEmpty.style.display = 'none';

            var total = Number(data && data.total) || 0;
            var periodLabel =
                (data && data.period_label) ||
                (data && data.days != null && String(data.days).match(/^month_/)
                    ? String(data.days)
                    : null);
            var daysHint = periodLabel
                ? periodLabel +
                  (data.period_start && data.period_end
                      ? '（' + data.period_start + ' ~ ' + data.period_end + '）'
                      : '')
                : '最近 ' + (Number(data && data.days) || 30) + ' 天';
            var periods = (data && data.periods) || [];
            var detail = (data && data.detail_buckets) || [];
            var peak = data && data.peak_period;

            if (!total) {
                summaryEl.textContent = daysHint + '内暂无注册用户。';
                cardsEl.innerHTML = '';
                if (tbody) tbody.innerHTML = '<tr><td colspan="4">暂无数据</td></tr>';
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
                    daysHint +
                    '共注册 ' +
                    total +
                    ' 人；注册最集中时段为「' +
                    peak.label +
                    '」（' +
                    (peak.pct_text || '—') +
                    '，' +
                    peak.count +
                    ' 人）。';
            } else {
                summaryEl.textContent = daysHint + '共注册 ' + total + ' 人。';
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

            if (tbody) {
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
                            x: { ticks: { maxRotation: 0 } },
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

        function renderRegisterPlatformAnalysis(data) {
            var summaryEl = document.getElementById('registerPlatformSummary');
            var cardsEl = document.getElementById('registerPlatformCards');
            var tbody = document.getElementById('registerPlatformDailyTbody');
            if (!summaryEl || !cardsEl || !tbody) return;

            var platformSummary = (data && data.platform_summary) || {};
            var platformDaily = Array.isArray(data && data.platform_daily) ? data.platform_daily : [];
            var periodLabel =
                (data && data.period_label) ||
                (data && data.days != null && String(data.days).match(/^month_/)
                    ? String(data.days)
                    : null);
            var daysHint = periodLabel
                ? periodLabel +
                  (data.period_start && data.period_end
                      ? '（' + data.period_start + ' ~ ' + data.period_end + '）'
                      : '')
                : '最近 ' + (Number(data && data.days) || 7) + ' 天';

            if (!(platformSummary.total > 0) && !platformDaily.length) {
                summaryEl.textContent = daysHint + '内暂无注册用户。';
                cardsEl.innerHTML = '';
                tbody.innerHTML = '<tr><td colspan="7">暂无数据</td></tr>';
                return;
            }

            summaryEl.textContent =
                '安卓 ' +
                (platformSummary.android_pct_text || '—') +
                ' · 苹果 ' +
                (platformSummary.ios_pct_text || '—') +
                ' · 共 ' +
                String(platformSummary.total != null ? platformSummary.total : 0) +
                ' 人';

            cardsEl.innerHTML =
                '<div class="user-data-stat-card"><div class="ud-label">安卓率</div><div class="ud-val">' +
                esc(platformSummary.android_pct_text || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">' +
                esc(String(platformSummary.android != null ? platformSummary.android : 0)) +
                ' / ' +
                esc(String(platformSummary.total != null ? platformSummary.total : 0)) +
                '</div></div>' +
                '<div class="user-data-stat-card"><div class="ud-label">苹果率</div><div class="ud-val">' +
                esc(platformSummary.ios_pct_text || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">' +
                esc(String(platformSummary.ios != null ? platformSummary.ios : 0)) +
                ' / ' +
                esc(String(platformSummary.total != null ? platformSummary.total : 0)) +
                '</div></div>' +
                '<div class="user-data-stat-card"><div class="ud-label">其他/未知</div><div class="ud-val">' +
                esc(platformSummary.other_pct_text || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">含 PC 等</div></div>';

            tbody.innerHTML = platformDaily
                .slice()
                .reverse()
                .map(function (row) {
                    var dateLabel = row.date ? String(row.date).slice(5) : '—';
                    return (
                        '<tr><td>' +
                        esc(dateLabel) +
                        '</td><td>' +
                        esc(String(row.total != null ? row.total : 0)) +
                        '</td><td>' +
                        esc(row.android_pct_text || '—') +
                        '</td><td>' +
                        esc(row.ios_pct_text || '—') +
                        '</td><td>' +
                        esc(String(row.android != null ? row.android : 0)) +
                        '</td><td>' +
                        esc(String(row.ios != null ? row.ios : 0)) +
                        '</td><td>' +
                        esc(String(row.other != null ? row.other : 0)) +
                        '</td></tr>'
                    );
                })
                .join('');
        }

        function installGuideStatsDaysEl() {
            return document.getElementById('installGuideStatsDays');
        }

        function loadAnalyticsRegisterPlatform() {
            var summaryEl = document.getElementById('registerPlatformSummary');
            var cardsEl = document.getElementById('registerPlatformCards');
            var tbody = document.getElementById('registerPlatformDailyTbody');
            var daysEl = installGuideStatsDaysEl();
            var days = analyticsPeriodVal(daysEl);
            if (summaryEl) summaryEl.textContent = '加载中…';
            if (cardsEl) cardsEl.innerHTML = '';
            if (tbody) tbody.innerHTML = '<tr><td colspan="7">加载中…</td></tr>';
            adminFetch('api/admin/analytics/register-time?days=' + encodeURIComponent(days))
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        if (summaryEl) summaryEl.textContent = j.msg || '加载失败';
                        if (tbody) tbody.innerHTML = '<tr><td colspan="7">加载失败</td></tr>';
                        return;
                    }
                    renderRegisterPlatformAnalysis(j.data);
                })
                .catch(function () {
                    if (summaryEl) summaryEl.textContent = '网络错误';
                    if (tbody) tbody.innerHTML = '<tr><td colspan="7">网络错误</td></tr>';
                });
        }

        function loadAnalyticsRegisterTime() {
            var summaryEl = document.getElementById('registerTimeSummary');
            var tbody = document.getElementById('registerTimeDetailTbody');
            var cardsEl = document.getElementById('registerTimePeriodCards');
            var daysEl = installGuideStatsDaysEl();
            var days = analyticsPeriodVal(daysEl);
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

        window.destroyRegisterTimeCharts = destroyRegisterTimeCharts;
        window.destroyChannelAnalysisCharts = destroyChannelAnalysisCharts;
        window.loadChannelAnalysis = loadChannelAnalysis;
        window.loadAnalyticsRegisterPlatform = loadAnalyticsRegisterPlatform;
        window.loadAnalyticsRegisterTime = loadAnalyticsRegisterTime;
        window.renderChannelAnalysis = renderChannelAnalysis;
        window.renderRegisterTimeAnalysis = renderRegisterTimeAnalysis;
        window.renderRegisterPlatformAnalysis = renderRegisterPlatformAnalysis;
        window.AdminModules = window.AdminModules || {};
        window.AdminModules.charts = { ready: true };

