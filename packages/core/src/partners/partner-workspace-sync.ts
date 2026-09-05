import type { Db } from "@nexora/db";

/** Only Project CRM rows tagged Marketing feed the Partner workspace bridge. */
export const PARTNER_WORKSPACE_SYNC_DEPARTMENT = "Marketing" as const;

/**
 * STUB — Marketing ↔ Partner workspace sync is not ported to Drizzle yet.
 * The Express/Prisma implementation in apps/api merges linked Marketing
 * project boards into partner_tasks on getBoard. Re-enable when projects
 * write-path mirroring lands in @nexora/core.
 */
export async function syncWorkspaceFromLinkedMarketingProjects(
  _db: Db,
  _partnerId: string,
): Promise<void> {
  // no-op
}

/** @deprecated — use {@link syncWorkspaceFromLinkedMarketingProjects} */
export async function syncFromLinkedProjectsIfEmpty(db: Db, partnerId: string): Promise<void> {
  return syncWorkspaceFromLinkedMarketingProjects(db, partnerId);
}

/** STUB — live mirror from project task writes (see apps/api partner-workspace-sync). */
export async function mirrorProjectTaskToPartner(
  _db: Db,
  _partnerId: string,
  _task: unknown,
  _assigneeIds?: string[],
): Promise<void> {
  // no-op
}

/** STUB */
export async function deleteMirroredPartnerTask(_db: Db, _taskId: string): Promise<void> {
  // no-op
}
