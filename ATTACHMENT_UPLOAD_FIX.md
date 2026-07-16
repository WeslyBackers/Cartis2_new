# Attachment Upload Fix - January 2026

## Problem
When importing emails (.eml or .msg files) as "nieuwe melding", attachments were not being uploaded. Additionally, manually uploading attachments resulted in an error: `ENOENT; no such file or directory`.

## Root Causes

### 1. Missing Supabase Storage Bucket
The application code expected a Supabase Storage bucket named "attachments" to exist, but it had not been created. This caused all uploads to fail when Supabase was configured.

### 2. Incorrect Local Storage Path
When falling back to local storage (development mode), the code calculated the wrong path:
- **Before**: `backend/dist/services/../../../uploads` → `D:\Programming\Webapps\Cartis_new\uploads` ❌
- **After**: `backend/dist/services/../../uploads` → `D:\Programming\Webapps\Cartis_new\backend\uploads` ✅

## Solution

### Changes Implemented

#### 1. Storage Service (`backend/src/services/storage.service.ts`)
- ✅ Added automatic Supabase bucket creation if it doesn't exist
- ✅ Fixed local upload path calculation
- ✅ Added UPLOAD_PATH environment variable support
- ✅ Added detailed logging for troubleshooting

#### 2. Notification Routes (`backend/src/routes/notification.routes.ts`)
- ✅ Added comprehensive logging for attachment upload operations
- ✅ Added error stack trace logging for better debugging

#### 3. Environment Configuration
- ✅ Updated `backend/.env` with correct UPLOAD_PATH
- ✅ Updated `backend/.env.example` with correct UPLOAD_PATH

#### 4. Setup Script (`setup-supabase-storage.js`)
- ✅ Created script to manually verify/create Supabase storage bucket
- ✅ Script checks bucket existence and creates it if needed

### Verification

Run the setup script to ensure the Supabase bucket exists:
```bash
node setup-supabase-storage.js
```

Expected output:
```
🔍 Checking Supabase Storage...
✅ Bucket "attachments" already exists
   Public: false
   File size limit: 10 MB

✅ Supabase Storage setup complete!
```

## Testing Instructions

### Test 1: Email Import with Attachments
1. Navigate to the Notifications page
2. Click the **"+ Nieuwe Melding"** button
3. In the modal, locate the email import section
4. Drag and drop an `.eml` or `.msg` file that contains attachments
5. Verify that the attachments appear in the attachments list below
6. Fill in required fields (Titel, Meldingsdatum)
7. Click **"Aanmaken"**
8. Verify success message: "Melding succesvol aangemaakt met bijlagen!"
9. Open the created notification and verify all attachments are present

### Test 2: Manual Attachment Upload
1. Open an existing notification or create a new one
2. Navigate to the "Bijlagen" (Attachments) section
3. Try to upload a file using the drag-and-drop area or click to select
4. Verify that:
   - No error message appears
   - The file uploads successfully
   - The attachment appears in the list with correct filename

### Test 3: Check Backend Logs
When uploading an attachment, you should see logs like:
```
[Upload attachment] Notification ID: 123, File: test.pdf, Size: 12345, Type: application/pdf
[Upload attachment] Saving file to storage...
[Upload attachment] File saved to: notifications/123/test-1234567890-123456789.pdf
[Upload attachment] Success! Attachment ID: 456
```

## Technical Details

### Supabase Storage Configuration
- **Bucket name**: `attachments`
- **Public access**: No (private)
- **File size limit**: 10 MB
- **Auto-creation**: Yes (on first upload if missing)

### Local Storage Fallback
- **Directory**: `backend/uploads/`
- **Used when**: Supabase credentials not configured
- **Path resolution**: Relative to compiled code in `backend/dist/services/`

### Environment Variables
```env
# File Upload Configuration
MAX_FILE_SIZE=10485760          # 10 MB in bytes
UPLOAD_PATH=./backend/uploads   # Local storage path

# Supabase Configuration (required for cloud storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key
```

## Troubleshooting

### If uploads still fail:

1. **Check Supabase credentials**
   ```bash
   # Verify these are set in backend/.env
   SUPABASE_URL=https://...
   SUPABASE_SECRET_KEY=eyJ...
   ```

2. **Verify bucket exists**
   ```bash
   node setup-supabase-storage.js
   ```

3. **Check backend logs**
   - Look for `[Upload attachment]` log entries
   - Check for error messages and stack traces

4. **Test local storage fallback**
   - Temporarily remove SUPABASE_URL from `.env`
   - Restart backend
   - Try uploading - should use `backend/uploads/`

5. **Verify uploads directory exists**
   ```bash
   ls backend/uploads/
   ```

## Files Changed
- `backend/src/services/storage.service.ts` - Storage logic fixes
- `backend/src/routes/notification.routes.ts` - Enhanced logging
- `backend/.env` - Updated UPLOAD_PATH
- `backend/.env.example` - Updated UPLOAD_PATH
- `setup-supabase-storage.js` - New setup script

## Maintenance Notes
- The Supabase bucket is created automatically on first upload
- Setup script (`setup-supabase-storage.js`) can be run anytime to verify bucket
- Backend logs provide detailed information about each upload operation
- Both Supabase and local storage are supported
