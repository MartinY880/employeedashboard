CREATE TYPE "KudosReactionType" AS ENUM ('HIGHFIVE', 'UPLIFT', 'BOMB');

CREATE TABLE "kudos_reactions" (
  "id" TEXT NOT NULL,
  "kudosId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reaction" "KudosReactionType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "kudos_reactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kudos_reactions_kudosId_userId_reaction_key"
  ON "kudos_reactions"("kudosId", "userId", "reaction");

CREATE INDEX "kudos_reactions_kudosId_reaction_idx"
  ON "kudos_reactions"("kudosId", "reaction");

CREATE INDEX "kudos_reactions_userId_idx"
  ON "kudos_reactions"("userId");

ALTER TABLE "kudos_reactions"
  ADD CONSTRAINT "kudos_reactions_kudosId_fkey"
  FOREIGN KEY ("kudosId") REFERENCES "kudos_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kudos_reactions"
  ADD CONSTRAINT "kudos_reactions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
