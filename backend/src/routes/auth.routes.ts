import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Helper: fetch production line rights for a user from local DB
async function getUserRights(userId: number) {
  const result = await pool.query(
    `SELECT pl.id, pl.code, pl.name, upr.can_view, upr.can_edit, upr.can_publish
     FROM user_production_line_rights upr
     JOIN production_lines pl ON pl.id = upr.production_line_id
     WHERE upr.user_id = $1 AND pl.is_active = true`,
    [userId]
  );
  return result.rows;
}

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userResult = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, default_production_line_id, is_active FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    const rights = await getUserRights(user.id);

    // Resolve default production line name (may not be in user rights)
    const defaultPlFromRights = rights.find((r: any) => r.id === user.default_production_line_id);
    let defaultProductionLineName: string | null = defaultPlFromRights?.name ?? null;
    if (!defaultProductionLineName && user.default_production_line_id) {
      const plResult = await pool.query('SELECT name FROM production_lines WHERE id = $1', [user.default_production_line_id]);
      if (plResult.rows.length > 0) defaultProductionLineName = plResult.rows[0].name;
    }

    const expiresIn = (process.env.JWT_EXPIRES_IN || '24h') as SignOptions['expiresIn'];
    const token = jwt.sign(
      { id: user.id, email: user.email, productionLineId: user.default_production_line_id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        defaultProductionLineId: user.default_production_line_id,
        defaultProductionLineName,
        rights,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;

    const userResult = await pool.query(
      'SELECT id, email, first_name, last_name, default_production_line_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const rights = await getUserRights(user.id);

    const defaultPlFromRights = rights.find((r: any) => r.id === user.default_production_line_id);
    let defaultProductionLineName: string | null = defaultPlFromRights?.name ?? null;
    if (!defaultProductionLineName && user.default_production_line_id) {
      const plResult = await pool.query('SELECT name FROM production_lines WHERE id = $1', [user.default_production_line_id]);
      if (plResult.rows.length > 0) defaultProductionLineName = plResult.rows[0].name;
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      defaultProductionLineId: user.default_production_line_id,
      defaultProductionLineName,
      rights,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
