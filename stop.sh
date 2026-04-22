#!/bin/bash
echo "Stopping Catholic Parish Web App (Docker Compose)..."
cd "$(dirname "$0")"
docker compose down
echo "All services stopped."
