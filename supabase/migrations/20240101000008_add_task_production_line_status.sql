-- Create task_production_line_status table to track task status per production line
CREATE TABLE IF NOT EXISTS task_production_line_status (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    production_line_id INTEGER NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'under_construction',
    wait_for_zk BOOLEAN NOT NULL DEFAULT FALSE,
    -- Status options: 'under_construction', 'completed', 'rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, production_line_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_task_pl_status_task ON task_production_line_status(task_id);
CREATE INDEX IF NOT EXISTS idx_task_pl_status_production_line ON task_production_line_status(production_line_id);
CREATE INDEX IF NOT EXISTS idx_task_pl_status_status ON task_production_line_status(status);

COMMENT ON TABLE task_production_line_status IS 'Tracks the status of a task for each production line involved';
COMMENT ON COLUMN task_production_line_status.status IS 'Status: under_construction (initial), completed, rejected';
