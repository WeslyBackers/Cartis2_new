import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

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

// Lazy singleton — created on first use so missing env vars don't crash startup
// for routes that don't need Supabase (e.g. non-auth routes).
let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (_supabase) return _supabase;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set in environment');
  }

  // Admin client using the secret key — bypasses RLS, for server-side use only
  _supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: customFetch,
    },
  });

  return _supabase;
}

// Export a Proxy so existing callers can use `supabase.from(...)` etc. unchanged.
const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default supabase;
