import { Router } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import upload from '../middleware/upload.middleware';
import { generateNextVersionNumber, getOrCreateInProgressProductVersion } from '../services/productVersion.service';
import { createCorrectionListPreview, isPublCorrectionListProduct } from '../services/correctionList.service';
import { createBaz2PublicationPreview } from '../services/baz2Publication.service';

const router = Router();

const PRODUCT_VERSION_OPEN_STATUS_SQL = "('in behandeling', 'in inspectie', 'in_progress', 'in_inspectie', 'ready')";

function normalizeProductVersionStatus(rawStatus: any): 'in behandeling' | 'in inspectie' | 'gepubliceerd' | null {
  const value = String(rawStatus || '').trim().toLowerCase();

  if (!value) return null;
  if (value === 'in behandeling' || value === 'in_progress' || value === 'ready') return 'in behandeling';
  if (value === 'in inspectie' || value === 'in_inspectie') return 'in inspectie';
  if (value === 'gepubliceerd' || value === 'published') return 'gepubliceerd';

  return null;
}

// Get all product versions
router.get('/', authenticate, async (req, res) => {
  try {
    const { productId, status, productionLineId } = req.query;

    let query = `
      SELECT pv.*, p.code as product_code, p.name as product_name, p.description as product_description,
        p.type as product_type,
        p.production_line_id,
        pl.code as production_line_code,
        pl.name as production_line_name,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM product_versions pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN production_lines pl ON p.production_line_id = pl.id
      LEFT JOIN users u ON pv.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (productId) {
      paramCount++;
      query += ` AND pv.product_id = $${paramCount}`;
      params.push(productId);
    }

    if (status) {
      const normalizedStatus = normalizeProductVersionStatus(status);

      if (!normalizedStatus) {
        return res.status(400).json({ error: 'Invalid product version status' });
      }

      if (normalizedStatus === 'gepubliceerd') {
        query += ` AND pv.status IN ('gepubliceerd', 'published')`;
      } else if (normalizedStatus === 'in inspectie') {
        query += ` AND pv.status IN ('in inspectie', 'in_inspectie')`;
      } else {
        query += ` AND pv.status IN ('in behandeling', 'in_progress', 'ready')`;
      }
    }

    if (productionLineId) {
      paramCount++;
      query += ` AND p.production_line_id = $${paramCount}`;
      params.push(productionLineId);
    }

    query += ' ORDER BY p.production_line_id ASC, p.code ASC, pv.version_date DESC, pv.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get product versions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single product version with tasks
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Get version details
    const versionResult = await pool.query(
      `SELECT pv.*, p.code as product_code, p.name as product_name, p.description as product_description,
        p.type as product_type,
        p.geometry as product_geometry,
        p.production_line_id,
        pl.code as production_line_code,
        pl.name as production_line_name,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM product_versions pv
      JOIN products p ON pv.product_id = p.id
      LEFT JOIN production_lines pl ON p.production_line_id = pl.id
      LEFT JOIN users u ON pv.created_by = u.id
      WHERE pv.id = $1`,
      [id]
    );

    if (versionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product version not found' });
    }

    const version = versionResult.rows[0];

    // Get tasks for this version
    const tasksResult = await pool.query(
      `SELECT t.id, t.task_number, t.title, t.baz_number,
        COALESCE(
          (
            SELECT string_agg(ta.baz_number, ', ' ORDER BY ta.book_number, ta.article_number)
            FROM task_articles ta
            WHERE ta.task_id = t.id
          ),
          ''
        ) AS baz_articles,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', ta.id,
                'baz_number', ta.baz_number,
                'book_number', ta.book_number,
                'article_number', ta.article_number,
                'year', ta.year,
                'is_temporary', ta.is_temporary,
                'title_nl', ta.title_nl,
                'title_en', ta.title_en,
                'content_nl', ta.content_nl,
                'content_en', ta.content_en
              ) ORDER BY ta.book_number, ta.article_number
            )
            FROM task_articles ta
            WHERE ta.task_id = t.id
          ),
          '[]'
        ) AS articles,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', n.id,
                'code', n.code,
                'title', n.title,
                'geometry', n.geometry,
                'coordinates', (
                  SELECT COALESCE(json_agg(
                    json_build_object(
                      'id', nc.id,
                      'geometry', nc.geometry,
                      'latitude', nc.latitude,
                      'longitude', nc.longitude
                    )
                  ), '[]')
                  FROM notification_coordinates nc
                  WHERE nc.notification_id = n.id
                    AND (nc.geometry IS NOT NULL OR (nc.latitude IS NOT NULL AND nc.longitude IS NOT NULL))
                ),
                'products', (
                  SELECT COALESCE(json_agg(
                    json_build_object(
                      'id', p.id,
                      'code', p.code,
                      'name', p.name,
                      'type', p.type,
                      'geometry', p.geometry
                    )
                  ), '[]')
                  FROM (
                    SELECT DISTINCT p.id, p.code, p.name, p.type, p.geometry
                    FROM notifications_products np
                    JOIN products p ON np.product_id = p.id
                    WHERE np.notification_id = n.id
                  ) p
                )
              )
            )
            FROM (
              SELECT DISTINCT n.id, n.code, n.title, n.geometry
              FROM task_notifications tn
              JOIN notifications n ON tn.notification_id = n.id
              WHERE tn.task_id = t.id
            ) n
          ),
          '[]'
        ) AS notice_geometries,
        tp.status, tp.notes, tp.execution_status
      FROM task_products tp
      JOIN tasks t ON tp.task_id = t.id
      WHERE tp.product_id = $1 AND tp.product_version_id = $2
      ORDER BY t.task_number DESC`,
      [version.product_id, id]
    );

    res.json({
      ...version,
      tasks: tasksResult.rows,
    });
  } catch (error) {
    console.error('Get product version error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task execution status for a specific product version
router.patch('/:id/tasks/:taskId/execution-status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id, taskId } = req.params;
    const { executionStatus } = req.body;
    const userId = req.user?.id;

    const validExecutionStatuses = ['not_applicable', 'executed', 'not_executed'];
    if (!validExecutionStatuses.includes(executionStatus)) {
      return res.status(400).json({ error: 'Invalid execution status' });
    }

    const currentResult = await pool.query(
      `SELECT id, status
       FROM task_products
       WHERE task_id = $1
         AND product_version_id = $2
       LIMIT 1`,
      [taskId, id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task link for this product version not found' });
    }

    if (executionStatus === 'executed' && currentResult.rows[0].status !== 'voltooid') {
      return res.status(400).json({
        error: "Status 'uitgevoerd' kan enkel als de taakstatus 'voltooid' is",
      });
    }

    const updateResult = await pool.query(
      `UPDATE task_products
       SET execution_status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE task_id = $2
         AND product_version_id = $3
       RETURNING *`,
      [executionStatus, taskId, id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task link for this product version not found' });
    }

    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      [
        'task_product',
        updateResult.rows[0].id,
        'execution_status_updated',
        JSON.stringify({ execution_status: executionStatus, product_version_id: id }),
        userId,
      ]
    );

    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Update task execution status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create product version
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { productId, versionNumber, versionDate, notes, newEdition, status } = req.body;
    const userId = req.user?.id;

    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }

    const normalizedStatus = normalizeProductVersionStatus(status) || 'in behandeling';
    if (normalizedStatus === 'gepubliceerd') {
      return res.status(400).json({ error: 'Gebruik de publiceeractie om een productversie te publiceren' });
    }

    const existingInProgressResult = await pool.query(
      `SELECT id, version_number
       FROM product_versions
       WHERE product_id = $1
         AND status IN ${PRODUCT_VERSION_OPEN_STATUS_SQL}
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [productId]
    );

    if (existingInProgressResult.rows.length > 0) {
      return res.status(409).json({
        error: 'Er bestaat al een actieve versie voor dit product',
        existingVersion: existingInProgressResult.rows[0],
      });
    }

    const productMetaResult = await pool.query(
      `SELECT p.code, p.name, pl.code as production_line_code
       FROM products p
       LEFT JOIN production_lines pl ON p.production_line_id = pl.id
       WHERE p.id = $1`,
      [productId]
    );

    if (productMetaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product niet gevonden' });
    }

    const productCodeRaw = String(productMetaResult.rows[0].code || '').trim().toLowerCase();
    const productNameRaw = String(productMetaResult.rows[0].name || '').trim().toLowerCase();
    const productionLineCode = String(productMetaResult.rows[0].production_line_code || '').trim().toUpperCase();
    const normalizedCode = productCodeRaw.replace(/[\s_-]+/g, '');
    const normalizedName = productNameRaw.replace(/[\s_-]+/g, '');
    const isPublLichtenlijst = productionLineCode === 'PUBL' && (
      normalizedCode.includes('lichtenlijst') || normalizedName.includes('lichtenlijst')
    );
    const isPublCorrectionList = isPublCorrectionListProduct({
      product_code: productMetaResult.rows[0].code,
      product_name: productMetaResult.rows[0].name,
      production_line_code: productMetaResult.rows[0].production_line_code,
    });
    const forceAutoVersion = productCodeRaw === 'baz-2' || isPublLichtenlijst || isPublCorrectionList;

    const resolvedVersionNumber =
      (!forceAutoVersion && typeof versionNumber === 'string' && versionNumber.trim() !== '')
        ? versionNumber.trim()
        : await generateNextVersionNumber(Number(productId), { newEdition: !!newEdition }, pool);

    const result = await pool.query(
      `INSERT INTO product_versions 
        (product_id, version_number, version_date, status, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [productId, resolvedVersionNumber, versionDate || null, normalizedStatus, notes, userId]
    );

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, user_id) VALUES ($1, $2, $3, $4)',
      ['product_version', result.rows[0].id, 'created', userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create product version error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Publish product version
router.post('/:id/publish', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { newEdition, publicationDate } = req.body || {};
    const userId = req.user?.id;

    const versionMetaResult = await pool.query(
      `SELECT pv.id, pv.product_id, p.name as product_name, p.type as product_type
       FROM product_versions pv
       JOIN products p ON pv.product_id = p.id
       WHERE pv.id = $1`,
      [id]
    );

    if (versionMetaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product version not found' });
    }

    const versionMeta = versionMetaResult.rows[0];
    const productType = String(versionMeta.product_type || '').trim().toLowerCase();
    const isChartType = productType === 'chart';

    if (isChartType && (!publicationDate || !String(publicationDate).trim())) {
      return res.status(400).json({ error: 'Publication date is required for chart products' });
    }

    const publicationDateValue = publicationDate ? String(publicationDate).trim() : null;

    // Update version status
    const result = await pool.query(
      `UPDATE product_versions
      SET status = 'gepubliceerd',
          publication_date = COALESCE($2::date, CURRENT_DATE),
          version_number = CASE
            WHEN lower(COALESCE($5, '')) = 'chart'
              THEN COALESCE($4, '') || '_' || to_char(COALESCE($2::date, CURRENT_DATE), 'DD/MM/YYYY')
            ELSE version_number
          END,
          published_by = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *`,
      [userId, publicationDateValue, id, versionMeta.product_name, versionMeta.product_type]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product version not found' });
    }

    const version = result.rows[0];

    // Ensure there is a next in-progress version after publication.
    const nextVersionId = await getOrCreateInProgressProductVersion(
      Number(version.product_id),
      { userId, newEdition: !!newEdition, notes: 'Automatisch aangemaakt na publicatie' },
      pool
    );

    // Move only tasks that are not marked as executed to the next in-progress version.
    // Tasks marked as executed stay linked to the published version.
    await pool.query(
      `UPDATE task_products
       SET product_version_id = $1
       WHERE product_id = $2
       AND product_version_id = $3
       AND COALESCE(execution_status, 'not_executed') <> 'executed'`,
      [nextVersionId, version.product_id, id]
    );

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, user_id) VALUES ($1, $2, $3, $4)',
      ['product_version', id, 'published', userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Publish product version error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update status for a product version (except publish status)
router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;

    const normalizedStatus = normalizeProductVersionStatus(status);
    if (!normalizedStatus) {
      return res.status(400).json({ error: 'Invalid product version status' });
    }

    if (normalizedStatus === 'gepubliceerd') {
      return res.status(400).json({ error: 'Gebruik de publiceeractie om een productversie te publiceren' });
    }

    const result = await pool.query(
      `UPDATE product_versions
       SET status = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [normalizedStatus, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product version not found' });
    }

    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      [
        'product_version',
        id,
        'status_updated',
        JSON.stringify({ status: normalizedStatus }),
        userId,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update product version status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate correction list preview for a product version
router.get('/:id/corrections-list', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const preview = await createCorrectionListPreview(Number(id), pool);
    res.json(preview);
  } catch (error: any) {
    if (error.message === 'Product version not found') {
      return res.status(404).json({ error: 'Product version not found' });
    }

    if (error.message === 'Product version is not a correction list') {
      return res.status(400).json({ error: 'Selected product version is not a correction list' });
    }

    console.error('Generate correction list preview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate BaZ-2 publication preview for a product version
router.get('/:id/baz2-publication', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const preview = await createBaz2PublicationPreview(Number(id), pool);
    res.json(preview);
  } catch (error: any) {
    if (error.message === 'Product version not found') {
      return res.status(404).json({ error: 'Product version not found' });
    }

    if (error.message === 'Product version is not BaZ-2') {
      return res.status(400).json({ error: 'Selected product version is not BaZ-2' });
    }

    console.error('Generate BaZ-2 publication preview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload attachment to product version
router.post('/:id/attachments', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Geen bestand geüpload' });
    }

    const versionCheck = await pool.query(
      'SELECT id FROM product_versions WHERE id = $1',
      [id]
    );

    if (versionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Productversie niet gevonden' });
    }

    const result = await pool.query(
      `INSERT INTO product_version_attachments
        (product_version_id, filename, original_filename, file_path, file_type, file_size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, file.filename, file.originalname, file.path, file.mimetype, file.size, userId]
    );

    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      ['product_version', id, 'attachment_added', JSON.stringify({ filename: file.originalname }), userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Upload product version attachment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get attachments for product version
router.get('/:id/attachments', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT a.*, u.first_name, u.last_name
       FROM product_version_attachments a
       LEFT JOIN users u ON a.uploaded_by = u.id
       WHERE a.product_version_id = $1
       ORDER BY a.created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get product version attachments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download product version attachment
router.get('/:id/attachments/:attachmentId/download', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id, attachmentId } = req.params;

    const attachmentResult = await pool.query(
      'SELECT * FROM product_version_attachments WHERE id = $1 AND product_version_id = $2',
      [attachmentId, id]
    );

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bijlage niet gevonden' });
    }

    const attachment = attachmentResult.rows[0];
    const fs = require('fs');

    if (!fs.existsSync(attachment.file_path)) {
      return res.status(404).json({ error: 'Bestand niet gevonden op server' });
    }

    res.setHeader('Content-Type', attachment.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.original_filename)}"`);
    res.setHeader('Content-Length', attachment.file_size);

    const fileStream = fs.createReadStream(attachment.file_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download product version attachment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
