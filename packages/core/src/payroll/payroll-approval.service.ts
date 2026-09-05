import type { Db } from "@nexora/db";
import { eq } from "drizzle-orm";
import { schema } from "@nexora/db";
import {
  CreatePayrollApprovalStepInput,
  ReorderPayrollApprovalStepsInput,
  UpdatePayrollApprovalStepInput,
} from "@nexora/contracts/modules/payroll/payroll-approval.validation";
import {
  BadRequestException,
  NotFoundException,
} from "../http-exception";
import * as repo from "./payroll-approval.repository";

async function assertApproverExists(db: Db, approverUserId: string) {
  const [user] = await db
    .select({ id: schema.users.id, isActive: schema.users.isActive })
    .from(schema.users)
    .where(eq(schema.users.id, approverUserId))
    .limit(1);
  if (!user) throw new BadRequestException("Approver user not found");
  if (!user.isActive) throw new BadRequestException("Approver user is inactive");
}

export async function list(db: Db) {
  const rows = await repo.list(db);
  return { data: rows };
}

export async function create(db: Db, input: CreatePayrollApprovalStepInput) {
  await assertApproverExists(db, input.approverUserId);
  const order = await repo.nextOrder(db);
  const created = await repo.create(db, {
    order,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    approverUserId: input.approverUserId,
    isActive: input.isActive ?? true,
  });
  if (!created) throw new BadRequestException("Failed to create approval step");
  return { data: created };
}

export async function update(
  db: Db,
  id: string,
  input: UpdatePayrollApprovalStepInput,
) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Approval step not found");
  if (input.approverUserId !== undefined) {
    await assertApproverExists(db, input.approverUserId);
  }
  const updated = await repo.update(db, id, {
    ...(input.name !== undefined && { name: input.name.trim() }),
    ...(input.description !== undefined && {
      description: input.description?.trim() || null,
    }),
    ...(input.approverUserId !== undefined && {
      approverUserId: input.approverUserId,
    }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  });
  if (!updated) throw new NotFoundException("Approval step not found");
  return { data: updated };
}

export async function deleteStep(db: Db, id: string) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Approval step not found");
  await repo.remove(db, id);
  return { data: { id } };
}

export async function reorder(
  db: Db,
  input: ReorderPayrollApprovalStepsInput,
) {
  if (input.orderedIds.length === 0) {
    throw new BadRequestException("orderedIds cannot be empty");
  }
  const existing = await repo.list(db);
  const existingIds = new Set(existing.map((s) => s.id));
  const seen = new Set<string>();
  for (const id of input.orderedIds) {
    if (!existingIds.has(id)) {
      throw new BadRequestException(`Unknown approval step id: ${id}`);
    }
    if (seen.has(id)) {
      throw new BadRequestException(
        `Duplicate approval step id in reorder list: ${id}`,
      );
    }
    seen.add(id);
  }
  if (input.orderedIds.length !== existing.length) {
    throw new BadRequestException(
      "orderedIds must include every existing approval step exactly once",
    );
  }
  await repo.reorder(db, input.orderedIds);
  const refreshed = await repo.list(db);
  return { data: refreshed };
}
