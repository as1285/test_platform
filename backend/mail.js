/**
 * SMTP 邮件发送（QQ 邮箱等）
 * 环境变量：SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.qq.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_SECURE = process.env.SMTP_SECURE !== '0' && process.env.SMTP_SECURE !== 'false';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

let _transporter = null;

/** 判断 SMTP 是否已配置 */
function isMailConfigured() {
  return !!(SMTP_USER && SMTP_PASS);
}

/** 获取或创建 nodemailer 传输实例 */
function getTransporter() {
  if (!isMailConfigured()) {
    return null;
  }
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
  }
  return _transporter;
}

/**
 * @param {{ to: string, subject: string, text?: string, html?: string }} opts
 */
async function sendMail(opts) {
  var to = String(opts.to || '').trim();
  if (!to) {
    throw new Error('收件人为空');
  }
  var transport = getTransporter();
  if (!transport) {
    throw new Error('未配置 SMTP（请设置 SMTP_USER 与 SMTP_PASS）');
  }
  var info = await transport.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: to,
    subject: String(opts.subject || '通知'),
    text: opts.text || undefined,
    html: opts.html || undefined
  });
  return info;
}

module.exports = {
  isMailConfigured,
  sendMail,
  SMTP_HOST,
  SMTP_PORT
};
