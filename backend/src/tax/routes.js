/**
 * 税域路由：税务记录 + 申报记录
 * 规范路径 /api/tax、/api/shenbao-jilu；*.php / 下划线名为兼容别名
 */
function registerTaxRoutes(app, deps) {
  var h = deps.handlers;
  var mw = deps.middleware;

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
