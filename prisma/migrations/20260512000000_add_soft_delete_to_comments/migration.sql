-- Add soft-delete (deleted_at) column to all comment tables

-- props_comments
ALTER TABLE "props_comments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "props_comments_deleted_at_idx" ON "props_comments"("deleted_at");

-- idea_comments
ALTER TABLE "idea_comments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "idea_comments_deleted_at_idx" ON "idea_comments"("deleted_at");

-- video_spotlight_comments
ALTER TABLE "video_spotlight_comments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "video_spotlight_comments_deleted_at_idx" ON "video_spotlight_comments"("deleted_at");

-- celebration_comments
ALTER TABLE "celebration_comments" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "celebration_comments_deleted_at_idx" ON "celebration_comments"("deleted_at");
