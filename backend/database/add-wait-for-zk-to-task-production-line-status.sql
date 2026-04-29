-- Add wait_for_zk flag to support IENC waiting for ZK completion
ALTER TABLE task_production_line_status
ADD COLUMN IF NOT EXISTS wait_for_zk BOOLEAN NOT NULL DEFAULT FALSE;
