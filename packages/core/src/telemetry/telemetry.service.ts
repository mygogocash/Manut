import type { Db } from "@nexora/db";

/** PostHog identify/groupIdentify requires Node — edge cron returns skipped counts. */
export async function runSnapshotSync(_db: Db) {
  return {
    skipped: true as const,
    reason: "posthog-node-unavailable-on-edge" as const,
    usersProcessed: 0,
    entitiesProcessed: 0,
  };
}
