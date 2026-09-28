-- P1 性能：激活码归属/使用查询、用户列表软删除排序
-- 已存在同名索引时本迁移会失败；正常环境仅首次执行。

CREATE INDEX idx_activation_owner_used_last
  ON activation_codes (owner_admin_username, used_by_username, last_used_at);

CREATE INDEX idx_activation_used_by_owner
  ON activation_codes (used_by_username, owner_admin_username);

CREATE INDEX idx_users_list_hidden_id
  ON users (list_hidden_at, id);
