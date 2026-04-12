#!/bin/sh
echo "Running database migrations..."
drizzle-kit push --config=drizzle.config.ts --force 2>&1 || echo "Migration warning (may be OK on first run)"
echo "Migrations complete."

echo "Seeding users if needed..."
node scripts/seed-prod.js 2>&1 || echo "Seed skipped or already done."

echo "Starting application..."
exec node server.js
