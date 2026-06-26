import { Router } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import multer from 'multer';
import path from 'path';
import { DOMParser } from '@xmldom/xmldom';
import * as toGeoJSON from '@tmcw/togeojson';

const router = Router();

const KML_PRODUCTION_LINE_MAPPING: Record<string, { code: string; type: string }> = {
  'pilot-enc': { code: 'PILOT_ENC', type: 'pilot_enc' },
  ienc: { code: 'IENC', type: 'ienc' },
  enc_: { code: 'ZK', type: 'enc' },
  zk_: { code: 'ZK', type: 'chart' },
};

const DEFAULT_TYPE_BY_LINE_CODE: Record<string, string> = {
  ZK: 'enc',
  IENC: 'ienc',
  PILOT_ENC: 'pilot_enc',
  PUBL: 'chart',
};

const kmlUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const fileName = String(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    const isKml =
      fileName.endsWith('.kml') ||
      mime.includes('kml') ||
      mime === 'application/xml' ||
      mime === 'text/xml';

    if (!isKml) {
      cb(new Error('Alleen KML-bestanden zijn toegestaan'));
      return;
    }

    cb(null, true);
  },
});

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

function getProductionLineFromFilename(filename: string): { code: string; type: string } | null {
  const lower = filename.toLowerCase();
  const patterns = ['pilot-enc', 'ienc', 'enc_', 'zk_'];

  for (const pattern of patterns) {
    if (lower.startsWith(pattern) && KML_PRODUCTION_LINE_MAPPING[pattern]) {
      return KML_PRODUCTION_LINE_MAPPING[pattern];
    }
  }

  return null;
}

function normalizeDescription(raw: unknown): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  let value: string;
  if (typeof raw === 'string') {
    value = raw;
  } else if (typeof raw === 'object') {
    const candidate = raw as Record<string, unknown>;
    if (typeof candidate.value === 'string') {
      value = candidate.value;
    } else if (typeof candidate['@value'] === 'string') {
      value = candidate['@value'];
    } else {
      value = JSON.stringify(raw);
    }
  } else {
    value = String(raw);
  }

  const cleaned = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.substring(0, 4000);
}

function extractObjnam(descriptionRaw: unknown): string | null {
  const description = normalizeDescription(descriptionRaw);
  if (!description) {
    return null;
  }

  const htmlMatch = description.match(/OBJNAM\s*=\s*(.+?)(?:\n|$)/i);
  if (htmlMatch && htmlMatch[1]) {
    return htmlMatch[1].trim();
  }

  const compactMatch = description.match(/OBJNAM(.+?)$/i);
  if (compactMatch && compactMatch[1]) {
    return compactMatch[1].trim();
  }

  return null;
}

function parseKmlToGeoJson(kmlBuffer: Buffer): any {
  const xml = kmlBuffer.toString('utf8');
  const kmlDoc = new DOMParser().parseFromString(xml, 'text/xml');
  return toGeoJSON.kml(kmlDoc as any);
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

// Import products from a KML file and upsert into database
router.post('/import-kml', authenticate, kmlUpload.single('file'), async (req: AuthRequest, res) => {
  const client = await pool.connect();

  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Niet geauthenticeerd' });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Geen KML-bestand ontvangen' });
    }

    const providedProductionLineId = Number(req.body.productionLineId);
    const fileName = req.file.originalname || 'upload.kml';
    const inferred = getProductionLineFromFilename(fileName);

    let productionLineQuery;
    if (Number.isFinite(providedProductionLineId) && providedProductionLineId > 0) {
      productionLineQuery = await client.query(
        'SELECT id, code, name FROM production_lines WHERE id = $1',
        [providedProductionLineId]
      );
    } else if (inferred?.code) {
      productionLineQuery = await client.query(
        'SELECT id, code, name FROM production_lines WHERE code = $1',
        [inferred.code]
      );
    } else {
      return res.status(400).json({
        error: 'Productielijn ontbreekt. Selecteer een productielijn of gebruik een KML-bestandsnaam met ENC_/IENC/Pilot-ENC.',
      });
    }

    if (!productionLineQuery || productionLineQuery.rows.length === 0) {
      return res.status(400).json({ error: 'Productielijn niet gevonden' });
    }

    const productionLine = productionLineQuery.rows[0] as { id: number; code: string; name: string };

    const rightsResult = await client.query(
      `SELECT 1
       FROM user_production_line_rights
       WHERE user_id = $1
         AND production_line_id = $2
         AND can_edit = true
       LIMIT 1`,
      [req.user.id, productionLine.id]
    );

    if (rightsResult.rows.length === 0) {
      return res.status(403).json({ error: 'Geen rechten om producten te importeren voor deze productielijn' });
    }

    const geoJson = parseKmlToGeoJson(req.file.buffer);
    const features: any[] = Array.isArray(geoJson?.features) ? geoJson.features : [];

    if (features.length === 0) {
      return res.status(400).json({ error: 'Geen features gevonden in het KML-bestand' });
    }

    const requestedType = typeof req.body.type === 'string' && req.body.type.trim() ? req.body.type.trim() : null;
    const fallbackType = inferred?.type || DEFAULT_TYPE_BY_LINE_CODE[productionLine.code] || null;

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: Array<{ index: number; reason: string; code?: string }> = [];

    await client.query('BEGIN');

    for (let index = 0; index < features.length; index++) {
      const feature = features[index];
      const geometry = feature?.geometry;

      if (!geometry || !geometry.coordinates) {
        skipped++;
        errors.push({ index, reason: 'Feature zonder geldige geometrie' });
        continue;
      }

      const rawCode = feature?.properties?.name;
      const productCode = typeof rawCode === 'string' ? rawCode.trim() : '';
      if (!productCode) {
        skipped++;
        errors.push({ index, reason: 'Feature zonder productcode (name)' });
        continue;
      }

      const description = normalizeDescription(feature?.properties?.description);
      const objnam = extractObjnam(feature?.properties?.description);
      const name = objnam || productCode;
      const productType = requestedType || fallbackType;

      const upsertResult = await client.query(
        `INSERT INTO products (
          production_line_id,
          code,
          name,
          type,
          description,
          geometry,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (production_line_id, code)
        DO UPDATE SET
          name = COALESCE(EXCLUDED.name, products.name),
          type = COALESCE(EXCLUDED.type, products.type),
          description = COALESCE(EXCLUDED.description, products.description),
          geometry = EXCLUDED.geometry,
          is_active = true,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, (xmax = 0) AS inserted`,
        [
          productionLine.id,
          productCode,
          name,
          productType,
          description,
          JSON.stringify(geometry),
        ]
      );

      if (upsertResult.rows[0]?.inserted) {
        inserted++;
      } else {
        updated++;
      }
    }

    await client.query('COMMIT');

    return res.json({
      message: 'KML import voltooid',
      fileName: path.basename(fileName),
      productionLine,
      summary: {
        totalFeatures: features.length,
        inserted,
        updated,
        skipped,
      },
      errors: errors.slice(0, 100),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('KML import error:', error);
    return res.status(500).json({ error: 'Fout bij importeren van KML-bestand' });
  } finally {
    client.release();
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
