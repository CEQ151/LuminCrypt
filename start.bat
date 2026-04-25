@echo off
chcp 65001 >nul
title LuminCrypt - 启动器

:menu
cls
echo.
echo  ============================================
echo     LuminCrypt — 一键启动
echo  ============================================
echo.
echo  请选择启动模式：
echo.
echo   [1] 开发模式  (热重载，适合编码调试)
echo   [2] 预览模式  (运行已构建的版本)
echo   [3] 退出
echo.
set /p choice="请输入选项 (1/2/3): "

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto preview
if "%choice%"=="3" exit /b 0
goto menu

:dev
cls
echo.
echo  ============================================
echo   启动开发模式...
echo  ============================================
echo.
echo  [检查] 验证 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo  [错误] 未找到 Node.js，请先安装 Node.js 18+
    pause
    goto menu
)
for /f "tokens=*" %%v in ('node --version') do echo   Node.js %%v

echo.
echo  [检查] 验证 node_modules...
if not exist "node_modules\" (
    echo   node_modules 不存在，正在安装依赖...
    call npm install
    if errorlevel 1 (
        echo  [错误] 依赖安装失败！
        pause
        goto menu
    )
    echo  依赖安装完成
)

echo.
echo  [启动] electron-vite dev...
echo  提示: 首次启动可能较慢，请稍候...
echo  按 Ctrl+C 停止服务
echo.
call npm run dev
if errorlevel 1 (
    echo  [错误] 开发服务启动失败
    pause
)
goto menu

:preview
cls
echo.
echo  ============================================
echo   启动预览模式
echo  ============================================
echo.
echo  [检查] 验证构建产物...
if not exist "out\" (
    echo  未发现编译产物，正在构建...
    call npm run build
    if errorlevel 1 (
        echo  [错误] 构建失败！
        pause
        goto menu
    )
    echo  构建完成
)

echo.
echo  [启动] electron-vite preview...
echo  按 Ctrl+C 停止
echo.
call npm run start
if errorlevel 1 (
    echo  [错误] 预览启动失败
    pause
)
goto menu
