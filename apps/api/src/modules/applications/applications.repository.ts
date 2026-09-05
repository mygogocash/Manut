import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const applicationIncludes = {
  job: { select: { id: true, title: true, department: true, location: true } },
} satisfies Prisma.ApplicationInclude;

export class ApplicationsRepository {
  async findApplications(
    filters: { jobId?: string; search?: string },
    page: number,
    limit: number,
  ) {
    const where: Prisma.ApplicationWhereInput = {};
    if (filters.jobId) where.jobId = filters.jobId;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { job: { title: { contains: filters.search, mode: "insensitive" } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.application.findMany({
        where,
        include: applicationIncludes,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.application.count({ where }),
    ]);

    return { data, total };
  }

  async findApplicationById(id: string) {
    return prisma.application.findUnique({
      where: { id },
      include: applicationIncludes,
    });
  }

  async deleteApplication(id: string) {
    return prisma.application.delete({ where: { id } });
  }

  async findAllForExport(filters: { jobId?: string; search?: string }) {
    const where: Prisma.ApplicationWhereInput = {};
    if (filters.jobId) where.jobId = filters.jobId;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { job: { title: { contains: filters.search, mode: "insensitive" } } },
      ];
    }
    return prisma.application.findMany({
      where,
      include: applicationIncludes,
      orderBy: { createdAt: "desc" },
    });
  }
}

export const applicationsRepository = new ApplicationsRepository();
