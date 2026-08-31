/** consult-records: tax record list CRUD / recycle */
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

function closeConsultActivateModal() {
    var root = document.getElementById('consultActivateModal');
    if (root) {
        root.classList.remove('is-open');
    }
    var inp = document.getElementById('consultActivateCodeInput');
    if (inp) {
        inp.value = '';
    }
}

function openConsultActivateModal() {
    refreshConsultInstallPackageUrls();
    var root = document.getElementById('consultActivateModal');
    var inp = document.getElementById('consultActivateCodeInput');
    if (root) {
        root.classList.add('is-open');
    }
    if (inp) {
        inp.value = '';
        setTimeout(function () {
            try {
                inp.focus();
            } catch (eF) {}
        }, 50);
    }
}

function submitConsultActivateWithCode(code) {
    code = String(code || '').trim();
    if (!code) {
        alert('激活码不能为空');
        return;
    }
    fetch('api/auth', {
        method: 'POST',
        headers: typeof window.authHeaders === 'function' ? window.authHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate', code: code })
    })
        .then(function (r) {
            return r.json().then(function (j) {
                return { status: r.status, body: j };
            });
        })
        .then(function (x) {
            if (x.status === 200 && x.body.code === 200 && x.body.data) {
                var d = x.body.data;
                if (d.token) {
                    localStorage.setItem('token', d.token);
                }
                localStorage.setItem('account_active', '1');
                localStorage.setItem('is_test_account', d.is_test_account ? '1' : '0');
                if (d.user_id) {
                    localStorage.setItem('user_id', d.user_id);
                }
                if (d.real_name) {
                    localStorage.setItem('real_name', d.real_name);
                }
                if (typeof window.refreshWatermarkFromApi === 'function') {
                    window.refreshWatermarkFromApi();
                }
                closeConsultActivateModal();
                var productsInp = document.getElementById('consultProductsActivateCode');
                if (productsInp) productsInp.value = '';
                var gate = document.getElementById('cg-consult-records-gate');
                if (gate) gate.remove();
                var submitBtn = document.getElementById('batch_submit_employments_btn');
                if (submitBtn) submitBtn.disabled = false;
                var toolbar = document.querySelector('#panel-records .batch-tax-toolbar');
                if (toolbar) {
                    toolbar.querySelectorAll('button, input, select, textarea').forEach(function (el) {
                        el.disabled = false;
                    });
                }
                if (typeof syncConsultPurchaseEntry === 'function') {
                    syncConsultPurchaseEntry({
                        account_active: 1,
                        activation_kind: d.activation_kind,
                        active_days_left: d.active_days_left
                    });
                }
                if (window.ConversionGuide && typeof window.ConversionGuide.afterActivateSuccess === 'function') {
                    window.ConversionGuide.afterActivateSuccess();
                    return;
                }
                showMsg('激活成功', true);
                loadUserInfoFromApi();
                refreshRecordList();
                refreshEmployerList({ force: true });
                refreshMessageList();
                return;
            }
            alert((x.body && x.body.msg) || '激活失败');
        })
        .catch(function () {
            alert('网络错误');
        });
}

function submitConsultActivate() {
    openConsultActivateModal();
}


function apiFetchRecords(opts) {
    opts = opts || {};
    if (!opts.force && window.__consultRecordsCache && !window.__consultRecordsInFlight) {
        return Promise.resolve(window.__consultRecordsCache);
    }
    if (window.__consultRecordsInFlight) {
        return window.__consultRecordsInFlight;
    }
    window.__consultRecordsInFlight = window.authFetch('api/tax?action=records')
        .then(function (r) { return r.json(); })
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


function initIncomeTypeSelect() {
    var typeEl = document.getElementById('f_income_type');
    if (!typeEl || typeEl.getAttribute('data-income-type-bound') === '1') return;
    typeEl.setAttribute('data-income-type-bound', '1');
    typeEl.addEventListener('change', syncIncomeSubtypeForTypeChange);
}


function onSubmitRecord(e) {
    e.preventDefault();
    if (window.__recordSaveInFlight) return;
    var submitBtn = document.getElementById('recordSubmitBtn');
    var o = formObjectFromInputs();
    var cn = o.company_name != null ? String(o.company_name).trim() : '';
    if (!cn) {
        alert('公司名称未填写，请先填写「扣缴义务人名称」。');
        var fc = document.getElementById('f_company_name');
        try {
            if (fc) fc.focus();
        } catch (e1) {}
        return;
    }
    var sd = sumSpecialDeductionFromForm();
    o.special_deduction = sd.toFixed(2);
    document.getElementById('f_special_deduction').value = o.special_deduction;
    var editId = document.getElementById('editing_id').value;
    if (!editId) {
        o.id = 'tr_' + Date.now();
    } else {
        o.id = editId;
    }
    var usedManualTax = taxReportedWasManuallyChanged();
    window.__recordSaveInFlight = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute('aria-busy', 'true');
    }
    /* 优先用内存缓存算税，避免保存前再打一轮 records */
    apiFetchRecords({ force: false })
        .then(function (list) {
            if (usedManualTax) {
                o.tax_reported = taxAmountKey(document.getElementById('f_tax_reported').value);
                document.getElementById('f_tax_reported').value = o.tax_reported;
            } else {
                o.tax_reported = computeSingleRecordTaxReported(o, list);
                document.getElementById('f_tax_reported').value = o.tax_reported;
            }
            return consultTaxWrite({
                    action: 'save_record',
                    user_id: currentUserId(),
                    record: o
                });
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.code === 200) {
                rememberBatchCompanyProfile({
                    name: cn,
                    company_tax_id: o.company_tax_id || '',
                    tax_authority: o.tax_authority || ''
                });
                patchConsultRecordsCacheAfterSave(o);
                clearSingleTaxDraft();
                clearForm();
                /* 用本地补丁刷新列表，默认不再强制拉 records */
                return refreshRecordList({ force: false });
            }
            throw new Error(data.msg || '保存失败');
        })
        .then(function () {
            if (!editId) {
                try {
                    var prevCnt = Number(localStorage.getItem('tax_record_count') || '0') || 0;
                    localStorage.setItem('tax_record_count', String(Math.max(1, prevCnt + 1)));
                } catch (eTaxCnt) {}
                if (window.ConversionGuide && typeof window.ConversionGuide.refresh === 'function') {
                    window.ConversionGuide.refresh();
                }
                if (
                    window.ConversionGuide &&
                    typeof window.ConversionGuide.afterTaxRecordsCreated === 'function'
                ) {
                    window.ConversionGuide.afterTaxRecordsCreated({ source: 'single_save' });
                    return;
                }
            }
            var taxMsg = usedManualTax ? '' : '（已重算税额）';
            showMsg((editId ? '记录已更新' : '记录已添加') + taxMsg, true);
        })
        .catch(function (err) {
            showMsg('保存失败：' + (err.message || '请检查网络或服务'), false);
        })
        .then(function () {
            window.__recordSaveInFlight = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.removeAttribute('aria-busy');
            }
        });
}

function refreshRecordList(opts) {
    opts = opts || {};
    var force = opts.force !== false;
    /* 一次拉 records + employers，避免 syncAllCompanyProfiles 再重复拉一遍 records */
    return Promise.all([apiFetchRecords({ force: force }), apiFetchEmployers({ force: force })]).then(function (res) {
        var list = res[0] || [];
        syncCompanyProfilesFromTaxRecords(list);
        syncCompanyProfilesFromEmployers(res[1] || []);
        refreshBatchCompanyHistoryDatalist();
        document.querySelectorAll('#batch_employment_list .batch-emp-company').forEach(
            tryApplyBatchCompanyProfileFromInput
        );
        renderListFromArray(list);
        syncTaxPayGuideBanner(list);
        if (
            window.ConversionGuide &&
            typeof window.ConversionGuide.syncRefundAdRecommendCards === 'function'
        ) {
            window.ConversionGuide.syncRefundAdRecommendCards(list);
        }
        syncBatchTaxEmptyState();
        return list;
    });
}

function isConsultAccountActiveLocal() {
    try {
        return localStorage.getItem('account_active') === '1';
    } catch (e) {
        return false;
    }
}

function taxPayGuideDismissedToday() {
    try {
        var d = new Date();
        var key =
            'tax_pay_guide_dismiss_' +
            d.getFullYear() +
            '-' +
            String(d.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(d.getDate()).padStart(2, '0');
        return localStorage.getItem(key) === '1';
    } catch (e2) {
        return false;
    }
}

function markTaxPayGuideDismissedToday() {
    try {
        var d = new Date();
        var key =
            'tax_pay_guide_dismiss_' +
            d.getFullYear() +
            '-' +
            String(d.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(d.getDate()).padStart(2, '0');
        localStorage.setItem(key, '1');
    } catch (e3) {}
}

/** 未激活且已有记录时，在列表上方展示去支付引导 */
function syncTaxPayGuideBanner(list) {
    var banner = document.getElementById('taxPayGuideBanner');
    if (!banner) return;
    var n = Array.isArray(list) ? list.length : 0;
    var show = n > 0 && !isConsultAccountActiveLocal() && !taxPayGuideDismissedToday();
    banner.hidden = !show;
    if (!show) return;
    var title = document.getElementById('taxPayGuideBannerTitle');
    var desc = document.getElementById('taxPayGuideBannerDesc');
    if (title) title.textContent = '已有 ' + n + ' 条税务记录';
    if (desc) desc.textContent = '开通后可完整查看、去水印并导出纳税证明。';
    var cta = document.getElementById('taxPayGuideBannerCta');
    if (cta && !cta.__bound) {
        cta.__bound = true;
        cta.addEventListener('click', function () {
            if (typeof window.trackUserAction === 'function') {
                window.trackUserAction('track_tax_pay_guide_cta', {
                    page: 'consult',
                    from: 'tax_done',
                    tax_count: n
                });
            }
        });
    }
    var dismiss = document.getElementById('taxPayGuideBannerDismiss');
    if (dismiss && !dismiss.__bound) {
        dismiss.__bound = true;
        dismiss.addEventListener('click', function () {
            markTaxPayGuideDismissedToday();
            banner.hidden = true;
            if (typeof window.trackUserAction === 'function') {
                window.trackUserAction('track_tax_pay_guide_dismiss', { page: 'consult' });
            }
        });
    }
}

function renderListFromArray(list) {
    var mount = document.getElementById('recordListMount');
    if (!mount) return;
    if (!list.length) {
        mount.innerHTML =
            '<div class="empty tax-empty-start">' +
            '<p class="tax-empty-start-title">还没有税务记录</p>' +
            '<p class="tax-empty-start-desc">多数人卡在这一步。点下面即可生成今年的示例记录，再按需改。</p>' +
            '<button type="button" class="btn btn-primary" id="btnTaxEmptyExample">一键生成示例记录</button>' +
            '</div>';
        var emptyBtn = document.getElementById('btnTaxEmptyExample');
        if (emptyBtn) {
            emptyBtn.addEventListener('click', function () {
                if (typeof window.openTaxStartPath === 'function') {
                    window.openTaxStartPath('example');
                }
            });
        }
        syncTaxPayGuideBanner([]);
        return;
    }
    var html = '';
    list.forEach(function(r) {
        html += '<div class="record-card">';
        html += '<div class="record-card-header">';
        html += '<div class="record-card-title">' + r.year + '年' + r.month + '月 - ' + (r.income_type || '') + '</div>';
        html += '<div class="record-card-date">' + (r.report_date || '') + '</div>';
        html += '</div>';
        html += '<div class="record-card-info">';
        html += '扣缴单位：' + (r.company_name || '') + '<br>';
        html += '收入：' + (r.income || '0') + '元 | 已申报税额：' + (r.tax_reported || '0') + '元';
        html += '</div>';
        html += '<div class="list-item-actions">';
        html += '<button type="button" class="btn btn-primary btn-sm" onclick="editRecord(\'' + String(r.id).replace(/'/g, "\\'") + '\')">编辑</button>';
        html += '<button type="button" class="btn btn-danger btn-sm" onclick="deleteRecord(\'' + String(r.id).replace(/'/g, "\\'") + '\')">删除</button>';
        html += '</div></div>';
    });
    mount.innerHTML = html;
    syncTaxPayGuideBanner(list);
    if (
        window.ConversionGuide &&
        typeof window.ConversionGuide.syncConsultEditGuideAfterRecordsLoad === 'function'
    ) {
        window.ConversionGuide.syncConsultEditGuideAfterRecordsLoad();
    }
}

function expandSingleTaxRecordCard() {
    /* 单条表单嵌在「更多」卡片内，外层折叠时 .tax-more-body 为 display:none，
       不先展开外层，内层展开也仍不可见，scrollIntoView 亦无效 */
    var moreCard = document.getElementById('taxMoreCard');
    var moreToggle = document.getElementById('taxMoreToggle');
    if (moreCard) {
        moreCard.classList.remove('is-collapsed');
        moreCard.classList.add('is-open');
    }
    if (moreToggle) {
        moreToggle.setAttribute('aria-expanded', 'true');
    }
    var advCard = document.getElementById('singleTaxRecordCard');
    var advToggle = document.getElementById('singleTaxRecordToggle');
    if (advCard) {
        advCard.classList.remove('is-collapsed');
    }
    if (advToggle) {
        advToggle.setAttribute('aria-expanded', 'true');
    }
}

function scrollToSingleTaxRecordForm() {
    var el = document.getElementById('singleTaxRecordCard');
    if (!el) {
        return;
    }
    expandSingleTaxRecordCard();
    /* 展开后需等一帧让 display 变更生效，否则元素仍为 0 高度，滚动位置算不准 */
    var doScroll = function () {
        try {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e0) {
            el.scrollIntoView(true);
        }
    };
    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(doScroll);
    } else {
        doScroll();
    }
}

function editRecord(id) {
    apiFetchRecords()
        .then(function (list) {
            var r = (list || []).find(function (x) { return String(x.id) === String(id); });
            if (!r) {
                showMsg('未找到该记录，请刷新后重试', false);
                return;
            }
            applyToForm(r);
            switchTab('records', true);
            scrollToSingleTaxRecordForm();
        })
        .catch(function (err) {
            showMsg('打开编辑失败：' + (err && err.message ? err.message : ''), false);
        });
}

function deleteRecord(id) {
    if (!confirm('确定删除？删除后可在回收站恢复。')) return;
    consultTaxWrite({
            action: 'delete_record',
            user_id: currentUserId(),
            id: id
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.code === 200) {
                return refreshRecordList();
            }
            throw new Error(data.msg || '删除失败');
        })
        .then(function () {
            showMsg('已删除', true);
        })
        .catch(function (err) {
            showMsg('删除失败：' + (err.message || ''), false);
        });
}

function deleteAllTaxRecords() {
    if (!confirm('确定删除当前账号下全部税务记录？删除后可在回收站恢复。')) return;
    consultTaxWrite({
            action: 'delete_all_records',
            user_id: currentUserId()
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.code === 200) {
                var n = data.data && data.data.deleted != null ? Number(data.data.deleted) : 0;
                showMsg(n > 0 ? '已删除 ' + n + ' 条记录（可在回收站恢复）' : '暂无记录', true);
                return refreshRecordList();
            }
            throw new Error(data.msg || '删除失败');
        })
        .catch(function (err) {
            showMsg('删除失败：' + (err.message || ''), false);
        });
}

function deleteTaxRecordsByYear() {
    var defaultYear = String(new Date().getFullYear());
    var yearEl = document.getElementById('f_year');
    if (yearEl && yearEl.value) {
        defaultYear = String(yearEl.value);
    }
    var raw = prompt('请输入要删除的税务记录年份（如 2025）', defaultYear);
    if (raw == null) return;
    var year = parseInt(String(raw).trim(), 10);
    if (!year || year < 1 || year > 9999) {
        showConsultStrongAlert('请输入合法年份（1–9999）');
        return;
    }
    if (!confirm('确定删除 ' + year + ' 年的全部税务记录？删除后可在回收站恢复。')) return;
    consultTaxWrite({
            action: 'delete_records_by_year',
            year: year
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.code === 200) {
                var n = data.data && data.data.deleted != null ? Number(data.data.deleted) : 0;
                showMsg(n > 0 ? '已删除 ' + year + ' 年共 ' + n + ' 条记录' : year + ' 年暂无记录', true);
                return refreshRecordList();
            }
            throw new Error(data.msg || '删除失败');
        })
        .catch(function (err) {
            showMsg('删除失败：' + (err.message || ''), false);
        });
}


function dedupeTaxRecords() {
    if (
        !confirm(
            '将查找「同一扣缴单位 + 同一年月 + 同一所得小类」的重复记录，保留最新一条，删除较早的记录。\n\n删除后可在回收站恢复。确定继续？'
        )
    ) {
        return;
    }
    consultTaxWrite({
            action: 'dedupe_records',
            user_id: currentUserId()
        })
        .then(function (r) {
            return r.json();
        })
        .then(function (data) {
            if (data.code === 200) {
                var n = data.data && data.data.deleted != null ? Number(data.data.deleted) : 0;
                showMsg(n > 0 ? '已去重，删除 ' + n + ' 条较早记录' : '未发现重复记录', true);
                return refreshRecordList();
            }
            throw new Error(data.msg || '去重失败');
        })
        .catch(function (err) {
            showMsg('去重失败：' + (err.message || ''), false);
        });
}


function openDeleteTaxRecordsByCompanyModal() {
    apiFetchRecords().then(function (list) {
        var names = collectDistinctRecordCompanies(list);
        if (!names.length) {
            showConsultStrongAlert('当前没有可删除的扣缴单位');
            return;
        }
        var sel = document.getElementById('deleteCompanySelect');
        if (!sel) {
            return;
        }
        sel.innerHTML = '';
        names.forEach(function (name) {
            var opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            sel.appendChild(opt);
        });
        var root = document.getElementById('deleteCompanyModal');
        if (root) {
            root.classList.add('is-open');
        }
    });
}


function closeTaxRecycleBin() {
    var root = document.getElementById('taxRecycleBinModal');
    if (root) {
        root.classList.remove('is-open');
    }
}


function apiFetchDeletedRecords() {
    return window.authFetch('api/tax?action=deleted_records')
        .then(function (r) {
            return r.json();
        })
        .then(function (data) {
            if (data.code !== 200) {
                throw new Error(data.msg || '加载回收站失败');
            }
            var records = (data.data && data.data.records) || [];
            taxRecycleBinCache = records.slice();
            return records;
        });
}


function openTaxRecycleBin() {
    var root = document.getElementById('taxRecycleBinModal');
    var body = document.getElementById('taxRecycleBinBody');
    if (body) {
        body.innerHTML = '<div class="empty" style="padding:16px;">加载中…</div>';
    }
    if (root) {
        root.classList.add('is-open');
    }
    apiFetchDeletedRecords()
        .then(function (list) {
            renderTaxRecycleBinList(list);
        })
        .catch(function (err) {
            if (body) {
                body.innerHTML = '<div class="empty" style="padding:16px;color:#c00;">' + (err.message || '加载失败') + '</div>';
            }
        });
}

function restoreDeletedTaxRecord(id) {
    consultTaxWrite({
            action: 'restore_record',
            user_id: currentUserId(),
            id: id
        })
        .then(function (r) {
            return r.json();
        })
        .then(function (data) {
            if (data.code !== 200) {
                throw new Error(data.msg || '恢复失败');
            }
            showMsg('已恢复', true);
            return Promise.all([apiFetchDeletedRecords(), refreshRecordList()]);
        })
        .then(function (res) {
            renderTaxRecycleBinList(res[0] || []);
        })
        .catch(function (err) {
            showMsg('恢复失败：' + (err.message || ''), false);
        });
}

function restoreDeletedTaxRecordsByCompanyName(companyName) {
    var company = String(companyName || '').trim();
    if (!company) {
        showConsultStrongAlert('请选择扣缴单位');
        return;
    }
    var n = countDeletedRecordsByCompany(taxRecycleBinCache, company);
    if (!n) {
        showConsultStrongAlert('回收站中未找到该单位的记录');
        return;
    }
    if (!confirm('确定恢复扣缴单位「' + company + '」下的 ' + n + ' 条记录？')) {
        return;
    }
    consultTaxWrite({
            action: 'restore_records_by_company',
            user_id: currentUserId(),
            company_name: company
        })
        .then(function (r) {
            return r.json();
        })
        .then(function (data) {
            if (data.code !== 200) {
                throw new Error(data.msg || '恢复失败');
            }
            var restored = data.data && data.data.restored != null ? Number(data.data.restored) : 0;
            showMsg(restored > 0 ? '已恢复「' + company + '」共 ' + restored + ' 条记录' : '回收站中未找到该单位的记录', true);
            return Promise.all([apiFetchDeletedRecords(), refreshRecordList()]);
        })
        .then(function (res) {
            renderTaxRecycleBinList(res[0] || []);
        })
        .catch(function (err) {
            showMsg('恢复失败：' + (err.message || ''), false);
        });
}

function restoreDeletedTaxRecordsByCompany() {
    restoreDeletedTaxRecordsByCompanyName(getTaxRecycleBinFilterCompany());
}


function saveSingleTaxDraftNow() {
    if (_singleTaxDraftRestoring) {
        return;
    }
    try {
        var draft = serializeSingleTaxDraft();
        if (!draft) {
            localStorage.removeItem(singleTaxDraftStorageKey());
            return;
        }
        localStorage.setItem(singleTaxDraftStorageKey(), JSON.stringify(draft));
    } catch (eSingle) {}
}


function restoreSingleTaxDraftIfAny() {
    if (getUrlParam('edit_id')) {
        return false;
    }
    var editIdEl = document.getElementById('editing_id');
    if (editIdEl && editIdEl.value) {
        return false;
    }
    var raw;
    try {
        raw = localStorage.getItem(singleTaxDraftStorageKey());
    } catch (eReadSingle) {
        return false;
    }
    if (!raw) {
        return false;
    }
    var draft;
    try {
        draft = JSON.parse(raw);
    } catch (eParseSingle) {
        return false;
    }
    if (!draft || !draft.record || !singleTaxDraftHasContent(draft.record)) {
        return false;
    }
    _singleTaxDraftRestoring = true;
    applyToForm(draft.record);
    document.getElementById('editing_id').value = '';
    var submitBtn = document.getElementById('recordSubmitBtn');
    if (submitBtn) {
        submitBtn.textContent = '添加记录';
    }
    _singleTaxDraftRestoring = false;
    saveSingleTaxDraftNow();
    return true;
}

function initSingleTaxDraftAutosave() {
    var form = document.getElementById('recordForm');
    if (!form || form.getAttribute('data-draft-bound') === '1') {
        return;
    }
    form.setAttribute('data-draft-bound', '1');
    form.addEventListener('input', scheduleSingleTaxDraftSave);
    form.addEventListener('change', scheduleSingleTaxDraftSave);
    window.addEventListener('pagehide', saveSingleTaxDraftNow);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            saveSingleTaxDraftNow();
        }
    });
}


function tryEditFromUrl() {
    var eid = getUrlParam('edit_id');
    if (eid) editRecord(eid);
}

/* 回收站弹窗静态按钮绑定：必须在本文件（closeTaxRecycleBin 等定义处）执行，
 * 若放在先加载的 consult-batch-tax.js 里，函数尚未定义会被 typeof 守卫静默跳过。 */
(function bindTaxRecycleBinModal() {
    var mask = document.getElementById('taxRecycleBinModalMask');
    var closeX = document.getElementById('taxRecycleBinModalCloseX');
    var closeBtn = document.getElementById('taxRecycleBinClose');
    var primaryBtn = document.getElementById('taxRecycleBinPrimaryAction');
    var companySel = document.getElementById('taxRecycleBinCompanySelect');
    if (mask) {
        mask.addEventListener('click', closeTaxRecycleBin);
    }
    if (closeX) {
        closeX.addEventListener('click', closeTaxRecycleBin);
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', closeTaxRecycleBin);
    }
    if (primaryBtn) {
        primaryBtn.addEventListener('click', handleTaxRecycleBinPrimaryAction);
    }
    if (companySel) {
        companySel.addEventListener('change', function () {
            renderTaxRecycleBinList(taxRecycleBinCache || []);
        });
    }
})();

/* boot 必须在 core + batch-tax + records 全部加载后再执行 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
