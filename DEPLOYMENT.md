# Vercel Deployment Guide for CARTIS 2.0

## Prerequisites

1. **Vercel Account**: Sign up at https://vercel.com
2. **GitHub Repository**: Push your code to GitHub
3. **Database**: Set up PostgreSQL with PostGIS extension
   - Option A: Managed (Supabase, Vercel Postgres)
   - Option B: Self-hosted (AWS RDS, Railway, etc.)
4. **Google Cloud Translate API**: Service account key ready
5. **File Storage**: Plan for `/uploads` folder (stateless serverless limitation)

---

## Step 1: Prepare Database (Choose One Option)

### Option A: Supabase (Recommended - Simplest)

1. Go to https://supabase.com and create a project
2. In PostgreSQL settings, enable PostGIS extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. Get connection details:
   - Host: `db.xxxxx.supabase.co`
   - Port: `5432`
   - Database: `postgres`
   - User: `postgres`
   - Password: (from Supabase dashboard)

4. Run your database schema migration locally to populate tables:
   ```bash
   # Locally (before deployment)
   DB_HOST=db.xxxxx.supabase.co \
   DB_PORT=5432 \
   DB_NAME=postgres \
   DB_USER=postgres \
   DB_PASSWORD=your-password \
   npm run backfill:publ-correction-lists
   ```

### Option B: Vercel Postgres

1. In Vercel dashboard, add Postgres add-on to your project
2. Connection string will be provided automatically

---

## Step 2: File Storage Setup

**⚠️ Important**: Vercel Functions are stateless. `/uploads` folder won't persist.

**Recommended Solutions**:

1. **Vercel Blob Storage** (Easiest):
   ```bash
   npm install --save @vercel/blob
   ```
   Update backend to use Blob instead of local `/uploads`

2. **AWS S3**:
   - Create S3 bucket
   - Get Access Key ID and Secret Access Key
   - Install AWS SDK: `npm install --save aws-sdk`

3. **Supabase Storage**:
   - Already enabled if using Supabase
   - Use Supabase client to upload files

**For now**: Store reference to external storage in DB, migrate code gradually

---

## Step 3: Connect GitHub to Vercel

1. Go to https://vercel.com/import
2. Select your GitHub repository
3. Vercel will auto-detect:
   - Build command: `npm run build`
   - Output directory: `frontend/dist`

4. Under "Project Settings" → "Environment Variables", add:

   ```
   DB_HOST          = db.xxxxx.supabase.co
   DB_PORT          = 5432
   DB_NAME          = postgres
   DB_USER          = postgres
   DB_PASSWORD      = your-supabase-password
   PORT             = 3000
   NODE_ENV         = production
   JWT_SECRET       = your-random-secret-key
   GOOGLE_APPLICATION_CREDENTIALS = your-google-cloud-key-json
   ```

---

## Step 4: Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Click "Settings" → "Environment Variables"
3. Add each variable (one at a time):

   ```
   Name: DB_HOST
   Value: db.xxxxx.supabase.co
   Add to: Production, Preview
   
   Name: DB_PORT
   Value: 5432
   Add to: Production, Preview
   
   ... repeat for all variables above
   ```

**For sensitive data** (passwords, API keys):
- Use Vercel's secret reference: In dashboard, paste the full value
- Vercel will automatically encrypt it

---

## Step 5: Backend TypeScript Build Configuration

Verify `backend/tsconfig.json` has correct output:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

---

## Step 6: Update Backend for Vercel

### Fix multer uploads to use memory instead of disk:

**File**: `backend/src/routes/productVersion.routes.ts`

```typescript
import multer from 'multer';

// Use memory storage instead of disk
const upload = multer({ storage: multer.memoryStorage() });

// Store to external service (e.g., Supabase) instead:
router.post('/:id/files', upload.single('file'), async (req, res) => {
  // For now: You can either:
  // 1. Pass file to Supabase Storage
  // 2. Store file buffer in database as BYTEA
  // 3. Upload to S3
});
```

### Ensure `/uploads` folder is not required:

**File**: `backend/src/index.ts` (around line 31)

```typescript
// Comment out this line or make it optional:
// app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Only serve uploads if folder exists:
const uploadsPath = path.join(__dirname, '../uploads');
if (fs.existsSync(uploadsPath)) {
  app.use('/uploads', express.static(uploadsPath));
}
```

---

## Step 7: Trigger Deployment

1. Push code to GitHub:
   ```bash
   git add .
   git commit -m "Deploy to Vercel"
   git push origin main
   ```

2. Vercel will automatically trigger build and deploy

3. Monitor deployment at: https://vercel.com/dashboard

---

## Step 8: Post-Deployment Checklist

- [ ] Frontend loads at your Vercel URL
- [ ] API health check: `https://your-domain/api/health`
- [ ] Login page works (test auth routes)
- [ ] Database connection successful
- [ ] Correction list preview works: `GET /api/product-versions/{id}/corrections-list`
- [ ] Print function works in browser
- [ ] File uploads gracefully handle (redirect to external storage)

---

## Troubleshooting

### Build Fails: "Cannot find module 'dotenv'"
**Solution**: Add `dotenv` to `backend/package.json` dependencies (already there)

### Build Fails: "TypeScript errors"
**Solution**: Run locally:
```bash
npm run build
npm run typecheck
```

### API returns 503 during first request
**Solution**: Cold start on Vercel functions is normal. First request takes 3-5s.

### Database connection timeout
**Solution**: 
1. Verify DB_HOST is correct
2. Check DB allows remote connections
3. For Supabase: Ensure "Enforce SSL" is disabled if connecting from Vercel

### File uploads don't persist
**Solution**: This is expected with Vercel Functions. Implement external storage:
```bash
npm install --save @vercel/blob
```
Then migrate upload code to use Blob API.

---

## Rollback

If deployment breaks production:

```bash
git revert <commit-hash>
git push origin main
```

Vercel will auto-deploy the previous working version.

---

## Performance Optimization

After deployment works, optimize:

1. **Database Connection Pooling**: Add connection pool to reduce cold-start time
   ```typescript
   import { Pool } from 'pg';
   const pool = new Pool({ max: 2 }); // Small pool for Vercel
   ```

2. **Edge Caching**: Configure Vercel cache headers in `vercel.json`

3. **Font Optimization**: Already done in frontend (Vite)

---

## Next Steps

1. Implement external file storage migration
2. Set up database backups (Supabase auto-backups included)
3. Configure custom domain (Project Settings → Domains)
4. Set up GitHub branch preview deployments
5. Monitor logs: Vercel dashboard → Logs tab
