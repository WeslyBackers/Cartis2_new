-- Backfill missing task_production_line_status rows from Ja notification decisions.
-- This repairs legacy tasks linked to a production line via notification decisions
-- but missing an explicit status row in task_production_line_status.

INSERT INTO task_production_line_status (
  task_id,
  production_line_id,
  status,
  wait_for_zk,
  created_at,
  updated_at
)
SELECT DISTINCT
  tn.task_id,
  nd.production_line_id,
  'under_construction' AS status,
  CASE WHEN pl.code = 'PILOT_ENC' THEN TRUE ELSE FALSE END AS wait_for_zk,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM task_notifications tn
JOIN notification_decisions nd
  ON nd.notification_id = tn.notification_id
JOIN production_lines pl
  ON pl.id = nd.production_line_id
WHERE nd.decision = 'Ja'
  AND NOT EXISTS (
    SELECT 1
    FROM task_production_line_status tpls
    WHERE tpls.task_id = tn.task_id
      AND tpls.production_line_id = nd.production_line_id
  );
