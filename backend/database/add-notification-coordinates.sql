-- Add notification_coordinates table for storing additional coordinates

CREATE TABLE notification_coordinates (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    label VARCHAR(255),
    description TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_coordinates_notification ON notification_coordinates(notification_id);

COMMENT ON TABLE notification_coordinates IS 'Additional coordinates for notifications beyond the main geometry';
COMMENT ON COLUMN notification_coordinates.latitude IS 'Latitude in decimal degrees';
COMMENT ON COLUMN notification_coordinates.longitude IS 'Longitude in decimal degrees';
COMMENT ON COLUMN notification_coordinates.label IS 'Optional label for the coordinate point';
COMMENT ON COLUMN notification_coordinates.description IS 'Optional description of the coordinate point';
