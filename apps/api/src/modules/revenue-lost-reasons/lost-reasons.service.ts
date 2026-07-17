import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import type {
  CreateLostReasonInput,
  ListLostReasonsQuery,
  UpdateLostReasonInput,
} from "@/modules/revenue-lost-reasons/lost-reasons.validation";

export class LostReasonService {
  async list(query: ListLostReasonsQuery) {
    const where = query.includeInactive ? {} : { isActive: true };
    return prisma.revenueLostReason.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
  }

  async create(input: CreateLostReasonInput) {
    const dup = await prisma.revenueLostReason.findUnique({
      where: { code: input.code },
    });
    if (dup) {
      throw new ConflictException(
        `A lost reason with code "${input.code}" already exists.`,
      );
    }
    return prisma.revenueLostReason.create({
      data: {
        code: input.code,
        label: input.label,
        sortOrder: input.sortOrder ?? 100,
        isSystem: false,
        isActive: true,
      },
    });
  }

  async update(id: string, input: UpdateLostReasonInput) {
    const existing = await prisma.revenueLostReason.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException("Lost reason not found");
    }
    // System rows can be deactivated and re-sorted but not relabeled.
    if (existing.isSystem && input.label !== undefined) {
      throw new ForbiddenException(
        "System lost reasons cannot be relabeled. Deactivate and create a custom replacement.",
      );
    }
    return prisma.revenueLostReason.update({
      where: { id },
      data: {
        ...(input.label !== undefined && { label: input.label }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
  }

  async delete(id: string) {
    const existing = await prisma.revenueLostReason.findUnique({
      where: { id },
      select: { id: true, isSystem: true },
    });
    if (!existing) {
      throw new NotFoundException("Lost reason not found");
    }
    if (existing.isSystem) {
      throw new ForbiddenException(
        "System lost reasons cannot be deleted. Use the deactivate toggle instead.",
      );
    }
    // Lost reason is stored as plain text on Opportunity.lostReason
    // (no FK), so deleting the lookup row leaves historical opportunities
    // intact — they just render the raw code on the detail sheet. No
    // referential check needed.
    await prisma.revenueLostReason.delete({ where: { id } });
  }
}

export const lostReasonService = new LostReasonService();
