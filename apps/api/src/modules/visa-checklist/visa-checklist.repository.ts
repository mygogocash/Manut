import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

export class VisaChecklistRepository {
  // ── Templates ───────────────────────────────────────────

  async listTemplates(filters: {
    visaType?: string;
    includeInactive?: boolean;
  }) {
    const where: Prisma.VisaChecklistTemplateWhereInput = {};
    if (!filters.includeInactive) where.isActive = true;
    if (filters.visaType) where.visaType = filters.visaType;
    return prisma.visaChecklistTemplate.findMany({
      where,
      orderBy: [{ visaType: "asc" }, { name: "asc" }],
    });
  }

  async findTemplateById(id: string) {
    return prisma.visaChecklistTemplate.findUnique({ where: { id } });
  }

  async createTemplate(data: Prisma.VisaChecklistTemplateUncheckedCreateInput) {
    return prisma.visaChecklistTemplate.create({ data });
  }

  async updateTemplate(
    id: string,
    data: Prisma.VisaChecklistTemplateUpdateInput,
  ) {
    return prisma.visaChecklistTemplate.update({ where: { id }, data });
  }

  // Best active template for a record: exact-country match wins over a
  // country-agnostic (null) template for the same visa type.
  async findMatchingTemplates(visaType: string) {
    return prisma.visaChecklistTemplate.findMany({
      where: { visaType, isActive: true },
    });
  }

  // ── Per-record items ────────────────────────────────────

  async createItems(data: Prisma.VisaChecklistItemCreateManyInput[]) {
    if (data.length === 0) return;
    await prisma.visaChecklistItem.createMany({ data });
  }

  async listItems(visaRecordId: string) {
    return prisma.visaChecklistItem.findMany({
      where: { visaRecordId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  async countItems(visaRecordId: string) {
    return prisma.visaChecklistItem.count({ where: { visaRecordId } });
  }

  async findItem(id: string) {
    return prisma.visaChecklistItem.findUnique({ where: { id } });
  }

  async updateItem(id: string, data: Prisma.VisaChecklistItemUpdateInput) {
    return prisma.visaChecklistItem.update({ where: { id }, data });
  }
}

export const visaChecklistRepository = new VisaChecklistRepository();
