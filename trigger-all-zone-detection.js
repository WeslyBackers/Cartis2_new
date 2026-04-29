// Trigger zone detection for all new notifications
require('dotenv').config({ path: './backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

// Import the zone detection logic (we'll replicate it here)
async function detectZonesForNotification(notificationId) {
  try {
    // Get notification geometry
    const notificationResult = await pool.query(
      'SELECT id, code, geometry FROM notifications WHERE id = $1',
      [notificationId]
    );

    if (notificationResult.rows.length === 0) {
      return { zones: [] };
    }

    const notification = notificationResult.rows[0];
    if (!notification.geometry) {
      return { zones: [] };
    }

    // Get additional coordinates
    const coordinatesResult = await pool.query(
      'SELECT id, geometry, latitude, longitude FROM notification_coordinates WHERE notification_id = $1',
      [notificationId]
    );

    // Collect all geometries
    const allGeometries = [];
    
    // Add main geometry
    try {
      const geom = typeof notification.geometry === 'string' 
        ? JSON.parse(notification.geometry) 
        : notification.geometry;
      allGeometries.push(JSON.stringify(geom));
    } catch (e) {
      console.error(`Error parsing main geometry: ${e.message}`);
    }

    // Add coordinate geometries
    coordinatesResult.rows.forEach(coord => {
      if (coord.geometry) {
        try {
          const geom = typeof coord.geometry === 'string' 
            ? JSON.parse(coord.geometry) 
            : coord.geometry;
          allGeometries.push(JSON.stringify(geom));
        } catch (e) {
          console.error(`Error parsing coordinate geometry: ${e.message}`);
        }
      }
    });

    if (allGeometries.length === 0) {
      return { zones: [] };
    }

    // Get all available zones
    const zonesResult = await pool.query(
      'SELECT id, code, name, geometry FROM kml_coverages WHERE geometry IS NOT NULL ORDER BY id'
    );

    const detectedZones = [];

    // Check each geometry against each zone
    for (const notifGeom of allGeometries) {
      for (const zone of zonesResult.rows) {
        try {
          // Check if the notification geometry intersects with the zone
          const intersectionResult = await pool.query(
            `SELECT ST_Intersects(
              ST_Force2D(ST_GeomFromGeoJSON($1)),
              ST_Force2D(ST_GeomFromGeoJSON($2))
            ) as intersects`,
            [zone.geometry, notifGeom]
          );

          if (intersectionResult.rows[0]?.intersects) {
            // Check if not already added
            if (!detectedZones.find(z => z.kml_coverage_id === zone.id)) {
              detectedZones.push({
                kml_coverage_id: zone.id,
                zone_code: zone.code,
                zone_name: zone.name
              });
            }
          }
        } catch (err) {
          console.error(`Error checking zone ${zone.code}:`, err.message);
        }
      }
    }

    // Clear existing zones for this notification
    await pool.query(
      'DELETE FROM notification_zones WHERE notification_id = $1',
      [notificationId]
    );

    // Insert detected zones
    for (const zone of detectedZones) {
      await pool.query(
        `INSERT INTO notification_zones (notification_id, kml_coverage_id, zone_code, zone_name, detection_method)
         VALUES ($1, $2, $3, $4, $5)`,
        [notificationId, zone.kml_coverage_id, zone.zone_code, zone.zone_name, 'automatic']
      );
    }

    return { zones: detectedZones };

  } catch (error) {
    console.error(`Error detecting zones for notification ${notificationId}:`, error);
    return { zones: [] };
  }
}

async function triggerAllZoneDetection() {
  try {
    console.log('='.repeat(60));
    console.log('TRIGGERING ZONE DETECTION FOR ALL NOTIFICATIONS');
    console.log('='.repeat(60));
    console.log();

    const result = await pool.query(`
      SELECT id, code, geometry IS NOT NULL as has_geometry
      FROM notifications
      ORDER BY id
    `);

    console.log(`Found ${result.rows.length} notifications\n`);

    for (const notification of result.rows) {
      if (!notification.has_geometry) {
        console.log(`[${notification.code}] No geometry, skipping`);
        continue;
      }

      console.log(`[${notification.code}] Detecting zones...`);
      const result = await detectZonesForNotification(notification.id);
      console.log(`[${notification.code}] ✓ Detected ${result.zones.length} zone(s)`);
      
      if (result.zones.length > 0) {
        result.zones.forEach(z => {
          console.log(`  - ${z.zone_code}: ${z.zone_name}`);
        });
      }
    }

    console.log();
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));

    const summary = await pool.query(`
      SELECT n.code, COUNT(nz.id) as zone_count
      FROM notifications n
      LEFT JOIN notification_zones nz ON n.id = nz.notification_id
      GROUP BY n.code
      ORDER BY n.code
    `);

    summary.rows.forEach(row => {
      console.log(`${row.code.padEnd(20)} ${row.zone_count} zones`);
    });

    console.log();
    console.log('✓ Zone detection completed for all notifications');

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

triggerAllZoneDetection();
