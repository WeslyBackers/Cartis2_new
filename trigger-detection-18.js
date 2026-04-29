// Trigger product detection for notification 18 directly
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

async function detectAndLinkProducts(notificationId) {
  try {
    console.log(`[Product Detection] Starting detection for notification ${notificationId}`);
    
    // Get notification main geometry
    const notificationResult = await pool.query(
      'SELECT geometry FROM notifications WHERE id = $1',
      [notificationId]
    );
    
    const mainGeometry = notificationResult.rows[0]?.geometry;

    // Get additional geometries from notification_coordinates
    const coordinatesResult = await pool.query(
      'SELECT id, geometry FROM notification_coordinates WHERE notification_id = $1 AND geometry IS NOT NULL',
      [notificationId]
    );

    console.log(`[Product Detection] Main geometry exists: ${!!mainGeometry}`);
    console.log(`[Product Detection] Found ${coordinatesResult.rows.length} coordinate geometries`);

    // Collect all geometries (main geometry + coordinate geometries)
    const allGeometries = [];
    if (mainGeometry) {
      try {
        const geomObj = typeof mainGeometry === 'string' ? JSON.parse(mainGeometry) : mainGeometry;
        const cleanedGeom = removeZCoordinates(geomObj);
        const geomStr = JSON.stringify(cleanedGeom);
        allGeometries.push(geomStr);
        console.log(`[Product Detection] Main geometry type: ${cleanedGeom.type}`);
      } catch (e) {
        console.error(`[Product Detection] Error parsing main geometry:`, e);
      }
    }
    
    coordinatesResult.rows.forEach((row, index) => {
      if (row.geometry) {
        try {
          const geomObj = typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry;
          const cleanedGeom = removeZCoordinates(geomObj);
          const geomStr = JSON.stringify(cleanedGeom);
          allGeometries.push(geomStr);
          console.log(`[Product Detection] Coordinate ${index + 1} (id: ${row.id}), type: ${cleanedGeom.type}`);
        } catch (e) {
          console.error(`[Product Detection] Error parsing coordinate geometry ${row.id}:`, e);
        }
      }
    });

    if (allGeometries.length === 0) {
      console.log(`[Product Detection] Notification ${notificationId}: No geometries found`);
      return;
    }

    console.log(`[Product Detection] Will check ${allGeometries.length} geometr(y/ies)`);

    // Get all active production lines
    const productionLinesResult = await pool.query(
      'SELECT id, code, name FROM production_lines WHERE is_active = true ORDER BY id'
    );

    console.log(`[Product Detection] Found ${productionLinesResult.rows.length} active production lines`);

    let totalProductsLinked = 0;
    const linkedProductIds = new Set();

    // For each production line, find and link intersecting products
    for (const productionLine of productionLinesResult.rows) {
      try {
        console.log(`[Product Detection] === Checking ${productionLine.name} (${productionLine.code}) ===`);
        
        let productsLinkedInThisLine = 0;
        
        // Check each geometry against products
        for (let geomIndex = 0; geomIndex < allGeometries.length; geomIndex++) {
          const geometry = allGeometries[geomIndex];
          
          try {
            // Find products that intersect with this geometry
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

            console.log(`[Product Detection]    → Geometry ${geomIndex + 1}: Found ${intersectingProducts.rows.length} intersecting products`);

            // Link detected products to notification
            for (const product of intersectingProducts.rows) {
              if (!linkedProductIds.has(product.id)) {
                const inserted = await pool.query(
                  `INSERT INTO notifications_products (notification_id, product_id, is_relevant)
                  VALUES ($1, $2, true)
                  ON CONFLICT (notification_id, product_id) 
                  DO UPDATE SET is_relevant = true
                  RETURNING id`,
                  [notificationId, product.id]
                );
                
                if (inserted.rows.length > 0) {
                  linkedProductIds.add(product.id);
                  totalProductsLinked++;
                  productsLinkedInThisLine++;
                  console.log(`[Product Detection]       ✓ Linked: ${product.code} - ${product.name}`);
                }
              }
            }
          } catch (geomError) {
            console.error(`[Product Detection]    ✗ Error checking geometry ${geomIndex + 1}:`, geomError);
          }
        }
        
        console.log(`[Product Detection] === Completed ${productionLine.code}: ${productsLinkedInThisLine} new product(s) linked ===`);
      } catch (error) {
        console.error(`[Product Detection] ✗ Error processing production line ${productionLine.id}:`, error);
      }
    }
    
    console.log(`[Product Detection] ========================================`);
    console.log(`[Product Detection] ✓ Total ${totalProductsLinked} new product(s) linked`);
    
    // NOW: Remove products that are no longer relevant
    console.log(`[Product Detection] Checking for products to remove...`);
    
    const currentlyLinkedResult = await pool.query(
      `SELECT np.product_id, p.code, p.name, p.geometry
       FROM notifications_products np
       JOIN products p ON p.id = np.product_id
       WHERE np.notification_id = $1 AND np.is_relevant = true AND p.is_active = true AND p.geometry IS NOT NULL`,
      [notificationId]
    );
    
    console.log(`[Product Detection] Found ${currentlyLinkedResult.rows.length} currently linked products to verify`);
    
    let productsRemoved = 0;
    
    for (const linkedProduct of currentlyLinkedResult.rows) {
      let stillIntersects = false;
      
      for (let geomIndex = 0; geomIndex < allGeometries.length; geomIndex++) {
        const geometry = allGeometries[geomIndex];
        
        try {
          const intersectionCheck = await pool.query(
            `SELECT EXISTS (
              SELECT 1
              WHERE ST_Intersects(
                ST_Force2D(ST_GeomFromGeoJSON($1)),
                ST_Force2D(ST_GeomFromGeoJSON($2))
              )
            ) as intersects`,
            [linkedProduct.geometry, geometry]
          );
          
          if (intersectionCheck.rows[0]?.intersects) {
            stillIntersects = true;
            break;
          }
        } catch (intersectError) {
          console.error(`[Product Detection]    ✗ Error checking intersection:`, intersectError);
        }
      }
      
      if (!stillIntersects) {
        try {
          await pool.query(
            'DELETE FROM notifications_products WHERE notification_id = $1 AND product_id = $2',
            [notificationId, linkedProduct.product_id]
          );
          productsRemoved++;
          console.log(`[Product Detection]       ✗ Removed: ${linkedProduct.code} - ${linkedProduct.name}`);
        } catch (removeError) {
          console.error(`[Product Detection]    ✗ Error removing product:`, removeError);
        }
      } else {
        linkedProductIds.add(linkedProduct.product_id);
      }
    }
    
    if (productsRemoved > 0) {
      console.log(`[Product Detection] ✓ Removed ${productsRemoved} product(s) that no longer intersect`);
    } else {
      console.log(`[Product Detection] ○ No products to remove`);
    }
    
    // Final state
    const finalCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM notifications_products WHERE notification_id = $1 AND is_relevant = true`,
      [notificationId]
    );
    console.log(`[Product Detection] ✓ Final: ${finalCountResult.rows[0].count} total products linked`);
    console.log(`[Product Detection] ========================================`);
    
  } catch (error) {
    console.error(`[Product Detection] ✗ Error:`, error);
  }
}

async function run() {
  try {
    await detectAndLinkProducts(18);
    await pool.end();
    console.log('\n✓ Product detection completed!');
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

run();
