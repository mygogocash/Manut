import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";

// Admin-configurable workflow settings.
//
// One `SystemSetting` row rather than a schema column: there is a single
// org-wide value with no per-project variance, so this needs no migration and no
// seed. Absent, the workflow falls back to notifying every
// `workflow:pm-approve` holder — see workflow-email.service `approversFor`.

const DEFAULT_APPROVER_KEY = "project-workflow.default_approver";

export interface WorkflowApprover {
  id: string;
  name: string;
  email: string;
}

/**
 * The person new requests are routed to.
 *
 * Returns null when unset, when the stored id no longer resolves, or when that
 * user has been deactivated — each of which must fall back to the permission
 * holders rather than silently routing approvals to nobody. The stored id is
 * re-resolved on every read for exactly that reason: a setting written months
 * ago should not keep naming someone who has left.
 */
export async function getDefaultApprover(): Promise<WorkflowApprover | null> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: DEFAULT_APPROVER_KEY },
  });
  const value = row?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const userId = (value as Record<string, unknown>).userId;
  if (typeof userId !== "string" || userId.length === 0) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, isActive: true },
  });
  if (!user) {
    logger.warn("Configured default approver no longer exists", { userId });
    return null;
  }
  if (!user.isActive) {
    logger.warn("Configured default approver is deactivated", { userId });
    return null;
  }
  return { id: user.id, name: user.name, email: user.email };
}

/** Set (or clear, with null) the person new requests are routed to. */
export async function setDefaultApprover(
  userId: string | null,
): Promise<WorkflowApprover | null> {
  if (userId === null) {
    await prisma.systemSetting.deleteMany({
      where: { key: DEFAULT_APPROVER_KEY },
    });
    return null;
  }

  // Prisma's InputJsonValue rejects a typed variable here, so the object has to
  // be written inline.
  await prisma.systemSetting.upsert({
    where: { key: DEFAULT_APPROVER_KEY },
    create: { key: DEFAULT_APPROVER_KEY, value: { userId } },
    update: { value: { userId } },
  });
  return getDefaultApprover();
}
