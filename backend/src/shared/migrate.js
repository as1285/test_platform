/**
 * 轻量 SQL 迁移运行器。
 * - 扫描 backend/migrations/*.sql（按文件名排序）
 * - 已执行记录写入 schema_migrations
 * - 阶段 1：createTables / initDatabase 仍负责建表与历史 ALTER；此后新增 schema 变更只走本目录
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

/** 辅助函数：ensureMigrationsTable */
async function ensureMigrationsTable(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/** 辅助函数：listMigrationFiles */
function listMigrationFiles() {
  var dir = config.MIGRATIONS_DIR;
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter(function (name) {
      return /\.sql$/i.test(name);
    })
    .sort();
}

/** 执行：Migrations */
async function runMigrations(pool) {
  if (!pool) {
    throw new Error('runMigrations requires a pool');
  }
  var conn = await pool.getConnection();
  var applied = [];
  try {
    await ensureMigrationsTable(conn);
    var [rows] = await conn.execute('SELECT name FROM schema_migrations');
    var done = Object.create(null);
    for (var i = 0; i < rows.length; i++) {
      done[rows[i].name] = 1;
    }
    var files = listMigrationFiles();
    for (var j = 0; j < files.length; j++) {
      var name = files[j];
      if (done[name]) continue;
      var full = path.join(config.MIGRATIONS_DIR, name);
      var sql = fs.readFileSync(full, 'utf8').trim();
      if (!sql || sql.indexOf('-- noop') === 0) {
        await conn.execute('INSERT INTO schema_migrations (name) VALUES (?)', [name]);
        applied.push(name);
        console.log('[migrate] recorded noop ' + name);
        continue;
      }
      // 简单按分号拆分；单语句迁移优先。复杂脚本可后续换 knex/prisma。
      var parts = sql
        .split(/;\s*\n/)
        .map(function (s) {
          return s
            .replace(/^\s*--[^\n]*\n/gm, '')
            .trim();
        })
        .filter(function (s) {
          return s && !/^--/.test(s);
        });
      await conn.beginTransaction();
      try {
        for (var k = 0; k < parts.length; k++) {
          var stmt = parts[k];
          if (!/;$/.test(stmt)) stmt += ';';
          await conn.query(stmt);
        }
        await conn.execute('INSERT INTO schema_migrations (name) VALUES (?)', [name]);
        await conn.commit();
        applied.push(name);
        console.log('[migrate] applied ' + name);
      } catch (e) {
        await conn.rollback();
        throw e;
      }
    }
    if (!applied.length) {
      console.log('[migrate] up to date (' + files.length + ' files)');
    }
    return { applied: applied, total: files.length };
  } finally {
    conn.release();
  }
}

module.exports = {
  runMigrations,
  listMigrationFiles,
  ensureMigrationsTable
};
