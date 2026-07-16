# Supported File Types for Attachments

## Overview
The application now supports uploading various file types including documents, images, CAD files, and GIS/shapefile formats.

## Maximum File Size
- **50 MB** per file (increased from 10 MB)

## Supported File Types

### Documents
- **PDF**: `.pdf`
- **Word**: `.doc`, `.docx`
- **Excel**: `.xls`, `.xlsx`
- **Text**: `.txt`, `.csv`
- **XML**: `.xml`

### Images
- **JPEG/JPG**: `.jpg`, `.jpeg`
- **PNG**: `.png`
- **GIF**: `.gif`
- **BMP**: `.bmp`
- **TIFF**: `.tiff`, `.tif`

### Archives
- **ZIP**: `.zip`
- **7-Zip**: `.7z`
- **RAR**: `.rar`

### CAD Formats (Computer-Aided Design)
- **AutoCAD Drawing**: `.dwg`
- **Drawing Exchange Format**: `.dxf`
- **Design Web Format**: `.dwf`
- **MicroStation**: `.dgn`

### GIS Formats (Geographic Information Systems)

#### Shapefiles
ESRI Shapefiles consist of multiple related files. You can upload all components:
- **Main shapefile**: `.shp` (required - contains geometry)
- **Shape index**: `.shx` (required - position index)
- **Attribute table**: `.dbf` (required - attribute data)
- **Projection**: `.prj` (optional - coordinate system)
- **Spatial index**: `.sbn`, `.sbx` (optional - performance)
- **Code page**: `.cpg` (optional - character encoding)
- **XML metadata**: `.shp.xml` (optional)

**Important**: When sharing shapefiles, upload **all related files** to ensure the shapefile can be opened correctly.

#### Other GIS Formats
- **GeoJSON**: `.geojson`
- **Geography Markup Language**: `.gml`
- **Keyhole Markup Language**: `.kml`, `.kmz`
- **GPS Exchange Format**: `.gpx`

## Usage

### In "Nieuwe Melding" (New Notification)
1. Click "+ Nieuwe Melding"
2. Scroll to "Bijlagen (optioneel)"
3. Drag and drop files or click to select
4. All supported file types are automatically accepted

### In Notification Details
1. Open any notification
2. Scroll to "Bijlagen" section
3. Click "⬆️ Nieuw bestand uploaden"
4. Upload any supported file type

### In Product Versions
1. Open a product version
2. Go to "Bijlagen productversie" section
3. Click "Choose File" and select your file
4. Click "Bijlage uploaden"

## Tips for Working with Shapefiles

### Complete Shapefile Upload
Always upload all components of a shapefile:
```
my_data.shp
my_data.shx
my_data.dbf
my_data.prj
my_data.cpg
```

### Recommended: Use ZIP Archives
To ensure all shapefile components stay together:
1. Select all shapefile components (`.shp`, `.shx`, `.dbf`, `.prj`, etc.)
2. Create a ZIP archive (e.g., `my_data.zip`)
3. Upload the single ZIP file
4. This ensures nothing gets lost

### File Naming
- Keep filenames simple (no special characters)
- Use underscores instead of spaces: `project_data.shp` not `project data.shp`
- Keep the same base name for all shapefile components

## Technical Details

### Backend Validation
Files are validated by:
1. **MIME type** (when available)
2. **File extension** (fallback for formats with generic MIME types)

### Storage
- **Development**: Local disk at `backend/uploads/`
- **Production (Vercel)**: Supabase Storage bucket "attachments"
- Files are stored with unique names to prevent conflicts
- Original filenames are preserved in the database

### MIME Types
The system recognizes various MIME types for each format:
- CAD files may have: `application/acad`, `application/x-dwg`, `image/vnd.dwg`, etc.
- GIS files often use: `application/octet-stream`, `application/x-esri-shape`, etc.
- The extension-based validation ensures these files are always accepted

## Troubleshooting

### "Bestandstype niet toegestaan"
If you get this error:
1. Check the file extension is in the supported list above
2. Verify the file isn't corrupted
3. Try renaming the file with the correct extension
4. Contact support if the file type should be supported

### File Too Large
If upload fails due to size:
- Maximum size is **50 MB**
- For larger files:
  - Compress using ZIP/7z
  - Split into multiple smaller files
  - Use external file sharing and add a link in the notification content

### Shapefile Won't Open
If someone reports a shapefile won't open:
- Verify all components were uploaded (`.shp`, `.shx`, `.dbf`)
- Check if `.prj` file is present (needed for correct projection)
- Recommend uploading as a ZIP archive to keep components together

## Future Enhancements

Planned additions:
- Direct ZIP extraction and validation
- Thumbnail generation for images
- Preview for common formats
- Automatic shapefile validation (checking all required components)
- Coordinate system detection for GIS files

## Environment Variables

To change the maximum file size, update in Vercel dashboard:
```
MAX_FILE_SIZE=52428800  # 50 MB in bytes
```

For custom limits:
- 10 MB = 10485760
- 25 MB = 26214400
- 50 MB = 52428800
- 100 MB = 104857600
