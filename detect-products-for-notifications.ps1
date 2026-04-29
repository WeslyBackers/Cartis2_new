#!/usr/bin/env pwsh
param(
    [switch]$Reset
)

if ($Reset) {
    Write-Host "REDEFINING products for existing notifications (clearing all existing links)..." -ForegroundColor Yellow
    Write-Host ""
    node detect-products-for-notifications.js --reset
} else {
    Write-Host "Detecting and linking products for existing notifications..." -ForegroundColor Cyan
    Write-Host ""
    node detect-products-for-notifications.js
}
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
