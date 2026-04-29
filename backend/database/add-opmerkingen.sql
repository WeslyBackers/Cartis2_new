-- Add opmerkingen field to notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS opmerkingen TEXT;

COMMENT ON COLUMN notifications.opmerkingen IS 'General remarks/comments for the notification';
