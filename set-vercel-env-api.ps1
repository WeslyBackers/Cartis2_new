$auth = Get-Content "C:\Users\wesly\AppData\Roaming\com.vercel.cli\Data\auth.json" | ConvertFrom-Json
$token = $auth.token
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }
$projectId = "prj_4vtDFZMzN1R8qunSPLWEZ9uUGLo7"
$teamId = "team_pG1MxQBeZnZsCnZqS43rBPtT"

$envVars = @(
  @{ key="DB_HOST";          value="db.xnouiglwiyhvccbejvin.supabase.co";    target=@("production","preview"); type="plain" },
  @{ key="DB_PORT";          value="5432";                                    target=@("production","preview"); type="plain" },
  @{ key="DB_NAME";          value="postgres";                                target=@("production","preview"); type="plain" },
  @{ key="DB_USER";          value="postgres";                                target=@("production","preview"); type="plain" },
  @{ key="DB_PASSWORD";      value="30W10b78*";                               target=@("production","preview"); type="encrypted" },
  @{ key="DB_SSL";           value="true";                                    target=@("production","preview"); type="plain" },
  @{ key="DATABASE_URL";     value="postgresql://postgres:30W10b78*@db.xnouiglwiyhvccbejvin.supabase.co:5432/postgres"; target=@("production","preview"); type="encrypted" },
  @{ key="SUPABASE_URL";     value="https://xnouiglwiyhvccbejvin.supabase.co"; target=@("production","preview"); type="plain" },
  @{ key="SUPABASE_SECRET_KEY"; value="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhub3VpZ2x3aXlodmNjYmVqdmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk4ODU3MCwiZXhwIjoyMDk4NTY0NTcwfQ.w4DIMTf7NJY2UUyic8Dh-Kqy0QbDjssG74PL86t1iV4"; target=@("production","preview"); type="encrypted" },
  @{ key="JWT_SECRET";       value="d8a4d50b7eb558f5015d33da9aae8f7140055ec6baaf82a35436f902acac38fd"; target=@("production","preview"); type="encrypted" },
  @{ key="JWT_EXPIRES_IN";   value="24h";                                     target=@("production","preview"); type="plain" },
  @{ key="NODE_ENV";         value="production";                              target=@("production","preview"); type="plain" },
  @{ key="PORT";             value="3000";                                    target=@("production","preview"); type="plain" }
)

foreach ($env in $envVars) {
  $body = $env | ConvertTo-Json -Compress
  try {
    Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$projectId/env?teamId=$teamId" -Method POST -Headers $headers -Body $body | Out-Null
    Write-Host "OK       $($env.key)" -ForegroundColor Green
  } catch {
    $errMsg = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errMsg.error.code -eq 'ENV_ALREADY_EXISTS') {
      Write-Host "EXISTS   $($env.key) (already set)" -ForegroundColor Yellow
    } else {
      Write-Host "ERR      $($env.key): $($errMsg.error.message)" -ForegroundColor Red
    }
  }
}

Write-Host ""
Write-Host "Done. Vercel env vars set for project: cartis2-new-backend" -ForegroundColor Cyan
