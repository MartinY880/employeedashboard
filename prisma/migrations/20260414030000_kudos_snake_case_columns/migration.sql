-- kudos_messages: rename authorId → user_id, recipientId → recipient_id, drop likes
-- kudos_reactions: rename userId → user_id

-- 1) Drop old FK constraints on kudos_messages
ALTER TABLE kudos_messages DROP CONSTRAINT IF EXISTS "kudos_messages_authorId_fkey";
ALTER TABLE kudos_messages DROP CONSTRAINT IF EXISTS "kudos_messages_recipientId_fkey";

-- 2) Drop old indexes on kudos_messages
DROP INDEX IF EXISTS "kudos_messages_authorId_idx";
DROP INDEX IF EXISTS "kudos_messages_recipientId_idx";

-- 3) Rename columns on kudos_messages
ALTER TABLE kudos_messages RENAME COLUMN "authorId" TO user_id;
ALTER TABLE kudos_messages RENAME COLUMN "recipientId" TO recipient_id;

-- 4) Drop unused likes column
ALTER TABLE kudos_messages DROP COLUMN IF EXISTS likes;

-- 5) Re-create FK constraints with new column names
ALTER TABLE kudos_messages
  ADD CONSTRAINT kudos_messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id)
  ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE kudos_messages
  ADD CONSTRAINT kudos_messages_recipient_id_fkey
  FOREIGN KEY (recipient_id) REFERENCES users(id)
  ON UPDATE CASCADE ON DELETE RESTRICT;

-- 6) Re-create indexes with new column names
CREATE INDEX kudos_messages_user_id_idx ON kudos_messages(user_id);
CREATE INDEX kudos_messages_recipient_id_idx ON kudos_messages(recipient_id);

-- 7) Drop old FK constraint and indexes on kudos_reactions
ALTER TABLE kudos_reactions DROP CONSTRAINT IF EXISTS "kudos_reactions_userId_fkey";
DROP INDEX IF EXISTS "kudos_reactions_userId_idx";
DROP INDEX IF EXISTS "kudos_reactions_kudosId_userId_key";

-- 8) Rename userId → user_id on kudos_reactions
ALTER TABLE kudos_reactions RENAME COLUMN "userId" TO user_id;

-- 9) Re-create FK, unique constraint, and index with new column name
ALTER TABLE kudos_reactions
  ADD CONSTRAINT kudos_reactions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE kudos_reactions
  ADD CONSTRAINT "kudos_reactions_kudosId_user_id_key"
  UNIQUE ("kudosId", user_id);

CREATE INDEX kudos_reactions_user_id_idx ON kudos_reactions(user_id);
