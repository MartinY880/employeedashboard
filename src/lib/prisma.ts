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
 */
export async function ensureDbUser(
  logtoId: string,
  email: string,
  displayName: string,
  role: "ADMIN" | "EMPLOYEE" = "EMPLOYEE",
) {
  // 1. Fast path: user already exists by logtoId
  const byLogto = await prisma.user.findUnique({ where: { logtoId } });
  if (byLogto) {
    // Keep displayName in sync
    if (byLogto.displayName !== displayName) {
      return prisma.user.update({
        where: { id: byLogto.id },
        data: { displayName },
      });
    }
    return byLogto;
  }

  // 2. Check if a directory stub already owns this email
  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail && byEmail.logtoId.startsWith("directory-")) {
      // Upgrade the stub with the real Logto identity
      return prisma.user.update({
        where: { id: byEmail.id },
        data: { logtoId, displayName, role },
      });
    }
  }

  // 3. Create new user
  return prisma.user.create({
    data: { logtoId, email, displayName, role },
  });
}
