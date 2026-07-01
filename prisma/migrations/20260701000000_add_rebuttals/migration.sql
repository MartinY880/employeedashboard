-- CreateTable: rebuttals
-- Stores objection/rebuttal pairs for the "Rebuttal of the Day" dashboard widget.
-- lastShownAt tracks rotation; isActive allows soft-disabling without deletion.
CREATE TABLE IF NOT EXISTS "rebuttals" (
    "id"            TEXT        NOT NULL,
    "objection"     TEXT        NOT NULL,
    "rebuttal"      TEXT        NOT NULL,
    "is_active"     BOOLEAN     NOT NULL DEFAULT true,
    "last_shown_at" TIMESTAMPTZ,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "rebuttals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_rebuttals_is_active_created_at"
    ON "rebuttals"("is_active", "created_at");
