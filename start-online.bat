@echo off
chcp 65001 >nul
title 三国杀联机服务器

echo ================================
echo   三国杀 联机模式
echo ================================
echo.
echo [1/2] 启动游戏服务器 (端口 3001)...
start "三国杀-游戏服务器" cmd /k "cd /d %~dp0server && npx tsx index.ts"

echo [2/2] 启动前端服务器 (端口 5173)...
start "三国杀-前端" cmd /k "cd /d %~dp0 && npx vite --host"

echo.
echo ================================
echo   启动完成！
echo.
echo   本机访问: http://localhost:5173
echo   局域网访问: 查看上方 vite 输出中的 Network 地址
echo   例如:      http://10.128.33.97:5173
echo ================================
echo.
echo 关闭本窗口不会影响服务器运行。
echo 要停止服务器，关闭两个命令行窗口即可。
pause
