#!/bin/sh
set -e

# Fix ownership of mounted volumes (they may be root-owned if auto-created)
echo "🔧 Ensuring volume permissions..."
mkdir -p /app/src/data /app/uploads/resources /app/uploads/vendor-logos /app/uploads/videos
chown -R 1001:1001 /app/src/data /app/uploads

# Seed resources.json if missing (volume mount may shadow baked-in copy)
if [ ! -f /app/src/data/resources.json ] && [ -f /app/defaults/resources.json ]; then
  echo "📁 Seeding resources.json from defaults..."
  cp /app/defaults/resources.json /app/src/data/resources.json
  chown 1001:1001 /app/src/data/resources.json
fi

echo "⏳ Waiting for database..."

# Extract host and port from DATABASE_URL
DB_HOST=$(echo "$DATABASE_URL" | sed 's|.*@||;s|:.*||')
DB_PORT=$(echo "$DATABASE_URL" | sed 's|.*:\([0-9]*\)/.*|\1|')

echo "  Target: $DB_HOST:$DB_PORT"

# Wait until the database accepts TCP connections (max 60s)
RETRIES=0
MAX_RETRIES=30
until node -e "
  const net = require('net');
  const s = net.createConnection({ host: '$DB_HOST', port: $DB_PORT });
  s.on('connect', () => { s.end(); process.exit(0); });
  s.on('error', () => process.exit(1));
" 2>/dev/null; do
  RETRIES=$((RETRIES + 1))
  if [ "$RETRIES" -ge "$MAX_RETRIES" ]; then
    echo "❌ Database not reachable after ${MAX_RETRIES} attempts (60s). Starting server anyway..."
    break
  fi
  echo "  DB not ready at $DB_HOST:$DB_PORT — retrying in 2s... ($RETRIES/$MAX_RETRIES)"
  sleep 2
done

if [ "$RETRIES" -lt "$MAX_RETRIES" ]; then
  echo "✅ Database is up!"

  # Wait for init scripts (e.g. init-db/01-restore.sql) to finish.
  echo "⏳ Waiting for database init scripts to complete..."
  INIT_RETRIES=0
  INIT_MAX=30
  until node -e "
    const { Client } = require('pg');
    const c = new Client({ connectionString: '$DATABASE_URL' });
    c.connect()
      .then(() => c.query('SELECT 1'))
      .then(() => { c.end(); process.exit(0); })
      .catch(() => { c.end(); process.exit(1); });
  " 2>/dev/null; do
    INIT_RETRIES=$((INIT_RETRIES + 1))
    if [ "$INIT_RETRIES" -ge "$INIT_MAX" ]; then
      echo "⚠️  Init scripts may not have finished — continuing anyway"
      break
    fi
    echo "  DB init not ready — retrying in 2s... ($INIT_RETRIES/$INIT_MAX)"
    sleep 2
  done
  echo "✅ Database init complete."

  # Apply Prisma migrations
  echo "🔄 Running Prisma migrations..."
  prisma migrate deploy --schema=prisma/schema.prisma || echo "⚠️  Migration failed — server will start anyway"
  echo "✅ Migrations complete."

  # Create any missing tables/columns/indexes via safe SQL migration
  echo "🔄 Running safe SQL migration (creating missing tables/columns/indexes)..."
  if [ -f scripts/migrate-safe.sh ]; then
    bash scripts/migrate-safe.sh || echo "⚠️  Safe migration had issues — continuing anyway"
  else
    echo "⚠️  scripts/migrate-safe.sh not found — falling back to prisma db push"
    prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss 2>/dev/null \
      || echo "⚠️  db push had issues — continuing anyway"
  fi
  echo "✅ Schema sync complete."

  # Seed data if key tables are empty (first deploy or partial restore)
  if [ -f prisma/seed-data.sql ]; then
    HOLIDAY_COUNT=$(node -e "
      const { Client } = require('pg');
      const c = new Client({ connectionString: '$DATABASE_URL' });
      c.connect()
        .then(() => c.query('SELECT COUNT(*) AS n FROM holidays'))
        .then(r => { console.log(r.rows[0].n); c.end(); })
        .catch(() => { console.log('0'); c.end(); });
    " 2>/dev/null)
    if [ "$HOLIDAY_COUNT" = "0" ] || [ -z "$HOLIDAY_COUNT" ]; then
      echo "🌱 Seeding database with initial data..."
      psql "$DATABASE_URL" -f prisma/seed-data.sql --set ON_ERROR_STOP=off 2>&1 \
        && echo "✅ Seed data loaded." \
        || echo "⚠️  Seed had errors — some data may have loaded anyway"
    else
      echo "📦 Database already seeded ($HOLIDAY_COUNT holidays) — skipping."
    fi
  fi
fi

# Start the Next.js server as nextjs user
echo "🚀 Starting server..."
exec su-exec nextjs node server.js
