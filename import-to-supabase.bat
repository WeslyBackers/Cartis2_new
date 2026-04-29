@echo off
REM CARTIS 2.0 - Supabase Database Import Script (Batch)
REM This script provides a simple way to run the import

echo ==================================
echo   CARTIS 2.0 Supabase Import
echo ==================================
echo.

REM Check if PowerShell script exists
if not exist "%~dp0import-to-supabase.ps1" (
    echo [ERROR] Import script not found!
    echo Please ensure import-to-supabase.ps1 is in the same directory.
    pause
    exit /b 1
)

REM Run the PowerShell script
echo Running import script...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0import-to-supabase.ps1"

pause
