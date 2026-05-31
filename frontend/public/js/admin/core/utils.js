/* admin/core/utils.js — esc, statIconHtml */
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
