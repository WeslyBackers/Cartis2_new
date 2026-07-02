import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import supabase from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Helper: fetch production line rights for a user via Supabase PostgREST (HTTPS/443)
async function getUserRights(userId: number) {
  const { data, error } = await supabase
    .from('user_production_line_rights')
    .select('can_view, can_edit, can_publish, production_lines!inner(id, code, name)')
    .eq('user_id', userId)
    .eq('production_lines.is_active', true);

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.production_lines.id,
    code: row.production_lines.code,
    name: row.production_lines.name,
    can_view: row.can_view,
    can_edit: row.can_edit,
    can_publish: row.can_publish,
  }));
}

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, password_hash, first_name, last_name, default_production_line_id, is_active')
      .eq('email', email)
      .limit(1);

    if (userError) throw userError;

    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    const rights = await getUserRights(user.id);

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

    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, default_production_line_id')
      .eq('id', userId)
      .limit(1);

    if (userError) throw userError;

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    const rights = await getUserRights(user.id);

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      defaultProductionLineId: user.default_production_line_id,
      rights,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user
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

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Get user rights
    const rightsResult = await pool.query(
      `SELECT pl.id, pl.code, pl.name, upr.can_view, upr.can_edit, upr.can_publish
       FROM user_production_line_rights upr
       JOIN production_lines pl ON pl.id = upr.production_line_id
       WHERE upr.user_id = $1 AND pl.is_active = true`,
      [user.id]
    );

    // Generate token
    const expiresIn = (process.env.JWT_EXPIRES_IN || '24h') as SignOptions['expiresIn'];
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        productionLineId: user.default_production_line_id,
      },
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
        rights: rightsResult.rows,
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

    // Get user rights
    const rightsResult = await pool.query(
      `SELECT pl.id, pl.code, pl.name, upr.can_view, upr.can_edit, upr.can_publish
       FROM user_production_line_rights upr
       JOIN production_lines pl ON pl.id = upr.production_line_id
       WHERE upr.user_id = $1 AND pl.is_active = true`,
      [userId]
    );

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      defaultProductionLineId: user.default_production_line_id,
      rights: rightsResult.rows,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, password_hash, first_name, last_name, default_production_line_id, is_active')
      .eq('email', email)
      .limit(1);

    if (userError) throw userError;

    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Get user rights
    const rights = await getUserRights(user.id);

    // Generate token
    const expiresIn = (process.env.JWT_EXPIRES_IN || '24h') as SignOptions['expiresIn'];
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        productionLineId: user.default_production_line_id,
      },
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

    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, default_production_line_id')
      .eq('id', userId)
      .limit(1);

    if (userError) throw userError;

    if (!users || users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    const rights = await getUserRights(user.id);

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      defaultProductionLineId: user.default_production_line_id,
      rights,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

