-- Create task_comments table for comments per task
CREATE TABLE IF NOT EXISTS task_comments (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    production_line_id INTEGER REFERENCES production_lines(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_production_line ON task_comments(production_line_id);

-- Create task_workflow table for production line specific workflow steps
CREATE TABLE IF NOT EXISTS task_workflow (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    production_line_id INTEGER REFERENCES production_lines(id) ON DELETE CASCADE,
    workflow_content TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_workflow_task ON task_workflow(task_id);
CREATE INDEX IF NOT EXISTS idx_task_workflow_production_line ON task_workflow(production_line_id);

-- Add unique constraint to ensure one workflow per task per production line
ALTER TABLE task_workflow 
DROP CONSTRAINT IF EXISTS task_workflow_unique;

ALTER TABLE task_workflow 
ADD CONSTRAINT task_workflow_unique 
UNIQUE (task_id, production_line_id);
