require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

async function checkGeometryFormat() {
  try {
    // Check product geometry
    const productResult = await pool.query(`
      SELECT geometry FROM products WHERE code = 'BE6AVG1K'
    `);
    
    console.log('BE6AVG1K geometry (raw):');
    console.log(typeof productResult.rows[0].geometry);
    console.log(productResult.rows[0].geometry.substring(0, 200));
    
    // Try parsing it
    try {
      let geom = productResult.rows[0].geometry;
      if (typeof geom === 'string') {
        geom = JSON.parse(geom);
        if (typeof geom === 'string') {
          geom = JSON.parse(geom);
        }
      }
      console.log('\nParsed type:', geom.type);
      console.log('Has coordinates:', !!geom.coordinates);
    } catch (e) {
      console.log('\nParse error:', e.message);
    }
    
    // Check a coordinate geometry
    const coordResult = await pool.query(`
      SELECT geometry FROM notification_coordinates WHERE id = 27
    `);
    
    console.log('\n\nCoordinate 27 geometry (raw):');
    console.log(typeof coordResult.rows[0].geometry);
    console.log(coordResult.rows[0].geometry.substring(0, 200));
    
    // Try parsing it
    try {
      let geom = coordResult.rows[0].geometry;
      if (typeof geom === 'string') {
        geom = JSON.parse(geom);
        if (typeof geom === 'string') {
          geom = JSON.parse(geom);
        }
      }
      console.log('\nParsed type:', geom.type);
      console.log('Has coordinates:', !!geom.coordinates);
    } catch (e) {
      console.log('\nParse error:', e.message);
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkGeometryFormat();
