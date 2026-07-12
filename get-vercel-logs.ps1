$auth = Get-Content "C:\Users\wesly\AppData\Roaming\com.vercel.cli\Data\auth.json" | ConvertFrom-Json
$token = $auth.token
$headers = @{ Authorization = "Bearer $token" }
$teamId = "team_pG1MxQBeZnZsCnZqS43rBPtT"
$projectId = "prj_4vtDFZMzN1R8qunSPLWEZ9uUGLo7"

# Get runtime logs (not build logs) from the latest deployment
$r = Invoke-RestMethod -Uri "https://api.vercel.com/v6/deployments?projectId=$projectId&teamId=$teamId&target=production&limit=1" -Headers $headers
$depId = $r.deployments[0].uid
Write-Host "Deployment: $depId"
Write-Host "URL: $($r.deployments[0].url)"

# Get all events
$events = Invoke-RestMethod -Uri "https://api.vercel.com/v3/deployments/$depId/events?teamId=$teamId&limit=100" -Headers $headers
Write-Host "Total events: $($events.Count)"
$events | Where-Object { $_.text } | Select-Object -Last 30 | ForEach-Object { Write-Host "[$($_.type)] $($_.text)" }
