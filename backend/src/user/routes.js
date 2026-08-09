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

  /* 离职证明：仅需登录，不要求账号已激活 */
  app.get('/api/lizhi-cert/status', mw.requireAuth, h.handleLizhiCertStatus);
  app.get('/api/lizhi-cert/prefill', mw.requireAuth, h.handleLizhiCertPrefill);
  app.post('/api/lizhi-cert/generate', mw.requireAuth, h.handleLizhiCertGenerate);
  /* 短期下载链（无鉴权）：安卓系统浏览器保存预览图/PDF */
  app.get('/api/lizhi-cert/temp-share/:token', h.handleLizhiCertTempShareGet);

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
}

module.exports = { registerUserRoutes };
