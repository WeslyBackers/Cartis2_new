import multer from 'multer';
import path from 'path';

// File filter - allow common file types including CAD/GIS formats
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimeTypes = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/xml',
    'text/xml',
    
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/tiff',
    
    // Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-7z-compressed',
    'application/x-rar-compressed',
    
    // CAD formats (DWG, DXF)
    'application/acad',
    'application/x-acad',
    'application/autocad',
    'application/x-autocad',
    'application/x-dwg',
    'application/dwg',
    'image/vnd.dwg',
    'image/x-dwg',
    'application/dxf',
    'application/x-dxf',
    'image/vnd.dxf',
    'image/x-dxf',
    
    // GIS/Shapefile formats (SHP and related files)
    'application/x-esri-shape',
    'application/x-shapefile',
    'application/octet-stream', // Many GIS files use this generic type
    'application/dbf',
    'application/x-dbf',
    
    // KML/KMZ (already supported but adding for completeness)
    'application/vnd.google-earth.kml+xml',
    'application/vnd.google-earth.kmz',
  ];

  // Check MIME type
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
    return;
  }

  // Fallback: Check file extension for formats that may have incorrect MIME types
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = [
    // CAD
    '.dwg', '.dxf', '.dwf', '.dgn',
    
    // GIS/Shapefile (all related files)
    '.shp', '.shx', '.dbf', '.prj', '.sbn', '.sbx', '.cpg', '.shp.xml',
    
    // Other GIS formats
    '.geojson', '.gml', '.kml', '.kmz', '.gpx',
    
    // Common formats (for reference)
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.xml',
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif',
    '.zip', '.7z', '.rar',
  ];

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Bestandstype niet toegestaan: ${file.originalname} (${file.mimetype})`), false);
  }
};

// Use memory storage so the buffer is available for Supabase Storage uploads.
// Route handlers are responsible for persisting the buffer via storage.service.ts.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800'), // 50 MB default (increased for CAD/GIS files)
  },
});

export default upload;
