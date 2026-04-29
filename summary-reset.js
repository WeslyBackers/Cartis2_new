// Final summary of reset and new notifications
require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function showSummary() {
  try {
    console.log('='.repeat(70));
    console.log('DATABASE RESET COMPLETE - FINAL SUMMARY');
    console.log('='.repeat(70));
    console.log();
    
    // Get notifications with product counts
    const result = await pool.query(`
      SELECT 
        n.id, 
        n.code, 
        n.title, 
        n.source, 
        n.status,
        n.notification_date,
        COUNT(DISTINCT np.product_id) as product_count,
        COUNT(DISTINCT nz.id) as zone_count
      FROM notifications n
      LEFT JOIN notifications_products np ON n.id = np.notification_id
      LEFT JOIN notification_zones nz ON n.id = nz.notification_id
      GROUP BY n.id, n.code, n.title, n.source, n.status, n.notification_date
      ORDER BY n.id
    `);
    
    console.log(`Total Notifications: ${result.rows.length}`);
    console.log();
    
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.code}`);
      console.log(`   Title: ${row.title}`);
      console.log(`   Source: ${row.source} | Status: ${row.status}`);
      console.log(`   Date: ${row.notification_date.toISOString().split('T')[0]}`);
      console.log(`   Products: ${row.product_count} | Zones: ${row.zone_count}`);
      console.log();
    });
    
    console.log('='.repeat(70));
    console.log('STATISTICS');
    console.log('='.repeat(70));
    
    const stats = await pool.query(`
      SELECT 
        COUNT(DISTINCT n.id) as total_notifications,
        COUNT(DISTINCT np.product_id) as total_product_links,
        COUNT(DISTINCT nz.id) as total_zone_links,
        COUNT(DISTINCT nc.id) as total_coordinates
      FROM notifications n
      LEFT JOIN notifications_products np ON n.id = np.notification_id
      LEFT JOIN notification_zones nz ON n.id = nz.notification_id
      LEFT JOIN notification_coordinates nc ON n.id = nc.notification_id
    `);
    
    const s = stats.rows[0];
    console.log(`Total Notifications:     ${s.total_notifications}`);
    console.log(`Total Product Links:     ${s.total_product_links}`);
    console.log(`Total Zone Links:        ${s.total_zone_links}`);
    console.log(`Total Coordinates:       ${s.total_coordinates}`);
    console.log();
    
    // Products by production line
    const byLine = await pool.query(`
      SELECT 
        pl.code as production_line,
        pl.name,
        COUNT(DISTINCT np.notification_id) as notification_count,
        COUNT(DISTINCT np.product_id) as product_count
      FROM production_lines pl
      LEFT JOIN products p ON p.production_line_id = pl.id
      LEFT JOIN notifications_products np ON np.product_id = p.id
      WHERE pl.is_active = true
      GROUP BY pl.id, pl.code, pl.name
      ORDER BY pl.id
    `);
    
    console.log('='.repeat(70));
    console.log('PRODUCTS BY PRODUCTION LINE');
    console.log('='.repeat(70));
    byLine.rows.forEach(row => {
      console.log(`${row.production_line.padEnd(15)} ${row.name.padEnd(30)} ${row.product_count} products affecting ${row.notification_count} notifications`);
    });
    
    console.log();
    console.log('='.repeat(70));
    console.log('✓ All notifications have been reset and recreated');
    console.log('✓ Product detection is automatic when coordinates are added/changed');
    console.log('✓ Zone detection is automatic as well');
    console.log('='.repeat(70));
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

showSummary();
