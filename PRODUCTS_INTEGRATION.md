# Products Integration Documentation

## Overview

The Cartis application now includes comprehensive product management functionality. Products are KML-based geographical coverages that are automatically detected and can be manually managed for each notification based on their geographical intersection.

## Features

### 1. Product Import from KML Files

Products are imported from KML files located in `\Coverages\Products` folder. Each KML file contains geographical polygons representing product coverage areas.

#### Product Categories by Production Line

- **ENC_*.kml** → Zeekaartproductie (ZK)
- **IENC*.kml** → Inland ENC (IENC)
- **Pilot-ENC*.kml** → Pilot ENC
- **ZK_*.kml** → Zeekaartproductie (ZK) - Paper charts

### 2. Database Structure

#### Products Table
```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    production_line_id INTEGER REFERENCES production_lines(id),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- 'chart', 'publication', 'enc', 'ienc', 'pilot_enc'
    description TEXT,
    geometry TEXT, -- GeoJSON geometry
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Notifications-Products Link Table
```sql
CREATE TABLE notifications_products (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    is_relevant BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(notification_id, product_id)
);
```

### 3. Import Process

#### Prerequisites
1. Ensure PostGIS extension is enabled in your PostgreSQL database:
   ```bash
   psql -U postgres -d cartis -f backend/database/enable-postgis.sql
   ```

2. Place KML files in `c:\Users\wesly\Downloads\Coverages\products\`

#### Running the Import

**Using PowerShell:**
```powershell
.\import-products-kml.ps1
```

**Using Batch File:**
```batch
import-products-kml.bat
```

**Using Node directly:**
```bash
node import-products-kml.js
```

#### Import Features
- Automatically detects production line from filename
- Parses KML geometry and converts to GeoJSON
- Creates or updates products (upsert based on code)
- Supports multiple features per KML file
- Provides detailed progress and error reporting

### 4. Backend API Endpoints

#### Get Products
```
GET /api/products
Query params: productionLineId, type, isActive
```

#### Get Products for Notification (Automatic Detection)
```
GET /api/products/for-notification/:notificationId
Query params: productionLineId (required)
Returns: Products that intersect with notification geometry
```

#### Link Product to Notification
```
POST /api/products/link-to-notification
Body: { notificationId, productId, isRelevant, notes }
```

#### Unlink Product from Notification
```
DELETE /api/products/unlink-from-notification/:notificationId/:productId
```

#### Get Products for a Notification
```
GET /api/products/notification/:notificationId
Query params: productionLineId (optional)
```

### 5. Frontend Usage

#### Notification Detail Page

The notification detail page now includes a comprehensive products section:

##### Viewing Linked Products
- All linked products are displayed as badges at the top of the products section
- Products are filtered by the currently selected production line
- Badge count shows number of linked products

##### Managing Products
1. Click **"Beheer Producten"** button to expand the management section
2. The system automatically detects products that overlap with the notification's geometry
3. Products are displayed with their code and name

##### Linking Products
- Click **"+ Koppelen"** next to any available product
- Product is immediately linked and appears in the linked products list
- Only products for your active production line can be managed

##### Unlinking Products
- Click the **×** button on a linked product badge (when in management mode)
- Or click **"✓ Gekoppeld"** button in the available products list
- Confirmation dialog appears before unlinking

#### Production Line Filtering

Products are automatically filtered based on:
1. The user's current active production line
2. User permissions for that production line
3. Only products belonging to the active production line are shown and manageable

### 6. Automatic Product Detection

The system uses PostGIS spatial queries to automatically detect which products intersect with a notification's geometry:

```sql
ST_Intersects(
  ST_GeomFromGeoJSON(product.geometry),
  ST_GeomFromGeoJSON(notification.geometry)
)
```

**Detection Triggers:**
- When a notification has a geometry defined
- When the user opens the products management section
- For the currently active production line only

**No Geometry Case:**
- If a notification has no geometry, a warning message is displayed
- Users are prompted to add geometry first before products can be detected

### 7. User Permissions

Product management respects user production line rights:
- Users can only view products for production lines they have access to
- Users can only link/unlink products for production lines where they have edit rights
- The current active production line determines which products are shown

### 8. Task Creation Integration

When a decision is made on a notification and a task is created:
- All products linked to the notification (for that production line) are automatically linked to the new task
- Products are added to the `task_products` table with status 'te_verwerken'

### 9. Notifications List View

In the notifications overview:
- Products are shown as tags for each notification
- Only products matching the selected production line filter are displayed
- Product count badge shows total number of linked products

## Troubleshooting

### PostGIS Not Enabled
**Error:** `function st_intersects does not exist`

**Solution:**
```bash
psql -U postgres -d cartis -f backend/database/enable-postgis.sql
```

### No Products Detected
**Possible Causes:**
1. Notification has no geometry
2. No actual geographical intersection between notification and products
3. Products not imported for the selected production line

**Solution:**
- Ensure notification has valid GeoJSON geometry
- Verify products are imported: `SELECT COUNT(*) FROM products WHERE production_line_id = X;`
- Check geometry validity in database

### Import Fails
**Possible Causes:**
1. KML files not found in expected location
2. Invalid KML format
3. Database connection issues
4. Duplicate product codes

**Solution:**
- Verify KML files are in `c:\Users\wesly\Downloads\Coverages\products\`
- Check KML file format validity
- Ensure database connection in .env file is correct
- Review import log for specific error messages

## Files Modified/Created

### Backend
- `backend/src/routes/product.routes.ts` - Enhanced with new endpoints
- `backend/database/enable-postgis.sql` - PostGIS setup script

### Frontend
- `frontend/src/pages/NotificationDetail.tsx` - Enhanced products section

### Scripts
- `import-products-kml.js` - Product import script
- `import-products-kml.ps1` - PowerShell launcher
- `import-products-kml.bat` - Batch file launcher

### Documentation
- `PRODUCTS_INTEGRATION.md` - This file

## Future Enhancements

Potential improvements for future versions:

1. **Manual Product Addition**: Allow users to manually add products that don't intersect geometrically
2. **Product Relevance Levels**: Add importance/priority levels for linked products
3. **Product Notes**: Allow users to add notes when linking products
4. **Bulk Operations**: Select and link/unlink multiple products at once
5. **Product History**: Track when products were linked/unlinked and by whom
6. **Export**: Export product lists for notifications
7. **Statistics**: Dashboard showing product coverage statistics
8. **Notification**: Notify users when new products are added that affect existing notifications

## Support

For issues or questions:
1. Check this documentation first
2. Review error logs in browser console (F12)
3. Check backend logs for API errors
4. Verify database state manually if needed
