@echo off
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title LuminCrypt Build

if exist "%~dp0pack.bat" (
  call "%~dp0pack.bat"
  exit /b %errorlevel%
)

echo [WARN] pack.bat not found, fallback build

for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%i"
for /f "delims=" %%i in ('where npm 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%i"
for /f "delims=" %%i in ('where npx 2^>nul') do if not defined NPX_CMD set "NPX_CMD=%%i"

if not defined NODE_EXE (echo [ERROR] Node.js not found & pause & exit /b 1)
if not defined NPM_CMD (echo [ERROR] npm not found & pause & exit /b 1)
if not defined NPX_CMD (echo [ERROR] npx not found & pause & exit /b 1)

"%NODE_EXE%" --version >nul 2>&1 || (echo [ERROR] Node.js not runnable & pause & exit /b 1)
call "%NPM_CMD%" install || (echo [ERROR] npm install failed & pause & exit /b 1)
call "%NPM_CMD%" run build:python || (echo [ERROR] build:python failed & pause & exit /b 1)
call "%NPM_CMD%" run build || (echo [ERROR] npm run build failed & pause & exit /b 1)
call "%NPX_CMD%" electron-builder --win || (echo [ERROR] electron-builder failed & pause & exit /b 1)

echo Build finished
pause
exit /b 0
