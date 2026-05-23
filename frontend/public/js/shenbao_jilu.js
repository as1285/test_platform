(function () {
    var AMOUNT_TYPES = {
        refunded: '已退税额',
        refundable: '可申请退税额',
        paid: '已缴税额'
    };

    var DEFAULT_RECORDS = [
        {
            id: '1',
            groupMonth: '2026-03',
            title: '2025年度综合所得年度汇算',
            periodStart: '2025-01',
            periodEnd: '2025-12',
            amountType: 'refunded',
            amount: '6109.82'
        },
        {
            id: '2',
            groupMonth: '2025-03',
            title: '2024年度综合所得年度汇算',
            periodStart: '2024-01',
            periodEnd: '2024-12',
            amountType: 'refunded',
            amount: '16590.15'
        },
        {
            id: '3',
            groupMonth: '2024-03',
            title: '2023年度综合所得年度汇算',
            periodStart: '2023-01',
            periodEnd: '2023-12',
            amountType: 'refundable',
            amount: '2400.00'
        },
        {
            id: '4',
            groupMonth: '2023-05',
            title: '2022年度综合所得年度汇算',
            periodStart: '2022-01',
            periodEnd: '2022-12',
            amountType: 'refundable',
            amount: '60.00'
        },
        {
            id: '5',
            groupMonth: '2022-06',
            title: '2021年度综合所得年度汇算',
            periodStart: '2021-01',
            periodEnd: '2021-12',
            amountType: 'paid',
            amount: '1450.86'
        }
    ];

    var LIST_TABS = { done: 1, void: 1 };

    function userId() {
        return localStorage.getItem('user_id') || localStorage.getItem('userName') || 'guest';
    }

    function storageKey(tab) {
        return 'shenbao_jilu_' + tab + '_' + userId();
    }

    function cloneDefaults() {
        return DEFAULT_RECORDS.map(function (r) {
            return Object.assign({}, r);
        });
    }

    function loadRecords(tab) {
        try {
            var raw = localStorage.getItem(storageKey(tab));
            if (!raw) {
                return cloneDefaults();
            }
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) || !parsed.length) {
                return cloneDefaults();
            }
            return parsed;
        } catch (e) {
            return cloneDefaults();
        }
    }

    function saveRecords(tab, list) {
        localStorage.setItem(storageKey(tab), JSON.stringify(list));
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function amountLine(record) {
        var label = AMOUNT_TYPES[record.amountType] || AMOUNT_TYPES.refunded;
        var val = record.amount != null ? String(record.amount).trim() : '0';
        if (val && val.indexOf('元') === -1) {
            val += '元';
        }
        return label + '：' + val;
    }

    function renderRecordList(records) {
        var html = '<div class="record-list">';
        var lastGroup = '';
        records.forEach(function (r) {
            if (r.groupMonth !== lastGroup) {
                lastGroup = r.groupMonth;
                html += '<div class="record-group-label">' + esc(r.groupMonth || '—') + '</div>';
            }
            html +=
                '<button type="button" class="record-item" data-id="' +
                esc(r.id) +
                '">' +
                '<div class="record-item-body">' +
                '<div class="record-title">' +
                esc(r.title) +
                '</div>' +
                '<div class="record-sub">税款所属期：' +
                esc(r.periodStart) +
                ' 至 ' +
                esc(r.periodEnd) +
                '</div>' +
                '<div class="record-sub record-amount">' +
                esc(amountLine(r)) +
                '</div>' +
                '</div>' +
                '<span class="record-chevron" aria-hidden="true">›</span>' +
                '</button>';
        });
        html += '</div>';
        return html;
    }

    function renderEmpty() {
        return (
            '<div class="empty-wrap">' +
            '<div class="empty-illustration">' +
            '<img src="shuiming_empty.png" alt="" loading="lazy" decoding="async">' +
            '<p class="empty-text">页面空空如也</p>' +
            '</div></div>'
        );
    }

    var state = {
        tab: 'pending',
        records: [],
        editingId: null
    };

    var els = {};

    function isListTab(tab) {
        return !!LIST_TABS[tab];
    }

    function findRecord(id) {
        return state.records.filter(function (r) {
            return String(r.id) === String(id);
        })[0];
    }

    function openEditModal(record) {
        state.editingId = record.id;
        els.modalTitle.value = record.title || '';
        els.modalGroupMonth.value = record.groupMonth || '';
        els.modalPeriodStart.value = record.periodStart || '';
        els.modalPeriodEnd.value = record.periodEnd || '';
        els.modalAmountType.value = record.amountType || 'refunded';
        els.modalAmount.value = String(record.amount || '').replace(/元$/, '');
        els.modalBackdrop.removeAttribute('hidden');
    }

    function closeEditModal() {
        state.editingId = null;
        els.modalBackdrop.setAttribute('hidden', '');
    }

    function saveEditModal() {
        var record = findRecord(state.editingId);
        if (!record) {
            return;
        }
        record.title = els.modalTitle.value.trim();
        record.groupMonth = els.modalGroupMonth.value.trim();
        record.periodStart = els.modalPeriodStart.value.trim();
        record.periodEnd = els.modalPeriodEnd.value.trim();
        record.amountType = els.modalAmountType.value;
        var amt = els.modalAmount.value.trim();
        record.amount = amt.replace(/元$/, '');
        if (!record.title || !record.groupMonth) {
            alert('请填写申报标题与分组月份');
            return;
        }
        saveRecords(state.tab, state.records);
        closeEditModal();
        renderTabContent();
    }

    function renderTabContent() {
        if (isListTab(state.tab)) {
            els.tabContent.innerHTML = renderRecordList(state.records);
            els.tabContent.classList.remove('is-empty');
            els.notice.style.display = 'none';
            bindRecordClicks();
            return;
        }
        els.tabContent.innerHTML = renderEmpty();
        els.tabContent.classList.add('is-empty');
        els.notice.style.display = state.tab === 'pending' ? '' : 'none';
    }

    function bindRecordClicks() {
        els.tabContent.querySelectorAll('.record-item').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-id');
                var record = findRecord(id);
                if (record) {
                    openEditModal(record);
                }
            });
        });
    }

    function setTab(name) {
        state.tab = name;
        if (isListTab(name)) {
            state.records = loadRecords(name);
        } else {
            state.records = [];
        }
        els.tabs.forEach(function (btn) {
            var on = btn.getAttribute('data-tab') === name;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        renderTabContent();
        try {
            var url = new URL(window.location.href);
            if (name === 'pending') {
                url.searchParams.delete('tab');
            } else {
                url.searchParams.set('tab', name);
            }
            history.replaceState(null, '', url.pathname + url.search + url.hash);
        } catch (e) {}
    }

    function init() {
        els.tabs = document.querySelectorAll('.tab');
        els.tabContent = document.getElementById('tabContent');
        els.notice = document.querySelector('.notice');
        els.modalBackdrop = document.getElementById('shenbaoEditBackdrop');
        els.modalTitle = document.getElementById('shenbaoEditTitle');
        els.modalGroupMonth = document.getElementById('shenbaoEditGroupMonth');
        els.modalPeriodStart = document.getElementById('shenbaoEditPeriodStart');
        els.modalPeriodEnd = document.getElementById('shenbaoEditPeriodEnd');
        els.modalAmountType = document.getElementById('shenbaoEditAmountType');
        els.modalAmount = document.getElementById('shenbaoEditAmount');
        els.modalSave = document.getElementById('shenbaoEditSave');
        els.modalCancel = document.getElementById('shenbaoEditCancel');

        var tabFromUrl = '';
        try {
            tabFromUrl = new URLSearchParams(window.location.search).get('tab') || '';
        } catch (e) {}
        if (tabFromUrl === 'done' || tabFromUrl === 'void' || tabFromUrl === 'pending') {
            setTab(tabFromUrl);
        } else {
            state.records = [];
            renderTabContent();
        }

        els.tabs.forEach(function (btn) {
            btn.addEventListener('click', function () {
                setTab(btn.getAttribute('data-tab'));
            });
        });

        els.modalSave.addEventListener('click', saveEditModal);
        els.modalCancel.addEventListener('click', closeEditModal);
        els.modalBackdrop.addEventListener('click', function (e) {
            if (e.target === els.modalBackdrop) {
                closeEditModal();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
