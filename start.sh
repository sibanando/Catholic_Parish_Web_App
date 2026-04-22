#!/bin/bash
set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example and fill in your values:"
  echo "  cp .env.example .env"
  exit 1
fi

echo "Starting Catholic Parish Web App (production)..."
docker compose up --build -d
echo ""
echo "App running at http://localhost:$(grep APP_PORT .env | cut -d= -f2 | tr -d '[:space:]' || echo 80)"
echo "Run 'docker compose logs -f' to view logs."
