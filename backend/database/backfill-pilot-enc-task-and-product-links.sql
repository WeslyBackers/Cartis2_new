-- Backfill PILOT_ENC links for tasks created from ZK 'Ja' decisions on notices
-- that already have PILOT_ENC products selected (is_relevant = true).
--
-- Run in order: decisions → task status → task products.


-- Step 1: Insert missing PILOT_ENC notification decisions.
-- For each notification where ZK decided 'Ja' and PILOT_ENC products are
-- selected but no PILOT_ENC decision exists yet, mirror the ZK 'Ja'.

INSERT INTO notification_decisions (
  notification_id,
  production_line_id,
  decision,
  decided_by,
  decided_at,
  notes,
  created_at,
  updated_at
)
SELECT DISTINCT
  nd_zk.notification_id,
  pl_pilot.id,
  'Ja',
  nd_zk.decided_by,
  nd_zk.decided_at,
  nd_zk.notes,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM notification_decisions nd_zk
JOIN production_lines pl_zk   ON pl_zk.id  = nd_zk.production_line_id AND pl_zk.code  = 'ZK'
JOIN production_lines pl_pilot ON pl_pilot.code = 'PILOT_ENC'
WHERE nd_zk.decision = 'Ja'
  AND EXISTS (
    SELECT 1
    FROM notifications_products np
    JOIN products p ON p.id = np.product_id
    WHERE np.notification_id  = nd_zk.notification_id
      AND np.is_relevant       = true
      AND p.production_line_id = pl_pilot.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM notification_decisions nd_pilot
    WHERE nd_pilot.notification_id  = nd_zk.notification_id
      AND nd_pilot.production_line_id = pl_pilot.id
  )
ON CONFLICT (notification_id, production_line_id) DO NOTHING;


-- Step 2: Insert missing PILOT_ENC task_production_line_status rows.
-- For every task linked (via task_notifications) to a notification with a
-- PILOT_ENC 'Ja' decision but without a PILOT_ENC status row on that task.

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
  'under_construction',
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM notification_decisions nd
JOIN production_lines pl_pilot ON pl_pilot.id = nd.production_line_id AND pl_pilot.code = 'PILOT_ENC'
JOIN task_notifications tn ON tn.notification_id = nd.notification_id
WHERE nd.decision = 'Ja'
  AND NOT EXISTS (
    SELECT 1
    FROM task_production_line_status tpls
    WHERE tpls.task_id           = tn.task_id
      AND tpls.production_line_id = nd.production_line_id
  )
ON CONFLICT (task_id, production_line_id) DO NOTHING;


-- Step 3: Insert missing PILOT_ENC products into task_products.
-- For every (task, product) pair where the task has a PILOT_ENC status row and
-- the product is linked to a notification of that task with is_relevant = true,
-- but the product is not yet in task_products for that task.

WITH candidate_pairs AS (
  SELECT DISTINCT tn.task_id, np.product_id
  FROM task_notifications tn
  JOIN notifications_products np ON np.notification_id = tn.notification_id
  JOIN products p                ON p.id = np.product_id
  JOIN production_lines pl_pilot ON pl_pilot.id = p.production_line_id AND pl_pilot.code = 'PILOT_ENC'
  WHERE np.is_relevant = true
    AND (p.is_active = true OR pl_pilot.code = 'PILOT_ENC')
    AND EXISTS (
      SELECT 1
      FROM task_production_line_status tpls
      WHERE tpls.task_id            = tn.task_id
        AND tpls.production_line_id = pl_pilot.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM task_products tp
      WHERE tp.task_id    = tn.task_id
        AND tp.product_id = np.product_id
    )
)
INSERT INTO task_products (
  task_id,
  product_id,
  product_version_id,
  status,
  created_at,
  updated_at
)
SELECT
  cp.task_id,
  cp.product_id,
  (
    SELECT id
    FROM product_versions
    WHERE product_id = cp.product_id
      AND status IN ('in behandeling', 'in inspectie', 'in_progress', 'in_inspectie', 'ready')
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  ),
  'hoog_te_verwerken',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM candidate_pairs cp
ON CONFLICT (task_id, product_id) DO NOTHING;
