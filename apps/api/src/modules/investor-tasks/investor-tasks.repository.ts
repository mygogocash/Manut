import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const taskInclude = {
  owner: { select: { id: true, name: true, email: true } },
  investor: { select: { id: true, name: true } },
} satisfies Prisma.InvestorTaskInclude;

export interface ListInvestorTasksFilters {
  status?: string;
  investorId?: string;
  ownerId?: string;
  ownerScope?: string[];
  // Caller-resolved due-date window. Service translates bucket → range
  // so the repository stays a thin query layer.
  dueDateGte?: Date;
  dueDateLte?: Date;
}

export class InvestorTaskRepository {
  async findMany(
    filters: ListInvestorTasksFilters,
    page: number,
    limit: number,
  ) {
    const where: Prisma.InvestorTaskWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.investorId) where.investorId = filters.investorId;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.ownerScope) where.ownerId = { in: filters.ownerScope };
    if (filters.dueDateGte || filters.dueDateLte) {
      where.dueDate = {
        ...(filters.dueDateGte && { gte: filters.dueDateGte }),
        ...(filters.dueDateLte && { lte: filters.dueDateLte }),
      };
    }

    const [data, total] = await Promise.all([
      prisma.investorTask.findMany({
        where,
        include: taskInclude,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.investorTask.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.investorTask.findUnique({
      where: { id },
      include: taskInclude,
    });
  }

  async create(data: Prisma.InvestorTaskCreateInput) {
    return prisma.investorTask.create({ data, include: taskInclude });
  }

  async update(id: string, data: Prisma.InvestorTaskUpdateInput) {
    return prisma.investorTask.update({
      where: { id },
      data,
      include: taskInclude,
    });
  }

  async delete(id: string) {
    return prisma.investorTask.delete({ where: { id } });
  }
}

export const investorTaskRepository = new InvestorTaskRepository();
