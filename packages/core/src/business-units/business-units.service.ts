import type {
  CreateBusinessUnitInput,
  ListBusinessUnitsQuery,
  ReorderBusinessUnitsInput,
  UpdateBusinessUnitInput,
} from "@nexora/contracts/modules/business-units/business-units.validation";
import type { Db } from "@nexora/db";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception";
import * as repo from "./business-units.repository";

export async function list(db: Db, query: ListBusinessUnitsQuery) {
  return repo.list(db, query.includeInactive ?? false);
}

export async function create(db: Db, input: CreateBusinessUnitInput) {
  const dup = await repo.findByCode(db, input.code);
  if (dup) {
    throw new ConflictException(`A business unit with code "${input.code}" already exists.`);
  }

  const last = await repo.maxSortOrder(db);
  const sortOrder = input.sortOrder ?? (last !== null ? last + 10 : 10);

  return repo.create(db, {
    code: input.code,
    label: input.label,
    color: input.color ?? "grey",
    sortOrder,
  });
}

export async function update(db: Db, id: string, input: UpdateBusinessUnitInput) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Business unit not found");
  if (existing.isSystem && input.label !== undefined) {
    throw new ForbiddenException(
      "System business units cannot be relabeled. Deactivate and create a custom replacement.",
    );
  }
  return repo.update(db, id, {
    ...(input.label !== undefined && { label: input.label }),
    ...(input.color !== undefined && { color: input.color }),
    ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    ...(input.isActive !== undefined && { isActive: input.isActive }),
  });
}

export async function reorder(db: Db, input: ReorderBusinessUnitsInput) {
  const rows = await repo.list(db, true);
  const known = new Set(rows.map((r) => r.id));
  if (input.orderedIds.some((id) => !known.has(id))) {
    throw new NotFoundException("One or more business units were not found");
  }
  await repo.reorder(db, input.orderedIds);
  return { success: true, reordered: input.orderedIds.length };
}

export async function remove(db: Db, id: string) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Business unit not found");
  if (existing.isSystem) {
    throw new ForbiddenException(
      "System business units cannot be deleted. Use the deactivate toggle instead.",
    );
  }
  await repo.remove(db, id, existing.code);
}
