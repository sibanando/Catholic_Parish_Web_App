@echo off
echo Starting Catholic Parish Web App (Local Dev)...
cd /d "%~dp0"

echo Starting backend...
cd backend
start "Parish-Backend" cmd /c "npm run dev"
cd ..

echo Starting frontend...
cd frontend
start "Parish-Frontend" cmd /c "npm run dev"
cd ..

echo.
echo Backend starting on http://localhost:4000
echo Frontend starting on http://localhost:5173
timeout /t 6 /noisy >nul
start http://localhost:5173
