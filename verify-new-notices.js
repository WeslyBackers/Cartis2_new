// Verify and trigger product detection for all new notices
require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function verify() {
  try {
    console.log('='.repeat(60));
    console.log('VERIFICATION: Current Notifications');
    console.log('='.repeat(60));
    console.log();
    
    const result = await pool.query(`
      SELECT id, code, title, source, status, notification_date, 
             geometry IS NOT NULL as has_geometry
      FROM notifications
      ORDER BY id
    `);
    
    console.log(`Total notifications: ${result.rows.length}\n`);
    
    result.rows.forEach(row => {
      const geom = row.has_geometry ? '✓ Has geometry' : '✗ No geometry';
      console.log(`ID ${row.id}: ${row.code}`);
      console.log(`  Title: ${row.title}`);
      console.log(`  Source: ${row.source} | Status: ${row.status}`);
      console.log(`  Date: ${row.notification_date.toISOString().split('T')[0]}`);
      console.log(`  Geometry: ${geom}`);
      console.log();
    });
    
    console.log('='.repeat(60));
    console.log('Product Links Status');
    console.log('='.repeat(60));
    console.log();
    
    const productsResult = await pool.query(`
      SELECT n.id, n.code, COUNT(np.product_id) as product_count
      FROM notifications n
      LEFT JOIN notifications_products np ON n.id = np.notification_id
      GROUP BY n.id, n.code
      ORDER BY n.id
    `);
    
    productsResult.rows.forEach(row => {
      const status = row.product_count > 0 ? `✓ ${row.product_count} products` : '○ No products yet';
      console.log(`${row.code.padEnd(20)} ${status}`);
    });
    
    console.log();
    console.log('='.repeat(60));
    console.log('Note: Product detection runs automatically when:');
    console.log('  - You add/edit/delete coordinates');
    console.log('  - You view the notification detail page');
    console.log('  - Coordinates are added via the map interface');
    console.log('='.repeat(60));
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

verify();
