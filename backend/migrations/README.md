# Database migrations

阶段 1 引入的轻量 SQL 迁移目录。

## 约定

1. 文件名：`NNN_description.sql`（三位序号，按名字排序执行）。
2. 运行时机：`initDatabase` → `createTables`（历史建表/ALTER）之后，由 `src/shared/migrate.js` 执行。
3. **冻结**：不要再往 `legacy/monolith.js` 的 `createTables` / `initDatabase` 里追加新的业务 `ALTER`；新 schema 变更只加本目录文件。
4. 已执行记录表：`schema_migrations`。

## 空迁移 / 占位

若文件以 `-- noop` 开头，runner 只记账不执行正文（用于引导或文档性占位）。
