/**
 * 管理后台 · 建设银行工资流水原图编辑
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CCB_EDIT_SCRIPT = path.join(__dirname, '../../scripts/ccb_flow_edit.py');
const CCB_TEMPLATE = path.join(__dirname, '../../assets/ccb_flow/template.png');

function runCcbFlowEdit(imageBuf, fields) {
  return new Promise(function (resolve, reject) {
    var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccb-flow-'));
    var inImg = path.join(tmpDir, 'in.png');
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
      fs.writeFileSync(inImg, imageBuf);
      fs.writeFileSync(
        inJson,
        JSON.stringify(
          Object.assign({}, fields || {}, {
            image_path: inImg,
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
    var child = spawn(py, [CCB_EDIT_SCRIPT, inJson], {
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
          var msg = (err || stdout || 'ccb flow edit failed').trim();
          throw new Error(msg + ' (code=' + code + ')');
        }
        var buf = fs.readFileSync(outImg);
        var meta = null;
        try {
          var line = stdout.trim().split('\n').filter(Boolean).pop();
          meta = JSON.parse(line);
        } catch (e2) {
          meta = { ok: true };
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

function decodeImageBase64(raw) {
  var s = String(raw || '').trim();
  var m = s.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/);
  if (m) s = m[1];
  return Buffer.from(s, 'base64');
}

function loadTemplateBuf() {
  if (!fs.existsSync(CCB_TEMPLATE)) {
    throw new Error('缺少建行流水模板图 assets/ccb_flow/template.png');
  }
  return fs.readFileSync(CCB_TEMPLATE);
}

async function handleAdminCcbFlowTemplate(req, res) {
  try {
    var buf = loadTemplateBuf();
    res.json({
      code: 200,
      data: {
        filename: 'ccb-flow-template.png',
        mime: 'image/png',
        image_base64: buf.toString('base64'),
        defaults: {
          counterparty_account: '140500616296',
          amount: '15002.70',
          opening_balance: '7415.60',
          company_name: '北京瑞祥茂和科技有限公司',
          account_name: '北京瑞祥茂和科技有限公司',
          name: '陈祥涛'
        }
      }
    });
  } catch (e) {
    console.error('[ccb-flow] template', e);
    res.status(500).json({ code: 500, msg: (e && e.message) || '模板加载失败' });
  }
}

async function handleAdminCcbFlowEdit(req, res) {
  var uploadedPath = '';
  try {
    var b = req.body || {};
    var imgBuf = null;
    if (req.file && req.file.path) {
      uploadedPath = req.file.path;
      imgBuf = fs.readFileSync(req.file.path);
    } else if (b.image_base64) {
      imgBuf = decodeImageBase64(b.image_base64);
    } else if (String(b.use_template || '1') !== '0') {
      imgBuf = loadTemplateBuf();
    }
    if (!imgBuf || !imgBuf.length) {
      return res.status(400).json({ code: 400, msg: '请使用内置模板或上传原图' });
    }
    if (imgBuf.length > 25 * 1024 * 1024) {
      return res.status(400).json({ code: 400, msg: '图片过大（上限约 25MB）' });
    }
    var fields = {
      name: b.name,
      company_name: b.company_name,
      account_name: b.account_name,
      counterparty_account: b.counterparty_account,
      amount: b.amount,
      amounts: b.amounts,
      balances: b.balances,
      opening_balance: b.opening_balance,
      total_income: b.total_income
    };
    if (typeof fields.amounts === 'string') {
      try {
        var parsed = JSON.parse(fields.amounts);
        if (Array.isArray(parsed)) fields.amounts = parsed;
      } catch (e0) {}
    }
    if (typeof fields.balances === 'string') {
      try {
        var parsedB = JSON.parse(fields.balances);
        if (Array.isArray(parsedB)) fields.balances = parsedB;
      } catch (e1) {}
    }
    var result = await runCcbFlowEdit(imgBuf, fields);
    res.json({
      code: 200,
      msg: 'ok',
      data: {
        filename: 'ccb-salary-flow.png',
        mime: 'image/png',
        image_base64: result.buf.toString('base64'),
        meta: result.meta,
        demo: true
      }
    });
  } catch (e) {
    console.error('[ccb-flow] edit', e);
    res.status(500).json({
      code: 500,
      msg: (e && e.message) || '流水图片处理失败'
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
  CCB_TEMPLATE: CCB_TEMPLATE
};
