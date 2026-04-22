@echo off
echo Stopping Catholic Parish Web App (Docker Compose)...
cd /d "%~dp0"
docker compose down
echo.
echo All services stopped.
