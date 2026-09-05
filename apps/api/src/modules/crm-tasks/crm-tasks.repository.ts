import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const taskInclude = {
  owner: { select: { id: true, name: true, email: true } },
  lead: { select: { id: true, company: true } },
  opportunity: { select: { id: true, name: true } },
} satisfies Prisma.CrmTaskInclude;

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
    const where: Prisma.CrmTaskWhereInput = {};

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
      prisma.crmTask.findMany({
        where,
        include: taskInclude,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.crmTask.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.crmTask.findUnique({
      where: { id },
      include: taskInclude,
    });
  }

  async create(data: Prisma.CrmTaskCreateInput) {
    return prisma.crmTask.create({ data, include: taskInclude });
  }

  async update(id: string, data: Prisma.CrmTaskUpdateInput) {
    return prisma.crmTask.update({
      where: { id },
      data,
      include: taskInclude,
    });
  }

  async delete(id: string) {
    return prisma.crmTask.delete({ where: { id } });
  }
}

export const crmTaskRepository = new CrmTaskRepository();
