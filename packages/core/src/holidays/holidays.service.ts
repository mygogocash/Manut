import type { Db } from "@nexora/db";
import type {
  CreateHolidayInput,
  HolidayQuery,
  UpdateHolidayInput,
} from "@nexora/contracts/modules/holidays/holidays.validation";
import { ConflictException, NotFoundException } from "../http-exception";
import * as repo from "./holidays.repository";

export async function list(db: Db, query: HolidayQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findMany(db, filters, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function create(db: Db, input: CreateHolidayInput) {
  try {
    return await repo.create(db, {
      entityId: input.entityId,
      date: input.date,
      name: input.name,
      notes: input.notes ?? null,
      isActive: input.isActive,
    });
  } catch (err) {
    if (repo.isUniqueViolation(err)) {
      throw new ConflictException("A holiday already exists for this entity on that date");
    }
    throw err;
  }
}

export async function update(db: Db, id: string, input: UpdateHolidayInput) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Holiday not found");
  try {
    return await repo.update(db, id, {
      ...(input.date !== undefined && { date: input.date }),
      ...(input.name !== undefined && { name: input.name }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
  } catch (err) {
    if (repo.isUniqueViolation(err)) {
      throw new ConflictException("A holiday already exists for this entity on that date");
    }
    throw err;
  }
}

export async function remove(db: Db, id: string) {
  const existing = await repo.findById(db, id);
  if (!existing) throw new NotFoundException("Holiday not found");
  await repo.remove(db, id);
  return { success: true };
}
