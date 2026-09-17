        /* ========== Admin Panel — Utility Functions ========== */
        function esc(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        function adminToast(text, opts) {
            var msg = String(text == null ? '' : text).trim();
            if (!msg) return;
            var type = opts && opts.type === 'error' ? 'error' : 'ok';
            var host = document.getElementById('adminToastHost');
            if (!host) {
                host = document.createElement('div');
                host.id = 'adminToastHost';
                host.className = 'admin-toast-host';
                host.setAttribute('aria-live', 'polite');
                document.body.appendChild(host);
            }
            var el = document.createElement('div');
            el.className = 'admin-toast is-' + (type === 'error' ? 'err' : 'ok');
            el.textContent = msg;
            host.appendChild(el);
            requestAnimationFrame(function () {
                el.classList.add('is-on');
            });
            setTimeout(function () {
                el.classList.remove('is-on');
                setTimeout(function () {
                    if (el.parentNode) el.parentNode.removeChild(el);
                }, 220);
            }, 3000);
        }
        window.adminToast = adminToast;

        /* ========== Chart Delegate Stubs ========== */
        function analyticsPeriodVal(el) {
            if (window.AdminAnalyticsPeriod) {
                return AdminAnalyticsPeriod.getValue(el);
            }
            return el ? String(el.value || '1') : '1';
        }

        /* charts: /js/admin/modules/charts.js (lazy) — 挂 window 供懒加载覆盖 */
        window.destroyRegisterTimeCharts = function () {};
        window.destroyChannelAnalysisCharts = function () {};
        window.destroyPlatformCharts = function () {};
        window.loadChannelAnalysis = function () {};
        window.loadAnalyticsRegisterPlatform = function () {};
        window.loadAnalyticsRegisterTime = function () {};
        window.renderChannelAnalysis = function () {};
        window.renderRegisterTimeAnalysis = function () {};
        window.renderRegisterPlatformAnalysis = function () {};
        function destroyRegisterTimeCharts() {
            return window.destroyRegisterTimeCharts.apply(this, arguments);
        }
        /* 安装统计图表实例在本文件创建，销毁也必须清本地数组（勿再转发 window，charts.js 那份永远为空） */
        var _installGuideChartInstances = [];
        function destroyInstallGuideCharts() {
            _installGuideChartInstances.forEach(function (c) {
                try {
                    c.destroy();
                } catch (e0) {}
            });
            _installGuideChartInstances = [];
        }
        function destroyChannelAnalysisCharts() {
            return window.destroyChannelAnalysisCharts.apply(this, arguments);
        }
        function destroyPlatformCharts() {
            return window.destroyPlatformCharts.apply(this, arguments);
        }
        function loadChannelAnalysis() {
            return window.loadChannelAnalysis.apply(this, arguments);
        }
        function loadAnalyticsRegisterPlatform() {
            return window.loadAnalyticsRegisterPlatform.apply(this, arguments);
        }
        function loadAnalyticsRegisterTime() {
            return window.loadAnalyticsRegisterTime.apply(this, arguments);
        }
        function renderChannelAnalysis() {
            return window.renderChannelAnalysis.apply(this, arguments);
        }
        function renderRegisterTimeAnalysis() {
            return window.renderRegisterTimeAnalysis.apply(this, arguments);
        }
        function renderRegisterPlatformAnalysis() {
            return window.renderRegisterPlatformAnalysis.apply(this, arguments);
        }

        function formatMonthIncomeShort(n) {
            var v = Number(n);
            if (!isFinite(v) || v <= 0) return '—';
            if (v >= 10000) {
                var wan = Math.round(v / 100) / 100;
                return String(wan) + '万';
            }
            return String(Math.round(v));
        }

        function formatMonthIncomeYuan(n) {
            var v = Number(n);
            if (!isFinite(v) || v <= 0) return '—';
            return '¥' + v.toFixed(v % 1 ? 2 : 0);
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

        var _activationBatchChannelsCache = [
            { key: 'xianyu', label: '闲鱼', builtin: true },
            { key: 'kufaka', label: '酷发卡', builtin: true },
            { key: 'alipay', label: '支付宝', builtin: true }
        ];
        var XIANYU_CODE_DEFAULT_CHANNEL = '支付宝';

        function fillBatchChannelSelects(channels, preferredLabel) {
            var list =
                Array.isArray(channels) && channels.length
                    ? channels
                    : _activationBatchChannelsCache;
            _activationBatchChannelsCache = list;
            var prefer = preferredLabel != null ? String(preferredLabel).trim() : '';
            var sel = document.getElementById('xianyuCodeChannelFilter');
            if (!sel) return;
            var prev = prefer || String(sel.value || '').trim();
            if (!prev) {
                prev = XIANYU_CODE_DEFAULT_CHANNEL;
            }
            sel.innerHTML = '';
            var optAll = document.createElement('option');
            optAll.value = '';
            optAll.textContent = '全部渠道';
            sel.appendChild(optAll);
            list.forEach(function (ch) {
                var lab = ch && ch.label != null ? String(ch.label).trim() : '';
                if (!lab) return;
                var opt = document.createElement('option');
                opt.value = lab;
                opt.textContent = lab;
                if (ch.builtin) {
                    opt.setAttribute('data-builtin', '1');
                }
                sel.appendChild(opt);
            });
            if (prev) {
                var found = false;
                for (var i = 0; i < sel.options.length; i++) {
                    if (sel.options[i].value === prev) {
                        sel.value = prev;
                        found = true;
                        break;
                    }
                }
                if (!found && prev === XIANYU_CODE_DEFAULT_CHANNEL) {
                    sel.value = '';
                }
            }
        }

        function loadActivationBatchChannels() {
            if (!(currentAdminProfile && currentAdminProfile.is_super)) {
                fillBatchChannelSelects(_activationBatchChannelsCache);
                return;
            }
            adminFetch('api/admin/activation-batch-channels')
                .then(function (r) {
                    return (window.adminParseJson||function(r){return r.json();})(r);
                })
                .then(function (data) {
                    if (data.code === 200 && data.data && data.data.channels) {
                        fillBatchChannelSelects(data.data.channels);
                    } else {
                        fillBatchChannelSelects(_activationBatchChannelsCache);
                    }
                })
                .catch(function () {
                    fillBatchChannelSelects(_activationBatchChannelsCache);
                });
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
            'sousuo.html': '搜索',
            'zixun.html': '资讯',
            'jingshi.html': '警示案例',
            'zhongdian_fuwu.html': '首页重点服务管理',
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
            { key: 'other_deduction', label: '专项附加扣除', money: true },
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

            html += buildTodayTaxChangesHtml(payload);

            html += buildAdminShebaoPhotosSectionHtml(username, null, 'user');

            html += '<div style="margin:10px 0 8px 0;color:#666;">个税记录（' + records.length + ' 条）</div>';
            html += renderAdminTaxRecordsTable(records);
            html += '</div>';
            return html;
        }

        function adminShebaoSafeKey(username) {
            return String(username || '').replace(/[^a-zA-Z0-9_-]/g, '_');
        }

        function formatAdminShebaoBytes(n) {
            var b = Number(n) || 0;
            if (b < 1024) return b + ' B';
            if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
            return (b / (1024 * 1024)).toFixed(2) + ' MB';
        }

        /** items=null 表示稍后异步拉取；数组则同步渲染占位 */
        function buildAdminShebaoPhotosSectionHtml(username, items, prefix) {
            prefix = prefix || 'ud';
            var safeKey = adminShebaoSafeKey(username);
            var countLabel =
                items == null ? '…' : String((items || []).length);
            var html = '';
            html +=
                '<div style="margin:10px 0 6px;color:#666;">社保照片（' +
                countLabel +
                '）</div>';
            html +=
                '<div class="ud-shebao-wrap" id="' +
                prefix +
                '_shebao_' +
                safeKey +
                '" data-username="' +
                esc(username) +
                '">';
            if (items == null) {
                html += '<div class="ud-shebao-empty">加载中…</div>';
            } else if (!(items || []).length) {
                html += '<div class="ud-shebao-empty">用户未上传社保截图</div>';
            } else {
                html += '<div class="ud-shebao-grid"></div>';
            }
            html += '</div>';
            return html;
        }

        function revokeAdminShebaoObjectUrls(container) {
            if (!container || !container.__shebaoObjectUrls) return;
            (container.__shebaoObjectUrls || []).forEach(function (u) {
                try {
                    URL.revokeObjectURL(u);
                } catch (e0) {}
            });
            container.__shebaoObjectUrls = [];
        }

        function renderAdminShebaoPhotoItems(container, items) {
            if (!container) return;
            revokeAdminShebaoObjectUrls(container);
            container.__shebaoObjectUrls = [];
            items = items || [];
            if (!items.length) {
                container.innerHTML = '<div class="ud-shebao-empty">用户未上传社保截图</div>';
                return;
            }
            var grid = document.createElement('div');
            grid.className = 'ud-shebao-grid';
            container.innerHTML = '';
            container.appendChild(grid);
            items.forEach(function (it) {
                var url = it && it.url ? String(it.url) : '';
                if (!url) return;
                var card = document.createElement('div');
                card.className = 'ud-shebao-item';
                var img = document.createElement('img');
                img.alt = (it.original_name || '社保照片') + '';
                img.loading = 'lazy';
                var meta = document.createElement('div');
                meta.className = 'ud-shebao-meta';
                var name = it.original_name ? String(it.original_name) : '照片 #' + (it.id || '');
                var when = it.created_at ? formatDt(it.created_at) : '';
                meta.textContent =
                    name +
                    (when ? ' · ' + when : '') +
                    (it.file_size ? ' · ' + formatAdminShebaoBytes(it.file_size) : '');
                var openBtn = document.createElement('a');
                openBtn.className = 'ud-shebao-open';
                openBtn.href = '#';
                openBtn.textContent = '新窗口查看';
                openBtn.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    if (img.src) window.open(img.src, '_blank', 'noopener');
                });
                card.appendChild(img);
                card.appendChild(meta);
                card.appendChild(openBtn);
                grid.appendChild(card);
                adminFetch(url, {
                    method: 'GET',
                    cache: 'no-store',
                    headers: { 'Content-Type': 'application/octet-stream' }
                })
                    .then(function (r) {
                        if (!r.ok) throw new Error('load_failed');
                        return r.blob();
                    })
                    .then(function (blob) {
                        var obj = URL.createObjectURL(blob);
                        container.__shebaoObjectUrls.push(obj);
                        img.src = obj;
                    })
                    .catch(function () {
                        card.classList.add('is-error');
                        meta.textContent = (meta.textContent || '') + '（加载失败）';
                    });
            });
        }

        function mountAdminShebaoPhotos(username, items, prefix) {
            prefix = prefix || 'ud';
            var el = document.getElementById(prefix + '_shebao_' + adminShebaoSafeKey(username));
            if (!el) return;
            if (items != null) {
                renderAdminShebaoPhotoItems(el, items);
                return;
            }
            el.innerHTML = '<div class="ud-shebao-empty">加载中…</div>';
            adminFetch(
                'api/admin/user-shebao-photos?username=' + encodeURIComponent(username)
            )
                .then(function (r) {
                    return (window.adminParseJson||function(r){return r.json();})(r);
                })
                .then(function (d) {
                    if (d.code !== 200 || !d.data) {
                        el.innerHTML =
                            '<div class="ud-shebao-empty">' +
                            esc(d.msg || '加载失败') +
                            '</div>';
                        return;
                    }
                    renderAdminShebaoPhotoItems(el, d.data.items || []);
                    var head = el.previousElementSibling;
                    if (head && /社保照片/.test(head.textContent || '')) {
                        head.textContent =
                            '社保照片（' + ((d.data.items || []).length) + '）';
                    }
                })
                .catch(function () {
                    el.innerHTML = '<div class="ud-shebao-empty">网络错误</div>';
                });
        }

        var userPage = 1;
        var USER_LIMIT_STORAGE_KEY = 'admin_user_list_limit';
        var USER_LIMIT_OPTIONS = [10, 20, 50, 100];
        var userLimit = 10;
        var deletedUserPage = 1;
        var deletedUserLimit = 10;
        var DELETED_USER_LIMIT_STORAGE_KEY = 'admin_deleted_user_list_limit';
        var peerAccountPage = 1;
        var peerAccountLimit = 10;
        var PEER_ACCOUNT_LIMIT_STORAGE_KEY = 'admin_peer_account_list_limit';
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
            var savedPeer = parseInt(localStorage.getItem(PEER_ACCOUNT_LIMIT_STORAGE_KEY), 10);
            if (USER_LIMIT_OPTIONS.indexOf(savedPeer) >= 0) {
                peerAccountLimit = savedPeer;
            }
            var selPeer = document.getElementById('peerAccountPageLimit');
            if (selPeer) {
                selPeer.value = String(peerAccountLimit);
            }
        })();
        var codePage = 1;
        var codeLimit = 8;
        var xianyuCodePage = 1;
        var xianyuCodeLimit = 8;
        var loginRecentPage = 1;
        var loginRecentLimit = 20;
        var adminOpLogPage = 1;
        var adminOpLogLimit = 20;
        var userLoginPage = 1;
        var userLoginLimit = 20;
        var currentAdminProfile = { username: '', full_name: '', is_super: false, is_root_admin: false, menus: [] };
        var adminMenuKeyList = [];
        var adminMenuDefsList = [];
        var userDataPage = 1;
        var userDataLimit = 15;
        /* 连续两次进入同一页时跳过（如登录后 applyAdminRoute 连调）；切走再回来会刷新 */
        var _adminDataHash = '';
        var _channelAnalysisChartInstances = [];

        var _renamePeerActiveTab = 'daily';

        function setRenamePeerTab(tab, opts) {
            opts = opts || {};
            var next = tab === 'peer' ? 'peer' : 'daily';
            _renamePeerActiveTab = next;
            var dailyPanel = document.getElementById('renamePeerTabDaily');
            var peerPanel = document.getElementById('renamePeerTabPeer');
            document.querySelectorAll('.rename-peer-tab').forEach(function (btn) {
                var on = btn.getAttribute('data-tab') === next;
                btn.classList.toggle('is-active', on);
                btn.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            if (dailyPanel) dailyPanel.hidden = next !== 'daily';
            if (peerPanel) peerPanel.hidden = next !== 'peer';
            if (opts.load !== false) {
                if (next === 'peer') loadPeerAccounts();
                else loadRenameTaxDaily();
            }
        }

        function canViewActivationCredit() {
            if (currentAdminProfile && currentAdminProfile.is_root_admin) return true;
            var name =
                currentAdminProfile && currentAdminProfile.username
                    ? String(currentAdminProfile.username).trim().toLowerCase()
                    : '';
            return name === 'admin';
        }

        function syncActivationCreditVisibility() {
            var show = canViewActivationCredit();
            document.querySelectorAll('.users-registry-table').forEach(function (table) {
                table.classList.toggle('show-activation-credit', show);
            });
            var wrap = document.getElementById('userActivateCreditWrap');
            if (wrap) {
                if (show) wrap.removeAttribute('hidden');
                else wrap.setAttribute('hidden', '');
            }
            document.querySelectorAll('.user-activate-credit-hint').forEach(function (el) {
                el.hidden = !show;
            });
        }

        function adminHasMenu(menuKey) {
            menuKey = String(menuKey || '');
            if (menuKey === 'peer-accounts') menuKey = 'rename-tax-daily';
            if (!menuKey) return false;
            if (currentAdminProfile && currentAdminProfile.is_super) return true;
            if (menuKey === 'codes' && currentAdminProfile) return true;
            var menus = currentAdminProfile && Array.isArray(currentAdminProfile.menus) ? currentAdminProfile.menus : [];
            if (menus.indexOf(menuKey) >= 0) return true;
            if (menuKey === 'rename-tax-daily' && menus.indexOf('peer-accounts') >= 0) return true;
            if (menuKey.indexOf('analytics-') === 0 && menus.indexOf('analytics') >= 0) return true;
            if (menuKey.indexOf('insights-') === 0 && menus.indexOf('analytics') >= 0) return true;
            /* hub 合并：有子页权限也可进 hub；有 hub 也可进子页 */
            var hubAlias = {
                settings: ['install-guide', 'appearance'],
                'ops-board': ['ops-ad-analytics', 'payment-orders', 'ops-research', 'ops-lift', 'abc-ops'],
                users: ['rename-tax-daily', 'user-emails', 'users-deleted', 'user-data', 'tax-records-edit', 'peer-accounts'],
                'lizhi-cert': ['zaizhi-cert'],
                'sbdy-demo': ['gjj-demo', 'lizhi-cert', 'zaizhi-cert', 'ccb-flow', 'najilu-qr'],
                'login-log': ['user-login-log', 'admin-accounts', 'downline-admins', 'admin-operation-log', 'server-monitor', 'blocked-ips'],
                'insights-product': [
                    'analytics-activity',
                    'analytics-devices',
                    'tax-fill-survey',
                    'feedback',
                    'feature-survey',
                    'insights-growth',
                    'channel-analysis',
                    'install-guide-stats',
                    'ops-inactive',
                    'analytics-purchase'
                ],
                'insights-growth': ['ops-inactive', 'channel-analysis', 'install-guide-stats'],
                'abc-ops': ['abc-users', 'abc-install-stats']
            };
            if (hubAlias[menuKey]) {
                for (var hi = 0; hi < hubAlias[menuKey].length; hi++) {
                    if (menus.indexOf(hubAlias[menuKey][hi]) >= 0) return true;
                }
            }
            var contentHub = {
                'install-guide': 'settings',
                appearance: 'settings',
                'ops-ad-analytics': 'ops-board',
                codes: 'ops-board',
                'payment-orders': 'ops-board',
                'rename-tax-daily': 'users',
                'user-emails': 'users',
                'users-deleted': 'users',
                'user-data': 'users',
                'tax-records-edit': 'users',
                'zaizhi-cert': 'sbdy-demo',
                'lizhi-cert': 'sbdy-demo',
                'gjj-demo': 'sbdy-demo',
                'ccb-flow': 'sbdy-demo',
                'najilu-qr': 'sbdy-demo',
                'user-login-log': 'login-log',
                'admin-accounts': 'login-log',
                'downline-admins': 'login-log',
                'admin-operation-log': 'login-log',
                'server-monitor': 'login-log',
                'blocked-ips': 'login-log',
                'analytics-activity': 'insights-product',
                'analytics-devices': 'insights-product',
                'tax-fill-survey': 'insights-product',
                'feature-survey': 'insights-product',
                feedback: 'insights-product',
                'insights-growth': 'insights-product',
                'ops-inactive': 'insights-product',
                'channel-analysis': 'insights-product',
                'install-guide-stats': 'insights-product',
                'analytics-purchase': 'insights-product',
                'payment-orders': 'ops-board',
                'abc-install-stats': 'abc-ops',
                'abc-users': 'abc-ops',
                'abc-ops': 'ops-board' 
            };
            /* 独立 TAB：不因持有 hub 而判定有该页权限 */
            if (
                menuKey === 'blocked-ips' ||
                menuKey === 'server-monitor' ||
                menuKey === 'downline-admins' ||
                menuKey === 'admin-accounts' ||
                menuKey === 'admin-operation-log' ||
                menuKey === 'user-emails' ||
                menuKey === 'payment-orders'
            ) {
                return false;
            }
            if (contentHub[menuKey] && menus.indexOf(contentHub[menuKey]) >= 0) return true;
            if (menuKey === 'abc-install-stats' && menus.indexOf('install-guide-stats') >= 0) return true;
            if (
                (menuKey === 'abc-ops' || menuKey === 'abc-users' || menuKey === 'abc-install-stats') &&
                (menus.indexOf('insights-growth') >= 0 || menus.indexOf('install-guide-stats') >= 0)
            ) {
                return true;
            }
            /* 侧栏已渲染的页应可进入（避免 menus 缓存落后于 menu_tree） */
            try {
                var tree = window.AdminNav && AdminNav.getMenuTree ? AdminNav.getMenuTree() : [];
                for (var g = 0; g < tree.length; g++) {
                    var items = tree[g].items || [];
                    for (var i = 0; i < items.length; i++) {
                        if (items[i] && (items[i].page === menuKey || items[i].menu_key === menuKey)) {
                            return true;
                        }
                    }
                }
            } catch (e0) {}
            /* 侧栏按钮已画出时，勿因 allowlist/缓存落后把点击打回转化概览 */
            try {
                if (/^[a-z0-9-]+$/.test(menuKey)) {
                    var navBtn = document.querySelector('.nav-item[data-page="' + menuKey + '"]');
                    if (navBtn && navBtn.style.display !== 'none') return true;
                }
            } catch (e1) {}
            return false;
        }

        function firstAllowedAdminPage() {
            if (window._adminFirstPage) return window._adminFirstPage;
            var tree = window.AdminNav && AdminNav.getMenuTree ? AdminNav.getMenuTree() : [];
            for (var g = 0; g < tree.length; g++) {
                var items = tree[g].items || [];
                if (items.length && items[0].page) return items[0].page;
            }
            var order = [
                'ops-board',
                'abc-ops',
                'ops-inactive',
                'ops-ad-analytics',
                'codes',
                'ops-research',
                'ops-lift',
                'analytics-conversion',
                'analytics-purchase',
                'payment-orders',
                'settings',
                'channel-analysis',
                'install-guide',
                'install-guide-stats',
                'users',
                'peer-accounts',
                'rename-tax-daily',
                'users-deleted',
                'user-data',
                'tax-records-edit',
                'analytics-activity',
                'feature-survey',
                'tax-fill-survey',
                'feedback',
                'analytics-devices',
                'appearance',
                'admin-accounts',
                'downline-admins',
                'login-log',
                'admin-operation-log',
                'user-login-log',
                'server-monitor'
            ];
            for (var i = 0; i < order.length; i++) {
                if (adminHasMenu(order[i])) return order[i];
            }
            return 'analytics-conversion';
        }

        function sanitizeAdminMenus(menus, isSuper) {
            if (!Array.isArray(menus)) return [];
            var out = [];
            menus.forEach(function (m) {
                var key = String(m || '');
                if (!key) return;
                if (key === 'analytics-register') {
                    key = 'install-guide-stats';
                }
                if (key === 'analytics-tracking') {
                    key = 'analytics-purchase';
                }
                if (out.indexOf(key) < 0) out.push(key);
            });
            if (out.indexOf('codes') < 0) out.push('codes');
            if (!isSuper) {
                out = out.filter(function (k) {
                    return k !== 'payment-orders';
                });
            }
            return out;
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
                    is_root_admin: !!parsed.is_root_admin,
                    menus: sanitizeAdminMenus(parsed.menus, !!parsed.is_super)
                };
            } catch (e) {}
        }

        function applyMenuVisibility() {
            var navEl = document.getElementById('adminSidebarNav');
            var tree = window.AdminNav && AdminNav.getMenuTree ? AdminNav.getMenuTree() : [];
            var active = String(location.hash || '').replace(/^#/, '') || firstAllowedAdminPage();
            var activeNav = active.indexOf('/') >= 0 ? active.slice(0, active.indexOf('/')) : active;
            if (ADMIN_CONTENT_TO_HUB[activeNav]) {
                activeNav = ADMIN_CONTENT_TO_HUB[activeNav].hub;
            }
            if (navEl && window.AdminNav && tree.length) {
                AdminNav.renderSidebar(navEl, tree, activeNav);
                AdminNav.bindNavClicks(navEl);
                initNavGroupCollapse();
            } else {
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
            var xianyuSection = document.getElementById('xianyuCodesSection');
            if (xianyuSection) {
                xianyuSection.style.display =
                    currentAdminProfile && currentAdminProfile.is_super ? '' : 'none';
            }
            var codesHint = document.getElementById('codesPageHint');
            if (codesHint) {
                if (currentAdminProfile && currentAdminProfile.is_super) {
                    codesHint.style.display = '';
                    codesHint.innerHTML =
                        '每个激活码仅可成功激活 1 个账号，用过后即失效，<strong>永不过期</strong>。下方<strong>渠道批量激活码</strong>可按渠道筛选；用户用渠道码激活后，在「注册用户 / 用户数据」中可查看<strong>渠道分析</strong>（注册来源 + 激活来源）。';
                    loadActivationBatchChannels();
                } else {
                    codesHint.style.display = 'none';
                    codesHint.textContent = '';
                }
            }
            syncActivationCreditVisibility();
            var codeListStat = document.getElementById('codeListStat');
            if (codeListStat) {
                codeListStat.style.display =
                    currentAdminProfile && currentAdminProfile.is_super ? '' : 'none';
                if (!(currentAdminProfile && currentAdminProfile.is_super)) {
                    codeListStat.textContent = '';
                }
            }
        }

        var ADMIN_HUB_DEFS = {
            /* 旧 hash 兼容 */
            'lizhi-cert': {
                nav: 'lizhi-cert',
                defaultTab: 'lizhi',
                tabs: [
                    { id: 'lizhi', label: '离职证明', page: 'lizhi-cert' },
                    { id: 'zaizhi', label: '在职证明', page: 'zaizhi-cert' }
                ]
            },
            'insights-growth': {
                nav: 'insights-growth',
                defaultTab: 'channel',
                tabs: [
                    { id: 'channel', label: '渠道分析', page: 'channel-analysis' },
                    { id: 'inactive', label: '未激活用户', page: 'ops-inactive' },
                    { id: 'install-stats', label: '安装统计', page: 'install-guide-stats' }
                ]
            },
            'abc-ops': {
                nav: 'abc-ops',
                defaultTab: 'funnel',
                tabs: [
                    { id: 'funnel', label: '转化', page: 'abc-ops' },
                    { id: 'users', label: '用户', page: 'abc-users' },
                    { id: 'install', label: '下载页', page: 'abc-install-stats' }
                ]
            },
            'ops-ad-analytics': {
                nav: 'ops-ad-analytics',
                defaultTab: 'config',
                tabs: [
                    { id: 'config', label: '配置', page: 'ops-ad-analytics' },
                    { id: 'data', label: '数据', page: 'ops-ad-analytics' },
                    { id: 'reach', label: '触达', page: 'ops-ad-analytics' }
                ]
            },
            settings: {
                nav: 'settings',
                defaultTab: 'pricing',
                tabs: [
                    { id: 'pricing', label: '定价与引导', page: 'settings' },
                    { id: 'install', label: '安装分发', page: 'install-guide' },
                    { id: 'appearance', label: '外观', page: 'appearance' }
                ]
            },
            'ops-board': {
                nav: 'ops-board',
                defaultTab: 'board',
                tabs: [
                    { id: 'board', label: '运营看板', page: 'ops-board' },
                    { id: 'ads', label: '广告页', page: 'ops-ad-analytics' },
                    { id: 'ads-data', label: '广告数据', page: 'ops-ad-analytics' },
                    { id: 'ads-reach', label: '广告触达', page: 'ops-ad-analytics' },
                    { id: 'codes', label: '激活码', page: 'codes' },
                    { id: 'orders', label: '订单检索', page: 'payment-orders', super_only: true },
                    { id: 'abc', label: 'ABC渠道', page: 'abc-ops' }
                ]
            },
            users: {
                nav: 'users',
                defaultTab: 'list',
                tabs: [
                    { id: 'list', label: '注册用户', page: 'users' },
                    { id: 'rename', label: '同行 · 高频改名', page: 'rename-tax-daily' },
                    { id: 'emails', label: '邮箱管理', page: 'user-emails' },
                    { id: 'deleted', label: '已删除', page: 'users-deleted' },
                    { id: 'data', label: '用户数据', page: 'user-data' },
                    { id: 'tax', label: '个税维护', page: 'tax-records-edit' }
                ]
            },
            'sbdy-demo': {
                nav: 'sbdy-demo',
                defaultTab: 'sbdy',
                tabs: [
                    { id: 'sbdy', label: '社保演示', page: 'sbdy-demo' },
                    { id: 'gjj', label: '公积金演示', page: 'gjj-demo' },
                    { id: 'lizhi', label: '离职证明', page: 'lizhi-cert' },
                    { id: 'zaizhi', label: '在职证明', page: 'zaizhi-cert' },
                    { id: 'ccb', label: '工资流水', page: 'ccb-flow' },
                    { id: 'najilu', label: '完税二维码', page: 'najilu-qr' }
                ]
            },
            'insights-product': {
                nav: 'insights-product',
                defaultTab: 'activity',
                tabs: [
                    { id: 'activity', label: '用户活跃', page: 'analytics-activity' },
                    { id: 'devices', label: '机型', page: 'analytics-devices' },
                    { id: 'features', label: '功能调研', page: 'feature-survey' },
                    { id: 'survey', label: '填写调研', page: 'tax-fill-survey' },
                    { id: 'feedback', label: '兼容反馈', page: 'feedback' },
                    { id: 'channel', label: '渠道分析', page: 'channel-analysis' },
                    { id: 'inactive', label: '未激活用户', page: 'ops-inactive' },
                    { id: 'install-stats', label: '安装统计', page: 'install-guide-stats' },
                    { id: 'purchase', label: '支付分析', page: 'analytics-purchase' }
                ]
            },
            'login-log': {
                nav: 'login-log',
                defaultTab: 'admin',
                tabs: [
                    { id: 'accounts', label: '账号权限', page: 'admin-accounts' },
                    { id: 'downline', label: '下线管理员', page: 'downline-admins' },
                    { id: 'admin', label: '管理登录', page: 'login-log' },
                    { id: 'op-log', label: '操作日志', page: 'admin-operation-log' },
                    { id: 'user', label: '用户登录', page: 'user-login-log' },
                    { id: 'monitor', label: '监控', page: 'server-monitor' },
                    { id: 'ip', label: 'IP 黑名单', page: 'blocked-ips' }
                ]
            }
        };
        var ADMIN_CONTENT_TO_HUB = {};
        function rebuildAdminHubMaps() {
            ADMIN_CONTENT_TO_HUB = {};
            Object.keys(ADMIN_HUB_DEFS).forEach(function (hub) {
                ADMIN_HUB_DEFS[hub].tabs.forEach(function (t) {
                    ADMIN_CONTENT_TO_HUB[t.page] = { hub: hub, tab: t.id };
                });
            });
        }
        rebuildAdminHubMaps();
        if (window.AdminNav && typeof AdminNav.setHubs === 'function') {
            AdminNav.setHubs(ADMIN_HUB_DEFS);
        }
        var _adminRouteState = { hub: null, tab: null, contentPage: '', navKey: '' };

        function parseAdminRouteClient(raw) {
            var full = String(raw || '')
                .replace(/^#/, '')
                .trim()
                .toLowerCase();
            var slash = full.indexOf('/');
            var head = slash >= 0 ? full.slice(0, slash) : full;
            var tabPart = slash >= 0 ? full.slice(slash + 1).replace(/\/+$/, '') : '';
            if (head === 'peer-accounts') {
                _renamePeerActiveTab = 'peer';
                head = 'rename-tax-daily';
            }
            if (head === 'system' || head === 'setting') head = 'settings';
            if (head === 'install' || head === 'guide') head = 'install-guide';
            if (head === 'analytics' || head === 'analytics-conversion') head = 'ops-board';
            if (head === 'ops-research' || head === 'ops-lift') head = 'ops-board';
            if (head === 'analytics-register') head = 'install-guide-stats';
            if (head === 'analytics-tracking') head = 'analytics-purchase';
            if (head === 'insights-growth' && tabPart === 'abc') {
                head = 'abc-ops';
                tabPart = 'install';
            }

            if (ADMIN_HUB_DEFS[head]) {
                var hubDef = ADMIN_HUB_DEFS[head];
                var tabId = tabPart || hubDef.defaultTab;
                var tab = null;
                for (var i = 0; i < hubDef.tabs.length; i++) {
                    if (hubDef.tabs[i].id === tabId) {
                        tab = hubDef.tabs[i];
                        break;
                    }
                }
                if (!tab) tab = hubDef.tabs[0];
                /* 无权限 TAB：落到该 hub 第一个可见 TAB */
                if (!adminCanSeeHubTab(head, tab.page)) {
                    var visibleTabs = listVisibleHubTabs(head);
                    tab = visibleTabs.length ? visibleTabs[0] : tab;
                }
                return {
                    page: head,
                    hub: head,
                    tab: tab.id,
                    contentPage: tab.page,
                    hash: tab.id === hubDef.defaultTab ? head : head + '/' + tab.id
                };
            }
            var mapped = ADMIN_CONTENT_TO_HUB[head];
            if (mapped) {
                var hDef = ADMIN_HUB_DEFS[mapped.hub];
                /* 深链到无权限子页时，改到该 hub 可见 TAB */
                if (!adminCanSeeHubTab(mapped.hub, head)) {
                    var altTabs = listVisibleHubTabs(mapped.hub);
                    if (altTabs.length) {
                        var alt = altTabs[0];
                        return {
                            page: mapped.hub,
                            hub: mapped.hub,
                            tab: alt.id,
                            contentPage: alt.page,
                            hash: alt.id === hDef.defaultTab ? mapped.hub : mapped.hub + '/' + alt.id
                        };
                    }
                }
                var hHash =
                    mapped.tab === hDef.defaultTab ? mapped.hub : mapped.hub + '/' + mapped.tab;
                return {
                    page: mapped.hub,
                    hub: mapped.hub,
                    tab: mapped.tab,
                    contentPage: head,
                    hash: hHash
                };
            }
            return { page: head, hub: null, tab: null, contentPage: head, hash: head };
        }

        function normalizeAdminPage(raw) {
            var parsed = parseAdminRouteClient(raw);
            var content = parsed.contentPage || parsed.page;
            var navKey = parsed.hub || content;
            var ok =
                !content ||
                document.getElementById(adminPagePanelId(content)) ||
                document.getElementById(adminPagePanelId(navKey)) ||
                ADMIN_HUB_DEFS[navKey];
            if (!ok || (!adminHasMenu(navKey) && !adminHasMenu(content))) {
                return firstAllowedAdminPage();
            }
            return parsed.hash || content;
        }

        function adminPagePanelId(pageKey) {
            if (pageKey === 'downline-admins') return 'page-admin-accounts';
            if (pageKey === 'peer-accounts') return 'page-rename-tax-daily';
            if (pageKey === 'insights-product' || pageKey === 'insights-growth') {
                /* hub 壳：实际展示 content 子页 */
                return 'page-' + pageKey;
            }
            return 'page-' + pageKey;
        }

        function canOpenAdminAccountsPage() {
            return adminHasMenu('admin-accounts') || adminHasMenu('downline-admins');
        }

        /** 精确菜单（不含 hub 别名继承），超管除外 */
        function adminHasExactMenu(menuKey) {
            menuKey = String(menuKey || '');
            if (!menuKey) return false;
            if (currentAdminProfile && currentAdminProfile.is_super) return true;
            if (menuKey === 'codes' && currentAdminProfile) return true;
            var menus = currentAdminProfile && Array.isArray(currentAdminProfile.menus) ? currentAdminProfile.menus : [];
            return menus.indexOf(menuKey) >= 0;
        }

        /**
         * hub TAB 按账号勾选的精确权限显示：
         * - 转化运营：运营看板 / 广告 / ABC 需各自或看板权限；激活码必选；订单检索仅超管
         * - 用户管理：邮箱管理独立勾选，不因有注册用户而出现
         * - 系统与安全：账号权限 / 操作日志仅超管；其余 TAB 精确授权
         */
        function adminCanSeeHubTab(hubKey, tabPage) {
            tabPage = String(tabPage || '');
            if (!tabPage) return false;
            if (hubKey === 'ops-board') {
                if (tabPage === 'ops-board') return adminHasExactMenu('ops-board');
                if (tabPage === 'ops-ad-analytics') {
                    return adminHasExactMenu('ops-ad-analytics') || adminHasExactMenu('ops-board');
                }
                if (tabPage === 'codes') return adminHasExactMenu('codes');
                if (tabPage === 'payment-orders') {
                    return !!(currentAdminProfile && currentAdminProfile.is_super);
                }
                if (tabPage === 'abc-ops') {
                    return adminHasExactMenu('abc-ops') || adminHasExactMenu('ops-board');
                }
                return adminHasMenu(tabPage);
            }
            if (hubKey === 'users') {
                if (tabPage === 'user-emails') return adminHasExactMenu('user-emails');
                return adminHasMenu(tabPage);
            }
            if (hubKey !== 'login-log') {
                return adminHasMenu(tabPage);
            }
            if (tabPage === 'admin-accounts' || tabPage === 'admin-operation-log') {
                return !!(currentAdminProfile && currentAdminProfile.is_super);
            }
            if (tabPage === 'downline-admins') {
                if (currentAdminProfile && currentAdminProfile.is_super) return false;
                return adminHasExactMenu('downline-admins');
            }
            if (tabPage === 'login-log') {
                return adminHasExactMenu('login-log');
            }
            if (tabPage === 'user-login-log') {
                return adminHasExactMenu('user-login-log') || adminHasExactMenu('login-log');
            }
            if (tabPage === 'server-monitor') {
                return adminHasExactMenu('server-monitor');
            }
            if (tabPage === 'blocked-ips') {
                return adminHasExactMenu('blocked-ips');
            }
            return adminHasMenu(tabPage);
        }

        function listVisibleHubTabs(hubKey) {
            var hubDef = ADMIN_HUB_DEFS[hubKey];
            if (!hubDef || !Array.isArray(hubDef.tabs)) return [];
            return hubDef.tabs.filter(function (t) {
                if (t && t.super_only && !(currentAdminProfile && currentAdminProfile.is_super)) {
                    return false;
                }
                return t && t.page && adminCanSeeHubTab(hubKey, t.page);
            });
        }
        window.adminCanSeeHubTab = adminCanSeeHubTab;
        window.adminHasExactMenu = adminHasExactMenu;

        function ensureAdminHubTabs(panelEl, hubKey, activeTab) {
            if (!panelEl || !hubKey || !ADMIN_HUB_DEFS[hubKey]) return;
            var hubDef = ADMIN_HUB_DEFS[hubKey];
            var bar = null;
            for (var ci = 0; ci < panelEl.children.length; ci++) {
                if (panelEl.children[ci].classList && panelEl.children[ci].classList.contains('admin-hub-tabs')) {
                    bar = panelEl.children[ci];
                    break;
                }
            }
            if (!bar) {
                bar = document.createElement('div');
                bar.className = 'admin-hub-tabs';
                bar.setAttribute('role', 'tablist');
                panelEl.insertBefore(bar, panelEl.firstChild);
            }
            var visible = listVisibleHubTabs(hubKey);
            if (!visible.length) {
                bar.innerHTML = '';
                return;
            }
            var active = activeTab;
            var activeOk = false;
            for (var ai = 0; ai < visible.length; ai++) {
                if (visible[ai].id === active) {
                    activeOk = true;
                    break;
                }
            }
            if (!activeOk) active = visible[0].id;
            bar.innerHTML = visible
                .map(function (t) {
                    var isOn = t.id === active ? ' is-active' : '';
                    return (
                        '<button type="button" class="admin-hub-tab' +
                        isOn +
                        '" role="tab" data-hub="' +
                        hubKey +
                        '" data-tab="' +
                        t.id +
                        '" aria-selected="' +
                        (t.id === active ? 'true' : 'false') +
                        '">' +
                        t.label +
                        '</button>'
                    );
                })
                .join('');
        }

        function applyAdminRouteChrome(pageKey, routeState) {
            routeState = routeState || _adminRouteState;
            var contentPage = (routeState && routeState.contentPage) || pageKey;
            var navPageKey =
                (routeState && routeState.navKey) ||
                (routeState && routeState.hub) ||
                (pageKey === 'peer-accounts' ? 'rename-tax-daily' : pageKey);
            var panelId = adminPagePanelId(contentPage);
            /* insights hub 无独立内容时用子页 panel */
            if (
                (contentPage === 'insights-product' || contentPage === 'insights-growth') &&
                routeState &&
                routeState.contentPage &&
                routeState.contentPage !== contentPage
            ) {
                panelId = adminPagePanelId(routeState.contentPage);
            }
            if (!document.getElementById(panelId) && routeState && routeState.contentPage) {
                panelId = adminPagePanelId(routeState.contentPage);
            }
            document.querySelectorAll('.page-panel').forEach(function (el) {
                var on = el.id === panelId;
                el.classList.toggle('active', on);
                if (on) el.removeAttribute('hidden');
                else el.setAttribute('hidden', '');
            });
            document.querySelectorAll('.nav-item').forEach(function (btn) {
                btn.classList.toggle('active', btn.getAttribute('data-page') === navPageKey);
            });
            if (window.AdminNav && typeof AdminNav.setActivePage === 'function') {
                AdminNav.setActivePage(navPageKey);
            }
            var activePanel = document.getElementById(panelId);
            if (routeState && routeState.hub && activePanel) {
                ensureAdminHubTabs(activePanel, routeState.hub, routeState.tab);
            } else if (activePanel) {
                var stale = null;
                for (var si = 0; si < activePanel.children.length; si++) {
                    if (
                        activePanel.children[si].classList &&
                        activePanel.children[si].classList.contains('admin-hub-tabs')
                    ) {
                        stale = activePanel.children[si];
                        break;
                    }
                }
                if (stale) stale.remove();
            }
            var navBtn = document.querySelector('.nav-item[data-page="' + navPageKey + '"]');
            var titleEl = document.getElementById('pageTitle');
            if (titleEl && routeState && routeState.hub && ADMIN_HUB_DEFS[routeState.hub]) {
                var hubTabs = ADMIN_HUB_DEFS[routeState.hub].tabs || [];
                var titleTab = null;
                for (var ti = 0; ti < hubTabs.length; ti++) {
                    if (hubTabs[ti].id === routeState.tab) {
                        titleTab = hubTabs[ti];
                        break;
                    }
                }
                titleEl.textContent =
                    (titleTab && titleTab.label) ||
                    ADMIN_MENU_LABELS[routeState.hub] ||
                    (navBtn && navBtn.getAttribute('data-title')) ||
                    '管理控制台';
            } else if (titleEl && navBtn) {
                titleEl.textContent = navBtn.getAttribute('data-title') || '管理控制台';
            } else if (titleEl && routeState && routeState.hub && ADMIN_MENU_LABELS[routeState.hub]) {
                titleEl.textContent = ADMIN_MENU_LABELS[routeState.hub];
            } else if (titleEl) {
                titleEl.textContent = '管理控制台';
            }
        }

        function callAdminModuleLoadPage(key) {
            var mod = window.AdminModules && window.AdminModules[key];
            if (mod && typeof mod.loadPage === 'function') {
                mod.loadPage();
                return true;
            }
            return false;
        }

        function refreshAdminPageData(pageKey) {
            if (pageKey === 'settings' || pageKey === 'appearance' || pageKey === 'install-guide') {
                loadAdminSettings();
                if (pageKey === 'install-guide') {
                    loadAgentChannels();
                }
            }
            if (pageKey === 'users') {
                loadUsers();
            }
            if (pageKey === 'rename-tax-daily') {
                setRenamePeerTab(_renamePeerActiveTab);
            }
            if (pageKey === 'users-deleted') {
                loadDeletedUsers();
            }
            if (pageKey === 'user-data') {
                loadUserDataList();
            }
            if (pageKey === 'codes') {
                loadCodes();
                if (currentAdminProfile && currentAdminProfile.is_super) {
                    loadXianyuCodes();
                }
            }
            if (pageKey === 'admin-accounts' || pageKey === 'downline-admins') {
                loadAdminAccounts();
            }
            if (pageKey === 'ops-board' || pageKey === 'ops-inactive') {
                callAdminModuleLoadPage('ops-conversion');
            }
            if (pageKey === 'user-emails') {
                callAdminModuleLoadPage('user-emails');
            }
            if (pageKey === 'ops-ad-analytics') {
                callAdminModuleLoadPage('ad-analytics');
            }
            if (pageKey === 'tax-fill-survey') {
                callAdminModuleLoadPage('tax-fill-survey');
            }
            if (pageKey === 'feature-survey') {
                callAdminModuleLoadPage('feature-survey');
            }
            if (pageKey === 'payment-orders') {
                callAdminModuleLoadPage('payment-orders');
            }
            if (pageKey === 'feedback') {
                callAdminModuleLoadPage('feedback');
            }
            if (pageKey === 'analytics-activity') {
                loadAnalyticsActivityPage();
            }
            if (pageKey === 'analytics-purchase') {
                loadAnalyticsPurchasePage();
            }
            if (pageKey === 'analytics-devices') {
                if (typeof loadAnalyticsDevicesPage === 'function') {
                    loadAnalyticsDevicesPage();
                } else {
                    callAdminModuleLoadPage('devices');
                }
            }
            if (pageKey === 'install-guide-stats') {
                loadInstallGuideStats();
            }
            if (pageKey === 'abc-ops' || pageKey === 'abc-users') {
                callAdminModuleLoadPage('abc-ops');
            }
            if (pageKey === 'abc-install-stats') {
                loadAbcInstallStats();
            }
            if (pageKey === 'tax-records-edit') {
                initTaxRecordsEditPage();
            }
            if (pageKey === 'channel-analysis') {
                loadChannelAnalysis();
            }
            if (pageKey === 'server-monitor') {
                loadServerMonitor();
            }
            if (pageKey === 'blocked-ips') {
                loadBlockedIps();
            }
            if (pageKey === 'sbdy-demo') {
                if (typeof loadSbdyDemoPage === 'function') {
                    loadSbdyDemoPage();
                } else {
                    callAdminModuleLoadPage('sbdy-demo');
                }
            }
            if (pageKey === 'gjj-demo') {
                if (typeof loadGjjDemoPage === 'function') {
                    loadGjjDemoPage();
                } else {
                    callAdminModuleLoadPage('gjj-demo');
                }
            }
            if (pageKey === 'lizhi-cert') {
                callAdminModuleLoadPage('lizhi-cert');
            }
            if (pageKey === 'zaizhi-cert') {
                callAdminModuleLoadPage('zaizhi-cert');
            }
            if (pageKey === 'ccb-flow') {
                callAdminModuleLoadPage('ccb-flow');
            }
            if (pageKey === 'najilu-qr') {
                callAdminModuleLoadPage('najilu-qr');
            }
            if (pageKey === 'login-log') {
                loginRecentPage = 1;
                var sz = document.getElementById('loginLogPageSize');
                if (sz) {
                    loginRecentLimit = parseInt(sz.value, 10) || 20;
                }
                loadLoginRecentPage(1);
            }
            if (pageKey === 'admin-operation-log') {
                adminOpLogPage = 1;
                var opSz = document.getElementById('adminOpLogPageSize');
                if (opSz) {
                    adminOpLogLimit = parseInt(opSz.value, 10) || 20;
                }
                loadAdminOperationLogPage(1);
            }
            if (pageKey === 'user-login-log') {
                userLoginPage = 1;
                var usz = document.getElementById('userLoginLogPageSize');
                if (usz) {
                    userLoginLimit = parseInt(usz.value, 10) || 20;
                }
                loadUserLoginRecentPage(1);
            }
        }

        function applyAdminRoute(opts) {
            var force = !!(opts && opts.force === true);
            var rawHash = String(location.hash || '').replace(/^#/, '').trim().toLowerCase();
            var preferred = opts && opts.page ? String(opts.page).replace(/^#/, '').trim().toLowerCase() : '';
            var parsed = parseAdminRouteClient(preferred || rawHash || firstAllowedAdminPage());
            if (!adminHasMenu(parsed.hub || parsed.contentPage) && !adminHasMenu(parsed.contentPage)) {
                parsed = parseAdminRouteClient(firstAllowedAdminPage());
            }
            var contentPage = parsed.contentPage || parsed.page;
            var navKey = parsed.hub || contentPage;
            if (navKey === 'peer-accounts') navKey = 'rename-tax-daily';
            _adminRouteState = {
                hub: parsed.hub,
                tab: parsed.tab,
                contentPage: contentPage,
                navKey: navKey,
                hash: parsed.hash
            };
            var canonical = parsed.hash || contentPage;
            if (canonical && location.hash !== '#' + canonical) {
                try {
                    history.replaceState(null, '', '#' + canonical);
                } catch (eHash) {
                    location.hash = canonical;
                }
            }
            applyAdminRouteChrome(contentPage, _adminRouteState);
            if (!force && contentPage === _adminDataHash && parsed.tab === _adminDataTab) {
                return;
            }
            _adminDataHash = contentPage;
            _adminDataTab = parsed.tab || '';
            function runRouteBody() {
                applyAdminRouteChrome(contentPage, _adminRouteState);
                refreshAdminPageData(contentPage);
            }
            function safeRunRouteBody() {
                try {
                    runRouteBody();
                } catch (err) {
                    console.error('applyAdminRoute', contentPage, err);
                }
            }
            if (window.AdminLoader && AdminLoader.ensureForPage) {
                AdminLoader.ensureForPage(contentPage).then(safeRunRouteBody).catch(function (e) {
                    console.error('AdminLoader', e);
                    safeRunRouteBody();
                });
            } else {
                safeRunRouteBody();
            }
        }

        var _adminDataTab = '';

        /* ========== API Analytics ========== */

        var D1_BULK_TITLE = '昨天回来过，开通后可完整使用';
        var D1_BULK_BODY =
            '您好，看到您注册后次日仍有使用。开通后可去除水印，完整查看收入纳税明细并导出证明。点击下方「前往激活」即可开通。';

        function applyD1BulkDefaultCopy() {
            var titleEl = document.getElementById('bulkMsgTitle');
            var bodyEl = document.getElementById('bulkMsgContent');
            if (titleEl) titleEl.value = D1_BULK_TITLE;
            if (bodyEl) bodyEl.value = D1_BULK_BODY;
        }


        var HIGH_INCOME_BULK_TITLE = '您填写的收入明细开通后可完整查看';
        var HIGH_INCOME_BULK_BODY =
            '您好，看到您已填写较高收入的税务记录。开通后可去除水印，完整查看收入纳税明细并导出证明。点击下方「前往激活」即可开通。';
        var HAS_TAX_BULK_TITLE = '税务记录已生成，开通后可去水印导出';
        var HAS_TAX_BULK_BODY =
            '您好，看到您已生成税务记录。开通卖的是去水印和完整导出，不是再填一遍。没有免费激活码，付款后自动开通。点击下方「前往激活」即可开通。';
        var SAW_PAY_BULK_TITLE = '开通后即可去掉水印';
        var SAW_PAY_BULK_BODY =
            '您好，看到您看过开通方案但还未付款。开通后去除水印，完整查看收入纳税明细并导出证明。没有免费激活码。点击下方「前往激活」即可开通。';
        var REFUND_ELIGIBLE_BULK_TITLE = '你近三年缴税较高，可看是否符合二次退税';
        var REFUND_ELIGIBLE_BULK_BODY =
            '您好，根据您填写的 2023–2025 年记录，已缴税额或年收入已达到二次退税咨询门槛。可打开页面对照并复制微信号，备注「二次退税」。不强制添加。';

        function applyHasTaxBulkDefaultCopy() {
            var titleEl = document.getElementById('bulkMsgTitle');
            var bodyEl = document.getElementById('bulkMsgContent');
            if (titleEl) titleEl.value = HAS_TAX_BULK_TITLE;
            if (bodyEl) bodyEl.value = HAS_TAX_BULK_BODY;
        }

        function applySawPayBulkDefaultCopy() {
            var titleEl = document.getElementById('bulkMsgTitle');
            var bodyEl = document.getElementById('bulkMsgContent');
            if (titleEl) titleEl.value = SAW_PAY_BULK_TITLE;
            if (bodyEl) bodyEl.value = SAW_PAY_BULK_BODY;
        }

        function applyHighIncomeBulkDefaultCopy() {
            var titleEl = document.getElementById('bulkMsgTitle');
            var bodyEl = document.getElementById('bulkMsgContent');
            if (titleEl) titleEl.value = HIGH_INCOME_BULK_TITLE;
            if (bodyEl) bodyEl.value = HIGH_INCOME_BULK_BODY;
        }

        function applyRefundEligibleBulkDefaultCopy() {
            var titleEl = document.getElementById('bulkMsgTitle');
            var bodyEl = document.getElementById('bulkMsgContent');
            var linkEl = document.getElementById('bulkMsgLink');
            var skipEl = document.getElementById('bulkMsgSkipSent');
            if (titleEl) titleEl.value = REFUND_ELIGIBLE_BULK_TITLE;
            if (bodyEl) bodyEl.value = REFUND_ELIGIBLE_BULK_BODY;
            if (linkEl) linkEl.value = 'refund_ad.html?from=msg_refund';
            if (skipEl) skipEl.checked = false;
        }



        function loadInstallRegisterAnalysis() {
            loadAnalyticsRegisterPlatform();
            loadAnalyticsRegisterTime();
        }

        var PURCHASE_USERS_PAGE_LIMIT = 20;

        function purchaseDateDomKey(dateStr) {
            return String(dateStr || '').replace(/[^0-9]/g, '');
        }

        function renderPurchaseUsersPanel(box, dateStr, data) {
            if (!box) return;
            var users = Array.isArray(data.users) ? data.users : [];
            var page = Number(data.page) || 1;
            var total = Number(data.total) || 0;
            var totalPages = Math.max(1, Number(data.total_pages) || 1);
            var orderCount = data.order_count != null ? data.order_count : null;
            var gmv = data.gmv != null ? data.gmv : null;
            box.setAttribute('data-date', dateStr);
            box.setAttribute('data-page', String(page));
            box.setAttribute('data-loaded', '1');
            var html = '<div class="dau-users-panel">';
            html +=
                '<div class="dau-users-title">' +
                esc(dateStr) +
                ' 付款详情（' +
                total +
                ' 人' +
                (orderCount != null ? ' · ' + orderCount + ' 单' : '') +
                (gmv != null ? ' · ¥' + gmv : '') +
                '）</div>';
            if (!users.length) {
                html += '<p class="hint">当日暂无已付订单</p>';
            } else {
                html += '<ul class="dau-users-list">';
                users.forEach(function (u) {
                    var payments = Array.isArray(u.payments) ? u.payments : [];
                    var parts = payments.map(function (p) {
                        var label = p.label || p.sku_id || '其他';
                        var amt = '¥' + (p.amount != null ? p.amount : 0);
                        var t = p.paid_at ? formatDt(p.paid_at) : '';
                        return label + ' ' + amt + (t ? ' · ' + t : '');
                    });
                    html +=
                        '<li><strong class="cell-break">' +
                        esc(u.username || '—') +
                        '</strong> · 合计 ¥' +
                        esc(String(u.total_amount != null ? u.total_amount : 0)) +
                        (u.order_count ? ' · ' + esc(String(u.order_count)) + ' 单' : '') +
                        (parts.length
                            ? '<div class="hint mt-0 mb-0" style="font-size:12px;">' +
                              esc(parts.join(' · ')) +
                              '</div>'
                            : '') +
                        '</li>';
                });
                html += '</ul>';
            }
            if (totalPages > 1) {
                html +=
                    '<div class="dau-users-pager">' +
                    '<button type="button" class="btn-sm purchase-users-prev" data-date="' +
                    esc(dateStr) +
                    '"' +
                    (page <= 1 ? ' disabled' : '') +
                    '>上一页</button> ' +
                    '<span>' +
                    page +
                    ' / ' +
                    totalPages +
                    '</span> ' +
                    '<button type="button" class="btn-sm purchase-users-next" data-date="' +
                    esc(dateStr) +
                    '"' +
                    (page >= totalPages ? ' disabled' : '') +
                    '>下一页</button></div>';
            }
            html += '</div>';
            box.innerHTML = html;
        }

        /* ========== Analytics — Purchase Page Stats ========== */
        function loadPurchaseUsersForDate(dateStr, page, box) {
            if (!box) return;
            box.removeAttribute('data-loaded');
            box.innerHTML = '<div class="dau-users-panel" style="color:#888;">加载中…</div>';
            adminFetch(
                'api/admin/analytics/purchase-events/users?date=' +
                    encodeURIComponent(dateStr) +
                    '&page=' +
                    encodeURIComponent(String(page || 1)) +
                    '&limit=' +
                    encodeURIComponent(String(PURCHASE_USERS_PAGE_LIMIT))
            )
                .then(function (r) {
                    return (window.adminParseJson||function(r){return r.json();})(r);
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        box.innerHTML =
                            '<div class="dau-users-panel" style="color:#c00;">' +
                            esc(j.msg || '加载失败') +
                            '</div>';
                        return;
                    }
                    renderPurchaseUsersPanel(box, dateStr, j.data);
                })
                .catch(function () {
                    box.innerHTML = '<div class="dau-users-panel" style="color:#c00;">网络错误</div>';
                });
        }

        /* ========== Analytics — Activity / DAU ========== */
        var DAU_USERS_PAGE_LIMIT = 10;

        function dauDateDomKey(dateStr) {
            return String(dateStr || '').replace(/[^0-9]/g, '');
        }

        function normalizeDauUserRow(item) {
            if (item != null && typeof item === 'object' && item.username != null) {
                var sameIp = Number(item.same_ip_count);
                return {
                    username: String(item.username),
                    ip: item.ip != null ? String(item.ip) : '',
                    same_ip_count: isFinite(sameIp) && sameIp > 0 ? sameIp : 1,
                    has_tax_records: !!(item.has_tax_records === true || item.has_tax_records === 1),
                    tax_modified_on_date: !!(
                        item.tax_modified_on_date === true || item.tax_modified_on_date === 1
                    )
                };
            }
            return {
                username: String(item == null ? '' : item),
                ip: '',
                same_ip_count: 1,
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

        function dauSameIpBadgeHtml(user) {
            var n = user && user.same_ip_count != null ? Number(user.same_ip_count) : 0;
            if (!isFinite(n) || n < 2) {
                return '';
            }
            return (
                '<span class="dau-tax-badge" style="background:#fff7ed;color:#c2410c;" title="同 IP 活跃账号数">同IP×' +
                n +
                '</span>'
            );
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

            var accountTotal = Number(data.account_total);
            var html = '<div class="dau-users-panel">';
            html +=
                '<div class="dau-users-title">' +
                esc(dateStr) +
                ' 活跃用户（按 IP 去重共 ' +
                total +
                ' 个' +
                (isFinite(accountTotal) && accountTotal > total
                    ? '，账号 ' + accountTotal + ' 个'
                    : '') +
                '；本页 ' +
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
                    var ipBadge = dauSameIpBadgeHtml(u);
                    html += '<div class="dau-user-item">';
                    html += '<span class="dau-user-name">' + n + '. ' + esc(u.username) + '</span>';
                    if (ipBadge) html += ipBadge;
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
                    return (window.adminParseJson||function(r){return r.json();})(r);
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

        function loadAnalyticsActivityPage() {
            var daysEl = document.getElementById('analyticsOverviewDays');
            var daysO = analyticsPeriodVal(daysEl);
            var dauTbody = document.getElementById('analyticsDauTbody');
            var loginTbody = document.getElementById('analyticsLoginTbody');
            var reasonTbody = document.getElementById('analyticsLoginReasonTbody');
            if (dauTbody) dauTbody.innerHTML = '<tr><td colspan="3">加载中…</td></tr>';
            if (loginTbody) loginTbody.innerHTML = '<tr><td colspan="3">加载中…</td></tr>';
            if (reasonTbody) reasonTbody.innerHTML = '<tr><td colspan="2">加载中…</td></tr>';
            adminFetch('api/admin/analytics/overview?days=' + encodeURIComponent(daysO))
                .then(function (r) {
                    return (window.adminParseJson||function(r){return r.json();})(r);
                })
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
                        if (dauTbody) {
                            dauTbody.innerHTML = dh || '<tr><td colspan="3">暂无数据</td></tr>';
                        }
                    } else if (dauTbody) {
                        dauTbody.innerHTML =
                            '<tr><td colspan="3">' + esc(ov.msg || '加载失败') + '</td></tr>';
                    }

                    if (ov.code === 200 && ov.data && ov.data.logins) {
                        var lh = '';
                        ov.data.logins.forEach(function (row) {
                            lh +=
                                '<tr><td>' +
                                esc(row.date) +
                                '</td><td>' +
                                esc(String(row.success)) +
                                '</td><td>' +
                                esc(String(row.fail)) +
                                '</td></tr>';
                        });
                        if (loginTbody) {
                            loginTbody.innerHTML = lh || '<tr><td colspan="3">暂无数据</td></tr>';
                        }
                    } else if (loginTbody) {
                        loginTbody.innerHTML = '<tr><td colspan="3">—</td></tr>';
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
                        if (reasonTbody) {
                            reasonTbody.innerHTML =
                                rh2 || '<tr><td colspan="2">暂无失败记录</td></tr>';
                        }
                    } else if (reasonTbody) {
                        reasonTbody.innerHTML = '<tr><td colspan="2">—</td></tr>';
                    }
                })
                .catch(function () {
                    if (dauTbody) dauTbody.innerHTML = '<tr><td colspan="3">网络错误</td></tr>';
                    if (loginTbody) loginTbody.innerHTML = '<tr><td colspan="3">网络错误</td></tr>';
                    if (reasonTbody) reasonTbody.innerHTML = '<tr><td colspan="2">网络错误</td></tr>';
                });
        }

        function loadAnalyticsPurchasePage() {
            var days = analyticsPeriodVal(document.getElementById('analyticsPurchaseDays'));
            var summaryEl = document.getElementById('analyticsPurchaseSummary');
            var cardsEl = document.getElementById('analyticsPurchaseFunnelCards');
            var funnelTbody = document.getElementById('analyticsPurchaseFunnelTbody');
            var productTbody = document.getElementById('analyticsPurchaseProductTbody');
            var summaryTbody = document.getElementById('analyticsPurchaseSummaryTbody');
            var dailyTbody = document.getElementById('analyticsPurchaseDailyTbody');
            var dailyHint = document.getElementById('analyticsPurchaseDailyHint');
            var surveyCardsEl = document.getElementById('analyticsPurchaseSurveyCards');
            var surveySentimentTbody = document.getElementById('analyticsPurchaseSurveySentimentTbody');
            var surveyPriceTbody = document.getElementById('analyticsPurchaseSurveyPriceTbody');
            var surveyRecentTbody = document.getElementById('analyticsPurchaseSurveyRecentTbody');
            if (summaryEl) summaryEl.textContent = '加载中…';
            if (cardsEl) cardsEl.innerHTML = '';
            if (surveyCardsEl) surveyCardsEl.innerHTML = '';
            if (funnelTbody) funnelTbody.innerHTML = '<tr><td colspan="7">加载中…</td></tr>';
            if (productTbody) productTbody.innerHTML = '<tr><td colspan="4">加载中…</td></tr>';
            if (summaryTbody) summaryTbody.innerHTML = '<tr><td colspan="3">加载中…</td></tr>';
            if (dailyTbody) dailyTbody.innerHTML = '<tr><td colspan="15">加载中…</td></tr>';
            if (surveySentimentTbody) {
                surveySentimentTbody.innerHTML = '<tr><td colspan="3">加载中…</td></tr>';
            }
            if (surveyPriceTbody) surveyPriceTbody.innerHTML = '<tr><td colspan="2">加载中…</td></tr>';
            if (surveyRecentTbody) surveyRecentTbody.innerHTML = '<tr><td colspan="5">加载中…</td></tr>';
            adminFetch('api/admin/analytics/purchase-events?days=' + encodeURIComponent(days))
                .then(function (r) {
                    return (window.adminParseJson||function(r){return r.json();})(r);
                })
                .then(function (res) {
                    if (!res || res.code !== 200 || !res.data) {
                        var msg = (res && res.msg) || '加载失败';
                        if (summaryEl) summaryEl.textContent = msg;
                        if (funnelTbody) {
                            funnelTbody.innerHTML = '<tr><td colspan="7">' + esc(msg) + '</td></tr>';
                        }
                        if (productTbody) {
                            productTbody.innerHTML = '<tr><td colspan="4">' + esc(msg) + '</td></tr>';
                        }
                        if (summaryTbody) {
                            summaryTbody.innerHTML = '<tr><td colspan="3">' + esc(msg) + '</td></tr>';
                        }
                        if (dailyTbody) {
                            dailyTbody.innerHTML = '<tr><td colspan="15">' + esc(msg) + '</td></tr>';
                        }
                        if (surveySentimentTbody) {
                            surveySentimentTbody.innerHTML =
                                '<tr><td colspan="3">' + esc(msg) + '</td></tr>';
                        }
                        if (surveyPriceTbody) {
                            surveyPriceTbody.innerHTML = '<tr><td colspan="2">' + esc(msg) + '</td></tr>';
                        }
                        if (surveyRecentTbody) {
                            surveyRecentTbody.innerHTML = '<tr><td colspan="5">' + esc(msg) + '</td></tr>';
                        }
                        return;
                    }
                    var data = res.data;
                    var funnel = data.funnel || {};
                    var pay = data.payments || {};
                    var adminAct = pay.admin_activation || {};
                    var adminActRows = Array.isArray(adminAct.by_admin) ? adminAct.by_admin : [];
                    var combinedGmv =
                        pay.combined_gmv != null
                            ? pay.combined_gmv
                            : (Number(pay.gmv) || 0) + (Number(pay.admin_activation_gmv) || 0);
                    var combinedActivationGmv =
                        pay.combined_activation_gmv != null
                            ? pay.combined_activation_gmv
                            : (Number(pay.activation_gmv) || 0) +
                              (Number(pay.admin_activation_gmv) || 0);
                    var survey = data.price_survey || {};
                    function surveySentimentLabel(key) {
                        var k = String(key || '').toLowerCase();
                        if (k === 'expensive') return '偏贵';
                        if (k === 'fair') return '合适';
                        if (k === 'cheap') return '偏便宜';
                        if (k === 'skipped') return '跳过';
                        return key || '—';
                    }
                    function renderPurchaseSurvey(surveyData) {
                        var s = surveyData || {};
                        if (surveyCardsEl) {
                            var surveyCards = [
                                ['总回应', s.total || 0],
                                ['正式提交', s.submitted || 0],
                                ['跳过', s.skipped || 0],
                                ['跳过率', (s.skipped_pct != null ? s.skipped_pct : 0) + '%'],
                                [
                                    '偏贵',
                                    (s.expensive || 0) +
                                        '（' +
                                        (s.expensive_pct != null ? s.expensive_pct : 0) +
                                        '%）'
                                ],
                                [
                                    '合适',
                                    (s.fair || 0) +
                                        '（' +
                                        (s.fair_pct != null ? s.fair_pct : 0) +
                                        '%）'
                                ],
                                [
                                    '偏便宜',
                                    (s.cheap || 0) +
                                        '（' +
                                        (s.cheap_pct != null ? s.cheap_pct : 0) +
                                        '%）'
                                ],
                                [
                                    '均价期望',
                                    s.avg_expected_price != null ? '¥' + s.avg_expected_price : '—'
                                ],
                                ['填了价位', s.with_expected_price || 0]
                            ];
                            var surveyCardsHtml = '';
                            surveyCards.forEach(function (c) {
                                surveyCardsHtml +=
                                    '<div class="user-data-stat-card"><div class="ud-label">' +
                                    esc(c[0]) +
                                    '</div><div class="ud-val">' +
                                    esc(String(c[1])) +
                                    '</div></div>';
                            });
                            surveyCardsEl.innerHTML = surveyCardsHtml;
                        }
                        if (surveySentimentTbody) {
                            var sentimentRows = [
                                ['偏贵', s.expensive || 0, s.expensive_pct],
                                ['合适', s.fair || 0, s.fair_pct],
                                ['偏便宜', s.cheap || 0, s.cheap_pct]
                            ];
                            if (!(s.submitted > 0)) {
                                surveySentimentTbody.innerHTML =
                                    '<tr><td colspan="3">区间内暂无正式提交</td></tr>';
                            } else {
                                var sentimentHtml = '';
                                sentimentRows.forEach(function (row) {
                                    sentimentHtml +=
                                        '<tr><td>' +
                                        esc(row[0]) +
                                        '</td><td><strong>' +
                                        esc(String(row[1])) +
                                        '</strong></td><td>' +
                                        esc(String(row[2] != null ? row[2] : 0)) +
                                        '%</td></tr>';
                                });
                                surveySentimentTbody.innerHTML = sentimentHtml;
                            }
                        }
                        if (surveyPriceTbody) {
                            var buckets = Array.isArray(s.expected_price_buckets)
                                ? s.expected_price_buckets
                                : [];
                            var withAny = buckets.some(function (b) {
                                return b && Number(b.count) > 0;
                            });
                            if (!withAny) {
                                surveyPriceTbody.innerHTML =
                                    '<tr><td colspan="2">区间内暂无心理价位</td></tr>';
                            } else {
                                var priceHtml = '';
                                buckets.forEach(function (b) {
                                    if (!b || !(Number(b.count) > 0)) return;
                                    priceHtml +=
                                        '<tr><td>' +
                                        esc(b.label || (b.price != null ? '¥' + b.price : '其他')) +
                                        '</td><td><strong>' +
                                        esc(String(b.count || 0)) +
                                        '</strong></td></tr>';
                                });
                                surveyPriceTbody.innerHTML =
                                    priceHtml || '<tr><td colspan="2">区间内暂无心理价位</td></tr>';
                            }
                        }
                        if (surveyRecentTbody) {
                            var recent = Array.isArray(s.recent) ? s.recent : [];
                            if (!recent.length) {
                                surveyRecentTbody.innerHTML =
                                    '<tr><td colspan="5">区间内暂无记录</td></tr>';
                            } else {
                                var recentHtml = '';
                                recent.forEach(function (row) {
                                    var t = '—';
                                    if (row.created_at) {
                                        var dt = new Date(row.created_at);
                                        t = isNaN(dt.getTime())
                                            ? String(row.created_at)
                                            : formatLocalDateTimeForExport(dt);
                                    }
                                    recentHtml +=
                                        '<tr><td>' +
                                        esc(t) +
                                        '</td><td>' +
                                        esc(row.username || '—') +
                                        '</td><td>' +
                                        esc(surveySentimentLabel(row.sentiment)) +
                                        '</td><td>' +
                                        esc(
                                            row.expected_price != null
                                                ? '¥' + row.expected_price
                                                : '—'
                                        ) +
                                        '</td><td>' +
                                        esc(row.skipped ? '跳过' : '提交') +
                                        '</td></tr>';
                                });
                                surveyRecentTbody.innerHTML = recentHtml;
                            }
                        }
                    }
                    try {
                        renderPurchaseSurvey(survey);
                    } catch (surveyRenderErr) {
                        console.error('purchase survey render', surveyRenderErr);
                        if (surveySentimentTbody) {
                            surveySentimentTbody.innerHTML =
                                '<tr><td colspan="3">调研统计渲染失败</td></tr>';
                        }
                        if (surveyPriceTbody) {
                            surveyPriceTbody.innerHTML =
                                '<tr><td colspan="2">调研统计渲染失败</td></tr>';
                        }
                        if (surveyRecentTbody) {
                            surveyRecentTbody.innerHTML =
                                '<tr><td colspan="5">调研统计渲染失败</td></tr>';
                        }
                    }
                    if (summaryEl) {
                        summaryEl.innerHTML =
                            analyticsPeriodHintHtml(data) +
                            '购买页浏览 UV <strong>' +
                            esc(String(funnel.view_uv || 0)) +
                            '</strong>；CTA 点击 UV <strong>' +
                            esc(String(funnel.pay_cta_uv || 0)) +
                            '</strong>；下单成功 UV <strong>' +
                            esc(String(funnel.order_create_ok_uv || 0)) +
                            '</strong>；支付成功 UV <strong>' +
                            esc(String(funnel.alipay_success_uv || 0)) +
                            '</strong>（浏览→支付 ' +
                            esc(String(funnel.view_to_pay_pct != null ? funnel.view_to_pay_pct : 0)) +
                            '%）；FAQ 展开 UV <strong>' +
                            esc(String(funnel.faq_expand_uv || 0)) +
                            '</strong>；离开调研「偏贵」 <strong>' +
                            esc(String(survey.expensive_pct != null ? survey.expensive_pct : 0)) +
                            '%</strong>（' +
                            esc(String(survey.expensive || 0)) +
                            '/' +
                            esc(String(survey.submitted || 0)) +
                            '，均价期望 ¥' +
                            esc(
                                String(
                                    survey.avg_expected_price != null
                                        ? survey.avg_expected_price
                                        : '-'
                                )
                            ) +
                            '，' +
                            esc(String(survey.with_expected_price || 0)) +
                            ' 人填了价）；已付订单 <strong>' +
                            esc(String(pay.paid_orders || 0)) +
                            '</strong>，线上 GMV ¥' +
                            esc(String(pay.gmv != null ? pay.gmv : 0)) +
                            '；管理员激活 <strong>' +
                            esc(String(pay.admin_activation_orders || 0)) +
                            '</strong> 单 / ¥' +
                            esc(String(pay.admin_activation_gmv != null ? pay.admin_activation_gmv : 0)) +
                            '；合计 GMV <strong>¥' +
                            esc(String(combinedGmv)) +
                            '</strong>。';
                    }
                    if (cardsEl) {
                        var cards = [
                            ['浏览 UV', funnel.view_uv || 0],
                            ['CTA 点击 UV', funnel.pay_cta_uv || 0],
                            ['浏览→CTA', (funnel.view_to_cta_pct != null ? funnel.view_to_cta_pct : 0) + '%'],
                            ['生成付款 UV', funnel.alipay_start_uv || 0],
                            ['下单成功 UV', funnel.order_create_ok_uv || 0],
                            ['下单失败 UV', funnel.order_create_fail_uv || 0],
                            ['CTA→下单', (funnel.cta_to_create_ok_pct != null ? funnel.cta_to_create_ok_pct : 0) + '%'],
                            ['打开支付宝 UV', funnel.alipay_open_uv || 0],
                            ['支付成功 UV', funnel.alipay_success_uv || 0],
                            ['下单→成功', (funnel.create_ok_to_success_pct != null ? funnel.create_ok_to_success_pct : 0) + '%'],
                            ['浏览→支付', (funnel.view_to_pay_pct != null ? funnel.view_to_pay_pct : 0) + '%'],
                            ['FAQ 展开 UV', funnel.faq_expand_uv || 0],
                            ['浏览→FAQ', (funnel.view_to_faq_pct != null ? funnel.view_to_faq_pct : 0) + '%'],
                            ['调研偏贵%', (survey.expensive_pct != null ? survey.expensive_pct : 0) + '%'],
                            ['已付订单', pay.paid_orders || 0],
                            ['线上 GMV', '¥' + (pay.gmv != null ? pay.gmv : 0)],
                            ['管理员激活', (pay.admin_activation_orders || 0) + ' 单'],
                            ['管理员激活 GMV', '¥' + (pay.admin_activation_gmv != null ? pay.admin_activation_gmv : 0)],
                            ['合计 GMV', '¥' + combinedGmv]
                        ];
                        var ch = '';
                        cards.forEach(function (c) {
                            ch +=
                                '<div class="user-data-stat-card"><div class="ud-label">' +
                                esc(c[0]) +
                                '</div><div class="ud-val">' +
                                esc(String(c[1])) +
                                '</div></div>';
                        });
                        cardsEl.innerHTML = ch;
                    }
                    if (productTbody) {
                        var productRows = [
                            [
                                '开通套餐（线上支付）',
                                pay.activation_orders || 0,
                                '—',
                                pay.activation_gmv != null ? pay.activation_gmv : 0
                            ]
                        ];
                        adminActRows.forEach(function (row) {
                            if (!row) return;
                            var labelNote =
                                row.label_note && String(row.label_note).trim()
                                    ? ' · ' + String(row.label_note).trim()
                                    : '';
                            productRows.push([
                                '管理员激活（' +
                                    (row.admin_username || '—') +
                                    ' · ' +
                                    (row.use_user_amount
                                        ? '按填写金额'
                                        : '¥' +
                                          (row.unit_amount != null ? row.unit_amount : 0) +
                                          '/单') +
                                    labelNote +
                                    '）',
                                row.orders || 0,
                                '—',
                                row.gmv != null ? row.gmv : 0
                            ]);
                        });
                        productRows.push(
                            [
                                '离职证明',
                                pay.lizhi_orders || 0,
                                pay.lizhi_users != null ? pay.lizhi_users : 0,
                                pay.lizhi_gmv != null ? pay.lizhi_gmv : 0
                            ],
                            [
                                '同行费用（每天无限）',
                                pay.tax_edit_orders || 0,
                                '—',
                                pay.tax_edit_gmv != null ? pay.tax_edit_gmv : 0
                            ],
                            [
                                '开通合计（含管理员激活）',
                                pay.combined_activation_orders != null
                                    ? pay.combined_activation_orders
                                    : (pay.activation_orders || 0) +
                                      (pay.admin_activation_orders || 0),
                                '—',
                                combinedActivationGmv
                            ],
                            [
                                '合计（含管理员激活）',
                                pay.paid_orders || 0,
                                pay.paid_users != null ? pay.paid_users : 0,
                                combinedGmv
                            ]
                        );
                        var ph = '';
                        productRows.forEach(function (row) {
                            ph +=
                                '<tr><td>' +
                                esc(String(row[0])) +
                                '</td><td><strong>' +
                                esc(String(row[1])) +
                                '</strong></td><td>' +
                                esc(String(row[2])) +
                                '</td><td>¥' +
                                esc(String(row[3])) +
                                '</td></tr>';
                        });
                        productTbody.innerHTML = ph;
                    }
                    if (funnelTbody) {
                        funnelTbody.innerHTML =
                            '<tr>' +
                            '<td>' +
                            esc(String(funnel.view_uv || 0)) +
                            '</td>' +
                            '<td>' +
                            esc(String(funnel.pay_cta_uv || 0)) +
                            '</td>' +
                            '<td>' +
                            esc(String(funnel.alipay_start_uv || 0)) +
                            '</td>' +
                            '<td>' +
                            esc(String(funnel.order_create_ok_uv || 0)) +
                            '</td>' +
                            '<td>' +
                            esc(String(funnel.alipay_open_uv || 0)) +
                            '</td>' +
                            '<td>' +
                            esc(String(funnel.alipay_success_uv || 0)) +
                            '</td>' +
                            '<td>' +
                            esc(String(funnel.view_to_pay_pct != null ? funnel.view_to_pay_pct : 0)) +
                            '%</td>' +
                            '<td>' +
                            esc(String(funnel.cta_to_create_ok_pct != null ? funnel.cta_to_create_ok_pct : 0)) +
                            '%</td>' +
                            '<td>' +
                            esc(String(funnel.create_ok_to_success_pct != null ? funnel.create_ok_to_success_pct : 0)) +
                            '%</td>' +
                            '<td>' +
                            esc(String(funnel.faq_expand_uv || 0)) +
                            '</td>' +
                            '<td>' +
                            esc(String(survey.expensive_pct != null ? survey.expensive_pct : 0)) +
                            '%</td>' +
                            '</tr>';
                    }
                    var summary = Array.isArray(data.summary) ? data.summary : [];
                    if (summaryTbody) {
                        if (!summary.length) {
                            summaryTbody.innerHTML = '<tr><td colspan="3">暂无事件</td></tr>';
                        } else {
                            var sh = '';
                            summary.forEach(function (row) {
                                if (!(row.total > 0)) return;
                                sh +=
                                    '<tr><td>' +
                                    esc(row.label || row.event_key || '—') +
                                    '<div class="hint mt-0 mb-0" style="font-size:11px;color:#94a3b8;">' +
                                    esc(row.event_key || '') +
                                    '</div></td><td><strong>' +
                                    esc(String(row.total || 0)) +
                                    '</strong></td><td>' +
                                    esc(String(row.unique_users || 0)) +
                                    '</td></tr>';
                            });
                            summaryTbody.innerHTML = sh || '<tr><td colspan="3">暂无事件</td></tr>';
                        }
                    }
                    var byDay = Array.isArray(data.by_day) ? data.by_day : [];
                    if (dailyHint) {
                        dailyHint.textContent =
                            '共 ' +
                            (data.total_events != null ? data.total_events : 0) +
                            ' 次事件，' +
                            byDay.length +
                            ' 天有记录。可展开查看当日账号。';
                    }
                    if (dailyTbody) {
                        if (!byDay.length) {
                            dailyTbody.innerHTML = '<tr><td colspan="15">暂无每日数据</td></tr>';
                        } else {
                            var dh = '';
                            byDay.forEach(function (row) {
                                var dk = purchaseDateDomKey(row.date);
                                var rowCombinedGmv =
                                    row.combined_gmv != null
                                        ? row.combined_gmv
                                        : (Number(row.gmv) || 0) +
                                          (Number(row.admin_activation_gmv) || 0);
                                var rowCombinedActivationGmv =
                                    row.combined_activation_gmv != null
                                        ? row.combined_activation_gmv
                                        : (Number(row.activation_gmv) || 0) +
                                          (Number(row.admin_activation_gmv) || 0);
                                dh += '<tr class="purchase-summary-row">';
                                dh += '<td>' + esc(row.date || '—') + '</td>';
                                dh += '<td>' + esc(String(row.view_uv || 0)) + '</td>';
                                dh += '<td>' + esc(String(row.alipay_start_uv || 0)) + '</td>';
                                dh += '<td>' + esc(String(row.alipay_open_uv || 0)) + '</td>';
                                dh += '<td>' + esc(String(row.alipay_success_uv || 0)) + '</td>';
                                dh +=
                                    '<td>' +
                                    esc(String(row.view_to_pay_pct != null ? row.view_to_pay_pct : 0)) +
                                    '%</td>';
                                dh += '<td>' + esc(String(row.activate_ok_uv || 0)) + '</td>';
                                dh += '<td>' + esc(String(row.activate_fail_uv || 0)) + '</td>';
                                dh += '<td>' + esc(String(row.paid_orders || 0)) + '</td>';
                                dh += '<td>¥' + esc(String(rowCombinedGmv)) + '</td>';
                                dh += '<td>¥' + esc(String(rowCombinedActivationGmv)) + '</td>';
                                dh +=
                                    '<td>' +
                                    esc(String(row.admin_activation_orders || 0)) +
                                    ' / ¥' +
                                    esc(String(row.admin_activation_gmv != null ? row.admin_activation_gmv : 0)) +
                                    '</td>';
                                dh += '<td>' + esc(String(row.lizhi_orders || 0)) + '</td>';
                                dh +=
                                    '<td>¥' +
                                    esc(String(row.lizhi_gmv != null ? row.lizhi_gmv : 0)) +
                                    '</td>';
                                dh +=
                                    '<td><button type="button" class="btn-sm btn-detail btn-purchase-users-toggle" data-date="' +
                                    esc(row.date) +
                                    '">查看用户</button></td>';
                                dh += '</tr>';
                                dh +=
                                    '<tr id="purchase_users_row_' +
                                    dk +
                                    '" class="purchase-users-detail-row" style="display:none;"><td colspan="15"><div id="purchase_users_box_' +
                                    dk +
                                    '" class="activate-users-box">点击「查看用户」加载列表…</div></td></tr>';
                            });
                            dailyTbody.innerHTML = dh;
                        }
                    }
                })
                .catch(function () {
                    if (summaryEl) summaryEl.textContent = '网络错误';
                    if (funnelTbody) funnelTbody.innerHTML = '<tr><td colspan="7">网络错误</td></tr>';
                    if (productTbody) productTbody.innerHTML = '<tr><td colspan="4">网络错误</td></tr>';
                    if (summaryTbody) summaryTbody.innerHTML = '<tr><td colspan="3">网络错误</td></tr>';
                    if (dailyTbody) dailyTbody.innerHTML = '<tr><td colspan="15">网络错误</td></tr>';
                    if (surveyCardsEl) surveyCardsEl.innerHTML = '';
                    if (surveySentimentTbody) {
                        surveySentimentTbody.innerHTML = '<tr><td colspan="3">网络错误</td></tr>';
                    }
                    if (surveyPriceTbody) {
                        surveyPriceTbody.innerHTML = '<tr><td colspan="2">网络错误</td></tr>';
                    }
                    if (surveyRecentTbody) {
                        surveyRecentTbody.innerHTML = '<tr><td colspan="5">网络错误</td></tr>';
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

        /* ========== Server Monitor ========== */
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

            var heal = data.auto_heal || {};
            var healChk = document.getElementById('chkMonitorAutoHeal');
            if (healChk && document.activeElement !== healChk) {
                healChk.checked = !!heal.enabled;
            }
            var healStat = document.getElementById('monitorAutoHealStat');
            if (healStat) {
                var healBits = [];
                healBits.push(heal.enabled ? '自动修复：开' : '自动修复：关');
                if (heal.streak) {
                    healBits.push('连续异常 ' + heal.streak + ' 轮');
                }
                if (heal.last_at) {
                    healBits.push(
                        '上次修复 ' +
                            formatDt(heal.last_at) +
                            (heal.last_reason ? '（' + heal.last_reason + '）' : '')
                    );
                } else {
                    healBits.push(
                        heal.enabled
                            ? '健康检查挂了或一半以上接口连续失败 2 轮后重启后端'
                            : '不会自动重启'
                    );
                }
                healStat.textContent = healBits.join(' · ');
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
            var diskRoot = data.disk_root || data.disk || {};
            var diskUploads = data.disk_uploads || {};
            var netDiskGrid = document.getElementById('monitorNetDiskGrid');
            if (netDiskGrid) {
                netDiskGrid.innerHTML =
                    '<div class="monitor-stat-card"><div class="monitor-stat-label">下行带宽</div><div class="monitor-stat-val">' +
                    esc(net.rx_bps_label || '—') +
                    '</div></div>' +
                    '<div class="monitor-stat-card"><div class="monitor-stat-label">上行带宽</div><div class="monitor-stat-val">' +
                    esc(net.tx_bps_label || '—') +
                    '</div></div>' +
                    '<div class="monitor-stat-card"><div class="monitor-stat-label">系统磁盘 (' +
                    esc(diskRoot.path || '/') +
                    ')</div><div class="monitor-stat-val">' +
                    esc(diskRoot.used_percent != null ? diskRoot.used_percent + '%' : '—') +
                    '</div><div class="monitor-stat-sub">' +
                    esc((diskRoot.used_label || '—') + ' / ' + (diskRoot.total_label || '—')) +
                    '，剩余 ' +
                    esc(diskRoot.free_label || '—') +
                    '</div></div>' +
                    '<div class="monitor-stat-card"><div class="monitor-stat-label">上传目录 (' +
                    esc(diskUploads.path || 'uploads') +
                    ')</div><div class="monitor-stat-val">' +
                    esc(diskUploads.dir_label || '—') +
                    '</div><div class="monitor-stat-sub">仅统计 uploads 文件体积，不含 MySQL / Docker</div></div>';
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

            var probes = Array.isArray(data.api_probes) ? data.api_probes : [];
            var probeStat = document.getElementById('monitorApiProbeStat');
            var probeBody = document.getElementById('monitorApiProbesTbody');
            if (probeStat) {
                var failN = probes.filter(function (p) { return !p.ok; }).length;
                probeStat.textContent = probes.length
                    ? ('共 ' + probes.length + ' 个接口，失败 ' + failN + ' 个')
                    : '尚未跑过接口自测';
                probeStat.style.color = failN ? '#c62828' : '';
            }
            if (probeBody) {
                if (!probes.length) {
                    probeBody.innerHTML = '<tr><td colspan="6">暂无自测记录</td></tr>';
                } else {
                    var ph = '';
                    probes.forEach(function (p) {
                        ph += '<tr class="' + (p.ok ? '' : 'row-danger') + '">';
                        ph += '<td>' + esc(p.label || p.id || '—') + '</td>';
                        ph += '<td>' + esc(p.method || 'GET') + '</td>';
                        ph += '<td class="cell-break"><code>' + esc(p.path || '—') + '</code></td>';
                        ph += '<td>' + esc(p.status != null ? String(p.status) : '—') + '</td>';
                        ph += '<td>' + esc(p.latency_ms != null ? p.latency_ms + ' ms' : '—') + '</td>';
                        ph += '<td>' + (p.ok ? '正常' : esc(p.message || '异常')) + '</td>';
                        ph += '</tr>';
                    });
                    probeBody.innerHTML = ph;
                }
            }

            var updated = data.updated_at ? '上次更新：' + formatDt(data.updated_at) : '';
            if (smtpEl && updated) {
                smtpEl.textContent = updated + ' · ' + smtpEl.textContent;
            }
        }

        /* ========== Login Logs ========== */
        function loadServerMonitor() {
            var svcGrid = document.getElementById('monitorServicesGrid');
            if (svcGrid) svcGrid.innerHTML = '加载中…';
            adminFetch('api/admin/monitor/overview')
                .then(function (r) {
                    return (window.adminParseJson||function(r){return r.json();})(r);
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

        function formatBlockedByLabel(raw) {
            if (raw == null) return '—';
            if (typeof raw === 'object') {
                var objName = String(raw.full_name || '').trim();
                var objUser = String(raw.username || '').trim();
                return objName || objUser || '—';
            }
            var s = String(raw).trim();
            if (!s) return '—';
            if (s.charAt(0) === '{' || (s.length > 80 && s.indexOf('"username"') >= 0)) {
                try {
                    var parsed = JSON.parse(s);
                    var name = String((parsed && parsed.full_name) || '').trim();
                    var user = String((parsed && parsed.username) || '').trim();
                    if (name || user) return name || user;
                } catch (e) {
                    var um = s.match(/"username"\s*:\s*"((?:\\.|[^"\\])*)"/);
                    var nm = s.match(/"full_name"\s*:\s*"((?:\\.|[^"\\])*)"/);
                    var fragName = nm ? nm[1] : '';
                    var fragUser = um ? um[1] : '';
                    if (fragName || fragUser) return fragName || fragUser;
                }
                return '—';
            }
            return s;
        }

        function loadBlockedIps() {
            var tbody = document.getElementById('blockedIpsTbody');
            var statEl = document.getElementById('blockedIpsStat');
            if (statEl) statEl.textContent = '加载中…';
            adminFetch('api/admin/blocked-ips')
                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                .then(function (d) {
                    if (d.code !== 200) {
                        if (statEl) statEl.textContent = d.msg || '加载失败';
                        return;
                    }
                    var list = Array.isArray(d.data) ? d.data : [];
                    if (statEl) statEl.textContent = '共 ' + list.length + ' 条记录';
                    var html = '';
                    list.forEach(function (item) {
                        html += '<tr>';
                        html += '<td><code>' + esc(item.ip) + '</code></td>';
                        html += '<td class="cell-break">' + esc(formatBlockedByLabel(item.blocked_by)) + '</td>';
                        html += '<td class="cell-break">' + esc(item.reason || '—') + '</td>';
                        html += '<td>' + formatDt(item.created_at) + '</td>';
                        html += '<td><button type="button" class="btn-sm btn-unban btn-unblock-ip" data-ip="' + esc(item.ip) + '">解封</button></td>';
                        html += '</tr>';
                    });
                    if (tbody) {
                        tbody.innerHTML = html || '<tr><td colspan="5">暂无封禁记录</td></tr>';
                        tbody.querySelectorAll('.btn-unblock-ip').forEach(function (btn) {
                            btn.onclick = function () {
                                var ip = btn.getAttribute('data-ip');
                                if (!confirm('确定解封 IP「' + ip + '」？')) return;
                                adminFetch('api/admin/unblock-ip', {
                                    method: 'POST',
                                    body: JSON.stringify({ ip: ip })
                                })
                                    .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                                    .then(function (d2) {
                                        if (d2.code === 200) {
                                            loadBlockedIps();
                                        } else {
                                            alert(d2.msg || '解封失败');
                                        }
                                    })
                                    .catch(function () { alert('网络错误'); });
                            };
                        });
                    }
                })
                .catch(function () {
                    if (statEl) statEl.textContent = '加载失败';
                });
        }

        function loadLoginRecentPage(page) {
            if (page != null && isFinite(page)) {
                loginRecentPage = Math.max(1, parseInt(page, 10) || 1);
            }
            var lim = loginRecentLimit;
            var tbody = document.getElementById('loginLogTbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="7">加载中…</td></tr>';

            var unameEl = document.getElementById('loginLogAdminUsername');
            var okEl = document.getElementById('loginLogOkFilter');
            var uname = unameEl ? unameEl.value.trim() : '';
            var okFilter = okEl ? okEl.value : '';
            var query =
                'api/admin/admin-login-logs?page=' +
                encodeURIComponent(loginRecentPage) +
                '&limit=' +
                encodeURIComponent(lim);
            if (uname) query += '&username=' + encodeURIComponent(uname);
            if (okFilter === '1' || okFilter === '0') query += '&ok=' + encodeURIComponent(okFilter);
            adminFetch(query)
                .then(function (r) {
                    return (window.adminParseJson || function (r) { return r.json(); })(r);
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
                        if (tbody) tbody.innerHTML = rr || '<tr><td colspan="7">暂无记录</td></tr>';
                        if (info) {
                            info.textContent =
                                '第 ' + cur + ' / ' + (tp > 0 ? tp : 1) + ' 页 · 共 ' + total + ' 条';
                        }
                        if (prevBtn) prevBtn.disabled = cur <= 1;
                        if (nextBtn) nextBtn.disabled = tp <= 0 || cur >= tp;
                    } else {
                        if (tbody) {
                            tbody.innerHTML =
                                '<tr><td colspan="7">' + esc(recent.msg || '加载失败') + '</td></tr>';
                        }
                        if (info) info.textContent = '—';
                        if (prevBtn) prevBtn.disabled = true;
                        if (nextBtn) nextBtn.disabled = true;
                    }
                })
                .catch(function () {
                    if (tbody) tbody.innerHTML = '<tr><td colspan="7">网络错误</td></tr>';
                    var prevBtn = document.getElementById('loginLogPrev');
                    var nextBtn = document.getElementById('loginLogNext');
                    if (prevBtn) prevBtn.disabled = true;
                    if (nextBtn) nextBtn.disabled = true;
                });
        }

        function loadAdminOperationLogPage(page) {
            if (page != null && isFinite(page)) {
                adminOpLogPage = Math.max(1, parseInt(page, 10) || 1);
            }
            var tbody = document.getElementById('adminOpLogTbody');
            if (tbody) tbody.innerHTML = '<tr><td colspan="12">加载中…</td></tr>';
            var unameEl = document.getElementById('adminOpLogUsername');
            var pathEl = document.getElementById('adminOpLogPath');
            var okEl = document.getElementById('adminOpLogOkFilter');
            var uname = unameEl ? unameEl.value.trim() : '';
            var pathQ = pathEl ? pathEl.value.trim() : '';
            var okFilter = okEl ? okEl.value : '';
            var query =
                'api/admin/admin-operation-logs?page=' +
                encodeURIComponent(adminOpLogPage) +
                '&limit=' +
                encodeURIComponent(adminOpLogLimit);
            if (uname) query += '&username=' + encodeURIComponent(uname);
            if (pathQ) query += '&path=' + encodeURIComponent(pathQ);
            if (okFilter === '1' || okFilter === '0') query += '&ok=' + encodeURIComponent(okFilter);
            adminFetch(query)
                .then(function (r) {
                    return (window.adminParseJson || function (r) { return r.json(); })(r);
                })
                .then(function (recent) {
                    var info = document.getElementById('adminOpLogPageInfo');
                    var prevBtn = document.getElementById('adminOpLogPrev');
                    var nextBtn = document.getElementById('adminOpLogNext');
                    if (recent.code === 200 && recent.data && recent.data.items) {
                        var total = recent.data.total != null ? Number(recent.data.total) : 0;
                        var tp = recent.data.total_pages != null ? Number(recent.data.total_pages) : 0;
                        var cur = recent.data.page != null ? Number(recent.data.page) : adminOpLogPage;
                        adminOpLogPage = cur;
                        var rr = '';
                        recent.data.items.forEach(function (row) {
                            var okBadge = row.ok
                                ? '<span class="badge badge-yes">成功</span>'
                                : '<span class="badge badge-no">失败</span>';
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
                                esc(String(row.status_code != null ? row.status_code : '—')) +
                                '</td><td class="cell-break">' +
                                esc((row.ip || '—') + ' / ' + (row.city || '—')) +
                                '</td><td class="cell-break">' +
                                esc(row.device_desc || '—') +
                                '</td><td class="cell-break">' +
                                esc(row.request_brief || '—') +
                                '</td></tr>';
                        });
                        if (tbody) tbody.innerHTML = rr || '<tr><td colspan="12">暂无记录</td></tr>';
                        if (info) {
                            info.textContent =
                                '第 ' + cur + ' / ' + (tp > 0 ? tp : 1) + ' 页 · 共 ' + total + ' 条';
                        }
                        if (prevBtn) prevBtn.disabled = cur <= 1;
                        if (nextBtn) nextBtn.disabled = tp <= 0 || cur >= tp;
                    } else {
                        if (tbody) {
                            tbody.innerHTML =
                                '<tr><td colspan="12">' + esc(recent.msg || '加载失败') + '</td></tr>';
                        }
                        if (info) info.textContent = '—';
                        if (prevBtn) prevBtn.disabled = true;
                        if (nextBtn) nextBtn.disabled = true;
                    }
                })
                .catch(function () {
                    if (tbody) tbody.innerHTML = '<tr><td colspan="12">网络错误</td></tr>';
                    var prevBtn = document.getElementById('adminOpLogPrev');
                    var nextBtn = document.getElementById('adminOpLogNext');
                    if (prevBtn) prevBtn.disabled = true;
                    if (nextBtn) nextBtn.disabled = true;
                });
        }

        var USER_LOGIN_REASON_FILTER_OPTIONS = [
            { key: 'ok', label: '成功' },
            { key: 'invalid_credentials', label: '账号或密码错误' },
            { key: 'account_not_found', label: '账号不存在' },
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
                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
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

        function channelAnalysisFunnelDays() {
            var raw = analyticsPeriodVal(document.getElementById('channelAnalysisDays'));
            if (raw === '0' || raw === '' || raw == null) return '90';
            return raw;
        }

        function setChannelFunnelTab(which) {
            var useAct = which === 'activation';
            document.querySelectorAll('.channel-funnel-tab').forEach(function (btn) {
                var on = btn.getAttribute('data-funnel') === (useAct ? 'activation' : 'register');
                btn.classList.toggle('is-active', on);
                btn.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            var regEl = document.getElementById('analyticsChannelFunnel');
            var actEl = document.getElementById('analyticsActivationChannelFunnel');
            if (regEl) {
                if (useAct) regEl.setAttribute('hidden', '');
                else regEl.removeAttribute('hidden');
            }
            if (actEl) {
                if (useAct) actEl.removeAttribute('hidden');
                else actEl.setAttribute('hidden', '');
            }
        }

        function loadChannelRegistrationFunnel() {
            var el = document.getElementById('analyticsChannelFunnel');
            if (!el) return;
            var days = channelAnalysisFunnelDays();
            el.textContent = '渠道漏斗加载中…';
            adminFetch('api/admin/analytics/channel-registration-funnel?days=' + encodeURIComponent(days))
                .then(function (r) {
                    return (window.adminParseJson||function(r){return r.json();})(r);
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
            var days = channelAnalysisFunnelDays();
            el.textContent = '激活渠道漏斗加载中…';
            adminFetch('api/admin/analytics/activation-channel-funnel?days=' + encodeURIComponent(days))
                .then(function (r) {
                    return (window.adminParseJson||function(r){return r.json();})(r);
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

        /* ========== Install Guide Stats ========== */
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
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">按同一 IP 去重</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">独立访客 (UV)</div><div class="ud-val">' +
                esc(String(s.unique_visitors != null ? s.unique_visitors : 0)) +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">按同一 IP 去重</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">安装页→注册率</div><div class="ud-val">' +
                esc(s.register_rate_pct || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">归因注册(同IP去重) ' +
                esc(String(s.registered_from_install != null ? s.registered_from_install : 0)) +
                ' / UV ' +
                esc(String(s.unique_visitors != null ? s.unique_visitors : 0)) +
                (s.registered_from_install_reported != null && Number(s.registered_from_install_reported) > 0
                    ? ' · 注册回传 ' + esc(String(s.registered_from_install_reported))
                    : '') +
                '</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">全站注册</div><div class="ud-val">' +
                esc(String(s.registered != null ? s.registered : 0)) +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">含未走安装页 · 同IP去重' +
                (s.registered_from_install != null
                    ? ' · 安装页归因 ' +
                      esc(String(s.registered_from_install))
                    : '') +
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
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">平均 DOM 就绪</div><div class="ud-val">' +
                esc(s.avg_dom_ready_label || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">中位 ' +
                esc(s.median_dom_ready_label || '—') +
                ' · 样本 ' +
                esc(String(s.load_samples != null ? s.load_samples : 0)) +
                '</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">平均安装包接口</div><div class="ud-val">' +
                esc(s.avg_packages_total_label || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">中位 ' +
                esc(s.median_packages_total_label || '—') +
                (s.avg_packages_net_label && s.avg_packages_net_label !== '—'
                    ? ' · 网 ' +
                      esc(s.avg_packages_net_label) +
                      ' + 渲 ' +
                      esc(s.avg_packages_render_label || '—')
                    : '') +
                '</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">新增游客</div><div class="ud-val">' +
                esc(String(s.new_guests != null ? s.new_guests : 0)) +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">C 方案沙盒账号（按创建日）</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">游客→注册</div><div class="ud-val">' +
                esc(String(s.guest_converted != null ? s.guest_converted : 0)) +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">注册率 ' +
                esc(s.guest_register_rate_pct || '—') +
                '</div></div>';
            html += '</div>';

            var landingAb = data.landing_ab || null;
            var landingVariants =
                landingAb && Array.isArray(landingAb.variants) ? landingAb.variants : [];
            html += '<p class="stat" style="margin:0 0 8px;">B/C 落地页 A/B Test</p>';
            html +=
                '<p class="hint" style="margin:0 0 10px;">' +
                esc(
                    (landingAb && landingAb.definition) ||
                        '回访用户 = 统计区间内至少在 2 个不同自然日访问同一方案'
                ) +
                '</p>';
            html += '<div class="scroll-x" style="margin-bottom:16px;"><table><thead><tr>';
            html +=
                '<th>方案</th><th>PV</th><th>UV</th><th>平均停留</th><th>回访用户</th><th>回访率</th><th>关键门禁</th><th>下载用户</th><th>下载率</th><th>注册用户</th><th>注册率</th></tr></thead><tbody>';
            if (!landingVariants.length) {
                html += '<tr><td colspan="11">暂无 A/B 数据；新访客进入后开始累计</td></tr>';
            } else {
                landingVariants.forEach(function (row) {
                    html += '<tr>';
                    html += '<td><strong>' + esc(row.label || row.variant || '—') + '</strong></td>';
                    html += '<td>' + esc(String(row.page_views || 0)) + '</td>';
                    html += '<td>' + esc(String(row.unique_visitors || 0)) + '</td>';
                    html += '<td>' + esc(row.avg_dwell_label || '—') + '</td>';
                    html += '<td>' + esc(String(row.returning_visitors || 0)) + '</td>';
                    html += '<td>' + esc(row.return_rate_pct || '—') + '</td>';
                    html += '<td>' + esc(String(row.gate_visitors || 0)) + '</td>';
                    html += '<td>' + esc(String(row.download_visitors || 0)) + '</td>';
                    html += '<td>' + esc(row.download_rate_pct || '—') + '</td>';
                    html += '<td>' + esc(String(row.registered_visitors || 0)) + '</td>';
                    html += '<td>' + esc(row.register_rate_pct || '—') + '</td>';
                    html += '</tr>';
                });
            }
            html += '</tbody></table></div>';

            var dlFunnel = data.download_register_funnel || null;
            var dlStages = dlFunnel && Array.isArray(dlFunnel.stages) ? dlFunnel.stages : [];
            var dlRates = (dlFunnel && dlFunnel.rates) || {};
            var dlCohorts = (dlFunnel && dlFunnel.cohorts) || {};
            var dlQueue =
                dlFunnel && Array.isArray(dlFunnel.opened_unregistered_queue)
                    ? dlFunnel.opened_unregistered_queue
                    : [];
            html += '<p class="stat" style="margin:0 0 8px;">下载 → 打开 → 注册漏斗</p>';
            html +=
                '<p class="hint" style="margin:0 0 10px;">' +
                esc(
                    (dlFunnel && dlFunnel.definition) ||
                        '按 IP 优先去重对齐（北京时间）。准口径「已打开未注册」最有用。'
                ) +
                (dlFunnel && dlFunnel.using_c_proxy
                    ? ' 当前 C 段暂用「注册弹窗展示」代理（first_open 尚无样本）。'
                    : '') +
                '</p>';
            html += '<div class="user-data-stats" style="margin-bottom:12px;">';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">下载点击率</div><div class="ud-val">' +
                esc(dlRates.download_rate_pct || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">B ÷ A</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">打开率</div><div class="ud-val">' +
                esc(dlRates.open_rate_pct || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">C ÷ B</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">打开→注册</div><div class="ud-val">' +
                esc(dlRates.register_from_open_pct || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">F ÷ C</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">弹窗点稍后</div><div class="ud-val">' +
                esc(dlRates.later_rate_pct || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">稍后 ÷ 弹窗</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">已打开未注册</div><div class="ud-val">' +
                esc(String(dlCohorts.opened_unregistered != null ? dlCohorts.opened_unregistered : 0)) +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">准口径</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">点下载未打开</div><div class="ud-val">' +
                esc(String(dlCohorts.downloaded_not_opened != null ? dlCohorts.downloaded_not_opened : 0)) +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">宽口径 / 归因断链 · 重点盯</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">游客数据合并</div><div class="ud-val">' +
                esc(String(dlCohorts.guest_data_migrated != null ? dlCohorts.guest_data_migrated : 0)) +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">UV ' +
                esc(String(dlCohorts.guest_data_migrated_uv != null ? dlCohorts.guest_data_migrated_uv : 0)) +
                '</div></div>';
            html += '</div>';
            html += '<div class="scroll-x" style="margin-bottom:12px;"><table><thead><tr>';
            html +=
                '<th>阶段</th><th>含义</th><th>独立访客</th><th>相对上一步</th><th>相对落地页</th></tr></thead><tbody>';
            if (!dlStages.length) {
                html += '<tr><td colspan="5">暂无漏斗数据</td></tr>';
            } else {
                dlStages.forEach(function (row) {
                    html += '<tr>';
                    html += '<td><strong>' + esc(row.key || '—') + '</strong></td>';
                    html += '<td>' + esc(row.label || '—') + '</td>';
                    html += '<td>' + esc(String(row.visitors != null ? row.visitors : 0)) + '</td>';
                    html += '<td>' + esc(row.rate_from_prev_pct || '—') + '</td>';
                    html += '<td>' + esc(row.rate_from_a_pct || '—') + '</td>';
                    html += '</tr>';
                });
            }
            html += '</tbody></table></div>';
            html +=
                '<p class="stat" style="margin:0 0 8px;">已打开 App 未注册（最多 10）</p>';
            html +=
                '<p class="hint" style="margin:0 0 10px;">同 client_id 有首次打开或注册弹窗、且无注册成功回传。可用于盯「稍后」与召回。</p>';
            html += '<div class="scroll-x" style="margin-bottom:16px;"><table><thead><tr>';
            html +=
                '<th>访客</th><th>设备</th><th>首次</th><th>最近</th><th>打开</th><th>弹窗</th><th>稍后</th><th>去注册</th><th>IP</th></tr></thead><tbody>';
            if (!dlQueue.length) {
                html += '<tr><td colspan="9">暂无；部署 first_open 后或有注册弹窗未转化时会出现</td></tr>';
            } else {
                dlQueue.forEach(function (row) {
                    html += '<tr>';
                    html +=
                        '<td class="cell-break"><code title="' +
                        esc(row.visitor_id || '') +
                        '">' +
                        esc(row.visitor_key || '—') +
                        '</code></td>';
                    html +=
                        '<td class="cell-break" title="' +
                        esc(row.user_agent || '') +
                        '">' +
                        esc(row.device_label || '—') +
                        '</td>';
                    html += '<td>' + esc(formatIsoToCnShort(row.first_at)) + '</td>';
                    html += '<td>' + esc(formatIsoToCnShort(row.last_at)) + '</td>';
                    html += '<td>' + esc(String(row.open_events != null ? row.open_events : 0)) + '</td>';
                    html += '<td>' + esc(String(row.prompt_shows != null ? row.prompt_shows : 0)) + '</td>';
                    html += '<td>' + esc(String(row.later_cnt != null ? row.later_cnt : 0)) + '</td>';
                    html += '<td>' + esc(String(row.ok_cnt != null ? row.ok_cnt : 0)) + '</td>';
                    html += '<td>' + esc(row.ip || '—') + '</td>';
                    html += '</tr>';
                });
            }
            html += '</tbody></table></div>';

            var daily = Array.isArray(data.daily) ? data.daily : [];
            html += '<p class="stat" style="margin:0 0 8px;">每日游客用户</p>';
            html +=
                '<p class="hint" style="margin:0 0 10px;">按<strong>北京时间</strong>统计 C 方案产生的沙盒游客账号（<code>users.created_at</code>）；「注册合并」按同设备注册后数据迁移日（<code>guest_merged_at</code>）统计。</p>';
            html += '<div class="scroll-x" style="margin-bottom:16px;"><table><thead><tr>';
            html +=
                '<th>日期</th><th>新增游客</th><th>注册合并</th><th>游客注册率</th></tr></thead><tbody>';
            if (!daily.length) {
                html += '<tr><td colspan="4">暂无</td></tr>';
            } else {
                daily.slice().reverse().forEach(function (row) {
                    html += '<tr>';
                    html += '<td>' + esc(row.date || '—') + '</td>';
                    html += '<td>' + esc(String(row.new_guests != null ? row.new_guests : 0)) + '</td>';
                    html += '<td>' + esc(String(row.guest_converted != null ? row.guest_converted : 0)) + '</td>';
                    html += '<td>' + esc(row.guest_register_rate_pct || (row.new_guests > 0 ? '0.0%' : '—')) + '</td>';
                    html += '</tr>';
                });
            }
            html += '</tbody></table></div>';

            html += '<p class="stat" style="margin:0 0 8px;">每日访问与注册趋势</p>';
            html +=
                '<div class="device-stats-charts-wrap" style="margin-bottom:16px;"><div class="device-stats-chart-card chart-card-wide install-guide-trend-card"><h4>访问 / 注册 / 注册率</h4><div class="chart-canvas-wrap chart-canvas-wrap-trend"><canvas id="installGuideVisitRegChart" aria-label="安装页每日访问与注册折线图"></canvas></div></div></div>';

            var hourly = data.hourly || null;
            var hourBuckets = hourly && Array.isArray(hourly.detail_buckets) ? hourly.detail_buckets : [];
            var hourPeriods = hourly && Array.isArray(hourly.periods) ? hourly.periods : [];
            var byHour = hourly && Array.isArray(hourly.by_hour) ? hourly.by_hour : [];
            var peakHour = hourly && hourly.peak_period ? hourly.peak_period : null;
            html += '<p class="stat" style="margin:0 0 8px;">访客时段分布（北京时间）</p>';
            if (peakHour && peakHour.label) {
                html +=
                    '<p class="hint" style="margin:0 0 10px;">当前区间浏览量最集中在「' +
                    esc(peakHour.label) +
                    '」（' +
                    esc(peakHour.pct_text || '—') +
                    '，PV ' +
                    esc(String(peakHour.page_views != null ? peakHour.page_views : 0)) +
                    '）。同一访客跨小时会分别计入各小时 UV。</p>';
            } else {
                html +=
                    '<p class="hint" style="margin:0 0 10px;">按北京时间统计安装页浏览；同一访客跨小时会分别计入各小时 UV。</p>';
            }
            html += '<div class="register-time-period-cards" style="margin-bottom:12px;">';
            if (!hourPeriods.length) {
                html += '<div class="hint">暂无时段数据</div>';
            } else {
                hourPeriods.forEach(function (p) {
                    var isPeak = peakHour && peakHour.key === p.key;
                    html +=
                        '<div class="register-time-period-card' +
                        (isPeak ? ' is-peak' : '') +
                        '">' +
                        '<div class="rtp-label">' +
                        esc(p.label) +
                        (isPeak ? '<span class="rtp-badge">高峰</span>' : '') +
                        '</div>' +
                        '<div class="rtp-range">' +
                        esc(p.range || '') +
                        '</div>' +
                        '<div class="rtp-count">PV ' +
                        esc(String(p.page_views != null ? p.page_views : 0)) +
                        '</div>' +
                        '<div class="rtp-pct">' +
                        esc(p.pct_text || '—') +
                        ' · UV ' +
                        esc(String(p.unique_visitors != null ? p.unique_visitors : 0)) +
                        ' · 注册 ' +
                        esc(String(p.registered != null ? p.registered : 0)) +
                        '</div></div>';
                });
            }
            html += '</div>';
            html +=
                '<div class="device-stats-charts-wrap" style="margin-bottom:12px;"><div class="device-stats-chart-card chart-card-wide install-guide-hourly-card"><h4>24 小时访客分布</h4><div class="chart-canvas-wrap chart-canvas-wrap-trend"><canvas id="installGuideHourlyChart" aria-label="安装页24小时访客分布"></canvas></div></div></div>';
            html += '<div class="scroll-x" style="margin-bottom:16px;"><table><thead><tr>';
            html +=
                '<th>时段</th><th>时间范围</th><th>浏览量</th><th>独立访客</th><th>总注册</th><th>占比</th></tr></thead><tbody>';
            if (!hourBuckets.length) {
                html += '<tr><td colspan="6">暂无</td></tr>';
            } else {
                hourBuckets.forEach(function (row) {
                    html += '<tr>';
                    html += '<td>' + esc(row.label || '—') + '</td>';
                    html += '<td>' + esc(row.range || '—') + '</td>';
                    html += '<td>' + esc(String(row.page_views != null ? row.page_views : 0)) + '</td>';
                    html +=
                        '<td>' + esc(String(row.unique_visitors != null ? row.unique_visitors : 0)) + '</td>';
                    html += '<td>' + esc(String(row.registered != null ? row.registered : 0)) + '</td>';
                    html += '<td>' + esc(row.pct_text || '—') + '</td>';
                    html += '</tr>';
                });
            }
            html += '</tbody></table></div>';

            var actions = Array.isArray(data.actions) ? data.actions : [];
            html +=
                '<details class="analytics-section-details install-user-actions-details">' +
                '<summary>用户行为（点击 / 播放等）</summary>';
            html += '<div class="scroll-x"><table><thead><tr><th>行为</th><th>次数</th></tr></thead><tbody>';
            if (!actions.length) {
                html += '<tr><td colspan="2">暂无行为数据</td></tr>';
            } else {
                actions.forEach(function (row) {
                    html += '<tr><td>' + esc(row.label || row.event_key) + '</td><td>' + esc(row.total) + '</td></tr>';
                });
            }
            html += '</tbody></table></div></details>';

            html += '<p class="stat" style="margin:0 0 8px;">按日明细</p>';
            html += '<div class="scroll-x" style="margin-bottom:16px;"><table><thead><tr>';
            html +=
                '<th>日期</th><th>浏览量</th><th>独立访客</th><th>新增游客</th><th>游客合并</th><th>归因注册</th><th>总注册</th><th>注册率</th><th>平均停留</th><th>平均DOM就绪</th><th>平均包接口</th></tr></thead><tbody>';
            if (!daily.length) {
                html += '<tr><td colspan="7">暂无</td></tr>';
            } else {
                daily.slice().reverse().forEach(function (row) {
                    html += '<tr>';
                    html += '<td>' + esc(row.date || '—') + '</td>';
                    html += '<td>' + esc(row.page_views) + '</td>';
                    html += '<td>' + esc(row.unique_visitors) + '</td>';
                    html += '<td>' + esc(String(row.new_guests != null ? row.new_guests : 0)) + '</td>';
                    html += '<td>' + esc(String(row.guest_converted != null ? row.guest_converted : 0)) + '</td>';
                    html += '<td>' + esc(row.registered_from_install != null ? row.registered_from_install : 0) + '</td>';
                    html += '<td>' + esc(row.registered != null ? row.registered : 0) + '</td>';
                    html += '<td>' + esc(row.register_rate_pct || (row.unique_visitors > 0 ? '0.0%' : '—')) + '</td>';
                    html += '<td>' + esc(row.avg_dwell_label || '—') + '</td>';
                    html += '<td>' + esc(row.avg_dom_ready_label || '—') + '</td>';
                    html += '<td>' + esc(row.avg_packages_total_label || '—') + '</td>';
                    html += '</tr>';
                });
            }
            html += '</tbody></table></div>';

            var recentVisitors = Array.isArray(data.recent_visitors) ? data.recent_visitors : [];
            html +=
                '<details class="analytics-section-details install-recent-visitors-details">' +
                '<summary>最近访客行为（最多 3 位访客，同一访客合并展示）</summary>';
            html += '<div class="scroll-x"><table><thead><tr>';
            html += '<th>访客</th><th>IP</th><th>设备</th><th>时间</th><th>行为</th><th>停留/加载</th></tr></thead><tbody>';
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
                        var detailCell = '—';
                        if (row.event_key === 'track_install_page_leave') {
                            detailCell = row.dwell_label || '—';
                        } else if (row.event_key === 'track_install_page_perf') {
                            detailCell = row.load_label || '—';
                        }
                        html += '<td>' + esc(detailCell) + '</td>';
                        html += '</tr>';
                    });
                });
            }
            html += '</tbody></table></div></details>';
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
                                        backgroundColor: 'rgba(30, 111, 255, 0.12)',
                                        yAxisID: 'yCount',
                                        tension: 0.28,
                                        fill: true,
                                        borderWidth: 2.5,
                                        pointRadius: 0,
                                        pointHoverRadius: 4,
                                        pointHitRadius: 8
                                    },
                                    {
                                        label: '归因注册',
                                        data: daily.map(function (row) {
                                            return Number(row.registered_from_install) || 0;
                                        }),
                                        borderColor: '#22a06b',
                                        backgroundColor: '#22a06b',
                                        yAxisID: 'yCount',
                                        tension: 0.28,
                                        fill: false,
                                        borderWidth: 2,
                                        pointRadius: 0,
                                        pointHoverRadius: 4,
                                        pointHitRadius: 8
                                    },
                                    {
                                        label: '总注册',
                                        data: daily.map(function (row) {
                                            return Number(row.registered) || 0;
                                        }),
                                        borderColor: '#64748b',
                                        backgroundColor: '#64748b',
                                        yAxisID: 'yCount',
                                        borderDash: [6, 4],
                                        tension: 0.28,
                                        fill: false,
                                        borderWidth: 2,
                                        pointRadius: 0,
                                        pointHoverRadius: 4,
                                        pointHitRadius: 8
                                    },
                                    {
                                        label: '新增游客',
                                        data: daily.map(function (row) {
                                            return Number(row.new_guests) || 0;
                                        }),
                                        borderColor: '#0d9488',
                                        backgroundColor: '#0d9488',
                                        yAxisID: 'yCount',
                                        tension: 0.28,
                                        fill: false,
                                        borderWidth: 1.5,
                                        pointRadius: 0,
                                        pointHoverRadius: 4,
                                        pointHitRadius: 8
                                    },
                                    {
                                        label: '注册率 (%)',
                                        data: rateData,
                                        borderColor: '#ef6c00',
                                        backgroundColor: '#ef6c00',
                                        yAxisID: 'yRate',
                                        tension: 0.28,
                                        fill: false,
                                        borderWidth: 2,
                                        pointRadius: 0,
                                        pointHoverRadius: 4,
                                        pointHitRadius: 8,
                                        spanGaps: true
                                    }
                                ]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                interaction: { mode: 'index', intersect: false },
                                plugins: {
                                    legend: {
                                        position: 'bottom',
                                        labels: { usePointStyle: true, pointStyle: 'line' }
                                    },
                                    tooltip: {
                                        backgroundColor: 'rgba(15, 23, 42, 0.92)',
                                        padding: 10,
                                        cornerRadius: 6,
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
                                    x: { grid: { display: false } },
                                    yCount: {
                                        type: 'linear',
                                        position: 'left',
                                        beginAtZero: true,
                                        title: { display: true, text: '人数' },
                                        grid: { color: 'rgba(148, 163, 184, 0.25)' },
                                        ticks: { precision: 0 }
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

            if (typeof Chart !== 'undefined' && byHour.length) {
                var hourCanvas = document.getElementById('installGuideHourlyChart');
                if (hourCanvas) {
                    _installGuideChartInstances.push(
                        new Chart(hourCanvas, {
                            type: 'bar',
                            data: {
                                labels: byHour.map(function (row) {
                                    return row.label || '';
                                }),
                                datasets: [
                                    {
                                        label: '浏览量 (PV)',
                                        data: byHour.map(function (row) {
                                            return Number(row.page_views) || 0;
                                        }),
                                        backgroundColor: 'rgba(30, 111, 255, 0.72)',
                                        borderColor: '#1e6fff',
                                        borderWidth: 0,
                                        borderRadius: 3,
                                        maxBarThickness: 16,
                                        yAxisID: 'y'
                                    },
                                    {
                                        label: '独立访客 (UV)',
                                        data: byHour.map(function (row) {
                                            return Number(row.unique_visitors) || 0;
                                        }),
                                        backgroundColor: 'rgba(34, 160, 107, 0.62)',
                                        borderColor: '#22a06b',
                                        borderWidth: 0,
                                        borderRadius: 3,
                                        maxBarThickness: 16,
                                        yAxisID: 'y'
                                    },
                                    {
                                        label: '总注册',
                                        data: byHour.map(function (row) {
                                            return Number(row.registered) || 0;
                                        }),
                                        type: 'line',
                                        borderColor: '#ef6c00',
                                        backgroundColor: '#ef6c00',
                                        tension: 0.28,
                                        fill: false,
                                        borderWidth: 2,
                                        pointRadius: 0,
                                        pointHoverRadius: 4,
                                        pointHitRadius: 8,
                                        yAxisID: 'y'
                                    }
                                ]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                interaction: { mode: 'index', intersect: false },
                                plugins: {
                                    legend: {
                                        position: 'bottom',
                                        labels: { usePointStyle: true }
                                    },
                                    tooltip: {
                                        backgroundColor: 'rgba(15, 23, 42, 0.92)',
                                        padding: 10,
                                        cornerRadius: 6
                                    }
                                },
                                scales: {
                                    x: { grid: { display: false } },
                                    y: {
                                        beginAtZero: true,
                                        title: { display: true, text: '次数 / 人数' },
                                        ticks: { precision: 0 },
                                        grid: { color: 'rgba(148, 163, 184, 0.25)' }
                                    }
                                }
                            }
                        })
                    );
                }
            }
            if (_installGuideChartInstances.length) {
                requestAnimationFrame(function () {
                    _installGuideChartInstances.forEach(function (c) {
                        try {
                            if (c && typeof c.resize === 'function') c.resize();
                        } catch (eResize) {}
                    });
                });
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
                    return (window.adminParseJson||function(r){return r.json();})(r);
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        el.textContent = j.msg || '加载失败';
                    } else {
                        renderInstallGuideStats(j.data);
                    }
                    loadInstallRegisterAnalysis();
                })
                .catch(function () {
                    el.textContent = '加载失败';
                    loadInstallRegisterAnalysis();
                });
        }

        var _abcInstallChartInstances = [];
        function destroyAbcInstallCharts() {
            _abcInstallChartInstances.forEach(function (c) {
                try {
                    if (c && typeof c.destroy === 'function') c.destroy();
                } catch (e0) {}
            });
            _abcInstallChartInstances = [];
        }

        function loadAbcInstallStats() {
            var el = document.getElementById('abcInstallStatsMount');
            if (!el) return;
            var daysEl = document.getElementById('abcInstallStatsDays');
            var days = analyticsPeriodVal(daysEl);
            el.textContent = '加载中…';
            adminFetch('api/admin/analytics/abc-install-stats?days=' + encodeURIComponent(days))
                .then(function (r) {
                    return (window.adminParseJson||function(r){return r.json();})(r);
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        el.textContent = j.msg || '加载失败';
                        return;
                    }
                    renderAbcInstallStats(j.data);
                })
                .catch(function () {
                    el.textContent = '加载失败';
                });
        }

        function renderAbcInstallStats(data) {
            var el = document.getElementById('abcInstallStatsMount');
            if (!el) return;
            destroyAbcInstallCharts();
            if (!data || !data.summary) {
                el.textContent = '暂无 ABC 渠道下载页数据';
                return;
            }
            var s = data.summary;
            var html = analyticsPeriodHintHtml(data);
            if (data.definition) {
                html += '<p class="hint" style="margin:0 0 12px;">' + esc(data.definition) + '</p>';
            }
            html += '<div class="user-data-stats" style="margin-bottom:14px;">';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">浏览次数 (PV)</div><div class="ud-val">' +
                esc(String(s.view_pv != null ? s.view_pv : 0)) +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">下载页打开次数</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">独立访客 (UV)</div><div class="ud-val">' +
                esc(String(s.view_uv != null ? s.view_uv : 0)) +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">按同一 IP 去重</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">下载点击</div><div class="ud-val">' +
                esc(String(s.download_clicks != null ? s.download_clicks : 0)) +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">安卓 ' +
                esc(String(s.apk_clicks != null ? s.apk_clicks : 0)) +
                ' · iOS ' +
                esc(String(s.ios_clicks != null ? s.ios_clicks : 0)) +
                '</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">下载人数</div><div class="ud-val">' +
                esc(String(s.download_uv != null ? s.download_uv : 0)) +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">安卓 UV ' +
                esc(String(s.apk_uv != null ? s.apk_uv : 0)) +
                ' · iOS UV ' +
                esc(String(s.ios_uv != null ? s.ios_uv : 0)) +
                '</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">下载率</div><div class="ud-val">' +
                esc(s.download_rate_pct || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">下载人数 / UV</div></div>';
            html += '</div>';

            var daily = Array.isArray(data.daily) ? data.daily : [];
            html +=
                '<div class="device-stats-charts-wrap" style="margin-bottom:16px;"><div class="device-stats-chart-card chart-card-wide"><h4>浏览 / 下载</h4><div class="chart-canvas-wrap chart-canvas-wrap-trend"><canvas id="abcInstallDailyChart" aria-label="ABC渠道每日浏览与下载"></canvas></div></div></div>';

            var hourly = data.hourly && Array.isArray(data.hourly.by_hour) ? data.hourly.by_hour : [];
            html +=
                '<div class="device-stats-charts-wrap" style="margin-bottom:16px;"><div class="device-stats-chart-card chart-card-wide"><h4>24 小时访客 / 下载</h4><div class="chart-canvas-wrap chart-canvas-wrap-trend"><canvas id="abcInstallHourlyChart" aria-label="ABC渠道24小时分布"></canvas></div></div></div>';

            html += '<div class="scroll-x" style="margin-bottom:16px;"><table><thead><tr>';
            html +=
                '<th>日期</th><th>浏览 PV</th><th>访客 UV</th><th>下载点击</th><th>下载人数</th><th>安卓</th><th>iOS</th></tr></thead><tbody>';
            if (!daily.length) {
                html += '<tr><td colspan="7">区间内暂无 abc 下载页数据</td></tr>';
            } else {
                daily.forEach(function (row) {
                    html += '<tr>';
                    html += '<td>' + esc(row.date || '—') + '</td>';
                    html += '<td>' + esc(String(row.view_pv != null ? row.view_pv : 0)) + '</td>';
                    html += '<td>' + esc(String(row.view_uv != null ? row.view_uv : 0)) + '</td>';
                    html +=
                        '<td>' +
                        esc(String(row.download_clicks != null ? row.download_clicks : 0)) +
                        '</td>';
                    html +=
                        '<td>' + esc(String(row.download_uv != null ? row.download_uv : 0)) + '</td>';
                    html += '<td>' + esc(String(row.apk_clicks != null ? row.apk_clicks : 0)) + '</td>';
                    html += '<td>' + esc(String(row.ios_clicks != null ? row.ios_clicks : 0)) + '</td>';
                    html += '</tr>';
                });
            }
            html += '</tbody></table></div>';

            var recent = Array.isArray(data.recent) ? data.recent : [];
            html += '<details class="page-hint-details"><summary>最近浏览 / 下载</summary>';
            html += '<div class="scroll-x" style="margin-top:8px;"><table><thead><tr>';
            html += '<th>时间</th><th>事件</th><th>IP</th><th>设备</th></tr></thead><tbody>';
            if (!recent.length) {
                html += '<tr><td colspan="4">暂无明细</td></tr>';
            } else {
                recent.forEach(function (row) {
                    html += '<tr>';
                    html += '<td>' + esc(row.created_at ? String(row.created_at) : '—') + '</td>';
                    html += '<td>' + esc(row.event_label || row.event_key || '—') + '</td>';
                    html += '<td>' + esc(row.ip || '—') + '</td>';
                    html += '<td>' + esc(row.user_agent || '—') + '</td>';
                    html += '</tr>';
                });
            }
            html += '</tbody></table></div></details>';
            el.innerHTML = html;

            if (typeof Chart !== 'undefined' && daily.length) {
                var dailyCanvas = document.getElementById('abcInstallDailyChart');
                if (dailyCanvas) {
                    _abcInstallChartInstances.push(
                        new Chart(dailyCanvas, {
                            type: 'line',
                            data: {
                                labels: daily.map(function (row) {
                                    return row.date ? String(row.date).slice(5) : '';
                                }),
                                datasets: [
                                    {
                                        label: '访客 UV',
                                        data: daily.map(function (row) {
                                            return Number(row.view_uv) || 0;
                                        }),
                                        borderColor: '#1e6fff',
                                        backgroundColor: 'rgba(30, 111, 255, 0.12)',
                                        tension: 0.28,
                                        fill: true,
                                        borderWidth: 2.5,
                                        pointRadius: 0,
                                        pointHoverRadius: 4
                                    },
                                    {
                                        label: '下载人数',
                                        data: daily.map(function (row) {
                                            return Number(row.download_uv) || 0;
                                        }),
                                        borderColor: '#0f9f6e',
                                        backgroundColor: 'rgba(15, 159, 110, 0.10)',
                                        tension: 0.28,
                                        fill: true,
                                        borderWidth: 2.5,
                                        pointRadius: 0,
                                        pointHoverRadius: 4
                                    }
                                ]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                interaction: { mode: 'index', intersect: false },
                                plugins: {
                                    legend: { position: 'bottom', labels: { usePointStyle: true } }
                                },
                                scales: {
                                    x: { grid: { display: false } },
                                    y: {
                                        beginAtZero: true,
                                        ticks: { precision: 0 },
                                        grid: { color: 'rgba(148, 163, 184, 0.25)' }
                                    }
                                }
                            }
                        })
                    );
                }
            }
            if (typeof Chart !== 'undefined' && hourly.length) {
                var hourCanvas = document.getElementById('abcInstallHourlyChart');
                if (hourCanvas) {
                    _abcInstallChartInstances.push(
                        new Chart(hourCanvas, {
                            type: 'bar',
                            data: {
                                labels: hourly.map(function (row) {
                                    return String(row.hour).padStart(2, '0') + ':00';
                                }),
                                datasets: [
                                    {
                                        label: '访客 UV',
                                        data: hourly.map(function (row) {
                                            return Number(row.view_uv) || 0;
                                        }),
                                        backgroundColor: 'rgba(30, 111, 255, 0.55)'
                                    },
                                    {
                                        label: '下载人数',
                                        data: hourly.map(function (row) {
                                            return Number(row.download_uv) || 0;
                                        }),
                                        backgroundColor: 'rgba(15, 159, 110, 0.55)'
                                    }
                                ]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                interaction: { mode: 'index', intersect: false },
                                plugins: {
                                    legend: { position: 'bottom', labels: { usePointStyle: true } }
                                },
                                scales: {
                                    x: { grid: { display: false } },
                                    y: {
                                        beginAtZero: true,
                                        ticks: { precision: 0 },
                                        grid: { color: 'rgba(148, 163, 184, 0.25)' }
                                    }
                                }
                            }
                        })
                    );
                }
            }
        }

        /* ========== 个税记录维护 ========== */
        var _taxEditCurrentUser = '';
        var _taxEditRecords = [];
        var _taxEditBound = false;
        var _taxEditBatchInited = false;

        function ensureAdminTaxBatchCtx() {
            window.__adminTaxBatchCtx = window.__adminTaxBatchCtx || {};
            window.__adminTaxBatchCtx.fetch = window.adminFetch || adminFetch;
            window.__adminTaxBatchCtx.reloadUser = function (username) {
                return loadTaxRecordsEditUser(username, { fromBatch: true });
            };
            if (typeof window.authFetch !== 'function') {
                window.authFetch = function () {
                    return Promise.reject(new Error('C 端 authFetch 在管理后台不可用'));
                };
            }
        }

        function syncAdminTaxBatchPanel(records, opts) {
            opts = opts || {};
            ensureAdminTaxBatchCtx();
            var root = document.getElementById('adminTaxBatchRoot');
            var btnBatch = document.getElementById('btnTaxEditBatch');
            var prevUser = window.__adminTaxBatchCtx.username || '';
            if (!_taxEditCurrentUser) {
                if (root) root.hidden = true;
                if (btnBatch) btnBatch.disabled = true;
                window.__adminTaxBatchCtx.username = '';
                window.__consultRecordsCache = [];
                return;
            }
            var userChanged = prevUser && prevUser !== _taxEditCurrentUser;
            window.__adminTaxBatchCtx.username = _taxEditCurrentUser;
            window.__consultRecordsCache = Array.isArray(records) ? records.slice() : [];
            if (btnBatch) btnBatch.disabled = false;
            if (!_taxEditBatchInited) {
                _taxEditBatchInited = true;
                try {
                    if (typeof initBatchEmploymentRows === 'function') initBatchEmploymentRows();
                    if (typeof initBatchTaxDraftAutosave === 'function') initBatchTaxDraftAutosave();
                    if (typeof initBatchCompanyHistoryUi === 'function') initBatchCompanyHistoryUi();
                    if (typeof initConsultRecordsUx === 'function') initConsultRecordsUx();
                } catch (eInit) {
                    console.warn('admin tax batch init', eInit);
                }
            } else if (userChanged && !opts.keepForm) {
                var list = document.getElementById('batch_employment_list');
                if (list) list.innerHTML = '';
                window.__batchTaxUserExpanded = true;
                try {
                    if (typeof initBatchEmploymentRows === 'function') initBatchEmploymentRows();
                } catch (eRe) {}
            }
            try {
                if (typeof syncBatchTaxEmptyState === 'function') syncBatchTaxEmptyState();
            } catch (eSync) {}
        }

        function showAdminTaxBatchPanel() {
            if (!_taxEditCurrentUser) {
                alert('请先加载用户');
                return;
            }
            ensureAdminTaxBatchCtx();
            window.__adminTaxBatchCtx.username = _taxEditCurrentUser;
            var root = document.getElementById('adminTaxBatchRoot');
            if (root) {
                root.hidden = false;
                try {
                    root.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } catch (eScr) {}
            }
            window.__batchTaxUserExpanded = true;
            try {
                if (typeof setBatchTaxCardCollapsed === 'function') setBatchTaxCardCollapsed(false);
                if (typeof syncBatchTaxEmptyState === 'function') syncBatchTaxEmptyState();
            } catch (e0) {}
        }

        function taxEditNum(id, fallback) {
            var el = document.getElementById(id);
            if (!el) return fallback != null ? fallback : 0;
            var n = parseFloat(el.value);
            return isFinite(n) ? n : fallback != null ? fallback : 0;
        }

        function taxEditStr(id) {
            var el = document.getElementById(id);
            return el ? String(el.value || '').trim() : '';
        }

        function hideTaxEditForm() {
            var wrap = document.getElementById('taxEditFormWrap');
            if (wrap) {
                wrap.classList.add('is-hidden');
                wrap.style.display = '';
            }
            var idEl = document.getElementById('taxEditId');
            if (idEl) idEl.value = '';
        }

        function fillTaxEditForm(rec) {
            rec = rec || {};
            var set = function (id, v) {
                var el = document.getElementById(id);
                if (el) el.value = v != null && v !== '' ? String(v) : '';
            };
            set('taxEditId', rec.id || '');
            set('taxEditYear', rec.year != null ? rec.year : new Date().getFullYear());
            set('taxEditMonth', rec.month != null ? rec.month : new Date().getMonth() + 1);
            set('taxEditCompany', rec.company_name || '');
            set('taxEditCompanyTaxId', rec.company_tax_id || '');
            set('taxEditAuthority', rec.tax_authority || '');
            set('taxEditIncomeType', rec.income_type || '工资薪金');
            set('taxEditIncomeSubtype', rec.income_subtype || '正常工资薪金');
            set('taxEditIncome', rec.income != null ? rec.income : '0');
            set('taxEditIncomePeriod', rec.income_this_period != null ? rec.income_this_period : '0');
            set('taxEditTaxReported', rec.tax_reported != null ? rec.tax_reported : '0');
            set('taxEditDeductionFee', rec.deduction_fee != null ? rec.deduction_fee : '5000');
            set('taxEditSpecial', rec.special_deduction != null ? rec.special_deduction : '0');
            set('taxEditPension', rec.pension_insurance != null ? rec.pension_insurance : '0');
            set('taxEditMedical', rec.medical_insurance != null ? rec.medical_insurance : '0');
            set('taxEditUnemp', rec.unemployment_insurance != null ? rec.unemployment_insurance : '0');
            set('taxEditHousing', rec.housing_fund != null ? rec.housing_fund : '0');
            set('taxEditOther', rec.other_deduction != null ? rec.other_deduction : '0');
            set('taxEditDonation', rec.donation_deduction != null ? rec.donation_deduction : '0');
            set('taxEditTaxFree', rec.tax_free_income != null ? rec.tax_free_income : '0');
            set('taxEditReportChannel', rec.report_channel || '其他');
            set('taxEditReportDate', rec.report_date || '');
            var title = document.getElementById('taxEditFormTitle');
            if (title) title.textContent = rec.id ? '编辑记录' : '新增记录';
            var wrap = document.getElementById('taxEditFormWrap');
            if (wrap) {
                wrap.classList.remove('is-hidden');
                wrap.style.display = '';
                try {
                    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } catch (eScr) {}
            }
        }

        function collectTaxEditForm() {
            var year = parseInt(taxEditStr('taxEditYear'), 10);
            var month = parseInt(taxEditStr('taxEditMonth'), 10);
            var id = taxEditStr('taxEditId');
            var record = {
                year: year,
                month: month,
                company_name: taxEditStr('taxEditCompany'),
                company_tax_id: taxEditStr('taxEditCompanyTaxId'),
                tax_authority: taxEditStr('taxEditAuthority'),
                income_type: taxEditStr('taxEditIncomeType') || '工资薪金',
                income_subtype: taxEditStr('taxEditIncomeSubtype') || '正常工资薪金',
                income: taxEditNum('taxEditIncome', 0),
                income_this_period: taxEditNum('taxEditIncomePeriod', 0),
                tax_reported: taxEditNum('taxEditTaxReported', 0),
                deduction_fee: taxEditNum('taxEditDeductionFee', 5000),
                special_deduction: taxEditNum('taxEditSpecial', 0),
                pension_insurance: taxEditNum('taxEditPension', 0),
                medical_insurance: taxEditNum('taxEditMedical', 0),
                unemployment_insurance: taxEditNum('taxEditUnemp', 0),
                housing_fund: taxEditNum('taxEditHousing', 0),
                other_deduction: taxEditNum('taxEditOther', 0),
                donation_deduction: taxEditNum('taxEditDonation', 0),
                tax_free_income: taxEditNum('taxEditTaxFree', 0),
                report_channel: taxEditStr('taxEditReportChannel') || '其他',
                report_date: taxEditStr('taxEditReportDate') || null,
                tax_period:
                    isFinite(year) && isFinite(month)
                        ? year + '-' + String(month).padStart(2, '0')
                        : ''
            };
            if (id) record.id = id;
            return record;
        }

        function renderTaxEditList(records) {
            var el = document.getElementById('taxEditListMount');
            if (!el) return;
            if (!records || !records.length) {
                el.innerHTML = '<p class="hint" style="margin:0;">暂无个税记录，可点击「新增记录」。</p>';
                return;
            }
            var html =
                '<div class="scroll-x"><table><thead><tr>' +
                '<th>所属期</th><th>公司</th><th>收入</th><th>税额</th><th>更新</th><th>操作</th>' +
                '</tr></thead><tbody>';
            records.forEach(function (raw, idx) {
                var r = normalizeAdminTaxRecordRow(raw);
                html +=
                    '<tr><td>' +
                    esc(r.tax_period || (r.year || '') + '-' + (r.month || '')) +
                    '</td><td class="cell-break">' +
                    esc(r.company_name || '—') +
                    '</td><td>' +
                    esc(r.income != null ? r.income : '—') +
                    '</td><td>' +
                    esc(r.tax_reported != null ? r.tax_reported : '—') +
                    '</td><td>' +
                    esc(r.updated_at ? formatDt(r.updated_at) : '—') +
                    '</td><td>' +
                    '<button type="button" class="btn-page btn-tax-edit" data-idx="' +
                    idx +
                    '">编辑</button> ' +
                    '<button type="button" class="btn-page btn-tax-del" data-id="' +
                    esc(r.id || '') +
                    '">删除</button>' +
                    '</td></tr>';
            });
            html += '</tbody></table></div>';
            el.innerHTML = html;
            el.querySelectorAll('.btn-tax-edit').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var i = parseInt(btn.getAttribute('data-idx'), 10);
                    if (!isFinite(i) || !_taxEditRecords[i]) return;
                    fillTaxEditForm(_taxEditRecords[i]);
                });
            });
            el.querySelectorAll('.btn-tax-del').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = btn.getAttribute('data-id') || '';
                    if (!id || !_taxEditCurrentUser) return;
                    if (!window.confirm('确认软删除该条个税记录？用户端将不再显示。')) return;
                    adminFetch('api/admin/user-tax-records', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'delete_record',
                            username: _taxEditCurrentUser,
                            id: id
                        })
                    })
                        .then(function (r) {
                            return (window.adminParseJson||function(r){return r.json();})(r);
                        })
                        .then(function (j) {
                            if (j.code !== 200) {
                                alert(j.msg || '删除失败');
                                return;
                            }
                            hideTaxEditForm();
                            loadTaxRecordsEditUser(_taxEditCurrentUser);
                        })
                        .catch(function () {
                            alert('删除失败');
                        });
                });
            });
        }

        function loadTaxRecordsEditUser(username, opts) {
            opts = opts || {};
            var meta = document.getElementById('taxEditUserMeta');
            var list = document.getElementById('taxEditListMount');
            var btnNew = document.getElementById('btnTaxEditNew');
            var btnBatch = document.getElementById('btnTaxEditBatch');
            username = String(username || '').trim();
            if (!username) {
                if (meta) meta.textContent = '请输入用户名';
                return Promise.resolve(null);
            }
            if (meta && !opts.fromBatch) meta.textContent = '加载中…';
            if (list && !opts.fromBatch) list.textContent = '';
            if (!opts.fromBatch) hideTaxEditForm();
            return adminFetch('api/admin/user-tax-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list', username: username })
            })
                .then(function (r) {
                    return (window.adminParseJson||function(r){return r.json();})(r);
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        if (meta) meta.textContent = j.msg || '加载失败';
                        _taxEditCurrentUser = '';
                        _taxEditRecords = [];
                        if (btnNew) btnNew.disabled = true;
                        if (btnBatch) btnBatch.disabled = true;
                        syncAdminTaxBatchPanel([]);
                        return null;
                    }
                    var d = j.data;
                    _taxEditCurrentUser = d.username || username;
                    _taxEditRecords = Array.isArray(d.records) ? d.records : [];
                    if (btnNew) btnNew.disabled = false;
                    if (btnBatch) btnBatch.disabled = false;
                    if (meta) {
                        meta.textContent =
                            '用户 ' +
                            (d.username || username) +
                            (d.real_name ? '（' + d.real_name + '）' : '') +
                            ' · ' +
                            (d.account_active ? '已激活' : '未激活') +
                            ' · 有效记录 ' +
                            (d.record_count != null ? d.record_count : _taxEditRecords.length) +
                            ' 条';
                    }
                    var nameInput = document.getElementById('taxEditUsername');
                    if (nameInput) nameInput.value = _taxEditCurrentUser;
                    renderTaxEditList(_taxEditRecords);
                    syncAdminTaxBatchPanel(_taxEditRecords, { keepForm: !!opts.fromBatch });
                    if (!opts.fromBatch) {
                        var batchRoot = document.getElementById('adminTaxBatchRoot');
                        if (batchRoot) batchRoot.hidden = false;
                    }
                    return d;
                })
                .catch(function () {
                    if (meta) meta.textContent = '加载失败';
                    if (btnNew) btnNew.disabled = true;
                    if (btnBatch) btnBatch.disabled = true;
                    syncAdminTaxBatchPanel([]);
                    return null;
                });
        }

        function saveTaxEditForm() {
            if (!_taxEditCurrentUser) {
                alert('请先加载用户');
                return;
            }
            var record = collectTaxEditForm();
            if (!record.company_name) {
                alert('请填写扣缴义务人');
                return;
            }
            if (!isFinite(record.year) || !isFinite(record.month)) {
                alert('请填写有效年月');
                return;
            }
            var btn = document.getElementById('btnTaxEditSave');
            if (btn) btn.disabled = true;
            adminFetch('api/admin/user-tax-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'save_record',
                    username: _taxEditCurrentUser,
                    record: record
                })
            })
                .then(function (r) {
                    return (window.adminParseJson||function(r){return r.json();})(r);
                })
                .then(function (j) {
                    if (btn) btn.disabled = false;
                    if (j.code !== 200) {
                        alert(j.msg || '保存失败');
                        return;
                    }
                    hideTaxEditForm();
                    loadTaxRecordsEditUser(_taxEditCurrentUser);
                })
                .catch(function () {
                    if (btn) btn.disabled = false;
                    alert('保存失败');
                });
        }

        function initTaxRecordsEditPage() {
            if (_taxEditBound) return;
            _taxEditBound = true;
            ensureAdminTaxBatchCtx();
            var btnLoad = document.getElementById('btnTaxEditLoad');
            var btnNew = document.getElementById('btnTaxEditNew');
            var btnBatch = document.getElementById('btnTaxEditBatch');
            var btnSave = document.getElementById('btnTaxEditSave');
            var btnCancel = document.getElementById('btnTaxEditCancel');
            var nameInput = document.getElementById('taxEditUsername');
            if (btnLoad) {
                btnLoad.addEventListener('click', function () {
                    loadTaxRecordsEditUser(nameInput ? nameInput.value : '');
                });
            }
            if (nameInput) {
                nameInput.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        loadTaxRecordsEditUser(nameInput.value);
                    }
                });
            }
            if (btnNew) {
                btnNew.addEventListener('click', function () {
                    if (!_taxEditCurrentUser) {
                        alert('请先加载用户');
                        return;
                    }
                    fillTaxEditForm({});
                });
            }
            if (btnBatch) {
                btnBatch.addEventListener('click', function () {
                    showAdminTaxBatchPanel();
                });
            }
            if (btnSave) btnSave.addEventListener('click', saveTaxEditForm);
            if (btnCancel) btnCancel.addEventListener('click', hideTaxEditForm);
            /* 不依赖 HTML onclick，避免压缩/CSP 导致「一键生成」无响应 */
            var batchSubmit = document.getElementById('batch_submit_employments_btn');
            if (batchSubmit && !batchSubmit.__adminBound) {
                batchSubmit.__adminBound = true;
                batchSubmit.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (!_taxEditCurrentUser) {
                        alert('请先加载用户');
                        return;
                    }
                    ensureAdminTaxBatchCtx();
                    window.__adminTaxBatchCtx.username = _taxEditCurrentUser;
                    if (typeof window.oneClickGenerateBatchTaxRecords === 'function') {
                        window.oneClickGenerateBatchTaxRecords();
                    } else if (typeof oneClickGenerateBatchTaxRecords === 'function') {
                        oneClickGenerateBatchTaxRecords();
                    } else {
                        alert('批量录入脚本未加载，请强制刷新页面后重试');
                    }
                });
            }
            var batchUpdate = document.getElementById('batch_update_employments_btn');
            if (batchUpdate && !batchUpdate.__adminBound) {
                batchUpdate.__adminBound = true;
                batchUpdate.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (typeof window.batchUpdateEmploymentTaxRecords === 'function') {
                        window.batchUpdateEmploymentTaxRecords();
                    } else if (typeof batchUpdateEmploymentTaxRecords === 'function') {
                        batchUpdateEmploymentTaxRecords();
                    }
                });
            }
            var batchBonusOnly = document.querySelector('#adminTaxBatchRoot .batch-bonus-only-btn');
            if (batchBonusOnly && !batchBonusOnly.__adminBound) {
                batchBonusOnly.__adminBound = true;
                batchBonusOnly.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (typeof window.batchAddYearEndBonusOnly === 'function') {
                        window.batchAddYearEndBonusOnly();
                    } else if (typeof batchAddYearEndBonusOnly === 'function') {
                        batchAddYearEndBonusOnly();
                    }
                });
            }
            var batchSeveranceOnly = document.querySelector('#adminTaxBatchRoot .batch-severance-only-btn');
            if (batchSeveranceOnly && !batchSeveranceOnly.__adminBound) {
                batchSeveranceOnly.__adminBound = true;
                batchSeveranceOnly.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (typeof window.batchAddSeveranceOnly === 'function') {
                        window.batchAddSeveranceOnly();
                    } else if (typeof batchAddSeveranceOnly === 'function') {
                        batchAddSeveranceOnly();
                    }
                });
            }
            function bindAdminBatchClick(sel, fnName) {
                var el = document.querySelector(sel);
                if (!el || el.__adminBound) return;
                el.__adminBound = true;
                el.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (typeof window[fnName] === 'function') window[fnName]();
                });
            }
            bindAdminBatchClick('#btnBatchTaxExample', 'fillBatchTaxExample');
            bindAdminBatchClick('#btnBatchTaxEmptyExample', 'fillBatchTaxExample');
            bindAdminBatchClick('#btnBatchTaxPasteImport', 'openTaxPasteImportModal');
            bindAdminBatchClick('#btnBatchTaxEmptyPaste', 'openTaxPasteImportModal');
            bindAdminBatchClick('#batch_exit_edit_btn', 'exitBatchTaxEditMode');
            var addEmpBtn = document.querySelector('#adminTaxBatchRoot .batch-add-emp-btn');
            if (addEmpBtn && !addEmpBtn.__adminBound) {
                addEmpBtn.__adminBound = true;
                addEmpBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (typeof window.addBatchEmpRow === 'function') window.addBatchEmpRow();
                });
            }
            var moreFill = document.getElementById('btnBatchTaxMoreFill') || document.querySelector('#batchTaxMoreMenu .batch-tax-more-item');
            if (moreFill && !moreFill.__adminBound) {
                moreFill.__adminBound = true;
                moreFill.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (typeof window.loadBatchEmploymentsFromExistingRecords === 'function') {
                        window.loadBatchEmploymentsFromExistingRecords();
                    }
                    if (typeof window.closeBatchTaxMoreMenu === 'function') window.closeBatchTaxMoreMenu();
                });
            }
            bindAdminBatchClick('#btnBatchTaxMoreBonus', 'batchAddYearEndBonusOnly');
            bindAdminBatchClick('#btnBatchTaxMoreSeverance', 'batchAddSeveranceOnly');
            var moreBonus = document.getElementById('btnBatchTaxMoreBonus');
            if (moreBonus && moreBonus.__adminBound) {
                moreBonus.addEventListener('click', function () {
                    if (typeof window.closeBatchTaxMoreMenu === 'function') window.closeBatchTaxMoreMenu();
                });
            }
            var moreSeverance = document.getElementById('btnBatchTaxMoreSeverance');
            if (moreSeverance && moreSeverance.__adminBound) {
                moreSeverance.addEventListener('click', function () {
                    if (typeof window.closeBatchTaxMoreMenu === 'function') window.closeBatchTaxMoreMenu();
                });
            }
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

            html += buildAdminShebaoPhotosSectionHtml(username, data.shebao_photos || [], 'ud');

            var safeKey = userDataCertSafeKey(username);
            var latestIssue = data.latest_issue_application || null;
            html +=
                '<div class="ud-certificate-head">' +
                '<div style="color:#666;">纳税记录凭证 <span style="color:#999;font-size:12px;">（激活用户 C 端含公章；可切换对比未激活无章）</span></div>' +
                '<div class="ud-cert-mode-btns">' +
                '<button type="button" class="btn-sm ud-cert-mode-btn is-active" id="ud_certificate_stamp_btn_' +
                safeKey +
                '">含公章（激活）</button>' +
                '<button type="button" class="btn-sm ud-cert-mode-btn" id="ud_certificate_client_btn_' +
                safeKey +
                '" data-u="' +
                esc(username) +
                '">无章（未激活）</button>' +
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
            container.textContent = showStamp ? '正在生成含公章（激活态）预览…' : '正在生成无章（未激活）预览…';
            try {
                var app = window.TaxIssueCertificate.buildAppFromAdminDetail(data);
                return window.TaxIssueCertificate.renderDataUrl(app, { showStamp: showStamp })
                    .then(function (urlOrUrls) {
                        var urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
                        var title = showStamp ? '含公章（激活）' : '无章（未激活）';
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
                                        esc(downloadBase + (showStamp ? '_含公章' : '_无章') + pageSuffix + '.png') +
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
                    altSuffix: showStamp ? '（激活含章）' : '（未激活无章）'
                }).then(function () {
                    certCache[cacheKey] = el.innerHTML;
                });
            }

            if (!canRender) {
                renderUserDataCertificateImages(el, data, { showStamp: true, altSuffix: '（激活含章）' });
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
            var tbody = document.getElementById('userDataTbody');
            var usernameEl = document.getElementById('udFilterUsername');
            var realNameEl = document.getElementById('udFilterRealName');
            var companyEl = document.getElementById('udFilterCompany');
            var idCardEl = document.getElementById('udFilterIdCard');
            var familyEl = document.getElementById('udFilterFamily');
            var bankEl = document.getElementById('udFilterBank');
            var username = usernameEl ? usernameEl.value.trim() : '';
            var realName = realNameEl ? realNameEl.value.trim() : '';
            var company = companyEl ? companyEl.value.trim() : '';
            var idCard = idCardEl ? idCardEl.value.trim() : '';
            var hasFamily = familyEl ? familyEl.value : '';
            var hasBank = bankEl ? bankEl.value : '';
            if (stat) stat.textContent = '列表加载中…';
            if (tbody) tbody.innerHTML = '<tr><td colspan="10">加载中…</td></tr>';
            var url =
                'api/admin/user-data?page=' +
                userDataPage +
                '&limit=' +
                userDataLimit;
            if (username) url += '&username=' + encodeURIComponent(username);
            if (realName) url += '&real_name=' + encodeURIComponent(realName);
            if (company) url += '&company=' + encodeURIComponent(company);
            if (idCard) url += '&id_card=' + encodeURIComponent(idCard);
            if (hasFamily !== '') url += '&has_family=' + encodeURIComponent(hasFamily);
            if (hasBank !== '') url += '&has_bank=' + encodeURIComponent(hasBank);
            adminFetch(url)
                .then(function (r) {
                    return (window.adminParseJson||function(r){return r.json();})(r);
                })
                .then(function (data) {
                    if (data.code !== 200 || !data.data) {
                        if (stat) stat.textContent = data.msg || '加载失败';
                        if (tbody) {
                            tbody.innerHTML =
                                '<tr><td colspan="10">' + esc(data.msg || '加载失败') + '</td></tr>';
                        }
                        return;
                    }
                    var list = data.data.items || [];
                    var total = data.data.total || 0;
                    if (stat) stat.textContent = '共 ' + total + ' 条用户数据';
                    var totalPages = Math.ceil(total / userDataLimit) || 1;
                    var pageInfo = document.getElementById('userDataPageInfo');
                    if (pageInfo) {
                        pageInfo.textContent =
                            '第 ' + userDataPage + ' 页 / 共 ' + totalPages + ' 页';
                    }
                    var prevBtn = document.getElementById('userDataPrev');
                    var nextBtn = document.getElementById('userDataNext');
                    if (prevBtn) prevBtn.disabled = userDataPage <= 1;
                    if (nextBtn) nextBtn.disabled = userDataPage >= totalPages;

                    var html = '';
                    try {
                        list.forEach(function (row) {
                            var key = String(row.username || '').replace(/[^a-zA-Z0-9_.-]/g, '_');
                            var fam =
                                row.family_count > 0
                                    ? esc(row.family_summary) +
                                      ' <span style="color:#888;">(' +
                                      row.family_count +
                                      ')</span>'
                                    : '<span style="color:#bbb;">未填写</span>';
                            var bank =
                                row.bank_count > 0
                                    ? esc(row.bank_summary) +
                                      ' <span style="color:#888;">(' +
                                      row.bank_count +
                                      ')</span>'
                                    : '<span style="color:#bbb;">未绑定</span>';
                            html += '<tr>';
                            html += '<td class="cell-break">' + esc(row.username) + '</td>';
                            html += '<td>' + esc(row.real_name || '—') + '</td>';
                            html +=
                                '<td class="cell-break">' +
                                esc(
                                    row.channel_analysis_label ||
                                        row.register_source_channel_label ||
                                        '—'
                                ) +
                                '</td>';
                            html +=
                                '<td class="cell-break">' +
                                esc(row.companies_summary || '—') +
                                '</td>';
                            html +=
                                '<td class="cell-break">' +
                                esc(row.id_card_label || row.id_card || '未填写') +
                                '</td>';
                            html +=
                                '<td class="cell-break">' +
                                esc(row.tax_authorities_summary || '—') +
                                '</td>';
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
                            html +=
                                '<tr id="ud_detail_row_' +
                                key +
                                '" class="users-detail-row" style="display:none;">';
                            html +=
                                '<td colspan="10"><div id="ud_detail_box_' +
                                key +
                                '" style="padding:4px 0;color:#888;">点击「档案」加载完整数据…</div></td>';
                            html += '</tr>';
                        });
                    } catch (renderErr) {
                        console.error('user-data render', renderErr);
                        if (stat) stat.textContent = '列表渲染失败';
                        if (tbody) {
                            tbody.innerHTML =
                                '<tr><td colspan="10">列表渲染失败，请强制刷新后重试</td></tr>';
                        }
                        return;
                    }
                    if (tbody) {
                        tbody.innerHTML = html || '<tr><td colspan="10">暂无数据</td></tr>';
                        tbody.querySelectorAll('.btn-user-data-detail').forEach(function (btn) {
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
                                adminFetch(
                                    'api/admin/user-data/detail?username=' +
                                        encodeURIComponent(name)
                                )
                                    .then(function (r) {
                                        return (window.adminParseJson||function(r){return r.json();})(r);
                                    })
                                    .then(function (d) {
                                        if (d.code !== 200 || !d.data) {
                                            box.textContent = d.msg || '加载失败';
                                            return;
                                        }
                                        box.innerHTML = buildUserDataDetailHtml(name, d.data);
                                        mountUserDataCertificate(name, d.data);
                                        mountAdminShebaoPhotos(name, d.data.shebao_photos || [], 'ud');
                                    })
                                    .catch(function () {
                                        box.textContent = '网络错误';
                                    });
                            };
                        });
                    }
                })
                .catch(function (err) {
                    console.error('user-data load', err);
                    if (stat) stat.textContent = '加载失败';
                    if (tbody) {
                        tbody.innerHTML = '<tr><td colspan="10">加载失败（网络或脚本错误）</td></tr>';
                    }
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
                    return (window.adminParseJson||function(r){return r.json();})(r);
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

        function syncUserActivateCustomWrap() {
            var dur = document.getElementById('userActivateDuration');
            var wrap = document.getElementById('userActivateCustomWrap');
            if (!wrap) return;
            var isCustom = dur && String(dur.value || '') === 'custom';
            if (isCustom) wrap.removeAttribute('hidden');
            else wrap.setAttribute('hidden', '');
        }

        function closeUserActivateModal() {
            var bd = document.getElementById('userActivateBackdrop');
            if (bd) {
                bd.setAttribute('hidden', '');
            }
            userActivateTarget = null;
        }

        function displayUserActivationAmount(u) {
            if (u && u.activation_credit_amount != null && u.activation_credit_amount !== '') {
                return String(u.activation_credit_amount);
            }
            if (u && u.paid_activation_amount != null && Number(u.paid_activation_amount) > 0) {
                return String(u.paid_activation_amount);
            }
            return '';
        }

        function saveUserActivationCredit(username, inputEl) {
            if (!canViewActivationCredit()) return;
            var name = String(username || '').trim();
            if (!name) return;
            var input =
                inputEl ||
                document.querySelector('.user-credit-amt-input[data-u="' + name + '"]');
            var raw = input ? String(input.value || '').trim() : '';
            if (input) {
                if (input.getAttribute('data-saving') === '1') return;
                input.setAttribute('data-saving', '1');
                input.disabled = true;
            }
            adminFetch('api/admin/user-activation-credit', {
                method: 'POST',
                body: JSON.stringify({ username: name, credit_amount: raw })
            })
                .then(function (r) {
                    return (window.adminParseJson || function (res) {
                        return res.json();
                    })(r);
                })
                .then(function (d) {
                    if (d && d.code === 200) {
                        if (input && d.data && d.data.activation_credit_amount != null) {
                            input.value = String(d.data.activation_credit_amount);
                        } else if (input && raw === '') {
                            input.value = '';
                        }
                        return;
                    }
                    alert((d && d.msg) || '保存失败');
                })
                .catch(function () {
                    alert('网络错误');
                })
                .then(function () {
                    if (input) {
                        input.removeAttribute('data-saving');
                        input.disabled = false;
                        try {
                            input.focus();
                        } catch (eFocus) {}
                    }
                });
        }

        function openUserActivateModal(username, opts) {
            userActivateTarget = username;
            var metaEl = document.getElementById('userActivateMeta');
            if (metaEl) {
                metaEl.textContent = opts && opts.expired
                    ? '账号「' + username + '」试用已过期，请重新选择激活时长并开通（与未激活相同）。'
                    : '为账号「' + username + '」选择激活时长并确认开通。';
            }
            var dur = document.getElementById('userActivateDuration');
            if (dur) dur.value = '7';
            var daysEl = document.getElementById('userActivateDays');
            var hoursEl = document.getElementById('userActivateHours');
            var minutesEl = document.getElementById('userActivateMinutes');
            if (daysEl) daysEl.value = '7';
            if (hoursEl) hoursEl.value = '0';
            if (minutesEl) minutesEl.value = '0';
            var creditEl = document.getElementById('userActivateCreditAmount');
            if (creditEl) {
                creditEl.value = opts && opts.amount != null ? String(opts.amount) : '';
            }
            syncUserActivateCustomWrap();
            var bd = document.getElementById('userActivateBackdrop');
            if (bd) {
                bd.removeAttribute('hidden');
            }
            if (dur) {
                try {
                    dur.focus();
                } catch (eFocus) {}
            }
        }

        function readUserActivateGrantPayload() {
            var durEl = document.getElementById('userActivateDuration');
            var v = durEl ? String(durEl.value || '').trim() : '7';
            if (v === 'permanent') {
                return { permanent: true, grant_days: 0, grant_hours: 0, grant_minutes: 0 };
            }
            if (v === 'custom') {
                var daysEl = document.getElementById('userActivateDays');
                var hoursEl = document.getElementById('userActivateHours');
                var minutesEl = document.getElementById('userActivateMinutes');
                var days = daysEl ? parseInt(daysEl.value, 10) : 0;
                var hours = hoursEl ? parseInt(hoursEl.value, 10) : 0;
                var minutes = minutesEl ? parseInt(minutesEl.value, 10) : 0;
                if (!isFinite(days) || days < 0) days = 0;
                if (!isFinite(hours) || hours < 0) hours = 0;
                if (!isFinite(minutes) || minutes < 0) minutes = 0;
                if (days < 1 && hours < 1 && minutes < 1) {
                    return { error: '自定义时长至少填写 1 天/小时/分钟中的一项' };
                }
                return { permanent: false, grant_days: days, grant_hours: hours, grant_minutes: minutes };
            }
            var n = parseInt(v, 10);
            if (!isFinite(n) || n < 1) n = 7;
            return { permanent: false, grant_days: n, grant_hours: 0, grant_minutes: 0 };
        }

        function submitUserActivate() {
            if (!userActivateTarget) {
                return;
            }
            var grant = readUserActivateGrantPayload();
            if (grant.error) {
                alert(grant.error);
                return;
            }
            var confirmBtn = document.getElementById('userActivateConfirm');
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.textContent = '激活中…';
            }
            var body = { username: userActivateTarget };
            if (grant.permanent) {
                body.permanent = true;
            } else {
                body.grant_days = grant.grant_days;
                body.grant_hours = grant.grant_hours;
                body.grant_minutes = grant.grant_minutes;
            }
            var creditEl = document.getElementById('userActivateCreditAmount');
            if (canViewActivationCredit() && creditEl && String(creditEl.value || '').trim() !== '') {
                body.credit_amount = creditEl.value;
            }
            adminFetch('api/admin/user-activate', {
                method: 'POST',
                body: JSON.stringify(body)
            })
                .then(function (r) {
                    return (window.adminParseJson||function(r){return r.json();})(r);
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

        function renameTaxDailyDayLabel(ymd) {
            var s = String(ymd || '');
            if (s.length >= 10) return s.slice(5);
            return s;
        }

        function renameTaxDailyCellClass(count, isToday) {
            var n = Number(count) || 0;
            var cls = 'day';
            if (isToday) cls += ' is-today';
            if (n >= 30) cls += ' day-hot';
            else if (n >= 10) cls += ' day-mid';
            return cls;
        }

        function loadRenameTaxDaily() {
            var sel = document.getElementById('renameTaxDailyDays');
            var statEl = document.getElementById('renameTaxDailyStat');
            var hintEl = document.getElementById('renameTaxDailyPeriodHint');
            var thead = document.getElementById('renameTaxDailyThead');
            var tbody = document.getElementById('renameTaxDailyTbody');
            if (!tbody) return;
            var days = analyticsPeriodVal(sel);
            if (statEl) statEl.textContent = '加载中…';
            adminFetch('api/admin/rename-tax-daily?days=' + encodeURIComponent(days))
                .then(function (r) {
                    return (window.adminParseJson||function(r){return r.json();})(r);
                })
                .then(function (data) {
                    if (!data || data.code !== 200 || !data.data) {
                        if (statEl) statEl.textContent = (data && data.msg) || '加载失败';
                        tbody.innerHTML = '<tr><td colspan="5">加载失败</td></tr>';
                        return;
                    }
                    var d = data.data;
                    var dates = d.dates || [];
                    var users = d.users || [];
                    var dayTotals = d.day_totals || [];
                    var todayKey = d.today_key || '';
                    if (statEl) {
                        statEl.textContent =
                            '共 ' +
                            (d.user_count || 0) +
                            ' 个账号（改名超过 ' +
                            (d.name_changes_gt || 5) +
                            ' 次或修改个税天数大于 ' +
                            (d.tax_mod_days_gt || 8) +
                            ' 天，已排除永久免改名/改税），区间内个税修改 ' +
                            (d.period_tax_edits || 0) +
                            ' 次';
                    }
                    if (hintEl) {
                        hintEl.innerHTML =
                            window.AdminAnalyticsPeriod && AdminAnalyticsPeriod.hintHtml
                                ? AdminAnalyticsPeriod.hintHtml(d)
                                : '';
                    }
                    var head =
                        '<tr>' +
                        '<th class="col-user">账号</th>' +
                        '<th>当前姓名</th>' +
                        '<th>改名</th>' +
                        '<th>修改天数</th>' +
                        '<th>标记</th>' +
                        '<th>区间合计</th>';
                    dates.forEach(function (ymd) {
                        var isToday = ymd === todayKey;
                        head +=
                            '<th class="day' +
                            (isToday ? ' is-today' : '') +
                            '" title="' +
                            esc(ymd) +
                            (isToday ? '（今天）' : '') +
                            '">' +
                            esc(renameTaxDailyDayLabel(ymd)) +
                            '</th>';
                    });
                    head += '</tr>';
                    if (thead) thead.innerHTML = head;

                    if (!users.length) {
                        tbody.innerHTML =
                            '<tr><td colspan="' +
                            (6 + dates.length) +
                            '">该区间没有符合条件的账号</td></tr>';
                        return;
                    }
                    var html = '';
                    var sumNameChanges = 0;
                    var sumTaxModDays = 0;
                    users.forEach(function (u) {
                        var nameChanges = Number(u.name_change_count) || 0;
                        var taxModDays = Number(u.tax_mod_days) || 0;
                        sumNameChanges += nameChanges;
                        sumTaxModDays += taxModDays;
                        html += '<tr>';
                        html +=
                            '<td class="col-user"><button type="button" class="btn-rename-user" data-u="' +
                            esc(u.username) +
                            '">' +
                            esc(u.username) +
                            '</button></td>';
                        html += '<td>' + esc(u.real_name || '—') + '</td>';
                        html += '<td>' + esc(String(nameChanges)) + '</td>';
                        html += '<td>' + esc(String(taxModDays)) + '</td>';
                        html +=
                            '<td>' +
                            (u.is_peer_account
                                ? '<span style="display:inline-block;padding:1px 6px;border-radius:8px;background:#fef2f2;color:#b91c1c;font-size:11px;white-space:nowrap;" title="个税修改天数超过阈值">同行</span>'
                                : '<span style="color:#bbb;">—</span>') +
                            '</td>';
                        html += '<td>' + esc(String(u.period_tax_edits || 0)) + '</td>';
                        (u.daily || []).forEach(function (n, i) {
                            var ymd = dates[i] || '';
                            var cnt = Number(n) || 0;
                            html +=
                                '<td class="' +
                                renameTaxDailyCellClass(cnt, ymd === todayKey) +
                                '">' +
                                (cnt > 0 ? esc(String(cnt)) : '<span style="color:#bbb;">—</span>') +
                                '</td>';
                        });
                        html += '</tr>';
                    });
                    if (dayTotals.length) {
                        html += '<tr>';
                        html +=
                            '<td class="col-user">合计</td><td></td><td>' +
                            esc(String(sumNameChanges)) +
                            '</td><td>' +
                            esc(String(sumTaxModDays)) +
                            '</td><td></td>';
                        html += '<td>' + esc(String(d.period_tax_edits || 0)) + '</td>';
                        dayTotals.forEach(function (n, i) {
                            var ymd = dates[i] || '';
                            var cnt = Number(n) || 0;
                            html +=
                                '<td class="' +
                                renameTaxDailyCellClass(cnt, ymd === todayKey) +
                                '">' +
                                (cnt > 0 ? esc(String(cnt)) : '—') +
                                '</td>';
                        });
                        html += '</tr>';
                    }
                    tbody.innerHTML = html;
                    tbody.querySelectorAll('.btn-rename-user').forEach(function (btn) {
                        btn.onclick = function () {
                            jumpToRegisteredUser(btn.getAttribute('data-u'));
                        };
                    });
                })
                .catch(function () {
                    if (statEl) statEl.textContent = '网络错误';
                    tbody.innerHTML = '<tr><td colspan="5">网络错误</td></tr>';
                });
        }

        /* ========== User Management — Registered Users ========== */
        var pendingHighlightUsername = '';

        function setFilterSameRegisterIp(on) {
            var el = document.getElementById('filterSameRegisterIp');
            if (el) el.checked = !!on;
        }

        /** 按某账号的注册 IP 查出该 IP 下全部账号 */
        function searchSameRegisterIpUsers(username) {
            var name = String(username || '').trim();
            if (!name) return;
            var usernameEl = document.getElementById('filterUsername');
            var realNameEl = document.getElementById('filterRealName');
            var exactEl = document.getElementById('filterExact');
            var riskEl = document.getElementById('filterRisk');
            var activeEl = document.getElementById('filterActive');
            var bannedEl = document.getElementById('filterBanned');
            var taxModEl = document.getElementById('filterTaxModifiedToday');
            var loginInactiveEl = document.getElementById('filterLoginInactive');
            var nameChangesGtEl = document.getElementById('filterNameChangesGt');
            var taxModDaysGtEl = document.getElementById('filterTaxModDaysGt');
            var peerEl = document.getElementById('filterPeerAccount');
            var whitelistEl = document.getElementById('filterWhitelist');
            var agentEl = document.getElementById('filterAgent');
            var d1El = document.getElementById('filterD1Return');
            var highIncomeEl = document.getElementById('filterHighIncome');
            if (usernameEl) usernameEl.value = name;
            if (realNameEl) realNameEl.value = '';
            if (exactEl) exactEl.checked = false;
            setFilterSameRegisterIp(true);
            if (riskEl) riskEl.value = '';
            if (activeEl) activeEl.value = '';
            if (bannedEl) bannedEl.value = '';
            if (taxModEl) taxModEl.value = '';
            if (loginInactiveEl) loginInactiveEl.value = '';
            if (nameChangesGtEl) nameChangesGtEl.value = '';
            if (taxModDaysGtEl) taxModDaysGtEl.value = '';
            if (peerEl) peerEl.value = '';
            if (whitelistEl) whitelistEl.value = '';
            if (agentEl) agentEl.value = '';
            if (d1El) d1El.value = '';
            if (highIncomeEl) highIncomeEl.value = '';
            pendingHighlightUsername = name;
            userPage = 1;
            var alreadyUsers = normalizeAdminPage(location.hash) === 'users';
            if (alreadyUsers) {
                loadUsers(1);
            } else {
                location.hash = 'users';
            }
        }

        /** 从激活码等入口跳到注册用户列表并定位账号 */
        function jumpToRegisteredUser(username) {
            var name = String(username || '').trim();
            if (!name) return;
            var usernameEl = document.getElementById('filterUsername');
            var realNameEl = document.getElementById('filterRealName');
            var exactEl = document.getElementById('filterExact');
            var riskEl = document.getElementById('filterRisk');
            var activeEl = document.getElementById('filterActive');
            var bannedEl = document.getElementById('filterBanned');
            var taxModEl = document.getElementById('filterTaxModifiedToday');
            var loginInactiveEl = document.getElementById('filterLoginInactive');
            var nameChangesGtEl = document.getElementById('filterNameChangesGt');
            var taxModDaysGtEl = document.getElementById('filterTaxModDaysGt');
            var peerEl = document.getElementById('filterPeerAccount');
            var whitelistEl = document.getElementById('filterWhitelist');
            var agentEl = document.getElementById('filterAgent');
            var d1El = document.getElementById('filterD1Return');
            var highIncomeEl = document.getElementById('filterHighIncome');
            if (usernameEl) usernameEl.value = name;
            if (realNameEl) realNameEl.value = '';
            if (exactEl) exactEl.checked = true;
            setFilterSameRegisterIp(false);
            if (riskEl) riskEl.value = '';
            if (activeEl) activeEl.value = '';
            if (bannedEl) bannedEl.value = '';
            if (taxModEl) taxModEl.value = '';
            if (loginInactiveEl) loginInactiveEl.value = '';
            if (nameChangesGtEl) nameChangesGtEl.value = '';
            if (taxModDaysGtEl) taxModDaysGtEl.value = '';
            if (peerEl) peerEl.value = '';
            if (whitelistEl) whitelistEl.value = '';
            if (agentEl) agentEl.value = '';
            if (d1El) d1El.value = '';
            if (highIncomeEl) highIncomeEl.value = '';
            pendingHighlightUsername = name;
            userPage = 1;
            var alreadyUsers = normalizeAdminPage(location.hash) === 'users';
            if (alreadyUsers) {
                applyAdminRoute({ force: true });
            } else {
                location.hash = 'users';
            }
        }

        function highlightPendingUserRow() {
            var target = String(pendingHighlightUsername || '').trim();
            if (!target) return;
            pendingHighlightUsername = '';
            var tbody = document.getElementById('userTbody');
            if (!tbody) return;
            var rows = tbody.querySelectorAll('tr[data-username]');
            var hit = null;
            rows.forEach(function (tr) {
                if (String(tr.getAttribute('data-username') || '') === target) {
                    hit = tr;
                }
            });
            if (!hit) return;
            hit.classList.add('users-row-highlight');
            try {
                hit.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (eScroll) {
                try {
                    hit.scrollIntoView(true);
                } catch (e2) {}
            }
            setTimeout(function () {
                hit.classList.remove('users-row-highlight');
            }, 3200);
        }

        function readFilterGtNumber(el) {
            if (!el) return '';
            var raw = String(el.value || '').trim();
            if (raw === '') return '';
            var n = parseInt(raw, 10);
            if (!isFinite(n) || n < 0) return '';
            if (n > 9999) n = 9999;
            return String(n);
        }

        function loadUsers(p) {
            ensureUserDetailPagesToggleDelegation();
            syncActivationCreditVisibility();
            if (p != null) userPage = p;
            
            var username = document.getElementById('filterUsername').value.trim();
            var realName = document.getElementById('filterRealName').value.trim();
            var active = document.getElementById('filterActive').value;
            var banned = document.getElementById('filterBanned').value;
            var exactEl = document.getElementById('filterExact');
            var sameIpEl = document.getElementById('filterSameRegisterIp');
            var riskEl = document.getElementById('filterRisk');
            var exact = exactEl && exactEl.checked;
            var sameRegisterIp = !!(sameIpEl && sameIpEl.checked && username);
            var risk = riskEl ? riskEl.value : '';
            var taxModEl = document.getElementById('filterTaxModifiedToday');
            var taxModifiedToday = taxModEl ? taxModEl.value : '';
            var loginInactiveEl = document.getElementById('filterLoginInactive');
            var loginInactiveDays = loginInactiveEl ? loginInactiveEl.value : '';
            var nameChangesGtEl = document.getElementById('filterNameChangesGt');
            var nameChangesGt = readFilterGtNumber(nameChangesGtEl);
            var taxModDaysGtEl = document.getElementById('filterTaxModDaysGt');
            var taxModDaysGt = readFilterGtNumber(taxModDaysGtEl);
            var peerEl = document.getElementById('filterPeerAccount');
            var peerAccount = peerEl ? String(peerEl.value || '').trim() : '';
            var whitelistEl = document.getElementById('filterWhitelist');
            var whitelist = whitelistEl ? String(whitelistEl.value || '').trim() : '';
            var agentEl = document.getElementById('filterAgent');
            var agentFlag = agentEl ? String(agentEl.value || '').trim() : '';
            var d1El = document.getElementById('filterD1Return');
            var d1Return = d1El ? String(d1El.value || '').trim() : '';
            var highIncomeEl = document.getElementById('filterHighIncome');
            var highIncome = highIncomeEl ? String(highIncomeEl.value || '').trim() : '';

            var url = 'api/admin/users?page=' + userPage + '&limit=' + userLimit;
            if (sameRegisterIp) {
                url += '&same_register_ip_of=' + encodeURIComponent(username);
            } else if (username) {
                url += '&username=' + encodeURIComponent(username);
            }
            if (realName) url += '&real_name=' + encodeURIComponent(realName);
            if (active !== '') url += '&active=' + active;
            if (banned !== '') url += '&banned=' + banned;
            if (exact && !sameRegisterIp) url += '&exact=1';
            if (risk !== '') url += '&risk=' + encodeURIComponent(risk);
            if (taxModifiedToday !== '') {
                url += '&tax_modified_today=' + encodeURIComponent(taxModifiedToday);
            }
            if (loginInactiveDays !== '') {
                url += '&login_inactive_days=' + encodeURIComponent(loginInactiveDays);
            }
            if (nameChangesGt !== '') {
                url += '&name_changes_gt=' + encodeURIComponent(nameChangesGt);
            }
            if (taxModDaysGt !== '') {
                url += '&tax_mod_days_gt=' + encodeURIComponent(taxModDaysGt);
            }
            if (peerAccount !== '') {
                url += '&peer=' + encodeURIComponent(peerAccount);
            }
            if (whitelist !== '') {
                url += '&whitelist=' + encodeURIComponent(whitelist);
            }
            if (agentFlag !== '') {
                url += '&agent=' + encodeURIComponent(agentFlag);
            }
            if (d1Return !== '') {
                url += '&d1_return=' + encodeURIComponent(d1Return);
            }
            if (highIncome === '1') {
                url += '&high_income=1';
            }

            adminFetch(url)
                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                .then(function (data) {
                    if (data.code !== 200 || !data.data) return;
                    var list = data.data.users || [];
                    var total = data.data.total || 0;
                    var statText = '共 ' + total + ' 个账号';
                    if (data.data.high_income_filter === '1') {
                        statText += '（未激活且自己填月收入>1.5万）';
                    }
                    var sameIpSeed = data.data.same_register_ip_of
                        ? String(data.data.same_register_ip_of).trim()
                        : '';
                    if (sameIpSeed) {
                        statText += '（账号 ' + sameIpSeed + ' 同注册IP）';
                    }
                    document.getElementById('userStat').textContent = statText;
                    
                    var totalPages = Math.ceil(total / userLimit) || 1;
                    document.getElementById('userPageInfo').textContent =
                        '第 ' + userPage + ' 页 / 共 ' + totalPages + ' 页（每页 ' + userLimit + ' 条）';
                    document.getElementById('userPrev').disabled = userPage <= 1;
                    document.getElementById('userNext').disabled = userPage >= totalPages;

                    var html = '';
                    list.forEach(function (u) {
                        var actOwner = u.activation_owner_admin != null ? String(u.activation_owner_admin).trim() : '';
                        var actOwnerName =
                            u.activation_owner_admin_full_name != null
                                ? String(u.activation_owner_admin_full_name).trim()
                                : '';
                        var actOwnerLower = actOwner.toLowerCase();
                        var actOwnedByAdmin = !actOwner || actOwnerLower === 'admin';
                        var actOwnerDisplay = actOwnerName || actOwner;
                        /* 时效开通：先判断是否已过期，徽章用独立颜色区分 */
                        var actKind = u.activation_kind != null ? String(u.activation_kind).trim() : '';
                        var actUntil = u.active_until != null ? String(u.active_until).trim() : '';
                        var untilMs =
                            u.account_active && actUntil && actKind !== 'permanent'
                                ? new Date(actUntil).getTime()
                                : NaN;
                        var isExpired =
                            u.account_active &&
                            actUntil &&
                            actKind !== 'permanent' &&
                            isFinite(untilMs) &&
                            untilMs <= Date.now();
                        var act;
                        if (!u.account_active) {
                            act = '<span class="badge badge-no">未激活</span>';
                        } else if (isExpired) {
                            act =
                                '<span class="badge badge-expired" title="试用已过期' +
                                (actOwner
                                    ? '（上线：' +
                                      esc(actOwner) +
                                      (actOwnerName ? '（' + esc(actOwnerName) + '）' : '') +
                                      '）'
                                    : '') +
                                '">已过期</span>';
                        } else if (actOwnedByAdmin) {
                            act =
                                '<span class="badge badge-yes" title="' +
                                (actOwner
                                    ? '上线：' +
                                      esc(actOwner) +
                                      (actOwnerName ? '（' + esc(actOwnerName) + '）' : '')
                                    : 'admin 名下 / 未标注归属') +
                                '">已激活</span>';
                        } else {
                            act =
                                '<span class="badge badge-activated-other" title="上线：' +
                                esc(actOwner) +
                                (actOwnerName ? '（' + esc(actOwnerName) + '）' : '') +
                                '（非 admin 名下）">已激活（' +
                                esc(actOwnerDisplay) +
                                '）</span>';
                        }
                        /* 时效开通显示过期时间；永久不显示 */
                        if (u.account_active && actUntil && actKind !== 'permanent') {
                            act +=
                                '<div class="risk-hint-line' +
                                (isExpired ? ' risk-hint-expired' : '') +
                                '" title="' +
                                (isExpired ? '试用已过期' : '试用到期时间') +
                                '">' +
                                (isExpired ? '已过期：' : '过期：') +
                                esc(formatDt(actUntil)) +
                                '</div>';
                        }
                        var ban = u.banned ? '<span class="badge badge-no">已封禁</span>' : '<span class="badge badge-yes">正常</span>';
                        var riskCell = '<span class="risk-hint-line">—</span>';
                        if (u.risk && u.risk_messages && u.risk_messages.length) {
                            var riskHintParts = (u.risk_messages || []).map(function (msg) {
                                var m = String(msg || '');
                                if (m.indexOf('同IP注册') === 0) {
                                    return (
                                        '<button type="button" class="risk-same-ip-link" data-u="' +
                                        esc(u.username) +
                                        '" title="查询该账号同注册IP下的全部账号">' +
                                        esc(m) +
                                        '</button>'
                                    );
                                }
                                return esc(m);
                            });
                            riskCell =
                                '<span class="badge badge-risk" title="' +
                                esc(u.risk_messages.join('；')) +
                                '">风险</span><div class="risk-hint-line">' +
                                riskHintParts.join('；') +
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
                        /* 未激活、已过期：同一套「激活」弹窗（选时长/永久） */
                        if (!u.account_active || isExpired) {
                            ops +=
                                '<button type="button" class="btn-sm btn-activate btn-user-activate" data-u="' +
                                esc(u.username) +
                                '" data-expired="' +
                                (isExpired ? '1' : '0') +
                                '" data-amt="' +
                                esc(displayUserActivationAmount(u)) +
                                '" title="' +
                                (isExpired
                                    ? '试用已过期，重新选择时长开通（与未激活相同）'
                                    : '选择时长开通账号') +
                                '">激活</button> ';
                        }
                        /* 未过期的时效/试用：一键改为永久 */
                        var canMakePermanent =
                            !isExpired &&
                            (actKind === 'trial' ||
                                (actUntil && actKind !== 'permanent' && actKind !== ''));
                        if (canMakePermanent) {
                            ops +=
                                '<button type="button" class="btn-sm btn-make-permanent btn-user-make-permanent" data-u="' +
                                esc(u.username) +
                                '" title="将临时激活改为永久激活（清除过期时间）">临时→永久</button> ';
                        }
                        /* 当前仍有效的已激活：可取消开通（与退款不同，不封禁、不剔除统计） */
                        if (u.account_active && !isExpired) {
                            ops +=
                                '<button type="button" class="btn-sm btn-deactivate btn-user-deactivate" data-u="' +
                                esc(u.username) +
                                '" title="取消激活，恢复为未开通（不封禁、不按退款剔除）">取消激活</button> ';
                        }
                        var ipLast = u.ip_last || '';
                        ops += (u.banned
                            ? '<button type="button" class="btn-sm btn-unban btn-ban-act" data-u="' + esc(u.username) + '" data-b="0">解封</button>'
                            : '<button type="button" class="btn-sm btn-ban btn-ban-act" data-u="' + esc(u.username) + '" data-b="1">封禁</button>')
                            + ' <button type="button" class="btn-sm btn-block-ip btn-block-ip-act" data-u="' + esc(u.username) + '" data-ip="' + esc(ipLast) + '">封IP</button>'
                            + ' ' + detailBtn
                            + ' <button type="button" class="btn-sm ' +
                            (u.rename_fee_exempt ? 'btn-ban' : 'btn-page') +
                            ' btn-user-rename-exempt" data-u="' +
                            esc(u.username) +
                            '" data-exempt="' +
                            (u.rename_fee_exempt ? '1' : '0') +
                            '" title="' +
                            (u.rename_fee_exempt
                                ? '该账号已豁免改名费与个税修改费，点击重新加限制'
                                : '取消后该账号改名、个税修改不再收取费用') +
                            '">' +
                            (u.rename_fee_exempt ? '重新加改名/改税限制' : '取消改名/改税限制') +
                            '</button>'
                            + ' <button type="button" class="btn-sm ' +
                            (u.is_agent ? 'btn-ban' : 'btn-page') +
                            ' btn-user-agent-flag" data-u="' +
                            esc(u.username) +
                            '" data-agent="' +
                            (u.is_agent ? '1' : '0') +
                            '" title="' +
                            (u.is_agent
                                ? '该账号已标记为代理，点击取消'
                                : '将该账号手动标记为代理') +
                            '">' +
                            (u.is_agent ? '取消代理标识' : '设为代理') +
                            '</button>'
                            + ' <button type="button" class="btn-sm btn-del-user btn-delete-user" data-u="' + esc(u.username) + '">删除</button>';
                        var certPermHtml =
                            '<div class="user-cert-perm-btns">' +
                            '<button type="button" class="btn-sm ' +
                            (u.lizhi_cert_unlocked ? 'btn-ban' : 'btn-cert-grant') +
                            ' btn-user-lizhi-unlock" data-u="' +
                            esc(u.username) +
                            '" data-unlocked="' +
                            (u.lizhi_cert_unlocked ? '1' : '0') +
                            '" title="' +
                            (u.lizhi_cert_unlocked
                                ? '该账号已开通离职证明，点击关闭'
                                : '为该账号开通离职证明生成权益（免付费）') +
                            '">' +
                            (u.lizhi_cert_unlocked ? '关闭离职' : '开通离职') +
                            '</button>' +
                            '<button type="button" class="btn-sm ' +
                            (u.zaizhi_cert_unlocked ? 'btn-ban' : 'btn-cert-grant') +
                            ' btn-user-zaizhi-unlock" data-u="' +
                            esc(u.username) +
                            '" data-unlocked="' +
                            (u.zaizhi_cert_unlocked ? '1' : '0') +
                            '" title="' +
                            (u.zaizhi_cert_unlocked
                                ? '该账号已开通在职证明，点击关闭'
                                : '为该账号开通在职证明生成权益（免付费）') +
                            '">' +
                            (u.zaizhi_cert_unlocked ? '关闭在职' : '开通在职') +
                            '</button>' +
                            '<button type="button" class="btn-sm ' +
                            (u.najilu_qr_unlocked ? 'btn-ban' : 'btn-cert-grant') +
                            ' btn-user-najilu-unlock" data-u="' +
                            esc(u.username) +
                            '" data-unlocked="' +
                            (u.najilu_qr_unlocked ? '1' : '0') +
                            '" title="' +
                            (u.najilu_qr_unlocked
                                ? '该账号已开通完税二维码去水印，点击关闭'
                                : '为该账号开通完税二维码去水印权益（免付费）') +
                            '">' +
                            (u.najilu_qr_unlocked ? '关闭完税码' : '开通完税码') +
                            '</button>';
                        if (!u.lizhi_cert_unlocked || !u.zaizhi_cert_unlocked) {
                            certPermHtml +=
                                '<button type="button" class="btn-sm btn-cert-grant-both btn-user-cert-unlock-both" data-u="' +
                                esc(u.username) +
                                '" title="同时开通离职证明和在职证明（免付费）">两项都开</button>';
                        }
                        certPermHtml += '</div>';
                        if (u.account_active) {
                            ops += ' <button type="button" class="btn-sm btn-refund btn-refund-user" data-u="' + esc(u.username) + '">退款</button>';
                        }
                        
                        var detailKey = keyForUser(u.username);
                        html += '<tr data-username="' + esc(u.username) + '">';
                        var taxModBadge = u.tax_modified_today
                            ? '<span class="dau-tax-badge modified-today">有</span>'
                            : '<span style="color:#bbb;">—</span>';
                        var taxModDays = Number(u.tax_modified_days) || 0;
                        if (taxModDays > 0) {
                            taxModBadge +=
                                '<div style="margin-top:3px;font-size:11px;color:' +
                                (taxModDays > 10 ? '#b45309' : '#888') +
                                ';" title="有个税记录修改的不同天数">' +
                                esc(String(taxModDays)) +
                                '天</div>';
                        }
                        var nameChangeCount = Number(u.name_change_count) || 0;
                        var nameChangeBadge =
                            '<span style="display:inline-block;margin-left:5px;padding:1px 5px;border-radius:8px;' +
                            'background:' +
                            (nameChangeCount > 0 ? '#fff3e0;color:#b45309;' : '#f3f4f6;color:#999;') +
                            'font-size:11px;white-space:nowrap;" title="姓名历史修改次数">改名' +
                            esc(String(nameChangeCount)) +
                            '次</span>';
                        if (u.is_peer_account) {
                            nameChangeBadge +=
                                '<span style="display:inline-block;margin-left:5px;padding:1px 5px;border-radius:8px;' +
                                'background:#fef2f2;color:#b91c1c;font-size:11px;white-space:nowrap;" title="个税修改天数超过阈值，后续改个税需付费">同行</span>';
                        }
                        if (u.rename_fee_exempt) {
                            nameChangeBadge +=
                                '<span style="display:inline-block;margin-left:5px;padding:1px 5px;border-radius:8px;' +
                                'background:#ecfdf5;color:#047857;font-size:11px;white-space:nowrap;" title="已取消改名/个税修改收费限制">免改名改税</span>';
                        }
                        if (u.lizhi_cert_unlocked) {
                            nameChangeBadge +=
                                '<span style="display:inline-block;margin-left:5px;padding:1px 5px;border-radius:8px;' +
                                'background:#eff6ff;color:#1d4ed8;font-size:11px;white-space:nowrap;" title="已开通离职证明生成权益">离职证明</span>';
                        }
                        if (u.zaizhi_cert_unlocked) {
                            nameChangeBadge +=
                                '<span style="display:inline-block;margin-left:5px;padding:1px 5px;border-radius:8px;' +
                                'background:#ecfdf5;color:#047857;font-size:11px;white-space:nowrap;" title="已开通在职证明生成权益">在职证明</span>';
                        }
                        if (u.najilu_qr_unlocked) {
                            nameChangeBadge +=
                                '<span style="display:inline-block;margin-left:5px;padding:1px 5px;border-radius:8px;' +
                                'background:#f5f3ff;color:#6d28d9;font-size:11px;white-space:nowrap;" title="已开通完税二维码去水印权益">完税二维码</span>';
                        }
                        html += '<td class="cell-break">' + esc(u.username) +
                            (u.is_agent
                                ? '<span style="display:inline-block;margin-left:5px;padding:1px 5px;border-radius:8px;' +
                                  'background:#eff6ff;color:#1d4ed8;font-size:11px;white-space:nowrap;" title="手动标记的代理账号">代理</span>'
                                : '') +
                            (u.high_income
                                ? '<span class="high-income-badge" title="自己填写的个税月收入（本期收入或收入）最大值 ' +
                                  esc(formatMonthIncomeYuan(u.max_month_income)) +
                                  '">月入' +
                                  esc(formatMonthIncomeShort(u.max_month_income)) +
                                  '</span>'
                                : '') +
                            '</td>';
                        html += '<td class="col-tax-mod">' + taxModBadge + '</td>';
                        html +=
                            '<td class="cell-break">' +
                            esc(u.real_name || '—') +
                            nameChangeBadge +
                            '</td>';
                        var channelLabel =
                            u.channel_analysis_label || u.register_source_channel_label || '';
                        if (!channelLabel && u.is_agent) {
                            channelLabel = '代理';
                        } else if (channelLabel && u.is_agent && String(channelLabel).indexOf('代理') < 0) {
                            channelLabel = String(channelLabel) + ' · 代理';
                        }
                        html +=
                            '<td class="cell-break">' +
                            esc(channelLabel || '—') +
                            '</td>';
                        var pwdText =
                            u.password != null && String(u.password).trim() !== ''
                                ? String(u.password)
                                : '—';
                        html +=
                            '<td class="cell-break">' +
                            '<code class="user-plain-password" style="font-size:12px;word-break:break-all;">' +
                            esc(pwdText) +
                            '</code> ' +
                            '<button type="button" class="btn-sm btn-page btn-user-password" data-u="' +
                            esc(u.username) +
                            '" data-pwd="' +
                            esc(pwdText === '—' || pwdText.indexOf('未记录') >= 0 ? '' : pwdText) +
                            '" title="修改密码">修改</button></td>';
                        html += '<td>' + act + '</td>';
                        var creditVal = displayUserActivationAmount(u);
                        html +=
                            '<td class="col-w-140 col-activation-credit"><div class="user-credit-amt-wrap">' +
                            '<input type="number" class="user-credit-amt-input" min="0" max="99999" step="0.01" inputmode="decimal" data-u="' +
                            esc(u.username) +
                            '" value="' +
                            esc(creditVal) +
                            '" placeholder="填金额" title="填好后按回车保存；线上已付会带出实收，admin 手动开通按此计入支付分析">' +
                            '</div></td>';
                        html += '<td>' + ban + '</td>';
                        html += '<td class="cell-break">' + riskCell + '</td>';
                        html += '<td>' + formatDt(u.created_at) + '</td>';
                        html += '<td class="col-cert-perm">' + certPermHtml + '</td>';
                        html += '<td class="col-ops">' + ops + '</td>';
                        html += '</tr>';
                        html += '<tr id="user_detail_row_' + detailKey + '" class="users-detail-row" style="display:none;">';
                        html += '<td colspan="12"><div id="user_detail_box_' + detailKey + '" style="padding:4px 0;color:#888;">点击详情加载设备与页面记录…</div></td>';
                        html += '</tr>';
                    });
                    document.getElementById('userTbody').innerHTML = html || '<tr><td colspan="12">暂无数据</td></tr>';
                    highlightPendingUserRow();

                    // 重新绑定事件
                    document.getElementById('userTbody').querySelectorAll('.btn-user-password').forEach(function (btn) {
                        btn.onclick = function () {
                            openUserPasswordModal(
                                btn.getAttribute('data-u'),
                                btn.getAttribute('data-pwd') || ''
                            );
                        };
                    });
                    document.getElementById('userTbody').querySelectorAll('.btn-user-activate').forEach(function (btn) {
                        btn.onclick = function () {
                            openUserActivateModal(btn.getAttribute('data-u'), {
                                expired: btn.getAttribute('data-expired') === '1',
                                amount: btn.getAttribute('data-amt') || ''
                            });
                        };
                    });
                    document.getElementById('userTbody').querySelectorAll('.user-credit-amt-input').forEach(function (input) {
                        input.addEventListener('keydown', function (ev) {
                            var key = ev && (ev.key || ev.keyCode);
                            if (key !== 'Enter' && key !== 13) return;
                            ev.preventDefault();
                            saveUserActivationCredit(input.getAttribute('data-u'), input);
                        });
                    });
                    document.getElementById('userTbody').querySelectorAll('.btn-user-make-permanent').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u') || '';
                            if (
                                !confirm(
                                    '确定将「' +
                                        name +
                                        '」的临时激活改为永久？\n将清除过期时间，账号变为永久激活。'
                                )
                            ) {
                                return;
                            }
                            btn.disabled = true;
                            adminFetch('api/admin/user-make-permanent', {
                                method: 'POST',
                                body: JSON.stringify({ username: name })
                            })
                                .then(function (r) {
                                    return (window.adminParseJson||function(r){return r.json();})(r);
                                })
                                .then(function (d) {
                                    if (d.code === 200) {
                                        alert(d.msg || '已改为永久激活');
                                        loadUsers();
                                    } else {
                                        alert(d.msg || '操作失败');
                                    }
                                })
                                .catch(function () {
                                    alert('网络错误');
                                })
                                .then(function () {
                                    btn.disabled = false;
                                });
                        };
                    });
                    document.getElementById('userTbody').querySelectorAll('.btn-user-deactivate').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u') || '';
                            if (
                                !confirm(
                                    '确定取消激活账号「' +
                                        name +
                                        '」？\n将恢复为未开通，C 端重新显示激活入口。\n不会封禁，也不会按退款从统计中剔除。之后可再次点「激活」开通。'
                                )
                            ) {
                                return;
                            }
                            btn.disabled = true;
                            adminFetch('api/admin/user-deactivate', {
                                method: 'POST',
                                body: JSON.stringify({ username: name })
                            })
                                .then(function (r) {
                                    return (window.adminParseJson||function(r){return r.json();})(r);
                                })
                                .then(function (d) {
                                    if (d.code === 200) {
                                        alert(d.msg || '已取消激活');
                                        loadUsers();
                                    } else {
                                        alert(d.msg || '操作失败');
                                    }
                                })
                                .catch(function () {
                                    alert('网络错误');
                                })
                                .then(function () {
                                    btn.disabled = false;
                                });
                        };
                    });
                    document.getElementById('userTbody').querySelectorAll('.btn-user-rename-exempt').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u') || '';
                            var isExempt = btn.getAttribute('data-exempt') === '1';
                            var nextExempt = !isExempt;
                            var actionText = nextExempt
                                ? '取消改名/个税修改收费限制（之后改名、改个税不再收费）'
                                : '重新加改名/个税修改收费限制（达到次数后需付费）';
                            if (!confirm('确定为账号「' + name + '」' + actionText + '？')) return;
                            btn.disabled = true;
                            adminFetch('api/admin/user-rename-fee-exempt', {
                                method: 'POST',
                                body: JSON.stringify({ username: name, exempt: nextExempt ? 1 : 0 })
                            })
                                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                                .then(function (d) {
                                    if (d.code !== 200) {
                                        alert(d.msg || '操作失败');
                                        return;
                                    }
                                    alert(
                                        d.msg ||
                                            (nextExempt
                                                ? '已取消改名与个税修改限制'
                                                : '已重新加改名与个税修改限制')
                                    );
                                    loadUsers();
                                })
                                .catch(function () {
                                    alert('网络错误');
                                })
                                .then(function () {
                                    btn.disabled = false;
                                });
                        };
                    });
                    document.getElementById('userTbody').querySelectorAll('.btn-user-agent-flag').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u') || '';
                            var isAgent = btn.getAttribute('data-agent') === '1';
                            var nextAgent = !isAgent;
                            var actionText = nextAgent ? '设为代理标识' : '取消代理标识';
                            if (!confirm('确定为账号「' + name + '」' + actionText + '？')) return;
                            btn.disabled = true;
                            adminFetch('api/admin/user-agent-flag', {
                                method: 'POST',
                                body: JSON.stringify({ username: name, is_agent: nextAgent ? 1 : 0 })
                            })
                                .then(function (r) {
                                    return (window.adminParseJson||function(r){return r.json();})(r);
                                })
                                .then(function (d) {
                                    if (d.code !== 200) {
                                        alert(d.msg || '操作失败');
                                        return;
                                    }
                                    alert(d.msg || (nextAgent ? '已设为代理标识' : '已取消代理标识'));
                                    loadUsers();
                                })
                                .catch(function () {
                                    alert('网络错误');
                                })
                                .then(function () {
                                    btn.disabled = false;
                                });
                        };
                    });
                    document.getElementById('userTbody').querySelectorAll('.btn-user-zaizhi-unlock').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u') || '';
                            var isUnlocked = btn.getAttribute('data-unlocked') === '1';
                            var nextUnlocked = !isUnlocked;
                            var actionText = nextUnlocked
                                ? '开通在职证明功能（可免付费生成正式证明）'
                                : '关闭在职证明功能';
                            if (!confirm('确定为账号「' + name + '」' + actionText + '？')) return;
                            btn.disabled = true;
                            adminFetch('api/admin/user-zaizhi-cert-unlock', {
                                method: 'POST',
                                body: JSON.stringify({ username: name, unlocked: nextUnlocked ? 1 : 0 })
                            })
                                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                                .then(function (d) {
                                    if (d.code !== 200) {
                                        alert(d.msg || '操作失败');
                                        return;
                                    }
                                    alert(
                                        d.msg ||
                                            (nextUnlocked
                                                ? '已开通在职证明'
                                                : '已关闭在职证明')
                                    );
                                    loadUsers();
                                })
                                .catch(function () {
                                    alert('网络错误');
                                })
                                .then(function () {
                                    btn.disabled = false;
                                });
                        };
                    });
                    document.getElementById('userTbody').querySelectorAll('.btn-user-lizhi-unlock').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u') || '';
                            var isUnlocked = btn.getAttribute('data-unlocked') === '1';
                            var nextUnlocked = !isUnlocked;
                            var actionText = nextUnlocked
                                ? '开通离职证明功能（可免付费生成正式证明）'
                                : '关闭离职证明功能';
                            if (!confirm('确定为账号「' + name + '」' + actionText + '？')) return;
                            btn.disabled = true;
                            adminFetch('api/admin/user-lizhi-cert-unlock', {
                                method: 'POST',
                                body: JSON.stringify({ username: name, unlocked: nextUnlocked ? 1 : 0 })
                            })
                                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                                .then(function (d) {
                                    if (d.code !== 200) {
                                        alert(d.msg || '操作失败');
                                        return;
                                    }
                                    alert(
                                        d.msg ||
                                            (nextUnlocked
                                                ? '已开通离职证明'
                                                : '已关闭离职证明')
                                    );
                                    loadUsers();
                                })
                                .catch(function () {
                                    alert('网络错误');
                                })
                                .then(function () {
                                    btn.disabled = false;
                                });
                        };
                    });
                    document.getElementById('userTbody').querySelectorAll('.btn-user-najilu-unlock').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u') || '';
                            var isUnlocked = btn.getAttribute('data-unlocked') === '1';
                            var nextUnlocked = !isUnlocked;
                            var actionText = nextUnlocked
                                ? '开通完税二维码去水印功能（可免付费生成）'
                                : '关闭完税二维码去水印功能';
                            if (!confirm('确定为账号「' + name + '」' + actionText + '？')) return;
                            btn.disabled = true;
                            adminFetch('api/admin/user-najilu-qr-unlock', {
                                method: 'POST',
                                body: JSON.stringify({ username: name, unlocked: nextUnlocked ? 1 : 0 })
                            })
                                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                                .then(function (d) {
                                    if (d.code !== 200) {
                                        alert(d.msg || '操作失败');
                                        return;
                                    }
                                    alert(
                                        d.msg ||
                                            (nextUnlocked
                                                ? '已开通完税二维码'
                                                : '已关闭完税二维码')
                                    );
                                    loadUsers();
                                })
                                .catch(function () {
                                    alert('网络错误');
                                })
                                .then(function () {
                                    btn.disabled = false;
                                });
                        };
                    });
                    document.getElementById('userTbody').querySelectorAll('.btn-user-cert-unlock-both').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u') || '';
                            if (!name) return;
                            if (!confirm('确定为账号「' + name + '」同时开通离职证明和在职证明（可免付费生成正式证明）？')) {
                                return;
                            }
                            btn.disabled = true;
                            adminFetch('api/admin/user-lizhi-cert-unlock', {
                                method: 'POST',
                                body: JSON.stringify({ username: name, unlocked: 1 })
                            })
                                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                                .then(function (dLizhi) {
                                    if (dLizhi.code !== 200) {
                                        throw new Error(dLizhi.msg || '开通离职证明失败');
                                    }
                                    return adminFetch('api/admin/user-zaizhi-cert-unlock', {
                                        method: 'POST',
                                        body: JSON.stringify({ username: name, unlocked: 1 })
                                    }).then(function (r2) { return (window.adminParseJson||function(r2){return r2.json();})(r2); });
                                })
                                .then(function (dZaizhi) {
                                    if (dZaizhi.code !== 200) {
                                        throw new Error(dZaizhi.msg || '开通在职证明失败');
                                    }
                                    alert('已开通离职证明和在职证明');
                                    loadUsers();
                                })
                                .catch(function (err) {
                                    alert((err && err.message) || '网络错误');
                                })
                                .then(function () {
                                    btn.disabled = false;
                                });
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
                                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
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
                    document.getElementById('userTbody').querySelectorAll('.btn-block-ip-act').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u');
                            var ip = btn.getAttribute('data-ip');
                            var msg = '确定封禁 IP 地址「' + (ip || '未知') + '」关联的账号「' + name + '」？\n封禁后该 IP 下的所有用户将无法登录和注册。';
                            if (ip) {
                                msg += '\n\nIP: ' + ip;
                            } else {
                                msg += '\n\n该用户暂无最近 IP 记录，请手动输入要封禁的 IP 地址。';
                            }
                            if (!confirm(msg)) return;
                            var targetIp = ip;
                            if (!targetIp) {
                                targetIp = prompt('请输入要封禁的 IP 地址：');
                                if (!targetIp) return;
                            }
                            adminFetch('api/admin/block-ip', {
                                method: 'POST',
                                body: JSON.stringify({ ip: targetIp, reason: '封禁用户 ' + name })
                            })
                                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                                .then(function (d) {
                                    if (d.code === 200) {
                                        alert('IP ' + targetIp + ' 已封禁');
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
                                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
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
                                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
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
                    document.getElementById('userTbody').querySelectorAll('.risk-same-ip-link').forEach(function (btn) {
                        btn.onclick = function () {
                            searchSameRegisterIpUsers(btn.getAttribute('data-u'));
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
                                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                                .then(function (d) {
                                    if (d.code !== 200) {
                                        box.textContent = d.msg || '加载失败';
                                        return;
                                    }
                                    box.innerHTML = buildTaxRecordsHtml(name, d.data || {});
                                    box.setAttribute('data-loaded', '1');
                                    mountAdminShebaoPhotos(name, null, 'user');
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

        function peerAccountModeValue() {
            var el = document.getElementById('filterPeerListMode');
            var v = el ? String(el.value || '').trim() : '1';
            return v === 'exempt' ? 'exempt' : '1';
        }

        function updatePeerAccountHint(data) {
            var hint = document.getElementById('peerAccountHint');
            if (!hint) return;
            var daysGt = data && data.peer_days_gt != null ? Number(data.peer_days_gt) : 8;
            var amount = data && data.peer_daily_amount != null ? String(data.peer_daily_amount) : '30.00';
            var yuan = Number(amount);
            var yuanLabel = isFinite(yuan) ? (yuan % 1 === 0 ? String(Math.round(yuan)) : yuan.toFixed(2)) : amount;
            hint.innerHTML =
                '本页只列个税修改天数大于 ' +
                esc(String(daysGt)) +
                ' 天的账号（不再看改名次数）。当前同行未进白名单，后续每天改个税需先付当天无限费用（¥' +
                esc(yuanLabel) +
                '）；已豁免账号可在筛选里查看并重新加限制。阈值与金额见「定价与引导」。当日登录按北京时间：当日有成功登录，或发起过需登录接口（与日活口径一致）。';
        }

        function peerLoginTodayCellHtml(u) {
            var last = formatDt(u.last_login_at);
            var lastTitle = last !== '—'
                ? '最近登录：' + last
                : (u.logged_in_today ? '当日有需登录接口活跃，无成功登录流水' : '无成功登录记录');
            if (u.logged_in_today) {
                var timeBit = last !== '—' ? last.slice(11, 16) : '';
                return (
                    '<span class="dau-tax-badge has-records" title="' +
                    esc(lastTitle) +
                    '">已登录</span>' +
                    (timeBit
                        ? '<div class="peer-last-login" title="' + esc(lastTitle) + '">' + esc(timeBit) + '</div>'
                        : '')
                );
            }
            var sub = last !== '—' ? last.slice(5, 16) : '';
            return (
                '<span style="color:#bbb;" title="' +
                esc(lastTitle) +
                '">未登录</span>' +
                (sub ? '<div class="peer-last-login">' + esc(sub) + '</div>' : '')
            );
        }

        function loadPeerAccounts(p) {
            if (p != null) peerAccountPage = p;
            var tbody = document.getElementById('peerAccountTbody');
            var statEl = document.getElementById('peerAccountStat');
            if (!tbody) return;

            var usernameEl = document.getElementById('filterPeerUsername');
            var realNameEl = document.getElementById('filterPeerRealName');
            var exactEl = document.getElementById('filterPeerExact');
            var activeEl = document.getElementById('filterPeerActive');
            var bannedEl = document.getElementById('filterPeerBanned');
            var taxModEl = document.getElementById('filterPeerTaxModifiedToday');
            var loggedInEl = document.getElementById('filterPeerLoggedInToday');
            var username = usernameEl ? usernameEl.value.trim() : '';
            var realName = realNameEl ? realNameEl.value.trim() : '';
            var exact = exactEl && exactEl.checked;
            var active = activeEl ? activeEl.value : '';
            var banned = bannedEl ? bannedEl.value : '';
            var taxModifiedToday = taxModEl ? taxModEl.value : '';
            var loggedInToday = loggedInEl ? loggedInEl.value : '';
            var peerMode = peerAccountModeValue();

            var url = 'api/admin/users?peer=' + encodeURIComponent(peerMode) +
                '&page=' + peerAccountPage + '&limit=' + peerAccountLimit;
            if (username) url += '&username=' + encodeURIComponent(username);
            if (realName) url += '&real_name=' + encodeURIComponent(realName);
            if (exact) url += '&exact=1';
            if (active !== '') url += '&active=' + encodeURIComponent(active);
            if (banned !== '') url += '&banned=' + encodeURIComponent(banned);
            if (taxModifiedToday !== '') {
                url += '&tax_modified_today=' + encodeURIComponent(taxModifiedToday);
            }
            if (loggedInToday !== '') {
                url += '&logged_in_today=' + encodeURIComponent(loggedInToday);
            }

            if (statEl) statEl.textContent = '加载中…';
            adminFetch(url)
                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                .then(function (data) {
                    if (!data || data.code !== 200 || !data.data) {
                        if (statEl) statEl.textContent = (data && data.msg) || '加载失败';
                        tbody.innerHTML = '<tr><td colspan="11">加载失败</td></tr>';
                        return;
                    }
                    var list = data.data.users || [];
                    var total = data.data.total || 0;
                    updatePeerAccountHint(data.data);
                    var modeLabel = peerMode === 'exempt' ? '已豁免账号' : '当前同行';
                    var loggedTodayCnt = 0;
                    list.forEach(function (u) {
                        if (u.logged_in_today) loggedTodayCnt += 1;
                    });
                    if (statEl) {
                        statEl.textContent =
                            '共 ' + total + ' 个' + modeLabel + '（本页当日已登录 ' + loggedTodayCnt + ' 个）';
                    }
                    var totalPages = Math.ceil(total / peerAccountLimit) || 1;
                    var pageInfo = document.getElementById('peerAccountPageInfo');
                    if (pageInfo) {
                        pageInfo.textContent =
                            '第 ' + peerAccountPage + ' 页 / 共 ' + totalPages + ' 页（每页 ' + peerAccountLimit + ' 条）';
                    }
                    var prevBtn = document.getElementById('peerAccountPrev');
                    var nextBtn = document.getElementById('peerAccountNext');
                    if (prevBtn) prevBtn.disabled = peerAccountPage <= 1;
                    if (nextBtn) nextBtn.disabled = peerAccountPage >= totalPages;

                    var html = '';
                    list.forEach(function (u) {
                        var nameChangeCount = Number(u.name_change_count) || 0;
                        var taxModDays = Number(u.tax_modified_days) || 0;
                        var act = u.account_active
                            ? '<span class="badge badge-yes">已激活</span>'
                            : '<span class="badge badge-no">未激活</span>';
                        var ban = u.banned
                            ? '<span class="badge badge-no">已封禁</span>'
                            : '<span class="badge badge-yes">正常</span>';
                        var taxModBadge = u.tax_modified_today
                            ? '<span class="dau-tax-badge modified-today">有</span>'
                            : '<span style="color:#bbb;">—</span>';
                        var paidBadge = u.tax_edit_daily_unlocked_today
                            ? '<span class="badge badge-yes" title="今日已开通当天无限修改">已付费</span>'
                            : (peerMode === 'exempt'
                                ? '<span class="badge" style="background:#ecfdf5;color:#047857;" title="已豁免改名/个税修改收费">已豁免</span>'
                                : '<span class="badge badge-no" title="今日尚未支付当天无限费用">待付费</span>');
                        var ops =
                            '<button type="button" class="btn-sm ' +
                            (u.rename_fee_exempt ? 'btn-ban' : 'btn-page') +
                            ' btn-peer-rename-exempt" data-u="' +
                            esc(u.username) +
                            '" data-exempt="' +
                            (u.rename_fee_exempt ? '1' : '0') +
                            '" title="' +
                            (u.rename_fee_exempt
                                ? '该账号已豁免改名费与个税修改费，点击重新加限制'
                                : '取消后该账号改名、个税修改不再收取费用') +
                            '">' +
                            (u.rename_fee_exempt ? '重新加改名/改税限制' : '取消改名/改税限制') +
                            '</button> ' +
                            (u.banned
                                ? '<button type="button" class="btn-sm btn-unban btn-peer-ban-act" data-u="' +
                                  esc(u.username) +
                                  '" data-b="0">解封</button>'
                                : '<button type="button" class="btn-sm btn-ban btn-peer-ban-act" data-u="' +
                                  esc(u.username) +
                                  '" data-b="1">封禁</button>') +
                            ' <button type="button" class="btn-sm btn-detail btn-peer-jump-user" data-u="' +
                            esc(u.username) +
                            '">注册用户</button>';
                        html += '<tr data-username="' + esc(u.username) + '">';
                        html += '<td class="cell-break">' + esc(u.username) + '</td>';
                        html += '<td class="cell-break">' + esc(u.real_name || '—') + '</td>';
                        html +=
                            '<td title="姓名历史修改次数">' +
                            esc(String(nameChangeCount)) +
                            '次</td>';
                        html +=
                            '<td title="有个税记录修改的不同日历天数" style="color:' +
                            (taxModDays > 10 ? '#b45309' : '') +
                            ';">' +
                            esc(String(taxModDays)) +
                            '天</td>';
                        html += '<td class="col-tax-mod">' + taxModBadge + '</td>';
                        html += '<td class="col-login-today">' + peerLoginTodayCellHtml(u) + '</td>';
                        html += '<td>' + paidBadge + '</td>';
                        html += '<td>' + act + '</td>';
                        html += '<td>' + ban + '</td>';
                        html += '<td>' + formatDt(u.created_at) + '</td>';
                        html += '<td class="col-ops">' + ops + '</td>';
                        html += '</tr>';
                    });
                    tbody.innerHTML = html || '<tr><td colspan="11">暂无符合条件的账号</td></tr>';

                    tbody.querySelectorAll('.btn-peer-rename-exempt').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u') || '';
                            var isExempt = btn.getAttribute('data-exempt') === '1';
                            var nextExempt = !isExempt;
                            var actionText = nextExempt
                                ? '取消改名/个税修改收费限制（之后改名、改个税不再收费，将移出当前同行名单）'
                                : '重新加改名/个税修改收费限制（达到次数后需付费）';
                            if (!confirm('确定为账号「' + name + '」' + actionText + '？')) return;
                            btn.disabled = true;
                            adminFetch('api/admin/user-rename-fee-exempt', {
                                method: 'POST',
                                body: JSON.stringify({ username: name, exempt: nextExempt ? 1 : 0 })
                            })
                                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                                .then(function (d) {
                                    if (d.code !== 200) {
                                        alert(d.msg || '操作失败');
                                        return;
                                    }
                                    alert(
                                        d.msg ||
                                            (nextExempt
                                                ? '已取消改名与个税修改限制'
                                                : '已重新加改名与个税修改限制')
                                    );
                                    loadPeerAccounts();
                                })
                                .catch(function () {
                                    alert('网络错误');
                                })
                                .then(function () {
                                    btn.disabled = false;
                                });
                        };
                    });
                    tbody.querySelectorAll('.btn-peer-ban-act').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u');
                            var b = btn.getAttribute('data-b') === '1';
                            var tip = b ? '确定封禁「' + name + '」？' : '确定解封「' + name + '」？';
                            if (!confirm(tip)) return;
                            adminFetch('api/admin/ban', {
                                method: 'POST',
                                body: JSON.stringify({ username: name, banned: b ? 1 : 0 })
                            })
                                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                                .then(function (d) {
                                    if (d.code === 200) {
                                        loadPeerAccounts();
                                    } else {
                                        alert(d.msg || '操作失败');
                                    }
                                })
                                .catch(function () { alert('网络错误'); });
                        };
                    });
                    tbody.querySelectorAll('.btn-peer-jump-user').forEach(function (btn) {
                        btn.onclick = function () {
                            jumpToRegisteredUser(btn.getAttribute('data-u'));
                        };
                    });
                })
                .catch(function () {
                    if (statEl) statEl.textContent = '加载失败';
                    tbody.innerHTML = '<tr><td colspan="11">网络错误</td></tr>';
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
                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
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
                                '" data-refunded="1">恢复</button> ' +
                                '<button type="button" class="btn-sm btn-del-user btn-hard-delete-user" data-u="' +
                                esc(u.username) +
                                '">彻底删除</button></td>';
                        } else {
                            html +=
                                '<td class="col-ops"><button type="button" class="btn-sm btn-unban btn-restore-user" data-u="' +
                                esc(u.username) +
                                '">恢复</button> ' +
                                '<button type="button" class="btn-sm btn-del-user btn-hard-delete-user" data-u="' +
                                esc(u.username) +
                                '">彻底删除</button></td>';
                        }
                        html += '</tr>';
                    });
                    document.getElementById('deletedUserTbody').innerHTML =
                        html || '<tr><td colspan="9">暂无已删除账号</td></tr>';

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
                                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
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
                    document.getElementById('deletedUserTbody').querySelectorAll('.btn-hard-delete-user').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u');
                            if (
                                !confirm(
                                    '确定彻底删除账号「' +
                                        name +
                                        '」？\n将永久清除数据库中该账号及个税、家人、银行卡、登录记录等相关数据，不可恢复。'
                                )
                            ) {
                                return;
                            }
                            if (!confirm('再次确认：彻底删除「' + name + '」，此操作不可撤销。')) return;
                            adminFetch('api/admin/user-hard-delete', {
                                method: 'POST',
                                body: JSON.stringify({ username: name })
                            })
                                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                                .then(function (d) {
                                    if (d.code === 200) {
                                        loadDeletedUsers();
                                    } else {
                                        alert(d.msg || '彻底删除失败');
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
            var u =
                c.owner_admin_username && String(c.owner_admin_username).trim() !== ''
                    ? String(c.owner_admin_username).trim()
                    : '';
            if (!u) return '—';
            var n =
                c.owner_admin_full_name && String(c.owner_admin_full_name).trim() !== ''
                    ? String(c.owner_admin_full_name).trim()
                    : '';
            if (n) return esc(u) + '（' + esc(n) + '）';
            return esc(u);
        }

        /* ========== Activation Code Management ========== */
        function renderCodeTableRows(list, options) {
            options = options || {};
            var showChannel = !!options.showChannel;
            var html = '';
            list.forEach(function (c) {
                var usedAt =
                    c.last_used_at && (Number(c.used_count) > 0)
                        ? formatDt(c.last_used_at)
                        : '—';
                var usedName =
                    c.used_by_username && String(c.used_by_username).trim() !== ''
                        ? String(c.used_by_username).trim()
                        : '';
                var usedBy = usedName
                    ? '<span class="code-used-by-wrap">' +
                      '<span class="cell-break">' +
                      esc(usedName) +
                      '</span> ' +
                      (c.activation_cancelled
                          ? '<span class="badge badge-cancelled" title="该账号已在管理端取消激活，不计入运营看板今日激活">取消激活</span> '
                          : '') +
                      '<button type="button" class="btn-sm btn-detail btn-goto-user" data-u="' +
                      esc(usedName) +
                      '" title="跳转到注册用户列表并定位该账号">定位</button>' +
                      '</span>'
                    : '—';
                html += '<tr>';
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
            var limit = codeLimit;
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
                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                .then(function (data) {
                    if (data.code !== 200 || !data.data) return;
                    var list = data.data.codes || [];
                    var total = data.data.total || 0;
                    var statEl = document.getElementById('codeListStat');
                    if (statEl && isSuper) {
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
                        html || '<tr><td colspan="5">暂无激活码</td></tr>';
                })
                .catch(function () {});
        }

        function loadXianyuCodes(p) {
            if (p != null) {
                xianyuCodePage = p;
            }
            var channelFilter = '';
            var channelSel = document.getElementById('xianyuCodeChannelFilter');
            if (channelSel) channelFilter = String(channelSel.value || '').trim();
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
            var hasFilter = !!(channelFilter || ownerAdmin || usedBy || usageStatus || codeQ);
            var limit = xianyuCodeLimit;
            var q =
                'api/admin/codes?page=' +
                xianyuCodePage +
                '&limit=' +
                limit +
                (channelFilter
                    ? '&note_channel=' + encodeURIComponent(channelFilter)
                    : '&scope=batch');
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
                    return (window.adminParseJson||function(r){return r.json();})(r);
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
                        if (channelFilter) filterParts.push('渠道「' + channelFilter + '」');
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
                            statEl.textContent = '共 ' + total + ' 条渠道批量激活码（全部管理员）';
                        } else if (filterParts.length) {
                            statEl.textContent =
                                '共 ' + total + ' 条渠道批量激活码（筛选：' + filterParts.join('，') + '）';
                        } else {
                            statEl.textContent = '共 ' + total + ' 条渠道批量激活码（本账号生成）';
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
                            html || '<tr><td colspan="6">暂无渠道批量激活码</td></tr>';
                    }
                })
                .catch(function () {});
        }

        var ADMIN_MENU_LABELS = {
            settings: '内容配置',
            'install-guide': '安装分发',
            appearance: '外观',
            codes: '激活码',
            users: '用户管理',
            'rename-tax-daily': '同行 · 高频改名',
            'user-emails': '邮箱管理',
            'users-deleted': '已删除',
            'user-data': '用户数据',
            'tax-records-edit': '个税维护',
            'login-log': '系统与安全',
            'user-login-log': '用户登录',
            analytics: '数据统计（旧）',
            'ops-board': '转化运营',
            'ops-inactive': '未激活用户',
            'ops-ad-analytics': '广告页',
            'analytics-conversion': '转化概览',
            'analytics-purchase': '支付分析',
            'payment-orders': '订单检索',
            'analytics-activity': '用户活跃',
            'feature-survey': '功能调研',
            'tax-fill-survey': '填写调研',
            feedback: '兼容反馈',
            'analytics-devices': '机型',
            'install-guide-stats': '安装统计',
            'abc-ops': 'ABC渠道',
            'abc-users': 'ABC用户',
            'abc-install-stats': 'ABC下载页',
            'channel-analysis': '渠道分析',
            'insights-product': '数据分析',
            'insights-growth': '增长洞察',
            'admin-accounts': '账号权限',
            'admin-operation-log': '操作日志',
            'downline-admins': '下线管理员',
            'server-monitor': '监控',
            'sbdy-demo': '业务工具',
            'gjj-demo': '公积金演示',
            'lizhi-cert': '证明工具',
            'zaizhi-cert': '在职证明',
            'ccb-flow': '工资流水',
            'najilu-qr': '完税二维码',
            'blocked-ips': 'IP 黑名单'
        };

        function applyMenuDefsFromServer(defs) {
            if (!Array.isArray(defs)) return;
            adminMenuDefsList = defs.filter(function (d) { return d && d.key; });
            adminMenuDefsList.forEach(function (d) {
                ADMIN_MENU_LABELS[d.key] = d.label || d.key;
            });
        }

        function adminMenuDefsForSelector() {
            if (adminMenuDefsList.length) return adminMenuDefsList;
            return adminMenuKeyList.map(function (k) {
                return { key: k, label: menuLabel(k), group: '', group_label: '', group_order: 0, order: 0 };
            });
        }

        function requiredAdminMenuKeys() {
            var keys = [];
            adminMenuDefsForSelector().forEach(function (d) {
                if (d && d.required && d.key && keys.indexOf(d.key) < 0) keys.push(d.key);
            });
            if (keys.indexOf('codes') < 0) keys.push('codes');
            return keys;
        }

        function menusWithRequired(selected) {
            var out = [];
            (selected || []).forEach(function (k) {
                if (k && out.indexOf(k) < 0) out.push(k);
            });
            requiredAdminMenuKeys().forEach(function (k) {
                if (out.indexOf(k) < 0) out.push(k);
            });
            return out;
        }

        function adminMenuSelectorHtml(selected) {
            var selectedMap = {};
            menusWithRequired(selected).forEach(function (k) { selectedMap[k] = true; });
            var defs = adminMenuDefsForSelector();
            var groups = [];
            var groupIndex = Object.create(null);
            defs.forEach(function (d) {
                var gid = d.group || '_';
                if (!groupIndex[gid]) {
                    groupIndex[gid] = {
                        id: gid,
                        label: d.group_label || '',
                        order: d.group_order != null ? Number(d.group_order) : 999,
                        items: []
                    };
                    groups.push(groupIndex[gid]);
                }
                groupIndex[gid].items.push(d);
            });
            groups.sort(function (a, b) { return a.order - b.order; });
            groups.forEach(function (g) {
                g.items.sort(function (a, b) {
                    return (Number(a.order) || 0) - (Number(b.order) || 0);
                });
            });
            var html = '<div class="admin-menu-selector">';
            groups.forEach(function (g) {
                if (g.label) {
                    html += '<div class="admin-menu-selector-group-title">' + esc(g.label) + '</div>';
                }
                html += '<div class="admin-menu-selector-group-items">';
                g.items.forEach(function (d) {
                    var k = d.key;
                    var locked = !!d.required || k === 'codes';
                    html += '<label class="admin-menu-selector-item">';
                    html +=
                        '<input type="checkbox" data-menu-key="' +
                        esc(k) +
                        '"' +
                        (selectedMap[k] || locked ? ' checked' : '') +
                        (locked ? ' disabled data-required-menu="1"' : '') +
                        '>';
                    html += '<span>' + esc(d.label || menuLabel(k)) + (locked ? '（必选）' : '') + '</span>';
                    html += '</label>';
                });
                html += '</div>';
            });
            html += '</div>';
            return html;
        }

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
                    return (window.adminParseJson||function(r){return r.json();})(r);
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
                if (el.checked || el.getAttribute('data-required-menu') === '1') {
                    out.push(String(el.getAttribute('data-menu-key') || ''));
                }
            });
            return menusWithRequired(out.filter(Boolean));
        }

        /* ========== Admin Accounts ========== */
        function renderAdminMenuSelector(rootEl, selected) {
            if (!rootEl) return;
            rootEl.innerHTML = adminMenuSelectorHtml(selected);
        }

        function syncAdminAccountsPageCopy() {
            var isSuper = !!(currentAdminProfile && currentAdminProfile.is_super);
            var title = document.getElementById('adminAccountsPageTitle');
            var hint = document.getElementById('adminAccountsPageHint');
            var listTitle = document.getElementById('adminAccountsListTitle');
            var createBtn = document.getElementById('btnCreateAdminAccount');
            if (title) title.textContent = isSuper ? '后台账号权限' : '下线管理员';
            if (listTitle) listTitle.textContent = isSuper ? '后台账号列表' : '我的下线管理员';
            if (createBtn) createBtn.textContent = isSuper ? '新增账号' : '新增下线';
            if (hint) {
                hint.textContent = isSuper
                    ? '可新增后台账号并勾选可用菜单。「激活码」为子管理员必选权限，不可取消。给子管理员勾选「下线管理员」后，她可以再发展自己的下线，并查看下线的用户、激活码等全部业务数据。'
                    : '可新增自己的下线管理员，并查看其激活用户、注册用户与激活码等全部业务数据。下线账号的菜单不能超出你当前拥有的权限；「激活码」为必选，不可取消。';
            }
        }

        /* ========== Bot Purge ========== */
        function loadAdminAccounts() {
            if (!canOpenAdminAccountsPage()) {
                return;
            }
            syncAdminAccountsPageCopy();
            adminFetch('api/admin/accounts')
                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                .then(function (data) {
                    if (data.code !== 200 || !data.data) {
                        alert(data.msg || '加载后台账号失败');
                        return;
                    }
                    if (Array.isArray(data.data.menu_defs) && data.data.menu_defs.length) {
                        applyMenuDefsFromServer(data.data.menu_defs);
                        adminMenuKeyList = data.data.menu_defs.map(function (d) { return d.key; });
                    } else {
                        adminMenuKeyList = Array.isArray(data.data.menu_keys) ? data.data.menu_keys : [];
                        adminMenuDefsList = [];
                    }
                    var defaultMenus = menusWithRequired(
                        adminMenuKeyList.indexOf('codes') >= 0 ? ['codes'] : adminMenuKeyList.slice(0, 1)
                    );
                    renderAdminMenuSelector(document.getElementById('adminAccountMenuSelector'), defaultMenus);
                    var list = Array.isArray(data.data.accounts) ? data.data.accounts : [];
                    var html = '';
                    list.forEach(function (a) {
                        var isSuper = !!a.is_super;
                        var accKey = keyForAdminAccount(a.username);
                        var menuText = isSuper
                ? '全部菜单（超级账号）'
                : Array.isArray(a.menus)
                  ? a.menus
                        .filter(function (k) {
                            return k !== 'payment-orders';
                        })
                        .map(menuLabel)
                        .join('、')
                  : '—';
                        var roleText = isSuper ? 'admin(超级)' : (a.parent_admin_username ? '下线' : '子账号');
                        html += '<tr>';
                        html += '<td>' + esc(a.username) + '</td>';
                        html += '<td>' + esc(a.full_name || '—') + '</td>';
                        html += '<td>' + esc(a.parent_admin_username || '—') + '</td>';
                        html += '<td>' + esc(roleText) + '</td>';
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
                            html += '<tr id="admin_acc_edit_row_' + accKey + '" style="display:none;"><td colspan="7">';
                            html += '<div class="admin-account-edit-panel" data-username="' + esc(a.username) + '">';
                            html += '<div class="form-row" style="margin:0 0 6px;align-items:center;gap:8px;">';
                            html += '<label style="font-size:12px;color:#666;">姓名</label>';
                            html += '<input type="text" class="admin-account-fullname" data-username="' + esc(a.username) + '" value="' + esc(a.full_name || '') + '" placeholder="填写姓名">';
                            html += '</div>';
                            html += '<div style="margin:0 0 6px;font-size:12px;color:#666;">可用菜单</div>';
                            html += '<div class="admin-account-menu-row" data-username="' + esc(a.username) + '">';
                            html += adminMenuSelectorHtml(menusWithRequired(a.menus || []));
                            html += '</div>';
                            html += '<div style="margin-top:8px;">';
                            html += '<button type="button" class="btn-sm btn-primary btn-admin-account-save" data-username="' + esc(a.username) + '">保存</button>';
                            html += '</div>';
                            html += '</div></td></tr>';
                        }
                        html +=
                            '<tr id="admin_acc_detail_row_' +
                            accKey +
                            '" style="display:none;"><td colspan="7"><div id="admin_acc_detail_box_' +
                            accKey +
                            '" style="padding:4px 0;color:#888;">点击详情查看该账号下的激活账号…</div></td></tr>';
                    });
                    document.getElementById('adminAccountTbody').innerHTML = html || '<tr><td colspan="7">暂无下线管理员</td></tr>';
                })
                .catch(function () {
                    alert('网络错误');
                });
        }

        document.getElementById('userPrev').onclick = function() { if (userPage > 1) loadUsers(userPage - 1); };
        document.getElementById('userNext').onclick = function() { loadUsers(userPage + 1); };

        /* 页码跳转 */
        (function initUserPageJump() {
            var input = document.getElementById('userPageJumpInput');
            var btn = document.getElementById('userPageJumpBtn');
            if (!input || !btn) return;
            function doJump() {
                var n = parseInt(input.value, 10);
                if (!n || n < 1) return;
                var infoText = document.getElementById('userPageInfo').textContent;
                var m = infoText.match(/共 (\d+) 页/);
                var maxPage = m ? parseInt(m[1], 10) : 99999;
                if (n > maxPage) n = maxPage;
                input.value = '';
                loadUsers(n);
            }
            btn.onclick = doJump;
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); doJump(); }
            });
        })();

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

        var peerAccountPrev = document.getElementById('peerAccountPrev');
        if (peerAccountPrev) {
            peerAccountPrev.onclick = function () {
                if (peerAccountPage > 1) loadPeerAccounts(peerAccountPage - 1);
            };
        }
        var peerAccountNext = document.getElementById('peerAccountNext');
        if (peerAccountNext) {
            peerAccountNext.onclick = function () {
                loadPeerAccounts(peerAccountPage + 1);
            };
        }
        (function initPeerAccountPageJump() {
            var input = document.getElementById('peerAccountPageJumpInput');
            var btn = document.getElementById('peerAccountPageJumpBtn');
            if (!input || !btn) return;
            function doJump() {
                var n = parseInt(input.value, 10);
                if (!n || n < 1) return;
                var infoEl = document.getElementById('peerAccountPageInfo');
                var infoText = infoEl ? infoEl.textContent : '';
                var m = infoText.match(/共 (\d+) 页/);
                var maxPage = m ? parseInt(m[1], 10) : 99999;
                if (n > maxPage) n = maxPage;
                input.value = '';
                loadPeerAccounts(n);
            }
            btn.onclick = doJump;
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); doJump(); }
            });
        })();
        var peerAccountPageLimitSel = document.getElementById('peerAccountPageLimit');
        if (peerAccountPageLimitSel) {
            peerAccountPageLimitSel.onchange = function () {
                var n = parseInt(this.value, 10);
                peerAccountLimit = USER_LIMIT_OPTIONS.indexOf(n) >= 0 ? n : 10;
                this.value = String(peerAccountLimit);
                try {
                    localStorage.setItem(PEER_ACCOUNT_LIMIT_STORAGE_KEY, String(peerAccountLimit));
                } catch (e) {}
                loadPeerAccounts(1);
            };
        }
        var btnSearchPeerAccounts = document.getElementById('btnSearchPeerAccounts');
        if (btnSearchPeerAccounts) {
            btnSearchPeerAccounts.onclick = function () { loadPeerAccounts(1); };
        }
        var filterPeerUsername = document.getElementById('filterPeerUsername');
        if (filterPeerUsername) {
            filterPeerUsername.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); loadPeerAccounts(1); }
            });
        }
        var filterPeerRealName = document.getElementById('filterPeerRealName');
        if (filterPeerRealName) {
            filterPeerRealName.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); loadPeerAccounts(1); }
            });
        }
        var filterPeerListMode = document.getElementById('filterPeerListMode');
        if (filterPeerListMode) {
            filterPeerListMode.onchange = function () { loadPeerAccounts(1); };
        }
        var btnResetPeerAccounts = document.getElementById('btnResetPeerAccounts');
        if (btnResetPeerAccounts) {
            btnResetPeerAccounts.onclick = function () {
                var usernameEl = document.getElementById('filterPeerUsername');
                var realNameEl = document.getElementById('filterPeerRealName');
                var exactEl = document.getElementById('filterPeerExact');
                var modeEl = document.getElementById('filterPeerListMode');
                var activeEl = document.getElementById('filterPeerActive');
                var bannedEl = document.getElementById('filterPeerBanned');
                var taxModEl = document.getElementById('filterPeerTaxModifiedToday');
                var loggedInEl = document.getElementById('filterPeerLoggedInToday');
                if (usernameEl) usernameEl.value = '';
                if (realNameEl) realNameEl.value = '';
                if (exactEl) exactEl.checked = false;
                if (modeEl) modeEl.value = '1';
                if (activeEl) activeEl.value = '';
                if (bannedEl) bannedEl.value = '';
                if (taxModEl) taxModEl.value = '';
                if (loggedInEl) loggedInEl.value = '';
                loadPeerAccounts(1);
            };
        }

        document.getElementById('btnSearchUsers').onclick = function() { loadUsers(1); };
        ['filterNameChangesGt', 'filterTaxModDaysGt'].forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    loadUsers(1);
                }
            });
        });
        var btnRefreshRenameTaxDaily = document.getElementById('btnRefreshRenameTaxDaily');
        if (btnRefreshRenameTaxDaily) {
            btnRefreshRenameTaxDaily.onclick = function () {
                loadRenameTaxDaily();
            };
        }
        document.querySelectorAll('.rename-peer-tab').forEach(function (btn) {
            btn.onclick = function () {
                setRenamePeerTab(btn.getAttribute('data-tab'));
            };
        });
        var renameTaxDailyDays = document.getElementById('renameTaxDailyDays');
        if (renameTaxDailyDays) {
            renameTaxDailyDays.addEventListener('analytics-period-change', function () {
                loadRenameTaxDaily();
            });
        }
        var btnResetUsers = document.getElementById('btnResetUsers');
        if (btnResetUsers) {
            btnResetUsers.onclick = function () {
                var usernameEl = document.getElementById('filterUsername');
                var realNameEl = document.getElementById('filterRealName');
                var exactEl = document.getElementById('filterExact');
                var riskEl = document.getElementById('filterRisk');
                var activeEl = document.getElementById('filterActive');
                var bannedEl = document.getElementById('filterBanned');
                var taxModEl = document.getElementById('filterTaxModifiedToday');
                var loginInactiveEl = document.getElementById('filterLoginInactive');
                var nameChangesGtEl = document.getElementById('filterNameChangesGt');
                var taxModDaysGtEl = document.getElementById('filterTaxModDaysGt');
                var peerEl = document.getElementById('filterPeerAccount');
                var whitelistEl = document.getElementById('filterWhitelist');
                var agentEl = document.getElementById('filterAgent');
                var d1El = document.getElementById('filterD1Return');
                var highIncomeEl = document.getElementById('filterHighIncome');
                if (usernameEl) usernameEl.value = '';
                if (realNameEl) realNameEl.value = '';
                if (exactEl) exactEl.checked = false;
                setFilterSameRegisterIp(false);
                if (riskEl) riskEl.value = '';
                if (activeEl) activeEl.value = '';
                if (bannedEl) bannedEl.value = '';
                if (taxModEl) taxModEl.value = '';
                if (loginInactiveEl) loginInactiveEl.value = '';
                if (nameChangesGtEl) nameChangesGtEl.value = '';
                if (taxModDaysGtEl) taxModDaysGtEl.value = '';
                if (peerEl) peerEl.value = '';
                if (whitelistEl) whitelistEl.value = '';
                if (agentEl) agentEl.value = '';
                if (d1El) d1El.value = '';
                if (highIncomeEl) highIncomeEl.value = '';
                loadUsers(1);
            };
        }
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
                document.getElementById('udFilterIdCard').value = '';
                document.getElementById('udFilterFamily').value = '';
                document.getElementById('udFilterBank').value = '';
                loadUserDataList(1);
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
                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
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
                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
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

        function bindCodeTableDelegation(tbodyId) {
            var el = document.getElementById(tbodyId);
            if (!el || el.getAttribute('data-copy-bound') === '1') {
                return;
            }
            el.setAttribute('data-copy-bound', '1');
            el.addEventListener('click', function (e) {
                var gotoBtn = e.target.closest('.btn-goto-user');
                if (gotoBtn) {
                    e.preventDefault();
                    jumpToRegisteredUser(gotoBtn.getAttribute('data-u'));
                    return;
                }
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
        bindCodeTableDelegation('codeTbody');
        bindCodeTableDelegation('xianyuCodeTbody');
        document.getElementById('btnIssue').addEventListener('click', function () {
            var btn = document.getElementById('btnIssue');
            var daysEl = document.getElementById('issueGrantDays');
            var hoursEl = document.getElementById('issueGrantHours');
            var minutesEl = document.getElementById('issueGrantMinutes');
            var days = daysEl ? parseInt(daysEl.value, 10) : 0;
            var hours = hoursEl ? parseInt(hoursEl.value, 10) : 0;
            var minutes = minutesEl ? parseInt(minutesEl.value, 10) : 0;
            if (!isFinite(days) || days < 0) days = 0;
            if (!isFinite(hours) || hours < 0) hours = 0;
            if (!isFinite(minutes) || minutes < 0) minutes = 0;
            if (days > 365) {
                alert('时效天数不能超过 365');
                return;
            }
            if (hours > 720) {
                alert('时效小时不能超过 720');
                return;
            }
            if (minutes > 525600) {
                alert('时效分钟不能超过 525600（365 天）');
                return;
            }
            var payload = {};
            if (days > 0) payload.grant_days = days;
            if (hours > 0) payload.grant_hours = hours;
            if (minutes > 0) payload.grant_minutes = minutes;
            btn.disabled = true;
            adminFetch('api/admin/issue-code', {
                method: 'POST',
                body: JSON.stringify(payload)
            })
                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                .then(function (data) {
                    if (data.code === 200 && data.data && data.data.code) {
                        var el = document.getElementById('issueOut');
                        var tip = '永久、仅可激活一个账号';
                        var gd = data.data.grant_days;
                        var gh = data.data.grant_hours;
                        var gm = data.data.grant_minutes;
                        if (gd || gh || gm) {
                            var bits = [];
                            if (gd) bits.push(gd + '天');
                            if (gh) bits.push(gh + '小时');
                            if (gm) bits.push(gm + '分钟');
                            tip = '时效 ' + bits.join('') + '、仅可激活一个账号';
                        }
                        el.textContent = '激活码：' + data.data.code + '（' + tip + '）';
                        el.classList.add('show');
                        loadCodes(1);
                    } else {
                        alert(data.msg || '生成失败');
                    }
                })
                .catch(function () { alert('网络错误'); })
                .finally(function () { btn.disabled = false; });
        });

        document.getElementById('btnRefreshCodes').addEventListener('click', function() {
            loadCodes(1);
        });
        var btnDeleteUnusedCodes = document.getElementById('btnDeleteUnusedCodes');
        if (btnDeleteUnusedCodes) {
            btnDeleteUnusedCodes.addEventListener('click', function () {
                if (
                    !confirm(
                        '确定删除普通激活码列表中全部「未使用」的码？\n已使用的不会删除；渠道批量库存码不在此范围。\n此操作不可恢复。'
                    )
                ) {
                    return;
                }
                btnDeleteUnusedCodes.disabled = true;
                adminFetch('api/admin/codes/delete-unused', {
                    method: 'POST',
                    body: JSON.stringify({ scope: 'general' })
                })
                    .then(function (r) {
                        return (window.adminParseJson||function(r){return r.json();})(r);
                    })
                    .then(function (d) {
                        if (d.code === 200) {
                            alert(d.msg || '已删除');
                            loadCodes(1);
                        } else {
                            alert(d.msg || '删除失败');
                        }
                    })
                    .catch(function () {
                        alert('网络错误');
                    })
                    .finally(function () {
                        btnDeleteUnusedCodes.disabled = false;
                    });
            });
        }
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
                var xyChannel = document.getElementById('xianyuCodeChannelFilter');
                if (xyChannel) xyChannel.value = XIANYU_CODE_DEFAULT_CHANNEL;
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
                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
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
                    .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
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
                    .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
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

        /* ========== Settings / Configuration ========== */
        function loadAdminSettings() {
            adminFetch('api/admin/settings')
                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                .then(function (data) {
                    if (data.code === 200 && data.data) {
                        var pricingAb = data.data.pricing_ab;
                        applySkuCatalogToForm(
                            data.data.sku_catalog ||
                                data.data.sku_catalog_prices ||
                                (pricingAb && pricingAb.sku_catalog) ||
                                (pricingAb && pricingAb.catalog_amounts) ||
                                {}
                        );
                        applyTaxEditFeeToForm(data.data.tax_edit_fee || {});
                        applyRenameFeeToForm(data.data.rename_fee || {});
                        applyLizhiCertFeeToForm(data.data.lizhi_cert_fee || {});
                        applyNajiluQrFeeToForm(data.data.najilu_qr_fee || {});
                        var nudge = data.data.activation_nudge;
                        if (nudge) {
                            var nEn = document.getElementById('actNudgeEnabled');
                            if (nEn) nEn.checked = nudge.enabled !== false;
                            var nTitle = document.getElementById('actNudgeTitle');
                            if (nTitle && nudge.title != null) nTitle.value = String(nudge.title);
                            var nBody = document.getElementById('actNudgeBody');
                            if (nBody && nudge.body != null) nBody.value = String(nudge.body);
                            var nCta = document.getElementById('actNudgeCta');
                            if (nCta && nudge.cta_text != null) nCta.value = String(nudge.cta_text);
                            var nDis = document.getElementById('actNudgeDismiss');
                            if (nDis && nudge.dismiss_text != null) nDis.value = String(nudge.dismiss_text);
                            var nLink = document.getElementById('actNudgeLink');
                            if (nLink && nudge.link_url != null) nLink.value = String(nudge.link_url);
                            var nHours = document.getElementById('actNudgeMinHours');
                            if (nHours && nudge.min_hours_since_register != null) {
                                nHours.value = String(nudge.min_hours_since_register);
                            }
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
                        var qqAddEl = document.getElementById('qqAddUrl');
                        if (qqAddEl && data.data.qq_add_url != null) {
                            qqAddEl.value = String(data.data.qq_add_url);
                        }
                        var qqGroupEl = document.getElementById('qqGroupUrl');
                        if (qqGroupEl && data.data.qq_group_url != null) {
                            qqGroupEl.value = String(data.data.qq_group_url);
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

        function skuCatalogRows() {
            var table = document.getElementById('skuCatalogTable');
            if (!table) return [];
            return Array.prototype.slice.call(table.querySelectorAll('tbody tr[data-sku-id]'));
        }

        function collectSkuCatalogFromForm() {
            var out = {};
            skuCatalogRows().forEach(function (row) {
                var skuId = row.getAttribute('data-sku-id');
                if (!skuId) return;
                var enabledEl = row.querySelector('.sku-catalog-enabled');
                var amountEl = row.querySelector('.sku-catalog-amount');
                var psychEl = row.querySelector('.sku-catalog-psych');
                var daysEl = row.querySelector('.sku-catalog-days');
                var hoursEl = row.querySelector('.sku-catalog-hours');
                out[skuId] = {
                    amount: amountEl ? String(amountEl.value || '').trim() : '',
                    psych_amount: psychEl ? String(psychEl.value || '').trim() : '',
                    grant_days: daysEl ? String(daysEl.value || '').trim() : '0',
                    grant_hours: hoursEl ? String(hoursEl.value || '').trim() : '0',
                    enabled: !!(enabledEl && enabledEl.checked)
                };
            });
            return out;
        }

        function applySkuCatalogToForm(map) {
            map = map || {};
            skuCatalogRows().forEach(function (row) {
                var skuId = row.getAttribute('data-sku-id');
                if (!skuId) return;
                var raw = map[skuId];
                var entry =
                    raw && typeof raw === 'object'
                        ? raw
                        : raw != null && String(raw).trim() !== ''
                          ? { amount: raw }
                          : null;
                if (!entry) return;
                var enabledEl = row.querySelector('.sku-catalog-enabled');
                var amountEl = row.querySelector('.sku-catalog-amount');
                var psychEl = row.querySelector('.sku-catalog-psych');
                var daysEl = row.querySelector('.sku-catalog-days');
                var hoursEl = row.querySelector('.sku-catalog-hours');
                if (amountEl && entry.amount != null && String(entry.amount).trim() !== '') {
                    amountEl.value = String(entry.amount);
                }
                if (psychEl) {
                    psychEl.value =
                        entry.psych_amount != null && String(entry.psych_amount).trim() !== ''
                            ? String(entry.psych_amount)
                            : '';
                }
                if (daysEl && entry.grant_days != null && String(entry.grant_days).trim() !== '') {
                    daysEl.value = String(entry.grant_days);
                }
                if (hoursEl && entry.grant_hours != null && String(entry.grant_hours).trim() !== '') {
                    hoursEl.value = String(entry.grant_hours);
                }
                if (enabledEl && entry.enabled != null) {
                    enabledEl.checked = !(
                        entry.enabled === false ||
                        entry.enabled === 0 ||
                        entry.enabled === '0'
                    );
                }
            });
            updateSkuCatalogPriceLabels(map);
            renderBidPsychPriceBar();
        }

        function formatSkuYuan(raw) {
            var n = Number(String(raw == null ? '' : raw).replace(/,/g, '').trim());
            if (!isFinite(n) || n <= 0) return '';
            return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
        }

        function formatSkuDurationBits(entry) {
            var days = parseInt(entry && entry.grant_days, 10) || 0;
            var hours = parseInt(entry && entry.grant_hours, 10) || 0;
            var bits = [];
            if (days) bits.push(days + '天');
            if (hours) bits.push(hours + '小时');
            return bits.join('');
        }

        function updateSkuCatalogPriceLabels(map) {
            var catalog = collectSkuCatalogFromForm();
            if (map && typeof map === 'object') {
                Object.keys(map).forEach(function (id) {
                    var raw = map[id];
                    if (raw && typeof raw === 'object') {
                        catalog[id] = Object.assign({}, catalog[id] || {}, raw);
                    } else if (raw != null && String(raw).trim() !== '') {
                        catalog[id] = Object.assign({}, catalog[id] || {}, { amount: raw });
                    }
                });
            }
            var skuSel = document.getElementById('priceOfferSku');
            if (!skuSel) return;
            var current = skuSel.value;
            skuSel.innerHTML = '';
            skuCatalogRows().forEach(function (row) {
                var skuId = row.getAttribute('data-sku-id');
                var label = row.getAttribute('data-sku-label') || skuId;
                var entry = catalog[skuId] || {};
                if (entry.enabled === false) {
                    label += '（已下架）';
                }
                var yuan = formatSkuYuan(entry.amount);
                var dur = formatSkuDurationBits(entry);
                var text = label;
                if (dur) text += ' ' + dur;
                if (yuan) text += '（原价 ¥' + yuan + '）';
                var opt = document.createElement('option');
                opt.value = skuId;
                opt.textContent = text;
                skuSel.appendChild(opt);
            });
            if (current) skuSel.value = current;
            renderBidPsychPriceBar();
        }

        function renderBidPsychPriceBar() {
            var specs = [
                { sku: 'sku_300_7d', valId: 'bidPsychWeekDisplay', subId: 'bidPsychWeekSub' },
                { sku: 'sku_348_14d', valId: 'bidPsychTwoWeekDisplay', subId: 'bidPsychTwoWeekSub' },
                { sku: 'sku_398_30d', valId: 'bidPsychMonthDisplay', subId: 'bidPsychMonthSub' }
            ];
            if (!document.getElementById('bidPsychPriceBar')) return;
            var catalog = collectSkuCatalogFromForm();
            specs.forEach(function (spec) {
                var valEl = document.getElementById(spec.valId);
                var subEl = document.getElementById(spec.subId);
                var entry = catalog[spec.sku] || {};
                var psych = formatSkuYuan(entry.psych_amount);
                var list = formatSkuYuan(entry.amount);
                if (valEl) valEl.textContent = psych ? '¥' + psych : '未填';
                if (subEl) {
                    subEl.textContent = list
                        ? psych
                            ? '目录价 ¥' + list
                            : '未填则按目录价 ¥' + list + ' 收款'
                        : psych
                          ? '已启用心理价特惠'
                          : '支付套餐未填价格';
                }
            });
        }

        function applyRenameFeeToForm(cfg) {
            cfg = cfg || {};
            var el = document.getElementById('renameFeeAmount');
            var raw = cfg.amount != null ? cfg.amount : cfg.fee_amount;
            if (el && raw != null && String(raw).trim() !== '') {
                el.value = String(raw);
            }
        }

        function collectRenameFeeFromForm() {
            var el = document.getElementById('renameFeeAmount');
            return {
                amount: el ? String(el.value || '').trim() : ''
            };
        }

        function applyLizhiCertFeeToForm(cfg) {
            cfg = cfg || {};
            var el = document.getElementById('lizhiCertFeeAmount');
            var raw = cfg.amount != null ? cfg.amount : cfg.fee_amount;
            if (el && raw != null && String(raw).trim() !== '') {
                el.value = String(raw);
            }
        }

        function collectLizhiCertFeeFromForm() {
            var el = document.getElementById('lizhiCertFeeAmount');
            return {
                amount: el ? String(el.value || '').trim() : ''
            };
        }

        function applyNajiluQrFeeToForm(cfg) {
            cfg = cfg || {};
            var el = document.getElementById('najiluQrFeeAmount');
            var raw = cfg.amount != null ? cfg.amount : cfg.fee_amount;
            if (el && raw != null && String(raw).trim() !== '') {
                el.value = String(raw);
            }
        }

        function collectNajiluQrFeeFromForm() {
            var el = document.getElementById('najiluQrFeeAmount');
            return {
                amount: el ? String(el.value || '').trim() : ''
            };
        }

        var btnSaveLizhiCertFee = document.getElementById('btnSaveLizhiCertFee');
        if (btnSaveLizhiCertFee) {
            btnSaveLizhiCertFee.addEventListener('click', function () {
                var btn = btnSaveLizhiCertFee;
                var fees = collectLizhiCertFeeFromForm();
                var n = Number(String(fees.amount || '').replace(/,/g, '').trim());
                if (!isFinite(n) || n < 0.01 || n > 99999.99) {
                    alert('请填写 0.01～99999.99 的证明金额');
                    return;
                }
                btn.disabled = true;
                var hint = document.getElementById('lizhiCertFeeHint');
                if (hint) hint.textContent = '保存中…';
                adminFetch('api/admin/settings', {
                    method: 'POST',
                    body: JSON.stringify({ lizhi_cert_fee: fees })
                })
                    .then(function (r) {
                        return (window.adminParseJson||function(r){return r.json();})(r);
                    })
                    .then(function (data) {
                        if (data.code === 200) {
                            if (hint) hint.textContent = '已保存';
                            applyLizhiCertFeeToForm((data.data && data.data.lizhi_cert_fee) || fees);
                            alert('离职/在职证明价格已保存，未下单用户将按新价格付款');
                        } else {
                            if (hint) hint.textContent = '';
                            alert(data.msg || '保存失败');
                        }
                    })
                    .catch(function () {
                        if (hint) hint.textContent = '';
                        alert('网络错误');
                    })
                    .finally(function () {
                        btn.disabled = false;
                    });
            });
        }

        var btnSaveNajiluQrFee = document.getElementById('btnSaveNajiluQrFee');
        if (btnSaveNajiluQrFee) {
            btnSaveNajiluQrFee.addEventListener('click', function () {
                var btn = btnSaveNajiluQrFee;
                var fees = collectNajiluQrFeeFromForm();
                var n = Number(String(fees.amount || '').replace(/,/g, '').trim());
                if (!isFinite(n) || n < 0.01 || n > 99999.99) {
                    alert('请填写 0.01～99999.99 的完税二维码金额');
                    return;
                }
                btn.disabled = true;
                var hint = document.getElementById('najiluQrFeeHint');
                if (hint) hint.textContent = '保存中…';
                adminFetch('api/admin/settings', {
                    method: 'POST',
                    body: JSON.stringify({ najilu_qr_fee: fees })
                })
                    .then(function (r) {
                        return (window.adminParseJson||function(r){return r.json();})(r);
                    })
                    .then(function (data) {
                        if (data.code === 200) {
                            if (hint) hint.textContent = '已保存';
                            applyNajiluQrFeeToForm((data.data && data.data.najilu_qr_fee) || fees);
                            alert('完税二维码价格已保存，未下单用户将按新价格付款');
                        } else {
                            if (hint) hint.textContent = '';
                            alert(data.msg || '保存失败');
                        }
                    })
                    .catch(function () {
                        if (hint) hint.textContent = '';
                        alert('网络错误');
                    })
                    .finally(function () {
                        btn.disabled = false;
                    });
            });
        }

        var btnSaveRenameFee = document.getElementById('btnSaveRenameFee');
        if (btnSaveRenameFee) {
            btnSaveRenameFee.addEventListener('click', function () {
                var btn = btnSaveRenameFee;
                var fees = collectRenameFeeFromForm();
                var n = Number(String(fees.amount || '').replace(/,/g, '').trim());
                if (!isFinite(n) || n < 0 || n > 99999.99) {
                    alert('请填写 0～99999.99 的单次改名金额；填 0 表示不用付款');
                    return;
                }
                btn.disabled = true;
                var hint = document.getElementById('renameFeeHint');
                if (hint) hint.textContent = '保存中…';
                adminFetch('api/admin/settings', {
                    method: 'POST',
                    body: JSON.stringify({ rename_fee: fees })
                })
                    .then(function (r) {
                        return (window.adminParseJson||function(r){return r.json();})(r);
                    })
                    .then(function (data) {
                        if (data.code === 200) {
                            if (hint) hint.textContent = '已保存';
                            applyRenameFeeToForm((data.data && data.data.rename_fee) || fees);
                            alert(
                                n <= 0
                                    ? '改名费用已保存为 0，超限账号改名也不用付款'
                                    : '改名费用已保存，超限账号将按新价格付款'
                            );
                        } else {
                            if (hint) hint.textContent = '';
                            alert(data.msg || '保存失败');
                        }
                    })
                    .catch(function () {
                        if (hint) hint.textContent = '';
                        alert('网络错误');
                    })
                    .finally(function () {
                        btn.disabled = false;
                    });
            });
        }

        function applyTaxEditFeeToForm(cfg) {
            cfg = cfg || {};
            var dailyEl = document.getElementById('taxEditFeeDaily');
            var daysEl = document.getElementById('taxEditFeeDaysGt');
            if (dailyEl && cfg.daily_amount != null && String(cfg.daily_amount).trim() !== '') {
                dailyEl.value = String(cfg.daily_amount);
            }
            if (daysEl && cfg.days_gt != null && String(cfg.days_gt).trim() !== '') {
                daysEl.value = String(cfg.days_gt);
            }
        }

        function collectTaxEditFeeFromForm() {
            var dailyEl = document.getElementById('taxEditFeeDaily');
            var daysEl = document.getElementById('taxEditFeeDaysGt');
            return {
                daily_amount: dailyEl ? String(dailyEl.value || '').trim() : '',
                days_gt: daysEl ? String(daysEl.value || '').trim() : ''
            };
        }

        var btnSaveTaxEditFee = document.getElementById('btnSaveTaxEditFee');
        if (btnSaveTaxEditFee) {
            btnSaveTaxEditFee.addEventListener('click', function () {
                var btn = btnSaveTaxEditFee;
                var fees = collectTaxEditFeeFromForm();
                var dailyN = Number(String(fees.daily_amount || '').replace(/,/g, '').trim());
                var daysN = parseInt(String(fees.days_gt || '').trim(), 10);
                if (!isFinite(dailyN) || dailyN < 0.01 || dailyN > 99999.99) {
                    alert('请填写 0.01～99999.99 的当天无限修改金额');
                    return;
                }
                if (!isFinite(daysN) || daysN < 0 || daysN > 999) {
                    alert('请填写 0～999 的个税修改天数阈值');
                    return;
                }
                btn.disabled = true;
                var hint = document.getElementById('taxEditFeeHint');
                if (hint) hint.textContent = '保存中…';
                adminFetch('api/admin/settings', {
                    method: 'POST',
                    body: JSON.stringify({ tax_edit_fee: fees })
                })
                    .then(function (r) {
                        return (window.adminParseJson||function(r){return r.json();})(r);
                    })
                    .then(function (data) {
                        if (data.code === 200) {
                            if (hint) hint.textContent = '已保存';
                            applyTaxEditFeeToForm((data.data && data.data.tax_edit_fee) || fees);
                            alert('个税修改收费与同行判定已保存');
                        } else {
                            if (hint) hint.textContent = '';
                            alert(data.msg || '保存失败');
                        }
                    })
                    .catch(function () {
                        if (hint) hint.textContent = '';
                        alert('网络错误');
                    })
                    .finally(function () {
                        btn.disabled = false;
                    });
            });
        }

        var btnSaveSkuCatalogPrices = document.getElementById('btnSaveSkuCatalogPrices');
        if (btnSaveSkuCatalogPrices) {
            btnSaveSkuCatalogPrices.addEventListener('click', function () {
                var btn = btnSaveSkuCatalogPrices;
                var catalog = collectSkuCatalogFromForm();
                var ids = Object.keys(catalog);
                var enabledCount = 0;
                for (var i = 0; i < ids.length; i++) {
                    var row = catalog[ids[i]];
                    var n = Number(String(row.amount || '').replace(/,/g, '').trim());
                    if (!isFinite(n) || n < 0.01 || n > 99999.99) {
                        alert('请为每个套餐填写 0.01～99999.99 的价格');
                        return;
                    }
                    var psychRaw = String(row.psych_amount || '').replace(/,/g, '').trim();
                    if (psychRaw) {
                        var pn = Number(psychRaw);
                        if (!isFinite(pn) || pn < 0.01 || pn > 99999.99 || pn >= n) {
                            alert('心理价须小于套餐价格，且为 0.01～99999.99；不填则不启用');
                            return;
                        }
                    }
                    var days = parseInt(row.grant_days, 10);
                    var hours = parseInt(row.grant_hours, 10);
                    if (!isFinite(days) || days < 0 || days > 365 ||
                        !isFinite(hours) || hours < 0 || hours > 720) {
                        alert('套餐时长请填写天数 0–365、小时 0–720');
                        return;
                    }
                    if (days + hours < 1) {
                        alert('每个套餐至少填写天数或小时');
                        return;
                    }
                    if (row.enabled) enabledCount += 1;
                }
                if (!enabledCount) {
                    alert('请至少上架一个套餐');
                    return;
                }
                btn.disabled = true;
                var hint = document.getElementById('skuCatalogPriceHint');
                if (hint) hint.textContent = '保存中…';
                adminFetch('api/admin/settings', {
                    method: 'POST',
                    body: JSON.stringify({ sku_catalog: catalog })
                })
                    .then(function (r) {
                        return (window.adminParseJson||function(r){return r.json();})(r);
                    })
                    .then(function (data) {
                        if (data.code === 200) {
                            if (hint) hint.textContent = '已保存';
                            applySkuCatalogToForm(
                                (data.data && (data.data.sku_catalog || data.data.sku_catalog_prices)) ||
                                    catalog
                            );
                            alert('套餐已保存，购买页将按新价格和时长下单');
                        } else {
                            if (hint) hint.textContent = '';
                            alert(data.msg || '保存失败');
                        }
                    })
                    .catch(function () {
                        if (hint) hint.textContent = '';
                        alert('网络错误');
                    })
                    .finally(function () {
                        btn.disabled = false;
                    });
            });
        }

        /* 心理价出价：配置 + 待处理审核 */
        (function bindPriceBids() {
            var tbody = document.getElementById('bidTbody');
            if (!tbody) return;
            var hint = document.getElementById('bidCfgHint');
            var counts = document.getElementById('bidCounts');
            var cfgLoaded = false;
            function currentStatus() {
                var el = document.querySelector('input[name="bidStatusFilter"]:checked');
                return el ? el.value : 'pending';
            }
            function fmtTime(v) {
                if (!v) return '—';
                try {
                    var d = new Date(v);
                    return (
                        String(d.getMonth() + 1).padStart(2, '0') +
                        '-' +
                        String(d.getDate()).padStart(2, '0') +
                        ' ' +
                        String(d.getHours()).padStart(2, '0') +
                        ':' +
                        String(d.getMinutes()).padStart(2, '0')
                    );
                } catch (e) {
                    return String(v);
                }
            }
            function statusCell(b) {
                if (b.status === 'pending') {
                    return (
                        '<input type="number" class="bid-accept-amount" data-id="' +
                        b.id +
                        '" value="' +
                        esc(b.bid_amount) +
                        '" min="1" step="0.01" style="width:76px;"> ' +
                        '<button type="button" class="btn-sm btn-primary bid-accept" data-id="' +
                        b.id +
                        '">通过</button> ' +
                        '<button type="button" class="btn-sm btn-ban bid-reject" data-id="' +
                        b.id +
                        '">驳回</button>'
                    );
                }
                if (b.status === 'accepted') {
                    return (
                        '<span class="badge badge-yes">已通过 ¥' +
                        esc(b.accepted_amount || b.bid_amount) +
                        (b.auto ? '（自动）' : '') +
                        '</span>'
                    );
                }
                return '<span class="badge badge-no">已驳回</span>';
            }
            function payCell(b) {
                if (b.pay_status === 'paid') {
                    var tip = [];
                    if (b.paid_amount) tip.push('¥' + String(b.paid_amount));
                    if (b.paid_at) tip.push(fmtTime(b.paid_at));
                    if (!tip.length && b.account_active) tip.push('已激活');
                    return (
                        '<span class="badge badge-yes" title="' +
                        esc(tip.join(' ') || '已付费') +
                        '">已付费</span>' +
                        (tip.length
                            ? '<div class="hint" style="margin-top:2px;">' + esc(tip.join(' ')) + '</div>'
                            : '')
                    );
                }
                if (b.pay_status === 'unpaid') {
                    return '<span class="badge badge-no">未付费</span>';
                }
                return '<span class="hint">—</span>';
            }
            function accountJumpButton(username) {
                var name = String(username || '').trim();
                if (!name) return '—';
                return (
                    '<button type="button" class="admin-user-jump js-bid-list-open-user" data-u="' +
                    esc(name) +
                    '" title="跳转到注册用户">' +
                    esc(name) +
                    '</button>'
                );
            }
            function render(items) {
                if (!items.length) {
                    tbody.innerHTML = '<tr><td colspan="8" class="hint">暂无记录</td></tr>';
                    return;
                }
                tbody.innerHTML = items
                    .map(function (b) {
                        return (
                            '<tr><td>' +
                            fmtTime(b.created_at) +
                            '</td><td>' +
                            accountJumpButton(b.username) +
                            '</td><td>' +
                            esc(b.sku_label || b.sku_id) +
                            '</td><td>' +
                            (b.list_amount ? '¥' + esc(b.list_amount) : '—') +
                            '</td><td><strong>¥' +
                            esc(b.bid_amount) +
                            '</strong></td><td>' +
                            esc(b.note || '—') +
                            '</td><td>' +
                            payCell(b) +
                            '</td><td>' +
                            statusCell(b) +
                            '</td></tr>'
                        );
                    })
                    .join('');
            }
            function loadBids() {
                tbody.innerHTML = '<tr><td colspan="8" class="hint">加载中…</td></tr>';
                adminFetch('api/admin/price-bids?status=' + encodeURIComponent(currentStatus()))
                    .then(function (r) {
                        return (window.adminParseJson||function(r){return r.json();})(r);
                    })
                    .then(function (data) {
                        if (data.code !== 200) {
                            tbody.innerHTML =
                                '<tr><td colspan="8" class="hint">' +
                                esc(data.msg || '加载失败') +
                                '</td></tr>';
                            return;
                        }
                        var d = data.data || {};
                        render(d.items || []);
                        if (counts && d.counts) {
                            counts.innerHTML =
                                '待处理 ' +
                                d.counts.pending +
                                ' · <a href="#sectionPriceBidFollowup" class="bid-accepted-jump" data-pay="unpaid">已通过 ' +
                                d.counts.accepted +
                                '</a> · 已驳回 ' +
                                d.counts.rejected;
                        }
                        if (!cfgLoaded && d.config) {
                            cfgLoaded = true;
                            var en = document.getElementById('bidCfgEnabled');
                            var pct = document.getElementById('bidCfgFloorPct');
                            var min = document.getElementById('bidCfgMin');
                            var daily = document.getElementById('bidCfgDaily');
                            var floorWeek = document.getElementById('bidCfgFloorWeek');
                            var floorTwo = document.getElementById('bidCfgFloorTwoWeek');
                            var floorMonth = document.getElementById('bidCfgFloorMonth');
                            var floors = d.config.floor_by_sku || {};
                            if (en) en.checked = d.config.enabled !== false;
                            if (pct) pct.value = d.config.floor_pct;
                            if (min) min.value = d.config.min_amount;
                            if (daily) daily.value = d.config.daily_limit;
                            if (floorWeek) floorWeek.value = floors.sku_300_7d != null ? floors.sku_300_7d : 120;
                            if (floorTwo) floorTwo.value = floors.sku_348_14d != null ? floors.sku_348_14d : 199;
                            if (floorMonth) floorMonth.value = floors.sku_398_30d != null ? floors.sku_398_30d : 298;
                        }
                    })
                    .catch(function () {
                        tbody.innerHTML = '<tr><td colspan="8" class="hint">网络错误</td></tr>';
                    });
            }
            tbody.addEventListener('click', function (ev) {
                var userBtn = ev.target.closest('.js-bid-list-open-user');
                if (userBtn) {
                    jumpToRegisteredUser(userBtn.getAttribute('data-u'));
                    return;
                }
                var btn = ev.target.closest('.bid-accept, .bid-reject');
                if (!btn) return;
                var id = btn.getAttribute('data-id');
                var isAccept = btn.classList.contains('bid-accept');
                var amount = '';
                if (isAccept) {
                    var input = tbody.querySelector('.bid-accept-amount[data-id="' + id + '"]');
                    amount = input ? String(input.value || '').trim() : '';
                    if (!amount || !(Number(amount) > 0)) {
                        alert('请填写有效成交价');
                        return;
                    }
                    if (!confirm('确认按 ¥' + amount + ' 通过该出价？将立即生效为该账号专属价；若用户已留邮箱会同步发邮件。')) return;
                } else if (!confirm('确认驳回该出价？会站内信告知用户（有邮箱则同步邮件）。')) {
                    return;
                }
                btn.disabled = true;
                adminFetch('api/admin/price-bids/review', {
                    method: 'POST',
                    body: JSON.stringify({
                        id: Number(id),
                        action: isAccept ? 'accept' : 'reject',
                        amount: amount || undefined
                    })
                })
                    .then(function (r) {
                        return (window.adminParseJson||function(r){return r.json();})(r);
                    })
                    .then(function (data) {
                        alert(data.msg || (data.code === 200 ? '已处理' : '处理失败'));
                        loadBids();
                    })
                    .catch(function () {
                        alert('网络错误');
                        btn.disabled = false;
                    });
            });
            document.querySelectorAll('input[name="bidStatusFilter"]').forEach(function (r) {
                r.addEventListener('change', loadBids);
            });
            var btnReload = document.getElementById('btnReloadBids');
            if (btnReload) btnReload.addEventListener('click', loadBids);
            var btnJumpSku = document.getElementById('btnJumpSkuPsych');
            if (btnJumpSku) {
                btnJumpSku.addEventListener('click', function () {
                    var el = document.getElementById('skuCatalogSection');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            }
            var skuTable = document.getElementById('skuCatalogTable');
            if (skuTable && !skuTable.getAttribute('data-psych-bar-bound')) {
                skuTable.setAttribute('data-psych-bar-bound', '1');
                skuTable.addEventListener('input', function (ev) {
                    if (ev.target && ev.target.classList && ev.target.classList.contains('sku-catalog-psych')) {
                        renderBidPsychPriceBar();
                    }
                    if (ev.target && ev.target.classList && ev.target.classList.contains('sku-catalog-amount')) {
                        renderBidPsychPriceBar();
                    }
                });
            }
            renderBidPsychPriceBar();
            var btnSaveCfg = document.getElementById('btnSaveBidCfg');
            if (btnSaveCfg) {
                btnSaveCfg.addEventListener('click', function () {
                    var payload = {
                        enabled: !!(document.getElementById('bidCfgEnabled') || {}).checked,
                        floor_pct: (document.getElementById('bidCfgFloorPct') || {}).value,
                        min_amount: (document.getElementById('bidCfgMin') || {}).value,
                        daily_limit: (document.getElementById('bidCfgDaily') || {}).value,
                        floor_by_sku: {
                            sku_300_7d: (document.getElementById('bidCfgFloorWeek') || {}).value,
                            sku_348_14d: (document.getElementById('bidCfgFloorTwoWeek') || {}).value,
                            sku_398_30d: (document.getElementById('bidCfgFloorMonth') || {}).value
                        }
                    };
                    btnSaveCfg.disabled = true;
                    if (hint) hint.textContent = '保存中…';
                    adminFetch('api/admin/price-bids/config', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    })
                        .then(function (r) {
                            return (window.adminParseJson||function(r){return r.json();})(r);
                        })
                        .then(function (data) {
                            if (data.code === 200) {
                                if (hint) hint.textContent = '已保存';
                                adminToast(data.msg || '出价配置已保存');
                            } else {
                                if (hint) hint.textContent = '';
                                adminToast(data.msg || '保存失败', { type: 'error' });
                            }
                        })
                        .catch(function () {
                            if (hint) hint.textContent = '';
                            adminToast('网络错误', { type: 'error' });
                        })
                        .finally(function () {
                            btnSaveCfg.disabled = false;
                        });
                });
            }
            (function bindBidFollowup() {
                var followTbody = document.getElementById('bidFollowTbody');
                if (!followTbody) return;
                var followCounts = document.getElementById('bidFollowCounts');
                var followHint = document.getElementById('bidFollowHint');
                function currentPayFilter() {
                    var el = document.querySelector('input[name="bidFollowPayFilter"]:checked');
                    return el ? el.value : 'unpaid';
                }
                function setPayFilter(pay) {
                    var want = pay === 'paid' || pay === 'all' ? pay : 'unpaid';
                    document.querySelectorAll('input[name="bidFollowPayFilter"]').forEach(function (r) {
                        r.checked = r.value === want;
                    });
                }
                function jumpToFollowup(pay) {
                    if (pay) setPayFilter(pay);
                    var el = document.getElementById('sectionPriceBidFollowup');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    loadFollowup();
                }
                function payBadge(row) {
                    if (row.pay_status === 'paid') {
                        return '<span class="badge badge-yes">已付费</span>';
                    }
                    return '<span class="badge badge-no">未付费</span>';
                }
                function accountJumpButton(username) {
                    var name = String(username || '').trim();
                    if (!name) return '—';
                    return (
                        '<button type="button" class="admin-user-jump js-bid-follow-open-user" data-u="' +
                        esc(name) +
                        '" title="跳转到注册用户">' +
                        esc(name) +
                        '</button>'
                    );
                }
                function paidCell(row) {
                    if (row.pay_status !== 'paid') return '—';
                    var parts = [];
                    if (row.paid_amount) parts.push('¥' + esc(row.paid_amount));
                    if (row.paid_at) parts.push(fmtTime(row.paid_at));
                    return parts.length ? parts.join(' ') : '已激活';
                }
                function renderFollow(items) {
                    if (!items.length) {
                        followTbody.innerHTML = '<tr><td colspan="8" class="hint">暂无记录</td></tr>';
                        return;
                    }
                    followTbody.innerHTML = items
                        .map(function (row) {
                            var canRemind = row.pay_status === 'unpaid' && row.email;
                            var remindBtn = canRemind
                                ? '<button type="button" class="btn-sm btn-primary bid-follow-remind" data-id="' +
                                  esc(String(row.id)) +
                                  '">催付邮件</button>'
                                : '<button type="button" class="btn-sm" disabled title="' +
                                  (row.pay_status === 'paid' ? '已付费' : '无邮箱') +
                                  '">催付邮件</button>';
                            return (
                                '<tr data-bid-id="' +
                                esc(String(row.id)) +
                                '"><td>' +
                                fmtTime(row.reviewed_at || row.created_at) +
                                '</td><td>' +
                                accountJumpButton(row.username) +
                                '</td><td>' +
                                esc(row.sku_label || row.sku_id) +
                                '</td><td><strong>¥' +
                                esc(row.accepted_amount || row.bid_amount) +
                                '</strong>' +
                                (row.auto ? ' <span class="hint">自动</span>' : '') +
                                '</td><td>' +
                                payBadge(row) +
                                '</td><td>' +
                                paidCell(row) +
                                '</td><td>' +
                                (row.email ? esc(row.email) : '<span class="hint">未留</span>') +
                                '</td><td>' +
                                remindBtn +
                                ' <button type="button" class="btn-sm btn-page bid-follow-detail" data-id="' +
                                esc(String(row.id)) +
                                '">详情</button></td></tr>' +
                                '<tr class="bid-follow-detail-row" id="bid_follow_detail_' +
                                esc(String(row.id)) +
                                '" hidden><td colspan="8" class="hint">展开中…</td></tr>'
                            );
                        })
                        .join('');
                }
                function loadFollowup() {
                    followTbody.innerHTML = '<tr><td colspan="8" class="hint">加载中…</td></tr>';
                    if (followHint) followHint.textContent = '';
                    adminFetch(
                        'api/admin/price-bids/followup?pay=' + encodeURIComponent(currentPayFilter()) + '&limit=200'
                    )
                        .then(function (r) {
                            return (window.adminParseJson || function (r) {
                                return r.json();
                            })(r);
                        })
                        .then(function (data) {
                            if (data.code !== 200) {
                                followTbody.innerHTML =
                                    '<tr><td colspan="8" class="hint">' +
                                    esc(data.msg || '加载失败') +
                                    '</td></tr>';
                                return;
                            }
                            var d = data.data || {};
                            renderFollow(d.items || []);
                            if (followCounts && d.counts) {
                                followCounts.textContent =
                                    '全部 ' +
                                    d.counts.all +
                                    ' · 未付费 ' +
                                    d.counts.unpaid +
                                    ' · 已付费 ' +
                                    d.counts.paid;
                            }
                        })
                        .catch(function () {
                            followTbody.innerHTML = '<tr><td colspan="8" class="hint">网络错误</td></tr>';
                        });
                }
                function renderDetailHtml(data) {
                    var item = (data && data.item) || {};
                    var payments = (data && data.payments) || [];
                    var lines = [];
                    lines.push(
                        '<div><strong>专属价</strong>：' +
                            (item.offer_enabled
                                ? '有效 ¥' + esc(item.offer_amount || item.accepted_amount || '—')
                                : '未启用/已失效') +
                            ' · 账号激活：' +
                            (item.account_active ? '是' : '否') +
                            '</div>'
                    );
                    if (!payments.length) {
                        lines.push('<div class="hint mt-6">暂无支付订单</div>');
                    } else {
                        lines.push('<div class="mt-6"><strong>近几笔订单</strong></div><ul style="margin:6px 0 0;padding-left:18px;">');
                        payments.forEach(function (p) {
                            lines.push(
                                '<li>' +
                                    esc(p.status) +
                                    ' ¥' +
                                    esc(p.amount) +
                                    ' ' +
                                    esc(p.subject || '') +
                                    (p.paid_at ? ' · ' + fmtTime(p.paid_at) : '') +
                                    (p.pricing_variant ? ' · ' + esc(p.pricing_variant) : '') +
                                    '</li>'
                            );
                        });
                        lines.push('</ul>');
                    }
                    return lines.join('');
                }
                followTbody.addEventListener('click', function (ev) {
                    var userBtn = ev.target.closest('.js-bid-follow-open-user');
                    if (userBtn) {
                        jumpToRegisteredUser(userBtn.getAttribute('data-u'));
                        return;
                    }
                    var remindBtn = ev.target.closest('.bid-follow-remind');
                    if (remindBtn && !remindBtn.disabled) {
                        var rid = remindBtn.getAttribute('data-id');
                        if (!confirm('向该用户发送催付邮件（并站内信）？')) return;
                        remindBtn.disabled = true;
                        if (followHint) followHint.textContent = '发送中…';
                        adminFetch('api/admin/price-bids/remind', {
                            method: 'POST',
                            body: JSON.stringify({ id: Number(rid) })
                        })
                            .then(function (r) {
                                return (window.adminParseJson || function (r) {
                                    return r.json();
                                })(r);
                            })
                            .then(function (data) {
                                if (followHint) followHint.textContent = data.msg || '';
                                if (data.code !== 200) alert(data.msg || '催付失败');
                                loadFollowup();
                            })
                            .catch(function () {
                                if (followHint) followHint.textContent = '';
                                alert('网络错误');
                                remindBtn.disabled = false;
                            });
                        return;
                    }
                    var detailBtn = ev.target.closest('.bid-follow-detail');
                    if (!detailBtn) return;
                    var did = detailBtn.getAttribute('data-id');
                    var detailRow = document.getElementById('bid_follow_detail_' + did);
                    if (!detailRow) return;
                    if (!detailRow.hidden && detailRow.getAttribute('data-loaded') === '1') {
                        detailRow.hidden = true;
                        return;
                    }
                    detailRow.hidden = false;
                    detailRow.querySelector('td').innerHTML = '<span class="hint">加载中…</span>';
                    adminFetch('api/admin/price-bids/followup-detail?id=' + encodeURIComponent(did))
                        .then(function (r) {
                            return (window.adminParseJson || function (r) {
                                return r.json();
                            })(r);
                        })
                        .then(function (data) {
                            if (data.code !== 200) {
                                detailRow.querySelector('td').innerHTML =
                                    '<span class="hint">' + esc(data.msg || '加载失败') + '</span>';
                                return;
                            }
                            detailRow.querySelector('td').innerHTML = renderDetailHtml(data.data || {});
                            detailRow.setAttribute('data-loaded', '1');
                        })
                        .catch(function () {
                            detailRow.querySelector('td').innerHTML = '<span class="hint">网络错误</span>';
                        });
                });
                document.querySelectorAll('input[name="bidFollowPayFilter"]').forEach(function (r) {
                    r.addEventListener('change', loadFollowup);
                });
                var btnReloadFollow = document.getElementById('btnReloadBidFollowup');
                if (btnReloadFollow) btnReloadFollow.addEventListener('click', loadFollowup);
                var btnBulk = document.getElementById('btnBulkRemindBidFollowup');
                if (btnBulk) {
                    btnBulk.addEventListener('click', function () {
                        if (!confirm('向当前未付费且有邮箱的用户批量发送催付邮件（最多 50）？')) return;
                        btnBulk.disabled = true;
                        if (followHint) followHint.textContent = '批量发送中…';
                        adminFetch('api/admin/price-bids/remind', {
                            method: 'POST',
                            body: JSON.stringify({ unpaid: true })
                        })
                            .then(function (r) {
                                return (window.adminParseJson || function (r) {
                                    return r.json();
                                })(r);
                            })
                            .then(function (data) {
                                if (followHint) followHint.textContent = data.msg || '';
                                if (data.code !== 200) alert(data.msg || '催付失败');
                                loadFollowup();
                            })
                            .catch(function () {
                                if (followHint) followHint.textContent = '';
                                alert('网络错误');
                            })
                            .finally(function () {
                                btnBulk.disabled = false;
                            });
                    });
                }
                var btnJumpFollow = document.getElementById('btnJumpBidFollowup');
                if (btnJumpFollow) {
                    btnJumpFollow.addEventListener('click', function () {
                        jumpToFollowup('unpaid');
                    });
                }
                if (counts) {
                    counts.addEventListener('click', function (ev) {
                        var a = ev.target.closest('.bid-accepted-jump');
                        if (!a) return;
                        ev.preventDefault();
                        jumpToFollowup(a.getAttribute('data-pay') || 'unpaid');
                    });
                }
                loadFollowup();
            })();
            loadBids();
        })();

        var btnSaveActNudge = document.getElementById('btnSaveActNudge');
        if (btnSaveActNudge) {
            btnSaveActNudge.addEventListener('click', function () {
                var minH = parseInt(document.getElementById('actNudgeMinHours').value, 10);
                if (!isFinite(minH) || minH < 0 || minH > 720) {
                    alert('注册满小时数请输入 0–720');
                    return;
                }
                var title = String(document.getElementById('actNudgeTitle').value || '').trim();
                var body = String(document.getElementById('actNudgeBody').value || '').trim();
                if (!title || !body) {
                    alert('请填写标题和正文');
                    return;
                }
                btnSaveActNudge.disabled = true;
                adminFetch('api/admin/settings', {
                    method: 'POST',
                    body: JSON.stringify({
                        activation_nudge: {
                            enabled: !!document.getElementById('actNudgeEnabled').checked,
                            title: title,
                            body: body,
                            cta_text: String(document.getElementById('actNudgeCta').value || '').trim() || '去激活',
                            dismiss_text:
                                String(document.getElementById('actNudgeDismiss').value || '').trim() ||
                                '今日不再提示',
                            link_url:
                                String(document.getElementById('actNudgeLink').value || '').trim() ||
                                'purchase.html',
                            min_hours_since_register: minH,
                            max_per_day: 1
                        }
                    })
                })
                    .then(function (r) {
                        return (window.adminParseJson||function(r){return r.json();})(r);
                    })
                    .then(function (data) {
                        if (data.code === 200) {
                            alert('激活引导弹窗配置已保存');
                            loadAdminSettings();
                        } else {
                            alert(data.msg || '保存失败');
                        }
                    })
                    .catch(function () {
                        alert('网络错误');
                    })
                    .finally(function () {
                        btnSaveActNudge.disabled = false;
                    });
            });
        }

        document.getElementById('btnSaveInstallPackages').addEventListener('click', function () {
            var btn = document.getElementById('btnSaveInstallPackages');
            btn.disabled = true;
            adminFetch('api/admin/settings', {
                method: 'POST',
                body: JSON.stringify({
                    android_apk_download_url: document.getElementById('androidApkDownloadUrl').value.trim(),
                    agent_android_apk_download_url: document.getElementById('agentAndroidApkDownloadUrl').value.trim(),
                    ios_mobileconfig_download_url: document.getElementById('iosMobileconfigDownloadUrl').value.trim(),
                    qq_add_url: (document.getElementById('qqAddUrl') && document.getElementById('qqAddUrl').value.trim()) || '',
                    qq_group_url: (document.getElementById('qqGroupUrl') && document.getElementById('qqGroupUrl').value.trim()) || '',
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
                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
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

        function escAgentCell(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        var AGENT_CH_SKU_SLOTS = [
            { key: 'week', priceId: 'agentChPriceWeek', psychId: 'agentChPsychWeek', daysId: 'agentChDaysWeek', hoursId: 'agentChHoursWeek', labelId: 'agentChLabelWeek' },
            { key: 'biweek', priceId: 'agentChPriceBiweek', psychId: 'agentChPsychBiweek', daysId: 'agentChDaysBiweek', hoursId: 'agentChHoursBiweek', labelId: 'agentChLabelBiweek' },
            { key: 'month', priceId: 'agentChPriceMonth', psychId: 'agentChPsychMonth', daysId: 'agentChDaysMonth', hoursId: 'agentChHoursMonth', labelId: 'agentChLabelMonth' },
            { key: 't4', priceId: 'agentChPriceT4', psychId: 'agentChPsychT4', daysId: 'agentChDaysT4', hoursId: 'agentChHoursT4', labelId: 'agentChLabelT4' },
            { key: 't5', priceId: 'agentChPriceT5', psychId: 'agentChPsychT5', daysId: 'agentChDaysT5', hoursId: 'agentChHoursT5', labelId: 'agentChLabelT5' }
        ];

        function agentChFieldVal(id) {
            var el = document.getElementById(id);
            return el ? String(el.value || '').trim() : '';
        }

        function resetAgentChannelForm() {
            var idEl = document.getElementById('agentChId');
            if (idEl) {
                idEl.value = '';
                idEl.readOnly = false;
            }
            var ownerEl = document.getElementById('agentChOwner');
            if (ownerEl) ownerEl.value = '';
            var pricingEl = document.getElementById('agentChPricing');
            if (pricingEl) pricingEl.value = 'b';
            AGENT_CH_SKU_SLOTS.forEach(function (slot) {
                [slot.priceId, slot.psychId, slot.daysId, slot.hoursId, slot.labelId].forEach(function (id) {
                    var el = document.getElementById(id);
                    if (el) el.value = '';
                });
            });
            var androidEl = document.getElementById('agentChAndroidUrl');
            if (androidEl) androidEl.value = '';
            var iosEl = document.getElementById('agentChIosUrl');
            if (iosEl) iosEl.value = '';
            var noteEl = document.getElementById('agentChNote');
            if (noteEl) noteEl.value = '';
            var enEl = document.getElementById('agentChEnabled');
            if (enEl) enEl.checked = true;
        }

        function fillAgentChannelForm(c) {
            if (!c) return;
            var idEl = document.getElementById('agentChId');
            if (idEl) {
                idEl.value = String(c.channel_id || '');
                idEl.readOnly = true;
            }
            var ownerEl = document.getElementById('agentChOwner');
            if (ownerEl) ownerEl.value = String(c.owner_admin_username || '');
            var pricingEl = document.getElementById('agentChPricing');
            if (pricingEl) pricingEl.value = c.default_pricing_abc === 'a' ? 'a' : 'b';
            var setVal = function (id, v) {
                var el = document.getElementById(id);
                if (el) el.value = v != null && String(v) !== '' ? String(v) : '';
            };
            AGENT_CH_SKU_SLOTS.forEach(function (slot) {
                setVal(slot.priceId, c['price_' + slot.key]);
                setVal(slot.psychId, c['psych_' + slot.key] != null ? c['psych_' + slot.key] : c['list_' + slot.key]);
                setVal(slot.daysId, c['days_' + slot.key]);
                setVal(slot.hoursId, c['hours_' + slot.key]);
                setVal(slot.labelId, c['label_' + slot.key]);
            });
            var androidEl = document.getElementById('agentChAndroidUrl');
            if (androidEl) androidEl.value = String(c.android_apk_url || '');
            var iosEl = document.getElementById('agentChIosUrl');
            if (iosEl) iosEl.value = String(c.ios_mobileconfig_url || '');
            var noteEl = document.getElementById('agentChNote');
            if (noteEl) noteEl.value = String(c.note || '');
            var enEl = document.getElementById('agentChEnabled');
            if (enEl) enEl.checked = c.enabled !== false;
        }

        function formatAgentChannelPrices(c) {
            if (!c || !c.has_channel_prices) return '—';
            function one(label, price, days, hours) {
                if (!price && days === '' && hours === '' && !label) return '';
                var dur = '';
                var d = days !== '' && days != null ? Number(days) : null;
                var h = hours !== '' && hours != null ? Number(hours) : null;
                if (d != null && !isNaN(d) || h != null && !isNaN(h)) {
                    d = d != null && !isNaN(d) ? d : 0;
                    h = h != null && !isNaN(h) ? h : 0;
                    if (d > 0 && h > 0) dur = d + '天' + h + '时';
                    else if (d > 0) dur = d + '天';
                    else if (h > 0) dur = h + '时';
                }
                var name = label || '';
                var bits = [];
                if (name) bits.push(name);
                if (price) bits.push('¥' + price);
                if (dur) bits.push(dur);
                return bits.join('');
            }
            var parts = AGENT_CH_SKU_SLOTS.map(function (slot) {
                return one(c['label_' + slot.key], c['price_' + slot.key], c['days_' + slot.key], c['hours_' + slot.key]);
            }).filter(Boolean);
            return parts.length ? parts.join(' / ') : '—';
        }

        function renderAgentChannels(list) {
            var tbody = document.getElementById('agentChannelsTbody');
            var empty = document.getElementById('agentChannelsEmpty');
            if (!tbody) return;
            tbody.innerHTML = '';
            list = Array.isArray(list) ? list : [];
            if (empty) empty.style.display = list.length ? 'none' : 'block';
            list.forEach(function (c) {
                var tr = document.createElement('tr');
                var hasApk = !!(c.android_apk_url && String(c.android_apk_url).trim());
                var hasIos = !!(c.ios_mobileconfig_url && String(c.ios_mobileconfig_url).trim());
                tr.innerHTML =
                    '<td><code>' +
                    escAgentCell(c.channel_id) +
                    '</code></td>' +
                    '<td>' +
                    escAgentCell(c.owner_admin_username || '—') +
                    '</td>' +
                    '<td>' +
                    escAgentCell(String(c.default_pricing_abc || '').toUpperCase() || '—') +
                    '</td>' +
                    '<td>' +
                    escAgentCell(formatAgentChannelPrices(c)) +
                    '</td>' +
                    '<td>' +
                    (hasApk ? '有' : '—') +
                    '</td>' +
                    '<td>' +
                    (hasIos ? '有' : '—') +
                    '</td>' +
                    '<td>' +
                    (c.enabled ? '启用' : '停用') +
                    '</td>' +
                    '<td>' +
                    '<button type="button" class="btn-sm btn-page agent-ch-edit" data-ch="' +
                    escAgentCell(c.channel_id) +
                    '">编辑</button> ' +
                    '<button type="button" class="btn-sm btn-ban agent-ch-del" data-ch="' +
                    escAgentCell(c.channel_id) +
                    '">删除</button>' +
                    '</td>';
                tbody.appendChild(tr);
            });
            tbody.querySelectorAll('.agent-ch-edit').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = btn.getAttribute('data-ch');
                    var found = null;
                    for (var i = 0; i < list.length; i++) {
                        if (String(list[i].channel_id) === id) {
                            found = list[i];
                            break;
                        }
                    }
                    fillAgentChannelForm(found);
                });
            });
            tbody.querySelectorAll('.agent-ch-del').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var id = btn.getAttribute('data-ch');
                    if (!id || !confirm('确认删除渠道「' + id + '」？')) return;
                    adminFetch('api/admin/agent-channels/' + encodeURIComponent(id), { method: 'DELETE' })
                        .then(function (r) {
                            return (window.adminParseJson||function(r){return r.json();})(r);
                        })
                        .then(function (data) {
                            if (data.code === 200) {
                                loadAgentChannels();
                                resetAgentChannelForm();
                            } else {
                                alert(data.msg || '删除失败');
                            }
                        })
                        .catch(function () {
                            alert('网络错误');
                        });
                });
            });
        }

        function loadAgentChannels() {
            if (!document.getElementById('agentChannelsTbody')) return;
            adminFetch('api/admin/agent-channels')
                .then(function (r) {
                    return (window.adminParseJson||function(r){return r.json();})(r);
                })
                .then(function (data) {
                    if (data.code === 200 && data.data) {
                        renderAgentChannels(data.data.channels || []);
                    }
                })
                .catch(function () {});
        }

        var btnSaveAgentChannel = document.getElementById('btnSaveAgentChannel');
        if (btnSaveAgentChannel) {
            btnSaveAgentChannel.addEventListener('click', function () {
                var channelId = String(document.getElementById('agentChId').value || '')
                    .trim()
                    .toLowerCase();
                if (!channelId || !/^[a-z0-9_-]{1,64}$/.test(channelId)) {
                    alert('渠道 ID 无效');
                    return;
                }
                btnSaveAgentChannel.disabled = true;
                var payload = {
                    channel_id: channelId,
                    owner_admin_username: String(document.getElementById('agentChOwner').value || '').trim(),
                    default_pricing_abc: document.getElementById('agentChPricing').value || 'b',
                    android_apk_url: String(document.getElementById('agentChAndroidUrl').value || '').trim(),
                    ios_mobileconfig_url: String(document.getElementById('agentChIosUrl').value || '').trim(),
                    note: String(document.getElementById('agentChNote').value || '').trim(),
                    enabled: !!(document.getElementById('agentChEnabled') && document.getElementById('agentChEnabled').checked)
                };
                AGENT_CH_SKU_SLOTS.forEach(function (slot) {
                    payload['price_' + slot.key] = agentChFieldVal(slot.priceId);
                    payload['psych_' + slot.key] = agentChFieldVal(slot.psychId);
                    payload['days_' + slot.key] = agentChFieldVal(slot.daysId);
                    payload['hours_' + slot.key] = agentChFieldVal(slot.hoursId);
                    payload['label_' + slot.key] = agentChFieldVal(slot.labelId);
                });
                adminFetch('api/admin/agent-channels', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                })
                    .then(function (r) {
                        return (window.adminParseJson||function(r){return r.json();})(r);
                    })
                    .then(function (data) {
                        if (data.code === 200) {
                            alert('渠道已保存');
                            loadAgentChannels();
                            resetAgentChannelForm();
                        } else {
                            alert(data.msg || '保存失败');
                        }
                    })
                    .catch(function () {
                        alert('网络错误');
                    })
                    .finally(function () {
                        btnSaveAgentChannel.disabled = false;
                    });
            });
        }
        var btnResetAgentChannel = document.getElementById('btnResetAgentChannel');
        if (btnResetAgentChannel) {
            btnResetAgentChannel.addEventListener('click', resetAgentChannelForm);
        }

        var MINE_UI_FIELD_KEYS = [
            'header_male', 'header_female', 'icon_family', 'icon_employer', 'icon_bank',
            'nav_sy_1', 'nav_sy_2', 'nav_db_1', 'nav_db_2', 'nav_bc_1', 'nav_bc_2',
            'nav_xx_1', 'nav_xx_2', 'nav_w_1', 'nav_w_2',
            'shouye_banner', 'shouye_zdfwdb', 'shouye_lb', 'shouye_zdb', 'daiban_header', 'bancha_header', 'message_header',
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
                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
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

        var btnRefreshServerMonitor = document.getElementById('btnRefreshServerMonitor');
        if (btnRefreshServerMonitor) {
            btnRefreshServerMonitor.addEventListener('click', function () {
                loadServerMonitor();
            });
        }
        var chkMonitorAutoHeal = document.getElementById('chkMonitorAutoHeal');
        if (chkMonitorAutoHeal) {
            chkMonitorAutoHeal.addEventListener('change', function () {
                var on = !!this.checked;
                var chk = this;
                chk.disabled = true;
                adminFetch('api/admin/monitor/auto-heal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ enabled: on })
                })
                    .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                    .then(function (j) {
                        if (j.code === 200 && j.data) {
                            chk.checked = !!j.data.enabled;
                            var healStat = document.getElementById('monitorAutoHealStat');
                            if (healStat) {
                                healStat.textContent = j.msg || (j.data.enabled ? '已开启自动修复' : '已关闭自动修复');
                            }
                        } else {
                            chk.checked = !on;
                            alert(j.msg || '切换失败');
                        }
                    })
                    .catch(function () {
                        chk.checked = !on;
                        alert('网络错误');
                    })
                    .then(function () { chk.disabled = false; });
            });
        }
        var btnMonitorRunSelftest = document.getElementById('btnMonitorRunSelftest');
        if (btnMonitorRunSelftest) {
            btnMonitorRunSelftest.addEventListener('click', function () {
                var btn = this;
                btn.disabled = true;
                adminFetch('api/admin/monitor/run', { method: 'POST' })
                    .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                    .then(function (j) {
                        if (j.code === 200 && j.data) {
                            renderServerMonitor(j.data);
                        } else {
                            alert(j.msg || '自测失败');
                        }
                    })
                    .catch(function () { alert('网络错误'); })
                    .then(function () { btn.disabled = false; });
            });
        }
        var btnAddBlockedIp = document.getElementById('btnAddBlockedIp');
        if (btnAddBlockedIp) {
            btnAddBlockedIp.addEventListener('click', function () {
                var ip = document.getElementById('blockedIpInput');
                var reason = document.getElementById('blockedIpReasonInput');
                if (!ip || !ip.value.trim()) {
                    alert('请输入 IP 地址');
                    return;
                }
                var ipVal = ip.value.trim();
                if (!confirm('确定封禁 IP「' + ipVal + '」？封禁后该 IP 下的所有用户将无法登录和注册。')) return;
                adminFetch('api/admin/block-ip', {
                    method: 'POST',
                    body: JSON.stringify({ ip: ipVal, reason: reason ? reason.value.trim() : '' })
                })
                    .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                    .then(function (d) {
                        if (d.code === 200) {
                            alert('IP ' + ipVal + ' 已封禁');
                            ip.value = '';
                            if (reason) reason.value = '';
                            if (document.getElementById('page-blocked-ips').classList.contains('active')) {
                                loadBlockedIps();
                            }
                        } else {
                            alert(d.msg || '操作失败');
                        }
                    })
                    .catch(function () { alert('网络错误'); });
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
                        return (window.adminParseJson||function(r){return r.json();})(r);
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
        var btnOpsStatsSendEmail = document.getElementById('btnOpsStatsSendEmail');
        if (btnOpsStatsSendEmail) {
            btnOpsStatsSendEmail.addEventListener('click', function () {
                if (!confirm('向运营日报邮箱补发昨日日活/注册/激活/支付日报（含支付分析收入拆分）？')) return;
                var btn = this;
                btn.disabled = true;
                adminFetch('api/admin/ops-stats/send-email', { method: 'POST' })
                    .then(function (r) {
                        return (window.adminParseJson||function(r){return r.json();})(r);
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
        var btnRefreshAnalytics = document.getElementById('btnRefreshAnalytics');
        if (btnRefreshAnalytics) {
            btnRefreshAnalytics.addEventListener('click', function () {
                loadAnalyticsActivityPage();
            });
        }
        var analyticsOverviewDays = document.getElementById('analyticsOverviewDays');
        if (analyticsOverviewDays) {
            analyticsOverviewDays.addEventListener('change', function () {
                loadAnalyticsActivityPage();
            });
        }
        var btnGotoLoginLog = document.getElementById('btnGotoLoginLog');
        if (btnGotoLoginLog) {
            btnGotoLoginLog.addEventListener('click', function () {
                location.hash = 'user-login-log';
            });
        }
        var analyticsDauTbody = document.getElementById('analyticsDauTbody');
        if (analyticsDauTbody) {
            analyticsDauTbody.addEventListener('click', function (e) {
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
        }
        document.querySelectorAll('.channel-funnel-tab').forEach(function (btn) {
            btn.addEventListener('click', function () {
                setChannelFunnelTab(btn.getAttribute('data-funnel'));
            });
        });
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
        var btnRefreshAbcInstallStats = document.getElementById('btnRefreshAbcInstallStats');
        if (btnRefreshAbcInstallStats) {
            btnRefreshAbcInstallStats.onclick = function () {
                loadAbcInstallStats();
            };
        }
        var abcInstallStatsDays = document.getElementById('abcInstallStatsDays');
        if (abcInstallStatsDays) {
            abcInstallStatsDays.addEventListener('change', function () {
                loadAbcInstallStats();
            });
        }
        var btnRefreshPurchaseEvents = document.getElementById('btnRefreshPurchaseEvents');
        if (btnRefreshPurchaseEvents) {
            btnRefreshPurchaseEvents.onclick = function () {
                loadAnalyticsPurchasePage();
            };
        }
        var analyticsPurchaseDays = document.getElementById('analyticsPurchaseDays');
        if (analyticsPurchaseDays) {
            analyticsPurchaseDays.addEventListener('change', function () {
                loadAnalyticsPurchasePage();
            });
        }
        function bulkMsgAudienceLabel(audience) {
            var labels = {
                pending_activate_24h: '注册超 24h 未激活',
                all_inactive: '全部未激活',
                inactive_has_tax: '未激活且有个税记录',
                inactive_no_tax: '未激活且无个税记录',
                inactive_visited_purchase: '未激活且去过支付页',
                inactive_purchase_no_pay: '未激活、去过支付页、未支付',
                inactive_has_d1: '未激活·有注册次日日活',
                inactive_d1_only: '未激活·仅次日回访（之后未再活跃）',
                inactive_high_income: '未激活·自己填月收入>1.5万',
                refund_eligible: '退税合格',
                refund_eligible_copied: '退税合格·已复制',
                refund_eligible_not_copied: '退税合格·未复制'
            };
            return labels[audience] || audience;
        }

        function bulkMsgPayload(dryRun) {
            var skipEl = document.getElementById('bulkMsgSkipSent');
            return {
                audience: String(
                    (document.getElementById('bulkMsgAudience') || {}).value || 'pending_activate_24h'
                ),
                title: String((document.getElementById('bulkMsgTitle') || {}).value || '').trim(),
                content: String((document.getElementById('bulkMsgContent') || {}).value || '').trim(),
                link_url: String((document.getElementById('bulkMsgLink') || {}).value || '').trim() || 'purchase.html',
                skip_already_sent: !!(skipEl && skipEl.checked),
                dry_run: !!dryRun
            };
        }

        /* ========== Session Init & Routing ========== */
        function setBulkMsgStatus(text) {
            var el = document.getElementById('bulkMsgStatus');
            if (el) el.textContent = text || '';
        }

        var bulkMsgAudienceEl = document.getElementById('bulkMsgAudience');
        if (bulkMsgAudienceEl) {
            bulkMsgAudienceEl.addEventListener('change', function () {
                var v = String(bulkMsgAudienceEl.value || '');
                if (v === 'inactive_d1_only' || v === 'inactive_has_d1') {
                    applyD1BulkDefaultCopy();
                } else if (v === 'inactive_high_income') {
                    applyHighIncomeBulkDefaultCopy();
                } else if (
                    v === 'refund_eligible' ||
                    v === 'refund_eligible_copied' ||
                    v === 'refund_eligible_not_copied'
                ) {
                    applyRefundEligibleBulkDefaultCopy();
                } else if (v === 'inactive_has_tax') {
                    applyHasTaxBulkDefaultCopy();
                } else if (
                    v === 'inactive_visited_purchase' ||
                    v === 'inactive_purchase_no_pay'
                ) {
                    applySawPayBulkDefaultCopy();
                }
            });
        }

        var btnBulkMsgPreview = document.getElementById('btnBulkMsgPreview');
        if (btnBulkMsgPreview) {
            btnBulkMsgPreview.addEventListener('click', function () {
                setBulkMsgStatus('预览中…');
                btnBulkMsgPreview.disabled = true;
                adminFetch('api/admin/messages/bulk', {
                    method: 'POST',
                    body: JSON.stringify(bulkMsgPayload(true))
                })
                    .then(function (r) {
                        return (window.adminParseJson||function(r){return r.json();})(r);
                    })
                    .then(function (j) {
                        if (j.code !== 200 || !j.data) {
                            setBulkMsgStatus(j.msg || '预览失败');
                            return;
                        }
                        setBulkMsgStatus('匹配 ' + (j.data.matched != null ? j.data.matched : 0) + ' 人');
                    })
                    .catch(function () {
                        setBulkMsgStatus('预览失败');
                    })
                    .finally(function () {
                        btnBulkMsgPreview.disabled = false;
                    });
            });
        }

        var btnBulkMsgSend = document.getElementById('btnBulkMsgSend');
        if (btnBulkMsgSend) {
            btnBulkMsgSend.addEventListener('click', function () {
                var payload = bulkMsgPayload(false);
                if (!payload.title || !payload.content) {
                    alert('请填写标题和正文');
                    return;
                }
                setBulkMsgStatus('核对人数…');
                btnBulkMsgSend.disabled = true;
                adminFetch('api/admin/messages/bulk', {
                    method: 'POST',
                    body: JSON.stringify(bulkMsgPayload(true))
                })
                    .then(function (r) {
                        return (window.adminParseJson||function(r){return r.json();})(r);
                    })
                    .then(function (prev) {
                        if (prev.code !== 200 || !prev.data) {
                            throw new Error(prev.msg || '预览失败');
                        }
                        var n = Number(prev.data.matched) || 0;
                        if (
                            !window.confirm(
                                '确认向「' +
                                    bulkMsgAudienceLabel(payload.audience) +
                                    '」群发站内信？\n预计 ' +
                                    n +
                                    ' 人。'
                            )
                        ) {
                            setBulkMsgStatus('已取消');
                            return null;
                        }
                        setBulkMsgStatus('发送中…');
                        return adminFetch('api/admin/messages/bulk', {
                            method: 'POST',
                            body: JSON.stringify(payload)
                        }).then(function (r2) {
                            return (window.adminParseJson||function(r2){return r2.json();})(r2);
                        });
                    })
                    .then(function (j) {
                        if (j == null) return;
                        if (j.code !== 200 || !j.data) {
                            setBulkMsgStatus(j.msg || '发送失败');
                            alert(j.msg || '发送失败');
                            return;
                        }
                        var msg = '已发送 ' + (j.data.sent != null ? j.data.sent : 0) + ' 条';
                        setBulkMsgStatus(msg);
                        alert(msg);
                    })
                    .catch(function (e) {
                        setBulkMsgStatus(e && e.message ? e.message : '发送失败');
                        alert(e && e.message ? e.message : '发送失败');
                    })
                    .finally(function () {
                        btnBulkMsgSend.disabled = false;
                    });
            });
        }

        function bulkEmailAudienceLabel(audience) {
            var labels = {
                has_email_inactive: '未激活且已留邮箱',
                price_offer_unpaid: '有专属价未开通',
                pending_activate_24h: '注册超 24h 未激活',
                all_inactive: '全部未激活',
                inactive_has_tax: '未激活且有个税记录',
                inactive_visited_purchase: '未激活且去过支付页',
                inactive_purchase_no_pay: '未激活、去过支付页、未支付',
                inactive_high_income: '未激活·月收入>1.5万',
                refund_eligible: '退税合格',
                refund_eligible_copied: '退税合格·已复制',
                refund_eligible_not_copied: '退税合格·未复制'
            };
            return labels[audience] || audience;
        }

        var EMAIL_COPY_TEMPLATES = {
            activate: {
                subject: '开通后去除水印，完整查看收入纳税明细',
                content:
                    '你好，\n\n开通后可去除演示水印，完整查看与导出收入纳税明细、纳税记录。\n付款一般几秒内自动到账，点下方按钮即可前往开通。',
                link_url: 'purchase.html?from=email_activate',
                cta_label: '立即开通',
                poster: 'activate'
            },
            offer: {
                subject: '你的专属优惠仍有效，打开即可按优惠价开通',
                content:
                    '你好，\n\n你的专属优惠价仍然有效。打开支付页将按该价格下单；开通后去除水印，完整使用收入明细与纳税记录。\n优惠可能随时调整，建议尽早开通。',
                link_url: 'purchase.html?from=email_offer',
                cta_label: '按优惠价开通',
                poster: 'offer'
            },
            soft_recall: {
                subject: '你的演示账号还在，开通即可完整体验',
                content:
                    '你好，\n\n你之前留下的演示账号仍可继续使用。开通后去除水印，可完整查看收入纳税明细并导出纳税记录。\n若暂时不需要，忽略本邮件即可。',
                link_url: 'purchase.html?from=email_recall',
                cta_label: '去开通页看看',
                poster: 'activate'
            }
        };

        function applyEmailCopyTemplate(prefix, templateId) {
            var t = EMAIL_COPY_TEMPLATES[templateId] || EMAIL_COPY_TEMPLATES.activate;
            var map = {
                bulk: {
                    subject: 'bulkEmailSubject',
                    content: 'bulkEmailContent',
                    link: 'bulkEmailLink',
                    cta: 'bulkEmailCta',
                    poster: 'bulkEmailPoster'
                },
                user: {
                    subject: 'userEmailSendSubject',
                    content: 'userEmailSendContent',
                    link: 'userEmailSendLink',
                    cta: 'userEmailSendCta',
                    poster: 'userEmailSendPoster'
                }
            };
            var ids = map[prefix] || map.bulk;
            var subj = document.getElementById(ids.subject);
            var body = document.getElementById(ids.content);
            var link = document.getElementById(ids.link);
            var cta = document.getElementById(ids.cta);
            var poster = document.getElementById(ids.poster);
            if (subj) subj.value = t.subject;
            if (body) body.value = t.content;
            if (link) link.value = t.link_url;
            if (cta) cta.value = t.cta_label;
            if (poster) poster.value = t.poster;
        }

        function bulkEmailPayload(dryRun) {
            var skipEl = document.getElementById('bulkEmailSkipSent');
            return {
                audience: String(
                    (document.getElementById('bulkEmailAudience') || {}).value || 'has_email_inactive'
                ),
                subject: String((document.getElementById('bulkEmailSubject') || {}).value || '').trim(),
                content: String((document.getElementById('bulkEmailContent') || {}).value || '').trim(),
                link_url:
                    String((document.getElementById('bulkEmailLink') || {}).value || '').trim() ||
                    'purchase.html',
                cta_label: String((document.getElementById('bulkEmailCta') || {}).value || '').trim() || '立即开通',
                poster: String((document.getElementById('bulkEmailPoster') || {}).value || 'activate'),
                skip_already_sent: !!(skipEl && skipEl.checked),
                dry_run: !!dryRun
            };
        }

        function setBulkEmailStatus(text) {
            var el = document.getElementById('bulkEmailStatus');
            if (el) el.textContent = text || '';
        }

        var bulkEmailTemplateEl = document.getElementById('bulkEmailTemplate');
        if (bulkEmailTemplateEl) {
            bulkEmailTemplateEl.addEventListener('change', function () {
                applyEmailCopyTemplate('bulk', bulkEmailTemplateEl.value);
            });
        }

        var bulkEmailAudienceEl = document.getElementById('bulkEmailAudience');
        if (bulkEmailAudienceEl) {
            bulkEmailAudienceEl.addEventListener('change', function () {
                var v = String(bulkEmailAudienceEl.value || '');
                var tpl = document.getElementById('bulkEmailTemplate');
                if (v === 'price_offer_unpaid') {
                    if (tpl) tpl.value = 'offer';
                    applyEmailCopyTemplate('bulk', 'offer');
                } else if (
                    v === 'refund_eligible' ||
                    v === 'refund_eligible_copied' ||
                    v === 'refund_eligible_not_copied'
                ) {
                    var subj = document.getElementById('bulkEmailSubject');
                    var body = document.getElementById('bulkEmailContent');
                    var link = document.getElementById('bulkEmailLink');
                    var cta = document.getElementById('bulkEmailCta');
                    if (subj) subj.value = '退税相关说明，开通后可完整查看明细';
                    if (body)
                        body.value =
                            '你好，\n\n根据你填写的个税数据，可能适合进一步了解退税相关说明。开通后可去除水印，完整查看收入纳税明细。\n点下方按钮前往了解。';
                    if (link) link.value = 'refund_ad.html?from=email_refund';
                    if (cta) cta.value = '了解详情';
                } else {
                    if (tpl) tpl.value = 'activate';
                    applyEmailCopyTemplate('bulk', 'activate');
                }
            });
        }

        var btnBulkEmailPreview = document.getElementById('btnBulkEmailPreview');
        if (btnBulkEmailPreview) {
            btnBulkEmailPreview.addEventListener('click', function () {
                setBulkEmailStatus('预览中…');
                btnBulkEmailPreview.disabled = true;
                adminFetch('api/admin/emails/bulk', {
                    method: 'POST',
                    body: JSON.stringify(bulkEmailPayload(true))
                })
                    .then(function (r) {
                        return (window.adminParseJson||function(r){return r.json();})(r);
                    })
                    .then(function (j) {
                        if (j.code !== 200 || !j.data) {
                            setBulkEmailStatus(j.msg || '预览失败');
                            return;
                        }
                        var smtpHint = j.data.smtp_ready ? '' : '（SMTP 未配置，无法实发）';
                        setBulkEmailStatus(
                            '匹配已留邮箱 ' +
                                (j.data.matched != null ? j.data.matched : 0) +
                                ' 人' +
                                smtpHint
                        );
                    })
                    .catch(function (e) {
                        setBulkEmailStatus(e && e.message ? e.message : '预览失败');
                    })
                    .finally(function () {
                        btnBulkEmailPreview.disabled = false;
                    });
            });
        }

        var btnBulkEmailSend = document.getElementById('btnBulkEmailSend');
        if (btnBulkEmailSend) {
            btnBulkEmailSend.addEventListener('click', function () {
                var payload = bulkEmailPayload(false);
                if (!payload.subject || !payload.content) {
                    alert('请填写邮件标题和正文');
                    return;
                }
                setBulkEmailStatus('核对人数…');
                btnBulkEmailSend.disabled = true;
                adminFetch('api/admin/emails/bulk', {
                    method: 'POST',
                    body: JSON.stringify(bulkEmailPayload(true))
                })
                    .then(function (r) {
                        return (window.adminParseJson||function(r){return r.json();})(r);
                    })
                    .then(function (j) {
                        if (j.code !== 200 || !j.data) {
                            throw new Error(j.msg || '预览失败');
                        }
                        if (!j.data.smtp_ready) {
                            throw new Error('SMTP 未配置，请先在 docker-compose / .env 设置 SMTP_USER、SMTP_PASS');
                        }
                        var n = j.data.matched != null ? j.data.matched : 0;
                        if (
                            !confirm(
                                '向「' +
                                    bulkEmailAudienceLabel(payload.audience) +
                                    '」群发邮件？\n预计 ' +
                                    n +
                                    ' 人（单次上限 200）。确认后将真实发出。'
                            )
                        ) {
                            throw new Error('已取消');
                        }
                        setBulkEmailStatus('发送中（较慢，请勿关闭）…');
                        return adminFetch('api/admin/emails/bulk', {
                            method: 'POST',
                            body: JSON.stringify(payload)
                        }).then(function (r2) {
                            return (window.adminParseJson||function(r2){return r2.json();})(r2);
                        });
                    })
                    .then(function (j) {
                        if (!j || j.code !== 200 || !j.data) {
                            setBulkEmailStatus((j && j.msg) || '发送失败');
                            alert((j && j.msg) || '发送失败');
                            return;
                        }
                        var msg =
                            '成功 ' +
                            (j.data.sent != null ? j.data.sent : 0) +
                            '，失败 ' +
                            (j.data.failed != null ? j.data.failed : 0);
                        setBulkEmailStatus(msg);
                        alert(msg);
                    })
                    .catch(function (e) {
                        var m = e && e.message ? e.message : '发送失败';
                        setBulkEmailStatus(m === '已取消' ? '' : m);
                        if (m !== '已取消') alert(m);
                    })
                    .finally(function () {
                        btnBulkEmailSend.disabled = false;
                    });
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
        var purchaseDailyTbody = document.getElementById('analyticsPurchaseDailyTbody');
        if (purchaseDailyTbody) {
            purchaseDailyTbody.addEventListener('click', function (e) {
                var purchaseToggle = e.target.closest('.btn-purchase-users-toggle');
                if (purchaseToggle) {
                    var datePu = purchaseToggle.getAttribute('data-date');
                    var keyPu = purchaseDateDomKey(datePu);
                    var rowPu = document.getElementById('purchase_users_row_' + keyPu);
                    var boxPu = document.getElementById('purchase_users_box_' + keyPu);
                    if (!rowPu || !boxPu) return;
                    var openingPu = rowPu.style.display === 'none';
                    if (!openingPu) {
                        rowPu.style.display = 'none';
                        purchaseToggle.textContent = '查看用户';
                        return;
                    }
                    rowPu.style.display = '';
                    purchaseToggle.textContent = '收起';
                    if (boxPu.getAttribute('data-loaded') === '1') return;
                    loadPurchaseUsersForDate(datePu, 1, boxPu);
                    return;
                }
                var purchasePrev = e.target.closest('.purchase-users-prev');
                if (purchasePrev && !purchasePrev.disabled) {
                    var datePp = purchasePrev.getAttribute('data-date');
                    var boxPp = purchasePrev.closest('.activate-users-box');
                    if (!boxPp || !datePp) return;
                    loadPurchaseUsersForDate(
                        datePp,
                        (parseInt(boxPp.getAttribute('data-page'), 10) || 1) - 1,
                        boxPp
                    );
                    return;
                }
                var purchaseNext = e.target.closest('.purchase-users-next');
                if (purchaseNext && !purchaseNext.disabled) {
                    var datePn = purchaseNext.getAttribute('data-date');
                    var boxPn = purchaseNext.closest('.activate-users-box');
                    if (!boxPn || !datePn) return;
                    loadPurchaseUsersForDate(
                        datePn,
                        (parseInt(boxPn.getAttribute('data-page'), 10) || 1) + 1,
                        boxPn
                    );
                }
            });
        }
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
        document.getElementById('btnRefreshLoginLog').addEventListener('click', function () {
            loginRecentLimit = parseInt(document.getElementById('loginLogPageSize').value, 10) || 20;
            loadLoginRecentPage(1);
        });
        var adminOpLogPrev = document.getElementById('adminOpLogPrev');
        if (adminOpLogPrev) {
            adminOpLogPrev.addEventListener('click', function () {
                if (adminOpLogPage > 1) loadAdminOperationLogPage(adminOpLogPage - 1);
            });
        }
        var adminOpLogNext = document.getElementById('adminOpLogNext');
        if (adminOpLogNext) {
            adminOpLogNext.addEventListener('click', function () {
                loadAdminOperationLogPage(adminOpLogPage + 1);
            });
        }
        var adminOpLogPageSize = document.getElementById('adminOpLogPageSize');
        if (adminOpLogPageSize) {
            adminOpLogPageSize.addEventListener('change', function () {
                adminOpLogLimit = parseInt(adminOpLogPageSize.value, 10) || 20;
                loadAdminOperationLogPage(1);
            });
        }
        var btnRefreshAdminOpLog = document.getElementById('btnRefreshAdminOpLog');
        if (btnRefreshAdminOpLog) {
            btnRefreshAdminOpLog.addEventListener('click', function () {
                var sz = document.getElementById('adminOpLogPageSize');
                adminOpLogLimit = sz ? parseInt(sz.value, 10) || 20 : 20;
                loadAdminOperationLogPage(1);
            });
        }
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
        var userActivateDuration = document.getElementById('userActivateDuration');
        if (userActivateDuration) {
            userActivateDuration.addEventListener('change', syncUserActivateCustomWrap);
        }


        function initNavGroupCollapse() {
            document.querySelectorAll('.nav-group-label').forEach(function (btn) {
                if (btn.__navCollapseBound) return;
                btn.__navCollapseBound = true;
                var group = btn.closest('.nav-group');
                if (!group) return;
                var key = group.getAttribute('data-nav-group') || '';
                try {
                    var saved = sessionStorage.getItem('admin_nav_' + key);
                    if (saved === '0') {
                        group.classList.add('is-collapsed');
                        btn.setAttribute('aria-expanded', 'false');
                    }
                } catch (e0) {}
                btn.addEventListener('click', function () {
                    var collapsed = group.classList.toggle('is-collapsed');
                    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                    try {
                        sessionStorage.setItem('admin_nav_' + key, collapsed ? '0' : '1');
                    } catch (e1) {}
                });
            });
        }

        function applySuperOnlyUi() {
            var isSuper = !!(currentAdminProfile && currentAdminProfile.is_super);
            document.querySelectorAll('[data-super-only]').forEach(function (el) {
                if (isSuper) {
                    el.removeAttribute('hidden');
                } else {
                    el.setAttribute('hidden', '');
                }
            });
        }

        function applyAdminSessionPayload(data) {
            if (!data || !data.admin) return;
            var a = data.admin;
            currentAdminProfile = {
                username: a.username ? String(a.username) : '',
                full_name: a.full_name ? String(a.full_name) : '',
                is_super: !!a.is_super,
                is_root_admin: !!a.is_root_admin,
                menus: sanitizeAdminMenus(a.menus, !!a.is_super)
            };
            if (window.AdminNav && typeof AdminNav.applyAdminIdentity === 'function') {
                AdminNav.applyAdminIdentity(currentAdminProfile);
            }
            localStorage.setItem('admin_profile', JSON.stringify(currentAdminProfile));
            if (Array.isArray(data.menu_tree)) {
                try { localStorage.setItem('admin_menu_tree', JSON.stringify(data.menu_tree)); } catch (e0) {}
                if (window.AdminNav) AdminNav.setMenuTree(data.menu_tree);
            }
            if (Array.isArray(data.pages) && window.AdminLoader) {
                AdminLoader.setPageModuleMap(data.pages);
            }
            if (Array.isArray(data.menu_defs)) {
                applyMenuDefsFromServer(data.menu_defs);
                adminMenuKeyList = data.menu_defs.map(function (d) { return d.key; });
            }
            if (data.first_page) window._adminFirstPage = String(data.first_page);
            applySuperOnlyUi();
            if (data.hubs && typeof data.hubs === 'object') {
                Object.keys(data.hubs).forEach(function (k) {
                    if (data.hubs[k] && Array.isArray(data.hubs[k].tabs)) {
                        ADMIN_HUB_DEFS[k] = data.hubs[k];
                    }
                });
                rebuildAdminHubMaps();
                if (window.AdminNav && typeof AdminNav.setHubs === 'function') {
                    AdminNav.setHubs(ADMIN_HUB_DEFS);
                }
            }
        }

        function initAdminSession() {
            readAdminProfileCache();
            applySuperOnlyUi();
            try {
                var MENU_TREE_VER = 'ops-ia-v26-hide-orders';
                if (localStorage.getItem('admin_menu_tree_ver') !== MENU_TREE_VER) {
                    localStorage.removeItem('admin_menu_tree');
                    localStorage.setItem('admin_menu_tree_ver', MENU_TREE_VER);
                }
                var cachedTree = JSON.parse(localStorage.getItem('admin_menu_tree') || 'null');
                if (cachedTree && window.AdminNav) AdminNav.setMenuTree(cachedTree);
            } catch (e1) {}
            applyMenuVisibility();
            if (!location.hash || location.hash === '#') {
                history.replaceState(null, '', '#' + firstAllowedAdminPage());
            }
            applyAdminRoute();
            adminFetch('api/admin/me')
                .then(function (r) { return (window.adminParseJson||function(r){return r.json();})(r); })
                .then(function (j) {
                    if (j.code !== 200 || !j.data || !j.data.admin) {
                        return;
                    }
                    applyAdminSessionPayload(j.data);
                    applyMenuVisibility();
                    var normalized = normalizeAdminPage(location.hash);
                    if (location.hash !== '#' + normalized) {
                        location.hash = normalized;
                        return;
                    }
                    applyAdminRoute({ force: true });
                })
                .catch(function () {});
        }

        document.addEventListener('click', function (e) {
            var tabBtn = e.target && e.target.closest ? e.target.closest('.admin-hub-tab') : null;
            if (!tabBtn) return;
            var hub = tabBtn.getAttribute('data-hub');
            var tab = tabBtn.getAttribute('data-tab');
            if (!hub || !tab || !ADMIN_HUB_DEFS[hub]) return;
            e.preventDefault();
            var hubDef = ADMIN_HUB_DEFS[hub];
            var hash = tab === hubDef.defaultTab ? hub : hub + '/' + tab;
            if (location.hash !== '#' + hash) {
                location.hash = hash;
            } else {
                applyAdminRoute({ page: hash, force: true });
            }
        });

        var navRoot = document.getElementById('adminSidebarNav');
        if (navRoot && window.AdminNav) {
            AdminNav.bindNavClicks(navRoot);
        } else {
        document.querySelectorAll('.nav-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var p = btn.getAttribute('data-page');
                    if (p) goAdminPage(p);
            });
        });
        }
        var logoutBtn = document.getElementById('btnAdminLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                if (typeof adminLogout === 'function') adminLogout();
            });
        }
        function goAdminPage(p) {
            p = String(p || '').replace(/^#/, '').trim();
            if (!p) return;
            var hasPanel = !!document.getElementById(adminPagePanelId(p));
            if (hasPanel || ADMIN_HUB_DEFS[p] || ADMIN_CONTENT_TO_HUB[p]) {
                applyAdminRoute({ force: true, page: p });
                var want = (_adminRouteState && _adminRouteState.hash) || p;
                if (location.hash !== '#' + want) {
                    try {
                        history.replaceState(null, '', '#' + want);
                    } catch (eHash) {
                        location.hash = want;
                    }
                }
                return;
            }
            var cur = String(location.hash || '').replace(/^#/, '');
            if (cur === p) {
                applyAdminRoute({ force: true });
            } else {
                location.hash = p;
            }
        }
        window.applyAdminRoute = applyAdminRoute;
        window.goAdminPage = goAdminPage;
        window.jumpToRegisteredUser = jumpToRegisteredUser;
        window.addEventListener('hashchange', function () {
            applyAdminRoute();
        });
        if (window.AdminAnalyticsPeriod) {
            AdminAnalyticsPeriod.initAll();
        }
        initAdminSession();
