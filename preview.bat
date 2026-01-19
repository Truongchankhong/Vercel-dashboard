@echo off
cd /d "%~dp0"

echo Starting Local Preview Server...
echo Address: http://localhost:8080
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "preview-site.ps1"

echo.
echo ==========================================
echo Script finished. Press any key to exit...
pause
