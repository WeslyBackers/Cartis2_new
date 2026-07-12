import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Routes
import authRoutes from './routes/auth.routes';
import notificationRoutes from './routes/notification.routes';
import taskRoutes from './routes/task.routes';
import productRoutes from './routes/product.routes';
import productVersionRoutes from './routes/productVersion.routes';
import productionLineRoutes from './routes/productionLine.routes';
import userRoutes from './routes/user.routes';
import coverageRoutes from './routes/coverage.routes';
import noteRoutes from './routes/note.routes';
import pool from './config/database';

dotenv.config();

const app: Express = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// Static files (uploads) — only if folder exists (not available on Vercel)
const uploadsPath = path.join(__dirname, '../uploads');
if (fs.existsSync(uploadsPath)) {
  app.use('/uploads', express.static(uploadsPath));
}

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product-versions', productVersionRoutes);
app.use('/api/production-lines', productionLineRoutes);
app.use('/api/users', userRoutes);
app.use('/api/coverages', coverageRoutes);
app.use('/api/notes', noteRoutes);

// Temporary: test PostGIS and product detection with real notification
app.get('/api/test-detection/:notifId', async (req: Request, res: Response) => {
  const { notifId } = req.params;
  const out: any = { notifId };
  try {
    // Get notification geometry
    const nr = await pool.query('SELECT id, code, geometry FROM notifications WHERE id = $1', [notifId]);
    const notif = nr.rows[0];
    out.notification = { id: notif?.id, code: notif?.code, has_geometry: !!notif?.geometry };
    if (!notif?.geometry) { res.json(out); return; }

    // Parse geometry
    const geomObj = typeof notif.geometry === 'string' ? JSON.parse(notif.geometry) : notif.geometry;
    out.geom_type = geomObj.type;

    // Extract individual geometries (same logic as detection function)
    function extractGeoms(g: any): any[] {
      if (!g) return [];
      if (g.type === 'FeatureCollection') return (g.features || []).flatMap((f: any) => extractGeoms(f?.geometry));
      if (g.type === 'Feature') return extractGeoms(g.geometry);
      if (g.type === 'GeometryCollection') return (g.geometries || []).flatMap((geo: any) => extractGeoms(geo));
      if (g.type && g.coordinates) return [g];
      return [];
    }
    function removeZ(g: any): any {
      if (!g || !g.coordinates) return g;
      const clean = (c: any): any => typeof c[0] === 'number' ? [c[0], c[1]] : c.map(clean);
      return { ...g, coordinates: clean(g.coordinates) };
    }
    const cleaned = removeZ(geomObj);
    const geoms = extractGeoms(cleaned);
    out.extracted_geometries = geoms.length;

    if (geoms.length === 0) { res.json(out); return; }

    // Get production lines
    const plr = await pool.query('SELECT id, code FROM production_lines WHERE is_active = true ORDER BY id');
    out.production_lines = plr.rows.map((pl: any) => pl.code);

    // Test intersection for first geometry and first production line
    const testGeom = JSON.stringify(removeZ(geoms[0]));
    out.test_geom = testGeom.substring(0, 100);
    const pl = plr.rows[0];
    out.testing_pl = pl?.code;
    const ir = await pool.query(
      `WITH cp AS (SELECT p.id, p.code, ST_Force2D(ST_GeomFromGeoJSON(p.geometry::text)) as geom FROM products p WHERE p.production_line_id = $1 AND p.is_active = true AND p.geometry IS NOT NULL)
       SELECT id, code FROM cp WHERE ST_Intersects(geom, ST_Force2D(ST_GeomFromGeoJSON($2)))`,
      [pl.id, testGeom]
    );
    out.intersecting_products = ir.rows.map((r: any) => r.code);

  } catch (e: any) { out.error = e.message; }
  res.json(out);
});

// Serve frontend static files in production (Replit, etc.)
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }
}

// 404 handler (API routes only in production since frontend catch-all is above)
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
