import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const enrollmentIncludes = {
  employee: { select: { id: true, name: true, email: true } },
} satisfies Prisma.BenefitEnrollmentInclude;

export class BenefitsRepository {
  async findAll(
    filters: { category?: string; entityId?: string },
    page: number,
    limit: number,
  ) {
    const where: Prisma.BenefitWhereInput = {};

    if (filters.category) where.category = filters.category;
    if (filters.entityId) where.entityId = filters.entityId;

    const [data, total] = await Promise.all([
      prisma.benefit.findMany({
        where,
        include: {
          _count: { select: { enrollments: true } },
          entity: { select: { id: true, name: true } },
        },
        // Newest first so a freshly-created plan lands on page 1 and is
        // visible to HR right after they hit Save (alphabetical sort
        // hid any plan whose name didn't fall on the current page).
        orderBy: [{ createdAt: "desc" }, { name: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.benefit.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.benefit.findUnique({
      where: { id },
      include: {
        entity: { select: { id: true, name: true } },
        enrollments: {
          include: enrollmentIncludes,
          orderBy: { startDate: "desc" },
        },
      },
    });
  }

  async create(data: Prisma.BenefitCreateInput) {
    return prisma.benefit.create({ data });
  }

  async update(id: string, data: Prisma.BenefitUpdateInput) {
    return prisma.benefit.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.benefit.delete({ where: { id } });
  }

  async findEnrollment(benefitId: string, employeeId: string) {
    return prisma.benefitEnrollment.findUnique({
      where: { benefitId_employeeId: { benefitId, employeeId } },
    });
  }

  async enroll(data: {
    benefitId: string;
    employeeId: string;
    startDate: Date;
  }) {
    return prisma.benefitEnrollment.create({
      data: {
        benefitId: data.benefitId,
        employeeId: data.employeeId,
        startDate: data.startDate,
        status: "active",
      },
      include: enrollmentIncludes,
    });
  }

  async unenroll(enrollmentId: string) {
    return prisma.benefitEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "inactive", endDate: new Date() },
      include: enrollmentIncludes,
    });
  }

  async findEnrollmentById(id: string) {
    return prisma.benefitEnrollment.findUnique({
      where: { id },
      include: enrollmentIncludes,
    });
  }

  async getEnrollmentsByEmployee(employeeId: string) {
    return prisma.benefitEnrollment.findMany({
      where: { employeeId },
      include: {
        ...enrollmentIncludes,
        benefit: {
          select: {
            id: true,
            name: true,
            category: true,
            provider: true,
            cost: true,
            currency: true,
          },
        },
      },
      orderBy: { startDate: "desc" },
    });
  }
}

export const benefitsRepository = new BenefitsRepository();
