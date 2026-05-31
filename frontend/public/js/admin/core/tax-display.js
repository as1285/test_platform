/* admin/core/tax-display.js — tax record display */
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
