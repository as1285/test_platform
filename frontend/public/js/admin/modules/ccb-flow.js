/** Admin module: 建行工资流水（按数据完整生成） */
(function (global) {
  var lastResult = null;
  var lastMonths = [];

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
      btn.textContent = busy ? '生成中…' : '生成流水图';
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

  function fillSample() {
    setField('ccbFlowName', '张三丰');
    setField('ccbFlowCompany', '杭州测试科技有限公司');
    setField('ccbFlowAccountName', '杭州测试科技有限公司');
    setField('ccbFlowCardNo', '6217002740035379323');
    setField('ccbFlowCounterparty', '140500616296');
    setField('ccbFlowAmount', '16888.00');
    setField('ccbFlowOpening', '8000');
    setField('ccbFlowMonths', '');
    lastMonths = [];
    setStatus('已填入示例字段，点「生成流水图」按数据绘制', false);
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function formatYm(y, m) {
    return String(y) + '-' + pad2(m);
  }

  function ymToIndex(ym) {
    var s = String(ym || '').trim();
    var m = s.match(/^(\d{4})-(\d{1,2})$/);
    if (!m) return NaN;
    var y = parseInt(m[1], 10);
    var mo = parseInt(m[2], 10);
    if (!isFinite(y) || !isFinite(mo) || mo < 1 || mo > 12) return NaN;
    return y * 12 + mo;
  }

  function defaultTaxRange() {
    var now = new Date();
    var endY = now.getFullYear();
    var endM = now.getMonth() + 1;
    var start = new Date(endY, endM - 1 - 11, 1);
    return {
      from: formatYm(start.getFullYear(), start.getMonth() + 1),
      to: formatYm(endY, endM)
    };
  }

  function ensureTaxRangeDefaults() {
    var fromEl = document.getElementById('ccbFlowTaxFrom');
    var toEl = document.getElementById('ccbFlowTaxTo');
    if (!fromEl && !toEl) return;
    var d = defaultTaxRange();
    if (fromEl && !String(fromEl.value || '').trim()) fromEl.value = d.from;
    if (toEl && !String(toEl.value || '').trim()) toEl.value = d.to;
  }

  function parseMoneyNum(raw) {
    var s = String(raw == null ? '' : raw)
      .replace(/,/g, '')
      .replace(/，/g, '')
      .trim();
    if (!s) return NaN;
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }

  function fmtMoney2(n) {
    return (Math.round(Number(n) * 100) / 100).toFixed(2);
  }

  function isBonusSubtype(sub) {
    var s = String(sub || '');
    return /全年一次性奖金|年终奖|一次性奖金/.test(s);
  }

  function isSalaryLike(rec) {
    var t = String(rec.income_type || '');
    var sub = String(rec.income_subtype || '');
    if (isBonusSubtype(sub)) return false;
    if (/工资|薪金|劳务/.test(t) || /工资|薪金|劳务/.test(sub)) return true;
    if (!t && !sub) return true;
    return /正常工资/.test(sub);
  }

  function buildAmountsFromTaxRecords(records, fromYm, toYm) {
    var fromIdx = ymToIndex(fromYm);
    var toIdx = ymToIndex(toYm);
    if (!isFinite(fromIdx) || !isFinite(toIdx)) {
      throw new Error('请选择有效的个税起止月份');
    }
    if (fromIdx > toIdx) {
      var tmp = fromIdx;
      fromIdx = toIdx;
      toIdx = tmp;
    }
    var byMonth = {};
    var companyCount = {};
    (records || []).forEach(function (r) {
      if (!r) return;
      var y = parseInt(r.year, 10);
      var m = parseInt(r.month, 10);
      if (!isFinite(y) || !isFinite(m) || m < 1 || m > 12) return;
      var idx = y * 12 + m;
      if (idx < fromIdx || idx > toIdx) return;
      if (!isSalaryLike(r)) return;
      var income = parseMoneyNum(r.income_this_period);
      if (!(income > 0)) income = parseMoneyNum(r.income);
      if (!(income > 0)) return;
      var key = formatYm(y, m);
      if (!byMonth[key]) byMonth[key] = 0;
      byMonth[key] = Math.round((byMonth[key] + income) * 100) / 100;
      var co = String(r.company_name || '').trim();
      if (co) companyCount[co] = (companyCount[co] || 0) + 1;
    });
    var months = Object.keys(byMonth).sort(function (a, b) {
      return ymToIndex(a) - ymToIndex(b);
    });
    if (!months.length) {
      return { amounts: [], months: [], company: '', from: fromYm, to: toYm };
    }
    if (months.length > 12) {
      months = months.slice(months.length - 12);
    }
    var amounts = months.map(function (k) {
      return fmtMoney2(byMonth[k]);
    });
    var company = '';
    var best = 0;
    Object.keys(companyCount).forEach(function (co) {
      if (companyCount[co] > best) {
        best = companyCount[co];
        company = co;
      }
    });
    return { amounts: amounts, months: months, company: company, from: fromYm, to: toYm };
  }

  function prefill() {
    var username = val('ccbFlowPrefillUser');
    if (!username) {
      setStatus('请输入用户名', true);
      return;
    }
    ensureTaxRangeDefaults();
    var fromYm = val('ccbFlowTaxFrom');
    var toYm = val('ccbFlowTaxTo');
    if (!fromYm || !toYm) {
      setStatus('请选择个税起止月份', true);
      return;
    }
    if (ymToIndex(fromYm) > ymToIndex(toYm)) {
      var swap = fromYm;
      fromYm = toYm;
      toYm = swap;
      setField('ccbFlowTaxFrom', fromYm);
      setField('ccbFlowTaxTo', toYm);
    }
    setStatus('加载用户个税数据…', false);
    fetchAdmin(
      '/api/admin/ccb-flow/prefill?username=' +
        encodeURIComponent(username) +
        '&tax_limit=500'
    )
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
        var taxPack;
        try {
          taxPack = buildAmountsFromTaxRecords(d.tax_records || [], fromYm, toYm);
        } catch (eTax) {
          setStatus((eTax && eTax.message) || '个税时段无效', true);
          return;
        }
        var employers = d.employers || [];
        var companies = d.companies || [];
        var company = taxPack.company || '';
        if (!company && employers.length) company = employers[0].company_name || '';
        if (!company && companies.length) company = companies[0];
        if (company) {
          setField('ccbFlowCompany', company);
          setField('ccbFlowAccountName', company);
        }
        if (taxPack.amounts && taxPack.amounts.length) {
          setField('ccbFlowAmount', taxPack.amounts.join(','));
          lastMonths = taxPack.months.slice();
          setField('ccbFlowMonths', lastMonths.join(','));
          var tip =
            '已预填「' +
            username +
            '」· ' +
            taxPack.months[0] +
            '～' +
            taxPack.months[taxPack.months.length - 1] +
            ' 共 ' +
            taxPack.amounts.length +
            ' 个月，可点「生成流水图」';
          if (taxPack.amounts.length < 12) {
            tip += '（不足 12 行将自动补齐）';
          }
          setStatus(tip, false);
        } else {
          lastMonths = [];
          setField('ccbFlowMonths', '');
          setStatus(
            '已预填姓名/公司；时段 ' +
              fromYm +
              '～' +
              toYm +
              ' 内无正常工资薪金记录，请改时段或手填金额',
            true
          );
        }
      })
      .catch(function (e) {
        var msg = e && e.message ? e.message : '网络错误';
        setStatus('预填失败：' + msg, true);
      });
  }

  function resolveMonthsPayload() {
    var raw = val('ccbFlowMonths');
    if (raw) {
      return raw
        .split(/[\n,;，；]+/)
        .map(function (s) {
          return String(s || '').trim();
        })
        .filter(Boolean);
    }
    if (lastMonths && lastMonths.length) return lastMonths.slice();
    var toYm = val('ccbFlowTaxTo');
    return toYm ? null : null;
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
    fd.append('use_template', '0');
    fd.append('name', name);
    fd.append('company_name', company);
    fd.append('account_name', accountName);
    fd.append('card_no', val('ccbFlowCardNo') || '6217002740035379323');
    fd.append('counterparty_account', val('ccbFlowCounterparty') || '140500616296');
    fd.append('amount', amount);
    fd.append('opening_balance', val('ccbFlowOpening') || '7415.60');
    var months = resolveMonthsPayload();
    if (months && months.length) {
      fd.append('months', JSON.stringify(months));
    }
    var taxTo = val('ccbFlowTaxTo');
    if (taxTo) fd.append('tax_to', taxTo);
    setBusy(true);
    setStatus('正在按数据绘制流水图…', false);
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
          setStatus((j && j.msg) || '生成失败（HTTP ' + pack.http + '）', true);
          return;
        }
        lastResult = j.data;
        var dataUrl = 'data:image/png;base64,' + j.data.image_base64;
        var outImg = document.getElementById('ccbFlowPreviewOut');
        showPreviewWrap(true);
        if (outImg) outImg.src = dataUrl;
        setDownloadVisible(true);
        var meta = j.data.meta || {};
        var tip = '流水图已按数据生成';
        if (meta.total_income != null) tip += ' · 总收入 ' + meta.total_income;
        if (meta.period) tip += ' · ' + meta.period;
        setStatus(tip, false);
      })
      .catch(function (e) {
        setStatus('生成失败：' + (e && e.message ? e.message : '网络错误'), true);
      })
      .then(function () {
        setBusy(false);
      });
  }

  function download() {
    if (!lastResult || !lastResult.image_base64) {
      setStatus('请先生成流水图', true);
      return;
    }
    downloadBase64(lastResult.image_base64, lastResult.filename, lastResult.mime);
    setStatus('已开始下载（演示）', false);
  }

  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    var e = document.getElementById('ccbFlowEditBtn');
    var p = document.getElementById('ccbFlowPrefillBtn');
    var s = document.getElementById('ccbFlowSampleBtn');
    var d = document.getElementById('ccbFlowDownloadBtn');
    if (e) e.addEventListener('click', edit);
    if (p) p.addEventListener('click', prefill);
    if (s) s.addEventListener('click', fillSample);
    if (d) d.addEventListener('click', download);
  }

  function loadPage() {
    bind();
    ensureTaxRangeDefaults();
    setStatus('填写字段或预填个税后，点「生成流水图」', false);
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['ccb-flow'] = {
    ready: true,
    loadPage: loadPage,
    edit: edit
  };
})(window);
