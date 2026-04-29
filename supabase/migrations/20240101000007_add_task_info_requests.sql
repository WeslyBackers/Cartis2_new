-- Task Info Requests (opgeslagen verzoeken om meer informatie)
CREATE TABLE IF NOT EXISTS task_info_requests (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_info_requests_task ON task_info_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_task_info_requests_created_by ON task_info_requests(created_by);
