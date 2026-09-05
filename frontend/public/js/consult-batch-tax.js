/**
 * consult-batch-tax.js — 工作经历批量生成 / 粘贴导入 / 示例填写
 *
 * 角色：批量税务主流程——多段工作经历表单、示例与模板、粘贴导入、按月自定义工资、
 *       一键/确认生成与覆盖修改、年终奖单独写入；亦被管理端个税维护复用。
 * 加载页：consult.html（defer；位于 consult-core 之后、consult-records 之前）；
 *         管理端可通过 admin/loader 动态加载。
 * 依赖：consult-core（税额公式、formObject、页签、showMsg 等）；authFetch；
 *       consult-tax-edit-pay（ConsultTaxEditPay.fetchResponse / consultTaxPost，写税 402 付费墙）；
 *       可选 ConversionGuide、__adminTaxBatchCtx。
 * 鉴权：C 端 POST api/tax；管理端走 api/admin/user-tax-records（带 username）。
 */

// === API：批量写税入口（C 端 / 管理端 / 付费墙） ===
/**
 * 统一批量写税请求：C 端 /api/tax；管理端 /api/admin/user-tax-records（带 username）。
 * 优先走 ConsultTaxEditPay / consultTaxPost（402 付费墙）。
 * 副作用：HTTP 写税；可能弹付费窗。
 */
function consultTaxApiFetch(body) {
    var ctx = window.__adminTaxBatchCtx;
    if (ctx && ctx.username && typeof ctx.fetch === 'function') {
        var payload = Object.assign({}, body || {}, { username: ctx.username });
        return ctx.fetch('api/admin/user-tax-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }
    if (window.ConsultTaxEditPay && typeof window.ConsultTaxEditPay.fetchResponse === 'function') {
        return window.ConsultTaxEditPay.fetchResponse(body);
    }
    if (typeof window.consultTaxPost === 'function') {
        return window.consultTaxPost(body || {});
    }
    return window.authFetch('api/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
    });
}

// === 强提示弹框（阻塞校验） ===
/** 关闭居中强提示弹框。 */
function closeConsultStrongAlertModal() {
    var root = document.getElementById('consultStrongAlertModal');
    if (root) {
        root.classList.remove('is-open');
    }
}

/** 税务批量等阻塞校验：居中弹框，避免顶栏轻提示易被忽略 */
function friendlyConsultTaxError(raw) {
    var msg = String(raw || '').trim();
    if (!msg) return '保存失败，请稍后重试';
    if (/Duplicate entry|ER_DUP_ENTRY|PRIMARY/i.test(msg)) {
        return '部分税务记录已存在，请勿重复一键生成；可先删除旧记录或修改后再试';
    }
    if (/Bind parameters must not contain undefined/i.test(msg)) {
        return '提交数据不完整，请检查填写项后重试';
    }
    if (/ER_|SQLSTATE|mysql|ECONN/i.test(msg)) {
        return '保存失败，请稍后重试；若反复出现请联系客服';
    }
    return msg;
}

/**
 * 展示阻塞级错误提示（文案经 friendlyConsultTaxError）。
 * 副作用：开 #consultStrongAlertModal。
 */
function showConsultStrongAlert(message) {
    var body = document.getElementById('consultStrongAlertText');
    if (body) {
        body.textContent = friendlyConsultTaxError(message) || '';
    }
    var root = document.getElementById('consultStrongAlertModal');
    if (root) {
        root.classList.add('is-open');
    }
}


// === 年终奖行内编辑 ===
/** 取批量列表中最后一段非空公司名。 */
function getLastBatchEmpCompanyFromDom() {
    var rows = document.querySelectorAll('#batch_employment_list .batch-emp-row');
    var last = '';
    rows.forEach(function (row) {
        var c = row.querySelector('.batch-emp-company');
        var v = c ? String(c.value).trim() : '';
        if (v) last = v;
    });
    return last;
}

/** 从一行读取公司名/税号/机关。 */
function getBatchEmpProfileFromRow(row) {
    if (!row) return { name: '', company_tax_id: '', tax_authority: '' };
    var companyEl = row.querySelector('.batch-emp-company');
    var taxIdEl = row.querySelector('.batch-emp-company-tax-id');
    var authEl = row.querySelector('.batch-emp-tax-authority');
    return {
        name: companyEl ? String(companyEl.value || '').trim() : '',
        company_tax_id: taxIdEl ? String(taxIdEl.value || '').trim() : '',
        tax_authority: authEl ? String(authEl.value || '').trim() : ''
    };
}

function nextBatchBonusMonthSuggestion(lastMonth) {
    var m = parseInt(lastMonth, 10) || 0;
    if (m === 12) return 6;
    return 12;
}

function defaultBatchBonusYearForRow(row) {
    var ey = row ? row.querySelector('.batch-emp-ey') : null;
    var y = ey ? parseInt(ey.value, 10) : 0;
    if (y > 0) return y;
    return new Date().getFullYear();
}

function normalizeBatchBonusItem(b) {
    if (!b || typeof b !== 'object') {
        return { amount: 0, year: 0, month: 0 };
    }
    var amount = parseFloat(b.amount != null ? b.amount : b.yearEndBonus);
    if (!isFinite(amount) || amount < 0) amount = 0;
    amount = typeof round2 === 'function' ? round2(amount) : Math.round(amount * 100) / 100;
    var year = parseInt(b.year != null ? b.year : b.bonusYear, 10) || 0;
    var month = parseInt(b.month != null ? b.month : b.bonusMonth, 10) || 0;
    return { amount: amount, year: year, month: month };
}

function filledBatchEmpBonuses(bonuses) {
    return (bonuses || [])
        .map(normalizeBatchBonusItem)
        .filter(function (b) {
            return b.amount > 0;
        });
}

function employmentBonusList(emp) {
    if (!emp) return [];
    if (Array.isArray(emp.bonuses) && emp.bonuses.length) {
        return filledBatchEmpBonuses(emp.bonuses);
    }
    var list = [];
    if (emp.yearEndBonus > 0) {
        list.push({
            amount: typeof round2 === 'function' ? round2(parseFloat(emp.yearEndBonus) || 0) : parseFloat(emp.yearEndBonus) || 0,
            year: parseInt(emp.bonusYear, 10) || 0,
            month: parseInt(emp.bonusMonth, 10) || 0
        });
    }
    (emp.extraBonuses || []).forEach(function (b) {
        var n = normalizeBatchBonusItem(b);
        if (n.amount > 0) list.push(n);
    });
    return list;
}

/** 收集一行内已填年终奖项。 */
function collectBatchEmpBonusesFromRow(row) {
    if (!row) return [];
    var items = row.querySelectorAll('.batch-emp-bonus-item');
    var out = [];
    if (items.length) {
        items.forEach(function (item) {
            var amtEl = item.querySelector('.batch-emp-bonus');
            var yEl = item.querySelector('.batch-emp-bonus-year');
            var mEl = item.querySelector('.batch-emp-bonus-month');
            out.push({
                amount: amtEl ? parseFloat(amtEl.value) || 0 : 0,
                year: yEl ? parseInt(yEl.value, 10) || 0 : 0,
                month: mEl ? parseInt(mEl.value, 10) || 0 : 0
            });
        });
        return out;
    }
    var bonusEl = row.querySelector('.batch-emp-bonus');
    if (!bonusEl) return [];
    var bonusYearEl = row.querySelector('.batch-emp-bonus-year');
    var bonusMonthEl = row.querySelector('.batch-emp-bonus-month');
    out.push({
        amount: parseFloat(bonusEl.value) || 0,
        year: bonusYearEl ? parseInt(bonusYearEl.value, 10) || 0 : 0,
        month: bonusMonthEl ? parseInt(bonusMonthEl.value, 10) || 0 : 0
    });
    return out;
}

function refreshBatchEmpBonusItemTitles(row) {
    if (!row) return;
    var items = row.querySelectorAll('.batch-emp-bonus-item');
    items.forEach(function (item, i) {
        var t = item.querySelector('.batch-emp-bonus-item-title');
        if (t) t.textContent = items.length > 1 ? '年终奖 ' + (i + 1) : '年终奖';
        var rm = item.querySelector('.batch-emp-bonus-remove');
        if (rm) rm.hidden = items.length <= 1;
    });
}

function createBatchEmpBonusItemNode() {
    var tpl = document.getElementById('batchEmpBonusItemTpl');
    if (tpl && tpl.content && tpl.content.firstElementChild) {
        return tpl.content.firstElementChild.cloneNode(true);
    }
    return null;
}

function bindBatchEmpBonusItem(item) {
    if (!item || item.getAttribute('data-bonus-item-bound') === '1') return;
    item.setAttribute('data-bonus-item-bound', '1');
    bindBatchMonthInput(item.querySelector('.batch-emp-bonus-month'));
    bindBatchYearInput(item.querySelector('.batch-emp-bonus-year'));
    var rm = item.querySelector('.batch-emp-bonus-remove');
    if (rm) {
        rm.addEventListener('click', function () {
            var row = item.closest('.batch-emp-row');
            var list = row && row.querySelector('.batch-emp-bonus-list');
            if (!list) return;
            if (list.querySelectorAll('.batch-emp-bonus-item').length <= 1) {
                var amt = item.querySelector('.batch-emp-bonus');
                if (amt) amt.value = '0';
                scheduleBatchTaxDraftSave();
                syncBatchEmpBonusMetaExpanded(row);
                return;
            }
            item.remove();
            refreshBatchEmpBonusItemTitles(row);
            scheduleBatchTaxDraftSave();
            syncBatchEmpBonusMetaExpanded(row);
        });
    }
    var amt = item.querySelector('.batch-emp-bonus');
    if (amt && amt.getAttribute('data-bonus-amt-bound') !== '1') {
        amt.setAttribute('data-bonus-amt-bound', '1');
        amt.addEventListener('input', function () {
            syncBatchEmpBonusMetaExpanded(item.closest('.batch-emp-row'));
        });
    }
}

/** 向该行追加一条年终奖输入项。副作用：改 DOM。 */
function addBatchEmpBonusItem(row, preset) {
    if (!row) return null;
    var list = row.querySelector('.batch-emp-bonus-list');
    if (!list) return null;
    var node = createBatchEmpBonusItemNode();
    if (!node) return null;
    var year = defaultBatchBonusYearForRow(row);
    var month = 12;
    var amount = 0;
    var last = list.querySelector('.batch-emp-bonus-item:last-child');
    if (preset && typeof preset === 'object') {
        if (preset.year) year = parseInt(preset.year, 10) || year;
        if (preset.month) month = parseInt(preset.month, 10) || month;
        if (preset.amount != null && preset.amount !== '') amount = preset.amount;
    } else if (last) {
        var ly = last.querySelector('.batch-emp-bonus-year');
        var lm = last.querySelector('.batch-emp-bonus-month');
        var lastYear = ly ? parseInt(ly.value, 10) : 0;
        var lastMonth = lm ? parseInt(lm.value, 10) : 0;
        if (lastYear > 0) year = lastYear;
        month = nextBatchBonusMonthSuggestion(lastMonth);
    }
    var amtEl = node.querySelector('.batch-emp-bonus');
    var yEl = node.querySelector('.batch-emp-bonus-year');
    var mEl = node.querySelector('.batch-emp-bonus-month');
    if (amtEl) amtEl.value = amount === 0 || amount === '0' ? '0' : String(amount);
    if (yEl) yEl.value = String(year || new Date().getFullYear());
    if (mEl) mEl.value = String(month || 12);
    bindBatchEmpBonusItem(node);
    list.appendChild(node);
    refreshBatchEmpBonusItemTitles(row);
    return node;
}

/** 用奖金列表重建该行年终奖 UI。 */
function setBatchEmpBonusesOnRow(row, bonuses) {
    if (!row) return;
    var list = row.querySelector('.batch-emp-bonus-list');
    if (!list) return;
    list.innerHTML = '';
    var items = Array.isArray(bonuses) ? bonuses.map(normalizeBatchBonusItem) : [];
    if (!items.length) {
        items = [{ amount: 0, year: defaultBatchBonusYearForRow(row), month: 12 }];
    }
    items.forEach(function (b) {
        addBatchEmpBonusItem(row, {
            amount: b.amount,
            year: b.year || defaultBatchBonusYearForRow(row),
            month: b.month || 12
        });
    });
    syncBatchEmpBonusMetaExpanded(row);
}

function bindBatchEmpBonusList(row) {
    if (!row) return;
    var addBtn = row.querySelector('.batch-emp-bonus-add');
    if (addBtn && addBtn.getAttribute('data-bonus-add-bound') !== '1') {
        addBtn.setAttribute('data-bonus-add-bound', '1');
        addBtn.addEventListener('click', function () {
            addBatchEmpBonusItem(row);
            setBatchEmpBonusMetaExpanded(row, true);
            scheduleBatchTaxDraftSave();
        });
    }
    var soloBtn = row.querySelector('.batch-emp-bonus-solo-btn');
    if (soloBtn && soloBtn.getAttribute('data-bonus-solo-bound') !== '1') {
        soloBtn.setAttribute('data-bonus-solo-bound', '1');
        soloBtn.addEventListener('click', function () {
            setBatchEmpBonusMetaExpanded(row, true);
            batchAddYearEndBonusOnly();
        });
    }
    if (!row.querySelector('.batch-emp-bonus-item')) {
        addBatchEmpBonusItem(row);
    } else {
        row.querySelectorAll('.batch-emp-bonus-item').forEach(bindBatchEmpBonusItem);
        refreshBatchEmpBonusItemTitles(row);
    }
}

function bonusFitsBatchRowData(rowData, year, month) {
    if (!rowData) return false;
    var sy = parseInt(rowData.sy, 10);
    var sm = parseInt(rowData.sm, 10);
    var ey = parseInt(rowData.ey, 10);
    var em = parseInt(rowData.em, 10);
    var y = parseInt(year, 10);
    var m = parseInt(month, 10);
    if (!sy || !sm || !ey || !em || !y || !m) return false;
    var k = ymToKey(y, m);
    return k >= ymToKey(sy, sm) && k <= ymToKey(ey, em);
}

/** 将年终奖记录挂到对应就业段 payload。 */
function assignBonusRecordsToPayloads(payloads, bonusRecs) {
    var assigned = (payloads || []).map(function () {
        return [];
    });
    var lastIdxByCompany = {};
    (payloads || []).forEach(function (p, i) {
        var cn = String((p && p.rowData && p.rowData.company) || '').trim();
        if (cn) lastIdxByCompany[cn] = i;
    });
    (bonusRecs || []).forEach(function (br) {
        var cn = String((br && br.company_name) || '').trim();
        if (!cn) return;
        var year = parseInt(br.year, 10);
        var month = parseInt(br.month, 10);
        var amount = typeof round2 === 'function' ? round2(parseFloat(br.income) || 0) : parseFloat(br.income) || 0;
        if (!(amount > 0)) return;
        var chosen = -1;
        var i;
        for (i = 0; i < payloads.length; i++) {
            var rowCompany = String((payloads[i].rowData && payloads[i].rowData.company) || '').trim();
            if (rowCompany !== cn) continue;
            if (bonusFitsBatchRowData(payloads[i].rowData, year, month)) {
                chosen = i;
                break;
            }
        }
        if (chosen < 0 && lastIdxByCompany[cn] != null) {
            chosen = lastIdxByCompany[cn];
        }
        if (chosen >= 0) {
            assigned[chosen].push({ amount: amount, year: year, month: month });
        }
    });
    assigned.forEach(function (list) {
        list.sort(function (a, b) {
            return ymToKey(a.year, a.month) - ymToKey(b.year, b.month);
        });
    });
    return assigned;
}

/** 快照各行年终奖，供修改模式判断是否手改。 */
function collectBatchBonusSnapshot() {
    var rows = document.querySelectorAll('#batch_employment_list .batch-emp-row');
    var out = [];
    rows.forEach(function (row) {
        var prof = getBatchEmpProfileFromRow(row);
        collectBatchEmpBonusesFromRow(row).forEach(function (b) {
            out.push({
                company: prof.name,
                yearEndBonus: b.amount,
                bonusYear: b.year,
                bonusMonth: b.month
            });
        });
    });
    return out;
}


/** 生成确认框中的年终奖摘要行。 */
function buildBatchBonusConfirmText(employments) {
    var parts = [];
    (employments || []).forEach(function (emp) {
        employmentBonusList(emp).forEach(function (b) {
            parts.push(
                '\n年终奖 ' +
                    b.amount +
                    ' 元（扣缴义务人「' +
                    emp.company +
                    '」，单独计税约 ' +
                    yearEndBonusTaxSeparate(b.amount) +
                    ' 元，归属 ' +
                    b.year +
                    ' 年 ' +
                    b.month +
                    ' 月）'
            );
        });
    });
    return parts.join('') + (parts.length ? '。' : '');
}

// === 所得小类常量 / 自动去重提示 ===
var INCOME_TYPE_DEFAULT_SUBTYPES = {
    '工资薪金': '正常工资薪金',
    '劳务报酬': '一般劳务报酬',
    '稿酬': '稿酬所得',
    '特许权使用费': '特许权使用费所得',
    '经营所得': '经营所得',
    '利息、股息、红利': '利息股息红利所得',
    '财产租赁': '财产租赁所得',
    '财产转让': '财产转让所得',
    '偶然所得': '偶然所得'
};


/** 若服务端自动去重，在成功提示后追加说明。 */
function appendAutoDedupedTip(tip, data) {
    var n = data && data.auto_deduped != null ? Number(data.auto_deduped) : 0;
    if (n > 0) {
        tip += '（已自动删除同单位同月重复旧记录 ' + n + ' 条）';
    }
    return tip;
}


// === 批量表单草稿（localStorage） ===
var BATCH_COMPANY_HISTORY_KEY_V1 = 'consult_batch_company_history_v1';
var BATCH_COMPANY_HISTORY_MAX = 40;
var SINGLE_TAX_DRAFT_KEY_PREFIX = 'consult_single_tax_draft_v1_';
var _batchTaxDraftSaveTimer = null;
var _singleTaxDraftSaveTimer = null;
var _batchTaxDraftRestoring = false;
var _singleTaxDraftRestoring = false;

/** 批量表单草稿 storage key。 */
function batchTaxDraftStorageKey() {
    return BATCH_TAX_DRAFT_KEY_PREFIX + String(currentUserId());
}


function batchEmpRowInputVal(row, sel) {
    var el = row ? row.querySelector(sel) : null;
    return el ? String(el.value) : '';
}

/** 序列化单行工作经历为草稿对象。 */
function serializeBatchEmpRow(row) {
    var optionalMeta = row.querySelector('.batch-emp-optional-meta');
    var deductMeta = row.querySelector('.batch-emp-deduct-meta');
    var bonusMeta = row.querySelector('.batch-emp-bonus-meta');
    var bonuses = collectBatchEmpBonusesFromRow(row);
    var firstBonus = bonuses[0] || {};
    return {
        company: batchEmpRowInputVal(row, '.batch-emp-company'),
        company_tax_id: batchEmpRowInputVal(row, '.batch-emp-company-tax-id'),
        tax_authority: batchEmpRowInputVal(row, '.batch-emp-tax-authority'),
        sy: batchEmpRowInputVal(row, '.batch-emp-sy'),
        sm: batchEmpRowInputVal(row, '.batch-emp-sm'),
        ey: batchEmpRowInputVal(row, '.batch-emp-ey'),
        em: batchEmpRowInputVal(row, '.batch-emp-em'),
        salary: batchEmpRowInputVal(row, '.batch-emp-salary'),
        salary_max: batchEmpRowInputVal(row, '.batch-emp-salary-max'),
        ss_base: batchEmpRowInputVal(row, '.batch-emp-ss-base'),
        fund_base: batchEmpRowInputVal(row, '.batch-emp-fund-base'),
        pension_ratio: batchEmpRowInputVal(row, '.batch-emp-pension-ratio'),
        medical_ratio: batchEmpRowInputVal(row, '.batch-emp-medical-ratio'),
        unemployment_ratio: batchEmpRowInputVal(row, '.batch-emp-unemployment-ratio'),
        fund_ratio: batchEmpRowInputVal(row, '.batch-emp-fund-ratio'),
        pension: batchEmpRowInputVal(row, '.batch-emp-pension'),
        medical: batchEmpRowInputVal(row, '.batch-emp-medical'),
        unemployment: batchEmpRowInputVal(row, '.batch-emp-unemployment'),
        fund: batchEmpRowInputVal(row, '.batch-emp-fund'),
        special: batchEmpRowInputVal(row, '.batch-emp-special'),
        bonuses: bonuses,
        yearEndBonus: bonuses.length ? String(firstBonus.amount || 0) : '',
        bonusYear: firstBonus.year ? String(firstBonus.year) : '',
        bonusMonth: firstBonus.month ? String(firstBonus.month) : '',
        monthSalaryMap: row._monthSalaryMap ? JSON.parse(JSON.stringify(row._monthSalaryMap)) : {},
        monthTaxMap: row._monthTaxMap ? JSON.parse(JSON.stringify(row._monthTaxMap)) : {},
        optionalOpen: !!(optionalMeta && optionalMeta.classList.contains('is-open')),
        deductOpen: !!(deductMeta && deductMeta.classList.contains('is-open')),
        bonusOpen: !!(bonusMeta && bonusMeta.classList.contains('is-open'))
    };
}

function batchTaxDraftHasContent(draft) {
    if (!draft) {
        return false;
    }
    var rows = draft.employments || [];
    var i;
    for (i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (String(r.company || '').trim()) {
            return true;
        }
        if (String(r.salary || '').trim() || String(r.salary_max || '').trim()) {
            return true;
        }
        if (String(r.company_tax_id || '').trim() || String(r.tax_authority || '').trim()) {
            return true;
        }
        if (parseFloat(r.yearEndBonus) > 0) {
            return true;
        }
        if (
            Array.isArray(r.bonuses) &&
            r.bonuses.some(function (b) {
                return parseFloat(b && (b.amount != null ? b.amount : b.yearEndBonus)) > 0;
            })
        ) {
            return true;
        }
        if (r.monthSalaryMap && Object.keys(r.monthSalaryMap).length) {
            return true;
        }
    }
    if (draft.bonus && parseFloat(draft.bonus.yearEndBonus) > 0) {
        return true;
    }
    return false;
}

/** 序列化整份批量表单草稿；无内容返回 null。 */
function serializeBatchTaxDraft() {
    var rows = document.querySelectorAll('#batch_employment_list .batch-emp-row');
    var employments = [];
    rows.forEach(function (row) {
        employments.push(serializeBatchEmpRow(row));
    });
    return {
        v: 3,
        savedAt: Date.now(),
        employments: employments
    };
}

/** 立即写入批量草稿。副作用：localStorage。 */
function saveBatchTaxDraftNow() {
    if (_batchTaxDraftRestoring) {
        return;
    }
    try {
        var draft = serializeBatchTaxDraft();
        if (!batchTaxDraftHasContent(draft)) {
            localStorage.removeItem(batchTaxDraftStorageKey());
            return;
        }
        localStorage.setItem(batchTaxDraftStorageKey(), JSON.stringify(draft));
    } catch (eDraft) {}
}

/** 防抖保存批量草稿。 */
function scheduleBatchTaxDraftSave() {
    if (_batchTaxDraftRestoring) {
        return;
    }
    if (_batchTaxDraftSaveTimer) {
        clearTimeout(_batchTaxDraftSaveTimer);
    }
    _batchTaxDraftSaveTimer = setTimeout(saveBatchTaxDraftNow, 500);
}

/** 清除批量草稿。 */
function clearBatchTaxDraft() {
    try {
        localStorage.removeItem(batchTaxDraftStorageKey());
    } catch (eClear) {}
}

function migrateLegacyBatchBonusDraft(draft) {
    if (!draft || !draft.bonus || !Array.isArray(draft.employments) || !draft.employments.length) {
        return;
    }
    var first = draft.employments[0];
    if (parseFloat(first.yearEndBonus) > 0) {
        return;
    }
    if (parseFloat(draft.bonus.yearEndBonus) > 0) {
        first.yearEndBonus = draft.bonus.yearEndBonus;
        first.bonusYear = draft.bonus.bonusYear;
        first.bonusMonth = draft.bonus.bonusMonth;
    }
}

/**
 * 启动时恢复批量草稿到 DOM。
 * 副作用：重建行、填值。
 */
function restoreBatchTaxDraftIfAny() {
    var list = document.getElementById('batch_employment_list');
    if (!list) {
        return false;
    }
    var raw;
    try {
        raw = localStorage.getItem(batchTaxDraftStorageKey());
    } catch (eRead) {
        return false;
    }
    if (!raw) {
        return false;
    }
    var draft;
    try {
        draft = JSON.parse(raw);
    } catch (eParse) {
        return false;
    }
    if (!draft || !batchTaxDraftHasContent(draft) || !Array.isArray(draft.employments) || !draft.employments.length) {
        return false;
    }
    migrateLegacyBatchBonusDraft(draft);
    _batchTaxDraftRestoring = true;
    list.innerHTML = '';
    draft.employments.forEach(function (rowData) {
        addBatchEmpRow();
        var row = list.querySelector('.batch-emp-row:last-child');
        if (row) {
            setBatchEmpRowValues(row, rowData);
        }
    });
    _batchTaxDraftRestoring = false;
    saveBatchTaxDraftNow();
    return true;
}

/** 绑定批量区 input 与页面隐藏时的草稿保存。 */
function initBatchTaxDraftAutosave() {
    var card = document.getElementById('batchTaxCard');
    if (!card || card.getAttribute('data-draft-bound') === '1') {
        return;
    }
    card.setAttribute('data-draft-bound', '1');
    card.addEventListener('input', scheduleBatchTaxDraftSave);
    card.addEventListener('change', scheduleBatchTaxDraftSave);
    window.addEventListener('pagehide', saveBatchTaxDraftNow);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            saveBatchTaxDraftNow();
        }
    });
}


// === 公司历史档案（税号 / 机关） ===
function normalizeBatchCompanyProfile(item) {
    if (typeof item === 'string') {
        var n0 = String(item || '').trim();
        return n0 ? { name: n0, company_tax_id: '', tax_authority: '' } : null;
    }
    if (!item || typeof item !== 'object') return null;
    var name = String(item.name || item.company || '').trim();
    if (!name) return null;
    return {
        name: name,
        company_tax_id: String(item.company_tax_id != null ? item.company_tax_id : '').trim(),
        tax_authority: String(item.tax_authority != null ? item.tax_authority : '').trim()
    };
}

/** 读本地公司档案列表。 */
function loadBatchCompanyProfiles() {
    try {
        var raw = localStorage.getItem(BATCH_COMPANY_PROFILES_KEY);
        if (raw) {
            var arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
                var out = [];
                arr.forEach(function (it) {
                    var p = normalizeBatchCompanyProfile(it);
                    if (p) out.push(p);
                });
                return out;
            }
        }
        var rawV1 = localStorage.getItem(BATCH_COMPANY_HISTORY_KEY_V1);
        if (rawV1) {
            var arrV1 = JSON.parse(rawV1);
            if (Array.isArray(arrV1)) {
                return arrV1
                    .map(normalizeBatchCompanyProfile)
                    .filter(Boolean);
            }
        }
    } catch (e0) {}
    return [];
}

/** 写本地公司档案。副作用：localStorage。 */
function saveBatchCompanyProfiles(profiles) {
    try {
        localStorage.setItem(
            BATCH_COMPANY_PROFILES_KEY,
            JSON.stringify((profiles || []).slice(0, BATCH_COMPANY_HISTORY_MAX))
        );
    } catch (e0) {}
}

function loadBatchCompanyHistoryList() {
    return loadBatchCompanyProfiles().map(function (p) {
        return p.name;
    });
}


/** 按公司名查找本地档案。 */
function getBatchCompanyProfile(companyName) {
    var raw = String(companyName || '').trim();
    if (!raw) return null;
    var fuzzy = companyNameMatchKey(raw);
    var list = loadBatchCompanyProfiles();
    var fuzzyHit = null;
    for (var i = 0; i < list.length; i++) {
        if (list[i].name === raw) return list[i];
        if (fuzzy && companyNameMatchKey(list[i].name) === fuzzy) {
            fuzzyHit = fuzzyHit || list[i];
        }
    }
    return fuzzyHit;
}

/** 从已有税务记录补全本地公司档案（税号、机关） */

/**
 * 记住公司全称及纳税人识别号、主管税务机关（点选历史或生成记录时写入）。
 * 副作用：更新 localStorage 公司档案列表。
 */
function rememberBatchCompanyProfile(entry) {
    var p = normalizeBatchCompanyProfile(entry);
    if (!p) return;
    var old = getBatchCompanyProfile(p.name);
    if (old) {
        if (!p.company_tax_id && old.company_tax_id) p.company_tax_id = old.company_tax_id;
        if (!p.tax_authority && old.tax_authority) p.tax_authority = old.tax_authority;
    }
    var cur = loadBatchCompanyProfiles();
    var out = [p];
    cur.forEach(function (x) {
        if (x.name !== p.name) out.push(x);
    });
    saveBatchCompanyProfiles(out);
    refreshBatchCompanyHistoryDatalist();
}

function rememberBatchCompanyProfileFromRow(row) {
    if (!row) return;
    var companyEl = row.querySelector('.batch-emp-company');
    if (!companyEl) return;
    var name = String(companyEl.value || '').trim();
    if (!name) return;
    var taxIdEl = row.querySelector('.batch-emp-company-tax-id');
    var authEl = row.querySelector('.batch-emp-tax-authority');
    rememberBatchCompanyProfile({
        name: name,
        company_tax_id: taxIdEl ? taxIdEl.value : '',
        tax_authority: authEl ? authEl.value : ''
    });
}

/** 将历史税号/机关填入行（不覆盖已有值时按实现）。副作用：写 input。 */
function applyBatchCompanyProfileToRow(row, companyName) {
    if (!row) return;
    var name = String(companyName != null ? companyName : '').trim();
    if (!name) {
        var companyEl0 = row.querySelector('.batch-emp-company');
        name = companyEl0 ? String(companyEl0.value || '').trim() : '';
    }
    if (!name) return;
    var prof = getBatchCompanyProfile(name);
    if (!prof) return;
    if (!prof.company_tax_id && !prof.tax_authority) return;
    var taxIdEl = row.querySelector('.batch-emp-company-tax-id');
    var authEl = row.querySelector('.batch-emp-tax-authority');
    if (taxIdEl && prof.company_tax_id) setFormFieldValue(taxIdEl, prof.company_tax_id);
    if (authEl && prof.tax_authority) setFormFieldValue(authEl, prof.tax_authority);
    syncBatchEmpOptionalMetaExpanded(row);
}

function setBatchEmpOptionalMetaExpanded(row, expanded) {
    if (!row) return;
    var wrap = row.querySelector('.batch-emp-optional-meta');
    var btn = row.querySelector('.batch-emp-optional-toggle');
    if (!wrap) return;
    wrap.classList.toggle('is-open', !!expanded);
    if (btn) btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function syncBatchEmpOptionalMetaExpanded(row) {
    if (!row) return;
    var taxIdEl = row.querySelector('.batch-emp-company-tax-id');
    var authEl = row.querySelector('.batch-emp-tax-authority');
    var hasVal =
        (taxIdEl && String(taxIdEl.value || '').trim()) ||
        (authEl && String(authEl.value || '').trim());
    if (hasVal) setBatchEmpOptionalMetaExpanded(row, true);
}

function bindBatchEmpOptionalMetaToggle(row) {
    if (!row) return;
    var btn = row.querySelector('.batch-emp-optional-toggle');
    var wrap = row.querySelector('.batch-emp-optional-meta');
    if (!btn || !wrap || btn.getAttribute('data-batch-optional-bound') === '1') return;
    btn.setAttribute('data-batch-optional-bound', '1');
    btn.addEventListener('click', function () {
        var open = !wrap.classList.contains('is-open');
        setBatchEmpOptionalMetaExpanded(row, open);
        scheduleBatchTaxDraftSave();
    });
}

function setBatchEmpDeductMetaExpanded(row, expanded) {
    if (!row) return;
    var wrap = row.querySelector('.batch-emp-deduct-meta');
    var btn = row.querySelector('.batch-emp-deduct-toggle');
    if (!wrap) return;
    wrap.classList.toggle('is-open', !!expanded);
    if (btn) btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function syncBatchEmpDeductMetaExpanded(row) {
    if (!row) return;
    /* 仅当用户填了缴费基数时自动展开；默认估算金额不强制展开 */
    var ssEl = row.querySelector('.batch-emp-ss-base');
    var fundBaseEl = row.querySelector('.batch-emp-fund-base');
    var hasBase =
        (ssEl && String(ssEl.value || '').trim()) ||
        (fundBaseEl && String(fundBaseEl.value || '').trim());
    if (hasBase) {
        setBatchEmpDeductMetaExpanded(row, true);
    }
}

function bindBatchEmpDeductMetaToggle(row) {
    if (!row) return;
    var btn = row.querySelector('.batch-emp-deduct-toggle');
    var wrap = row.querySelector('.batch-emp-deduct-meta');
    if (!btn || !wrap || btn.getAttribute('data-batch-deduct-bound') === '1') return;
    btn.setAttribute('data-batch-deduct-bound', '1');
    /* 新建行默认折叠（draft 恢复会单独设 deductOpen） */
    if (!wrap.classList.contains('is-open')) {
        setBatchEmpDeductMetaExpanded(row, false);
    }
    btn.addEventListener('click', function () {
        var open = !wrap.classList.contains('is-open');
        setBatchEmpDeductMetaExpanded(row, open);
        scheduleBatchTaxDraftSave();
    });
}

function setBatchEmpBonusMetaExpanded(row, expanded) {
    if (!row) return;
    var wrap = row.querySelector('.batch-emp-bonus-meta');
    var btn = row.querySelector('.batch-emp-bonus-toggle');
    if (!wrap) return;
    wrap.classList.toggle('is-open', !!expanded);
    if (btn) btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function syncBatchEmpBonusMetaExpanded(row) {
    if (!row) return;
    var any = collectBatchEmpBonusesFromRow(row).some(function (b) {
        return isFinite(b.amount) && b.amount > 0;
    });
    if (any) {
        setBatchEmpBonusMetaExpanded(row, true);
    }
}

function bindBatchEmpBonusMetaToggle(row) {
    if (!row) return;
    var btn = row.querySelector('.batch-emp-bonus-toggle');
    var wrap = row.querySelector('.batch-emp-bonus-meta');
    if (!btn || !wrap || btn.getAttribute('data-batch-bonus-bound') === '1') return;
    btn.setAttribute('data-batch-bonus-bound', '1');
    if (!wrap.classList.contains('is-open')) {
        setBatchEmpBonusMetaExpanded(row, false);
    }
    btn.addEventListener('click', function () {
        var open = !wrap.classList.contains('is-open');
        setBatchEmpBonusMetaExpanded(row, open);
        scheduleBatchTaxDraftSave();
    });
}

/** 公司名输入失焦/变更时尝试套用档案。 */
function tryApplyBatchCompanyProfileFromInput(inputEl) {
    if (!inputEl) return;
    var row = inputEl.closest('.batch-emp-row');
    var v = String(inputEl.value || '').trim();
    if (!v || !getBatchCompanyProfile(v)) return;
    applyBatchCompanyProfileToRow(row, v);
}

/** 刷新公司名 datalist。副作用：改 DOM。 */
function refreshBatchCompanyHistoryDatalist() {
    var dl = document.getElementById('batchCompanyHistoryDatalist');
    if (!dl) return;
    dl.innerHTML = '';
    loadBatchCompanyProfiles().forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.name;
        dl.appendChild(opt);
    });
}

function rememberBatchCompanyNames(names) {
    if (!names || !names.length) return;
    names.forEach(function (s) {
        var t = String(s || '').trim();
        if (t) rememberBatchCompanyProfile({ name: t });
    });
}

function bindBatchEmpCompanyHistoryInput(inputEl) {
    if (!inputEl || inputEl.getAttribute('data-batch-history-bound') === '1') return;
    inputEl.setAttribute('data-batch-history-bound', '1');
    var row = inputEl.closest('.batch-emp-row');
    var inputApplyTimer = null;
    inputEl.addEventListener('focus', function () {
        refreshBatchCompanyHistoryDatalist();
        tryApplyBatchCompanyProfileFromInput(inputEl);
    });
    inputEl.addEventListener('input', function () {
        if (inputApplyTimer) clearTimeout(inputApplyTimer);
        inputApplyTimer = setTimeout(function () {
            tryApplyBatchCompanyProfileFromInput(inputEl);
        }, 80);
    });
    inputEl.addEventListener('change', function () {
        tryApplyBatchCompanyProfileFromInput(inputEl);
    });
    inputEl.addEventListener('blur', function () {
        tryApplyBatchCompanyProfileFromInput(inputEl);
        rememberBatchCompanyProfileFromRow(row);
    });
    tryApplyBatchCompanyProfileFromInput(inputEl);
}

function bindBatchEmpCompanyMetaInputs(row) {
    if (!row) return;
    ['.batch-emp-company-tax-id', '.batch-emp-tax-authority'].forEach(function (sel) {
        var el = row.querySelector(sel);
        if (!el || el.getAttribute('data-batch-meta-bound') === '1') return;
        el.setAttribute('data-batch-meta-bound', '1');
        el.addEventListener('blur', function () {
            rememberBatchCompanyProfileFromRow(row);
        });
    });
}

/** 初始化公司历史 datalist 与已有行绑定。 */
function initBatchCompanyHistoryUi() {
    return syncAllCompanyProfiles()
        .then(function () {
            refreshBatchCompanyHistoryDatalist();
            document.querySelectorAll('#batch_employment_list .batch-emp-company').forEach(
                bindBatchEmpCompanyHistoryInput
            );
        })
        .catch(function () {
            refreshBatchCompanyHistoryDatalist();
            document.querySelectorAll('#batch_employment_list .batch-emp-company').forEach(
                bindBatchEmpCompanyHistoryInput
            );
        });
}

// === 年月输入约束 ===
function clampBatchMonthInput(inputEl) {
    if (!inputEl) return;
    var raw = String(inputEl.value || '').trim();
    if (!raw) return;
    var v = parseInt(raw, 10);
    if (Number.isNaN(v) || v < 1) {
        inputEl.value = '1';
    } else if (v > 12) {
        inputEl.value = '12';
    }
}

function clampBatchYearInput(inputEl) {
    if (!inputEl) return;
    var raw = String(inputEl.value || '').trim();
    if (!raw) return;
    var v = parseInt(raw, 10);
    if (Number.isNaN(v)) {
        inputEl.value = '';
        return;
    }
    if (v < 1) inputEl.value = '1';
    else if (v > 9999) inputEl.value = '9999';
}

function bindBatchYmNumericInput(inputEl, opts) {
    if (!inputEl || inputEl.getAttribute('data-ym-bound') === '1') return;
    inputEl.setAttribute('data-ym-bound', '1');
    opts = opts || {};
    var min = opts.min;
    var max = opts.max;
    var maxLen = opts.maxLength;
    inputEl.addEventListener('input', function () {
        var cleaned = String(inputEl.value || '').replace(/\D/g, '');
        if (maxLen) cleaned = cleaned.slice(0, maxLen);
        if (cleaned !== inputEl.value) inputEl.value = cleaned;
    });
    function clamp() {
        var raw = String(inputEl.value || '').trim();
        if (!raw) return;
        var v = parseInt(raw, 10);
        if (Number.isNaN(v)) {
            inputEl.value = '';
            return;
        }
        if (min != null && v < min) inputEl.value = String(min);
        else if (max != null && v > max) inputEl.value = String(max);
    }
    inputEl.addEventListener('change', clamp);
    inputEl.addEventListener('blur', clamp);
}

function bindBatchMonthInput(inputEl) {
    bindBatchYmNumericInput(inputEl, { min: 1, max: 12, maxLength: 2 });
}

function bindBatchYearInput(inputEl) {
    bindBatchYmNumericInput(inputEl, { min: 1, max: 9999, maxLength: 4 });
}

// === 起止年月：友好选择器（年月两个下拉，取代四个数字框） ===
/** 打开中的选择器上下文：确认回调等；一次只开一个。 */
var _batchYmPickerCtx = null;

function batchYmPickerYearBounds(currentY) {
    var cy = new Date().getFullYear();
    var minY = cy - 12;
    var maxY = cy + 2;
    var y = parseInt(currentY, 10) || 0;
    if (y > 0) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
    }
    return { min: minY, max: maxY };
}

/** 按当前选中年份重建月份下拉（1–12），尽量保留原月份。 */
function refreshBatchYmPickerMonthOptions() {
    var monthSel = document.getElementById('batchYmPickerMonth');
    if (!monthSel) return;
    var prevM = parseInt(monthSel.value, 10) || 1;
    monthSel.innerHTML = '';
    var m;
    for (m = 1; m <= 12; m++) {
        var opt = document.createElement('option');
        opt.value = String(m);
        opt.textContent = m + '月';
        monthSel.appendChild(opt);
    }
    monthSel.value = String(prevM >= 1 && prevM <= 12 ? prevM : 1);
}

/** 首次使用时绑定选择器弹层的取消/确定/遮罩事件（单例，只绑一次）。 */
function ensureBatchYmPickerModalBound() {
    var modal = document.getElementById('batchYmPickerModal');
    if (!modal || modal.getAttribute('data-ym-picker-bound') === '1') return;
    modal.setAttribute('data-ym-picker-bound', '1');
    var mask = document.getElementById('batchYmPickerMask');
    var closeX = document.getElementById('batchYmPickerCloseX');
    var cancelBtn = document.getElementById('batchYmPickerCancel');
    var okBtn = document.getElementById('batchYmPickerOk');
    var yearSel = document.getElementById('batchYmPickerYear');
    function close() {
        modal.classList.remove('is-open');
        _batchYmPickerCtx = null;
    }
    if (mask) mask.addEventListener('click', close);
    if (closeX) closeX.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    if (yearSel) yearSel.addEventListener('change', refreshBatchYmPickerMonthOptions);
    if (okBtn) {
        okBtn.addEventListener('click', function () {
            var ctx = _batchYmPickerCtx;
            var yearSelEl = document.getElementById('batchYmPickerYear');
            var monthSelEl = document.getElementById('batchYmPickerMonth');
            var y = yearSelEl ? parseInt(yearSelEl.value, 10) : 0;
            var m = monthSelEl ? parseInt(monthSelEl.value, 10) : 0;
            close();
            if (!ctx || typeof ctx.onConfirm !== 'function' || !y || !m) return;
            ctx.onConfirm(y, m);
        });
    }
}

/**
 * 打开年月选择弹层（年/月两个下拉），确认后把结果通过 onConfirm(y, m) 回传。
 * 副作用：开 #batchYmPickerModal。
 */
function openBatchYmPicker(title, y, m, onConfirm) {
    ensureBatchYmPickerModalBound();
    var modal = document.getElementById('batchYmPickerModal');
    var titleEl = document.getElementById('batchYmPickerTitle');
    var yearSel = document.getElementById('batchYmPickerYear');
    var monthSel = document.getElementById('batchYmPickerMonth');
    if (!modal || !yearSel || !monthSel) return;
    if (titleEl) titleEl.textContent = title || '选择年月';
    var curY = parseInt(y, 10) || new Date().getFullYear();
    var bounds = batchYmPickerYearBounds(curY);
    yearSel.innerHTML = '';
    var yy;
    for (yy = bounds.min; yy <= bounds.max; yy++) {
        var opt = document.createElement('option');
        opt.value = String(yy);
        opt.textContent = yy + '年';
        if (yy === curY) opt.selected = true;
        yearSel.appendChild(opt);
    }
    refreshBatchYmPickerMonthOptions();
    var curM = parseInt(m, 10);
    if (curM >= 1 && curM <= 12) monthSel.value = String(curM);
    _batchYmPickerCtx = { onConfirm: onConfirm };
    modal.classList.add('is-open');
}

function formatBatchYm(y, m) {
    var yy = parseInt(y, 10);
    var mm = parseInt(m, 10);
    if (!yy || !mm) return '请选择';
    return yy + '年' + mm + '月';
}

/** 让隐藏的年/月输入触发既有的 input+change 监听（清理/校验/草稿保存）。 */
function dispatchBatchYmChange(inputEl) {
    if (!inputEl) return;
    try {
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (eDispatch) {}
}

/**
 * 用隐藏的 sy/sm/ey/em 值刷新一行「起始月 → 结束月」按钮上的显示文案。
 * 供示例填写 / 粘贴导入 / 回填修改 / 草稿恢复等写入新值后调用。
 */
function refreshBatchEmpPeriodDisplay(row) {
    if (!row) return;
    var startVal = row.querySelector('.batch-emp-period-start-val');
    var endVal = row.querySelector('.batch-emp-period-end-val');
    if (startVal) {
        var sy = row.querySelector('.batch-emp-sy');
        var sm = row.querySelector('.batch-emp-sm');
        startVal.textContent = formatBatchYm(sy && sy.value, sm && sm.value);
    }
    if (endVal) {
        var ey = row.querySelector('.batch-emp-ey');
        var em = row.querySelector('.batch-emp-em');
        endVal.textContent = formatBatchYm(ey && ey.value, em && em.value);
    }
}

/** 绑定一行「起始月/结束月」按钮：点击打开友好选择器并写回隐藏字段。 */
function bindBatchEmpPeriodPicker(row) {
    if (!row) return;
    var startBtn = row.querySelector('.batch-emp-period-start-btn');
    var endBtn = row.querySelector('.batch-emp-period-end-btn');
    if (startBtn && startBtn.getAttribute('data-ym-picker-bound') !== '1') {
        startBtn.setAttribute('data-ym-picker-bound', '1');
        startBtn.addEventListener('click', function () {
            var syEl = row.querySelector('.batch-emp-sy');
            var smEl = row.querySelector('.batch-emp-sm');
            openBatchYmPicker('选择起始月', syEl && syEl.value, smEl && smEl.value, function (y, m) {
                if (syEl) syEl.value = String(y);
                if (smEl) smEl.value = String(m);
                dispatchBatchYmChange(smEl || syEl);
                refreshBatchEmpPeriodDisplay(row);
            });
        });
    }
    if (endBtn && endBtn.getAttribute('data-ym-picker-bound') !== '1') {
        endBtn.setAttribute('data-ym-picker-bound', '1');
        endBtn.addEventListener('click', function () {
            var eyEl = row.querySelector('.batch-emp-ey');
            var emEl = row.querySelector('.batch-emp-em');
            openBatchYmPicker('选择结束月', eyEl && eyEl.value, emEl && emEl.value, function (y, m) {
                if (eyEl) eyEl.value = String(y);
                if (emEl) emEl.value = String(m);
                dispatchBatchYmChange(emEl || eyEl);
                refreshBatchEmpPeriodDisplay(row);
            });
        });
    }
    refreshBatchEmpPeriodDisplay(row);
}

function parseBatchRatioPct(el) {
    if (!el) return 0;
    var v = parseFloat(el.value);
    if (Number.isNaN(v) || v < 0) return 0;
    return v;
}

// === 工作经历行：三险一金 / 增删行 ===
/**
 * 按社保/公积金基数与比例写入本段三险一金月扣款。
 * 副作用：写该行扣款 input。
 */
function syncBatchEmpDeductionsFromBase(row) {
    if (!row) return;
    var ssBaseEl = row.querySelector('.batch-emp-ss-base');
    var ssTrim = ssBaseEl ? String(ssBaseEl.value).trim() : '';
    if (!ssTrim) return;
    var ssBase = parseFloat(ssTrim);
    if (Number.isNaN(ssBase) || ssBase < 0) return;

    var fundBaseEl = row.querySelector('.batch-emp-fund-base');
    var fundTrim = fundBaseEl ? String(fundBaseEl.value).trim() : '';
    var fundBase = fundTrim !== '' ? parseFloat(fundTrim) : ssBase;
    if (Number.isNaN(fundBase) || fundBase < 0) fundBase = ssBase;

    var pensionR = parseBatchRatioPct(row.querySelector('.batch-emp-pension-ratio'));
    var medicalR = parseBatchRatioPct(row.querySelector('.batch-emp-medical-ratio'));
    var unemploymentR = parseBatchRatioPct(row.querySelector('.batch-emp-unemployment-ratio'));
    var fundR = parseBatchRatioPct(row.querySelector('.batch-emp-fund-ratio'));

    var pensionEl = row.querySelector('.batch-emp-pension');
    var medicalEl = row.querySelector('.batch-emp-medical');
    var unemploymentEl = row.querySelector('.batch-emp-unemployment');
    var fundAmtEl = row.querySelector('.batch-emp-fund');
    if (pensionEl) pensionEl.value = String(round2((ssBase * pensionR) / 100));
    if (medicalEl) medicalEl.value = String(round2((ssBase * medicalR) / 100));
    if (unemploymentEl) unemploymentEl.value = String(round2((ssBase * unemploymentR) / 100));
    if (fundAmtEl) fundAmtEl.value = String(round2((fundBase * fundR) / 100));
}

function bindBatchEmpDeductionCalc(row) {
    if (!row) return;
    var triggers = [
        '.batch-emp-ss-base',
        '.batch-emp-fund-base',
        '.batch-emp-pension-ratio',
        '.batch-emp-medical-ratio',
        '.batch-emp-unemployment-ratio',
        '.batch-emp-fund-ratio'
    ];
    triggers.forEach(function (sel) {
        var el = row.querySelector(sel);
        if (!el || el.getAttribute('data-deduct-bound') === '1') return;
        el.setAttribute('data-deduct-bound', '1');
        el.addEventListener('input', function () {
            syncBatchEmpDeductionsFromBase(row);
        });
        el.addEventListener('change', function () {
            syncBatchEmpDeductionsFromBase(row);
        });
    });
}

/** 绑定单行：年月、扣除、奖金、公司历史等控件。 */
function bindBatchEmpRow(node) {
    var rm = node.querySelector('.batch-emp-remove-btn');
    if (rm) {
        rm.addEventListener('click', function () {
            removeBatchEmpRow(node);
        });
    }
    var cin = node.querySelector('.batch-emp-company');
    bindBatchEmpCompanyHistoryInput(cin);
    bindBatchEmpCompanyMetaInputs(node);
    bindBatchEmpOptionalMetaToggle(node);
    syncBatchEmpOptionalMetaExpanded(node);
    bindBatchEmpDeductMetaToggle(node);
    syncBatchEmpDeductMetaExpanded(node);
    bindBatchEmpBonusMetaToggle(node);
    bindBatchEmpBonusList(node);
    syncBatchEmpBonusMetaExpanded(node);
    bindBatchEmpDeductionCalc(node);
    syncBatchEmpDeductionsFromBase(node);
    bindBatchMonthInput(node.querySelector('.batch-emp-sm'));
    bindBatchMonthInput(node.querySelector('.batch-emp-em'));
    bindBatchYearInput(node.querySelector('.batch-emp-sy'));
    bindBatchYearInput(node.querySelector('.batch-emp-ey'));
    bindBatchEmpPeriodPicker(node);
    var msBtn = node.querySelector('.batch-emp-month-salary-btn');
    if (msBtn) {
        msBtn.addEventListener('click', function () {
            openBatchMonthSalaryModal(node);
        });
    }
    node.addEventListener('change', function () {
        updateBatchEmpMonthSalaryBadge(node);
    });
    updateBatchEmpMonthSalaryBadge(node);
}

/** 删除一行工作经历。副作用：DOM + 草稿调度。 */
function removeBatchEmpRow(row) {
    var list = document.getElementById('batch_employment_list');
    if (!row || !list) return;
    if (list.querySelectorAll('.batch-emp-row').length <= 1) {
        showConsultStrongAlert('至少保留一段工作经历');
        return;
    }
    row.remove();
    scheduleBatchTaxDraftSave();
}

/** 追加空白工作经历行并绑定。副作用：DOM。 */
function addBatchEmpRow() {
    var tpl = document.getElementById('batchEmpRowTpl');
    var list = document.getElementById('batch_employment_list');
    if (!tpl || !list || !tpl.content) return;
    var node = tpl.content.firstElementChild.cloneNode(true);
    var sm = node.querySelector('.batch-emp-sm');
    var em = node.querySelector('.batch-emp-em');
    var d = new Date();
    var cy = d.getFullYear();
    var cm = d.getMonth() + 1;
    var sy = node.querySelector('.batch-emp-sy');
    var ey = node.querySelector('.batch-emp-ey');
    if (sy) sy.value = String(cy);
    if (ey) ey.value = String(cy);
    if (sm) sm.value = '1';
    if (em) em.value = String(cm);
    /* 默认社保/公积金：基数 5000 × 比例 */
    var defBase = 5000;
    var pRatio = parseFloat(node.querySelector('.batch-emp-pension-ratio').value) || 8;
    var mRatio = parseFloat(node.querySelector('.batch-emp-medical-ratio').value) || 2;
    var uRatio = parseFloat(node.querySelector('.batch-emp-unemployment-ratio').value) || 0.5;
    var fRatio = parseFloat(node.querySelector('.batch-emp-fund-ratio').value) || 12;
    var pEl = node.querySelector('.batch-emp-pension');
    var mEl = node.querySelector('.batch-emp-medical');
    var uEl = node.querySelector('.batch-emp-unemployment');
    var fEl = node.querySelector('.batch-emp-fund');
    if (pEl) pEl.value = (defBase * pRatio / 100).toFixed(2);
    if (mEl) mEl.value = (defBase * mRatio / 100).toFixed(2);
    if (uEl) uEl.value = (defBase * uRatio / 100).toFixed(2);
    if (fEl) fEl.value = (defBase * fRatio / 100).toFixed(2);
    bindBatchEmpRow(node);
    list.appendChild(node);
    scheduleBatchTaxDraftSave();
}

/** 确保至少一行并绑定已有行。 */
function initBatchEmploymentRows() {
    var list = document.getElementById('batch_employment_list');
    if (!list || list.querySelector('.batch-emp-row')) return;
    if (restoreBatchTaxDraftIfAny()) return;
    addBatchEmpRow();
}

/**
 * 将示例或预设数据写入单段工作经历行（仅更新 data 中显式提供的字段）。
 * 副作用：写各 input / 奖金列表 / 按月工资 map。
 */
function setBatchEmpRowValues(row, data) {
    if (!row || !data) return;
    function has(k) {
        return Object.prototype.hasOwnProperty.call(data, k);
    }
    function setVal(sel, val, key) {
        if (key && !has(key)) return;
        var el = row.querySelector(sel);
        if (!el) return;
        el.value = val == null || val === '' ? '' : String(val);
    }
    setVal('.batch-emp-company', data.company, 'company');
    setVal('.batch-emp-company-tax-id', data.company_tax_id, 'company_tax_id');
    setVal('.batch-emp-tax-authority', data.tax_authority, 'tax_authority');
    setVal('.batch-emp-sy', data.sy, 'sy');
    setVal('.batch-emp-sm', data.sm, 'sm');
    setVal('.batch-emp-ey', data.ey, 'ey');
    setVal('.batch-emp-em', data.em, 'em');
    setVal('.batch-emp-salary', data.salary, 'salary');
    setVal('.batch-emp-salary-max', data.salary_max, 'salary_max');
    if (has('ss_base')) {
        var ssBaseEl = row.querySelector('.batch-emp-ss-base');
        if (ssBaseEl) {
            var ssRaw = data.ss_base;
            var ssNum = parseFloat(ssRaw);
            ssBaseEl.value =
                ssRaw == null || ssRaw === '' || (!Number.isNaN(ssNum) && ssNum === 0) ? '' : String(ssRaw);
        }
    }
    setVal('.batch-emp-fund-base', data.fund_base, 'fund_base');
    setVal('.batch-emp-pension-ratio', data.pension_ratio, 'pension_ratio');
    setVal('.batch-emp-medical-ratio', data.medical_ratio, 'medical_ratio');
    setVal('.batch-emp-unemployment-ratio', data.unemployment_ratio, 'unemployment_ratio');
    setVal('.batch-emp-fund-ratio', data.fund_ratio, 'fund_ratio');
    setVal('.batch-emp-special', data.special, 'special');
    if (has('monthSalaryMap') && data.monthSalaryMap && typeof data.monthSalaryMap === 'object') {
        row._monthSalaryMap = JSON.parse(JSON.stringify(data.monthSalaryMap));
    } else if (has('monthSalaryMap')) {
        row._monthSalaryMap = {};
    }
    if (has('monthTaxMap') && data.monthTaxMap && typeof data.monthTaxMap === 'object') {
        row._monthTaxMap = JSON.parse(JSON.stringify(data.monthTaxMap));
    } else if (has('monthTaxMap')) {
        row._monthTaxMap = {};
    }
    if (
        has('ss_base') ||
        has('fund_base') ||
        has('pension_ratio') ||
        has('medical_ratio') ||
        has('unemployment_ratio') ||
        has('fund_ratio')
    ) {
        syncBatchEmpDeductionsFromBase(row);
    }
    setVal('.batch-emp-pension', data.pension, 'pension');
    setVal('.batch-emp-medical', data.medical, 'medical');
    setVal('.batch-emp-unemployment', data.unemployment, 'unemployment');
    setVal('.batch-emp-fund', data.fund, 'fund');
    if (has('bonuses') && Array.isArray(data.bonuses)) {
        setBatchEmpBonusesOnRow(row, data.bonuses);
    } else if (
        has('yearEndBonus') ||
        has('bonus') ||
        has('extraBonuses') ||
        has('bonusYear') ||
        has('bonusMonth')
    ) {
        var legacyBonuses = [];
        var legacyAmt = data.yearEndBonus != null ? data.yearEndBonus : data.bonus;
        if (legacyAmt != null || has('bonusYear') || has('bonusMonth') || has('yearEndBonus') || has('bonus')) {
            legacyBonuses.push({
                amount: legacyAmt != null && legacyAmt !== '' ? legacyAmt : 0,
                year: data.bonusYear,
                month: data.bonusMonth
            });
        }
        if (Array.isArray(data.extraBonuses)) {
            data.extraBonuses.forEach(function (b) {
                legacyBonuses.push(b);
            });
        }
        if (legacyBonuses.length) {
            setBatchEmpBonusesOnRow(row, legacyBonuses);
        }
    }
    if (typeof data.optionalOpen === 'boolean') {
        setBatchEmpOptionalMetaExpanded(row, data.optionalOpen);
    } else if (has('company_tax_id') || has('tax_authority')) {
        syncBatchEmpOptionalMetaExpanded(row);
    }
    if (typeof data.deductOpen === 'boolean') {
        setBatchEmpDeductMetaExpanded(row, data.deductOpen);
    } else if (has('ss_base') || has('fund_base')) {
        syncBatchEmpDeductMetaExpanded(row);
    } else if (
        has('pension') ||
        has('medical') ||
        has('unemployment') ||
        has('fund') ||
        has('special')
    ) {
        /* 回填/导入带专项金额时展开，便于核对；新建默认仍折叠 */
        setBatchEmpDeductMetaExpanded(row, true);
    }
    if (typeof data.bonusOpen === 'boolean') {
        setBatchEmpBonusMetaExpanded(row, data.bonusOpen);
    } else if (
        has('bonuses') ||
        has('yearEndBonus') ||
        has('bonus') ||
        has('extraBonuses') ||
        has('bonusYear') ||
        has('bonusMonth')
    ) {
        syncBatchEmpBonusMetaExpanded(row);
    }
    updateBatchEmpMonthSalaryBadge(row);
    refreshBatchEmpPeriodDisplay(row);
}

// === 示例填写 / 场景模板 / 一键生成 ===
/** 示例填写公司池：真实风格公司名（随机抽取）；旧版含「示例」的名称仍识别以便清理 */
var BATCH_EXAMPLE_COMPANY_POOL_LEGACY = [
    '北京华示示例软件有限公司',
    '北京华示例软件有限公司',
    '示例科技有限公司',
    '上海云示例网络科技有限公司',
    '深圳创示例智能有限公司',
    '杭州数示例信息技术有限公司',
    '成都汇示例商贸有限公司',
    '广州联示例电子有限公司',
    '南京智示例软件有限公司'
];
var BATCH_EXAMPLE_COMPANY_POOL = [
    {
        company: '北京中关村科创信息技术有限公司',
        company_tax_id: '91110108MA01KCT8XR',
        tax_authority: '国家税务总局北京市海淀区税务局'
    },
    {
        company: '上海浦东智联网络科技有限公司',
        company_tax_id: '91310000MA1FL2N67P',
        tax_authority: '国家税务总局上海市浦东新区税务局'
    },
    {
        company: '深圳市南山云创软件有限公司',
        company_tax_id: '91440300MA5F9K2H3R',
        tax_authority: '国家税务总局深圳市南山区税务局'
    },
    {
        company: '杭州西湖数据服务有限公司',
        company_tax_id: '91330106MA2B8C7D5E',
        tax_authority: '国家税务总局杭州市西湖区税务局'
    },
    {
        company: '广州市天河汇通商贸有限公司',
        company_tax_id: '91440106MA9P4Q2R8S',
        tax_authority: '国家税务总局广州市天河区税务局'
    },
    {
        company: '成都高新区瑞达实业有限公司',
        company_tax_id: '91510100MA6K5L8M2N',
        tax_authority: '国家税务总局成都高新技术产业开发区税务局'
    },
    {
        company: '南京鼓楼博雅咨询有限公司',
        company_tax_id: '91320106MA7T3U9V1W',
        tax_authority: '国家税务总局南京市鼓楼区税务局'
    },
    {
        company: '武汉东湖光谷光电技术有限公司',
        company_tax_id: '91420100MA4K6L7M9P',
        tax_authority: '国家税务总局武汉东湖新技术开发区税务局'
    },
    {
        company: '苏州工业园区精工电子有限公司',
        company_tax_id: '91320594MA1Y2B3C5D',
        tax_authority: '国家税务总局苏州工业园区税务局'
    },
    {
        company: '重庆渝北远航物流有限公司',
        company_tax_id: '91500112MA5U8V2W4X',
        tax_authority: '国家税务总局重庆市渝北区税务局'
    },
    {
        company: '天津滨海海河贸易有限公司',
        company_tax_id: '91120116MA06N8P3QR',
        tax_authority: '国家税务总局天津经济技术开发区税务局'
    },
    {
        company: '西安高新区丝路网络有限公司',
        company_tax_id: '91610131MA6T2U5V7W',
        tax_authority: '国家税务总局西安高新技术产业开发区税务局'
    },
    {
        company: '长沙岳麓湘江科技有限公司',
        company_tax_id: '91430104MA4L9M2N6P',
        tax_authority: '国家税务总局长沙市岳麓区税务局'
    },
    {
        company: '青岛市南远洋航运有限公司',
        company_tax_id: '91370202MA3C5D8E1F',
        tax_authority: '国家税务总局青岛市市南区税务局'
    },
    {
        company: '郑州金水中原商贸有限公司',
        company_tax_id: '91410105MA9K2L4M7N',
        tax_authority: '国家税务总局郑州市金水区税务局'
    },
    {
        company: '合肥高新区庐州信息技术有限公司',
        company_tax_id: '91340100MA2N8P5Q3R',
        tax_authority: '国家税务总局合肥高新技术产业开发区税务局'
    }
];
var BATCH_EXAMPLE_COMPANY_NAMES = BATCH_EXAMPLE_COMPANY_POOL.map(function (x) {
    return x.company;
}).concat(BATCH_EXAMPLE_COMPANY_POOL_LEGACY);

function isBatchExampleCompanyName(name) {
    var n = String(name || '').trim();
    if (!n) return false;
    if (BATCH_EXAMPLE_COMPANY_NAMES.indexOf(n) >= 0) return true;
    return n.indexOf('示例') >= 0;
}

/** 优先从用户任职/历史公司随机取；没有则用内置真实风格公司池 */
function collectUserCompanyOrgsForExample() {
    var out = [];
    var seen = {};
    function push(company, taxId, authority) {
        var n = String(company || '').trim();
        if (!n || seen[n]) return;
        if (n.indexOf('示例') >= 0) return;
        seen[n] = true;
        out.push({
            company: n,
            company_tax_id: String(taxId != null ? taxId : '').trim(),
            tax_authority: String(authority != null ? authority : '').trim()
        });
    }
    try {
        var employers = window.__consultEmployersCache || [];
        var ei;
        for (ei = 0; ei < employers.length; ei++) {
            var e = employers[ei] || {};
            push(e.company_name || e.company, e.credit_code || e.company_tax_id, e.tax_authority);
        }
    } catch (eEmp) {}
    try {
        var profiles = loadBatchCompanyProfiles();
        var pi;
        for (pi = 0; pi < profiles.length; pi++) {
            var p = profiles[pi] || {};
            push(p.name, p.company_tax_id, p.tax_authority);
        }
    } catch (eProf) {}
    try {
        var records = window.__consultRecordsCache || [];
        var ri;
        for (ri = 0; ri < records.length; ri++) {
            var r = records[ri] || {};
            push(r.company_name, r.company_tax_id, r.tax_authority);
        }
    } catch (eRec) {}
    return out;
}

function pickRandomBatchExampleOrg() {
    var userOrgs = collectUserCompanyOrgsForExample();
    if (userOrgs.length) {
        return userOrgs[Math.floor(Math.random() * userOrgs.length)];
    }
    var pool = BATCH_EXAMPLE_COMPANY_POOL;
    return pool[Math.floor(Math.random() * pool.length)];
}

/** 随机月薪：常见档位；约半数再给上限形成区间 */
function pickRandomBatchExampleSalary() {
    var bases = [8000, 9000, 10000, 12000, 13000, 15000, 16000, 18000, 20000, 22000, 25000, 28000, 30000];
    var salary = bases[Math.floor(Math.random() * bases.length)];
    var salaryMax = '';
    if (Math.random() < 0.55) {
        var bumps = [1500, 2000, 3000, 4000, 5000, 6000, 8000];
        salaryMax = String(salary + bumps[Math.floor(Math.random() * bumps.length)]);
    }
    return { salary: salary, salary_max: salaryMax };
}

function pickRandomBatchExampleSpecial() {
    var opts = [0, 1000, 1500, 2000, 2500, 3000];
    return opts[Math.floor(Math.random() * opts.length)];
}

function batchEmploymentsIncludeOwnCompany(employments) {
    var i;
    for (i = 0; i < employments.length; i++) {
        var co = String(employments[i].company || '').trim();
        if (co && !isBatchExampleCompanyName(co)) {
            return true;
        }
    }
    return false;
}

/** 表单中同时存在示例行与真实公司时，移除示例工作经历行 */
function removeBatchExampleEmpRowsFromDomIfOwnPresent() {
    var list = document.getElementById('batch_employment_list');
    if (!list) {
        return false;
    }
    var rows = list.querySelectorAll('.batch-emp-row');
    var hasOwn = false;
    var ri;
    for (ri = 0; ri < rows.length; ri++) {
        var coEl = rows[ri].querySelector('.batch-emp-company');
        var co = coEl ? String(coEl.value || '').trim() : '';
        if (co && !isBatchExampleCompanyName(co)) {
            hasOwn = true;
            break;
        }
    }
    if (!hasOwn) {
        return false;
    }
    var removed = false;
    for (ri = rows.length - 1; ri >= 0; ri--) {
        var coEl2 = rows[ri].querySelector('.batch-emp-company');
        var co2 = coEl2 ? String(coEl2.value || '').trim() : '';
        if (isBatchExampleCompanyName(co2)) {
            rows[ri].parentNode.removeChild(rows[ri]);
            removed = true;
        }
    }
    return removed;
}

function filterBatchExampleEmploymentsIfOwnPresent(employments) {
    if (!batchEmploymentsIncludeOwnCompany(employments)) {
        return employments;
    }
    return employments.filter(function (e) {
        return !isBatchExampleCompanyName(e.company);
    });
}

/** 计划删除此前示例公司产生的旧记录。 */
function planBatchExampleRecordDeletion(employments, existingList) {
    if (!batchEmploymentsIncludeOwnCompany(employments)) {
        return { companies: [], count: 0 };
    }
    var currentNames = {};
    employments.forEach(function (e) {
        var n = String(e.company || '').trim();
        if (n) {
            currentNames[n] = true;
        }
    });
    var toDelete = {};
    var count = 0;
    (existingList || []).forEach(function (r) {
        var name = String(r.company_name || '').trim();
        if (isBatchExampleCompanyName(name) && !currentNames[name]) {
            toDelete[name] = true;
            count++;
        }
    });
    return { companies: Object.keys(toDelete), count: count };
}

/** 按公司名删除示例税务记录。副作用：API。 */
function deleteBatchExampleTaxRecordsPromise(companies) {
    if (!companies || !companies.length) {
        return Promise.resolve(0);
    }
    return Promise.all(
        companies.map(function (company) {
            return consultTaxApiFetch({
                action: 'delete_records_by_company',
                company_name: company
            })
                .then(function (r) {
                    return (window.authParseJson||function(r){return r.json();})(r);
                })
                .then(function (data) {
                    if (data.code !== 200) {
                        throw new Error(data.msg || '删除示例记录失败');
                    }
                    return data.data && data.data.deleted != null ? Number(data.data.deleted) : 0;
                });
        })
    ).then(function (counts) {
        var total = 0;
        var ci;
        for (ci = 0; ci < counts.length; ci++) {
            total += counts[ci];
        }
        return total;
    });
}

/** 提交前解析 DOM，并过滤「自有公司 + 示例行」冲突。 */
function prepareBatchAddEmploymentsFromDom() {
    removeBatchExampleEmpRowsFromDomIfOwnPresent();
    var parsed = parseBatchEmploymentsFromDom();
    if (!parsed.ok) {
        return parsed;
    }
    var employments = filterBatchExampleEmploymentsIfOwnPresent(parsed.employments);
    if (!employments.length) {
        return {
            ok: false,
            employments: [],
            error: '请至少填写一段您本人的工作经历（已忽略示例公司行）'
        };
    }
    var ei;
    for (ei = 0; ei < employments.length; ei++) {
        employments[ei].empIdx = ei;
    }
    return { ok: true, employments: employments };
}

/**
 * 示例填写：一段完整公司工作经历（不自动提交；公司名与月薪每次随机）。
 * 副作用：改批量 DOM；可能移除冲突示例行。
 */
function fillBatchTaxExample(opts) {
    var list = document.getElementById('batch_employment_list');
    if (!list) return;
    showBatchTaxManualForm({ scroll: false });
    var d = new Date();
    var cy = d.getFullYear();
    var cm = d.getMonth() + 1;
    var org = pickRandomBatchExampleOrg();
    var sal = pickRandomBatchExampleSalary();
    list.innerHTML = '';
    addBatchEmpRow();
    var row = list.querySelector('.batch-emp-row');
    setBatchEmpRowValues(row, {
        company: org.company,
        company_tax_id: org.company_tax_id,
        tax_authority: org.tax_authority,
        sy: cy,
        sm: 1,
        ey: cy,
        em: cm,
        salary: sal.salary,
        salary_max: sal.salary_max,
        ss_base: '',
        fund_base: '',
        pension_ratio: 8,
        medical_ratio: 2,
        unemployment_ratio: 0.5,
        fund_ratio: 12,
        special: pickRandomBatchExampleSpecial()
    });
    var card = document.getElementById('batchTaxCard');
    if (card) {
        try {
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (eScroll) {
            card.scrollIntoView(true);
        }
    }
    if (!opts || !opts.silent) {
        showMsg('已填入示例工作经历，请核对后点击「一键生成税务记录」', true);
    }
    exitBatchTaxEditMode();
}

/**
 * 分步降负：仅公司 + 当月一条工资（单月）。
 * 副作用：改批量 DOM。
 */
function fillBatchTaxQuickMinimal() {
    var list = document.getElementById('batch_employment_list');
    if (!list) return;
    window.__batchTaxUserExpanded = true;
    setBatchTaxCardCollapsed(false);
    var d = new Date();
    var cy = d.getFullYear();
    var cm = d.getMonth() + 1;
    var org = pickRandomBatchExampleOrg();
    var sal = pickRandomBatchExampleSalary();
    list.innerHTML = '';
    addBatchEmpRow();
    var row = list.querySelector('.batch-emp-row');
    setBatchEmpRowValues(row, {
        company: org.company,
        company_tax_id: org.company_tax_id,
        tax_authority: org.tax_authority,
        sy: cy,
        sm: cm,
        ey: cy,
        em: cm,
        salary: sal.salary,
        salary_max: sal.salary_max,
        ss_base: '',
        fund_base: '',
        pension_ratio: 8,
        medical_ratio: 2,
        unemployment_ratio: 0.5,
        fund_ratio: 12,
        special: 0
    });
    exitBatchTaxEditMode();
}

/**
 * 场景模板：上班族 1 家公司、当年 1 月至当前月。
 * 副作用：改批量 DOM；silent 时少提示。
 */
function fillBatchTaxOfficeWorkerTemplate(silent) {
    var list = document.getElementById('batch_employment_list');
    if (!list) return;
    var d = new Date();
    var cy = d.getFullYear();
    var cm = d.getMonth() + 1;
    var org = pickRandomBatchExampleOrg();
    var sal = pickRandomBatchExampleSalary();
    list.innerHTML = '';
    addBatchEmpRow();
    var row = list.querySelector('.batch-emp-row');
    setBatchEmpRowValues(row, {
        company: org.company,
        company_tax_id: org.company_tax_id,
        tax_authority: org.tax_authority,
        sy: cy,
        sm: 1,
        ey: cy,
        em: cm,
        salary: sal.salary,
        salary_max: sal.salary_max,
        ss_base: '',
        fund_base: '',
        pension_ratio: 8,
        medical_ratio: 2,
        unemployment_ratio: 0.5,
        fund_ratio: 12,
        special: pickRandomBatchExampleSpecial()
    });
    var card = document.getElementById('batchTaxCard');
    if (card) {
        try {
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (eScroll) {
            card.scrollIntoView(true);
        }
    }
    if (!silent) {
        showMsg('已填入上班族一年模板（' + cy + '年1–' + cm + '月），核对后点击「一键生成税务记录」', true);
    }
    exitBatchTaxEditMode();
}

/**
 * 工具栏：无有效工作经历时先填上班族模板，再提交生成。
 * 副作用：可能填表 + 调用 batchAddEmploymentTaxRecords。
 */
function oneClickGenerateBatchTaxRecords() {
    var parsed = parseBatchEmploymentsFromDom();
    if (!parsed.ok) {
        fillBatchTaxOfficeWorkerTemplate(true);
    }
    batchAddEmploymentTaxRecords();
}

/** 按 AB/实验标记调整批量区 UI（若有）。 */
function applyConsultBatchAbUi() {
    if (!window.ConversionGuide || typeof window.ConversionGuide.getBatchExampleProminent !== 'function') return;
    if (!window.ConversionGuide.getBatchExampleProminent()) return;
    var quick = document.getElementById('btnBatchTaxQuickStart');
    var hint = document.getElementById('batchTaxCardHint');
    if (quick) quick.style.display = '';
    if (hint) {
        hint.innerHTML = '首次使用可点<strong>「30秒体验完整明细」</strong>快速填示例生成。';
    }
}

// === 批量修改模式（从已有回填） ===
/** 批量修改模式：回填时记录将被覆盖的已有记录 id */
var batchTaxEditMode = null;

function isBatchSalaryRecord(r) {
    var sub = String(r.income_subtype || '').trim();
    var typ = String(r.income_type || '').trim();
    if (sub.indexOf('全年一次性') >= 0 || sub.indexOf('年终奖') >= 0) {
        return false;
    }
    if (sub.indexOf('正常工资') >= 0) {
        return true;
    }
    return typ === '工资薪金' && sub.indexOf('奖金') < 0;
}

function isBatchBonusRecord(r) {
    return String(r.income_subtype || '').indexOf('全年一次性') >= 0;
}

function recordYmKey(r) {
    return ymToKey(parseInt(r.year, 10), parseInt(r.month, 10));
}

function splitCompanyRecordsIntoSegments(recs) {
    var sorted = recs.slice().sort(function (a, b) {
        return recordYmKey(a) - recordYmKey(b);
    });
    var segments = [];
    var current = [];
    var i;
    for (i = 0; i < sorted.length; i++) {
        if (!current.length) {
            current.push(sorted[i]);
            continue;
        }
        var last = current[current.length - 1];
        var gap = recordYmKey(sorted[i]) - recordYmKey(last);
        if (gap > 1) {
            segments.push(current);
            current = [sorted[i]];
        } else {
            current.push(sorted[i]);
        }
    }
    if (current.length) {
        segments.push(current);
    }
    return segments;
}

function inferBatchSsBaseFromDeductions(pension, medical, unemployment, fund) {
    var p = Number(pension) || 0;
    var m = Number(medical) || 0;
    var u = Number(unemployment) || 0;
    var f = Number(fund) || 0;
    if (p <= 0 && m <= 0 && u <= 0 && f <= 0) {
        return { ss_base: '', fund_base: '', pension_ratio: 8, medical_ratio: 2, unemployment_ratio: 0.5, fund_ratio: 12 };
    }
    var ssBase = 0;
    if (p > 0) {
        ssBase = round2(p / 0.08);
    } else if (m > 0) {
        ssBase = round2(m / 0.02);
    } else if (u > 0) {
        ssBase = round2(u / 0.005);
    }
    var fundBase = f > 0 && ssBase > 0 ? ssBase : ssBase;
    function ratioPct(amt, base, fallback) {
        if (!(base > 0) || !(amt > 0)) {
            return fallback;
        }
        return round2((amt / base) * 100);
    }
    return {
        ss_base: ssBase,
        fund_base: f > 0 ? fundBase : '',
        pension_ratio: ratioPct(p, ssBase, 8),
        medical_ratio: ratioPct(m, ssBase, 2),
        unemployment_ratio: ratioPct(u, ssBase, 0.5),
        fund_ratio: ratioPct(f, fundBase || ssBase, 12)
    };
}

function segmentToBatchRowPayload(seg) {
    var first = seg[0];
    var last = seg[seg.length - 1];
    var salaries = seg.map(function (r) {
        return parseFloat(r.income) || 0;
    });
    var minSal = salaries[0];
    var maxSal = salaries[0];
    var si;
    for (si = 1; si < salaries.length; si++) {
        if (salaries[si] < minSal) minSal = salaries[si];
        if (salaries[si] > maxSal) maxSal = salaries[si];
    }
    minSal = round2(minSal);
    maxSal = round2(maxSal);
    var allSame = minSal === maxSal;
    var overrides = {};
    if (!allSame) {
        seg.forEach(function (r) {
            var mk = parseInt(r.year, 10) + '-' + pad2(parseInt(r.month, 10));
            overrides[mk] = round2(parseFloat(r.income) || 0);
        });
    }
    var pension = parseFloat(first.pension_insurance) || 0;
    var medical = parseFloat(first.medical_insurance) || 0;
    var unemployment = parseFloat(first.unemployment_insurance) || 0;
    var fund = parseFloat(first.housing_fund) || 0;
    var special = parseFloat(first.other_deduction) || 0;
    seg.forEach(function (r) {
        var o = parseFloat(r.other_deduction) || 0;
        if (o > special) {
            special = o;
        }
    });
    var ded = inferBatchSsBaseFromDeductions(pension, medical, unemployment, fund);
    var company = String(first.company_name || '').trim();
    var companyTaxId = first.company_tax_id != null ? String(first.company_tax_id).trim() : '';
    var taxAuthority = first.tax_authority != null ? String(first.tax_authority).trim() : '';
    return {
        rowData: {
            company: company,
            company_tax_id: companyTaxId,
            tax_authority: taxAuthority,
            sy: parseInt(first.year, 10),
            sm: parseInt(first.month, 10),
            ey: parseInt(last.year, 10),
            em: parseInt(last.month, 10),
            salary: minSal,
            salary_max: '',
            ss_base: ded.ss_base,
            fund_base: ded.fund_base,
            pension_ratio: ded.pension_ratio,
            medical_ratio: ded.medical_ratio,
            unemployment_ratio: ded.unemployment_ratio,
            fund_ratio: ded.fund_ratio,
            special: round2(special),
            optionalOpen: !!(companyTaxId || taxAuthority),
            deductOpen: pension > 0 || medical > 0 || unemployment > 0 || fund > 0 || ded.ss_base > 0
        },
        overrides: overrides,
        amounts: { pension: pension, medical: medical, unemployment: unemployment, fund: fund },
        recordIds: seg.map(function (r) {
            return String(r.id);
        })
    };
}

/**
 * 进入批量修改模式，记录将覆盖的旧记录 id。
 * 副作用：写 batchTaxEditMode、更新卡片 UI。
 */
function enterBatchTaxEditMode(scopeIds, opts) {
    opts = opts || {};
    var ids = [];
    var seen = {};
    (scopeIds || []).forEach(function (id) {
        var s = String(id || '').trim();
        if (!s || seen[s]) {
            return;
        }
        seen[s] = true;
        ids.push(s);
    });
    batchTaxEditMode = {
        scopeIds: ids,
        bonusSnapshot: opts.bonusSnapshot || null,
        bonusRecordIds: (opts.bonusRecordIds || []).map(function (id) {
            return String(id);
        })
    };
    updateBatchTaxCardUi();
}

/** 退出批量修改模式并刷新卡片 UI。 */
function exitBatchTaxEditMode() {
    batchTaxEditMode = null;
    updateBatchTaxCardUi();
}

/** 按是否修改模式切换主按钮文案与更多菜单。副作用：DOM。 */
function updateBatchTaxCardUi() {
    var inEdit = !!(batchTaxEditMode && batchTaxEditMode.scopeIds && batchTaxEditMode.scopeIds.length);
    var card = document.getElementById('batchTaxCard');
    var title = document.getElementById('batchTaxCardTitle');
    var hint = document.getElementById('batchTaxCardHint');
    var banner = document.getElementById('batchEditModeBanner');
    var addBtn = document.getElementById('batch_submit_employments_btn');
    var updBtn = document.getElementById('batch_update_employments_btn');
    var exitBtn = document.getElementById('batch_exit_edit_btn');
    if (card) {
        card.classList.toggle('is-edit-mode', inEdit);
    }
    if (title) {
        title.textContent = inEdit ? '修改税务记录' : '生成税务记录';
    }
    if (hint) {
        hint.textContent = inEdit
            ? '已载入 ' +
              batchTaxEditMode.scopeIds.length +
              ' 条月薪记录。修改后点「保存覆盖」将替换原记录；未改动的年终奖默认保留。'
            : '填公司、起止月、月薪，点「一键生成」；其余选项按需展开。';
    }
    if (banner) {
        if (inEdit) {
            banner.hidden = false;
            var bonusKeepNote =
                batchTaxEditMode.bonusRecordIds && batchTaxEditMode.bonusRecordIds.length
                    ? '已有 ' + batchTaxEditMode.bonusRecordIds.length + ' 条年终奖将保留不变（除非您修改对应工作经历中的年终奖字段）。'
                    : '未检测到年终奖记录；仅当您在某段工作经历中填写年终奖时才会新增。';
            banner.textContent =
                '正在修改已有数据：将覆盖回填关联的 ' +
                batchTaxEditMode.scopeIds.length +
                ' 条月薪记录。可增删工作经历行、改月薪与社保；未回填的其他记录不受影响。' +
                bonusKeepNote;
        } else {
            banner.hidden = true;
            banner.textContent = '';
        }
    }
    if (addBtn) {
        addBtn.style.display = inEdit ? 'none' : '';
    }
    if (updBtn) {
        updBtn.style.display = inEdit ? '' : 'none';
        updBtn.textContent = '保存覆盖';
    }
    if (exitBtn) {
        exitBtn.style.display = inEdit ? '' : 'none';
    }
    if (inEdit) {
        setBatchTaxCardCollapsed(false);
    }
    syncBatchTaxEmptyState();
}

// === 工具栏 UI / 空态 / 起步路径 ===
function closeBatchTaxMoreMenu() {
    var menu = document.getElementById('batchTaxMoreMenu');
    var btn = document.getElementById('btnBatchTaxMore');
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function closeTaxRecordsManageMenu() {
    var menu = document.getElementById('taxRecordsManageMenu');
    var btn = document.getElementById('btnTaxRecordsManage');
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
}

function setBatchTaxCardCollapsed(collapsed) {
    var card = document.getElementById('batchTaxCard');
    var btn = document.getElementById('batchTaxCollapseBtn');
    if (!card) return;
    card.classList.toggle('is-collapsed', !!collapsed);
    if (btn) {
        btn.hidden = false;
        btn.textContent = collapsed ? '展开添加' : '收起';
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }
}

/** C 端有三入口；管理端 / 旧 DOM 无 #taxStartChooser，须始终可操作表单 */
function hasTaxStartChooser() {
    return !!document.getElementById('taxStartChooser');
}

/** 显示手动批量表单（隐藏起步选择器）。 */
function showBatchTaxManualForm(opts) {
    opts = opts || {};
    var chooser = document.getElementById('taxStartChooser');
    var formSec = document.getElementById('batchTaxFormSection');
    if (chooser) chooser.hidden = true;
    if (formSec) formSec.hidden = false;
    window.__batchTaxFormVisible = true;
    window.__batchTaxUserExpanded = true;
    setBatchTaxCardCollapsed(false);
    if (opts.scroll !== false) {
        scrollToBatchTaxCard();
    }
}

/** 显示税务起步三入口（有 #taxStartChooser 时）。 */
function showTaxStartChooser(opts) {
    opts = opts || {};
    /* 管理端等无三入口 DOM：禁止藏表单 */
    if (!hasTaxStartChooser()) {
        showBatchTaxManualForm({ scroll: opts.scroll === true ? true : false });
        return;
    }
    var chooser = document.getElementById('taxStartChooser');
    var formSec = document.getElementById('batchTaxFormSection');
    var inEdit = !!(batchTaxEditMode && batchTaxEditMode.scopeIds && batchTaxEditMode.scopeIds.length);
    if (inEdit) {
        showBatchTaxManualForm({ scroll: opts.scroll });
        return;
    }
    if (chooser) chooser.hidden = false;
    if (formSec) formSec.hidden = true;
    window.__batchTaxFormVisible = false;
    setBatchTaxCardCollapsed(false);
    var collapseBtn = document.getElementById('batchTaxCollapseBtn');
    if (collapseBtn) collapseBtn.hidden = true;
    if (opts.scroll) {
        scrollToBatchTaxCard();
    }
}

/** 示例路径：填示例并触发一键生成。 */
function startExampleAndGenerate() {
    if (typeof fillBatchTaxExample === 'function') {
        fillBatchTaxExample({ silent: true });
    }
    window.__taxExampleOneClick = true;
    if (typeof batchAddEmploymentTaxRecords === 'function') {
        batchAddEmploymentTaxRecords();
    }
}

/** 起步路径分发：example / paste / manual 等。 */
function openTaxStartPath(path) {
    var p = String(path || '').trim();
    if (p === 'chooser') {
        showTaxStartChooser({ scroll: true });
        return;
    }
    if (p === 'paste') {
        if (typeof openTaxPasteImportModal === 'function') {
            openTaxPasteImportModal();
        }
        return;
    }
    showBatchTaxManualForm({ scroll: true });
    if (p === 'example') {
        startExampleAndGenerate();
    }
}

/**
 * 按是否已有记录切换空态/表单显示。
 * 副作用：多块 DOM hidden/class。
 */
function syncBatchTaxEmptyState() {
    var empty = document.getElementById('batchTaxEmptyState');
    var chooser = document.getElementById('taxStartChooser');
    var formSec = document.getElementById('batchTaxFormSection');
    var collapseBtn = document.getElementById('batchTaxCollapseBtn');
    var list = window.__consultRecordsCache;
    var hasRecords = Array.isArray(list) && list.length > 0;
    var inEdit = !!(batchTaxEditMode && batchTaxEditMode.scopeIds && batchTaxEditMode.scopeIds.length);
    var hasChooser = hasTaxStartChooser();
    if (empty) {
        empty.hidden = true;
    }
    if (inEdit) {
        showBatchTaxManualForm({ scroll: false });
        if (collapseBtn) collapseBtn.hidden = false;
        return;
    }
    /* 管理端 / 旧 DOM：无三入口时始终可填表；有记录时仍可折叠卡片 */
    if (!hasChooser) {
        if (formSec) formSec.hidden = false;
        window.__batchTaxFormVisible = true;
        if (hasRecords) {
            if (collapseBtn) collapseBtn.hidden = false;
            if (!window.__batchTaxUserExpanded) {
                setBatchTaxCardCollapsed(true);
            } else {
                setBatchTaxCardCollapsed(false);
            }
        } else {
            if (collapseBtn) collapseBtn.hidden = true;
            setBatchTaxCardCollapsed(false);
        }
        return;
    }
    if (hasRecords) {
        if (collapseBtn) collapseBtn.hidden = false;
        if (!window.__batchTaxUserExpanded) {
            setBatchTaxCardCollapsed(true);
            if (chooser) chooser.hidden = true;
            if (formSec) formSec.hidden = true;
            window.__batchTaxFormVisible = false;
        } else if (window.__batchTaxFormVisible) {
            if (chooser) chooser.hidden = true;
            if (formSec) formSec.hidden = false;
            setBatchTaxCardCollapsed(false);
        } else {
            showTaxStartChooser({ scroll: false });
            if (collapseBtn) collapseBtn.hidden = false;
            setBatchTaxCardCollapsed(false);
        }
        return;
    }
    /* 无记录：默认三入口，不铺开整表 */
    if (!window.__batchTaxFormVisible) {
        showTaxStartChooser({ scroll: false });
    } else {
        if (chooser) chooser.hidden = true;
        if (formSec) formSec.hidden = false;
        setBatchTaxCardCollapsed(false);
        if (collapseBtn) collapseBtn.hidden = true;
    }
}

function scrollToTaxRecordsList() {
    var el =
        document.getElementById('taxRecordsListCard') ||
        document.getElementById('recordListMount') ||
        document.getElementById('taxEditListMount');
    if (!el) return;
    try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e0) {
        el.scrollIntoView(true);
    }
}

/** 写入成功后滚动列表等收尾。 */
function afterBatchTaxWriteSuccess() {
    window.__batchTaxUserExpanded = false;
    syncBatchTaxEmptyState();
    setTimeout(scrollToTaxRecordsList, 120);
}

/**
 * 调用 ConversionGuide.afterTaxRecordsCreated（async 注入未就绪时短重试）。
 * 副作用：可能弹转化成功引导。
 */
function invokeAfterTaxRecordsCreated(opts) {
    var tries = 0;
    function run() {
        if (
            window.ConversionGuide &&
            typeof window.ConversionGuide.afterTaxRecordsCreated === 'function'
        ) {
            window.ConversionGuide.afterTaxRecordsCreated(opts || {});
            return true;
        }
        return false;
    }
    if (run()) return;
    var timer = setInterval(function () {
        tries += 1;
        if (run() || tries >= 50) {
            clearInterval(timer);
        }
    }, 100);
}

/** 绑定税务区更多菜单、起步入口、管理菜单等 UX。 */
function initConsultRecordsUx() {
    var moreBtn = document.getElementById('btnBatchTaxMore');
    var moreMenu = document.getElementById('batchTaxMoreMenu');
    if (moreBtn && moreMenu && !moreBtn.__bound) {
        moreBtn.__bound = true;
        moreMenu.addEventListener('click', function (e) {
            e.stopPropagation();
        });
        moreBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            closeTaxRecordsManageMenu();
            var open = moreMenu.hidden;
            moreMenu.hidden = !open;
            moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }
    var manageBtn = document.getElementById('btnTaxRecordsManage');
    var manageMenu = document.getElementById('taxRecordsManageMenu');
    if (manageBtn && manageMenu && !manageBtn.__bound) {
        manageBtn.__bound = true;
        manageMenu.addEventListener('click', function (e) {
            e.stopPropagation();
        });
        manageBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            closeBatchTaxMoreMenu();
            var open = manageMenu.hidden;
            manageMenu.hidden = !open;
            manageBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }
    var collapseBtn = document.getElementById('batchTaxCollapseBtn');
    if (collapseBtn && !collapseBtn.__bound) {
        collapseBtn.__bound = true;
        collapseBtn.addEventListener('click', function () {
            var card = document.getElementById('batchTaxCard');
            var willCollapse = !(card && card.classList.contains('is-collapsed'));
            window.__batchTaxUserExpanded = !willCollapse;
            setBatchTaxCardCollapsed(willCollapse);
            if (!willCollapse) {
                if (window.__batchTaxFormVisible) {
                    showBatchTaxManualForm({ scroll: false });
                } else {
                    showTaxStartChooser({ scroll: false });
                }
            }
        });
    }
    var advToggle = document.getElementById('singleTaxRecordToggle');
    var advCard = document.getElementById('singleTaxRecordCard');
    if (advToggle && advCard && !advToggle.__bound) {
        advToggle.__bound = true;
        advToggle.addEventListener('click', function () {
            var open = advCard.classList.contains('is-collapsed');
            advCard.classList.toggle('is-collapsed', !open);
            advToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }
    var moreToggle = document.getElementById('taxMoreToggle');
    var moreCard = document.getElementById('taxMoreCard');
    if (moreToggle && moreCard && !moreToggle.__bound) {
        moreToggle.__bound = true;
        moreToggle.addEventListener('click', function () {
            var open = moreCard.classList.toggle('is-open');
            moreCard.classList.toggle('is-collapsed', !open);
            moreToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }
    document.addEventListener('click', function () {
        closeBatchTaxMoreMenu();
        closeTaxRecordsManageMenu();
    });
    syncBatchTaxEmptyState();
}

// === 从已有记录回填工作经历 ===
function scrollToBatchTaxCard() {
    var card = document.getElementById('batchTaxCard');
    if (!card) {
        return;
    }
    try {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (eScroll) {
        card.scrollIntoView(true);
    }
}

function batchBonusSnapshotKey(bonuses) {
    return JSON.stringify(
        (bonuses || []).map(function (bonus) {
            return [
                round2(parseFloat(bonus && bonus.yearEndBonus) || 0).toFixed(2),
                String(parseInt(bonus && bonus.bonusYear, 10) || 0),
                String(parseInt(bonus && bonus.bonusMonth, 10) || 0),
                String((bonus && bonus.company) || '')
            ];
        })
    );
}

function batchBonusWasManuallyChanged() {
    if (!batchTaxEditMode || !batchTaxEditMode.bonusSnapshot) {
        return false;
    }
    var cur = collectBatchBonusSnapshot();
    return batchBonusSnapshotKey(cur) !== batchBonusSnapshotKey(batchTaxEditMode.bonusSnapshot);
}

/**
 * 从已有税务记录反推工作经历并进入修改模式。
 * 副作用：重建行、enterBatchTaxEditMode。
 */
function loadBatchEmploymentsFromExistingRecords(scrollFromList) {
    apiFetchRecords()
        .then(function (list) {
            var salaryRecs = (list || []).filter(isBatchSalaryRecord);
            if (!salaryRecs.length) {
                showConsultStrongAlert('当前没有可回填的「正常工资薪金」记录，请先批量生成或逐条添加。');
                return;
            }
            showBatchTaxManualForm({ scroll: !!scrollFromList });
            var byCompany = {};
            salaryRecs.forEach(function (r) {
                var cn = String(r.company_name || '').trim();
                if (!cn) {
                    cn = '（未填扣缴义务人）';
                }
                if (!byCompany[cn]) {
                    byCompany[cn] = [];
                }
                byCompany[cn].push(r);
            });
            var payloads = [];
            var scopeIds = [];
            Object.keys(byCompany).forEach(function (cn) {
                var segments = splitCompanyRecordsIntoSegments(byCompany[cn]);
                segments.forEach(function (seg) {
                    var p = segmentToBatchRowPayload(seg);
                    payloads.push(p);
                    scopeIds = scopeIds.concat(p.recordIds);
                });
            });
            payloads.sort(function (a, b) {
                var ak = ymToKey(a.rowData.sy, a.rowData.sm);
                var bk = ymToKey(b.rowData.sy, b.rowData.sm);
                return ak - bk;
            });
            var bonusRecs = (list || []).filter(isBatchBonusRecord);
            var bonusRecordIds = bonusRecs.map(function (br) {
                return String(br.id);
            });
            var bonusesByPayload = assignBonusRecordsToPayloads(payloads, bonusRecs);
            var listEl = document.getElementById('batch_employment_list');
            if (!listEl) {
                return;
            }
            listEl.innerHTML = '';
            var pi;
            for (pi = 0; pi < payloads.length; pi++) {
                addBatchEmpRow();
                var rows = listEl.querySelectorAll('.batch-emp-row');
                var row = rows[rows.length - 1];
                if (!row) {
                    continue;
                }
                var rowData = Object.assign({}, payloads[pi].rowData);
                var rowCompany = String(rowData.company || '').trim();
                if (bonusesByPayload[pi] && bonusesByPayload[pi].length) {
                    rowData.bonuses = bonusesByPayload[pi];
                    rowData.bonusOpen = true;
                }
                setBatchEmpRowValues(row, rowData);
                var am = payloads[pi].amounts;
                var pel = row.querySelector('.batch-emp-pension');
                var mel = row.querySelector('.batch-emp-medical');
                var uel = row.querySelector('.batch-emp-unemployment');
                var fel = row.querySelector('.batch-emp-fund');
                if (pel) pel.value = String(round2(am.pension));
                if (mel) mel.value = String(round2(am.medical));
                if (uel) uel.value = String(round2(am.unemployment));
                if (fel) fel.value = String(round2(am.fund));
                row._monthSalaryMap = payloads[pi].overrides || {};
                updateBatchEmpMonthSalaryBadge(row);
                rememberBatchCompanyProfile({
                    name: rowCompany,
                    company_tax_id: payloads[pi].rowData.company_tax_id || '',
                    tax_authority: payloads[pi].rowData.tax_authority || ''
                });
            }
            refreshBatchCompanyHistoryDatalist();
            listEl.querySelectorAll('.batch-emp-company').forEach(bindBatchEmpCompanyHistoryInput);
            var bonusSnapshot = collectBatchBonusSnapshot();
            enterBatchTaxEditMode(scopeIds, {
                bonusSnapshot: bonusSnapshot,
                bonusRecordIds: bonusRecordIds
            });
            window.__batchTaxUserExpanded = true;
            setBatchTaxCardCollapsed(false);
            switchTab('records', true);
            if (scrollFromList) {
                scrollToBatchTaxCard();
            }
            showMsg(
                '已回填 ' +
                    payloads.length +
                    ' 段工作经历（共 ' +
                    salaryRecs.length +
                    ' 条月薪记录' +
                    (bonusRecs.length ? '，检测到 ' + bonusRecs.length + ' 条年终奖（已按公司与月份回填，默认保留）' : '') +
                    '），请修改后点击「保存覆盖」',
                true
            );
        })
        .catch(function () {
            showConsultStrongAlert('读取税务记录失败，请稍后重试');
        });
}

// === 组装月薪写入与确认文案 ===
/** 由就业段展开月薪写入项并累计预扣税额。 */
function buildBatchEmploymentWrites(employments) {
    var writes = [];
    var taxSumSalary = 0;
    var ei;
    for (ei = 0; ei < employments.length; ei++) {
        var emp = employments[ei];
        var empSocial = round2(emp.pension + emp.medical + emp.unemployment);
        var empSpecFour = round2(empSocial + emp.housingFund);
        var monthlyTaxableForEmp = function (salaryMonth) {
            return round2(Math.max(0, salaryMonth - 5000 - emp.specialAdd - empSocial - emp.housingFund));
        };
        var monthEntries = [];
        var mi;
        for (mi = 0; mi < emp.months.length; mi++) {
            var ym0 = emp.months[mi];
            var mk0 = ym0.year + '-' + pad2(ym0.month);
            var sal0;
            if (emp.monthSalaryOverrides && emp.monthSalaryOverrides[mk0] != null) {
                sal0 = emp.monthSalaryOverrides[mk0];
            } else if (emp.salaryFloat) {
                sal0 = batchEmpRandomSalaryInRange(emp.salaryMin, emp.salaryMax);
            } else {
                sal0 = round2(emp.salaryMin);
            }
            monthEntries.push({ year: ym0.year, month: ym0.month, salary: sal0 });
        }
        var taxMap = taxesMapForEmploymentMonthEntries(monthEntries, monthlyTaxableForEmp);
        for (mi = 0; mi < monthEntries.length; mi++) {
            var ent = monthEntries[mi];
            var k = ent.year + '-' + pad2(ent.month);
            var taxM =
                emp.monthTaxOverrides && emp.monthTaxOverrides[k] != null
                    ? round2(emp.monthTaxOverrides[k])
                    : taxMap[k];
            taxSumSalary = round2(taxSumSalary + taxM);
            writes.push({
                year: ent.year,
                month: ent.month,
                company: emp.company,
                company_tax_id: emp.company_tax_id || '',
                tax_authority: emp.tax_authority || '',
                salary: ent.salary,
                tax: taxM,
                pension: emp.pension,
                medical: emp.medical,
                unemployment: emp.unemployment,
                housingFund: emp.housingFund,
                specialAdd: emp.specialAdd,
                specFour: empSpecFour,
                empIdx: emp.empIdx
            });
        }
    }
    writes.sort(function (a, b) {
        if (a.year !== b.year) return a.year - b.year;
        if (a.month !== b.month) return a.month - b.month;
        return a.empIdx - b.empIdx;
    });
    return { writes: writes, taxSumSalary: taxSumSalary };
}

/** 生成确认框中各段工作经历摘要行。 */
function buildBatchConfirmLines(employments) {
    var lines = [];
    var ei;
    for (ei = 0; ei < employments.length; ei++) {
        var e = employments[ei];
        var oc = Object.keys(e.monthSalaryOverrides || {}).length;
        var tc = Object.keys(e.monthTaxOverrides || {}).length;
        lines.push(
            '· ' +
                e.company +
                '：' +
                e.months.length +
                ' 个月' +
                (oc > 0 ? '（已自定义 ' + oc + ' 个月工资' : '') +
                (tc > 0 ? (oc > 0 ? '，' : '（') + '粘贴税额 ' + tc + ' 个月' : '') +
                (oc > 0 || tc > 0 ? '）' : '') +
                '，' +
                (e.salaryFloat
                    ? '月薪约 ' + e.salaryMin + '～' + e.salaryMax + ' 元（未自定义的月份逐月随机）'
                    : '月薪 ' + e.salaryMin + ' 元')
        );
    }
    return lines;
}

/** 组装待提交的月薪 + 年终奖 record 数组。 */
function assembleBatchTaxRecords(writes, base, uidKey, employments) {
    var records = [];
    var wi;
    for (wi = 0; wi < writes.length; wi++) {
        records.push(buildBatchSalaryRecord(writes[wi], base, uidKey));
    }
    (employments || []).forEach(function (emp) {
        var bonusCompany = {
            name: emp.company,
            company_tax_id: emp.company_tax_id || '',
            tax_authority: emp.tax_authority || ''
        };
        employmentBonusList(emp).forEach(function (b, seq) {
            if (b.amount > 0 && b.year > 0 && b.month >= 1 && b.month <= 12) {
                records.push(
                    buildBatchYearEndBonusRecord(
                        uidKey,
                        base,
                        bonusCompany,
                        b.year,
                        b.month,
                        b.amount,
                        emp.empIdx,
                        seq
                    )
                );
            }
        });
    });
    return records;
}

/**
 * 先删后写（覆盖修改）。副作用：API。
 */
function postBatchReplaceTaxRecordsPromise(idsToDelete, records) {
    var ids = Array.isArray(idsToDelete) ? idsToDelete : [];
    var list = Array.isArray(records) ? records : [];
    var CHUNK = 100;
    function postOne(delIds, part) {
        return consultTaxApiFetch({
            action: 'batch_replace_records',
            ids_to_delete: delIds,
            records: part
        })
            .then(function (r) {
                return (window.authParseJson||function(r){return r.json();})(r);
            })
            .then(function (data) {
                if (data.code !== 200) {
                    throw new Error(data.msg || '批量修改失败');
                }
                return data.data || {};
            });
    }
    if (list.length <= CHUNK) {
        return postOne(ids, list);
    }
    var agg = { deleted: 0, saved: 0, ids: [], reassigned_ids: 0, auto_deduped: 0 };
    var chain = Promise.resolve();
    var i;
    for (i = 0; i < list.length; i += CHUNK) {
        (function (part, delIds) {
            chain = chain.then(function () {
                return postOne(delIds, part).then(function (data) {
                    agg.deleted += Number(data.deleted) || 0;
                    agg.saved += Number(data.saved) || part.length;
                    if (Array.isArray(data.ids)) {
                        agg.ids = agg.ids.concat(data.ids);
                    }
                    agg.reassigned_ids += Number(data.reassigned_ids) || 0;
                    agg.auto_deduped += Number(data.auto_deduped) || 0;
                    return agg;
                });
            });
        })(list.slice(i, i + CHUNK), i === 0 ? ids : []);
    }
    return chain.then(function () {
        return agg;
    });
}

/** 主操作按钮 loading/禁用态。副作用：DOM。 */
function setBatchTaxActionLoading(loading, isUpdate) {
    var btn = document.getElementById(
        isUpdate ? 'batch_update_employments_btn' : 'batch_submit_employments_btn'
    );
    if (!btn) {
        return;
    }
    var defaultText = isUpdate ? '保存覆盖' : '一键生成税务记录';
    if (loading) {
        if (!btn.dataset.prevText) {
            btn.dataset.prevText = btn.textContent;
        }
        btn.disabled = true;
        btn.textContent = isUpdate ? '覆盖写入中…' : '生成中…';
    } else {
        btn.disabled = false;
        btn.textContent = btn.dataset.prevText || defaultText;
    }
}

function ymToKey(y, m) {
    return y * 100 + m;
}


// === 解析 DOM 工作经历行 ===
/** 解析单行 DOM 为 employment 对象；失败带 error。 */
function parseOneBatchEmpRow(row, rowIdx) {
    syncBatchEmpDeductionsFromBase(row);
    var companyEl = row.querySelector('.batch-emp-company');
    var company = companyEl ? String(companyEl.value).trim() : '';
    var taxIdEl = row.querySelector('.batch-emp-company-tax-id');
    var authEl = row.querySelector('.batch-emp-tax-authority');
    var company_tax_id = taxIdEl ? String(taxIdEl.value).trim() : '';
    var tax_authority = authEl ? String(authEl.value).trim() : '';
    var sy = parseInt(row.querySelector('.batch-emp-sy').value, 10);
    var sm = parseInt(row.querySelector('.batch-emp-sm').value, 10);
    var ey = parseInt(row.querySelector('.batch-emp-ey').value, 10);
    var em = parseInt(row.querySelector('.batch-emp-em').value, 10);
    var salaryMin = parseFloat(row.querySelector('.batch-emp-salary').value);
    var maxEl = row.querySelector('.batch-emp-salary-max');
    var maxTrim = maxEl && maxEl.value != null ? String(maxEl.value).trim() : '';
    var salaryFloat = maxTrim !== '';
    var salaryMax = salaryFloat ? parseFloat(maxTrim) : salaryMin;
    var pension = parseFloat(row.querySelector('.batch-emp-pension').value) || 0;
    var medical = parseFloat(row.querySelector('.batch-emp-medical').value) || 0;
    var unemployment = parseFloat(row.querySelector('.batch-emp-unemployment').value) || 0;
    var housingFund = parseFloat(row.querySelector('.batch-emp-fund').value) || 0;
    var specialAdd = parseFloat(row.querySelector('.batch-emp-special').value) || 0;
    var seg = rowIdx + 1;
    if (!company) {
        return { ok: false, error: '第 ' + seg + ' 段工作经历请填写扣缴义务人（公司全称）' };
    }
    if (!sy || sy < 2000 || sy > 2100 || !sm || sm < 1 || sm > 12) {
        return { ok: false, error: '第 ' + seg + ' 段起始年月不合法（年份须为 2000–2100）' };
    }
    if (!ey || ey < 2000 || ey > 2100 || !em || em < 1 || em > 12) {
        return { ok: false, error: '第 ' + seg + ' 段结束年月不合法（年份须为 2000–2100）' };
    }
    if (Number.isNaN(salaryMin) || salaryMin < 0) {
        return { ok: false, error: '第 ' + seg + ' 段月薪下限须为非负数字' };
    }
    if (salaryFloat) {
        if (Number.isNaN(salaryMax) || salaryMax < 0) {
            return { ok: false, error: '第 ' + seg + ' 段月薪上限须为非负数字' };
        }
        if (salaryMax < salaryMin) {
            return { ok: false, error: '第 ' + seg + ' 段月薪上限须不小于下限' };
        }
    }
    if (pension < 0 || medical < 0 || unemployment < 0 || housingFund < 0 || specialAdd < 0) {
        return { ok: false, error: '第 ' + seg + ' 段社保/专项附加不能为负数' };
    }
    var ssBaseEl = row.querySelector('.batch-emp-ss-base');
    var ssBaseTrim = ssBaseEl ? String(ssBaseEl.value).trim() : '';
    if (ssBaseTrim !== '') {
        var ssBaseVal = parseFloat(ssBaseTrim);
        if (Number.isNaN(ssBaseVal) || ssBaseVal < 0) {
            return { ok: false, error: '第 ' + seg + ' 段社保缴费基数须为非负数字' };
        }
        var fundBaseEl = row.querySelector('.batch-emp-fund-base');
        var fundBaseTrim = fundBaseEl ? String(fundBaseEl.value).trim() : '';
        if (fundBaseTrim !== '') {
            var fundBaseVal = parseFloat(fundBaseTrim);
            if (Number.isNaN(fundBaseVal) || fundBaseVal < 0) {
                return { ok: false, error: '第 ' + seg + ' 段公积金缴费基数须为非负数字' };
            }
        }
    }
    var months = enumerateYmRange(sy, sm, ey, em);
    if (!months.length) {
        return { ok: false, error: '第 ' + seg + ' 段在职区间无效（结束应不早于起始）' };
    }
    if (months.length > 240) {
        return {
            ok: false,
            error: '第 ' + seg + ' 段在职区间过长（' + months.length + ' 个月），请检查起止年份是否误填成两位年（如 23 应为 2023）'
        };
    }
    var collectedBonuses = collectBatchEmpBonusesFromRow(row);
    if (Array.isArray(row._extraBonuses) && row._extraBonuses.length) {
        collectedBonuses = collectedBonuses.concat(row._extraBonuses);
    }
    var bonuses = filledBatchEmpBonuses(collectedBonuses);
    var bi;
    var bonusYmSeen = {};
    for (bi = 0; bi < bonuses.length; bi++) {
        var bonusItem = bonuses[bi];
        if (!bonusItem.month || bonusItem.month < 1 || bonusItem.month > 12) {
            return { ok: false, error: '第 ' + seg + ' 段第 ' + (bi + 1) + ' 笔年终奖归属月份不合法（1–12 月）' };
        }
        if (!bonusItem.year || bonusItem.year < 2000 || bonusItem.year > 2100) {
            return { ok: false, error: '第 ' + seg + ' 段第 ' + (bi + 1) + ' 笔年终奖归属年度不合法（须为 2000–2100）' };
        }
        var bonusYmKey = bonusItem.year + '-' + bonusItem.month;
        if (bonusYmSeen[bonusYmKey]) {
            return {
                ok: false,
                error: '第 ' + seg + ' 段有两笔年终奖同属 ' + bonusItem.year + ' 年 ' + bonusItem.month + ' 月，请改成不同月份'
            };
        }
        bonusYmSeen[bonusYmKey] = true;
    }
    var yearEndBonus = bonuses.length ? bonuses[0].amount : 0;
    var bonusYear = bonuses.length ? bonuses[0].year : 0;
    var bonusMonth = bonuses.length ? bonuses[0].month : 0;
    var rawMap = row._monthSalaryMap || {};
    var monthSalaryOverrides = {};
    var rawTaxMap = row._monthTaxMap || {};
    var monthTaxOverrides = {};
    var mi;
    for (mi = 0; mi < months.length; mi++) {
        var ym = months[mi];
        var mk = ym.year + '-' + pad2(ym.month);
        if (Object.prototype.hasOwnProperty.call(rawMap, mk)) {
            var vv = parseFloat(rawMap[mk]);
            if (!Number.isNaN(vv) && vv >= 0) {
                monthSalaryOverrides[mk] = round2(vv);
            }
        }
        if (Object.prototype.hasOwnProperty.call(rawTaxMap, mk)) {
            var tv = parseFloat(rawTaxMap[mk]);
            if (!Number.isNaN(tv) && tv >= 0) {
                monthTaxOverrides[mk] = round2(tv);
            }
        }
    }
    return {
        ok: true,
        employment: {
            company: company,
            company_tax_id: company_tax_id,
            tax_authority: tax_authority,
            salaryFloat: salaryFloat,
            salaryMin: salaryMin,
            salaryMax: salaryMax,
            pension: round2(pension),
            medical: round2(medical),
            unemployment: round2(unemployment),
            housingFund: round2(housingFund),
            specialAdd: round2(specialAdd),
            months: months,
            monthSalaryOverrides: monthSalaryOverrides,
            monthTaxOverrides: monthTaxOverrides,
            yearEndBonus: round2(yearEndBonus),
            bonusMonth: bonusMonth,
            bonusYear: bonusYear,
            extraBonuses: bonuses.slice(1),
            bonuses: bonuses
        }
    };
}

/** 解析全部工作经历行。 */
function parseBatchEmploymentsFromDom() {
    var rows = document.querySelectorAll('#batch_employment_list .batch-emp-row');
    if (!rows.length) {
        return { ok: false, employments: [], error: '请至少添加一段工作经历' };
    }
    var employments = [];
    var rowIdx;
    for (rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        var one = parseOneBatchEmpRow(rows[rowIdx], rowIdx);
        if (!one.ok) {
            return { ok: false, employments: [], error: one.error };
        }
        var emp = one.employment;
        emp.empIdx = rowIdx;
        employments.push(emp);
    }
    var companyBonusYm = {};
    var ei;
    for (ei = 0; ei < employments.length; ei++) {
        var empCheck = employments[ei];
        var filled = employmentBonusList(empCheck);
        var fi;
        for (fi = 0; fi < filled.length; fi++) {
            var fb = filled[fi];
            var companyYm = empCheck.company + '|' + fb.year + '|' + fb.month;
            if (companyBonusYm[companyYm]) {
                return {
                    ok: false,
                    employments: [],
                    error:
                        '「' +
                        empCheck.company +
                        '」' +
                        fb.year +
                        '年' +
                        fb.month +
                        '月已有一笔年终奖，请改成不同月份（同一单位同一月只能有一条年终奖）'
                };
            }
            companyBonusYm[companyYm] = true;
        }
    }
    return { ok: true, employments: employments };
}

// === 按月自定义工资弹窗（分页草稿） ===
var batchMsModalCurrentRow = null;
var batchMsModalMonthsSnapshot = [];
/* 分页后 DOM 只存当前页输入框，故所有月份的值统一存草稿，保存时以草稿为准，避免翻页丢数据 */
var batchMsModalDraft = {};
var batchMsModalPage = 0;
var BATCH_MS_PAGE_SIZE = 12;

/** 关闭按月工资弹窗。 */
function closeBatchMonthSalaryModal() {
    var root = document.getElementById('batchMonthSalaryModal');
    if (root) {
        root.classList.remove('is-open');
    }
    batchMsModalCurrentRow = null;
    batchMsModalMonthsSnapshot = [];
    batchMsModalDraft = {};
    batchMsModalPage = 0;
}

/** 更新「已设 N 个月」徽章。 */
function updateBatchEmpMonthSalaryBadge(row) {
    var badge = row.querySelector('.batch-emp-month-salary-badge');
    if (!badge) {
        return;
    }
    var rows = document.querySelectorAll('#batch_employment_list .batch-emp-row');
    var idx = Array.prototype.indexOf.call(rows, row);
    if (idx < 0) {
        idx = 0;
    }
    var one = parseOneBatchEmpRow(row, idx);
    if (!one.ok) {
        badge.hidden = true;
        badge.textContent = '';
        return;
    }
    var n = Object.keys(one.employment.monthSalaryOverrides || {}).length;
    if (n > 0) {
        badge.hidden = false;
        badge.textContent = '已自定义 ' + n + ' 个月';
    } else {
        badge.hidden = true;
        badge.textContent = '';
    }
}

/**
 * 打开按月自定义工资弹窗并载入草稿。
 * 副作用：弹窗 DOM、分页状态。
 */
function openBatchMonthSalaryModal(row) {
    var rows = document.querySelectorAll('#batch_employment_list .batch-emp-row');
    var idx = Array.prototype.indexOf.call(rows, row);
    if (idx < 0) {
        idx = 0;
    }
    var one = parseOneBatchEmpRow(row, idx);
    if (!one.ok) {
        showConsultStrongAlert(one.error);
        return;
    }
    var emp = one.employment;
    batchMsModalCurrentRow = row;
    batchMsModalMonthsSnapshot = emp.months.slice();

    var titleEl = document.getElementById('batchMsModalTitleEl');
    var hintEl = document.getElementById('batchMsModalHint');
    var bodyEl = document.getElementById('batchMsModalBody');
    var root = document.getElementById('batchMonthSalaryModal');
    if (!titleEl || !hintEl || !bodyEl || !root) {
        return;
    }

    var co = emp.company || '（未填公司）';
    if (co.length > 20) {
        co = co.slice(0, 20) + '…';
    }
    titleEl.textContent = '按月自定义工资 · ' + co;

    hintEl.textContent =
        '共 ' +
        emp.months.length +
        ' 个月' +
        (emp.months.length > BATCH_MS_PAGE_SIZE
            ? '（每页 ' + BATCH_MS_PAGE_SIZE + ' 个月，翻页不会丢失已填内容，最后点「保存」统一生效）'
            : '') +
        '。输入框默认显示月薪下限；修改并保存后该月使用自定义金额。若清空某月输入并保存，则该月恢复为「固定下限或区间内随机」。';

    var map = row._monthSalaryMap || {};
    batchMsModalDraft = {};
    emp.months.forEach(function (ym) {
        var mk = ym.year + '-' + pad2(ym.month);
        batchMsModalDraft[mk] =
            Object.prototype.hasOwnProperty.call(map, mk) && map[mk] !== '' && map[mk] != null
                ? String(map[mk])
                : String(emp.salaryMin);
    });
    batchMsModalPage = 0;
    renderBatchMsModalPage();

    root.classList.add('is-open');
}

/**
 * 把当前页输入框的值回写草稿（翻页/保存前必须调用）。
 * 副作用：更新 batchMsModalDraft。
 */
function syncBatchMsPageToDraft() {
    var bodyEl = document.getElementById('batchMsModalBody');
    if (!bodyEl) {
        return;
    }
    bodyEl.querySelectorAll('input[data-ym-key]').forEach(function (inp) {
        batchMsModalDraft[inp.dataset.ymKey] = inp.value != null ? String(inp.value) : '';
    });
}

function batchMsTotalPages() {
    var n = batchMsModalMonthsSnapshot.length;
    return n > 0 ? Math.ceil(n / BATCH_MS_PAGE_SIZE) : 1;
}

/** 渲染当前页月份输入。副作用：弹窗 body。 */
function renderBatchMsModalPage() {
    var bodyEl = document.getElementById('batchMsModalBody');
    if (!bodyEl) {
        return;
    }
    var months = batchMsModalMonthsSnapshot;
    var total = batchMsTotalPages();
    if (batchMsModalPage > total - 1) {
        batchMsModalPage = total - 1;
    }
    if (batchMsModalPage < 0) {
        batchMsModalPage = 0;
    }
    var start = batchMsModalPage * BATCH_MS_PAGE_SIZE;
    var end = Math.min(start + BATCH_MS_PAGE_SIZE, months.length);

    bodyEl.innerHTML = '';
    var mi;
    for (mi = start; mi < end; mi++) {
        var ym = months[mi];
        var mk = ym.year + '-' + pad2(ym.month);
        var lab = document.createElement('label');
        lab.setAttribute('for', 'batch-ms-inp-' + mk.replace(/-/g, '_'));
        lab.textContent = ym.year + '年' + ym.month + '月';
        var inp = document.createElement('input');
        inp.type = 'number';
        inp.step = '0.01';
        inp.min = '0';
        inp.id = 'batch-ms-inp-' + mk.replace(/-/g, '_');
        inp.dataset.ymKey = mk;
        inp.value = Object.prototype.hasOwnProperty.call(batchMsModalDraft, mk)
            ? String(batchMsModalDraft[mk])
            : '';
        var wrap = document.createElement('div');
        wrap.className = 'batch-ms-row';
        wrap.appendChild(lab);
        wrap.appendChild(inp);
        bodyEl.appendChild(wrap);
    }
    bodyEl.scrollTop = 0;
    renderBatchMsPagerUi(start, end, total);
}

function renderBatchMsPagerUi(start, end, total) {
    var pager = document.getElementById('batchMsModalPager');
    var info = document.getElementById('batchMsPagerInfo');
    var prev = document.getElementById('batchMsPagerPrev');
    var next = document.getElementById('batchMsPagerNext');
    if (!pager) {
        return;
    }
    pager.hidden = total <= 1;
    if (info) {
        info.textContent =
            '第 ' + (batchMsModalPage + 1) + '/' + total + ' 页（' +
            (start + 1) + '-' + end + ' 月）';
    }
    if (prev) {
        prev.disabled = batchMsModalPage <= 0;
    }
    if (next) {
        next.disabled = batchMsModalPage >= total - 1;
    }
}

function gotoBatchMsPage(delta) {
    syncBatchMsPageToDraft();
    batchMsModalPage += delta;
    renderBatchMsModalPage();
}

/** 保存按月工资/税额 map 到行 dataset。副作用：关窗、徽章。 */
function saveBatchMonthSalaryModal() {
    var row = batchMsModalCurrentRow;
    var bodyEl = document.getElementById('batchMsModalBody');
    if (!row || !bodyEl) {
        closeBatchMonthSalaryModal();
        return;
    }
    if (!row._monthSalaryMap) {
        row._monthSalaryMap = {};
    }
    var floorSal = parseFloat(row.querySelector('.batch-emp-salary').value);
    if (Number.isNaN(floorSal)) {
        floorSal = 0;
    }
    var floorRounded = round2(floorSal);
    /* 先把当前页回写草稿，再按草稿保存全部月份；否则未展示的页会被漏掉 */
    syncBatchMsPageToDraft();
    var keys = batchMsModalMonthsSnapshot.map(function (ym) {
        return ym.year + '-' + pad2(ym.month);
    });
    var i;
    for (i = 0; i < keys.length; i++) {
        var mk = keys[i];
        var raw = Object.prototype.hasOwnProperty.call(batchMsModalDraft, mk)
            ? batchMsModalDraft[mk]
            : '';
        var trim = raw != null ? String(raw).trim() : '';
        if (trim === '') {
            delete row._monthSalaryMap[mk];
            continue;
        }
        var v = parseFloat(trim);
        if (Number.isNaN(v) || v < 0) {
            showConsultStrongAlert('「' + mk + '」工资须为非负数字');
            return;
        }
        var vr = round2(v);
        var hadBefore = Object.prototype.hasOwnProperty.call(row._monthSalaryMap, mk);
        if (!hadBefore && vr === floorRounded) {
            continue;
        }
        row._monthSalaryMap[mk] = vr;
    }
    updateBatchEmpMonthSalaryBadge(row);
    closeBatchMonthSalaryModal();
    scheduleBatchTaxDraftSave();
}

/** 清空按月自定义并关窗。 */
function clearBatchMonthSalaryModal() {
    var row = batchMsModalCurrentRow;
    var bodyEl = document.getElementById('batchMsModalBody');
    if (!row || !bodyEl) {
        return;
    }
    if (!row._monthSalaryMap) {
        row._monthSalaryMap = {};
    }
    batchMsModalMonthsSnapshot.forEach(function (ym) {
        var mk = ym.year + '-' + pad2(ym.month);
        delete row._monthSalaryMap[mk];
    });
    var empSalaryMin = parseFloat(row.querySelector('.batch-emp-salary').value);
    if (Number.isNaN(empSalaryMin)) {
        empSalaryMin = 0;
    }
    /* 草稿整体复位，保证未展示页也被清空 */
    batchMsModalMonthsSnapshot.forEach(function (ym) {
        batchMsModalDraft[ym.year + '-' + pad2(ym.month)] = String(empSalaryMin);
    });
    renderBatchMsModalPage();
    updateBatchEmpMonthSalaryBadge(row);
    scheduleBatchTaxDraftSave();
}

// === 按月工资弹窗事件绑定 ===
(function bindBatchMonthSalaryModalUi() {
    var mask = document.getElementById('batchMsModalMask');
    var cx = document.getElementById('batchMsModalCloseX');
    var cancel = document.getElementById('batchMsModalCancel');
    var save = document.getElementById('batchMsModalSave');
    var clr = document.getElementById('batchMsModalClear');
    if (mask) {
        mask.addEventListener('click', closeBatchMonthSalaryModal);
    }
    if (cx) {
        cx.addEventListener('click', closeBatchMonthSalaryModal);
    }
    if (cancel) {
        cancel.addEventListener('click', closeBatchMonthSalaryModal);
    }
    if (save) {
        save.addEventListener('click', saveBatchMonthSalaryModal);
    }
    if (clr) {
        clr.addEventListener('click', clearBatchMonthSalaryModal);
    }
    var prev = document.getElementById('batchMsPagerPrev');
    var next = document.getElementById('batchMsPagerNext');
    if (prev) {
        prev.addEventListener('click', function () {
            gotoBatchMsPage(-1);
        });
    }
    if (next) {
        next.addEventListener('click', function () {
            gotoBatchMsPage(1);
        });
    }
})();

// === 个税粘贴导入弹窗 ===
var TAX_PASTE_IMPORT_TEMPLATE =
    '公司名称：某某有限公司\n' +
    '2023年全年\n' +
    '2024年全年\n' +
    '2025年全年\n' +
    '月薪：20000元';

var _taxPasteImportLastParsed = null;

function copyTextFallbackLocal(text) {
    try {
        var ta = document.createElement('textarea');
        ta.value = String(text || '');
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return !!ok;
    } catch (eCopy) {
        return false;
    }
}

/** 把模板填进输入框（打开弹窗时默认带出，避免先复制再粘贴）。 */
function fillTaxPasteTemplateIntoBox(opts) {
    var ta = document.getElementById('taxPasteImportText');
    if (!ta) return false;
    ta.value = TAX_PASTE_IMPORT_TEMPLATE;
    previewTaxPasteImport({ silent: true });
    if (opts && opts.focus) {
        try {
            ta.focus();
            ta.setSelectionRange(0, ta.value.length);
        } catch (e0) {}
    }
    return true;
}

/** 复制粘贴导入模板到剪贴板，并填入输入框。 */
function copyTaxPasteImportTemplate() {
    fillTaxPasteTemplateIntoBox({ focus: true });
    var text = TAX_PASTE_IMPORT_TEMPLATE;
    function done(ok) {
        showMsg(ok ? '已填入模板，改公司名和月薪后点生成' : '已填入模板，可直接修改后生成', true);
    }
    if (typeof window.copyTextToClipboard === 'function') {
        window.copyTextToClipboard(text).then(done, function () {
            done(copyTextFallbackLocal(text));
        });
        return;
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).then(
            function () {
                done(true);
            },
            function () {
                done(copyTextFallbackLocal(text));
            }
        );
        return;
    }
    done(copyTextFallbackLocal(text));
}

function clearTaxPasteImportText() {
    var ta = document.getElementById('taxPasteImportText');
    var preview = document.getElementById('taxPasteImportPreview');
    _taxPasteImportLastParsed = null;
    if (ta) {
        ta.value = '';
        try {
            ta.focus();
        } catch (e0) {}
    }
    if (preview) {
        preview.hidden = true;
        preview.textContent = '';
        preview.classList.remove('is-ok', 'is-err');
    }
    showMsg('已清空，可粘贴个税 APP 明细', true);
}


/**
 * 聊天摘要里「改为 / 数字改为」覆盖原金额。
 * @returns {string} 替换后的文本
 */
function applyTaxPasteGaiweiOverrides(text) {
    var s = String(text || '');
    s = s.replace(
        /发\s*[\d.]+\s*万\s*(提成|分红|奖金|年终奖)?\s*[（(]\s*改为\s*([\d,.]+)\s*(?:元)?\s*[）)]/g,
        function (_m, kind, amt) {
            return '发' + String(amt).replace(/,/g, '') + '元' + (kind || '提成');
        }
    );
    s = s.replace(
        /发\s*[\d,.]+\s*(?:元)?\s*(提成|分红|奖金|年终奖)?\s*[（(]\s*改为\s*([\d,.]+)\s*(?:元)?\s*[）)]/g,
        function (_m, kind, amt) {
            return '发' + String(amt).replace(/,/g, '') + '元' + (kind || '提成');
        }
    );
    s = s.replace(
        /正常工资薪金\s*[：:][^\n]*?[（(]\s*改为\s*([\d,.]+)\s*[—\-–~～到至]+\s*([\d,.]+)\s*(?:元)?(?:区间)?\s*[）)]/g,
        function (_m, a, b) {
            return '正常工资薪金：' + a + '—' + b + '元';
        }
    );
    s = s.replace(
        /(全年一次性奖金(?:收入)?\s*)([\d,.]+)(\s*元)/g,
        function (full, pre, _amt, yuan, offset, str) {
            var after = str.slice(offset + full.length, offset + full.length + 48);
            var gai = after.match(/^[）)]?\s*[—\-–]?\s*数字改为\s*([\d,.]+)/);
            if (gai) {
                return pre + String(gai[1]).replace(/,/g, '') + yuan;
            }
            return full;
        }
    );
    s = s.replace(/[）)]?\s*[—\-–]?\s*数字改为\s*[\d,.]+/g, '');
    return s;
}

/** 解析每月专项扣除：养老 / 医疗 / 失业 / 公积金（绝对金额，元/月） */
function parseTaxPasteMonthlySpecials(block) {
    var out = {
        pension: null,
        medical: null,
        unemployment: null,
        fund: null
    };
    function pickAmount(labelAlts) {
        var re = new RegExp(
            '(?:' +
                labelAlts.join('|') +
                ')\\s*[：:]?\\s*([\\d,.]+)\\s*元?',
            'i'
        );
        var m = String(block || '').match(re);
        if (!m) {
            return null;
        }
        return parseFlexibleMoney(m[1]);
    }
    out.pension = pickAmount(['基本养老保险费', '基本养老保险', '养老保险费', '养老保险']);
    out.medical = pickAmount(['基本医疗保险费', '基本医疗保险', '医疗保险费', '医疗保险']);
    out.unemployment = pickAmount(['失业保险费', '失业保险']);
    out.fund = pickAmount(['住房公积金', '住房公积', '公积金']);
    return out;
}


function parseTaxPasteSalaryRange(block) {
    var salary = null;
    var salaryMax = null;
    var m;
    m = block.match(
        /正常工资薪金\s*[：:]\s*月薪(?:税前)?\s*([\d.]+)\s*万/
    );
    if (m) {
        salary = parseFlexibleMoney(m[1] + '万');
        return { salary: salary, salary_max: null };
    }
    m = block.match(/月薪(?:税前)?\s*([\d.]+)\s*万/);
    if (m) {
        salary = parseFlexibleMoney(m[1] + '万');
        return { salary: salary, salary_max: null };
    }
    m = block.match(
        /正常工资薪金\s*[：:]\s*([\d,.]+)\s*(?:元)?\s*[—\-–~～到至]+\s*([\d,.]+)\s*(?:元)?/
    );
    if (m) {
        salary = parseFlexibleMoney(m[1]);
        salaryMax = parseFlexibleMoney(m[2]);
        return { salary: salary, salary_max: salaryMax };
    }
    m = block.match(
        /(?:月薪|工资薪金|税前)\s*[：:]?\s*([\d,.]+)\s*(?:元)?\s*[—\-–~～到至]+\s*([\d,.]+)\s*(?:元)?/
    );
    if (m) {
        salary = parseFlexibleMoney(m[1]);
        salaryMax = parseFlexibleMoney(m[2]);
        return { salary: salary, salary_max: salaryMax };
    }
    m = block.match(/正常工资薪金\s*[：:]\s*(?:约|大约)?\s*([\d,.]+)\s*万/);
    if (m) {
        salary = parseFlexibleMoney(m[1] + '万');
        return { salary: salary, salary_max: null };
    }
    m = block.match(/正常工资薪金\s*[：:]\s*(?:约|大约)?\s*([\d,.]+)\s*元/);
    if (m) {
        salary = parseFlexibleMoney(m[1]);
        return { salary: salary, salary_max: null };
    }
    m = block.match(/月薪(?:税前)?\s*[：:]?\s*([\d,.]+)\s*元/);
    if (m) {
        salary = parseFlexibleMoney(m[1]);
        return { salary: salary, salary_max: null };
    }
    return { salary: null, salary_max: null };
}

function parseTaxPasteBonuses(block) {
    var bonuses = [];
    var seen = {};
    function pushBonus(year, month, amount) {
        var y = parseInt(year, 10);
        var mo = parseInt(month, 10);
        var amt = typeof amount === 'number' ? amount : parseFlexibleMoney(amount);
        if (!y || y < 1 || y > 9999 || !mo || mo < 1 || mo > 12 || amt == null || amt <= 0) {
            return;
        }
        var key = y + '-' + pad2(mo) + '-' + amt;
        if (seen[key]) {
            return;
        }
        seen[key] = true;
        bonuses.push({ year: y, month: mo, amount: amt });
    }
    var reAnnualParen =
        /(\d{4})\s*年?\s*全年\s*[（(]\s*(\d{1,2})\s*月(?:份)?\s*[：:]\s*全年一次性奖金(?:收入)?\s*([\d,.]+)\s*元/g;
    var m;
    while ((m = reAnnualParen.exec(block)) !== null) {
        pushBonus(m[1], m[2], m[3]);
    }
    var reAnnual =
        /(\d{4})\s*年[^\n]{0,40}?(\d{1,2})\s*月(?:份)?\s*[：:]\s*全年一次性奖金(?:收入)?\s*([\d,.]+)\s*元/g;
    while ((m = reAnnual.exec(block)) !== null) {
        pushBonus(m[1], m[2], m[3]);
    }
    var reWan =
        /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[号日]?[^\n]{0,20}?发\s*([\d.]+)\s*万/g;
    while ((m = reWan.exec(block)) !== null) {
        pushBonus(m[1], m[2], parseFlexibleMoney(m[4] + '万'));
    }
    var reYuan =
        /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[号日]?[^\n]{0,20}?发\s*([\d,.]+)\s*元/g;
    while ((m = reYuan.exec(block)) !== null) {
        pushBonus(m[1], m[2], m[4]);
    }
    /* 发21350.5提成 / 发182662.15分红（金额后可无「元」） */
    var reFaTi =
        /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[号日]?\s*发\s*([\d,.]+)\s*(?:元)?\s*(?:提成|分红|奖金|年终奖)/g;
    while ((m = reFaTi.exec(block)) !== null) {
        pushBonus(m[1], m[2], m[4]);
    }
    var reFaTiNoDay =
        /(\d{4})\s*年\s*(\d{1,2})\s*月(?:份)?\s*发\s*([\d,.]+)\s*(?:元|万)?\s*(?:提成|分红|奖金|年终奖)/g;
    while ((m = reFaTiNoDay.exec(block)) !== null) {
        var amtRaw = m[3];
        var slice = block.slice(m.index, m.index + m[0].length);
        var amt =
            /万/.test(slice) && !/元/.test(String(amtRaw))
                ? parseFlexibleMoney(amtRaw + '万')
                : parseFlexibleMoney(amtRaw);
        pushBonus(m[1], m[2], amt);
    }
    var reBonusLine =
        /(\d{4})\s*年\s*(\d{1,2})\s*月(?:份)?[^\n]{0,30}?(?:分红|提成|年终奖|奖金)[^\n]{0,20}?([\d.]+)\s*万/g;
    while ((m = reBonusLine.exec(block)) !== null) {
        pushBonus(m[1], m[2], parseFlexibleMoney(m[3] + '万'));
    }
    var reBonusLineYuan =
        /(\d{4})\s*年\s*(\d{1,2})\s*月(?:份)?[^\n]{0,30}?(?:分红|提成|年终奖|奖金)[^\n]{0,20}?([\d,.]+)\s*元/g;
    while ((m = reBonusLineYuan.exec(block)) !== null) {
        pushBonus(m[1], m[2], m[3]);
    }
    bonuses.sort(function (a, b) {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });
    return bonuses;
}

function parseTaxPasteDetailMonths(block) {
    var months = [];
    var seen = {};
    function pushMonth(year, month, income, tax) {
        var y = parseInt(year, 10);
        var mo = parseInt(month, 10);
        var inc = parseMoneyToken(income);
        var tx = parseMoneyToken(tax);
        if (!y || y < 1 || y > 9999 || !mo || mo < 1 || mo > 12) {
            return;
        }
        if (inc == null || tx == null) {
            return;
        }
        var key = y + '-' + pad2(mo);
        if (seen[key]) {
            return;
        }
        seen[key] = true;
        months.push({ year: y, month: mo, income: inc, tax: tx, key: key });
    }
    var monthRe =
        /(\d{4})\s*年\s*(\d{1,2})\s*月[^\n\r]*?收入\s*([\d,.]+)\s*元?[^\n\r]*?税额\s*([\d,.]+)\s*元?/g;
    var m;
    while ((m = monthRe.exec(block)) !== null) {
        var lineStart = block.lastIndexOf('\n', m.index);
        var line = block.slice(lineStart + 1, m.index + m[0].length);
        if (/合计|汇总|全年|累计|【注|📌|收入合计|税额合计/.test(line)) {
            continue;
        }
        pushMonth(m[1], m[2], m[3], m[4]);
    }
    /* 宽松：YYYY年M月 后直接两个金额（收入、税额） */
    var looseRe =
        /(\d{4})\s*年\s*(\d{1,2})\s*月\s*[：:]?\s*([\d,.]+)\s*元?\s+[^\d\n]{0,12}([\d,.]+)\s*元?/g;
    while ((m = looseRe.exec(block)) !== null) {
        var ls = block.lastIndexOf('\n', m.index);
        var ln = block.slice(ls + 1, m.index + m[0].length);
        if (/合计|汇总|全年|累计|【注|📌|奖金|提成|分红/.test(ln)) {
            continue;
        }
        var looseKey = parseInt(m[1], 10) + '-' + pad2(parseInt(m[2], 10));
        if (seen[looseKey]) {
            continue;
        }
        pushMonth(m[1], m[2], m[3], m[4]);
    }
    months.sort(function (a, b) {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
    });
    return months;
}


/**
 * 解析粘贴的个税 APP / 聊天记录文本（可含多家公司）。
 * @returns {{ok, employments, ...}}
 */
function parseTaxPasteText(rawText) {
    var text = applyTaxPasteGaiweiOverrides(
        normalizeTaxPasteLabels(
            String(rawText || '')
                .replace(/\u00a0/g, ' ')
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
        )
    );
    if (!String(text).trim()) {
        return { ok: false, error: '请先粘贴税务信息文本' };
    }
    var blocks = splitTaxPasteEmployerBlocks(text);
    var employments = [];
    var errors = [];
    var bi;
    for (bi = 0; bi < blocks.length; bi++) {
        var one = parseOneTaxPasteEmployerBlock(blocks[bi]);
        if (one.ok) {
            employments.push(one);
        } else {
            errors.push('第' + (bi + 1) + '段：' + (one.error || '解析失败'));
        }
    }
    if (!employments.length) {
        return {
            ok: false,
            error: errors.length ? errors.join('；') : '未能解析粘贴内容'
        };
    }
    var monthTotal = 0;
    var incomeSum = 0;
    var taxSum = 0;
    var allTaxLocked = true;
    employments.forEach(function (e) {
        monthTotal += e.months.length;
        incomeSum = round2(incomeSum + e.income_sum);
        taxSum = round2(taxSum + e.tax_sum);
        if (!e.tax_locked) {
            allTaxLocked = false;
        }
    });
    var first = employments[0];
    return {
        ok: true,
        employments: employments,
        company: first.company,
        range: first.range,
        months: first.months,
        income_sum: incomeSum,
        tax_sum: taxSum,
        month_total: monthTotal,
        tax_locked: allTaxLocked,
        parse_warnings: errors
    };
}


/** 打开个税粘贴导入弹窗。空框时自动带出模板并预览。 */
function openTaxPasteImportModal() {
    var root = document.getElementById('taxPasteImportModal');
    var ta = document.getElementById('taxPasteImportText');
    var preview = document.getElementById('taxPasteImportPreview');
    if (!root) return;
    _taxPasteImportLastParsed = null;
    if (preview) {
        preview.hidden = true;
        preview.textContent = '';
        preview.classList.remove('is-ok', 'is-err');
    }
    root.classList.add('is-open');
    if (ta) {
        ta.setAttribute('placeholder', TAX_PASTE_IMPORT_TEMPLATE);
        if (!String(ta.value || '').trim()) {
            ta.value = TAX_PASTE_IMPORT_TEMPLATE;
        }
        previewTaxPasteImport({ silent: true });
        setTimeout(function () {
            try {
                ta.focus();
            } catch (e0) {}
        }, 50);
    }
}

/** 关闭个税粘贴导入弹窗。 */
function closeTaxPasteImportModal() {
    var root = document.getElementById('taxPasteImportModal');
    if (root) {
        root.classList.remove('is-open');
    }
}

/** 预览粘贴解析结果。副作用：写预览区、缓存 parsed。 */
function previewTaxPasteImport(opts) {
    opts = opts || {};
    var ta = document.getElementById('taxPasteImportText');
    var preview = document.getElementById('taxPasteImportPreview');
    var parsed = parseTaxPasteText(ta ? ta.value : '');
    _taxPasteImportLastParsed = parsed.ok ? parsed : null;
    if (preview) {
        preview.hidden = false;
        preview.textContent = formatTaxPastePreview(parsed);
        preview.classList.toggle('is-ok', !!parsed.ok);
        preview.classList.toggle('is-err', !parsed.ok);
    }
    if (!parsed.ok && !opts.silent) {
        showConsultStrongAlert(parsed.error || '解析失败');
    }
    return parsed;
}

var _taxPastePreviewTimer = null;
function scheduleTaxPasteLivePreview() {
    if (_taxPastePreviewTimer) {
        clearTimeout(_taxPastePreviewTimer);
    }
    _taxPastePreviewTimer = setTimeout(function () {
        previewTaxPasteImport({ silent: true });
    }, 280);
}


/** 将解析结果写入批量工作经历行。副作用：重建/填行。 */
function applyTaxPasteParsedToForm(parsed) {
    if (!parsed || !parsed.ok) {
        return false;
    }
    switchTab('records', true);
    exitBatchTaxEditMode();
    var list = document.getElementById('batch_employment_list');
    if (!list) return false;
    list.innerHTML = '';
    var employments = parsed.employments && parsed.employments.length ? parsed.employments : [parsed];
    var ei;
    for (ei = 0; ei < employments.length; ei++) {
        addBatchEmpRow();
        var rows = list.querySelectorAll('.batch-emp-row');
        var row = rows[rows.length - 1];
        if (!row) {
            return false;
        }
        applyOneTaxPasteEmpToRow(row, employments[ei]);
    }
    scheduleBatchTaxDraftSave();
    var card = document.getElementById('batchTaxCard');
    if (card) {
        try {
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (eScroll) {
            card.scrollIntoView(true);
        }
    }
    return true;
}

/** 确认填入表单（不提交）。 */
function fillTaxPasteImportToForm() {
    var parsed = previewTaxPasteImport();
    if (!parsed.ok) {
        return;
    }
    if (!applyTaxPasteParsedToForm(parsed)) {
        showConsultStrongAlert('填入表单失败，请刷新后重试');
        return;
    }
    showBatchTaxManualForm({ scroll: true });
    closeTaxPasteImportModal();
    var nEmp = (parsed.employments && parsed.employments.length) || 1;
    var nMon = parsed.month_total || parsed.months.length;
    showMsg(
        '已填入 ' +
            nEmp +
            ' 家公司共 ' +
            nMon +
            ' 个月' +
            (parsed.tax_locked ? '（收入/税额均按粘贴文本）' : '（摘要模式，税额将按公式计算）') +
            '。核对后点「一键生成税务记录」即可写入。',
        true
    );
}

/** 粘贴解析后直接触发生成。副作用：填表 + 提交。 */
function generateTaxPasteImportDirect() {
    var parsed = previewTaxPasteImport();
    if (!parsed.ok) {
        return;
    }
    var nEmp = (parsed.employments && parsed.employments.length) || 1;
    var nMon = parsed.month_total || parsed.months.length;
    var names = (parsed.employments || [parsed])
        .map(function (e) {
            return e.company;
        })
        .join('、');
    var taxNote = parsed.tax_locked
        ? '税额使用粘贴值（不重算）。'
        : '税额将按公式计算。';
    if (!applyTaxPasteParsedToForm(parsed)) {
        showConsultStrongAlert('准备写入失败，请刷新后重试');
        return;
    }
    closeTaxPasteImportModal();
    showMsg(
        '正在生成「' + names + '」约 ' + nMon + ' 条记录（' + nEmp + ' 家）。' + taxNote,
        true
    );
    batchAddEmploymentTaxRecords();
}

// === 粘贴导入弹窗事件绑定 ===
(function bindTaxPasteImportModalUi() {
    var mask = document.getElementById('taxPasteImportMask');
    var cx = document.getElementById('taxPasteImportCloseX');
    var cancel = document.getElementById('taxPasteImportCancel');
    var copyTplBtn = document.getElementById('taxPasteImportCopyTplBtn');
    var clearBtn = document.getElementById('taxPasteImportClearBtn');
    var parseBtn = document.getElementById('taxPasteImportParseBtn');
    var fillBtn = document.getElementById('taxPasteImportFillBtn');
    var genBtn = document.getElementById('taxPasteImportGenerateBtn');
    var taInit = document.getElementById('taxPasteImportText');
    if (taInit) {
        taInit.setAttribute('placeholder', TAX_PASTE_IMPORT_TEMPLATE);
        taInit.addEventListener('input', scheduleTaxPasteLivePreview);
        taInit.addEventListener('paste', function () {
            setTimeout(function () {
                previewTaxPasteImport({ silent: true });
            }, 0);
        });
    }
    if (copyTplBtn) {
        copyTplBtn.addEventListener('click', copyTaxPasteImportTemplate);
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', clearTaxPasteImportText);
    }
    if (mask) {
        mask.addEventListener('click', closeTaxPasteImportModal);
    }
    if (cx) {
        cx.addEventListener('click', closeTaxPasteImportModal);
    }
    if (cancel) {
        cancel.addEventListener('click', closeTaxPasteImportModal);
    }
    if (parseBtn) {
        parseBtn.addEventListener('click', function () {
            previewTaxPasteImport();
        });
    }
    if (fillBtn) {
        fillBtn.addEventListener('click', fillTaxPasteImportToForm);
    }
    if (genBtn) {
        genBtn.addEventListener('click', generateTaxPasteImportDirect);
    }
})();

// === 个人信息粘贴导入 ===
var _profilePasteImportLastParsed = null;


/** 解析个人信息粘贴（姓名/身份证/地址/卡等）。 */
function parseProfilePasteText(rawText) {
    var text = String(rawText || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
    if (!String(text).trim()) {
        return { ok: false, error: '请先粘贴个人信息文本' };
    }
    var realName = '';
    var phone = '';
    var taxId = '';
    var address = '';
    var cardNo = '';
    var bankName = '';

    var nameM =
        text.match(/(?:真实)?姓名\s*[：:]\s*([^\n\r]{1,32})/) ||
        text.match(/^\s*([^\n\r]{2,8})\s*$/m);
    if (nameM) {
        realName = String(nameM[1] || '')
            .replace(/[，,。.\s]+$/g, '')
            .trim();
        if (/手机|身份证|地址|银行|卡号|江苏|北京|上海/.test(realName)) {
            realName = '';
        }
    }
    if (!realName) {
        var nameM2 = text.match(/姓名\s*[：:]\s*(\S{2,20})/);
        if (nameM2) {
            realName = String(nameM2[1] || '').trim();
        }
    }

    var phoneM =
        text.match(/(?:手机号|手机|联系电话|电话|预留手机)\s*[：:]\s*([0-9\s\-]{11,20})/) ||
        text.match(/(?:^|[^\d])(1[3-9]\d{9})(?:[^\d]|$)/);
    if (phoneM) {
        phone = digitsOnlyProfile(phoneM[1]);
    }

    var idM =
        text.match(/(?:身份证号|身份证号码|证件号码|纳税人识别号|身份证)\s*[：:]\s*([0-9Xx\s]{15,22})/) ||
        text.match(/(?:^|[^\dA-Za-z])(\d{17}[\dXx])(?:[^\dA-Za-z]|$)/) ||
        text.match(/(?:^|[^\d])(\d{15})(?:[^\d]|$)/);
    if (idM) {
        taxId = String(idM[1] || '')
            .replace(/\s+/g, '')
            .toUpperCase();
    }

    var addrM = text.match(/(?:详细)?地址\s*[：:]\s*([^\n\r]{4,120})/);
    if (addrM) {
        address = String(addrM[1] || '')
            .replace(/[，,。.\s]+$/g, '')
            .trim();
    }
    if (!address) {
        var addrM2 = text.match(
            /((?:北京|天津|上海|重庆|河北|山西|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|海南|四川|贵州|云南|陕西|甘肃|青海|台湾|内蒙古|广西|西藏|宁夏|新疆|香港|澳门)[\u4e00-\u9fff0-9\-号弄巷村组楼栋单元室室房]{6,80})/
        );
        if (addrM2) {
            address = String(addrM2[1] || '').trim();
        }
    }

    var bankLine = text.match(
        /((?:中国)?(?:工商|建设|农业|中国|交通|邮储|邮政储蓄|招商|浦发|中信|光大|华夏|民生|平安|兴业|广发)?银行)?\s*卡号\s*[：:]?\s*\n?\s*([0-9\s]{16,30})/
    );
    if (bankLine) {
        if (bankLine[1]) {
            bankName = inferBankNameFromPasteText(bankLine[1], '');
        }
        cardNo = digitsOnlyProfile(bankLine[2]);
    }
    if (!cardNo) {
        var cardM = text.match(/(?:银行卡号|卡号|借记卡号)\s*[：:]\s*([0-9\s]{16,30})/);
        if (cardM) {
            cardNo = digitsOnlyProfile(cardM[1]);
        }
    }
    if (!cardNo) {
        var loose = text.match(/(?:^|\n)\s*([0-9][0-9\s]{15,28}[0-9])\s*(?:\n|$)/);
        if (loose) {
            var cand = digitsOnlyProfile(loose[1]);
            if (cand.length >= 16 && cand.length <= 19 && cand !== phone && cand !== taxId) {
                cardNo = cand;
            }
        }
    }
    if (!bankName && cardNo) {
        bankName = inferBankNameFromPasteText(text, cardNo);
    }

    if (!realName && !taxId && !phone && !address && !cardNo) {
        return { ok: false, error: '未识别到姓名、身份证、手机、地址或银行卡，请检查粘贴内容' };
    }

    var addrParts = splitCnAddressConsult(address);
    var birth = birthFromId18Consult(taxId);
    var gender = genderFromId18Consult(taxId);
    var errors = [];
    if (phone && phone.length !== 11) {
        errors.push('手机号应为 11 位');
    }
    if (taxId && !(taxId.length === 18 || taxId.length === 15)) {
        errors.push('身份证号格式异常');
    }
    if (cardNo && cardNo.length < 16) {
        errors.push('银行卡号过短');
    }
    if (cardNo && !phone) {
        errors.push('有银行卡时需同时提供手机号（银行预留）');
    }

    return {
        ok: true,
        real_name: realName,
        phone: phone,
        tax_id: taxId,
        address: address,
        address_area: addrParts.area,
        address_detail: addrParts.detail || address,
        card_no: cardNo,
        bank_name: bankName,
        birth_date: birth,
        gender: gender,
        warnings: errors
    };
}


/** 打开个人信息粘贴弹窗。 */
function openProfilePasteImportModal() {
    var root = document.getElementById('profilePasteImportModal');
    var ta = document.getElementById('profilePasteImportText');
    var preview = document.getElementById('profilePasteImportPreview');
    if (!root) return;
    _profilePasteImportLastParsed = null;
    if (preview) {
        preview.hidden = true;
        preview.textContent = '';
    }
    root.classList.add('is-open');
    if (ta) {
        setTimeout(function () {
            try {
                ta.focus();
            } catch (e0) {}
        }, 50);
    }
}

/** 关闭个人信息粘贴弹窗。 */
function closeProfilePasteImportModal() {
    var root = document.getElementById('profilePasteImportModal');
    if (root) {
        root.classList.remove('is-open');
    }
}

/** 预览个人信息解析。 */
function previewProfilePasteImport() {
    var ta = document.getElementById('profilePasteImportText');
    var preview = document.getElementById('profilePasteImportPreview');
    var parsed = parseProfilePasteText(ta ? ta.value : '');
    _profilePasteImportLastParsed = parsed.ok ? parsed : null;
    if (preview) {
        preview.hidden = false;
        preview.textContent = formatProfilePastePreview(parsed);
    }
    if (!parsed.ok) {
        showConsultStrongAlert(parsed.error || '解析失败');
    }
    return parsed;
}

/** 将解析结果写入个人资料相关字段。副作用：DOM/可能 API。 */
function applyProfilePasteImport() {
    var parsed = previewProfilePasteImport();
    if (!parsed.ok) {
        return;
    }
    if (parsed.warnings && parsed.warnings.length) {
        if (!confirm('解析有提示：\n' + parsed.warnings.join('\n') + '\n\n仍要继续写入可写入的字段吗？')) {
            return;
        }
    }
    var profilePayload = { action: 'save_profile' };
    var hasProfile = false;
    if (parsed.real_name) {
        profilePayload.real_name = parsed.real_name;
        hasProfile = true;
    }
    if (parsed.tax_id) {
        profilePayload.tax_id = parsed.tax_id;
        hasProfile = true;
    }
    if (parsed.gender === 1 || parsed.gender === 2) {
        profilePayload.gender = parsed.gender;
        hasProfile = true;
    }
    if (parsed.birth_date) {
        profilePayload.birth_date = parsed.birth_date;
        hasProfile = true;
    }
    if (parsed.address) {
        var area = parsed.address_area || '';
        var detail = parsed.address_detail || parsed.address;
        profilePayload.huji_area = area;
        profilePayload.huji_detail = detail;
        profilePayload.living_area = area;
        profilePayload.living_detail = detail;
        profilePayload.contact_area = area;
        profilePayload.contact_detail = detail;
        hasProfile = true;
    }

    var btn = document.getElementById('profilePasteImportApplyBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '写入中…';
    }

    var chain = Promise.resolve();
    if (hasProfile) {
        chain = chain.then(function () {
            return window.authFetch('api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profilePayload)
            })
                .then(function (r) {
                    return (window.authParseJson||function(r){return r.json();})(r).then(function (data) {
                        return { http: r.status, data: data };
                    });
                })
                .then(function (pack) {
                    var data = pack.data || {};
                    if (pack.http === 402 || data.code === 402) {
                        throw new Error(
                            (data.msg || '改名需支付费用') +
                                '；请到「我的」页修改姓名并完成支付后再试'
                        );
                    }
                    if (!data || data.code !== 200) {
                        throw new Error((data && data.msg) || '保存个人资料失败');
                    }
                    try {
                        if (parsed.real_name) localStorage.setItem('real_name', parsed.real_name);
                        if (parsed.tax_id) localStorage.setItem('tax_id', parsed.tax_id);
                        if (parsed.gender === 1 || parsed.gender === 2) {
                            localStorage.setItem('gender', String(parsed.gender));
                        }
                    } catch (eLs) {}
                    if (parsed.real_name) {
                        document.title = '个人中心 - ' + parsed.real_name;
                    }
                });
        });
    }

    if (parsed.card_no && parsed.phone && parsed.phone.length === 11 && parsed.card_no.length >= 16) {
        chain = chain.then(function () {
            return window.authFetch('api/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'add_bank_card',
                    card_no: parsed.card_no,
                    phone: parsed.phone,
                    bank_name: parsed.bank_name || '银行卡',
                    province: parsed.address_area || ''
                })
            })
                .then(function (r) {
                    return (window.authParseJson||function(r){return r.json();})(r);
                })
                .then(function (data) {
                    if (!data || data.code !== 200) {
                        throw new Error((data && data.msg) || '添加银行卡失败');
                    }
                    try {
                        if (data.data && data.data.bank_card_count != null) {
                            localStorage.setItem('bank_card_count', String(data.data.bank_card_count));
                        }
                    } catch (eBc) {}
                });
        });
    }

    chain
        .then(function () {
            closeProfilePasteImportModal();
            var bits = [];
            if (parsed.real_name) bits.push('姓名');
            if (parsed.tax_id) bits.push('身份证');
            if (parsed.address) bits.push('地址');
            if (parsed.card_no && parsed.phone) bits.push('银行卡');
            showMsg('已写入：' + (bits.join('、') || '个人资料'), true);
            try {
                loadUserInfoFromApi();
            } catch (eLoad) {}
        })
        .catch(function (err) {
            showConsultStrongAlert((err && err.message) || '写入失败');
        })
        .then(function () {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '确认写入';
            }
        });
}

// === 个人信息粘贴弹窗事件绑定 ===
(function bindProfilePasteImportModalUi() {
    var mask = document.getElementById('profilePasteImportMask');
    var cx = document.getElementById('profilePasteImportCloseX');
    var cancel = document.getElementById('profilePasteImportCancel');
    var parseBtn = document.getElementById('profilePasteImportParseBtn');
    var applyBtn = document.getElementById('profilePasteImportApplyBtn');
    if (mask) {
        mask.addEventListener('click', closeProfilePasteImportModal);
    }
    if (cx) {
        cx.addEventListener('click', closeProfilePasteImportModal);
    }
    if (cancel) {
        cancel.addEventListener('click', closeProfilePasteImportModal);
    }
    if (parseBtn) {
        parseBtn.addEventListener('click', function () {
            previewProfilePasteImport();
        });
    }
    if (applyBtn) {
        applyBtn.addEventListener('click', applyProfilePasteImport);
    }
})();

// === 强提示 / 按单位删除弹窗绑定 ===
(function bindConsultStrongAlertModal() {
    var mask = document.getElementById('consultStrongAlertMask');
    var ok = document.getElementById('consultStrongAlertOk');
    if (mask) {
        mask.addEventListener('click', closeConsultStrongAlertModal);
    }
    if (ok) {
        ok.addEventListener('click', closeConsultStrongAlertModal);
    }
})();

(function bindDeleteCompanyModal() {
    var mask = document.getElementById('deleteCompanyModalMask');
    var cancel = document.getElementById('btnDeleteCompanyCancel');
    var confirmBtn = document.getElementById('btnDeleteCompanyConfirm');
    if (mask) {
        mask.addEventListener('click', closeDeleteTaxRecordsByCompanyModal);
    }
    if (cancel) {
        cancel.addEventListener('click', closeDeleteTaxRecordsByCompanyModal);
    }
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmDeleteTaxRecordsByCompany);
    }
})();

/* 回收站弹窗绑定已移至 consult-records.js：closeTaxRecycleBin 等定义在其后加载的
 * consult-records.js 里，在本文件执行时尚不存在，此前的 typeof 守卫会静默跳过导致按钮全部失效。 */

// === 批量记录构建 / 分块保存 ===
/** monthEntries: [{ year, month, salary }, …] 已在时段内按时间顺序；按自然年度分段累计预扣（见 core taxesMap*） */

/** 区间内随机月薪（分）。 */
function batchEmpRandomSalaryInRange(minV, maxV) {
    var lo = Number(minV);
    var hi = Number(maxV);
    if (hi <= lo) return round2(lo);
    return round2(lo + Math.random() * (hi - lo));
}

/** 由写入项构建一条正常工资薪金 record。 */
function buildBatchSalaryRecord(w, base, uidKey) {
    var o = JSON.parse(JSON.stringify(base));
    o.company_name = w.company;
    o.company_tax_id = w.company_tax_id != null ? String(w.company_tax_id) : '';
    o.tax_authority = w.tax_authority != null ? String(w.tax_authority) : '';
    o.year = w.year;
    o.month = w.month;
    o.tax_period = taxPeriodFromYearMonth(w.year, w.month);
    o.report_date = reportDateOneMonthAfterBelonging(w.year, w.month, 15);
    o.id = 'tr_' + uidKey + '_' + w.year + '_' + pad2(w.month) + '_e' + w.empIdx;
    var inc = round2(w.salary);
    o.income = String(inc);
    o.income_this_period = String(inc);
    o.tax_reported = String(w.tax);
    o.deduction_fee = '5000.00';
    o.other_deduction = String(round2(w.specialAdd));
    o.special_deduction = String(w.specFour);
    o.pension_insurance = String(w.pension);
    o.medical_insurance = String(w.medical);
    o.unemployment_insurance = String(w.unemployment);
    o.housing_fund = String(round2(w.housingFund));
    o.tax_free_income = '0.00';
    /* 必须强制月薪小类：base 来自表单，若刚看过/编过年终奖会带「全年一次性奖金收入」，|| 兜底盖不住 */
    o.income_type = '工资薪金';
    o.income_subtype = '正常工资薪金';
    return o;
}

/** 构建全年一次性奖金收入 record（单独计税）。 */
function buildBatchYearEndBonusRecord(uidKey, base, bonusProfile, year, bonusMonth, yearEndBonus, empIdx, seq) {
    var bonusTax = yearEndBonusTaxSeparate(yearEndBonus);
    var b = JSON.parse(JSON.stringify(base));
    b.company_name = bonusProfile.name;
    b.company_tax_id = bonusProfile.company_tax_id != null ? String(bonusProfile.company_tax_id) : '';
    b.tax_authority = bonusProfile.tax_authority != null ? String(bonusProfile.tax_authority) : '';
    b.year = year;
    b.month = bonusMonth;
    b.tax_period = taxPeriodFromYearMonth(year, bonusMonth);
    b.report_date = reportDateOneMonthAfterBelonging(year, bonusMonth, 15);
    b.id =
        'tr_' +
        uidKey +
        '_' +
        year +
        '_' +
        bonusMonth +
        '_bonus_' +
        (empIdx != null ? empIdx : 0) +
        '_' +
        (seq != null ? seq : 0);
    b.income_type = '工资薪金';
    b.income_subtype = '全年一次性奖金收入';
    b.income = String(round2(yearEndBonus));
    b.income_this_period = String(round2(yearEndBonus));
    b.tax_reported = String(round2(bonusTax));
    b.deduction_fee = '0.00';
    b.special_deduction = '0.00';
    b.other_deduction = '0.00';
    b.donation_deduction = '0.00';
    b.pension_insurance = '0.00';
    b.medical_insurance = '0.00';
    b.unemployment_insurance = '0.00';
    b.housing_fund = '0.00';
    b.tax_free_income = '0.00';
    return b;
}

/**
 * 分块 batch_save_records（每批最多 100）。
 * 副作用：多次 API；汇总 saved/ids。
 */
function postBatchTaxRecordsPromise(records) {
    var list = Array.isArray(records) ? records : [];
    var CHUNK = 100;
    function postOneChunk(part) {
        return consultTaxApiFetch({
            action: 'batch_save_records',
            records: part
        })
            .then(function (r) { return (window.authParseJson||function(r){return r.json();})(r); })
            .then(function (data) {
                if (data.code !== 200) throw new Error(data.msg || '批量保存失败');
                return data.data || {};
            });
    }
    if (list.length <= CHUNK) {
        return postOneChunk(list);
    }
    var agg = { saved: 0, ids: [], reassigned_ids: 0, auto_deduped: 0 };
    var chain = Promise.resolve();
    var i;
    for (i = 0; i < list.length; i += CHUNK) {
        (function (part) {
            chain = chain.then(function () {
                return postOneChunk(part).then(function (data) {
                    agg.saved += Number(data.saved) || part.length;
                    if (Array.isArray(data.ids)) {
                        agg.ids = agg.ids.concat(data.ids);
                    }
                    agg.reassigned_ids += Number(data.reassigned_ids) || 0;
                    agg.auto_deduped += Number(data.auto_deduped) || 0;
                    return agg;
                });
            });
        })(list.slice(i, i + CHUNK));
    }
    return chain.then(function () {
        return agg;
    });
}

function setBatchSubmitBtnLoading(loading) {
    setBatchTaxActionLoading(loading, false);
}

// === 仅写年终奖 ===
/**
 * 仅提交各行年终奖记录。
 * 副作用：确认框 + batch_save + 刷新列表。
 */
function batchAddYearEndBonusOnly() {
    document.querySelectorAll('#batch_employment_list .batch-emp-row').forEach(function (row) {
        setBatchEmpBonusMetaExpanded(row, true);
    });
    var parsed = parseBatchEmploymentsFromDom();
    if (!parsed.ok) {
        showConsultStrongAlert(parsed.error || '请检查工作经历');
        return;
    }
    var employments = parsed.employments.filter(function (emp) {
        return employmentBonusList(emp).length > 0;
    });
    if (!employments.length) {
        showConsultStrongAlert('请先展开「年终奖」并填写金额（大于 0）');
        return;
    }
    var uid = currentUserId();
    var uidKey = String(uid).replace(/[^a-zA-Z0-9_-]/g, '_');
    var base = formObjectFromInputs();
    delete base.id;
    var confirmLines = buildBatchBonusConfirmText(employments).replace(/^\n/, '');
    var bonusRecs = [];
    employments.forEach(function (emp) {
        employmentBonusList(emp).forEach(function (b, seq) {
            bonusRecs.push(
                buildBatchYearEndBonusRecord(
                    uidKey,
                    base,
                    {
                        name: emp.company,
                        company_tax_id: emp.company_tax_id || '',
                        tax_authority: emp.tax_authority || ''
                    },
                    b.year,
                    b.month,
                    b.amount,
                    emp.empIdx,
                    seq
                )
            );
        });
    });
    if (
        !confirm(
            '将写入 ' +
                bonusRecs.length +
                ' 笔年终奖：' +
                confirmLines +
                '\n是否确认？'
        )
    ) {
        return;
    }
    setBatchSubmitBtnLoading(true);
    postBatchTaxRecordsPromise(bonusRecs)
        .then(function (data) {
            rememberBatchEmploymentsProfiles(employments);
            var tip = appendAutoDedupedTip('已保存 ' + bonusRecs.length + ' 条年终奖记录', data);
            showMsg(tip, true);
            return refreshRecordList();
        })
        .catch(function (err) {
            showConsultStrongAlert('保存失败：' + (err.message || ''));
            return refreshRecordList();
        })
        .finally(function () {
            setBatchSubmitBtnLoading(false);
        });
}


function randomChineseCompanyName() {
    var p1 = ['华泰', '智联', '恒远', '百川', '鼎盛', '启航', '嘉禾', '明润', '云程', '信德', '拓维', '联创', '宏图', '优策', '思凯', '锐达', '坤元'];
    var p2 = ['科技', '网络', '信息', '数字', '智能', '数据', '创新', '发展', '供应链', '电子', '软件', '互联', '云端'];
    var p3 = ['有限公司', '科技有限公司', '网络科技有限公司', '信息技术有限公司', '企业管理咨询有限公司'];
    return (
        p1[randomIntInclusive(0, p1.length - 1)] +
        p2[randomIntInclusive(0, p2.length - 1)] +
        p3[randomIntInclusive(0, p3.length - 1)]
    );
}

/**
 * 演示：两段工作经历 + 一键写入（仍弹出确认框）。
 * 副作用：重建行、延迟调用 batchAddEmploymentTaxRecords。
 */
function quickGenerateBatchTaxDemo() {
    switchTab('records', true);
    var list = document.getElementById('batch_employment_list');
    if (!list) return;
    list.innerHTML = '';
    addBatchEmpRow();
    addBatchEmpRow();
    var rows = list.querySelectorAll('.batch-emp-row');
    var salA = randomIntInclusive(4800, 32000);
    var salB = randomIntInclusive(4800, 32000);
    var coA = randomChineseCompanyName();
    var coB = randomChineseCompanyName();
    if (rows[0]) {
        rows[0].querySelector('.batch-emp-company').value = coA;
        rows[0].querySelector('.batch-emp-sy').value = '2024';
        rows[0].querySelector('.batch-emp-sm').value = '5';
        rows[0].querySelector('.batch-emp-ey').value = '2025';
        rows[0].querySelector('.batch-emp-em').value = '6';
        rows[0].querySelector('.batch-emp-salary').value = String(salA);
    }
    if (rows[1]) {
        rows[1].querySelector('.batch-emp-company').value = coB;
        rows[1].querySelector('.batch-emp-sy').value = '2025';
        rows[1].querySelector('.batch-emp-sm').value = '7';
        rows[1].querySelector('.batch-emp-ey').value = String(new Date().getFullYear());
        rows[1].querySelector('.batch-emp-em').value = String(new Date().getMonth() + 1);
        rows[1].querySelector('.batch-emp-salary').value = String(salB);
    }
    showMsg('已填入两段演示工作经历（A：2024-05～2025-06；B：2025-07～当前月），请在确认框中核对后写入', true);
    setTimeout(function () {
        batchAddEmploymentTaxRecords();
    }, 280);
}

/** 批量记住各段公司档案。 */
function rememberBatchEmploymentsProfiles(employments) {
    employments.forEach(function (e) {
        rememberBatchCompanyProfile({
            name: e.company,
            company_tax_id: e.company_tax_id || '',
            tax_authority: e.tax_authority || ''
        });
    });
}

function employmentsForBonusAssembly(employments, includeBonus) {
    if (includeBonus) {
        return employments;
    }
    return employments.map(function (emp) {
        return Object.assign({}, emp, { yearEndBonus: 0, extraBonuses: [], bonuses: [] });
    });
}

function countEmploymentBonuses(employments) {
    var n = 0;
    (employments || []).forEach(function (emp) {
        n += employmentBonusList(emp).length;
    });
    return n;
}

// === 一键写入 / 覆盖修改主流程 ===
/**
 * 主流程：确认后按工作经历生成月薪（及年终奖）并保存。
 * 副作用：可能删示例旧记录、API 写入、清草稿、刷新列表、转化引导。
 */
function batchAddEmploymentTaxRecords() {
    var parsed = prepareBatchAddEmploymentsFromDom();
    if (!parsed.ok) {
        window.__taxExampleOneClick = false;
        showConsultStrongAlert(parsed.error || '请检查工作经历');
        return;
    }
    var employments = parsed.employments;
    var uid = currentUserId();
    var uidKey = String(uid).replace(/[^a-zA-Z0-9_-]/g, '_');
    var base = formObjectFromInputs();
    delete base.id;
    var built = buildBatchEmploymentWrites(employments);
    var writes = built.writes;
    var taxSumSalary = built.taxSumSalary;
    var bonusTaxSum = sumEmploymentBonusTax(employments);
    var totalTax = round2(taxSumSalary + bonusTaxSum);
    var lines = buildBatchConfirmLines(employments);
    var bonusLine = buildBatchBonusConfirmText(employments);
    apiFetchRecords()
        .then(function (existingList) {
            var examplePlan = planBatchExampleRecordDeletion(employments, existingList);
            var exampleDeleteLine =
                examplePlan.count > 0
                    ? '\n将先删除此前示例填写产生的 ' +
                      examplePlan.count +
                      ' 条记录（' +
                      examplePlan.companies.join('、') +
                      '），再写入您的数据。'
                    : '';
            var exampleOneClick =
                !!window.__taxExampleOneClick && (!existingList || !existingList.length);
            window.__taxExampleOneClick = false;
            var msgParts = exampleOneClick
                ? ['将生成今年至今的示例工资记录，可随时改或删除。是否继续？']
                : [
                    '将为以下工作经历写入工资薪金记录（同一经历内按自然年度分段累计预扣）：',
                    lines.join('\n'),
                    '工资薪金预扣税额合计约 ' + taxSumSalary + ' 元。',
                    bonusLine,
                    '税额总计约 ' + totalTax + ' 元。',
                    exampleDeleteLine,
                    '将新增写入，不会覆盖列表中已有记录（若编号已占用则自动使用新编号）。是否写入？'
                ];
            if (!confirm(msgParts.join('\n'))) {
                return null;
            }
            setBatchSubmitBtnLoading(true);
            var deletedExample = 0;
            return deleteBatchExampleTaxRecordsPromise(examplePlan.companies)
                .then(function (n) {
                    deletedExample = n;
                    var records = assembleBatchTaxRecords(writes, base, uidKey, employments);
                    return postBatchTaxRecordsPromise(records).then(function (data) {
                        return { data: data, deletedExample: deletedExample };
                    });
                });
        })
        .then(function (result) {
            if (!result) {
                return;
            }
            var data = result.data;
            var deletedExample = result.deletedExample;
            rememberBatchEmploymentsProfiles(employments);
            var bonusCount = countEmploymentBonuses(employments);
            var tip =
                '已按工作经历生成 ' +
                employments.length +
                ' 段用工共 ' +
                writes.length +
                ' 条月薪记录';
            if (bonusCount > 0) {
                tip += '（另含 ' + bonusCount + ' 条年终奖）';
            }
            if (deletedExample > 0) {
                tip += '（已删除示例记录 ' + deletedExample + ' 条）';
            }
            var reassigned = data && data.reassigned_ids != null ? Number(data.reassigned_ids) : 0;
            if (reassigned > 0) {
                tip += '（' + reassigned + ' 条因编号已存在已另存为新记录，未覆盖原记录）';
            }
            tip = appendAutoDedupedTip(tip, data);
            clearBatchTaxDraft();
            showMsg(tip, true);
            try {
                localStorage.setItem('tax_record_count', String(Math.max(1, writes.length)));
            } catch (eTaxCnt) {}
            if (window.ConversionGuide && typeof window.ConversionGuide.refresh === 'function') {
                window.ConversionGuide.refresh();
            }
            return refreshRecordList().then(function (list) {
                afterBatchTaxWriteSuccess();
                invokeAfterTaxRecordsCreated({ source: 'batch', records: list });
                return list;
            });
        })
        .catch(function (err) {
            showConsultStrongAlert('批量生成失败：' + friendlyConsultTaxError(err && err.message));
            return refreshRecordList();
        })
        .finally(function () {
            setBatchSubmitBtnLoading(false);
        });
}

/**
 * 覆盖修改：删除回填关联旧记录后重写。
 * 副作用：replace API、退出修改模式、刷新列表。
 */
function batchUpdateEmploymentTaxRecords() {
    if (!batchTaxEditMode || !batchTaxEditMode.scopeIds || !batchTaxEditMode.scopeIds.length) {
        showConsultStrongAlert('请先通过「更多 → 从已有回填」或列表「回填修改」进入修改模式');
        return;
    }
    var parsed = parseBatchEmploymentsFromDom();
    if (!parsed.ok) {
        showConsultStrongAlert(parsed.error || '请检查工作经历');
        return;
    }
    var employments = parsed.employments;
    var uid = currentUserId();
    var uidKey = String(uid).replace(/[^a-zA-Z0-9_-]/g, '_');
    var base = formObjectFromInputs();
    delete base.id;
    var built = buildBatchEmploymentWrites(employments);
    var writes = built.writes;
    var taxSumSalary = built.taxSumSalary;
    var bonusChanged = batchBonusWasManuallyChanged();
    var bonusTaxSum = sumEmploymentBonusTax(employments);
    var totalTax = round2(taxSumSalary + (bonusChanged ? bonusTaxSum : 0));
    var lines = buildBatchConfirmLines(employments);
    var scopeN = batchTaxEditMode.scopeIds.length;
    var bonusLine = '';
    if (bonusChanged) {
        bonusLine = buildBatchBonusConfirmText(employments);
        if (!bonusLine) {
            bonusLine = '\n年终奖已清空，将删除原有年终奖记录。';
        } else {
            bonusLine = bonusLine.replace(/。$/, '，将更新年终奖记录。');
        }
    } else if (batchTaxEditMode.bonusRecordIds && batchTaxEditMode.bonusRecordIds.length) {
        bonusLine =
            '\n已有 ' +
            batchTaxEditMode.bonusRecordIds.length +
            ' 条年终奖记录将保留不变（未修改年终奖字段）。';
    }
    var msgParts = [
        '将删除回填时关联的 ' + scopeN + ' 条月薪旧记录，并重新生成：',
        lines.join('\n'),
        '新工资薪金 ' + writes.length + ' 条，预扣税额合计约 ' + taxSumSalary + ' 元。',
        bonusLine,
        '税额总计约 ' + totalTax + ' 元。此操作不可撤销，是否覆盖？'
    ];
    if (!confirm(msgParts.join('\n'))) {
        return;
    }
    var records = assembleBatchTaxRecords(
        writes,
        base,
        uidKey,
        employmentsForBonusAssembly(employments, bonusChanged)
    );
    var idsToDelete = batchTaxEditMode.scopeIds.slice();
    if (bonusChanged && batchTaxEditMode.bonusRecordIds && batchTaxEditMode.bonusRecordIds.length) {
        idsToDelete = idsToDelete.concat(batchTaxEditMode.bonusRecordIds);
    }
    setBatchTaxActionLoading(true, true);
    postBatchReplaceTaxRecordsPromise(idsToDelete, records)
        .then(function (data) {
            rememberBatchEmploymentsProfiles(employments);
            var deleted = data && data.deleted != null ? Number(data.deleted) : idsToDelete.length;
            var saved = data && data.saved != null ? Number(data.saved) : records.length;
            var tip =
                '已覆盖修改：删除 ' + deleted + ' 条，写入 ' + saved + ' 条（' + employments.length + ' 段工作经历）';
            if (bonusChanged && countEmploymentBonuses(employments) > 0) {
                tip += '，已更新年终奖';
            } else if (bonusChanged) {
                tip += '，已移除年终奖';
            } else if (batchTaxEditMode.bonusRecordIds && batchTaxEditMode.bonusRecordIds.length) {
                tip += '，年终奖未改动已保留';
            }
            tip = appendAutoDedupedTip(tip, data);
            clearBatchTaxDraft();
            exitBatchTaxEditMode();
            showMsg(tip, true);
            return refreshRecordList().then(function (list) {
                afterBatchTaxWriteSuccess();
                return list;
            });
        })
        .catch(function (err) {
            showConsultStrongAlert('批量修改失败：' + (err.message || ''));
            return refreshRecordList();
        })
        .finally(function () {
            setBatchTaxActionLoading(false, true);
        });
}


// === window 导出（onclick / 管理端） ===
/* admin / inline-onclick 兼容：显式挂到 window */
window.oneClickGenerateBatchTaxRecords = oneClickGenerateBatchTaxRecords;
window.batchAddEmploymentTaxRecords = batchAddEmploymentTaxRecords;
window.batchUpdateEmploymentTaxRecords = batchUpdateEmploymentTaxRecords;
window.batchAddYearEndBonusOnly = batchAddYearEndBonusOnly;
window.fillBatchTaxExample = fillBatchTaxExample;
window.openTaxStartPath = openTaxStartPath;
window.openTaxPasteImportModal = openTaxPasteImportModal;
window.addBatchEmpRow = addBatchEmpRow;
window.setBatchEmpRowValues = setBatchEmpRowValues;
window.setBatchEmpBonusesOnRow = setBatchEmpBonusesOnRow;
window.collectBatchEmpBonusesFromRow = collectBatchEmpBonusesFromRow;
window.loadBatchEmploymentsFromExistingRecords = loadBatchEmploymentsFromExistingRecords;
window.exitBatchTaxEditMode = exitBatchTaxEditMode;
window.closeBatchTaxMoreMenu = closeBatchTaxMoreMenu;
