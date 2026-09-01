/**
 * C 端 · 离职证明（¥50 终身解锁后无限次生成）
 */
const crypto = require('crypto');
const { getPool } = require('../shared/db');
const { renderLizhiPdfArtifacts } = require('../admin/lizhiCert');
const { clean, pickLastCompany } = require('./employmentCertShared');

var LIZHI_CERT_SKU_ID = 'sku_lizhi_cert_50';
var LIZHI_CERT_AMOUNT = '50.00';
var LIZHI_CERT_SUBJECT = '离职证明生成（终身）';

/** 安卓 WebView 无文件分享时，用短期 HTTPS 链接触发系统浏览器下载 */
var TEMP_SHARE_TTL_MS = 30 * 60 * 1000;
var TEMP_SHARE_MAX = 300;
var tempShareStore = new Map();

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
    ascii = 'lizhi-cert' + (ext || '.bin');
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

function isLizhiCertSkuId(skuId) {
  return String(skuId || '') === LIZHI_CERT_SKU_ID;
}

async function userHasLizhiUnlocked(username) {
  var uname = clean(username);
  if (!uname) return false;
  var pool = getPool();
  const [rows] = await pool.execute(
    'SELECT lizhi_cert_unlocked FROM users WHERE username = ? LIMIT 1',
    [uname]
  );
  if (!rows.length) return false;
  var v = rows[0].lizhi_cert_unlocked;
  return v === true || Number(v) === 1 || String(v) === '1';
}

async function markLizhiUnlocked(conn, username) {
  var uname = clean(username);
  if (!uname) return;
  await conn.execute('UPDATE users SET lizhi_cert_unlocked = 1 WHERE username = ?', [uname]);
}

async function handleLizhiCertStatus(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var unlocked = await userHasLizhiUnlocked(req.authUserId);
    return res.json({
      code: 200,
      data: {
        unlocked: unlocked,
        fee_amount: LIZHI_CERT_AMOUNT,
        fee_subject: LIZHI_CERT_SUBJECT,
        sku_id: LIZHI_CERT_SKU_ID,
        product: 'lizhi_cert',
        pay_disabled: false
      }
    });
  } catch (e) {
    console.error('[lizhi-cert] status', e);
    return res.status(500).json({ code: 500, msg: '读取权益失败' });
  }
}

async function handleLizhiCertPrefill(req, res) {
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
    var employers = [];
    var taxRecords = [];
    try {
      const [erows] = await pool.execute(
        `SELECT company_name, position, hire_date, leave_date, status
         FROM employers WHERE user_id = ?`,
        [uname]
      );
      employers = erows || [];
    } catch (eEmp) {
      /* ignore */
    }
    try {
      const [trows] = await pool.execute(
        `SELECT company_name, year, month
         FROM tax_records
         WHERE user_id = ? AND deleted_at IS NULL
           AND TRIM(IFNULL(company_name,'')) <> ''
         ORDER BY year DESC, month DESC, id DESC
         LIMIT 240`,
        [uname]
      );
      taxRecords = trows || [];
    } catch (eTax) {
      /* ignore */
    }
    var last = pickLastCompany(employers, taxRecords);
    return res.json({
      code: 200,
      data: {
        name: clean(u.real_name),
        id_number: clean(u.tax_id),
        company_name: last.company_name,
        department: '',
        position: last.position,
        hire_date: last.hire_date,
        leave_date: last.leave_date,
        last_company: true
      }
    });
  } catch (e) {
    console.error('[lizhi-cert] prefill', e);
    return res.status(500).json({ code: 500, msg: '预填失败' });
  }
}

async function handleLizhiCertGenerate(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var unlocked = await userHasLizhiUnlocked(req.authUserId);
    var b = req.body || {};
    var payload = {
      name: clean(b.name),
      id_number: clean(b.id_number),
      hire_date: clean(b.hire_date),
      leave_date: clean(b.leave_date),
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
    var isQuick = b.quick === true || b.quick === 1 || b.quick === '1';
    if (!payload.position) {
      if (isQuick) payload.position = '职员';
      else return res.status(400).json({ code: 400, msg: '请填写担任岗位' });
    }
    var art = await renderLizhiPdfArtifacts(payload);
    var buf = art.pdf;
    try {
      var pool = getPool();
      await pool.execute(
        `INSERT INTO lizhi_cert_generations (username, demo, company_name)
         VALUES (?, ?, ?)`,
        [
          String(req.authUserId),
          unlocked ? 0 : 1,
          payload.company_name ? payload.company_name.slice(0, 128) : null
        ]
      );
    } catch (logErr) {
      console.error('[lizhi-cert] log generation', logErr);
    }
    var fname =
      '离职证明-' + payload.name.replace(/[\\/:*?"<>|]/g, '_') + '.pdf';
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
    console.error('[lizhi-cert] generate', e);
    return res.status(500).json({
      code: 500,
      msg: (e && e.message) || '离职证明生成失败'
    });
  }
}

/** 短期下载：供安卓系统浏览器保存图片/PDF（无需登录，凭不可猜测 token） */
async function handleLizhiCertTempShareGet(req, res) {
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
    console.error('[lizhi-cert] temp-share get', e);
    return res.status(500).json({ code: 500, msg: '下载失败' });
  }
}

function getHandlers() {
  return {
    handleLizhiCertStatus: handleLizhiCertStatus,
    handleLizhiCertPrefill: handleLizhiCertPrefill,
    handleLizhiCertGenerate: handleLizhiCertGenerate,
    handleLizhiCertTempShareGet: handleLizhiCertTempShareGet
  };
}

module.exports = {
  getHandlers: getHandlers,
  isLizhiCertSkuId: isLizhiCertSkuId,
  markLizhiUnlocked: markLizhiUnlocked,
  userHasLizhiUnlocked: userHasLizhiUnlocked,
  pickLastCompany: pickLastCompany,
  LIZHI_CERT_SKU_ID: LIZHI_CERT_SKU_ID,
  LIZHI_CERT_AMOUNT: LIZHI_CERT_AMOUNT,
  LIZHI_CERT_SUBJECT: LIZHI_CERT_SUBJECT
};
