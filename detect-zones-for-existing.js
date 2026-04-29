/**
 * Detect Zones for Existing Notifications
 * 
 * This script runs zone detection for all existing notifications in the database.
 */

const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
function pointInPolygon(point, polygon) {
  const [lon, lat] = point;
  let inside = false;

  // Get the outer ring (first element of polygon coordinates)
  const ring = polygon[0];

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Check if a point is inside a MultiPolygon
 */
function pointInMultiPolygon(point, multiPolygon) {
  return multiPolygon.some(polygon => pointInPolygon(point, polygon));
}

/**
 * Extract all points from a geometry
 */
function extractPointsFromGeometry(geometry) {
  const points = [];

  switch (geometry.type) {
    case 'Point':
      points.push(geometry.coordinates);
      break;

    case 'MultiPoint':
      points.push(...geometry.coordinates);
      break;

    case 'LineString':
      points.push(...geometry.coordinates);
      break;

    case 'MultiLineString':
      geometry.coordinates.forEach(line => {
        points.push(...line);
      });
      break;

    case 'Polygon':
      // Only use outer ring for testing
      points.push(...geometry.coordinates[0]);
      break;

    case 'MultiPolygon':
      // Only use outer rings
      geometry.coordinates.forEach(polygon => {
        points.push(...polygon[0]);
      });
      break;

    case 'GeometryCollection':
      geometry.coordinates.forEach(geom => {
        points.push(...extractPointsFromGeometry(geom));
      });
      break;
  }

  return points;
}

/**
 * Detect affected zones for a notification
 */
async function detectAffectedZones(client, notificationId) {
  // Get the notification geometry and any additional coordinates
  const notificationResult = await client.query(
    `SELECT geometry FROM notifications WHERE id = $1`,
    [notificationId]
  );

  if (notificationResult.rows.length === 0) {
    return [];
  }

  const notificationGeometry = notificationResult.rows[0].geometry;
  
  // Collect all points to test
  const testPoints = [];

  // Parse notification geometry if it exists
  if (notificationGeometry) {
    try {
      let geom = typeof notificationGeometry === 'string'
        ? JSON.parse(notificationGeometry)
        : notificationGeometry;
      // Handle double-encoded JSON (stored as stringified JSON string)
      if (typeof geom === 'string') {
        geom = JSON.parse(geom);
      }
      testPoints.push(...extractPointsFromGeometry(geom));
    } catch (error) {
      console.error(`  ⚠ Error parsing notification ${notificationId} geometry:`, error.message);
    }
  }

  // Get additional coordinates from notification_coordinates table if it exists
  try {
    const coordsResult = await client.query(
      `SELECT latitude, longitude, geometry FROM notification_coordinates WHERE notification_id = $1`,
      [notificationId]
    );

    coordsResult.rows.forEach(coord => {
      if (coord.geometry) {
        try {
          let geom = typeof coord.geometry === 'string'
            ? JSON.parse(coord.geometry)
            : coord.geometry;
          // Handle double-encoded JSON (stored as stringified JSON string)
          if (typeof geom === 'string') {
            geom = JSON.parse(geom);
          }
          testPoints.push(...extractPointsFromGeometry(geom));
        } catch (error) {
          // Ignore parsing errors for additional coordinates
        }
      } else if (coord.latitude && coord.longitude && parseFloat(coord.latitude) !== 0) {
        // Note: GeoJSON uses [longitude, latitude] order
        testPoints.push([parseFloat(coord.longitude), parseFloat(coord.latitude)]);
      }
    });
  } catch (error) {
    // Table might not exist, continue without additional coordinates
  }

  if (testPoints.length === 0) {
    return [];
  }

  // Get all zone coverages
  const zonesResult = await client.query(
    `SELECT c.id, c.code, c.name, c.geometry
     FROM kml_coverages c
     JOIN kml_files f ON c.kml_file_id = f.id
     WHERE f.category = 'zones'`
  );

  const affectedZones = [];

  // Test each zone
  for (const zone of zonesResult.rows) {
    try {
      const zoneGeometry = typeof zone.geometry === 'string'
        ? JSON.parse(zone.geometry)
        : zone.geometry;

      // Check if any notification point falls within this zone
      const isAffected = testPoints.some(point => {
        if (zoneGeometry.type === 'Polygon') {
          return pointInPolygon(point, zoneGeometry.coordinates);
        } else if (zoneGeometry.type === 'MultiPolygon') {
          return pointInMultiPolygon(point, zoneGeometry.coordinates);
        }
        return false;
      });

      if (isAffected) {
        affectedZones.push({
          id: zone.id,
          code: zone.code,
          name: zone.name
        });
      }
    } catch (error) {
      console.error(`  ⚠ Error processing zone ${zone.code}:`, error.message);
    }
  }

  return affectedZones;
}

/**
 * Update notification zones in the database
 */
async function updateNotificationZones(client, notificationId, zones) {
  // Delete existing automatic detections
  await client.query(
    `DELETE FROM notification_zones 
     WHERE notification_id = $1 AND detection_method = 'automatic'`,
    [notificationId]
  );

  // Insert new zone detections
  for (const zone of zones) {
    await client.query(
      `INSERT INTO notification_zones 
       (notification_id, kml_coverage_id, zone_code, zone_name, detection_method)
       VALUES ($1, $2, $3, $4, 'automatic')
       ON CONFLICT (notification_id, kml_coverage_id) DO NOTHING`,
      [notificationId, zone.id, zone.code, zone.name]
    );
  }
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Zone Detection for Existing Notifications');
  console.log('='.repeat(60));
  console.log('');

  const client = await pool.connect();
  
  try {
    // Check if notification_zones table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'notification_zones'
      ) as exists
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ notification_zones table does not exist.');
      console.log('');
      console.log('Please run the database migration first:');
      console.log('  psql -h localhost -U postgres -d cartis -f backend/database/add-notification-zones.sql');
      console.log('');
      process.exit(1);
    }

    // Check if zones have been imported
    const zonesCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM kml_coverages c
      JOIN kml_files f ON c.kml_file_id = f.id
      WHERE f.category = 'zones'
    `);

    const zoneCount = parseInt(zonesCheck.rows[0].count);
    
    if (zoneCount === 0) {
      console.log('❌ No zones found in the database.');
      console.log('');
      console.log('Please import KML zone files first:');
      console.log('  npm run import:kml');
      console.log('');
      process.exit(1);
    }

    console.log(`✓ Found ${zoneCount} zones in database`);
    console.log('');

    // Get all notifications
    const notificationsResult = await client.query(
      `SELECT id, code, title FROM notifications ORDER BY id`
    );

    const totalNotifications = notificationsResult.rows.length;
    
    if (totalNotifications === 0) {
      console.log('No notifications found in database.');
      process.exit(0);
    }

    console.log(`Processing ${totalNotifications} notifications...`);
    console.log('');

    await client.query('BEGIN');

    let processed = 0;
    let withZones = 0;
    let withoutZones = 0;
    let errors = 0;

    for (const notification of notificationsResult.rows) {
      try {
        const zones = await detectAffectedZones(client, notification.id);
        await updateNotificationZones(client, notification.id, zones);
        
        processed++;
        
        if (zones.length > 0) {
          withZones++;
          const zoneList = zones.map(z => z.name).join(', ');
          console.log(`✓ [${notification.id}] ${notification.code || 'N/A'} - ${zones.length} zone(s): ${zoneList}`);
        } else {
          withoutZones++;
          console.log(`○ [${notification.id}] ${notification.code || 'N/A'} - No zones detected`);
        }
      } catch (error) {
        errors++;
        console.error(`✗ [${notification.id}] Error: ${error.message}`);
      }
    }

    await client.query('COMMIT');

    console.log('');
    console.log('='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`Total notifications: ${totalNotifications}`);
    console.log(`Processed: ${processed}`);
    console.log(`With zones: ${withZones}`);
    console.log(`Without zones: ${withoutZones}`);
    console.log(`Errors: ${errors}`);
    console.log('');
    console.log('✓ Zone detection completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('');
    console.error('✗ Error:', error);
    console.error('');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
