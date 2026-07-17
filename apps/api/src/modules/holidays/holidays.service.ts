import {
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { holidaysRepository } from "@/modules/holidays/holidays.repository";
import type {
  CreateHolidayInput,
  HolidayQuery,
  UpdateHolidayInput,
} from "@/modules/holidays/holidays.validation";

function toDate(yyyy_mm_dd: string): Date {
  return new Date(`${yyyy_mm_dd}T00:00:00.000Z`);
}

function isPrismaUniqueError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

export const holidaysService = {
  async list(query: HolidayQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await holidaysRepository.findMany(
      filters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async create(input: CreateHolidayInput) {
    try {
      return await holidaysRepository.create({
        entityId: input.entityId,
        date: toDate(input.date),
        name: input.name,
        notes: input.notes ?? null,
        isActive: input.isActive,
      });
    } catch (err) {
      if (isPrismaUniqueError(err)) {
        throw new ConflictException(
          "A holiday already exists for this entity on that date",
        );
      }
      throw err;
    }
  },

  async update(id: string, input: UpdateHolidayInput) {
    const existing = await holidaysRepository.findById(id);
    if (!existing) throw new NotFoundException("Holiday not found");
    try {
      return await holidaysRepository.update(id, {
        ...(input.date !== undefined && { date: toDate(input.date) }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      });
    } catch (err) {
      if (isPrismaUniqueError(err)) {
        throw new ConflictException(
          "A holiday already exists for this entity on that date",
        );
      }
      throw err;
    }
  },

  async remove(id: string) {
    const existing = await holidaysRepository.findById(id);
    if (!existing) throw new NotFoundException("Holiday not found");
    await holidaysRepository.delete(id);
    return { id };
  },
};
