# Vercel Attachment Upload Configuration

## Problem
You're seeing this error on Vercel:
```
Fout bij uploaden bestand: ENOENT: no such file or directory, mkdir '/var/task/backend/uploads'
```

This happens because:
1. **Vercel's filesystem is read-only** - you cannot create directories or save files to disk
2. **Environment variables must be set in Vercel dashboard** - `.env` files don't work on Vercel
3. **Supabase Storage is required** for file uploads in production

## Solution: Configure Supabase Storage on Vercel

### Step 1: Set Environment Variables in Vercel

1. Go to your Vercel project dashboard: https://vercel.com/weslybackers/cartis2-new
2. Click **Settings** → **Environment Variables**
3. Add the following variables:

| Name | Value | Environment |
|------|-------|-------------|
| `SUPABASE_URL` | `https://xnouiglwiyhvccbejvin.supabase.co` | Production, Preview, Development |
| `SUPABASE_SECRET_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhub3VpZ2x3aXlodmNjYmVqdmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk4ODU3MCwiZXhwIjoyMDk4NTY0NTcwfQ.w4DIMTf7NJY2UUyic8Dh-Kqy0QbDjssG74PL86t1iV4` | Production, Preview, Development |

**Important**: These values are already in your `backend/.env` file. Copy them from there.

### Step 2: Verify Supabase Storage Bucket

The "attachments" bucket should already exist. To verify:

```bash
node setup-supabase-storage.js
```

Expected output:
```
✅ Bucket "attachments" already exists
   Public: false
   File size limit: 10 MB
```

### Step 3: Redeploy to Vercel

After setting environment variables, you need to redeploy:

```bash
# Option 1: Push to Git (triggers auto-deploy)
git add .
git commit -m "Fix attachment uploads for Vercel"
git push

# Option 2: Use Vercel CLI
vercel --prod
```

### Step 4: Test

1. Go to your Vercel deployment URL
2. Navigate to Notifications → "+ Nieuwe Melding"
3. Try importing an email with attachments
4. Verify files upload successfully

## Verification

### Check Vercel Logs
1. Go to Vercel dashboard → Your deployment → **Runtime Logs**
2. Look for these log messages:
   ```
   [saveFile] Using Supabase storage, bucket: attachments
   [saveFile] Uploading to Supabase: notifications/123/filename.pdf
   [saveFile] Successfully uploaded to Supabase: notifications/123/filename.pdf
   ```

### Check Supabase Storage
1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/xnouiglwiyhvccbejvin
2. Click **Storage** in the sidebar
3. Click the **attachments** bucket
4. You should see uploaded files organized by folder (notifications/123/, product-versions/456/, etc.)

## Troubleshooting

### Error: "File uploads require Supabase Storage in production"
**Cause**: Environment variables are not set in Vercel
**Solution**: Follow Step 1 above to add `SUPABASE_URL` and `SUPABASE_SECRET_KEY`

### Error: "Failed to access Supabase storage"
**Cause**: Invalid Supabase credentials
**Solution**: 
1. Verify the credentials in your Supabase dashboard
2. Make sure you're using the **service_role** key (not the anon key)
3. Update the environment variables in Vercel

### Error: "Supabase upload failed"
**Cause**: Could be various issues (bucket permissions, file size, network)
**Solution**: 
1. Check Vercel runtime logs for detailed error message
2. Verify bucket exists in Supabase dashboard
3. Check file size is under 10MB

### Uploads work locally but not on Vercel
**Cause**: Local development uses disk storage, Vercel requires Supabase
**Solution**: 
1. Ensure Supabase environment variables are set on Vercel
2. Redeploy after setting variables

## Environment Variables Reference

### Required for Production (Vercel)
- ✅ `SUPABASE_URL` - Supabase project URL
- ✅ `SUPABASE_SECRET_KEY` - Supabase service role key (not anon key!)
- ✅ `DATABASE_URL` - PostgreSQL connection string
- ✅ `JWT_SECRET` - JWT signing secret

### Optional
- `MAX_FILE_SIZE` - Default: 10485760 (10MB)
- `UPLOAD_PATH` - Only used for local development, ignored on Vercel

## How It Works

### Development (Local)
1. Checks if Supabase credentials are configured
2. If yes → Uses Supabase Storage
3. If no → Falls back to local `backend/uploads/` directory

### Production (Vercel)
1. **Requires** Supabase credentials (no fallback)
2. Uses Supabase Storage exclusively
3. **Cannot** use local disk (filesystem is read-only)

### File Path Examples
- **Supabase**: `notifications/123/document-1234567890-987654321.pdf`
- **Local**: `D:\Programming\Webapps\Cartis_new\backend\uploads\document-1234567890-987654321.pdf`

## Security Notes
- The "attachments" bucket is **private** (not publicly accessible)
- Files are only accessible via authenticated API endpoints
- Service role key has full access - keep it secret!
- Do not commit `.env` files to Git

## Next Steps After Configuration
1. ✅ Set environment variables in Vercel dashboard
2. ✅ Redeploy the application
3. ✅ Test attachment uploads
4. ✅ Verify files appear in Supabase Storage
5. ✅ Check Vercel logs for any errors

## Need Help?
- **Vercel Docs**: https://vercel.com/docs/environment-variables
- **Supabase Storage**: https://supabase.com/docs/guides/storage
- **Error Logs**: Check Vercel dashboard → Runtime Logs
