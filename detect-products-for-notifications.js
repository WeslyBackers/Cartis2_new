/**
 * Detect and Link Products to Existing Notifications
 * 
 * This script analyzes all existing notifications and automatically links products
 * that have overlapping geometries, organized by production line.
 * 
 * Usage:
 *   node detect-products-for-notifications.js           # Add new links only
 *   node detect-products-for-notifications.js --reset   # Clear all links and redetect
 */

const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

// Check command line arguments
const shouldReset = process.argv.includes('--reset') || process.argv.includes('-r');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

/**
 * Check if PostGIS is available
 */
async function checkPostGIS(client) {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'postgis'
      ) as has_postgis
    `);
    return result.rows[0].has_postgis;
  } catch (error) {
    return false;
  }
}

/**
 * Get all production lines
 */
async function getProductionLines(client) {
  const result = await client.query(`
    SELECT id, code, name 
    FROM production_lines 
    WHERE is_active = true
    ORDER BY id
  `);
  return result.rows;
}

/**
 * Get all notifications with geometry
 */
async function getNotificationsWithGeometry(client) {
  const result = await client.query(`
    SELECT id, code, title, geometry
    FROM notifications
    WHERE geometry IS NOT NULL
    ORDER BY id
  `);
  return result.rows;
}

/**
 * Find products that intersect with notification geometry for a specific production line
 */
async function findIntersectingProducts(client, notificationId, notificationGeometry, productionLineId) {
  try {
    const result = await client.query(`
      SELECT p.id, p.code, p.name, p.type
      FROM products p
      WHERE p.production_line_id = $1
        AND p.is_active = true
        AND p.geometry IS NOT NULL
        AND ST_Intersects(
          ST_GeomFromGeoJSON(p.geometry),
          ST_GeomFromGeoJSON($2)
        )
    `, [productionLineId, notificationGeometry]);
    
    return result.rows;
  } catch (error) {
    console.error(`  Error finding products: ${error.message}`);
    return [];
  }
}

/**
 * Clear all product links
 */
async function clearAllProductLinks(client) {
  try {
    const result = await client.query(`
      DELETE FROM notifications_products
      WHERE TRUE
    `);
    return result.rowCount || 0;
  } catch (error) {
    console.error(`Error clearing product links: ${error.message}`);
    throw error;
  }
}

/**
 * Link product to notification
 */
async function linkProduct(client, notificationId, productId) {
  try {
    await client.query(`
      INSERT INTO notifications_products (notification_id, product_id, is_relevant)
      VALUES ($1, $2, true)
      ON CONFLICT (notification_id, product_id) DO NOTHING
    `, [notificationId, productId]);
    return true;
  } catch (error) {
    console.error(`  Error linking product ${productId}: ${error.message}`);
    return false;
  }
}

/**
 * Get existing product links for a notification
 */
async function getExistingLinks(client, notificationId) {
  const result = await client.query(`
    SELECT product_id
    FROM notifications_products
    WHERE notification_id = $1
  `, [notificationId]);
  return new Set(result.rows.map(r => r.product_id));
}

/**
 * Process a single notification
 */
async function processNotification(client, notification, productionLines, stats) {
  console.log(`\n[${notification.id}] ${notification.code || 'NO-CODE'} - ${notification.title?.substring(0, 60) || 'NO-TITLE'}...`);
  
  if (!notification.geometry) {
    console.log('  ⊘ No geometry - skipping');
    stats.skipped++;
    return;
  }

  // Get existing links
  const existingLinks = await getExistingLinks(client, notification.id);
  let notificationHasNewLinks = false;
  let totalProductsForNotification = 0;

  // Process each production line
  for (const pl of productionLines) {
    const products = await findIntersectingProducts(
      client,
      notification.id,
      notification.geometry,
      pl.id
    );

    if (products.length > 0) {
      console.log(`  ${pl.name} (${pl.code}): ${products.length} product(s)`);
      
      let newLinksForPL = 0;
      for (const product of products) {
        totalProductsForNotification++;
        
        if (!existingLinks.has(product.id)) {
          const linked = await linkProduct(client, notification.id, product.id);
          if (linked) {
            newLinksForPL++;
            notificationHasNewLinks = true;
            stats.productsLinked++;
          }
        } else {
          stats.alreadyLinked++;
        }
      }
      
      if (newLinksForPL > 0) {
        console.log(`    ✓ Linked ${newLinksForPL} new product(s)`);
      } else {
        console.log(`    ○ All products already linked`);
      }
    }
  }

  if (totalProductsForNotification === 0) {
    console.log('  ○ No products found with overlapping geometry');
    stats.noProducts++;
  } else if (notificationHasNewLinks) {
    stats.notificationsWithNewLinks++;
  }

  stats.processed++;
}

/**
 * Main detection function
 */
async function detectProducts() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(70));
    console.log('Product Detection for Existing Notifications');
    if (shouldReset) {
      console.log('MODE: RESET - Clear all existing links and redetect');
    } else {
      console.log('MODE: ADD - Only add new links (existing links preserved)');
    }
    console.log('='.repeat(70));
    
    // Check PostGIS
    console.log('\nChecking PostGIS extension...');
    const hasPostGIS = await checkPostGIS(client);
    if (!hasPostGIS) {
      console.error('✗ PostGIS extension is not enabled!');
      console.error('  Run: psql -U postgres -d cartis -f backend/database/enable-postgis.sql');
      process.exit(1);
    }
    console.log('✓ PostGIS is enabled');

    // Start transaction
    await client.query('BEGIN');

    // Clear existing links if reset mode
    if (shouldReset) {
      console.log('\nClearing all existing product links...');
      const clearedCount = await clearAllProductLinks(client);
      console.log(`✓ Cleared ${clearedCount} existing product link(s)`);
    }

    // Get production lines
    console.log('\nLoading production lines...');
    const productionLines = await getProductionLines(client);
    console.log(`✓ Found ${productionLines.length} active production line(s):`);
    productionLines.forEach(pl => console.log(`  - ${pl.name} (${pl.code})`));

    // Get notifications
    console.log('\nLoading notifications with geometry...');
    const notifications = await getNotificationsWithGeometry(client);
    console.log(`✓ Found ${notifications.length} notification(s) with geometry`);

    if (notifications.length === 0) {
      console.log('\nNo notifications to process. Exiting.');
      await client.query('COMMIT');
      return;
    }

    // Statistics
    const stats = {
      processed: 0,
      skipped: 0,
      noProducts: 0,
      notificationsWithNewLinks: 0,
      productsLinked: 0,
      alreadyLinked: 0,
    };

    // Process each notification
    console.log('\nProcessing notifications...');
    console.log('-'.repeat(70));

    for (const notification of notifications) {
      await processNotification(client, notification, productionLines, stats);
    }

    await client.query('COMMIT');

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('Detection Summary');
    console.log('='.repeat(70));
    console.log(`Total notifications processed: ${stats.processed}`);
    console.log(`Notifications skipped (no geometry): ${stats.skipped}`);
    console.log(`Notifications with no matching products: ${stats.noProducts}`);
    if (shouldReset) {
      console.log(`Notifications with product links: ${stats.notificationsWithNewLinks}`);
    } else {
      console.log(`Notifications with new product links: ${stats.notificationsWithNewLinks}`);
    }
    console.log(`\nTotal products linked (new): ${stats.productsLinked}`);
    if (!shouldReset) {
      console.log(`Total products already linked: ${stats.alreadyLinked}`);
    }
    console.log(`Total product-notification relationships: ${stats.productsLinked + stats.alreadyLinked}`);
    
    console.log('\n✓ Detection completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n✗ Detection failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run detection
if (require.main === module) {
  detectProducts()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { detectProducts };
