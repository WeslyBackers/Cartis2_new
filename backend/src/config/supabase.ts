import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set in environment');
}

// Corporate networks often use SSL inspection proxies that present their own
// certificate, causing SELF_SIGNED_CERT_IN_CHAIN errors.
// Use undici (built into Node.js 18+) with rejectUnauthorized: false.
let customFetch: typeof fetch = globalThis.fetch;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Agent } = require('undici') as typeof import('undici');
  const agent = new Agent({ connect: { rejectUnauthorized: false } });
  customFetch = (input: any, init: any = {}) =>
    (globalThis.fetch as any)(input, { ...init, dispatcher: agent });
} catch {
  // undici unavailable — fall back to default fetch
}

// Admin client using the secret key — bypasses RLS, for server-side use only
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    fetch: customFetch,
  },
});

export default supabase;
