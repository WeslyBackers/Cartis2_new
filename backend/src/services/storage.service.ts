import path from 'path';
import fs from 'fs';
import supabase from '../config/supabase';

const BUCKET = 'attachments';

function useSupabase(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

function isSupabasePath(filePath: string): boolean {
  // Supabase paths never start with '/' — local absolute paths always do
  return Boolean(filePath) && !filePath.startsWith('/') && !filePath.startsWith('C:') && !filePath.startsWith('\\');
}

/**
 * Save a file from an in-memory buffer. Returns the storage path written to the DB.
 * @param buffer   File contents
 * @param mimetype MIME type of the file
 * @param originalFilename  Original filename (used to derive extension)
 * @param folder   Logical folder prefix, e.g. 'notifications/42' or 'product-versions/7'
 */
export async function saveFile(
  buffer: Buffer,
  mimetype: string,
  originalFilename: string,
  folder: string
): Promise<string> {
  const ext = path.extname(originalFilename);
  const nameWithoutExt = path.basename(originalFilename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const uniqueFilename = `${nameWithoutExt}-${uniqueSuffix}${ext}`;

  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  
  // In production (Vercel), Supabase is required
  if (isProduction && !useSupabase()) {
    throw new Error(
      'File uploads require Supabase Storage in production. ' +
      'Please configure SUPABASE_URL and SUPABASE_SECRET_KEY environment variables in Vercel dashboard.'
    );
  }

  if (useSupabase()) {
    console.log(`[saveFile] Using Supabase storage, bucket: ${BUCKET}`);
    console.log(`[saveFile] Supabase URL: ${process.env.SUPABASE_URL}`);
    console.log(`[saveFile] Has Supabase key: ${Boolean(process.env.SUPABASE_SECRET_KEY)}`);
    
    const storagePath = `${folder}/${uniqueFilename}`;
    
    // Ensure bucket exists
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      if (listError) {
        console.error('[saveFile] Failed to list buckets:', listError);
        console.error('[saveFile] List buckets error details:', JSON.stringify(listError, null, 2));
        throw new Error(`Failed to access Supabase storage: ${listError.message || 'Unknown error'}`);
      }
      console.log(`[saveFile] Found ${buckets?.length || 0} buckets`);
      
      const bucketExists = buckets?.some(b => b.name === BUCKET);
      
      if (!bucketExists) {
        console.log(`[saveFile] Creating bucket: ${BUCKET}`);
        const { error: createError } = await supabase.storage.createBucket(BUCKET, {
          public: false,
          fileSizeLimit: 52428800, // 50MB
        });
        if (createError && !createError.message.includes('already exists')) {
          console.error('[saveFile] Failed to create bucket:', createError);
          console.error('[saveFile] Create bucket error details:', JSON.stringify(createError, null, 2));
          throw new Error(`Failed to create storage bucket: ${createError.message}`);
        }
      } else {
        console.log(`[saveFile] Bucket "${BUCKET}" already exists`);
      }
      
      console.log(`[saveFile] Uploading to Supabase: ${storagePath}, size: ${buffer.length} bytes`);
      const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
        contentType: mimetype,
        upsert: false,
      });
      
      if (error) {
        console.error('[saveFile] Supabase upload failed:', error);
        console.error('[saveFile] Upload error details:', JSON.stringify(error, null, 2));
        throw new Error(`Supabase upload failed: ${error.message || 'Unknown error'}`);
      }
      
      console.log(`[saveFile] Successfully uploaded to Supabase: ${storagePath}`);
      return storagePath;
    } catch (networkError: any) {
      console.error('[saveFile] Network/connection error:', networkError);
      console.error('[saveFile] Error stack:', networkError?.stack);
      
      // Provide more helpful error message
      const errorMsg = networkError?.message || String(networkError);
      if (errorMsg.includes('fetch failed') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ETIMEDOUT')) {
        throw new Error(
          'Cannot connect to Supabase Storage. ' +
          'This may be due to network issues, firewall, or incorrect credentials. ' +
          `Original error: ${errorMsg}`
        );
      }
      throw networkError;
    }
  }

  // Local disk fallback (development only)
  console.log('[saveFile] Using local disk storage (development mode)');
  
  // On Vercel/production, local storage won't work
  if (isProduction) {
    throw new Error(
      'Local disk storage is not available in production. ' +
      'Configure Supabase Storage credentials.'
    );
  }
  
  const uploadDir = process.env.UPLOAD_PATH 
    ? path.resolve(process.env.UPLOAD_PATH)
    : path.resolve(__dirname, '../../uploads');
  
  try {
    if (!fs.existsSync(uploadDir)) {
      console.log(`[saveFile] Creating uploads directory: ${uploadDir}`);
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const localPath = path.join(uploadDir, uniqueFilename);
    fs.writeFileSync(localPath, buffer);
    console.log(`[saveFile] File saved locally to: ${localPath}`);
    return localPath;
  } catch (error: any) {
    console.error('[saveFile] Failed to save file locally:', error);
    throw new Error(
      `Failed to save file locally: ${error.message}. ` +
      'In production, use Supabase Storage instead.'
    );
  }
}

/**
 * Stream a stored file to an Express response.
 */
export async function serveFile(
  filePath: string,
  contentType: string,
  originalFilename: string,
  res: any
): Promise<void> {
  console.log(`[serveFile] filePath=${filePath}, useSupabase=${useSupabase()}, isSupabasePath=${isSupabasePath(filePath)}`);

  if (isSupabasePath(filePath)) {
    const { data, error } = await supabase.storage.from(BUCKET).download(filePath);
    if (error) throw new Error(`Supabase download failed: ${error.message}`);
    if (!data) throw new Error('Supabase returned no data for file');
    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalFilename)}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } else {
    // Old disk-based path — file is no longer available (ephemeral /tmp on Vercel)
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Bestand niet meer beschikbaar op schijf (pad: ${filePath}). ` +
        'Verwijder de bijlage en voeg deze opnieuw toe.'
      );
    }
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(originalFilename)}"`);
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(filePath).pipe(res);
  }
}

/**
 * Delete a stored file (best-effort; does not throw on missing file).
 */
export async function deleteFile(filePath: string): Promise<void> {
  if (!filePath) return;
  if (isSupabasePath(filePath)) {
    await supabase.storage.from(BUCKET).remove([filePath]);
  } else {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}
