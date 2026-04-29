const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const GROUPS = ['104', '105', '107'];

function parseEditionVersion(versionNumber) {
  const match = String(versionNumber || '').match(/edition\s*(\d+)\s*update\s*(\d+)/i);
  if (!match) return null;
  return { edition: Number(match[1]), update: Number(match[2]) };
}

function formatEditionVersion(edition, update) {
  return `Edition ${String(edition).padStart(2, '0')} Update ${String(update).padStart(2, '0')}`;
}

async function ensureCanonicalProduct(client, groupCode, publProductionLineId) {
  const chartResult = await client.query(
    `SELECT p.geometry, bool_or(p.is_active) AS is_active
     FROM products p
     JOIN production_lines pl ON pl.id = p.production_line_id
     WHERE pl.code = 'ZK'
       AND p.type = 'chart'
       AND p.code ~ $1
     GROUP BY p.geometry
     ORDER BY p.geometry IS NULL, p.geometry
     LIMIT 1`,
    [`^Deelkaart ${groupCode}/[0-9]+$`]
  );

  const result = await client.query(
    `INSERT INTO products
      (production_line_id, code, name, type, description, geometry, is_active)
     VALUES ($1, $2, $3, 'publication', $4, $5, $6)
     ON CONFLICT (code) DO UPDATE
     SET production_line_id = EXCLUDED.production_line_id,
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         description = EXCLUDED.description,
         geometry = COALESCE(products.geometry, EXCLUDED.geometry),
         is_active = EXCLUDED.is_active,
         updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [
      publProductionLineId,
      `VL-${groupCode}`,
      `Verbeterlijst ${groupCode}`,
      `Verbeterlijst voor Deelkaart ${groupCode}`,
      chartResult.rows[0]?.geometry || null,
      chartResult.rows.length > 0 ? chartResult.rows[0].is_active !== false : true,
    ]
  );

  return Number(result.rows[0].id);
}

async function ensureCanonicalInProgressVersion(client, productId) {
  const inProgressResult = await client.query(
    `SELECT id
     FROM product_versions
     WHERE product_id = $1
       AND status = 'in_progress'
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [productId]
  );

  if (inProgressResult.rows.length > 0) {
    return Number(inProgressResult.rows[0].id);
  }

  const latestAnyResult = await client.query(
    `SELECT version_number
     FROM product_versions
     WHERE product_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [productId]
  );

  const latestParsed = parseEditionVersion(latestAnyResult.rows[0]?.version_number);
  const versionNumber = latestParsed
    ? formatEditionVersion(latestParsed.edition, latestParsed.update + 1)
    : formatEditionVersion(1, 0);

  const createResult = await client.query(
    `INSERT INTO product_versions
      (product_id, version_number, version_date, status, notes)
     VALUES ($1, $2, CURRENT_DATE, 'in_progress', $3)
     RETURNING id`,
    [productId, versionNumber, 'Automatisch aangemaakt voor samengevoegde Verbeterlijst']
  );

  return Number(createResult.rows[0].id);
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('=== MERGE PUBL DEELKAART CORRECTION LISTS ===');
    await client.query('BEGIN');

    const publResult = await client.query("SELECT id FROM production_lines WHERE code = 'PUBL' LIMIT 1");
    if (publResult.rows.length === 0) {
      throw new Error('PUBL production line not found');
    }

    const publProductionLineId = Number(publResult.rows[0].id);
    let mergedProducts = 0;
    let insertedNotificationLinks = 0;
    let insertedTaskLinks = 0;
    let deletedOldProducts = 0;

    for (const groupCode of GROUPS) {
      const canonicalProductId = await ensureCanonicalProduct(client, groupCode, publProductionLineId);
      const canonicalVersionId = await ensureCanonicalInProgressVersion(client, canonicalProductId);

      const oldProductsResult = await client.query(
        `SELECT id, code
         FROM products
         WHERE code ~ $1
         ORDER BY code`,
        [`^VL-Deelkaart ${groupCode}/[0-9]+$`]
      );

      if (oldProductsResult.rows.length === 0) {
        continue;
      }

      mergedProducts += oldProductsResult.rows.length;
      const oldProductIds = oldProductsResult.rows.map((row) => Number(row.id));

      const notificationInsertResult = await client.query(
        `INSERT INTO notifications_products (notification_id, product_id, is_relevant, notes)
         SELECT DISTINCT np.notification_id, $1::int, np.is_relevant, np.notes
         FROM notifications_products np
         WHERE np.product_id = ANY($2::int[])
         ON CONFLICT (notification_id, product_id) DO NOTHING`,
        [canonicalProductId, oldProductIds]
      );
      insertedNotificationLinks += notificationInsertResult.rowCount || 0;

      const taskInsertResult = await client.query(
        `INSERT INTO task_products (task_id, product_id, product_version_id, status, notes, execution_status, completed_at, created_at, updated_at)
         SELECT DISTINCT ON (tp.task_id)
           tp.task_id,
           $1::int,
           $2::int,
           tp.status,
           tp.notes,
           tp.execution_status,
           tp.completed_at,
           CURRENT_TIMESTAMP,
           CURRENT_TIMESTAMP
         FROM task_products tp
         WHERE tp.product_id = ANY($3::int[])
         ORDER BY tp.task_id, tp.updated_at DESC, tp.id DESC
         ON CONFLICT (task_id, product_id) DO NOTHING`,
        [canonicalProductId, canonicalVersionId, oldProductIds]
      );
      insertedTaskLinks += taskInsertResult.rowCount || 0;

      await client.query(
        `INSERT INTO task_production_line_status (task_id, production_line_id, status, wait_for_zk)
         SELECT DISTINCT tp.task_id, $1::int, 'under_construction', false
         FROM task_products tp
         WHERE tp.product_id = $2
         ON CONFLICT (task_id, production_line_id) DO NOTHING`,
        [publProductionLineId, canonicalProductId]
      );

      await client.query(
        'DELETE FROM notifications_products WHERE product_id = ANY($1::int[])',
        [oldProductIds]
      );
      await client.query(
        'DELETE FROM task_products WHERE product_id = ANY($1::int[])',
        [oldProductIds]
      );
      await client.query(
        'DELETE FROM product_version_attachments WHERE product_version_id IN (SELECT id FROM product_versions WHERE product_id = ANY($1::int[]))',
        [oldProductIds]
      );
      await client.query(
        'DELETE FROM product_versions WHERE product_id = ANY($1::int[])',
        [oldProductIds]
      );
      const deleteProductsResult = await client.query(
        'DELETE FROM products WHERE id = ANY($1::int[])',
        [oldProductIds]
      );
      deletedOldProducts += deleteProductsResult.rowCount || 0;
    }

    await client.query('COMMIT');
    console.log(`Variant products merged: ${mergedProducts}`);
    console.log(`Notification links inserted: ${insertedNotificationLinks}`);
    console.log(`Task links inserted: ${insertedTaskLinks}`);
    console.log(`Old products deleted: ${deletedOldProducts}`);
    console.log('Done.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to merge Deelkaart correction lists:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();