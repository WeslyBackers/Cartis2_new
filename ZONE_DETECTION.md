# Zone Detection for Notifications

This document explains the automatic zone detection system for notifications in CARTIS 2.0.

## Overview

The zone detection system automatically identifies which geographic zones are affected by a notification based on its coordinates and geometries. This helps users quickly understand the geographic impact of each notification.

## Features

### Automatic Detection
- When a notification is created or updated, the system automatically detects which zones contain the notification's coordinates
- Uses point-in-polygon algorithm to check if notification coordinates fall within zone boundaries
- Supports multiple geometry types: Point, MultiPoint, LineString, MultiLineString, Polygon, MultiPolygon

### Manual Zone Management
- Users can manually add or remove zones from notifications
- Manual additions are marked differently from automatic detections
- Provides flexibility for edge cases or manual corrections

### Display Integration
- **Overview Table**: New "Zone(s)" column shows affected zone codes
- **Details Page**: Dedicated section displays all affected zones with visual badges
- **Zone Badges**: Color-coded to distinguish automatic vs manual detection
  - Blue badges: Automatically detected
  - Orange badges: Manually added

## Database Schema

### `notification_zones` Table

Links notifications to affected geographic zones:

```sql
CREATE TABLE notification_zones (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
    kml_coverage_id INTEGER REFERENCES kml_coverages(id) ON DELETE CASCADE,
    zone_code VARCHAR(100) NOT NULL,
    zone_name VARCHAR(500) NOT NULL,
    detection_method VARCHAR(50) DEFAULT 'automatic', -- 'automatic' or 'manual'
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(notification_id, kml_coverage_id)
);
```

## Backend Implementation

### Zone Detection Service (`zoneDetection.service.ts`)

Main functions:

#### `detectAffectedZones(notificationId: number): Promise<number[]>`
Detects which zones contain the notification's coordinates.

**Process:**
1. Retrieves notification geometry and additional coordinates
2. Extracts all points from geometries
3. Tests each point against all zone boundaries
4. Returns array of affected zone IDs

#### `updateNotificationZones(notificationId: number, zoneIds: number[]): Promise<void>`
Updates the database with detected zones.

**Process:**
1. Deletes existing automatic detections
2. Inserts new zone associations
3. Preserves manually added zones

#### `detectAndUpdateZones(notificationId: number): Promise<string[]>`
Convenience function that detects and updates zones in one call.

#### `addManualZone(notificationId: number, zoneCoverageId: number): Promise<void>`
Manually adds a zone to a notification.

#### `removeZone(notificationId: number, zoneCoverageId: number): Promise<void>`
Removes a zone association from a notification.

### API Endpoints

#### Notification Routes (Updated)

**GET `/api/notifications`**
- Now includes `zones` array in response
- Each zone object contains: `id`, `zone_code`, `zone_name`, `detection_method`

**GET `/api/notifications/:id`**
- Includes `zones` array with detection timestamps
- Shows both automatic and manual zone associations

**POST `/api/notifications`**
- Automatically detects zones after creating notification
- Non-blocking: If zone detection fails, notification is still created

**PUT `/api/notifications/:id`**
- Re-detects zones when geometry is updated
- Updates automatic detections, preserves manual additions

#### New Zone Management Endpoints

**POST `/api/notifications/:id/detect-zones`**
- Manually triggers zone re-detection for a notification
- Useful for recalculating zones after zone boundaries change

**POST `/api/notifications/:id/zones/:zoneCoverageId`**
- Manually adds a specific zone to a notification
- Marked as manual detection
- Logs activity

**DELETE `/api/notifications/:id/zones/:zoneCoverageId`**
- Removes a zone association
- Works for both automatic and manual associations
- Logs activity

## Frontend Implementation

### Overview Table (`Notifications.tsx`)

**New Column: "Zone(s)"**
- Location: Between "Locatie" and "Status" columns
- Displays: Comma-separated list of zone codes
- Tooltip: Shows full zone names on hover
- Shows "-" when no zones detected

### Detail Page (`NotificationDetail.tsx`)

**Zone Display Section**
- Location: After Bron/Bron Detail section
- Only shown when zones exist
- Each zone displayed as a badge with:
  - Zone code
  - Color coding (blue = automatic, orange = manual)
  - Icon indicator for manual zones (✎)
  - Tooltip with full zone name and detection method

## Point-in-Polygon Algorithm

The system uses a ray-casting algorithm to determine if a point falls within a polygon:

```typescript
function pointInPolygon(point: [number, number], polygon: number[][][]): boolean {
  const [lon, lat] = point;
  let inside = false;
  const ring = polygon[0]; // Outer ring

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const intersect =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}
```

**How it works:**
1. Casts a ray from the point to infinity
2. Counts how many polygon edges the ray crosses
3. If odd number of crossings: point is inside
4. If even number of crossings: point is outside

## Workflow

### Creating a Notification

1. User creates notification with geometry/coordinates
2. Backend saves notification to database
3. Zone detection service automatically runs
4. Detected zones are saved to `notification_zones` table
5. Frontend displays zones in overview and details

### Updating a Notification

1. User updates notification geometry
2. Backend updates notification record
3. Zone detection service re-runs
4. Automatic detections are updated
5. Manual zones are preserved
6. Frontend refreshes to show updated zones

### Manual Zone Management

1. User views notification details
2. Realizes a zone should be added/removed
3. Uses API to add/remove zone (future UI feature)
4. Zone is marked as manual
5. Change is logged in activity log

## Setup Instructions

### 1. Database Setup

Run the schema update:

```bash
psql -h localhost -U postgres -d cartis -f backend/database/add-notification-zones.sql
```

Or using the import script:
```bash
# The script will automatically run the schema update
.\import-kml-coverages.ps1
```

### 2. Start the Application

```bash
# Start backend and frontend
.\start-cartis.ps1
```

### 3. Import KML Zones

```bash
# Import zone data from KML files
npm run import:kml
```

## Testing Zone Detection

### Test Scenario 1: Point Notification

```javascript
// Create notification with point geometry
POST /api/notifications
{
  "title": "Test Notification",
  "notification_date": "2026-02-26",
  "geometry": {
    "type": "Point",
    "coordinates": [3.2, 51.3]  // [longitude, latitude]
  }
}
```

Expected: Zones containing this point are automatically detected.

### Test Scenario 2: Multiple Coordinates

```javascript
// Notification with multiple coordinate points
// Main geometry + additional coordinates
// All points tested against zone boundaries
```

Expected: All zones containing any of the points are detected.

### Test Scenario 3: Manual Addition

```javascript
// Manually add a zone
POST /api/notifications/123/zones/45
```

Expected: Zone is added with `detection_method = 'manual'`.

## Performance Considerations

### Current Implementation
- Pure JavaScript point-in-polygon algorithm
- Tests all notification points against all zone polygons
- Acceptable for moderate data volumes

### Future Optimizations

If performance becomes an issue with large datasets:

1. **PostGIS Integration**
   - Use native spatial queries
   - Much faster for complex geometries
   - Requires PostGIS extension

2. **Spatial Indexing**
   - Create R-tree indexes
   - Reduce search space

3. **Bounding Box Pre-filtering**
   - Quick bbox check before precise polygon test
   - Eliminates obvious non-matches

4. **Caching**
   - Cache zone geometries in memory
   - Reduce database queries

5. **Background Processing**
   - Queue zone detection for background worker
   - Return immediate response to user

## Future Enhancements

### Planned Features

1. **UI for Manual Zone Management**
   - Add/remove zones directly from notification details
   - Visual zone selector on map
   - Bulk zone operations

2. **Zone Overlap Visualization**
   - Show zones on the map
   - Highlight affected zones
   - Interactive zone selection

3. **Zone Change Notifications**
   - Alert when zone boundaries change
   - Re-detect affected notifications
   - Audit trail for zone updates

4. **Smart Zone Suggestions**
   - Suggest nearby zones
   - Recommend based on similar notifications
   - Machine learning for zone prediction

5. **Zone Statistics**
   - Most frequently affected zones
   - Zone coverage reports
   - Geographic heat maps

### API Improvements

1. **Batch Detection**
   ```javascript
   POST /api/notifications/batch-detect-zones
   { notificationIds: [1, 2, 3, 4, 5] }
   ```

2. **Zone Search**
   ```javascript
   GET /api/notifications?zone=BELGIË
   GET /api/notifications?zoneCode=BE,NL,FR
   ```

3. **Detection Confidence**
   - Add confidence score
   - Flag uncertain detections
   - Allow review workflow

## Troubleshooting

### Zones Not Detected

**Problem:** Notification created but no zones detected.

**Causes:**
1. Notification has no geometry/coordinates
2. Coordinates are outside all zone boundaries
3. Zone KML files not imported

**Solutions:**
1. Add geometry to notification
2. Verify coordinates are correct (lon/lat order)
3. Run: `npm run import:kml`

### Wrong Zones Detected

**Problem:** Incorrect zones appearing.

**Causes:**
1. Coordinate order reversed (lat/lon vs lon/lat)
2. Zone boundaries incorrect
3. Point-in-polygon algorithm issue

**Solutions:**
1. Verify GeoJSON uses [longitude, latitude] order
2. Check zone KML source data
3. Manually trigger re-detection: `POST /api/notifications/:id/detect-zones`

### Performance Issues

**Problem:** Zone detection is slow.

**Causes:**
1. Many zones to test
2. Complex polygon geometries
3. Notification has many coordinate points

**Solutions:**
1. Consider PostGIS integration
2. Simplify zone polygons where possible
3. Implement background processing

## Related Documentation

- [KML_IMPORT.md](KML_IMPORT.md) - KML import system documentation
- [backend/database/add-notification-zones.sql](backend/database/add-notification-zones.sql) - Database schema
- [backend/src/services/zoneDetection.service.ts](backend/src/services/zoneDetection.service.ts) - Service implementation

## Support

For issues or questions:
1. Check this documentation
2. Review API endpoint responses for error details
3. Check browser console and server logs
4. Verify zone data is imported correctly
