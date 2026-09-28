-- 所有子管理员开通激活码权限（发码/列码 API 认 codes，不能只靠运营看板别名）
INSERT IGNORE INTO admin_account_menus (admin_id, menu_key)
SELECT id, 'codes' FROM admin_accounts WHERE is_super = 0;
