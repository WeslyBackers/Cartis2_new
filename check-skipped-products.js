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
  // Check the products that were skipped - their name still equals their code
  const res = await pool.query(`
    SELECT p.id, p.code, p.name, p.description 
    FROM products p 
    JOIN production_lines pl ON p.production_line_id = pl.id 
    WHERE pl.code = 'PILOT_ENC' 
      AND p.name = p.code
    ORDER BY p.code
    LIMIT 5
  `);
  console.log(`Products where name = code: ${res.rows.length}\n`);
  res.rows.forEach(r => {
    console.log(`Code: ${r.code}`);
    console.log(`Description bytes:`, Buffer.from(r.description || '').toString('hex').substring(0, 200));
    console.log(`Description repr:`, JSON.stringify(r.description));
    console.log();
  });
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
