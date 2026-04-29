require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function checkCoordinates() {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        label, 
        latitude, 
        longitude, 
        CASE WHEN geometry IS NULL THEN false ELSE true END as has_geometry,
        geometry
      FROM notification_coordinates 
      WHERE notification_id = 17 
      ORDER BY id
    `);
    
    console.log('Total coordinates:', result.rows.length);
    console.log('\n=== Coordinates WITHOUT geometry (will NOT be used for detection): ===');
    
    const withoutGeometry = result.rows.filter(row => !row.has_geometry);
    console.log(`Count: ${withoutGeometry.length}`);
    withoutGeometry.forEach(row => {
      console.log(`  ID ${row.id}: ${row.label || 'Unlabeled'} (lat: ${row.latitude}, lon: ${row.longitude})`);
    });
    
    console.log('\n=== Coordinates WITH geometry (WILL be used for detection): ===');
    const withGeometry = result.rows.filter(row => row.has_geometry);
    console.log(`Count: ${withGeometry.length}`);
    
    withGeometry.forEach(row => {
      let geomType = 'unknown';
      if (row.geometry) {
        try {
          // Parse the geometry if it's a string
          const geom = typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry;
          geomType = geom.type || 'unknown';
        } catch (e) {
          geomType = 'parse error';
        }
      }
      console.log(`  ID ${row.id}: ${row.label || 'Unlabeled'} (type: ${geomType})`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCoordinates();
