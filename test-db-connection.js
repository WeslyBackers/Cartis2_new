const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

console.log('Testing connection with:');
console.log('  Host:', process.env.DB_HOST);
console.log('  Port:', process.env.DB_PORT);
console.log('  Database:', process.env.DB_NAME);
console.log('  User:', process.env.DB_USER);
console.log('  SSL:', process.env.DB_SSL);

const isSupabase = (process.env.DB_HOST || '').includes('supabase.co');
const sslEnabled = process.env.DB_SSL === 'true' || isSupabase;

console.log('  SSL Enabled:', sslEnabled);
console.log('');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  max: 2,
  connectionTimeoutMillis: 10000
});

pool.query('SELECT NOW() as time, current_database() as db, current_user as usr, version() as pg_version')
  .then(r => {
    console.log('✓ Database connection successful!');
    console.log('  Server time:', r.rows[0].time);
    console.log('  Database:', r.rows[0].db);
    console.log('  User:', r.rows[0].usr);
    console.log('  PostgreSQL:', r.rows[0].pg_version.split(' ').slice(0, 2).join(' '));
    console.log('');
    
    // Test PostGIS extension
    return pool.query("SELECT PostGIS_version() as postgis_version");
  })
  .then(r => {
    console.log('✓ PostGIS extension available');
    console.log('  Version:', r.rows[0].postgis_version);
    console.log('');
    
    // Check production lines table
    return pool.query("SELECT COUNT(*) as count FROM production_lines");
  })
  .then(r => {
    console.log('✓ Schema verified - production_lines table exists');
    console.log('  Production lines:', r.rows[0].count);
    console.log('');
    console.log('✅ All Supabase API connections are correct!');
    pool.end();
    process.exit(0);
  })
  .catch(e => {
    console.error('');
    console.error('✗ Connection test failed:', e.message);
    console.error('');
    pool.end();
    process.exit(1);
  });
