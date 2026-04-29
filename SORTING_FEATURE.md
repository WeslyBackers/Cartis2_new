# Table Sorting Feature

## Overview
Added column sorting functionality to all tables in the CARTIS 2.0 application.

## Changes Made

### 1. Created Reusable Sorting Hook
**File:** `frontend/src/hooks/useTableSort.ts`

A custom React hook that provides:
- Generic sorting for any data type (string, number, date, boolean)
- Three-state sorting: ascending → descending → no sort
- Visual indicators (↑/↓) for sort direction
- Null/undefined handling

**Usage:**
```typescript
const { sortedData, handleSort, getSortIcon } = useTableSort(data);
```

### 2. Updated Pages with Sorting

#### Products Page (`frontend/src/pages/Products.tsx`)
Sortable columns:
- Code
- Naam (Name)
- Type
- Beschrijving (Description)
- Status (is_active)

#### Tasks Page (`frontend/src/pages/Tasks.tsx`)
Sortable columns:
- Taaknummer (Task Number)
- Titel (Title)
- BaZ Nr.
- MSI Actief (Active)
- Opvolging (Follow-up)

#### Product Versions Page (`frontend/src/pages/ProductVersions.tsx`)
Sortable columns:
- Versienummer (Version Number)
- Versiedatum (Version Date)
- Status
- Publicatiedatum (Published Date)

#### Notifications Page (`frontend/src/pages/Notifications.tsx`)
Sortable columns:
- ID
- Code
- Datum (Date)
- Ontvangen (Received)
- Titel (Title)
- Bron (Source)
- Bron Detail (Source Detail)
- Status

### 3. Enhanced Styling
**File:** `frontend/src/index.css`

Added CSS for sortable table headers:
- Hover effects on clickable headers
- Smooth transitions
- Visual feedback for user interaction

## User Experience

### How to Use
1. Click on any sortable column header to sort ascending
2. Click again to sort descending
3. Click a third time to remove sorting

### Visual Indicators
- **↑** = Ascending order
- **↓** = Descending order
- **No arrow** = No sorting applied
- **Hover effect** = Column is sortable

### Features
- **Multi-type sorting**: Handles strings, numbers, dates, and booleans
- **Null-safe**: Properly handles null/undefined values
- **User-friendly**: Clear visual feedback
- **Performance**: Client-side sorting with useMemo optimization
- **Accessibility**: Keyboard-friendly (can be enhanced further)

## Technical Details

### Sort Logic
- **Strings**: Locale-aware comparison (supports special characters)
- **Numbers**: Numeric comparison
- **Dates**: Timestamp comparison
- **Booleans**: True > False in ascending order
- **Nulls**: Always sorted to the end

### State Management
- Sorting state is local to each page
- Does not interfere with server-side filtering/pagination
- Sorts only the currently displayed data

## Future Enhancements
1. Remember sort preferences in localStorage
2. Multi-column sorting (Shift+Click)
3. Server-side sorting for large datasets
4. Sort indicators in column headers (icon instead of arrow)
5. Accessibility improvements (ARIA labels)
