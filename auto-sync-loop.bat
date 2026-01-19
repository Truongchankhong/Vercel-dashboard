@echo off
title Auto Sync to Supabase (Every 5 minutes)
cd /d "%~dp0"

:loop
cls
echo ========================================================
echo   AUTO SYNC TO SUPABASE - %DATE% %TIME%
echo ========================================================
echo.
echo [1] Running PowerShell Sync Script...
powershell -NoProfile -ExecutionPolicy Bypass -File "sync-powerapp-direct.ps1"

if errorlevel 1 (
    echo [ERROR] Sync script failed. Retrying in 5 minutes...
) else (
    echo [SUCCESS] Data updated on Supabase!
)

echo.
echo Waiting 300 seconds (5 minutes) before next run...
timeout /t 300
goto loop
