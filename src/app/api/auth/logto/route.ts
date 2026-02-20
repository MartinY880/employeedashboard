// ProConnect — Auth API Route
// GET: Return current user context (for client components)
// POST: Trigger sign-out

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";

export async function GET() {
  const { isAuthenticated, user } = await getAuthUser();
  return NextResponse.json({ isAuthenticated, user });
}
