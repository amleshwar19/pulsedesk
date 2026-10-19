#!/bin/sh
set -eu

export DATABASE_PATH="${DATABASE_PATH:-/app/data/pulsedesk.db}"
mkdir -p "$(dirname "$DATABASE_PATH")"

echo "Initializing PulseDesk database..."
node /app/scripts/init-db.cjs

echo "Starting PulseDesk on port ${PORT:-3000}..."
exec node server.js
