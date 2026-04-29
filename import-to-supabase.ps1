#!/usr/bin/env pwsh
# CARTIS 2.0 - Supabase Database Import Script
# This script imports the CARTIS database schema and data into Supabase

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  CARTIS 2.0 Supabase Import" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if psql is installed
Write-Host "Checking PostgreSQL client (psql)..." -ForegroundColor Yellow
$psqlCli = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlCli) {
    Write-Host "[ERROR] psql not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PostgreSQL client tools first:" -ForegroundColor Yellow
    Write-Host "  choco install postgresql" -ForegroundColor Gray
    Write-Host "  or" -ForegroundColor Gray
    Write-Host "  scoop install postgresql" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "[OK] psql found" -ForegroundColor Green
Write-Host ""

# Get Supabase project details
Write-Host "Supabase Project Configuration:" -ForegroundColor Yellow
Write-Host "You'll need your Supabase database connection details from https://app.supabase.com" -ForegroundColor Gray
Write-Host ""

$defaultHost = if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_HOST)) { $env:DB_HOST } else { $env:SUPABASE_DB_HOST }
$defaultPort = if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_PORT)) { if ([string]::IsNullOrWhiteSpace($env:DB_PORT)) { "5432" } else { $env:DB_PORT } } else { $env:SUPABASE_DB_PORT }
$defaultDbName = if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_NAME)) { if ([string]::IsNullOrWhiteSpace($env:DB_NAME)) { "postgres" } else { $env:DB_NAME } } else { $env:SUPABASE_DB_NAME }
$defaultUser = if ([string]::IsNullOrWhiteSpace($env:SUPABASE_DB_USER)) { if ([string]::IsNullOrWhiteSpace($env:DB_USER)) { "postgres" } else { $env:DB_USER } } else { $env:SUPABASE_DB_USER }

$dbHostInput = Read-Host "Enter database host [$defaultHost]"
$dbHost = if ([string]::IsNullOrWhiteSpace($dbHostInput)) { $defaultHost } else { $dbHostInput }
if ([string]::IsNullOrWhiteSpace($dbHost)) {
    Write-Host "[ERROR] Database host is required!" -ForegroundColor Red
    exit 1
}

$dbPortInput = Read-Host "Enter database port [$defaultPort]"
$dbPort = if ([string]::IsNullOrWhiteSpace($dbPortInput)) { $defaultPort } else { $dbPortInput }
if ([string]::IsNullOrWhiteSpace($dbPort) -or -not ($dbPort -match '^\d+$')) {
    Write-Host "[ERROR] Database port must be a positive number!" -ForegroundColor Red
    exit 1
}

$dbNameInput = Read-Host "Enter database name [$defaultDbName]"
$dbName = if ([string]::IsNullOrWhiteSpace($dbNameInput)) { $defaultDbName } else { $dbNameInput }
if ([string]::IsNullOrWhiteSpace($dbName)) {
    Write-Host "[ERROR] Database name is required!" -ForegroundColor Red
    exit 1
}

$dbUserInput = Read-Host "Enter database user [$defaultUser]"
$dbUser = if ([string]::IsNullOrWhiteSpace($dbUserInput)) { $defaultUser } else { $dbUserInput }
if ([string]::IsNullOrWhiteSpace($dbUser)) {
    Write-Host "[ERROR] Database user is required!" -ForegroundColor Red
    exit 1
}

$dbPassword = Read-Host "Enter your Supabase Database Password" -AsSecureString
if ($null -eq $dbPassword -or $dbPassword.Length -eq 0) {
    Write-Host "[ERROR] Database password is required!" -ForegroundColor Red
    exit 1
}

# Convert secure string to plain text for connection
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword)
$dbPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$sslInput = Read-Host "Use SSL connection? [Y/n]"
$useSsl = -not ($sslInput -match '^(n|no)$')

Write-Host ""
Write-Host "Connection details:" -ForegroundColor Cyan
Write-Host "  Host: $dbHost" -ForegroundColor Gray
Write-Host "  Port: $dbPort" -ForegroundColor Gray
Write-Host "  Database: $dbName" -ForegroundColor Gray
Write-Host "  User: $dbUser" -ForegroundColor Gray
Write-Host "  SSL: $(if ($useSsl) { 'enabled' } else { 'disabled' })" -ForegroundColor Gray
Write-Host ""

# Database files to import in order
$sqlFiles = @(
    "backend/database/schema.sql",
    "backend/database/add-product-version-attachments.sql",
    "backend/database/add-opmerkingen.sql",
    "backend/database/add-notification-comments.sql",
    "backend/database/add-notification-coordinates.sql",
    "backend/database/add-geometry-to-coordinates.sql",
    "backend/database/add-task-comments-and-workflow.sql",
    "backend/database/add-task-info-requests.sql",
    "backend/database/add-task-production-line-status.sql",
    "backend/database/add-wait-for-zk-to-task-production-line-status.sql",
    "backend/database/add-task-articles.sql",
    "backend/database/add-article-titles.sql",
    "backend/database/add-note-priority.sql",
    "backend/database/add-kml-coverages.sql",
    "backend/database/add-notification-zones.sql",
    "backend/database/add-hpd-projects.sql",
    "backend/database/enable-postgis.sql",
    "backend/database/remove-status-from-notifications.sql",
    "backend/database/update-task-product-default-status.sql",
    "backend/database/drop-problematic-indexes.sql",
    "backend/database/ensure-test-user.sql"
)

Write-Host "Starting database import..." -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($sqlFile in $sqlFiles) {
    $filePath = Join-Path $PSScriptRoot $sqlFile
    
    if (-not (Test-Path $filePath)) {
        Write-Host "[SKIP] $sqlFile - File not found" -ForegroundColor Yellow
        continue
    }

    Write-Host "Importing: $sqlFile" -ForegroundColor Cyan
    
    try {
        # Use psql to execute the SQL file
        $env:PGPASSWORD = $dbPasswordPlain
        if ($useSsl) {
            $env:PGSSLMODE = "require"
        } else {
            Remove-Item Env:\PGSSLMODE -ErrorAction SilentlyContinue
        }

        psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $filePath 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] Successfully imported" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "  [ERROR] Import failed with exit code $LASTEXITCODE" -ForegroundColor Red
            $failCount++
        }
    }
    catch {
        Write-Host "  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
    }
    
    Write-Host ""
}

# Clear password from environment
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:\PGSSLMODE -ErrorAction SilentlyContinue

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Import Summary:" -ForegroundColor Cyan
Write-Host "  Successful: $successCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Gray" })
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "[SUCCESS] Database import completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Default credentials created:" -ForegroundColor Yellow
    Write-Host "  Email: admin@cartis.be" -ForegroundColor Gray
    Write-Host "  Password: admin123" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Update your .env file with Supabase connection details" -ForegroundColor Gray
    Write-Host "  2. Update DB_HOST=$dbHost" -ForegroundColor Gray
    Write-Host "  3. Update DB_PORT=$dbPort" -ForegroundColor Gray
    Write-Host "  4. Update DB_NAME=$dbName" -ForegroundColor Gray
    Write-Host "  5. Update DB_USER=$dbUser" -ForegroundColor Gray
    Write-Host "  6. Update DB_PASSWORD=your-password" -ForegroundColor Gray
    Write-Host "  7. Update DB_SSL=$(if ($useSsl) { 'true' } else { 'false' })" -ForegroundColor Gray
} else {
    Write-Host "[WARNING] Some imports failed. Check the output above for details." -ForegroundColor Yellow
}

Write-Host ""
