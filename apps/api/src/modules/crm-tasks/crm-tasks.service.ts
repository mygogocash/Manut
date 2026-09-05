import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { sendEmail } from "@/infrastructure/email/email.service";
import { crmTaskUpdateEmail } from "@/infrastructure/email/templates";
import { PORTAL_URL } from "@/lib/portal-url";
import { crmTaskRepository } from "@/modules/crm-tasks/crm-tasks.repository";
import type {
  CreateCrmTaskInput,
  ListCrmTasksQuery,
  UpdateCrmTaskInput,
} from "@/modules/crm-tasks/crm-tasks.validation";

const CRM_LABEL = "Sales CRM";
const CRM_PATH = "/sales";

// Validate an assignment target: must exist, be active, and not deleted.
// Returns the user's email + name for the assignment notification.
async function requireAssignableUser(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    throw new BadRequestException("Assignee is not an active user.");
  }
  return user;
}

// Best-effort "you've been assigned a task" email to the new owner. The
// actor never notifies themselves (self-assignment sends nothing).
async function notifyAssignment(input: {
  actorId: string;
  ownerEmail: string;
  subject: string;
}): Promise<void> {
  const actor = await prisma.user.findUnique({
    where: { id: input.actorId },
    select: { name: true },
  });
  const mail = crmTaskUpdateEmail({
    crmLabel: CRM_LABEL,
    taskTitle: input.subject,
    projectName: CRM_LABEL,
    eventLabel: "Task assignment changed",
    summary: `${actor?.name ?? "Someone"} assigned this task to you`,
    portalUrl: `${PORTAL_URL}${CRM_PATH}`,
  });
  void sendEmail({ to: input.ownerEmail, ...mail });
}

// Translate the "Today list" bucket label into a concrete date window. UTC
// midnight aligns with the `db.Date` column so the comparison is calendar-
// based rather than timestamp-based.
function bucketToRange(bucket: "overdue" | "today" | "soon", now: Date) {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(today.getUTCDate() + 1);
  const inSevenDays = new Date(today);
  inSevenDays.setUTCDate(today.getUTCDate() + 7);

  if (bucket === "overdue") {
    return { dueDateLte: new Date(today.getTime() - 1) };
  }
  if (bucket === "today") {
    return { dueDateGte: today, dueDateLte: today };
  }
  // "soon" — strictly after today, up to 7 days out.
  return { dueDateGte: tomorrow, dueDateLte: inSevenDays };
}

export class CrmTaskService {
  async list(userId: string, permissions: string[], query: ListCrmTasksQuery) {
    const { page, limit, bucket, ...filters } = query;
    const canSeeAll = permissions.includes("crm:team-read");
    const ownerScope = canSeeAll ? undefined : [userId];

    const range = bucket ? bucketToRange(bucket, new Date()) : {};

    const { data, total } = await crmTaskRepository.findMany(
      { ...filters, ...range, ownerScope },
      page,
      limit,
    );

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string, userId: string, permissions: string[]) {
    const task = await crmTaskRepository.findById(id);
    if (!task) throw new NotFoundException("Task not found");

    const canSeeAll = permissions.includes("crm:team-read");
    if (!canSeeAll && task.ownerId !== userId) {
      throw new NotFoundException("Task not found");
    }
    return task;
  }

  async create(creatorId: string, input: CreateCrmTaskInput) {
    // Optional assignment to another rep — validated as an active user.
    // Omitted (or self) keeps the original owner-is-creator behavior.
    let ownerId = creatorId;
    let assignee: { email: string } | null = null;
    if (input.ownerId && input.ownerId !== creatorId) {
      assignee = await requireAssignableUser(input.ownerId);
      ownerId = input.ownerId;
    }

    const task = await crmTaskRepository.create({
      subject: input.subject,
      dueDate: new Date(input.dueDate),
      owner: { connect: { id: ownerId } },
      ...(input.leadId && { lead: { connect: { id: input.leadId } } }),
      ...(input.opportunityId && {
        opportunity: { connect: { id: input.opportunityId } },
      }),
    });

    if (assignee?.email) {
      void notifyAssignment({
        actorId: creatorId,
        ownerEmail: assignee.email,
        subject: input.subject,
      });
    }
    return task;
  }

  async update(
    id: string,
    userId: string,
    permissions: string[],
    input: UpdateCrmTaskInput,
  ) {
    const existing = await this.getById(id, userId, permissions);

    // Reopen-from-done is allowed (the rep slipped it shut by accident).
    // Once cancelled though it is a closed audit row — block edits to keep
    // intent stable.
    if (existing.status === "cancelled") {
      throw new BadRequestException(
        "Cannot edit a cancelled task. Recreate it instead.",
      );
    }

    // When status moves to 'done' stamp completedAt; clear it when re-opened.
    let completedAt: Date | null | undefined;
    if (input.status === "done") {
      completedAt = existing.completedAt ?? new Date();
    } else if (input.status !== undefined && existing.status === "done") {
      // input.status is narrowed to "open" | "cancelled" here.
      completedAt = null;
    }

    // Reassignment — validate the target and notify them (unless the actor
    // reassigned to themselves).
    const ownerChanged =
      input.ownerId !== undefined && input.ownerId !== existing.ownerId;
    let newOwner: { email: string } | null = null;
    if (ownerChanged) {
      newOwner = await requireAssignableUser(input.ownerId as string);
    }

    const updated = await crmTaskRepository.update(id, {
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.dueDate !== undefined && {
        dueDate: new Date(input.dueDate),
        // Re-arm the deadline-reminder ladder — fired "due-*" markers were
        // tied to the old due date (generalized CRM deadline cron).
        remindersSent: [],
        lastReminderSentAt: null,
      }),
      ...(ownerChanged && { owner: { connect: { id: input.ownerId } } }),
      ...(input.status !== undefined && { status: input.status }),
      ...(completedAt !== undefined && { completedAt }),
    });

    if (ownerChanged && newOwner?.email && input.ownerId !== userId) {
      void notifyAssignment({
        actorId: userId,
        ownerEmail: newOwner.email,
        subject: existing.subject,
      });
    }
    return updated;
  }

  // PRD §7 — `PUT /api/crm/tasks/:id/complete` is a one-shot for the
  // checkbox UI. Idempotent: completing an already-done row is a no-op
  // rather than an error.
  async complete(id: string, userId: string, permissions: string[]) {
    const existing = await this.getById(id, userId, permissions);

    if (existing.status === "cancelled") {
      throw new BadRequestException("Cannot complete a cancelled task.");
    }
    if (existing.status === "done") {
      return existing;
    }

    return crmTaskRepository.update(id, {
      status: "done",
      completedAt: new Date(),
    });
  }

  async delete(id: string, userId: string, permissions: string[]) {
    await this.getById(id, userId, permissions);
    return crmTaskRepository.delete(id);
  }
}

export const crmTaskService = new CrmTaskService();
