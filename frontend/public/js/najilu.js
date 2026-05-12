(function () {
  var STORAGE_PREFIX = 'tax_issue_records:';

  function pad2(n) {
    n = Number(n) || 0;
    return n < 10 ? '0' + n : String(n);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || '';
    } catch (e) {
      return '';
    }
  }

  function todayYm() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }

  function yearFirstYm() {
    var d = new Date();
    return d.getFullYear() + '-01';
  }

  function fmtDateTime(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
      pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  function compactDate(d) {
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
  }

  function issueDateFromApp(app) {
    var s = String((app && app.apply_time) || '').trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + pad2(m[2]) + pad2(m[3]);
    return app && app.apply_date_compact ? String(app.apply_date_compact) : compactDate(new Date());
  }

  function ymCn(ym) {
    var p = String(ym || '').split('-');
    return (p[0] || '') + '年' + (p[1] || '') + '月';
  }

  function getUserKey() {
    try {
      return localStorage.getItem('user_id') || localStorage.getItem('userName') || 'current';
    } catch (e) {
      return 'current';
    }
  }

  function storageKey() {
    return STORAGE_PREFIX + getUserKey();
  }

  function loadApplications() {
    try {
      var raw = localStorage.getItem(storageKey()) || '[]';
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveApplications(arr) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(arr.slice(0, 30)));
    } catch (e) {}
  }

  function maskId(id) {
    id = String(id || '');
    if (!id) return '--';
    if (id.length <= 2) return id.charAt(0) + '*';
    return id.charAt(0) + new Array(Math.max(2, id.length - 1)).join('*') + id.charAt(id.length - 1);
  }

  function getLocalUser() {
    var out = {};
    try {
      out.real_name = localStorage.getItem('real_name') || localStorage.getItem('userName') || '';
      out.tax_id = localStorage.getItem('tax_id') || '';
      out.user_id = localStorage.getItem('user_id') || '';
    } catch (e) {}
    return out;
  }

  function cleanText(v) {
    return String(v == null ? '' : v).trim();
  }

  function isDefaultTaxId(v) {
    return cleanText(v) === '620000000000000000';
  }

  function cacheUserInfo(user) {
    try {
      var name = cleanText(user && user.real_name);
      var taxId = cleanText(user && user.tax_id);
      if (name) localStorage.setItem('real_name', name);
      if (taxId && !isDefaultTaxId(taxId)) localStorage.setItem('tax_id', taxId);
    } catch (e) {}
  }

  function mergeUserInfo(local, remote) {
    local = local || {};
    remote = remote || {};
    var merged = Object.assign({}, local, remote);
    var localName = cleanText(local.real_name);
    var remoteName = cleanText(remote.real_name);
    var userId = cleanText(remote.user_id) || cleanText(local.user_id) || getUserKey();
    if (localName && (!remoteName || remoteName === userId)) {
      merged.real_name = localName;
    } else {
      merged.real_name = remoteName || localName;
    }

    var localTaxId = cleanText(local.tax_id);
    var remoteTaxId = cleanText(remote.tax_id);
    if (localTaxId && (!remoteTaxId || isDefaultTaxId(remoteTaxId))) {
      merged.tax_id = localTaxId;
    } else {
      merged.tax_id = isDefaultTaxId(remoteTaxId) ? '' : (remoteTaxId || localTaxId);
    }
    return merged;
  }

  function fetchUserInfo() {
    var local = getLocalUser();
    if (typeof window.authFetch !== 'function') return Promise.resolve(local);
    return authFetch('api/user.php?action=info')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.code === 200 && j.data) {
          var merged = mergeUserInfo(local, j.data);
          cacheUserInfo(merged);
          return merged;
        }
        return local;
      })
      .catch(function () {
        return local;
      });
  }

  function fetchTaxRecords() {
    return authFetch('api/tax.php?action=records')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.code === 200 && j.data && Array.isArray(j.data.records)) return j.data.records;
        throw new Error(j.msg || '纳税记录加载失败');
      });
  }

  function recordYm(r) {
    var y = parseInt(r.year, 10);
    var m = parseInt(r.month, 10);
    if (!y || !m) return '';
    return y + '-' + pad2(m);
  }

  function inRange(r, start, end) {
    var ym = recordYm(r);
    return ym && ym >= start && ym <= end;
  }

  function recordsInPeriod(records, start, end) {
    if (!Array.isArray(records)) return [];
    return normalizeRecords(records.filter(function (r) { return inRange(r, start, end); }));
  }

  function periodText(start, end) {
    return start + '至' + end;
  }

  function periodCn(start, end) {
    return ymCn(start) + '-' + ymCn(end);
  }

  function money(v) {
    var n = Number(String(v == null ? '' : v).replace(/,/g, ''));
    if (isNaN(n)) n = 0;
    return n.toFixed(2);
  }

  function displayDateFromRecord(r) {
    var raw = String(r.report_date || '').trim();
    if (raw) return raw.replace(/-/g, '.');
    var ym = recordYm(r);
    if (!ym) return '';
    return ym.replace('-', '.') + '.03';
  }

  function formatDateCn(raw, fallbackYm) {
    var s = String(raw || '').trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '年' + pad2(m[2]) + '月' + pad2(m[3]) + '日';
    if (fallbackYm) {
      var p = String(fallbackYm).split('-');
      return (p[0] || '') + '年' + pad2(p[1] || '1') + '月01日';
    }
    return '';
  }

  function rowRemark(r) {
    return cleanText(r.remark || r.remarks || r.remark_text) || '原申报';
  }

  function stampAuthority(rows) {
    rows = Array.isArray(rows) ? rows : [];
    for (var i = 0; i < rows.length; i++) {
      var v = cleanText(rows[i] && rows[i].tax_authority);
      if (v) {
        if (v.indexOf('国家税务总局深圳市') >= 0) return '国家税务总局深圳市税务局';
        return v;
      }
    }
    return '国家税务总局';
  }

  function queryCode(app) {
    var existing = cleanText(app && app.query_code).replace(/\s+/g, '').toUpperCase();
    if (/^[A-Z0-9]{16}$/.test(existing)) return existing;
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var seed = cleanText((app && app.id) || '') + cleanText((app && app.record_no) || '') + issueDateFromApp(app);
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    var out = '';
    for (var j = 0; j < 16; j++) {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      h >>>= 0;
      out += chars.charAt(h % chars.length);
    }
    return out;
  }

  function queryCodeLine(code, offset, count) {
    var parts = [];
    for (var i = 0; i < count; i++) {
      parts.push(code.slice(offset + i * 4, offset + i * 4 + 4));
    }
    return parts.join(' ');
  }

  function rmbUpper(amount) {
    var n = Math.round((Number(amount) || 0) * 100);
    if (n === 0) return '零元整';
    var fraction = ['角', '分'];
    var digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
    var unit = [
      ['元', '万', '亿'],
      ['', '拾', '佰', '仟']
    ];
    var head = Math.floor(n / 100);
    var tail = n % 100;
    var s = '';
    for (var i = 0; i < fraction.length; i++) {
      var d = Math.floor(tail / (i === 0 ? 10 : 1)) % 10;
      s += d ? digit[d] + fraction[i] : '';
    }
    if (s && tail % 10 === 0) s += '整';
    s = s || '整';
    var integer = '';
    var unitPos = 0;
    var needZero = false;
    while (head > 0) {
      var section = head % 10000;
      if (needZero && section > 0 && section < 1000) integer = digit[0] + integer;
      var sectionText = '';
      var sectionZero = true;
      for (var p = 0; p < 4; p++) {
        var num = section % 10;
        if (num === 0) {
          if (!sectionZero) sectionZero = true;
        } else {
          if (sectionZero && sectionText) sectionText = digit[0] + sectionText;
          sectionZero = false;
          sectionText = digit[num] + unit[1][p] + sectionText;
        }
        section = Math.floor(section / 10);
      }
      if (sectionText) integer = sectionText + unit[0][unitPos] + integer;
      needZero = head % 10000 < 1000 && head % 10000 > 0;
      head = Math.floor(head / 10000);
      unitPos++;
    }
    return integer.replace(/零+/g, '零').replace(/零元/, '元') + s;
  }

  function normalizeRecords(records) {
    return records.slice().sort(function (a, b) {
      var ay = recordYm(a);
      var by = recordYm(b);
      if (ay !== by) return ay < by ? -1 : 1;
      return String(a.id || '') < String(b.id || '') ? -1 : 1;
    });
  }

  function findApplication(id) {
    var apps = loadApplications();
    for (var i = 0; i < apps.length; i++) {
      if (String(apps[i].id) === String(id)) return apps[i];
    }
    return null;
  }

  function renderHeader(title, backHref, rightHtml) {
    return '<div class="header">' +
      '<a href="' + esc(backHref || 'najilu.html') + '" class="back-btn"><img src="/jt.png" class="back-icon" alt=""><span>返回</span></a>' +
      '<span class="header-title">' + esc(title) + '</span>' +
      (rightHtml || '') +
      '</div>';
  }

  function renderApplicationsPage() {
    document.title = '纳税记录申请记录';
    var apps = loadApplications();
    var html = '<div class="record-page">' +
      renderHeader('纳税记录申请记录', 'najilu.html') +
      '<div class="record-tips">' +
      '<div>温馨提示：</div>' +
      '<div>1.仅支持查询最近30天（含30天）内开具的纳税记录，如有需要，请重新开具；</div>' +
      '<div>2.若您对纳税记录的内容有疑问，请<a href="#" style="color:#1677ff;text-decoration:none;">点此帮助</a>。</div>' +
      '</div><div class="application-list">';

    if (!apps.length) {
      html += '<div class="empty-records">暂无申请记录</div>';
    } else {
      apps.forEach(function (app) {
        html += '<div class="application-card" data-id="' + esc(app.id) + '">' +
          '<div class="application-line"><span class="application-label">申请时间：</span><span class="application-time">' + esc(app.apply_time) + '</span></div>' +
          '<div class="application-line"><span class="application-label">税款所属期：</span><span class="application-value">' + esc(periodText(app.period_start, app.period_end)) + '</span><span class="application-status">' + esc(app.status || '制作成功') + '</span></div>' +
          '<div class="application-line"><span class="application-label">开具范围：</span><span class="application-value">' + esc(app.scope || '全国') + '</span></div>' +
          '<div class="application-actions">' +
          '<button type="button" class="application-action" data-action="preview" data-id="' + esc(app.id) + '">◎预览</button>' +
          '<button type="button" class="application-action" data-action="save" data-id="' + esc(app.id) + '">▣保存</button>' +
          '</div></div>';
      });
    }
    html += '</div></div>';
    document.body.innerHTML = html;
    document.body.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.application-action') : null;
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var app = findApplication(id);
      if (!app) {
        alert('申请记录不存在');
        return;
      }
      if (btn.getAttribute('data-action') === 'preview') {
        window.location.href = 'najilu.html?view=preview&id=' + encodeURIComponent(id);
      } else {
        saveCertificate(app);
      }
    });
  }

  function generateRecord(start, end, user, records) {
    var filtered = recordsInPeriod(records, start, end);
    if (!filtered.length) {
      throw new Error('所选期间暂无纳税明细，无法生成纳税记录');
    }
    var now = new Date();
    var id = 'issue_' + now.getTime();
    var recordNo = String(Math.floor(10000000 + Math.random() * 90000000));
    return {
      id: id,
      apply_time: fmtDateTime(now),
      apply_date_compact: compactDate(now),
      record_no: recordNo,
      period_start: start,
      period_end: end,
      scope: '全国',
      status: '制作成功',
      user: {
        real_name: user.real_name || getUserKey(),
        tax_id: isDefaultTaxId(user.tax_id) ? '' : (user.tax_id || '')
      },
      records: filtered,
      query_code: queryCode({ id: id, record_no: recordNo, apply_date_compact: compactDate(now) })
    };
  }

  function initForm() {
    var rangeStartInput = document.getElementById('rangeStartInput');
    var rangeEndInput = document.getElementById('rangeEndInput');
    var rangeStartLabel = document.getElementById('rangeStartLabel');
    var rangeEndLabel = document.getElementById('rangeEndLabel');
    var ymMax = todayYm();
    var ymDefaultStart = yearFirstYm();
    var ymDefaultEnd = ymMax;
    var btn = document.getElementById('generateBtn');

    fetchUserInfo().then(function (user) {
      var idEl = document.querySelector('.info-card .info-row:nth-child(2) .info-value');
      if (idEl) {
        idEl.textContent = maskId(user.tax_id);
        idEl.classList.remove('placeholder');
      }
    });

    if (rangeStartInput && rangeEndInput) {
      rangeStartInput.max = ymMax;
      rangeEndInput.max = ymMax;
      rangeStartInput.value = ymDefaultStart;
      rangeEndInput.value = ymDefaultEnd;
      if (rangeStartInput.value > rangeEndInput.value) rangeEndInput.value = rangeStartInput.value;
      rangeStartLabel.textContent = rangeStartInput.value;
      rangeEndLabel.textContent = rangeEndInput.value;

      function clampOrder() {
        if (rangeStartInput.value && rangeEndInput.value && rangeStartInput.value > rangeEndInput.value) {
          rangeEndInput.value = rangeStartInput.value;
          rangeEndLabel.textContent = rangeEndInput.value;
        }
        rangeEndInput.min = rangeStartInput.value || '2019-01';
        rangeStartInput.max = rangeEndInput.value || ymMax;
        if (rangeStartInput.max > ymMax) rangeStartInput.max = ymMax;
        if (rangeEndInput.max !== ymMax) rangeEndInput.max = ymMax;
      }

      rangeStartInput.addEventListener('change', function () {
        rangeStartLabel.textContent = rangeStartInput.value;
        clampOrder();
        rangeEndLabel.textContent = rangeEndInput.value;
      });
      rangeEndInput.addEventListener('change', function () {
        rangeEndLabel.textContent = rangeEndInput.value;
        clampOrder();
        rangeStartLabel.textContent = rangeStartInput.value;
      });
      document.querySelectorAll('.month-picker-hit').forEach(function (lab) {
        function openPicker(e) {
          var fid = lab.getAttribute('for');
          var inp = fid ? document.getElementById(fid) : null;
          if (!inp) return;
          if (typeof inp.showPicker === 'function') {
            e.preventDefault();
            inp.focus();
            try {
              inp.showPicker();
            } catch (err) {}
          }
        }
        lab.addEventListener('click', openPicker);
        lab.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          openPicker(e);
        });
      });
      document.querySelectorAll('.info-row-month-picker .mp-help-btn').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          alert('请选择申请开具纳税记录的起止年月（含起止月）。最早可选 2019 年 1 月，最晚不超过当前月。');
        });
      });
      clampOrder();
    }

    initSlider();

    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = '正在生成...';
      Promise.all([fetchUserInfo(), fetchTaxRecords()])
        .then(function (ret) {
          var app = generateRecord(rangeStartInput.value, rangeEndInput.value, ret[0], ret[1]);
          var apps = loadApplications();
          apps.unshift(app);
          saveApplications(apps);
          window.location.href = 'najilu.html?view=records';
        })
        .catch(function (err) {
          alert(err && err.message ? err.message : '生成失败');
          btn.disabled = false;
          btn.textContent = '生成纳税记录';
        });
    });

    document.getElementById('viewRecordsLink').addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = 'najilu.html?view=records';
    });
  }

  function initSlider() {
    var lane = document.getElementById('sliderLane');
    var handle = document.getElementById('sliderHandle');
    var hint = document.getElementById('sliderHint');
    var btn = document.getElementById('generateBtn');
    var maxX = 0;
    var startLeft = 0;
    var startClientX = 0;
    var dragging = false;

    function layout() {
      maxX = Math.max(0, lane.offsetWidth - handle.offsetWidth);
    }
    function setHandle(x) {
      x = Math.max(0, Math.min(x, maxX));
      handle.style.left = x + 'px';
    }
    function resetSlider() {
      handle.style.left = '0px';
      handle.classList.remove('verified');
      hint.textContent = '请按住滑块，拖动到最右边';
      hint.style.color = '#c0c0c0';
      btn.disabled = true;
    }
    function onPointerDown(e) {
      if (handle.classList.contains('verified')) return;
      dragging = true;
      layout();
      startLeft = handle.offsetLeft;
      startClientX = e.clientX != null ? e.clientX : e.touches[0].clientX;
      e.preventDefault();
    }
    function onPointerMove(e) {
      if (!dragging) return;
      var cx = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      setHandle(startLeft + cx - startClientX);
      e.preventDefault();
    }
    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      layout();
      if (handle.offsetLeft >= maxX - 2) {
        handle.classList.add('verified');
        hint.textContent = '验证通过';
        hint.style.color = '#52c41a';
        btn.disabled = false;
      } else {
        resetSlider();
      }
    }

    handle.addEventListener('mousedown', onPointerDown);
    handle.addEventListener('touchstart', onPointerDown, { passive: false });
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchend', onPointerUp);
    document.addEventListener('touchcancel', onPointerUp);
    window.addEventListener('resize', function () {
      if (!handle.classList.contains('verified')) {
        layout();
        setHandle(handle.offsetLeft);
      }
    });
    layout();
  }

  function drawText(ctx, text, x, y, opt) {
    opt = opt || {};
    ctx.save();
    ctx.fillStyle = opt.color || '#222';
    ctx.font = (opt.weight ? opt.weight + ' ' : '') + (opt.size || 28) + 'px ' + (opt.font || 'serif');
    ctx.textAlign = opt.align || 'left';
    ctx.textBaseline = opt.baseline || 'alphabetic';
    ctx.fillText(String(text == null ? '' : text), x, y);
    ctx.restore();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, opt) {
    text = String(text || '');
    var line = '';
    var lines = [];
    for (var i = 0; i < text.length; i++) {
      var test = line + text.charAt(i);
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = text.charAt(i);
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    lines.slice(0, opt && opt.maxLines ? opt.maxLines : 3).forEach(function (ln, idx) {
      drawText(ctx, ln, x, y + idx * lineHeight, opt);
    });
  }

  function drawQr(ctx, x, y, size, seed) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#111';
    var cells = 37;
    var c = size / cells;
    function finder(cx, cy) {
      ctx.fillRect(x + cx * c, y + cy * c, c * 7, c * 7);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + (cx + 1) * c, y + (cy + 1) * c, c * 5, c * 5);
      ctx.fillStyle = '#111';
      ctx.fillRect(x + (cx + 2) * c, y + (cy + 2) * c, c * 3, c * 3);
    }
    finder(1, 1); finder(cells - 8, 1); finder(1, cells - 8);
    var n = 0;
    for (var i = 0; i < String(seed).length; i++) n += String(seed).charCodeAt(i) * (i + 3);
    for (var yy = 0; yy < cells; yy++) {
      for (var xx = 0; xx < cells; xx++) {
        if ((xx < 8 && yy < 8) || (xx >= cells - 8 && yy < 8) || (xx < 8 && yy >= cells - 8)) continue;
        if (((xx * 13 + yy * 7 + n) % 5) < 2 || ((xx * 3 + yy * 11 + n) % 7) < 2) {
          ctx.fillRect(x + xx * c, y + yy * c, c, c);
        }
      }
    }
    ctx.restore();
  }

  function renderCertificateDataUrl(app) {
    return new Promise(function (resolve) {
      var rows = normalizeRecords(app.records || []);
      var width = 1240;
      var rowH = 70;
      var height = Math.max(1754, 820 + rows.length * rowH + 420);
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#d6d6d6';
      ctx.lineWidth = 1;

      var verifyCode = queryCode(app);
      drawText(ctx, '(' + app.apply_date_compact + ' 记录 ' + app.record_no + ')', 88, 92, { size: 20, color: '#555' });
      drawText(ctx, '◉', width / 2, 92, { size: 48, color: '#b92828', align: 'center' });
      drawQr(ctx, width - 257, 42, 185, app.id + verifyCode);
      drawText(ctx, '查询验证码', width - 164, 255, { size: 28, align: 'center', color: '#555' });
      drawText(ctx, queryCodeLine(verifyCode, 0, 3), width - 164, 312, { size: 34, align: 'center', color: '#222', font: 'sans-serif' });
      drawText(ctx, queryCodeLine(verifyCode, 12, 1), width - 164, 364, { size: 34, align: 'center', color: '#222', font: 'sans-serif' });

      drawText(ctx, '中华人民共和国', width / 2, 180, { size: 38, align: 'center', font: 'serif' });
      drawText(ctx, '个人所得税纳税记录', width / 2, 230, { size: 38, align: 'center', font: 'serif' });
      drawText(ctx, '（原《税收完税证明》）', width / 2, 286, { size: 22, align: 'center', font: 'serif' });

      var name = app.user && app.user.real_name ? app.user.real_name : '';
      var rawTaxId = app.user && app.user.tax_id ? app.user.tax_id : '';
      var taxId = isDefaultTaxId(rawTaxId) ? '' : rawTaxId;
      drawText(ctx, '记录期间： ' + periodCn(app.period_start, app.period_end), 90, 386, { size: 22 });
      drawText(ctx, '纳税人名称： ' + name, 90, 444, { size: 22 });
      drawText(ctx, '身份证件类型： 居民身份证', 90, 502, { size: 22 });
      drawText(ctx, '纳税人识别号： ' + taxId, 650, 444, { size: 22 });
      drawText(ctx, '身份证件号码： ' + taxId, 650, 502, { size: 22 });
      drawText(ctx, '金额单位:元', width - 132, 578, { size: 16, color: '#555' });

      var x0 = 90;
      var y0 = 610;
      var tableW = width - 180;
      var cols = [145, 145, 145, 170, 150, 250, 55];
      var heads = ['申报日期', '实缴(退)金额', '入(退)库日期', '所得项目', '税款所属期', '入库税务机关', '备注'];
      ctx.strokeRect(x0, y0, tableW, 48);
      var xx = x0;
      heads.forEach(function (h, i) {
        if (i > 0) {
          ctx.beginPath();
          ctx.moveTo(xx, y0);
          ctx.lineTo(xx, y0 + 48 + Math.max(rows.length, 1) * rowH);
          ctx.stroke();
        }
        drawText(ctx, h, xx + cols[i] / 2, y0 + 31, { size: 16, align: 'center', color: '#333' });
        xx += cols[i];
      });
      ctx.beginPath();
      ctx.moveTo(x0, y0 + 48);
      ctx.lineTo(x0 + tableW, y0 + 48);
      ctx.stroke();

      rows.forEach(function (r, idx) {
        var y = y0 + 48 + idx * rowH;
        ctx.beginPath();
        ctx.moveTo(x0, y + rowH);
        ctx.lineTo(x0 + tableW, y + rowH);
        ctx.stroke();
        var vals = [
          displayDateFromRecord(r),
          money(r.tax_reported),
          displayDateFromRecord(r),
          r.income_type || '工资薪金所得',
          recordYm(r).replace('-', '.'),
          r.tax_authority || '',
          rowRemark(r)
        ];
        var cx = x0;
        vals.forEach(function (v, i) {
          if (i === 5) {
            ctx.font = '16px serif';
            wrapText(ctx, v, cx + 10, y + 25, cols[i] - 18, 22, { size: 16, color: '#333', maxLines: 2 });
          } else {
            drawText(ctx, v, cx + cols[i] / 2, y + 42, { size: 16, align: 'center', color: '#333' });
          }
          cx += cols[i];
        });
      });

      var footY = y0 + 48 + Math.max(rows.length, 1) * rowH;
      ctx.strokeRect(x0, footY, tableW, 44);
      ctx.beginPath();
      ctx.moveTo(x0 + cols[0], footY);
      ctx.lineTo(x0 + cols[0], footY + 44);
      ctx.stroke();
      drawText(ctx, '金额合计', x0 + cols[0] / 2, footY + 29, { size: 16, align: 'center' });
      var total = rows.reduce(function (sum, r) { return sum + Number(r.tax_reported || 0); }, 0);
      drawText(ctx, rmbUpper(total), x0 + cols[0] + 28, footY + 29, { size: 16 });

      var explainY = Math.max(height - 310, footY + 250);
      ctx.beginPath();
      ctx.moveTo(90, explainY - 40);
      ctx.lineTo(width - 90, explainY - 40);
      ctx.stroke();
      drawText(ctx, '说明：', 90, explainY, { size: 18, color: '#555' });
      drawText(ctx, '1.本记录涉及纳税人敏感信息，请妥善保存。', 90, explainY + 42, { size: 16, color: '#999' });
      drawText(ctx, '2.您可以通过以下方式对本记录进行验证：', 90, explainY + 76, { size: 16, color: '#999' });
      drawText(ctx, '（1）通过手机App扫描右上角二维码进行验证；', 112, explainY + 110, { size: 16, color: '#999' });
      drawText(ctx, '（2）通过自然人电子税务局输入右上角查询验证码进行验证；', 112, explainY + 144, { size: 16, color: '#999' });
      drawText(ctx, '3.不同打印设备造成的色差不影响使用效力。', 90, explainY + 178, { size: 16, color: '#999' });
      drawText(ctx, '本凭证不作为纳税人记账、抵扣凭证', 90, explainY + 232, { size: 20, color: '#555' });
      drawText(ctx, '开具机关（盖章）', width - 430, explainY + 138, { size: 20, color: '#555' });
      drawText(ctx, '开具时间： ' + formatDateCn(app.apply_time, app.period_end), width - 430, explainY + 205, { size: 20, color: '#555' });
      drawText(ctx, '当前第1页，共1页', width - 230, explainY + 265, { size: 18, color: '#555' });
      drawStamp(ctx, width - 275, explainY + 126, stampAuthority(rows));
      resolve(canvas.toDataURL('image/png'));
    });
  }

  function drawStar(ctx, cx, cy, outer, inner) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 === 0 ? outer : inner;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var x = cx + Math.cos(a) * r;
      var y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawArcText(ctx, text, cx, cy, radius, startAngle, endAngle, opt) {
    text = String(text || '');
    if (!text) return;
    opt = opt || {};
    var chars = text.split('');
    var span = endAngle - startAngle;
    ctx.save();
    ctx.fillStyle = opt.color || '#d13a3a';
    ctx.font = (opt.size || 16) + 'px ' + (opt.font || 'serif');
    chars.forEach(function (ch, idx) {
      var t = chars.length === 1 ? 0.5 : idx / (chars.length - 1);
      var angle = startAngle + span * t;
      ctx.save();
      ctx.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.rotate(angle + Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  }

  function drawStamp(ctx, cx, cy, authority) {
    ctx.save();
    ctx.strokeStyle = '#d13a3a';
    ctx.fillStyle = '#d13a3a';
    ctx.globalAlpha = 0.92;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 116, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 94, 0, Math.PI * 2);
    ctx.stroke();
    drawArcText(ctx, cleanText(authority).substring(0, 18), cx, cy, 93, Math.PI * 1.13, Math.PI * 1.87, {
      size: 26,
      color: '#d13a3a'
    });
    drawStar(ctx, cx, cy - 12, 28, 11);
    drawText(ctx, '业务专用章', cx, cy + 58, { size: 34, color: '#d13a3a', align: 'center', font: 'serif' });
    ctx.restore();
  }

  function replaceApplicationSnapshot(app) {
    var apps = loadApplications();
    for (var i = 0; i < apps.length; i++) {
      if (String(apps[i].id) === String(app.id)) {
        apps[i] = app;
        saveApplications(apps);
        return;
      }
    }
  }

  function applicationWithCurrentData(app) {
    return Promise.all([fetchUserInfo(), fetchTaxRecords()]).then(function (ret) {
      var user = mergeUserInfo(app.user || {}, ret[0] || {});
      var rows = recordsInPeriod(ret[1], app.period_start, app.period_end);
      if (!rows.length) {
        throw new Error('当前APP数据中所选期间暂无纳税明细，无法生成图片');
      }
      var freshApp = Object.assign({}, app, {
        user: {
          real_name: user.real_name || getUserKey(),
          tax_id: isDefaultTaxId(user.tax_id) ? '' : (user.tax_id || '')
        },
        records: rows
      });
      replaceApplicationSnapshot(freshApp);
      return freshApp;
    });
  }

  function renderPreviewPage(id) {
    var app = findApplication(id);
    document.title = '纳税记录预览';
    if (!app) {
      document.body.innerHTML = renderHeader('纳税记录预览', 'najilu.html?view=records') + '<div class="empty-records">申请记录不存在</div>';
      return;
    }
    document.body.innerHTML = '<div class="preview-page">' +
      renderHeader('纳税记录预览', 'najilu.html?view=records', '<button type="button" id="savePreviewBtn" class="application-action" style="position:absolute;right:14px;">保存</button>') +
      '<div class="preview-wrap"><div class="empty-records" id="previewLoading">正在生成预览...</div><img id="certificatePreview" class="preview-img" alt="纳税记录" style="display:none;"></div>' +
      '</div>';
    applicationWithCurrentData(app)
      .then(function (freshApp) {
        return renderCertificateDataUrl(freshApp).then(function (url) {
          return { url: url, app: freshApp };
        });
      })
      .then(function (ret) {
        var img = document.getElementById('certificatePreview');
        document.getElementById('previewLoading').style.display = 'none';
        img.src = ret.url;
        img.style.display = 'block';
        document.getElementById('savePreviewBtn').onclick = function () {
          downloadUrl(ret.url, ret.app);
        };
      })
      .catch(function (err) {
        var loading = document.getElementById('previewLoading');
        if (loading) loading.textContent = err && err.message ? err.message : '生成预览失败';
      });
  }

  function downloadUrl(url, app) {
    var a = document.createElement('a');
    a.href = url;
    a.download = '纳税记录_' + app.period_start + '_' + app.period_end + '.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function saveCertificate(app) {
    applicationWithCurrentData(app)
      .then(function (freshApp) {
        return renderCertificateDataUrl(freshApp).then(function (url) {
          downloadUrl(url, freshApp);
        });
      })
      .catch(function (err) {
        alert(err && err.message ? err.message : '保存失败');
      });
  }

  var view = getParam('view');
  if (view === 'records') {
    renderApplicationsPage();
  } else if (view === 'preview') {
    renderPreviewPage(getParam('id'));
  } else {
    initForm();
  }
})();
