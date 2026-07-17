import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { investorTaskRepository } from "@/modules/investor-tasks/investor-tasks.repository";
import type {
  CreateInvestorTaskInput,
  ListInvestorTasksQuery,
  UpdateInvestorTaskInput,
} from "@/modules/investor-tasks/investor-tasks.validation";
import { investorsRepository } from "@/modules/investors/investors.repository";

// Translate a "Today list" bucket into a concrete date window. UTC
// midnight aligns with the `db.Date` column so the comparison is
// calendar-based (mirrors crm-tasks).
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
  return { dueDateGte: tomorrow, dueDateLte: inSevenDays };
}

export class InvestorTaskService {
  async list(
    userId: string,
    permissions: string[],
    query: ListInvestorTasksQuery,
  ) {
    const { page, limit, bucket, ...filters } = query;
    // `investors:read-all` holders see every task; everyone else is
    // scoped to the tasks they own (mirrors the investor list scoping).
    const canSeeAll = permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
    const ownerScope = canSeeAll ? undefined : [userId];

    const range = bucket ? bucketToRange(bucket, new Date()) : {};

    const { data, total } = await investorTaskRepository.findMany(
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
    const task = await investorTaskRepository.findById(id);
    if (!task) throw new NotFoundException("Task not found");

    const canSeeAll = permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
    if (!canSeeAll && task.ownerId !== userId) {
      throw new NotFoundException("Task not found");
    }
    return task;
  }

  // Block anchoring a task to an investor the caller can't see (IDOR) —
  // otherwise a crafted investorId would leak that investor's name back
  // through the task include.
  private async assertInvestorAccess(
    investorId: string,
    userId: string,
    permissions: string[],
  ) {
    const investor = await investorsRepository.findById(investorId);
    const canSeeAll = permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
    if (!investor || (!canSeeAll && investor.addedBy !== userId)) {
      throw new NotFoundException("Investor not found");
    }
  }

  async create(
    ownerId: string,
    permissions: string[],
    input: CreateInvestorTaskInput,
  ) {
    await this.assertInvestorAccess(input.investorId, ownerId, permissions);
    return investorTaskRepository.create({
      subject: input.subject,
      dueDate: new Date(input.dueDate),
      owner: { connect: { id: ownerId } },
      investor: { connect: { id: input.investorId } },
    });
  }

  async update(
    id: string,
    userId: string,
    permissions: string[],
    input: UpdateInvestorTaskInput,
  ) {
    const existing = await this.getById(id, userId, permissions);

    // A cancelled task is a closed audit row — block edits to keep intent
    // stable. Reopen-from-done is allowed.
    if (existing.status === "cancelled") {
      throw new BadRequestException(
        "Cannot edit a cancelled task. Recreate it instead.",
      );
    }

    let completedAt: Date | null | undefined;
    if (input.status === "done") {
      completedAt = existing.completedAt ?? new Date();
    } else if (input.status !== undefined && existing.status === "done") {
      completedAt = null;
    }

    return investorTaskRepository.update(id, {
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.dueDate !== undefined && { dueDate: new Date(input.dueDate) }),
      ...(input.status !== undefined && { status: input.status }),
      ...(completedAt !== undefined && { completedAt }),
    });
  }

  // One-shot for the checkbox UI. Idempotent: completing a done row is a
  // no-op rather than an error.
  async complete(id: string, userId: string, permissions: string[]) {
    const existing = await this.getById(id, userId, permissions);
    if (existing.status === "cancelled") {
      throw new BadRequestException("Cannot complete a cancelled task.");
    }
    if (existing.status === "done") return existing;

    return investorTaskRepository.update(id, {
      status: "done",
      completedAt: new Date(),
    });
  }

  async delete(id: string, userId: string, permissions: string[]) {
    await this.getById(id, userId, permissions);
    return investorTaskRepository.delete(id);
  }
}

export const investorTaskService = new InvestorTaskService();
