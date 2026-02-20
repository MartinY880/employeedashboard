// ProConnect — OOO (Out of Office) API Route
// Reads/writes OOF status + email forwarding via Microsoft Graph API

import { NextResponse } from "next/server";
import {
  isGraphConfigured,
  getOofStatus,
  setOofStatus,
  getForwardingRule,
  setForwardingRule,
  removeForwardingRule,
} from "@/lib/graph";
import { getAuthUser } from "@/lib/logto";

// ─── Demo OOF status (when Graph API is not configured) ──

const demoOof = {
  status: "disabled" as const,
  externalAudience: "all" as const,
  scheduledStartDateTime: null,
  scheduledEndDateTime: null,
  internalReplyMessage: null,
  externalReplyMessage: null,
  forwarding: null as { enabled: boolean; forwardTo: string } | null,
};

// ─── GET: Read current OOF status + forwarding ───────────

export async function GET() {
  try {
    if (!isGraphConfigured) {
      return NextResponse.json(demoOof);
    }

    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json(demoOof);
    }

    const upn = user.email;

    // Fetch OOF settings and forwarding rule in parallel
    const [settings, forwardingRule] = await Promise.all([
      getOofStatus(upn),
      getForwardingRule(upn),
    ]);

    return NextResponse.json({
      status: settings.status || "disabled",
      externalAudience: settings.externalAudience || "all",
      scheduledStartDateTime: settings.scheduledStartDateTime?.dateTime || null,
      scheduledEndDateTime: settings.scheduledEndDateTime?.dateTime || null,
      internalReplyMessage: settings.internalReplyMessage || null,
      externalReplyMessage: settings.externalReplyMessage || null,
      forwarding: forwardingRule
        ? {
            enabled: forwardingRule.isEnabled,
            forwardTo: forwardingRule.forwardTo?.[0]?.emailAddress?.address || null,
            forwardToName: forwardingRule.forwardTo?.[0]?.emailAddress?.name || null,
          }
        : null,
    });
  } catch (error) {
    console.error("[OOO API] GET error:", error);
    return NextResponse.json(demoOof);
  }
}

// ─── POST: Set OOF settings + email forwarding ──────────

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!isGraphConfigured) {
      // In demo mode, just echo back the settings
      return NextResponse.json({
        status: body.status || "disabled",
        externalAudience: body.externalAudience || "all",
        scheduledStartDateTime: body.scheduledStartDateTime || null,
        scheduledEndDateTime: body.scheduledEndDateTime || null,
        internalReplyMessage: body.internalReplyMessage || null,
        externalReplyMessage: body.externalReplyMessage || null,
        forwarding: body.forwardToEmail
          ? { enabled: true, forwardTo: body.forwardToEmail, forwardToName: body.forwardToName || body.forwardToEmail }
          : null,
        _demo: true,
      });
    }

    const upn = user.email;

    // Build Graph API-compatible settings object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const graphSettings: Record<string, any> = {
      status: body.status || "disabled",
      externalAudience: body.externalAudience || "all",
    };

    if (body.status === "scheduled") {
      if (!body.scheduledStartDateTime || !body.scheduledEndDateTime) {
        return NextResponse.json(
          { error: "Start and end dates are required for scheduled OOF" },
          { status: 400 }
        );
      }
      graphSettings.scheduledStartDateTime = {
        dateTime: body.scheduledStartDateTime,
        timeZone: "UTC",
      };
      graphSettings.scheduledEndDateTime = {
        dateTime: body.scheduledEndDateTime,
        timeZone: "UTC",
      };
    }

    if (body.internalReplyMessage) {
      graphSettings.internalReplyMessage = body.internalReplyMessage;
    }
    if (body.externalReplyMessage) {
      graphSettings.externalReplyMessage = body.externalReplyMessage;
    }

    // Handle email forwarding
    let forwardingResult = null;
    if (body.forwardToEmail) {
      // Enable forwarding
      await setForwardingRule(
        upn,
        body.forwardToEmail,
        body.forwardToName || body.forwardToEmail
      );
      forwardingResult = {
        enabled: true,
        forwardTo: body.forwardToEmail,
        forwardToName: body.forwardToName || body.forwardToEmail,
      };
    } else if (body.status === "disabled" || body.removeForwarding) {
      // Disable forwarding when OOF is turned off or explicitly requested
      await removeForwardingRule(upn);
      forwardingResult = null;
    }

    // Set OOF auto-reply
    const result = await setOofStatus(upn, graphSettings);

    return NextResponse.json({
      status: result?.status || body.status || "disabled",
      externalAudience: result?.externalAudience || body.externalAudience || "all",
      scheduledStartDateTime: result?.scheduledStartDateTime?.dateTime || body.scheduledStartDateTime || null,
      scheduledEndDateTime: result?.scheduledEndDateTime?.dateTime || body.scheduledEndDateTime || null,
      internalReplyMessage: result?.internalReplyMessage || body.internalReplyMessage || null,
      externalReplyMessage: result?.externalReplyMessage || body.externalReplyMessage || null,
      forwarding: forwardingResult,
    });
  } catch (error) {
    console.error("[OOO API] POST error:", error);
    return NextResponse.json(
      { error: "Failed to update OOF settings" },
      { status: 500 }
    );
  }
}
