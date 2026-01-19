@echo off
REM =====================================================
REM update_and_sync.bat – Convert Excel -> JSON -> Supabase (PowerShell Version)
REM =====================================================

REM 1) Change to project directory
cd /d "%~dp0"

echo [1/1] Converting Excel and Syncing to Supabase via PowerShell...
powershell -NoProfile -ExecutionPolicy Bypass -File "sync-powerapp-direct.ps1"

if errorlevel 1 (
  echo !!! Error during sync.
  pause
  exit /b 1
)

echo ✅ Update completed successfully.
pause
