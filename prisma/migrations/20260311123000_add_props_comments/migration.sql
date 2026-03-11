-- Add props comments and props comment likes tables

CREATE TABLE IF NOT EXISTS "props_comments" (
    "id" TEXT NOT NULL,
    "propsId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "props_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "props_comments_propsId_createdAt_idx"
  ON "props_comments"("propsId", "createdAt");

CREATE INDEX IF NOT EXISTS "props_comments_parentId_idx"
  ON "props_comments"("parentId");

DO $$ BEGIN
  ALTER TABLE "props_comments"
    ADD CONSTRAINT "props_comments_propsId_fkey"
    FOREIGN KEY ("propsId") REFERENCES "kudos_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "props_comments"
    ADD CONSTRAINT "props_comments_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "props_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "props_comment_likes" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "voterLogtoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "props_comment_likes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "props_comment_likes_commentId_voterLogtoId_key"
  ON "props_comment_likes"("commentId", "voterLogtoId");

CREATE INDEX IF NOT EXISTS "props_comment_likes_voterLogtoId_idx"
  ON "props_comment_likes"("voterLogtoId");

DO $$ BEGIN
  ALTER TABLE "props_comment_likes"
    ADD CONSTRAINT "props_comment_likes_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "props_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
