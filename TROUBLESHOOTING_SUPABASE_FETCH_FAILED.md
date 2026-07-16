# Troubleshooting: "fetch failed" Supabase Storage Error

## Current Error
```
Fout bij uploaden bestand: Failed to access Supabase storage: fetch failed
```

## What This Means
The Vercel server **cannot connect** to Supabase's API. This is a network connectivity issue.

## Diagnostic Steps

### Step 1: Verify Environment Variables Are Set
Visit: https://cartis2-new.vercel.app/api/check-env

**Expected**:
```json
{
  "status": "✅ All required variables configured",
  "requiredVariables": {
    "SUPABASE_URL": "✅ Set",
    "SUPABASE_SECRET_KEY": "✅ Set"
  }
}
```

**If you see "❌ Missing"**: Go to Vercel dashboard and set the variables (see VERCEL_ENV_SETUP_INSTRUCTIONS.md)

### Step 2: Test Supabase Connection
Visit: https://cartis2-new.vercel.app/api/test-supabase

**Expected Success**:
```json
{
  "test": {
    "status": "✅ Success"
  },
  "storage": {
    "bucketsFound": 1,
    "bucketNames": ["attachments"],
    "attachmentsBucket": {
      "name": "attachments",
      "public": false
    }
  }
}
```

### Step 3: Check Vercel Deployment Logs

1. Go to: https://vercel.com/weslybackers/cartis2-new
2. Click the latest deployment
3. Click **Runtime Logs**
4. Look for `[Supabase]` and `[saveFile]` log entries

**Look for these specific logs**:
```
[Supabase] Running on Vercel, using default fetch
[Supabase] Initializing client...
[Supabase] URL configured: true
[Supabase] Key configured: true
[Supabase] Client initialized successfully
```

If you see errors here, note the exact error message.

## Common Causes & Solutions

### Cause 1: Environment Variables Not Set in Vercel ⚠️

**Symptoms**: 
- `/api/check-env` shows "❌ Missing"
- Error: "SUPABASE_URL and SUPABASE_SECRET_KEY must be set"

**Solution**:
1. Go to: https://vercel.com/weslybackers/cartis2-new/settings/environment-variables
2. Click **"Add New"** for each variable:
   - `SUPABASE_URL` = `https://xnouiglwiyhvccbejvin.supabase.co`
   - `SUPABASE_SECRET_KEY` = (your service_role key from backend/.env)
3. Select **Production + Preview + Development**
4. Click **Save**
5. Go to deployments and click **Redeploy** on the latest one

### Cause 2: Wrong Supabase Key

**Symptoms**:
- Variables show as "✅ Set"
- Error: "Invalid API key" or "401 Unauthorized"

**Solution**:
Make sure you're using the **service_role** key, not the anon key:
- ✅ Correct: Starts with `eyJ...` and is ~200+ characters long
- ❌ Wrong: The shorter anon key

Find the correct key in:
1. Supabase dashboard → Project Settings → API
2. Copy the **service_role** key (click "Reveal" to show it)

### Cause 3: Supabase Project Is Paused

**Symptoms**:
- Connection timeout or "Project paused" error

**Solution**:
1. Go to: https://supabase.com/dashboard/project/xnouiglwiyhvccbejvin
2. Check if project shows "Paused"
3. If paused, click **Restore** button

### Cause 4: Vercel Region Cannot Reach Supabase

**Symptoms**:
- "fetch failed" or "ETIMEDOUT" errors
- `/api/test-supabase` times out

**Solution**:
This is rare but can happen with region-specific routing issues.
1. Check Supabase status: https://status.supabase.com
2. Try redeploying to a different Vercel region

### Cause 5: Supabase Storage Not Enabled

**Symptoms**:
- Error: "Storage API not enabled"

**Solution**:
1. Go to: https://supabase.com/dashboard/project/xnouiglwiyhvccbejvin/storage/buckets
2. Verify Storage is enabled for your project
3. Check billing/quota limits

## Quick Fix Checklist

Run through this checklist:

- [ ] Environment variables are set in Vercel dashboard
- [ ] Used **service_role** key (not anon key)
- [ ] Redeployed after setting variables
- [ ] `/api/check-env` shows all ✅
- [ ] `/api/test-supabase` returns success
- [ ] Supabase project is not paused
- [ ] "attachments" bucket exists in Supabase Storage
- [ ] Checked Vercel runtime logs for detailed errors

## Still Not Working?

### Get Detailed Error Information

1. **Try uploading a file** (to trigger the error)

2. **Immediately check Vercel Runtime Logs**:
   - Go to: https://vercel.com/weslybackers/cartis2-new
   - Click latest deployment → Runtime Logs
   - Look for the most recent error

3. **Look for these specific patterns**:

   **Pattern: "fetch failed"**
   ```
   [saveFile] Network/connection error: TypeError: fetch failed
   ```
   → Network connectivity issue between Vercel and Supabase

   **Pattern: "Invalid API key"**
   ```
   [saveFile] Failed to list buckets: Invalid API key
   ```
   → Wrong SUPABASE_SECRET_KEY value

   **Pattern: "Project not found"**
   ```
   [saveFile] Failed to list buckets: Project not found
   ```
   → Wrong SUPABASE_URL value

   **Pattern: timeout**
   ```
   [saveFile] Network/connection error: AbortError: The operation was aborted
   ```
   → Timeout - check Supabase status

4. **Share the exact error** from logs for further diagnosis

### Manual Test from Vercel Console

You can also test the connection from Vercel's serverless function directly:

1. Create a simple test file: `api/storage-test.ts`
2. Deploy it
3. Visit the endpoint
4. Check if it can reach Supabase

## Alternative: Use Vercel Blob Storage

If Supabase Storage continues to have connection issues, you can switch to Vercel Blob:

1. Enable Vercel Blob in your project
2. Update `storage.service.ts` to use Vercel Blob instead
3. No external API calls needed (Vercel → Vercel communication)

See: https://vercel.com/docs/storage/vercel-blob

## Environment Variable Format

Double-check your variables are formatted exactly like this:

```
SUPABASE_URL=https://xnouiglwiyhvccbejvin.supabase.co
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhub3VpZ2x3aXlodmNjYmVqdmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk4ODU3MCwiZXhwIjoyMDk4NTY0NTcwfQ.w4DIMTf7NJY2UUyic8Dh-Kqy0QbDjssG74PL86t1iV4
```

**Common mistakes**:
- ❌ Extra spaces before/after the value
- ❌ Quotes around the value (don't use quotes in Vercel dashboard)
- ❌ Newlines or line breaks in the value
- ❌ Wrong key (anon instead of service_role)

## Next Steps After Fix

Once `/api/test-supabase` shows success:

1. ✅ Try uploading a file again
2. ✅ Check Vercel logs show: `[saveFile] Successfully uploaded to Supabase`
3. ✅ Verify file appears in Supabase Storage dashboard
4. ✅ Test downloading the file

## Contact Points

- **Supabase Status**: https://status.supabase.com
- **Vercel Status**: https://www.vercel-status.com
- **Supabase Support**: https://supabase.com/dashboard/support
- **Vercel Support**: https://vercel.com/help
