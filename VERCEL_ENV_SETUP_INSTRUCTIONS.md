# Vercel Environment Variables Setup - URGENT

## ⚠️ Current Issue
You're getting: `ENOENT: no such file or directory, mkdir '/var/task/backend/uploads'`

**Root Cause**: Supabase environment variables are **NOT SET** in Vercel dashboard.

## 🚨 IMMEDIATE ACTION REQUIRED

### Step 1: Set Environment Variables in Vercel Dashboard

1. **Go to Vercel Dashboard**: https://vercel.com/weslybackers/cartis2-new/settings/environment-variables

2. **Add these 4 REQUIRED variables**:

   Click **"Add New"** for each:

   | Variable Name | Value (copy from backend/.env) |
   |--------------|-------------------------------|
   | `SUPABASE_URL` | `https://xnouiglwiyhvccbejvin.supabase.co` |
   | `SUPABASE_SECRET_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhub3VpZ2x3aXlodmNjYmVqdmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk4ODU3MCwiZXhwIjoyMDk4NTY0NTcwfQ.w4DIMTf7NJY2UUyic8Dh-Kqy0QbDjssG74PL86t1iV4` |
   | `DATABASE_URL` | `postgresql://postgres.xnouiglwiyhvccbejvin:WesBac301078*@aws-0-eu-west-1.pooler.supabase.com:6543/postgres` |
   | `JWT_SECRET` | `d8a4d50b7eb558f5015d33da9aae8f7140055ec6baaf82a35436f902acac38fd` |
   | `MAX_FILE_SIZE` | `52428800` (50 MB - for CAD/GIS files) |

3. **For each variable, select**: 
   - ✅ Production
   - ✅ Preview  
   - ✅ Development

4. **Click "Save"**

### Step 2: Trigger Redeployment

After setting variables, you MUST redeploy:

**Option A: Redeploy via Dashboard**
1. Go to: https://vercel.com/weslybackers/cartis2-new
2. Click the latest deployment
3. Click the ⋮ menu → **Redeploy**
4. Select **"Redeploy with existing Build Cache"**

**Option B: Push a New Commit**
```bash
# Make a small change to trigger rebuild
echo "# Trigger rebuild" >> README.md
git add README.md
git commit -m "Trigger Vercel rebuild with env vars"
git push
```

### Step 3: Verify Configuration

Once redeployed, check this endpoint:
```
https://cartis2-new.vercel.app/api/check-env
```

**Expected Response**:
```json
{
  "status": "✅ All required variables configured",
  "requiredVariables": {
    "SUPABASE_URL": "✅ Set",
    "SUPABASE_SECRET_KEY": "✅ Set",
    "DATABASE_URL": "✅ Set",
    "JWT_SECRET": "✅ Set"
  }
}
```

### Step 4: Test File Upload

1. Go to your Vercel URL
2. Create a new notification
3. Upload an attachment
4. Should work without ENOENT error

## 🔍 Verify in Vercel Logs

After upload attempt, check Runtime Logs:
- Go to: https://vercel.com/weslybackers/cartis2-new
- Click latest deployment → **Runtime Logs**
- Filter by "saveFile"

**Should see**:
```
[saveFile] Using Supabase storage, bucket: attachments
[saveFile] Uploading to Supabase: notifications/123/file.pdf
[saveFile] Successfully uploaded to Supabase
```

## ❌ Common Mistakes

1. **Not redeploying after setting variables** 
   - Variables only apply to NEW deployments
   - Must redeploy or push new commit

2. **Setting variables only for Production**
   - Need to set for Production, Preview, AND Development
   - All three checkboxes must be checked

3. **Using anon key instead of service_role key**
   - Must use the **service_role** key for SUPABASE_SECRET_KEY
   - This is the longer key that starts with "eyJ..."

4. **Typos in variable names**
   - Must match exactly: `SUPABASE_URL` (not `SUPABASE_API_URL`)
   - Variable names are case-sensitive

## 🆘 Still Not Working?

### Check Environment Variables Are Actually Set
```
https://cartis2-new.vercel.app/api/check-env
```

If it shows "❌ Missing", the variables weren't saved or deployment didn't pick them up.

### Check Vercel Build Logs
1. Go to deployment
2. Click **"Building"** tab
3. Look for errors during build

### Check Runtime Logs for Actual Error
1. Try uploading a file
2. Immediately check Runtime Logs
3. Look for the full error stack trace

## 📋 Quick Checklist

- [ ] Set `SUPABASE_URL` in Vercel dashboard
- [ ] Set `SUPABASE_SECRET_KEY` in Vercel dashboard  
- [ ] Set `DATABASE_URL` in Vercel dashboard
- [ ] Set `JWT_SECRET` in Vercel dashboard
- [ ] Selected Production + Preview + Development for each
- [ ] Redeployed the application
- [ ] Checked `/api/check-env` shows all ✅
- [ ] Tested file upload
- [ ] Verified in Runtime Logs

## 🎯 Why This Happens

1. Vercel serverless functions run in read-only `/var/task/` directory
2. Cannot create local directories or write files to disk
3. MUST use external storage (Supabase Storage)
4. Environment variables from `.env` files don't work on Vercel
5. Must set them in Vercel dashboard

## ✅ Once Configured Correctly

Files will be stored in:
- **Supabase Storage** → `attachments` bucket
- **Path format**: `notifications/123/filename-timestamp.pdf`
- **Access**: Via authenticated API endpoints only (secure)

No more ENOENT errors! 🎉
