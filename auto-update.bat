@echo off
REM =====================================================
REM update_and_convert.bat – Chuyển powerapp.xlsx → JSON, rồi add → commit → push
REM =====================================================

REM 1) Chuyển đến thư mục chứa file .bat (gốc project)
cd /d "%~dp0"

REM 2) Kiểm tra có folder .git hay không
if not exist ".git" (
  echo ERROR: Thư mục .git không tìm thấy.
  exit /b 1
)

REM 3) Chạy Node script để convert powerapp.xlsx → public\powerapp.json
node convert-to-json.cjs
if errorlevel 1 (
  echo !!! Lỗi khi chạy convert-to-json.cjs.
  exit /b 1
)

REM 4) Thêm toàn bộ thay đổi (bao gồm JSON mới)
git add --all
if errorlevel 1 (
  echo !!! Lỗi khi git add.
  exit /b 1
)

REM 5) Thực hiện commit với message mặc định (Auto update + timestamp)
git commit -m "Auto update on %DATE% %TIME%" 2>nul

REM 6) Push lên remote origin, branch hiện tại (HEAD)
git push origin HEAD
if errorlevel 1 (
  echo !!! Lỗi khi git push.
  exit /b 1
)

exit /b 0
