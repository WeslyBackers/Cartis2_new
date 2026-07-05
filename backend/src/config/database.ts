import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbHost = process.env.DB_HOST || '';
const dbPort = process.env.DB_PORT || '';
const dbName = process.env.DB_NAME || '';
const dbUser = process.env.DB_USER || '';
const dbPassword = process.env.DB_PASSWORD || '';
const hasDiscreteDbConfig = Boolean(dbHost || dbPort || dbName || dbUser || dbPassword);

const isSupabaseHost = dbHost.includes('supabase.co') ||
  (process.env.DATABASE_URL || '').includes('supabase.co');
const sslEnabled = (process.env.DB_SSL || '').toLowerCase() === 'true' || isSupabaseHost;

const pool = new Pool({
  // Prefer explicit DB_* variables when provided, because they are easier to override per environment.
  // Fall back to DATABASE_URL for setups that only provide a single connection string.
  ...(hasDiscreteDbConfig
    ? {
        host: dbHost || 'localhost',
        port: parseInt(dbPort || '5432'),
        database: dbName || 'cartis',
        user: dbUser || 'postgres',
        password: dbPassword,
      }
    : {
        connectionString: process.env.DATABASE_URL,
      }
  ),
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  // Vercel serverless functions are short-lived; keep the pool small to avoid
  // exhausting Supabase's connection limit across concurrent invocations.
  max: process.env.VERCEL ? 2 : 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;
