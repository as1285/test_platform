/**
 * 二次退税测算：按 3 个子女 4500/月 + 赡养父母 3000/月，对照 2023–2025 记录估算可退税额。
 * 广告页一键计算与结果弹层也挂在本文件，避免与 conversion-guide 抢加载时机。
 */
(function (global) {
  var TAX_YEARS = [2023, 2024, 2025];
  var REFUND_CHILD_MONTH = 4500;
  var REFUND_PARENT_MONTH = 3000;
  var REFUND_MONTHLY_EXTRA = REFUND_CHILD_MONTH + REFUND_PARENT_MONTH;
  var REFUND_BASIC_DEDUCTION = 60000;
  var STORAGE_KEY = 'refund_ad_estimate_v1';

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

  function emptyYearRow(year) {
    return {
      year: year || 0,
      months: 0,
      income: 0,
      tax_reported: 0,
      extra: 0,
      saved: 0,
      has_records: false
    };
  }

  function yearTotals(records, year) {
    var y = parseInt(String(year), 10);
    var tax = 0;
    var income = 0;
    var recordCount = 0;
    var months = {};
    if (!y || !records || !records.length) {
      return { year: y, tax_sum: 0, income_sum: 0, month_count: 0, record_count: 0 };
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
    if (!monthCount && recordCount > 0) monthCount = Math.min(12, recordCount);
    return {
      year: y,
      tax_sum: tax,
      income_sum: income,
      month_count: monthCount,
      record_count: recordCount
    };
  }

  function roundRefundMoney(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

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

  function formatYuan(n) {
    var v = Math.round(Number(n) || 0);
    var s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (v < 0 ? '-¥' : '¥') + s;
  }

  function estimateYear(records, year) {
    var row = yearTotals(records, year);
    var has = row.income_sum > 0 || row.tax_sum > 0 || row.record_count > 0;
    if (!has) return emptyYearRow(year);
    var months = row.month_count || 0;
    if (!months) months = 12;
    var extra = REFUND_MONTHLY_EXTRA * months;
    var beforeTaxable = Math.max(0, row.income_sum - REFUND_BASIC_DEDUCTION);
    var afterTaxable = Math.max(0, row.income_sum - REFUND_BASIC_DEDUCTION - extra);
    var saved = roundRefundMoney(iitComprehensiveTax(beforeTaxable) - iitComprehensiveTax(afterTaxable));
    if (row.tax_sum > 0) saved = Math.min(saved, row.tax_sum);
    saved = Math.max(0, roundRefundMoney(saved));
    return {
      year: year,
      months: months,
      income: row.income_sum,
      tax_reported: row.tax_sum,
      extra: extra,
      saved: saved,
      has_records: true
    };
  }

  function specialDeductionRefundEstimate(records) {
    var years = TAX_YEARS.map(function (y) {
      return estimateYear(records, y);
    });
    var total = roundRefundMoney(
      years.reduce(function (sum, row) {
        return sum + (row.saved || 0);
      }, 0)
    );
    var listed = years.filter(function (row) {
      return row.has_records;
    });
    return {
      total: total,
      years: years,
      year_list: listed
        .map(function (r) {
          return r.year;
        })
        .join(','),
      child_month: REFUND_CHILD_MONTH,
      parent_month: REFUND_PARENT_MONTH,
      monthly_extra: REFUND_MONTHLY_EXTRA,
      calculated: true,
      has_any_records: listed.length > 0
    };
  }

  function persistEstimate(estimate) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(estimate || {}));
    } catch (eEst) {}
  }

  function loadStoredEstimate() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      return obj && typeof obj === 'object' ? obj : null;
    } catch (eEst) {
      return null;
    }
  }

  function yearMap(estimate) {
    var map = {};
    var list = (estimate && estimate.years) || [];
    list.forEach(function (row) {
      if (row && row.year) map[row.year] = row;
    });
    return map;
  }

  function fillYearLabels(root, estimate, emptyText) {
    if (!root) return;
    var map = yearMap(estimate);
    TAX_YEARS.forEach(function (y) {
      var el = root.querySelector('[data-year="' + y + '"]');
      if (!el) return;
      var row = map[y];
      var has =
        !!row &&
        (row.has_records || row.saved > 0 || row.income > 0 || row.tax_reported > 0);
      if (!has) {
        el.textContent = emptyText || '暂无记录';
        return;
      }
      el.textContent = formatYuan(row.saved);
    });
  }

  function isLoggedIn() {
    try {
      if (typeof global.authGetToken === 'function') {
        return !!String(global.authGetToken() || '').trim();
      }
    } catch (eTok) {}
    try {
      return !!String(localStorage.getItem('token') || '').trim();
    } catch (eLs) {
      return false;
    }
  }

  function defaultLoginHref() {
    try {
      var next = 'refund_ad.html' + String(global.location && global.location.search ? global.location.search : '');
      if (typeof global.buildLoginPageUrl === 'function') {
        return global.buildLoginPageUrl(next);
      }
      return 'login.html?next=' + encodeURIComponent(next);
    } catch (eHref) {
      return 'login.html';
    }
  }

  function defaultConsultHref() {
    var href = 'consult.html?tab=records';
    try {
      var uid = localStorage.getItem('user_id') || '';
      if (uid) href += '&user_id=' + encodeURIComponent(uid);
    } catch (eUid) {}
    return href;
  }

  function fetchTaxRecords() {
    var fetchFn = typeof global.authFetch === 'function' ? global.authFetch : global.fetch;
    if (typeof fetchFn !== 'function') {
      return Promise.reject(new Error('no_fetch'));
    }
    return fetchFn.call(global, 'api/tax?action=records')
      .then(function (r) {
        return (window.authParseJson||function(r){return r.json();})(r);
      })
      .then(function (data) {
        if (data && data.code === 200 && data.data && Array.isArray(data.data.records)) {
          return data.data.records;
        }
        return [];
      });
  }

  function bindAdPage(opts) {
    opts = opts || {};
    var btn = document.getElementById(opts.buttonId || 'btnCalcRefundEst');
    var overlay = document.getElementById(opts.overlayId || 'refundCalcOverlay');
    var titleEl = document.getElementById('refundCalcTitle');
    var totalEl = document.getElementById('refundCalcTotal');
    var hintEl = document.getElementById('refundCalcHint');
    var kickerEl = document.getElementById('refundCalcKicker');
    var yearList = document.getElementById('refundCalcYearList');
    var primaryBtn = document.getElementById('btnRefundCalcPrimary');
    var secondaryBtn = document.getElementById('btnRefundCalcSecondary');
    var cardYears = document.getElementById('refundEstYearRows');
    var amtEl = document.getElementById('refundEstAmt');
    var labelEl = document.getElementById('refundEstAmtLabel');
    var busy = false;
    var mode = '';

    function track(action, meta) {
      if (typeof opts.track === 'function') opts.track(action, meta || {});
    }

    function closeOverlay() {
      if (overlay) overlay.hidden = true;
      mode = '';
    }

    function openOverlay() {
      if (overlay) overlay.hidden = false;
    }

    function setPrimary(text, handler) {
      if (!primaryBtn) return;
      primaryBtn.textContent = text;
      primaryBtn.onclick = handler;
    }

    function setSecondary(text, handler) {
      if (!secondaryBtn) return;
      secondaryBtn.hidden = !text;
      secondaryBtn.textContent = text || '';
      secondaryBtn.onclick = handler || closeOverlay;
    }

    function contactCs(from) {
      closeOverlay();
      track('track_refund_ad_calc_contact', { from: from || mode || 'result' });
      if (typeof opts.copyWechat === 'function') {
        opts.copyWechat('calc_result');
        return;
      }
      if (typeof opts.showToast === 'function') {
        opts.showToast('请联系客服办理二次退税');
      }
    }

    function showLogin() {
      mode = 'login';
      if (kickerEl) kickerEl.textContent = '登录后按你的个税记录测算';
      if (titleEl) titleEl.textContent = '登录后即可一键计算';
      if (totalEl) totalEl.textContent = '';
      if (yearList) yearList.hidden = true;
      if (hintEl) {
        hintEl.textContent = '将自动计算 2023、2024、2025 年大约可退税额，然后联系客服办理退税。';
      }
      setPrimary('去登录', function () {
        track('track_refund_ad_calc_login', {});
        global.location.href = typeof opts.loginHref === 'function' ? opts.loginHref() : defaultLoginHref();
      });
      setSecondary('先联系客服咨询', function () {
        contactCs('login');
      });
      openOverlay();
    }

    function showEmpty() {
      mode = 'empty';
      if (kickerEl) kickerEl.textContent = '还没有 2023–2025 税务记录';
      if (titleEl) titleEl.textContent = '请先填写个税记录';
      if (totalEl) totalEl.textContent = '';
      if (yearList) {
        yearList.hidden = false;
        fillYearLabels(yearList, specialDeductionRefundEstimate([]), '暂无记录');
      }
      if (hintEl) {
        hintEl.textContent = '填写 2023、2024、2025 年记录后再点一键计算。也可以先联系客服咨询二次退税。';
      }
      setPrimary('去填写税务记录', function () {
        track('track_refund_ad_calc_fill', {});
        global.location.href = typeof opts.consultHref === 'function' ? opts.consultHref() : defaultConsultHref();
      });
      setSecondary('先联系客服咨询', function () {
        contactCs('empty');
      });
      openOverlay();
    }

    function showError(msg) {
      mode = 'error';
      if (kickerEl) kickerEl.textContent = '暂时算不出来';
      if (titleEl) titleEl.textContent = '计算失败';
      if (totalEl) totalEl.textContent = '';
      if (yearList) yearList.hidden = true;
      if (hintEl) {
        hintEl.textContent = msg || '请稍后重试，或直接联系客服核对是否可以二次退税。';
      }
      setPrimary('联系客服咨询', function () {
        contactCs('error');
      });
      setSecondary('关闭', closeOverlay);
      openOverlay();
    }

    function applyCard(estimate) {
      var total = estimate && estimate.total > 0 ? Number(estimate.total) : 0;
      if (amtEl && estimate && estimate.calculated) {
        amtEl.textContent = formatYuan(total);
        if (document.body) document.body.classList.add('has-refund-est');
      }
      if (labelEl) labelEl.textContent = '2023、2024、2025 大约可退';
      if (cardYears) {
        fillYearLabels(cardYears, estimate, estimate && estimate.calculated ? '暂无记录' : '待计算');
      }
      if (typeof opts.onEstimate === 'function') opts.onEstimate(estimate || null);
    }

    function showResult(estimate) {
      mode = 'result';
      persistEstimate(estimate);
      applyCard(estimate);
      if (kickerEl) kickerEl.textContent = '按 3 个子女 4500 元/月 + 赡养父母 3000 元/月';
      if (titleEl) {
        titleEl.textContent = estimate.total > 0 ? '这三年大约可退' : '暂未算出可退金额';
      }
      if (totalEl) totalEl.textContent = formatYuan(estimate.total || 0);
      if (yearList) {
        yearList.hidden = false;
        fillYearLabels(yearList, estimate, '暂无记录');
      }
      if (hintEl) {
        hintEl.textContent =
          estimate.total > 0
            ? '测算仅供参考，实际以汇算清缴为准。请联系客服办理二次退税。'
            : '根据当前记录暂未算出可退金额，请联系客服核对是否可以二次退税。';
      }
      setPrimary('联系客服进行退税', function () {
        contactCs('result');
      });
      setSecondary('先看看说明', closeOverlay);
      openOverlay();
      if (opts.stickyBtn && !opts.stickyBtn.classList.contains('is-copied')) {
        opts.stickyBtn.textContent = '联系客服进行退税';
      }
    }

    function setBusy(on) {
      busy = !!on;
      if (!btn) return;
      btn.disabled = busy;
      btn.setAttribute('aria-busy', busy ? 'true' : 'false');
      btn.textContent = busy ? '正在计算 2023–2025…' : '一键自动计算可退税额';
    }

    function runCalc() {
      if (busy) return;
      track('track_refund_ad_calc_click', {});
      if (!isLoggedIn()) {
        showLogin();
        return;
      }
      setBusy(true);
      fetchTaxRecords()
        .then(function (records) {
          var estimate = specialDeductionRefundEstimate(records || []);
          track('track_refund_ad_calc_done', {
            estimate_total: Math.round(estimate.total || 0),
            has_records: estimate.has_any_records ? 1 : 0
          });
          if (!estimate.has_any_records) {
            showEmpty();
            return;
          }
          showResult(estimate);
        })
        .catch(function () {
          showError('网络异常，请稍后重试。也可直接联系客服办理二次退税。');
        })
        .then(function () {
          setBusy(false);
        });
    }

    if (btn && !btn.getAttribute('data-bound')) {
      btn.setAttribute('data-bound', '1');
      btn.addEventListener('click', runCalc);
    }
    if (overlay && !overlay.getAttribute('data-bound')) {
      overlay.setAttribute('data-bound', '1');
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeOverlay();
      });
    }
    if (secondaryBtn && !secondaryBtn.getAttribute('data-fallback-bound')) {
      secondaryBtn.setAttribute('data-fallback-bound', '1');
    }

    return {
      runCalc: runCalc,
      showResult: showResult,
      showLogin: showLogin,
      showEmpty: showEmpty,
      applyCard: applyCard,
      closeOverlay: closeOverlay
    };
  }

  global.RefundEstimate = {
    TAX_YEARS: TAX_YEARS,
    formatYuan: formatYuan,
    iitComprehensiveTax: iitComprehensiveTax,
    specialDeductionRefundEstimate: specialDeductionRefundEstimate,
    persistEstimate: persistEstimate,
    loadStoredEstimate: loadStoredEstimate,
    fillYearLabels: fillYearLabels,
    bindAdPage: bindAdPage
  };
})(typeof window !== 'undefined' ? window : global);
