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
  }
}
