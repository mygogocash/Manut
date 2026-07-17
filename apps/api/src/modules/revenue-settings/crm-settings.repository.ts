import { prisma } from "@/infrastructure/database/prisma";

export class CrmSettingsRepository {
  // Singleton row enforced by the unique `singleton` column. The
  // migration seeds the row at deploy time; this fetch stays defensive
  // for fresh dev DBs and any test environment that skips the seed.
  async getSettings() {
    const row = await prisma.revenueSettings.findFirst({
      where: { singleton: true },
    });
    if (row) return row;
    return prisma.revenueSettings.create({
      data: { singleton: true, notifyEmails: [] },
    });
  }

  async upsertSettings(
    data: {
      notifyEmails: string[];
      notifyOnCreate: boolean;
      notifyOwnerOnCreate: boolean;
      notifyOwnerOnStageChange: boolean;
    },
    updatedById: string,
  ) {
    return prisma.revenueSettings.upsert({
      where: { singleton: true },
      create: { singleton: true, ...data, updatedById },
      update: { ...data, updatedById },
    });
  }
}

export const crmSettingsRepository = new CrmSettingsRepository();
