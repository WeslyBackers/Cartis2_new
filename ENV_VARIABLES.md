# Environment Variables Reference

## Production (Vercel) Variables

### Database Connection
```
DB_HOST          = db.xxxxx.supabase.co
DB_PORT          = 5432
DB_NAME          = postgres
DB_USER          = postgres
DB_PASSWORD      = (encrypted in Vercel)
```

### Application
```
PORT             = 3000
NODE_ENV         = production
```

### Authentication
```
JWT_SECRET       = (random 64-char hex string)
                   Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Google Cloud Translate
```
GOOGLE_APPLICATION_CREDENTIALS = (full JSON from service account)
```

---

## How to Get Each Variable

### DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

**For Supabase**:
1. Go to https://supabase.com → Your Project
2. Click "Settings" → "Database" (left sidebar)
3. Under "Connection Info", you'll see:
   - **Host**: `db.xxxxx.supabase.co`
   - **Port**: `5432`
   - **Database**: `postgres`
   - **User**: `postgres` (or your custom user)
   - **Password**: (from connection string or settings)

**For Vercel Postgres**:
1. In Vercel dashboard → Project Settings → Storage
2. Click Postgres add-on
3. Copy connection details

**For AWS RDS**:
1. Go to RDS console
2. Click your database instance
3. Under "Connectivity & security", copy endpoint

---

### JWT_SECRET

Generate a secure random string:

```bash
# Option 1: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: OpenSSL
openssl rand -hex 32

# Option 3: Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output and paste as `JWT_SECRET` in Vercel.

---

### GOOGLE_APPLICATION_CREDENTIALS

**If you already have a service account key**:
1. Download JSON file from Google Cloud Console
2. Open in text editor
3. Copy entire JSON content
4. In Vercel dashboard, paste into `GOOGLE_APPLICATION_CREDENTIALS` field

**If you need to create a service account**:
1. Go to https://console.cloud.google.com
2. Project dropdown → Select or create a project
3. Left sidebar → "Service Accounts"
4. Click "Create Service Account"
5. Fill name: `cartis-translate`
6. Click "Create and Continue"
7. Grant role: "Editor" (or "Translation API Admin")
8. Click "Continue"
9. Click "Create Key" → "JSON"
10. Save file, then copy its content to `GOOGLE_APPLICATION_CREDENTIALS`

---

## Adding Variables to Vercel

### Method 1: Dashboard (Recommended)
1. Vercel dashboard → Your Project
2. Settings → Environment Variables
3. Click "Add new"
4. Name: `DB_HOST`
5. Value: `db.xxxxx.supabase.co`
6. Select: "Production, Preview"
7. Click "Add"
8. Repeat for each variable

### Method 2: Vercel CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Link project
vercel link

# Add variables
vercel env add DB_HOST
vercel env add DB_PORT
vercel env add DB_NAME
vercel env add DB_USER
vercel env add DB_PASSWORD
vercel env add JWT_SECRET
vercel env add NODE_ENV
vercel env add PORT
vercel env add GOOGLE_APPLICATION_CREDENTIALS

# Redeploy to apply new env vars
vercel --prod
```

---

## Verifying Variables in Production

After deployment:

```bash
# SSH into Vercel function (if you can)
# Or check logs to see if connection is successful

# From Vercel dashboard:
# Deployments → Click your deployment → Logs
# Look for: "CARTIS 2.0 Backend running on..."
# Or errors like: "ECONNREFUSED" (database not reachable)
```

---

## Local Development vs Production

### Local .env
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cartis
DB_USER=postgres
DB_PASSWORD=your-local-password
PORT=3000
NODE_ENV=development
JWT_SECRET=dev-secret-key
```

### Vercel Production .env (via dashboard)
```
DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=(your supabase password)
PORT=3000
NODE_ENV=production
JWT_SECRET=(random 64-char hex)
GOOGLE_APPLICATION_CREDENTIALS=(full JSON)
```

---

## Security Best Practices

1. ✓ **Never** commit `.env` file to Git
2. ✓ Use Vercel's encrypted env var storage
3. ✓ Rotate JWT_SECRET every 6 months
4. ✓ Use strong database passwords (min 20 chars)
5. ✓ Restrict database access to Vercel IP ranges (if possible)
6. ✓ Enable SSL for database connection
7. ✓ Use read-only database user for API (if possible)

---

## Troubleshooting Environment Variables

### "undefined" values in logs
**Check**: Variable name is exactly spelled in both:
- Vercel dashboard
- Code (`process.env.DB_HOST`)

### "Cannot read property of undefined"
**Solution**: 
```typescript
// Bad: assumes variable exists
const host = process.env.DB_HOST;

// Good: provide default or fail early
const host = process.env.DB_HOST || 'localhost';
// OR
const host = process.env.DB_HOST || (() => { 
  throw new Error('DB_HOST is required'); 
})();
```

### Google Cloud credentials not working
**Check**:
1. Service account has "Translate API Admin" role
2. Translation API is enabled in Google Cloud project
3. JSON is properly formatted (use JSON validator)
4. All special characters are preserved (copy-paste exact)

---

## Production Database Connection Pool

For Vercel (stateless functions), use small connection pool:

**File**: `backend/src/db/pool.ts`

```typescript
import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 2,  // Small pool for serverless
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
```

---

## Monitoring Environment

Add logging to verify vars are loaded:

**File**: `backend/src/index.ts`

```typescript
// After dotenv.config()
console.log('Environment loaded:');
console.log('- DB_HOST:', process.env.DB_HOST ? '✓' : '✗ MISSING');
console.log('- DB_PORT:', process.env.DB_PORT ? '✓' : '✗ MISSING');
console.log('- DB_NAME:', process.env.DB_NAME ? '✓' : '✗ MISSING');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? '✓' : '✗ MISSING');
console.log('- NODE_ENV:', process.env.NODE_ENV);
```

This helps debug missing variables before they cause runtime errors.
