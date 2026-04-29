@echo off
REM CARTIS 2.0 - Fix notification_coordinates table
REM This script adds the geometry column needed for storing complex shapes

echo ==================================
echo   CARTIS 2.0 - Fix Coordinates
echo ==================================
echo.

REM Check if PowerShell script exists
if not exist "%~dp0fix-coordinates-geometry.ps1" (
    echo [ERROR] Fix script not found!
    echo Please ensure fix-coordinates-geometry.ps1 is in the same directory.
    pause
    exit /b 1
)

REM Run the PowerShell script
echo Running migration script...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0fix-coordinates-geometry.ps1"

pause
