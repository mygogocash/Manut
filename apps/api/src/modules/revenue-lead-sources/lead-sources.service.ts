import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import type {
  CreateLeadSourceInput,
  ListLeadSourcesQuery,
  UpdateLeadSourceInput,
} from "@/modules/revenue-lead-sources/lead-sources.validation";

export class LeadSourceService {
  // Reps see only active rows; admins flipping `includeInactive=true`
  // see deactivated rows so they can re-enable them.
  async list(query: ListLeadSourcesQuery) {
    const where = query.includeInactive ? {} : { isActive: true };
    return prisma.revenueLeadSource.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
  }

  async create(input: CreateLeadSourceInput) {
    const dup = await prisma.revenueLeadSource.findUnique({
      where: { code: input.code },
    });
    if (dup) {
      throw new ConflictException(
        `A lead source with code "${input.code}" already exists.`,
      );
    }
    return prisma.revenueLeadSource.create({
      data: {
        code: input.code,
        label: input.label,
        sortOrder: input.sortOrder ?? 100,
        isSystem: false,
        isActive: true,
      },
    });
  }

  async update(id: string, input: UpdateLeadSourceInput) {
    const existing = await prisma.revenueLeadSource.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException("Lead source not found");
    }
    // System rows can be deactivated and re-sorted but not relabeled —
    // their codes ship with the seed and reps refer to the canonical
    // labels in muscle memory.
    if (existing.isSystem && input.label !== undefined) {
      throw new ForbiddenException(
        "System lead sources cannot be relabeled. Deactivate and create a custom replacement.",
      );
    }
    return prisma.revenueLeadSource.update({
      where: { id },
      data: {
        ...(input.label !== undefined && { label: input.label }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
  }

  async delete(id: string) {
    const existing = await prisma.revenueLeadSource.findUnique({
      where: { id },
      select: { id: true, code: true, isSystem: true },
    });
    if (!existing) {
      throw new NotFoundException("Lead source not found");
    }
    if (existing.isSystem) {
      throw new ForbiddenException(
        "System lead sources cannot be deleted. Use the deactivate toggle instead.",
      );
    }
    // Refuse hard delete when the source is referenced by an existing
    // lead — the rep would lose attribution data. Caller should
    // deactivate instead, which keeps Lead.source intact for reporting.
    const inUse = await prisma.revenueLead.count({
      where: { source: existing.code },
    });
    if (inUse > 0) {
      throw new BadRequestException(
        `This source is referenced by ${inUse} ${inUse === 1 ? "lead" : "leads"}. Deactivate it instead of deleting.`,
      );
    }
    await prisma.revenueLeadSource.delete({ where: { id } });
  }
}

export const leadSourceService = new LeadSourceService();
