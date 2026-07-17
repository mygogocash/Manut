import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

export class InvestorPipelineStageRepository {
  async findAll() {
    return prisma.investorPipelineStage.findMany({
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });
  }

  async findByKey(key: string) {
    return prisma.investorPipelineStage.findUnique({ where: { key } });
  }

  async count() {
    return prisma.investorPipelineStage.count();
  }

  async maxSortOrder(): Promise<number> {
    const row = await prisma.investorPipelineStage.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    return row?.sortOrder ?? -1;
  }

  async create(data: Prisma.InvestorPipelineStageCreateInput) {
    return prisma.investorPipelineStage.create({ data });
  }

  async update(key: string, data: Prisma.InvestorPipelineStageUpdateInput) {
    return prisma.investorPipelineStage.update({ where: { key }, data });
  }

  // Delete a stage and move any investors parked on it to `reassignTo`,
  // in one transaction so the board never shows orphaned cards.
  async deleteAndReassign(key: string, reassignTo: string) {
    return prisma.$transaction(async (tx) => {
      await tx.investor.updateMany({
        where: { status: key },
        data: { status: reassignTo },
      });
      await tx.investorPipelineStage.delete({ where: { key } });
    });
  }

  async applySortOrder(orderedKeys: string[]) {
    await prisma.$transaction(
      orderedKeys.map((key, index) =>
        prisma.investorPipelineStage.update({
          where: { key },
          data: { sortOrder: index },
        }),
      ),
    );
  }
}

export const investorPipelineStageRepository =
  new InvestorPipelineStageRepository();
