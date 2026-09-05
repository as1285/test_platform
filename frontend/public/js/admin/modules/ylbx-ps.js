/** Admin module: 社保缴费证明原图像素 PS
 * UX 参考 DrawStamp Studio / najilu-qr：拖拽上传 → 预览 → 再下载
 */
(function (global) {
  var lastResult = null;
  var srcObjectUrl = '';

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
    var status = document.getElementById('ylbxStatus');
    if (status) {
      status.textContent = msg || '';
      status.style.color = isErr ? '#b91c1c' : '';
    }
  }

  function setBusy(busy) {
    var btn = document.getElementById('ylbxEditBtn');
    if (btn) {
      btn.disabled = !!busy;
      btn.textContent = busy ? '处理中…' : '生成预览';
    }
  }

  function downloadBase64(b64, filename, mime) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    var blob = new Blob([bytes], { type: mime || 'image/png' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'ylbx-ps-demo.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  function showPreviewWrap(on) {
    var wrap = document.getElementById('ylbxPreviewWrap');
    if (!wrap) return;
    if (on) wrap.removeAttribute('hidden');
    else wrap.setAttribute('hidden', '');
  }

  function setDownloadVisible(on) {
    var btn = document.getElementById('ylbxDownloadBtn');
    if (!btn) return;
    if (on) btn.removeAttribute('hidden');
    else btn.setAttribute('hidden', '');
  }

  function acceptFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type || '') && !/\.(png|jpe?g|webp)$/i.test(file.name || '')) {
      setStatus('请上传 PNG / JPG / WebP 图片', true);
      return;
    }
    var input = document.getElementById('ylbxImageFile');
    if (input) {
      try {
        var dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
      } catch (e0) {}
    }
    if (srcObjectUrl) {
      try {
        URL.revokeObjectURL(srcObjectUrl);
      } catch (e1) {}
    }
    srcObjectUrl = URL.createObjectURL(file);
    var srcImg = document.getElementById('ylbxPreviewSrc');
    var outImg = document.getElementById('ylbxPreviewOut');
    var nameEl = document.getElementById('ylbxFileName');
    if (srcImg) srcImg.src = srcObjectUrl;
    if (outImg) outImg.removeAttribute('src');
    if (nameEl) nameEl.textContent = file.name + ' · ' + Math.round(file.size / 1024) + ' KB';
    lastResult = null;
    setDownloadVisible(false);
    showPreviewWrap(true);
    setStatus('原图已就绪，可填写字段后生成预览', false);
  }

  function onFileChange() {
    var input = document.getElementById('ylbxImageFile');
    var file = input && input.files && input.files[0];
    if (file) acceptFile(file);
  }

  function fillSample() {
    setField('ylbxMonthStart', '202601');
    setField('ylbxMonthEnd', '202606');
    setField('ylbxAmount', '2232');
    setStatus('已填入示例月份与金额', false);
  }

  function prefill() {
    var username = val('ylbxPrefillUser');
    if (!username) {
      setStatus('请输入用户名', true);
      return;
    }
    setStatus('加载用户数据…', false);
    fetchAdmin('/api/admin/ylbx-ps/prefill?username=' + encodeURIComponent(username))
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r).then(function (j) {
          return { http: r.status, j: j };
        });
      })
      .then(function (pack) {
        var j = pack.j;
        if (!j || j.code !== 200 || !j.data) {
          setStatus((j && j.msg) || '用户数据加载失败（HTTP ' + pack.http + '）', true);
          return;
        }
        var d = j.data;
        var u = d.user || {};
        setField('ylbxName', u.real_name || '');
        setField('ylbxIdNumber', u.user_tax_id || u.id_card || u.tax_id || '');
        var employers = d.employers || [];
        var companies = d.companies || [];
        var company = '';
        if (employers.length) company = employers[0].company_name || '';
        if (!company && companies.length) company = companies[0];
        if (company) setField('ylbxCompany', company);
        setStatus('已预填「' + username + '」（请上传原图并核对月份/金额）', false);
      })
      .catch(function (e) {
        var msg = e && e.message ? e.message : '网络错误';
        if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
          msg = '网络请求被拦截或中断（可关闭广告拦截后重试，或检查是否仍登录管理后台）';
        }
        setStatus('预填失败：' + msg, true);
      });
  }

  function edit() {
    var input = document.getElementById('ylbxImageFile');
    var file = input && input.files && input.files[0];
    if (!file) {
      setStatus('请先上传原图', true);
      return;
    }
    var monthStart = val('ylbxMonthStart') || '202601';
    var monthEnd = val('ylbxMonthEnd') || '202606';
    var amount = val('ylbxAmount') || '2232';
    if (!/^\d{6}$/.test(monthStart.replace(/\D/g, '').slice(0, 6)) && !/^\d{4}-?\d{1,2}$/.test(monthStart)) {
      setStatus('缴费月份起格式应为 YYYYMM，如 202601', true);
      return;
    }
    if (!/^\d+$/.test(amount)) {
      setStatus('个人缴费须为数字', true);
      return;
    }
    var fd = new FormData();
    fd.append('file', file);
    fd.append('month_start', monthStart);
    fd.append('month_end', monthEnd);
    fd.append('amount', amount);
    fd.append('name', val('ylbxName'));
    fd.append('id_number', val('ylbxIdNumber'));
    fd.append('company_name', val('ylbxCompany'));
    setBusy(true);
    setStatus('处理中…', false);
    var token = '';
    try {
      token = localStorage.getItem('admin_token') || '';
    } catch (e0) {}
    var headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    fetch('/api/admin/ylbx-ps/edit', {
      method: 'POST',
      headers: headers,
      body: fd
    })
      .then(function (r) {
        if (r.status === 401) {
          return Promise.reject(new Error('unauthorized'));
        }
        return (window.adminParseJson||function(r){return r.json();})(r).then(function (j) {
          return { http: r.status, j: j };
        });
      })
      .then(function (pack) {
        var j = pack.j;
        if (!j || j.code !== 200 || !j.data || !j.data.image_base64) {
          setStatus((j && j.msg) || '处理失败（HTTP ' + pack.http + '）', true);
          return;
        }
        lastResult = j.data;
        var dataUrl = 'data:image/png;base64,' + j.data.image_base64;
        var outImg = document.getElementById('ylbxPreviewOut');
        showPreviewWrap(true);
        if (outImg) outImg.src = dataUrl;
        setDownloadVisible(true);
        setStatus('预览已生成，可核对后下载', false);
      })
      .catch(function (e) {
        setStatus('处理失败：' + (e && e.message ? e.message : '网络错误'), true);
      })
      .then(function () {
        setBusy(false);
      });
  }

  function download() {
    if (!lastResult || !lastResult.image_base64) {
      setStatus('请先生成预览', true);
      return;
    }
    downloadBase64(lastResult.image_base64, lastResult.filename, lastResult.mime);
    setStatus('已开始下载（演示）', false);
  }

  function bindDropzone() {
    var zone = document.getElementById('ylbxDropzone');
    var input = document.getElementById('ylbxImageFile');
    if (!zone || zone.__ylbxBound) return;
    zone.__ylbxBound = true;
    zone.addEventListener('click', function () {
      if (input) input.click();
    });
    zone.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        if (input) input.click();
      }
    });
    ;['dragenter', 'dragover'].forEach(function (type) {
      zone.addEventListener(type, function (ev) {
        ev.preventDefault();
        zone.classList.add('is-dragover');
      });
    });
    ;['dragleave', 'drop'].forEach(function (type) {
      zone.addEventListener(type, function (ev) {
        ev.preventDefault();
        zone.classList.remove('is-dragover');
      });
    });
    zone.addEventListener('drop', function (ev) {
      var file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (file) acceptFile(file);
    });
  }

  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    bindDropzone();
    var f = document.getElementById('ylbxImageFile');
    var e = document.getElementById('ylbxEditBtn');
    var p = document.getElementById('ylbxPrefillBtn');
    var s = document.getElementById('ylbxSampleBtn');
    var d = document.getElementById('ylbxDownloadBtn');
    if (f) f.addEventListener('change', onFileChange);
    if (e) e.addEventListener('click', edit);
    if (p) p.addEventListener('click', prefill);
    if (s) s.addEventListener('click', fillSample);
    if (d) d.addEventListener('click', download);
  }

  function loadPage() {
    bind();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['ylbx-ps'] = {
    ready: true,
    loadPage: loadPage,
    edit: edit
  };
})(window);
