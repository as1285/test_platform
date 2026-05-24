(function () {
    var Store = window.ShenbaoJiluStore;

    var state = {
        tab: 'done',
        id: '',
        record: null,
        category: 'salary',
        editItemId: null,
        isNewItem: false
    };

    var longPressTimer = null;
    var longPressTriggered = false;

    function escHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function currentCat() {
        for (var i = 0; i < Store.INCOME_CATEGORIES.length; i++) {
            if (Store.INCOME_CATEGORIES[i].key === state.category) {
                return Store.INCOME_CATEGORIES[i];
            }
        }
        return Store.INCOME_CATEGORIES[0];
    }

    function ensureBreakdown() {
        if (!state.record) {
            return { salary: [], labor: [], author: [], royalty: [] };
        }
        state.record.incomeBreakdown = Store.normalizeIncomeBreakdown(state.record.incomeBreakdown);
        return state.record.incomeBreakdown;
    }

    function currentList() {
        var bd = ensureBreakdown();
        return bd[state.category] || [];
    }

    function sumCategory(list) {
        var total = 0;
        (list || []).forEach(function (item) {
            var n = parseFloat(item.amount);
            if (!isNaN(n)) {
                total += n;
            }
        });
        return total.toFixed(2);
    }

    function detailBackUrl() {
        return (
            'shenbao_jilu_detail.html?tab=' +
            encodeURIComponent(state.tab) +
            '&id=' +
            encodeURIComponent(state.id)
        );
    }

    function persistRecord() {
        if (!state.record) {
            return Promise.resolve();
        }
        state.record.totalIncome = Store.sumIncomeBreakdown(state.record.incomeBreakdown);
        state.record.detailCustomized = true;
        return Store.saveRecord(state.tab, state.record).then(function (saved) {
            state.record = saved || state.record;
            ensureBreakdown();
        });
    }

    function renderTabs() {
        var root = document.getElementById('incomeTabs');
        if (!root) {
            return;
        }
        var html = '';
        Store.INCOME_CATEGORIES.forEach(function (cat) {
            var active = cat.key === state.category;
            html +=
                '<button type="button" class="income-tab' +
                (active ? ' active' : '') +
                '" data-category="' +
                escHtml(cat.key) +
                '" role="tab" aria-selected="' +
                (active ? 'true' : 'false') +
                '">' +
                escHtml(cat.label) +
                '</button>';
        });
        root.innerHTML = html;
    }

    function renderSummary() {
        var el = document.getElementById('summaryValue');
        if (!el) {
            return;
        }
        var sum = sumCategory(currentList());
        el.innerHTML = escHtml(sum) + '<span class="unit">元</span>';
    }

    function renderList() {
        var listEl = document.getElementById('incomeList');
        var emptyEl = document.getElementById('emptyState');
        var titleBtn = document.getElementById('headerTitleBtn');
        var cat = currentCat();
        if (titleBtn) {
            titleBtn.textContent = cat.label;
            document.title = cat.label;
        }
        if (!listEl) {
            return;
        }
        var list = currentList();
        if (!list.length) {
            listEl.innerHTML = '';
            if (emptyEl) {
                emptyEl.hidden = false;
            }
            if (titleBtn) {
                titleBtn.classList.add('header-title--add');
            }
            renderSummary();
            return;
        }
        if (emptyEl) {
            emptyEl.hidden = true;
        }
        if (titleBtn) {
            titleBtn.classList.add('header-title--add');
        }
        var html = '';
        list.forEach(function (item) {
            var title = (item.period || '—') + ' ' + (item.subtype || '');
            html +=
                '<li class="income-item" data-item-id="' +
                escHtml(item.id) +
                '">' +
                '<div class="income-item-main">' +
                '<div class="income-item-title">' +
                escHtml(title) +
                '</div>' +
                '<div class="income-item-sub">' +
                escHtml(item.employer || '—') +
                '</div>' +
                '</div>' +
                '<div class="income-item-right">' +
                escHtml(item.amount) +
                '元<span class="chev" aria-hidden="true">›</span>' +
                '</div></li>';
        });
        listEl.innerHTML = html;
        renderSummary();
    }

    function findItem(itemId) {
        var list = currentList();
        for (var i = 0; i < list.length; i++) {
            if (String(list[i].id) === String(itemId)) {
                return list[i];
            }
        }
        return null;
    }

    function openEditSheet(item, isNew) {
        state.editItemId = item ? item.id : null;
        state.isNewItem = !!isNew;
        var mask = document.getElementById('editMask');
        var titleEl = document.getElementById('editTitle');
        if (titleEl) {
            titleEl.textContent = isNew ? '新增收入' : '编辑收入';
        }
        document.getElementById('editPeriod').value = (item && item.period) || '';
        document.getElementById('editSubtype').value =
            (item && item.subtype) || currentCat().defaultSubtype;
        document.getElementById('editEmployer').value = (item && item.employer) || '';
        document.getElementById('editAmount').value = (item && item.amount) || '0.00';
        if (mask) {
            mask.classList.add('show');
            mask.setAttribute('aria-hidden', 'false');
        }
        document.getElementById('editPeriod').focus();
    }

    function closeEditSheet() {
        var mask = document.getElementById('editMask');
        if (mask) {
            mask.classList.remove('show');
            mask.setAttribute('aria-hidden', 'true');
        }
        state.editItemId = null;
        state.isNewItem = false;
    }

    function saveEditSheet() {
        var period = String(document.getElementById('editPeriod').value || '').trim();
        var subtype = String(document.getElementById('editSubtype').value || '').trim();
        var employer = String(document.getElementById('editEmployer').value || '').trim();
        var amount = String(document.getElementById('editAmount').value || '')
            .replace(/元/g, '')
            .trim();
        if (!period) {
            alert('请填写所属期');
            return;
        }
        if (!subtype) {
            alert('请填写所得项目小类');
            return;
        }
        var bd = ensureBreakdown();
        var list = bd[state.category];
        if (state.isNewItem) {
            list.unshift(
                Store.createIncomeItem({
                    period: period,
                    subtype: subtype,
                    employer: employer,
                    amount: amount
                })
            );
        } else {
            var item = findItem(state.editItemId);
            if (!item) {
                return;
            }
            item.period = period;
            item.subtype = subtype;
            item.employer = employer;
            item.amount = amount;
        }
        bd[state.category] = list.map(function (x) {
            return Store.normalizeIncomeItem(x, currentCat().defaultSubtype);
        });
        closeEditSheet();
        renderList();
        persistRecord().catch(function (e) {
            alert((e && e.message) || '保存失败');
        });
    }

    function addIncomeItem() {
        openEditSheet(
            Store.createIncomeItem({ subtype: currentCat().defaultSubtype }),
            true
        );
    }

    function deleteIncomeItem(itemId) {
        if (!confirm('确定删除这条收入记录？')) {
            return;
        }
        var bd = ensureBreakdown();
        bd[state.category] = bd[state.category].filter(function (x) {
            return String(x.id) !== String(itemId);
        });
        renderList();
        persistRecord().catch(function (e) {
            alert((e && e.message) || '保存失败');
        });
    }

    function clearLongPress() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        document.querySelectorAll('.income-item.is-longpress').forEach(function (el) {
            el.classList.remove('is-longpress');
        });
    }

    function startLongPress(row, itemId) {
        clearLongPress();
        longPressTriggered = false;
        if (row) {
            row.classList.add('is-longpress');
        }
        longPressTimer = setTimeout(function () {
            longPressTriggered = true;
            clearLongPress();
            deleteIncomeItem(itemId);
        }, 550);
    }

    function bindListEvents() {
        var listEl = document.getElementById('incomeList');
        if (!listEl || listEl.getAttribute('data-bound') === '1') {
            return;
        }
        listEl.setAttribute('data-bound', '1');

        listEl.addEventListener('click', function (ev) {
            if (longPressTriggered) {
                longPressTriggered = false;
                ev.preventDefault();
                return;
            }
            var row = ev.target.closest('.income-item');
            if (!row) {
                return;
            }
            var itemId = row.getAttribute('data-item-id');
            var item = findItem(itemId);
            if (item) {
                openEditSheet(item, false);
            }
            ev.preventDefault();
        });

        function onPressStart(ev) {
            var row = ev.target.closest('.income-item');
            if (!row) {
                return;
            }
            var itemId = row.getAttribute('data-item-id');
            if (itemId) {
                startLongPress(row, itemId);
            }
        }

        listEl.addEventListener('touchstart', onPressStart, { passive: true });
        listEl.addEventListener('mousedown', onPressStart);
        listEl.addEventListener('touchend', clearLongPress);
        listEl.addEventListener('touchcancel', clearLongPress);
        listEl.addEventListener('touchmove', clearLongPress);
        listEl.addEventListener('mouseup', clearLongPress);
        listEl.addEventListener('mouseleave', clearLongPress);
    }

    function bindTabs() {
        var root = document.getElementById('incomeTabs');
        if (!root || root.getAttribute('data-bound') === '1') {
            return;
        }
        root.setAttribute('data-bound', '1');
        root.addEventListener('click', function (ev) {
            var btn = ev.target.closest('[data-category]');
            if (!btn) {
                return;
            }
            state.category = btn.getAttribute('data-category') || 'salary';
            renderTabs();
            renderList();
        });
    }

    function bindHeader() {
        var back = document.getElementById('backBtn');
        if (back) {
            back.href = detailBackUrl();
        }
        var titleBtn = document.getElementById('headerTitleBtn');
        if (titleBtn) {
            titleBtn.addEventListener('click', function () {
                if (titleBtn.classList.contains('header-title--add')) {
                    addIncomeItem();
                }
            });
        }
    }

    function bindEditSheet() {
        var mask = document.getElementById('editMask');
        var cancel = document.getElementById('editCancel');
        var save = document.getElementById('editSave');
        if (mask) {
            mask.addEventListener('click', closeEditSheet);
        }
        if (cancel) {
            cancel.addEventListener('click', closeEditSheet);
        }
        if (save) {
            save.addEventListener('click', saveEditSheet);
        }
    }

    function init() {
        try {
            var params = new URLSearchParams(window.location.search);
            state.id = params.get('id') || '';
            state.tab = params.get('tab') || 'done';
            state.category = params.get('category') || 'salary';
        } catch (e) {
            state.id = '';
            state.tab = 'done';
            state.category = 'salary';
        }

        var validCat = Store.INCOME_CATEGORIES.some(function (c) {
            return c.key === state.category;
        });
        if (!validCat) {
            state.category = 'salary';
        }

        if (!state.id) {
            window.location.replace('shenbao_jilu.html');
            return;
        }

        Store.loadRecordForDetail(state.tab, state.id)
            .then(function (rec) {
                if (!rec) {
                    window.location.replace('shenbao_jilu.html');
                    return;
                }
                state.record = rec;
                ensureBreakdown();
                bindHeader();
                bindTabs();
                bindListEvents();
                bindEditSheet();
                renderTabs();
                renderList();
            })
            .catch(function () {
                window.location.replace('shenbao_jilu.html');
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
