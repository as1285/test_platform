/**
 * C 端 · 离职/在职证明离开页调研
 * 点「返回」或系统后退时询问价格、体验、最想优化；点完立刻离开。
 */
(function (global) {
  var PRODUCTS = { lizhi: 1, zaizhi: 1 };
  var SENTIMENTS = { expensive: 1, fair: 1, cheap: 1 };
  var EXPERIENCES = { good: 1, ok: 1, bad: 1 };
  var IMPROVE_TOPICS = { form: 1, preview: 1, share: 1, pay: 1, price: 1, other: 1 };
  var SKIP_REVEAL_MS = 1200;
  var AUTO_LEAVE_MS = 1800;
  var STYLE_ID = 'certPageSurveyStyle';
  var ROOT_ID = 'certPageSurveyModal';

  function clean(s) {
    return String(s == null ? '' : s).trim();
  }

  function normalizeProduct(v) {
    var p = clean(v).toLowerCase();
    return PRODUCTS[p] ? p : '';
  }

  function productLabel(product) {
    return product === 'zaizhi' ? '在职证明' : '离职证明';
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

  function readToken() {
    try {
      return String(localStorage.getItem('token') || '').trim();
    } catch (e0) {
      return '';
    }
  }

  function lsKey(product) {
    return 'cert_page_survey_done_' + product + '_v1';
  }

  function sessionKey(product) {
    return 'cert_page_survey_soft_' + product + '_v1';
  }

  function buildSubmitBody(state) {
    state = state || {};
    var skipped = state.skipped === true;
    var sentiment = skipped ? 'skipped' : clean(state.sentiment).toLowerCase();
    var experience = skipped ? '' : clean(state.experience).toLowerCase();
    var improve = skipped ? '' : clean(state.improve_topic).toLowerCase();
    var expected = skipped ? null : state.expected_price;
    if (expected != null) {
      var n = Number(expected);
      expected = isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
    }
    return {
      product: normalizeProduct(state.product),
      sentiment: sentiment,
      expected_price: expected,
      experience: EXPERIENCES[experience] ? experience : undefined,
      improve_topic: IMPROVE_TOPICS[improve] ? improve : undefined,
      seen_price: state.seen_price != null ? Number(state.seen_price) : 50,
      unlocked: state.unlocked === true || state.unlocked === 1,
      skipped: skipped,
      client_id: state.client_id || undefined
    };
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '.cert-survey-root{position:fixed;inset:0;z-index:10050;display:none;align-items:flex-end;justify-content:center}' +
      '.cert-survey-root.is-open{display:flex}' +
      '.cert-survey-mask{position:absolute;inset:0;background:rgba(15,23,42,.45)}' +
      '.cert-survey-panel{position:relative;width:100%;max-width:440px;margin:0 auto;background:#fff;border-radius:18px 18px 0 0;padding:20px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -8px 28px rgba(15,23,42,.12)}' +
      '.cert-survey-title{font-size:17px;font-weight:700;color:#0f172a;margin:0 0 6px}' +
      '.cert-survey-sub{font-size:13px;color:#475569;line-height:1.45;margin:0 0 16px}' +
      '.cert-survey-label{display:block;font-size:13px;font-weight:600;color:#0f172a;margin:0 0 8px}' +
      '.cert-survey-optional{font-weight:500;color:#94a3b8;font-size:12px}' +
      '.cert-survey-opts{display:flex;gap:8px;margin-bottom:14px}' +
      '.cert-survey-opt,.cert-survey-chip{border:1px solid #e2e8f0;background:#fff;color:#0f172a;font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
      '.cert-survey-opt{flex:1;height:48px;border-radius:12px;font-size:15px;font-weight:700}' +
      '.cert-survey-opt.is-selected,.cert-survey-chip.is-selected{border-color:#1d6fd8;background:#eff6ff;color:#1860be}' +
      '.cert-survey-more[hidden]{display:none}' +
      '.cert-survey-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}' +
      '.cert-survey-chip{min-width:64px;height:36px;padding:0 12px;border-radius:999px;color:#475569;font-size:13px;font-weight:600}' +
      '.cert-survey-input{width:100%;height:44px;border:1px solid #e2e8f0;border-radius:10px;padding:0 12px;font-size:15px;font-family:inherit;margin-bottom:8px;box-sizing:border-box}' +
      '.cert-survey-input[hidden]{display:none}' +
      '.cert-survey-hint{font-size:12px;color:#94a3b8;margin:0 0 12px;line-height:1.4}' +
      '.cert-survey-err{color:#b91c1c;font-size:12px;margin:0 0 12px;min-height:18px}' +
      '.cert-survey-actions{display:flex;flex-direction:column;align-items:center;gap:8px}' +
      '.cert-survey-actions .btn{width:100%;height:44px;border:none;border-radius:12px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer}' +
      '.cert-survey-actions .btn-submit{background:#1d6fd8;color:#fff}' +
      '.cert-survey-actions .btn-submit:disabled{opacity:.45;cursor:default}' +
      '.cert-survey-actions .btn-skip{width:auto;height:auto;padding:6px 10px;background:transparent;color:#94a3b8;font-size:13px;font-weight:500}' +
      '.cert-survey-actions .btn-skip[hidden],.cert-survey-actions .btn-submit[hidden]{display:none}';
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  function ensureModal(label) {
    var root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'cert-survey-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'certSurveyTitle');
    root.hidden = true;
    root.innerHTML =
      '<div class="cert-survey-mask" id="certSurveyMask"></div>' +
      '<div class="cert-survey-panel">' +
      '<div class="cert-survey-title" id="certSurveyTitle">离开前点一下</div>' +
      '<p class="cert-survey-sub" id="certSurveySub"></p>' +
      '<label class="cert-survey-label">您觉得现在的价格</label>' +
      '<div class="cert-survey-opts" id="certSurveySentimentOpts">' +
      '<button type="button" class="cert-survey-opt" data-sentiment="expensive">偏贵</button>' +
      '<button type="button" class="cert-survey-opt" data-sentiment="fair">合适</button>' +
      '<button type="button" class="cert-survey-opt" data-sentiment="cheap">偏便宜</button>' +
      '</div>' +
      '<label class="cert-survey-label">这次使用体验</label>' +
      '<div class="cert-survey-opts" id="certSurveyExperienceOpts">' +
      '<button type="button" class="cert-survey-opt" data-experience="good">好用</button>' +
      '<button type="button" class="cert-survey-opt" data-experience="ok">一般</button>' +
      '<button type="button" class="cert-survey-opt" data-experience="bad">不好用</button>' +
      '</div>' +
      '<div id="certSurveyMore" class="cert-survey-more" hidden>' +
      '<div id="certSurveyPriceBlock" hidden>' +
      '<label class="cert-survey-label">更认可的价位 <span class="cert-survey-optional">选填</span></label>' +
      '<div class="cert-survey-chips" id="certSurveyPriceChips"></div>' +
      '<input type="number" id="certSurveyExpected" class="cert-survey-input" inputmode="decimal" min="1" max="999999" step="1" placeholder="填写金额，例如 29" hidden>' +
      '</div>' +
      '<label class="cert-survey-label">最想优化 <span class="cert-survey-optional">选填</span></label>' +
      '<div class="cert-survey-chips" id="certSurveyImproveChips">' +
      '<button type="button" class="cert-survey-chip" data-improve="form">填写预填</button>' +
      '<button type="button" class="cert-survey-chip" data-improve="preview">预览效果</button>' +
      '<button type="button" class="cert-survey-chip" data-improve="share">分享保存</button>' +
      '<button type="button" class="cert-survey-chip" data-improve="pay">支付开通</button>' +
      '<button type="button" class="cert-survey-chip" data-improve="price">价格</button>' +
      '<button type="button" class="cert-survey-chip" data-improve="other">其他</button>' +
      '</div>' +
      '<p class="cert-survey-hint" id="certSurveyHint">点完立刻返回；不点约 2 秒后自动离开。</p>' +
      '</div>' +
      '<p class="cert-survey-err" id="certSurveyErr" aria-live="polite"></p>' +
      '<div class="cert-survey-actions">' +
      '<button type="button" class="btn btn-submit" id="certSurveySubmit" hidden>直接离开</button>' +
      '<button type="button" class="btn btn-skip" id="certSurveySkip" hidden>这次先不说</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(root);
    return root;
  }

  function renderPriceChips(sentiment) {
    var chips = document.getElementById('certSurveyPriceChips');
    if (!chips) return;
    var prices =
      sentiment === 'cheap' ? ['50', '68', '88', '98'] : ['9', '19', '29', '39'];
    var html = '';
    prices.forEach(function (p) {
      html +=
        '<button type="button" class="cert-survey-chip" data-price="' +
        p +
        '">¥' +
        p +
        '</button>';
    });
    html += '<button type="button" class="cert-survey-chip" data-price="other">其他</button>';
    chips.innerHTML = html;
  }

  function initCertPageSurvey(opts) {
    opts = opts || {};
    var product = normalizeProduct(opts.product);
    if (!product) return null;
    var label = opts.productLabel || productLabel(product);
    var backBtnId = opts.backBtnId || 'lizhiBack';
    var authFetch =
      typeof opts.authFetch === 'function'
        ? opts.authFetch
        : typeof global.authFetch === 'function'
          ? global.authFetch
          : function (url, init) {
              return fetch(url, init);
            };
    var getSeenPrice =
      typeof opts.getSeenPrice === 'function'
        ? opts.getSeenPrice
        : function () {
            return 50;
          };
    var getUnlocked =
      typeof opts.getUnlocked === 'function'
        ? opts.getUnlocked
        : function () {
            return false;
          };
    var getLeaveHref =
      typeof opts.getLeaveHref === 'function'
        ? opts.getLeaveHref
        : function () {
            var back = document.getElementById(backBtnId);
            return (back && back.getAttribute('href')) || 'consult.html?tab=products';
          };

    ensureStyles();
    ensureModal(label);

    var pendingLeaveHref = '';
    var open = false;
    var done = false;
    var sentiment = '';
    var experience = '';
    var improveTopic = '';
    var chipPrice = '';
    var historyPushed = false;
    var submitting = false;
    var autoTimer = 0;
    var skipTimer = 0;

    function markedLocal() {
      try {
        return localStorage.getItem(lsKey(product)) === '1';
      } catch (e0) {
        return false;
      }
    }

    function markDoneLocal() {
      done = true;
      try {
        localStorage.setItem(lsKey(product), '1');
      } catch (e0) {}
    }

    function softSnoozed() {
      try {
        return sessionStorage.getItem(sessionKey(product)) === '1';
      } catch (e0) {
        return false;
      }
    }

    function markSoftSnooze() {
      try {
        sessionStorage.setItem(sessionKey(product), '1');
      } catch (e0) {}
    }

    function shouldShow() {
      if (done || markedLocal()) return false;
      if (softSnoozed()) return false;
      if (!readToken()) return false;
      return true;
    }

    function setErr(msg) {
      var el = document.getElementById('certSurveyErr');
      if (el) el.textContent = msg || '';
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

    function track(action, meta) {
      if (typeof global.trackUserAction !== 'function') return;
      var payload = meta && typeof meta === 'object' ? Object.assign({}, meta) : {};
      payload.page = product === 'zaizhi' ? 'zaizhi_cert' : 'lizhi_cert';
      payload.product = product;
      global.trackUserAction(action, payload);
    }

    function resetForm() {
      clearTimers();
      sentiment = '';
      experience = '';
      improveTopic = '';
      chipPrice = '';
      submitting = false;
      document.querySelectorAll('#' + ROOT_ID + ' .cert-survey-opt, #' + ROOT_ID + ' .cert-survey-chip').forEach(
        function (el) {
          el.classList.remove('is-selected');
        }
      );
      var more = document.getElementById('certSurveyMore');
      if (more) more.hidden = true;
      var priceBlock = document.getElementById('certSurveyPriceBlock');
      if (priceBlock) priceBlock.hidden = true;
      var expectedEl = document.getElementById('certSurveyExpected');
      if (expectedEl) {
        expectedEl.value = '';
        expectedEl.hidden = true;
      }
      var submitBtn = document.getElementById('certSurveySubmit');
      if (submitBtn) {
        submitBtn.hidden = true;
        submitBtn.disabled = false;
        submitBtn.textContent = '直接离开';
      }
      var skipBtn = document.getElementById('certSurveySkip');
      if (skipBtn) {
        skipBtn.hidden = true;
        skipBtn.disabled = false;
      }
      setErr('');
    }

    function revealMore() {
      var more = document.getElementById('certSurveyMore');
      if (more) more.hidden = false;
      var priceBlock = document.getElementById('certSurveyPriceBlock');
      if (priceBlock) {
        var showPrice = sentiment === 'expensive' || sentiment === 'cheap';
        priceBlock.hidden = !showPrice;
        if (showPrice) renderPriceChips(sentiment);
      }
      var hint = document.getElementById('certSurveyHint');
      if (hint) {
        hint.textContent = sentiment
          ? '点个价位或优化项立刻返回；不点约 2 秒后自动离开。'
          : '点完立刻返回；不点约 2 秒后自动离开。';
      }
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

    function openModal(leaveHref) {
      pendingLeaveHref = leaveHref || getLeaveHref();
      resetForm();
      var sub = document.getElementById('certSurveySub');
      var seen = getSeenPrice();
      if (sub) {
        sub.textContent =
          label +
          '去水印 ¥' +
          String(seen != null ? seen : 50) +
          '。点完立刻返回，不用再提交。';
      }
      var root = document.getElementById(ROOT_ID);
      if (root) {
        root.hidden = false;
        root.classList.add('is-open');
      }
      open = true;
      track('track_cert_survey_open');
      var skipBtn = document.getElementById('certSurveySkip');
      skipTimer = setTimeout(function () {
        skipTimer = 0;
        if (skipBtn && open && !submitting) skipBtn.hidden = false;
      }, SKIP_REVEAL_MS);
    }

    function leavePage(href) {
      var target = href || pendingLeaveHref || getLeaveHref();
      closeModal();
      if (opts.onLeave) {
        opts.onLeave(target);
        return;
      }
      window.location.href = target;
    }

    function softDismiss() {
      if (submitting) return;
      markSoftSnooze();
      track('track_cert_survey_soft_dismiss');
      leavePage();
    }

    function readExpected() {
      if (chipPrice && chipPrice !== 'other') {
        var chipN = Number(chipPrice);
        if (isFinite(chipN) && chipN > 0) return chipN;
      }
      var expectedEl = document.getElementById('certSurveyExpected');
      var raw = expectedEl ? String(expectedEl.value || '').trim() : '';
      if (raw === '') return null;
      var n = Number(raw);
      if (!isFinite(n) || n <= 0) return null;
      return n;
    }

    function maybeAutoLeave() {
      if (autoTimer) {
        clearTimeout(autoTimer);
        autoTimer = 0;
      }
      if (!sentiment) return;
      var submitBtn = document.getElementById('certSurveySubmit');
      if (submitBtn) {
        submitBtn.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = chipPrice === 'other' ? '填好了，离开' : '直接离开';
      }
      if (chipPrice === 'other') return;
      autoTimer = setTimeout(function () {
        autoTimer = 0;
        if (open && !submitting && sentiment) {
          submitSurvey({ skipped: false });
        }
      }, AUTO_LEAVE_MS);
    }

    function submitSurvey(flags) {
      flags = flags || {};
      var skipped = flags.skipped === true;
      if (submitting) return;
      if (!skipped && !sentiment) {
        setErr('请先点选：偏贵、合适或偏便宜');
        return;
      }
      var body = buildSubmitBody({
        product: product,
        sentiment: sentiment,
        experience: experience,
        improve_topic: improveTopic,
        expected_price: skipped ? null : readExpected(),
        seen_price: getSeenPrice(),
        unlocked: getUnlocked(),
        skipped: skipped,
        client_id: readClientId()
      });
      var submitBtn = document.getElementById('certSurveySubmit');
      var skipBtn = document.getElementById('certSurveySkip');
      submitting = true;
      if (submitBtn) submitBtn.disabled = true;
      if (skipBtn) skipBtn.disabled = true;
      track(skipped ? 'track_cert_survey_skip' : 'track_cert_survey_submit', {
        sentiment: body.sentiment,
        experience: body.experience || '',
        improve_topic: body.improve_topic || '',
        expected_price: body.expected_price,
        has_expected_price: body.expected_price != null
      });
      markDoneLocal();
      authFetch('/api/growth/cert-page-survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function () {
          leavePage();
        })
        .catch(function () {
          leavePage();
        });
    }

    function bindOnce() {
      if (document.getElementById(ROOT_ID).getAttribute('data-bound') === '1') return;
      document.getElementById(ROOT_ID).setAttribute('data-bound', '1');

      var sentOpts = document.getElementById('certSurveySentimentOpts');
      if (sentOpts) {
        sentOpts.addEventListener('click', function (ev) {
          var btn = ev.target.closest('[data-sentiment]');
          if (!btn || submitting) return;
          sentiment = btn.getAttribute('data-sentiment') || '';
          sentOpts.querySelectorAll('.cert-survey-opt').forEach(function (el) {
            el.classList.toggle('is-selected', el === btn);
          });
          chipPrice = '';
          setErr('');
          revealMore();
          maybeAutoLeave();
        });
      }

      var expOpts = document.getElementById('certSurveyExperienceOpts');
      if (expOpts) {
        expOpts.addEventListener('click', function (ev) {
          var btn = ev.target.closest('[data-experience]');
          if (!btn || submitting) return;
          experience = btn.getAttribute('data-experience') || '';
          expOpts.querySelectorAll('.cert-survey-opt').forEach(function (el) {
            el.classList.toggle('is-selected', el === btn);
          });
          setErr('');
          revealMore();
          maybeAutoLeave();
        });
      }

      var priceChips = document.getElementById('certSurveyPriceChips');
      if (priceChips) {
        priceChips.addEventListener('click', function (ev) {
          var btn = ev.target.closest('[data-price]');
          if (!btn || submitting) return;
          chipPrice = btn.getAttribute('data-price') || '';
          priceChips.querySelectorAll('.cert-survey-chip').forEach(function (el) {
            el.classList.toggle('is-selected', el === btn);
          });
          var expectedEl = document.getElementById('certSurveyExpected');
          if (expectedEl) {
            if (chipPrice === 'other') {
              expectedEl.hidden = false;
              expectedEl.value = '';
              try {
                expectedEl.focus();
              } catch (eFocus) {}
            } else {
              expectedEl.hidden = true;
              expectedEl.value = chipPrice || '';
            }
          }
          setErr('');
          if (chipPrice === 'other') {
            maybeAutoLeave();
            return;
          }
          if (sentiment) submitSurvey({ skipped: false });
        });
      }

      var improveChips = document.getElementById('certSurveyImproveChips');
      if (improveChips) {
        improveChips.addEventListener('click', function (ev) {
          var btn = ev.target.closest('[data-improve]');
          if (!btn || submitting) return;
          improveTopic = btn.getAttribute('data-improve') || '';
          improveChips.querySelectorAll('.cert-survey-chip').forEach(function (el) {
            el.classList.toggle('is-selected', el === btn);
          });
          setErr('');
          if (sentiment) submitSurvey({ skipped: false });
        });
      }

      var submitBtn = document.getElementById('certSurveySubmit');
      var skipBtn = document.getElementById('certSurveySkip');
      var mask = document.getElementById('certSurveyMask');
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

    bindOnce();

    if (markedLocal()) done = true;
    authFetch('/api/growth/cert-page-survey/status?product=' + encodeURIComponent(product))
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (j && j.code === 200 && j.data && j.data.done) markDoneLocal();
      })
      .catch(function () {});

    try {
      if (!historyPushed && shouldShow()) {
        history.pushState({ cert_page_survey: product }, '');
        historyPushed = true;
      }
    } catch (ePush) {}

    window.addEventListener('popstate', function () {
      if (!shouldShow()) return;
      if (open) return;
      try {
        history.pushState({ cert_page_survey: product }, '');
      } catch (eRe) {}
      openModal(getLeaveHref());
    });

    var back = document.getElementById(backBtnId);
    if (back) {
      back.addEventListener('click', function (ev) {
        if (!shouldShow()) return;
        ev.preventDefault();
        openModal(back.getAttribute('href') || getLeaveHref());
      });
    }

    return {
      product: product,
      shouldShow: shouldShow,
      open: function (href) {
        openModal(href);
      },
      close: closeModal,
      isOpen: function () {
        return open;
      }
    };
  }

  global.initCertPageSurvey = initCertPageSurvey;
  global.CertPageSurvey = {
    PRODUCTS: PRODUCTS,
    SENTIMENTS: SENTIMENTS,
    EXPERIENCES: EXPERIENCES,
    IMPROVE_TOPICS: IMPROVE_TOPICS,
    SKIP_REVEAL_MS: SKIP_REVEAL_MS,
    AUTO_LEAVE_MS: AUTO_LEAVE_MS,
    normalizeProduct: normalizeProduct,
    productLabel: productLabel,
    buildSubmitBody: buildSubmitBody,
    lsKey: lsKey,
    sessionKey: sessionKey,
    init: initCertPageSurvey
  };
})(typeof window !== 'undefined' ? window : globalThis);
