-- Add Notification-Zone relationship tables

-- Table to link notifications with detected zones
CREATE TABLE IF NOT EXISTS notification_zones (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    kml_coverage_id INTEGER REFERENCES kml_coverages(id) ON DELETE CASCADE,
    zone_code VARCHAR(100) NOT NULL,
    zone_name VARCHAR(500) NOT NULL,
    detection_method VARCHAR(50) DEFAULT 'automatic', -- 'automatic', 'manual'
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(notification_id, kml_coverage_id)
);

-- Index for better performance
CREATE INDEX IF NOT EXISTS idx_notification_zones_notification ON notification_zones(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_zones_code ON notification_zones(zone_code);

-- Comments
COMMENT ON TABLE notification_zones IS 'Links notifications to affected geographic zones based on coordinate matching';
COMMENT ON COLUMN notification_zones.detection_method IS 'How the zone was detected: automatic (via coordinate matching) or manual (user added)';
