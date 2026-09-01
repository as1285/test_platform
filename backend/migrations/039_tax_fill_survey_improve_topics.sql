-- 支持多选不满意点：逗号分隔存储（如 paste,manual）
ALTER TABLE tax_fill_survey
  MODIFY COLUMN improve_topic VARCHAR(128) NULL
    COMMENT '逗号分隔：start|paste|manual|generate|list|calc|other';
