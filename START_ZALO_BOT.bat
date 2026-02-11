@echo off
chcp 65001 > nul
echo [KIEM TRA MOI TRUONG] Dang kiem tra Node.js...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Ban chua cai dat Node.js!
    echo [ACTION] He thong dang mo file cai dat Node.js cho ban...
    echo.
    echo Vui long bam Next lien tuc de cai dat, sau do chay lai file nay.
    
    if exist "node-installer.msi" (
        start /wait node-installer.msi
    ) else (
        echo Khong tim thay file cai dat. Dang tai ve...
        powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' -OutFile 'node-installer.msi'"
        start /wait node-installer.msi
    )
    
    echo.
    echo Sau khi cai dat xong, vui long tat cua so nay va chay lai.
    pause
    exit /b
)

echo [OK] Da tim thay Node.js.
echo [ACTION] Dang cai dat thu vien can thiet...
call npm install puppeteer @google/generative-ai @supabase/supabase-js

echo.
echo [START] Dang khoi dong Zalo Bot...
node zalo-bot.js

pause
