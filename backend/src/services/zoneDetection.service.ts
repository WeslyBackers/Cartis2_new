/**
 * Zone Detection Service
 * Determines which geographic zones are affected by a notification's coordinates/geometry
 */

import pool from '../config/database';

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
    
    // Collect all geometries to test against zone polygons
    const testGeometries: string[] = [];

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
            testGeometries.push(JSON.stringify(singleGeometry));
          });
        } catch (error) {
          console.error('Error parsing coordinate geometry:', error);
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

    if (testGeometries.length === 0) {
      return [];
    }

    const affectedZoneIds = new Set<number>();

    // Test each notification geometry against all zones using PostGIS intersections.
    for (const geometry of testGeometries) {
      try {
        const zonesResult = await client.query(
          `SELECT DISTINCT c.id
           FROM kml_coverages c
           JOIN kml_files f ON c.kml_file_id = f.id
           WHERE f.category = 'zones'
             AND ST_Intersects(
               ST_MakeValid(ST_Force2D(ST_GeomFromGeoJSON(c.geometry::text))),
               ST_MakeValid(ST_Force2D(ST_GeomFromGeoJSON($1)))
             )`,
          [geometry]
        );

        for (const zone of zonesResult.rows) {
          affectedZoneIds.add(zone.id);
        }
      } catch (error) {
        console.error('Error processing notification geometry for zone detection:', error);
      }
    }

    return Array.from(affectedZoneIds);

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
