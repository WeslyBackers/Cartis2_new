# CARTIS 2.0 - Supabase Database Import Guide

This guide explains how to import your CARTIS database schema and data into Supabase.

## Prerequisites

Before starting, make sure you have:

1. **A Supabase Account**: Sign up at [https://app.supabase.com](https://app.supabase.com)
2. **A Supabase Project**: Create a new project in your Supabase dashboard
3. **Project Credentials**: Note your project's:
   - Database host/port/name/user (found in project settings)
   - Database Password (set during project creation)

## Method 1: Using PowerShell Script (Recommended for Windows)

### Requirements
- PostgreSQL client tools (psql) installed
- PowerShell (included with Windows)

### Installation of psql
If you don't have `psql` installed:

```powershell
# Using Chocolatey
choco install postgresql

# Or using Scoop
scoop install postgresql

# Or download from: https://www.postgresql.org/download/windows/
```

### Run the Import Script

```powershell
.\import-to-supabase.ps1
```

You'll be prompted for:
- **Database host/port/name/user**: Use direct DB endpoint or pooler endpoint
- **Database Password**: The password you set when creating the project
- **SSL on/off**: Usually `yes` for Supabase

## Method 2: Using Node.js Script

### Requirements
- Node.js installed
- npm packages: `pg` (PostgreSQL client)

### Install Dependencies

```bash
npm install pg
```

### Run the Import Script

```bash
node import-to-supabase.js
```

You'll be prompted for the same information as the PowerShell method.

## Method 3: Manual Import via Supabase SQL Editor

If you prefer a GUI approach:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Execute the following SQL files in order:

   a. Copy and paste `backend/database/schema.sql`
   b. Copy and paste the remaining migration files from `backend/database/` in the same order used by the import scripts

4. Run each query in sequence

## Method 4: Using Supabase CLI

### Install Supabase CLI

```bash
# Preferred (project-local CLI)
npm install --save-dev supabase

# Using Homebrew (Mac)
brew install supabase/tap/supabase

# Using Scoop (Windows)
scoop install supabase
```

> Note: `npm install -g supabase` is no longer supported by Supabase CLI.
> If Scoop is unavailable on Windows, use the local npm dev dependency and run via `npx`.

Verify the CLI install:

```bash
npx supabase --version
```

### Link to Your Project

```bash
npx supabase link --project-ref your-project-ref
```

### Run Migrations

```bash
# Copy SQL files to migrations folder (same order as import scripts)
mkdir -p supabase/migrations
cp backend/database/schema.sql supabase/migrations/20240101000000_initial_schema.sql
cp backend/database/add-product-version-attachments.sql supabase/migrations/20240101000001_add_product_version_attachments.sql
cp backend/database/add-opmerkingen.sql supabase/migrations/20240101000002_add_opmerkingen.sql
cp backend/database/add-notification-comments.sql supabase/migrations/20240101000003_add_comments.sql
cp backend/database/add-notification-coordinates.sql supabase/migrations/20240101000004_add_coordinates.sql
cp backend/database/add-geometry-to-coordinates.sql supabase/migrations/20240101000005_add_geometry_to_coordinates.sql
cp backend/database/add-task-comments-and-workflow.sql supabase/migrations/20240101000006_add_task_comments_workflow.sql
cp backend/database/add-task-info-requests.sql supabase/migrations/20240101000007_add_task_info_requests.sql
cp backend/database/add-task-production-line-status.sql supabase/migrations/20240101000008_add_task_production_line_status.sql
cp backend/database/add-wait-for-zk-to-task-production-line-status.sql supabase/migrations/20240101000009_add_wait_for_zk.sql
cp backend/database/add-task-articles.sql supabase/migrations/20240101000010_add_task_articles.sql
cp backend/database/add-article-titles.sql supabase/migrations/20240101000011_add_article_titles.sql
cp backend/database/add-kml-coverages.sql supabase/migrations/20240101000012_add_kml_coverages.sql
cp backend/database/add-notification-zones.sql supabase/migrations/20240101000013_add_notification_zones.sql
cp backend/database/add-hpd-projects.sql supabase/migrations/20240101000014_add_hpd_projects.sql
cp backend/database/enable-postgis.sql supabase/migrations/20240101000015_enable_postgis.sql
cp backend/database/remove-status-from-notifications.sql supabase/migrations/20240101000016_remove_notification_status.sql
cp backend/database/update-task-product-default-status.sql supabase/migrations/20240101000017_update_task_product_default_status.sql
cp backend/database/drop-problematic-indexes.sql supabase/migrations/20240101000018_drop_problematic_indexes.sql
cp backend/database/ensure-test-user.sql supabase/migrations/20240101000019_ensure_test_user.sql

# Push migrations
npx supabase db push
```

## What Gets Imported

The import process creates:

### Tables
- `production_lines` - Production line definitions
- `users` - User accounts and authentication
- `user_production_line_rights` - User permissions
- `products` - Products (charts, publications)
- `notifications` - Incoming notifications
- `notifications_products` - Links between notifications and products
- `notification_decisions` - Decision tracking per production line
- `notification_comments` - Multiple comments per notification
- `notification_coordinates` - Geographic coordinates for notifications
- `attachments` - File attachments
- `tasks` - Task management
- `task_notifications` - Links between tasks and notifications
- `related_tasks` - Task relationships
- `product_versions` - Product version tracking
- `task_products` - Task status per product
- `activity_log` - Audit trail
- `task_articles`, `task_comments`, `task_workflow`, `task_info_requests` - Extended task workflow support
- `task_production_line_status` - Per-production-line task status tracking
- `notification_zones` - Zone detection results per notification
- `kml_files`, `kml_coverages` - Imported KML metadata and geometries
- `hpd_projects` - HPD project tracking

### Default Data
- 4 production lines (ZK, IENC, Pilot ENC, Publicaties)
- 2 admin users:
  - Email: `admin@cartis.be`, Password: `admin123`
  - Email: `admin@cartis.com`, Password: `admin123`

### Indices
Multiple indices for improved query performance on frequently accessed columns.

## Post-Import Configuration

After successfully importing the database:

### 1. Update Environment Variables

Create or update your `.env` file in the `backend` folder:

```env
# Supabase Database Connection
DB_HOST=db.your-project-ref.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-database-password
DB_SSL=true

# Other settings
JWT_SECRET=your-jwt-secret-key
PORT=3000
```

For Supabase Session Pooler (runtime app connection), use:

```env
DB_HOST=aws-0-your-region.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.your-project-ref
DB_PASSWORD=your-database-password
DB_SSL=true
```

### 2. Test the Connection

Run the backend server:

```bash
cd backend
npm run dev
```

The server should connect successfully to your Supabase database.

### 3. Update Frontend Configuration (if needed)

If your frontend has any direct database connections or Supabase client configuration, update those as well.

### 4. Enable Row Level Security (RLS) - Optional but Recommended

Supabase enables Row Level Security by default. You may want to add policies:

```sql
-- Example: Allow authenticated users to read all production lines
ALTER TABLE production_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read production lines"
ON production_lines
FOR SELECT
TO authenticated
USING (true);

-- Add more policies as needed for your security requirements
```

## Troubleshooting

### Connection Timeout
- Check if your IP is allowed in Supabase Dashboard → Settings → Database → Connection Pooling
- Verify your database password is correct

### SSL Certificate Errors
- Make sure your PostgreSQL client supports SSL connections
- For Node.js, ensure `ssl: { rejectUnauthorized: false }` is set
- Set `DB_SSL=true` in backend environment configuration

### Permission Denied Errors
- Verify you're using the correct database password
- Check that you're connecting to the right project

### Import Failures
- If a table already exists, you may need to drop it first
- Check the Supabase SQL Editor for detailed error messages
- Verify all SQL files are present in `backend/database/` folder

## Backup and Restore

### Creating Backups
Supabase provides automatic daily backups. You can also:

```bash
# Using pg_dump
pg_dump "postgresql://postgres:password@db.your-ref.supabase.co:5432/postgres" > backup.sql
```

### Restoring from Backup
```bash
psql "postgresql://postgres:password@db.your-ref.supabase.co:5432/postgres" < backup.sql
```

## Security Recommendations

1. **Change Default Passwords**: Update the admin user passwords immediately after import
2. **Use Environment Variables**: Never commit database credentials to version control
3. **Enable RLS**: Implement Row Level Security policies for production
4. **Limit API Keys**: Use service role keys only in secure server environments
5. **Monitor Access**: Review the Supabase Dashboard logs regularly

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [CARTIS Project Documentation](./PROJECT_STATUS.md)

## Support

If you encounter issues:
1. Check the error messages in the terminal output
2. Review the Supabase Dashboard → Logs
3. Verify all prerequisites are met
4. Ensure network connectivity to Supabase servers

---

**Last Updated**: April 2026  
**CARTIS Version**: 2.0
