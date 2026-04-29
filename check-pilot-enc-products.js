require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

(async () => {
  const res = await pool.query(`
    SELECT p.id, p.code, p.name, LEFT(p.description, 300) as description 
    FROM products p 
    JOIN production_lines pl ON p.production_line_id = pl.id 
    WHERE pl.code = 'PILOT_ENC' 
    ORDER BY p.code
  `);
  console.log('PILOT_ENC products:', res.rows.length);
  res.rows.forEach(r => {
    console.log(`\nID: ${r.id} | Code: ${r.code} | Name: ${r.name}`);
    console.log(`  Description: ${r.description}`);
  });
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
