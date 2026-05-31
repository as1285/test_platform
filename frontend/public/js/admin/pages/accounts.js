/* admin/pages/accounts.js — admin accounts */
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
