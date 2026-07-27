/** Admin bridge: reuse C-end consult-batch-tax against /api/admin/user-tax-records */
window.__adminTaxBatchCtx = window.__adminTaxBatchCtx || {
    username: '',
    fetch: null,
    reloadUser: null,
    showMsg: null
};

window.__adminTaxBatchCtx.showMsg = function (text, ok) {
    var el = document.getElementById('adminTaxBatchMsg');
    if (!el) {
        try {
            alert(String(text || ''));
        } catch (e0) {}
        return;
    }
    el.innerHTML =
        '<div class="msg ' +
        (ok ? 'msg-success' : 'msg-error') +
        '">' +
        String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;') +
        '</div>';
    clearTimeout(window.__adminTaxBatchMsgTimer);
    window.__adminTaxBatchMsgTimer = setTimeout(function () {
        el.innerHTML = '';
    }, 4000);
};

function apiFetchRecords(opts) {
    opts = opts || {};
    if (!opts.force && window.__consultRecordsCache && !window.__consultRecordsInFlight) {
        return Promise.resolve(window.__consultRecordsCache);
    }
    if (window.__consultRecordsInFlight) {
        return window.__consultRecordsInFlight;
    }
    var ctx = window.__adminTaxBatchCtx;
    if (!ctx || !ctx.username || typeof ctx.fetch !== 'function') {
        return Promise.resolve(window.__consultRecordsCache || []);
    }
    window.__consultRecordsInFlight = ctx
        .fetch('api/admin/user-tax-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: ctx.username, action: 'list' })
        })
        .then(function (r) {
            return r.json();
        })
        .then(function (data) {
            if (data.code === 200 && data.data && Array.isArray(data.data.records)) {
                return data.data.records;
            }
            return [];
        })
        .catch(function () {
            return [];
        })
        .then(function (list) {
            window.__consultRecordsInFlight = null;
            window.__consultRecordsCache = list;
            return list;
        });
    return window.__consultRecordsInFlight;
}

function refreshRecordList() {
    var ctx = window.__adminTaxBatchCtx;
    if (ctx && typeof ctx.reloadUser === 'function' && ctx.username) {
        return Promise.resolve(ctx.reloadUser(ctx.username)).then(function () {
            return window.__consultRecordsCache || [];
        });
    }
    return apiFetchRecords({ force: true });
}

function loadUserInfoFromApi() {
    return Promise.resolve(null);
}

window.apiFetchRecords = apiFetchRecords;
window.refreshRecordList = refreshRecordList;
window.loadUserInfoFromApi = loadUserInfoFromApi;
window.__adminTaxBatchReady = true;
