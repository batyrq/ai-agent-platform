#!/bin/sh
# Backend container entrypoint:
#  1) apply Prisma migrations to the DB;
#  2) run the seed in the background (demo data out of the box, non-blocking);
#  3) start the server.
set -e

echo "[entrypoint] Applying Prisma migrations..."
npx prisma migrate deploy

echo "[entrypoint] Running seed in the background..."
( npm run seed || echo "[entrypoint] seed skipped/failed — not critical" ) &

echo "[entrypoint] Starting the server..."
exec node dist/src/main.js
