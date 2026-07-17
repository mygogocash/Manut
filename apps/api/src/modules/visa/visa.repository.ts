import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";
import { excludeDeleted, softDeleteUpdate } from "@/infrastructure/soft-delete";

const visaIncludes = {
  employee: { select: { id: true, name: true, email: true, department: true } },
  entity: { select: { id: true, name: true } },
} satisfies Prisma.VisaRecordInclude;

export class VisaRepository {
  async findMany(
    filters: {
      employeeId?: string;
      status?: string;
      country?: string;
      entityId?: string;
    },
    page: number,
    limit: number,
  ) {
    const where: Prisma.VisaRecordWhereInput = excludeDeleted("deletedAt");
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status) where.status = filters.status;
    if (filters.country) where.country = filters.country;
    if (filters.entityId) where.entityId = filters.entityId;

    const [data, total] = await Promise.all([
      prisma.visaRecord.findMany({
        where,
        include: visaIncludes,
        orderBy: { expiryDate: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.visaRecord.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.visaRecord
      .findUnique({
        where: { id },
        include: visaIncludes,
      })
      .then((r) => (r && r.deletedAt ? null : r));
  }

  /** Like findById but returns soft-deleted rows for restore/purge checks. */
  async findByIdIncludingDeleted(id: string) {
    return prisma.visaRecord.findUnique({
      where: { id },
      include: visaIncludes,
    });
  }

  async create(data: Prisma.VisaRecordUncheckedCreateInput) {
    return prisma.visaRecord.create({
      data,
      include: visaIncludes,
    });
  }

  async update(id: string, data: Prisma.VisaRecordUpdateInput) {
    return prisma.visaRecord.update({
      where: { id },
      data,
      include: visaIncludes,
    });
  }

  async softDelete(id: string) {
    return prisma.visaRecord.update({
      where: { id },
      data: softDeleteUpdate("deletedAt"),
      include: visaIncludes,
    });
  }

  async restore(id: string) {
    return prisma.visaRecord.update({
      where: { id },
      data: { deletedAt: null },
      include: visaIncludes,
    });
  }

  async permanentDelete(id: string) {
    return prisma.visaRecord.delete({ where: { id } });
  }

  // ── Timeline event log ──────────────────────────────────

  async createEventLogs(entries: Prisma.VisaEventLogCreateManyInput[]) {
    if (entries.length === 0) return;
    await prisma.visaEventLog.createMany({ data: entries });
  }

  async listEventLogs(visaRecordId: string) {
    return prisma.visaEventLog.findMany({
      where: { visaRecordId },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { id: true, name: true } } },
    });
  }

  async findUsersByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true, employeeId: true },
    });
  }

  async findUsersByEmails(emails: string[]) {
    if (emails.length === 0) return [];
    return prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, name: true, email: true, employeeId: true },
    });
  }

  async findUsersByEmployeeCodes(codes: string[]) {
    if (codes.length === 0) return [];
    return prisma.user.findMany({
      where: { employeeId: { in: codes } },
      select: { id: true, name: true, email: true, employeeId: true },
    });
  }

  async findActiveUsersForBulkMatch() {
    return prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, employeeId: true },
    });
  }
}

export const visaRepository = new VisaRepository();
