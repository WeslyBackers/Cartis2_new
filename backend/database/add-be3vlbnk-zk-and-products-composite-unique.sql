-- Ensure products are unique per production line (not globally by code)
ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_code_key;

ALTER TABLE products
ADD CONSTRAINT products_production_line_code_key UNIQUE (production_line_id, code);

-- Ensure ZK has BE3VLBNK based on the Pilot ENC geometry
INSERT INTO products (
  production_line_id,
  code,
  name,
  type,
  description,
  geometry,
  is_active,
  created_at,
  updated_at
)
SELECT
  zk.id,
  src.code,
  'ENC Vlaamse Banken - Usage 3',
  src.type,
  src.description,
  src.geometry,
  src.is_active,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM products src
JOIN production_lines src_pl ON src_pl.id = src.production_line_id
JOIN production_lines zk ON zk.code = 'ZK'
WHERE src.code = 'BE3VLBNK'
  AND src_pl.code = 'PILOT_ENC'
ON CONFLICT (production_line_id, code)
DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  geometry = EXCLUDED.geometry,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP;
