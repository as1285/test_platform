/**
 * 稳健剪贴板复制：Clipboard API → textarea + execCommand → Cordova 插件。
 * 供广告页「一键复制微信号」等场景复用；仅在全部失败时 reject。
 */
(function (global) {
  'use strict';

  function normalizeText(text) {
    return String(text == null ? '' : text);
  }

  function tryClipboardApi(text) {
    if (!global.navigator || !global.navigator.clipboard) {
      return Promise.reject(new Error('no_clipboard_api'));
    }
    if (typeof global.navigator.clipboard.writeText !== 'function') {
      return Promise.reject(new Error('no_clipboard_writeText'));
    }
    try {
      return Promise.resolve(global.navigator.clipboard.writeText(text));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function tryExecCommandCopy(text) {
    return new Promise(function (resolve, reject) {
      var doc = global.document;
      if (!doc || !doc.body) {
        reject(new Error('no_document'));
        return;
      }
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.setAttribute('aria-hidden', 'true');
      /* iOS / WebView：需在视口内、可 focus，勿用 display:none */
      ta.style.cssText =
        'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;margin:0;' +
        'border:none;outline:none;box-shadow:none;background:transparent;opacity:0;';
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
      try {
        doc.body.removeChild(ta);
      } catch (eRm) {}
      if (ok) resolve();
      else reject(new Error('execCommand_copy_failed'));
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
        /* cordova-clipboard / ionic-plugin-clipboard：copy(text, success, error) */
        if (clip !== global.Clipboard) {
          clip.copy(text, done, fail);
          return;
        }
        /* 少数同步 Clipboard.copy(text) */
        clip.copy(text);
        done();
      } catch (e) {
        fail(e);
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

    return tryClipboardApi(t).catch(function () {
      return tryExecCommandCopy(t);
    }).catch(function () {
      return tryCordovaCopy(t);
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
    tryCordovaCopy: tryCordovaCopy
  };
})(typeof window !== 'undefined' ? window : globalThis);
