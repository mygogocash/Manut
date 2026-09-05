import type { Db } from "@nexora/db";

/** Cron-only missed check-in/out scanner — stub until Cloud Scheduler wiring. */
export async function processMissedChecks(_db: Db): Promise<{ processed: number }> {
  return { processed: 0 };
}
