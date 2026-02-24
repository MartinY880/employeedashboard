// ProConnect — Forwarding Schedule Processor
// Shared logic used by both:
//   1. The instrumentation hook (automatic, runs every 60s)
//   2. The /api/ooo/cron API route (manual trigger)

import { prisma } from "@/lib/prisma";
import {
  isGraphConfigured,
  setForwardingRule,
  enableForwardingRule,
  disableForwardingRule,
  removeForwardingRule,
} from "@/lib/graph";

export interface ScheduleResult {
  activated: number;
  deactivated: number;
  missed: number;
  errors: string[];
}

/**
 * Process all forwarding schedules:
 *  - Activate PENDING schedules whose startsAt <= now
 *  - Deactivate ACTIVE schedules whose endsAt <= now
 *  - Mark missed PENDING schedules as EXPIRED
 */
export async function processForwardingSchedules(): Promise<ScheduleResult> {
  if (!isGraphConfigured) {
    console.log("[Scheduler] Graph API not configured, skipping");
    return { activated: 0, deactivated: 0, missed: 0, errors: [] };
  }

  const now = new Date();
  let activated = 0;
  let deactivated = 0;
  const errors: string[] = [];

  // ── 1. Activate PENDING schedules whose start time has arrived ──
  const pendingSchedules = await prisma.forwardingSchedule.findMany({
    where: {
      status: "PENDING",
      startsAt: { lte: now },
      endsAt: { gt: now }, // don't activate if already expired
    },
  });

  for (const schedule of pendingSchedules) {
    try {
      console.log(
        `[Scheduler] Activating forwarding for ${schedule.userEmail} → ${schedule.forwardToEmail}`
      );

      let ruleId = schedule.graphRuleId;

      if (ruleId) {
        // Rule already exists in Graph (created disabled) — just enable it
        await enableForwardingRule(schedule.userEmail);
      } else {
        // Rule wasn't created yet — create it now, enabled
        const rule = await setForwardingRule(
          schedule.userEmail,
          schedule.forwardToEmail,
          schedule.forwardToName || schedule.forwardToEmail,
          true // enabled
        );
        ruleId = rule.id;
      }

      await prisma.forwardingSchedule.update({
        where: { id: schedule.id },
        data: {
          status: "ACTIVE",
          graphRuleId: ruleId,
        },
      });

      activated++;
      console.log(`[Scheduler] ✓ Activated forwarding for ${schedule.userEmail}`);
    } catch (error) {
      const msg = `Failed to activate forwarding for ${schedule.userEmail}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(`[Scheduler] ${msg}`);
      errors.push(msg);
    }
  }

  // ── 2. Deactivate ACTIVE schedules whose end time has passed ──
  const expiredSchedules = await prisma.forwardingSchedule.findMany({
    where: {
      status: "ACTIVE",
      endsAt: { lte: now },
    },
  });

  for (const schedule of expiredSchedules) {
    try {
      console.log(
        `[Scheduler] Deactivating forwarding for ${schedule.userEmail}`
      );

      // Disable then remove the rule from Graph
      await disableForwardingRule(schedule.userEmail);
      await removeForwardingRule(schedule.userEmail);

      await prisma.forwardingSchedule.update({
        where: { id: schedule.id },
        data: { status: "EXPIRED" },
      });

      deactivated++;
      console.log(`[Scheduler] ✓ Deactivated forwarding for ${schedule.userEmail}`);
    } catch (error) {
      const msg = `Failed to deactivate forwarding for ${schedule.userEmail}: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(`[Scheduler] ${msg}`);
      errors.push(msg);
    }
  }

  // ── 3. Mark PENDING schedules that are already past their end as EXPIRED ──
  const missedSchedules = await prisma.forwardingSchedule.updateMany({
    where: {
      status: "PENDING",
      endsAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });

  if (activated > 0 || deactivated > 0 || missedSchedules.count > 0 || errors.length > 0) {
    console.log(
      `[Scheduler] Complete — activated: ${activated}, deactivated: ${deactivated}, missed: ${missedSchedules.count}, errors: ${errors.length}`
    );
  }

  return {
    activated,
    deactivated,
    missed: missedSchedules.count,
    errors,
  };
}
