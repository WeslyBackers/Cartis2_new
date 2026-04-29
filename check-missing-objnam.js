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
    SELECT p.id, p.code, p.name, p.description 
    FROM products p 
    JOIN production_lines pl ON p.production_line_id = pl.id 
    WHERE pl.code = 'PILOT_ENC' 
      AND p.description NOT LIKE '%OBJNAM%'
    ORDER BY p.code
  `);
  console.log(`Products without OBJNAM in description: ${res.rows.length}\n`);
  res.rows.forEach(r => {
    console.log(`Code: ${r.code} | Name: ${r.name}`);
    console.log(`  Description: ${(r.description || '(null)').substring(0, 200)}`);
    console.log();
  });
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
