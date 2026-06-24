-- CreateTable: training_videos
-- Stores training/Zoom recording entries managed by admins.
-- zoomUrl holds the Zoom share link; thumbnailUrl is optional.
CREATE TABLE IF NOT EXISTS "training_videos" (
    "id"            TEXT        NOT NULL,
    "title"         TEXT        NOT NULL,
    "description"   TEXT,
    "zoom_url"      TEXT        NOT NULL,
    "thumbnail_url" TEXT,
    "presenter"     TEXT,
    "category"      TEXT        NOT NULL DEFAULT 'General',
    "recorded_at"   TIMESTAMPTZ,
    "sort_order"    INTEGER     NOT NULL DEFAULT 0,
    "featured"      BOOLEAN     NOT NULL DEFAULT false,
    "active"        BOOLEAN     NOT NULL DEFAULT true,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "training_videos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_training_videos_active_sort_order"
    ON "training_videos"("active", "sort_order");

CREATE INDEX IF NOT EXISTS "idx_training_videos_category"
    ON "training_videos"("category");

CREATE INDEX IF NOT EXISTS "idx_training_videos_featured"
    ON "training_videos"("featured");
