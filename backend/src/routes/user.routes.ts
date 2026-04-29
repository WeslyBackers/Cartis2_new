import { Router } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Get all users
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, default_production_line_id, is_active, last_login
       FROM users
       ORDER BY last_name, first_name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
