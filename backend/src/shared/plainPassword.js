/**
 * users.plain_password 存储策略：关闭 / 明文 / 加密
 */
const crypto = require('crypto');
const config = require('./config');

function plainPasswordMode() {
  var m = String(config.REGISTER_STORE_PLAIN_PASSWORD || '0')
    .trim()
    .toLowerCase();
  if (!m || m === '0' || m === 'false' || m === 'off' || m === 'no') return 'off';
  if (m === 'encrypt' || m === 'enc' || m === 'aes') return 'encrypt';
  if (m === '1' || m === 'true' || m === 'plain' || m === 'on' || m === 'yes') return 'plain';
  return 'off';
}

function deriveKey() {
  return crypto.createHash('sha256').update(String(config.JWT_SECRET || 'dev') + ':plain-pw-v1').digest();
}

function encryptPlainPassword(pwd) {
  var iv = crypto.randomBytes(12);
  var cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  var enc = Buffer.concat([cipher.update(pwd, 'utf8'), cipher.final()]);
  var tag = cipher.getAuthTag();
  return (
    'enc:' +
    iv.toString('base64url') +
    ':' +
    tag.toString('base64url') +
    ':' +
    enc.toString('base64url')
  );
}

/** 注册时写入 DB 的值；关闭则 null。不截断密文，避免找回时解密失败。 */
function encodePlainPasswordForStore(password) {
  var mode = plainPasswordMode();
  var pwd = password != null ? String(password) : '';
  if (!pwd) return null;
  if (mode === 'off') return null;
  if (mode === 'plain') return pwd.substring(0, 512);
  return encryptPlainPassword(pwd);
}

/**
 * 管理员重置、用户改密、激活码重置时始终加密保存。
 * 找回密码要回显新密码；REGISTER_STORE_PLAIN_PASSWORD=0 时若写入 null，
 * 会把原来能显示的密码清掉，页面就会报「已找到账号但无法显示密码」。
 */
function encodePlainPasswordForRecovery(password) {
  var pwd = password != null ? String(password) : '';
  if (!pwd) return null;
  if (plainPasswordMode() === 'plain') return pwd.substring(0, 512);
  return encryptPlainPassword(pwd);
}

/** 管理端展示用：解密或返回明文；失败返回空串 */
function decodePlainPasswordForDisplay(stored) {
  if (stored == null) return '';
  var s = String(stored);
  if (!s) return '';
  if (s.indexOf('enc:') !== 0) return s;
  try {
    var parts = s.split(':');
    if (parts.length !== 4) return '';
    var iv = Buffer.from(parts[1], 'base64url');
    var tag = Buffer.from(parts[2], 'base64url');
    var data = Buffer.from(parts[3], 'base64url');
    var decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (e) {
    return '';
  }
}

function isPlainPasswordStoreEnabled() {
  return plainPasswordMode() !== 'off';
}

module.exports = {
  plainPasswordMode,
  encodePlainPasswordForStore,
  encodePlainPasswordForRecovery,
  decodePlainPasswordForDisplay,
  isPlainPasswordStoreEnabled
};
