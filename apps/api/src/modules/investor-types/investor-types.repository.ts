import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

export class InvestorTypeRepository {
  async findAll() {
    return prisma.investorTypeOption.findMany({
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });
  }

  async findByKey(key: string) {
    return prisma.investorTypeOption.findUnique({ where: { key } });
  }

  async maxSortOrder(): Promise<number> {
    const row = await prisma.investorTypeOption.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return row?.sortOrder ?? -1;
  }

  async createManyIfMissing(
    rows: { key: string; label: string; sortOrder: number }[],
  ) {
    return prisma.investorTypeOption.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }

  async create(data: Prisma.InvestorTypeOptionCreateInput) {
    return prisma.investorTypeOption.create({ data });
  }

  async update(key: string, data: Prisma.InvestorTypeOptionUpdateInput) {
    return prisma.investorTypeOption.update({ where: { key }, data });
  }

  // Delete a type and move any investors on it to `reassignTo`, in one
  // transaction so no investor is left on a type that no longer exists.
  async deleteAndReassign(key: string, reassignTo: string) {
    return prisma.$transaction(async (tx) => {
      await tx.investor.updateMany({
        where: { type: key },
        data: { type: reassignTo },
      });
      await tx.investorTypeOption.delete({ where: { key } });
    });
  }

  async applySortOrder(orderedKeys: string[]) {
    await prisma.$transaction(
      orderedKeys.map((key, index) =>
        prisma.investorTypeOption.update({
          where: { key },
          data: { sortOrder: index },
        }),
      ),
    );
  }
}

export const investorTypeRepository = new InvestorTypeRepository();
