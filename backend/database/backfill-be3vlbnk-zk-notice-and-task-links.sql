-- Backfill BE3VLBNK links for ZK into task_products based on existing notice links.
-- Run after BE3VLBNK exists in ZK and notification detection has linked it in notifications_products.

WITH zk_product AS (
  SELECT p.id AS product_id
  FROM products p
  JOIN production_lines pl ON pl.id = p.production_line_id
  WHERE pl.code = 'ZK' AND p.code = 'BE3VLBNK'
  LIMIT 1
),
candidate_tasks AS (
  SELECT DISTINCT t.id AS task_id, zp.product_id
  FROM zk_product zp
  JOIN notifications_products np ON np.product_id = zp.product_id AND np.is_relevant = true
  JOIN task_notifications tn ON tn.notification_id = np.notification_id
  JOIN tasks t ON t.id = tn.task_id
  JOIN products p ON p.id = zp.product_id
  WHERE t.production_line_id = p.production_line_id
     OR EXISTS (
       SELECT 1
       FROM task_production_line_status tpls
       WHERE tpls.task_id = t.id
         AND tpls.production_line_id = p.production_line_id
     )
)
INSERT INTO task_products (task_id, product_id, status, created_at, updated_at)
SELECT ct.task_id, ct.product_id, 'hoog_te_verwerken', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM candidate_tasks ct
ON CONFLICT (task_id, product_id) DO NOTHING;
