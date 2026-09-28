-- 开通类订单已退款后，清掉仍挂着的 trial/permanent，避免 C 端继续视为已开通。
-- 若该账号在最后一笔开通退款之后又有已支付开通单，则视为复购，不动。
UPDATE users u
INNER JOIN (
  SELECT po.username COLLATE utf8mb4_unicode_ci AS username, MAX(po.id) AS last_refund_id
  FROM payment_orders po
  WHERE po.status = 'refunded'
    AND IFNULL(po.grant_kind, '') NOT IN (
      'lizhi_cert', 'zaizhi_cert', 'tax_edit_daily', 'tax_edit_single',
      'tax_edit_unlimited', 'rename_credit', 'sbdy_demo', 'najilu_qr'
    )
    AND IFNULL(po.sku_id, '') NOT LIKE 'sku_rename%'
    AND IFNULL(po.sku_id, '') NOT LIKE 'sku_lizhi%'
    AND IFNULL(po.sku_id, '') NOT LIKE 'sku_zaizhi%'
    AND IFNULL(po.sku_id, '') NOT LIKE 'sku_najilu%'
    AND IFNULL(po.sku_id, '') NOT LIKE 'sku_tax_edit%'
    AND IFNULL(po.sku_id, '') NOT LIKE 'sku_sbdy%'
  GROUP BY po.username COLLATE utf8mb4_unicode_ci
) rf ON rf.username = u.username COLLATE utf8mb4_unicode_ci
LEFT JOIN payment_orders later
  ON later.username COLLATE utf8mb4_unicode_ci = u.username COLLATE utf8mb4_unicode_ci
 AND later.status = 'paid'
 AND later.id > rf.last_refund_id
 AND IFNULL(later.grant_kind, '') NOT IN (
      'lizhi_cert', 'zaizhi_cert', 'tax_edit_daily', 'tax_edit_single',
      'tax_edit_unlimited', 'rename_credit', 'sbdy_demo', 'najilu_qr'
    )
 AND IFNULL(later.sku_id, '') NOT LIKE 'sku_rename%'
 AND IFNULL(later.sku_id, '') NOT LIKE 'sku_lizhi%'
 AND IFNULL(later.sku_id, '') NOT LIKE 'sku_zaizhi%'
 AND IFNULL(later.sku_id, '') NOT LIKE 'sku_najilu%'
 AND IFNULL(later.sku_id, '') NOT LIKE 'sku_tax_edit%'
 AND IFNULL(later.sku_id, '') NOT LIKE 'sku_sbdy%'
SET
  u.account_active = 0,
  u.activation_kind = 'none',
  u.active_until = NULL,
  u.session_rev = u.session_rev + 1,
  u.activation_refunded_at = IFNULL(u.activation_refunded_at, UTC_TIMESTAMP()),
  u.activation_refunded_by = IFNULL(NULLIF(TRIM(u.activation_refunded_by), ''), 'alipay_refund_backfill')
WHERE later.id IS NULL
  AND (
    u.account_active = 1
    OR IFNULL(u.activation_kind, '') IN ('trial', 'permanent')
  );
