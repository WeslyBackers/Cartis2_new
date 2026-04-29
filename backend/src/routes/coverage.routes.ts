import { Router } from 'express';
import pool from '../config/database';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Get all KML files
router.get('/files', authenticate, async (req, res) => {
  try {
    const { category, productionLineId } = req.query;

    let query = `
      SELECT f.*, pl.code as production_line_code, pl.name as production_line_name,
             COUNT(c.id) as coverage_count
      FROM kml_files f
      LEFT JOIN production_lines pl ON f.production_line_id = pl.id
      LEFT JOIN kml_coverages c ON c.kml_file_id = f.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      query += ` AND f.category = $${paramCount}`;
      params.push(category);
    }

    if (productionLineId) {
      paramCount++;
      query += ` AND f.production_line_id = $${paramCount}`;
      params.push(productionLineId);
    }

    query += ' GROUP BY f.id, pl.code, pl.name ORDER BY f.category, f.display_name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get KML files error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single KML file with all its coverages
router.get('/files/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const fileResult = await pool.query(
      `SELECT f.*, pl.code as production_line_code, pl.name as production_line_name
       FROM kml_files f
       LEFT JOIN production_lines pl ON f.production_line_id = pl.id
       WHERE f.id = $1`,
      [id]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'KML file not found' });
    }

    const coveragesResult = await pool.query(
      'SELECT * FROM kml_coverages WHERE kml_file_id = $1 ORDER BY code',
      [id]
    );

    res.json({
      ...fileResult.rows[0],
      coverages: coveragesResult.rows
    });
  } catch (error) {
    console.error('Get KML file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all product coverages
router.get('/products', authenticate, async (req, res) => {
  try {
    const { productionLineId, code } = req.query;

    let query = `
      SELECT c.*, f.display_name as file_name, f.filename, pl.code as production_line_code
      FROM kml_coverages c
      JOIN kml_files f ON c.kml_file_id = f.id
      LEFT JOIN production_lines pl ON f.production_line_id = pl.id
      WHERE f.category = 'products'
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (productionLineId) {
      paramCount++;
      query += ` AND f.production_line_id = $${paramCount}`;
      params.push(productionLineId);
    }

    if (code) {
      paramCount++;
      query += ` AND c.code ILIKE $${paramCount}`;
      params.push(`%${code}%`);
    }

    query += ' ORDER BY c.code';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get product coverages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all communication zones
router.get('/zones', authenticate, async (req, res) => {
  try {
    const { code } = req.query;

    let query = `
      SELECT c.*, f.display_name as file_name, f.filename
      FROM kml_coverages c
      JOIN kml_files f ON c.kml_file_id = f.id
      WHERE f.category = 'zones'
    `;
    const params: any[] = [];

    if (code) {
      query += ` AND c.code ILIKE $1`;
      params.push(`%${code}%`);
    }

    query += ' ORDER BY c.code';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get zones error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get coverage by ID
router.get('/coverages/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT c.*, f.display_name as file_name, f.filename, f.category,
              pl.code as production_line_code, pl.name as production_line_name
       FROM kml_coverages c
       JOIN kml_files f ON c.kml_file_id = f.id
       LEFT JOIN production_lines pl ON f.production_line_id = pl.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coverage not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get coverage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get coverage by code
router.get('/coverages/code/:code', authenticate, async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool.query(
      `SELECT c.*, f.display_name as file_name, f.filename, f.category,
              pl.code as production_line_code, pl.name as production_line_name
       FROM kml_coverages c
       JOIN kml_files f ON c.kml_file_id = f.id
       LEFT JOIN production_lines pl ON f.production_line_id = pl.id
       WHERE c.code = $1`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coverage not found' });
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Get coverage by code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search coverages (by code or name)
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q, category, productionLineId } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    let query = `
      SELECT c.*, f.display_name as file_name, f.filename, f.category,
             pl.code as production_line_code, pl.name as production_line_name
      FROM kml_coverages c
      JOIN kml_files f ON c.kml_file_id = f.id
      LEFT JOIN production_lines pl ON f.production_line_id = pl.id
      WHERE (c.code ILIKE $1 OR c.name ILIKE $1)
    `;
    const params: any[] = [`%${q}%`];
    let paramCount = 1;

    if (category) {
      paramCount++;
      query += ` AND f.category = $${paramCount}`;
      params.push(category);
    }

    if (productionLineId) {
      paramCount++;
      query += ` AND f.production_line_id = $${paramCount}`;
      params.push(productionLineId);
    }

    query += ' ORDER BY c.code LIMIT 50';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Search coverages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get GeoJSON for all coverages (for map display)
router.get('/geojson', authenticate, async (req, res) => {
  try {
    const { category, productionLineId, fileId } = req.query;

    let query = `
      SELECT c.id, c.code, c.name, c.geometry_type, c.geometry, c.properties,
             f.display_name as file_name, f.category,
             pl.code as production_line_code
      FROM kml_coverages c
      JOIN kml_files f ON c.kml_file_id = f.id
      LEFT JOIN production_lines pl ON f.production_line_id = pl.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      query += ` AND f.category = $${paramCount}`;
      params.push(category);
    }

    if (productionLineId) {
      paramCount++;
      query += ` AND f.production_line_id = $${paramCount}`;
      params.push(productionLineId);
    }

    if (fileId) {
      paramCount++;
      query += ` AND f.id = $${paramCount}`;
      params.push(fileId);
    }

    const result = await pool.query(query, params);

    // Convert to GeoJSON FeatureCollection
    const featureCollection = {
      type: 'FeatureCollection',
      features: result.rows.map((row: any) => ({
        type: 'Feature',
        id: row.id,
        geometry: JSON.parse(row.geometry),
        properties: {
          code: row.code,
          name: row.name,
          file_name: row.file_name,
          category: row.category,
          production_line_code: row.production_line_code,
          ...JSON.parse(row.properties || '{}')
        }
      }))
    };

    res.json(featureCollection);
  } catch (error) {
    console.error('Get GeoJSON error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
