#!/usr/bin/env pwsh
# CARTIS 2.0 Startup Script
# This script checks PostgreSQL and starts the backend API and frontend webapp

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "  CARTIS 2.0 Startup Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check PostgreSQL service
Write-Host "Checking PostgreSQL service..." -ForegroundColor Yellow
$pgServices = Get-Service -Name postgresql* -ErrorAction SilentlyContinue

if ($pgServices) {
    $runningServices = $pgServices | Where-Object { $_.Status -eq 'Running' }
    if ($runningServices) {
        Write-Host "[OK] PostgreSQL is running:" -ForegroundColor Green
        $runningServices | ForEach-Object {
            Write-Host "  - $($_.DisplayName)" -ForegroundColor Gray
        }
    } else {
        Write-Host "[ERROR] PostgreSQL is not running!" -ForegroundColor Red
        Write-Host "  Please start PostgreSQL service first." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "[WARNING] PostgreSQL service not found!" -ForegroundColor Yellow
    Write-Host "  Make sure PostgreSQL is installed." -ForegroundColor Yellow
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y') {
        exit 1
    }
}

Write-Host ""

# Start backend and frontend
Write-Host "Starting CARTIS 2.0 servers..." -ForegroundColor Yellow
Write-Host "  - Backend API: http://localhost:3000" -ForegroundColor Gray
Write-Host "  - Frontend:    http://localhost:5173" -ForegroundColor Gray
Write-Host ""
Write-Host "Login credentials:" -ForegroundColor Cyan
Write-Host "  Email:    test@cartis.be" -ForegroundColor Gray
Write-Host "  Password: test123" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop the servers" -ForegroundColor Yellow
Write-Host ""

# Run the dev command
npm run dev
