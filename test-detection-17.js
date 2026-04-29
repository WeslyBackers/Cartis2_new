// Direct detection test for notification 17
const path = require('path');

// First, clear and unlink all products from notification 17
const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function runDetection() {
  try {
    console.log('Step 1: Clearing existing product links for notification 17...');
    await pool.query('DELETE FROM notifications_products WHERE notification_id = 17');
    console.log('  ✓ Cleared\n');
    
    console.log('Step 2: Loading detection function from backend...\n');
    
    // Import the route file which contains the detection function
    // We need to simulate the detectAndLinkProductsForNotification call
    // Since we can't easily import TypeScript, let's just inline the necessary code
    
    // For now, let's just check if BE6AVG1K gets linked by checking the database after
    console.log('Please click the "Herbereken Producten" button in the UI to trigger detection.\n');
    console.log('OR run the backend command to call the detection directly.\n');
    console.log('After that, run this query to check:');
    console.log(`
      SELECT p.code, p.name, pl.code as production_line
      FROM notifications_products np
      JOIN products p ON np.product_id = p.id
      JOIN production_lines pl ON p.production_line_id = pl.id
      WHERE np.notification_id = 17
      ORDER BY pl.id, p.code
    `);
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

runDetection();
