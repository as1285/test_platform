/**
 * 管理后台 · 建行工资流水（按数据完整生成 PNG）
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CCB_RENDER_SCRIPT = path.join(__dirname, '../../scripts/ccb_flow_render.py');
/** 兼容旧引用；模板仅作示例预览，生成不再依赖原图 PS */
const CCB_TEMPLATE = path.join(__dirname, '../../assets/ccb_flow/template.png');

function runCcbFlowRender(fields) {
  return new Promise(function (resolve, reject) {
    var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccb-flow-'));
    var outImg = path.join(tmpDir, 'out.png');
    var inJson = path.join(tmpDir, 'in.json');
    var cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {}
    }
    try {
      fs.writeFileSync(
        inJson,
        JSON.stringify(
          Object.assign({}, fields || {}, {
            out_path: outImg
          })
        ),
        'utf8'
      );
    } catch (e) {
      cleanup();
      return reject(e);
    }
    var py = process.env.SBDY_PYTHON || process.env.CCB_FLOW_PYTHON || 'python3';
    var child = spawn(py, [CCB_RENDER_SCRIPT, inJson], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    var stdout = '';
    var err = '';
    var settled = false;
    child.stdout.on('data', function (d) {
      stdout += String(d || '');
    });
    child.stderr.on('data', function (d) {
      err += String(d || '');
    });
    var timer = setTimeout(function () {
      try {
        child.kill('SIGKILL');
      } catch (e) {}
    }, 90000);
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
        if (code !== 0 || !fs.existsSync(outImg)) {
          var msg = (err || stdout || 'ccb flow render failed').trim();
          throw new Error(msg + ' (code=' + code + ')');
        }
        var buf = fs.readFileSync(outImg);
        var meta = null;
        try {
          var line = stdout.trim().split('\n').filter(Boolean).pop();
          meta = JSON.parse(line);
        } catch (e2) {
          meta = { ok: true, rendered: true };
        }
        resolve({ buf: buf, meta: meta });
      } catch (e) {
        reject(e);
      } finally {
        cleanup();
      }
    });
  });
}

/** @deprecated 兼容旧名 */
function runCcbFlowEdit(_imageBuf, fields) {
  return runCcbFlowRender(fields);
}

function loadTemplateBuf() {
  if (!fs.existsSync(CCB_TEMPLATE)) {
    throw new Error('缺少建行流水示例图 assets/ccb_flow/template.png');
  }
  return fs.readFileSync(CCB_TEMPLATE);
}

async function handleAdminCcbFlowTemplate(req, res) {
  try {
    var buf = loadTemplateBuf();
    res.json({
      code: 200,
      data: {
        filename: 'ccb-flow-sample.png',
        mime: 'image/png',
        image_base64: buf.toString('base64'),
        note: '示例样式参考；正式预览请点「生成流水图」，按表单数据完整绘制。',
        defaults: {
          counterparty_account: '140500616296',
          amount: '15002.70',
          opening_balance: '7415.60',
          company_name: '北京瑞祥茂和科技有限公司',
          account_name: '北京瑞祥茂和科技有限公司',
          name: '陈祥涛',
          card_no: '6217002740035379323'
        }
      }
    });
  } catch (e) {
    console.error('[ccb-flow] template', e);
    res.status(500).json({ code: 500, msg: (e && e.message) || '示例图加载失败' });
  }
}

function parseMaybeJsonArray(raw) {
  if (raw == null) return raw;
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return raw;
  var s = raw.trim();
  if (!s) return raw;
  if (s.charAt(0) === '[') {
    try {
      var parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    } catch (e0) {}
  }
  return raw;
}

async function handleAdminCcbFlowEdit(req, res) {
  var uploadedPath = '';
  try {
    var b = req.body || {};
    /* 上传原图已废弃：一律按字段完整绘制 */
    if (req.file && req.file.path) {
      uploadedPath = req.file.path;
    }
    var fields = {
      name: b.name,
      company_name: b.company_name,
      account_name: b.account_name,
      counterparty_account: b.counterparty_account,
      card_no: b.card_no || b.account_no,
      amount: b.amount,
      amounts: parseMaybeJsonArray(b.amounts),
      balances: parseMaybeJsonArray(b.balances),
      months: parseMaybeJsonArray(b.months || b.trade_months),
      opening_balance: b.opening_balance,
      total_income: b.total_income,
      end_month: b.end_month || b.tax_to,
      period: b.period,
      generated_at: b.generated_at
    };
    if (!fields.amounts && fields.amount) {
      fields.amounts = fields.amount;
    }
    var result = await runCcbFlowRender(fields);
    res.json({
      code: 200,
      msg: 'ok',
      data: {
        filename: 'ccb-salary-flow.png',
        mime: 'image/png',
        image_base64: result.buf.toString('base64'),
        meta: result.meta,
        demo: true,
        rendered: true
      }
    });
  } catch (e) {
    console.error('[ccb-flow] render', e);
    res.status(500).json({
      code: 500,
      msg: (e && e.message) || '流水图片生成失败'
    });
  } finally {
    if (uploadedPath) {
      try {
        fs.unlinkSync(uploadedPath);
      } catch (e2) {}
    }
  }
}

function getHandlers() {
  return {
    handleAdminCcbFlowTemplate: handleAdminCcbFlowTemplate,
    handleAdminCcbFlowEdit: handleAdminCcbFlowEdit
  };
}

module.exports = {
  getHandlers: getHandlers,
  runCcbFlowEdit: runCcbFlowEdit,
  runCcbFlowRender: runCcbFlowRender,
  CCB_TEMPLATE: CCB_TEMPLATE
};
