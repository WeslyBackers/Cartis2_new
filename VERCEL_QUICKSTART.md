# Vercel Deployment - Quick Start

This is your step-by-step guide to deploy CARTIS 2.0 to Vercel.

## 🚀 Quick Setup (5-10 minutes)

### 1. Database Setup

**Choose your database provider:**

#### Option A: Supabase (Recommended)
```bash
# 1. Create account at https://supabase.com
# 2. Create new project
# 3. Enable PostGIS extension in SQL editor:
CREATE EXTENSION IF NOT EXISTS postgis;

# 4. Get connection details from Project Settings → Database
# You need: Host, Port, Database, User, Password
```

#### Option B: Vercel Postgres
```bash
# Skip this for now - will be added to Vercel project later
```

### 2. Google Cloud Credentials

```bash
# Generate service account JSON from Google Cloud Console
# Or export existing key from: 
# https://console.cloud.google.com → Service Accounts → Keys

# You'll paste this as GOOGLE_APPLICATION_CREDENTIALS env var
```

### 3. GitHub Connection

```bash
# Ensure your code is pushed to GitHub
git add .
git commit -m "Add Vercel deployment config"
git push origin main
```

---

## 📊 Deploy to Vercel (5 minutes)

### Step 1: Import Project
1. Go to https://vercel.com/import
2. Select your GitHub repository (cartis-new)
3. Click "Import"

### Step 2: Project Configuration
Vercel should auto-detect:
- **Framework Preset**: Other
- **Build Command**: `npm run build` ✓
- **Output Directory**: `frontend/dist` ✓
- **Install Command**: Default ✓

Click "Continue"

### Step 3: Environment Variables

Add these in the Vercel dashboard:

```
DB_HOST = db.xxxxx.supabase.co
DB_PORT = 5432
DB_NAME = postgres
DB_USER = postgres
DB_PASSWORD = (your-supabase-password)
PORT = 3000
NODE_ENV = production
JWT_SECRET = (generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
GOOGLE_APPLICATION_CREDENTIALS = (your Google Cloud service account JSON)
```

**To add env vars in Vercel**:
1. After "Import Project" step, scroll to "Environment Variables"
2. Click "Add new"
3. Fill Name and Value
4. Select "Production, Preview"
5. Click "Add"
6. Repeat for all variables

### Step 4: Deploy

Click "Deploy" button. Vercel will:
1. Build backend (`npm run build` in backend folder)
2. Build frontend (Vite build)
3. Deploy both

**Deployment takes 2-5 minutes on first deploy.**

---

## ✅ Post-Deployment Verification

Once deployment completes:

```bash
# 1. Test health check (replace with your Vercel URL)
curl https://your-project.vercel.app/api/health

# 2. Test API connectivity
curl https://your-project.vercel.app/api/products

# 3. Visit frontend
Open: https://your-project.vercel.app
```

### Expected Results:
- ✓ Frontend loads
- ✓ Health check returns `{ status: "OK" }`
- ✓ Login page works
- ✓ No 503 errors (these are normal on first request - cold start)

---

## 🔧 Troubleshooting

### ❌ Build fails: "Cannot find module"
**Solution**: Re-check Environment Variables in Vercel
```bash
# Locally, test if build works:
npm run build
```

### ❌ "ECONNREFUSED" - Database connection error
**Solutions**:
1. Verify DB_HOST, DB_PORT, DB_NAME are correct
2. For Supabase: Check SSL connection settings
3. For Vercel Postgres: Get connection string from add-on

### ❌ 404 on `/api/...` routes
**Solution**: Routes might not be wired correctly. Check vercel.json routes section.

### ❌ First request takes 10+ seconds (503 error)
**Expected behavior**: Vercel Functions have "cold start" on first request. This is normal.

---

## 📝 After Successful Deploy

1. **Run database backfill** (if first time):
   ```bash
   # This creates correction-list products
   # Run locally with production DB:
   DB_HOST=db.xxxxx.supabase.co \
   DB_PORT=5432 \
   DB_NAME=postgres \
   DB_USER=postgres \
   DB_PASSWORD=xxx \
   npm run backfill:publ-correction-lists
   ```

2. **Set up custom domain** (optional):
   - Vercel dashboard → Project Settings → Domains
   - Add your domain

3. **Configure Git push deployments**:
   - Every `git push origin main` automatically re-deploys
   - Previous versions stay in Vercel for rollback

---

## 🔄 Rollback to Previous Version

If something breaks:

```bash
# In Vercel dashboard:
# Deployments tab → click previous working deployment → click "Promote to Production"
```

Or via Git:
```bash
git revert <commit-hash>
git push origin main
```

---

## 💾 Database Backups

If using Supabase:
- Automated backups included (7-day retention on free tier)
- Manual backup: Supabase dashboard → Backups → Backup Now

If using Vercel Postgres:
- Backups managed by Vercel

---

## 📞 Need Help?

- Vercel docs: https://vercel.com/docs
- Supabase docs: https://supabase.com/docs
- Project issues: Check `DEPLOYMENT.md` for detailed guide

---

## Next Steps (After Deploy Works)

- [ ] Test correction-list preview endpoint
- [ ] Test print-to-PDF function
- [ ] Verify auto-linking of correction lists
- [ ] Load test with real data
- [ ] Set up monitoring/alerts
- [ ] Migrate file uploads to external storage (S3 or Vercel Blob)
