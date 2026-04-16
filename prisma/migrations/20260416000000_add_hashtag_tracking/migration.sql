-- CreateEnum: CommentType
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommentType') THEN
    CREATE TYPE "CommentType" AS ENUM ('PROPS', 'IDEA', 'VIDEO', 'MYSHARE', 'CELEBRATION');
  END IF;
END $$;

-- CreateTable: hashtags
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hashtags') THEN
    CREATE TABLE "hashtags" (
      "id" TEXT NOT NULL,
      "tag" TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "hashtags_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "hashtags_tag_key" ON "hashtags"("tag");
  END IF;
END $$;

-- CreateTable: comment_hashtags
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comment_hashtags') THEN
    CREATE TABLE "comment_hashtags" (
      "id" TEXT NOT NULL,
      "hashtag_id" TEXT NOT NULL,
      "comment_id" TEXT NOT NULL,
      "comment_type" "CommentType" NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "comment_hashtags_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "comment_hashtags_hashtag_id_comment_id_comment_type_key" ON "comment_hashtags"("hashtag_id", "comment_id", "comment_type");
    CREATE INDEX "comment_hashtags_hashtag_id_idx" ON "comment_hashtags"("hashtag_id");
    CREATE INDEX "comment_hashtags_comment_id_comment_type_idx" ON "comment_hashtags"("comment_id", "comment_type");
    ALTER TABLE "comment_hashtags" ADD CONSTRAINT "comment_hashtags_hashtag_id_fkey"
      FOREIGN KEY ("hashtag_id") REFERENCES "hashtags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
