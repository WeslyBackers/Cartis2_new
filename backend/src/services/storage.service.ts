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

  if (useSupabase()) {
    const storagePath = `${folder}/${uniqueFilename}`;
    
    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === BUCKET);
    
    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: 10485760, // 10MB
      });
      if (createError && !createError.message.includes('already exists')) {
        console.error('Failed to create bucket:', createError);
        throw new Error(`Failed to create storage bucket: ${createError.message}`);
      }
    }
    
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: mimetype,
      upsert: false,
    });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    return storagePath;
  }

  // Local disk fallback (development)
  // Use UPLOAD_PATH from env or default to backend/uploads
  const uploadDir = process.env.UPLOAD_PATH 
    ? path.resolve(process.env.UPLOAD_PATH)
    : path.resolve(__dirname, '../../uploads'); // backend/dist/services -> backend/uploads
  
  if (!fs.existsSync(uploadDir)) {
    console.log(`Creating uploads directory: ${uploadDir}`);
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const localPath = path.join(uploadDir, uniqueFilename);
  fs.writeFileSync(localPath, buffer);
  console.log(`File saved locally to: ${localPath}`);
  return localPath;
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
