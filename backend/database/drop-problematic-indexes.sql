-- Drop GIST indexes that were causing "invalid GeoJson representation" errors
-- These indexes tried to convert FeatureCollections to PostGIS geometry types,
-- which is not supported. FeatureCollections are valid GeoJSON but not valid geometry objects.

DROP INDEX IF EXISTS idx_products_geometry;
DROP INDEX IF EXISTS idx_notifications_geometry;
