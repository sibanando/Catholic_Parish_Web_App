#!/bin/bash
echo "Starting Catholic Parish Web App (Docker Compose)..."
cd "$(dirname "$0")"
docker compose up --build -d
echo ""
echo "All services starting. App will be available at http://localhost:5173"
echo "Run 'docker compose logs -f' to view logs."
