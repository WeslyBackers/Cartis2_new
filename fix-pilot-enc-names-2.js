/**
 * Fix remaining PILOT_ENC products where OBJNAM is in format "AttributeValueOBJNAM..."
 */
require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

function extractObjnam(description) {
  if (!description) return null;
  
  // Format 1: OBJNAM = U6 - SG - KLK Royersluis
  let match = description.match(/OBJNAM\s*=\s*(.+?)(?:\n|$)/);
  if (match) return match[1].trim();
  
  // Format 2: AttributeValueOBJNAMU5 - Nieuwpoort
  match = description.match(/OBJNAM(.+?)$/);
  if (match) return match[1].trim();
  
  return null;
}

(async () => {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT p.id, p.code, p.name, p.description 
      FROM products p 
      JOIN production_lines pl ON p.production_line_id = pl.id 
      WHERE pl.code = 'PILOT_ENC' 
        AND p.name = p.code
      ORDER BY p.code
    `);

    console.log(`Products still needing fix: ${res.rows.length}`);
    console.log('='.repeat(70));

    let updated = 0;
    await client.query('BEGIN');

    for (const row of res.rows) {
      const objnam = extractObjnam(row.description);
      
      if (!objnam) {
        console.log(`  SKIP (no OBJNAM): ${row.code}`);
        continue;
      }

      console.log(`  UPDATE: ${row.code}: "${row.name}" → "${objnam}"`);
      await client.query(
        'UPDATE products SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [objnam, row.id]
      );
      updated++;
    }

    await client.query('COMMIT');
    console.log(`\nUpdated: ${updated}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
})();
