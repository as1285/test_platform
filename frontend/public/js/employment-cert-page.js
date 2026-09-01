/**
 * 离职/在职证明页共用壳：支付、预填、一键生成、PDF 预览与系统分享。
 * 用法：window.initEmploymentCertPage(config)
 */
(function (global) {
  'use strict';

  function el(id) {
    return id ? document.getElementById(id) : null;
  }

  function token() {
    try {
      return String(localStorage.getItem('token') || '').trim();
    } catch (e) {
      return '';
    }
  }

  function authFetch(url, opts) {
    opts = opts || {};
    var headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
    var t = token();
    if (t) headers.Authorization = 'Bearer ' + t;
    return fetch(url, Object.assign({}, opts, { headers: headers }));
  }

  function setStatus(node, text, isErr) {
    if (!node) return;
    if (!text) {
      node.hidden = true;
      node.textContent = '';
      return;
    }
    node.hidden = false;
    node.textContent = text;
    node.classList.toggle('is-err', !!isErr);
  }

  function base64ToBlob(b64, mime) {
    var bin = atob(b64);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime || 'application/octet-stream' });
  }

  function defaultIssueDate() {
    var n = new Date();
    return n.getFullYear() + ' 年 ' + (n.getMonth() + 1) + ' 月 ' + n.getDate() + ' 日';
  }

  function genderFromId(idNumber) {
    var s = String(idNumber || '').replace(/[^0-9Xx]/g, '');
    var d = '';
    if (s.length >= 18) d = s.charAt(16);
    else if (s.length === 15) d = s.charAt(14);
    if (!d || !/\d/.test(d)) return '';
    return Number(d) % 2 === 1 ? '男' : '女';
  }

  function initEmploymentCertPage(cfg) {
    cfg = cfg || {};
    var ids = cfg.ids || {};
    var fields = cfg.fields || {};
    var apiPrefix = String(cfg.apiPrefix || '').replace(/\/$/, '');
    var product = cfg.product || 'lizhi_cert';
    var skuId = cfg.skuId || 'sku_lizhi_cert_50';
    var productLabel = cfg.productLabel || '证明';
    var defaultFilename = cfg.defaultFilename || productLabel + '.pdf';
    var pageFile = cfg.pageFile || 'lizhi_cert.html';
    var enableQuick = cfg.quick !== false;
    var requireDepartmentManual = cfg.requireDepartmentManual !== false;
    var hasLeave = !!fields.leave;
    var hasGender = !!fields.gender;

    var lastPdfBlob = null;
    var lastPreviewBlob = null;
    var lastPdfName = defaultFilename;
    var lastPdfUrl = '';
    var lastPreviewUrl = '';
    var lastPdfShareUrl = '';
    var lastPreviewShareUrl = '';
    var cardPay = el(ids.cardPay || 'cardPay');
    var cardForm = el(ids.cardForm || 'cardForm');
    var cardPdfSave = el(ids.cardPdfSave || 'cardPdfSave');
    var payStatus = el(ids.payStatus);
    var genStatus = el(ids.genStatus);
    var saveStatus = el(ids.saveStatus);
    var pdfFrame = el(ids.pdfFrame);
    var pdfPreview = el(ids.pdfPreview);
    var pdfPreviewFallback = el(ids.pdfPreviewFallback);
    var longPressTip = el(ids.longPressTip);
    var btnShare = el(ids.btnShare);
    var qrWrap = el(ids.qrWrap);
    var unlockBadge = el(ids.unlockBadge);
    var pdfTip = el(ids.pdfTip);
    var quickCompanyEl = el(ids.quickCompany);
    var pollTimer = null;
    var pendingOtn = '';
    var feeAmount = '50.00';
    var certUnlocked = false;

    function fieldValue(key) {
      var node = el(fields[key]);
      return node ? String(node.value || '').trim() : '';
    }

    function setFieldValue(key, val) {
      var node = el(fields[key]);
      if (!node || val == null) return;
      node.value = val;
    }

    function revokeLastPdfUrl() {
      if (lastPdfUrl) {
        try {
          URL.revokeObjectURL(lastPdfUrl);
        } catch (e0) {}
        lastPdfUrl = '';
      }
      if (lastPreviewUrl) {
        try {
          URL.revokeObjectURL(lastPreviewUrl);
        } catch (e1) {}
        lastPreviewUrl = '';
      }
    }

    function isLikelyMobileAppShell() {
      try {
        if (typeof global.isCordovaTaxAppShell === 'function' && global.isCordovaTaxAppShell()) {
          return true;
        }
      } catch (e1) {}
      try {
        if (global.navigator.standalone === true) return true;
      } catch (e2) {}
      try {
        if (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) {
          return true;
        }
      } catch (e3) {}
      var ua = navigator.userAgent || '';
      return /iPhone|iPad|iPod|Android/i.test(ua);
    }

    function isAndroidLike() {
      return /Android/i.test(navigator.userAgent || '');
    }

    function canShareFiles(files) {
      try {
        if (!navigator.share || typeof navigator.share !== 'function') return false;
        if (!files || !files.length) return false;
        if (typeof File === 'undefined') return false;
        if (navigator.canShare && !navigator.canShare({ files: files })) return false;
        return true;
      } catch (e) {
        return false;
      }
    }

    function shareFiles(files, title) {
      if (!canShareFiles(files)) {
        return Promise.reject(new Error('share_unsupported'));
      }
      return navigator.share({
        files: files,
        title: title || productLabel
      });
    }

    function absoluteApiUrl(path) {
      var p = String(path || '');
      if (!p) return '';
      if (/^https?:\/\//i.test(p)) return p;
      if (p.charAt(0) !== '/') p = '/' + p;
      try {
        return String(location.origin || '') + p;
      } catch (e0) {
        return p;
      }
    }

    function tempShareUrlFromToken(tok) {
      var t = String(tok || '').trim();
      if (!t) return '';
      return absoluteApiUrl(apiPrefix + '/temp-share/' + encodeURIComponent(t));
    }

    function openExternalUrl(url) {
      var u = url != null ? String(url).trim() : '';
      if (!u) return false;
      var notified = false;
      try {
        if (global.parent && global.parent !== global) {
          try {
            if (typeof global.parent.openTaxPlatformExternal === 'function') {
              global.parent.openTaxPlatformExternal(u);
              notified = true;
            }
          } catch (eParentFn) {}
          try {
            global.parent.postMessage(
              { source: 'tax-platform-h5', type: 'open-external', url: u },
              '*'
            );
            notified = true;
          } catch (eMsg) {}
        }
      } catch (e0) {}
      try {
        if (global.TaxApp && TaxApp.shell && typeof TaxApp.shell.openExternal === 'function') {
          TaxApp.shell.openExternal(u);
          notified = true;
        }
      } catch (eTax) {}
      try {
        if (
          global.cordova &&
          global.cordova.InAppBrowser &&
          typeof global.cordova.InAppBrowser.open === 'function'
        ) {
          global.cordova.InAppBrowser.open(u, '_system');
          return true;
        }
      } catch (e1) {}
      if (notified) return true;
      try {
        var opened = global.open(u, '_blank', 'noopener,noreferrer');
        if (opened) return true;
      } catch (e2) {}
      if (isAndroidLike() && /^https?:\/\//i.test(u)) {
        try {
          var inShell = false;
          try {
            inShell =
              (typeof global.isCordovaTaxAppShell === 'function' &&
                global.isCordovaTaxAppShell()) ||
              (global.parent && global.parent !== global);
          } catch (eShell) {}
          if (inShell) {
            var parsed = new URL(u);
            var intentUrl =
              'intent://' +
              parsed.host +
              parsed.pathname +
              parsed.search +
              parsed.hash +
              '#Intent;scheme=' +
              parsed.protocol.replace(':', '') +
              ';action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end';
            var aIntent = document.createElement('a');
            aIntent.href = intentUrl;
            aIntent.target = '_blank';
            aIntent.rel = 'noopener';
            aIntent.style.display = 'none';
            document.body.appendChild(aIntent);
            aIntent.click();
            if (aIntent.parentNode) aIntent.parentNode.removeChild(aIntent);
            return true;
          }
        } catch (eIntent) {}
      }
      return false;
    }

    function sharePdfBlob(blob, filename) {
      if (!blob && !lastPreviewBlob) return Promise.reject(new Error('no_blob'));
      var preferImage = isAndroidLike() || isLikelyMobileAppShell();
      var jobs = [];
      if (preferImage && lastPreviewBlob) {
        var pngName = String(filename || defaultFilename).replace(/\.pdf$/i, '') + '.png';
        jobs.push(function () {
          var imgFile = new File([lastPreviewBlob], pngName, { type: 'image/png' });
          return shareFiles([imgFile], pngName);
        });
      }
      if (blob) {
        jobs.push(function () {
          var pdfFile = new File([blob], filename || defaultFilename, { type: 'application/pdf' });
          return shareFiles([pdfFile], filename || productLabel);
        });
      }
      if (!jobs.length) return Promise.reject(new Error('share_unsupported'));

      function run(i) {
        if (i >= jobs.length) return Promise.reject(new Error('share_unsupported'));
        return jobs[i]().catch(function (err) {
          if (err && err.name === 'AbortError') throw err;
          return run(i + 1);
        });
      }
      return run(0);
    }

    function triggerAnchorDownload(blob, filename) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || defaultFilename;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        try {
          URL.revokeObjectURL(url);
        } catch (e0) {}
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 2000);
    }

    function androidBrowserSave() {
      var url = lastPreviewShareUrl || lastPdfShareUrl;
      var kind = lastPreviewShareUrl ? 'png' : 'pdf';
      if (url) {
        var opened = openExternalUrl(url);
        if (opened) {
          return Promise.resolve('browser_' + kind);
        }
        try {
          var a = document.createElement('a');
          a.href = url;
          a.download =
            kind === 'png'
              ? String(lastPdfName || defaultFilename).replace(/\.pdf$/i, '') + '.png'
              : lastPdfName || defaultFilename;
          a.target = '_blank';
          a.rel = 'noopener';
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          if (a.parentNode) a.parentNode.removeChild(a);
          return Promise.resolve('anchor_link_' + kind);
        } catch (eDl) {}
      }
      if (lastPreviewBlob) {
        var pngName = String(lastPdfName || defaultFilename).replace(/\.pdf$/i, '') + '.png';
        triggerAnchorDownload(lastPreviewBlob, pngName);
        return Promise.resolve('anchor_png');
      }
      if (lastPdfBlob) {
        triggerAnchorDownload(lastPdfBlob, lastPdfName);
        return Promise.resolve('anchor_pdf');
      }
      return Promise.reject(new Error('no_share_url'));
    }

    function saveOrSharePdf(blob, filename) {
      if (isAndroidLike()) {
        return androidBrowserSave().then(function (mode) {
          return mode || 'android_fallback';
        });
      }
      return sharePdfBlob(blob, filename)
        .then(function () {
          return 'shared';
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') throw err;
          if (isLikelyMobileAppShell()) {
            return androidBrowserSave().then(function (mode) {
              return mode || 'android_fallback';
            });
          }
          throw err;
        });
    }

    function showPdfSavePanel(blob, filename, previewBlob, shareMeta) {
      lastPdfBlob = blob;
      lastPreviewBlob = previewBlob || null;
      lastPdfName = filename || defaultFilename;
      shareMeta = shareMeta || {};
      lastPdfShareUrl = tempShareUrlFromToken(shareMeta.pdf_share_token);
      lastPreviewShareUrl = tempShareUrlFromToken(shareMeta.preview_share_token);
      revokeLastPdfUrl();
      lastPdfUrl = URL.createObjectURL(blob);
      if (previewBlob) {
        lastPreviewUrl = URL.createObjectURL(previewBlob);
      }

      var mobile = isLikelyMobileAppShell() || isAndroidLike();
      var android = isAndroidLike();
      if (btnShare) {
        btnShare.textContent = android ? '系统浏览器下载图片' : '系统分享保存';
      }
      if (pdfPreview) {
        if (lastPreviewUrl) {
          pdfPreview.src = lastPreviewUrl;
          pdfPreview.hidden = false;
        } else {
          pdfPreview.removeAttribute('src');
          pdfPreview.hidden = true;
        }
      }
      if (pdfFrame) {
        if (!mobile && lastPdfUrl) {
          pdfFrame.src = lastPdfUrl;
          pdfFrame.hidden = false;
        } else {
          pdfFrame.removeAttribute('src');
          pdfFrame.hidden = true;
        }
      }
      if (pdfPreviewFallback) {
        pdfPreviewFallback.hidden = !!(lastPreviewUrl || (!mobile && lastPdfUrl));
        if (!pdfPreviewFallback.hidden) {
          pdfPreviewFallback.textContent = android
            ? '预览暂不可用，请直接点「系统浏览器下载图片」或「浏览器下载 PDF」'
            : '预览暂不可用，请直接点「系统分享保存」或「浏览器下载 PDF」';
        }
      }
      if (longPressTip) {
        longPressTip.hidden = !lastPreviewUrl;
      }
      if (pdfTip) {
        pdfTip.textContent = android
          ? lastPreviewUrl
            ? '安卓请点「系统浏览器下载图片」：将拉起系统浏览器下载预览图，可存相册/文件。也可长按上方图片保存。需要 PDF 时点「浏览器下载 PDF」。'
            : '安卓请点「系统浏览器下载图片」或「浏览器下载 PDF」，将拉起系统浏览器下载。'
          : mobile
            ? lastPreviewUrl
              ? '请点「系统分享保存」把预览图存到相册/文件；也可长按上方图片保存。需要 PDF 文件时可用下方「浏览器下载 PDF」。'
              : '请点「系统分享保存」。若分享不可用，请改用「浏览器下载 PDF」。'
            : '可在下方预览；电脑端可直接下载 PDF。';
      }
      if (cardPdfSave) {
        cardPdfSave.hidden = false;
        try {
          cardPdfSave.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (eScroll) {}
      }
      setStatus(saveStatus, '');
    }

    function deliverPdf(b64, filename, previewB64, shareMeta) {
      var name = filename || defaultFilename;
      var blob = base64ToBlob(b64, 'application/pdf');
      var previewBlob = null;
      if (previewB64) {
        try {
          previewBlob = base64ToBlob(previewB64, 'image/png');
        } catch (ePrev) {
          previewBlob = null;
        }
      }
      showPdfSavePanel(blob, name, previewBlob, shareMeta);

      if (!isLikelyMobileAppShell()) {
        triggerAnchorDownload(blob, name);
        setStatus(genStatus, '已开始下载；也可在下方预览或再次下载');
        return Promise.resolve('desktop_download');
      }

      return saveOrSharePdf(blob, name)
        .then(function (mode) {
          if (mode === 'shared') {
            setStatus(genStatus, '已调起系统分享，请选择保存到相册或文件');
            setStatus(saveStatus, '分享面板已打开');
            return mode;
          }
          if (
            String(mode).indexOf('browser_') === 0 ||
            String(mode).indexOf('anchor') === 0 ||
            mode === 'android_fallback'
          ) {
            setStatus(
              genStatus,
              isAndroidLike()
                ? '已拉起系统浏览器下载；若未开始请再点「系统浏览器下载图片」或长按预览图'
                : '已尝试下载；也可长按预览图保存'
            );
            setStatus(
              saveStatus,
              isAndroidLike() ? '已打开系统浏览器下载' : '已尝试下载保存'
            );
            return mode;
          }
          setStatus(genStatus, '请按下方提示保存');
          return mode;
        })
        .catch(function (err) {
          var errName = err && err.name ? String(err.name) : '';
          if (errName === 'AbortError') {
            setStatus(
              genStatus,
              isAndroidLike()
                ? '已取消。可再点「系统浏览器下载图片」'
                : '已取消分享。可再点下方「系统分享保存」'
            );
            return 'aborted';
          }
          setStatus(
            genStatus,
            lastPreviewBlob
              ? '请点下方保存按钮，或长按上方预览图保存'
              : '请点下方保存按钮；若仍失败请用「浏览器下载 PDF」'
          );
          setStatus(saveStatus, '自动保存未成功，请手动再点一次', true);
          return 'fallback';
        });
    }

    function showQuickCompany(name) {
      if (!quickCompanyEl) return;
      var n = String(name || '').trim();
      if (!n) {
        quickCompanyEl.textContent = '';
        quickCompanyEl.classList.remove('is-on');
        return;
      }
      quickCompanyEl.textContent =
        (cfg.quickCompanyPrefix || '当前最后一家：') + n;
      quickCompanyEl.classList.add('is-on');
    }

    function fillForm(d) {
      if (!d) return;
      if (d.name != null) setFieldValue('name', d.name);
      if (d.id_number != null) setFieldValue('id', d.id_number);
      if (d.company_name != null) setFieldValue('company', d.company_name);
      if (d.department != null) setFieldValue('department', d.department);
      if (d.position != null) setFieldValue('position', d.position);
      if (d.hire_date != null) setFieldValue('hire', d.hire_date);
      if (hasLeave && d.leave_date != null) setFieldValue('leave', d.leave_date);
      if (d.issue_date != null) setFieldValue('issue', d.issue_date);
      if (hasGender && d.gender != null) setFieldValue('gender', d.gender);
      showQuickCompany(d.company_name);
    }

    function applyUnlocked(unlocked) {
      certUnlocked = !!unlocked;
      if (cardPay) cardPay.hidden = !!unlocked;
      if (cardForm) cardForm.hidden = false;
      if (unlockBadge) {
        unlockBadge.textContent = unlocked
          ? '已开通 · 生成无演示水印版本'
          : '未开通 · PDF 含演示水印';
      }
      if (unlocked && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function loadPrefill() {
      return authFetch(apiPrefix + '/prefill')
        .then(function (r) {
          return r.json();
        })
        .then(function (j) {
          if (j && j.code === 200 && j.data) {
            fillForm(j.data);
            if (!fieldValue('issue')) setFieldValue('issue', defaultIssueDate());
            if (hasGender && !fieldValue('gender')) {
              setFieldValue('gender', genderFromId(fieldValue('id')));
            }
          }
        })
        .catch(function () {});
    }

    function loadStatus() {
      return authFetch(apiPrefix + '/status')
        .then(function (r) {
          return r.json();
        })
        .then(function (j) {
          if (!j || j.code !== 200 || !j.data) throw new Error((j && j.msg) || '读取失败');
          feeAmount = j.data.fee_amount || feeAmount;
          applyUnlocked(!!j.data.unlocked);
          var payBtn = el(ids.payBtn);
          if (payBtn) payBtn.textContent = '支付宝付款开通 ¥' + feeAmount;
          return loadPrefill();
        })
        .catch(function (e) {
          setStatus(payStatus, (e && e.message) || '读取权益失败', true);
        });
    }

    function startPay() {
      setStatus(payStatus, '正在创建订单…');
      if (qrWrap) {
        qrWrap.hidden = false;
        qrWrap.innerHTML = '<p style="color:#888;font-size:13px;">生成付款码…</p>';
      }
      authFetch('/api/payments/alipay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: product, sku_id: skuId })
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (j) {
          if (!j || j.code !== 200 || !j.data) {
            var failMsg = (j && j.msg) || '创建订单失败';
            setStatus(payStatus, failMsg, true);
            if (qrWrap) qrWrap.innerHTML = '';
            if (typeof showPaymentCreateFailDialog === 'function') {
              showPaymentCreateFailDialog({ message: failMsg, source: product });
            }
            return;
          }
          var qr = j.data.qr_code || j.data.payment_url || '';
          pendingOtn =
            j.data.order && j.data.order.out_trade_no ? String(j.data.order.out_trade_no) : '';
          if (typeof QRCode !== 'undefined' && QRCode.toDataURL && qr && qrWrap) {
            QRCode.toDataURL(qr, { width: 180, margin: 2, errorCorrectionLevel: 'M' }, function (
              err,
              dataUrl
            ) {
              if (err || !dataUrl) {
                qrWrap.innerHTML =
                  '<p style="font-size:12px;word-break:break-all;">请在支付宝打开：<br>' +
                  qr +
                  '</p>';
                return;
              }
              qrWrap.innerHTML = '<img src="' + dataUrl + '" alt="付款码">';
            });
          } else if (qr && qrWrap) {
            qrWrap.innerHTML =
              '<p style="font-size:12px;word-break:break-all;">请复制到支付宝打开：<br>' +
              qr +
              '</p>';
          }
          setStatus(payStatus, '请使用支付宝扫码支付 ¥' + feeAmount);
          if (pollTimer) clearInterval(pollTimer);
          pollTimer = setInterval(pollPay, 2500);
        })
        .catch(function () {
          setStatus(payStatus, '网络错误', true);
          if (typeof showPaymentCreateFailDialog === 'function') {
            showPaymentCreateFailDialog({
              message: '创建支付订单失败，网络异常',
              source: product
            });
          }
        });
    }

    function pollPay() {
      authFetch('/api/payments/alipay/latest')
        .then(function (r) {
          return r.json();
        })
        .then(function (j) {
          var ord = j && j.code === 200 && j.data ? j.data.order : null;
          if (!ord) return;
          var st = String(ord.status || '');
          var sku = String(ord.sku_id || '');
          var otn = String(ord.out_trade_no || '');
          if (st === 'paid' && (sku === skuId || !pendingOtn || otn === pendingOtn)) {
            setStatus(payStatus, '支付成功，正在解锁…');
            if (pollTimer) {
              clearInterval(pollTimer);
              pollTimer = null;
            }
            loadStatus();
          }
        })
        .catch(function () {});
    }

    function setGenerateBusy(busy) {
      [ids.generateBtn, ids.quickBtn, ids.prefillBtn].forEach(function (id) {
        var node = el(id);
        if (node) node.disabled = !!busy;
      });
    }

    function buildPayload(opts) {
      opts = opts || {};
      var payload = {
        name: fieldValue('name'),
        id_number: fieldValue('id'),
        company_name: fieldValue('company'),
        department: fieldValue('department'),
        position: fieldValue('position'),
        hire_date: fieldValue('hire'),
        issue_date: fieldValue('issue') || defaultIssueDate()
      };
      if (hasLeave) payload.leave_date = fieldValue('leave');
      if (hasGender) {
        payload.gender = fieldValue('gender') || genderFromId(payload.id_number);
      }
      if (opts.quick) payload.quick = true;
      if (opts.quick && !payload.position) payload.position = '职员';
      return payload;
    }

    function generate(opts) {
      opts = opts || {};
      var payload = buildPayload(opts);
      if (!payload.name || !payload.id_number) {
        setGenerateBusy(false);
        setStatus(genStatus, '请填写姓名与身份证号', true);
        return;
      }
      if (!payload.company_name) {
        setGenerateBusy(false);
        setStatus(
          genStatus,
          opts.quick
            ? cfg.quickEmptyCompanyMsg ||
                '账号里没有找到最后一家公司，请先添加个税记录或手动填写'
            : '请填写公司全称',
          true
        );
        return;
      }
      if (!opts.quick && requireDepartmentManual && !payload.department) {
        setGenerateBusy(false);
        setStatus(genStatus, '请填写部门', true);
        return;
      }
      if (!payload.position) {
        setGenerateBusy(false);
        setStatus(genStatus, '请填写担任岗位', true);
        return;
      }
      setGenerateBusy(true);
      setStatus(
        genStatus,
        opts.quick
          ? cfg.quickBusyMsg || '正在按最后一家公司生成 PDF…'
          : '正在生成 PDF…'
      );
      authFetch(apiPrefix + '/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j };
          });
        })
        .then(function (res) {
          var j = res.j;
          if (!j || j.code !== 200 || !j.data || !j.data.pdf_base64) {
            setStatus(genStatus, (j && j.msg) || '生成失败', true);
            return;
          }
          setStatus(
            genStatus,
            j.data.demo
              ? '演示水印版生成成功，正在调起保存…'
              : '无演示水印版生成成功，正在调起保存…'
          );
          return deliverPdf(
            j.data.pdf_base64,
            j.data.filename || defaultFilename,
            j.data.preview_png_base64 || null,
            {
              pdf_share_token: j.data.pdf_share_token || null,
              preview_share_token: j.data.preview_share_token || null
            }
          );
        })
        .catch(function () {
          setStatus(genStatus, '网络错误', true);
        })
        .finally(function () {
          setGenerateBusy(false);
        });
    }

    function quickGenerate() {
      setGenerateBusy(true);
      setStatus(genStatus, cfg.quickLoadingMsg || '正在读取最后一家公司…');
      loadPrefill()
        .then(function () {
          if (!fieldValue('issue')) setFieldValue('issue', defaultIssueDate());
          generate({ quick: true });
        })
        .catch(function () {
          setGenerateBusy(false);
          setStatus(genStatus, '读取最后一家公司失败', true);
        });
    }

    try {
      var ref = document.referrer || '';
      var back = el(ids.back);
      if (back) {
        var fromQ = '';
        try {
          fromQ = String(
            new URLSearchParams(location.search || '').get('from') || ''
          ).toLowerCase();
        } catch (eFrom) {}
        if (fromQ === 'consult' || /consult\.html/i.test(ref)) {
          back.setAttribute('href', 'consult.html?tab=products');
        } else if (fromQ === 'purchase' || /purchase\.html/i.test(ref)) {
          back.setAttribute('href', 'purchase.html?from=mine');
        } else if (/mine\.html/i.test(ref)) {
          back.setAttribute('href', 'mine.html');
        } else {
          back.setAttribute('href', 'consult.html?tab=products');
        }
      }
    } catch (e0) {}

    if (!token()) {
      global.location.replace(
        typeof global.buildLoginPageUrl === 'function'
          ? global.buildLoginPageUrl(pageFile)
          : 'login.html?redirect=' + encodeURIComponent(pageFile)
      );
      return null;
    }

    var shareBtn = el(ids.btnShare);
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        if (!lastPdfBlob && !lastPreviewBlob) {
          setStatus(saveStatus, '请先生成 PDF', true);
          return;
        }
        setStatus(
          saveStatus,
          isAndroidLike() ? '正在拉起系统浏览器…' : '正在调起系统分享…'
        );
        saveOrSharePdf(lastPdfBlob, lastPdfName)
          .then(function (mode) {
            if (mode === 'shared') {
              setStatus(saveStatus, '请在分享面板选择「存储到文件」或「保存到相册」');
              return;
            }
            setStatus(
              saveStatus,
              isAndroidLike()
                ? '已拉起系统浏览器下载；若未开始请长按上方图片保存'
                : '已尝试下载保存'
            );
          })
          .catch(function (err) {
            if (err && err.name === 'AbortError') {
              setStatus(saveStatus, '已取消');
              return;
            }
            setStatus(
              saveStatus,
              lastPreviewBlob
                ? '请长按上方预览图保存，或点「浏览器下载 PDF」'
                : '保存失败，请点「浏览器下载 PDF」',
              true
            );
          });
      });
    }

    var openBtn = el(ids.openPdfBtn);
    if (openBtn) {
      openBtn.addEventListener('click', function () {
        var url = lastPreviewUrl || lastPdfUrl;
        if (!url) {
          setStatus(saveStatus, '请先生成 PDF', true);
          return;
        }
        var opened = null;
        try {
          opened = global.open(url, '_blank');
        } catch (eOpen) {}
        if (!opened) {
          setStatus(
            saveStatus,
            lastPreviewUrl
              ? isAndroidLike()
                ? '请查看上方预览图；可长按保存或点「系统浏览器下载图片」'
                : '请查看上方预览图；可长按保存或点「系统分享保存」'
              : '已在上方预览；请用下方按钮保存',
            true
          );
          return;
        }
        setStatus(saveStatus, '已打开预览，可用系统分享/存储菜单保存');
      });
    }

    var desktopDlBtn = el(ids.desktopDlBtn);
    if (desktopDlBtn) {
      desktopDlBtn.addEventListener('click', function () {
        if (!lastPdfBlob && !lastPdfShareUrl) {
          setStatus(saveStatus, '请先生成 PDF', true);
          return;
        }
        if (isAndroidLike() && lastPdfShareUrl) {
          var opened = openExternalUrl(lastPdfShareUrl);
          setStatus(
            saveStatus,
            opened
              ? '已用系统浏览器下载 PDF'
              : '请在弹出的浏览器中保存 PDF；若无反应可再试一次',
            !opened
          );
          return;
        }
        if (lastPdfBlob) {
          triggerAnchorDownload(lastPdfBlob, lastPdfName);
        }
        setStatus(
          saveStatus,
          isAndroidLike()
            ? '若未开始下载，请改用「系统浏览器下载图片」'
            : '若未开始下载，请改用「系统分享保存」'
        );
      });
    }

    var payBtn = el(ids.payBtn);
    if (payBtn) payBtn.addEventListener('click', startPay);

    var genBtn = el(ids.generateBtn);
    if (genBtn) {
      genBtn.addEventListener('click', function () {
        generate();
      });
    }

    var quickBtn = el(ids.quickBtn);
    if (enableQuick && quickBtn) {
      quickBtn.addEventListener('click', quickGenerate);
    }

    var prefillBtn = el(ids.prefillBtn);
    if (prefillBtn) {
      prefillBtn.addEventListener('click', function () {
        loadPrefill().then(function () {
          setStatus(genStatus, cfg.prefillDoneMsg || '已按最后一家公司重新预填');
        });
      });
    }

    setFieldValue('issue', defaultIssueDate());
    loadStatus();
    global.addEventListener('pagehide', revokeLastPdfUrl);

    if (typeof global.initCertPageSurvey === 'function' && cfg.surveyProduct) {
      global.initCertPageSurvey({
        product: cfg.surveyProduct,
        productLabel: productLabel,
        backBtnId: ids.back,
        authFetch: authFetch,
        getSeenPrice: function () {
          var n = Number(feeAmount);
          return isFinite(n) && n > 0 ? n : 50;
        },
        getUnlocked: function () {
          return !!certUnlocked;
        }
      });
    }

    return {
      generate: generate,
      quickGenerate: quickGenerate,
      loadPrefill: loadPrefill,
      authFetch: authFetch
    };
  }

  global.initEmploymentCertPage = initEmploymentCertPage;
  global.EmploymentCertPage = {
    init: initEmploymentCertPage,
    defaultIssueDate: defaultIssueDate,
    genderFromId: genderFromId
  };
})(typeof window !== 'undefined' ? window : this);
