-- CreateTable: video_spotlights
CREATE TABLE IF NOT EXISTS "video_spotlights" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'video/webm',
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "duration" DOUBLE PRECISION,
    "authorId" TEXT,
    "authorName" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_spotlights_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "video_spotlights_featured_status_idx"
  ON "video_spotlights"("featured", "status");

CREATE INDEX IF NOT EXISTS "video_spotlights_createdAt_idx"
  ON "video_spotlights"("createdAt");
