-- AlterTable: Remove unused avatarUrl column from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "avatarUrl";
