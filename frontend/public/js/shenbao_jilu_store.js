/**
 * 申报记录列表与详情共用存储（服务端 api/shenbao_jilu.php）
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

    function recordForDetail(rec) {
        if (!rec) {
            return null;
        }
        if (rec.detailCustomized) {
            return mergeDetailRecord(rec);
        }
        return designDetailTemplate(rec);
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
            return apiJson('api/shenbao_jilu.php', {
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
                return apiJson('api/shenbao_jilu.php?action=list&tab=' + encodeURIComponent(tab));
            })
            .then(function (data) {
                if (data.code !== 200) {
                    throw new Error(data.msg || '加载失败');
                }
                return (data.data && data.data.records) || [];
            });
    }

    function loadRecordForDetail(tab, id) {
        return migrateLegacyOnce(tab)
            .then(function () {
                return apiJson(
                    'api/shenbao_jilu.php?action=get&tab=' +
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
                return (data.data && data.data.record) || null;
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
        return apiJson('api/shenbao_jilu.php', {
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
        loadRecords: loadRecords,
        loadRecordForDetail: loadRecordForDetail,
        findRecord: findRecord,
        findRecordForDetail: loadRecordForDetail,
        saveRecord: saveRecord,
        amountLine: amountLine,
        clearVoidTabSeedOnce: noop,
        zeroListAmountsOnce: noop,
        fixCorruptedDetailOnce: noop
    };
})(typeof window !== 'undefined' ? window : this);
