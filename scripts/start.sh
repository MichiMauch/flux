#!/bin/sh
set -e
echo "Running database migrations..."
npx drizzle-kit migrate --config=drizzle.config.ts
echo "Migrations complete."
set +e

echo "Seeding users if needed..."
node scripts/seed-prod.js 2>&1 || echo "Seed skipped or failed."

echo "Starting application..."
exec node server.js
