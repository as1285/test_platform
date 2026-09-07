/**
 * C 端 · 个税 APP 截图 OCR
 * 上传相册截图 → tesseract(chi_sim+eng) → 返回可粘贴解析的文本。
 * 仅需登录；图片落临时目录，识别后立即删除，不落库。
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const multer = require('multer');

var IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
var MAX_BYTES = 8 * 1024 * 1024;
var OCR_TIMEOUT_MS = 45000;
var TMP_DIR = path.join(os.tmpdir(), 'tax-screenshot-ocr');

var taxScreenshotUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      fs.mkdir(TMP_DIR, { recursive: true }, function (err) {
        cb(err, TMP_DIR);
      });
    },
    filename: function (req, file, cb) {
      var ext = path.extname(file.originalname || '').toLowerCase();
      if (IMAGE_EXT.indexOf(ext) < 0) {
        ext = '.jpg';
      }
      cb(null, 'ocr_' + crypto.randomBytes(16).toString('hex') + ext);
    }
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: function (req, file, cb) {
    var ext = path.extname(file.originalname || '').toLowerCase();
    var mime = String(file.mimetype || '').toLowerCase();
    var okExt = !ext || IMAGE_EXT.indexOf(ext) >= 0;
    var okMime = !mime || /^image\/(jpeg|png|gif|webp|bmp|jpg)/.test(mime) || mime === 'application/octet-stream';
    cb(okExt && okMime ? null : new Error('仅支持 jpg / png / gif / webp，且不超过 8MB'), okExt && okMime);
  }
});

function safeUnlink(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch (e) {}
}

/**
 * 轻量规整 OCR 原文，便于前端既有粘贴解析器识别。
 * 不依赖前端；单测可直接断言。
 */
function normalizeOcrTaxText(raw) {
  var s = String(raw == null ? '' : raw)
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[：﹕]/g, '：')
    .replace(/[，]/g, ',')
    .replace(/已申报税额/g, '税额')
    .replace(/申报税额/g, '税额')
    .replace(/所得项目/g, '')
    /* OCR 常见：2024年03 FA / 2024年3 mo → 2024年03月 */
    .replace(
      /(\d{4})\s*年\s*(\d{1,2})\s*(?:月|\s*[Ff][Aa]|\s*[Mm][Oo])?/g,
      function (_m, y, mo) {
        return y + '年' + parseInt(mo, 10) + '月';
      }
    )
    /* 收入被识成 WA / W入 等 */
    .replace(/(?:^|\n)\s*(?:WA|W入|収入)\s*[,，]?\s*([\d,.]+)/gi, '\n收入 $1')
    .replace(/扣缴义务人名称\s*：/g, '扣缴义务人名称：')
    .replace(/公司名称\s*：/g, '公司名称：');

  /* 多行月块折叠成「YYYY年M月 收入x元 税额y元」 */
  s = s.replace(
    /(\d{4})\s*年\s*(\d{1,2})\s*月[^\S\n]*(?:\n[^\n]{0,60}){0,8}?\n?\s*收入\s*([\d,.]+)\s*(?:元)?[^\S\n]*(?:\n[^\n]{0,40}){0,4}?\n?\s*税额\s*([\d,.]+)\s*(?:元)?/gi,
    function (_m, y, mo, inc, tax) {
      return (
        y +
        '年' +
        parseInt(mo, 10) +
        '月 收入' +
        String(inc).replace(/,/g, '') +
        '元 税额' +
        String(tax).replace(/,/g, '') +
        '元\n'
      );
    }
  );

  /* 压缩多余空行 */
  s = s
    .split('\n')
    .map(function (line) {
      return String(line || '').replace(/[ \t]+/g, ' ').trim();
    })
    .filter(function (line, idx, arr) {
      if (!line) {
        return idx > 0 && arr[idx - 1] !== '';
      }
      return true;
    })
    .join('\n')
    .trim();

  return s;
}

function runTesseract(imagePath) {
  return new Promise(function (resolve, reject) {
    var args = [imagePath, 'stdout', '-l', 'chi_sim+eng', '--psm', '6'];
    var child = spawn('tesseract', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    var out = '';
    var err = '';
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGKILL');
      } catch (eKill) {}
      reject(new Error('识别超时，请换更清晰的截图后重试'));
    }, OCR_TIMEOUT_MS);

    child.stdout.on('data', function (buf) {
      out += buf.toString('utf8');
    });
    child.stderr.on('data', function (buf) {
      err += buf.toString('utf8');
    });
    child.on('error', function (e) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', function (code) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        var msg = String(err || '').trim() || '识别失败';
        if (/Error opening data file|Failed loading language/i.test(msg)) {
          return reject(new Error('服务端缺少中文识别语言包，请联系管理员'));
        }
        return reject(new Error(msg.slice(0, 200)));
      }
      resolve(String(out || '').replace(/\f/g, '').trim());
    });
  });
}

async function handleTaxScreenshotOcr(req, res) {
  var filePath = req.file && req.file.path ? String(req.file.path) : '';
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({ code: 400, msg: '请选择个税 APP 截图后再上传' });
    }
    var rawText = await runTesseract(filePath);
    var text = normalizeOcrTaxText(rawText);
    if (!text || text.length < 8) {
      return res.status(422).json({
        code: 422,
        msg: '未能识别出有效文字，请上传更清晰的官方个税截图（收入纳税明细）'
      });
    }
    return res.json({
      code: 200,
      msg: 'ok',
      data: {
        text: text,
        raw_text: rawText,
        char_count: text.length
      }
    });
  } catch (e) {
    console.error('[tax-screenshot-ocr]', e);
    var msg = String((e && e.message) || '识别失败');
    if (/ENOENT|tesseract/i.test(msg) && /spawn|not found/i.test(msg)) {
      msg = '服务端未安装识别组件，请联系管理员';
    }
    return res.status(500).json({ code: 500, msg: msg });
  } finally {
    safeUnlink(filePath);
  }
}

module.exports = {
  taxScreenshotUpload: taxScreenshotUpload,
  normalizeOcrTaxText: normalizeOcrTaxText,
  runTesseract: runTesseract,
  handleTaxScreenshotOcr: handleTaxScreenshotOcr,
  getHandlers: function () {
    return {
      handleTaxScreenshotOcr: handleTaxScreenshotOcr
    };
  },
  MAX_BYTES: MAX_BYTES
};
