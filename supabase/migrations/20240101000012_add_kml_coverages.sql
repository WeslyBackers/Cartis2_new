-- KML Coverage Tables for CARTIS 2.0

-- KML Files metadata table
CREATE TABLE IF NOT EXISTS kml_files (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    filepath VARCHAR(500) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'products' or 'zones'
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    production_line_id INTEGER REFERENCES production_lines(id),
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- KML Coverage geometries table
CREATE TABLE IF NOT EXISTS kml_coverages (
    id SERIAL PRIMARY KEY,
    kml_file_id INTEGER REFERENCES kml_files(id) ON DELETE CASCADE,
    code VARCHAR(100) NOT NULL, -- Product code or zone code (e.g., BE3VLBNK, BELGIË)
    name VARCHAR(500) NOT NULL, -- Full name from OBJNAM
    geometry_type VARCHAR(20) NOT NULL, -- 'Point', 'Polygon', 'MultiPolygon', etc.
    geometry TEXT NOT NULL, -- GeoJSON format for easy use with mapping libraries
    style_url VARCHAR(100), -- Reference to KML style
    properties JSONB, -- Additional properties from KML
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_kml_files_category ON kml_files(category);
CREATE INDEX IF NOT EXISTS idx_kml_files_production_line ON kml_files(production_line_id);
CREATE INDEX IF NOT EXISTS idx_kml_coverages_file ON kml_coverages(kml_file_id);
CREATE INDEX IF NOT EXISTS idx_kml_coverages_code ON kml_coverages(code);
CREATE INDEX IF NOT EXISTS idx_kml_coverages_type ON kml_coverages(geometry_type);

-- Comments for documentation
COMMENT ON TABLE kml_files IS 'Metadata about imported KML files (products coverage and communication zones)';
COMMENT ON TABLE kml_coverages IS 'Individual coverage geometries extracted from KML files';
COMMENT ON COLUMN kml_files.category IS 'Category: products (chart coverages) or zones (communication zones)';
COMMENT ON COLUMN kml_coverages.geometry IS 'Geometry stored as GeoJSON for easy integration with mapping libraries';
COMMENT ON COLUMN kml_coverages.properties IS 'Additional KML properties and metadata stored as JSON';
