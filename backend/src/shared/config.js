/**
 * 进程配置（环境变量 + 默认值）。域模块与 legacy 巨石共用。
 */
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '../..');
const MIGRATIONS_DIR = path.join(BACKEND_ROOT, 'migrations');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
const ADMIN_ACTIVATION_KEY = process.env.ADMIN_ACTIVATION_KEY || '';
const ADMIN_PANEL_USER = process.env.ADMIN_PANEL_USER || 'naicha6832';
const ADMIN_PANEL_PASSWORD = process.env.ADMIN_PANEL_PASSWORD || '640810';
/** 顶级管理员展示名（角色/姓名） */
const ADMIN_PANEL_FULL_NAME = process.env.ADMIN_PANEL_FULL_NAME || '奶茶';
/** 逗号分隔的管理端拒绝 IP（登录与已登录 API 均拦截） */
const ADMIN_IP_DENYLIST = String(process.env.ADMIN_IP_DENYLIST || '')
  .split(/[\s,]+/)
  .map(function (s) {
    return String(s || '').trim();
  })
  .filter(Boolean);

const DB_HOST = process.env.DB_HOST || 'test_platform_db';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'password';
const DB_DATABASE = process.env.DB_DATABASE || 'personal_tax';
const PORT = parseInt(process.env.PORT || '3000', 10);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(BACKEND_ROOT, 'uploads');
/** 可选 CDN / 对象存储公网前缀，如 https://cdn.example.com；空则走同源 /uploads */
const PUBLIC_ASSET_BASE_URL = String(process.env.PUBLIC_ASSET_BASE_URL || '').replace(/\/+$/, '');
/** 对外站点根（无尾斜杠），多机部署用 .env 区分域名；空则按请求 Host 推导 */
const PUBLIC_SITE_URL = String(process.env.PUBLIC_SITE_URL || process.env.APP_URL || '').replace(
  /\/+$/,
  ''
);
/**
 * 社保演示对外域名（无尾斜杠）。仅影响样例 PDF / 核验 / 二维码链接；
 * 空则仍用请求 Host 或 PUBLIC_SITE_URL。主站其它业务不受影响。
 */
const SBDY_PUBLIC_ORIGIN = String(
  process.env.SBDY_PUBLIC_ORIGIN || process.env.SBDY_SITE_URL || ''
).replace(/\/+$/, '');
/** 受信 Host（逗号分隔），用于把本站绝对下载 URL 收成相对路径 */
const SITE_TRUSTED_HOSTS = String(process.env.SITE_TRUSTED_HOSTS || '')
  .split(/[,\s;]+/)
  .map((s) => String(s || '').trim().toLowerCase())
  .filter(Boolean);
/** local | s3 | oss … 当前仅 local 写入；用于文档与未来切换 */
const UPLOAD_STORAGE_BACKEND = String(process.env.UPLOAD_STORAGE_BACKEND || 'local').trim() || 'local';
const LOGIN_RATE_PER_IP_MIN = parseInt(process.env.LOGIN_RATE_PER_IP_MIN || '20', 10);
const LOGIN_RATE_PER_USER_MIN = parseInt(process.env.LOGIN_RATE_PER_USER_MIN || '8', 10);
const ADMIN_LOGIN_RATE_PER_IP_MIN = parseInt(process.env.ADMIN_LOGIN_RATE_PER_IP_MIN || '10', 10);
const ADMIN_API_RATE_PER_IP_MIN = parseInt(process.env.ADMIN_API_RATE_PER_IP_MIN || '240', 10);
const HEAVY_ADMIN_API_RATE_PER_IP_MIN = parseInt(process.env.HEAVY_ADMIN_API_RATE_PER_IP_MIN || '60', 10);
const DB_POOL_SIZE = parseInt(process.env.DB_POOL_SIZE || '30', 10) || 30;
const DB_POOL_QUEUE_LIMIT = parseInt(process.env.DB_POOL_QUEUE_LIMIT || '60', 10) || 60;
/** C 端：激活时间早于此日期的已激活用户强制跳转新站（YYYY-MM-DD；空=关闭） */
const LEGACY_ACTIVATION_CUTOFF = String(process.env.LEGACY_ACTIVATION_CUTOFF || '').trim();
/** C 端：上述用户跳转目标（完整 URL；空=关闭强制重定向） */
const LEGACY_USER_REDIRECT_URL = String(process.env.LEGACY_USER_REDIRECT_URL || '').trim();
/** C 端：注册早于此日（不含）的已激活用户纳入引流 cohort（YYYY-MM-DD；默认 2026-07-21 = 含 6/1 前 + 6/1~7/20） */
const LEGACY_REDIRECT_REGISTER_END = String(process.env.LEGACY_REDIRECT_REGISTER_END || '2026-07-21').trim();

module.exports = {
  BACKEND_ROOT,
  MIGRATIONS_DIR,
  JWT_SECRET,
  JWT_EXPIRES,
  ADMIN_ACTIVATION_KEY,
  ADMIN_PANEL_USER,
  ADMIN_PANEL_PASSWORD,
  ADMIN_PANEL_FULL_NAME,
  ADMIN_IP_DENYLIST,
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_DATABASE,
  PORT,
  UPLOAD_DIR,
  PUBLIC_ASSET_BASE_URL,
  PUBLIC_SITE_URL,
  SBDY_PUBLIC_ORIGIN,
  SITE_TRUSTED_HOSTS,
  UPLOAD_STORAGE_BACKEND,
  LOGIN_RATE_PER_IP_MIN,
  LOGIN_RATE_PER_USER_MIN,
  ADMIN_LOGIN_RATE_PER_IP_MIN,
  ADMIN_API_RATE_PER_IP_MIN,
  HEAVY_ADMIN_API_RATE_PER_IP_MIN,
  DB_POOL_SIZE,
  DB_POOL_QUEUE_LIMIT,
  LEGACY_ACTIVATION_CUTOFF,
  LEGACY_USER_REDIRECT_URL,
  LEGACY_REDIRECT_REGISTER_END
};
