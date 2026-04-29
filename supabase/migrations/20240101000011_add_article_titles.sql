-- Add title columns to task_articles
ALTER TABLE task_articles ADD COLUMN IF NOT EXISTS title_nl VARCHAR(255);
ALTER TABLE task_articles ADD COLUMN IF NOT EXISTS title_en VARCHAR(255);
