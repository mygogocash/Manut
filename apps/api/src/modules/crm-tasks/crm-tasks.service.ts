import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { crmTaskRepository } from "@/modules/crm-tasks/crm-tasks.repository";
import type {
  CreateCrmTaskInput,
  ListCrmTasksQuery,
  UpdateCrmTaskInput,
} from "@/modules/crm-tasks/crm-tasks.validation";

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

  async create(ownerId: string, input: CreateCrmTaskInput) {
    return crmTaskRepository.create({
      subject: input.subject,
      dueDate: new Date(input.dueDate),
      owner: { connect: { id: ownerId } },
      ...(input.leadId && { lead: { connect: { id: input.leadId } } }),
      ...(input.opportunityId && {
        opportunity: { connect: { id: input.opportunityId } },
      }),
    });
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

    return crmTaskRepository.update(id, {
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.dueDate !== undefined && {
        dueDate: new Date(input.dueDate),
      }),
      ...(input.status !== undefined && { status: input.status }),
      ...(completedAt !== undefined && { completedAt }),
    });
  }

  // `PUT /api/crm/tasks/:id/complete` is a one-shot for the
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
