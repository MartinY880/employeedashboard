-- ideas + idea_comments: rename authorId → user_id, drop authorName, add FK to users
-- Handles both column names: authorId (from migration) or author_id (from db push)

-- ── ideas ───────────────────────────────────────────────────
DO $$
DECLARE
  col_name text;
BEGIN
  SELECT column_name INTO col_name
  FROM information_schema.columns
  WHERE table_name = 'ideas'
    AND column_name IN ('authorId', 'author_id', 'user_id');

  IF col_name = 'user_id' THEN
    RAISE NOTICE 'ideas.user_id already exists, skipping rename';
    RETURN;
  END IF;

  IF col_name IS NULL THEN
    RAISE EXCEPTION 'ideas: no recognized author column found';
  END IF;

  -- Rename column to user_id
  EXECUTE format('ALTER TABLE ideas RENAME COLUMN %I TO user_id', col_name);
END $$;

-- Drop authorName column
ALTER TABLE ideas DROP COLUMN IF EXISTS "authorName";
ALTER TABLE ideas DROP COLUMN IF EXISTS author_name;

-- Add FK constraint (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ideas_user_id_fkey'
  ) THEN
    ALTER TABLE ideas
      ADD CONSTRAINT ideas_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

-- Add index on user_id (idempotent)
CREATE INDEX IF NOT EXISTS ideas_user_id_idx ON ideas(user_id);

-- ── idea_comments ───────────────────────────────────────────
DO $$
DECLARE
  col_name text;
BEGIN
  SELECT column_name INTO col_name
  FROM information_schema.columns
  WHERE table_name = 'idea_comments'
    AND column_name IN ('authorId', 'author_id', 'user_id');

  IF col_name = 'user_id' THEN
    RAISE NOTICE 'idea_comments.user_id already exists, skipping rename';
    RETURN;
  END IF;

  IF col_name IS NULL THEN
    RAISE EXCEPTION 'idea_comments: no recognized author column found';
  END IF;

  -- Rename column to user_id
  EXECUTE format('ALTER TABLE idea_comments RENAME COLUMN %I TO user_id', col_name);
END $$;

-- Drop authorName column
ALTER TABLE idea_comments DROP COLUMN IF EXISTS "authorName";
ALTER TABLE idea_comments DROP COLUMN IF EXISTS author_name;

-- Add FK constraint (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'idea_comments_user_id_fkey'
  ) THEN
    ALTER TABLE idea_comments
      ADD CONSTRAINT idea_comments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

-- Add index on user_id (idempotent)
CREATE INDEX IF NOT EXISTS idea_comments_user_id_idx ON idea_comments(user_id);
