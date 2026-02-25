import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

type TopNavMenuItem = {
  id: string;
  label: string;
  href: string;
  active: boolean;
  sortOrder: number;
  iframeUrl?: string;
};

function normalizePath(path: string): string {
  if (!path) return "/";
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/";
}

export default async function DynamicIframePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const requestedPath = normalizePath(`/${(slug || []).join("/")}`);

  try {
    const setting = await prisma.calendarSetting.findUnique({ where: { id: "topnav_menu" } });
    const parsed = setting?.data ? (JSON.parse(setting.data) as TopNavMenuItem[]) : [];
    const item = (Array.isArray(parsed) ? parsed : []).find((menuItem) => {
      const href = normalizePath(String(menuItem.href || ""));
      return href === requestedPath && menuItem.active !== false && !!String(menuItem.iframeUrl || "").trim();
    });

    if (!item) {
      notFound();
    }

    const src = String(item.iframeUrl || "").trim();

    return (
      <div className="max-w-[1920px] mx-auto px-6 sm:px-10 lg:px-14 py-4 sm:py-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <iframe
            id={`embedded-${item.id}`}
            title={item.label || "Embedded Content"}
            src={src}
            className="w-full h-[78vh]"
            style={{ border: "none" }}
            allow="autoplay; encrypted-media"
          />
        </div>
      </div>
    );
  } catch {
    notFound();
  }
}
