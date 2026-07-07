        function esc(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        function analyticsPeriodVal(el) {
            if (window.AdminAnalyticsPeriod) {
                return AdminAnalyticsPeriod.getValue(el);
            }
            return el ? String(el.value || '1') : '1';
        }

        /** 设备统计图标（与接口 icon_key 对应，含机型品牌分析） */
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

        function formatDt(iso) {
            if (iso == null || String(iso).trim() === '') return '—';
            try {
                var d = new Date(iso);
                if (isNaN(d.getTime())) return esc(iso);
                // 转换为 UTC+8
                var utc = d.getTime() + (d.getTimezoneOffset() * 60000);
                var nd = new Date(utc + (3600000 * 8));
                
                var Y = nd.getFullYear();
                var M = String(nd.getMonth() + 1).padStart(2, '0');
                var D = String(nd.getDate()).padStart(2, '0');
                var h = String(nd.getHours()).padStart(2, '0');
                var m = String(nd.getMinutes()).padStart(2, '0');
                var s = String(nd.getSeconds()).padStart(2, '0');
                return Y + '-' + M + '-' + D + ' ' + h + ':' + m + ':' + s;
            } catch (e) {
                return esc(iso);
            }
        }

        function copyCode(text) {
            var t = String(text || '');
            if (!t) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(t).then(function () {
                    alert('已复制到剪贴板');
                }).catch(function () {
                    copyFallback(t);
                });
            } else {
                copyFallback(t);
            }
        }

        function formatLocalDateTimeForExport(d) {
            d = d || new Date();
            var Y = d.getFullYear();
            var M = String(d.getMonth() + 1).padStart(2, '0');
            var D = String(d.getDate()).padStart(2, '0');
            var h = String(d.getHours()).padStart(2, '0');
            var m = String(d.getMinutes()).padStart(2, '0');
            var s = String(d.getSeconds()).padStart(2, '0');
            return Y + '-' + M + '-' + D + ' ' + h + ':' + m + ':' + s;
        }

        function downloadActivationCodesTxt(codes, meta) {
            meta = meta || {};
            var list = Array.isArray(codes) ? codes : [];
            if (!list.length) {
                alert('没有可导出的激活码');
                return;
            }
            var lines = [
                '# 闲鱼激活码批量导出',
                '# 生成时间：' + (meta.generated_at || formatLocalDateTimeForExport(new Date())),
                '# 数量：' + list.length,
                '# 归属管理员：' + (meta.owner_admin || '—'),
                '# 说明：每码单次有效、永不过期，仅可激活一个账号',
                ''
            ];
            list.forEach(function (c) {
                lines.push(String(c).trim());
            });
            var blob = new Blob(['\ufeff' + lines.join('\r\n')], {
                type: 'text/plain;charset=utf-8'
            });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download =
                meta.filename ||
                'xianyu-activation-codes-' +
                    formatLocalDateTimeForExport(new Date()).replace(/[:\s]/g, '-') +
                    '.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        function copyFallback(t) {
            var ta = document.createElement('textarea');
            ta.value = t;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                alert('已复制到剪贴板');
            } catch (e) {
                alert('复制失败，请手动复制');
            }
            document.body.removeChild(ta);
        }

        var _agentPromoLinksCache = [];

        function parseAgentChannelIds(raw) {
            return String(raw || '')
                .split(/[\r\n,;]+/)
                .map(function (s) {
                    return s.trim();
                })
                .filter(function (s) {
                    return /^[a-zA-Z0-9_-]+$/.test(s);
                })
                .filter(function (s, i, arr) {
                    return arr.indexOf(s) === i;
                });
        }

        function buildAgentPromoLink(origin, page, channelId) {
            var base = String(origin || window.location.origin || '').replace(/\/+$/, '');
            return base + '/' + page + '?ch=' + encodeURIComponent(channelId);
        }

        function renderAgentPromoLinks(channelIds) {
            var mount = document.getElementById('agentPromoLinksMount');
            var copyAllBtn = document.getElementById('btnCopyAllAgentPromoLinks');
            if (!mount) {
                return;
            }
            if (!channelIds.length) {
                mount.style.display = 'none';
                mount.innerHTML = '';
                _agentPromoLinksCache = [];
                if (copyAllBtn) {
                    copyAllBtn.style.display = 'none';
                }
                alert('请先在上方填写至少一个渠道 ID（每行一个）');
                return;
            }
            var origin = window.location.origin || '';
            var linkDefs = [
                { label: '安装引导页', page: 'install_guide.html' },
                { label: '注册页', page: 'register.html' }
            ];
            var allLines = [];
            var html =
                '<div class="agent-promo-links-head"><span>站点：<code>' +
                esc(origin) +
                '</code></span><span>共 ' +
                channelIds.length +
                ' 个渠道</span></div>';
            channelIds.forEach(function (ch) {
                html += '<div class="agent-promo-channel-block">';
                html += '<div class="agent-promo-channel-title">' + esc(ch) + '</div>';
                linkDefs.forEach(function (def) {
                    var url = buildAgentPromoLink(origin, def.page, ch);
                    allLines.push(ch + ' · ' + def.label + '：' + url);
                    html +=
                        '<div class="agent-promo-link-row">' +
                        '<span class="agent-promo-link-label">' +
                        esc(def.label) +
                        '</span>' +
                        '<code class="agent-promo-link-url">' +
                        esc(url) +
                        '</code>' +
                        '<button type="button" class="btn-sm btn-copy btn-copy-agent-promo" data-copy="' +
                        esc(url) +
                        '">复制</button>' +
                        '</div>';
                });
                html += '</div>';
            });
            mount.innerHTML = html;
            mount.style.display = 'block';
            _agentPromoLinksCache = allLines;
            if (copyAllBtn) {
                copyAllBtn.style.display = 'inline-block';
            }
        }

        function bindAgentPromoLinksUi() {
            var genBtn = document.getElementById('btnGenerateAgentPromoLinks');
            var copyAllBtn = document.getElementById('btnCopyAllAgentPromoLinks');
            var mount = document.getElementById('agentPromoLinksMount');
            if (genBtn && genBtn.getAttribute('data-bound') !== '1') {
                genBtn.setAttribute('data-bound', '1');
                genBtn.addEventListener('click', function () {
                    var raw = document.getElementById('xianyuHideSalesChannels');
                    renderAgentPromoLinks(parseAgentChannelIds(raw ? raw.value : ''));
                });
            }
            if (copyAllBtn && copyAllBtn.getAttribute('data-bound') !== '1') {
                copyAllBtn.setAttribute('data-bound', '1');
                copyAllBtn.addEventListener('click', function () {
                    if (!_agentPromoLinksCache.length) {
                        alert('请先生成代理推广链接');
                        return;
                    }
                    copyCode(_agentPromoLinksCache.join('\n'));
                });
            }
            if (mount && mount.getAttribute('data-copy-bound') !== '1') {
                mount.setAttribute('data-copy-bound', '1');
                mount.addEventListener('click', function (e) {
                    var btn = e.target.closest('.btn-copy-agent-promo');
                    if (!btn) {
                        return;
                    }
                    copyCode(btn.getAttribute('data-copy') || '');
                });
            }
        }

        function keyForUser(username) {
            return encodeURIComponent(String(username || '')).replace(/%/g, '_');
        }

        function formatMoneyLike(v) {
            if (v == null || String(v).trim() === '') return '0.00';
            return esc(String(v));
        }

        /** HTML 页面对应中文 title（与页面 title 标签一致） */
        var PAGE_TITLE_ZH = {
            'index.html': '个人所得税',
            'login.html': '个人所得税',
            'shouye.html': '首页',
            'mine.html': '我的',
            'consult.html': '个人中心',
            'profile.html': '个人中心',
            'shuiming.html': '收入纳税明细',
            'shuiming_result.html': '收入纳税明细',
            'xiangqing.html': '收入纳税明细详情',
            'daiban.html': '待办',
            'bancha.html': '办查',
            'message.html': '消息',
            'message_detail.html': '消息详情',
            'zonghe.html': '综合所得年度汇算',
            'renzhi.html': '任职受雇',
            'renzhi_detail.html': '详情',
            'jtcy.html': '家庭成员',
            'jtcy_add.html': '添加家庭成员',
            'jtcy_detail.html': '详情',
            'yhk.html': '银行卡',
            'yhk_add.html': '添加银行卡',
            'yhk_manage.html': '管理',
            'aqzx.html': '安全中心',
            'xiugaimima.html': '修改密码',
            'zhzh_jhm.html': '找回账号密码',
            'gerenxinxi.html': '个人信息',
            'personal_info.html': '个人信息',
            'register.html': '注册账号',
            'najilu.html': '纳税记录开具',
            'shenbao_jilu.html': '申报记录',
            'shenbao_jilu_detail.html': '申报记录详情',
            'shenbao_income_detail.html': '工资薪金',
            'shuikuanjisuan.html': '税款计算',
            'zxkouchu.html': '专项附加扣除',
            'zxk_zhengce.html': '专项附加扣除政策介绍',
            'tax_benefit.html': '可享税收优惠信息',
            'wodepiaojia.html': '我的票夹',
            'wodepiaojia-xiaoshou.html': '我的票夹',
            'weituodaili.html': '委托代理关系管理',
            'sheshuifuwu.html': '涉税服务人员信息管理',
            'sheshuizhuanye.html': '涉税专业服务机构',
            'shuiwuwenshu.html': '税务文书',
            'yiyishensu.html': '申诉记录',
            'gerenyanglao.html': '个人养老金',
            'jingyingsuode.html': '经营所得',
            'gongyicishan.html': '公益慈善',
            'other_id.html': '其他身份证件',
            'help_center.html': '帮助中心',
            'install_guide.html': '引导安装',
            'care_version.html': '关怀版',
            'about_update.html': '关于',
            'about_agreement.html': '协议'
        };

        function htmlFileFromPagePath(pagePath) {
            var p = String(pagePath || '').trim().toLowerCase();
            if (!p) return '';
            var eventM = p.match(/\/event\/jump\/([a-z0-9_-]+)_html/);
            if (eventM) return eventM[1].replace(/-/g, '_') + '.html';
            var fileM = p.match(/\/([^/?#]+\.html)$/);
            return fileM ? fileM[1] : '';
        }

        function chineseTitleFromPagePath(pagePath) {
            var p = String(pagePath || '').trim().toLowerCase();
            if (!p) return '—';
            if (p.indexOf('__history_back__') >= 0 || p.indexOf('_history_back__') >= 0) {
                return '返回上一页';
            }
            var file = htmlFileFromPagePath(p);
            var title = file && PAGE_TITLE_ZH[file] ? PAGE_TITLE_ZH[file] : '';
            if (!title && file) {
                var stem = file.replace(/\.html$/, '');
                var trackName = pageNameFromTrackKey(stem);
                var m = trackName.match(/^(.+?)（/);
                title = m ? m[1] : trackName;
            }
            var tabM = p.match(/tab_([a-z0-9_]+)/);
            if (tabM) {
                var tabMap = {
                    employers: '任职信息',
                    messages: '消息通知',
                    records: '税务记录',
                    profile: '个人资料'
                };
                var tabLabel = tabMap[tabM[1]] || tabM[1];
                return (title || '个人中心') + ' - ' + tabLabel;
            }
            if (title) return title;
            if (p.indexOf('/event/') === 0) return '页面内操作';
            return p;
        }

        function formatPageRouteKey(routeKey) {
            var rk = String(routeKey || '').trim();
            return rk || '—';
        }

        function pageNameFromTrackKey(pageKey) {
            var k = String(pageKey || '').toLowerCase();
            var map = {
                shouye: '首页（shouye.html）',
                mine: '我的（mine.html）',
                consult: '我要咨询（consult.html）',
                shuiming: '税务记录（shuiming.html）',
                xiangqing: '纳税明细详情（xiangqing.html）',
                daiban: '待办（daiban.html）',
                bancha: '办查（bancha.html）',
                message: '消息（message.html）',
                zonghe: '综合（zonghe.html）',
                renzhi: '任职（renzhi.html）',
                jtcy: '家庭成员（jtcy.html）',
                jtcy_add: '添加家庭成员（jtcy_add.html）',
                jtcy_detail: '家庭成员详情（jtcy_detail.html）',
                yhk: '银行卡（yhk.html）',
                yhk_add: '添加银行卡（yhk_add.html）',
                aqzx: '安全中心（aqzx.html）',
                gerenxinxi: '个人信息（gerenxinxi.html）',
                profile: '个人中心（profile.html）',
                register: '注册（register.html）',
                index: '登录（index.html）',
                najilu: '纳税记录开具（najilu.html）'
            };
            return map[k] || (k ? (k + '.html') : '—');
        }

        function parseTrackEventMeta(eventKey) {
            var k = String(eventKey || '').trim().toLowerCase();
            if (!k) {
                return { button: '—', page: '—' };
            }
            if (k === 'register_success') {
                return { button: '注册成功', page: '注册（register.html，服务端入库）' };
            }
            if (k === 'register_submit') {
                return { button: '注册提交', page: '注册（register.html，服务端收到请求）' };
            }
            if (k === 'track_register_submit') {
                return { button: '注册提交按钮', page: '注册（register.html，前端点击）' };
            }
            if (k === 'track_register_success') {
                return { button: '注册成功', page: '注册（register.html，前端收到成功）' };
            }
            if (k === 'track_activate_prompt_open') {
                return { button: '激活弹窗打开', page: '我的/我要咨询（弹窗）' };
            }
            if (k === 'track_activate_prompt_confirm') {
                return { button: '激活弹窗-确定', page: '我的/我要咨询（弹窗）' };
            }
            if (k === 'track_activate_prompt_cancel') {
                return { button: '激活弹窗-取消', page: '我的/我要咨询（弹窗）' };
            }
            if (k === 'track_xianyu_purchase_click') {
                return { button: '闲鱼购买', page: '我的/我要咨询（激活弹窗）' };
            }
            if (k === 'track_qq_add_click' || k === 'track_consult_qq_add_click') {
                return { button: '添加QQ号', page: '我的/我要咨询（顶栏或咨询修改弹窗）' };
            }
            if (k === 'track_qq_group_click') {
                return { button: '加入QQ群', page: '激活成功/填税完成/消息/帮助页等' };
            }
            if (k.indexOf('track_jump_') === 0) {
                var raw = k.substring('track_jump_'.length);
                if (raw === '_history_back__' || raw === '__history_back__') {
                    return { button: '返回按钮', page: '返回上一页' };
                }
                var m = raw.match(/^([a-z0-9]+)_html(?:_(.*))?$/);
                var pageKey = m ? m[1] : '';
                var rest = m && m[2] ? m[2] : '';
                var button = '页面跳转按钮';
                if (rest.indexOf('tab_') === 0) {
                    var tabName = rest.substring(4);
                    var tabMap = {
                        employers: '任职信息',
                        messages: '消息通知',
                        records: '税务记录',
                        profile: '个人资料'
                    };
                    button = '标签切换：' + (tabMap[tabName] || tabName);
                } else if (rest && !/^id_tr_|^id_|^tr_/.test(rest)) {
                    button = '跳转动作：' + rest;
                }
                return { button: button, page: pageNameFromTrackKey(pageKey) };
            }
            return { button: '其他埋点', page: '—' };
        }

        function computeClientTaxAvgSalary6mLabel(records) {
            if (!records || !records.length) return '未填写';
            var byMonth = {};
            records.forEach(function (r) {
                var y = r.year != null ? Number(r.year) : NaN;
                var m = r.month != null ? Number(r.month) : NaN;
                if (isNaN(y) || isNaN(m)) {
                    var tp = r.tax_period ? String(r.tax_period).trim() : '';
                    var mm = tp.match(/^(\d{4})-(\d{1,2})/);
                    if (mm) {
                        y = Number(mm[1]);
                        m = Number(mm[2]);
                    }
                }
                if (isNaN(y) || isNaN(m)) return;
                var key = y + '-' + String(m).padStart(2, '0');
                var inc = Number(r.income);
                if (isNaN(inc)) {
                    inc = parseFloat(String(r.income || '').replace(/,/g, '')) || 0;
                }
                if (inc < 0) inc = 0;
                if (!byMonth[key]) byMonth[key] = 0;
                byMonth[key] += inc;
            });
            var keys = Object.keys(byMonth).sort().reverse().slice(0, 6);
            var picked = keys.filter(function (k) {
                return byMonth[k] > 0;
            });
            if (!picked.length) return '未填写';
            var sum = 0;
            picked.forEach(function (k) {
                sum += byMonth[k];
            });
            var avg = Math.round((sum / picked.length) * 100) / 100;
            var label = avg.toFixed(2) + ' 元';
            if (picked.length < 6) {
                label += '（' + picked.length + '个月平均）';
            }
            return label;
        }

        function formatTaxChangeVal(v) {
            if (v == null || String(v).trim() === '') {
                return '—';
            }
            return esc(String(v));
        }

        var ADMIN_TAX_RECORD_COLUMNS = [
            { key: 'tax_period', label: '税款所属期' },
            { key: 'year', label: '年' },
            { key: 'month', label: '月' },
            { key: 'income_type', label: '所得项目' },
            { key: 'income_subtype', label: '所得小类' },
            { key: 'company_name', label: '扣缴义务人', cellClass: 'cell-break' },
            { key: 'company_tax_id', label: '纳税人识别号', cellClass: 'cell-break' },
            { key: 'tax_authority', label: '主管税务机关', cellClass: 'cell-break' },
            { key: 'report_channel', label: '申报渠道' },
            { key: 'report_date', label: '申报日期' },
            { key: 'income', label: '收入', money: true },
            { key: 'tax_reported', label: '已申报税额', money: true },
            { key: 'income_this_period', label: '本期收入', money: true },
            { key: 'tax_free_income', label: '本期免税收入', money: true },
            { key: 'deduction_fee', label: '本期减除费用', money: true },
            { key: 'special_deduction', label: '本期专项扣除', money: true },
            { key: 'pension_insurance', label: '基本养老保险', money: true },
            { key: 'medical_insurance', label: '基本医疗保险', money: true },
            { key: 'unemployment_insurance', label: '失业保险', money: true },
            { key: 'housing_fund', label: '住房公积金', money: true },
            { key: 'other_deduction', label: '本期其他扣除', money: true },
            { key: 'donation_deduction', label: '捐赠扣除', money: true },
            { key: 'updated_at', label: '最后更新', dt: true }
        ];

        function normalizeAdminTaxRecordRow(r) {
            var row = r || {};
            if (!row.tax_period && row.year != null && row.month != null) {
                row = Object.assign({}, row, {
                    tax_period: row.year + '-' + String(row.month).padStart(2, '0')
                });
            }
            return row;
        }

        function renderAdminTaxRecordCell(r, col) {
            var v = r[col.key];
            if (col.dt && v) {
                return esc(formatDt(v));
            }
            if (col.money) {
                return formatMoneyLike(v);
            }
            if (col.key === 'month' && v != null && v !== '') {
                return esc(String(v).padStart(2, '0'));
            }
            if (v == null || v === '') {
                return '—';
            }
            return esc(String(v));
        }

        function renderAdminTaxRecordsTable(records) {
            if (!records || !records.length) {
                return '<div style="color:#999;">暂无个税记录</div>';
            }
            var html =
                '<p style="font-size:12px;color:#999;margin:0 0 8px 0;">与咨询端表单字段一致，可左右滑动查看全部列。</p>';
            html += '<div class="scroll-x"><table class="user-detail-table admin-tax-records-table"><thead><tr>';
            ADMIN_TAX_RECORD_COLUMNS.forEach(function (col) {
                html += '<th>' + esc(col.label) + '</th>';
            });
            html += '</tr></thead><tbody>';
            records.forEach(function (raw) {
                var r = normalizeAdminTaxRecordRow(raw);
                html += '<tr>';
                ADMIN_TAX_RECORD_COLUMNS.forEach(function (col) {
                    var cls = col.cellClass ? ' class="' + col.cellClass + '"' : '';
                    html += '<td' + cls + '>' + renderAdminTaxRecordCell(r, col) + '</td>';
                });
                html += '</tr>';
            });
            html += '</tbody></table></div>';
            return html;
        }

        function buildTodayTaxChangesHtml(payload) {
            var changes = payload && Array.isArray(payload.today_tax_changes) ? payload.today_tax_changes : [];
            var changeDate = payload && payload.change_date ? String(payload.change_date) : '';
            var modifiedFlag = !!(payload && payload.tax_modified_on_date);
            if (!changes.length) {
                if (!modifiedFlag) {
                    return '';
                }
                return (
                    '<details class="tax-change-section tax-change-collapsible">' +
                    '<summary class="tax-change-summary">当日个税修改（' +
                    esc(changeDate || '今日') +
                    '）</summary>' +
                    '<div class="tax-change-body">' +
                    '<p style="font-size:13px;color:#888;margin:0;">该账号当日有个税记录变动，但尚无修改前后快照（多为功能上线前的改动，或仅触发了库表更新时间）。请查看下方当前个税记录。</p>' +
                    '</div></details>'
                );
            }
            var html =
                '<details class="tax-change-section tax-change-collapsible">' +
                '<summary class="tax-change-summary">当日个税修改对比（' +
                esc(changeDate || '今日') +
                '，' +
                changes.length +
                ' 次）</summary>' +
                '<div class="tax-change-body">';
            changes.forEach(function (ch, idx) {
                var period =
                    (ch.after && ch.after.tax_period) ||
                    (ch.before && ch.before.tax_period) ||
                    ch.record_id ||
                    '—';
                html += '<div class="tax-change-item">';
                html +=
                    '<div class="tax-change-meta">#' +
                    (idx + 1) +
                    ' · ' +
                    esc(ch.action_label || ch.action || '修改') +
                    ' · 记录 ' +
                    esc(period) +
                    ' · ' +
                    esc(ch.changed_at ? formatDt(ch.changed_at) : '—') +
                    '</div>';
                if (ch.action === 'insert' && ch.after) {
                    html += '<div class="scroll-x"><table class="tax-change-diff-table"><tbody>';
                    (ch.field_diffs || []).forEach(function (fd) {
                        if (!fd.after) {
                            return;
                        }
                        html +=
                            '<tr><th>' +
                            esc(fd.label) +
                            '</th><td><span class="tax-change-val-after">' +
                            formatTaxChangeVal(fd.after) +
                            '</span> <span style="color:#888;font-size:12px;">（新增）</span></td></tr>';
                    });
                    html += '</tbody></table></div>';
                } else if (ch.action === 'delete' && ch.before) {
                    html += '<div class="scroll-x"><table class="tax-change-diff-table"><tbody>';
                    (ch.field_diffs || []).forEach(function (fd) {
                        if (!fd.before) {
                            return;
                        }
                        html +=
                            '<tr><th>' +
                            esc(fd.label) +
                            '</th><td><span class="tax-change-val-before">' +
                            formatTaxChangeVal(fd.before) +
                            '</span> <span style="color:#888;font-size:12px;">（已删除）</span></td></tr>';
                    });
                    html += '</tbody></table></div>';
                } else if (ch.field_diffs && ch.field_diffs.length) {
                    html +=
                        '<div class="scroll-x"><table class="tax-change-diff-table"><thead><tr><th>字段</th><th>修改前</th><th>修改后</th></tr></thead><tbody>';
                    ch.field_diffs.forEach(function (fd) {
                        html += '<tr>';
                        html += '<th>' + esc(fd.label) + '</th>';
                        html +=
                            '<td class="tax-change-val-before">' + formatTaxChangeVal(fd.before) + '</td>';
                        html +=
                            '<td class="tax-change-val-after">' + formatTaxChangeVal(fd.after) + '</td>';
                        html += '</tr>';
                    });
                    html += '</tbody></table></div>';
                } else {
                    html += '<div style="color:#888;font-size:13px;">无字段差异明细</div>';
                }
                html += '</div>';
            });
            html += '</div></details>';
            return html;
        }

        function buildTaxRecordsHtml(username, payload) {
            var records = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.records) ? payload.records : []);
            var devices = payload && Array.isArray(payload.devices) ? payload.devices : [];
            var pages = payload && Array.isArray(payload.recent_pages) ? payload.recent_pages : [];
            var issues = payload && Array.isArray(payload.issue_applications) ? payload.issue_applications : [];
            var html = '<div class="user-detail-wrap">';
            html += '<div class="user-detail-title">账号「' + esc(username) + '」详情</div>';
            html += '<div style="margin:0 0 8px 0;color:#666;">登录机型设备（' + devices.length + ' 台）</div>';
            if (!devices.length) {
                html += '<div style="color:#999;margin-bottom:10px;">暂无设备记录</div>';
            } else {
                html += '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>字段</th><th>内容</th></tr></thead><tbody>';
                devices.forEach(function (d, idx) {
                    var model = d.model || d.user_agent_short || '—';
                    var sys = [d.platform || '', d.os_version || ''].filter(Boolean).join(' ');
                    var seen = d.last_seen ? formatDt(d.last_seen) : '—';
                    var syncTxt = '登录' + (d.login_count || 0) + '次';
                    var ipTxt = d.ip_last ? String(d.ip_last) : '—';
                    var cityTxt = d.city_last && String(d.city_last).trim() ? String(d.city_last).trim() : '';
                    if (ipTxt !== '—' && cityTxt && cityTxt !== '—') {
                        ipTxt = ipTxt + '（' + cityTxt + '）';
                    }
                    if (idx > 0) {
                        html += '<tr><td colspan="2" style="background:#f8fbff;color:#999;">— 设备分隔 —</td></tr>';
                    }
                    html += '<tr><td>机型</td><td class="cell-break">' + esc(model) + '</td></tr>';
                    html += '<tr><td>系统</td><td>' + esc(sys || '—') + '</td></tr>';
                    html += '<tr><td>最近登录/同步</td><td>' + esc(seen + ' / IP:' + ipTxt + ' / ' + syncTxt) + '</td></tr>';
                });
                html += '</tbody></table></div>';
            }

            if (!pages.length) {
                html += '<div style="color:#999;margin-bottom:10px;">暂无页面点击记录</div>';
            } else {
                html += '<div class="user-detail-pages-collapsible">';
                html +=
                    '<button type="button" class="user-detail-pages-toggle" aria-expanded="false" title="点击展开或收起">';
                html += '<span class="user-detail-pages-toggle-label">最近进入页面（去重，' + pages.length + ' 个）</span>';
                html += '<span class="user-detail-pages-chevron" aria-hidden="true">▼</span>';
                html += '</button>';
                html += '<div class="user-detail-pages-panel" hidden>';
                html +=
                    '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>接口名</th><th>中文标题</th><th>最近进入时间</th></tr></thead><tbody>';
                pages.forEach(function (p) {
                    html += '<tr>';
                    html += '<td class="cell-break"><code>' + esc(formatPageRouteKey(p.route_key)) + '</code></td>';
                    html += '<td>' + esc(chineseTitleFromPagePath(p.page_path)) + '</td>';
                    html += '<td>' + esc(p.last_entered_at ? formatDt(p.last_entered_at) : '—') + '</td>';
                    html += '</tr>';
                });
                html += '</tbody></table></div>';
                html += '</div></div>';
            }

            html += '<div style="margin:10px 0 8px 0;color:#666;">纳税记录开具申请（' + issues.length + ' 条）</div>';
            if (!issues.length) {
                html += '<div style="color:#999;margin-bottom:10px;">暂无申请记录（用户端生成成功后会自动上报）</div>';
            } else {
                html += '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>申请时间</th><th>税款所属期</th><th>开具范围</th><th>状态</th><th>记录号</th><th>查询码</th><th>上报时间</th></tr></thead><tbody>';
                issues.forEach(function (it) {
                    var period = (it.period_start || '—') + ' 至 ' + (it.period_end || '—');
                    html += '<tr>';
                    html += '<td>' + esc(it.apply_time || '—') + '</td>';
                    html += '<td>' + esc(period) + '</td>';
                    html += '<td>' + esc(it.scope || '—') + '</td>';
                    html += '<td>' + esc(it.status || '—') + '</td>';
                    html += '<td>' + esc(it.record_no || '—') + '</td>';
                    html += '<td class="cell-break"><code>' + esc(it.query_code || '—') + '</code></td>';
                    html += '<td>' + esc(it.created_at ? formatDt(it.created_at) : '—') + '</td>';
                    html += '</tr>';
                });
                html += '</tbody></table></div>';
            }

            var avgSalLabel =
                payload && payload.avg_salary_6m_label ? String(payload.avg_salary_6m_label) : '未填写';
            if ((!avgSalLabel || avgSalLabel === '未填写') && records.length) {
                avgSalLabel = computeClientTaxAvgSalary6mLabel(records);
            }
            html +=
                '<div style="margin:12px 0 8px 0;padding:10px 12px;background:#f8fbff;border-radius:8px;color:#333;">近六个月平均工资（个税记录收入）：<strong>' +
                esc(avgSalLabel) +
                '</strong></div>';

            html += buildTodayTaxChangesHtml(payload);

            html += '<div style="margin:10px 0 8px 0;color:#666;">个税记录（' + records.length + ' 条）</div>';
            html += renderAdminTaxRecordsTable(records);
            html += '</div>';
            return html;
        }

        var userPage = 1;
        var USER_LIMIT_STORAGE_KEY = 'admin_user_list_limit';
        var USER_LIMIT_OPTIONS = [10, 20, 50, 100];
        var userLimit = 10;
        var deletedUserPage = 1;
        var deletedUserLimit = 10;
        var DELETED_USER_LIMIT_STORAGE_KEY = 'admin_deleted_user_list_limit';
        (function initUserListPageLimit() {
            var saved = parseInt(localStorage.getItem(USER_LIMIT_STORAGE_KEY), 10);
            if (USER_LIMIT_OPTIONS.indexOf(saved) >= 0) {
                userLimit = saved;
            }
            var sel = document.getElementById('userPageLimit');
            if (sel) {
                sel.value = String(userLimit);
            }
            var savedDeleted = parseInt(localStorage.getItem(DELETED_USER_LIMIT_STORAGE_KEY), 10);
            if (USER_LIMIT_OPTIONS.indexOf(savedDeleted) >= 0) {
                deletedUserLimit = savedDeleted;
            }
            var selDeleted = document.getElementById('deletedUserPageLimit');
            if (selDeleted) {
                selDeleted.value = String(deletedUserLimit);
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
        var _adminDeletedUsersLoaded = false;
        var _adminUserDataLoaded = false;
        var _adminUserBehaviorLoaded = false;
        var _adminActivatedUserAnalysisLoaded = false;
        var userDataPage = 1;
        var userDataLimit = 15;
        var _adminCodesLoaded = false;
        var _adminAnalyticsActivitySeen = false;
        var _adminAnalyticsRegisterSeen = false;
        var _adminAnalyticsTrackingSeen = false;
        var _adminAnalyticsDevicesSeen = false;
        var _adminInstallGuideStatsSeen = false;
        var _adminChannelAnalysisSeen = false;
        var _adminApiAnalyticsSeen = false;
        var _adminServerMonitorSeen = false;
        var _channelAnalysisChartInstances = [];

        function adminHasMenu(menuKey) {
            if (!menuKey) return false;
            if (menuKey === 'user-login-log') menuKey = 'login-log';
            if (currentAdminProfile && currentAdminProfile.is_super) return true;
            var menus = currentAdminProfile && Array.isArray(currentAdminProfile.menus) ? currentAdminProfile.menus : [];
            if (menus.indexOf(menuKey) >= 0) return true;
            if (menuKey.indexOf('analytics-') === 0 && menus.indexOf('analytics') >= 0) return true;
            return false;
        }

        function firstAllowedAdminPage() {
            var order = ['settings', 'install-guide', 'appearance', 'codes', 'admin-accounts', 'users', 'users-deleted', 'user-data', 'user-behavior', 'activated-user-analysis', 'feedback', 'login-log', 'user-login-log', 'server-monitor', 'analytics-conversion', 'analytics-activity', 'analytics-register', 'analytics-tracking', 'analytics-devices', 'install-guide-stats', 'channel-analysis', 'api-analytics'];
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
            var batchWrap = document.getElementById('batchIssueWrap');
            if (batchWrap) {
                batchWrap.style.display = currentAdminProfile && currentAdminProfile.is_super ? 'flex' : 'none';
            }
        }

        function normalizeAdminPage(raw) {
            var k = String(raw || '').replace(/^#/, '').trim().toLowerCase();
            if (k === 'system' || k === 'setting') k = 'settings';
            if (k === 'install' || k === 'guide') k = 'install-guide';
            if (k === 'analytics') k = 'analytics-conversion';
            var ok = {
                settings: 1,
                'install-guide': 1,
                appearance: 1,
                codes: 1,
                'admin-accounts': 1,
                users: 1,
                'users-deleted': 1,
                'user-data': 1,
                'user-behavior': 1,
                'activated-user-analysis': 1,
                feedback: 1,
                'analytics-conversion': 1,
                'analytics-activity': 1,
                'analytics-register': 1,
                'analytics-tracking': 1,
                'analytics-devices': 1,
                'install-guide-stats': 1,
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
            if (pageKey === 'users-deleted' && !_adminDeletedUsersLoaded) {
                _adminDeletedUsersLoaded = true;
                loadDeletedUsers(1);
            }
            if (pageKey === 'user-data' && !_adminUserDataLoaded) {
                _adminUserDataLoaded = true;
                loadUserDataAnalytics();
                loadUserDataList(1);
            }
            if (pageKey === 'user-behavior' && !_adminUserBehaviorLoaded) {
                _adminUserBehaviorLoaded = true;
                loadNoTaxBehaviorList(1);
            }
            if (pageKey === 'activated-user-analysis' && !_adminActivatedUserAnalysisLoaded) {
                _adminActivatedUserAnalysisLoaded = true;
                loadActivatedUserAnalysisOverview();
                loadActivatedUserAnalysisUsers(1);
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
            if (pageKey === 'analytics-conversion') {
                loadAnalyticsConversionPage();
            }
            if (pageKey === 'analytics-activity' && !_adminAnalyticsActivitySeen) {
                _adminAnalyticsActivitySeen = true;
                loadAnalyticsActivityPage();
            }
            if (pageKey === 'analytics-register' && !_adminAnalyticsRegisterSeen) {
                _adminAnalyticsRegisterSeen = true;
                loadAnalyticsRegisterPage();
            }
            if (pageKey === 'analytics-tracking' && !_adminAnalyticsTrackingSeen) {
                _adminAnalyticsTrackingSeen = true;
                loadAnalyticsTrackingPage();
            }
            if (pageKey === 'analytics-devices' && !_adminAnalyticsDevicesSeen) {
                _adminAnalyticsDevicesSeen = true;
                loadAnalyticsDevicesPage();
            }
            if (pageKey === 'install-guide-stats' && !_adminInstallGuideStatsSeen) {
                _adminInstallGuideStatsSeen = true;
                loadInstallGuideStats();
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

        var feedbackAdminPage = 1;
        var feedbackAdminLimit = 15;
        var feedbackAdminLastItems = [];
        var feedbackReplyEditingId = null;

        function closeFeedbackReplyModal() {
            var bd = document.getElementById('feedbackReplyBackdrop');
            if (bd) {
                bd.setAttribute('hidden', '');
            }
            feedbackReplyEditingId = null;
        }

        function openFeedbackReplyModal(row) {
            feedbackReplyEditingId = row.id;
            var meta =
                'ID #' +
                row.id +
                ' · 账号 ' +
                (row.user_id || '') +
                ' · ' +
                (row.real_name_snapshot || '—') +
                '\n\n用户原文：\n' +
                (row.content || '');
            document.getElementById('feedbackReplyMeta').textContent = meta;
            document.getElementById('feedbackReplyText').value =
                row.admin_reply != null ? String(row.admin_reply) : '';
            var bd = document.getElementById('feedbackReplyBackdrop');
            if (bd) {
                bd.removeAttribute('hidden');
            }
        }

        function loadAdminFeedbackPage(page) {
            if (page != null && isFinite(page)) {
                feedbackAdminPage = Math.max(1, parseInt(page, 10) || 1);
            }
            var typeF = document.getElementById('feedbackFilterType');
            var activeF = document.getElementById('feedbackFilterActive');
            var t = typeF ? typeF.value : '';
            var active = activeF ? activeF.value : '';
            var q =
                'api/admin/feedback?page=' +
                encodeURIComponent(feedbackAdminPage) +
                '&limit=' +
                encodeURIComponent(feedbackAdminLimit);
            if (t) {
                q += '&type=' + encodeURIComponent(t);
            }
            if (active) {
                q += '&active=' + encodeURIComponent(active);
            }
            document.getElementById('feedbackAdminTbody').innerHTML =
                '<tr><td colspan="10">加载中…</td></tr>';
            adminFetch(q)
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        document.getElementById('feedbackAdminTbody').innerHTML =
                            '<tr><td colspan="10">' + esc(j.msg || '加载失败') + '</td></tr>';
                        return;
                    }
                    var items = j.data.items || [];
                    feedbackAdminLastItems = items;
                    var total = j.data.total != null ? Number(j.data.total) : 0;
                    var tp = j.data.total_pages != null ? Number(j.data.total_pages) : 1;
                    if (tp < 1) {
                        tp = 1;
                    }
                    document.getElementById('feedbackAdminPageInfo').textContent =
                        '第 ' + feedbackAdminPage + ' / ' + tp + ' 页 · 共 ' + total + ' 条';
                    var prev = document.getElementById('feedbackAdminPrev');
                    var next = document.getElementById('feedbackAdminNext');
                    if (prev) {
                        prev.disabled = feedbackAdminPage <= 1;
                    }
                    if (next) {
                        next.disabled = feedbackAdminPage >= tp;
                    }
                    var html = '';
                    if (!items.length) {
                        html = '<tr><td colspan="10">暂无数据</td></tr>';
                    } else {
                        items.forEach(function (r) {
                            var typLabel = r.feedback_type === 'bug' ? 'BUG' : '意见优化';
                            var actLabel = r.account_active
                                ? '<span class="badge badge-yes">已激活</span>'
                                : '<span class="badge badge-no">未激活</span>';
                            var snippet = String(r.content || '');
                            if (snippet.length > 100) {
                                snippet = snippet.substring(0, 100) + '…';
                            }
                            var hasReply = r.admin_reply && String(r.admin_reply).trim();
                            var repSnippet = hasReply ? String(r.admin_reply) : '';
                            if (repSnippet.length > 60) {
                                repSnippet = repSnippet.substring(0, 60) + '…';
                            }
                            html += '<tr>';
                            html += '<td>' + esc(String(r.id)) + '</td>';
                            html += '<td class="cell-break">' + esc(r.user_id || '') + '</td>';
                            html += '<td>' + esc(r.real_name_snapshot || '—') + '</td>';
                            html += '<td>' + actLabel + '</td>';
                            html += '<td>' + esc(typLabel) + '</td>';
                            html += '<td class="cell-break">' + esc(snippet) + '</td>';
                            html += '<td>' + esc(formatDt(r.created_at)) + '</td>';
                            html += '<td>' + esc(hasReply ? '已回复' : '待回复') + '</td>';
                            html +=
                                '<td class="cell-break">' + esc(hasReply ? repSnippet : '—') + '</td>';
                            html +=
                                '<td><button type="button" class="btn-sm btn-copy" data-feedback-id="' +
                                esc(String(r.id)) +
                                '">' +
                                esc(hasReply ? '修改回复' : '回复') +
                                '</button></td>';
                            html += '</tr>';
                        });
                    }
                    document.getElementById('feedbackAdminTbody').innerHTML = html;
                })
                .catch(function () {
                    document.getElementById('feedbackAdminTbody').innerHTML =
                        '<tr><td colspan="10">网络错误</td></tr>';
                });
        }

        function loadApiAnalyticsPanel() {
            var daysA = analyticsPeriodVal(document.getElementById('apiAnalyticsDays'));
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
            'track_qq_add_click',
            'track_qq_group_click'
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

        function loadAnalyticsConversionPage() {
            loadAnalyticsDailyConversion();
            loadRegistrationFunnel();
            loadConversionKpis();
            loadPendingActivate24h(1);
        }

        function loadAnalyticsRegisterPage() {
            loadAnalyticsRegisterTime();
            loadAnalyticsRegisterGender();
        }

        function loadAnalyticsActivityPage() {
            var daysO = analyticsPeriodVal(document.getElementById('analyticsOverviewDays'));
            document.getElementById('analyticsDauTbody').innerHTML = '<tr><td colspan="3">加载中…</td></tr>';
            document.getElementById('analyticsLoginTbody').innerHTML = '<tr><td colspan="3">加载中…</td></tr>';
            document.getElementById('analyticsLoginReasonTbody').innerHTML = '<tr><td colspan="2">加载中…</td></tr>';
            adminFetch('api/admin/analytics/overview?days=' + encodeURIComponent(daysO))
                .then(function (r) { return r.json(); })
                .then(function (ov) {
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
                })
                .catch(function () {
                    document.getElementById('analyticsDauTbody').innerHTML = '<tr><td colspan="3">网络错误</td></tr>';
                    document.getElementById('analyticsLoginTbody').innerHTML = '<tr><td colspan="3">网络错误</td></tr>';
                    document.getElementById('analyticsLoginReasonTbody').innerHTML = '<tr><td colspan="2">网络错误</td></tr>';
                });
        }

        function loadAnalyticsTrackingPage() {
            loadInstallTrackStats();
            var daysT = analyticsPeriodVal(document.getElementById('analyticsTrackingDays'));
            document.getElementById('analyticsEventsTbody').innerHTML = '<tr><td colspan="4">加载中…</td></tr>';
            var evtHintInit = document.getElementById('analyticsEventsHint');
            if (evtHintInit) evtHintInit.textContent = '加载中…';
            document.getElementById('activateEventsSummaryTbody').innerHTML =
                '<tr><td colspan="3">加载中…</td></tr>';
            document.getElementById('activateEventsDailyTbody').innerHTML =
                '<tr><td colspan="9">加载中…</td></tr>';
            var activateHintInit = document.getElementById('activateEventsHint');
            if (activateHintInit) {
                activateHintInit.textContent = '加载中…';
            }

            Promise.all([
                adminFetch('api/admin/analytics/events?days=' + encodeURIComponent(daysT)).then(function (r) { return r.json(); }),
                adminFetch('api/admin/analytics/activate-events?days=' + encodeURIComponent(daysT)).then(function (r) {
                    return r.json();
                })
            ]).then(function (results) {
                var ev = results[0];
                var act = results[1];

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
            }).catch(function () {
                document.getElementById('analyticsEventsTbody').innerHTML = '<tr><td colspan="4">网络错误</td></tr>';
                var evtHintErr = document.getElementById('analyticsEventsHint');
                if (evtHintErr) evtHintErr.textContent = '埋点统计加载失败（网络错误）';
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

        function loadAnalyticsDeviceStats() {
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

            adminFetch('api/admin/analytics/device-stats')
                .then(function (r) { return r.json(); })
                .then(function (dev) {
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
                })
                .catch(function () {
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
                });
        }

        function loadAnalyticsDevicesPage() {
            loadAnalyticsDeviceStats();
        }

        function loadAnalyticsDashboard() {
            loadAnalyticsConversionPage();
            loadAnalyticsActivityPage();
            loadAnalyticsRegisterPage();
            loadAnalyticsTrackingPage();
            loadAnalyticsDevicesPage();
        }

        function formatMonitorUptime(sec) {
            var s = parseInt(sec, 10) || 0;
            if (s < 60) return s + ' 秒';
            var m = Math.floor(s / 60);
            if (m < 60) return m + ' 分钟';
            var h = Math.floor(m / 60);
            m = m % 60;
            if (h < 24) return h + ' 小时 ' + m + ' 分';
            var d = Math.floor(h / 24);
            h = h % 24;
            return d + ' 天 ' + h + ' 小时';
        }

        function renderServerMonitor(data) {
            var emailEl = document.getElementById('monitorAlertEmail');
            if (emailEl) {
                emailEl.textContent = data.alert_email || '—';
            }
            var smtpEl = document.getElementById('monitorSmtpStatus');
            if (smtpEl) {
                smtpEl.textContent = data.smtp_configured
                    ? 'SMTP 已配置，异常时可发邮件'
                    : 'SMTP 未配置：请在 docker-compose 设置 SMTP_USER / SMTP_PASS（QQ 邮箱授权码）';
                smtpEl.style.color = data.smtp_configured ? '#2e7d32' : '#c62828';
            }

            var svcGrid = document.getElementById('monitorServicesGrid');
            if (svcGrid) {
                var services = Array.isArray(data.services) ? data.services : [];
                if (!services.length) {
                    svcGrid.innerHTML = '<p class="stat">暂无探活数据</p>';
                } else {
                    var sh = '';
                    services.forEach(function (s) {
                        var ok = !!s.ok;
                        sh += '<div class="monitor-service-card' + (ok ? ' is-ok' : ' is-down') + '">';
                        sh += '<div class="monitor-service-name">' + esc(s.label || s.id) + '</div>';
                        sh += '<div class="monitor-service-status">' + (ok ? '正常' : '异常') + '</div>';
                        sh += '<div class="monitor-service-meta">' + esc(s.message || '—');
                        if (s.latency_ms != null && ok) {
                            sh += ' · ' + esc(String(s.latency_ms)) + ' ms';
                        }
                        sh += '</div></div>';
                    });
                    svcGrid.innerHTML = sh;
                }
            }

            var host = data.host || {};
            var hostGrid = document.getElementById('monitorHostGrid');
            if (hostGrid) {
                hostGrid.innerHTML =
                    '<div class="monitor-stat-card"><div class="monitor-stat-label">主机名</div><div class="monitor-stat-val">' +
                    esc(host.hostname || '—') +
                    '</div></div>' +
                    '<div class="monitor-stat-card"><div class="monitor-stat-label">运行时间</div><div class="monitor-stat-val">' +
                    esc(formatMonitorUptime(host.uptime_sec)) +
                    '</div></div>' +
                    '<div class="monitor-stat-card"><div class="monitor-stat-label">内存使用</div><div class="monitor-stat-val">' +
                    esc(host.memory_used_percent != null ? host.memory_used_percent + '%' : '—') +
                    '</div><div class="monitor-stat-sub">' +
                    esc(
                        host.memory_used_bytes != null && host.memory_total_bytes != null
                            ? '已用 / 总计（进程 RSS 另计）'
                            : '—'
                    ) +
                    '</div></div>' +
                    '<div class="monitor-stat-card"><div class="monitor-stat-label">进程内存 RSS</div><div class="monitor-stat-val">' +
                    esc(host.process_rss_bytes != null ? Math.round(host.process_rss_bytes / 1024 / 1024) + ' MB' : '—') +
                    '</div></div>' +
                    '<div class="monitor-stat-card"><div class="monitor-stat-label">CPU 负载 (1m)</div><div class="monitor-stat-val">' +
                    esc(host.load_1 != null ? String(host.load_1) : '—') +
                    ' / ' +
                    esc(host.cpu_count != null ? String(host.cpu_count) : '—') +
                    ' 核</div><div class="monitor-stat-sub">约 ' +
                    esc(host.load_percent_1 != null ? host.load_percent_1 + '%' : '—') +
                    '</div></div>';
            }

            var net = data.network || {};
            var disk = data.disk || {};
            var netDiskGrid = document.getElementById('monitorNetDiskGrid');
            if (netDiskGrid) {
                netDiskGrid.innerHTML =
                    '<div class="monitor-stat-card"><div class="monitor-stat-label">下行带宽</div><div class="monitor-stat-val">' +
                    esc(net.rx_bps_label || '—') +
                    '</div></div>' +
                    '<div class="monitor-stat-card"><div class="monitor-stat-label">上行带宽</div><div class="monitor-stat-val">' +
                    esc(net.tx_bps_label || '—') +
                    '</div></div>' +
                    '<div class="monitor-stat-card"><div class="monitor-stat-label">磁盘 (' +
                    esc(disk.path || '—') +
                    ')</div><div class="monitor-stat-val">' +
                    esc(disk.used_percent != null ? disk.used_percent + '%' : '—') +
                    '</div><div class="monitor-stat-sub">' +
                    esc((disk.used_label || '—') + ' / ' + (disk.total_label || '—')) +
                    '</div></div>';
            }

            var alerts = Array.isArray(data.alerts) ? data.alerts : [];
            var tbody = document.getElementById('monitorAlertsTbody');
            if (tbody) {
                if (!alerts.length) {
                    tbody.innerHTML = '<tr><td colspan="4">暂无告警记录</td></tr>';
                } else {
                    var ah = '';
                    alerts.forEach(function (a) {
                        var mailCol = '—';
                        if (a.recovered) {
                            mailCol = '已恢复';
                        } else if (a.email_sent) {
                            mailCol = '已发送';
                        } else if (a.email_error) {
                            mailCol = esc(a.email_error);
                        }
                        ah += '<tr>';
                        ah += '<td>' + esc(a.at ? formatDt(a.at) : '—') + '</td>';
                        ah += '<td>' + esc(a.service_label || a.service_id || '—') + '</td>';
                        ah += '<td class="cell-break">' + esc(a.message || '—') + '</td>';
                        ah += '<td class="cell-break">' + mailCol + '</td>';
                        ah += '</tr>';
                    });
                    tbody.innerHTML = ah;
                }
            }

            var updated = data.updated_at ? '上次更新：' + formatDt(data.updated_at) : '';
            if (smtpEl && updated) {
                smtpEl.textContent = updated + ' · ' + smtpEl.textContent;
            }
        }

        function loadServerMonitor() {
            var svcGrid = document.getElementById('monitorServicesGrid');
            if (svcGrid) svcGrid.innerHTML = '加载中…';
            adminFetch('api/admin/monitor/overview')
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code === 200 && j.data) {
                        renderServerMonitor(j.data);
                    } else {
                        if (svcGrid) {
                            svcGrid.innerHTML = '<p class="stat" style="color:#c00;">' + esc(j.msg || '加载失败') + '</p>';
                        }
                    }
                })
                .catch(function () {
                    if (svcGrid) {
                        svcGrid.innerHTML = '<p class="stat" style="color:#c00;">网络错误</p>';
                    }
                });
        }

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

        var USER_LOGIN_REASON_FILTER_OPTIONS = [
            { key: 'ok', label: '成功' },
            { key: 'invalid_credentials', label: '账号或密码错误' },
            { key: 'wrong_password', label: '密码错误' },
            { key: 'empty_password', label: '密码为空' },
            { key: 'account_banned', label: '账号已封禁' },
            { key: 'invalid_username', label: '账号格式错误' },
            { key: 'other_error', label: '其他错误' },
            { key: 'unknown_error', label: '未知错误' },
            { key: 'register_ok', label: '注册成功' },
            { key: 'register_fail:duplicate', label: '注册-账号已存在' },
            { key: 'register_fail:rate_burst', label: '注册-频率过快' },
            { key: 'register_fail:rate_ip_day', label: '注册-IP日上限' },
            { key: 'register_fail:rate_fp_day', label: '注册-设备日上限' },
            { key: 'register_fail:backoff', label: '注册-失败退避' },
            { key: 'register_fail:captcha', label: '注册-验证码错误' },
            { key: 'register_fail:invalid_client', label: '注册-非官方客户端' },
            { key: 'register_fail:validation', label: '注册-参数校验失败' }
        ];

        function initUserLoginLogReasonFilter() {
            var sel = document.getElementById('userLoginLogReasonFilter');
            if (!sel || sel.getAttribute('data-inited') === '1') return;
            sel.setAttribute('data-inited', '1');
            USER_LOGIN_REASON_FILTER_OPTIONS.forEach(function (opt) {
                var o = document.createElement('option');
                o.value = opt.key;
                o.textContent = opt.label;
                sel.appendChild(o);
            });
        }

        function loadUserLoginRecentPage(page) {
            initUserLoginLogReasonFilter();
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
            var reasonFilterEl = document.getElementById('userLoginLogReasonFilter');
            var reasonFilter = reasonFilterEl ? reasonFilterEl.value.trim() : '';
            if (uname) {
                query += '&username=' + encodeURIComponent(uname);
            }
            if (okFilter === '1' || okFilter === '0') {
                query += '&ok=' + encodeURIComponent(okFilter);
            }
            if (reasonFilter) {
                query += '&reason=' + encodeURIComponent(reasonFilter);
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
                                '</td><td class="cell-break">' +
                                esc(row.reason_display || row.reason_label || row.reason_key || '—') +
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

        var analyticsConvCache = null;

        function analyticsPeriodHintHtml(data) {
            if (window.AdminAnalyticsPeriod && AdminAnalyticsPeriod.hintHtml) {
                return AdminAnalyticsPeriod.hintHtml(data).replace(
                    'class="hint analytics-period-hint"',
                    'class="hint" style="margin:0 0 12px;"'
                );
            }
            if (!data || !data.period_label) return '';
            var hint = '统计区间：' + data.period_label;
            if (data.period_start && data.period_end) {
                hint += '（' + data.period_start + ' ~ ' + data.period_end + '，北京时间）';
            }
            return '<p class="hint" style="margin:0 0 12px;">' + esc(hint) + '</p>';
        }

        function renderDailyConversionSegmentBlock(title, segmentData, pageData, options) {
            options = options || {};
            var activationOnly = !!options.activationOnly;
            var collapsed = !!options.collapsed;
            var wrapStart = collapsed
                ? '<details class="analytics-segment-block analytics-segment-collapsible">'
                : '<div class="analytics-segment-block">';
            var titleHtml = collapsed
                ? '<summary class="analytics-segment-title">' + esc(title) + '</summary>'
                : '<h3 class="analytics-segment-title">' + esc(title) + '</h3>';
            var html = wrapStart + titleHtml;
            if (!segmentData || !segmentData.today) {
                html += '<p class="hint">暂无数据</p>' + (collapsed ? '</details>' : '</div>');
                return html;
            }
            var pt = segmentData.period_total;
            if (pageData && pageData.period_start && pt) {
                html += '<div class="analytics-conv-summary analytics-conv-period-total">';
                html +=
                    '<div class="conv-label">区间合计（' +
                    esc(pageData.period_label || '') +
                    '）</div>';
                if (activationOnly) {
                    html += '<div class="conv-today">' + esc(String(pt.activated != null ? pt.activated : 0)) + '</div>';
                    html += '<div class="conv-sub">闲鱼激活</div>';
                } else {
                    var periodRate =
                        pt.rate_pct != null ? pt.rate_pct : pt.registered > 0 ? '0.0%' : '—';
                    html += '<div class="conv-today">' + esc(periodRate) + '</div>';
                    html +=
                        '<div class="conv-sub">注册 ' +
                        esc(String(pt.registered)) +
                        ' · 激活 ' +
                        esc(String(pt.activated)) +
                        '</div>';
                }
                html += '</div>';
            }
            var today = segmentData.today;
            var todayKey = today.date || '';
            var summaryTitle = segmentData.today_is_current === false ? '末日' : '今日';
            html += '<div class="analytics-conv-summary">';
            if (activationOnly) {
                html += '<div class="conv-label">' + summaryTitle + '闲鱼激活（' + esc(todayKey) + '）</div>';
                html += '<div class="conv-today">' + esc(String(today.activated != null ? today.activated : 0)) + '</div>';
                html += '<div class="conv-sub">仅统计 admin 名下通过闲鱼码/渠道激活的用户</div>';
            } else {
                var rateText = today.rate_pct != null ? today.rate_pct : today.registered > 0 ? '0.0%' : '—';
                html += '<div class="conv-label">' + summaryTitle + '转化率（' + esc(todayKey) + '）</div>';
                html += '<div class="conv-today">' + esc(rateText) + '</div>';
                html += '<div class="conv-sub">激活 ' + esc(String(today.activated)) + ' / 注册 ' + esc(String(today.registered)) + '</div>';
            }
            html += '</div>';

            var series = Array.isArray(segmentData.series) ? segmentData.series.slice().reverse() : [];
            html += '<div class="scroll-x analytics-conv-table-wrap"><table><thead><tr>';
            html += '<th>日期</th>';
            if (!activationOnly) {
                html += '<th>注册数</th>';
            }
            html += '<th>激活数</th>';
            if (!activationOnly) {
                html += '<th>转化率</th>';
            }
            html += '</tr></thead><tbody>';
            if (!series.length) {
                html += '<tr><td colspan="' + (activationOnly ? 2 : 4) + '">暂无数据</td></tr>';
            } else {
                series.forEach(function (row) {
                    if (!row || !row.date) return;
                    var isToday = row.date === todayKey;
                    html += '<tr' + (isToday ? ' class="conv-row-today"' : '') + '>';
                    html += '<td>' + esc(row.date) + (isToday ? ' <span style="color:#1677ff;font-size:12px;">今日</span>' : '') + '</td>';
                    if (!activationOnly) {
                        html += '<td>' + esc(String(row.registered != null ? row.registered : 0)) + '</td>';
                    }
                    html += '<td>' + esc(String(row.activated != null ? row.activated : 0)) + '</td>';
                    if (!activationOnly) {
                        var pct = row.rate_pct != null ? row.rate_pct : row.registered > 0 ? '0.0%' : '—';
                        html += '<td class="conv-rate-cell">' + esc(pct) + '</td>';
                    }
                    html += '</tr>';
                });
            }
            html += '</tbody></table></div>' + (collapsed ? '</details>' : '</div>');
            return html;
        }

        function renderAnalyticsDailyConversion(data) {
            var el = document.getElementById('analyticsDailyConversion');
            if (!el) return;
            if (!data || !data.segments) {
                analyticsConvCache = null;
                el.textContent = '转化率暂无数据';
                return;
            }
            analyticsConvCache = data;
            var agentIds = Array.isArray(data.agent_channel_ids) ? data.agent_channel_ids : [];
            var agentHint = agentIds.length ? '（' + agentIds.join('、') + '）' : '（未配置代理渠道）';
            var ownerHint = data.owner_admin_username
                ? '（仅统计 <code>' + esc(data.owner_admin_username) + '</code> 名下用户）'
                : '';
            var html = analyticsPeriodHintHtml(data);
            if (ownerHint) {
                html += '<p class="hint" style="margin:0 0 12px;">激活与注册均仅计入主管理员账号' + ownerHint + '，不含其他子管理员名下用户。</p>';
            }
            html += renderDailyConversionSegmentBlock('自有流量', data.segments.own, data);
            html += renderDailyConversionSegmentBlock('代理推广' + agentHint, data.segments.agent, data, { collapsed: true });
            if (data.segments.xianyu) {
                html += renderDailyConversionSegmentBlock('闲鱼激活', data.segments.xianyu, data, { activationOnly: true });
            }
            el.innerHTML = html;
        }

        function renderRegistrationFunnelSegmentBlock(title, segmentData, options) {
            options = options || {};
            var collapsed = !!options.collapsed;
            var wrapStart = collapsed
                ? '<details class="analytics-segment-block analytics-segment-collapsible">'
                : '<div class="analytics-segment-block">';
            var titleHtml = collapsed
                ? '<summary class="analytics-segment-title">' + esc(title) + '</summary>'
                : '<h3 class="analytics-segment-title">' + esc(title) + '</h3>';
            var html = wrapStart + titleHtml;
            if (!segmentData || !segmentData.summary) {
                html += '<p class="hint">暂无数据</p>' + (collapsed ? '</details>' : '</div>');
                return html;
            }
            var s = segmentData.summary;
            var cards = [
                { label: '注册用户', val: s.registered },
                { label: '7日内激活', val: (s.activated_7d || 0) + ' (' + (s.rate_activate_7d_pct || '—') + ')' },
                { label: '7日内有个税', val: (s.tax_7d || 0) + ' (' + (s.rate_tax_7d_pct || '—') + ')' },
                { label: '7日内看明细', val: (s.viewed_detail_7d || 0) + ' (' + (s.rate_detail_7d_pct || '—') + ')' }
            ];
            html += '<div class="user-data-stats" style="margin-bottom:12px;">';
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
            var series = Array.isArray(segmentData.series) ? segmentData.series.slice().reverse() : [];
            html += '<div class="scroll-x analytics-conv-table-wrap"><table><thead><tr>';
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
            html += '</tbody></table></div>' + (collapsed ? '</details>' : '</div>');
            return html;
        }

        function renderRegistrationFunnel(data) {
            var el = document.getElementById('analyticsRegistrationFunnel');
            if (!el) return;
            if (!data || !data.segments) {
                el.textContent = '漏斗暂无数据';
                return;
            }
            var agentIds = Array.isArray(data.agent_channel_ids) ? data.agent_channel_ids : [];
            var agentHint = agentIds.length ? '（' + agentIds.join('、') + '）' : '（未配置代理渠道）';
            var html = analyticsPeriodHintHtml(data);
            html += renderRegistrationFunnelSegmentBlock('自有流量', data.segments.own);
            html += renderRegistrationFunnelSegmentBlock('代理推广' + agentHint, data.segments.agent, { collapsed: true });
            el.innerHTML = html;
        }

        function loadRegistrationFunnel() {
            var el = document.getElementById('analyticsRegistrationFunnel');
            if (!el) return;
            var daysEl = document.getElementById('analyticsFunnelDays');
            var periodVal = analyticsPeriodVal(daysEl);
            el.textContent = '漏斗加载中…';
            adminFetch('api/admin/analytics/registration-funnel?days=' + encodeURIComponent(periodVal))
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
            var html = analyticsPeriodHintHtml(data);
            html += '<div class="scroll-x"><table><thead><tr>';
            html +=
                '<th>注册渠道</th><th>注册</th><th>7日激活</th><th>7日个税</th><th>7日看明细</th><th>激活率</th><th>个税率</th><th>明细率</th></tr></thead><tbody>';
            items.forEach(function (row) {
                html += '<tr>';
                html += '<td>' + esc(row.channel_label || row.channel || '—') + '</td>';
                html += '<td>' + esc(row.registered) + '</td>';
                html += '<td>' + esc(row.activated_7d) + '</td>';
                html += '<td>' + esc(row.tax_7d) + '</td>';
                html += '<td>' + esc(row.viewed_detail_7d) + '</td>';
                html += '<td>' + esc(row.rate_activate_7d_pct || '—') + '</td>';
                html += '<td>' + esc(row.rate_tax_7d_pct || '—') + '</td>';
                html += '<td>' + esc(row.rate_detail_7d_pct || '—') + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div>';
            el.innerHTML = html;
        }

        function loadChannelRegistrationFunnel() {
            var el = document.getElementById('analyticsChannelFunnel');
            if (!el) return;
            var daysEl = document.getElementById('analyticsChannelFunnelDays');
            var days = analyticsPeriodVal(daysEl);
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

        function renderActivationChannelFunnel(data) {
            var el = document.getElementById('analyticsActivationChannelFunnel');
            if (!el) return;
            var items = Array.isArray(data && data.items) ? data.items : [];
            if (!items.length) {
                el.textContent = '暂无激活渠道漏斗数据';
                return;
            }
            var html = analyticsPeriodHintHtml(data);
            html += '<div class="scroll-x"><table><thead><tr>';
            html +=
                '<th>激活渠道</th><th>激活</th><th>7日个税</th><th>7日看明细</th><th>个税率</th><th>明细率</th></tr></thead><tbody>';
            items.forEach(function (row) {
                html += '<tr>';
                html += '<td>' + esc(row.channel_label || row.channel || '—') + '</td>';
                html += '<td>' + esc(row.activated) + '</td>';
                html += '<td>' + esc(row.tax_7d) + '</td>';
                html += '<td>' + esc(row.viewed_detail_7d) + '</td>';
                html += '<td>' + esc(row.rate_tax_7d_pct || '—') + '</td>';
                html += '<td>' + esc(row.rate_detail_7d_pct || '—') + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div>';
            el.innerHTML = html;
        }

        function loadActivationChannelFunnel() {
            var el = document.getElementById('analyticsActivationChannelFunnel');
            if (!el) return;
            var daysEl = document.getElementById('analyticsActivationChannelFunnelDays');
            var days = analyticsPeriodVal(daysEl);
            el.textContent = '激活渠道漏斗加载中…';
            adminFetch('api/admin/analytics/activation-channel-funnel?days=' + encodeURIComponent(days))
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        el.textContent = j.msg || '激活渠道漏斗加载失败';
                        return;
                    }
                    renderActivationChannelFunnel(j.data);
                })
                .catch(function () {
                    el.textContent = '激活渠道漏斗加载失败';
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
            var html = analyticsPeriodHintHtml(data);
            html += '<div class="scroll-x"><table><thead><tr><th>事件</th><th>次数</th></tr></thead><tbody>';
            items.forEach(function (row) {
                html += '<tr><td>' + esc(row.label || row.route_key) + '</td><td>' + esc(row.total) + '</td></tr>';
            });
            html += '</tbody></table></div>';
            el.innerHTML = html;
        }

        function formatIsoToCnShort(iso) {
            if (!iso) return '—';
            try {
                var d = new Date(iso);
                if (isNaN(d.getTime())) return String(iso);
                var utc = d.getTime() + d.getTimezoneOffset() * 60000;
                var cn = new Date(utc + 8 * 3600000);
                var y = cn.getFullYear();
                var m = String(cn.getMonth() + 1).padStart(2, '0');
                var day = String(cn.getDate()).padStart(2, '0');
                var hh = String(cn.getHours()).padStart(2, '0');
                var mm = String(cn.getMinutes()).padStart(2, '0');
                return y + '-' + m + '-' + day + ' ' + hh + ':' + mm;
            } catch (e0) {
                return String(iso);
            }
        }

        function renderInstallGuideStats(data) {
            var el = document.getElementById('installGuideStatsMount');
            if (!el) return;
            destroyInstallGuideCharts();
            if (!data || !data.summary) {
                el.textContent = '暂无安装页统计数据';
                return;
            }
            var s = data.summary;
            var html = analyticsPeriodHintHtml(data);
            html += '<div class="user-data-stats" style="margin-bottom:14px;">';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">页面浏览 (PV)</div><div class="ud-val">' +
                esc(String(s.page_views != null ? s.page_views : 0)) +
                '</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">独立访客 (UV)</div><div class="ud-val">' +
                esc(String(s.unique_visitors != null ? s.unique_visitors : 0)) +
                '</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">安装页→注册率</div><div class="ud-val">' +
                esc(s.register_rate_pct || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">归因注册 ' +
                esc(String(s.registered_from_install != null ? s.registered_from_install : 0)) +
                ' / UV ' +
                esc(String(s.unique_visitors != null ? s.unique_visitors : 0)) +
                (s.registered_from_install_reported != null && Number(s.registered_from_install_reported) > 0
                    ? ' · 注册回传 ' + esc(String(s.registered_from_install_reported))
                    : '') +
                '</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">当日总注册</div><div class="ud-val">' +
                esc(String(s.registered != null ? s.registered : 0)) +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">占 UV ' +
                esc(s.register_rate_all_pct || '—') +
                '</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">平均停留</div><div class="ud-val">' +
                esc(s.avg_dwell_label || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">有效离开 ' +
                esc(String(s.leave_events != null ? s.leave_events : 0)) +
                ' 次</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">中位停留</div><div class="ud-val">' +
                esc(s.median_dwell_label || '—') +
                '</div></div>';
            html += '</div>';

            var daily = Array.isArray(data.daily) ? data.daily : [];
            html += '<p class="stat" style="margin:0 0 8px;">每日访问与注册趋势</p>';
            html +=
                '<div class="device-stats-charts-wrap" style="margin-bottom:16px;"><div class="chart-canvas-wrap chart-canvas-wrap-trend"><canvas id="installGuideVisitRegChart" aria-label="安装页每日访问与注册折线图"></canvas></div></div>';

            var actions = Array.isArray(data.actions) ? data.actions : [];
            html += '<p class="stat" style="margin:0 0 8px;">用户行为（点击 / 播放等）</p>';
            html += '<div class="scroll-x" style="margin-bottom:16px;"><table><thead><tr><th>行为</th><th>次数</th></tr></thead><tbody>';
            if (!actions.length) {
                html += '<tr><td colspan="2">暂无行为数据</td></tr>';
            } else {
                actions.forEach(function (row) {
                    html += '<tr><td>' + esc(row.label || row.event_key) + '</td><td>' + esc(row.total) + '</td></tr>';
                });
            }
            html += '</tbody></table></div>';

            html += '<p class="stat" style="margin:0 0 8px;">按日明细</p>';
            html += '<div class="scroll-x" style="margin-bottom:16px;"><table><thead><tr>';
            html +=
                '<th>日期</th><th>浏览量</th><th>独立访客</th><th>归因注册</th><th>总注册</th><th>注册率</th><th>平均停留</th></tr></thead><tbody>';
            if (!daily.length) {
                html += '<tr><td colspan="7">暂无</td></tr>';
            } else {
                daily.slice().reverse().forEach(function (row) {
                    html += '<tr>';
                    html += '<td>' + esc(row.date || '—') + '</td>';
                    html += '<td>' + esc(row.page_views) + '</td>';
                    html += '<td>' + esc(row.unique_visitors) + '</td>';
                    html += '<td>' + esc(row.registered_from_install != null ? row.registered_from_install : 0) + '</td>';
                    html += '<td>' + esc(row.registered != null ? row.registered : 0) + '</td>';
                    html += '<td>' + esc(row.register_rate_pct || (row.unique_visitors > 0 ? '0.0%' : '—')) + '</td>';
                    html += '<td>' + esc(row.avg_dwell_label || '—') + '</td>';
                    html += '</tr>';
                });
            }
            html += '</tbody></table></div>';

            var recentVisitors = Array.isArray(data.recent_visitors) ? data.recent_visitors : [];
            html += '<p class="stat" style="margin:0 0 8px;">最近访客行为（最多 20 位访客，同一访客合并展示）</p>';
            html += '<div class="scroll-x"><table><thead><tr>';
            html += '<th>访客</th><th>IP</th><th>设备</th><th>时间</th><th>行为</th><th>停留</th></tr></thead><tbody>';
            if (!recentVisitors.length) {
                html += '<tr><td colspan="6">暂无</td></tr>';
            } else {
                recentVisitors.forEach(function (visitor, vIdx) {
                    var events = Array.isArray(visitor.events) ? visitor.events : [];
                    if (!events.length) {
                        return;
                    }
                    events.forEach(function (row, idx) {
                        var rowStyle = vIdx > 0 && idx === 0 ? ' style="border-top:2px solid #e2e8f0;"' : '';
                        html += '<tr' + rowStyle + '>';
                        if (idx === 0) {
                            html +=
                                '<td rowspan="' +
                                events.length +
                                '" class="cell-break"><code title="' +
                                esc(visitor.visitor_id || '') +
                                '">' +
                                esc(visitor.visitor_key || '—') +
                                '</code></td>';
                            html += '<td rowspan="' + events.length + '">' + esc(visitor.ip || '—') + '</td>';
                            html +=
                                '<td rowspan="' +
                                events.length +
                                '" class="cell-break" title="' +
                                esc(visitor.user_agent || '') +
                                '">' +
                                esc(visitor.device_label || '—') +
                                '</td>';
                        }
                        html += '<td>' + esc(formatIsoToCnShort(row.at)) + '</td>';
                        html += '<td>' + esc(row.label || row.event_key) + '</td>';
                        html +=
                            '<td>' +
                            esc(row.event_key === 'track_install_page_leave' ? row.dwell_label || '—' : '—') +
                            '</td>';
                        html += '</tr>';
                    });
                });
            }
            html += '</tbody></table></div>';
            el.innerHTML = html;

            if (typeof Chart !== 'undefined' && daily.length) {
                var chartCanvas = document.getElementById('installGuideVisitRegChart');
                if (chartCanvas) {
                    var labels = daily.map(function (row) {
                        return row.date ? String(row.date).slice(5) : '';
                    });
                    var rateData = daily.map(function (row) {
                        var uv = Number(row.unique_visitors) || 0;
                        var reg = Number(row.registered_from_install) || 0;
                        if (uv <= 0) return null;
                        return Math.round((reg / uv) * 1000) / 10;
                    });
                    _installGuideChartInstances.push(
                        new Chart(chartCanvas, {
                            type: 'line',
                            data: {
                                labels: labels,
                                datasets: [
                                    {
                                        label: '独立访客 (UV)',
                                        data: daily.map(function (row) {
                                            return Number(row.unique_visitors) || 0;
                                        }),
                                        borderColor: '#1e6fff',
                                        backgroundColor: '#1e6fff',
                                        yAxisID: 'yCount',
                                        tension: 0.3,
                                        fill: false,
                                        borderWidth: 2,
                                        pointRadius: 3
                                    },
                                    {
                                        label: '归因注册',
                                        data: daily.map(function (row) {
                                            return Number(row.registered_from_install) || 0;
                                        }),
                                        borderColor: '#22a06b',
                                        backgroundColor: '#22a06b',
                                        yAxisID: 'yCount',
                                        tension: 0.3,
                                        fill: false,
                                        borderWidth: 2,
                                        pointRadius: 3
                                    },
                                    {
                                        label: '总注册',
                                        data: daily.map(function (row) {
                                            return Number(row.registered) || 0;
                                        }),
                                        borderColor: '#94a3b8',
                                        backgroundColor: '#94a3b8',
                                        yAxisID: 'yCount',
                                        borderDash: [6, 4],
                                        tension: 0.3,
                                        fill: false,
                                        borderWidth: 2,
                                        pointRadius: 2
                                    },
                                    {
                                        label: '注册率 (%)',
                                        data: rateData,
                                        borderColor: '#ef6c00',
                                        backgroundColor: '#ef6c00',
                                        yAxisID: 'yRate',
                                        tension: 0.3,
                                        fill: false,
                                        borderWidth: 2,
                                        pointRadius: 2,
                                        spanGaps: true
                                    }
                                ]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                interaction: { mode: 'index', intersect: false },
                                plugins: {
                                    legend: { position: 'bottom' },
                                    tooltip: {
                                        callbacks: {
                                            title: function (items) {
                                                if (!items || !items.length || !daily[items[0].dataIndex]) {
                                                    return '';
                                                }
                                                return daily[items[0].dataIndex].date || '';
                                            },
                                            label: function (ctx) {
                                                var label = ctx.dataset.label || '';
                                                if (label.indexOf('注册率') >= 0) {
                                                    return ctx.parsed.y == null
                                                        ? label + ': —'
                                                        : label + ': ' + ctx.parsed.y + '%';
                                                }
                                                return label + ': ' + ctx.parsed.y;
                                            }
                                        }
                                    }
                                },
                                scales: {
                                    yCount: {
                                        type: 'linear',
                                        position: 'left',
                                        beginAtZero: true,
                                        title: { display: true, text: '人数' }
                                    },
                                    yRate: {
                                        type: 'linear',
                                        position: 'right',
                                        beginAtZero: true,
                                        grid: { drawOnChartArea: false },
                                        title: { display: true, text: '注册率 %' },
                                        ticks: {
                                            callback: function (v) {
                                                return v + '%';
                                            }
                                        }
                                    }
                                }
                            }
                        })
                    );
                }
            }
        }

        function loadInstallGuideStats() {
            var el = document.getElementById('installGuideStatsMount');
            if (!el) return;
            var daysEl = document.getElementById('installGuideStatsDays');
            var days = analyticsPeriodVal(daysEl);
            el.textContent = '加载中…';
            adminFetch('api/admin/analytics/install-guide-stats?days=' + encodeURIComponent(days))
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        el.textContent = j.msg || '加载失败';
                        return;
                    }
                    renderInstallGuideStats(j.data);
                })
                .catch(function () {
                    el.textContent = '加载失败';
                });
        }

        function loadInstallTrackStats() {
            var el = document.getElementById('analyticsInstallTrack');
            if (!el) return;
            var daysEl = document.getElementById('analyticsInstallTrackDays');
            var days = analyticsPeriodVal(daysEl);
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
            var html = analyticsPeriodHintHtml(data);
            html += '<div class="user-data-stats" style="margin-bottom:14px;">';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">激活后 1 日个税填写率</div><div class="ud-val">' +
                esc(data.rate_tax_after_activate_7d_pct || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">' +
                esc(data.tax_within_7d_after_activate) +
                ' / ' +
                esc(data.activated_in_window) +
                ' 人</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">有个税后 1 日明细查看率</div><div class="ud-val">' +
                esc(data.rate_detail_after_tax_7d_pct || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">' +
                esc(data.viewed_detail_within_7d_after_tax) +
                ' / ' +
                esc(data.users_with_first_tax_in_window) +
                ' 人</div></div>';
            html += '</div>';

            var actSeries = Array.isArray(data.series_by_activate_day) ? data.series_by_activate_day.slice().reverse() : [];
            html += '<p class="stat" style="margin:0 0 8px;">按激活日：激活后 1 日个税填写率</p>';
            html += '<div class="scroll-x" style="margin-bottom:16px;"><table><thead><tr>';
            html += '<th>激活日</th><th>当日激活</th><th>1日内有个税</th><th>填写率</th></tr></thead><tbody>';
            if (!actSeries.length) {
                html += '<tr><td colspan="4">暂无</td></tr>';
            } else {
                actSeries.forEach(function (row) {
                    html += '<tr>';
                    html += '<td>' + esc(row.date || '—') + '</td>';
                    html += '<td>' + esc(row.activated) + '</td>';
                    html += '<td>' + esc(row.tax_within_7d) + '</td>';
                    html += '<td>' + esc(row.rate_tax_after_activate_7d_pct || '—') + '</td>';
                    html += '</tr>';
                });
            }
            html += '</tbody></table></div>';

            var taxSeries = Array.isArray(data.series_by_first_tax_day) ? data.series_by_first_tax_day.slice().reverse() : [];
            html += '<p class="stat" style="margin:0 0 8px;">按首次有个税日：有个税后 1 日明细查看率</p>';
            html += '<div class="scroll-x"><table><thead><tr>';
            html += '<th>有个税日</th><th>当日有个税</th><th>1日内看明细</th><th>查看率</th></tr></thead><tbody>';
            if (!taxSeries.length) {
                html += '<tr><td colspan="4">暂无</td></tr>';
            } else {
                taxSeries.forEach(function (row) {
                    html += '<tr>';
                    html += '<td>' + esc(row.date || '—') + '</td>';
                    html += '<td>' + esc(row.with_tax) + '</td>';
                    html += '<td>' + esc(row.viewed_detail_7d) + '</td>';
                    html += '<td>' + esc(row.rate_detail_after_tax_7d_pct || '—') + '</td>';
                    html += '</tr>';
                });
            }
            html += '</tbody></table></div>';
            el.innerHTML = html;
        }

        function loadConversionKpis() {
            var el = document.getElementById('analyticsConversionKpis');
            if (!el) return;
            var daysEl = document.getElementById('analyticsConversionKpiDays');
            var periodVal = analyticsPeriodVal(daysEl);
            el.textContent = 'KPI 加载中…';
            adminFetch('api/admin/analytics/conversion-kpis?days=' + encodeURIComponent(periodVal))
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

        function loadAnalyticsDailyConversion() {
            var el = document.getElementById('analyticsDailyConversion');
            if (!el) return;
            var daysEl = document.getElementById('analyticsConversionDays');
            var periodVal = analyticsPeriodVal(daysEl);
            el.textContent = '转化率加载中…';
            adminFetch('api/admin/analytics/daily-conversion?days=' + encodeURIComponent(periodVal))
                .then(function (r) { return r.json(); })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        analyticsConvCache = null;
                        el.textContent = '转化率加载失败';
                        return;
                    }
                    renderAnalyticsDailyConversion(j.data);
                })
                .catch(function () {
                    analyticsConvCache = null;
                    el.textContent = '转化率加载失败';
                });
        }

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
            if (tbody) tbody.innerHTML = '<tr><td colspan="10">加载中…</td></tr>';
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
                        if (tbody) tbody.innerHTML = '<tr><td colspan="10">' + esc(j.msg || '加载失败') + '</td></tr>';
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
                        var deviceCell = '—';
                        if (row.device_model_label) {
                            deviceCell = row.device_model_label;
                            if (row.device_os_label) {
                                deviceCell += ' · ' + row.device_os_label;
                            }
                        }
                        html +=
                            '<td class="cell-break" style="font-size:12px;color:#555;" title="' +
                            esc(deviceCell) +
                            '">' +
                            esc(deviceCell) +
                            '</td>';
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
                            '<td colspan="10"><div id="ud_notax_path_box_' +
                            key +
                            '">加载中…</div></td></tr>';
                    });
                    if (tbody) {
                        tbody.innerHTML = html || '<tr><td colspan="10">暂无未填个税用户</td></tr>';
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
                    if (tbody) tbody.innerHTML = '<tr><td colspan="10">加载失败</td></tr>';
                });
        }

        var auaUsersPage = 1;
        var auaUsersLimit = 20;

        function destroyAuaDauCharts() {
            _auaDauChartInstances.forEach(function (c) {
                try {
                    c.destroy();
                } catch (e) {}
            });
            _auaDauChartInstances = [];
        }

        function renderActivatedUserAnalysisOverview(data) {
            var wrap = document.getElementById('auaSummary');
            var tablesWrap = document.getElementById('auaAnalyticsTables');
            if (!wrap || !data) return;
            var actDays = data.activity_days != null ? data.activity_days : 30;
            var actHint = document.getElementById('auaActivityDaysHint');
            if (actHint) actHint.textContent = String(actDays);
            var cards = [
                { label: '已激活用户', val: data.total_activated },
                { label: '已填写个税', val: data.with_tax_records },
                { label: '未填写个税', val: data.without_tax_records },
                { label: '有工资数据', val: data.with_salary_filled },
                { label: '平均工资', val: data.salary_avg_6m_label || '—' },
                { label: '工资中位数', val: data.salary_median_6m_label || '—' },
                { label: '今日日活', val: data.dau_today },
                { label: '个税总条数', val: data.total_tax_records }
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

            var salaryStat = document.getElementById('auaSalaryStat');
            if (salaryStat) {
                var filled = data.with_salary_filled != null ? Number(data.with_salary_filled) : 0;
                salaryStat.textContent =
                    '工资收入分布（近6月平均）· 已填写 ' +
                    filled +
                    ' 人 · 平均 ' +
                    (data.salary_avg_6m_label || '—') +
                    ' · 中位数 ' +
                    (data.salary_median_6m_label || '—');
            }

            var buckTb = document.getElementById('auaSalaryBucketsTbody');
            if (buckTb) {
                var bhtml = '';
                (data.salary_buckets || []).forEach(function (b) {
                    bhtml += '<tr><td>' + esc(b.label) + '</td><td>' + esc(b.count) + '</td></tr>';
                });
                buckTb.innerHTML = bhtml || '<tr><td colspan="2">暂无</td></tr>';
            }
            var taxTb = document.getElementById('auaTaxBucketsTbody');
            if (taxTb) {
                var thtml = '';
                (data.tax_record_buckets || []).forEach(function (b) {
                    thtml += '<tr><td>' + esc(b.label) + '</td><td>' + esc(b.count) + '</td></tr>';
                });
                taxTb.innerHTML = thtml || '<tr><td colspan="2">暂无</td></tr>';
            }
            var freqTb = document.getElementById('auaActivityFreqTbody');
            if (freqTb) {
                var freq = data.activity_frequency || {};
                var freqRows = [
                    { label: '无活跃（0天）', val: freq.none },
                    { label: '低频（1天）', val: freq.low },
                    { label: '中频（2–4天）', val: freq.medium },
                    { label: '高频（5天+）', val: freq.high }
                ];
                var fhtml = '';
                freqRows.forEach(function (fr) {
                    fhtml += '<tr><td>' + esc(fr.label) + '</td><td>' + esc(fr.val != null ? fr.val : 0) + '</td></tr>';
                });
                freqTb.innerHTML = fhtml;
            }

            var topTb = document.getElementById('auaTopPagesTbody');
            if (topTb) {
                var phtml = '';
                (data.top_pages || []).forEach(function (p) {
                    phtml += '<tr><td>' + esc(p.title || '—') + '</td><td>' + esc(p.hit_count) + '</td></tr>';
                });
                topTb.innerHTML = phtml || '<tr><td colspan="2">暂无</td></tr>';
            }

            destroyAuaDauCharts();
            var chartWrap = document.getElementById('auaDauChartWrap');
            var canvas = document.getElementById('auaDauChart');
            var series = data.dau_series || [];
            if (!series.length || typeof Chart === 'undefined' || !canvas) {
                if (chartWrap) chartWrap.style.display = 'none';
                return;
            }
            if (chartWrap) chartWrap.style.display = '';
            var labels = series.map(function (r) {
                return r.date;
            });
            var values = series.map(function (r) {
                return Number(r.active_users) || 0;
            });
            _auaDauChartInstances.push(
                new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: '激活用户日活',
                                data: values,
                                borderColor: '#2563eb',
                                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                                fill: true,
                                tension: 0.25,
                                pointRadius: 3
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true, ticks: { precision: 0 } }
                        }
                    }
                })
            );
        }

        function loadActivatedUserAnalysisOverview() {
            var wrap = document.getElementById('auaSummary');
            if (wrap) wrap.textContent = '加载中…';
            var daysEl = document.getElementById('auaOverviewDays');
            var actEl = document.getElementById('auaActivityDays');
            var days = daysEl ? parseInt(daysEl.value, 10) || 14 : 14;
            var actDays = actEl ? parseInt(actEl.value, 10) || 30 : 30;
            adminFetch(
                'api/admin/activated-user-analysis/overview?days=' +
                    encodeURIComponent(days) +
                    '&activity_days=' +
                    encodeURIComponent(actDays)
            )
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        if (wrap) wrap.textContent = j.msg || '加载失败';
                        return;
                    }
                    renderActivatedUserAnalysisOverview(j.data);
                })
                .catch(function () {
                    if (wrap) wrap.textContent = '加载失败';
                });
        }

        function loadActivatedUserAnalysisUsers(p) {
            if (p != null) auaUsersPage = p;
            var stat = document.getElementById('auaUserListStat');
            var tbody = document.getElementById('auaUsersTbody');
            if (stat) stat.textContent = '加载中…';
            if (tbody) tbody.innerHTML = '<tr><td colspan="11">加载中…</td></tr>';
            var username = document.getElementById('auaFilterUsername');
            var taxF = document.getElementById('auaFilterTax');
            var actF = document.getElementById('auaFilterActivity');
            var salMin = document.getElementById('auaFilterSalaryMin');
            var salMax = document.getElementById('auaFilterSalaryMax');
            var actDaysEl = document.getElementById('auaActivityDays');
            var actDays = actDaysEl ? parseInt(actDaysEl.value, 10) || 30 : 30;
            var q =
                'api/admin/activated-user-analysis/users?page=' +
                encodeURIComponent(auaUsersPage) +
                '&limit=' +
                encodeURIComponent(auaUsersLimit) +
                '&activity_days=' +
                encodeURIComponent(actDays);
            if (username && username.value.trim()) {
                q += '&username=' + encodeURIComponent(username.value.trim());
            }
            if (taxF && taxF.value) {
                q += '&tax_status=' + encodeURIComponent(taxF.value);
            }
            if (actF && actF.value) {
                q += '&activity=' + encodeURIComponent(actF.value);
            }
            if (salMin && salMin.value.trim()) {
                q += '&salary_min=' + encodeURIComponent(salMin.value.trim());
            }
            if (salMax && salMax.value.trim()) {
                q += '&salary_max=' + encodeURIComponent(salMax.value.trim());
            }
            adminFetch(q)
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        if (stat) stat.textContent = j.msg || '加载失败';
                        if (tbody) tbody.innerHTML = '<tr><td colspan="11">' + esc(j.msg || '加载失败') + '</td></tr>';
                        return;
                    }
                    var d = j.data;
                    var total = d.total || 0;
                    if (stat) {
                        stat.textContent =
                            '已激活用户 ' +
                            total +
                            ' 人（本页 ' +
                            (d.items || []).length +
                            ' 人 · 近 ' +
                            (d.activity_days || actDays) +
                            ' 天统计）';
                    }
                    var totalPages = Math.ceil(total / auaUsersLimit) || 1;
                    var pageInfo = document.getElementById('auaUsersPageInfo');
                    if (pageInfo) {
                        pageInfo.textContent = '第 ' + auaUsersPage + ' 页 / 共 ' + totalPages + ' 页';
                    }
                    var prevBtn = document.getElementById('auaUsersPrev');
                    var nextBtn = document.getElementById('auaUsersNext');
                    if (prevBtn) prevBtn.disabled = auaUsersPage <= 1;
                    if (nextBtn) nextBtn.disabled = auaUsersPage >= totalPages;
                    var html = '';
                    (d.items || []).forEach(function (row) {
                        var key = keyForUser(row.username);
                        html += '<tr>';
                        html += '<td class="cell-break"><code>' + esc(row.username) + '</code></td>';
                        html += '<td>' + esc(row.real_name || '—') + '</td>';
                        html +=
                            '<td title="' +
                            esc(row.avg_salary_6m_label || '未填写') +
                            '">' +
                            esc(row.avg_salary_6m_label || '未填写') +
                            '</td>';
                        html += '<td>' + esc(row.has_tax_records ? row.tax_record_count : '未填') + '</td>';
                        html += '<td>' + esc(row.active_days != null ? row.active_days : 0) + '</td>';
                        html += '<td>' + esc(row.event_count != null ? row.event_count : 0) + '</td>';
                        html += '<td>' + esc(row.events_per_active_day != null ? row.events_per_active_day : 0) + '</td>';
                        html += '<td>' + esc(row.stay_label || '—') + '</td>';
                        html += '<td>' + esc(row.last_active || '—') + '</td>';
                        html += '<td class="cell-break" style="font-size:12px;color:#555;">' + esc(row.path_summary || '—') + '</td>';
                        html +=
                            '<td class="col-ops"><button type="button" class="btn-sm btn-detail btn-aua-path" data-u="' +
                            esc(row.username) +
                            '" data-k="' +
                            key +
                            '">路径</button></td>';
                        html += '</tr>';
                        html += '<tr id="aua_path_row_' + key + '" class="users-detail-row" style="display:none;">';
                        html +=
                            '<td colspan="11"><div id="aua_path_box_' +
                            key +
                            '">加载中…</div></td></tr>';
                    });
                    if (tbody) {
                        tbody.innerHTML = html || '<tr><td colspan="11">暂无已激活用户</td></tr>';
                        tbody.querySelectorAll('.btn-aua-path').forEach(function (btn) {
                            btn.onclick = function () {
                                var name = btn.getAttribute('data-u');
                                var key = btn.getAttribute('data-k');
                                var row = document.getElementById('aua_path_row_' + key);
                                var box = document.getElementById('aua_path_box_' + key);
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
                                    'api/admin/activated-user-analysis/behavior-path?username=' +
                                        encodeURIComponent(name)
                                )
                                    .then(function (r) {
                                        return r.json();
                                    })
                                    .then(function (resp) {
                                        if (resp.code !== 200 || !resp.data) {
                                            box.textContent = resp.msg || '加载失败';
                                            return;
                                        }
                                        box.innerHTML = buildNoTaxPathDetailHtml(name, resp.data);
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
                    if (tbody) tbody.innerHTML = '<tr><td colspan="11">加载失败</td></tr>';
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

            var safeKey = userDataCertSafeKey(username);
            var latestIssue = data.latest_issue_application || null;
            html +=
                '<div class="ud-certificate-head">' +
                '<div style="color:#666;">纳税记录凭证 <span style="color:#999;font-size:12px;">（可在含公章预览与 C 端无章图之间切换）</span></div>' +
                '<div class="ud-cert-mode-btns">' +
                '<button type="button" class="btn-sm ud-cert-mode-btn is-active" id="ud_certificate_stamp_btn_' +
                safeKey +
                '">含公章预览</button>' +
                '<button type="button" class="btn-sm ud-cert-mode-btn" id="ud_certificate_client_btn_' +
                safeKey +
                '" data-u="' +
                esc(username) +
                '">C端无章图</button>' +
                '</div>' +
                '</div>';
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
                safeKey +
                '">正在生成凭证预览…</div>';

            html += '<div style="margin:10px 0 6px;color:#666;">个税记录（' + (data.tax_records || []).length + ' 条）</div>';
            html += renderAdminTaxRecordsTable(data.tax_records || []);
            html += '</div>';
            return html;
        }

        function userDataCertSafeKey(username) {
            return String(username || '').replace(/[^a-zA-Z0-9_-]/g, '_');
        }

        function renderUserDataCertificateImages(container, data, options) {
            options = options || {};
            var showStamp = options.showStamp === true;
            var altSuffix = options.altSuffix || '';
            if (!container) return Promise.resolve();
            if (!window.TaxIssueCertificate || typeof window.TaxIssueCertificate.renderDataUrl !== 'function') {
                container.textContent = '凭证组件未加载，请刷新页面';
                return Promise.resolve();
            }
            var issue = data && data.latest_issue_application;
            if (!issue || !issue.period_start || !issue.period_end) {
                container.textContent = '暂无 C 端纳税记录开具记录（用户端生成成功后会自动上报）';
                return Promise.resolve();
            }
            if (!data || !(data.tax_records || []).length) {
                container.textContent = '暂无个税记录，无法生成凭证预览';
                return Promise.resolve();
            }
            container.textContent = showStamp ? '正在生成含公章预览…' : '正在生成 C 端无章图…';
            try {
                var app = window.TaxIssueCertificate.buildAppFromAdminDetail(data);
                return window.TaxIssueCertificate.renderDataUrl(app, { showStamp: showStamp })
                    .then(function (urlOrUrls) {
                        var urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
                        var title = showStamp ? '管理端预览含公章' : 'C 端无章预览';
                        var downloadBase =
                            (data.user && (data.user.real_name || data.user.username)) ||
                            (issue.record_no ? '纳税记录_' + issue.record_no : '纳税记录');
                        container.innerHTML =
                            '<div class="ud-cert-preview-label">' +
                            esc(title) +
                            '</div>' +
                            urls
                                .map(function (u, i) {
                                    var gap = i < urls.length - 1 ? ' style="margin-bottom:12px"' : '';
                                    var pageSuffix = urls.length > 1 ? '_第' + (i + 1) + '页' : '';
                                    return (
                                        '<div class="ud-cert-preview-page"' +
                                        gap +
                                        '>' +
                                        '<img src="' +
                                        u +
                                        '" alt="纳税记录凭证' +
                                        pageSuffix +
                                        esc(altSuffix) +
                                        '" title="' +
                                        esc(title) +
                                        '">' +
                                        '<div class="ud-cert-preview-actions">' +
                                        '<a class="btn-sm" href="' +
                                        u +
                                        '" download="' +
                                        esc(downloadBase + (showStamp ? '_管理端' : '_C端无章') + pageSuffix + '.png') +
                                        '">下载' +
                                        (urls.length > 1 ? '第' + (i + 1) + '页' : '') +
                                        '</a>' +
                                        '</div></div>'
                                    );
                                })
                                .join('');
                    })
                    .catch(function (err) {
                        container.textContent = (err && err.message) || '凭证生成失败';
                    });
            } catch (e) {
                container.textContent = (e && e.message) || '凭证生成失败';
                return Promise.resolve();
            }
        }

        function mountUserDataCertificate(username, data) {
            var safeKey = userDataCertSafeKey(username);
            var el = document.getElementById('ud_certificate_' + safeKey);
            var stampBtn = document.getElementById('ud_certificate_stamp_btn_' + safeKey);
            var clientBtn = document.getElementById('ud_certificate_client_btn_' + safeKey);
            var issue = data && data.latest_issue_application;
            var canRender =
                issue &&
                issue.period_start &&
                issue.period_end &&
                data &&
                (data.tax_records || []).length &&
                window.TaxIssueCertificate &&
                typeof window.TaxIssueCertificate.renderDataUrl === 'function';
            var certCache = { stamp: '', client: '' };

            function setModeActive(showStamp) {
                if (stampBtn) stampBtn.classList.toggle('is-active', showStamp);
                if (clientBtn) clientBtn.classList.toggle('is-active', !showStamp);
            }

            function showCachedOrRender(showStamp) {
                if (!el) return Promise.resolve();
                var cacheKey = showStamp ? 'stamp' : 'client';
                if (certCache[cacheKey]) {
                    el.innerHTML = certCache[cacheKey];
                    setModeActive(showStamp);
                    return Promise.resolve();
                }
                setModeActive(showStamp);
                return renderUserDataCertificateImages(el, data, {
                    showStamp: showStamp,
                    altSuffix: showStamp ? '（管理端）' : '（C端无章）'
                }).then(function () {
                    certCache[cacheKey] = el.innerHTML;
                });
            }

            if (!canRender) {
                renderUserDataCertificateImages(el, data, { showStamp: true, altSuffix: '（管理端）' });
                if (clientBtn) {
                    clientBtn.disabled = true;
                    clientBtn.title = '需有 C 端开具记录及个税明细';
                }
                if (stampBtn) stampBtn.disabled = true;
                return;
            }

            showCachedOrRender(true);
            if (stampBtn) {
                stampBtn.onclick = function () {
                    if (stampBtn.classList.contains('is-active')) return;
                    showCachedOrRender(true);
                };
            }
            if (clientBtn) {
                clientBtn.onclick = function () {
                    if (clientBtn.classList.contains('is-active')) return;
                    showCachedOrRender(false);
                };
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

        var userActivateTarget = null;
        var userPasswordTarget = null;

        function closeUserPasswordModal() {
            var bd = document.getElementById('userPasswordBackdrop');
            if (bd) {
                bd.setAttribute('hidden', '');
            }
            userPasswordTarget = null;
            var inp = document.getElementById('userPasswordInput');
            var inp2 = document.getElementById('userPasswordConfirmInput');
            if (inp) {
                inp.value = '';
            }
            if (inp2) {
                inp2.value = '';
            }
        }

        function openUserPasswordModal(username, currentPassword) {
            userPasswordTarget = username;
            var metaEl = document.getElementById('userPasswordMeta');
            if (metaEl) {
                metaEl.textContent =
                    '为账号「' +
                    username +
                    '」设置新密码（当前：' +
                    (currentPassword ? currentPassword : '—') +
                    '）。保存后用户需用新密码登录，已登录会话将失效。';
            }
            var inp = document.getElementById('userPasswordInput');
            var inp2 = document.getElementById('userPasswordConfirmInput');
            if (inp) {
                inp.value = '';
            }
            if (inp2) {
                inp2.value = '';
            }
            var bd = document.getElementById('userPasswordBackdrop');
            if (bd) {
                bd.removeAttribute('hidden');
            }
            if (inp) {
                try {
                    inp.focus();
                } catch (eFocus) {}
            }
        }

        function submitUserPassword() {
            if (!userPasswordTarget) {
                return;
            }
            var pwdEl = document.getElementById('userPasswordInput');
            var pwd2El = document.getElementById('userPasswordConfirmInput');
            var pwd = pwdEl ? String(pwdEl.value || '') : '';
            var pwd2 = pwd2El ? String(pwd2El.value || '') : '';
            if (!pwd) {
                alert('请输入新密码');
                return;
            }
            if (pwd !== pwd2) {
                alert('两次输入的密码不一致');
                return;
            }
            var confirmBtn = document.getElementById('userPasswordConfirm');
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.textContent = '保存中…';
            }
            adminFetch('api/admin/user-password', {
                method: 'POST',
                body: JSON.stringify({ username: userPasswordTarget, new_password: pwd })
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (d) {
                    if (d.code === 200) {
                        closeUserPasswordModal();
                        loadUsers();
                        alert(d.msg || '密码已修改');
                    } else {
                        alert(d.msg || '修改失败');
                    }
                })
                .catch(function () {
                    alert('网络错误');
                })
                .finally(function () {
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = '保存';
                    }
                });
        }

        function closeUserActivateModal() {
            var bd = document.getElementById('userActivateBackdrop');
            if (bd) {
                bd.setAttribute('hidden', '');
            }
            userActivateTarget = null;
            var inp = document.getElementById('userActivateCodeInput');
            if (inp) {
                inp.value = '';
            }
        }

        function openUserActivateModal(username) {
            userActivateTarget = username;
            var metaEl = document.getElementById('userActivateMeta');
            if (metaEl) {
                metaEl.textContent = '为账号「' + username + '」输入激活码并确认激活。';
            }
            var inp = document.getElementById('userActivateCodeInput');
            if (inp) {
                inp.value = '';
            }
            var bd = document.getElementById('userActivateBackdrop');
            if (bd) {
                bd.removeAttribute('hidden');
            }
            if (inp) {
                try {
                    inp.focus();
                } catch (eFocus) {}
            }
        }

        function submitUserActivate() {
            if (!userActivateTarget) {
                return;
            }
            var codeEl = document.getElementById('userActivateCodeInput');
            var code = codeEl ? String(codeEl.value || '').trim() : '';
            if (!code) {
                alert('请输入激活码');
                return;
            }
            var confirmBtn = document.getElementById('userActivateConfirm');
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.textContent = '激活中…';
            }
            adminFetch('api/admin/user-activate', {
                method: 'POST',
                body: JSON.stringify({ username: userActivateTarget, code: code })
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (d) {
                    if (d.code === 200) {
                        closeUserActivateModal();
                        loadUsers();
                        alert(d.msg || '激活成功');
                    } else {
                        alert(d.msg || '激活失败');
                    }
                })
                .catch(function () {
                    alert('网络错误');
                })
                .finally(function () {
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = '确认激活';
                    }
                });
        }

        function loadUsers(p) {
            ensureUserDetailPagesToggleDelegation();
            if (p != null) userPage = p;
            
            var username = document.getElementById('filterUsername').value.trim();
            var realName = document.getElementById('filterRealName').value.trim();
            var active = document.getElementById('filterActive').value;
            var banned = document.getElementById('filterBanned').value;
            var exactEl = document.getElementById('filterExact');
            var riskEl = document.getElementById('filterRisk');
            var exact = exactEl && exactEl.checked;
            var risk = riskEl ? riskEl.value : '';
            var salaryMinEl = document.getElementById('filterSalaryMin');
            var salaryMaxEl = document.getElementById('filterSalaryMax');
            var salaryMin = salaryMinEl ? salaryMinEl.value.trim() : '';
            var salaryMax = salaryMaxEl ? salaryMaxEl.value.trim() : '';
            var taxModEl = document.getElementById('filterTaxModifiedToday');
            var taxModifiedToday = taxModEl ? taxModEl.value : '';
            var loginInactiveEl = document.getElementById('filterLoginInactive');
            var loginInactiveDays = loginInactiveEl ? loginInactiveEl.value : '';

            var url = 'api/admin/users?page=' + userPage + '&limit=' + userLimit;
            if (username) url += '&username=' + encodeURIComponent(username);
            if (realName) url += '&real_name=' + encodeURIComponent(realName);
            if (active !== '') url += '&active=' + active;
            if (banned !== '') url += '&banned=' + banned;
            if (exact) url += '&exact=1';
            if (risk !== '') url += '&risk=' + encodeURIComponent(risk);
            if (salaryMin !== '') url += '&salary_min=' + encodeURIComponent(salaryMin);
            if (salaryMax !== '') url += '&salary_max=' + encodeURIComponent(salaryMax);
            if (taxModifiedToday !== '') {
                url += '&tax_modified_today=' + encodeURIComponent(taxModifiedToday);
            }
            if (loginInactiveDays !== '') {
                url += '&login_inactive_days=' + encodeURIComponent(loginInactiveDays);
            }

            adminFetch(url)
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.code !== 200 || !data.data) return;
                    var list = data.data.users || [];
                    var total = data.data.total || 0;
                    document.getElementById('userStat').textContent = '共 ' + total + ' 个账号';
                    
                    var totalPages = Math.ceil(total / userLimit) || 1;
                    document.getElementById('userPageInfo').textContent =
                        '第 ' + userPage + ' 页 / 共 ' + totalPages + ' 页（每页 ' + userLimit + ' 条）';
                    document.getElementById('userPrev').disabled = userPage <= 1;
                    document.getElementById('userNext').disabled = userPage >= totalPages;

                    var html = '';
                    list.forEach(function (u) {
                        var act = u.account_active ? '<span class="badge badge-yes">已激活</span>' : '<span class="badge badge-no">未激活</span>';
                        var ban = u.banned ? '<span class="badge badge-no">已封禁</span>' : '<span class="badge badge-yes">正常</span>';
                        var riskCell = '<span class="risk-hint-line">—</span>';
                        if (u.risk && u.risk_messages && u.risk_messages.length) {
                            riskCell =
                                '<span class="badge badge-risk" title="' +
                                esc(u.risk_messages.join('；')) +
                                '">风险</span><div class="risk-hint-line">' +
                                esc(u.risk_messages.join('；')) +
                                '</div>';
                        } else {
                            var ipCnt = u.distinct_ip_count != null ? Number(u.distinct_ip_count) : 0;
                            var dc = u.device_count != null ? Number(u.device_count) : 0;
                            riskCell =
                                '<span class="risk-hint-line">IP' +
                                ipCnt +
                                '个 / 设备' +
                                dc +
                                '台</span>';
                        }
                        var detailBtn = '<button type="button" class="btn-sm btn-detail btn-user-detail" data-u="' + esc(u.username) + '" data-k="' + keyForUser(u.username) + '">详情</button>';
                        var ops = '';
                        if (!u.account_active) {
                            ops +=
                                '<button type="button" class="btn-sm btn-activate btn-user-activate" data-u="' +
                                esc(u.username) +
                                '">激活</button> ';
                        }
                        ops += (u.banned
                            ? '<button type="button" class="btn-sm btn-unban btn-ban-act" data-u="' + esc(u.username) + '" data-b="0">解封</button>'
                            : '<button type="button" class="btn-sm btn-ban btn-ban-act" data-u="' + esc(u.username) + '" data-b="1">封禁</button>')
                            + ' ' + detailBtn
                            + ' <button type="button" class="btn-sm btn-del-user btn-delete-user" data-u="' + esc(u.username) + '">删除</button>';
                        if (u.account_active) {
                            ops += ' <button type="button" class="btn-sm btn-refund btn-refund-user" data-u="' + esc(u.username) + '">退款</button>';
                        }
                        
                        var detailKey = keyForUser(u.username);
                        html += '<tr>';
                        var taxModBadge = u.tax_modified_today
                            ? '<span class="dau-tax-badge modified-today">有</span>'
                            : '<span style="color:#bbb;">—</span>';
                        html += '<td>' + esc(u.id) + '</td>';
                        html += '<td class="cell-break">' + esc(u.username) + '</td>';
                        html += '<td class="col-tax-mod">' + taxModBadge + '</td>';
                        html += '<td class="cell-break">' + esc(u.real_name) + '</td>';
                        html +=
                            '<td class="cell-break">' +
                            esc(u.channel_analysis_label || u.register_source_channel_label || '—') +
                            '</td>';
                        html += '<td class="cell-break"><button type="button" class="btn-link-pwd btn-user-password" data-u="' + esc(u.username) + '" data-pwd="' + esc(u.password || '') + '" title="点击修改密码">' + esc(u.password || '—') + '</button></td>';
                        html += '<td>' + act + '</td>';
                        html += '<td>' + ban + '</td>';
                        html += '<td class="cell-break">' + riskCell + '</td>';
                        html +=
                            '<td class="cell-break">' +
                            esc(u.avg_salary_6m_label != null ? String(u.avg_salary_6m_label) : '未填写') +
                            '</td>';
                        html += '<td class="cell-break">' + esc(u.upline_admin || '—') + '</td>';
                        html += '<td>' + formatDt(u.created_at) + '</td>';
                        html += '<td class="col-ops">' + ops + '</td>';
                        html += '</tr>';
                        html += '<tr id="user_detail_row_' + detailKey + '" class="users-detail-row" style="display:none;">';
                        html += '<td colspan="13"><div id="user_detail_box_' + detailKey + '" style="padding:4px 0;color:#888;">点击详情加载设备与页面记录…</div></td>';
                        html += '</tr>';
                    });
                    document.getElementById('userTbody').innerHTML = html || '<tr><td colspan="13">暂无数据</td></tr>';
                    
                    // 重新绑定事件
                    document.getElementById('userTbody').querySelectorAll('.btn-user-password').forEach(function (btn) {
                        btn.onclick = function () {
                            openUserPasswordModal(btn.getAttribute('data-u'), btn.getAttribute('data-pwd') || '');
                        };
                    });
                    document.getElementById('userTbody').querySelectorAll('.btn-user-activate').forEach(function (btn) {
                        btn.onclick = function () {
                            openUserActivateModal(btn.getAttribute('data-u'));
                        };
                    });
                    document.getElementById('userTbody').querySelectorAll('.btn-ban-act').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u');
                            var b = btn.getAttribute('data-b') === '1';
                            var tip = b ? '确定封禁「' + name + '」？' : '确定解封「' + name + '」？';
                            if (!confirm(tip)) return;
                            adminFetch('api/admin/ban', {
                                method: 'POST',
                                body: JSON.stringify({ username: name, banned: b ? 1 : 0 })
                            })
                                .then(function (r) { return r.json(); })
                                .then(function (d) {
                                    if (d.code === 200) {
                                        loadUsers();
                                    } else {
                                        alert(d.msg || '操作失败');
                                    }
                                })
                                .catch(function () { alert('网络错误'); });
                        };
                    });
                    document.getElementById('userTbody').querySelectorAll('.btn-delete-user').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u');
                            if (!confirm('确定从注册用户列表删除账号「' + name + '」？\n数据仍保留在数据库，可在「已删除账号」中恢复。')) return;
                            adminFetch('api/admin/user-delete', {
                                method: 'POST',
                                body: JSON.stringify({ username: name })
                            })
                                .then(function (r) { return r.json(); })
                                .then(function (d) {
                                    if (d.code === 200) {
                                        loadUsers();
                                    } else {
                                        alert(d.msg || '删除失败');
                                    }
                                })
                                .catch(function () { alert('网络错误'); });
                        };
                    });
                    document.getElementById('userTbody').querySelectorAll('.btn-refund-user').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u');
                            if (!confirm(
                                '确定对已激活账号「' + name + '」执行退款？\n' +
                                    '将封禁并从列表移除，激活数据不计入用户数据与数据统计，且不可恢复。'
                            )) return;
                            adminFetch('api/admin/user-refund', {
                                method: 'POST',
                                body: JSON.stringify({ username: name })
                            })
                                .then(function (r) { return r.json(); })
                                .then(function (d) {
                                    if (d.code === 200) {
                                        loadUsers();
                                    } else {
                                        alert(d.msg || '退款失败');
                                    }
                                })
                                .catch(function () { alert('网络错误'); });
                        };
                    });
                    document.getElementById('userTbody').querySelectorAll('.btn-user-detail').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u');
                            var key = btn.getAttribute('data-k');
                            var row = document.getElementById('user_detail_row_' + key);
                            var box = document.getElementById('user_detail_box_' + key);
                            if (!row || !box) return;
                            var opening = row.style.display === 'none';
                            if (!opening) {
                                row.style.display = 'none';
                                btn.textContent = '详情';
                                return;
                            }
                            row.style.display = '';
                            btn.textContent = '收起';
                            box.removeAttribute('data-loaded');
                            box.textContent = '加载中…';
                            adminFetch('api/admin/user-tax-records?username=' + encodeURIComponent(name))
                                .then(function (r) { return r.json(); })
                                .then(function (d) {
                                    if (d.code !== 200) {
                                        box.textContent = d.msg || '加载失败';
                                        return;
                                    }
                                    box.innerHTML = buildTaxRecordsHtml(name, d.data || {});
                                    box.setAttribute('data-loaded', '1');
                                })
                                .catch(function () {
                                    box.textContent = '网络错误，加载失败';
                                });
                        };
                    });
                })
                .catch(function () {
                    document.getElementById('userStat').textContent = '加载失败';
                });
        }

        function loadDeletedUsers(p) {
            if (p != null) deletedUserPage = p;

            var username = document.getElementById('filterDeletedUsername').value.trim();
            var realName = document.getElementById('filterDeletedRealName').value.trim();
            var exactEl = document.getElementById('filterDeletedExact');
            var exact = exactEl && exactEl.checked;

            var url = 'api/admin/users/deleted?page=' + deletedUserPage + '&limit=' + deletedUserLimit;
            if (username) url += '&username=' + encodeURIComponent(username);
            if (realName) url += '&real_name=' + encodeURIComponent(realName);
            if (exact) url += '&exact=1';

            adminFetch(url)
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.code !== 200 || !data.data) return;
                    var list = data.data.users || [];
                    var total = data.data.total || 0;
                    document.getElementById('deletedUserStat').textContent = '共 ' + total + ' 个已删除账号';

                    var totalPages = Math.ceil(total / deletedUserLimit) || 1;
                    document.getElementById('deletedUserPageInfo').textContent =
                        '第 ' + deletedUserPage + ' 页 / 共 ' + totalPages + ' 页（每页 ' + deletedUserLimit + ' 条）';
                    document.getElementById('deletedUserPrev').disabled = deletedUserPage <= 1;
                    document.getElementById('deletedUserNext').disabled = deletedUserPage >= totalPages;

                    var html = '';
                    list.forEach(function (u) {
                        var act = u.account_active ? '<span class="badge badge-yes">已激活</span>' : '<span class="badge badge-no">未激活</span>';
                        var ban = u.banned ? '<span class="badge badge-no">已封禁</span>' : '<span class="badge badge-yes">正常</span>';
                        var refunded = !!(u.activation_refunded_at && String(u.activation_refunded_at).trim());
                        html += '<tr>';
                        html += '<td>' + esc(u.id) + '</td>';
                        html += '<td class="cell-break">' + esc(u.username) + '</td>';
                        html += '<td class="cell-break">' + esc(u.real_name) + '</td>';
                        html += '<td class="cell-break">' + esc(u.channel_analysis_label || '—') + '</td>';
                        html += '<td>' + act + '</td>';
                        html += '<td>' + ban + '</td>';
                        html += '<td>' + formatDt(u.created_at) + '</td>';
                        html += '<td>' + formatDt(u.list_hidden_at) + '</td>';
                        html += '<td class="cell-break">' + esc(u.list_hidden_by || '—') + '</td>';
                        if (refunded) {
                            html +=
                                '<td class="col-ops"><span class="badge badge-no" style="margin-right:6px;" title="曾执行激活退款">已退款</span>' +
                                '<button type="button" class="btn-sm btn-unban btn-restore-user" data-u="' +
                                esc(u.username) +
                                '" data-refunded="1">恢复</button></td>';
                        } else {
                            html +=
                                '<td class="col-ops"><button type="button" class="btn-sm btn-unban btn-restore-user" data-u="' +
                                esc(u.username) +
                                '">恢复</button></td>';
                        }
                        html += '</tr>';
                    });
                    document.getElementById('deletedUserTbody').innerHTML =
                        html || '<tr><td colspan="10">暂无已删除账号</td></tr>';

                    document.getElementById('deletedUserTbody').querySelectorAll('.btn-restore-user').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u');
                            var isRefunded = btn.getAttribute('data-refunded') === '1';
                            var tip = isRefunded
                                ? '确定恢复已退款账号「' +
                                  name +
                                  '」至注册用户列表？\n将解除封禁、恢复激活状态，激活数据重新计入统计。'
                                : '确定恢复账号「' + name + '」至注册用户列表？';
                            if (!confirm(tip)) return;
                            adminFetch('api/admin/user-restore', {
                                method: 'POST',
                                body: JSON.stringify({ username: name })
                            })
                                .then(function (r) { return r.json(); })
                                .then(function (d) {
                                    if (d.code === 200) {
                                        loadDeletedUsers();
                                    } else {
                                        alert(d.msg || '恢复失败');
                                    }
                                })
                                .catch(function () { alert('网络错误'); });
                        };
                    });
                })
                .catch(function () {
                    document.getElementById('deletedUserStat').textContent = '加载失败';
                });
        }

        function codeOwnerLabel(c) {
            return c.owner_admin_username && String(c.owner_admin_username).trim() !== ''
                ? esc(String(c.owner_admin_username).trim())
                : '—';
        }

        function renderCodeTableRows(list, options) {
            options = options || {};
            var showChannel = !!options.showChannel;
            var html = '';
            list.forEach(function (c) {
                var usedAt =
                    c.last_used_at && (Number(c.used_count) > 0)
                        ? formatDt(c.last_used_at)
                        : '—';
                var usedBy =
                    c.used_by_username && String(c.used_by_username).trim() !== ''
                        ? esc(String(c.used_by_username).trim())
                        : '—';
                html += '<tr>';
                html += '<td>' + esc(c.id) + '</td>';
                html += '<td>' + esc(c.code) + '</td>';
                html += '<td><button type="button" class="btn-sm btn-copy btn-copy-code" data-code="' + esc(c.code) + '">复制</button></td>';
                html += '<td>' + codeOwnerLabel(c) + '</td>';
                html += '<td>' + usedBy + '</td>';
                if (showChannel) {
                    var ch =
                        c.used_user_channel_label && String(c.used_user_channel_label).trim() !== ''
                            ? esc(String(c.used_user_channel_label).trim())
                            : '—';
                    html += '<td class="cell-break">' + ch + '</td>';
                }
                html += '<td>' + usedAt + '</td>';
                html += '</tr>';
            });
            return html;
        }

        function loadCodes(p) {
            if (p != null) codePage = p;
            var ownerAdmin = '';
            var ownerInput = document.getElementById('codeOwnerAdminFilter');
            if (ownerInput) ownerAdmin = String(ownerInput.value || '').trim();
            var usedBy = '';
            var usedInput = document.getElementById('codeUsedByFilter');
            if (usedInput) usedBy = String(usedInput.value || '').trim();
            var usedExactEl = document.getElementById('codeUsedByExact');
            var usedExact = !!(usedExactEl && usedExactEl.checked);
            var usageFilterEl = document.getElementById('codeUsageFilter');
            var usageStatus = usageFilterEl ? String(usageFilterEl.value || '').trim() : '';
            var codeQ = '';
            var codeInput = document.getElementById('codeCodeFilter');
            if (codeInput) codeQ = String(codeInput.value || '').trim();
            var codeExactEl = document.getElementById('codeCodeExact');
            var codeExact = !!(codeExactEl && codeExactEl.checked);
            var isSuper = !!(currentAdminProfile && currentAdminProfile.is_super);
            var hasFilter = !!(ownerAdmin || usedBy || usageStatus || codeQ);
            var limit = isSuper && !hasFilter ? 20 : codeLimit;
            var q = 'api/admin/codes?page=' + codePage + '&limit=' + limit + '&scope=general';
            if (ownerAdmin) {
                q += '&owner_admin=' + encodeURIComponent(ownerAdmin);
            }
            if (usedBy) {
                q += '&used_by=' + encodeURIComponent(usedBy);
                if (usedExact) q += '&used_by_exact=1';
            }
            if (usageStatus) {
                q += '&usage_status=' + encodeURIComponent(usageStatus);
            }
            if (codeQ) {
                q += '&code=' + encodeURIComponent(codeQ);
                if (codeExact) q += '&code_exact=1';
            }
            adminFetch(q)
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.code !== 200 || !data.data) return;
                    var list = data.data.codes || [];
                    var total = data.data.total || 0;
                    var statEl = document.getElementById('codeListStat');
                    if (statEl) {
                        var filterParts = [];
                        if (ownerAdmin) filterParts.push('管理员「' + ownerAdmin + '」');
                        if (usedBy) {
                            filterParts.push(
                                (usedExact ? '使用账号精准「' : '使用账号「') + usedBy + '」'
                            );
                        }
                        if (codeQ) {
                            filterParts.push(
                                (codeExact ? '激活码精准「' : '激活码「') + codeQ + '」'
                            );
                        }
                        if (usageStatus === 'unused') {
                            filterParts.push('未使用');
                        } else if (usageStatus === 'used') {
                            filterParts.push('已使用');
                        }
                        if (isSuper && !hasFilter) {
                            statEl.textContent = '共 ' + total + ' 条（非闲鱼，全部管理员）';
                        } else if (filterParts.length) {
                            statEl.textContent = '共 ' + total + ' 条（非闲鱼，筛选：' + filterParts.join('，') + '）';
                        } else {
                            statEl.textContent = '共 ' + total + ' 条（非闲鱼，本账号生成）';
                        }
                    }

                    var totalPages = Math.ceil(total / limit) || 1;
                    document.getElementById('codePageInfo').textContent = '第 ' + codePage + ' 页 / 共 ' + totalPages + ' 页';
                    document.getElementById('codePrev').disabled = codePage <= 1;
                    document.getElementById('codeNext').disabled = codePage >= totalPages;

                    var html = renderCodeTableRows(list, { showChannel: false });
                    document.getElementById('codeTbody').innerHTML =
                        html || '<tr><td colspan="6">暂无激活码</td></tr>';
                })
                .catch(function () {});
        }

        function loadXianyuCodes(p) {
            if (p != null) {
                xianyuCodePage = p;
            }
            var ownerAdmin = '';
            var ownerInput = document.getElementById('xianyuCodeOwnerAdminFilter');
            if (ownerInput) ownerAdmin = String(ownerInput.value || '').trim();
            var usedBy = '';
            var usedInput = document.getElementById('xianyuCodeUsedByFilter');
            if (usedInput) usedBy = String(usedInput.value || '').trim();
            var usedExactEl = document.getElementById('xianyuCodeUsedByExact');
            var usedExact = !!(usedExactEl && usedExactEl.checked);
            var usageFilterEl = document.getElementById('xianyuCodeUsageFilter');
            var usageStatus = usageFilterEl ? String(usageFilterEl.value || '').trim() : '';
            var codeQ = '';
            var codeInput = document.getElementById('xianyuCodeCodeFilter');
            if (codeInput) codeQ = String(codeInput.value || '').trim();
            var codeExactEl = document.getElementById('xianyuCodeCodeExact');
            var codeExact = !!(codeExactEl && codeExactEl.checked);
            var isSuper = !!(currentAdminProfile && currentAdminProfile.is_super);
            var hasFilter = !!(ownerAdmin || usedBy || usageStatus || codeQ);
            var limit = isSuper && !hasFilter ? 20 : xianyuCodeLimit;
            var q = 'api/admin/codes?page=' + xianyuCodePage + '&limit=' + limit + '&scope=xianyu';
            if (ownerAdmin) {
                q += '&owner_admin=' + encodeURIComponent(ownerAdmin);
            }
            if (usedBy) {
                q += '&used_by=' + encodeURIComponent(usedBy);
                if (usedExact) q += '&used_by_exact=1';
            }
            if (usageStatus) {
                q += '&usage_status=' + encodeURIComponent(usageStatus);
            }
            if (codeQ) {
                q += '&code=' + encodeURIComponent(codeQ);
                if (codeExact) q += '&code_exact=1';
            }
            adminFetch(q)
                .then(function (r) {
                    return r.json();
                })
                .then(function (data) {
                    if (data.code !== 200 || !data.data) {
                        return;
                    }
                    var list = data.data.codes || [];
                    var total = data.data.total || 0;
                    var statEl = document.getElementById('xianyuCodeListStat');
                    if (statEl) {
                        var filterParts = [];
                        if (ownerAdmin) filterParts.push('管理员「' + ownerAdmin + '」');
                        if (usedBy) {
                            filterParts.push(
                                (usedExact ? '使用账号精准「' : '使用账号「') + usedBy + '」'
                            );
                        }
                        if (codeQ) {
                            filterParts.push(
                                (codeExact ? '激活码精准「' : '激活码「') + codeQ + '」'
                            );
                        }
                        if (usageStatus === 'unused') {
                            filterParts.push('未使用');
                        } else if (usageStatus === 'used') {
                            filterParts.push('已使用');
                        }
                        if (isSuper && !hasFilter) {
                            statEl.textContent = '共 ' + total + ' 条闲鱼激活码（全部管理员）';
                        } else if (filterParts.length) {
                            statEl.textContent =
                                '共 ' + total + ' 条闲鱼激活码（筛选：' + filterParts.join('，') + '）';
                        } else {
                            statEl.textContent = '共 ' + total + ' 条闲鱼激活码（本账号生成）';
                        }
                    }
                    var totalPages = Math.ceil(total / limit) || 1;
                    var pageInfo = document.getElementById('xianyuCodePageInfo');
                    if (pageInfo) {
                        pageInfo.textContent = '第 ' + xianyuCodePage + ' 页 / 共 ' + totalPages + ' 页';
                    }
                    var prevBtn = document.getElementById('xianyuCodePrev');
                    var nextBtn = document.getElementById('xianyuCodeNext');
                    if (prevBtn) {
                        prevBtn.disabled = xianyuCodePage <= 1;
                    }
                    if (nextBtn) {
                        nextBtn.disabled = xianyuCodePage >= totalPages;
                    }
                    var tbody = document.getElementById('xianyuCodeTbody');
                    if (tbody) {
                        var html = renderCodeTableRows(list, { showChannel: true });
                        tbody.innerHTML =
                            html || '<tr><td colspan="7">暂无闲鱼激活码</td></tr>';
                    }
                })
                .catch(function () {});
        }

        var ADMIN_MENU_LABELS = {
            settings: '系统设置',
            'install-guide': '引导安装',
            appearance: '用户端外观',
            codes: '激活码',
            users: '注册用户',
            'user-data': '用户数据',
            'user-behavior': '用户行为',
            'activated-user-analysis': '激活用户分析',
            feedback: '用户反馈',
            'login-log': '管理账号登录流水',
            'user-login-log': '普通用户登录流水',
            analytics: '数据统计（旧）',
            'analytics-conversion': '转化分析',
            'analytics-activity': '用户活跃',
            'analytics-register': '注册分析',
            'analytics-tracking': '埋点分析',
            'analytics-devices': '设备分析',
            'install-guide-stats': '安装页统计',
            'channel-analysis': '渠道分析',
            'api-analytics': '接口统计',
            'admin-accounts': '后台账号权限',
            'server-monitor': '服务器监控'
        };

        function menuLabel(key) {
            return ADMIN_MENU_LABELS[key] || key;
        }

        function keyForAdminAccount(username) {
            return String(username || '').replace(/[^a-zA-Z0-9_.-]/g, '_');
        }

        function renderAdminAccountActivatedPanel(box, ownerAdmin, data) {
            if (!box) return;
            var users = Array.isArray(data.users) ? data.users : [];
            var page = Number(data.page) || 1;
            var limit = Number(data.limit) || 10;
            var total = Number(data.total) || 0;
            var totalPages = Math.max(1, Math.ceil(total / limit) || 1);
            box.setAttribute('data-owner-admin', ownerAdmin);
            box.setAttribute('data-page', String(page));
            box.setAttribute('data-loaded', '1');

            var html = '<div class="admin-account-activated-wrap">';
            html += '<div class="user-detail-title">激活账号（' + esc(ownerAdmin) + '）· 共 ' + total + ' 个</div>';
            html += '<div class="scroll-x"><table class="user-detail-table"><thead><tr>';
            html += '<th>账号</th><th>姓名</th><th>激活状态</th><th>账号状态</th><th>激活时间</th><th>激活码</th>';
            html += '</tr></thead><tbody>';
            if (!users.length) {
                html += '<tr><td colspan="6">暂无激活账号</td></tr>';
            } else {
                users.forEach(function (u) {
                    html += '<tr>';
                    html += '<td>' + esc(u.username) + '</td>';
                    html += '<td>' + esc(u.real_name || '—') + '</td>';
                    html += '<td>' + esc(u.account_active ? '已激活' : '未激活') + '</td>';
                    html += '<td>' + esc(u.banned ? '已封禁' : '正常') + '</td>';
                    html += '<td>' + esc(u.activated_at ? formatDt(u.activated_at) : '—') + '</td>';
                    html += '<td><code>' + esc(u.activation_code || '—') + '</code></td>';
                    html += '</tr>';
                });
            }
            html += '</tbody></table></div>';
            html += '<div class="pagination">';
            html +=
                '<button type="button" class="btn-page admin-acc-act-prev" data-owner="' +
                esc(ownerAdmin) +
                '"' +
                (page <= 1 ? ' disabled' : '') +
                '>上一页</button>';
            html +=
                '<span class="admin-acc-act-page-info">第 ' +
                page +
                ' / ' +
                totalPages +
                ' 页</span>';
            html +=
                '<button type="button" class="btn-page admin-acc-act-next" data-owner="' +
                esc(ownerAdmin) +
                '"' +
                (page >= totalPages ? ' disabled' : '') +
                '>下一页</button>';
            html += '</div></div>';
            box.innerHTML = html;
        }

        function loadAdminAccountActivatedUsers(ownerAdmin, page, box) {
            if (!box || !ownerAdmin) return;
            box.removeAttribute('data-loaded');
            box.textContent = '加载中…';
            adminFetch(
                'api/admin/accounts/activated-users?owner_admin=' +
                    encodeURIComponent(ownerAdmin) +
                    '&page=' +
                    encodeURIComponent(String(page || 1)) +
                    '&limit=10'
            )
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        box.textContent = j.msg || '加载失败';
                        return;
                    }
                    renderAdminAccountActivatedPanel(box, ownerAdmin, j.data);
                })
                .catch(function () {
                    box.textContent = '网络错误';
                });
        }

        function selectedMenusFromRoot(rootEl) {
            if (!rootEl) return [];
            var out = [];
            rootEl.querySelectorAll('input[type="checkbox"][data-menu-key]').forEach(function (el) {
                if (el.checked) out.push(String(el.getAttribute('data-menu-key') || ''));
            });
            return out.filter(Boolean);
        }

        function renderAdminMenuSelector(rootEl, selected) {
            if (!rootEl) return;
            var selectedMap = {};
            (selected || []).forEach(function (k) { selectedMap[k] = true; });
            var html = '';
            adminMenuKeyList.forEach(function (k) {
                html += '<label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#444;">';
                html += '<input type="checkbox" data-menu-key="' + esc(k) + '"' + (selectedMap[k] ? ' checked' : '') + '>';
                html += '<span>' + esc(menuLabel(k)) + '</span>';
                html += '</label>';
            });
            rootEl.innerHTML = html;
        }

        function loadAdminAccounts() {
            if (!adminHasMenu('admin-accounts')) {
                return;
            }
            adminFetch('api/admin/accounts')
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.code !== 200 || !data.data) {
                        alert(data.msg || '加载后台账号失败');
                        return;
                    }
                    adminMenuKeyList = Array.isArray(data.data.menu_keys) ? data.data.menu_keys : [];
                    renderAdminMenuSelector(document.getElementById('adminAccountMenuSelector'), ['codes']);
                    var list = Array.isArray(data.data.accounts) ? data.data.accounts : [];
                    var html = '';
                    list.forEach(function (a) {
                        var isSuper = !!a.is_super;
                        var accKey = keyForAdminAccount(a.username);
                        var menuText = isSuper ? '全部菜单（超级账号）' : (Array.isArray(a.menus) ? a.menus.map(menuLabel).join('、') : '—');
                        html += '<tr>';
                        html += '<td>' + esc(a.username) + '</td>';
                        html += '<td>' + esc(a.full_name || '—') + '</td>';
                        html += '<td>' + esc(isSuper ? 'admin(超级)' : '子账号') + '</td>';
                        html += '<td class="cell-break">' + esc(menuText || '—') + '</td>';
                        html += '<td>';
                        if (!isSuper) {
                            html += '<input type="text" class="admin-account-newpwd" data-username="' + esc(a.username) + '" placeholder="留空=不改">';
                        } else {
                            html += '—';
                        }
                        html += '</td>';
                        html += '<td>';
                        html += '<button type="button" class="btn-sm btn-detail btn-admin-account-detail" data-username="' + esc(a.username) + '">详情</button>';
                        if (!isSuper) {
                            html += ' <button type="button" class="btn-sm btn-copy btn-admin-account-edit" data-username="' + esc(a.username) + '">改菜单</button> ';
                            html += '<button type="button" class="btn-sm btn-ban btn-admin-account-del" data-username="' + esc(a.username) + '">删除</button>';
                        }
                        html += '</td>';
                        html += '</tr>';
                        if (!isSuper) {
                            html += '<tr id="admin_acc_edit_row_' + accKey + '" style="display:none;"><td colspan="6">';
                            html += '<div class="admin-account-edit-panel" data-username="' + esc(a.username) + '">';
                            html += '<div class="form-row" style="margin:0 0 6px;align-items:center;gap:8px;">';
                            html += '<label style="font-size:12px;color:#666;">姓名</label>';
                            html += '<input type="text" class="admin-account-fullname" data-username="' + esc(a.username) + '" value="' + esc(a.full_name || '') + '" placeholder="填写姓名">';
                            html += '</div>';
                            html += '<div style="margin:0 0 6px;font-size:12px;color:#666;">可用菜单</div>';
                            html += '<div class="form-row admin-account-menu-row" data-username="' + esc(a.username) + '" style="gap:12px;margin:0;padding:0 0 2px;">';
                            adminMenuKeyList.forEach(function (mk) {
                                var checked = a.menus && a.menus.indexOf(mk) >= 0;
                                html += '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#555;">';
                                html += '<input type="checkbox" data-menu-key="' + esc(mk) + '"' + (checked ? ' checked' : '') + '>';
                                html += '<span>' + esc(menuLabel(mk)) + '</span>';
                                html += '</label>';
                            });
                            html += '</div>';
                            html += '<div style="margin-top:8px;">';
                            html += '<button type="button" class="btn-sm btn-primary btn-admin-account-save" data-username="' + esc(a.username) + '">保存</button>';
                            html += '</div>';
                            html += '</div></td></tr>';
                        }
                        html +=
                            '<tr id="admin_acc_detail_row_' +
                            accKey +
                            '" style="display:none;"><td colspan="6"><div id="admin_acc_detail_box_' +
                            accKey +
                            '" style="padding:4px 0;color:#888;">点击详情查看该账号下的激活账号…</div></td></tr>';
                    });
                    document.getElementById('adminAccountTbody').innerHTML = html || '<tr><td colspan="6">暂无后台账号</td></tr>';
                })
                .catch(function () {
                    alert('网络错误');
                });
        }

        document.getElementById('userPrev').onclick = function() { if (userPage > 1) loadUsers(userPage - 1); };
        document.getElementById('userNext').onclick = function() { loadUsers(userPage + 1); };
        var userPageLimitSel = document.getElementById('userPageLimit');
        if (userPageLimitSel) {
            userPageLimitSel.onchange = function () {
                var n = parseInt(this.value, 10);
                userLimit = USER_LIMIT_OPTIONS.indexOf(n) >= 0 ? n : 10;
                this.value = String(userLimit);
                try {
                    localStorage.setItem(USER_LIMIT_STORAGE_KEY, String(userLimit));
                } catch (e) {}
                loadUsers(1);
            };
        }

        var deletedUserPrev = document.getElementById('deletedUserPrev');
        if (deletedUserPrev) {
            deletedUserPrev.onclick = function () {
                if (deletedUserPage > 1) loadDeletedUsers(deletedUserPage - 1);
            };
        }
        var deletedUserNext = document.getElementById('deletedUserNext');
        if (deletedUserNext) {
            deletedUserNext.onclick = function () {
                loadDeletedUsers(deletedUserPage + 1);
            };
        }
        var deletedUserPageLimitSel = document.getElementById('deletedUserPageLimit');
        if (deletedUserPageLimitSel) {
            deletedUserPageLimitSel.onchange = function () {
                var n = parseInt(this.value, 10);
                deletedUserLimit = USER_LIMIT_OPTIONS.indexOf(n) >= 0 ? n : 10;
                this.value = String(deletedUserLimit);
                try {
                    localStorage.setItem(DELETED_USER_LIMIT_STORAGE_KEY, String(deletedUserLimit));
                } catch (e) {}
                loadDeletedUsers(1);
            };
        }
        var btnSearchDeletedUsers = document.getElementById('btnSearchDeletedUsers');
        if (btnSearchDeletedUsers) {
            btnSearchDeletedUsers.onclick = function () { loadDeletedUsers(1); };
        }
        var btnResetDeletedUsers = document.getElementById('btnResetDeletedUsers');
        if (btnResetDeletedUsers) {
            btnResetDeletedUsers.onclick = function () {
                document.getElementById('filterDeletedUsername').value = '';
                document.getElementById('filterDeletedRealName').value = '';
                var exactEl = document.getElementById('filterDeletedExact');
                if (exactEl) exactEl.checked = false;
                loadDeletedUsers(1);
            };
        }

        document.getElementById('btnSearchUsers').onclick = function() { loadUsers(1); };
        var btnSearchUserData = document.getElementById('btnSearchUserData');
        if (btnSearchUserData) {
            btnSearchUserData.onclick = function () {
                loadUserDataList(1);
            };
        }
        var btnResetUserData = document.getElementById('btnResetUserData');
        if (btnResetUserData) {
            btnResetUserData.onclick = function () {
                document.getElementById('udFilterUsername').value = '';
                document.getElementById('udFilterRealName').value = '';
                document.getElementById('udFilterCompany').value = '';
                document.getElementById('udFilterFamily').value = '';
                document.getElementById('udFilterBank').value = '';
                document.getElementById('udFilterSalaryMin').value = '';
                document.getElementById('udFilterSalaryMax').value = '';
                loadUserDataList(1);
            };
        }
        var btnRefreshUserDataAnalytics = document.getElementById('btnRefreshUserDataAnalytics');
        if (btnRefreshUserDataAnalytics) {
            btnRefreshUserDataAnalytics.onclick = function () {
                loadUserDataAnalytics();
            };
        }
        var btnRefreshUdGender = document.getElementById('btnRefreshUdGender');
        if (btnRefreshUdGender) {
            btnRefreshUdGender.onclick = function () {
                loadUdGenderCharts();
            };
        }
        var udGenderDays = document.getElementById('udGenderDays');
        if (udGenderDays) {
            udGenderDays.addEventListener('change', function () {
                loadUdGenderCharts();
            });
        }
        var udGenderSection = document.getElementById('udGenderSection');
        if (udGenderSection) {
            udGenderSection.addEventListener('toggle', function () {
                if (udGenderSection.open) {
                    loadUdGenderCharts();
                }
            });
        }
        var udFemaleAgeSection = document.getElementById('udFemaleAgeSection');
        if (udFemaleAgeSection) {
            udFemaleAgeSection.addEventListener('toggle', function () {
                if (udFemaleAgeSection.open) {
                    loadUdFemaleAge();
                }
            });
        }
        var userDataPrev = document.getElementById('userDataPrev');
        if (userDataPrev) {
            userDataPrev.onclick = function () {
                if (userDataPage > 1) loadUserDataList(userDataPage - 1);
            };
        }
        var userDataNext = document.getElementById('userDataNext');
        if (userDataNext) {
            userDataNext.onclick = function () {
                loadUserDataList(userDataPage + 1);
            };
        }
        var btnRefreshNoTaxBehavior = document.getElementById('btnRefreshNoTaxBehavior');
        if (btnRefreshNoTaxBehavior) {
            btnRefreshNoTaxBehavior.onclick = function () {
                loadNoTaxBehaviorList(noTaxBehaviorPage);
            };
        }
        var btnExportNoTaxBehavior = document.getElementById('btnExportNoTaxBehavior');
        if (btnExportNoTaxBehavior) {
            btnExportNoTaxBehavior.onclick = function () {
                exportNoTaxBehaviorCsv();
            };
        }
        var udNoTaxPrev = document.getElementById('udNoTaxPrev');
        if (udNoTaxPrev) {
            udNoTaxPrev.onclick = function () {
                if (noTaxBehaviorPage > 1) loadNoTaxBehaviorList(noTaxBehaviorPage - 1);
            };
        }
        var udNoTaxNext = document.getElementById('udNoTaxNext');
        if (udNoTaxNext) {
            udNoTaxNext.onclick = function () {
                loadNoTaxBehaviorList(noTaxBehaviorPage + 1);
            };
        }
        var btnRefreshAuaOverview = document.getElementById('btnRefreshAuaOverview');
        if (btnRefreshAuaOverview) {
            btnRefreshAuaOverview.onclick = function () {
                loadActivatedUserAnalysisOverview();
                loadActivatedUserAnalysisUsers(auaUsersPage);
            };
        }
        var btnSearchAuaUsers = document.getElementById('btnSearchAuaUsers');
        if (btnSearchAuaUsers) {
            btnSearchAuaUsers.onclick = function () {
                loadActivatedUserAnalysisUsers(1);
            };
        }
        var btnResetAuaUsers = document.getElementById('btnResetAuaUsers');
        if (btnResetAuaUsers) {
            btnResetAuaUsers.onclick = function () {
                var u = document.getElementById('auaFilterUsername');
                var t = document.getElementById('auaFilterTax');
                var a = document.getElementById('auaFilterActivity');
                var sm = document.getElementById('auaFilterSalaryMin');
                var sx = document.getElementById('auaFilterSalaryMax');
                if (u) u.value = '';
                if (t) t.value = '';
                if (a) a.value = '';
                if (sm) sm.value = '';
                if (sx) sx.value = '';
                loadActivatedUserAnalysisUsers(1);
            };
        }
        var auaUsersPrev = document.getElementById('auaUsersPrev');
        if (auaUsersPrev) {
            auaUsersPrev.onclick = function () {
                if (auaUsersPage > 1) loadActivatedUserAnalysisUsers(auaUsersPage - 1);
            };
        }
        var auaUsersNext = document.getElementById('auaUsersNext');
        if (auaUsersNext) {
            auaUsersNext.onclick = function () {
                loadActivatedUserAnalysisUsers(auaUsersPage + 1);
            };
        }
        document.getElementById('btnResetUsers').onclick = function() {
            document.getElementById('filterUsername').value = '';
            document.getElementById('filterRealName').value = '';
            document.getElementById('filterActive').value = '';
            document.getElementById('filterBanned').value = '';
            var exactEl = document.getElementById('filterExact');
            if (exactEl) exactEl.checked = false;
            var riskEl = document.getElementById('filterRisk');
            if (riskEl) riskEl.value = '';
            var salaryMinEl = document.getElementById('filterSalaryMin');
            var salaryMaxEl = document.getElementById('filterSalaryMax');
            if (salaryMinEl) salaryMinEl.value = '';
            if (salaryMaxEl) salaryMaxEl.value = '';
            var taxModReset = document.getElementById('filterTaxModifiedToday');
            if (taxModReset) taxModReset.value = '';
            var loginInactiveReset = document.getElementById('filterLoginInactive');
            if (loginInactiveReset) loginInactiveReset.value = '';
            loadUsers(1);
        };

        function purgeBotsPayload(dryRun) {
            return {
                dry_run: !!dryRun,
                mode: 'delete',
                start_bj: '2026-05-22 00:00:00',
                end_bj: '2026-05-22 01:00:00',
                only_eight_char: true,
                only_inactive: true
            };
        }

        function runPurgeBotsPreview() {
            var stat = document.getElementById('purgeBotsStat');
            if (stat) {
                stat.style.display = 'block';
                stat.textContent = '正在统计待清理刷号账号…';
            }
            adminFetch('api/admin/users/purge-bots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(purgeBotsPayload(true))
            })
                .then(function (r) { return r.json(); })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        if (stat) stat.textContent = '预览失败：' + (j.msg || '');
                        return;
                    }
                    var d = j.data;
                    if (stat) {
                        stat.textContent =
                            '预览：' +
                            (d.window ? d.window.start_bj + ' ~ ' + d.window.end_bj : '') +
                            ' 内匹配 ' +
                            (d.matched != null ? d.matched : 0) +
                            ' 个账号（8位随机名、未激活）。点击「执行删除刷号」将永久删除。';
                    }
                })
                .catch(function () {
                    if (stat) stat.textContent = '预览失败（网络错误）';
                });
        }

        function runPurgeBotsExecute() {
            var stat = document.getElementById('purgeBotsStat');
            if (
                !confirm(
                    '确定永久删除 2026-05-22 00:00–01:00（北京）内、8位随机字母数字账号名且未激活的刷号账号？\n此操作不可恢复，建议先点「预览清理刷号」。'
                )
            ) {
                return;
            }
            if (stat) {
                stat.style.display = 'block';
                stat.textContent = '正在批量删除，请稍候…';
            }
            adminFetch('api/admin/users/purge-bots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(purgeBotsPayload(false))
            })
                .then(function (r) { return r.json(); })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        alert(j.msg || '删除失败');
                        if (stat) stat.textContent = '删除失败：' + (j.msg || '');
                        return;
                    }
                    var d = j.data;
                    if (stat) {
                        stat.textContent =
                            '已删除 ' + (d.deleted != null ? d.deleted : 0) + ' 个账号（匹配 ' + (d.matched != null ? d.matched : 0) + '）。';
                    }
                    alert('清理完成：已删除 ' + (d.deleted != null ? d.deleted : 0) + ' 个账号');
                    loadUsers(1);
                })
                .catch(function () {
                    alert('网络错误');
                    if (stat) stat.textContent = '删除失败（网络错误）';
                });
        }

        var btnPurgeBotsPreview = document.getElementById('btnPurgeBotsPreview');
        if (btnPurgeBotsPreview) btnPurgeBotsPreview.onclick = runPurgeBotsPreview;
        var btnPurgeBotsRun = document.getElementById('btnPurgeBotsRun');
        if (btnPurgeBotsRun) btnPurgeBotsRun.onclick = runPurgeBotsExecute;

        document.getElementById('codePrev').onclick = function() { if (codePage > 1) loadCodes(codePage - 1); };
        document.getElementById('codeNext').onclick = function() { loadCodes(codePage + 1); };
        var xianyuPrev = document.getElementById('xianyuCodePrev');
        var xianyuNext = document.getElementById('xianyuCodeNext');
        if (xianyuPrev) {
            xianyuPrev.onclick = function() {
                if (xianyuCodePage > 1) {
                    loadXianyuCodes(xianyuCodePage - 1);
                }
            };
        }
        if (xianyuNext) {
            xianyuNext.onclick = function() {
                loadXianyuCodes(xianyuCodePage + 1);
            };
        }

        function bindCodeCopyDelegation(tbodyId) {
            var el = document.getElementById(tbodyId);
            if (!el || el.getAttribute('data-copy-bound') === '1') {
                return;
            }
            el.setAttribute('data-copy-bound', '1');
            el.addEventListener('click', function (e) {
                var btn = e.target.closest('.btn-copy-code');
                if (!btn) {
                    return;
                }
                var code = btn.getAttribute('data-code');
                if (code) {
                    copyCode(code);
                }
            });
        }
        bindCodeCopyDelegation('codeTbody');
        bindCodeCopyDelegation('xianyuCodeTbody');

        document.getElementById('btnIssue').addEventListener('click', function () {
            var btn = document.getElementById('btnIssue');
            btn.disabled = true;
            adminFetch('api/admin/issue-code', {
                method: 'POST',
                body: JSON.stringify({})
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.code === 200 && data.data && data.data.code) {
                        var el = document.getElementById('issueOut');
                        el.textContent = '激活码：' + data.data.code + '（单次有效、永不过期，仅可激活一个账号）';
                        el.classList.add('show');
                        loadCodes(1);
                    } else {
                        alert(data.msg || '生成失败');
                    }
                })
                .catch(function () { alert('网络错误'); })
                .finally(function () { btn.disabled = false; });
        });

        var btnIssueBatch = document.getElementById('btnIssueBatch');
        if (btnIssueBatch) {
            btnIssueBatch.addEventListener('click', function () {
                var countEl = document.getElementById('batchIssueCount');
                var count = countEl ? parseInt(countEl.value, 10) : 0;
                if (!count || count < 1) {
                    alert('请输入大于 0 的批量数量');
                    if (countEl) countEl.focus();
                    return;
                }
                if (
                    !confirm(
                        '将一次性生成 ' +
                            count +
                            ' 个激活码（备注：闲鱼批量），写入数据库并下载 TXT 文件。是否继续？'
                    )
                ) {
                    return;
                }
                btnIssueBatch.disabled = true;
                adminFetch('api/admin/issue-code-batch', {
                    method: 'POST',
                    body: JSON.stringify({ count: count, note: '闲鱼批量' })
                })
                    .then(function (r) {
                        return r.json();
                    })
                    .then(function (data) {
                        if (data.code === 200 && data.data && data.data.codes && data.data.codes.length) {
                            var el = document.getElementById('issueOut');
                            if (el) {
                                el.textContent =
                                    '已批量生成 ' +
                                    data.data.count +
                                    ' 个激活码（闲鱼批量），正在下载 TXT…';
                                el.classList.add('show');
                            }
                            downloadActivationCodesTxt(data.data.codes, {
                                generated_at: formatLocalDateTimeForExport(
                                    data.data.generated_at
                                        ? new Date(data.data.generated_at)
                                        : new Date()
                                ),
                                owner_admin:
                                    currentAdminProfile && currentAdminProfile.username
                                        ? String(currentAdminProfile.username)
                                        : '—'
                            });
                            loadCodes(1);
                            loadXianyuCodes(1);
                            alert('已生成 ' + data.data.count + ' 个激活码，TXT 已下载');
                        } else {
                            alert(data.msg || '批量生成失败');
                        }
                    })
                    .catch(function () {
                        alert('网络错误');
                    })
                    .finally(function () {
                        btnIssueBatch.disabled = false;
                    });
            });
        }

        document.getElementById('btnRefreshCodes').addEventListener('click', function() {
            loadCodes(1);
        });
        var btnRefreshXianyuCodes = document.getElementById('btnRefreshXianyuCodes');
        if (btnRefreshXianyuCodes) {
            btnRefreshXianyuCodes.addEventListener('click', function () {
                loadXianyuCodes(1);
            });
        }
        document.getElementById('btnSearchCodes').addEventListener('click', function() { loadCodes(1); });
        var btnSearchXianyuCodes = document.getElementById('btnSearchXianyuCodes');
        if (btnSearchXianyuCodes) {
            btnSearchXianyuCodes.addEventListener('click', function () {
                loadXianyuCodes(1);
            });
        }
        document.getElementById('btnResetCodesFilter').addEventListener('click', function () {
            var input = document.getElementById('codeOwnerAdminFilter');
            if (input) input.value = '';
            var usedInput = document.getElementById('codeUsedByFilter');
            if (usedInput) usedInput.value = '';
            var usedExactEl = document.getElementById('codeUsedByExact');
            if (usedExactEl) usedExactEl.checked = false;
            var usageFilterReset = document.getElementById('codeUsageFilter');
            if (usageFilterReset) usageFilterReset.value = '';
            var codeFilterReset = document.getElementById('codeCodeFilter');
            if (codeFilterReset) codeFilterReset.value = '';
            var codeExactReset = document.getElementById('codeCodeExact');
            if (codeExactReset) codeExactReset.checked = false;
            loadCodes(1);
        });
        var btnResetXianyuCodesFilter = document.getElementById('btnResetXianyuCodesFilter');
        if (btnResetXianyuCodesFilter) {
            btnResetXianyuCodesFilter.addEventListener('click', function () {
                var xyOwner = document.getElementById('xianyuCodeOwnerAdminFilter');
                if (xyOwner) xyOwner.value = '';
                var xyUsed = document.getElementById('xianyuCodeUsedByFilter');
                if (xyUsed) xyUsed.value = '';
                var xyUsedExact = document.getElementById('xianyuCodeUsedByExact');
                if (xyUsedExact) xyUsedExact.checked = false;
                var xyUsage = document.getElementById('xianyuCodeUsageFilter');
                if (xyUsage) xyUsage.value = '';
                var xyCode = document.getElementById('xianyuCodeCodeFilter');
                if (xyCode) xyCode.value = '';
                var xyCodeExact = document.getElementById('xianyuCodeCodeExact');
                if (xyCodeExact) xyCodeExact.checked = false;
                loadXianyuCodes(1);
            });
        }

        document.getElementById('btnRefreshAdminAccounts').addEventListener('click', function () {
            loadAdminAccounts();
        });
        document.getElementById('btnCreateAdminAccount').addEventListener('click', function () {
            var username = document.getElementById('adminAccUsername').value.trim();
            var fullName = document.getElementById('adminAccFullName').value.trim();
            var password = document.getElementById('adminAccPassword').value;
            var menus = selectedMenusFromRoot(document.getElementById('adminAccountMenuSelector'));
            if (!username || !password || !fullName) {
                alert('请填写账号、姓名和密码');
                return;
            }
            adminFetch('api/admin/accounts/create', {
                method: 'POST',
                body: JSON.stringify({ username: username, full_name: fullName, password: password, menus: menus })
            })
                .then(function (r) { return r.json(); })
                .then(function (j) {
                    if (j.code === 200) {
                        document.getElementById('adminAccUsername').value = '';
                        document.getElementById('adminAccFullName').value = '';
                        document.getElementById('adminAccPassword').value = '';
                        loadAdminAccounts();
                        alert('新增成功');
                    } else {
                        alert(j.msg || '新增失败');
                    }
                })
                .catch(function () {
                    alert('网络错误');
                });
        });

        document.getElementById('adminAccountTbody').addEventListener('click', function (e) {
            var detailBtn = e.target.closest('.btn-admin-account-detail');
            if (detailBtn) {
                var unameD = detailBtn.getAttribute('data-username');
                var keyD = keyForAdminAccount(unameD);
                var rowD = document.getElementById('admin_acc_detail_row_' + keyD);
                var boxD = document.getElementById('admin_acc_detail_box_' + keyD);
                if (!rowD || !boxD) return;
                var openingD = rowD.style.display === 'none';
                if (!openingD) {
                    rowD.style.display = 'none';
                    detailBtn.textContent = '详情';
                    return;
                }
                rowD.style.display = '';
                detailBtn.textContent = '收起';
                if (boxD.getAttribute('data-loaded') === '1') return;
                loadAdminAccountActivatedUsers(unameD, 1, boxD);
                return;
            }
            var actPrev = e.target.closest('.admin-acc-act-prev');
            if (actPrev && !actPrev.disabled) {
                var ownerP = actPrev.getAttribute('data-owner');
                var boxP = actPrev.closest('[id^="admin_acc_detail_box_"]');
                if (!boxP || !ownerP) return;
                var pageP = (parseInt(boxP.getAttribute('data-page'), 10) || 1) - 1;
                loadAdminAccountActivatedUsers(ownerP, pageP, boxP);
                return;
            }
            var actNext = e.target.closest('.admin-acc-act-next');
            if (actNext && !actNext.disabled) {
                var ownerN = actNext.getAttribute('data-owner');
                var boxN = actNext.closest('[id^="admin_acc_detail_box_"]');
                if (!boxN || !ownerN) return;
                var pageN = (parseInt(boxN.getAttribute('data-page'), 10) || 1) + 1;
                loadAdminAccountActivatedUsers(ownerN, pageN, boxN);
                return;
            }
            var editBtn = e.target.closest('.btn-admin-account-edit');
            if (editBtn) {
                var uname = editBtn.getAttribute('data-username');
                var keyE = keyForAdminAccount(uname);
                var editRow = document.getElementById('admin_acc_edit_row_' + keyE);
                if (!editRow) return;
                var openingE = editRow.style.display === 'none';
                if (!openingE) {
                    editRow.style.display = 'none';
                    editBtn.textContent = '改菜单';
                    return;
                }
                editRow.style.display = '';
                editBtn.textContent = '收起';
                return;
            }
            var saveBtn = e.target.closest('.btn-admin-account-save');
            if (saveBtn) {
                var uname = saveBtn.getAttribute('data-username');
                var row = document.querySelector('.admin-account-menu-row[data-username="' + uname + '"]');
                var pwdInput = document.querySelector('.admin-account-newpwd[data-username="' + uname + '"]');
                var fullNameInput = document.querySelector('.admin-account-fullname[data-username="' + uname + '"]');
                var menus = selectedMenusFromRoot(row);
                var newPassword = pwdInput ? String(pwdInput.value || '') : '';
                var fullName = fullNameInput ? String(fullNameInput.value || '').trim() : '';
                adminFetch('api/admin/accounts/update', {
                    method: 'POST',
                    body: JSON.stringify({
                        username: uname,
                        full_name: fullName,
                        menus: menus,
                        password: newPassword
                    })
                })
                    .then(function (r) { return r.json(); })
                    .then(function (j) {
                        if (j.code === 200) {
                            if (pwdInput) pwdInput.value = '';
                            loadAdminAccounts();
                            alert('已更新');
                        } else {
                            alert(j.msg || '更新失败');
                        }
                    })
                    .catch(function () {
                        alert('网络错误');
                    });
                return;
            }
            var delBtn = e.target.closest('.btn-admin-account-del');
            if (delBtn) {
                var uname2 = delBtn.getAttribute('data-username');
                if (!confirm('确认删除后台账号「' + uname2 + '」吗？')) return;
                adminFetch('api/admin/accounts/delete', {
                    method: 'POST',
                    body: JSON.stringify({ username: uname2 })
                })
                    .then(function (r) { return r.json(); })
                    .then(function (j) {
                        if (j.code === 200) {
                            loadAdminAccounts();
                            alert('已删除');
                        } else {
                            alert(j.msg || '删除失败');
                        }
                    })
                    .catch(function () {
                        alert('网络错误');
                    });
            }
        });

        function updateWechatPayQrPreview(displayUrl) {
            var wrap = document.getElementById('wechatPayQrPreviewWrap');
            var img = document.getElementById('wechatPayQrPreview');
            if (!wrap || !img) return;
            var u = displayUrl != null ? String(displayUrl).trim() : '';
            if (!u) {
                wrap.hidden = true;
                img.removeAttribute('src');
                return;
            }
            img.src = u;
            wrap.hidden = false;
        }

        function loadAdminSettings() {
            adminFetch('api/admin/settings')
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.code === 200 && data.data) {
                        var qrEl = document.getElementById('wechatPayQrcodeUrl');
                        if (qrEl) {
                            qrEl.value =
                                data.data.wechat_pay_qrcode_url != null
                                    ? String(data.data.wechat_pay_qrcode_url)
                                    : '';
                        }
                        updateWechatPayQrPreview(
                            data.data.wechat_pay_qrcode_display_url ||
                                (qrEl && qrEl.value ? '/' + String(qrEl.value).replace(/^\//, '') : '')
                        );
                        var qqEl = document.getElementById('qqAddUrl');
                        if (qqEl && data.data.qq_add_url != null) {
                            qqEl.value = String(data.data.qq_add_url);
                        }
                        var qqGroupEl = document.getElementById('qqGroupUrl');
                        if (qqGroupEl && data.data.qq_group_url != null) {
                            qqGroupEl.value = String(data.data.qq_group_url);
                        }
                        var ab = data.data.conversion_ab;
                        if (ab) {
                            var enEl = document.getElementById('convAbEnabled');
                            if (enEl) enEl.checked = ab.enabled !== false;
                            var map = [
                                ['convAbTitleA', 'activate_title_a'],
                                ['convAbSubtitleA', 'activate_subtitle_a'],
                                ['convAbTitleB', 'activate_title_b'],
                                ['convAbSubtitleB', 'activate_subtitle_b']
                            ];
                            map.forEach(function (pair) {
                                var el = document.getElementById(pair[0]);
                                if (el && ab[pair[1]] != null) el.value = String(ab[pair[1]]);
                            });
                            var bp = document.getElementById('convAbBatchProminent');
                            if (bp) bp.checked = ab.batch_example_prominent === true;
                        }
                    }
                    if (data.code === 200 && data.data) {
                        var apkEl = document.getElementById('androidApkDownloadUrl');
                        var agentApkEl = document.getElementById('agentAndroidApkDownloadUrl');
                        var iosEl = document.getElementById('iosMobileconfigDownloadUrl');
                        if (apkEl && data.data.android_apk_download_url != null) {
                            apkEl.value = String(data.data.android_apk_download_url);
                        }
                        if (agentApkEl && data.data.agent_android_apk_download_url != null) {
                            agentApkEl.value = String(data.data.agent_android_apk_download_url);
                        }
                        if (iosEl && data.data.ios_mobileconfig_download_url != null) {
                            iosEl.value = String(data.data.ios_mobileconfig_download_url);
                        }
                        var xyEl = document.getElementById('xianyuPurchaseUrl');
                        if (xyEl && data.data.xianyu_purchase_url != null) {
                            xyEl.value = String(data.data.xianyu_purchase_url);
                        }
                        var xyHideEl = document.getElementById('xianyuHideSalesChannels');
                        if (xyHideEl && data.data.xianyu_hide_sales_channels != null) {
                            xyHideEl.value = String(data.data.xianyu_hide_sales_channels);
                        }
                    }
                    if (data.code === 200 && data.data && data.data.mine_ui) {
                        var m = data.data.mine_ui;
                        document.getElementById('mineTheme').value = m.theme === 'yellow' ? 'yellow' : 'blue';
                        document.getElementById('mineUseDefaultImages').checked = !!m.use_default_images;
                        MINE_UI_FIELD_KEYS.forEach(function (k) {
                            var el = document.getElementById('img_' + k);
                            if (el) {
                                el.value = m[k] != null ? String(m[k]) : '';
                            }
                        });
                        MINE_INSTALL_VIDEO_KEYS.forEach(function (k) {
                            var el = document.getElementById('img_' + k);
                            if (el) {
                                el.value = m[k] != null ? String(m[k]) : '';
                            }
                        });
                        MINE_INSTALL_SHOWCASE_KEYS.forEach(function (k) {
                            var el = document.getElementById('img_' + k);
                            if (el) {
                                el.value = m[k] != null ? String(m[k]) : '';
                            }
                        });
                        syncMineUiDefaultToggle();
                    }
                })
                .catch(function () {});
        }

        document.getElementById('btnSaveQqAddUrl').addEventListener('click', function () {
            var btn = document.getElementById('btnSaveQqAddUrl');
            var url = document.getElementById('qqAddUrl').value.trim();
            btn.disabled = true;
            adminFetch('api/admin/settings', {
                method: 'POST',
                body: JSON.stringify({ qq_add_url: url })
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (data) {
                    if (data.code === 200) {
                        alert('QQ 链接已保存');
                        loadAdminSettings();
                    } else {
                        alert(data.msg || '保存失败');
                    }
                })
                .catch(function () {
                    alert('网络错误');
                })
                .finally(function () {
                    btn.disabled = false;
                });
        });
        var btnSaveQqGroupUrl = document.getElementById('btnSaveQqGroupUrl');
        if (btnSaveQqGroupUrl) {
            btnSaveQqGroupUrl.addEventListener('click', function () {
                var btn = btnSaveQqGroupUrl;
                var url = document.getElementById('qqGroupUrl').value.trim();
                btn.disabled = true;
                adminFetch('api/admin/settings', {
                    method: 'POST',
                    body: JSON.stringify({ qq_group_url: url })
                })
                    .then(function (r) {
                        return r.json();
                    })
                    .then(function (data) {
                        if (data.code === 200) {
                            alert('QQ 加群链接已保存');
                            loadAdminSettings();
                        } else {
                            alert(data.msg || '保存失败');
                        }
                    })
                    .catch(function () {
                        alert('网络错误');
                    })
                    .finally(function () {
                        btn.disabled = false;
                    });
            });
        }
        var btnSaveConversionAb = document.getElementById('btnSaveConversionAb');
        if (btnSaveConversionAb) {
            btnSaveConversionAb.addEventListener('click', function () {
                var btn = btnSaveConversionAb;
                btn.disabled = true;
                adminFetch('api/admin/settings', {
                    method: 'POST',
                    body: JSON.stringify({
                        conversion_ab: {
                            enabled: !!document.getElementById('convAbEnabled').checked,
                            activate_title_a: document.getElementById('convAbTitleA').value,
                            activate_subtitle_a: document.getElementById('convAbSubtitleA').value,
                            activate_title_b: document.getElementById('convAbTitleB').value,
                            activate_subtitle_b: document.getElementById('convAbSubtitleB').value,
                            batch_example_prominent: !!document.getElementById('convAbBatchProminent').checked
                        }
                    })
                })
                    .then(function (r) {
                        return r.json();
                    })
                    .then(function (data) {
                        if (data.code === 200) {
                            alert('转化配置已保存');
                            loadAdminSettings();
                        } else {
                            alert(data.msg || '保存失败');
                        }
                    })
                    .catch(function () {
                        alert('网络错误');
                    })
                    .finally(function () {
                        btn.disabled = false;
                    });
            });
        }

        document.getElementById('btnSaveWechatPayQr').addEventListener('click', function () {
            var btn = document.getElementById('btnSaveWechatPayQr');
            var path = document.getElementById('wechatPayQrcodeUrl').value.trim();
            btn.disabled = true;
            adminFetch('api/admin/settings', {
                method: 'POST',
                body: JSON.stringify({ wechat_pay_qrcode_url: path })
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (data) {
                    if (data.code === 200) {
                        alert('收款码已保存');
                        loadAdminSettings();
                    } else {
                        alert(data.msg || '保存失败');
                    }
                })
                .catch(function () {
                    alert('网络错误');
                })
                .finally(function () {
                    btn.disabled = false;
                });
        });

        document.getElementById('btnClearWechatPayQr').addEventListener('click', function () {
            document.getElementById('wechatPayQrcodeUrl').value = '';
            updateWechatPayQrPreview('');
        });

        document.querySelector('.wechat-pay-qr-pick').addEventListener('click', function () {
            var fi = document.querySelector('.wechat-pay-qr-file');
            if (fi) fi.click();
        });
        document.querySelector('.wechat-pay-qr-file').addEventListener('change', function () {
            var fileInput = document.querySelector('.wechat-pay-qr-file');
            var f = fileInput.files && fileInput.files[0];
            if (!f) return;
            fileInput.disabled = true;
            adminUploadAsset(f)
                .then(function (data) {
                    if (data.code === 200 && data.data && data.data.path) {
                        document.getElementById('wechatPayQrcodeUrl').value = data.data.path;
                        updateWechatPayQrPreview('/' + String(data.data.path).replace(/^\//, ''));
                        alert('已上传，请点击「保存收款码」生效');
                    } else {
                        alert(data.msg || '上传失败');
                    }
                })
                .catch(function () {
                    alert('网络错误');
                })
                .finally(function () {
                    fileInput.disabled = false;
                    fileInput.value = '';
                });
        });

        document.getElementById('btnSaveInstallPackages').addEventListener('click', function () {
            var btn = document.getElementById('btnSaveInstallPackages');
            btn.disabled = true;
            adminFetch('api/admin/settings', {
                method: 'POST',
                body: JSON.stringify({
                    android_apk_download_url: document.getElementById('androidApkDownloadUrl').value.trim(),
                    agent_android_apk_download_url: document.getElementById('agentAndroidApkDownloadUrl').value.trim(),
                    ios_mobileconfig_download_url: document.getElementById('iosMobileconfigDownloadUrl').value.trim(),
                    xianyu_purchase_url: document.getElementById('xianyuPurchaseUrl').value.trim(),
                    xianyu_hide_sales_channels: document.getElementById('xianyuHideSalesChannels').value.trim(),
                    mine_ui: (function () {
                        var ui = {
                            install_ios_video: document.getElementById('img_install_ios_video').value.trim(),
                            install_usage_video: document.getElementById('img_install_usage_video').value.trim()
                        };
                        MINE_INSTALL_SHOWCASE_KEYS.forEach(function (k) {
                            var el = document.getElementById('img_' + k);
                            if (el) {
                                ui[k] = el.value.trim();
                            }
                        });
                        return ui;
                    })()
                })
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.code === 200) {
                        alert('引导安装配置已保存');
                        loadAdminSettings();
                    } else {
                        alert(data.msg || '保存失败');
                    }
                })
                .catch(function () { alert('网络错误'); })
                .finally(function () { btn.disabled = false; });
        });

        var MINE_UI_FIELD_KEYS = [
            'header_male', 'header_female', 'icon_family', 'icon_employer', 'icon_bank',
            'nav_sy_1', 'nav_sy_2', 'nav_db_1', 'nav_db_2', 'nav_bc_1', 'nav_bc_2',
            'nav_xx_1', 'nav_xx_2', 'nav_w_1', 'nav_w_2',
            'shouye_banner', 'shouye_zdfwdb', 'shouye_lb', 'daiban_header', 'bancha_header', 'message_header',
            'piaojia_goumai', 'piaojia_xiaoshou'
        ];

        var MINE_INSTALL_VIDEO_KEYS = ['install_ios_video', 'install_usage_video'];
        var MINE_INSTALL_SHOWCASE_KEYS = [
            'install_showcase_gif',
            'install_showcase_img_1',
            'install_showcase_img_2',
            'install_showcase_img_3'
        ];

        function syncMineUiDefaultToggle() {
            var on = document.getElementById('mineUseDefaultImages').checked;
            document.querySelectorAll('#page-appearance .mine-ui-row input[type="text"]').forEach(function (el) {
                el.disabled = on;
            });
            document.querySelectorAll('#page-appearance .mine-ui-pick').forEach(function (btn) {
                btn.disabled = on;
            });
        }

        document.getElementById('mineUseDefaultImages').addEventListener('change', syncMineUiDefaultToggle);

        function adminUploadAsset(file) {
            return window.adminUpload('api/admin/upload-asset', file);
        }

        function bindInstallPackageUploads() {
            document.querySelectorAll('.install-pkg-file').forEach(function (fileInput) {
                fileInput.addEventListener('change', function () {
                    var f = fileInput.files && fileInput.files[0];
                    if (!f) {
                        return;
                    }
                    var targetId = fileInput.getAttribute('data-target');
                    var targetEl = document.getElementById(targetId);
                    fileInput.disabled = true;
                    adminUploadAsset(f)
                        .then(function (data) {
                            if (data.code === 200 && data.data && data.data.path) {
                                if (targetEl) {
                                    targetEl.value = data.data.path;
                                }
                                alert('已上传，请点击下方「保存引导安装配置」生效');
                            } else {
                                alert(data.msg || '上传失败');
                            }
                        })
                        .catch(function () {
                            alert('网络错误');
                        })
                        .finally(function () {
                            fileInput.disabled = false;
                            fileInput.value = '';
                        });
                });
            });
            document.querySelectorAll('.install-pkg-pick').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var row = btn.closest('.mine-ui-controls');
                    if (!row) {
                        return;
                    }
                    var fi = row.querySelector('.install-pkg-file');
                    if (fi) {
                        fi.click();
                    }
                });
            });
        }

        function bindMineUiUploads() {
            document.querySelectorAll('.mine-ui-file').forEach(function (fileInput) {
                fileInput.addEventListener('change', function () {
                    var f = fileInput.files && fileInput.files[0];
                    if (!f) {
                        return;
                    }
                    var targetId = fileInput.getAttribute('data-target');
                    var targetEl = document.getElementById(targetId);
                    fileInput.disabled = true;
                    adminUploadAsset(f)
                        .then(function (data) {
                            if (data.code === 200 && data.data && data.data.path) {
                                if (targetEl) {
                                    targetEl.value = data.data.path;
                                }
                            } else {
                                alert(data.msg || '上传失败');
                            }
                        })
                        .catch(function () {
                            alert('网络错误');
                        })
                        .finally(function () {
                            fileInput.disabled = false;
                            fileInput.value = '';
                        });
                });
            });
            document.querySelectorAll('.mine-ui-pick').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var row = btn.closest('.mine-ui-controls');
                    if (!row) {
                        return;
                    }
                    var fi = row.querySelector('.mine-ui-file');
                    if (fi) {
                        fi.click();
                    }
                });
            });
        }

        document.getElementById('btnSaveMineUi').addEventListener('click', function () {
            var btn = document.getElementById('btnSaveMineUi');
            btn.disabled = true;
            var mineUi = {
                theme: document.getElementById('mineTheme').value === 'yellow' ? 'yellow' : 'blue',
                use_default_images: document.getElementById('mineUseDefaultImages').checked
            };
            MINE_UI_FIELD_KEYS.forEach(function (k) {
                var el = document.getElementById('img_' + k);
                mineUi[k] = el ? el.value.trim() : '';
            });
            adminFetch('api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mine_ui: mineUi })
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.code === 200) {
                        alert('外观配置已保存');
                        loadAdminSettings();
                    } else {
                        alert(data.msg || '保存失败');
                    }
                })
                .catch(function () { alert('网络错误'); })
                .finally(function () { btn.disabled = false; });
        });

        bindMineUiUploads();
        bindInstallPackageUploads();
        bindAgentPromoLinksUi();
        loadAdminSettings();

        document.getElementById('btnRefreshAnalytics').addEventListener('click', function () {
            loadAnalyticsActivityPage();
        });
        var btnRefreshServerMonitor = document.getElementById('btnRefreshServerMonitor');
        if (btnRefreshServerMonitor) {
            btnRefreshServerMonitor.addEventListener('click', function () {
                loadServerMonitor();
            });
        }
        var btnMonitorTestEmail = document.getElementById('btnMonitorTestEmail');
        if (btnMonitorTestEmail) {
            btnMonitorTestEmail.addEventListener('click', function () {
                if (!confirm('向告警邮箱发送一封测试邮件？')) return;
                var btn = this;
                btn.disabled = true;
                adminFetch('api/admin/monitor/test-email', { method: 'POST' })
                    .then(function (r) {
                        return r.json();
                    })
                    .then(function (j) {
                        alert(j.code === 200 ? j.msg || '已发送' : j.msg || '发送失败');
                    })
                    .catch(function () {
                        alert('网络错误');
                    })
                    .finally(function () {
                        btn.disabled = false;
                    });
            });
        }
        document.getElementById('btnRefreshConversion').addEventListener('click', function () {
            loadAnalyticsDailyConversion();
        });
        document.getElementById('analyticsConversionDays').addEventListener('change', function () {
            loadAnalyticsDailyConversion();
        });
        var btnRefreshRegistrationFunnel = document.getElementById('btnRefreshRegistrationFunnel');
        if (btnRefreshRegistrationFunnel) {
            btnRefreshRegistrationFunnel.addEventListener('click', function () {
                loadRegistrationFunnel();
            });
        }
        var analyticsFunnelDays = document.getElementById('analyticsFunnelDays');
        if (analyticsFunnelDays) {
            analyticsFunnelDays.addEventListener('change', function () {
                loadRegistrationFunnel();
            });
        }
        var btnRefreshChannelFunnel = document.getElementById('btnRefreshChannelFunnel');
        if (btnRefreshChannelFunnel) {
            btnRefreshChannelFunnel.onclick = function () {
                loadChannelRegistrationFunnel();
            };
        }
        var analyticsChannelFunnelDays = document.getElementById('analyticsChannelFunnelDays');
        if (analyticsChannelFunnelDays) {
            analyticsChannelFunnelDays.addEventListener('change', function () {
                loadChannelRegistrationFunnel();
            });
        }
        var btnRefreshActivationChannelFunnel = document.getElementById('btnRefreshActivationChannelFunnel');
        if (btnRefreshActivationChannelFunnel) {
            btnRefreshActivationChannelFunnel.onclick = function () {
                loadActivationChannelFunnel();
            };
        }
        var analyticsActivationChannelFunnelDays = document.getElementById('analyticsActivationChannelFunnelDays');
        if (analyticsActivationChannelFunnelDays) {
            analyticsActivationChannelFunnelDays.addEventListener('change', function () {
                loadActivationChannelFunnel();
            });
        }
        var btnRefreshAnalyticsTracking = document.getElementById('btnRefreshAnalyticsTracking');
        if (btnRefreshAnalyticsTracking) {
            btnRefreshAnalyticsTracking.addEventListener('click', function () {
                loadAnalyticsTrackingPage();
            });
        }
        var analyticsTrackingDays = document.getElementById('analyticsTrackingDays');
        if (analyticsTrackingDays) {
            analyticsTrackingDays.addEventListener('change', function () {
                if (_adminAnalyticsTrackingSeen) loadAnalyticsTrackingPage();
            });
        }
        var btnRefreshDeviceStats = document.getElementById('btnRefreshDeviceStats');
        if (btnRefreshDeviceStats) {
            btnRefreshDeviceStats.addEventListener('click', function () {
                loadAnalyticsDeviceStats();
            });
        }
        var btnRefreshInstallTrack = document.getElementById('btnRefreshInstallTrack');
        if (btnRefreshInstallTrack) {
            btnRefreshInstallTrack.onclick = function () {
                loadInstallTrackStats();
            };
        }
        var analyticsInstallTrackDays = document.getElementById('analyticsInstallTrackDays');
        if (analyticsInstallTrackDays) {
            analyticsInstallTrackDays.addEventListener('change', function () {
                loadInstallTrackStats();
            });
        }
        var btnRefreshInstallGuideStats = document.getElementById('btnRefreshInstallGuideStats');
        if (btnRefreshInstallGuideStats) {
            btnRefreshInstallGuideStats.onclick = function () {
                loadInstallGuideStats();
            };
        }
        var installGuideStatsDays = document.getElementById('installGuideStatsDays');
        if (installGuideStatsDays) {
            installGuideStatsDays.addEventListener('change', function () {
                loadInstallGuideStats();
            });
        }
        var btnRefreshConversionKpis = document.getElementById('btnRefreshConversionKpis');
        if (btnRefreshConversionKpis) {
            btnRefreshConversionKpis.onclick = function () {
                loadConversionKpis();
            };
        }
        var analyticsConversionKpiDays = document.getElementById('analyticsConversionKpiDays');
        if (analyticsConversionKpiDays) {
            analyticsConversionKpiDays.addEventListener('change', function () {
                loadConversionKpis();
            });
        }
        var btnRefreshPendingActivate24h = document.getElementById('btnRefreshPendingActivate24h');
        if (btnRefreshPendingActivate24h) {
            btnRefreshPendingActivate24h.onclick = function () {
                loadPendingActivate24h(1);
            };
        }
        var btnRefreshRegisterTime = document.getElementById('btnRefreshRegisterTime');
        if (btnRefreshRegisterTime) {
            btnRefreshRegisterTime.addEventListener('click', function () {
                loadAnalyticsRegisterTime();
            });
        }
        var analyticsRegisterTimeDays = document.getElementById('analyticsRegisterTimeDays');
        if (analyticsRegisterTimeDays) {
            analyticsRegisterTimeDays.addEventListener('change', function () {
                loadAnalyticsRegisterTime();
            });
        }
        var btnRefreshRegisterGender = document.getElementById('btnRefreshRegisterGender');
        if (btnRefreshRegisterGender) {
            btnRefreshRegisterGender.addEventListener('click', function () {
                loadAnalyticsRegisterGender();
            });
        }
        var analyticsRegisterGenderDays = document.getElementById('analyticsRegisterGenderDays');
        if (analyticsRegisterGenderDays) {
            analyticsRegisterGenderDays.addEventListener('change', function () {
                loadAnalyticsRegisterGender();
            });
        }
        var btnRefreshChannelAnalysis = document.getElementById('btnRefreshChannelAnalysis');
        if (btnRefreshChannelAnalysis) {
            btnRefreshChannelAnalysis.addEventListener('click', function () {
                loadChannelAnalysis();
            });
        }
        var channelAnalysisDays = document.getElementById('channelAnalysisDays');
        if (channelAnalysisDays) {
            channelAnalysisDays.addEventListener('change', function () {
                loadChannelAnalysis();
            });
        }
        document.getElementById('btnClearAnalyticsEvents').addEventListener('click', function () {
            var trackingEl = document.getElementById('analyticsTrackingDays');
            var daysT = analyticsPeriodVal(trackingEl);
            var periodLabel =
                trackingEl && trackingEl.selectedOptions && trackingEl.selectedOptions[0]
                    ? trackingEl.selectedOptions[0].textContent
                    : daysT;
            if (
                !confirm(
                    '确定删除「' +
                        periodLabel +
                        '」区间内的 C 端行为埋点统计数据？\n仅删除 track_* / EVENT 类埋点，不影响日活、接口调用等其它统计。此操作不可恢复。'
                )
            ) {
                return;
            }
            var btn = this;
            btn.disabled = true;
            adminFetch('api/admin/analytics/events/clear?days=' + encodeURIComponent(daysT), { method: 'POST' })
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code === 200) {
                        var n = j.data && j.data.deleted_rows != null ? j.data.deleted_rows : 0;
                        alert('已删除 ' + n + ' 条埋点聚合记录');
                        loadAnalyticsTrackingPage();
                    } else {
                        alert(j.msg || '删除失败');
                    }
                })
                .catch(function () {
                    alert('网络错误');
                })
                .finally(function () {
                    btn.disabled = false;
                });
        });
        document.getElementById('analyticsDauTbody').addEventListener('click', function (e) {
            var toggleBtn = e.target.closest('.btn-dau-users-toggle');
            if (toggleBtn) {
                var dateT = toggleBtn.getAttribute('data-date');
                var keyT = dauDateDomKey(dateT);
                var rowT = document.getElementById('dau_users_row_' + keyT);
                var boxT = document.getElementById('dau_users_box_' + keyT);
                if (!rowT || !boxT) return;
                var opening = rowT.style.display === 'none';
                if (!opening) {
                    rowT.style.display = 'none';
                    toggleBtn.textContent = '查看账号';
                    return;
                }
                rowT.style.display = '';
                toggleBtn.textContent = '收起';
                if (boxT.getAttribute('data-loaded') === '1') return;
                loadDauUsersPage(dateT, 1, boxT);
                return;
            }
            var prevBtn = e.target.closest('.dau-users-prev');
            if (prevBtn && !prevBtn.disabled) {
                var dateP = prevBtn.getAttribute('data-date');
                var boxP = prevBtn.closest('.dau-users-box');
                if (!boxP || !dateP) return;
                var pageP = (parseInt(boxP.getAttribute('data-page'), 10) || 1) - 1;
                loadDauUsersPage(dateP, pageP, boxP);
                return;
            }
            var nextBtn = e.target.closest('.dau-users-next');
            if (nextBtn && !nextBtn.disabled) {
                var dateN = nextBtn.getAttribute('data-date');
                var boxN = nextBtn.closest('.dau-users-box');
                if (!boxN || !dateN) return;
                var pageN = (parseInt(boxN.getAttribute('data-page'), 10) || 1) + 1;
                loadDauUsersPage(dateN, pageN, boxN);
            }
        });
        document.getElementById('activateEventsDailyTbody').addEventListener('click', function (e) {
            var toggleBtn = e.target.closest('.btn-activate-users-toggle');
            if (toggleBtn) {
                var dateT = toggleBtn.getAttribute('data-date');
                var keyT = activateDateDomKey(dateT);
                var rowT = document.getElementById('activate_users_row_' + keyT);
                var boxT = document.getElementById('activate_users_box_' + keyT);
                if (!rowT || !boxT) {
                    return;
                }
                var opening = rowT.style.display === 'none';
                if (!opening) {
                    rowT.style.display = 'none';
                    toggleBtn.textContent = '查看用户';
                    return;
                }
                rowT.style.display = '';
                toggleBtn.textContent = '收起';
                if (boxT.getAttribute('data-loaded') === '1') {
                    return;
                }
                loadActivateUsersForDate(dateT, 1, boxT);
                return;
            }
            var prevBtn = e.target.closest('.activate-users-prev');
            if (prevBtn && !prevBtn.disabled) {
                var dateP = prevBtn.getAttribute('data-date');
                var boxP = prevBtn.closest('.activate-users-box');
                if (!boxP || !dateP) {
                    return;
                }
                var pageP = (parseInt(boxP.getAttribute('data-page'), 10) || 1) - 1;
                loadActivateUsersForDate(dateP, pageP, boxP);
                return;
            }
            var nextBtn = e.target.closest('.activate-users-next');
            if (nextBtn && !nextBtn.disabled) {
                var dateN = nextBtn.getAttribute('data-date');
                var boxN = nextBtn.closest('.activate-users-box');
                if (!boxN || !dateN) {
                    return;
                }
                var pageN = (parseInt(boxN.getAttribute('data-page'), 10) || 1) + 1;
                loadActivateUsersForDate(dateN, pageN, boxN);
            }
        });
        document.getElementById('btnGotoLoginLog').addEventListener('click', function () {
            location.hash = 'login-log';
        });
        document.getElementById('loginLogPrev').addEventListener('click', function () {
            if (loginRecentPage > 1) {
                loadLoginRecentPage(loginRecentPage - 1);
            }
        });
        document.getElementById('loginLogNext').addEventListener('click', function () {
            loadLoginRecentPage(loginRecentPage + 1);
        });
        document.getElementById('loginLogPageSize').addEventListener('change', function () {
            loginRecentLimit = parseInt(document.getElementById('loginLogPageSize').value, 10) || 20;
            loadLoginRecentPage(1);
        });
        document.getElementById('loginLogMode').addEventListener('change', function () {
            loginLogMode = document.getElementById('loginLogMode').value === 'admin-operation' ? 'admin-operation' : 'admin-login';
            loadLoginRecentPage(1);
        });
        document.getElementById('btnRefreshLoginLog').addEventListener('click', function () {
            loginRecentLimit = parseInt(document.getElementById('loginLogPageSize').value, 10) || 20;
            loadLoginRecentPage(1);
        });
        document.getElementById('userLoginLogPrev').addEventListener('click', function () {
            if (userLoginPage > 1) {
                loadUserLoginRecentPage(userLoginPage - 1);
            }
        });
        document.getElementById('userLoginLogNext').addEventListener('click', function () {
            loadUserLoginRecentPage(userLoginPage + 1);
        });
        document.getElementById('userLoginLogPageSize').addEventListener('change', function () {
            userLoginLimit = parseInt(document.getElementById('userLoginLogPageSize').value, 10) || 20;
            loadUserLoginRecentPage(1);
        });
        document.getElementById('btnRefreshUserLoginLog').addEventListener('click', function () {
            userLoginLimit = parseInt(document.getElementById('userLoginLogPageSize').value, 10) || 20;
            loadUserLoginRecentPage(1);
        });
        var userLoginLogReasonFilter = document.getElementById('userLoginLogReasonFilter');
        if (userLoginLogReasonFilter) {
            userLoginLogReasonFilter.addEventListener('change', function () {
                loadUserLoginRecentPage(1);
            });
        }

        document.getElementById('feedbackAdminTbody').addEventListener('click', function (e) {
            var b = e.target.closest('button[data-feedback-id]');
            if (!b) {
                return;
            }
            var id = parseInt(b.getAttribute('data-feedback-id'), 10);
            var row = (feedbackAdminLastItems || []).filter(function (x) {
                return Number(x.id) === id;
            })[0];
            if (row) {
                openFeedbackReplyModal(row);
            }
        });
        document.getElementById('feedbackReplyBackdrop').addEventListener('click', function (e) {
            if (e.target.id === 'feedbackReplyBackdrop') {
                closeFeedbackReplyModal();
            }
        });
        var userPasswordBackdrop = document.getElementById('userPasswordBackdrop');
        if (userPasswordBackdrop) {
            userPasswordBackdrop.addEventListener('click', function (e) {
                if (e.target.id === 'userPasswordBackdrop') {
                    closeUserPasswordModal();
                }
            });
        }
        var userPasswordCancel = document.getElementById('userPasswordCancel');
        if (userPasswordCancel) {
            userPasswordCancel.addEventListener('click', closeUserPasswordModal);
        }
        var userPasswordConfirm = document.getElementById('userPasswordConfirm');
        if (userPasswordConfirm) {
            userPasswordConfirm.addEventListener('click', submitUserPassword);
        }
        var userPasswordInput = document.getElementById('userPasswordInput');
        if (userPasswordInput) {
            userPasswordInput.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    submitUserPassword();
                }
            });
        }
        var userActivateBackdrop = document.getElementById('userActivateBackdrop');
        if (userActivateBackdrop) {
            userActivateBackdrop.addEventListener('click', function (e) {
                if (e.target.id === 'userActivateBackdrop') {
                    closeUserActivateModal();
                }
            });
        }
        var userActivateCancel = document.getElementById('userActivateCancel');
        if (userActivateCancel) {
            userActivateCancel.addEventListener('click', closeUserActivateModal);
        }
        var userActivateConfirm = document.getElementById('userActivateConfirm');
        if (userActivateConfirm) {
            userActivateConfirm.addEventListener('click', submitUserActivate);
        }
        var userActivateCodeInput = document.getElementById('userActivateCodeInput');
        if (userActivateCodeInput) {
            userActivateCodeInput.addEventListener('keydown', function (ev) {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    submitUserActivate();
                }
            });
        }
        document.getElementById('feedbackReplyCancel').addEventListener('click', closeFeedbackReplyModal);
        document.getElementById('feedbackReplySave').addEventListener('click', function () {
            if (!feedbackReplyEditingId) {
                return;
            }
            var text = document.getElementById('feedbackReplyText').value.trim();
            if (!text) {
                alert('请填写回复内容');
                return;
            }
            adminFetch('api/admin/feedback/reply', {
                method: 'POST',
                body: JSON.stringify({ id: feedbackReplyEditingId, reply: text })
            })
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code === 200) {
                        closeFeedbackReplyModal();
                        loadAdminFeedbackPage(feedbackAdminPage);
                    } else {
                        alert(j.msg || '保存失败');
                    }
                })
                .catch(function () {
                    alert('网络错误');
                });
        });
        document.getElementById('btnRefreshFeedback').addEventListener('click', function () {
            loadAdminFeedbackPage(feedbackAdminPage);
        });
        document.getElementById('feedbackFilterType').addEventListener('change', function () {
            loadAdminFeedbackPage(1);
        });
        document.getElementById('feedbackFilterActive').addEventListener('change', function () {
            loadAdminFeedbackPage(1);
        });
        document.getElementById('feedbackAdminPrev').addEventListener('click', function () {
            if (feedbackAdminPage > 1) {
                loadAdminFeedbackPage(feedbackAdminPage - 1);
            }
        });
        document.getElementById('feedbackAdminNext').addEventListener('click', function () {
            loadAdminFeedbackPage(feedbackAdminPage + 1);
        });

        document.getElementById('analyticsOverviewDays').addEventListener('change', function () {
            if (_adminAnalyticsActivitySeen) loadAnalyticsActivityPage();
        });
        document.getElementById('apiAnalyticsDays').addEventListener('change', function () {
            if (_adminApiAnalyticsSeen) loadApiAnalyticsPanel();
        });
        document.getElementById('btnRefreshApiAnalytics').addEventListener('click', function () {
            loadApiAnalyticsPanel();
        });
        document.getElementById('btnLoadDevices').addEventListener('click', loadAnalyticsDevices);

        function initAdminSession() {
            readAdminProfileCache();
            applyMenuVisibility();
            if (!location.hash || location.hash === '#') {
                history.replaceState(null, '', '#' + firstAllowedAdminPage());
            }
            applyAdminRoute();
            adminFetch('api/admin/me')
                .then(function (r) { return r.json(); })
                .then(function (j) {
                    if (j.code !== 200 || !j.data || !j.data.admin) {
                        return;
                    }
                    var a = j.data.admin;
                    currentAdminProfile = {
                        username: a.username ? String(a.username) : '',
                        full_name: a.full_name ? String(a.full_name) : '',
                        is_super: !!a.is_super,
                        menus: Array.isArray(a.menus) ? a.menus.map(function (m) { return String(m); }) : []
                    };
                    localStorage.setItem('admin_profile', JSON.stringify(currentAdminProfile));
                    applyMenuVisibility();
                    var normalized = normalizeAdminPage(location.hash);
                    if (location.hash !== '#' + normalized) {
                        location.hash = normalized;
                        return;
                    }
                    applyAdminRoute();
                })
                .catch(function () {});
        }

        document.querySelectorAll('.nav-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var p = btn.getAttribute('data-page');
                if (p) {
                    location.hash = p;
                }
            });
        });
        window.addEventListener('hashchange', applyAdminRoute);
        if (window.AdminAnalyticsPeriod) {
            AdminAnalyticsPeriod.initAll();
        }
        initAdminSession();
