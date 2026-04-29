const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

const geometryUpdates = [
  { code: 'MSI 001/26', geometry: '{"type":"Point","coordinates":[4.2667,51.2333]}' }, // Haven Antwerpen
  { code: 'MSI 002/26', geometry: '{"type":"LineString","coordinates":[[4.15,51.25],[4.20,51.28]]}' }, // Schelde km 80-85
  { code: 'BASS 001/26', geometry: '{"type":"Point","coordinates":[3.2,51.35]}' }, // Zeebrugge
  { code: 'MSI 003/26', geometry: '{"type":"LineString","coordinates":[[2.5,51.5],[3.5,52.0]]}' }, // Kabel NL-UK
  { code: 'MSI 004/26', geometry: '{"type":"Point","coordinates":[3.25,51.3333]}' }, // Wrak Noordzee
  { code: 'POAB 012/26', geometry: '{"type":"Point","coordinates":[4.2833,51.2333]}' }, // Port of Antwerp dok 7
  { code: 'MSI 005/26', geometry: '{"type":"Point","coordinates":[3.6,51.4]}' }, // Toren Westerschelde
  { code: 'BASS 002/26', geometry: '{"type":"Point","coordinates":[3.1,51.5]}' }, // Olieplatform
  { code: 'MSI 006/26', geometry: '{"type":"Polygon","coordinates":[[[3.0,51.5],[4.0,51.5],[4.0,51.75],[3.0,51.75],[3.0,51.5]]]}' }, // Militair gebied
  { code: 'FLARIS 001/26', geometry: '{"type":"Point","coordinates":[5.5667,50.95]}' } // Albert Kanaal
];

async function addGeometry() {
  try {
    console.log('Adding geographical positions to notifications...\n');
    
    for (const update of geometryUpdates) {
      const result = await pool.query(
        'UPDATE notifications SET geometry = $1 WHERE code = $2 RETURNING id, code, geometry',
        [update.geometry, update.code]
      );
      
      if (result.rows.length > 0) {
        const geom = JSON.parse(result.rows[0].geometry);
        console.log(`✓ ${result.rows[0].code}: ${geom.type}`);
        if (geom.type === 'Point') {
          console.log(`  Coordinates: ${geom.coordinates[1]}°N, ${geom.coordinates[0]}°E`);
        }
      }
    }
    
    // Show count of notifications with geometry
    const countResult = await pool.query(
      'SELECT COUNT(*) as with_geometry FROM notifications WHERE geometry IS NOT NULL'
    );
    
    console.log(`\n✅ Total notifications with geometry: ${countResult.rows[0].with_geometry}/10`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding geometry:', error.message);
    process.exit(1);
  }
}

addGeometry();
