/** Admin module: 备数导入 */
(function (global) {
  var selectedFile = null;
  var bound = false;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function adminFetch(url, opts) {
    if (typeof global.adminFetch === 'function') return global.adminFetch(url, opts);
    return Promise.reject(new Error('adminFetch unavailable'));
  }

  function setSummary(html) {
    var el = document.getElementById('userPrepSummary');
    if (el) el.innerHTML = html;
  }

  function showErrors(errors, count) {
    var box = document.getElementById('userPrepErrors');
    if (!box) return;
    if (!count) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    box.hidden = false;
    var lines = (errors || []).slice(0, 20).map(function (e) {
      return '第' + (e.line || '?') + '行 ' + (e.username || '') + '：' + (e.msg || '');
    });
    box.textContent = '错误 ' + count + ' 条。' + lines.join('；');
  }

  function renderPreview(rows) {
    var tb = document.getElementById('userPrepPreviewTbody');
    if (!tb) return;
    if (!rows || !rows.length) {
      tb.innerHTML = '<tr><td colspan="11">暂无预览</td></tr>';
      return;
    }
    tb.innerHTML = rows
      .map(function (r) {
        return (
          '<tr>' +
          '<td>' +
          esc(r.line) +
          '</td><td>' +
          esc(r.username) +
          '</td><td>' +
          esc(r.real_name) +
          '</td><td>' +
          esc(r.tax_id) +
          '</td><td>' +
          esc(r.gender) +
          '</td><td>' +
          esc(r.grant_days) +
          '</td><td>' +
          esc(r.year) +
          '</td><td>' +
          esc(r.month) +
          '</td><td>' +
          esc(r.company_name) +
          '</td><td>' +
          esc(r.income) +
          '</td><td>' +
          esc(r.special_deduction) +
          '</td></tr>'
        );
      })
      .join('');
  }

  function renderAccounts(accounts) {
    var wrap = document.getElementById('userPrepAccountsWrap');
    var tb = document.getElementById('userPrepAccountsTbody');
    if (!wrap || !tb) return;
    if (!accounts || !accounts.length) {
      wrap.hidden = true;
      tb.innerHTML = '';
      return;
    }
    wrap.hidden = false;
    tb.innerHTML = accounts
      .map(function (a) {
        return (
          '<tr><td>' +
          esc(a.username) +
          '</td><td>' +
          esc(a.password) +
          '</td><td>' +
          esc(a.real_name) +
          '</td><td>' +
          (a.created ? '新建' : '覆盖') +
          '</td></tr>'
        );
      })
      .join('');
    wrap._accounts = accounts;
  }

  function upload(url) {
    if (!selectedFile) {
      setSummary('<span style="color:#b45309">请先选择 Excel/CSV 文件</span>');
      return Promise.resolve();
    }
    setSummary('处理中…');
    /* 必须用 adminUpload：勿走 adminFetch（会强制 Content-Type: application/json） */
    var up =
      typeof global.adminUpload === 'function'
        ? global.adminUpload(url, selectedFile, 'file')
        : Promise.reject(new Error('adminUpload unavailable'));
    return up.then(function (j) {
      var ok = j && j.code === 200;
      return { status: ok ? 200 : 400, body: j };
    });
  }

  function bind() {
    if (bound) return;
    bound = true;
    var fileInput = document.getElementById('userPrepFileInput');
    var nameEl = document.getElementById('userPrepFileName');
    var btnPreview = document.getElementById('btnUserPrepPreview');
    var btnImport = document.getElementById('btnUserPrepImport');
    var btnCopy = document.getElementById('btnUserPrepCopyAccounts');
    var btnTpl = document.getElementById('btnUserPrepTemplate');

    if (btnTpl) {
      btnTpl.addEventListener('click', function (e) {
        e.preventDefault();
        var token = localStorage.getItem('admin_token') || '';
        fetch('/api/admin/user-prep/template', {
          headers: token ? { Authorization: 'Bearer ' + token } : {}
        })
          .then(function (r) {
            if (!r.ok) throw new Error('download failed');
            return r.blob();
          })
          .then(function (blob) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'user_prep_import_template.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
          })
          .catch(function () {
            setSummary('<span style="color:#b45309">模板下载失败，请重新登录后再试</span>');
          });
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        selectedFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        if (nameEl) nameEl.textContent = selectedFile ? selectedFile.name : '未选择文件';
      });
    }

    if (btnPreview) {
      btnPreview.addEventListener('click', function () {
        upload('/api/admin/user-prep/preview').then(function (x) {
          if (!x) return;
          var d = (x.body && x.body.data) || {};
          if (x.status !== 200 || (x.body && x.body.code !== 200)) {
            setSummary(
              '<span style="color:#b45309">' + esc((x.body && x.body.msg) || '预览失败') + '</span>'
            );
            return;
          }
          setSummary(
            '预览：共 ' +
              (d.row_count || 0) +
              ' 行 / ' +
              (d.user_count || 0) +
              ' 个用户；错误 ' +
              (d.error_count || 0) +
              ' 条。冲突=覆盖。' +
              (d.format === 'payroll' ? '已识别为薪资流水，无账号则生成 demo。' : '') +
              (d.preview_truncated ? '（表仅显示前 50 行）' : '')
          );
          renderPreview(d.preview || []);
          showErrors(d.errors || [], d.error_count || 0);
          renderAccounts([]);
        });
      });
    }

    if (btnImport) {
      btnImport.addEventListener('click', function () {
        if (!selectedFile) {
          setSummary('<span style="color:#b45309">请先选择文件</span>');
          return;
        }
        if (!window.confirm('确认导入？已存在用户/年月个税将被覆盖，并直接开通账号。')) return;
        upload('/api/admin/user-prep/import').then(function (x) {
          if (!x) return;
          var d = (x.body && x.body.data) || {};
          if (x.status !== 200 || (x.body && x.body.code !== 200)) {
            setSummary(
              '<span style="color:#b45309">' + esc((x.body && x.body.msg) || '导入失败') + '</span>'
            );
            showErrors((d && d.errors) || [], (d && d.error_count) || 0);
            return;
          }
          setSummary(
            '导入完成：新建用户 ' +
              (d.created_users || 0) +
              '，覆盖用户 ' +
              (d.overwritten_users || 0) +
              '；个税新增 ' +
              (d.tax_inserted || 0) +
              ' / 覆盖 ' +
              (d.tax_overwritten || 0) +
              '；失败行 ' +
              (d.error_count || 0)
          );
          showErrors(d.errors || [], d.error_count || 0);
          renderAccounts(d.accounts || []);
        });
      });
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', function () {
        var wrap = document.getElementById('userPrepAccountsWrap');
        var accounts = wrap && wrap._accounts ? wrap._accounts : [];
        if (!accounts.length) return;
        var text = accounts
          .map(function (a) {
            return a.username + '\t' + a.password + '\t' + (a.real_name || '');
          })
          .join('\n');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(
            function () {
              setSummary((document.getElementById('userPrepSummary').innerHTML || '') + '（已复制）');
            },
            function () {}
          );
        }
      });
    }
  }

  function loadPage() {
    bind();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['user-prep-import'] = { loadPage: loadPage };
})(typeof window !== 'undefined' ? window : global);
