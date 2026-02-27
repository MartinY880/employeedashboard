-- Add missing enums, tables, columns, and indexes
-- that exist in the Prisma schema but were not in prior migrations.

-- ─── Enums ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "VoteDirection" AS ENUM ('UP', 'DOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationType" AS ENUM ('KUDOS', 'HIGHLIGHT', 'IDEA_SELECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── alerts.expires_at ───────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "alerts" ADD COLUMN "expires_at" TIMESTAMP(3);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "alerts_expires_at_idx" ON "alerts"("expires_at");

-- ─── site_branding.dark_logo_data ────────────────────────
DO $$ BEGIN
  ALTER TABLE "site_branding" ADD COLUMN "dark_logo_data" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ─── idea_votes ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "idea_votes" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "voterLogtoId" TEXT NOT NULL,
    "direction" "VoteDirection" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idea_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "idea_votes_ideaId_voterLogtoId_key"
  ON "idea_votes"("ideaId", "voterLogtoId");

CREATE INDEX IF NOT EXISTS "idea_votes_voterLogtoId_idx"
  ON "idea_votes"("voterLogtoId");

DO $$ BEGIN
  ALTER TABLE "idea_votes"
    ADD CONSTRAINT "idea_votes_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── notifications ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notifications_userId_read_createdAt_idx"
  ON "notifications"("userId", "read", "createdAt");

CREATE INDEX IF NOT EXISTS "notifications_createdAt_idx"
  ON "notifications"("createdAt");

DO $$ BEGIN
  ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── holidays ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "holidays" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#06427F',
    "source" TEXT NOT NULL DEFAULT 'custom',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "holidays_date_idx" ON "holidays"("date");
CREATE INDEX IF NOT EXISTS "holidays_category_idx" ON "holidays"("category");
CREATE INDEX IF NOT EXISTS "holidays_visible_idx" ON "holidays"("visible");

-- ─── calendar_sync_logs ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "calendar_sync_logs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "calendar_sync_logs_syncedAt_idx"
  ON "calendar_sync_logs"("syncedAt");

-- ─── calendar_settings ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "calendar_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "data" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_settings_pkey" PRIMARY KEY ("id")
);
