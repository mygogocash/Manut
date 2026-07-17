import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const taskInclude = {
  owner: { select: { id: true, name: true, email: true } },
  lead: { select: { id: true, company: true } },
  opportunity: { select: { id: true, name: true } },
} satisfies Prisma.RevenueTaskInclude;

export interface ListCrmTasksFilters {
  status?: string;
  ownerId?: string;
  leadId?: string;
  opportunityId?: string;
  ownerScope?: string[];
  // Caller-resolved date window (in YYYY-MM-DD form). Service translates
  // bucket → range so the repository stays simple.
  dueDateGte?: Date;
  dueDateLte?: Date;
}

export class CrmTaskRepository {
  async findMany(filters: ListCrmTasksFilters, page: number, limit: number) {
    const where: Prisma.RevenueTaskWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.ownerScope) where.ownerId = { in: filters.ownerScope };
    if (filters.leadId) where.leadId = filters.leadId;
    if (filters.opportunityId) where.opportunityId = filters.opportunityId;
    if (filters.dueDateGte || filters.dueDateLte) {
      where.dueDate = {
        ...(filters.dueDateGte && { gte: filters.dueDateGte }),
        ...(filters.dueDateLte && { lte: filters.dueDateLte }),
      };
    }

    const [data, total] = await Promise.all([
      prisma.revenueTask.findMany({
        where,
        include: taskInclude,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.revenueTask.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.revenueTask.findUnique({
      where: { id },
      include: taskInclude,
    });
  }

  async create(data: Prisma.RevenueTaskCreateInput) {
    return prisma.revenueTask.create({ data, include: taskInclude });
  }

  async update(id: string, data: Prisma.RevenueTaskUpdateInput) {
    return prisma.revenueTask.update({
      where: { id },
      data,
      include: taskInclude,
    });
  }

  async delete(id: string) {
    return prisma.revenueTask.delete({ where: { id } });
  }
}

export const crmTaskRepository = new CrmTaskRepository();
