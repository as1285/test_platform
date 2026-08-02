/** Admin module: 离职证明演示 PDF */
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
    var status = document.getElementById('lizhiStatus');
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
    var blob = new Blob([bytes], { type: mime || 'application/pdf' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || '离职证明-demo.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  function fillSample() {
    setField('lizhiName', '王嵩嵩');
    setField('lizhiIdNumber', '610404199112165515');
    setField('lizhiHireDate', '2025/12/15');
    setField('lizhiLeaveDate', '2026/7/10');
    setField('lizhiIssueDate', '2026 年 7 月 13 日');
    setField('lizhiCompany', '北京外企市场营销顾问有限公司西安分公司');
    setStatus('已填入示例', false);
  }

  function formatHire(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '/' + String(Number(m[2])) + '/' + String(Number(m[3]));
    return s.replace(/-/g, '/');
  }

  function prefill() {
    var username = val('lizhiPrefillUser');
    if (!username) {
      setStatus('请输入用户名', true);
      return;
    }
    setStatus('加载用户数据…', false);
    /* 勿走 /user-data/：部分广告/隐私扩展会拦截该路径，浏览器报 Failed to fetch */
    fetchAdmin('/api/admin/lizhi-cert/prefill?username=' + encodeURIComponent(username))
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
        setField('lizhiName', u.real_name || '');
        setField('lizhiIdNumber', u.user_tax_id || u.id_card || u.tax_id || '');
        var employers = d.employers || [];
        var companies = d.companies || [];
        var hire = '';
        var company = '';
        if (employers.length) {
          company = employers[0].company_name || '';
          hire = formatHire(employers[0].hire_date);
        }
        if (!company && companies.length) company = companies[0];
        if (company) setField('lizhiCompany', company);
        if (hire) setField('lizhiHireDate', hire);
        setStatus('已预填「' + username + '」（请核对离职日与开具日）', false);
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

  function generate() {
    var body = {
      name: val('lizhiName'),
      id_number: val('lizhiIdNumber'),
      hire_date: val('lizhiHireDate'),
      leave_date: val('lizhiLeaveDate'),
      issue_date: val('lizhiIssueDate'),
      company_name: val('lizhiCompany')
    };
    if (!body.name || !body.id_number) {
      setStatus('请填写姓名与身份证号', true);
      return;
    }
    setStatus('生成中…', false);
    fetchAdmin('api/admin/lizhi-cert/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { http: r.status, j: j };
        });
      })
      .then(function (pack) {
        var j = pack.j;
        if (!j || j.code !== 200 || !j.data || !j.data.pdf_base64) {
          setStatus((j && j.msg) || '生成失败（HTTP ' + pack.http + '）', true);
          return;
        }
        downloadBase64(j.data.pdf_base64, j.data.filename, j.data.mime);
        setStatus('已生成并开始下载（演示样例）', false);
      })
      .catch(function (e) {
        setStatus('生成失败：' + (e && e.message ? e.message : '网络错误'), true);
      });
  }

  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    var g = document.getElementById('lizhiGenerateBtn');
    var s = document.getElementById('lizhiSampleBtn');
    var p = document.getElementById('lizhiPrefillBtn');
    if (g) g.addEventListener('click', generate);
    if (s) s.addEventListener('click', fillSample);
    if (p) p.addEventListener('click', prefill);
  }

  function loadPage() {
    bind();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['lizhi-cert'] = {
    ready: true,
    loadPage: loadPage,
    generate: generate,
    fillSample: fillSample
  };
})(window);
