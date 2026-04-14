-- Props comments: convert authorId (logtoId) → user_id (FK to users.id)
-- Props comment likes: convert voterLogtoId (logtoId) → user_id (FK to users.id)
-- Drop authorName column (use author relation instead)

-- 1) Backfill props_comments: resolve logtoId → users.id
UPDATE props_comments c
SET "authorId" = u.id
FROM users u
WHERE c."authorId" = u."logtoId";

-- 2) Rename authorId → user_id
ALTER TABLE props_comments RENAME COLUMN "authorId" TO user_id;

-- 3) Drop authorName column
ALTER TABLE props_comments DROP COLUMN IF EXISTS "authorName";

-- 4) Add FK constraint (NOT VALID for safety with any unresolved orphans)
ALTER TABLE props_comments
  ADD CONSTRAINT props_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id)
  ON DELETE RESTRICT ON UPDATE CASCADE
  NOT VALID;

-- 5) Add index on user_id
CREATE INDEX IF NOT EXISTS props_comments_user_id_idx ON props_comments(user_id);

-- 6) Backfill props_comment_likes: resolve voterLogtoId → users.id
UPDATE props_comment_likes l
SET "voterLogtoId" = u.id
FROM users u
WHERE l."voterLogtoId" = u."logtoId";

-- 7) Rename voterLogtoId → user_id
ALTER TABLE props_comment_likes RENAME COLUMN "voterLogtoId" TO user_id;

-- 8) Drop old unique constraint/index and create new ones
DO $$ BEGIN
  -- Drop old unique constraint (commentId, voterLogtoId) if it exists as a constraint
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'props_comment_likes_commentId_voterLogtoId_key'
  ) THEN
    ALTER TABLE props_comment_likes
      DROP CONSTRAINT "props_comment_likes_commentId_voterLogtoId_key";
  END IF;
END $$;

-- Drop old unique index (Prisma may have created it as an index, not a constraint)
DROP INDEX IF EXISTS "props_comment_likes_commentId_voterLogtoId_key";

-- Drop old voterLogtoId index
DROP INDEX IF EXISTS "props_comment_likes_voterLogtoId_idx";

-- Create new unique constraint and index
ALTER TABLE props_comment_likes
  ADD CONSTRAINT props_comment_likes_commentId_user_id_key
  UNIQUE ("commentId", user_id);

CREATE INDEX IF NOT EXISTS props_comment_likes_user_id_idx
  ON props_comment_likes(user_id);

-- 9) Add FK constraint for props_comment_likes
ALTER TABLE props_comment_likes
  ADD CONSTRAINT props_comment_likes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id)
  ON DELETE RESTRICT ON UPDATE CASCADE
  NOT VALID;
