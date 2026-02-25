// ProConnect — Current User API
// GET: Returns minimal info about the currently signed-in user

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";

export async function GET() {
  const { isAuthenticated, user } = await getAuthUser();
  if (!isAuthenticated || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    sub: user.sub,
    name: user.name,
    email: user.email,
  });
}
