@echo off
REM Detect Zones for Existing Notifications

echo ================================================
echo    Zone Detection for Existing Notifications
echo ================================================
echo.

REM Check if .env file exists
if not exist "backend\.env" (
    echo WARNING: backend\.env file not found
    echo Creating from backend\.env.example...
    
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env" >nul
        echo [OK] Created backend\.env file
        echo.
        echo Please edit backend\.env and set your database password:
        echo   DB_PASSWORD=your_actual_password
        echo.
        set /p CONTINUE="Continue anyway? (y/n): "
        if not "%CONTINUE%"=="y" exit /b 0
    )
)

echo Starting zone detection...
echo.

node detect-zones-for-existing.js

if %errorlevel% equ 0 (
    echo.
    echo ================================================
    echo    Zone detection completed!
    echo ================================================
) else (
    echo.
    echo ================================================
    echo    Zone detection failed
    echo ================================================
    exit /b 1
)
