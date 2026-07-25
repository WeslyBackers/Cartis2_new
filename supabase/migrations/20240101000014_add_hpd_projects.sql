-- HPD Projects table
-- These projects are linked to tasks and will eventually sync to an Oracle database.
-- project_code_I: Inland ENC (IENC) project code = 'I_' + task_number. Always set.
-- project_code_Z: Zeekaarten (ZK) project code = 'Z_' + task_number. Only set for rows
--                 belonging to the ZK production line.
CREATE TABLE IF NOT EXISTS hpd_projects (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    production_line_id INTEGER NOT NULL REFERENCES production_lines(id) ON DELETE CASCADE,
    project_code_I VARCHAR(50) NOT NULL,
    project_code_Z VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'under_construction',
    -- Status mirrors task production line status: 'under_construction', 'completed', 'rejected'
    synced_to_oracle BOOLEAN DEFAULT false,
    oracle_sync_date TIMESTAMP,
    oracle_sync_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, production_line_id)
);

CREATE INDEX IF NOT EXISTS idx_hpd_projects_task_id ON hpd_projects(task_id);
CREATE INDEX IF NOT EXISTS idx_hpd_projects_project_code_i ON hpd_projects(project_code_I);
CREATE INDEX IF NOT EXISTS idx_hpd_projects_project_code_z ON hpd_projects(project_code_Z);

