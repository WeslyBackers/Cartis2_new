# KML Coverage Import Documentation

This document explains how to import the KML coverage files into the CARTIS database.

## Overview

The KML import system allows you to import:
- **Product Coverage Files** (`Coverages/products/*.kml`): Coverage polygons for chart products (ENC, Pilot-ENC, ZK charts)
- **Communication Zone Files** (`Coverages/zones/*.kml`): Geographic zones for communication regions

## Database Tables

The import creates two new tables:

### `kml_files`
Stores metadata about each imported KML file:
- `id`: Primary key
- `filename`: The KML filename
- `filepath`: Full path to the KML file
- `category`: Either 'products' or 'zones'
- `display_name`: Human-readable name extracted from KML
- `description`: Description from the KML file
- `production_line_id`: Link to production line (for product coverages)
- `imported_at`, `updated_at`: Timestamps

### `kml_coverages`
Stores individual coverage geometries from the KML files:
- `id`: Primary key
- `kml_file_id`: Reference to the parent KML file
- `code`: Product or zone code (e.g., 'BE3VLBNK', 'BELGIË')
- `name`: Full descriptive name
- `geometry_type`: Type of geometry ('Point', 'Polygon', 'MultiPolygon', etc.)
- `geometry`: GeoJSON representation of the geometry
- `style_url`: Reference to the KML style
- `properties`: Additional properties as JSON
- `created_at`, `updated_at`: Timestamps

## Prerequisites

1. **PostgreSQL Database**: Ensure you have a running PostgreSQL instance with the CARTIS database
2. **Node.js**: Node.js must be installed
3. **Coverages Folder**: The KML files must be available at `C:\Users\wesly\Downloads\Coverages`

## Configuration

Create a `.env` file in the project root (or configure environment variables):

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cartis
DB_USER=postgres
DB_PASSWORD=your-password
```

Alternatively, you can copy `backend/.env.example` to `.env` and configure it.

## Running the Import

### Method 1: Using PowerShell Script (Recommended)

```powershell
.\import-kml-coverages.ps1
```

This automated script will:
1. Check for dependencies and install them if needed
2. Update the database schema
3. Import all KML files
4. Show a summary of the import

### Method 2: Using Batch File

```cmd
import-kml-coverages.bat
```

Similar to the PowerShell script but for traditional Windows batch processing.

### Method 3: Using npm Script

```bash
# First, ensure dependencies are installed
npm install

# Update the database schema
psql -h localhost -U postgres -d cartis -f backend/database/add-kml-coverages.sql

# Run the import
npm run import:kml
```

### Method 4: Manual Node.js Execution

```bash
npm install
node import-kml-coverages.js
```

## Import Process

The import script:

1. **Parses KML Files**: Converts KML to GeoJSON format using `@tmcw/togeojson`
2. **Extracts Metadata**: Gets file name, description, and determines production line
3. **Stores File Info**: Creates or updates the `kml_files` record
4. **Imports Coverages**: Extracts all Placemarks with geometries and stores them in `kml_coverages`
5. **Transaction Safety**: Uses database transactions to ensure data integrity

## Production Line Mapping

The import automatically assigns production lines to product coverage files based on filename patterns:

- Files starting with `ENC_` → IENC
- Files starting with `IENC` → IENC
- Files starting with `Pilot-ENC` → PILOT_ENC
- Files starting with `ZK_` → ZK
- Zone files are not assigned to production lines

## Output

The script provides detailed output:
```
================================================
   CARTIS 2.0 - KML Coverage Import
================================================

Processing products KML files from: C:\Users\wesly\Downloads\Coverages\products
Found 9 KML files
Processing products/ENC_U3.kml...
  ✓ Imported 47 coverages from ENC_U3.kml
...

================================================
Import Summary
================================================
Total files processed: 23
Successful: 23
Failed: 0
Total coverages imported: 485

✓ Import completed successfully!
```

## Re-importing

The import script supports re-importing:
- If a KML file already exists (by filename), it updates the metadata
- Existing coverages for that file are deleted and re-imported
- This allows you to update coverages if the KML files change

## Querying the Data

### Get all product coverages for a production line
```sql
SELECT c.* 
FROM kml_coverages c
JOIN kml_files f ON c.kml_file_id = f.id
WHERE f.production_line_id = (SELECT id FROM production_lines WHERE code = 'IENC');
```

### Get all communication zones
```sql
SELECT c.* 
FROM kml_coverages c
JOIN kml_files f ON c.kml_file_id = f.id
WHERE f.category = 'zones';
```

### Get coverage by product code
```sql
SELECT * FROM kml_coverages WHERE code = 'BE3VLBNK';
```

## Using the Geometry Data

The geometry is stored as GeoJSON in the `geometry` column. You can:

1. **Parse in JavaScript**:
```javascript
const coverage = await db.query('SELECT geometry FROM kml_coverages WHERE id = $1', [id]);
const geoJson = JSON.parse(coverage.rows[0].geometry);
// Use with Leaflet, Mapbox, etc.
```

2. **Convert to WKT** (if needed for PostGIS):
```javascript
// The geometry can be converted to WKT format if you're using PostGIS extensions
```

## Troubleshooting

### Database Connection Errors
- Ensure PostgreSQL is running
- Check your `.env` file or environment variables
- Verify database credentials
- Ensure the CARTIS database exists

### File Not Found Errors
- Verify the Coverages folder path: `C:\Users\wesly\Downloads\Coverages`
- Check that the folder contains `products/` and `zones/` subdirectories
- Ensure KML files exist in those folders

### Parsing Errors
- Check that KML files are valid XML
- Ensure KML files follow the standard KML 2.2 format

## API Integration

To expose the coverage data through the API, you can create new routes:

```typescript
// Example route in backend/src/routes/coverage.routes.ts
router.get('/coverages/products', async (req, res) => {
  const result = await pool.query(`
    SELECT c.*, f.display_name as file_name
    FROM kml_coverages c
    JOIN kml_files f ON c.kml_file_id = f.id
    WHERE f.category = 'products'
  `);
  res.json(result.rows);
});
```

## Future Enhancements

Potential improvements for the KML import system:
- Support for additional KML features (LineStrings, etc.)
- Automatic spatial indexing with PostGIS
- Web interface for managing imports
- Incremental updates instead of full re-import
- Validation and error reporting for malformed KML files
