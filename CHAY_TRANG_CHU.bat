@echo off
title Dashboard Tong - Ortholite Vietnam
echo Dang mo Trang Chu Dashboard Progress Tracking...
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --ignore-certificate-errors --allow-file-access-from-files --user-data-dir="%TEMP%\edge_app_profile" --app="%~dp0dist\index.html"
