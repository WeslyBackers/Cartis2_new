@echo off
REM Import KML Coverages to Database
REM This script runs the KML import process

echo ================================================
echo    CARTIS 2.0 - KML Coverage Import
echo ================================================
echo.

REM Check if Coverages folder exists
set COVERAGES_PATH=C:\Users\wesly\Downloads\Coverages
if not exist "%COVERAGES_PATH%" (
    echo ERROR: Coverages folder not found at: %COVERAGES_PATH%
    echo Please ensure the Coverages folder is available.
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        exit /b 1
    )
)

REM Run the database schema update first
echo Updating database schema...
set PGPASSWORD=postgres
psql -h localhost -U postgres -d cartis -f "backend/database/add-kml-coverages.sql" 2>nul

if %errorlevel% equ 0 (
    echo [OK] Database schema updated successfully
) else (
    echo [INFO] Schema update produced warnings (this may be normal if tables already exist)
)

echo.
echo Starting KML import...
echo.

REM Run the import script
node import-kml-coverages.js

if %errorlevel% equ 0 (
    echo.
    echo ================================================
    echo    Import completed successfully!
    echo ================================================
) else (
    echo.
    echo ================================================
    echo    Import failed
    echo ================================================
    exit /b 1
)
