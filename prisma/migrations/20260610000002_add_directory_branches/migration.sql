-- Directory config: stores the root account (single row)
CREATE TABLE IF NOT EXISTS "directory_config" (
  "id"           TEXT NOT NULL DEFAULT 'singleton',
  "root_user_id" TEXT NULL,      -- Azure Object ID of the root account
  "root_email"   TEXT NULL,      -- Display email (for UI)
  "root_name"    TEXT NULL,      -- Display name (for UI)
  "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "directory_config_pkey" PRIMARY KEY ("id")
);

-- Branches: named groups of root direct reports
CREATE TABLE IF NOT EXISTS "directory_branches" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "directory_branches_pkey" PRIMARY KEY ("id")
);

-- Branch assignments: which direct report belongs to which branch
CREATE TABLE IF NOT EXISTS "directory_branch_assignments" (
  "id"        TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "user_id"   TEXT NOT NULL,  -- Azure Object ID of the direct report
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "directory_branch_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "directory_branch_assignments_branch_fk"
    FOREIGN KEY ("branch_id") REFERENCES "directory_branches"("id") ON DELETE CASCADE,
  CONSTRAINT "directory_branch_assignments_user_unique" UNIQUE ("user_id")
);

CREATE INDEX IF NOT EXISTS "idx_directory_branch_assignments_branch_id"
  ON "directory_branch_assignments"("branch_id");
