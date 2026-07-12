# ============================================================
# Setup Vercel Environment Variables for Cartis 2.0
# Supabase project: xnouiglwiyhvccbejvin
# ============================================================
# Usage:
#   1. Run: vercel login
#   2. Run: .\setup-vercel-env.ps1
# ============================================================

$env_vars = @{
    # Database — Supabase direct connection
    "DB_HOST"     = "db.xnouiglwiyhvccbejvin.supabase.co"
    "DB_PORT"     = "5432"
    "DB_NAME"     = "postgres"
    "DB_USER"     = "postgres"
    "DB_PASSWORD" = "30W10b78*"
    "DB_SSL"      = "true"
    "DATABASE_URL" = "postgresql://postgres:30W10b78*@db.xnouiglwiyhvccbejvin.supabase.co:5432/postgres"

    # Supabase API
    "SUPABASE_URL"        = "https://xnouiglwiyhvccbejvin.supabase.co"
    "SUPABASE_SECRET_KEY" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhub3VpZ2x3aXlodmNjYmVqdmluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk4ODU3MCwiZXhwIjoyMDk4NTY0NTcwfQ.w4DIMTf7NJY2UUyic8Dh-Kqy0QbDjssG74PL86t1iV4"

    # App
    "JWT_SECRET"  = "d8a4d50b7eb558f5015d33da9aae8f7140055ec6baaf82a35436f902acac38fd"
    "JWT_EXPIRES_IN" = "24h"
    "NODE_ENV"    = "production"
    "PORT"        = "3000"
}

$environments = @("production", "preview")

Write-Host "Setting Vercel environment variables for project: cartis-new" -ForegroundColor Cyan
Write-Host ""

foreach ($name in $env_vars.Keys) {
    $value = $env_vars[$name]

    foreach ($target_env in $environments) {
        Write-Host "  Setting $name ($target_env)..." -NoNewline

        # Write value to a temp file and pipe it into vercel env add
        $tmpFile = [System.IO.Path]::GetTempFileName()
        Set-Content -Path $tmpFile -Value $value -NoNewline -Encoding UTF8

        $result = Get-Content $tmpFile | vercel env add $name $target_env 2>&1
        Remove-Item $tmpFile -Force

        if ($LASTEXITCODE -eq 0) {
            Write-Host " OK" -ForegroundColor Green
        } else {
            Write-Host " FAILED (may already exist)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "Done! Deploy with: vercel --prod" -ForegroundColor Green
