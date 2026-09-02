/** C 端：完税证明二维码 / 查询验证码替换（入口：支付页） */
(function (global) {
  var issueCache = [];
  var resultDataUrl = '';
  var assetPreviewUrl = '';
  var extractedPatchBlob = null;
  var extractSequence = 0;
  /* 源图与提取框（自然像素坐标），供框选校正使用 */
  var sourceImg = null;
  var sourceObjectUrl = '';
  var currentRegion = null;
  var lastQrBox = null;
  var lastQrAuto = false;
  var dragStart = null;
  var accountOverride = null;

  /* 标准画布宽 1240；二维码块 / 仅二维码区域 */
  var CERT_W = 1240;
  var BLOCK_X = 983;
  var BLOCK_Y = 42;
  var BLOCK_W = 185;
  var BLOCK_H = 310;
  var QR_ONLY_H = 185;
  /* 整块提取需覆盖比二维码更宽的 16 位验证码，且给末行字母留足下边距。 */
  var BLOCK_SIDE_PAD_RATIO = 0.12;
  var BLOCK_TOP_PAD_RATIO = 0.05;
  var BLOCK_BOTTOM_PAD_RATIO = 0.18;

  function authFetch(url, opts) {
    var fn = global.authFetch;
    if (typeof fn === 'function') {
      return fn(url, opts);
    }
    var headers = Object.assign({}, (opts && opts.headers) || {});
    try {
      var t = localStorage.getItem('token') || '';
      if (t && !headers.Authorization && !headers.authorization) {
        headers.Authorization = 'Bearer ' + t;
      }
    } catch (e0) {}
    return fetch(url, Object.assign({}, opts || {}, { headers: headers }));
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function setField(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value == null ? '' : String(value);
  }

  function setStatus(msg, isErr) {
    var status = document.getElementById('najiluQrStatus');
    if (status) {
      status.textContent = msg || '';
      status.className = 'status' + (isErr ? ' is-err' : '');
    }
  }

  function normalizeCode(raw) {
    return String(raw || '')
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  function loadImageFromFile(file) {
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
        reject(new Error('无法读取该图片'));
      };
      img.src = url;
    });
  }

  function regionForMode(mode, imgW, imgH) {
    var scale = imgW / CERT_W;
    var h = mode === 'qr' ? QR_ONLY_H : BLOCK_H;
    var sx = Math.round(BLOCK_X * scale);
    var sy = Math.round(BLOCK_Y * scale);
    var sw = Math.round(BLOCK_W * scale);
    var sh = Math.round(h * scale);
    if (mode !== 'qr') {
      var sidePad = Math.round(BLOCK_W * BLOCK_SIDE_PAD_RATIO * scale);
      var topPad = Math.round(BLOCK_W * BLOCK_TOP_PAD_RATIO * scale);
      var bottomPad = Math.round(BLOCK_W * BLOCK_BOTTOM_PAD_RATIO * scale);
      sx -= sidePad;
      sy -= topPad;
      sw += sidePad * 2;
      sh += topPad + bottomPad;
    }
    sw = Math.min(sw, imgW);
    sh = Math.min(sh, imgH);
    sx = Math.max(0, Math.min(sx, imgW - sw));
    sy = Math.max(0, Math.min(sy, imgH - sh));
    if (scale <= 0 || sw < 40 || sh < 40) {
      throw new Error('原始图尺寸不足，无法定位二维码区域');
    }
    return { sx: sx, sy: sy, sw: sw, sh: sh };
  }

  /**
   * 自己按像素找二维码，不依赖 BarcodeDetector（桌面 Chrome/Windows 普遍不支持，
   * 之前就是因此回退到固定坐标才抠错）。
   * 右上区域二值化 → 膨胀把二维码模块连成整块 → 取近正方形、黑占比接近二维码的连通块。
   */
  function detectQrBoxByPixels(img) {
    var natW = img.naturalWidth;
    var natH = img.naturalHeight;
    if (!natW || !natH) return null;
    var scale = Math.min(1, 1000 / natW);
    var w = Math.max(1, Math.round(natW * scale));
    var h = Math.max(1, Math.round(natH * scale));
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    var data;
    try {
      data = ctx.getImageData(0, 0, w, h).data;
    } catch (eData) {
      return null;
    }
    /* 二维码固定在完税证明右上角，只在该区域找，避免误命中国徽、表格、印章 */
    var rx0 = Math.floor(w * 0.58);
    var ry1 = Math.max(1, Math.floor(h * 0.5));
    var mw = w - rx0;
    if (mw < 8) return null;
    var dark = new Uint8Array(mw * ry1);
    var x;
    var y;
    for (y = 0; y < ry1; y++) {
      for (x = 0; x < mw; x++) {
        var i = (y * w + (x + rx0)) * 4;
        var lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        dark[y * mw + x] = lum < 150 ? 1 : 0;
      }
    }
    var r = Math.max(1, Math.round(w * 0.004));
    var dil = new Uint8Array(mw * ry1);
    for (y = 0; y < ry1; y++) {
      for (x = 0; x < mw; x++) {
        if (!dark[y * mw + x]) continue;
        var yy1 = Math.min(ry1 - 1, y + r);
        var xx1 = Math.min(mw - 1, x + r);
        for (var yy = Math.max(0, y - r); yy <= yy1; yy++) {
          for (var xx = Math.max(0, x - r); xx <= xx1; xx++) {
            dil[yy * mw + xx] = 1;
          }
        }
      }
    }
    var seen = new Uint8Array(mw * ry1);
    var queue = new Int32Array(mw * ry1);
    var best = null;
    var minSide = Math.max(12, Math.round(w * 0.05));
    for (y = 0; y < ry1; y++) {
      for (x = 0; x < mw; x++) {
        var start = y * mw + x;
        if (!dil[start] || seen[start]) continue;
        var head = 0;
        var tail = 0;
        queue[tail++] = start;
        seen[start] = 1;
        var bx0 = x;
        var bx1 = x;
        var by0 = y;
        var by1 = y;
        var area = 0;
        while (head < tail) {
          var cur = queue[head++];
          var cy = (cur / mw) | 0;
          var cx = cur - cy * mw;
          area++;
          if (cx < bx0) bx0 = cx;
          if (cx > bx1) bx1 = cx;
          if (cy < by0) by0 = cy;
          if (cy > by1) by1 = cy;
          if (cx > 0 && dil[cur - 1] && !seen[cur - 1]) {
            seen[cur - 1] = 1;
            queue[tail++] = cur - 1;
          }
          if (cx < mw - 1 && dil[cur + 1] && !seen[cur + 1]) {
            seen[cur + 1] = 1;
            queue[tail++] = cur + 1;
          }
          if (cy > 0 && dil[cur - mw] && !seen[cur - mw]) {
            seen[cur - mw] = 1;
            queue[tail++] = cur - mw;
          }
          if (cy < ry1 - 1 && dil[cur + mw] && !seen[cur + mw]) {
            seen[cur + mw] = 1;
            queue[tail++] = cur + mw;
          }
        }
        var bw = bx1 - bx0 + 1;
        var bh = by1 - by0 + 1;
        if (bw < minSide || bh < minSide) continue;
        var ratio = bw / bh;
        if (ratio < 0.75 || ratio > 1.33) continue;
        /* 须基本填满外框，排除表格线、印章圆环等空心图形 */
        if (area / (bw * bh) < 0.55) continue;
        var darkCount = 0;
        for (var ty = by0; ty <= by1; ty++) {
          for (var tx = bx0; tx <= bx1; tx++) {
            if (dark[ty * mw + tx]) darkCount++;
          }
        }
        var density = darkCount / (bw * bh);
        if (density < 0.25 || density > 0.78) continue;
        /* 扫描线上的黑白交替次数：二维码很多，国徽/文字块很少 */
        var fractions = [0.25, 0.5, 0.75];
        var transitions = 0;
        for (var fi = 0; fi < fractions.length; fi++) {
          var ry = by0 + Math.floor(bh * fractions[fi]);
          var rxc = bx0 + Math.floor(bw * fractions[fi]);
          var px;
          for (px = bx0 + 1; px <= bx1; px++) {
            if (dark[ry * mw + px] !== dark[ry * mw + px - 1]) transitions++;
          }
          for (px = by0 + 1; px <= by1; px++) {
            if (dark[px * mw + rxc] !== dark[(px - 1) * mw + rxc]) transitions++;
          }
        }
        if (transitions / (fractions.length * 2) < 6) continue;
        if (!best || bw * bh > best.bw * best.bh) {
          best = { bx0: bx0, by0: by0, bw: bw, bh: bh };
        }
      }
    }
    if (!best) return null;
    /* 去掉膨胀带来的外扩，再补回二维码自带的 1 模块静区（约 3.5%），逼近模板里的 185 方块 */
    best.bx0 += r;
    best.by0 += r;
    best.bw -= r * 2;
    best.bh -= r * 2;
    var pad = Math.round(Math.max(best.bw, best.bh) * 0.035);
    best.bx0 -= pad;
    best.by0 -= pad;
    best.bw += pad * 2;
    best.bh += pad * 2;
    if (best.bw < 4 || best.bh < 4) return null;
    return {
      x: Math.round((best.bx0 + rx0) / scale),
      y: Math.round(best.by0 / scale),
      width: Math.round(best.bw / scale),
      height: Math.round(best.bh / scale)
    };
  }

  /** 二维码外框 → 提取区域；整块模式按模板比例向下包含 16 位查询验证码 */
  function regionFromQrBox(box, mode, imgW, imgH) {
    var qrSize = Math.max(box.width, box.height);
    var sidePad = mode === 'qr' ? 0 : qrSize * BLOCK_SIDE_PAD_RATIO;
    var topPad = mode === 'qr' ? 0 : qrSize * BLOCK_TOP_PAD_RATIO;
    var bottomPad = mode === 'qr' ? 0 : qrSize * BLOCK_BOTTOM_PAD_RATIO;
    var sw = Math.round(qrSize + sidePad * 2);
    var sh =
      mode === 'qr'
        ? sw
        : Math.round((qrSize * BLOCK_H) / BLOCK_W + topPad + bottomPad);
    var sx = Math.round(box.x + box.width / 2 - sw / 2);
    var sy = Math.round(box.y + box.height / 2 - qrSize / 2 - topPad);
    sw = Math.min(sw, imgW);
    sh = Math.min(sh, imgH);
    sx = Math.max(0, Math.min(sx, imgW - sw));
    sy = Math.max(0, Math.min(sy, imgH - sh));
    return {
      sx: sx,
      sy: sy,
      sw: Math.min(sw, imgW - sx),
      sh: Math.min(sh, imgH - sy)
    };
  }

  /** 定位：像素检测优先，检测不到才退回标准证书坐标 */
  function locateQrRegion(img, mode) {
    var box = null;
    try {
      box = detectQrBoxByPixels(img);
    } catch (e) {
      box = null;
    }
    if (box) {
      lastQrBox = box;
      lastQrAuto = true;
      return regionFromQrBox(box, mode, img.naturalWidth, img.naturalHeight);
    }
    lastQrAuto = false;
    var fallback = regionForMode(mode, img.naturalWidth, img.naturalHeight);
    lastQrBox = {
      x: fallback.sx,
      y: fallback.sy,
      width: fallback.sw,
      height: Math.min(fallback.sw, fallback.sh)
    };
    return fallback;
  }

  /** 把替换图贴到原始完整完税证明右上角 */
  function compositeOntoFull(fullImg, patchImg, mode) {
    var region = regionForMode(mode, fullImg.naturalWidth, fullImg.naturalHeight);
    var canvas = document.createElement('canvas');
    canvas.width = fullImg.naturalWidth;
    canvas.height = fullImg.naturalHeight;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(fullImg, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(region.sx, region.sy, region.sw, region.sh);
    ctx.imageSmoothingEnabled = true;
    if (typeof ctx.imageSmoothingQuality === 'string') {
      ctx.imageSmoothingQuality = 'high';
    }
    ctx.drawImage(patchImg, region.sx, region.sy, region.sw, region.sh);
    return canvas.toDataURL('image/png');
  }

  function showAssetPreview(file) {
    var prev = document.getElementById('najiluQrAssetPreview');
    if (!prev || !file) return;
    if (assetPreviewUrl) URL.revokeObjectURL(assetPreviewUrl);
    assetPreviewUrl = URL.createObjectURL(file);
    prev.src = assetPreviewUrl;
    prev.style.display = 'block';
  }

  function showResultPreview(dataUrl) {
    resultDataUrl = dataUrl || '';
    var wrap = document.getElementById('najiluQrCertPreview');
    var dl = document.getElementById('najiluQrDownloadBtn');
    if (wrap) {
      wrap.innerHTML = '';
      if (dataUrl) {
        var img = document.createElement('img');
        img.src = dataUrl;
        img.alt = '完税证明结果';
        img.style.cssText = 'max-width:100%;border:1px solid #ddd;margin-bottom:12px;background:#fff;';
        wrap.appendChild(img);
      }
    }
    if (dl) dl.style.display = dataUrl ? '' : 'none';
  }

  function selectedFullFile() {
    var input = document.getElementById('najiluQrFullFile');
    return input && input.files && input.files[0] ? input.files[0] : null;
  }

  function selectedPatchFile() {
    var input = document.getElementById('najiluQrFile');
    var direct = input && input.files && input.files[0] ? input.files[0] : null;
    return direct || extractedPatchBlob;
  }

  /** 从标准完整完税证明中按原始像素比例裁出二维码 + 16 位查询验证码，不缩放源素材。 */
  function extractRegionBlob(img, region) {
    var canvas = document.createElement('canvas');
    canvas.width = Math.max(1, region.sw);
    canvas.height = Math.max(1, region.sh);
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      img,
      region.sx,
      region.sy,
      region.sw,
      region.sh,
      0,
      0,
      region.sw,
      region.sh
    );
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error('二维码区域提取失败'));
          return;
        }
        resolve(blob);
      }, 'image/png', 1);
    });
  }

  /** 把提取框画到源图预览上，便于人工确认/纠正 */
  function drawCropBox() {
    var box = document.getElementById('najiluQrCropBox');
    var imgEl = document.getElementById('najiluQrCropImg');
    if (!box || !imgEl || !sourceImg || !currentRegion) return;
    var shown = imgEl.clientWidth;
    if (!shown) return;
    var k = shown / sourceImg.naturalWidth;
    box.style.display = 'block';
    box.style.left = Math.round(currentRegion.sx * k) + 'px';
    box.style.top = Math.round(currentRegion.sy * k) + 'px';
    box.style.width = Math.round(currentRegion.sw * k) + 'px';
    box.style.height = Math.round(currentRegion.sh * k) + 'px';
  }

  /** 用当前提取框裁图并作为替换素材 */
  function applyCurrentRegion(note) {
    if (!sourceImg || !currentRegion) return;
    var seq = ++extractSequence;
    drawCropBox();
    extractRegionBlob(sourceImg, currentRegion)
      .then(function (blob) {
        if (seq !== extractSequence) return;
        extractedPatchBlob = blob;
        showAssetPreview(blob);
        setStatus(note || '已提取二维码与查询验证码，可点「预览结果」后保存', false);
      })
      .catch(function (e) {
        if (seq !== extractSequence) return;
        extractedPatchBlob = null;
        setStatus('提取失败：' + (e && e.message ? e.message : '错误'), true);
      });
  }

  function fillIssueSelect(list) {
    var sel = document.getElementById('najiluQrIssueId');
    if (!sel) return;
    issueCache = Array.isArray(list) ? list : [];
    sel.innerHTML = '';
    var optAny = document.createElement('option');
    optAny.value = '';
    optAny.textContent = issueCache.length
      ? '不绑定具体记录（仅锁定账号默认码）'
      : '暂无开具记录（仍可先锁定账号默认码）';
    sel.appendChild(optAny);
    issueCache.forEach(function (it, idx) {
      var opt = document.createElement('option');
      opt.value = String(it.id || '');
      opt.textContent =
        (it.apply_time || it.created_at || '') +
        ' · ' +
        (it.period_start || '') +
        '~' +
        (it.period_end || '') +
        (it.query_code ? ' · ' + it.query_code : '');
      if (idx === 0) opt.selected = true;
      sel.appendChild(opt);
    });
    onIssueChange();
  }

  function currentIssue() {
    var id = val('najiluQrIssueId');
    for (var i = 0; i < issueCache.length; i++) {
      if (String(issueCache[i].id) === id) return issueCache[i];
    }
    return null;
  }

  function updateLockedBox() {
    var box = document.getElementById('najiluQrLockedBox');
    if (!box) return;
    var locked =
      accountOverride &&
      (accountOverride.qr_block_image_url || accountOverride.qr_image_url);
    box.hidden = !locked;
    if (locked && !selectedPatchFile()) {
      var prev = document.getElementById('najiluQrAssetPreview');
      var url = accountOverride.qr_block_image_url || accountOverride.qr_image_url || '';
      if (prev && url) {
        prev.src = url.charAt(0) === '/' || /^https?:/i.test(url) ? url : '/' + url;
        prev.style.display = 'block';
      }
      if (accountOverride.query_code) {
        setField('najiluQrQueryCode', accountOverride.query_code);
      }
      var modeEl = document.getElementById('najiluQrMode');
      if (modeEl) {
        modeEl.value = accountOverride.qr_block_image_url
          ? 'block'
          : accountOverride.qr_image_url
            ? 'qr'
            : 'block';
      }
    }
  }

  function onIssueChange() {
    var it = currentIssue();
    if (!it) {
      if (accountOverride && accountOverride.query_code) {
        setField('najiluQrQueryCode', accountOverride.query_code);
      }
      return;
    }
    setField('najiluQrQueryCode', it.query_code || '');
    var modeEl = document.getElementById('najiluQrMode');
    if (modeEl) {
      modeEl.value = it.qr_block_image_url ? 'block' : it.qr_image_url ? 'qr' : 'block';
    }
    var prev = document.getElementById('najiluQrAssetPreview');
    var url = it.qr_block_image_url || it.qr_image_url || '';
    if (prev && url && !selectedPatchFile()) {
      prev.src = url.charAt(0) === '/' || /^https?:/i.test(url) ? url : '/' + url;
      prev.style.display = 'block';
    }
  }

  function loadIssues() {
    setStatus('加载中…', false);
    authFetch('/api/najilu-qr/list')
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          setStatus((j && j.msg) || '加载失败', true);
          return;
        }
        accountOverride = j.data.qr_override || null;
        fillIssueSelect(j.data.applications || []);
        updateLockedBox();
        var n = (j.data.applications || []).length;
        setStatus(
          n
            ? '已加载 ' + n + ' 条开具记录' + (accountOverride ? '；账号已有锁定码' : '')
            : accountOverride
              ? '暂无开具记录；账号已有锁定码，可覆盖或清除'
              : '暂无开具记录，上传保存后将作为账号默认码',
          false
        );
      })
      .catch(function (e) {
        setStatus('加载失败：' + (e && e.message ? e.message : '网络错误'), true);
      });
  }

  function onFileChange() {
    var input = document.getElementById('najiluQrFile');
    var file = input && input.files && input.files[0] ? input.files[0] : null;
    if (!file) return;
    extractedPatchBlob = null;
    var fullInput = document.getElementById('najiluQrFullFile');
    if (fullInput) fullInput.value = '';
    showAssetPreview(file);
    setStatus('替换图已就绪，可预览或直接保存', false);
  }

  function onFullFileChange() {
    var file = selectedFullFile();
    if (!file) return;
    extractedPatchBlob = null;
    currentRegion = null;
    var directInput = document.getElementById('najiluQrFile');
    if (directInput) directInput.value = '';
    setStatus('正在识别二维码位置…', false);
    loadImageFromFile(file)
      .then(function (img) {
        sourceImg = img;
        var wrap = document.getElementById('najiluQrCropWrap');
        var imgEl = document.getElementById('najiluQrCropImg');
        if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
        sourceObjectUrl = URL.createObjectURL(file);
        if (imgEl) imgEl.src = sourceObjectUrl;
        if (wrap) wrap.style.display = 'block';
        currentRegion = locateQrRegion(img, val('najiluQrMode') || 'block');
        applyCurrentRegion(
          lastQrAuto
            ? '已自动识别二维码；如框选位置不对，可在下方源图上拖动重新框选'
            : '未能自动识别二维码，已用标准位置；请在下方源图上拖动框选正确区域'
        );
      })
      .catch(function (e) {
        setStatus(
          '自动识别失败（' + (e && e.message ? e.message : '错误') + '），请在源图上拖动框选二维码区域',
          true
        );
      });
  }

  function onModeChange() {
    if (!sourceImg) return;
    if (lastQrBox) {
      currentRegion = regionFromQrBox(
        lastQrBox,
        val('najiluQrMode') || 'block',
        sourceImg.naturalWidth,
        sourceImg.naturalHeight
      );
      applyCurrentRegion();
    }
  }

  /** 源图上拖动框选：所选矩形即为替换素材区域 */
  function cropPointToNatural(ev) {
    var imgEl = document.getElementById('najiluQrCropImg');
    if (!imgEl || !sourceImg) return null;
    var rect = imgEl.getBoundingClientRect();
    if (!rect.width) return null;
    var k = sourceImg.naturalWidth / rect.width;
    return {
      x: Math.max(0, Math.min(sourceImg.naturalWidth, Math.round((ev.clientX - rect.left) * k))),
      y: Math.max(0, Math.min(sourceImg.naturalHeight, Math.round((ev.clientY - rect.top) * k)))
    };
  }

  function onCropDown(ev) {
    if (!sourceImg) return;
    var p = cropPointToNatural(ev);
    if (!p) return;
    ev.preventDefault();
    dragStart = p;
  }

  function onCropMove(ev) {
    if (!dragStart) return;
    var p = cropPointToNatural(ev);
    if (!p) return;
    currentRegion = {
      sx: Math.min(dragStart.x, p.x),
      sy: Math.min(dragStart.y, p.y),
      sw: Math.abs(p.x - dragStart.x),
      sh: Math.abs(p.y - dragStart.y)
    };
    drawCropBox();
  }

  function onCropUp(ev) {
    if (!dragStart) return;
    onCropMove(ev);
    dragStart = null;
    if (!currentRegion || currentRegion.sw < 20 || currentRegion.sh < 20) {
      setStatus('框选区域太小，请重新拖动框选二维码区域', true);
      return;
    }
    lastQrBox = null;
    applyCurrentRegion('已按框选区域提取，可点「预览 / 生成结果图」');
  }

  function buildFormData(extra) {
    var fd = new FormData();
    fd.append('issue_id', val('najiluQrIssueId'));
    fd.append('query_code', normalizeCode(val('najiluQrQueryCode')));
    fd.append('mode', val('najiluQrMode') || 'block');
    if (extra && extra.clear) fd.append('mode', 'clear');
    var file = selectedPatchFile();
    if (file && !(extra && extra.clear)) {
      if (file === extractedPatchBlob) fd.append('file', file, 'najilu-qr-block.png');
      else fd.append('file', file);
    }
    return fd;
  }

  function save(clear) {
    var code = normalizeCode(val('najiluQrQueryCode'));
    if (code && !/^[A-Z0-9]{16}$/.test(code)) {
      setStatus('查询验证码须为 16 位字母或数字', true);
      return;
    }
    var file = selectedPatchFile();
    if (!clear && !file && !code) {
      setStatus('请上传替换图片或填写验证码', true);
      return;
    }
    setStatus(clear ? '清除中…' : '保存中…', false);
    authFetch('/api/najilu-qr/save', {
      method: 'POST',
      body: buildFormData({ clear: !!clear })
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { http: r.status, j: j };
        });
      })
      .then(function (pack) {
        var j = pack.j;
        if (!j || j.code !== 200) {
          setStatus((j && j.msg) || '保存失败（HTTP ' + pack.http + '）', true);
          return;
        }
        setStatus(
          clear
            ? '已清除自定义二维码，之后重新生成将自动出码'
            : '已保存为我的默认二维码，之后重新生成都用这张码',
          false
        );
        loadIssues();
      })
      .catch(function (e) {
        setStatus('保存失败：' + (e && e.message ? e.message : '网络错误'), true);
      });
  }

  function previewCert() {
    var patch = selectedPatchFile();
    var full = selectedFullFile();
    if (full && !patch) {
      setStatus('正在提取二维码区域，请稍后再点预览', false);
      return;
    }
    if (!patch && !full) {
      setStatus('请先上传完整完税证明图或裁切图', true);
      return;
    }
    setStatus('正在生成预览…', false);

    function showComposite(fullImg, patchImg) {
      var mode = val('najiluQrMode') || 'block';
      var dataUrl = compositeOntoFull(fullImg, patchImg, mode);
      showResultPreview(dataUrl);
      setStatus('预览已生成（基于上传原图合成）；确认后可保存', false);
    }

    if (full && patch) {
      Promise.all([loadImageFromFile(full), loadImageFromFile(patch)])
        .then(function (pair) {
          showComposite(pair[0], pair[1]);
        })
        .catch(function (e) {
          setStatus('预览失败：' + (e && e.message ? e.message : '错误'), true);
        });
      return;
    }

    if (patch) {
      showAssetPreview(patch);
      showResultPreview('');
      setStatus('已显示替换素材；上传完整图可预览贴回效果', false);
    }
  }

  function downloadResult() {
    if (!resultDataUrl) {
      setStatus('请先生成预览', true);
      return;
    }
    var a = document.createElement('a');
    a.href = resultDataUrl;
    a.download = '完税证明-二维码已替换.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  var feeAmount = '300.00';
  var unlocked = false;
  var pollTimer = null;
  var pendingOtn = '';
  var NAJILU_QR_SKU_ID = 'sku_najilu_qr_300';

  function formatFeeYuan(raw) {
    var n = Number(String(raw == null ? '' : raw).replace(/,/g, '').trim());
    if (!isFinite(n) || n < 0) return '';
    return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
  }

  function setPayStatus(msg, isErr) {
    var el = document.getElementById('najiluQrPayStatus');
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = msg;
    el.className = 'status' + (isErr ? ' is-err' : '');
  }

  function applyUnlockedUi(isOn) {
    unlocked = !!isOn;
    var payCard = document.getElementById('cardNajiluQrPay');
    var toolCard = document.getElementById('cardNajiluQrTool');
    if (payCard) payCard.hidden = unlocked;
    if (toolCard) toolCard.hidden = !unlocked;
    var yuan = formatFeeYuan(feeAmount) || feeAmount;
    var payTitle = document.getElementById('najiluQrPayTitle');
    if (payTitle) payTitle.textContent = '开通权益 · ¥' + yuan;
    var payBtn = document.getElementById('btnNajiluQrPay');
    if (payBtn) payBtn.textContent = '支付宝付款开通 ¥' + yuan;
    var hero = document.getElementById('najiluQrHeroDesc');
    if (hero) {
      hero.textContent = unlocked
        ? '上传含目标二维码的完整完税证明图，系统自动抠出右上角「二维码 + 16 位查询验证码」，保存后本账号重新生成纳税记录都用这张码。'
        : ('支付宝付 ¥' + yuan + ' 开通后，可上传并锁定本账号默认完税二维码；之后重新生成纳税记录都用这张码。');
    }
  }

  function loadStatus() {
    return authFetch('/api/najilu-qr/status')
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          throw new Error((j && j.msg) || '读取权益失败');
        }
        if (j.data.fee_amount) feeAmount = String(j.data.fee_amount);
        if (j.data.sku_id) NAJILU_QR_SKU_ID = String(j.data.sku_id);
        applyUnlockedUi(!!j.data.unlocked);
        if (unlocked) loadIssues();
        else setPayStatus('');
      })
      .catch(function (e) {
        applyUnlockedUi(false);
        setPayStatus((e && e.message) || '读取权益失败', true);
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
        if (st === 'paid' && (sku === NAJILU_QR_SKU_ID || !pendingOtn || otn === pendingOtn)) {
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
          pendingOtn = '';
          setPayStatus('支付成功，权益已开通');
          applyUnlockedUi(true);
          loadIssues();
        }
      })
      .catch(function () {});
  }

  function startPay() {
    setPayStatus('正在创建订单…');
    var qrWrap = document.getElementById('najiluQrPayQrWrap');
    if (qrWrap) {
      qrWrap.hidden = false;
      qrWrap.innerHTML = '<p style="color:#888;font-size:13px;">生成付款码…</p>';
    }
    authFetch('/api/payments/alipay/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: 'najilu_qr', sku_id: NAJILU_QR_SKU_ID })
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          setPayStatus((j && j.msg) || '创建订单失败', true);
          if (qrWrap) qrWrap.innerHTML = '';
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
            qrWrap.innerHTML = '<img src="' + dataUrl + '" alt="付款码" style="max-width:180px;">';
          });
        } else if (qr && qrWrap) {
          qrWrap.innerHTML =
            '<p style="font-size:12px;word-break:break-all;">请复制到支付宝打开：<br>' +
            qr +
            '</p>';
        }
        setPayStatus('请使用支付宝扫码支付 ¥' + (formatFeeYuan(feeAmount) || feeAmount));
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(pollPay, 2500);
      })
      .catch(function () {
        setPayStatus('网络错误', true);
      });
  }

  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    var saveBtn = document.getElementById('najiluQrSaveBtn');
    var clearBtn = document.getElementById('najiluQrClearBtn');
    var previewBtn = document.getElementById('najiluQrPreviewBtn');
    var file = document.getElementById('najiluQrFile');
    var fullFile = document.getElementById('najiluQrFullFile');
    var mode = document.getElementById('najiluQrMode');
    var sel = document.getElementById('najiluQrIssueId');
    var back = document.getElementById('najiluQrBack');
    if (back) {
      try {
        var from = new URLSearchParams(window.location.search).get('from') || '';
        if (from === 'purchase') back.href = 'purchase.html';
        else if (from) back.href = decodeURIComponent(from);
      } catch (eFrom) {}
    }
    var payBtn = document.getElementById('btnNajiluQrPay');
    if (payBtn) payBtn.addEventListener('click', startPay);
    if (saveBtn) saveBtn.addEventListener('click', function () { save(false); });
    if (clearBtn) clearBtn.addEventListener('click', function () { save(true); });
    if (previewBtn) previewBtn.addEventListener('click', previewCert);
    if (file) file.addEventListener('change', onFileChange);
    if (fullFile) fullFile.addEventListener('change', onFullFileChange);
    if (mode) mode.addEventListener('change', onModeChange);
    if (sel) sel.addEventListener('change', onIssueChange);
    var cropImg = document.getElementById('najiluQrCropImg');
    if (cropImg) {
      cropImg.addEventListener('mousedown', onCropDown);
      cropImg.addEventListener('touchstart', function (ev) {
        if (!ev.touches || !ev.touches[0]) return;
        ev.preventDefault();
        onCropDown({
          clientX: ev.touches[0].clientX,
          clientY: ev.touches[0].clientY,
          preventDefault: function () {}
        });
      }, { passive: false });
      cropImg.addEventListener('load', drawCropBox);
    }
    document.addEventListener('mousemove', onCropMove);
    document.addEventListener('mouseup', onCropUp);
    document.addEventListener('touchmove', function (ev) {
      if (!dragStart || !ev.touches || !ev.touches[0]) return;
      ev.preventDefault();
      onCropMove({
        clientX: ev.touches[0].clientX,
        clientY: ev.touches[0].clientY
      });
    }, { passive: false });
    document.addEventListener('touchend', function (ev) {
      if (!dragStart) return;
      var t = ev.changedTouches && ev.changedTouches[0];
      onCropUp({
        clientX: t ? t.clientX : 0,
        clientY: t ? t.clientY : 0
      });
    });
    window.addEventListener('resize', drawCropBox);
  }

  function init() {
    bind();
    loadStatus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.NajiluQrUser = {
    loadIssues: loadIssues,
    previewCert: previewCert,
    _regionFromQrBox: regionFromQrBox,
    _regionForMode: regionForMode
  };
})(window);
