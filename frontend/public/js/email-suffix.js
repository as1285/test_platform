/**
 * 邮箱后缀快捷按钮：只补 @qq.com / @163.com，不根据手机号编造地址。
 * 注册页、支付页、转化引导、个人信息共用。
 */
(function (global) {
  var DEFAULT_SUFFIXES = [
    { suffix: '@qq.com', label: '@qq.com' },
    { suffix: '@163.com', label: '@163.com' }
  ];

  function normalizeSuffix(suffix) {
    var s = suffix == null ? '' : String(suffix).trim().toLowerCase();
    if (!s) return '';
    if (s.charAt(0) !== '@') s = '@' + s;
    return s;
  }

  function emailLocalPart(raw) {
    var s = raw == null ? '' : String(raw).trim();
    if (!s) return '';
    var at = s.indexOf('@');
    if (at < 0) return s;
    return s.slice(0, at).trim();
  }

  /**
   * 保留 @ 前的本地部分，替换或补上指定后缀。
   * 空输入会得到 "@qq.com"（校验仍会失败，需用户再填 QQ 号）。
   */
  function applyEmailDomainSuffix(raw, suffix) {
    var domain = normalizeSuffix(suffix);
    if (!domain) return raw == null ? '' : String(raw);
    return emailLocalPart(raw) + domain;
  }

  function isValidUserEmail(raw) {
    var s = raw == null ? '' : String(raw).trim();
    if (!s || s.length > 255) return false;
    if (/\s/.test(s) || s.indexOf('..') >= 0) return false;
    var at = s.lastIndexOf('@');
    if (at <= 0 || at !== s.indexOf('@')) return false;
    var local = s.slice(0, at);
    var domain = s.slice(at + 1);
    if (local.length < 1 || local.length > 64) return false;
    if (domain.length < 4 || domain.length > 253) return false;
    if (local.length === 1) {
      if (!/^[A-Za-z0-9]$/.test(local)) return false;
    } else if (!/^[A-Za-z0-9][A-Za-z0-9._%+-]{0,62}[A-Za-z0-9]$/.test(local)) {
      return false;
    }
    var labels = domain.split('.');
    if (labels.length < 2) return false;
    for (var i = 0; i < labels.length; i++) {
      var lab = labels[i];
      if (!lab || lab.length > 63) return false;
      if (i === labels.length - 1) {
        if (!/^[A-Za-z]{2,24}$/.test(lab)) return false;
      } else if (lab.length === 1) {
        if (!/^[A-Za-z0-9]$/.test(lab)) return false;
      } else if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,61}[A-Za-z0-9]$/.test(lab)) {
        return false;
      }
    }
    var localKey = local.toLowerCase();
    var domainKey = domain.toLowerCase();
    var blockLocal = {
      test: 1,
      asdf: 1,
      qwer: 1,
      abc: 1,
      abcd: 1,
      aaa: 1,
      aaaa: 1,
      xxx: 1,
      xxxx: 1,
      email: 1,
      mail: 1,
      none: 1,
      null: 1,
      undefined: 1,
      '123': 1,
      '1234': 1,
      '12345': 1,
      '123456': 1
    };
    var blockDomain = {
      'example.com': 1,
      'example.org': 1,
      'example.net': 1,
      'test.com': 1,
      'test.cn': 1,
      'test.org': 1,
      'asdf.com': 1,
      'aaa.com': 1,
      'xxx.com': 1,
      localhost: 1,
      invalid: 1,
      localdomain: 1
    };
    if (blockLocal[localKey] || blockDomain[domainKey]) return false;
    if (localKey.length <= 3 && labels[0].toLowerCase() === localKey) return false;
    return true;
  }

  function applyToInput(input, suffix) {
    if (!input) return '';
    var next = applyEmailDomainSuffix(input.value, suffix);
    input.value = next;
    try {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e1) {}
    try {
      input.focus();
      var localLen = emailLocalPart(next).length;
      if (typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(localLen, localLen);
      }
    } catch (e2) {}
    return next;
  }

  function wireEmailSuffixChips(chipsEl, input) {
    if (!chipsEl || !input || chipsEl.getAttribute('data-email-suffix-bound') === '1') {
      return chipsEl;
    }
    chipsEl.setAttribute('data-email-suffix-bound', '1');
    chipsEl.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t && t.closest) t = t.closest('[data-email-suffix]');
      var suf = t && t.getAttribute ? t.getAttribute('data-email-suffix') : '';
      if (!suf) return;
      ev.preventDefault();
      applyToInput(input, suf);
    });
    return chipsEl;
  }

  function bindEmailSuffixChips(input, opts) {
    opts = opts || {};
    if (!input) return null;
    var existing = opts.chipsEl || null;
    if (!existing && input.parentNode) {
      var sib = input.nextElementSibling;
      if (sib && sib.classList && sib.classList.contains('email-suffix-chips')) {
        existing = sib;
      }
    }
    if (existing) return wireEmailSuffixChips(existing, input);
    var wrap = document.createElement('div');
    wrap.className = opts.className || 'email-suffix-chips';
    var list = opts.suffixes || DEFAULT_SUFFIXES;
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var suffix = typeof item === 'string' ? item : item.suffix;
      var label = typeof item === 'string' ? item : item.label || suffix;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'email-suffix-chip';
      btn.setAttribute('data-email-suffix', normalizeSuffix(suffix));
      btn.textContent = label;
      wrap.appendChild(btn);
    }
    if (input.parentNode) {
      if (input.nextSibling) {
        input.parentNode.insertBefore(wrap, input.nextSibling);
      } else {
        input.parentNode.appendChild(wrap);
      }
    }
    return wireEmailSuffixChips(wrap, input);
  }

  global.EmailSuffix = {
    applyEmailDomainSuffix: applyEmailDomainSuffix,
    emailLocalPart: emailLocalPart,
    isValidUserEmail: isValidUserEmail,
    applyToInput: applyToInput,
    wireEmailSuffixChips: wireEmailSuffixChips,
    bindEmailSuffixChips: bindEmailSuffixChips
  };
})(typeof window !== 'undefined' ? window : this);
