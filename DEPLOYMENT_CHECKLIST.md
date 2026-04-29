# Deployment Checklist for CARTIS 2.0 → Vercel

Use this checklist to ensure a smooth deployment.

---

## ✅ Pre-Deployment (Local)

### Code Preparation
- [ ] All changes committed to Git
- [ ] No uncommitted files: `git status` is clean
- [ ] Latest code pushed to GitHub: `git push origin main`
- [ ] Backend builds without errors: `npm run build`
- [ ] Frontend builds without errors: `npm run build --prefix frontend`
- [ ] No TypeScript errors: `npm run typecheck --prefix backend`

### Configuration Files
- [ ] `vercel.json` exists in project root
- [ ] `.vercelignore` exists in project root
- [ ] `backend/tsconfig.json` configured correctly
- [ ] `frontend/vite.config.ts` configured correctly
- [ ] `.env` contains all necessary variables (for local testing)

### Package.json Scripts
- [ ] `package.json` has `build` script: `npm run build --prefix backend && npm run build --prefix frontend`
- [ ] `package.json` has `start` script: `npm start --prefix backend`
- [ ] Backend package.json has `start`: `node dist/index.js`

---

## ✅ Database Setup (Choose One)

### If using Supabase
- [ ] Supabase account created at https://supabase.com
- [ ] New project created
- [ ] PostgreSQL database initialized
- [ ] PostGIS extension enabled:
  ```sql
  CREATE EXTENSION IF NOT EXISTS postgis;
  ```
- [ ] Connection details documented:
  - [ ] Host: `db.xxxxx.supabase.co`
  - [ ] Port: `5432`
  - [ ] Database: `postgres`
  - [ ] User: `postgres`
  - [ ] Password: (saved securely)
- [ ] Database schema/tables created (run migrations locally)

### If using Vercel Postgres
- [ ] Vercel account set up
- [ ] Postgres add-on will be added during project setup
- [ ] Connection string ready

### If using AWS RDS / Other
- [ ] Database instance running
- [ ] Remote access enabled (Vercel IP whitelist if applicable)
- [ ] SSL certificates ready (if required)
- [ ] Connection credentials documented

---

## ✅ Credentials & Secrets

### Google Cloud Translation API
- [ ] Service account created in Google Cloud Console
- [ ] Service account has "Translate API Admin" role
- [ ] Translation API enabled in project
- [ ] Service account JSON key generated and saved
- [ ] JSON content ready to paste (full JSON string)

### JWT Secret
- [ ] Generated random 64-character hex string
- [ ] Stored securely (won't be committed to Git)
- [ ] Example: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### GitHub Repository
- [ ] Repository is public or Vercel has access
- [ ] All code is pushed to main branch
- [ ] No large files (>100MB) in repo

---

## ✅ Vercel Account Setup

- [ ] Vercel account created at https://vercel.com
- [ ] GitHub account connected to Vercel
- [ ] Vercel dashboard accessible
- [ ] Ready to create new project

---

## 🚀 Deployment Steps

### Step 1: Import Project to Vercel
- [ ] Go to https://vercel.com/new
- [ ] Click "Import Git Repository"
- [ ] Select your GitHub repository (cartis-2.0 or similar)
- [ ] Click "Import"
- [ ] Vercel detects settings (may take 1-2 minutes)

### Step 2: Configure Build Settings
- [ ] Root Directory: (leave empty - it's root)
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `frontend/dist`
- [ ] Install Command: (use default)
- [ ] Click "Continue"

### Step 3: Add Environment Variables
Use the "Environment Variables" section on this page.

Add these variables ONE BY ONE. Select "Production, Preview" for each:

- [ ] `DB_HOST`: `db.xxxxx.supabase.co` (or your DB host)
- [ ] `DB_PORT`: `5432`
- [ ] `DB_NAME`: `postgres` (or your DB name)
- [ ] `DB_USER`: `postgres` (or your DB user)
- [ ] `DB_PASSWORD`: (your password - Vercel will encrypt)
- [ ] `PORT`: `3000`
- [ ] `NODE_ENV`: `production`
- [ ] `JWT_SECRET`: (your generated secret)
- [ ] `GOOGLE_APPLICATION_CREDENTIALS`: (full Google Cloud JSON)

### Step 4: Deploy
- [ ] Click the "Deploy" button
- [ ] Watch deployment progress (takes 2-5 minutes)
- [ ] Wait for "Ready" status (green checkmark)
- [ ] Note your Vercel URL (e.g., `https://cartis-2.0.vercel.app`)

---

## ✅ Post-Deployment Verification

### Immediate Checks (First 5 minutes)
- [ ] Deployment shows "Ready" (green)
- [ ] Vercel URL is accessible
- [ ] No "Function error" messages in logs

### Frontend Verification
- [ ] Visit `https://your-vercel-url.app`
- [ ] Page loads (no 404 or 500 errors)
- [ ] Login form displays
- [ ] No console errors (check browser DevTools)

### Backend API Checks

Run these from your terminal or browser:

```bash
# Health check
curl https://your-vercel-url.app/api/health
# Expected: {"status":"OK","timestamp":"..."}
```

- [ ] Health check returns OK
- [ ] No 503 errors (cold start is normal, wait 5-10 sec)
- [ ] CORS headers present (check response headers)

### Database Connectivity
- [ ] Check Vercel logs: Deployments → Logs → Runtime Logs
- [ ] Look for "CARTIS 2.0 Backend running on..."
- [ ] No "ECONNREFUSED" or "ENOTFOUND" errors
- [ ] If error: Verify DB_HOST and credentials in Vercel

### API Route Testing
- [ ] Try login route: `POST https://your-vercel-url.app/api/auth/login`
- [ ] Try get products: `GET https://your-vercel-url.app/api/products`
- [ ] Check for proper responses (not 500 errors)

---

## ✅ Feature Validation

### Correction Lists (Verbeterlijst)
- [ ] Create a new task with paper chart
- [ ] Verify correction-list product auto-linked
- [ ] Test preview endpoint: `GET /api/product-versions/{id}/corrections-list`
- [ ] HTML renders with metadata table header
- [ ] Language toggle works (NL/EN)
- [ ] Print button opens preview

### Print Function
- [ ] Click print button in correction-list preview
- [ ] PDF preview window opens
- [ ] A4 margins are 0.5cm
- [ ] Page layout correct
- [ ] Print to PDF works from browser

### Database Operations
- [ ] Create notification works
- [ ] Products save correctly
- [ ] Queries return expected data
- [ ] No SQL errors in logs

---

## ✅ Post-Deployment (After Verification)

### Database Backups
- [ ] If Supabase: Enable automatic backups
- [ ] If Vercel Postgres: Verify backups are configured
- [ ] Document backup restore procedure

### Monitoring Setup
- [ ] Enable Vercel Analytics (if desired)
- [ ] Set up error notifications
- [ ] Configure log retention

### Git Workflow
- [ ] Verify Git push to `main` triggers auto-deploy
- [ ] Test deploying a small change
- [ ] Confirm deployment appears in Vercel dashboard

### Custom Domain (Optional)
- [ ] If needed: Add custom domain in Vercel Settings → Domains
- [ ] Configure DNS records
- [ ] Test HTTPS/SSL certificate

### Database Backfill (If First Deploy)
```bash
# Run backfill script against production DB
DB_HOST=db.xxxxx.supabase.co \
DB_PORT=5432 \
DB_NAME=postgres \
DB_USER=postgres \
DB_PASSWORD=xxx \
npm run backfill:publ-correction-lists
```

- [ ] Backfill completes without errors
- [ ] Verify correction-list products created in DB

---

## ❌ Troubleshooting

### If Deployment Fails at Build Stage

**Error: "Cannot find module"**
- [ ] Check `npm run build` works locally
- [ ] Verify all dependencies in package.json
- [ ] Check tsconfig.json is correct

**Error: "TypeScript error"**
- [ ] Run `npm run typecheck` locally
- [ ] Fix TypeScript errors
- [ ] Re-deploy

**Error: "Build command not found"**
- [ ] Verify build script in package.json exists
- [ ] Check spelling in vercel.json

### If Deployment Succeeds but API Returns 500

**Error: "ECONNREFUSED" or "ENOTFOUND"**
- [ ] Verify DB_HOST, DB_PORT, DB_USER in Vercel env
- [ ] Check password doesn't have special chars that need escaping
- [ ] For Supabase: Verify SSL connection settings
- [ ] Test local connection with same credentials

**Error: "JWT_SECRET undefined"**
- [ ] Check JWT_SECRET is added to Vercel env vars
- [ ] Verify exact spelling matches code
- [ ] Redeploy after adding variables

**Error: "Google Cloud API error"**
- [ ] Verify GOOGLE_APPLICATION_CREDENTIALS is valid JSON
- [ ] Check Translation API is enabled in Google Cloud
- [ ] Verify service account has correct permissions

### If Frontend Doesn't Load

**Error: 404 on frontend**
- [ ] Check `frontend/dist/index.html` exists (build locally)
- [ ] Verify Output Directory in vercel.json is correct
- [ ] Check routes in vercel.json

**Error: CORS errors in browser console**
- [ ] Verify CORS middleware in backend: `app.use(cors())`
- [ ] Check frontend API calls use correct URL
- [ ] Test API from Postman (should work without CORS)

---

## 📊 Performance Checklist (After All Tests Pass)

- [ ] First page load time < 3 seconds
- [ ] API response time < 500ms
- [ ] Database queries < 200ms
- [ ] No memory leaks in logs
- [ ] Function duration < 10 seconds

---

## 🔒 Security Checklist

- [ ] .env file not committed to Git
- [ ] All secrets encrypted in Vercel
- [ ] Database user is read-only (if possible)
- [ ] JWT_SECRET is cryptographically random
- [ ] HTTPS enabled (automatic with Vercel)
- [ ] CORS allows only necessary origins
- [ ] API keys (Google Cloud) not exposed in code

---

## 📞 Rollback Procedure

If something critical breaks after deploy:

### Quick Rollback (via Git)
```bash
git log --oneline -5  # Find problematic commit
git revert <commit-hash>
git push origin main
# Vercel auto-deploys within 1-2 minutes
```

### Via Vercel Dashboard
1. Go to Deployments tab
2. Find previous working deployment
3. Click "..." menu → "Promote to Production"
4. Confirm

---

## ✅ Final Sign-Off

- [ ] All verification checks passed
- [ ] Team notified of deployment
- [ ] Backup procedure documented
- [ ] Rollback procedure tested
- [ ] Users directed to new URL
- [ ] Old deployment deprecated (if applicable)

**Deployment completed on**: ____________

**Deployed by**: ____________

**Notes**: ____________________________________________________

---

**Next**: Monitor production for 24 hours for any issues.
