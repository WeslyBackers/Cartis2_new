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

async function checkTaskNotifications() {
  const client = await pool.connect();
  
  try {
    console.log('Checking task_notifications table...\n');
    
    // Get sample task_notification records
    const result = await client.query(`
      SELECT tn.*, t.id as task_exists, n.id as notification_exists
      FROM task_notifications tn
      LEFT JOIN tasks t ON tn.task_id = t.id
      LEFT JOIN notifications n ON tn.notification_id = n.id
      LIMIT 10
    `);
    
    console.log(`Found ${result.rows.length} task_notification records (showing first 10):`);
    result.rows.forEach(row => {
      console.log(`- ID: ${row.id}, Task ID: ${row.task_id} (exists: ${row.task_exists ? 'YES' : 'NO'}), Notification ID: ${row.notification_id} (exists: ${row.notification_exists ? 'YES' : 'NO'})`);
    });
    
    // Clean up orphaned records
    console.log('\nCleaning up orphaned task_notification records...');
    const deleteResult = await client.query(`
      DELETE FROM task_notifications
      WHERE task_id NOT IN (SELECT id FROM tasks)
    `);
    
    console.log(`✓ Deleted ${deleteResult.rowCount} orphaned records`);
    
    // Final count
    const finalCount = await client.query('SELECT COUNT(*) FROM task_notifications');
    console.log(`\nFinal task_notifications count: ${finalCount.rows[0].count}`);
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkTaskNotifications()
  .then(() => {
    console.log('\n✓ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Check failed:', error);
    process.exit(1);
  });
