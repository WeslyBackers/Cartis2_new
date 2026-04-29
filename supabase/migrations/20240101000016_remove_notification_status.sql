-- Remove legacy status column from notifications
ALTER TABLE notifications
DROP COLUMN IF EXISTS status;
