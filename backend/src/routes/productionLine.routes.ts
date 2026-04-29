import { Router } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Get all production lines
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM production_lines WHERE is_active = true ORDER BY code'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get production lines error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
