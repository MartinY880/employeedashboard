-- Add like_count column to celebration_events
ALTER TABLE "celebration_events" ADD COLUMN "like_count" INTEGER NOT NULL DEFAULT 0;

-- Create celebration_likes table
CREATE TABLE "celebration_likes" (
    "id" TEXT NOT NULL,
    "celebration_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "celebration_likes_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one like per user per celebration
CREATE UNIQUE INDEX "celebration_likes_celebration_id_user_id_key" ON "celebration_likes"("celebration_id", "user_id");

-- Index on userId for user lookups
CREATE INDEX "celebration_likes_user_id_idx" ON "celebration_likes"("user_id");

-- Foreign keys
ALTER TABLE "celebration_likes" ADD CONSTRAINT "celebration_likes_celebration_id_fkey"
    FOREIGN KEY ("celebration_id") REFERENCES "celebration_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "celebration_likes" ADD CONSTRAINT "celebration_likes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
