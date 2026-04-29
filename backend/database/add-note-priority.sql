-- Add priority to dashboard notes
ALTER TABLE user_notes
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'gemiddeld';

ALTER TABLE user_notes
DROP CONSTRAINT IF EXISTS user_notes_priority_check;

ALTER TABLE user_notes
ADD CONSTRAINT user_notes_priority_check
CHECK (priority IN ('laag', 'gemiddeld', 'hoog'));

COMMENT ON COLUMN user_notes.priority IS 'Dashboard note priority: laag, gemiddeld, hoog';
