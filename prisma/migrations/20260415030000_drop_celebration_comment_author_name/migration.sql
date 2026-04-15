-- Drop denormalized author_name column from celebration_comments
-- The author name is now resolved via the author relation (FK to users.id)

ALTER TABLE "celebration_comments" DROP COLUMN IF EXISTS "author_name";
.