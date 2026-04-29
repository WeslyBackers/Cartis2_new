/**
 * Import Product KML Files to Database
 * 
 * This script imports product KML files into the products table.
 * Files are categorized by production line based on their filename:
 * - ENC* → Zeekaartproductie (ZK)
 * - IENC* → Inland ENC (IENC)
 * - Pilot-ENC* → Pilot ENC
 */

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');
const toGeoJSON = require('@tmcw/togeojson');
const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'cartis',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// Base path to the Coverages folder
const PRODUCTS_PATH = 'c:\\Users\\wesly\\Downloads\\Coverages\\products';

// Production line mapping based on filename patterns
const PRODUCTION_LINE_MAPPING = {
  'Pilot-ENC': { code: 'PILOT_ENC', name: 'Pilot ENC', type: 'pilot_enc' },
  'IENC': { code: 'IENC', name: 'Inland ENC', type: 'ienc' },
  'ENC_': { code: 'ZK', name: 'Zeekaartproductie', type: 'enc' },
  'ZK_': { code: 'ZK', name: 'Zeekaartproductie', type: 'chart' },
};

/**
 * Determine production line from filename
 */
function getProductionLineFromFilename(filename) {
  // Check patterns in order (Pilot-ENC before ENC_ to avoid false matches)
  const patterns = ['Pilot-ENC', 'IENC', 'ENC_', 'ZK_'];
  
  for (const pattern of patterns) {
    if (filename.startsWith(pattern)) {
      return PRODUCTION_LINE_MAPPING[pattern];
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
 * Extract OBJNAM from feature description to use as product name (Beschrijving)
 */
function extractObjnam(feature) {
  if (feature.properties.description) {
    let desc = feature.properties.description;
    
    // Handle if description is an object
    if (typeof desc === 'object') {
      if (desc.value) {
        desc = desc.value;
      } else if (desc['@value']) {
        desc = desc['@value'];
      } else {
        desc = JSON.stringify(desc);
      }
    }
    
    if (typeof desc === 'string') {
      // Format: <B>OBJNAM</B> = U6 - SG - KLK Royersluis (CDATA HTML)
      let match = desc.match(/<B>OBJNAM<\/B>\s*=\s*([^<]+)/i);
      if (match) return match[1].trim();
      
      // Format: OBJNAM = U6 - SG - KLK Royersluis (plain text after HTML strip)
      match = desc.match(/OBJNAM\s*=\s*(.+?)(?:\n|$)/);
      if (match) return match[1].trim();
      
      // Format: <td>OBJNAM</td><td>value</td> (table HTML)
      match = desc.match(/<td>OBJNAM<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
      if (match) return match[1].trim();
      
      // Format: AttributeValueOBJNAMU5 - Nieuwpoort (concatenated)
      match = desc.match(/OBJNAM(.+?)$/);
      if (match) return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Extract product name from feature properties or description
 */
function extractProductName(feature) {
  // Try OBJNAM from description first (this is the correct Beschrijving)
  const objnam = extractObjnam(feature);
  if (objnam) return objnam;
  
  // Fall back to feature name property
  if (feature.properties.name) {
    return feature.properties.name;
  }
  
  return null;
}

/**
 * Extract description from feature
 */
function extractDescription(feature) {
  if (!feature.properties.description) return null;
  
  let desc = feature.properties.description;
  
  // Handle if description is an object
  if (typeof desc === 'object') {
    if (desc.value) {
      desc = desc.value;
    } else if (desc['@value']) {
      desc = desc['@value'];
    } else {
      // Try to stringify and extract
      desc = JSON.stringify(desc);
    }
  }
  
  // Ensure it's a string
  if (typeof desc !== 'string') {
    return null;
  }
  
  // Remove HTML tags but keep line breaks
  return desc
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim()
    .substring(0, 500); // Limit length
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
 * Insert or update product
 */
async function upsertProduct(client, productionLineId, code, name, type, description, geometry) {
  const result = await client.query(
    `INSERT INTO products 
      (production_line_id, code, name, type, description, geometry, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, true)
    ON CONFLICT (code) DO UPDATE 
    SET production_line_id = $1,
        name = $3,
        type = $4,
        description = $5,
        geometry = $6,
        updated_at = CURRENT_TIMESTAMP
    RETURNING id`,
    [productionLineId, code, name, type, description, geometry]
  );
  return result.rows[0].id;
}

/**
 * Process a single KML file
 */
async function processKMLFile(client, filePath) {
  const filename = path.basename(filePath);
  
  try {
    console.log(`\nProcessing: ${filename}`);
    
    // Determine production line
    const plInfo = getProductionLineFromFilename(filename);
    if (!plInfo) {
      console.log(`  ⚠ Skipping ${filename}: Unknown production line pattern`);
      return { success: false, filename, skipped: true };
    }
    
    console.log(`  Production Line: ${plInfo.name} (${plInfo.code})`);
    
    // Get production line ID
    const productionLineId = await getProductionLineId(client, plInfo.code);
    if (!productionLineId) {
      console.error(`  ✗ Production line not found: ${plInfo.code}`);
      return { success: false, filename, error: 'Production line not found' };
    }
    
    // Parse KML
    const geoJson = parseKMLFile(filePath);
    
    // Process features
    let productCount = 0;
    if (geoJson.features && Array.isArray(geoJson.features)) {
      for (const feature of geoJson.features) {
        if (!feature.geometry || !feature.geometry.coordinates) {
          console.log(`  ⚠ Skipping feature without geometry`);
          continue;
        }
        
        // Extract product info
        const productName = extractProductName(feature);
        const productCode = feature.properties.name || `${filename.replace('.kml', '')}_${productCount}`;
        const description = extractDescription(feature);
        
        if (!productName) {
          console.log(`  ⚠ Skipping feature without name`);
          continue;
        }
        
        // Convert geometry to GeoJSON string
        const geometryJson = JSON.stringify(feature.geometry);
        
        // Insert product
        await upsertProduct(
          client,
          productionLineId,
          productCode,
          productName,
          plInfo.type,
          description,
          geometryJson
        );
        
        productCount++;
      }
    }
    
    console.log(`  ✓ Imported ${productCount} products from ${filename}`);
    return { success: true, filename, productCount };
    
  } catch (error) {
    console.error(`  ✗ Error processing ${filename}:`, error.message);
    return { success: false, filename, error: error.message };
  }
}

/**
 * Main import function
 */
async function importProducts() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(60));
    console.log('Product KML Import Tool');
    console.log('='.repeat(60));
    console.log(`Source: ${PRODUCTS_PATH}`);
    
    if (!fs.existsSync(PRODUCTS_PATH)) {
      console.error(`\n✗ Products directory not found: ${PRODUCTS_PATH}`);
      process.exit(1);
    }
    
    await client.query('BEGIN');
    
    // Get all KML files
    const files = fs.readdirSync(PRODUCTS_PATH)
      .filter(file => file.endsWith('.kml'))
      .map(file => path.join(PRODUCTS_PATH, file));
    
    console.log(`\nFound ${files.length} KML files`);
    
    // Process each file
    const results = [];
    for (const filePath of files) {
      const result = await processKMLFile(client, filePath);
      results.push(result);
    }
    
    await client.query('COMMIT');
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Import Summary');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    const totalProducts = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.productCount || 0), 0);
    
    console.log(`Total files: ${files.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Total products imported: ${totalProducts}`);
    
    if (failed > 0) {
      console.log('\nFailed files:');
      results
        .filter(r => !r.success && !r.skipped)
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
  importProducts()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { importProducts };
