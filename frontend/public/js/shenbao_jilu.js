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
            '<img src="shuiming_empty.png" alt="" loading="lazy" decoding="async">' +
            '<p class="empty-text">页面空空如也</p>' +
            '</div></div>'
        );
    }

    var state = {
        tab: 'pending',
        records: []
    };

    var els = {};

    function isListTab(tab) {
        return tab === 'done' || tab === 'void';
    }

    function goDetail(id) {
        var url = 'shenbao_jilu_detail.html?id=' + encodeURIComponent(id) + '&tab=' + encodeURIComponent(state.tab);
        window.location.href = url;
    }

    function renderTabContent() {
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
                if (id) {
                    goDetail(id);
                }
            });
        });
    }

    function setTab(name) {
        state.tab = name;
        if (isListTab(name)) {
            state.records = Store.loadRecords(name);
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
        Store.clearVoidTabSeedOnce();
        Store.zeroListAmountsOnce();
        els.tabs = document.querySelectorAll('.tab');
        els.tabContent = document.getElementById('tabContent');
        els.notice = document.querySelector('.notice');

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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
