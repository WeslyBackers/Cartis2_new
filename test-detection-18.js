// Test product detection for notification 18
require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

// Helper function to remove Z coordinates
function removeZCoordinates(geojson) {
  if (!geojson || !geojson.coordinates) {
    return geojson;
  }

  const cleanCoords = (coords) => {
    if (typeof coords[0] === 'number') {
      return [coords[0], coords[1]];
    }
    return coords.map(cleanCoords);
  };

  return {
    ...geojson,
    coordinates: cleanCoords(geojson.coordinates)
  };
}

async function testProductDetection() {
  try {
    console.log('='.repeat(60));
    console.log('Testing Product Detection for Notification 18');
    console.log('='.repeat(60));
    console.log();

    // 1. Get notification geometry
    console.log('Step 1: Getting notification geometry...');
    const notificationResult = await pool.query(
      'SELECT id, code, geometry FROM notifications WHERE id = 18'
    );
    
    if (notificationResult.rows.length === 0) {
      console.log('  ✗ Notification 18 not found!');
      await pool.end();
      return;
    }
    
    const notification = notificationResult.rows[0];
    console.log(`  ✓ Found notification: ${notification.code}`);
    console.log(`    Main geometry exists: ${!!notification.geometry}`);
    console.log();

    // 2. Get coordinates
    console.log('Step 2: Getting notification coordinates...');
    const coordinatesResult = await pool.query(
      'SELECT id, latitude, longitude, label, geometry FROM notification_coordinates WHERE notification_id = 18 ORDER BY id'
    );
    
    console.log(`  ✓ Found ${coordinatesResult.rows.length} coordinate(s):`);
    coordinatesResult.rows.forEach((coord, index) => {
      if (coord.geometry) {
        const geom = typeof coord.geometry === 'string' ? JSON.parse(coord.geometry) : coord.geometry;
        console.log(`    ${index + 1}. ID ${coord.id}: Geometry type=${geom.type}, label="${coord.label || 'none'}"`);
      } else {
        console.log(`    ${index + 1}. ID ${coord.id}: Point (${coord.latitude}, ${coord.longitude}), label="${coord.label || 'none'}"`);
      }
    });
    console.log();

    // 3. Collect all geometries
    console.log('Step 3: Collecting all geometries...');
    const allGeometries = [];
    
    if (notification.geometry) {
      try {
        const geomObj = typeof notification.geometry === 'string' 
          ? JSON.parse(notification.geometry) 
          : notification.geometry;
        const cleanedGeom = removeZCoordinates(geomObj);
        allGeometries.push(JSON.stringify(cleanedGeom));
        console.log(`  ✓ Main geometry added: type=${cleanedGeom.type}`);
      } catch (e) {
        console.log(`  ✗ Error parsing main geometry:`, e.message);
      }
    }
    
    coordinatesResult.rows.forEach((row, index) => {
      if (row.geometry) {
        try {
          const geomObj = typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry;
          const cleanedGeom = removeZCoordinates(geomObj);
          allGeometries.push(JSON.stringify(cleanedGeom));
          console.log(`  ✓ Coordinate ${index + 1} (ID ${row.id}) geometry added: type=${cleanedGeom.type}`);
        } catch (e) {
          console.log(`  ✗ Error parsing coordinate ${row.id} geometry:`, e.message);
        }
      }
    });
    
    console.log(`  → Total geometries to check: ${allGeometries.length}`);
    console.log();

    if (allGeometries.length === 0) {
      console.log('  ⚠ No geometries found! Cannot detect products.');
      await pool.end();
      return;
    }

    // 4. Check for product BE44J7PK specifically
    console.log('Step 4: Checking product BE44J7PK...');
    const productResult = await pool.query(
      `SELECT p.id, p.code, p.name, pl.code as production_line_code, pl.name as production_line_name, 
              p.geometry IS NOT NULL as has_geometry
       FROM products p
       JOIN production_lines pl ON p.production_line_id = pl.id
       WHERE p.code = 'BE44J7PK' AND p.is_active = true`
    );
    
    if (productResult.rows.length === 0) {
      console.log('  ✗ Product BE44J7PK not found or not active!');
    } else {
      const product = productResult.rows[0];
      console.log(`  ✓ Found product: ${product.code} - ${product.name}`);
      console.log(`    Production line: ${product.production_line_code} (${product.production_line_name})`);
      console.log(`    Has geometry: ${product.has_geometry}`);
      
      if (!product.has_geometry) {
        console.log('  ⚠ Product has no geometry! Cannot detect intersection.');
      } else {
        // Test intersection with each geometry
        console.log();
        console.log('  Testing intersection with each notification geometry:');
        
        for (let geomIndex = 0; geomIndex < allGeometries.length; geomIndex++) {
          const geometry = allGeometries[geomIndex];
          
          try {
            const intersectionCheck = await pool.query(
              `SELECT ST_Intersects(
                ST_Force2D(ST_GeomFromGeoJSON($1)),
                ST_Force2D(ST_GeomFromGeoJSON($2))
              ) as intersects`,
              [product.geometry, geometry]
            );
            
            const intersects = intersectionCheck.rows[0]?.intersects || false;
            const geomObj = JSON.parse(geometry);
            console.log(`    Geometry ${geomIndex + 1} (${geomObj.type}): ${intersects ? '✓ INTERSECTS' : '✗ No intersection'}`);
          } catch (err) {
            console.log(`    Geometry ${geomIndex + 1}: ✗ Error checking intersection: ${err.message}`);
          }
        }
      }
    }
    console.log();

    // 5. Check current linked products
    console.log('Step 5: Current linked products for notification 18...');
    const linkedResult = await pool.query(
      `SELECT p.id, p.code, p.name, pl.code as production_line_code, np.is_relevant
       FROM notifications_products np
       JOIN products p ON np.product_id = p.id
       JOIN production_lines pl ON p.production_line_id = pl.id
       WHERE np.notification_id = 18
       ORDER BY pl.id, p.code`
    );
    
    if (linkedResult.rows.length === 0) {
      console.log('  ⚠ No products currently linked!');
    } else {
      console.log(`  ✓ Currently linked products: ${linkedResult.rows.length}`);
      linkedResult.rows.forEach((product) => {
        console.log(`    - ${product.code} (${product.production_line_code}) - relevant: ${product.is_relevant}`);
      });
    }
    console.log();

    // 6. Run full detection for all production lines
    console.log('Step 6: Running full product detection...');
    console.log();
    
    const productionLinesResult = await pool.query(
      'SELECT id, code, name FROM production_lines WHERE is_active = true ORDER BY id'
    );
    
    console.log(`  Found ${productionLinesResult.rows.length} active production lines`);
    console.log();
    
    let totalNewProducts = 0;
    const allIntersectingProducts = new Set();
    
    for (const productionLine of productionLinesResult.rows) {
      console.log(`  == Checking ${productionLine.code} (${productionLine.name}) ==`);
      
      // Get total products with geometry
      const totalResult = await pool.query(
        `SELECT COUNT(*) as count FROM products 
         WHERE production_line_id = $1 AND is_active = true AND geometry IS NOT NULL`,
        [productionLine.id]
      );
      console.log(`     → ${totalResult.rows[0].count} active products with geometry`);
      
      let foundInThisLine = 0;
      
      for (let geomIndex = 0; geomIndex < allGeometries.length; geomIndex++) {
        const geometry = allGeometries[geomIndex];
        
        try {
          const intersectingProducts = await pool.query(
            `WITH clean_products AS (
              SELECT 
                p.id, 
                p.code, 
                p.name,
                ST_Force2D(ST_GeomFromGeoJSON(p.geometry::text)) as geom
              FROM products p
              WHERE p.production_line_id = $1
                AND p.is_active = true
                AND p.geometry IS NOT NULL
            )
            SELECT id, code, name
            FROM clean_products
            WHERE ST_Intersects(
              geom,
              ST_Force2D(ST_GeomFromGeoJSON($2))
            )`,
            [productionLine.id, geometry]
          );
          
          if (intersectingProducts.rows.length > 0) {
            console.log(`     → Geometry ${geomIndex + 1}: Found ${intersectingProducts.rows.length} product(s)`);
            intersectingProducts.rows.forEach((p) => {
              if (!allIntersectingProducts.has(p.id)) {
                console.log(`        ✓ ${p.code} - ${p.name}`);
                allIntersectingProducts.add(p.id);
                foundInThisLine++;
                totalNewProducts++;
              }
            });
          }
        } catch (err) {
          console.log(`     ✗ Error checking geometry ${geomIndex + 1}: ${err.message}`);
        }
      }
      
      console.log(`     → Total products found in this line: ${foundInThisLine}`);
      console.log();
    }
    
    console.log('='.repeat(60));
    console.log(`SUMMARY: Found ${totalNewProducts} total unique product(s) that intersect`);
    console.log('='.repeat(60));
    console.log();
    
    console.log('To update the database, you can:');
    console.log('1. Use the "Herbereken Producten" button in the UI');
    console.log('2. Or manually call the API endpoint');
    console.log();

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

testProductDetection();
