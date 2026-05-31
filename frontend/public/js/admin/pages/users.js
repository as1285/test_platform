/* admin/pages/users.js — users list */
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
