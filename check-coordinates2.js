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
    // First, get the column type
    const schemaResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'notification_coordinates' 
      AND column_name = 'geometry'
    `);
    
    console.log('Geometry column type:', schemaResult.rows[0]);
    console.log('');
    
    // Now get the coordinates
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
      let coordCount = 0;
      if (row.geometry) {
        try {
          // The geometry might be double-encoded
          let geom = row.geometry;
          if (typeof geom === 'string') {
            geom = JSON.parse(geom);
            // If it's still a string after first parse, parse again
            if (typeof geom === 'string') {
              geom = JSON.parse(geom);
            }
          }
          
          geomType = geom.type || 'unknown';
          
          // Count coordinates
          if (geom.coordinates) {
            if (geomType === 'Point') {
              coordCount = 1;
            } else if (geomType === 'LineString') {
              coordCount = geom.coordinates.length;
            } else if (geomType === 'Polygon') {
              coordCount = geom.coordinates[0]?.length || 0;
            }
          }
        } catch (e) {
          geomType = `parse error: ${e.message}`;
        }
      }
      console.log(`  ID ${row.id}: ${row.label || 'Unlabeled'} (type: ${geomType}, points: ${coordCount})`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCoordinates();
