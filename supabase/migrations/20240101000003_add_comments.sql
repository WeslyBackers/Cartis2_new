-- Create notification_comments table for multiple comments per notification
CREATE TABLE IF NOT EXISTS notification_comments (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    production_line_id INTEGER REFERENCES production_lines(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_comments_notification ON notification_comments(notification_id);
CREATE INDEX idx_notification_comments_production_line ON notification_comments(production_line_id);
