/**
 * consult-core.js — 个人中心核心：页签 / 工具 / 任职 / 消息 / 启动编排
 *
 * 角色：consult 页公共工具与 UI 编排（页签切换、用户资料、单条表单字段、税额公式、
 *       回收站渲染、粘贴解析辅助、任职受雇与消息列表、boot 入口）。
 * 加载页：consult.html（defer；位于 consult-tax-edit-pay 之后、batch-tax / records 之前）。
 * 依赖：authFetch、TaxApp.ui（可选）、consult-tax-edit-pay（consultTaxPost 可选）、
 *       consult-batch-tax 中的部分函数（页签切到 records / boot 时调用，须后加载定义）。
 * 鉴权：写税走 consultTaxWrite；用户/任职/消息走 authFetch api/user、api/message。
 * 注意：回收站「打开/恢复」动作在 consult-records.js；本文件提供渲染与全部恢复等共享逻辑。
 */

// === 税务写接口封装 ===
/**
 * POST api/tax；优先走 consultTaxPost（同行付费墙）。
 * 副作用：网络写税；可能弹付费窗。
 */
function consultTaxWrite(body) {
    if (window.consultTaxPost) {
        return window.consultTaxPost(body);
    }
    return window.authFetch('api/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
    });
}

// === 税款所属期 / 申报日工具 ===
/** 两位数补零（月/日）。 */
function pad2(n) {
    n = parseInt(n, 10);
    return (n < 10 ? '0' : '') + n;
}

/**
 * 税款所属期 YYYY-MM。
 * @returns {string} 非法年月返回空串
 */
function taxPeriodFromYearMonth(year, month) {
    var y = parseInt(year, 10);
    var m = parseInt(month, 10);
    if (!y || !m || m < 1 || m > 12) return '';
    return y + '-' + pad2(m);
}

/**
 * 申报日期比所属期（年-月）晚一个月，默认每月 15 日。
 * @returns {string} YYYY-MM-DD；非法返回空串
 */
function reportDateOneMonthAfterBelonging(year, month, day) {
    var y = parseInt(year, 10);
    var m = parseInt(month, 10);
    var d = day != null && day !== '' ? parseInt(day, 10) : 15;
    if (!y || !m || m < 1 || m > 12) return '';
    m += 1;
    if (m > 12) {
        m = 1;
        y += 1;
    }
    return y + '-' + pad2(m) + '-' + pad2(d);
}

/**
 * 由年/月同步税款所属期与默认申报日。
 * 副作用：写 #f_tax_period、#f_report_date。
 */
function syncBelongingPeriodFromForm() {
    var yearEl = document.getElementById('f_year');
    var monthEl = document.getElementById('f_month');
    var tpEl = document.getElementById('f_tax_period');
    var rdEl = document.getElementById('f_report_date');
    if (!yearEl || !monthEl) return;
    var y = parseInt(yearEl.value, 10);
    var m = parseInt(monthEl.value, 10);
    if (!y || !m || m < 1 || m > 12) return;
    if (tpEl) tpEl.value = taxPeriodFromYearMonth(y, m);
    if (rdEl) rdEl.value = reportDateOneMonthAfterBelonging(y, m, 15);
}

/** 绑定年月输入并首次同步所属期（全局只绑一次）。 */
function initBelongingPeriodSync() {
    var yearEl = document.getElementById('f_year');
    var monthEl = document.getElementById('f_month');
    if (!yearEl || !monthEl) return;
    bindBatchYearInput(yearEl);
    bindBatchMonthInput(monthEl);
    if (!window.__belongingPeriodSyncInited) {
        window.__belongingPeriodSyncInited = true;
        function onYmChange() {
            syncBelongingPeriodFromForm();
        }
        yearEl.addEventListener('change', onYmChange);
        yearEl.addEventListener('input', onYmChange);
        monthEl.addEventListener('change', onYmChange);
        monthEl.addEventListener('input', onYmChange);
    }
    syncBelongingPeriodFromForm();
}

// === URL 参数与当前用户 ===
/** 读 location.search 查询参数。 */
function getUrlParam(name) {
    var reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)');
    var r = window.location.search.substr(1).match(reg);
    if (r != null) return decodeURIComponent(r[2]);
    return null;
}

/** 当前用户 id：管理端上下文优先，否则 localStorage.user_id。 */
function currentUserId() {
    if (window.__adminTaxBatchCtx && window.__adminTaxBatchCtx.username) {
        return String(window.__adminTaxBatchCtx.username);
    }
    return localStorage.getItem('user_id') || '64';
}

window.consultUserFlags = { is_test_account: false };

/**
 * 根据测试账号标志更新 consultUserFlags 并复位公司名只读态。
 * 副作用：写 window.consultUserFlags 与相关 DOM。
 */
function applyConsultTestRestrictions(user) {
    var isTest = !!(user && user.is_test_account);
    window.consultUserFlags = { is_test_account: isTest };
    var ef = document.getElementById('ef_company_name');
    var eh = document.getElementById('ef_test_hint');
    if (ef) {
        ef.readOnly = false;
        ef.style.background = '';
    }
    if (eh) eh.style.display = 'none';
    var fcn = document.getElementById('f_company_name');
    var fth = document.getElementById('f_tax_company_hint');
    if (fcn) {
        fcn.readOnly = false;
        fcn.style.background = '';
    }
    if (fth) fth.style.display = 'none';
    document.querySelectorAll('#batch_employment_list .batch-emp-company').forEach(function (el) {
        el.readOnly = false;
        el.style.background = '';
    });
}

/** 生成带 user_id 与 tab 的 consult.html 链接。 */
function tabHref(tab) {
    return 'consult.html?user_id=' + encodeURIComponent(currentUserId()) + '&tab=' + encodeURIComponent(tab);
}

// === Toast / 顶栏提示 ===
/** Toast 展示时长（TaxApp 或 TOAST_DURATION_MS）。 */
function getToastDurationMs() {
    if (window.TaxApp && TaxApp.ui && typeof TaxApp.ui.durationMs === 'function') {
        return TaxApp.ui.durationMs();
    }
    var ms = typeof window !== 'undefined' && window.TOAST_DURATION_MS != null
        ? Number(window.TOAST_DURATION_MS) : 3000;
    return isNaN(ms) || ms <= 0 ? 3000 : ms;
}

/**
 * 成功/失败提示：管理端回调 → TaxApp.toast → #msgBar。
 * 副作用：DOM 或外部 toast。
 */
function showMsg(text, ok) {
    if (window.__adminTaxBatchCtx && typeof window.__adminTaxBatchCtx.showMsg === 'function') {
        window.__adminTaxBatchCtx.showMsg(text, ok);
        return;
    }
    if (window.TaxApp && TaxApp.ui && typeof TaxApp.ui.toast === 'function') {
        TaxApp.ui.toast(text, { ok: !!ok, error: !ok });
        return;
    }
    var el = document.getElementById('msgBar');
    if (!el) return;
    el.innerHTML = '<div class="msg ' + (ok ? 'msg-success' : 'msg-error') + '">' + text + '</div>';
    setTimeout(function() { el.innerHTML = ''; }, getToastDurationMs());
}


// === 页签切换（个人信息 / 税务记录 / 激活） ===
/**
 * 切换页签面板、标题与 URL；按需拉消息/证明价/记录档案。
 * 副作用：DOM active、history.replaceState、异步刷新。
 */
function switchTab(tab, pushHistory) {
    if (typeof window.forceHidePageLoading === 'function') {
        window.forceHidePageLoading();
    }
    if (tab === 'profile' || tab === 'messages') {
        tab = 'employers';
    }
    document.querySelectorAll('.tabs .tab').forEach(function(a) {
        a.classList.toggle('active', a.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.tab-panel').forEach(function(p) {
        p.classList.remove('active');
    });
    var panelId = 'panel-' + tab;
    var pane = document.getElementById(panelId);
    if (pane) pane.classList.add('active');
    if (pushHistory !== false && history.replaceState) {
        var u = new URL(window.location.href);
        u.searchParams.set('user_id', currentUserId());
        u.searchParams.set('tab', tab);
        history.replaceState({}, '', u);
    }
    var titleEl = document.getElementById('consultPageTitle');
    if (titleEl) {
        if (tab === 'employers') titleEl.textContent = '个人信息';
        else if (tab === 'products') titleEl.textContent = '激活页面';
        else titleEl.textContent = '税务记录';
    }
    if (tab === 'employers') {
        refreshMessageList().catch(function () {});
    }
    if (tab === 'products') {
        loadConsultLizhiCertFeeCopy();
        loadConsultNajiluQrFeeCopy();
        var shebaoCard = document.getElementById('cardShebaoPhoto');
        if (shebaoCard && !shebaoCard.hidden && typeof loadConsultShebaoPhotos === 'function') {
            loadConsultShebaoPhotos().catch(function () {});
        }
    }
    if (tab === 'records') {
        /* 有新鲜缓存则不再重复拉 /api/tax / employers（启动时已拉过） */
        if (window.__consultRecordsCache && window.__consultEmployersCache) {
            syncCompanyProfilesFromTaxRecords(window.__consultRecordsCache);
            syncCompanyProfilesFromEmployers(window.__consultEmployersCache);
            refreshBatchCompanyHistoryDatalist();
            document.querySelectorAll('#batch_employment_list .batch-emp-company').forEach(
                tryApplyBatchCompanyProfileFromInput
            );
        } else {
            syncAllCompanyProfiles().then(function () {
                refreshBatchCompanyHistoryDatalist();
                document.querySelectorAll('#batch_employment_list .batch-emp-company').forEach(
                    tryApplyBatchCompanyProfileFromInput
                );
            });
        }
    }
}


/** 绑定页签点击并根据 URL 打开初始 tab。 */
function initTabs() {
    document.querySelectorAll('.tabs .tab').forEach(function(a) {
        var tabKey = a.getAttribute('data-tab');
        a.href = tabHref(tabKey);
        a.addEventListener('click', function(e) {
            e.preventDefault();
            switchTab(a.getAttribute('data-tab'), true);
        });
    });
    var tab = getUrlParam('tab') || 'records';
    if (tab === 'batch' || tab === 'batch_records') tab = 'records';
    if (tab === 'messages' || tab === 'profile') tab = 'employers';
    if (getUrlParam('open') === 'employer' || getUrlParam('onboarding') === 'employer') {
        tab = 'employers';
    }
    var valid = ['employers', 'records', 'products'];
    if (valid.indexOf(tab) < 0) tab = 'records';
    switchTab(tab, false);
}

// === 用户资料 / 开通入口 / 同行提示 ===
/** 把 account_active 写入 localStorage。 */
function syncAccountActiveToStorage(user) {
    if (!user) {
        return;
    }
    var act = user.account_active === true || user.account_active === 1;
    try {
        localStorage.setItem('account_active', act ? '1' : '0');
    } catch (e0) {}
}

/** 证明费用金额格式化为展示用元。 */
function formatConsultCertFeeYuan(raw) {
    var n = Number(String(raw == null ? '' : raw).replace(/,/g, '').trim());
    if (!isFinite(n) || n < 0) return '';
    return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
}

/**
 * 增值服务：离职/在职证明价格以后台「内容配置」为准。
 * 副作用：写徽章与提示文案 DOM。
 */
function applyConsultLizhiCertFeeCopy(amount) {
    var yuan = formatConsultCertFeeYuan(amount);
    if (!yuan) return;
    var badgeLizhi = document.getElementById('consultLizhiCertBadge');
    var badgeZaizhi = document.getElementById('consultZaizhiCertBadge');
    var hintLizhi = document.getElementById('consultLizhiCertHint');
    var hintZaizhi = document.getElementById('consultZaizhiCertHint');
    if (badgeLizhi) badgeLizhi.textContent = '¥' + yuan + ' 去水印';
    if (badgeZaizhi) badgeZaizhi.textContent = '¥' + yuan + ' 去水印';
    if (hintLizhi) {
        hintLizhi.textContent = '未付款可生成带「演示样例」水印；付 ¥' + yuan + ' 后去水印。';
    }
    if (hintZaizhi) {
        hintZaizhi.textContent =
            '未付款可生成带「演示样例」水印；付 ¥' + yuan + ' 后去水印。文书标题为「工作证明」。';
    }
}

/**
 * 完税二维码入口：价格/开通态以后台为准。
 * 副作用：写徽章、副文案与 CTA 文案。
 */
function applyConsultNajiluQrFeeCopy(data) {
    data = data || {};
    var yuan = formatConsultCertFeeYuan(data.fee_amount || data.amount);
    var unlocked = !!data.unlocked;
    var badge = document.getElementById('consultNajiluQrBadge');
    var hint = document.getElementById('consultNajiluQrHint');
    var cta = document.getElementById('btnConsultNajiluQrLabel');
    if (unlocked) {
        if (badge) badge.textContent = '已开通 · 无水印';
        if (hint) hint.textContent = '已开通去水印 · 官方 APP 可扫码查验';
        if (cta) cta.textContent = '去生成';
        return;
    }
    if (yuan) {
        if (badge) badge.textContent = '¥' + yuan + ' 去水印';
        if (hint) {
            hint.textContent = '官方 APP 可扫码查验 · 未付也可试（含水印）· 付 ¥' + yuan + ' 去水印';
        }
    }
    if (cta) cta.textContent = '去生成';
}

/**
 * 拉取离职/在职证明标价并刷新徽章文案（以后台「定价与引导」为准）。
 * 副作用：GET /api/public/lizhi-cert-fee → DOM；失败再试登录态 status。
 */
function loadConsultLizhiCertFeeCopy() {
    function amountFrom(j) {
        if (!j || j.code !== 200 || !j.data) return '';
        return j.data.fee_amount || j.data.amount || '';
    }
    function applyJson(j) {
        var amt = amountFrom(j);
        if (amt) applyConsultLizhiCertFeeCopy(amt);
        return !!amt;
    }
    fetch('/api/public/lizhi-cert-fee', { credentials: 'same-origin' })
        .then(function (r) {
            return (window.authParseJson||function(r){return r.json();})(r);
        })
        .then(function (j) {
            if (applyJson(j)) return;
            if (typeof window.authFetch !== 'function') return;
            return window.authFetch('/api/lizhi-cert/status').then(function (r) {
                return (window.authParseJson||function(r){return r.json();})(r);
            }).then(applyJson);
        })
        .catch(function () {
            if (typeof window.authFetch !== 'function') return;
            window
                .authFetch('/api/lizhi-cert/status')
                .then(function (r) {
                    return (window.authParseJson||function(r){return r.json();})(r);
                })
                .then(applyJson)
                .catch(function () {});
        });
}

/**
 * 拉取完税二维码标价/开通态（登录态）。
 * 副作用：GET /api/najilu-qr/status → DOM。
 */
function loadConsultNajiluQrFeeCopy() {
    if (typeof window.authFetch !== 'function') return;
    window
        .authFetch('/api/najilu-qr/status')
        .then(function (r) {
            return window.authParseJson ? (window.authParseJson||function(r){return r.json();})(r) : r.json();
        })
        .then(function (j) {
            if (j && j.code === 200 && j.data) {
                applyConsultNajiluQrFeeCopy(j.data);
            }
        })
        .catch(function () {});
}

/** 咨询页完税二维码入口点击埋点（去替换页前上报） */
function bindConsultNajiluQrEntryTrack() {
    var card = document.getElementById('najiluQrEntryCard');
    if (!card || card.getAttribute('data-najilu-track') === '1') return;
    card.setAttribute('data-najilu-track', '1');
    card.addEventListener('click', function () {
        if (typeof window.trackUserAction === 'function') {
            window.trackUserAction('track_najilu_qr_entry_click', {
                page: 'consult',
                from: 'consult'
            });
        }
    });
}

/**
 * 附加产品页：收拢开通/续费支付入口（始终展示）。
 * 副作用：按激活态改标题/按钮文案与 href。
 */
function syncConsultPurchaseEntry(user) {
    var card = document.getElementById('cardConsultPurchaseEntry');
    var hint = document.getElementById('consultPurchaseEntryHint');
    var title = document.getElementById('consultPurchaseEntryTitle');
    var badge = document.getElementById('consultPurchaseEntryBadge');
    var btn = document.getElementById('btnConsultPurchaseEntry');
    if (!card) return;
    card.hidden = false;
    var active = false;
    if (user && (user.account_active === true || user.account_active === 1 || user.account_active === '1')) {
        active = true;
    } else {
        try {
            active = localStorage.getItem('account_active') === '1';
        } catch (eA) {}
    }
    var daysLeft = user && user.active_days_left != null ? Number(user.active_days_left) : null;
    var kind = user && user.activation_kind != null ? String(user.activation_kind) : '';
    if (!active) {
        if (title) title.textContent = '开通权益';
        if (badge) badge.textContent = '支付宝';
        if (hint) {
            hint.textContent = '选套餐付款即可开通；支持体验价与 B 站分享立减。';
        }
        if (btn) {
            btn.textContent = '去支付开通';
            btn.setAttribute('href', 'purchase.html?from=consult_products');
            btn.setAttribute('target', '_top');
        }
        return;
    }
    if (title) {
        title.textContent = kind === 'permanent' ? '权益管理' : '续费 / 延长权益';
    }
    if (badge) badge.textContent = kind === 'permanent' ? '已永久' : '已开通';
    if (hint) {
        if (kind === 'permanent') {
            hint.textContent = '账号已永久开通。如需更换套餐或使用激活码，可进入支付页处理。';
        } else if (daysLeft != null && isFinite(daysLeft) && daysLeft >= 0) {
            hint.textContent =
                '当前试用约剩 ' + Math.ceil(daysLeft) + ' 天。付款可延长使用时长，建议到期前续费。';
        } else {
            hint.textContent = '付款可延长使用时长；试用到期前建议提前续费。';
        }
    }
    if (btn) {
        btn.textContent = kind === 'permanent' ? '打开支付页' : '去支付续费';
        btn.setAttribute('href', 'purchase.html?from=consult_products');
        btn.setAttribute('target', '_top');
    }
}

/**
 * 同行账号则展示个税修改付费提示条。
 * 副作用：GET tax_edit_policy → #peerTaxFeeBanner。
 */
function loadPeerTaxFeeBanner() {
    var banner = document.getElementById('peerTaxFeeBanner');
    if (!banner) return;
    window.authFetch('api/tax?action=tax_edit_policy')
        .then(function (r) {
            return (window.authParseJson||function(r){return r.json();})(r);
        })
        .then(function (j) {
            var pol = j && j.code === 200 ? j.data : null;
            if (!pol || !pol.peer_account) {
                banner.hidden = true;
                banner.textContent = '';
                return;
            }
            banner.hidden = false;
            banner.textContent =
                pol.peer_login_notice ||
                '该账号为同行账号，后续修改个税需先付费后才能继续。';
        })
        .catch(function () {});
}

/**
 * 拉用户摘要写入 localStorage 并刷新资料/开通入口。
 * 副作用：api/user summary、多处 DOM。
 */
function loadUserInfoFromApi() {
    var userId = currentUserId();
    
    if (!userId) {
        syncConsultPurchaseEntry(null);
        return;
    }
    
    window.authFetch('api/user?action=summary')
        .then(function (r) { return (window.authParseJson||function(r){return r.json();})(r); })
        .then(function (data) {
            if (data.code === 200) {
                var user = data.data;
                
                if (user.real_name) localStorage.setItem('real_name', user.real_name);
                if (user.tax_id) localStorage.setItem('tax_id', user.tax_id);
                if (user.employer_count != null) localStorage.setItem('employer_count', user.employer_count);
                if (user.family_count != null) localStorage.setItem('family_count', user.family_count);
                if (user.bank_card_count != null) localStorage.setItem('bank_card_count', user.bank_card_count);
                if (user.gender != null) localStorage.setItem('gender', user.gender);
                syncAccountActiveToStorage(user);
                syncConsultPurchaseEntry(user);
                updateProfileForm(user);
                loadPeerTaxFeeBanner();
            }
        })
        .catch(function (err) {
            console.error('loadUserInfoFromApi', err);
            syncConsultPurchaseEntry(null);
        });
}

/** 用用户对象更新标题、本地缓存与测试限制。 */
function updateProfileForm(user) {
    document.title = '个人中心 - ' + (user.real_name || '杰瑞');
    if (user.real_name) {
        try {
            localStorage.setItem('real_name', user.real_name);
        } catch (e0) {}
    }
    if (user.tax_id != null) {
        try {
            localStorage.setItem('tax_id', user.tax_id);
        } catch (e1) {}
    }
    if (user.gender != null) {
        try {
            localStorage.setItem('gender', String(user.gender));
        } catch (e2) {}
    }
    applyConsultTestRestrictions(user);
}

var MINE_FILL_DATA_BTN_KEY = 'cg_mine_fill_data_btn';
var MINE_FILL_DATA_OFF_CLASS = 'cg-mine-fill-data-off';

function isMineFillDataBtnOn() {
    if (window.ConversionGuide && typeof window.ConversionGuide.isMineFillDataBtnOn === 'function') {
        return window.ConversionGuide.isMineFillDataBtnOn();
    }
    try {
        return localStorage.getItem(MINE_FILL_DATA_BTN_KEY) !== '0';
    } catch (e) {
        return true;
    }
}

function setMineFillDataBtn(on) {
    if (window.ConversionGuide && typeof window.ConversionGuide.setMineFillDataBtn === 'function') {
        window.ConversionGuide.setMineFillDataBtn(on);
        return;
    }
    try {
        if (on) localStorage.removeItem(MINE_FILL_DATA_BTN_KEY);
        else localStorage.setItem(MINE_FILL_DATA_BTN_KEY, '0');
    } catch (e) {}
    document.documentElement.classList.toggle(MINE_FILL_DATA_OFF_CLASS, !on);
    try {
        window.dispatchEvent(new CustomEvent('cgMineFillDataBtnChange', { detail: { on: !!on } }));
    } catch (e2) {}
}

function syncConsultFillEntryToggle() {
    var btn = document.getElementById('consultFillEntryToggle');
    if (!btn) return;
    var on = isMineFillDataBtnOn();
    btn.textContent = on ? '隐藏填写' : '显示填写';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? '隐藏我的页填写数据按钮' : '显示我的页填写数据按钮');
}

function initConsultFillEntryToggle() {
    var btn = document.getElementById('consultFillEntryToggle');
    if (!btn || btn.getAttribute('data-fill-entry-bound') === '1') return;
    btn.setAttribute('data-fill-entry-bound', '1');
    syncConsultFillEntryToggle();
    btn.addEventListener('click', function () {
        setMineFillDataBtn(!isMineFillDataBtnOn());
        syncConsultFillEntryToggle();
    });
    window.addEventListener('cgMineFillDataBtnChange', syncConsultFillEntryToggle);
}

/**
 * 首屏头：同步所属期、证明价、本地开通入口；延迟拉用户。
 * 副作用：定时 loadUserInfoFromApi。
 */
function initHeader() {
    try {
        var name = localStorage.getItem('real_name') || '杰瑞';
        document.title = '个人中心 - ' + name;

        initConsultFillEntryToggle();
        initBelongingPeriodSync();
        initTaxReportedManualEditTracking();
        /* 本地激活态先亮支付入口，接口返回后再校正文案 */
        syncConsultPurchaseEntry(null);
        loadConsultLizhiCertFeeCopy();
        loadConsultNajiluQrFeeCopy();

        /* 用户资料不挡税务列表首屏 */
        setTimeout(function () {
            loadUserInfoFromApi();
        }, 1200);
    } catch (err) {
        console.error('initHeader', err);
    }
}

/** 从服务端拉取当前用户全部税务记录（收入纳税明细同源数据） */

// === 单条表单字段与所得类型 ===
/** 从表单取扣缴义务人名称（trim）。 */
function resolveLegacyCompanyFromForm() {
    var base = formObjectFromInputs();
    return base.company_name != null ? String(base.company_name).trim() : '';
}


/** 各段工作经历年终奖税额合计（单独计税）。 */
function sumEmploymentBonusTax(employments) {
    var sum = 0;
    (employments || []).forEach(function (emp) {
        var list = [];
        if (emp && Array.isArray(emp.bonuses) && emp.bonuses.length) {
            list = emp.bonuses;
        } else {
            if (emp && emp.yearEndBonus > 0) {
                list.push({ amount: emp.yearEndBonus });
            }
            (emp && emp.extraBonuses ? emp.extraBonuses : []).forEach(function (b) {
                list.push(b);
            });
        }
        list.forEach(function (b) {
            var amt = round2(parseFloat(b && (b.amount != null ? b.amount : b.yearEndBonus)) || 0);
            if (amt > 0) {
                sum = round2(sum + yearEndBonusTaxSeparate(amt));
            }
        });
    });
    return sum;
}

/** 各段工作经历裁员补偿税额合计（3 倍平均工资以上单独计税）。 */
function sumEmploymentSeveranceTax(employments) {
    var sum = 0;
    (employments || []).forEach(function (emp) {
        var list = [];
        if (emp && Array.isArray(emp.severances) && emp.severances.length) {
            list = emp.severances;
        }
        list.forEach(function (s) {
            var amt = round2(parseFloat(s && s.amount) || 0);
            if (amt > 0) {
                sum = round2(sum + severanceCompensationTaxSeparate(amt));
            }
        });
    });
    return sum;
}


/** 所得类型对应的默认小类。 */
function defaultIncomeSubtype(incomeType) {
    var key = String(incomeType || '').trim();
    return INCOME_TYPE_DEFAULT_SUBTYPES[key] || '';
}

/** 设置所得类型下拉；无选项时动态追加。副作用：改 select。 */
function setIncomeTypeSelectValue(incomeType) {
    var sel = document.getElementById('f_income_type');
    if (!sel) return;
    var v = String(incomeType || '').trim() || '工资薪金';
    var found = false;
    for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === v) {
            found = true;
            break;
        }
    }
    if (!found) {
        var opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
    }
    sel.value = v;
}

/** 所得类型变更时写入默认小类。 */
function syncIncomeSubtypeForTypeChange() {
    var typeEl = document.getElementById('f_income_type');
    var subEl = document.getElementById('f_income_subtype');
    if (!typeEl || !subEl) return;
    var next = defaultIncomeSubtype(typeEl.value);
    if (next) {
        subEl.value = next;
    }
}


/** 从单条记录表单 DOM 组装 record 对象（含默认年/月）。 */
function formObjectFromInputs() {
    function fieldVal(id, fallback) {
        var el = document.getElementById(id);
        if (!el) return fallback != null ? fallback : '';
        return el.value;
    }
    var nowY = String(new Date().getFullYear());
    var nowM = String(new Date().getMonth() + 1);
    return {
        id: fieldVal('editing_id', '') || ('tr_' + Date.now()),
        year: parseInt(fieldVal('f_year', nowY), 10),
        month: parseInt(fieldVal('f_month', nowM), 10),
        income_type: fieldVal('f_income_type', '工资薪金') || '工资薪金',
        income_subtype: fieldVal('f_income_subtype', '正常工资薪金'),
        company_name: fieldVal('f_company_name', ''),
        company_tax_id: fieldVal('f_company_tax_id', ''),
        tax_authority: fieldVal('f_tax_authority', ''),
        report_channel: fieldVal('f_report_channel', '其他'),
        report_date: fieldVal('f_report_date', ''),
        tax_period: fieldVal('f_tax_period', ''),
        income: fieldVal('f_income', '0'),
        tax_reported: fieldVal('f_tax_reported', '0'),
        income_this_period: fieldVal('f_income_this_period', '0'),
        tax_free_income: fieldVal('f_tax_free_income', '0'),
        deduction_fee: fieldVal('f_deduction_fee', '5000'),
        special_deduction: fieldVal('f_special_deduction', '0'),
        pension_insurance: fieldVal('f_pension_insurance', '0'),
        medical_insurance: fieldVal('f_medical_insurance', '0'),
        unemployment_insurance: fieldVal('f_unemployment_insurance', '0'),
        housing_fund: fieldVal('f_housing_fund', '0'),
        other_deduction: fieldVal('f_other_deduction', '0'),
        donation_deduction: fieldVal('f_donation_deduction', '0')
    };
}

// === 已申报税额手改追踪 ===
var taxReportedManualEdit = false;
var taxReportedLoadedValue = null;

/** 税额比较键：两位小数字符串。 */
function taxAmountKey(v) {
    var n = parseFloat(v);
    if (!isFinite(n)) {
        return '0.00';
    }
    return round2(n).toFixed(2);
}

/** 清除手改税额标记与加载快照。 */
function resetTaxReportedManualEditFlag() {
    taxReportedManualEdit = false;
    taxReportedLoadedValue = null;
}

/** 判断用户是否手改过已申报税额（相对加载值）。 */
function taxReportedWasManuallyChanged() {
    if (taxReportedManualEdit) {
        return true;
    }
    var editId = document.getElementById('editing_id').value;
    if (!editId || taxReportedLoadedValue == null) {
        return false;
    }
    var cur = taxAmountKey(document.getElementById('f_tax_reported').value);
    var loaded = taxAmountKey(taxReportedLoadedValue);
    return cur !== loaded;
}

/** 监听 #f_tax_reported 标记为手改（只初始化一次）。 */
function initTaxReportedManualEditTracking() {
    if (window.__taxReportedManualEditInited) return;
    window.__taxReportedManualEditInited = true;
    var el = document.getElementById('f_tax_reported');
    if (!el) return;
    function markManual() {
        taxReportedManualEdit = true;
    }
    el.addEventListener('input', markManual);
    el.addEventListener('change', markManual);
    el.addEventListener('blur', markManual);
}

// === 表单读写 / 专项扣除合计 ===
/**
 * 将记录填入单条表单；可能拆分超额减除费用到其他扣除。
 * 副作用：清草稿、写各 input、记忆公司档案。
 */
function applyToForm(r) {
    if (!_singleTaxDraftRestoring) {
        clearSingleTaxDraft();
    }
    resetTaxReportedManualEditFlag();
    document.getElementById('editing_id').value = r.id || '';
    document.getElementById('recordSubmitBtn').textContent = r.id ? '更新记录' : '添加记录';
    document.getElementById('f_year').value = r.year;
    document.getElementById('f_month').value = r.month;
    setIncomeTypeSelectValue(r.income_type || '工资薪金');
    document.getElementById('f_income_subtype').value = r.income_subtype || defaultIncomeSubtype(r.income_type || '工资薪金');
    document.getElementById('f_company_name').value = r.company_name || '';
    document.getElementById('f_company_tax_id').value = r.company_tax_id || '';
    document.getElementById('f_tax_authority').value = r.tax_authority || '';
    if (r.company_name) {
        rememberBatchCompanyProfile({
            name: String(r.company_name).trim(),
            company_tax_id: r.company_tax_id || '',
            tax_authority: r.tax_authority || ''
        });
    }
    document.getElementById('f_report_channel').value = r.report_channel || '其他';
    document.getElementById('f_report_date').value = r.report_date || '';
    document.getElementById('f_tax_period').value = r.tax_period || '';
    document.getElementById('f_income').value = r.income != null ? r.income : '0.00';
    taxReportedLoadedValue = r.tax_reported != null ? String(r.tax_reported) : '0.00';
    document.getElementById('f_tax_reported').value = taxReportedLoadedValue;
    document.getElementById('f_income_this_period').value = r.income_this_period != null ? r.income_this_period : '0.00';
    document.getElementById('f_tax_free_income').value = r.tax_free_income != null ? r.tax_free_income : '0.00';
    var dfRaw = parseFloat(r.deduction_fee) || 5000;
    var otherRaw = parseFloat(r.other_deduction) || 0;
    if (otherRaw <= 0 && dfRaw > 5000) {
        document.getElementById('f_deduction_fee').value = '5000.00';
        document.getElementById('f_other_deduction').value = round2(dfRaw - 5000).toFixed(2);
    } else {
        document.getElementById('f_deduction_fee').value = r.deduction_fee != null ? r.deduction_fee : '5000.00';
        document.getElementById('f_other_deduction').value = r.other_deduction != null ? r.other_deduction : '0.00';
    }
    document.getElementById('f_special_deduction').value = r.special_deduction != null ? r.special_deduction : '0.00';
    document.getElementById('f_pension_insurance').value = r.pension_insurance != null ? r.pension_insurance : '0.00';
    document.getElementById('f_medical_insurance').value = r.medical_insurance != null ? r.medical_insurance : '0.00';
    document.getElementById('f_unemployment_insurance').value = r.unemployment_insurance != null ? r.unemployment_insurance : '0.00';
    document.getElementById('f_housing_fund').value = r.housing_fund != null ? r.housing_fund : '0.00';
    document.getElementById('f_donation_deduction').value = r.donation_deduction != null ? r.donation_deduction : '0.00';
}

/** 清空单条表单并重置为添加模式。副作用：reset、initHeader。 */
function clearForm() {
    resetTaxReportedManualEditFlag();
    clearSingleTaxDraft();
    document.getElementById('editing_id').value = '';
    document.getElementById('recordSubmitBtn').textContent = '添加记录';
    document.getElementById('recordForm').reset();
    initHeader();
}

/**
 * 本期专项扣除 = 养老 + 医疗 + 失业 + 公积金（与申报口径一致）。
 * @returns {number} 四舍五入到分
 */
function sumSpecialDeductionFromForm() {
    var p = parseFloat(document.getElementById('f_pension_insurance').value) || 0;
    var m = parseFloat(document.getElementById('f_medical_insurance').value) || 0;
    var u = parseFloat(document.getElementById('f_unemployment_insurance').value) || 0;
    var h = parseFloat(document.getElementById('f_housing_fund').value) || 0;
    return round2(p + m + u + h);
}

// === 记录缓存补丁 / 按单位删除 ===
/**
 * 保存后补丁更新内存记录缓存（无则 unshift）。
 * 副作用：写 __consultRecordsCache。
 */
function patchConsultRecordsCacheAfterSave(record) {
    var list = Array.isArray(window.__consultRecordsCache)
        ? window.__consultRecordsCache.slice()
        : [];
    var rid = record && record.id != null ? String(record.id) : '';
    var found = false;
    var i;
    for (i = 0; i < list.length; i++) {
        if (list[i] && String(list[i].id) === rid) {
            list[i] = Object.assign({}, list[i], record);
            found = true;
            break;
        }
    }
    if (!found) {
        list.unshift(record);
    }
    window.__consultRecordsCache = list;
    return list;
}


/** 关闭按单位删除弹窗。 */
function closeDeleteTaxRecordsByCompanyModal() {
    var root = document.getElementById('deleteCompanyModal');
    if (root) {
        root.classList.remove('is-open');
    }
}

/** 收集记录中去重后的扣缴单位名（中文排序）。 */
function collectDistinctRecordCompanies(records) {
    var names = [];
    var seen = {};
    (records || []).forEach(function (r) {
        var n = String(r.company_name || '').trim();
        if (!n || seen[n]) {
            return;
        }
        seen[n] = true;
        names.push(n);
    });
    names.sort(function (a, b) {
        return a.localeCompare(b, 'zh-CN');
    });
    return names;
}


/**
 * 确认删除所选单位下全部记录并刷新列表。
 * 副作用：delete_records_by_company API。
 */
function confirmDeleteTaxRecordsByCompany() {
    var sel = document.getElementById('deleteCompanySelect');
    var company = sel ? String(sel.value || '').trim() : '';
    if (!company) {
        showConsultStrongAlert('请选择扣缴单位');
        return;
    }
    closeDeleteTaxRecordsByCompanyModal();
    if (!confirm('确定删除扣缴单位「' + company + '」下的全部税务记录？删除后可在回收站恢复。')) {
        return;
    }
    consultTaxWrite({
            action: 'delete_records_by_company',
            company_name: company
        })
        .then(function (r) {
            return (window.authParseJson||function(r){return r.json();})(r);
        })
        .then(function (data) {
            if (data.code === 200) {
                var n = data.data && data.data.deleted != null ? Number(data.data.deleted) : 0;
                showMsg(
                    n > 0
                        ? '已删除「' + company + '」共 ' + n + ' 条记录'
                        : '「' + company + '」下暂无记录',
                    true
                );
                return refreshRecordList();
            }
            throw new Error(data.msg || '删除失败');
        })
        .catch(function (err) {
            showMsg('删除失败：' + (err.message || ''), false);
        });
}

// === 回收站渲染与全部恢复 ===
var taxRecycleBinCache = [];


/** 删除时间展示为 YYYY-MM-DD 前缀。 */
function formatDeletedAtLabel(raw) {
    if (!raw) {
        return '';
    }
    var s = String(raw);
    if (s.length >= 10) {
        return s.slice(0, 10);
    }
    return s;
}

/** 回收站当前筛选的扣缴单位。 */
function getTaxRecycleBinFilterCompany() {
    var sel = document.getElementById('taxRecycleBinCompanySelect');
    return sel ? String(sel.value || '').trim() : '';
}

/** 按单位筛选可见的已删记录。 */
function getTaxRecycleBinVisibleRecords(list) {
    var company = getTaxRecycleBinFilterCompany();
    var all = list || [];
    if (!company) {
        return all.slice();
    }
    return all.filter(function (r) {
        return String(r.company_name || '').trim() === company;
    });
}

/** 按扣缴单位分组已删记录。 */
function groupDeletedRecordsByCompany(list) {
    var order = [];
    var map = {};
    (list || []).forEach(function (r) {
        var name = String(r.company_name || '').trim();
        var key = name || '__empty__';
        if (!map[key]) {
            map[key] = {
                company: name,
                label: name || '未填写扣缴单位',
                records: []
            };
            order.push(key);
        }
        map[key].records.push(r);
    });
    return order.map(function (key) {
        return map[key];
    });
}

/** 重建回收站单位下拉并尽量保留原选中。副作用：改 select。 */
function updateTaxRecycleBinCompanySelect(list) {
    var sel = document.getElementById('taxRecycleBinCompanySelect');
    if (!sel) {
        return;
    }
    var prev = String(sel.value || '').trim();
    var names = collectDistinctRecordCompanies(list);
    sel.innerHTML = '';
    var allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = '全部单位';
    sel.appendChild(allOpt);
    names.forEach(function (name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
    });
    if (prev && names.indexOf(prev) >= 0) {
        sel.value = prev;
    } else {
        sel.value = '';
    }
}

/** 更新回收站工具条计数与主按钮文案/模式。 */
function updateTaxRecycleBinChrome(list) {
    var visible = getTaxRecycleBinVisibleRecords(list);
    var total = (list || []).length;
    var toolbar = document.getElementById('taxRecycleBinToolbar');
    var countEl = document.getElementById('taxRecycleBinCount');
    var primary = document.getElementById('taxRecycleBinPrimaryAction');
    var company = getTaxRecycleBinFilterCompany();

    if (toolbar) {
        toolbar.hidden = total === 0;
    }
    if (countEl) {
        if (!total) {
            countEl.textContent = '';
        } else if (company) {
            countEl.textContent = '显示 ' + visible.length + ' / ' + total + ' 条';
        } else {
            countEl.textContent = '共 ' + total + ' 条';
        }
    }
    if (!primary) {
        return;
    }
    if (!visible.length) {
        primary.hidden = true;
        primary.disabled = true;
        return;
    }
    primary.hidden = false;
    primary.disabled = false;
    if (company) {
        primary.textContent = '恢复该公司（' + visible.length + '）';
        primary.setAttribute('data-mode', 'company');
    } else {
        primary.textContent = '全部恢复（' + visible.length + '）';
        primary.setAttribute('data-mode', 'all');
    }
}

/** 统计某单位在回收站中的条数。 */
function countDeletedRecordsByCompany(list, company) {
    var n = 0;
    (list || []).forEach(function (r) {
        if (String(r.company_name || '').trim() === company) {
            n += 1;
        }
    });
    return n;
}

/** 单条已删记录 HTML（含恢复按钮）。 */
function renderTaxRecycleBinItemHtml(r) {
    var idEsc = String(r.id).replace(/'/g, "\\'");
    var html = '';
    html += '<div class="recycle-bin-item">';
    html += '<div class="recycle-bin-item-title">' + r.year + '年' + r.month + '月 - ' + (r.income_type || '') + '</div>';
    html += '<div class="recycle-bin-item-meta">';
    html += '删除于 ' + formatDeletedAtLabel(r.deleted_at) + '<br>';
    if (!getTaxRecycleBinFilterCompany()) {
        html += '扣缴单位：' + (r.company_name || '') + '<br>';
    }
    html += '收入：' + (r.income || '0') + '元 | 已申报税额：' + (r.tax_reported || '0') + '元';
    html += '</div>';
    html += '<div class="recycle-bin-item-actions">';
    html += '<button type="button" class="btn btn-primary btn-sm" onclick="restoreDeletedTaxRecord(\'' + idEsc + '\')">恢复</button>';
    html += '</div></div>';
    return html;
}

/**
 * 渲染回收站列表（分组或扁平）。
 * 副作用：写 body、下拉与工具条。
 */
function renderTaxRecycleBinList(list) {
    updateTaxRecycleBinCompanySelect(list);
    updateTaxRecycleBinChrome(list);
    var body = document.getElementById('taxRecycleBinBody');
    if (!body) {
        return;
    }
    var visible = getTaxRecycleBinVisibleRecords(list);
    if (!(list || []).length) {
        body.innerHTML = '<div class="empty" style="padding:16px;">回收站为空</div>';
        return;
    }
    if (!visible.length) {
        body.innerHTML = '<div class="empty" style="padding:16px;">该单位暂无已删除记录</div>';
        return;
    }

    var filterCompany = getTaxRecycleBinFilterCompany();
    var html = '';
    if (filterCompany) {
        visible.forEach(function (r) {
            html += renderTaxRecycleBinItemHtml(r);
        });
    } else {
        var groups = groupDeletedRecordsByCompany(visible);
        groups.forEach(function (g) {
            var companyEsc = String(g.company).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            html += '<div class="recycle-bin-group">';
            html += '<div class="recycle-bin-group-head">';
            html +=
                '<div class="recycle-bin-group-title" title="' +
                String(g.label).replace(/"/g, '&quot;') +
                '">' +
                g.label +
                '</div>';
            html += '<span class="recycle-bin-group-count">' + g.records.length + ' 条</span>';
            if (g.company) {
                html +=
                    '<button type="button" class="btn btn-default btn-sm" onclick="restoreDeletedTaxRecordsByCompanyName(\'' +
                    companyEsc +
                    '\')">恢复该公司</button>';
            }
            html += '</div>';
            g.records.forEach(function (r) {
                html += renderTaxRecycleBinItemHtml(r);
            });
            html += '</div>';
        });
    }
    body.innerHTML = html;
}


/**
 * 一键恢复回收站全部记录。
 * 副作用：restore_all API、刷新列表与回收站。
 */
function restoreAllDeletedTaxRecords() {
    if (!taxRecycleBinCache.length) {
        showConsultStrongAlert('回收站为空');
        return;
    }
    if (!confirm('确定恢复回收站中的全部 ' + taxRecycleBinCache.length + ' 条记录？')) {
        return;
    }
    consultTaxWrite({
            action: 'restore_all_deleted_records',
            user_id: currentUserId()
        })
        .then(function (r) {
            return (window.authParseJson||function(r){return r.json();})(r);
        })
        .then(function (data) {
            if (data.code !== 200) {
                throw new Error(data.msg || '恢复失败');
            }
            var n = data.data && data.data.restored != null ? Number(data.data.restored) : 0;
            showMsg(n > 0 ? '已恢复 ' + n + ' 条记录' : '回收站为空', true);
            return Promise.all([apiFetchDeletedRecords(), refreshRecordList()]);
        })
        .then(function (res) {
            renderTaxRecycleBinList(res[0] || []);
        })
        .catch(function (err) {
            showMsg('恢复失败：' + (err.message || ''), false);
        });
}

/** 回收站主按钮：按 data-mode 全部恢复或按单位恢复。 */
function handleTaxRecycleBinPrimaryAction() {
    var primary = document.getElementById('taxRecycleBinPrimaryAction');
    var mode = primary ? primary.getAttribute('data-mode') : 'all';
    if (mode === 'company') {
        restoreDeletedTaxRecordsByCompany();
        return;
    }
    restoreAllDeletedTaxRecords();
}


// === 税额公式试算卡 ===
/** 金额四舍五入到分。 */
function round2(n) {
    var x = Number(n);
    if (Number.isNaN(x)) return 0;
    return Math.round(x * 100) / 100;
}

/**
 * 工资薪金累计预扣：累计应纳税所得额 T（元）对应的累计应预扣税额
 * 税率表：国税函〔2018〕164 号附件 综合所得七级超额累进
 */
function cumulativeTaxPayableFromCumulativeTaxable(T) {
    var t = Math.max(0, Number(T));
    if (t <= 0) return 0;
    var brackets = [
        { max: 36000, rate: 0.03, qd: 0 },
        { max: 144000, rate: 0.10, qd: 2520 },
        { max: 300000, rate: 0.20, qd: 16920 },
        { max: 420000, rate: 0.25, qd: 31920 },
        { max: 660000, rate: 0.30, qd: 52920 },
        { max: 960000, rate: 0.35, qd: 85920 },
        { max: Infinity, rate: 0.45, qd: 181920 }
    ];
    for (var i = 0; i < brackets.length; i++) {
        if (t <= brackets[i].max) {
            return t * brackets[i].rate - brackets[i].qd;
        }
    }
    return 0;
}

/**
 * 全年一次性奖金单独计税：应纳税额 = 奖金 × 税率 − 速算扣除数
 * 税率按 奖金÷12 对照月度换算表（国税相关口径）
 */
function yearEndBonusTaxSeparate(bonus) {
    var b = Number(bonus);
    if (!b || b <= 0) return 0;
    var monthlyEq = b / 12;
    var brackets = [
        { max: 3000, rate: 0.03, qd: 0 },
        { max: 12000, rate: 0.10, qd: 210 },
        { max: 25000, rate: 0.20, qd: 1410 },
        { max: 35000, rate: 0.25, qd: 2660 },
        { max: 55000, rate: 0.30, qd: 4410 },
        { max: 80000, rate: 0.35, qd: 7160 },
        { max: Infinity, rate: 0.45, qd: 15160 }
    ];
    for (var i = 0; i < brackets.length; i++) {
        if (monthlyEq <= brackets[i].max) {
            return round2(b * brackets[i].rate - brackets[i].qd);
        }
    }
    return 0;
}

/** 演示用：当地上年职工平均工资（元）。3 倍以内免税。 */
var SEVERANCE_LOCAL_AVG_WAGE = 120000;
var SEVERANCE_INCOME_SUBTYPE = '解除劳动合同一次性补偿收入';

function isSeveranceCompensationSubtype(sub) {
    var s = String(sub || '').trim();
    return s.indexOf('解除劳动合同') >= 0 || s.indexOf('裁员补偿') >= 0;
}

/**
 * 解除劳动合同一次性补偿：不超过当地上年职工平均工资 3 倍免税，
 * 超过部分单独适用综合所得税率表（年度）。
 */
function severanceCompensationTaxSeparate(amount, avgWage) {
    var a = Number(amount);
    if (!a || a <= 0) return 0;
    var avg = Number(avgWage);
    if (!avg || avg <= 0) avg = SEVERANCE_LOCAL_AVG_WAGE;
    var taxable = Math.max(0, a - avg * 3);
    if (!taxable) return 0;
    var brackets = [
        { max: 36000, rate: 0.03, qd: 0 },
        { max: 144000, rate: 0.10, qd: 2520 },
        { max: 300000, rate: 0.20, qd: 16920 },
        { max: 420000, rate: 0.25, qd: 31920 },
        { max: 660000, rate: 0.30, qd: 52920 },
        { max: 960000, rate: 0.35, qd: 85920 },
        { max: Infinity, rate: 0.45, qd: 181920 }
    ];
    for (var i = 0; i < brackets.length; i++) {
        if (taxable <= brackets[i].max) {
            return Math.max(0, round2(taxable * brackets[i].rate - brackets[i].qd));
        }
    }
    return 0;
}

function severanceTaxFreeIncome(amount, avgWage) {
    var a = Number(amount);
    if (!a || a <= 0) return 0;
    var avg = Number(avgWage);
    if (!avg || avg <= 0) avg = SEVERANCE_LOCAL_AVG_WAGE;
    return round2(Math.min(a, avg * 3));
}

/** 税额格式化为两位小数字符串。 */
function formatTaxYuan(n) {
    var x = Number(n);
    if (!isFinite(x)) return '0.00';
    return (Math.round(x * 100) / 100).toFixed(2);
}

/** 公式卡试算：累计预扣 / 年终奖税额。副作用：写 #taxTryResult。 */
function updateTaxTryResult() {
    var cumEl = document.getElementById('taxTryCumulative');
    var bonusEl = document.getElementById('taxTryBonus');
    var out = document.getElementById('taxTryResult');
    if (!out) return;
    var cum = cumEl ? parseFloat(cumEl.value) : NaN;
    var bonus = bonusEl ? parseFloat(bonusEl.value) : NaN;
    var hasCum = isFinite(cum) && cum >= 0 && String(cumEl.value).trim() !== '';
    var hasBonus = isFinite(bonus) && bonus > 0;
    if (!hasCum && !hasBonus) {
        out.innerHTML = '输入金额后自动计算累计预扣税额 / 年终奖税额。';
        return;
    }
    var parts = [];
    if (hasCum) {
        var tax = cumulativeTaxPayableFromCumulativeTaxable(cum);
        parts.push('累计预扣税额：<strong>¥' + formatTaxYuan(tax) + '</strong>');
    }
    if (hasBonus) {
        var bTax = yearEndBonusTaxSeparate(bonus);
        parts.push('年终奖税额：<strong>¥' + formatTaxYuan(bTax) + '</strong>');
        parts.push('<span style="color:#64748b;font-size:12px;">月度换算 ' + formatTaxYuan(bonus / 12) + ' 元</span>');
    }
    out.innerHTML = parts.join('<br>');
}

/** 绑定公式卡展开与试算输入（模块加载时即执行）。 */
function initTaxFormulaCard() {
    var card = document.getElementById('taxFormulaCard');
    var toggle = document.getElementById('taxFormulaToggle');
    if (toggle && card) {
        toggle.addEventListener('click', function () {
            var open = card.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }
    var cumEl = document.getElementById('taxTryCumulative');
    var bonusEl = document.getElementById('taxTryBonus');
    if (cumEl) {
        cumEl.addEventListener('input', updateTaxTryResult);
        cumEl.addEventListener('change', updateTaxTryResult);
    }
    if (bonusEl) {
        bonusEl.addEventListener('input', updateTaxTryResult);
        bonusEl.addEventListener('change', updateTaxTryResult);
    }
}
initTaxFormulaCard();

// === 个税 FAQ 筛选卡 ===
/** 按关键词与分类芯片过滤 FAQ 条目。副作用：item.hidden。 */
function applyTaxFaqFilters() {
    var card = document.getElementById('taxFaqCard');
    if (!card) return;
    var searchEl = document.getElementById('taxFaqSearch');
    var emptyEl = document.getElementById('taxFaqEmpty');
    var q = searchEl ? String(searchEl.value || '').trim().toLowerCase() : '';
    var activeChip = card.querySelector('.tax-faq-chip.is-active');
    var cat = activeChip ? String(activeChip.getAttribute('data-faq-filter') || 'all') : 'all';
    var items = card.querySelectorAll('#taxFaqList .tax-faq-item');
    var shown = 0;
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var itemCat = String(item.getAttribute('data-faq-cat') || '');
        var catOk = cat === 'all' || itemCat === cat;
        var text = '';
        if (q) {
            var sum = item.querySelector('summary');
            var body = item.querySelector('p');
            text = ((sum && sum.textContent) || '') + ' ' + ((body && body.textContent) || '');
            text = text.toLowerCase();
        }
        var qOk = !q || text.indexOf(q) >= 0;
        var ok = catOk && qOk;
        item.hidden = !ok;
        if (ok) shown += 1;
    }
    if (emptyEl) emptyEl.hidden = shown > 0;
}

/** 初始化 FAQ 卡（默认展开）并绑定搜索/芯片。 */
function initTaxFaqCard() {
    var card = document.getElementById('taxFaqCard');
    var toggle = document.getElementById('taxFaqToggle');
    if (!card) return;
    if (toggle && !toggle.__bound) {
        toggle.__bound = true;
        toggle.addEventListener('click', function () {
            var open = card.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }
    if (!card.classList.contains('is-open')) {
        card.classList.add('is-open');
        if (toggle) toggle.setAttribute('aria-expanded', 'true');
    }
    if (card.__faqFilterBound) {
        applyTaxFaqFilters();
        return;
    }
    card.__faqFilterBound = true;
    var searchEl = document.getElementById('taxFaqSearch');
    if (searchEl) {
        searchEl.addEventListener('input', applyTaxFaqFilters);
        searchEl.addEventListener('search', applyTaxFaqFilters);
    }
    var chips = card.querySelectorAll('.tax-faq-chip');
    for (var c = 0; c < chips.length; c++) {
        chips[c].addEventListener('click', function (ev) {
            var btn = ev.currentTarget;
            for (var j = 0; j < chips.length; j++) {
                chips[j].classList.remove('is-active');
                chips[j].setAttribute('aria-pressed', 'false');
            }
            btn.classList.add('is-active');
            btn.setAttribute('aria-pressed', 'true');
            applyTaxFaqFilters();
        });
    }
    applyTaxFaqFilters();
}
initTaxFaqCard();


// === 单条税务草稿（localStorage） ===
/** 单条草稿 localStorage key（含 user_id）。 */
function singleTaxDraftStorageKey() {
    return SINGLE_TAX_DRAFT_KEY_PREFIX + String(currentUserId());
}


/** 草稿是否含有效公司或金额。 */
function singleTaxDraftHasContent(record) {
    if (!record) {
        return false;
    }
    if (String(record.company_name || '').trim()) {
        return true;
    }
    if (parseFloat(record.income) > 0 || parseFloat(record.tax_reported) > 0) {
        return true;
    }
    if (parseFloat(record.income_this_period) > 0) {
        return true;
    }
    return false;
}

/** 序列化当前新建表单为草稿对象；编辑中返回 null。 */
function serializeSingleTaxDraft() {
    var editIdEl = document.getElementById('editing_id');
    if (editIdEl && editIdEl.value) {
        return null;
    }
    var record = formObjectFromInputs();
    delete record.id;
    if (!singleTaxDraftHasContent(record)) {
        return null;
    }
    return {
        v: 1,
        savedAt: Date.now(),
        record: record
    };
}


/** 防抖 500ms 后保存单条草稿。副作用：timer。 */
function scheduleSingleTaxDraftSave() {
    if (_singleTaxDraftRestoring) {
        return;
    }
    if (_singleTaxDraftSaveTimer) {
        clearTimeout(_singleTaxDraftSaveTimer);
    }
    _singleTaxDraftSaveTimer = setTimeout(saveSingleTaxDraftNow, 500);
}

/** 删除本地单条草稿。 */
function clearSingleTaxDraft() {
    try {
        localStorage.removeItem(singleTaxDraftStorageKey());
    } catch (eClearSingle) {}
}


// === 公司档案同步（税号 / 机关） ===
/** 公司名匹配键：去空白小写。 */
function companyNameMatchKey(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '');
}


/**
 * 从税务记录补全本地公司税号/机关档案。
 * 副作用：rememberBatchCompanyProfile。
 */
function syncCompanyProfilesFromTaxRecords(records) {
    if (!records || !records.length) return;
    records.forEach(function (r) {
        var name = String(r.company_name || '').trim();
        if (!name) return;
        var taxId = String(r.company_tax_id || '').trim();
        var auth = String(r.tax_authority || '').trim();
        if (!taxId && !auth) return;
        var old = getBatchCompanyProfile(name);
        rememberBatchCompanyProfile({
            name: name,
            company_tax_id: taxId || (old ? old.company_tax_id : ''),
            tax_authority: auth || (old ? old.tax_authority : '')
        });
    });
}

/**
 * 从任职受雇列表补全纳税人识别号（统一社会信用代码 → 工作经历税号字段）。
 * 副作用：rememberBatchCompanyProfile。
 */
function syncCompanyProfilesFromEmployers(employers) {
    if (!employers || !employers.length) return;
    employers.forEach(function (e) {
        var name = String(e.company_name || '').trim();
        var code = String(e.credit_code || '').trim();
        if (!name || !code) return;
        var old = getBatchCompanyProfile(name);
        rememberBatchCompanyProfile({
            name: name,
            company_tax_id: code || (old ? old.company_tax_id : ''),
            tax_authority: old ? old.tax_authority : ''
        });
    });
}

/** 并行拉 records+employers 后同步公司档案。 */
function syncAllCompanyProfiles() {
    return Promise.all([apiFetchRecords(), apiFetchEmployers()]).then(function (res) {
        syncCompanyProfilesFromTaxRecords(res[0] || []);
        syncCompanyProfilesFromEmployers(res[1] || []);
    });
}

/** 写 input 值并派发 input 事件（兼容旧浏览器）。 */
function setFormFieldValue(el, val) {
    if (!el) return;
    var v = val == null ? '' : String(val);
    el.value = v;
    try {
        el.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e0) {
        try {
            var ev = document.createEvent('HTMLEvents');
            ev.initEvent('input', true, false);
            el.dispatchEvent(ev);
        } catch (e1) {}
    }
}

/** 记住公司全称及纳税人识别号、主管税务机关（点选历史或生成记录时写入） */

// === 年月枚举与金额解析 ===
/** 枚举闭区间内全部 {year,month}。 */
function enumerateYmRange(sy, sm, ey, em) {
    var out = [];
    var startK = ymToKey(sy, sm);
    var endK = ymToKey(ey, em);
    if (startK > endK) return out;
    var y = sy;
    var mo = sm;
    while (true) {
        var cur = ymToKey(y, mo);
        if (cur > endK) break;
        out.push({ year: y, month: mo });
        mo++;
        if (mo > 12) {
            mo = 1;
            y++;
        }
    }
    return out;
}

/** 解析单段工作经历（含按月自定义工资 map → monthSalaryOverrides） */

/** 解析纯数字金额（去逗号）；非法返回 null。 */
function parseMoneyToken(raw) {
    var s = String(raw || '')
        .replace(/,/g, '')
        .replace(/，/g, '')
        .replace(/\s+/g, '')
        .trim();
    var n = parseFloat(s);
    if (!isFinite(n) || n < 0) {
        return null;
    }
    return round2(n);
}

/** 解析金额：支持 2万 / 18.2万 / 20000元 / 逗号千分位 */
function parseFlexibleMoney(raw) {
    var s = String(raw || '')
        .replace(/,/g, '')
        .replace(/，/g, '')
        .replace(/\s+/g, '')
        .trim();
    if (!s) {
        return null;
    }
    var wan = s.match(/^([\d.]+)\s*万/);
    if (wan) {
        var wv = parseFloat(wan[1]);
        if (!isFinite(wv) || wv < 0) {
            return null;
        }
        return round2(wv * 10000);
    }
    s = s.replace(/元$/g, '');
    return parseMoneyToken(s);
}

/** 统一标签：【扣缴义务人名称】： / [统计期间]： → 扣缴义务人名称： */
// === 个税粘贴文本解析（多公司） ===
function normalizeTaxPasteLabels(text) {
    return String(text || '')
        .replace(/\u00a0/g, ' ')
        .replace(/［/g, '[')
        .replace(/］/g, ']')
        .replace(/[【\[]\s*([^\]】\n]{1,40}?)\s*[】\]]\s*[：:]/g, '$1：')
        .replace(/统计期间/g, '统计区间')
        .replace(/所得期间/g, '统计区间')
        .replace(/已申报税额/g, '税额')
        .replace(/申报税额/g, '税额');
}

/**
 * 将个税 APP 截图 OCR 常见的多行月块折叠为单行明细，便于 parseTaxPasteDetailMonths。
 * 例：
 *   2024年01月
 *   正常工资薪金
 *   收入 20,000.00
 *   税额 150.50
 * → 2024年01月 收入20000元 税额150.50元
 */
function collapseTaxOcrMonthBlocks(text) {
    var s = String(text || '');
    if (!s) return s;
    s = s.replace(
        /(\d{4})\s*年\s*(\d{1,2})\s*月[^\S\n]*(?:\n[^\n]{0,80}){0,8}?\n?\s*收入\s*([\d,.]+)\s*(?:元)?[^\S\n]*(?:\n[^\n]{0,60}){0,5}?\n?\s*税额\s*([\d,.]+)\s*(?:元)?/gi,
        function (_m, y, mo, inc, tax) {
            return (
                y +
                '年' +
                parseInt(mo, 10) +
                '月 收入' +
                String(inc).replace(/,/g, '') +
                '元 税额' +
                String(tax).replace(/,/g, '') +
                '元\n'
            );
        }
    );
    return s;
}

/**
 * 聊天摘要里常见的「改为 / 数字改为」覆盖原金额，便于运营改数后直接粘贴。
 * 例：月薪税前2万（改为20000—23000区间）；发2万提成（改为21350.5）；奖金22000元—数字改为22621
 */

/** 将粘贴文本按扣缴义务人/公司块切分。 */
function splitTaxPasteEmployerBlocks(text) {
    var trimmed = String(text || '').trim();
    if (!trimmed) {
        return [];
    }
    var re =
        /(?=^\s*\d+\s*(?:[、.．)]\s*)?(?:扣缴义务人名称\s*[：:]|[^\n]{0,80}?(?:有限责任公司|股份有限公司|有限公司)))/m;
    var parts = trimmed
        .split(re)
        .map(function (p) {
            return String(p || '').trim();
        })
        .filter(function (p) {
            return p.length > 8 && /(?:公司|有限|扣缴义务人名称)/.test(p);
        });
    if (parts.length >= 2) {
        return parts;
    }
    var named = trimmed.split(/(?=扣缴义务人名称\s*[：:])/);
    if (named.length >= 2) {
        var namedParts = named
            .map(function (p) {
                return String(p || '').trim();
            })
            .filter(function (p) {
                return p.length > 8;
            });
        if (namedParts.length >= 2) {
            return namedParts;
        }
    }
    return [trimmed];
}

/** 从单段粘贴文本提取公司名称。 */
function extractTaxPasteCompanyName(block) {
    var m =
        block.match(/扣缴义务人名称\s*[：:]\s*(.+)/) ||
        block.match(/公司名称\s*[：:]\s*(.+)/) ||
        block.match(/扣缴单位\s*[：:]\s*(.+)/);
    if (m) {
        return String(m[1] || '')
            .replace(/\s+$/g, '')
            .replace(/[（(]?统计区间.*$/, '')
            .replace(/扣缴义务人纳税人识别号.*$/, '')
            .replace(/纳税人识别号.*$/, '')
            .trim();
    }
    var lines = block.split('\n').map(function (l) {
        return String(l || '').trim();
    }).filter(Boolean);
    var i;
    for (i = 0; i < lines.length; i++) {
        var line = lines[i].replace(/^\d+\s*[、.．)]?\s*/, '').trim();
        if (/公司|有限|集团/.test(line) && !/识别号|税务机关|入职|工资|分红|提成|个税|统计区间|收入|税额/.test(line)) {
            return line.slice(0, 80);
        }
    }
    return '';
}


/**
 * 展开个税粘贴中的年份。
 * 两位年：00–69 → 2000–2069，70–99 → 1970–1999（咨询场景多为近二十年，故优先 20xx）。
 * 四位年：1970–2100 原样采用。
 */
function expandTaxPasteYear(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s || !/^\d{1,4}$/.test(s)) {
        return null;
    }
    var n = parseInt(s, 10);
    if (!isFinite(n) || n < 0) {
        return null;
    }
    if (s.length <= 2 || n < 100) {
        n += n >= 70 ? 1900 : 2000;
    }
    if (n < 1970 || n > 2100) {
        return null;
    }
    return n;
}

/** 解析「年 + 月」一对，月份须为 1–12。 */
function parseTaxPasteYearMonthPair(yearRaw, monthRaw) {
    var y = expandTaxPasteYear(yearRaw);
    var m = parseInt(monthRaw, 10);
    if (!y || !m || m < 1 || m > 12) {
        return null;
    }
    return { y: y, m: m };
}

/**
 * 从文本中识别自然任职区间。
 * 支持：23年4月到26年8月、2023年4月-2026年8月、2023.4~2026.8、
 * 2023年4月至2026年8月，以及 en/zh 破折号 — – - ~ ～ 到 至。
 * 仅有年份的「23年到26年」视为当年 1 月至当年 12 月。
 */
function parseTaxPasteNaturalYmRange(block) {
    var text = String(block || '');
    if (!text) {
        return null;
    }
    var sep = '[-–—~～至到]+';
    var patterns = [
        new RegExp(
            '(\\d{2,4})\\s*(?:年|[.\\-/])\\s*(\\d{1,2})\\s*月?\\s*' +
                sep +
                '\\s*(\\d{2,4})\\s*(?:年|[.\\-/])\\s*(\\d{1,2})\\s*月?'
        ),
        new RegExp('(\\d{2,4})\\s*年\\s*' + sep + '\\s*(\\d{2,4})\\s*年(?!\\s*\\d)')
    ];
    var i;
    for (i = 0; i < patterns.length; i++) {
        var m = text.match(patterns[i]);
        if (!m) {
            continue;
        }
        var start;
        var end;
        if (m.length >= 5 && m[2] != null && m[4] != null) {
            start = parseTaxPasteYearMonthPair(m[1], m[2]);
            end = parseTaxPasteYearMonthPair(m[3], m[4]);
        } else {
            start = parseTaxPasteYearMonthPair(m[1], 1);
            end = parseTaxPasteYearMonthPair(m[2], 12);
        }
        if (!start || !end) {
            continue;
        }
        if (ymToKey(start.y, start.m) > ymToKey(end.y, end.m)) {
            continue;
        }
        return { sy: start.y, sm: start.m, ey: end.y, em: end.m };
    }
    return null;
}

/** 摘要模式推断任职起止年月。 */
function inferTaxPasteSummaryRange(block, bonuses) {
    var rangeFromText = parseTaxPasteNaturalYmRange(block);
    if (rangeFromText) {
        return rangeFromText;
    }
    var hire = null;
    var hireM = block.match(/入职\s*[：:]?\s*[^\n]{0,20}?(\d{2,4})\s*年\s*(\d{1,2})\s*月/);
    if (hireM) {
        var hireYm = parseTaxPasteYearMonthPair(hireM[1], hireM[2]);
        if (hireYm) {
            hire = hireYm;
        }
    }
    var fullYears = [];
    var fyRe = /(\d{2,4})\s*年?\s*全年/g;
    var fm;
    while ((fm = fyRe.exec(block)) !== null) {
        var y = expandTaxPasteYear(fm[1]);
        if (y && fullYears.indexOf(y) < 0) {
            fullYears.push(y);
        }
    }
    fullYears.sort(function (a, b) {
        return a - b;
    });
    var until = null;
    var untilM = block.match(/一直到\s*(\d{2,4})\s*年\s*(\d{1,2})\s*月/);
    if (untilM) {
        var untilYm = parseTaxPasteYearMonthPair(untilM[1], untilM[2]);
        if (untilYm) {
            until = untilYm;
        }
    }
    var sy = null;
    var sm = null;
    var ey = null;
    var em = null;
    if (hire) {
        sy = hire.y;
        sm = hire.m;
    } else if (fullYears.length) {
        sy = fullYears[0];
        sm = 1;
    }
    if (until) {
        ey = until.y;
        em = until.m;
    } else if (fullYears.length) {
        ey = fullYears[fullYears.length - 1];
        em = 12;
    }
    if ((sy == null || ey == null) && bonuses && bonuses.length) {
        var b0 = bonuses[0];
        var b1 = bonuses[bonuses.length - 1];
        if (sy == null) {
            sy = b0.year;
            sm = b0.month;
        }
        if (ey == null) {
            ey = b1.year;
            em = b1.month;
        }
    }
    if (sy == null || ey == null || !sm || !em) {
        return null;
    }
    if (ymToKey(sy, sm) > ymToKey(ey, em)) {
        return null;
    }
    return { sy: sy, sm: sm, ey: ey, em: em };
}

/** 按区间与月薪生成摘要月份行（税额留空待算）。 */
function buildSummaryMonthsFromRange(range, salary, salaryMax) {
    var months = [];
    var mid =
        salary != null && salaryMax != null && salaryMax > salary
            ? round2((salary + salaryMax) / 2)
            : salary != null
              ? salary
              : salaryMax != null
                ? salaryMax
                : 0;
    var list = enumerateYmRange(range.sy, range.sm, range.ey, range.em);
    var i;
    for (i = 0; i < list.length; i++) {
        var ym = list[i];
        months.push({
            year: ym.year,
            month: ym.month,
            income: mid,
            tax: null,
            key: ym.year + '-' + pad2(ym.month)
        });
    }
    return months;
}

/** 汇总粘贴就业段收入/税额并校正 tax_locked。 */
function finalizeTaxPasteEmployment(emp) {
    var incomeSum = 0;
    var taxSum = 0;
    var taxLocked = true;
    emp.months.forEach(function (row) {
        incomeSum = round2(incomeSum + (parseFloat(row.income) || 0));
        if (row.tax == null || !isFinite(row.tax)) {
            taxLocked = false;
        } else {
            taxSum = round2(taxSum + row.tax);
        }
    });
    if (!emp.months.length) {
        taxLocked = false;
    }
    emp.income_sum = incomeSum;
    emp.tax_sum = taxLocked ? taxSum : 0;
    emp.tax_locked = !!emp.tax_locked && taxLocked && emp.mode === 'detail';
    if (emp.mode === 'summary') {
        emp.tax_locked = false;
    }
    return emp;
}

/** 摘要模板未写税号/机关/社保时，按月薪补默认值（不影响 APP 月明细粘贴）。 */
function applyTaxPasteSummaryFieldDefaults(input) {
    var out = {
        company_tax_id: input && input.company_tax_id ? String(input.company_tax_id).trim() : '',
        tax_authority: input && input.tax_authority ? String(input.tax_authority).trim() : '',
        specials: {
            pension: input && input.specials ? input.specials.pension : null,
            medical: input && input.specials ? input.specials.medical : null,
            unemployment: input && input.specials ? input.specials.unemployment : null,
            fund: input && input.specials ? input.specials.fund : null
        }
    };
    if (!out.company_tax_id) {
        out.company_tax_id = '91110105MA01K9XH2B';
    }
    if (!out.tax_authority) {
        out.tax_authority = inferTaxAuthorityFromCompanyName(input && input.company);
    }
    var hasAnySpecial =
        (out.specials.pension != null && out.specials.pension > 0) ||
        (out.specials.medical != null && out.specials.medical > 0) ||
        (out.specials.unemployment != null && out.specials.unemployment > 0) ||
        (out.specials.fund != null && out.specials.fund > 0);
    var salary = input && input.salary != null ? Number(input.salary) : 0;
    if (!hasAnySpecial && salary > 0) {
        out.specials.pension = round2(salary * 0.08);
        out.specials.medical = round2(salary * 0.02);
        out.specials.unemployment = round2(salary * 0.005);
        out.specials.fund = round2(salary * 0.12);
    }
    return out;
}

/** 按公司名里的城市推断主管税务机关。 */
function inferTaxAuthorityFromCompanyName(company) {
    var s = String(company || '');
    var pairs = [
        [/北京/, '国家税务总局北京市朝阳区税务局'],
        [/上海/, '国家税务总局上海市浦东新区税务局'],
        [/深圳/, '国家税务总局深圳市南山区税务局'],
        [/杭州/, '国家税务总局杭州市西湖区税务局'],
        [/广州/, '国家税务总局广州市天河区税务局'],
        [/成都/, '国家税务总局成都高新技术产业开发区税务局'],
        [/南京/, '国家税务总局南京市鼓楼区税务局'],
        [/武汉/, '国家税务总局武汉东湖新技术开发区税务局'],
        [/苏州/, '国家税务总局苏州工业园区税务局'],
        [/重庆/, '国家税务总局重庆市渝北区税务局'],
        [/天津/, '国家税务总局天津经济技术开发区税务局'],
        [/西安/, '国家税务总局西安高新技术产业开发区税务局']
    ];
    var i;
    for (i = 0; i < pairs.length; i++) {
        if (pairs[i][0].test(s)) {
            return pairs[i][1];
        }
    }
    return '国家税务总局北京市朝阳区税务局';
}

/**
 * 解析单段粘贴文本（一家公司）：支持 APP 月明细或自然语言摘要。
 */
function parseOneTaxPasteEmployerBlock(block) {
    var company = extractTaxPasteCompanyName(block);
    var taxIdM = block.match(/(?:扣缴义务人)?纳税人识别号\s*[：:]\s*([0-9A-Za-z]+)/);
    var companyTaxId = taxIdM ? String(taxIdM[1] || '').trim() : '';
    var authM = block.match(/主管税务机关\s*[：:]\s*([^\n]+)/);
    var taxAuthority = authM
        ? String(authM[1] || '')
              .replace(/\s+$/g, '')
              .trim()
        : '';
    var salaryInfo = parseTaxPasteSalaryRange(block);
    var bonuses = parseTaxPasteBonuses(block);
    var specials = parseTaxPasteMonthlySpecials(block);
    var detailMonths = parseTaxPasteDetailMonths(block);
    var range = null;
    var months = [];
    var mode = 'detail';

    if (detailMonths.length) {
        mode = 'detail';
        months = detailMonths;
        var first = months[0];
        var last = months[months.length - 1];
        range = { sy: first.year, sm: first.month, ey: last.year, em: last.month };
        var naturalRange = parseTaxPasteNaturalYmRange(block);
        if (naturalRange) {
            range = naturalRange;
        }
        if (salaryInfo.salary == null) {
            var incomes = months.map(function (r) {
                return r.income;
            });
            incomes.sort(function (a, b) {
                return a - b;
            });
            salaryInfo.salary = incomes[Math.floor(incomes.length / 2)] || incomes[0] || 0;
        }
    } else {
        mode = 'summary';
        range = inferTaxPasteSummaryRange(block, bonuses);
        if (!range) {
            return {
                ok: false,
                error:
                    '未识别到任职区间：请写明入职时间、「YYYY年全年」、「23年4月到26年8月」或「一直到YYYY年M月」，或粘贴「YYYY年M月 收入x元 税额y元」月明细'
            };
        }
        if (salaryInfo.salary == null && salaryInfo.salary_max == null) {
            return {
                ok: false,
                error: '未识别到月薪：请写明「正常工资薪金：月薪税前x万」或「10000—15000元」等'
            };
        }
        months = buildSummaryMonthsFromRange(range, salaryInfo.salary, salaryInfo.salary_max);
        var filled = applyTaxPasteSummaryFieldDefaults({
            company: company,
            company_tax_id: companyTaxId,
            tax_authority: taxAuthority,
            salary: salaryInfo.salary,
            specials: specials
        });
        companyTaxId = filled.company_tax_id;
        taxAuthority = filled.tax_authority;
        specials = filled.specials;
    }

    if (!company) {
        return { ok: false, error: '未识别到公司名称，请包含公司全称或「扣缴义务人名称：xxx」' };
    }
    if (!months.length) {
        return { ok: false, error: '未能展开出有效月份，请检查入职/全年区间' };
    }

    return finalizeTaxPasteEmployment({
        ok: true,
        mode: mode,
        tax_locked: mode === 'detail',
        company: company,
        company_tax_id: companyTaxId,
        tax_authority: taxAuthority,
        salary: salaryInfo.salary,
        salary_max: salaryInfo.salary_max,
        bonuses: bonuses,
        specials: specials,
        pension: specials.pension,
        medical: specials.medical,
        unemployment: specials.unemployment,
        fund: specials.fund,
        range: range,
        months: months
    });
}

/**
 * 解析粘贴的个税 APP / 聊天记录文本（可含多家公司）。
 */

/** 生成粘贴解析预览纯文本。 */
function formatTaxPastePreview(parsed) {
    if (!parsed || !parsed.ok) {
        return parsed && parsed.error ? parsed.error : '解析失败';
    }
    var lines = [];
    var list = parsed.employments || [parsed];
    lines.push('共识别 ' + list.length + ' 家公司，合计 ' + (parsed.month_total || parsed.months.length) + ' 个月');
    if (parsed.tax_locked) {
        lines.push('税额：使用粘贴明细（不重算）');
    } else {
        lines.push('税额：摘要模式，生成时按公式重算');
    }
    list.forEach(function (emp, idx) {
        lines.push('—— ' + (idx + 1) + '. ' + emp.company + ' ——');
        if (emp.company_tax_id) {
            lines.push('税号：' + emp.company_tax_id);
        }
        if (emp.tax_authority) {
            lines.push('机关：' + emp.tax_authority);
        }
        lines.push(
            '区间：' +
                emp.range.sy +
                '年' +
                emp.range.sm +
                '月 — ' +
                emp.range.ey +
                '年' +
                emp.range.em +
                '月（' +
                emp.months.length +
                ' 个月）'
        );
        if (emp.salary != null) {
            lines.push(
                '月薪：' +
                    emp.salary +
                    (emp.salary_max != null && emp.salary_max > emp.salary
                        ? ' — ' + emp.salary_max
                        : '') +
                    ' 元'
            );
        }
        if (emp.bonuses && emp.bonuses.length) {
            lines.push(
                '奖金/提成：' +
                    emp.bonuses
                        .map(function (b) {
                            return b.year + '年' + b.month + '月 ' + b.amount + '元';
                        })
                        .join('；')
            );
        }
        var spBits = [];
        if (emp.pension != null && emp.pension > 0) {
            spBits.push('养老 ' + emp.pension);
        }
        if (emp.medical != null && emp.medical > 0) {
            spBits.push('医疗 ' + emp.medical);
        }
        if (emp.unemployment != null && emp.unemployment > 0) {
            spBits.push('失业 ' + emp.unemployment);
        }
        if (emp.fund != null && emp.fund > 0) {
            spBits.push('公积金 ' + emp.fund);
        }
        if (spBits.length) {
            lines.push('每月专项扣除：' + spBits.join('；') + '（元）');
        }
        if (emp.mode === 'detail') {
            lines.push('收入合计：' + emp.income_sum + ' 元；税额合计：' + emp.tax_sum + ' 元');
            var sample = emp.months.slice(0, 2).map(function (r) {
                return r.year + '年' + r.month + '月 收入' + r.income + ' / 税' + r.tax;
            });
            if (sample.length) {
                lines.push('样例：' + sample.join('；'));
            }
        } else {
            lines.push('摘要展开：按月薪生成工资行，税额将自动计算');
        }
    });
    if (parsed.parse_warnings && parsed.parse_warnings.length) {
        lines.push('部分段落未解析：' + parsed.parse_warnings.join('；'));
    }
    return lines.join('\n');
}


/**
 * 将解析出的一段就业写入批量工作经历行。
 * 副作用：setBatchEmpRowValues、更新按月工资徽章。
 */
function applyOneTaxPasteEmpToRow(row, emp) {
    if (!row || !emp) {
        return;
    }
    var monthSalaryMap = {};
    var monthTaxMap = {};
    if (emp.mode === 'detail') {
        emp.months.forEach(function (m) {
            monthSalaryMap[m.key] = m.income;
            if (m.tax != null && isFinite(m.tax)) {
                monthTaxMap[m.key] = m.tax;
            }
        });
    }
    var salary = emp.salary;
    if (salary == null && emp.months.length) {
        var incomes = emp.months.map(function (m) {
            return m.income;
        });
        incomes.sort(function (a, b) {
            return a - b;
        });
        salary = incomes[Math.floor(incomes.length / 2)] || incomes[0] || 0;
    }
    var bonuses = Array.isArray(emp.bonuses) ? emp.bonuses.slice() : [];
    var pension = emp.pension != null ? emp.pension : 0;
    var medical = emp.medical != null ? emp.medical : 0;
    var unemployment = emp.unemployment != null ? emp.unemployment : 0;
    var fund = emp.fund != null ? emp.fund : 0;
    var hasSpecials = pension > 0 || medical > 0 || unemployment > 0 || fund > 0;
    /* 粘贴为绝对月扣额时不填缴费基数，避免比例联动覆盖解析结果 */
    setBatchEmpRowValues(row, {
        company: emp.company,
        company_tax_id: emp.company_tax_id || '',
        tax_authority: emp.tax_authority || '',
        sy: emp.range.sy,
        sm: emp.range.sm,
        ey: emp.range.ey,
        em: emp.range.em,
        salary: salary != null ? salary : '',
        salary_max: emp.salary_max != null ? emp.salary_max : '',
        ss_base: '',
        fund_base: '',
        pension_ratio: 8,
        medical_ratio: 2,
        unemployment_ratio: 0.5,
        fund_ratio: 12,
        pension: pension,
        medical: medical,
        unemployment: unemployment,
        fund: fund,
        special: 0,
        deductOpen: hasSpecials,
        bonuses: bonuses.map(function (b) {
            return { amount: b.amount, year: b.year, month: b.month };
        }),
        bonusOpen: bonuses.length > 0,
        monthSalaryMap: monthSalaryMap,
        monthTaxMap: monthTaxMap
    });
    updateBatchEmpMonthSalaryBadge(row);
}


// === 个人信息粘贴辅助（身份证 / 地址 / 卡） ===
/** 保留数字字符。 */
function digitsOnlyProfile(raw) {
    return String(raw || '').replace(/\D/g, '');
}

/** 18 位身份证推出生日期 YYYY-MM-DD。 */
function birthFromId18Consult(idStr) {
    var s = String(idStr || '').trim().toUpperCase();
    if (s.length !== 18 || !/^\d{17}[\dX]$/.test(s)) {
        return '';
    }
    var d = s.substring(6, 14);
    if (!/^\d{8}$/.test(d)) {
        return '';
    }
    return d.substring(0, 4) + '-' + d.substring(4, 6) + '-' + d.substring(6, 8);
}

/** 18 位身份证推性别：1 男 / 2 女。 */
function genderFromId18Consult(idStr) {
    var s = String(idStr || '').trim().toUpperCase();
    if (s.length !== 18 || !/^\d{17}[\dX]$/.test(s)) {
        return null;
    }
    var c = parseInt(s.charAt(16), 10);
    if (isNaN(c)) {
        return null;
    }
    return c % 2 === 1 ? 1 : 2;
}

/** 中文地址拆成地区 + 详细地址。 */
function splitCnAddressConsult(full) {
    var s = String(full || '').replace(/\s+/g, '').trim();
    if (!s) {
        return { area: '', detail: '' };
    }
    var m = s.match(
        /^(.+?(?:省|自治区|特别行政区)|(?:北京|天津|上海|重庆)市?)(.+?市|.+?(?:地区|盟|自治州)|.+?州)?(.*)$/
    );
    if (!m) {
        return { area: '', detail: s };
    }
    var province = String(m[1] || '').trim();
    var rest = String(m[3] || '').trim();
    var city = String(m[2] || '').trim();
    var district = '';
    if (rest) {
        var dm = rest.match(/^(.+?(?:区|县|市|旗))(.*)$/);
        if (dm && dm[1] && dm[1].length <= 12) {
            district = String(dm[1] || '').trim();
            rest = String(dm[2] || '').trim();
        }
    }
    var parts = [];
    if (province) parts.push(province);
    if (city && city !== '市辖区' && city !== '县') parts.push(city);
    if (district) parts.push(district);
    return { area: parts.join(' '), detail: rest || s };
}

/** 从粘贴文或卡 BIN 推断银行名。 */
function inferBankNameFromPasteText(text, cardNo) {
    var t = String(text || '');
    var named = t.match(
        /(?:中国)?(工商银行|建设银行|农业银行|中国银行|交通银行|邮储银行|邮政储蓄银行|招商银行|浦发银行|中信银行|光大银行|华夏银行|民生银行|平安银行|兴业银行|广发银行)/
    );
    if (named) {
        var n = named[1];
        if (n === '邮政储蓄银行') {
            return '邮储银行';
        }
        return n;
    }
    if (window.BankCardBins && typeof window.BankCardBins.inferBankNameFromCardNo === 'function') {
        var bn = window.BankCardBins.inferBankNameFromCardNo(cardNo);
        if (bn && bn !== '银行卡') {
            return bn;
        }
    }
    return '银行卡';
}


/** 个人信息粘贴解析预览文本。 */
function formatProfilePastePreview(parsed) {
    if (!parsed || !parsed.ok) {
        return parsed && parsed.error ? parsed.error : '解析失败';
    }
    var lines = [];
    if (parsed.real_name) lines.push('姓名：' + parsed.real_name);
    if (parsed.phone) lines.push('手机：' + parsed.phone);
    if (parsed.tax_id) lines.push('身份证：' + parsed.tax_id);
    if (parsed.birth_date) {
        lines.push(
            '出生日期：' +
                parsed.birth_date +
                (parsed.gender === 1 ? '（男）' : parsed.gender === 2 ? '（女）' : '')
        );
    }
    if (parsed.address_area) lines.push('地区：' + parsed.address_area);
    if (parsed.address_detail) lines.push('详细地址：' + parsed.address_detail);
    if (parsed.card_no) {
        lines.push('银行卡：' + (parsed.bank_name || '银行卡') + ' ' + parsed.card_no);
    }
    if (!lines.length) {
        lines.push('未识别到有效字段');
    }
    if (parsed.warnings && parsed.warnings.length) {
        lines.push('注意：' + parsed.warnings.join('；'));
    }
    return lines.join('\n');
}


// === 累计预扣税额计算（单条/批量共用） ===
/**
 * 按自然年累计预扣，返回 ym→当月税额 map。
 * monthlyTaxableFn(salary) 提供各月应纳税所得额。
 */
function taxesMapForEmploymentMonthEntries(monthEntries, monthlyTaxableFn) {
    var taxMap = {};
    var byYear = {};
    var i;
    for (i = 0; i < monthEntries.length; i++) {
        var e = monthEntries[i];
        if (!byYear[e.year]) byYear[e.year] = [];
        byYear[e.year].push({ month: e.month, salary: e.salary });
    }
    var years = Object.keys(byYear).map(function (x) {
        return parseInt(x, 10);
    });
    years.sort(function (a, b) {
        return a - b;
    });
    var yi;
    for (yi = 0; yi < years.length; yi++) {
        var y = years[yi];
        var arr = byYear[y].slice().sort(function (a, b) {
            return a.month - b.month;
        });
        var prefix = [0];
        var mi;
        for (mi = 0; mi < arr.length; mi++) {
            var mt = monthlyTaxableFn(arr[mi].salary);
            prefix[mi + 1] = round2(prefix[mi] + mt);
        }
        for (mi = 0; mi < arr.length; mi++) {
            var mo = arr[mi].month;
            var cumPrev = prefix[mi];
            var cumCur = prefix[mi + 1];
            var taxM = round2(
                cumulativeTaxPayableFromCumulativeTaxable(cumCur) -
                cumulativeTaxPayableFromCumulativeTaxable(cumPrev)
            );
            if (taxM < 0) taxM = 0;
            taxMap[y + '-' + pad2(mo)] = taxM;
        }
    }
    return taxMap;
}

/** 单条记录：由表单字段推算当月应纳税所得额 */
function monthlyTaxableFromRecord(rec) {
    var income = parseFloat(rec.income) || parseFloat(rec.income_this_period) || 0;
    var taxFree = parseFloat(rec.tax_free_income) || 0;
    var deductFee = parseFloat(rec.deduction_fee);
    if (!isFinite(deductFee)) {
        deductFee = 5000;
    }
    var spec = parseFloat(rec.special_deduction) || 0;
    var other = parseFloat(rec.other_deduction) || 0;
    var donation = parseFloat(rec.donation_deduction) || 0;
    return round2(Math.max(0, income - taxFree - deductFee - spec - other - donation));
}

/** 已有各月应纳税所得额时，按累计预扣法算每月税额 */
function taxesMapFromMonthTaxableEntries(monthEntries) {
    var taxMap = {};
    var byYear = {};
    var i;
    for (i = 0; i < monthEntries.length; i++) {
        var e = monthEntries[i];
        if (!byYear[e.year]) {
            byYear[e.year] = [];
        }
        byYear[e.year].push({ month: e.month, taxable: e.taxable });
    }
    var years = Object.keys(byYear).map(function (x) {
        return parseInt(x, 10);
    });
    years.sort(function (a, b) {
        return a - b;
    });
    var yi;
    for (yi = 0; yi < years.length; yi++) {
        var y = years[yi];
        var arr = byYear[y].slice().sort(function (a, b) {
            return a.month - b.month;
        });
        var prefix = [0];
        var mi;
        for (mi = 0; mi < arr.length; mi++) {
            prefix[mi + 1] = round2(prefix[mi] + (parseFloat(arr[mi].taxable) || 0));
        }
        for (mi = 0; mi < arr.length; mi++) {
            var mo = arr[mi].month;
            var taxM = round2(
                cumulativeTaxPayableFromCumulativeTaxable(prefix[mi + 1]) -
                cumulativeTaxPayableFromCumulativeTaxable(prefix[mi])
            );
            if (taxM < 0) {
                taxM = 0;
            }
            taxMap[y + '-' + pad2(mo)] = taxM;
        }
    }
    return taxMap;
}

/** 是否与目标记录同年同单位（排除年终奖小类）。 */
function recordMatchesSingleTaxCohort(rec, record) {
    var year = parseInt(record.year, 10);
    if (parseInt(rec.year, 10) !== year) {
        return false;
    }
    if (String(rec.income_subtype || '').trim() === '全年一次性奖金收入') {
        return false;
    }
    if (isSeveranceCompensationSubtype(rec.income_subtype)) {
        return false;
    }
    var companyTaxId = String(record.company_tax_id || '').trim();
    var company = String(record.company_name || '').trim();
    if (companyTaxId && String(rec.company_tax_id || '').trim() === companyTaxId) {
        return true;
    }
    if (company && String(rec.company_name || '').trim() === company) {
        return true;
    }
    return !companyTaxId && !company;
}

/** 单条添加/更新：按同年同单位累计预扣重算当月已申报税额 */
function computeSingleRecordTaxReported(record, allRecords) {
    if (String(record.income_subtype || '').trim() === '全年一次性奖金收入') {
        return String(yearEndBonusTaxSeparate(parseFloat(record.income) || 0));
    }
    if (isSeveranceCompensationSubtype(record.income_subtype)) {
        return String(severanceCompensationTaxSeparate(parseFloat(record.income) || 0));
    }
    var year = parseInt(record.year, 10);
    var month = parseInt(record.month, 10);
    if (!year || !month) {
        return String(record.tax_reported != null ? record.tax_reported : '0.00');
    }
    var rid = String(record.id || '');
    var merged = (allRecords || []).filter(function (r) {
        return recordMatchesSingleTaxCohort(r, record) && String(r.id) !== rid;
    });
    merged.push(record);
    var monthEntries = merged
        .filter(function (r) {
            var m = parseInt(r.month, 10);
            return m >= 1 && m <= month;
        })
        .map(function (r) {
            return {
                year: year,
                month: parseInt(r.month, 10),
                taxable: monthlyTaxableFromRecord(r)
            };
        })
        .sort(function (a, b) {
            return a.month - b.month;
        });
    var taxMap = taxesMapFromMonthTaxableEntries(monthEntries);
    var taxM = taxMap[year + '-' + pad2(month)];
    return String(round2(taxM != null ? taxM : 0));
}


/** 含端点的随机整数。 */
function randomIntInclusive(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


// === 任职受雇列表 CRUD ===
/**
 * 拉任职受雇列表（缓存 + in-flight 去重）。
 * 副作用：写 __consultEmployersCache。
 */
function apiFetchEmployers(opts) {
    opts = opts || {};
    if (!opts.force && window.__consultEmployersCache && !window.__consultEmployersInFlight) {
        return Promise.resolve(window.__consultEmployersCache);
    }
    if (window.__consultEmployersInFlight) {
        return window.__consultEmployersInFlight;
    }
    window.__consultEmployersInFlight = window.authFetch('api/user?action=employers')
        .then(function (r) { return (window.authParseJson||function(r){return r.json();})(r); })
        .then(function (data) {
            if (data.code === 200 && data.data && data.data.employers) {
                return data.data.employers;
            }
            return [];
        })
        .catch(function () {
            return [];
        })
        .then(function (list) {
            window.__consultEmployersInFlight = null;
            window.__consultEmployersCache = list;
            return list;
        });
    return window.__consultEmployersInFlight;
}

var employerEditId = null;

/** 重置任职表单为添加模式。副作用：reset DOM。 */
function resetEmployerFormMode() {
    employerEditId = null;
    var form = document.getElementById('employerForm');
    if (form) {
        form.reset();
    }
    var titleEl = document.getElementById('employerFormCardTitle');
    if (titleEl) {
        titleEl.textContent = '添加任职受雇';
    }
    var submitBtn = document.getElementById('employerFormSubmitBtn');
    if (submitBtn) {
        submitBtn.textContent = '添加任职受雇';
    }
    var cancelBtn = document.getElementById('employerFormCancelEditBtn');
    if (cancelBtn) {
        cancelBtn.style.display = 'none';
    }
    applyConsultTestRestrictions(window.consultUserFlags || {});
}

/** 展开/折叠任职或消息表单卡。 */
function setConsultFormCardExpanded(cardId, expanded) {
    var card = document.getElementById(cardId);
    if (!card) return;
    var hintId =
        cardId === 'employerFormCard' ? 'employerFormToggleHint' : 'messageFormToggleHint';
    var toggleId =
        cardId === 'employerFormCard' ? 'employerFormToggle' : 'messageFormToggle';
    var hint = document.getElementById(hintId);
    var toggle = document.getElementById(toggleId);
    if (expanded) {
        card.classList.remove('is-collapsed');
        if (hint) hint.textContent = '收起';
        if (toggle) toggle.setAttribute('aria-expanded', 'true');
    } else {
        card.classList.add('is-collapsed');
        if (hint) hint.textContent = '收起';
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
}

/** URL open/onboarding=employer 时展开任职表单并清参数。 */
function tryOpenEmployerFormFromUrl() {
    var open = getUrlParam('open');
    var onboarding = getUrlParam('onboarding');
    if (open !== 'employer' && onboarding !== 'employer') return;
    if (!document.getElementById('employerFormCard')) return;
    function cleanOpenParam() {
        try {
            if (!history.replaceState) return;
            var u = new URL(window.location.href);
            if (u.searchParams.get('open') === 'employer') u.searchParams.delete('open');
            if (u.searchParams.get('onboarding') === 'employer') u.searchParams.delete('onboarding');
            history.replaceState({}, '', u);
        } catch (e0) {}
    }
    setTimeout(function () {
        scrollToEmployerForm();
        cleanOpenParam();
    }, 80);
}

/** 展开并滚动到任职表单卡。 */
function scrollToEmployerForm() {
    setConsultFormCardExpanded('employerFormCard', true);
    var el = document.getElementById('employerFormCard');
    if (!el) {
        return;
    }
    try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e0) {
        el.scrollIntoView(true);
    }
}

/** 展开并滚动到消息表单卡。 */
function scrollToMessageForm() {
    setConsultFormCardExpanded('messageFormCard', true);
    var el = document.getElementById('messageFormCard');
    if (!el) return;
    try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e1) {
        el.scrollIntoView(true);
    }
}

/** 绑定任职/消息卡片折叠与「打开」按钮。 */
function bindConsultCompactFormToggles() {
    function bind(toggleId, cardId, openBtnId) {
        var toggle = document.getElementById(toggleId);
        var openBtn = document.getElementById(openBtnId);
        if (toggle && !toggle.__consultToggleBound) {
            toggle.__consultToggleBound = true;
            toggle.addEventListener('click', function () {
                var card = document.getElementById(cardId);
                var open = !(card && card.classList.contains('is-collapsed'));
                setConsultFormCardExpanded(cardId, !open);
            });
        }
        if (openBtn && !openBtn.__consultOpenBound) {
            openBtn.__consultOpenBound = true;
            openBtn.addEventListener('click', function () {
                if (cardId === 'employerFormCard') {
                    scrollToEmployerForm();
                } else {
                    scrollToMessageForm();
                }
            });
        }
    }
    bind('employerFormToggle', 'employerFormCard', 'employerOpenFormBtn');
    bind('messageFormToggle', 'messageFormCard', 'messageOpenFormBtn');
}

/** 用任职项填充表单字段。 */
function fillEmployerForm(item) {
    if (!item) {
        return;
    }
    document.getElementById('ef_company_name').value = item.company_name || '';
    document.getElementById('ef_credit_code').value = item.credit_code || '';
    document.getElementById('ef_position').value = item.position || '';
    document.getElementById('ef_hire_date').value = item.hire_date || '';
    document.getElementById('ef_leave_date').value = item.leave_date || '';
    var st = item.status;
    document.getElementById('ef_status').value =
        st === '0' || st === 0 || st === '离职' ? '0' : '1';
    applyConsultTestRestrictions(window.consultUserFlags || {});
}

/**
 * 提交添加/更新任职受雇。
 * 副作用：api/user、公司档案、刷新列表、转化引导。
 */
function onSubmitEmployer(e) {
    e.preventDefault();
    var data = {
        action: employerEditId ? 'update_employer' : 'add_employer',
        user_id: currentUserId(),
        company_name: document.getElementById('ef_company_name').value,
        credit_code: document.getElementById('ef_credit_code').value,
        position: document.getElementById('ef_position').value,
        hire_date: document.getElementById('ef_hire_date').value,
        leave_date: document.getElementById('ef_leave_date').value,
        status: document.getElementById('ef_status').value
    };
    if (employerEditId) {
        data.employer_id = employerEditId;
    }
    window.authFetch('api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data)
    })
        .then(function (r) { return (window.authParseJson||function(r){return r.json();})(r); })
        .then(function (res) {
            if (res.code === 200) {
                var wasEdit = !!employerEditId;
                rememberBatchCompanyProfile({
                    name: String(data.company_name || '').trim(),
                    company_tax_id: String(data.credit_code || '').trim(),
                    tax_authority: ''
                });
                resetEmployerFormMode();
                setConsultFormCardExpanded('employerFormCard', false);
                showMsg(wasEdit ? '已保存修改' : '添加成功', true);
                if (
                    !wasEdit &&
                    window.ConversionGuide &&
                    typeof window.ConversionGuide.afterEmployerSaved === 'function'
                ) {
                    window.ConversionGuide.afterEmployerSaved({
                        company: String(data.company_name || '').trim()
                    });
                }
                return refreshEmployerList({ force: true });
            }
            throw new Error(res.msg || (employerEditId ? '保存失败' : '添加失败'));
        })
        .catch(function (err) {
            showMsg((employerEditId ? '保存失败：' : '添加失败：') + (err.message || ''), false);
        });
}

/**
 * 任职记录数写入本地，并清掉「我的」汇总缓存（含已离职，避免加了单位仍显示「暂无」）。
 * 副作用：localStorage / sessionStorage。
 */
function syncLocalEmployerCountFromList(list) {
    var n = 0;
    (list || []).forEach(function (e) {
        if (!e) return;
        n += 1;
    });
    try {
        localStorage.setItem('employer_count', String(n));
    } catch (e0) {}
    try {
        sessionStorage.removeItem('mine_summary_cache_v2');
    } catch (e1) {}
    return n;
}

/** 刷新任职列表并同步本地计数与公司档案。 */
function refreshEmployerList(opts) {
    return apiFetchEmployers(opts || {}).then(function (list) {
        syncLocalEmployerCountFromList(list);
        syncCompanyProfilesFromEmployers(list);
        refreshBatchCompanyHistoryDatalist();
        document.querySelectorAll('#batch_employment_list .batch-emp-company').forEach(
            tryApplyBatchCompanyProfileFromInput
        );
        renderEmployerListFromArray(list);
    });
}

/** 转义单引号等，供 onclick 属性使用。 */
function escAttr(s) {
    return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** 渲染任职卡片列表。副作用：写 #employerListMount。 */
function renderEmployerListFromArray(list) {
    var mount = document.getElementById('employerListMount');
    if (!mount) return;
    if (!list.length) {
        mount.innerHTML = '<div class="empty">暂无任职受雇信息<br><span style="font-size:12px;">点击右上角「添加」开始填写</span></div>';
        return;
    }
    var html = '';
    list.forEach(function(e) {
        var id = escAttr(e.id);
        var onJob = e.status == '1' || e.status === '在职';
        html += '<div class="record-card">';
        html += '<div class="record-card-header">';
        html += '<div class="record-card-title">' + escapeHtml(e.company_name || '') + '</div>';
        html +=
            '<span class="status-pill ' +
            (onJob ? 'is-on' : 'is-off') +
            '">' +
            (onJob ? '在职' : '离职') +
            '</span>';
        html += '</div>';
        html += '<div class="record-card-info">';
        if (e.credit_code) {
            html += '信用代码：' + escapeHtml(e.credit_code) + '<br>';
        }
        html += '职务：' + escapeHtml(e.position || '—') + '<br>';
        html +=
            '入职：' +
            escapeHtml(e.hire_date || '—') +
            ' · 离职：' +
            escapeHtml(e.leave_date || '在职');
        html += '</div>';
        html += '<div class="list-item-actions">';
        html += '<button type="button" class="btn btn-sm btn-primary" onclick="editEmployer(\'' + id + '\')">编辑</button>';
        html += '<button type="button" class="btn btn-sm btn-default" onclick="viewEmployerDetail(\'' + id + '\')">详情</button>';
        html += '<button type="button" class="btn btn-sm btn-secondary" onclick="copyEmployer(\'' + id + '\')">复制</button>';
        html += '<button type="button" class="btn btn-sm btn-danger" onclick="deleteEmployer(\'' + id + '\')">删除</button>';
        html += '</div></div>';
    });
    mount.innerHTML = html;
}

/** 进入编辑任职：填表、切页签、滚动。 */
function editEmployer(id) {
    apiFetchEmployers().then(function (list) {
        var item = list.find(function (x) {
            return String(x.id) === String(id);
        });
        if (!item) {
            showMsg('未找到该任职受雇记录', false);
            return;
        }
        employerEditId = String(item.id);
        fillEmployerForm(item);
        var titleEl = document.getElementById('employerFormCardTitle');
        if (titleEl) {
            titleEl.textContent = '编辑任职受雇';
        }
        var submitBtn = document.getElementById('employerFormSubmitBtn');
        if (submitBtn) {
            submitBtn.textContent = '保存修改';
        }
        var cancelBtn = document.getElementById('employerFormCancelEditBtn');
        if (cancelBtn) {
            cancelBtn.style.display = 'block';
        }
        switchTab('employers', true);
        setTimeout(scrollToEmployerForm, 0);
    });
}

/** 删除任职记录并刷新。副作用：API + localStorage 计数。 */
function deleteEmployer(id) {
    if (!confirm('确定要删除这条任职受雇记录吗？')) return;
    window.authFetch('api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'delete_employer',
            user_id: currentUserId(),
            employer_id: id
        })
    })
        .then(function (r) { return (window.authParseJson||function(r){return r.json();})(r); })
        .then(function (data) {
            if (data.code === 200) {
                if (data.data && data.data.employer_count != null) {
                    try {
                        localStorage.setItem(
                            'employer_count',
                            String(Number(data.data.employer_count) || 0)
                        );
                        sessionStorage.removeItem('mine_summary_cache_v2');
                    } catch (eDel) {}
                }
                showMsg('已删除', true);
                return refreshEmployerList({ force: true });
            }
            throw new Error(data.msg || '删除失败');
        })
        .catch(function (err) {
            showMsg('删除失败：' + (err.message || ''), false);
        });
}

/** 跳转任职详情页 renzhi_detail.html。 */
function viewEmployerDetail(id) {
    window.location.href = 'renzhi_detail.html?id=' + encodeURIComponent(String(id));
}

/** 复制任职为新记录。副作用：add_employer + 刷新。 */
function copyEmployer(id) {
    apiFetchEmployers().then(function (list) {
        var item = list.find(function (x) {
            return String(x.id) === String(id);
        });
        if (!item) {
            showMsg('未找到该任职受雇记录', false);
            return;
        }
        var data = {
            action: 'add_employer',
            user_id: currentUserId(),
            company_name: item.company_name || '',
            credit_code: item.credit_code || '',
            position: item.position || '',
            hire_date: item.hire_date || '',
            leave_date: item.leave_date || '',
            status: item.status === '0' || item.status === 0 || item.status === '离职' ? '0' : '1'
        };
        window.authFetch('api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(data)
        })
            .then(function (r) {
                return (window.authParseJson||function(r){return r.json();})(r);
            })
            .then(function (res) {
                if (res.code === 200) {
                    showMsg('已复制为新记录', true);
                    return refreshEmployerList({ force: true });
                }
                throw new Error(res.msg || '复制失败');
            })
            .catch(function (err) {
                showMsg('复制失败：' + (err.message || ''), false);
            });
    });
}

/** HTML 文本转义。 */
function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// === 消息列表 CRUD ===
/** 拉取消息列表。 */
function apiFetchMessages() {
    var uid = currentUserId();
    return window.authFetch('api/message?action=list')
        .then(function (r) { return (window.authParseJson||function(r){return r.json();})(r); })
        .then(function (data) {
            if (data.code === 200 && Array.isArray(data.data)) {
                return data.data;
            }
            return [];
        })
        .catch(function () { return []; });
}

/** 渲染消息卡片。副作用：写 #messageListMount。 */
function renderMessageListFromArray(list) {
    var mount = document.getElementById('messageListMount');
    if (!mount) return;
    if (!list.length) {
        mount.innerHTML = '<div class="empty">暂无消息<br><span style="font-size:12px;">点击上方「添加消息」填写</span></div>';
        return;
    }
    var html = '';
    list.forEach(function (m) {
        var line = (m.company_name || '').trim();
        if (!line) line = (m.content || '').trim() || '—';
        var datePart = (m.msg_date || '').trim();
        var desc = datePart ? (line + ' · ' + datePart) : line;
        var id = escAttr(m.id);
        html += '<div class="msg-card">';
        html += '<div class="msg-card-top">';
        html += '<div class="msg-card-title">' + escapeHtml(m.title || '') + '</div>';
        html += '<button type="button" class="btn btn-danger btn-sm" onclick="deleteMessage(\'' + id + '\')">删除</button>';
        html += '</div>';
        html += '<div class="msg-card-desc">' + escapeHtml(desc) + '</div>';
        html += '</div>';
    });
    mount.innerHTML = html;
}

/** 拉消息并渲染。 */
function refreshMessageList() {
    return apiFetchMessages().then(function (list) {
        renderMessageListFromArray(list);
    });
}

/** 添加消息。副作用：api/message、清部分字段、刷新。 */
function onSubmitMessage(e) {
    e.preventDefault();
    var payload = {
        action: 'add_message',
        user_id: currentUserId(),
        title: document.getElementById('mf_title').value.trim(),
        content: document.getElementById('mf_content').value.trim(),
        company_name: document.getElementById('mf_company_name').value.trim(),
        msg_date: document.getElementById('mf_msg_date').value
    };
    window.authFetch('api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(function (r) { return (window.authParseJson||function(r){return r.json();})(r); })
        .then(function (res) {
            if (res.code === 200) {
                document.getElementById('mf_content').value = '';
                document.getElementById('mf_company_name').value = '';
                setConsultFormCardExpanded('messageFormCard', false);
                showMsg('添加成功', true);
                return refreshMessageList();
            }
            throw new Error(res.msg || '添加失败');
        })
        .catch(function (err) {
            showMsg('添加失败：' + (err.message || ''), false);
        });
}

/** 删除消息并刷新列表。 */
function deleteMessage(id) {
    if (!confirm('确定删除？')) return;
    window.authFetch('api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'delete_message',
            user_id: currentUserId(),
            id: id
        })
    })
        .then(function (r) { return (window.authParseJson||function(r){return r.json();})(r); })
        .then(function (data) {
            if (data.code === 200) {
                showMsg('已删除', true);
                return refreshMessageList();
            }
            throw new Error(data.msg || '删除失败');
        })
        .catch(function (err) {
            showMsg('删除失败：' + (err.message || ''), false);
        });
}

/** 消息日期为空时填今天。 */
function setDefaultMsgDate() {
    var el = document.getElementById('mf_msg_date');
    if (!el || el.value) return;
    var d = new Date();
    el.value = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

// === 页面启动 boot ===
/**
 * consult 页启动：绑表单、init 各模块、首屏拉记录再任职。
 * 副作用：大量 DOM/API；结束时 dispatchConsultDone。
 */
function boot() {
    if (window.__refreshNavFromMineUi) {
        window.__refreshNavFromMineUi();
    }
    var employerCancel = document.getElementById('employerFormCancelEditBtn');
    if (employerCancel) {
        employerCancel.addEventListener('click', function () {
            resetEmployerFormMode();
            setConsultFormCardExpanded('employerFormCard', false);
        });
    }
    bindConsultCompactFormToggles();
    bindConsultNajiluQrEntryTrack();
    initHeader();
    initIncomeTypeSelect();
    initBatchEmploymentRows();
    initBatchTaxDraftAutosave();
    restoreSingleTaxDraftIfAny();
    initSingleTaxDraftAutosave();
    initBatchCompanyHistoryUi();
    initConsultRecordsUx();
    initTabs();
    tryOpenEmployerFormFromUrl();
    setDefaultMsgDate();
    /* 首屏只拉税务列表，再串行任职；安装包延后，避免 4G 连接排队把 records 拖到数秒 */
    refreshRecordList({ force: false })
        .then(function () {
            syncBatchTaxEmptyState();
            return refreshEmployerList();
        })
        .catch(function () {})
        .finally(function () {
            applyConsultBatchAbUi();
            syncBatchTaxEmptyState();
            if (typeof window.appPageLoadingDispatchConsultDone === 'function') {
                window.appPageLoadingDispatchConsultDone();
            }
        });
    tryEditFromUrl();
}

// === 激活弹窗 / 产品页激活码绑定 ===
(function bindConsultActivateModal() {
    var okBtn = document.getElementById('btnConsultActivateOk');
    var cancelBtn = document.getElementById('btnConsultActivateCancel');
    var mask = document.getElementById('consultActivateModalMask');
    var inp = document.getElementById('consultActivateCodeInput');
    if (okBtn) {
        okBtn.addEventListener('click', function () {
            if (typeof window.trackUserAction === 'function') {
                window.trackUserAction('track_activate_prompt_confirm', { page: 'consult' });
            }
            var code = inp ? inp.value : '';
            submitConsultActivateWithCode(code);
        });
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
            if (typeof window.trackUserAction === 'function') {
                window.trackUserAction('track_activate_prompt_cancel', { page: 'consult' });
            }
            closeConsultActivateModal();
        });
    }
    if (mask) {
        mask.addEventListener('click', function () {
            if (typeof window.trackUserAction === 'function') {
                window.trackUserAction('track_activate_prompt_cancel', { page: 'consult', via: 'mask' });
            }
            closeConsultActivateModal();
        });
    }
    if (inp) {
        inp.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                submitConsultActivateWithCode(inp.value);
            }
        });
    }
})();

(function bindConsultProductsPayCards() {
    var actBtn = document.getElementById('btnConsultProductsActivate');
    var actInp = document.getElementById('consultProductsActivateCode');
    if (actBtn) {
        actBtn.addEventListener('click', function () {
            if (typeof window.trackUserAction === 'function') {
                window.trackUserAction('track_activate_prompt_confirm', {
                    page: 'consult',
                    source: 'products'
                });
            }
            submitConsultActivateWithCode(actInp ? actInp.value : '');
        });
    }
    if (actInp) {
        actInp.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                submitConsultActivateWithCode(actInp.value);
            }
        });
    }
})();

// === 附加产品：社保照片上传 ===
/** 附加产品：社保截图上传（consult 页原先只有 UI，未接线导致安卓点「选择照片」无反应） */
(function bindConsultShebaoPhotoUpload() {
    function consultShebaoToken() {
        try {
            if (typeof window.authGetToken === 'function') {
                var t = window.authGetToken();
                if (t) return String(t).trim();
            }
        } catch (e0) {}
        try {
            return String(localStorage.getItem('token') || '').trim();
        } catch (e1) {
            return '';
        }
    }

    function setShebaoStatus(text, show) {
        var el = document.getElementById('shebaoUploadStatus');
        if (!el) return;
        if (show === false || !text) {
            el.hidden = true;
            el.textContent = '';
            return;
        }
        el.hidden = false;
        el.textContent = text;
    }

    var shebaoPreviewObjectUrls = [];

    function clearShebaoPreviewObjectUrls() {
        shebaoPreviewObjectUrls.forEach(function (url) {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {}
        });
        shebaoPreviewObjectUrls = [];
    }

    function renderShebaoPreview(items) {
        var grid = document.getElementById('shebaoPreviewGrid');
        if (!grid) return;
        clearShebaoPreviewObjectUrls();
        grid.innerHTML = '';
        (items || []).forEach(function (it) {
            var url = it && it.url ? String(it.url) : '';
            if (!url) return;
            var cell = document.createElement('div');
            cell.className = 'shebao-preview-item';
            var img = document.createElement('img');
            img.alt = '社保照片';
            img.loading = 'lazy';
            cell.appendChild(img);
            grid.appendChild(cell);
            var fetchFn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
            fetchFn(url, { method: 'GET', cache: 'no-store', credentials: 'same-origin' })
                .then(function (r) {
                    if (!r.ok) throw new Error('image_load_failed');
                    return r.blob();
                })
                .then(function (blob) {
                    var objectUrl = URL.createObjectURL(blob);
                    shebaoPreviewObjectUrls.push(objectUrl);
                    img.src = objectUrl;
                })
                .catch(function () {
                    cell.remove();
                });
        });
    }

    function loadConsultShebaoPhotos() {
        var card = document.getElementById('cardShebaoPhoto');
        if (!card || card.hidden || !document.getElementById('shebaoPhotoInput')) {
            return Promise.resolve();
        }
        if (!consultShebaoToken()) {
            setShebaoStatus('登录后可上传社保照片', true);
            return Promise.resolve();
        }
        var fetchFn = typeof window.authFetch === 'function' ? window.authFetch : fetch;
        return fetchFn('/api/user/shebao-photo', { method: 'GET', credentials: 'same-origin' })
            .then(function (r) {
                return (window.authParseJson||function(r){return r.json();})(r).then(function (j) {
                    return { status: r.status, body: j };
                });
            })
            .then(function (x) {
                if (x.status === 200 && x.body && x.body.code === 200 && x.body.data) {
                    var items = x.body.data.items || [];
                    renderShebaoPreview(items);
                    setShebaoStatus(items.length ? '已上传 ' + items.length + ' 张' : '', !!items.length);
                    return;
                }
                if (x.status === 401) {
                    setShebaoStatus('登录后可上传社保照片', true);
                }
            })
            .catch(function () {});
    }

    window.loadConsultShebaoPhotos = loadConsultShebaoPhotos;

    function uploadShebaoFile(file) {
        var token = consultShebaoToken();
        if (!token) {
            showMsg('请先登录后再上传', false);
            setTimeout(function () {
                window.location.href = 'login.html';
            }, 900);
            return Promise.reject(new Error('no_token'));
        }
        var fd = new FormData();
        fd.append('file', file);
        /* 勿用 authFetch：会带 application/json，破坏 multipart */
        return fetch('/api/user/shebao-photo', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + token },
            body: fd,
            credentials: 'same-origin'
        }).then(function (r) {
            return (window.authParseJson||function(r){return r.json();})(r).then(function (j) {
                return { status: r.status, body: j };
            });
        });
    }

    function onShebaoFilesSelected(fileList) {
        var files = Array.prototype.slice.call(fileList || [], 0).filter(function (f) {
            return f && (/^image\//i.test(f.type || '') || /\.(jpe?g|png|gif|webp)$/i.test(f.name || ''));
        });
        if (!files.length) {
            showMsg('请选择图片文件', false);
            return;
        }
        var btn = document.getElementById('btnShebaoPick');
        if (btn) btn.classList.add('is-disabled');
        setShebaoStatus('正在上传…', true);
        var chain = Promise.resolve();
        var ok = 0;
        var failMsg = '';
        files.forEach(function (file) {
            chain = chain.then(function () {
                return uploadShebaoFile(file).then(function (x) {
                    if (x.status === 200 && x.body && x.body.code === 200) {
                        ok += 1;
                        return;
                    }
                    failMsg = (x.body && x.body.msg) || '上传失败';
                    if (x.status === 401) {
                        failMsg = '登录状态已失效，请重新登录';
                    }
                });
            });
        });
        chain
            .then(function () {
                if (ok > 0) {
                    showMsg(ok === files.length ? '上传成功' : '已上传 ' + ok + ' 张', true);
                    if (typeof window.trackUserAction === 'function') {
                        window.trackUserAction('track_shebao_photo_upload', {
                            page: 'consult',
                            count: ok
                        });
                    }
                } else {
                    showMsg(failMsg || '上传失败', false);
                }
                return loadConsultShebaoPhotos();
            })
            .catch(function () {
                showMsg('上传失败，请稍后重试', false);
            })
            .then(function () {
                if (btn) btn.classList.remove('is-disabled');
                var input = document.getElementById('shebaoPhotoInput');
                if (input) input.value = '';
            });
    }

    var shebaoCard = document.getElementById('cardShebaoPhoto');
    var shebaoPickBtn = document.getElementById('btnShebaoPick');
    var shebaoInput = document.getElementById('shebaoPhotoInput');
    if (!shebaoCard || shebaoCard.hidden || !shebaoPickBtn || !shebaoInput) return;

    try {
        shebaoInput.removeAttribute('capture');
    } catch (eCap) {}

    shebaoPickBtn.addEventListener('click', function (ev) {
        if (!consultShebaoToken()) {
            ev.preventDefault();
            showMsg('请先登录后再上传', false);
            setTimeout(function () {
                window.location.href = 'login.html';
            }, 900);
            return;
        }
        if (shebaoPickBtn.classList.contains('is-disabled')) {
            ev.preventDefault();
            return;
        }
        if (typeof window.trackUserAction === 'function') {
            window.trackUserAction('track_shebao_photo_pick_click', { page: 'consult' });
        }
        if (shebaoPickBtn.tagName !== 'LABEL') {
            if (typeof shebaoInput.showPicker === 'function') {
                try {
                    shebaoInput.showPicker();
                    return;
                } catch (eSp) {}
            }
            shebaoInput.click();
        }
    });
    shebaoInput.addEventListener('change', function () {
        onShebaoFilesSelected(shebaoInput.files);
    });
})();

// === iOS 底栏适配 ===
(function() {
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
        var n = document.querySelector('.bottom-nav');
        if (n) n.classList.add('ios-device');
    }
})();
