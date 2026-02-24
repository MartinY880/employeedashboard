// ProConnect — OOO (Out of Office) API Route
// Reads/writes OOF status via Microsoft Graph API.
// Email forwarding is stored in the database as a ForwardingSchedule.
// A cron job (/api/ooo/cron) activates/deactivates the Graph inbox rule
// when the scheduled window arrives.  If the start date is already in the
// past at creation time, the rule is activated immediately.

import { NextResponse } from "next/server";
import {
  isGraphConfigured,
  getOofStatus,
  setOofStatus,
  setForwardingRule,
  removeForwardingRule,
} from "@/lib/graph";
import { getAuthUser } from "@/lib/logto";
import { prisma } from "@/lib/prisma";

type ForwardingPayload = {
  enabled: boolean;
  forwardTo: string | null;
  forwardToName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  isActive: boolean;
};

// ─── Demo OOF status (when Graph API is not configured) ──

const demoOof = {
  status: "disabled" as const,
  externalAudience: "all" as const,
  scheduledStartDateTime: null,
  scheduledEndDateTime: null,
  internalReplyMessage: null,
  externalReplyMessage: null,
  forwarding: null as ForwardingPayload | null,
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

    // Fetch OOF settings from Graph
    const settings = await getOofStatus(upn);

    // Fetch active/pending forwarding schedule from DB
    const schedule = await prisma.forwardingSchedule.findFirst({
      where: {
        userEmail: upn,
        status: { in: ["PENDING", "ACTIVE"] },
      },
      orderBy: { createdAt: "desc" },
    });

    const forwardingPayload: ForwardingPayload | null = schedule
      ? {
          enabled: true,
          forwardTo: schedule.forwardToEmail,
          forwardToName: schedule.forwardToName || schedule.forwardToEmail,
          startsAt: schedule.startsAt.toISOString(),
          endsAt: schedule.endsAt.toISOString(),
          status: schedule.status as ForwardingPayload["status"],
          isActive: schedule.status === "ACTIVE",
        }
      : null;

    return NextResponse.json({
      status: settings.status || "disabled",
      externalAudience: settings.externalAudience || "all",
      scheduledStartDateTime: settings.scheduledStartDateTime?.dateTime || null,
      scheduledEndDateTime: settings.scheduledEndDateTime?.dateTime || null,
      internalReplyMessage: settings.internalReplyMessage || null,
      externalReplyMessage: settings.externalReplyMessage || null,
      forwarding: forwardingPayload,
    });
  } catch (error) {
    console.error("[OOO API] GET error:", error);
    return NextResponse.json(demoOof);
  }
}

// ─── POST: Set OOF settings + schedule email forwarding ──

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!isGraphConfigured) {
      const demoForwarding: ForwardingPayload | null = body.forwardToEmail
        ? {
            enabled: true,
            forwardTo: body.forwardToEmail,
            forwardToName: body.forwardToName || body.forwardToEmail,
            startsAt: body.scheduledStartDateTime || null,
            endsAt: body.scheduledEndDateTime || null,
            status: "PENDING",
            isActive: false,
          }
        : null;

      return NextResponse.json({
        status: body.status || "disabled",
        externalAudience: body.externalAudience || "all",
        scheduledStartDateTime: body.scheduledStartDateTime || null,
        scheduledEndDateTime: body.scheduledEndDateTime || null,
        internalReplyMessage: body.internalReplyMessage || null,
        externalReplyMessage: body.externalReplyMessage || null,
        forwarding: demoForwarding,
        _demo: true,
      });
    }

    const upn = user.email;

    // ── 1. Build & set auto-reply via Graph ──
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

    const result = await setOofStatus(upn, graphSettings);

    // ── 2. Handle forwarding schedule ──
    let forwardingResult: ForwardingPayload | null = null;
    let forwardingError: string | null = null;

    if (body.forwardToEmail && body.scheduledStartDateTime && body.scheduledEndDateTime) {
      // Cancel any existing PENDING/ACTIVE schedules for this user
      const existing = await prisma.forwardingSchedule.findMany({
        where: {
          userEmail: upn,
          status: { in: ["PENDING", "ACTIVE"] },
        },
      });

      for (const old of existing) {
        if (old.status === "ACTIVE") {
          // Remove the Graph rule before cancelling
          try {
            await removeForwardingRule(upn);
          } catch (e) {
            console.warn("[OOO API] Failed to remove old forwarding rule:", e);
          }
        }
        await prisma.forwardingSchedule.update({
          where: { id: old.id },
          data: { status: "CANCELLED" },
        });
      }

      const startsAt = new Date(body.scheduledStartDateTime);
      const endsAt = new Date(body.scheduledEndDateTime);
      const now = new Date();

      // Start date already in the past → create rule ENABLED
      // Future start date → create rule DISABLED (cron will enable it)
      const shouldActivateNow = startsAt <= now && endsAt > now;

      console.log("[OOO API] Forwarding schedule:", {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        now: now.toISOString(),
        shouldActivateNow,
        startInPast: startsAt <= now,
        endInFuture: endsAt > now,
      });

      let graphRuleId: string | null = null;
      let scheduleStatus: "PENDING" | "ACTIVE" = "PENDING";

      if (shouldActivateNow) {
        // Start date is already in the past — create the rule in Graph NOW, enabled
        try {
          console.log(`[OOO API] Start date is in the past — creating ENABLED rule for ${upn}`);
          const rule = await setForwardingRule(
            upn,
            body.forwardToEmail,
            body.forwardToName || body.forwardToEmail,
            true // enabled immediately
          );
          graphRuleId = rule.id;
          scheduleStatus = "ACTIVE";
          console.log(`[OOO API] Rule created and enabled: id=${rule.id}`);
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.error("[OOO API] Failed to create forwarding rule:", errMsg, e);
          forwardingError = `Failed to create forwarding rule: ${errMsg}`;
          // Still save the schedule — cron will retry
        }
      } else {
        // Start date is in the future — do NOT create the rule yet.
        // Just save the schedule to the database. The cron job will
        // create and enable the rule when startsAt arrives.
        console.log(`[OOO API] Start date is in the future — saving schedule only (no Graph rule yet)`);
      }

      // Save the schedule to the database
      const schedule = await prisma.forwardingSchedule.create({
        data: {
          userEmail: upn,
          forwardToEmail: body.forwardToEmail,
          forwardToName: body.forwardToName || null,
          startsAt,
          endsAt,
          status: scheduleStatus,
          graphRuleId,
        },
      });

      forwardingResult = {
        enabled: true,
        forwardTo: schedule.forwardToEmail,
        forwardToName: schedule.forwardToName || schedule.forwardToEmail,
        startsAt: schedule.startsAt.toISOString(),
        endsAt: schedule.endsAt.toISOString(),
        status: schedule.status as ForwardingPayload["status"],
        isActive: schedule.status === "ACTIVE",
      };
    } else if (body.status === "disabled" || body.removeForwarding) {
      // Disable: cancel any active/pending schedules and remove Graph rule
      const existing = await prisma.forwardingSchedule.findMany({
        where: {
          userEmail: upn,
          status: { in: ["PENDING", "ACTIVE"] },
        },
      });

      for (const old of existing) {
        if (old.status === "ACTIVE") {
          try {
            await removeForwardingRule(upn);
          } catch (e) {
            console.warn("[OOO API] Failed to remove forwarding rule:", e);
          }
        }
        await prisma.forwardingSchedule.update({
          where: { id: old.id },
          data: { status: "CANCELLED" },
        });
      }

      forwardingResult = null;
    }

    const response: Record<string, unknown> = {
      status: result?.status || body.status || "disabled",
      externalAudience: result?.externalAudience || body.externalAudience || "all",
      scheduledStartDateTime:
        result?.scheduledStartDateTime?.dateTime || body.scheduledStartDateTime || null,
      scheduledEndDateTime:
        result?.scheduledEndDateTime?.dateTime || body.scheduledEndDateTime || null,
      internalReplyMessage: result?.internalReplyMessage || body.internalReplyMessage || null,
      externalReplyMessage: result?.externalReplyMessage || body.externalReplyMessage || null,
      forwarding: forwardingResult,
    };

    // Surface forwarding errors so the client can see what went wrong
    if (forwardingError) {
      response.warning = forwardingError;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[OOO API] POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update OOF settings";
    return NextResponse.json(
      { error: message || "Failed to update OOF settings" },
      { status: 500 }
    );
  }
}
