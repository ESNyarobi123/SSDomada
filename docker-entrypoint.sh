#!/bin/sh
set -e

echo "🚀 SSDomada Container Starting..."
echo "================================"

# Wait for Postgres to be ready
if [ -n "$DATABASE_URL" ]; then
  echo "⏳ Waiting for database..."
  for i in $(seq 1 30); do
    if node -e "require('@prisma/client').PrismaClient && new (require('@prisma/client').PrismaClient)().\$queryRaw\`SELECT 1\`.then(() => process.exit(0)).catch(() => process.exit(1))" 2>/dev/null; then
      echo "✅ Database ready"
      break
    fi
    echo "  Retry $i/30..."
    sleep 2
  done

  # Run migrations using local prisma binary (avoid npx downloading wrong version)
  echo "📦 Running Prisma migrations..."
  node ./node_modules/prisma/build/index.js migrate deploy || echo "⚠️  Migration skipped (may already be applied)"
fi

echo "================================"
echo "✅ Starting SSDomada server on port ${PORT:-3000}"
exec "$@"
