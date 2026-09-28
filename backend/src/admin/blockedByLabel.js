/**
 * IP 黑名单「操作管理员」：只存/只展示短账号名，避免把 admin 整对象（含 hash）写进表格。
 */
'use strict';

function pickLabel(username, fullName) {
  var name = String(fullName || '').trim();
  var user = String(username || '').trim();
  if (name && user && name !== user) return name;
  return name || user || '';
}

function fromAdminObject(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return pickLabel(obj.username, obj.full_name);
}

function extractJsonField(raw, key) {
  var re = new RegExp('"' + key + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"');
  var m = String(raw || '').match(re);
  if (!m) return '';
  return m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

/** 列表展示：兼容历史 JSON / 截断 JSON，绝不回显 salt/hash */
function blockedByLabel(raw) {
  if (raw == null) return '—';
  if (typeof raw === 'object') {
    return fromAdminObject(raw) || '—';
  }
  var s = String(raw).trim();
  if (!s) return '—';
  if (s.charAt(0) === '{' || (s.length > 80 && /"username"\s*:/.test(s))) {
    try {
      var parsed = JSON.parse(s);
      var fromParsed = fromAdminObject(parsed);
      if (fromParsed) return fromParsed;
    } catch (e) {
      var fromFrag = pickLabel(extractJsonField(s, 'username'), extractJsonField(s, 'full_name'));
      if (fromFrag) return fromFrag;
    }
    return '—';
  }
  return s;
}

/** 写入 blocked_by：只要用户名 */
function blockedByFromAdmin(admin) {
  if (!admin) return '';
  if (typeof admin === 'string') {
    var label = blockedByLabel(admin);
    return label === '—' ? '' : label;
  }
  return String(admin.username || '').trim();
}

module.exports = {
  blockedByLabel: blockedByLabel,
  blockedByFromAdmin: blockedByFromAdmin
};
