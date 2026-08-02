/**
 * 管理后台 · 社保缴费证明原图像素 PS
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const YLBX_EDIT_SCRIPT = path.join(__dirname, '../../scripts/ylbx_pixel_edit.py');

function runYlbxEdit(imageBuf, fields) {
  return new Promise(function (resolve, reject) {
    var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ylbx-ps-'));
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
    var py = process.env.SBDY_PYTHON || process.env.YLBX_PYTHON || 'python3';
    var child = spawn(py, [YLBX_EDIT_SCRIPT, inJson], {
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
          var msg = (err || stdout || 'ylbx edit failed').trim();
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

async function handleAdminYlbxPsEdit(req, res) {
  var uploadedPath = '';
  try {
    var b = req.body || {};
    var imgBuf = null;
    if (req.file && req.file.path) {
      uploadedPath = req.file.path;
      imgBuf = fs.readFileSync(req.file.path);
    } else if (b.image_base64) {
      imgBuf = decodeImageBase64(b.image_base64);
    }
    if (!imgBuf || !imgBuf.length) {
      return res.status(400).json({ code: 400, msg: '请上传原图' });
    }
    if (imgBuf.length > 25 * 1024 * 1024) {
      return res.status(400).json({ code: 400, msg: '图片过大（上限约 25MB）' });
    }
    var fields = {
      month_start: b.month_start,
      month_end: b.month_end,
      amount: b.amount,
      name: b.name,
      id_number: b.id_number,
      company_name: b.company_name
    };
    var result = await runYlbxEdit(imgBuf, fields);
    res.json({
      code: 200,
      msg: 'ok',
      data: {
        filename: 'ylbx-ps-demo.png',
        mime: 'image/png',
        image_base64: result.buf.toString('base64'),
        meta: result.meta,
        demo: true
      }
    });
  } catch (e) {
    console.error('[ylbx-ps] edit', e);
    res.status(500).json({
      code: 500,
      msg: (e && e.message) || '社保图片处理失败'
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
    handleAdminYlbxPsEdit: handleAdminYlbxPsEdit
  };
}

module.exports = {
  getHandlers: getHandlers,
  runYlbxEdit: runYlbxEdit
};
