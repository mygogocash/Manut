import type {
  CreateLostReasonInput,
  ListLostReasonsQuery,
  UpdateLostReasonInput,
} from "@nexora/contracts/modules/lost-reasons/lost-reasons.validation";
import type { Db } from "@nexora/db";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception";
import * as repo from "./lost-reasons.repository";

export async function list(db: Db, query: ListLostReasonsQuery) {
  return repo.list(db, query.includeInactive ?? false);
}

export async function create(db: Db, input: CreateLostReasonInput) {
  const dup = await repo.findByCode(db, input.code);
  if (dup) {
    throw new ConflictException(`A lost reason with code "${input.code}" already exists.`);
  }
  return repo.create(db, {
    code: input.code,
    label: input.label,
    sortOrder: input.sortOrder ?? 100,
  });
}

export async function update(db: Db, id: string, input: UpdateLostReasonInput) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Lost reason not found");
  if (existing.isSystem && input.label !== undefined) {
    throw new ForbiddenException(
      "System lost reasons cannot be relabeled. Deactivate and create a custom replacement.",
    );
  }
  return repo.update(db, id, {
    ...(input.label !== undefined && { label: input.label }),
    ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  });
}

export async function remove(db: Db, id: string) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Lost reason not found");
  if (existing.isSystem) {
    throw new ForbiddenException(
      "System lost reasons cannot be deleted. Use the deactivate toggle instead.",
    );
  }
  await repo.remove(db, id);
}
