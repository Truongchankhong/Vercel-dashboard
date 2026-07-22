@echo off
title Tien Do Hang Bu - Ortholite Vietnam
echo Dang mo ung dung Tien Do Hang Bu...
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --ignore-certificate-errors --allow-file-access-from-files --user-data-dir="%TEMP%\edge_app_profile" --app="%~dp0dist\supplement-monitor.html"
