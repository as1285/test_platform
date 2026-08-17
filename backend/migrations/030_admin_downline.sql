ALTER TABLE admin_accounts
  ADD COLUMN parent_admin_username VARCHAR(255) NULL
    COMMENT '上级管理员账号（子管理员的下线归属）' AFTER full_name;

ALTER TABLE admin_accounts
  ADD INDEX idx_admin_parent (parent_admin_username);

INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
SELECT id, 'downline-admins' FROM admin_accounts WHERE is_super = 0;
