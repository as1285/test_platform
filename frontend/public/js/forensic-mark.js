/**
 * 不可见取证水印：在 DOM 中嵌入零宽字符指纹（host/path/uid/cid/ts）。
 * 截图/另存 HTML 后可用工具还原，便于追责；对正常用户不可见。
 */
(function () {
  var MARK_ID = 'tax-forensic-mark';
  var META_NAME = 'x-tax-fm';

  function safeGet(key) {
    try {
      return String(localStorage.getItem(key) || '').trim();
    } catch (e) {
      return '';
    }
  }

  function clientId() {
    var k = 'tax_client_id';
    var v = safeGet(k);
    if (v && v.length >= 8) {
      return v.slice(0, 64);
    }
    v = '';
    try {
      var arr = new Uint8Array(16);
      (window.crypto || window.msCrypto).getRandomValues(arr);
      for (var i = 0; i < arr.length; i++) {
        v += ('0' + arr[i].toString(16)).slice(-2);
      }
    } catch (e2) {
      v = String(Date.now()) + Math.random().toString(16).slice(2);
    }
    try {
      localStorage.setItem(k, v);
    } catch (e3) {}
    return v.slice(0, 64);
  }

  function encodeZw(str) {
    var out = '';
    var s = String(str || '');
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      for (var b = 0; b < 16; b++) {
        out += (code >> (15 - b)) & 1 ? '\u200b' : '\u200c';
      }
      out += '\u200d';
    }
    return out;
  }

  function buildPayload() {
    var uid = safeGet('username') || safeGet('user_id') || '';
    var parts = [
      'v1',
      String(location.host || ''),
      String(location.pathname || ''),
      uid,
      clientId(),
      String(Math.floor(Date.now() / 1000))
    ];
    return parts.join('|');
  }

  function apply() {
    if (document.getElementById(MARK_ID)) {
      return;
    }
    var payload = buildPayload();
    var zw = encodeZw(payload);

    var meta = document.querySelector('meta[name="' + META_NAME + '"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', META_NAME);
      (document.head || document.documentElement).appendChild(meta);
    }
    meta.setAttribute('content', btoa(unescape(encodeURIComponent(payload))).slice(0, 120));

    var el = document.createElement('span');
    el.id = MARK_ID;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText =
      'position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
    el.textContent = zw;
    (document.body || document.documentElement).appendChild(el);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
