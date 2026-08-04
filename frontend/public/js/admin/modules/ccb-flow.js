/** Admin module: 建行工资流水原图编辑 */
(function (global) {
  var lastResult = null;
  var srcObjectUrl = '';
  var usingTemplate = true;

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
    var status = document.getElementById('ccbFlowStatus');
    if (status) {
      status.textContent = msg || '';
      status.style.color = isErr ? '#b91c1c' : '';
    }
  }

  function setBusy(busy) {
    var btn = document.getElementById('ccbFlowEditBtn');
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
    a.download = filename || 'ccb-salary-flow.png';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  function showPreviewWrap(on) {
    var wrap = document.getElementById('ccbFlowPreviewWrap');
    if (!wrap) return;
    if (on) wrap.removeAttribute('hidden');
    else wrap.setAttribute('hidden', '');
  }

  function setDownloadVisible(on) {
    var btn = document.getElementById('ccbFlowDownloadBtn');
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
    var input = document.getElementById('ccbFlowImageFile');
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
    usingTemplate = false;
    var srcImg = document.getElementById('ccbFlowPreviewSrc');
    var outImg = document.getElementById('ccbFlowPreviewOut');
    var nameEl = document.getElementById('ccbFlowFileName');
    if (srcImg) srcImg.src = srcObjectUrl;
    if (outImg) outImg.removeAttribute('src');
    if (nameEl) nameEl.textContent = file.name + ' · ' + Math.round(file.size / 1024) + ' KB';
    lastResult = null;
    setDownloadVisible(false);
    showPreviewWrap(true);
    setStatus('已使用上传原图，可填写字段后生成预览', false);
  }

  function onFileChange() {
    var input = document.getElementById('ccbFlowImageFile');
    var file = input && input.files && input.files[0];
    if (file) acceptFile(file);
  }

  function fillSample() {
    setField('ccbFlowName', '张三丰');
    setField('ccbFlowCompany', '杭州测试科技有限公司');
    setField('ccbFlowAccountName', '杭州测试科技有限公司');
    setField('ccbFlowCounterparty', '140500616296');
    setField('ccbFlowAmount', '16888.00');
    setField('ccbFlowOpening', '8000');
    setStatus('已填入示例字段', false);
  }

  function loadTemplatePreview() {
    setStatus('加载内置模板…', false);
    fetchAdmin('/api/admin/ccb-flow/template')
      .then(function (r) {
        return r.json().then(function (j) {
          return { http: r.status, j: j };
        });
      })
      .then(function (pack) {
        var j = pack.j;
        if (!j || j.code !== 200 || !j.data || !j.data.image_base64) {
          setStatus((j && j.msg) || '模板加载失败', true);
          return;
        }
        usingTemplate = true;
        var input = document.getElementById('ccbFlowImageFile');
        if (input) input.value = '';
        var dataUrl = 'data:image/png;base64,' + j.data.image_base64;
        var srcImg = document.getElementById('ccbFlowPreviewSrc');
        var outImg = document.getElementById('ccbFlowPreviewOut');
        var nameEl = document.getElementById('ccbFlowFileName');
        if (srcImg) srcImg.src = dataUrl;
        if (outImg) outImg.removeAttribute('src');
        if (nameEl) nameEl.textContent = '内置模板 · 建行工资流水原图';
        var d = j.data.defaults || {};
        if (d.name && !val('ccbFlowName')) setField('ccbFlowName', d.name);
        if (d.company_name && !val('ccbFlowCompany')) setField('ccbFlowCompany', d.company_name);
        if (d.account_name && !val('ccbFlowAccountName')) setField('ccbFlowAccountName', d.account_name);
        if (d.counterparty_account && !val('ccbFlowCounterparty')) {
          setField('ccbFlowCounterparty', d.counterparty_account);
        }
        if (d.amount && !val('ccbFlowAmount')) setField('ccbFlowAmount', d.amount);
        if (d.opening_balance && !val('ccbFlowOpening')) setField('ccbFlowOpening', d.opening_balance);
        lastResult = null;
        setDownloadVisible(false);
        showPreviewWrap(true);
        setStatus('已加载内置模板，修改字段后点生成预览', false);
      })
      .catch(function (e) {
        setStatus('模板加载失败：' + (e && e.message ? e.message : '网络错误'), true);
      });
  }

  function prefill() {
    var username = val('ccbFlowPrefillUser');
    if (!username) {
      setStatus('请输入用户名', true);
      return;
    }
    setStatus('加载用户数据…', false);
    fetchAdmin('/api/admin/ccb-flow/prefill?username=' + encodeURIComponent(username))
      .then(function (r) {
        return r.json().then(function (j) {
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
        setField('ccbFlowName', u.real_name || '');
        var employers = d.employers || [];
        var companies = d.companies || [];
        var company = '';
        if (employers.length) company = employers[0].company_name || '';
        if (!company && companies.length) company = companies[0];
        if (company) {
          setField('ccbFlowCompany', company);
          setField('ccbFlowAccountName', company);
        }
        setStatus('已预填「' + username + '」', false);
      })
      .catch(function (e) {
        var msg = e && e.message ? e.message : '网络错误';
        setStatus('预填失败：' + msg, true);
      });
  }

  function edit() {
    var name = val('ccbFlowName');
    var company = val('ccbFlowCompany');
    var accountName = val('ccbFlowAccountName') || company;
    var amount = val('ccbFlowAmount');
    if (!name) {
      setStatus('请填写姓名', true);
      return;
    }
    if (!company && !accountName) {
      setStatus('请填写公司名或户名', true);
      return;
    }
    if (!amount) {
      setStatus('请填写交易金额', true);
      return;
    }
    var fd = new FormData();
    var input = document.getElementById('ccbFlowImageFile');
    var file = input && input.files && input.files[0];
    if (file) {
      fd.append('file', file);
      fd.append('use_template', '0');
    } else {
      fd.append('use_template', '1');
    }
    fd.append('name', name);
    fd.append('company_name', company);
    fd.append('account_name', accountName);
    fd.append('counterparty_account', val('ccbFlowCounterparty') || '140500616296');
    fd.append('amount', amount);
    fd.append('opening_balance', val('ccbFlowOpening') || '7415.60');
    setBusy(true);
    setStatus('处理中…', false);
    var token = '';
    try {
      token = localStorage.getItem('admin_token') || '';
    } catch (e0) {}
    var headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    fetch('/api/admin/ccb-flow/edit', {
      method: 'POST',
      headers: headers,
      body: fd
    })
      .then(function (r) {
        if (r.status === 401) {
          return Promise.reject(new Error('unauthorized'));
        }
        return r.json().then(function (j) {
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
        var outImg = document.getElementById('ccbFlowPreviewOut');
        showPreviewWrap(true);
        if (outImg) outImg.src = dataUrl;
        setDownloadVisible(true);
        var meta = j.data.meta || {};
        var tip = '预览已生成';
        if (meta.total_income != null) tip += ' · 总收入 ' + meta.total_income;
        setStatus(tip, false);
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
    var zone = document.getElementById('ccbFlowDropzone');
    var input = document.getElementById('ccbFlowImageFile');
    if (!zone || zone.__ccbBound) return;
    zone.__ccbBound = true;
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
    var f = document.getElementById('ccbFlowImageFile');
    var e = document.getElementById('ccbFlowEditBtn');
    var p = document.getElementById('ccbFlowPrefillBtn');
    var s = document.getElementById('ccbFlowSampleBtn');
    var d = document.getElementById('ccbFlowDownloadBtn');
    var t = document.getElementById('ccbFlowTemplateBtn');
    if (f) f.addEventListener('change', onFileChange);
    if (e) e.addEventListener('click', edit);
    if (p) p.addEventListener('click', prefill);
    if (s) s.addEventListener('click', fillSample);
    if (d) d.addEventListener('click', download);
    if (t) t.addEventListener('click', loadTemplatePreview);
  }

  function loadPage() {
    bind();
    var srcImg = document.getElementById('ccbFlowPreviewSrc');
    if (srcImg && !srcImg.getAttribute('src')) {
      loadTemplatePreview();
    }
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['ccb-flow'] = {
    ready: true,
    loadPage: loadPage,
    edit: edit
  };
})(window);
