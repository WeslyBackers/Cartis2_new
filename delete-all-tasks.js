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

async function deleteAllTasks() {
  const client = await pool.connect();
  
  try {
    console.log('Starting task deletion...\n');
    
    // Get counts before deletion
    const taskCount = await client.query('SELECT COUNT(*) FROM tasks');
    const taskProductsCount = await client.query('SELECT COUNT(*) FROM task_products');
    const taskNotificationsCount = await client.query('SELECT COUNT(*) FROM task_notifications');
    const relatedTasksCount = await client.query('SELECT COUNT(*) FROM related_tasks');
    
    console.log('Current counts:');
    console.log(`- Tasks: ${taskCount.rows[0].count}`);
    console.log(`- Task Products: ${taskProductsCount.rows[0].count}`);
    console.log(`- Task Notifications: ${taskNotificationsCount.rows[0].count}`);
    console.log(`- Related Tasks: ${relatedTasksCount.rows[0].count}`);
    console.log('');
    
    // Delete all tasks (CASCADE will handle linked records)
    await client.query('DELETE FROM tasks');
    
    console.log('✓ All tasks deleted successfully');
    console.log('✓ Linked records automatically removed via CASCADE\n');
    
    // Verify deletion
    const finalTaskCount = await client.query('SELECT COUNT(*) FROM tasks');
    const finalTaskProductsCount = await client.query('SELECT COUNT(*) FROM task_products');
    const finalTaskNotificationsCount = await client.query('SELECT COUNT(*) FROM task_notifications');
    const finalRelatedTasksCount = await client.query('SELECT COUNT(*) FROM related_tasks');
    
    console.log('Final counts:');
    console.log(`- Tasks: ${finalTaskCount.rows[0].count}`);
    console.log(`- Task Products: ${finalTaskProductsCount.rows[0].count}`);
    console.log(`- Task Notifications: ${finalTaskNotificationsCount.rows[0].count}`);
    console.log(`- Related Tasks: ${finalRelatedTasksCount.rows[0].count}`);
    
  } catch (error) {
    console.error('Error deleting tasks:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

deleteAllTasks()
  .then(() => {
    console.log('\n✓ Task deletion completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Task deletion failed:', error);
    process.exit(1);
  });
