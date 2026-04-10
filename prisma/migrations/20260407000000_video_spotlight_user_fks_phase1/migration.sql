-- Video Spotlight phase 1: standardize identity columns to users.id and add FK constraints.
-- This migration keeps physical column names for reactions/comment_likes to avoid heavy rewrites:
--   video_spotlight_reactions.userLogtoId now stores users.id
--   video_spotlight_comment_likes.voterLogtoId now stores users.id

-- 1) Backfill legacy Logto IDs to DB user IDs where possible
UPDATE "video_spotlights" v
SET "authorId" = u."id"
FROM "users" u
WHERE v."authorId" IS NOT NULL
  AND v."authorId" = u."logtoId";

UPDATE "video_spotlight_comments" c
SET "authorId" = u."id"
FROM "users" u
WHERE c."authorId" = u."logtoId";

UPDATE "video_spotlight_reactions" r
SET "userLogtoId" = u."id"
FROM "users" u
WHERE r."userLogtoId" = u."logtoId";

UPDATE "video_spotlight_comment_likes" l
SET "voterLogtoId" = u."id"
FROM "users" u
WHERE l."voterLogtoId" = u."logtoId";

-- 2) Remove denormalized author name columns
DO $$ BEGIN
  ALTER TABLE "video_spotlights" DROP COLUMN "authorName";
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "video_spotlight_comments" DROP COLUMN "authorName";
EXCEPTION WHEN undefined_column THEN NULL;
END $$;

-- 3) Add user foreign keys (NOT VALID keeps rollout safe with legacy orphans)
DO $$ BEGIN
  ALTER TABLE "video_spotlights"
    ADD CONSTRAINT "video_spotlights_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "video_spotlight_comments"
    ADD CONSTRAINT "video_spotlight_comments_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "video_spotlight_reactions"
    ADD CONSTRAINT "video_spotlight_reactions_userLogtoId_fkey"
    FOREIGN KEY ("userLogtoId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "video_spotlight_comment_likes"
    ADD CONSTRAINT "video_spotlight_comment_likes_voterLogtoId_fkey"
    FOREIGN KEY ("voterLogtoId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4) Supporting indexes for user-linked lookups
CREATE INDEX IF NOT EXISTS "video_spotlight_reactions_userLogtoId_idx"
  ON "video_spotlight_reactions"("userLogtoId");

CREATE INDEX IF NOT EXISTS "video_spotlight_comment_likes_voterLogtoId_idx"
  ON "video_spotlight_comment_likes"("voterLogtoId");

-- Existing unique indexes already align to these physical columns and remain valid.
