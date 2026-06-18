@echo off
title Fox Games Market Kashier
echo ======================================
echo Fox Games Market - Kashier Test Mode
echo ======================================
echo.
echo Checking Node.js...
node -v >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed.
  echo Please install Node.js from https://nodejs.org then run this file again.
  pause
  exit /b
)
echo.
echo Installing packages...
call npm install
echo.
echo Starting website...
echo Open this link in your browser:
echo http://localhost:9000
echo.
call npm start
pause
