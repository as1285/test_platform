(function () {
    var Store = window.ShenbaoJiluStore;

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
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
                esc(Store.amountLine(r)) +
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
            '<img src="shuiming_empty.png" alt="页面空空如也" loading="lazy" decoding="async">' +
            '</div></div>'
        );
    }

    function renderLoadError(msg) {
        return (
            '<div class="empty-wrap">' +
            '<p class="empty-text">' +
            esc(msg || '加载失败，请稍后重试') +
            '</p></div>'
        );
    }

    var state = {
        tab: 'pending',
        records: [],
        loading: false
    };

    var longPressTimer = null;
    var longPressTriggered = false;

    var els = {};

    function isListTab(tab) {
        return tab === 'done' || tab === 'void';
    }

    function goDetail(id) {
        var url =
            'shenbao_jilu_detail.html?id=' + encodeURIComponent(id) + '&tab=' + encodeURIComponent(state.tab);
        window.location.href = url;
    }

    function goAddNew() {
        if (!isListTab(state.tab)) {
            return;
        }
        goDetail('new');
    }

    function updateHeaderTitleAddMode() {
        var btn = els.headerTitleBtn;
        if (!btn) {
            return;
        }
        var canAdd = isListTab(state.tab);
        btn.classList.toggle('header-title--add', canAdd);
        btn.setAttribute('aria-label', canAdd ? '申报记录（更正/作废申报），点击新增' : '申报记录（更正/作废申报）');
    }

    function renderTabContent() {
        if (state.loading && isListTab(state.tab)) {
            els.tabContent.innerHTML = '<div class="empty-wrap"><p class="empty-text">加载中…</p></div>';
            els.tabContent.classList.add('is-empty');
            els.notice.style.display = 'none';
            return;
        }
        if (isListTab(state.tab)) {
            if (!state.records.length) {
                els.tabContent.innerHTML = renderEmpty();
                els.tabContent.classList.add('is-empty');
                els.notice.style.display = 'none';
                return;
            }
            els.tabContent.innerHTML = renderRecordList(state.records);
            els.tabContent.classList.remove('is-empty');
            els.notice.style.display = 'none';
            return;
        }
        els.tabContent.innerHTML = renderEmpty();
        els.tabContent.classList.add('is-empty');
        els.notice.style.display = state.tab === 'pending' ? '' : 'none';
    }

    function deleteRecord(id) {
        if (!confirm('确定删除这条申报记录？')) {
            return;
        }
        Store.deleteRecord(state.tab, id)
            .then(function () {
                refreshListRecords();
            })
            .catch(function (e) {
                alert((e && e.message) || '删除失败');
            });
    }

    function clearLongPress() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        document.querySelectorAll('.record-item.is-longpress').forEach(function (el) {
            el.classList.remove('is-longpress');
        });
    }

    function startLongPress(btn, id) {
        clearLongPress();
        longPressTriggered = false;
        if (btn) {
            btn.classList.add('is-longpress');
        }
        longPressTimer = setTimeout(function () {
            longPressTriggered = true;
            clearLongPress();
            deleteRecord(id);
        }, 550);
    }

    function bindRecordEvents() {
        if (!els.tabContent || els.tabContent.getAttribute('data-record-bound') === '1') {
            return;
        }
        els.tabContent.setAttribute('data-record-bound', '1');

        els.tabContent.addEventListener('click', function (ev) {
            if (longPressTriggered) {
                longPressTriggered = false;
                ev.preventDefault();
                return;
            }
            var btn = ev.target.closest('.record-item');
            if (!btn) {
                return;
            }
            var id = btn.getAttribute('data-id');
            if (id) {
                goDetail(id);
            }
        });

        function onPressStart(ev) {
            var btn = ev.target.closest('.record-item');
            if (!btn) {
                return;
            }
            var id = btn.getAttribute('data-id');
            if (id) {
                startLongPress(btn, id);
            }
        }

        els.tabContent.addEventListener('touchstart', onPressStart, { passive: true });
        els.tabContent.addEventListener('mousedown', onPressStart);
        els.tabContent.addEventListener('touchend', clearLongPress);
        els.tabContent.addEventListener('touchcancel', clearLongPress);
        els.tabContent.addEventListener('touchmove', clearLongPress);
        els.tabContent.addEventListener('mouseup', clearLongPress);
        els.tabContent.addEventListener('mouseleave', clearLongPress);
    }

    function refreshListRecords() {
        if (!isListTab(state.tab)) {
            return;
        }
        state.loading = true;
        renderTabContent();
        Store.loadRecords(state.tab)
            .then(function (records) {
                state.records = records;
                state.loading = false;
                renderTabContent();
            })
            .catch(function (e) {
                state.loading = false;
                state.records = [];
                els.tabContent.innerHTML = renderLoadError(e && e.message);
                els.tabContent.classList.add('is-empty');
            });
    }

    function setTab(name) {
        state.tab = name;
        if (isListTab(name)) {
            refreshListRecords();
        } else {
            state.records = [];
            state.loading = false;
        }
        els.tabs.forEach(function (btn) {
            var on = btn.getAttribute('data-tab') === name;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        if (!isListTab(name)) {
            renderTabContent();
        }
        updateHeaderTitleAddMode();
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
        els.headerTitleBtn = document.getElementById('headerTitleBtn');
        bindRecordEvents();
        if (els.headerTitleBtn) {
            els.headerTitleBtn.addEventListener('click', function () {
                if (!isListTab(state.tab)) {
                    return;
                }
                goAddNew();
            });
        }

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
        updateHeaderTitleAddMode();

        els.tabs.forEach(function (btn) {
            btn.addEventListener('click', function () {
                setTab(btn.getAttribute('data-tab'));
            });
        });

        window.addEventListener('pageshow', function (ev) {
            if (ev.persisted || document.visibilityState === 'visible') {
                if (isListTab(state.tab)) {
                    refreshListRecords();
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
