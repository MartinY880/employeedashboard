-- Migration: Convert authorId from Logto sub to DB User.id
-- This updates existing Idea and IdeaComment rows so that authorId references
-- the internal User.id (cuid) instead of the Logto sub (logtoId).

-- Update ideas (skip "anonymous" sentinel)
UPDATE "ideas"
SET "authorId" = u."id"
FROM "users" u
WHERE u."logtoId" = "ideas"."authorId"
  AND "ideas"."authorId" != 'anonymous';

-- Update idea comments
UPDATE "idea_comments"
SET "authorId" = u."id"
FROM "users" u
WHERE u."logtoId" = "idea_comments"."authorId";
