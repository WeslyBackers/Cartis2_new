/**
 * Zone Detection Service
 * Determines which geographic zones are affected by a notification's coordinates/geometry
 */

import pool from '../config/database';

interface Point {
  latitude: number;
  longitude: number;
}

interface GeoJSONGeometry {
  type: string;
  coordinates: any[];
}

function removeZCoordinates(geojson: any): any {
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
      features: (geojson.features || []).map((feature: any) => removeZCoordinates(feature))
    };
  }

  if (geojson.type === 'GeometryCollection') {
    return {
      ...geojson,
      geometries: (geojson.geometries || []).map((geometry: any) => removeZCoordinates(geometry))
    };
  }

  if (!geojson.coordinates) {
    return geojson;
  }

  const cleanCoords = (coords: any): any => {
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

function extractIndividualGeometries(geojson: any): any[] {
  if (!geojson) {
    return [];
  }

  if (geojson.type === 'FeatureCollection') {
    return (geojson.features || []).flatMap((feature: any) =>
      extractIndividualGeometries(feature?.geometry)
    );
  }

  if (geojson.type === 'Feature') {
    return extractIndividualGeometries(geojson.geometry);
  }

  if (geojson.type === 'GeometryCollection') {
    return (geojson.geometries || []).flatMap((geometry: any) =>
      extractIndividualGeometries(geometry)
    );
  }

  if (geojson.type && geojson.coordinates) {
    return [geojson];
  }

  return [];
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 */
function pointInPolygon(point: [number, number], polygon: number[][][]): boolean {
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
function pointInMultiPolygon(point: [number, number], multiPolygon: number[][][][]): boolean {
  return multiPolygon.some(polygon => pointInPolygon(point, polygon));
}

/**
 * Extract all points from a geometry
 */
function extractPointsFromGeometry(geometry: GeoJSONGeometry): [number, number][] {
  const points: [number, number][] = [];

  switch (geometry.type) {
    case 'Point':
      points.push(geometry.coordinates as [number, number]);
      break;

    case 'MultiPoint':
      points.push(...(geometry.coordinates as [number, number][]));
      break;

    case 'LineString':
      points.push(...(geometry.coordinates as [number, number][]));
      break;

    case 'MultiLineString':
      geometry.coordinates.forEach(line => {
        points.push(...(line as [number, number][]));
      });
      break;

    case 'Polygon':
      // Only use outer ring for testing
      points.push(...(geometry.coordinates[0] as [number, number][]));
      break;

    case 'MultiPolygon':
      // Only use outer rings
      geometry.coordinates.forEach(polygon => {
        points.push(...(polygon[0] as [number, number][]));
      });
      break;
  }

  return points;
}

/**
 * Detect which zones contain or intersect with a notification's geometry
 */
export async function detectAffectedZones(notificationId: number): Promise<number[]> {
  const client = await pool.connect();
  
  try {
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
    const testPoints: [number, number][] = [];

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
          testPoints.push(...extractPointsFromGeometry(singleGeometry));
        });
      } catch (error) {
        console.error('Error parsing notification geometry:', error);
      }
    }

    // Get additional coordinates from notification_coordinates table
    const coordsResult = await client.query(
      `SELECT latitude, longitude, geometry FROM notification_coordinates WHERE notification_id = $1`,
      [notificationId]
    );

    coordsResult.rows.forEach((coord: any) => {
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
            testPoints.push(...extractPointsFromGeometry(singleGeometry));
          });
        } catch (error) {
          console.error('Error parsing coordinate geometry:', error);
        }
      } else if (coord.latitude && coord.longitude && parseFloat(coord.latitude) !== 0) {
        // Note: GeoJSON uses [longitude, latitude] order
        testPoints.push([parseFloat(coord.longitude), parseFloat(coord.latitude)]);
      }
    });

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

    const affectedZoneIds: number[] = [];

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
          affectedZoneIds.push(zone.id);
        }
      } catch (error) {
        console.error(`Error processing zone ${zone.code}:`, error);
      }
    }

    return affectedZoneIds;

  } finally {
    client.release();
  }
}

/**
 * Update notification zones in the database
 */
export async function updateNotificationZones(
  notificationId: number,
  zoneIds: number[]
): Promise<void> {
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
      console.warn('notification_zones table does not exist yet. Skipping zone update.');
      return;
    }

    await client.query('BEGIN');

    // Delete existing automatic detections
    await client.query(
      `DELETE FROM notification_zones 
       WHERE notification_id = $1 AND detection_method = 'automatic'`,
      [notificationId]
    );

    // Insert new zone detections
    if (zoneIds.length > 0) {
      for (const zoneId of zoneIds) {
        // Get zone information and verify it's actually a zone
        const zoneResult = await client.query(
          `SELECT c.code, c.name, f.category
           FROM kml_coverages c
           JOIN kml_files f ON c.kml_file_id = f.id
           WHERE c.id = $1`,
          [zoneId]
        );

        if (zoneResult.rows.length > 0) {
          const zone = zoneResult.rows[0];
          
          // Only insert if it's actually a zone (safeguard against products)
          if (zone.category === 'zones') {
            await client.query(
              `INSERT INTO notification_zones 
               (notification_id, kml_coverage_id, zone_code, zone_name, detection_method)
               VALUES ($1, $2, $3, $4, 'automatic')
               ON CONFLICT (notification_id, kml_coverage_id) DO NOTHING`,
              [notificationId, zoneId, zone.code, zone.name]
            );
          } else {
            console.warn(`Skipping coverage ${zoneId} (${zone.code}): category is '${zone.category}', not 'zones'`);
          }
        }
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Detect and update zones for a notification
 */
export async function detectAndUpdateZones(notificationId: number): Promise<string[]> {
  const zoneIds = await detectAffectedZones(notificationId);
  await updateNotificationZones(notificationId, zoneIds);
  
  // Return zone codes for convenience
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT zone_code FROM notification_zones WHERE notification_id = $1`,
      [notificationId]
    );
    return result.rows.map((row: any) => row.zone_code);
  } finally {
    client.release();
  }
}

/**
 * Manually add a zone to a notification
 */
export async function addManualZone(
  notificationId: number,
  zoneCoverageId: number
): Promise<void> {
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
      throw new Error('notification_zones table does not exist. Please run the database migration.');
    }

    // Get zone information and verify it's actually a zone (not a product)
    const zoneResult = await client.query(
      `SELECT c.code, c.name, f.category 
       FROM kml_coverages c
       JOIN kml_files f ON c.kml_file_id = f.id
       WHERE c.id = $1`,
      [zoneCoverageId]
    );

    if (zoneResult.rows.length === 0) {
      throw new Error('Zone not found');
    }

    const zone = zoneResult.rows[0];

    // Verify it's actually a zone, not a product
    if (zone.category !== 'zones') {
      throw new Error(`Cannot add coverage as zone: it is a ${zone.category}, not a zone`);
    }

    // Insert or update
    await client.query(
      `INSERT INTO notification_zones 
       (notification_id, kml_coverage_id, zone_code, zone_name, detection_method)
       VALUES ($1, $2, $3, $4, 'manual')
       ON CONFLICT (notification_id, kml_coverage_id) 
       DO UPDATE SET detection_method = 'manual', detected_at = CURRENT_TIMESTAMP`,
      [notificationId, zoneCoverageId, zone.code, zone.name]
    );
  } finally {
    client.release();
  }
}

/**
 * Remove a zone from a notification
 */
export async function removeZone(
  notificationId: number,
  zoneCoverageId: number
): Promise<void> {
  await pool.query(
    `DELETE FROM notification_zones 
     WHERE notification_id = $1 AND kml_coverage_id = $2`,
    [notificationId, zoneCoverageId]
  );
}
