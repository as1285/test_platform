ALTER TABLE users
  ADD COLUMN activation_credit_amount DECIMAL(10,2) NULL
    COMMENT '管理端填写的激活收款金额，admin 非支付宝开通按此计入支付分析'
    AFTER activation_cancelled_by;
