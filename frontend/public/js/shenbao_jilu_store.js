/**
 * 申报记录列表与详情共用存储（localStorage）
 */
(function (global) {
    var AMOUNT_TYPES = {
        refunded: '已退税额',
        refundable: '可申请退税额',
        paid: '已缴税额'
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

    var DEFAULT_RECORDS = [
        {
            id: '1',
            groupMonth: '2026-03',
            title: '2025年度综合所得年度汇算',
            periodStart: '2025-01',
            periodEnd: '2025-12',
            amountType: 'refunded',
            amount: '0.00'
        },
        {
            id: '2',
            groupMonth: '2025-03',
            title: '2024年度综合所得年度汇算',
            periodStart: '2024-01',
            periodEnd: '2024-12',
            amountType: 'refunded',
            amount: '0.00'
        },
        {
            id: '3',
            groupMonth: '2024-03',
            title: '2023年度综合所得年度汇算',
            periodStart: '2023-01',
            periodEnd: '2023-12',
            amountType: 'refundable',
            amount: '0.00'
        },
        {
            id: '4',
            groupMonth: '2023-05',
            title: '2022年度综合所得年度汇算',
            periodStart: '2022-01',
            periodEnd: '2022-12',
            amountType: 'refundable',
            amount: '0.00'
        },
        {
            id: '5',
            groupMonth: '2022-06',
            title: '2021年度综合所得年度汇算',
            periodStart: '2021-01',
            periodEnd: '2021-12',
            amountType: 'paid',
            amount: '0.00'
        }
    ];

    function userId() {
        return localStorage.getItem('user_id') || localStorage.getItem('userName') || 'guest';
    }

    function storageKey(tab) {
        return 'shenbao_jilu_' + tab + '_' + userId();
    }

    function cloneDefaults() {
        return DEFAULT_RECORDS.map(function (r) {
            return enrichRecord(Object.assign({}, r));
        });
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

    function syncPaymentFromList(r) {
        var out = Object.assign({}, DETAIL_FIELD_DEFAULTS, r);
        var amt = String(r.amount || '0').replace(/元$/, '').trim() || '0.00';
        if (r.amountType === 'refunded') {
            out.refundedThisTime = amt;
            out.paidThisTime = '0.00';
            out.supplementTax = '0.00';
        } else if (r.amountType === 'paid') {
            out.paidThisTime = amt;
            out.supplementTax = amt;
            out.refundedThisTime = '0.00';
        } else {
            out.refundedThisTime = '0.00';
            out.paidThisTime = '0.00';
            out.supplementTax = '0.00';
        }
        out.taxYear = taxYearFromRecord(r);
        return out;
    }

    function enrichRecord(r, opts) {
        if (opts && opts.preservePayment) {
            var kept = Object.assign({}, DETAIL_FIELD_DEFAULTS, r);
            kept.taxYear = taxYearFromRecord(r);
            return kept;
        }
        return syncPaymentFromList(r);
    }

    function loadRecords(tab) {
        if (tab === 'void') {
            try {
                var rawVoid = localStorage.getItem(storageKey(tab));
                if (!rawVoid) {
                    return [];
                }
                var parsedVoid = JSON.parse(rawVoid);
                if (!Array.isArray(parsedVoid)) {
                    return [];
                }
                return parsedVoid.map(enrichRecord);
            } catch (e) {
                return [];
            }
        }
        try {
            var raw = localStorage.getItem(storageKey(tab));
            if (!raw) {
                return cloneDefaults();
            }
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed) || !parsed.length) {
                return cloneDefaults();
            }
            return parsed.map(enrichRecord);
        } catch (e) {
            return cloneDefaults();
        }
    }

    function saveRecords(tab, list) {
        localStorage.setItem(storageKey(tab), JSON.stringify(list));
    }

    function findRecord(tab, id) {
        var list = loadRecords(tab);
        for (var i = 0; i < list.length; i++) {
            if (String(list[i].id) === String(id)) {
                return list[i];
            }
        }
        return null;
    }

    /** 详情页：使用设计稿默认税额，不受列表 0 元影响 */
    function findRecordForDetail(tab, id) {
        var r = findRecord(tab, id);
        if (!r) {
            return null;
        }
        if (r.detailCustomized) {
            return enrichRecord(r, { preservePayment: true });
        }
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

    function saveRecord(tab, record, opts) {
        var list = loadRecords(tab);
        var found = false;
        var merged = enrichRecord(record, opts);
        for (var i = 0; i < list.length; i++) {
            if (String(list[i].id) === String(record.id)) {
                list[i] = merged;
                found = true;
                break;
            }
        }
        if (!found) {
            list.push(merged);
        }
        merged.detailCustomized = true;
        for (var j = 0; j < list.length; j++) {
            if (String(list[j].id) === String(record.id)) {
                list[j].detailCustomized = true;
                break;
            }
        }
        saveRecords(tab, list);
        return list;
    }

    function amountLine(record) {
        var label = AMOUNT_TYPES[record.amountType] || AMOUNT_TYPES.refunded;
        return label + '：0.00元';
    }

    function zeroListAmountsOnce() {
        try {
            if (localStorage.getItem('shenbao_jilu_list_zero_v1') === '1') {
                return;
            }
            ['done', 'void'].forEach(function (tab) {
                var key = storageKey(tab);
                var raw = localStorage.getItem(key);
                if (!raw) {
                    return;
                }
                var parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) {
                    return;
                }
                var changed = false;
                parsed.forEach(function (item) {
                    if (item && String(item.amount) !== '0.00' && String(item.amount) !== '0') {
                        item.amount = '0.00';
                        changed = true;
                    }
                });
                if (changed) {
                    localStorage.setItem(key, JSON.stringify(parsed));
                }
            });
            localStorage.setItem('shenbao_jilu_list_zero_v1', '1');
        } catch (e) {}
    }

    function clearVoidTabSeedOnce() {
        try {
            if (localStorage.getItem('shenbao_jilu_void_seed_removed') === '1') {
                return;
            }
            localStorage.removeItem(storageKey('void'));
            localStorage.setItem('shenbao_jilu_void_seed_removed', '1');
        } catch (e) {}
    }

    global.ShenbaoJiluStore = {
        AMOUNT_TYPES: AMOUNT_TYPES,
        loadRecords: loadRecords,
        saveRecords: saveRecords,
        findRecord: findRecord,
        findRecordForDetail: findRecordForDetail,
        saveRecord: saveRecord,
        enrichRecord: enrichRecord,
        amountLine: amountLine,
        clearVoidTabSeedOnce: clearVoidTabSeedOnce,
        zeroListAmountsOnce: zeroListAmountsOnce
    };
})(typeof window !== 'undefined' ? window : this);
