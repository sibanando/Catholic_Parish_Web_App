@echo off
echo Starting Catholic Parish Web App (Docker Compose)...
cd /d "%~dp0"
docker compose up --build -d
echo.
echo All services starting. App will be available at http://localhost:5173
echo Run 'docker compose logs -f' to view logs.
timeout /t 6 /noisy >nul
start http://localhost:5173
