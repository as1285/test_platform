/**
 * C 端 · 社保参保证明演示样例
 * 登录即可生成；未付费 PDF 带「演示样例」水印，付 ¥199 去水印后可无限次生成无水印版。
 * 生成走 admin/sbdyDemo 的同一核心：入库 sbdy_demo_certs，PDF 由公开 show 接口现场渲染。
 */
const { getPool } = require('../shared/db');
const { createSbdyDemoCert } = require('../admin/sbdyDemo');

var SBDY_DEMO_SKU_ID = 'sku_sbdy_demo_199';
var SBDY_DEMO_AMOUNT = '199.00';
var SBDY_DEMO_SUBJECT = '社保演示去水印（终身）';

function clean(s) {
  return String(s == null ? '' : s).trim();
}

function isSbdyDemoSkuId(skuId) {
  return String(skuId || '') === SBDY_DEMO_SKU_ID;
}

async function userHasSbdyDemoUnlocked(username) {
  var uname = clean(username);
  if (!uname) return false;
  var pool = getPool();
  try {
    const [rows] = await pool.execute(
      'SELECT sbdy_demo_unlocked FROM users WHERE username = ? LIMIT 1',
      [uname]
    );
    if (!rows.length) return false;
    var v = rows[0].sbdy_demo_unlocked;
    return v === true || Number(v) === 1 || String(v) === '1';
  } catch (e) {
    /* 列未迁移时视为未解锁 */
    return false;
  }
}

async function markSbdyDemoUnlocked(conn, username) {
  var uname = clean(username);
  if (!uname) return;
  await conn.execute('UPDATE users SET sbdy_demo_unlocked = 1 WHERE username = ?', [uname]);
}

async function handleSbdyDemoStatus(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var unlocked = await userHasSbdyDemoUnlocked(req.authUserId);
    return res.json({
      code: 200,
      data: {
        unlocked: unlocked,
        fee_amount: SBDY_DEMO_AMOUNT,
        fee_subject: SBDY_DEMO_SUBJECT,
        sku_id: SBDY_DEMO_SKU_ID,
        product: 'sbdy_demo',
        pay_disabled: false
      }
    });
  } catch (e) {
    console.error('[sbdy-demo-user] status', e);
    return res.status(500).json({ code: 500, msg: '读取权益失败' });
  }
}

async function handleSbdyDemoPrefill(req, res) {
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
    try {
      const [erows] = await pool.execute(
        `SELECT company_name, credit_code FROM employers
         WHERE user_id = ? ORDER BY updated_at DESC, id DESC`,
        [uname]
      );
      employers = (erows || []).map(function (row) {
        return {
          company_name: clean(row.company_name),
          credit_code: clean(row.credit_code)
        };
      });
    } catch (eEmp) {
      /* ignore */
    }
    var taxRecords = [];
    try {
      const [trows] = await pool.execute(
        `SELECT year, month, company_name, company_tax_id, tax_authority,
                income, pension_insurance, income_subtype, income_type
         FROM tax_records
         WHERE user_id = ? AND deleted_at IS NULL
         ORDER BY year DESC, month DESC, id DESC
         LIMIT 120`,
        [uname]
      );
      taxRecords = (trows || []).map(function (row) {
        return {
          year: row.year != null ? Number(row.year) : null,
          month: row.month != null ? Number(row.month) : null,
          company_name: clean(row.company_name),
          company_tax_id: clean(row.company_tax_id),
          tax_authority: clean(row.tax_authority),
          income: row.income,
          pension_insurance: row.pension_insurance,
          income_subtype: clean(row.income_subtype),
          income_type: clean(row.income_type)
        };
      });
    } catch (eTax) {
      /* ignore */
    }
    return res.json({
      code: 200,
      data: {
        /* 与管理后台 /api/admin/sbdy-demo/prefill 同结构，供前端共用 collectEmployerInfo */
        user: {
          username: clean(u.username),
          real_name: clean(u.real_name),
          user_tax_id: clean(u.tax_id),
          tax_id: clean(u.tax_id)
        },
        employers: employers,
        tax_records: taxRecords,
        /* 兼容旧版 APP 简表预填 */
        name: clean(u.real_name),
        id_number: clean(u.tax_id),
        company_name: employers.length ? employers[0].company_name : ''
      }
    });
  } catch (e) {
    console.error('[sbdy-demo-user] prefill', e);
    return res.status(500).json({ code: 500, msg: '预填失败' });
  }
}

async function handleSbdyDemoGenerate(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var unlocked = await userHasSbdyDemoUnlocked(req.authUserId);
    /* 不再拦截付费：未付费也可生成，带「演示样例」水印；付 ¥199 后生成无水印版本 */
    var body = Object.assign({}, req.body || {}, { demo: !unlocked });
    var made = await createSbdyDemoCert(req, body, { user: req.authUserId });
    if (made.error) {
      return res.status(400).json({ code: 400, msg: made.error });
    }
    return res.json({
      code: 200,
      msg: 'ok',
      data: {
        auth_code: made.auth_code,
        token: made.token,
        links: made.links,
        region: made.payload && made.payload.region ? made.payload.region : 'zj',
        demo: !unlocked,
        demo_notice: unlocked
          ? '已开通 · 无水印正式版式'
          : '未开通 · 生成的 PDF 带「演示样例」水印，付 ¥' + SBDY_DEMO_AMOUNT + ' 后可生成无水印版本',
        unlocked: unlocked
      }
    });
  } catch (e) {
    console.error('[sbdy-demo-user] generate', e);
    return res.status(500).json({ code: 500, msg: (e && e.message) || '社保演示生成失败' });
  }
}

function getHandlers() {
  return {
    handleSbdyDemoStatus: handleSbdyDemoStatus,
    handleSbdyDemoPrefill: handleSbdyDemoPrefill,
    handleSbdyDemoGenerate: handleSbdyDemoGenerate
  };
}

module.exports = {
  getHandlers: getHandlers,
  isSbdyDemoSkuId: isSbdyDemoSkuId,
  markSbdyDemoUnlocked: markSbdyDemoUnlocked,
  userHasSbdyDemoUnlocked: userHasSbdyDemoUnlocked,
  SBDY_DEMO_SKU_ID: SBDY_DEMO_SKU_ID,
  SBDY_DEMO_AMOUNT: SBDY_DEMO_AMOUNT,
  SBDY_DEMO_SUBJECT: SBDY_DEMO_SUBJECT
};
