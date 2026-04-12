#!/bin/sh
echo "Running database migrations..."
npx drizzle-kit push --config=drizzle.config.ts --force 2>&1
echo "Migrations complete."

echo "Seeding users if needed..."
node scripts/seed-prod.js 2>&1 || echo "Seed skipped or failed."

echo "Starting application..."
exec node server.js
