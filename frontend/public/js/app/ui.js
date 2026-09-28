/**
 * TaxApp UI：统一 Toast（阶段 3 设计系统壳）
 * 注入优先页；业务页也可直接调 window.TaxAppUI.toast / TaxApp.ui.toast。
 * 时长默认读 window.TOAST_DURATION_MS（toast-duration.js）。
 */
(function (global) {
  // === Toast 宿主与样式（单例） ===
  var STYLE_ID = 'tax-app-toast-style';
  var HOST_ID = 'tax-app-toast-host';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent =
      '#' +
      HOST_ID +
      '{position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:10050;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;max-width:86vw;}' +
      '.' +
      'tax-app-toast{background:rgba(28,28,30,.92);color:#fff;font-size:14px;line-height:1.4;padding:10px 16px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);text-align:center;opacity:0;transform:translateY(8px);transition:opacity .2s ease,transform .2s ease;}' +
      '.' +
      'tax-app-toast.is-on{opacity:1;transform:translateY(0);}' +
      '.' +
      'tax-app-toast.is-ok{background:rgba(22,120,74,.95);}' +
      '.' +
      'tax-app-toast.is-err{background:rgba(176,0,32,.94);}';
    document.head.appendChild(s);
  }

  function ensureHost() {
    var host = document.getElementById(HOST_ID);
    if (host) return host;
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
    return host;
  }

  function durationMs(override) {
    if (override != null && isFinite(Number(override))) return Math.max(800, Number(override));
    var ms = global.TOAST_DURATION_MS != null ? Number(global.TOAST_DURATION_MS) : 3000;
    if (!isFinite(ms) || ms < 800) ms = 3000;
    return ms;
  }

  /**
   * @param {string} text
   * @param {{ok?:boolean,error?:boolean,ms?:number}|boolean} [opts]
   */
  function toast(text, opts) {
    var msg = String(text == null ? '' : text).trim();
    if (!msg) return;
    ensureStyle();
    var host = ensureHost();
    var el = document.createElement('div');
    el.className = 'tax-app-toast';
    var ok = false;
    var err = false;
    var ms;
    if (typeof opts === 'boolean') {
      ok = opts;
    } else if (opts && typeof opts === 'object') {
      ok = !!opts.ok;
      err = !!opts.error;
      ms = opts.ms;
    }
    if (ok) el.className += ' is-ok';
    if (err) el.className += ' is-err';
    el.textContent = msg;
    host.appendChild(el);
    requestAnimationFrame(function () {
      el.classList.add('is-on');
    });
    setTimeout(function () {
      el.classList.remove('is-on');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    }, durationMs(ms));
  }

  function alertBox(text) {
    toast(text, { error: false });
  }

  global.TaxAppUI = {
    toast: toast,
    alert: alertBox,
    durationMs: durationMs
  };
})(window);
