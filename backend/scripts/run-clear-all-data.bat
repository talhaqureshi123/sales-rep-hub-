@echo off
title Clear All Data - Admin + Salesman
echo.
echo ========================================
echo   CLEAR ALL DATA (Admin + Salesman)
echo ========================================
echo.
echo Ye script ADMIN aur SALESMAN dono ka data delete karegi.
echo Users (login) safe rahenge.
echo.
set /p ok="Confirm? Type YES and press Enter: "
if /i not "%ok%"=="YES" (
  echo Cancelled.
  pause
  exit /b 0
)
cd /d "%~dp0.."
node scripts/clearAllTestData.js --confirm
echo.
pause
