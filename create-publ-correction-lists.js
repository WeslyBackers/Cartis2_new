const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const CORRECTION_LIST_PREFIX = 'VL-';

function getGroupedDeelkaartBase(chartCode) {
  const trimmed = String(chartCode || '').trim();
  const match = trimmed.match(/^Deelkaart\s+(104|105|107)\/\d+$/i);
  return match ? match[1] : null;
}

function buildCorrectionListCode(chartCode) {
  const groupedBase = getGroupedDeelkaartBase(chartCode);
  return `${CORRECTION_LIST_PREFIX}${groupedBase || String(chartCode || '').trim()}`;
}

function buildCorrectionListName(chartCode, chartName) {
  const groupedBase = getGroupedDeelkaartBase(chartCode);
  if (groupedBase) {
    return `Verbeterlijst ${groupedBase}`;
  }

  const code = String(chartCode || '').trim();
  const name = String(chartName || '').trim();
  return name ? `Verbeterlijst ${code} - ${name}` : `Verbeterlijst ${code}`;
}

function buildCorrectionListDescription(chartCode, chartName) {
  const groupedBase = getGroupedDeelkaartBase(chartCode);
  if (groupedBase) {
    return `Verbeterlijst voor Deelkaart ${groupedBase}`;
  }

  return `Verbeterlijst voor ${String(chartCode || '').trim()} - ${String(chartName || '').trim()}`;
}

function parseEditionVersion(versionNumber) {
  const match = String(versionNumber || '').match(/edition\s*(\d+)\s*update\s*(\d+)/i);
  if (!match) return null;
  return { edition: Number(match[1]), update: Number(match[2]) };
}

function formatEditionVersion(edition, update) {
  return `Edition ${String(edition).padStart(2, '0')} Update ${String(update).padStart(2, '0')}`;
}

async function getPublProductionLineId(client) {
  const result = await client.query("SELECT id FROM production_lines WHERE code = 'PUBL' LIMIT 1");
  if (result.rows.length === 0) {
    throw new Error('PUBL production line not found');
  }
  return Number(result.rows[0].id);
}

async function ensureInProgressVersion(client, productId) {
  const existingResult = await client.query(
    `SELECT id
     FROM product_versions
     WHERE product_id = $1
       AND status = 'in_progress'
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [productId]
  );

  if (existingResult.rows.length > 0) {
    return Number(existingResult.rows[0].id);
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
    [productId, versionNumber, 'Automatisch aangemaakt voor Verbeterlijst']
  );

  return Number(createResult.rows[0].id);
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('=== CREATE PUBL CORRECTION LISTS ===');
    await client.query('BEGIN');

    const publProductionLineId = await getPublProductionLineId(client);
    const chartsResult = await client.query(
      `SELECT p.id, p.code, p.name, p.geometry, p.is_active
       FROM products p
       JOIN production_lines pl ON pl.id = p.production_line_id
       WHERE pl.code = 'ZK'
         AND p.type = 'chart'
       ORDER BY p.code`
    );

    let createdProducts = 0;
    let backfilledNotificationLinks = 0;
    let backfilledTaskLinks = 0;

    for (const chart of chartsResult.rows) {
      const correctionCode = buildCorrectionListCode(chart.code);
      const correctionName = buildCorrectionListName(chart.code, chart.name);
      const description = buildCorrectionListDescription(chart.code, chart.name);

      const existingProductResult = await client.query(
        'SELECT id FROM products WHERE code = $1 LIMIT 1',
        [correctionCode]
      );

      const productResult = await client.query(
        `INSERT INTO products
          (production_line_id, code, name, type, description, geometry, is_active)
         VALUES ($1, $2, $3, 'publication', $4, $5, $6)
         ON CONFLICT (code) DO UPDATE
         SET production_line_id = EXCLUDED.production_line_id,
             name = EXCLUDED.name,
             type = EXCLUDED.type,
             description = EXCLUDED.description,
             geometry = EXCLUDED.geometry,
             is_active = EXCLUDED.is_active,
             updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [publProductionLineId, correctionCode, correctionName, description, chart.geometry || null, chart.is_active !== false]
      );

      const correctionProductId = Number(productResult.rows[0].id);
      if (existingProductResult.rows.length === 0) {
        createdProducts++;
      }

      const correctionVersionId = await ensureInProgressVersion(client, correctionProductId);

      const notificationInsertResult = await client.query(
        `INSERT INTO notifications_products (notification_id, product_id, is_relevant, notes)
         SELECT np.notification_id, $1, np.is_relevant, np.notes
         FROM notifications_products np
         WHERE np.product_id = $2
         ON CONFLICT (notification_id, product_id) DO NOTHING`,
        [correctionProductId, chart.id]
      );
      backfilledNotificationLinks += notificationInsertResult.rowCount || 0;

      const taskLinksResult = await client.query(
        `SELECT task_id, status, notes
         FROM task_products
         WHERE product_id = $1`,
        [chart.id]
      );

      for (const taskLink of taskLinksResult.rows) {
        const insertTaskResult = await client.query(
          `INSERT INTO task_products
            (task_id, product_id, product_version_id, status, notes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT (task_id, product_id) DO NOTHING`,
          [taskLink.task_id, correctionProductId, correctionVersionId, taskLink.status || 'hoog_te_verwerken', taskLink.notes || null]
        );

        if ((insertTaskResult.rowCount || 0) > 0) {
          backfilledTaskLinks += insertTaskResult.rowCount || 0;
        }

        await client.query(
          `INSERT INTO task_production_line_status (task_id, production_line_id, status, wait_for_zk)
           VALUES ($1, $2, 'under_construction', false)
           ON CONFLICT (task_id, production_line_id) DO NOTHING`,
          [taskLink.task_id, publProductionLineId]
        );
      }
    }

    await client.query('COMMIT');

    console.log(`Paper charts scanned: ${chartsResult.rows.length}`);
    console.log(`Correction-list products created: ${createdProducts}`);
    console.log(`Notification links backfilled: ${backfilledNotificationLinks}`);
    console.log(`Task links backfilled: ${backfilledTaskLinks}`);
    console.log('Done.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to create PUBL correction lists:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();