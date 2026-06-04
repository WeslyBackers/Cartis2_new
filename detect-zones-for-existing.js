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

function removeZCoordinates(geojson) {
  if (!geojson) {
    return geojson;
  }

  if (geojson.type === 'Feature') {
    return {
      ...geojson,
      geometry: removeZCoordinates(geojson.geometry)
    };
  }

  if (geojson.type === 'FeatureCollection') {
    return {
      ...geojson,
      features: (geojson.features || []).map((feature) => removeZCoordinates(feature))
    };
  }

  if (geojson.type === 'GeometryCollection') {
    return {
      ...geojson,
      geometries: (geojson.geometries || []).map((geometry) => removeZCoordinates(geometry))
    };
  }

  if (!geojson.coordinates) {
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

function extractIndividualGeometries(geojson) {
  if (!geojson) {
    return [];
  }

  if (geojson.type === 'FeatureCollection') {
    return (geojson.features || []).flatMap((feature) =>
      extractIndividualGeometries(feature?.geometry)
    );
  }

  if (geojson.type === 'Feature') {
    return extractIndividualGeometries(geojson.geometry);
  }

  if (geojson.type === 'GeometryCollection') {
    return (geojson.geometries || []).flatMap((geometry) =>
      extractIndividualGeometries(geometry)
    );
  }

  if (geojson.type && geojson.coordinates) {
    return [geojson];
  }

  return [];
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
  
  // Collect all geometries to test against zone polygons
  const testGeometries = [];

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
      const cleanedGeom = removeZCoordinates(geom);
      const extractedGeometries = extractIndividualGeometries(cleanedGeom);
      extractedGeometries.forEach((singleGeometry) => {
        testGeometries.push(JSON.stringify(singleGeometry));
      });
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
          const cleanedGeom = removeZCoordinates(geom);
          const extractedGeometries = extractIndividualGeometries(cleanedGeom);
          extractedGeometries.forEach((singleGeometry) => {
            testGeometries.push(JSON.stringify(singleGeometry));
          });
        } catch (error) {
          // Ignore parsing errors for additional coordinates
        }
      } else if (coord.latitude && coord.longitude && parseFloat(coord.latitude) !== 0) {
        // Note: GeoJSON uses [longitude, latitude] order
        testGeometries.push(
          JSON.stringify({
            type: 'Point',
            coordinates: [parseFloat(coord.longitude), parseFloat(coord.latitude)]
          })
        );
      }
    });
  } catch (error) {
    // Table might not exist, continue without additional coordinates
  }

  if (testGeometries.length === 0) {
    return [];
  }

  const affectedZones = new Map();

  // Test each geometry against all zones using PostGIS intersections.
  for (const geometry of testGeometries) {
    try {
      const zonesResult = await client.query(
        `SELECT DISTINCT c.id, c.code, c.name
         FROM kml_coverages c
         JOIN kml_files f ON c.kml_file_id = f.id
         WHERE f.category = 'zones'
           AND ST_Intersects(
             ST_MakeValid(ST_Force2D(ST_GeomFromGeoJSON(c.geometry::text))),
             ST_MakeValid(ST_Force2D(ST_GeomFromGeoJSON($1)))
           )`,
        [geometry]
      );

      zonesResult.rows.forEach((zone) => {
        affectedZones.set(zone.id, {
          id: zone.id,
          code: zone.code,
          name: zone.name
        });
      });
    } catch (error) {
      console.error('  ⚠ Error processing geometry for zone detection:', error.message);
    }
  }

  return Array.from(affectedZones.values());
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
