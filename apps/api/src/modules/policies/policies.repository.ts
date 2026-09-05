import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const policyIncludes = {
  entity: { select: { id: true, name: true, code: true } },
  uploadedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.CompanyPolicyInclude;

export class PoliciesRepository {
  async findAll(filters: {
    category?: string;
    entityIds?: string[];
    includeInactive?: boolean;
    q?: string;
  }) {
    const where: Prisma.CompanyPolicyWhereInput = {};
    if (filters.category) where.category = filters.category;
    if (!filters.includeInactive) where.isActive = true;
    if (filters.entityIds) {
      // `null` means "global / applies to every entity". Always include
      // globals alongside any entity-specific rows for the caller.
      where.OR = [{ entityId: null }, { entityId: { in: filters.entityIds } }];
    }
    if (filters.q) {
      const q = filters.q.trim();
      if (q) {
        where.AND = [
          {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { fileName: { contains: q, mode: "insensitive" } },
            ],
          },
        ];
      }
    }
    return prisma.companyPolicy.findMany({
      where,
      include: policyIncludes,
      orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
    });
  }

  async findById(id: string) {
    return prisma.companyPolicy.findUnique({
      where: { id },
      include: policyIncludes,
    });
  }

  async create(data: Prisma.CompanyPolicyUncheckedCreateInput) {
    return prisma.companyPolicy.create({ data, include: policyIncludes });
  }

  async update(id: string, data: Prisma.CompanyPolicyUncheckedUpdateInput) {
    return prisma.companyPolicy.update({
      where: { id },
      data,
      include: policyIncludes,
    });
  }

  async delete(id: string) {
    return prisma.companyPolicy.delete({ where: { id } });
  }
}

export const policiesRepository = new PoliciesRepository();
