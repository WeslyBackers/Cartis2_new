import { Router } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { syncHpdProjectStatus, getHpdProjectsForTask } from '../services/hpdProject.service';
import { getOrCreateInProgressProductVersion } from '../services/productVersion.service';
import { ensureCorrectionListTaskLink } from '../services/correctionList.service';
import { v2 as googleTranslate } from '@google-cloud/translate';

const router = Router();

// Get all tasks (with filters)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const {
      productionLineId,
      status,
      otherStatus,
      search,
      msiActive,
      needsFollowup,
      page = 1,
      limit = 50,
    } = req.query;

    const params: any[] = [];
    let paramCount = 0;
    let selectedProductionLineParam: number | null = null;

    let productionLineStatusJoin = 'tpls.production_line_id = t.production_line_id';
    let productionLineFilter = '';
    let productJoinFilter = '';
    let otherProductionLineStatusJoinFilter = '';

    if (productionLineId) {
      paramCount++;
      selectedProductionLineParam = paramCount;
      productionLineStatusJoin = `tpls.production_line_id = $${paramCount}`;
      productJoinFilter = ` AND p.production_line_id = $${paramCount}`;
      otherProductionLineStatusJoinFilter = ` AND tpls_all.production_line_id <> $${paramCount}`;
      productionLineFilter = `
        AND (
          t.production_line_id = $${paramCount}
          OR EXISTS (
            SELECT 1
            FROM task_production_line_status tpls_filter
            WHERE tpls_filter.task_id = t.id
              AND tpls_filter.production_line_id = $${paramCount}
          )
        )
      `;
      params.push(productionLineId);
    }

    let query = `
      SELECT t.*,
        COUNT(*) OVER() as total_count,
        tpls.status as production_line_status,
        tpls.wait_for_zk as wait_for_zk,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'productionLineId', tpls_all.production_line_id,
              'productionLineCode', pl_all.code,
              'productionLineName', pl_all.name,
              'status', tpls_all.status,
              'waitForZk', tpls_all.wait_for_zk
            )
          ) FILTER (WHERE tpls_all.id IS NOT NULL),
          '[]'
        ) as all_production_line_statuses,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'productId', tp.product_id,
              'productVersionId', tp.product_version_id,
              'versionNumber', pv.version_number,
              'productCode', p.code,
              'productName', p.name,
              'status', tp.status,
              'notes', tp.notes
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) as products,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', ta.id,
              'baz_number', ta.baz_number,
              'book_number', ta.book_number,
              'is_temporary', ta.is_temporary
            ) ORDER BY ta.book_number, ta.article_number
          )
          FROM task_articles ta
          WHERE ta.task_id = t.id),
          '[]'
        ) as articles
      FROM tasks t
      LEFT JOIN task_products tp ON t.id = tp.task_id
      LEFT JOIN product_versions pv ON tp.product_version_id = pv.id
      LEFT JOIN products p ON tp.product_id = p.id${productJoinFilter}
      LEFT JOIN task_production_line_status tpls ON t.id = tpls.task_id AND ${productionLineStatusJoin}
      LEFT JOIN task_production_line_status tpls_all ON t.id = tpls_all.task_id${otherProductionLineStatusJoinFilter}
      LEFT JOIN production_lines pl_all ON tpls_all.production_line_id = pl_all.id
    `;
    
    query += ` WHERE 1=1 ${productionLineFilter}`;

    if (status) {
      paramCount++;
      query += ` AND tpls.status = $${paramCount}`;
      params.push(status);
    }

    if (otherStatus) {
      paramCount++;
      if (selectedProductionLineParam !== null) {
        query += ` AND EXISTS (
          SELECT 1
          FROM task_production_line_status tpls_other
          WHERE tpls_other.task_id = t.id
            AND tpls_other.production_line_id <> $${selectedProductionLineParam}
            AND tpls_other.status = $${paramCount}
        )`;
      } else {
        query += ` AND EXISTS (
          SELECT 1
          FROM task_production_line_status tpls_other
          WHERE tpls_other.task_id = t.id
            AND tpls_other.status = $${paramCount}
        )`;
      }
      params.push(otherStatus);
    }

    if (msiActive === 'true') {
      query += ` AND t.msi_active = true`;
    }

    if (needsFollowup === 'true') {
      query += ` AND t.needs_followup = true`;
    }

    if (search) {
      paramCount++;
      query += ` AND (t.task_number ILIKE $${paramCount} OR t.title ILIKE $${paramCount} OR t.description ILIKE $${paramCount} OR t.baz_number ILIKE $${paramCount} OR EXISTS (SELECT 1 FROM task_articles ta_s WHERE ta_s.task_id = t.id AND ta_s.baz_number ILIKE $${paramCount}))`;
      params.push(`%${search}%`);
    }

    query += `
      GROUP BY t.id, tpls.status, tpls.wait_for_zk
      ORDER BY t.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const offset = (Number(page) - 1) * Number(limit);
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const totalCount = result.rows.length > 0 ? result.rows[0].total_count : 0;

    res.json({
      data: result.rows.map((row) => ({
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
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get lead times from received notification to completed task to published product version
router.get('/lead-times', authenticate, async (req: AuthRequest, res) => {
  try {
    const { productionLineId, search } = req.query;

    const params: any[] = [];
    let paramCount = 0;

    let query = `
      SELECT
        n.id AS notification_id,
        n.code AS notification_code,
        n.title AS notification_title,
        n.received_date,
        t.id AS task_id,
        t.task_number,
        t.title AS task_title,
        p.id AS product_id,
        p.code AS product_code,
        p.name AS product_name,
        pv.id AS product_version_id,
        pv.version_number,
        pv.publication_date,
        tp.completed_at,
        ROUND(EXTRACT(EPOCH FROM (tp.completed_at - n.received_date)) / 86400.0, 1) AS notice_to_task_days,
        (pv.publication_date - tp.completed_at::date) AS task_to_publication_days,
        (pv.publication_date - n.received_date::date) AS total_days,
        pl.id AS production_line_id,
        pl.code AS production_line_code,
        pl.name AS production_line_name
      FROM task_products tp
      JOIN tasks t ON t.id = tp.task_id
      JOIN products p ON p.id = tp.product_id
      LEFT JOIN product_versions pv ON pv.id = tp.product_version_id
      JOIN production_lines pl ON pl.id = p.production_line_id
      JOIN task_notifications tn ON tn.task_id = t.id
      JOIN notifications n ON n.id = tn.notification_id
      WHERE 1=1
    `;

    if (productionLineId) {
      paramCount++;
      query += ` AND p.production_line_id = $${paramCount}`;
      params.push(productionLineId);
    }

    if (search) {
      paramCount++;
      query += `
        AND (
          n.code ILIKE $${paramCount}
          OR n.title ILIKE $${paramCount}
          OR t.task_number ILIKE $${paramCount}
          OR t.title ILIKE $${paramCount}
          OR p.code ILIKE $${paramCount}
          OR p.name ILIKE $${paramCount}
          OR pv.version_number ILIKE $${paramCount}
        )
      `;
      params.push(`%${search}%`);
    }

    query += `
      ORDER BY n.received_date DESC NULLS LAST, t.task_number DESC, p.code ASC, pv.version_number DESC NULLS LAST
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get task lead times error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single task
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT t.*,
        pl.name as production_line_name,
        pl.code as production_line_code,
        tpls.status as production_line_status,
        tpls.wait_for_zk as wait_for_zk,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', tp.id,
              'product_id', tp.product_id,
              'product_code', p.code,
              'product_name', p.name,
              'product_type', p.type,
              'product_description', p.description,
              'product_production_line_id', p.production_line_id,
              'version_number', pv.version_number,
              'status', tp.status,
              'notes', tp.notes,
              'started_at', tp.started_at,
              'completed_at', tp.completed_at,
              'assigned_to', tp.assigned_to,
              'assigned_to_name', 
                CASE 
                  WHEN assigned_user.id IS NOT NULL 
                  THEN assigned_user.first_name || ' ' || assigned_user.last_name 
                  ELSE NULL 
                END,
              'geometry', p.geometry::jsonb
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) as task_products,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', n.id,
              'code', n.code,
              'title', n.title,
              'content', n.content,
              'notification_date', n.notification_date,
              'received_date', n.received_date,
              'source', n.source,
              'source_detail', n.source_detail,
              'geometry', n.geometry::jsonb,
              'products', (
                SELECT COALESCE(json_agg(
                  json_build_object(
                    'id', np_prod.id,
                    'code', np_prod.code,
                    'name', np_prod.name,
                    'type', np_prod.type,
                    'production_line_id', np_prod.production_line_id,
                    'geometry', np_prod.geometry::jsonb
                  )
                ), '[]')
                FROM notifications_products np
                JOIN products np_prod ON np.product_id = np_prod.id
                WHERE np.notification_id = n.id
              )
            )
          ) FILTER (WHERE n.id IS NOT NULL),
          '[]'
        ) as notifications,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', rt.related_task_id,
              'task_number', related_t.task_number,
              'title', related_t.title,
              'relation_type', rt.relation_type
            )
          ) FILTER (WHERE rt.related_task_id IS NOT NULL),
          '[]'
        ) as related_tasks,
        COALESCE(
          (SELECT json_agg(
            json_build_object(
              'id', ta.id,
              'baz_number', ta.baz_number,
              'book_number', ta.book_number,
              'article_number', ta.article_number,
              'year', ta.year,
              'is_temporary', ta.is_temporary,
              'title_nl', ta.title_nl,
              'title_en', ta.title_en
            ) ORDER BY ta.book_number, ta.article_number
          )
          FROM task_articles ta
          WHERE ta.task_id = t.id),
          '[]'
        ) as articles
      FROM tasks t
      LEFT JOIN production_lines pl ON t.production_line_id = pl.id
      LEFT JOIN task_production_line_status tpls ON t.id = tpls.task_id AND tpls.production_line_id = t.production_line_id
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN task_products tp ON t.id = tp.task_id
      LEFT JOIN products p ON tp.product_id = p.id
      LEFT JOIN product_versions pv ON tp.product_version_id = pv.id
      LEFT JOIN users assigned_user ON tp.assigned_to = assigned_user.id
      LEFT JOIN task_notifications tn ON t.id = tn.task_id
      LEFT JOIN notifications n ON tn.notification_id = n.id
      LEFT JOIN related_tasks rt ON t.id = rt.task_id
      LEFT JOIN tasks related_t ON rt.related_task_id = related_t.id
      WHERE t.id = $1
      GROUP BY t.id, pl.name, pl.code, tpls.status, tpls.wait_for_zk, u.first_name, u.last_name`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      bazNumber,
      msiActive,
      needsFollowup,
      needsExtraInfo,
    } = req.body;
    const userId = req.user?.id;

    const result = await pool.query(
      `UPDATE tasks
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          baz_number = COALESCE($3, baz_number),
          msi_active = COALESCE($4, msi_active),
          needs_followup = COALESCE($5, needs_followup),
          needs_extra_info = COALESCE($6, needs_extra_info),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *`,
      [title, description, bazNumber, msiActive, needsFollowup, needsExtraInfo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, user_id) VALUES ($1, $2, $3, $4)',
      ['task', id, 'updated', userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle task flags (needs_followup, needs_extra_info)
router.patch('/:id/flags', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { needsFollowup, needsExtraInfo } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    if (typeof needsFollowup === 'boolean') {
      paramCount++;
      updates.push(`needs_followup = $${paramCount}`);
      params.push(needsFollowup);
    }
    if (typeof needsExtraInfo === 'boolean') {
      paramCount++;
      updates.push(`needs_extra_info = $${paramCount}`);
      params.push(needsExtraInfo);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid flags provided' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    paramCount++;
    params.push(id);

    const result = await pool.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update task flags error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update task product status
router.put('/:taskId/products/:productId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { taskId, productId } = req.params;
    const { status, notes } = req.body;
    const userId = req.user?.id;

    console.log('Update product status request:', { taskId, productId, status, notes, userId });

    const validStatuses = [
      'hoog_te_verwerken',
      'te_verwerken',
      'in_inspectie',
      'voltooid',
      'niet_van_toepassing',
    ];

    if (!validStatuses.includes(status)) {
      console.log('Invalid status:', status);
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await pool.query(
      `UPDATE task_products
      SET status = $1::varchar,
          notes = COALESCE($2::text, notes),
          started_at = CASE WHEN started_at IS NULL AND $1::varchar = 'in_inspectie' THEN CURRENT_TIMESTAMP ELSE started_at END,
          completed_at = CASE WHEN $1::varchar = 'voltooid' THEN CURRENT_TIMESTAMP ELSE completed_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE task_id = $3
        AND (
          product_id = $4
          OR id = $4
        )
      RETURNING *`,
      [status, notes, taskId, productId]
    );

    console.log('Update result:', result.rows.length, 'rows updated');

    if (result.rows.length === 0) {
      console.log('Task product not found for task_id:', taskId, 'product_id:', productId);
      return res.status(404).json({ error: 'Task product not found' });
    }

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      ['task_product', result.rows[0].id, 'status_updated', JSON.stringify({ status }), userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update task product status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add product to task for a production line (only while line status is not completed)
router.post('/:taskId/products', authenticate, async (req: AuthRequest, res) => {
  try {
    const { taskId } = req.params;
    const { productId, productionLineId, status } = req.body;
    const userId = req.user?.id;

    if (!productId || !productionLineId) {
      return res.status(400).json({ error: 'productId and productionLineId are required' });
    }

    const taskCheck = await pool.query('SELECT id FROM tasks WHERE id = $1', [taskId]);
    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const productResult = await pool.query(
      `SELECT id, production_line_id, is_active
       FROM products
       WHERE id = $1`,
      [productId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];
    if (!product.is_active) {
      return res.status(400).json({ error: 'Product is not active' });
    }

    if (Number(product.production_line_id) !== Number(productionLineId)) {
      return res.status(400).json({ error: 'Product does not belong to the provided production line' });
    }

    const lineStatusResult = await pool.query(
      `SELECT status
       FROM task_production_line_status
       WHERE task_id = $1 AND production_line_id = $2`,
      [taskId, productionLineId]
    );

    const lineStatus = lineStatusResult.rows[0]?.status || 'under_construction';
    if (lineStatus === 'completed') {
      return res.status(409).json({ error: 'Cannot add products: selected production line is completed for this task' });
    }

    const initialStatus = status || 'hoog_te_verwerken';
    const validStatuses = [
      'hoog_te_verwerken',
      'te_verwerken',
      'in_inspectie',
      'voltooid',
      'niet_van_toepassing',
    ];

    if (!validStatuses.includes(initialStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const productVersionId = await getOrCreateInProgressProductVersion(
      Number(productId),
      { userId },
      pool
    );

    const insertResult = await pool.query(
      `INSERT INTO task_products (task_id, product_id, product_version_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (task_id, product_id) DO NOTHING
       RETURNING *`,
      [taskId, productId, productVersionId, initialStatus]
    );

    if (insertResult.rows.length === 0) {
      return res.status(409).json({ error: 'Product is already linked to this task' });
    }

    await ensureCorrectionListTaskLink(Number(taskId), Number(productId), {
      userId,
      status: initialStatus,
    }, pool);

    // Ensure there is a production line status row for this task/line.
    await pool.query(
      `INSERT INTO task_production_line_status (task_id, production_line_id, status, wait_for_zk)
       VALUES (
         $1,
         $2,
         'under_construction',
         CASE WHEN EXISTS (
           SELECT 1 FROM production_lines pl WHERE pl.id = $2 AND pl.code = 'PILOT_ENC'
         ) THEN TRUE ELSE FALSE END
       )
       ON CONFLICT (task_id, production_line_id) DO NOTHING`,
      [taskId, productionLineId]
    );

    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      ['task_product', insertResult.rows[0].id, 'created', JSON.stringify({ taskId, productId, productionLineId, status: initialStatus }), userId]
    );

    res.status(201).json(insertResult.rows[0]);
  } catch (error) {
    console.error('Add task product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add related task
router.post('/:taskId/related/:relatedTaskId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { taskId, relatedTaskId } = req.params;

    await pool.query(
      'INSERT INTO related_tasks (task_id, related_task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [taskId, relatedTaskId]
    );

    res.json({ message: 'Related task added successfully' });
  } catch (error) {
    console.error('Add related task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Link an existing notification to a task (only if no production line is completed yet)
router.post('/:id/notifications', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { notificationId } = req.body;
    const userId = req.user?.id;

    if (!notificationId || Number.isNaN(Number(notificationId))) {
      return res.status(400).json({ error: 'notificationId is required and must be a number' });
    }

    const taskResult = await pool.query(
      'SELECT id FROM tasks WHERE id = $1',
      [id]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const hasCompletedLineResult = await pool.query(
      `SELECT EXISTS (
        SELECT 1
        FROM task_production_line_status
        WHERE task_id = $1 AND status = 'completed'
      ) as has_completed`,
      [id]
    );

    if (hasCompletedLineResult.rows[0]?.has_completed) {
      return res.status(409).json({
        error: 'Cannot add notification: this task is already completed in at least one production line',
      });
    }

    const notificationResult = await pool.query(
      'SELECT id FROM notifications WHERE id = $1',
      [notificationId]
    );

    if (notificationResult.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const linkResult = await pool.query(
      `INSERT INTO task_notifications (task_id, notification_id)
       VALUES ($1, $2)
       ON CONFLICT (task_id, notification_id) DO NOTHING
       RETURNING task_id, notification_id`,
      [id, notificationId]
    );

    if (linkResult.rows.length === 0) {
      return res.status(409).json({ error: 'Notification is already linked to this task' });
    }

    // Link all products from this notification to the task.
    const productsResult = await pool.query(
      `SELECT DISTINCT np.product_id, p.production_line_id
       FROM notifications_products np
       JOIN products p ON p.id = np.product_id
       WHERE np.notification_id = $1`,
      [notificationId]
    );

    let linkedProductsCount = 0;

    for (const row of productsResult.rows) {
      const productId = Number(row.product_id);
      const productionLineId = Number(row.production_line_id);

      const lineStatusResult = await pool.query(
        `SELECT status
         FROM task_production_line_status
         WHERE task_id = $1 AND production_line_id = $2`,
        [id, productionLineId]
      );

      if (lineStatusResult.rows[0]?.status === 'completed') {
        continue;
      }

      const productVersionId = await getOrCreateInProgressProductVersion(
        productId,
        { userId },
        pool
      );

      const insertTaskProductResult = await pool.query(
        `INSERT INTO task_products (task_id, product_id, product_version_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'hoog_te_verwerken', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (task_id, product_id) DO NOTHING
         RETURNING id`,
        [id, productId, productVersionId]
      );

      if (insertTaskProductResult.rows.length > 0) {
        linkedProductsCount++;
      }

      await ensureCorrectionListTaskLink(Number(id), productId, {
        userId,
        status: 'hoog_te_verwerken',
      }, pool);

      await pool.query(
        `INSERT INTO task_production_line_status (task_id, production_line_id, status, wait_for_zk)
         VALUES (
           $1,
           $2,
           'under_construction',
           CASE WHEN EXISTS (
             SELECT 1 FROM production_lines pl WHERE pl.id = $2 AND pl.code = 'PILOT_ENC'
           ) THEN TRUE ELSE FALSE END
         )
         ON CONFLICT (task_id, production_line_id) DO NOTHING`,
        [id, productionLineId]
      );
    }

    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      [
        'task',
        id,
        'notification_linked',
        JSON.stringify({ notificationId, linkedProductsCount }),
        userId,
      ]
    );

    res.status(201).json({
      message: 'Notification linked to task successfully',
      notificationId: Number(notificationId),
      linkedProductsCount,
    });
  } catch (error) {
    console.error('Link notification to task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get comments for a task
router.get('/:id/comments', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT tc.*, 
        u.first_name, 
        u.last_name,
        pl.name as production_line_name,
        pl.code as production_line_code
      FROM task_comments tc
      LEFT JOIN users u ON tc.created_by = u.id
      LEFT JOIN production_lines pl ON tc.production_line_id = pl.id
      WHERE tc.task_id = $1
      ORDER BY tc.created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get task comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add comment to task
router.post('/:id/comments', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { comment, productionLineId } = req.body;
    const userId = req.user?.id;

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ error: 'Comment is required' });
    }

    if (!productionLineId) {
      return res.status(400).json({ error: 'Production line ID is required' });
    }

    const result = await pool.query(
      `INSERT INTO task_comments 
        (task_id, production_line_id, comment, created_by, created_at) 
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) 
      RETURNING *`,
      [id, productionLineId, comment, userId]
    );

    // Create initial production line status if it doesn't exist
    await pool.query(
      `INSERT INTO task_production_line_status 
        (task_id, production_line_id, status, wait_for_zk) 
      VALUES (
        $1,
        $2,
        'under_construction',
        CASE WHEN EXISTS (
          SELECT 1 FROM production_lines pl WHERE pl.id = $2 AND pl.code = 'PILOT_ENC'
        ) THEN TRUE ELSE FALSE END
      ) 
      ON CONFLICT (task_id, production_line_id) DO NOTHING`,
      [id, productionLineId]
    );

    // Get user and production line details
    const detailsResult = await pool.query(
      `SELECT tc.*, 
        u.first_name, 
        u.last_name,
        pl.name as production_line_name,
        pl.code as production_line_code
      FROM task_comments tc
      LEFT JOIN users u ON tc.created_by = u.id
      LEFT JOIN production_lines pl ON tc.production_line_id = pl.id
      WHERE tc.id = $1`,
      [result.rows[0].id]
    );

    res.json(detailsResult.rows[0]);
  } catch (error) {
    console.error('Add task comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update comment
router.put('/comments/:commentId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { commentId } = req.params;
    const { comment } = req.body;
    const userId = req.user?.id;

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ error: 'Comment is required' });
    }

    // Check if user owns the comment
    const checkResult = await pool.query(
      'SELECT created_by, task_id FROM task_comments WHERE id = $1',
      [commentId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (checkResult.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }

    const result = await pool.query(
      `UPDATE task_comments 
      SET comment = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 
      RETURNING *`,
      [comment, commentId]
    );

    // Get user and production line details
    const detailsResult = await pool.query(
      `SELECT tc.*, 
        u.first_name, 
        u.last_name,
        pl.name as production_line_name,
        pl.code as production_line_code
      FROM task_comments tc
      LEFT JOIN users u ON tc.created_by = u.id
      LEFT JOIN production_lines pl ON tc.production_line_id = pl.id
      WHERE tc.id = $1`,
      [commentId]
    );

    res.json(detailsResult.rows[0]);
  } catch (error) {
    console.error('Update task comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workflow for a task (for specific production line)
router.get('/:id/workflow', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { productionLineId } = req.query;

    if (!productionLineId) {
      return res.status(400).json({ error: 'Production line ID is required' });
    }

    const result = await pool.query(
      `SELECT tw.*, 
        u.first_name, 
        u.last_name,
        pl.name as production_line_name,
        pl.code as production_line_code
      FROM task_workflow tw
      LEFT JOIN users u ON tw.created_by = u.id
      LEFT JOIN production_lines pl ON tw.production_line_id = pl.id
      WHERE tw.task_id = $1 AND tw.production_line_id = $2`,
      [id, productionLineId]
    );

    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Get task workflow error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save/update workflow for a task (for specific production line)
router.post('/:id/workflow', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { workflowContent, productionLineId } = req.body;
    const userId = req.user?.id;

    if (!productionLineId) {
      return res.status(400).json({ error: 'Production line ID is required' });
    }

    const result = await pool.query(
      `INSERT INTO task_workflow 
        (task_id, production_line_id, workflow_content, created_by, created_at, updated_at) 
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
      ON CONFLICT (task_id, production_line_id) 
      DO UPDATE SET 
        workflow_content = $3, 
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [id, productionLineId, workflowContent, userId]
    );

    // Create initial production line status if it doesn't exist
    await pool.query(
      `INSERT INTO task_production_line_status 
        (task_id, production_line_id, status, wait_for_zk) 
      VALUES (
        $1,
        $2,
        'under_construction',
        CASE WHEN EXISTS (
          SELECT 1 FROM production_lines pl WHERE pl.id = $2 AND pl.code = 'PILOT_ENC'
        ) THEN TRUE ELSE FALSE END
      ) 
      ON CONFLICT (task_id, production_line_id) DO NOTHING`,
      [id, productionLineId]
    );

    // Get user and production line details
    const detailsResult = await pool.query(
      `SELECT tw.*, 
        u.first_name, 
        u.last_name,
        pl.name as production_line_name,
        pl.code as production_line_code
      FROM task_workflow tw
      LEFT JOIN users u ON tw.created_by = u.id
      LEFT JOIN production_lines pl ON tw.production_line_id = pl.id
      WHERE tw.id = $1`,
      [result.rows[0].id]
    );

    res.json(detailsResult.rows[0]);
  } catch (error) {
    console.error('Save task workflow error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get production line status for a task
router.get('/:id/production-line-status', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT tpls.*, 
        pl.name as production_line_name,
        pl.code as production_line_code
      FROM task_production_line_status tpls
      LEFT JOIN production_lines pl ON tpls.production_line_id = pl.id
      WHERE tpls.task_id = $1
      ORDER BY pl.name`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get task production line status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update production line status for a task
router.put('/:id/production-line-status/:productionLineId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id, productionLineId } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;

    console.log('Update production line status request:', { taskId: id, productionLineId, status, userId });

    const validStatuses = ['under_construction', 'completed', 'rejected'];

    if (!validStatuses.includes(status)) {
      console.log('Invalid production line status:', status);
      return res.status(400).json({ error: 'Invalid status. Must be: under_construction, completed, or rejected' });
    }

    // Upsert the status
    const result = await pool.query(
      `INSERT INTO task_production_line_status 
        (task_id, production_line_id, status, wait_for_zk, created_at, updated_at) 
      VALUES (
        $1,
        $2,
        $3,
        CASE WHEN EXISTS (
          SELECT 1 FROM production_lines pl WHERE pl.id = $2 AND pl.code = 'PILOT_ENC'
        ) THEN TRUE ELSE FALSE END,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      ) 
      ON CONFLICT (task_id, production_line_id) 
      DO UPDATE SET 
        status = $3, 
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [id, productionLineId, status]
    );

    console.log('Production line status update result:', result.rows.length, 'rows affected');

    // If ZK marks task as completed, auto-complete IENC/PILOT_ENC rows that are waiting for ZK.
    if (status === 'completed') {
      const lineCodeResult = await pool.query(
        'SELECT code FROM production_lines WHERE id = $1',
        [productionLineId]
      );

      const updatedLineCode = lineCodeResult.rows[0]?.code;

      if (updatedLineCode === 'ZK') {
        const autoCompletedLinesResult = await pool.query(
          `UPDATE task_production_line_status target_status
           SET status = 'completed',
               updated_at = CURRENT_TIMESTAMP
           FROM production_lines target_line
           WHERE target_status.task_id = $1
             AND target_status.production_line_id = target_line.id
             AND target_line.code IN ('IENC', 'PILOT_ENC')
             AND target_status.wait_for_zk = TRUE
             AND target_status.status <> 'completed'
           RETURNING target_status.production_line_id`,
          [id]
        );

        for (const row of autoCompletedLinesResult.rows) {
          await syncHpdProjectStatus(parseInt(id), Number(row.production_line_id), 'completed');
        }
      }
    }

    // Log activity
    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      ['task_production_line_status', result.rows[0].id, 'status_updated', JSON.stringify({ status, production_line_id: productionLineId }), userId]
    );

    // Sync HPD project status
    await syncHpdProjectStatus(parseInt(id), parseInt(productionLineId), status);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update task production line status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle wait_for_zk flag for a task production line status (IENC/PILOT_ENC only)
router.patch('/:id/production-line-status/:productionLineId/wait-for-zk', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id, productionLineId } = req.params;
    const { waitForZk } = req.body;
    const userId = req.user?.id;

    if (typeof waitForZk !== 'boolean') {
      return res.status(400).json({ error: 'waitForZk must be a boolean' });
    }

    const lineResult = await pool.query(
      'SELECT id, code FROM production_lines WHERE id = $1',
      [productionLineId]
    );

    if (lineResult.rows.length === 0) {
      return res.status(404).json({ error: 'Production line not found' });
    }

    if (!['IENC', 'PILOT_ENC'].includes(lineResult.rows[0].code)) {
      return res.status(400).json({ error: 'waitForZk is only available for IENC and PILOT_ENC' });
    }

    const upsertResult = await pool.query(
      `INSERT INTO task_production_line_status
        (task_id, production_line_id, status, wait_for_zk, created_at, updated_at)
       VALUES ($1, $2, 'under_construction', $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (task_id, production_line_id)
       DO UPDATE SET
         wait_for_zk = $3,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [id, productionLineId, waitForZk]
    );

    let autoCompleted = false;

    // If enabled and ZK is already completed for this task, auto-complete IENC/PILOT_ENC immediately.
    if (waitForZk) {
      const zkCompletedResult = await pool.query(
        `SELECT zks.id
         FROM task_production_line_status zks
         JOIN production_lines zk_line ON zks.production_line_id = zk_line.id
         WHERE zks.task_id = $1
           AND zk_line.code = 'ZK'
           AND zks.status = 'completed'
         LIMIT 1`,
        [id]
      );

      if (zkCompletedResult.rows.length > 0 && upsertResult.rows[0].status !== 'completed') {
        const completeResult = await pool.query(
          `UPDATE task_production_line_status
           SET status = 'completed',
               updated_at = CURRENT_TIMESTAMP
           WHERE task_id = $1
             AND production_line_id = $2
           RETURNING *`,
          [id, productionLineId]
        );

        if (completeResult.rows.length > 0) {
          autoCompleted = true;
          await syncHpdProjectStatus(parseInt(id), parseInt(productionLineId), 'completed');
        }
      }
    }

    await pool.query(
      'INSERT INTO activity_log (entity_type, entity_id, action, changes, user_id) VALUES ($1, $2, $3, $4, $5)',
      [
        'task_production_line_status',
        upsertResult.rows[0].id,
        'wait_for_zk_updated',
        JSON.stringify({ wait_for_zk: waitForZk, auto_completed: autoCompleted, production_line_id: productionLineId }),
        userId,
      ]
    );

    const refreshedResult = await pool.query(
      `SELECT tpls.*, pl.name as production_line_name, pl.code as production_line_code
       FROM task_production_line_status tpls
       LEFT JOIN production_lines pl ON tpls.production_line_id = pl.id
       WHERE tpls.task_id = $1 AND tpls.production_line_id = $2`,
      [id, productionLineId]
    );

    res.json({ ...refreshedResult.rows[0], auto_completed: autoCompleted });
  } catch (error) {
    console.error('Toggle wait_for_zk error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get HPD projects for a task
router.get('/:id/hpd-projects', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const projects = await getHpdProjectsForTask(parseInt(id));
    res.json(projects);
  } catch (error) {
    console.error('Get HPD projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== BaZ Articles ====================

// Get articles for a task
router.get('/:id/articles', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT ta.*, u.first_name as created_by_first_name, u.last_name as created_by_last_name
       FROM task_articles ta
       LEFT JOIN users u ON ta.created_by = u.id
       WHERE ta.task_id = $1
       ORDER BY ta.book_number, ta.article_number`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get task articles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create article for a task
router.post('/:id/articles', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { bookNumber, isTemporary, contentNl, contentEn, titleNl, titleEn } = req.body;
    const userId = req.user?.id;

    if (!bookNumber) {
      return res.status(400).json({ error: 'Book number is required' });
    }

    const year = new Date().getFullYear();

    // Get next article number for this year + book
    const seqResult = await pool.query(
      `SELECT COALESCE(MAX(article_number), 0) + 1 as next_num
       FROM task_articles
       WHERE year = $1 AND book_number = $2`,
      [year, bookNumber]
    );
    const articleNumber = seqResult.rows[0].next_num;

    // Format: YYYY-BB/XXX or YYYY-BB/XXX(T)
    const bb = String(bookNumber).padStart(2, '0');
    const xxx = String(articleNumber).padStart(3, '0');
    const bazNumber = `${year}-${bb}/${xxx}${isTemporary ? '(T)' : ''}`;

    const result = await pool.query(
      `INSERT INTO task_articles (task_id, baz_number, book_number, article_number, year, is_temporary, content_nl, content_en, title_nl, title_en, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [id, bazNumber, bookNumber, articleNumber, year, isTemporary || false, contentNl || '', contentEn || '', titleNl || '', titleEn || '', userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create task article error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update article
router.put('/:id/articles/:articleId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { articleId } = req.params;
    const { contentNl, contentEn, isTemporary, titleNl, titleEn } = req.body;

    const result = await pool.query(
      `UPDATE task_articles
       SET content_nl = COALESCE($1, content_nl),
           content_en = COALESCE($2, content_en),
           is_temporary = COALESCE($3, is_temporary),
           title_nl = COALESCE($4, title_nl),
           title_en = COALESCE($5, title_en),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [contentNl, contentEn, isTemporary, titleNl, titleEn, articleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update task article error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete article
router.delete('/:id/articles/:articleId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { articleId } = req.params;

    const result = await pool.query(
      'DELETE FROM task_articles WHERE id = $1 RETURNING id',
      [articleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json({ message: 'Article deleted' });
  } catch (error) {
    console.error('Delete task article error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Translate NL to EN using Google Translate
router.post('/:id/articles/translate', authenticate, async (req: AuthRequest, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.json({ translatedText: '' });
    }

    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Translate API key not configured' });
    }

    const translate = new googleTranslate.Translate({ key: apiKey });
    const [translation] = await translate.translate(text, { from: 'nl', to: 'en', format: 'html' });

    res.json({ translatedText: translation });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Get all info requests for a task
router.get('/:id/info-requests', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT tir.*, u.first_name, u.last_name
       FROM task_info_requests tir
       LEFT JOIN users u ON tir.created_by = u.id
       WHERE tir.task_id = $1
       ORDER BY tir.created_at DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get info requests error:', error);
    res.status(500).json({ error: 'Failed to fetch info requests' });
  }
});

// Create a new info request
router.post('/:id/info-requests', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { recipient, subject, body } = req.body;
    const userId = (req as AuthRequest).user?.id;

    if (!recipient || !subject || !body) {
      return res.status(400).json({ error: 'Recipient, subject, and body are required' });
    }

    const result = await pool.query(
      `INSERT INTO task_info_requests (task_id, recipient, subject, body, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, recipient, subject, body, userId]
    );

    res.json({ message: 'Info request saved successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Create info request error:', error);
    res.status(500).json({ error: 'Failed to save info request' });
  }
});

export default router;
