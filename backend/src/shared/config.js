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

const DB_HOST = process.env.DB_HOST || 'test_platform_db';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'password';
const DB_DATABASE = process.env.DB_DATABASE || 'personal_tax';
const PORT = parseInt(process.env.PORT || '3000', 10);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(BACKEND_ROOT, 'uploads');
const LOGIN_RATE_PER_IP_MIN = parseInt(process.env.LOGIN_RATE_PER_IP_MIN || '20', 10);
const LOGIN_RATE_PER_USER_MIN = parseInt(process.env.LOGIN_RATE_PER_USER_MIN || '8', 10);
const ADMIN_LOGIN_RATE_PER_IP_MIN = parseInt(process.env.ADMIN_LOGIN_RATE_PER_IP_MIN || '10', 10);
const ADMIN_API_RATE_PER_IP_MIN = parseInt(process.env.ADMIN_API_RATE_PER_IP_MIN || '240', 10);
const HEAVY_ADMIN_API_RATE_PER_IP_MIN = parseInt(process.env.HEAVY_ADMIN_API_RATE_PER_IP_MIN || '60', 10);
const DB_POOL_SIZE = parseInt(process.env.DB_POOL_SIZE || '30', 10) || 30;
const DB_POOL_QUEUE_LIMIT = parseInt(process.env.DB_POOL_QUEUE_LIMIT || '60', 10) || 60;

module.exports = {
  BACKEND_ROOT,
  MIGRATIONS_DIR,
  JWT_SECRET,
  JWT_EXPIRES,
  ADMIN_ACTIVATION_KEY,
  ADMIN_PANEL_USER,
  ADMIN_PANEL_PASSWORD,
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_DATABASE,
  PORT,
  UPLOAD_DIR,
  LOGIN_RATE_PER_IP_MIN,
  LOGIN_RATE_PER_USER_MIN,
  ADMIN_LOGIN_RATE_PER_IP_MIN,
  ADMIN_API_RATE_PER_IP_MIN,
  HEAVY_ADMIN_API_RATE_PER_IP_MIN,
  DB_POOL_SIZE,
  DB_POOL_QUEUE_LIMIT
};
