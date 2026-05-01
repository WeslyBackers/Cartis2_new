-- Table for storing manual information request emails sent from notification detail
CREATE TABLE IF NOT EXISTS notification_info_requests (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  recipient VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_info_requests_notification
  ON notification_info_requests(notification_id);

CREATE INDEX IF NOT EXISTS idx_notification_info_requests_created_by
  ON notification_info_requests(created_by);