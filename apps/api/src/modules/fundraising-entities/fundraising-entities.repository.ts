import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

export class FundraisingEntityRepository {
  async findAll() {
    return prisma.fundraisingEntity.findMany({
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });
  }

  async findByKey(key: string) {
    return prisma.fundraisingEntity.findUnique({ where: { key } });
  }

  async maxSortOrder(): Promise<number> {
    const row = await prisma.fundraisingEntity.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return row?.sortOrder ?? -1;
  }

  async createManyIfMissing(
    rows: { key: string; label: string; sortOrder: number }[],
  ) {
    return prisma.fundraisingEntity.createMany({
      data: rows,
      skipDuplicates: true,
    });
  }

  async create(data: Prisma.FundraisingEntityCreateInput) {
    return prisma.fundraisingEntity.create({ data });
  }

  async update(key: string, data: Prisma.FundraisingEntityUpdateInput) {
    return prisma.fundraisingEntity.update({ where: { key }, data });
  }

  // Delete an entity and move every CRM row on it to `reassignTo`, in
  // one transaction so no investor / lead / account / contact is left
  // on a key that no longer exists. Tasks and activities inherit via
  // the investor relation, so they do not need a separate rewrite.
  async deleteAndReassign(key: string, reassignTo: string) {
    return prisma.$transaction(async (tx) => {
      await tx.investor.updateMany({
        where: { fundraisingEntity: key },
        data: { fundraisingEntity: reassignTo },
      });
      await tx.investorLead.updateMany({
        where: { fundraisingEntity: key },
        data: { fundraisingEntity: reassignTo },
      });
      await tx.investorAccount.updateMany({
        where: { fundraisingEntity: key },
        data: { fundraisingEntity: reassignTo },
      });
      await tx.investorContact.updateMany({
        where: { fundraisingEntity: key },
        data: { fundraisingEntity: reassignTo },
      });
      await tx.fundraisingEntity.delete({ where: { key } });
    });
  }

  async applySortOrder(orderedKeys: string[]) {
    await prisma.$transaction(
      orderedKeys.map((key, index) =>
        prisma.fundraisingEntity.update({
          where: { key },
          data: { sortOrder: index },
        }),
      ),
    );
  }
}

export const fundraisingEntityRepository = new FundraisingEntityRepository();
