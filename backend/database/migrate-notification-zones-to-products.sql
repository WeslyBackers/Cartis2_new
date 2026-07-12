-- Migration: Update notification_zones to reference products table instead of kml_coverages
-- This allows zones stored as products (type='zone') to be linked to notifications

-- Step 1: Add product_id column
ALTER TABLE notification_zones 
ADD COLUMN product_id INTEGER REFERENCES products(id) ON DELETE CASCADE;

-- Step 2: Make kml_coverage_id nullable (keep for backward compatibility)
ALTER TABLE notification_zones 
ALTER COLUMN kml_coverage_id DROP NOT NULL;

-- Step 3: Drop the old unique constraint
ALTER TABLE notification_zones 
DROP CONSTRAINT IF EXISTS notification_zones_notification_id_kml_coverage_id_key;

-- Step 4: Add new unique constraint that works with both columns
ALTER TABLE notification_zones 
ADD CONSTRAINT notification_zones_notification_unique 
CHECK (
  (kml_coverage_id IS NOT NULL AND product_id IS NULL) OR
  (kml_coverage_id IS NULL AND product_id IS NOT NULL)
);

-- Step 5: Add unique constraint for notification + product
CREATE UNIQUE INDEX notification_zones_notification_product_unique 
ON notification_zones(notification_id, product_id) 
WHERE product_id IS NOT NULL;

-- Step 6: Add unique constraint for notification + coverage (for backward compatibility)
CREATE UNIQUE INDEX notification_zones_notification_coverage_unique 
ON notification_zones(notification_id, kml_coverage_id) 
WHERE kml_coverage_id IS NOT NULL;

-- Add index for faster queries
CREATE INDEX idx_notification_zones_product_id ON notification_zones(product_id);

COMMENT ON COLUMN notification_zones.product_id IS 'Reference to products table for zones stored as products (type=zone)';
COMMENT ON COLUMN notification_zones.kml_coverage_id IS 'Reference to kml_coverages table for zones stored as KML coverages (legacy)';
