/**
 * 用户转化引导（P0–P5）：注册/激活/填税动线、价值确认、留存轻触达。
 * 依赖 auth.js（authFetch、trackUserAction）。
 */
(function () {
  var ONBOARD_ACTIVATE = 'activate';
  var ONBOARD_TAX = 'tax';
  var SMART_GUIDE_KEY = 'cg_smart_guide_dismissed';
  var INCOME_VISIT_KEY = 'cg_income_visit_count';
  var DETAIL_EMPTY_VISIT_KEY = 'cg_detail_empty_visits';
  var DETAIL_RECOVERY_DISMISS_KEY = 'cg_detail_recovery_dismissed';
  var MAINT_MSG_DISMISS_KEY = 'cg_maint_msg_dismissed';
  var ABOUT_NUDGE_DISMISS_KEY = 'cg_about_nudge_dismissed';
  var CAPTURE_AUTO_HIDE_KEY = 'cg_capture_auto_hide';
  var SCREENSHOT_MODE_KEY = 'cg_screenshot_mode';
  var CAPTURE_HIDE_CLASS = 'cg-capture-hide';
  var SCREENSHOT_MODE_CLASS = 'cg-screenshot-mode';
  var captureHideTimer = null;
  var conversionCfg = null;

  function getToastDurationMs() {
    var ms =
      typeof window !== 'undefined' && window.TOAST_DURATION_MS != null
        ? Number(window.TOAST_DURATION_MS)
        : 3000;
    return isNaN(ms) || ms <= 0 ? 3000 : ms;
  }

  function loadConversionConfig() {
    var headers = {};
    if (typeof getClientDeviceHeaders === 'function') {
      headers = getClientDeviceHeaders();
    }
    return fetch('/api/public/conversion-config', { credentials: 'same-origin', headers: headers })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (j.code === 200 && j.data) {
          conversionCfg = j.data;
        }
      })
      .catch(function () {});
  }

  function applyActivateModalCopy() {
    if (!conversionCfg || conversionCfg.enabled === false) return;
    var titleEl = document.getElementById('mineActivateModalTitle');
    var subEl = document.getElementById('mineActivateModalSubtitle');
    if (titleEl && conversionCfg.activate_title) {
      titleEl.textContent = conversionCfg.activate_title;
    }
    if (subEl && conversionCfg.activate_subtitle) {
      subEl.textContent = conversionCfg.activate_subtitle;
      subEl.style.display = 'block';
    }
    track('track_conversion_ab_variant', { variant: conversionCfg.variant || 'a', page: currentPage() });
  }

  function getBatchExampleProminent() {
    return !!(conversionCfg && conversionCfg.batch_example_prominent);
  }

  function applyConsultBatchUi() {
    if (currentPage() !== 'consult.html' || !getBatchExampleProminent()) return;
    if (typeof applyConsultBatchAbUi === 'function') {
      applyConsultBatchAbUi();
    }
  }

  function bumpIncomeBrowseVisit() {
    if (!isLoggedIn() || skipConversionPromo() || hasTaxRecords()) return;
    var page = currentPage();
    if (page !== 'shuiming.html' && page !== 'shouye.html') return;
    var n = 0;
    try {
      n = parseInt(localStorage.getItem(INCOME_VISIT_KEY) || '0', 10) || 0;
      n += 1;
      localStorage.setItem(INCOME_VISIT_KEY, String(n));
    } catch (e) {}
    if (n >= 2) {
      try {
        if (localStorage.getItem(SMART_GUIDE_KEY) === '1') return;
        localStorage.setItem(SMART_GUIDE_KEY, '1');
      } catch (e2) {
        return;
      }
      track('track_conversion_smart_guide_shown', { page: page, visits: n });
      setTimeout(function () {
        if (
          window.confirm(
            '您已多次查看收入相关页面，但尚未添加税务记录。\n\n点「确定」前往示例填写（约 30 秒），生成后即可在收入纳税明细查看。'
          )
        ) {
          track('track_conversion_smart_guide_confirm', { page: page });
          goFillTaxRecords();
        } else {
          track('track_conversion_smart_guide_cancel', { page: page });
        }
      }, 600);
    }
  }

  function noviceTaskProgressPct() {
    if (!isAccountActive()) return 0;
    var done = 1 + (employerCount() > 0 ? 1 : 0) + (hasTaxRecords() ? 1 : 0);
    return Math.round((done / 3) * 100);
  }

  function currentPage() {
    var p = window.location.pathname || '';
    var i = p.lastIndexOf('/');
    return (i >= 0 ? p.slice(i + 1) : p) || 'index.html';
  }

  function urlParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || '';
    } catch (e) {
      return '';
    }
  }

  function isLoggedIn() {
    try {
      return !!(localStorage.getItem('token') || '');
    } catch (e) {
      return false;
    }
  }

  function isAccountActive() {
    try {
      return localStorage.getItem('account_active') === '1';
    } catch (e) {
      return false;
    }
  }

  function taxRecordCount() {
    try {
      return Math.max(0, Number(localStorage.getItem('tax_record_count') || '0') || 0);
    } catch (e) {
      return 0;
    }
  }

  function employerCount() {
    try {
      return Math.max(0, Number(localStorage.getItem('employer_count') || '0') || 0);
    } catch (e) {
      return 0;
    }
  }

  function hasTaxRecords() {
    return taxRecordCount() > 0;
  }

  /** 已激活账号不再展示转化引导条/卡片/弹窗（仅保留未激活时的激活引导与点击门禁） */
  function skipConversionPromo() {
    return isAccountActive();
  }

  function removeActivationPromoUi() {
    [
      'cg-shouye-tax-entry',
      'cg-shouye-retention',
      'cg-shuiming-hint',
      'cg-care-hint',
      'cg-about-nudge',
      'cg-detail-recovery-toast'
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function goActivate() {
    window.location.href = 'mine.html?onboarding=' + ONBOARD_ACTIVATE;
  }

  function goFillTaxRecords() {
    window.location.href = 'consult.html?tab=records&onboarding=' + ONBOARD_TAX;
  }

  function goManageTaxRecords() {
    window.location.href = 'consult.html?tab=records';
  }

  function goIncomeDetail(year) {
    var y = year || new Date().getFullYear();
    try {
      var sy = localStorage.getItem('selected_year');
      if (sy) y = sy;
    } catch (e) {}
    window.location.href = 'shuiming_result.html?year=' + encodeURIComponent(String(y));
  }

  function track(action, meta) {
    if (typeof window.trackUserAction === 'function') {
      window.trackUserAction(action, meta || {});
    }
  }

  function fetchProfileCounts() {
    if (!isLoggedIn() || typeof authFetch !== 'function') {
      return Promise.resolve();
    }
    return authFetch('api/user.php?action=info')
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data.code !== 200 || !data.data) return;
        var u = data.data;
        if (u.account_active !== undefined && u.account_active !== null) {
          var active = u.account_active === true || u.account_active === 1 || u.account_active === '1';
          localStorage.setItem('account_active', active ? '1' : '0');
          if (active) {
            removeActivationPromoUi();
          }
        }
        if (u.tax_record_count != null) {
          localStorage.setItem('tax_record_count', String(Number(u.tax_record_count) || 0));
        }
        if (u.employer_count != null) {
          localStorage.setItem('employer_count', String(Number(u.employer_count) || 0));
        }
        renderMineTaskCard();
      })
      .catch(function () {});
  }

  function ensureGateStyles() {
    if (document.getElementById('conversion-guide-styles')) return;
    var st = document.createElement('style');
    st.id = 'conversion-guide-styles';
    st.textContent =
      '.cg-task-card .cg-btn{display:inline-block;padding:8px 14px;border-radius:8px;font-size:13px;text-decoration:none;border:none;cursor:pointer;font-family:inherit}' +
      '.cg-task-card .cg-btn-primary{background:#1e6fff;color:#fff}' +
      '.cg-task-card{margin:0 16px 12px;padding:12px 14px;background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.06)}' +
      '.page-mine .content-wrapper > .user-card{position:relative;z-index:1}' +
      '.cg-task-card h4{margin:0 0 8px;font-size:14px;color:#333}' +
      '.cg-task-progress{margin:8px 0 10px;height:6px;background:#eef2f8;border-radius:3px;overflow:hidden}' +
      '.cg-task-progress>span{display:block;height:100%;background:#1e6fff;border-radius:3px;transition:width .25s}' +
      '.cg-task-progress-label{font-size:12px;color:#888;margin-bottom:8px}' +
      '.cg-task-steps{margin:0;padding:0;list-style:none}' +
      '.cg-task-steps li{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;color:#555;border-bottom:1px solid #f0f0f0}' +
      '.cg-task-steps li:last-child{border-bottom:none}' +
      '.cg-task-dot{width:18px;height:18px;border-radius:50%;border:2px solid #ccc;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px}' +
      '.cg-task-steps li.done .cg-task-dot{border-color:#1e6fff;background:#1e6fff;color:#fff}' +
      '.cg-task-steps li.done{color:#333}' +
      '.cg-panel-gate{padding:16px;margin:12px 0;background:#fff8e6;border:1px solid #ffe0a3;border-radius:10px;font-size:14px;color:#664d03;line-height:1.5}' +
      '.cg-panel-gate .cg-btn{margin-top:10px}' +
      '.cg-empty-cta{margin-top:16px;text-align:center}' +
      '.cg-empty-cta .cg-btn-primary{display:inline-block;padding:10px 20px;background:#1e6fff;color:#fff;border-radius:8px;text-decoration:none;font-size:15px}' +
      '.cg-empty-cta p{margin:0 0 10px;font-size:13px;color:#888}' +
      '.cg-toast-recovery{position:fixed;left:12px;right:12px;bottom:calc(72px + env(safe-area-inset-bottom,0px));z-index:800;padding:12px 14px;background:#fff8e6;border:1px solid #ffe0a3;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.12);font-size:13px;color:#664d03;line-height:1.45}' +
      '.cg-toast-recovery .cg-actions{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}' +
      '.cg-value-overlay{position:fixed;inset:0;z-index:900;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px}' +
      '.cg-value-panel{max-width:340px;width:100%;background:#fff;border-radius:12px;padding:18px 16px}' +
      '.cg-value-panel h3{margin:0 0 8px;font-size:17px;color:#333}' +
      '.cg-value-panel p{margin:0 0 14px;font-size:13px;color:#666;line-height:1.5}' +
      '.cg-value-panel .cg-btn{display:block;width:100%;margin-bottom:8px;padding:11px;border-radius:8px;border:none;font-size:15px;cursor:pointer;font-family:inherit}' +
      '.cg-value-panel .cg-btn-primary{background:#1e6fff;color:#fff}' +
      '.cg-value-panel .cg-btn-ghost{background:#f5f6fa;color:#333}' +
      '.cg-shouye-card{margin:12px 16px 0;padding:12px 14px;background:linear-gradient(135deg,#e8f4ff,#f8fbff);border:1px solid #c5d9f5;border-radius:10px}' +
      '.cg-shouye-card h4{margin:0 0 6px;font-size:15px;color:#333}' +
      '.cg-shouye-card p{margin:0 0 10px;font-size:13px;color:#666;line-height:1.45}' +
      '.cg-shouye-card .cg-btn{display:inline-block;padding:8px 14px;border-radius:8px;font-size:13px;text-decoration:none;border:none;cursor:pointer;font-family:inherit}' +
      '.cg-shouye-card .cg-btn-primary{background:#1e6fff;color:#fff}' +
      '.cg-inline-hint{margin:12px 16px;padding:10px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:13px;color:#9a3412;line-height:1.45}' +
      '.cg-about-nudge{margin:12px 16px;padding:12px;background:#eef6ff;border-radius:10px;font-size:13px;color:#333;line-height:1.5}' +
      '.cg-about-nudge a{color:#1e6fff;font-weight:600}' +
      'html.' +
      CAPTURE_HIDE_CLASS +
      ' #mineTaxEntryLink,html.' +
      SCREENSHOT_MODE_CLASS +
      ' #mineTaxEntryLink,html.' +
      CAPTURE_HIDE_CLASS +
      ' #cg-shouye-tax-entry,html.' +
      SCREENSHOT_MODE_CLASS +
      ' #cg-shouye-tax-entry,html.' +
      CAPTURE_HIDE_CLASS +
      ' #cg-about-nudge,html.' +
      SCREENSHOT_MODE_CLASS +
      ' #cg-about-nudge,html.' +
      CAPTURE_HIDE_CLASS +
      ' .message-item[data-cg-demo-maint="1"],html.' +
      SCREENSHOT_MODE_CLASS +
      ' .message-item[data-cg-demo-maint="1"],html.' +
      SCREENSHOT_MODE_CLASS +
      ' #cgMineScreenshotBar,html.' +
      SCREENSHOT_MODE_CLASS +
      ' #mineActivateBtn,html.' +
      SCREENSHOT_MODE_CLASS +
      ' #cg-mine-task-card,html.' +
      SCREENSHOT_MODE_CLASS +
      ' #cg-shouye-retention{display:none!important}' +
      '.cg-capture-toast{position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:1000020;padding:10px 16px;background:rgba(0,0,0,.82);color:#fff;font-size:13px;line-height:1.45;border-radius:10px;opacity:0;pointer-events:none;transition:opacity .2s;max-width:92vw;text-align:center;white-space:pre-line;box-shadow:0 4px 16px rgba(0,0,0,.2)}' +
      '.cg-capture-toast.is-show{opacity:1}' +
      '.cg-capture-toast.is-tap-dismiss{pointer-events:auto;cursor:pointer}';
    document.head.appendChild(st);
  }

  function isCaptureAutoHideEnabled() {
    try {
      return localStorage.getItem(CAPTURE_AUTO_HIDE_KEY) !== '0';
    } catch (e) {
      return true;
    }
  }

  function isScreenshotModeOn() {
    try {
      return sessionStorage.getItem(SCREENSHOT_MODE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  var CONSULT_MENU_LABEL_NORMAL = '我要咨询';
  var CONSULT_MENU_LABEL_SCREENSHOT = '我要咨询';

  function syncScreenshotModeClass() {
    document.documentElement.classList.toggle(SCREENSHOT_MODE_CLASS, isScreenshotModeOn());
    syncConsultMenuScreenshotLabel();
  }

  function syncConsultMenuScreenshotLabel() {
    var link = document.getElementById('consultModifyLink');
    if (!link) return;
    var text = link.querySelector('.menu-text');
    if (!text) return;
    if (!text.getAttribute('data-cg-menu-normal')) {
      var cur = (text.textContent || '').trim();
      text.setAttribute(
        'data-cg-menu-normal',
        cur === CONSULT_MENU_LABEL_SCREENSHOT ? CONSULT_MENU_LABEL_NORMAL : cur || CONSULT_MENU_LABEL_NORMAL
      );
    }
    var normal = text.getAttribute('data-cg-menu-normal') || CONSULT_MENU_LABEL_NORMAL;
    var label = isScreenshotModeOn() ? CONSULT_MENU_LABEL_SCREENSHOT : normal;
    text.textContent = label;
    link.setAttribute('aria-label', label);
  }

  function setScreenshotMode(on) {
    try {
      if (on) sessionStorage.setItem(SCREENSHOT_MODE_KEY, '1');
      else sessionStorage.removeItem(SCREENSHOT_MODE_KEY);
    } catch (e) {}
    syncScreenshotModeClass();
    syncMineScreenshotModeButton();
    track('track_conversion_screenshot_mode', { enabled: !!on, page: currentPage() });
    showCaptureToast(
      on ? '演示入口已全部隐藏，可截屏录屏\n长按头像可恢复' : '截图模式已关闭，演示入口已恢复',
      { duration: getToastDurationMs(), tapDismiss: on }
    );
  }

  function syncMineScreenshotModeButton() {
    var btn = document.getElementById('mineScreenshotModeBtn');
    var label = document.getElementById('mineScreenshotModeLabel');
    var bar = document.getElementById('cgMineScreenshotBar');
    if (!btn || !label) return;
    var on = isScreenshotModeOn();
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? '退出截图模式' : '截图模式');
    label.textContent = on ? '退出截图模式' : '截图模式';
    if (bar) bar.classList.toggle('is-active', on);
  }

  function toggleScreenshotMode() {
    setScreenshotMode(!isScreenshotModeOn());
  }

  function showCaptureToast(msg, opts) {
    opts = opts || {};
    var el = document.getElementById('cg-capture-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cg-capture-toast';
      el.className = 'cg-capture-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg || '';
    el.classList.toggle('is-tap-dismiss', !!(opts.tapDismiss && isScreenshotModeOn()));
    el.onclick = null;
    if (opts.tapDismiss && isScreenshotModeOn()) {
      el.onclick = function () {
        setScreenshotMode(false);
      };
    }
    el.classList.add('is-show');
    if (showCaptureToast._t) clearTimeout(showCaptureToast._t);
    showCaptureToast._t = setTimeout(function () {
      el.classList.remove('is-show');
      el.classList.remove('is-tap-dismiss');
      el.onclick = null;
    }, opts.duration != null ? opts.duration : getToastDurationMs());
  }

  function hideDemoUiForCapture(ms) {
    if (!isCaptureAutoHideEnabled() && !isScreenshotModeOn()) return;
    if (isScreenshotModeOn()) return;
    var html = document.documentElement;
    html.classList.add(CAPTURE_HIDE_CLASS);
    if (captureHideTimer) clearTimeout(captureHideTimer);
    captureHideTimer = setTimeout(function () {
      html.classList.remove(CAPTURE_HIDE_CLASS);
      captureHideTimer = null;
    }, ms || 6000);
  }

  function restoreCaptureHiddenUi() {
    document.documentElement.classList.remove(CAPTURE_HIDE_CLASS);
    if (captureHideTimer) {
      clearTimeout(captureHideTimer);
      captureHideTimer = null;
    }
  }

  function bindLongPressScreenshotToggle(el) {
    if (!el || el.getAttribute('data-cg-screenshot-toggle') === '1') return;
    el.setAttribute('data-cg-screenshot-toggle', '1');
    var timer = null;
    function clearTimer() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
    function startPress() {
      clearTimer();
      timer = setTimeout(function () {
        timer = null;
        toggleScreenshotMode();
      }, 1200);
    }
    el.addEventListener('touchstart', startPress, { passive: true });
    el.addEventListener('touchend', clearTimer);
    el.addEventListener('touchcancel', clearTimer);
    el.addEventListener('touchmove', clearTimer);
    el.addEventListener('mousedown', startPress);
    el.addEventListener('mouseup', clearTimer);
    el.addEventListener('mouseleave', clearTimer);
  }

  function bindMineScreenshotModeUi() {
    if (currentPage() !== 'mine.html') return;
    if (isAccountActive()) return;
    if (document.body.getAttribute('data-cg-screenshot-ui') === '1') return;
    document.body.setAttribute('data-cg-screenshot-ui', '1');
    syncMineScreenshotModeButton();
    var btn = document.getElementById('mineScreenshotModeBtn');
    if (btn && btn.getAttribute('data-cg-screenshot-btn') !== '1') {
      btn.setAttribute('data-cg-screenshot-btn', '1');
      btn.addEventListener('click', function () {
        toggleScreenshotMode();
      });
    }
    bindLongPressScreenshotToggle(document.getElementById('headerImg'));
  }

  function initCapturePrivacy() {
    if (window.__cgCapturePrivacyBound) return;
    window.__cgCapturePrivacyBound = true;
    ensureGateStyles();
    syncScreenshotModeClass();

    function onCaptureSignal() {
      hideDemoUiForCapture(6000);
    }

    window.addEventListener('blur', onCaptureSignal);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) onCaptureSignal();
      else restoreCaptureHiddenUi();
    });
    window.addEventListener('focus', restoreCaptureHiddenUi);
    window.addEventListener('pagehide', onCaptureSignal);
    ['user-capture-screen', 'screenshot', 'screenrecordstart', 'screen-capture'].forEach(function (name) {
      document.addEventListener(name, onCaptureSignal);
      window.addEventListener(name, onCaptureSignal);
    });
    window.onUserCaptureScreen = onCaptureSignal;
    window.onScreenRecordStart = onCaptureSignal;

    var lastH = window.innerHeight;
    window.addEventListener('resize', function () {
      if (!isCaptureAutoHideEnabled()) return;
      var dh = Math.abs(window.innerHeight - lastH);
      lastH = window.innerHeight;
      if (dh > 0 && dh < 80) onCaptureSignal();
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindMineScreenshotModeUi);
    } else {
      bindMineScreenshotModeUi();
    }
  }

  function showGateAlert(title, message, primaryLabel, primaryFn) {
    ensureGateStyles();
    var msg = (title ? title + '\n\n' : '') + (message || '');
    if (primaryFn && window.confirm(msg + '\n\n点击「确定」' + (primaryLabel || '继续'))) {
      primaryFn();
    }
  }

  function gateActivation(featureName) {
    track('track_conversion_gate_activate', { page: currentPage(), feature: featureName || '' });
    showGateAlert(
      '需要激活账号',
      '该功能需先输入激活码开通。您可先浏览首页与「我的」，激活后即可' +
        (featureName ? '使用「' + featureName + '」' : '填写个税演示数据') +
        '。',
      '去激活',
      goActivate
    );
    return false;
  }

  function gateTaxRecords(featureName) {
    if (!hasTaxRecords()) {
      track('track_conversion_gate_tax', { page: currentPage(), feature: featureName || '' });
      showGateAlert(
        '尚未添加个税记录',
        '请先在「我要咨询」或首页「管理税务数据」中添加记录，也可在税务记录中「示例填写」或「一键生成」。',
        '去添加',
        goFillTaxRecords
      );
      return false;
    }
    return true;
  }

  function removeMineConversionUi() {
    var el = document.getElementById('cg-mine-task-card');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    var legacyBar = document.getElementById('cg-mine-onboard-bar');
    if (legacyBar && legacyBar.parentNode) legacyBar.parentNode.removeChild(legacyBar);
    if (document.body) {
      document.body.classList.add('mine-account-active');
    }
  }

  function getMineBottomExtrasEl() {
    return document.getElementById('mineBottomExtras');
  }

  function renderMineTaskCard() {
    if (currentPage() !== 'mine.html') return;
    if (isAccountActive()) {
      removeMineConversionUi();
      return;
    }
    var anchor = getMineBottomExtrasEl();
    if (!anchor) return;
    var existing = document.getElementById('cg-mine-task-card');
    if (!existing) {
      ensureGateStyles();
      existing = document.createElement('div');
      existing.id = 'cg-mine-task-card';
      existing.className = 'cg-task-card';
      anchor.insertBefore(existing, anchor.firstChild);
    }
    var done = hasTaxRecords() ? 1 : 0;
    var pct = Math.round((done / 3) * 100);
    existing.innerHTML =
      '<h4>新手任务</h4>' +
      '<div class="cg-task-progress-label">完成进度 ' +
      done +
      '/3（激活后自动隐藏本卡片）</div>' +
      '<div class="cg-task-progress"><span style="width:' +
      pct +
      '%"></span></div>' +
      '<ul class="cg-task-steps">' +
      '<li class="' +
      (done >= 1 ? 'done' : '') +
      '"><span class="cg-task-dot">1</span><span>添加个税记录</span></li>' +
      '<li><span class="cg-task-dot">2</span><span>激活账号</span></li>' +
      '<li><span class="cg-task-dot">3</span><span>添加任职受雇（可选）</span></li>' +
      '</ul>' +
      '<div style="margin-top:8px;"><button type="button" class="cg-btn cg-btn-primary" id="cgTaskActivate">去激活</button></div>';
    var b = document.getElementById('cgTaskActivate');
    if (b) {
      b.addEventListener('click', function () {
        var ab = document.getElementById('mineActivateBtn');
        if (ab) ab.click();
      });
    }
  }

  function runMineOnboarding() {
    if (currentPage() !== 'mine.html') return;
    renderMineTaskCard();
    if (urlParam('onboarding') !== ONBOARD_ACTIVATE || isAccountActive()) return;
    track('track_conversion_onboard_activate', { page: 'mine' });
    setTimeout(function () {
      var btn = document.getElementById('mineActivateBtn');
      if (btn && btn.offsetParent !== null) btn.click();
      else {
        var root = document.getElementById('mineActivateModal');
        if (root) root.classList.add('is-open');
      }
    }, 400);
  }

  function injectConsultRecordsGate() {
    /* 未激活仅展示水印，不限制税务记录填写与批量生成 */
    var gate = document.getElementById('cg-consult-records-gate');
    if (gate && gate.parentNode) gate.parentNode.removeChild(gate);
    var panel = document.getElementById('panel-records');
    if (!panel) return;
    var submitBtn = document.getElementById('batch_submit_employments_btn');
    if (submitBtn) submitBtn.disabled = false;
    var toolbar = panel.querySelector('.batch-tax-toolbar');
    if (toolbar) {
      toolbar.querySelectorAll('button, input, select, textarea').forEach(function (el) {
        el.disabled = false;
      });
    }
  }

  function runConsultOnboarding() {
    if (currentPage() !== 'consult.html') return;
    injectConsultRecordsGate();
    if (urlParam('onboarding') !== ONBOARD_TAX) return;
    track('track_conversion_onboard_tax', { page: 'consult' });
    if (typeof switchTab === 'function') {
      try {
        switchTab('records', false);
      } catch (e) {}
    }
    setTimeout(function () {
      var panel = document.getElementById('panel-records');
      if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      if (!hasTaxRecords() && typeof fillBatchTaxExample === 'function') {
        try {
          fillBatchTaxExample();
        } catch (e2) {}
      }
    }, 500);
  }

  function patchShuimingResultEmpty() {
    if (currentPage() !== 'shuiming_result.html') return;
    var orig = window.getNoRecordsHtml;
    if (typeof orig !== 'function' || orig.__cgPatched) return;
    function patched() {
      var html = orig();
      if (document.getElementById('cg-empty-cta-injected')) return html;
      ensureGateStyles();
      var cta = '';
      if (!isAccountActive()) {
        cta =
          '<div class="cg-empty-cta" id="cg-empty-cta-injected"><p>激活后可添加个税演示数据</p>' +
          '<a href="mine.html?onboarding=activate" class="cg-btn-primary">去激活</a></div>';
      } else if (!skipConversionPromo() && !hasTaxRecords()) {
        cta =
          '<div class="cg-empty-cta" id="cg-empty-cta-injected"><p>添加税务记录后即可查看本页明细</p>' +
          '<a href="consult.html?tab=records&onboarding=tax" class="cg-btn-primary">去添加税务记录</a></div>';
      }
      return html + cta;
    }
    patched.__cgPatched = true;
    window.getNoRecordsHtml = patched;
  }

  function afterActivateSuccess() {
    track('track_conversion_activate_success', { page: currentPage() });
    removeMineConversionUi();
    removeActivationPromoUi();
    try {
      sessionStorage.setItem('cg_post_activate', '1');
    } catch (e) {}
    setTimeout(function () {
      window.location.href = 'consult.html?tab=records&onboarding=' + ONBOARD_TAX;
    }, 300);
  }

  function goNajilu() {
    window.location.href = 'najilu.html';
  }

  function showValueConfirmDialog(year) {
    if (document.getElementById('cg-value-overlay')) return;
    ensureGateStyles();
    track('track_conversion_value_confirm_shown', { page: 'consult' });
    var ov = document.createElement('div');
    ov.id = 'cg-value-overlay';
    ov.className = 'cg-value-overlay';
    ov.innerHTML =
      '<div class="cg-value-panel" role="dialog" aria-labelledby="cgValueTitle">' +
      '<h3 id="cgValueTitle">演示数据已生成</h3>' +
      '<p>可立即查看收入纳税明细或纳税记录开具效果。如需继续添加或修改，请点下方「管理税务数据」。</p>' +
      '<p style="font-size:12px;color:#999;margin-bottom:12px;">返回首页后，可在首页提示条或「我的 → 税务演示数据」再次进入。</p>' +
      '<p style="font-size:12px;color:#999;margin-bottom:12px;">本应用为界面演示与学习参考，非官方申报渠道。</p>' +
      '<button type="button" class="cg-btn cg-btn-primary" id="cgValueGoDetail">查看收入纳税明细</button>' +
      '<button type="button" class="cg-btn cg-btn-primary" id="cgValueGoNajilu" style="background:#008afd;">纳税记录开具</button>' +
      '<button type="button" class="cg-btn cg-btn-ghost" id="cgValueGoManage" style="border:1px solid #1e6fff;color:#1e6fff;background:#fff;">管理税务数据</button>' +
      '<button type="button" class="cg-btn cg-btn-ghost" id="cgValueLater">稍后再说</button>' +
      '</div>';
    document.body.appendChild(ov);
    function closeOv(action) {
      track('track_conversion_value_confirm_' + action, { page: 'consult' });
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }
    document.getElementById('cgValueGoDetail').onclick = function () {
      closeOv('detail');
      goIncomeDetail(year);
    };
    document.getElementById('cgValueGoNajilu').onclick = function () {
      closeOv('najilu');
      goNajilu();
    };
    document.getElementById('cgValueGoManage').onclick = function () {
      closeOv('manage');
      goManageTaxRecords();
    };
    document.getElementById('cgValueLater').onclick = function () {
      closeOv('later');
    };
    ov.addEventListener('click', function (e) {
      if (e.target === ov) closeOv('dismiss');
    });
  }

  function afterTaxRecordsCreated() {
    track('track_conversion_tax_created', { page: 'consult' });
    var y = new Date().getFullYear();
    try {
      var sy = localStorage.getItem('selected_year');
      if (sy) y = Number(sy) || y;
    } catch (e) {}
    setTimeout(function () {
      showValueConfirmDialog(y);
    }, 400);
  }

  function afterEmployerSaved(meta) {
    if (!isAccountActive() || skipConversionPromo()) return;
    track('track_conversion_employer_saved_nudge', meta || {});
    setTimeout(function () {
      if (
        window.confirm(
          '任职信息已保存。\n\n是否前往「税务记录」生成对应月份的纳税演示数据？'
        )
      ) {
        track('track_conversion_employer_nudge_confirm', meta || {});
        goFillTaxRecords();
      } else {
        track('track_conversion_employer_nudge_cancel', meta || {});
      }
    }, 350);
  }

  function onIncomeDetailEmpty() {
    if (skipConversionPromo() || hasTaxRecords()) return;
    var n = 0;
    try {
      n = parseInt(localStorage.getItem(DETAIL_EMPTY_VISIT_KEY) || '0', 10) || 0;
      n += 1;
      localStorage.setItem(DETAIL_EMPTY_VISIT_KEY, String(n));
    } catch (e) {}
    track('track_conversion_detail_empty_visit', { visits: n });
    if (n < 2) return;
    try {
      if (localStorage.getItem(DETAIL_RECOVERY_DISMISS_KEY) === '1') return;
    } catch (e2) {
      return;
    }
    showDetailRecoveryToast();
  }

  function showDetailRecoveryToast() {
    if (document.getElementById('cg-detail-recovery-toast')) return;
    ensureGateStyles();
    track('track_conversion_detail_recovery_shown', {});
    var el = document.createElement('div');
    el.id = 'cg-detail-recovery-toast';
    el.className = 'cg-toast-recovery';
    el.innerHTML =
      '<div>您已多次查看收入明细，但尚未添加税务记录。请先在「我要咨询」生成演示数据。</div>' +
      '<div class="cg-actions">' +
      '<button type="button" class="cg-btn cg-btn-primary" id="cgRecoveryGoTax">去添加记录</button>' +
      '<button type="button" class="cg-btn cg-btn-ghost" id="cgRecoveryDismiss">不再提示</button></div>';
    document.body.appendChild(el);
    document.getElementById('cgRecoveryGoTax').onclick = function () {
      track('track_conversion_detail_recovery_confirm', {});
      goFillTaxRecords();
    };
    document.getElementById('cgRecoveryDismiss').onclick = function () {
      track('track_conversion_detail_recovery_dismiss', {});
      try {
        localStorage.setItem(DETAIL_RECOVERY_DISMISS_KEY, '1');
      } catch (e) {}
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }

  function renderShuimingHint() {
    if (currentPage() !== 'shuiming.html') return;
    if (!isLoggedIn() || skipConversionPromo() || hasTaxRecords()) return;
    if (document.getElementById('cg-shuiming-hint')) return;
    ensureGateStyles();
    var header = document.querySelector('.header');
    if (!header || !header.parentNode) return;
    var hint = document.createElement('div');
    hint.id = 'cg-shuiming-hint';
    hint.className = 'cg-inline-hint';
    hint.innerHTML =
      '暂无个税演示数据。建议先在 <strong>我要咨询 → 示例填写</strong> 一键生成，再查询本页明细。' +
      '<div style="margin-top:8px;"><button type="button" class="cg-btn cg-btn-primary" id="cgShuimingGoTax" style="padding:8px 14px;font-size:13px;">去添加税务记录</button></div>';
    header.parentNode.insertBefore(hint, header.nextSibling);
    var btn = document.getElementById('cgShuimingGoTax');
    if (btn) {
      btn.onclick = function () {
        track('track_conversion_shuiming_hint_click', {});
        goFillTaxRecords();
      };
    }
  }

  function removeLegacyShouyeRetentionCard() {
    var legacy = document.getElementById('cg-shouye-retention');
    if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);
  }

  function removeShouyeTaxManageEntry() {
    removeLegacyShouyeRetentionCard();
    var card = document.getElementById('cg-shouye-tax-entry');
    if (card && card.parentNode) card.parentNode.removeChild(card);
  }

  function renderShouyeTaxManageEntry() {
    removeShouyeTaxManageEntry();
  }

  function renderShouyeRetentionCard() {
    removeLegacyShouyeRetentionCard();
  }

  function prependMaintenanceMessages(list) {
    var arr = Array.isArray(list) ? list.slice() : [];
    if (!isLoggedIn() || skipConversionPromo()) return arr;
    try {
      if (localStorage.getItem(MAINT_MSG_DISMISS_KEY) === '1') return arr;
    } catch (e) {
      return arr;
    }
    var d = new Date();
    var mo = d.getMonth() + 1;
    var da = d.getDate();
    var dateStr =
      d.getFullYear() + '-' + (mo < 10 ? '0' + mo : String(mo)) + '-' + (da < 10 ? '0' + da : String(da));
    var tip = {
      id: 'cg-demo-maint',
      title: '演示数据维护提醒',
      content: hasTaxRecords()
        ? '您的个税演示数据可随时在「我的 → 税务演示数据」中修改。'
        : '建议在「我的 → 税务演示数据」添加个税演示数据，便于查看收入纳税明细与纳税记录效果。',
      msg_date: dateStr,
      is_read: 0,
      _cg_demo: true
    };
    arr.unshift(tip);
    return arr;
  }

  function bindMaintenanceMessageDismiss(listEl) {
    if (!listEl) return;
    listEl.addEventListener(
      'click',
      function (e) {
        var item = e.target.closest('.message-item');
        if (!item) return;
        var title = item.querySelector('.message-content-title');
        if (!title || title.textContent.indexOf('演示数据维护') < 0) return;
        try {
          localStorage.setItem(MAINT_MSG_DISMISS_KEY, '1');
        } catch (err) {}
        track('track_conversion_maint_msg_read', {});
      },
      true
    );
  }

  function renderAboutUpdateNudge() {
    if (currentPage() !== 'about_update.html') return;
    if (!isLoggedIn() || skipConversionPromo()) return;
    try {
      if (sessionStorage.getItem(ABOUT_NUDGE_DISMISS_KEY) === '1') return;
    } catch (e) {
      return;
    }
    if (document.getElementById('cg-about-nudge')) return;
    ensureGateStyles();
    var brand = document.querySelector('.brand');
    if (!brand || !brand.parentNode) return;
    var box = document.createElement('div');
    box.id = 'cg-about-nudge';
    box.className = 'cg-about-nudge';
    box.innerHTML = hasTaxRecords()
      ? '版本功能已更新。如需补全或调整演示个税数据，请前往 <a href="consult.html?tab=records">我要咨询 · 税务记录</a>。'
      : '欢迎使用。激活并添加税务演示数据后，可体验收入明细与纳税记录开具。 <a href="mine.html?onboarding=activate">去激活</a>';
    brand.parentNode.insertBefore(box, brand.nextSibling);
    track('track_conversion_about_nudge_shown', { has_tax: hasTaxRecords() ? 1 : 0 });
    box.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        try {
          sessionStorage.setItem(ABOUT_NUDGE_DISMISS_KEY, '1');
        } catch (e2) {}
      });
    });
  }

  function renderCareVersionHint() {
    if (currentPage() !== 'care_version.html') return;
    if (!isLoggedIn() || skipConversionPromo() || hasTaxRecords()) return;
    if (document.getElementById('cg-care-hint')) return;
    ensureGateStyles();
    var wrap = document.querySelector('.care-wrap');
    if (!wrap || !wrap.parentNode) return;
    var hint = document.createElement('div');
    hint.id = 'cg-care-hint';
    hint.className = 'cg-inline-hint';
    hint.style.margin = '10px 12px 0';
    hint.innerHTML =
      '关怀版已简化导航。建议先 <a href="consult.html?tab=records&onboarding=tax" style="color:#1e6fff;font-weight:600;">添加税务演示数据</a>，再查看收入明细。';
    wrap.parentNode.insertBefore(hint, wrap);
    track('track_conversion_care_hint_shown', {});
  }

  function init() {
    initCapturePrivacy();
    bindMineScreenshotModeUi();
    if (!isLoggedIn()) return;
    ensureGateStyles();
    loadConversionConfig()
      .then(function () {
        applyActivateModalCopy();
        applyConsultBatchUi();
        return fetchProfileCounts();
      })
      .then(function () {
        if (skipConversionPromo()) {
          removeActivationPromoUi();
        }
        runMineOnboarding();
        runConsultOnboarding();
        patchShuimingResultEmpty();
        renderShouyeTaxManageEntry();
        if (!skipConversionPromo()) {
          bumpIncomeBrowseVisit();
          renderShuimingHint();
          renderAboutUpdateNudge();
          renderCareVersionHint();
        }
      });
  }

  window.ConversionGuide = {
    isAccountActive: isAccountActive,
    hasTaxRecords: hasTaxRecords,
    goActivate: goActivate,
    goFillTaxRecords: goFillTaxRecords,
    goManageTaxRecords: goManageTaxRecords,
    goIncomeDetail: goIncomeDetail,
    goNajilu: goNajilu,
    gateActivation: gateActivation,
    gateTaxRecords: gateTaxRecords,
    removeMineConversionUi: removeMineConversionUi,
    getBatchExampleProminent: getBatchExampleProminent,
    afterActivateSuccess: afterActivateSuccess,
    afterTaxRecordsCreated: afterTaxRecordsCreated,
    afterEmployerSaved: afterEmployerSaved,
    onIncomeDetailEmpty: onIncomeDetailEmpty,
    prependMaintenanceMessages: prependMaintenanceMessages,
    bindMaintenanceMessageDismiss: bindMaintenanceMessageDismiss,
    refresh: fetchProfileCounts,
    hideDemoUiForCapture: hideDemoUiForCapture,
    setScreenshotMode: setScreenshotMode,
    toggleScreenshotMode: toggleScreenshotMode,
    isScreenshotModeOn: isScreenshotModeOn
  };

  initCapturePrivacy();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
