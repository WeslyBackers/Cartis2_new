// Check coordinate geometries for notification 18
require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function checkGeometries() {
  try {
    console.log('Checking coordinate geometries for notification 18...\n');
    
    const result = await pool.query(
      `SELECT id, latitude, longitude, label, geometry
       FROM notification_coordinates 
       WHERE notification_id = 18 
       ORDER BY id`
    );
    
    result.rows.forEach((row) => {
      console.log(`\n=== Coordinate ID ${row.id} ===`);
      console.log(`Label: ${row.label || 'none'}`);
      console.log(`Lat/Lon: ${row.latitude}, ${row.longitude}`);
      
      if (row.geometry) {
        console.log('Geometry (raw):');
        console.log(JSON.stringify(row.geometry, null, 2));
        
        // Check if it's a valid GeoJSON
        if (typeof row.geometry === 'object') {
          if (!row.geometry.type) {
            console.log('⚠️ WARNING: Missing "type" field!');
          }
          if (!row.geometry.coordinates) {
            console.log('⚠️ WARNING: Missing "coordinates" field!');
          }
        }
      } else {
        console.log('No geometry stored');
      }
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkGeometries();
