#!/bin/bash
echo "Stopping Catholic Parish Web App (Local Dev)..."

# Stop backend (port 4000)
PID=$(lsof -ti:4000 2>/dev/null)
if [ -n "$PID" ]; then
  echo "Stopping backend (PID $PID)..."
  kill -TERM $PID
fi

# Stop frontend (port 5173)
PID=$(lsof -ti:5173 2>/dev/null)
if [ -n "$PID" ]; then
  echo "Stopping frontend (PID $PID)..."
  kill -TERM $PID
fi

# Stop PostgreSQL container
echo "Stopping database container..."
if docker ps --format '{{.Names}}' | grep -q '^parish-postgres$'; then
  docker stop parish-postgres
  echo "  parish-postgres stopped."
else
  echo "  parish-postgres not running."
fi

echo "All services stopped."
