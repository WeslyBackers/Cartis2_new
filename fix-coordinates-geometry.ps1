# CARTIS 2.0 - Fix notification_coordinates table to add geometry column
# This script adds the geometry column needed for storing complex shapes

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  CARTIS 2.0 - Fix Coordinates Table" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Get database connection details from backend .env file
$envFile = Join-Path $PSScriptRoot "backend\.env"

if (-not (Test-Path $envFile)) {
    Write-Host "[ERROR] Backend .env file not found at: $envFile" -ForegroundColor Red
    Write-Host "Please ensure the backend/.env file exists with DATABASE_URL configured" -ForegroundColor Yellow
    pause
    exit 1
}

# Read DATABASE_URL from .env
$databaseUrl = ""
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^DATABASE_URL=(.+)$') {
        $databaseUrl = $matches[1]
    }
}

if ([string]::IsNullOrEmpty($databaseUrl)) {
    Write-Host "[ERROR] DATABASE_URL not found in .env file" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Database URL found: $databaseUrl" -ForegroundColor Green
Write-Host ""

# Parse the database URL
# Format: postgresql://user:password@host:port/database
if ($databaseUrl -match 'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)') {
    $dbUser = $matches[1]
    $dbPassword = $matches[2]
    $dbHost = $matches[3]
    $dbPort = $matches[4]
    $dbName = $matches[5]
    
    Write-Host "Connecting to database:" -ForegroundColor Cyan
    Write-Host "  Host: $dbHost" -ForegroundColor White
    Write-Host "  Port: $dbPort" -ForegroundColor White
    Write-Host "  Database: $dbName" -ForegroundColor White
    Write-Host "  User: $dbUser" -ForegroundColor White
    Write-Host ""
    
    # Set PGPASSWORD environment variable for psql
    $env:PGPASSWORD = $dbPassword
    
    # Path to migration SQL file
    $sqlFile = Join-Path $PSScriptRoot "backend\database\add-geometry-to-coordinates.sql"
    
    if (-not (Test-Path $sqlFile)) {
        Write-Host "[ERROR] Migration SQL file not found at: $sqlFile" -ForegroundColor Red
        pause
        exit 1
    }
    
    Write-Host "Applying migration..." -ForegroundColor Yellow
    
    # Run the SQL file using psql
    $psqlCmd = "psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f `"$sqlFile`""
    
    try {
        $output = Invoke-Expression $psqlCmd 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "[SUCCESS] Migration applied successfully!" -ForegroundColor Green
            Write-Host ""
            Write-Host "The notification_coordinates table now has a geometry column." -ForegroundColor White
            Write-Host "You can now add coordinates with complex geometries to notifications." -ForegroundColor White
        } else {
            Write-Host ""
            Write-Host "[ERROR] Migration failed!" -ForegroundColor Red
            Write-Host $output -ForegroundColor Red
        }
    } catch {
        Write-Host ""
        Write-Host "[ERROR] Failed to execute migration: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Make sure PostgreSQL client tools (psql) are installed and in your PATH" -ForegroundColor Yellow
    } finally {
        # Clear password from environment
        $env:PGPASSWORD = ""
    }
    
} else {
    Write-Host "[ERROR] Invalid DATABASE_URL format" -ForegroundColor Red
    Write-Host "Expected format: postgresql://user:password@host:port/database" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host ""
pause
