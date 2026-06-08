// ProConnect — Prisma Client Singleton
// Prevents multiple Prisma instances in development (hot reload)

import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL!;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Find or create a User record for an authenticated Logto user.
 * Handles the case where a "directory stub" user already owns the email
 * (logtoId starts with "directory-") — upgrades the stub in place.
 *
 * entraId is the Azure Object ID (oid claim). It never changes even when a
 * user's UPN/email changes, so it is the stable identity anchor.
 */
export async function ensureDbUser(
  logtoId: string,
  email: string,
  displayName: string,
  role: "ADMIN" | "EMPLOYEE" = "EMPLOYEE",
  entraId?: string | null,
) {
  // 1. Fast path: user already exists by logtoId
  const byLogto = await prisma.user.findUnique({ where: { logtoId } });
  if (byLogto) {
    // Keep profile fields in sync with Logto
    const updates: Record<string, string> = {};
    if (byLogto.displayName !== displayName) updates.displayName = displayName;
    if (email && byLogto.email !== email) updates.email = email;
    if (byLogto.role !== role) updates.role = role;
    if (entraId && !byLogto.entraId) updates.entraId = entraId;

    if (Object.keys(updates).length > 0) {
      return prisma.user.update({
        where: { id: byLogto.id },
        data: updates,
      });
    }
    return byLogto;
  }

  // 2. UPN-change recovery: find an existing user by entraId.
  //    When a user's UPN/email changes in Azure, Logto may create a new account
  //    (new logtoId). The entraId (Azure Object ID) lets us reconnect to their
  //    existing DB record rather than creating a duplicate.
  if (entraId) {
    const byEntraId = await prisma.user.findUnique({ where: { entraId } });
    if (byEntraId) {
      return prisma.user.update({
        where: { id: byEntraId.id },
        data: {
          logtoId,
          ...(email && byEntraId.email !== email ? { email } : {}),
          ...(byEntraId.displayName !== displayName ? { displayName } : {}),
          ...(byEntraId.role !== role ? { role } : {}),
        },
      });
    }
  }

  // 3. Check if a directory stub already owns this email
  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail && byEmail.logtoId.startsWith("directory-")) {
      // Upgrade the stub with the real Logto identity
      const upgraded = await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          logtoId,
          displayName,
          role,
          ...(entraId && !byEmail.entraId ? { entraId } : {}),
        },
      });

      // Fix any ideas/comments that stored the SSO sub as userId
      // (mirrors Props pattern: resolve by email at point of interaction)
      await prisma.idea.updateMany({
        where: { userId: logtoId },
        data: { userId: upgraded.id },
      });
      await prisma.ideaComment.updateMany({
        where: { userId: logtoId },
        data: { userId: upgraded.id },
      });

      return upgraded;
    }
  }

  // 4. Create new user
  return prisma.user.create({
    data: {
      logtoId,
      email,
      displayName,
      role,
      ...(entraId ? { entraId } : {}),
    },
  });
}
