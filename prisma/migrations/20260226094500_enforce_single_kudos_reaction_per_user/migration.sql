WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY "kudosId", "userId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS rn
  FROM "kudos_reactions"
)
DELETE FROM "kudos_reactions" kr
USING ranked r
WHERE kr.ctid = r.ctid
  AND r.rn > 1;

DROP INDEX IF EXISTS "kudos_reactions_kudosId_userId_reaction_key";

CREATE UNIQUE INDEX "kudos_reactions_kudosId_userId_key"
  ON "kudos_reactions"("kudosId", "userId");
