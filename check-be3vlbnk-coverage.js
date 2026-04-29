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

async function checkCoverage() {
  const client = await pool.connect();
  
  try {
    console.log('=== CHECKING BE3VLBNK COVERAGE ===\n');
    
    // Get all BE3VLBNK coverages
    console.log('1. All BE3VLBNK entries in kml_coverages:');
    const coverages = await client.query(`
      SELECT 
        c.id, 
        c.code, 
        c.kml_file_id,
        f.id as file_id,
        f.filename,
        f.category,
        f.display_name
      FROM kml_coverages c
      JOIN kml_files f ON c.kml_file_id = f.id
      WHERE c.code = 'BE3VLBNK'
      ORDER BY c.id
    `);
    
    console.log(`Found ${coverages.rows.length} entries:`);
    coverages.rows.forEach(row => {
      console.log(`  Coverage ID: ${row.id}, File ID: ${row.kml_file_id}/${row.file_id}`);
      console.log(`    File: ${row.filename}, Category: ${row.category}`);
    });
    console.log('');
    
    // Check which one is in notification_zones for notification 22
    console.log('2. Which BE3VLBNK is linked to notification 22:');
    const linked = await client.query(`
      SELECT 
        nz.kml_coverage_id,
        nz.zone_code,
        c.id as coverage_id,
        c.code,
        c.kml_file_id,
        f.category,
        f.filename
      FROM notification_zones nz
      JOIN kml_coverages c ON nz.kml_coverage_id = c.id
      JOIN kml_files f ON c.kml_file_id = f.id
      WHERE nz.notification_id = 22 AND c.code = 'BE3VLBNK'
    `);
    
    console.log(`Found ${linked.rows.length} links:`);
    linked.rows.forEach(row => {
      console.log(`  Linked coverage ID: ${row.kml_coverage_id}`);
      console.log(`    Code: ${row.code}, File: ${row.filename}, Category: ${row.category}`);
    });
    console.log('');
    
    // Check what detectAffectedZones would return
    console.log('3. What detectAffectedZones query returns for BE3VLBNK:');
    const zoneQuery = await client.query(`
      SELECT c.id, c.code, c.name, f.category, f.filename
      FROM kml_coverages c
      JOIN kml_files f ON c.kml_file_id = f.id
      WHERE f.category = 'zones' AND c.code = 'BE3VLBNK'
    `);
    
    console.log(`Found ${zoneQuery.rows.length} entries with category='zones':`);
    zoneQuery.rows.forEach(row => {
      console.log(`  Coverage ID: ${row.id}, Code: ${row.code}`);
      console.log(`    File: ${row.filename}, Category: ${row.category}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkCoverage()
  .then(() => {
    console.log('\n✓ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Check failed:', error);
    process.exit(1);
  });
