$key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhub3VpZ2x3aXlodmNjYmVqdmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk4ODU3MCwiZXhwIjoyMDk4NTY0NTcwfQ.w4DIMTf7NJY2UUyic8Dh-Kqy0QbDjssG74PL86t1iV4"
$h = @{ Authorization = "Bearer $key"; apikey = $key }

$pls = Invoke-RestMethod -Uri "https://xnouiglwiyhvccbejvin.supabase.co/rest/v1/production_lines?select=id,code,name" -Headers $h
Write-Host "Production lines:"
$pls | ForEach-Object { Write-Host "  ID:$($_.id) $($_.code)" }

$publId = ($pls | Where-Object { $_.code -eq "PUBL" }).id
Write-Host "`nPUBL ID: $publId"

# All products in PUBL
$publProds = Invoke-RestMethod -Uri "https://xnouiglwiyhvccbejvin.supabase.co/rest/v1/products?select=id,code,name,type&production_line_id=eq.$publId" -Headers $h
Write-Host "PUBL products: $($publProds.Count)"
$publProds | ForEach-Object { Write-Host "  ID:$($_.id) [$($_.type)] $($_.code) - $($_.name)" }

# Notification-product links for PUBL products
Write-Host "`nNotification-product links for PUBL products:"
foreach ($prod in $publProds) {
  $links = Invoke-RestMethod -Uri "https://xnouiglwiyhvccbejvin.supabase.co/rest/v1/notifications_products?select=notification_id,product_id&product_id=eq.$($prod.id)" -Headers $h
  if ($links.Count -gt 0) {
    Write-Host "  $($prod.code): linked to notifications $($links | ForEach-Object { $_.notification_id } | Join-String -Separator ', ')"
  }
}

# notification_zones table
Write-Host "`nnotification_zones:"
$zones = Invoke-RestMethod -Uri "https://xnouiglwiyhvccbejvin.supabase.co/rest/v1/notification_zones?select=id,notification_id,zone_code,zone_name,kml_coverage_id&limit=10" -Headers $h
Write-Host "  Count: $($zones.Count)"
$zones | ForEach-Object { Write-Host "  zone_code:$($_.zone_code) notif:$($_.notification_id) kml_id:$($_.kml_coverage_id)" }

# kml_coverages table (what zones look like)
Write-Host "`nkml_coverages (first 10):"
$kmls = Invoke-RestMethod -Uri "https://xnouiglwiyhvccbejvin.supabase.co/rest/v1/kml_coverages?select=id,name,production_line_id&limit=10" -Headers $h
Write-Host "  Count: $($kmls.Count)"
$kmls | ForEach-Object { Write-Host "  ID:$($_.id) pl:$($_.production_line_id) $($_.name)" }
