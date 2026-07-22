/** 管理端图表辅助（按需加载） */
        function statIconHtml(iconKey) {
            var k = String(iconKey || 'other');
            var W = '<span class="stat-svg-wrap">';
            var Z = '</span>';
            var badges = {
                xiaomi: '<span class="stat-badge stat-badge-xiaomi">MI</span>',
                huawei: '<span class="stat-badge stat-badge-huawei">HW</span>',
                honor: '<span class="stat-badge stat-badge-honor">荣耀</span>',
                oppo: '<span class="stat-badge stat-badge-oppo">OP</span>',
                vivo: '<span class="stat-badge stat-badge-vivo">v</span>',
                samsung: '<span class="stat-badge stat-badge-samsung">S</span>',
                google: '<span class="stat-badge stat-badge-google">G</span>',
                android_phone: '<span class="stat-badge stat-badge-android_phone">📱</span>'
            };
            if (badges[k]) {
                return W + badges[k] + Z;
            }
            var icons = {
                iphone: '<svg class="stat-svg-icon" viewBox="0 0 24 24"><path fill="#1c1c1e" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>',
                ipad: '<svg class="stat-svg-icon" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="#1c1c1e" stroke-width="1.6"/><circle cx="12" cy="17.5" r="1" fill="#1c1c1e"/></svg>',
                ios: '<svg class="stat-svg-icon" viewBox="0 0 24 24"><path fill="#1c1c1e" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>',
                android: '<svg class="stat-svg-icon" viewBox="0 0 24 24"><path fill="#3DDC84" d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zm4.86-9.01c.03-.55.47-.99 1.02-1.01.56.02 1.02.46 1.02 1.01 0 .57-.46 1.03-1.03 1.03-.56 0-1.01-.46-1.01-1.03zm4.28 0c0-.55.45-.99 1-1.01.55.02.99.46 1.01 1.01 0 .57-.45 1.03-1.01 1.03-.57 0-1-.46-1-1.03zM17.5 6h-1.71A4.49 4.49 0 0012 3.5 4.49 4.49 0 008.21 6H6.5c-.83 0-1.5.67-1.5 1.5S5.67 9 6.5 9H17.5c.83 0 1.5-.67 1.5-1.5S18.33 6 17.5 6z"/></svg>',
                windows: '<svg class="stat-svg-icon" viewBox="0 0 24 24"><path fill="#0078D4" d="M3 3h8.5v8.5H3V3zm9.5 0H21v8.5h-8.5V3zM3 12.5h8.5V21H3v-8.5zm9.5 0H21V21h-8.5v-8.5z"/></svg>',
                windows_pc: '<svg class="stat-svg-icon" viewBox="0 0 24 24"><path fill="#0078D4" d="M3 3h8.5v8.5H3V3zm9.5 0H21v8.5h-8.5V3zM3 12.5h8.5V21H3v-8.5zm9.5 0H21V21h-8.5v-8.5z"/></svg>',
                mac: '<svg class="stat-svg-icon" viewBox="0 0 24 24"><path fill="#555" d="M4 5h16v11H4V5zm2 2v7h12V7H6zm1 13h10v2H7v-2z"/></svg>',
                macos: '<svg class="stat-svg-icon" viewBox="0 0 24 24"><path fill="#555" d="M4 5h16v11H4V5zm2 2v7h12V7H6zm1 13h10v2H7v-2z"/></svg>',
                linux: '<svg class="stat-svg-icon" viewBox="0 0 24 24"><path fill="#333" d="M8 4l-3 16h2.2l.6-3h5.2l.7 3H16l-3-16H8zm.9 10l1.7-7.5h.1l1.6 7.5H8.9z"/></svg>',
                linux_pc: '<svg class="stat-svg-icon" viewBox="0 0 24 24"><path fill="#333" d="M8 4l-3 16h2.2l.6-3h5.2l.7 3H16l-3-16H8zm.9 10l1.7-7.5h.1l1.6 7.5H8.9z"/></svg>',
                chromeos: '<svg class="stat-svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#4285F4" stroke-width="1.8"/><path fill="#EA4335" d="M12 7.5l4.3 7.5H7.7z" opacity=".85"/></svg>',
                chromebook: '<svg class="stat-svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#4285F4" stroke-width="1.8"/><path fill="#EA4335" d="M12 7.5l4.3 7.5H7.7z" opacity=".85"/></svg>',
                other: '<svg class="stat-svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="#aaa" stroke-width="1.5"/><circle cx="12" cy="12" r="2.5" fill="#aaa"/></svg>'
            };
            return W + (icons[k] || icons.other) + Z;
        }

        function renderDeviceStatsLegend(iconSummary) {
            var box = document.getElementById('deviceStatsLegend');
            if (!box) {
                return;
            }
            var rows = iconSummary || [];
            if (!rows.length) {
                box.style.display = 'none';
                box.innerHTML = '';
                return;
            }
            var html = '<strong style="margin-right:4px;">机型图标分析：</strong>';
            rows.forEach(function (row) {
                html +=
                    '<span class="device-stats-legend-item" title="' +
                    esc(row.label || row.icon_key) +
                    '">' +
                    statIconHtml(row.icon_key) +
                    '<span>' +
                    esc(row.label || row.icon_key) +
                    '</span><span class="count">(' +
                    esc(String(row.count)) +
                    ')</span></span>';
            });
            box.innerHTML = html;
            box.style.display = 'flex';
        }

        function deviceStatRowHtml(row) {
            var hint = row.icon_hint ? ' title="' + esc(row.icon_hint) + '"' : '';
            return (
                '<tr' +
                hint +
                '><td>' +
                statIconHtml(row.icon_key) +
                '</td><td class="cell-break">' +
                esc(row.label) +
                '</td><td>' +
                esc(String(row.count)) +
                '</td></tr>'
            );
        }

        var _deviceStatsChartInstances = [];
        var _registerTimeChartInstances = [];
        var _registerGenderChartInstances = [];
        var _udGenderChartInstances = [];
        var _udFemaleAgeChartInstances = [];
        var _auaDauChartInstances = [];
        var _installGuideChartInstances = [];
        var _guestUsersChartInstances = [];
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

        function destroyInstallGuideCharts() {
            _installGuideChartInstances.forEach(function (c) {
                try {
                    c.destroy();
                } catch (e0) {}
            });
            _installGuideChartInstances = [];
        }

        function destroyGuestUsersCharts() {
            _guestUsersChartInstances.forEach(function (c) {
                try {
                    c.destroy();
                } catch (e0) {}
            });
            _guestUsersChartInstances = [];
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
            var days = analyticsPeriodVal(daysEl);
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
                    if (tbody) tbody.innerHTML = '<tr><td colspan="2">网络错误</td></tr>';
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
                        return;
                    }
                    renderChannelAnalysis(j.data);
                })
                .catch(function () {
                    if (summaryEl) summaryEl.textContent = '网络错误';
                    if (regTbody) regTbody.innerHTML = '<tr><td colspan="5">网络错误</td></tr>';
                });
            loadChannelRegistrationFunnel();
            loadActivationChannelFunnel();
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
                daysHint +
                '注册中，安卓约占 ' +
                (platformSummary.android_pct_text || '—') +
                '、苹果约占 ' +
                (platformSummary.ios_pct_text || '—') +
                '（其余为 PC 或未知）。口径：按注册日（北京时间）；系统取该用户最早一条设备 UA。';

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

        function loadAnalyticsRegisterPlatform() {
            var summaryEl = document.getElementById('registerPlatformSummary');
            var cardsEl = document.getElementById('registerPlatformCards');
            var tbody = document.getElementById('registerPlatformDailyTbody');
            var daysEl = document.getElementById('analyticsRegisterPlatformDays');
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
            var daysEl = document.getElementById('analyticsRegisterTimeDays');
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

        window.destroyDeviceStatsCharts = destroyDeviceStatsCharts;
        window.destroyRegisterTimeCharts = destroyRegisterTimeCharts;
        window.destroyRegisterGenderCharts = destroyRegisterGenderCharts;
        window.destroyInstallGuideCharts = destroyInstallGuideCharts;
        window.destroyGuestUsersCharts = destroyGuestUsersCharts;
        window.destroyChannelAnalysisCharts = destroyChannelAnalysisCharts;
        window.loadChannelAnalysis = loadChannelAnalysis;
        window.loadAnalyticsRegisterGender = loadAnalyticsRegisterGender;
        window.loadAnalyticsRegisterPlatform = loadAnalyticsRegisterPlatform;
        window.loadAnalyticsRegisterTime = loadAnalyticsRegisterTime;
        window.renderDeviceStatsCharts = renderDeviceStatsCharts;
        window.renderRegisterGenderAnalysis = renderRegisterGenderAnalysis;
        window.renderChannelAnalysis = renderChannelAnalysis;
        window.renderRegisterTimeAnalysis = renderRegisterTimeAnalysis;
        window.renderRegisterPlatformAnalysis = renderRegisterPlatformAnalysis;
        window.statIconHtml = statIconHtml;
        window.deviceStatRowHtml = deviceStatRowHtml;
        window.AdminModules = window.AdminModules || {};
        window.AdminModules.charts = { ready: true };

