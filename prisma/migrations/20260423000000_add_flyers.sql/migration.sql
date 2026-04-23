-- Migration: Add flyers table
-- ProConnect — Flyer model for uploaded flyer images

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'flyers') THEN
    CREATE TABLE "flyers" (
      "id"         TEXT         NOT NULL,
      "title"      TEXT         NOT NULL,
      "filename"   TEXT         NOT NULL,
      "mimeType"   TEXT         NOT NULL DEFAULT 'image/jpeg',
      "fileSize"   INTEGER      NOT NULL DEFAULT 0,
      "sortOrder"  INTEGER      NOT NULL DEFAULT 0,
      "status"     TEXT         NOT NULL DEFAULT 'active',
      "startDate"  TIMESTAMP(3),
      "endDate"    TIMESTAMP(3),
      "user_id"    TEXT,
      "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"  TIMESTAMP(3) NOT NULL,

      CONSTRAINT "flyers_pkey" PRIMARY KEY ("id")
    );

    -- Indexes
    CREATE INDEX "flyers_status_startDate_endDate_idx" ON "flyers"("status", "startDate", "endDate");
    CREATE INDEX "flyers_createdAt_idx" ON "flyers"("createdAt");

    -- FK to users
    ALTER TABLE "flyers" ADD CONSTRAINT "flyers_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;