import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const jobIncludes = {
  _count: { select: { applications: true } },
} satisfies Prisma.JobInclude;

export class CareerRepository {
  async findJobs(
    filters: {
      department?: string;
      type?: string;
      active?: boolean;
      search?: string;
    },
    page: number,
    limit: number,
  ) {
    const where: Prisma.JobWhereInput = {};
    if (filters.department) where.department = filters.department;
    if (filters.type) where.type = filters.type;
    if (filters.active !== undefined) where.active = filters.active;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { department: { contains: filters.search, mode: "insensitive" } },
        { location: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: jobIncludes,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    return { data, total };
  }

  async findJobById(id: string) {
    return prisma.job.findUnique({
      where: { id },
      include: jobIncludes,
    });
  }

  async createJob(data: {
    title: string;
    slug?: string;
    type: string;
    location: string;
    department: string;
    description: string;
    active?: boolean;
  }) {
    return prisma.job.create({
      data,
      include: jobIncludes,
    });
  }

  async updateJob(id: string, data: Prisma.JobUncheckedUpdateInput) {
    return prisma.job.update({
      where: { id },
      data,
      include: jobIncludes,
    });
  }

  async deleteJob(id: string) {
    return prisma.job.delete({ where: { id } });
  }

  async findJobTitles() {
    const jobs = await prisma.job.findMany({
      where: { active: true },
      select: { id: true, title: true, department: true },
      orderBy: { title: "asc" },
    });
    return jobs;
  }

  async findAllForExport(search?: string) {
    const where: Prisma.JobWhereInput = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { department: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
      ];
    }
    return prisma.job.findMany({
      where,
      include: { _count: { select: { applications: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const careerRepository = new CareerRepository();
