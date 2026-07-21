/**
 * 客服 / 反馈域路由（C 端）
 */
function registerChatRoutes(app, deps) {
  var h = deps.handlers;
  var mw = deps.middleware;

  app.get('/api/feedback.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleFeedbackGet);
  app.post('/api/feedback.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleFeedbackPost);
  app.get('/feedback.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleFeedbackGet);
  app.post('/feedback.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleFeedbackPost);

  app.get('/api/chat.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleChatGet);
  app.post('/api/chat.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleChatPost);
  app.get('/chat.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleChatGet);
  app.post('/chat.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleChatPost);
  app.post(
    '/api/chat/upload-image',
    mw.requireAuthAndActivatedUnlessAllowed,
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
