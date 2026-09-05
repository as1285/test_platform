/**
 * 用户转化引导（P0–P5 漏斗）：
 * P0 注册/登录 → P1 激活开通 → P2 填税/任职 → P3 价值确认（明细/证书）→
 * P4 二次退税广告推荐 → P5 留存轻触达（邮箱/激活 nudge/关于页提示）。
 *
 * 依赖：auth.js 提供的 authFetch、trackUserAction（及部分页面全局工具）。
 * 加载方式：由 auth.js 的 injectConversionGuide 动态注入，HTML 不静态引用本文件；
 * tab-shell iframe / 部分只读页会跳过注入。
 *
 * 主要 localStorage / sessionStorage 键（详见下方「状态/缓存」段）：
 * - account_active / tax_record_count / employer_count（与业务页共享）
 * - cg_*：转化 dismiss、日频、截图/编辑模式、收入访问计数等
 * - refund_ad_*：填完强制弹框 / 测算金额 / 年收入软推荐 / 微信已复制
 * - cg_profile_summary_v2（sessionStorage）：用户摘要短缓存
 * - cg_post_activate_pending / cg_email_nudge_after_register（sessionStorage）
 *
 * 已激活账号：skipConversionPromo() 为 true 时抑制营销条/卡/弹窗，
 * 仍保留激活门禁点击拦截与「添加个税」等必要引导。
 */
(function () {
  // === 状态 / 缓存 ===
  var ONBOARD_ACTIVATE = 'activate';
  var ONBOARD_TAX = 'tax';
  var ONBOARD_EDIT = 'edit';
  /** session：刚开通成功，待展示编辑教练条 */
  var POST_ACTIVATE_PENDING_KEY = 'cg_post_activate_pending';
  /** local：税务编辑引导今日已关（存北京日） */
  var TAX_EDIT_GUIDE_DISMISS_KEY = 'cg_tax_edit_guide_dismiss_v1';
  /** local：智能填税 confirm 已出过 */
  var SMART_GUIDE_KEY = 'cg_smart_guide_dismissed';
  /** local：收入相关页浏览次数（触发智能引导） */
  var INCOME_VISIT_KEY = 'cg_income_visit_count';
  var DETAIL_EMPTY_VISIT_KEY = 'cg_detail_empty_visits';
  var DETAIL_RECOVERY_DISMISS_KEY = 'cg_detail_recovery_dismissed';
  var ABOUT_NUDGE_DISMISS_KEY = 'cg_about_nudge_dismissed';
  var ACT_NUDGE_DAY_KEY = 'cg_act_nudge_day_v1';
  var ACT_NUDGE_COUNT_KEY = 'cg_act_nudge_count_v1';
  var EMAIL_NUDGE_DAY_KEY = 'cg_email_nudge_day_v1';
  var EMAIL_NUDGE_DISMISS_KEY = 'cg_email_nudge_dismiss_v1';
  /** session：注册成功后优先弹邮箱收集 */
  var EMAIL_NUDGE_AFTER_REGISTER_KEY = 'cg_email_nudge_after_register';
  var TAX_FILL_NUDGE_DAY_KEY = 'cg_tax_fill_nudge_day_v1';
  var TAX_FILL_BANNER_DISMISS_KEY = 'cg_tax_fill_banner_dismiss_day_v1';
  /** local：填完个税后强制去过一次退税广告页 */
  var REFUND_AD_AFTER_TAX_KEY = 'refund_ad_after_tax_v1';
  /** 年收入≥15万：软推荐去广告页浏览（可跳过；与填完强制跳转互补） */
  var REFUND_AD_INCOME_RECOMMEND_KEY = 'refund_ad_income_recommend_v1';
  /** 收入推荐展示日（北京日），同一天最多记 1 次 show */
  var REFUND_AD_INCOME_RECOMMEND_SHOW_DAY_KEY = 'refund_ad_income_recommend_show_day_v1';
  /** 用户已复制过顾问微信后，不再推收入推荐卡/弹窗 */
  var REFUND_AD_WECHAT_COPIED_KEY = 'refund_ad_wechat_copied_v1';
  /** 填完个税后测算金额，广告页读取 */
  var REFUND_AD_ESTIMATE_KEY = 'refund_ad_estimate_v1';
  /** 填完个税后引导二次退税：23/24/25 任一年税额>5000 或年收入≥15万 */
  var REFUND_AD_TAX_YEARS = [2025, 2024, 2023];
  var REFUND_AD_MIN_TAX_REPORTED = 5000;
  var REFUND_AD_MIN_YEAR_INCOME = 150000;
  /** 营销换算：3 个子女 4500 元/月 + 赡养父母 3000 元/月 */
  var REFUND_CHILD_MONTH = 4500;
  var REFUND_PARENT_MONTH = 3000;
  var REFUND_MONTHLY_EXTRA = REFUND_CHILD_MONTH + REFUND_PARENT_MONTH;
  var REFUND_BASIC_DEDUCTION = 60000;
  var hoursSinceRegisterCached = 0;
  var hasEmailCached = false;
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
  /** 转化浮层须盖住页面内容与水印 */
  var CG_OVERLAY_Z = 1000030;

  function normalizeTaxYearLocal(raw) {
    if (typeof globalThis !== 'undefined' && typeof globalThis.normalizeTaxYear === 'function') {
      return globalThis.normalizeTaxYear(raw);
    }
    var minY = 2019;
    var now = new Date().getFullYear();
    var maxY = now && !isNaN(now) && now >= minY ? now : minY;
    var defY = maxY;
    var y = parseInt(String(raw == null ? '' : raw).trim(), 10);
    if (!y || isNaN(y) || y < minY || y > maxY) return defY;
    return y;
  }

  /**
   * 从刚写入的个税记录里取最早有数据的年份。
   * 忽略空记录、已删除记录、无数字 year 的条目。
   * @param {Array} records
   * @returns {number|null}
   */
  function pickYearFromTaxRecords(records) {
    if (!records || !records.length) return null;
    var seen = {};
    var earliest = null;
    var i;
    for (i = 0; i < records.length; i++) {
      var r = records[i];
      if (!r || typeof r !== 'object') continue;
      if (r.deleted || r.is_deleted || r.deleted_at) continue;
      var y = parseInt(String(r.year == null ? '' : r.year).trim(), 10);
      if (!y || isNaN(y)) continue;
      if (seen[y]) continue;
      seen[y] = true;
      if (earliest == null || y < earliest) earliest = y;
    }
    return earliest;
  }

  function fallbackSelectedTaxYear() {
    var y = normalizeTaxYearLocal(null);
    try {
      var sy = localStorage.getItem('selected_year');
      if (sy) y = normalizeTaxYearLocal(sy);
    } catch (e) {}
    return y;
  }

  function persistSelectedTaxYear(year) {
    try {
      localStorage.setItem('selected_year', String(year));
    } catch (e) {}
  }

  /** 入参可解析且落在可选年度内时用之，否则 null（不回落到默认年）。 */
  function parseProvidedTaxYear(raw) {
    if (raw == null || raw === '') return null;
    var y = parseInt(String(raw).trim(), 10);
    if (!y || isNaN(y)) return null;
    if (normalizeTaxYearLocal(y) !== y) return null;
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
        return (window.authParseJson||function(r){return r.json();})(r);
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

  function isAccountActiveFlag(v) {
    return v === true || v === 1 || v === '1';
  }

  function isAccountActive() {
    try {
      if (localStorage.getItem('account_active') === '1') return true;
    } catch (e) {}
    try {
      var cached = readProfileCache();
      if (cached && isAccountActiveFlag(cached.account_active)) return true;
    } catch (e2) {}
    return false;
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

  // === 已激活账号：抑制转化促销 ===
  /**
   * 已激活账号不再展示转化引导条/卡片/弹窗（仅保留未激活时的激活引导与点击门禁）。
   * init / 各 render* 入口应先判断本函数。
   * @returns {boolean}
   */
  function skipConversionPromo() {
    return isAccountActive();
  }

  function hideLegacyShuimingRefundWechatCard() {
    var el = document.getElementById('smRefundAdCard');
    if (!el) return;
    el.hidden = true;
    el.setAttribute('hidden', '');
    el.setAttribute('aria-hidden', 'true');
    el.classList.remove('is-refund-qualified');
    try {
      el.style.display = 'none';
    } catch (e) {}
  }

  function removeActivationPromoUi() {
    /* 已激活用户仍需保留「添加个税」强提示；此处只清激活营销类 UI */
    hideLegacyShuimingRefundWechatCard();
    ['cg-shuiming-hint', 'cg-care-hint', 'cg-about-nudge', 'cg-detail-recovery-toast', 'smActivateCard', 'cg-inactive-refund-promo'].forEach(
      function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        if (id === 'smActivateCard') {
          el.hidden = true;
          el.setAttribute('hidden', '');
          el.classList.remove('is-refund-prompt');
          return;
        }
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    );
  }

  /**
   * 去开通/下载：游客走安装引导；已登录走 purchase.html?from=…
   * @param {string} [from] 来源标记（埋点 / purchase from）
   */
  function goActivate(from) {
    try {
      if (localStorage.getItem('landing_guest_v1') === '1') {
        var taxN = taxRecordCount();
        track('track_landing_guest_activate_download', {
          page: currentPage(),
          landing_variant: 'c',
          source: from || 'conversion_guide',
          tax_count: taxN
        });
        if (typeof window.trackPublicAction === 'function') {
          window.trackPublicAction('track_landing_guest_activate_download', {
            page: currentPage(),
            landing_variant: 'c',
            source: from || 'conversion_guide',
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
    var src = String(from || '').trim() || currentPage().replace(/\.html$/, '') || 'app';
    window.location.href = 'purchase.html?from=' + encodeURIComponent(src);
  }

  /**
   * 无个税时自动开编辑；已有记录且编辑关闭则提示并返回 false。
   * @returns {boolean}
   */
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

  function goEditTaxRecords() {
    if (!ensureTaxEditForFill()) {
      window.location.href = 'mine.html';
      return;
    }
    window.location.href = 'consult.html?tab=records&onboarding=' + ONBOARD_EDIT;
  }

  function isPostActivatePending() {
    try {
      return sessionStorage.getItem(POST_ACTIVATE_PENDING_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function clearPostActivatePending() {
    try {
      sessionStorage.removeItem(POST_ACTIVATE_PENDING_KEY);
    } catch (e) {}
  }

  function isTaxEditGuideDismissedToday() {
    try {
      return localStorage.getItem(TAX_EDIT_GUIDE_DISMISS_KEY) === beijingDayKey();
    } catch (e) {
      return false;
    }
  }

  function markTaxEditGuideDismissedToday() {
    try {
      localStorage.setItem(TAX_EDIT_GUIDE_DISMISS_KEY, beijingDayKey());
    } catch (e) {}
  }

  function goIncomeDetail(year) {
    var provided = parseProvidedTaxYear(year);
    var y = provided != null ? provided : fallbackSelectedTaxYear();
    if (provided != null) persistSelectedTaxYear(y);
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

  /**
   * 把 api/user?action=summary（或缓存）写回 localStorage，并清理已激活营销 UI。
   * opts.fromCache=true：不得把已开通打回未开通。
   * @param {Object} u
   * @param {{fromCache?: boolean}} [opts]
   */
  function applyProfileSummary(u, opts) {
    opts = opts || {};
    if (!u || typeof u !== 'object') return;
    if (u.account_active !== undefined && u.account_active !== null) {
      var active = isAccountActiveFlag(u.account_active);
      var alreadyActive = false;
      try {
        alreadyActive = localStorage.getItem('account_active') === '1';
      } catch (eLs) {}
      /* 会话缓存不得把已开通打回未开通，否则明细页会闪开通卡 */
      if (active) {
        try {
          localStorage.setItem('account_active', '1');
        } catch (e0) {}
        window.__smAccountActiveConfirmed = true;
        try {
          document.documentElement.classList.add('sm-account-active');
        } catch (eCls) {}
        removeActivationPromoUi();
        syncShuimingInactivePrompt();
      } else if (!opts.fromCache) {
        try {
          localStorage.setItem('account_active', '0');
        } catch (e0b) {}
        window.__smAccountActiveConfirmed = false;
        try {
          document.documentElement.classList.remove('sm-account-active');
        } catch (eCls2) {}
      } else if (!alreadyActive) {
        try {
          localStorage.setItem('account_active', '0');
        } catch (e0c) {}
      }
    }
    if (u.tax_record_count != null) {
      try {
        localStorage.setItem('tax_record_count', String(Number(u.tax_record_count) || 0));
      } catch (e1) {}
    }
    if (u.register_source_channel != null) {
      try {
        localStorage.setItem(
          'register_source_channel',
          String(u.register_source_channel || '').trim()
        );
      } catch (eCh) {}
    }
    try {
      var promoCh =
        u.sales_promo_channel != null
          ? String(u.sales_promo_channel || '').trim().toLowerCase()
          : '';
      if (promoCh) {
        localStorage.setItem('sales_promo_channel', promoCh);
      } else {
        localStorage.removeItem('sales_promo_channel');
      }
    } catch (ePromo) {}
    if (u.employer_count != null) {
      try {
        localStorage.setItem('employer_count', String(Number(u.employer_count) || 0));
      } catch (e2) {}
    }
    if (u.hours_since_register != null) {
      hoursSinceRegisterCached = Number(u.hours_since_register) || 0;
    }
    if (u.has_email != null) {
      hasEmailCached = !!u.has_email;
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
          hours_since_register: u.hours_since_register,
          has_email: !!u.has_email
        })
      );
    } catch (e) {}
  }

  /**
   * 拉取用户摘要（开通态、个税条数、注册时长、是否有邮箱）；带 TTL 缓存与 in-flight 合并。
   * @param {{force?: boolean}} [opts]
   * @returns {Promise<void>}
   */
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
        applyProfileSummary(cached, { fromCache: true });
        var localAct = false;
        try {
          localAct = localStorage.getItem('account_active') === '1';
        } catch (eAct) {}
        if (localAct && !isAccountActiveFlag(cached.account_active)) {
          opts = Object.assign({}, opts, { force: true });
        } else {
          return Promise.resolve();
        }
      }
    }
    if (profileFetchInFlight && !opts.force) {
      return profileFetchInFlight;
    }
    profileFetchInFlight = window.authFetch('api/user?action=summary')
      .then(function (r) {
        return (window.authParseJson||function(r){return r.json();})(r);
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
      '.cg-value-overlay{position:fixed;inset:0;z-index:' +
      CG_OVERLAY_Z +
      ';background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}' +
      '.cg-value-panel{max-width:340px;width:100%;max-height:min(86vh,640px);overflow-y:auto;-webkit-overflow-scrolling:touch;background:#fff;border-radius:12px;padding:18px 16px;box-sizing:border-box}' +
      '.cg-value-panel h3{margin:0 0 8px;font-size:17px;color:#333}' +
      '.cg-value-panel p{margin:0 0 14px;font-size:13px;color:#666;line-height:1.5}' +
      '.cg-value-panel .cg-btn{display:block;width:100%;margin-bottom:8px;padding:11px;border-radius:8px;border:none;font-size:15px;cursor:pointer;font-family:inherit}' +
      '.cg-value-panel .cg-btn-primary{background:#1e6fff;color:#fff}' +
      '.cg-value-panel .cg-btn-ghost{background:#f5f6fa;color:#333}' +
      '.cg-value-panel.is-refund-force{max-width:360px;padding:20px 18px 16px}' +
      '.cg-value-panel.is-refund-force .cg-refund-force-kicker{margin:0 0 8px;font-size:12px;font-weight:600;color:#c2410c;text-align:center;line-height:1.45}' +
      '.cg-value-panel.is-refund-force h3{margin:0 0 6px;font-size:18px;text-align:center}' +
      '.cg-value-panel.is-refund-force .cg-refund-force-amt{margin:4px 0 6px;font-size:30px;font-weight:800;color:#c2410c;text-align:center;letter-spacing:-0.02em;line-height:1.15}' +
      '.cg-value-panel.is-refund-force .cg-refund-force-years{margin:0 0 12px;font-size:12px;color:#9a3412;text-align:center;line-height:1.5}' +
      '.cg-refund-force-why{margin:0 0 10px;padding:10px 12px;background:#fff7ed;border-radius:10px;font-size:13px;color:#7c2d12;line-height:1.55}' +
      '.cg-refund-force-why strong{display:block;margin:0 0 4px;color:#c2410c}' +
      '.cg-value-panel.is-refund-force .cg-refund-force-note{margin:0 0 14px;font-size:11px;color:#94a3b8;line-height:1.45;text-align:center}' +
      '.cg-value-panel.is-refund-force .cg-btn-primary{background:#ff6a00;font-weight:700;font-size:16px;margin-bottom:0}' +
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
      '.cg-post-activate-edit-banner{margin:0 0 10px;padding:14px 14px 12px;background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border:2px solid #34d399;border-radius:12px;box-shadow:0 4px 16px rgba(52,211,153,.14);position:relative;z-index:30}' +
      '.cg-post-activate-edit-banner h4{margin:0 0 6px;font-size:16px;font-weight:700;color:#047857}' +
      '.cg-post-activate-edit-banner p{margin:0 0 12px;font-size:13px;color:#065f46;line-height:1.5}' +
      '.cg-post-activate-edit-banner .cg-btn-primary{display:block;width:100%;padding:12px 14px;border:none;border-radius:10px;background:#059669;color:#fff;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer}' +
      '.cg-post-activate-edit-banner .cg-dismiss{position:absolute;top:8px;right:10px;border:none;background:transparent;color:#047857;font-size:12px;padding:4px 6px;cursor:pointer;font-family:inherit;opacity:.75}' +
      '.cg-consult-edit-banner{margin:0 0 12px;padding:12px 14px;background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border:2px solid #6ee7b7;border-radius:10px;position:relative}' +
      '.cg-consult-edit-banner strong{display:block;font-size:15px;color:#047857;margin:0 0 4px}' +
      '.cg-consult-edit-banner span{font-size:13px;color:#065f46;line-height:1.45}' +
      '.cg-consult-edit-banner .cg-dismiss{position:absolute;top:6px;right:8px;border:none;background:transparent;color:#047857;font-size:16px;line-height:1;padding:4px 6px;cursor:pointer;font-family:inherit;opacity:.7}' +
      '.cg-edit-coach-mark{position:fixed;z-index:' +
      (CG_OVERLAY_Z + 2) +
      ';max-width:280px;padding:12px 14px;background:#047857;color:#fff;border-radius:12px;font-size:13px;line-height:1.5;box-shadow:0 8px 24px rgba(4,120,87,.35);pointer-events:none}' +
      '.cg-edit-coach-mark::after{content:"";position:absolute;width:10px;height:10px;background:#047857;transform:rotate(45deg)}' +
      '.cg-edit-coach-mark.is-below::after{top:-5px;left:24px}' +
      '.cg-edit-coach-mark.is-above::after{bottom:-5px;left:24px}' +
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
      '.cg-act-nudge-root{position:fixed;inset:0;z-index:' +
      CG_OVERLAY_Z +
      ';display:flex;align-items:center;justify-content:center;padding:20px}' +
      '.cg-act-nudge-mask{position:absolute;inset:0;background:rgba(0,0,0,.45)}' +
      '.cg-act-nudge-panel{position:relative;z-index:1;width:100%;max-width:320px;background:#fff;border-radius:12px;padding:22px 20px 18px;box-shadow:0 8px 32px rgba(0,0,0,.12)}' +
      '.cg-act-nudge-title{margin:0 0 10px;font-size:17px;font-weight:600;color:#333;text-align:center}' +
      '.cg-act-nudge-body{margin:0;font-size:14px;line-height:1.65;color:#555;text-align:center;white-space:pre-wrap}' +
      '.cg-act-nudge-actions{display:flex;flex-direction:column;gap:10px;margin-top:18px}' +
      '.cg-act-nudge-btn{display:block;width:100%;height:44px;border:none;border-radius:8px;font-size:16px;font-family:inherit;-webkit-tap-highlight-color:transparent;cursor:pointer}' +
      '.cg-act-nudge-btn.primary{background:#1e6fff;color:#fff}' +
      '.cg-act-nudge-btn.secondary{background:#f5f6fa;color:#666}' +
      '.cg-email-nudge-root{position:fixed;inset:0;z-index:' +
      CG_OVERLAY_Z +
      ';display:flex;align-items:flex-end;justify-content:center;padding:0}' +
      '.cg-email-nudge-mask{position:absolute;inset:0;background:rgba(15,23,42,.4)}' +
      '.cg-email-nudge-root.is-strong .cg-email-nudge-mask{background:rgba(15,23,42,.55)}' +
      '.cg-email-nudge-panel{position:relative;z-index:1;width:100%;max-width:420px;margin:0 auto;background:#fff;border-radius:16px 16px 0 0;padding:20px 18px calc(16px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 28px rgba(15,23,42,.12);box-sizing:border-box}' +
      '.cg-email-nudge-root.is-strong .cg-email-nudge-panel{padding-top:22px}' +
      '.cg-email-nudge-badge{display:inline-block;margin:0 0 10px;padding:3px 8px;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-size:12px;font-weight:600;line-height:1.4}' +
      '.cg-email-nudge-title{margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a}' +
      '.cg-email-nudge-body{margin:0 0 12px;font-size:13px;line-height:1.55;color:#64748b}' +
      '.cg-email-nudge-root.is-strong .cg-email-nudge-body{color:#475569;font-size:14px}' +
      '.cg-email-nudge-input{width:100%;height:44px;padding:0 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:15px;font-family:inherit;box-sizing:border-box;margin:0 0 8px}' +
      '.cg-email-nudge-err{margin:0 0 10px;font-size:12px;color:#dc2626;min-height:16px}' +
      '.cg-email-nudge-actions{display:flex;flex-direction:column;gap:8px}' +
      '.cg-email-nudge-btn{display:block;width:100%;height:44px;border:none;border-radius:10px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}' +
      '.cg-email-nudge-btn.primary{background:#1e6fff;color:#fff}' +
      '.cg-email-nudge-btn.ghost{background:#f1f5f9;color:#64748b;font-weight:500}' +
      '.cg-email-nudge-root.is-strong .cg-email-nudge-btn.ghost{background:transparent;color:#94a3b8;font-weight:400;font-size:13px;height:36px}' +
      '.cg-pay-gate-root{position:fixed;inset:0;z-index:' +
      CG_OVERLAY_Z +
      ';display:flex;align-items:flex-end;justify-content:center;padding:0;box-sizing:border-box}' +
      '.cg-pay-gate-mask{position:absolute;inset:0;background:rgba(15,23,42,.45)}' +
      '.cg-pay-gate-panel{position:relative;z-index:1;width:100%;max-width:420px;margin:0 auto;background:#fff;border-radius:16px 16px 0 0;padding:20px 18px calc(16px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 28px rgba(15,23,42,.12);box-sizing:border-box}' +
      '.cg-pay-gate-title{margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a}' +
      '.cg-pay-gate-body{margin:0 0 16px;font-size:14px;line-height:1.55;color:#475569}' +
      '.cg-pay-gate-actions{display:flex;flex-direction:column;gap:8px}' +
      '.cg-pay-gate-btn{display:block;width:100%;height:44px;border:none;border-radius:10px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '.cg-pay-gate-btn.primary{background:#1e6fff;color:#fff}' +
      '.cg-pay-gate-btn.secondary{background:#eff6ff;color:#1d4ed8}' +
      '.cg-pay-gate-btn.ghost{background:#f1f5f9;color:#64748b;font-weight:500}' +
      '#cg-wm-pay-chip{display:none!important;visibility:hidden!important;pointer-events:none!important;opacity:0!important}' +
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
    var on = isTaxEditModeOn();
    link.setAttribute('data-cg-tax-edit-gated', on ? '0' : '1');
    /* 关闭编辑时禁止站内跳转转圈（点击会被拦截，转圈否则一直挂着） */
    if (on) {
      link.removeAttribute('data-no-page-loading');
    } else {
      link.setAttribute('data-no-page-loading', '1');
    }
    var hint = document.getElementById('consultModifyHint');
    if (hint && !on) {
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
  /* 连续点击间隔上限：过短在真机上很难点满 5 次 */
  var TAX_EDIT_TAP_WINDOW_MS = 5000;
  /** 关闭编辑后禁止进入的个税修改相关页 */
  var TAX_EDIT_BLOCKED_PAGES = {
    'consult.html': true
  };

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
    var page = currentPage();
    if (!TAX_EDIT_BLOCKED_PAGES[page]) return;
    if (isTaxEditModeOn()) return;
    /* 尚无个税记录时允许进入引导填写，并自动打开编辑 */
    if (page === 'consult.html' && !hasTaxRecords()) {
      ensureTaxEditForFill();
      return;
    }
    /* 关闭编辑时静默回「我的」，不弹提示 */
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
    var MAX_TAP_MS = 750;

    function onShortTap(e) {
      if (e && e.target && e.target.closest && e.target.closest('#mineActivateBtn')) {
        return;
      }
      var dt = Date.now() - touchStartAt;
      if (touchMoved || (touchStartAt && dt > MAX_TAP_MS)) return;
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

  // === 截图 / 水印模式 ===
  /**
   * session 截图模式：隐藏演示 UI / 水印相关入口，便于用户截真实界面。
   * @returns {boolean}
   */
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

  /**
   * 开关截图模式（session）；同步 html class 与「我的」按钮文案。
   * @param {boolean} on
   */
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

  function isGithubRegisterSource() {
    try {
      var promo = String(localStorage.getItem('sales_promo_channel') || '')
        .trim()
        .toLowerCase();
      if (promo === 'github') return true;
      if (typeof window.getSalesChannel === 'function') {
        var ch = String(window.getSalesChannel() || '')
          .trim()
          .toLowerCase();
        if (ch === 'github') return true;
      }
      var rawCh = localStorage.getItem('sales_channel_v1');
      if (rawCh) {
        var oc = JSON.parse(rawCh);
        if (oc && String(oc.ch || '').trim().toLowerCase() === 'github') return true;
      }
    } catch (e0) {}
    return false;
  }

  function githubBlocksDemoEscape() {
    return isGithubRegisterSource() && !isAccountActive();
  }

  function toggleScreenshotMode() {
    if (!isScreenshotModeOn() && !isAccountActive() && !isLandingGuest()) {
      openPayGateModal({
        feature: '截图',
        from: 'gate_screenshot',
        title: '无水印截图需开通',
        message: githubBlocksDemoEscape()
          ? '未开通记录带水印，不能当正式截图用。开通后去掉水印。GitHub 来源没有免费激活码。'
          : '开通后页面不再叠加未激活水印，截图更干净。也可先进入截图模式（水印仍在）。',
        allowContinue: !githubBlocksDemoEscape(),
        continueLabel: '先进入截图模式',
        onContinue: function () {
          setScreenshotMode(true);
        }
      });
      return;
    }
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
    openPayGateModal({
      title: title || '提示',
      message: message || '',
      primaryLabel: primaryLabel || '确定',
      onPrimary: primaryFn,
      allowContinue: false
    });
  }

  // === 激活 UI / 开通门禁 ===
  /**
   * 未开通能力轻量卡点：主按钮去支付，可选「先看看」继续原操作。
   * opts: { feature, from, title, message, allowContinue, continueLabel, onContinue, onPrimary }
   */
  function openPayGateModal(opts) {
    opts = opts || {};
    ensureGateStyles();
    var existing = document.getElementById('cg-pay-gate-root');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var feature = String(opts.feature || '').trim();
    var from = String(opts.from || '').trim() || 'gate_' + (feature || currentPage().replace(/\.html$/, '') || 'feature');
    var title = opts.title || (feature ? '「' + feature + '」需开通后使用' : '开通后可使用完整功能');
    var message =
      opts.message ||
      (feature
        ? '当前账号尚未开通。开通后可去水印，并完整使用「' + feature + '」等能力。'
        : '当前账号尚未开通。开通后可去水印、导出证明并使用完整功能。');
    var allowContinue = opts.allowContinue === true;
    var primaryLabel = opts.primaryLabel || '去开通';
    var continueLabel = opts.continueLabel || '先看看';

    track('track_conversion_gate_activate', {
      page: currentPage(),
      feature: feature || '',
      from: from
    });

    var root = document.createElement('div');
    root.id = 'cg-pay-gate-root';
    root.className = 'cg-pay-gate-root';
    root.innerHTML =
      '<div class="cg-pay-gate-mask" data-act="mask"></div>' +
      '<div class="cg-pay-gate-panel" role="dialog" aria-modal="true" aria-labelledby="cgPayGateTitle">' +
      '<h3 id="cgPayGateTitle" class="cg-pay-gate-title"></h3>' +
      '<p class="cg-pay-gate-body"></p>' +
      '<div class="cg-pay-gate-actions">' +
      '<button type="button" class="cg-pay-gate-btn primary" data-act="primary"></button>' +
      (allowContinue
        ? '<button type="button" class="cg-pay-gate-btn secondary" data-act="continue"></button>'
        : '') +
      '<button type="button" class="cg-pay-gate-btn ghost" data-act="close">取消</button>' +
      '</div></div>';
    root.querySelector('.cg-pay-gate-title').textContent = title;
    root.querySelector('.cg-pay-gate-body').textContent = message;
    root.querySelector('[data-act="primary"]').textContent = primaryLabel;
    if (allowContinue) {
      root.querySelector('[data-act="continue"]').textContent = continueLabel;
    }

    function close() {
      if (root.parentNode) root.parentNode.removeChild(root);
    }

    root.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-act]');
      if (!t) return;
      var act = t.getAttribute('data-act');
      if (act === 'mask' || act === 'close') {
        track('track_conversion_gate_dismiss', { page: currentPage(), feature: feature, from: from });
        close();
        return;
      }
      if (act === 'primary') {
        track('track_conversion_gate_cta', { page: currentPage(), feature: feature, from: from });
        close();
        if (typeof opts.onPrimary === 'function') {
          opts.onPrimary();
        } else {
          goActivate(from);
        }
        return;
      }
      if (act === 'continue') {
        track('track_conversion_gate_continue', { page: currentPage(), feature: feature, from: from });
        close();
        if (typeof opts.onContinue === 'function') opts.onContinue();
      }
    });

    document.body.appendChild(root);
  }

  /**
   * 未开通拦截并弹层；已开通返回 true。游客引导下载。
   * @param {string} [featureName]
   * @returns {boolean}
   */
  function gateActivation(featureName) {
    if (isAccountActive()) return true;
    if (isLandingGuest()) {
      openPayGateModal({
        feature: featureName || '',
        from: 'gate_guest_' + String(featureName || 'feature').replace(/\s+/g, '_'),
        title: '下载 App 后可用',
        message:
          '游客模式可先体验基础功能。下载 App 并注册后，可将已填写资料同步保存' +
          (featureName ? '，再使用「' + featureName + '」' : '') +
          '。',
        primaryLabel: '去下载',
        allowContinue: false,
        onPrimary: function () {
          goActivate('gate_guest');
        }
      });
      return false;
    }
    openPayGateModal({
      feature: featureName || '',
      from: 'gate_' + String(featureName || 'feature').replace(/\s+/g, '_'),
      allowContinue: false
    });
    return false;
  }

  /** 未开通时拦截并弹层；已开通返回 true。allowContinue 时提供「先看看」。 */
  function requirePayOrContinue(featureName, from, onContinue) {
    if (isAccountActive()) return true;
    openPayGateModal({
      feature: featureName || '',
      from: from || 'gate_' + String(featureName || 'feature').replace(/\s+/g, '_'),
      allowContinue: typeof onContinue === 'function',
      onContinue: onContinue
    });
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
    /* 正式用户：我的页不再铺顶部个税强引导 */
    if (!isLandingGuest()) {
      removeMineTaxStrongPrompt();
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
    var mode = urlParam('onboarding');
    if (mode === ONBOARD_EDIT) {
      runPostActivateEditOnboarding();
      return;
    }
    if (mode !== ONBOARD_TAX) return;
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

  function runPostActivateEditOnboarding() {
    if (typeof switchTab === 'function') {
      try {
        switchTab('records', false);
      } catch (e) {}
    }
    track('track_post_activate_edit_guide_show', {
      page: 'consult',
      source: 'onboarding_edit',
      tax_count: taxRecordCount()
    });
    setTimeout(function () {
      var panel = document.getElementById('panel-records');
      if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      renderConsultPostActivateEditBanner(true);
    }, 650);
  }

  function showPostActivateEditCoachMark() {
    if (document.getElementById('cg-edit-coach-mark')) return;
    ensureGateStyles();
    var firstCard = document.querySelector('#recordListMount .record-card');
    if (!firstCard) {
      showCaptureToast('已开通！点下方记录卡片即可修改个税数据', { duration: 4500 });
      return;
    }
    var rect = firstCard.getBoundingClientRect();
    var mark = document.createElement('div');
    mark.id = 'cg-edit-coach-mark';
    mark.className = 'cg-edit-coach-mark';
    mark.setAttribute('role', 'status');
    mark.textContent = '点这条记录即可修改';
    document.body.appendChild(mark);
    var markRect = mark.getBoundingClientRect();
    var top = rect.top - markRect.height - 14;
    var placeBelow = top < 12;
    if (placeBelow) {
      mark.classList.add('is-below');
      top = rect.bottom + 14;
    } else {
      mark.classList.add('is-above');
    }
    var left = Math.max(12, Math.min(rect.left, window.innerWidth - markRect.width - 12));
    mark.style.top = top + 'px';
    mark.style.left = left + 'px';
    firstCard.style.boxShadow = '0 0 0 3px rgba(5,150,105,.45)';
    firstCard.style.position = 'relative';
    firstCard.style.zIndex = '2';
    setTimeout(function () {
      if (mark.parentNode) mark.parentNode.removeChild(mark);
      firstCard.style.boxShadow = '';
      firstCard.style.position = '';
      firstCard.style.zIndex = '';
    }, 5200);
  }

  function removePostActivateMineEditBanner() {
    var el = document.getElementById('cg-post-activate-edit-banner');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function removeConsultPostActivateEditBanner() {
    var el = document.getElementById('cg-consult-edit-banner');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function renderPostActivateMineEditBanner() {
    removePostActivateMineEditBanner();
    if (currentPage() !== 'mine.html') return;
    if (!isAccountActive() || !hasTaxRecords()) return;
    if (!isPostActivatePending()) return;
    ensureGateStyles();
    var banner = document.createElement('div');
    banner.id = 'cg-post-activate-edit-banner';
    banner.className = 'cg-post-activate-edit-banner cg-demo-only';
    banner.innerHTML =
      '<button type="button" class="cg-dismiss" id="cgPostActivateEditDismiss" aria-label="知道了">知道了</button>' +
      '<h4>已开通 · 现在可以编辑个税了</h4>' +
      '<p>入口在下方「我要咨询」。进入后切换到「税务记录」，点记录卡片即可修改。</p>' +
      '<button type="button" class="cg-btn-primary" id="cgPostActivateEditGo">去编辑个税记录</button>';
    var stack = document.querySelector('.mine-stack');
    var canvas = document.getElementById('mineE1Canvas');
    if (stack && canvas && canvas.parentNode === stack) {
      stack.insertBefore(banner, canvas);
    } else if (stack) {
      stack.insertBefore(banner, stack.firstChild);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
    track('track_post_activate_edit_guide_show', {
      page: 'mine',
      source: 'mine_banner',
      tax_count: taxRecordCount()
    });
    var goBtn = document.getElementById('cgPostActivateEditGo');
    if (goBtn) {
      goBtn.onclick = function () {
        track('track_post_activate_edit_guide_ok', { page: 'mine', source: 'mine_banner' });
        clearPostActivatePending();
        goEditTaxRecords();
      };
    }
    var dismiss = document.getElementById('cgPostActivateEditDismiss');
    if (dismiss) {
      dismiss.onclick = function () {
        markTaxEditGuideDismissedToday();
        clearPostActivatePending();
        track('track_post_activate_edit_guide_dismiss', { page: 'mine', source: 'mine_banner' });
        removePostActivateMineEditBanner();
      };
    }
  }

  function renderConsultPostActivateEditBanner(force) {
    if (currentPage() !== 'consult.html') return;
    if (!isAccountActive() || !hasTaxRecords()) return;
    if (!force && !isPostActivatePending() && isTaxEditGuideDismissedToday()) return;
    if (!force && !isPostActivatePending()) return;
    removeConsultPostActivateEditBanner();
    ensureGateStyles();
    var host = document.getElementById('taxPayGuideBanner') || document.getElementById('recordListMount');
    if (!host || !host.parentNode) return;
    var banner = document.createElement('div');
    banner.id = 'cg-consult-edit-banner';
    banner.className = 'cg-consult-edit-banner cg-demo-only';
    banner.innerHTML =
      '<button type="button" class="cg-dismiss" id="cgConsultEditDismiss" aria-label="知道了">×</button>' +
      '<strong>已开通 · 在这里编辑个税</strong>' +
      '<span>点下方记录卡片即可修改；批量调整可用「回填修改」，删除请点「管理」。</span>';
    host.parentNode.insertBefore(banner, host);
    if (force) {
      track('track_post_activate_edit_guide_show', {
        page: 'consult',
        source: 'consult_banner',
        tax_count: taxRecordCount()
      });
    }
    var dismiss = document.getElementById('cgConsultEditDismiss');
    if (dismiss) {
      dismiss.onclick = function () {
        markTaxEditGuideDismissedToday();
        clearPostActivatePending();
        track('track_post_activate_edit_guide_dismiss', { page: 'consult', source: 'consult_banner' });
        removeConsultPostActivateEditBanner();
      };
    }
  }

  function syncConsultEditGuideAfterRecordsLoad() {
    renderConsultPostActivateEditBanner(false);
    if (urlParam('onboarding') === ONBOARD_EDIT) {
      setTimeout(showPostActivateEditCoachMark, 100);
    }
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
    try {
      sessionStorage.setItem(POST_ACTIVATE_PENDING_KEY, '1');
    } catch (e0) {}
    var taxN = taxRecordCount();
    if (taxN > 0 && typeof showCaptureToast === 'function') {
      showCaptureToast('已开通！编辑入口：我的 → 我要咨询 → 税务记录', { duration: 4200 });
    }
    setTimeout(function () {
      window.location.href = 'activate_success.html';
    }, 300);
  }

  function goNajilu() {
    window.location.href = 'najilu.html';
  }

  function goNajiluQrReplace(from) {
    window.location.href = 'najilu_qr.html?from=' + encodeURIComponent(from || 'najilu');
  }

  /** 未激活用户点「生成纳税记录」：引导去替换完税二维码，不静默出图。 */
  function openInactiveNajiluGenerateGuide() {
    openPayGateModal({
      feature: '纳税记录',
      from: 'gate_najilu_generate',
      title: '请先替换完税二维码',
      message: '当前账号未激活。请先替换完税二维码，再用官方 APP 扫码查验。未付款也可试用（含水印）。',
      primaryLabel: '去替换',
      allowContinue: false,
      onPrimary: function () {
        goNajiluQrReplace('najilu_generate');
      }
    });
  }

  function showValueConfirmDialog(year) {
    if (document.getElementById('cg-value-overlay')) return;
    ensureGateStyles();
    var guest = isLandingGuest();
    var inactive = !guest && !isAccountActive();
    var ov = document.createElement('div');
    ov.id = 'cg-value-overlay';
    ov.className = 'cg-value-overlay';
    ov.innerHTML =
      '<div class="cg-value-panel" role="dialog" aria-labelledby="cgValueTitle">' +
      '<h3 id="cgValueTitle">' +
      (guest ? '填写完成，下载可带走资料' : inactive ? '记录已生成' : '演示数据已生成') +
      '</h3>' +
      '<p>' +
      (guest
        ? '已生成个税演示数据。建议立即下载 App 并注册，同步当前填写内容，避免清缓存后丢失。'
        : inactive
          ? '可先测算近三年大约可退税额。开通后可去水印、完整查看详情并导出纳税证明。也可先预览收入明细。'
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
      (inactive
        ? '<button type="button" class="cg-btn cg-btn-primary" id="cgValueGoRefund">查看可退税额</button>'
        : '') +
      (guest || inactive
        ? ''
        : '<button type="button" class="cg-btn cg-btn-primary" id="cgValueShareFriend">分享给好友</button>') +
      '<button type="button" class="cg-btn cg-btn-primary" id="cgValueGoDetail"' +
      (guest || inactive ? ' style="background:#008afd;"' : '') +
      '>' +
      (inactive ? '先查看收入明细' : '查看收入纳税明细') +
      '</button>' +
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
    var refundBtn = document.getElementById('cgValueGoRefund');
    if (refundBtn) {
      refundBtn.onclick = function () {
        track('track_tax_pay_guide_cta', {
          page: currentPage(),
          from: 'tax_done',
          source: 'value_confirm'
        });
        closeOv('refund_ad');
        window.location.href = refundAdAfterTaxHref(year);
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

  // === 二次退税广告推荐 ===
  function hasSeenRefundAdAfterTax() {
    try {
      return localStorage.getItem(REFUND_AD_AFTER_TAX_KEY) === '1';
    } catch (eSeen) {
      return true;
    }
  }

  function markRefundAdAfterTaxSeen() {
    try {
      localStorage.setItem(REFUND_AD_AFTER_TAX_KEY, '1');
    } catch (eMark) {}
  }

  function refundAdAfterTaxHref(year, reason, estimate) {
    var href =
      'refund_ad.html?from=tax_done&year=' + encodeURIComponent(String(year || ''));
    if (reason) href += '&reason=' + encodeURIComponent(String(reason));
    if (estimate && estimate.total > 0) {
      href += '&est=' + encodeURIComponent(String(Math.round(estimate.total)));
    }
    if (estimate && estimate.year_list) {
      href += '&years=' + encodeURIComponent(String(estimate.year_list));
    }
    return href;
  }

  function parseTaxReportedAmount(val) {
    var n = parseFloat(String(val == null ? '' : val).replace(/,/g, ''));
    return isFinite(n) && n >= 0 ? n : 0;
  }

  function isExampleCompanyRecord(r) {
    return String((r && r.company_name) || '').indexOf('示例') >= 0;
  }

  function recordMonthIncome(r) {
    var a = parseTaxReportedAmount(r && r.income_this_period);
    var b = parseTaxReportedAmount(r && r.income);
    return a > b ? a : b;
  }

  function taxReportedSumForYear(records, year) {
    return yearRefundTotals(records, year).tax_sum;
  }

  function yearIncomeSumForYear(records, year) {
    return yearRefundTotals(records, year).income_sum;
  }

  /**
   * 汇总某年非示例记录的税额与月收入，并打 tax/income/both 资格标记。
   * @param {Array} records
   * @param {number|string} year
   * @returns {{year:number,tax_sum:number,income_sum:number,month_count:number,record_count:number,tax_hit:boolean,income_hit:boolean,reason:string}}
   */
  function yearRefundTotals(records, year) {
    var y = parseInt(String(year), 10);
    var tax = 0;
    var income = 0;
    var recordCount = 0;
    var months = {};
    if (!y || !records || !records.length) {
      return emptyYearRefundTotals(y);
    }
    records.forEach(function (r) {
      if (!r || isExampleCompanyRecord(r)) return;
      if (parseInt(String(r.year), 10) !== y) return;
      recordCount += 1;
      tax += parseTaxReportedAmount(r.tax_reported);
      income += recordMonthIncome(r);
      var m = parseInt(String(r.month), 10);
      if (m >= 1 && m <= 12) months[m] = true;
    });
    tax = Math.round(tax * 100) / 100;
    income = Math.round(income * 100) / 100;
    var monthCount = Object.keys(months).length;
    if (!monthCount && recordCount > 0) {
      monthCount = Math.min(12, recordCount);
    }
    var taxHit = tax > REFUND_AD_MIN_TAX_REPORTED;
    var incomeHit = income >= REFUND_AD_MIN_YEAR_INCOME;
    var reason = '';
    if (taxHit && incomeHit) reason = 'both';
    else if (taxHit) reason = 'tax';
    else if (incomeHit) reason = 'income';
    return {
      year: y,
      tax_sum: tax,
      income_sum: income,
      month_count: monthCount,
      record_count: recordCount,
      tax_hit: taxHit,
      income_hit: incomeHit,
      reason: reason
    };
  }

  function emptyYearRefundTotals(year) {
    return {
      year: year || 0,
      tax_sum: 0,
      income_sum: 0,
      month_count: 0,
      record_count: 0,
      tax_hit: false,
      income_hit: false,
      reason: ''
    };
  }

  function roundRefundMoney(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  /** 综合所得年度税率表：应纳税额 = 应纳税所得额 × 税率 − 速算扣除数 */
  function iitComprehensiveTax(taxable) {
    var t = Math.max(0, Number(taxable) || 0);
    var rate;
    var quick;
    if (t <= 36000) {
      rate = 0.03;
      quick = 0;
    } else if (t <= 144000) {
      rate = 0.1;
      quick = 2520;
    } else if (t <= 300000) {
      rate = 0.2;
      quick = 16920;
    } else if (t <= 420000) {
      rate = 0.25;
      quick = 31920;
    } else if (t <= 660000) {
      rate = 0.3;
      quick = 52920;
    } else if (t <= 960000) {
      rate = 0.35;
      quick = 85920;
    } else {
      rate = 0.45;
      quick = 181920;
    }
    return Math.max(0, roundRefundMoney(t * rate - quick));
  }

  function formatRefundYuan(n) {
    var v = Math.round(Number(n) || 0);
    var s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (v < 0 ? '-¥' : '¥') + s;
  }

  /**
   * 按 3 个子女 4500/月 + 赡养父母 3000/月，对照 2023–2025 记录估算可退税额。
   * 有已缴税额时不超过该年已缴；测算仅供转化展示。
   */
  function specialDeductionRefundEstimate(records) {
    var years = [];
    var total = 0;
    REFUND_AD_TAX_YEARS.forEach(function (y) {
      var row = yearRefundTotals(records, y);
      if (!(row.income_sum > 0 || row.tax_sum > 0)) return;
      var months = row.month_count || 0;
      if (!months) months = 12;
      var extra = REFUND_MONTHLY_EXTRA * months;
      var beforeTaxable = Math.max(0, row.income_sum - REFUND_BASIC_DEDUCTION);
      var afterTaxable = Math.max(0, row.income_sum - REFUND_BASIC_DEDUCTION - extra);
      var saved = roundRefundMoney(
        iitComprehensiveTax(beforeTaxable) - iitComprehensiveTax(afterTaxable)
      );
      if (row.tax_sum > 0) saved = Math.min(saved, row.tax_sum);
      saved = Math.max(0, roundRefundMoney(saved));
      years.push({
        year: y,
        months: months,
        income: row.income_sum,
        tax_reported: row.tax_sum,
        extra: extra,
        saved: saved
      });
      total += saved;
    });
    years.sort(function (a, b) {
      return b.year - a.year;
    });
    total = roundRefundMoney(total);
    return {
      total: total,
      years: years,
      year_list: years
        .map(function (r) {
          return r.year;
        })
        .join(','),
      child_month: REFUND_CHILD_MONTH,
      parent_month: REFUND_PARENT_MONTH,
      monthly_extra: REFUND_MONTHLY_EXTRA
    };
  }

  function persistRefundEstimate(estimate) {
    try {
      localStorage.setItem(REFUND_AD_ESTIMATE_KEY, JSON.stringify(estimate || {}));
    } catch (eEst) {}
  }

  function refundAdYearHits(records) {
    var hits = [];
    REFUND_AD_TAX_YEARS.forEach(function (y) {
      var row = yearRefundTotals(records, y);
      if (row.reason) hits.push(row);
    });
    hits.sort(function (a, b) {
      return b.year - a.year;
    });
    return hits;
  }

  function refundAdTaxYearHits(records) {
    return refundAdYearHits(records);
  }

  function qualifiesForRefundAdAfterTax(records) {
    return refundAdYearHits(records).length > 0;
  }

  function primaryRefundAdTaxHit(records) {
    var hits = refundAdYearHits(records);
    return hits.length ? hits[0] : null;
  }

  /** 优先取「年收入≥15万」命中（含 both），用于推荐去广告页浏览 */
  function primaryIncomeRefundHit(records) {
    var hits = refundAdYearHits(records || []);
    for (var i = 0; i < hits.length; i++) {
      if (hits[i] && (hits[i].reason === 'income' || hits[i].reason === 'both')) {
        return hits[i];
      }
    }
    return null;
  }

  function refundAdHitCardCopy(hit) {
    if (!hit || !hit.year) return '';
    if (hit.reason === 'income') {
      return '你 ' + hit.year + ' 年收入已超 15 万，可看是否符合二次退税';
    }
    if (hit.reason === 'both') {
      return '你 ' + hit.year + ' 年缴税和收入都较高，可看是否符合二次退税';
    }
    return '你 ' + hit.year + ' 年缴税已超 5000，可看是否符合二次退税';
  }

  function refundAdIncomeBrowseCopy(hit) {
    if (hit && hit.year) {
      return (
        '根据你填写的记录，' +
        hit.year +
        ' 年收入已超过 15 万。建议去广告页了解是否符合二次退税，可随时返回。'
      );
    }
    return '根据你填写的记录，年收入已超过 15 万。建议去广告页了解是否符合二次退税，可随时返回。';
  }

  function refundAdHitToastCopy(hit) {
    if (!hit || !hit.year) return '看一眼是否符合二次退税';
    if (hit.reason === 'income') {
      return hit.year + ' 年收入已超 15 万，看一眼是否符合二次退税';
    }
    if (hit.reason === 'both') {
      return hit.year + ' 年缴税和收入都较高，看一眼是否符合二次退税';
    }
    return hit.year + ' 年已缴税额较高，看一眼是否符合二次退税';
  }

  function refundAdRecommendHref(from, hit) {
    var href = 'refund_ad.html?from=' + encodeURIComponent(String(from || 'consult'));
    if (hit && hit.year) href += '&year=' + encodeURIComponent(String(hit.year));
    if (hit && hit.reason) href += '&reason=' + encodeURIComponent(String(hit.reason));
    return href;
  }

  function hasDismissedIncomeRefundRecommend() {
    try {
      return localStorage.getItem(REFUND_AD_INCOME_RECOMMEND_KEY) === '1';
    } catch (eSeen) {
      return true;
    }
  }

  function markIncomeRefundRecommendDismissed() {
    try {
      localStorage.setItem(REFUND_AD_INCOME_RECOMMEND_KEY, '1');
    } catch (eMark) {}
  }

  function beijingDayKey() {
    try {
      return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    } catch (eDay) {
      return '';
    }
  }

  function hasIncomeRecommendShownToday() {
    try {
      var day = beijingDayKey();
      return !!day && localStorage.getItem(REFUND_AD_INCOME_RECOMMEND_SHOW_DAY_KEY) === day;
    } catch (eShown) {
      return false;
    }
  }

  function markIncomeRecommendShownToday() {
    try {
      var day = beijingDayKey();
      if (day) localStorage.setItem(REFUND_AD_INCOME_RECOMMEND_SHOW_DAY_KEY, day);
    } catch (eMark) {}
  }

  function hasCopiedRefundWechat() {
    try {
      return localStorage.getItem(REFUND_AD_WECHAT_COPIED_KEY) === '1';
    } catch (eCopy) {
      return false;
    }
  }

  function shouldSuppressIncomeRefundRecommend() {
    return hasDismissedIncomeRefundRecommend() || hasCopiedRefundWechat();
  }

  function trackIncomeRecommendShowOnce(meta) {
    if (hasIncomeRecommendShownToday() || window.__refundAdIncomeConsultShowTracked) {
      return false;
    }
    window.__refundAdIncomeConsultShowTracked = true;
    markIncomeRecommendShownToday();
    track('track_refund_ad_income_recommend_show', meta || {});
    return true;
  }

  function isInactiveRefundCardUser() {
    if (!isLoggedIn() || isLandingGuest() || isAccountActive()) return false;
    if (typeof window.__smAccountActiveConfirmed === 'boolean') {
      return window.__smAccountActiveConfirmed === false;
    }
    try {
      return localStorage.getItem('account_active') === '0';
    } catch (eSeen) {
      return false;
    }
  }

  function refundAdInactivePromptCopy(hit) {
    if (hit && hit.year) {
      return refundAdHitCardCopy(hit) + '。可一键计算 2023–2025 可退税额，联系客服办理。';
    }
    return '未开通也可先看二次退税：一键计算 2023、2024、2025 大约可退金额，符合请联系客服。';
  }

  function syncShuimingInactivePrompt(records) {
    hideLegacyShuimingRefundWechatCard();
    var card = document.getElementById('smActivateCard');
    if (!card) return;
    var title = document.getElementById('smActivateTitle');
    var desc = document.getElementById('smActivateDesc');
    var btn = document.getElementById('smActivateBtn');
    if (!isInactiveRefundCardUser()) {
      card.hidden = true;
      card.setAttribute('hidden', '');
      card.classList.remove('is-refund-prompt');
      return;
    }
    var hit = primaryRefundAdTaxHit(records || []);
    card.hidden = false;
    card.classList.add('is-refund-prompt');
    if (title) title.textContent = '二次退税咨询';
    if (desc) desc.textContent = refundAdInactivePromptCopy(hit);
    if (btn) {
      btn.textContent = '去计算可退税额';
      btn.setAttribute('href', refundAdRecommendHref('shuiming_result', hit));
    }
  }

  /** 已开通且年收入≥15万：明细页不再展示，改在「我要咨询」填写区推荐 */
  function syncShuimingIncomeBrowseCard(records) {
    var card = document.getElementById('smRefundBrowseCard');
    if (!card) return;
    card.hidden = true;
    card.setAttribute('hidden', '');
  }

  /**
   * 同步咨询页退税入口卡：未激活一律推二次退税广告；已激活且年收入≥15万推广告浏览。
   * @param {Array} [records]
   */
  function syncRefundAdRecommendCards(records) {
    hideLegacyShuimingRefundWechatCard();
    syncShuimingInactivePrompt(records);
    syncShuimingIncomeBrowseCard(records);
    var hit = primaryRefundAdTaxHit(records);
    var incomeHit = primaryIncomeRefundHit(records);
    var inactive = isInactiveRefundCardUser();
    var loggedIn = isLoggedIn() && !isLandingGuest();
    var showInactive = inactive;
    var showActiveBrowse =
      loggedIn && !inactive && !!incomeHit && !shouldSuppressIncomeRefundRecommend();
    var show = showInactive || showActiveBrowse;
    var browseHit = incomeHit || hit;
    var copy = showActiveBrowse
      ? refundAdIncomeBrowseCopy(incomeHit)
      : refundAdInactivePromptCopy(hit);
    var nodes = [
      {
        root: 'consultRefundAdEntry',
        title: 'consultRefundAdTitle',
        hint: 'consultRefundAdHint',
        btn: 'btnConsultRefundAd',
        badge: 'consultRefundAdBadge',
        from: 'consult'
      },
      {
        root: 'consultRefundAdProductEntry',
        title: 'consultRefundAdProductTitle',
        hint: 'consultRefundAdProductHint',
        btn: 'btnConsultRefundAdProducts',
        badge: 'consultRefundAdProductBadge',
        from: 'consult_products'
      }
    ];
    nodes.forEach(function (spec) {
      var root = document.getElementById(spec.root);
      if (!root) return;
      if (!show) {
        root.hidden = true;
        root.classList.remove('is-refund-qualified', 'is-income-browse');
        return;
      }
      root.hidden = false;
      root.classList.add('is-refund-qualified');
      root.classList.toggle('is-income-browse', !!showActiveBrowse);
      var titleEl = spec.title ? document.getElementById(spec.title) : null;
      if (titleEl) {
        if (showActiveBrowse) {
          titleEl.textContent =
            incomeHit && incomeHit.year
              ? incomeHit.year + ' 年收入已超 15 万'
              : '年收入已超 15 万';
        } else {
          titleEl.textContent = '二次退税咨询';
        }
      }
      var hint = spec.hint ? document.getElementById(spec.hint) : null;
      if (hint) hint.textContent = copy;
      var badge = spec.badge ? document.getElementById(spec.badge) : null;
      if (badge) {
        badge.textContent = showActiveBrowse ? '建议浏览' : '未开通可看';
        badge.hidden = false;
      }
      var btn = document.getElementById(spec.btn);
      if (btn) {
        if (showActiveBrowse) {
          btn.textContent = '去广告页看看';
          btn.setAttribute('href', refundAdRecommendHref(spec.from, browseHit));
          if (!btn.getAttribute('data-income-browse-bound')) {
            btn.setAttribute('data-income-browse-bound', '1');
            btn.addEventListener('click', function () {
              track('track_refund_ad_income_recommend_click', {
                page: currentPage(),
                source: 'consult_card',
                from: spec.from,
                tax_year_gate: incomeHit && incomeHit.year,
                income_sum_gate: incomeHit && incomeHit.income_sum,
                reason: incomeHit && incomeHit.reason
              });
            });
          }
        } else {
          btn.textContent = '去计算可退税额';
          btn.setAttribute('href', refundAdRecommendHref(spec.from, hit));
          if (!btn.getAttribute('data-inactive-refund-bound')) {
            btn.setAttribute('data-inactive-refund-bound', '1');
            btn.addEventListener('click', function () {
              track('track_refund_ad_inactive_promo_click', {
                page: currentPage(),
                source: 'consult_card',
                from: spec.from
              });
            });
          }
        }
      }
    });
    if (showActiveBrowse) {
      trackIncomeRecommendShowOnce({
        page: currentPage(),
        source: 'consult_card',
        tax_year_gate: incomeHit && incomeHit.year,
        income_sum_gate: incomeHit && incomeHit.income_sum,
        reason: incomeHit && incomeHit.reason
      });
    } else if (showInactive && !window.__refundAdInactivePromoTracked) {
      window.__refundAdInactivePromoTracked = true;
      track('track_refund_ad_inactive_promo_show', {
        page: currentPage(),
        source: 'consult_card'
      });
    }
  }

  function resolveTaxRecordsForRefundAd(opts) {
    if (opts && Array.isArray(opts.records)) {
      return Promise.resolve(opts.records);
    }
    if (typeof apiFetchRecords === 'function') {
      return apiFetchRecords({ force: true });
    }
    return Promise.resolve(window.__consultRecordsCache || []);
  }

  function showIncomeRefundAdRecommendDialog(hit, opts) {
    opts = opts || {};
    if (document.getElementById('cg-income-refund-overlay')) return false;
    if (shouldSuppressIncomeRefundRecommend()) return false;
    if (hasIncomeRecommendShownToday()) return false;
    ensureGateStyles();
    var ov = document.createElement('div');
    ov.id = 'cg-income-refund-overlay';
    ov.className = 'cg-value-overlay';
    ov.innerHTML =
      '<div class="cg-value-panel" role="dialog" aria-labelledby="cgIncomeRefundTitle">' +
      '<h3 id="cgIncomeRefundTitle">年收入已超 15 万</h3>' +
      '<p>' +
      refundAdIncomeBrowseCopy(hit) +
      '</p>' +
      '<button type="button" class="cg-btn cg-btn-primary" id="cgIncomeRefundGo">去广告页看看</button>' +
      '<button type="button" class="cg-btn cg-btn-ghost" id="cgIncomeRefundLater">稍后再说</button>' +
      '</div>';
    document.body.appendChild(ov);
    trackIncomeRecommendShowOnce({
      page: currentPage(),
      source: opts.source || 'after_tax',
      tax_year_gate: hit && hit.year,
      income_sum_gate: hit && hit.income_sum,
      reason: hit && hit.reason
    });
    function closeOv(action) {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      if (typeof opts.onClose === 'function') opts.onClose(action);
    }
    document.getElementById('cgIncomeRefundGo').onclick = function () {
      markIncomeRefundRecommendDismissed();
      track('track_refund_ad_income_recommend_click', {
        page: currentPage(),
        source: opts.source || 'after_tax_dialog',
        tax_year_gate: hit && hit.year,
        income_sum_gate: hit && hit.income_sum,
        reason: hit && hit.reason
      });
      closeOv('go');
      window.location.href = refundAdRecommendHref(opts.from || 'tax_done', hit);
    };
    document.getElementById('cgIncomeRefundLater').onclick = function () {
      markIncomeRefundRecommendDismissed();
      track('track_refund_ad_income_recommend_dismiss', {
        page: currentPage(),
        source: opts.source || 'after_tax_dialog'
      });
      closeOv('later');
    };
    ov.addEventListener('click', function (e) {
      if (e.target === ov) {
        markIncomeRefundRecommendDismissed();
        closeOv('dismiss');
      }
    });
    return true;
  }

  /**
   * 年收入≥15万：推荐去广告页浏览。
   * 填完强制跳转未触发时（已看过 / 单条保存累计达标）出软弹窗。
   */
  function maybeRecommendIncomeRefundAd(opts, records, cont) {
    if (isLandingGuest() || !isLoggedIn()) {
      if (typeof cont === 'function') cont();
      return false;
    }
    if (shouldSuppressIncomeRefundRecommend()) {
      if (typeof cont === 'function') cont();
      return false;
    }
    if (hasIncomeRecommendShownToday()) {
      if (typeof cont === 'function') cont();
      return false;
    }
    var list = records || window.__consultRecordsCache || [];
    var hit = primaryIncomeRefundHit(list);
    if (!hit) {
      if (typeof cont === 'function') cont();
      return false;
    }
    return showIncomeRefundAdRecommendDialog(hit, {
      source: (opts && opts.source) || 'after_tax',
      from: 'tax_done',
      onClose: function (action) {
        if (action === 'go') return;
        if (typeof cont === 'function') cont();
      }
    });
  }

  /**
   * 填完 2023–2025 后强制弹框：展示专项附加扣除测算金额，只能去广告页。
   * 无「稍后再说」，点击遮罩不关闭。
   */
  function showSpecialDeductionRefundDialog(estimate, hit, opts, year) {
    opts = opts || {};
    if (document.getElementById('cg-refund-force-overlay')) return false;
    ensureGateStyles();
    persistRefundEstimate(estimate);
    var total = estimate && estimate.total > 0 ? Math.round(estimate.total) : 0;
    var yearLines = '';
    if (estimate && estimate.years && estimate.years.length) {
      yearLines = estimate.years
        .filter(function (r) {
          return r && r.saved > 0;
        })
        .map(function (r) {
          return r.year + ' 年约 ' + formatRefundYuan(r.saved);
        })
        .join('  ·  ');
    }
    var ov = document.createElement('div');
    ov.id = 'cg-refund-force-overlay';
    ov.className = 'cg-value-overlay';
    ov.setAttribute('data-cg-lock', '1');
    ov.innerHTML =
      '<div class="cg-value-panel is-refund-force" role="dialog" aria-modal="true" aria-labelledby="cgRefundForceTitle">' +
      '<p class="cg-refund-force-kicker">3 个子女 4500 元/月 + 赡养父母 3000 元/月</p>' +
      '<h3 id="cgRefundForceTitle">二次退税测算</h3>' +
      '<p class="cg-refund-force-amt" id="cgRefundForceAmt"></p>' +
      '<p class="cg-refund-force-years" id="cgRefundForceYears"></p>' +
      '<div class="cg-refund-force-why">' +
      '<strong>怎么退回来的</strong>' +
      '年度汇算清缴可以补报专项附加扣除。每月多扣 7500 元会降低应纳税所得额，已经多缴的个税符合条件可以退回。' +
      '</div>' +
      '<p class="cg-refund-force-note">测算仅供参考，实际金额以汇算清缴结果为准。</p>' +
      '<button type="button" class="cg-btn cg-btn-primary" id="cgRefundForceGo">查看可退金额与办理说明</button>' +
      '</div>';
    document.body.appendChild(ov);
    var amtEl = document.getElementById('cgRefundForceAmt');
    if (amtEl) {
      amtEl.textContent = total > 0 ? '约可退 ' + formatRefundYuan(total) : '顾问按记录核对金额';
    }
    var yEl = document.getElementById('cgRefundForceYears');
    if (yEl) yEl.textContent = yearLines;
    var allHits = refundAdYearHits((opts && opts._refundRecords) || window.__consultRecordsCache || []);
    track('track_refund_ad_after_tax_show', {
      page: currentPage(),
      source: opts.source || 'batch',
      estimate_total: total,
      tax_year_gate: hit && hit.year,
      reason: hit && hit.reason
    });
    var goBtn = document.getElementById('cgRefundForceGo');
    if (goBtn) {
      goBtn.onclick = function () {
        markRefundAdAfterTaxSeen();
        markIncomeRefundRecommendDismissed();
        track('track_refund_ad_after_tax_go', {
          page: currentPage(),
          source: opts.source || 'batch',
          tax_count: taxRecordCount(),
          tax_sum_gate: hit && hit.tax_sum,
          income_sum_gate: hit && hit.income_sum,
          tax_year_gate: hit && hit.year,
          reason: (hit && hit.reason) || 'estimate',
          estimate_total: total,
          tax_year_hits: allHits
            .map(function (h) {
              return h.year;
            })
            .join(',')
        });
        window.location.href = refundAdAfterTaxHref(
          (hit && hit.year) || year,
          hit && hit.reason,
          estimate
        );
      };
    }
    ov.addEventListener('click', function (e) {
      if (e.target === ov) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    return true;
  }

  /** 2023–2025 填完后强制弹框去广告页：有测算金额，或税额/收入达原门槛 */
  function maybeGoRefundAdAfterTax(opts, year, records) {
    if (isLandingGuest()) return false;
    if (!isLoggedIn()) return false;
    if (hasSeenRefundAdAfterTax()) return false;
    /* 单条保存多半还在补记录，等批量「填完」再带去，少中途打断 */
    if (opts && opts.source === 'single_save') return false;
    var list = records || window.__consultRecordsCache || [];
    var estimate = specialDeductionRefundEstimate(list);
    var hit = primaryRefundAdTaxHit(list);
    if (!(estimate && estimate.total > 0) && !hit) return false;
    markIncomeRefundRecommendDismissed();
    var dialogOpts = {};
    if (opts) {
      Object.keys(opts).forEach(function (k) {
        dialogOpts[k] = opts[k];
      });
    }
    dialogOpts._refundRecords = list;
    return showSpecialDeductionRefundDialog(estimate, hit, dialogOpts, year);
  }

  /**
   * 填税完成后的统一出口：优先强制退税广告 → 软推荐收入弹窗 → 价值确认 / 明细跳转。
   * @param {{source?: string, records?: Array}} [opts]
   */
  function afterTaxRecordsCreated(opts) {
    opts = opts || {};
    resolveTaxRecordsForRefundAd(opts).then(function (records) {
      syncRefundAdRecommendCards(records || []);
      var fromRecords = pickYearFromTaxRecords(records);
      var y = fromRecords != null ? fromRecords : fallbackSelectedTaxYear();
      if (fromRecords != null) persistSelectedTaxYear(y);
      if (maybeGoRefundAdAfterTax(opts, y, records)) return;
      function continueAfterTax() {
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
      if (maybeRecommendIncomeRefundAd(opts, records, continueAfterTax)) return;
      continueAfterTax();
    });
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
      var doSave = function () {
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
      if (!isAccountActive() && !isLandingGuest()) {
        openPayGateModal({
          feature: '导出',
          from: 'gate_export',
          title: '导出图片需开通',
          message: githubBlocksDemoEscape()
            ? '未开通只能看带水印预览。开通后导出无水印、带公章的清晰版。'
            : '开通后可导出无水印、带公章的清晰版本。也可先保存当前演示预览图。',
          allowContinue: !githubBlocksDemoEscape(),
          continueLabel: '先保存演示图',
          onContinue: doSave
        });
        return;
      }
      doSave();
    };
    document.getElementById('cgValueBarShare').onclick = function () {
      var doShare = function () {
        var url =
          typeof opts.getDataUrl === 'function'
            ? opts.getDataUrl()
            : buildShuimingSummaryDataUrl(opts.meta || {});
        shareImageDataUrl(url, opts.shareTitle || '收入纳税明细演示', opts.shareText || '');
      };
      if (!isAccountActive() && !isLandingGuest()) {
        openPayGateModal({
          feature: '分享导出',
          from: 'gate_share_export',
          title: '分享无水印图需开通',
          message: githubBlocksDemoEscape()
            ? '未开通不能分享去水印图。开通后可分享清晰版。'
            : '开通后可分享去水印版本。也可先分享当前演示预览。',
          allowContinue: !githubBlocksDemoEscape(),
          continueLabel: '先分享演示图',
          onContinue: doShare
        });
        return;
      }
      doShare();
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
    if (
      currentPage() !== 'shuiming_result.html' ||
      (urlParam('from') !== 'tax_save' && urlParam('from') !== 'tax_done')
    ) {
      return;
    }
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

  /** 收入纳税明细列表底部「去修改」文案已下线，不再展示 */
  function mountShuimingResultManageEntry() {
    var old = document.getElementById('cg-shuiming-result-edit-entry');
    if (old && old.parentNode) old.parentNode.removeChild(old);
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
    /* 收入纳税明细页顶部不再显示个税引导框 */
    return;
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

  // === 填税引导 / Nudge ===
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

  function removeInactiveRefundAdPromo() {
    var el = document.getElementById('cg-inactive-refund-promo');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  /** 首页：每个未激活用户展示二次退税广告入口 */
  function renderInactiveRefundAdPromo() {
    removeInactiveRefundAdPromo();
    if (currentPage() !== 'shouye.html') return;
    if (!isLoggedIn() || isLandingGuest() || skipConversionPromo()) return;
    if (!isInactiveRefundCardUser()) return;
    ensureGateStyles();
    var card = document.createElement('div');
    card.id = 'cg-inactive-refund-promo';
    card.className = 'cg-shouye-card is-tax-strong';
    card.innerHTML =
      '<h4>二次退税</h4>' +
      '<p>未开通也可先看。打开页面可一键计算 2023、2024、2025 大约可退税额，符合请联系客服办理。</p>' +
      '<a class="cg-btn cg-btn-primary" id="cgInactiveRefundGo" href="' +
      refundAdRecommendHref('shouye') +
      '">去计算可退税额</a>';
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
    track('track_refund_ad_inactive_promo_show', { page: 'shouye', source: 'home_card' });
    var btn = document.getElementById('cgInactiveRefundGo');
    if (btn) {
      btn.addEventListener('click', function () {
        track('track_refund_ad_inactive_promo_click', { page: 'shouye', source: 'home_card' });
      });
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
    /* 我的页不再展示顶部个税强引导 */
    removeMineTaxStrongPrompt();
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

  /**
   * 我的/首页：无个税时弹「请先添加个税」层（日频；注册后邮箱优先时延后）。
   */
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

  /** 详情 / 导出 / 截图 / 水印：未开通时轻量卡点引导去支付 */
  function bindPayFeatureGates() {
    if (!isLoggedIn() || isAccountActive()) return;
    var page = currentPage();

    if (page === 'najilu.html') {
      var genBtn = document.getElementById('generateBtn');
      if (genBtn && !genBtn.__cgPayGateBound) {
        genBtn.__cgPayGateBound = true;
        genBtn.addEventListener(
          'click',
          function (ev) {
            if (isAccountActive()) return;
            ev.preventDefault();
            ev.stopImmediatePropagation();
            openInactiveNajiluGenerateGuide();
          },
          true
        );
      }

      if (!document.body.__cgNajiluSaveGateBound) {
        document.body.__cgNajiluSaveGateBound = true;
        document.addEventListener(
          'click',
          function (ev) {
            if (isAccountActive()) return;
            var saveBtn = ev.target.closest(
              '.application-action[data-action="save"], #btnShareCertificate'
            );
            if (!saveBtn) return;
            if (saveBtn.__cgPayGatePass) {
              saveBtn.__cgPayGatePass = false;
              return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            openPayGateModal({
              feature: '导出',
              from: 'gate_najilu_save',
              title: '导出纳税记录需开通',
              message: '开通后可导出带公章、无水印的清晰版本。也可先保存当前演示图。',
              allowContinue: true,
              continueLabel: '先保存演示图',
              onContinue: function () {
                saveBtn.__cgPayGatePass = true;
                saveBtn.click();
              }
            });
          },
          true
        );
      }
    }
  }

  function removeWatermarkPayChip() {
    var old = document.getElementById('cg-wm-pay-chip');
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  // === 邮箱收集 Nudge ===
  function beijingDayKey() {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function isValidEmailClient(raw) {
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
          test: 1, asdf: 1, qwer: 1, abc: 1, abcd: 1, aaa: 1, aaaa: 1,
          xxx: 1, xxxx: 1, email: 1, mail: 1, none: 1, null: 1, undefined: 1,
          '123': 1, '1234': 1, '12345': 1, '123456': 1
      };
      var blockDomain = {
          'example.com': 1, 'example.org': 1, 'example.net': 1,
          'test.com': 1, 'test.cn': 1, 'test.org': 1,
          'asdf.com': 1, 'aaa.com': 1, 'xxx.com': 1,
          localhost: 1, invalid: 1, localdomain: 1
      };
      if (blockLocal[localKey] || blockDomain[domainKey]) return false;
      if (localKey.length <= 3 && labels[0].toLowerCase() === localKey) return false;
      return true;
  }

  function closeEmailCollectNudge() {
    var root = document.getElementById('cg-email-nudge-root');
    if (root && root.parentNode) root.parentNode.removeChild(root);
  }

  function markEmailNudgeDismissed() {
    try {
      localStorage.setItem(EMAIL_NUDGE_DISMISS_KEY, '1');
      localStorage.setItem(EMAIL_NUDGE_DAY_KEY, beijingDayKey());
    } catch (e) {}
  }

  function consumeEmailNudgeAfterRegisterFlag() {
    try {
      if (sessionStorage.getItem(EMAIL_NUDGE_AFTER_REGISTER_KEY) === '1') {
        sessionStorage.removeItem(EMAIL_NUDGE_AFTER_REGISTER_KEY);
        return true;
      }
    } catch (e0) {}
    return false;
  }

  function peekEmailNudgeAfterRegisterFlag() {
    try {
      return sessionStorage.getItem(EMAIL_NUDGE_AFTER_REGISTER_KEY) === '1';
    } catch (e0) {
      return false;
    }
  }

  /**
   * 引导填写邮箱（可跳过）。
   * @param {{force?: boolean, afterRegister?: boolean}} [opts]
   *   force / afterRegister：忽略当日限制与 dismiss；afterRegister 用半强制强文案（点遮罩不关闭）
   * @returns {boolean} 是否成功打开
   */
  function openEmailCollectNudge(opts) {
    opts = opts || {};
    var afterRegister = !!opts.afterRegister;
    var bypassLimits = afterRegister || !!opts.force;
    if (!isLoggedIn() || hasEmailCached) return false;
    if (document.getElementById('cg-email-nudge-root')) return false;
    if (document.getElementById('cg-act-nudge-root') || document.getElementById('cg-tax-fill-nudge-root')) {
      return false;
    }
    if (!bypassLimits) {
      try {
        if (localStorage.getItem(EMAIL_NUDGE_DISMISS_KEY) === '1') return false;
        if (localStorage.getItem(EMAIL_NUDGE_DAY_KEY) === beijingDayKey()) return false;
      } catch (eDay) {}
    }
    ensureGateStyles();
    var root = document.createElement('div');
    root.id = 'cg-email-nudge-root';
    root.className = 'cg-email-nudge-root' + (afterRegister ? ' is-strong' : '');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    var title = afterRegister ? '建议留下邮箱，方便接收优惠' : '留下邮箱，优惠不错过';
    var body = afterRegister
      ? '开通提醒、专属价会发到邮箱。现在填写最省事；也可跳过，之后在「个人信息」补填。'
      : '专属价、开通提醒会发到邮箱。可不填，随时在「个人信息」里补充。';
    var saveLabel = afterRegister ? '保存并继续' : '保存邮箱';
    var dismissLabel = afterRegister ? '跳过，稍后再说' : '暂时不用';
    var badgeHtml = afterRegister
      ? '<div class="cg-email-nudge-badge">注册成功 · 建议填写</div>'
      : '';
    root.innerHTML =
      '<div class="cg-email-nudge-mask"' +
      (afterRegister ? '' : ' data-act="dismiss"') +
      '></div>' +
      '<div class="cg-email-nudge-panel">' +
      badgeHtml +
      '<div class="cg-email-nudge-title">' +
      title +
      '</div>' +
      '<p class="cg-email-nudge-body">' +
      body +
      '</p>' +
      '<input type="email" class="cg-email-nudge-input" id="cgEmailNudgeInput" maxlength="255" placeholder="例如 name@qq.com" autocomplete="email" inputmode="email">' +
      '<div class="cg-email-nudge-err" id="cgEmailNudgeErr"></div>' +
      '<div class="cg-email-nudge-actions">' +
      '<button type="button" class="cg-email-nudge-btn primary" data-act="save">' +
      saveLabel +
      '</button>' +
      '<button type="button" class="cg-email-nudge-btn ghost" data-act="dismiss">' +
      dismissLabel +
      '</button>' +
      '</div></div>';
    document.body.appendChild(root);
    try {
      localStorage.setItem(EMAIL_NUDGE_DAY_KEY, beijingDayKey());
    } catch (eMark) {}
    try {
      if (typeof trackUserAction === 'function') {
        trackUserAction('track_email_collect_open', {
          after_register: afterRegister ? 1 : 0
        });
      }
    } catch (eTr) {}
    var input = document.getElementById('cgEmailNudgeInput');
    var errEl = document.getElementById('cgEmailNudgeErr');
    setTimeout(function () {
      if (input) input.focus();
    }, 80);
    root.addEventListener('click', function (ev) {
      var t = ev.target;
      var act = t && t.getAttribute ? t.getAttribute('data-act') : '';
      if (act === 'dismiss') {
        /* 注册后强引导：跳过只记当日，不永久 dismiss，便于改天再触达 */
        if (afterRegister) {
          try {
            localStorage.setItem(EMAIL_NUDGE_DAY_KEY, beijingDayKey());
          } catch (eDay2) {}
        } else {
          markEmailNudgeDismissed();
        }
        try {
          if (typeof trackUserAction === 'function') {
            trackUserAction('track_email_collect_dismiss', {
              after_register: afterRegister ? 1 : 0
            });
          }
        } catch (e1) {}
        closeEmailCollectNudge();
        return;
      }
      if (act !== 'save') return;
      var val = input ? String(input.value || '').trim() : '';
      if (!isValidEmailClient(val)) {
        if (errEl) errEl.textContent = '请填写有效邮箱，例如 name@qq.com（勿乱填）';
        return;
      }
      if (errEl) errEl.textContent = '';
      var btn = t;
      btn.disabled = true;
      if (typeof window.authFetch !== 'function') {
        btn.disabled = false;
        if (errEl) errEl.textContent = '请先登录';
        return;
      }
      window
        .authFetch('api/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_profile', email: val })
        })
        .then(function (r) {
          return (window.authParseJson||function(r){return r.json();})(r);
        })
        .then(function (data) {
          if (!data || data.code !== 200) {
            throw new Error((data && data.msg) || '保存失败');
          }
          hasEmailCached = true;
          try {
            localStorage.removeItem(EMAIL_NUDGE_DISMISS_KEY);
          } catch (e2) {}
          try {
            if (typeof trackUserAction === 'function') {
              trackUserAction('track_email_collect_save', {
                after_register: afterRegister ? 1 : 0
              });
            }
          } catch (e3) {}
          closeEmailCollectNudge();
          showCaptureToast('邮箱已保存', { duration: 1800 });
          fetchProfileCounts({ force: true });
        })
        .catch(function (e) {
          btn.disabled = false;
          if (errEl) errEl.textContent = (e && e.message) || '保存失败';
        });
    });
    return true;
  }

  function maybeScheduleEmailNudge() {
    if (!isLoggedIn() || hasEmailCached || skipConversionPromo()) return;
    var page = currentPage();
    var allow =
      page === 'mine.html' ||
      page === 'purchase.html' ||
      page === 'message.html' ||
      page === 'shouye.html';
    if (!allow) return;
    var afterReg = peekEmailNudgeAfterRegisterFlag();
    setTimeout(
      function () {
        var afterRegister = afterReg || false;
        if (afterReg) consumeEmailNudgeAfterRegisterFlag();
        openEmailCollectNudge(
          afterRegister ? { afterRegister: true, force: true } : {}
        );
      },
      afterReg ? 700 : page === 'purchase.html' ? 2200 : 1600
    );
  }

  /** 兼容旧缓存脚本仍会注入该浮钮：持续清理一段时间 */
  function guardRemoveWatermarkPayChip() {
    removeWatermarkPayChip();
    var left = 12;
    var timer = setInterval(function () {
      removeWatermarkPayChip();
      left -= 1;
      if (left <= 0) clearInterval(timer);
    }, 500);
  }

  /**
   * 页内启动：截图隐私 → 拉摘要 → 按页渲染引导；已激活走 skipConversionPromo 分支。
   */
  function init() {
    initCapturePrivacy();
    guardRemoveWatermarkPayChip();
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
      renderPostActivateMineEditBanner();
      patchShuimingResultEmpty();
      refreshShuimingResultEmptyCta();
      removeShuimingResultValueBar();
      syncMineConsultEntryForTax();
      renderShouyeTaxManageEntry();
      renderInactiveRefundAdPromo();
      renderMineTaxStrongPrompt();
      renderConsultTaxStrongPrompt();
      renderShouyeRetentionCard();
      syncRefundAdRecommendCards(
        Array.isArray(window.__consultRecordsCache) ? window.__consultRecordsCache : []
      );
      /* 注册成功优先留邮箱：延后个税弹窗，避免互相挡住 */
      var preferEmailAfterReg = peekEmailNudgeAfterRegisterFlag();
      if (preferEmailAfterReg) {
        maybeScheduleEmailNudge();
        setTimeout(function () {
          if (!document.getElementById('cg-email-nudge-root')) {
            maybeShowTaxFillNudge();
          }
        }, 2800);
      } else {
        setTimeout(maybeShowTaxFillNudge, 480);
      }
      bumpIncomeBrowseVisit();
      renderShuimingHint();
      if (!skipConversionPromo()) {
        renderAboutUpdateNudge();
        renderCareVersionHint();
        setTimeout(function () {
          if (
            !document.getElementById('cg-tax-fill-nudge-root') &&
            !document.getElementById('cg-email-nudge-root')
          ) {
            maybeShowActivationNudge();
          }
        }, 900);
        if (!preferEmailAfterReg) {
          maybeScheduleEmailNudge();
        }
      } else {
        renderAboutUpdateNudge();
      }
      maybeShowPostTaxSaveBanner();
      mountXiangqingEditEntry();
      mountShuimingResultManageEntry();
      bindPayFeatureGates();
      /* 列表异步返回后可能再次变空：短延迟再补一次 */
      setTimeout(refreshShuimingResultEmptyCta, 400);
      setTimeout(function () {
        renderConsultPostActivateEditBanner(false);
      }, 450);
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
        applyProfileSummary(cached, { fromCache: true });
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

  /**
   * 后台配置的激活留存弹层：按注册时长与日频限制展示。
   * skipConversionPromo / 游客 / 未激活 / 支付页 / 测算页不展示（未激活主 CTA 走测算页）。
   */
  function maybeShowActivationNudge() {
    if (!isLoggedIn() || skipConversionPromo() || isLandingGuest()) return;
    if (!isAccountActive()) return;
    if (isLightShellPage()) return;
    if (currentPage() === 'purchase.html' || currentPage() === 'refund_ad.html') return;
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

  /** @type {Object} 对外 API：业务页 / consult 脚本调用 */
  window.ConversionGuide = {
    isAccountActive: isAccountActive,
    hasTaxRecords: hasTaxRecords,
    goActivate: goActivate,
    goFillTaxRecords: goFillTaxRecords,
    goManageTaxRecords: goManageTaxRecords,
    goEditTaxRecords: goEditTaxRecords,
    syncConsultEditGuideAfterRecordsLoad: syncConsultEditGuideAfterRecordsLoad,
    goIncomeDetail: goIncomeDetail,
    pickYearFromTaxRecords: pickYearFromTaxRecords,
    goNajilu: goNajilu,
    goNajiluQrReplace: goNajiluQrReplace,
    openInactiveNajiluGenerateGuide: openInactiveNajiluGenerateGuide,
    gateActivation: gateActivation,
    gateTaxRecords: gateTaxRecords,
    openPayGateModal: openPayGateModal,
    requirePayOrContinue: requirePayOrContinue,
    removeMineConversionUi: removeMineConversionUi,
    getBatchExampleProminent: getBatchExampleProminent,
    afterActivateSuccess: afterActivateSuccess,
    afterTaxRecordsCreated: afterTaxRecordsCreated,
    maybeGoRefundAdAfterTax: maybeGoRefundAdAfterTax,
    maybeRecommendIncomeRefundAd: maybeRecommendIncomeRefundAd,
    specialDeductionRefundEstimate: specialDeductionRefundEstimate,
    iitComprehensiveTax: iitComprehensiveTax,
    formatRefundYuan: formatRefundYuan,
    primaryIncomeRefundHit: primaryIncomeRefundHit,
    taxReportedSumForYear: taxReportedSumForYear,
    yearIncomeSumForYear: yearIncomeSumForYear,
    yearRefundTotals: yearRefundTotals,
    qualifiesForRefundAdAfterTax: qualifiesForRefundAdAfterTax,
    refundAdTaxYearHits: refundAdTaxYearHits,
    refundAdYearHits: refundAdYearHits,
    refundAdHitCardCopy: refundAdHitCardCopy,
    syncRefundAdRecommendCards: syncRefundAdRecommendCards,
    syncShuimingInactivePrompt: syncShuimingInactivePrompt,
    syncShuimingIncomeBrowseCard: syncShuimingIncomeBrowseCard,
    afterEmployerSaved: afterEmployerSaved,
    onIncomeDetailEmpty: onIncomeDetailEmpty,
    mountShuimingValueBar: mountShuimingValueBar,
    mountNajiluPreviewBar: mountNajiluPreviewBar,
    prependMaintenanceMessages: prependMaintenanceMessages,
    openEmailCollectNudge: openEmailCollectNudge,
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
