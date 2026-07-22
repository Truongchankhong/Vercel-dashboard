@echo off
title Quan Ly Hang Du - Ortholite Vietnam
echo Dang mo ung dung Quan Ly Hang Du...
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --ignore-certificate-errors --allow-file-access-from-files --user-data-dir="%TEMP%\edge_app_profile" --app="%~dp0dist\surplus-goods.html"
