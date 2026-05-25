#!/bin/sh
echo "Running database migrations..."
# Tolerant: timeout + soft-fail. Falls drizzle-kit haengt (siehe Crash-Loop am
# 2026-05-25) oder eine Migration manuell vorab via Tunnel angewendet wurde,
# soll der Container trotzdem starten. Schemastand muss bei Bedarf manuell
# geprueft werden.
if timeout 30 npx drizzle-kit migrate --config=drizzle.config.ts; then
  echo "Migrations complete."
else
  echo "Migration step failed or timed out — continuing without blocking startup."
fi

echo "Seeding users if needed..."
node scripts/seed-prod.js 2>&1 || echo "Seed skipped or failed."

echo "Starting application..."
exec node server.js
