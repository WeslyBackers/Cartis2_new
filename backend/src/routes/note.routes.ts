import { Router } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
const NOTE_PRIORITIES = ['laag', 'gemiddeld', 'hoog'] as const;

const sanitizeHtmlForStorage = (html: string): string => {
  if (!html) return '';

  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|object|embed)[\s\S]*?>[\s\S]*?<\/\1>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '');
};

const ensureNoteTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_notes (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      priority VARCHAR(20) NOT NULL DEFAULT 'gemiddeld' CHECK (priority IN ('laag', 'gemiddeld', 'hoog')),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Keep existing databases compatible when this column is introduced later.
  await pool.query(`
    ALTER TABLE user_notes
    ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'gemiddeld'
  `);

  await pool.query(`
    ALTER TABLE user_notes
    DROP CONSTRAINT IF EXISTS user_notes_priority_check
  `);

  await pool.query(`
    ALTER TABLE user_notes
    ADD CONSTRAINT user_notes_priority_check
    CHECK (priority IN ('laag', 'gemiddeld', 'hoog'))
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_note_production_lines (
      note_id INTEGER REFERENCES user_notes(id) ON DELETE CASCADE,
      production_line_id INTEGER REFERENCES production_lines(id) ON DELETE CASCADE,
      PRIMARY KEY (note_id, production_line_id)
    )
  `);
};

// Get notes visible for current user (optionally filtered by production line)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    await ensureNoteTables();

    const userId = req.user?.id;
    const { productionLineId } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const params: any[] = [userId];
    let paramCount = 1;

    let query = `
      SELECT
        n.id,
        n.content,
        n.priority,
        n.created_at,
        n.updated_at,
        n.created_by,
        u.first_name || ' ' || u.last_name AS created_by_name,
        (
          SELECT COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', pl2.id,
                'code', pl2.code,
                'name', pl2.name
              )
            ) FILTER (WHERE pl2.id IS NOT NULL),
            '[]'
          )
          FROM user_note_production_lines unpl2
          JOIN production_lines pl2 ON pl2.id = unpl2.production_line_id
          JOIN user_production_line_rights upr2
            ON upr2.production_line_id = pl2.id
           AND upr2.user_id = $1
           AND upr2.can_view = true
          WHERE unpl2.note_id = n.id
        ) AS production_lines
      FROM user_notes n
      JOIN user_note_production_lines unpl_visible ON unpl_visible.note_id = n.id
      JOIN production_lines pl_visible ON pl_visible.id = unpl_visible.production_line_id
      JOIN user_production_line_rights upr ON upr.production_line_id = pl_visible.id
      LEFT JOIN users u ON u.id = n.created_by
      WHERE upr.user_id = $1
        AND upr.can_view = true
    `;

    if (productionLineId) {
      paramCount++;
      query += ` AND pl_visible.id = $${paramCount}`;
      params.push(productionLineId);
    }

    query += `
      GROUP BY n.id, u.first_name, u.last_name
      ORDER BY n.created_at DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create note and assign readable production lines
router.post('/', authenticate, async (req: AuthRequest, res) => {
  const client = await pool.connect();

  try {
    await ensureNoteTables();

    const userId = req.user?.id;
    const { content, productionLineIds, priority } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Inhoud van de nota is verplicht' });
    }

    const sanitizedContent = sanitizeHtmlForStorage(content);
    const plainTextContent = sanitizedContent.replace(/<[^>]*>/g, '').trim();

    if (!plainTextContent) {
      return res.status(400).json({ error: 'Inhoud van de nota is verplicht' });
    }

    if (!Array.isArray(productionLineIds) || productionLineIds.length === 0) {
      return res.status(400).json({ error: 'Selecteer minstens een productielijn' });
    }

    const normalizedPriority = String(priority || 'gemiddeld').trim().toLowerCase();
    if (!NOTE_PRIORITIES.includes(normalizedPriority as (typeof NOTE_PRIORITIES)[number])) {
      return res.status(400).json({ error: 'Prioriteit moet laag, gemiddeld of hoog zijn' });
    }

    const uniqueProductionLineIds = Array.from(new Set(productionLineIds.map((id: any) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)));

    if (uniqueProductionLineIds.length === 0) {
      return res.status(400).json({ error: 'Ongeldige productielijnen' });
    }

    const rightsResult = await client.query(
      `SELECT production_line_id
       FROM user_production_line_rights
       WHERE user_id = $1
         AND can_view = true
         AND production_line_id = ANY($2::int[])`,
      [userId, uniqueProductionLineIds]
    );

    const allowedIds = rightsResult.rows.map((row: any) => Number(row.production_line_id));
    const disallowedIds = uniqueProductionLineIds.filter((id: number) => !allowedIds.includes(id));

    if (disallowedIds.length > 0) {
      return res.status(403).json({ error: 'Geen toegang tot een of meer geselecteerde productielijnen' });
    }

    await client.query('BEGIN');

    const noteResult = await client.query(
      `INSERT INTO user_notes (content, priority, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [sanitizedContent.trim(), normalizedPriority, userId]
    );

    const note = noteResult.rows[0];

    for (const productionLineId of uniqueProductionLineIds) {
      await client.query(
        `INSERT INTO user_note_production_lines (note_id, production_line_id)
         VALUES ($1, $2)`,
        [note.id, productionLineId]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      ...note,
      production_line_ids: uniqueProductionLineIds,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Update note (only creator can update)
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  const client = await pool.connect();

  try {
    await ensureNoteTables();

    const userId = req.user?.id;
    const noteId = Number(req.params.id);
    const { content, productionLineIds, priority } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!Number.isInteger(noteId) || noteId <= 0) {
      return res.status(400).json({ error: 'Ongeldig nota-id' });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Inhoud van de nota is verplicht' });
    }

    const sanitizedContent = sanitizeHtmlForStorage(content);
    const plainTextContent = sanitizedContent.replace(/<[^>]*>/g, '').trim();

    if (!plainTextContent) {
      return res.status(400).json({ error: 'Inhoud van de nota is verplicht' });
    }

    if (!Array.isArray(productionLineIds) || productionLineIds.length === 0) {
      return res.status(400).json({ error: 'Selecteer minstens een productielijn' });
    }

    const normalizedPriority = String(priority || 'gemiddeld').trim().toLowerCase();
    if (!NOTE_PRIORITIES.includes(normalizedPriority as (typeof NOTE_PRIORITIES)[number])) {
      return res.status(400).json({ error: 'Prioriteit moet laag, gemiddeld of hoog zijn' });
    }

    const uniqueProductionLineIds = Array.from(new Set(productionLineIds.map((id: any) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)));

    if (uniqueProductionLineIds.length === 0) {
      return res.status(400).json({ error: 'Ongeldige productielijnen' });
    }

    const noteResult = await client.query(
      'SELECT id, created_by FROM user_notes WHERE id = $1',
      [noteId]
    );

    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nota niet gevonden' });
    }

    const rightsResult = await client.query(
      `SELECT production_line_id
       FROM user_production_line_rights
       WHERE user_id = $1
         AND can_view = true
         AND production_line_id = ANY($2::int[])`,
      [userId, uniqueProductionLineIds]
    );

    const allowedIds = rightsResult.rows.map((row: any) => Number(row.production_line_id));
    const disallowedIds = uniqueProductionLineIds.filter((id: number) => !allowedIds.includes(id));

    if (disallowedIds.length > 0) {
      return res.status(403).json({ error: 'Geen toegang tot een of meer geselecteerde productielijnen' });
    }

    await client.query('BEGIN');

    const updatedResult = await client.query(
      `UPDATE user_notes
       SET content = $1,
           priority = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [sanitizedContent.trim(), normalizedPriority, noteId]
    );

    await client.query('DELETE FROM user_note_production_lines WHERE note_id = $1', [noteId]);

    for (const productionLineId of uniqueProductionLineIds) {
      await client.query(
        `INSERT INTO user_note_production_lines (note_id, production_line_id)
         VALUES ($1, $2)`,
        [noteId, productionLineId]
      );
    }

    await client.query('COMMIT');

    res.json({
      ...updatedResult.rows[0],
      production_line_ids: uniqueProductionLineIds,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Keep or delete note visibility for a specific production line
router.put('/:id/line-visibility', authenticate, async (req: AuthRequest, res) => {
  try {
    await ensureNoteTables();

    const userId = req.user?.id;
    const noteId = Number(req.params.id);
    const { productionLineId, visible } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!Number.isInteger(noteId) || noteId <= 0) {
      return res.status(400).json({ error: 'Ongeldig nota-id' });
    }

    const targetProductionLineId = Number(productionLineId);
    if (!Number.isInteger(targetProductionLineId) || targetProductionLineId <= 0) {
      return res.status(400).json({ error: 'Ongeldige productielijn' });
    }

    if (typeof visible !== 'boolean') {
      return res.status(400).json({ error: 'Zichtbaarheid moet true of false zijn' });
    }

    const noteResult = await pool.query('SELECT id FROM user_notes WHERE id = $1', [noteId]);
    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nota niet gevonden' });
    }

    const rightsResult = await pool.query(
      `SELECT 1
       FROM user_production_line_rights
       WHERE user_id = $1
         AND production_line_id = $2
         AND can_view = true`,
      [userId, targetProductionLineId]
    );

    if (rightsResult.rows.length === 0) {
      return res.status(403).json({ error: 'Geen toegang tot deze productielijn' });
    }

    if (visible) {
      await pool.query(
        `INSERT INTO user_note_production_lines (note_id, production_line_id)
         VALUES ($1, $2)
         ON CONFLICT (note_id, production_line_id) DO NOTHING`,
        [noteId, targetProductionLineId]
      );
    } else {
      await pool.query(
        `DELETE FROM user_note_production_lines
         WHERE note_id = $1 AND production_line_id = $2`,
        [noteId, targetProductionLineId]
      );
    }

    res.json({
      success: true,
      noteId,
      productionLineId: targetProductionLineId,
      visible,
    });
  } catch (error) {
    console.error('Update note line visibility error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete note (only creator can delete)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    await ensureNoteTables();

    const userId = req.user?.id;
    const noteId = Number(req.params.id);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!Number.isInteger(noteId) || noteId <= 0) {
      return res.status(400).json({ error: 'Ongeldig nota-id' });
    }

    const noteResult = await pool.query(
      'SELECT id, created_by FROM user_notes WHERE id = $1',
      [noteId]
    );

    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nota niet gevonden' });
    }

    const note = noteResult.rows[0];
    if (Number(note.created_by) !== Number(userId)) {
      return res.status(403).json({ error: 'Je kan enkel je eigen notities verwijderen' });
    }

    await pool.query('DELETE FROM user_notes WHERE id = $1', [noteId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
