/**
 * 用户域路由：资料 / 任职 / 家人 / 银行卡等 + 站内消息
 * 规范路径 /api/user、/api/message；*.php 为兼容别名
 */
function registerUserRoutes(app, deps) {
  var h = deps.handlers;
  var mw = deps.middleware;
  var authMw = mw.requireAuthAndActivatedUnlessAllowed;

  ['/api/user', '/api/user.php', '/user.php'].forEach(function (p) {
    app.get(p, authMw, h.handleUserGet);
    app.post(p, authMw, h.handleUserPost);
  });

  ['/api/message', '/api/message.php', '/message.php'].forEach(function (p) {
    app.get(p, authMw, h.handleMessageGet);
    app.post(p, authMw, h.handleMessagePost);
  });

  /* 离职/在职证明标价（公开，供激活页文案） */
  app.get('/api/public/lizhi-cert-fee', h.handlePublicLizhiCertFee);

  /* 离职证明：仅需登录，不要求账号已激活 */
  app.get('/api/lizhi-cert/status', mw.requireAuth, h.handleLizhiCertStatus);
  app.get('/api/lizhi-cert/prefill', mw.requireAuth, h.handleLizhiCertPrefill);
  app.post('/api/lizhi-cert/generate', mw.requireAuth, h.handleLizhiCertGenerate);
  /* 短期下载链（无鉴权）：安卓系统浏览器保存预览图/PDF */
  app.get('/api/lizhi-cert/temp-share/:token', h.handleLizhiCertTempShareGet);

  /* 在职/工作证明：仅需登录，不要求账号已激活 */
  app.get('/api/zaizhi-cert/status', mw.requireAuth, h.handleZaizhiCertStatus);
  app.get('/api/zaizhi-cert/prefill', mw.requireAuth, h.handleZaizhiCertPrefill);
  app.post('/api/zaizhi-cert/generate', mw.requireAuth, h.handleZaizhiCertGenerate);
  app.get('/api/zaizhi-cert/temp-share/:token', h.handleZaizhiCertTempShareGet);

  /* 社保演示（参保证明演示样例）：仅需登录即可生成；未付费带水印，付 ¥199 去水印 */
  app.get('/api/sbdy-demo/status', mw.requireAuth, h.handleSbdyDemoStatus);
  app.get('/api/sbdy-demo/prefill', mw.requireAuth, h.handleSbdyDemoPrefill);
  app.post('/api/sbdy-demo/generate', mw.requireAuth, h.handleSbdyDemoGenerate);

  /* 社保照片：仅需登录（激活页未开通账号也可用） */
  app.get('/api/user/shebao-photo', mw.requireAuth, h.handleUserShebaoPhotoList);
  app.get('/api/user/shebao-photo/:id/file', mw.requireAuth, h.handleUserShebaoPhotoFile);
  app.post(
    '/api/user/shebao-photo',
    mw.requireAuth,
    function (req, res, next) {
      mw.userShebaoPhotoUpload.single('file')(req, res, function (err) {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ code: 413, msg: '图片过大，单张不超过 5MB' });
          }
          return res.status(400).json({ code: 400, msg: String(err.message || '上传失败') });
        }
        next();
      });
    },
    h.handleUserShebaoPhotoUpload
  );

  /* 兼容 BUG 反馈：仅需登录，不要求已激活 */
  ['/api/feedback', '/api/feedback.php', '/feedback.php'].forEach(function (p) {
    app.post(
      p,
      mw.requireAuth,
      function (req, res, next) {
        mw.userCompatFeedbackUpload.array('images', 6)(req, res, function (err) {
          if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(413).json({ code: 413, msg: '图片过大，单张不超过 5MB' });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
              return res.status(400).json({ code: 400, msg: '最多上传 6 张图片' });
            }
            return res.status(400).json({ code: 400, msg: String(err.message || '上传失败') });
          }
          next();
        });
      },
      h.handleFeedbackSubmit
    );
  });

  /* 完税二维码替换：仅需登录；未付费可保存/生成（带水印），付款后去水印 */
  app.get('/api/najilu-qr/status', mw.requireAuth, h.handleUserNajiluQrStatus);
  app.get('/api/najilu-qr/list', mw.requireAuth, h.handleUserNajiluQrList);
  app.post(
    '/api/najilu-qr/save',
    mw.requireAuth,
    function (req, res, next) {
      mw.userNajiluQrUpload.single('file')(req, res, function (err) {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ code: 413, msg: '图片过大，单张不超过 8MB' });
          }
          return res.status(400).json({ code: 400, msg: String(err.message || '上传失败') });
        }
        next();
      });
    },
    h.handleUserNajiluQrSave
  );
}

module.exports = { registerUserRoutes };
