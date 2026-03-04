@echo off
echo ============================================
echo   Supabase Masterdata Upload Tool (Filtered)
echo ============================================
echo.
echo Checking for upload file...

if exist "data\upload_masterdata.csv" (
    echo [OK] Found upload_masterdata.csv in data folder.
) else if exist "data\upload_masterdata.xlsx" (
    echo [OK] Found upload_masterdata.xlsx in data folder.
) else (
    echo [ERROR] upload_masterdata.csv or .xlsx NOT FOUND in 'data' folder.
    echo Please make sure the file is in: %cd%\data
    echo Current files in data folder:
    dir /b data\upload_masterdata.* 2>nul
    pause
    exit /b
)

echo.
echo Starting upload process...
node upload-masterdata.js
echo.
echo Process finished.
pause
