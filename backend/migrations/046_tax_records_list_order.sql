ALTER TABLE tax_records
  ADD COLUMN list_order INT NOT NULL DEFAULT 0 COMMENT '同月列表顺序，越小越靠上';
