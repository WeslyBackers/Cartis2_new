const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

console.log('Checking zone data...\n');

pool.query("SELECT COUNT(*) as count FROM kml_coverages c JOIN kml_files f ON c.kml_file_id = f.id WHERE f.category = 'zones'")
  .then(r => {
    console.log('✓ Zones in kml_coverages (category=zones):', r.rows[0].count);
    return pool.query("SELECT COUNT(*) as count FROM products WHERE type = 'zone'");
  })
  .then(r => {
    console.log('✓ Products with type=zone:', r.rows[0].count);
    console.log('');
    return pool.query("SELECT c.id, c.code, c.name, f.display_name FROM kml_coverages c JOIN kml_files f ON c.kml_file_id = f.id WHERE f.category = 'zones' ORDER BY c.code LIMIT 10");
  })
  .then(r => {
    console.log('Sample zones from kml_coverages:');
    r.rows.forEach(z => {
      console.log(`  ${z.code} - ${z.name} (from ${z.display_name})`);
    });
    console.log('');
    return pool.query("SELECT id, code, name, type FROM products WHERE type = 'zone' ORDER BY code LIMIT 10");
  })
  .then(r => {
    console.log('Sample products with type=zone:');
    if (r.rows.length === 0) {
      console.log('  (none found)');
    } else {
      r.rows.forEach(p => {
        console.log(`  ${p.code} - ${p.name} (type: ${p.type})`);
      });
    }
    pool.end();
  })
  .catch(e => {
    console.error('Error:', e.message);
    pool.end();
  });
