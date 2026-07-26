(function () {
    var Store = window.ShenbaoJiluStore;

    var state = {
        tab: 'done',
        id: '',
        record: null,
        taxYear: '',
        incomeBreakdown: null,
        category: 'salary'
    };

    function escHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function pad2(n) {
        var x = parseInt(n, 10);
        if (!x || x < 1 || x > 12) {
            return '01';
        }
        return x < 10 ? '0' + x : String(x);
    }

    function formatTaxAmount(v) {
        var n = parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
        if (isNaN(n)) {
            return '0.00';
        }
        return n.toFixed(2);
    }

    function taxYearFromRecord(rec) {
        if (!rec) {
            return '';
        }
        if (rec.taxYear) {
            return String(rec.taxYear);
        }
        if (rec.periodEnd && /^\d{4}/.test(rec.periodEnd)) {
            return rec.periodEnd.slice(0, 4);
        }
        if (rec.groupMonth && /^\d{4}/.test(rec.groupMonth)) {
            return rec.groupMonth.slice(0, 4);
        }
        return '';
    }

    /** 个税记录 income_type → 申报收入 Tab */
    function taxTypeToCategory(incomeType) {
        var t = String(incomeType || '').replace(/\s/g, '');
        if (!t) {
            return 'salary';
        }
        if (t.indexOf('劳务') >= 0) {
            return 'labor';
        }
        if (t.indexOf('稿酬') >= 0) {
            return 'author';
        }
        if (t.indexOf('特许') >= 0) {
            return 'royalty';
        }
        if (t.indexOf('工资') >= 0) {
            return 'salary';
        }
        return 'salary';
    }

    function defaultSubtypeForCategory(catKey) {
        for (var i = 0; i < Store.INCOME_CATEGORIES.length; i++) {
            if (Store.INCOME_CATEGORIES[i].key === catKey) {
                return Store.INCOME_CATEGORIES[i].defaultSubtype;
            }
        }
        return '正常工资薪金';
    }

    function taxRecordToIncomeItem(r, catKey) {
        var y = parseInt(r.year, 10);
        var m = parseInt(r.month, 10);
        var subtype = String(r.income_subtype || '').trim();
        if (!subtype) {
            subtype = defaultSubtypeForCategory(catKey);
        }
        return {
            id: String(r.id != null ? r.id : ''),
            period: y && m ? y + '-' + pad2(m) : '',
            subtype: subtype,
            employer: String(r.company_name || '').trim(),
            amount: formatTaxAmount(r.income)
        };
    }

    function buildIncomeBreakdownFromTaxRecords(records, taxYear) {
        var out = {
            salary: [],
            labor: [],
            author: [],
            royalty: []
        };
        if (!taxYear || !Array.isArray(records)) {
            return out;
        }
        var yearStr = String(taxYear);
        records.forEach(function (r) {
            if (String(r.year) !== yearStr) {
                return;
            }
            var cat = taxTypeToCategory(r.income_type);
            var item = taxRecordToIncomeItem(r, cat);
            if (!item.period) {
                return;
            }
            out[cat].push(item);
        });
        Store.INCOME_CATEGORIES.forEach(function (cat) {
            out[cat.key].sort(function (a, b) {
                if (a.period !== b.period) {
                    return a.period < b.period ? 1 : -1;
                }
                return String(a.id).localeCompare(String(b.id));
            });
        });
        return out;
    }

    function fetchTaxRecords() {
        if (typeof window.authFetch !== 'function') {
            return Promise.reject(new Error('请先登录'));
        }
        return window.authFetch('api/tax?action=records')
            .then(function (r) {
                return r.json();
            })
            .then(function (j) {
                if (j.code === 200 && j.data && Array.isArray(j.data.records)) {
                    return j.data.records;
                }
                throw new Error(j.msg || '个税记录加载失败');
            });
    }

    function ensureBreakdown() {
        if (!state.incomeBreakdown) {
            state.incomeBreakdown = {
                salary: [],
                labor: [],
                author: [],
                royalty: []
            };
        }
        return state.incomeBreakdown;
    }

    function currentCat() {
        for (var i = 0; i < Store.INCOME_CATEGORIES.length; i++) {
            if (Store.INCOME_CATEGORIES[i].key === state.category) {
                return Store.INCOME_CATEGORIES[i];
            }
        }
        return Store.INCOME_CATEGORIES[0];
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
        var listWrap = document.getElementById('listWrap');
        var titleBtn = document.getElementById('headerTitleBtn');
        var cat = currentCat();
        if (titleBtn) {
            titleBtn.textContent = cat.label;
            titleBtn.classList.remove('header-title--add');
            document.title = cat.label;
        }
        if (!listEl) {
            return;
        }
        var list = currentList();
        if (listWrap) {
            listWrap.classList.toggle('is-empty', !list.length);
        }
        if (!list.length) {
            listEl.innerHTML = '';
            renderSummary();
            return;
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

    function bindListEvents() {
        var listEl = document.getElementById('incomeList');
        if (!listEl || listEl.getAttribute('data-bound') === '1') {
            return;
        }
        listEl.setAttribute('data-bound', '1');
        listEl.addEventListener('click', function (ev) {
            var row = ev.target.closest('.income-item');
            if (!row) {
                return;
            }
            var itemId = row.getAttribute('data-item-id');
            if (!itemId) {
                return;
            }
            var item = findItem(itemId);
            if (!item) {
                return;
            }
            var year = state.taxYear || (item.period ? item.period.slice(0, 4) : '');
            window.location.href =
                'xiangqing.html?id=' +
                encodeURIComponent(itemId) +
                '&year=' +
                encodeURIComponent(year);
        });
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
    }

    function loadIncomeFromTaxRecords() {
        return fetchTaxRecords()
            .then(function (records) {
                state.incomeBreakdown = buildIncomeBreakdownFromTaxRecords(
                    records,
                    state.taxYear
                );
            })
            .catch(function () {
                state.incomeBreakdown = {
                    salary: [],
                    labor: [],
                    author: [],
                    royalty: []
                };
            });
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
                    return null;
                }
                state.record = rec;
                state.taxYear = taxYearFromRecord(rec);
                return loadIncomeFromTaxRecords();
            })
            .then(function (done) {
                if (done === null) {
                    return;
                }
                bindHeader();
                bindTabs();
                bindListEvents();
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
