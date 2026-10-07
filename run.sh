#!/bin/bash
echo "Starting Wear-Right Development Environment..."

echo "1. Starting PostgreSQL database..."
docker compose up -d

echo "2. Starting Django Backend (apps/server)..."
cd apps/server
source venv/bin/activate
python manage.py runserver &
BACKEND_PID=$!
cd ../..

echo "3. Starting Next.js Frontend (apps/web)..."
cd apps/web
npm run dev &
FRONTEND_PID=$!
cd ../..

echo "All services started!"
echo "- Backend: http://127.0.0.1:8000"
echo "- Frontend: http://localhost:3000"
echo "Press Ctrl+C to stop."

trap "echo 'Stopping all services...'; kill $BACKEND_PID $FRONTEND_PID; docker compose stop; exit" SIGINT SIGTERM
wait
