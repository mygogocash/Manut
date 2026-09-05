import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { sendEmail } from "@/infrastructure/email/email.service";
import { crmTaskUpdateEmail } from "@/infrastructure/email/templates";
import { PORTAL_URL } from "@/lib/portal-url";
import { CRM_MODULES, type CrmModule } from "@/modules/crm-shared/crm-modules";
import { getCrmReminderRecipients } from "@/modules/crm-shared/crm-recipients";

export type CrmTaskEventType = "task_status" | "task_assigned" | "task_comment";

export interface CrmTaskPerson {
  id: string;
  name: string;
  email: string;
}

interface NotifyInput {
  module: CrmModule;
  type: CrmTaskEventType;
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  actorId: string;
  // Human-readable event line, e.g. "moved it to In Review" / "reassigned it"
  // / "commented". Prefixed with the actor's name in the body/email.
  summary: string;
  // Native adapter — pure-native workspaces (qa) whose tasks do NOT live in
  // the shared `project_tasks` pass their already-loaded owner + assignees
  // here (the shared-table lookup would miss). Shared-board callers omit it.
  people?: { owner: CrmTaskPerson | null; assignees: CrmTaskPerson[] };
  // Native adapter — absolute deep-link override for boards that don't live
  // at /projects/:id (qa's board is /qa-crm/:projectId).
  link?: string;
}

const TITLE: Record<CrmTaskEventType, string> = {
  task_status: "Task status changed",
  task_assigned: "Task assignment changed",
  task_comment: "New comment on a task",
};

/**
 * Fan out a CRM task update to the task owner + assignees (bell rows + email)
 * plus the module's admin-configured recipient list (email only). Best-effort:
 * every failure is logged and swallowed so it never affects the write that
 * triggered it. The caller gates by CRM (board team or native module).
 *
 * NOTE: by default reads task owner/assignees from the shared `project_tasks`
 * table (the shared-board CRMs). Pure-native workspaces (qa) pass `people` +
 * `link` instead — their tasks aren't in the shared table.
 */
export async function notifyCrmTaskEvent(input: NotifyInput): Promise<void> {
  try {
    let owner: CrmTaskPerson | null;
    let assigneeUsers: CrmTaskPerson[];
    if (input.people) {
      owner = input.people.owner;
      assigneeUsers = input.people.assignees;
    } else {
      const task = await prisma.projectTask.findUnique({
        where: { id: input.taskId },
        select: {
          owner: { select: { id: true, name: true, email: true } },
          assignees: {
            select: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      if (!task) return;
      owner = task.owner;
      assigneeUsers = task.assignees.map((a) => a.user);
    }

    // Recipient users = task owner + assignees, deduped, minus the actor.
    const byId = new Map<string, CrmTaskPerson>();
    if (owner) byId.set(owner.id, owner);
    for (const u of assigneeUsers) byId.set(u.id, u);
    byId.delete(input.actorId);
    const users = [...byId.values()];

    const actor = await prisma.user.findUnique({
      where: { id: input.actorId },
      select: { name: true, email: true },
    });
    const actorName = actor?.name ?? "Someone";
    const actorEmail = actor?.email?.trim().toLowerCase() ?? null;

    const slug = CRM_MODULES[input.module].listSlug;
    const link =
      input.link ??
      `${PORTAL_URL}/projects/${input.projectId}?task=${input.taskId}&from=${slug}`;
    const body = `${actorName} ${input.summary} — ${input.taskTitle} (${input.projectName})`;

    // Bell rows — one per recipient user (external configured emails have no
    // account, so they only receive the email below).
    if (users.length > 0) {
      await prisma.crmNotification.createMany({
        data: users.map((u) => ({
          module: input.module,
          userId: u.id,
          type: input.type,
          title: TITLE[input.type],
          body,
          linkUrl: link,
          projectId: input.projectId,
          taskId: input.taskId,
          actorId: input.actorId,
        })),
      });
    }

    // Email — recipient users + the module's configured list, deduped,
    // lowercased, minus the actor's own address (no self-notification).
    const configured = (await getCrmReminderRecipients(input.module))
      .recipients;
    const seen = new Set<string>();
    const emails: string[] = [];
    for (const e of [...users.map((u) => u.email), ...configured]) {
      const clean = e?.trim().toLowerCase();
      if (clean && clean !== actorEmail && !seen.has(clean)) {
        seen.add(clean);
        emails.push(clean);
      }
    }
    if (emails.length > 0) {
      const mail = crmTaskUpdateEmail({
        crmLabel: CRM_MODULES[input.module].label,
        taskTitle: input.taskTitle,
        projectName: input.projectName,
        eventLabel: TITLE[input.type],
        summary: `${actorName} ${input.summary}`,
        portalUrl: link,
      });
      void sendEmail({ to: emails, ...mail });
    }
  } catch (err) {
    logger.error("Failed to send CRM task notification", {
      error: err,
      module: input.module,
      taskId: input.taskId,
      type: input.type,
    });
  }
}
