/* admin/pages/monitor.js — server monitor */
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
