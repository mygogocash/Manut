import { crmSettingsRepository } from "@/modules/crm-settings/crm-settings.repository";
import type { UpdateCrmSettingsInput } from "@/modules/crm-settings/crm-settings.validation";

export class CrmSettingsService {
  async getSettings() {
    const row = await crmSettingsRepository.getSettings();
    return {
      data: {
        notifyEmails: row.notifyEmails,
        notifyOnCreate: row.notifyOnCreate,
        notifyOwnerOnCreate: row.notifyOwnerOnCreate,
        notifyOwnerOnStageChange: row.notifyOwnerOnStageChange,
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  }

  async updateSettings(input: UpdateCrmSettingsInput, actorId: string) {
    const dedupedEmails = Array.from(new Set(input.notifyEmails));
    const row = await crmSettingsRepository.upsertSettings(
      {
        notifyEmails: dedupedEmails,
        notifyOnCreate: input.notifyOnCreate,
        notifyOwnerOnCreate: input.notifyOwnerOnCreate,
        notifyOwnerOnStageChange: input.notifyOwnerOnStageChange,
      },
      actorId,
    );
    return {
      data: {
        notifyEmails: row.notifyEmails,
        notifyOnCreate: row.notifyOnCreate,
        notifyOwnerOnCreate: row.notifyOwnerOnCreate,
        notifyOwnerOnStageChange: row.notifyOwnerOnStageChange,
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  }
}

export const crmSettingsService = new CrmSettingsService();
