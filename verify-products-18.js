// Verify final product links for notification 18
require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function verifyProducts() {
  try {
    console.log('='.repeat(60));
    console.log('VERIFICATION: Products linked to Notification 18');
    console.log('='.repeat(60));
    console.log();
    
    const result = await pool.query(
      `SELECT p.code, p.name, pl.code as production_line, pl.name as production_line_name, np.is_relevant
       FROM notifications_products np
       JOIN products p ON np.product_id = p.id
       JOIN production_lines pl ON p.production_line_id = pl.id
       WHERE np.notification_id = 18
       ORDER BY pl.id, p.code`
    );
    
    console.log(`Total products linked: ${result.rows.length}\n`);
    
    let currentPL = null;
    result.rows.forEach((row) => {
      if (currentPL !== row.production_line) {
        if (currentPL !== null) console.log();
        console.log(`${row.production_line} (${row.production_line_name}):`);
        currentPL = row.production_line;
      }
      const status = row.is_relevant ? '✓' : '✗';
      console.log(`  ${status} ${row.code} - ${row.name}`);
    });
    
    console.log();
    console.log('='.repeat(60));
    
    // Check specifically for BE44J7PK
    const be44j7pk = result.rows.find(r => r.code === 'BE44J7PK');
    if (be44j7pk) {
      console.log('✓ SUCCESS: BE44J7PK is in the affected products list!');
    } else {
      console.log('✗ ERROR: BE44J7PK is NOT in the affected products list!');
    }
    
    // Check for BE44R7SK
    const be44r7sk = result.rows.find(r => r.code === 'BE44R7SK');
    if (be44r7sk) {
      console.log('✓ SUCCESS: BE44R7SK is also in the affected products list!');
    }
    
    console.log('='.repeat(60));
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

verifyProducts();
