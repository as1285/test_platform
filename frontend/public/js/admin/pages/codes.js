/* admin/pages/codes.js — activation codes */
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
    feedback: '用户反馈',
    'login-log': '管理账号登录流水',
    'user-login-log': '普通用户登录流水',
    analytics: '数据统计',
    'channel-analysis': '渠道分析',
    'api-analytics': '接口统计',
    'admin-accounts': '后台账号权限',
    'server-monitor': '服务器监控'
};
