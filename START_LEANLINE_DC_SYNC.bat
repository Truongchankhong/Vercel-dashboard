@echo off
title Leanline DC Surplus Excel Sync
cd /d "%~dp0"
echo =======================================================
echo   STARTING LEANLINE DC SURPLUS EXCEL SYNC...
echo =======================================================
node sync-leanline-dc-excel.js
pause
