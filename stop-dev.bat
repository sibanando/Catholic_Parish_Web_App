@echo off
echo Stopping Catholic Parish Web App (Local Dev)...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000.*LISTENING"') do (
    echo Stopping backend (PID %%a)...
    taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173.*LISTENING"') do (
    echo Stopping frontend (PID %%a)...
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo All services stopped.
