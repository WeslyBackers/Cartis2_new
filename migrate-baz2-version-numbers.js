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

function formatBaz2Version(year, issue) {
  return `${year}-${String(issue).padStart(2, '0')}`;
}

function parseVersionDate(row) {
  const sourceDate = row.publication_date || row.version_date || row.created_at;
  return new Date(sourceDate);
}

async function migrateBaz2VersionNumbers() {
  const client = await pool.connect();

  try {
    console.log('=== MIGRATE BAZ-2 VERSION NUMBERS ===');

    const versionsResult = await client.query(
      `SELECT
         pv.id,
         pv.product_id,
         pv.version_number,
         pv.status,
         pv.created_at,
         pv.version_date,
         pv.publication_date,
         p.code AS product_code,
         p.name AS product_name,
         pl.code AS production_line_code
       FROM product_versions pv
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN production_lines pl ON pl.id = p.production_line_id
       WHERE LOWER(TRIM(COALESCE(p.code, ''))) = 'baz-2'
       ORDER BY pv.product_id,
                COALESCE(pv.publication_date, pv.version_date, pv.created_at::date) ASC,
                pv.created_at ASC,
                pv.id ASC`
    );

    if (versionsResult.rows.length === 0) {
      console.log('No BaZ-2 product versions found.');
      return;
    }

    const grouped = new Map();
    for (const row of versionsResult.rows) {
      if (!grouped.has(row.product_id)) {
        grouped.set(row.product_id, []);
      }
      grouped.get(row.product_id).push(row);
    }

    console.log(`Found ${versionsResult.rows.length} BaZ-2 version row(s) across ${grouped.size} product(s).`);

    await client.query('BEGIN');

    let updatedRows = 0;

    for (const [productId, rows] of grouped.entries()) {
      let currentYear = null;
      let issue = 2;

      console.log(`\nProduct ${productId} (${rows[0].product_code} - ${rows[0].product_name || 'n/a'}):`);

      for (const row of rows) {
        const rowDate = parseVersionDate(row);
        const rowYear = Number.isNaN(rowDate.getTime()) ? new Date().getFullYear() : rowDate.getFullYear();

        if (currentYear === null) {
          currentYear = rowYear;
          issue = 2;
        } else if (rowYear > currentYear) {
          currentYear = rowYear;
          issue = 2;
        } else if (issue > 26) {
          currentYear += 1;
          issue = 2;
        }

        const targetVersionNumber = formatBaz2Version(currentYear, issue);

        if (row.version_number !== targetVersionNumber) {
          await client.query(
            `UPDATE product_versions
             SET version_number = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [targetVersionNumber, row.id]
          );

          updatedRows += 1;
          console.log(`  id=${row.id}: ${row.version_number} -> ${targetVersionNumber}`);
        } else {
          console.log(`  id=${row.id}: ${row.version_number} (unchanged)`);
        }

        issue += 1;
      }
    }

    await client.query('COMMIT');

    console.log('\n--- Summary ---');
    console.log(`Rows scanned: ${versionsResult.rows.length}`);
    console.log(`Rows updated: ${updatedRows}`);
    console.log('BaZ-2 version number migration completed successfully.');
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

migrateBaz2VersionNumbers()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  });
