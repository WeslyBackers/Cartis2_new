import { Router } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import upload from '../middleware/upload.middleware';
import { detectAndUpdateZones, addManualZone, removeZone } from '../services/zoneDetection.service';
import { createHpdProjectForTask } from '../services/hpdProject.service';
import { getOrCreateInProgressProductVersion } from '../services/productVersion.service';
import { ensureCorrectionListTaskLink } from '../services/correctionList.service';

const router = Router();

// Helper function to remove Z coordinates from GeoJSON
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
      // Single coordinate pair/triple - return only [x, y]
      return [coords[0], coords[1]];
    }
    // Array of coordinates - recursively clean
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

// Check if notification_zones table exists (cache the result)
let zonesTableExists: boolean = false;
let zonesTableChecked: boolean = false;

async function checkZonesTableExists(): Promise<boolean> {
  if (zonesTableChecked) {
    return zonesTableExists;
  }
  
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'notification_zones'
      ) as exists
    `);
    zonesTableExists = result.rows[0].exists;
    zonesTableChecked = true;
    return zonesTableExists;
  } catch (error) {
    console.error('Error checking zones table:', error);
    zonesTableExists = false;
    zonesTableChecked = true;
    return false;
  }
}

/**
 * Detect and link products for a notification across all production lines
 * This is called automatically when a notification is created or updated with geometry
 */
async function detectAndLinkProductsForNotification(notificationId: number): Promise<void> {
  try {
    console.log(`[Product Detection] Starting detection for notification ${notificationId}`);
    
    // Get notification main geometry
    const notificationResult = await pool.query(
      'SELECT geometry FROM notifications WHERE id = $1',
      [notificationId]
    );
    
    const mainGeometry = notificationResult.rows[0]?.geometry;

    // Get additional geometries from notification_coordinates (including lat/lon-only coordinates)
    const coordinatesResult = await pool.query(
      'SELECT id, geometry, latitude, longitude FROM notification_coordinates WHERE notification_id = $1 AND (geometry IS NOT NULL OR (latitude IS NOT NULL AND longitude IS NOT NULL))',
      [notificationId]
    );

    console.log(`[Product Detection] Main geometry exists: ${!!mainGeometry}`);
    console.log(`[Product Detection] Found ${coordinatesResult.rows.length} coordinate geometries`);

    // Collect all geometries (main geometry + coordinate geometries)
    const allGeometries: string[] = [];
    if (mainGeometry) {
      try {
        const geomObj = typeof mainGeometry === 'string' ? JSON.parse(mainGeometry) : mainGeometry;
        const cleanedGeom = removeZCoordinates(geomObj);
        const extractedMainGeometries = extractIndividualGeometries(cleanedGeom);

        extractedMainGeometries.forEach((geometry: any) => {
          allGeometries.push(JSON.stringify(geometry));
        });

        console.log(
          `[Product Detection] Main geometry type: ${cleanedGeom.type}, extracted ${extractedMainGeometries.length} geometr(y/ies)`
        );
      } catch (e) {
        console.error(`[Product Detection] Error parsing main geometry:`, e);
      }
    }
    
    coordinatesResult.rows.forEach((row: any, index: number) => {
      if (row.geometry) {
        try {
          const geomObj = typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry;
          const cleanedGeom = removeZCoordinates(geomObj);
          const extractedCoordinateGeometries = extractIndividualGeometries(cleanedGeom);
          extractedCoordinateGeometries.forEach((geometry: any) => {
            allGeometries.push(JSON.stringify(geometry));
          });
          console.log(
            `[Product Detection] Coordinate ${index + 1} (id: ${row.id}), type: ${cleanedGeom.type}, extracted ${extractedCoordinateGeometries.length} geometr(y/ies)`
          );
        } catch (e) {
          console.error(`[Product Detection] Error parsing coordinate geometry ${row.id}:`, e);
        }
      } else if (row.latitude !== null && row.latitude !== undefined && row.longitude !== null && row.longitude !== undefined) {
        // Build a Point geometry from lat/lon
        const pointGeom = {
          type: 'Point',
          coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)]
        };
        allGeometries.push(JSON.stringify(pointGeom));
        console.log(`[Product Detection] Coordinate ${index + 1} (id: ${row.id}), built Point from lat/lon: [${row.longitude}, ${row.latitude}]`);
      }
    });

    if (allGeometries.length === 0) {
      console.log(`[Product Detection] Notification ${notificationId}: No geometries found, skipping product detection`);
      return;
    }

    console.log(`[Product Detection] Notification ${notificationId}: Will check ${allGeometries.length} geometr(y/ies)`);

    // Get all active production lines
    const productionLinesResult = await pool.query(
      'SELECT id, code, name FROM production_lines WHERE is_active = true ORDER BY id'
    );

    console.log(`[Product Detection] Found ${productionLinesResult.rows.length} active production lines`);
    console.log(`[Product Detection] Production lines to check: ${productionLinesResult.rows.map((pl: any) => pl.code).join(', ')}`);

    let totalProductsLinked = 0;
    const linkedProductIds = new Set<number>();

    // For each production line, find and link intersecting products
    for (const productionLine of productionLinesResult.rows) {
      try {
        console.log(`[Product Detection] === Checking production line: ${productionLine.name} (${productionLine.code}) ===`);
        
        // First, check how many products with geometry exist for this production line
        const totalProductsResult = await pool.query(
          `SELECT COUNT(*) as count FROM products 
           WHERE production_line_id = $1 AND is_active = true AND geometry IS NOT NULL`,
          [productionLine.id]
        );
        console.log(`[Product Detection]    → ${totalProductsResult.rows[0].count} active products with geometry in this line`);
        
        let productsLinkedInThisLine = 0;
        
        // Check each geometry against products
        for (let geomIndex = 0; geomIndex < allGeometries.length; geomIndex++) {
          const geometry = allGeometries[geomIndex];
          
          try {
            // Validate and clean geometry before querying
            let validGeometry = geometry;
            try {
              const geomObj = JSON.parse(geometry);
              if (!geomObj.type || !geomObj.coordinates) {
                console.error(`[Product Detection]    ✗ Invalid geometry structure at index ${geomIndex + 1}`);
                continue;
              }
              
              // Remove Z coordinates (3D) from geometry to ensure compatibility
              const cleanGeom = removeZCoordinates(geomObj);
              validGeometry = JSON.stringify(cleanGeom);
              
            } catch (parseError) {
              console.error(`[Product Detection]    ✗ Failed to parse geometry at index ${geomIndex + 1}:`, parseError);
              continue;
            }

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
              [productionLine.id, validGeometry]
            );

            console.log(`[Product Detection]    → Geometry ${geomIndex + 1}: Found ${intersectingProducts.rows.length} intersecting products`);
            if (intersectingProducts.rows.length > 0) {
              console.log(`[Product Detection]       Product codes found: ${intersectingProducts.rows.map((p: any) => p.code).join(', ')}`);
            }

            // Link detected products to notification (if not already linked)
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
                  console.log(`[Product Detection]       ✓ Linked product: ${product.code} - ${product.name}`);
                }
              } else {
                console.log(`[Product Detection]       ○ Skipped (already linked): ${product.code}`);
              }
            }
          } catch (geomError) {
            console.error(`[Product Detection]    ✗ Error checking geometry ${geomIndex + 1} for ${productionLine.name}:`, geomError);
            console.error(`[Product Detection]    ✗ Problematic geometry string (first 200 chars):`, geometry.substring(0, 200));
          }
        }
        
        console.log(`[Product Detection] === Completed ${productionLine.code}: ${productsLinkedInThisLine} new product(s) linked ===`);
      } catch (error) {
        console.error(
          `[Product Detection] ✗✗✗ Error processing production line ${productionLine.id}:`,
          error
        );
        // Continue with other production lines even if one fails
      }
    }
    
    console.log(`[Product Detection] ========================================`);

    if (totalProductsLinked > 0) {
      console.log(
        `[Product Detection] ✓ Notification ${notificationId}: Total ${totalProductsLinked} new product(s) linked across all production lines`
      );
    } else {
      console.log(
        `[Product Detection] ○ Notification ${notificationId}: No new products found with overlapping geometry (all may already be linked)`
      );
    }
    
    // NOW: Remove products that are no longer relevant (don't intersect with any current geometry)
    console.log(`[Product Detection] Checking for products to remove...`);
    
    // Get all currently linked products for this notification
    const currentlyLinkedResult = await pool.query(
      `SELECT np.product_id, p.code, p.name, p.production_line_id, p.geometry
       FROM notifications_products np
       JOIN products p ON p.id = np.product_id
       WHERE np.notification_id = $1 AND np.is_relevant = true AND p.is_active = true AND p.geometry IS NOT NULL`,
      [notificationId]
    );
    
    console.log(`[Product Detection] Found ${currentlyLinkedResult.rows.length} currently linked products to verify`);
    
    let productsRemoved = 0;
    
    // For each currently linked product, check if it still intersects with any geometry
    for (const linkedProduct of currentlyLinkedResult.rows) {
      let stillIntersects = false;
      
      // Check if this product intersects with ANY of the notification's current geometries
      for (let geomIndex = 0; geomIndex < allGeometries.length; geomIndex++) {
        const geometry = allGeometries[geomIndex];
        
        try {
          // Check intersection with this specific geometry
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
            break; // No need to check other geometries
          }
        } catch (intersectError) {
          console.error(`[Product Detection]    ✗ Error checking intersection for product ${linkedProduct.code}:`, intersectError);
        }
      }
      
      // If product no longer intersects with any geometry, remove it
      if (!stillIntersects) {
        try {
          await pool.query(
            'DELETE FROM notifications_products WHERE notification_id = $1 AND product_id = $2',
            [notificationId, linkedProduct.product_id]
          );
          productsRemoved++;
          console.log(`[Product Detection]       ✗ Removed product (no longer intersects): ${linkedProduct.code} - ${linkedProduct.name}`);
        } catch (removeError) {
          console.error(`[Product Detection]    ✗ Error removing product ${linkedProduct.code}:`, removeError);
        }
      } else {
        // Keep this product - it was already in our linkedProductIds set
        linkedProductIds.add(linkedProduct.product_id);
      }
    }
    
    if (productsRemoved > 0) {
      console.log(`[Product Detection] ✓ Removed ${productsRemoved} product(s) that no longer intersect with any geometry`);
    } else {
      console.log(`[Product Detection] ○ No products to remove (all linked products still intersect)`);
    }
    
    // Query final state to verify
    const finalCountResult = await pool.query(
      `SELECT COUNT(*) as count FROM notifications_products WHERE notification_id = $1 AND is_relevant = true`,
      [notificationId]
    );
    console.log(`[Product Detection] ✓ Final verification: ${finalCountResult.rows[0].count} total products linked to notification ${notificationId}`);

    // Keep task-level product lists in sync with notification-level product detection.
    // This ensures newly auto-detected products immediately appear in task overviews/maps.
    await syncDetectedProductsToLinkedTasks(notificationId);

    console.log(`[Product Detection] ========================================`);
    
  } catch (error) {
    console.error(`[Product Detection] ✗ Error for notification ${notificationId}:`, error);
    // Don't throw - we don't want product detection failures to break the main flow
  }
}

async function syncDetectedProductsToLinkedTasks(notificationId: number): Promise<void> {
  try {
    // Find (task_id, product_id) pairs that should be linked but aren't yet.
    const pendingResult = await pool.query(
      `SELECT DISTINCT t.id AS task_id, p.id AS product_id
       FROM task_notifications tn
       JOIN tasks t ON t.id = tn.task_id
       JOIN notifications_products np ON np.notification_id = tn.notification_id
       JOIN products p ON p.id = np.product_id
       WHERE tn.notification_id = $1
         AND np.is_relevant = true
         AND p.is_active = true
         AND (
           t.production_line_id = p.production_line_id
           OR EXISTS (
             SELECT 1
             FROM task_production_line_status tpls
             WHERE tpls.task_id = t.id
               AND tpls.production_line_id = p.production_line_id
           )
           OR EXISTS (
             SELECT 1
             FROM task_notifications tn2
             JOIN notification_decisions nd2
               ON nd2.notification_id = tn2.notification_id
             WHERE tn2.task_id = t.id
               AND nd2.production_line_id = p.production_line_id
               AND nd2.decision = 'Ja'
           )
         )
         AND NOT EXISTS (
           SELECT 1 FROM task_products tp
           WHERE tp.task_id = t.id AND tp.product_id = p.id
         )`,
      [notificationId]
    );

    let syncedCount = 0;

    for (const row of pendingResult.rows) {
      // Ensure an active product version exists; create one if not.
      const versionId = await getOrCreateInProgressProductVersion(
        Number(row.product_id),
        {},
        pool
      );

      const insertResult = await pool.query(
        `INSERT INTO task_products (task_id, product_id, product_version_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'hoog_te_verwerken', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (task_id, product_id) DO NOTHING
         RETURNING id`,
        [row.task_id, row.product_id, versionId]
      );

      if (insertResult.rows.length > 0) {
        syncedCount++;
      }
    }

    if (syncedCount > 0) {
      console.log(
        `[Product Detection] ✓ Notification ${notificationId}: Synced ${syncedCount} product link(s) into related task(s)`
      );
    }
  } catch (error) {
    console.error(
      `[Product Detection] ✗ Notification ${notificationId}: Failed to sync detected products to tasks:`,
      error
    );
  }
}

// Get all notifications (with filters)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      productionLineId,
      undecidedOnly,
      source,
      sourceDetail,
      code,
      decision,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    // Check if zones table exists
    const hasZonesTable = await checkZonesTableExists();
    
    const zonesQuery = hasZonesTable ? `
        (
          SELECT COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', nz.id,
                'kml_coverage_id', nz.kml_coverage_id,
                'zone_code', nz.zone_code,
                'zone_name', nz.zone_name,
                'detection_method', nz.detection_method
              )
            ),
            '[]'::json
          )
          FROM notification_zones nz
          WHERE nz.notification_id = n.id
        ) as zones` : `'[]'::json as zones`;

    let query = `
      SELECT n.*,
        COUNT(*) OVER() as total_count,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', p.id,
              'code', p.code,
              'name', p.name,
              'description', p.description,
              'type', p.type,
              'geometry', p.geometry,
              'production_line_id', p.production_line_id,
              'productVersionId', (
                SELECT pv.id
                FROM product_versions pv
                WHERE pv.product_id = p.id
                  AND pv.status IN ('in behandeling', 'in inspectie', 'in_progress', 'in_inspectie', 'ready')
                ORDER BY pv.created_at DESC
                LIMIT 1
              ),
              'versionNumber', (
                SELECT pv.version_number
                FROM product_versions pv
                WHERE pv.product_id = p.id
                  AND pv.status IN ('in behandeling', 'in inspectie', 'in_progress', 'in_inspectie', 'ready')
                ORDER BY pv.created_at DESC
                LIMIT 1
              )
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) as products,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'production_line_id', nd_all.production_line_id,
              'production_line_code', pl.code,
              'production_line_name', pl.name,
              'decision', nd_all.decision,
              'decided_at', nd_all.decided_at
            )
          ) FILTER (WHERE nd_all.production_line_id IS NOT NULL),
          '[]'
        ) as all_decisions,
        (
          SELECT json_agg(json_build_object('task_number', t.task_number, 'id', t.id))
          FROM tasks t
          INNER JOIN task_notifications tn ON t.id = tn.task_id
          WHERE tn.notification_id = n.id
        ) as tasks,
        ${zonesQuery}
      FROM notifications n
      LEFT JOIN notifications_products np ON n.id = np.notification_id
      LEFT JOIN products p ON np.product_id = p.id
      LEFT JOIN notification_decisions nd_all ON n.id = nd_all.notification_id
      LEFT JOIN production_lines pl ON nd_all.production_line_id = pl.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 0;

    // Note: productionLineId filter removed from main query since we now get all decisions

    if (undecidedOnly === 'true') {
      if (productionLineId) {
        paramCount++;
        query += ` AND n.id NOT IN (
          SELECT notification_id
          FROM notification_decisions
          WHERE production_line_id = $${paramCount} AND decision IS NOT NULL
        )`;
        params.push(productionLineId);
      } else {
        query += ` AND n.id NOT IN (
          SELECT notification_id
          FROM notification_decisions
          WHERE decision IS NOT NULL
        )`;
      }
    }

    if (source) {
      paramCount++;
      query += ` AND n.source = $${paramCount}`;
      params.push(source);
    }

    if (sourceDetail) {
      paramCount++;
      query += ` AND n.source_detail ILIKE $${paramCount}`;
      params.push(`%${sourceDetail}%`);
    }

    if (code) {
      paramCount++;
      query += ` AND n.code ILIKE $${paramCount}`;
      params.push(`%${code}%`);
    }

    if (decision) {
      // Filter based on decision across all production lines
      if (decision === '-') {
        query += ` AND n.id NOT IN (SELECT notification_id FROM notification_decisions WHERE decision IS NOT NULL)`;
      } else {
        paramCount++;
        query += ` AND n.id IN (SELECT notification_id FROM notification_decisions WHERE decision = $${paramCount})`;
        params.push(decision);
      }
    }

    if (startDate) {
      paramCount++;
      query += ` AND n.notification_date >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND n.notification_date <= $${paramCount}`;
      params.push(endDate);
    }

    if (search) {
      paramCount++;
      query += ` AND (n.title ILIKE $${paramCount} OR n.code ILIKE $${paramCount} OR n.content ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    query += `
      GROUP BY n.id
      ORDER BY n.notification_date DESC, n.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const offset = (Number(page) - 1) * Number(limit);
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const totalCount = result.rows.length > 0 ? result.rows[0].total_count : 0;

    res.json({
      data: result.rows.map((row: any) => ({
        ...row,
        total_count: undefined,
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalCount: Number(totalCount),
        totalPages: Math.ceil(Number(totalCount) / Number(limit)),
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single notification
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Check if zones table exists
    const hasZonesTable = await checkZonesTableExists();
    
    const zonesQuery = hasZonesTable ? `
        (
          SELECT COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', nz.id,
                'kml_coverage_id', nz.kml_coverage_id,
                'zone_code', nz.zone_code,
                'zone_name', nz.zone_name,
                'detection_method', nz.detection_method,
                'detected_at', nz.detected_at
              )
            ),
            '[]'::json
          )
          FROM notification_zones nz
          WHERE nz.notification_id = n.id
        ) as zones` : `'[]'::json as zones`;

    const result = await pool.query(
      `SELECT n.*,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', p.id,
              'code', p.code,
              'name', p.name,
              'description', p.description,
              'type', p.type,
              'geometry', p.geometry,
              'production_line_id', p.production_line_id,
              'productVersionId', (
                SELECT pv.id
                FROM product_versions pv
                WHERE pv.product_id = p.id
                  AND pv.status IN ('in behandeling', 'in inspectie', 'in_progress', 'in_inspectie', 'ready')
                ORDER BY pv.created_at DESC
                LIMIT 1
              ),
              'versionNumber', (
                SELECT pv.version_number
                FROM product_versions pv
                WHERE pv.product_id = p.id
                  AND pv.status IN ('in behandeling', 'in inspectie', 'in_progress', 'in_inspectie', 'ready')
                ORDER BY pv.created_at DESC
                LIMIT 1
              ),
              'isRelevant', np.is_relevant,
              'notes', np.notes
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) as products,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', a.id,
              'filename', a.original_filename,
              'filePath', a.file_path,
              'fileType', a.file_type,
              'fileSize', a.file_size
            )
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'
        ) as attachments,
        ${zonesQuery}
      FROM notifications n
      LEFT JOIN notifications_products np ON n.id = np.notification_id
      LEFT JOIN products p ON np.product_id = p.id
      LEFT JOIN attachments a ON n.id = a.notification_id
      WHERE n.id = $1
      GROUP BY n.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Debug: Log products being returned
    console.log(`[GET /:id] Notification ${id} - Returning ${result.rows[0].products?.length || 0} products`);
    if (result.rows[0].products && result.rows[0].products.length > 0) {
      result.rows[0].products.forEach((p: any, index: number) => {
        console.log(`[GET /:id]   Product ${index + 1}: ${p.code} - production_line_id=${p.production_line_id}, isRelevant=${p.isRelevant}`);
      });
    }

    // Get decisions per production line
    const decisionsResult = await pool.query(
      `SELECT nd.*, pl.code as production_line_code, pl.name as production_line_name,
        u.first_name, u.last_name
      FROM notification_decisions nd
      JOIN production_lines pl ON nd.production_line_id = pl.id
      LEFT JOIN users u ON nd.decided_by = u.id
      WHERE nd.notification_id = $1`,
      [id]
    );

    // Get related tasks
    const tasksResult = await pool.query(
      `SELECT t.*, pl.code as production_line_code, pl.name as production_line_name,
        u.first_name as created_by_first_name, u.last_name as created_by_last_name
      FROM tasks t
      JOIN task_notifications tn ON t.id = tn.task_id
      JOIN production_lines pl ON t.production_line_id = pl.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE tn.notification_id = $1
      ORDER BY t.created_at DESC`,
      [id]
    );

    // Get activity log
    const activityResult = await pool.query(
      `SELECT al.*, u.first_name, u.last_name, u.email
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.entity_type = 'notification' AND al.entity_id = $1
      ORDER BY al.created_at DESC
      LIMIT 20`,
      [id]
    );

    // Get comments
    const commentsResult = await pool.query(
      `SELECT nc.*, 
        pl.code as production_line_code, 
        pl.name as production_line_name,
        u.first_name, 
        u.last_name
      FROM notification_comments nc
      LEFT JOIN production_lines pl ON nc.production_line_id = pl.id
      LEFT JOIN users u ON nc.created_by = u.id
      WHERE nc.notification_id = $1
      ORDER BY nc.created_at DESC`,
      [id]
    );

    res.json({
      ...result.rows[0],
      decisions: decisionsResult.rows,
      tasks: tasksResult.rows,
      activityLog: activityResult.rows,
      comments: commentsResult.rows,
    });
  } catch (error) {
    console.error('Get notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create notification
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      code,
      title,
      content,
      source,
      sourceDetail,
      notificationDate,
      geometry,
      geometries,
      metadata,
      products,
      opmerkingen,
    } = req.body;

    const userId = req.user?.id;

    console.log('[POST /notifications] Creating notification with:', { code, title, source, userId, hasGeometries: !!geometries });

    if (!userId) {
      console.error('[POST /notifications] Error: userId is missing');
      return res.status(401).json({ error: 'User ID is missing' });
    }

    if (!title) {
      console.error('[POST /notifications] Error: title is required');
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!notificationDate) {
      console.error('[POST /notifications] Error: notificationDate is required');
      return res.status(400).json({ error: 'Notification date is required' });
    }

    // Handle multiple geometries: if geometries array is provided, convert to FeatureCollection
    let finalGeometry = geometry;
    if (geometries) {
      try {
        console.log('[POST /notifications] Parsing geometries:', typeof geometries, geometries?.substring?.(0, 100));
        const geometriesArray = JSON.parse(geometries);
                console.log('[POST /notifications] Parsed geometries array length:', geometriesArray.length);
                geometriesArray.forEach((item: any, idx: number) => {
                  console.log(`[POST /notifications] Geometry ${idx}:`, {
                    hasGeometry: !!item.geometry,
                    geometryType: item.geometry?.type,
                    name: item.name,
                    description: item.description
                  });
                });
        if (Array.isArray(geometriesArray) && geometriesArray.length > 0) {
          const features = geometriesArray.map((item: any) => {
            // Handle both old format (direct geometry) and new format ({ geometry, name, description })
            const geom = item.geometry || item;
            const name = item.name || '';
            const description = item.description || '';
            return {
              type: 'Feature',
              geometry: geom,
              properties: {
                ...(name && { name }),
                ...(description && { description })
              }
            };
          });
          if (features.length > 0) {
            console.log('[POST /notifications] Created features, first feature sample:', JSON.stringify(features[0], null, 2).substring(0, 300));
          }
          finalGeometry = JSON.stringify({
            type: 'FeatureCollection',
            features: features
          });
          console.log('[POST /notifications] Converted geometries to FeatureCollection with', features.length, 'features');
        }
      } catch (e) {
        console.error('[POST /notifications] Error parsing geometries:', e);
        finalGeometry = geometry;
      }
    }

    console.log('[POST /notifications] Final geometry length:', finalGeometry?.length);
    if (finalGeometry) {
      console.log('[POST /notifications] Final geometry preview:', finalGeometry.substring(0, 200));
      try {
        const parsed = JSON.parse(finalGeometry);
        console.log('[POST /notifications] Geometry is valid JSON, type:', parsed.type);
      } catch (parseErr) {
        console.error('[POST /notifications] Final geometry is NOT valid JSON:', parseErr);
      }
    } else {
      console.log('[POST /notifications] WARNING: finalGeometry is null/undefined');
    }

    const result = await pool.query(
      `INSERT INTO notifications 
        (code, title, content, source, source_detail, notification_date, geometry, metadata, opmerkingen, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [code, title, content, source, sourceDetail, notificationDate, finalGeometry, metadata, opmerkingen, userId]
    );

    const notification = result.rows[0];
    console.log('[POST /notifications] Notification created with ID:', notification.id);

    // Link products if provided
    if (products && products.length > 0) {
      for (const productId of products) {
        await pool.query(
          'INSERT INTO notifications_products (notification_id, product_id) VALUES ($1, $2)',
          [notification.id, productId]
        );
      }
    }

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, user_id) VALUES ($1, $2, $3, $4)',
      ['notification', notification.id, 'created', userId]
    );

    // Detect affected zones
    try {
      await detectAndUpdateZones(notification.id);
    } catch (zoneError) {
      console.error('Zone detection error:', zoneError);
      // Don't fail the whole request if zone detection fails
    }

    // Auto-detect and link products based on geometry
    if (finalGeometry) {
      try {
        await detectAndLinkProductsForNotification(notification.id);
      } catch (productError) {
        console.error('Product detection error:', productError);
        // Don't fail the whole request if product detection fails
      }
    }

    res.status(201).json(notification);
  } catch (error) {
    console.error('[POST /notifications] Create notification error:', error);
    if (error instanceof Error) {
      console.error('[POST /notifications] Error message:', error.message);
      console.error('[POST /notifications] Error stack:', error.stack);
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update notification
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      title,
      content,
      source,
      sourceDetail,
      notificationDate,
      geometry,
      geometries,
      metadata,
      opmerkingen,
    } = req.body;

    const userId = req.user?.id;

    console.log('[PUT /notifications/:id] Updating notification ID:', id);

    // Handle multiple geometries: if geometries array is provided, convert to FeatureCollection
    let finalGeometry = geometry;
    if (geometries) {
      try {
        console.log('[PUT /notifications/:id] Parsing geometries');
        const geometriesArray = JSON.parse(geometries);
        if (Array.isArray(geometriesArray) && geometriesArray.length > 0) {
          const features = geometriesArray.map((item: any) => {
            // Handle both old format (direct geometry) and new format ({ geometry, name, description })
            const geom = item.geometry || item;
            const name = item.name || '';
            const description = item.description || '';
            return {
              type: 'Feature',
              geometry: geom,
              properties: {
                ...(name && { name }),
                ...(description && { description })
              }
            };
          });
          finalGeometry = JSON.stringify({
            type: 'FeatureCollection',
            features: features
          });
          console.log('[PUT /notifications/:id] Converted to FeatureCollection');
        }
      } catch (e) {
        console.error('[PUT /notifications/:id] Error parsing geometries:', e);
        finalGeometry = geometry;
      }
    }

    const result = await pool.query(
      `UPDATE notifications 
       SET code = $1, title = $2, content = $3, source = $4, source_detail = $5, 
           notification_date = $6, geometry = $7, metadata = $8, opmerkingen = $9, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [code, title, content, source, sourceDetail, notificationDate, finalGeometry, metadata, opmerkingen, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, user_id) VALUES ($1, $2, $3, $4)',
      ['notification', id, 'updated', userId]
    );

    // Re-detect affected zones if geometry changed
    try {
      await detectAndUpdateZones(parseInt(id));
    } catch (zoneError) {
      console.error('Zone detection error:', zoneError);
      // Don't fail the whole request if zone detection fails
    }

    // Re-detect and link products based on geometry
    if (finalGeometry) {
      try {
        await detectAndLinkProductsForNotification(parseInt(id));
      } catch (productError) {
        console.error('Product detection error:', productError);
        // Don't fail the whole request if product detection fails
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update notification decision
router.post('/:id/decide', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { productionLineId, decision, notes } = req.body;
    const userId = req.user?.id;

    if (!['Ja', 'Nee'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision' });
    }

    // Update or insert decision
    await pool.query(
      `INSERT INTO notification_decisions 
        (notification_id, production_line_id, decision, decided_by, decided_at, notes)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
      ON CONFLICT (notification_id, production_line_id)
      DO UPDATE SET decision = $3, decided_by = $4, decided_at = CURRENT_TIMESTAMP, notes = $5`,
      [id, productionLineId, decision, userId, notes]
    );

    // If decision is 'Ja', create task
    if (decision === 'Ja') {
      // Auto-detect and link products using robust geometry handling (supports FeatureCollection)
      try {
        await detectAndLinkProductsForNotification(parseInt(id));
      } catch (productDetectionError) {
        console.error('Product detection during decision failed (continuing task creation):', productDetectionError);
      }

      // Mirror ZK 'Ja' to PILOT_ENC only when a PILOT_ENC product is linked to this notification.
      const lineIdsResult = await pool.query(
        `SELECT id, code FROM production_lines WHERE code IN ('ZK', 'PILOT_ENC')`
      );
      const zkLineId = lineIdsResult.rows.find((line: any) => line.code === 'ZK')?.id;
      const pilotEncLineId = lineIdsResult.rows.find((line: any) => line.code === 'PILOT_ENC')?.id;

      let shouldMirrorToPilotEnc = false;

      if (zkLineId && pilotEncLineId && Number(productionLineId) === Number(zkLineId)) {
        const hasPilotProductsResult = await pool.query(
          `SELECT EXISTS (
             SELECT 1
             FROM notifications_products np
             JOIN products p ON p.id = np.product_id
             WHERE np.notification_id = $1
               AND np.is_relevant = true
               AND p.production_line_id = $2
           ) AS has_pilot_products`,
          [id, pilotEncLineId]
        );

        shouldMirrorToPilotEnc = Boolean(hasPilotProductsResult.rows[0]?.has_pilot_products);

        if (shouldMirrorToPilotEnc) {
          await pool.query(
            `INSERT INTO notification_decisions
              (notification_id, production_line_id, decision, decided_by, decided_at, notes)
             VALUES ($1, $2, 'Ja', $3, CURRENT_TIMESTAMP, $4)
             ON CONFLICT (notification_id, production_line_id)
             DO UPDATE SET decision = 'Ja', decided_by = $3, decided_at = CURRENT_TIMESTAMP, notes = $4`,
            [id, pilotEncLineId, userId, notes]
          );
        }
      }

      // Reuse existing task linked to this notice when available, otherwise create a new task number.
      const existingTaskResult = await pool.query(
        `SELECT t.id
         FROM tasks t
         INNER JOIN task_notifications tn ON tn.task_id = t.id
         WHERE tn.notification_id = $1
         ORDER BY t.created_at ASC
         LIMIT 1`,
        [id]
      );

      let taskId: number;
      let createdNewTask = false;

      if (existingTaskResult.rows.length > 0) {
        taskId = existingTaskResult.rows[0].id;
      } else {
        // Generate task number (year + sequence)
        const year = new Date().getFullYear().toString().slice(-2);
        const sequenceResult = await pool.query(
          `SELECT COALESCE(MAX(CAST(SUBSTRING(task_number FROM 3) AS INTEGER)), 0) + 1 as next_seq
           FROM tasks WHERE task_number LIKE $1`,
          [`${year}%`]
        );
        const sequence = sequenceResult.rows[0].next_seq.toString().padStart(4, '0');
        const taskNumber = `${year}${sequence}`;

        // Get notification details
        const notifResult = await pool.query(
          'SELECT title FROM notifications WHERE id = $1',
          [id]
        );

        // Create task
        const taskResult = await pool.query(
          `INSERT INTO tasks 
            (task_number, title, production_line_id, created_by)
          VALUES ($1, $2, $3, $4)
          RETURNING *`,
          [taskNumber, notifResult.rows[0].title, productionLineId, userId]
        );

        taskId = taskResult.rows[0].id;
        createdNewTask = true;
      }

      // Ensure notification is linked to the task
      await pool.query(
        `INSERT INTO task_notifications (task_id, notification_id)
         VALUES ($1, $2)
         ON CONFLICT (task_id, notification_id) DO NOTHING`,
        [taskId, id]
      );

      // Get products linked to notification for this production line
      const productsResult = await pool.query(
        `SELECT DISTINCT np.product_id
         FROM notifications_products np
         JOIN products p ON np.product_id = p.id
         WHERE np.notification_id = $1 AND p.production_line_id = $2`,
        [id, productionLineId]
      );

      // Link products to task
      for (const row of productsResult.rows) {
        const productVersionId = await getOrCreateInProgressProductVersion(Number(row.product_id), { userId }, pool);
        await pool.query(
          `INSERT INTO task_products (task_id, product_id, product_version_id, status)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (task_id, product_id) DO NOTHING`,
          [taskId, row.product_id, productVersionId, 'hoog_te_verwerken']
        );

        await ensureCorrectionListTaskLink(taskId, Number(row.product_id), {
          userId,
          status: 'hoog_te_verwerken',
        }, pool);
      }

      // Auto-add BaZ-2 for PUBL production line
      const publCheck = await pool.query(
        "SELECT id FROM production_lines WHERE code = 'PUBL' AND id = $1",
        [productionLineId]
      );
      if (publCheck.rows.length > 0) {
        const baz2 = await pool.query(
          "SELECT id FROM products WHERE code = 'BaZ-2' AND production_line_id = $1",
          [productionLineId]
        );
        if (baz2.rows.length > 0) {
          const baz2VersionId = await getOrCreateInProgressProductVersion(Number(baz2.rows[0].id), { userId }, pool);
          await pool.query(
            `INSERT INTO task_products (task_id, product_id, product_version_id, status)
             VALUES ($1, $2, $3, 'hoog_te_verwerken')
             ON CONFLICT (task_id, product_id) DO NOTHING`,
            [taskId, baz2.rows[0].id, baz2VersionId]
          );
        }
      }

      // Create initial production line status
      await pool.query(
        `INSERT INTO task_production_line_status (task_id, production_line_id, status, wait_for_zk)
         VALUES (
           $1,
           $2,
           $3,
           CASE WHEN EXISTS (
             SELECT 1 FROM production_lines pl WHERE pl.id = $2 AND pl.code = 'PILOT_ENC'
           ) THEN TRUE ELSE FALSE END
         )
         ON CONFLICT (task_id, production_line_id) DO NOTHING`,
        [taskId, productionLineId, 'under_construction']
      );

      if (shouldMirrorToPilotEnc && pilotEncLineId) {
        await pool.query(
          `INSERT INTO task_production_line_status (task_id, production_line_id, status, wait_for_zk)
           VALUES ($1, $2, $3, TRUE)
           ON CONFLICT (task_id, production_line_id) DO NOTHING`,
          [taskId, pilotEncLineId, 'under_construction']
        );

        // Make sure pilot products become visible in this task now that PILOT_ENC is linked to it.
        await syncDetectedProductsToLinkedTasks(parseInt(id));
      }

      if (createdNewTask) {
        // Log activity only when a new task is created.
        await pool.query(
          'INSERT INTO activity_log (entity_type, entity_id, action, user_id) VALUES ($1, $2, $3, $4)',
          ['task', taskId, 'created', userId]
        );

        // Create HPD project for IENC/ZK production lines
        const taskRow = await pool.query('SELECT task_number FROM tasks WHERE id = $1', [taskId]);
        if (taskRow.rows.length > 0) {
          await createHpdProjectForTask(taskId, taskRow.rows[0].task_number, productionLineId);
        }
      }
    }

    // Log decision
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      ['notification', id, 'decided', JSON.stringify({ productionLineId, decision }), userId]
    );

    res.json({ message: 'Decision recorded successfully' });
  } catch (error) {
    console.error('Decide notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk decision with task creation options
router.post('/bulk-decide', authenticate, async (req: AuthRequest, res) => {
  try {
    const { notificationIds, productionLineId, decision, notes, taskMode } = req.body;
    const userId = req.user?.id;

    if (!['Ja', 'Nee'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision' });
    }

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({ error: 'No notification IDs provided' });
    }

    const lineIdsResult = await pool.query(
      `SELECT id, code FROM production_lines WHERE code IN ('ZK', 'PILOT_ENC')`
    );
    const zkLineId = lineIdsResult.rows.find((line: any) => line.code === 'ZK')?.id;
    const pilotEncLineId = lineIdsResult.rows.find((line: any) => line.code === 'PILOT_ENC')?.id;
    const isZkJaDecision =
      decision === 'Ja' &&
      !!zkLineId &&
      !!pilotEncLineId &&
      Number(productionLineId) === Number(zkLineId);

    // Record decisions for all notifications
    for (const notifId of notificationIds) {
      await pool.query(
        `INSERT INTO notification_decisions 
          (notification_id, production_line_id, decision, decided_by, decided_at, notes)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
        ON CONFLICT (notification_id, production_line_id)
        DO UPDATE SET decision = $3, decided_by = $4, decided_at = CURRENT_TIMESTAMP, notes = $5`,
        [notifId, productionLineId, decision, userId, notes]
      );

      // Log decision
      await pool.query(
        'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
        ['notification', notifId, 'decided', JSON.stringify({ productionLineId, decision }), userId]
      );
    }

    // If decision is 'Ja', create tasks based on taskMode
    if (decision === 'Ja') {
      // First, auto-detect and link products for all notifications (supports FeatureCollection)
      for (const notifId of notificationIds) {
        try {
          await detectAndLinkProductsForNotification(Number(notifId));
        } catch (productDetectionError) {
          console.error(`[Bulk Decide] Product detection failed for notification ${notifId} (continuing):`, productDetectionError);
        }
      }

      const pilotEligibleNotificationIds = new Set<number>();

      if (isZkJaDecision && pilotEncLineId) {
        for (const notifId of notificationIds) {
          const hasPilotProductsResult = await pool.query(
            `SELECT EXISTS (
               SELECT 1
               FROM notifications_products np
               JOIN products p ON p.id = np.product_id
               WHERE np.notification_id = $1
                 AND np.is_relevant = true
                 AND p.production_line_id = $2
             ) AS has_pilot_products`,
            [notifId, pilotEncLineId]
          );

          const hasPilotProducts = Boolean(hasPilotProductsResult.rows[0]?.has_pilot_products);
          if (!hasPilotProducts) {
            continue;
          }

          pilotEligibleNotificationIds.add(Number(notifId));

          await pool.query(
            `INSERT INTO notification_decisions
              (notification_id, production_line_id, decision, decided_by, decided_at, notes)
             VALUES ($1, $2, 'Ja', $3, CURRENT_TIMESTAMP, $4)
             ON CONFLICT (notification_id, production_line_id)
             DO UPDATE SET decision = 'Ja', decided_by = $3, decided_at = CURRENT_TIMESTAMP, notes = $4`,
            [notifId, pilotEncLineId, userId, notes]
          );
        }
      }

      if (taskMode === 'combined') {
        // Create ONE task for ALL notifications
        const year = new Date().getFullYear().toString().slice(-2);
        const sequenceResult = await pool.query(
          `SELECT COALESCE(MAX(CAST(SUBSTRING(task_number FROM 3) AS INTEGER)), 0) + 1 as next_seq
           FROM tasks WHERE task_number LIKE $1`,
          [`${year}%`]
        );
        const sequence = sequenceResult.rows[0].next_seq.toString().padStart(4, '0');
        const taskNumber = `${year}${sequence}`;

        // Get all notification titles to create a combined title
        const notifResult = await pool.query(
          'SELECT id, title FROM notifications WHERE id = ANY($1)',
          [notificationIds]
        );
        
        const combinedTitle = `Gecombineerde taak: ${notifResult.rows.map((n: any) => n.title).join(', ')}`;

        // Create one task
        const taskResult = await pool.query(
          `INSERT INTO tasks 
            (task_number, title, production_line_id, created_by)
          VALUES ($1, $2, $3, $4)
          RETURNING *`,
          [taskNumber, combinedTitle.substring(0, 500), productionLineId, userId]
        );

        const taskId = taskResult.rows[0].id;

        // Link all notifications to this task
        for (const notifId of notificationIds) {
          await pool.query(
            'INSERT INTO task_notifications (task_id, notification_id) VALUES ($1, $2)',
            [taskId, notifId]
          );
        }

        // Get all unique products linked to these notifications
        const productsResult = await pool.query(
          `SELECT DISTINCT np.product_id
           FROM notifications_products np
           JOIN products p ON np.product_id = p.id
           WHERE np.notification_id = ANY($1) AND p.production_line_id = $2`,
          [notificationIds, productionLineId]
        );

        // Link products to task
        for (const row of productsResult.rows) {
          const productVersionId = await getOrCreateInProgressProductVersion(Number(row.product_id), { userId }, pool);
          await pool.query(
            'INSERT INTO task_products (task_id, product_id, product_version_id, status) VALUES ($1, $2, $3, $4)',
            [taskId, row.product_id, productVersionId, 'hoog_te_verwerken']
          );

          await ensureCorrectionListTaskLink(taskId, Number(row.product_id), {
            userId,
            status: 'hoog_te_verwerken',
          }, pool);
        }

        // Auto-add BaZ-2 for PUBL production line
        const publCheckCombined = await pool.query(
          "SELECT id FROM production_lines WHERE code = 'PUBL' AND id = $1",
          [productionLineId]
        );
        if (publCheckCombined.rows.length > 0) {
          const baz2Combined = await pool.query(
            "SELECT id FROM products WHERE code = 'BaZ-2' AND production_line_id = $1",
            [productionLineId]
          );
          if (baz2Combined.rows.length > 0) {
            const baz2VersionId = await getOrCreateInProgressProductVersion(Number(baz2Combined.rows[0].id), { userId }, pool);
            await pool.query(
              `INSERT INTO task_products (task_id, product_id, product_version_id, status)
               VALUES ($1, $2, $3, 'hoog_te_verwerken')
               ON CONFLICT (task_id, product_id) DO NOTHING`,
              [taskId, baz2Combined.rows[0].id, baz2VersionId]
            );
          }
        }

        // Create initial production line status
        await pool.query(
          `INSERT INTO task_production_line_status (task_id, production_line_id, status, wait_for_zk)
           VALUES (
             $1,
             $2,
             $3,
             CASE WHEN EXISTS (
               SELECT 1 FROM production_lines pl WHERE pl.id = $2 AND pl.code = 'PILOT_ENC'
             ) THEN TRUE ELSE FALSE END
           )`,
          [taskId, productionLineId, 'under_construction']
        );

        if (pilotEncLineId && pilotEligibleNotificationIds.size > 0) {
          await pool.query(
            `INSERT INTO task_production_line_status (task_id, production_line_id, status, wait_for_zk)
             VALUES ($1, $2, $3, TRUE)
             ON CONFLICT (task_id, production_line_id) DO NOTHING`,
            [taskId, pilotEncLineId, 'under_construction']
          );

          for (const notifId of pilotEligibleNotificationIds) {
            await syncDetectedProductsToLinkedTasks(Number(notifId));
          }
        }

        // Log activity
        await pool.query(
          'INSERT INTO activity_log (entity_type, entity_id, action, user_id) VALUES ($1, $2, $3, $4)',
          ['task', taskId, 'created', userId]
        );

        // Create HPD project for IENC/ZK production lines
        await createHpdProjectForTask(taskId, taskNumber, productionLineId);

      } else if (taskMode === 'individual') {
        // Create SEPARATE tasks for EACH notification
        for (const notifId of notificationIds) {
          // Reuse existing task linked to this notice when available, otherwise create a new task number.
          const existingTaskResult = await pool.query(
            `SELECT t.id
             FROM tasks t
             INNER JOIN task_notifications tn ON tn.task_id = t.id
             WHERE tn.notification_id = $1
             ORDER BY t.created_at ASC
             LIMIT 1`,
            [notifId]
          );

          let taskId: number;
          let createdNewTask = false;

          if (existingTaskResult.rows.length > 0) {
            taskId = existingTaskResult.rows[0].id;
          } else {
            const year = new Date().getFullYear().toString().slice(-2);
            const sequenceResult = await pool.query(
              `SELECT COALESCE(MAX(CAST(SUBSTRING(task_number FROM 3) AS INTEGER)), 0) + 1 as next_seq
               FROM tasks WHERE task_number LIKE $1`,
              [`${year}%`]
            );
            const sequence = sequenceResult.rows[0].next_seq.toString().padStart(4, '0');
            const taskNumber = `${year}${sequence}`;

            // Get notification details
            const notifResult = await pool.query(
              'SELECT title FROM notifications WHERE id = $1',
              [notifId]
            );

            // Create task
            const taskResult = await pool.query(
              `INSERT INTO tasks 
                (task_number, title, production_line_id, created_by)
              VALUES ($1, $2, $3, $4)
              RETURNING *`,
              [taskNumber, notifResult.rows[0].title, productionLineId, userId]
            );

            taskId = taskResult.rows[0].id;
            createdNewTask = true;
          }

          // Ensure notification is linked to the task
          await pool.query(
            `INSERT INTO task_notifications (task_id, notification_id)
             VALUES ($1, $2)
             ON CONFLICT (task_id, notification_id) DO NOTHING`,
            [taskId, notifId]
          );

          // Get products linked to notification
          const productsResult = await pool.query(
            `SELECT DISTINCT np.product_id
             FROM notifications_products np
             JOIN products p ON np.product_id = p.id
             WHERE np.notification_id = $1 AND p.production_line_id = $2`,
            [notifId, productionLineId]
          );

          // Link products to task
          for (const row of productsResult.rows) {
            const productVersionId = await getOrCreateInProgressProductVersion(Number(row.product_id), { userId }, pool);
            await pool.query(
              `INSERT INTO task_products (task_id, product_id, product_version_id, status)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (task_id, product_id) DO NOTHING`,
              [taskId, row.product_id, productVersionId, 'hoog_te_verwerken']
            );

            await ensureCorrectionListTaskLink(taskId, Number(row.product_id), {
              userId,
              status: 'hoog_te_verwerken',
            }, pool);
          }

          // Auto-add BaZ-2 for PUBL production line
          const publCheckIndiv = await pool.query(
            "SELECT id FROM production_lines WHERE code = 'PUBL' AND id = $1",
            [productionLineId]
          );
          if (publCheckIndiv.rows.length > 0) {
            const baz2Indiv = await pool.query(
              "SELECT id FROM products WHERE code = 'BaZ-2' AND production_line_id = $1",
              [productionLineId]
            );
            if (baz2Indiv.rows.length > 0) {
              const baz2VersionId = await getOrCreateInProgressProductVersion(Number(baz2Indiv.rows[0].id), { userId }, pool);
              await pool.query(
                `INSERT INTO task_products (task_id, product_id, product_version_id, status)
                 VALUES ($1, $2, $3, 'hoog_te_verwerken')
                 ON CONFLICT (task_id, product_id) DO NOTHING`,
                [taskId, baz2Indiv.rows[0].id, baz2VersionId]
              );
            }
          }

          // Create initial production line status
          await pool.query(
            `INSERT INTO task_production_line_status (task_id, production_line_id, status, wait_for_zk)
             VALUES (
               $1,
               $2,
               $3,
               CASE WHEN EXISTS (
                 SELECT 1 FROM production_lines pl WHERE pl.id = $2 AND pl.code = 'PILOT_ENC'
               ) THEN TRUE ELSE FALSE END
             )
             ON CONFLICT (task_id, production_line_id) DO NOTHING`,
            [taskId, productionLineId, 'under_construction']
          );

          if (pilotEncLineId && pilotEligibleNotificationIds.has(Number(notifId))) {
            await pool.query(
              `INSERT INTO task_production_line_status (task_id, production_line_id, status, wait_for_zk)
               VALUES ($1, $2, $3, TRUE)
               ON CONFLICT (task_id, production_line_id) DO NOTHING`,
              [taskId, pilotEncLineId, 'under_construction']
            );

            await syncDetectedProductsToLinkedTasks(Number(notifId));
          }

          if (createdNewTask) {
            // Log activity only when a new task is created.
            await pool.query(
              'INSERT INTO activity_log (entity_type, entity_id, action, user_id) VALUES ($1, $2, $3, $4)',
              ['task', taskId, 'created', userId]
            );

            // Create HPD project for IENC/ZK production lines
            const taskRow = await pool.query('SELECT task_number FROM tasks WHERE id = $1', [taskId]);
            if (taskRow.rows.length > 0) {
              await createHpdProjectForTask(taskId, taskRow.rows[0].task_number, productionLineId);
            }
          }
        }
      }
    }

    res.json({ message: 'Decisions recorded and tasks created successfully' });
  } catch (error) {
    console.error('Bulk decide error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add comment to notification (supports multiple comments)
router.post('/:id/comments', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { productionLineId, comment } = req.body;
    const userId = req.user?.id;

    // Check if comment is empty (including HTML-only content from WYSIWYG editors)
    if (!comment || comment.trim() === '') {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }
    
    // Remove HTML tags to check for actual text content
    const textContent = comment.replace(/<[^>]*>/g, '').trim();
    if (textContent === '') {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    // Insert new comment
    const result = await pool.query(
      `INSERT INTO notification_comments 
        (notification_id, production_line_id, comment, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [id, productionLineId, comment, userId]
    );

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      ['notification', id, 'comment_added', JSON.stringify({ productionLineId }), userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get comments for a notification
router.get('/:id/comments', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT nc.*, pl.name as production_line_name, pl.code as production_line_code,
        u.first_name, u.last_name
      FROM notification_comments nc
      JOIN production_lines pl ON nc.production_line_id = pl.id
      LEFT JOIN users u ON nc.created_by = u.id
      WHERE nc.notification_id = $1
      ORDER BY nc.created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all info requests for a notification
router.get('/:id/info-requests', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT nir.*, u.first_name, u.last_name
       FROM notification_info_requests nir
       LEFT JOIN users u ON nir.created_by = u.id
       WHERE nir.notification_id = $1
       ORDER BY nir.created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get notification info requests error:', error);
    res.status(500).json({ error: 'Failed to fetch notification info requests' });
  }
});

// Create a new info request for a notification
router.post('/:id/info-requests', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { recipient, subject, body } = req.body;
    const userId = req.user?.id;

    if (!recipient || !subject || !body) {
      return res.status(400).json({ error: 'Recipient, subject, and body are required' });
    }

    const result = await pool.query(
      `INSERT INTO notification_info_requests (notification_id, recipient, subject, body, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, recipient, subject, body, userId]
    );

    res.json({ message: 'Notification info request saved successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Create notification info request error:', error);
    res.status(500).json({ error: 'Failed to save notification info request' });
  }
});

// Update a comment
router.put('/comments/:commentId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { commentId } = req.params;
    const { comment } = req.body;
    const userId = req.user?.id;

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    // Check if user owns this comment
    const checkResult = await pool.query(
      'SELECT created_by, notification_id FROM notification_comments WHERE id = $1',
      [commentId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (checkResult.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }

    // Update comment
    const result = await pool.query(
      `UPDATE notification_comments 
       SET comment = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [comment, commentId]
    );

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      ['notification', checkResult.rows[0].notification_id, 'comment_updated', JSON.stringify({ commentId }), userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add or update comment for a notification (without changing decision) - LEGACY
router.post('/:id/comment', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { productionLineId, notes } = req.body;
    const userId = req.user?.id;

    console.log('Received comment request:', {
      notificationId: id,
      productionLineId,
      notes: notes?.substring(0, 50),
      userId
    });

    // Check if notes is empty (including HTML-only content from WYSIWYG editors)
    if (!notes || notes.trim() === '') {
      return res.status(400).json({ error: 'Notes cannot be empty' });
    }
    
    // Remove HTML tags to check for actual text content
    const textContent = notes.replace(/<[^>]*>/g, '').trim();
    if (textContent === '') {
      return res.status(400).json({ error: 'Notes cannot be empty' });
    }

    // Insert as a new comment instead
    const result = await pool.query(
      `INSERT INTO notification_comments 
        (notification_id, production_line_id, comment, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [id, productionLineId, notes, userId]
    );

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      ['notification', id, 'comment_added', JSON.stringify({ productionLineId }), userId]
    );

    res.json({ message: 'Comment added successfully', comment: result.rows[0] });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get coordinates for a notification
router.get('/:id/coordinates', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT nc.*, u.first_name, u.last_name
       FROM notification_coordinates nc
       LEFT JOIN users u ON nc.created_by = u.id
       WHERE nc.notification_id = $1
       ORDER BY nc.created_at DESC`,
      [id]
    );

    // Parse geometry field from JSON text to object
    const coordinates = result.rows.map((row: any) => ({
      ...row,
      geometry: row.geometry ? JSON.parse(row.geometry) : null
    }));

    res.json(coordinates);
  } catch (error) {
    console.error('Get coordinates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add coordinate to a notification
router.post('/:id/coordinates', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, label, description, geometry } = req.body;
    const userId = req.user?.id;

    // If geometry is provided (for lines/polygons), store it instead of lat/lon
    if (geometry) {
      // Frontend already sends geometry as a JSON string, so no need to stringify again
      const geometryStr = typeof geometry === 'string' ? geometry : JSON.stringify(geometry);
      const result = await pool.query(
        `INSERT INTO notification_coordinates 
          (notification_id, latitude, longitude, label, description, created_by, geometry)
        VALUES ($1, 0, 0, $2, $3, $4, $5)
        RETURNING *`,
        [id, label || null, description || null, userId, geometryStr]
      );

      await pool.query(
        'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
        ['notification', id, 'geometry_added', JSON.stringify({ type: geometry.type, label }), userId]
      );

      // Automatically detect and update affected zones
      try {
        await detectAndUpdateZones(parseInt(id));
      } catch (zoneError) {
        console.error('Zone detection error after adding geometry:', zoneError);
        // Continue even if zone detection fails
      }

      // Auto-detect and link products based on geometry
      console.log(`[POST Coordinate] Triggering product detection for notification ${id}`);
      try {
        await detectAndLinkProductsForNotification(parseInt(id));
        console.log(`[POST Coordinate] Product detection completed successfully for notification ${id}`);
      } catch (productError) {
        console.error('[POST Coordinate] Product detection error after adding geometry:', productError);
        // Continue even if product detection fails
      }

      return res.json(result.rows[0]);
    }

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Validate latitude and longitude ranges
    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
    }
    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
    }

    const result = await pool.query(
      `INSERT INTO notification_coordinates 
        (notification_id, latitude, longitude, label, description, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [id, latitude, longitude, label || null, description || null, userId]
    );

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      ['notification', id, 'coordinate_added', JSON.stringify({ latitude, longitude, label }), userId]
    );

    // Automatically detect and update affected zones
    try {
      await detectAndUpdateZones(parseInt(id));
    } catch (zoneError) {
      console.error('Zone detection error after adding coordinate:', zoneError);
      // Continue even if zone detection fails
    }

    // Auto-detect and link products based on coordinate
    console.log(`[POST Coordinate Alt] Triggering product detection for notification ${id}`);
    try {
      await detectAndLinkProductsForNotification(parseInt(id));
      console.log(`[POST Coordinate Alt] Product detection completed successfully for notification ${id}`);
    } catch (productError) {
      console.error('[POST Coordinate Alt] Product detection error after adding coordinate:', productError);
      // Continue even if product detection fails
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Add coordinate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update coordinate
router.put('/:id/coordinates/:coordinateId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id, coordinateId } = req.params;
    const { latitude, longitude, label, description, geometry } = req.body;
    const userId = req.user?.id;

    // If geometry is provided, update with geometry
    if (geometry) {
      // Frontend already sends geometry as a JSON string, so no need to stringify again
      const geometryStr = typeof geometry === 'string' ? geometry : JSON.stringify(geometry);
      const result = await pool.query(
        `UPDATE notification_coordinates 
         SET geometry = $1, label = $2, description = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND notification_id = $5
         RETURNING *`,
        [geometryStr, label || null, description || null, coordinateId, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Coordinate not found' });
      }

      await pool.query(
        'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
        ['notification', id, 'geometry_updated', JSON.stringify({ coordinateId, type: geometry.type }), userId]
      );

      // Automatically detect and update affected zones
      try {
        await detectAndUpdateZones(parseInt(id));
      } catch (zoneError) {
        console.error('Zone detection error after updating geometry:', zoneError);
        // Continue even if zone detection fails
      }

      // Auto-detect and link products based on updated geometry
      console.log(`[PUT Coordinate Geometry] Triggering product detection for notification ${id}`);
      try {
        await detectAndLinkProductsForNotification(parseInt(id));
        console.log(`[PUT Coordinate Geometry] Product detection completed successfully for notification ${id}`);
      } catch (productError) {
        console.error('[PUT Coordinate Geometry] Product detection error after updating geometry:', productError);
        // Continue even if product detection fails
      }

      return res.json(result.rows[0]);
    }

    // Otherwise update with lat/lon
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const result = await pool.query(
      `UPDATE notification_coordinates 
       SET latitude = $1, longitude = $2, label = $3, description = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND notification_id = $6
       RETURNING *`,
      [latitude, longitude, label || null, description || null, coordinateId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coordinate not found' });
    }

    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      ['notification', id, 'coordinate_updated', JSON.stringify({ coordinateId, latitude, longitude }), userId]
    );

    // Automatically detect and update affected zones
    try {
      await detectAndUpdateZones(parseInt(id));
    } catch (zoneError) {
      console.error('Zone detection error after updating coordinate:', zoneError);
      // Continue even if zone detection fails
    }

    // Auto-detect and link products based on updated coordinate
    console.log(`[PUT Coordinate LatLon] Triggering product detection for notification ${id}`);
    try {
      await detectAndLinkProductsForNotification(parseInt(id));
      console.log(`[PUT Coordinate LatLon] Product detection completed successfully for notification ${id}`);
    } catch (productError) {
      console.error('[PUT Coordinate LatLon] Product detection error after updating coordinate:', productError);
      // Continue even if product detection fails
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update coordinate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete coordinate
router.delete('/:id/coordinates/:coordinateId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id, coordinateId } = req.params;
    const userId = req.user?.id;

    const result = await pool.query(
      'DELETE FROM notification_coordinates WHERE id = $1 AND notification_id = $2 RETURNING *',
      [coordinateId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coordinate not found' });
    }

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      ['notification', id, 'coordinate_deleted', JSON.stringify({ coordinateId }), userId]
    );

    // Automatically detect and update affected zones after deletion
    try {
      await detectAndUpdateZones(parseInt(id));
    } catch (zoneError) {
      console.error('Zone detection error after deleting coordinate:', zoneError);
      // Continue even if zone detection fails
    }

    // Re-detect products after coordinate deletion
    // This will both add new products that intersect AND remove products that no longer intersect
    console.log(`[DELETE Coordinate] Triggering product detection for notification ${id}`);
    try {
      await detectAndLinkProductsForNotification(parseInt(id));
      console.log(`[DELETE Coordinate] Product detection completed successfully for notification ${id}`);
    } catch (productError) {
      console.error('[DELETE Coordinate] Product detection error after deleting coordinate:', productError);
      // Continue even if product detection fails
    }

    res.json({ message: 'Coordinate deleted successfully' });
  } catch (error) {
    console.error('Delete coordinate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload attachment to notification
router.post('/:id/attachments', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Geen bestand geüpload' });
    }

    // Check if notification exists
    const notificationCheck = await pool.query(
      'SELECT id FROM notifications WHERE id = $1',
      [id]
    );

    if (notificationCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Melding niet gevonden' });
    }

    // Store attachment metadata in database
    const result = await pool.query(
      `INSERT INTO attachments 
        (notification_id, filename, original_filename, file_path, file_type, file_size, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [id, file.filename, file.originalname, file.path, file.mimetype, file.size, userId]
    );

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      ['notification', id, 'attachment_added', JSON.stringify({ filename: file.originalname }), userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Upload attachment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get attachments for notification
router.get('/:id/attachments', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT a.*, u.first_name, u.last_name
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.notification_id = $1
      ORDER BY a.created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get attachments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download/view attachment
router.get('/:id/attachments/:attachmentId/download', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id, attachmentId } = req.params;

    // Get attachment details
    const attachmentResult = await pool.query(
      'SELECT * FROM attachments WHERE id = $1 AND notification_id = $2',
      [attachmentId, id]
    );

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bijlage niet gevonden' });
    }

    const attachment = attachmentResult.rows[0];
    const fs = require('fs');
    const path = require('path');

    // Check if file exists
    if (!fs.existsSync(attachment.file_path)) {
      return res.status(404).json({ error: 'Bestand niet gevonden op server' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', attachment.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.original_filename)}"`);
    res.setHeader('Content-Length', attachment.file_size);

    // Stream the file
    const fileStream = fs.createReadStream(attachment.file_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete attachment
router.delete('/:id/attachments/:attachmentId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id, attachmentId } = req.params;
    const userId = req.user?.id;

    // Get attachment details
    const attachmentResult = await pool.query(
      'SELECT * FROM attachments WHERE id = $1 AND notification_id = $2',
      [attachmentId, id]
    );

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bijlage niet gevonden' });
    }

    const attachment = attachmentResult.rows[0];

    // Delete file from filesystem
    const fs = require('fs');
    if (fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }

    // Delete from database
    await pool.query('DELETE FROM attachments WHERE id = $1', [attachmentId]);

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      ['notification', id, 'attachment_deleted', JSON.stringify({ filename: attachment.original_filename }), userId]
    );

    res.json({ message: 'Bijlage succesvol verwijderd' });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Re-detect zones for a notification
router.post('/:id/detect-zones', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const zones = await detectAndUpdateZones(parseInt(id));

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, user_id) VALUES ($1, $2, $3, $4)',
      ['notification', id, 'zones_detected', userId]
    );

    res.json({ message: 'Zones detected', zones });
  } catch (error) {
    console.error('Detect zones error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manually add a zone to a notification
router.post('/:id/zones/:zoneCoverageId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id, zoneCoverageId } = req.params;
    const userId = req.user?.id;

    await addManualZone(parseInt(id), parseInt(zoneCoverageId));

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, user_id) VALUES ($1, $2, $3, $4)',
      ['notification', id, 'zone_added_manually', userId]
    );

    res.json({ message: 'Zone added' });
  } catch (error) {
    console.error('Add zone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove a zone from a notification
router.delete('/:id/zones/:zoneCoverageId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id, zoneCoverageId } = req.params;
    const userId = req.user?.id;

    await removeZone(parseInt(id), parseInt(zoneCoverageId));

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, user_id) VALUES ($1, $2, $3, $4)',
      ['notification', id, 'zone_removed', userId]
    );

    res.json({ message: 'Zone removed' });
  } catch (error) {
    console.error('Remove zone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manually trigger product detection for a notification
router.post('/:id/detect-products', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const notificationId = parseInt(id);

    if (isNaN(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    // Check if notification exists
    const notificationResult = await pool.query(
      'SELECT id, title FROM notifications WHERE id = $1',
      [notificationId]
    );

    if (notificationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    console.log(`[Manual Product Detection] Triggered for notification ${notificationId}`);

    // Run product detection
    await detectAndLinkProductsForNotification(notificationId);

    // Get the updated products count
    const productsResult = await pool.query(
      `SELECT COUNT(*) as count 
       FROM notifications_products 
       WHERE notification_id = $1 AND is_relevant = true`,
      [notificationId]
    );

    const productsCount = parseInt(productsResult.rows[0].count);

    console.log(`[Manual Product Detection] Completed for notification ${notificationId}. Total linked products: ${productsCount}`);

    res.json({ 
      message: 'Product detection completed successfully',
      productsCount: productsCount
    });
  } catch (error) {
    console.error('Manual product detection error:', error);
    res.status(500).json({ error: 'Failed to detect products' });
  }
});

export default router;
