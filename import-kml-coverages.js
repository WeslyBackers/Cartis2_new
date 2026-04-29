/**
 * Import KML Coverage Files to Database
 * 
 * This script imports KML files from the Coverages folder into the database.
 * It processes both product coverage files and communication zone files.
 */

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');
const toGeoJSON = require('@tmcw/togeojson');
const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// Base path to the Coverages folder
const COVERAGES_BASE_PATH = 'c:\\Users\\wesly\\Downloads\\Coverages';

// Production line mapping based on filename patterns
const PRODUCTION_LINE_MAPPING = {
  'ENC_': 'IENC',
  'IENC': 'IENC',
  'Pilot-ENC': 'PILOT_ENC',
  'ZK_': 'ZK',
};

/**
 * Determine production line from filename
 */
function getProductionLineFromFilename(filename) {
  for (const [pattern, code] of Object.entries(PRODUCTION_LINE_MAPPING)) {
    if (filename.startsWith(pattern)) {
      return code;
    }
  }
  return null;
}

/**
 * Parse KML file and convert to GeoJSON
 */
function parseKMLFile(filePath) {
  try {
    const kmlContent = fs.readFileSync(filePath, 'utf8');
    const kmlDoc = new DOMParser().parseFromString(kmlContent, 'text/xml');
    const geoJson = toGeoJSON.kml(kmlDoc);
    return geoJson;
  } catch (error) {
    console.error(`Error parsing KML file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Extract display name from KML document title or filename
 */
function extractDisplayName(geoJson, filename) {
  if (geoJson.name) {
    return geoJson.name;
  }
  // Fallback to filename without extension
  return filename.replace('.kml', '').replace(/_/g, ' ');
}

/**
 * Extract description from KML
 */
function extractDescription(geoJson) {
  return geoJson.description || null;
}

/**
 * Extract OBJNAM from HTML description
 * Parses the HTML table in the description to find the OBJNAM value
 */
function extractOBJNAM(description) {
  if (!description) return null;
  
  try {
    // Match OBJNAM value from HTML table
    // Pattern: <td>OBJNAM</td><td>VALUE</td>
    const objnamMatch = description.match(/<td>OBJNAM<\/td>\s*<td>([^<]+)<\/td>/i);
    if (objnamMatch && objnamMatch[1]) {
      return objnamMatch[1].trim();
    }
    
    // Alternative pattern with font tags: <td><font size="4">VALUE</font></td>
    const objnamFontMatch = description.match(/<td>OBJNAM<\/td>\s*<td>(?:<font[^>]*>)?([^<]+)(?:<\/font>)?<\/td>/i);
    if (objnamFontMatch && objnamFontMatch[1]) {
      return objnamFontMatch[1].trim();
    }
  } catch (error) {
    // Ignore parsing errors
  }
  
  return null;
}

/**
 * Get or create production line ID
 */
async function getProductionLineId(client, code) {
  if (!code) return null;
  
  const result = await client.query(
    'SELECT id FROM production_lines WHERE code = $1',
    [code]
  );
  
  if (result.rows.length > 0) {
    return result.rows[0].id;
  }
  return null;
}

/**
 * Insert KML file metadata
 */
async function insertKMLFile(client, filename, filepath, category, displayName, description, productionLineId) {
  const result = await client.query(
    `INSERT INTO kml_files (filename, filepath, category, display_name, description, production_line_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (filename) DO UPDATE 
     SET filepath = $2, category = $3, display_name = $4, description = $5, production_line_id = $6, updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [filename, filepath, category, displayName, description, productionLineId]
  );
  return result.rows[0].id;
}

/**
 * Insert coverage geometry
 */
async function insertCoverage(client, kmlFileId, feature, category) {
  const code = feature.properties.name || 'UNKNOWN';
  
  // For zones, extract OBJNAM from description; for products, use code
  let name;
  if (category === 'zones') {
    // Get description - it might be a string or an object with @type and value
    let descriptionText = feature.properties.description;
    if (typeof descriptionText === 'object' && descriptionText.value) {
      descriptionText = descriptionText.value;
    }
    
    const objnam = extractOBJNAM(descriptionText);
    name = objnam || code;
  } else {
    name = feature.properties.description || feature.properties.OBJNAM || code;
  }
  
  const geometryType = feature.geometry.type;
  const geometry = JSON.stringify(feature.geometry);
  const styleUrl = feature.properties.styleUrl || null;
  const properties = JSON.stringify(feature.properties);
  
  await client.query(
    `INSERT INTO kml_coverages (kml_file_id, code, name, geometry_type, geometry, style_url, properties)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [kmlFileId, code, name, geometryType, geometry, styleUrl, properties]
  );
}

/**
 * Process a single KML file
 */
async function processKMLFile(client, filePath, category) {
  const filename = path.basename(filePath);
  console.log(`Processing ${category}/${filename}...`);
  
  try {
    // Parse KML to GeoJSON
    const geoJson = parseKMLFile(filePath);
    
    // Extract metadata
    const displayName = extractDisplayName(geoJson, filename);
    const description = extractDescription(geoJson);
    const productionLineCode = category === 'products' ? getProductionLineFromFilename(filename) : null;
    const productionLineId = await getProductionLineId(client, productionLineCode);
    
    // Insert file metadata
    const kmlFileId = await insertKMLFile(
      client,
      filename,
      filePath,
      category,
      displayName,
      description,
      productionLineId
    );
    
    // Delete existing coverages for this file (for reimport)
    await client.query('DELETE FROM kml_coverages WHERE kml_file_id = $1', [kmlFileId]);
    
    // Insert coverage geometries
    let coverageCount = 0;
    if (geoJson.features && Array.isArray(geoJson.features)) {
      for (const feature of geoJson.features) {
        if (feature.geometry && feature.geometry.coordinates) {
          // For zones, skip Point geometries (only import Polygons/MultiPolygons)
          if (category === 'zones' && feature.geometry.type === 'Point') {
            continue;
          }
          await insertCoverage(client, kmlFileId, feature, category);
          coverageCount++;
        }
      }
    }
    
    console.log(`  ✓ Imported ${coverageCount} coverages from ${filename}`);
    return { success: true, filename, coverageCount };
    
  } catch (error) {
    console.error(`  ✗ Error processing ${filename}:`, error.message);
    return { success: false, filename, error: error.message };
  }
}

/**
 * Process all KML files in a directory
 */
async function processDirectory(client, dirPath, category) {
  console.log(`\nProcessing ${category} KML files from: ${dirPath}`);
  
  if (!fs.existsSync(dirPath)) {
    console.error(`Directory not found: ${dirPath}`);
    return [];
  }
  
  const files = fs.readdirSync(dirPath)
    .filter(file => file.endsWith('.kml'))
    .map(file => path.join(dirPath, file));
  
  console.log(`Found ${files.length} KML files`);
  
  const results = [];
  for (const filePath of files) {
    const result = await processKMLFile(client, filePath, category);
    results.push(result);
  }
  
  return results;
}

/**
 * Main import function
 */
async function importKMLFiles() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(60));
    console.log('KML Coverage Import Tool');
    console.log('='.repeat(60));
    
    await client.query('BEGIN');
    
    // Process products
    const productsPath = path.join(COVERAGES_BASE_PATH, 'products');
    const productResults = await processDirectory(client, productsPath, 'products');
    
    // Process zones
    const zonesPath = path.join(COVERAGES_BASE_PATH, 'zones');
    const zoneResults = await processDirectory(client, zonesPath, 'zones');
    
    await client.query('COMMIT');
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Import Summary');
    console.log('='.repeat(60));
    
    const allResults = [...productResults, ...zoneResults];
    const successful = allResults.filter(r => r.success).length;
    const failed = allResults.filter(r => !r.success).length;
    const totalCoverages = allResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.coverageCount, 0);
    
    console.log(`Total files processed: ${allResults.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total coverages imported: ${totalCoverages}`);
    
    if (failed > 0) {
      console.log('\nFailed files:');
      allResults
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.filename}: ${r.error}`));
    }
    
    console.log('\n✓ Import completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n✗ Import failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run import
if (require.main === module) {
  importKMLFiles()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { importKMLFiles };
