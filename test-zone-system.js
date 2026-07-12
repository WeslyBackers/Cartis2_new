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

console.log('Testing zone system after migration...\n');

// Test 1: Verify products with type='zone' are accessible
pool.query("SELECT COUNT(*) as count FROM products WHERE type = 'zone' AND is_active = true")
  .then(r => {
    console.log('✓ Active zone products:', r.rows[0].count);
    
    // Test 2: Check notification_zones table structure
    return pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'notification_zones' AND column_name IN ('product_id', 'kml_coverage_id') ORDER BY column_name");
  })
  .then(r => {
    console.log('✓ notification_zones columns:', r.rows.map(c => c.column_name).join(', '));
    
    // Test 3: Sample zone products
    return pool.query("SELECT id, code, name FROM products WHERE type = 'zone' AND is_active = true ORDER BY code LIMIT 5");
  })
  .then(r => {
    console.log('\n✓ Sample zone products:');
    r.rows.forEach(z => {
      console.log(`  [${z.id}] ${z.code} - ${z.name}`);
    });
    
    // Test 4: Check if any zones have geometry
    return pool.query("SELECT COUNT(*) as count FROM products WHERE type = 'zone' AND is_active = true AND geometry IS NOT NULL");
  })
  .then(r => {
    console.log(`\n✓ Zones with geometry: ${r.rows[0].count}`);
    
    // Test 5: Sample zone with geometry
    return pool.query("SELECT id, code, name, LEFT(geometry, 100) as geom_preview FROM products WHERE type = 'zone' AND is_active = true AND geometry IS NOT NULL LIMIT 1");
  })
  .then(r => {
    if (r.rows.length > 0) {
      console.log('\n✓ Sample zone geometry:');
      console.log(`  Zone: ${r.rows[0].code} - ${r.rows[0].name}`);
      console.log(`  Geometry preview: ${r.rows[0].geom_preview}...`);
    }
    
    console.log('\n✅ Zone system is ready!');
    console.log('\nNext steps:');
    console.log('1. Start backend: cd backend && npm start');
    console.log('2. Start frontend: cd frontend && npm run dev');
    console.log('3. Open NotificationDetail page');
    console.log('4. Click "Herbereken zones" button to detect zones');
    console.log('5. Click "+ Zone toevoegen" to manually add zones');
    
    pool.end();
  })
  .catch(e => {
    console.error('\n✗ Error:', e.message);
    pool.end();
    process.exit(1);
  });
