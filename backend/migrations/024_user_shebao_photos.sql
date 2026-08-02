CREATE TABLE IF NOT EXISTS user_shebao_photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL COMMENT '账号 username',
  image_path VARCHAR(512) NOT NULL COMMENT '私有存储相对路径 private/shebao/...',
  original_name VARCHAR(255) NULL COMMENT '原始文件名',
  file_size INT UNSIGNED NULL COMMENT '字节',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_shebao_username_created (username, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
