-- CreateTable (if it doesn't exist yet)
CREATE TABLE IF NOT EXISTS "closers_table_awards" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT,
    "employee_name" TEXT NOT NULL,
    "award" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#f59e0b',
    "award_font_size" INTEGER NOT NULL DEFAULT 10,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "closers_table_awards_pkey" PRIMARY KEY ("id")
);

-- Rename camelCase columns left by migrate-safe.sh to snake_case expected by Prisma @map()
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closers_table_awards' AND column_name='employeeId') THEN
    ALTER TABLE "closers_table_awards" RENAME COLUMN "employeeId" TO "employee_id";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closers_table_awards' AND column_name='employeeName') THEN
    ALTER TABLE "closers_table_awards" RENAME COLUMN "employeeName" TO "employee_name";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closers_table_awards' AND column_name='sortOrder') THEN
    ALTER TABLE "closers_table_awards" RENAME COLUMN "sortOrder" TO "sort_order";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closers_table_awards' AND column_name='createdAt') THEN
    ALTER TABLE "closers_table_awards" RENAME COLUMN "createdAt" TO "created_at";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closers_table_awards' AND column_name='updatedAt') THEN
    ALTER TABLE "closers_table_awards" RENAME COLUMN "updatedAt" TO "updated_at";
  END IF;
END $$;

-- Make employee_id nullable (schema says String?) in case it was created as NOT NULL
ALTER TABLE "closers_table_awards" ALTER COLUMN "employee_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "closers_table_awards_active_sort_order_idx" ON "closers_table_awards"("active", "sort_order");
