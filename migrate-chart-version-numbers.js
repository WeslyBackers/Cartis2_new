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

async function migrateChartVersionNumbers() {
  const client = await pool.connect();

  try {
    console.log('=== MIGRATE CHART VERSION NUMBERS ===');

    // Fetch all chart product versions ordered per product by creation time.
    // Published versions keep their date-based name (<name>_DD/MM/YYYY).
    // Only in_progress versions need to be assigned Edition XX Update XX.
    const versionsResult = await client.query(`
      SELECT
        pv.id,
        pv.product_id,
        pv.version_number,
        pv.status,
        pv.created_at,
        pv.version_date,
        pv.publication_date,
        p.code  AS product_code,
        p.name  AS product_name,
        p.type  AS product_type
      FROM product_versions pv
      JOIN products p ON p.id = pv.product_id
      WHERE p.type = 'chart'
        AND pv.status = 'in_progress'
      ORDER BY pv.product_id, pv.created_at, pv.id
    `);

    if (versionsResult.rows.length === 0) {
      console.log('No in-progress chart product versions found.');
      return;
    }

    await client.query('BEGIN');

    let updatedRows = 0;

    for (const row of versionsResult.rows) {
      // Target format: <product_name>_DD/MM/YYYY (publication date not yet known)
      const targetVersionNumber = `${row.product_name}_DD/MM/YYYY`;

      if (row.version_number !== targetVersionNumber) {
        console.log(
          `  [product ${row.product_id} / ${row.product_code}] ` +
          `version id ${row.id}: "${row.version_number}" → "${targetVersionNumber}"`
        );

        await client.query(
          `UPDATE product_versions
           SET version_number = $1,
               updated_at     = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [targetVersionNumber, row.id]
        );

        updatedRows += 1;
      }
    }

    await client.query('COMMIT');

    console.log(`\nChart version rows scanned : ${versionsResult.rows.length}`);
    console.log(`Version rows updated     : ${updatedRows}`);
    console.log('Migration completed.');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
}

migrateChartVersionNumbers()
  .then(async () => {
    await pool.end();
  })
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
