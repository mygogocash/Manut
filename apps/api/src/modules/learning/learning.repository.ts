import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

export class LearningRepository {
  async findModules(
    filters: { category?: string; isMandatory?: boolean; search?: string },
    page: number,
    limit: number,
  ) {
    const where: Prisma.TrainingModuleWhereInput = { isActive: true };
    if (filters.category) where.category = filters.category;
    if (filters.isMandatory !== undefined) {
      where.isMandatory = filters.isMandatory;
    }
    if (filters.search) {
      where.title = { contains: filters.search, mode: "insensitive" };
    }

    const [data, total] = await Promise.all([
      prisma.trainingModule.findMany({
        where,
        include: { _count: { select: { completions: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.trainingModule.count({ where }),
    ]);

    return { data, total };
  }

  async findModuleById(id: string) {
    return prisma.trainingModule.findUnique({ where: { id } });
  }

  async createModule(data: Prisma.TrainingModuleCreateInput) {
    return prisma.trainingModule.create({ data });
  }

  async updateModule(id: string, data: Prisma.TrainingModuleUpdateInput) {
    return prisma.trainingModule.update({ where: { id }, data });
  }

  async findCompletions(
    filters: { employeeId?: string; moduleId?: string },
    page: number,
    limit: number,
  ) {
    const where: Prisma.TrainingCompletionWhereInput = {};
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.moduleId) where.moduleId = filters.moduleId;

    const [data, total] = await Promise.all([
      prisma.trainingCompletion.findMany({
        where,
        include: {
          employee: {
            select: { id: true, name: true, email: true, department: true },
          },
          module: { select: { id: true, title: true, category: true } },
        },
        orderBy: { completedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.trainingCompletion.count({ where }),
    ]);

    return { data, total };
  }

  async findCompletion(employeeId: string, moduleId: string) {
    return prisma.trainingCompletion.findUnique({
      where: { employeeId_moduleId: { employeeId, moduleId } },
    });
  }

  async createCompletion(data: {
    employeeId: string;
    moduleId: string;
    score?: number;
  }) {
    return prisma.trainingCompletion.create({
      data,
      include: {
        employee: { select: { id: true, name: true, email: true } },
        module: { select: { id: true, title: true, category: true } },
      },
    });
  }
}

export const learningRepository = new LearningRepository();
