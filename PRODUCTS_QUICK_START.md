# Products Integration - Quick Start Guide

## Step-by-Step Setup

### Step 1: Enable PostGIS (One-time setup)

Open a terminal and run:

```bash
cd d:\Programming\Webapps\Cartis_new
psql -U postgres -d cartis -f backend/database/enable-postgis.sql
```

Or via pgAdmin:
1. Connect to your `cartis` database
2. Open Query Tool
3. Open file: `backend/database/enable-postgis.sql`
4. Execute the script

### Step 2: Import Products

Run the import script using one of these methods:

**Option A - PowerShell (Recommended):**
```powershell
cd d:\Programming\Webapps\Cartis_new
.\import-products-kml.ps1
```

**Option B - Batch File:**
```batch
cd d:\Programming\Webapps\Cartis_new
import-products-kml.bat
```

**Option C - Node:**
```bash
cd d:\Programming\Webapps\Cartis_new
node import-products-kml.js
```

### Step 3: Verify Import

Check that products were imported:

```sql
-- Connect to database
psql -U postgres -d cartis

-- Check product counts by production line
SELECT 
  pl.name as production_line,
  COUNT(p.id) as product_count
FROM products p
JOIN production_lines pl ON p.production_line_id = pl.id
GROUP BY pl.name;

-- View some products
SELECT code, name, type FROM products LIMIT 10;
```

Expected output should show products for each production line:
- Zeekaartproductie (ZK): ENC and ZK products
- Inland ENC (IENC): IENC products
- Pilot ENC: Pilot-ENC products

### Step 4: Using Products in the Application

1. **Open a Notification:**
   - Navigate to the notifications list
   - Click on any notification to view details

2. **View Products Section:**
   - Scroll down to find the "Producten" section
   - If products are already linked, they appear as blue badges

3. **Manage Products:**
   - Click **"Beheer Producten"** button
   - The system shows products that overlap with the notification's geometry
   - Green checkmark = product has geometry overlap detected

4. **Link a Product:**
   - Find a product in the "Beschikbare Producten" list
   - Click **"+ Koppelen"** button
   - Product immediately appears in the linked products list

5. **Unlink a Product:**
   - In management mode, click the × on a linked product badge
   - Or click **"✓ Gekoppeld"** in the available products list
   - Confirm the action

### Step 5: Production Line Filtering

Products are automatically filtered by your active production line:

1. **Switch Production Line:**
   - Use the production line selector in the top navigation
   - Products list updates automatically

2. **View Only Your Products:**
   - Only products for your active production line are shown
   - You can only manage products for production lines where you have edit rights

## Quick Verification Checklist

- [ ] PostGIS extension enabled (no errors in Step 1)
- [ ] Products imported successfully (counts > 0 in Step 3)
- [ ] Can see "Producten" section in notification detail page
- [ ] Can expand/collapse products management section
- [ ] Available products appear when notification has geometry
- [ ] Can link and unlink products
- [ ] Products appear as badges when linked

## Common Issues and Solutions

### "Function st_intersects does not exist"
**Solution:** Run Step 1 again to enable PostGIS

### "No products found"
**Causes:**
- Notification has no geometry → Add coordinates/geometry first
- Wrong production line selected → Switch to correct production line
- No geographical overlap → Products simply don't intersect

### "Cannot link product"
**Causes:**
- No edit rights for current production line → Contact admin
- Not logged in → Log in with valid credentials

### Import script fails
**Check:**
- KML files are in: `c:\Users\wesly\Downloads\Coverages\products\`
- Database connection settings in `.env` file
- PostgreSQL is running

## Next Steps

Once products are working:

1. **Review Existing Notifications:**
   - Check which notifications should have products linked
   - Use the management section to link relevant products

2. **Train Users:**
   - Show team how to use the products section
   - Explain automatic detection vs manual linking
   - Clarify production line filtering

3. **Monitor Usage:**
   - Check that products are being linked appropriately
   - Review task creation to ensure products carry over

4. **Data Quality:**
   - Verify product geometries are accurate
   - Update KML files if needed and re-import

## Support Files

- **Full Documentation:** `PRODUCTS_INTEGRATION.md`
- **Import Script:** `import-products-kml.js`
- **PostGIS Setup:** `backend/database/enable-postgis.sql`
- **Product Routes:** `backend/src/routes/product.routes.ts`
- **Frontend UI:** `frontend/src/pages/NotificationDetail.tsx`

## Testing the Feature

### Test Scenario 1: Automatic Detection
1. Create or open a notification with geometry (coordinates)
2. Open products management section
3. Verify products with overlapping geometry appear
4. Link one product and verify it appears as badge

### Test Scenario 2: Manual Selection
1. Open products management
2. Link a product manually
3. Verify it appears in linked products
4. Unlink it and verify it's removed

### Test Scenario 3: Production Line Filtering
1. Link products while on one production line
2. Switch to different production line
3. Verify different set of products appears
4. Verify you can't modify products from other production lines (if no rights)

### Test Scenario 4: Task Creation
1. Link products to a notification
2. Make a decision (Ja/Nee) to create a task
3. Open the created task
4. Verify products were carried over to task_products table

---

**You're all set!** The products feature is now fully integrated and ready to use.
