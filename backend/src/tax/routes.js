/**
 * 税域路由：税务记录 + 申报记录（兼容 *.php?action=）
 */
function registerTaxRoutes(app, deps) {
  var h = deps.handlers;
  var mw = deps.middleware;

  app.get('/api/tax.php', async function taxGetEntry(req, res) {
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
  });
  app.post('/api/tax.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleTaxPost);

  app.get('/api/shenbao_jilu.php', mw.requireAuth, mw.requireActivated, h.handleShenbaoJiluGet);
  app.post('/api/shenbao_jilu.php', mw.requireAuth, mw.requireActivated, h.handleShenbaoJiluPost);
  app.get('/shenbao_jilu.php', mw.requireAuth, mw.requireActivated, h.handleShenbaoJiluGet);
  app.post('/shenbao_jilu.php', mw.requireAuth, mw.requireActivated, h.handleShenbaoJiluPost);
}

module.exports = { registerTaxRoutes };
