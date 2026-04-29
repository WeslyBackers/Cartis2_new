// Trigger product detection for all notifications
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

async function detectProducts(notificationId, code) {
  try {
    console.log(`\n[${code}] Starting product detection...`);
    
    // Get notification geometry
    const notificationResult = await pool.query(
      'SELECT geometry FROM notifications WHERE id = $1',
      [notificationId]
    );
    
    const mainGeometry = notificationResult.rows[0]?.geometry;
    
    if (!mainGeometry) {
      console.log(`[${code}] No geometry found, skipping`);
      return;
    }

    const allGeometries = [];
    try {
      const geomObj = typeof mainGeometry === 'string' ? JSON.parse(mainGeometry) : mainGeometry;
      const cleanedGeom = removeZCoordinates(geomObj);
      allGeometries.push(JSON.stringify(cleanedGeom));
    } catch (e) {
      console.error(`[${code}] Error parsing geometry:`, e.message);
      return;
    }

    // Get all active production lines
    const productionLinesResult = await pool.query(
      'SELECT id, code, name FROM production_lines WHERE is_active = true ORDER BY id'
    );

    let totalProductsLinked = 0;
    const linkedProductIds = new Set();

    // For each production line, find and link intersecting products
    for (const productionLine of productionLinesResult.rows) {
      for (const geometry of allGeometries) {
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

          for (const product of intersectingProducts.rows) {
            if (!linkedProductIds.has(product.id)) {
              await pool.query(
                `INSERT INTO notifications_products (notification_id, product_id, is_relevant)
                VALUES ($1, $2, true)
                ON CONFLICT (notification_id, product_id) 
                DO UPDATE SET is_relevant = true`,
                [notificationId, product.id]
              );
              
              linkedProductIds.add(product.id);
              totalProductsLinked++;
            }
          }
        } catch (err) {
          console.error(`[${code}] Error for ${productionLine.code}:`, err.message);
        }
      }
    }
    
    console.log(`[${code}] ✓ Linked ${totalProductsLinked} product(s)`);
    
  } catch (error) {
    console.error(`[${code}] Error:`, error.message);
  }
}

async function detectAllNotifications() {
  try {
    console.log('='.repeat(60));
    console.log('TRIGGERING PRODUCT DETECTION FOR ALL NOTIFICATIONS');
    console.log('='.repeat(60));
    
    const result = await pool.query(`
      SELECT id, code
      FROM notifications
      WHERE geometry IS NOT NULL
      ORDER BY id
    `);
    
    console.log(`Found ${result.rows.length} notifications with geometry`);
    
    for (const notification of result.rows) {
      await detectProducts(notification.id, notification.code);
    }
    
    console.log();
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    
    const summary = await pool.query(`
      SELECT n.code, COUNT(np.product_id) as product_count
      FROM notifications n
      LEFT JOIN notifications_products np ON n.id = np.notification_id
      GROUP BY n.code
      ORDER BY n.code
    `);
    
    summary.rows.forEach(row => {
      console.log(`${row.code.padEnd(20)} ${row.product_count} products`);
    });
    
    console.log();
    console.log('✓ Product detection completed for all notifications');
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

detectAllNotifications();
