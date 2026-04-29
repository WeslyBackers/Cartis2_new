# Supabase Import - Quick Guide

Quick reference for importing CARTIS database to Supabase.

## Prerequisites

- Supabase account and project created
- Database host/port/name/user (from Supabase dashboard)
- Database password (set during project creation)
- For PowerShell method: PostgreSQL client tools (`psql`) installed
- For Node.js method: `pg` package installed (`npm install pg`)

## Import Methods

### Method 1: PowerShell Script (Recommended for Windows)
```powershell
.\import-to-supabase.ps1
```
✅ Uses native psql for reliable imports  
✅ Interactive prompts for credentials  
✅ Detailed progress reporting  

### Method 2: Batch File (Windows)
```batch
.\import-to-supabase.bat
```
or double-click the file in Explorer

✅ Simple click-and-run  
✅ Calls PowerShell script automatically  

### Method 3: Node.js Script
```bash
npm run import:supabase
```
or
```bash
node import-to-supabase.js
```
✅ Cross-platform compatible  
✅ No psql required  
✅ Pure JavaScript solution  

### Method 4: Manual via Supabase Dashboard
1. Go to Supabase SQL Editor
2. Copy/paste each SQL file in order:
   - `backend/database/schema.sql`
   - Then run the remaining migrations from `backend/database/` in the same order as in the import scripts
3. Run each file

✅ GUI-based  
✅ No local tools required  
✅ Visual feedback  

## After Import

### 1. Update Backend .env File

```env
DB_HOST=db.your-project-ref.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-supabase-password
DB_SSL=true
```

Alternative (Supabase session pooler):

```env
DB_HOST=aws-0-your-region.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.your-project-ref
DB_PASSWORD=your-supabase-password
DB_SSL=true
```

### 2. Test Connection

```bash
cd backend
npm run dev
```

### 3. Login

Default credentials:
- Email: `admin@cartis.be`
- Password: `admin123`

⚠️ **Change the default password immediately!**

## What Gets Imported

- ✅ Base schema + all current migration SQL files from `backend/database/`
- ✅ All relationships and constraints
- ✅ Performance indices
- ✅ Default production lines (4)
- ✅ Default admin users (2)
- ✅ Default test data

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `psql: command not found` | Install PostgreSQL client tools |
| Connection timeout | Verify host/port and check Supabase network restrictions |
| `pg` module not found | Run `npm install pg` |
| Permission denied | Verify database password |
| SSL errors | Set `DB_SSL=true` and use SSL-enabled endpoint |

## Need Help?

See [SUPABASE_IMPORT.md](SUPABASE_IMPORT.md) for detailed documentation.

---

**Quick Start**: Run `.\import-to-supabase.ps1`, enter your DB host/port/name/user/password, and keep SSL enabled.
