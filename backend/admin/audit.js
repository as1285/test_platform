'use strict';

var pool, getClientIp, cityLabelFromIp, sanitizeAuditText;
var normalizeUserAgentHeader, computeDeviceFingerprint, displayUserAgentFromDevice, classifyAnalyticsRoute;

function initAdminAudit(deps) {
  pool = deps.pool;
  getClientIp = deps.getClientIp;
  cityLabelFromIp = deps.cityLabelFromIp;
  sanitizeAuditText = deps.sanitizeAuditText;
  normalizeUserAgentHeader = deps.normalizeUserAgentHeader;
  computeDeviceFingerprint = deps.computeDeviceFingerprint;
  displayUserAgentFromDevice = deps.displayUserAgentFromDevice;
  classifyAnalyticsRoute = deps.classifyAnalyticsRoute;
}

function adminDeviceDesc(req) {
  var ex = req && req.clientDevicePayload;
  if (ex && typeof ex === 'object') {
    var bits = [];
    if (ex.source) bits.push(String(ex.source));
    if (ex.platform) bits.push(String(ex.platform));
    if (ex.model) bits.push(String(ex.model));
    if (ex.os_version) bits.push('OS ' + String(ex.os_version));
    if (ex.app_version) bits.push('App ' + String(ex.app_version));
    var merged = sanitizeAuditText(bits.join(' · '), 255);
    if (merged) return merged;
  }
  return sanitizeAuditText(displayUserAgentFromDevice(req), 255);
}

function buildAdminRequestBrief(req) {
  if (!req) return '';
  var parts = [];
  var qObj = sanitizeAuditObjectTopLevel(req.query);
  var bObj = sanitizeAuditObjectTopLevel(req.body);
  if (qObj) {
    parts.push('query=' + JSON.stringify(qObj));
  }
  if (bObj) {
    parts.push('body=' + JSON.stringify(bObj));
  }
  return sanitizeAuditText(parts.join(' | '), 1024);
}

async function recordAdminLoginAttempt(adminUsername, ok, reason, req) {
  if (!pool) return;
  var uname = sanitizeAuditText(adminUsername, 255);
  if (!uname) uname = 'unknown';
  var ip = sanitizeAuditText(getClientIp(req), 128);
  var city = sanitizeAuditText(cityLabelFromIp(ip), 255);
  var ua = sanitizeAuditText(normalizeUserAgentHeader(req), 512);
  var fp = sanitizeAuditText(computeDeviceFingerprint(req), 64);
  var deviceDesc = adminDeviceDesc(req);
  var why = sanitizeAuditText(reason, 255);
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      `INSERT INTO admin_login_events
       (admin_username, ok, reason, ip, city, user_agent, device_fp, device_desc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uname, ok ? 1 : 0, why || null, ip || null, city || null, ua || null, fp || null, deviceDesc || null]
    );
  } catch (e) {
    console.error('recordAdminLoginAttempt', e);
  } finally {
    conn.release();
  }
}

async function recordAdminOperationLog(req, res) {
  if (!pool || !req || !req.admin || !res) return;
  var p = sanitizeAuditText(req.path || '', 255);
  if (!p || p === '/api/admin/login' || p === '/api/admin/admin-login-logs' || p === '/api/admin/admin-operation-logs') {
    return;
  }
  var method = sanitizeAuditText(String(req.method || '').toUpperCase(), 16) || 'GET';
  var adminUsername = sanitizeAuditText(req.admin.username, 255);
  var adminFullName = sanitizeAuditText(req.admin.full_name || '', 255);
  if (!adminUsername) return;
  var action = '';
  if (req.body && req.body.action != null && String(req.body.action).trim() !== '') {
    action = sanitizeAuditText(req.body.action, 120);
  } else if (req.query && req.query.action != null && String(req.query.action).trim() !== '') {
    action = sanitizeAuditText(req.query.action, 120);
  }
  var targetUsername = '';
  var src = req.body && typeof req.body === 'object' ? req.body : req.query;
  if (src && src.username != null && String(src.username).trim() !== '') {
    targetUsername = sanitizeAuditText(src.username, 255);
  } else if (src && src.user_id != null && String(src.user_id).trim() !== '') {
    targetUsername = sanitizeAuditText(src.user_id, 255);
  }
  var info = classifyAnalyticsRoute(req);
  var routeKey = info && info.route_key ? sanitizeAuditText(info.route_key, 240) : '';
  var ip = sanitizeAuditText(getClientIp(req), 128);
  var city = sanitizeAuditText(cityLabelFromIp(ip), 255);
  var ua = sanitizeAuditText(normalizeUserAgentHeader(req), 512);
  var fp = sanitizeAuditText(computeDeviceFingerprint(req), 64);
  var deviceDesc = adminDeviceDesc(req);
  var statusCode = Number(res.statusCode || 0);
  var bizCode = null;
  if (res.__adminBizCode != null && isFinite(Number(res.__adminBizCode))) {
    bizCode = Number(res.__adminBizCode);
  }
  var ok = statusCode < 400 && (bizCode == null || bizCode === 200);
  var reqBrief = buildAdminRequestBrief(req);
  const conn = await pool.getConnection();
  try {
    await conn.execute(
      `INSERT INTO admin_operation_logs
       (admin_username, admin_full_name, method, path, route_key, action, target_username, request_brief,
        ip, city, user_agent, device_fp, device_desc, status_code, biz_result_code, ok)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        adminUsername,
        adminFullName || null,
        method,
        p,
        routeKey || null,
        action || null,
        targetUsername || null,
        reqBrief || null,
        ip || null,
        city || null,
        ua || null,
        fp || null,
        deviceDesc || null,
        statusCode,
        bizCode,
        ok ? 1 : 0
      ]
    );
  } catch (e) {
    console.error('recordAdminOperationLog', e);
  } finally {
    conn.release();
  }
}

module.exports = {
  initAdminAudit,
  recordAdminLoginAttempt,
  recordAdminOperationLog
};
