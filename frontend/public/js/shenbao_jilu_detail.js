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
            });
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

        fillView(state.record);
        bindTabs();
        bindFooterActions();
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

                fillView(state.record);
                bindTabs();
                updateDisplayMode();
                bindFooterActions();
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
