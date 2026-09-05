import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const userSelect = { id: true, name: true, email: true } as const;

const campaignInclude = {
  owner: { select: userSelect },
  createdBy: { select: userSelect },
  levers: { include: { lever: true } },
  creatives: {
    include: { uploadedBy: { select: userSelect } },
    orderBy: { version: "desc" as const },
  },
  predictions: {
    include: { uploadedBy: { select: userSelect } },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.MktCampaignInclude;

export type MktCampaignWithRelations = Prisma.MktCampaignGetPayload<{
  include: typeof campaignInclude;
}>;

const listInclude = {
  owner: { select: userSelect },
  levers: { include: { lever: true } },
  _count: { select: { creatives: true, predictions: true } },
} satisfies Prisma.MktCampaignInclude;

export type MktCampaignListRow = Prisma.MktCampaignGetPayload<{
  include: typeof listInclude;
}>;

export class MarketingCampaignsRepository {
  // ── Campaigns ──
  list(args: {
    where: Prisma.MktCampaignWhereInput;
    skip: number;
    take: number;
  }) {
    return prisma.mktCampaign.findMany({
      where: args.where,
      include: listInclude,
      orderBy: { campaignDate: "desc" },
      skip: args.skip,
      take: args.take,
    });
  }
  count(where: Prisma.MktCampaignWhereInput) {
    return prisma.mktCampaign.count({ where });
  }
  findById(id: string) {
    return prisma.mktCampaign.findUnique({
      where: { id },
      include: campaignInclude,
    });
  }
  create(data: Prisma.MktCampaignUncheckedCreateInput) {
    return prisma.mktCampaign.create({ data, include: campaignInclude });
  }
  update(id: string, data: Prisma.MktCampaignUncheckedUpdateInput) {
    return prisma.mktCampaign.update({
      where: { id },
      data,
      include: campaignInclude,
    });
  }
  delete(id: string) {
    return prisma.mktCampaign.delete({ where: { id } });
  }

  // ── Levers (multi-select) ──
  setCampaignLevers(campaignId: string, leverIds: string[]) {
    return prisma.$transaction(async (tx) => {
      await tx.mktCampaignLever.deleteMany({ where: { campaignId } });
      if (leverIds.length > 0) {
        await tx.mktCampaignLever.createMany({
          data: leverIds.map((leverId) => ({ campaignId, leverId })),
          skipDuplicates: true,
        });
      }
    });
  }
  validLeverIds(ids: string[]) {
    return prisma.mktLever.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
  }

  // ── Levers config ──
  listLevers(activeOnly: boolean) {
    return prisma.mktLever.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }
  findLever(id: string) {
    return prisma.mktLever.findUnique({ where: { id } });
  }
  createLever(data: Prisma.MktLeverUncheckedCreateInput) {
    return prisma.mktLever.create({ data });
  }
  updateLever(id: string, data: Prisma.MktLeverUncheckedUpdateInput) {
    return prisma.mktLever.update({ where: { id }, data });
  }
  deleteLever(id: string) {
    return prisma.mktLever.delete({ where: { id } });
  }

  // ── Creatives (versioned) ──
  latestCreativeVersion(campaignId: string) {
    return prisma.mktCreative.aggregate({
      where: { campaignId },
      _max: { version: true },
    });
  }
  createCreative(data: Prisma.MktCreativeUncheckedCreateInput) {
    return prisma.mktCreative.create({
      data,
      include: { uploadedBy: { select: userSelect } },
    });
  }
  findCreative(id: string) {
    return prisma.mktCreative.findUnique({ where: { id } });
  }
  deleteCreative(id: string) {
    return prisma.mktCreative.delete({ where: { id } });
  }

  // ── Predictions (history) ──
  createPrediction(data: Prisma.MktPredictionUncheckedCreateInput) {
    return prisma.mktPrediction.create({
      data,
      include: { uploadedBy: { select: userSelect } },
    });
  }
  findPrediction(id: string) {
    return prisma.mktPrediction.findUnique({ where: { id } });
  }
  deletePrediction(id: string) {
    return prisma.mktPrediction.delete({ where: { id } });
  }
}

export const marketingCampaignsRepository = new MarketingCampaignsRepository();
