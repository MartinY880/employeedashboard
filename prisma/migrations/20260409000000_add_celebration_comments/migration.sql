-- CreateTable: celebration_events
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'celebration_events') THEN
    CREATE TABLE "celebration_events" (
      "id" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "event_date" DATE NOT NULL,
      "employee_name" TEXT NOT NULL,
      "detail" TEXT NOT NULL,
      "comment_count" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "celebration_events_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "celebration_events_type_email_event_date_key" ON "celebration_events"("type", "email", "event_date");
    CREATE INDEX "celebration_events_event_date_idx" ON "celebration_events"("event_date");
    ALTER TABLE "celebration_events" ADD CONSTRAINT "celebration_events_email_fkey"
      FOREIGN KEY ("email") REFERENCES "salesforce_directory"("email") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: celebration_comments
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'celebration_comments') THEN
    CREATE TABLE "celebration_comments" (
      "id" TEXT NOT NULL,
      "celebration_id" TEXT NOT NULL,
      "author_id" TEXT NOT NULL,
      "author_name" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "parent_id" TEXT,
      "likes" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "celebration_comments_pkey" PRIMARY KEY ("id")
    );
    CREATE INDEX "celebration_comments_celebration_id_created_at_idx" ON "celebration_comments"("celebration_id", "created_at");
    CREATE INDEX "celebration_comments_parent_id_idx" ON "celebration_comments"("parent_id");
    ALTER TABLE "celebration_comments" ADD CONSTRAINT "celebration_comments_celebration_id_fkey"
      FOREIGN KEY ("celebration_id") REFERENCES "celebration_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "celebration_comments" ADD CONSTRAINT "celebration_comments_author_id_fkey"
      FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    ALTER TABLE "celebration_comments" ADD CONSTRAINT "celebration_comments_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "celebration_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: celebration_comment_likes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'celebration_comment_likes') THEN
    CREATE TABLE "celebration_comment_likes" (
      "id" TEXT NOT NULL,
      "comment_id" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "celebration_comment_likes_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX "celebration_comment_likes_comment_id_user_id_key" ON "celebration_comment_likes"("comment_id", "user_id");
    CREATE INDEX "celebration_comment_likes_user_id_idx" ON "celebration_comment_likes"("user_id");
    ALTER TABLE "celebration_comment_likes" ADD CONSTRAINT "celebration_comment_likes_comment_id_fkey"
      FOREIGN KEY ("comment_id") REFERENCES "celebration_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "celebration_comment_likes" ADD CONSTRAINT "celebration_comment_likes_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
