# CARTIS Workflow: Deploy to Vercel + Connect Migrated Supabase Database

This workflow is tailored for this repository and combines database migration + Vercel deployment.

## 1. Create the Supabase project

1. Create a new Supabase project.
2. Open **Project Settings -> Database** and note:
   - Host
   - Port
   - Database name
   - User
   - Password
3. In Supabase SQL editor, ensure PostGIS is enabled if your geometry features are used:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

## 2. Migrate existing Postgres data into Supabase

Use a full logical dump and restore.

### 2.1 Export from source Postgres

```bash
pg_dump --no-owner --no-privileges --format=custom --file=cartis.dump "postgresql://SOURCE_USER:SOURCE_PASS@SOURCE_HOST:5432/SOURCE_DB"
```

### 2.2 Restore into Supabase

```bash
pg_restore --no-owner --no-privileges --clean --if-exists --dbname="postgresql://postgres:SUPABASE_PASS@db.YOUR_REF.supabase.co:5432/postgres?sslmode=require" cartis.dump
```

Notes:
- If role/permission errors occur, keep using the `--no-owner --no-privileges` flags.
- If extension errors occur, create extensions manually in Supabase SQL editor.

## 3. Run repo-specific SQL/backfills

After base restore, run CARTIS-specific scripts as needed.

Recommended options in this repo:

1. PowerShell helper:

```powershell
.\import-to-supabase.ps1
```

2. Node helper:

```bash
npm run import:supabase
```

3. Additional backfills (example):

```bash
npm run backfill:publ-correction-lists
```

## 4. Validate migrated data

Before deploying:

1. Compare table counts between old Postgres and Supabase for critical tables:
   - users
   - notifications
   - tasks
   - product_versions
2. Test at least one spatial query to verify PostGIS behavior.
3. Verify login users exist and can authenticate.

## 5. Prepare Vercel project

1. Push the repository to GitHub.
2. Import the repo in Vercel.
3. Keep repository `vercel.json` configuration.

## 6. Add Vercel environment variables

Set these in Vercel for **Production** and **Preview** (as applicable):

### Database
- `DB_HOST`
- `DB_PORT` (usually `5432`)
- `DB_NAME` (usually `postgres`)
- `DB_USER`
- `DB_PASSWORD`
- `DB_SSL` (`true`)

### App
- `NODE_ENV` (`production`)
- `PORT` (`3000`)
- `JWT_SECRET` (generate a strong random value)

### Optional/Service
- `GOOGLE_TRANSLATE_API_KEY` (if translation routes are used)
- `GOOGLE_APPLICATION_CREDENTIALS` (if your Google client setup requires full JSON credentials)

## 7. Confirm API wiring

In this repo:

1. Frontend calls relative `/api` endpoints.
2. Backend serves routes under `/api/*`.
3. Vercel routes map `/api/*` to backend function and all other paths to frontend static app.

## 8. Deploy on Vercel

1. Trigger first deployment from Vercel dashboard or by pushing to your production branch.
2. Watch build logs until deployment completes.

## 9. Smoke test production

Run at minimum:

1. `GET /api/health`
2. Login flow
3. Notifications and tasks pages (DB-backed reads)
4. Any route requiring geometric data

## 10. Production caveats (important)

1. Vercel filesystem is ephemeral.
   - Local `/uploads` is not persistent.
   - Use Supabase Storage, S3, or Vercel Blob for durable file uploads.
2. Keep DB SSL enabled for Supabase.
3. Use conservative DB pooling settings for serverless workloads.

## 11. Safe rollout checklist

1. Use preview deployments for PR validation.
2. Keep separate preview/prod env values.
3. Take a Supabase backup/snapshot before major schema changes.
4. Keep rollback path ready via previous Vercel deployment and database restore point.

---

## Quick command recap

```bash
# from repo root
npm install
npm run build
```

```powershell
# optional helper import path in this repo
.\import-to-supabase.ps1
```

```bash
# optional helper import path in this repo
npm run import:supabase
```
