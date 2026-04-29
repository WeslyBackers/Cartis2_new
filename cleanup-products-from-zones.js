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

async function cleanupProductsFromZones() {
  const client = await pool.connect();
  
  try {
    console.log('=== CLEANING UP PRODUCTS FROM NOTIFICATION_ZONES ===\n');
    
    // First, identify all products in notification_zones
    console.log('1. Finding products incorrectly stored as zones:');
    const productsAsZones = await client.query(`
      SELECT 
        nz.notification_id,
        nz.kml_coverage_id,
        nz.zone_code,
        c.name,
        f.filename,
        f.category
      FROM notification_zones nz
      JOIN kml_coverages c ON nz.kml_coverage_id = c.id
      JOIN kml_files f ON c.kml_file_id = f.id
      WHERE f.category = 'products'
      ORDER BY nz.notification_id, nz.zone_code
    `);
    
    console.log(`Found ${productsAsZones.rows.length} products incorrectly stored as zones:`);
    
    // Group by notification
    const byNotification = {};
    productsAsZones.rows.forEach(row => {
      if (!byNotification[row.notification_id]) {
        byNotification[row.notification_id] = [];
      }
      byNotification[row.notification_id].push(row);
    });
    
    Object.keys(byNotification).forEach(notifId => {
      console.log(`\n  Notification ${notifId}:`);
      byNotification[notifId].forEach(row => {
        console.log(`    - ${row.zone_code} (${row.filename})`);
      });
    });
    
    console.log('\n');
    
    // Delete products from notification_zones
    console.log('2. Deleting products from notification_zones:');
    const deleteResult = await client.query(`
      DELETE FROM notification_zones nz
      USING kml_coverages c, kml_files f
      WHERE nz.kml_coverage_id = c.id
        AND c.kml_file_id = f.id
        AND f.category = 'products'
    `);
    
    console.log(`  ✓ Deleted ${deleteResult.rowCount} product entries from notification_zones`);
    console.log('');
    
    // Show remaining zones
    console.log('3. Remaining zones by notification:');
    const remainingZones = await client.query(`
      SELECT 
        nz.notification_id,
        COUNT(*) as zone_count,
        array_agg(nz.zone_code) as zone_codes
      FROM notification_zones nz
      JOIN kml_coverages c ON nz.kml_coverage_id = c.id
      JOIN kml_files f ON c.kml_file_id = f.id
      WHERE f.category = 'zones'
      GROUP BY nz.notification_id
      ORDER BY nz.notification_id
    `);
    
    console.log(`Notifications with zones:`);
    remainingZones.rows.forEach(row => {
      console.log(`  Notification ${row.notification_id}: ${row.zone_count} zones`);
      console.log(`    Codes: ${row.zone_codes.join(', ')}`);
    });
    
    console.log('');
    console.log('✓ Cleanup completed!');
    console.log('');
    console.log('Next steps:');
    console.log('- Products are now removed from notification_zones');
    console.log('- Only actual zones remain');
    console.log('- Automatic zone detection will continue to work correctly');
    console.log('- Products are stored separately in the notifications_products table');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupProductsFromZones()
  .then(() => {
    console.log('\n✓ Process completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Process failed:', error);
    process.exit(1);
  });
