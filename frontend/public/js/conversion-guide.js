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
  var ABOUT_NUDGE_DISMISS_KEY = 'cg_about_nudge_dismissed';
  var ACT_NUDGE_DAY_KEY = 'cg_act_nudge_day_v1';
  var ACT_NUDGE_COUNT_KEY = 'cg_act_nudge_count_v1';
  var TAX_FILL_NUDGE_DAY_KEY = 'cg_tax_fill_nudge_day_v1';
  var TAX_FILL_BANNER_DISMISS_KEY = 'cg_tax_fill_banner_dismiss_day_v1';
  var hoursSinceRegisterCached = 0;
  var DEMO_DISCLAIMER =
    '本应用为界面演示与学习参考，非官方申报渠道。请勿用于正式申报或对外证明。';
  var EDIT_HINT = '数据可随时在「我要咨询 → 税务记录」中修改或补充。';
  var CAPTURE_AUTO_HIDE_KEY = 'cg_capture_auto_hide';
  var SCREENSHOT_MODE_KEY = 'cg_screenshot_mode';
  var CAPTURE_HIDE_CLASS = 'cg-capture-hide';
  var SCREENSHOT_MODE_CLASS = 'cg-screenshot-mode';
  var TAX_EDIT_MODE_KEY = 'cg_tax_edit_mode';
  var TAX_EDIT_OFF_CLASS = 'cg-tax-edit-off';
  var PROFILE_CACHE_KEY = 'cg_profile_summary_v2';
  var PROFILE_CACHE_TTL_MS = 3 * 60 * 1000;
  /** 纯展示 Tab：不阻塞首屏，延后拉用户摘要 */
  var LIGHT_SHELL_PAGES = {
    'daiban.html': true,
    'bancha.html': true,
    'message.html': true
  };
  var captureHideTimer = null;
  var conversionCfg = null;
  var profileFetchInFlight = null;

  function normalizeTaxYearLocal(raw) {
    if (typeof globalThis !== 'undefined' && typeof globalThis.normalizeTaxYear === 'function') {
      return globalThis.normalizeTaxYear(raw);
    }
    var minY = 1900;
    var now = new Date().getFullYear();
    var maxY = now && !isNaN(now) && now >= minY ? now : minY;
    var defY = maxY;
    var y = parseInt(String(raw == null ? '' : raw).trim(), 10);
    if (!y || isNaN(y) || y < minY || y > maxY) return defY;
    return y;
  }

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
    if (!isLoggedIn() || hasTaxRecords()) return;
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
      setTimeout(function () {
        if (
          window.confirm(
            '您已多次查看收入相关页面，但尚未添加税务记录。\n\n点「确定」前往示例填写（约 30 秒），生成后即可在收入纳税明细查看。'
          )
        ) {
          goFillTaxRecords();
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

  function isLandingGuest() {
    try {
      return localStorage.getItem('landing_guest_v1') === '1';
    } catch (e) {
      return false;
    }
  }

  function goGuestDownloadSave(source) {
    track('track_landing_guest_activate_download', {
      page: currentPage(),
      landing_variant: 'c',
      source: source || 'post_tax',
      tax_count: taxRecordCount()
    });
    if (typeof window.trackPublicAction === 'function') {
      window.trackPublicAction('track_landing_guest_activate_download', {
        page: currentPage(),
        landing_variant: 'c',
        source: source || 'post_tax',
        tax_count: taxRecordCount()
      });
    }
    window.location.href = 'mine.html?guest_dl=1';
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
    /* 已激活用户仍需保留「添加个税」强提示；此处只清激活营销类 UI */
    ['cg-shuiming-hint', 'cg-care-hint', 'cg-about-nudge', 'cg-detail-recovery-toast'].forEach(
      function (id) {
        var el = document.getElementById(id);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
    );
  }

  function goActivate() {
    try {
      if (localStorage.getItem('landing_guest_v1') === '1') {
        var taxN = taxRecordCount();
        track('track_landing_guest_activate_download', {
          page: currentPage(),
          landing_variant: 'c',
          source: 'conversion_guide',
          tax_count: taxN
        });
        if (typeof window.trackPublicAction === 'function') {
          window.trackPublicAction('track_landing_guest_activate_download', {
            page: currentPage(),
            landing_variant: 'c',
            source: 'conversion_guide',
            tax_count: taxN
          });
        }
        // 有填写记录时回「我的」弹价值引导；否则直达下载页
        if (taxN > 0 && currentPage() !== 'mine.html') {
          window.location.href = 'mine.html?guest_dl=1';
          return;
        }
        if (typeof window.trackShareDownloadClick === 'function') {
          window.trackShareDownloadClick('conversion_guide');
        }
        window.location.href = 'install_guide.html?download=1#download';
        return;
      }
    } catch (e) {}
    window.location.href = 'purchase.html';
  }

  function ensureTaxEditForFill() {
    if (isTaxEditModeOn()) return true;
    /* 尚未有个税时，引导填写应自动打开编辑，避免点了 CTA 又回到「我的」 */
    if (!hasTaxRecords()) {
      try {
        localStorage.removeItem(TAX_EDIT_MODE_KEY);
      } catch (e) {}
      syncTaxEditModeClass();
      return true;
    }
    notifyProfileEditLocked();
    return false;
  }

  function goFillTaxRecords() {
    if (!ensureTaxEditForFill()) {
      window.location.href = 'mine.html';
      return;
    }
    window.location.href = 'consult.html?tab=records&onboarding=' + ONBOARD_TAX;
  }

  function goManageTaxRecords() {
    if (!ensureTaxEditForFill()) {
      window.location.href = 'mine.html';
      return;
    }
    window.location.href = 'consult.html?tab=records';
  }

  function goIncomeDetail(year) {
    var y = normalizeTaxYearLocal(year);
    try {
      var sy = localStorage.getItem('selected_year');
      if (sy) y = normalizeTaxYearLocal(sy);
    } catch (e) {}
    window.location.href = 'shuiming_result.html?year=' + encodeURIComponent(String(y));
  }

  function track(action, meta) {
    if (typeof window.trackUserAction === 'function') {
      window.trackUserAction(action, meta || {});
    }
  }

  function isLightShellPage() {
    return !!LIGHT_SHELL_PAGES[currentPage()];
  }

  function applyProfileSummary(u) {
    if (!u || typeof u !== 'object') return;
    if (u.account_active !== undefined && u.account_active !== null) {
      var active = u.account_active === true || u.account_active === 1 || u.account_active === '1';
      try {
        localStorage.setItem('account_active', active ? '1' : '0');
      } catch (e0) {}
      if (active) {
        removeActivationPromoUi();
      }
    }
    if (u.tax_record_count != null) {
      try {
        localStorage.setItem('tax_record_count', String(Number(u.tax_record_count) || 0));
      } catch (e1) {}
    }
    if (u.employer_count != null) {
      try {
        localStorage.setItem('employer_count', String(Number(u.employer_count) || 0));
      } catch (e2) {}
    }
    if (u.hours_since_register != null) {
      hoursSinceRegisterCached = Number(u.hours_since_register) || 0;
    }
    removeMineConversionUi();
  }

  function readProfileCache() {
    try {
      var raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.t || Date.now() - o.t > PROFILE_CACHE_TTL_MS) return null;
      return o;
    } catch (e) {
      return null;
    }
  }

  function writeProfileCache(u) {
    if (!u || typeof u !== 'object') return;
    try {
      sessionStorage.setItem(
        PROFILE_CACHE_KEY,
        JSON.stringify({
          t: Date.now(),
          account_active: u.account_active,
          tax_record_count: u.tax_record_count,
          employer_count: u.employer_count,
          hours_since_register: u.hours_since_register
        })
      );
    } catch (e) {}
  }

  function fetchProfileCounts(opts) {
    opts = opts || {};
    if (!isLoggedIn() || typeof window.authFetch !== 'function') {
      return Promise.resolve();
    }
    var cached = readProfileCache();
    if (cached && !opts.force) {
      /* v2 起弹窗依赖 hours_since_register；旧缓存缺字段时强制刷新 */
      if (cached.hours_since_register == null) {
        opts = Object.assign({}, opts, { force: true });
      } else {
        applyProfileSummary(cached);
        return Promise.resolve();
      }
    }
    if (profileFetchInFlight && !opts.force) {
      return profileFetchInFlight;
    }
    profileFetchInFlight = window.authFetch('api/user?action=summary')
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data.code !== 200 || !data.data) return;
        applyProfileSummary(data.data);
        writeProfileCache(data.data);
      })
      .catch(function () {})
      .then(function () {
        profileFetchInFlight = null;
      });
    return profileFetchInFlight;
  }

  function ensureGateStyles() {
    if (document.getElementById('conversion-guide-styles')) return;
    var st = document.createElement('style');
    st.id = 'conversion-guide-styles';
    st.textContent =
      '.cg-panel-gate{padding:16px;margin:12px 0;background:#fff8e6;border:1px solid #ffe0a3;border-radius:10px;font-size:14px;color:#664d03;line-height:1.5}' +
      '.cg-panel-gate .cg-btn{margin-top:10px}' +
      '.cg-empty-cta{margin-top:16px;text-align:center}' +
      '.cg-empty-cta .cg-btn-primary{display:inline-block;padding:10px 20px;background:#1e6fff;color:#fff;border-radius:8px;text-decoration:none;font-size:15px}' +
      '.cg-empty-cta p{margin:0 0 10px;font-size:13px;color:#888}' +
      '.cg-toast-recovery{position:fixed;left:12px;right:12px;bottom:calc(72px + env(safe-area-inset-bottom,0px));z-index:800;padding:12px 14px;background:#fff8e6;border:1px solid #ffe0a3;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.12);font-size:13px;color:#664d03;line-height:1.45}' +
      '.cg-toast-recovery .cg-actions{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}' +
      '.cg-value-overlay{position:fixed;inset:0;z-index:10200;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}' +
      '.cg-value-panel{max-width:340px;width:100%;max-height:min(86vh,640px);overflow-y:auto;-webkit-overflow-scrolling:touch;background:#fff;border-radius:12px;padding:18px 16px;box-sizing:border-box}' +
      '.cg-value-panel h3{margin:0 0 8px;font-size:17px;color:#333}' +
      '.cg-value-panel p{margin:0 0 14px;font-size:13px;color:#666;line-height:1.5}' +
      '.cg-value-panel .cg-btn{display:block;width:100%;margin-bottom:8px;padding:11px;border-radius:8px;border:none;font-size:15px;cursor:pointer;font-family:inherit}' +
      '.cg-value-panel .cg-btn-primary{background:#1e6fff;color:#fff}' +
      '.cg-value-panel .cg-btn-ghost{background:#f5f6fa;color:#333}' +
      '.cg-help-qq-card{margin:12px 16px 0;padding:14px;background:#eefbf6;border:1px solid #b7ebdc;border-radius:10px}' +
      '.cg-help-qq-card h4{margin:0 0 6px;font-size:15px;color:#333}' +
      '.cg-help-qq-card p{margin:0 0 10px;font-size:13px;color:#666;line-height:1.45}' +
      '.cg-help-qq-card .cg-btn{display:inline-block;padding:8px 14px;border-radius:8px;font-size:13px;border:none;cursor:pointer;font-family:inherit;background:#12b886;color:#fff;text-decoration:none}' +
      '.cg-about-qq-row{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;min-height:48px;border-bottom:1px solid #f0f0f0;background:#fff;font-size:16px;color:#333;-webkit-tap-highlight-color:transparent;cursor:pointer}' +
      '.cg-about-qq-row:active{background:#f7f7f7}' +
      '.cg-about-qq-row .cg-sub{font-size:13px;color:#8e8e93;margin-top:2px}' +
      '.cg-shouye-card{margin:12px 16px 0;padding:12px 14px;background:linear-gradient(135deg,#e8f4ff,#f8fbff);border:1px solid #c5d9f5;border-radius:10px}' +
      '.cg-shouye-card.is-tax-strong{margin:10px 12px 0;padding:14px 14px 12px;background:linear-gradient(135deg,#fff4e5,#fffaf2);border:2px solid #ff9500;box-shadow:0 4px 16px rgba(255,149,0,.18);position:relative}' +
      '.cg-shouye-card.is-tax-strong h4{margin:0 0 6px;font-size:16px;font-weight:700;color:#c2410c}' +
      '.cg-shouye-card.is-tax-strong p{margin:0 0 12px;font-size:13px;color:#9a3412;line-height:1.5}' +
      '.cg-shouye-card h4{margin:0 0 6px;font-size:15px;color:#333}' +
      '.cg-shouye-card p{margin:0 0 10px;font-size:13px;color:#666;line-height:1.45}' +
      '.cg-shouye-card .cg-btn{display:inline-block;padding:8px 14px;border-radius:8px;font-size:13px;text-decoration:none;border:none;cursor:pointer;font-family:inherit}' +
      '.cg-shouye-card .cg-btn-primary{background:#1e6fff;color:#fff}' +
      '.cg-shouye-card.is-tax-strong .cg-btn-primary{display:block;width:100%;padding:12px 14px;font-size:15px;font-weight:700;background:#ff9500;border-radius:10px;animation:cgTaxPulse 1.6s ease-in-out infinite}' +
      '.cg-shouye-card .cg-btn-outline{display:inline-block;padding:8px 14px;border-radius:8px;font-size:13px;text-decoration:none;border:1px solid #1e6fff;color:#1e6fff;background:#fff;margin-left:8px}' +
      '.cg-mine-tax-banner{margin:0 0 10px;padding:14px 14px 12px;background:linear-gradient(135deg,#fff4e5,#fffaf2);border:2px solid #ff9500;border-radius:12px;box-shadow:0 4px 16px rgba(255,149,0,.16);position:relative;z-index:30}' +
      '.cg-mine-tax-banner h4{margin:0 0 6px;font-size:16px;font-weight:700;color:#c2410c}' +
      '.cg-mine-tax-banner p{margin:0 0 12px;font-size:13px;color:#9a3412;line-height:1.5}' +
      '.cg-mine-tax-banner .cg-btn-primary{display:block;width:100%;padding:12px 14px;border:none;border-radius:10px;background:#ff9500;color:#fff;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;animation:cgTaxPulse 1.6s ease-in-out infinite}' +
      '.cg-mine-tax-banner .cg-dismiss{position:absolute;top:8px;right:10px;border:none;background:transparent;color:#c2410c;font-size:12px;padding:4px 6px;cursor:pointer;font-family:inherit;opacity:.75}' +
      '@keyframes cgTaxPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(255,149,0,.35)}50%{transform:scale(1.02);box-shadow:0 0 0 6px rgba(255,149,0,0)}}' +
      '.cg-consult-tax-banner{margin:0 0 12px;padding:12px 14px;background:linear-gradient(135deg,#fff4e5,#fffaf2);border:2px solid #ff9500;border-radius:10px}' +
      '.cg-consult-tax-banner strong{display:block;font-size:15px;color:#c2410c;margin:0 0 4px}' +
      '.cg-consult-tax-banner span{font-size:13px;color:#9a3412;line-height:1.45}' +
      '.cg-value-bar{position:fixed;left:0;right:0;bottom:0;z-index:850;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));background:#fff;border-top:1px solid #e8e8e8;box-shadow:0 -2px 12px rgba(0,0,0,.06)}' +
      '.cg-value-bar .cg-disclaimer{margin:0 0 8px;font-size:11px;color:#999;line-height:1.45}' +
      '.cg-value-bar .cg-edit-hint{margin:0 0 10px;font-size:12px;color:#666;line-height:1.45}' +
      '.cg-value-bar .cg-actions{display:flex;gap:8px}' +
      '.cg-value-bar .cg-btn{flex:1;padding:10px 8px;border-radius:8px;border:none;font-size:14px;cursor:pointer;font-family:inherit}' +
      '.cg-value-bar .cg-btn-primary{background:#1e6fff;color:#fff}' +
      '.cg-value-bar .cg-btn-ghost{background:#f5f6fa;color:#333;border:1px solid #ddd}' +
      'body.cg-has-value-bar .page-root{padding-bottom:calc(120px + env(safe-area-inset-bottom,0px))}' +
      'body.cg-has-value-bar .list{padding-bottom:calc(120px + env(safe-area-inset-bottom,0px))}' +
      'body.cg-has-value-bar .preview-page{padding-bottom:calc(120px + env(safe-area-inset-bottom,0px))}' +
      '.cg-act-nudge-root{position:fixed;inset:0;z-index:920;display:flex;align-items:center;justify-content:center;padding:20px}' +
      '.cg-act-nudge-mask{position:absolute;inset:0;background:rgba(0,0,0,.45)}' +
      '.cg-act-nudge-panel{position:relative;z-index:1;width:100%;max-width:320px;background:#fff;border-radius:12px;padding:22px 20px 18px;box-shadow:0 8px 32px rgba(0,0,0,.12)}' +
      '.cg-act-nudge-title{margin:0 0 10px;font-size:17px;font-weight:600;color:#333;text-align:center}' +
      '.cg-act-nudge-body{margin:0;font-size:14px;line-height:1.65;color:#555;text-align:center;white-space:pre-wrap}' +
      '.cg-act-nudge-actions{display:flex;flex-direction:column;gap:10px;margin-top:18px}' +
      '.cg-act-nudge-btn{display:block;width:100%;height:44px;border:none;border-radius:8px;font-size:16px;font-family:inherit;-webkit-tap-highlight-color:transparent;cursor:pointer}' +
      '.cg-act-nudge-btn.primary{background:#1e6fff;color:#fff}' +
      '.cg-act-nudge-btn.secondary{background:#f5f6fa;color:#666}' +
      '.cg-inline-hint{margin:12px 16px;padding:10px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:13px;color:#9a3412;line-height:1.45}' +
      'body.page-shuiming > .content > #cg-shuiming-hint{margin:10px 16px 0;}' +
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
      ' #cgMineScreenshotBar,html.' +
      SCREENSHOT_MODE_CLASS +
      ' #cgMineScreenshotBar,html.' +
      SCREENSHOT_MODE_CLASS +
      ' #mineActivateBtn,html.' +
      SCREENSHOT_MODE_CLASS +
      ' #cg-mine-task-card,html.' +
      SCREENSHOT_MODE_CLASS +
      ' #cg-shouye-retention{display:none!important}' +
      'html.' +
      SCREENSHOT_MODE_CLASS +
      ' #cg-value-action-bar,html.' +
      CAPTURE_HIDE_CLASS +
      ' #cg-value-action-bar{display:none!important}' +
      /* 演示/修改入口：截图模式与录屏隐私自动隐藏；关闭数据编辑时一并隐藏 */
      'html.' +
      SCREENSHOT_MODE_CLASS +
      ' .cg-demo-only,html.' +
      CAPTURE_HIDE_CLASS +
      ' .cg-demo-only,html.' +
      TAX_EDIT_OFF_CLASS +
      ' .cg-demo-edit-entry{display:none!important}' +
      '.cg-detail-edit-entry{margin:20px 16px 28px;padding:0;text-align:center;font-size:13px;color:#999;line-height:1.5}' +
      '.cg-detail-edit-entry a{color:#1e6fff;text-decoration:none;-webkit-tap-highlight-color:transparent}' +
      '.cg-detail-edit-entry a:active{opacity:.7}' +
      '.cg-capture-toast{position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:1000020;padding:10px 16px;background:rgba(0,0,0,.82);color:#fff;font-size:13px;line-height:1.45;border-radius:10px;opacity:0;pointer-events:none;transition:opacity .2s;max-width:92vw;text-align:center;white-space:pre-line;box-shadow:0 4px 16px rgba(0,0,0,.2)}' +
      '.cg-capture-toast.is-show{opacity:1}' +
      '.cg-capture-toast.is-tap-dismiss{pointer-events:auto;cursor:pointer}' +
      'html.' +
      TAX_EDIT_OFF_CLASS +
      ' #consultModifyHint{display:none!important}';
    document.head.appendChild(st);
  }

  function notifyProfileEditLocked() {
    showCaptureToast('数据编辑已关闭\n连续点击头像5次可重新开启', {
      duration: getToastDurationMs()
    });
  }

  function isTaxEditModeOn() {
    try {
      return localStorage.getItem(TAX_EDIT_MODE_KEY) !== '0';
    } catch (e) {
      return true;
    }
  }

  function syncTaxEditModeClass() {
    document.documentElement.classList.toggle(TAX_EDIT_OFF_CLASS, !isTaxEditModeOn());
    syncConsultModifyEditGate();
  }

  function syncConsultModifyEditGate() {
    var link = document.getElementById('consultModifyLink');
    if (!link) return;
    link.setAttribute('data-cg-tax-edit-gated', isTaxEditModeOn() ? '0' : '1');
    var hint = document.getElementById('consultModifyHint');
    if (hint && !isTaxEditModeOn()) {
      hint.setAttribute('hidden', '');
    }
  }

  function setTaxEditMode(on) {
    try {
      if (on) localStorage.removeItem(TAX_EDIT_MODE_KEY);
      else localStorage.setItem(TAX_EDIT_MODE_KEY, '0');
    } catch (e) {}
    syncTaxEditModeClass();
    if (currentPage() === 'mine.html') {
      showCaptureToast(
        on
          ? '数据编辑已开启\n可通过「我要咨询」修改个税数据'
          : '数据编辑已关闭\n连续点击头像5次可重新开启',
        { duration: getToastDurationMs() }
      );
    }
    try {
      window.dispatchEvent(new CustomEvent('cgTaxEditModeChange', { detail: { on: !!on } }));
    } catch (e2) {}
  }

  function toggleTaxEditMode() {
    if (!toggleTaxEditMode._lastAt) toggleTaxEditMode._lastAt = 0;
    var now = Date.now();
    if (now - toggleTaxEditMode._lastAt < 400) return;
    toggleTaxEditMode._lastAt = now;
    setTaxEditMode(!isTaxEditModeOn());
  }

  var taxEditTapCount = 0;
  var taxEditTapResetTimer = null;
  var taxEditLastPhysicalTapAt = 0;
  var TAX_EDIT_TAP_REQUIRED = 5;
  var TAX_EDIT_TAP_WINDOW_MS = 1000;

  function registerTaxEditTap(e) {
    if (window.__cgScreenshotLongPress) {
      window.__cgScreenshotLongPress = false;
      return;
    }
    if (e && e.target && e.target.closest && e.target.closest('#mineActivateBtn')) {
      return;
    }
    var now = Date.now();
    if (now - taxEditLastPhysicalTapAt < 80) return;
    taxEditLastPhysicalTapAt = now;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    taxEditTapCount += 1;
    if (taxEditTapResetTimer) clearTimeout(taxEditTapResetTimer);
    if (taxEditTapCount >= TAX_EDIT_TAP_REQUIRED) {
      taxEditTapCount = 0;
      taxEditTapResetTimer = null;
      toggleTaxEditMode();
      return;
    }
    taxEditTapResetTimer = setTimeout(function () {
      taxEditTapCount = 0;
      taxEditTapResetTimer = null;
    }, TAX_EDIT_TAP_WINDOW_MS);
  }

  function initTaxEditPageGuard() {
    if (currentPage() !== 'consult.html') return;
    if (isTaxEditModeOn()) return;
    window.location.replace('mine.html');
  }

  function bindAvatarTaxEditToggle(el) {
    if (!el || el.getAttribute('data-cg-tax-edit-toggle') === '1') return;
    el.setAttribute('data-cg-tax-edit-toggle', '1');
    el.style.cursor = 'pointer';
    el.style.webkitTouchCallout = 'none';
    el.style.webkitUserSelect = 'none';
    var touchStartAt = 0;
    var touchMoved = false;
    var MAX_TAP_MS = 520;

    function onShortTap(e) {
      if (e && e.target && e.target.closest && e.target.closest('#mineActivateBtn')) {
        return;
      }
      var dt = Date.now() - touchStartAt;
      if (touchMoved || dt > MAX_TAP_MS) return;
      registerTaxEditTap(e);
    }

    el.addEventListener(
      'touchstart',
      function () {
        touchStartAt = Date.now();
        touchMoved = false;
      },
      { passive: true }
    );
    el.addEventListener(
      'touchmove',
      function () {
        touchMoved = true;
      },
      { passive: true }
    );
    el.addEventListener('touchend', function (e) {
      window.__cgLastTouchTapAt = Date.now();
      onShortTap(e);
    });
    el.addEventListener('click', function (e) {
      if (window.__cgLastTouchTapAt && Date.now() - window.__cgLastTouchTapAt < 500) return;
      registerTaxEditTap(e);
    });
  }

  function bindMineTaxEditAvatar() {
    if (currentPage() !== 'mine.html') return;
    if (document.body.getAttribute('data-cg-tax-edit-ui') === '1') return;
    document.body.setAttribute('data-cg-tax-edit-ui', '1');
    bindAvatarTaxEditToggle(document.getElementById('headerImg'));
    bindAvatarTaxEditToggle(document.getElementById('mineAvatarEditHit'));
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
    var text =
      document.getElementById('consultModifyMenuText') || link.querySelector('.menu-text');
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
        window.__cgScreenshotLongPress = true;
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

  function bindMinePageSecretGestures() {
    bindMineTaxEditAvatar();
    bindMineScreenshotModeUi();
  }

  function initCapturePrivacy() {
    if (window.__cgCapturePrivacyBound) return;
    window.__cgCapturePrivacyBound = true;
    ensureGateStyles();
    syncScreenshotModeClass();
    syncTaxEditModeClass();
    initTaxEditPageGuard();

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
      document.addEventListener('DOMContentLoaded', bindMinePageSecretGestures);
    } else {
      bindMinePageSecretGestures();
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
    if (isLandingGuest()) {
      showGateAlert(
        '下载 App 后可用',
        '游客模式可先体验基础功能。下载 App 并注册后，可将已填写资料同步保存' +
          (featureName ? '，再使用「' + featureName + '」' : '') +
          '。',
        '去下载',
        goActivate
      );
      return false;
    }
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
    var fillCard = document.getElementById('cg-guest-fill-card');
    if (fillCard && fillCard.parentNode) fillCard.parentNode.removeChild(fillCard);
    var seededHint = document.getElementById('cg-guest-seeded-hint');
    if (seededHint && seededHint.parentNode) seededHint.parentNode.removeChild(seededHint);
    if (document.body) {
      document.body.classList.add('mine-account-active');
    }
  }

  function runMineOnboarding() {
    if (currentPage() !== 'mine.html') return;
    removeMineConversionUi();
    syncMineConsultEntryForTax();
    /* 正式用户无个税：用顶部强提示条，不再走游客卡片 */
    if (!isLandingGuest()) {
      if (!hasTaxRecords()) {
        renderMineTaxStrongPrompt();
      }
      return;
    }
    /* 已自动示例个税：改为短提示 + 引导下载，不再挡「去填写」 */
    if (hasTaxRecords()) {
      if (document.getElementById('cg-guest-seeded-hint')) return;
      ensureGateStyles();
      var hint = document.createElement('div');
      hint.id = 'cg-guest-seeded-hint';
      hint.className = 'cg-inline-hint';
      hint.style.cssText =
        'margin:0 16px 12px;padding:12px 14px;border-radius:10px;background:#f0f6ff;border:1px solid #d6e6ff;';
      hint.innerHTML =
        '<div style="font-size:14px;font-weight:600;color:#1e6fff;margin:0 0 6px;">已为你生成示例个税</div>' +
        '<p style="margin:0 0 10px;font-size:13px;color:#555;line-height:1.45;">可到「收入纳税明细」查看。下载 App 并注册后，这些资料可同步到正式账号。</p>' +
        '<button type="button" class="cg-btn cg-btn-primary" id="cgGuestSeededDlBtn" style="width:100%;">下载 App 带走资料</button>';
      var wrapH = document.querySelector('.content-wrapper');
      if (wrapH) {
        wrapH.insertBefore(hint, wrapH.firstChild);
      } else {
        return;
      }
      track('track_landing_guest_seeded_hint_show', { page: 'mine' });
      var dlBtn = document.getElementById('cgGuestSeededDlBtn');
      if (dlBtn) {
        dlBtn.onclick = function () {
          track('track_landing_guest_seeded_hint_ok', { page: 'mine' });
          if (typeof window.trackPublicAction === 'function') {
            window.trackPublicAction('track_landing_guest_activate_download', {
              page: 'mine',
              landing_variant: 'c',
              source: 'seeded_hint',
              tax_count: taxRecordCount()
            });
          }
          window.location.href = 'install_guide.html?download=1#download';
        };
      }
      return;
    }
    if (document.getElementById('cg-guest-fill-card')) return;
    ensureGateStyles();
    var card = document.createElement('div');
    card.id = 'cg-guest-fill-card';
    card.className = 'cg-inline-hint';
    card.style.cssText = 'margin:0 16px 12px;padding:12px 14px;border-radius:10px;background:#f0f6ff;border:1px solid #d6e6ff;';
    card.innerHTML =
      '<div style="font-size:14px;font-weight:600;color:#1e6fff;margin:0 0 6px;">先体验填写（约 30 秒）</div>' +
      '<p style="margin:0 0 10px;font-size:13px;color:#555;line-height:1.45;">用示例生成几条个税记录，再下载 App，注册后可同步带走。</p>' +
      '<button type="button" class="cg-btn cg-btn-primary" id="cgGuestFillTaxBtn" style="width:100%;">示例填写个税</button>';
    var wrap = document.querySelector('.content-wrapper');
    if (wrap) {
      wrap.insertBefore(card, wrap.firstChild);
    } else {
      return;
    }
    track('track_landing_guest_fill_card_show', { page: 'mine' });
    if (typeof window.trackPublicAction === 'function') {
      window.trackPublicAction('track_landing_guest_fill_card_show', {
        page: 'mine',
        landing_variant: 'c'
      });
    }
    var btn = document.getElementById('cgGuestFillTaxBtn');
    if (btn) {
      btn.onclick = function () {
        track('track_landing_guest_fill_card_ok', { page: 'mine' });
        if (typeof window.trackPublicAction === 'function') {
          window.trackPublicAction('track_landing_guest_fill_card_ok', {
            page: 'mine',
            landing_variant: 'c'
          });
        }
        goFillTaxRecords();
      };
    }
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

  function buildShuimingEmptyFillCtaHtml() {
    if (hasTaxRecords()) return '';
    ensureGateStyles();
    if (isLandingGuest()) {
      return (
        '<div class="cg-empty-cta" id="cg-empty-cta-injected"><p>游客可先示例填写个税，再下载 App 带走资料</p>' +
        '<a href="consult.html?tab=records&onboarding=tax" class="cg-btn-primary">示例填写个税</a></div>'
      );
    }
    /* 未激活也可填写（仅水印）；顶部已有「立即激活」卡，空态主推填写引导 */
    var tip = isAccountActive()
      ? '添加税务记录后即可查看本页明细'
      : '暂无个税演示数据。可先示例填写（约 30 秒），激活后可去水印并体验完税证明';
    return (
      '<div class="cg-empty-cta" id="cg-empty-cta-injected"><p>' +
      tip +
      '</p>' +
      '<a href="consult.html?tab=records&onboarding=tax" class="cg-btn-primary">示例填写个税</a></div>'
    );
  }

  function patchShuimingResultEmpty() {
    if (currentPage() !== 'shuiming_result.html') return;
    var orig = window.getNoRecordsHtml;
    if (typeof orig !== 'function') return;
    if (orig.__cgPatched) return;
    var unpatched = orig;
    function patched() {
      var html = unpatched();
      if (html.indexOf('cg-empty-cta-injected') >= 0) return html;
      return html + buildShuimingEmptyFillCtaHtml();
    }
    patched.__cgPatched = true;
    patched.__cgOrig = unpatched;
    window.getNoRecordsHtml = patched;
  }

  /** 列表常先于 conversion-guide 渲染：引导脚本就绪后补打空态填写 CTA */
  function refreshShuimingResultEmptyCta() {
    if (currentPage() !== 'shuiming_result.html') return;
    if (hasTaxRecords()) return;
    patchShuimingResultEmpty();
    if (document.getElementById('cg-empty-cta-injected')) return;
    var list = document.getElementById('recordList');
    if (!list) return;
    if (list.querySelector('.list-item')) return;
    if (list.querySelector('.list-loading-spin')) return;
    if (typeof window.getNoRecordsHtml !== 'function') return;
    list.innerHTML = window.getNoRecordsHtml();
    var root = document.querySelector('.page-root');
    if (root) root.classList.add('is-record-empty');
    if (typeof window.syncTopFixedHeight === 'function') {
      try {
        window.syncTopFixedHeight();
      } catch (e) {}
    }
  }

  function afterActivateSuccess() {
    track('track_conversion_activate_success', { page: currentPage() });
    removeMineConversionUi();
    removeActivationPromoUi();
    setTimeout(function () {
      window.location.href = 'activate_success.html';
    }, 300);
  }

  function goNajilu() {
    window.location.href = 'najilu.html';
  }

  function showValueConfirmDialog(year) {
    if (document.getElementById('cg-value-overlay')) return;
    ensureGateStyles();
    var guest = isLandingGuest();
    var ov = document.createElement('div');
    ov.id = 'cg-value-overlay';
    ov.className = 'cg-value-overlay';
    ov.innerHTML =
      '<div class="cg-value-panel" role="dialog" aria-labelledby="cgValueTitle">' +
      '<h3 id="cgValueTitle">' +
      (guest ? '填写完成，下载可带走资料' : '演示数据已生成') +
      '</h3>' +
      '<p>' +
      (guest
        ? '已生成个税演示数据。建议立即下载 App 并注册，同步当前填写内容，避免清缓存后丢失。'
        : '可立即查看收入纳税明细，或分享给好友体验。') +
      '</p>' +
      '<p style="font-size:12px;color:#666;margin-bottom:10px;">' +
      EDIT_HINT +
      '</p>' +
      '<p style="font-size:12px;color:#999;margin-bottom:12px;">' +
      DEMO_DISCLAIMER +
      '</p>' +
      (guest
        ? '<button type="button" class="cg-btn cg-btn-primary" id="cgValueGoDownload">下载 App 保存资料</button>'
        : '') +
      '<button type="button" class="cg-btn cg-btn-primary" id="cgValueShareFriend">分享给好友</button>' +
      '<button type="button" class="cg-btn cg-btn-primary" id="cgValueGoDetail"' +
      (guest ? ' style="background:#008afd;"' : '') +
      '>查看收入纳税明细</button>' +
      '<button type="button" class="cg-btn cg-btn-primary" id="cgValueGoNajilu" style="background:#008afd;">纳税记录证书预览</button>' +
      '<button type="button" class="cg-btn cg-btn-ghost" id="cgValueGoEdit">去修改或补充记录</button>' +
      '<button type="button" class="cg-btn cg-btn-ghost" id="cgValueLater">稍后再说</button>' +
      '</div>';
    document.body.appendChild(ov);
    function closeOv(action) {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }
    var dlBtn = document.getElementById('cgValueGoDownload');
    if (dlBtn) {
      dlBtn.onclick = function () {
        closeOv('download');
        goGuestDownloadSave('value_confirm');
      };
    }
    var shareBtn = document.getElementById('cgValueShareFriend');
    if (shareBtn) {
      shareBtn.onclick = function () {
        track('track_share_tax_created', { page: currentPage(), source: 'value_confirm' });
        if (typeof window.sharePageLink === 'function') {
          window.sharePageLink({
            page: 'shouye.html',
            query: { guest: '1', from: 'share', landing_ab: 'c', sv: 'sim1' },
            title: '个税记录演示',
            text: '我刚生成了个税演示数据，打开即可体验收入明细与纳税记录',
            track: 'track_share_tax_created_native'
          });
        } else {
          try {
            var url =
              String(window.location.origin || '') +
              '/shouye.html?guest=1&from=share&landing_ab=c&sv=sim1';
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(url).then(function () {
                alert('链接已复制，可粘贴发给好友');
              });
            } else {
              alert('请复制链接分享：\n' + url);
            }
          } catch (eShare) {
            alert('暂时无法分享，请稍后再试');
          }
        }
      };
    }
    document.getElementById('cgValueGoDetail').onclick = function () {
      closeOv('detail');
      goIncomeDetail(year);
    };
    document.getElementById('cgValueGoNajilu').onclick = function () {
      closeOv('najilu');
      goNajilu();
    };
    document.getElementById('cgValueGoEdit').onclick = function () {
      closeOv('edit');
      track('track_tax_edit_entry', { page: currentPage(), source: 'value_confirm' });
      goManageTaxRecords();
    };
    document.getElementById('cgValueLater').onclick = function () {
      closeOv('later');
    };
    ov.addEventListener('click', function (e) {
      if (e.target === ov) closeOv('dismiss');
    });
  }

  function afterTaxRecordsCreated(opts) {
    opts = opts || {};
    var y = normalizeTaxYearLocal(null);
    try {
      var sy = localStorage.getItem('selected_year');
      if (sy) y = normalizeTaxYearLocal(sy);
    } catch (e) {}
    if (isLandingGuest()) {
      if (typeof window.trackPublicAction === 'function') {
        window.trackPublicAction('track_landing_guest_tax_created', {
          page: 'consult',
          landing_variant: 'c',
          source: opts.source || 'batch',
          tax_count: taxRecordCount()
        });
      }
    }
    if (opts.source === 'single_save') {
      if (isLandingGuest()) {
        showCaptureToast('记录已保存。可下载 App 同步带走…', { duration: 2200 });
        setTimeout(function () {
          goGuestDownloadSave('single_save');
        }, 700);
        return;
      }
      showCaptureToast('记录已保存，正在打开收入纳税明细…', { duration: 2200 });
      setTimeout(function () {
        window.location.href =
          'shuiming_result.html?year=' +
          encodeURIComponent(String(y)) +
          '&from=tax_save';
      }, 520);
      return;
    }
    setTimeout(function () {
      showValueConfirmDialog(y);
    }, 400);
  }

  function downloadDataUrl(dataUrl, filename) {
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename || '演示截图.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function shareImageDataUrl(dataUrl, title, text) {
    if (!dataUrl) {
      alert('暂无可分享的图片');
      return;
    }
    if (navigator.share) {
      fetch(dataUrl)
        .then(function (r) {
          return r.blob();
        })
        .then(function (blob) {
          var file = new File([blob], 'demo-tax-preview.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            return navigator.share({
              files: [file],
              title: title || '收入纳税明细演示',
              text: (text || '') + '\n' + DEMO_DISCLAIMER
            });
          }
          throw new Error('share_unsupported');
        })
        .catch(function () {
          alert('当前环境不支持直接分享，请使用「保存图片」后从相册分享。\n\n' + DEMO_DISCLAIMER);
        });
      return;
    }
    alert('请使用「保存图片」保存到相册后分享。\n\n' + DEMO_DISCLAIMER);
  }

  function buildShuimingSummaryDataUrl(meta) {
    meta = meta || {};
    var year = meta.year || new Date().getFullYear();
    var incomeEl = document.getElementById('incomeTotal');
    var taxEl = document.getElementById('taxTotal');
    var incomeText = incomeEl ? (incomeEl.textContent || '0.00元').replace(/\s+/g, '') : '0.00元';
    var taxText = taxEl ? (taxEl.textContent || '0.00元').replace(/\s+/g, '') : '0.00元';
    var canvas = document.createElement('canvas');
    var w = 750;
    var h = 420;
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f5f6fa';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(24, 24, w - 48, h - 48);
    ctx.fillStyle = '#333';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillText(String(year) + '年 收入纳税明细（演示）', 48, 78);
    ctx.font = '22px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText('收入合计：' + incomeText, 48, 138);
    ctx.fillText('已申报税额合计：' + taxText, 48, 178);
    if (meta.recordCount != null) {
      ctx.fillText('明细条数：' + String(meta.recordCount) + ' 条', 48, 218);
    }
    ctx.fillStyle = '#999';
    ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    wrapCanvasText(ctx, DEMO_DISCLAIMER, 48, 268, w - 96, 22);
    return canvas.toDataURL('image/png');
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
    var chars = String(text || '').split('');
    var line = '';
    var cy = y;
    for (var i = 0; i < chars.length; i++) {
      var test = line + chars[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cy);
        line = chars[i];
        cy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, cy);
  }

  function removeShuimingResultValueBar() {
    if (currentPage() !== 'shuiming_result.html') return;
    document.body.classList.remove('cg-has-value-bar');
    var bar = document.getElementById('cg-value-action-bar');
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
  }

  function mountValueActionBar(opts) {
    if (currentPage() === 'shuiming_result.html') return;
    opts = opts || {};
    if (document.getElementById('cg-value-action-bar')) return;
    ensureGateStyles();
    document.body.classList.add('cg-has-value-bar');
    var bar = document.createElement('div');
    bar.id = 'cg-value-action-bar';
    bar.className = 'cg-value-bar';
    bar.innerHTML =
      '<p class="cg-disclaimer">' +
      DEMO_DISCLAIMER +
      '</p>' +
      '<p class="cg-edit-hint">' +
      EDIT_HINT +
      '</p>' +
      '<div class="cg-actions">' +
      '<button type="button" class="cg-btn cg-btn-primary" id="cgValueBarSave">保存图片</button>' +
      '<button type="button" class="cg-btn cg-btn-ghost" id="cgValueBarShare">分享预览</button>' +
      '</div>';
    document.body.appendChild(bar);
    document.getElementById('cgValueBarSave').onclick = function () {
      var url =
        typeof opts.getDataUrl === 'function'
          ? opts.getDataUrl()
          : buildShuimingSummaryDataUrl(opts.meta || {});
      if (!url) {
        alert('暂无可保存的图片');
        return;
      }
      downloadDataUrl(url, opts.filename || '收入纳税明细演示.png');
    };
    document.getElementById('cgValueBarShare').onclick = function () {
      var url =
        typeof opts.getDataUrl === 'function'
          ? opts.getDataUrl()
          : buildShuimingSummaryDataUrl(opts.meta || {});
      shareImageDataUrl(url, opts.shareTitle || '收入纳税明细演示', opts.shareText || '');
    };
  }

  function mountShuimingValueBar(meta) {
    removeShuimingResultValueBar();
  }

  function mountNajiluPreviewBar(app, dataUrl) {
    if (currentPage() !== 'najilu.html' || urlParam('view') !== 'preview') return;
    var period =
      app && app.period_start && app.period_end
        ? app.period_start + '_' + app.period_end
        : 'demo';
    mountValueActionBar({
      getDataUrl: function () {
        return dataUrl || '';
      },
      filename: '纳税记录_' + period + '.png',
      shareTitle: '纳税记录演示预览',
      shareText: '纳税记录演示预览'
    });
  }

  function maybeShowPostTaxSaveBanner() {
    if (currentPage() !== 'shuiming_result.html' || urlParam('from') !== 'tax_save') return;
    if (document.getElementById('cg-post-tax-banner')) return;
    ensureGateStyles();
    var banner = document.createElement('div');
    banner.id = 'cg-post-tax-banner';
    banner.className = 'cg-inline-hint cg-demo-only';
    banner.style.margin = '0 16px 12px';
    if (isLandingGuest()) {
      banner.innerHTML =
        '填写完成！建议 <a href="mine.html?guest_dl=1" style="color:#1e6fff;font-weight:600;">下载 App 同步保存</a>；也可先查看下方明细或 <a href="najilu.html" style="color:#1e6fff;font-weight:600;">纳税记录演示</a>。';
    } else {
      banner.innerHTML =
        '填写完成！可查看下方明细，或 <a href="najilu.html" style="color:#1e6fff;font-weight:600;">开具纳税记录演示</a>；需要调整时 <a href="javascript:void(0)" id="cgPostTaxGoEdit" style="color:#1e6fff;font-weight:600;">去修改或补充</a>。';
    }
    var list = document.querySelector('.list');
    if (list && list.parentNode) {
      list.parentNode.insertBefore(banner, list);
    }
    var editLink = document.getElementById('cgPostTaxGoEdit');
    if (editLink) {
      editLink.onclick = function (e) {
        e.preventDefault();
        track('track_tax_edit_entry', { page: 'shuiming_result', source: 'post_tax_banner' });
        goManageTaxRecords();
      };
    }
  }

  /** 个税详情页底部：轻量「去修改」入口（截图模式 / 录屏隐私下自动隐藏） */
  function mountXiangqingEditEntry() {
    if (currentPage() !== 'xiangqing.html') return;
    if (!isLoggedIn()) return;
    if (document.getElementById('cg-xiangqing-edit-entry')) return;
    ensureGateStyles();
    var el = document.createElement('div');
    el.id = 'cg-xiangqing-edit-entry';
    el.className = 'cg-detail-edit-entry cg-demo-only cg-demo-edit-entry';
    el.setAttribute('role', 'note');
    el.innerHTML =
      '数据有误？<a href="javascript:void(0)" id="cgXiangqingGoEdit">去修改</a>';
    document.body.appendChild(el);
    document.getElementById('cgXiangqingGoEdit').onclick = function (e) {
      e.preventDefault();
      if (!isTaxEditModeOn()) {
        notifyProfileEditLocked();
        return;
      }
      track('track_tax_edit_entry', { page: 'xiangqing', source: 'detail_footer' });
      goManageTaxRecords();
    };
  }

  /** 收入纳税明细列表：有数据时提供管理入口（截图模式隐藏） */
  function mountShuimingResultManageEntry() {
    if (currentPage() !== 'shuiming_result.html') return;
    if (!isLoggedIn() || !hasTaxRecords()) return;
    if (document.getElementById('cg-shuiming-result-edit-entry')) return;
    if (document.getElementById('cg-post-tax-banner')) return;
    ensureGateStyles();
    var el = document.createElement('div');
    el.id = 'cg-shuiming-result-edit-entry';
    el.className = 'cg-detail-edit-entry cg-demo-only cg-demo-edit-entry';
    el.style.margin = '8px 16px 4px';
    el.setAttribute('role', 'note');
    el.innerHTML =
      '需要调整演示数据？<a href="javascript:void(0)" id="cgShuimingResultGoEdit">去修改</a>';
    var list = document.getElementById('recordList') || document.querySelector('.list');
    if (list && list.parentNode) {
      list.parentNode.insertBefore(el, list);
    } else {
      document.body.appendChild(el);
    }
    document.getElementById('cgShuimingResultGoEdit').onclick = function (e) {
      e.preventDefault();
      if (!isTaxEditModeOn()) {
        notifyProfileEditLocked();
        return;
      }
      track('track_tax_edit_entry', { page: 'shuiming_result', source: 'list_footer' });
      goManageTaxRecords();
    };
  }

  function afterEmployerSaved(meta) {
    if (!isAccountActive() || skipConversionPromo()) return;
    setTimeout(function () {
      if (
        window.confirm(
          '任职信息已保存。\n\n是否前往「税务记录」生成对应月份的纳税演示数据？'
        )
      ) {
        goFillTaxRecords();
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
      goFillTaxRecords();
    };
    document.getElementById('cgRecoveryDismiss').onclick = function () {
      try {
        localStorage.setItem(DETAIL_RECOVERY_DISMISS_KEY, '1');
      } catch (e) {}
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }

  function renderShuimingHint() {
    if (currentPage() !== 'shuiming.html') return;
    if (!isLoggedIn() || hasTaxRecords()) return;
    if (document.getElementById('cg-shuiming-hint')) return;
    ensureGateStyles();
    var content = document.querySelector('body.page-shuiming > .content');
    if (!content) return;
    var hint = document.createElement('div');
    hint.id = 'cg-shuiming-hint';
    hint.className = 'cg-inline-hint';
    hint.innerHTML =
      '暂无个税演示数据。建议先在 <strong>我要咨询 → 示例填写</strong> 一键生成，再查询本页明细。' +
      '<div style="margin-top:8px;"><button type="button" class="cg-btn cg-btn-primary" id="cgShuimingGoTax" style="padding:8px 14px;font-size:13px;">去添加税务记录</button></div>';
    content.insertBefore(hint, content.firstChild);
    var btn = document.getElementById('cgShuimingGoTax');
    if (btn) {
      btn.onclick = function () {
        goFillTaxRecords();
      };
    }
  }

  function removeShouyeRetentionCard() {
    var card = document.getElementById('cg-shouye-retention');
    if (card && card.parentNode) card.parentNode.removeChild(card);
  }

  function removeShouyeTaxManageEntry() {
    var card = document.getElementById('cg-shouye-tax-entry');
    if (card && card.parentNode) card.parentNode.removeChild(card);
  }

  function removeMineTaxStrongPrompt() {
    var el = document.getElementById('cg-mine-tax-banner');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function removeConsultTaxStrongPrompt() {
    var el = document.getElementById('cg-consult-tax-banner');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function isTaxFillBannerDismissedToday() {
    try {
      return localStorage.getItem(TAX_FILL_BANNER_DISMISS_KEY) === beijingDayKey();
    } catch (e) {
      return false;
    }
  }

  function markTaxFillBannerDismissedToday() {
    try {
      localStorage.setItem(TAX_FILL_BANNER_DISMISS_KEY, beijingDayKey());
    } catch (e) {}
  }

  function canShowTaxFillNudgeToday() {
    try {
      return localStorage.getItem(TAX_FILL_NUDGE_DAY_KEY) !== beijingDayKey();
    } catch (e) {
      return true;
    }
  }

  function markTaxFillNudgeShownToday() {
    try {
      localStorage.setItem(TAX_FILL_NUDGE_DAY_KEY, beijingDayKey());
    } catch (e) {}
  }

  function syncMineConsultEntryForTax() {
    if (currentPage() !== 'mine.html') return;
    var link = document.getElementById('consultModifyLink');
    if (!link) return;
    if (!hasTaxRecords()) {
      link.setAttribute('href', 'consult.html?tab=records&onboarding=tax');
      link.setAttribute('aria-label', '添加个税记录（我要咨询）');
    } else {
      link.setAttribute('href', 'consult.html?tab=records');
      link.setAttribute('aria-label', '我要咨询');
    }
  }

  function renderShouyeTaxManageEntry() {
    removeShouyeTaxManageEntry();
    if (currentPage() !== 'shouye.html') return;
    if (!isLoggedIn() || hasTaxRecords()) return;
    if (isTaxFillBannerDismissedToday()) return;
    ensureGateStyles();
    var card = document.createElement('div');
    card.id = 'cg-shouye-tax-entry';
    card.className = 'cg-shouye-card is-tax-strong cg-demo-only';
    card.innerHTML =
      '<button type="button" class="cg-dismiss" id="cgShouyeTaxDismiss" aria-label="今日不再显示" style="position:absolute;top:8px;right:10px;border:none;background:transparent;color:#c2410c;font-size:12px;padding:4px 6px;cursor:pointer;font-family:inherit;opacity:.75;">今日关闭</button>' +
      '<h4>还差一步：添加个税记录</h4>' +
      '<p>收入纳税明细目前是空的。点下面按钮，约 30 秒示例填写后即可查看完整明细。</p>' +
      '<button type="button" class="cg-btn cg-btn-primary" id="cgShouyeGoTax">立即添加个税记录</button>';
    var host =
      document.getElementById('guestExperienceBar') ||
      document.getElementById('syHScroll') ||
      document.querySelector('.shouye-page') ||
      document.getElementById('syApkStack');
    if (!host) return;
    if (host.id === 'guestExperienceBar' || host.id === 'syHScroll') {
      host.parentNode.insertBefore(card, host);
    } else {
      host.insertBefore(card, host.firstChild);
    }
    track('track_tax_fill_banner_show', { page: 'shouye', source: 'home_strong' });
    var btn = document.getElementById('cgShouyeGoTax');
    if (btn) {
      btn.onclick = function () {
        track('track_tax_fill_banner_ok', { page: 'shouye', source: 'home_strong' });
        goFillTaxRecords();
      };
    }
    var dismiss = document.getElementById('cgShouyeTaxDismiss');
    if (dismiss) {
      dismiss.onclick = function () {
        markTaxFillBannerDismissedToday();
        track('track_tax_fill_banner_dismiss', { page: 'shouye', source: 'home_strong' });
        removeShouyeTaxManageEntry();
      };
    }
  }

  function renderMineTaxStrongPrompt() {
    removeMineTaxStrongPrompt();
    if (currentPage() !== 'mine.html') return;
    if (!isLoggedIn() || hasTaxRecords()) return;
    if (isLandingGuest() && document.getElementById('cg-guest-fill-card')) return;
    if (isTaxFillBannerDismissedToday()) return;
    ensureGateStyles();
    var banner = document.createElement('div');
    banner.id = 'cg-mine-tax-banner';
    banner.className = 'cg-mine-tax-banner cg-demo-only';
    banner.innerHTML =
      '<button type="button" class="cg-dismiss" id="cgMineTaxDismiss" aria-label="今日不再显示">今日关闭</button>' +
      '<h4>请先添加个税记录</h4>' +
      '<p>入口在下方「我要咨询」。也可直接点按钮，示例填写约 30 秒，生成后即可看收入纳税明细。</p>' +
      '<button type="button" class="cg-btn-primary" id="cgMineGoTax">立即添加个税记录</button>';
    var stack = document.querySelector('.mine-stack');
    var canvas = document.getElementById('mineE1Canvas');
    if (stack && canvas && canvas.parentNode === stack) {
      stack.insertBefore(banner, canvas);
    } else if (stack) {
      stack.insertBefore(banner, stack.firstChild);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
    track('track_tax_fill_banner_show', { page: 'mine', source: 'mine_strong' });
    var btn = document.getElementById('cgMineGoTax');
    if (btn) {
      btn.onclick = function () {
        track('track_tax_fill_banner_ok', { page: 'mine', source: 'mine_strong' });
        goFillTaxRecords();
      };
    }
    var dismiss = document.getElementById('cgMineTaxDismiss');
    if (dismiss) {
      dismiss.onclick = function () {
        markTaxFillBannerDismissedToday();
        track('track_tax_fill_banner_dismiss', { page: 'mine', source: 'mine_strong' });
        removeMineTaxStrongPrompt();
      };
    }
  }

  function renderConsultTaxStrongPrompt() {
    removeConsultTaxStrongPrompt();
    if (currentPage() !== 'consult.html') return;
    if (!isLoggedIn() || hasTaxRecords()) return;
    ensureGateStyles();
    var panel = document.getElementById('panel-records') || document.getElementById('batchTaxCard');
    if (!panel) return;
    var banner = document.createElement('div');
    banner.id = 'cg-consult-tax-banner';
    banner.className = 'cg-consult-tax-banner cg-demo-only';
    banner.innerHTML =
      '<strong>在这里添加个税记录</strong>' +
      '<span>可点「示例填写」快速生成，或填写工作经历后一键生成多月工资。</span>';
    var head = panel.querySelector('.batch-tax-card-head') || panel.firstChild;
    if (head && head.parentNode === panel) {
      panel.insertBefore(banner, head.nextSibling);
    } else {
      panel.insertBefore(banner, panel.firstChild);
    }
    /* 空态时强化主按钮文案 */
    var emptyBtn = document.getElementById('btnBatchTaxEmptyExample');
    if (emptyBtn) emptyBtn.textContent = '立即示例填写';
    var exBtn = document.getElementById('btnBatchTaxExample');
    if (exBtn) exBtn.textContent = '示例填写（推荐）';
    track('track_tax_fill_banner_show', { page: 'consult', source: 'consult_strong' });
  }

  function maybeShowTaxFillNudge() {
    if (!isLoggedIn() || hasTaxRecords()) return;
    if (isLightShellPage()) return;
    var page = currentPage();
    if (page !== 'mine.html' && page !== 'shouye.html') return;
    if (document.getElementById('cg-act-nudge-root')) return;
    if (document.getElementById('cg-tax-fill-nudge-root')) return;
    if (document.querySelector('.activate-modal-root.is-open')) return;

    var force = false;
    try {
      if (sessionStorage.getItem('tax_tutorial_post_login_pending') === '1') {
        force = true;
        sessionStorage.removeItem('tax_tutorial_post_login_pending');
      }
    } catch (e0) {}
    if (!force && !canShowTaxFillNudgeToday()) return;

    ensureGateStyles();
    markTaxFillNudgeShownToday();

    var root = document.createElement('div');
    root.id = 'cg-tax-fill-nudge-root';
    root.className = 'cg-act-nudge-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML =
      '<div class="cg-act-nudge-mask" data-tax="dismiss"></div>' +
      '<div class="cg-act-nudge-panel" style="border:2px solid #ff9500;">' +
      '<p class="cg-act-nudge-title" style="color:#c2410c;">请先添加个税记录</p>' +
      '<p class="cg-act-nudge-body">收入纳税明细依赖个税数据。入口在「我的 → 我要咨询」，也可点下方按钮直接示例填写（约 30 秒）。</p>' +
      '<div class="cg-act-nudge-actions">' +
      '<button type="button" class="cg-act-nudge-btn primary" data-tax="cta" style="background:#ff9500;">立即去添加</button>' +
      '<button type="button" class="cg-act-nudge-btn secondary" data-tax="dismiss">稍后提醒我</button>' +
      '</div></div>';
    document.body.appendChild(root);
    track('track_tax_fill_nudge_show', { page: page, force: force ? 1 : 0 });

    function close() {
      if (root.parentNode) root.parentNode.removeChild(root);
    }
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var act = t.getAttribute('data-tax');
      if (act === 'cta') {
        track('track_tax_fill_nudge_ok', { page: page });
        close();
        goFillTaxRecords();
      } else if (act === 'dismiss') {
        track('track_tax_fill_nudge_dismiss', { page: page });
        close();
      }
    });
  }

  function renderShouyeRetentionCard() {
    removeShouyeRetentionCard();
  }

  function prependMaintenanceMessages(list) {
    return Array.isArray(list) ? list.slice() : [];
  }

  function init() {
    initCapturePrivacy();
    bindMinePageSecretGestures();
    try {
      window.dispatchEvent(
        new CustomEvent('cgTaxEditModeChange', { detail: { on: isTaxEditModeOn() } })
      );
    } catch (e) {}
    if (!isLoggedIn()) return;
    ensureGateStyles();

    function afterProfileReady() {
      if (skipConversionPromo()) {
        removeActivationPromoUi();
      }
      runMineOnboarding();
      runConsultOnboarding();
      patchShuimingResultEmpty();
      refreshShuimingResultEmptyCta();
      removeShuimingResultValueBar();
      syncMineConsultEntryForTax();
      renderShouyeTaxManageEntry();
      renderMineTaxStrongPrompt();
      renderConsultTaxStrongPrompt();
      renderShouyeRetentionCard();
      /* 无个税时对所有登录用户强提示（含已激活） */
      setTimeout(maybeShowTaxFillNudge, 480);
      bumpIncomeBrowseVisit();
      renderShuimingHint();
      if (!skipConversionPromo()) {
        renderAboutUpdateNudge();
        renderCareVersionHint();
        setTimeout(function () {
          if (!document.getElementById('cg-tax-fill-nudge-root')) {
            maybeShowActivationNudge();
          }
        }, 900);
      } else {
        renderAboutUpdateNudge();
      }
      maybeShowPostTaxSaveBanner();
      mountXiangqingEditEntry();
      mountShuimingResultManageEntry();
      /* 列表异步返回后可能再次变空：短延迟再补一次 */
      setTimeout(refreshShuimingResultEmptyCta, 400);
      setTimeout(renderConsultTaxStrongPrompt, 450);
    }

    function runBoot() {
      return Promise.all([loadConversionConfig(), fetchProfileCounts()]).then(function () {
        applyActivateModalCopy();
        applyConsultBatchUi();
        afterProfileReady();
      });
    }

    /* 待办/办查/消息等静态 Tab：不抢首屏带宽，延后刷新摘要 */
    if (isLightShellPage()) {
      var cached = readProfileCache();
      if (cached) {
        applyProfileSummary(cached);
      }
      setTimeout(function () {
        runBoot();
      }, 2800);
      return;
    }

    runBoot();
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
      : '欢迎使用。激活并添加税务演示数据后，可体验收入明细与纳税记录开具。 <a href="purchase.html">去激活</a>';
    brand.parentNode.insertBefore(box, brand.nextSibling);
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
  }

  function beijingDayKey() {
    try {
      return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    } catch (e) {
      var d = new Date();
      var utc = d.getTime() + d.getTimezoneOffset() * 60000;
      var cn = new Date(utc + 8 * 3600000);
      var y = cn.getFullYear();
      var m = cn.getMonth() + 1;
      var day = cn.getDate();
      return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    }
  }

  function sanitizeNudgeLink(raw) {
    var s = raw != null ? String(raw).trim() : '';
    if (!s) return 'purchase.html';
    if (/^[a-zA-Z0-9_./?-]+$/.test(s) && s.indexOf('..') < 0 && !/^[a-zA-Z]+:/.test(s)) {
      return s;
    }
    if (/^https:\/\/(www\.)?geshui\.vip(\/|$)/i.test(s)) return s;
    return 'purchase.html';
  }

  function markActNudgeShownToday() {
    var day = beijingDayKey();
    try {
      localStorage.setItem(ACT_NUDGE_DAY_KEY, day);
      localStorage.setItem(ACT_NUDGE_COUNT_KEY, '1');
    } catch (e) {}
  }

  function canShowActNudgeToday(maxPerDay) {
    var day = beijingDayKey();
    var maxN = Math.max(1, Number(maxPerDay) || 1);
    try {
      var savedDay = localStorage.getItem(ACT_NUDGE_DAY_KEY) || '';
      var count = parseInt(localStorage.getItem(ACT_NUDGE_COUNT_KEY) || '0', 10) || 0;
      if (savedDay !== day) return true;
      return count < maxN;
    } catch (e) {
      return true;
    }
  }

  function maybeShowActivationNudge() {
    if (!isLoggedIn() || skipConversionPromo() || isLandingGuest()) return;
    if (isLightShellPage()) return;
    if (currentPage() === 'purchase.html') return;
    var nudge = conversionCfg && conversionCfg.activation_nudge;
    if (!nudge || nudge.enabled === false) return;
    if (!canShowActNudgeToday(nudge.max_per_day)) return;
    var minH = Number(nudge.min_hours_since_register);
    if (!isFinite(minH)) minH = 24;
    if (hoursSinceRegisterCached < minH) return;
    if (document.getElementById('cg-act-nudge-root')) return;
    if (document.querySelector('.activate-modal-root.is-open')) return;

    ensureGateStyles();
    markActNudgeShownToday();

    var title = String(nudge.title || '开通完整功能');
    var body = String(nudge.body || '');
    var cta = String(nudge.cta_text || '去激活');
    var dismiss = String(nudge.dismiss_text || '今日不再提示');
    var link = sanitizeNudgeLink(nudge.link_url);

    var root = document.createElement('div');
    root.id = 'cg-act-nudge-root';
    root.className = 'cg-act-nudge-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML =
      '<div class="cg-act-nudge-mask" data-act="dismiss"></div>' +
      '<div class="cg-act-nudge-panel">' +
      '<p class="cg-act-nudge-title"></p>' +
      '<p class="cg-act-nudge-body"></p>' +
      '<div class="cg-act-nudge-actions">' +
      '<button type="button" class="cg-act-nudge-btn primary" data-act="cta"></button>' +
      '<button type="button" class="cg-act-nudge-btn secondary" data-act="dismiss"></button>' +
      '</div></div>';
    root.querySelector('.cg-act-nudge-title').textContent = title;
    root.querySelector('.cg-act-nudge-body').textContent = body;
    root.querySelector('[data-act="cta"]').textContent = cta;
    root.querySelectorAll('[data-act="dismiss"]').forEach(function (el) {
      if (el.tagName === 'BUTTON') el.textContent = dismiss;
    });

    function close() {
      if (root.parentNode) root.parentNode.removeChild(root);
    }

    root.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var act = t.getAttribute('data-act');
      if (act === 'dismiss') {
        track('track_activation_nudge_dismiss', { page: currentPage() });
        close();
      } else if (act === 'cta') {
        track('track_activation_nudge_cta', { page: currentPage(), link: link });
        close();
        window.location.href = link;
      }
    });

    document.body.appendChild(root);
    track('track_activation_nudge_show', {
      page: currentPage(),
      hours: hoursSinceRegisterCached
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
    mountShuimingValueBar: mountShuimingValueBar,
    mountNajiluPreviewBar: mountNajiluPreviewBar,
    prependMaintenanceMessages: prependMaintenanceMessages,
    refresh: fetchProfileCounts,
    hideDemoUiForCapture: hideDemoUiForCapture,
    setScreenshotMode: setScreenshotMode,
    toggleScreenshotMode: toggleScreenshotMode,
    isScreenshotModeOn: isScreenshotModeOn,
    isTaxEditModeOn: isTaxEditModeOn,
    setTaxEditMode: setTaxEditMode,
    toggleTaxEditMode: toggleTaxEditMode,
    notifyProfileEditLocked: notifyProfileEditLocked
  };

  initCapturePrivacy();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
