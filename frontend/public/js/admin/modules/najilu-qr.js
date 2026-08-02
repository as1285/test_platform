/** Admin module: 完税证明二维码 / 查询验证码替换 */
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

  /* 标准画布宽 1240；二维码块 / 仅二维码区域 */
  var CERT_W = 1240;
  var BLOCK_X = 983;
  var BLOCK_Y = 42;
  var BLOCK_W = 185;
  var BLOCK_H = 310;
  var QR_ONLY_H = 185;

  function fetchAdmin(url, opts) {
    var fn = global.adminFetch;
    if (typeof fn !== 'function') {
      return Promise.reject(new Error('adminFetch unavailable'));
    }
    return fn(url, opts);
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
      status.style.color = isErr ? '#b91c1c' : '';
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
    sw = Math.min(sw, imgW - sx);
    sh = Math.min(sh, imgH - sy);
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
    var sw = Math.round(qrSize);
    var sh = mode === 'qr' ? sw : Math.round((sw * BLOCK_H) / BLOCK_W);
    var sx = Math.round(box.x + box.width / 2 - sw / 2);
    var sy = Math.round(box.y + box.height / 2 - qrSize / 2);
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
        setStatus(
          note ||
            (currentIssue()
              ? '已提取二维码与查询验证码，可点「预览 / 生成结果图」'
              : '提取完成；请先加载并选择要替换的开具记录'),
          false
        );
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
    if (!issueCache.length) {
      var opt0 = document.createElement('option');
      opt0.value = '';
      opt0.textContent = '（无开具记录）';
      sel.appendChild(opt0);
      return;
    }
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

  function onIssueChange() {
    var it = currentIssue();
    if (!it) {
      setField('najiluQrQueryCode', '');
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
      prev.src = url.charAt(0) === '/' ? url : '/' + url;
      prev.style.display = 'block';
    }
  }

  function loadIssues() {
    var username = val('najiluQrUser');
    if (!username) {
      setStatus('请输入用户名', true);
      return;
    }
    setStatus('加载开具记录…', false);
    fetchAdmin('api/admin/najilu-qr/list?username=' + encodeURIComponent(username))
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          setStatus((j && j.msg) || '加载失败', true);
          return;
        }
        fillIssueSelect(j.data.applications || []);
        setStatus(
          (j.data.applications || []).length
            ? '已加载 ' + j.data.applications.length + ' 条开具记录'
            : '该用户暂无开具记录',
          !(j.data.applications || []).length
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
    setStatus(
      currentIssue()
        ? '替换图已就绪，将直接使用已选开具记录生成结果图'
        : '替换图已就绪；请先加载开具记录，或上传原始完整图',
      false
    );
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
    fd.append('username', val('najiluQrUser'));
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
    if (!val('najiluQrUser') || !val('najiluQrIssueId')) {
      setStatus('保存到账号时需先加载并选择开具记录（本地改图无需此项）', true);
      return;
    }
    var code = normalizeCode(val('najiluQrQueryCode'));
    if (code && !/^[A-Z0-9]{16}$/.test(code)) {
      setStatus('查询验证码须为 16 位字母或数字', true);
      return;
    }
    var file = selectedPatchFile();
    if (!clear && !file && !code) {
      setStatus('请填写验证码或上传替换图片', true);
      return;
    }
    setStatus(clear ? '清除中…' : '保存中…', false);
    var token = '';
    try {
      token = localStorage.getItem('admin_token') || '';
    } catch (e0) {}
    var headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    fetch('/api/admin/najilu-qr/save', {
      method: 'POST',
      headers: headers,
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
        setStatus(clear ? '已清除自定义二维码' : '已保存到开具记录', false);
        loadIssues();
      })
      .catch(function (e) {
        setStatus('保存失败：' + (e && e.message ? e.message : '网络错误'), true);
      });
  }

  /** 主流程：原始完整图 + 替换图 → 结果图（无需开具记录） */
  function previewFromFiles() {
    var full = selectedFullFile();
    var patch = selectedPatchFile();
    if (!full) {
      setStatus('请先上传原始完整完税证明图片', true);
      return Promise.reject(new Error('no full'));
    }
    if (!patch) {
      setStatus('请先上传替换图片（二维码块）', true);
      return Promise.reject(new Error('no patch'));
    }
    var mode = val('najiluQrMode') || 'block';
    setStatus('正在生成结果图…', false);
    return Promise.all([loadImageFromFile(full), loadImageFromFile(patch)])
      .then(function (imgs) {
        var dataUrl = compositeOntoFull(imgs[0], imgs[1], mode);
        showResultPreview(dataUrl);
        setStatus('结果已生成，可下载；无需开具记录', false);
        return dataUrl;
      });
  }

  function previewCert() {
    var patch = selectedPatchFile();
    var username = val('najiluQrUser');
    var issue = currentIssue();
    /*
     * 使用开具记录重绘底图；上传的完整图片只作为二维码素材源，
     * 系统先原比例裁出二维码 + 16 位验证码，再贴到记录生成图。
     */
    if (!username || !issue) {
      setStatus('请先输入用户名并加载、选择开具记录', true);
      return;
    }
    if (selectedFullFile() && !patch) {
      setStatus('正在提取二维码区域，请稍后再点预览', false);
      return;
    }
    setStatus('正在读取开具记录并生成预览…', false);
    var code = normalizeCode(val('najiluQrQueryCode'));
    var loader = global.AdminLoader;
    var ensure =
      loader && typeof loader.ensureForPage === 'function'
        ? loader.ensureForPage('najilu-qr')
        : Promise.resolve();
    ensure
      .then(function () {
        return fetchAdmin(
          '/api/admin/najilu-qr/prefill?username=' + encodeURIComponent(username)
        ).then(function (r) {
          return r.json();
        });
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          throw new Error((j && j.msg) || '用户数据加载失败');
        }
        var Cert = global.TaxIssueCertificate;
        if (!Cert || typeof Cert.buildAppFromAdminDetail !== 'function') {
          throw new Error('完税证明渲染器未加载');
        }
        var detail = Object.assign({}, j.data);
        detail.latest_issue_application = Object.assign({}, issue, {
          query_code: code || issue.query_code || ''
        });
        var app = Cert.buildAppFromAdminDetail(detail);
        var mode = val('najiluQrMode') || 'block';
        var opts = { query_code: code || app.query_code, showStamp: true };

        function renderWithOpts(o) {
          return Cert.renderDataUrl(app, o).then(function (urlOrUrls) {
            var urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
            resultDataUrl = urls[0] || '';
            var wrap = document.getElementById('najiluQrCertPreview');
            var dl = document.getElementById('najiluQrDownloadBtn');
            if (wrap) {
              wrap.innerHTML = '';
              urls.forEach(function (u) {
                var img = document.createElement('img');
                img.src = u;
                img.alt = '完税证明预览';
                img.style.cssText = 'max-width:100%;border:1px solid #ddd;margin-bottom:12px;background:#fff;';
                wrap.appendChild(img);
              });
            }
            if (dl) dl.style.display = resultDataUrl ? '' : 'none';
            setStatus('已直接使用开具记录生成结果图，可下载或保存', false);
          });
        }

        if (patch) {
          return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () {
              if (mode === 'qr') opts.qr_image_url = reader.result;
              else opts.qr_block_image_url = reader.result;
              resolve(renderWithOpts(opts));
            };
            reader.onerror = function () {
              reject(new Error('无法读取替换图片'));
            };
            reader.readAsDataURL(patch);
          });
        }
        if (issue.qr_block_image_url) opts.qr_block_image_url = issue.qr_block_image_url;
        if (issue.qr_image_url) opts.qr_image_url = issue.qr_image_url;
        return renderWithOpts(opts);
      })
      .catch(function (e) {
        setStatus('预览失败：' + (e && e.message ? e.message : '错误'), true);
      });
  }

  function downloadResult() {
    if (!resultDataUrl) {
      setStatus('请先生成结果图', true);
      return;
    }
    var a = document.createElement('a');
    a.href = resultDataUrl;
    a.download = '完税证明-二维码已替换.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    var loadBtn = document.getElementById('najiluQrLoadBtn');
    var saveBtn = document.getElementById('najiluQrSaveBtn');
    var clearBtn = document.getElementById('najiluQrClearBtn');
    var previewBtn = document.getElementById('najiluQrPreviewBtn');
    var downloadBtn = document.getElementById('najiluQrDownloadBtn');
    var file = document.getElementById('najiluQrFile');
    var fullFile = document.getElementById('najiluQrFullFile');
    var mode = document.getElementById('najiluQrMode');
    var sel = document.getElementById('najiluQrIssueId');
    if (loadBtn) loadBtn.addEventListener('click', loadIssues);
    if (saveBtn) saveBtn.addEventListener('click', function () { save(false); });
    if (clearBtn) clearBtn.addEventListener('click', function () { save(true); });
    if (previewBtn) previewBtn.addEventListener('click', previewCert);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadResult);
    if (file) file.addEventListener('change', onFileChange);
    if (fullFile) fullFile.addEventListener('change', onFullFileChange);
    if (mode) mode.addEventListener('change', onModeChange);
    if (sel) sel.addEventListener('change', onIssueChange);
    var cropImg = document.getElementById('najiluQrCropImg');
    if (cropImg) {
      cropImg.addEventListener('mousedown', onCropDown);
      cropImg.addEventListener('load', drawCropBox);
    }
    document.addEventListener('mousemove', onCropMove);
    document.addEventListener('mouseup', onCropUp);
    window.addEventListener('resize', drawCropBox);
  }

  function loadPage() {
    bind();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['najilu-qr'] = {
    ready: true,
    loadPage: loadPage,
    loadIssues: loadIssues,
    previewCert: previewCert
  };
})(window);
