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
  const result = await pool.query(`
    SELECT pv.id, pv.product_id, p.code, p.name, p.type, pv.version_number, pv.status,
           pv.version_date, pv.publication_date, pv.created_at
    FROM product_versions pv
    JOIN products p ON p.id = pv.product_id
    WHERE p.type = 'chart'
    ORDER BY p.id, pv.created_at, pv.id
    LIMIT 80
  `);

  console.log(`Found ${result.rows.length} chart product versions:`);
  result.rows.forEach((row) => console.log(JSON.stringify(row)));
}

run()
  .then(() => pool.end())
  .catch((err) => { console.error(err.message); pool.end(); process.exit(1); });
