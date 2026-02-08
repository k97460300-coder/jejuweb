@echo off
echo ====================================
echo 济州岛旅游网站 本地服务器
echo ====================================
echo.
echo 正在启动本地服务器...
echo 服务器地址: http://localhost:8000
echo.
echo 按 Ctrl+C 停止服务器
echo ====================================
echo.

cd /d "%~dp0"
python -m http.server 8000 2>nul || (
    echo Python未安装或不在PATH中
    echo.
    echo 请使用以下方法之一:
    echo 1. 安装Python: https://www.python.org/downloads/
    echo 2. 使用其他浏览器扩展运行本地服务器
    echo 3. 将文件上传到网络服务器
    pause
)
