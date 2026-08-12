/**
 * 管理端：把本机指定用户数据导入远程新服务器。
 * - mysql：直连 USER_REMOTE_SYNC_DB_*（远程需放行源站 IP）
 * - ssh：sshpass + docker exec mysql（默认，适配远程仅本机 3308）
 */
'use strict';

const { spawn } = require('child_process');
const mysql = require('mysql2/promise');
const mysqlRaw = require('mysql2');
const { getPool } = require('../shared/db');
const {
  USER_REMOTE_SYNC_ENABLED,
  USER_REMOTE_SYNC_MODE,
  USER_REMOTE_SYNC_LABEL,
  USER_REMOTE_SYNC_SSH_HOST,
  USER_REMOTE_SYNC_SSH_PORT,
  USER_REMOTE_SYNC_SSH_USER,
  USER_REMOTE_SYNC_SSH_PASSWORD,
  USER_REMOTE_SYNC_SSH_MYSQL_CMD,
  USER_REMOTE_SYNC_DB_HOST,
  USER_REMOTE_SYNC_DB_PORT,
  USER_REMOTE_SYNC_DB_USER,
  USER_REMOTE_SYNC_DB_PASSWORD,
  USER_REMOTE_SYNC_DB_DATABASE
} = require('../shared/config');

/** @typedef {{ table: string, keyCol: string, skipId?: boolean, optional?: boolean }} SyncTableSpec */

var SYNC_TABLES = [
  { table: 'tax_records', keyCol: 'user_id' },
  { table: 'tax_record_change_logs', keyCol: 'user_id', skipId: true },
  { table: 'tax_issue_applications', keyCol: 'user_id' },
  { table: 'employers', keyCol: 'user_id', optional: true },
  { table: 'family_members', keyCol: 'user_id', optional: true },
  { table: 'bank_cards', keyCol: 'user_id', optional: true },
  { table: 'messages', keyCol: 'user_id', optional: true },
  { table: 'special_deduction_records', keyCol: 'user_id', optional: true },
  { table: 'shenbao_jilu_records', keyCol: 'user_id', optional: true },
  { table: 'user_feedback', keyCol: 'user_id', skipId: true, optional: true },
  { table: 'user_devices', keyCol: 'username' },
  { table: 'user_page_events', keyCol: 'username', skipId: true },
  { table: 'user_login_events', keyCol: 'username', skipId: true },
  { table: 'user_daily_activity', keyCol: 'username' },
  { table: 'user_profile_change_logs', keyCol: 'username', skipId: true },
  { table: 'pricing_ab_assignments', keyCol: 'username', optional: true },
  { table: 'api_slow_events', keyCol: 'username', skipId: true, optional: true },
  { table: 'activation_grants', keyCol: 'username', skipId: true, optional: true },
  { table: 'payment_orders', keyCol: 'username', skipId: true, optional: true },
  { table: 'user_rename_credits', keyCol: 'username', skipId: true, optional: true },
  { table: 'user_invites', keyCol: 'inviter_username', skipId: true, optional: true }
];

function syncMode() {
  return String(USER_REMOTE_SYNC_MODE || 'ssh').toLowerCase() === 'mysql' ? 'mysql' : 'ssh';
}

function syncConfigured() {
  if (!USER_REMOTE_SYNC_ENABLED) return false;
  if (syncMode() === 'mysql') {
    return !!(USER_REMOTE_SYNC_DB_HOST && USER_REMOTE_SYNC_DB_USER);
  }
  return !!(USER_REMOTE_SYNC_SSH_HOST && USER_REMOTE_SYNC_SSH_USER && USER_REMOTE_SYNC_SSH_PASSWORD);
}

function publicTargetInfo() {
  var mode = syncMode();
  return {
    enabled: syncConfigured(),
    mode: mode,
    label: USER_REMOTE_SYNC_LABEL || '',
    host: mode === 'mysql' ? USER_REMOTE_SYNC_DB_HOST : USER_REMOTE_SYNC_SSH_HOST,
    database: mode === 'mysql' ? USER_REMOTE_SYNC_DB_DATABASE : '(remote docker mysql)'
  };
}

function sqlLiteral(v) {
  if (v === undefined || v === null) return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (Buffer.isBuffer(v)) return mysqlRaw.escape(v.toString('utf8'));
  if (v instanceof Date) {
    var pad = function (n) {
      return n < 10 ? '0' + n : String(n);
    };
    var s =
      v.getFullYear() +
      '-' +
      pad(v.getMonth() + 1) +
      '-' +
      pad(v.getDate()) +
      ' ' +
      pad(v.getHours()) +
      ':' +
      pad(v.getMinutes()) +
      ':' +
      pad(v.getSeconds());
    return mysqlRaw.escape(s);
  }
  if (typeof v === 'object') {
    try {
      return mysqlRaw.escape(JSON.stringify(v));
    } catch (e) {
      return 'NULL';
    }
  }
  return mysqlRaw.escape(v);
}

function rowToInsert(table, row, skipId) {
  var cols = [];
  var vals = [];
  Object.keys(row).forEach(function (k) {
    if (skipId && k === 'id') return;
    cols.push('`' + k.replace(/`/g, '') + '`');
    vals.push(sqlLiteral(row[k]));
  });
  if (!cols.length) return '';
  return 'INSERT INTO `' + table + '` (' + cols.join(',') + ') VALUES (' + vals.join(',') + ');';
}

async function localTableExists(conn, table) {
  var [rows] = await conn.execute(
    'SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1',
    [table]
  );
  return !!(rows && rows[0]);
}

async function fetchRows(conn, table, keyCol, username) {
  var [rows] = await conn.execute('SELECT * FROM `' + table + '` WHERE `' + keyCol + '` = ?', [username]);
  return rows || [];
}

async function buildLocalSnapshot(username) {
  var pool = getPool();
  var conn = await pool.getConnection();
  try {
    var [users] = await conn.execute('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
    if (!users.length) {
      var err = new Error('用户不存在：' + username);
      err.status = 404;
      throw err;
    }
    var user = users[0];
    var tables = {};
    var counts = { users: 1 };
    var i;
    for (i = 0; i < SYNC_TABLES.length; i++) {
      var spec = SYNC_TABLES[i];
      if (!(await localTableExists(conn, spec.table))) {
        tables[spec.table] = [];
        counts[spec.table] = 0;
        continue;
      }
      try {
        var rows = await fetchRows(conn, spec.table, spec.keyCol, username);
        tables[spec.table] = rows;
        counts[spec.table] = rows.length;
      } catch (e) {
        if (spec.optional) {
          tables[spec.table] = [];
          counts[spec.table] = 0;
        } else {
          throw e;
        }
      }
    }

    var chat = { conversation: null, messages: [] };
    counts.chat_conversations = 0;
    counts.chat_messages = 0;
    if (await localTableExists(conn, 'chat_conversations')) {
      var [convs] = await conn.execute('SELECT * FROM chat_conversations WHERE user_id = ? LIMIT 1', [
        username
      ]);
      if (convs.length) {
        chat.conversation = convs[0];
        counts.chat_conversations = 1;
        if (await localTableExists(conn, 'chat_messages')) {
          var [msgs] = await conn.execute(
            'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY id ASC',
            [convs[0].id]
          );
          chat.messages = msgs || [];
          counts.chat_messages = chat.messages.length;
        }
      }
    }

    return { user: user, tables: tables, chat: chat, counts: counts };
  } finally {
    conn.release();
  }
}

function buildImportSql(username, snap, remoteTables) {
  var parts = [];
  parts.push('SET NAMES utf8mb4;');
  parts.push('SET FOREIGN_KEY_CHECKS=0;');
  parts.push('SET UNIQUE_CHECKS=0;');

  function hasTable(name) {
    return !remoteTables || !!remoteTables[name];
  }

  if (hasTable('chat_messages') && hasTable('chat_conversations')) {
    parts.push(
      'DELETE FROM chat_messages WHERE conversation_id IN (SELECT id FROM chat_conversations WHERE user_id=' +
        sqlLiteral(username) +
        ');'
    );
  }
  if (hasTable('chat_conversations')) {
    parts.push('DELETE FROM chat_conversations WHERE user_id=' + sqlLiteral(username) + ';');
  }

  var i;
  for (i = SYNC_TABLES.length - 1; i >= 0; i--) {
    var spec = SYNC_TABLES[i];
    if (!hasTable(spec.table)) continue;
    parts.push(
      'DELETE FROM `' + spec.table + '` WHERE `' + spec.keyCol + '`=' + sqlLiteral(username) + ';'
    );
  }
  parts.push('DELETE FROM users WHERE username=' + sqlLiteral(username) + ';');

  var userRow = Object.assign({}, snap.user);
  delete userRow.id;
  parts.push(rowToInsert('users', userRow, true));

  for (i = 0; i < SYNC_TABLES.length; i++) {
    spec = SYNC_TABLES[i];
    if (!hasTable(spec.table)) continue;
    var rows = snap.tables[spec.table] || [];
    var j;
    for (j = 0; j < rows.length; j++) {
      var sql = rowToInsert(spec.table, rows[j], !!spec.skipId);
      if (sql) parts.push(sql);
    }
  }

  if (snap.chat && snap.chat.conversation && hasTable('chat_conversations')) {
    var conv = Object.assign({}, snap.chat.conversation);
    delete conv.id;
    parts.push(rowToInsert('chat_conversations', conv, true));
    if (hasTable('chat_messages') && snap.chat.messages && snap.chat.messages.length) {
      parts.push(
        'SET @urs_chat_cid=(SELECT id FROM chat_conversations WHERE user_id=' +
          sqlLiteral(username) +
          ' LIMIT 1);'
      );
      for (j = 0; j < snap.chat.messages.length; j++) {
        var msg = Object.assign({}, snap.chat.messages[j]);
        delete msg.id;
        var cols = [];
        var vals = [];
        Object.keys(msg).forEach(function (k) {
          if (k === 'id') return;
          cols.push('`' + k.replace(/`/g, '') + '`');
          if (k === 'conversation_id') vals.push('@urs_chat_cid');
          else vals.push(sqlLiteral(msg[k]));
        });
        parts.push(
          'INSERT INTO `chat_messages` (' + cols.join(',') + ') VALUES (' + vals.join(',') + ');'
        );
      }
    }
  }

  parts.push('SET FOREIGN_KEY_CHECKS=1;');
  parts.push('SET UNIQUE_CHECKS=1;');
  return parts.filter(Boolean).join('\n') + '\n';
}

function redactSecret(msg, password) {
  var s = String(msg || '');
  if (password) {
    try {
      s = s.replace(new RegExp(password.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***');
    } catch (e) {}
  }
  return s.slice(0, 1200);
}

function defaultMysqlCmd() {
  return (
    USER_REMOTE_SYNC_SSH_MYSQL_CMD ||
    'docker exec -i test_platform_db mysql -uroot -ppassword --default-character-set=utf8mb4 personal_tax'
  );
}

function runSshMysql(sql, opts) {
  opts = opts || {};
  return new Promise(function (resolve, reject) {
    var password = USER_REMOTE_SYNC_SSH_PASSWORD;
    var mysqlCmd = defaultMysqlCmd();
    if (opts.forceN && !/\s-N\b/.test(mysqlCmd)) mysqlCmd += ' -N';

    var child = spawn(
      'sshpass',
      [
        '-p',
        password,
        'ssh',
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        '-o',
        'ConnectTimeout=20',
        '-p',
        String(USER_REMOTE_SYNC_SSH_PORT || '22'),
        USER_REMOTE_SYNC_SSH_USER + '@' + USER_REMOTE_SYNC_SSH_HOST,
        mysqlCmd
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    var out = '';
    var err = '';
    var settled = false;
    var timer = setTimeout(function () {
      try {
        child.kill('SIGKILL');
      } catch (e) {}
    }, opts.timeoutMs || 180000);

    child.stdout.on('data', function (d) {
      out += String(d || '');
    });
    child.stderr.on('data', function (d) {
      err += String(d || '');
    });
    child.on('error', function (e) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new Error(
          '无法启动 sshpass/ssh：' +
            String(e.message || e) +
            '（请确认镜像已安装 openssh-client、sshpass）'
        )
      );
    });
    child.on('close', function (code) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      var combined = (err || '') + '\n' + (out || '');
      var fatal =
        /ERROR\s+\d+/i.test(combined) ||
        /Permission denied/i.test(combined) ||
        /Connection refused/i.test(combined) ||
        /No route to host/i.test(combined);
      if (code !== 0 || fatal) {
        reject(new Error(redactSecret((err || out || 'ssh mysql failed').trim(), password)));
        return;
      }
      resolve(out);
    });
    child.stdin.write(sql);
    child.stdin.end();
  });
}

async function createRemoteMysqlConnection() {
  return mysql.createConnection({
    host: USER_REMOTE_SYNC_DB_HOST,
    port: parseInt(USER_REMOTE_SYNC_DB_PORT || '3306', 10),
    user: USER_REMOTE_SYNC_DB_USER,
    password: USER_REMOTE_SYNC_DB_PASSWORD || '',
    database: USER_REMOTE_SYNC_DB_DATABASE || 'personal_tax',
    charset: 'utf8mb4',
    multipleStatements: true
  });
}

async function runRemoteSql(sql, opts) {
  if (syncMode() === 'mysql') {
    var conn = await createRemoteMysqlConnection();
    try {
      await conn.query(sql);
      return '';
    } finally {
      await conn.end();
    }
  }
  return runSshMysql(sql, opts);
}

async function listRemoteTables() {
  if (syncMode() === 'mysql') {
    var conn = await createRemoteMysqlConnection();
    try {
      var [rows] = await conn.query('SHOW TABLES');
      var map = Object.create(null);
      (rows || []).forEach(function (r) {
        var name = r[Object.keys(r)[0]];
        if (name) map[String(name)] = true;
      });
      return map;
    } finally {
      await conn.end();
    }
  }
  var out = await runSshMysql('SHOW TABLES;', { forceN: true, timeoutMs: 60000 });
  var map2 = Object.create(null);
  String(out || '')
    .split(/\r?\n/)
    .map(function (l) {
      return l.trim();
    })
    .filter(Boolean)
    .forEach(function (name) {
      if (!/^mysql:/i.test(name)) map2[name] = true;
    });
  return map2;
}

async function verifyRemoteUser(username) {
  var counts = {};
  var user = null;
  if (syncMode() === 'mysql') {
    var conn = await createRemoteMysqlConnection();
    try {
      var checks = [
        ['users', 'SELECT COUNT(*) AS c FROM users WHERE username=?'],
        ['tax_records', 'SELECT COUNT(*) AS c FROM tax_records WHERE user_id=?'],
        ['tax_issue_applications', 'SELECT COUNT(*) AS c FROM tax_issue_applications WHERE user_id=?'],
        ['tax_record_change_logs', 'SELECT COUNT(*) AS c FROM tax_record_change_logs WHERE user_id=?'],
        ['user_devices', 'SELECT COUNT(*) AS c FROM user_devices WHERE username=?'],
        ['user_login_events', 'SELECT COUNT(*) AS c FROM user_login_events WHERE username=?'],
        ['user_page_events', 'SELECT COUNT(*) AS c FROM user_page_events WHERE username=?'],
        ['user_daily_activity', 'SELECT COUNT(*) AS c FROM user_daily_activity WHERE username=?']
      ];
      var i;
      for (i = 0; i < checks.length; i++) {
        try {
          var [cr] = await conn.execute(checks[i][1], [username]);
          counts[checks[i][0]] = Number(cr[0] && cr[0].c) || 0;
        } catch (e) {
          counts[checks[i][0]] = 0;
        }
      }
      var [ur] = await conn.execute(
        'SELECT id, username, real_name, plain_password, account_active, activation_kind FROM users WHERE username=? LIMIT 1',
        [username]
      );
      user = ur[0] || null;
    } finally {
      await conn.end();
    }
    return { counts: counts, user: user };
  }

  var sql =
    "SELECT 'users', COUNT(*) FROM users WHERE username=" +
    sqlLiteral(username) +
    " UNION ALL SELECT 'tax_records', COUNT(*) FROM tax_records WHERE user_id=" +
    sqlLiteral(username) +
    " UNION ALL SELECT 'tax_issue_applications', COUNT(*) FROM tax_issue_applications WHERE user_id=" +
    sqlLiteral(username) +
    " UNION ALL SELECT 'tax_record_change_logs', COUNT(*) FROM tax_record_change_logs WHERE user_id=" +
    sqlLiteral(username) +
    " UNION ALL SELECT 'user_devices', COUNT(*) FROM user_devices WHERE username=" +
    sqlLiteral(username) +
    " UNION ALL SELECT 'user_login_events', COUNT(*) FROM user_login_events WHERE username=" +
    sqlLiteral(username) +
    " UNION ALL SELECT 'user_page_events', COUNT(*) FROM user_page_events WHERE username=" +
    sqlLiteral(username) +
    " UNION ALL SELECT 'user_daily_activity', COUNT(*) FROM user_daily_activity WHERE username=" +
    sqlLiteral(username) +
    ';\n' +
    'SELECT id, username, real_name, IFNULL(plain_password,""), account_active, activation_kind FROM users WHERE username=' +
    sqlLiteral(username) +
    ' LIMIT 1;';
  var out = await runSshMysql(sql, { forceN: true, timeoutMs: 60000 });
  var lines = String(out || '')
    .split(/\r?\n/)
    .map(function (l) {
      return l.trim();
    })
    .filter(Boolean)
    .filter(function (l) {
      return !/^mysql:/i.test(l);
    });
  var i2;
  for (i2 = 0; i2 < lines.length; i2++) {
    var parts = lines[i2].split('\t');
    if (parts.length === 2 && !/^\d+$/.test(parts[0])) {
      counts[parts[0]] = parseInt(parts[1], 10) || 0;
    } else if (parts.length >= 6 && /^\d+$/.test(parts[0])) {
      user = {
        id: parseInt(parts[0], 10),
        username: parts[1],
        real_name: parts[2],
        plain_password: parts[3] || null,
        account_active: parts[4],
        activation_kind: parts[5]
      };
    }
  }
  return { counts: counts, user: user };
}

async function handleAdminUserRemoteSyncStatus(req, res) {
  try {
    return res.json({ code: 200, data: publicTargetInfo() });
  } catch (e) {
    return res.status(500).json({ code: 500, msg: String(e.message || e) });
  }
}

async function handleAdminUserRemoteSyncPreview(req, res) {
  try {
    if (!syncConfigured()) {
      return res.status(400).json({
        code: 400,
        msg: '未配置远程同步（请在 .env 设置 USER_REMOTE_SYNC_ENABLED=1 及 SSH/DB 参数）'
      });
    }
    var username = String((req.body && req.body.username) || '').trim();
    if (!username) {
      return res.status(400).json({ code: 400, msg: '请输入用户名' });
    }
    var snap = await buildLocalSnapshot(username);
    return res.json({
      code: 200,
      data: {
        target: publicTargetInfo(),
        username: username,
        real_name: snap.user.real_name || '',
        plain_password: snap.user.plain_password || '',
        account_active: snap.user.account_active,
        activation_kind: snap.user.activation_kind,
        local_id: snap.user.id,
        counts: snap.counts
      }
    });
  } catch (e) {
    var status = e.status || 500;
    return res.status(status).json({ code: status, msg: String(e.message || e) });
  }
}

async function handleAdminUserRemoteSyncPush(req, res) {
  try {
    if (!syncConfigured()) {
      return res.status(400).json({
        code: 400,
        msg: '未配置远程同步（请在 .env 设置 USER_REMOTE_SYNC_ENABLED=1 及 SSH/DB 参数）'
      });
    }
    var username = String((req.body && req.body.username) || '').trim();
    if (!username) {
      return res.status(400).json({ code: 400, msg: '请输入用户名' });
    }
    var snap = await buildLocalSnapshot(username);
    var remoteTables = await listRemoteTables();
    if (!remoteTables.users) {
      return res.status(500).json({
        code: 500,
        msg: '远程库未找到 users 表，请确认目标服务器 Docker MySQL 正常'
      });
    }
    var sql = buildImportSql(username, snap, remoteTables);
    await runRemoteSql(sql, { timeoutMs: 180000 });
    var verified = await verifyRemoteUser(username);
    return res.json({
      code: 200,
      data: {
        target: publicTargetInfo(),
        username: username,
        local_counts: snap.counts,
        remote_counts: verified.counts,
        remote_user: verified.user,
        skipped_tables: SYNC_TABLES.filter(function (s) {
          return !remoteTables[s.table];
        }).map(function (s) {
          return s.table;
        })
      }
    });
  } catch (e) {
    console.error('[user-remote-sync] push', e);
    var status = e.status || 500;
    return res.status(status).json({ code: status, msg: '同步失败：' + String(e.message || e) });
  }
}

function getHandlers() {
  return {
    handleAdminUserRemoteSyncStatus: handleAdminUserRemoteSyncStatus,
    handleAdminUserRemoteSyncPreview: handleAdminUserRemoteSyncPreview,
    handleAdminUserRemoteSyncPush: handleAdminUserRemoteSyncPush
  };
}

module.exports = {
  getHandlers: getHandlers,
  syncConfigured: syncConfigured,
  buildLocalSnapshot: buildLocalSnapshot,
  buildImportSql: buildImportSql
};
