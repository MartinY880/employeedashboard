// ProConnect — Salesforce Report Panels: Describe Report
// POST → Admin describes a Salesforce report URL to get its columns

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { describeReport, extractReportId } from "@/lib/salesforce-client";

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_SALESFORCE_REPORT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const reportUrl = String(body.reportUrl || "");
    const reportId = extractReportId(reportUrl);

    if (!reportId) {
      return NextResponse.json({ error: "Invalid Salesforce report URL or ID" }, { status: 400 });
    }

    const result = await describeReport(reportId);

    return NextResponse.json({
      reportId,
      reportName: result.reportName,
      reportFormat: result.reportFormat,
      columns: result.columns,
    });
  } catch (err) {
    console.error("[SF Panels] Describe error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
