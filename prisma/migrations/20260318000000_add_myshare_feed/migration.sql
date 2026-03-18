-- CreateTable: myshare_posts
CREATE TABLE IF NOT EXISTS "myshare_posts" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "myshare_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: myshare_media
CREATE TABLE IF NOT EXISTS "myshare_media" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "myshare_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable: myshare_likes
CREATE TABLE IF NOT EXISTS "myshare_likes" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "myshare_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: myshare_comments
CREATE TABLE IF NOT EXISTS "myshare_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "myshare_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: myshare_comment_likes
CREATE TABLE IF NOT EXISTS "myshare_comment_likes" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "myshare_comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "myshare_posts_authorId_idx" ON "myshare_posts"("authorId");
CREATE INDEX IF NOT EXISTS "myshare_posts_createdAt_idx" ON "myshare_posts"("createdAt");
CREATE INDEX IF NOT EXISTS "myshare_posts_deleted_at_idx" ON "myshare_posts"("deleted_at");

CREATE INDEX IF NOT EXISTS "myshare_media_postId_sortOrder_idx" ON "myshare_media"("postId", "sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "myshare_likes_postId_userId_key" ON "myshare_likes"("postId", "userId");

CREATE INDEX IF NOT EXISTS "myshare_comments_postId_createdAt_idx" ON "myshare_comments"("postId", "createdAt");
CREATE INDEX IF NOT EXISTS "myshare_comments_parentId_idx" ON "myshare_comments"("parentId");
CREATE INDEX IF NOT EXISTS "myshare_comments_deleted_at_idx" ON "myshare_comments"("deleted_at");

CREATE UNIQUE INDEX IF NOT EXISTS "myshare_comment_likes_commentId_userId_key" ON "myshare_comment_likes"("commentId", "userId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'myshare_posts_authorId_fkey') THEN
    ALTER TABLE "myshare_posts" ADD CONSTRAINT "myshare_posts_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'myshare_media_postId_fkey') THEN
    ALTER TABLE "myshare_media" ADD CONSTRAINT "myshare_media_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "myshare_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'myshare_likes_postId_fkey') THEN
    ALTER TABLE "myshare_likes" ADD CONSTRAINT "myshare_likes_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "myshare_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'myshare_likes_userId_fkey') THEN
    ALTER TABLE "myshare_likes" ADD CONSTRAINT "myshare_likes_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'myshare_comments_postId_fkey') THEN
    ALTER TABLE "myshare_comments" ADD CONSTRAINT "myshare_comments_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "myshare_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'myshare_comments_authorId_fkey') THEN
    ALTER TABLE "myshare_comments" ADD CONSTRAINT "myshare_comments_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'myshare_comments_parentId_fkey') THEN
    ALTER TABLE "myshare_comments" ADD CONSTRAINT "myshare_comments_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "myshare_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'myshare_comment_likes_commentId_fkey') THEN
    ALTER TABLE "myshare_comment_likes" ADD CONSTRAINT "myshare_comment_likes_commentId_fkey"
      FOREIGN KEY ("commentId") REFERENCES "myshare_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'myshare_comment_likes_userId_fkey') THEN
    ALTER TABLE "myshare_comment_likes" ADD CONSTRAINT "myshare_comment_likes_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
