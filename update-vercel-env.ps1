$auth = Get-Content "C:\Users\wesly\AppData\Roaming\com.vercel.cli\Data\auth.json" | ConvertFrom-Json
$token = $auth.token
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
$projectId = "prj_4vtDFZMzN1R8qunSPLWEZ9uUGLo7"
$teamId = "team_pG1MxQBeZnZsCnZqS43rBPtT"

# New values for the xnouiglwiyhvccbejvin Supabase project
$newValues = @{
  "DB_HOST"            = "db.xnouiglwiyhvccbejvin.supabase.co"
  "DB_PORT"            = "5432"
  "DB_NAME"            = "postgres"
  "DB_USER"            = "postgres"
  "DB_PASSWORD"        = "30W10b78*"
  "DB_SSL"             = "true"
  "DATABASE_URL"       = "postgresql://postgres:30W10b78*@db.xnouiglwiyhvccbejvin.supabase.co:5432/postgres"
  "SUPABASE_URL"       = "https://xnouiglwiyhvccbejvin.supabase.co"
  "SUPABASE_SECRET_KEY"= "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhub3VpZ2x3aXlodmNjYmVqdmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk4ODU3MCwiZXhwIjoyMDk4NTY0NTcwfQ.w4DIMTf7NJY2UUyic8Dh-Kqy0QbDjssG74PL86t1iV4"
  "JWT_SECRET"         = "d8a4d50b7eb558f5015d33da9aae8f7140055ec6baaf82a35436f902acac38fd"
}

# Fetch existing env var IDs
$existing = Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$projectId/env?teamId=$teamId&limit=40" -Headers $headers
Write-Host "Found $($existing.envs.Count) existing env vars"

foreach ($envItem in $existing.envs) {
  $key = $envItem.key
  if ($newValues.ContainsKey($key)) {
    $newVal = $newValues[$key]
    $type = if ($key -in @("DB_PASSWORD","DATABASE_URL","SUPABASE_SECRET_KEY","JWT_SECRET")) { "encrypted" } else { "plain" }
    $body = @{ value = $newVal; type = $type } | ConvertTo-Json -Compress
    try {
      Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$projectId/env/$($envItem.id)?teamId=$teamId" -Method PATCH -Headers $headers -Body $body | Out-Null
      Write-Host "UPDATED  $key" -ForegroundColor Green
    } catch {
      Write-Host "ERR      ${key}: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
  }
}

Write-Host ""
Write-Host "All env vars updated for project: cartis2-new-backend" -ForegroundColor Cyan
