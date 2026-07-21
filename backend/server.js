/**
 * API 进程入口：仅装配与启动。
 * 业务逻辑见 src/legacy/monolith.js；域路由见 src/{auth,user,tax,...}/routes.js。
 */
require('./src/bootstrap').start().catch(console.error);
