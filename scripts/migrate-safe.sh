#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# ProConnect — Safe Production Migration Script
# Creates ONLY missing tables, columns, indexes, and enum values.
# NEVER drops or overwrites existing data.
#
# Matches: prisma/schema.prisma (as of 2026-03-03)
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ── Resolve DATABASE_URL ──────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
  if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -E '^DATABASE_URL=' "$PROJECT_ROOT/.env" | xargs)
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL is not set. Pass it as an env var or add it to .env"
  exit 1
fi

echo "🔍 ProConnect — Safe Migration"
echo "   Database: $(echo "$DATABASE_URL" | sed 's|://[^@]*@|://***@|')"
echo ""

# ── Helper: run SQL, return output ────────────────────────────
run_sql() {
  psql "$DATABASE_URL" -tA -c "$1" 2>/dev/null
}

# ── Counters ──────────────────────────────────────────────────
CREATED_ENUMS=0
CREATED_ENUM_VALUES=0
CREATED_TABLES=0
CREATED_COLUMNS=0
CREATED_INDEXES=0

# ══════════════════════════════════════════════════════════════
# 1. ENUMS — create if missing, add missing values
# ══════════════════════════════════════════════════════════════
echo "── Enums ──────────────────────────────────────────────"

ensure_enum() {
  local enum_name="$1"
  shift
  local values=("$@")

  exists=$(run_sql "SELECT 1 FROM pg_type WHERE typname = '${enum_name}';")
  if [ "$exists" != "1" ]; then
    local vals=""
    for v in "${values[@]}"; do vals+="'${v}', "; done
    vals="${vals%, }"
    run_sql "CREATE TYPE \"${enum_name}\" AS ENUM (${vals});" > /dev/null
    echo "  ✅ Created enum: ${enum_name}"
    CREATED_ENUMS=$((CREATED_ENUMS + 1))
  else
    for v in "${values[@]}"; do
      has=$(run_sql "SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = '${enum_name}') AND enumlabel = '${v}';")
      if [ "$has" != "1" ]; then
        run_sql "ALTER TYPE \"${enum_name}\" ADD VALUE IF NOT EXISTS '${v}';" > /dev/null
        echo "  ✅ Added value '${v}' to enum ${enum_name}"
        CREATED_ENUM_VALUES=$((CREATED_ENUM_VALUES + 1))
      fi
    done
  fi
}

ensure_enum "Role"              "ADMIN" "EMPLOYEE"
ensure_enum "AlertType"         "INFO" "WARNING" "BIRTHDAY" "NEW_HIRE" "ANNOUNCEMENT"
ensure_enum "Priority"          "LOW" "MEDIUM" "HIGH" "CRITICAL"
ensure_enum "IdeaStatus"        "ACTIVE" "SELECTED" "IN_PROGRESS" "COMPLETED" "ARCHIVED"
ensure_enum "VoteDirection"     "UP" "DOWN"
ensure_enum "NotificationType"  "KUDOS" "HIGHLIGHT" "IDEA_SELECTED" "IDEA_IN_PROGRESS" "IDEA_COMPLETED" "IDEA_COMMENT" "IDEA_REPLY"
ensure_enum "KudosReactionType" "HIGHFIVE" "UPLIFT" "BOMB"
ensure_enum "ForwardingStatus"  "PENDING" "ACTIVE" "EXPIRED" "CANCELLED"
ensure_enum "TournamentStatus"  "SETUP" "IN_PROGRESS" "COMPLETED"
ensure_enum "MatchStatus"       "PENDING" "IN_PROGRESS" "COMPLETED"

# ══════════════════════════════════════════════════════════════
# 2. TABLES — create if missing (IF NOT EXISTS)
# ══════════════════════════════════════════════════════════════
echo ""
echo "── Tables ─────────────────────────────────────────────"

table_exists() {
  local t="$1"
  local e=$(run_sql "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${t}';")
  [ "$e" = "1" ]
}

create_table_if_missing() {
  local tbl="$1"
  local ddl="$2"
  if ! table_exists "$tbl"; then
    run_sql "$ddl" > /dev/null
    echo "  ✅ Created table: ${tbl}"
    CREATED_TABLES=$((CREATED_TABLES + 1))
  else
    echo "  ⏭️  Table exists: ${tbl}"
  fi
}

# --- users ---
create_table_if_missing "users" '
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  "logtoId"    TEXT NOT NULL UNIQUE,
  email        TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  role         "Role" NOT NULL DEFAULT '"'"'EMPLOYEE'"'"',
  "avatarUrl"  TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- kudos_messages (PropsMessage) ---
create_table_if_missing "kudos_messages" '
CREATE TABLE IF NOT EXISTS kudos_messages (
  id           TEXT PRIMARY KEY,
  content      TEXT NOT NULL,
  "authorId"   TEXT NOT NULL REFERENCES users(id),
  "recipientId" TEXT NOT NULL REFERENCES users(id),
  badge        TEXT NOT NULL DEFAULT '"'"'mvp'"'"',
  likes        INT NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- kudos_reactions (PropsReaction) ---
create_table_if_missing "kudos_reactions" '
CREATE TABLE IF NOT EXISTS kudos_reactions (
  id          TEXT PRIMARY KEY,
  "kudosId"   TEXT NOT NULL REFERENCES kudos_messages(id) ON DELETE CASCADE,
  "userId"    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction    "KudosReactionType" NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("kudosId", "userId")
);'

# --- alerts ---
create_table_if_missing "alerts" '
CREATE TABLE IF NOT EXISTS alerts (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  type        "AlertType" NOT NULL DEFAULT '"'"'INFO'"'"',
  priority    "Priority" NOT NULL DEFAULT '"'"'LOW'"'"',
  active      BOOLEAN NOT NULL DEFAULT true,
  expires_at  TIMESTAMPTZ,
  "createdBy" TEXT NOT NULL REFERENCES users(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- ideas ---
create_table_if_missing "ideas" '
CREATE TABLE IF NOT EXISTS ideas (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  "authorId"  TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  votes       INT NOT NULL DEFAULT 0,
  status      "IdeaStatus" NOT NULL DEFAULT '"'"'ACTIVE'"'"',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- idea_votes ---
create_table_if_missing "idea_votes" '
CREATE TABLE IF NOT EXISTS idea_votes (
  id             TEXT PRIMARY KEY,
  "ideaId"       TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  "voterLogtoId" TEXT NOT NULL,
  direction      "VoteDirection" NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("ideaId", "voterLogtoId")
);'

# --- idea_comments ---
create_table_if_missing "idea_comments" '
CREATE TABLE IF NOT EXISTS idea_comments (
  id           TEXT PRIMARY KEY,
  "ideaId"     TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  "authorId"   TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  content      TEXT NOT NULL,
  "parentId"   TEXT REFERENCES idea_comments(id) ON DELETE CASCADE,
  likes        INT NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- idea_comment_likes ---
create_table_if_missing "idea_comment_likes" '
CREATE TABLE IF NOT EXISTS idea_comment_likes (
  id             TEXT PRIMARY KEY,
  "commentId"    TEXT NOT NULL REFERENCES idea_comments(id) ON DELETE CASCADE,
  "voterLogtoId" TEXT NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("commentId", "voterLogtoId")
);'

# --- quick_links ---
create_table_if_missing "quick_links" '
CREATE TABLE IF NOT EXISTS quick_links (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  url         TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT '"'"'link'"'"',
  "sortOrder" INT NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- employee_highlights ---
create_table_if_missing "employee_highlights" '
CREATE TABLE IF NOT EXISTS employee_highlights (
  id             TEXT PRIMARY KEY,
  "employeeId"   TEXT,
  "employeeName" TEXT NOT NULL,
  "jobTitle"     TEXT,
  department     TEXT,
  title          TEXT NOT NULL,
  subtitle       TEXT NOT NULL,
  "avatarUrl"    TEXT,
  active         BOOLEAN NOT NULL DEFAULT true,
  "startDate"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "endDate"      TIMESTAMPTZ,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- site_branding ---
create_table_if_missing "site_branding" '
CREATE TABLE IF NOT EXISTS site_branding (
  id             TEXT PRIMARY KEY DEFAULT '"'"'singleton'"'"',
  "companyName"  TEXT NOT NULL DEFAULT '"'"'MortgagePros'"'"',
  "logoData"     TEXT,
  dark_logo_data TEXT,
  "faviconData"  TEXT,
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- directory_snapshots ---
create_table_if_missing "directory_snapshots" '
CREATE TABLE IF NOT EXISTS directory_snapshots (
  id                  TEXT PRIMARY KEY,
  display_name        TEXT NOT NULL,
  mail                TEXT,
  user_principal_name TEXT NOT NULL,
  job_title           TEXT,
  employee_type       TEXT,
  department          TEXT,
  office_location     TEXT,
  manager_id          TEXT,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- directory_snapshot_state ---
create_table_if_missing "directory_snapshot_state" '
CREATE TABLE IF NOT EXISTS directory_snapshot_state (
  id             TEXT PRIMARY KEY,
  last_synced_at TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- notifications ---
create_table_if_missing "notifications" '
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  "userId"   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       "NotificationType" NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  metadata   TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- holidays ---
create_table_if_missing "holidays" '
CREATE TABLE IF NOT EXISTS holidays (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  date       TEXT NOT NULL,
  category   TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '"'"'#06427F'"'"',
  source     TEXT NOT NULL DEFAULT '"'"'custom'"'"',
  visible    BOOLEAN NOT NULL DEFAULT true,
  recurring  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- calendar_sync_logs ---
create_table_if_missing "calendar_sync_logs" '
CREATE TABLE IF NOT EXISTS calendar_sync_logs (
  id         TEXT PRIMARY KEY,
  source     TEXT NOT NULL,
  status     TEXT NOT NULL,
  message    TEXT,
  "syncedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- calendar_settings ---
create_table_if_missing "calendar_settings" '
CREATE TABLE IF NOT EXISTS calendar_settings (
  id         TEXT PRIMARY KEY DEFAULT '"'"'singleton'"'"',
  data       TEXT NOT NULL DEFAULT '"'"'{}'"'"',
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- forwarding_schedules ---
create_table_if_missing "forwarding_schedules" '
CREATE TABLE IF NOT EXISTS forwarding_schedules (
  id               TEXT PRIMARY KEY,
  "userEmail"      TEXT NOT NULL,
  "forwardToEmail" TEXT NOT NULL,
  "forwardToName"  TEXT,
  "startsAt"       TIMESTAMPTZ NOT NULL,
  "endsAt"         TIMESTAMPTZ NOT NULL,
  status           "ForwardingStatus" NOT NULL DEFAULT '"'"'PENDING'"'"',
  "graphRuleId"    TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- tournaments ---
create_table_if_missing "tournaments" '
CREATE TABLE IF NOT EXISTS tournaments (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  status      "TournamentStatus" NOT NULL DEFAULT '"'"'SETUP'"'"',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- tournament_teams ---
create_table_if_missing "tournament_teams" '
CREATE TABLE IF NOT EXISTS tournament_teams (
  id            TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  "player1Name" TEXT NOT NULL,
  "player2Name" TEXT NOT NULL,
  seed          INT NOT NULL DEFAULT 0,
  division      TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- tournament_matches ---
create_table_if_missing "tournament_matches" '
CREATE TABLE IF NOT EXISTS tournament_matches (
  id             TEXT PRIMARY KEY,
  "tournamentId" TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round          INT NOT NULL,
  "matchNumber"  INT NOT NULL,
  division       TEXT NOT NULL,
  "team1Id"      TEXT REFERENCES tournament_teams(id) ON DELETE SET NULL,
  "team2Id"      TEXT REFERENCES tournament_teams(id) ON DELETE SET NULL,
  "winnerId"     TEXT REFERENCES tournament_teams(id) ON DELETE SET NULL,
  "team1Score"   INT,
  "team2Score"   INT,
  status         "MatchStatus" NOT NULL DEFAULT '"'"'PENDING'"'"',
  "nextMatchId"  TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- preferred_vendors ---
create_table_if_missing "preferred_vendors" '
CREATE TABLE IF NOT EXISTS preferred_vendors (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  description           TEXT,
  category              TEXT NOT NULL DEFAULT '"'"'General'"'"',
  contact_name          TEXT,
  contact_email         TEXT,
  contact_phone         TEXT,
  contact_phone_label   TEXT,
  secondary_phone       TEXT,
  secondary_phone_label TEXT,
  website               TEXT,
  logo_url              TEXT,
  icon_id               TEXT,
  address               TEXT,
  labels                TEXT,
  notes                 TEXT,
  sort_order            INT NOT NULL DEFAULT 0,
  active                BOOLEAN NOT NULL DEFAULT true,
  featured              BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- video_spotlights ---
create_table_if_missing "video_spotlights" '
CREATE TABLE IF NOT EXISTS video_spotlights (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  filename     TEXT NOT NULL,
  "mimeType"   TEXT NOT NULL DEFAULT '"'"'video/webm'"'"',
  "fileSize"   INT NOT NULL DEFAULT 0,
  duration     DOUBLE PRECISION,
  "authorId"   TEXT,
  "authorName" TEXT,
  featured     BOOLEAN NOT NULL DEFAULT false,
  "playCount"  INT NOT NULL DEFAULT 0,
  "sortOrder"  INT NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT '"'"'active'"'"',
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- video_spotlight_reactions ---
create_table_if_missing "video_spotlight_reactions" '
CREATE TABLE IF NOT EXISTS video_spotlight_reactions (
  id            TEXT PRIMARY KEY,
  "videoId"     TEXT NOT NULL REFERENCES video_spotlights(id) ON DELETE CASCADE,
  "userLogtoId" TEXT NOT NULL,
  type          TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("videoId", "userLogtoId")
);'

# --- video_spotlight_comments ---
create_table_if_missing "video_spotlight_comments" '
CREATE TABLE IF NOT EXISTS video_spotlight_comments (
  id           TEXT PRIMARY KEY,
  "videoId"    TEXT NOT NULL REFERENCES video_spotlights(id) ON DELETE CASCADE,
  "authorId"   TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  content      TEXT NOT NULL,
  "parentId"   TEXT REFERENCES video_spotlight_comments(id) ON DELETE CASCADE,
  likes        INT NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# --- video_spotlight_comment_likes ---
create_table_if_missing "video_spotlight_comment_likes" '
CREATE TABLE IF NOT EXISTS video_spotlight_comment_likes (
  id             TEXT PRIMARY KEY,
  "commentId"    TEXT NOT NULL REFERENCES video_spotlight_comments(id) ON DELETE CASCADE,
  "voterLogtoId" TEXT NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("commentId", "voterLogtoId")
);'

# --- important_dates ---
create_table_if_missing "important_dates" '
CREATE TABLE IF NOT EXISTS important_dates (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  subtitle     TEXT,
  date         DATE NOT NULL,
  "recurType"  TEXT NOT NULL DEFAULT '"'"'none'"'"',
  "sortOrder"  INT NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);'

# ══════════════════════════════════════════════════════════════
# 3. COLUMNS — add missing columns to existing tables
# ══════════════════════════════════════════════════════════════
echo ""
echo "── Missing columns ──────────────────────────────────"

add_column_if_missing() {
  local tbl="$1" col="$2" typedef="$3"
  local has=$(run_sql "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tbl}' AND column_name = '${col}';")
  if [ "$has" != "1" ]; then
    run_sql "ALTER TABLE \"${tbl}\" ADD COLUMN \"${col}\" ${typedef};" > /dev/null
    echo "  ✅ Added column: ${tbl}.${col}"
    CREATED_COLUMNS=$((CREATED_COLUMNS + 1))
  fi
}

# kudos_messages — likes column (added after initial schema)
add_column_if_missing "kudos_messages" "likes" "INT NOT NULL DEFAULT 0"

# idea_comments — parentId / likes (pre-reply era tables may lack these)
add_column_if_missing "idea_comments" "parentId" "TEXT REFERENCES idea_comments(id) ON DELETE CASCADE"
add_column_if_missing "idea_comments" "likes"    "INT NOT NULL DEFAULT 0"

# employee_highlights — columns added over time
add_column_if_missing "employee_highlights" "employeeId"   "TEXT"
add_column_if_missing "employee_highlights" "jobTitle"     "TEXT"
add_column_if_missing "employee_highlights" "department"   "TEXT"
add_column_if_missing "employee_highlights" "subtitle"     "TEXT NOT NULL DEFAULT ''"
add_column_if_missing "employee_highlights" "avatarUrl"    "TEXT"
add_column_if_missing "employee_highlights" "startDate"    "TIMESTAMPTZ NOT NULL DEFAULT now()"
add_column_if_missing "employee_highlights" "endDate"      "TIMESTAMPTZ"

# site_branding — evolved from key/value to specific columns
add_column_if_missing "site_branding" "companyName"    "TEXT NOT NULL DEFAULT 'MortgagePros'"
add_column_if_missing "site_branding" "logoData"       "TEXT"
add_column_if_missing "site_branding" "dark_logo_data" "TEXT"
add_column_if_missing "site_branding" "faviconData"    "TEXT"

# directory_snapshots — evolved from JSONB blob to individual columns
add_column_if_missing "directory_snapshots" "display_name"        "TEXT NOT NULL DEFAULT ''"
add_column_if_missing "directory_snapshots" "mail"                "TEXT"
add_column_if_missing "directory_snapshots" "user_principal_name" "TEXT NOT NULL DEFAULT ''"
add_column_if_missing "directory_snapshots" "job_title"           "TEXT"
add_column_if_missing "directory_snapshots" "employee_type"       "TEXT"
add_column_if_missing "directory_snapshots" "department"          "TEXT"
add_column_if_missing "directory_snapshots" "office_location"     "TEXT"
add_column_if_missing "directory_snapshots" "manager_id"          "TEXT"
add_column_if_missing "directory_snapshots" "synced_at"           "TIMESTAMPTZ NOT NULL DEFAULT now()"

# directory_snapshot_state — column name changes
add_column_if_missing "directory_snapshot_state" "last_synced_at" "TIMESTAMPTZ"
add_column_if_missing "directory_snapshot_state" "updated_at"     "TIMESTAMPTZ NOT NULL DEFAULT now()"

# alerts — column name changes (content vs message, createdBy vs authorId)
add_column_if_missing "alerts" "content"    "TEXT NOT NULL DEFAULT ''"
add_column_if_missing "alerts" "createdBy"  "TEXT NOT NULL DEFAULT ''"
add_column_if_missing "alerts" "expires_at" "TIMESTAMPTZ"

# calendar_sync_logs — column changes
add_column_if_missing "calendar_sync_logs" "status"  "TEXT NOT NULL DEFAULT 'success'"
add_column_if_missing "calendar_sync_logs" "message" "TEXT"

# preferred_vendors — columns added over time
add_column_if_missing "preferred_vendors" "labels"                "TEXT"
add_column_if_missing "preferred_vendors" "contact_phone_label"   "TEXT"
add_column_if_missing "preferred_vendors" "secondary_phone"       "TEXT"
add_column_if_missing "preferred_vendors" "secondary_phone_label" "TEXT"
add_column_if_missing "preferred_vendors" "icon_id"               "TEXT"

# video_spotlights — playCount (added later)
add_column_if_missing "video_spotlights" "playCount" "INT NOT NULL DEFAULT 0"

# important_dates — subtitle (added later)
add_column_if_missing "important_dates" "subtitle" "TEXT"

# ══════════════════════════════════════════════════════════════
# 4. INDEXES — create if not exists
# ══════════════════════════════════════════════════════════════
echo ""
echo "── Indexes ────────────────────────────────────────────"

ensure_index() {
  local idx_name="$1" tbl="$2" cols="$3"
  local has=$(run_sql "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = '${idx_name}';")
  if [ "$has" != "1" ]; then
    run_sql "CREATE INDEX \"${idx_name}\" ON \"${tbl}\" (${cols});" > /dev/null
    echo "  ✅ Created index: ${idx_name}"
    CREATED_INDEXES=$((CREATED_INDEXES + 1))
  fi
}

# kudos_messages
ensure_index "kudos_messages_authorId_idx"    "kudos_messages"  '"authorId"'
ensure_index "kudos_messages_recipientId_idx" "kudos_messages"  '"recipientId"'
ensure_index "kudos_messages_createdAt_idx"   "kudos_messages"  '"createdAt"'

# kudos_reactions
ensure_index "kudos_reactions_kudosId_reaction_idx" "kudos_reactions" '"kudosId", reaction'
ensure_index "kudos_reactions_userId_idx"            "kudos_reactions" '"userId"'

# alerts
ensure_index "alerts_active_priority_idx" "alerts" 'active, priority'
ensure_index "alerts_createdBy_idx"       "alerts" '"createdBy"'
ensure_index "alerts_expiresAt_idx"       "alerts" 'expires_at'

# ideas
ensure_index "ideas_status_votes_idx"  "ideas" 'status, votes'
ensure_index "ideas_createdAt_idx"     "ideas" '"createdAt"'

# idea_votes
ensure_index "idea_votes_voterLogtoId_idx" "idea_votes" '"voterLogtoId"'

# idea_comments
ensure_index "idea_comments_ideaId_createdAt_idx" "idea_comments" '"ideaId", "createdAt"'
ensure_index "idea_comments_parentId_idx"         "idea_comments" '"parentId"'

# idea_comment_likes
ensure_index "idea_comment_likes_voterLogtoId_idx" "idea_comment_likes" '"voterLogtoId"'

# quick_links
ensure_index "quick_links_active_sortOrder_idx" "quick_links" 'active, "sortOrder"'

# employee_highlights
ensure_index "employee_highlights_active_startDate_idx" "employee_highlights" 'active, "startDate"'

# directory_snapshots
ensure_index "directory_snapshots_managerId_idx"   "directory_snapshots" 'manager_id'
ensure_index "directory_snapshots_displayName_idx" "directory_snapshots" 'display_name'

# notifications
ensure_index "notifications_userId_read_createdAt_idx" "notifications" '"userId", read, "createdAt"'
ensure_index "notifications_createdAt_idx"             "notifications" '"createdAt"'

# holidays
ensure_index "holidays_date_idx"     "holidays" 'date'
ensure_index "holidays_category_idx" "holidays" 'category'
ensure_index "holidays_visible_idx"  "holidays" 'visible'

# calendar_sync_logs
ensure_index "calendar_sync_logs_syncedAt_idx" "calendar_sync_logs" '"syncedAt"'

# forwarding_schedules
ensure_index "fwd_status_startsAt_idx"   "forwarding_schedules" 'status, "startsAt"'
ensure_index "fwd_status_endsAt_idx"     "forwarding_schedules" 'status, "endsAt"'
ensure_index "fwd_userEmail_status_idx"  "forwarding_schedules" '"userEmail", status'

# tournaments
ensure_index "tournaments_status_idx" "tournaments" 'status'

# tournament_teams
ensure_index "teams_tournamentId_division_idx" "tournament_teams" '"tournamentId", division'

# tournament_matches
ensure_index "matches_tournamentId_round_div_idx" "tournament_matches" '"tournamentId", round, division'
ensure_index "matches_nextMatchId_idx"            "tournament_matches" '"nextMatchId"'

# preferred_vendors
ensure_index "vendors_active_sortOrder_idx" "preferred_vendors" 'active, sort_order'
ensure_index "vendors_category_idx"         "preferred_vendors" 'category'
ensure_index "vendors_featured_idx"         "preferred_vendors" 'featured'

# video_spotlights
ensure_index "spotlights_featured_status_idx" "video_spotlights" 'featured, status'
ensure_index "spotlights_createdAt_idx"       "video_spotlights" '"createdAt"'

# video_spotlight_reactions
ensure_index "vs_reactions_videoId_idx" "video_spotlight_reactions" '"videoId"'

# video_spotlight_comments
ensure_index "vs_comments_videoId_createdAt_idx" "video_spotlight_comments" '"videoId", "createdAt"'
ensure_index "vs_comments_parentId_idx"          "video_spotlight_comments" '"parentId"'

# video_spotlight_comment_likes
ensure_index "vs_comment_likes_voterLogtoId_idx" "video_spotlight_comment_likes" '"voterLogtoId"'

# important_dates
ensure_index "important_dates_active_date_idx"  "important_dates" 'active, date'
ensure_index "important_dates_sortOrder_idx"    "important_dates" '"sortOrder"'

# ══════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════
echo ""
echo "══════════════════════════════════════════════════════"
TOTAL=$((CREATED_ENUMS + CREATED_ENUM_VALUES + CREATED_TABLES + CREATED_COLUMNS + CREATED_INDEXES))
if [ "$TOTAL" -eq 0 ]; then
  echo "✅ Database is fully up to date — nothing to create."
else
  echo "✅ Migration complete:"
  [ "$CREATED_ENUMS"       -gt 0 ] && echo "   • ${CREATED_ENUMS} enum(s) created"
  [ "$CREATED_ENUM_VALUES" -gt 0 ] && echo "   • ${CREATED_ENUM_VALUES} enum value(s) added"
  [ "$CREATED_TABLES"      -gt 0 ] && echo "   • ${CREATED_TABLES} table(s) created"
  [ "$CREATED_COLUMNS"     -gt 0 ] && echo "   • ${CREATED_COLUMNS} column(s) added"
  [ "$CREATED_INDEXES"     -gt 0 ] && echo "   • ${CREATED_INDEXES} index(es) created"
fi
echo "══════════════════════════════════════════════════════"
