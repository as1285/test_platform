/**
 * 管理后台 · 离职证明演示 PDF
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

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

function getHandlers() {
  return {
    handleAdminLizhiCertGenerate: handleAdminLizhiCertGenerate
  };
}

module.exports = {
  getHandlers: getHandlers,
  renderLizhiPdfBuffer: renderLizhiPdfBuffer
};
