// ProConnect — Instrumentation Hook
// Next.js calls this once when the server starts.
// We use it to start a periodic timer that processes forwarding schedules.

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
  }
}
