import multer from 'multer';

// File filter - allow most common file types
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/tiff',
    'application/zip',
    'application/x-zip-compressed',
    'application/xml',
    'text/xml',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Bestandstype niet toegestaan: ${file.mimetype}`), false);
  }
};

// Use memory storage so the buffer is available for Supabase Storage uploads.
// Route handlers are responsible for persisting the buffer via storage.service.ts.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10 MB default
  },
});

export default upload;
