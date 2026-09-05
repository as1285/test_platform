/** Admin module: 公积金演示生成（杭州住房公积金个人年度对账单）
 * UX：预填 / 粘贴模版 → 表单 → 生成结果可预览/复制（与社保演示一致口径）
 */
(function (global) {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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

  function num(id, fallback) {
    var n = Number(val(id));
    return isFinite(n) ? n : fallback;
  }

  function setField(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = value == null ? '' : String(value);
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function setStatus(msg, isErr) {
    var status = document.getElementById('gjjDemoStatus');
    if (status) {
      status.textContent = msg || '';
      status.style.color = isErr ? '#b91c1c' : '';
    }
  }

  function setBusy(busy) {
    var btn = document.getElementById('btnGjjDemoGenerate');
    if (btn) {
      btn.disabled = !!busy;
      btn.textContent = busy ? '生成中…' : '生成演示样例';
    }
    var pasteGen = document.getElementById('btnGjjPasteGenerate');
    if (pasteGen) pasteGen.disabled = !!busy;
  }

  /** 兼容 type=month 与手填「2026年07月」 */
  function normalizeYm(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    var m = s.match(/^(\d{4})-(\d{1,2})$/);
    if (m) return m[1] + '-' + pad2(Number(m[2]));
    m = s.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月?$/);
    if (m) return m[1] + '-' + pad2(Number(m[2]));
    m = s.match(/^(\d{4})[\/.](\d{1,2})$/);
    if (m) return m[1] + '-' + pad2(Number(m[2]));
    return s;
  }

  function expandYear(y) {
    var n = Number(y);
    if (!isFinite(n)) return null;
    if (n < 100) n += 2000;
    if (n < 1990 || n > 2100) return null;
    return n;
  }

  function parsePeriodText(raw) {
    var s = String(raw || '').trim();
    if (!s) return null;
    s = s.replace(/\s+/g, '');
    var m = s.match(
      /(\d{2,4})[.\-\/年]?(\d{1,2})月?(?:到|至|-|~|—|～)(\d{2,4})[.\-\/年]?(\d{1,2})月?/
    );
    if (!m) return null;
    var y1 = expandYear(m[1]);
    var mo1 = Number(m[2]);
    var y2 = expandYear(m[3]);
    var mo2 = Number(m[4]);
    if (!y1 || !y2 || mo1 < 1 || mo1 > 12 || mo2 < 1 || mo2 > 12) return null;
    return { start: y1 + '-' + pad2(mo1), end: y2 + '-' + pad2(mo2) };
  }

  function pickLabeled(text, labels) {
    var lines = String(text || '').split(/\r?\n/);
    var i;
    for (i = 0; i < lines.length; i++) {
      var line = String(lines[i] || '').trim();
      if (!line) continue;
      var j;
      for (j = 0; j < labels.length; j++) {
        var re = new RegExp('^(?:' + labels[j] + ')\\s*[:：]?\\s*(.*)$', 'i');
        var m = line.match(re);
        if (m) {
          var v = String(m[1] || '').trim();
          if (v) return v;
        }
      }
    }
    return '';
  }

  function extractIdNumber(text) {
    var labeled = pickLabeled(text, ['身份证号码', '身份证号', '证件号码', '身份证', '证件号']);
    var m = String(labeled || text || '').match(/\b(\d{17}[\dXx]|\d{15})\b/);
    return m ? m[1].toUpperCase() : '';
  }

  function pickAmount(text, labels) {
    var raw = pickLabeled(text, labels);
    if (!raw) return NaN;
    var m = String(raw).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : NaN;
  }

  function pickDigits(text, labels) {
    var raw = pickLabeled(text, labels);
    var m = String(raw || '').match(/\d{6,}/);
    return m ? m[0] : '';
  }

  function defaultYmd() {
    var bj = new Date(Date.now() + 8 * 3600 * 1000);
    return (
      bj.getUTCFullYear() + '-' + pad2(bj.getUTCMonth() + 1) + '-' + pad2(bj.getUTCDate())
    );
  }

  function minusOneYearYmd(ymd) {
    var m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    return String(Number(m[1]) - 1) + '-' + m[2] + '-' + m[3];
  }

  function parsePasteTemplate(raw) {
    var text = String(raw || '').trim();
    if (!text) return { error: '请先粘贴模版文本' };
    var name = pickLabeled(text, ['姓名', '名字', '客户']);
    var idNumber = extractIdNumber(text);
    var unit = pickLabeled(text, ['当前缴存单位', '缴存单位', '单位名称', '单位', '公司名称', '公司']);
    var customerNo = pickDigits(text, ['个人客户号', '客户号']);
    var fundAccount = pickDigits(text, ['资金账号', '账号']);
    var monthly = pickAmount(text, ['月缴存额', '缴存额', '月缴', '月缴存']);
    var opening = pickAmount(text, ['期初余额', '期初']);
    var transfer = pickAmount(text, ['转移金额', '跨机构转移', '转移', '余额转移']);
    var periodRaw = pickLabeled(text, ['汇缴时间', '缴存时间', '汇缴区间', '时间', '期间', '起止']) || '';
    var period = parsePeriodText(periodRaw);
    if (!period) period = parsePeriodText(text);

    if (!name) return { error: '模版中未识别到姓名' };
    if (!idNumber) return { error: '模版中未识别到身份证号' };

    return {
      name: name,
      id_number: idNumber,
      deposit_unit: unit,
      customer_no: customerNo,
      fund_account: fundAccount,
      monthly_deposit: isFinite(monthly) && monthly > 0 ? monthly : 638,
      opening_balance: isFinite(opening) && opening >= 0 ? opening : 0,
      transfer_amount: isFinite(transfer) && transfer > 0 ? transfer : '',
      period_start: period ? period.start : '',
      period_end: period ? period.end : ''
    };
  }

  function applyParsedToForm(parsed) {
    setField('gjjName', parsed.name);
    setField('gjjIdNumber', parsed.id_number);
    if (parsed.deposit_unit) setField('gjjDepositUnit', parsed.deposit_unit);
    if (parsed.customer_no) setField('gjjCustomerNo', parsed.customer_no);
    if (parsed.fund_account) setField('gjjFundAccount', parsed.fund_account);
    setField('gjjMonthlyDeposit', parsed.monthly_deposit);
    setField('gjjOpeningBalance', parsed.opening_balance);
    if (parsed.transfer_amount !== '') setField('gjjTransferAmount', parsed.transfer_amount);
    if (parsed.period_start) setField('gjjPeriodStart', parsed.period_start);
    if (parsed.period_end) setField('gjjPeriodEnd', parsed.period_end);
  }

  function pasteFillOnly() {
    var ta = document.getElementById('gjjPasteTemplate');
    var parsed = parsePasteTemplate(ta ? ta.value : '');
    if (parsed.error) {
      setStatus(parsed.error, true);
      return null;
    }
    applyParsedToForm(parsed);
    setStatus(
      '已解析：' +
        parsed.name +
        (parsed.period_start ? ' · ' + parsed.period_start + '～' + parsed.period_end : '') +
        ' · 月缴' +
        parsed.monthly_deposit,
      false
    );
    return parsed;
  }

  function pasteAndGenerate() {
    var parsed = pasteFillOnly();
    if (!parsed) return;
    generate();
  }

  function clearPasteTemplate() {
    var el = document.getElementById('gjjPasteTemplate');
    if (el) el.value = '';
    setStatus('模版已清空', false);
  }

  function copyText(text) {
    var t = String(text || '');
    if (!t) return Promise.reject(new Error('empty'));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(t);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        ta.remove();
      }
    });
  }

  /** DB created_at 按 UTC 存，列表展示北京时间（+8） */
  function formatBjTime(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return '—';
    s = s.replace('T', ' ').replace(/\.\d+Z?$/, '').replace(/Z$/, '');
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return s.slice(0, 19);
    var utcMs = Date.UTC(
      Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])
    );
    var bj = new Date(utcMs + 8 * 3600 * 1000);
    function p2(n) {
      return String(n).padStart(2, '0');
    }
    return (
      bj.getUTCFullYear() + '-' + p2(bj.getUTCMonth() + 1) + '-' + p2(bj.getUTCDate()) +
      ' ' + p2(bj.getUTCHours()) + ':' + p2(bj.getUTCMinutes()) + ':' + p2(bj.getUTCSeconds())
    );
  }

  function fillDefaults() {
    var ps = document.getElementById('gjjPeriodStart');
    var pe = document.getElementById('gjjPeriodEnd');
    var now = new Date();
    var bj = new Date(now.getTime() + 8 * 3600 * 1000);
    var endY = bj.getUTCFullYear();
    var endM = bj.getUTCMonth() + 1;
    endM -= 1;
    if (endM <= 0) {
      endM += 12;
      endY -= 1;
    }
    var startY = endY;
    var startM = endM - 11;
    while (startM <= 0) {
      startM += 12;
      startY -= 1;
    }
    if (ps && !ps.value) ps.value = startY + '-' + pad2(startM);
    if (pe && !pe.value) pe.value = endY + '-' + pad2(endM);
    var pd = document.getElementById('gjjPrintDate');
    var se = document.getElementById('gjjStatementEnd');
    var ss = document.getElementById('gjjStatementStart');
    var today = defaultYmd();
    if (pd && !pd.value) pd.value = today;
    if (se && !se.value) se.value = today;
    if (ss && !ss.value) ss.value = minusOneYearYmd(today);
  }

  function renderList(list) {
    var tbody = document.getElementById('gjjDemoListTbody');
    if (!tbody) return;
    if (!list || !list.length) {
      tbody.innerHTML = '<tr><td colspan="7">暂无记录</td></tr>';
      return;
    }
    var html = '';
    list.forEach(function (row) {
      var links = row.links || {};
      html +=
        '<tr>' +
        '<td>' + esc(formatBjTime(row.created_at)) + '</td>' +
        '<td>' + esc(row.name || '—') + '</td>' +
        '<td class="cell-break"><code>' + esc(row.id_number || '—') + '</code></td>' +
        '<td class="cell-break">' + esc(row.deposit_unit || '—') + '</td>' +
        '<td>' + esc(row.balance === '' || row.balance == null ? '—' : Number(row.balance).toFixed(2)) + '</td>' +
        '<td class="cell-break"><code>' + esc(row.auth_code || '') + '</code></td>' +
        '<td class="cell-break">' +
        (links.show_url
          ? '<a href="' + esc(links.show_url) + '" target="_blank" rel="noopener">样例</a> · '
          : '') +
        (links.verify_url
          ? '<a href="' + esc(links.verify_url) + '" target="_blank" rel="noopener">核验</a>'
          : '') +
        '</td></tr>';
    });
    tbody.innerHTML = html;
  }

  function loadList() {
    fetchAdmin('api/admin/gjj-demo/list?limit=30')
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r);
      })
      .then(function (j) {
        if (j && j.code === 200 && j.data) {
          renderList(j.data.list || []);
        } else {
          renderList([]);
          setStatus((j && j.msg) || '列表加载失败', true);
        }
      })
      .catch(function (e) {
        renderList([]);
        setStatus('列表加载失败：' + (e && e.message ? e.message : '网络错误'), true);
      });
  }

  function renderResult(d) {
    var result = document.getElementById('gjjDemoResult');
    if (!result) return;
    var links = d.links || {};
    result.hidden = false;
    result.innerHTML =
      '<div class="admin-tool-result-head">' +
      '<strong>已生成演示样例</strong>' +
      '<span class="hint">非正式对账单</span>' +
      '</div>' +
      '<p class="stat mb-8">授权码：<code id="gjjResultAuth">' +
      esc(d.auth_code || '') +
      '</code></p>' +
      '<div class="form-actions">' +
      (links.show_url
        ? '<a class="btn-primary" href="' + esc(links.show_url) + '" target="_blank" rel="noopener">打开 PDF 样例</a>'
        : '') +
      (links.verify_url
        ? '<a class="btn-page" href="' + esc(links.verify_url) + '" target="_blank" rel="noopener">打开核验页</a>'
        : '') +
      '<button type="button" class="btn-page" id="gjjCopyAuth">复制授权码</button>' +
      (links.show_url
        ? '<button type="button" class="btn-page" id="gjjCopyShow" data-url="' + esc(links.show_url) + '">复制样例链接</button>'
        : '') +
      (links.verify_url
        ? '<button type="button" class="btn-page" id="gjjCopyVerify" data-url="' + esc(links.verify_url) + '">复制核验链接</button>'
        : '') +
      '</div>';
    var copyAuth = document.getElementById('gjjCopyAuth');
    if (copyAuth) {
      copyAuth.onclick = function () {
        copyText(d.auth_code || '')
          .then(function () {
            setStatus('授权码已复制', false);
          })
          .catch(function () {
            setStatus('复制失败', true);
          });
      };
    }
    ['gjjCopyShow', 'gjjCopyVerify'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.onclick = function () {
        copyText(btn.getAttribute('data-url') || '')
          .then(function () {
            setStatus('链接已复制', false);
          })
          .catch(function () {
            setStatus('复制失败', true);
          });
      };
    });
  }

  function generate() {
    var body = {
      name: val('gjjName'),
      id_number: val('gjjIdNumber'),
      customer_no: val('gjjCustomerNo'),
      fund_account: val('gjjFundAccount'),
      deposit_unit: val('gjjDepositUnit'),
      deposit_status: val('gjjDepositStatus') || '正常',
      monthly_deposit: num('gjjMonthlyDeposit', 638),
      opening_balance: num('gjjOpeningBalance', 0),
      deposit_day: num('gjjDepositDay', 23),
      period_start: normalizeYm(val('gjjPeriodStart')),
      period_end: normalizeYm(val('gjjPeriodEnd')),
      transfer_amount: num('gjjTransferAmount', 0),
      transfer_date: val('gjjTransferDate'),
      transfer_summary: val('gjjTransferSummary') || '跨机构个人账户余额转移',
      statement_start: val('gjjStatementStart'),
      statement_end: val('gjjStatementEnd'),
      print_date: val('gjjPrintDate')
    };
    if (!body.name || !body.id_number) {
      setStatus('请填写「姓名」与「身份证号码」', true);
      var nameEl = document.getElementById('gjjName');
      if (nameEl && nameEl.scrollIntoView) nameEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!body.period_start || !body.period_end) {
      setStatus('请选择汇缴起止月份', true);
      return;
    }
    setBusy(true);
    setStatus('生成中…', false);
    var result = document.getElementById('gjjDemoResult');
    if (result) {
      result.hidden = true;
      result.innerHTML = '';
    }
    fetchAdmin('api/admin/gjj-demo/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r).then(function (j) {
          return { http: r.status, j: j };
        });
      })
      .then(function (pack) {
        var j = pack.j;
        if (!j || j.code !== 200 || !j.data) {
          setStatus((j && j.msg) || '生成失败（HTTP ' + pack.http + '）', true);
          return;
        }
        setStatus('已生成演示样例（非正式对账单）', false);
        renderResult(j.data);
        loadList();
      })
      .catch(function (e) {
        setStatus('生成失败：' + (e && e.message ? e.message : '网络错误'), true);
      })
      .then(function () {
        setBusy(false);
      });
  }

  function fillSample() {
    setField('gjjName', '王梓涵');
    setField('gjjIdNumber', '371323199701195223');
    setField('gjjCustomerNo', '330100200936451');
    setField('gjjFundAccount', '1011000936451916');
    setField('gjjDepositUnit', '杭州云启信息技术有限公司');
    setField('gjjDepositStatus', '正常');
    setField('gjjMonthlyDeposit', 638);
    setField('gjjOpeningBalance', 0);
    setField('gjjPeriodStart', '2026-07');
    setField('gjjPeriodEnd', '2026-07');
    setField('gjjDepositDay', 23);
    setField('gjjTransferAmount', 2015.65);
    setField('gjjTransferDate', '2026-07-24');
    setField('gjjTransferSummary', '跨机构个人账户余额转移');
    setField('gjjStatementStart', '2025-08-24');
    setField('gjjStatementEnd', '2026-08-24');
    setField('gjjPrintDate', '2026-08-24');
    setStatus('已填充示例：王梓涵（可再点生成）', false);
  }

  /**
   * 从预填详情汇总缴存单位：
   * - 依据税务记录（含年月+公司）按时间倒序去重，得到多家单位
   * - 传入年月区间则只取区间内单位；并返回记录的最早/最晚月用于回填汇缴区间
   */
  function collectUnitInfo(d, rangeStart, rangeEnd) {
    d = d || {};
    var records = Array.isArray(d.tax_records) ? d.tax_records : [];
    var employers = Array.isArray(d.employers) ? d.employers : [];
    function ymNum(ym) {
      var m = String(ym || '').match(/^(\d{4})-(\d{1,2})$/);
      return m ? Number(m[1]) * 12 + Number(m[2]) : null;
    }
    function numYm(n) {
      var y = Math.floor((n - 1) / 12);
      var mo = ((n - 1) % 12) + 1;
      return y + '-' + pad2(mo);
    }
    var startN = rangeStart ? ymNum(rangeStart) : null;
    var endN = rangeEnd ? ymNum(rangeEnd) : null;
    var recs = [];
    records.forEach(function (r) {
      var y = Number(r.year);
      var m = Number(r.month);
      if (!y || !m) return;
      recs.push({ n: y * 12 + m, company: r.company_name ? String(r.company_name).trim() : '' });
    });
    recs.sort(function (a, b) {
      return b.n - a.n;
    });
    var companies = [];
    var seen = {};
    var minN = null;
    var maxN = null;
    recs.forEach(function (r) {
      if (startN != null && r.n < startN) return;
      if (endN != null && r.n > endN) return;
      if (minN == null || r.n < minN) minN = r.n;
      if (maxN == null || r.n > maxN) maxN = r.n;
      if (r.company && !seen[r.company]) {
        seen[r.company] = 1;
        companies.push(r.company);
      }
    });
    if (!companies.length) {
      employers.forEach(function (e) {
        var cn = e && e.company_name ? String(e.company_name).trim() : '';
        if (cn && !seen[cn]) {
          seen[cn] = 1;
          companies.push(cn);
        }
      });
      (Array.isArray(d.companies) ? d.companies : []).forEach(function (c) {
        var cn = String(c || '').trim();
        if (cn && !seen[cn]) {
          seen[cn] = 1;
          companies.push(cn);
        }
      });
    }
    return {
      companies: companies,
      minYm: minN != null ? numYm(minN) : '',
      maxYm: maxN != null ? numYm(maxN) : ''
    };
  }

  function prefill() {
    var username = val('gjjPrefillUser');
    if (!username) {
      setStatus('请输入用户名', true);
      return;
    }
    var rangeStart = normalizeYm(val('gjjPrefillStart'));
    var rangeEnd = normalizeYm(val('gjjPrefillEnd'));
    if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
      var tmp = rangeStart;
      rangeStart = rangeEnd;
      rangeEnd = tmp;
    }
    setStatus('加载用户数据…', false);
    fetchAdmin('/api/admin/gjj-demo/prefill?username=' + encodeURIComponent(username))
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
        var id = u.user_tax_id || u.id_card || u.tax_id || '';
        setField('gjjName', u.real_name || '');
        setField('gjjIdNumber', id);
        var info = collectUnitInfo(d, rangeStart, rangeEnd);
        if (info.companies.length) setField('gjjDepositUnit', info.companies.join('、'));
        var ps = rangeStart || info.minYm;
        var pe = rangeEnd || info.maxYm;
        if (ps) setField('gjjPeriodStart', ps);
        if (pe) setField('gjjPeriodEnd', pe);
        var parts = ['已预填「' + username + '」'];
        if (info.companies.length) parts.push(info.companies.length + ' 家单位');
        if (ps && pe) parts.push('区间 ' + ps + '～' + pe);
        setStatus(parts.join(' · ') + '（请核对）', false);
      })
      .catch(function (e) {
        var msg = e && e.message ? e.message : '网络错误';
        if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
          msg = '网络请求被拦截或中断（可关闭广告拦截后重试）';
        }
        setStatus('预填失败：' + msg, true);
      });
  }

  function bind() {
    fillDefaults();
    var fillBtn = document.getElementById('btnGjjDemoFillSample');
    if (fillBtn) fillBtn.onclick = fillSample;
    var btn = document.getElementById('btnGjjDemoGenerate');
    if (btn) btn.onclick = generate;
    var refresh = document.getElementById('btnGjjDemoRefresh');
    if (refresh) {
      refresh.onclick = function () {
        loadList();
        setStatus('列表已刷新', false);
      };
    }
    var prefillBtn = document.getElementById('gjjPrefillBtn');
    if (prefillBtn) prefillBtn.onclick = prefill;
    var pasteFill = document.getElementById('btnGjjPasteFill');
    if (pasteFill) pasteFill.onclick = pasteFillOnly;
    var pasteGen = document.getElementById('btnGjjPasteGenerate');
    if (pasteGen) pasteGen.onclick = pasteAndGenerate;
    var pasteClear = document.getElementById('btnGjjPasteClear');
    if (pasteClear) pasteClear.onclick = clearPasteTemplate;
  }

  function loadPage() {
    bind();
    loadList();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['gjj-demo'] = {
    ready: true,
    loadPage: loadPage,
    generate: generate,
    fillSample: fillSample,
    parsePasteTemplate: parsePasteTemplate,
    pasteFillOnly: pasteFillOnly,
    pasteAndGenerate: pasteAndGenerate
  };
  global.loadGjjDemoPage = loadPage;
})(window);
