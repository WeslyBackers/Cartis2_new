import pool from '../config/database';

// Production line codes that get HPD projects
const HPD_LINE_PREFIXES: Record<string, string> = {
  'IENC': 'I_',
  'ZK': 'Z_',
};

/**
 * Create an HPD project for a task if the production line is IENC or ZK.
 * Called automatically when a task is created.
 */
export async function createHpdProjectForTask(taskId: number, taskNumber: string, productionLineId: number): Promise<void> {
  try {
    // Look up the production line code
    const plResult = await pool.query(
      'SELECT code FROM production_lines WHERE id = $1',
      [productionLineId]
    );
    if (plResult.rows.length === 0) return;

    const plCode = plResult.rows[0].code;
    const prefix = HPD_LINE_PREFIXES[plCode];
    if (!prefix) return; // Not an HPD-eligible production line

    const projectCode = `${prefix}${taskNumber}`;

    await pool.query(
      `INSERT INTO hpd_projects (task_id, production_line_id, project_code, status)
       VALUES ($1, $2, $3, 'under_construction')
       ON CONFLICT (task_id, production_line_id) DO NOTHING`,
      [taskId, productionLineId, projectCode]
    );

    console.log(`[HPD] Created project ${projectCode} for task ${taskNumber} (line: ${plCode})`);
  } catch (error) {
    console.error(`[HPD] Error creating project for task ${taskId}:`, error);
    // Non-fatal: don't break task creation if HPD project creation fails
  }
}

/**
 * Update HPD project status to match the task's production line status.
 * Called when a production line status is updated.
 */
export async function syncHpdProjectStatus(taskId: number, productionLineId: number, status: string): Promise<void> {
  try {
    const result = await pool.query(
      `UPDATE hpd_projects
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE task_id = $2 AND production_line_id = $3
       RETURNING project_code`,
      [status, taskId, productionLineId]
    );

    if (result.rows.length > 0) {
      console.log(`[HPD] Updated project ${result.rows[0].project_code} status to ${status}`);
    }
  } catch (error) {
    console.error(`[HPD] Error syncing project status for task ${taskId}:`, error);
  }
}

/**
 * Get HPD projects for a task.
 */
export async function getHpdProjectsForTask(taskId: number): Promise<any[]> {
  const result = await pool.query(
    `SELECT hp.*, pl.code as production_line_code, pl.name as production_line_name
     FROM hpd_projects hp
     JOIN production_lines pl ON hp.production_line_id = pl.id
     WHERE hp.task_id = $1
     ORDER BY hp.project_code`,
    [taskId]
  );
  return result.rows;
}
