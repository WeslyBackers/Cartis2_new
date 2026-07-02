// Vercel serverless entry point for the Express backend.
// On Vercel, pg can connect directly to Supabase pooler — no corporate proxy issues.
import app from '../backend/src/app';

export default app;
