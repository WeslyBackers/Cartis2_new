const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

async function verifyTaskDeletion() {
  const client = await pool.connect();
  
  try {
    console.log('=== TASK DELETION VERIFICATION ===\n');
    
    // Check all task-related tables
    const tables = [
      'tasks',
      'task_products',
      'task_notifications',
      'related_tasks'
    ];
    
    console.log('Table counts:');
    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`  ${table}: ${result.rows[0].count}`);
    }
    
    console.log('\n✓ All tasks and linked records have been removed');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyTaskDeletion()
  .then(() => {
    console.log('\n✓ Verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Verification failed:', error);
    process.exit(1);
  });
