(function () {
    var Store = window.ShenbaoJiluStore;

    var MONEY_SUFFIX_FIELDS = [
        'supplementTax',
        'lateFee',
        'paidThisTime',
        'refundedThisTime',
        'totalIncome',
        'totalExpense',
        'exemptIncome',
        'basicDeduction',
        'specialDeduction',
        'specialAdditionalDeduction',
        'otherDeduction',
        'donationDeduction',
        'taxableIncome',
        'taxPayable',
        'taxReduction',
        'taxPaid',
        'amount'
    ];

    var TEXT_FIELDS = [
        'title',
        'groupMonth',
        'periodStart',
        'periodEnd',
        'taxYear',
        'taxAuthority',
        'employer',
        'amountType'
    ];

    var state = {
        tab: 'done',
        id: '',
        record: null,
        snapshot: null,
        isNew: false
    };

    function stripYuan(s) {
        return String(s == null ? '' : s)
            .replace(/元/g, '')
            .trim();
    }

    function formatDisplay(key, val) {
        if (val == null || val === '') {
            return '—';
        }
        if (MONEY_SUFFIX_FIELDS.indexOf(key) !== -1) {
            var n = stripYuan(val);
            return n ? n + '元' : '—';
        }
        if (key === 'amountType') {
            return Store.AMOUNT_TYPES[val] || val;
        }
        return String(val);
    }

    function readInput(key) {
        var el = document.querySelector('[data-input="' + key + '"]');
        if (!el) {
            return '';
        }
        if (key === 'amountType') {
            return el.value;
        }
        return stripYuan(el.value);
    }

    function writeInput(key, val) {
        var el = document.querySelector('[data-input="' + key + '"]');
        if (!el) {
            return;
        }
        if (key === 'amountType') {
            el.value = val || 'refunded';
            return;
        }
        el.value = stripYuan(val);
    }

    function fillView(rec) {
        document.querySelectorAll('[data-field]').forEach(function (row) {
            var key = row.getAttribute('data-field');
            var valEl = row.querySelector('.info-value');
            if (!valEl) {
                return;
            }
            var val = rec[key];
            if (key === 'taxYear' && !val) {
                val = rec.periodEnd ? String(rec.periodEnd).slice(0, 4) : '';
            }
            valEl.textContent = formatDisplay(key, val);
            if (row.getAttribute('data-chev') === '1') {
                valEl.classList.add('with-chev');
            }
            if (row.getAttribute('data-expand') === '1') {
                valEl.classList.add('with-expand');
            }
            writeInput(key, rec[key]);
        });
    }

    function syncListAmountFields(rec) {
        var supplement = stripYuan(rec.supplementTax);
        rec.amountType = 'refunded';
        rec.amount = supplement !== '' ? supplement : '0.00';
        if (!rec.groupMonth && rec.periodEnd && /^\d{4}-\d{2}/.test(rec.periodEnd)) {
            rec.groupMonth = rec.periodEnd.slice(0, 7);
        }
        if (!rec.title && rec.taxYear) {
            rec.title = rec.taxYear + '年度综合所得年度汇算';
        }
        return rec;
    }

    function collectForm() {
        var rec = Object.assign({}, state.record);
        MONEY_SUFFIX_FIELDS.forEach(function (key) {
            rec[key] = readInput(key);
        });
        TEXT_FIELDS.forEach(function (key) {
            rec[key] = readInput(key);
        });
        if (!rec.taxYear && rec.periodEnd) {
            rec.taxYear = String(rec.periodEnd).slice(0, 4);
        }
        rec.refundRecords = ensureRefundRecords();
        return syncListAmountFields(rec);
    }

    function setDesignView(on) {
        document.body.classList.toggle('detail-design-mode', on);
        var design = document.getElementById('detailDesignView');
        if (design) {
            design.setAttribute('aria-hidden', on ? 'false' : 'true');
        }
    }

    function shouldShowDesign() {
        return false;
    }

    function updateDisplayMode() {
        setDesignView(shouldShowDesign());
    }

    function listBackUrl() {
        return 'shenbao_jilu.html?tab=' + encodeURIComponent(state.tab);
    }

    function reloadRecord() {
        if (state.isNew) {
            state.record = Store.createNewRecordTemplate(state.tab);
            return Promise.resolve(state.record);
        }
        return Store.loadRecordForDetail(state.tab, state.id).then(function (rec) {
            state.record = rec;
            return rec;
        });
    }

    function setEditing(on) {
        document.body.classList.toggle('is-editing', on);
        if (on) {
            setDesignView(false);
        } else {
            updateDisplayMode();
        }
    }

    function enterEdit() {
        reloadRecord().then(function (rec) {
            if (!rec) {
                return;
            }
            state.snapshot = JSON.parse(JSON.stringify(state.record));
            fillView(state.record);
            setEditing(true);
            window.scrollTo(0, 0);
        });
    }

    function cancelEdit() {
        if (state.isNew) {
            window.location.href = listBackUrl();
            return;
        }
        state.record = state.snapshot ? JSON.parse(JSON.stringify(state.snapshot)) : state.record;
        fillView(state.record);
        setEditing(false);
        state.snapshot = null;
        window.scrollTo(0, 0);
    }

    function saveEdit() {
        var btn = document.getElementById('btnSaveEdit');
        if (btn) {
            btn.disabled = true;
        }
        var updated = collectForm();
        if (!String(updated.title || '').trim()) {
            alert('请填写申报事项');
            if (btn) {
                btn.disabled = false;
            }
            return;
        }
        if (state.isNew) {
            updated.id = Store.generateNewRecordId();
        } else {
            updated.id = state.id;
        }
        Store.saveRecord(state.tab, updated)
            .then(function (saved) {
                if (state.isNew) {
                    window.location.href = listBackUrl();
                    return;
                }
                state.record = saved || updated;
                state.record.detailCustomized = true;
                fillView(state.record);
                setEditing(false);
                state.snapshot = null;
                updateDisplayMode();
                window.scrollTo(0, 0);
            })
            .catch(function (e) {
                alert((e && e.message) || '保存失败');
            })
            .finally(function () {
                if (btn) {
                    btn.disabled = false;
                }
            });
    }

    var refundEditCtx = null;
    var activeDetailPanel = 'declare';
    var refundLongPressTimer = null;
    var refundLongPressTriggered = false;

    function escHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatRefundAmount(val) {
        var s = String(val == null ? '' : val)
            .replace(/元/g, '')
            .trim();
        if (!s) {
            return '0.00元';
        }
        var n = parseFloat(s);
        if (!isNaN(n)) {
            return n.toFixed(2) + '元';
        }
        return s + '元';
    }

    function ensureRefundRecords() {
        if (!state.record) {
            return [];
        }
        state.record.refundRecords = Store.normalizeRefundRecords(state.record.refundRecords);
        return state.record.refundRecords;
    }

    function persistRefundRecords() {
        if (!state.record || state.isNew) {
            return Promise.resolve();
        }
        var payload = Object.assign({}, state.record, {
            refundRecords: ensureRefundRecords(),
            detailCustomized: true
        });
        return Store.saveRecord(state.tab, payload).then(function (saved) {
            state.record = saved || payload;
            ensureRefundRecords();
        });
    }

    function findRefundById(id) {
        var list = ensureRefundRecords();
        for (var i = 0; i < list.length; i++) {
            if (String(list[i].id) === String(id)) {
                return list[i];
            }
        }
        return null;
    }

    function renderRefundPanel() {
        var root = document.getElementById('refundListRoot');
        if (!root) {
            return;
        }
        var list = ensureRefundRecords();
        if (!list.length) {
            root.innerHTML = '<div class="refund-empty">暂无退税记录</div>';
            return;
        }
        var html = '';
        list.forEach(function (item) {
            var expanded = !!item.expanded;
            html += '<article class="refund-card' + (expanded ? ' is-expanded' : '') + '" data-refund-id="' + escHtml(item.id) + '">';
            html += '<div class="refund-card-head">退税信息</div>';
            html +=
                '<div class="refund-row"><span class="refund-label">退税金额：</span><span class="refund-value" data-edit="amount" data-refund-id="' +
                escHtml(item.id) +
                '">' +
                escHtml(formatRefundAmount(item.amount)) +
                '</span></div>';
            html +=
                '<div class="refund-row"><span class="refund-label">申请时间：</span><span class="refund-value" data-edit="applyTime" data-refund-id="' +
                escHtml(item.id) +
                '">' +
                escHtml(item.applyTime || '—') +
                '</span></div>';
            html +=
                '<div class="refund-row refund-row-status"><span class="refund-label">当前状态：</span><span class="refund-value">';
            html +=
                '<span class="refund-status-wrap" data-toggle-expand="' +
                escHtml(item.id) +
                '" role="button" aria-expanded="' +
                (expanded ? 'true' : 'false') +
                '" aria-label="展开或收起退税进度">';
            html += '<span class="refund-status-icon" aria-hidden="true">✓</span>';
            html += '<span class="refund-status-text">' + escHtml(item.statusLabel || '—') + '</span>';
            html += '<span class="refund-chev' + (expanded ? ' expanded' : '') + '" aria-hidden="true"></span>';
            html += '</span></span></div>';
            html += '<div class="refund-timeline-wrap"><div class="refund-timeline">';
            (item.steps || []).forEach(function (step, si) {
                html += '<div class="refund-step" data-step-index="' + si + '">';
                html += '<span class="refund-step-dot" aria-hidden="true">✓</span>';
                html +=
                    '<div class="refund-step-title" data-edit="stepTitle" data-refund-id="' +
                    escHtml(item.id) +
                    '" data-step-index="' +
                    si +
                    '">' +
                    escHtml(step.title || '—') +
                    '</div>';
                html +=
                    '<div class="refund-step-date" data-edit="stepDate" data-refund-id="' +
                    escHtml(item.id) +
                    '" data-step-index="' +
                    si +
                    '">' +
                    escHtml(step.date || '—') +
                    '</div>';
                if (step.hint) {
                    html +=
                        '<div class="refund-step-hint" data-edit="stepHint" data-refund-id="' +
                        escHtml(item.id) +
                        '" data-step-index="' +
                        si +
                        '">' +
                        escHtml(step.hint) +
                        '</div>';
                }
                html += '</div>';
            });
            html +=
                '<p class="refund-card-foot-hint">税务机关仅通过本系统向您推送相关信息，您可在「申报记录」中查询退税进度</p>';
            html += '</div></div></article>';
        });
        root.innerHTML = html;
    }

    function addRefundRecord() {
        var list = ensureRefundRecords();
        list.unshift(Store.createRefundRecord({ expanded: true }));
        renderRefundPanel();
        persistRefundRecords().catch(function (e) {
            alert((e && e.message) || '保存失败');
        });
    }

    function deleteRefundRecord(refundId) {
        if (!confirm('确定删除这条退税记录？')) {
            return;
        }
        var list = ensureRefundRecords();
        state.record.refundRecords = list.filter(function (r) {
            return String(r.id) !== String(refundId);
        });
        renderRefundPanel();
        persistRefundRecords().catch(function (e) {
            alert((e && e.message) || '保存失败');
        });
    }

    function clearRefundLongPress() {
        if (refundLongPressTimer) {
            clearTimeout(refundLongPressTimer);
            refundLongPressTimer = null;
        }
        document.querySelectorAll('.refund-card.is-longpress').forEach(function (el) {
            el.classList.remove('is-longpress');
        });
    }

    function startRefundLongPress(cardEl, refundId) {
        clearRefundLongPress();
        refundLongPressTriggered = false;
        if (cardEl) {
            cardEl.classList.add('is-longpress');
        }
        refundLongPressTimer = setTimeout(function () {
            refundLongPressTriggered = true;
            clearRefundLongPress();
            deleteRefundRecord(refundId);
        }, 550);
    }

    function updateHeaderTitleForTab(panelName) {
        activeDetailPanel = panelName || 'declare';
        var btn = document.getElementById('detailHeaderTitleBtn');
        if (!btn) {
            return;
        }
        if (activeDetailPanel === 'refund') {
            btn.classList.add('header-title--add');
            btn.setAttribute('aria-label', '申报记录详情，点击添加退税记录');
        } else {
            btn.classList.remove('header-title--add');
            btn.setAttribute('aria-label', '申报记录详情');
        }
    }

    function bindHeaderTitleAdd() {
        var btn = document.getElementById('detailHeaderTitleBtn');
        if (!btn || btn.getAttribute('data-bound') === '1') {
            return;
        }
        btn.setAttribute('data-bound', '1');
        btn.addEventListener('click', function () {
            if (activeDetailPanel === 'refund' && !document.body.classList.contains('is-editing')) {
                addRefundRecord();
            }
        });
    }

    function toDatetimeLocalValue(s) {
        var t = String(s || '').trim();
        if (!t) {
            return '';
        }
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(t)) {
            return t.slice(0, 16).replace(' ', 'T');
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
            return t + 'T00:00';
        }
        return t;
    }

    function fromDatetimeLocalValue(s) {
        var t = String(s || '').trim();
        if (!t) {
            return '';
        }
        if (t.indexOf('T') >= 0) {
            return t.replace('T', ' ').slice(0, 16);
        }
        return t;
    }

    function closeRefundEditSheet() {
        var mask = document.getElementById('refundEditMask');
        if (mask) {
            mask.classList.remove('show');
            mask.setAttribute('aria-hidden', 'true');
        }
        refundEditCtx = null;
        var body = document.getElementById('refundEditBody');
        if (body) {
            body.innerHTML = '';
        }
    }

    function openRefundEditSheet(ctx) {
        refundEditCtx = ctx;
        var mask = document.getElementById('refundEditMask');
        var titleEl = document.getElementById('refundEditTitle');
        var body = document.getElementById('refundEditBody');
        if (!mask || !body || !titleEl) {
            return;
        }
        titleEl.textContent = ctx.title || '编辑';
        var html = '<label for="refundEditField">' + escHtml(ctx.label || '') + '</label>';
        if (ctx.type === 'status') {
            html += '<select id="refundEditField">';
            Store.REFUND_STATUS_OPTIONS.forEach(function (opt) {
                html +=
                    '<option value="' +
                    escHtml(opt.value) +
                    '"' +
                    (ctx.value === opt.value ? ' selected' : '') +
                    '>' +
                    escHtml(opt.label) +
                    '</option>';
            });
            html += '</select>';
        } else if (ctx.type === 'datetime') {
            html +=
                '<input type="datetime-local" id="refundEditField" value="' +
                escHtml(toDatetimeLocalValue(ctx.value)) +
                '">';
        } else if (ctx.type === 'date') {
            html +=
                '<input type="date" id="refundEditField" value="' +
                escHtml(String(ctx.value || '').slice(0, 10)) +
                '">';
        } else if (ctx.type === 'textarea') {
            html +=
                '<textarea id="refundEditField" rows="3">' +
                escHtml(ctx.value || '') +
                '</textarea>';
        } else {
            html +=
                '<input type="text" id="refundEditField" inputmode="' +
                escHtml(ctx.inputmode || 'text') +
                '" value="' +
                escHtml(ctx.value || '') +
                '">';
        }
        body.innerHTML = html;
        mask.classList.add('show');
        mask.setAttribute('aria-hidden', 'false');
        var field = document.getElementById('refundEditField');
        if (field) {
            field.focus();
        }
    }

    function applyRefundEditValue() {
        if (!refundEditCtx) {
            return;
        }
        var field = document.getElementById('refundEditField');
        if (!field) {
            return;
        }
        var item = findRefundById(refundEditCtx.refundId);
        if (!item) {
            return;
        }
        var raw = field.value;
        var kind = refundEditCtx.kind;
        if (kind === 'amount') {
            item.amount = String(raw).replace(/元/g, '').trim();
        } else if (kind === 'applyTime') {
            item.applyTime = fromDatetimeLocalValue(raw);
        } else if (kind === 'status') {
            item.status = raw;
            var opt = Store.REFUND_STATUS_OPTIONS.filter(function (o) {
                return o.value === raw;
            })[0];
            item.statusLabel = opt ? opt.label : raw;
            if (item.steps && item.steps.length >= 3) {
                item.steps[2].title = item.statusLabel;
            }
        } else if (kind === 'stepTitle') {
            item.steps[refundEditCtx.stepIndex].title = String(raw).trim();
        } else if (kind === 'stepDate') {
            item.steps[refundEditCtx.stepIndex].date = String(raw).trim();
        } else if (kind === 'stepHint') {
            item.steps[refundEditCtx.stepIndex].hint = String(raw).trim();
        }
    }

    function saveRefundEditSheet() {
        if (!refundEditCtx) {
            return;
        }
        applyRefundEditValue();
        closeRefundEditSheet();
        renderRefundPanel();
        persistRefundRecords().catch(function (e) {
            alert((e && e.message) || '保存失败');
        });
    }

    function bindRefundPanelEvents() {
        var root = document.getElementById('refundListRoot');
        if (!root || root.getAttribute('data-bound') === '1') {
            return;
        }
        root.setAttribute('data-bound', '1');
        root.addEventListener('click', function (ev) {
            if (refundLongPressTriggered) {
                refundLongPressTriggered = false;
                ev.preventDefault();
                return;
            }
            var toggle = ev.target.closest('[data-toggle-expand]');
            if (toggle) {
                var rid = toggle.getAttribute('data-toggle-expand');
                var item = findRefundById(rid);
                if (item) {
                    item.expanded = !item.expanded;
                    renderRefundPanel();
                    persistRefundRecords().catch(function () {});
                }
                ev.preventDefault();
                return;
            }
            var editEl = ev.target.closest('[data-edit]');
            if (!editEl) {
                return;
            }
            var kind = editEl.getAttribute('data-edit');
            var refundId = editEl.getAttribute('data-refund-id');
            var item = findRefundById(refundId);
            if (!item) {
                return;
            }
            var stepIndex = parseInt(editEl.getAttribute('data-step-index'), 10);
            if (kind === 'amount') {
                openRefundEditSheet({
                    kind: 'amount',
                    refundId: refundId,
                    title: '退税金额',
                    label: '金额（元）',
                    type: 'text',
                    inputmode: 'decimal',
                    value: item.amount
                });
            } else if (kind === 'applyTime') {
                openRefundEditSheet({
                    kind: 'applyTime',
                    refundId: refundId,
                    title: '申请时间',
                    label: '申请时间',
                    type: 'datetime',
                    value: item.applyTime
                });
            } else if (kind === 'status') {
                openRefundEditSheet({
                    kind: 'status',
                    refundId: refundId,
                    title: '当前状态',
                    label: '状态',
                    type: 'status',
                    value: item.status || 'treasury_done'
                });
            } else if (kind === 'stepTitle') {
                openRefundEditSheet({
                    kind: 'stepTitle',
                    refundId: refundId,
                    stepIndex: stepIndex,
                    title: '进度标题',
                    label: '标题',
                    type: 'text',
                    value: item.steps[stepIndex].title
                });
            } else if (kind === 'stepDate') {
                openRefundEditSheet({
                    kind: 'stepDate',
                    refundId: refundId,
                    stepIndex: stepIndex,
                    title: '进度日期',
                    label: '日期',
                    type: 'date',
                    value: item.steps[stepIndex].date
                });
            } else if (kind === 'stepHint') {
                openRefundEditSheet({
                    kind: 'stepHint',
                    refundId: refundId,
                    stepIndex: stepIndex,
                    title: '提示说明',
                    label: '说明（可留空）',
                    type: 'textarea',
                    value: item.steps[stepIndex].hint || ''
                });
            }
            ev.preventDefault();
        });

        function onRefundPressStart(ev) {
            var card = ev.target.closest('.refund-card');
            if (!card) {
                return;
            }
            var rid = card.getAttribute('data-refund-id');
            if (!rid) {
                return;
            }
            startRefundLongPress(card, rid);
        }

        root.addEventListener('touchstart', onRefundPressStart, { passive: true });
        root.addEventListener('mousedown', onRefundPressStart);
        root.addEventListener('touchend', clearRefundLongPress);
        root.addEventListener('touchcancel', clearRefundLongPress);
        root.addEventListener('touchmove', clearRefundLongPress);
        root.addEventListener('mouseup', clearRefundLongPress);
        root.addEventListener('mouseleave', clearRefundLongPress);
    }

    function bindRefundEditSheet() {
        var mask = document.getElementById('refundEditMask');
        var cancel = document.getElementById('refundEditCancel');
        var save = document.getElementById('refundEditSave');
        if (mask) {
            mask.addEventListener('click', closeRefundEditSheet);
        }
        if (cancel) {
            cancel.addEventListener('click', closeRefundEditSheet);
        }
        if (save) {
            save.addEventListener('click', saveRefundEditSheet);
        }
    }

    function updateFooterForTab(panelName) {
        var bar = document.querySelector('.footer-bar');
        if (!bar) {
            return;
        }
        bar.style.display = panelName === 'refund' || panelName === 'pay' ? 'none' : '';
    }

    function bindTabs() {
        var tabs = document.querySelectorAll('.detail-tab');
        var panels = {
            declare: document.getElementById('panelDeclare'),
            pay: document.getElementById('panelPay'),
            refund: document.getElementById('panelRefund')
        };
        tabs.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var name = btn.getAttribute('data-panel');
                tabs.forEach(function (t) {
                    var on = t === btn;
                    t.classList.toggle('active', on);
                    t.setAttribute('aria-selected', on ? 'true' : 'false');
                });
                Object.keys(panels).forEach(function (k) {
                    panels[k].classList.toggle('active', k === name);
                });
                updateFooterForTab(name);
                updateHeaderTitleForTab(name);
                if (name === 'refund') {
                    renderRefundPanel();
                }
            });
        });
    }

    function bindIncomeNavigate() {
        var row = document.querySelector('[data-field="totalIncome"]');
        if (!row || row.getAttribute('data-bound') === '1') {
            return;
        }
        row.setAttribute('data-bound', '1');
        row.addEventListener('click', function () {
            if (document.body.classList.contains('is-editing')) {
                return;
            }
            window.location.href =
                'shenbao_income_detail.html?tab=' +
                encodeURIComponent(state.tab) +
                '&id=' +
                encodeURIComponent(state.id) +
                '&category=salary';
        });
    }

    function bindFooterActions() {
        document.getElementById('btnCorrect').addEventListener('click', enterEdit);
        document.getElementById('btnCancelEdit').addEventListener('click', cancelEdit);
        document.getElementById('btnSaveEdit').addEventListener('click', saveEdit);
    }

    function startCreateFlow() {
        state.isNew = true;
        state.record = Store.createNewRecordTemplate(state.tab);
        document.body.classList.remove('detail-design-mode');
        setDesignView(false);

        var stamp = document.querySelector('.stamp-done');
        if (stamp) {
            stamp.style.display = 'none';
        }

        ensureRefundRecords();
        fillView(state.record);
        bindTabs();
        bindRefundPanelEvents();
        bindRefundEditSheet();
        bindHeaderTitleAdd();
        bindIncomeNavigate();
        bindFooterActions();
        updateHeaderTitleForTab('declare');
        setEditing(true);
        window.scrollTo(0, 0);
    }

    function init() {
        try {
            var params = new URLSearchParams(window.location.search);
            state.id = params.get('id') || '';
            state.tab = params.get('tab') || 'done';
        } catch (e) {
            state.id = '';
            state.tab = 'done';
        }

        if (state.tab !== 'done' && state.tab !== 'void') {
            state.tab = 'done';
        }

        var backHref = listBackUrl();
        var back = document.getElementById('detailBackBtn');
        if (back) {
            back.href = backHref;
        }
        var designBack = document.getElementById('designBackBtn');
        if (designBack) {
            designBack.href = backHref;
        }

        if (!state.id) {
            window.location.replace(backHref);
            return;
        }

        if (state.id === 'new') {
            startCreateFlow();
            return;
        }

        reloadRecord()
            .then(function (rec) {
                if (!rec) {
                    window.location.replace(backHref);
                    return;
                }

                var stamp = document.querySelector('.stamp-done');
                if (stamp) {
                    stamp.style.display = state.tab === 'done' ? '' : 'none';
                }

                ensureRefundRecords();
                fillView(state.record);
                bindTabs();
                bindRefundPanelEvents();
                bindRefundEditSheet();
                bindHeaderTitleAdd();
                bindIncomeNavigate();
                updateDisplayMode();
                bindFooterActions();
                updateFooterForTab('declare');
                updateHeaderTitleForTab('declare');
            })
            .catch(function () {
                window.location.replace(backHref);
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
