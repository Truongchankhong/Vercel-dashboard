$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Green
Write-Host "     BUILDING OVN DASHBOARD DESKTOP APP" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# 1. Check Python installation
Write-Host "[1/4] Checking Python environment..." -ForegroundColor Cyan
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Found Python: $pythonVersion" -ForegroundColor Gray
} catch {
    Write-Error "Python is not installed or not in PATH! Please install Python 3.x and check the Add to PATH checkbox."
    exit 1
}

# 2. Check and install Python dependencies
Write-Host "[2/4] Installing Python dependencies (pywebview, pyinstaller, pillow)..." -ForegroundColor Cyan
pip install pywebview pyinstaller pillow

# 3. Clean and build React App (copy public to dist)
Write-Host "[3/4] Copying frontend static files (dist)..." -ForegroundColor Cyan
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}
npm run build

# 4. Packaging into a single .exe
Write-Host "[4/4] Packing into single EXE using PyInstaller..." -ForegroundColor Cyan
npm run build-desktop

Write-Host "=============================================" -ForegroundColor Green
Write-Host "SUCCESS: Executable has been generated!" -ForegroundColor Green
Write-Host "Check the release/ folder for desktop_app.exe" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
