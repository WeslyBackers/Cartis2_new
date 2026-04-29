-- Add geometry column to notification_coordinates table
-- This allows storing complex geometries (LineString, Polygon) in addition to simple point coordinates

ALTER TABLE notification_coordinates 
ADD COLUMN IF NOT EXISTS geometry TEXT;

-- Make latitude and longitude nullable since we might have only geometry
ALTER TABLE notification_coordinates 
ALTER COLUMN latitude DROP NOT NULL,
ALTER COLUMN longitude DROP NOT NULL;

COMMENT ON COLUMN notification_coordinates.geometry IS 'GeoJSON geometry for complex shapes (LineString, Polygon, etc.)';

-- Update existing records to ensure they have valid data
-- For records with lat/lon but no geometry, latitude and longitude remain as is
-- For records with geometry but lat/lon = 0, those are already correct
