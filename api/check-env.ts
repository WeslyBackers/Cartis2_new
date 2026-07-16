/**
 * Diagnostic endpoint to check environment configuration
 * Access at: https://your-domain.vercel.app/api/check-env
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const hasSupabaseUrl = Boolean(process.env.SUPABASE_URL);
  const hasSupabaseKey = Boolean(process.env.SUPABASE_SECRET_KEY);
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasJwtSecret = Boolean(process.env.JWT_SECRET);
  
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  
  const diagnostics = {
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      VERCEL: process.env.VERCEL || 'not set',
      isProduction,
    },
    requiredVariables: {
      SUPABASE_URL: hasSupabaseUrl ? '✅ Set' : '❌ Missing',
      SUPABASE_SECRET_KEY: hasSupabaseKey ? '✅ Set' : '❌ Missing',
      DATABASE_URL: hasDatabaseUrl ? '✅ Set' : '❌ Missing',
      JWT_SECRET: hasJwtSecret ? '✅ Set' : '❌ Missing',
    },
    uploadConfiguration: {
      storageMode: (hasSupabaseUrl && hasSupabaseKey) ? 'Supabase Storage' : 'Local (will fail in production)',
      uploadPath: process.env.UPLOAD_PATH || 'not set',
      maxFileSize: process.env.MAX_FILE_SIZE || '10485760',
    },
    status: (hasSupabaseUrl && hasSupabaseKey && hasDatabaseUrl && hasJwtSecret) 
      ? '✅ All required variables configured'
      : '❌ Missing required environment variables',
  };
  
  const allConfigured = hasSupabaseUrl && hasSupabaseKey && hasDatabaseUrl && hasJwtSecret;
  
  res.status(allConfigured ? 200 : 500).json(diagnostics);
}
