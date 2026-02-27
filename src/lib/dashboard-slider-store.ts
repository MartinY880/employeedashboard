import { prisma } from "@/lib/prisma";
import type { DashboardSliderMeta } from "@/lib/dashboard-slider";

export async function saveDashboardSliderMeta(meta: DashboardSliderMeta): Promise<void> {
  await prisma.calendarSetting.upsert({
    where: { id: "dashboard_slider_meta" },
    update: { data: JSON.stringify(meta) },
    create: { id: "dashboard_slider_meta", data: JSON.stringify(meta) },
  });
}
