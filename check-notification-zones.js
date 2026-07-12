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

console.log('Checking notification_zones table structure...\n');

pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'notification_zones' ORDER BY ordinal_position")
  .then(r => {
    console.log('notification_zones columns:');
    r.rows.forEach(c => {
      console.log(`  ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`);
    });
    console.log('');
    return pool.query("SELECT COUNT(*) as count FROM notification_zones");
  })
  .then(r => {
    console.log('Total notification_zones records:', r.rows[0].count);
    return pool.query("SELECT * FROM notification_zones LIMIT 5");
  })
  .then(r => {
    console.log('\nSample notification_zones records:');
    r.rows.forEach(nz => {
      console.log(`  Notification ${nz.notification_id}: zone=${nz.zone_code}, coverage_id=${nz.kml_coverage_id}, method=${nz.detection_method}`);
    });
    pool.end();
  })
  .catch(e => {
    console.error('Error:', e.message);
    pool.end();
  });
