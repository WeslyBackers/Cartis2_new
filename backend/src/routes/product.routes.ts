import { Router } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

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

// Get all products
router.get('/', authenticate, async (req, res) => {
  try {
    const { productionLineId, type, isActive } = req.query;

    let query = 'SELECT * FROM products WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (productionLineId) {
      paramCount++;
      query += ` AND production_line_id = $${paramCount}`;
      params.push(productionLineId);
    }

    if (type) {
      paramCount++;
      query += ` AND type = $${paramCount}`;
      params.push(type);
    }

    if (isActive !== undefined) {
      paramCount++;
      query += ` AND is_active = $${paramCount}`;
      params.push(isActive === 'true');
    }

    query += ' ORDER BY code';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single product
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT p.*, pl.code as production_line_code, pl.name as production_line_name
       FROM products p
       LEFT JOIN production_lines pl ON p.production_line_id = pl.id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create product
router.post('/', authenticate, async (req, res) => {
  try {
    const { productionLineId, code, name, type, description, geometry } = req.body;

    const result = await pool.query(
      `INSERT INTO products 
        (production_line_id, code, name, type, description, geometry)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [productionLineId, code, name, type, description, geometry]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, description, geometry, isActive } = req.body;

    const result = await pool.query(
      `UPDATE products
      SET name = COALESCE($1, name),
          type = COALESCE($2, type),
          description = COALESCE($3, description),
          geometry = COALESCE($4, geometry),
          is_active = COALESCE($5, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *`,
      [name, type, description, geometry, isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get products that intersect with a notification's geometry
router.get('/for-notification/:notificationId', authenticate, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { productionLineId } = req.query;

    if (!productionLineId) {
      return res.status(400).json({ error: 'Production line ID is required' });
    }

    // First get the notification geometry
    const notificationResult = await pool.query(
      'SELECT geometry FROM notifications WHERE id = $1',
      [notificationId]
    );

    if (notificationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const notificationGeometry = notificationResult.rows[0].geometry;
    
    if (!notificationGeometry) {
      // No geometry, return no products
      return res.json([]);
    }

    const parsedNotificationGeometry =
      typeof notificationGeometry === 'string'
        ? JSON.parse(notificationGeometry)
        : notificationGeometry;

    const geometriesToCheck = extractIndividualGeometries(parsedNotificationGeometry)
      .map((geometry: any) => JSON.stringify(geometry));

    if (geometriesToCheck.length === 0) {
      return res.json([]);
    }

    // Query products that intersect with any notification geometry
    const result = await pool.query(
      `SELECT p.*,
        EXISTS(
          SELECT 1 FROM notifications_products np 
          WHERE np.notification_id = $1 AND np.product_id = p.id
        ) as is_linked
      FROM products p
      WHERE p.production_line_id = $2
        AND p.is_active = true
        AND p.geometry IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM unnest($3::text[]) AS ng(geom)
          WHERE ST_Intersects(
            ST_GeomFromGeoJSON(p.geometry),
            ST_GeomFromGeoJSON(ng.geom)
          )
        )
      ORDER BY p.code`,
      [notificationId, productionLineId, geometriesToCheck]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get products for notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Link a product to a notification
router.post('/link-to-notification', authenticate, async (req, res) => {
  try {
    const { notificationId, productId, isRelevant, notes } = req.body;

    if (!notificationId || !productId) {
      return res.status(400).json({ error: 'Notification ID and Product ID are required' });
    }

    const result = await pool.query(
      `INSERT INTO notifications_products (notification_id, product_id, is_relevant, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (notification_id, product_id) 
       DO UPDATE SET is_relevant = $3, notes = $4
       RETURNING *`,
      [notificationId, productId, isRelevant !== undefined ? isRelevant : true, notes]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Link product to notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unlink a product from a notification
router.delete('/unlink-from-notification/:notificationId/:productId', authenticate, async (req, res) => {
  try {
    const { notificationId, productId } = req.params;

    const result = await pool.query(
      'DELETE FROM notifications_products WHERE notification_id = $1 AND product_id = $2 RETURNING *',
      [notificationId, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.json({ message: 'Product unlinked successfully' });
  } catch (error) {
    console.error('Unlink product from notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all products for a specific notification
router.get('/notification/:notificationId', authenticate, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { productionLineId } = req.query;

    let query = `
      SELECT p.*, 
        np.is_relevant,
        np.notes,
        pl.code as production_line_code,
        pl.name as production_line_name
      FROM products p
      JOIN notifications_products np ON p.id = np.product_id
      JOIN production_lines pl ON p.production_line_id = pl.id
      WHERE np.notification_id = $1
    `;
    
    const params: any[] = [notificationId];
    
    if (productionLineId) {
      query += ' AND p.production_line_id = $2';
      params.push(productionLineId);
    }
    
    query += ' ORDER BY p.code';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get notification products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
