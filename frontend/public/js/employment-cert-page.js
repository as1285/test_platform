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

    function formatFeeYuan(raw) {
      var n = Number(String(raw == null ? '' : raw).replace(/,/g, '').trim());
      if (!isFinite(n) || n < 0) return '';
      return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
    }

    function applyFeeCopy() {
      var yuan = formatFeeYuan(feeAmount) || String(feeAmount || '').trim();
      if (!yuan) return;
      var payBtn = el(ids.payBtn);
      if (payBtn) payBtn.textContent = '支付宝付款开通 ¥' + yuan;
      var payTitle = el(ids.payTitle);
      if (payTitle) payTitle.textContent = '开通权益 · ¥' + yuan;
      var heroDesc = el(ids.heroDesc);
      if (heroDesc) {
        heroDesc.textContent =
          '未付款可生成带「演示样例」水印的 PDF；支付宝付 ¥' +
          yuan +
          ' 开通后，可生成无演示水印版本。';
      }
    }

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

    function inCordovaApp() {
      try {
        if (/TaxPlatformCordovaApp/i.test(navigator.userAgent || '')) return true;
      } catch (e0) {}
      try {
        if (global.TaxNativeSave && typeof global.TaxNativeSave.saveBase64 === 'function') {
          return true;
        }
      } catch (e1) {}
      return false;
    }

    function isLikelyMobileAppShell() {
      if (inCordovaApp()) return true;
      try {
        if (global.navigator.standalone === true) return true;
      } catch (e2) {}
      try {
        if (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) {
          return true;
        }
      } catch (e3) {}
      return false;
    }

    function isAndroidLike() {
      return /Android/i.test(navigator.userAgent || '');
    }

    function forceDownloadUrl(url) {
      var u = String(url || '').trim();
      if (!u) return '';
      return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'dl=1';
    }

    function triggerInPageDownload(url, filename) {
      var u = String(url || '').trim();
      if (!u) return false;
      try {
        var a = document.createElement('a');
        a.href = u;
        a.download = filename || defaultFilename;
        a.rel = 'noopener';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        if (a.parentNode) a.parentNode.removeChild(a);
        return true;
      } catch (e0) {}
      try {
        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.src = u;
        document.body.appendChild(iframe);
        setTimeout(function () {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 60000);
        return true;
      } catch (e1) {
        return false;
      }
    }

    function blobToBase64(blob) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var s = String(reader.result || '');
          var i = s.indexOf(',');
          resolve(i >= 0 ? s.slice(i + 1) : s);
        };
        reader.onerror = function () {
          reject(new Error('read_fail'));
        };
        reader.readAsDataURL(blob);
      });
    }

    function hasNativeSave() {
      try {
        return !!(global.TaxNativeSave && typeof global.TaxNativeSave.saveBase64 === 'function');
      } catch (e0) {
        return false;
      }
    }

    function nativeSaveBlob(blob, filename, mime) {
      if (!blob) return Promise.reject(new Error('no_blob'));
      if (!hasNativeSave()) return Promise.reject(new Error('no_native'));
      if (blob.size > 650000) return Promise.reject(new Error('too_large'));
      return blobToBase64(blob).then(function (b64) {
        var r = String(global.TaxNativeSave.saveBase64(filename, mime, b64) || '');
        if (r.indexOf('ok') === 0) return 'native';
        throw new Error(r || 'native_fail');
      });
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

    function androidSaveLocal(blob, filename) {
      var pngName = String(filename || lastPdfName || defaultFilename).replace(/\.pdf$/i, '') + '.png';
      var pdfName = filename || lastPdfName || defaultFilename;
      var steps = [];

      function tryNative(nextBlob, name, mime) {
        if (!nextBlob) return Promise.reject(new Error('no_blob'));
        return nativeSaveBlob(nextBlob, name, mime);
      }

      if (inCordovaApp()) {
        function enqueueUrlDownload() {
          steps.push(function () {
            var url = forceDownloadUrl(lastPdfShareUrl || lastPreviewShareUrl);
            var name = lastPdfShareUrl ? pdfName : pngName;
            if (!url || !triggerInPageDownload(url, name)) {
              return Promise.reject(new Error('no_share_url'));
            }
            return 'webview_dl';
          });
        }
        if (hasNativeSave()) {
          if (lastPreviewBlob) {
            steps.push(function () {
              return tryNative(lastPreviewBlob, pngName, 'image/png');
            });
          }
          if (blob || lastPdfBlob) {
            steps.push(function () {
              return tryNative(blob || lastPdfBlob, pdfName, 'application/pdf');
            });
          }
          enqueueUrlDownload();
        } else {
          steps.push(function () {
            return sharePdfBlob(blob || lastPdfBlob, pdfName).then(function () {
              return 'shared';
            });
          });
          enqueueUrlDownload();
        }
      } else {
        if (blob || lastPdfBlob) {
          triggerAnchorDownload(blob || lastPdfBlob, pdfName);
          return Promise.resolve('chrome_pdf');
        }
        if (lastPreviewBlob) {
          triggerAnchorDownload(lastPreviewBlob, pngName);
          return Promise.resolve('chrome_png');
        }
        return Promise.reject(new Error('no_blob'));
      }

      function run(i) {
        if (i >= steps.length) return Promise.reject(new Error('android_save_fail'));
        return Promise.resolve()
          .then(steps[i])
          .catch(function (err) {
            if (err && err.name === 'AbortError') throw err;
            return run(i + 1);
          });
      }
      return run(0);
    }

    function saveOrSharePdf(blob, filename) {
      if (isAndroidLike()) {
        return androidSaveLocal(blob, filename);
      }
      return sharePdfBlob(blob, filename)
        .then(function () {
          return 'shared';
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') throw err;
          if (isLikelyMobileAppShell()) {
            return androidSaveLocal(blob, filename);
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
      var androidApp = android && inCordovaApp();
      if (btnShare) {
        btnShare.textContent = androidApp ? '保存到手机' : android ? '下载到手机' : '系统分享保存';
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
          pdfPreviewFallback.textContent = androidApp
            ? '预览暂不可用，请直接点「保存到手机」或「浏览器下载 PDF」'
            : android
              ? '预览暂不可用，请直接点「下载到手机」或「浏览器下载 PDF」'
              : '预览暂不可用，请直接点「系统分享保存」或「浏览器下载 PDF」';
        }
      }
      if (longPressTip) {
        longPressTip.hidden = !lastPreviewUrl;
      }
      if (pdfTip) {
        pdfTip.textContent = androidApp
          ? lastPreviewUrl
            ? '点「保存到手机」会写入系统下载/相册。也可长按上方图片保存。需要 PDF 时点「浏览器下载 PDF」。'
            : '点「保存到手机」写入系统下载目录；也可点「浏览器下载 PDF」。'
          : android
            ? '点「下载到手机」即可保存到本机下载。也可长按预览图保存。'
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
            String(mode).indexOf('native') === 0 ||
            String(mode).indexOf('webview_dl') === 0 ||
            String(mode).indexOf('chrome_') === 0 ||
            String(mode).indexOf('browser_') === 0 ||
            String(mode).indexOf('anchor') === 0 ||
            mode === 'android_fallback'
          ) {
            setStatus(
              genStatus,
              isAndroidLike()
                ? mode.indexOf('native') === 0
                  ? '已保存到手机（下载或相册），可在系统文件管理里查看'
                  : '已开始保存到手机；若未出现文件请再点「保存到手机」或长按预览图'
                : '已尝试下载；也可长按预览图保存'
            );
            setStatus(
              saveStatus,
              isAndroidLike()
                ? mode.indexOf('native') === 0
                  ? '已写入手机本地'
                  : '已开始下载到本地'
                : '已尝试下载保存'
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
                ? '已取消。可再点「保存到手机」'
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
          applyFeeCopy();
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
        setStatus(payStatus, '请使用支付宝扫码支付 ¥' + (formatFeeYuan(feeAmount) || feeAmount));
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
          isAndroidLike() ? '正在保存到手机…' : '正在调起系统分享…'
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
                ? String(mode).indexOf('native') === 0
                  ? '已保存到手机本地'
                  : '已开始保存到手机；若未看到文件请长按预览图'
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
                ? '请查看上方预览图；可长按保存或点「保存到手机」'
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
          var url = forceDownloadUrl(lastPdfShareUrl);
          var started = triggerInPageDownload(url, lastPdfName);
          if (!started) {
            started = openExternalUrl(url);
          }
          setStatus(
            saveStatus,
            started ? '已开始下载 PDF 到手机' : '下载未开始，请再试一次或长按预览图',
            !started
          );
          return;
        }
        if (lastPdfBlob) {
          triggerAnchorDownload(lastPdfBlob, lastPdfName);
        }
        setStatus(
          saveStatus,
          isAndroidLike()
            ? '若未开始下载，请改用「保存到手机」'
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
