#!/bin/sh
set -e

echo "🚀 SSDomada Container Starting..."
echo "================================"

# Wait for Postgres to be ready
if [ -n "$DATABASE_URL" ]; then
  echo "⏳ Waiting for database..."
  DB_OK=0
  for i in $(seq 1 30); do
    if node -e "require('@prisma/client').PrismaClient && new (require('@prisma/client').PrismaClient)().\$queryRaw\`SELECT 1\`.then(() => process.exit(0)).catch(() => process.exit(1))" 2>/dev/null; then
      echo "✅ Database ready"
      DB_OK=1
      break
    fi
    echo "  Retry $i/30..."
    sleep 2
  done
  if [ "$DB_OK" != "1" ]; then
    echo "❌ Database not reachable after 60s"
    exit 1
  fi

  echo "📦 Running Prisma migrations..."
  prisma migrate deploy
fi

echo "================================"
echo "✅ Starting SSDomada server on port ${PORT:-3000}"
exec "$@"
