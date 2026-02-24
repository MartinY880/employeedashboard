-- CreateEnum
CREATE TYPE "ForwardingStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('INFO', 'WARNING', 'BIRTHDAY', 'NEW_HIRE', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('ACTIVE', 'SELECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('SETUP', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "logtoId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kudos_messages" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kudos_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "AlertType" NOT NULL DEFAULT 'INFO',
    "priority" "Priority" NOT NULL DEFAULT 'LOW',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ideas" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "status" "IdeaStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_links" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'link',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_highlights" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "employeeName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_branding" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "companyName" TEXT NOT NULL DEFAULT 'MortgagePros',
    "logoData" TEXT,
    "faviconData" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_branding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directory_snapshots" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "mail" TEXT,
    "user_principal_name" TEXT NOT NULL,
    "job_title" TEXT,
    "employee_type" TEXT,
    "department" TEXT,
    "office_location" TEXT,
    "manager_id" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "directory_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directory_snapshot_state" (
    "id" TEXT NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "directory_snapshot_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forwarding_schedules" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "forwardToEmail" TEXT NOT NULL,
    "forwardToName" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "ForwardingStatus" NOT NULL DEFAULT 'PENDING',
    "graphRuleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forwarding_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "TournamentStatus" NOT NULL DEFAULT 'SETUP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_teams" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "player1Name" TEXT NOT NULL,
    "player2Name" TEXT NOT NULL,
    "seed" INTEGER NOT NULL DEFAULT 0,
    "division" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_matches" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "division" TEXT NOT NULL,
    "team1Id" TEXT,
    "team2Id" TEXT,
    "winnerId" TEXT,
    "team1Score" INTEGER,
    "team2Score" INTEGER,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "nextMatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_logtoId_key" ON "users"("logtoId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "kudos_messages_authorId_idx" ON "kudos_messages"("authorId");

-- CreateIndex
CREATE INDEX "kudos_messages_recipientId_idx" ON "kudos_messages"("recipientId");

-- CreateIndex
CREATE INDEX "kudos_messages_createdAt_idx" ON "kudos_messages"("createdAt");

-- CreateIndex
CREATE INDEX "alerts_active_priority_idx" ON "alerts"("active", "priority");

-- CreateIndex
CREATE INDEX "alerts_createdBy_idx" ON "alerts"("createdBy");

-- CreateIndex
CREATE INDEX "ideas_status_votes_idx" ON "ideas"("status", "votes");

-- CreateIndex
CREATE INDEX "ideas_createdAt_idx" ON "ideas"("createdAt");

-- CreateIndex
CREATE INDEX "quick_links_active_sortOrder_idx" ON "quick_links"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "employee_highlights_active_startDate_idx" ON "employee_highlights"("active", "startDate");

-- CreateIndex
CREATE INDEX "directory_snapshots_manager_id_idx" ON "directory_snapshots"("manager_id");

-- CreateIndex
CREATE INDEX "directory_snapshots_display_name_idx" ON "directory_snapshots"("display_name");

-- CreateIndex
CREATE INDEX "forwarding_schedules_status_startsAt_idx" ON "forwarding_schedules"("status", "startsAt");

-- CreateIndex
CREATE INDEX "forwarding_schedules_status_endsAt_idx" ON "forwarding_schedules"("status", "endsAt");

-- CreateIndex
CREATE INDEX "forwarding_schedules_userEmail_status_idx" ON "forwarding_schedules"("userEmail", "status");

-- CreateIndex
CREATE INDEX "tournaments_status_idx" ON "tournaments"("status");

-- CreateIndex
CREATE INDEX "tournament_teams_tournamentId_division_idx" ON "tournament_teams"("tournamentId", "division");

-- CreateIndex
CREATE INDEX "tournament_matches_tournamentId_round_division_idx" ON "tournament_matches"("tournamentId", "round", "division");

-- CreateIndex
CREATE INDEX "tournament_matches_nextMatchId_idx" ON "tournament_matches"("nextMatchId");

-- AddForeignKey
ALTER TABLE "kudos_messages" ADD CONSTRAINT "kudos_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kudos_messages" ADD CONSTRAINT "kudos_messages_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_teams" ADD CONSTRAINT "tournament_teams_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_team1Id_fkey" FOREIGN KEY ("team1Id") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_team2Id_fkey" FOREIGN KEY ("team2Id") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "tournament_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
