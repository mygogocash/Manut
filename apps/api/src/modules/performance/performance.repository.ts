import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const appraisalIncludes = {
  cycle: { select: { id: true, name: true, status: true } },
  employee: {
    select: { id: true, name: true, email: true, department: true },
  },
  manager: { select: { id: true, name: true, email: true } },
  goals: true,
} satisfies Prisma.AppraisalInclude;

export class PerformanceRepository {
  // ── Cycles ──────────────────────────────────────────────

  async findCycles(filters: { status?: string }, page: number, limit: number) {
    const where: Prisma.AppraisalCycleWhereInput = {};
    if (filters.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      prisma.appraisalCycle.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          _count: { select: { appraisals: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appraisalCycle.count({ where }),
    ]);

    return { data, total };
  }

  async findCycleById(id: string) {
    return prisma.appraisalCycle.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        _count: { select: { appraisals: true } },
      },
    });
  }

  async createCycle(data: {
    name: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    createdBy: string;
  }) {
    return prisma.appraisalCycle.create({
      data: {
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        createdBy: data.createdBy,
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        _count: { select: { appraisals: true } },
      },
    });
  }

  async updateCycle(
    id: string,
    data: Prisma.AppraisalCycleUncheckedUpdateInput,
  ) {
    return prisma.appraisalCycle.update({
      where: { id },
      data,
      include: {
        creator: { select: { id: true, name: true, email: true } },
        _count: { select: { appraisals: true } },
      },
    });
  }

  // ── Appraisals ──────────────────────────────────────────

  async findAppraisals(
    filters: {
      cycleId?: string;
      employeeId?: string;
      managerId?: string;
      status?: string;
      search?: string;
    },
    page: number,
    limit: number,
  ) {
    const and: Prisma.AppraisalWhereInput[] = [];
    if (filters.cycleId) and.push({ cycleId: filters.cycleId });
    if (filters.employeeId) and.push({ employeeId: filters.employeeId });
    if (filters.managerId) and.push({ managerId: filters.managerId });
    if (filters.status) and.push({ status: filters.status });
    // Pushed onto the same AND list as the scoping filters, so a search narrows
    // whichever set the caller is entitled to rather than widening it. Email is
    // matched as well as name because two people can share a display name and
    // the table shows the email beside it.
    const search = filters.search?.trim();
    if (search) {
      and.push({
        OR: [
          { employee: { name: { contains: search, mode: "insensitive" } } },
          { employee: { email: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    const where: Prisma.AppraisalWhereInput =
      and.length > 0 ? { AND: and } : {};

    const [data, total] = await Promise.all([
      prisma.appraisal.findMany({
        where,
        include: appraisalIncludes,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appraisal.count({ where }),
    ]);

    return { data, total };
  }

  async findAppraisalById(id: string) {
    return prisma.appraisal.findUnique({
      where: { id },
      include: appraisalIncludes,
    });
  }

  async createAppraisal(data: {
    cycleId: string;
    employeeId: string;
    managerId?: string;
  }) {
    return prisma.appraisal.create({
      data: {
        cycleId: data.cycleId,
        employeeId: data.employeeId,
        managerId: data.managerId,
      },
      include: appraisalIncludes,
    });
  }

  async updateAppraisal(
    id: string,
    data: Prisma.AppraisalUncheckedUpdateInput,
  ) {
    return prisma.appraisal.update({
      where: { id },
      data,
      include: appraisalIncludes,
    });
  }

  // ── Goals ───────────────────────────────────────────────

  async findGoalsByAppraisal(appraisalId: string) {
    return prisma.goal.findMany({
      where: { appraisalId },
      orderBy: { createdAt: "asc" },
    });
  }

  async findGoalById(id: string) {
    return prisma.goal.findUnique({
      where: { id },
      include: {
        appraisal: {
          select: { id: true, employeeId: true, managerId: true },
        },
      },
    });
  }

  async createGoal(data: {
    appraisalId: string;
    title: string;
    description?: string;
    weight?: number;
  }) {
    return prisma.goal.create({
      data: {
        appraisalId: data.appraisalId,
        title: data.title,
        description: data.description,
        weight: data.weight ?? 0,
      },
    });
  }

  async updateGoal(id: string, data: Prisma.GoalUncheckedUpdateInput) {
    return prisma.goal.update({ where: { id }, data });
  }

  async deleteGoal(id: string) {
    return prisma.goal.delete({ where: { id } });
  }
}

export const performanceRepository = new PerformanceRepository();
