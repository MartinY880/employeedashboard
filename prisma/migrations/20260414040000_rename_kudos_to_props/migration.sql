-- Rename kudos tables → props, kudosId → props_id, KudosReactionType → PropsReactionType

-- 1) Rename tables
ALTER TABLE kudos_messages RENAME TO props_messages;
ALTER TABLE kudos_reactions RENAME TO props_reactions;

-- 2) Rename kudosId → props_id on props_reactions (drop FK + unique first)
ALTER TABLE props_reactions DROP CONSTRAINT IF EXISTS "kudos_reactions_kudosId_fkey";
ALTER TABLE props_reactions DROP CONSTRAINT IF EXISTS "kudos_reactions_kudosId_user_id_key";
DROP INDEX IF EXISTS "kudos_reactions_kudosId_reaction_idx";

ALTER TABLE props_reactions RENAME COLUMN "kudosId" TO props_id;

ALTER TABLE props_reactions
  ADD CONSTRAINT props_reactions_props_id_fkey
  FOREIGN KEY (props_id) REFERENCES props_messages(id)
  ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE props_reactions
  ADD CONSTRAINT props_reactions_props_id_user_id_key
  UNIQUE (props_id, user_id);

CREATE INDEX props_reactions_props_id_reaction_idx ON props_reactions(props_id, reaction);

-- 3) Rename enum KudosReactionType → PropsReactionType
ALTER TYPE "KudosReactionType" RENAME TO "PropsReactionType";

-- 4) Rename constraints on props_messages to match new table name
ALTER TABLE props_messages RENAME CONSTRAINT "kudos_messages_pkey" TO props_messages_pkey;
ALTER TABLE props_messages RENAME CONSTRAINT "kudos_messages_user_id_fkey" TO props_messages_user_id_fkey;
ALTER TABLE props_messages RENAME CONSTRAINT "kudos_messages_recipient_id_fkey" TO props_messages_recipient_id_fkey;

-- 5) Rename indexes on props_messages
ALTER INDEX "kudos_messages_createdAt_idx" RENAME TO "props_messages_createdAt_idx";
ALTER INDEX kudos_messages_user_id_idx RENAME TO props_messages_user_id_idx;
ALTER INDEX kudos_messages_recipient_id_idx RENAME TO props_messages_recipient_id_idx;

-- 6) Rename constraints on props_reactions
ALTER TABLE props_reactions RENAME CONSTRAINT "kudos_reactions_pkey" TO props_reactions_pkey;
ALTER TABLE props_reactions RENAME CONSTRAINT "kudos_reactions_user_id_fkey" TO props_reactions_user_id_fkey;

-- 7) Rename remaining index on props_reactions
ALTER INDEX kudos_reactions_user_id_idx RENAME TO props_reactions_user_id_idx;

-- 8) Update props_comments FK to reference new table name (FK auto-follows rename, just rename the constraint)
ALTER TABLE props_comments RENAME CONSTRAINT "props_comments_propsId_fkey" TO props_comments_props_id_fkey;
