'use strict';

const { ADMIN_MENU_KEYS } = require('./constants');
const helpers = require('./helpers');
const audit = require('./audit');
const middleware = require('./middleware');
const upload = require('./upload');
const handlers = require('./handlers');
const { registerAdminRoutes } = require('./routes');

/**
 * 初始化管理后台模块并注册 Express 路由
 * @param {import('express').Application} app
 * @param {object} deps - server.js 共享依赖
 */
function setupAdmin(app, deps) {
  const fullDeps = Object.assign({}, deps, { ADMIN_MENU_KEYS: ADMIN_MENU_KEYS });

  helpers.initAdminHelpers(fullDeps);
  audit.initAdminAudit(fullDeps);
  middleware.initAdminMiddleware(
    Object.assign({}, fullDeps, {
      loadAdminAccountByUsername: helpers.loadAdminAccountByUsername,
      recordAdminOperationLog: audit.recordAdminOperationLog
    })
  );
  upload.initAdminUpload(fullDeps);
  handlers.initAdminHandlers(
    Object.assign({}, fullDeps, {
      signAdminToken: helpers.signAdminToken,
      loadAdminAccountByUsername: helpers.loadAdminAccountByUsername,
      normalizeAdminMenuList: helpers.normalizeAdminMenuList,
      recordAdminLoginAttempt: audit.recordAdminLoginAttempt,
      adminCanAccessTargetUser: middleware.adminCanAccessTargetUser
    })
  );

  registerAdminRoutes(app);

  return {
    ADMIN_MENU_KEYS,
    normalizeAdminMenuList: helpers.normalizeAdminMenuList,
    signAdminToken: helpers.signAdminToken,
    loadAdminAccountByUsername: helpers.loadAdminAccountByUsername,
    recordAdminLoginAttempt: audit.recordAdminLoginAttempt,
    recordAdminOperationLog: audit.recordAdminOperationLog,
    requireAdminAuth: middleware.requireAdminAuth,
    adminCanAccessTargetUser: middleware.adminCanAccessTargetUser
  };
}

module.exports = { setupAdmin, ADMIN_MENU_KEYS };
