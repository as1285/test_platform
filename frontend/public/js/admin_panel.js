        function esc(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
        var _udHighSalaryChartInstances = [];
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

        function keyForUser(username) {
            return encodeURIComponent(String(username || '')).replace(/%/g, '_');
        }

        function formatMoneyLike(v) {
            if (v == null || String(v).trim() === '') return '0.00';
            return esc(String(v));
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
                index: '登录（index.html）'
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
                html += '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>页面</th><th>最近进入时间</th></tr></thead><tbody>';
                pages.forEach(function (p) {
                    html += '<tr>';
                    html += '<td class="cell-break">' + esc(p.page_path || '—') + '</td>';
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
            if (!records.length) {
                html += '<div style="color:#999;">暂无个税记录</div>';
            } else {
                html += '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>税款所属期</th><th>所得项目</th><th>所得小类</th><th>扣缴义务人</th><th>收入</th><th>已申报税额</th></tr></thead><tbody>';
                records.forEach(function (r) {
                    var period = r.tax_period || ((r.year || '') + '-' + String(r.month || '').padStart(2, '0'));
                    html += '<tr>';
                    html += '<td>' + esc(period || '—') + '</td>';
                    html += '<td>' + esc(r.income_type || '—') + '</td>';
                    html += '<td>' + esc(r.income_subtype || '—') + '</td>';
                    html += '<td class="cell-break">' + esc(r.company_name || '—') + '</td>';
                    html += '<td>' + formatMoneyLike(r.income) + '</td>';
                    html += '<td>' + formatMoneyLike(r.tax_reported) + '</td>';
                    html += '</tr>';
                });
                html += '</tbody></table></div>';
            }
            html += '</div>';
            return html;
        }

        var userPage = 1;
        var USER_LIMIT_STORAGE_KEY = 'admin_user_list_limit';
        var USER_LIMIT_OPTIONS = [10, 20, 50, 100];
        var userLimit = 10;
        (function initUserListPageLimit() {
            var saved = parseInt(localStorage.getItem(USER_LIMIT_STORAGE_KEY), 10);
            if (USER_LIMIT_OPTIONS.indexOf(saved) >= 0) {
                userLimit = saved;
            }
            var sel = document.getElementById('userPageLimit');
            if (sel) {
                sel.value = String(userLimit);
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
        var _adminUserDataLoaded = false;
        var userDataPage = 1;
        var userDataLimit = 15;
        var _adminCodesLoaded = false;
        var _adminAnalyticsSeen = false;
        var _adminApiAnalyticsSeen = false;
        var _adminServerMonitorSeen = false;

        function adminHasMenu(menuKey) {
            if (!menuKey) return false;
            if (menuKey === 'user-login-log') menuKey = 'login-log';
            if (currentAdminProfile && currentAdminProfile.is_super) return true;
            return !!(currentAdminProfile && Array.isArray(currentAdminProfile.menus) && currentAdminProfile.menus.indexOf(menuKey) >= 0);
        }

        function firstAllowedAdminPage() {
            var order = ['settings', 'install-guide', 'appearance', 'codes', 'admin-accounts', 'users', 'user-data', 'feedback', 'login-log', 'user-login-log', 'server-monitor', 'analytics', 'api-analytics'];
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
                feedback: 1,
                analytics: 1,
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
            var t = typeF ? typeF.value : '';
            var q =
                'api/admin/feedback?page=' +
                encodeURIComponent(feedbackAdminPage) +
                '&limit=' +
                encodeURIComponent(feedbackAdminLimit);
            if (t) {
                q += '&type=' + encodeURIComponent(t);
            }
            document.getElementById('feedbackAdminTbody').innerHTML =
                '<tr><td colspan="9">加载中…</td></tr>';
            adminFetch(q)
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        document.getElementById('feedbackAdminTbody').innerHTML =
                            '<tr><td colspan="9">' + esc(j.msg || '加载失败') + '</td></tr>';
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
                        html = '<tr><td colspan="9">暂无数据</td></tr>';
                    } else {
                        items.forEach(function (r) {
                            var typLabel = r.feedback_type === 'bug' ? 'BUG' : '意见优化';
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
                        '<tr><td colspan="9">网络错误</td></tr>';
                });
        }

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

        function loadAnalyticsDashboard() {
            loadAnalyticsDailyConversion();
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

        function keyForUserData(username) {
            return String(username || '').replace(/[^a-zA-Z0-9_.-]/g, '_');
        }

        function destroyUdHighSalaryCharts() {
            _udHighSalaryChartInstances.forEach(function (c) {
                try {
                    c.destroy();
                } catch (e0) {}
            });
            _udHighSalaryChartInstances = [];
        }

        function chartColorAtIndex(index) {
            return DEVICE_CHART_FALLBACK[index % DEVICE_CHART_FALLBACK.length];
        }

        function formatSalaryYuan(n) {
            if (n == null || isNaN(Number(n))) return '—';
            return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' 元';
        }

        function renderUdHighSalaryCharts(data) {
            destroyUdHighSalaryCharts();
            var wrap = document.getElementById('userDataHighSalaryChartsWrap');
            var grid = document.getElementById('userDataHighSalaryChartsGrid');
            var emptyEl = document.getElementById('userDataHighSalaryChartsEmpty');
            var summaryEl = document.getElementById('udHighSalarySummary');
            if (!wrap) return;

            wrap.style.display = 'block';
            var total = Number(data && data.total_count) || 0;
            var threshold = Number(data && data.min_salary) || 20000;

            if (summaryEl) {
                var cards = [
                    { label: '人数', val: total },
                    { label: '平均', val: formatSalaryYuan(data.avg_salary) },
                    { label: '中位数', val: formatSalaryYuan(data.median_salary) },
                    { label: '最高', val: formatSalaryYuan(data.max_salary) },
                    { label: '最低', val: formatSalaryYuan(data.min_salary_in_cohort) }
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
                            : '暂无月薪 ' + (threshold / 10000) + ' 万以上的用户（近6月平均）';
                }
                return;
            }
            if (emptyEl) emptyEl.style.display = 'none';
            if (grid) grid.style.display = 'grid';

            var dist = (data.salary_distribution || []).filter(function (b) {
                return Number(b.count) > 0;
            });
            if (!dist.length) {
                dist = data.salary_distribution || [];
            }
            var distLabels = dist.map(function (b) {
                return b.label;
            });
            var distCounts = dist.map(function (b) {
                return Number(b.count) || 0;
            });
            var distColors = distLabels.map(function (_l, i) {
                return chartColorAtIndex(i);
            });

            var barOpts = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            };

            _udHighSalaryChartInstances.push(
                new Chart(document.getElementById('udChartHighSalaryDist'), {
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
            _udHighSalaryChartInstances.push(
                new Chart(document.getElementById('udChartHighSalaryShare'), {
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

            var companies = (data.top_companies || []).slice(0, 10);
            var compLabels = companies.map(function (c) {
                var n = String(c.name || '');
                return n.length > 18 ? n.slice(0, 18) + '…' : n;
            });
            var compCounts = companies.map(function (c) {
                return Number(c.user_count) || 0;
            });
            _udHighSalaryChartInstances.push(
                new Chart(document.getElementById('udChartHighSalaryCompanies'), {
                    type: 'bar',
                    data: {
                        labels: compLabels,
                        datasets: [
                            {
                                label: '用户数',
                                data: compCounts,
                                backgroundColor: chartColorAtIndex(0) + '99',
                                borderColor: chartColorAtIndex(0),
                                borderWidth: 1
                            }
                        ]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }
                    }
                })
            );

            var topUsers = (data.top_users || []).slice(0, 12);
            var userLabels = topUsers.map(function (u) {
                return String(u.username || '');
            });
            var userSalaries = topUsers.map(function (u) {
                return Number(u.avg_salary_6m) || 0;
            });
            _udHighSalaryChartInstances.push(
                new Chart(document.getElementById('udChartHighSalaryTopUsers'), {
                    type: 'bar',
                    data: {
                        labels: userLabels,
                        datasets: [
                            {
                                label: '近6月平均工资（元）',
                                data: userSalaries,
                                backgroundColor: chartColorAtIndex(2) + '99',
                                borderColor: chartColorAtIndex(2),
                                borderWidth: 1
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true }
                        }
                    }
                })
            );
        }

        function loadUdHighSalaryCharts() {
            var wrap = document.getElementById('userDataHighSalaryChartsWrap');
            if (wrap) wrap.style.display = 'block';
            adminFetch('api/admin/user-data/salary-high/charts?min_salary=20000')
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        destroyUdHighSalaryCharts();
                        var emptyEl = document.getElementById('userDataHighSalaryChartsEmpty');
                        if (emptyEl) {
                            emptyEl.style.display = 'block';
                            emptyEl.textContent = j.msg || '高收入图表加载失败';
                        }
                        return;
                    }
                    renderUdHighSalaryCharts(j.data);
                })
                .catch(function () {
                    destroyUdHighSalaryCharts();
                    var emptyEl = document.getElementById('userDataHighSalaryChartsEmpty');
                    if (emptyEl) {
                        emptyEl.style.display = 'block';
                        emptyEl.textContent = '高收入图表加载失败';
                    }
                });
        }

        function applyHighSalaryListFilter() {
            var minEl = document.getElementById('udFilterSalaryMin');
            var maxEl = document.getElementById('udFilterSalaryMax');
            if (minEl) minEl.value = '20000';
            if (maxEl) maxEl.value = '';
            loadUserDataList(1);
            var tbl = document.querySelector('#page-user-data .users-data-table');
            if (tbl && tbl.scrollIntoView) {
                tbl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
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
            loadUdHighSalaryCharts();
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

        function loadUserDataAnalytics() {
            var wrap = document.getElementById('userDataAnalytics');
            if (wrap) wrap.textContent = '分析数据加载中…';
            destroyUdHighSalaryCharts();
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

            html += '<div style="margin:10px 0 6px;color:#666;">纳税人识别号（' + (data.company_tax_ids || []).length + '）</div>';
            html += '<div class="scroll-x"><table class="user-detail-table"><tbody>';
            (data.company_tax_ids || []).forEach(function (t) {
                html += '<tr><td class="cell-break"><code>' + esc(t) + '</code></td></tr>';
            });
            if (!(data.company_tax_ids || []).length) {
                html += '<tr><td>—</td></tr>';
            }
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

            html +=
                '<div style="margin:14px 0 6px;color:#666;">纳税记录凭证 <span style="color:#999;font-size:12px;">（管理端预览，含右下角公章；C 端用户下载版不含章）</span></div>';
            html +=
                '<div class="ud-certificate-wrap" id="ud_certificate_' +
                esc(username).replace(/[^a-zA-Z0-9_-]/g, '_') +
                '">正在生成凭证预览…</div>';

            html += '<div style="margin:10px 0 6px;color:#666;">个税记录（' + (data.tax_records || []).length + ' 条）</div>';
            if (!(data.tax_records || []).length) {
                html += '<div style="color:#999;">暂无</div>';
            } else {
                html +=
                    '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>所属期</th><th>公司</th><th>识别号</th><th>税务机关</th><th>收入</th><th>税额</th></tr></thead><tbody>';
                (data.tax_records || []).forEach(function (r) {
                    var period = r.tax_period || (r.year ? r.year + '-' + String(r.month || '').padStart(2, '0') : '—');
                    html += '<tr>';
                    html += '<td>' + esc(period) + '</td>';
                    html += '<td class="cell-break">' + esc(r.company_name || '—') + '</td>';
                    html += '<td class="cell-break"><code>' + esc(r.company_tax_id || '—') + '</code></td>';
                    html += '<td class="cell-break">' + esc(r.tax_authority || '—') + '</td>';
                    html += '<td>' + formatMoneyLike(r.income) + '</td>';
                    html += '<td>' + formatMoneyLike(r.tax_reported) + '</td>';
                    html += '</tr>';
                });
                html += '</tbody></table></div>';
            }
            html += '</div>';
            return html;
        }

        function mountUserDataCertificate(username, data) {
            var safeKey = String(username || '').replace(/[^a-zA-Z0-9_-]/g, '_');
            var el = document.getElementById('ud_certificate_' + safeKey);
            if (!el) return;
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
                    .then(function (url) {
                        el.innerHTML =
                            '<img src="' +
                            url +
                            '" alt="纳税记录凭证（管理端）" title="管理端预览含公章">';
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
                        html += '<td class="cell-break">' + esc(row.company_tax_ids_summary || '—') + '</td>';
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
                        var ops = (u.banned
                            ? '<button type="button" class="btn-sm btn-unban btn-ban-act" data-u="' + esc(u.username) + '" data-b="0">解封</button>'
                            : '<button type="button" class="btn-sm btn-ban btn-ban-act" data-u="' + esc(u.username) + '" data-b="1">封禁</button>')
                            + ' ' + detailBtn
                            + ' <button type="button" class="btn-sm btn-del-user btn-delete-user" data-u="' + esc(u.username) + '">删除账号</button>';
                        
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
                        html += '<td class="cell-break"><code>' + esc(u.password) + '</code></td>';
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
                            if (!confirm('确定永久删除账号「' + name + '」？\n将同时删除其任职受雇、税务记录、消息等数据，且不可恢复。')) return;
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
            var isSuper = !!(currentAdminProfile && currentAdminProfile.is_super);
            var limit = isSuper ? 20 : xianyuCodeLimit;
            var q = 'api/admin/codes?page=' + xianyuCodePage + '&limit=' + limit + '&scope=xianyu';
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
                        statEl.textContent =
                            '共 ' +
                            total +
                            ' 条闲鱼激活码' +
                            (isSuper ? '（全部管理员）' : '（本账号生成）');
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
            feedback: '用户反馈',
            'login-log': '管理账号登录流水',
            'user-login-log': '普通用户登录流水',
            analytics: '数据统计',
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
                            html += '<tr><td colspan="6">';
                            html += '<div class="form-row" style="margin:0 0 6px;align-items:center;gap:8px;">';
                            html += '<label style="font-size:12px;color:#666;">姓名</label>';
                            html += '<input type="text" class="admin-account-fullname" data-username="' + esc(a.username) + '" value="' + esc(a.full_name || '') + '" placeholder="填写姓名">';
                            html += '</div>';
                            html += '<div class="form-row admin-account-menu-row" data-username="' + esc(a.username) + '" style="gap:12px;margin:0;padding:0 0 2px;">';
                            adminMenuKeyList.forEach(function (mk) {
                                var checked = a.menus && a.menus.indexOf(mk) >= 0;
                                html += '<label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#555;">';
                                html += '<input type="checkbox" data-menu-key="' + esc(mk) + '"' + (checked ? ' checked' : '') + '>';
                                html += '<span>' + esc(menuLabel(mk)) + '</span>';
                                html += '</label>';
                            });
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
        var btnViewHighSalaryUserList = document.getElementById('btnViewHighSalaryUserList');
        if (btnViewHighSalaryUserList) {
            btnViewHighSalaryUserList.onclick = function () {
                applyHighSalaryListFilter();
            };
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

        var btnIssueBatch100 = document.getElementById('btnIssueBatch100');
        if (btnIssueBatch100) {
            btnIssueBatch100.addEventListener('click', function () {
                if (
                    !confirm(
                        '将一次性生成 100 个激活码（备注：闲鱼批量），写入数据库并下载 TXT 文件。是否继续？'
                    )
                ) {
                    return;
                }
                btnIssueBatch100.disabled = true;
                adminFetch('api/admin/issue-code-batch', {
                    method: 'POST',
                    body: JSON.stringify({ count: 100, note: '闲鱼批量' })
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
                        btnIssueBatch100.disabled = false;
                    });
            });
        }

        document.getElementById('btnRefreshCodes').addEventListener('click', function() {
            loadCodes(1);
            loadXianyuCodes(1);
        });
        document.getElementById('btnSearchCodes').addEventListener('click', function() { loadCodes(1); });
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
                    }
                    if (data.code === 200 && data.data) {
                        var apkEl = document.getElementById('androidApkDownloadUrl');
                        var iosEl = document.getElementById('iosMobileconfigDownloadUrl');
                        if (apkEl && data.data.android_apk_download_url != null) {
                            apkEl.value = String(data.data.android_apk_download_url);
                        }
                        if (iosEl && data.data.ios_mobileconfig_download_url != null) {
                            iosEl.value = String(data.data.ios_mobileconfig_download_url);
                        }
                        var xyEl = document.getElementById('xianyuPurchaseUrl');
                        if (xyEl && data.data.xianyu_purchase_url != null) {
                            xyEl.value = String(data.data.xianyu_purchase_url);
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
                    ios_mobileconfig_download_url: document.getElementById('iosMobileconfigDownloadUrl').value.trim(),
                    xianyu_purchase_url: document.getElementById('xianyuPurchaseUrl').value.trim(),
                    mine_ui: {
                        install_ios_video: document.getElementById('img_install_ios_video').value.trim(),
                        install_usage_video: document.getElementById('img_install_usage_video').value.trim()
                    }
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
        loadAdminSettings();

        document.getElementById('btnRefreshAnalytics').addEventListener('click', function () {
            loadAnalyticsDashboard();
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
            loadAnalyticsDailyConversion(true);
        });
        document.getElementById('analyticsConversionDays').addEventListener('change', function () {
            loadAnalyticsDailyConversion(true);
        });
        document.getElementById('analyticsDailyConversion').addEventListener('click', function (ev) {
            if (!analyticsConvCache) return;
            var t = ev.target;
            if (t && t.id === 'analyticsConvPrev' && analyticsConvPage > 1) {
                renderAnalyticsDailyConversion(analyticsConvCache, analyticsConvPage - 1);
            } else if (t && t.id === 'analyticsConvNext') {
                var series = Array.isArray(analyticsConvCache.series) ? analyticsConvCache.series.length : 0;
                var totalPages = Math.max(1, Math.ceil(series / analyticsConvLimit) || 1);
                if (analyticsConvPage < totalPages) {
                    renderAnalyticsDailyConversion(analyticsConvCache, analyticsConvPage + 1);
                }
            }
        });
        document.getElementById('btnClearAnalyticsEvents').addEventListener('click', function () {
            var daysO = parseInt(document.getElementById('analyticsOverviewDays').value, 10) || 14;
            if (
                !confirm(
                    '确定删除最近 ' +
                        daysO +
                        ' 天内的 C 端行为埋点统计数据？\n仅删除 track_* / EVENT 类埋点，不影响日活、接口调用等其它统计。此操作不可恢复。'
                )
            ) {
                return;
            }
            var btn = this;
            btn.disabled = true;
            adminFetch('api/admin/analytics/events/clear?days=' + encodeURIComponent(daysO), { method: 'POST' })
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code === 200) {
                        var n = j.data && j.data.deleted_rows != null ? j.data.deleted_rows : 0;
                        alert('已删除 ' + n + ' 条埋点聚合记录');
                        loadAnalyticsDashboard();
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
        document.getElementById('feedbackAdminPrev').addEventListener('click', function () {
            if (feedbackAdminPage > 1) {
                loadAdminFeedbackPage(feedbackAdminPage - 1);
            }
        });
        document.getElementById('feedbackAdminNext').addEventListener('click', function () {
            loadAdminFeedbackPage(feedbackAdminPage + 1);
        });

        document.getElementById('analyticsOverviewDays').addEventListener('change', function () {
            if (_adminAnalyticsSeen) loadAnalyticsDashboard();
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
        initAdminSession();
