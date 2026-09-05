/**
 * 稳健剪贴板复制（全站共用）：
 * Clipboard API → textarea/contentEditable + execCommand → Cordova 插件 → App 壳 postMessage 桥。
 * 供「一键复制微信号」等场景；仅全部失败时 reject。
 *
 * Cordova APK 用 iframe 加载线上 H5，跨域 iframe 常禁 clipboard-write，
 * 故最后一跳请壳层（父页面）代为写入剪贴板。
 */
(function (global) {
  'use strict';

  var CLIPBOARD_API_TIMEOUT_MS = 900;
  var SHELL_BRIDGE_TIMEOUT_MS = 1600;

  function normalizeText(text) {
    return String(text == null ? '' : text);
  }

  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = global.setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error(label || 'timeout'));
      }, ms);
      Promise.resolve(promise).then(
        function (v) {
          if (settled) return;
          settled = true;
          global.clearTimeout(timer);
          resolve(v);
        },
        function (err) {
          if (settled) return;
          settled = true;
          global.clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  function tryClipboardApi(text) {
    if (!global.navigator || !global.navigator.clipboard) {
      return Promise.reject(new Error('no_clipboard_api'));
    }
    if (typeof global.navigator.clipboard.writeText !== 'function') {
      return Promise.reject(new Error('no_clipboard_writeText'));
    }
    try {
      return withTimeout(
        Promise.resolve(global.navigator.clipboard.writeText(text)),
        CLIPBOARD_API_TIMEOUT_MS,
        'clipboard_api_timeout'
      );
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function removeNode(node) {
    try {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    } catch (eRm) {}
  }

  function tryTextareaExecCommand(text) {
    var doc = global.document;
    if (!doc || !doc.body) return false;
    var ta = doc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.setAttribute('aria-hidden', 'true');
    /* iOS / WebView：需在视口内、可 focus，勿用 display:none / 远负定位 */
    ta.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;margin:0;' +
      'border:none;outline:none;box-shadow:none;background:transparent;opacity:0;z-index:99999;';
    doc.body.appendChild(ta);
    var ok = false;
    try {
      ta.focus();
      ta.select();
      if (typeof ta.setSelectionRange === 'function') {
        ta.setSelectionRange(0, text.length);
      }
      ok = !!(doc.execCommand && doc.execCommand('copy'));
    } catch (e) {
      ok = false;
    }
    removeNode(ta);
    return ok;
  }

  function tryContentEditableExecCommand(text) {
    var doc = global.document;
    if (!doc || !doc.body) return false;
    var el = doc.createElement('div');
    el.contentEditable = 'true';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = text;
    el.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;margin:0;' +
      'border:none;outline:none;opacity:0;z-index:99999;white-space:pre;';
    doc.body.appendChild(el);
    var ok = false;
    try {
      el.focus();
      var range = doc.createRange();
      range.selectNodeContents(el);
      var sel = global.getSelection && global.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      ok = !!(doc.execCommand && doc.execCommand('copy'));
      if (sel) sel.removeAllRanges();
    } catch (e) {
      ok = false;
    }
    removeNode(el);
    return ok;
  }

  function tryExecCommandCopy(text) {
    return new Promise(function (resolve, reject) {
      if (tryTextareaExecCommand(text) || tryContentEditableExecCommand(text)) {
        resolve();
        return;
      }
      reject(new Error('execCommand_copy_failed'));
    });
  }

  function getCordovaClipboard() {
    try {
      if (global.cordova && global.cordova.plugins && global.cordova.plugins.clipboard) {
        return global.cordova.plugins.clipboard;
      }
    } catch (e0) {}
    try {
      if (global.plugins && global.plugins.clipboard) {
        return global.plugins.clipboard;
      }
    } catch (e1) {}
    try {
      if (global.Clipboard && typeof global.Clipboard.copy === 'function') {
        return global.Clipboard;
      }
    } catch (e2) {}
    return null;
  }

  function tryCordovaCopy(text) {
    return new Promise(function (resolve, reject) {
      var clip = getCordovaClipboard();
      if (!clip || typeof clip.copy !== 'function') {
        reject(new Error('no_cordova_clipboard'));
        return;
      }
      var settled = false;
      function done() {
        if (settled) return;
        settled = true;
        resolve();
      }
      function fail(err) {
        if (settled) return;
        settled = true;
        reject(err || new Error('cordova_clipboard_failed'));
      }
      try {
        if (clip !== global.Clipboard) {
          clip.copy(text, done, fail);
          return;
        }
        clip.copy(text);
        done();
      } catch (e) {
        fail(e);
      }
    });
  }

  function inAppShellIframe() {
    try {
      if (global.parent && global.parent !== global) {
        var ua = String((global.navigator && global.navigator.userAgent) || '');
        if (/TaxPlatformCordovaApp/i.test(ua)) return true;
        /* 壳会 postMessage device-hint；即便无 UA，只要确有跨域父页也尝试桥接 */
        try {
          void global.parent.location.href;
          /* 能读到 parent.location → 同源，不是线上壳 iframe */
          return false;
        } catch (cross) {
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function tryShellBridgeCopy(text) {
    return new Promise(function (resolve, reject) {
      if (!inAppShellIframe()) {
        reject(new Error('no_shell_bridge'));
        return;
      }
      var id =
        'clip_' +
        String(Date.now()) +
        '_' +
        Math.random().toString(36).slice(2, 8);
      var settled = false;
      function cleanup() {
        try {
          global.removeEventListener('message', onMsg);
        } catch (e0) {}
        if (timer) global.clearTimeout(timer);
      }
      function finishOk() {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      }
      function finishFail(err) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err || new Error('shell_clipboard_failed'));
      }
      function onMsg(ev) {
        var d = ev && ev.data;
        if (!d || d.source !== 'tax-shell' || d.type !== 'clipboard-copy-result') return;
        if (String(d.id || '') !== id) return;
        if (d.ok) finishOk();
        else finishFail(new Error(d.detail || 'shell_clipboard_failed'));
      }
      var timer = global.setTimeout(function () {
        finishFail(new Error('shell_clipboard_timeout'));
      }, SHELL_BRIDGE_TIMEOUT_MS);
      try {
        global.addEventListener('message', onMsg);
        global.parent.postMessage(
          {
            source: 'tax-platform-h5',
            type: 'clipboard-copy',
            id: id,
            text: text
          },
          '*'
        );
      } catch (e) {
        finishFail(e);
      }
    });
  }

  /**
   * @param {string} text
   * @returns {Promise<void>} 成功 resolve；全部方式失败才 reject
   */
  function copyTextRobust(text) {
    var t = normalizeText(text);
    if (!t) return Promise.reject(new Error('empty'));

    return tryClipboardApi(t)
      .catch(function () {
        return tryExecCommandCopy(t);
      })
      .catch(function () {
        return tryCordovaCopy(t);
      })
      .catch(function () {
        return tryShellBridgeCopy(t);
      });
  }

  /**
   * 与 auth.js 兼容的布尔结果版：成功 true，失败 false（不 throw）
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  function copyTextToClipboard(text) {
    return copyTextRobust(text).then(
      function () {
        return true;
      },
      function () {
        return false;
      }
    );
  }

  global.copyTextRobust = copyTextRobust;
  /* 若 auth 尚未挂载，先提供可用实现；auth 加载后可覆盖，但应同样稳健 */
  if (typeof global.copyTextToClipboard !== 'function') {
    global.copyTextToClipboard = copyTextToClipboard;
  }
  global.__clipboardCopy = {
    copyTextRobust: copyTextRobust,
    copyTextToClipboard: copyTextToClipboard,
    tryClipboardApi: tryClipboardApi,
    tryExecCommandCopy: tryExecCommandCopy,
    tryCordovaCopy: tryCordovaCopy,
    tryShellBridgeCopy: tryShellBridgeCopy
  };
})(typeof window !== 'undefined' ? window : globalThis);
