-- 回填注册成功事件：历史上 register_ok 被写成 ok，导致同 IP 注册风控无法标注
DROP TEMPORARY TABLE IF EXISTS tmp_register_ok_backfill;
CREATE TEMPORARY TABLE tmp_register_ok_backfill AS
SELECT first_ok.first_ok_id
FROM users u
INNER JOIN (
  SELECT username, MIN(id) AS first_ok_id
  FROM user_login_events
  WHERE ok = 1 AND reason = 'ok'
  GROUP BY username
) first_ok ON first_ok.username = u.username
INNER JOIN user_login_events e ON e.id = first_ok.first_ok_id
LEFT JOIN user_login_events existing ON existing.username = u.username AND existing.reason = 'register_ok'
WHERE existing.id IS NULL
  AND ABS(TIMESTAMPDIFF(SECOND, e.created_at, u.created_at)) <= 300;

UPDATE user_login_events ule
INNER JOIN tmp_register_ok_backfill t ON t.first_ok_id = ule.id
SET ule.reason = 'register_ok'
WHERE ule.ok = 1 AND ule.reason = 'ok';

DROP TEMPORARY TABLE IF EXISTS tmp_register_ok_backfill;
