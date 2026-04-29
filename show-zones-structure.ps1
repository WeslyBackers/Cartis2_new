# Script to display zone database structure

$env:PGPASSWORD = '30W10b78*'

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ZONE DATABASE STRUCTURE OVERVIEW" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 1. Show table schemas
Write-Host "1. TABLE SCHEMAS" -ForegroundColor Yellow
Write-Host "-" * 60 -ForegroundColor Gray

Write-Host "`nkml_files (Zone File Metadata):" -ForegroundColor Green
psql -h localhost -U postgres -d cartis -c "\d kml_files" 2>&1 | Select-String -Pattern "Column|Type|---" -Context 0,10

Write-Host "`nkml_coverages (Zone Geometries):" -ForegroundColor Green
psql -h localhost -U postgres -d cartis -c "\d kml_coverages" 2>&1 | Select-String -Pattern "Column|Type|---" -Context 0,10

Write-Host "`nnotification_zones (Zone Associations):" -ForegroundColor Green
psql -h localhost -U postgres -d cartis -c "\d notification_zones" 2>&1 | Select-String -Pattern "Column|Type|---" -Context 0,10

# 2. Show data counts
Write-Host "`n`n2. DATA SUMMARY" -ForegroundColor Yellow
Write-Host "-" * 60 -ForegroundColor Gray

Write-Host "`nFiles and Coverages by Category:" -ForegroundColor Green
psql -h localhost -U postgres -d cartis -c "SELECT f.category, COUNT(DISTINCT f.id) as file_count, COUNT(c.id) as coverage_count FROM kml_files f LEFT JOIN kml_coverages c ON f.id = c.kml_file_id GROUP BY f.category ORDER BY f.category;"

Write-Host "`nTotal Zone Files:" -ForegroundColor Green
psql -h localhost -U postgres -d cartis -c "SELECT COUNT(*) as zone_files FROM kml_files WHERE category = 'zones';"

Write-Host "`nTotal Zones (Coverages):" -ForegroundColor Green
psql -h localhost -U postgres -d cartis -c "SELECT COUNT(*) as total_zones FROM kml_coverages WHERE kml_file_id IN (SELECT id FROM kml_files WHERE category = 'zones');"

Write-Host "`nNotifications with Zones:" -ForegroundColor Green
psql -h localhost -U postgres -d cartis -c "SELECT COUNT(DISTINCT notification_id) as notifications_with_zones FROM notification_zones;"

Write-Host "`nTotal Zone Associations:" -ForegroundColor Green
psql -h localhost -U postgres -d cartis -c "SELECT COUNT(*) as total_associations, COUNT(CASE WHEN detection_method = 'automatic' THEN 1 END) as automatic, COUNT(CASE WHEN detection_method = 'manual' THEN 1 END) as manual FROM notification_zones;"

# 3. Sample zone data
Write-Host "`n`n3. SAMPLE ZONE DATA" -ForegroundColor Yellow
Write-Host "-" * 60 -ForegroundColor Gray

Write-Host "`nSample Zone Files:" -ForegroundColor Green
psql -h localhost -U postgres -d cartis -c "SELECT id, filename, display_name FROM kml_files WHERE category = 'zones' ORDER BY filename LIMIT 10;"

Write-Host "`nSample Zone Coverages (Alphabetical):" -ForegroundColor Green
psql -h localhost -U postgres -d cartis -c "SELECT c.id, c.code, c.name, c.geometry_type, f.filename FROM kml_coverages c JOIN kml_files f ON c.kml_file_id = f.id WHERE f.category = 'zones' ORDER BY c.name LIMIT 15;"

# 4. Sample notification-zone associations
Write-Host "`n`n4. NOTIFICATION-ZONE ASSOCIATIONS" -ForegroundColor Yellow
Write-Host "-" * 60 -ForegroundColor Gray

Write-Host "`nNotifications and Their Zones:" -ForegroundColor Green
psql -h localhost -U postgres -d cartis -c "SELECT n.id, n.code as notif_code, COUNT(nz.id) as zone_count, STRING_AGG(nz.zone_name, ', ') as zones FROM notifications n LEFT JOIN notification_zones nz ON n.id = nz.notification_id GROUP BY n.id, n.code ORDER BY n.id LIMIT 10;"

Write-Host "`nDetailed Zone Associations (Sample):" -ForegroundColor Green
psql -h localhost -U postgres -d cartis -c "SELECT nz.id, n.code as notification, nz.zone_name, nz.detection_method, nz.detected_at FROM notification_zones nz JOIN notifications n ON nz.notification_id = n.id ORDER BY nz.notification_id, nz.zone_name LIMIT 20;"

# 5. Geometry type distribution
Write-Host "`n`n5. ZONE GEOMETRY TYPES" -ForegroundColor Yellow
Write-Host "-" * 60 -ForegroundColor Gray

psql -h localhost -U postgres -d cartis -c "SELECT geometry_type, COUNT(*) as count FROM kml_coverages WHERE kml_file_id IN (SELECT id FROM kml_files WHERE category = 'zones') GROUP BY geometry_type ORDER BY count DESC;"

Write-Host "`n========================================`n" -ForegroundColor Cyan

$env:PGPASSWORD = $null
