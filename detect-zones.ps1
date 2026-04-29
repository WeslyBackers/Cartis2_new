# Detect Zones for Existing Notifications
# This script runs zone detection for all notifications in the database

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Zone Detection for Existing Notifications" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists in backend
if (-not (Test-Path "backend\.env")) {
    Write-Host "WARNING: backend\.env file not found" -ForegroundColor Yellow
    Write-Host "Creating from backend\.env.example..." -ForegroundColor Yellow
    
    if (Test-Path "backend\.env.example") {
        Copy-Item "backend\.env.example" "backend\.env"
        Write-Host "✓ Created backend\.env file" -ForegroundColor Green
        Write-Host ""
        Write-Host "Please edit backend\.env and set your database password:" -ForegroundColor Yellow
        Write-Host "  DB_PASSWORD=your_actual_password" -ForegroundColor White
        Write-Host ""
        $continue = Read-Host "Continue anyway? (y/n)"
        if ($continue -ne "y") {
            exit 0
        }
    }
}

# Check if notification_zones table needs to be created
Write-Host "Checking database schema..." -ForegroundColor Yellow
$dbPassword = ""

# Try to read password from .env file
if (Test-Path "backend\.env") {
    $envContent = Get-Content "backend\.env" -Raw
    if ($envContent -match 'DB_PASSWORD=(.+)') {
        $dbPassword = $matches[1].Trim()
    }
}

if ($dbPassword -eq "" -or $dbPassword -eq "password") {
    Write-Host "Database password not found or using default." -ForegroundColor Yellow
    $dbPassword = Read-Host "Enter PostgreSQL password for user 'postgres'" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword)
    $dbPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

$env:PGPASSWORD = $dbPassword

# Check if table exists
$tableExists = psql -h localhost -U postgres -d cartis -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_zones');" 2>$null

if ($tableExists -match "f") {
    Write-Host "Creating notification_zones table..." -ForegroundColor Yellow
    psql -h localhost -U postgres -d cartis -f "backend/database/add-notification-zones.sql"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Table created successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to create table" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Run the zone detection script
Write-Host "Starting zone detection..." -ForegroundColor Cyan
Write-Host ""

node detect-zones-for-existing.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "   Zone detection completed!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Red
    Write-Host "   Zone detection failed" -ForegroundColor Red
    Write-Host "================================================" -ForegroundColor Red
    exit 1
}
