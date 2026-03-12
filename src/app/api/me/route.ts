// ProConnect — Current User API
// GET: Returns minimal info about the currently signed-in user

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";

export async function GET() {
  const { isAuthenticated, user } = await getAuthUser();
  if (!isAuthenticated || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve DB user ID so the frontend can compare against authorId fields
  const dbUser = await prisma.user.findFirst({ where: { logtoId: user.sub }, select: { id: true } });

  return NextResponse.json({
    sub: user.sub,
    dbUserId: dbUser?.id || null,
    name: user.name,
    email: user.email,
  });
}
