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
  try {
    console.log('=== ADD TASK PRODUCT EXECUTION STATUS ===');

    await pool.query(`
      ALTER TABLE task_products
      ADD COLUMN IF NOT EXISTS execution_status VARCHAR(50) DEFAULT 'not_executed'
    `);

    const updateResult = await pool.query(`
      UPDATE task_products
      SET execution_status = 'not_executed'
      WHERE execution_status IS NULL
    `);

    console.log(`Updated ${updateResult.rowCount} existing row(s) to default execution status.`);
    console.log('Migration completed successfully.');
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
