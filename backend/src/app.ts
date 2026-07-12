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

// Temporary: test PostGIS and product detection
app.get('/api/test-postgis', async (_req: Request, res: Response) => {
  const results: any = {};
  try {
    const ext = await pool.query("SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis'");
    results.postgis = ext.rows[0] || 'NOT INSTALLED';
  } catch (e: any) { results.postgis_error = e.message; }
  try {
    const pt = await pool.query("SELECT ST_AsText(ST_GeomFromGeoJSON('{\"type\":\"Point\",\"coordinates\":[4.0,51.0]}')) as result");
    results.st_geomfromgeojson = pt.rows[0]?.result;
  } catch (e: any) { results.st_geomfromgeojson_error = e.message; }
  try {
    const pc = await pool.query('SELECT COUNT(*) as total FROM products WHERE is_active = true AND geometry IS NOT NULL');
    results.products_with_geometry = pc.rows[0]?.total;
  } catch (e: any) { results.products_count_error = e.message; }
  try {
    // Test actual intersection with a sample product
    const sample = await pool.query("SELECT id, code, ST_Force2D(ST_GeomFromGeoJSON(geometry::text)) as geom FROM products WHERE is_active = true AND geometry IS NOT NULL LIMIT 1");
    results.sample_product = sample.rows[0] ? { id: sample.rows[0].id, code: sample.rows[0].code, geom_ok: !!sample.rows[0].geom } : 'none';
  } catch (e: any) { results.sample_product_error = e.message; }
  res.json(results);
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
