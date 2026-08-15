/**
 * C 端 · 在职/工作证明（¥50 终身解锁后无限次生成）
 */
const crypto = require('crypto');
const { getPool } = require('../shared/db');
const { renderZaizhiPdfArtifacts } = require('../admin/zaizhiCert');

var ZAIZHI_CERT_SKU_ID = 'sku_zaizhi_cert_50';
var ZAIZHI_CERT_AMOUNT = '50.00';
var ZAIZHI_CERT_SUBJECT = '在职证明生成（终身）';

/** 安卓 WebView 无文件分享时，用短期 HTTPS 链接触发系统浏览器下载 */
var TEMP_SHARE_TTL_MS = 30 * 60 * 1000;
var TEMP_SHARE_MAX = 300;
var tempShareStore = new Map();

function clean(s) {
  return String(s == null ? '' : s).trim();
}


function genderFromIdNumber(idNumber) {
  var s = String(idNumber || '').replace(/[^0-9Xx]/g, '');
  var d = '';
  if (s.length >= 18) d = s.charAt(16);
  else if (s.length === 15) d = s.charAt(14);
  if (!d || !/\d/.test(d)) return '';
  return Number(d) % 2 === 1 ? '男' : '女';
}

function purgeTempShares() {
  var now = Date.now();
  tempShareStore.forEach(function (item, key) {
    if (!item || item.expiresAt <= now) tempShareStore.delete(key);
  });
  if (tempShareStore.size <= TEMP_SHARE_MAX) return;
  var entries = [];
  tempShareStore.forEach(function (item, key) {
    entries.push({ key: key, expiresAt: item.expiresAt || 0 });
  });
  entries.sort(function (a, b) {
    return a.expiresAt - b.expiresAt;
  });
  var drop = entries.length - TEMP_SHARE_MAX;
  for (var i = 0; i < drop; i++) tempShareStore.delete(entries[i].key);
}

function putTempShare(buf, mime, filename, username) {
  if (!buf || !Buffer.isBuffer(buf) || !buf.length) return null;
  purgeTempShares();
  var token = crypto.randomBytes(24).toString('hex');
  tempShareStore.set(token, {
    buf: buf,
    mime: mime || 'application/octet-stream',
    filename: clean(filename) || 'file.bin',
    username: clean(username),
    expiresAt: Date.now() + TEMP_SHARE_TTL_MS
  });
  return token;
}

function contentDispositionAttachment(filename) {
  var raw = String(filename || 'file.bin').replace(/[\r\n"]/g, '_').slice(0, 180);
  var ext = '';
  var m = raw.match(/(\.[A-Za-z0-9]{1,8})$/);
  if (m) ext = m[1];
  /* Node 禁止 header 含非 ASCII：filename 仅 ASCII，中文名走 filename* */
  var ascii = raw.replace(/[^\x20-\x7E]/g, '').replace(/[\\/:*?"<>|]/g, '_');
  ascii = ascii.replace(/^[\s._-]+|[\s._-]+$/g, '');
  if (!ascii || ascii === ext.replace('.', '')) {
    ascii = 'zaizhi-cert' + (ext || '.bin');
  } else if (ext && ascii.toLowerCase().slice(-ext.length) !== ext.toLowerCase()) {
    ascii = ascii + ext;
  }
  var encoded = encodeURIComponent(raw);
  return (
    'attachment; filename="' +
    ascii +
    "\"; filename*=UTF-8''" +
    encoded
  );
}

function isZaizhiCertSkuId(skuId) {
  return String(skuId || '') === ZAIZHI_CERT_SKU_ID;
}

async function userHasZaizhiUnlocked(username) {
  var uname = clean(username);
  if (!uname) return false;
  var pool = getPool();
  const [rows] = await pool.execute(
    'SELECT zaizhi_cert_unlocked FROM users WHERE username = ? LIMIT 1',
    [uname]
  );
  if (!rows.length) return false;
  var v = rows[0].zaizhi_cert_unlocked;
  return v === true || Number(v) === 1 || String(v) === '1';
}

async function markZaizhiUnlocked(conn, username) {
  var uname = clean(username);
  if (!uname) return;
  await conn.execute('UPDATE users SET zaizhi_cert_unlocked = 1 WHERE username = ?', [uname]);
}

async function handleZaizhiCertStatus(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var unlocked = await userHasZaizhiUnlocked(req.authUserId);
    return res.json({
      code: 200,
      data: {
        unlocked: unlocked,
        fee_amount: ZAIZHI_CERT_AMOUNT,
        fee_subject: ZAIZHI_CERT_SUBJECT,
        sku_id: ZAIZHI_CERT_SKU_ID,
        product: 'zaizhi_cert',
        pay_disabled: false
      }
    });
  } catch (e) {
    console.error('[zaizhi-cert] status', e);
    return res.status(500).json({ code: 500, msg: '读取权益失败' });
  }
}

async function handleZaizhiCertPrefill(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var pool = getPool();
    var uname = String(req.authUserId);
    const [urows] = await pool.execute(
      'SELECT username, real_name, tax_id FROM users WHERE username = ? LIMIT 1',
      [uname]
    );
    if (!urows.length) {
      return res.status(404).json({ code: 404, msg: '用户不存在' });
    }
    var u = urows[0];
    var company = '';
    var position = '';
    var hire = '';
    try {
      const [erows] = await pool.execute(
        `SELECT company_name, position, hire_date
         FROM employers WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1`,
        [uname]
      );
      if (erows.length) {
        company = clean(erows[0].company_name);
        position = clean(erows[0].position);
        hire = clean(erows[0].hire_date);
      }
    } catch (eEmp) {
      /* ignore */
    }
    return res.json({
      code: 200,
      data: {
        name: clean(u.real_name),
        id_number: clean(u.tax_id),
        company_name: company,
        position: position,
        hire_date: hire,
        gender: genderFromIdNumber(clean(u.tax_id))
      }
    });
  } catch (e) {
    console.error('[zaizhi-cert] prefill', e);
    return res.status(500).json({ code: 500, msg: '预填失败' });
  }
}

async function handleZaizhiCertGenerate(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var unlocked = await userHasZaizhiUnlocked(req.authUserId);
    var b = req.body || {};
    var payload = {
      name: clean(b.name),
      id_number: clean(b.id_number),
      gender: clean(b.gender),
      hire_date: clean(b.hire_date),
      issue_date: clean(b.issue_date),
      company_name: clean(b.company_name),
      position: clean(b.position),
      department: clean(b.department),
      demo: !unlocked
    };
    if (!payload.name || !payload.id_number) {
      return res.status(400).json({ code: 400, msg: '请填写姓名与身份证号' });
    }
    if (!payload.company_name) {
      return res.status(400).json({ code: 400, msg: '请填写公司全称' });
    }
    if (!payload.position) {
      return res.status(400).json({ code: 400, msg: '请填写担任岗位' });
    }
    if (!payload.gender) {
      payload.gender = genderFromIdNumber(payload.id_number);
    }
    var art = await renderZaizhiPdfArtifacts(payload);
    var buf = art.pdf;
    try {
      var pool = getPool();
      await pool.execute(
        `INSERT INTO zaizhi_cert_generations (username, demo, company_name)
         VALUES (?, ?, ?)`,
        [
          String(req.authUserId),
          unlocked ? 0 : 1,
          payload.company_name ? payload.company_name.slice(0, 128) : null
        ]
      );
    } catch (logErr) {
      console.error('[zaizhi-cert] log generation', logErr);
    }
    var fname =
      '工作证明-' + payload.name.replace(/[\\/:*?"<>|]/g, '_') + '.pdf';
    var pngName = fname.replace(/\.pdf$/i, '') + '.png';
    var pdfShareToken = putTempShare(buf, 'application/pdf', fname, req.authUserId);
    var previewShareToken = art.previewPng
      ? putTempShare(art.previewPng, 'image/png', pngName, req.authUserId)
      : null;
    return res.json({
      code: 200,
      msg: 'ok',
      data: {
        filename: fname,
        mime: 'application/pdf',
        pdf_base64: buf.toString('base64'),
        preview_png_base64: art.previewPng ? art.previewPng.toString('base64') : null,
        pdf_share_token: pdfShareToken,
        preview_share_token: previewShareToken,
        share_expires_in: Math.floor(TEMP_SHARE_TTL_MS / 1000),
        demo: !unlocked,
        unlocked: unlocked
      }
    });
  } catch (e) {
    console.error('[zaizhi-cert] generate', e);
    return res.status(500).json({
      code: 500,
      msg: (e && e.message) || '工作证明生成失败'
    });
  }
}

/** 短期下载：供安卓系统浏览器保存图片/PDF（无需登录，凭不可猜测 token） */
async function handleZaizhiCertTempShareGet(req, res) {
  try {
    purgeTempShares();
    var token = clean(req.params && req.params.token);
    if (!token || !/^[a-f0-9]{32,64}$/i.test(token)) {
      return res.status(404).json({ code: 404, msg: '链接无效或已过期' });
    }
    var item = tempShareStore.get(token);
    if (!item || item.expiresAt <= Date.now()) {
      if (item) tempShareStore.delete(token);
      return res.status(404).json({ code: 404, msg: '链接无效或已过期，请回到 App 重新生成' });
    }
    res.setHeader('Content-Type', item.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', contentDispositionAttachment(item.filename));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(item.buf);
  } catch (e) {
    console.error('[zaizhi-cert] temp-share get', e);
    return res.status(500).json({ code: 500, msg: '下载失败' });
  }
}

function getHandlers() {
  return {
    handleZaizhiCertStatus: handleZaizhiCertStatus,
    handleZaizhiCertPrefill: handleZaizhiCertPrefill,
    handleZaizhiCertGenerate: handleZaizhiCertGenerate,
    handleZaizhiCertTempShareGet: handleZaizhiCertTempShareGet
  };
}

module.exports = {
  getHandlers: getHandlers,
  isZaizhiCertSkuId: isZaizhiCertSkuId,
  markZaizhiUnlocked: markZaizhiUnlocked,
  userHasZaizhiUnlocked: userHasZaizhiUnlocked,
  ZAIZHI_CERT_SKU_ID: ZAIZHI_CERT_SKU_ID,
  ZAIZHI_CERT_AMOUNT: ZAIZHI_CERT_AMOUNT,
  ZAIZHI_CERT_SUBJECT: ZAIZHI_CERT_SUBJECT
};
