@echo off
setlocal
chcp 65001 >nul 2>&1

cd /d "%~dp0"
title LuminCrypt Pack

echo.
echo ============================================
echo LuminCrypt one-click pack script
echo Electron and Python to installer
echo ============================================
echo.

set "START_TIME=%TIME%"

echo [1/5] Check environment
echo.

for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%i"
if not defined NODE_EXE (
  echo [ERROR] Node.js not found
  goto :fail
)
"%NODE_EXE%" --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found
  goto :fail
)
for /f "delims=" %%v in ('"%NODE_EXE%" --version') do echo Node %%v

for /f "delims=" %%i in ('where npm 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%i"
if not defined NPM_CMD (
  echo [ERROR] npm not found
  goto :fail
)
call "%NPM_CMD%" --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm not found
  goto :fail
)
for /f "delims=" %%v in ('call "%NPM_CMD%" --version') do echo npm %%v

for /f "delims=" %%i in ('where python 2^>nul') do if not defined PYTHON_EXE set "PYTHON_EXE=%%i"
if not defined PYTHON_EXE (
  echo [ERROR] Python not found
  goto :fail
)
"%PYTHON_EXE%" --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found
  goto :fail
)
for /f "delims=" %%v in ('"%PYTHON_EXE%" --version 2^>^&1') do echo %%v

echo.
echo [2/5] Install npm deps
call "%NPM_CMD%" install
if errorlevel 1 (
  echo [ERROR] npm install failed
  goto :fail
)

echo.
echo [3/5] Build Python engine
call "%NPM_CMD%" run build:python
if errorlevel 1 (
  echo [ERROR] build:python failed
  goto :fail
)
if exist "resources\bin\bwm_helper.exe" (
  echo [OK] resources\bin\bwm_helper.exe
) else (
  echo [WARN] bwm_helper.exe not found, continue
)

echo.
echo [4/5] Build frontend
call "%NPM_CMD%" run build
if errorlevel 1 (
  echo [ERROR] npm run build failed
  goto :fail
)

echo.
echo [5/5] Package Windows app
for /f "delims=" %%i in ('where npx 2^>nul') do if not defined NPX_CMD set "NPX_CMD=%%i"
if not defined NPX_CMD (
  echo [ERROR] npx not found
  goto :fail
)
call "%NPX_CMD%" electron-builder --win
if errorlevel 1 (
  echo [ERROR] electron-builder failed
  goto :fail
)

echo.
echo ============================================
echo PACK SUCCESS
echo ============================================
echo.

if exist "dist\LuminCrypt-*-setup.exe" echo setup: dist\LuminCrypt-*-setup.exe
if exist "dist\LuminCrypt-*-portable.exe" echo portable: dist\LuminCrypt-*-portable.exe
if exist "dist\latest.yml" echo update config: dist\latest.yml

echo.
pause
exit /b 0

:fail
echo.
echo ============================================
echo PACK FAILED
echo ============================================
echo.
pause
exit /b 1
