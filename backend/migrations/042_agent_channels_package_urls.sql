-- 代理专属渠道：每渠道独立 Android APK / iOS mobileconfig
ALTER TABLE agent_channels
  ADD COLUMN android_apk_url VARCHAR(2048) NULL COMMENT '渠道专用 APK（uploads/… 或 https）' AFTER note,
  ADD COLUMN ios_mobileconfig_url VARCHAR(2048) NULL COMMENT '渠道专用 mobileconfig（uploads/… 或 https）' AFTER android_apk_url;
