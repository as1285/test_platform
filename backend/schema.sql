-- 创建数据库
CREATE DATABASE IF NOT EXISTS personal_tax CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE personal_tax;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    salt VARCHAR(255) NOT NULL,
    hash VARCHAR(255) NOT NULL,
    real_name VARCHAR(255),
    tax_id VARCHAR(255),
    employer_count INT DEFAULT 0,
    family_count INT DEFAULT 0,
    bank_card_count INT DEFAULT 0,
    gender INT DEFAULT 1,
    watermark_enabled BOOLEAN DEFAULT FALSE,
    account_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=已激活，新注册由程序写入0',
    banned TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=封禁',
    user_type TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=普通 1=测试',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 任职受雇表
CREATE TABLE IF NOT EXISTS employers (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    credit_code VARCHAR(255),
    position VARCHAR(255),
    hire_date VARCHAR(255),
    leave_date VARCHAR(255),
    status VARCHAR(255) DEFAULT '1',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 税务记录表
CREATE TABLE IF NOT EXISTS tax_records (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    year INT,
    month INT,
    income_type VARCHAR(255) DEFAULT '工资薪金',
    income_subtype VARCHAR(255) DEFAULT '正常工资薪金',
    company_name VARCHAR(255),
    company_tax_id VARCHAR(255),
    tax_authority VARCHAR(255),
    report_channel VARCHAR(255) DEFAULT '其他',
    report_date VARCHAR(255),
    tax_period VARCHAR(255),
    income DECIMAL(20, 2) DEFAULT 0,
    tax_reported DECIMAL(20, 2) DEFAULT 0,
    income_this_period DECIMAL(20, 2) DEFAULT 0,
    tax_free_income DECIMAL(20, 2) DEFAULT 0,
    deduction_fee DECIMAL(20, 2) DEFAULT 5000,
    special_deduction DECIMAL(20, 2) DEFAULT 0,
    other_deduction DECIMAL(20, 2) DEFAULT 0,
    donation_deduction DECIMAL(20, 2) DEFAULT 0,
    pension_insurance DECIMAL(20, 2) DEFAULT 0,
    medical_insurance DECIMAL(20, 2) DEFAULT 0,
    unemployment_insurance DECIMAL(20, 2) DEFAULT 0,
    housing_fund DECIMAL(20, 2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_year (year),
    INDEX idx_year_month (year, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 消息表（个人中心消息管理）
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    content TEXT,
    company_name VARCHAR(255),
    msg_date VARCHAR(50),
    is_read TINYINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_msg_date (msg_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 全局配置（如测试账号固定公司名称，管理后台可改）
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
    setting_value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 激活码（管理员发放，注册用户使用 action=activate 兑换）
CREATE TABLE IF NOT EXISTS activation_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) NOT NULL,
    max_uses INT NOT NULL DEFAULT 1,
    used_count INT NOT NULL DEFAULT 0,
    expires_at DATETIME NULL,
    note VARCHAR(255) NULL,
    last_used_at DATETIME NULL COMMENT '最近一次使用时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_activation_code (code),
    INDEX idx_activation_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 接口调用按日聚合（埋点）
CREATE TABLE IF NOT EXISTS analytics_api_daily (
    stat_date DATE NOT NULL,
    route_key VARCHAR(240) NOT NULL,
    biz_category VARCHAR(64) NOT NULL,
    cnt BIGINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (stat_date, route_key),
    INDEX idx_cat_date (biz_category, stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户日活：当日至少登录或调用过一次需登录接口的账号
CREATE TABLE IF NOT EXISTS user_daily_activity (
    activity_date DATE NOT NULL,
    username VARCHAR(255) NOT NULL,
    PRIMARY KEY (activity_date, username),
    INDEX idx_u_d (username, activity_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 登录流水（成功 / 失败）
CREATE TABLE IF NOT EXISTS user_login_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    ok TINYINT(1) NOT NULL DEFAULT 1,
    ip VARCHAR(128) NULL,
    city VARCHAR(255) NULL,
    user_agent VARCHAR(512) NULL,
    device_fp CHAR(64) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created (created_at),
    INDEX idx_u_created (username, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 账号维度设备（登录 + 每次已登录接口携带 X-Client-Device 同步）
CREATE TABLE IF NOT EXISTS user_devices (
    username VARCHAR(255) NOT NULL,
    device_fp CHAR(64) NOT NULL,
    user_agent_short VARCHAR(512) NULL,
    ip_last VARCHAR(128) NULL,
    city_last VARCHAR(255) NULL,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    login_count INT UNSIGNED NOT NULL DEFAULT 0,
    client_id VARCHAR(128) NULL COMMENT '客户端上报唯一 id',
    device_detail_json MEDIUMTEXT NULL COMMENT '最近一次显式上报 JSON',
    api_sync_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '携带设备 JSON 的接口同步次数',
    PRIMARY KEY (username, device_fp),
    INDEX idx_last_seen (last_seen),
    INDEX idx_client_id (username, client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
