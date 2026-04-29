const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

function buildAutoVersionNumber(productId) {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `AUTO-${productId}-${timestamp}-${suffix}`;
}

async function getOrCreateInProgressVersion(client, productId) {
  const existing = await client.query(
    `SELECT id
     FROM product_versions
     WHERE product_id = $1
       AND status = 'in_progress'
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [productId]
  );

  if (existing.rows.length > 0) {
    return { id: Number(existing.rows[0].id), created: false };
  }

  const created = await client.query(
    `INSERT INTO product_versions
      (product_id, version_number, version_date, status, notes)
     VALUES ($1, $2, CURRENT_DATE, 'in_progress', $3)
     RETURNING id`,
    [productId, buildAutoVersionNumber(productId), 'Automatisch aangemaakt door backfill script']
  );

  return { id: Number(created.rows[0].id), created: true };
}

async function runBackfill() {
  const client = await pool.connect();

  try {
    console.log('=== BACKFILL TASK PRODUCT VERSIONS ===');

    const beforeCount = await client.query(
      'SELECT COUNT(*)::int AS count FROM task_products WHERE product_version_id IS NULL'
    );
    const missingBefore = beforeCount.rows[0].count;

    console.log(`Task-product links without version (before): ${missingBefore}`);

    if (missingBefore === 0) {
      console.log('Nothing to backfill.');
      return;
    }

    await client.query('BEGIN');

    const productsWithMissing = await client.query(
      `SELECT DISTINCT product_id
       FROM task_products
       WHERE product_version_id IS NULL
       ORDER BY product_id`
    );

    let createdVersions = 0;
    let updatedRows = 0;

    for (const row of productsWithMissing.rows) {
      const productId = Number(row.product_id);
      const version = await getOrCreateInProgressVersion(client, productId);

      if (version.created) {
        createdVersions += 1;
      }

      const updateResult = await client.query(
        `UPDATE task_products
         SET product_version_id = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE product_id = $2
           AND product_version_id IS NULL`,
        [version.id, productId]
      );

      updatedRows += updateResult.rowCount;
      console.log(`Product ${productId}: assigned version ${version.id} to ${updateResult.rowCount} row(s)`);
    }

    await client.query('COMMIT');

    const afterCount = await client.query(
      'SELECT COUNT(*)::int AS count FROM task_products WHERE product_version_id IS NULL'
    );
    const missingAfter = afterCount.rows[0].count;

    console.log('--- Summary ---');
    console.log(`Created in-progress versions: ${createdVersions}`);
    console.log(`Updated task-product rows: ${updatedRows}`);
    console.log(`Task-product links without version (after): ${missingAfter}`);
    console.log('Backfill completed successfully.');
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

runBackfill()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Backfill failed:', error.message);
    await pool.end();
    process.exit(1);
  });
