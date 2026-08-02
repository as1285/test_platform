/** Admin module: 社保缴费证明原图像素 PS */
(function (global) {
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

  function onFileChange() {
    var input = document.getElementById('ylbxImageFile');
    var file = input && input.files && input.files[0];
    if (!file) return;
    var wrap = document.getElementById('ylbxPreviewWrap');
    var srcImg = document.getElementById('ylbxPreviewSrc');
    var outImg = document.getElementById('ylbxPreviewOut');
    if (wrap) wrap.style.display = 'flex';
    if (srcImg) srcImg.src = URL.createObjectURL(file);
    if (outImg) outImg.removeAttribute('src');
    setStatus('原图已就绪，可填写字段后处理', false);
  }

  function prefill() {
    var username = val('ylbxPrefillUser');
    if (!username) {
      setStatus('请输入用户名', true);
      return;
    }
    setStatus('加载用户数据…', false);
    /* 勿走 /user-data/：部分广告/隐私扩展会拦截该路径，浏览器报 Failed to fetch */
    fetchAdmin('/api/admin/ylbx-ps/prefill?username=' + encodeURIComponent(username))
      .then(function (r) {
        return r.json().then(function (j) {
          return { http: r.status, j: j };
        });
      })
      .then(function (pack) {
        var j = pack.j;
        if (!j || j.code !== 200 || !j.data) {
          setStatus(
            (j && j.msg) || '用户数据加载失败（HTTP ' + pack.http + '）',
            true
          );
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
          msg =
            '网络请求被拦截或中断（可关闭广告拦截后重试，或检查是否仍登录管理后台）';
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
    var fd = new FormData();
    fd.append('file', file);
    fd.append('month_start', val('ylbxMonthStart') || '202601');
    fd.append('month_end', val('ylbxMonthEnd') || '202606');
    fd.append('amount', val('ylbxAmount') || '2232');
    fd.append('name', val('ylbxName'));
    fd.append('id_number', val('ylbxIdNumber'));
    fd.append('company_name', val('ylbxCompany'));
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
        var dataUrl = 'data:image/png;base64,' + j.data.image_base64;
        var wrap = document.getElementById('ylbxPreviewWrap');
        var outImg = document.getElementById('ylbxPreviewOut');
        if (wrap) wrap.style.display = 'flex';
        if (outImg) outImg.src = dataUrl;
        downloadBase64(j.data.image_base64, j.data.filename, j.data.mime);
        setStatus('已处理并开始下载（演示）', false);
      })
      .catch(function (e) {
        setStatus('处理失败：' + (e && e.message ? e.message : '网络错误'), true);
      });
  }

  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    var f = document.getElementById('ylbxImageFile');
    var e = document.getElementById('ylbxEditBtn');
    var p = document.getElementById('ylbxPrefillBtn');
    if (f) f.addEventListener('change', onFileChange);
    if (e) e.addEventListener('click', edit);
    if (p) p.addEventListener('click', prefill);
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
