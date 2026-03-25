// ProConnect — Instrumentation Hook
// Next.js calls this once when the server starts.
// We use it to start periodic timers for forwarding schedules and exam cleanup.

export async function register() {
  // Only run on the server (Node.js runtime), not in the Edge runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const INTERVAL_MS = 60_000; // Check every 60 seconds

    console.log(
      `[Instrumentation] Starting forwarding schedule checker (every ${INTERVAL_MS / 1000}s)`
    );

    // Dynamic import to avoid pulling server-only modules into edge/client bundles
    const { processForwardingSchedules } = await import(
      "@/lib/forwarding-scheduler"
    );

    // Run once immediately on startup, then repeat on interval
    setTimeout(() => {
      processForwardingSchedules().catch((err) =>
        console.error("[Instrumentation] Initial schedule check failed:", err)
      );
    }, 5_000); // 5s delay to let DB connections settle

    setInterval(() => {
      processForwardingSchedules().catch((err) =>
        console.error("[Instrumentation] Schedule check failed:", err)
      );
    }, INTERVAL_MS);

    // ── Exam Pass Record Cleanup (daily at midnight EST) ──
    const { cleanupExpiredExamRecords } = await import(
      "@/lib/exam-cleanup"
    );

    function scheduleMidnightEST() {
      const now = new Date();
      // Compute next midnight in America/New_York
      const estNow = new Date(
        now.toLocaleString("en-US", { timeZone: "America/New_York" })
      );
      const nextMidnight = new Date(estNow);
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);
      // Convert back to UTC offset
      const msUntilMidnight = nextMidnight.getTime() - estNow.getTime();
      console.log(
        `[Instrumentation] Exam cleanup scheduled in ${Math.round(msUntilMidnight / 60_000)} minutes`
      );
      setTimeout(() => {
        cleanupExpiredExamRecords().catch((err) =>
          console.error("[Instrumentation] Exam cleanup failed:", err)
        );
        // Re-schedule for the next day
        scheduleMidnightEST();
      }, msUntilMidnight);
    }

    // Run once on startup (catch up if server was down at midnight)
    setTimeout(() => {
      cleanupExpiredExamRecords().catch((err) =>
        console.error("[Instrumentation] Initial exam cleanup failed:", err)
      );
    }, 10_000);

    scheduleMidnightEST();

    // ── Role Reconciliation (every 30 minutes) ──
    const ROLE_SYNC_INTERVAL_MS = 30 * 60_000; // 30 minutes
    const { isM2MConfigured, syncUserRole, mapJobTitleToRoleName } =
      await import("@/lib/logto-management");
    const { prisma } = await import("@/lib/prisma");

    async function reconcileRoles() {
      if (!isM2MConfigured) return;
      try {
        const snapshots = await prisma.directorySnapshot.findMany({
          select: { mail: true, jobTitle: true },
          where: { mail: { not: null } },
        });

        let synced = 0;
        for (const snap of snapshots) {
          if (!snap.mail) continue;
          const targetRole = await mapJobTitleToRoleName(snap.jobTitle);
          if (targetRole.toLowerCase() === "employee") continue;
          const result = await syncUserRole(snap.mail, snap.jobTitle);
          if (result.status === "updated") synced++;
          if (result.status === "error") {
            console.warn(`[Role Reconciliation] ${snap.mail}: ${result.detail}`);
          }
        }
        if (synced > 0) {
          console.log(`[Role Reconciliation] Updated ${synced} user(s)`);
        }
      } catch (err) {
        console.error("[Role Reconciliation] Failed:", err);
      }
    }

    if (isM2MConfigured) {
      console.log(
        `[Instrumentation] Starting role reconciliation (every ${ROLE_SYNC_INTERVAL_MS / 60_000} min)`
      );

      // Initial run after 30s delay
      setTimeout(() => {
        reconcileRoles().catch((err) =>
          console.error("[Instrumentation] Initial role reconciliation failed:", err)
        );
      }, 30_000);

      setInterval(() => {
        reconcileRoles().catch((err) =>
          console.error("[Instrumentation] Role reconciliation failed:", err)
        );
      }, ROLE_SYNC_INTERVAL_MS);
    }
  }
}
