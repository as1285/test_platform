/**
 * C 端 · 个税记录填写页体验调研
 * 页内卡片 + 离开时补问：满意度、最想优化、文字建议。
 */
(function (global) {
  var SATISFACTIONS = { good: 1, ok: 1, bad: 1 };
  var IMPROVE_TOPICS = {
    start: 1,
    paste: 1,
    manual: 1,
    generate: 1,
    list: 1,
    calc: 1,
    other: 1
  };
  var SUGGESTION_MAX = 500;
  var LS_KEY = 'tax_fill_survey_done_v1';
  var SESSION_KEY = 'tax_fill_survey_soft_v1';
  var SKIP_REVEAL_MS = 1200;
  var AUTO_LEAVE_MS = 2200;
  var STYLE_ID = 'taxFillSurveyStyle';
  var ROOT_ID = 'taxFillSurveyModal';

  function clean(s) {
    return String(s == null ? '' : s).trim();
  }

  function normalizeSatisfaction(v) {
    var s = clean(v).toLowerCase();
    return SATISFACTIONS[s] ? s : '';
  }

  function normalizeImproveTopic(v) {
    var s = clean(v).toLowerCase();
    return IMPROVE_TOPICS[s] ? s : '';
  }

  function normalizeSuggestion(v) {
    var s = clean(v).replace(/\s+/g, ' ');
    if (!s) return '';
    if (s.length > SUGGESTION_MAX) s = s.slice(0, SUGGESTION_MAX);
    return s;
  }

  function buildSubmitBody(state) {
    state = state || {};
    var skipped = state.skipped === true;
    var suggestion = skipped ? '' : normalizeSuggestion(state.suggestion);
    return {
      satisfaction: skipped ? 'skipped' : normalizeSatisfaction(state.satisfaction),
      improve_topic: skipped ? undefined : normalizeImproveTopic(state.improve_topic) || undefined,
      suggestion: suggestion || undefined,
      skipped: skipped,
      client_id: state.client_id || undefined
    };
  }

  function readToken() {
    try {
      return String(localStorage.getItem('token') || '').trim();
    } catch (e0) {
      return '';
    }
  }

  function readClientId() {
    try {
      if (typeof global.getClientDevicePayload === 'function') {
        var payload = global.getClientDevicePayload() || {};
        if (payload.client_id) return String(payload.client_id);
      }
    } catch (e0) {}
    try {
      return String(localStorage.getItem('client_device_id') || '').trim();
    } catch (e1) {
      return '';
    }
  }

  function authFetch(url, init) {
    if (typeof global.authFetch === 'function') return global.authFetch(url, init);
    return fetch(url, init);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '.tax-fill-survey-card .tax-fill-survey-sub{font-size:13px;color:#64748b;line-height:1.45;margin:0 0 12px}' +
      '.tax-fill-survey-label{display:block;font-size:13px;font-weight:600;color:#0f172a;margin:0 0 8px}' +
      '.tax-fill-survey-optional{font-weight:500;color:#94a3b8;font-size:12px}' +
      '.tax-fill-survey-opts{display:flex;gap:8px;margin-bottom:12px}' +
      '.tax-fill-survey-opt,.tax-fill-survey-chip{border:1px solid #e2e8f0;background:#fff;color:#0f172a;font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '.tax-fill-survey-opt{flex:1;height:44px;border-radius:12px;font-size:15px;font-weight:700}' +
      '.tax-fill-survey-opt.is-selected,.tax-fill-survey-chip.is-selected{border-color:#1d6fd8;background:#eff6ff;color:#1860be}' +
      '.tax-fill-survey-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}' +
      '.tax-fill-survey-chip{min-width:64px;height:36px;padding:0 12px;border-radius:999px;color:#475569;font-size:13px;font-weight:600}' +
      '.tax-fill-survey-text{width:100%;min-height:72px;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;resize:vertical;box-sizing:border-box;margin-bottom:8px}' +
      '.tax-fill-survey-count{font-size:12px;color:#94a3b8;margin:0 0 12px;text-align:right}' +
      '.tax-fill-survey-err{color:#b91c1c;font-size:12px;margin:0 0 10px;min-height:16px}' +
      '.tax-fill-survey-thanks{font-size:14px;color:#166534;background:#ecfdf3;border-radius:10px;padding:12px 14px}' +
      '.tax-fill-survey-root{position:fixed;inset:0;z-index:10050;display:none;align-items:flex-end;justify-content:center}' +
      '.tax-fill-survey-root.is-open{display:flex}' +
      '.tax-fill-survey-mask{position:absolute;inset:0;background:rgba(15,23,42,.45)}' +
      '.tax-fill-survey-panel{position:relative;width:100%;max-width:440px;margin:0 auto;background:#fff;border-radius:18px 18px 0 0;padding:20px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 28px rgba(15,23,42,.12)}' +
      '.tax-fill-survey-title{font-size:17px;font-weight:700;color:#0f172a;margin:0 0 6px}' +
      '.tax-fill-survey-actions{display:flex;flex-direction:column;align-items:center;gap:8px}' +
      '.tax-fill-survey-actions .btn{width:100%;height:44px;border:none;border-radius:12px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}' +
      '.tax-fill-survey-actions .btn-submit{background:#1d6fd8;color:#fff}' +
      '.tax-fill-survey-actions .btn-submit:disabled{opacity:.45;cursor:default}' +
      '.tax-fill-survey-actions .btn-skip{width:auto;height:auto;padding:6px 10px;background:transparent;color:#94a3b8;font-size:13px;font-weight:500}' +
      '.tax-fill-survey-actions .btn-skip[hidden],.tax-fill-survey-actions .btn-submit[hidden]{display:none}';
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  function ensureModal() {
    var root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'tax-fill-survey-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'taxFillSurveyTitle');
    root.hidden = true;
    root.innerHTML =
      '<div class="tax-fill-survey-mask" id="taxFillSurveyMask"></div>' +
      '<div class="tax-fill-survey-panel">' +
      '<div class="tax-fill-survey-title" id="taxFillSurveyTitle">离开前点一下</div>' +
      '<p class="tax-fill-survey-sub">填写体验怎么样？建议可写可不写，点完立刻返回。</p>' +
      '<label class="tax-fill-survey-label">体验满意度</label>' +
      '<div class="tax-fill-survey-opts" id="taxFillSurveySatOpts">' +
      '<button type="button" class="tax-fill-survey-opt" data-satisfaction="good">满意</button>' +
      '<button type="button" class="tax-fill-survey-opt" data-satisfaction="ok">一般</button>' +
      '<button type="button" class="tax-fill-survey-opt" data-satisfaction="bad">不满意</button>' +
      '</div>' +
      '<div id="taxFillSurveyMore" hidden>' +
      '<label class="tax-fill-survey-label">最想优化 <span class="tax-fill-survey-optional">选填</span></label>' +
      '<div class="tax-fill-survey-chips" id="taxFillSurveyImproveChips">' +
      '<button type="button" class="tax-fill-survey-chip" data-improve="start">开始方式</button>' +
      '<button type="button" class="tax-fill-survey-chip" data-improve="paste">粘贴导入</button>' +
      '<button type="button" class="tax-fill-survey-chip" data-improve="manual">手动填写</button>' +
      '<button type="button" class="tax-fill-survey-chip" data-improve="generate">一键生成</button>' +
      '<button type="button" class="tax-fill-survey-chip" data-improve="list">记录列表</button>' +
      '<button type="button" class="tax-fill-survey-chip" data-improve="calc">计算说明</button>' +
      '<button type="button" class="tax-fill-survey-chip" data-improve="other">其他</button>' +
      '</div>' +
      '<label class="tax-fill-survey-label" for="taxFillSurveySuggestion">优化建议 <span class="tax-fill-survey-optional">选填</span></label>' +
      '<textarea id="taxFillSurveySuggestion" class="tax-fill-survey-text" maxlength="500" placeholder="例如：粘贴导入经常失败、想按月改工资更方便…"></textarea>' +
      '<p class="tax-fill-survey-count" id="taxFillSurveyCount">0 / 500</p>' +
      '</div>' +
      '<p class="tax-fill-survey-err" id="taxFillSurveyErr" aria-live="polite"></p>' +
      '<div class="tax-fill-survey-actions">' +
      '<button type="button" class="btn btn-submit" id="taxFillSurveySubmit" hidden>提交并离开</button>' +
      '<button type="button" class="btn btn-skip" id="taxFillSurveySkip" hidden>这次先不说</button>' +
      '</div></div>';
    document.body.appendChild(root);
    return root;
  }

  function initTaxFillSurvey(opts) {
    opts = opts || {};
    ensureStyles();
    ensureModal();

    var done = false;
    var open = false;
    var submitting = false;
    var satisfaction = '';
    var improveTopic = '';
    var pendingLeaveHref = '';
    var historyPushed = false;
    var autoTimer = 0;
    var skipTimer = 0;

    function markedLocal() {
      try {
        return localStorage.getItem(LS_KEY) === '1';
      } catch (e0) {
        return false;
      }
    }

    function markDoneLocal() {
      done = true;
      try {
        localStorage.setItem(LS_KEY, '1');
      } catch (e0) {}
    }

    function softSnoozed() {
      try {
        return sessionStorage.getItem(SESSION_KEY) === '1';
      } catch (e0) {
        return false;
      }
    }

    function markSoftSnooze() {
      try {
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch (e0) {}
    }

    function isRecordsTab() {
      var pane = document.getElementById('panel-records');
      return !!(pane && pane.classList.contains('active'));
    }

    function shouldShowExit() {
      if (done || markedLocal()) return false;
      if (softSnoozed()) return false;
      if (!readToken()) return false;
      if (!isRecordsTab()) return false;
      return true;
    }

    function track(action, meta) {
      if (typeof global.trackUserAction !== 'function') return;
      var payload = meta && typeof meta === 'object' ? Object.assign({}, meta) : {};
      payload.page = 'consult';
      payload.source = 'tax_fill';
      global.trackUserAction(action, payload);
    }

    function setErr(msg) {
      var el = document.getElementById('taxFillSurveyErr');
      if (el) el.textContent = msg || '';
      var cardErr = document.getElementById('taxFillSurveyCardErr');
      if (cardErr) cardErr.textContent = msg || '';
    }

    function clearTimers() {
      if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = 0;
      }
      if (skipTimer) {
        clearTimeout(skipTimer);
        skipTimer = 0;
      }
    }

    function syncCount() {
      var ta = document.getElementById('taxFillSurveySuggestion');
      var count = document.getElementById('taxFillSurveyCount');
      if (ta && count) count.textContent = String(ta.value.length) + ' / ' + SUGGESTION_MAX;
      var cardTa = document.getElementById('taxFillSurveyCardSuggestion');
      var cardCount = document.getElementById('taxFillSurveyCardCount');
      if (cardTa && cardCount) {
        cardCount.textContent = String(cardTa.value.length) + ' / ' + SUGGESTION_MAX;
      }
    }

    function markCardSelected(rootSel, attr, value) {
      var root = document.querySelector(rootSel);
      if (!root) return;
      root.querySelectorAll('[' + attr + ']').forEach(function (el) {
        el.classList.toggle('is-selected', el.getAttribute(attr) === value);
      });
    }

    function showCardThanks() {
      var card = document.getElementById('taxFillSurveyCard');
      var form = document.getElementById('taxFillSurveyCardForm');
      var thanks = document.getElementById('taxFillSurveyCardThanks');
      if (form) form.hidden = true;
      if (thanks) thanks.hidden = false;
      if (card) card.setAttribute('data-done', '1');
    }

    function hideCardIfDone() {
      if (!(done || markedLocal())) return;
      var card = document.getElementById('taxFillSurveyCard');
      if (card) card.hidden = true;
    }

    function resetModal() {
      clearTimers();
      satisfaction = '';
      improveTopic = '';
      submitting = false;
      document.querySelectorAll('#' + ROOT_ID + ' .tax-fill-survey-opt, #' + ROOT_ID + ' .tax-fill-survey-chip').forEach(
        function (el) {
          el.classList.remove('is-selected');
        }
      );
      var more = document.getElementById('taxFillSurveyMore');
      if (more) more.hidden = true;
      var ta = document.getElementById('taxFillSurveySuggestion');
      if (ta) ta.value = '';
      var submitBtn = document.getElementById('taxFillSurveySubmit');
      if (submitBtn) {
        submitBtn.hidden = true;
        submitBtn.disabled = false;
        submitBtn.textContent = '提交并离开';
      }
      var skipBtn = document.getElementById('taxFillSurveySkip');
      if (skipBtn) {
        skipBtn.hidden = true;
        skipBtn.disabled = false;
      }
      setErr('');
      syncCount();
    }

    function closeModal() {
      clearTimers();
      var root = document.getElementById(ROOT_ID);
      if (root) {
        root.classList.remove('is-open');
        root.hidden = true;
      }
      open = false;
    }

    function leavePage(href) {
      var target = href || pendingLeaveHref || 'mine.html';
      closeModal();
      if (opts.onLeave) {
        opts.onLeave(target);
        return;
      }
      window.location.href = target;
    }

    function postSurvey(body, onDone) {
      authFetch('/api/growth/tax-fill-survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function () {
          onDone();
        })
        .catch(function () {
          onDone();
        });
    }

    function submitSurvey(flags) {
      flags = flags || {};
      var skipped = flags.skipped === true;
      var fromCard = flags.fromCard === true;
      if (submitting) return;
      var sat = fromCard
        ? normalizeSatisfaction(flags.satisfaction || satisfaction)
        : satisfaction;
      var improve = fromCard
        ? normalizeImproveTopic(flags.improve_topic || improveTopic)
        : improveTopic;
      var suggestion = fromCard
        ? normalizeSuggestion(flags.suggestion || '')
        : normalizeSuggestion(
            (document.getElementById('taxFillSurveySuggestion') || {}).value || ''
          );
      if (!skipped && !sat) {
        setErr('请先选择体验满意度');
        return;
      }
      var body = buildSubmitBody({
        satisfaction: sat,
        improve_topic: improve,
        suggestion: suggestion,
        skipped: skipped,
        client_id: readClientId()
      });
      submitting = true;
      var submitBtn = document.getElementById('taxFillSurveySubmit');
      var skipBtn = document.getElementById('taxFillSurveySkip');
      var cardBtn = document.getElementById('taxFillSurveyCardSubmit');
      if (submitBtn) submitBtn.disabled = true;
      if (skipBtn) skipBtn.disabled = true;
      if (cardBtn) cardBtn.disabled = true;
      track(skipped ? 'track_tax_fill_survey_skip' : 'track_tax_fill_survey_submit', {
        satisfaction: body.satisfaction,
        improve_topic: body.improve_topic || '',
        has_suggestion: !!body.suggestion,
        via: fromCard ? 'card' : 'exit'
      });
      markDoneLocal();
      postSurvey(body, function () {
        if (fromCard) {
          submitting = false;
          showCardThanks();
          return;
        }
        leavePage();
      });
    }

    function maybeAutoLeave() {
      if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = 0;
      }
      if (!satisfaction) return;
      var submitBtn = document.getElementById('taxFillSurveySubmit');
      if (submitBtn) {
        submitBtn.hidden = false;
        submitBtn.disabled = false;
      }
      var ta = document.getElementById('taxFillSurveySuggestion');
      if (ta && document.activeElement === ta && clean(ta.value)) return;
      autoTimer = setTimeout(function () {
        autoTimer = 0;
        if (open && !submitting && satisfaction) {
          var focused = document.getElementById('taxFillSurveySuggestion');
          if (focused && document.activeElement === focused && clean(focused.value)) return;
          submitSurvey({ skipped: false });
        }
      }, AUTO_LEAVE_MS);
    }

    function openModal(leaveHref) {
      pendingLeaveHref = leaveHref || 'mine.html';
      resetModal();
      var root = document.getElementById(ROOT_ID);
      if (root) {
        root.hidden = false;
        root.classList.add('is-open');
      }
      open = true;
      track('track_tax_fill_survey_open', { via: 'exit' });
      var skipBtn = document.getElementById('taxFillSurveySkip');
      skipTimer = setTimeout(function () {
        skipTimer = 0;
        if (skipBtn && open && !submitting) skipBtn.hidden = false;
      }, SKIP_REVEAL_MS);
    }

    function softDismiss() {
      if (submitting) return;
      markSoftSnooze();
      track('track_tax_fill_survey_soft_dismiss');
      leavePage();
    }

    function bindModal() {
      var root = document.getElementById(ROOT_ID);
      if (!root || root.getAttribute('data-bound') === '1') return;
      root.setAttribute('data-bound', '1');

      var satOpts = document.getElementById('taxFillSurveySatOpts');
      if (satOpts) {
        satOpts.addEventListener('click', function (ev) {
          var btn = ev.target.closest('[data-satisfaction]');
          if (!btn || submitting) return;
          satisfaction = btn.getAttribute('data-satisfaction') || '';
          satOpts.querySelectorAll('.tax-fill-survey-opt').forEach(function (el) {
            el.classList.toggle('is-selected', el === btn);
          });
          var more = document.getElementById('taxFillSurveyMore');
          if (more) more.hidden = false;
          setErr('');
          maybeAutoLeave();
        });
      }

      var chips = document.getElementById('taxFillSurveyImproveChips');
      if (chips) {
        chips.addEventListener('click', function (ev) {
          var btn = ev.target.closest('[data-improve]');
          if (!btn || submitting) return;
          improveTopic = btn.getAttribute('data-improve') || '';
          chips.querySelectorAll('.tax-fill-survey-chip').forEach(function (el) {
            el.classList.toggle('is-selected', el === btn);
          });
          maybeAutoLeave();
        });
      }

      var ta = document.getElementById('taxFillSurveySuggestion');
      if (ta) {
        ta.addEventListener('input', function () {
          syncCount();
          if (autoTimer) {
            clearTimeout(autoTimer);
            autoTimer = 0;
          }
        });
        ta.addEventListener('focus', function () {
          if (autoTimer) {
            clearTimeout(autoTimer);
            autoTimer = 0;
          }
        });
      }

      var submitBtn = document.getElementById('taxFillSurveySubmit');
      var skipBtn = document.getElementById('taxFillSurveySkip');
      var mask = document.getElementById('taxFillSurveyMask');
      if (submitBtn) {
        submitBtn.addEventListener('click', function () {
          submitSurvey({ skipped: false });
        });
      }
      if (skipBtn) {
        skipBtn.addEventListener('click', function () {
          softDismiss();
        });
      }
      if (mask) {
        mask.addEventListener('click', function () {
          softDismiss();
        });
      }
    }

    function bindCard() {
      var card = document.getElementById('taxFillSurveyCard');
      if (!card || card.getAttribute('data-bound') === '1') return;
      card.setAttribute('data-bound', '1');
      var cardSat = '';
      var cardImprove = '';

      var satOpts = document.getElementById('taxFillSurveyCardSatOpts');
      if (satOpts) {
        satOpts.addEventListener('click', function (ev) {
          var btn = ev.target.closest('[data-satisfaction]');
          if (!btn) return;
          cardSat = btn.getAttribute('data-satisfaction') || '';
          markCardSelected('#taxFillSurveyCardSatOpts', 'data-satisfaction', cardSat);
          setErr('');
        });
      }
      var chips = document.getElementById('taxFillSurveyCardImproveChips');
      if (chips) {
        chips.addEventListener('click', function (ev) {
          var btn = ev.target.closest('[data-improve]');
          if (!btn) return;
          cardImprove = btn.getAttribute('data-improve') || '';
          markCardSelected('#taxFillSurveyCardImproveChips', 'data-improve', cardImprove);
        });
      }
      var ta = document.getElementById('taxFillSurveyCardSuggestion');
      if (ta) {
        ta.addEventListener('input', syncCount);
      }
      var submitBtn = document.getElementById('taxFillSurveyCardSubmit');
      if (submitBtn) {
        submitBtn.addEventListener('click', function () {
          var suggestion = ta ? ta.value : '';
          submitSurvey({
            skipped: false,
            fromCard: true,
            satisfaction: cardSat,
            improve_topic: cardImprove,
            suggestion: suggestion
          });
        });
      }
    }

    bindModal();
    bindCard();

    if (markedLocal()) {
      done = true;
      hideCardIfDone();
    }
    authFetch('/api/growth/tax-fill-survey/status')
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (j && j.code === 200 && j.data && j.data.done) {
          markDoneLocal();
          hideCardIfDone();
        }
      })
      .catch(function () {});

    try {
      if (!historyPushed && shouldShowExit()) {
        history.pushState({ tax_fill_survey: 1 }, '');
        historyPushed = true;
      }
    } catch (ePush) {}

    window.addEventListener('popstate', function () {
      if (!shouldShowExit()) return;
      if (open) return;
      try {
        history.pushState({ tax_fill_survey: 1 }, '');
      } catch (eRe) {}
      openModal('mine.html');
    });

    var back = document.getElementById(opts.backBtnId || 'consultBackLink');
    if (back) {
      back.addEventListener('click', function (ev) {
        if (!shouldShowExit()) return;
        ev.preventDefault();
        openModal(back.getAttribute('href') || 'mine.html');
      });
    }

    return {
      shouldShowExit: shouldShowExit,
      open: openModal,
      isOpen: function () {
        return open;
      },
      submit: submitSurvey
    };
  }

  function boot() {
    if (!document.getElementById('panel-records')) return;
    initTaxFillSurvey({});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.initTaxFillSurvey = initTaxFillSurvey;
  global.TaxFillSurvey = {
    SATISFACTIONS: SATISFACTIONS,
    IMPROVE_TOPICS: IMPROVE_TOPICS,
    SUGGESTION_MAX: SUGGESTION_MAX,
    normalizeSatisfaction: normalizeSatisfaction,
    normalizeImproveTopic: normalizeImproveTopic,
    normalizeSuggestion: normalizeSuggestion,
    buildSubmitBody: buildSubmitBody,
    LS_KEY: LS_KEY,
    init: initTaxFillSurvey
  };
})(typeof window !== 'undefined' ? window : globalThis);
