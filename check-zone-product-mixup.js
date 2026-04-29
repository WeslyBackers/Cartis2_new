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

async function checkZoneProductMixup() {
  const client = await pool.connect();
  
  try {
    console.log('=== CHECKING FOR ZONE/PRODUCT MIXUP ===\n');
    
    // Check for "Vlaamse Banken" in kml_coverages
    console.log('1. Searching for "Vlaamse Banken" in kml_coverages:');
    const vlaamseResult = await client.query(`
      SELECT c.id, c.code, c.name, f.category, f.filename, f.display_name
      FROM kml_coverages c
      JOIN kml_files f ON c.kml_file_id = f.id
      WHERE c.name ILIKE '%Vlaamse Banken%' OR c.code ILIKE '%VLBNK%'
    `);
    
    console.log(`Found ${vlaamseResult.rows.length} matches:`);
    vlaamseResult.rows.forEach(row => {
      console.log(`  - ID: ${row.id}, Code: ${row.code}, Name: ${row.name}`);
      console.log(`    Category: ${row.category}, File: ${row.filename} (${row.display_name})`);
    });
    console.log('');
    
    // Check notification 22's zones
    console.log('2. Checking zones for notification ID 22:');
    const notif22Zones = await client.query(`
      SELECT nz.*, c.code, c.name, f.category, f.filename
      FROM notification_zones nz
      JOIN kml_coverages c ON nz.kml_coverage_id = c.id
      JOIN kml_files f ON c.kml_file_id = f.id
      WHERE nz.notification_id = 22
    `);
    
    console.log(`Found ${notif22Zones.rows.length} zones:`);
    notif22Zones.rows.forEach(row => {
      console.log(`  - Zone: ${row.zone_name}`);
      console.log(`    Code: ${row.code}, Category: ${row.category}, File: ${row.filename}`);
      console.log(`    Detection Method: ${row.detection_method}`);
    });
    console.log('');
    
    // Count categories in kml_files
    console.log('3. KML Files by category:');
    const fileCategories = await client.query(`
      SELECT category, COUNT(*) as count, array_agg(filename) as files
      FROM kml_files
      GROUP BY category
    `);
    
    fileCategories.rows.forEach(row => {
      console.log(`  ${row.category}: ${row.count} files`);
      row.files.forEach(f => console.log(`    - ${f}`));
    });
    console.log('');
    
    // Check for products in zones category
    console.log('4. Looking for product-like names in "zones" category:');
    const suspectZones = await client.query(`
      SELECT c.id, c.code, c.name, f.filename
      FROM kml_coverages c
      JOIN kml_files f ON c.kml_file_id = f.id
      WHERE f.category = 'zones'
        AND (c.name ILIKE '%ENC%' OR c.name ILIKE '%usage%' OR c.name ILIKE '%AttributeValue%')
    `);
    
    console.log(`Found ${suspectZones.rows.length} suspect entries:`);
    suspectZones.rows.forEach(row => {
      console.log(`  - Code: ${row.code}, Name: ${row.name}`);
      console.log(`    File: ${row.filename}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

checkZoneProductMixup()
  .then(() => {
    console.log('\n✓ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Check failed:', error);
    process.exit(1);
  });
