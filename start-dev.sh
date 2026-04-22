#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "Starting Catholic Parish Web App (development)..."
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
echo ""
echo "Backend  → http://localhost:4000"
echo "Frontend → http://localhost:5173"
echo "Run 'docker compose logs -f' to view logs."
