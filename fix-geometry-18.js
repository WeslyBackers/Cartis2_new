// Fix double-stringified geometry for notification 18
require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function fixGeometries() {
  try {
    console.log('Fixing double-stringified geometries for notification 18...\n');
    
    // Get all coordinates with geometry
    const result = await pool.query(
      `SELECT id, geometry
       FROM notification_coordinates 
       WHERE notification_id = 18 AND geometry IS NOT NULL
       ORDER BY id`
    );
    
    console.log(`Found ${result.rows.length} coordinates with geometry\n`);
    
    for (const row of result.rows) {
      console.log(`Processing coordinate ID ${row.id}...`);
      
      try {
        let geometry = row.geometry;
        
        // Parse once
        if (typeof geometry === 'string') {
          geometry = JSON.parse(geometry);
        }
        
        // If it's still a string after one parse, it was double-stringified
        if (typeof geometry === 'string') {
          console.log('  ⚠️ Double-stringified detected!');
          geometry = JSON.parse(geometry);
          console.log('  ✓ Parsed: ' + JSON.stringify(geometry));
          
          // Update with the correctly parsed geometry
          await pool.query(
            'UPDATE notification_coordinates SET geometry = $1 WHERE id = $2',
            [JSON.stringify(geometry), row.id]
          );
          console.log('  ✓ Fixed in database');
        } else {
          console.log('  ✓ Already correct: ' + JSON.stringify(geometry));
        }
      } catch (err) {
        console.log(`  ✗ Error processing: ${err.message}`);
      }
      
      console.log();
    }
    
    console.log('Done! You can now trigger product detection.');
    console.log('The coordinates should now correctly show their intersections with products.');
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

fixGeometries();
