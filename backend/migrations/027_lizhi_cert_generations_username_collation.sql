-- Align lizhi_cert_generations.username with users.username (utf8mb4_unicode_ci)
-- so JOINs in admin stats no longer fail with Illegal mix of collations.
ALTER TABLE lizhi_cert_generations
  MODIFY username VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;
