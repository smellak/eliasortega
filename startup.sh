#!/bin/sh
# Startup script: ensures all migrations are applied, seeds, then starts the app.
# All custom migrations use IF NOT EXISTS / DROP IF EXISTS idioms, so they're safe to re-execute.

echo '[startup] Resolving baseline migrations...'
npx prisma migrate resolve --applied 20251028223225_init 2>/dev/null || true
npx prisma migrate resolve --applied 20251029000000_full_schema 2>/dev/null || true

echo '[startup] Executing idempotent migration SQL files...'
for migration in \
  20260224000000_add_slot_override_source \
  20260224100000_add_slot_override_date_range \
  20260225000000_add_estimated_fields_to_appointment \
  20260226000000_add_confirmation_system \
  20260227000000_add_dock_system
do
  echo "[migrate] Running $migration..."
  npx prisma db execute --file "./prisma/migrations/$migration/migration.sql" 2>&1 || echo "[warn] $migration had errors (may be OK if already applied)"
  npx prisma migrate resolve --applied "$migration" 2>/dev/null || true
done

echo '[startup] Running prisma migrate deploy...'
npx prisma migrate deploy

echo '[startup] Running seed...'
node seed-production.cjs || echo '[warn] Seed failed, continuing...'

echo '[startup] Starting application...'
exec node dist/index.js
