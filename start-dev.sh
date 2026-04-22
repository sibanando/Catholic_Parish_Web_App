#!/bin/bash
echo "Starting Catholic Parish Web App (Local Dev)..."
cd "$(dirname "$0")"

# Start PostgreSQL container
echo "Starting database container..."
if docker ps --format '{{.Names}}' | grep -q '^parish-postgres$'; then
  echo "  parish-postgres already running."
else
  docker start parish-postgres 2>/dev/null || docker run -d \
    --name parish-postgres \
    -e POSTGRES_PASSWORD=parish1234 \
    -e POSTGRES_DB=parish_db \
    -e POSTGRES_USER=postgres \
    -p 5432:5432 \
    -v parish_data:/var/lib/postgresql/data \
    postgres:15
  echo "  Database started."
fi

echo "Starting backend..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

echo "Starting frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "Backend  → http://localhost:4000  (PID $BACKEND_PID)"
echo "Frontend → http://localhost:5173  (PID $FRONTEND_PID)"
