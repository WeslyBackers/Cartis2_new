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

async function verifyNotification22() {
  const client = await pool.connect();
  
  try {
    console.log('=== VERIFYING NOTIFICATION 22 ZONES ===\n');
    
    // Get zones for notification 22
    const zones = await client.query(`
      SELECT 
        nz.zone_code,
        nz.zone_name,
        nz.detection_method,
        c.code,
        f.category,
        f.filename
      FROM notification_zones nz
      JOIN kml_coverages c ON nz.kml_coverage_id = c.id
      JOIN kml_files f ON c.kml_file_id = f.id
      WHERE nz.notification_id = 22
      ORDER BY nz.zone_code
    `);
    
    console.log(`Notification 22 has ${zones.rows.length} zones:\n`);
    
    let hasProducts = false;
    zones.rows.forEach(row => {
      const marker = row.category === 'zones' ? '✓' : '✗';
      console.log(`${marker} ${row.zone_code} - ${row.zone_name}`);
      console.log(`  Category: ${row.category}, File: ${row.filename}`);
      console.log(`  Detection: ${row.detection_method}\n`);
      
      if (row.category !== 'zones') {
        hasProducts = true;
      }
    });
    
    if (hasProducts) {
      console.log('⚠️  WARNING: Notification 22 still has products in zones table!');
    } else {
      console.log('✓ SUCCESS: All zones are actual zones (no products)');
    }
    
    console.log('\n');
    
    // Check if products exist in notifications_products
    const products = await client.query(`
      SELECT COUNT(*) as product_count
      FROM notifications_products
      WHERE notification_id = 22
    `);
    
    console.log(`Notification 22 has ${products.rows[0].product_count} products in notifications_products table`);
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyNotification22()
  .then(() => {
    console.log('\n✓ Verification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Verification failed:', error);
    process.exit(1);
  });
