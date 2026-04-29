/**
 * Test Zone Detection for Notification 12
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'cartis',
  user: 'postgres',
  password: '30W10b78*',
});

function pointInPolygon(point, polygon) {
  const [lon, lat] = point;
  let inside = false;
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

function pointInMultiPolygon(point, multiPolygon) {
  return multiPolygon.some(polygon => pointInPolygon(point, polygon));
}

async function testZoneDetection() {
  const client = await pool.connect();
  
  try {
    console.log('Testing zone detection for notification 12...\n');

    // Get all coordinates for notification 12
    const coordsResult = await client.query(
      `SELECT id, latitude, longitude, geometry FROM notification_coordinates WHERE notification_id = 12`
    );

    console.log(`Found ${coordsResult.rows.length} coordinates:`);
    const testPoints = [];
    
    coordsResult.rows.forEach((coord) => {
      if (coord.geometry) {
        let geom = typeof coord.geometry === 'string' ? JSON.parse(coord.geometry) : coord.geometry;
        // Handle double-encoded JSON
        if (typeof geom === 'string') {
          geom = JSON.parse(geom);
        }
        console.log(`  Coordinate ${coord.id}: ${geom.type} at [${geom.coordinates[0]}, ${geom.coordinates[1]}]`);
        if (geom.type === 'Point') {
          testPoints.push(geom.coordinates);
        }
      } else if (coord.latitude && coord.longitude && parseFloat(coord.latitude) !== 0) {
        testPoints.push([parseFloat(coord.longitude), parseFloat(coord.latitude)]);
        console.log(`  - Coordinate ${coord.id}: [${coord.longitude}, ${coord.latitude}]`);
      }
    });

    console.log(`\nTest points: ${JSON.stringify(testPoints)}\n`);

    // Get the Thornton zone
    const thorntonResult = await client.query(
      `SELECT id, code, name, geometry FROM kml_coverages WHERE LOWER(name) LIKE '%thorton%'`
    );

    if (thorntonResult.rows.length === 0) {
      console.log('Thornton zone not found!');
      return;
    }

    const thorntonZone = thorntonResult.rows[0];
    console.log(`Thornton zone found: ${thorntonZone.name} (ID: ${thorntonZone.id})`);

    const zoneGeom = JSON.parse(thorntonZone.geometry);
    console.log(`Zone geometry type: ${zoneGeom.type}\n`);

    // Test each point
    console.log('Testing each point against Thornton zone:');
    testPoints.forEach((point, index) => {
      let isInside = false;
      
      if (zoneGeom.type === 'Polygon') {
        isInside = pointInPolygon(point, zoneGeom.coordinates);
      } else if (zoneGeom.type === 'MultiPolygon') {
        isInside = pointInMultiPolygon(point, zoneGeom.coordinates);
      }
      
      console.log(`  Point ${index + 1} [${point[0]}, ${point[1]}]: ${isInside ? 'INSIDE' : 'OUTSIDE'}`);
    });

    // Check if Thornton zone is already in notification_zones
    const existingZone = await client.query(
      `SELECT * FROM notification_zones WHERE notification_id = 12 AND kml_coverage_id = $1`,
      [thorntonZone.id]
    );

    console.log(`\nThornton zone in notification_zones: ${existingZone.rows.length > 0 ? 'YES' : 'NO'}`);

    // Get all zones for notification 12
    const allZones = await client.query(
      `SELECT nz.zone_name, nz.detection_method FROM notification_zones nz WHERE nz.notification_id = 12`
    );

    console.log(`\nCurrent zones for notification 12 (${allZones.rows.length} total):`);
    allZones.rows.forEach(zone => {
      console.log(`  - ${zone.zone_name} (${zone.detection_method})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testZoneDetection();
