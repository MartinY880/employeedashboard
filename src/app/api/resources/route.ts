import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import {
  deleteStoredDocument,
  loadResources,
  ResourceItem,
  saveResources,
} from "@/lib/resources-store";

function isValidHref(href: string): boolean {
  if (!href) return false;
  if (href.startsWith("/")) return true;

  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return href === "#";
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const all = searchParams.get("all") === "true";

  const resources = await loadResources();
  const visible = all ? resources : resources.filter((resource) => resource.active);
  return NextResponse.json({ resources: visible });
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_QUICKLINKS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const href = String(body.href ?? "").trim();
    const category = String(body.category ?? "").trim();

    if (!title || !description || !category || !isValidHref(href)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const resources = await loadResources();
    const resource: ResourceItem = {
      id: `res-${randomUUID()}`,
      title,
      description,
      href,
      category,
      sortOrder: resources.length,
      active: true,
      kind: "link",
      document: null,
    };

    resources.push(resource);
    await saveResources(resources);

    return NextResponse.json({ resource }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create resource" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_QUICKLINKS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const id = String(body.id ?? "").trim();

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const resources = await loadResources();
    const index = resources.findIndex((resource) => resource.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    const next = { ...resources[index] };

    if (body.title !== undefined) next.title = String(body.title).trim();
    if (body.description !== undefined) next.description = String(body.description).trim();
    if (body.href !== undefined) next.href = String(body.href).trim();
    if (body.category !== undefined) next.category = String(body.category).trim();
    if (body.active !== undefined) next.active = Boolean(body.active);
    if (body.sortOrder !== undefined) next.sortOrder = Number(body.sortOrder);
    if (body.kind !== undefined && (body.kind === "link" || body.kind === "document")) {
      next.kind = body.kind;
    }

    if (!next.title || !next.description || !next.category || !isValidHref(next.href)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    resources[index] = next;
    await saveResources(resources);

    return NextResponse.json({ resource: next });
  } catch {
    return NextResponse.json({ error: "Failed to update resource" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_QUICKLINKS)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const resources = await loadResources();
    const target = resources.find((resource) => resource.id === id);
    const filtered = resources.filter((resource) => resource.id !== id);

    if (filtered.length === resources.length) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    if (target?.kind === "document" && target.document?.storageName) {
      await deleteStoredDocument(target.document.storageName);
    }

    const reindexed = filtered
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((resource, index) => ({ ...resource, sortOrder: index }));

    await saveResources(reindexed);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete resource" }, { status: 500 });
  }
}
