/* Admin Panel Shared Utilities */
(function (global) {
    var U = {};

    U.esc = function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    U.analyticsPeriodVal = function analyticsPeriodVal(el) {
        if (global.AdminAnalyticsPeriod) {
            return AdminAnalyticsPeriod.getValue(el);
        }
        return el ? String(el.value || '1') : '1';
    };

    U.formatDt = function formatDt(iso) {
        if (!iso) return '';
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            var bj = new Date(d.getTime() + 8 * 3600000);
            var parts = bj.toISOString().split('T');
            var datePart = parts[0] || '';
            var timePart = (parts[1] || '').split('.')[0] || '';
            return datePart + ' ' + timePart;
        } catch (e) {
            return iso;
        }
    };

    U.copyCode = function copyCode(text) {
        if (!text) return;
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(function () {
                U.copyFallback(text);
            });
        } else {
            U.copyFallback(text);
        }
    };

    U.copyFallback = function copyFallback(t) {
        var ta = document.createElement('textarea');
        ta.value = t;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
        } catch (e) {}
        document.body.removeChild(ta);
    };

    U.formatLocalDateTimeForExport = function formatLocalDateTimeForExport(d) {
        if (!d) return '';
        var Y = d.getFullYear();
        var M = String(d.getMonth() + 1).padStart(2, '0');
        var D = String(d.getDate()).padStart(2, '0');
        var h = String(d.getHours()).padStart(2, '0');
        var m = String(d.getMinutes()).padStart(2, '0');
        return Y + M + D + '_' + h + m;
    };

    U.downloadActivationCodesTxt = function downloadActivationCodesTxt(codes, meta) {
        if (!Array.isArray(codes) || !codes.length) return;
        var lines = codes.map(function (c) {
            return String(c.code || c).trim();
        }).filter(Boolean);
        if (!lines.length) return;
        var blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        var ts = U.formatLocalDateTimeForExport(new Date());
        var label = meta && meta.label ? String(meta.label).replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '') : 'codes';
        a.download = label + '_' + ts + '.txt';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 1000);
    };

    U.fillBatchChannelSelects = function fillBatchChannelSelects(channels, preferredLabel) {
        if (!Array.isArray(channels)) return;
        var ids = ['batchIssueChannel'];
        ids.forEach(function (id) {
            var sel = document.getElementById(id);
            if (!sel) return;
            var cur = sel.value;
            sel.innerHTML = '';
            var hasPref = false;
            channels.forEach(function (ch) {
                if (!ch || !ch.label) return;
                var lab = ch.label;
                var opt = document.createElement('option');
                opt.value = lab;
                opt.textContent = lab;
                sel.appendChild(opt);
                if (lab === preferredLabel) hasPref = true;
            });
            if (hasPref) sel.value = preferredLabel;
            else if (cur && sel.querySelector('option[value="' + cur.replace(/"/g, '') + '"]')) sel.value = cur;
        });
    };

    U.isBuiltinBatchChannelLabel = function isBuiltinBatchChannelLabel(label) {
        var builtin = ['闲鱼', '酷发卡', '支付宝', 'xianyu', 'kufaka', 'alipay'];
        return builtin.indexOf(label) !== -1;
    };

    U.getSelectedBatchChannelLabel = function getSelectedBatchChannelLabel() {
        var sel = document.getElementById('batchIssueChannel');
        return sel ? sel.value : '';
    };

    U.updateBatchChannelRemoveButton = function updateBatchChannelRemoveButton() {
        var btn = document.getElementById('btnRemoveBatchChannel');
        if (!btn) return;
        var label = U.getSelectedBatchChannelLabel();
        btn.style.display = U.isBuiltinBatchChannelLabel(label) ? 'none' : '';
    };

    U.loadActivationBatchChannels = function loadActivationBatchChannels() {
        return fetch('/api/admin/settings/batch-channels', { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (body) {
                var channels = body && body.code === 200 && Array.isArray(body.data) ? body.data : [];
                U.fillBatchChannelSelects(channels);
                return channels;
            })
            .catch(function () { return []; });
    };

    U.parseAgentChannelIds = function parseAgentChannelIds(raw) {
        return String(raw || '')
            .split('\n')
            .map(function (s) { return s.trim(); })
            .filter(Boolean);
    };

    U.buildAgentPromoLink = function buildAgentPromoLink(origin, page, channelId) {
        return origin + '/' + page + '.html' + (channelId ? '?ch=' + encodeURIComponent(channelId) : '');
    };

    U.renderAgentPromoLinks = function renderAgentPromoLinks(channelIds) {
        var mount = document.getElementById('agentPromoLinksMount');
        if (!mount) return;
        if (!Array.isArray(channelIds) || !channelIds.length) {
            mount.style.display = 'none';
            return;
        }
        var origin = location.origin || (location.protocol + '//' + location.host);
        var pages = ['install_guide', 'register'];
        var html = '<table class="agent-links-table"><thead><tr><th>渠道 ID</th>';
        pages.forEach(function (p) {
            html += '<th>' + (p === 'install_guide' ? '安装页' : '注册页') + '</th>';
        });
        html += '</tr></thead><tbody>';
        channelIds.forEach(function (id) {
            html += '<tr><td><strong>' + U.esc(id) + '</strong></td>';
            pages.forEach(function (p) {
                var link = U.buildAgentPromoLink(origin, p, id);
                html += '<td><code class="agent-link-code">' + U.esc(link) + '</code>';
                html += '<button type="button" class="btn-page btn-sm ml-6 btn-copy-agent-link" data-link="' + U.esc(link) + '">复制</button></td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        mount.innerHTML = html;
        mount.style.display = '';
        mount.querySelectorAll('.btn-copy-agent-link').forEach(function (btn) {
            btn.addEventListener('click', function () {
                U.copyCode(btn.getAttribute('data-link') || '');
            });
        });
        var copyAll = document.getElementById('btnCopyAllAgentPromoLinks');
        if (copyAll) {
            copyAll.style.display = channelIds.length > 1 ? '' : 'none';
            copyAll.onclick = function () {
                var all = channelIds.map(function (id) {
                    return pages.map(function (p) { return U.buildAgentPromoLink(origin, p, id); }).join('\n');
                }).join('\n');
                U.copyCode(all);
            };
        }
    };

    U.bindAgentPromoLinksUi = function bindAgentPromoLinksUi() {
        var btnGen = document.getElementById('btnGenerateAgentPromoLinks');
        if (!btnGen || btnGen._bound) return;
        btnGen._bound = true;
        btnGen.addEventListener('click', function () {
            var ta = document.getElementById('xianyuHideSalesChannels');
            var ids = U.parseAgentChannelIds(ta ? ta.value : '');
            U.renderAgentPromoLinks(ids);
        });
    };

    U.keyForUser = function keyForUser(username) {
        return 'user-' + String(username || '').replace(/[^a-zA-Z0-9_\-.@]/g, '_');
    };

    U.formatMoneyLike = function formatMoneyLike(v) {
        if (v == null || v === '') return v;
        var n = Number(v);
        if (isNaN(n)) return v;
        return n.toFixed(2);
    };

    U.htmlFileFromPagePath = function htmlFileFromPagePath(pagePath) {
        return String(pagePath || 'mine').replace(/\.html$/, '') + '.html';
    };

    U.chineseTitleFromPagePath = function chineseTitleFromPagePath(pagePath) {
        var map = {
            'mine': '我的', 'purchase': '购买激活', 'consult': '咨询', 'income': '收入明细',
            'shenbao': '申报记录', 'tax': '税务记录', 'chat': '在线客服', 'login': '登录',
            'register': '注册', 'install_guide': '安装引导', 'tutorial_video': '操作教程'
        };
        return map[pagePath] || pagePath;
    };

    U.formatPageRouteKey = function formatPageRouteKey(routeKey) {
        return String(routeKey || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    };

    U.pageNameFromTrackKey = function pageNameFromTrackKey(pageKey) {
        var map = {
            'mine': '我的', 'purchase': '购买激活', 'consult': '咨询',
            'income': '收入明细', 'shenbao': '申报记录', 'tax': '税务记录',
            'feedback': '反馈', 'chat': '聊天', 'install_guide': '安装引导',
            'tutorial_video': '操作教程', 'login': '登录', 'register': '注册',
            'help': '帮助'
        };
        return map[pageKey] || pageKey;
    };

    U.parseTrackEventMeta = function parseTrackEventMeta(eventKey) {
        var meta = { button: eventKey, page: '' };
        if (!eventKey) return meta;
        if (eventKey.indexOf('track_') === 0) {
            var rest = eventKey.substring(6);
            var parts = rest.split('_');
            if (parts[0] === 'purchase' || parts[0] === 'xianyu' || parts[0] === 'qq' || parts[0] === 'kufaka') {
                meta.page = '购买页';
                meta.button = parts.slice(1).join('_');
            } else if (parts[0] === 'mine') {
                meta.page = '我的';
                meta.button = parts.slice(1).join('_');
            } else if (parts[0] === 'feedback') {
                meta.page = '反馈';
                meta.button = parts.slice(1).join('_');
            } else if (parts[0] === 'chat') {
                meta.page = '聊天';
                meta.button = parts.slice(1).join('_');
            } else if (parts[0] === 'consult') {
                meta.page = '咨询';
                meta.button = parts.slice(1).join('_');
            } else if (parts[0] === 'install') {
                meta.page = '安装引导';
                meta.button = parts.slice(1).join('_');
            } else if (parts[0] === 'register') {
                meta.page = '注册';
                meta.button = parts.slice(1).join('_');
            } else if (parts[0] === 'login') {
                meta.page = '登录';
                meta.button = parts.slice(1).join('_');
            } else if (parts[0] === 'activate' || parts[0] === 'pricing') {
                meta.page = '购买页';
                meta.button = rest;
            } else if (parts[0] === 'alipay') {
                meta.page = '支付宝';
                meta.button = rest;
            } else {
                meta.button = rest;
            }
        }
        return meta;
    };

    U.computeClientTaxAvgSalary6mLabel = function computeClientTaxAvgSalary6mLabel(records) {
        if (!Array.isArray(records) || !records.length) return '';
        var salaries = [];
        records.forEach(function (r) {
            var v = r && (r.salary || r.income);
            if (v != null) {
                var n = Number(v);
                if (!isNaN(n)) salaries.push(n);
            }
        });
        if (!salaries.length) return '';
        var sum = salaries.reduce(function (a, b) { return a + b; }, 0);
        var avg = sum / salaries.length;
        return '近半年月均 ' + avg.toFixed(0) + ' 元';
    };

    U.formatTaxChangeVal = function formatTaxChangeVal(v) {
        if (v == null) return '';
        var n = Number(v);
        return isNaN(n) ? String(v) : (n >= 0 ? '+' : '') + n.toFixed(2);
    };

    U.normalizeAdminTaxRecordRow = function normalizeAdminTaxRecordRow(r) {
        return {
            year: r && r.year ? String(r.year) : '',
            month: r && r.month ? String(r.month) : '',
            company_display: r && r.company_display ? String(r.company_display) : ''
        };
    };

    U.renderAdminTaxRecordCell = function renderAdminTaxRecordCell(r, col) {
        if (!r) return '<td></td>';
        var v = '';
        if (col === 'year') v = r.year || '';
        else if (col === 'month') v = r.month || '';
        else if (col === 'company') v = r.company_display || '';
        else v = '';
        return '<td>' + U.esc(v) + '</td>';
    };

    U.renderAdminTaxRecordsTable = function renderAdminTaxRecordsTable(records) {
        if (!Array.isArray(records) || !records.length) return '<p class="hint">暂无数据</p>';
        var html = '<table class="stat-table"><thead><tr><th>年份</th><th>月份</th><th>单位</th></tr></thead><tbody>';
        records.forEach(function (r) {
            html += '<tr>';
            html += U.renderAdminTaxRecordCell(r, 'year');
            html += U.renderAdminTaxRecordCell(r, 'month');
            html += U.renderAdminTaxRecordCell(r, 'company');
            html += '</tr>';
        });
        html += '</tbody></table>';
        return html;
    };

    U.adminHasMenu = function adminHasMenu(menuKey) {
        var tree = global.AdminNav ? AdminNav.getMenuTree() : [];
        if (!Array.isArray(tree)) return false;
        return tree.some(function (g) {
            return Array.isArray(g.items) && g.items.some(function (it) { return it.page === menuKey; });
        });
    };

    U.firstAllowedAdminPage = function firstAllowedAdminPage() {
        var tree = global.AdminNav ? AdminNav.getMenuTree() : [];
        if (!Array.isArray(tree)) return '';
        for (var i = 0; i < tree.length; i++) {
            var g = tree[i];
            if (Array.isArray(g.items) && g.items.length) {
                for (var j = 0; j < g.items.length; j++) {
                    if (g.items[j].page) return g.items[j].page;
                }
            }
        }
        return 'settings';
    };

    U.normalizeAdminPage = function normalizeAdminPage(raw) {
        if (!raw || raw === '#' || raw === '' || raw === 'null' || raw === 'undefined') return '';
        var page = String(raw).replace(/^#/, '').trim();
        var alias = {
            'analytics': 'analytics-conversion',
            'conversion': 'analytics-conversion',
            'register-analytics': 'analytics-register',
            'purchase-analytics': 'analytics-purchase',
            'activity-analytics': 'analytics-activity',
            'tracking': 'analytics-tracking',
            'devices': 'analytics-devices',
            'channel': 'channel-analysis',
            'api': 'api-analytics',
            'login': 'login-log',
            'user-login': 'user-login-log',
            'monitor': 'server-monitor'
        };
        return alias[page] || page;
    };

    U.menuLabel = function menuLabel(key) {
        var map = {
            'settings': '定价与弹窗', 'install-guide': '安装分发',
            'appearance': '外观', 'codes': '激活码',
            'admin-accounts': '账号权限', 'users': '注册用户',
            'guest-users': '游客', 'users-deleted': '已删除',
            'user-data': '用户数据', 'tax-records-edit': '个税维护', 'user-behavior': '用户行为',
            'activated-user-analysis': '激活分析', 'feedback': '反馈',
            'chat': '客服', 'login-log': '管理登录', 'user-login-log': '用户登录',
            'server-monitor': '监控', 'sbdy-demo': '社保演示',
            'analytics-conversion': '转化与触达', 'analytics-purchase': '支付页埋点',
            'analytics-register': '注册分析', 'analytics-activity': '用户活跃',
            'analytics-tracking': '埋点分析', 'analytics-devices': '设备',
            'channel-analysis': '渠道分析', 'api-analytics': '接口',
            'install-guide-stats': '安装统计', 'share-stats': '分享统计',
            'blocked-ips': 'IP 黑名单'
        };
        return map[key] || key;
    };

    global.AdminUtils = U;
})(window);
