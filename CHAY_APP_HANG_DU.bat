@echo off
title Quan Ly Hang Du - Ortholite Vietnam
echo Dang mo ung dung Quan Ly Hang Du (Offline Local)...
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --ignore-certificate-errors --allow-file-access-from-files --disable-web-security --user-data-dir="%TEMP%\edge_app_profile" --app="%~dp0dist\surplus-goods.html"
