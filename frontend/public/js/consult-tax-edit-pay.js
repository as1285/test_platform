/** 个税修改付费：同行账号仅当天无限 */
(function (global) {
    var LEGACY_SINGLE_SKU = 'sku_tax_edit_fee_20';
    var DAILY_SKU = 'sku_tax_edit_unlimited_30';
    var pollTimer = null;
    var pendingOutTradeNo = '';
    var pendingSku = '';
    var payWaiters = [];
    var promptOpen = false;
    var lastPolicy = null;

    function formatYuan(raw, fallback) {
        var n = Number(String(raw == null ? '' : raw).replace(/,/g, '').trim());
        if (!isFinite(n) || n <= 0) return fallback || '';
        return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
    }

    function policyYuan(policy, key, fallback) {
        return formatYuan(policy && policy[key], fallback);
    }

    function dailyYuan() {
        return policyYuan(lastPolicy, 'daily_amount', '30');
    }

    function authFetch(url, opts) {
        if (typeof global.authFetch === 'function') {
            return global.authFetch(url, opts);
        }
        var token = '';
        try {
            token =
                (typeof global.authGetToken === 'function' && global.authGetToken()) ||
                localStorage.getItem('token') ||
                '';
        } catch (eTok) {
            token = '';
        }
        var headers = Object.assign(
            { 'Content-Type': 'application/json' },
            token ? { Authorization: 'Bearer ' + token } : {},
            (opts && opts.headers) || {}
        );
        return fetch(url, Object.assign({}, opts || {}, { headers: headers, credentials: 'same-origin' }));
    }

    function ensureModal() {
        var root = document.getElementById('consultTaxEditPayModal');
        if (root) return root;
        root = document.createElement('div');
        root.id = 'consultTaxEditPayModal';
        root.className = 'activate-modal-root';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-labelledby', 'consultTaxEditPayTitle');
        root.innerHTML =
            '<div class="activate-modal-mask" id="consultTaxEditPayMask"></div>' +
            '<div class="activate-modal-panel consult-tax-edit-pay-panel">' +
            '<p class="activate-modal-title" id="consultTaxEditPayTitle">同行账号需付费修改</p>' +
            '<p class="activate-modal-hint" id="consultTaxEditPayHint" style="display:block;margin:0 0 12px;font-size:13px;color:#666;line-height:1.55;">' +
            '同行账号（改名超过 8 次或个税修改超过 8 天）后续修改需先支付当天无限费用。</p>' +
            '<div class="consult-tax-edit-pay-choices" id="consultTaxEditPayChoices" hidden>' +
            '<button type="button" class="btn btn-primary btn-block" id="btnConsultTaxEditPayDaily">支付 ¥30，当天无限改</button>' +
            '</div>' +
            '<div id="consultTaxEditPayQrWrap" class="consult-tax-edit-pay-qr" hidden></div>' +
            '<p id="consultTaxEditPayStatus" class="consult-tax-edit-pay-status">—</p>' +
            '<div class="activate-modal-actions">' +
            '<button type="button" class="btn btn-default btn-sm" id="btnConsultTaxEditPayCancel">取消</button>' +
            '<button type="button" class="btn btn-primary btn-sm" id="btnConsultTaxEditPayRefresh">我已支付</button>' +
            '</div></div>';
        document.body.appendChild(root);
        var mask = document.getElementById('consultTaxEditPayMask');
        var cancel = document.getElementById('btnConsultTaxEditPayCancel');
        var refresh = document.getElementById('btnConsultTaxEditPayRefresh');
        var btnDaily = document.getElementById('btnConsultTaxEditPayDaily');
        if (mask) mask.addEventListener('click', function () { closeModal(false); });
        if (cancel) cancel.addEventListener('click', function () { closeModal(false); });
        if (refresh) refresh.addEventListener('click', function () { pollOnce(true); });
        if (btnDaily) {
            btnDaily.addEventListener('click', function () {
                startPay();
            });
        }
        return root;
    }

    function setStatus(msg) {
        var el = document.getElementById('consultTaxEditPayStatus');
        if (el) el.textContent = msg || '—';
    }

    function settle(ok) {
        var list = payWaiters.splice(0, payWaiters.length);
        list.forEach(function (fn) {
            try {
                fn(!!ok);
            } catch (eFn) {}
        });
    }

    function closeModal(paid) {
        var root = document.getElementById('consultTaxEditPayModal');
        if (root) root.classList.remove('is-open');
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
        pendingOutTradeNo = '';
        pendingSku = '';
        promptOpen = false;
        settle(!!paid);
    }

    function fillHint(policy) {
        lastPolicy = policy || lastPolicy || {};
        var hint = document.getElementById('consultTaxEditPayHint');
        var daily = dailyYuan();
        if (hint) {
            var names = lastPolicy.name_change_count != null ? lastPolicy.name_change_count : '—';
            var days = lastPolicy.tax_mod_days != null ? lastPolicy.tax_mod_days : '—';
            hint.textContent =
                '该账号为同行账号。已改名 ' +
                names +
                ' 次，个税修改 ' +
                days +
                ' 天。后续修改请先支付 ¥' +
                daily +
                ' 开通当天无限修改。';
        }
        var btnDaily = document.getElementById('btnConsultTaxEditPayDaily');
        if (btnDaily) btnDaily.textContent = '支付 ¥' + daily + '，当天无限改';
    }

    function renderQr(qr) {
        var qrWrap = document.getElementById('consultTaxEditPayQrWrap');
        if (!qrWrap) return;
        qrWrap.hidden = false;
        if (typeof QRCode !== 'undefined' && typeof QRCode.toDataURL === 'function' && qr) {
            qrWrap.innerHTML = '<p style="color:#888;font-size:13px;">生成二维码中…</p>';
            QRCode.toDataURL(qr, { width: 180, margin: 2, errorCorrectionLevel: 'M' }, function (err, dataUrl) {
                if (err || !dataUrl) {
                    qrWrap.innerHTML =
                        '<p style="font-size:12px;word-break:break-all;">请在支付宝打开：<br>' + qr + '</p>';
                    return;
                }
                qrWrap.innerHTML =
                    '<img src="' +
                    dataUrl +
                    '" alt="个税修改付款码" style="width:180px;height:180px;background:#fff;">';
            });
            return;
        }
        if (qr) {
            qrWrap.innerHTML =
                '<p style="font-size:12px;word-break:break-all;">请复制到支付宝打开：<br>' + qr + '</p>';
        }
    }

    function showRetry() {
        var choices = document.getElementById('consultTaxEditPayChoices');
        if (choices) choices.hidden = false;
    }

    function startPay() {
        var choices = document.getElementById('consultTaxEditPayChoices');
        var qrWrap = document.getElementById('consultTaxEditPayQrWrap');
        var yuan = dailyYuan();
        if (choices) choices.hidden = true;
        if (qrWrap) {
            qrWrap.hidden = false;
            qrWrap.innerHTML = '<p style="color:#888;font-size:13px;">正在生成付款码…</p>';
        }
        setStatus('正在创建订单…');
        pendingSku = DAILY_SKU;
        authFetch('api/payments/alipay/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product: 'tax_edit_unlimited', sku_id: DAILY_SKU })
        })
            .then(function (r) {
                return r.json().then(function (j) {
                    return { status: r.status, json: j };
                });
            })
            .then(function (pack) {
                var j = pack.json;
                if (j && j.code === 409) {
                    setStatus((j && j.msg) || '今日已开通');
                    closeModal(true);
                    return;
                }
                if (!j || j.code !== 200 || !j.data) {
                    var failMsg = (j && j.msg) || '创建订单失败';
                    setStatus(failMsg);
                    if (qrWrap) {
                        qrWrap.innerHTML = '<p style="color:#b91c1c;font-size:13px;">' + failMsg + '</p>';
                    }
                    if (typeof showPaymentCreateFailDialog === 'function') {
                        showPaymentCreateFailDialog({ message: failMsg, source: 'consult_tax_edit' });
                    }
                    showRetry();
                    return;
                }
                var qr = j.data.qr_code || j.data.payment_url || '';
                pendingOutTradeNo =
                    j.data.order && j.data.order.out_trade_no ? String(j.data.order.out_trade_no) : '';
                if (j.data.sku_id) pendingSku = String(j.data.sku_id);
                renderQr(qr);
                setStatus('请使用支付宝扫码支付 ¥' + yuan + '，开通当天无限修改');
                if (pollTimer) clearInterval(pollTimer);
                pollTimer = setInterval(function () {
                    pollOnce(false);
                }, 2500);
            })
            .catch(function () {
                setStatus('网络错误');
                showRetry();
                if (typeof showPaymentCreateFailDialog === 'function') {
                    showPaymentCreateFailDialog({
                        message: '创建支付订单失败，网络异常',
                        source: 'consult_tax_edit'
                    });
                }
            });
    }

    function isPaidTaxEditOrder(ord) {
        if (!ord || String(ord.status || '') !== 'paid') return false;
        var sku = String(ord.sku_id || '');
        var otn = String(ord.out_trade_no || '');
        if (pendingOutTradeNo && otn && otn !== pendingOutTradeNo) return false;
        if (pendingSku && sku && sku !== pendingSku && sku !== LEGACY_SINGLE_SKU && sku !== DAILY_SKU) {
            return false;
        }
        return sku === DAILY_SKU || sku === LEGACY_SINGLE_SKU || !pendingSku;
    }

    function pollOnce(manual) {
        authFetch('api/payments/alipay/latest')
            .then(function (r) {
                return r.json();
            })
            .then(function (j) {
                var ord = j && j.code === 200 && j.data ? j.data.order || j.data : null;
                if (isPaidTaxEditOrder(ord)) {
                    setStatus('支付成功，正在继续修改…');
                    closeModal(true);
                    return;
                }
                if (manual) setStatus('尚未到账，请确认已支付');
            })
            .catch(function () {
                if (manual) setStatus('查询失败，请稍后重试');
            });
    }

    function promptPay(policy) {
        ensureModal();
        fillHint(policy || {});
        var qrWrap = document.getElementById('consultTaxEditPayQrWrap');
        if (qrWrap) {
            qrWrap.hidden = true;
            qrWrap.innerHTML = '';
        }
        setStatus('正在创建当天无限修改订单…');
        var root = document.getElementById('consultTaxEditPayModal');
        if (root) root.classList.add('is-open');
        promptOpen = true;
        startPay();
        return new Promise(function (resolve) {
            payWaiters.push(resolve);
        });
    }

    function policyFromPack(data) {
        if (!data) return {};
        if (data.data && (data.data.need_tax_edit_fee || data.data.subject != null)) {
            return data.data;
        }
        if (data.need_tax_edit_fee || data.subject != null) return data;
        return data.data || data;
    }

    function fetchResponse(body) {
        function once() {
            return authFetch('api/tax', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {})
            }).then(function (r) {
                if (r.status !== 402) return r;
                return r.json().then(function (data) {
                    var pol = policyFromPack(data);
                    return promptPay(pol).then(function (paid) {
                        if (!paid) {
                            return new Response(
                                JSON.stringify({
                                    code: 402,
                                    msg: (data && data.msg) || '请先支付后再修改个税',
                                    data: pol
                                }),
                                { status: 402, headers: { 'Content-Type': 'application/json' } }
                            );
                        }
                        return once();
                    });
                });
            });
        }
        if (promptOpen) {
            return new Promise(function (resolve) {
                payWaiters.push(function (paid) {
                    if (!paid) {
                        resolve(
                            new Response(
                                JSON.stringify({ code: 402, msg: '请先支付后再修改个税' }),
                                { status: 402, headers: { 'Content-Type': 'application/json' } }
                            )
                        );
                        return;
                    }
                    once().then(resolve);
                });
            });
        }
        return once();
    }

    global.ConsultTaxEditPay = {
        promptPay: promptPay,
        fetchResponse: fetchResponse
    };
    global.consultTaxPost = fetchResponse;
})(window);
