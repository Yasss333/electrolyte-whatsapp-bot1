@echo off
echo ========================================
echo  Electrolyte Bot - Starting...
echo ========================================
echo.

:: Change to the script's directory
cd /d "%~dp0"

:: Start Docker Compose
docker-compose up -d

echo.
echo Bot is running at: http://localhost:5173
echo.

:: Wait a moment and open browser
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo Press any key to close this window...
pause >nul