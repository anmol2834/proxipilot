@echo off
echo ========================================================
echo Killing any processes listening on ports 3000 and 8000
echo ========================================================

powershell -Command "Get-NetTCPConnection -LocalPort 3000,8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host 'Killed process on port' $_.LocalPort '(PID:' $_.OwningProcess ')' }"

echo.
echo Ports 3000 and 8000 are now clear!
echo ========================================================
