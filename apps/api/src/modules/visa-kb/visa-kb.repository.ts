import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const articleInclude = {
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.VisaKnowledgeArticleInclude;

export interface VisaArticleFilters {
  country?: string;
  visaType?: string;
  includeInactive?: boolean;
}

export class VisaKbRepository {
  async findMany(filters: VisaArticleFilters, page: number, limit: number) {
    const where: Prisma.VisaKnowledgeArticleWhereInput = {};
    if (!filters.includeInactive) where.isActive = true;
    if (filters.country) where.country = filters.country;
    if (filters.visaType) where.visaType = filters.visaType;

    const [data, total] = await Promise.all([
      prisma.visaKnowledgeArticle.findMany({
        where,
        include: articleInclude,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.visaKnowledgeArticle.count({ where }),
    ]);
    return { data, total };
  }

  async findById(id: string) {
    return prisma.visaKnowledgeArticle.findUnique({
      where: { id },
      include: articleInclude,
    });
  }

  async slugExists(slug: string) {
    const row = await prisma.visaKnowledgeArticle.findUnique({
      where: { slug },
      select: { id: true },
    });
    return Boolean(row);
  }

  async create(data: Prisma.VisaKnowledgeArticleUncheckedCreateInput) {
    return prisma.visaKnowledgeArticle.create({
      data,
      include: articleInclude,
    });
  }

  async update(id: string, data: Prisma.VisaKnowledgeArticleUpdateInput) {
    return prisma.visaKnowledgeArticle.update({
      where: { id },
      data,
      include: articleInclude,
    });
  }

  // Contextual fetch: active articles whose country / visaType is either
  // unset (applies to all) or matches the record.
  async findForRecord(country?: string, visaType?: string) {
    return prisma.visaKnowledgeArticle.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ country: null }, ...(country ? [{ country }] : [])] },
          { OR: [{ visaType: null }, ...(visaType ? [{ visaType }] : [])] },
        ],
      },
      include: articleInclude,
      orderBy: { updatedAt: "desc" },
    });
  }
}

export const visaKbRepository = new VisaKbRepository();
