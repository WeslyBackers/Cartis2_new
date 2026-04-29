-- Enable PostGIS extension for spatial queries
-- This is needed for product-notification geometry intersection queries

CREATE EXTENSION IF NOT EXISTS postgis;

-- Function to check if two GeoJSON geometries intersect
-- This is used to automatically detect which products are affected by a notification
CREATE OR REPLACE FUNCTION geojson_intersects(geojson1 TEXT, geojson2 TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF geojson1 IS NULL OR geojson2 IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN ST_Intersects(
    ST_GeomFromGeoJSON(geojson1),
    ST_GeomFromGeoJSON(geojson2)
  );
EXCEPTION WHEN OTHERS THEN
  -- If there's any error parsing or comparing geometries, return FALSE
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


COMMENT ON FUNCTION geojson_intersects IS 'Check if two GeoJSON geometries intersect';
