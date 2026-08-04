/**
 * C 端 · 离职证明（¥50 终身解锁后无限次生成）
 */
const { getPool } = require('../shared/db');
const { renderLizhiPdfBuffer } = require('../admin/lizhiCert');

var LIZHI_CERT_SKU_ID = 'sku_lizhi_cert_50';
var LIZHI_CERT_AMOUNT = '50.00';
var LIZHI_CERT_SUBJECT = '离职证明生成（终身）';
var LIZHI_MANDATORY_NOTE =
  '电子生成件，仅供个人留存，非用人单位出具。请勿用于入职、签证等正式用途。';

function clean(s) {
  return String(s == null ? '' : s).trim();
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
        note: LIZHI_MANDATORY_NOTE,
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
    var company = '';
    var position = '';
    var hire = '';
    var leave = '';
    try {
      const [erows] = await pool.execute(
        `SELECT company_name, position, hire_date, leave_date
         FROM employers WHERE user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1`,
        [uname]
      );
      if (erows.length) {
        company = clean(erows[0].company_name);
        position = clean(erows[0].position);
        hire = clean(erows[0].hire_date);
        leave = clean(erows[0].leave_date);
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
        leave_date: leave,
        note: LIZHI_MANDATORY_NOTE
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
      note: LIZHI_MANDATORY_NOTE,
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
    var buf = await renderLizhiPdfBuffer(payload);
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
    return res.json({
      code: 200,
      msg: 'ok',
      data: {
        filename: fname,
        mime: 'application/pdf',
        pdf_base64: buf.toString('base64'),
        note: LIZHI_MANDATORY_NOTE,
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

function getHandlers() {
  return {
    handleLizhiCertStatus: handleLizhiCertStatus,
    handleLizhiCertPrefill: handleLizhiCertPrefill,
    handleLizhiCertGenerate: handleLizhiCertGenerate
  };
}

module.exports = {
  getHandlers: getHandlers,
  isLizhiCertSkuId: isLizhiCertSkuId,
  markLizhiUnlocked: markLizhiUnlocked,
  userHasLizhiUnlocked: userHasLizhiUnlocked,
  LIZHI_CERT_SKU_ID: LIZHI_CERT_SKU_ID,
  LIZHI_CERT_AMOUNT: LIZHI_CERT_AMOUNT,
  LIZHI_CERT_SUBJECT: LIZHI_CERT_SUBJECT,
  LIZHI_MANDATORY_NOTE: LIZHI_MANDATORY_NOTE
};
