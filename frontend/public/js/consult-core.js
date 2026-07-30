/** consult-core: tabs/utils/employers/messages/boot */
function pad2(n) {
    n = parseInt(n, 10);
    return (n < 10 ? '0' : '') + n;
}

/** 税款所属期 YYYY-MM */
function taxPeriodFromYearMonth(year, month) {
    var y = parseInt(year, 10);
    var m = parseInt(month, 10);
    if (!y || !m || m < 1 || m > 12) return '';
    return y + '-' + pad2(m);
}

/** 申报日期比所属期（年-月）晚一个月，默认每月 15 日 */
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

function getUrlParam(name) {
    var reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)');
    var r = window.location.search.substr(1).match(reg);
    if (r != null) return decodeURIComponent(r[2]);
    return null;
}

function currentUserId() {
    if (window.__adminTaxBatchCtx && window.__adminTaxBatchCtx.username) {
        return String(window.__adminTaxBatchCtx.username);
    }
    return localStorage.getItem('user_id') || '64';
}

window.consultUserFlags = { is_test_account: false };

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

function tabHref(tab) {
    return 'consult.html?user_id=' + encodeURIComponent(currentUserId()) + '&tab=' + encodeURIComponent(tab);
}

function getToastDurationMs() {
    if (window.TaxApp && TaxApp.ui && typeof TaxApp.ui.durationMs === 'function') {
        return TaxApp.ui.durationMs();
    }
    var ms = typeof window !== 'undefined' && window.TOAST_DURATION_MS != null
        ? Number(window.TOAST_DURATION_MS) : 3000;
    return isNaN(ms) || ms <= 0 ? 3000 : ms;
}

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


function switchTab(tab, pushHistory) {
    if (typeof window.forceHidePageLoading === 'function') {
        window.forceHidePageLoading();
    }
    if (tab === 'profile') {
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
        else if (tab === 'messages') titleEl.textContent = '消息管理';
        else titleEl.textContent = '税务记录';
    }
    if (tab === 'messages') {
        refreshMessageList().catch(function () {});
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
    var valid = ['employers', 'messages', 'records'];
    if (tab === 'profile') tab = 'employers';
    if (valid.indexOf(tab) < 0) tab = 'records';
    switchTab(tab, false);
}

function syncAccountActiveToStorage(user) {
    if (!user) {
        return;
    }
    var act = user.account_active === true || user.account_active === 1;
    try {
        localStorage.setItem('account_active', act ? '1' : '0');
    } catch (e0) {}
}


function loadUserInfoFromApi() {
    var userId = currentUserId();
    
    if (!userId) {
        return;
    }
    
    window.authFetch('api/user?action=summary')
        .then(function (r) { return r.json(); })
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
                updateProfileForm(user);
            }
        })
        .catch(function (err) {
            console.error('loadUserInfoFromApi', err);
        });
}

var consultXianyuPurchaseUrl = '';

function refreshConsultInstallPackageUrls() {
    /* 优先复用 auth.js 已拉到的安装包配置，避免咨询页启动再打一遍 */
    if (typeof window.getCachedPublicInstallPackages === 'function') {
        var cached = window.getCachedPublicInstallPackages();
        if (cached) {
            consultXianyuPurchaseUrl =
                cached.xianyu_purchase_url != null
                    ? String(cached.xianyu_purchase_url).trim()
                    : '';
            if (typeof applyXianyuPurchaseVisibility === 'function') {
                applyXianyuPurchaseVisibility(cached);
            }
            return Promise.resolve(cached);
        }
    }
    if (typeof window.refreshPublicInstallPackagesUi === 'function') {
        return window.refreshPublicInstallPackagesUi().then(function (data) {
            if (data) {
                consultXianyuPurchaseUrl =
                    data.xianyu_purchase_url != null
                        ? String(data.xianyu_purchase_url).trim()
                        : '';
            }
            return data;
        });
    }
    var url =
        typeof getPublicInstallPackagesUrl === 'function'
            ? getPublicInstallPackagesUrl()
            : '/api/public/install-packages';
    return window.authFetch(url, { credentials: 'same-origin' })
        .then(function (r) {
            return r.json();
        })
        .then(function (body) {
            if (body && body.code === 200 && body.data) {
                consultXianyuPurchaseUrl =
                    body.data.xianyu_purchase_url != null
                        ? String(body.data.xianyu_purchase_url).trim()
                        : '';
                if (typeof applyXianyuPurchaseVisibility === 'function') {
                    applyXianyuPurchaseVisibility(body.data);
                }
                return body.data;
            }
            return null;
        })
        .catch(function () {
            return null;
        });
}


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

function initHeader() {
    try {
        var name = localStorage.getItem('real_name') || '杰瑞';
        document.title = '个人中心 - ' + name;

        initBelongingPeriodSync();
        initTaxReportedManualEditTracking();

        /* 用户资料不挡税务列表首屏 */
        setTimeout(function () {
            loadUserInfoFromApi();
        }, 1200);
    } catch (err) {
        console.error('initHeader', err);
    }
}

/** 从服务端拉取当前用户全部税务记录（收入纳税明细同源数据） */

function resolveLegacyCompanyFromForm() {
    var base = formObjectFromInputs();
    return base.company_name != null ? String(base.company_name).trim() : '';
}


function sumEmploymentBonusTax(employments) {
    var sum = 0;
    (employments || []).forEach(function (emp) {
        if (emp.yearEndBonus > 0) {
            sum = round2(sum + yearEndBonusTaxSeparate(emp.yearEndBonus));
        }
    });
    return sum;
}


function defaultIncomeSubtype(incomeType) {
    var key = String(incomeType || '').trim();
    return INCOME_TYPE_DEFAULT_SUBTYPES[key] || '';
}

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

function syncIncomeSubtypeForTypeChange() {
    var typeEl = document.getElementById('f_income_type');
    var subEl = document.getElementById('f_income_subtype');
    if (!typeEl || !subEl) return;
    var next = defaultIncomeSubtype(typeEl.value);
    if (next) {
        subEl.value = next;
    }
}


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

var taxReportedManualEdit = false;
var taxReportedLoadedValue = null;

function taxAmountKey(v) {
    var n = parseFloat(v);
    if (!isFinite(n)) {
        return '0.00';
    }
    return round2(n).toFixed(2);
}

function resetTaxReportedManualEditFlag() {
    taxReportedManualEdit = false;
    taxReportedLoadedValue = null;
}

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

function clearForm() {
    resetTaxReportedManualEditFlag();
    clearSingleTaxDraft();
    document.getElementById('editing_id').value = '';
    document.getElementById('recordSubmitBtn').textContent = '添加记录';
    document.getElementById('recordForm').reset();
    initHeader();
}

/** 本期专项扣除 = 养老 + 医疗 + 失业 + 公积金（与申报口径一致） */
function sumSpecialDeductionFromForm() {
    var p = parseFloat(document.getElementById('f_pension_insurance').value) || 0;
    var m = parseFloat(document.getElementById('f_medical_insurance').value) || 0;
    var u = parseFloat(document.getElementById('f_unemployment_insurance').value) || 0;
    var h = parseFloat(document.getElementById('f_housing_fund').value) || 0;
    return round2(p + m + u + h);
}

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


function closeDeleteTaxRecordsByCompanyModal() {
    var root = document.getElementById('deleteCompanyModal');
    if (root) {
        root.classList.remove('is-open');
    }
}

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


function confirmDeleteTaxRecordsByCompany() {
    var sel = document.getElementById('deleteCompanySelect');
    var company = sel ? String(sel.value || '').trim() : '';
    if (!company) {
        showConsultStrongAlert('请选择扣缴单位');
        return;
    }
    closeDeleteTaxRecordsByCompanyModal();
    if (!confirm('确定删除扣缴单位「' + company + '」下的全部税务记录？删除后可在回收站恢复或导出。')) {
        return;
    }
    window.authFetch('api/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'delete_records_by_company',
            company_name: company
        })
    })
        .then(function (r) {
            return r.json();
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

var taxRecycleBinCache = [];


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


function updateTaxRecycleBinCompanySelect(list) {
    var sel = document.getElementById('taxRecycleBinCompanySelect');
    if (!sel) {
        return;
    }
    var names = collectDistinctRecordCompanies(list);
    sel.innerHTML = '';
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = names.length ? '选择扣缴单位…' : '暂无扣缴单位';
    sel.appendChild(placeholder);
    names.forEach(function (name) {
        var opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
    });
}

function countDeletedRecordsByCompany(list, company) {
    var n = 0;
    (list || []).forEach(function (r) {
        if (String(r.company_name || '').trim() === company) {
            n += 1;
        }
    });
    return n;
}

function renderTaxRecycleBinList(list) {
    updateTaxRecycleBinCompanySelect(list);
    var body = document.getElementById('taxRecycleBinBody');
    if (!body) {
        return;
    }
    if (!list.length) {
        body.innerHTML = '<div class="empty" style="padding:16px;">回收站为空</div>';
        return;
    }
    var html = '';
    list.forEach(function (r) {
        var idEsc = String(r.id).replace(/'/g, "\\'");
        html += '<div class="recycle-bin-item">';
        html += '<div class="recycle-bin-item-title">' + r.year + '年' + r.month + '月 - ' + (r.income_type || '') + '</div>';
        html += '<div class="recycle-bin-item-meta">';
        html += '删除于 ' + formatDeletedAtLabel(r.deleted_at) + '<br>';
        html += '扣缴单位：' + (r.company_name || '') + '<br>';
        html += '收入：' + (r.income || '0') + '元 | 已申报税额：' + (r.tax_reported || '0') + '元';
        html += '</div>';
        html += '<div class="recycle-bin-item-actions">';
        html += '<button type="button" class="btn btn-primary btn-sm" onclick="restoreDeletedTaxRecord(\'' + idEsc + '\')">恢复</button>';
        html += '</div></div>';
    });
    body.innerHTML = html;
}


function restoreAllDeletedTaxRecords() {
    if (!taxRecycleBinCache.length) {
        showConsultStrongAlert('回收站为空');
        return;
    }
    if (!confirm('确定恢复回收站中的全部 ' + taxRecycleBinCache.length + ' 条记录？')) {
        return;
    }
    window.authFetch('api/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'restore_all_deleted_records',
            user_id: currentUserId()
        })
    })
        .then(function (r) {
            return r.json();
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

function formatTaxYuan(n) {
    var x = Number(n);
    if (!isFinite(x)) return '0.00';
    return (Math.round(x * 100) / 100).toFixed(2);
}

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


function singleTaxDraftStorageKey() {
    return SINGLE_TAX_DRAFT_KEY_PREFIX + String(currentUserId());
}


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


function scheduleSingleTaxDraftSave() {
    if (_singleTaxDraftRestoring) {
        return;
    }
    if (_singleTaxDraftSaveTimer) {
        clearTimeout(_singleTaxDraftSaveTimer);
    }
    _singleTaxDraftSaveTimer = setTimeout(saveSingleTaxDraftNow, 500);
}

function clearSingleTaxDraft() {
    try {
        localStorage.removeItem(singleTaxDraftStorageKey());
    } catch (eClearSingle) {}
}


function companyNameMatchKey(name) {
    return String(name || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '');
}


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

/** 从任职受雇列表补全纳税人识别号（统一社会信用代码 → 工作经历税号字段） */
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

function syncAllCompanyProfiles() {
    return Promise.all([apiFetchRecords(), apiFetchEmployers()]).then(function (res) {
        syncCompanyProfilesFromTaxRecords(res[0] || []);
        syncCompanyProfilesFromEmployers(res[1] || []);
    });
}

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
 * 聊天摘要里常见的「改为 / 数字改为」覆盖原金额，便于运营改数后直接粘贴。
 * 例：月薪税前2万（改为20000—23000区间）；发2万提成（改为21350.5）；奖金22000元—数字改为22621
 */

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


function inferTaxPasteSummaryRange(block, bonuses) {
    var hire = null;
    var hireM = block.match(/入职\s*[：:]?\s*[^\n]{0,20}?(\d{4})\s*年\s*(\d{1,2})\s*月/);
    if (hireM) {
        hire = { y: parseInt(hireM[1], 10), m: parseInt(hireM[2], 10) };
    }
    var fullYears = [];
    var fyRe = /(\d{4})\s*年?\s*全年/g;
    var fm;
    while ((fm = fyRe.exec(block)) !== null) {
        var y = parseInt(fm[1], 10);
        if (y >= 1990 && y <= 2100 && fullYears.indexOf(y) < 0) {
            fullYears.push(y);
        }
    }
    fullYears.sort(function (a, b) {
        return a - b;
    });
    var until = null;
    var untilM = block.match(/一直到\s*(\d{4})\s*年\s*(\d{1,2})\s*月/);
    if (untilM) {
        until = { y: parseInt(untilM[1], 10), m: parseInt(untilM[2], 10) };
    }
    var rangeFromText = null;
    var rangeMatch = block.match(
        /统计区间\s*[：:]\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*[-–—~～至到]+\s*(\d{4})\s*年\s*(\d{1,2})\s*月/
    );
    if (rangeMatch) {
        rangeFromText = {
            sy: parseInt(rangeMatch[1], 10),
            sm: parseInt(rangeMatch[2], 10),
            ey: parseInt(rangeMatch[3], 10),
            em: parseInt(rangeMatch[4], 10)
        };
    }
    if (rangeFromText) {
        return rangeFromText;
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
        var rangeMatch = block.match(
            /统计区间\s*[：:]\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*[-–—~～至到]+\s*(\d{4})\s*年\s*(\d{1,2})\s*月/
        );
        if (rangeMatch) {
            range = {
                sy: parseInt(rangeMatch[1], 10),
                sm: parseInt(rangeMatch[2], 10),
                ey: parseInt(rangeMatch[3], 10),
                em: parseInt(rangeMatch[4], 10)
            };
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
                    '未识别到任职区间：请写明入职时间、「YYYY年全年」或「一直到YYYY年M月」，或粘贴「YYYY年M月 收入x元 税额y元」月明细'
            };
        }
        if (salaryInfo.salary == null && salaryInfo.salary_max == null) {
            return {
                ok: false,
                error: '未识别到月薪：请写明「正常工资薪金：月薪税前x万」或「10000—15000元」等'
            };
        }
        months = buildSummaryMonthsFromRange(range, salaryInfo.salary, salaryInfo.salary_max);
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
    var primary = bonuses.length ? bonuses[0] : null;
    var extra = bonuses.length > 1 ? bonuses.slice(1) : [];
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
        yearEndBonus: primary ? primary.amount : 0,
        bonusYear: primary ? primary.year : '',
        bonusMonth: primary ? primary.month : 12,
        monthSalaryMap: monthSalaryMap,
        monthTaxMap: monthTaxMap
    });
    row._extraBonuses = extra.map(function (b) {
        return { year: b.year, month: b.month, amount: b.amount };
    });
    updateBatchEmpMonthSalaryBadge(row);
}


function digitsOnlyProfile(raw) {
    return String(raw || '').replace(/\D/g, '');
}

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

function recordMatchesSingleTaxCohort(rec, record) {
    var year = parseInt(record.year, 10);
    if (parseInt(rec.year, 10) !== year) {
        return false;
    }
    if (String(rec.income_subtype || '').trim() === '全年一次性奖金收入') {
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


function randomIntInclusive(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


function apiFetchEmployers(opts) {
    opts = opts || {};
    if (!opts.force && window.__consultEmployersCache && !window.__consultEmployersInFlight) {
        return Promise.resolve(window.__consultEmployersCache);
    }
    if (window.__consultEmployersInFlight) {
        return window.__consultEmployersInFlight;
    }
    window.__consultEmployersInFlight = window.authFetch('api/user?action=employers')
        .then(function (r) { return r.json(); })
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
        .then(function (r) { return r.json(); })
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

function refreshEmployerList(opts) {
    return apiFetchEmployers(opts || {}).then(function (list) {
        syncCompanyProfilesFromEmployers(list);
        refreshBatchCompanyHistoryDatalist();
        document.querySelectorAll('#batch_employment_list .batch-emp-company').forEach(
            tryApplyBatchCompanyProfileFromInput
        );
        renderEmployerListFromArray(list);
    });
}

function escAttr(s) {
    return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

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
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.code === 200) {
                showMsg('已删除', true);
                return refreshEmployerList({ force: true });
            }
            throw new Error(data.msg || '删除失败');
        })
        .catch(function (err) {
            showMsg('删除失败：' + (err.message || ''), false);
        });
}

function viewEmployerDetail(id) {
    window.location.href = 'renzhi_detail.html?id=' + encodeURIComponent(String(id));
}

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
                return r.json();
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

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function apiFetchMessages() {
    var uid = currentUserId();
    return window.authFetch('api/message?action=list')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.code === 200 && Array.isArray(data.data)) {
                return data.data;
            }
            return [];
        })
        .catch(function () { return []; });
}

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

function refreshMessageList() {
    return apiFetchMessages().then(function (list) {
        renderMessageListFromArray(list);
    });
}

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
        .then(function (r) { return r.json(); })
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
        .then(function (r) { return r.json(); })
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

function setDefaultMsgDate() {
    var el = document.getElementById('mf_msg_date');
    if (!el || el.value) return;
    var d = new Date();
    el.value = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

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
    initHeader();
    initIncomeTypeSelect();
    initBatchEmploymentRows();
    initBatchTaxDraftAutosave();
    restoreSingleTaxDraftIfAny();
    initSingleTaxDraftAutosave();
    initBatchCompanyHistoryUi();
    initConsultRecordsUx();
    initTabs();
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
            setTimeout(function () {
                refreshConsultInstallPackageUrls();
            }, 600);
        });
    tryEditFromUrl();
}

(function bindConsultActivateModal() {
    var okBtn = document.getElementById('btnConsultActivateOk');
    var cancelBtn = document.getElementById('btnConsultActivateCancel');
    var xyBtn = document.getElementById('btnConsultActivateXianyu');
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
    if (xyBtn) {
        xyBtn.addEventListener('click', function () {
            if (typeof window.trackUserAction === 'function') {
                window.trackUserAction('track_xianyu_purchase_click', {
                    page: 'consult',
                    source: 'activate_modal'
                });
            }
            function doCopy(txt) {
                if (!txt) {
                    alert('暂未配置闲鱼购买文案，请在管理后台「引导安装」中填写');
                    return;
                }
                if (typeof copyXianyuPurchaseText !== 'function') {
                    alert('复制功能不可用');
                    return;
                }
                copyXianyuPurchaseText(txt).catch(function () {
                    alert('复制失败，请长按手动复制');
                });
            }
            var cached = String(consultXianyuPurchaseUrl || '').trim();
            if (cached) {
                doCopy(cached);
                return;
            }
            fetch(
                typeof getPublicInstallPackagesUrl === 'function'
                    ? getPublicInstallPackagesUrl()
                    : '/api/public/install-packages',
                { credentials: 'same-origin' }
            )
                .then(function (r) {
                    return r.json();
                })
                .then(function (body) {
                    var t = '';
                    if (body && body.code === 200 && body.data && body.data.xianyu_purchase_url) {
                        t = String(body.data.xianyu_purchase_url).trim();
                    }
                    consultXianyuPurchaseUrl = t;
                    doCopy(t);
                })
                .catch(function () {
                    alert('网络错误');
                });
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

(function() {
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
        var n = document.querySelector('.bottom-nav');
        if (n) n.classList.add('ios-device');
    }
})();
