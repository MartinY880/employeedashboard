-- Add ON DELETE CASCADE to all User FK relations (previously RESTRICT)
-- VideoSpotlight.authorId already has ON DELETE SET NULL (correct for optional FK)
-- Notifications and PropsReactions already have ON DELETE CASCADE (no change needed)
-- All DROPs use IF EXISTS for safety across environments with different constraint names
--
-- IMPORTANT: Some tables had NOT VALID FKs (never enforced on existing rows),
-- so orphaned rows may exist. We DELETE orphans before adding validated FKs.

-- ============================================================
-- Clean up orphaned rows (user_id references that don't exist in users)
-- ============================================================

DELETE FROM "props_comment_likes" WHERE "user_id" NOT IN (SELECT id FROM "users");
DELETE FROM "props_comments" WHERE "user_id" NOT IN (SELECT id FROM "users");
DELETE FROM "idea_comment_likes" WHERE "user_id" NOT IN (SELECT id FROM "users");
DELETE FROM "idea_comments" WHERE "user_id" NOT IN (SELECT id FROM "users");
DELETE FROM "idea_votes" WHERE "user_id" NOT IN (SELECT id FROM "users");
DELETE FROM "ideas" WHERE "user_id" NOT IN (SELECT id FROM "users");
DELETE FROM "video_spotlight_comment_likes" WHERE "user_id" NOT IN (SELECT id FROM "users");
DELETE FROM "video_spotlight_comments" WHERE "user_id" NOT IN (SELECT id FROM "users");
DELETE FROM "video_spotlight_reactions" WHERE "user_id" NOT IN (SELECT id FROM "users");
DELETE FROM "myshare_comment_likes" WHERE "userId" NOT IN (SELECT id FROM "users");
DELETE FROM "myshare_comments" WHERE "authorId" NOT IN (SELECT id FROM "users");
DELETE FROM "myshare_likes" WHERE "userId" NOT IN (SELECT id FROM "users");
DELETE FROM "myshare_posts" WHERE "authorId" NOT IN (SELECT id FROM "users");
DELETE FROM "celebration_comment_likes" WHERE "user_id" NOT IN (SELECT id FROM "users");
DELETE FROM "celebration_comments" WHERE "author_id" NOT IN (SELECT id FROM "users");
DELETE FROM "celebration_likes" WHERE "user_id" NOT IN (SELECT id FROM "users");
DELETE FROM "props_reactions" WHERE "user_id" NOT IN (SELECT id FROM "users");
DELETE FROM "props_messages" WHERE "user_id" NOT IN (SELECT id FROM "users");
DELETE FROM "props_messages" WHERE "recipient_id" NOT IN (SELECT id FROM "users");
DELETE FROM "alerts" WHERE "createdBy" NOT IN (SELECT id FROM "users");
DELETE FROM "notifications" WHERE "userId" NOT IN (SELECT id FROM "users");

-- ============================================================
-- Drop duplicate legacy "highlight_*" FK constraints (leftovers from table rename)
-- ============================================================

ALTER TABLE "myshare_comment_likes" DROP CONSTRAINT IF EXISTS "highlight_comment_likes_userId_fkey";
ALTER TABLE "myshare_comments" DROP CONSTRAINT IF EXISTS "highlight_comments_authorId_fkey";
ALTER TABLE "myshare_likes" DROP CONSTRAINT IF EXISTS "highlight_likes_userId_fkey";
ALTER TABLE "myshare_posts" DROP CONSTRAINT IF EXISTS "highlight_posts_authorId_fkey";

-- ============================================================
-- Props Messages
-- ============================================================

ALTER TABLE "props_messages" DROP CONSTRAINT IF EXISTS "props_messages_user_id_fkey";
ALTER TABLE "props_messages" DROP CONSTRAINT IF EXISTS "props_messages_authorId_fkey";
ALTER TABLE "props_messages" DROP CONSTRAINT IF EXISTS "kudos_messages_authorId_fkey";
ALTER TABLE "props_messages" ADD CONSTRAINT "props_messages_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "props_messages" DROP CONSTRAINT IF EXISTS "props_messages_recipient_id_fkey";
ALTER TABLE "props_messages" DROP CONSTRAINT IF EXISTS "props_messages_recipientId_fkey";
ALTER TABLE "props_messages" DROP CONSTRAINT IF EXISTS "kudos_messages_recipientId_fkey";
ALTER TABLE "props_messages" ADD CONSTRAINT "props_messages_recipient_id_fkey"
  FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Props Comments & Likes
-- ============================================================

ALTER TABLE "props_comments" DROP CONSTRAINT IF EXISTS "props_comments_user_id_fkey";
ALTER TABLE "props_comments" DROP CONSTRAINT IF EXISTS "props_comments_authorId_fkey";
ALTER TABLE "props_comments" ADD CONSTRAINT "props_comments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "props_comment_likes" DROP CONSTRAINT IF EXISTS "props_comment_likes_user_id_fkey";
ALTER TABLE "props_comment_likes" DROP CONSTRAINT IF EXISTS "props_comment_likes_userId_fkey";
ALTER TABLE "props_comment_likes" ADD CONSTRAINT "props_comment_likes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Alerts
-- ============================================================

ALTER TABLE "alerts" DROP CONSTRAINT IF EXISTS "alerts_createdBy_fkey";
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Ideas, Votes, Comments, Comment Likes
-- ============================================================

ALTER TABLE "ideas" DROP CONSTRAINT IF EXISTS "ideas_user_id_fkey";
ALTER TABLE "ideas" DROP CONSTRAINT IF EXISTS "ideas_authorId_fkey";
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "idea_votes" DROP CONSTRAINT IF EXISTS "idea_votes_user_id_fkey";
ALTER TABLE "idea_votes" DROP CONSTRAINT IF EXISTS "idea_votes_userId_fkey";
ALTER TABLE "idea_votes" ADD CONSTRAINT "idea_votes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "idea_comments" DROP CONSTRAINT IF EXISTS "idea_comments_user_id_fkey";
ALTER TABLE "idea_comments" DROP CONSTRAINT IF EXISTS "idea_comments_authorId_fkey";
ALTER TABLE "idea_comments" ADD CONSTRAINT "idea_comments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "idea_comment_likes" DROP CONSTRAINT IF EXISTS "idea_comment_likes_user_id_fkey";
ALTER TABLE "idea_comment_likes" DROP CONSTRAINT IF EXISTS "idea_comment_likes_userId_fkey";
ALTER TABLE "idea_comment_likes" ADD CONSTRAINT "idea_comment_likes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Video Spotlight Reactions, Comments, Comment Likes
-- (VideoSpotlight.authorId already SET NULL — no change needed)
-- ============================================================

ALTER TABLE "video_spotlight_reactions" DROP CONSTRAINT IF EXISTS "video_spotlight_reactions_userLogtoId_fkey";
ALTER TABLE "video_spotlight_reactions" DROP CONSTRAINT IF EXISTS "video_spotlight_reactions_user_id_fkey";
ALTER TABLE "video_spotlight_reactions" ADD CONSTRAINT "video_spotlight_reactions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "video_spotlight_comments" DROP CONSTRAINT IF EXISTS "video_spotlight_comments_authorId_fkey";
ALTER TABLE "video_spotlight_comments" DROP CONSTRAINT IF EXISTS "video_spotlight_comments_user_id_fkey";
ALTER TABLE "video_spotlight_comments" ADD CONSTRAINT "video_spotlight_comments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "video_spotlight_comment_likes" DROP CONSTRAINT IF EXISTS "video_spotlight_comment_likes_voterLogtoId_fkey";
ALTER TABLE "video_spotlight_comment_likes" DROP CONSTRAINT IF EXISTS "video_spotlight_comment_likes_user_id_fkey";
ALTER TABLE "video_spotlight_comment_likes" ADD CONSTRAINT "video_spotlight_comment_likes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- MyShare Posts, Likes, Comments, Comment Likes
-- ============================================================

ALTER TABLE "myshare_posts" DROP CONSTRAINT IF EXISTS "myshare_posts_authorId_fkey";
ALTER TABLE "myshare_posts" DROP CONSTRAINT IF EXISTS "highlight_posts_authorId_fkey";
ALTER TABLE "myshare_posts" ADD CONSTRAINT "myshare_posts_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "myshare_likes" DROP CONSTRAINT IF EXISTS "myshare_likes_userId_fkey";
ALTER TABLE "myshare_likes" DROP CONSTRAINT IF EXISTS "highlight_likes_userId_fkey";
ALTER TABLE "myshare_likes" ADD CONSTRAINT "myshare_likes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "myshare_comments" DROP CONSTRAINT IF EXISTS "myshare_comments_authorId_fkey";
ALTER TABLE "myshare_comments" DROP CONSTRAINT IF EXISTS "highlight_comments_authorId_fkey";
ALTER TABLE "myshare_comments" ADD CONSTRAINT "myshare_comments_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "myshare_comment_likes" DROP CONSTRAINT IF EXISTS "myshare_comment_likes_userId_fkey";
ALTER TABLE "myshare_comment_likes" DROP CONSTRAINT IF EXISTS "highlight_comment_likes_userId_fkey";
ALTER TABLE "myshare_comment_likes" ADD CONSTRAINT "myshare_comment_likes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Celebration Comments, Comment Likes, Likes
-- ============================================================

ALTER TABLE "celebration_comments" DROP CONSTRAINT IF EXISTS "celebration_comments_author_id_fkey";
ALTER TABLE "celebration_comments" ADD CONSTRAINT "celebration_comments_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "celebration_comment_likes" DROP CONSTRAINT IF EXISTS "celebration_comment_likes_user_id_fkey";
ALTER TABLE "celebration_comment_likes" ADD CONSTRAINT "celebration_comment_likes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "celebration_likes" DROP CONSTRAINT IF EXISTS "celebration_likes_user_id_fkey";
ALTER TABLE "celebration_likes" ADD CONSTRAINT "celebration_likes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
