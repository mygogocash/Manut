import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const activityInclude = {
  owner: { select: { id: true, name: true, email: true } },
  lead: { select: { id: true, company: true } },
  opportunity: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  account: { select: { id: true, name: true } },
} satisfies Prisma.CrmActivityInclude;

export interface ListCrmActivitiesFilters {
  type?: string;
  leadId?: string;
  opportunityId?: string;
  contactId?: string;
  accountId?: string;
  ownerId?: string;
  ownerScope?: string[];
}

export class CrmActivityRepository {
  async findMany(
    filters: ListCrmActivitiesFilters,
    page: number,
    limit: number,
  ) {
    const where: Prisma.CrmActivityWhereInput = {};

    if (filters.type) where.type = filters.type;
    if (filters.leadId) where.leadId = filters.leadId;
    if (filters.opportunityId) where.opportunityId = filters.opportunityId;
    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.accountId) where.accountId = filters.accountId;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.ownerScope) where.ownerId = { in: filters.ownerScope };

    const [data, total] = await Promise.all([
      prisma.crmActivity.findMany({
        where,
        include: activityInclude,
        orderBy: { occurredAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.crmActivity.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.crmActivity.findUnique({
      where: { id },
      include: activityInclude,
    });
  }

  async create(data: Prisma.CrmActivityCreateInput) {
    return prisma.crmActivity.create({ data, include: activityInclude });
  }

  async update(id: string, data: Prisma.CrmActivityUpdateInput) {
    return prisma.crmActivity.update({
      where: { id },
      data,
      include: activityInclude,
    });
  }

  async delete(id: string) {
    return prisma.crmActivity.delete({ where: { id } });
  }
}

export const crmActivityRepository = new CrmActivityRepository();
