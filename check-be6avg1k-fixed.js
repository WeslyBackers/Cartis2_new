require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

function parseGeometry(geom) {
  if (!geom) return null;
  
  let parsed = geom;
  if (typeof parsed === 'string') {
    parsed = JSON.parse(parsed);
    // If still a string (double-encoded), parse again
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed);
    }
  }
  return parsed;
}

async function checkProduct() {
  try {
    // Check if BE6AVG1K exists
    const productResult = await pool.query(`
      SELECT p.id, p.code, p.name, p.production_line_id, pl.code as production_line_code,
             p.geometry IS NOT NULL as has_geometry, p.geometry
      FROM products p
      LEFT JOIN production_lines pl ON p.production_line_id = pl.id
      WHERE p.code = 'BE6AVG1K'
    `);
    
    if (productResult.rows.length === 0) {
      console.log('Product BE6AVG1K NOT FOUND in database');
      await pool.end();
      return;
    }
    
    const product = productResult.rows[0];
    console.log('Product BE6AVG1K found:');
    console.log('  ID:', product.id);
    console.log('  Code:', product.code);
    console.log('  Name:', product.name);
    console.log('  Production Line:', product.production_line_code, `(ID: ${product.production_line_id})`);
    console.log('  Has Geometry:', product.has_geometry);
    console.log('');
    
    if (!product.has_geometry) {
      console.log('⚠ Product has NO geometry - cannot be detected!');
      await pool.end();
      return;
    }
    
    // Parse and stringify the product geometry
    const productGeom = parseGeometry(product.geometry);
    const productGeomStr = JSON.stringify(productGeom);
    
    // Now check if it intersects with notification 17's geometries
    console.log('Checking intersection with each geometry individually...\n');
    
    // First get all the geometries
    const mainGeomResult = await pool.query(`
      SELECT geometry FROM notifications WHERE id = 17 AND geometry IS NOT NULL
    `);
    
    const coordGeomsResult = await pool.query(`
      SELECT id, geometry FROM notification_coordinates 
     WHERE notification_id = 17 AND geometry IS NOT NULL
      ORDER BY id
    `);
    
    let totalIntersecting = 0;
    let totalChecked = 0;
    let totalErrors = 0;
    
    // Check main geometry
    if (mainGeomResult.rows.length > 0) {
      try {
        const mainGeom = parseGeometry(mainGeomResult.rows[0].geometry);
        const mainGeomStr = JSON.stringify(mainGeom);
        
        const result = await pool.query(`
          SELECT ST_Intersects(
            ST_Force2D(ST_GeomFromGeoJSON($1)),
            ST_Force2D(ST_GeomFromGeoJSON($2))
          ) as intersects
        `, [mainGeomStr, productGeomStr]);
        
        totalChecked++;
        if (result.rows[0].intersects) {
          console.log('✓ INTERSECTS with main notification geometry');
          totalIntersecting++;
        } else {
          console.log('✗ No intersection with main notification geometry');
        }
      } catch (e) {
        console.log(`⚠ Error checking main geometry: ${e.message}`);
        totalErrors++;
      }
    }
    
    // Check coordinate geometries
    for (const coord of coordGeomsResult.rows) {
      try {
        const coordGeom = parseGeometry(coord.geometry);
        const coordGeomStr = JSON.stringify(coordGeom);
        
        const result = await pool.query(`
          SELECT ST_Intersects(
            ST_Force2D(ST_GeomFromGeoJSON($1)),
            ST_Force2D(ST_GeomFromGeoJSON($2))
          ) as intersects
        `, [coordGeomStr, productGeomStr]);
        
        totalChecked++;
        if (result.rows[0].intersects) {
          console.log(`✓ INTERSECTS with coordinate ${coord.id}`);
          totalIntersecting++;
        }
      } catch (e) {
        console.log(`⚠ Error checking coordinate ${coord.id}: ${e.message}`);
        totalErrors++;
      }
    }
    
    console.log(`\nSummary:`);
    console.log(`  Total geometries checked: ${totalChecked}`);
    console.log(`  Intersecting: ${totalIntersecting}`);
    console.log(`  Errors: ${totalErrors}`);
    
    if (totalIntersecting > 0) {
      console.log('\n⚠ Product SHOULD be detected but is NOT linked - this may be a bug!');
    } else if (totalErrors > 0) {
      console.log('\n⚠ Some geometries could not be checked - there may be data quality issues');
    } else {
      console.log('\n✓ Product does not intersect - correct that it is not linked');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkProduct();
