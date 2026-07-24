/**
 * 服务器监控：内存、带宽、磁盘、服务探活；故障时邮件告警
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const mail = require('./mail');

const MONITOR_ALERT_EMAIL = process.env.MONITOR_ALERT_EMAIL || '498771018@qq.com';
const MONITOR_CHECK_INTERVAL_MS = parseInt(process.env.MONITOR_CHECK_INTERVAL_MS || '60000', 10);
const MONITOR_ALERT_COOLDOWN_MS = parseInt(process.env.MONITOR_ALERT_COOLDOWN_MS || '1800000', 10);
const MONITOR_FRONTEND_URL = process.env.MONITOR_FRONTEND_URL || 'http://frontend/';
const MONITOR_REQUEST_TIMEOUT_MS = parseInt(process.env.MONITOR_REQUEST_TIMEOUT_MS || '8000', 10);
const MONITOR_NET_RX_ALERT_BPS = parseInt(process.env.MONITOR_NET_RX_ALERT_BPS || String(80 * 1024 * 1024), 10);
const MONITOR_NET_TX_ALERT_BPS = parseInt(process.env.MONITOR_NET_TX_ALERT_BPS || String(80 * 1024 * 1024), 10);
const MONITOR_LOAD_ALERT_PERCENT = parseFloat(process.env.MONITOR_LOAD_ALERT_PERCENT || '90');
const MONITOR_MEMORY_ALERT_PERCENT = parseFloat(process.env.MONITOR_MEMORY_ALERT_PERCENT || '90');
const MONITOR_DEPLOY_GRACE_MS = parseInt(process.env.MONITOR_DEPLOY_GRACE_MS || '180000', 10);
const MONITOR_DEPLOY_MARKER =
  process.env.MONITOR_DEPLOY_MARKER || '/data/uploads/.deployment-in-progress';
const MONITOR_DEPLOY_MARKER_MAX_AGE_MS = parseInt(
  process.env.MONITOR_DEPLOY_MARKER_MAX_AGE_MS || '1800000',
  10
);
const MONITOR_STARTED_AT = Date.now();

/** 告警邮件用的站点域名（来自 PUBLIC_SITE_URL / APP_URL） */
function resolveAlertSiteDomain() {
  var raw = String(process.env.PUBLIC_SITE_URL || process.env.APP_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (!raw) return '';
  try {
    var u = new URL(raw.indexOf('://') >= 0 ? raw : 'https://' + raw);
    return String(u.hostname || '').replace(/^www\./i, '') || raw;
  } catch (e) {
    return raw.replace(/^https?:\/\//i, '').split('/')[0] || raw;
  }
}

function alertMailPrefix() {
  var domain = resolveAlertSiteDomain();
  return domain ? '[' + domain + ']' : '[test_platform]';
}

function alertMailSiteLine() {
  var domain = resolveAlertSiteDomain();
  var origin = String(process.env.PUBLIC_SITE_URL || process.env.APP_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (origin) {
    return '站点：' + origin + '\n域名：' + (domain || '—') + '\n';
  }
  if (domain) {
    return '域名：' + domain + '\n';
  }
  return '';
}

/** @type {import('mysql2/promise').Pool|null} */
var _pool = null;
var _uploadDir = '';

var _lastNetSample = null;
var _intervalId = null;
var _alertCooldown = {};
var _serviceDownSince = {};

var _state = {
  updated_at: null,
  services: [],
  host: {},
  network: {},
  disk: {},
  alerts: [],
  smtp_configured: false,
  alert_email: MONITOR_ALERT_EMAIL
};

const SERVICE_DEFS = [
  { id: 'backend', label: 'API 后端', type: 'self' },
  { id: 'database', label: 'MySQL 数据库', type: 'db' },
  { id: 'frontend', label: '前端 Nginx', type: 'http', url: MONITOR_FRONTEND_URL }
];

/** 辅助函数：formatBytes */
function formatBytes(n) {
  if (n == null || !isFinite(n) || n < 0) return '—';
  var units = ['B', 'KB', 'MB', 'GB', 'TB'];
  var i = 0;
  var v = Number(n);
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return (i === 0 ? String(Math.round(v)) : v.toFixed(2)) + ' ' + units[i];
}

/** 辅助函数：formatBps */
function formatBps(bps) {
  if (bps == null || !isFinite(bps)) return '—';
  return formatBytes(bps) + '/s';
}

/** 辅助函数：readNetBytes */
function readNetBytes() {
  try {
    var raw = fs.readFileSync('/proc/net/dev', 'utf8');
    var lines = raw.split('\n');
    var rx = 0;
    var tx = 0;
    for (var i = 2; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var parts = line.split(/\s+/);
      if (parts.length < 10) continue;
      var iface = parts[0].replace(':', '');
      if (iface === 'lo') continue;
      rx += parseInt(parts[1], 10) || 0;
      tx += parseInt(parts[9], 10) || 0;
    }
    return { rx, tx, at: Date.now() };
  } catch (e) {
    return null;
  }
}

/** 辅助函数：calcNetworkRates */
function calcNetworkRates(sample) {
  if (!_lastNetSample || !sample) {
    return { rx_bps: null, tx_bps: null, rx_total: sample ? sample.rx : null, tx_total: sample ? sample.tx : null };
  }
  var dt = (sample.at - _lastNetSample.at) / 1000;
  if (dt <= 0) {
    return { rx_bps: null, tx_bps: null, rx_total: sample.rx, tx_total: sample.tx };
  }
  return {
    rx_bps: Math.max(0, Math.round((sample.rx - _lastNetSample.rx) / dt)),
    tx_bps: Math.max(0, Math.round((sample.tx - _lastNetSample.tx) / dt)),
    rx_total: sample.rx,
    tx_total: sample.tx
  };
}

/** 获取：DiskUsage */
async function getDiskUsage(dir) {
  var target = dir || '/';
  try {
    if (fs.promises.statfs) {
      var st = await fs.promises.statfs(target);
      var total = st.blocks * st.bsize;
      var free = st.bfree * st.bsize;
      var used = total - free;
      return {
        path: target,
        total_bytes: total,
        used_bytes: used,
        free_bytes: free,
        used_percent: total > 0 ? Math.round((used / total) * 1000) / 10 : 0
      };
    }
  } catch (e) {
    /* fall through */
  }
  return { path: target, total_bytes: null, used_bytes: null, free_bytes: null, used_percent: null };
}

async function getDirectorySizeBytes(dir) {
  if (!dir) return null;
  var total = 0;
  async function walk(current) {
    var entries;
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (var i = 0; i < entries.length; i++) {
      var ent = entries[i];
      var full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile()) {
        try {
          var st = await fs.promises.stat(full);
          total += st.size;
        } catch (e2) {
          /* skip unreadable file */
        }
      }
    }
  }
  await walk(dir);
  return total;
}

function withDiskLabels(disk) {
  return Object.assign({}, disk, {
    total_label: formatBytes(disk.total_bytes),
    used_label: formatBytes(disk.used_bytes),
    free_label: formatBytes(disk.free_bytes)
  });
}

/** 辅助函数：fetchWithTimeout */
function fetchWithTimeout(url, timeoutMs) {
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = ctrl
    ? setTimeout(function () {
        ctrl.abort();
      }, timeoutMs)
    : null;
  var opts = ctrl ? { signal: ctrl.signal } : {};
  return fetch(url, opts).finally(function () {
    if (timer) clearTimeout(timer);
  });
}

/** 辅助函数：probeService */
async function probeService(def) {
  var started = Date.now();
  if (def.type === 'self') {
    return { id: def.id, label: def.label, ok: true, latency_ms: 0, message: '运行中' };
  }
  if (def.type === 'db') {
    if (!_pool) {
      return { id: def.id, label: def.label, ok: false, latency_ms: null, message: '数据库连接池未初始化' };
    }
    try {
      await _pool.query('SELECT 1');
      return {
        id: def.id,
        label: def.label,
        ok: true,
        latency_ms: Date.now() - started,
        message: '连接正常'
      };
    } catch (e) {
      return {
        id: def.id,
        label: def.label,
        ok: false,
        latency_ms: Date.now() - started,
        message: String(e && e.message ? e.message : e)
      };
    }
  }
  if (def.type === 'http') {
    try {
      var res = await fetchWithTimeout(def.url, MONITOR_REQUEST_TIMEOUT_MS);
      var ok = res.ok || res.status < 500;
      return {
        id: def.id,
        label: def.label,
        ok: ok,
        latency_ms: Date.now() - started,
        message: ok ? 'HTTP ' + res.status : 'HTTP ' + res.status
      };
    } catch (e) {
      return {
        id: def.id,
        label: def.label,
        ok: false,
        latency_ms: Date.now() - started,
        message: String(e && e.message ? e.message : e)
      };
    }
  }
  return { id: def.id, label: def.label, ok: false, latency_ms: null, message: '未知探针类型' };
}

/** 辅助函数：pushAlert */
function pushAlert(entry) {
  _state.alerts.unshift(entry);
  if (_state.alerts.length > 50) {
    _state.alerts.length = 50;
  }
}

/** 辅助函数：canSendAlert */
function canSendAlert(serviceId) {
  var last = _alertCooldown[serviceId] || 0;
  return Date.now() - last >= MONITOR_ALERT_COOLDOWN_MS;
}

/** 辅助函数：alertSuppressedReason */
function alertSuppressedReason() {
  if (
    MONITOR_DEPLOY_GRACE_MS > 0 &&
    Date.now() - MONITOR_STARTED_AT < MONITOR_DEPLOY_GRACE_MS
  ) {
    return '服务启动宽限期';
  }
  try {
    var st = fs.statSync(MONITOR_DEPLOY_MARKER);
    if (
      MONITOR_DEPLOY_MARKER_MAX_AGE_MS <= 0 ||
      Date.now() - st.mtimeMs <= MONITOR_DEPLOY_MARKER_MAX_AGE_MS
    ) {
      return '正在部署';
    }
  } catch (e) {
    /* marker 不存在 */
  }
  return '';
}

async function notifyServiceDown(svc, hostSnapshot) {
  var suppressed = alertSuppressedReason();
  if (suppressed) {
    console.log('[monitor] alert suppressed (' + suppressed + '):', svc.id, svc.message);
    return;
  }
  if (!canSendAlert(svc.id)) {
    return;
  }
  _alertCooldown[svc.id] = Date.now();
  var subject = alertMailPrefix() + ' 服务异常：' + svc.label;
  var text =
    '检测到服务不可用，请及时处理。\n\n' +
    alertMailSiteLine() +
    '服务：' +
    svc.label +
    ' (' +
    svc.id +
    ')\n' +
    '状态：异常\n' +
    '详情：' +
    (svc.message || '—') +
    '\n' +
    '时间：' +
    new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) +
    '\n' +
    '主机：' +
    (hostSnapshot.hostname || '—') +
    '\n' +
    '内存使用：' +
    (hostSnapshot.memory_used_percent != null ? hostSnapshot.memory_used_percent + '%' : '—') +
    '\n\n' +
    '— ' +
    (resolveAlertSiteDomain() || 'test_platform') +
    ' 服务器监控';

  var alertEntry = {
    at: new Date().toISOString(),
    service_id: svc.id,
    service_label: svc.label,
    message: svc.message || '',
    email_sent: false,
    email_error: null
  };

  if (mail.isMailConfigured()) {
    try {
      await mail.sendMail({
        to: MONITOR_ALERT_EMAIL,
        subject: subject,
        text: text
      });
      alertEntry.email_sent = true;
      console.log('[monitor] alert email sent for', svc.id, '->', MONITOR_ALERT_EMAIL);
    } catch (e) {
      alertEntry.email_error = String(e && e.message ? e.message : e);
      console.error('[monitor] alert email failed', e);
    }
  } else {
    alertEntry.email_error = '未配置 SMTP（SMTP_USER / SMTP_PASS）';
    console.warn('[monitor] service down but SMTP not configured:', svc.id, svc.message);
  }

  pushAlert(alertEntry);
}

/** 辅助函数：notifyServiceRecovered */
async function notifyServiceRecovered(svc) {
  pushAlert({
    at: new Date().toISOString(),
    service_id: svc.id,
    service_label: svc.label,
    message: '服务已恢复',
    recovered: true,
    email_sent: false
  });
  delete _serviceDownSince[svc.id];
}

/** 辅助函数：notifyHostMetricAlert */
async function notifyHostMetricAlert(metricId, label, message, hostSnapshot) {
  var suppressed = alertSuppressedReason();
  if (suppressed) {
    console.log('[monitor] metric alert suppressed (' + suppressed + '):', metricId, message);
    return;
  }
  if (!canSendAlert(metricId)) {
    return;
  }
  _alertCooldown[metricId] = Date.now();
  var subject = alertMailPrefix() + ' 服务器指标异常：' + label;
  var text =
    '检测到服务器指标异常，请及时处理。\n\n' +
    alertMailSiteLine() +
    '指标：' +
    label +
    '\n' +
    '详情：' +
    message +
    '\n' +
    '时间：' +
    new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) +
    '\n' +
    '主机：' +
    (hostSnapshot.hostname || '—') +
    '\n' +
    'CPU 负载：' +
    (hostSnapshot.load_percent_1 != null ? hostSnapshot.load_percent_1 + '%' : '—') +
    '\n' +
    '内存使用：' +
    (hostSnapshot.memory_used_percent != null ? hostSnapshot.memory_used_percent + '%' : '—') +
    '\n\n' +
    '— ' +
    (resolveAlertSiteDomain() || 'test_platform') +
    ' 服务器监控';

  var alertEntry = {
    at: new Date().toISOString(),
    service_id: metricId,
    service_label: label,
    message: message,
    email_sent: false,
    email_error: null
  };

  if (mail.isMailConfigured()) {
    try {
      await mail.sendMail({ to: MONITOR_ALERT_EMAIL, subject: subject, text: text });
      alertEntry.email_sent = true;
      console.log('[monitor] metric alert email sent for', metricId, '->', MONITOR_ALERT_EMAIL);
    } catch (e) {
      alertEntry.email_error = String(e && e.message ? e.message : e);
      console.error('[monitor] metric alert email failed', e);
    }
  } else {
    alertEntry.email_error = '未配置 SMTP（SMTP_USER / SMTP_PASS）';
    console.warn('[monitor] metric alert but SMTP not configured:', metricId, message);
  }

  pushAlert(alertEntry);
}

/** 辅助函数：runMonitorTick */
async function runMonitorTick() {
  var netSample = readNetBytes();
  var netRates = calcNetworkRates(netSample);
  if (netSample) {
    _lastNetSample = netSample;
  }

  var totalMem = os.totalmem();
  var freeMem = os.freemem();
  var usedMem = totalMem - freeMem;
  var load = os.loadavg();
  var cpus = os.cpus().length || 1;

  var host = {
    hostname: os.hostname(),
    platform: os.platform(),
    uptime_sec: Math.round(os.uptime()),
    cpu_count: cpus,
    load_1: Math.round(load[0] * 100) / 100,
    load_5: Math.round(load[1] * 100) / 100,
    load_15: Math.round(load[2] * 100) / 100,
    load_percent_1: Math.min(100, Math.round((load[0] / cpus) * 1000) / 10),
    memory_total_bytes: totalMem,
    memory_used_bytes: usedMem,
    memory_free_bytes: freeMem,
    memory_used_percent: totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : 0,
    process_rss_bytes: process.memoryUsage().rss,
    process_heap_used_bytes: process.memoryUsage().heapUsed
  };

  var diskRoot = await getDiskUsage('/');
  var uploadsPath = _uploadDir || '/data/uploads';
  var uploadsDirBytes = await getDirectorySizeBytes(uploadsPath);
  var services = [];
  for (var i = 0; i < SERVICE_DEFS.length; i++) {
    services.push(await probeService(SERVICE_DEFS[i]));
  }

  _state.updated_at = new Date().toISOString();
  _state.services = services;
  _state.host = host;
  _state.network = {
    rx_bps: netRates.rx_bps,
    tx_bps: netRates.tx_bps,
    rx_total_bytes: netRates.rx_total,
    tx_total_bytes: netRates.tx_total,
    rx_bps_label: formatBps(netRates.rx_bps),
    tx_bps_label: formatBps(netRates.tx_bps)
  };
  _state.disk_root = withDiskLabels(diskRoot);
  _state.disk_uploads = {
    path: uploadsPath,
    dir_bytes: uploadsDirBytes,
    dir_label: formatBytes(uploadsDirBytes)
  };
  /* 兼容旧字段：disk 仍指向系统盘 */
  _state.disk = _state.disk_root;
  _state.smtp_configured = mail.isMailConfigured();
  _state.alert_email = MONITOR_ALERT_EMAIL;

  for (var j = 0; j < services.length; j++) {
    var s = services[j];
    if (!s.ok) {
      if (!_serviceDownSince[s.id]) {
        _serviceDownSince[s.id] = Date.now();
      }
      /*
       * 部署静默期间不会占用 cooldown；每轮重试可确保部署结束后若服务仍未恢复，
       * 会正常发送真实故障告警。
       */
      await notifyServiceDown(s, host);
    } else if (_serviceDownSince[s.id]) {
      await notifyServiceRecovered(s);
    }
  }

  if (netRates.rx_bps != null && MONITOR_NET_RX_ALERT_BPS > 0 && netRates.rx_bps >= MONITOR_NET_RX_ALERT_BPS) {
    await notifyHostMetricAlert('metric:net-rx', '入网带宽', '当前入网 ' + formatBps(netRates.rx_bps), host);
  }
  if (netRates.tx_bps != null && MONITOR_NET_TX_ALERT_BPS > 0 && netRates.tx_bps >= MONITOR_NET_TX_ALERT_BPS) {
    await notifyHostMetricAlert('metric:net-tx', '出网带宽', '当前出网 ' + formatBps(netRates.tx_bps), host);
  }
  if (host.load_percent_1 != null && MONITOR_LOAD_ALERT_PERCENT > 0 && host.load_percent_1 >= MONITOR_LOAD_ALERT_PERCENT) {
    await notifyHostMetricAlert('metric:load', 'CPU 负载', '1 分钟负载约 ' + host.load_percent_1 + '%', host);
  }
  if (
    host.memory_used_percent != null &&
    MONITOR_MEMORY_ALERT_PERCENT > 0 &&
    host.memory_used_percent >= MONITOR_MEMORY_ALERT_PERCENT
  ) {
    await notifyHostMetricAlert('metric:memory', '内存使用率', '当前内存使用 ' + host.memory_used_percent + '%', host);
  }
}

function getMonitorOverview() {
  return JSON.parse(JSON.stringify(_state));
}

/** 初始化：ServerMonitor */
function initServerMonitor(opts) {
  _pool = opts.pool || null;
  _uploadDir = opts.uploadDir || '';
  _state.smtp_configured = mail.isMailConfigured();
  _state.alert_email = MONITOR_ALERT_EMAIL;
}

/** 启动：ServerMonitor */
function startServerMonitor() {
  if (_intervalId) {
    return;
  }
  runMonitorTick().catch(function (e) {
    console.error('[monitor] initial tick failed', e);
  });
  _intervalId = setInterval(function () {
    runMonitorTick().catch(function (e) {
      console.error('[monitor] tick failed', e);
    });
  }, Math.max(15000, MONITOR_CHECK_INTERVAL_MS));
  console.log(
    '[monitor] started interval=' +
      MONITOR_CHECK_INTERVAL_MS +
      'ms alert=' +
      MONITOR_ALERT_EMAIL +
      ' smtp=' +
      (mail.isMailConfigured() ? 'yes' : 'no')
  );
}

/** 停止：ServerMonitor */
function stopServerMonitor() {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
}

/** 发送：TestAlertEmail */
async function sendTestAlertEmail() {
  if (!mail.isMailConfigured()) {
    throw new Error('未配置 SMTP（请设置 SMTP_USER 与 SMTP_PASS，QQ 邮箱需使用授权码）');
  }
  await mail.sendMail({
    to: MONITOR_ALERT_EMAIL,
    subject: alertMailPrefix() + ' 服务器监控邮件测试',
    text:
      '这是一封测试邮件，说明服务器监控告警邮件通道已配置成功。\n\n' +
      alertMailSiteLine() +
      '时间：' +
      new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) +
      '\n主机：' +
      os.hostname()
  });
  return { to: MONITOR_ALERT_EMAIL, site: resolveAlertSiteDomain() || null };
}

module.exports = {
  initServerMonitor,
  startServerMonitor,
  stopServerMonitor,
  getMonitorOverview,
  sendTestAlertEmail,
  runMonitorTick,
  formatBytes,
  formatBps,
  getDiskUsage,
  getDirectorySizeBytes
};
