// ProConnect — Exam Pass Record Cleanup
// Deletes exam_pass_records older than 30 days.
// Called daily at midnight EST from instrumentation.ts.

import { prisma } from "@/lib/prisma";

export async function cleanupExpiredExamRecords() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const { count } = await prisma.examPassRecord.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  if (count > 0) {
    console.log(`[ExamCleanup] Deleted ${count} expired exam pass record(s)`);
  }

  // Also clean up exam-type celebration events (cascade deletes their comments + likes)
  const { count: eventCount } = await prisma.celebrationEvent.deleteMany({
    where: { type: "exam", eventDate: { lt: cutoff } },
  });

  if (eventCount > 0) {
    console.log(`[ExamCleanup] Deleted ${eventCount} expired exam celebration event(s)`);
  }
}
