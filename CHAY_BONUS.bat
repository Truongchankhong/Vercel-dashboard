@echo off
title Bang Bac Thuong San Luong - Ortholite Vietnam
echo Dang mo trang Bac Thuong San Luong (Bonus)...
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --ignore-certificate-errors --allow-file-access-from-files --user-data-dir="%TEMP%\edge_app_profile" --app="%~dp0dist\bonus.html"
