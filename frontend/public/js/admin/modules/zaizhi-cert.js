/** Admin module: 在职/工作证明演示 PDF */
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
    var status = document.getElementById('zaizhiStatus');
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
    a.download = filename || '工作证明-demo.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  function fillSample() {
    setField('zaizhiName', '王嵩嵩');
    setField('zaizhiIdNumber', '610404199112165515');
    setField('zaizhiHireDate', '2025/12/15');
    setField('zaizhiGender', '男');
    setField('zaizhiIssueDate', '2026 年 7 月 13 日');
    setField('zaizhiCompany', '北京外企市场营销顾问有限公司西安分公司');
    setField('zaizhiDepartment', '市场部');
    setField('zaizhiPosition', '市场营销顾问');
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
    var username = val('zaizhiPrefillUser');
    if (!username) {
      setStatus('请输入用户名', true);
      return;
    }
    setStatus('加载用户数据…', false);
    /* 勿走 /user-data/：部分广告/隐私扩展会拦截该路径，浏览器报 Failed to fetch */
    fetchAdmin('/api/admin/zaizhi-cert/prefill?username=' + encodeURIComponent(username))
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
        setField('zaizhiName', u.real_name || '');
        setField('zaizhiIdNumber', u.user_tax_id || u.id_card || u.tax_id || '');
        var employers = d.employers || [];
        var companies = d.companies || [];
        var hire = '';
        var company = '';
        var position = '';
        if (employers.length) {
          company = employers[0].company_name || '';
          position = employers[0].position || '';
          hire = formatHire(employers[0].hire_date);
        }
        if (!company && companies.length) company = companies[0];
        if (company) setField('zaizhiCompany', company);
        if (position) setField('zaizhiPosition', position);
        if (hire) setField('zaizhiHireDate', hire);
        var idNo = val('zaizhiIdNumber');
        var gDigit = '';
        if (idNo.length >= 18) gDigit = idNo.charAt(16);
        else if (idNo.length === 15) gDigit = idNo.charAt(14);
        if (gDigit && /\d/.test(gDigit)) {
          setField('zaizhiGender', Number(gDigit) % 2 === 1 ? '男' : '女');
        }
        setStatus('已预填「' + username + '」（请核对性别、部门与开具日）', false);
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
      name: val('zaizhiName'),
      id_number: val('zaizhiIdNumber'),
      gender: val('zaizhiGender'),
      hire_date: val('zaizhiHireDate'),
      issue_date: val('zaizhiIssueDate'),
      company_name: val('zaizhiCompany'),
      department: val('zaizhiDepartment'),
      position: val('zaizhiPosition')
    };
    if (!body.name || !body.id_number) {
      setStatus('请填写姓名与身份证号', true);
      return;
    }
    if (!body.company_name) {
      setStatus('请填写公司全称', true);
      return;
    }
    if (!body.department) {
      setStatus('请填写部门', true);
      return;
    }
    if (!body.position) {
      setStatus('请填写担任岗位', true);
      return;
    }
    setStatus('生成中…', false);
    fetchAdmin('api/admin/zaizhi-cert/generate', {
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

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDt(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      var pad = function (n) {
        return n < 10 ? '0' + n : String(n);
      };
      return (
        d.getFullYear() +
        '-' +
        pad(d.getMonth() + 1) +
        '-' +
        pad(d.getDate()) +
        ' ' +
        pad(d.getHours()) +
        ':' +
        pad(d.getMinutes())
      );
    } catch (e0) {
      return String(iso);
    }
  }

  function renderStats(data) {
    var el = document.getElementById('zaizhiStatsMount');
    if (!el) return;
    if (!data || !data.summary) {
      el.innerHTML = '<div class="share-stats-empty">暂无统计数据</div>';
      return;
    }
    var s = data.summary;
    var html = '';
    if (data.period && data.period.label) {
      html +=
        '<p class="hint" style="margin:0 0 10px;">统计区间：' +
        esc(data.period.label) +
        '</p>';
    }
    if (data.note) {
      html +=
        '<p class="hint share-stats-note">' + esc(String(data.note)) + '</p>';
    }
    html += '<div class="share-kpi-grid">';
    html +=
      '<div class="share-kpi-card"><div class="ud-label">已解锁用户（累计）</div><div class="ud-val">' +
      esc(String(s.unlocked_users || 0)) +
      '</div><div class="share-kpi-sub">zaizhi_cert_unlocked=1</div></div>';
    html +=
      '<div class="share-kpi-card is-convert"><div class="ud-label">付费订单</div><div class="ud-val">' +
      esc(String(s.paid_orders || 0)) +
      '</div><div class="share-kpi-sub">付费用户 ' +
      esc(String(s.paid_users || 0)) +
      ' · 待支付 ' +
      esc(String(s.pending_orders || 0)) +
      '</div></div>';
    html +=
      '<div class="share-kpi-card is-convert"><div class="ud-label">GMV</div><div class="ud-val">¥' +
      esc(String(s.gmv || '0.00')) +
      '</div><div class="share-kpi-sub">sku_zaizhi_cert_50</div></div>';
    html +=
      '<div class="share-kpi-card"><div class="ud-label">生成次数</div><div class="ud-val">' +
      esc(String(s.generates || 0)) +
      '</div><div class="share-kpi-sub">用户数 ' +
      esc(String(s.generate_users || 0)) +
      ' · 演示 ' +
      esc(String(s.generates_demo || 0)) +
      ' · 去水印 ' +
      esc(String(s.generates_unlocked || 0)) +
      '</div></div>';
    html += '</div>';

    var users = data.usage_users || [];
    html +=
      '<div class="share-kpi-section-label">使用用户（' +
      esc(String(users.length)) +
      '，最多 200）</div>';
    if (!users.length) {
      html += '<div class="share-stats-empty">该区间暂无使用用户（无生成或付费）</div>';
    } else {
      html +=
        '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>最近使用</th><th>用户</th><th>姓名</th><th>已解锁</th><th>生成</th><th>演示</th><th>去水印</th><th>付费单</th><th>付费金额</th></tr></thead><tbody>';
      users.forEach(function (row) {
        html += '<tr>';
        html += '<td>' + esc(formatDt(row.last_used_at || row.last_generated_at || row.last_paid_at)) + '</td>';
        html += '<td class="cell-break"><code>' + esc(row.username || '—') + '</code></td>';
        html += '<td>' + esc(row.real_name || '—') + '</td>';
        html += '<td>' + (row.unlocked ? '是' : '否') + '</td>';
        html += '<td>' + esc(String(row.generates || 0)) + '</td>';
        html += '<td>' + esc(String(row.generates_demo || 0)) + '</td>';
        html += '<td>' + esc(String(row.generates_unlocked || 0)) + '</td>';
        html += '<td>' + esc(String(row.paid_orders || 0)) + '</td>';
        html += '<td>¥' + esc(String(row.paid_amount || '0.00')) + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    }

    var daily = data.daily || [];
    html += '<div class="share-kpi-section-label">按日明细</div>';
    if (!daily.length) {
      html += '<div class="share-stats-empty">该区间暂无按日数据</div>';
    } else {
      html +=
        '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>日期</th><th>付费单</th><th>付费用户</th><th>GMV</th><th>生成</th><th>生成用户</th><th>演示</th><th>去水印</th></tr></thead><tbody>';
      daily.forEach(function (row) {
        html += '<tr>';
        html += '<td>' + esc(row.day || '—') + '</td>';
        html += '<td>' + esc(String(row.paid_orders || 0)) + '</td>';
        html += '<td>' + esc(String(row.paid_users || 0)) + '</td>';
        html += '<td>¥' + esc(String(row.gmv || '0.00')) + '</td>';
        html += '<td>' + esc(String(row.generates || 0)) + '</td>';
        html += '<td>' + esc(String(row.generate_users || 0)) + '</td>';
        html += '<td>' + esc(String(row.generates_demo || 0)) + '</td>';
        html += '<td>' + esc(String(row.generates_unlocked || 0)) + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    }

    var paid = data.recent_paid || [];
    html += '<div class="share-kpi-section-label">最近付费（最多 50）</div>';
    if (!paid.length) {
      html += '<div class="share-stats-empty">该区间暂无付费记录</div>';
    } else {
      html +=
        '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>时间</th><th>用户</th><th>姓名</th><th>金额</th><th>订单号</th></tr></thead><tbody>';
      paid.forEach(function (row) {
        html += '<tr>';
        html += '<td>' + esc(formatDt(row.paid_at)) + '</td>';
        html += '<td class="cell-break"><code>' + esc(row.username || '—') + '</code></td>';
        html += '<td>' + esc(row.real_name || '—') + '</td>';
        html += '<td>¥' + esc(String(row.amount || '0.00')) + '</td>';
        html += '<td class="cell-break"><code>' + esc(row.out_trade_no || '—') + '</code></td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    }

    var gens = data.recent_generations || [];
    html += '<div class="share-kpi-section-label">最近生成（最多 50）</div>';
    if (!gens.length) {
      html +=
        '<div class="share-stats-empty">该区间暂无生成记录（统计上线前无历史）</div>';
    } else {
      html +=
        '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>时间</th><th>用户</th><th>姓名</th><th>类型</th><th>公司</th></tr></thead><tbody>';
      gens.forEach(function (row) {
        html += '<tr>';
        html += '<td>' + esc(formatDt(row.created_at)) + '</td>';
        html += '<td class="cell-break"><code>' + esc(row.username || '—') + '</code></td>';
        html += '<td>' + esc(row.real_name || '—') + '</td>';
        html += '<td>' + (row.demo ? '演示水印' : '去水印') + '</td>';
        html += '<td class="cell-break">' + esc(row.company_name || '—') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    }

    el.innerHTML = html;
  }

  function loadStats() {
    var el = document.getElementById('zaizhiStatsMount');
    if (!el) return;
    var daysEl = document.getElementById('zaizhiStatsDays');
    var days = daysEl ? String(daysEl.value || '7') : '7';
    el.textContent = '加载中…';
    fetchAdmin('/api/admin/zaizhi-cert/stats?days=' + encodeURIComponent(days))
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          el.textContent = (j && j.msg) || '加载失败';
          return;
        }
        renderStats(j.data);
      })
      .catch(function () {
        el.textContent = '网络错误';
      });
  }

  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    var g = document.getElementById('zaizhiGenerateBtn');
    var s = document.getElementById('zaizhiSampleBtn');
    var p = document.getElementById('zaizhiPrefillBtn');
    var refresh = document.getElementById('btnRefreshZaizhiStats');
    var daysEl = document.getElementById('zaizhiStatsDays');
    if (g) g.addEventListener('click', generate);
    if (s) s.addEventListener('click', fillSample);
    if (p) p.addEventListener('click', prefill);
    if (refresh) refresh.addEventListener('click', loadStats);
    if (daysEl) daysEl.addEventListener('change', loadStats);
  }

  function loadPage() {
    bind();
    loadStats();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['zaizhi-cert'] = {
    ready: true,
    loadPage: loadPage,
    generate: generate,
    fillSample: fillSample,
    loadStats: loadStats
  };
})(window);
