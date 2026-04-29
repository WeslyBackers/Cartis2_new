const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function checkProducts() {
  try {
    console.log('=== PRODUCT STORAGE OVERVIEW ===\n');
    
    // Check production lines
    const lines = await pool.query('SELECT id, code, name FROM production_lines ORDER BY id');
    console.log('Production Lines:');
    lines.rows.forEach(l => console.log(`  ${l.id}. ${l.code} - ${l.name}`));
    console.log('');
    
    // Count products by production line and type
    const counts = await pool.query(`
      SELECT production_line_id, type, COUNT(*) as count 
      FROM products 
      GROUP BY production_line_id, type 
      ORDER BY production_line_id, type
    `);
    
    console.log('Products by production line and type:');
    counts.rows.forEach(c => console.log(`  Line ${c.production_line_id} (${c.type}): ${c.count} products`));
    
    // Total count
    const total = await pool.query('SELECT COUNT(*) FROM products');
    console.log(`\nTotal products: ${total.rows[0].count}`);
    
    // Show sample product structure
    console.log('\n=== PRODUCT TABLE STRUCTURE ===');
    const sample = await pool.query('SELECT * FROM products LIMIT 1');
    if (sample.rows.length > 0) {
      console.log('\nColumns:');
      Object.keys(sample.rows[0]).forEach(key => {
        const value = sample.rows[0][key];
        let preview = '';
        if (typeof value === 'string' && value.length > 50) {
          preview = value.substring(0, 50) + '...';
        } else {
          preview = value;
        }
        console.log(`  - ${key}: ${preview}`);
      });
    }
    
    // Show geometry storage format
    console.log('\n=== GEOMETRY STORAGE ===');
    const geomSample = await pool.query('SELECT code, LEFT(geometry, 100) as geometry_preview FROM products WHERE geometry IS NOT NULL LIMIT 2');
    geomSample.rows.forEach(p => {
      console.log(`\nProduct ${p.code}:`);
      console.log(`  Geometry: ${p.geometry_preview}...`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

checkProducts()
  .then(() => {
    console.log('\n✓ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Check failed:', error);
    process.exit(1);
  });
