#!/usr/bin/env node
'use strict';

const mysql = require('mysql2/promise');
const mail = require('../mail');
const { createUserEmailBulk, EMAIL_COPY_TEMPLATES } = require('../src/admin/userEmailBulk');

const USER_TYPE_GUEST = 2;
const GUEST_USERNAME_PREFIX = '__guest_';

function nonGuestUsernameSql(userCol) {
  var col = String(userCol || 'users.username').trim();
  if (col && col.indexOf('.') < 0 && /^[A-Za-z_][A-Za-z0-9_]*$/.test(col)) {
    col = col + '.username';
  }
  var tableRef = col.indexOf('.') >= 0 ? col.split('.')[0] : 'users';
  return (
    'LEFT(' +
    col +
    ', ' +
    GUEST_USERNAME_PREFIX.length +
    ") <> '" +
    GUEST_USERNAME_PREFIX +
    "' AND COALESCE(" +
    tableRef +
    '.user_type, 0) <> ' +
    USER_TYPE_GUEST
  );
}

(async function main() {
  if (!mail.isMailConfigured || !mail.isMailConfigured()) {
    throw new Error('SMTP not configured');
  }
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'personal_tax',
    waitForConnections: true,
    connectionLimit: 4
  });
  const tpl = EMAIL_COPY_TEMPLATES.refund;
  const api = createUserEmailBulk({
    getPool: function () {
      return pool;
    },
    mail: mail,
    publicSiteUrl: process.env.PUBLIC_SITE_URL || 'https://lkj.qiyun888.top',
    nonGuestUsernameSql: nonGuestUsernameSql,
    appendAdminUserScope: function (where, params, admin, col) {
      where.push(nonGuestUsernameSql(col));
    },
    bulkAudienceSet: {}
  });

  const dry = await api.sendBulk({
    audience: 'has_email_all',
    subject: tpl.subject,
    content: tpl.content,
    linkUrl: tpl.link_url,
    poster: tpl.poster,
    ctaLabel: tpl.cta_label,
    benefits: tpl.benefits,
    dryRun: true,
    skipAlreadySent: false,
    admin: { username: 'system', is_super: 1 }
  });
  console.log('DRY_RUN', JSON.stringify(dry));
  if (!dry.matched || dry.matched <= 0) {
    throw new Error('no matched users');
  }
  if (dry.matched > 200) {
    throw new Error('matched too many: ' + dry.matched);
  }

  const result = await api.sendBulk({
    audience: 'has_email_all',
    subject: tpl.subject,
    content: tpl.content,
    linkUrl: tpl.link_url,
    poster: tpl.poster,
    ctaLabel: tpl.cta_label,
    benefits: tpl.benefits,
    dryRun: false,
    skipAlreadySent: false,
    admin: { username: 'system', is_super: 1 }
  });
  console.log('SEND_RESULT', JSON.stringify(result));
  await pool.end();
})().catch(function (e) {
  console.error('FAIL', e && e.stack ? e.stack : e);
  process.exit(1);
});
