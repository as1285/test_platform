/**
 * 管理后台 · 离职证明演示 PDF + 使用统计
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { getPool } = require('../shared/db');

var LIZHI_CERT_SKU_ID = 'sku_lizhi_cert_50';

const LIZHI_RENDER_SCRIPT = path.join(__dirname, '../../scripts/lizhi_render_pdf.py');

function renderLizhiPdfBuffer(payload) {
  return new Promise(function (resolve, reject) {
    var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lizhi-'));
    var inJson = path.join(tmpDir, 'in.json');
    var outPdf = path.join(tmpDir, 'out.pdf');
    var cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {}
    }
    try {
      fs.writeFileSync(inJson, JSON.stringify({ payload: payload || {} }), 'utf8');
    } catch (e) {
      cleanup();
      return reject(e);
    }
    var py = process.env.SBDY_PYTHON || process.env.LIZHI_PYTHON || 'python3';
    var child = spawn(py, [LIZHI_RENDER_SCRIPT, inJson, outPdf], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    var err = '';
    var settled = false;
    child.stderr.on('data', function (d) {
      err += String(d || '');
    });
    var timer = setTimeout(function () {
      try {
        child.kill('SIGKILL');
      } catch (e) {}
    }, 60000);
    child.on('error', function (e) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      reject(e);
    });
    child.on('close', function (code) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (code !== 0 || !fs.existsSync(outPdf)) {
          throw new Error((err || 'pdf render failed').trim() + ' (code=' + code + ')');
        }
        resolve(fs.readFileSync(outPdf));
      } catch (e) {
        reject(e);
      } finally {
        cleanup();
      }
    });
  });
}

function clean(s) {
  return String(s == null ? '' : s).trim();
}

async function handleAdminLizhiCertGenerate(req, res) {
  try {
    var b = req.body || {};
    var payload = {
      name: clean(b.name),
      id_number: clean(b.id_number),
      hire_date: clean(b.hire_date),
      leave_date: clean(b.leave_date),
      issue_date: clean(b.issue_date),
      company_name: clean(b.company_name),
      position: clean(b.position),
      note: clean(b.note),
      demo: true
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
    var fname =
      '离职证明-' +
      payload.name.replace(/[\\/:*?"<>|]/g, '_') +
      '-demo.pdf';
    res.json({
      code: 200,
      msg: 'ok',
      data: {
        filename: fname,
        mime: 'application/pdf',
        pdf_base64: buf.toString('base64'),
        demo: true
      }
    });
  } catch (e) {
    console.error('[lizhi-cert] generate', e);
    res.status(500).json({
      code: 500,
      msg: (e && e.message) || '离职证明生成失败'
    });
  }
}

function parseLizhiStatsDays(raw) {
  var n = parseInt(raw, 10);
  if (!isFinite(n) || n < 1) n = 7;
  if (n > 366) n = 366;
  return n;
}

function money2(n) {
  var v = Number(n);
  if (!isFinite(v)) v = 0;
  return (Math.round(v * 100) / 100).toFixed(2);
}

/** C 端离职证明：付费解锁 + 生成次数 */
async function handleAdminLizhiCertStats(req, res) {
  try {
    var days = parseLizhiStatsDays(req.query && req.query.days);
    var cnPaidDay = 'DATE(DATE_ADD(paid_at, INTERVAL 8 HOUR))';
    var cnCreatedDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
    var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
    var sinceSql = ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY)';
    var pool = getPool();
    const conn = await pool.getConnection();
    try {
      const [unlockRows] = await conn.query(
        `SELECT COUNT(*) AS n FROM users WHERE lizhi_cert_unlocked = 1`
      );
      const [paidSumRows] = await conn.query(
        `SELECT COUNT(*) AS orders,
                COUNT(DISTINCT username) AS users,
                COALESCE(SUM(amount), 0) AS gmv
         FROM payment_orders
         WHERE status = 'paid'
           AND (sku_id = ? OR grant_kind = 'lizhi_cert')
           AND paid_at IS NOT NULL
           AND ${cnPaidDay}${sinceSql}`,
        [LIZHI_CERT_SKU_ID, days]
      );
      const [pendingRows] = await conn.query(
        `SELECT COUNT(*) AS n
         FROM payment_orders
         WHERE status = 'pending'
           AND (sku_id = ? OR grant_kind = 'lizhi_cert')
           AND ${cnCreatedDay}${sinceSql}`,
        [LIZHI_CERT_SKU_ID, days]
      );
      var genSummary = {
        generates: 0,
        generate_users: 0,
        generates_demo: 0,
        generates_unlocked: 0
      };
      var dailyGenMap = {};
      var recentGens = [];
      try {
        const [genSumRows] = await conn.query(
          `SELECT COUNT(*) AS generates,
                  COUNT(DISTINCT username) AS generate_users,
                  SUM(CASE WHEN demo = 1 THEN 1 ELSE 0 END) AS generates_demo,
                  SUM(CASE WHEN demo = 0 THEN 1 ELSE 0 END) AS generates_unlocked
           FROM lizhi_cert_generations
           WHERE ${cnCreatedDay}${sinceSql}`,
          [days]
        );
        if (genSumRows && genSumRows[0]) {
          genSummary.generates = Number(genSumRows[0].generates) || 0;
          genSummary.generate_users = Number(genSumRows[0].generate_users) || 0;
          genSummary.generates_demo = Number(genSumRows[0].generates_demo) || 0;
          genSummary.generates_unlocked = Number(genSumRows[0].generates_unlocked) || 0;
        }
        const [dailyGenRows] = await conn.query(
          `SELECT ${cnCreatedDay} AS d,
                  COUNT(*) AS generates,
                  COUNT(DISTINCT username) AS generate_users,
                  SUM(CASE WHEN demo = 1 THEN 1 ELSE 0 END) AS generates_demo,
                  SUM(CASE WHEN demo = 0 THEN 1 ELSE 0 END) AS generates_unlocked
           FROM lizhi_cert_generations
           WHERE ${cnCreatedDay}${sinceSql}
           GROUP BY ${cnCreatedDay}
           ORDER BY d ASC`,
          [days]
        );
        (dailyGenRows || []).forEach(function (r) {
          var key = r.d ? String(r.d).slice(0, 10) : '';
          if (!key) return;
          dailyGenMap[key] = {
            generates: Number(r.generates) || 0,
            generate_users: Number(r.generate_users) || 0,
            generates_demo: Number(r.generates_demo) || 0,
            generates_unlocked: Number(r.generates_unlocked) || 0
          };
        });
        const [recentGenRows] = await conn.query(
          `SELECT g.id, g.username, g.demo, g.company_name, g.created_at,
                  u.real_name
           FROM lizhi_cert_generations g
           LEFT JOIN users u ON u.username = g.username
           WHERE ${cnCreatedDay.replace(/created_at/g, 'g.created_at')}${sinceSql}
           ORDER BY g.id DESC
           LIMIT 50`,
          [days]
        );
        recentGens = (recentGenRows || []).map(function (r) {
          return {
            id: r.id != null ? Number(r.id) : 0,
            username: r.username != null ? String(r.username) : '',
            real_name: r.real_name != null ? String(r.real_name) : '',
            demo: r.demo === true || Number(r.demo) === 1,
            company_name: r.company_name != null ? String(r.company_name) : '',
            created_at: r.created_at ? new Date(r.created_at).toISOString() : ''
          };
        });
      } catch (genErr) {
        /* 表未迁移时仍返回付费统计 */
        console.error('[lizhi-cert] stats generations', genErr);
      }

      const [dailyPayRows] = await conn.query(
        `SELECT ${cnPaidDay} AS d,
                COUNT(*) AS paid_orders,
                COUNT(DISTINCT username) AS paid_users,
                COALESCE(SUM(amount), 0) AS gmv
         FROM payment_orders
         WHERE status = 'paid'
           AND (sku_id = ? OR grant_kind = 'lizhi_cert')
           AND paid_at IS NOT NULL
           AND ${cnPaidDay}${sinceSql}
         GROUP BY ${cnPaidDay}
         ORDER BY d ASC`,
        [LIZHI_CERT_SKU_ID, days]
      );
      var dayMap = {};
      (dailyPayRows || []).forEach(function (r) {
        var key = r.d ? String(r.d).slice(0, 10) : '';
        if (!key) return;
        dayMap[key] = {
          day: key,
          paid_orders: Number(r.paid_orders) || 0,
          paid_users: Number(r.paid_users) || 0,
          gmv: money2(r.gmv),
          generates: 0,
          generate_users: 0,
          generates_demo: 0,
          generates_unlocked: 0
        };
      });
      Object.keys(dailyGenMap).forEach(function (key) {
        if (!dayMap[key]) {
          dayMap[key] = {
            day: key,
            paid_orders: 0,
            paid_users: 0,
            gmv: '0.00',
            generates: 0,
            generate_users: 0,
            generates_demo: 0,
            generates_unlocked: 0
          };
        }
        Object.assign(dayMap[key], dailyGenMap[key]);
      });
      var daily = Object.keys(dayMap)
        .sort()
        .map(function (k) {
          return dayMap[k];
        });

      const [recentPayRows] = await conn.query(
        `SELECT o.out_trade_no, o.username, o.amount, o.paid_at, o.status,
                u.real_name
         FROM payment_orders o
         LEFT JOIN users u ON u.username = o.username
         WHERE o.status = 'paid'
           AND (o.sku_id = ? OR o.grant_kind = 'lizhi_cert')
           AND o.paid_at IS NOT NULL
           AND ${cnPaidDay.replace(/paid_at/g, 'o.paid_at')}${sinceSql}
         ORDER BY o.paid_at DESC
         LIMIT 50`,
        [LIZHI_CERT_SKU_ID, days]
      );
      var recentPaid = (recentPayRows || []).map(function (r) {
        return {
          out_trade_no: r.out_trade_no != null ? String(r.out_trade_no) : '',
          username: r.username != null ? String(r.username) : '',
          real_name: r.real_name != null ? String(r.real_name) : '',
          amount: money2(r.amount),
          paid_at: r.paid_at ? new Date(r.paid_at).toISOString() : '',
          status: r.status != null ? String(r.status) : ''
        };
      });

      var paid = paidSumRows && paidSumRows[0] ? paidSumRows[0] : {};
      return res.json({
        code: 200,
        data: {
          period: {
            days: days,
            label: '最近 ' + days + ' 天',
            period_key: String(days)
          },
          note:
            '生成次数自本次上线后开始统计；历史仅能看付费与已解锁用户。后台演示生成不计入。',
          summary: {
            unlocked_users: unlockRows && unlockRows[0] ? Number(unlockRows[0].n) || 0 : 0,
            paid_orders: Number(paid.orders) || 0,
            paid_users: Number(paid.users) || 0,
            gmv: money2(paid.gmv),
            pending_orders:
              pendingRows && pendingRows[0] ? Number(pendingRows[0].n) || 0 : 0,
            generates: genSummary.generates,
            generate_users: genSummary.generate_users,
            generates_demo: genSummary.generates_demo,
            generates_unlocked: genSummary.generates_unlocked
          },
          daily: daily,
          recent_paid: recentPaid,
          recent_generations: recentGens
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[lizhi-cert] stats', e);
    return res.status(500).json({ code: 500, msg: String(e.message || e) });
  }
}

function getHandlers() {
  return {
    handleAdminLizhiCertGenerate: handleAdminLizhiCertGenerate,
    handleAdminLizhiCertStats: handleAdminLizhiCertStats
  };
}

module.exports = {
  getHandlers: getHandlers,
  renderLizhiPdfBuffer: renderLizhiPdfBuffer
};
