#!/usr/bin/env sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting backend..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${BACKEND_PORT:-8001}"
