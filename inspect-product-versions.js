const path = require('path');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function run() {
  const top = await pool.query(`
    SELECT p.id as product_id, p.code, p.type, COUNT(*)::int as cnt
    FROM product_versions pv
    JOIN products p ON p.id = pv.product_id
    GROUP BY p.id, p.code, p.type
    ORDER BY cnt DESC
    LIMIT 20
  `);

  console.log('Top products with versions:');
  top.rows.forEach((r) => console.log(r));

  const sample = await pool.query(`
    SELECT pv.id, pv.product_id, p.code, p.type, pv.version_number, pv.status,
           pv.version_date, pv.publication_date, pv.created_at
    FROM product_versions pv
    JOIN products p ON p.id = pv.product_id
    ORDER BY p.id, pv.created_at, pv.id
    LIMIT 120
  `);

  console.log('\nSample versions:');
  sample.rows.forEach((r) => console.log(r));
}

run()
  .then(async () => {
    await pool.end();
  })
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
