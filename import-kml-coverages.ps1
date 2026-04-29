# Import KML Coverages to Database
# This script runs the KML import process

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   CARTIS 2.0 - KML Coverage Import" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Coverages folder exists
$coveragesPath = "C:\Users\wesly\Downloads\Coverages"
if (-not (Test-Path $coveragesPath)) {
    Write-Host "ERROR: Coverages folder not found at: $coveragesPath" -ForegroundColor Red
    Write-Host "Please ensure the Coverages folder is available." -ForegroundColor Yellow
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Run the database schema update first
Write-Host "Updating database schema..." -ForegroundColor Yellow
$env:PGPASSWORD = "postgres"
$schemaResult = psql -h localhost -U postgres -d cartis -f "backend/database/add-kml-coverages.sql" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Database schema updated successfully" -ForegroundColor Green
} else {
    Write-Host "Schema update produced warnings (this may be normal if tables already exist)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting KML import..." -ForegroundColor Yellow
Write-Host ""

# Run the import script
node import-kml-coverages.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "   Import completed successfully!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Red
    Write-Host "   Import failed" -ForegroundColor Red
    Write-Host "================================================" -ForegroundColor Red
    exit 1
}
