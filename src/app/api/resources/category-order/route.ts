import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { loadCategoryOrder, saveCategoryOrder } from "@/lib/resources-store";

export async function GET() {
  const order = await loadCategoryOrder();
  return NextResponse.json({ order });
}

export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_RESOURCES)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    if (!Array.isArray(body.order) || body.order.some((item: unknown) => typeof item !== "string")) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await saveCategoryOrder(body.order as string[]);
    return NextResponse.json({ order: body.order });
  } catch {
    return NextResponse.json({ error: "Failed to save category order" }, { status: 500 });
  }
}
