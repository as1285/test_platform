/**
 * 首页扫一扫：摄像头实时识码 + 相册选图。
 * 解码依赖 BarcodeDetector（若有）与 vendor/jsqr.min.js。
 * Cordova 壳无 barcode 插件，走 getUserMedia；相册优先 navigator.camera，否则 file input。
 */
(function () {
  var IMPORT_KEY = 'tax_qr_import_v1';
  var videoEl = null;
  var streamRef = null;
  var rafId = 0;
  var busy = false;
  var hintTimer = 0;
  var detector = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setHint(text, isError) {
    var el = $('scanHint');
    if (!el) return;
    el.textContent = text || '请将摄像头对准二维码';
    el.classList.toggle('is-error', !!isError);
    if (hintTimer) clearTimeout(hintTimer);
    if (
      text &&
      text !== '请将摄像头对准二维码' &&
      !document.body.classList.contains('camera-denied')
    ) {
      hintTimer = setTimeout(function () {
        el.textContent = '请将摄像头对准二维码';
        el.classList.remove('is-error');
      }, 3200);
    }
  }

  function goBack() {
    stopCamera();
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = 'shouye.html';
  }

  function loginUrl(nextPage) {
    if (typeof window.buildLoginPageUrl === 'function') {
      return window.buildLoginPageUrl(nextPage);
    }
    return 'login.html?next=' + encodeURIComponent(nextPage);
  }

  function hasToken() {
    try {
      if (typeof window.authGetToken === 'function') {
        return !!window.authGetToken();
      }
      return !!(localStorage.getItem('token') || '');
    } catch (e0) {
      return false;
    }
  }

  function savePending(payload) {
    try {
      sessionStorage.setItem(IMPORT_KEY, JSON.stringify(payload || {}));
    } catch (e0) {}
  }

  function readPending() {
    try {
      var raw = sessionStorage.getItem(IMPORT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e0) {
      return null;
    }
  }

  function clearPending() {
    try {
      sessionStorage.removeItem(IMPORT_KEY);
    } catch (e0) {}
  }

  function parseApiJson(r) {
    if (typeof window.authParseJson === 'function') {
      return window.authParseJson(r);
    }
    return r.json();
  }

  function postTaxRecords(records) {
    var body = {
      action: 'batch_save_records',
      records: records
    };
    if (typeof window.authFetch === 'function') {
      return window.authFetch('/api/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(parseApiJson);
    }
    return fetch('/api/tax', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(parseApiJson);
  }

  function finishTaxrec(parsed) {
    var href = parsed && parsed.code
      ? 'najilu.html?view=verify&code=' + encodeURIComponent(parsed.code)
      : 'najilu.html?from=scan';
    window.location.href = href;
  }

  function importThenGo(parsed) {
    var records = parsed && Array.isArray(parsed.records) ? parsed.records : [];
    if (!records.length) {
      clearPending();
      finishTaxrec(parsed);
      return Promise.resolve();
    }
    if (!hasToken()) {
      savePending({
        code: parsed.code || '',
        period_start: parsed.period_start || '',
        period_end: parsed.period_end || '',
        records: records
      });
      window.location.href = loginUrl('scan.html?import=1');
      return Promise.resolve();
    }
    setHint('正在导入个税记录…');
    return postTaxRecords(records)
      .then(function (j) {
        if (!j || j.code !== 200) {
          throw new Error((j && j.msg) || '导入失败');
        }
        clearPending();
        window.location.href = 'najilu.html?from=scan';
      })
      .catch(function (err) {
        busy = false;
        setHint(err && err.message ? err.message : '导入失败，请稍后重试', true);
      });
  }

  function handleDecodedText(text) {
    if (busy) return;
    if (typeof window.parseTaxQrPayload !== 'function') {
      setHint('扫码模块未就绪', true);
      return;
    }
    var parsed = window.parseTaxQrPayload(text);
    if (!parsed || !parsed.ok) {
      setHint((parsed && parsed.reason) || '无法识别该二维码', true);
      return;
    }
    busy = true;
    stopCamera();
    if (parsed.type === 'verify') {
      window.location.href = parsed.href;
      return;
    }
    if (parsed.type === 'taxrec') {
      importThenGo(parsed);
      return;
    }
    busy = false;
    setHint('无法识别该二维码', true);
  }

  function jsQrDecode(imageData) {
    if (typeof jsQR !== 'function' || !imageData) return '';
    try {
      var out = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth'
      });
      return out && out.data ? String(out.data) : '';
    } catch (e0) {
      return '';
    }
  }

  function getImageData(img, sx, sy, sw, sh, maxSide) {
    var canvas = document.createElement('canvas');
    var dw = sw;
    var dh = sh;
    var cap = maxSide || 720;
    if (dw > cap || dh > cap) {
      var scale = cap / Math.max(dw, dh);
      dw = Math.max(1, Math.round(dw * scale));
      dh = Math.max(1, Math.round(dh * scale));
    }
    canvas.width = dw;
    canvas.height = dh;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    try {
      return ctx.getImageData(0, 0, dw, dh);
    } catch (e0) {
      return null;
    }
  }

  function decodeFromVideoFrame() {
    if (!videoEl || videoEl.readyState < 2) return '';
    var w = videoEl.videoWidth || 0;
    var h = videoEl.videoHeight || 0;
    if (w < 20 || h < 20) return '';
    var data = getImageData(videoEl, 0, 0, w, h, 640);
    return jsQrDecode(data);
  }

  function decodeFromImageElement(img) {
    var w = img.naturalWidth || img.width || 0;
    var h = img.naturalHeight || img.height || 0;
    if (w < 20 || h < 20) return Promise.resolve('');

    function tryJsQrRegions() {
      var regions = [
        [0, 0, w, h, 900],
        [Math.floor(w * 0.55), 0, Math.ceil(w * 0.45), Math.ceil(h * 0.5), 640],
        [Math.floor(w * 0.2), Math.floor(h * 0.2), Math.ceil(w * 0.6), Math.ceil(h * 0.6), 720]
      ];
      var i;
      for (i = 0; i < regions.length; i++) {
        var r = regions[i];
        var sx = Math.max(0, r[0]);
        var sy = Math.max(0, r[1]);
        var sw = Math.min(w - sx, r[2]);
        var sh = Math.min(h - sy, r[3]);
        if (sw < 20 || sh < 20) continue;
        var text = jsQrDecode(getImageData(img, sx, sy, sw, sh, r[4]));
        if (text) return text;
      }
      return '';
    }

    if (typeof BarcodeDetector === 'function') {
      try {
        if (!detector) detector = new BarcodeDetector({ formats: ['qr_code'] });
        return detector.detect(img).then(function (codes) {
          if (codes && codes[0] && codes[0].rawValue) {
            return String(codes[0].rawValue);
          }
          return tryJsQrRegions();
        }).catch(function () {
          return tryJsQrRegions();
        });
      } catch (e0) {
        return Promise.resolve(tryJsQrRegions());
      }
    }
    return Promise.resolve(tryJsQrRegions());
  }

  function tick() {
    if (busy || !streamRef) return;
    var text = decodeFromVideoFrame();
    if (text) {
      handleDecodedText(text);
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function stopCamera() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (streamRef) {
      streamRef.getTracks().forEach(function (t) {
        try {
          t.stop();
        } catch (e0) {}
      });
      streamRef = null;
    }
    if (videoEl) {
      try {
        videoEl.srcObject = null;
      } catch (e1) {}
    }
    document.body.classList.remove('has-camera');
  }

  function startGetUserMedia() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('no getUserMedia'));
    }
    return navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })
      .then(function (stream) {
        streamRef = stream;
        videoEl = $('scanVideo');
        if (!videoEl) throw new Error('no video');
        videoEl.srcObject = stream;
        videoEl.setAttribute('playsinline', 'true');
        videoEl.muted = true;
        document.body.classList.add('has-camera');
        return videoEl.play().catch(function () {});
      })
      .then(function () {
        rafId = requestAnimationFrame(tick);
      });
  }

  function startCamera() {
    startGetUserMedia().catch(function () {
      document.body.classList.add('camera-denied');
      setHint('无法打开摄像头，请点右下角相册选择图片', true);
    });
  }

  function loadFileAsImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('未选择图片'));
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('图片无法读取'));
      };
      img.src = url;
    });
  }

  function decodePickedFile(file) {
    setHint('正在识别相册图片…');
    return loadFileAsImage(file)
      .then(decodeFromImageElement)
      .then(function (text) {
        if (!text) {
          setHint('未识别到二维码，请换一张更清晰的图', true);
          return;
        }
        handleDecodedText(text);
      })
      .catch(function (err) {
        setHint(err && err.message ? err.message : '识别失败', true);
      });
  }

  function openAlbum() {
    if (
      window.navigator &&
      navigator.camera &&
      typeof navigator.camera.getPicture === 'function'
    ) {
      navigator.camera.getPicture(
        function (dataUrl) {
          var img = new Image();
          img.onload = function () {
            decodeFromImageElement(img).then(function (text) {
              if (!text) {
                setHint('未识别到二维码，请换一张更清晰的图', true);
                return;
              }
              handleDecodedText(text);
            });
          };
          img.onerror = function () {
            setHint('相册图片无法读取', true);
          };
          img.src =
            dataUrl.indexOf('data:') === 0 ? dataUrl : 'data:image/jpeg;base64,' + dataUrl;
        },
        function () {
          setHint('未选择相册图片', true);
        },
        {
          quality: 70,
          destinationType: navigator.camera.DestinationType
            ? navigator.camera.DestinationType.DATA_URL
            : 0,
          sourceType: navigator.camera.PictureSourceType
            ? navigator.camera.PictureSourceType.PHOTOLIBRARY
            : 0,
          encodingType: navigator.camera.EncodingType
            ? navigator.camera.EncodingType.JPEG
            : 0,
          mediaType: navigator.camera.MediaType ? navigator.camera.MediaType.PICTURE : 0,
          correctOrientation: true
        }
      );
      return;
    }
    var input = $('scanAlbumInput');
    if (input) input.click();
  }

  function resumePendingImport() {
    var pending = readPending();
    if (!pending || !Array.isArray(pending.records) || !pending.records.length) {
      return false;
    }
    busy = true;
    importThenGo({
      ok: true,
      type: 'taxrec',
      code: pending.code || '',
      period_start: pending.period_start || '',
      period_end: pending.period_end || '',
      records: pending.records
    });
    return true;
  }

  function bootFromQuery() {
    var params;
    try {
      params = new URLSearchParams(window.location.search);
    } catch (e0) {
      return false;
    }
    if (params.get('import') === '1' && resumePendingImport()) {
      return true;
    }
    var payload = params.get('payload') || params.get('text') || '';
    if (payload) {
      handleDecodedText(payload);
      return true;
    }
    return false;
  }

  function bindUi() {
    var back = $('scanBackBtn');
    if (back) {
      back.addEventListener('click', function (ev) {
        ev.preventDefault();
        goBack();
      });
    }
    var album = $('scanAlbumBtn');
    if (album) {
      album.addEventListener('click', function (ev) {
        ev.preventDefault();
        openAlbum();
      });
    }
    var input = $('scanAlbumInput');
    if (input) {
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        input.value = '';
        if (file) decodePickedFile(file);
      });
    }
  }

  window.__scanQrHandleDecodedText = handleDecodedText;
  window.__scanQrDecodeFromImage = decodeFromImageElement;

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopCamera();
    } else if (!busy && !document.body.classList.contains('camera-denied')) {
      startCamera();
    }
  });

  window.addEventListener('pagehide', stopCamera);
  window.addEventListener('beforeunload', stopCamera);

  document.addEventListener('DOMContentLoaded', function () {
    bindUi();
    if (typeof window.forceHidePageLoading === 'function') {
      window.forceHidePageLoading();
    }
    if (bootFromQuery()) {
      return;
    }
    startCamera();
  });
})();
