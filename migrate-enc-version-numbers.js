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

function formatVersion(edition, update) {
  return `Edition ${String(edition).padStart(2, '0')} Update ${String(update).padStart(2, '0')}`;
}

async function migrateEncVersionNumbers() {
  const client = await pool.connect();

  try {
    console.log('=== MIGRATE ENC VERSION NUMBERS ===');

    const versionsResult = await client.query(`
      SELECT
        pv.id,
        pv.product_id,
        pv.version_number,
        pv.status,
        pv.created_at,
        pv.version_date,
        pv.publication_date,
        p.code AS product_code,
        p.type AS product_type
      FROM product_versions pv
      JOIN products p ON p.id = pv.product_id
      WHERE LOWER(COALESCE(p.type, '')) LIKE '%enc%'
      ORDER BY pv.product_id, pv.created_at, pv.id
    `);

    if (versionsResult.rows.length === 0) {
      console.log('No ENC product versions found.');
      return;
    }

    const grouped = new Map();
    for (const row of versionsResult.rows) {
      if (!grouped.has(row.product_id)) {
        grouped.set(row.product_id, []);
      }
      grouped.get(row.product_id).push(row);
    }

    await client.query('BEGIN');

    let updatedRows = 0;
    let touchedProducts = 0;

    for (const [productId, rows] of grouped.entries()) {
      let productTouched = false;

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const targetVersionNumber = formatVersion(1, i);

        if (row.version_number !== targetVersionNumber) {
          await client.query(
            `UPDATE product_versions
             SET version_number = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [targetVersionNumber, row.id]
          );

          updatedRows += 1;
          productTouched = true;
        }
      }

      if (productTouched) {
        touchedProducts += 1;
      }
    }

    await client.query('COMMIT');

    console.log(`ENC products processed: ${grouped.size}`);
    console.log(`ENC products updated: ${touchedProducts}`);
    console.log(`Version rows updated: ${updatedRows}`);
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

migrateEncVersionNumbers()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  });
