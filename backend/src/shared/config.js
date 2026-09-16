/**
 * 进程配置（环境变量 + 默认值）。域模块与 legacy 巨石共用。
 */
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '../..');
const MIGRATIONS_DIR = path.join(BACKEND_ROOT, 'migrations');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
const ADMIN_ACTIVATION_KEY = process.env.ADMIN_ACTIVATION_KEY || '';
const ADMIN_PANEL_USER = process.env.ADMIN_PANEL_USER || 'admin';
const ADMIN_PANEL_PASSWORD = process.env.ADMIN_PANEL_PASSWORD || '640810';
/** 顶级管理员展示名（角色/姓名）；生产通过环境变量覆盖 */
const ADMIN_PANEL_FULL_NAME = process.env.ADMIN_PANEL_FULL_NAME || '系统管理员';
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
/** 游客会话创建：每 IP 每分钟上限 */
const GUEST_SESSION_RATE_PER_IP_MIN = parseInt(process.env.GUEST_SESSION_RATE_PER_IP_MIN || '8', 10);
/** 埋点写入：每 IP 每分钟上限 */
const TRACK_RATE_PER_IP_MIN = parseInt(process.env.TRACK_RATE_PER_IP_MIN || '60', 10);
/** 银行模拟器对接密钥（空则接口返回 503） */
const BANK_PARTNER_API_KEY = String(process.env.BANK_PARTNER_API_KEY || '').trim();
/** 逗号分隔的允许来源 IP；空则不限制 */
const BANK_PARTNER_IP_ALLOWLIST = String(process.env.BANK_PARTNER_IP_ALLOWLIST || '')
  .split(/[\s,]+/)
  .map(function (s) {
    return String(s || '').trim();
  })
  .filter(Boolean)
  .join(',');
const BANK_PARTNER_RATE_PER_IP_MIN = parseInt(process.env.BANK_PARTNER_RATE_PER_IP_MIN || '30', 10);
/** 管理登录连续失败锁定 */
const ADMIN_LOGIN_MAX_FAILS = parseInt(process.env.ADMIN_LOGIN_MAX_FAILS || '5', 10) || 5;
const ADMIN_LOGIN_LOCK_MINUTES = parseInt(process.env.ADMIN_LOGIN_LOCK_MINUTES || '30', 10) || 30;
/** 管理登录邮件 OTP：1/true 开启（需 SMTP + 账号 email 或 ADMIN_OTP_EMAIL） */
const ADMIN_LOGIN_EMAIL_OTP =
  String(process.env.ADMIN_LOGIN_EMAIL_OTP || '0').trim() === '1' ||
  String(process.env.ADMIN_LOGIN_EMAIL_OTP || '').toLowerCase() === 'true';
const ADMIN_OTP_EMAIL = String(process.env.ADMIN_OTP_EMAIL || '').trim();
const ADMIN_OTP_TTL_SEC = parseInt(process.env.ADMIN_OTP_TTL_SEC || '300', 10) || 300;
/** 管理上传单文件上限（字节），默认 80MB */
const ADMIN_UPLOAD_MAX_BYTES =
  parseInt(process.env.ADMIN_UPLOAD_MAX_BYTES || String(80 * 1024 * 1024), 10) || 80 * 1024 * 1024;
/**
 * 明文密码策略：0/off 不存；1/plain 明文（不推荐）；encrypt 用 JWT_SECRET 派生密钥加密存储
 * 默认关闭
 */
const REGISTER_STORE_PLAIN_PASSWORD = String(
  process.env.REGISTER_STORE_PLAIN_PASSWORD != null ? process.env.REGISTER_STORE_PLAIN_PASSWORD : '0'
).trim();
const DB_POOL_SIZE = parseInt(process.env.DB_POOL_SIZE || '30', 10) || 30;
const DB_POOL_QUEUE_LIMIT = parseInt(process.env.DB_POOL_QUEUE_LIMIT || '60', 10) || 60;
/** 安装包等敏感下载签名密钥；空则回退 JWT_SECRET */
const ASSET_SIGN_SECRET = String(process.env.ASSET_SIGN_SECRET || '').trim();
/** 签名下载链接有效秒数（默认 1 天，方便安卓下载器暂停后续传） */
const ASSET_SIGN_TTL_SEC = parseInt(process.env.ASSET_SIGN_TTL_SEC || '86400', 10) || 86400;

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
  SITE_TRUSTED_HOSTS,
  UPLOAD_STORAGE_BACKEND,
  ASSET_SIGN_SECRET,
  ASSET_SIGN_TTL_SEC,
  LOGIN_RATE_PER_IP_MIN,
  LOGIN_RATE_PER_USER_MIN,
  ADMIN_LOGIN_RATE_PER_IP_MIN,
  ADMIN_API_RATE_PER_IP_MIN,
  HEAVY_ADMIN_API_RATE_PER_IP_MIN,
  GUEST_SESSION_RATE_PER_IP_MIN,
  TRACK_RATE_PER_IP_MIN,
  BANK_PARTNER_API_KEY,
  BANK_PARTNER_IP_ALLOWLIST,
  BANK_PARTNER_RATE_PER_IP_MIN,
  ADMIN_LOGIN_MAX_FAILS,
  ADMIN_LOGIN_LOCK_MINUTES,
  ADMIN_LOGIN_EMAIL_OTP,
  ADMIN_OTP_EMAIL,
  ADMIN_OTP_TTL_SEC,
  ADMIN_UPLOAD_MAX_BYTES,
  REGISTER_STORE_PLAIN_PASSWORD,
  DB_POOL_SIZE,
  DB_POOL_QUEUE_LIMIT
};
