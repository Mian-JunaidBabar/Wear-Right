#!/bin/bash
# Starts Postgres, Django (8000) and Next.js (3000). Same as `make dev`.
set -e
cd "$(dirname "$0")"

echo "Starting Wear Right..."

echo "1. PostgreSQL (docker)"
docker compose up -d --wait

echo "2. Django backend (apps/server) on :8000"
apps/server/venv/bin/python apps/server/manage.py runserver 8000 &
BACKEND_PID=$!

echo "3. Next.js frontend (apps/web) on :3000"
npm --prefix apps/web run dev &
FRONTEND_PID=$!

echo "- Frontend: http://localhost:3000"
echo "- Backend:  http://127.0.0.1:8000 (the browser reaches it through the :3000 rewrite)"
echo "Press Ctrl+C to stop."

trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker compose stop; exit" SIGINT SIGTERM
wait
