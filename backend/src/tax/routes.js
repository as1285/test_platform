/**
 * 税域路由：税务记录 + 申报记录
 * 规范路径 /api/tax、/api/shenbao-jilu；*.php / 下划线名为兼容别名
 */
function registerTaxRoutes(app, deps) {
  var h = deps.handlers;
  var mw = deps.middleware;

  /* 咨询页：是否允许同月多条个税记录（公开只读） */
  app.get('/api/public/tax-records-policy', h.handlePublicTaxRecordsPolicy);

  /* 个税 APP 截图 OCR：仅需登录（未激活也可填税务记录） */
  app.post(
    '/api/tax/screenshot-ocr',
    mw.requireAuth,
    function (req, res, next) {
      var upload = mw.taxScreenshotUpload;
      if (!upload || typeof upload.single !== 'function') {
        return res.status(500).json({ code: 500, msg: '识图上传组件未就绪' });
      }
      upload.single('file')(req, res, function (err) {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ code: 413, msg: '图片过大，单张不超过 8MB' });
          }
          return res.status(400).json({ code: 400, msg: String(err.message || '上传失败') });
        }
        next();
      });
    },
    h.handleTaxScreenshotOcr
  );

  async function taxGetEntry(req, res) {
    if (String(req.query.action || '') === 'verify_issue') {
      try {
        await h.handleTaxVerifyIssueGet(req, res);
      } catch (e) {
        console.error(e);
        if (!res.headersSent) {
          res.status(500).json({ code: 500, msg: String(e.message) });
        }
      }
      return;
    }
    mw.requireAuthAndActivatedUnlessAllowed(req, res, function () {
      h.handleTaxGet(req, res).catch(function (e) {
        console.error(e);
        if (!res.headersSent) {
          res.status(500).json({ code: 500, msg: String(e.message) });
        }
      });
    });
  }

  ['/api/tax', '/api/tax.php', '/tax.php'].forEach(function (p) {
    app.get(p, taxGetEntry);
    app.post(p, mw.requireAuthAndActivatedUnlessAllowed, h.handleTaxPost);
  });

  ['/api/shenbao-jilu', '/api/shenbao_jilu.php', '/shenbao_jilu.php'].forEach(function (p) {
    app.get(p, mw.requireAuth, mw.requireActivated, h.handleShenbaoJiluGet);
    app.post(p, mw.requireAuth, mw.requireActivated, h.handleShenbaoJiluPost);
  });
}

module.exports = { registerTaxRoutes };
