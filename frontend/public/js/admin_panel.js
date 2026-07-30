        /* ========== Admin Panel — Utility Functions ========== */
        function esc(s) {
            return String(s == null ? '' : s)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        /* ========== Chart Delegate Stubs ========== */
        function analyticsPeriodVal(el) {
            if (window.AdminAnalyticsPeriod) {
                return AdminAnalyticsPeriod.getValue(el);
            }
            return el ? String(el.value || '1') : '1';
        }

        /** 设备统计图标（与接口 icon_key 对应，含机型品牌分析） */
        /* charts: /js/admin/modules/charts.js (lazy) — 挂 window 供懒加载覆盖 */
        var _deviceStatsChartInstances = [];
        var _registerTimeChartInstances = [];
        var _registerGenderChartInstances = [];
        var _installGuideChartInstances = [];
        var _guestUsersChartInstances = [];
        window.destroyDeviceStatsCharts = function () {};
        window.destroyRegisterTimeCharts = function () {};
        window.destroyRegisterGenderCharts = function () {};
        window.destroyInstallGuideCharts = function () {};
        window.destroyGuestUsersCharts = function () {};
        window.destroyChannelAnalysisCharts = function () {};
        window.loadChannelAnalysis = function () {};
        window.loadAnalyticsRegisterGender = function () {};
        window.loadAnalyticsRegisterPlatform = function () {};
        window.loadAnalyticsRegisterTime = function () {};
        window.renderDeviceStatsCharts = function () {};
        window.renderRegisterGenderAnalysis = function () {};
        window.renderChannelAnalysis = function () {};
        window.renderRegisterTimeAnalysis = function () {};
        window.renderRegisterPlatformAnalysis = function () {};
        window.statIconHtml = function () {
            return '';
        };
        window.deviceStatRowHtml = function () {
            return '';
        };
        function destroyDeviceStatsCharts() {
            return window.destroyDeviceStatsCharts.apply(this, arguments);
        }
        function destroyRegisterTimeCharts() {
            return window.destroyRegisterTimeCharts.apply(this, arguments);
        }
        function destroyRegisterGenderCharts() {
            return window.destroyRegisterGenderCharts.apply(this, arguments);
        }
        function destroyInstallGuideCharts() {
            return window.destroyInstallGuideCharts.apply(this, arguments);
        }
        function destroyGuestUsersCharts() {
            return window.destroyGuestUsersCharts.apply(this, arguments);
        }
        function destroyChannelAnalysisCharts() {
            return window.destroyChannelAnalysisCharts.apply(this, arguments);
        }
        function loadChannelAnalysis() {
            return window.loadChannelAnalysis.apply(this, arguments);
        }
        function loadAnalyticsRegisterGender() {
            return window.loadAnalyticsRegisterGender.apply(this, arguments);
        }
        function loadAnalyticsRegisterPlatform() {
            return window.loadAnalyticsRegisterPlatform.apply(this, arguments);
        }
        function loadAnalyticsRegisterTime() {
            return window.loadAnalyticsRegisterTime.apply(this, arguments);
        }
        function renderDeviceStatsCharts() {
            return window.renderDeviceStatsCharts.apply(this, arguments);
        }
        function renderRegisterGenderAnalysis() {
            return window.renderRegisterGenderAnalysis.apply(this, arguments);
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
        function statIconHtml() {
            return window.statIconHtml.apply(this, arguments);
        }
        function deviceStatRowHtml() {
            return window.deviceStatRowHtml.apply(this, arguments);
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

        /** 渠道分析页：预设注册来源链接（?src=），与代理 ?ch= 分离 */
        var CHANNEL_SOURCE_LINK_ITEMS = [
            { key: 'douyin', label: '抖音' },
            { key: 'bilibili', label: 'B站' },
            { key: 'tieba', label: '贴吧' },
            { key: 'zhihu', label: '知乎' },
            { key: 'friend', label: '朋友介绍' },
            { key: 'github', label: 'GitHub' }
        ];

        function renderChannelSourceLinks() {
            var tbody = document.getElementById('channelLinksTbody');
            if (!tbody) return;
            var origin = (window.location && window.location.origin) || '';
            var rows = CHANNEL_SOURCE_LINK_ITEMS.map(function (item) {
                var url = origin + '/register.html?src=' + encodeURIComponent(item.key);
                return (
                    '<tr>' +
                    '<td>' +
                    esc(item.label) +
                    '</td>' +
                    '<td><code class="channel-source-link-url">' +
                    esc(url) +
                    '</code></td>' +
                    '<td><button type="button" class="btn-secondary btn-sm btn-copy-channel-src" data-copy="' +
                    esc(url) +
                    '">复制</button></td>' +
                    '</tr>'
                );
            });
            tbody.innerHTML = rows.join('');
            if (tbody.getAttribute('data-copy-bound') !== '1') {
                tbody.setAttribute('data-copy-bound', '1');
                tbody.addEventListener('click', function (e) {
                    var btn = e.target.closest('.btn-copy-channel-src');
                    if (!btn) return;
                    copyCode(btn.getAttribute('data-copy') || '');
                });
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
            var channelLabel = meta.channel_label || meta.channel || '渠道';
            var note = meta.note || channelLabel + '批量';
            var lines = [
                '# ' + channelLabel + '激活码批量导出',
                '# 渠道：' + channelLabel,
                '# 备注：' + note,
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
            var safeName = String(channelLabel)
                .replace(/[\\/:*?"<>|\s]+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            if (!safeName) safeName = 'batch';
            a.download =
                meta.filename ||
                safeName +
                    '-activation-codes-' +
                    formatLocalDateTimeForExport(new Date()).replace(/[:\s]/g, '-') +
                    '.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
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
            ['batchIssueChannel', 'xianyuCodeChannelFilter'].forEach(function (id) {
                var sel = document.getElementById(id);
                if (!sel) return;
                var prev = prefer || String(sel.value || '').trim();
                var keepAll = id === 'xianyuCodeChannelFilter';
                /* 渠道批量码列表默认支付宝；发放下拉仍用首项或原值 */
                if (!prev && keepAll) {
                    prev = XIANYU_CODE_DEFAULT_CHANNEL;
                }
                sel.innerHTML = '';
                if (keepAll) {
                    var optAll = document.createElement('option');
                    optAll.value = '';
                    optAll.textContent = '全部渠道';
                    sel.appendChild(optAll);
                }
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
                    if (!found && keepAll && prev === XIANYU_CODE_DEFAULT_CHANNEL) {
                        sel.value = '';
                    } else if (!found && !keepAll) {
                        var optExtra = document.createElement('option');
                        optExtra.value = prev;
                        optExtra.textContent = prev;
                        sel.appendChild(optExtra);
                        sel.value = prev;
                    }
                } else if (!keepAll && sel.options.length) {
                    sel.selectedIndex = 0;
                }
            });
            updateBatchChannelRemoveButton();
        }

        function isBuiltinBatchChannelLabel(label) {
            var lab = String(label || '').trim();
            if (!lab) return false;
            var list = _activationBatchChannelsCache || [];
            for (var i = 0; i < list.length; i++) {
                var ch = list[i];
                if (!ch || !ch.builtin) continue;
                if (String(ch.label || '').trim() === lab || String(ch.key || '').trim() === lab) {
                    return true;
                }
            }
            return lab === '闲鱼' || lab === '酷发卡' || lab === '支付宝' || lab === 'xianyu' || lab === 'kufaka' || lab === 'alipay';
        }

        function updateBatchChannelRemoveButton() {
            var btn = document.getElementById('btnRemoveBatchChannel');
            if (!btn) return;
            var label = getSelectedBatchChannelLabel();
            var builtin = !label || isBuiltinBatchChannelLabel(label);
            btn.disabled = builtin;
            btn.title = builtin
                ? '内置渠道（闲鱼 / 酷发卡）不可删除'
                : '删除当前选中的自定义渠道「' + label + '」';
        }

        function getSelectedBatchChannelLabel() {
            var sel = document.getElementById('batchIssueChannel');
            return sel ? String(sel.value || '').trim() : '';
        }

        function loadActivationBatchChannels() {
            if (!(currentAdminProfile && currentAdminProfile.is_super)) {
                fillBatchChannelSelects(_activationBatchChannelsCache);
                return;
            }
            adminFetch('api/admin/activation-batch-channels')
                .then(function (r) {
                    return r.json();
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
                    var fromText = parseAgentChannelIds(raw ? raw.value : '');
                    var fromExclusive = (_agentExclusiveChannelsCache || [])
                        .filter(function (r) {
                            return r && r.enabled !== false;
                        })
                        .map(function (r) {
                            return String(r.channel_id || '');
                        })
                        .filter(Boolean);
                    var merged = fromText.slice();
                    fromExclusive.forEach(function (ch) {
                        if (merged.indexOf(ch) < 0) merged.push(ch);
                    });
                    renderAgentPromoLinks(merged);
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

        var _agentExclusiveChannelsCache = [];
        var _agentExAdminOptionsLoaded = false;

        function loadAgentExclusiveOwnerOptions() {
            var sel = document.getElementById('agentExOwnerAdmin');
            if (!sel) return Promise.resolve();
            if (_agentExAdminOptionsLoaded && sel.options.length > 1) {
                return Promise.resolve();
            }
            return adminFetch('api/admin/accounts')
                .then(function (r) {
                    return r.json();
                })
                .then(function (data) {
                    var list = (data && data.data && data.data.accounts) || data.data || [];
                    if (!Array.isArray(list)) list = [];
                    var html = '<option value="">可留空（平台自有）</option>';
                    list.forEach(function (a) {
                        if (!a || a.is_super || a.banned) return;
                        var u = String(a.username || '').trim();
                        if (!u) return;
                        var name = a.full_name ? String(a.full_name) : '';
                        html +=
                            '<option value="' +
                            esc(u) +
                            '">' +
                            esc(u) +
                            (name ? '（' + esc(name) + '）' : '') +
                            '</option>';
                    });
                    sel.innerHTML = html;
                    _agentExAdminOptionsLoaded = true;
                })
                .catch(function () {
                    sel.innerHTML = '<option value="">无法加载代理账号（需超管权限）</option>';
                });
        }

        function renderAgentExclusiveChannelsList(list) {
            var mount = document.getElementById('agentExclusiveChannelsList');
            if (!mount) return;
            _agentExclusiveChannelsCache = Array.isArray(list) ? list : [];
            if (!_agentExclusiveChannelsCache.length) {
                mount.innerHTML = '<p class="hint mt-0">暂无专属渠道。保存后，用户经 <code>?ch=渠道ID</code> 注册/登录会挂到对应代理名下。</p>';
                return;
            }
            var origin = window.location.origin || '';
            var html =
                '<table class="data-table" style="width:100%;font-size:13px;"><thead><tr>' +
                '<th>渠道 ID</th><th>下属代理</th><th>支付</th><th>仅激活码</th><th>状态</th><th>备注</th><th>推广链接</th><th></th>' +
                '</tr></thead><tbody>';
            _agentExclusiveChannelsCache.forEach(function (row) {
                var ch = String(row.channel_id || '');
                var link = buildAgentPromoLink(origin, 'install_guide.html', ch);
                var codeOnly = !!(row.hide_self_serve_pay || row.code_only);
                html +=
                    '<tr>' +
                    '<td><code>' +
                    esc(ch) +
                    '</code></td>' +
                    '<td>' +
                    esc(row.owner_admin_username || '—') +
                    '</td>' +
                    '<td>' +
                    esc(String(row.default_pricing_abc || 'a').toUpperCase()) +
                    '</td>' +
                    '<td>' +
                    (codeOnly ? '是' : '否') +
                    '</td>' +
                    '<td>' +
                    (row.enabled ? '启用' : '停用') +
                    '</td>' +
                    '<td>' +
                    esc(row.note || '') +
                    '</td>' +
                    '<td><button type="button" class="btn-sm btn-copy-agent-promo" data-copy="' +
                    esc(link) +
                    '">复制安装页</button></td>' +
                    '<td><button type="button" class="btn-sm btn-danger btn-del-agent-ex-ch" data-ch="' +
                    esc(ch) +
                    '">删除</button></td>' +
                    '</tr>';
            });
            html += '</tbody></table>';
            mount.innerHTML = html;
        }

        function loadAgentExclusiveChannels() {
            return adminFetch('api/admin/agent-channels')
                .then(function (r) {
                    return r.json();
                })
                .then(function (data) {
                    if (data && data.code === 200 && data.data) {
                        renderAgentExclusiveChannelsList(data.data.channels || []);
                        var hideEl = document.getElementById('xianyuHideSalesChannels');
                        if (hideEl && _agentExclusiveChannelsCache.length) {
                            var existing = parseAgentChannelIds(hideEl.value);
                            var changed = false;
                            _agentExclusiveChannelsCache.forEach(function (row) {
                                if (!row || !row.enabled) return;
                                var ch = String(row.channel_id || '');
                                if (ch && existing.indexOf(ch) < 0) {
                                    existing.push(ch);
                                    changed = true;
                                }
                            });
                            if (changed) {
                                hideEl.value = existing.join('\n');
                            }
                        }
                    }
                })
                .catch(function () {});
        }

        function bindAgentExclusiveChannelsUi() {
            var saveBtn = document.getElementById('btnSaveAgentExclusiveChannel');
            var listMount = document.getElementById('agentExclusiveChannelsList');
            if (saveBtn && saveBtn.getAttribute('data-bound') !== '1') {
                saveBtn.setAttribute('data-bound', '1');
                saveBtn.addEventListener('click', function () {
                    var channelId = (document.getElementById('agentExChannelId') || {}).value || '';
                    var owner = (document.getElementById('agentExOwnerAdmin') || {}).value || '';
                    var abc = String((document.getElementById('agentExPricingAbc') || {}).value || 'b')
                        .trim()
                        .toLowerCase();
                    if (abc !== 'a' && abc !== 'b') abc = 'b';
                    var note = (document.getElementById('agentExNote') || {}).value || '';
                    var enabled = !!(document.getElementById('agentExEnabled') || {}).checked;
                    var hidePayEl = document.getElementById('agentExHideSelfServePay');
                    var hideSelfServePay = hidePayEl ? !!hidePayEl.checked : false;
                    channelId = String(channelId).trim().toLowerCase();
                    if (!/^[a-z0-9_-]{1,64}$/.test(channelId)) {
                        alert('渠道 ID 无效（字母数字下划线连字符）');
                        return;
                    }
                    saveBtn.disabled = true;
                    adminFetch('api/admin/agent-channels', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            channel_id: channelId,
                            owner_admin_username: String(owner).trim(),
                            default_pricing_abc: abc,
                            hide_self_serve_pay: hideSelfServePay,
                            code_only: hideSelfServePay,
                            enabled: enabled,
                            note: note
                        })
                    })
                        .then(function (r) {
                            return r.json();
                        })
                        .then(function (data) {
                            saveBtn.disabled = false;
                            if (!data || data.code !== 200) {
                                alert((data && data.msg) || '保存失败');
                                return;
                            }
                            var idEl = document.getElementById('agentExChannelId');
                            if (idEl) idEl.value = '';
                            var noteEl = document.getElementById('agentExNote');
                            if (noteEl) noteEl.value = '';
                            loadAgentExclusiveChannels();
                            alert('专属渠道已保存');
                        })
                        .catch(function () {
                            saveBtn.disabled = false;
                            alert('保存失败');
                        });
                });
            }
            if (listMount && listMount.getAttribute('data-bound') !== '1') {
                listMount.setAttribute('data-bound', '1');
                listMount.addEventListener('click', function (e) {
                    var copyBtn = e.target.closest('.btn-copy-agent-promo');
                    if (copyBtn) {
                        copyCode(copyBtn.getAttribute('data-copy') || '');
                        return;
                    }
                    var delBtn = e.target.closest('.btn-del-agent-ex-ch');
                    if (!delBtn) return;
                    var ch = delBtn.getAttribute('data-ch') || '';
                    if (!ch || !confirm('确定删除专属渠道「' + ch + '」？已归属用户不会自动解除。')) return;
                    adminFetch('api/admin/agent-channels/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ channel_id: ch })
                    })
                        .then(function (r) {
                            return r.json();
                        })
                        .then(function (data) {
                            if (!data || data.code !== 200) {
                                alert((data && data.msg) || '删除失败');
                                return;
                            }
                            loadAgentExclusiveChannels();
                        })
                        .catch(function () {
                            alert('删除失败');
                        });
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
                return { button: '确认激活', page: '购买页/激活弹窗' };
            }
            if (k === 'track_activate_prompt_cancel') {
                return { button: '激活弹窗-取消', page: '我的/我要咨询（弹窗）' };
            }
            if (k === 'track_xianyu_purchase_click') {
                return { button: '闲鱼购买', page: '购买页/激活弹窗' };
            }
            if (k === 'track_kufaka_purchase_click') {
                return { button: '酷发卡购买', page: '购买页（purchase.html）' };
            }
            if (k === 'track_online_chat_click') {
                return { button: '在线客服', page: '购买页/其它入口' };
            }
            if (k === 'track_qq_add_click' || k === 'track_consult_qq_add_click') {
                return { button: '添加QQ号', page: '购买页/我要咨询等' };
            }
            if (k === 'track_qq_group_click') {
                return { button: '加入QQ群', page: '购买页/激活成功/帮助页等' };
            }
            if (k === 'track_alipay_payment_start') {
                return { button: '生成支付宝付款码', page: '购买页 · 支付宝购买' };
            }
            if (k === 'track_alipay_open_click') {
                return { button: '打开支付宝付款', page: '购买页 · 支付宝购买' };
            }
            if (k === 'track_alipay_payment_success') {
                return { button: '支付宝付款开通成功', page: '购买页 · 支付宝购买' };
            }
            if (k === 'track_purchase_page_view') {
                return { button: '购买页浏览', page: '购买页（purchase.html）' };
            }
            if (k === 'track_purchase_wechat_view') {
                return { button: '微信购买入口展示', page: '购买页 · 其他购买方式' };
            }
            if (k === 'track_purchase_wechat_expand') {
                return { button: '展开微信收款码', page: '购买页 · 其他购买方式' };
            }
            if (k === 'track_purchase_activate_success') {
                return { button: '激活码开通成功', page: '购买页 · 已有激活码' };
            }
            if (k === 'track_purchase_activate_fail') {
                return { button: '激活码开通失败', page: '购买页 · 已有激活码' };
            }
            if (k === 'track_purchase_back_click') {
                return { button: '购买页返回', page: '购买页（purchase.html）' };
            }
            return { button: '其他埋点', page: '—' };
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
        var codeLimit = 8;
        var xianyuCodePage = 1;
        var xianyuCodeLimit = 8;
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
        var _adminGuestUsersLoaded = false;
        var guestUsersPage = 1;
        var guestUsersLimit = 20;
        var _adminUserDataLoaded = false;
        var _adminActivatedUserAnalysisLoaded = false;
        var userDataPage = 1;
        var userDataLimit = 15;
        var _adminCodesLoaded = false;
        var _adminAnalyticsRegisterSeen = false;
        var _adminAnalyticsPurchaseSeen = false;
        var _adminAnalyticsTrackingSeen = false;
        var _adminAnalyticsActivitySeen = false;
        var _adminInstallGuideStatsSeen = false;
        var _adminShareStatsSeen = false;
        var _adminTaxRecordsEditSeen = false;
        var _adminChannelAnalysisSeen = false;
        var _adminServerMonitorSeen = false;
        var _adminBlockedIpsSeen = false;
        var _channelAnalysisChartInstances = [];

        function adminHasMenu(menuKey) {
            if (!menuKey) return false;
            if (menuKey === 'user-login-log') menuKey = 'login-log';
            if (menuKey === 'users-deleted') menuKey = 'users';
            if (currentAdminProfile && currentAdminProfile.is_super) return true;
            var menus = currentAdminProfile && Array.isArray(currentAdminProfile.menus) ? currentAdminProfile.menus : [];
            if (menus.indexOf(menuKey) >= 0) return true;
            if (menuKey.indexOf('analytics-') === 0 && menus.indexOf('analytics') >= 0) return true;
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
                'analytics-conversion',
                'analytics-purchase',
                'settings',
                'codes',
                'channel-analysis',
                'install-guide',
                'install-guide-stats',
                'share-stats',
                'users',
                'guest-users',
                'users-deleted',
                'user-data',
                'tax-records-edit',
                'activated-user-analysis',
                'analytics-register',
                'analytics-activity',
                'analytics-tracking',
                'appearance',
                'admin-accounts',
                'login-log',
                'user-login-log',
                'server-monitor'
            ];
            for (var i = 0; i < order.length; i++) {
                if (order[i] === 'guest-users' && !(currentAdminProfile && currentAdminProfile.is_super)) continue;
                if (adminHasMenu(order[i])) return order[i];
            }
            return 'analytics-conversion';
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
            var navEl = document.getElementById('adminSidebarNav');
            var tree = window.AdminNav && AdminNav.getMenuTree ? AdminNav.getMenuTree() : [];
            var active = String(location.hash || '').replace(/^#/, '') || firstAllowedAdminPage();
            if (navEl && window.AdminNav && tree.length) {
                AdminNav.renderSidebar(navEl, tree, active);
                AdminNav.bindNavClicks(navEl);
                initNavGroupCollapse();
            } else {
            document.querySelectorAll('.nav-item').forEach(function (btn) {
                var key = btn.getAttribute('data-page');
                var on = adminHasMenu(key);
                if (key === 'guest-users') {
                    on = on && currentAdminProfile && currentAdminProfile.is_super;
                }
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
            var batchWrap = document.getElementById('batchIssueWrap');
            if (batchWrap) {
                var showBatch = !!(currentAdminProfile && currentAdminProfile.is_super);
                batchWrap.classList.toggle('is-hidden', !showBatch);
                batchWrap.style.display = '';
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
                        '每个激活码仅可成功激活 1 个账号，用过后即失效，<strong>永不过期</strong>。批量生成可选择渠道（闲鱼 / 酷发卡，也可手动添加），自定义数量后一次性写入并<strong>自动下载 TXT</strong>（每行一个激活码，备注为「渠道名+批量」）。下方<strong>渠道批量激活码</strong>可按渠道筛选；用户用渠道码激活后，在「注册用户 / 用户数据」中可查看<strong>渠道分析</strong>（注册来源 + 激活来源）。';
                    loadActivationBatchChannels();
                } else {
                    codesHint.style.display = 'none';
                    codesHint.textContent = '';
                }
            }
            var codeListStat = document.getElementById('codeListStat');
            if (codeListStat) {
                codeListStat.style.display =
                    currentAdminProfile && currentAdminProfile.is_super ? '' : 'none';
                if (!(currentAdminProfile && currentAdminProfile.is_super)) {
                    codeListStat.textContent = '';
                }
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
                'guest-users': 1,
                'users-deleted': 1,
                'user-data': 1,
                'tax-records-edit': 1,
                'activated-user-analysis': 1,
                'analytics-conversion': 1,
                'analytics-register': 1,
                'analytics-activity': 1,
                                'analytics-purchase': 1,
                'analytics-tracking': 1,
                'install-guide-stats': 1,
                'share-stats': 1,
                'channel-analysis': 1,
                'login-log': 1,
                'user-login-log': 1,
                'server-monitor': 1,
                'sbdy-demo': 1,
                'blocked-ips': 1
            };
            if (!ok[k] || !adminHasMenu(k)) {
                return firstAllowedAdminPage();
            }
            return k;
        }

        function applyAdminRouteChrome(pageKey) {
            document.querySelectorAll('.page-panel').forEach(function (el) {
                var on = el.id === 'page-' + pageKey;
                el.classList.toggle('active', on);
                if (on) el.removeAttribute('hidden');
                else el.setAttribute('hidden', '');
            });
            document.querySelectorAll('.nav-item').forEach(function (btn) {
                btn.classList.toggle('active', btn.getAttribute('data-page') === pageKey);
            });
            var navBtn = document.querySelector('.nav-item[data-page="' + pageKey + '"]');
            var titleEl = document.getElementById('pageTitle');
            if (titleEl && navBtn) {
                titleEl.textContent = navBtn.getAttribute('data-title') || '管理控制台';
            } else if (titleEl) {
                titleEl.textContent = '管理控制台';
            }
        }

        function applyAdminRoute() {
            var pageKey = normalizeAdminPage(location.hash);
            // 先立刻切页，避免等 Chart/CDN 时界面仍停在上一页（如「增长与触达配置」）
            applyAdminRouteChrome(pageKey);
            function runRouteBody() {
            applyAdminRouteChrome(pageKey);
            if (pageKey === 'users' && !_adminUsersLoaded) {
                _adminUsersLoaded = true;
                loadUsers(1);
            }
            if (pageKey === 'users-deleted' && !_adminDeletedUsersLoaded) {
                _adminDeletedUsersLoaded = true;
                loadDeletedUsers(1);
            }
            if (pageKey === 'guest-users' && !_adminGuestUsersLoaded) {
                _adminGuestUsersLoaded = true;
                loadGuestUsers(1);
            }
            if (pageKey === 'user-data' && !_adminUserDataLoaded) {
                _adminUserDataLoaded = true;
                loadUserDataList(1);
            }
            if (pageKey === 'activated-user-analysis' && !_adminActivatedUserAnalysisLoaded) {
                _adminActivatedUserAnalysisLoaded = true;
                loadActivatedUserAnalysisOverview();
                loadActivatedUserAnalysisUsers(1);
            }
            if (pageKey === 'codes' && !_adminCodesLoaded) {
                _adminCodesLoaded = true;
                loadCodes(1);
                if (currentAdminProfile && currentAdminProfile.is_super) {
                    loadXianyuCodes(1);
                }
            }
            if (pageKey === 'admin-accounts' && !_adminAccountsLoaded) {
                _adminAccountsLoaded = true;
                loadAdminAccounts();
            }
            if (pageKey === 'analytics-conversion') {
                loadAnalyticsConversionPage();
            }
            if (pageKey === 'analytics-register' && !_adminAnalyticsRegisterSeen) {
                _adminAnalyticsRegisterSeen = true;
                loadAnalyticsRegisterPage();
            }
            if (pageKey === 'analytics-activity' && !_adminAnalyticsActivitySeen) {
                _adminAnalyticsActivitySeen = true;
                loadAnalyticsActivityPage();
            }
            if (pageKey === 'analytics-purchase') {
                loadAnalyticsPurchasePage();
            }
            if (pageKey === 'analytics-tracking' && !_adminAnalyticsTrackingSeen) {
                _adminAnalyticsTrackingSeen = true;
                loadAnalyticsTrackingPage();
            }
            if (pageKey === 'install-guide-stats' && !_adminInstallGuideStatsSeen) {
                _adminInstallGuideStatsSeen = true;
                loadInstallGuideStats();
            }
            if (pageKey === 'share-stats' && !_adminShareStatsSeen) {
                _adminShareStatsSeen = true;
                loadShareStats();
            }
            if (pageKey === 'tax-records-edit' && !_adminTaxRecordsEditSeen) {
                _adminTaxRecordsEditSeen = true;
                initTaxRecordsEditPage();
            }
            if (pageKey === 'channel-analysis' && !_adminChannelAnalysisSeen) {
                _adminChannelAnalysisSeen = true;
                renderChannelSourceLinks();
                loadChannelAnalysis();
            }
            if (pageKey === 'server-monitor' && !_adminServerMonitorSeen) {
                _adminServerMonitorSeen = true;
                loadServerMonitor();
            }
            if (pageKey === 'blocked-ips' && !_adminBlockedIpsSeen) {
                _adminBlockedIpsSeen = true;
                loadBlockedIps();
            }
            if (pageKey === 'sbdy-demo') {
                if (typeof loadSbdyDemoPage === 'function') {
                    loadSbdyDemoPage();
                } else if (
                    window.AdminModules &&
                    window.AdminModules['sbdy-demo'] &&
                    typeof window.AdminModules['sbdy-demo'].loadPage === 'function'
                ) {
                    window.AdminModules['sbdy-demo'].loadPage();
                }
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
            }
            function safeRunRouteBody() {
                try {
                    runRouteBody();
                } catch (err) {
                    console.error('applyAdminRoute', pageKey, err);
                }
            }
            if (window.AdminLoader && AdminLoader.ensureForPage) {
                AdminLoader.ensureForPage(pageKey).then(safeRunRouteBody).catch(function (e) {
                    console.error('AdminLoader', e);
                    safeRunRouteBody();
                });
            } else {
                safeRunRouteBody();
            }
        }


        /* ========== API Analytics ========== */

        var ACTIVATE_USERS_PAGE_LIMIT = 15;
        var ACTIVATE_EVENT_KEYS = [
            'track_purchase_page_view',
            'track_activate_prompt_open',
            'track_activate_prompt_cancel',
            'track_activate_prompt_confirm',
            'track_purchase_activate_success',
            'track_purchase_activate_fail',
            'track_alipay_payment_start',
            'track_alipay_open_click',
            'track_alipay_payment_success',
            'track_kufaka_purchase_click',
            'track_purchase_wechat_view',
            'track_purchase_wechat_expand',
            'track_xianyu_purchase_click',
            'track_online_chat_click',
            'track_qq_group_click',
            'track_qq_add_click',
            'track_purchase_back_click'
        ];
        var ACTIVATE_EVENT_SHORT_LABELS = {
            track_purchase_page_view: '页浏览',
            track_activate_prompt_open: '弹窗开',
            track_activate_prompt_cancel: '弹窗取消',
            track_activate_prompt_confirm: '确认激活',
            track_purchase_activate_success: '激活成功',
            track_purchase_activate_fail: '激活失败',
            track_alipay_payment_start: '生成码',
            track_alipay_open_click: '打开支付宝',
            track_alipay_payment_success: '支付宝成',
            track_kufaka_purchase_click: '酷发卡',
            track_purchase_wechat_view: '微信展示',
            track_purchase_wechat_expand: '展开微信',
            track_xianyu_purchase_click: '闲鱼',
            track_online_chat_click: '客服',
            track_qq_group_click: 'QQ群',
            track_qq_add_click: '加QQ',
            track_purchase_back_click: '返回'
        };
        var ACTIVATE_EVENTS_TABLE_COLSPAN = ACTIVATE_EVENT_KEYS.length + 4;

        function activateEventShortLabel(key) {
            return ACTIVATE_EVENT_SHORT_LABELS[key] || key;
        }

        function syncActivateEventsTableHead() {
            var theadRow = document.querySelector('#activateEventsDailyTbody')
                ? document.querySelector('#activateEventsDailyTbody').closest('table').querySelector('thead tr')
                : null;
            if (!theadRow) return;
            var html = '<th>日期</th>';
            ACTIVATE_EVENT_KEYS.forEach(function (k) {
                html += '<th>' + esc(activateEventShortLabel(k)) + '</th>';
            });
            html += '<th>合计</th><th>去重用户</th><th>操作</th>';
            theadRow.innerHTML = html;
        }

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
                html += '<th>账号</th>';
                ACTIVATE_EVENT_KEYS.forEach(function (k) {
                    html += '<th>' + esc(activateEventShortLabel(k)) + '</th>';
                });
                html += '<th>合计</th><th>最近点击</th>';
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
            if (Array.isArray(data.event_keys) && data.event_keys.length) {
                ACTIVATE_EVENT_KEYS = data.event_keys.slice();
                ACTIVATE_EVENTS_TABLE_COLSPAN = ACTIVATE_EVENT_KEYS.length + 4;
            }
            syncActivateEventsTableHead();
            var sh = '';
            summary.forEach(function (row) {
                var meta = parseTrackEventMeta(row.event_key || '');
                sh +=
                    '<tr><td>' +
                    esc(meta.button || row.label || '—') +
                    '<div class="hint mt-0 mb-0" style="font-size:11px;color:#94a3b8;">' +
                    esc(row.event_key || '') +
                    '</div></td><td>' +
                    esc(meta.page || '—') +
                    '</td><td><strong>' +
                    esc(String(row.total || 0)) +
                    '</strong></td></tr>';
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
                    ' 天有记录。下方按日明细可展开到账号级。';
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
                    '" class="activate-users-detail-row" style="display:none;"><td colspan="' +
                    ACTIVATE_EVENTS_TABLE_COLSPAN +
                    '"><div id="activate_users_box_' +
                    dk +
                    '" class="activate-users-box">点击「查看用户」加载列表…</div></td></tr>';
            });
            document.getElementById('activateEventsDailyTbody').innerHTML =
                dh || '<tr><td colspan="' + ACTIVATE_EVENTS_TABLE_COLSPAN + '">暂无数据</td></tr>';
        }

        /* ========== Analytics — Pricing A/B ========== */
        function loadAnalyticsConversionPage() {
            loadAnalyticsPricingAb();
            loadAnalyticsDailyConversion();
            loadRegistrationFunnel();
            loadConversionKpis();
            loadPendingActivate24h(1);
        }

        /* ========== Analytics — Register Stats ========== */
        function loadAnalyticsPricingAb() {
            var box = document.getElementById('analyticsPricingAb');
            if (!box) return;
            var days = analyticsPeriodVal(document.getElementById('analyticsPricingAbDays'));
            box.innerHTML = '加载中…';
            adminFetch('api/admin/analytics/pricing-ab?days=' + encodeURIComponent(days))
                .then(function (r) {
                    return r.json();
                })
                .then(function (body) {
                    if (!body || body.code !== 200 || !body.data) {
                        box.innerHTML = esc((body && body.msg) || '加载失败');
                        return;
                    }
                    var d = body.data;
                    var html = analyticsPeriodHintHtml(d);
                    html +=
                        '<p class="hint">实验' +
                        (d.pricing_ab && d.pricing_ab.enabled ? '进行中' : '已关闭') +
                        ' · A ' +
                        (d.pricing_ab && d.pricing_ab.a_percent != null
                            ? d.pricing_ab.a_percent
                            : Math.max(
                                  0,
                                  100 -
                                      (d.pricing_ab ? d.pricing_ab.treatment_percent || 0 : 50) -
                                      (d.pricing_ab && d.pricing_ab.c_percent != null
                                          ? d.pricing_ab.c_percent
                                          : 0)
                              )) +
                        '% · B ' +
                        (d.pricing_ab
                            ? d.pricing_ab.b_percent != null
                                ? d.pricing_ab.b_percent
                                : d.pricing_ab.treatment_percent
                            : 50) +
                        '% · C ' +
                        (d.pricing_ab && d.pricing_ab.c_percent != null ? d.pricing_ab.c_percent : 0) +
                        '% · 主指标：' +
                        esc(d.primary_metric_label || 'ARPU') +
                        '</p>';
                    html +=
                        '<div class="scroll-x"><table><thead><tr>' +
                        '<th>分组</th><th>曝光人数</th><th>支付人数</th><th>支付笔数</th><th>GMV</th>' +
                        '<th>人均支付(主指标)</th><th>支付转化%</th></tr></thead><tbody>';
                    (d.arms || []).forEach(function (a) {
                        if (a.variant === 'unknown' && !a.exposed_users && !a.paid_orders) return;
                        var armLabel =
                            a.variant === 'control'
                                ? 'A·对照'
                                : a.variant === 'treatment'
                                  ? 'B·多档'
                                  : a.variant === 'b'
                                    ? 'C·激活码'
                                    : a.variant;
                        html +=
                            '<tr><td>' +
                            esc(armLabel) +
                            '</td><td>' +
                            esc(String(a.exposed_users)) +
                            '</td><td>' +
                            esc(String(a.paid_users)) +
                            '</td><td>' +
                            esc(String(a.paid_orders)) +
                            '</td><td>' +
                            esc(String(a.gmv)) +
                            '</td><td><strong>' +
                            esc(String(a.arpu_exposed)) +
                            '</strong></td><td>' +
                            esc(String(a.pay_cvr)) +
                            '</td></tr>';
                    });
                    html += '</tbody></table></div>';
                    if (d.sku_breakdown && d.sku_breakdown.length) {
                        html +=
                            '<p class="stat mt-12">SKU 拆分</p><div class="scroll-x"><table><thead><tr>' +
                            '<th>分组</th><th>SKU</th><th>笔数</th><th>人数</th><th>GMV</th></tr></thead><tbody>';
                        d.sku_breakdown.forEach(function (s) {
                            html +=
                                '<tr><td>' +
                                esc(s.variant) +
                                '</td><td>' +
                                esc(s.sku_id) +
                                '</td><td>' +
                                esc(String(s.paid_orders)) +
                                '</td><td>' +
                                esc(String(s.paid_users)) +
                                '</td><td>' +
                                esc(String(s.gmv)) +
                                '</td></tr>';
                        });
                        html += '</tbody></table></div>';
                    }
                    box.innerHTML = html;
                })
                .catch(function () {
                    box.innerHTML = '网络错误';
                });
        }

        function loadAnalyticsRegisterPage() {
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
            box.setAttribute('data-date', dateStr);
            box.setAttribute('data-page', String(page));
            box.setAttribute('data-loaded', '1');
            var html = '<div class="dau-users-panel">';
            html +=
                '<div class="dau-users-title">' +
                esc(dateStr) +
                ' 支付页用户（共 ' +
                total +
                ' 人）</div>';
            if (!users.length) {
                html += '<p class="hint">当日暂无用户</p>';
            } else {
                html += '<ul class="dau-users-list">';
                users.forEach(function (u) {
                    var parts = [];
                    var ev = u.events || {};
                    if (ev.track_activate_prompt_open) parts.push('弹窗开 ' + ev.track_activate_prompt_open);
                    if (ev.track_activate_prompt_confirm) parts.push('确认激活 ' + ev.track_activate_prompt_confirm);
                    if (ev.track_activate_prompt_cancel) parts.push('弹窗取消 ' + ev.track_activate_prompt_cancel);
                    if (ev.track_activation_nudge_cta) parts.push('引导去激活 ' + ev.track_activation_nudge_cta);
                    if (ev.track_purchase_page_view) parts.push('浏览 ' + ev.track_purchase_page_view);
                    if (ev.track_alipay_payment_start) parts.push('生成付款 ' + ev.track_alipay_payment_start);
                    if (ev.track_alipay_open_click) parts.push('打开支付宝 ' + ev.track_alipay_open_click);
                    if (ev.track_alipay_payment_success) parts.push('支付成功 ' + ev.track_alipay_payment_success);
                    if (ev.track_purchase_activate_success) parts.push('激活成功 ' + ev.track_purchase_activate_success);
                    if (ev.track_purchase_activate_fail) parts.push('激活失败 ' + ev.track_purchase_activate_fail);
                    html +=
                        '<li><strong class="cell-break">' +
                        esc(u.username || '—') +
                        '</strong> · 合计 ' +
                        esc(String(u.total || 0)) +
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
                    return r.json();
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
                    return r.json();
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
            var summaryTbody = document.getElementById('analyticsPurchaseSummaryTbody');
            var dailyTbody = document.getElementById('analyticsPurchaseDailyTbody');
            var dailyHint = document.getElementById('analyticsPurchaseDailyHint');
            if (summaryEl) summaryEl.textContent = '加载中…';
            if (cardsEl) cardsEl.innerHTML = '';
            if (funnelTbody) funnelTbody.innerHTML = '<tr><td colspan="7">加载中…</td></tr>';
            if (summaryTbody) summaryTbody.innerHTML = '<tr><td colspan="3">加载中…</td></tr>';
            if (dailyTbody) dailyTbody.innerHTML = '<tr><td colspan="11">加载中…</td></tr>';
            adminFetch('api/admin/analytics/purchase-events?days=' + encodeURIComponent(days))
                .then(function (r) {
                    return r.json();
                })
                .then(function (res) {
                    if (!res || res.code !== 200 || !res.data) {
                        var msg = (res && res.msg) || '加载失败';
                        if (summaryEl) summaryEl.textContent = msg;
                        if (funnelTbody) {
                            funnelTbody.innerHTML = '<tr><td colspan="7">' + esc(msg) + '</td></tr>';
                        }
                        if (summaryTbody) {
                            summaryTbody.innerHTML = '<tr><td colspan="3">' + esc(msg) + '</td></tr>';
                        }
                        if (dailyTbody) {
                            dailyTbody.innerHTML = '<tr><td colspan="11">' + esc(msg) + '</td></tr>';
                        }
                        return;
                    }
                    var data = res.data;
                    var funnel = data.funnel || {};
                    var pay = data.payments || {};
                    if (summaryEl) {
                        summaryEl.innerHTML =
                            analyticsPeriodHintHtml(data) +
                            '激活弹窗 UV <strong>' +
                            esc(String(funnel.prompt_open_uv || 0)) +
                            '</strong>；确认激活 UV <strong>' +
                            esc(String(funnel.prompt_confirm_uv || 0)) +
                            '</strong>；购买页浏览 UV <strong>' +
                            esc(String(funnel.view_uv || 0)) +
                            '</strong>；支付宝支付成功 UV <strong>' +
                            esc(String(funnel.alipay_success_uv || 0)) +
                            '</strong>（浏览→支付 ' +
                            esc(String(funnel.view_to_pay_pct != null ? funnel.view_to_pay_pct : 0)) +
                            '%）；已付订单 <strong>' +
                            esc(String(pay.paid_orders || 0)) +
                            '</strong>，GMV ¥' +
                            esc(String(pay.gmv != null ? pay.gmv : 0)) +
                            '。';
                    }
                    if (cardsEl) {
                        var cards = [
                            ['激活弹窗 UV', funnel.prompt_open_uv || 0],
                            ['确认激活 UV', funnel.prompt_confirm_uv || 0],
                            ['浏览 UV', funnel.view_uv || 0],
                            ['定价曝光 UV', funnel.expose_uv || 0],
                            ['生成付款 UV', funnel.alipay_start_uv || 0],
                            ['打开支付宝 UV', funnel.alipay_open_uv || 0],
                            ['支付成功 UV', funnel.alipay_success_uv || 0],
                            ['浏览→支付', (funnel.view_to_pay_pct != null ? funnel.view_to_pay_pct : 0) + '%'],
                            ['激活成功 UV', funnel.activate_ok_uv || 0],
                            ['已付订单', pay.paid_orders || 0],
                            ['GMV', '¥' + (pay.gmv != null ? pay.gmv : 0)]
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
                    if (funnelTbody) {
                        funnelTbody.innerHTML =
                            '<tr>' +
                            '<td>' +
                            esc(String(funnel.view_uv || 0)) +
                            '</td>' +
                            '<td>' +
                            esc(String(funnel.alipay_start_uv || 0)) +
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
                            esc(String(funnel.start_to_open_pct != null ? funnel.start_to_open_pct : 0)) +
                            '%</td>' +
                            '<td>' +
                            esc(String(funnel.open_to_success_pct != null ? funnel.open_to_success_pct : 0)) +
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
                            dailyTbody.innerHTML = '<tr><td colspan="11">暂无每日数据</td></tr>';
                        } else {
                            var dh = '';
                            byDay.forEach(function (row) {
                                var dk = purchaseDateDomKey(row.date);
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
                                dh += '<td>¥' + esc(String(row.gmv != null ? row.gmv : 0)) + '</td>';
                                dh +=
                                    '<td><button type="button" class="btn-sm btn-detail btn-purchase-users-toggle" data-date="' +
                                    esc(row.date) +
                                    '">查看用户</button></td>';
                                dh += '</tr>';
                                dh +=
                                    '<tr id="purchase_users_row_' +
                                    dk +
                                    '" class="purchase-users-detail-row" style="display:none;"><td colspan="11"><div id="purchase_users_box_' +
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
                    if (summaryTbody) summaryTbody.innerHTML = '<tr><td colspan="3">网络错误</td></tr>';
                    if (dailyTbody) dailyTbody.innerHTML = '<tr><td colspan="11">网络错误</td></tr>';
                });
        }

        /* ========== Analytics — Tracking / Activate Events ========== */
        function loadAnalyticsTrackingPage() {
            loadInstallTrackStats();
            syncActivateEventsTableHead();
            var daysT = analyticsPeriodVal(document.getElementById('analyticsTrackingDays'));
            document.getElementById('analyticsEventsTbody').innerHTML = '<tr><td colspan="4">加载中…</td></tr>';
            var evtHintInit = document.getElementById('analyticsEventsHint');
            if (evtHintInit) evtHintInit.textContent = '加载中…';
            document.getElementById('activateEventsSummaryTbody').innerHTML =
                '<tr><td colspan="3">加载中…</td></tr>';
            document.getElementById('activateEventsDailyTbody').innerHTML =
                '<tr><td colspan="' + ACTIVATE_EVENTS_TABLE_COLSPAN + '">加载中…</td></tr>';
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
                        '<tr><td colspan="2">' + esc((act && act.msg) || '加载失败') + '</td></tr>';
                    document.getElementById('activateEventsDailyTbody').innerHTML =
                        '<tr><td colspan="' + ACTIVATE_EVENTS_TABLE_COLSPAN + '">—</td></tr>';
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
                            '</td><td>' +
                            esc(String(row.total || 0)) +
                            '</td></tr>';
                    });
                    document.getElementById('analyticsEventsTbody').innerHTML = eh || '<tr><td colspan="3">暂无埋点数据</td></tr>';
                    var evtHint = document.getElementById('analyticsEventsHint');
                    if (evtHint) {
                        var totalEvt = 0;
                        eRows.forEach(function (r) { totalEvt += Number(r.total || 0); });
                        evtHint.textContent = '共 ' + eRows.length + ' 个事件，累计 ' + totalEvt + ' 次。';
                    }
                } else {
                    document.getElementById('analyticsEventsTbody').innerHTML = '<tr><td colspan="3">' + esc((ev && ev.msg) || '加载失败') + '</td></tr>';
                    var evtHintE = document.getElementById('analyticsEventsHint');
                    if (evtHintE) evtHintE.textContent = '埋点统计加载失败';
                }
            }).catch(function () {
                document.getElementById('analyticsEventsTbody').innerHTML = '<tr><td colspan="3">网络错误</td></tr>';
                var evtHintErr = document.getElementById('analyticsEventsHint');
                if (evtHintErr) evtHintErr.textContent = '埋点统计加载失败（网络错误）';
                document.getElementById('activateEventsSummaryTbody').innerHTML =
                    '<tr><td colspan="2">网络错误</td></tr>';
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

        function loadBlockedIps() {
            var tbody = document.getElementById('blockedIpsTbody');
            var statEl = document.getElementById('blockedIpsStat');
            if (statEl) statEl.textContent = '加载中…';
            adminFetch('api/admin/blocked-ips')
                .then(function (r) { return r.json(); })
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
                        html += '<td>' + esc(item.blocked_by || '—') + '</td>';
                        html += '<td>' + esc(item.reason || '—') + '</td>';
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
                                    .then(function (r) { return r.json(); })
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
                        '<tr><th>时间</th><th>账号</th><th>姓名</th><th>方法</th><th>路径</th><th>动作</th><th>目标账号</th><th>结果</th><th>状态码</th><th>IP/城市</th><th>设备</th></tr>';
                }
            } else {
                if (hintEl) hintEl.textContent = '后台账号登录记录（成功/失败），含 IP、设备信息。';
                if (theadEl) {
                    theadEl.innerHTML = '<tr><th>时间</th><th>账号</th><th>结果</th><th>IP</th><th>城市</th><th>设备</th><th>原因</th></tr>';
                }
            }
            var loadingColspan = loginLogMode === 'admin-operation' ? 11 : 7;
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

        var USER_LOGIN_REASON_FILTER_OPTIONS = [
            { key: 'ok', label: '成功' },
            { key: 'invalid_credentials', label: '账号或密码错误' },
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
            var channelLabel = String(options.channelLabel || '').trim() || '渠道';
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
                    html += '<div class="conv-sub">' + esc(channelLabel) + '激活</div>';
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
                html +=
                    '<div class="conv-label">' +
                    summaryTitle +
                    esc(channelLabel) +
                    '激活（' +
                    esc(todayKey) +
                    '）</div>';
                html += '<div class="conv-today">' + esc(String(today.activated != null ? today.activated : 0)) + '</div>';
                html +=
                    '<div class="conv-sub">仅统计 admin 名下通过' +
                    esc(channelLabel) +
                    '码/渠道激活的用户</div>';
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

        function loadAnalyticsDailyConversion() {
            var el = document.getElementById('analyticsDailyConversion');
            if (!el) return;
            var daysEl = document.getElementById('analyticsConversionDays');
            var periodVal = analyticsPeriodVal(daysEl);
            el.textContent = '转化率加载中…';
            adminFetch('api/admin/analytics/daily-conversion?days=' + encodeURIComponent(periodVal))
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        analyticsConvCache = null;
                        el.textContent = j.msg || '转化率加载失败';
                        return;
                    }
                    renderAnalyticsDailyConversion(j.data);
                })
                .catch(function () {
                    analyticsConvCache = null;
                    el.textContent = '转化率加载失败';
                });
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
            /* 总览（注册/激活/转化率）置顶，渠道块在下 */
            html += renderDailyConversionSegmentBlock('自有流量', data.segments.own, data);
            if (data.segments.alipay) {
                html += renderDailyConversionSegmentBlock('支付宝激活', data.segments.alipay, data, {
                    activationOnly: true,
                    channelLabel: '支付宝'
                });
            }
            html += renderDailyConversionSegmentBlock('代理推广' + agentHint, data.segments.agent, data, { collapsed: true });
            [
                { key: 'xianyu', title: '闲鱼激活', label: '闲鱼' },
                { key: 'kufaka', title: '酷发卡激活', label: '酷发卡' }
            ].forEach(function (ch) {
                if (!data.segments[ch.key]) return;
                html += renderDailyConversionSegmentBlock(ch.title, data.segments[ch.key], data, {
                    activationOnly: true,
                    channelLabel: ch.label
                });
            });
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
                '<div class="device-stats-charts-wrap" style="margin-bottom:16px;"><div class="chart-canvas-wrap chart-canvas-wrap-trend"><canvas id="installGuideVisitRegChart" aria-label="安装页每日访问与注册折线图"></canvas></div></div>';

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
                '<div class="device-stats-charts-wrap" style="margin-bottom:12px;"><div class="chart-canvas-wrap chart-canvas-wrap-trend"><canvas id="installGuideHourlyChart" aria-label="安装页24小时访客分布"></canvas></div></div>';
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
            html += '<p class="stat" style="margin:0 0 8px;">最近访客行为（最多 3 位访客，同一访客合并展示）</p>';
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
                                        label: '新增游客',
                                        data: daily.map(function (row) {
                                            return Number(row.new_guests) || 0;
                                        }),
                                        borderColor: '#9333ea',
                                        backgroundColor: '#9333ea',
                                        yAxisID: 'yCount',
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
                                        backgroundColor: 'rgba(30, 111, 255, 0.75)',
                                        borderColor: '#1e6fff',
                                        borderWidth: 0,
                                        borderRadius: 3,
                                        yAxisID: 'y'
                                    },
                                    {
                                        label: '独立访客 (UV)',
                                        data: byHour.map(function (row) {
                                            return Number(row.unique_visitors) || 0;
                                        }),
                                        backgroundColor: 'rgba(34, 160, 107, 0.65)',
                                        borderColor: '#22a06b',
                                        borderWidth: 0,
                                        borderRadius: 3,
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
                                        tension: 0.25,
                                        fill: false,
                                        borderWidth: 2,
                                        pointRadius: 2,
                                        yAxisID: 'y'
                                    }
                                ]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                interaction: { mode: 'index', intersect: false },
                                plugins: {
                                    legend: { position: 'bottom' }
                                },
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        title: { display: true, text: '次数 / 人数' },
                                        ticks: { precision: 0 }
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

        function cnDateTodayYmd() {
            try {
                return new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
            } catch (e0) {
                return '';
            }
        }

        function renderShareStats(data) {
            var el = document.getElementById('shareStatsMount');
            if (!el) return;
            if (!data || !data.summary) {
                el.innerHTML = '<div class="share-stats-empty">暂无分享统计数据</div>';
                return;
            }
            var s = data.summary;
            var shareOut = s.share_out != null ? s.share_out : 0;
            var landPv = s.land_pv || 0;
            var landUv = s.land_uv || 0;
            var registerUsers = s.register_users || 0;
            var loginTimes = s.login_times || 0;
            var downloadClicks = s.download_clicks || 0;
            var todayYmd = cnDateTodayYmd();

            var html = analyticsPeriodHintHtml(data);
            if (data.note) {
                html +=
                    '<p class="hint share-stats-note">' +
                    esc(String(data.note)) +
                    '</p>';
            }

            html += '<div class="share-funnel" aria-label="分享转化漏斗">';
            html +=
                '<div class="share-funnel-step"><span class="share-funnel-label">发出</span><span class="share-funnel-val">' +
                esc(String(shareOut)) +
                '</span></div>';
            html += '<div class="share-funnel-arrow" aria-hidden="true">→</div>';
            html +=
                '<div class="share-funnel-step"><span class="share-funnel-label">打开 UV</span><span class="share-funnel-val">' +
                esc(String(landUv)) +
                '</span><span class="share-funnel-sub">打开率 ' +
                esc(s.open_rate_pct || '—') +
                '</span></div>';
            html += '<div class="share-funnel-arrow" aria-hidden="true">→</div>';
            html +=
                '<div class="share-funnel-step is-convert"><span class="share-funnel-label">注册</span><span class="share-funnel-val">' +
                esc(String(registerUsers)) +
                '</span><span class="share-funnel-sub">' +
                esc(s.register_rate_pct || '—') +
                '</span></div>';
            html +=
                '<div class="share-funnel-step"><span class="share-funnel-label">登录</span><span class="share-funnel-val">' +
                esc(String(loginTimes)) +
                '</span><span class="share-funnel-sub">' +
                esc(s.login_rate_pct || '—') +
                '</span></div>';
            html +=
                '<div class="share-funnel-step"><span class="share-funnel-label">下载</span><span class="share-funnel-val">' +
                esc(String(downloadClicks)) +
                '</span></div>';
            html += '</div>';

            html += '<div class="share-kpi-section-label">发出</div>';
            html += '<div class="share-kpi-grid">';
            html +=
                '<div class="share-kpi-card is-emit"><div class="ud-label">分享发出</div><div class="ud-val">' +
                esc(String(shareOut)) +
                '</div><div class="share-kpi-sub">首页 ' +
                esc(String(s.share_home || 0)) +
                ' · 我的 ' +
                esc(String(s.share_mine || 0)) +
                ' · 系统 ' +
                esc(String(s.share_native || 0)) +
                ' · 复制 ' +
                esc(String(s.share_copy || 0)) +
                '</div></div>';
            html +=
                '<div class="share-kpi-card is-emit"><div class="ud-label">面板打开</div><div class="ud-val">' +
                esc(String(s.share_panel_open || 0)) +
                '</div><div class="share-kpi-sub">完成 ' +
                esc(String(s.share_done || 0)) +
                ' · 海报 ' +
                esc(String(s.share_poster_save || 0)) +
                '</div></div>';
            html += '</div>';

            html += '<div class="share-kpi-section-label">触达</div>';
            html += '<div class="share-kpi-grid">';
            html +=
                '<div class="share-kpi-card is-reach"><div class="ud-label">打开 PV</div><div class="ud-val">' +
                esc(String(landPv)) +
                '</div><div class="share-kpi-sub">from=share 落地</div></div>';
            html +=
                '<div class="share-kpi-card is-reach"><div class="ud-label">打开 UV</div><div class="ud-val">' +
                esc(String(landUv)) +
                '</div><div class="share-kpi-sub">发出→打开 ' +
                esc(s.open_rate_pct || '—') +
                '</div></div>';
            html += '</div>';

            var landPages = Array.isArray(data.land_by_page) ? data.land_by_page : [];
            if (landPages.length) {
                html += '<div class="share-land-pages">';
                html += '<p class="share-daily-title">打开落地页拆分</p>';
                html += '<div class="scroll-x"><table><thead><tr>';
                html +=
                    '<th>落地页</th><th class="num">PV</th><th class="num">UV</th></tr></thead><tbody>';
                landPages.forEach(function (row) {
                    html +=
                        '<tr><td>' +
                        esc(String(row.page || '—')) +
                        '</td><td class="num">' +
                        esc(String(row.pv || 0)) +
                        '</td><td class="num">' +
                        esc(String(row.uv || 0)) +
                        '</td></tr>';
                });
                html += '</tbody></table></div></div>';
            }

            html += '<div class="share-kpi-section-label">转化</div>';
            html += '<div class="share-kpi-grid">';
            html +=
                '<div class="share-kpi-card is-convert"><div class="ud-label">分享→注册</div><div class="ud-val">' +
                esc(String(registerUsers)) +
                '</div><div class="share-kpi-sub">用户数 · 事件 ' +
                esc(String(s.register_times || 0)) +
                ' · 占打开 UV ' +
                esc(s.register_rate_pct || '—') +
                '</div></div>';
            html +=
                '<div class="share-kpi-card is-convert"><div class="ud-label">分享→登录</div><div class="ud-val">' +
                esc(String(loginTimes)) +
                '</div><div class="share-kpi-sub">占打开 UV ' +
                esc(s.login_rate_pct || '—') +
                '</div></div>';
            html +=
                '<div class="share-kpi-card is-convert"><div class="ud-label">分享→下载</div><div class="ud-val">' +
                esc(String(downloadClicks)) +
                '</div></div>';
            html += '</div>';

            var daily = Array.isArray(data.daily) ? data.daily.slice().reverse() : [];
            html += '<div class="share-daily">';
            html +=
                '<p class="share-daily-title">分日明细（北京时间；「注册」列为事件次数）</p>';
            html += '<div class="scroll-x"><table><thead><tr>';
            html +=
                '<th>日期</th><th class="num">发出</th><th class="num">打开 PV</th><th class="num">打开 UV</th><th class="num">注册</th><th class="num">登录</th><th class="num">下载</th></tr></thead><tbody>';
            if (!daily.length) {
                html +=
                    '<tr><td colspan="7" class="share-daily-empty">暂无分日数据；产生分享/打开后开始累计</td></tr>';
            } else {
                daily.forEach(function (row) {
                    var day = row.day || '—';
                    var isToday = todayYmd && String(day).slice(0, 10) === todayYmd;
                    html +=
                        '<tr' +
                        (isToday ? ' class="is-today"' : '') +
                        '><td>' +
                        esc(day) +
                        (isToday ? ' <span class="share-today-tag">今日</span>' : '') +
                        '</td><td class="num">' +
                        esc(String(row.share_out || 0)) +
                        '</td><td class="num">' +
                        esc(String(row.land_pv || 0)) +
                        '</td><td class="num">' +
                        esc(String(row.land_uv || 0)) +
                        '</td><td class="num">' +
                        esc(String(row.register || 0)) +
                        '</td><td class="num">' +
                        esc(String(row.login || 0)) +
                        '</td><td class="num">' +
                        esc(String(row.download || 0)) +
                        '</td></tr>';
                });
            }
            html += '</tbody></table></div></div>';
            el.innerHTML = html;
        }

        function loadShareStats() {
            var el = document.getElementById('shareStatsMount');
            if (!el) return;
            var daysEl = document.getElementById('shareStatsDays');
            var days = analyticsPeriodVal(daysEl);
            el.innerHTML = '<div class="share-stats-loading">加载中…</div>';
            adminFetch('api/admin/analytics/share-stats?days=' + encodeURIComponent(days))
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        el.innerHTML =
                            '<div class="share-stats-error">' +
                            esc(j.msg || '加载失败') +
                            '</div>';
                        return;
                    }
                    renderShareStats(j.data);
                })
                .catch(function () {
                    el.innerHTML = '<div class="share-stats-error">加载失败</div>';
                });
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
                            return r.json();
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
                    return r.json();
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
                    return r.json();
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
            var moreFill = document.querySelector('#batchTaxMoreMenu .batch-tax-more-item');
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
            var quickStart = document.getElementById('btnBatchTaxQuickStart');
            if (quickStart && !quickStart.__adminBound) {
                quickStart.__adminBound = true;
                quickStart.addEventListener('click', function (e) {
                    e.preventDefault();
                    if (typeof window.fillBatchTaxExample === 'function') window.fillBatchTaxExample();
                    if (typeof window.closeBatchTaxMoreMenu === 'function') window.closeBatchTaxMoreMenu();
                });
            }
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

        /* ========== Activated User Analysis ========== */
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
                { label: '今日日活', val: data.dau_today },
                { label: '个税总条数', val: data.total_tax_records },
                {
                    label: '改名总次数',
                    val: data.total_name_changes,
                    hint: data.users_renamed != null ? '涉及 ' + data.users_renamed + ' 人' : ''
                },
                {
                    label: '改个税总次数',
                    val: data.total_tax_edits,
                    hint: data.users_tax_edited != null ? '涉及 ' + data.users_tax_edited + ' 人' : ''
                }
            ];
            var html = '';
            cards.forEach(function (c) {
                html +=
                    '<div class="user-data-stat-card"><div class="ud-label">' +
                    esc(c.label) +
                    '</div><div class="ud-val">' +
                    esc(String(c.val != null ? c.val : '—')) +
                    '</div>' +
                    (c.hint
                        ? '<div class="hint" style="margin-top:4px;font-size:12px;">' + esc(c.hint) + '</div>'
                        : '') +
                    '</div>';
            });
            wrap.innerHTML = html;
            if (tablesWrap) tablesWrap.style.display = '';

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

        /* ========== User Data ========== */
        function loadActivatedUserAnalysisUsers(p) {
            if (p != null) auaUsersPage = p;
            var stat = document.getElementById('auaUserListStat');
            var tbody = document.getElementById('auaUsersTbody');
            if (stat) stat.textContent = '加载中…';
            if (tbody) tbody.innerHTML = '<tr><td colspan="12">加载中…</td></tr>';
            var username = document.getElementById('auaFilterUsername');
            var taxF = document.getElementById('auaFilterTax');
            var actF = document.getElementById('auaFilterActivity');
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
            adminFetch(q)
                .then(function (r) {
                    return r.json();
                })
                .then(function (j) {
                    if (j.code !== 200 || !j.data) {
                        if (stat) stat.textContent = j.msg || '加载失败';
                        if (tbody) tbody.innerHTML = '<tr><td colspan="12">' + esc(j.msg || '加载失败') + '</td></tr>';
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
                        html += '<td>' + esc(row.has_tax_records ? row.tax_record_count : '未填') + '</td>';
                        html += '<td>' + esc(row.name_change_count != null ? row.name_change_count : 0) + '</td>';
                        html += '<td>' + esc(row.tax_edit_count != null ? row.tax_edit_count : 0) + '</td>';
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
                            '<td colspan="12"><div id="aua_path_box_' +
                            key +
                            '">加载中…</div></td></tr>';
                    });
                    if (tbody) {
                        tbody.innerHTML = html || '<tr><td colspan="12">暂无已激活用户</td></tr>';
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
                    if (tbody) tbody.innerHTML = '<tr><td colspan="12">加载失败</td></tr>';
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

        function keyForUserData(username) {
            return String(username || '').replace(/[^a-zA-Z0-9_.-]/g, '_');
        }

        function loadUserDataList(p) {
            if (p != null) userDataPage = p;
            var stat = document.getElementById('userDataStat');
            var tbody = document.getElementById('userDataTbody');
            var usernameEl = document.getElementById('udFilterUsername');
            var realNameEl = document.getElementById('udFilterRealName');
            var companyEl = document.getElementById('udFilterCompany');
            var familyEl = document.getElementById('udFilterFamily');
            var bankEl = document.getElementById('udFilterBank');
            var username = usernameEl ? usernameEl.value.trim() : '';
            var realName = realNameEl ? realNameEl.value.trim() : '';
            var company = companyEl ? companyEl.value.trim() : '';
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
            if (hasFamily !== '') url += '&has_family=' + encodeURIComponent(hasFamily);
            if (hasBank !== '') url += '&has_bank=' + encodeURIComponent(hasBank);
            adminFetch(url)
                .then(function (r) {
                    return r.json();
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

        /* ========== User Management — Guest Users ========== */
        function renderGuestUsersStats(data) {
            var mount = document.getElementById('guestUsersStatsMount');
            if (!mount) return;
            destroyGuestUsersCharts();
            var s = (data && data.summary) || {};
            var days = s.period_days != null ? Number(s.period_days) : 1;
            var daysLabel =
                days <= 0 ? '全部' : days === 1 ? '当天' : '近 ' + days + ' 天';
            var byHour = Array.isArray(data && data.by_hour) ? data.by_hour : [];
            var hourTotal = byHour.reduce(function (sum, row) {
                return sum + (Number(row.count) || 0);
            }, 0);
            var peakHour = null;
            byHour.forEach(function (row) {
                var c = Number(row.count) || 0;
                if (!peakHour || c > peakHour.count) {
                    peakHour = { label: row.label || '', count: c };
                }
            });
            if (peakHour && peakHour.count <= 0) peakHour = null;

            var html = '<div class="user-data-stats" style="margin-bottom:14px;">';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">' +
                esc(daysLabel) +
                '游客</div><div class="ud-val">' +
                esc(String(s.period_guests != null ? s.period_guests : 0)) +
                '</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">' +
                esc(daysLabel) +
                '已注册合并</div><div class="ud-val">' +
                esc(String(s.period_converted != null ? s.period_converted : 0)) +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">仍游客 ' +
                esc(String(s.period_active != null ? s.period_active : 0)) +
                '</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">' +
                esc(daysLabel) +
                '注册率</div><div class="ud-val">' +
                esc(s.period_register_rate_pct || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">已注册÷游客</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">' +
                esc(daysLabel) +
                '个税记录</div><div class="ud-val">' +
                esc(String(s.period_tax_records != null ? s.period_tax_records : 0)) +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">' +
                esc(String(s.period_guests_with_tax != null ? s.period_guests_with_tax : 0)) +
                ' 人填写 · 填写率 ' +
                esc(s.period_tax_fill_rate_pct || '—') +
                '</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">累计注册率</div><div class="ud-val">' +
                esc(s.all_time_register_rate_pct || '—') +
                '</div><div class="hint" style="margin-top:4px;font-size:12px;">' +
                esc(String(s.all_time_converted != null ? s.all_time_converted : 0)) +
                ' / ' +
                esc(String(s.all_time_guests != null ? s.all_time_guests : 0)) +
                '</div></div>';
            html +=
                '<div class="user-data-stat-card"><div class="ud-label">带游客数据的正式账号</div><div class="ud-val">' +
                esc(String(s.registered_with_guest_data != null ? s.registered_with_guest_data : 0)) +
                '</div></div>';
            html += '</div>';

            html += '<p class="stat" style="margin:0 0 8px;">游客创建时段（北京时间）</p>';
            if (peakHour) {
                html +=
                    '<p class="hint" style="margin:0 0 10px;">统计区间内按创建小时汇总；当前高峰在「' +
                    esc(peakHour.label) +
                    '」（' +
                    esc(String(peakHour.count)) +
                    ' 人）。「近 1 天」为当天 0 点起（北京时间）。</p>';
            } else {
                html +=
                    '<p class="hint" style="margin:0 0 10px;">按北京时间统计游客账号创建小时（0–23 时）。「近 1 天」为当天 0 点起，非整日滚动 24 小时。</p>';
            }
            html +=
                '<div class="device-stats-charts-wrap" style="margin-bottom:16px;"><div class="chart-canvas-wrap chart-canvas-wrap-trend"><canvas id="guestUsersHourlyChart" aria-label="游客用户24小时分布"></canvas></div></div>';

            mount.innerHTML = html;

            if (typeof Chart !== 'undefined' && byHour.length) {
                var hourCanvas = document.getElementById('guestUsersHourlyChart');
                if (hourCanvas) {
                    _guestUsersChartInstances.push(
                        new Chart(hourCanvas, {
                            type: 'bar',
                            data: {
                                labels: byHour.map(function (row) {
                                    return row.label || '';
                                }),
                                datasets: [
                                    {
                                        label: '游客数',
                                        data: byHour.map(function (row) {
                                            return Number(row.count) || 0;
                                        }),
                                        backgroundColor: 'rgba(30, 111, 255, 0.7)',
                                        borderColor: '#1e6fff',
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
                                                var pct = hourTotal ? ((v / hourTotal) * 100).toFixed(1) : '0';
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
            }
        }

        /* ========== User Management — Registered Users ========== */
        function loadGuestUsers(p) {
            ensureUserDetailPagesToggleDelegation();
            if (p != null) guestUsersPage = p;
            var daysEl = document.getElementById('guestUsersDays');
            var statusEl = document.getElementById('guestUsersStatus');
            var usernameEl = document.getElementById('guestUsersUsername');
            var days = daysEl ? daysEl.value : '1';
            var status = statusEl ? statusEl.value : '';
            var username = usernameEl ? usernameEl.value.trim() : '';
            var url =
                'api/admin/guest-users?page=' +
                guestUsersPage +
                '&limit=' +
                guestUsersLimit +
                '&days=' +
                encodeURIComponent(days);
            if (status) url += '&status=' + encodeURIComponent(status);
            if (username) url += '&username=' + encodeURIComponent(username);

            adminFetch(url)
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.code === 403) {
                        var mount = document.getElementById('guestUsersStatsMount');
                        if (mount) mount.textContent = data.msg || '仅超级管理员可查看';
                        document.getElementById('guestUsersTbody').innerHTML =
                            '<tr><td colspan="12">' + esc(data.msg || '无权查看') + '</td></tr>';
                        return;
                    }
                    if (data.code !== 200 || !data.data) return;
                    renderGuestUsersStats(data.data);
                    var list = data.data.users || [];
                    var total = data.data.total || 0;
                    var statEl = document.getElementById('guestUsersListStat');
                    if (statEl) {
                        statEl.textContent = '共 ' + total + ' 个游客账号';
                    }
                    var totalPages = Math.ceil(total / guestUsersLimit) || 1;
                    document.getElementById('guestUsersPageInfo').textContent =
                        '第 ' + guestUsersPage + ' 页 / 共 ' + totalPages + ' 页';
                    document.getElementById('guestUsersPrev').disabled = guestUsersPage <= 1;
                    document.getElementById('guestUsersNext').disabled = guestUsersPage >= totalPages;

                    var html = '';
                    list.forEach(function (u) {
                        var statusBadge = u.is_converted
                            ? '<span class="badge badge-yes">已注册</span>'
                            : '<span class="badge badge-guest">游客中</span>';
                        var mergedCell = u.guest_merged_to
                            ? '<span class="cell-break">' + esc(u.guest_merged_to) + '</span>'
                            : '<span style="color:#bbb;">—</span>';
                        var detailBtn =
                            '<button type="button" class="btn-sm btn-detail btn-user-detail" data-u="' +
                            esc(u.username) +
                            '" data-k="' +
                            keyForUser(u.username) +
                            '">详情</button>';
                        var detailKey = keyForUser(u.username);
                        html += '<tr>';
                        html +=
                            '<td class="cell-break"><code title="' +
                            esc(u.username) +
                            '">' +
                            esc(u.username.length > 18 ? u.username.slice(0, 16) + '…' : u.username) +
                            '</code></td>';
                        html += '<td class="cell-break">' + esc(u.real_name || '—') + '</td>';
                        html += '<td class="cell-break">' + esc(u.register_source_channel_label || '—') + '</td>';
                        html += '<td>' + statusBadge + '</td>';
                        html += '<td class="cell-break">' + mergedCell + '</td>';
                        html += '<td>' + esc(String(u.tax_count != null ? u.tax_count : 0)) + '</td>';
                        html += '<td>' + esc(String(u.page_event_count != null ? u.page_event_count : 0)) + '</td>';
                        html += '<td title="' + esc(u.device_label || '') + '">' + esc(String(u.device_count != null ? u.device_count : 0)) + '</td>';
                        html += '<td>' + formatDt(u.created_at) + '</td>';
                        html += '<td>' + (u.guest_merged_at ? formatDt(u.guest_merged_at) : '—') + '</td>';
                        html += '<td class="col-ops">' + detailBtn + '</td>';
                        html += '</tr>';
                        html += '<tr id="user_detail_row_' + detailKey + '" class="users-detail-row" style="display:none;">';
                        html +=
                            '<td colspan="11"><div id="user_detail_box_' +
                            detailKey +
                            '" style="padding:4px 0;color:#888;">点击详情加载设备与页面记录…</div></td>';
                        html += '</tr>';
                    });
                    document.getElementById('guestUsersTbody').innerHTML =
                        html || '<tr><td colspan="11">暂无游客账号</td></tr>';
                    document.getElementById('guestUsersTbody').querySelectorAll('.btn-user-detail').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u');
                            var key = btn.getAttribute('data-k');
                            var row = document.getElementById('user_detail_row_' + key);
                            var box = document.getElementById('user_detail_box_' + key);
                            if (!row || !box) return;
                            var opening = row.style.display === 'none';
                            if (!opening) {
                                row.style.display = 'none';
                                return;
                            }
                            row.style.display = 'table-row';
                            box.innerHTML = '加载中…';
                            adminFetch('api/admin/user-tax-records?username=' + encodeURIComponent(name))
                                .then(function (r) { return r.json(); })
                                .then(function (d) {
                                    if (d.code !== 200 || !d.data) {
                                        box.innerHTML = '加载失败';
                                        return;
                                    }
                                    box.innerHTML = buildTaxRecordsHtml(name, d.data || {});
                                })
                                .catch(function () {
                                    box.innerHTML = '网络错误';
                                });
                        };
                    });
                })
                .catch(function () {});
        }

        /* ========== User Management — Deleted Users ========== */
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
            var taxModEl = document.getElementById('filterTaxModifiedToday');
            var taxModifiedToday = taxModEl ? taxModEl.value : '';
            var loginInactiveEl = document.getElementById('filterLoginInactive');
            var loginInactiveDays = loginInactiveEl ? loginInactiveEl.value : '';
            var nameChangesGtEl = document.getElementById('filterNameChangesGt');
            var nameChangesGt = nameChangesGtEl ? String(nameChangesGtEl.value || '').trim() : '';
            var taxModDaysGtEl = document.getElementById('filterTaxModDaysGt');
            var taxModDaysGt = taxModDaysGtEl ? String(taxModDaysGtEl.value || '').trim() : '';

            var url = 'api/admin/users?page=' + userPage + '&limit=' + userLimit;
            if (username) url += '&username=' + encodeURIComponent(username);
            if (realName) url += '&real_name=' + encodeURIComponent(realName);
            if (active !== '') url += '&active=' + active;
            if (banned !== '') url += '&banned=' + banned;
            if (exact) url += '&exact=1';
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
                        var actOwner = u.activation_owner_admin != null ? String(u.activation_owner_admin).trim() : '';
                        var actOwnerName =
                            u.activation_owner_admin_full_name != null
                                ? String(u.activation_owner_admin_full_name).trim()
                                : '';
                        var actOwnerLower = actOwner.toLowerCase();
                        var actOwnedByAdmin = !actOwner || actOwnerLower === 'admin';
                        var actOwnerDisplay = actOwnerName || actOwner;
                        var act;
                        if (!u.account_active) {
                            act = '<span class="badge badge-no">未激活</span>';
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
                        var ipLast = u.ip_last || '';
                        ops += (u.banned
                            ? '<button type="button" class="btn-sm btn-unban btn-ban-act" data-u="' + esc(u.username) + '" data-b="0">解封</button>'
                            : '<button type="button" class="btn-sm btn-ban btn-ban-act" data-u="' + esc(u.username) + '" data-b="1">封禁</button>')
                            + ' <button type="button" class="btn-sm btn-block-ip btn-block-ip-act" data-u="' + esc(u.username) + '" data-ip="' + esc(ipLast) + '">封IP</button>'
                            + ' ' + detailBtn
                            + ' <button type="button" class="btn-sm btn-page btn-user-pricing-abc" data-u="' + esc(u.username) + '">方案</button>'
                            + ' <button type="button" class="btn-sm btn-del-user btn-delete-user" data-u="' + esc(u.username) + '">删除</button>';
                        if (u.account_active) {
                            ops += ' <button type="button" class="btn-sm btn-refund btn-refund-user" data-u="' + esc(u.username) + '">退款</button>';
                        }
                        
                        var detailKey = keyForUser(u.username);
                        html += '<tr>';
                        var taxModBadge = u.tax_modified_today
                            ? '<span class="dau-tax-badge modified-today">有</span>'
                            : '<span style="color:#bbb;">—</span>';
                        var taxModDays = Number(u.tax_modified_days) || 0;
                        if (taxModDays > 0) {
                            taxModBadge +=
                                '<div style="margin-top:3px;font-size:11px;color:' +
                                (taxModDays >= 5 ? '#b45309' : '#888') +
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
                        html += '<td class="cell-break">' + esc(u.username) + '</td>';
                        html += '<td class="col-tax-mod">' + taxModBadge + '</td>';
                        html +=
                            '<td class="cell-break">' +
                            esc(u.real_name || '—') +
                            nameChangeBadge +
                            '</td>';
                        html +=
                            '<td class="cell-break">' +
                            esc(u.channel_analysis_label || u.register_source_channel_label || '—') +
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
                        html += '<td>' + ban + '</td>';
                        html += '<td class="cell-break">' + riskCell + '</td>';
                        html += '<td>' + formatDt(u.created_at) + '</td>';
                        html += '<td class="col-ops">' + ops + '</td>';
                        html += '</tr>';
                        html += '<tr id="user_detail_row_' + detailKey + '" class="users-detail-row" style="display:none;">';
                        html += '<td colspan="10"><div id="user_detail_box_' + detailKey + '" style="padding:4px 0;color:#888;">点击详情加载设备与页面记录…</div></td>';
                        html += '</tr>';
                    });
                    document.getElementById('userTbody').innerHTML = html || '<tr><td colspan="10">暂无数据</td></tr>';
                    
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
                            openUserActivateModal(btn.getAttribute('data-u'));
                        };
                    });
                    document.getElementById('userTbody').querySelectorAll('.btn-user-pricing-abc').forEach(function (btn) {
                        btn.onclick = function () {
                            var name = btn.getAttribute('data-u');
                            var pick = prompt(
                                '为「' + name + '」分配支付方案（输入 A / B / C，大小写均可）：\nA=398永久  B=298日/398周/498月/698年/998永久  C=仅激活码',
                                'A'
                            );
                            if (pick == null) return;
                            var abc = String(pick).trim();
                            try {
                                if (typeof abc.normalize === 'function') abc = abc.normalize('NFKC');
                            } catch (eNfkc) {}
                            abc = abc.toLowerCase();
                            if (abc !== 'a' && abc !== 'b' && abc !== 'c') {
                                alert('请输入 A、B 或 C（大小写均可）');
                                return;
                            }
                            if (
                                !confirm(
                                    '确认将「' + name + '」立即设为方案 ' + abc.toUpperCase() + '？'
                                )
                            ) {
                                return;
                            }
                            adminFetch('api/admin/user-pricing-abc', {
                                method: 'POST',
                                body: JSON.stringify({ username: name, abc: abc })
                            })
                                .then(function (r) {
                                    return r.json();
                                })
                                .then(function (d) {
                                    alert(d.msg || (d.code === 200 ? '已分配' : '失败'));
                                })
                                .catch(function () {
                                    alert('网络错误');
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
                                .then(function (r) { return r.json(); })
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
                                .then(function (r) { return r.json(); })
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
                var usedBy =
                    c.used_by_username && String(c.used_by_username).trim() !== ''
                        ? esc(String(c.used_by_username).trim())
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
                .then(function (r) { return r.json(); })
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
            settings: '定价与弹窗',
            'install-guide': '安装分发',
            appearance: '外观',
            codes: '激活码',
            users: '注册用户',
            'guest-users': '游客',
            'user-data': '用户数据',
            'tax-records-edit': '个税维护',
            'activated-user-analysis': '激活分析',
            'login-log': '管理登录',
            'user-login-log': '用户登录',
            analytics: '数据统计（旧）',
            'analytics-conversion': '转化与触达',
            'analytics-purchase': '支付页埋点',
            'analytics-register': '注册分析',
            'analytics-activity': '用户活跃',
            'analytics-tracking': '埋点分析',
            'install-guide-stats': '安装统计',
            'share-stats': '分享统计',
            'channel-analysis': '渠道分析',
            'admin-accounts': '账号权限',
            'server-monitor': '监控',
            'sbdy-demo': '社保演示',
            'blocked-ips': 'IP 黑名单'
        };

        function applyMenuDefsFromServer(defs) {
            if (!Array.isArray(defs)) return;
            defs.forEach(function (d) {
                if (d && d.key) ADMIN_MENU_LABELS[d.key] = d.label || d.key;
            });
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

        /* ========== Admin Accounts ========== */
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

        /* ========== Bot Purge ========== */
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
                    if (Array.isArray(data.data.menu_defs) && data.data.menu_defs.length) {
                        applyMenuDefsFromServer(data.data.menu_defs);
                        adminMenuKeyList = data.data.menu_defs.map(function (d) { return d.key; });
                    } else {
                    adminMenuKeyList = Array.isArray(data.data.menu_keys) ? data.data.menu_keys : [];
                    }
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
                if (u) u.value = '';
                if (t) t.value = '';
                if (a) a.value = '';
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
            var taxModReset = document.getElementById('filterTaxModifiedToday');
            if (taxModReset) taxModReset.value = '';
            var loginInactiveReset = document.getElementById('filterLoginInactive');
            if (loginInactiveReset) loginInactiveReset.value = '';
            var nameChangesGtReset = document.getElementById('filterNameChangesGt');
            if (nameChangesGtReset) nameChangesGtReset.value = '';
            var taxModDaysGtReset = document.getElementById('filterTaxModDaysGt');
            if (taxModDaysGtReset) taxModDaysGtReset.value = '';
            loadUsers(1);
        };

        var btnSearchGuestUsers = document.getElementById('btnSearchGuestUsers');
        if (btnSearchGuestUsers) {
            btnSearchGuestUsers.onclick = function () {
                loadGuestUsers(1);
            };
        }
        var btnResetGuestUsers = document.getElementById('btnResetGuestUsers');
        if (btnResetGuestUsers) {
            btnResetGuestUsers.onclick = function () {
                var daysEl = document.getElementById('guestUsersDays');
                var statusEl = document.getElementById('guestUsersStatus');
                var usernameEl = document.getElementById('guestUsersUsername');
                if (daysEl) daysEl.value = '1';
                if (statusEl) statusEl.value = '';
                if (usernameEl) usernameEl.value = '';
                loadGuestUsers(1);
            };
        }
        var guestUsersPrev = document.getElementById('guestUsersPrev');
        if (guestUsersPrev) {
            guestUsersPrev.onclick = function () {
                if (guestUsersPage > 1) loadGuestUsers(guestUsersPage - 1);
            };
        }
        var guestUsersNext = document.getElementById('guestUsersNext');
        if (guestUsersNext) {
            guestUsersNext.onclick = function () {
                loadGuestUsers(guestUsersPage + 1);
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
            var daysEl = document.getElementById('issueGrantDays');
            var hoursEl = document.getElementById('issueGrantHours');
            var days = daysEl ? parseInt(daysEl.value, 10) : 0;
            var hours = hoursEl ? parseInt(hoursEl.value, 10) : 0;
            if (!isFinite(days) || days < 0) days = 0;
            if (!isFinite(hours) || hours < 0) hours = 0;
            if (days > 365) {
                alert('时效天数不能超过 365');
                return;
            }
            if (hours > 720) {
                alert('时效小时不能超过 720');
                return;
            }
            var payload = {};
            if (days > 0) payload.grant_days = days;
            if (hours > 0) payload.grant_hours = hours;
            btn.disabled = true;
            adminFetch('api/admin/issue-code', {
                method: 'POST',
                body: JSON.stringify(payload)
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.code === 200 && data.data && data.data.code) {
                        var el = document.getElementById('issueOut');
                        var tip = '永久、仅可激活一个账号';
                        var gd = data.data.grant_days;
                        var gh = data.data.grant_hours;
                        if (gd || gh) {
                            var bits = [];
                            if (gd) bits.push(gd + '天');
                            if (gh) bits.push(gh + '小时');
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
                if (count > 5000) {
                    alert('单次批量数量不能超过 5000');
                    if (countEl) countEl.focus();
                    return;
                }
                var channelLabel = getSelectedBatchChannelLabel();
                if (!channelLabel) {
                    alert('请选择批量渠道');
                    return;
                }
                var note = channelLabel + '批量';
                if (
                    !confirm(
                        '将一次性生成 ' +
                            count +
                            ' 个激活码（渠道：' +
                            channelLabel +
                            '，备注：' +
                            note +
                            '），写入数据库并下载 TXT 文件。是否继续？'
                    )
                ) {
                    return;
                }
                btnIssueBatch.disabled = true;
                adminFetch('api/admin/issue-code-batch', {
                    method: 'POST',
                    body: JSON.stringify({ count: count, channel: channelLabel, note: note })
                })
                    .then(function (r) {
                        return r.json();
                    })
                    .then(function (data) {
                        if (data.code === 200 && data.data && data.data.codes && data.data.codes.length) {
                            var outLabel =
                                (data.data.channel_label && String(data.data.channel_label).trim()) ||
                                channelLabel;
                            var el = document.getElementById('issueOut');
                            if (el) {
                                el.textContent =
                                    '已批量生成 ' +
                                    data.data.count +
                                    ' 个激活码（' +
                                    outLabel +
                                    '），正在下载 TXT…';
                                el.classList.add('show');
                            }
                            if (data.data.channels) {
                                fillBatchChannelSelects(data.data.channels, outLabel);
                            }
                            downloadActivationCodesTxt(data.data.codes, {
                                channel_label: outLabel,
                                note: data.data.note || note,
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
                            alert('已生成 ' + data.data.count + ' 个「' + outLabel + '」激活码，TXT 已下载');
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

        var btnAddBatchChannel = document.getElementById('btnAddBatchChannel');
        if (btnAddBatchChannel) {
            btnAddBatchChannel.addEventListener('click', function () {
                var name = window.prompt('请输入新渠道名称（如：淘宝、拼多多）', '');
                if (name == null) return;
                name = String(name).trim().replace(/\s+/g, '').replace(/批量$/g, '');
                if (!name) {
                    alert('渠道名称不能为空');
                    return;
                }
                if (name.length > 32) {
                    alert('渠道名称不能超过 32 字');
                    return;
                }
                btnAddBatchChannel.disabled = true;
                adminFetch('api/admin/activation-batch-channels', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'add', label: name })
                })
                    .then(function (r) {
                        return r.json();
                    })
                    .then(function (data) {
                        if (data.code === 200 && data.data && data.data.channels) {
                            fillBatchChannelSelects(data.data.channels, name);
                            alert('已添加渠道「' + name + '」');
                        } else {
                            alert(data.msg || '添加失败');
                        }
                    })
                    .catch(function () {
                        alert('网络错误');
                    })
                    .finally(function () {
                        btnAddBatchChannel.disabled = false;
                    });
            });
        }

        var batchIssueChannelSel = document.getElementById('batchIssueChannel');
        if (batchIssueChannelSel) {
            batchIssueChannelSel.addEventListener('change', updateBatchChannelRemoveButton);
        }
        updateBatchChannelRemoveButton();

        var btnRemoveBatchChannel = document.getElementById('btnRemoveBatchChannel');
        if (btnRemoveBatchChannel) {
            btnRemoveBatchChannel.addEventListener('click', function () {
                var name = getSelectedBatchChannelLabel();
                if (!name) {
                    alert('请先选择要删除的渠道');
                    return;
                }
                if (isBuiltinBatchChannelLabel(name)) {
                    alert('内置渠道「' + name + '」不可删除');
                    return;
                }
                if (!confirm('确定删除自定义渠道「' + name + '」？已生成的激活码不受影响。')) {
                    return;
                }
                btnRemoveBatchChannel.disabled = true;
                adminFetch('api/admin/activation-batch-channels', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'remove', label: name })
                })
                    .then(function (r) {
                        return r.json();
                    })
                    .then(function (data) {
                        if (data.code === 200 && data.data && data.data.channels) {
                            fillBatchChannelSelects(data.data.channels, '闲鱼');
                            alert('已删除渠道「' + name + '」');
                        } else {
                            alert(data.msg || '删除失败');
                            updateBatchChannelRemoveButton();
                        }
                    })
                    .catch(function () {
                        alert('网络错误');
                        updateBatchChannelRemoveButton();
                    })
                    .finally(function () {
                        updateBatchChannelRemoveButton();
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

        /* ========== Settings / Configuration ========== */
        function loadAdminSettings() {
            adminFetch('api/admin/settings')
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.code === 200 && data.data) {
                        var landingAb = data.data.landing_ab;
                        if (landingAb) {
                            var landingEnabled = document.getElementById('landingAbEnabled');
                            var landingPct = document.getElementById('landingAbCPercent');
                            if (landingEnabled) landingEnabled.checked = landingAb.enabled !== false;
                            if (landingPct) landingPct.value = String(
                                landingAb.c_percent != null ? landingAb.c_percent : 50
                            );
                            updateLandingAbSplitHint();
                        }
                        var pricingAb = data.data.pricing_ab;
                        if (pricingAb) {
                            var pricingEn = document.getElementById('pricingAbEnabled');
                            var pricingA = document.getElementById('pricingAbAPercent');
                            var pricingB = document.getElementById('pricingAbBPercent');
                            var pricingC = document.getElementById('pricingAbCPercent');
                            if (pricingEn) pricingEn.checked = pricingAb.enabled !== false;
                            if (pricingA) {
                                pricingA.value = String(
                                    pricingAb.a_percent != null
                                        ? pricingAb.a_percent
                                        : Math.max(
                                              0,
                                              100 -
                                                  (pricingAb.treatment_percent != null
                                                      ? pricingAb.treatment_percent
                                                      : 50) -
                                                  (pricingAb.c_percent != null ? pricingAb.c_percent : 0)
                                          )
                                );
                            }
                            if (pricingB) {
                                pricingB.value = String(
                                    pricingAb.b_percent != null
                                        ? pricingAb.b_percent
                                        : pricingAb.treatment_percent != null
                                          ? pricingAb.treatment_percent
                                          : 50
                                );
                            }
                            if (pricingC) {
                                pricingC.value = String(
                                    pricingAb.c_percent != null ? pricingAb.c_percent : 0
                                );
                            }
                            updatePricingAbcSplitHint();
                        }
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
                        var xyEl = document.getElementById('xianyuPurchaseUrl');
                        if (xyEl && data.data.xianyu_purchase_url != null) {
                            xyEl.value = String(data.data.xianyu_purchase_url);
                        }
                        var xyHideEl = document.getElementById('xianyuHideSalesChannels');
                        if (xyHideEl && data.data.xianyu_hide_sales_channels != null) {
                            xyHideEl.value = String(data.data.xianyu_hide_sales_channels);
                        }
                        loadAgentExclusiveOwnerOptions();
                        loadAgentExclusiveChannels();
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

        function updatePricingAbcSplitHint() {
            var aEl = document.getElementById('pricingAbAPercent');
            var bEl = document.getElementById('pricingAbBPercent');
            var cEl = document.getElementById('pricingAbCPercent');
            var hint = document.getElementById('pricingAbcSplitHint');
            if (!hint) return;
            var a = Math.max(0, Math.min(100, parseInt(aEl && aEl.value, 10) || 0));
            var b = Math.max(0, Math.min(100, parseInt(bEl && bEl.value, 10) || 0));
            var c = Math.max(0, Math.min(100, parseInt(cEl && cEl.value, 10) || 0));
            hint.textContent = 'A ' + a + '% · B ' + b + '% · C ' + c + '%（合计 ' + (a + b + c) + '%）';
            if (a + b + c !== 100) {
                hint.textContent += ' — 须等于 100%';
            }
        }

        ['pricingAbAPercent', 'pricingAbBPercent', 'pricingAbCPercent'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', updatePricingAbcSplitHint);
        });

        var btnSavePricingAb = document.getElementById('btnSavePricingAb');
        if (btnSavePricingAb) {
            btnSavePricingAb.addEventListener('click', function () {
                var btn = btnSavePricingAb;
                var a = parseInt(document.getElementById('pricingAbAPercent').value, 10);
                var b = parseInt(document.getElementById('pricingAbBPercent').value, 10);
                var c = parseInt(document.getElementById('pricingAbCPercent').value, 10);
                if (!isFinite(a) || !isFinite(b) || a < 0 || b < 0 || a > 100 || b > 100) {
                    alert('A/B 占比请各输入 0–100 的整数');
                    return;
                }
                if (a + b !== 100) {
                    alert('A+B 必须等于 100（当前 ' + (a + b) + '）');
                    return;
                }
                btn.disabled = true;
                adminFetch('api/admin/settings', {
                    method: 'POST',
                    body: JSON.stringify({
                        pricing_ab: {
                            enabled: !!document.getElementById('pricingAbEnabled').checked,
                            a_percent: a,
                            b_percent: b,
                            c_percent: 0
                        }
                    })
                })
                    .then(function (r) {
                        return r.json();
                    })
                    .then(function (data) {
                        if (data.code === 200) {
                            alert('支付页 A/B 已保存');
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

        var btnAssignPricingAbc = document.getElementById('btnAssignPricingAbc');
        if (btnAssignPricingAbc) {
            btnAssignPricingAbc.addEventListener('click', function () {
                var btn = btnAssignPricingAbc;
                var username = String(
                    (document.getElementById('pricingAbcAssignUsername') || {}).value || ''
                ).trim();
                var abc = String(
                    (document.getElementById('pricingAbcAssignVariant') || {}).value || ''
                )
                    .trim()
                    .toLowerCase();
                var hint = document.getElementById('pricingAbcAssignHint');
                if (!username) {
                    alert('请填写账号');
                    return;
                }
                if (abc !== 'a' && abc !== 'b' && abc !== 'c') {
                    alert('请选择方案 A / B / C');
                    return;
                }
                if (
                    !confirm(
                        '确认将账号「' +
                            username +
                            '」立即分配为方案 ' +
                            abc.toUpperCase() +
                            '？\n将覆盖该账号原有支付方案锁定。'
                    )
                ) {
                    return;
                }
                btn.disabled = true;
                if (hint) hint.textContent = '分配中…';
                adminFetch('api/admin/user-pricing-abc', {
                    method: 'POST',
                    body: JSON.stringify({ username: username, abc: abc })
                })
                    .then(function (r) {
                        return r.json();
                    })
                    .then(function (data) {
                        if (data.code === 200) {
                            if (hint) {
                                hint.textContent =
                                    '已生效：' + username + ' → ' + String(abc).toUpperCase();
                            }
                            alert(data.msg || '已分配');
                        } else {
                            if (hint) hint.textContent = '';
                            alert(data.msg || '分配失败');
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

        function updateLandingAbSplitHint() {
            /* 落地页占比已并入支付页 A/B/C，保留空函数避免旧引用报错 */
        }

        var landingAbCPercent = document.getElementById('landingAbCPercent');
        if (landingAbCPercent) {
            landingAbCPercent.addEventListener('input', updateLandingAbSplitHint);
        }
        var btnSaveLandingAb = document.getElementById('btnSaveLandingAb');
        if (btnSaveLandingAb) {
            btnSaveLandingAb.addEventListener('click', function () {
                alert('落地页分流已并入「增长与触达 → 定价/支付页 A/B/C」，请在该处配置');
            });
        }
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
                        return r.json();
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
        bindAgentExclusiveChannelsUi();
        loadAdminSettings();

        var btnRefreshServerMonitor = document.getElementById('btnRefreshServerMonitor');
        if (btnRefreshServerMonitor) {
            btnRefreshServerMonitor.addEventListener('click', function () {
                loadServerMonitor();
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
                    .then(function (r) { return r.json(); })
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
        document.getElementById('analyticsConversionDays').addEventListener('change', function () {
            loadAnalyticsDailyConversion();
        });
        var btnRefreshPricingAb = document.getElementById('btnRefreshPricingAb');
        if (btnRefreshPricingAb) {
            btnRefreshPricingAb.addEventListener('click', function () {
                loadAnalyticsPricingAb();
            });
        }
        var analyticsPricingAbDays = document.getElementById('analyticsPricingAbDays');
        if (analyticsPricingAbDays) {
            analyticsPricingAbDays.addEventListener('change', function () {
                loadAnalyticsPricingAb();
            });
        }
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
        var btnRefreshShareStats = document.getElementById('btnRefreshShareStats');
        if (btnRefreshShareStats) {
            btnRefreshShareStats.onclick = function () {
                loadShareStats();
            };
        }
        var shareStatsDays = document.getElementById('shareStatsDays');
        if (shareStatsDays) {
            shareStatsDays.addEventListener('change', function () {
                loadShareStats();
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

        function bulkMsgPayload(dryRun) {
            return {
                audience: String(
                    (document.getElementById('bulkMsgAudience') || {}).value || 'pending_activate_24h'
                ),
                title: String((document.getElementById('bulkMsgTitle') || {}).value || '').trim(),
                content: String((document.getElementById('bulkMsgContent') || {}).value || '').trim(),
                link_url: String((document.getElementById('bulkMsgLink') || {}).value || '').trim() || 'purchase.html',
                dry_run: !!dryRun
            };
        }

        /* ========== Session Init & Routing ========== */
        function setBulkMsgStatus(text) {
            var el = document.getElementById('bulkMsgStatus');
            if (el) el.textContent = text || '';
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
                        return r.json();
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
                        return r.json();
                    })
                    .then(function (prev) {
                        if (prev.code !== 200 || !prev.data) {
                            throw new Error(prev.msg || '预览失败');
                        }
                        var n = Number(prev.data.matched) || 0;
                        if (
                            !window.confirm(
                                '确认向「' +
                                    (payload.audience === 'all_inactive'
                                        ? '全部未激活'
                                        : '注册超 24h 未激活') +
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
                            return r2.json();
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
        var btnRefreshRegisterPlatform = document.getElementById('btnRefreshRegisterPlatform');
        if (btnRefreshRegisterPlatform) {
            btnRefreshRegisterPlatform.addEventListener('click', function () {
                loadAnalyticsRegisterPlatform();
            });
        }
        var analyticsRegisterPlatformDays = document.getElementById('analyticsRegisterPlatformDays');
        if (analyticsRegisterPlatformDays) {
            analyticsRegisterPlatformDays.addEventListener('change', function () {
                loadAnalyticsRegisterPlatform();
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

        function applyAdminSessionPayload(data) {
            if (!data || !data.admin) return;
            var a = data.admin;
            currentAdminProfile = {
                username: a.username ? String(a.username) : '',
                full_name: a.full_name ? String(a.full_name) : '',
                is_super: !!a.is_super,
                menus: Array.isArray(a.menus) ? a.menus.map(function (m) { return String(m); }) : []
            };
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
        }

        function initAdminSession() {
            readAdminProfileCache();
            try {
                var MENU_TREE_VER = 'ops-ia-v7-concise';
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
                .then(function (r) { return r.json(); })
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
                    applyAdminRoute();
                })
                .catch(function () {});
        }

        var navRoot = document.getElementById('adminSidebarNav');
        if (navRoot && window.AdminNav) {
            AdminNav.bindNavClicks(navRoot);
        } else {
        document.querySelectorAll('.nav-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var p = btn.getAttribute('data-page');
                    if (p) location.hash = p;
            });
        });
        }
        var logoutBtn = document.getElementById('btnAdminLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                if (typeof adminLogout === 'function') adminLogout();
            });
        }
        window.addEventListener('hashchange', applyAdminRoute);
        if (window.AdminAnalyticsPeriod) {
            AdminAnalyticsPeriod.initAll();
        }
        initAdminSession();
