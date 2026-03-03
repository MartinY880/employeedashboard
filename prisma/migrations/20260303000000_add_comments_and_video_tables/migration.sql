-- Add idea comments, idea comment likes, video spotlight tables,
-- video spotlight reactions/comments/comment-likes, important dates,
-- and playCount column on video_spotlights.

-- ─── idea_comments ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "idea_comments" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idea_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idea_comments_ideaId_createdAt_idx"
  ON "idea_comments"("ideaId", "createdAt");

CREATE INDEX IF NOT EXISTS "idea_comments_parentId_idx"
  ON "idea_comments"("parentId");

DO $$ BEGIN
  ALTER TABLE "idea_comments"
    ADD CONSTRAINT "idea_comments_ideaId_fkey"
    FOREIGN KEY ("ideaId") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "idea_comments"
    ADD CONSTRAINT "idea_comments_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "idea_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── idea_comment_likes ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "idea_comment_likes" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "voterLogtoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idea_comment_likes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "idea_comment_likes_commentId_voterLogtoId_key"
  ON "idea_comment_likes"("commentId", "voterLogtoId");

CREATE INDEX IF NOT EXISTS "idea_comment_likes_voterLogtoId_idx"
  ON "idea_comment_likes"("voterLogtoId");

DO $$ BEGIN
  ALTER TABLE "idea_comment_likes"
    ADD CONSTRAINT "idea_comment_likes_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "idea_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── video_spotlights (ensure playCount column) ─────────
DO $$ BEGIN
  ALTER TABLE "video_spotlights" ADD COLUMN "playCount" INTEGER NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- ─── video_spotlight_reactions ───────────────────────────
CREATE TABLE IF NOT EXISTS "video_spotlight_reactions" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userLogtoId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_spotlight_reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "video_spotlight_reactions_videoId_userLogtoId_key"
  ON "video_spotlight_reactions"("videoId", "userLogtoId");

CREATE INDEX IF NOT EXISTS "video_spotlight_reactions_videoId_idx"
  ON "video_spotlight_reactions"("videoId");

DO $$ BEGIN
  ALTER TABLE "video_spotlight_reactions"
    ADD CONSTRAINT "video_spotlight_reactions_videoId_fkey"
    FOREIGN KEY ("videoId") REFERENCES "video_spotlights"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── video_spotlight_comments ────────────────────────────
CREATE TABLE IF NOT EXISTS "video_spotlight_comments" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_spotlight_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "video_spotlight_comments_videoId_createdAt_idx"
  ON "video_spotlight_comments"("videoId", "createdAt");

CREATE INDEX IF NOT EXISTS "video_spotlight_comments_parentId_idx"
  ON "video_spotlight_comments"("parentId");

DO $$ BEGIN
  ALTER TABLE "video_spotlight_comments"
    ADD CONSTRAINT "video_spotlight_comments_videoId_fkey"
    FOREIGN KEY ("videoId") REFERENCES "video_spotlights"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "video_spotlight_comments"
    ADD CONSTRAINT "video_spotlight_comments_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "video_spotlight_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── video_spotlight_comment_likes ───────────────────────
CREATE TABLE IF NOT EXISTS "video_spotlight_comment_likes" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "voterLogtoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_spotlight_comment_likes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "video_spotlight_comment_likes_commentId_voterLogtoId_key"
  ON "video_spotlight_comment_likes"("commentId", "voterLogtoId");

CREATE INDEX IF NOT EXISTS "video_spotlight_comment_likes_voterLogtoId_idx"
  ON "video_spotlight_comment_likes"("voterLogtoId");

DO $$ BEGIN
  ALTER TABLE "video_spotlight_comment_likes"
    ADD CONSTRAINT "video_spotlight_comment_likes_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "video_spotlight_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── important_dates ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "important_dates" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "recurType" TEXT NOT NULL DEFAULT 'none',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "important_dates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "important_dates_active_date_idx"
  ON "important_dates"("active", "date");

CREATE INDEX IF NOT EXISTS "important_dates_sortOrder_idx"
  ON "important_dates"("sortOrder");

-- ─── Add NotificationType values if missing ──────────────
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'IDEA_IN_PROGRESS';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'IDEA_COMPLETED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── preferred_vendors: add labels column ────────────────
DO $$ BEGIN
  ALTER TABLE "preferred_vendors" ADD COLUMN "labels" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
