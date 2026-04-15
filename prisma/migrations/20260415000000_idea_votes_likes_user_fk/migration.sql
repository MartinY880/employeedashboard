-- idea_votes: convert voterLogtoId (logtoId) → user_id (FK to users.id)
-- idea_comment_likes: convert voterLogtoId (logtoId) → user_id (FK to users.id)
-- Handles both column names: voterLogtoId (from migration) or voter_logto_id (from db push)

-- ── idea_votes ──────────────────────────────────────────────
DO $$
DECLARE
  col_name text;
BEGIN
  -- Determine current column name
  SELECT column_name INTO col_name
  FROM information_schema.columns
  WHERE table_name = 'idea_votes'
    AND column_name IN ('voterLogtoId', 'voter_logto_id', 'user_id');

  IF col_name = 'user_id' THEN
    -- Already renamed, nothing to do
    RAISE NOTICE 'idea_votes.user_id already exists, skipping';
    RETURN;
  END IF;

  IF col_name IS NULL THEN
    RAISE EXCEPTION 'idea_votes: no recognized user column found (expected voterLogtoId, voter_logto_id, or user_id)';
  END IF;

  -- Backfill: resolve logtoId → users.id
  EXECUTE format('UPDATE idea_votes v SET %I = u.id FROM users u WHERE v.%I = u."logtoId"', col_name, col_name);

  -- Drop old unique constraint/index
  IF col_name = 'voterLogtoId' THEN
    DROP INDEX IF EXISTS "idea_votes_ideaId_voterLogtoId_key";
    DROP INDEX IF EXISTS "idea_votes_voterLogtoId_idx";
  ELSE
    DROP INDEX IF EXISTS "idea_votes_ideaId_voter_logto_id_key";
    DROP INDEX IF EXISTS "idea_votes_voter_logto_id_idx";
  END IF;

  -- Rename column to user_id
  EXECUTE format('ALTER TABLE idea_votes RENAME COLUMN %I TO user_id', col_name);
END $$;

-- Add FK constraint (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'idea_votes_user_id_fkey'
  ) THEN
    ALTER TABLE idea_votes
      ADD CONSTRAINT idea_votes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

-- Re-create unique constraint and index (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idea_votes_ideaId_user_id_key'
  ) THEN
    ALTER TABLE idea_votes
      ADD CONSTRAINT "idea_votes_ideaId_user_id_key"
      UNIQUE ("ideaId", user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idea_votes_user_id_idx ON idea_votes(user_id);

-- ── idea_comment_likes ──────────────────────────────────────
DO $$
DECLARE
  col_name text;
BEGIN
  -- Determine current column name
  SELECT column_name INTO col_name
  FROM information_schema.columns
  WHERE table_name = 'idea_comment_likes'
    AND column_name IN ('voterLogtoId', 'voter_logto_id', 'user_id');

  IF col_name = 'user_id' THEN
    RAISE NOTICE 'idea_comment_likes.user_id already exists, skipping';
    RETURN;
  END IF;

  IF col_name IS NULL THEN
    RAISE EXCEPTION 'idea_comment_likes: no recognized user column found (expected voterLogtoId, voter_logto_id, or user_id)';
  END IF;

  -- Backfill: resolve logtoId → users.id
  EXECUTE format('UPDATE idea_comment_likes l SET %I = u.id FROM users u WHERE l.%I = u."logtoId"', col_name, col_name);

  -- Drop old unique constraint/index
  IF col_name = 'voterLogtoId' THEN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'idea_comment_likes_commentId_voterLogtoId_key') THEN
      ALTER TABLE idea_comment_likes DROP CONSTRAINT "idea_comment_likes_commentId_voterLogtoId_key";
    END IF;
    DROP INDEX IF EXISTS "idea_comment_likes_commentId_voterLogtoId_key";
    DROP INDEX IF EXISTS "idea_comment_likes_voterLogtoId_idx";
  ELSE
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'idea_comment_likes_commentId_voter_logto_id_key') THEN
      ALTER TABLE idea_comment_likes DROP CONSTRAINT "idea_comment_likes_commentId_voter_logto_id_key";
    END IF;
    DROP INDEX IF EXISTS "idea_comment_likes_commentId_voter_logto_id_key";
    DROP INDEX IF EXISTS "idea_comment_likes_voter_logto_id_idx";
  END IF;

  -- Rename column to user_id
  EXECUTE format('ALTER TABLE idea_comment_likes RENAME COLUMN %I TO user_id', col_name);
END $$;

-- Add FK constraint (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'idea_comment_likes_user_id_fkey'
  ) THEN
    ALTER TABLE idea_comment_likes
      ADD CONSTRAINT idea_comment_likes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

-- Re-create unique constraint and index (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'idea_comment_likes_commentId_user_id_key'
  ) THEN
    ALTER TABLE idea_comment_likes
      ADD CONSTRAINT "idea_comment_likes_commentId_user_id_key"
      UNIQUE ("commentId", user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idea_comment_likes_user_id_idx ON idea_comment_likes(user_id);
