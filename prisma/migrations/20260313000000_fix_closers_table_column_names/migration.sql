-- Fix closers_table_awards columns: rename camelCase → snake_case to match Prisma @map() directives
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

  -- Make employee_id nullable (String?) — only if the column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='closers_table_awards' AND column_name='employee_id') THEN
    ALTER TABLE "closers_table_awards" ALTER COLUMN "employee_id" DROP NOT NULL;
  END IF;
END $$;
