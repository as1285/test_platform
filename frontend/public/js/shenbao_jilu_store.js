/**
 * 申报记录列表与详情共用存储（服务端 api/shenbao-jilu）
 */
(function (global) {
    var LIST_AMOUNT_LABEL = '应退税额';

    var AMOUNT_TYPES = {
        refunded: LIST_AMOUNT_LABEL,
        refundable: LIST_AMOUNT_LABEL,
        paid: LIST_AMOUNT_LABEL
    };

    var DETAIL_FIELD_DEFAULTS = {
        supplementTax: '1632.86',
        lateFee: '0.00',
        paidThisTime: '1632.86',
        refundedThisTime: '0.00',
        taxAuthority: '国家税务总局昆明市税务局第一税务分局（重点税源企业税收服务和管理局）',
        employer: '云南白药集团股份有限公司',
        totalIncome: '194168.17',
        totalExpense: '0.00',
        exemptIncome: '0.00',
        basicDeduction: '60000.00',
        specialDeduction: '21686.88',
        specialAdditionalDeduction: '37000.00',
        otherDeduction: '665.56',
        donationDeduction: '0.00',
        taxableIncome: '74815.73',
        taxPayable: '4961.57',
        taxReduction: '0.00',
        taxPaid: '3328.71'
    };

    function userId() {
        return localStorage.getItem('user_id') || localStorage.getItem('userName') || 'guest';
    }

    function legacyStorageKey(tab) {
        return 'shenbao_jilu_' + tab + '_' + userId();
    }

    function migrateFlagKey(tab) {
        return 'shenbao_api_migrated_' + tab + '_' + userId();
    }

    function taxYearFromRecord(r) {
        if (r.taxYear) {
            return String(r.taxYear);
        }
        if (r.periodEnd && /^\d{4}/.test(r.periodEnd)) {
            return r.periodEnd.slice(0, 4);
        }
        if (r.groupMonth && /^\d{4}/.test(r.groupMonth)) {
            return r.groupMonth.slice(0, 4);
        }
        return '';
    }

    function mergeDetailRecord(r) {
        var out = Object.assign({}, DETAIL_FIELD_DEFAULTS, r);
        out.taxYear = taxYearFromRecord(r);
        return out;
    }

    function designDetailTemplate(r) {
        var out = Object.assign({}, DETAIL_FIELD_DEFAULTS, {
            id: r.id,
            groupMonth: r.groupMonth,
            title: r.title,
            periodStart: r.periodStart,
            periodEnd: r.periodEnd,
            amountType: r.amountType,
            amount: r.amount,
            taxAuthority: r.taxAuthority || DETAIL_FIELD_DEFAULTS.taxAuthority,
            employer: r.employer || DETAIL_FIELD_DEFAULTS.employer
        });
        out.taxYear = taxYearFromRecord(r);
        return out;
    }

    var REFUND_STATUS_OPTIONS = [
        { value: 'submitted', label: '提交申请成功' },
        { value: 'audit_passed', label: '税务审核通过' },
        { value: 'treasury_done', label: '国库处理完成' }
    ];

    function defaultRefundSteps() {
        return [
            { title: '提交申请成功', date: '2026-03-28', hint: '' },
            { title: '税务审核通过', date: '2026-03-28', hint: '' },
            { title: '国库处理完成', date: '2026-03-31', hint: '请关注退税到账情况' }
        ];
    }

    function createRefundRecord(partial) {
        return Object.assign(
            {
                id: 'rf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                amount: '2400.00',
                applyTime: '2026-03-28 14:35',
                status: 'treasury_done',
                statusLabel: '国库处理完成',
                expanded: false,
                steps: defaultRefundSteps()
            },
            partial || {}
        );
    }

    function defaultRefundRecords() {
        return [createRefundRecord({ id: 'rf_default_1', expanded: false })];
    }

    function normalizeRefundRecord(r) {
        var item = Object.assign(createRefundRecord(), r || {});
        item.id = String(item.id || createRefundRecord().id);
        item.amount = String(item.amount != null ? item.amount : '0.00')
            .replace(/元/g, '')
            .trim();
        if (item.amount && !isNaN(parseFloat(item.amount))) {
            item.amount = parseFloat(item.amount).toFixed(2);
        }
        item.applyTime = String(item.applyTime != null ? item.applyTime : '').trim();
        item.statusLabel = String(item.statusLabel != null ? item.statusLabel : '').trim();
        if (!item.statusLabel) {
            var opt = REFUND_STATUS_OPTIONS.filter(function (o) {
                return o.value === item.status;
            })[0];
            item.statusLabel = opt ? opt.label : '国库处理完成';
        }
        item.expanded = !!item.expanded;
        if (!Array.isArray(item.steps) || !item.steps.length) {
            item.steps = defaultRefundSteps();
        } else {
            item.steps = item.steps.map(function (s) {
                return {
                    title: String((s && s.title) || '').trim() || '—',
                    date: String((s && s.date) || '').trim(),
                    hint: String((s && s.hint) || '').trim()
                };
            });
        }
        return item;
    }

    function normalizeRefundRecords(raw) {
        if (!Array.isArray(raw)) {
            return defaultRefundRecords();
        }
        if (!raw.length) {
            return [];
        }
        return raw.map(normalizeRefundRecord);
    }

    var INCOME_CATEGORIES = [
        { key: 'salary', label: '工资薪金', defaultSubtype: '正常工资薪金' },
        { key: 'labor', label: '劳务报酬', defaultSubtype: '一般劳务报酬' },
        { key: 'author', label: '稿酬所得', defaultSubtype: '稿酬所得' },
        { key: 'royalty', label: '特许权使用费', defaultSubtype: '特许权使用费所得' }
    ];

    function defaultSalaryIncomeItems() {
        return [
            { id: 'inc_s1', period: '2025-12', subtype: '正常工资薪金', employer: '深圳嘉信恒泰科技有限公司', amount: '15600.00' },
            { id: 'inc_s2', period: '2025-11', subtype: '正常工资薪金', employer: '深圳嘉信恒泰科技有限公司', amount: '31200.00' },
            { id: 'inc_s3', period: '2025-10', subtype: '正常工资薪金', employer: '深圳嘉信恒泰科技有限公司', amount: '31200.00' },
            { id: 'inc_s4', period: '2025-09', subtype: '正常工资薪金', employer: '深圳市绿联科技股份有限公司', amount: '13161.43' },
            { id: 'inc_s5', period: '2025-09', subtype: '正常工资薪金', employer: '深圳嘉信恒泰科技有限公司', amount: '5199.99' },
            { id: 'inc_s6', period: '2025-08', subtype: '正常工资薪金', employer: '深圳嘉信恒泰科技有限公司', amount: '0.00' },
            { id: 'inc_s7', period: '2025-07', subtype: '正常工资薪金', employer: '深圳市赢锋智能技术有限公司', amount: '28786.00' }
        ];
    }

    function defaultRoyaltyIncomeItems() {
        return [
            {
                id: 'inc_r1',
                period: '2025-03',
                subtype: '特许权使用费所得',
                employer: '天津智锐人力资源有限公司',
                amount: '100.00'
            }
        ];
    }

    function defaultIncomeBreakdown() {
        return {
            salary: defaultSalaryIncomeItems(),
            labor: [],
            author: [],
            royalty: defaultRoyaltyIncomeItems()
        };
    }

    function createIncomeItem(partial) {
        return Object.assign(
            {
                id: 'inc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                period: '2025-12',
                subtype: '正常工资薪金',
                employer: '',
                amount: '0.00'
            },
            partial || {}
        );
    }

    function normalizeIncomeItem(item, defaultSubtype) {
        var out = Object.assign(createIncomeItem({ subtype: defaultSubtype || '正常工资薪金' }), item || {});
        out.id = String(out.id || createIncomeItem().id);
        out.period = String(out.period != null ? out.period : '').trim();
        out.subtype = String(out.subtype != null ? out.subtype : defaultSubtype || '').trim();
        out.employer = String(out.employer != null ? out.employer : '').trim();
        var amt = String(out.amount != null ? out.amount : '0.00')
            .replace(/元/g, '')
            .trim();
        if (amt && !isNaN(parseFloat(amt))) {
            amt = parseFloat(amt).toFixed(2);
        } else {
            amt = '0.00';
        }
        out.amount = amt;
        return out;
    }

    function normalizeIncomeBreakdown(raw) {
        var base = defaultIncomeBreakdown();
        var src = raw && typeof raw === 'object' ? raw : {};
        var out = {};
        INCOME_CATEGORIES.forEach(function (cat) {
            var list = Array.isArray(src[cat.key]) ? src[cat.key] : base[cat.key];
            out[cat.key] = list.map(function (item) {
                return normalizeIncomeItem(item, cat.defaultSubtype);
            });
        });
        return out;
    }

    function sumIncomeBreakdown(breakdown) {
        var total = 0;
        INCOME_CATEGORIES.forEach(function (cat) {
            (breakdown[cat.key] || []).forEach(function (item) {
                var n = parseFloat(item.amount);
                if (!isNaN(n)) {
                    total += n;
                }
            });
        });
        return total.toFixed(2);
    }

    function attachIncomeBreakdown(rec) {
        if (!rec) {
            return rec;
        }
        if (!rec.incomeBreakdown || !Array.isArray(rec.incomeBreakdown.salary)) {
            rec.incomeBreakdown = rec.detailCustomized
                ? normalizeIncomeBreakdown(rec.incomeBreakdown)
                : defaultIncomeBreakdown();
        } else {
            rec.incomeBreakdown = normalizeIncomeBreakdown(rec.incomeBreakdown);
        }
        return rec;
    }

    function attachRefundRecords(rec) {
        if (!rec) {
            return rec;
        }
        rec.refundRecords = normalizeRefundRecords(rec.refundRecords);
        return attachIncomeBreakdown(rec);
    }

    function recordForDetail(rec) {
        if (!rec) {
            return null;
        }
        var base;
        if (rec.detailCustomized) {
            base = mergeDetailRecord(rec);
        } else {
            base = designDetailTemplate(rec);
        }
        return attachRefundRecords(base);
    }

    function apiJson(url, opts) {
        if (typeof global.authFetch !== 'function') {
            return Promise.reject(new Error('请先登录'));
        }
        return global.authFetch(url, opts).then(function (res) {
            return res.json();
        });
    }

    function migrateLegacyOnce(tab) {
        try {
            if (localStorage.getItem(migrateFlagKey(tab)) === '1') {
                return Promise.resolve();
            }
            var raw = localStorage.getItem(legacyStorageKey(tab));
            if (!raw) {
                localStorage.setItem(migrateFlagKey(tab), '1');
                return Promise.resolve();
            }
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) || !parsed.length) {
                localStorage.setItem(migrateFlagKey(tab), '1');
                return Promise.resolve();
            }
            return apiJson('api/shenbao-jilu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'batch_save', tab: tab, records: parsed })
            }).then(function (data) {
                if (data.code !== 200) {
                    throw new Error(data.msg || '迁移失败');
                }
                localStorage.setItem(migrateFlagKey(tab), '1');
            });
        } catch (e) {
            return Promise.resolve();
        }
    }

    function loadRecords(tab) {
        return migrateLegacyOnce(tab)
            .then(function () {
                return apiJson('api/shenbao-jilu?action=list&tab=' + encodeURIComponent(tab));
            })
            .then(function (data) {
                if (data.code !== 200) {
                    throw new Error(data.msg || '加载失败');
                }
                return (data.data && data.data.records) || [];
            });
    }

    function pad2(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function generateNewRecordId() {
        return 'r' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    }

    function createNewRecordTemplate(tab) {
        var now = new Date();
        var y = now.getFullYear();
        var taxYear = String(y - 1);
        var groupMonth = y + '-' + pad2(now.getMonth() + 1);
        var blankMoney = {
            supplementTax: '0.00',
            lateFee: '0.00',
            paidThisTime: '0.00',
            refundedThisTime: '0.00',
            totalIncome: '0.00',
            totalExpense: '0.00',
            exemptIncome: '0.00',
            basicDeduction: '0.00',
            specialDeduction: '0.00',
            specialAdditionalDeduction: '0.00',
            otherDeduction: '0.00',
            donationDeduction: '0.00',
            taxableIncome: '0.00',
            taxPayable: '0.00',
            taxReduction: '0.00',
            taxPaid: '0.00',
            amount: '0.00'
        };
        return attachRefundRecords(
            Object.assign({}, DETAIL_FIELD_DEFAULTS, blankMoney, {
                id: 'new',
                groupMonth: groupMonth,
                title: taxYear + '年度综合所得年度汇算',
                periodStart: taxYear + '-01',
                periodEnd: taxYear + '-12',
                taxYear: taxYear,
                amountType: 'refunded',
                taxAuthority: DETAIL_FIELD_DEFAULTS.taxAuthority,
                employer: DETAIL_FIELD_DEFAULTS.employer,
                detailCustomized: false,
                refundRecords: defaultRefundRecords()
            })
        );
    }

    function loadRecordForDetail(tab, id) {
        if (String(id) === 'new') {
            return Promise.resolve(createNewRecordTemplate(tab));
        }
        return migrateLegacyOnce(tab)
            .then(function () {
                return apiJson(
                    'api/shenbao-jilu?action=get&tab=' +
                        encodeURIComponent(tab) +
                        '&id=' +
                        encodeURIComponent(id)
                );
            })
            .then(function (data) {
                if (data.code === 404) {
                    return null;
                }
                if (data.code !== 200) {
                    throw new Error(data.msg || '加载失败');
                }
                var rec = (data.data && data.data.record) || null;
                return attachRefundRecords(rec);
            });
    }

    function findRecord(tab, id) {
        return loadRecords(tab).then(function (list) {
            for (var i = 0; i < list.length; i++) {
                if (String(list[i].id) === String(id)) {
                    return list[i];
                }
            }
            return null;
        });
    }

    function saveRecord(tab, record) {
        var payload = Object.assign({}, record);
        payload.detailCustomized = true;
        return apiJson('api/shenbao-jilu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save_record', tab: tab, record: payload })
        }).then(function (data) {
            if (data.code !== 200) {
                throw new Error(data.msg || '保存失败');
            }
            var saved = (data.data && data.data.record) || payload;
            saved.detailCustomized = true;
            return saved;
        });
    }

    function deleteRecord(tab, id) {
        return apiJson('api/shenbao-jilu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_record', tab: tab, id: id })
        }).then(function (data) {
            if (data.code !== 200) {
                throw new Error(data.msg || '删除失败');
            }
        });
    }

    function formatAmountDisplay(amount) {
        var s = String(amount == null ? '' : amount)
            .replace(/元/g, '')
            .trim();
        if (!s) {
            s = '0.00';
        }
        var n = parseFloat(s);
        if (!isNaN(n)) {
            s = n.toFixed(2);
        }
        return s + '元';
    }

    /** 列表展示：与详情「应退税额」(supplementTax) 一致 */
    function listSupplementTaxAmount(record) {
        var sup = String(record.supplementTax != null ? record.supplementTax : '')
            .replace(/元/g, '')
            .trim();
        if (record.detailCustomized && sup !== '') {
            return sup;
        }
        if (record.detailCustomized) {
            var amt = String(record.amount != null ? record.amount : '')
                .replace(/元/g, '')
                .trim();
            return amt || '0.00';
        }
        return String(record.amount != null ? record.amount : '0')
            .replace(/元/g, '')
            .trim() || '0.00';
    }

    function amountLine(record) {
        return LIST_AMOUNT_LABEL + '：' + formatAmountDisplay(listSupplementTaxAmount(record));
    }

    function noop() {}

    global.ShenbaoJiluStore = {
        AMOUNT_TYPES: AMOUNT_TYPES,
        INCOME_CATEGORIES: INCOME_CATEGORIES,
        REFUND_STATUS_OPTIONS: REFUND_STATUS_OPTIONS,
        defaultRefundRecords: defaultRefundRecords,
        defaultIncomeBreakdown: defaultIncomeBreakdown,
        normalizeIncomeBreakdown: normalizeIncomeBreakdown,
        createIncomeItem: createIncomeItem,
        normalizeIncomeItem: normalizeIncomeItem,
        sumIncomeBreakdown: sumIncomeBreakdown,
        normalizeRefundRecords: normalizeRefundRecords,
        createRefundRecord: createRefundRecord,
        loadRecords: loadRecords,
        loadRecordForDetail: loadRecordForDetail,
        createNewRecordTemplate: createNewRecordTemplate,
        generateNewRecordId: generateNewRecordId,
        findRecord: findRecord,
        findRecordForDetail: loadRecordForDetail,
        saveRecord: saveRecord,
        deleteRecord: deleteRecord,
        amountLine: amountLine,
        clearVoidTabSeedOnce: noop,
        zeroListAmountsOnce: noop,
        fixCorruptedDetailOnce: noop
    };
})(typeof window !== 'undefined' ? window : this);
