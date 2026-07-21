/**
 * 客服 / 反馈域路由（C 端）
 * 规范路径 /api/feedback、/api/chat；*.php 为兼容别名
 */
function registerChatRoutes(app, deps) {
  var h = deps.handlers;
  var mw = deps.middleware;
  var authMw = mw.requireAuthAndActivatedUnlessAllowed;

  ['/api/feedback', '/api/feedback.php', '/feedback.php'].forEach(function (p) {
    app.get(p, authMw, h.handleFeedbackGet);
    app.post(p, authMw, h.handleFeedbackPost);
  });

  ['/api/chat', '/api/chat.php', '/chat.php'].forEach(function (p) {
    app.get(p, authMw, h.handleChatGet);
    app.post(p, authMw, h.handleChatPost);
  });

  app.post(
    '/api/chat/upload-image',
    authMw,
    function (req, res, next) {
      mw.userChatImageUpload.single('file')(req, res, function (err) {
        if (err) {
          var msg = String(err.message || '上传失败');
          if (err.code === 'LIMIT_FILE_SIZE') {
            msg = '图片不能超过 5MB';
          }
          return res.status(400).json({ code: 400, msg: msg });
        }
        next();
      });
    },
    h.handleChatUploadImage
  );
}

module.exports = { registerChatRoutes };
